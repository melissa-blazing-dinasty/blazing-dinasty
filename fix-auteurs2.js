const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(/auteur:'Eva, dans l\\'[^']*'/g, 'auteur:"Eva, dans l\'equipe Blazing Dynasty"');
c = c.replace(/auteur:'Christelle, dans l\\'[^']*'/g, 'auteur:"Christelle, dans l\'equipe Blazing Dynasty"');
c = c.replace(/auteur:'Oceane, dans l\\'[^']*'/g, 'auteur:"Oceane, dans l\'equipe Blazing Dynasty"');

fs.writeFileSync(f, c, 'utf8');

const matches = c.match(/auteur:"[^"]*"/g) || c.match(/auteur:'[^']*'/g);
if (matches) matches.forEach(m => console.log(m));
else console.log('ECHEC');