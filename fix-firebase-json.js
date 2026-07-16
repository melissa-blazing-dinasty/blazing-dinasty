// fix-firebase-json.js
// Ajoute le rewrite meta tags dans firebase.json
// node fix-firebase-json.js

const fs = require('fs');
const f = 'firebase.json';
let cfg = JSON.parse(fs.readFileSync(f, 'utf8'));

// Ajouter le rewrite avant le catch-all **
const rewrites = cfg.hosting.rewrites || [];
const hasMetaTags = rewrites.some(r => r.function === 'metaTags');

if (hasMetaTags) {
  console.log('DEJA FAIT');
} else {
  // Inserer avant le rewrite ** -> index.html
  const catchAllIdx = rewrites.findIndex(r => r.source === '**' && r.destination === '/index.html');
  const metaRewrite = {
    source: '/preview',
    function: 'metaTags'
  };
  if (catchAllIdx !== -1) {
    rewrites.splice(catchAllIdx, 0, metaRewrite);
  } else {
    rewrites.unshift(metaRewrite);
  }
  cfg.hosting.rewrites = rewrites;
  fs.writeFileSync(f, JSON.stringify(cfg, null, 2), 'utf8');
  console.log('OK - rewrite /preview ajoute');
}
