const fs = require('fs');
const cfg = {
  "hosting": {
    "public": "build",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "/preview", "function": "metaTags" },
      { "source": "**", "destination": "/index.html" }
    ]
  },
  "functions": { "source": "functions" }
};
fs.writeFileSync('firebase.json', JSON.stringify(cfg, null, 2), 'utf8');
console.log('OK - firebase.json mis a jour');
console.log(JSON.stringify(cfg.hosting.rewrites, null, 2));