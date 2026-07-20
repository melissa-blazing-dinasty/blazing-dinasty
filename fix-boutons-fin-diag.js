const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let c = fs.readFileSync(f, 'utf8');

const ancre = '<p style={{ fontSize: ".65rem", color: C.gris, textAlign: "center" }}>Résultat sauvegardé dans ton tableau de bord 🖤</p>';

const boutons = `<div style={{display:"flex",flexDirection:"column",gap:".6rem",margin:"1rem 0 .5rem"}}>
          <button onClick={()=>window.open(profil?.lienBoutique||("?boutique="+(profil?.slug||"")), "_blank")}
            style={{width:"100%",background:C.creme,border:"1.5px solid "+C.pale,borderRadius:12,padding:".75rem 1rem",fontSize:".82rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:".75rem"}}>
            <span style={{fontSize:"1.2rem"}}>🛍️</span>
            <div><div style={{fontWeight:700}}>Découvrir tous les produits Mihi</div><div style={{fontSize:".7rem",opacity:.7,fontWeight:400}}>Qui correspondent à ton profil</div></div>
          </button>
          {(afficherVIPDiag&&lienInscriptionDiag)&&<button onClick={()=>window.open(lienInscriptionDiag,"_blank")}
            style={{width:"100%",background:"linear-gradient(135deg,#5A3829,#3D2020)",color:"white",border:"none",borderRadius:12,padding:".75rem 1rem",fontSize:".82rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:".75rem"}}>
            <span style={{fontSize:"1.2rem"}}>👑</span>
            <div><div style={{fontWeight:700}}>Créer un revenu avec ces produits</div><div style={{fontSize:".7rem",opacity:.85,fontWeight:400}}>Découvrir l'opportunité Mihi</div></div>
          </button>}
        </div>
        `;

if (c.includes('BOUTONS_FIN_DIAG')) {
  console.log('DEJA');
} else if (c.includes(ancre)) {
  c = c.replace(ancre, boutons + '{/* BOUTONS_FIN_DIAG */}\n        ' + ancre);
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK - boutons fin diag ajoutes');
} else {
  console.log('ECHEC');
}