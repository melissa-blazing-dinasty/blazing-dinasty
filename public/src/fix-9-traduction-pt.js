// fix-9-traduction-pt.js
// Lance avec : node fix-9-traduction-pt.js
// À placer dans le même dossier que App.js (src/)

const fs = require("fs");
const path = require("path");

const APP_PATH = path.join(__dirname, "App.js");
const BACKUP_PATH = path.join(__dirname, "App.js.backup-traductionPT-" + Date.now());

if (!fs.existsSync(APP_PATH)) {
  console.error("❌ App.js introuvable dans ce dossier.");
  process.exit(1);
}

let content = fs.readFileSync(APP_PATH, "utf8");
fs.writeFileSync(BACKUP_PATH, content, "utf8");
console.log("✅ Sauvegarde créée : " + path.basename(BACKUP_PATH));

let errors = [];

// ── 1. Ajouter le contexte de langue global + composant <T> + fonction de traduction ──
// On insère juste avant "// ── HELPERS"
const MARK1 = `// ── HELPERS ───────────────────────────────────────────────────────────────────`;

const TRANSLATION_BLOCK = `// ── TRADUCTION À LA VOLÉE (FR ↔ PT) ──────────────────────────────────────────
import { createContext, useContext } from "react";

const LangContext = createContext({ lang: "fr" });

// Cache mémoire (par session) pour éviter de re-traduire le même texte plusieurs fois
const translationMemCache = {};

async function translateText(text, targetLang){
  if(!text || !text.trim()) return text;
  if(targetLang==="fr") return text;

  const cacheKey = targetLang+"::"+text;
  if(translationMemCache[cacheKey]) return translationMemCache[cacheKey];

  // Vérifier le cache Firestore
  try{
    const docId = btoa(unescape(encodeURIComponent(cacheKey))).replace(/[\\/+=]/g,"_").slice(0,500);
    const ref = doc(db,"traductions",docId);
    const snap = await getDoc(ref);
    if(snap.exists() && snap.data().translated){
      translationMemCache[cacheKey] = snap.data().translated;
      return snap.data().translated;
    }
  } catch {}

  // Appel API pour traduire
  try{
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "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",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        messages: [{ role: "user", content: \`Traduis ce texte du français vers le portugais (portugais du Portugal). Réponds UNIQUEMENT avec la traduction, sans aucun commentaire, sans guillemets, sans markdown:\\n\\n\${text}\` }]
      })
    });
    const data = await response.json();
    if(data.error) return text;
    const translated = (data.content?.map(i=>i.text||"").join("")||"").trim();
    if(!translated) return text;

    translationMemCache[cacheKey] = translated;
    // Sauvegarder dans Firestore pour la prochaine fois
    try{
      const docId = btoa(unescape(encodeURIComponent(cacheKey))).replace(/[\\/+=]/g,"_").slice(0,500);
      await setDoc(doc(db,"traductions",docId),{original:text,translated,lang:targetLang});
    } catch {}

    return translated;
  } catch {
    return text;
  }
}

// Composant <T>texte</T> — traduit automatiquement selon la langue active
function T({children}){
  const { lang } = useContext(LangContext);
  const [display, setDisplay] = useState(children);

  useEffect(()=>{
    if(lang==="fr"){ setDisplay(children); return; }
    let cancelled=false;
    translateText(children, lang).then(t=>{ if(!cancelled) setDisplay(t); });
    return ()=>{ cancelled=true; };
  },[lang, children]);

  return display;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────`;

if(content.includes(MARK1)){
  content = content.replace(MARK1, TRANSLATION_BLOCK);
  console.log("✅ 1/3 — Système de traduction (LangContext, translateText, <T>) ajouté");
} else {
  errors.push("1 — marqueur HELPERS introuvable");
}

// ── 2. Appliquer <T> dans SecTitle ──
const MARK2 = `function SecTitle({title,em,desc}){
  return <>
    <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
      {title} <em style={{fontStyle:"italic",color:C.rose}}>{em}</em>
    </div>
    {desc&&<p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>{desc}</p>}
  </>;
}`;

const REPLACE2 = `function SecTitle({title,em,desc}){
  return <>
    <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
      <T>{title}</T> <em style={{fontStyle:"italic",color:C.rose}}><T>{em}</T></em>
    </div>
    {desc&&<p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}><T>{desc}</T></p>}
  </>;
}`;

