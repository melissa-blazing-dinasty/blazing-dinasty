const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let c = fs.readFileSync(f, 'utf8');

const ancien = `    const lien = \`https://blazing-dinasty-1fad9.web.app/d/\${uid}?diag=\${diagType}&client=\${encodeURIComponent(nomClient||"")}\`;`;

const nouveau = `    const lienBase = \`https://blazing-dinasty-1fad9.web.app/d/\${uid}?diag=\${diagType}&client=\${encodeURIComponent(nomClient||"")}\`;
    let bitlyToken = '';
    try { const snap = await getDoc(doc(db,'admin','config')); if(snap.exists()) bitlyToken = snap.data().bitlyToken||''; } catch {}
    const lien = await raccourcirLien(lienBase, bitlyToken);`;

if (c.includes(ancien)) {
  c = c.replace(ancien, nouveau);
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK - Bitly integre dans copierLienDirect');
} else {
  console.log('ECHEC - cherchons...');
  const i = c.indexOf('blazing-dinasty-1fad9.web.app/d/');
  console.log(c.substring(i-20, i+100));
}