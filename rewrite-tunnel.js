const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let lines = fs.readFileSync(f, 'utf8').split('\n');

// Remplacer les 3 lignes de temoignages qualitatifs
let found = 0;
lines = lines.map(l => {
  if (l.includes('TEMOIGNAGES_QUALI_DEFAULT') && l.includes('[')) return l;
  if (found === 0 && l.includes('{texte:') && (l.includes('boutique en ligne') || l.includes('confiance en moi') || l.includes('j\u2019ai rejoint'))) {
    found++;
    return '  {texte:"Depuis que j\'ai rejoint l\'equipe, j\'ai retrouve une vraie confiance en moi. Grace a l\'application et aux formations, j\'ai progresse bien plus vite.", auteur:"Eva, dans l\'equipe Blazing Dynasty"},';
  }
  if (found === 1 && l.includes('{texte:')) {
    found++;
    return '  {texte:"L\'application, l\'equipe, l\'accompagnement - tout est la pour avancer. Je me sens vraiment professionnelle dans ma facon de travailler.", auteur:"Christelle, dans l\'equipe Blazing Dynasty"},';
  }
  if (found === 2 && l.includes('{texte:')) {
    found++;
    return '  {texte:"Ce qui m\'a le plus surprise c\'est l\'esprit d\'equipe. On avance ensemble, on se soutient - ca fait toute la difference.", auteur:"Oceane, dans l\'equipe Blazing Dynasty"},';
  }
  return l;
});

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('Remplace: ' + found + ' temoignages (doit etre 3)');

// Verif
const c = fs.readFileSync(f, 'utf8');
console.log('Eva: ' + (c.includes('Eva') ? 'OK' : 'ECHEC'));
console.log('Christelle: ' + (c.includes('Christelle') ? 'OK' : 'ECHEC'));
console.log('Oceane: ' + (c.includes('Oceane') ? 'OK' : 'ECHEC'));