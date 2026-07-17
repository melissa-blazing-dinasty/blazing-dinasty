const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

const ancien = "const copyLink = () => { navigator.clipboard.writeText(lienPublic); showNotif('Lien copié !'); };";

const nouveau = `const copyLink = () => {
    const msg = "🔥✨ Une opportunite business rien que pour toi ! ✨🔥\\n\\n"
      + "💰 Boutique gratuite · 20-30% commission · 100% flexible\\n\\n"
      + "👇👇 DECOUVRE ICI 👇👇\\n"
      + "➡️ " + lienPublic + "\\n\\n"
      + "⚠️ Clique bien sur le lien ci-dessus\\n"
      + "(pas sur le premier apercu qui apparait)\\n\\n"
      + "🌿 Blazing Dynasty x Mihi France";
    navigator.clipboard.writeText(msg);
    showNotif('Message copie ! Colle-le dans Messenger 💬');
  };`;

if (c.includes(ancien)) {
  c = c.replace(ancien, nouveau);
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK');
} else {
  console.log('ECHEC');
}