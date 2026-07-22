const fs = require('fs');
const composant = `
export function MonUniversTab({uid}) {
  const [onglet, setOnglet] = React.useState('roue');
  const onglets = [
    {id:'roue', label:'Equilibre'},
    {id:'disc', label:'DISC'},
    {id:'valeurs', label:'Valeurs'},
    {id:'style', label:'Style'},
  ];
  return (
    <div style={{fontFamily:'inherit'}}>
      <div style={{display:'flex',gap:'.4rem',overflowX:'auto',padding:'.5rem 0',marginBottom:'1rem'}}>
        {onglets.map(o => (
          <button key={o.id} onClick={()=>setOnglet(o.id)}
            style={{flexShrink:0,padding:'.4rem .8rem',borderRadius:20,border:'none',background:onglet===o.id?'#5A3829':'#EDE8E0',color:onglet===o.id?'white':'#9A8C8C',fontFamily:'inherit',fontSize:'.72rem',fontWeight:onglet===o.id?700:400,cursor:'pointer'}}>
            {o.label}
          </button>
        ))}
      </div>
      {onglet==='roue'&&<RoueEquilibre/>}
      {onglet==='disc'&&<TestDISC/>}
      {onglet==='valeurs'&&<TestValeurs/>}
      {onglet==='style'&&<TestStyleEntrepreneur/>}
    </div>
  );
}
`;

let c = fs.readFileSync('src/App.js', 'utf8');
if (c.includes('MonUniversTab')) {
  console.log('DEJA');
} else {
  c = c + composant;
  fs.writeFileSync('src/App.js', c, 'utf8');
  console.log('OK');
}