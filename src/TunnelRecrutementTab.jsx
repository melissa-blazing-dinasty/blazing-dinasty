// TunnelRecrutementTab.jsx — Blazing Dynasty
// Gestion du tunnel de recrutement + page publique prospect
// Placer dans src/

import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';

// ── COULEURS ─────────────────────────────────────────────────────────────────
const THEMES_TUNNEL = [
  {id:"elegance",header:"linear-gradient(135deg,#3D1F0E,#5C3020)",accent:"#C4A882",faqBg:"#FDF5EE"},
  {id:"rose_gold",header:"linear-gradient(135deg,#C49A8A,#A0716A)",accent:"#C49A8A",faqBg:"#FFF5F3"},
  {id:"nuit",header:"linear-gradient(135deg,#0D0D2B,#1A1A4E)",accent:"#A89BB5",faqBg:"#1A1A4E"},
  {id:"or_noir",header:"linear-gradient(135deg,#1A1A1A,#2D2D2D)",accent:"#C4A832",faqBg:"#1A1A1A"},
  {id:"nature",header:"linear-gradient(135deg,#2E7D32,#388E3C)",accent:"#2E7D32",faqBg:"#E8F5E9"},
  {id:"lavande",header:"linear-gradient(135deg,#7E57C2,#9575CD)",accent:"#7E57C2",faqBg:"#EDE7F6"},
  {id:"soleil",header:"linear-gradient(135deg,#F57F17,#F9A825)",accent:"#F57F17",faqBg:"#FFF8E1"},
  {id:"ocean",header:"linear-gradient(135deg,#1565C0,#1976D2)",accent:"#1565C0",faqBg:"#E3F2FD"},
  {id:"corail",header:"linear-gradient(135deg,#FF6B6B,#FF8E8E)",accent:"#FF6B6B",faqBg:"#FFF9F7"},
  {id:"minimaliste",header:"linear-gradient(135deg,#212121,#424242)",accent:"#212121",faqBg:"#FAFAFA"},
];
const getTheme = id => THEMES_TUNNEL.find(t=>t.id===id)||THEMES_TUNNEL[1];

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
  {prenom:'Fanny', metier:'Coiffeuse', heures:'6h/semaine', clientes:'12 clientes régulières', montant:'957'},
  {prenom:'Melissa', metier:'Maman au foyer - a temps plein chez Mihi', heures:'4h/semaine', clientes:'8 clientes', montant:'3000'},
  {prenom:'Sarah', metier:'Garde d enfants salariee', heures:'8h/semaine', clientes:'20 clientes', montant:'790'},
];

