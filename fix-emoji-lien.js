const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let lines = fs.readFileSync(f, 'utf8').split('\n');
lines[166] = '      + lienCourt + "\\n\\n"';
fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('OK');