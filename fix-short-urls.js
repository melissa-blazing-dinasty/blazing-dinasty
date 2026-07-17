const fs = require('fs');

// 1. Modifier DiagnosticsTab.js pour gerer les URLs courtes
const fD = 'src/DiagnosticsTab.js';
let cD = fs.readFileSync(fD, 'utf8');

const ancre = "  const bioSlug=p.get(\"bio\");";
const shortUrls = `  // URLs courtes /r/ /b/ /d/
  const path = window.location.pathname;
  const shortMatch = path.match(/^\/(r|b|d|t)\/(.+)$/);
  if (shortMatch) {
    const type = shortMatch[1];
    const slug = shortMatch[2];
    if (type === 'r') return <TunnelRecrutementPublic slug={slug} db={db}/>;
    if (type === 'b') return <LinkBioPublicPage slug={slug}/>;
    if (type === 'd') { window.location.href = '/?bio=' + slug; return null; }
    if (type === 't') return <TunnelRecrutementPublic slug={slug} db={db}/>;
  }
  `;

if (cD.includes('shortMatch')) {
  console.log('1 DEJA');
} else if (cD.includes(ancre)) {
  cD = cD.replace(ancre, shortUrls + ancre);
  fs.writeFileSync(fD, cD, 'utf8');
  console.log('1 OK - short URLs routing');
} else {
  console.log('1 ECHEC');
}

// 2. Modifier firebase.json pour accepter les routes courtes
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
console.log('2 OK - firebase.json mis a jour');