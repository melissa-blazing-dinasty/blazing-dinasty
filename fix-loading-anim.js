const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let c = fs.readFileSync(f, 'utf8');

const ancien = `  if (mode === "loading") return (
    <div style={{textAlign:"center",padding:"3rem 1rem"}}>
      <div style={{fontSize:"2rem",marginBottom:"1rem"}}>✨</div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: "1.1rem", color: C.brun, marginBottom: ".5rem" }}>Génération en cours...</div>
      <p style={{ fontSize: ".76rem", color: C.gris, lineHeight: 1.6 }}>
        L'IA analyse les réponses et sélectionne les meilleurs produits Mihi pour {nomClient||"ta cliente"} 🖤
      </p>
      <div style={{background:C.creme,borderRadius:10,padding:".6rem .9rem",marginTop:"1.2rem",display:"inline-block"}}>
        <p style={{fontSize:".68rem",color:C.gris,lineHeight:1.5,margin:0}}>
          ⏳ Ça peut prendre jusqu'à 30 secondes, merci de patienter sans quitter la page.
        </p>
      </div>
    </div>
  );`;

const nouveau = `  if (mode === "loading") return (
    <LoadingOrdonnance nomClient={nomClient}/>
  );`;

if (c.includes(ancien)) {
  c = c.replace(ancien, nouveau);
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK - loading remplace');
} else {
  console.log('ECHEC - ancre introuvable');
}