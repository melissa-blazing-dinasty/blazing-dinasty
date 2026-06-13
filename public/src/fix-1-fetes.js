// fix-1-fetes.js
// Lance avec : node fix-1-fetes.js
// À placer dans le même dossier que App.js (src/)

const fs = require("fs");
const path = require("path");

const APP_PATH = path.join(__dirname, "App.js");
const BACKUP_PATH = path.join(__dirname, "App.js.backup-fetes-" + Date.now());

if (!fs.existsSync(APP_PATH)) {
  console.error("❌ App.js introuvable dans ce dossier.");
  process.exit(1);
}

const content = fs.readFileSync(APP_PATH, "utf8");

const START_MARKER = "const FETES_IMPORTANTES=[";
const END_MARKER_SEARCH_FROM = content.indexOf(START_MARKER);

if (END_MARKER_SEARCH_FROM === -1) {
  console.error("❌ Impossible de trouver 'const FETES_IMPORTANTES=['. Aucune modification effectuée.");
  process.exit(1);
}

// Trouver la fin du tableau : on cherche "];" après le marqueur de début
const afterStart = content.indexOf("\n];", END_MARKER_SEARCH_FROM);
if (afterStart === -1) {
  console.error("❌ Impossible de trouver la fin du tableau FETES_IMPORTANTES.");
  process.exit(1);
}
const endIdx = afterStart + "\n];".length;

