const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

// Supprimer ETAPES_DECOUVERTE là où il est mal placé
const debutMal = "\n  const ETAPES_DECOUVERTE = [";
const finMal = "];\n\n";
const idxMal = c.indexOf(debutMal);
const idxFinMal = c.indexOf(finMal, idxMal) + finMal.length;
const blocEtapes = c.slice(idxMal, idxFinMal);

// Le remettre juste après les states (avant le premier useEffect)
const ancreUseEffect = "  useEffect(()=>{(async()=>{";

if (idxMal !== -1 && c.includes(ancreUseEffect)) {
  c = c.slice(0, idxMal) + c.slice(idxFinMal);
  c = c.replace(ancreUseEffect, blocEtapes + "\n  " + ancreUseEffect.trim());
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK - ETAPES_DECOUVERTE deplace');
} else {
  console.log('ECHEC idxMal:' + idxMal);
}