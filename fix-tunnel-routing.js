// fix-tunnel-routing.js
// Ajoute le routing public ?recrutement= dans DiagnosticsTab.js
// node fix-tunnel-routing.js

const fs = require('fs');
let ok = 0;

// ── DiagnosticsTab.js ────────────────────────────────────────────────────────
const fD = 'src/DiagnosticsTab.js';
let cD = fs.readFileSync(fD, 'utf8');
fs.writeFileSync(fD + '.bak-tunnel', cD, 'utf8');

// A - import TunnelRecrutementPublic
const impA = "import { TokensCadeauxPopup } from './TokensCadeauxTab';";
if (cD.includes('TunnelRecrutementPublic')) { ok++; console.log('A DEJA'); }
else if (cD.includes(impA)) {
  cD = cD.replace(impA, impA + "\nimport { TunnelRecrutementPublic } from './TunnelRecrutementTab';");
  ok++; console.log('A OK import');
} else console.log('A ECHEC');

// B - routing ?recrutement= dans le Root
const pB = "if(bioSlug) return <LinkBioPublicPage slug={bioSlug}/>;";
if (cD.includes('recrutementSlug')) { ok++; console.log('B DEJA'); }
else if (cD.includes(pB)) {
  cD = cD.replace(pB,
    "const recrutementSlug=p.get('recrutement');\n" +
    "  if(recrutementSlug) return <TunnelRecrutementPublic slug={recrutementSlug} db={db}/>;\n  " +
    pB
  );
  ok++; console.log('B OK routing');
} else console.log('B ECHEC');

if (ok === 2) {
  fs.writeFileSync(fD, cD, 'utf8');
  console.log('=== DiagnosticsTab TOUT BON (2/2) ===');
} else {
  console.log('=== ' + ok + '/2 RIEN sauvegarde ===');
}
