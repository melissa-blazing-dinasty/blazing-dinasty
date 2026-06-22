const fs = require('fs');
let c = fs.readFileSync('src/App.js', 'utf8');

const old = '      {id:"formationapp",    label:"Formation App"},\n    ]},';
const newt = '      {id:"formationapp",    label:"Formation App (général)"},\n      {id:"formationchef",   label:"Formation App — Chef d\'équipe"},\n      {id:"dashboard",        label:"Formation App — Tableau de bord"},\n      {id:"outils",           label:"Formation App — Outils généraux"},\n    ]},';

if(c.includes(old)){
  c = c.replace(old, newt);
  console.log('✅ Sous-groupes ajoutés');
} else {
  console.log('❌ Non trouvé');
  const idx = c.indexOf('formationapp');
  console.log(JSON.stringify(c.substring(idx-20, idx+80)));
}

fs.writeFileSync('src/App.js', c, 'utf8');