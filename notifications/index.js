const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();

const BOT_TOKEN = '8971559892:AAGAeNbKUg3jcIbG7FBhLUie8DZkOBQJXGw';
const GROUP_ID = -1002114990247;

// Correspondance topic → catégorie
const TOPIC_CATEGORIES = {
  // Visuels & Moods
  'Mood Saint Valentin': 'Visuels & Moods',
  'Mood Perte de poids': 'Visuels & Moods',
  'Mood Noël': 'Visuels & Moods',
  'Mood Automne': 'Visuels & Moods',
  'Octobre Rose': 'Visuels & Moods',
  'Prompt pour visuels': 'Visuels & Moods',
  // Produits & Catalogue
  'Catalogue 8': 'Produits & Catalogue',
  'Fiches produits types': 'Produits & Catalogue',
  'Retour crème thermique': 'Produits & Catalogue',
  'Les indispensables': 'Produits & Catalogue',
  'Laboratoire Elfabio': 'Produits & Catalogue',
  'Logo Mihi': 'Produits & Catalogue',
  // Business & Recrutement
  'Pack pour booster': 'Business & Recrutement',
  'Recrutement !!': 'Business & Recrutement',
  'Recrutement Portugal': 'Business & Recrutement',
  'TOUT POUR LA PERFORMANCE': 'Business & Recrutement',
  'Astuces pour booster': 'Business & Recrutement',
  'Le démarrage': 'Business & Recrutement',
  'Comparatif de prix': 'Business & Recrutement',
  // Formation & Outils
  'Mini formation': 'Formation & Outils',
  'Replay zoom formation': 'Formation & Outils',
  'Script réel': 'Formation & Outils',
  'Post tips/humour': 'Formation & Outils',
  'Jeux pour booster': 'Formation & Outils',
  'Tips pour fidéliser': 'Formation & Outils',
  'Outils': 'Formation & Outils',
  'Astuce montage': 'Formation & Outils',
  // Contenu Réseaux
  'Stories': 'Contenu Réseaux',
  'Montage video': 'Contenu Réseaux',
  'Mini vidéo explicative': 'Contenu Réseaux',
  'IDEES LIVE': 'Contenu Réseaux',
  'Storytelling': 'Contenu Réseaux',
  // Santé & Bien-être
  'PERTE DE POIDS !!!': 'Santé & Bien-être',
  'Fiches pour maladie': 'Santé & Bien-être',
  'Vidéo de Pourquoi Mihi': 'Santé & Bien-être',
  'BOX MYSTÈRE': 'Santé & Bien-être',
};

exports.telegramWebhook = functions.https.onRequest(async (req, res) => {
  try {
    const update = req.body;

    // Vérifie que c'est un message avec photo du bon groupe
    if (!update.message || !update.message.photo) {
      return res.sendStatus(200);
    }

    const message = update.message;
    if (message.chat.id !== GROUP_ID) {
      return res.sendStatus(200);
    }

    // Récupère le topic
    const threadId = message.message_thread_id;
    const caption = message.caption || '';

    // Récupère la plus grande photo
    const photo = message.photo[message.photo.length - 1];
    const fileId = photo.file_id;

    // Récupère l'URL du fichier depuis Telegram
    const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    const filePath = fileData.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

    // Télécharge l'image
    const imageRes = await fetch(fileUrl);
    const imageBuffer = await imageRes.buffer();

    // Détermine la catégorie via le threadId
    // On stocke d'abord le mapping threadId → nom du topic dans Firestore
    let category = 'Autres';
    const topicDoc = await admin.firestore().collection('telegram_topics').doc(String(threadId)).get();
    if (topicDoc.exists) {
      const topicName = topicDoc.data().name;
      category = TOPIC_CATEGORIES[topicName] || 'Autres';
    }

    // Upload dans Firebase Storage
    const timestamp = Date.now();
    const fileName = `telegram/${category}/${timestamp}_${fileId}.jpg`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(fileName);

    await file.save(imageBuffer, {
      metadata: { contentType: 'image/jpeg' },
      public: true,
    });

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    // Sauvegarde dans Firestore
    await admin.firestore().collection('banque_images_telegram').add({
      url: publicUrl,
      category,
      caption,
      threadId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      source: 'telegram',
    });

    return res.sendStatus(200);
  } catch (error) {
    console.error('Erreur webhook:', error);
    return res.sendStatus(200);
  }
});

// Fonction pour enregistrer les topics manuellement
exports.registerTopic = functions.https.onRequest(async (req, res) => {
  const { threadId, name } = req.query;
  if (!threadId || !name) {
    return res.status(400).send('threadId et name requis');
  }
  await admin.firestore().collection('telegram_topics').doc(threadId).set({ name });
  return res.send(`Topic enregistré: ${name} → ${TOPIC_CATEGORIES[name] || 'Autres'}`);
});