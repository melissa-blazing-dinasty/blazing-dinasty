const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(
  'onClick={()=>window.open(profil?.lienBoutique||("?boutique="+(profil?.slug||"")), "_blank")}',
  'onClick={()=>window.open("?boutique="+uid, "_blank")}'
);

fs.writeFileSync(f, c, 'utf8');
console.log('OK');