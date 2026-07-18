const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let lines = fs.readFileSync(f, 'utf8').split('\n');

lines = lines.map((l, i) => {
  if (i === 1975 && l.includes('copierLienDirect') && l.includes('))}')) {
    return l.replace('))}', ')');
  }
  return l;
});

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('OK');