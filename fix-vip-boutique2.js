// fix-vip-boutique2.js
// Conditionne lienInscription et afficherVIP a boutiqueActive
// Pour TOUS les diagnostics d'un coup
// node fix-vip-boutique2.js

const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let c = fs.readFileSync(f, 'utf8');
fs.writeFileSync(f + '.bak-vip2', c, 'utf8');
let ok = 0;

// La logique : dans chaque bloc qui charge lienInscription depuis Firestore,
// on conditionne au fait que boutiqueActive soit true
// On cherche tous les patterns : setLienInscription...(snap.data()["db-lien-inscription-mihi"]||"")
// et on les remplace par : setLienInscription...(snap.data().boutiqueActive ? snap.data()["db-lien-inscription-mihi"]||"" : "")

const patterns = [
  'setLienInscriptionParfum(snapU3.data()["db-lien-inscription-mihi"]||"");',
  'setLienInscriptionDiag(snapU3.data()["db-lien-inscription-mihi"]||"");',
  'setLienInscription(snapU3.data()["db-lien-inscription-mihi"]||"");',
];

patterns.forEach(p => {
  if (c.includes(p)) {
    const varName = p.match(/set(\w+)\(/)[1];
    const nouveau = p.replace(
      '["db-lien-inscription-mihi"]||"")',
      '.boutiqueActive?(snapU3.data()["db-lien-inscription-mihi"]||""):"")'
    );
    c = c.replace(p, nouveau);
    ok++;
    console.log('OK - ' + varName + ' conditionne a boutiqueActive');
  }
});

// Aussi conditionner afficherVIP a boutiqueActive
// Si pas de boutique, pas de prix VIP non plus
const vipPatterns = [
  'setAfficherVIPParfum(!!snapU3.data()["db-afficher-prix-vip"]);',
  'setAfficherVIPDiag(!!snapU3.data()["db-afficher-prix-vip"]);',
  'setAfficherVIP(!!snapU3.data()["db-afficher-prix-vip"]);',
];

vipPatterns.forEach(p => {
  if (c.includes(p)) {
    const varName = p.match(/set(\w+)\(/)[1];
    const nouveau = p.replace(
      '(!!snapU3.data()["db-afficher-prix-vip"])',
      '(!!(snapU3.data().boutiqueActive && snapU3.data()["db-afficher-prix-vip"]))'
    );
    c = c.replace(p, nouveau);
    ok++;
    console.log('OK - ' + varName + ' conditionne a boutiqueActive');
  }
});

// Prix VIP dans le catalogue envoye a l'IA
const prixCat = 'catalogueText=produitsFiltres.map((p,i)=>(i+1)+". "+p.nom+" — "+(p.prix!=null?p.prix:"?")+"€"+(p.prixVIP?" (prix VIP : "+p.prixVIP+"€)":"")).join("\\n");';
const prixCatNew = 'catalogueText=produitsFiltres.map((p,i)=>(i+1)+". "+p.nom+" — "+(p.prix!=null?p.prix:"?")+"€"+(afficherVIP&&p.prixVIP?" (prix VIP : "+p.prixVIP+"€)":"")).join("\\n");';
if (c.includes(prixCat)) {
  c = c.replace(prixCat, prixCatNew);
  ok++;
  console.log('OK - prix VIP catalogue IA conditionne');
}

fs.writeFileSync(f, c, 'utf8');
console.log('\n=== ' + ok + ' corrections appliquees ===');