// ── TÉMOIGNAGES QUALITATIFS ───────────────────────────────────────────────────
const TEMOIGNAGES_QUALI_DEFAULT = [
  {texte:"Depuis que j'ai rejoint l'equipe, j'ai retrouve une vraie confiance en moi. Grace a l'application et aux formations, j'ai progresse bien plus vite.", auteur:"Eva, dans l'equipe Blazing Dynasty"},
  {texte:"L'application, l'equipe, l'accompagnement - tout est la pour avancer. Je me sens vraiment professionnelle dans ma facon de travailler.", auteur:"Christelle, dans l'equipe Blazing Dynasty"},
  {texte:"Ce qui m'a le plus surprise c'est l'esprit d'equipe. On avance ensemble, on se soutient - ca fait toute la difference.", auteur:"Oceane, dans l'equipe Blazing Dynasty"},
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
  const [showDecouverte, setShowDecouverte] = useState(false);

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

  const ETAPES_DECOUVERTE = [
    {titre:"Bienvenue dans ton Tunnel !", texte:"Ce tunnel est une page publique que tu partages a des prospects. Elle leur presente l'opportunite Mihi et les incite a te contacter.", icon:"🎯"},
    {titre:"Configure ton accroche", texte:"Personnalise le titre et le sous-titre qui apparaissent en haut de ta page. Parle directement aux femmes qui cherchent un complement de revenus.", icon:"✍️"},
    {titre:"Ajoute des offres cadeaux", texte:"Si tu as des tokens actifs (Boutique → Tokens cadeaux), ils s'affichent avec un compte a rebours pour creer l'urgence.", icon:"🎁"},
    {titre:"Ta boutique en ligne", texte:"Si tu as cree ta boutique Blazing Dynasty, active ce bouton pour que tes prospects voient tes produits avant de rejoindre l'equipe.", icon:"🛍️"},
    {titre:"Les temoignages revenus", texte:"Remplace les prenoms et montants par des vraies personnes de ton equipe. Des chiffres reels convainquent bien mieux.", icon:"💰"},
    {titre:"Ton lien d inscription Mihi", texte:"Colle ton lien de parrainage Mihi. Il apparaitra pour les prospects deja convaincus qui veulent s'inscrire directement.", icon:"🔗"},
    {titre:"Partage ton lien partout !", texte:"Copie ton lien tunnel et partage-le en story, en post, en DM, dans ta bio. Plus tu le partages, plus tu attires de recrues.", icon:"🚀"},
  ];
  if (showDecouverte) return (
    <div style={{ fontFamily: 'inherit', maxWidth: 480, margin: '0 auto', padding: '0 0 3rem' }}>
      <div style={{ background: 'linear-gradient(135deg,' + CR.brun + ',#3D2020)', borderRadius: 16, padding: '1.2rem', marginBottom: '1rem', color: 'white', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Georgia,serif', fontSize: '1.2rem', fontWeight: 600, marginBottom: '.3rem' }}>🧭 Découverte — Tunnel Recrutement</div>
        <div style={{ fontSize: '.78rem', opacity: .8 }}>Comment configurer et utiliser ton tunnel</div>
      </div>
      {ETAPES_DECOUVERTE.map((e, i) => (
        <div key={i} style={{ background: 'white', border: '1px solid ' + CR.pale, borderRadius: 12, padding: '1rem', marginBottom: '.8rem', display: 'flex', gap: '.8rem', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{e.icon}</span>
          <div>
            <div style={{ fontSize: '.82rem', fontWeight: 700, color: CR.brun, marginBottom: '.3rem' }}>{e.titre}</div>
            <div style={{ fontSize: '.76rem', color: CR.gris, lineHeight: 1.6 }}>{e.texte}</div>
          </div>
        </div>
      ))}
      <button onClick={() => setShowDecouverte(false)} style={{ width: '100%', background: CR.brun, color: 'white', border: 'none', borderRadius: 12, padding: '.85rem', fontSize: '.88rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
        ✓ J'ai compris, je configure mon tunnel !
      </button>
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
          <button onClick={() => setShowDecouverte(true)} style={{ flex: 1, background: 'rgba(255,255,255,.1)', color: 'white', border: '1px solid rgba(255,255,255,.3)', borderRadius: 8, padding: '.5rem', fontSize: '.75rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>🧭 Découverte</button>
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

      {/* Chiffres Ce mois-ci */}
      <div style={{ background: 'white', border: '1px solid ' + CR.pale, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '.72rem', fontWeight: 700, color: CR.or, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: '.7rem' }}>📊 Bloc "Ce mois-ci"</div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '.7rem', color: CR.gris, marginBottom: '.3rem' }}>Personnes ont rejoint</div>
            <input type="number" value={cfg.nbPersonnesRejointes||0} onChange={e => setCfg(c => ({ ...c, nbPersonnesRejointes: parseInt(e.target.value)||0 }))}
              style={{ width: '100%', border: '1px solid ' + CR.pale, borderRadius: 8, padding: '.5rem .7rem', fontSize: '.82rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '.7rem', color: CR.gris, marginBottom: '.3rem' }}>Places restantes</div>
            <input type="number" value={cfg.nbPlacesRestantes||0} onChange={e => setCfg(c => ({ ...c, nbPlacesRestantes: parseInt(e.target.value)||0 }))}
              style={{ width: '100%', border: '1px solid ' + CR.pale, borderRadius: 8, padding: '.5rem .7rem', fontSize: '.82rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
      </div>

      {/* Temoignages qualitatifs */}
      <div style={{ background: 'white', border: '1px solid ' + CR.pale, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '.72rem', fontWeight: 700, color: CR.or, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: '.7rem' }}>Elles ont saute le pas</div>
        {(cfg.temoignagesQuali || TEMOIGNAGES_QUALI_DEFAULT).map((t, i) => (
          <div key={i} style={{ background: CR.creme, borderRadius: 10, padding: '.7rem', marginBottom: '.6rem' }}>
            <div style={{ fontSize: '.7rem', fontWeight: 700, color: CR.or, marginBottom: '.4rem' }}>Temoignage {i + 1}</div>
            <textarea value={t.texte} onChange={e => { const arr = [...(cfg.temoignagesQuali || TEMOIGNAGES_QUALI_DEFAULT)]; arr[i] = { ...arr[i], texte: e.target.value }; setCfg(c => ({ ...c, temoignagesQuali: arr })); }} rows={3} placeholder="Le temoignage..."
              style={{ width: '100%', border: '1px solid ' + CR.pale, borderRadius: 8, padding: '.5rem .7rem', fontSize: '.78rem', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: '.4rem' }} />
            <input value={t.auteur} onChange={e => { const arr = [...(cfg.temoignagesQuali || TEMOIGNAGES_QUALI_DEFAULT)]; arr[i] = { ...arr[i], auteur: e.target.value }; setCfg(c => ({ ...c, temoignagesQuali: arr })); }} placeholder="Auteur..."
              style={{ width: '100%', border: '1px solid ' + CR.pale, borderRadius: 8, padding: '.5rem .7rem', fontSize: '.78rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        ))}
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

      <div style={{background:'white',border:'1px solid '+CR.pale,borderRadius:12,padding:'1rem',marginBottom:'1rem'}}>
        <div style={{fontSize:'.72rem',fontWeight:700,color:CR.or,textTransform:'uppercase',letterSpacing:1.5,marginBottom:'.7rem'}}>Revenus de l equipe</div>
        {(cfg.temoignagesRevenus||TEMOIGNAGES_REVENUS_DEFAULT).map((t,i)=>(
          <div key={i} style={{background:CR.creme,borderRadius:10,padding:'.7rem',marginBottom:'.6rem'}}>
            <div style={{fontSize:'.7rem',fontWeight:700,color:CR.or,marginBottom:'.4rem'}}>Personne {i+1}</div>
            <input value={t.prenom||''} onChange={e=>{const a=[...(cfg.temoignagesRevenus||TEMOIGNAGES_REVENUS_DEFAULT)];a[i]={...a[i],prenom:e.target.value};setCfg(c=>({...c,temoignagesRevenus:a}));}} placeholder="Prenom" style={{width:'100%',border:'1px solid '+CR.pale,borderRadius:8,padding:'.5rem .7rem',fontSize:'.78rem',fontFamily:'inherit',outline:'none',boxSizing:'border-box',marginBottom:'.4rem'}}/>
            <input value={t.metier||''} onChange={e=>{const a=[...(cfg.temoignagesRevenus||TEMOIGNAGES_REVENUS_DEFAULT)];a[i]={...a[i],metier:e.target.value};setCfg(c=>({...c,temoignagesRevenus:a}));}} placeholder="Metier" style={{width:'100%',border:'1px solid '+CR.pale,borderRadius:8,padding:'.5rem .7rem',fontSize:'.78rem',fontFamily:'inherit',outline:'none',boxSizing:'border-box',marginBottom:'.4rem'}}/>
            <input value={t.montant||''} onChange={e=>{const a=[...(cfg.temoignagesRevenus||TEMOIGNAGES_REVENUS_DEFAULT)];a[i]={...a[i],montant:e.target.value};setCfg(c=>({...c,temoignagesRevenus:a}));}} placeholder="Montant euros/mois" style={{width:'100%',border:'1px solid '+CR.pale,borderRadius:8,padding:'.5rem .7rem',fontSize:'.78rem',fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}/>
          </div>
        ))}
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
  const [themeId, setThemeId] = useState('rose_gold');
  const [faqOuverte, setFaqOuverte] = useState(null);
  const [countdown, setCountdown] = useState({ h: 0, m: 0, s: 0 });
  const [form, setForm] = useState({ prenom: '', nom: '', email: '', tel: '', motivation: '' });
  const [tokenChoisi, setTokenChoisi] = useState(null);
  const [tokenConfirm, setTokenConfirm] = useState(false);
  const [formSending, setFormSending] = useState(false);
  const [formSent, setFormSent] = useState(false);
  const [formError, setFormError] = useState('');
  const timerRef = useRef(null);

  // Compte à rebours psychologique
  useEffect(() => {
    const key = 'bd_recru_timer_' + slug;
    let endTime;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        endTime = parseInt(stored);
        if (endTime < Date.now()) {
          const h = 18 + Math.floor(Math.random() * 30);
          endTime = Date.now() + h * 3600000;
          localStorage.setItem(key, endTime.toString());
        }
      } else {
        const h = 18 + Math.floor(Math.random() * 30);
        endTime = Date.now() + h * 3600000;
        localStorage.setItem(key, endTime.toString());
      }
    } catch {
      const h = 18 + Math.floor(Math.random() * 30);
      endTime = Date.now() + h * 3600000;
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

  const theme = getTheme(themeId);
  const bgHero = theme.header;
  const accentColor = theme.accent;
  const faqBgColor = theme.faqBg;

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: CR.creme, minHeight: '100vh', maxWidth: 520, margin: '0 auto' }}>

      {/* HERO */}
      <div style={{ background: bgHero, padding: '2.5rem 1.5rem 2rem', textAlign: 'center' }}>
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
        <div style={{ margin: '0 1rem 1rem', borderRadius: 16, padding: 3, background: 'linear-gradient(135deg,' + accentColor + ',#fff,' + accentColor + ')', boxShadow: '0 0 24px ' + accentColor + '66' }}>
          <div style={{ background: 'linear-gradient(135deg,#1A0800,#2D1400)', borderRadius: 14, padding: '1.2rem', color: 'white' }}>
            <div style={{ textAlign: 'center', marginBottom: '.8rem' }}>
              <div style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: accentColor, marginBottom: '.3rem' }}>OFFRE LIMITEE</div>
              {!tokenChoisi && !tokenConfirm && <div style={{ fontFamily: 'Georgia,serif', fontSize: '1.15rem', fontWeight: 700, marginBottom: '.2rem' }}>Choisis ton cadeau</div>}
              {!tokenChoisi && !tokenConfirm && <div style={{ fontSize: '.72rem', opacity: .8 }}>Pour toute inscription — offre a usage unique</div>}
            </div>
            {!tokenChoisi && !tokenConfirm && (<>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '.5rem', marginBottom: '.7rem' }}>
                {[{v:countdown.h,l:'h'},{v:countdown.m,l:'min'},{v:countdown.s,l:'sec'}].map(({v,l}) => (
                  <div key={l} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid ' + accentColor + '44', borderRadius: 8, padding: '.4rem .6rem', minWidth: 42, textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace', color: accentColor }}>{pad(v)}</div>
                    <div style={{ fontSize: '.55rem', opacity: .7 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '.7rem', textAlign: 'center', color: accentColor, marginBottom: '.8rem' }}>Plus que <strong>{tokens.length}</strong> offre{tokens.length > 1 ? 's' : ''} disponible{tokens.length > 1 ? 's' : ''}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                {[...new Map(tokens.map(t => [t.type, t])).values()].map(tok => (
                  <button key={tok.id} onClick={() => setTokenChoisi(tok)}
                    style={{ background: 'rgba(255,255,255,.08)', border: '1.5px solid ' + accentColor + '66', borderRadius: 10, padding: '.75rem 1rem', color: 'white', fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.7rem', textAlign: 'left' }}>
                    <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{tok.emoji || '🎁'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '.82rem', fontWeight: 700, color: accentColor }}>{tok.labelPerso || tok.label}</div>
                      <div style={{ fontSize: '.7rem', opacity: .75 }}>{tok.description}</div>
                    </div>
                    <span style={{ color: accentColor }}>→</span>
                  </button>
                ))}
              </div>
            </>)}
            {tokenChoisi && !tokenConfirm && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>{tokenChoisi.emoji || '🎁'}</div>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: '1.1rem', fontWeight: 700, color: accentColor, marginBottom: '.4rem' }}>{tokenChoisi.labelPerso || tokenChoisi.label}</div>
                <div style={{ fontSize: '.75rem', opacity: .85, marginBottom: '.8rem' }}>Tu vas etre redirigee vers la boutique Mihi pour activer ton offre.</div>
                <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 10, padding: '.6rem', fontSize: '.72rem', marginBottom: '.9rem' }}>Ce lien est a usage unique.</div>
                <button onClick={() => { setTokenConfirm(true); setTimeout(() => { window.location.href = tokenChoisi.lien; }, 1500); }}
                  style={{ width: '100%', background: accentColor, color: 'white', border: 'none', borderRadius: 10, padding: '.75rem', fontSize: '.85rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', marginBottom: '.5rem' }}>
                  Activer mon offre →
                </button>
                <button onClick={() => setTokenChoisi(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.6)', fontFamily: 'inherit', cursor: 'pointer', fontSize: '.75rem' }}>← Revenir</button>
              </div>
            )}
            {tokenConfirm && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '.5rem' }}>🎉</div>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: '1.1rem', fontWeight: 700, color: accentColor }}>Offre activee !</div>
                <div style={{ fontSize: '.78rem', opacity: .8, marginTop: '.4rem' }}>Redirection en cours...</div>
              </div>
            )}
          </div>
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
        {/* CE MOIS-CI */}
        <div style={{ margin: '0 1rem 1rem', background: 'linear-gradient(135deg,' + CR.brun + ',#3D2020)', borderRadius: 14, padding: '1.4rem', color: 'white', textAlign: 'center' }}>
          <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: '.8rem', opacity: .8 }}>🔥 CE MOIS-CI</div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '.8rem' }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.1)', borderRadius: 10, padding: '1rem .5rem' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: accentColor }}>{cfg.nbPersonnesRejointes||0}</div>
              <div style={{ fontSize: '.72rem', opacity: .85 }}>Personnes ont rejoint l'equipe</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.1)', borderRadius: 10, padding: '1rem .5rem' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#FF8A80' }}>{cfg.nbPlacesRestantes||0}</div>
              <div style={{ fontSize: '.72rem', opacity: .85 }}>Places restantes ce mois</div>
            </div>
          </div>
          <div style={{ fontSize: '.72rem', opacity: .7, fontStyle: 'italic' }}>{prenom||'Melissa'} accompagne personnellement chaque nouvelle recrue</div>
        </div>

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
              style={{ width: '100%', background: accentColor, color: 'white', border: 'none', borderRadius: 12, padding: '1rem', fontSize: '.9rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', marginBottom: '.7rem' }}>
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

      {/* FAQ */}
      <div style={{ margin: '0 1rem 1rem', background: 'white', border: '1px solid ' + CR.pale, borderRadius: 14, padding: '1.2rem' }}>
        <div style={{ fontSize: '.85rem', fontWeight: 700, color: CR.brun, marginBottom: '1rem' }}>🤔 Tu te poses sûrement ces questions...</div>
        {[
          {q:"C'est du MLM, c'est une arnaque ?",r:"Non. Mihi est fabriqué par ElfaPharm, laboratoire pharmaceutique présent depuis 25 ans dans 62 pays. Tu gagnes ta vie en vendant de vrais produits de qualité — pas en recrutant à tout prix."},
          {q:"Je n'ai pas de réseau...",r:"La plupart de nos recrues ont démarré sans réseau. On t'apprend à développer ta clientèle naturellement via les réseaux sociaux. Notre méthode fonctionne même pour les débutantes."},
          {q:"Je n'y connais rien en cosmétiques...",r:"Pas besoin d'être experte ! Tu reçois toutes les formations produits dans l'académie. Les diagnostics IA te permettent de conseiller tes clientes sans tout connaître par coeur."},
          {q:"Combien de temps faut-il y consacrer ?",r:"Des 4h par semaine tu peux générer un complément de revenu. C'est toi qui choisis ton rythme — le soir, entre midi, à ton rythme. Zéro obligation."},
          {q:"Combien ca coute pour demarrer ?",r:"L'inscription est gratuite. Aucun stock obligatoire, aucun frais cachés. Ta boutique en ligne est offerte et entièrement prise en charge."},
          {q:"Et si ca ne marche pas pour moi ?",r:"Tu peux arrêter quand tu veux, sans pénalité. On fait tout pour que ca marche : formations, accompagnement, outils, communauté. Tu n'es jamais seule."},
          {q:"Est-ce que je dois recruter ?",r:"Non, recruter n'est pas obligatoire. Tu peux très bien vivre uniquement de la vente de produits. Le recrutement est une option pour multiplier tes revenus."},
          {q:"Mihi existe depuis combien de temps ?",r:"Mihi France a été lancé en 2022. Tu fais partie des premières distributrices. Le laboratoire ElfaPharm existe depuis 25 ans dans 62 pays."},
        ].map((f, i) => (
          <div key={i} style={{ border: '1px solid ' + (faqOuverte === i ? accentColor : CR.pale), borderRadius: 10, marginBottom: '.5rem', overflow: 'hidden' }}>
            <button onClick={() => setFaqOuverte(faqOuverte === i ? null : i)}
              style={{ width: '100%', background: faqOuverte === i ? faqBgColor : 'white', border: 'none', padding: '.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <span style={{ fontSize: '.8rem', fontWeight: 600, color: faqOuverte === i ? accentColor : CR.texte, flex: 1 }}>❓ {f.q}</span>
              <span style={{ color: accentColor, flexShrink: 0, marginLeft: '.5rem' }}>{faqOuverte === i ? '▲' : '›'}</span>
            </button>
            {faqOuverte === i && (
              <div style={{ padding: '.8rem 1rem', background: faqBgColor, borderTop: '1px solid ' + CR.pale }}>
                <p style={{ fontSize: '.78rem', color: CR.texte, lineHeight: 1.7, margin: 0 }}>{f.r}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '1.5rem', fontSize: '.65rem', color: CR.gris }}>
        🔥 Blazing Dynasty • Équipe de {prenom || 'Melissa'}
      </div>
    </div>
  );
}
