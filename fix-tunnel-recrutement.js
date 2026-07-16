// fix-tunnel-recrutement.js
// Ajoute l'onglet Tunnel de recrutement dans Ma Boite a Outils
// node fix-tunnel-recrutement.js

const fs = require('fs');
const f = 'src/App.js';
let c = fs.readFileSync(f, 'utf8');
fs.writeFileSync(f + '.bak-tunnel', c);
let ok = 0;

// A - ajouter l'onglet dans OUTILS_SOUS_ONGLETS
const p1 = '{id:"boutique",label:"\uD83D\uDECD\uFE0F Boutique"},';
if (c.includes('tunnel-recrutement')) { ok++; console.log('A DEJA'); }
else if (c.includes(p1)) {
  c = c.replace(p1, p1 + '\n    {id:"tunnel-recrutement",label:"\uD83C\uDFAF Tunnel Recrutement"},');
  ok++; console.log('A OK onglet nav');
} else console.log('A ECHEC');

// B - ajouter le rendu conditionnel
const p2 = '{tab==="boiteaoutils"&&outilsSousOnglet==="boutique"&&<LinkBioTab key="boutique" uid={userId} userName={name} initialSection="boutique"/>}';
if (c.includes('tunnel-recrutement"&&<TunnelRecrutementTab')) { ok++; console.log('B DEJA'); }
else if (c.includes(p2)) {
  c = c.replace(p2, p2 + '\n        {tab==="boiteaoutils"&&outilsSousOnglet==="tunnel-recrutement"&&<TunnelRecrutementTab uid={userId} userName={name} db={db}/>}');
  ok++; console.log('B OK rendu');
} else console.log('B ECHEC');

if (ok === 2) {
  fs.writeFileSync(f, c);
  console.log('=== TOUT BON (2/2) sauvegarde ===');
} else {
  console.log('=== ' + ok + '/2 - RIEN sauvegarde ===');
}
