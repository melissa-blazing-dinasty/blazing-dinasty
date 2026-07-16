const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(/prenom\|\|'Melissa'/g, "prenom");
c = c.replace(/prenom\|\|'votre chef d equipe'/g, "prenom");
c = c.replace(/prenom\|\|"Melissa"/g, "prenom");

fs.writeFileSync(f, c, 'utf8');

const check = !c.includes("'Melissa'") && !c.includes('"Melissa"');
console.log('Melissa supprime: ' + (check ? 'OK' : 'ECHEC'));