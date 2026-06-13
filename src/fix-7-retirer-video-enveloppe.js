// fix-7-retirer-video-enveloppe.js
// Lance avec : node fix-7-retirer-video-enveloppe.js
// À placer dans le même dossier que App.js (src/)

const fs = require("fs");
const path = require("path");

const APP_PATH = path.join(__dirname, "App.js");
const BACKUP_PATH = path.join(__dirname, "App.js.backup-enveloppe-" + Date.now());

if (!fs.existsSync(APP_PATH)) {
  console.error("❌ App.js introuvable dans ce dossier.");
  process.exit(1);
}

const content = fs.readFileSync(APP_PATH, "utf8");

const TARGET = `              <DriveBtn href="https://drive.google.com/file/d/1Qit_DVf9bNHqX7Kh188J6B0PYGda8w15/view" label="Stratégie Enveloppe Mystère — Vidéo"/>
`;

if (!content.includes(TARGET)) {
  console.error("❌ Ligne 'Stratégie Enveloppe Mystère — Vidéo' introuvable. Aucune modification effectuée.");
  process.exit(1);
}

fs.writeFileSync(BACKUP_PATH, content, "utf8");
console.log("✅ Sauvegarde créée : " + path.basename(BACKUP_PATH));

const newContent = content.replace(TARGET, "");
fs.writeFileSync(APP_PATH, newContent, "utf8");

console.log("✅ App.js mis à jour : vidéo 'Enveloppe Mystère' retirée de l'onglet Vente.");
console.log("");
console.log("👉 Prochaines étapes :");
console.log("   1. npm run build");
console.log("   2. firebase deploy");
console.log("");
console.log("ℹ️  Si quelque chose ne va pas, restaure la sauvegarde :");
console.log("   " + path.basename(BACKUP_PATH) + " → renomme-le en App.js");