if(content.includes(MARK2)){
  content = content.replace(MARK2, REPLACE2);
  console.log("✅ 2/3 — <T> appliqué dans SecTitle (titres + descriptions de tous les onglets)");
} else {
  errors.push("2 — fonction SecTitle introuvable");
}

// ── 3. Englober l'app dans le LangContext.Provider — juste après la déclaration du return de l'app principale ──
// On cible le wrapper principal après le calcul de showPeriodeBanner
const MARK3 = `  return(
    <div
      style={{minHeight:"100vh",background:C.creme,fontFamily:"'DM Sans',system-ui,sans-serif",color:C.texte,userSelect:"none"}}
      onContextMenu={e=>e.preventDefault()}
      onCopy={e=>e.preventDefault()}
      onCut={e=>e.preventDefault()}
    >`;

const REPLACE3 = `  return(
    <LangContext.Provider value={{lang}}>
    <div
      style={{minHeight:"100vh",background:C.creme,fontFamily:"'DM Sans',system-ui,sans-serif",color:C.texte,userSelect:"none"}}
      onContextMenu={e=>e.preventDefault()}
      onCopy={e=>e.preventDefault()}
      onCut={e=>e.preventDefault()}
    >`;

if(content.includes(MARK3)){
  content = content.replace(MARK3, REPLACE3);
  console.log("✅ 3a/3 — Ouverture LangContext.Provider ajoutée");

  // Fermer le Provider à la fin du composant App — juste avant le dernier "}" de App()
  // On cherche le pattern de fin: la fermeture de la div principale suivie de "}" final de App
  const MARK3B = `      {showObjectifs&&(
        <div style={{position:"fixed",bottom:"8rem",right:"1.2rem",width:285,background:C.blanc,borderRadius:16,boxShadow:"0 8px 32px rgba(61,31,14,.25)",border:\`1px solid \${C.pale}\`,zIndex:199,overflow:"hidden"}}>
          <div style={{background:C.brun,padding:".85rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",gap:".6rem",alignItems:"center"}}>
              <span style={{fontSize:"1.4rem"}}>👑</span>
              <div>
                <div style={{fontSize:".55rem",fontWeight:700,letterSpacing:".15em",color:C.or}}>✦ OBJECTIFS ÉQUIPE</div>
                <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",color:C.blanc,fontWeight:300}}>Ce mois-ci</div>
              </div>
            </div>
          </div>
          <ObjectifsPopup uid={userId}/>
        </div>
      )}
    </div>
  );
}`;

  const REPLACE3B = `      {showObjectifs&&(
        <div style={{position:"fixed",bottom:"8rem",right:"1.2rem",width:285,background:C.blanc,borderRadius:16,boxShadow:"0 8px 32px rgba(61,31,14,.25)",border:\`1px solid \${C.pale}\`,zIndex:199,overflow:"hidden"}}>
          <div style={{background:C.brun,padding:".85rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",gap:".6rem",alignItems:"center"}}>
              <span style={{fontSize:"1.4rem"}}>👑</span>
              <div>
                <div style={{fontSize:".55rem",fontWeight:700,letterSpacing:".15em",color:C.or}}>✦ OBJECTIFS ÉQUIPE</div>
                <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",color:C.blanc,fontWeight:300}}>Ce mois-ci</div>
              </div>
            </div>
          </div>
          <ObjectifsPopup uid={userId}/>
        </div>
      )}
    </div>
    </LangContext.Provider>
  );
}`;

  if(content.includes(MARK3B)){
    content = content.replace(MARK3B, REPLACE3B);
    console.log("✅ 3b/3 — Fermeture LangContext.Provider ajoutée");
  } else {
    errors.push("3b — fin du composant App (popup objectifs) introuvable — Provider ouvert mais pas fermé !");
  }
} else {
  errors.push("3a — wrapper principal de l'app introuvable");
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
console.log("ℹ️  Test : clique sur le bouton 🇵🇹 en haut à droite — les titres et");
console.log("   descriptions de chaque onglet devraient se traduire en portugais");
console.log("   (premier chargement un peu lent, puis instantané grâce au cache).");
console.log("");
console.log("ℹ️  Si quelque chose ne va pas, restaure la sauvegarde :");
console.log("   " + path.basename(BACKUP_PATH) + " → renomme-le en App.js");
