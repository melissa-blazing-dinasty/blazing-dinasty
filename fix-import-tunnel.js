const fs = require('fs');
const f = 'src/App.js';
let c = fs.readFileSync(f, 'utf8');
const anc = "import { AssistanteIATab } from './AssistanteIATab';";
if (c.includes('TunnelRecrutementTab')) {
  console.log('DEJA FAIT');
} else if (c.includes(anc)) {
  c = c.replace(anc, anc + "\nimport { TunnelRecrutementTab } from './TunnelRecrutementTab';");
  fs.writeFileSync(f, c);
  console.log('OK - import ajoute');
} else {
  console.log('ECHEC');
}