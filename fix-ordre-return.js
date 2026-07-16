const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let lines = fs.readFileSync(f, 'utf8').split('\n');

// Trouver les lignes cles
let idxStats = -1, idxLoading = -1;
for(let i=0; i<lines.length; i++) {
  if(lines[i].includes("sousOnglet === 'stats') return") && idxStats===-1) idxStats = i;
  if(lines[i].includes('if (loading) return') && idxLoading===-1) idxLoading = i;
}
console.log('Stats return: ligne ' + (idxStats+1));
console.log('Loading return: ligne ' + (idxLoading+1));

if(idxStats < idxLoading) {
  // Extraire le bloc stats (5 lignes)
  const blocStats = lines.splice(idxStats, 7);
  // Recalculer idxLoading apres suppression
  idxLoading = idxLoading - 7;
  // Inserer apres loading
  lines.splice(idxLoading + 1, 0, ...blocStats);
  fs.writeFileSync(f, lines.join('\n'), 'utf8');
  console.log('OK - bloc stats deplace apres loading');
} else {
  console.log('DEJA BON');
}