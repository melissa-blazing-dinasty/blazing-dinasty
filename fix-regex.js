const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(
  'const shortMatch = path.match(/^/(r|b|d|t)/(.+)$/);',
  'const shortMatch = path.match(/^\\/(r|b|d|t)\\/(.+)$/);'
);

fs.writeFileSync(f, c, 'utf8');
console.log('OK: ' + (c.includes('/^\\/(r|b|d|t)\\/') ? 'OK' : 'ECHEC'));