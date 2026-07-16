// TunnelRecrutementTab.jsx — Blazing Dynasty
// Gestion du tunnel de recrutement + page publique prospect
// Placer dans src/

import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';

// ── COULEURS ─────────────────────────────────────────────────────────────────
const CR = {
  brun:'#5A3829', or:'#C4A962', creme:'#FAF7F2', pale:'#EDE8E0',
  texte:'#2D1F1F', gris:'#9A8C8C', blanc:'#FFFFFF', rose:'#C9A0A0',
  vert:'#2D7A4F', rouge:'#C0504D', lilas:'#C3AECF',
};

// ── STATUTS MIHI ─────────────────────────────────────────────────────────────
const STATUTS = [
  {nom:'Consultant',    ca:'100€ → 249€',    comm:'20% + 2% équipe'},
  {nom:'Conseiller',    ca:'250€ → 499€',    comm:'30% + 4% équipe'},
  {nom:'Conseiller Principal', ca:'500€ → 999€', comm:'30% + 6% équipe'},
  {nom:'Responsable',   ca:'1 000€ → 1 499€', comm:'30% + 8% équipe'},
  {nom:'Cadre Supérieur', ca:'1 500€ → 1 999€', comm:'30% + 10% équipe'},
  {nom:'Partenaire',    ca:'2 000€ → 2 999€', comm:'30% + 12% équipe'},
  {nom:'Directeur Adjoint', ca:'3 000€ → 4 999€', comm:'30% + 14% équipe'},
  {nom:'Directeur',     ca:'5 000€ et +',    comm:'30% + 17% équipe'},
];

// ── AVANTAGES ────────────────────────────────────────────────────────────────
const AVANTAGES = [
  {icon:'🛍️', titre:'Boutique en ligne gratuite', desc:'Personnalisée, avec diagnostics IA, carte de fidélité, paniers partagés...'},
  {icon:'📚', titre:'Académie Blazing Dynasty', desc:'Formations, outils, quiz, badges, suivi de ton activité — tout dans une app'},
  {icon:'💰', titre:'20% à 30% de commission', desc:'Sur tes propres ventes + jusqu\'à 17% sur les ventes de ton équipe'},
  {icon:'🎯', titre:'Accompagnement personnalisé', desc:'Tu n\'es jamais seule — je t\'accompagne à chaque étape de ton développement'},
  {icon:'⏰', titre:'100% flexible', desc:'Tu travailles quand tu veux, où tu veux, à ton rythme'},
  {icon:'🌿', titre:'Produits cosmétiques premium', desc:'Gamme complète visage, corps, cheveux, maquillage — fabriqués en Europe'},
];

// ── TÉMOIGNAGES REVENUS ───────────────────────────────────────────────────────
const TEMOIGNAGES_REVENUS_DEFAULT = [
  {prenom:'Marie', metier:'Coiffeuse', heures:'6h/semaine', clientes:'12 clientes régulières', montant:'420'},
  {prenom:'Julie', metier:'Maman au foyer', heures:'4h/semaine', clientes:'8 clientes', montant:'320'},
  {prenom:'Sarah', metier:'Salariée', heures:'8h/semaine', clientes:'20 clientes', montant:'790'},
];

// ── TÉMOIGNAGES QUALITATIFS ───────────────────────────────────────────────────
const TEMOIGNAGES_QUALI_DEFAULT = [
  {texte:"Je n'aurais jamais pensé pouvoir avoir ma propre boutique en ligne. Aujourd'hui mes clientes commandent directement et je reçois une notification à chaque vente !", auteur:'Sarah, 3 mois dans l\'équipe'},
  {texte:"L'académie m'a tout appris. Les formations, les outils, l'accompagnement — je me sens vraiment professionnelle dans ma façon de travailler.", auteur:'Léa, 6 mois dans l\'équipe'},
  {texte:"Ce qui m'a convaincue c'est la boutique gratuite. Chez Mihi elle est payante, ici elle est offerte et en plus elle est magnifique !", auteur:'Marine, 1 an dans l\'équipe'},
];

