const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

const ancre = "{notif && <div style={{ position: 'fixed'";
if (c.includes('{tabsNav}\n      ' + ancre)) {
  console.log('DEJA OK');
} else if (c.includes(ancre)) {
  c = c.replace(ancre, "{tabsNav}\n      " + ancre);
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK - tabsNav ajoute');
} else {
  console.log('ECHEC');
}