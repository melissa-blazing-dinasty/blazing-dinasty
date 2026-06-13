// fix-2-admin-posts.js
// Lance avec : node fix-2-admin-posts.js
// À placer dans le même dossier que App.js (src/)

const fs = require("fs");
const path = require("path");

const APP_PATH = path.join(__dirname, "App.js");
const BACKUP_PATH = path.join(__dirname, "App.js.backup-adminposts-" + Date.now());

if (!fs.existsSync(APP_PATH)) {
  console.error("❌ App.js introuvable dans ce dossier.");
  process.exit(1);
}

let content = fs.readFileSync(APP_PATH, "utf8");
fs.writeFileSync(BACKUP_PATH, content, "utf8");
console.log("✅ Sauvegarde créée : " + path.basename(BACKUP_PATH));

let errors = [];

// ── 1. Ajouter le chargement des posts admin dans le composant App (près de adminItems) ──
const MARK1 = `  const[adminItems,setAdminItems]=useState([]);
  useEffect(()=>{
    if(screen!=="app")return;
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","contenus"));
        if(snap.exists())setAdminItems((snap.data().items||[]).filter(i=>i.actif));
      }catch{}
    })();
  },[screen]);`;

const REPLACE1 = `  const[adminItems,setAdminItems]=useState([]);
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

if(content.includes(MARK1)){
  content = content.replace(MARK1, REPLACE1);
  console.log("✅ 1/5 — Chargement adminPosts ajouté");
} else {
  errors.push("1 — bloc adminItems useEffect introuvable");
}

// ── 2. Passer adminPosts au composant CommunauteTab... non, à l'onglet contenu via props ──
// On va plutôt injecter directement dans le rendu de l'onglet "contenu" — chercher le Card "Tableau d'idées de posts"
const MARK2 = `            <Card title="Tableau d'idées de posts à cocher" sub={\`\${donePosts}/\${allPosts.length} posts utilisés\`} icon="📋" color={C.rose}>`;

const REPLACE2 = `            {adminPosts.length>0&&(
              <Card title="✨ Idées ajoutées par Melissa" sub={\`\${adminPosts.length} nouvelle\${adminPosts.length>1?"s":""} idée\${adminPosts.length>1?"s":""}\`} icon="🌟" color={C.or} defaultOpen>
                {adminPosts.map(theme=>(
                  <div key={theme.theme} style={{marginBottom:"1rem"}}>
                    <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",padding:".25rem .6rem",background:(theme.color||C.or)+"20",color:theme.color===C.or?C.brun2:(theme.color||C.brun2),borderRadius:20,display:"inline-block",marginBottom:".5rem"}}>{theme.theme}</div>
                    {theme.posts.map(post=>(
                      <div key={post.id} style={{background:posts[post.id]?C.pale+"80":C.creme,borderRadius:9,padding:".65rem .8rem",marginBottom:".35rem",border:\`1px solid \${posts[post.id]?C.rose:C.pale}\`,transition:"all .2s"}}>
                        <div style={{display:"flex",gap:".55rem",alignItems:"flex-start",marginBottom:posts[post.id]?0:".35rem"}}>
                          <div onClick={()=>tog("posts",post.id)} style={{width:18,height:18,borderRadius:4,border:\`2px solid \${posts[post.id]?C.rose:C.pale}\`,background:posts[post.id]?C.rose:"transparent",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all .15s"}}>
                            {posts[post.id]&&<span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>}
                          </div>
                          <div style={{fontSize:".76rem",fontWeight:600,color:posts[post.id]?C.gris:C.brun,textDecoration:posts[post.id]?"line-through":"none",flex:1}}>{post.hook}</div>
                          <CopyBtn text={post.hook+"\\n\\n"+post.caption}/>
                        </div>
                        {!posts[post.id]&&<div style={{fontSize:".71rem",color:C.gris,lineHeight:1.55,marginLeft:"1.45rem"}}>{post.caption}</div>}
                      </div>
                    ))}
                  </div>
                ))}
              </Card>
            )}

            <Card title="Tableau d'idées de posts à cocher" sub={\`\${donePosts}/\${allPosts.length} posts utilisés\`} icon="📋" color={C.rose}>`;

if(content.includes(MARK2)){
  content = content.replace(MARK2, REPLACE2);
  console.log("✅ 2/5 — Affichage des posts admin dans l'onglet Contenu ajouté");
} else {
  errors.push("2 — Card 'Tableau d'idées de posts' introuvable");
}

// ── 3. Ajouter l'éditeur dans AdminTab — juste avant la section diagnostics ──
const MARK3 = `      {/* ── SECTION DIAGNOSTICS PRODUITS ── */}
      <div style={{marginTop:"1.5rem",paddingTop:"1rem",borderTop:\`1px solid \${C.pale}\`}}>
        <div style={{fontSize:".7rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>🩺 Personnaliser les packs diagnostics</div>`;

const REPLACE3 = `      {/* ── SECTION POSTS SUPPLÉMENTAIRES ── */}
      <div style={{marginTop:"1.5rem",paddingTop:"1rem",borderTop:\`1px solid \${C.pale}\`}}>
        <div style={{fontSize:".7rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>📱 Ajouter des idées de posts</div>
        <p style={{fontSize:".72rem",color:C.gris,lineHeight:1.6,marginBottom:"1rem"}}>
          Ajoute de nouvelles idées de publications (hook + caption). Elles apparaîtront dans l'onglet Contenu pour toute l'équipe, dans une section "Idées ajoutées par Melissa".
        </p>
        <AdminPostsEditor/>
      </div>

      {/* ── SECTION DIAGNOSTICS PRODUITS ── */}
      <div style={{marginTop:"1.5rem",paddingTop:"1rem",borderTop:\`1px solid \${C.pale}\`}}>
        <div style={{fontSize:".7rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>🩺 Personnaliser les packs diagnostics</div>`;

if(content.includes(MARK3)){
  content = content.replace(MARK3, REPLACE3);
  console.log("✅ 3/5 — Section éditeur posts ajoutée dans AdminTab");
} else {
  errors.push("3 — section diagnostics dans AdminTab introuvable");
}

// ── 4. Ajouter le composant AdminPostsEditor — juste avant "// ── BANQUE D'IMAGES" ──
const MARK4 = `// ── BANQUE D'IMAGES ───────────────────────────────────────────────────────────`;

const ADMIN_POSTS_EDITOR = `// ── ADMIN POSTS EDITOR ───────────────────────────────────────────────────────
function AdminPostsEditor(){
  const[items,setItems]=useState([]);
  const[loaded,setLoaded]=useState(false);
  const[saving,setSaving]=useState(false);
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({theme:"",hook:"",caption:""});

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","posts_extra"));
        if(snap.exists()) setItems(snap.data().items||[]);
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const save=async(next)=>{
    setSaving(true);
    try{await setDoc(doc(db,"admin","posts_extra"),{items:next});}catch{}
    setItems(next);
    setSaving(false);
  };

  const add=()=>{
    if(!form.theme.trim()||!form.hook.trim()||!form.caption.trim())return;
    const postId="adm-post-"+Date.now();
    const themeKey=form.theme.trim();
    const existing=items.find(t=>t.theme===themeKey);
    let next;
    if(existing){
      next=items.map(t=>t.theme===themeKey?{...t,posts:[...t.posts,{id:postId,hook:form.hook.trim(),caption:form.caption.trim()}]}:t);
    } else {
      next=[...items,{theme:themeKey,color:C.or,posts:[{id:postId,hook:form.hook.trim(),caption:form.caption.trim()}]}];
    }
    save(next);
    setForm({theme:"",hook:"",caption:""});
    setShowAdd(false);
  };

  const delPost=(themeKey,postId)=>{
    let next=items.map(t=>t.theme===themeKey?{...t,posts:t.posts.filter(p=>p.id!==postId)}:t).filter(t=>t.posts.length>0);
    save(next);
  };

  const totalPosts=items.reduce((a,t)=>a+t.posts.length,0);

  if(!loaded) return <div style={{fontSize:".74rem",color:C.gris}}>Chargement...</div>;

  return(
    <div>
      <button onClick={()=>setShowAdd(p=>!p)}
        style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:"1rem"}}>
        ➕ Ajouter une idée de post ({totalPosts})
      </button>

      {showAdd&&(
        <div style={{background:C.creme,border:\`1px solid \${C.pale}\`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>Nouvelle idée</div>
          <input placeholder="Thème (ex: 🎉 Promo de printemps)" value={form.theme} onChange={e=>setForm(p=>({...p,theme:e.target.value}))}
            style={{width:"100%",border:\`1px solid \${C.pale}\`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".45rem"}}/>
          <input placeholder="Hook (1ère phrase qui accroche)" value={form.hook} onChange={e=>setForm(p=>({...p,hook:e.target.value}))}
            style={{width:"100%",border:\`1px solid \${C.pale}\`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".45rem"}}/>
          <textarea placeholder="Caption complète (avec CTA)" value={form.caption} onChange={e=>setForm(p=>({...p,caption:e.target.value}))}
            style={{width:"100%",minHeight:80,border:\`1px solid \${C.pale}\`,borderRadius:8,padding:".5rem .65rem",fontFamily:"inherit",fontSize:".78rem",color:C.texte,background:C.blanc,resize:"vertical",outline:"none",lineHeight:1.6,marginBottom:".6rem"}}/>
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

      {items.map(theme=>(
        <div key={theme.theme} style={{marginBottom:".75rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",padding:".2rem .6rem",background:C.or+"20",color:C.brun2,borderRadius:20,display:"inline-block",marginBottom:".4rem"}}>{theme.theme}</div>
          {theme.posts.map(post=>(
            <div key={post.id} style={{background:C.blanc,border:\`1px solid \${C.pale}\`,borderRadius:9,padding:".55rem .75rem",marginBottom:".3rem",display:"flex",gap:".5rem",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:".75rem",fontWeight:600,color:C.brun}}>{post.hook}</div>
                <div style={{fontSize:".68rem",color:C.gris,marginTop:".15rem"}}>{post.caption}</div>
              </div>
              <button onClick={()=>delPost(theme.theme,post.id)} style={{background:"none",border:"none",color:"#B04040",cursor:"pointer",fontSize:".7rem",padding:".15rem",fontFamily:"inherit",flexShrink:0}}>✕</button>
            </div>
          ))}
        </div>
      ))}
      {items.length===0&&<div style={{fontSize:".73rem",color:C.gris,fontStyle:"italic"}}>Aucune idée ajoutée encore.</div>}
    </div>
  );
}

// ── BANQUE D'IMAGES ───────────────────────────────────────────────────────────`;

if(content.includes(MARK4)){
  content = content.replace(MARK4, ADMIN_POSTS_EDITOR);
  console.log("✅ 4/5 — Composant AdminPostsEditor ajouté");
} else {
  errors.push("4 — marqueur BANQUE D'IMAGES introuvable");
}

// ── 5. S'assurer que le composant ContenuTab (rendu inline dans App) a accès à adminPosts ──
// adminPosts est défini dans App() au même niveau que adminItems, et l'onglet contenu est rendu inline donc OK automatiquement.
console.log("✅ 5/5 — adminPosts accessible directement (rendu inline dans App)");

if(errors.length>0){
  console.error("");
  console.error("⚠️  ATTENTION — certaines étapes ont échoué :");
  errors.forEach(e=>console.error("   - "+e));
  console.error("");
  console.error("Le fichier N'A PAS été modifié pour préserver la cohérence. Aucun changement appliqué.");
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
