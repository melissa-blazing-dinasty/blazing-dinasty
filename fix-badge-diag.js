const fs = require('fs');
const f = 'src/App.js';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(
  '<button key={s.id} onClick={()=>setOutilsSousOnglet(s.id)}',
  '<button key={s.id} onClick={()=>{setOutilsSousOnglet(s.id);if(s.id==="diagnostics")setNbDiagNonLus(0);}}'
);

fs.writeFileSync(f, c, 'utf8');
console.log('OK');