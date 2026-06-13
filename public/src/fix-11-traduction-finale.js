// fix-11-traduction-finale.js
// Lance avec : node fix-11-traduction-finale.js
// À placer dans le même dossier que App.js (src/)

const fs = require("fs");
const path = require("path");

const APP_PATH = path.join(__dirname, "App.js");
const BACKUP_PATH = path.join(__dirname, "App.js.backup-traductionFINALE-" + Date.now());

if (!fs.existsSync(APP_PATH)) {
  console.error("❌ App.js introuvable dans ce dossier.");
  process.exit(1);
}

let content = fs.readFileSync(APP_PATH, "utf8");

// ── VÉRIFICATIONS PRÉALABLES : s'assurer qu'aucun système de traduction n'existe déjà ──
const preCheckT = (content.match(/function T\(\{children\}\)/g) || []).length;
const preCheckLang = (content.match(/LangContext/g) || []).length;

console.log("ℹ️  Vérification préalable :");
console.log("   function T : " + preCheckT + " (doit être 0)");
console.log("   LangContext : " + preCheckLang + " (doit être 0)");

if(preCheckT > 0 || preCheckLang > 0){
  console.error("");
  console.error("❌ Un système de traduction existe déjà dans ce fichier !");
  console.error("   Ce script est conçu pour partir d'une base SANS traduction.");
  console.error("   Aucune modification effectuée.");
  process.exit(1);
}

// ── Vérifier les marqueurs nécessaires ──
const MARK_FIRST_IMPORT = `import { useState, useCallback, useEffect } from "react";`;
const MARK_HELPERS = `// ── HELPERS ───────────────────────────────────────────────────────────────────`;
const MARK_SECTITLE = `function SecTitle({title,em,desc}){
  return <>
    <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
      {title} <em style={{fontStyle:"italic",color:C.rose}}>{em}</em>
    </div>
    {desc&&<p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>{desc}</p>}
  </>;
}`;
const MARK_WRAPPER_OPEN = `  return(
    <div
      style={{minHeight:"100vh",background:C.creme,fontFamily:"'DM Sans',system-ui,sans-serif",color:C.texte,userSelect:"none"}}
      onContextMenu={e=>e.preventDefault()}
      onCopy={e=>e.preventDefault()}
      onCut={e=>e.preventDefault()}
    >`;
const MARK_WRAPPER_CLOSE = `          <ObjectifsPopup uid={userId}/>
        </div>
      )}
    </div>
  );
}`;

const checks = [
  ["import React principal", content.includes(MARK_FIRST_IMPORT)],
  ["marqueur HELPERS", (content.match(new RegExp(MARK_HELPERS.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),"g"))||[]).length === 1],
  ["SecTitle (version simple)", content.includes(MARK_SECTITLE)],
  ["wrapper ouverture App()", content.includes(MARK_WRAPPER_OPEN)],
  ["wrapper fermeture App() (popup objectifs)", content.includes(MARK_WRAPPER_CLOSE)],
];

console.log("");
console.log("ℹ️  Vérification des marqueurs requis :");
let allOk = true;
checks.forEach(([name, ok])=>{
  console.log("   " + (ok?"✅":"❌") + " " + name);
  if(!ok) allOk = false;
});

if(!allOk){
  console.error("");
  console.error("❌ Au moins un marqueur requis est manquant ou en double. Aucune modification effectuée.");
  process.exit(1);
}

// ── TOUT EST OK : sauvegarde puis modifications ──
fs.writeFileSync(BACKUP_PATH, content, "utf8");
console.log("");
console.log("✅ Sauvegarde créée : " + path.basename(BACKUP_PATH));

// 1. Import
content = content.replace(
  MARK_FIRST_IMPORT,
  `import { useState, useCallback, useEffect, createContext, useContext } from "react";`
);
console.log("✅ 1/4 — Import createContext/useContext ajouté");

