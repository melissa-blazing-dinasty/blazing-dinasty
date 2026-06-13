// fix-4-admin-textes.js
// Lance avec : node fix-4-admin-textes.js
// À placer dans le même dossier que App.js (src/)

const fs = require("fs");
const path = require("path");

const APP_PATH = path.join(__dirname, "App.js");
const BACKUP_PATH = path.join(__dirname, "App.js.backup-admintextes-" + Date.now());

if (!fs.existsSync(APP_PATH)) {
  console.error("❌ App.js introuvable dans ce dossier.");
  process.exit(1);
}

let content = fs.readFileSync(APP_PATH, "utf8");
fs.writeFileSync(BACKUP_PATH, content, "utf8");
console.log("✅ Sauvegarde créée : " + path.basename(BACKUP_PATH));

let errors = [];

// ── 1. Ajouter une liste par défaut de citations + fonction utilitaire, avant "// ── MAIN APP" ──
const MARK1 = `// ── MAIN APP ──────────────────────────────────────────────────────────────────`;

const CITATIONS_BLOCK = `// ── CITATIONS DU JOUR ─────────────────────────────────────────────────────────
const CITATIONS_DEFAULT=[
  "Le succès, c'est tomber 7 fois et se relever 8.",
  "Chaque jour est une nouvelle chance de changer ta vie.",
  "La discipline, c'est se rappeler ce que tu veux vraiment.",
  "Tu n'as pas besoin d'être parfaite, juste constante.",
  "Le doute tue plus de rêves que l'échec jamais ne le fera.",
  "Petit pas par petit pas, on construit de grandes choses.",
  "Ton énergie d'aujourd'hui dessine ton avenir de demain.",
  "Crois en toi, même quand personne d'autre ne le fait.",
  "La motivation te lance. L'habitude te fait tenir.",
  "Tu es plus forte que ce que tu penses.",
  "Le meilleur moment pour commencer, c'était hier. Le 2ème, c'est maintenant.",
  "Chaque 'non' te rapproche d'un 'oui'.",
  "La constance bat le talent quand le talent ne travaille pas.",
  "Sois fière de chaque petit progrès — c'est ainsi que naissent les grands changements.",
  "Ton futur toi te remerciera pour les efforts d'aujourd'hui.",
  "Les femmes fortes lèvent les autres femmes en se levant elles-mêmes.",
  "Ce n'est pas le temps qui manque, c'est la décision qui compte.",
  "Une graine plantée chaque jour devient une forêt.",
  "Ta différence est ta force, pas ta faiblesse.",
  "Avance à ton rythme — l'important c'est de ne jamais reculer.",
  "L'échec n'est qu'une information : il te dit ce qu'il faut ajuster.",
  "Les grandes histoires commencent toujours par un petit 'je vais essayer'.",
  "Investir en toi-même est le meilleur placement que tu feras jamais.",
  "Le travail discret d'aujourd'hui devient le résultat visible de demain.",
  "Sois la raison pour laquelle quelqu'un croit encore en la bonté et la persévérance.",
  "Chaque expert a un jour été débutant.",
  "Ta vie peut changer en une décision — celle de continuer.",
  "On ne grandit pas dans la zone de confort.",
  "Le secret pour avancer, c'est de commencer.",
  "Fais aujourd'hui ce que les autres ne font pas, pour avoir demain ce que les autres n'auront pas.",
];

function getCitationDuJour(citations){
  const list=(citations&&citations.length>0)?citations:CITATIONS_DEFAULT;
  const today=new Date();
  const dayOfYear=Math.floor((today-new Date(today.getFullYear(),0,0))/86400000);
  return list[dayOfYear%list.length];
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────`;

if(content.includes(MARK1)){
  content = content.replace(MARK1, CITATIONS_BLOCK);
  console.log("✅ 1/3 — Liste de citations + fonction getCitationDuJour ajoutées");
} else {
  errors.push("1 — marqueur MAIN APP introuvable");
}

// ── 2. Ajouter la section éditeur dans AdminTab — avant section scripts (ou posts, ou diagnostics, selon ce qui existe) ──
const MARK2_A = `      {/* ── SECTION SCRIPTS SUPPLÉMENTAIRES ── */}`;
const MARK2_B = `      {/* ── SECTION POSTS SUPPLÉMENTAIRES ── */}`;
const MARK2_C = `      {/* ── SECTION DIAGNOSTICS PRODUITS ── */}`;

const TEXTES_SECTION = `      {/* ── SECTION TEXTES & CITATIONS ── */}
      <div style={{marginTop:"1.5rem",paddingTop:"1rem",borderTop:\`1px solid \${C.pale}\`}}>
        <div style={{fontSize:".7rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>💬 Citations & Messages</div>
        <p style={{fontSize:".72rem",color:C.gris,lineHeight:1.6,marginBottom:"1rem"}}>
          Gère les citations motivantes affichées sur la page d'accueil (une différente chaque jour) et le message d'accueil de l'équipe.
        </p>
        <AdminTextesEditor/>
      </div>

`;

if(content.includes(MARK2_A)){
  content = content.replace(MARK2_A, TEXTES_SECTION + MARK2_A);
  console.log("✅ 2/3 — Section éditeur textes ajoutée dans AdminTab (avant section scripts)");
} else if(content.includes(MARK2_B)){
  content = content.replace(MARK2_B, TEXTES_SECTION + MARK2_B);
  console.log("✅ 2/3 — Section éditeur textes ajoutée dans AdminTab (avant section posts)");
} else if(content.includes(MARK2_C)){
  content = content.replace(MARK2_C, TEXTES_SECTION + MARK2_C);
  console.log("✅ 2/3 — Section éditeur textes ajoutée dans AdminTab (avant section diagnostics)");
} else {
  errors.push("2 — aucun point d'insertion trouvé dans AdminTab");
}

