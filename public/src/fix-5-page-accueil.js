// fix-5-page-accueil.js
// Lance avec : node fix-5-page-accueil.js
// À placer dans le même dossier que App.js (src/)

const fs = require("fs");
const path = require("path");

const APP_PATH = path.join(__dirname, "App.js");
const BACKUP_PATH = path.join(__dirname, "App.js.backup-accueil-" + Date.now());

if (!fs.existsSync(APP_PATH)) {
  console.error("❌ App.js introuvable dans ce dossier.");
  process.exit(1);
}

let content = fs.readFileSync(APP_PATH, "utf8");
fs.writeFileSync(BACKUP_PATH, content, "utf8");
console.log("✅ Sauvegarde créée : " + path.basename(BACKUP_PATH));

let errors = [];

// ── 1. Charger objPerso + textesAdmin dans App() pour la page d'accueil ──
const MARK1 = `  // ── Admin items ──
  const[adminItems,setAdminItems]=useState([]);
  const[adminPosts,setAdminPosts]=useState([]);
  useEffect(()=>{
    if(screen!=="app")return;
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","contenus"));
        if(snap.exists())setAdminItems((snap.data().items||[]).filter(i=>i.actif));
      }catch{}
      try{
        const snap2=await getDoc(doc(db,"admin","posts_extra"));
        if(snap2.exists())setAdminPosts(snap2.data().items||[]);
      }catch{}
    })();
  },[screen]);`;

const REPLACE1 = `  // ── Admin items ──
  const[adminItems,setAdminItems]=useState([]);
  const[adminPosts,setAdminPosts]=useState([]);
  const[homeObjPerso,setHomeObjPerso]=useState(null);
  const[homeTextes,setHomeTextes]=useState(null);
  useEffect(()=>{
    if(screen!=="app")return;
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","contenus"));
        if(snap.exists())setAdminItems((snap.data().items||[]).filter(i=>i.actif));
      }catch{}
      try{
        const snap2=await getDoc(doc(db,"admin","posts_extra"));
        if(snap2.exists())setAdminPosts(snap2.data().items||[]);
      }catch{}
      try{
        const snap3=await getDoc(doc(db,"users",userId));
        if(snap3.exists()&&snap3.data()["db-obj-perso"]) setHomeObjPerso(JSON.parse(snap3.data()["db-obj-perso"]));
      }catch{}
      try{
        const snap4=await getDoc(doc(db,"admin","textes"));
        if(snap4.exists()) setHomeTextes(snap4.data());
      }catch{}
    })();
  },[screen]);`;

if(content.includes(MARK1)){
  content = content.replace(MARK1, REPLACE1);
  console.log("✅ 1/2 — Chargement objectifs perso + textes admin ajouté");
} else {
  errors.push("1 — bloc adminItems/adminPosts useEffect introuvable (étape 2 a-t-elle été appliquée ?)");
}

// ── 2. Injecter le bloc récapitulatif en haut de l'onglet "home" ──
const MARK2 = `        {/* ── HOME ── */}
        {tab==="home"&&(
          <div>
            <div style={{background:C.brun,borderRadius:16,padding:"1.4rem",marginBottom:"1rem",position:"relative",overflow:"hidden"}}>`;

const REPLACE2 = `        {/* ── HOME ── */}
        {tab==="home"&&(
          <div>
            {/* ── RÉCAP DU JOUR ── */}
            <HomeRecap name={name} objPerso={homeObjPerso} textes={homeTextes}/>

            <div style={{background:C.brun,borderRadius:16,padding:"1.4rem",marginBottom:"1rem",position:"relative",overflow:"hidden"}}>`;

if(content.includes(MARK2)){
  content = content.replace(MARK2, REPLACE2);
  console.log("✅ 2/2 — Bloc HomeRecap injecté en haut de l'onglet Accueil");
} else {
  errors.push("2 — début de l'onglet home introuvable");
}

// ── 3. Ajouter le composant HomeRecap — avant "// ── BLAZING DYNASTY ──" n'existe pas en tant que fonction séparée,
// donc on l'ajoute avant "// ── SUIVI RECRUES COMPONENT" qui est le 1er composant après App() ──
const MARK3 = `// ── SUIVI RECRUES COMPONENT ───────────────────────────────────────────────────`;

