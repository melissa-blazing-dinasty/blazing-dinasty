const fs = require('fs');
const f = 'src/App.js';
let c = fs.readFileSync(f, 'utf8');
fs.writeFileSync(f + '.bak-utf8', c, 'utf8');

const anc = "import { AssistanteIATab } from './AssistanteIATab';";
if (c.includes('TunnelRecrutementTab')) {
  console.log('DEJA FAIT');
} else if (c.includes(anc)) {
  c = c.replace(anc, anc + "\nimport { TunnelRecrutementTab } from './TunnelRecrutementTab';");
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK - import ajoute en UTF-8');
} else {
  console.log('ECHEC - ancre introuvable');
}