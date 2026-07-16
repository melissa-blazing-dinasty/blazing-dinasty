const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(
  "{prenom||'Melissa'} accompagne personnellement",
  "{prenom||'votre chef d equipe'} accompagne personnellement"
);

fs.writeFileSync(f, c, 'utf8');
console.log('OK');