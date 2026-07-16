const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let lines = fs.readFileSync(f, 'utf8').split('\n');

lines = lines.map(l => {
  if (l.includes('auteur:"Eva,')) {
    return '  {texte:"Depuis que j\'ai rejoint l\'equipe, j\'ai retrouve une vraie confiance en moi. J\'ai enfin acces a des produits de qualite que je ne pouvais pas me permettre avant, et grace a l\'application et aux formations, j\'ai progresse bien plus vite que je ne l\'aurais imagine.", auteur:"Eva, dans l\'equipe Blazing Dynasty"},';
  }
  if (l.includes('auteur:"Christelle,')) {
    return '  {texte:"L\'application, l\'equipe, l\'accompagnement - tout est la pour t\'aider a avancer. Je me sens vraiment professionnelle dans ma facon de travailler, et je n\'aurais jamais pense dire ca un jour.", auteur:"Christelle, dans l\'equipe Blazing Dynasty"},';
  }
  if (l.includes('auteur:"Oceane,')) {
    return '  {texte:"Ce qui m\'a le plus surprise, c\'est l\'esprit d\'equipe. Je ne suis jamais seule, on avance ensemble, on se soutient - et ca fait toute la difference.", auteur:"Oceane, dans l\'equipe Blazing Dynasty"},';
  }
  return l;
});

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('OK - lignes corrigees');