const HOME_RECAP_COMPONENT = `// ── HOME RECAP (page d'accueil) ──────────────────────────────────────────────
function HomeRecap({name, objPerso, textes}){
  const periodeInfo=getPeriodeInfo();
  const citation=getCitationDuJour(textes?.citations);
  const prenom=name.split(" ")[0];

  const pct=(r,o)=>{
    if(!o||!r||+o===0)return 0;
    return Math.min(100,Math.round(+r/+o*100));
  };

  const pctCA=objPerso?pct(objPerso.ca,objPerso.caObj):0;
  const pctRecrues=objPerso?pct(objPerso.recruesReal,objPerso.recruesObj):0;
  const hasObjCA=objPerso&&objPerso.caObj;
  const hasObjRecrues=objPerso&&objPerso.recruesObj&&objPerso.recruesObj!=="0";

  const urgent=periodeInfo.daysLeft<3;

  return(
    <div style={{marginBottom:"1rem"}}>
      {/* Bienvenue */}
      <div style={{background:\`linear-gradient(135deg, \${C.brun}, \${C.brun2})\`,borderRadius:16,padding:"1.4rem",marginBottom:".75rem",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-20,right:-20,width:100,height:100,borderRadius:"50%",background:"rgba(196,168,130,.1)"}}/>
        <div style={{position:"relative"}}>
          <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".18em",color:C.or,marginBottom:".35rem"}}>✦ BIENVENUE</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.3rem",fontWeight:300,color:C.blanc,lineHeight:1.25,marginBottom:".5rem"}}>
            Salut <em style={{fontStyle:"italic",color:C.pale}}>{prenom}</em> 👋
          </div>
          {textes?.messageAccueil&&(
            <p style={{fontSize:".74rem",color:C.pale,opacity:.9,lineHeight:1.6,marginBottom:0}}>{textes.messageAccueil}</p>
          )}
        </div>
      </div>

      {/* Période + objectifs */}
      <div style={{display:"grid",gridTemplateColumns:hasObjCA||hasObjRecrues?"1fr 1fr":"1fr",gap:".5rem",marginBottom:".75rem"}}>
        {/* Période */}
        <div style={{background:urgent?"#FFF3E0":C.blanc,border:\`1px solid \${urgent?"#E6A817":C.pale}\`,borderRadius:12,padding:".85rem"}}>
          <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:urgent?"#8B5E00":C.rose,marginBottom:".4rem"}}>⏱️ Période en cours</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.6rem",fontWeight:600,color:urgent?"#C44B1A":C.brun,lineHeight:1}}>
            {periodeInfo.daysLeft}<span style={{fontSize:".8rem",fontWeight:400,color:C.gris}}> j {periodeInfo.hoursLeft}h</span>
          </div>
          <div style={{fontSize:".6rem",color:C.gris,marginTop:".15rem"}}>restants{urgent?" ⚠️":""}</div>
          <div style={{height:4,background:C.pale,borderRadius:10,overflow:"hidden",marginTop:".5rem"}}>
            <div style={{height:"100%",background:urgent?"#E6A817":C.rose,width:periodeInfo.pctElapsed+"%",borderRadius:10}}/>
          </div>
        </div>

        {/* Objectif CA */}
        {hasObjCA&&(
          <div style={{background:C.blanc,border:\`1px solid \${C.pale}\`,borderRadius:12,padding:".85rem"}}>
            <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.or,marginBottom:".4rem"}}>💰 Mon CA</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1.6rem",fontWeight:600,color:pctCA>=100?C.vert:C.brun,lineHeight:1}}>
              {pctCA}<span style={{fontSize:".8rem",fontWeight:400,color:C.gris}}>%</span>
            </div>
            <div style={{fontSize:".6rem",color:C.gris,marginTop:".15rem"}}>{objPerso.ca||0}€ / {objPerso.caObj}€</div>
            <div style={{height:4,background:C.pale,borderRadius:10,overflow:"hidden",marginTop:".5rem"}}>
              <div style={{height:"100%",background:pctCA>=100?C.vert:C.or,width:pctCA+"%",borderRadius:10}}/>
            </div>
          </div>
        )}

        {/* Objectif recrues (si pas de CA, prend la 2e colonne) */}
        {hasObjRecrues&&!hasObjCA&&(
          <div style={{background:C.blanc,border:\`1px solid \${C.pale}\`,borderRadius:12,padding:".85rem"}}>
            <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.lilas,marginBottom:".4rem"}}>👥 Mes recrues</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1.6rem",fontWeight:600,color:pctRecrues>=100?C.vert:C.brun,lineHeight:1}}>
              {pctRecrues}<span style={{fontSize:".8rem",fontWeight:400,color:C.gris}}>%</span>
            </div>
            <div style={{fontSize:".6rem",color:C.gris,marginTop:".15rem"}}>{objPerso.recruesReal||0} / {objPerso.recruesObj}</div>
            <div style={{height:4,background:C.pale,borderRadius:10,overflow:"hidden",marginTop:".5rem"}}>
              <div style={{height:"100%",background:pctRecrues>=100?C.vert:C.lilas,width:pctRecrues+"%",borderRadius:10}}/>
            </div>
          </div>
        )}
      </div>

      {/* Objectif recrues — 2e ligne si CA présent aussi */}
      {hasObjCA&&hasObjRecrues&&(
        <div style={{background:C.blanc,border:\`1px solid \${C.pale}\`,borderRadius:12,padding:".85rem",marginBottom:".75rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".4rem"}}>
            <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.lilas}}>👥 Mes recrues</div>
            <div style={{fontSize:".75rem",fontWeight:700,color:pctRecrues>=100?C.vert:C.brun}}>{objPerso.recruesReal||0} / {objPerso.recruesObj} · {pctRecrues}%</div>
          </div>
          <div style={{height:5,background:C.pale,borderRadius:10,overflow:"hidden"}}>
            <div style={{height:"100%",background:pctRecrues>=100?C.vert:C.lilas,width:pctRecrues+"%",borderRadius:10,transition:"width .4s"}}/>
          </div>
        </div>
      )}

      {!hasObjCA&&!hasObjRecrues&&(
        <div style={{background:"rgba(196,154,138,.08)",border:\`1px solid \${C.pale}\`,borderRadius:10,padding:".7rem 1rem",marginBottom:".75rem",fontSize:".74rem",color:C.brun,lineHeight:1.6}}>
          💡 Définis tes objectifs du mois dans <strong>Tableau de bord → Mes objectifs</strong> pour les voir apparaître ici chaque jour.
        </div>
      )}

      {/* Citation du jour */}
      <div style={{background:\`linear-gradient(135deg, rgba(196,154,138,.12), rgba(168,155,181,.08))\`,border:\`1px solid \${C.pale}\`,borderRadius:14,padding:"1.1rem",textAlign:"center"}}>
        <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".18em",color:C.rose,marginBottom:".5rem"}}>✦ PENSÉE DU JOUR ✦</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",fontStyle:"italic",color:C.brun,lineHeight:1.65}}>"{citation}"</div>
      </div>
    </div>
  );
}

// ── SUIVI RECRUES COMPONENT ───────────────────────────────────────────────────`;

