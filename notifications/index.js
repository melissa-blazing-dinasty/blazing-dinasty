const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// 🌅 Notification matin (8h) — tout le monde
exports.notifMatin = onSchedule(
  { schedule: "0 8 * * *", timeZone: "Europe/Paris" },
  async () => {
    const tokens = await getAllTokens();
    if (tokens.length === 0) return;
    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: "Bonjour ! 🌸",
        body: "Ta carte du jour t'attend dans Blazing Dynasty ✨",
      },
    });
  }
);

// 🌙 Notification soir (20h) — uniquement celles non connectées aujourd'hui
exports.notifSoir = onSchedule(
  { schedule: "0 20 * * *", timeZone: "Europe/Paris" },
  async () => {
    const today = new Date().toISOString().slice(0, 10);
    const tokensSnap = await db.collection("fcm_tokens").get();
    const tokens = [];
    for (const doc of tokensSnap.docs) {
      const uid = doc.data().uid;
      const userSnap = await db.collection("users").doc(uid).get();
      const lastLogin = userSnap.exists ? userSnap.data()["db-last-login"] : null;
      if (lastLogin !== today) {
        tokens.push(doc.data().token);
      }
    }
    if (tokens.length === 0) return;
    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: "Tu nous manques ! 💛",
        body: "Prends 5 minutes pour toi ce soir — ta carte du jour t'attend 🌙",
      },
    });
  }
);

async function getAllTokens() {
  const snap = await db.collection("fcm_tokens").get();
  return snap.docs.map((d) => d.data().token).filter(Boolean);
}