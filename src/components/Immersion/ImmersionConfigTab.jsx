import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import TemoignagesEspace from "./TemoignagesEspace";

/**
 * ImmersionConfigTab — Onglet "Immersion" dans Ma Boîte à Outils
 * ----------------------------------------------------------------
 * Permet à chaque distributrice de remplir son propre parcours
 * d'immersion directement depuis l'app, sans toucher au code.
 *
 * PROPS :
 * - uid : identifiant de la distributrice connectée
 * - db  : instance Firestore déjà initialisée dans App.js
 * - isChef : si true, affiche en plus l'onglet "Contenu commun"
 *            (formations/outils partagés par toute l'équipe)
 */

const COLORS = { or: "#C9A55C", brun: "#3D2B1F", rose: "#E7C9C9", creme: "#FAF7F2" };

function Champ({ label, value, onChange, textarea, placeholder }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: COLORS.brun, marginBottom: 6 }}>
        {label}
      </label>
      {textarea ? (
        <textarea
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)", fontFamily: "inherit", boxSizing: "border-box" }}
        />
      )}
    </div>
  );
}

const contenuVide = {
  prenom: "",
  accroche: "",
  avantTexte: "",
  basculeEtapes: ["", "", "", ""],
  journee: [
    { heure: "8h", icon: "sunrise", texte: "" },
    { heure: "13h", icon: "sun", texte: "" },
    { heure: "20h", icon: "moon", texte: "" },
  ],
  motCle: "",
  lienDiagnostic: "/audit-blazing",
  lienInscription: "",
  temoignagesSelectionnes: [],
};

