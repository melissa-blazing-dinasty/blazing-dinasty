const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

// 1. Ajouter state showDecouverte
const ancreState = "  const [notif, setNotif] = useState(null);";
if (!c.includes('showDecouverte')) {
  c = c.replace(ancreState, ancreState + "\n  const [showDecouverte, setShowDecouverte] = useState(false);");
  console.log('1 OK - state');
} else console.log('1 DEJA');

// 2. Ajouter bouton Decouverte dans le header
const ancreHeader = "          <button onClick={() => setPreview(true)}";
if (!c.includes('setShowDecouverte(true)') && c.includes(ancreHeader)) {
  c = c.replace(ancreHeader,
    "          <button onClick={() => setShowDecouverte(true)} style={{ flex: 1, background: 'rgba(255,255,255,.1)', color: 'white', border: '1px solid rgba(255,255,255,.3)', borderRadius: 8, padding: '.5rem', fontSize: '.75rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>🧭 Découverte</button>\n          <button onClick={() => setPreview(true)}"
  );
  console.log('2 OK - bouton');
} else console.log('2 DEJA');

// 3. Ajouter le composant DecouverteTunnel avant le return
const ancreReturn = "  if(loading) return <div style={{textAlign:'center',padding:'3rem',color:CR.gris}}>Chargement...</div>;";
const decouverte = `
  const ETAPES_DECOUVERTE = [
    {titre:"Bienvenue dans ton Tunnel !", texte:"Ce tunnel est une page publique que tu partages à des prospects. Elle leur présente l'opportunité Mihi, tes témoignages, et les incite à te contacter ou s'inscrire.", icon:"🎯", cible:"decouverte-tunnel-header"},
    {titre:"Configure ton accroche", texte:"Personnalise le titre et le sous-titre qui apparaissent en haut de ta page. Parle directement à ta cible : les femmes qui cherchent un complément de revenus.", icon:"✍️", cible:"decouverte-tunnel-accroche"},
    {titre:"Ajoute des offres cadeaux", texte:"Si tu as des tokens actifs (Boutique → Tokens cadeaux), elles s'affichent automatiquement sur ta page avec un compte à rebours pour créer l'urgence.", icon:"🎁", cible:"decouverte-tunnel-tokens"},
    {titre:"Ta boutique en ligne", texte:"Si tu as créé ta boutique Blazing Dynasty, active ce bouton pour que tes prospects puissent voir tes produits avant de rejoindre l'équipe. C'est un vrai argument de vente.", icon:"🛍️", cible:"decouverte-tunnel-boutique"},
    {titre:"Les témoignages revenus", texte:"Remplace les prénoms et montants par des vraies personnes de ton équipe. Des chiffres réels convainquent bien mieux que des exemples génériques.", icon:"💰", cible:"decouverte-tunnel-revenus"},
    {titre:"Ton lien d'inscription Mihi", texte:"Colle ici ton lien de parrainage Mihi. Il apparaîtra en bas de la page pour les prospects déjà convaincus qui veulent s'inscrire directement.", icon:"🔗", cible:"decouverte-tunnel-inscription"},
    {titre:"Partage ton lien partout !", texte:"Copie ton lien tunnel et partage-le en story, en post, en DM, dans ta bio Instagram. C'est ta page de recrutement — plus tu la partages, plus tu attires.", icon:"🚀", cible:"decouverte-tunnel-lien"},
  ];

`;

if (!c.includes('ETAPES_DECOUVERTE') && c.includes(ancreReturn)) {
  c = c.replace(ancreReturn, decouverte + ancreReturn);
  console.log('3 OK - etapes');
} else console.log('3 DEJA');

// 4. Ajouter popup decouverte avant le return JSX principal
const ancreJSX = "  return (\n    <div style={{fontFamily:'inherit',maxWidth:480,margin:'0 auto',padding:'0 0 3rem'}}>"; 
const ancreJSX2 = "  return (\n    <div style={{ fontFamily: 'inherit', maxWidth: 480, margin: '0 auto', padding: '0 0 3rem' }}>"; 

const popupCode = `  if (showDecouverte) return (
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

`;

if (!c.includes('showDecouverte) return')) {
  if (c.includes(ancreJSX)) {
    c = c.replace(ancreJSX, popupCode + ancreJSX);
    console.log('4 OK - popup v1');
  } else if (c.includes(ancreJSX2)) {
    c = c.replace(ancreJSX2, popupCode + ancreJSX2);
    console.log('4 OK - popup v2');
  } else {
    console.log('4 ECHEC - return JSX introuvable');
  }
} else console.log('4 DEJA');

fs.writeFileSync(f, c, 'utf8');
console.log('=== SAUVEGARDE ===');