const fs = require('fs');
const f = 'functions/index.js';
let lines = fs.readFileSync(f, 'utf8').split('\n');

lines = lines.map(l => {
  if (l.includes("Rejoins l'equipe de")) return l.replace("Rejoins l'equipe de", "Rejoins l equipe de");
  if (l.includes("Decouvre l'univers de")) return l.replace("Decouvre l'univers de", "Decouvre l univers de");
  return l;
});

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('OK');