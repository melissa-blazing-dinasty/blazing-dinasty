const fs = require('fs');
let ok = 0;

// 1. DiagnosticsTab.js - ajouter routing URLs courtes
const fD = 'src/DiagnosticsTab.js';
let cD = fs.readFileSync(fD, 'utf8');

const ancre = "  const bioSlug=p.get(\"bio\");";
const shortCode = `  // URLs courtes
  const pathname = window.location.pathname;
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 2) {
    const type = parts[0];
    const slug = parts[1];
    if (type === 'r' || type === 't') return <TunnelRecrutementPublic slug={slug} db={db}/>;
    if (type === 'b') return <LinkBioPublicPage slug={slug}/>;
    if (type === 'd') {
      const newUrl = '/?diag=' + p.get('diag') + '&uid=' + slug + (p.get('client') ? '&client=' + p.get('client') : '');
      window.location.replace(newUrl);
      return null;
    }
  }
  `;

if (cD.includes('parts.length === 2') ) {
  ok++; console.log('A DEJA');
} else if (cD.includes(ancre)) {
  cD = cD.replace(ancre, shortCode + ancre);
  fs.writeFileSync(fD, cD, 'utf8');
  ok++; console.log('A OK - routing URLs courtes');
} else { console.log('A ECHEC'); }

// 2. firebase.json - rewrites pour /r/ /b/ /d/ /t/
const fJ = 'firebase.json';
const cfg = {
  "hosting": {
    "public": "build",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "/r/**", "destination": "/index.html" },
      { "source": "/b/**", "destination": "/index.html" },
      { "source": "/d/**", "destination": "/index.html" },
      { "source": "/t/**", "destination": "/index.html" },
      { "source": "**", "destination": "/index.html" }
    ]
  },
  "functions": { "source": "functions" }
};
fs.writeFileSync(fJ, JSON.stringify(cfg, null, 2), 'utf8');
ok++; console.log('B OK - firebase.json mis a jour');

console.log('\n=== ' + ok + '/2 ===');