const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let lines = fs.readFileSync(f, 'utf8').split('\n');

lines = lines.map(l => {
  if (l.includes('Boutique en ligne gratuite')) {
    return l.replace("icon:'🛍️', titre:'Boutique en ligne gratuite'", "icon:'📱', titre:'Application gratuite'");
  }
  return l;
});

fs.writeFileSync(f, lines.join('\n'), 'utf8');
const check = lines.join('\n').includes('Application gratuite');
console.log('OK: ' + (check ? 'OK' : 'ECHEC'));