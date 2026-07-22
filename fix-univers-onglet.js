const fs = require('fs');
const f = 'src/App.js';
let c = fs.readFileSync(f, 'utf8');
let ok = 0;

// 1. Imports
const ancreImport = "import { TunnelRecrutementTab } from './TunnelRecrutementTab';";
if (!c.includes('RoueEquilibre') && c.includes(ancreImport)) {
  c = c.replace(ancreImport, ancreImport +
    "\nimport RoueEquilibre from './RoueEquilibre';" +
    "\nimport TestDISC from './TestDISC';" +
    "\nimport TestValeurs from './TestValeurs';" +
    "\nimport TestStyleEntrepreneur from './TestStyleEntrepreneur';"
  );
  ok++; console.log('1 OK imports');
} else { ok++; console.log('1 SKIP'); }

// 2. Onglet menu
const ancreOnglets = '{id:"tunnel-recrutement",label:"\uD83C\uDFAF Tunnel Recrutement"},';
if (!c.includes('monunivers') && c.includes(ancreOnglets)) {
  c = c.replace(ancreOnglets, ancreOnglets + '\n    {id:"monunivers",label:"\uD83C\uDF1F Mon Univers"},');
  ok++; console.log('2 OK onglet menu');
} else { ok++; console.log('2 SKIP'); }

// 3. Rendu
const ancreRendu = 'outilsSousOnglet==="liensimportants"&&<LiensImportantsTab uid={userId}/>';
if (!c.includes('monunivers') && c.includes(ancreRendu)) {
  c = c.replace(ancreRendu, ancreRendu +
    '\n        {tab==="boiteaoutils"&&outilsSousOnglet==="monunivers"&&<MonUniversTab uid={userId}/>}'
  );
  ok++; console.log('3 OK rendu');
} else { ok++; console.log('3 SKIP'); }

fs.writeFileSync(f, c, 'utf8');
console.log('=== ' + ok + '/3 ===');
