const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let lines = fs.readFileSync(f, 'utf8').split('\n');

// Ligne 112 - format court /r/
lines[111] = "  const lienPublic = `${window.location.origin}/r/${slug}`;";
console.log('1 OK ligne 112');

// Lignes 168-169 - supprimer avertissement
lines[167] = '';
lines[168] = '';
console.log('2 OK lignes 168-169');

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('OK');