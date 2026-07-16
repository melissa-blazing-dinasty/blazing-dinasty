const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

const ancre = "  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: CR.gris }}>Chargement...</div>;";
const idx = c.indexOf(ancre);

if (idx === -1) { console.log('ECHEC'); process.exit(1); }

const insertion = `
  const tabsNav = (
    <div style={{display:'flex',gap:'.5rem',marginBottom:'1rem'}}>
      {[{id:'reglages',label:'Reglages'},{id:'stats',label:'Stats'}].map(t=>(
        <button key={t.id} onClick={()=>setSousOnglet(t.id)}
          style={{flex:1,background:sousOnglet===t.id?CR.brun:'white',color:sousOnglet===t.id?'white':CR.gris,border:'1px solid '+CR.pale,borderRadius:10,padding:'.6rem',fontSize:'.78rem',fontWeight:sousOnglet===t.id?700:400,fontFamily:'inherit',cursor:'pointer'}}>
          {t.label}
        </button>
      ))}
    </div>
  );

  if (sousOnglet === 'stats') return (
    <div style={{fontFamily:'inherit',maxWidth:480,margin:'0 auto',padding:'0 0 3rem'}}>
      {tabsNav}
      <TunnelStatsTab uid={uid} db={db}/>
    </div>
  );

`;

c = c.slice(0, idx) + insertion + c.slice(idx);

// Ajouter tabsNav au debut du return principal
const ancreReturn = "  return (\n    <div style={{fontFamily:'inherit',maxWidth:480,margin:'0 auto',padding:'0 0 3rem'}}>";
if (c.includes(ancreReturn)) {
  c = c.replace(ancreReturn, ancreReturn + "\n      {tabsNav}");
  console.log('Return OK');
} else console.log('Return ECHEC');

fs.writeFileSync(f, c, 'utf8');
console.log('tabsNav: ' + (c.includes('tabsNav') ? 'OK' : 'ECHEC'));
console.log('stats branch: ' + (c.includes("sousOnglet === 'stats'") ? 'OK' : 'ECHEC'));