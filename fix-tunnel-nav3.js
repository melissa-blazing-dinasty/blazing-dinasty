const fs = require('fs');
const f = 'src/App.js';
let c = fs.readFileSync(f, 'utf8');
fs.writeFileSync(f + '.bak-nav3', c, 'utf8');

const ancre = 'outilsSousOnglet==="boutique"&&<LinkBioTab uid={userId}';
const idx = c.indexOf(ancre);
if (idx === -1) { console.log('ECHEC ancre introuvable'); process.exit(1); }

const finLigne = c.indexOf('\n', idx);
const insertion = '\n        {tab==="boiteaoutils"&&outilsSousOnglet==="tunnel-recrutement"&&<TunnelRecrutementTab uid={userId} userName={name} db={db}/>}';

if (c.includes('tunnel-recrutement')) {
  console.log('DEJA FAIT');
} else {
  c = c.slice(0, finLigne) + insertion + c.slice(finLigne);
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK - tunnel recrutement ajoute');
}