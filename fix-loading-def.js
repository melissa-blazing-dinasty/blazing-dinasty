const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let c = fs.readFileSync(f, 'utf8');

const composant = `function LoadingOrdonnance({nomClient}) {
  const [msgIdx, setMsgIdx] = React.useState(0);
  const msgs = [
    {emoji:"✨", txt:"L'IA analyse tes reponses..."},
    {emoji:"🌿", txt:"Selection des meilleurs produits Mihi pour toi..."},
    {emoji:"💫", txt:"Creation de ton ordonnance personnalisee..."},
    {emoji:"🎯", txt:"Identification de tes besoins specifiques..."},
    {emoji:"🔬", txt:"Recherche dans le catalogue Mihi..."},
    {emoji:"✨", txt:"Finalisation de tes recommandations..."},
  ];
  React.useEffect(() => {
    const t = setInterval(() => setMsgIdx(function(i){ return (i+1)%6; }), 2500);
    return function(){ clearInterval(t); };
  }, []);
  const m = msgs[msgIdx];
  return (
    <div style={{textAlign:"center",padding:"3rem 1rem"}}>
      <div style={{fontSize:"3rem",marginBottom:"1rem"}}>{m.emoji}</div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",color:"#5A3829",marginBottom:".5rem"}}>{m.txt}</div>
      <p style={{fontSize:".76rem",color:"#9A8C8C",lineHeight:1.6}}>Ordonnance en cours pour {nomClient||"ta cliente"}</p>
      <div style={{display:"flex",justifyContent:"center",gap:6,marginTop:"1.5rem"}}>
        {msgs.map(function(_,i){ return <div key={i} style={{width:6,height:6,borderRadius:"50%",background:i===msgIdx?"#C4A962":"#EDE8E0",transition:"background .3s"}}/>; })}
      </div>
      <div style={{background:"#FAF7F2",borderRadius:10,padding:".6rem .9rem",marginTop:"1.2rem",display:"inline-block"}}>
        <p style={{fontSize:".68rem",color:"#9A8C8C",lineHeight:1.5,margin:0}}>Cela peut prendre jusqu'a 30 secondes...</p>
      </div>
    </div>
  );
}

`;

// Inserer avant function DiagnosticsTab
const idx = c.indexOf('function DiagnosticsTab');
if (idx !== -1) {
  c = c.slice(0, idx) + composant + c.slice(idx);
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK');
} else {
  console.log('ECHEC');
}