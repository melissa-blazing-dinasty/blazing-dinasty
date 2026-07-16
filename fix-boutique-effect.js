const fs = require('fs');
const f = 'src/LinkBioTab.js';
let c = fs.readFileSync(f, 'utf8');
fs.writeFileSync(f + '.bak-effect', c);

const anc = 'const[activeSection,setActiveSection]=useState(initialSection||"theme");';
const repl = anc + '\n  useEffect(()=>{ if(initialSection) setActiveSection(initialSection); },[initialSection]);';

if (c.includes('setActiveSection(initialSection)')) {
  console.log('DEJA FAIT');
} else if (c.includes(anc)) {
  c = c.replace(anc, repl);
  fs.writeFileSync(f, c);
  console.log('OK - useEffect ajoute, fichier sauvegarde');
} else {
  console.log('ECHEC - ancre introuvable');
}