export default function ImmersionConfigTab({ uid, db, isChef }) {
  const [sousOnglet, setSousOnglet] = useState("contenu"); // contenu | temoignage | choix | commun
  const [contenu, setContenu] = useState(contenuVide);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [poolTemoignages, setPoolTemoignages] = useState([]);
  const [loadingPool, setLoadingPool] = useState(false);
  const [savingChoix, setSavingChoix] = useState(false);
  const [savedChoix, setSavedChoix] = useState(false);

  const [communContenu, setCommunContenu] = useState({ outils: [] });
  const [savingCommun, setSavingCommun] = useState(false);
  const [savedCommun, setSavedCommun] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "immersion", uid));
        if (snap.exists()) setContenu({ ...contenuVide, ...snap.data() });
      } catch (e) {
        console.error("Erreur chargement immersion", e);
      }
      setLoading(false);
    })();
  }, [uid]);

  useEffect(() => {
    if (!isChef) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "immersion", "_commun"));
        if (snap.exists()) setCommunContenu({ outils: [], ...snap.data() });
      } catch (e) {
        console.error("Erreur chargement contenu commun", e);
      }
    })();
  }, [isChef]);

  useEffect(() => {
    if (sousOnglet !== "choix" || poolTemoignages.length > 0) return;
    setLoadingPool(true);
    (async () => {
      try {
        const q = query(collection(db, "temoignages"), where("valide", "==", true));
        const snap = await getDocs(q);
        const liste = [];
        snap.forEach((d) => liste.push({ id: d.id, ...d.data() }));
        liste.sort((a, b) => (a.profil || "").localeCompare(b.profil || ""));
        setPoolTemoignages(liste);
      } catch (e) {
        console.error("Erreur chargement pool témoignages", e);
      }
      setLoadingPool(false);
    })();
  }, [sousOnglet]);

  const toggleSelection = (id) => {
    const selectionnes = contenu.temoignagesSelectionnes || [];
    const next = selectionnes.includes(id) ? selectionnes.filter((x) => x !== id) : [...selectionnes, id];
    setContenu({ ...contenu, temoignagesSelectionnes: next });
  };

  const sauvegarderChoix = async () => {
    setSavingChoix(true);
    try {
      await setDoc(doc(db, "immersion", uid), { temoignagesSelectionnes: contenu.temoignagesSelectionnes || [] }, { merge: true });
      setSavedChoix(true);
      setTimeout(() => setSavedChoix(false), 2500);
    } catch (e) {
      console.error("Erreur sauvegarde sélection témoignages", e);
    }
    setSavingChoix(false);
  };

  const poolParCategorie = poolTemoignages.reduce((acc, t) => {
    const cat = t.profil || "Autre";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  const sauvegarder = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "immersion", uid), contenu, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error("Erreur sauvegarde immersion", e);
    }
    setSaving(false);
  };

  const sauvegarderCommun = async () => {
    setSavingCommun(true);
    try {
      await setDoc(doc(db, "immersion", "_commun"), communContenu, { merge: true });
      setSavedCommun(true);
      setTimeout(() => setSavedCommun(false), 2500);
    } catch (e) {
      console.error("Erreur sauvegarde contenu commun", e);
    }
    setSavingCommun(false);
  };

  const majBascule = (i, val) => {
    const next = [...contenu.basculeEtapes];
    next[i] = val;
    setContenu({ ...contenu, basculeEtapes: next });
  };

  const majJournee = (i, val) => {
    const next = [...contenu.journee];
    next[i] = { ...next[i], texte: val };
    setContenu({ ...contenu, journee: next });
  };

  const majOutil = (i, field, val) => {
    const next = [...communContenu.outils];
    next[i] = { ...next[i], [field]: val };
    setCommunContenu({ ...communContenu, outils: next });
  };

  const ajouterOutil = () => {
    setCommunContenu({ ...communContenu, outils: [...(communContenu.outils || []), { titre: "", texte: "", details: [] }] });
  };

  const supprimerOutil = (i) => {
    setCommunContenu({ ...communContenu, outils: communContenu.outils.filter((_, idx) => idx !== i) });
  };

  const lienPreview = `${window.location.origin}/?immersion=${uid}`;

  if (loading) return <div style={{ padding: 24, textAlign: "center" }}>Chargement...</div>;

  return (
    <div style={{ padding: "1rem", maxWidth: 560, margin: "0 auto" }}>
      <div id="decouverte-immersion-onglets" style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={() => setSousOnglet("contenu")} style={btnOnglet(sousOnglet === "contenu")}>
          Mon contenu
        </button>
        <button onClick={() => setSousOnglet("temoignage")} style={btnOnglet(sousOnglet === "temoignage")}>
          Mon témoignage
        </button>
        <button onClick={() => setSousOnglet("choix")} style={btnOnglet(sousOnglet === "choix")}>
          Choisir mes témoignages
        </button>
        {isChef && (
          <button onClick={() => setSousOnglet("commun")} style={btnOnglet(sousOnglet === "commun")}>
            Contenu commun
          </button>
        )}
      </div>

      {sousOnglet === "contenu" && (
        <>
          <p style={{ fontSize: 13.5, opacity: 0.7, marginBottom: 20, lineHeight: 1.5 }}>
            Ce contenu alimente ta page d'immersion personnelle, à partager avec tes prospects.
          </p>

          <Champ label="Ton prénom" value={contenu.prenom} onChange={(v) => setContenu({ ...contenu, prenom: v })} />
          <Champ label="Accroche (1ère phrase)" value={contenu.accroche} onChange={(v) => setContenu({ ...contenu, accroche: v })} textarea placeholder="Et si ta vie ressemblait enfin à ce que tu mérites ?" />
          <Champ label="Le Avant (identification)" value={contenu.avantTexte} onChange={(v) => setContenu({ ...contenu, avantTexte: v })} textarea placeholder="Il y a eu un temps où je me sentais invisible…" />

          <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: COLORS.brun, marginBottom: 6 }}>
            La bascule (4 étapes)
          </label>
          {contenu.basculeEtapes.map((etape, i) => (
            <Champ key={i} label={`Étape ${i + 1}`} value={etape} onChange={(v) => majBascule(i, v)} textarea placeholder={`Étape ${i + 1} de ton déclic`} />
          ))}

          <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: COLORS.brun, marginBottom: 6 }}>
            Une journée type
          </label>
          {contenu.journee.map((mom, i) => (
            <Champ key={i} label={`${mom.heure}`} value={mom.texte} onChange={(v) => majJournee(i, v)} textarea placeholder="Ce que tu vis à ce moment de la journée" />
          ))}

          <Champ label="Mot-clé CTA" value={contenu.motCle} onChange={(v) => setContenu({ ...contenu, motCle: v })} placeholder="RENAISSANCE" />
          <Champ label="Lien vers ton diagnostic" value={contenu.lienDiagnostic} onChange={(v) => setContenu({ ...contenu, lienDiagnostic: v })} placeholder="/audit-blazing" />
          <Champ label="Lien d'inscription" value={contenu.lienInscription} onChange={(v) => setContenu({ ...contenu, lienInscription: v })} placeholder="https://blazingdinasty.com/r/tonlien" />

          <button
            onClick={sauvegarder}
            disabled={saving}
            style={{ width: "100%", padding: 14, borderRadius: 999, border: "none", background: `linear-gradient(90deg,#E4CE97,${COLORS.or})`, color: COLORS.brun, fontWeight: 700, fontSize: 15, cursor: "pointer", marginBottom: 12 }}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          {saved && <p style={{ color: "#16a34a", fontSize: 13.5, textAlign: "center", marginBottom: 16 }}>Enregistré ✓</p>}

          <a href={lienPreview} target="_blank" rel="noreferrer" id="decouverte-immersion-preview" style={{ display: "block", textAlign: "center", fontSize: 13.5, color: COLORS.or, fontWeight: 700, textDecoration: "none" }}>
            Voir ma page d'immersion →
          </a>
        </>
      )}

      {sousOnglet === "temoignage" && (
        <TemoignagesEspace distributriceId={uid} distributriceNom={contenu.prenom} db={db} />
      )}

      {sousOnglet === "choix" && (
        <>
          <p style={{ fontSize: 13.5, opacity: 0.7, marginBottom: 20, lineHeight: 1.5 }}>
            Coche les témoignages validés de l'équipe que tu veux afficher dans <strong>ta</strong> page d'immersion. Si tu n'en coches aucun, ta page affichera une sélection par défaut.
          </p>
          {loadingPool && <p style={{ fontSize: 13.5, opacity: 0.6 }}>Chargement des témoignages…</p>}
          {!loadingPool && poolTemoignages.length === 0 && (
            <p style={{ fontSize: 13.5, opacity: 0.6 }}>Aucun témoignage validé pour le moment.</p>
          )}
          {Object.entries(poolParCategorie).map(([cat, liste]) => (
            <div key={cat} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, color: COLORS.or, marginBottom: 8 }}>
                {cat}
              </div>
              {liste.map((t) => {
                const checked = (contenu.temoignagesSelectionnes || []).includes(t.id);
                return (
                  <label
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: `1px solid ${checked ? COLORS.or : "rgba(0,0,0,0.12)"}`,
                      background: checked ? "rgba(201,165,92,0.08)" : "transparent",
                      marginBottom: 8,
                      cursor: "pointer",
                    }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleSelection(t.id)} style={{ marginTop: 3, accentColor: COLORS.or }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.nom}</div>
                      <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.4 }}>{t.texte}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          ))}
          {poolTemoignages.length > 0 && (
            <button
              onClick={sauvegarderChoix}
              disabled={savingChoix}
              style={{ width: "100%", padding: 14, borderRadius: 999, border: "none", background: `linear-gradient(90deg,#E4CE97,${COLORS.or})`, color: COLORS.brun, fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 8 }}
            >
              {savingChoix ? "Enregistrement…" : "Enregistrer ma sélection"}
            </button>
          )}
          {savedChoix && <p style={{ color: "#16a34a", fontSize: 13.5, textAlign: "center", marginTop: 10 }}>Enregistré ✓</p>}
        </>
      )}

      {sousOnglet === "commun" && isChef && (
        <>
          <p style={{ fontSize: 13.5, opacity: 0.7, marginBottom: 20, lineHeight: 1.5 }}>
            Ce contenu est commun à toute l'équipe : les outils et formations affichés dans "Les coulisses" du tunnel.
          </p>
          {(communContenu.outils || []).map((o, i) => (
            <div key={i} style={{ border: "1px solid rgba(0,0,0,0.1)", borderRadius: 14, padding: 14, marginBottom: 14 }}>
              <Champ label="Titre" value={o.titre} onChange={(v) => majOutil(i, "titre", v)} />
              <Champ label="Description courte" value={o.texte} onChange={(v) => majOutil(i, "texte", v)} textarea />
              <Champ
                label="Détails (un point par ligne)"
                value={(o.details || []).join("\n")}
                onChange={(v) => majOutil(i, "details", v.split("\n").filter(Boolean))}
                textarea
              />
              <button onClick={() => supprimerOutil(i)} style={{ background: "none", border: "none", color: "#dc2626", fontSize: 12.5, cursor: "pointer" }}>
                Supprimer cet outil
              </button>
            </div>
          ))}
          <button onClick={ajouterOutil} style={{ width: "100%", padding: 12, borderRadius: 10, border: `1px dashed ${COLORS.or}`, background: "none", color: COLORS.or, fontWeight: 700, cursor: "pointer", marginBottom: 20 }}>
            + Ajouter un outil / une formation
          </button>
          <button
            onClick={sauvegarderCommun}
            disabled={savingCommun}
            style={{ width: "100%", padding: 14, borderRadius: 999, border: "none", background: `linear-gradient(90deg,#E4CE97,${COLORS.or})`, color: COLORS.brun, fontWeight: 700, fontSize: 15, cursor: "pointer" }}
          >
            {savingCommun ? "Enregistrement…" : "Enregistrer le contenu commun"}
          </button>
          {savedCommun && <p style={{ color: "#16a34a", fontSize: 13.5, textAlign: "center", marginTop: 10 }}>Enregistré ✓</p>}
        </>
      )}
    </div>
  );
}

function btnOnglet(active) {
  return {
    padding: "8px 16px",
    borderRadius: 999,
    border: `1px solid ${active ? COLORS.or : "rgba(0,0,0,0.15)"}`,
    background: active ? COLORS.or : "transparent",
    color: active ? COLORS.brun : "inherit",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  };
}
