// fix-13-tblock-sprint.js
// Lance avec : node fix-13-tblock-sprint.js
// À placer dans le même dossier que App.js (src/)

const fs = require("fs");
const path = require("path");

const APP_PATH = path.join(__dirname, "App.js");
const BACKUP_PATH = path.join(__dirname, "App.js.backup-tblock-" + Date.now());

if (!fs.existsSync(APP_PATH)) {
  console.error("❌ App.js introuvable dans ce dossier.");
  process.exit(1);
}

let content = fs.readFileSync(APP_PATH, "utf8");

// ── Vérifications préalables ──
const hasT = content.includes("function T({children}){");
const hasTBlock = content.includes("function TBlock(");
console.log("ℹ️  function T existe : " + hasT + " (doit être true)");
console.log("ℹ️  TBlock existe déjà : " + hasTBlock + " (doit être false)");

if(!hasT || hasTBlock){
  console.error("❌ Conditions préalables non remplies. Aucune modification.");
  process.exit(1);
}

const MARK_AFTER_T = `function T({children}){
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
}`;

if(!content.includes(MARK_AFTER_T)){
  console.error("❌ Marqueur function T introuvable exactement. Aucune modification.");
  process.exit(1);
}

const SPRINT_OPEN = `        {tab==="sprint"&&(
          <div>`;

const occSprintOpen = (content.match(/\{tab==="sprint"&&\(\n {10}<div>/g) || []).length;
console.log("ℹ️  Occurrences ouverture sprint : " + occSprintOpen + " (doit être 1)");

if(occSprintOpen !== 1){
  console.error("❌ Marqueur ouverture sprint introuvable ou en double. Aucune modification.");
  process.exit(1);
}

// Trouver la fermeture correspondante : on sait d'après l'analyse que c'est juste avant
// "{/* ── SUIVI RECRUES ── */}"
const SPRINT_CLOSE_FOLLOWED_BY = `          </div>
        )}

        {/* ── SUIVI RECRUES ── */}`;

const occSprintClose = (content.match(/<\/div>\n {8}\)\}\n\n {8}\{\/\* ── SUIVI RECRUES ── \*\/\}/g) || []).length;
console.log("ℹ️  Occurrences fermeture sprint : " + occSprintClose + " (doit être 1)");

if(occSprintClose !== 1){
  console.error("❌ Marqueur fermeture sprint introuvable ou en double. Aucune modification.");
  process.exit(1);
}

// ── TOUT OK : sauvegarde et modifications ──
fs.writeFileSync(BACKUP_PATH, content, "utf8");
console.log("✅ Sauvegarde créée : " + path.basename(BACKUP_PATH));

// 1. Ajouter TBlock juste après function T
const TBLOCK_CODE = `${MARK_AFTER_T}

// Traduit récursivement tous les textes enfants d'un bloc, en préservant
// la structure JSX (icônes, boutons, inputs, styles intacts).
function TBlock({children}){
  const ctx = useContext(LangContext);
  const lang = ctx.lang;

  if(lang==="fr") return children;

  const walk = (node)=>{
    if(typeof node==="string"){
      const trimmed = node.trim();
      if(!trimmed) return node;
      return <T key={Math.random()}>{node}</T>;
    }
    if(Array.isArray(node)){
      return node.map((child,i)=> <React.Fragment key={i}>{walk(child)}</React.Fragment>);
    }
    if(React.isValidElement(node)){
      // Ne pas traduire le contenu des inputs/textarea (value géré séparément)
      if(node.type==="input" || node.type==="textarea") return node;
      if(!node.props || node.props.children===undefined) return node;
      return React.cloneElement(node, {
        ...node.props,
        children: walk(node.props.children)
      });
    }
    return node;
  };

  return walk(children);
}`;

content = content.replace(MARK_AFTER_T, TBLOCK_CODE);
console.log("✅ 1/2 — Composant TBlock ajouté");

// 2. Vérifier que React est importé (pour React.Fragment, React.isValidElement, React.cloneElement)
if(!content.includes(`import React`) && !content.includes(`import React,`)){
  // Ajouter import React si absent
  content = content.replace(
    `import { useState, useCallback, useEffect, createContext, useContext } from "react";`,
    `import React, { useState, useCallback, useEffect, createContext, useContext } from "react";`
  );
  console.log("✅    — import React ajouté");
} else {
  console.log("ℹ️    — React déjà importé");
}

// 3. Envelopper l'onglet sprint avec TBlock
content = content.replace(
  `        {tab==="sprint"&&(
          <div>`,
  `        {tab==="sprint"&&(
          <TBlock><div>`
);

content = content.replace(
  `          </div>
        )}

        {/* ── SUIVI RECRUES ── */}`,
  `          </div></TBlock>
        )}

        {/* ── SUIVI RECRUES ── */}`
);

console.log("✅ 2/2 — TBlock appliqué à l'onglet sprint");

// ── Vérifications finales ──
const finalTBlock = (content.match(/function TBlock\(/g) || []).length;
const finalApplied = (content.match(/<TBlock><div>/g) || []).length;
const finalClosed = (content.match(/<\/div><\/TBlock>/g) || []).length;

console.log("");
console.log("── VÉRIFICATIONS FINALES ──");
console.log("function TBlock      : " + finalTBlock + " (attendu: 1)");
console.log("<TBlock><div> ouvert : " + finalApplied + " (attendu: 1)");
console.log("</div></TBlock> fermé: " + finalClosed + " (attendu: 1)");

if(finalTBlock!==1 || finalApplied!==1 || finalClosed!==1){
  console.error("");
  console.error("❌ Vérifications finales non conformes. Le fichier N'A PAS été écrit.");
  process.exit(1);
}

fs.writeFileSync(APP_PATH, content, "utf8");
console.log("");
console.log("✅✅✅ App.js mis à jour avec succès !");
console.log("");
console.log("👉 Prochaines étapes :");
console.log("   1. npm run build");
console.log("   2. firebase deploy");
console.log("");
console.log("ℹ️  Test : onglet 'sprint' (Prends de la vitesse), clique 🇵🇹");
console.log("   → titre, description, textes des cartes/tâches doivent être en portugais.");
console.log("   Vérifie aussi que les cases à cocher et le champ notes fonctionnent toujours.");
console.log("");
console.log("ℹ️  Si quelque chose ne va pas, restaure la sauvegarde :");
console.log("   " + path.basename(BACKUP_PATH) + " → renomme-le en App.js");
