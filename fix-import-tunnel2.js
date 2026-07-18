const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let c = fs.readFileSync(f, 'utf8');

const ancre = "import { TokensCadeauxPopup } from './TokensCadeauxTab';";
if (c.includes('TunnelRecrutementPublic') && c.includes("from './TunnelRecrutementTab'")) {
  console.log('DEJA');
} else if (c.includes(ancre)) {
  c = c.replace(ancre, ancre + "\nimport { TunnelRecrutementPublic } from './TunnelRecrutementTab';");
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK');
} else {
  console.log('ECHEC');
}