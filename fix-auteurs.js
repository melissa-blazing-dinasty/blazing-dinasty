const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

// Trouver et remplacer les auteurs par position
// On cherche les patterns autour des textes qu'on a deja changes

// Eva - auteur apres le texte d'Eva
c = c.replace(
  /auteur:'[^']*3 mois[^']*'/,
  "auteur:'Eva, dans l\\'equipe Blazing Dynasty'"
);

// Christelle - auteur apres le texte de Christelle  
c = c.replace(
  /auteur:'[^']*6 mois[^']*'/,
  "auteur:'Christelle, dans l\\'equipe Blazing Dynasty'"
);

// Oceane - auteur apres le texte d'Oceane
c = c.replace(
  /auteur:'[^']*1 an[^']*'/,
  "auteur:'Oceane, dans l\\'equipe Blazing Dynasty'"
);

// Revenus - Marie -> Fanny, montant 420 -> 957
c = c.replace(/prenom:'Marie'/, "prenom:'Fanny'");
c = c.replace(/montant:'420'/, "montant:'957'");

// Julie -> Melissa
c = c.replace(/prenom:'Julie'/, "prenom:'Melissa'");
c = c.replace(/metier:'Maman au foyer'/, "metier:'Maman au foyer a temps plein'");
c = c.replace(/montant:'320'/, "montant:'3000'");

// Sarah -> Garde salariee
c = c.replace(/metier:'Salari[^']*'/, "metier:'Garde d enfants salariee'");

fs.writeFileSync(f, c, 'utf8');

// Verifier
const ok = c.includes('Fanny') && c.includes('Melissa') && c.includes('3000');
console.log('Revenus: ' + (ok ? 'OK' : 'ECHEC'));

const ok2 = c.includes('Eva') || c.includes('Christelle') || c.includes('Oceane');
console.log('Auteurs: ' + (ok2 ? 'OK' : 'ECHEC - verifions'));

// Afficher les auteurs trouves
const matches = c.match(/auteur:'[^']*'/g);
if (matches) matches.forEach(m => console.log('  ' + m));