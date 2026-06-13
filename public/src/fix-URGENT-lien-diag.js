// fix-URGENT-lien-diag.js
// Lance avec : node fix-URGENT-lien-diag.js
// À placer dans le même dossier que App.js (src/)

const fs = require("fs");
const path = require("path");

const APP_PATH = path.join(__dirname, "App.js");
const BACKUP_PATH = path.join(__dirname, "App.js.backup-URGENT-" + Date.now());

if (!fs.existsSync(APP_PATH)) {
  console.error("❌ App.js introuvable dans ce dossier.");
  process.exit(1);
}

let content = fs.readFileSync(APP_PATH, "utf8");

// Compter combien de fois le lien apparaît
const LINK = "https://www.mihi.care/fr?referral_code=8033510";
const count = content.split(LINK).length - 1;

console.log("ℹ️  Occurrences du lien trouvées : " + count);

if(count === 0){
  console.log("✅ Le lien n'est plus dans le code source ! Le problème vient donc du build/cache, pas du code.");
  console.log("");
  console.log("👉 Solution :");
  console.log("   1. npm run build");
  console.log("   2. firebase deploy");
  console.log("   3. Sur le site : Ctrl+Maj+R (vider le cache) ou navigation privée");
  process.exit(0);
}

fs.writeFileSync(BACKUP_PATH, content, "utf8");
console.log("✅ Sauvegarde créée : " + path.basename(BACKUP_PATH));

// Afficher le contexte autour de chaque occurrence pour diagnostic
const idx0 = content.indexOf(LINK);
console.log("");
console.log("ℹ️  Contexte autour de la 1ère occurrence :");
console.log(JSON.stringify(content.slice(Math.max(0,idx0-60), idx0+LINK.length+10)));

// Supprimer toutes les variantes possibles du texte autour du lien
let newContent = content;

// Variante 1 : avec le préfixe complet "\n\n🔗 Commander: " + lien
newContent = newContent.split(`\\n\\n🔗 Commander: ${LINK}`).join("");

// Variante 2 : juste le lien tout seul (au cas où le préfixe a été modifié/dupliqué différemment)
while(newContent.includes(LINK)){
  // Supprime le lien et nettoie les éventuels restes de préfixe juste avant
  const i = newContent.indexOf(LINK);
  // Cherche en arrière jusqu'à 60 caractères pour retirer un éventuel "🔗 Commander: " ou "\n\n"
  let start = i;
  const before = newContent.slice(Math.max(0,i-60), i);
  const markerIdx = before.lastIndexOf("🔗");
  if(markerIdx !== -1){
    start = Math.max(0,i-60) + markerIdx;
  }
  newContent = newContent.slice(0,start) + newContent.slice(i+LINK.length);
}

const remaining = newContent.split(LINK).length - 1;
console.log("");
console.log("ℹ️  Occurrences restantes après nettoyage : " + remaining);

fs.writeFileSync(APP_PATH, newContent, "utf8");

console.log("");
console.log("✅ App.js mis à jour : lien(s) de commande supprimé(s).");
console.log("");
console.log("👉 Prochaines étapes :");
console.log("   1. npm run build");
console.log("   2. firebase deploy");
console.log("");
console.log("ℹ️  Si quelque chose ne va pas, restaure la sauvegarde :");
console.log("   " + path.basename(BACKUP_PATH) + " → renomme-le en App.js");
