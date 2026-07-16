const fs = require('fs');
const f = 'functions/index.js';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(
  "titre = 'Decouvre l'univers de ' + nom + ' \uD83C\uDF3F';",
  'titre = "Decouvre l\'univers de " + nom + " \uD83C\uDF3F";'
);
c = c.replace(
  "description = nom + ' partage ses produits beaute preferes et son parcours Mihi. Clique pour en savoir plus !';",
  'description = nom + " partage ses produits beaute preferes et son parcours Mihi. Clique pour en savoir plus !";'
);

fs.writeFileSync(f, c, 'utf8');
console.log('OK');