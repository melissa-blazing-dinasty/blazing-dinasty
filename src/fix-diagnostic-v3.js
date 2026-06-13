// fix-diagnostic-v3.js
// Lance avec : node fix-diagnostic-v3.js
// À placer dans le même dossier que App.js (src/)

const fs = require("fs");
const path = require("path");

const APP_PATH = path.join(__dirname, "App.js");
const BACKUP_PATH = path.join(__dirname, "App.js.backup-" + Date.now());

if (!fs.existsSync(APP_PATH)) {
  console.error("❌ App.js introuvable dans ce dossier. Place ce script au même endroit que App.js");
  process.exit(1);
}

const content = fs.readFileSync(APP_PATH, "utf8");

const START_MARKER = "async function genererOrdonnanceIA";
const END_MARKER = "function getRecommandations(type, reponses) { return null; }";

const startIdx = content.indexOf(START_MARKER);
const endIdxRaw = content.indexOf(END_MARKER);

if (startIdx === -1 || endIdxRaw === -1) {
  console.error("❌ Impossible de trouver les marqueurs dans App.js. Aucune modification effectuée.");
  console.error("   START trouvé : " + (startIdx !== -1));
  console.error("   END trouvé   : " + (endIdxRaw !== -1));
  process.exit(1);
}

const endIdx = endIdxRaw + END_MARKER.length;

const NEW_FUNCTION = `// ── DIAGNOSTIC IA ────────────────────────────────────────────────────────────
async function genererOrdonnanceIA(type, reponses, nomClient) {
  // Charger les notes admin si elles existent
  let notesAdmin = "";
  try {
    const snap = await getDoc(doc(db,"admin","diag_notes"));
    if(snap.exists() && snap.data()[type]) notesAdmin = snap.data()[type];
  } catch {}

  // Charger le catalogue réel des produits Mihi
  let catalogueText = "";
  try {
    const catSnap = await getDoc(doc(db,"admin","catalogue_mihi"));
    if(catSnap.exists()){
      const cat = catSnap.data();
      const cle = type === "skincare" ? "face" : type === "cheveux" ? "hair" : "health";
      let produits = cat[cle] || [];
      // Limite à 40 produits max pour ne pas surcharger le prompt
      if(produits.length > 40) produits = produits.slice(0, 40);
      catalogueText = produits.map(p => \`- \${p.nom} (série \${p.serie}) — \${p.prix}€\`).join("\\n");
    }
  } catch (e) {
    console.error("Erreur chargement catalogue:", e);
  }

  if(!catalogueText){
    console.error("Catalogue vide pour le type:", type);
  }

  const typeLabel = type === "skincare" ? "soin visage/peau" : type === "cheveux" ? "soin capillaire" : "santé et compléments alimentaires";
  
  const reponsesText = Object.entries(reponses).map(([k,v]) => \`- \${k}: \${v}\`).join("\\n");
  
  const prompt = \`Tu es une experte en cosmétiques et bien-être pour la marque MIHI (mihi.care). 
Une cliente vient de répondre à un diagnostic \${typeLabel}.

Prénom cliente: \${nomClient || "Cliente"}
Réponses au questionnaire:
\${reponsesText}
\${notesAdmin ? \`\\nInstructions spéciales de la distributrice:\\n\${notesAdmin}\` : ""}

CATALOGUE RÉEL DES PRODUITS MIHI DISPONIBLES (les noms sont en anglais — utilise UNIQUEMENT ces produits et leurs prix EXACTS, n'invente JAMAIS de produit ou de prix qui n'est pas dans cette liste) :
\${catalogueText}

Génère une ordonnance beauté complète avec 3 packs basés EXCLUSIVEMENT sur les produits ci-dessus :

1. 💚 PACK PETIT BUDGET — 1 à 2 produits maximum, les plus essentiels pour commencer
2. ⭐ PACK BEST SELLER — 3 à 4 produits, la routine complète recommandée
3. 🚀 PACK BOOST — 4 à 5 produits, la routine premium avec maximum de résultats

IMPORTANT — TRADUCTION DES NOMS :
Les noms de produits du catalogue sont en anglais. Dans ta réponse, traduis chaque nom de produit en français naturel et commercial (garde le nom de la série/gamme si c'est une marque, ex: "Face Architect" peut rester tel quel, mais traduis les mots descriptifs comme "cream"→"crème", "serum"→"sérum", "shampoo"→"shampoing", "eye cream"→"crème contour des yeux", etc.). Le prix doit rester EXACTEMENT celui du catalogue.

Pour chaque pack donne:
- Les produits du catalogue ci-dessus, avec leur nom TRADUIT EN FRANÇAIS et leur prix EXACT (inchangé)
- L'ordre d'utilisation (matin / soir)
- Le bénéfice principal de chaque produit
- Le total réel = somme exacte des prix des produits choisis (calcule-le toi-même, en te basant sur les prix originaux du catalogue)

Réponds UNIQUEMENT en JSON valide sans markdown, sans texte avant ou après, format exact:
{
  "introduction": "texte personnalisé de 2 phrases pour \${nomClient || 'la cliente'} basé sur son profil",
  "budget": {
    "total": "29.6€",
    "produits": [
      {"nom": "Nom du produit traduit en français", "prix": "29.6€", "usage": "Matin et soir", "benefice": "..."}
    ],
    "routine": "Description courte de la routine"
  },
  "bestseller": {
    "total": "65.4€", 
    "produits": [
      {"nom": "Nom du produit traduit en français", "prix": "21.5€", "usage": "Matin", "benefice": "..."}
    ],
    "routine": "Description courte de la routine"
  },
  "boost": {
    "total": "102.3€",
    "produits": [
      {"nom": "Nom du produit traduit en français", "prix": "32.3€", "usage": "Soir", "benefice": "..."}
    ],
    "routine": "Description courte de la routine"
  }
}\`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "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",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();

    if(data.error){
      console.error("Erreur API Claude:", data.error);
      return null;
    }

    const text = data.content?.map(i => i.text || "").join("") || "";
    const clean = text.replace(/\`\`\`json|\`\`\`/g, "").trim();

    try {
      return JSON.parse(clean);
    } catch(parseErr) {
      console.error("Erreur parsing JSON:", parseErr);
      console.error("Texte reçu de l'IA:", text);
      return null;
    }
  } catch (fetchErr) {
    console.error("Erreur réseau / fetch:", fetchErr);
    return null;
  }
}

function getRecommandations(type, reponses) { return null; }`;

// Sauvegarde de sécurité
fs.writeFileSync(BACKUP_PATH, content, "utf8");
console.log("✅ Sauvegarde créée : " + path.basename(BACKUP_PATH));

// Remplacement
const newContent = content.slice(0, startIdx) + NEW_FUNCTION + content.slice(endIdx);
fs.writeFileSync(APP_PATH, newContent, "utf8");

console.log("✅ App.js mis à jour avec succès !");
console.log("");
console.log("👉 Prochaines étapes :");
console.log("   1. npm run build");
console.log("   2. firebase deploy");
console.log("");
console.log("ℹ️  Si quelque chose ne va pas, restaure la sauvegarde :");
console.log("   " + path.basename(BACKUP_PATH) + " → renomme-le en App.js");
