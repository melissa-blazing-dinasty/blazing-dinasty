const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let lines = fs.readFileSync(f, 'utf8').split('\n');
let ok = 0;

lines = lines.map((l, i) => {
  const n = i + 1;

  // Ligne 1817
  if (n === 1817 && l.includes('blazing-dinasty-1fad9.web.app?diag=')) {
    ok++;
    console.log('OK ligne 1817');
    return l.replace(
      '`https://blazing-dinasty-1fad9.web.app?diag=${type}&uid=${uid}&client=${encodeURIComponent(nomClient||"")}`',
      '`https://blazing-dinasty-1fad9.web.app/d/${uid}?diag=${type}&client=${encodeURIComponent(nomClient||"")}`'
    );
  }

  // Ligne 1975
  if (n === 1975 && l.includes('blazing-dinasty-1fad9.web.app?diag=')) {
    ok++;
    console.log('OK ligne 1975');
    return l.replace(
      '`https://blazing-dinasty-1fad9.web.app?diag=${diagType}&uid=${uid}&distributrice=${encodeURIComponent(userName)}&client=${encodeURIComponent(nomClient||"")}`',
      '`https://blazing-dinasty-1fad9.web.app/d/${uid}?diag=${diagType}&client=${encodeURIComponent(nomClient||"")}`'
    );
  }

  return l;
});

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('=== ' + ok + '/2 corrections ===');