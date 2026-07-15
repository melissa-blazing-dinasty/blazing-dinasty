// ── TOKENS CADEAUX — Blazing Dynasty ─────────────────────────────────────────
// Fichier : TokensCadeauxTab.jsx
// Intégration : importer dans App.js + ajouter dans LinkBioPublicPage
//
// USAGE DISTRIBUTRICE : <TokensCadeauxTab uid={userId} db={db} />
// USAGE PUBLIC (popup boutique) : <TokensCadeauxPopup uid={distribUid} db={db} />
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

// ── CONSTANTES ────────────────────────────────────────────────────────────────
export const TYPES_TOKENS = [
  {
    id: 'cadeau_surprise',
    label: '🎁 Cadeau surprise',
    description: 'Pour 40€ d\'achat',
    couleur: '#C4A962',
    bg: '#FDF8EC',
    emoji: '🎁',
  },
  {
    id: 'remise_5',
    label: '💸 -5€ sur la commande',
    description: 'Dès 40€ d\'achat',
    couleur: '#7B68C8',
    bg: '#F3F0FF',
    emoji: '💸',
  },
  {
    id: 'remise_70',
    label: '🔥 -70% sur un produit',
    description: 'Au choix dans le catalogue',
    couleur: '#C44B1A',
    bg: '#FFF2EC',
    emoji: '🔥',
  },
];

const C = {
  brun: '#5A3829',
  or: '#C4A962',
  creme: '#FAF7F2',
  pale: '#EDE8E0',
  texte: '#2D1F1F',
  gris: '#9A8C8C',
  blanc: '#FFFFFF',
  rouge: '#C0504D',
  vert: '#2D7A4F',
};

// ── HELPER : lecture/écriture tokens dans Firestore ──────────────────────────
async function getTokens(db, uid) {
  try {
    const snap = await getDoc(doc(db, 'tokens_cadeaux', uid));
    return snap.exists() ? (snap.data().tokens || []) : [];
  } catch { return []; }
}

async function saveTokens(db, uid, tokens) {
  await setDoc(doc(db, 'tokens_cadeaux', uid), { tokens, updatedAt: Date.now() }, { merge: true });
}

