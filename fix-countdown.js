const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

// Remplacer sessionStorage par localStorage avec logique persistante
const ancien = `    const key = \`bd_recru_timer_\${slug}\`;
    const stored = sessionStorage.getItem(key);
    let endTime;
    if (stored) { endTime = parseInt(stored); }
    else {
      const h = 3 + Math.floor(Math.random() * 8);
      endTime = Date.now() + h * 3600000;
      sessionStorage.setItem(key, endTime.toString());
    }`;

const nouveau = `    const key = 'bd_recru_timer_' + slug;
    let endTime;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        endTime = parseInt(stored);
        if (endTime < Date.now()) {
          const h = 18 + Math.floor(Math.random() * 30);
          endTime = Date.now() + h * 3600000;
          localStorage.setItem(key, endTime.toString());
        }
      } else {
        const h = 18 + Math.floor(Math.random() * 30);
        endTime = Date.now() + h * 3600000;
        localStorage.setItem(key, endTime.toString());
      }
    } catch {
      const h = 18 + Math.floor(Math.random() * 30);
      endTime = Date.now() + h * 3600000;
    }`;

if (c.includes(ancien)) {
  c = c.replace(ancien, nouveau);
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK - countdown localStorage persistant');
} else {
  console.log('ECHEC - ancre introuvable');
  // Chercher ce qui existe
  const idx = c.indexOf('sessionStorage');
  if (idx !== -1) console.log('sessionStorage trouve ligne: ' + c.substring(0, idx).split('\n').length);
  else console.log('Pas de sessionStorage trouve');
}