if(content.includes(MARK3)){
  content = content.replace(MARK3, HOME_RECAP_COMPONENT);
  console.log("✅ 3/3 — Composant HomeRecap ajouté");
} else {
  errors.push("3 — marqueur SUIVI RECRUES COMPONENT introuvable");
}

if(errors.length>0){
  console.error("");
  console.error("⚠️  ATTENTION — certaines étapes ont échoué :");
  errors.forEach(e=>console.error("   - "+e));
  console.error("");
  console.error("Le fichier N'A PAS été modifié. Aucun changement appliqué.");
  console.error("");
  console.error("ℹ️  Cette étape dépend des étapes 2 et 4 (chargement adminPosts, fonction getCitationDuJour).");
  console.error("   Vérifie qu'elles ont été appliquées avec succès avant celle-ci.");
  process.exit(1);
}

fs.writeFileSync(APP_PATH, content, "utf8");
console.log("");
console.log("✅ App.js mis à jour avec succès !");
console.log("");
console.log("👉 Prochaines étapes :");
console.log("   1. npm run build");
console.log("   2. firebase deploy");
console.log("");
console.log("ℹ️  Si quelque chose ne va pas, restaure la sauvegarde :");
console.log("   " + path.basename(BACKUP_PATH) + " → renomme-le en App.js");
