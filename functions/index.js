const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

async function sendNotifToUid(uid, title, body) {
  try {
    const tokensSnap = await db.collection("fcm_tokens").doc(uid).get();
    if (!tokensSnap.exists) return;
    const tokens = Object.values(tokensSnap.data() || {}).filter(Boolean);
    if (!tokens.length) return;
    await messaging.sendEachForMulticast({ tokens, notification: { title, body } });
  } catch(e) { console.error("sendNotifToUid error", uid, e); }
}

async function sendNotifToAll(title, body) {
  try {
    const snap = await db.collection("fcm_tokens").get();
    const tokens = [];
    snap.forEach(doc => { Object.values(doc.data() || {}).forEach(t => { if(t) tokens.push(t); }); });
    if (!tokens.length) return;
    for (let i = 0; i < tokens.length; i += 500) {
      await messaging.sendEachForMulticast({ tokens: tokens.slice(i,i+500), notification: { title, body } });
    }
  } catch(e) { console.error("sendNotifToAll error", e); }
}

exports.notifMatin = onSchedule({ schedule: "30 7 * * *", timeZone: "Europe/Paris" }, async () => {
  await sendNotifToAll("Bonjour Blazing !", "Ta citation du jour t attend. Ouvre l app pour bien demarrer ta journee");
});

exports.notifSoir = onSchedule({ schedule: "30 20 * * *", timeZone: "Europe/Paris" }, async () => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const usersSnap = await db.collection("users").get();
    for (const doc of usersSnap.docs) {
      const lastLogin = (doc.data()["db-last-login"] || "");
      if (lastLogin !== today) {
        await sendNotifToUid(doc.id, "Tu nous manques !", "Tu n as pas encore ouvert l app aujourd hui. 5 minutes suffisent !");
      }
    }
  } catch(e) { console.error("notifSoir error", e); }
});

exports.notifReco = onDocumentUpdated("users/{uid}", async (event) => {
  try {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const uid = event.params.uid;
    const pb = before["db-prospects"] ? JSON.parse(before["db-prospects"]) : [];
    const pa = after["db-prospects"] ? JSON.parse(after["db-prospects"]) : [];
    const nouvelles = pa.filter(p => p.source === "recommandation" && !pb.find(b => b.id === p.id));
    if (nouvelles.length > 0) {
      const nb = nouvelles.length;
      const msg = nb === 1 ? (nouvelles[0].name + " a ete recommandee !") : (nb + " nouvelles recommandations recues !");
      await sendNotifToUid(uid, "Nouvelle recommandation !", msg);
    }
  } catch(e) { console.error("notifReco error", e); }
});

exports.notifDiag = onDocumentUpdated("diag_ex/{docId}", async (event) => {
  try {
    const after = event.data.after.data();
    const uid = after.distributeurId || after.uid;
    if (!uid) return;
    const prenom = after.prenom || "Une cliente";
    await sendNotifToUid(uid, "Nouveau diagnostic !", prenom + " vient de completer son diagnostic parfum !");
  } catch(e) { console.error("notifDiag error", e); }
});
const {onCall, HttpsError} = require("firebase-functions/v2/https");

exports.authentifier = onCall(async (request) => {
  const {prenom, nom, codeSecret, motDePasse} = request.data || {};
  if (!prenom || !nom) throw new HttpsError("invalid-argument", "Prenom et nom requis");

  const SECRET_CODE = "BD-2026-FIRE";
  if ((codeSecret || "").trim().toUpperCase() !== SECRET_CODE) {
    throw new HttpsError("permission-denied", "Code d'acces incorrect");
  }

  const fullName = (prenom.trim().toLowerCase() + " " + nom.trim().toLowerCase());
  const uid = fullName.replace(/\s+/g, "-");
  const isMelissa = fullName === "melissa da silveira";

  const accRef = db.collection("acces").doc("membres");
  const accSnap = await accRef.get();
  const accData = accSnap.exists ? accSnap.data() : {};

  if (isMelissa) {
    const chefs = accData.chefs || [];
    const chefsArr = Array.isArray(chefs) ? chefs : Object.values(chefs || {});
    if (!chefsArr.includes("melissa da silveira")) {
      await accRef.set(Object.assign({}, accData, {chefs: chefsArr.concat(["melissa da silveira"])}), {merge: true});
    }
  } else {
    const membres = accData.liste || [];
    const autorise = membres.some((m) => m.toLowerCase() === fullName);
    if (!autorise) {
      throw new HttpsError("permission-denied", "Prenom/Nom non reconnu");
    }
  }

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() : null;
  const secretRef = db.collection("secrets").doc(uid);
  const secretSnap = await secretRef.get();
  const secretData = secretSnap.exists ? secretSnap.data() : null;
  const displayName = prenom.trim() + " " + nom.trim();

  const mdpStocke = secretData ? secretData["db-mdp"] : (userData ? userData["db-mdp"] : null);

  if (mdpStocke) {
    if (!motDePasse) {
      return {status: "password_required", uid: uid, displayName: displayName};
    }
    if (motDePasse !== mdpStocke) {
      throw new HttpsError("permission-denied", "Code personnel incorrect");
    }
    const token = await admin.auth().createCustomToken(uid);
    return {status: "ok", token: token, uid: uid, displayName: displayName};
  } else {
    const token = await admin.auth().createCustomToken(uid);
    return {status: "nouveau", token: token, uid: uid, displayName: displayName, isMelissa: isMelissa};
  }
});

exports.soumettreDiagnostic = onCall(async (request) => {
  const {uid, type, nomClient, contact, reponses} = request.data || {};
  if (!uid || !type) throw new HttpsError("invalid-argument", "Donnees manquantes");
  const ts = Date.now();
  const dateStr = new Date().toISOString().slice(0,10);
  const nomFinal = nomClient || "Cliente";
  await db.collection("diag_externes").doc(uid + "_" + ts).set({
    uid, type, nomClient: nomFinal, contact: contact || {},
    reponses: reponses || {}, date: dateStr, ts, traite: false
  });
  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  const existing = snap.exists && snap.data()["db-diagnostics"] ? JSON.parse(snap.data()["db-diagnostics"]) : [];
  const newDiag = {
    id: "diag" + ts, type, nomClient: nomFinal, contact: contact || {},
    reponses: reponses || {}, date: dateStr, ts, externe: true, nonLu: true
  };
  const nextList = [newDiag].concat(existing).slice(0, 50);
  await userRef.set({"db-diagnostics": JSON.stringify(nextList)}, {merge: true});
  return {status: "ok"};
});
exports.definirMotDePasse = onCall(async (request) => {
  const auth = request.auth;
  if (!auth || !auth.uid) throw new HttpsError("unauthenticated", "Non connecte");
  const {motDePasse} = request.data || {};
  if (!motDePasse || motDePasse.length < 4) {
    throw new HttpsError("invalid-argument", "Mot de passe trop court");
  }
  await db.collection("secrets").doc(auth.uid).set({"db-mdp": motDePasse}, {merge: true});
  return {status: "ok"};
});