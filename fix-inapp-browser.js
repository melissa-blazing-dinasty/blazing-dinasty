const fs = require('fs');
const f = 'src/App.js';
let c = fs.readFileSync(f, 'utf8');

const ancre = "  if(diagMode){";
const detection = `  // Detection navigateur integre (Messenger, Instagram, Facebook)
  const isInAppBrowser = /FBAN|FBAV|Instagram|Messenger|FB_IAB|FB4A|FBIOS/i.test(navigator.userAgent);
  if(isInAppBrowser && diagMode){
    const currentUrl = window.location.href;
    return(
      <div style={{minHeight:"100vh",background:C.creme,display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem",fontFamily:"'Trebuchet MS',sans-serif"}}>
        <div style={{textAlign:"center",maxWidth:360}}>
          <div style={{fontSize:"3rem",marginBottom:"1rem"}}>🌐</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.3rem",fontWeight:600,color:C.brun,marginBottom:".8rem"}}>
            Ouvre ce lien dans ton navigateur
          </div>
          <div style={{fontSize:".85rem",color:C.gris,lineHeight:1.6,marginBottom:"1.5rem"}}>
            Pour accéder à ton diagnostic, copie le lien et ouvre-le dans Chrome ou Safari.
          </div>
          <button onClick={()=>navigator.clipboard.writeText(currentUrl).then(()=>alert("Lien copié ! Colle-le dans Chrome ou Safari."))}
            style={{width:"100%",background:C.brun,color:"white",border:"none",borderRadius:12,padding:"1rem",fontSize:".9rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer",marginBottom:".8rem"}}>
            📋 Copier le lien
          </button>
          <div style={{fontSize:".75rem",color:C.gris}}>
            Ensuite ouvre Chrome ou Safari et colle le lien dans la barre d'adresse.
          </div>
        </div>
      </div>
    );
  }

`;

if (c.includes('isInAppBrowser')) {
  console.log('DEJA FAIT');
} else if (c.includes(ancre)) {
  c = c.replace(ancre, detection + ancre);
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK - detection navigateur integre ajoutee');
} else {
  console.log('ECHEC');
}