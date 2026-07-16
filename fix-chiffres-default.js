const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

c = c.replace('nbPersonnesRejointes:2, nbPlacesRestantes:3', 'nbPersonnesRejointes:0, nbPlacesRestantes:0');
c = c.replace('cfg.nbPersonnesRejointes||2', 'cfg.nbPersonnesRejointes||0');
c = c.replace('cfg.nbPlacesRestantes||3', 'cfg.nbPlacesRestantes||0');

fs.writeFileSync(f, c, 'utf8');
console.log('OK - chiffres default mis a 0');