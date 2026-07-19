const fs = require('fs');
const f = 'src/App.js';
let c = fs.readFileSync(f, 'utf8');
c = c.replace('{id:"banqueimages",label:"💬 Témoignages & Visuels"}', '{id:"banqueimages",label:"📸 Témoignages & Visuels"}');
fs.writeFileSync(f, c, 'utf8');
console.log('OK');