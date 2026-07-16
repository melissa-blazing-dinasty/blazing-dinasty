const fs = require('fs');
const f = 'src/App.js';
let c = fs.readFileSync(f, 'utf8');
fs.writeFileSync(f + '.bak-nav2', c, 'utf8');
let ok = 0;

const p1 = '{id:"boutique",label:"\uD83D\uDECD\uFE0F Boutique"},';
if (c.includes('tunnel-recrutement')) { ok++; console.log('A DEJA'); }
else if (c.includes(p1)) {
  c = c.replace(p1, p1 + '\n    {id:"tunnel-recrutement",label:"\uD83C\uDFAF Tunnel Recrutement"},');
  ok++; console.log('A OK nav');
} else console.log('A ECHEC - nav introuvable');

const p2 = '{tab==="boiteaoutils"&&outilsSousOnglet==="boutique"&&<LinkBioTab uid={userId} userName={name} initialSection="bout '{tab==="boiteaoutils"&&outilsSousOnglet==="boutique"&&<LinkBioTab key="boutique" uid={userId} userName={name} initialSection="boutique"/>}';
if (c.includes('TunnelRecrutementTab uid=')) { ok++; console.log('B DEJA'); }
else if (c.includes(p2)) {
  c = c.replace(p2, p2 + '\n        {tab==="boiteaoutils"&&outilsSousOnglet==="tunnel-recrutement"&&<TunnelRecrutementTab uid={userId} userName={name} db={db}/>}');
  ok++; console.log('B OK rendu');
} else console.log('B ECHEC - rendu introuvable');

if (ok === 2) {
  fs.writeFileSync(f, c, 'utf8');
  console.log('=== TOUT BON (2/2) sauvegarde UTF-8 ===');
} else {
  console.log('=== ' + ok + '/2 RIEN sauvegarde ===');
}