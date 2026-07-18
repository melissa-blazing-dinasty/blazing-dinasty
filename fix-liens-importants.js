const fs = require('fs');
const f = 'src/App.js';
let c = fs.readFileSync(f, 'utf8');
let ok = 0;

// 1. Supprimer de OUTILS_SOUS_ONGLETS dashboard
c = c.replace(
  '\n    {id:"liensimportants",label:"\uD83D\uDD17 Liens importants"},',
  ''
);
ok++; console.log('1 OK - retire du dashboard');

// 2. Ajouter dans OUTILS_SOUS_ONGLETS boiteaoutils
const ancreOutils = '{id:"ebooks",label:"\uD83D\uDCDA Ebooks"},';
if (c.includes('liensimportants",label:"\uD83D\uDD17 Liens importants"') && c.includes(ancreOutils)) {
  console.log('2 DEJA dans outils');
} else if (c.includes(ancreOutils)) {
  c = c.replace(ancreOutils, ancreOutils + '\n    {id:"liensimportants",label:"\uD83D\uDD17 Liens importants"},');
  ok++; console.log('2 OK - ajoute dans boiteaoutils');
} else console.log('2 ECHEC');

// 3. Deplacer le rendu conditionnel
c = c.replace(
  '{tab==="dashboard"&&dashboardSousOnglet==="liensimportants"&&<LiensImportantsTab uid={userId}/>}',
  ''
);
ok++; console.log('3 OK - retire rendu dashboard');

// 4. Ajouter rendu dans boiteaoutils
const ancreRendu = '{tab==="boiteaoutils"&&outilsSousOnglet==="ebooks"&&<EbooksTab/>}';
if (c.includes('outilsSousOnglet==="liensimportants"')) {
  console.log('4 DEJA');
} else if (c.includes(ancreRendu)) {
  c = c.replace(ancreRendu, ancreRendu + '\n        {tab==="boiteaoutils"&&outilsSousOnglet==="liensimportants"&&<LiensImportantsTab uid={userId}/>}');
  ok++; console.log('4 OK - rendu dans boiteaoutils');
} else console.log('4 ECHEC');

fs.writeFileSync(f, c, 'utf8');
console.log('=== ' + ok + '/4 ===');