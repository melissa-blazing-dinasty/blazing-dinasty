const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

// Corriger les doubles virgules
c = c.replace(/},,/g, '},');

// Corriger les lignes vides dans le tableau
c = c.replace('Dynasty"},\n\n\n]', 'Dynasty"},\n]');

fs.writeFileSync(f, c, 'utf8');

// Verifier
const lines = c.split('\n');
for(let i=58;i<66;i++) console.log((i+1)+': '+lines[i]);