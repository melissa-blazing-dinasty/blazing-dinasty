const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');
fs.writeFileSync(f + '.bak-temo', c, 'utf8');

// Temoignages revenus
c = c.replace("prenom:'Marie'", "prenom:'Fanny'");
c = c.replace("metier:'Coiffeuse', heures:'6h/semaine', clientes:'12 clientes", "metier:'Coiffeuse', heures:'6h/semaine', clientes:'12 clientes");
c = c.replace("montant:'420'", "montant:'957'");
c = c.replace("prenom:'Julie'", "prenom:'Melissa'");
c = c.replace("metier:'Maman au foyer'", "metier:'Maman au foyer - a temps plein chez Mihi'");
c = c.replace("montant:'320'", "montant:'3000'");
c = c.replace("metier:'Salariée'", "metier:'Garde d enfants salariee'");
console.log('1 OK revenus');

// Temoignage 1 - Eva
const old1 = "Je n'aurais jamais pensé pouvoir avoir ma propre boutique en ligne. Aujourd'hui mes clientes commandent directement et je reçois une notification à chaque vente !";
const new1 = "Depuis que j'ai rejoint l'equipe, j'ai retrouve une vraie confiance en moi. J'ai enfin acces a des produits de qualite que je ne pouvais pas me permettre avant, et grace a l'application et aux formations, j'ai progresse bien plus vite que je ne l'aurais imagine.";
c = c.replace(old1, new1);
c = c.replace("Sarah, 3 mois dans l'équipe", "Eva, dans l'equipe Blazing Dynasty");
console.log('2 OK Eva');

// Temoignage 2 - Christelle
const old2 = "L'académie m'a tout appris. Les formations, les outils, l'accompagnement — je me sens vraiment professionnelle dans ma façon de travailler.";
const new2 = "L'application, l'equipe, l'accompagnement - tout est la pour t'aider a avancer. Je me sens vraiment professionnelle dans ma facon de travailler, et je n'aurais jamais pense dire ca un jour.";
c = c.replace(old2, new2);
c = c.replace("Léa, 6 mois dans l'équipe", "Christelle, dans l'equipe Blazing Dynasty");
console.log('3 OK Christelle');

// Temoignage 3 - Oceane
const old3 = "Ce qui m'a convaincue c'est la boutique gratuite. Chez Mihi elle est payante, ici elle est offerte et en plus elle est magnifique !";
const new3 = "Ce qui m'a le plus surprise, c'est l'esprit d'equipe. Je ne suis jamais seule, on avance ensemble, on se soutient - et ca fait toute la difference.";
c = c.replace(old3, new3);
c = c.replace("Marine, 1 an dans l'équipe", "Oceane, dans l'equipe Blazing Dynasty");
console.log('4 OK Oceane');

fs.writeFileSync(f, c, 'utf8');
console.log('=== Sauvegarde OK ===');