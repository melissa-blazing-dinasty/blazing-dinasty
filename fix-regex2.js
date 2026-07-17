const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let lines = fs.readFileSync(f, 'utf8').split('\n');

lines = lines.map(l => {
  if (l.includes('path.match(/^/')) {
    return l.replace('path.match(/^/(r|b|d|t)/(.+)$/)', "path.match(/^\\/(r|b|d|t)\\/(.+)$/)");
  }
  return l;
});

fs.writeFileSync(f, lines.join('\n'), 'utf8');
const check = lines.join('\n').includes("path.match(/^\\/(r|b|d|t)\\/");
console.log('OK: ' + (check ? 'OK' : 'ECHEC'));