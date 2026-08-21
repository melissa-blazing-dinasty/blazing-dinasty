import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { CheckCircle2, AlertCircle, Loader2, Pencil, Trash2, Upload } from "lucide-react";

const storage = getStorage();

/**
 * TemoignagesEspace — Onglet "Mon témoignage" pour l'équipe
 * ----------------------------------------------------------
 * Chaque distributrice choisit sa catégorie, écrit son témoignage
 * (texte, ou photo/vidéo), et l'envoie. Limite : 5 témoignages MAX par
 * catégorie (validés) — au-delà, la catégorie est fermée.
 *
 * Chaque distributrice voit la liste de SES propres témoignages
 * (quel que soit leur statut) et peut les modifier ou les supprimer.
 * Modifier un témoignage déjà validé le repasse en attente de validation.
 *
 * RÈGLES FIRESTORE ATTENDUES (voir SCHEMA_FIRESTORE.md) :
 *   allow update, delete: if request.auth != null
 *     && (request.auth.uid == resource.data.distributriceId || request.auth.uid == 'melissa-da-silveira');
 */

const CATEGORIES = [
  "Maman",
  "Reconversion",
  "Débutante",
  "Confirmée",
  "Étudiante",
  "Autre",
];

const MAX_PAR_CATEGORIE = 5;

// Récupère, pour chaque catégorie, le nombre de témoignages déjà validés.
async function getCompteurs(db) {
  const resultats = {};
  for (const cat of CATEGORIES) {
    try {
      const q = query(collection(db, "temoignages"), where("profil", "==", cat), where("valide", "==", true));
      const snap = await getDocs(q);
      resultats[cat] = snap.size;
    } catch (e) {
      resultats[cat] = 0;
    }
  }
  return resultats;
}

