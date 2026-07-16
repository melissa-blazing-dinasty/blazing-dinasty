const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(
  "if(!cfg||!cfg.actif) return <div style={{ textAlign: 'center', padding: '3rem', color: CR.gris }}>Page non disponible.</div>;",
  "if(cfg && cfg.actif === false) return <div style={{ textAlign: 'center', padding: '3rem', color: CR.gris }}>Page non disponible.</div>;\n  if(!cfg) setCfg({ titreAccroche: '', actif: true, nbPersonnesRejointes: 0, nbPlacesRestantes: 0, afficherBoutique: false, lienInscription: '' });"
);

fs.writeFileSync(f, c, 'utf8');
console.log('OK');