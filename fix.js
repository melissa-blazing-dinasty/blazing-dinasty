const fs = require('fs');
let c = fs.readFileSync('src/App.js', 'utf8');

// Chercher toutes les occurrences de blocage/recrue bloquée
const idx = c.indexOf('Recru. bloquée');
console.log('Trouvé:', idx > -1 ? 'OUI' : 'NON');
if(idx > -1) console.log(JSON.stringify(c.substring(idx-50, idx+50)));

c = c.replace(/Diagnostic Recru\. bloquée/g, 'Diagnostic Maman Entrepreneur');
c = c.replace(/🔓 Diagnostic/g, '👩‍👧 Diagnostic');

fs.writeFileSync('src/App.js', c, 'utf8');
console.log('Maman Entrepreneur:', c.includes('Maman Entrepreneur') ? 'OK' : 'NON');