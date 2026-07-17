const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let lines = fs.readFileSync(f, 'utf8').split('\n');

// Remplacer la fonction copierLien (lignes 1816-1819)
const ancien = `   const copierLien = () => {
     const lien = \`https://blazing-dinasty-1fad9.web.app/d/\${uid}?diag=\${type}&client=\${encodeURIComponent(nomClient||"")}\`;
     navigator.clipboard.writeText(lien).catch(()=>{});
   };`;

const emojisType = {
  parfum: '🌸',
  skincare: '✨',
  silhouette: '💎',
  sante: '🌿',
  peauvisage: '✨',
  peaucorps: '💆',
  cheveux: '💇',
  maquillage: '💄',
};

const nouveau = `   const copierLien = () => {
     const lien = \`https://blazing-dinasty-1fad9.web.app/d/\${uid}?diag=\${type}&client=\${encodeURIComponent(nomClient||"")}\`;
     const emoji = {parfum:'🌸',skincare:'✨',silhouette:'💎',sante:'🌿',peauvisage:'✨',peaucorps:'💆',cheveux:'💇',maquillage:'💄'}[type]||'🌟';
     const typeLabel = {parfum:'parfum',skincare:'soin visage',silhouette:'silhouette',sante:'bien-être',peauvisage:'soin visage',peaucorps:'soin corps',cheveux:'cheveux',maquillage:'maquillage'}[type]||'beauté';
     const msg = \`\${emoji}✨ \${nomClient||"Chère cliente"}, ton diagnostic \${typeLabel} est prêt ! ✨\${emoji}

💆‍♀️ J'ai préparé tes recommandations personnalisées rien que pour toi !

👇👇 CLIQUE ICI 👇👇
➡️ \${lien}

⚠️ Clique bien sur le lien ci-dessus
(pas sur le premier aperçu qui apparaît)

🔥 Blazing Dynasty × Mihi France\`;
     navigator.clipboard.writeText(msg).catch(()=>{});
     alert("✅ Message copié ! Colle-le dans Messenger ou WhatsApp 💬");
   };`;

const c = lines.join('\n');
if (c.includes('copierLien = () => {')) {
  const newC = c.replace(
    "   const copierLien = () => {\n     const lien = `https://blazing-dinasty-1fad9.web.app/d/${uid}?diag=${type}&client=${encodeURIComponent(nomClient||\"\")}`;\n     navigator.clipboard.writeText(lien).catch(()=>{});\n   };",
    nouveau
  );
  if (newC !== c) {
    fs.writeFileSync(f, newC, 'utf8');
    console.log('OK - message complet avec emojis');
  } else {
    // Essai par numero de ligne
    let lns = c.split('\n');
    lns[1815] = "   const copierLien = () => {";
    lns[1816] = "     const lien = `https://blazing-dinasty-1fad9.web.app/d/${uid}?diag=${type}&client=${encodeURIComponent(nomClient||\"\")}`;";
    lns[1817] = "     const emoji = {parfum:'🌸',skincare:'✨',silhouette:'💎',sante:'🌿',peauvisage:'✨',peaucorps:'💆',cheveux:'💇',maquillage:'💄'}[type]||'🌟';";
    lns.splice(1818, 0,
      "     const typeLabel = {parfum:'parfum',skincare:'soin visage',silhouette:'silhouette',sante:'bien-être',peauvisage:'soin visage',peaucorps:'soin corps',cheveux:'cheveux',maquillage:'maquillage'}[type]||'beauté';",
      "     const msg = `${emoji}✨ ${nomClient||'Chère cliente'}, ton diagnostic ${typeLabel} est prêt ! ✨${emoji}\\n\\n💆‍♀️ J'ai préparé tes recommandations personnalisées rien que pour toi !\\n\\n👇👇 CLIQUE ICI 👇👇\\n➡️ ${lien}\\n\\n⚠️ Clique bien sur le lien ci-dessus\\n(pas sur le premier aperçu qui apparaît)\\n\\n🔥 Blazing Dynasty × Mihi France`;",
      "     navigator.clipboard.writeText(msg).catch(()=>{});",
      "     alert('✅ Message copié ! Colle-le dans Messenger ou WhatsApp 💬');"
    );
    lns[1818 + 4] = "   };";
    fs.writeFileSync(f, lns.join('\n'), 'utf8');
    console.log('OK - message via numero de ligne');
  }
} else {
  console.log('ECHEC');
}