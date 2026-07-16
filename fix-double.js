const fs = require('fs');
const f = 'src/LinkBioTab.js';
let c = fs.readFileSync(f, 'utf8');
fs.writeFileSync(f + '.bak-double', c);

const doublon = '\n  const[tokensOuvert,setTokensOuvert]=useState(false);';
const count = (c.split(doublon)).length - 1;
console.log('tokensOuvert trouve ' + count + ' fois');

if (count >= 2) {
  const idx = c.indexOf(doublon);
  c = c.slice(0, idx) + c.slice(idx + doublon.length);
  fs.writeFileSync(f, c);
  console.log('=== Doublon supprime, fichier sauvegarde ===');
} else {
  console.log('Pas de doublon trouve');
}