export default function TemoignagesEspace({ distributriceId, distributriceNom, db, onSubmit }) {
  const [compteurs, setCompteurs] = useState(null);
  const [categorie, setCategorie] = useState("");
  const [texte, setTexte] = useState("");
  const [typeMedia, setTypeMedia] = useState("texte"); // "texte" | "photo" | "video"
  const [mediaUrl, setMediaUrl] = useState(""); // URL déjà en ligne (édition d'un témoignage existant)
  const [fichierMedia, setFichierMedia] = useState(null); // Fichier local en attente d'envoi
  const [previewMedia, setPreviewMedia] = useState(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [envoi, setEnvoi] = useState("idle"); // idle | loading | envoye | erreur

  const [mesTemoignages, setMesTemoignages] = useState([]);
  const [loadingMes, setLoadingMes] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [suppressionId, setSuppressionId] = useState(null);

  useEffect(() => {
    getCompteurs(db).then(setCompteurs);
  }, [db]);

  const chargerMesTemoignages = async () => {
    if (!distributriceId) return;
    setLoadingMes(true);
    try {
      const q = query(collection(db, "temoignages"), where("distributriceId", "==", distributriceId));
      const snap = await getDocs(q);
      const liste = [];
      snap.forEach((d) => liste.push({ id: d.id, ...d.data() }));
      setMesTemoignages(liste);
    } catch (e) {
      console.error("Erreur chargement mes temoignages", e);
    }
    setLoadingMes(false);
  };

  useEffect(() => {
    chargerMesTemoignages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distributriceId]);

  // Un slot de catégorie est complet, sauf si c'est celui qu'on est justement en train de modifier
  const categorieComplete = (cat) => {
    if (!compteurs) return false;
    const total = compteurs[cat] || 0;
    if (editingId) {
      const original = mesTemoignages.find((t) => t.id === editingId);
      if (original && original.profil === cat && original.valide) {
        return total - 1 >= MAX_PAR_CATEGORIE;
      }
    }
    return total >= MAX_PAR_CATEGORIE;
  };

  const peutEnvoyer =
    categorie &&
    !categorieComplete(categorie) &&
    (typeMedia === "texte" ? texte.trim().length > 0 : !!(fichierMedia || mediaUrl));

  const reinitialiserFormulaire = () => {
    setCategorie("");
    setTexte("");
    setTypeMedia("texte");
    setMediaUrl("");
    setFichierMedia(null);
    setPreviewMedia(null);
    setEditingId(null);
    setEnvoi("idle");
  };

  const commencerModification = (t) => {
    setEditingId(t.id);
    setCategorie(t.profil || "");
    setTypeMedia(t.media?.type || "texte");
    setMediaUrl(t.media?.url || "");
    setFichierMedia(null);
    setPreviewMedia(t.media?.url || null);
    setTexte(t.media ? t.media.caption || "" : t.texte || "");
    setEnvoi("idle");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const choisirFichier = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const estVideo = f.type.startsWith("video/");
    if (estVideo && f.size > 50 * 1024 * 1024) {
      alert("La vidéo est trop lourde (50 Mo max).");
      return;
    }
    if (!estVideo && f.size > 8 * 1024 * 1024) {
      alert("La photo est trop lourde (8 Mo max).");
      return;
    }
    setFichierMedia(f);
    const reader = new FileReader();
    reader.onload = () => setPreviewMedia(reader.result);
    reader.readAsDataURL(f);
  };

  const supprimerTemoignage = async (id) => {
    setSuppressionId(id);
    try {
      await deleteDoc(doc(db, "temoignages", id));
      setMesTemoignages((liste) => liste.filter((t) => t.id !== id));
      if (editingId === id) reinitialiserFormulaire();
      getCompteurs(db).then(setCompteurs);
    } catch (e) {
      console.error("Erreur suppression temoignage", e);
    }
    setSuppressionId(null);
  };

  const envoyer = async () => {
    if (!peutEnvoyer) return;
    setEnvoi("loading");
    try {
      let urlFinale = mediaUrl;
      if (typeMedia !== "texte" && fichierMedia) {
        setUploadingMedia(true);
        try {
          const ext = fichierMedia.name.split(".").pop() || (typeMedia === "video" ? "mp4" : "jpg");
          const idFichier = `${distributriceId || "anonyme"}_${Date.now()}.${ext}`;
          const chemin = storageRef(storage, `temoignages/${idFichier}`);
          await uploadBytes(chemin, fichierMedia);
          urlFinale = await getDownloadURL(chemin);
        } finally {
          setUploadingMedia(false);
        }
      }

      const payload = {
        profil: categorie,
        nom: distributriceNom || "Anonyme",
        distributriceId: distributriceId || null,
        texte: typeMedia === "texte" ? texte.trim() : "",
        media:
          typeMedia !== "texte"
            ? { type: typeMedia, url: urlFinale, caption: texte.trim() || "" }
            : null,
      };

      if (editingId) {
        // On repasse en attente de validation puisque le contenu a changé
        await updateDoc(doc(db, "temoignages", editingId), { ...payload, valide: false });
      } else {
        await addDoc(collection(db, "temoignages"), {
          ...payload,
          valide: false,
          creeLe: new Date().toISOString(),
        });
      }

      onSubmit && (await onSubmit(payload));
      setEnvoi("envoye");
      await chargerMesTemoignages();
      getCompteurs(db).then(setCompteurs);
    } catch (e) {
      setEnvoi("erreur");
    }
  };

  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        maxWidth: 480,
        margin: "0 auto",
        padding: 24,
      }}
    >
      {/* Mes témoignages existants */}
      {!loadingMes && mesTemoignages.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, marginBottom: 10 }}>
            Mes témoignages
          </h3>
          {mesTemoignages.map((t) => (
            <div
              key={t.id}
              style={{
                borderRadius: 14,
                padding: 14,
                marginBottom: 10,
                border: `1px solid ${editingId === t.id ? "#C9A55C" : "rgba(0,0,0,0.12)"}`,
                background: editingId === t.id ? "rgba(201,165,92,0.06)" : "transparent",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, color: "#C9A55C" }}>
                  {t.profil}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: t.valide ? "rgba(34,197,94,0.12)" : "rgba(234,179,8,0.15)",
                    color: t.valide ? "#16a34a" : "#ca8a04",
                  }}
                >
                  {t.valide ? "Publié" : "En attente"}
                </span>
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 1.5, marginBottom: 10 }}>
                {t.media?.url ? (t.media.caption || `${t.media.type === "photo" ? "Photo" : "Vidéo"} : ${t.media.url}`) : t.texte}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => commencerModification(t)}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.15)", background: "none", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                >
                  <Pencil size={13} /> Modifier
                </button>
                <button
                  disabled={suppressionId === t.id}
                  onClick={() => supprimerTemoignage(t.id)}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "6px 10px", borderRadius: 999, border: "1px solid #dc2626", background: "none", color: "#dc2626", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                >
                  <Trash2 size={13} /> {suppressionId === t.id ? "…" : "Supprimer"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, marginBottom: 6 }}>
        {editingId ? "Modifier mon témoignage" : "Ton témoignage"}
      </h2>
      <p style={{ opacity: 0.65, fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
        {editingId
          ? "Ta modification repassera ce témoignage en attente de validation."
          : "Choisis la catégorie qui te ressemble le plus. 5 témoignages maximum par catégorie — si la tienne est complète, choisis-en une autre ou parles-en à Mélissa."}
      </p>

      {envoi === "envoye" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, borderRadius: 14, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", marginBottom: 16 }}>
          <CheckCircle2 size={20} color="#16a34a" />
          <span style={{ fontSize: 14 }}>Ton témoignage a bien été enregistré. Merci !</span>
        </div>
      )}

      {envoi !== "envoye" && (
        <>
          {/* Choix de catégorie */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 22 }}>
            {CATEGORIES.map((cat) => {
              const plein = categorieComplete(cat);
              const active = categorie === cat;
              return (
                <button
                  key={cat}
                  disabled={plein}
                  onClick={() => setCategorie(cat)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: `1px solid ${active ? "#C9A55C" : "rgba(0,0,0,0.15)"}`,
                    background: active ? "rgba(201,165,92,0.1)" : plein ? "rgba(0,0,0,0.03)" : "transparent",
                    color: plein ? "rgba(0,0,0,0.35)" : "inherit",
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: "left",
                    cursor: plein ? "not-allowed" : "pointer",
                    position: "relative",
                  }}
                >
                  {cat}
                  <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.6, marginTop: 2 }}>
                    {compteurs ? `${compteurs[cat] ?? 0}/${MAX_PAR_CATEGORIE}` : "…"}
                    {plein && " · complet"}
                  </div>
                </button>
              );
            })}
          </div>

          {categorie && categorieComplete(categorie) && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: 12, borderRadius: 12, background: "rgba(234,179,8,0.08)", marginBottom: 20, fontSize: 13 }}>
              <AlertCircle size={16} color="#ca8a04" />
              Cette catégorie est complète. Choisis-en une autre.
            </div>
          )}

          {/* Format du témoignage */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[
              { id: "texte", label: "Texte" },
              { id: "photo", label: "Photo" },
              { id: "video", label: "Vidéo" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setTypeMedia(f.id)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: `1px solid ${typeMedia === f.id ? "#C9A55C" : "rgba(0,0,0,0.15)"}`,
                  background: typeMedia === f.id ? "#C9A55C" : "transparent",
                  color: typeMedia === f.id ? "#171529" : "inherit",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {typeMedia !== "texte" && (
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "14px",
                  borderRadius: 12,
                  border: "1.5px dashed rgba(0,0,0,0.25)",
                  cursor: "pointer",
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: "#171529",
                }}
              >
                <Upload size={16} />
                {fichierMedia || mediaUrl ? "Changer le fichier" : `Choisir une ${typeMedia === "photo" ? "photo" : "vidéo"}`}
                <input
                  type="file"
                  accept={typeMedia === "photo" ? "image/*" : "video/*"}
                  onChange={choisirFichier}
                  style={{ display: "none" }}
                />
              </label>
              {previewMedia && (
                <div style={{ marginTop: 10 }}>
                  {typeMedia === "photo" ? (
                    <img src={previewMedia} alt="" style={{ width: "100%", borderRadius: 10, maxHeight: 220, objectFit: "cover" }} />
                  ) : (
                    <video src={previewMedia} controls style={{ width: "100%", borderRadius: 10, maxHeight: 220 }} />
                  )}
                </div>
              )}
            </div>
          )}

          <textarea
            placeholder={typeMedia === "texte" ? "Écris ton témoignage ici…" : "Légende (optionnelle)"}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={4}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)", marginBottom: 20, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
          />

          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled={!peutEnvoyer || envoi === "loading"}
              onClick={envoyer}
              style={{
                flex: 1,
                padding: "14px",
                borderRadius: 999,
                border: "none",
                background: peutEnvoyer ? "linear-gradient(90deg,#E4CE97,#C9A55C)" : "rgba(0,0,0,0.1)",
                color: peutEnvoyer ? "#171529" : "rgba(0,0,0,0.4)",
                fontWeight: 700,
                fontSize: 15,
                cursor: peutEnvoyer ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {envoi === "loading" ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> {uploadingMedia ? "Envoi du fichier…" : "Envoi…"}
                </>
              ) : editingId ? (
                "Enregistrer les modifications"
              ) : (
                "Envoyer mon témoignage"
              )}
            </button>
            {editingId && (
              <button
                onClick={reinitialiserFormulaire}
                style={{ padding: "14px 18px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.15)", background: "none", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
              >
                Annuler
              </button>
            )}
          </div>
          {envoi === "erreur" && (
            <p style={{ color: "#dc2626", fontSize: 13, marginTop: 10 }}>
              Une erreur est survenue, réessaie dans un instant.
            </p>
          )}
        </>
      )}
    </div>
  );
}
