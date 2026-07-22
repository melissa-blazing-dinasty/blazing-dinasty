const fs = require('fs');
const f = 'src/App.js';
let c = fs.readFileSync(f, 'utf8');

// 1. Ajouter import DreamBoardWidget
const ancreImport = "import RoueEquilibre from './RoueEquilibre';";
if (!c.includes('DreamBoardWidget') && c.includes(ancreImport)) {
  c = c.replace(ancreImport, ancreImport + "\nimport { DreamBoardWidget } from './DreamBoardTab';");
  console.log('1 OK import');
} else console.log('1 SKIP');

// 2. Ajouter onglet dreamboard dans MonUniversTab
c = c.replace(
  "{id:'style', label:'Style'},",
  "{id:'style', label:'Style'},\n    {id:'dream', label:'Dream Board'},"
);

// 3. Ajouter rendu dreamboard
c = c.replace(
  "{onglet==='style'&&<TestStyleEntrepreneur/>}",
  "{onglet==='style'&&<TestStyleEntrepreneur/>}\n      {onglet==='dream'&&<DreamBoardWidget uid={uid}/>}"
);

fs.writeFileSync(f, c, 'utf8');
console.log('OK - Dream Board ajoute');