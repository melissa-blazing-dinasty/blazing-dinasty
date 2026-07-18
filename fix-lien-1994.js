const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let lines = fs.readFileSync(f, 'utf8').split('\n');

lines = lines.map((l, i) => {
  if (i === 1993 && l.includes('distributrice=')) {
    console.log('Ligne 1994 trouvee - correction');
    return l.replace(
      '`https://blazing-dinasty-1fad9.web.app?diag=${diagType}&uid=${uid}&distributrice=${encodeURIComponent(userName)}&client=${encodeURIComponent(nomClient||"")}`',
      '`https://blazing-dinasty-1fad9.web.app/d/${uid}?diag=${diagType}&client=${encodeURIComponent(nomClient||"")}`'
    );
  }
  return l;
});

const c = lines.join('\n');
fs.writeFileSync(f, c, 'utf8');
const check = !c.includes('distributrice=');
console.log('distributrice= supprime: ' + (check ? 'OK' : 'ECHEC - reste ailleurs'));