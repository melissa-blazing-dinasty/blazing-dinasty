const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let lines = fs.readFileSync(f, 'utf8').split('\n');

// Remplacer les lignes 164-174 par le bon message
lines.splice(163, 11,
  '    const msg = "🔥✨ Une opportunite business rien que pour toi ! ✨🔥\\n\\n"',
  '      + "💰 Boutique gratuite · 20-30% commission · 100% flexible\\n\\n"',
  '      + "👇 Rejoins-nous ici 👇\\n"',
  '      + "➡️ " + lienCourt + "\\n\\n"',
  '      + "🌿 Blazing Dynasty x Mihi France";'
);

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('OK');