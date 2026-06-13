// fix-3-admin-scripts.js
// Lance avec : node fix-3-admin-scripts.js
// À placer dans le même dossier que App.js (src/)

const fs = require("fs");
const path = require("path");

const APP_PATH = path.join(__dirname, "App.js");
const BACKUP_PATH = path.join(__dirname, "App.js.backup-adminscripts-" + Date.now());

if (!fs.existsSync(APP_PATH)) {
  console.error("❌ App.js introuvable dans ce dossier.");
  process.exit(1);
}

let content = fs.readFileSync(APP_PATH, "utf8");
fs.writeFileSync(BACKUP_PATH, content, "utf8");
console.log("✅ Sauvegarde créée : " + path.basename(BACKUP_PATH));

let errors = [];

// ── 1. Modifier ScriptsTab pour charger et afficher les scripts admin ──
const MARK1 = `function ScriptsTab(){
  const[open,setOpen]=useState({});
  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Bibliothèque <em style={{fontStyle:"italic",color:C.rose}}>Scripts</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Scripts prêts à utiliser. Adapte toujours à ta voix — copie et personnalise.
      </p>
      {SCRIPTS_DATA.map(cat=>(`;

const REPLACE1 = `function ScriptsTab(){
  const[open,setOpen]=useState({});
  const[adminScripts,setAdminScripts]=useState([]);
  const[loaded,setLoaded]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","scripts_extra"));
        if(snap.exists()) setAdminScripts(snap.data().items||[]);
      }catch{}
      setLoaded(true);
    })();
  },[]);

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Bibliothèque <em style={{fontStyle:"italic",color:C.rose}}>Scripts</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Scripts prêts à utiliser. Adapte toujours à ta voix — copie et personnalise.
      </p>

      {loaded&&adminScripts.length>0&&(
        <div style={{marginBottom:"1rem"}}>
          <div style={{fontSize:".65rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.brun,marginBottom:".5rem",padding:".25rem .7rem",background:C.or+"30",borderRadius:20,display:"inline-block"}}>✨ Ajoutés par Melissa</div>
          {adminScripts.map(cat=>{
            const isOpen=open["adm-"+cat.cat];
            return(
            <div key={"adm-"+cat.cat}>
              <div style={{fontSize:".65rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.brun,marginBottom:".5rem",marginTop:".5rem",padding:".25rem .7rem",background:C.pale,borderRadius:20,display:"inline-block"}}>{cat.cat}</div>
              {cat.scripts.map(s=>{
                const isOpenS=open["adm-"+s.title];
                return(
                  <div key={"adm-"+s.title} style={{background:C.blanc,border:\`1px solid \${isOpenS?C.rose:C.pale}\`,borderRadius:12,marginBottom:".45rem",overflow:"hidden"}}>
                    <div onClick={()=>setOpen(p=>({...p,["adm-"+s.title]:!p["adm-"+s.title]}))}
                      style={{padding:".7rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",userSelect:"none"}}>
                      <div style={{fontSize:".8rem",fontWeight:600,color:C.brun}}>{s.title}</div>
                      <div style={{display:"flex",gap:".5rem",alignItems:"center"}}>
                        <CopyBtn text={s.text}/>
                        <span style={{color:C.rose,fontSize:".65rem",transform:isOpenS?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
                      </div>
                    </div>
                    {isOpenS&&(
                      <div style={{borderTop:\`1px solid \${C.pale}\`,padding:".7rem 1rem .85rem",background:C.creme}}>
                        <p style={{fontSize:".78rem",color:C.texte,lineHeight:1.75,margin:0,fontStyle:"italic"}}>{s.text}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            );
          })}
        </div>
      )}

      {SCRIPTS_DATA.map(cat=>(`;

if(content.includes(MARK1)){
  content = content.replace(MARK1, REPLACE1);
  console.log("✅ 1/3 — ScriptsTab modifié pour afficher les scripts admin");
} else {
  errors.push("1 — fonction ScriptsTab introuvable");
}

// ── 2. Ajouter la section éditeur dans AdminTab — avant la section posts (juste insérée à l'étape 2) ou avant diagnostics ──
const MARK2_A = `      {/* ── SECTION POSTS SUPPLÉMENTAIRES ── */}`;
const MARK2_B = `      {/* ── SECTION DIAGNOSTICS PRODUITS ── */}`;

const SCRIPTS_SECTION = `      {/* ── SECTION SCRIPTS SUPPLÉMENTAIRES ── */}
      <div style={{marginTop:"1.5rem",paddingTop:"1rem",borderTop:\`1px solid \${C.pale}\`}}>
        <div style={{fontSize:".7rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>📝 Ajouter des scripts</div>
        <p style={{fontSize:".72rem",color:C.gris,lineHeight:1.6,marginBottom:"1rem"}}>
          Ajoute de nouveaux scripts prêts à l'emploi. Ils apparaîtront dans la Bibliothèque Scripts pour toute l'équipe, dans une section "Ajoutés par Melissa".
        </p>
        <AdminScriptsEditor/>
      </div>

`;

