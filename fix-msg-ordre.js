const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let lines = fs.readFileSync(f, 'utf8').split('\n');

lines = lines.map((l, i) => {
  if (l.includes('Une opportunite business')) {
    return `    const msg = "➡️ " + lienCourt + "\\n\\n"
      + "🔥✨ Une opportunite business rien que pour toi ! ✨🔥\\n\\n"
      + "💰 Boutique gratuite · 20-30% commission · 100% flexible\\n\\n"
      + "👆 Clique sur le lien tout en haut !\\n"
      + "🌿 Blazing Dynasty x Mihi France";`;
  }
  return l;
});

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('OK');