const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

const ancien = `const TEMOIGNAGES_REVENUS_DEFAULT = [
  {prenom:'Marie', metier:'Coiffeuse', heures:'6h/semaine', clientes:'12 clientes régulières', montant:'420'},
  {prenom:'Julie', metier:'Maman au foyer', heures:'4h/semaine', clientes:'8 clientes', montant:'320'},
  {prenom:'Sarah', metier:'Salariée', heures:'8h/semaine', clientes:'20 clientes', montant:'790'},
];`;

const nouveau = `const TEMOIGNAGES_REVENUS_DEFAULT = [
  {prenom:'Fanny', metier:'Coiffeuse', heures:'6h/semaine', clientes:'12 clientes regulieres', montant:'957'},
  {prenom:'Melissa', metier:'Maman au foyer a temps plein chez Mihi', heures:'Temps plein', clientes:'Equipe & clientes', montant:'3000'},
  {prenom:'Sarah', metier:'Garde d enfants salariee', heures:'8h/semaine', clientes:'20 clientes', montant:'790'},
];`;

if (c.includes('Fanny') && c.includes('957')) {
  console.log('DEJA BON');
} else if (c.includes(ancien)) {
  c = c.replace(ancien, nouveau);
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK - defaults mis a jour');
} else {
  // Chercher ce qui existe
  const i = c.indexOf('TEMOIGNAGES_REVENUS_DEFAULT = [');
  console.log('ECHEC - trouvé à: ' + c.substring(i, i+150));
}