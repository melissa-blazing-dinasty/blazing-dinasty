const fs = require('fs');
let c = fs.readFileSync('src/App.js', 'utf8');

// Remplacer le bouton PT par un lien Google Translate
c = c.replace(
  '<button onClick={toggleLang} disabled={translating}',
  '<a href={"https://translate.google.com/translate?sl=fr&tl=pt&u="+encodeURIComponent(window.location.href)} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none"}} title="Traduzir para português"><button disabled={false}'
);

// Fermer le <a> après le bouton
c = c.replace(
  '{translating?"⏳":lang==="fr"?"🇵🇹":"🇫🇷"}\n            </button>',
  '🇵🇹\n            </button></a>'
);

fs.writeFileSync('src/App.js', c, 'utf8');
console.log('OK:', c.includes('translate.google.com') ? 'OUI' : 'NON');