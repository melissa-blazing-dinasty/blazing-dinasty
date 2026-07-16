// fix-tunnel-stats.js
// Integre TunnelStatsTab dans TunnelRecrutementTab + tracking vues/leads
// node fix-tunnel-stats.js

const fs = require('fs');
let ok = 0;

// ── 1. TunnelRecrutementTab.jsx ───────────────────────────────────────────────
const fT = 'src/TunnelRecrutementTab.jsx';
let cT = fs.readFileSync(fT, 'utf8');
fs.writeFileSync(fT + '.bak-stats', cT, 'utf8');

// A - import getDocs + TunnelStatsTab
const impA = "import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';";
if (!cT.includes('TunnelStatsTab') && cT.includes(impA)) {
  cT = cT.replace(impA,
    "import { doc, getDoc, setDoc, addDoc, collection, getDocs } from 'firebase/firestore';\nimport { TunnelStatsTab, trackTunnelView, trackTunnelLead } from './TunnelStatsTab';"
  );
  ok++; console.log('A OK imports');
} else { ok++; console.log('A DEJA'); }

// B - Ajouter onglet Stats dans le composant gestion
const impB = "  const [preview, setPreview] = useState(false);";
if (!cT.includes("sousOnglet") && cT.includes(impB)) {
  cT = cT.replace(impB, impB + "\n  const [sousOnglet, setSousOnglet] = useState('reglages');");
  ok++; console.log('B OK state sousOnglet');
} else { ok++; console.log('B DEJA'); }

// C - Ajouter nav onglets avant le header
const impC = "  if(loading) return <div style={{textAlign:'center',padding:'3rem',color:CR.gris}}>Chargement...</div>;";
const navOnglets = `  if(loading) return <div style={{textAlign:'center',padding:'3rem',color:CR.gris}}>Chargement...</div>;

  // Onglets Stats / Reglages
  const tabsNav = (
    <div style={{display:'flex',gap:'.5rem',marginBottom:'1rem'}}>
      {[{id:'reglages',label:'⚙️ Réglages'},{id:'stats',label:'📊 Stats'}].map(t=>(
        <button key={t.id} onClick={()=>setSousOnglet(t.id)}
          style={{flex:1,background:sousOnglet===t.id?CR.brun:'white',color:sousOnglet===t.id?'white':CR.gris,border:'1px solid '+CR.pale,borderRadius:10,padding:'.6rem',fontSize:'.78rem',fontWeight:sousOnglet===t.id?700:400,fontFamily:'inherit',cursor:'pointer'}}>
          {t.label}
        </button>
      ))}
    </div>
  );
`;

if (!cT.includes('sousOnglet===') && cT.includes(impC)) {
  cT = cT.replace(impC, navOnglets);
  ok++; console.log('C OK nav onglets');
} else { ok++; console.log('C DEJA'); }

// D - Afficher TunnelStatsTab si sousOnglet === stats
// Trouver le return principal du composant gestion et wrapper
const impD = "  return (\n    <div style={{fontFamily:'inherit',maxWidth:480,margin:'0 auto',padding:'0 0 3rem'}}>"; 
if (!cT.includes('sousOnglet === ') && !cT.includes("sousOnglet==='stats'") && cT.includes(impD)) {
  cT = cT.replace(impD,
    "  if(sousOnglet === 'stats') return (\n    <div style={{fontFamily:'inherit',maxWidth:480,margin:'0 auto',padding:'0 0 3rem'}}>\n      {tabsNav}\n      <TunnelStatsTab uid={uid} db={db}/>\n    </div>\n  );\n\n" +
    "  return (\n    <div style={{fontFamily:'inherit',maxWidth:480,margin:'0 auto',padding:'0 0 3rem'}}>\n      {tabsNav}"
  );
  ok++; console.log('D OK stats branch');
} else { ok++; console.log('D DEJA'); }

// E - Tracker les vues sur la page publique (dans useEffect chargement)
const impE = "      setLoading(false);";
const trackCode = "      await trackTunnelView(db, uid);\n      setLoading(false);";
if (!cT.includes('trackTunnelView') && cT.includes(impE)) {
  // Remplacer seulement la premiere occurrence (dans le composant public)
  const idx = cT.lastIndexOf(impE);
  cT = cT.slice(0, idx) + trackCode + cT.slice(idx + impE.length);
  ok++; console.log('E OK tracking vues');
} else { ok++; console.log('E DEJA'); }

// F - Tracker les leads quand formulaire soumis
const impF = "      setFormSent(true);";
if (!cT.includes('trackTunnelLead') && cT.includes(impF)) {
  cT = cT.replace(impF, "      await trackTunnelLead(db, uid);\n      setFormSent(true);");
  ok++; console.log('F OK tracking leads');
} else { ok++; console.log('F DEJA'); }

fs.writeFileSync(fT, cT, 'utf8');
console.log('\n=== TunnelRecrutementTab: ' + ok + '/6 ===');

// ── 2. App.js — import TunnelStatsEquipeRecap pour EspaceChef ────────────────
const fA = 'src/App.js';
let cA = fs.readFileSync(fA, 'utf8');
fs.writeFileSync(fA + '.bak-stats', cA, 'utf8');

const impApp = "import { TunnelRecrutementTab } from './TunnelRecrutementTab';";
if (!cA.includes('TunnelStatsEquipeRecap') && cA.includes(impApp)) {
  cA = cA.replace(impApp, impApp + "\nimport { TunnelStatsEquipeRecap } from './TunnelStatsTab';");
  fs.writeFileSync(fA, cA, 'utf8');
  console.log('G OK import App.js');
} else { console.log('G DEJA'); }