if(content.includes(MARK2_A)){
  content = content.replace(MARK2_A, SCRIPTS_SECTION + MARK2_A);
  console.log("✅ 2/3 — Section éditeur scripts ajoutée dans AdminTab (avant section posts)");
} else if(content.includes(MARK2_B)){
  content = content.replace(MARK2_B, SCRIPTS_SECTION + MARK2_B);
  console.log("✅ 2/3 — Section éditeur scripts ajoutée dans AdminTab (avant section diagnostics)");
} else {
  errors.push("2 — aucun point d'insertion trouvé dans AdminTab");
}

// ── 3. Ajouter le composant AdminScriptsEditor — avant "// ── BANQUE D'IMAGES" ──
const MARK3 = `// ── BANQUE D'IMAGES ───────────────────────────────────────────────────────────`;

const ADMIN_SCRIPTS_EDITOR = `// ── ADMIN SCRIPTS EDITOR ─────────────────────────────────────────────────────
function AdminScriptsEditor(){
  const[items,setItems]=useState([]);
  const[loaded,setLoaded]=useState(false);
  const[saving,setSaving]=useState(false);
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({cat:"",title:"",text:""});

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","scripts_extra"));
        if(snap.exists()) setItems(snap.data().items||[]);
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const save=async(next)=>{
    setSaving(true);
    try{await setDoc(doc(db,"admin","scripts_extra"),{items:next});}catch{}
    setItems(next);
    setSaving(false);
  };

  const add=()=>{
    if(!form.cat.trim()||!form.title.trim()||!form.text.trim())return;
    const catKey=form.cat.trim();
    const existing=items.find(c=>c.cat===catKey);
    let next;
    if(existing){
      next=items.map(c=>c.cat===catKey?{...c,scripts:[...c.scripts,{title:form.title.trim(),text:form.text.trim()}]}:c);
    } else {
      next=[...items,{cat:catKey,scripts:[{title:form.title.trim(),text:form.text.trim()}]}];
    }
    save(next);
    setForm({cat:"",title:"",text:""});
    setShowAdd(false);
  };

  const delScript=(catKey,title)=>{
    let next=items.map(c=>c.cat===catKey?{...c,scripts:c.scripts.filter(s=>s.title!==title)}:c).filter(c=>c.scripts.length>0);
    save(next);
  };

  const total=items.reduce((a,c)=>a+c.scripts.length,0);

  if(!loaded) return <div style={{fontSize:".74rem",color:C.gris}}>Chargement...</div>;

  return(
    <div>
      <button onClick={()=>setShowAdd(p=>!p)}
        style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:"1rem"}}>
        ➕ Ajouter un script ({total})
      </button>

      {showAdd&&(
        <div style={{background:C.creme,border:\`1px solid \${C.pale}\`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>Nouveau script</div>
          <input placeholder="Catégorie (ex: 💬 Premier contact)" value={form.cat} onChange={e=>setForm(p=>({...p,cat:e.target.value}))}
            style={{width:"100%",border:\`1px solid \${C.pale}\`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".45rem"}}/>
          <input placeholder="Titre du script" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}
            style={{width:"100%",border:\`1px solid \${C.pale}\`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".45rem"}}/>
          <textarea placeholder="Texte du script" value={form.text} onChange={e=>setForm(p=>({...p,text:e.target.value}))}
            style={{width:"100%",minHeight:90,border:\`1px solid \${C.pale}\`,borderRadius:8,padding:".5rem .65rem",fontFamily:"inherit",fontSize:".78rem",color:C.texte,background:C.blanc,resize:"vertical",outline:"none",lineHeight:1.6,marginBottom:".6rem"}}/>
          <div style={{display:"flex",gap:".4rem"}}>
            <button onClick={add} disabled={saving} style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              {saving?"...":"Ajouter"}
            </button>
            <button onClick={()=>setShowAdd(false)} style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {items.map(cat=>(
        <div key={cat.cat} style={{marginBottom:".75rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",padding:".2rem .6rem",background:C.or+"20",color:C.brun2,borderRadius:20,display:"inline-block",marginBottom:".4rem"}}>{cat.cat}</div>
          {cat.scripts.map(s=>(
            <div key={s.title} style={{background:C.blanc,border:\`1px solid \${C.pale}\`,borderRadius:9,padding:".55rem .75rem",marginBottom:".3rem",display:"flex",gap:".5rem",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:".75rem",fontWeight:600,color:C.brun}}>{s.title}</div>
                <div style={{fontSize:".68rem",color:C.gris,marginTop:".15rem"}}>{s.text}</div>
              </div>
              <button onClick={()=>delScript(cat.cat,s.title)} style={{background:"none",border:"none",color:"#B04040",cursor:"pointer",fontSize:".7rem",padding:".15rem",fontFamily:"inherit",flexShrink:0}}>✕</button>
            </div>
          ))}
        </div>
      ))}
      {items.length===0&&<div style={{fontSize:".73rem",color:C.gris,fontStyle:"italic"}}>Aucun script ajouté encore.</div>}
    </div>
  );
}

// ── BANQUE D'IMAGES ───────────────────────────────────────────────────────────`;

if(content.includes(MARK3)){
  content = content.replace(MARK3, ADMIN_SCRIPTS_EDITOR);
  console.log("✅ 3/3 — Composant AdminScriptsEditor ajouté");
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
