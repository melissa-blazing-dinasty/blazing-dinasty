const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(
  'const [msgIdx, setMsgIdx] = React.useState(0);',
  'const [msgIdx, setMsgIdx] = useState(0);'
);
c = c.replace(
  'React.useEffect(() => {',
  'useEffect(() => {'
);

fs.writeFileSync(f, c, 'utf8');
console.log('OK');