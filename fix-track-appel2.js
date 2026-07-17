const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let lines = fs.readFileSync(f, 'utf8').split('\n');
let ok = 0;

// Trouver le setLoading(false) dans le composant public
// C'est celui qui est suivi de ]); et [slug, preview
let idxLoading = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].includes('setLoading(false);') && 
      lines[i+1] && lines[i+1].includes('})();') &&
      lines[i+2] && lines[i+2].includes('slug')) {
    idxLoading = i;
    break;
  }
}

if (idxLoading === -1) {
  console.log('ECHEC - setLoading introuvable');
} else {
  lines.splice(idxLoading, 0, "      if (!preview) await trackVue(db, uid).catch(()=>{});");
  fs.writeFileSync(f, lines.join('\n'), 'utf8');
  console.log('OK - trackVue appele ligne ' + idxLoading);
  ok++;
}

// Trouver setFormSent(true) et ajouter trackLead avant
const c2 = lines.join('\n');
if (!c2.includes('await trackLead') && c2.includes('setFormSent(true)')) {
  const newC = c2.replace('setFormSent(true);', 'await trackLead(db, uid).catch(()=>{}); setFormSent(true);');
  fs.writeFileSync(f, newC, 'utf8');
  console.log('OK - trackLead appele');
  ok++;
}

console.log('=== ' + ok + '/2 ===');