// ── ENVOI NOTIFICATION PUSH via FCM (Cloud Function) ─────────────────────────
async function notifierTokensEpuises(db, uid, prenom) {
  try {
    const snap = await getDoc(doc(db, 'fcm_tokens', uid));
    if (!snap.exists()) return;
    // Stocke une notification interne dans Firestore (lue par l'app)
    await setDoc(doc(db, 'notifications_internes', uid), {
      type: 'tokens_epuises',
      titre: '🎁 Tous tes tokens ont été utilisés !',
      message: 'Pense à en ajouter de nouveaux pour continuer à attirer des clientes.',
      ts: Date.now(),
      lu: false,
    }, { merge: true });
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// ── COMPOSANT DISTRIBUTRICE : gérer ses tokens ───────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export function TokensCadeauxTab({ uid, db, prenom }) {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formType, setFormType] = useState(TYPES_TOKENS[0].id);
  const [formLien, setFormLien] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [ajoutVisible, setAjoutVisible] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const t = await getTokens(db, uid);
      setTokens(t);
      setLoading(false);
    })();
  }, [uid]);

  const showNotif = (msg, ok = true) => {
    setNotification({ msg, ok });
    setTimeout(() => setNotification(null), 3000);
  };

  const ajouterToken = async () => {
    if (!formLien.trim()) return showNotif('Colle le lien Mihi du token 🙏', false);
    if (!formLien.startsWith('http')) return showNotif('Le lien doit commencer par https://', false);
    setSaving(true);
    const typeInfo = TYPES_TOKENS.find(t => t.id === formType);
    const newToken = {
      id: `tok_${Date.now()}`,
      type: formType,
      label: typeInfo.label,
      description: typeInfo.description,
      emoji: typeInfo.emoji,
      lien: formLien.trim(),
      labelPerso: formLabel.trim() || '',
      utilise: false,
      dateAjout: Date.now(),
      dateUtilisation: null,
    };
    const updated = [...tokens, newToken];
    await saveTokens(db, uid, updated);
    setTokens(updated);
    setFormLien('');
    setFormLabel('');
    setAjoutVisible(false);
    setSaving(false);
    showNotif('Token ajouté avec succès ! 🎉');
  };

  const supprimerToken = async (id) => {
    const updated = tokens.filter(t => t.id !== id);
    await saveTokens(db, uid, updated);
    setTokens(updated);
    showNotif('Token supprimé.');
  };

  const tokensActifs = tokens.filter(t => !t.utilise);
  const tokensUtilises = tokens.filter(t => t.utilise);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '2rem', color: C.gris, fontSize: '.85rem' }}>
      Chargement des tokens...
    </div>
  );

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 480, margin: '0 auto', padding: '0 0 2rem' }}>

      {/* Notification toast */}
      {notification && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: notification.ok ? C.vert : C.rouge, color: 'white',
          borderRadius: 12, padding: '.7rem 1.2rem', fontSize: '.8rem', fontWeight: 600,
          zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', whiteSpace: 'nowrap',
        }}>
          {notification.msg}
        </div>
      )}

      {/* En-tête */}
      <div style={{ background: `linear-gradient(135deg, ${C.brun}, #3D2020)`, borderRadius: 16, padding: '1.2rem', marginBottom: '1rem', color: 'white' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.2rem', fontWeight: 600, marginBottom: '.3rem' }}>
          🎁 Mes tokens cadeaux
        </div>
        <div style={{ fontSize: '.78rem', opacity: .8, lineHeight: 1.5 }}>
          Offre des réductions exclusives à tes clientes. Chaque lien ne peut être utilisé qu'une seule fois.
        </div>
        <div style={{ display: 'flex', gap: '.8rem', marginTop: '.8rem' }}>
          <div style={{ background: 'rgba(255,255,255,.15)', borderRadius: 10, padding: '.5rem .8rem', textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{tokensActifs.length}</div>
            <div style={{ fontSize: '.68rem', opacity: .8 }}>Disponibles</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 10, padding: '.5rem .8rem', textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{tokensUtilises.length}</div>
            <div style={{ fontSize: '.68rem', opacity: .8 }}>Utilisés</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 10, padding: '.5rem .8rem', textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{tokens.length}</div>
            <div style={{ fontSize: '.68rem', opacity: .8 }}>Total</div>
          </div>
        </div>
      </div>

      {/* Alerte tokens épuisés */}
      {tokens.length > 0 && tokensActifs.length === 0 && (
        <div style={{ background: '#FFF3CD', border: '1px solid #F0C040', borderRadius: 12, padding: '.9rem', marginBottom: '1rem', display: 'flex', gap: '.7rem', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.3rem' }}>⚠️</span>
          <div>
            <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#7A5800', marginBottom: '.2rem' }}>Tous tes tokens ont été utilisés !</div>
            <div style={{ fontSize: '.74rem', color: '#7A5800', lineHeight: 1.5 }}>Ajoute de nouveaux liens pour continuer à attirer des clientes.</div>
          </div>
        </div>
      )}

      {/* Bouton ajouter */}
      <button
        onClick={() => setAjoutVisible(!ajoutVisible)}
        style={{
          width: '100%', background: ajoutVisible ? C.pale : C.brun, color: ajoutVisible ? C.brun : 'white',
          border: `2px solid ${C.brun}`, borderRadius: 12, padding: '.8rem',
          fontSize: '.85rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
          marginBottom: '1rem', transition: 'all .2s',
        }}>
        {ajoutVisible ? '✕ Annuler' : '+ Ajouter un token cadeau'}
      </button>

      {/* Formulaire ajout */}
      {ajoutVisible && (
        <div style={{ background: 'white', border: `1.5px solid ${C.or}`, borderRadius: 14, padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '.8rem', fontWeight: 700, color: C.brun, marginBottom: '.8rem' }}>Nouveau token 🎁</div>

          {/* Choix du type */}
          <div style={{ fontSize: '.72rem', color: C.gris, marginBottom: '.4rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Type de cadeau</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', marginBottom: '.9rem' }}>
            {TYPES_TOKENS.map(t => (
              <button key={t.id} onClick={() => setFormType(t.id)}
                style={{
                  background: formType === t.id ? t.bg : '#F8F5F0',
                  border: `2px solid ${formType === t.id ? t.couleur : C.pale}`,
                  borderRadius: 10, padding: '.7rem .9rem',
                  display: 'flex', alignItems: 'center', gap: '.7rem',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all .15s',
                }}>
                <span style={{ fontSize: '1.3rem' }}>{t.emoji}</span>
                <div>
                  <div style={{ fontSize: '.8rem', fontWeight: 700, color: formType === t.id ? t.couleur : C.texte }}>{t.label}</div>
                  <div style={{ fontSize: '.7rem', color: C.gris }}>{t.description}</div>
                </div>
                {formType === t.id && <span style={{ marginLeft: 'auto', color: t.couleur, fontWeight: 700, fontSize: '1rem' }}>✓</span>}
              </button>
            ))}
          </div>

          {/* Lien */}
          <div style={{ fontSize: '.72rem', color: C.gris, marginBottom: '.4rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Lien Mihi (URL du token)</div>
          <input
            type="url"
            placeholder="https://mihi.care/..."
            value={formLien}
            onChange={e => setFormLien(e.target.value)}
            style={{
              width: '100%', border: `1.5px solid ${C.pale}`, borderRadius: 10,
              padding: '.65rem .8rem', fontSize: '.82rem', fontFamily: 'inherit',
              color: C.texte, background: C.creme, outline: 'none', marginBottom: '.8rem',
              boxSizing: 'border-box',
            }}
          />

          {/* Label perso optionnel */}
          <div style={{ fontSize: '.72rem', color: C.gris, marginBottom: '.4rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Label personnalisé (optionnel)</div>
          <input
            type="text"
            placeholder="ex: Kit découverte -50%"
            value={formLabel}
            onChange={e => setFormLabel(e.target.value)}
            style={{
              width: '100%', border: `1.5px solid ${C.pale}`, borderRadius: 10,
              padding: '.65rem .8rem', fontSize: '.82rem', fontFamily: 'inherit',
              color: C.texte, background: C.creme, outline: 'none', marginBottom: '1rem',
              boxSizing: 'border-box',
            }}
          />

          <button onClick={ajouterToken} disabled={saving}
            style={{
              width: '100%', background: C.or, color: 'white', border: 'none',
              borderRadius: 10, padding: '.75rem', fontSize: '.85rem', fontWeight: 700,
              fontFamily: 'inherit', cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? .7 : 1,
            }}>
            {saving ? 'Enregistrement...' : '✓ Ajouter ce token'}
          </button>
        </div>
      )}

      {/* Liste tokens actifs */}
      {tokensActifs.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '.72rem', fontWeight: 700, color: C.gris, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: '.6rem' }}>
            Tokens disponibles ({tokensActifs.length})
          </div>
          {tokensActifs.map(t => {
            const typeInfo = TYPES_TOKENS.find(ti => ti.id === t.type) || TYPES_TOKENS[0];
            return (
              <div key={t.id} style={{
                background: 'white', border: `1.5px solid ${C.pale}`,
                borderLeft: `4px solid ${typeInfo.couleur}`,
                borderRadius: 12, padding: '.85rem', marginBottom: '.6rem',
                display: 'flex', gap: '.8rem', alignItems: 'center',
              }}>
                <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{typeInfo.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '.8rem', fontWeight: 700, color: typeInfo.couleur, marginBottom: '.15rem' }}>
                    {t.labelPerso || t.label}
                  </div>
                  <div style={{ fontSize: '.7rem', color: C.gris }}>{typeInfo.description}</div>
                  <div style={{ fontSize: '.65rem', color: C.gris, marginTop: '.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    🔗 {t.lien}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', flexShrink: 0 }}>
                  <span style={{ background: '#E8F5E9', color: C.vert, fontSize: '.65rem', fontWeight: 700, borderRadius: 6, padding: '.2rem .5rem' }}>
                    ✓ Actif
                  </span>
                  <button onClick={() => supprimerToken(t.id)}
                    style={{ background: 'none', border: 'none', color: C.rouge, fontSize: '.68rem', cursor: 'pointer', fontFamily: 'inherit', padding: 0, textAlign: 'center' }}>
                    🗑️ Suppr.
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Historique tokens utilisés */}
      {tokensUtilises.length > 0 && (
        <div>
          <div style={{ fontSize: '.72rem', fontWeight: 700, color: C.gris, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: '.6rem' }}>
            Historique utilisés ({tokensUtilises.length})
          </div>
          {tokensUtilises.map(t => {
            const typeInfo = TYPES_TOKENS.find(ti => ti.id === t.type) || TYPES_TOKENS[0];
            return (
              <div key={t.id} style={{
                background: '#F8F5F2', border: `1px solid ${C.pale}`,
                borderRadius: 12, padding: '.75rem', marginBottom: '.5rem',
                display: 'flex', gap: '.7rem', alignItems: 'center', opacity: .7,
              }}>
                <span style={{ fontSize: '1.2rem', flexShrink: 0, filter: 'grayscale(1)' }}>{typeInfo.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '.78rem', fontWeight: 600, color: C.gris, marginBottom: '.1rem' }}>
                    {t.labelPerso || t.label}
                  </div>
                  {t.dateUtilisation && (
                    <div style={{ fontSize: '.65rem', color: C.gris }}>
                      Utilisé le {new Date(t.dateUtilisation).toLocaleDateString('fr-FR')}
                    </div>
                  )}
                </div>
                <span style={{ background: '#EEE', color: C.gris, fontSize: '.65rem', fontWeight: 700, borderRadius: 6, padding: '.2rem .5rem', flexShrink: 0 }}>
                  Utilisé
                </span>
              </div>
            );
          })}
        </div>
      )}

      {tokens.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: C.gris }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '.8rem' }}>🎁</div>
          <div style={{ fontSize: '.85rem', fontWeight: 600, color: C.brun, marginBottom: '.4rem' }}>
            Aucun token pour l'instant
          </div>
          <div style={{ fontSize: '.78rem', lineHeight: 1.6 }}>
            Ajoute tes premiers liens Mihi pour commencer à offrir des cadeaux à tes clientes !
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── COMPOSANT PUBLIC : Popup boutique ────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export function TokensCadeauxPopup({ uid, db }) {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ouvert, setOuvert] = useState(false);
  const [choixFait, setChoixFait] = useState(null);
  const [countdown, setCountdown] = useState({ h: 0, m: 0, s: 0 });
  const [tokenChoisi, setTokenChoisi] = useState(null);
  const [confirmation, setConfirmation] = useState(false);
  const timerRef = useRef(null);

  // Compte à rebours visuel (repart aléatoirement entre 18h et 47h)
  useEffect(() => {
    const storedEnd = sessionStorage.getItem(`bd_token_timer_${uid}`);
    let endTime;
    if (storedEnd) {
      endTime = parseInt(storedEnd);
    } else {
      const hours = 18 + Math.floor(Math.random() * 30); // 18h à 47h
      endTime = Date.now() + hours * 3600 * 1000;
      sessionStorage.setItem(`bd_token_timer_${uid}`, endTime.toString());
    }

    const tick = () => {
      const diff = Math.max(0, endTime - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown({ h, m, s });
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [uid]);

  // Chargement tokens actifs
  useEffect(() => {
    (async () => {
      const t = await getTokens(db, uid);
      const actifs = t.filter(tok => !tok.utilise);
      setTokens(actifs);
      setLoading(false);
      // Afficher la popup après 2s si tokens disponibles
      if (actifs.length > 0) {
        setTimeout(() => setOuvert(true), 2000);
      }
    })();
  }, [uid]);

  const choisirToken = (token) => {
    setTokenChoisi(token);
  };

  const confirmerEtRediriger = async () => {
    if (!tokenChoisi) return;
    setConfirmation(true);

    // Marquer le token comme utilisé dans Firestore
    try {
      const snap = await getDoc(doc(db, 'tokens_cadeaux', uid));
      if (snap.exists()) {
        const allTokens = snap.data().tokens || [];
        const updated = allTokens.map(t =>
          t.id === tokenChoisi.id
            ? { ...t, utilise: true, dateUtilisation: Date.now() }
            : t
        );
        await saveTokens(db, uid, updated);

        // Vérifier s'il reste des tokens actifs → notifier si épuisés
        const restants = updated.filter(t => !t.utilise);
        if (restants.length === 0) {
          await notifierTokensEpuises(db, uid);
        }
      }
    } catch {}

    // Mettre à jour l'affichage local
    setTokens(prev => prev.filter(t => t.id !== tokenChoisi.id));

    // Rediriger vers le lien Mihi après 1.5s
    setTimeout(() => {
      window.location.href = tokenChoisi.lien;
    }, 1500);
  };

  if (loading || tokens.length === 0) return null;

  const pad = n => String(n).padStart(2, '0');

  return (
    <>
      {/* Bouton flottant si popup fermée */}
      {!ouvert && (
        <button
          onClick={() => setOuvert(true)}
          style={{
            position: 'fixed', bottom: 20, right: 16, zIndex: 9990,
            background: 'linear-gradient(135deg, #C4A962, #9E6B6B)',
            color: 'white', border: 'none', borderRadius: '50px',
            padding: '.7rem 1.2rem', fontSize: '.82rem', fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            display: 'flex', alignItems: 'center', gap: '.5rem',
            animation: 'pulse 2s infinite',
          }}>
          🎁 {tokens.length} offre{tokens.length > 1 ? 's' : ''} disponible{tokens.length > 1 ? 's' : ''}
        </button>
      )}

      {/* Overlay popup */}
      {ouvert && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(30,15,15,.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}
          onClick={e => { if (e.target === e.currentTarget) setOuvert(false); }}>

          <div style={{
            background: 'linear-gradient(180deg, #FAF7F2 0%, #FFF8F0 100%)',
            borderRadius: '22px 22px 0 0',
            width: '100%', maxWidth: 480,
            maxHeight: '90vh', overflowY: 'auto',
            padding: '0 0 2rem',
            animation: 'slideUp .35s cubic-bezier(0.34,1.56,0.64,1)',
          }}>

            {/* Barre poignée */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px' }}>
              <div style={{ width: 36, height: 4, background: '#DDD', borderRadius: 2 }} />
            </div>

            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #5A3829, #3D2020)',
              margin: '0 16px', borderRadius: 16, padding: '1.2rem',
              marginBottom: '1.2rem', color: 'white', textAlign: 'center',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '.4rem' }}>🎁</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.3rem', fontWeight: 600, marginBottom: '.3rem' }}>
                Choisis ton cadeau
              </div>
              <div style={{ fontSize: '.78rem', opacity: .85, lineHeight: 1.5, marginBottom: '.8rem' }}>
                Des offres exclusives réservées aux nouvelles clientes
              </div>

              {/* Compte à rebours */}
              <div style={{ background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '.6rem .8rem', display: 'inline-flex', alignItems: 'center', gap: '.5rem' }}>
                <span style={{ fontSize: '.72rem', opacity: .8 }}>⏳ Expire dans</span>
                <span style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 700, color: '#FFDC80' }}>
                  {pad(countdown.h)}:{pad(countdown.m)}:{pad(countdown.s)}
                </span>
              </div>

              {/* Compteur restant */}
              <div style={{ marginTop: '.6rem', fontSize: '.75rem', opacity: .8 }}>
                🔥 Plus que <strong style={{ color: '#FFDC80' }}>{tokens.length}</strong> offre{tokens.length > 1 ? 's' : ''} disponible{tokens.length > 1 ? 's' : ''}
              </div>
            </div>

            {/* Cards cadeaux */}
            {!confirmation && (
              <div style={{ padding: '0 16px' }}>
                {!tokenChoisi ? (
                  <>
                    <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#9A8C8C', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: '.8rem', textAlign: 'center' }}>
                      Sélectionne ton offre
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '.7rem', marginBottom: '1rem' }}>
                      {TYPES_TOKENS.filter(type =>
                        tokens.some(t => t.type === type.id)
                      ).map(type => {
                        const tokensDeType = tokens.filter(t => t.type === type.id);
                        const tok = tokensDeType[0];
                        return (
                          <button key={type.id}
                            onClick={() => choisirToken(tok)}
                            style={{
                              background: 'white', border: `2px solid ${type.couleur}`,
                              borderRadius: 16, padding: '1rem 1.2rem',
                              display: 'flex', gap: '1rem', alignItems: 'center',
                              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                              boxShadow: `0 4px 16px ${type.couleur}22`,
                              transition: 'all .2s',
                            }}>
                            <span style={{ fontSize: '2rem', flexShrink: 0 }}>{type.emoji}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '.88rem', fontWeight: 700, color: type.couleur, marginBottom: '.2rem' }}>
                                {tok.labelPerso || type.label}
                              </div>
                              <div style={{ fontSize: '.76rem', color: '#9A8C8C', lineHeight: 1.4 }}>
                                {type.description}
                              </div>
                              <div style={{ fontSize: '.7rem', color: type.couleur, fontWeight: 600, marginTop: '.3rem' }}>
                                {tokensDeType.length} disponible{tokensDeType.length > 1 ? 's' : ''}
                              </div>
                            </div>
                            <div style={{
                              background: type.bg, color: type.couleur,
                              borderRadius: 10, padding: '.5rem .7rem',
                              fontSize: '.72rem', fontWeight: 700, textAlign: 'center', flexShrink: 0,
                            }}>
                              Choisir<br />→
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div style={{ fontSize: '.72rem', color: '#9A8C8C', textAlign: 'center', lineHeight: 1.5 }}>
                      ⚠️ Chaque lien est à usage unique. Tu seras redirigée vers la boutique Mihi pour t'inscrire et bénéficier de ton offre.
                    </div>
                  </>
                ) : (
                  /* Confirmation avant redirection */
                  <div style={{ textAlign: 'center', padding: '.5rem 0' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '.6rem' }}>
                      {TYPES_TOKENS.find(t => t.id === tokenChoisi.type)?.emoji || '🎁'}
                    </div>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.1rem', fontWeight: 600, color: '#5A3829', marginBottom: '.4rem' }}>
                      {tokenChoisi.labelPerso || tokenChoisi.label}
                    </div>
                    <div style={{ fontSize: '.8rem', color: '#9A8C8C', marginBottom: '1.2rem', lineHeight: 1.5 }}>
                      Tu vas être redirigée vers la boutique Mihi pour t'inscrire et activer ton offre.
                    </div>
                    <div style={{ background: '#FFF8E0', border: '1px solid #F0C040', borderRadius: 12, padding: '.8rem', marginBottom: '1.2rem', fontSize: '.76rem', color: '#7A5800', lineHeight: 1.5 }}>
                      ⚠️ Ce lien est <strong>à usage unique</strong>. Une fois utilisé, il ne pourra plus être activé.
                    </div>
                    <button onClick={confirmerEtRediriger}
                      style={{
                        width: '100%', background: 'linear-gradient(135deg, #C4A962, #9E6B6B)',
                        color: 'white', border: 'none', borderRadius: 14, padding: '1rem',
                        fontSize: '.9rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                        marginBottom: '.7rem',
                      }}>
                      ✓ Activer mon offre →
                    </button>
                    <button onClick={() => setTokenChoisi(null)}
                      style={{
                        background: 'none', border: 'none', color: '#9A8C8C',
                        fontSize: '.78rem', fontFamily: 'inherit', cursor: 'pointer',
                      }}>
                      ← Revenir au choix
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Confirmation de redirection */}
            {confirmation && (
              <div style={{ textAlign: 'center', padding: '1rem 1.5rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '.8rem' }}>🎉</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.1rem', fontWeight: 600, color: '#5A3829', marginBottom: '.5rem' }}>
                  Offre activée !
                </div>
                <div style={{ fontSize: '.82rem', color: '#9A8C8C', lineHeight: 1.6 }}>
                  Tu vas être redirigée vers la boutique Mihi dans quelques secondes...
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
      `}</style>
    </>
  );
}
