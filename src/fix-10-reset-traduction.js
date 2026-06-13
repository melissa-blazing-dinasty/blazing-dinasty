// fix-10-reset-traduction.js
// Lance avec : node fix-10-reset-traduction.js
// À placer dans le même dossier que App.js (src/)

const fs = require("fs");
const path = require("path");

const APP_PATH = path.join(__dirname, "App.js");
const BACKUP_PATH = path.join(__dirname, "App.js.backup-reset10-" + Date.now());

if (!fs.existsSync(APP_PATH)) {
  console.error("❌ App.js introuvable dans ce dossier.");
  process.exit(1);
}

let content = fs.readFileSync(APP_PATH, "utf8");
fs.writeFileSync(BACKUP_PATH, content, "utf8");
console.log("✅ Sauvegarde créée : " + path.basename(BACKUP_PATH));

let errors = [];

// ── ÉTAPE 1 : Supprimer TOUS les blocs de traduction existants ──
// Bloc identifié par la signature de début et la fonction T à la fin
const BLOCK_START = "// ── TRADUCTION À LA VOLÉE (FR ↔ PT) ──────────────────────────────────────────";
const T_END_MARKER = "\n  return display;\n}\n";

let removedBlocks = 0;
while(true){
  const startIdx = content.indexOf(BLOCK_START);
  if(startIdx === -1) break;
  const tEndIdx = content.indexOf(T_END_MARKER, startIdx);
  if(tEndIdx === -1) {
    errors.push("Bloc de traduction trouvé mais fin (function T) introuvable — arrêt pour sécurité");
    break;
  }
  const endIdx = tEndIdx + T_END_MARKER.length;
  content = content.slice(0, startIdx) + content.slice(endIdx);
  removedBlocks++;
  if(removedBlocks > 10) break;
}
console.log("ℹ️  Blocs de traduction supprimés : " + removedBlocks);

if(removedBlocks === 0){
  errors.push("Aucun bloc de traduction trouvé à supprimer — fix-9 a-t-il bien été appliqué initialement ?");
}

// ── ÉTAPE 2 : Nettoyer les éventuels Provider orphelins (ouverture sans fermeture, etc.) ──
const openCount = (content.match(/LangContext\.Provider value=\{\{lang\}\}/g) || []).length;
const closeCount = (content.match(/<\/LangContext\.Provider>/g) || []).length;
console.log("ℹ️  Provider ouverture restants avant nettoyage : " + openCount);
console.log("ℹ️  Provider fermeture restants avant nettoyage : " + closeCount);

// Supprimer "<LangContext.Provider value={{lang}}>\n" isolé
content = content.split("    <LangContext.Provider value={{lang}}>\n").join("");
content = content.split("<LangContext.Provider value={{lang}}>").join("");
// Supprimer "</LangContext.Provider>\n" isolé (avec indentation possible)
content = content.split("    </LangContext.Provider>\n").join("");
content = content.split("</LangContext.Provider>").join("");

const openCountAfter = (content.match(/LangContext\.Provider/g) || []).length;
console.log("ℹ️  Références LangContext.Provider restantes après nettoyage : " + openCountAfter);

// ── ÉTAPE 3 : Retirer <T>...</T> autour des titres/desc dans SecTitle (revenir au texte brut) ──
const SECTITLE_WITH_T = `function SecTitle({title,em,desc}){
  return <>
    <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
      <T>{title}</T> <em style={{fontStyle:"italic",color:C.rose}}><T>{em}</T></em>
    </div>
    {desc&&<p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}><T>{desc}</T></p>}
  </>;
}`;

const SECTITLE_PLAIN = `function SecTitle({title,em,desc}){
  return <>
    <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
      {title} <em style={{fontStyle:"italic",color:C.rose}}>{em}</em>
    </div>
    {desc&&<p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>{desc}</p>}
  </>;
}`;

if(content.includes(SECTITLE_WITH_T)){
  content = content.replace(SECTITLE_WITH_T, SECTITLE_PLAIN);
  console.log("✅ SecTitle remis en version simple (sans <T>)");
} else {
  console.log("ℹ️  SecTitle avec <T> non trouvé tel quel (peut-être déjà simple)");
}

// ── ÉTAPE 4 : Nettoyer l'import createContext/useContext ajouté par erreur ──
const FIRST_IMPORT_WITH_CONTEXT = `import { useState, useCallback, useEffect, createContext, useContext } from "react";`;
const FIRST_IMPORT_PLAIN = `import { useState, useCallback, useEffect, createContext, useContext } from "react";`;
// On garde createContext/useContext dans l'import principal (ne fait pas de mal), on s'assure juste qu'il n'y a pas de doublon d'import
const occImports = (content.match(/import \{ createContext, useContext \} from "react";/g) || []).length;
if(occImports > 0){
  content = content.split('import { createContext, useContext } from "react";\n\n').join("");
  content = content.split('import { createContext, useContext } from "react";\n').join("");
  content = content.split('import { createContext, useContext } from "react";').join("");
  console.log("✅ Import createContext/useContext orphelin supprimé (" + occImports + " occurrence(s))");
}

