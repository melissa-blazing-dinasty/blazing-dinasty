const fs = require('fs');
const cfg = {
  "hosting": {
    "public": "build",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/preview",
        "run": {
          "serviceId": "metatags-ueeegizpka",
          "region": "us-central1"
        }
      },
      { "source": "**", "destination": "/index.html" }
    ]
  },
  "functions": { "source": "functions" }
};
fs.writeFileSync('firebase.json', JSON.stringify(cfg, null, 2), 'utf8');
console.log('OK');