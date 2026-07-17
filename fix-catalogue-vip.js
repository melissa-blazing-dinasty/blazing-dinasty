const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let c = fs.readFileSync(f, 'utf8');

// Annuler la modif precedente sur le catalogue - revenir au texte original
c = c.replace(
  'catalogueText=produitsFiltres.map((p,i)=>(i+1)+". "+p.nom+" — "+(p.prix!=null?p.prix:"?")+"€"+(afficherVIP&&p.prixVIP?" (prix VIP : "+p.prixVIP+"€)":"")).join("\\n");',
  'catalogueText=produitsFiltres.map((p,i)=>(i+1)+". "+p.nom+" — "+(p.prix!=null?p.prix:"?")+"€"+(p.prixVIP?" (prix VIP : "+p.prixVIP+"€)":"")).join("\\n");'
);

fs.writeFileSync(f, c, 'utf8');
console.log('OK - catalogue revenu a original');