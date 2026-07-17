const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let lines = fs.readFileSync(f, 'utf8').split('\n');

lines[416] = "      if (!preview) await trackVue(db, uidResolu || slug).catch(()=>{});";

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('OK ligne 417 corrigee');