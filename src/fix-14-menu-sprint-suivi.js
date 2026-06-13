// fix-14-menu-sprint-suivi.js
// Lance avec : node fix-14-menu-sprint-suivi.js
// À placer dans le même dossier que App.js (src/)

const fs = require("fs");
const path = require("path");

const APP_PATH = path.join(__dirname, "App.js");
const BACKUP_PATH = path.join(__dirname, "App.js.backup-menu14-" + Date.now());

if (!fs.existsSync(APP_PATH)) {
  console.error("❌ App.js introuvable dans ce dossier.");
  process.exit(1);
}

let content = fs.readFileSync(APP_PATH, "utf8");

// ── Vérifications préalables ──
const TARGET_SUIVI = `    {id:"suivi",label:"📋 Suivi Recrues"},\n`;
const occSuivi = (content.match(/\{id:"suivi",label:"📋 Suivi Recrues"\},/g) || []).length;
console.log("ℹ️  Ligne 'Suivi Recrues' dans menu principal : " + occSuivi + " (doit être 1)");

const occSprintMenu = (content.match(/\{id:"sprint",label:/g) || []).length;
console.log("ℹ️  'sprint' déjà dans menu principal : " + occSprintMenu + " (doit être 0)");

const TARGET_FORMAPRODUITS = `    {id:"formaproduits",label:"🧴 Formation Produits"},
    {id:"suivi",label:"📋 Suivi Recrues"},`;
const occForma = (content.match(/\{id:"formaproduits",label:"🧴 Formation Produits"\},\n {4}\{id:"suivi",label:"📋 Suivi Recrues"\},/g) || []).length;
console.log("ℹ️  Bloc 'Formation Produits'+'Suivi Recrues' (point d'insertion) : " + occForma + " (doit être 1)");

if(occSuivi!==1 || occSprintMenu!==0 || occForma!==1){
  console.error("❌ Conditions préalables non remplies. Aucune modification.");
  process.exit(1);
}

fs.writeFileSync(BACKUP_PATH, content, "utf8");
console.log("✅ Sauvegarde créée : " + path.basename(BACKUP_PATH));

// 1+2. Remplacer le bloc "formaproduits + suivi" par "formaproduits + sprint" (suivi retiré, sprint ajouté)
content = content.replace(
  TARGET_FORMAPRODUITS,
  `    {id:"formaproduits",label:"🧴 Formation Produits"},
    {id:"sprint",label:"⚡ Sprint 7 jours"},`
);
console.log("✅ 1/2 — 'Suivi Recrues' retiré du menu principal");
console.log("✅ 2/2 — 'Sprint 7 jours' ajouté au menu principal");

// ── Vérifications finales ──
const finalSuivi = (content.match(/\{id:"suivi",label:"📋 Suivi Recrues"\},/g) || []).length;
const finalSprint = (content.match(/\{id:"sprint",label:"⚡ Sprint 7 jours"\},/g) || []).length;

console.log("");
console.log("── VÉRIFICATIONS FINALES ──");
console.log("'Suivi Recrues' menu principal : " + finalSuivi + " (attendu: 0)");
console.log("'Sprint 7 jours' menu principal : " + finalSprint + " (attendu: 1)");

if(finalSuivi!==0 || finalSprint!==1){
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
console.log("ℹ️  Note : 'Suivi Recrues' reste accessible via le Tableau de bord");
console.log("   (le code de l'onglet 'suivi' n'est pas supprimé, juste son accès");
console.log("   direct depuis le menu principal).");
console.log("");
console.log("ℹ️  Si quelque chose ne va pas, restaure la sauvegarde :");
console.log("   " + path.basename(BACKUP_PATH) + " → renomme-le en App.js");
