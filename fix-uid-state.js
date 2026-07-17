const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

// 1. Ajouter state uidResolu
const ancreState = "  const [themeId, setThemeId] = useState('rose_gold');";
if (!c.includes('uidResolu') && c.includes(ancreState)) {
  c = c.replace(ancreState, ancreState + "\n  const [uidResolu, setUidResolu] = useState('');");
  console.log('1 OK state uidResolu');
} else console.log('1 SKIP');

// 2. Sauvegarder l uid dans le state apres resolution
const ancreUid = "        const snapLink = await getDoc(doc(db, 'linkbio', uid));";
if (!c.includes('setUidResolu(uid)') && c.includes(ancreUid)) {
  c = c.replace(ancreUid, "        setUidResolu(uid);\n        const snapLink = await getDoc(doc(db, 'linkbio', uid));");
  console.log('2 OK setUidResolu');
} else console.log('2 SKIP');

// 3. Remplacer uid par uidResolu dans trackVue et trackLead
c = c.replace(
  'if (!preview) await trackVue(db, uid).catch(()=>{});',
  'if (!preview && uid) await trackVue(db, uid).catch(()=>{});'
);
c = c.replace(
  'await trackLead(db, uid).catch(()=>{}); setFormSent(true);',
  'await trackLead(db, uidResolu || slug).catch(()=>{}); setFormSent(true);'
);
console.log('3 OK trackVue/trackLead avec uid local');

fs.writeFileSync(f, c, 'utf8');
console.log('=== OK ===');