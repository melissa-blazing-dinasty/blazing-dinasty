const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(
  '  const pathname = window.location.pathname;\n  const parts = pathname.split',
  '  const shortPathname = window.location.pathname;\n  const parts = shortPathname.split'
);

fs.writeFileSync(f, c, 'utf8');
console.log('OK');