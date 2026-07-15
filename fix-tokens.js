const fs = require('fs');
const f = 'src/App.js';
let c = fs.readFileSync(f, 'utf8');
fs.writeFileSync(f + '.bak2', c);

let n = 0;

const a1 = "import { AssistanteIATab } from './AssistanteIATab';";
if (c.includes(a1) && !c.includes('TokensCadeauxTab')) {
  c = c.replace(a1, a1 + "\nimport { TokensCadeauxTab } from './TokensCadeauxTab';");
  n++;
  console.log('1 OK - import');
} else console.log('1 ECHEC');

const a2 = '{id:"boutique",label:"🛍️ Boutique"},';
if (c.includes(a2)) {
  c = c.replace(a2, a2 + '\n    {id:"tokens",label:"🎁 Tokens cadeaux"},');
  n++;
  console.log('2 OK - onglet');
} else console.log('2 ECHEC');

const a3 = '{tab==="boiteaoutils"&&outilsSousOnglet==="ebooks"&&<EbooksTab/>}';
if (c.includes(a3)) {
  c = c.replace(a3, a3 + '\n        {tab==="boiteaoutils"&&outilsSousOnglet==="tokens"&&<TokensCadeauxTab uid={userId} db={db} prenom={name}/>}');
  n++;
  console.log('3 OK - affichage');
} else console.log('3 ECHEC');

if (n === 3) {
  fs.writeFileSync(f, c);
  console.log('=== TOUT EST BON, fichier sauvegarde ===');
} else {
  console.log('=== ' + n + '/3 seulement, RIEN sauvegarde ===');
}