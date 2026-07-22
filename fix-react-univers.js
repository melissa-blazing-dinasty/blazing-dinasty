const fs = require('fs');
const f = 'src/App.js';
let c = fs.readFileSync(f, 'utf8');
c = c.replace(
  'const [onglet, setOnglet] = React.useState(',
  'const [onglet, setOnglet] = useState('
);
fs.writeFileSync(f, c, 'utf8');
console.log('OK');