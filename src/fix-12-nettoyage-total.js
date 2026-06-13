// fix-12-nettoyage-total.js
// Lance avec : node fix-12-nettoyage-total.js
// À placer dans le même dossier que App.js (src/)

const fs = require("fs");
const path = require("path");

const APP_PATH = path.join(__dirname, "App.js");
const BACKUP_PATH = path.join(__dirname, "App.js.backup-nettoyage12-" + Date.now());

if (!fs.existsSync(APP_PATH)) {
  console.error("❌ App.js introuvable dans ce dossier.");
  process.exit(1);
}

let content = fs.readFileSync(APP_PATH, "utf8");
fs.writeFileSync(BACKUP_PATH, content, "utf8");
console.log("✅ Sauvegarde créée : " + path.basename(BACKUP_PATH));

// ── 1. Retirer createContext, useContext de l'import principal s'ils y sont ──
content = content.replace(
  `import { useState, useCallback, useEffect, createContext, useContext } from "react";`,
  `import { useState, useCallback, useEffect } from "react";`
);
// Retirer un éventuel import séparé
content = content.split('import { createContext, useContext } from "react";\n\n').join("");
content = content.split('import { createContext, useContext } from "react";\n').join("");
content = content.split('import { createContext, useContext } from "react";').join("");
console.log("✅ 1/6 — Imports createContext/useContext nettoyés");

// ── 2. Supprimer tout bloc de traduction (signature → fin de "function T") ──
const BLOCK_START = "// ── TRADUCTION À LA VOLÉE (FR ↔ PT) ──────────────────────────────────────────";
const T_FUNC_START = "function T({children}){";

let removedBlocks = 0;
while(true){
  let startIdx = content.indexOf(BLOCK_START);
  if(startIdx === -1){
    // Essayer de trouver juste "const LangContext = createContext" si le commentaire a disparu
    startIdx = content.indexOf("const LangContext = createContext");
    if(startIdx === -1) break;
  }
  // Trouver la fonction T après ce point
  const tIdx = content.indexOf(T_FUNC_START, startIdx);
  if(tIdx === -1){
    console.error("⚠️  Bloc LangContext trouvé sans 'function T' associé — suppression jusqu'à HELPERS");
    const helpersIdx = content.indexOf("// ── HELPERS", startIdx);
    if(helpersIdx === -1) break;
    content = content.slice(0,startIdx) + content.slice(helpersIdx);
    removedBlocks++;
    continue;
  }
  // Trouver la fin de la fonction T : chercher "return display;\n}" après tIdx
  const endMarker = "return display;\n}";
  const endIdx = content.indexOf(endMarker, tIdx);
  if(endIdx === -1) break;
  const fullEnd = endIdx + endMarker.length;
  content = content.slice(0,startIdx) + content.slice(fullEnd);
  removedBlocks++;
  if(removedBlocks > 10) break;
}
console.log("✅ 2/6 — " + removedBlocks + " bloc(s) de traduction supprimé(s)");

// Nettoyer double saut de ligne résiduel avant HELPERS
content = content.replace(/\n{3,}\/\/ ── HELPERS/, "\n\n// ── HELPERS");

// ── 3. Retirer <T>...</T> dans SecTitle si présent ──
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
  console.log("✅ 3/6 — SecTitle remis en version simple");
} else {
  console.log("ℹ️  3/6 — SecTitle déjà simple ou non trouvé tel quel");
}

// ── 4. Retirer tous les LangContext.Provider (ouverture/fermeture isolés) ──
let providerRemoved = 0;
while(content.includes("<LangContext.Provider value={{lang}}>")){
  content = content.replace("    <LangContext.Provider value={{lang}}>\n", "");
  content = content.replace("<LangContext.Provider value={{lang}}>", "");
  providerRemoved++;
  if(providerRemoved>10) break;
}
while(content.includes("</LangContext.Provider>")){
  content = content.replace("    </LangContext.Provider>\n", "");
  content = content.replace("</LangContext.Provider>", "");
  providerRemoved++;
  if(providerRemoved>20) break;
}
console.log("✅ 4/6 — " + providerRemoved + " référence(s) Provider supprimée(s)");

// ── 5. Vérifier qu'il ne reste plus aucune trace ──
const remainingT = (content.match(/function T\(\{children\}\)/g) || []).length;
const remainingLang = (content.match(/LangContext/g) || []).length;
const remainingUseContext = (content.match(/useContext/g) || []).length;
const remainingCreateContext = (content.match(/createContext/g) || []).length;

console.log("");
console.log("ℹ️  5/6 — Vérification après nettoyage :");
console.log("   function T       : " + remainingT + " (doit être 0)");
console.log("   LangContext      : " + remainingLang + " (doit être 0)");
console.log("   useContext       : " + remainingUseContext + " (doit être 0)");
console.log("   createContext    : " + remainingCreateContext + " (doit être 0)");

if(remainingT>0 || remainingLang>0 || remainingUseContext>0 || remainingCreateContext>0){
  console.error("");
  console.error("❌ Des résidus subsistent. Affichage du contexte autour de chaque résidu :");
  [["function T","function T({children})"],["LangContext","LangContext"],["useContext","useContext"],["createContext","createContext"]].forEach(([label,pattern])=>{
    let idx = content.indexOf(pattern);
    let n=0;
    while(idx!==-1 && n<5){
      console.error("   ["+label+"] ..."+JSON.stringify(content.slice(Math.max(0,idx-40),idx+pattern.length+40))+"...");
      idx = content.indexOf(pattern, idx+1);
      n++;
    }
  });
  console.error("");
  console.error("Le fichier N'A PAS été écrit. Examine les résidus ci-dessus.");
  process.exit(1);
}

console.log("");
console.log("✅ 6/6 — Fichier complètement nettoyé, aucune trace de traduction !");

fs.writeFileSync(APP_PATH, content, "utf8");
console.log("");
console.log("✅✅✅ App.js nettoyé et écrit avec succès !");
console.log("");
console.log("👉 Prochaines étapes :");
console.log("   1. node fix-11-traduction-finale.js");
console.log("   2. npm run build");
console.log("   3. firebase deploy");
console.log("");
console.log("ℹ️  Si quelque chose ne va pas, restaure la sauvegarde :");
console.log("   " + path.basename(BACKUP_PATH) + " → renomme-le en App.js");
