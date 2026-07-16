const fs = require('fs');
const f = 'functions/index.js';
let c = fs.readFileSync(f, 'utf8');

// Trouver et remplacer toutes les lignes problematiques dans metaTags
const lignes = [
  ["titre = 'Decouvre l'univers de ' + nom + ' \uD83C\uDF3F';", 'titre = `Decouvre l\u2019univers de ${nom} \uD83C\uDF3F`;'],
  ["description = nom + ' partage ses produits beaute preferes et son parcours Mihi. Clique pour en savoir plus !';", "description = nom + ` partage ses produits beaute preferes et son parcours Mihi. Clique pour en savoir plus !`;"],
  ["titre = 'Rejoins l'equipe de ' + nom + ' ! \uD83D\uDD25';", 'titre = `Rejoins l\u2019equipe de ${nom} ! \uD83D\uDD25`;'],
  ["description = 'Decouvre comment creer ta boutique en ligne gratuite et developper ton business beaute depuis chez toi.';", "description = `Decouvre comment creer ta boutique en ligne gratuite et developper ton business beaute depuis chez toi.`;"],
  ["titre = 'La boutique de ' + nom + ' \u2014 Mihi France \uD83D\uDECD\uFE0F';", 'titre = `La boutique de ${nom} \u2014 Mihi France \uD83D\uDECD\uFE0F`;'],
  ["description = 'Decouvre des produits cosmetiques de qualite pharmaceutique. Boutique personnalisee par ' + nom + '.';", "description = `Decouvre des produits cosmetiques de qualite pharmaceutique. Boutique personnalisee par ${nom}.`;"],
  ["titre = 'Diagnostic beaute offert par ' + nom + ' \u2728';", 'titre = `Diagnostic beaute offert par ${nom} \u2728`;'],
  ["description = 'Reponds a quelques questions et recois tes recommandations de produits personnalisees. Gratuit !';", "description = `Reponds a quelques questions et recois tes recommandations de produits personnalisees. Gratuit !`;"],
];

let count = 0;
lignes.forEach(([ancien, nouveau]) => {
  if (c.includes(ancien)) { c = c.replace(ancien, nouveau); count++; }
});

fs.writeFileSync(f, c, 'utf8');
console.log('Remplace: ' + count + '/' + lignes.length);