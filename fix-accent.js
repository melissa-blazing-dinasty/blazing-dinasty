const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

// Dans le nouveau bloc tokens, remplacer accent par accentColor
// On trouve le bloc qu'on vient d'ajouter et on corrige
const debut = c.indexOf("      {/* OFFRE LIMITÉE (tokens) */}");
const fin = c.indexOf("      {/* BOUTIQUE */}", debut);

if (debut !== -1 && fin !== -1) {
  let bloc = c.slice(debut, fin);
  bloc = bloc.split("' + accent + '").join("' + accentColor + '");
  bloc = bloc.split(", accent,").join(", accentColor,");
  bloc = bloc.split("{accent}").join("{accentColor}");
  bloc = bloc.split("color: accent}").join("color: accentColor}");
  bloc = bloc.split("color: accent }").join("color: accentColor }");
  bloc = bloc.split("color: accent,").join("color: accentColor,");
  bloc = bloc.split(", accent '").join(", accentColor '");
  c = c.slice(0, debut) + bloc + c.slice(fin);
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK - accent remplace par accentColor');
} else {
  console.log('ECHEC - bloc introuvable');
}