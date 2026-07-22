const fs = require('fs');
const f = 'src/App.js';
let c = fs.readFileSync(f, 'utf8');

const composant = `

// ── MON UNIVERS TAB ──────────────────────────────────────────────────────────
export function MonUniversTab({uid}) {
  const [onglet, setOnglet] = React.useState('roue');
  const onglets = [
    {id:'roue', label:'Equilibre'},
    {id:'disc', label:'DISC'},
    {id:'valeurs', label:'Valeurs'},
    {id:'style', label:'Style'},
  ];
  return (
    <div style={{fontFamily:'inherit',padding:'0 0 2rem'}}>
      <div style={{display:'flex',gap:'.4rem',overflowX:'auto',padding:'.7rem 1rem',background:'white',borderBottom:'1px solid #EDE8E0',position:'sticky',top:0,zIndex:10}}>
        {onglets.map(function(o){ return (
          <button key={o.id} onClick={function(){setOnglet(o.id);}}
            style={{flexShrink:0,padding:'.4rem .85rem',borderRadius:20,border:'none',background:onglet===o.id?'#5A3829':'#EDE8E0',color:onglet===o.id?'white':'#9A8C8C',fontFamily:'inherit',fontSize:'.72rem',fontWeight:onglet===o.id?700:400,cursor:'pointer'}}>
            {o.label}
          </button>
        );})}
      </div>
      {onglet==='roue'&&<RoueEquilibre/>}
      {onglet==='disc'&&<TestDISC/>}
      {onglet==='valeurs'&&<TestValeurs/>}
      {onglet==='style'&&<TestStyleEntrepreneur/>}
    </div>
  );
}
`;

// Verifier si deja present
if (c.includes('function MonUniversTab')) {
  console.log('DEJA PRESENT');
} else {
  // Ajouter avant export default App
  const ancre = 'export default App;';
  if (c.includes(ancre)) {
    c = c.replace(ancre, composant + '\n' + ancre);
    fs.writeFileSync(f, c, 'utf8');
    console.log('OK - MonUniversTab ajoute');
  } else {
    // Ajouter a la fin
    c = c + composant;
    fs.writeFileSync(f, c, 'utf8');
    console.log('OK - MonUniversTab ajoute en fin');
  }
}
