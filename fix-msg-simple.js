const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let c = fs.readFileSync(f, 'utf8');

const ancien = 'const msg = (labelCustom ? labelCustom+" " : "Coucou "+(nomClient||"")+"! Diagnostic gratuit 2 min ! ")  + lien;';

const nouveau = `const emojis = {parfum:'🌸',skincare:'✨',silhouette:'💎',sante:'🌿',peauvisage:'✨',peaucorps:'💆',cheveux:'💇',maquillage:'💄'};
    const labels = {parfum:'parfum',skincare:'soin visage',silhouette:'silhouette',sante:'bien-etre',peauvisage:'soin visage',peaucorps:'soin corps',cheveux:'cheveux',maquillage:'maquillage'};
    const e = emojis[diagType]||'🌟';
    const tl = labels[diagType]||'beaute';
    const msg = labelCustom
      ? labelCustom + "\\n\\n" + lien
      : e+"✨ "+(nomClient?nomClient+", ton":"Ton")+" diagnostic "+tl+" est pret ! ✨"+e+"\\n\\n💆 J'ai prepare tes recommandations personnalisees rien que pour toi !\\n\\n👇👇 CLIQUE ICI 👇👇\\n➡️ "+lien+"\\n\\n⚠️ Clique bien sur le lien ci-dessus\\n(pas sur le premier apercu qui apparait)\\n\\n🔥 Blazing Dynasty x Mihi France";`;

if (c.includes(ancien)) {
  c = c.replace(ancien, nouveau);
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK');
} else {
  console.log('ECHEC - cherchons...');
  const i = c.indexOf('Coucou');
  console.log(c.substring(i-50, i+100));
}