const NEW_FETES = `const FETES_IMPORTANTES=[
  // ── JANVIER ──
  {title:"🎆 Nouvel An",date:"2026-01-01",type:"fete",notes:"Bonne résolution beauté & bien-être — moment idéal pour pitcher"},
  {title:"👑 Épiphanie / Galette des rois",date:"2026-01-06",type:"fete",notes:"Moment convivial — contenu lifestyle, partage en famille"},
  {title:"🌙 Nouvel An chinois",date:"2026-02-17",type:"fete",notes:"Symbole de renouveau — bon thème pour parler de nouveaux départs"},

  // ── FÉVRIER ──
  {title:"💝 Saint-Valentin",date:"2026-02-14",type:"fete",notes:"Parfums, soins visage, coffrets — offres cadeau à proposer"},
  {title:"😂 Journée mondiale du rire",date:"2026-02-09",type:"fete",notes:"Contenu fun et divertissant — bon pour l'engagement"},

  // ── MARS ──
  {title:"👩 Journée internationale des Femmes",date:"2026-03-08",type:"fete",notes:"Parfaite occasion pour les promos soins & bien-être, mise en avant des femmes entrepreneures"},
  {title:"🍀 Saint-Patrick",date:"2026-03-17",type:"fete",notes:"Thème vert/chance — contenu léger et fun"},
  {title:"🌸 Printemps — Équinoxe",date:"2026-03-20",type:"fete",notes:"Renouveau, fraîcheur — bon moment pour relancer les routines skincare"},
  {title:"🕐 Changement d'heure (été)",date:"2026-03-29",type:"fete",notes:"On perd 1h de sommeil — bon angle pour parler énergie/vitalité"},

  // ── AVRIL ──
  {title:"🐣 Pâques",date:"2026-04-05",type:"fete",notes:"Coffrets cadeaux, chocolat & soin de soi — contenu familial"},
  {title:"🌍 Journée de la Terre",date:"2026-04-22",type:"fete",notes:"Naturalité des produits Mihi — bon angle écoresponsable"},

  // ── MAI ──
  {title:"💪 Fête du Travail",date:"2026-05-01",type:"fete",notes:"Bonne période pour parler liberté financière et indépendance"},
  {title:"🌸 Fête des Mères",date:"2026-05-31",type:"fete",notes:"Meilleure période de l'année — prépare tes offres coffrets"},
  {title:"☀️ Journée mondiale du bien-être",date:"2026-05-09",type:"fete",notes:"Parfait pour mettre en avant les compléments et routines bien-être"},

  // ── JUIN ──
  {title:"👔 Fête des Pères",date:"2026-06-21",type:"fete",notes:"Parfums homme, soins corps — ne pas négliger"},
  {title:"☀️ Été — Solstice",date:"2026-06-21",type:"fete",notes:"Routine été, protection solaire, fraîcheur — bon contenu saisonnier"},
  {title:"🌈 Journée internationale de la Fierté (Pride)",date:"2026-06-28",type:"fete",notes:"Inclusivité — message de bienveillance pour ton équipe"},

  // ── JUILLET ──
  {title:"🇫🇷 Fête Nationale",date:"2026-07-14",type:"fete",notes:"Contenu festif, feu d'artifice — bonne occasion de visibilité légère"},
  {title:"🏖️ Vacances d'été",date:"2026-07-15",type:"fete",notes:"Période calme pour les ventes — privilégier storytelling et préparation rentrée"},

  // ── AOÛT ──
  {title:"☀️ Mi-été",date:"2026-08-15",type:"fete",notes:"Bon moment pour relancer les clientes avant la rentrée"},
  {title:"🎒 Préparation rentrée",date:"2026-08-25",type:"fete",notes:"Bonne période pour recruter — les gens cherchent un revenu complémentaire avant la rentrée"},

  // ── SEPTEMBRE ──
  {title:"🎓 Rentrée",date:"2026-09-01",type:"fete",notes:"Bonne période pour recruter — les gens cherchent un revenu complémentaire"},
  {title:"🍂 Automne — Équinoxe",date:"2026-09-22",type:"fete",notes:"Routine automne, transition skincare — bon contenu saisonnier"},
  {title:"👵 Journée internationale des Grands-Parents",date:"2026-09-13",type:"fete",notes:"Contenu famille et transmission — touchant pour le storytelling"},

  // ── OCTOBRE ──
  {title:"🎃 Halloween",date:"2026-10-31",type:"fete",notes:"Maquillage, soins — contenu fun à créer"},
  {title:"🌷 Journée internationale des Filles",date:"2026-10-11",type:"fete",notes:"Empowerment féminin — bon angle pour le recrutement de femmes"},
  {title:"🕐 Changement d'heure (hiver)",date:"2026-10-25",type:"fete",notes:"On gagne 1h — bon moment pour parler routines du soir et sommeil"},

  // ── NOVEMBRE ──
  {title:"🛍️ Black Friday",date:"2026-11-27",type:"deadline",notes:"Prépare tes offres promotionnelles à l'avance"},
  {title:"🛒 Cyber Monday",date:"2026-11-30",type:"deadline",notes:"Suite du Black Friday — relance digitale"},
  {title:"🎗️ Movember",date:"2026-11-01",type:"fete",notes:"Santé masculine — bon angle pour produits homme et bien-être"},

  // ── DÉCEMBRE ──
  {title:"🎁 Noël (commandes)",date:"2026-12-15",type:"deadline",notes:"⚠️ Dernière date pour commander avant Noël"},
  {title:"🎄 Noël",date:"2026-12-25",type:"fete",notes:"Cadeau parfait : parfums, soins corps, coffrets Mihi"},
  {title:"🎆 Réveillon du Nouvel An",date:"2026-12-31",type:"fete",notes:"Bilan de l'année + lancement nouvelles résolutions — excellent pour le storytelling"},
];`;

// Sauvegarde de sécurité
fs.writeFileSync(BACKUP_PATH, content, "utf8");
console.log("✅ Sauvegarde créée : " + path.basename(BACKUP_PATH));

// Remplacement
const newContent = content.slice(0, END_MARKER_SEARCH_FROM) + NEW_FETES + content.slice(endIdx);
fs.writeFileSync(APP_PATH, newContent, "utf8");

console.log("✅ App.js mis à jour avec succès ! Liste de fêtes enrichie (30+ occasions).");
console.log("");
console.log("👉 Prochaines étapes :");
console.log("   1. npm run build");
console.log("   2. firebase deploy");
console.log("");
console.log("ℹ️  Si quelque chose ne va pas, restaure la sauvegarde :");
console.log("   " + path.basename(BACKUP_PATH) + " → renomme-le en App.js");
