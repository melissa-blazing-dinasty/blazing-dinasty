const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let lines = fs.readFileSync(f, 'utf8').split('\n');

lines = lines.map((l, i) => {
  if (i === 1978) {
    return `  function copierLienDirect(diagType, labelCustom) {
    const lien = \`https://blazing-dinasty-1fad9.web.app/d/\${uid}?diag=\${diagType}&client=\${encodeURIComponent(nomClient||"")}\`;
    const emojis = {parfum:'🌸',skincare:'✨',silhouette:'💎',sante:'🌿',peauvisage:'✨',peaucorps:'💆',cheveux:'💇',maquillage:'💄'};
    const labels = {parfum:'parfum',skincare:'soin visage',silhouette:'silhouette',sante:'bien-etre',peauvisage:'soin visage',peaucorps:'soin corps',cheveux:'cheveux',maquillage:'maquillage'};
    const e = emojis[diagType]||'🌟';
    const tl = labels[diagType]||'beaute';
    const prenom = nomClient||'';
    const msg = labelCustom
      ? labelCustom + "\\n\\n" + lien
      : e+"✨ "+(prenom?prenom+", ton":"Ton")+" diagnostic "+tl+" est pret ! ✨"+e+"\\n\\n"
        +"💆 J'ai prepare tes recommandations personnalisees rien que pour toi !\\n\\n"
        +"👇👇 CLIQUE ICI 👇👇\\n"
        +"➡️ "+lien+"\\n\\n"
        +"⚠️ Clique bien sur le lien ci-dessus\\n"
        +"(pas sur le premier apercu qui apparait)\\n\\n"
        +"🔥 Blazing Dynasty x Mihi France";`;
  }
  if (i === 1979) return ''; // ancienne ligne lien
  if (i === 1980) return ''; // ligne vide
  if (i === 1981) return ''; // ligne vide
  if (i === 1982) {
    return `    navigator.clipboard && navigator.clipboard.writeText(msg);`;
  }
  if (i === 1983) {
    return `    alert("Message copie ! Colle-le dans Messenger ou WhatsApp 💬");`;
  }
  if (i === 1984) return '  }';
  return l;
});

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('OK');