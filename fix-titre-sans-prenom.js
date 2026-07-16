const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(
  "cfg.titreAccroche || ('Rejoins l\\'equipe de ' + (prenom || 'notre equipe') + ' !')",
  "cfg.titreAccroche || 'Rejoins notre equipe Blazing Dynasty !'"
);

fs.writeFileSync(f, c, 'utf8');
console.log('OK');