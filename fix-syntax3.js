const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let lines = fs.readFileSync(f, 'utf8').split('\n');

// Ligne 1976 - supprimer le ) en trop a la fin
lines[1975] = lines[1975].replace('copierLienDirect(t.id, ""))', 'copierLienDirect(t.id, "")');

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('OK: ' + lines[1975].substring(0, 80));