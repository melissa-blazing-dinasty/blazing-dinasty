import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

/**
 * TemoignagesEspace — Onglet "Mon témoignage" pour l'équipe
 * ----------------------------------------------------------
 * À placer dans l'Espace Chef ou dans "Mon Univers" de la PWA.
 * Chaque distributrice choisit sa catégorie, écrit son témoignage
 * (texte, ou photo/vidéo), et l'envoie. Limite : 5 témoignages MAX par
 * catégorie — au-delà, la catégorie est fermée et la personne est invitée
 * à en choisir une autre ou à contacter Mélissa pour remplacer un témoignage
 * existant.
 *
 * BRANCHEMENT FIRESTORE (à faire demain) :
 * Collection : temoignages/{autoId}
 *   { profil, nom, texte, media: {type,url,caption}|null, distributriceId, valide: false }
 *
 * Avant d'autoriser l'envoi, on compte les témoignages déjà VALIDÉS pour la
 * catégorie choisie :
 *   const q = query(collection(db, "temoignages"),
 *                    where("profil", "==", categorieChoisie),
 *                    where("valide", "==", true));
 *   const snap = await getDocs(q);
 *   const dejaPlein = snap.size >= 5;
 *
 * `getCompteurs(db)` ci-dessous montre la fonction à écrire pour récupérer
 * le nombre de témoignages par catégorie en un seul chargement (plus
 * efficace que de recompter à chaque frappe).
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
  const [mediaUrl, setMediaUrl] = useState("");
  const [envoi, setEnvoi] = useState("idle"); // idle | loading | envoye | erreur

  useEffect(() => {
    getCompteurs(db).then(setCompteurs);
  }, [db]);

  const categorieComplete = (cat) => compteurs && compteurs[cat] >= MAX_PAR_CATEGORIE;

  const peutEnvoyer =
    categorie &&
    !categorieComplete(categorie) &&
    (typeMedia === "texte" ? texte.trim().length > 0 : mediaUrl.trim().length > 0);

  const envoyer = async () => {
    if (!peutEnvoyer) return;
    setEnvoi("loading");
    try {
      const payload = {
        profil: categorie,
        nom: distributriceNom || "Anonyme",
        distributriceId: distributriceId || null,
        texte: typeMedia === "texte" ? texte.trim() : "",
        media:
          typeMedia !== "texte"
            ? { type: typeMedia, url: mediaUrl.trim(), caption: texte.trim() || "" }
            : null,
        valide: false, // Mélissa valide avant publication dans le tunnel
        creeLe: new Date().toISOString(),
      };
      await addDoc(collection(db, "temoignages"), payload);
      onSubmit && (await onSubmit(payload));
      setEnvoi("envoye");
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
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, marginBottom: 6 }}>
        Ton témoignage
      </h2>
      <p style={{ opacity: 0.65, fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
        Choisis la catégorie qui te ressemble le plus. 5 témoignages maximum par
        catégorie — si la tienne est complète, choisis-en une autre ou parles-en à Mélissa.
      </p>

      {envoi === "envoye" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, borderRadius: 14, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)" }}>
          <CheckCircle2 size={20} color="#16a34a" />
          <span style={{ fontSize: 14 }}>Ton témoignage a été envoyé pour validation. Merci !</span>
        </div>
      ) : (
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
            <input
              placeholder={typeMedia === "photo" ? "Lien de ta photo" : "Lien de ta vidéo"}
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)", marginBottom: 12, boxSizing: "border-box" }}
            />
          )}

          <textarea
            placeholder={typeMedia === "texte" ? "Écris ton témoignage ici…" : "Légende (optionnelle)"}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={4}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)", marginBottom: 20, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
          />

          <button
            disabled={!peutEnvoyer || envoi === "loading"}
            onClick={envoyer}
            style={{
              width: "100%",
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
                <Loader2 size={16} className="animate-spin" /> Envoi…
              </>
            ) : (
              "Envoyer mon témoignage"
            )}
          </button>
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
