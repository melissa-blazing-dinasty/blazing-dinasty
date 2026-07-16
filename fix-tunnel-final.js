const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let lines = fs.readFileSync(f, 'utf8').split('\n');
fs.writeFileSync(f + '.bak2', lines.join('\n'), 'utf8');

lines = lines.map(l => {
  // Revenus - Fanny
  if (l.includes("prenom:'Marie'")) return l.replace("prenom:'Marie'", "prenom:'Fanny'");
  if (l.includes("montant:'420'")) return l.replace("montant:'420'", "montant:'957'");
  // Revenus - Melissa
  if (l.includes("prenom:'Julie'")) return l.replace("prenom:'Julie'", "prenom:'Melissa'");
  if (l.includes("montant:'320'")) return l.replace("montant:'320'", "montant:'3000'");
  if (l.includes("metier:'Maman au foyer'")) return l.replace("metier:'Maman au foyer'", "metier:'Maman au foyer a temps plein'");
  // Revenus - Garde
  if (l.includes("metier:'Salari")) return l.replace(/metier:'Salari[^']*'/, "metier:'Garde d enfants salariee'");

  // Quali - Eva (remplacer toute la ligne)
  if (l.includes("aurais jamais pens") && l.includes("boutique en ligne")) {
    return "  {texte:\"Depuis que j'ai rejoint l'equipe, j'ai retrouve une vraie confiance en moi. Grace a l'application et aux formations, j'ai progresse bien plus vite que je ne l'aurais imagine.\", auteur:\"Eva, dans l'equipe Blazing Dynasty\"},";
  }
  // Quali - Christelle
  if (l.includes("academie") && l.includes("tout appris")) {
    return "  {texte:\"L'application, l'equipe, l'accompagnement - tout est la pour t'aider a avancer. Je me sens vraiment professionnelle dans ma facon de travailler.\", auteur:\"Christelle, dans l'equipe Blazing Dynasty\"},";
  }
  // Quali - Oceane
  if (l.includes("boutique gratuite") && l.includes("Mihi elle est payante")) {
    return "  {texte:\"Ce qui m'a le plus surprise c'est l'esprit d'equipe. Je ne suis jamais seule, on avance ensemble, on se soutient - et ca fait toute la difference.\", auteur:\"Oceane, dans l'equipe Blazing Dynasty\"},";
  }
  return l;
});

fs.writeFileSync(f, lines.join('\n'), 'utf8');

// Verif
const c = lines.join('\n');
console.log('Fanny: ' + (c.includes('Fanny') ? 'OK' : 'ECHEC'));
console.log('Melissa 3000: ' + (c.includes("3000") ? 'OK' : 'ECHEC'));
console.log('Eva: ' + (c.includes('Eva') ? 'OK' : 'ECHEC'));
console.log('Christelle: ' + (c.includes('Christelle') ? 'OK' : 'ECHEC'));
console.log('Oceane: ' + (c.includes('Oceane') ? 'OK' : 'ECHEC'));