// 2. Bloc translation + T, avant HELPERS
const TRANSLATION_BLOCK = `// ── TRADUCTION À LA VOLÉE (FR ↔ PT) ──────────────────────────────────────────
const LangContext = createContext({ lang: "fr" });

const translationMemCache = {};

async function translateText(text, targetLang){
  if(!text || !text.trim()) return text;
  if(targetLang==="fr") return text;

  const cacheKey = targetLang+"::"+text;
  if(translationMemCache[cacheKey]) return translationMemCache[cacheKey];

  try{
    const docId = btoa(unescape(encodeURIComponent(cacheKey))).replace(/[\\/+=]/g,"_").slice(0,500);
    const ref = doc(db,"traductions",docId);
    const snap = await getDoc(ref);
    if(snap.exists() && snap.data().translated){
      translationMemCache[cacheKey] = snap.data().translated;
      return snap.data().translated;
    }
  } catch {}

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
    try{
      const docId = btoa(unescape(encodeURIComponent(cacheKey))).replace(/[\\/+=]/g,"_").slice(0,500);
      await setDoc(doc(db,"traductions",docId),{original:text,translated,lang:targetLang});
    } catch {}

    return translated;
  } catch {
    return text;
  }
}

function T({children}){
  const ctx = useContext(LangContext);
  const lang = ctx.lang;
  const [display, setDisplay] = useState(children);

  useEffect(()=>{
    if(lang==="fr"){ setDisplay(children); return; }
    let cancelled=false;
    translateText(children, lang).then(t=>{ if(!cancelled) setDisplay(t); });
    return ()=>{ cancelled=true; };
  },[lang, children]);

  return display;
}

${MARK_HELPERS}`;

content = content.replace(MARK_HELPERS, TRANSLATION_BLOCK);
console.log("✅ 2/4 — Bloc traduction + composant <T> ajouté");

// 3. SecTitle avec <T>
const SECTITLE_WITH_T = `function SecTitle({title,em,desc}){
  return <>
    <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
      <T>{title}</T> <em style={{fontStyle:"italic",color:C.rose}}><T>{em}</T></em>
    </div>
    {desc&&<p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}><T>{desc}</T></p>}
  </>;
}`;

content = content.replace(MARK_SECTITLE, SECTITLE_WITH_T);
console.log("✅ 3/4 — <T> appliqué dans SecTitle");

// 4. Provider ouverture + fermeture
const WRAPPER_OPEN_WITH_PROVIDER = `  return(
    <LangContext.Provider value={{lang}}>
    <div
      style={{minHeight:"100vh",background:C.creme,fontFamily:"'DM Sans',system-ui,sans-serif",color:C.texte,userSelect:"none"}}
      onContextMenu={e=>e.preventDefault()}
      onCopy={e=>e.preventDefault()}
      onCut={e=>e.preventDefault()}
    >`;

content = content.replace(MARK_WRAPPER_OPEN, WRAPPER_OPEN_WITH_PROVIDER);

const WRAPPER_CLOSE_WITH_PROVIDER = `          <ObjectifsPopup uid={userId}/>
        </div>
      )}
    </div>
    </LangContext.Provider>
  );
}`;

content = content.replace(MARK_WRAPPER_CLOSE, WRAPPER_CLOSE_WITH_PROVIDER);
console.log("✅ 4/4 — LangContext.Provider ajouté (ouverture + fermeture)");

// ── VÉRIFICATIONS FINALES ──
const finalT = (content.match(/function T\(\{children\}\)\{/g) || []).length;
const finalUseContext = (content.match(/useContext\(LangContext\)/g) || []).length;
const finalProviderOpen = (content.match(/<LangContext\.Provider value=\{\{lang\}\}>/g) || []).length;
const finalProviderClose = (content.match(/<\/LangContext\.Provider>/g) || []).length;
const finalT_SecTitle = (content.match(/<T>\{title\}<\/T>/g) || []).length;

console.log("");
console.log("── VÉRIFICATIONS FINALES ──");
console.log("function T              : " + finalT + " (attendu: 1)");
console.log("useContext(LangContext) : " + finalUseContext + " (attendu: 1)");
console.log("Provider ouverture      : " + finalProviderOpen + " (attendu: 1)");
console.log("Provider fermeture      : " + finalProviderClose + " (attendu: 1)");
console.log("<T> dans SecTitle       : " + finalT_SecTitle + " (attendu: 1)");

const finalOk = finalT===1 && finalUseContext===1 && finalProviderOpen===1 && finalProviderClose===1 && finalT_SecTitle===1;

if(!finalOk){
  console.error("");
  console.error("❌ Vérifications finales non conformes. Le fichier N'A PAS été écrit.");
  process.exit(1);
}

fs.writeFileSync(APP_PATH, content, "utf8");
console.log("");
console.log("✅✅✅ App.js mis à jour avec succès — traduction PT prête !");
console.log("");
console.log("👉 Prochaines étapes :");
console.log("   1. npm run build");
console.log("   2. firebase deploy");
console.log("");
console.log("ℹ️  Test : onglet 🏢 Mihi (ou autre), clique sur 🇵🇹 — le titre");
console.log("   et la description doivent se traduire en portugais.");
console.log("");
console.log("ℹ️  Si quelque chose ne va pas, restaure la sauvegarde :");
console.log("   " + path.basename(BACKUP_PATH) + " → renomme-le en App.js");
