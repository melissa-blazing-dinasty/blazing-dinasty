const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let lines = fs.readFileSync(f, 'utf8').split('\n');

lines = lines.map((l, i) => {
  if (i === 1994) return l.replace('let bitlyToken = \'\';', 'let bitlyToken2 = \'\';');
  if (i === 1995) return l.replace('bitlyToken = snap.data().bitlyToken||\'\'', 'bitlyToken2 = snap.data().bitlyToken||\'\'');
  if (i === 1996) return l.replace('raccourcirLien(lienBase, bitlyToken)', 'raccourcirLien(lienBase, bitlyToken2)');
  return l;
});

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('OK');