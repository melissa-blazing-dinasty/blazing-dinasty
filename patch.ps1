$content = @"
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {onDocumentUpdated} = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

async function sendNotifToUid(uid, title, body) {
  try {
    const tokensSnap = await db.collection('fcm_tokens').doc(uid).get();
    if (!tokensSnap.exists) return;
    const tokens = Object.values(tokensSnap.data() || {}).filter(Boolean);
    if (!tokens.length) return;
    await messaging.sendEachForMulticast({ tokens, notification: { title, body } });
  } catch(e) { console.error('sendNotifToUid error', uid, e); }
}

async function sendNotifToAll(title, body) {
  try {
    const snap = await db.collection('fcm_tokens').get();
    const tokens = [];
    snap.forEach(doc => { Object.values(doc.data() || {}).forEach(t => { if(t) tokens.push(t); }); });
    if (!tokens.length) return;
    for (let i = 0; i < tokens.length; i += 500) {
      await messaging.sendEachForMulticast({ tokens: tokens.slice(i,i+500), notification: { title, body } });
    }
  } catch(e) { console.error('sendNotifToAll error', e); }
}

exports.notifMatin = onSchedule({ schedule: '30 7 * * *', timeZone: 'Europe/Paris' }, async () => {
  await sendNotifToAll('🌸 Bonjour Blazing !', 'Ta citation du jour t attend. Ouvre l app pour bien demarrer ta journee ✨');
});

exports.notifSoir = onSchedule({ schedule: '30 20 * * *', timeZone: 'Europe/Paris' }, async () => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const usersSnap = await db.collection('users').get();
    for (const doc of usersSnap.docs) {
      const lastLogin = (doc.data()['db-last-login'] || '');
      if (lastLogin !== today) {
        await sendNotifToUid(doc.id, '🔥 Tu nous manques !', 'Tu n as pas encore ouvert l app aujourd hui. 5 minutes suffisent !');
      }
    }
  } catch(e) { console.error('notifSoir error', e); }
});

exports.notifReco = onDocumentUpdated('users/{uid}', async (event) => {
  try {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const uid = event.params.uid;
    const pb = before['db-prospects'] ? JSON.parse(before['db-prospects']) : [];
    const pa = after['db-prospects'] ? JSON.parse(after['db-prospects']) : [];
    const nouvelles = pa.filter(p => p.source === 'recommandation' && !pb.find(b => b.id === p.id));
    if (nouvelles.length > 0) {
      const nb = nouvelles.length;
      const msg = nb === 1 ? (nouvelles[0].name + ' a ete recommandee !') : (nb + ' nouvelles recommandations recues !');
      await sendNotifToUid(uid, '🤝 Nouvelle recommandation !', msg);
    }
  } catch(e) { console.error('notifReco error', e); }
});

exports.notifDiag = onDocumentUpdated('diag_ex/{docId}', async (event) => {
  try {
    const after = event.data.after.data();
    const uid = after.distributeurId || after.uid;
    if (!uid) return;
    const prenom = after.prenom || 'Une cliente';
    await sendNotifToUid(uid, '🩺 Nouveau diagnostic !', prenom + ' vient de completer son diagnostic parfum !');
  } catch(e) { console.error('notifDiag error', e); }
});
"@
$content | Out-File "C:\Users\melou\blazing-dynasty\functions\index.js" -Encoding UTF8
Write-Host "Done"
