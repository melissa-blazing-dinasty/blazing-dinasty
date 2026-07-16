const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

// 1. Changer le titre par defaut pour utiliser le prenom dynamique
c = c.replace(
  "titreAccroche: 'Rejoins l\\'équipe de Melissa !'",
  "titreAccroche: ''"
);

// 2. Sur la page publique, utiliser le prenom du linkbio si titre vide
c = c.replace(
  "{cfg.titreAccroche || `Rejoins l'équipe de ${prenom || 'Melissa'} !`}",
  "{cfg.titreAccroche || ('Rejoins l\\'equipe de ' + (prenom || userName || 'mon equipe') + ' !')}"
);

// 3. Dans l'onglet gestion, placeholder dynamique
c = c.replace(
  "placeholder=\"Rejoins mon équipe !\"",
  "placeholder={'Rejoins l\\'equipe de ' + (userName || 'mon equipe') + ' !'}"
);

fs.writeFileSync(f, c, 'utf8');

const check = !c.includes("de Melissa !'");
console.log('Melissa supprime: ' + (check ? 'OK' : 'ECHEC'));
console.log('Lignes: ' + c.split('\n').length);