// ── 3. Ajouter le composant AdminTextesEditor — avant "// ── BANQUE D'IMAGES" ──
const MARK3 = `// ── BANQUE D'IMAGES ───────────────────────────────────────────────────────────`;

const ADMIN_TEXTES_EDITOR = `// ── ADMIN TEXTES EDITOR ──────────────────────────────────────────────────────
function AdminTextesEditor(){
  const[citations,setCitations]=useState([]);
  const[messageAccueil,setMessageAccueil]=useState("");
  const[loaded,setLoaded]=useState(false);
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);
  const[newCitation,setNewCitation]=useState("");

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","textes"));
        if(snap.exists()){
          const d=snap.data();
          setCitations(d.citations||CITATIONS_DEFAULT);
          setMessageAccueil(d.messageAccueil||"");
        } else {
          setCitations(CITATIONS_DEFAULT);
        }
      }catch{
        setCitations(CITATIONS_DEFAULT);
      }
      setLoaded(true);
    })();
  },[]);

  const save=async(nextCitations,nextMsg)=>{
    setSaving(true);
    try{await setDoc(doc(db,"admin","textes"),{citations:nextCitations,messageAccueil:nextMsg});}catch{}
    setSaving(false);
    setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  };

  const addCitation=()=>{
    if(!newCitation.trim())return;
    const next=[...citations,newCitation.trim()];
    setCitations(next);
    setNewCitation("");
    save(next,messageAccueil);
  };

  const delCitation=(idx)=>{
    const next=citations.filter((_,i)=>i!==idx);
    setCitations(next);
    save(next,messageAccueil);
  };

  const saveMsg=()=>save(citations,messageAccueil);

  if(!loaded) return <div style={{fontSize:".74rem",color:C.gris}}>Chargement...</div>;

  return(
    <div>
      {/* Message d'accueil équipe */}
      <div style={{marginBottom:"1.25rem"}}>
        <div style={{fontSize:".65rem",fontWeight:700,color:C.brun,marginBottom:".4rem"}}>👋 Message d'accueil (page d'accueil de l'équipe)</div>
        <textarea
          placeholder="Ex: Bienvenue dans ton espace Blazing Dynasty ! On est fières de t'avoir avec nous 🖤"
          value={messageAccueil}
          onChange={e=>setMessageAccueil(e.target.value)}
          style={{width:"100%",minHeight:70,border:\`1px solid \${C.pale}\`,borderRadius:9,padding:".6rem .8rem",fontFamily:"inherit",fontSize:".76rem",color:C.texte,background:C.creme,resize:"vertical",outline:"none",lineHeight:1.6,marginBottom:".5rem"}}/>
        <button onClick={saveMsg} disabled={saving}
          style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:9,padding:".5rem",fontSize:".76rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          {saving?"Sauvegarde...":saved?"✅ Sauvegardé !":"Sauvegarder le message"}
        </button>
      </div>

      {/* Citations */}
      <div>
        <div style={{fontSize:".65rem",fontWeight:700,color:C.brun,marginBottom:".4rem"}}>✨ Citations motivantes ({citations.length})</div>
        <p style={{fontSize:".68rem",color:C.gris,marginBottom:".5rem",lineHeight:1.5}}>Une citation différente s'affiche chaque jour sur la page d'accueil, dans l'ordre du jour de l'année (rotation automatique).</p>
        <div style={{display:"flex",gap:".4rem",marginBottom:".75rem"}}>
          <input placeholder="Nouvelle citation..." value={newCitation} onChange={e=>setNewCitation(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addCitation()}
            style={{flex:1,border:\`1px solid \${C.pale}\`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
          <button onClick={addCitation} disabled={saving||!newCitation.trim()}
            style={{background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".42rem .8rem",fontSize:".76rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",flexShrink:0}}>
            Ajouter
          </button>
        </div>
        <div style={{maxHeight:280,overflowY:"auto"}}>
          {citations.map((c,i)=>(
            <div key={i} style={{background:C.blanc,border:\`1px solid \${C.pale}\`,borderRadius:8,padding:".5rem .7rem",marginBottom:".3rem",display:"flex",gap:".5rem",alignItems:"flex-start"}}>
              <div style={{flex:1,fontSize:".74rem",color:C.texte,fontStyle:"italic",lineHeight:1.5}}>{c}</div>
              <button onClick={()=>delCitation(i)} style={{background:"none",border:"none",color:"#B04040",cursor:"pointer",fontSize:".7rem",padding:".15rem",fontFamily:"inherit",flexShrink:0}}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── BANQUE D'IMAGES ───────────────────────────────────────────────────────────`;

if(content.includes(MARK3)){
  content = content.replace(MARK3, ADMIN_TEXTES_EDITOR);
  console.log("✅ 3/3 — Composant AdminTextesEditor ajouté");
} else {
  errors.push("3 — marqueur BANQUE D'IMAGES introuvable");
}

if(errors.length>0){
  console.error("");
  console.error("⚠️  ATTENTION — certaines étapes ont échoué :");
  errors.forEach(e=>console.error("   - "+e));
  console.error("");
  console.error("Le fichier N'A PAS été modifié. Aucun changement appliqué.");
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
console.log("");
console.log("ℹ️  NOTE : la citation du jour et le message d'accueil seront utilisés");
console.log("   à l'étape 5 (refonte de la page d'accueil).");