if(errors.length>0){
  console.error("");
  console.error("⚠️  ATTENTION — erreurs durant le nettoyage :");
  errors.forEach(e=>console.error("   - "+e));
  console.error("");
  console.error("Le fichier N'A PAS été modifié. Aucun changement appliqué.");
  process.exit(1);
}

// ── ÉTAPE 5 : Réinsérer un bloc COMPLET et PROPRE (translation + T + Provider) ──

// 5a. Bloc translation + T, avant "// ── HELPERS"
const MARK_HELPERS = `// ── HELPERS ───────────────────────────────────────────────────────────────────`;

const CLEAN_TRANSLATION_BLOCK = `${BLOCK_START}
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

const helpersOccurrences = (content.match(/\/\/ ── HELPERS/g) || []).length;
if(helpersOccurrences !== 1){
  console.error("❌ Nombre de marqueurs HELPERS = " + helpersOccurrences + " (attendu: 1). Annulation pour sécurité.");
  process.exit(1);
}

content = content.replace(MARK_HELPERS, CLEAN_TRANSLATION_BLOCK);
console.log("✅ Bloc translation + T réinséré proprement");

// 5b. Réappliquer <T> dans SecTitle
content = content.replace(SECTITLE_PLAIN, SECTITLE_WITH_T);
console.log("✅ <T> réappliqué dans SecTitle");

// 5c. Réinsérer le Provider — ouverture
const MARK_OPEN = `  return(
    <div
      style={{minHeight:"100vh",background:C.creme,fontFamily:"'DM Sans',system-ui,sans-serif",color:C.texte,userSelect:"none"}}
      onContextMenu={e=>e.preventDefault()}
      onCopy={e=>e.preventDefault()}
      onCut={e=>e.preventDefault()}
    >`;

const REPLACE_OPEN = `  return(
    <LangContext.Provider value={{lang}}>
    <div
      style={{minHeight:"100vh",background:C.creme,fontFamily:"'DM Sans',system-ui,sans-serif",color:C.texte,userSelect:"none"}}
      onContextMenu={e=>e.preventDefault()}
      onCopy={e=>e.preventDefault()}
      onCut={e=>e.preventDefault()}
    >`;

const markOpenCount = (content.match(/<div\s*\n\s*style=\{\{minHeight:"100vh",background:C\.creme/g) || []).length;
console.log("ℹ️  Occurrences du wrapper principal trouvées : " + markOpenCount);

if(content.includes(MARK_OPEN)){
  content = content.replace(MARK_OPEN, REPLACE_OPEN);
  console.log("✅ Provider — ouverture réinsérée");
} else {
  errors.push("Wrapper principal de App() introuvable pour insérer le Provider (ouverture)");
}

// 5d. Réinsérer le Provider — fermeture, juste avant le dernier "</div>\n  );\n}" de App()
// On cible la fin spécifique : après le popup ObjectifsPopup
const MARK_CLOSE = `          <ObjectifsPopup uid={userId}/>
        </div>
      )}
    </div>
  );
}`;

const REPLACE_CLOSE = `          <ObjectifsPopup uid={userId}/>
        </div>
      )}
    </div>
    </LangContext.Provider>
  );
}`;

if(content.includes(MARK_CLOSE)){
  content = content.replace(MARK_CLOSE, REPLACE_CLOSE);
  console.log("✅ Provider — fermeture réinsérée");
} else {
  errors.push("Fin de App() (après ObjectifsPopup) introuvable pour fermer le Provider");
}

// ── VÉRIFICATIONS FINALES ──
const finalOpen = (content.match(/<LangContext\.Provider value=\{\{lang\}\}>/g) || []).length;
const finalClose = (content.match(/<\/LangContext\.Provider>/g) || []).length;
const finalT = (content.match(/function T\(\{children\}\)\{/g) || []).length;
const finalUseContext = (content.match(/useContext\(LangContext\)/g) || []).length;
const finalCreateContext = (content.match(/createContext/g) || []).length;

console.log("");
console.log("── VÉRIFICATIONS FINALES ──");
console.log("Provider ouverture : " + finalOpen + " (attendu: 1)");
console.log("Provider fermeture : " + finalClose + " (attendu: 1)");
console.log("function T          : " + finalT + " (attendu: 1)");
console.log("useContext(LangContext) : " + finalUseContext + " (attendu: 1)");
console.log("createContext (total, incl. import) : " + finalCreateContext + " (attendu: 2)");

if(finalOpen!==1 || finalClose!==1 || finalT!==1 || finalUseContext!==1){
  errors.push("Vérifications finales non conformes — voir détails ci-dessus");
}

if(errors.length>0){
  console.error("");
  console.error("⚠️  ATTENTION — problèmes détectés :");
  errors.forEach(e=>console.error("   - "+e));
  console.error("");
  console.error("Le fichier N'A PAS été écrit. Aucun changement appliqué.");
  process.exit(1);
}

fs.writeFileSync(APP_PATH, content, "utf8");
console.log("");
console.log("✅ App.js reconstruit proprement avec succès !");
console.log("");
console.log("👉 Prochaines étapes :");
console.log("   1. npm run build");
console.log("   2. firebase deploy");
console.log("");
console.log("ℹ️  Si quelque chose ne va pas, restaure la sauvegarde :");
console.log("   " + path.basename(BACKUP_PATH) + " → renomme-le en App.js");
