// fix-metatags-function.js
// Ajoute la Cloud Function de meta tags dans functions/index.js
// node fix-metatags-function.js

const fs = require('fs');
const f = 'functions/index.js';
let c = fs.readFileSync(f, 'utf8');
fs.writeFileSync(f + '.bak-meta', c, 'utf8');

if (c.includes('metaTags')) {
  console.log('DEJA FAIT');
  process.exit(0);
}

const newFunction = `

// ── META TAGS DYNAMIQUES ──────────────────────────────────────────────────────
// Genere des previews de liens personnalises pour WhatsApp/Facebook/Instagram
exports.metaTags = onRequest(async (req, res) => {
  const url = req.query.url || '';
  const params = new URLSearchParams(url.split('?')[1] || '');

  let titre = 'Blazing Dynasty × Mihi France';
  let description = 'Decouvre une opportunite beaute unique en France.';
  let image = 'https://blazing-dinasty-1fad9.web.app/logo192.png';

  try {
    // Extraire le slug et le type
    const bioSlug = params.get('bio');
    const recrutSlug = params.get('recrutement');
    const boutiqueSlug = params.get('boutique');
    const diagUid = params.get('uid') || params.get('distrib');

    // Recuperer le prenom depuis Firestore selon le type
    let prenom = '';
    let slug = bioSlug || recrutSlug || boutiqueSlug || diagUid || '';

    if (slug) {
      // Essayer linkbio d'abord
      try {
        const snap = await db.collection('linkbio').doc(slug).get();
        if (snap.exists) {
          prenom = snap.data().prenom || '';
          if (snap.data().photo) image = snap.data().photo;
        }
      } catch {}

      // Sinon essayer contacts_publics
      if (!prenom) {
        try {
          const snap2 = await db.collection('contacts_publics').doc(slug).get();
          if (snap2.exists) {
            const uid = snap2.data().uid || slug;
            const snap3 = await db.collection('linkbio').doc(uid).get();
            if (snap3.exists) {
              prenom = snap3.data().prenom || '';
              if (snap3.data().photo) image = snap3.data().photo;
            }
          }
        } catch {}
      }
    }

    const nom = prenom || 'notre equipe';

    if (bioSlug) {
      titre = 'Decouvre l\'univers de ' + nom + ' \uD83C\uDF3F';
      description = nom + ' partage ses produits beaute preferes et son parcours Mihi. Clique pour en savoir plus !';
    } else if (recrutSlug) {
      titre = 'Rejoins l\'equipe de ' + nom + ' ! \uD83D\uDD25';
      description = 'Decouvre comment creer ta boutique en ligne gratuite et developper ton business beaute depuis chez toi.';
    } else if (boutiqueSlug) {
      titre = 'La boutique de ' + nom + ' — Mihi France \uD83D\uDECD\uFE0F';
      description = 'Decouvre des produits cosmetiques de qualite pharmaceutique. Boutique personnalisee par ' + nom + '.';
    } else if (diagUid) {
      titre = 'Diagnostic beaute offert par ' + nom + ' \u2728';
      description = 'Reponds a quelques questions et recois tes recommandations de produits personnalisees. Gratuit !';
    }
  } catch (e) {
    console.error('MetaTags error:', e);
  }

  const lienOriginal = 'https://blazing-dinasty-1fad9.web.app' + (url.startsWith('/') ? url : '?' + url.split('?')[1]);

  const html = \`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta property="og:title" content="\${titre}">
  <meta property="og:description" content="\${description}">
  <meta property="og:image" content="\${image}">
  <meta property="og:url" content="\${lienOriginal}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="\${titre}">
  <meta name="twitter:description" content="\${description}">
  <meta name="twitter:image" content="\${image}">
  <meta http-equiv="refresh" content="0;url=\${lienOriginal}">
  <title>\${titre}</title>
</head>
<body>
  <script>window.location.href = "\${lienOriginal}";</script>
</body>
</html>\`;

  res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
  res.send(html);
});
`;

c = c + newFunction;
fs.writeFileSync(f, c, 'utf8');
console.log('OK - fonction metaTags ajoutee');
