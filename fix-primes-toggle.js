const fs = require('fs');
const f = 'src/App.js';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(
  'function PrimesAccordeon({obj, save, onPrimeValidee}){\n  const[open,setOpen]=useState(true);',
  'function PrimesAccordeon({obj, save, onPrimeValidee}){\n  const[open,setOpen]=useState(false);'
);

fs.writeFileSync(f, c, 'utf8');
console.log('OK - toggle false par defaut');