// ─────────────────────────────────────────────────────────────────────────────
// ── ONGLET GESTION (côté distributrice) ──────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export function TunnelRecrutementTab({ uid, userName, db }) {
  const [cfg, setCfg] = useState({
    titreAccroche: 'Rejoins l\'équipe de Melissa !',
    sousTitreAccroche: 'Crée ta propre boutique en ligne gratuite\net développe ton business beauté depuis chez toi',
    afficherBoutique: true,
    lienBoutique: '',
    lienInscription: '',
    temoignagesRevenus: TEMOIGNAGES_REVENUS_DEFAULT,
    temoignagesQuali: TEMOIGNAGES_QUALI_DEFAULT,
    emailNotifFormulaire: '',
    actif: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [preview, setPreview] = useState(false);
  const [notif, setNotif] = useState(null);

  const slug = (userName || uid).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-');
  const lienPublic = `${window.location.origin}?recrutement=${slug}`;

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'tunnel_recrutement', uid));
        if (snap.exists()) setCfg(c => ({ ...c, ...snap.data() }));
        const snapUser = await getDoc(doc(db, 'users', uid));
        if (snapUser.exists()) {
          const d = snapUser.data();
          setCfg(c => ({
            ...c,
            lienInscription: c.lienInscription || d['db-lien-inscription-mihi'] || '',
            emailNotifFormulaire: c.emailNotifFormulaire || d['db-email-notif-commandes'] || '',
          }));
        }
        const snapTok = await getDoc(doc(db, 'tokens_cadeaux', uid));
        if (snapTok.exists()) setTokens((snapTok.data().tokens || []).filter(t => !t.utilise));
      } catch {}
      setLoading(false);
    })();
  }, [uid]);

  const sauver = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'tunnel_recrutement', uid), cfg, { merge: true });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  };

  const showNotif = msg => { setNotif(msg); setTimeout(() => setNotif(null), 3000); };

  const copyLink = () => { navigator.clipboard.writeText(lienPublic); showNotif('Lien copié !'); };

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: CR.gris }}>Chargement...</div>;

  if (preview) return (
    <div>
      <button onClick={() => setPreview(false)} style={{ margin: '1rem', background: CR.brun, color: 'white', border: 'none', borderRadius: 10, padding: '.6rem 1.2rem', fontFamily: 'inherit', cursor: 'pointer', fontSize: '.8rem' }}>← Retour aux réglages</button>
      <TunnelRecrutementPublic slug={slug} db={db} preview={true} previewCfg={cfg} previewTokens={tokens} />
    </div>
  );

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 480, margin: '0 auto', padding: '0 0 3rem' }}>
      {notif && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: CR.vert, color: 'white', borderRadius: 12, padding: '.7rem 1.2rem', fontSize: '.8rem', fontWeight: 600, zIndex: 9999 }}>{notif}</div>}

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${CR.brun}, #3D2020)`, borderRadius: 16, padding: '1.2rem', marginBottom: '1rem', color: 'white' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.2rem', fontWeight: 600, marginBottom: '.3rem' }}>🎯 Tunnel de Recrutement</div>
        <div style={{ fontSize: '.78rem', opacity: .8, lineHeight: 1.5, marginBottom: '.8rem' }}>Configure ta page de recrutement publique.</div>
        <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 10, padding: '.6rem .8rem', fontSize: '.68rem', wordBreak: 'break-all', marginBottom: '.6rem' }}>{lienPublic}</div>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button onClick={copyLink} style={{ flex: 1, background: CR.or, color: 'white', border: 'none', borderRadius: 8, padding: '.5rem', fontSize: '.75rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>📋 Copier le lien</button>
          <button onClick={() => setPreview(true)} style={{ flex: 1, background: 'rgba(255,255,255,.15)', color: 'white', border: '1px solid rgba(255,255,255,.3)', borderRadius: 8, padding: '.5rem', fontSize: '.75rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>👁️ Prévisualiser</button>
        </div>
      </div>

      {/* Activer/désactiver */}
      <div style={{ background: 'white', border: `1.5px solid ${CR.pale}`, borderRadius: 12, padding: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '.8rem', fontWeight: 700, color: CR.brun }}>Tunnel actif</div>
          <div style={{ fontSize: '.7rem', color: CR.gris }}>Page visible par les prospects</div>
        </div>
        <div onClick={() => setCfg(c => ({ ...c, actif: !c.actif }))} style={{ width: 44, height: 24, borderRadius: 20, background: cfg.actif ? CR.vert : '#DDD', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: cfg.actif ? 22 : 2, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
        </div>
      </div>

      {/* Accroche */}
      <div style={{ background: 'white', border: `1px solid ${CR.pale}`, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '.72rem', fontWeight: 700, color: CR.or, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: '.7rem' }}>Accroche principale</div>
        <div style={{ fontSize: '.7rem', color: CR.gris, marginBottom: '.3rem' }}>Titre</div>
        <input value={cfg.titreAccroche} onChange={e => setCfg(c => ({ ...c, titreAccroche: e.target.value }))}
          style={{ width: '100%', border: `1px solid ${CR.pale}`, borderRadius: 8, padding: '.5rem .7rem', fontSize: '.82rem', fontFamily: 'inherit', marginBottom: '.7rem', outline: 'none', boxSizing: 'border-box' }} />
        <div style={{ fontSize: '.7rem', color: CR.gris, marginBottom: '.3rem' }}>Sous-titre</div>
        <textarea value={cfg.sousTitreAccroche} onChange={e => setCfg(c => ({ ...c, sousTitreAccroche: e.target.value }))} rows={2}
          style={{ width: '100%', border: `1px solid ${CR.pale}`, borderRadius: 8, padding: '.5rem .7rem', fontSize: '.82rem', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
      </div>

      {/* Boutique */}
      <div style={{ background: 'white', border: `1px solid ${CR.pale}`, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '.72rem', fontWeight: 700, color: CR.or, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: '.7rem' }}>Bouton boutique</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '.7rem', cursor: 'pointer', marginBottom: '.7rem' }}>
          <div onClick={() => setCfg(c => ({ ...c, afficherBoutique: !c.afficherBoutique }))} style={{ width: 36, height: 20, borderRadius: 20, background: cfg.afficherBoutique ? CR.or : '#DDD', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: cfg.afficherBoutique ? 18 : 2, transition: 'left .2s' }} />
          </div>
          <span style={{ fontSize: '.78rem', color: CR.texte }}>Afficher le bouton "Voir ma boutique"</span>
        </label>
        {cfg.afficherBoutique && (
          <>
            <div style={{ fontSize: '.7rem', color: CR.gris, marginBottom: '.3rem' }}>Lien de ta boutique Mihi</div>
            <input value={cfg.lienBoutique} onChange={e => setCfg(c => ({ ...c, lienBoutique: e.target.value }))} placeholder="https://mihi.care/fr/catalog/..."
              style={{ width: '100%', border: `1px solid ${CR.pale}`, borderRadius: 8, padding: '.5rem .7rem', fontSize: '.78rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          </>
        )}
      </div>

      {/* Tokens */}
      <div style={{ background: tokens.length > 0 ? '#FDF8EC' : 'white', border: `1px solid ${tokens.length > 0 ? CR.or : CR.pale}`, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '.72rem', fontWeight: 700, color: CR.or, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: '.5rem' }}>Offre limitée (tokens)</div>
        {tokens.length > 0 ? (
          <div style={{ fontSize: '.78rem', color: CR.brun, lineHeight: 1.6 }}>
            ✅ <strong>{tokens.length} token{tokens.length > 1 ? 's' : ''}</strong> disponible{tokens.length > 1 ? 's' : ''} — affiché{tokens.length > 1 ? 's' : ''} dans le bloc "Offre limitée" de ton tunnel.
          </div>
        ) : (
          <div style={{ fontSize: '.78rem', color: CR.gris, lineHeight: 1.6 }}>
            Aucun token actif. Ajoute des tokens dans l'onglet <strong>Boutique → Tokens cadeaux</strong> pour afficher le bloc "Offre limitée".
          </div>
        )}
      </div>

      {/* Lien inscription */}
      <div style={{ background: 'white', border: `1px solid ${CR.pale}`, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '.72rem', fontWeight: 700, color: CR.or, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: '.7rem' }}>Lien d'inscription Mihi</div>
        <div style={{ fontSize: '.7rem', color: CR.gris, marginBottom: '.3rem' }}>Bouton "M'inscrire directement sur Mihi"</div>
        <input value={cfg.lienInscription} onChange={e => setCfg(c => ({ ...c, lienInscription: e.target.value }))} placeholder="https://mihi.care/fr/register?ref=..."
          style={{ width: '100%', border: `1px solid ${CR.pale}`, borderRadius: 8, padding: '.5rem .7rem', fontSize: '.78rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Email notif */}
      <div style={{ background: 'white', border: `1px solid ${CR.pale}`, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '.72rem', fontWeight: 700, color: CR.or, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: '.7rem' }}>Email de notification formulaire</div>
        <div style={{ fontSize: '.7rem', color: CR.gris, marginBottom: '.3rem' }}>Tu recevras un email quand quelqu'un remplit le formulaire</div>
        <input type="email" value={cfg.emailNotifFormulaire} onChange={e => setCfg(c => ({ ...c, emailNotifFormulaire: e.target.value }))} placeholder="ton-email@exemple.com"
          style={{ width: '100%', border: `1px solid ${CR.pale}`, borderRadius: 8, padding: '.5rem .7rem', fontSize: '.78rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Bouton sauver */}
      <button onClick={sauver} disabled={saving} style={{ width: '100%', background: saved ? CR.vert : CR.brun, color: 'white', border: 'none', borderRadius: 12, padding: '.85rem', fontSize: '.88rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', marginBottom: '1rem' }}>
        {saving ? 'Enregistrement...' : saved ? '✅ Enregistré !' : 'Enregistrer les réglages'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── PAGE PUBLIQUE (ce que voit le prospect) ───────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export function TunnelRecrutementPublic({ slug, db, preview, previewCfg, previewTokens }) {
  const [cfg, setCfg] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [photo, setPhoto] = useState('');
  const [prenom, setPrenom] = useState('');
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState({ h: 0, m: 0, s: 0 });
  const [form, setForm] = useState({ prenom: '', nom: '', email: '', tel: '', motivation: '' });
  const [formSending, setFormSending] = useState(false);
  const [formSent, setFormSent] = useState(false);
  const [formError, setFormError] = useState('');
  const timerRef = useRef(null);

  // Compte à rebours psychologique
  useEffect(() => {
    const key = `bd_recru_timer_${slug}`;
    const stored = sessionStorage.getItem(key);
    let endTime;
    if (stored) { endTime = parseInt(stored); }
    else {
      const h = 3 + Math.floor(Math.random() * 8);
      endTime = Date.now() + h * 3600000;
      sessionStorage.setItem(key, endTime.toString());
    }
    const tick = () => {
      const diff = Math.max(0, endTime - Date.now());
      setCountdown({ h: Math.floor(diff / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) });
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [slug]);

  useEffect(() => {
    if (preview) {
      setCfg(previewCfg);
      setTokens(previewTokens || []);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        // Résoudre l'uid depuis le slug
        const snapPub = await getDoc(doc(db, 'contacts_publics', slug));
        const uid = snapPub.exists() ? (snapPub.data().uid || slug) : slug;
        const snapCfg = await getDoc(doc(db, 'tunnel_recrutement', uid));
        if (snapCfg.exists()) setCfg(snapCfg.data());
        else setCfg({ titreAccroche: 'Rejoins mon équipe !', actif: true });
        const snapTok = await getDoc(doc(db, 'tokens_cadeaux', uid));
        if (snapTok.exists()) setTokens((snapTok.data().tokens || []).filter(t => !t.utilise));
        const snapLink = await getDoc(doc(db, 'linkbio', uid));
        if (snapLink.exists()) { setPhoto(snapLink.data().photo || ''); setPrenom(snapLink.data().prenom || ''); }
      } catch {}
      setLoading(false);
    })();
  }, [slug, preview]);

  const pad = n => String(n).padStart(2, '0');

  const envoyerFormulaire = async () => {
    if (!form.prenom || !form.email) { setFormError('Prénom et email obligatoires.'); return; }
    setFormSending(true);
    try {
      await addDoc(collection(db, 'leads_recrutement'), { ...form, slug, ts: Date.now(), lu: false });
      // Notif interne
      if (cfg?.emailNotifFormulaire) {
        await setDoc(doc(db, 'notifications_internes', slug + '_lead_' + Date.now()), {
          type: 'nouveau_lead', titre: '🎯 Nouveau lead recrutement !',
          message: `${form.prenom} ${form.nom} a rempli ton formulaire de recrutement.`,
          email: form.email, tel: form.tel, ts: Date.now(), lu: false,
        }, { merge: true });
      }
      setFormSent(true);
    } catch { setFormError('Une erreur est survenue. Réessaie.'); }
    setFormSending(false);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: CR.gris }}>Chargement...</div>;
  if (!cfg || !cfg.actif) return <div style={{ textAlign: 'center', padding: '3rem', color: CR.gris }}>Page non disponible.</div>;

  const bgGold = 'linear-gradient(135deg, #C4A962, #E8D48A)';

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: CR.creme, minHeight: '100vh', maxWidth: 520, margin: '0 auto' }}>

      {/* HERO */}
      <div style={{ background: bgGold, padding: '2.5rem 1.5rem 2rem', textAlign: 'center' }}>
        {photo && <img src={photo} alt={prenom} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid white', marginBottom: '1rem', boxShadow: '0 4px 16px rgba(0,0,0,.2)' }} />}
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '1.6rem', fontWeight: 700, color: CR.brun, marginBottom: '.5rem', lineHeight: 1.2 }}>
          {cfg.titreAccroche || `Rejoins l'équipe de ${prenom || 'Melissa'} !`} 🌿
        </h1>
        <p style={{ fontSize: '.9rem', color: CR.brun, opacity: .8, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{cfg.sousTitreAccroche}</p>
      </div>

      {/* BADGE SANS RISQUE */}
      <div style={{ margin: '1rem', background: '#E8F5E9', border: '1.5px solid #81C784', borderRadius: 12, padding: '.9rem 1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#2D7A4F', marginBottom: '.3rem' }}>✅ Rejoindre l'équipe c'est sans risque</div>
        <div style={{ fontSize: '.73rem', color: '#2D7A4F' }}>Aucun frais d'inscription • Aucun stock obligatoire • Tu peux arrêter quand tu veux</div>
      </div>

      {/* OFFRE LIMITÉE (tokens) */}
      {tokens.length > 0 && (
        <div style={{ margin: '0 1rem 1rem', background: 'linear-gradient(135deg, #C0392B, #E74C3C)', borderRadius: 14, padding: '1.2rem', textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: '.4rem', opacity: .9 }}>🎁 OFFRE LIMITÉE</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.2rem', fontWeight: 700, marginBottom: '.3rem' }}>
            {tokens[0].labelPerso || tokens[0].label}
          </div>
          <div style={{ fontSize: '.75rem', opacity: .9, marginBottom: '.8rem' }}>{tokens[0].description} — Pour toute inscription</div>
          {/* Compte à rebours */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '.5rem', marginBottom: '.5rem' }}>
            {[{v:countdown.h,l:'heures'},{v:countdown.m,l:'min'},{v:countdown.s,l:'sec'}].map(({v,l}) => (
              <div key={l} style={{ background: 'rgba(0,0,0,.3)', borderRadius: 8, padding: '.4rem .7rem', minWidth: 44 }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'monospace' }}>{pad(v)}</div>
                <div style={{ fontSize: '.58rem', opacity: .8 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '.72rem', opacity: .85 }}>🔥 Plus que <strong>{tokens.length}</strong> offre{tokens.length > 1 ? 's' : ''} disponible{tokens.length > 1 ? 's' : ''}</div>
        </div>
      )}

      {/* BOUTIQUE */}
      {cfg.afficherBoutique && cfg.lienBoutique && (
        <div style={{ margin: '0 1rem 1rem', background: 'white', border: `1px solid ${CR.pale}`, borderRadius: 14, padding: '1.2rem' }}>
          <div style={{ fontSize: '.85rem', fontWeight: 700, color: CR.brun, marginBottom: '.4rem' }}>🛍️ Ta boutique en ligne offerte</div>
          <p style={{ fontSize: '.78rem', color: CR.gris, lineHeight: 1.6, marginBottom: '.9rem' }}>
            Chez Mihi, la boutique en ligne coûte cher. Avec notre académie, tu l'as <strong>gratuitement</strong> — personnalisée avec tes photos, tes produits, tes prix.
          </p>
          <a href={cfg.lienBoutique} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', border: `1.5px solid ${CR.or}`, borderRadius: 10, padding: '.7rem', fontSize: '.82rem', fontWeight: 700, color: CR.brun, textDecoration: 'none' }}>
            👁️ Voir la boutique
          </a>
        </div>
      )}

      {/* CE QUE TU OBTIENS */}
      <div style={{ margin: '0 1rem 1rem', background: 'white', border: `1px solid ${CR.pale}`, borderRadius: 14, padding: '1.2rem' }}>
        <div style={{ fontSize: '.85rem', fontWeight: 700, color: CR.brun, marginBottom: '1rem' }}>✨ Ce que tu obtiens</div>
        {AVANTAGES.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: '.8rem', alignItems: 'flex-start', marginBottom: '.8rem' }}>
            <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{a.icon}</span>
            <div>
              <div style={{ fontSize: '.82rem', fontWeight: 700, color: CR.texte, marginBottom: '.15rem' }}>{a.titre}</div>
              <div style={{ fontSize: '.73rem', color: CR.gris, lineHeight: 1.4 }}>{a.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* TÉMOIGNAGES REVENUS */}
      <div style={{ margin: '0 1rem 1rem', background: 'white', border: `1px solid ${CR.pale}`, borderRadius: 14, padding: '1.2rem' }}>
        <div style={{ fontSize: '.85rem', fontWeight: 700, color: CR.brun, marginBottom: '1rem' }}>💰 Elles ont sauté le pas — voilà ce qu'elles gagnent</div>
        {(cfg.temoignagesRevenus || TEMOIGNAGES_REVENUS_DEFAULT).map((t, i) => (
          <div key={i} style={{ border: `1px solid ${CR.pale}`, borderRadius: 10, padding: '.8rem', marginBottom: '.6rem', display: 'flex', gap: '.8rem', alignItems: 'center' }}>
            <span style={{ fontSize: '2rem', flexShrink: 0 }}>👤</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '.8rem', fontWeight: 700, color: CR.texte }}>{t.prenom} — {t.metier}</div>
              <div style={{ fontSize: '.7rem', color: CR.gris }}>{t.heures} • {t.clientes}</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: CR.or, marginTop: '.2rem' }}>{t.montant} €<span style={{ fontSize: '.7rem', fontWeight: 400, color: CR.gris }}>/mois</span></div>
            </div>
          </div>
        ))}
        <div style={{ fontSize: '.65rem', color: CR.gris, fontStyle: 'italic', textAlign: 'center', marginTop: '.3rem' }}>Revenus moyens constatés dans notre équipe. Les résultats varient selon l'investissement personnel.</div>
      </div>

      {/* STATUTS MIHI */}
      <div style={{ margin: '0 1rem 1rem', background: 'white', border: `1px solid ${CR.pale}`, borderRadius: 14, padding: '1.2rem' }}>
        <div style={{ fontSize: '.85rem', fontWeight: 700, color: CR.brun, marginBottom: '1rem' }}>🏆 Les statuts Mihi</div>
        {STATUTS.map((s, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.6rem 0', borderBottom: i < STATUTS.length - 1 ? `1px solid ${CR.pale}` : 'none' }}>
            <div>
              <div style={{ fontSize: '.8rem', fontWeight: 600, color: CR.texte }}>{s.nom}</div>
              <div style={{ fontSize: '.68rem', color: CR.gris }}>{s.ca}</div>
            </div>
            <div style={{ fontSize: '.75rem', fontWeight: 700, color: CR.or }}>{s.comm}</div>
          </div>
        ))}
      </div>

      {/* TÉMOIGNAGES QUALITATIFS */}
      <div style={{ margin: '0 1rem 1rem', background: 'white', border: `1px solid ${CR.pale}`, borderRadius: 14, padding: '1.2rem' }}>
        <div style={{ fontSize: '.85rem', fontWeight: 700, color: CR.brun, marginBottom: '1rem' }}>💬 Elles ont sauté le pas</div>
        {(cfg.temoignagesQuali || TEMOIGNAGES_QUALI_DEFAULT).map((t, i) => (
          <div key={i} style={{ background: CR.creme, borderLeft: `3px solid ${CR.or}`, borderRadius: '0 10px 10px 0', padding: '.8rem 1rem', marginBottom: '.7rem' }}>
            <p style={{ fontSize: '.78rem', color: CR.texte, lineHeight: 1.6, fontStyle: 'italic', marginBottom: '.4rem' }}>"{t.texte}"</p>
            <div style={{ fontSize: '.7rem', fontWeight: 700, color: CR.or }}>— {t.auteur}</div>
          </div>
        ))}
      </div>

      {/* FORMULAIRE */}
      <div style={{ margin: '0 1rem 1rem', background: 'white', border: `1.5px solid ${CR.or}`, borderRadius: 14, padding: '1.2rem' }}>
        <div style={{ fontSize: '.85rem', fontWeight: 700, color: CR.brun, marginBottom: '1rem', textAlign: 'center' }}>🌿 Je veux en savoir plus</div>
        {formSent ? (
          <div style={{ textAlign: 'center', padding: '1.5rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '.7rem' }}>🎉</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.1rem', fontWeight: 600, color: CR.brun, marginBottom: '.5rem' }}>Message reçu !</div>
            <div style={{ fontSize: '.8rem', color: CR.gris, lineHeight: 1.6 }}>Je reviens vers toi très rapidement. Bienvenue dans l'aventure Blazing Dynasty !</div>
          </div>
        ) : (
          <>
            {[
              {label:'Prénom *', key:'prenom', type:'text', ph:'Ton prénom'},
              {label:'Nom *', key:'nom', type:'text', ph:'Ton nom'},
              {label:'Email *', key:'email', type:'email', ph:'Ton adresse email'},
              {label:'Téléphone', key:'tel', type:'tel', ph:'Ton numéro de téléphone'},
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '.7rem' }}>
                <div style={{ fontSize: '.72rem', fontWeight: 600, color: CR.gris, marginBottom: '.3rem' }}>{f.label}</div>
                <input type={f.type} placeholder={f.ph} value={form[f.key]} onChange={e => setForm(fm => ({ ...fm, [f.key]: e.target.value }))}
                  style={{ width: '100%', border: `1px solid ${CR.pale}`, borderRadius: 8, padding: '.6rem .8rem', fontSize: '.82rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '.72rem', fontWeight: 600, color: CR.gris, marginBottom: '.3rem' }}>Qu'est-ce qui t'attire dans cette opportunité ?</div>
              <textarea placeholder="Dis-nous en quelques mots..." value={form.motivation} onChange={e => setForm(fm => ({ ...fm, motivation: e.target.value }))} rows={3}
                style={{ width: '100%', border: `1px solid ${CR.pale}`, borderRadius: 8, padding: '.6rem .8rem', fontSize: '.82rem', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            {formError && <div style={{ fontSize: '.75rem', color: CR.rouge, marginBottom: '.7rem', textAlign: 'center' }}>{formError}</div>}
            <button onClick={envoyerFormulaire} disabled={formSending}
              style={{ width: '100%', background: bgGold, color: CR.brun, border: 'none', borderRadius: 12, padding: '1rem', fontSize: '.9rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', marginBottom: '.7rem' }}>
              {formSending ? 'Envoi...' : '🌿 Je veux rejoindre l\'équipe !'}
            </button>
            {cfg.lienInscription && (
              <>
                <div style={{ textAlign: 'center', fontSize: '.73rem', color: CR.gris, marginBottom: '.5rem' }}>Tu es déjà prête à démarrer ?</div>
                <a href={cfg.lienInscription} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', textAlign: 'center', border: `1.5px solid ${CR.vert}`, borderRadius: 12, padding: '.75rem', fontSize: '.82rem', fontWeight: 700, color: CR.vert, textDecoration: 'none' }}>
                  ✅ M'inscrire directement sur Mihi
                </a>
              </>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '1.5rem', fontSize: '.65rem', color: CR.gris }}>
        🔥 Blazing Dynasty • Équipe de {prenom || 'Melissa'}
      </div>
    </div>
  );
}
