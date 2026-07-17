const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let lines = fs.readFileSync(f, 'utf8').split('\n');
let ok = 0;

lines = lines.map((l, i) => {
  const n = i + 1;

  // Ligne 1683 - lienInscriptionDiag
  if (n === 1683 && l.includes('setLienInscriptionDiag')) {
    ok++;
    console.log('OK ligne 1683');
    return l.replace(
      'snapUV.data()["db-lien-inscription-mihi"]||""',
      'snapUV.data().boutiqueActive?(snapUV.data()["db-lien-inscription-mihi"]||""):""'
    );
  }

  // Ligne 4159 - vip conditionnel a boutiqueActive
  if (n === 4159 && l.includes('db-afficher-prix-vip')) {
    ok++;
    console.log('OK ligne 4159');
    return l.replace(
      "const vip=!!snapU.data()['db-afficher-prix-vip'];",
      "const boutiqueOk=!!snapU.data().boutiqueActive; const vip=boutiqueOk&&!!snapU.data()['db-afficher-prix-vip'];"
    );
  }

  // Ligne 4160 - lien conditionnel a boutiqueActive
  if (n === 4160 && l.includes('db-lien-inscription-mihi')) {
    ok++;
    console.log('OK ligne 4160');
    return l.replace(
      "const lien=snapU.data()['db-lien-inscription-mihi']||\"\"",
      "const lien=snapU.data().boutiqueActive?(snapU.data()['db-lien-inscription-mihi']||\"\"):\"\""
    );
  }

  return l;
});

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('=== ' + ok + '/3 corrections ===');