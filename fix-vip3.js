const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let lines = fs.readFileSync(f, 'utf8').split('\n');

lines = lines.map((l, i) => {
  // Ligne 1683 - lienInscriptionDiag
  if (l.includes('setLienInscriptionDiag') && l.includes('db-lien-inscription-mihi') && !l.includes('boutiqueActive')) {
    const nouveau = l.replace(
      'snapUV.data()["db-lien-inscription-mihi"]||""',
      'snapUV.data().boutiqueActive?(snapUV.data()["db-lien-inscription-mihi"]||""):""'
    );
    console.log('OK ligne ' + (i+1) + ' - lienInscriptionDiag corrige');
    return nouveau;
  }
  // Ligne 4160 - lien direct
  if (l.includes("const lien=snapU.data()['db-lien-inscription-mihi']") && !l.includes('boutiqueActive')) {
    const nouveau = l.replace(
      "const lien=snapU.data()['db-lien-inscription-mihi']||\"\"",
      "const lien=snapU.data().boutiqueActive?(snapU.data()['db-lien-inscription-mihi']||\"\"):\"\""
    );
    console.log('OK ligne ' + (i+1) + ' - lien tunnel corrige');
    return nouveau;
  }
  // afficherVIPTunnel - conditionner a boutiqueActive
  if (l.includes('setAfficherVIPTunnel') && l.includes('db-afficher-prix-vip') && !l.includes('boutiqueActive')) {
    const nouveau = l.replace(
      /setAfficherVIPTunnel\(!!snapU[\d]?\.data\(\)\["db-afficher-prix-vip"\]\)/,
      match => match.replace('!!snapU', '!!(snapU').replace('["db-afficher-prix-vip"])', '["db-lien-inscription-mihi"] && snapU\' + match.match(/snapU\d?/)[0] + \'.data()["db-afficher-prix-vip"])')
    );
    console.log('OK ligne ' + (i+1) + ' - afficherVIPTunnel corrige');
    return nouveau;
  }
  return l;
});

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('=== Sauvegarde OK ===');