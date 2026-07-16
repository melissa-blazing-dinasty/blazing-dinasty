const fs = require('fs');
const f = 'src/App.js';
let c = fs.readFileSync(f, 'utf8');

const ancre = "import { TunnelRecrutementTab } from './TunnelRecrutementTab';";
if (c.includes('TokensCadeauxTab') && c.includes("from './TokensCadeauxTab'")) {
  console.log('DEJA FAIT');
} else if (c.includes(ancre)) {
  c = c.replace(ancre, ancre + "\nimport { TokensCadeauxTab } from './TokensCadeauxTab';");
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK');
} else {
  console.log('ECHEC');
}