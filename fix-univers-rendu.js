const fs = require('fs');
const f = 'src/App.js';
let lines = fs.readFileSync(f, 'utf8').split('\n');

lines[3455] = lines[3455] + '\n        {tab==="boiteaoutils"&&outilsSousOnglet==="monunivers"&&<MonUniversTab uid={userId}/>}';

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('OK');