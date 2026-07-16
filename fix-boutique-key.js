const fs = require('fs');
const f = 'src/App.js';
let c = fs.readFileSync(f, 'utf8');
fs.writeFileSync(f + '.bak-key', c);

const anc = '{tab==="boiteaoutils"&&outilsSousOnglet==="boutique"&&<LinkBioTab uid={userId} userName={name} initialSection="boutique"/>}';
const repl = '{tab==="boiteaoutils"&&outilsSousOnglet==="boutique"&&<LinkBioTab key="boutique" uid={userId} userName={name} initialSection="boutique"/>}';

if (c.includes('key="boutique"')) {
  console.log('DEJA FAIT');
} else if (c.includes(anc)) {
  c = c.replace(anc, repl);
  fs.writeFileSync(f, c);
  console.log('OK - key ajoutee, fichier sauvegarde');
} else {
  console.log('ECHEC - ancre introuvable');
}