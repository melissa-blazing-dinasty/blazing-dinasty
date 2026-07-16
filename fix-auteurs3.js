const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let lines = fs.readFileSync(f, 'utf8').split('\n');

lines = lines.map(l => {
  if (l.includes('TEMOIGNAGES_QUALI') || !l.includes('auteur:')) return l;
  if (l.includes('3 mois')) return l.replace(/auteur:[^}]+}/, 'auteur:"Eva, dans l\'equipe Blazing Dynasty"},');
  if (l.includes('6 mois')) return l.replace(/auteur:[^}]+}/, 'auteur:"Christelle, dans l\'equipe Blazing Dynasty"},');
  if (l.includes('1 an')) return l.replace(/auteur:[^}]+}/, 'auteur:"Oceane, dans l\'equipe Blazing Dynasty"},');
  return l;
});

fs.writeFileSync(f, lines.join('\n'), 'utf8');

const c = lines.join('\n');
console.log('Eva: ' + (c.includes('Eva') ? 'OK' : 'ECHEC'));
console.log('Christelle: ' + (c.includes('Christelle') ? 'OK' : 'ECHEC'));
console.log('Oceane: ' + (c.includes('Oceane') ? 'OK' : 'ECHEC'));