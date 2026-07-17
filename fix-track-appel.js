const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

// Trouver le dernier setLoading(false) dans le composant public
// C'est apres le chargement des donnees
const ancre = "      setLoading(false);\n    })();\n  },[slug,preview]);";

if (c.includes('await trackVue')) {
  console.log('DEJA FAIT');
} else if (c.includes(ancre)) {
  c = c.replace(ancre,
    "      if (!preview) await trackVue(db, uid);\n      setLoading(false);\n    })();\n  },[slug,preview]);"
  );
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK - trackVue appele');
} else {
  // Chercher autrement
  const idx = c.lastIndexOf('setLoading(false);');
  const context = c.substring(idx-100, idx+50);
  console.log('ECHEC - contexte: ' + context);
}