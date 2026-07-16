// fix-tunnel-faq-theme.js
// Ajoute FAQ + theme dynamique directement dans src/TunnelRecrutementTab.jsx
// node fix-tunnel-faq-theme.js

const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');
fs.writeFileSync(f + '.bak-faq', c, 'utf8');
let ok = 0;

// ── A : Ajouter les thèmes et getTheme avant CR ──────────────────────────────
const ancreTheme = "const CR = {";
const themesCode = `const THEMES_TUNNEL = [
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

`;

if (c.includes('THEMES_TUNNEL')) { ok++; console.log('A DEJA'); }
else if (c.includes(ancreTheme)) {
  c = c.replace(ancreTheme, themesCode + ancreTheme);
  ok++; console.log('A OK themes');
} else console.log('A ECHEC');

// ── B : Ajouter state themeId ─────────────────────────────────────────────────
const ancreState = "  const [countdown, setCountdown] = useState({ h: 0, m: 0, s: 0 });";
if (c.includes('themeId')) { ok++; console.log('B DEJA'); }
else if (c.includes(ancreState)) {
  c = c.replace(ancreState, "  const [themeId, setThemeId] = useState('rose_gold');\n  const [faqOuverte, setFaqOuverte] = useState(null);\n  " + ancreState.trim());
  ok++; console.log('B OK states');
} else console.log('B ECHEC');

// ── C : Charger thème depuis Firestore ────────────────────────────────────────
const ancreLink = "if (snapLink.exists()) { setPhoto(snapLink.data().photo || ''); setPrenom(snapLink.data().prenom || ''); }";
if (c.includes('setThemeId')) { ok++; console.log('C DEJA'); }
else if (c.includes(ancreLink)) {
  c = c.replace(ancreLink, "if (snapLink.exists()) { setPhoto(snapLink.data().photo || ''); setPrenom(snapLink.data().prenom || ''); setThemeId(snapLink.data().theme || 'rose_gold'); }");
  ok++; console.log('C OK firestore theme');
} else console.log('C ECHEC');

// ── D : Remplacer bgGold par theme dynamique ──────────────────────────────────
const ancreGuard = "  const bgGold = 'linear-gradient(135deg, #C4A962, #E8D48A)';";
if (c.includes('const theme = getTheme')) { ok++; console.log('D DEJA'); }
else if (c.includes(ancreGuard)) {
  c = c.replace(ancreGuard,
    "  const theme = getTheme(themeId);\n" +
    "  const bgHero = theme.header;\n" +
    "  const accentColor = theme.accent;\n" +
    "  const faqBgColor = theme.faqBg;"
  );
  ok++; console.log('D OK theme vars');
} else console.log('D ECHEC');

// ── E : Appliquer bgHero au hero ──────────────────────────────────────────────
if (c.includes('background: bgHero')) { ok++; console.log('E DEJA'); }
else {
  c = c.replace(
    '{ background: bgGold, padding: \'2.5rem 1.5rem 2rem\'',
    '{ background: bgHero, padding: \'2.5rem 1.5rem 2rem\''
  );
  ok++; console.log('E OK hero bg');
}

// ── F : Appliquer accentColor au bouton formulaire ────────────────────────────
if (c.includes('background: accentColor')) { ok++; console.log('F DEJA'); }
else {
  c = c.replace(
    "background: bgGold, color: CR.brun,",
    "background: accentColor, color: 'white',"
  );
  ok++; console.log('F OK btn color');
}

// ── G : Ajouter FAQ avant le footer ──────────────────────────────────────────
const ancreFaq = "      {/* Footer */}";
const faqBlock = `      {/* FAQ */}
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

`;

if (c.includes('Tu te poses')) { ok++; console.log('G DEJA'); }
else if (c.includes(ancreFaq)) {
  c = c.replace(ancreFaq, faqBlock + ancreFaq);
  ok++; console.log('G OK FAQ');
} else console.log('G ECHEC footer introuvable');

// ── SAVE ─────────────────────────────────────────────────────────────────────
if (ok === 7) {
  fs.writeFileSync(f, c, 'utf8');
  console.log('\n=== TOUT BON (7/7) sauvegarde ===');
  console.log('Lignes: ' + c.split('\n').length);
} else {
  console.log('\n=== ' + ok + '/7 - RIEN sauvegarde ===');
}
