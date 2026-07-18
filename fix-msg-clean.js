const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let c = fs.readFileSync(f, 'utf8');

// 1. Supprimer la partie avertissement du message
c = c.replace(
  '"\\n\\n⚠️ Clique bien sur le lien ci-dessus\\n"' +
  '\n        +"(pas sur le premier apercu qui apparait)\\n\\n"',
  '"\\n\\n"'
);

// 2. Supprimer le champ intitule et rendre le bouton direct
// Trouver showLabelInput et supprimer l'affichage conditionnel
const ancreLabel = '{showLabelInput[t.id]&&(<div style={{marginTop:".5rem",background:"#FAF7F2",borderRadius:9,padding:".6rem .75r';
const idxLabel = c.indexOf(ancreLabel);
if (idxLabel !== -1) {
  // Trouver la fin du bloc
  let depth = 0;
  let i = idxLabel;
  let found = false;
  while (i < c.length) {
    if (c[i] === '(') depth++;
    if (c[i] === ')') { depth--; if (depth === 0) { found = true; break; } }
    i++;
  }
  if (found) {
    c = c.slice(0, idxLabel) + c.slice(i + 1);
    console.log('2 OK - champ intitule supprime');
  }
} else console.log('2 ECHEC');

// 3. Rendre le bouton "Envoyer le lien" directement cliquable sans showLabelInput
c = c.replace(
  /onClick=\{[^}]*setShowLabelInput[^}]*\}/g,
  'onClick={()=>copierLienDirect(t.id, "")}'
);

fs.writeFileSync(f, c, 'utf8');
console.log('OK - message nettoye et bouton direct');