const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(
  "icon:'\uD83D\uDECD\uFE0F',titre:'Boutique en ligne gratuite'",
  "icon:'\uD83D\uDCF1',titre:'Application gratuite'"
);

fs.writeFileSync(f, c, 'utf8');
console.log('OK: ' + (c.includes('Application gratuite') ? 'OK' : 'ECHEC'));