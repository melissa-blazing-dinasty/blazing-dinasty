// fix-9b-corrige-import.js
// Lance avec : node fix-9b-corrige-import.js
// À placer dans le même dossier que App.js (src/)

const fs = require("fs");
const path = require("path");

const APP_PATH = path.join(__dirname, "App.js");
const BACKUP_PATH = path.join(__dirname, "App.js.backup-corrigeimport-" + Date.now());

if (!fs.existsSync(APP_PATH)) {
  console.error("❌ App.js introuvable dans ce dossier.");
  process.exit(1);
}

let content = fs.readFileSync(APP_PATH, "utf8");

const BAD_IMPORT = `import { createContext, useContext } from "react";\n\n`;

if(!content.includes(BAD_IMPORT)){
  console.error("❌ Import problématique introuvable. Le fichier a peut-être déjà été corrigé, ou fix-9 n'a pas été appliqué.");
  process.exit(1);
}

fs.writeFileSync(BACKUP_PATH, content, "utf8");
console.log("✅ Sauvegarde créée : " + path.basename(BACKUP_PATH));

// 1. Retirer l'import mal placé
content = content.replace(BAD_IMPORT, "");

// 2. Ajouter createContext, useContext au premier import React existant
const FIRST_IMPORT = `import { useState, useCallback, useEffect } from "react";`;
const NEW_FIRST_IMPORT = `import { useState, useCallback, useEffect, createContext, useContext } from "react";`;

if(!content.includes(FIRST_IMPORT)){
  console.error("❌ Import React principal introuvable. Restauration de la sauvegarde nécessaire si besoin.");
  process.exit(1);
}

content = content.replace(FIRST_IMPORT, NEW_FIRST_IMPORT);

fs.writeFileSync(APP_PATH, content, "utf8");

console.log("✅ App.js corrigé : import déplacé en haut du fichier.");
console.log("");
console.log("👉 Prochaines étapes :");
console.log("   1. npm run build");
console.log("   2. firebase deploy");
console.log("");
console.log("ℹ️  Si quelque chose ne va pas, restaure la sauvegarde :");
console.log("   " + path.basename(BACKUP_PATH) + " → renomme-le en App.js");
