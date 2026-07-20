const fs = require('fs');
const f = 'src/App.js';
let lines = fs.readFileSync(f, 'utf8').split('\n');

// Ligne 6400 - changer revealed a false par defaut
lines[6399] = "  const[revealed,setRevealed]=useState(false);";

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('OK: ' + lines[6399]);