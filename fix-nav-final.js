const fs = require('fs');
const f = 'src/App.js';
let c = fs.readFileSync(f, 'utf8');
fs.writeFileSync(f + '.bak-nav-final', c, 'utf8');

const ancre = '{id:"ebooks",label:"\uD83D\uDCDA Ebooks"},';
if (c.includes('tunnel-recrutement",label:')) {
  console.log('DEJA FAIT');
} else if (c.includes(ancre)) {
  c = c.replace(ancre, ancre + '\n    {id:"tunnel-recrutement",label:"\uD83C\uDFAF Tunnel Recrutement"},');
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK - onglet ajoute');
} else {
  console.log('ECHEC - ancre introuvable: ' + ancre.substring(0,30));
}