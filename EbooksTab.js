import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { C } from './constants';

const THEMES_EBOOKS = [
  { id: "skincare", label: "✨ Skincare / Visage" },
  { id: "cheveux", label: "💇 Soin cheveux" },
  { id: "silhouette", label: "⚖️ Silhouette / Perte de poids" },
  { id: "recettes", label: "🍽️ Recettes minceur" },
  { id: "energie", label: "⚡ Énergie, sommeil, stress" },
  { id: "parfums", label: "🌸 Parfums" },
  { id: "makeup", label: "💄 Make-up" },
  { id: "bienetre", label: "🧘 Bien-être général" },
  { id: "recrutement", label: "🤝 Opportunité / Recrutement" },
];

export function EbooksTab() {
  const [ebooks, setEbooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copie, setCopie] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "admin", "ebooks"));
        if (snap.exists()) setEbooks((snap.data().items || []).filter(e => e.actif !== false));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const copierLien = (lien, id) => {
    navigator.clipboard?.writeText(lien);
    setCopie(id);
    setTimeout(() => setCopie(null), 2000);
  };

  const parTheme = THEMES_EBOOKS.map(t => ({
    ...t,
    items: ebooks.filter(e => (e.themes || []).includes(t.id))
  })).filter(t => t.items.length > 0);

  const sansTheme = ebooks.filter(e => !(e.themes || []).length);

  return (
    <div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: "1.35rem", fontWeight: 300, color: C.brun, marginBottom: ".2rem" }}>
        Bibliothèque <em style={{ fontStyle: "italic", color: C.rose }}>Ebooks</em>
      </div>
      <p style={{ fontSize: ".74rem", color: C.gris, marginBottom: "1rem", lineHeight: 1.65 }}>
        Tous les ebooks disponibles, au même endroit. Copie le lien pour l'envoyer directement à une cliente.
      </p>

      {loading && <div style={{ textAlign: "center", padding: "2rem", color: C.gris, fontSize: ".8rem" }}>Chargement...</div>}

      {!loading && ebooks.length === 0 && (
        <div style={{ textAlign: "center", padding: "2rem 1rem", color: C.gris, fontSize: ".8rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: ".5rem" }}>📚</div>
          Aucun ebook disponible pour le moment.
        </div>
      )}

      {!loading && parTheme.map(t => (
        <div key={t.id} style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontSize: ".65rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.brun, marginBottom: ".5rem", padding: ".25rem .7rem", background: C.pale, borderRadius: 20, display: "inline-block" }}>{t.label}</div>
          {t.items.map(eb => (
            <div key={eb.id} style={{ display: "flex", gap: ".75rem", background: C.blanc, border: `1px solid ${C.pale}`, borderRadius: 14, padding: ".85rem", marginBottom: ".6rem", alignItems: "flex-start" }}>
              {eb.imageCover
                ? <img src={eb.imageCover} alt={eb.titre} style={{ width: 52, height: 72, objectFit: "cover", borderRadius: 8, flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,.15)" }} />
                : <div style={{ width: 52, height: 72, borderRadius: 8, background: C.creme, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>📖</div>
              }
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: ".85rem", fontWeight: 700, color: C.brun, marginBottom: ".2rem" }}>{eb.titre}</div>
                {eb.description && <div style={{ fontSize: ".72rem", color: C.gris, lineHeight: 1.5, marginBottom: ".5rem" }}>{eb.description}</div>}
                <div style={{ display: "flex", gap: ".4rem" }}>
                  <a href={eb.lienPDF} target="_blank" rel="noopener noreferrer"
                    style={{ background: C.brun, color: "white", border: "none", borderRadius: 8, padding: ".35rem .7rem", fontSize: ".68rem", fontWeight: 600, fontFamily: "inherit", cursor: "pointer", textDecoration: "none" }}>
                    📖 Voir
                  </a>
                  <button onClick={() => copierLien(eb.lienPDF, eb.id)}
                    style={{ background: copie === eb.id ? C.vert : C.creme, color: copie === eb.id ? "white" : C.gris, border: `1px solid ${copie === eb.id ? C.vert : C.pale}`, borderRadius: 8, padding: ".35rem .7rem", fontSize: ".68rem", fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                    {copie === eb.id ? "✓ Copié !" : "🔗 Copier le lien"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      {!loading && sansTheme.length > 0 && (
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontSize: ".65rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.brun, marginBottom: ".5rem", padding: ".25rem .7rem", background: C.pale, borderRadius: 20, display: "inline-block" }}>📚 Autres</div>
          {sansTheme.map(eb => (
            <div key={eb.id} style={{ display: "flex", gap: ".75rem", background: C.blanc, border: `1px solid ${C.pale}`, borderRadius: 14, padding: ".85rem", marginBottom: ".6rem", alignItems: "flex-start" }}>
              {eb.imageCover
                ? <img src={eb.imageCover} alt={eb.titre} style={{ width: 52, height: 72, objectFit: "cover", borderRadius: 8, flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,.15)" }} />
                : <div style={{ width: 52, height: 72, borderRadius: 8, background: C.creme, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>📖</div>
              }
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: ".85rem", fontWeight: 700, color: C.brun, marginBottom: ".2rem" }}>{eb.titre}</div>
                {eb.description && <div style={{ fontSize: ".72rem", color: C.gris, lineHeight: 1.5, marginBottom: ".5rem" }}>{eb.description}</div>}
                <div style={{ display: "flex", gap: ".4rem" }}>
                  <a href={eb.lienPDF} target="_blank" rel="noopener noreferrer"
                    style={{ background: C.brun, color: "white", border: "none", borderRadius: 8, padding: ".35rem .7rem", fontSize: ".68rem", fontWeight: 600, fontFamily: "inherit", cursor: "pointer", textDecoration: "none" }}>
                    📖 Voir
                  </a>
                  <button onClick={() => copierLien(eb.lienPDF, eb.id)}
                    style={{ background: copie === eb.id ? C.vert : C.creme, color: copie === eb.id ? "white" : C.gris, border: `1px solid ${copie === eb.id ? C.vert : C.pale}`, borderRadius: 8, padding: ".35rem .7rem", fontSize: ".68rem", fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                    {copie === eb.id ? "✓ Copié !" : "🔗 Copier le lien"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}