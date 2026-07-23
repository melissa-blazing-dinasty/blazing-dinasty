const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onRequest} = require("firebase-functions/v2/https");
const {onDocumentUpdated, onDocumentCreated, onDocumentWritten} = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp({storageBucket: "blazing-dinasty-1fad9.firebasestorage.app"});
const db = admin.firestore();
const messaging = admin.messaging();

async function sendNotifToUid(uid, title, body) {
  try {
    const tokensSnap = await db.collection("fcm_tokens").doc(uid).get();
    if (!tokensSnap.exists) { console.log("[sendNotifToUid] Aucun document fcm_tokens pour", uid); return; }
    const tokens = Object.values(tokensSnap.data() || {}).filter(Boolean);
    if (!tokens.length) { console.log("[sendNotifToUid] Document fcm_tokens vide pour", uid); return; }
    const result = await messaging.sendEachForMulticast({ tokens, notification: { title, body } });
    console.log("[sendNotifToUid] Resultat pour", uid, ": successCount=", result.successCount, "failureCount=", result.failureCount);
    result.responses.forEach((r, i) => {
      if (!r.success) {
        console.error("[sendNotifToUid] Token", i, "echoue:", tokens[i], "erreur:", r.error && r.error.code, r.error && r.error.message);
      }
    });
  } catch(e) { console.error("[sendNotifToUid] error", uid, e); }
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

exports.notifDiag = onDocumentCreated("diag_ex/{docId}", async (event) => {
  try {
    const snap = event.data;
    const after = snap.data();
    const uid = after.distributeurId || after.uid;
    if (!uid) return;
    const prenom = after.prenom || "Une cliente";
    await sendNotifToUid(uid, "Nouveau diagnostic !", prenom + " vient de completer son diagnostic parfum !");
  } catch(e) { console.error("notifDiag error", e); }
});
exports.notifChallenge = onDocumentUpdated("challenges/liste", async (event) => {
  try {
    const before = event.data.before.data() || {};
    const after = event.data.after.data() || {};
    const itemsBefore = before.items || [];
    const itemsAfter = after.items || [];
    const nouveaux = itemsAfter.filter(c => !itemsBefore.find(b => b.id === c.id));
    if (!nouveaux.length) return;
    let annuaire = null;
    const getAnnuaire = async () => {
      if (annuaire) return annuaire;
      const snap = await db.collection("equipe").doc("annuaire").get();
      annuaire = snap.exists ? (snap.data().membres || {}) : {};
      return annuaire;
    };
    const getDescendants = (rootUid, ann) => {
      const result = new Set();
      const queue = [rootUid];
      while (queue.length) {
        const current = queue.pop();
        Object.entries(ann).forEach(([k, m]) => {
          if (m.marraine === current && !result.has(k)) { result.add(k); queue.push(k); }
        });
      }
      return [...result];
    };
    for (const c of nouveaux) {
      const titre = c.titre || "Nouveau challenge";
      const body = "Un nouveau challenge vient d etre lance : " + titre + ". Viens le decouvrir !";
      if (c.global || !c.equipesCibles || c.equipesCibles.length === 0 || c.equipesCibles.includes("all")) {
        await sendNotifToAll("🏆 Nouveau challenge !", body);
      } else {
        const ann = await getAnnuaire();
        const recipients = new Set();
        c.equipesCibles.forEach(chefUid => {
          recipients.add(chefUid);
          getDescendants(chefUid, ann).forEach(u => recipients.add(u));
        });
        for (const uid of recipients) {
          await sendNotifToUid(uid, "🏆 Nouveau challenge !", body);
        }
      }
    }
  } catch(e) { console.error("notifChallenge error", e); }
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
exports.reinitialiserMotDePasse = onCall(async (request) => {
  const {prenom, nom, codeSecret, nouveauMotDePasse} = request.data || {};
  if (!prenom || !nom || !nouveauMotDePasse) throw new HttpsError("invalid-argument", "Donnees manquantes");
  if (nouveauMotDePasse.length < 4) throw new HttpsError("invalid-argument", "Mot de passe trop court");
  const SECRET_CODE = "BD-2026-FIRE";
  if ((codeSecret || "").trim().toUpperCase() !== SECRET_CODE) {
    throw new HttpsError("permission-denied", "Code d'acces incorrect");
  }
  const fullName = (prenom.trim().toLowerCase() + " " + nom.trim().toLowerCase());
  const uid = fullName.replace(/\s+/g, "-");
  const isMelissa = fullName === "melissa da silveira";
  if (!isMelissa) {
    const accRef = db.collection("acces").doc("membres");
    const accSnap = await accRef.get();
    const accData = accSnap.exists ? accSnap.data() : {};
    const membres = accData.liste || [];
    const autorise = membres.some((m) => m.toLowerCase() === fullName);
    if (!autorise) throw new HttpsError("permission-denied", "Prenom/Nom non reconnu");
  }
  await db.collection("secrets").doc(uid).set({"db-mdp": nouveauMotDePasse}, {merge: true});
  const token = await admin.auth().createCustomToken(uid);
  return {status: "ok", token: token, uid: uid, displayName: prenom.trim() + " " + nom.trim()};
});

exports.notifRelance = onSchedule({ schedule: "0 8 * * *", timeZone: "Europe/Paris" }, async () => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const usersSnap = await db.collection("users").get();
    for (const doc of usersSnap.docs) {
      const uid = doc.id;
      const data = doc.data();
      let dues = 0;
      try {
        const prospects = data["db-prospects"] ? JSON.parse(data["db-prospects"]) : [];
        dues += prospects.filter(p => p.relance && p.relance <= today && p.statut !== "Converti" && p.statut !== "Archive").length;
      } catch (e) {}
      try {
        const clients = data["db-clients"] ? JSON.parse(data["db-clients"]) : [];
        clients.forEach(c => {
          (c.rappels || []).forEach(r => {
            if (!r.fait && r.date && r.date <= today) dues += 1;
          });
        });
      } catch (e) {}
      if (dues > 0) {
        const msg = dues === 1 ? "Tu as 1 relance a faire aujourd hui !" : ("Tu as " + dues + " relances a faire aujourd hui !");
        await sendNotifToUid(uid, "🔔 Relances du jour", msg);
      }
    }
  } catch (e) { console.error("notifRelance error", e); }
});

exports.notifInfoImportante = onDocumentUpdated("communaute/infos", async (event) => {
  try {
    const before = event.data.before.data() || {};
    const after = event.data.after.data() || {};
    const idsBefore = Object.keys(before);
    const idsAfter = Object.keys(after);
    const nouveaux = idsAfter.filter(id => !idsBefore.includes(id));
    if (!nouveaux.length) return;
    for (const id of nouveaux) {
      const info = after[id];
      await sendNotifToAll("📌 Info importante", info.titre || "Une nouvelle info a ete publiee");
    }
  } catch (e) { console.error("notifInfoImportante error", e); }
});

exports.notifCommentaire = onDocumentUpdated("communaute/posts", async (event) => {
  try {
    const before = event.data.before.data() || {};
    const after = event.data.after.data() || {};
    for (const id of Object.keys(after)) {
      const postAvant = before[id];
      const postApres = after[id];
      if (!postAvant || !postApres) continue;
      const commentsAvant = (postAvant.comments || []).length;
      const commentsApres = (postApres.comments || []).length;
      if (commentsApres > commentsAvant) {
        const dernierComment = postApres.comments[postApres.comments.length - 1];
        const auteurUid = (postApres.author || "").toLowerCase().replace(/\s+/g, "-");
        if (dernierComment && dernierComment.author !== postApres.author) {
          await sendNotifToUid(auteurUid, "💬 Nouveau commentaire", dernierComment.author + " a repondu a ton post");
        }
      }
    }
  } catch (e) { console.error("notifCommentaire error", e); }
});


exports.notifMessage = onDocumentUpdated("conversations/{convId}", async (event) => {
  try {
    const before = event.data.before.data() || {};
    const after = event.data.after.data() || {};
    const msgsBefore = before.messages || [];
    const msgsAfter = after.messages || [];
    if (msgsAfter.length <= msgsBefore.length) return;
    const dernierMsg = msgsAfter[msgsAfter.length - 1];
    const participants = after.participants || [];
    const destinataires = participants.filter(p => p !== dernierMsg.de);
    if (!destinataires.length) return;
    const apercu = dernierMsg.texte ? dernierMsg.texte.slice(0, 60) : "Photo";
    const titre = after.isGroupe ? ("💬 " + (after.nomGroupe || "Groupe") + " · " + dernierMsg.deNom) : ("💬 " + dernierMsg.deNom);
    for (const dest of destinataires) {
      await sendNotifToUid(dest, titre, apercu);
    }
  } catch (e) { console.error("notifMessage error", e); }
});

exports.notifPowerHourDebut = onDocumentWritten("equipe/power-hour", async (event) => {
  try {
    const before = event.data.before.exists ? event.data.before.data() : {};
    const after = event.data.after.exists ? event.data.after.data() : {};
    if (after.startedAt && after.startedAt !== before.startedAt) {
      const nom = after.startedBy || "Un membre de l equipe";
      const themeTexte = after.theme ? (" - Theme : " + after.theme) : "";
      await sendNotifToAll("\u{26A1} Power Hour lancee !", nom + " vient de lancer une Power Hour de 20 minutes." + themeTexte);
    }
  } catch(e) { console.error("notifPowerHourDebut error", e); }
});

exports.notifPowerHourFin = onSchedule({ schedule: "* * * * *", timeZone: "Europe/Paris" }, async () => {
  try {
    const ref = db.collection("equipe").doc("power-hour");
    const snap = await ref.get();
    if (!snap.exists) return;
    const d = snap.data();
    if (!d.startedAt) return;
    const DUREE_MIN = 20 * 60000;
    const elapsed = Date.now() - d.startedAt;
    if (elapsed >= DUREE_MIN && elapsed < DUREE_MIN + 5 * 60000 && !d.finNotifiee) {
      await sendNotifToAll("\u{2705} Power Hour terminee !", "Bravo pour ces 20 minutes de focus intense !");
      await ref.set({finNotifiee: true}, {merge: true});
    }
  } catch(e) { console.error("notifPowerHourFin error", e); }
});

exports.notifAnnonceEquipe = onDocumentWritten("equipe/derniere-annonce", async (event) => {
  try {
    const before = event.data.before.exists ? event.data.before.data() : {};
    const after = event.data.after.exists ? event.data.after.data() : {};
    if (after.id && after.id !== before.id) {
      const titre = (after.icone || "\u{1F4E2}") + " " + (after.titre || "Annonce de l equipe");
      await sendNotifToAll(titre, after.message || "");
    }
  } catch(e) { console.error("notifAnnonceEquipe error", e); }
});
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const resendApiKey = defineSecret("RESEND_API_KEY");

exports.creerCompteStripeConnect = onCall({secrets: [stripeSecretKey]}, async (request) => {
  const auth = request.auth;
  if (!auth || !auth.uid) throw new HttpsError("unauthenticated", "Non connecte");
  const uid = auth.uid;
  const accountToken = request.data && request.data.accountToken;
  if (!accountToken) throw new HttpsError("invalid-argument", "Token de compte manquant (obligatoire pour les plateformes francaises)");
  const stripe = require("stripe")(stripeSecretKey.value());

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() : {};
  let stripeAccountId = userData["db-stripe-account-id"];

  if (stripeAccountId) {
    try {
      await stripe.accounts.retrieve(stripeAccountId);
    } catch (e) {
      console.log("[creerCompteStripeConnect] Compte stocke invalide pour ce mode (probablement cree en mode test), creation d'un nouveau compte. Erreur:", e.message);
      stripeAccountId = null;
    }
  }

  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      account_token: accountToken,
      type: "express",
      country: "FR",
      capabilities: {
        card_payments: {requested: true},
        transfers: {requested: true}
      }
    });
    stripeAccountId = account.id;
    await userRef.set({"db-stripe-account-id": stripeAccountId, "db-stripe-pret": false}, {merge: true});
  }

  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: "https://blazing-dinasty-1fad9.web.app?stripe_refresh=true",
    return_url: "https://blazing-dinasty-1fad9.web.app?stripe_return=true",
    type: "account_onboarding"
  });

  return {url: accountLink.url};
});

exports.verifierStatutStripe = onCall({secrets: [stripeSecretKey]}, async (request) => {
  const auth = request.auth;
  if (!auth || !auth.uid) throw new HttpsError("unauthenticated", "Non connecte");
  const uid = auth.uid;
  const stripe = require("stripe")(stripeSecretKey.value());

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() : {};
  const stripeAccountId = userData["db-stripe-account-id"];

  if (!stripeAccountId) return {connecte: false};

  let account;
  try {
    account = await stripe.accounts.retrieve(stripeAccountId);
  } catch (e) {
    console.log("[verifierStatutStripe] Compte introuvable dans ce mode:", e.message);
    return {connecte: false};
  }
  const pret = account.charges_enabled && account.details_submitted;

  if (pret) {
    await userRef.set({"db-stripe-pret": true}, {merge: true});
  }

  return {connecte: true, pret: pret};
});

exports.creerSessionCheckout = onCall({secrets: [stripeSecretKey]}, async (request) => {
  const {distributeurUid, items, clientInfo, slug} = request.data || {};
  if (!distributeurUid || !items || !items.length) {
    throw new HttpsError("invalid-argument", "Donnees manquantes");
  }
  const stripe = require("stripe")(stripeSecretKey.value());

  const distribRef = db.collection("users").doc(distributeurUid);
  const distribSnap = await distribRef.get();
  const distribData = distribSnap.exists ? distribSnap.data() : {};
  const stripeAccountId = distribData["db-stripe-account-id"];
  if (!stripeAccountId || !distribData["db-stripe-pret"]) {
    throw new HttpsError("failed-precondition", "Cette distributrice n'a pas encore active les paiements");
  }

  const lineItems = items.map(item => ({
    price_data: {
      currency: "eur",
      product_data: {name: item.nom},
      unit_amount: Math.round(item.prix * 100)
    },
    quantity: item.quantite || 1
  }));

  const totalCentimes = items.reduce((s, i) => s + Math.round(i.prix * 100) * (i.quantite || 1), 0);

  const FRAIS_PORT = 590; // 5,90 EUR
  const SEUIL_GRATUIT = 6000; // 60,00 EUR
  const linkbioSnap = await db.collection("linkbio").doc(distributeurUid).get();
  const livraisonGratuiteActivee = linkbioSnap.exists ? !!linkbioSnap.data().livraisonGratuite : false;
  const fraisPort = (livraisonGratuiteActivee && totalCentimes >= SEUIL_GRATUIT) ? 0 : FRAIS_PORT;
  if (fraisPort > 0) {
    lineItems.push({
      price_data: {
        currency: "eur",
        product_data: {name: "Frais de livraison"},
        unit_amount: fraisPort
      },
      quantity: 1
    });
  }

  const totalAvecPortCentimes = totalCentimes + fraisPort;
  const fraisPlateforme = Math.round(totalAvecPortCentimes * 0.015) + 25; // approx frais Stripe (1.5% + 0.25e) pour equilibre neutre

  // Anticipation du palier fidelite (5eme, 10eme... commande) pour personnaliser le retour post-paiement
  let estPalierFidelite = false;
  try {
    const emailNorm = (clientInfo?.email || "").trim().toLowerCase();
    const telNorm = (clientInfo?.tel || "").replace(/\s+/g, "");
    const clientsExistants = distribData["db-clients"] ? JSON.parse(distribData["db-clients"]) : [];
    let clientExistant = null;
    if (emailNorm) clientExistant = clientsExistants.find(c => (c.email || "").trim().toLowerCase() === emailNorm);
    if (!clientExistant && telNorm) clientExistant = clientsExistants.find(c => (c.tel || "").replace(/\s+/g, "") === telNorm);
    const commandesActuelles = clientExistant ? (clientExistant.commandes || []).length : 0;
    estPalierFidelite = (commandesActuelles + 1) % 5 === 0;
  } catch (e) {}

  const slugParam = slug ? "&boutique=" + encodeURIComponent(slug) : "";
  const fideliteParam = estPalierFidelite ? "&fidelite=milestone" : "";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    payment_intent_data: {
      application_fee_amount: fraisPlateforme,
      transfer_data: {destination: stripeAccountId}
    },
    success_url: "https://blazing-dinasty-1fad9.web.app?commande=succes" + slugParam + fideliteParam,
    cancel_url: "https://blazing-dinasty-1fad9.web.app?commande=annulee" + slugParam,
    metadata: {
      distributeurUid,
      clientNom: clientInfo?.nom || "",
      clientEmail: clientInfo?.email || "",
      clientTel: clientInfo?.tel || "",
      fraisPort: String(fraisPort),
      items: JSON.stringify(items.map(i => ({nom: i.nom, prix: i.prix, quantite: i.quantite || 1})))
    }
  });

  return {url: session.url};
});

const CALENDRIER_MIHI_CA = {
  2023: [
    {c:1, debut:"2023-01-07", fin:"2023-01-27"},
    {c:2, debut:"2023-01-28", fin:"2023-02-17"},
    {c:3, debut:"2023-02-18", fin:"2023-03-10"},
    {c:4, debut:"2023-03-11", fin:"2023-03-31"},
    {c:5, debut:"2023-04-01", fin:"2023-04-21"},
    {c:6, debut:"2023-04-22", fin:"2023-05-12"},
    {c:7, debut:"2023-05-13", fin:"2023-06-02"},
    {c:8, debut:"2023-06-03", fin:"2023-06-23"},
    {c:9, debut:"2023-06-24", fin:"2023-07-14"},
    {c:10,debut:"2023-07-15", fin:"2023-08-04"},
    {c:11,debut:"2023-08-05", fin:"2023-08-25"},
    {c:12,debut:"2023-08-26", fin:"2023-09-15"},
    {c:13,debut:"2023-09-16", fin:"2023-10-06"},
    {c:14,debut:"2023-10-07", fin:"2023-10-27"},
    {c:15,debut:"2023-10-28", fin:"2023-11-17"},
    {c:16,debut:"2023-11-18", fin:"2023-12-08"},
    {c:17,debut:"2023-12-09", fin:"2023-12-29"},
  ],
  2024: [
    {c:1, debut:"2024-01-18", fin:"2024-02-07"},
    {c:2, debut:"2024-02-08", fin:"2024-02-28"},
    {c:3, debut:"2024-02-29", fin:"2024-03-20"},
    {c:4, debut:"2024-03-21", fin:"2024-04-10"},
    {c:5, debut:"2024-04-11", fin:"2024-05-01"},
    {c:6, debut:"2024-05-02", fin:"2024-05-22"},
    {c:7, debut:"2024-05-23", fin:"2024-06-12"},
    {c:8, debut:"2024-06-13", fin:"2024-07-03"},
    {c:9, debut:"2024-07-04", fin:"2024-07-24"},
    {c:10,debut:"2024-07-25", fin:"2024-08-14"},
    {c:11,debut:"2024-08-15", fin:"2024-09-04"},
    {c:12,debut:"2024-09-05", fin:"2024-09-25"},
    {c:13,debut:"2024-09-26", fin:"2024-10-16"},
    {c:14,debut:"2024-10-17", fin:"2024-11-06"},
    {c:15,debut:"2024-11-07", fin:"2024-11-27"},
    {c:16,debut:"2024-11-28", fin:"2024-12-18"},
    {c:17,debut:"2024-12-19", fin:"2025-01-08"},
    {c:18,debut:"2023-12-28", fin:"2024-01-17"},
  ],
  2025: [
    {c:1, debut:"2025-01-09", fin:"2025-01-29"},
    {c:2, debut:"2025-01-30", fin:"2025-02-19"},
    {c:3, debut:"2025-02-20", fin:"2025-03-12"},
    {c:4, debut:"2025-03-13", fin:"2025-04-02"},
    {c:5, debut:"2025-04-03", fin:"2025-04-23"},
    {c:6, debut:"2025-04-24", fin:"2025-05-14"},
    {c:7, debut:"2025-05-15", fin:"2025-06-04"},
    {c:8, debut:"2025-06-05", fin:"2025-06-25"},
    {c:9, debut:"2025-06-26", fin:"2025-07-16"},
    {c:10,debut:"2025-07-17", fin:"2025-08-06"},
    {c:11,debut:"2025-08-07", fin:"2025-08-27"},
    {c:12,debut:"2025-08-28", fin:"2025-09-17"},
    {c:13,debut:"2025-09-18", fin:"2025-10-08"},
    {c:14,debut:"2025-10-09", fin:"2025-10-29"},
    {c:15,debut:"2025-10-30", fin:"2025-11-19"},
    {c:16,debut:"2025-11-20", fin:"2025-12-10"},
    {c:17,debut:"2025-12-11", fin:"2025-12-31"},
  ],
  2026: [
    {c:1, debut:"2026-01-01", fin:"2026-01-21"},
    {c:2, debut:"2026-01-22", fin:"2026-02-11"},
    {c:3, debut:"2026-02-12", fin:"2026-03-04"},
    {c:4, debut:"2026-03-05", fin:"2026-03-25"},
    {c:5, debut:"2026-03-26", fin:"2026-04-15"},
    {c:6, debut:"2026-04-16", fin:"2026-05-06"},
    {c:7, debut:"2026-05-07", fin:"2026-05-27"},
    {c:8, debut:"2026-05-28", fin:"2026-06-17"},
    {c:9, debut:"2026-06-18", fin:"2026-07-08"},
    {c:10,debut:"2026-07-09", fin:"2026-07-29"},
    {c:11,debut:"2026-07-30", fin:"2026-08-19"},
    {c:12,debut:"2026-08-20", fin:"2026-09-09"},
    {c:13,debut:"2026-09-10", fin:"2026-09-30"},
    {c:14,debut:"2026-10-01", fin:"2026-10-21"},
    {c:15,debut:"2026-10-22", fin:"2026-11-11"},
    {c:16,debut:"2026-11-12", fin:"2026-12-02"},
    {c:17,debut:"2026-12-03", fin:"2026-12-23"},
  ],
};

// Trouve la campagne Mihi officielle pour une date donnée
function getCampagneMihiPourDateCA(dateStr) {
  const d = new Date(dateStr + "T12:00:00").getTime();
  for (const [annee, campagnes] of Object.entries(CALENDRIER_MIHI_CA)) {
    for (const c of campagnes) {
      const deb = new Date(c.debut + "T00:00:00").getTime();
      const fin = new Date(c.fin + "T23:59:59").getTime();
      if (d >= deb && d <= fin) return {annee: parseInt(annee), num: c.c, debut: c.debut, fin: c.fin};
    }
  }
  return null;
}

function getPeriodeCAInfo() {
  const today = new Date();
  const dateStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  const camp = getCampagneMihiPourDateCA(dateStr);
  if (!camp) return null;
  const fin = new Date(camp.fin + "T23:59:59");
  const now = Date.now();
  const msLeft = fin.getTime() - now;
  const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
  const joursEcoules = Math.min(21, Math.max(1, 21 - daysLeft));
  return {periodNum: camp.num, joursEcoules};
}

// Ajoute le montant d'une commande boutique au Suivi CA (case du jour actuel de la periode en cours)
async function ajouterCommandeAuSuiviCA(userRef, userData, montant) {
  try {
    const infoP = getPeriodeCAInfo();
    if (!infoP) { console.log("[ajouterCommandeAuSuiviCA] Pas de campagne trouvee pour aujourd'hui, rien fait."); return; }
    console.log("[ajouterCommandeAuSuiviCA] periode:", infoP.periodNum, "jour:", infoP.joursEcoules, "montant:", montant);
    const pKey = "p" + infoP.periodNum;
    const suiviCA = userData["db-suivi-ca"] ? JSON.parse(userData["db-suivi-ca"]) : {};
    const cur = suiviCA[pKey] || {obj: 0, jours: {}};
    const jours = {...(cur.jours || {})};
    const idx = infoP.joursEcoules;
    const dejaAujourdhui = parseFloat(jours[idx]) || 0;
    const joursRemplis = Object.entries(jours).filter(([k, v]) => parseInt(k) < idx && parseFloat(v) > 0);
    let baseCumul = 0;
    if (joursRemplis.length > 0) {
      const dernierIdx = Math.max(...joursRemplis.map(([k]) => parseInt(k)));
      baseCumul = parseFloat(jours[dernierIdx]) || 0;
    }
    const nouveauCumul = (dejaAujourdhui > 0 ? dejaAujourdhui : baseCumul) + montant;
    jours[idx] = nouveauCumul;
    suiviCA[pKey] = {...cur, jours, ca: nouveauCumul};
    await userRef.set({"db-suivi-ca": JSON.stringify(suiviCA)}, {merge: true});
    console.log("[ajouterCommandeAuSuiviCA] Ecrit avec succes: jour", idx, "= ", nouveauCumul, "pour periode", pKey);
  } catch (e) {
    console.error("[ajouterCommandeAuSuiviCA] Erreur ajout suivi CA boutique:", e);
  }
}

// Enregistre une commande boutique (Stripe ou PayPal) sur la fiche cliente + fait avancer la fidelite
async function enregistrerCommandeClient(distributeurUid, items, clientInfo) {
  const total = items.reduce((s, i) => s + i.prix * (i.quantite || 1), 0);
  const userRef = db.collection("users").doc(distributeurUid);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() : {};
  const clientsExistants = userData["db-clients"] ? JSON.parse(userData["db-clients"]) : [];

  let nbTampons = 10;
  try {
    if (userData["db-fidelite-config"]) nbTampons = JSON.parse(userData["db-fidelite-config"]).nbTampons || 10;
  } catch (e) {}

  const emailNorm = (clientInfo.email || "").trim().toLowerCase();
  const telNorm = (clientInfo.tel || "").replace(/\s+/g, "");
  let clientExistantIdx = -1;
  if (emailNorm) clientExistantIdx = clientsExistants.findIndex(c => (c.email || "").trim().toLowerCase() === emailNorm);
  if (clientExistantIdx === -1 && telNorm) clientExistantIdx = clientsExistants.findIndex(c => (c.tel || "").replace(/\s+/g, "") === telNorm);

  const cmd = {
    id: Date.now(),
    date: new Date().toISOString().slice(0, 10),
    lignes: items.map(i => ({nom: i.nom, typeProduit: "autre", typeLabel: "Boutique en ligne", dureeJours: null, prix: i.prix, quantite: i.quantite || 1})),
    produits: items.map(i => i.nom + (i.quantite > 1 ? " x" + i.quantite : "")).join(", "),
    montant: total,
    suivi8: false,
    suivi21: false,
    source: "boutique-en-ligne"
  };

  let clientsMisAJour;
  let nomPourNotif;
  if (clientExistantIdx !== -1) {
    const existant = clientsExistants[clientExistantIdx];
    const nouveauxTampons = Math.min((existant.fideliteTampons || 0) + 1, nbTampons);
    const clientMaj = {...existant, commandes: [...(existant.commandes || []), cmd], fideliteTampons: nouveauxTampons};
    clientsMisAJour = clientsExistants.map((c, i) => i === clientExistantIdx ? clientMaj : c);
    nomPourNotif = existant.prenom || existant.nom || "Une cliente";
  } else {
    const partsNom = (clientInfo.nom || "Cliente boutique").trim().split(/\s+/);
    const nouveauClient = {
      id: "c" + Date.now(),
      prenom: partsNom[0] || "Cliente",
      nom: partsNom.slice(1).join(" ") || "",
      tel: clientInfo.tel || "",
      email: clientInfo.email || "",
      ddn: "", adresse: "", notes: "",
      source: "boutique-en-ligne",
      commandes: [cmd],
      fideliteTampons: Math.min(1, nbTampons)
    };
    clientsMisAJour = [nouveauClient, ...clientsExistants];
    nomPourNotif = nouveauClient.prenom;
  }

  await userRef.set({"db-clients": JSON.stringify(clientsMisAJour)}, {merge: true});
  await ajouterCommandeAuSuiviCA(userRef, userData, total);
  await sendNotifToUid(distributeurUid, "🛍️ Nouvelle commande !", nomPourNotif + " vient de commander pour " + total.toFixed(2) + " euros !");

  const emailNotif = userData["db-email-notif-commandes"];
  if (emailNotif) {
    try {
      const listeProduits = items.map(i => "• " + i.nom + (i.quantite > 1 ? " x" + i.quantite : "") + " — " + i.prix.toFixed(2) + " €").join("<br>");
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + resendApiKey.value(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "Blazing Dynasty <boutique@blazingdinasty.com>",
          to: [emailNotif],
          subject: "🛍️ Nouvelle commande — " + total.toFixed(2) + " €",
          html: `<div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:2rem 1rem;color:#3D1F0E;">
            <div style="font-size:1.3rem;font-weight:600;margin-bottom:1rem;">🛍️ Nouvelle commande !</div>
            <p style="font-size:.95rem;line-height:1.6;"><strong>${nomPourNotif}</strong> vient de commander pour <strong>${total.toFixed(2)} €</strong> :</p>
            <div style="background:#FFF3EC;border-radius:10px;padding:1rem;font-size:.85rem;line-height:1.8;margin:1rem 0;">${listeProduits}</div>
            <p style="font-size:.85rem;color:#888;">Connecte-toi à ton app pour voir les coordonnées complètes et préparer l'envoi.</p>
          </div>`
        })
      });
    } catch (e) {
      console.error("[enregistrerCommandeClient] Erreur envoi email notif commande:", e);
    }
  }

  const nbCommandesFinal = clientExistantIdx !== -1
    ? (clientsExistants[clientExistantIdx].commandes || []).length + 1
    : 1;
  if (nbCommandesFinal % 5 === 0) {
    await sendNotifToUid(distributeurUid, "🎁 Palier fidélité atteint !", nomPourNotif + " vient de passer sa " + nbCommandesFinal + "eme commande — pense a lui envoyer une recommandation personnalisee !");
  }
  return total;
}

exports.stripeWebhook = onRequest({secrets: [stripeSecretKey, resendApiKey]}, async (req, res) => {
  const stripe = require("stripe")(stripeSecretKey.value());
  let event;
  try {
    event = req.body;
  } catch (e) {
    console.error("[stripeWebhook] Erreur lecture body:", e);
    res.status(400).send("Webhook error");
    return;
  }

  console.log("[stripeWebhook] Evenement recu, type:", event && event.type);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const meta = session.metadata || {};
    const distributeurUid = meta.distributeurUid;
    console.log("[stripeWebhook] checkout.session.completed, distributeurUid:", distributeurUid, "metadata complete:", JSON.stringify(meta));
    if (distributeurUid) {
      try {
        const items = meta.items ? JSON.parse(meta.items) : [];
        await enregistrerCommandeClient(distributeurUid, items, {
          nom: meta.clientNom || "",
          email: meta.clientEmail || "",
          tel: meta.clientTel || ""
        });
        console.log("[stripeWebhook] enregistrerCommandeClient termine avec succes pour", distributeurUid);
      } catch (e) {
        console.error("[stripeWebhook] Erreur creation client depuis webhook Stripe:", e);
      }
    } else {
      console.log("[stripeWebhook] Pas de distributeurUid dans les metadata, rien fait.");
    }
  } else {
    console.log("[stripeWebhook] Type d'evenement ignore:", event && event.type);
  }

  res.status(200).send("ok");
});

// Donnees personnelles d'une cliente boutique connectee (lien magique) — ne renvoie que des champs surs
exports.obtenirDonneesClientBoutique = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Connexion requise");
  }
  const {distributeurUid} = request.data || {};
  if (!distributeurUid) {
    throw new HttpsError("invalid-argument", "distributeurUid manquant");
  }
  const email = (request.auth.token.email || "").trim().toLowerCase();
  if (!email) {
    throw new HttpsError("failed-precondition", "Email introuvable sur ce compte");
  }
  const userSnap = await db.collection("users").doc(distributeurUid).get();
  const clients = userSnap.exists && userSnap.data()["db-clients"] ? JSON.parse(userSnap.data()["db-clients"]) : [];
  const clientMatch = clients.find(c => (c.email || "").trim().toLowerCase() === email);
  if (!clientMatch) {
    return {trouve: false, commandes: [], fideliteTampons: 0};
  }
  return {
    trouve: true,
    prenom: clientMatch.prenom || "",
    commandes: (clientMatch.commandes || []).map(c => ({date: c.date, produits: c.produits, montant: c.montant})),
    fideliteTampons: clientMatch.fideliteTampons || 0
  };
});

// Verifie quels moyens de paiement sont actifs pour une distributrice — ne renvoie que 2 booleens, rien de sensible
exports.verifierMoyensPaiementBoutique = onCall(async (request) => {
  const {distributeurUid} = request.data || {};
  if (!distributeurUid) throw new HttpsError("invalid-argument", "distributeurUid manquant");
  const snap = await db.collection("users").doc(distributeurUid).get();
  const d = snap.exists ? snap.data() : {};
  return {stripePret: !!d["db-stripe-pret"], paypalPret: !!d["db-paypal-pret"]};
});

// --- PAYPAL (chaque distributrice utilise son propre compte PayPal Business classique) ---

async function obtenirTokenPaypal(clientId, clientSecret) {
  const auth = Buffer.from(clientId + ":" + clientSecret).toString("base64");
  const resp = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + auth,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error("Impossible de s'authentifier aupres de PayPal");
  return data.access_token;
}

exports.creerCommandePaypal = onCall(async (request) => {
  const {distributeurUid, items, clientInfo, slug} = request.data || {};
  if (!distributeurUid || !items || !items.length) {
    throw new HttpsError("invalid-argument", "Donnees manquantes");
  }
  const distribSnap = await db.collection("users").doc(distributeurUid).get();
  const distribData = distribSnap.exists ? distribSnap.data() : {};
  const clientId = distribData["db-paypal-client-id"];
  const clientSecret = distribData["db-paypal-client-secret"];
  if (!clientId || !clientSecret || !distribData["db-paypal-pret"]) {
    throw new HttpsError("failed-precondition", "Cette distributrice n'a pas encore active PayPal");
  }

  const totalCentimes = items.reduce((s, i) => s + Math.round(i.prix * 100) * (i.quantite || 1), 0);
  const FRAIS_PORT = 590;
  const SEUIL_GRATUIT = 6000;
  const linkbioSnap = await db.collection("linkbio").doc(distributeurUid).get();
  const livraisonGratuiteActivee = linkbioSnap.exists ? !!linkbioSnap.data().livraisonGratuite : false;
  const fraisPort = (livraisonGratuiteActivee && totalCentimes >= SEUIL_GRATUIT) ? 0 : FRAIS_PORT;
  const totalFinal = ((totalCentimes + fraisPort) / 100).toFixed(2);

  const slugParam = slug ? "&boutique=" + encodeURIComponent(slug) : "";

  try {
    const token = await obtenirTokenPaypal(clientId, clientSecret);
    const orderResp = await fetch("https://api-m.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {"Authorization": "Bearer " + token, "Content-Type": "application/json"},
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{amount: {currency_code: "EUR", value: totalFinal}}],
        application_context: {
          return_url: "https://blazing-dinasty-1fad9.web.app?paypal=retour" + slugParam,
          cancel_url: "https://blazing-dinasty-1fad9.web.app?commande=annulee" + slugParam,
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW"
        }
      })
    });
    const order = await orderResp.json();
    if (!order.id) throw new Error("Creation de la commande PayPal impossible");

    await db.collection("paypal_commandes_attente").doc(order.id).set({
      distributeurUid, items, clientInfo: clientInfo || {}, fraisPort, createdAt: new Date().toISOString()
    });

    const approveLink = (order.links || []).find(l => l.rel === "approve");
    return {url: approveLink ? approveLink.href : null};
  } catch (e) {
    throw new HttpsError("internal", "Erreur PayPal : " + e.message);
  }
});

exports.capturerCommandePaypal = onCall({secrets: [resendApiKey]}, async (request) => {
  const {orderId} = request.data || {};
  if (!orderId) throw new HttpsError("invalid-argument", "orderId manquant");

  const attenteSnap = await db.collection("paypal_commandes_attente").doc(orderId).get();
  if (!attenteSnap.exists) throw new HttpsError("not-found", "Commande introuvable ou deja traitee");
  const {distributeurUid, items, clientInfo} = attenteSnap.data();

  const distribSnap = await db.collection("users").doc(distributeurUid).get();
  const distribData = distribSnap.exists ? distribSnap.data() : {};
  const clientId = distribData["db-paypal-client-id"];
  const clientSecret = distribData["db-paypal-client-secret"];
  if (!clientId || !clientSecret) throw new HttpsError("failed-precondition", "Configuration PayPal manquante");

  try {
    const token = await obtenirTokenPaypal(clientId, clientSecret);
    const captureResp = await fetch("https://api-m.paypal.com/v2/checkout/orders/" + orderId + "/capture", {
      method: "POST",
      headers: {"Authorization": "Bearer " + token, "Content-Type": "application/json"}
    });
    const capture = await captureResp.json();
    const statut = capture.status || (capture.purchase_units?.[0]?.payments?.captures?.[0]?.status);
    if (statut !== "COMPLETED") {
      throw new Error("Paiement non finalise (statut : " + statut + ")");
    }

    await enregistrerCommandeClient(distributeurUid, items, clientInfo || {});
    await attenteSnap.ref.delete();

    return {succes: true};
  } catch (e) {
    throw new HttpsError("internal", "Erreur validation PayPal : " + e.message);
  }
});

// --- CONNEXION CLIENTE BOUTIQUE : lien magique envoye via Resend (meilleure delivrabilite que Firebase par defaut) ---
// Enregistre une commande avant redirection vers un lien de paiement personnel (PayPal.me / Stripe perso de la distributrice)
exports.enregistrerCommandeLienPerso = onCall({secrets: [resendApiKey]}, async (request) => {
  const {distributeurUid, items, clientInfo, methode} = request.data || {};
  if (!distributeurUid || !items || !items.length) {
    throw new HttpsError("invalid-argument", "Donnees manquantes");
  }
  try {
    await enregistrerCommandeClient(distributeurUid, items, {
      nom: (clientInfo && clientInfo.nom) || "",
      email: (clientInfo && clientInfo.email) || "",
      tel: (clientInfo && clientInfo.tel) || "",
      notePaiement: "Paiement via " + (methode === "stripe" ? "lien Stripe personnel" : "PayPal.me") + " - a verifier manuellement"
    });
    return {ok: true};
  } catch (e) {
    console.error("[enregistrerCommandeLienPerso] Erreur:", e);
    throw new HttpsError("internal", "Erreur lors de l'enregistrement : " + e.message);
  }
});

exports.envoyerLienConnexionClient = onCall({secrets: [resendApiKey]}, async (request) => {
  const {email, redirectUrl} = request.data || {};
  if (!email || !redirectUrl) {
    throw new HttpsError("invalid-argument", "email et redirectUrl requis");
  }
  const emailNorm = email.trim().toLowerCase();

  const actionCodeSettings = {url: redirectUrl, handleCodeInApp: true};
  let lien;
  try {
    lien = await admin.auth().generateSignInWithEmailLink(emailNorm, actionCodeSettings);
  } catch (e) {
    throw new HttpsError("internal", "Erreur generation du lien : " + e.message);
  }

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + resendApiKey.value(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Blazing Dynasty <boutique@blazingdinasty.com>",
        to: [emailNorm],
        subject: "Ton lien de connexion — Blazing Dynasty",
        html: `<div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:2rem 1rem;color:#3D1F0E;">
          <div style="font-size:1.3rem;font-weight:600;margin-bottom:1rem;">Blazing <em style="color:#C49A8A;">Dynasty</em></div>
          <p style="font-size:.95rem;line-height:1.6;">Bonjour,</p>
          <p style="font-size:.95rem;line-height:1.6;">Clique sur le bouton ci-dessous pour te connecter à ton compte et retrouver tes commandes, ta fidélité et tes favoris.</p>
          <a href="${lien}" style="display:inline-block;background:#3D1F0E;color:white;text-decoration:none;padding:.85rem 1.5rem;border-radius:10px;font-weight:700;font-size:.9rem;margin:1rem 0;">Me connecter</a>
          <p style="font-size:.75rem;color:#888;margin-top:1.5rem;">Si tu n'as pas demandé ce lien, tu peux ignorer cet email sans danger.</p>
        </div>`
      })
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.message || "Erreur envoi Resend");
    }
    return {succes: true};
  } catch (e) {
    throw new HttpsError("internal", "Erreur envoi email : " + e.message);
  }
});


// ── META TAGS DYNAMIQUES ──────────────────────────────────────────────────────
// Genere des previews de liens personnalises pour WhatsApp/Facebook/Instagram
exports.metaTags = onRequest(async (req, res) => {
  const url = req.query.url || '';
  const params = new URLSearchParams(url.split('?')[1] || '');

  let titre = 'Blazing Dynasty × Mihi France';
  let description = 'Decouvre une opportunite beaute unique en France.';
  const diagType = params.get('diag') || '';
  let image = 'https://blazing-dinasty-1fad9.web.app/meta-linkbio.png';
  if (diagType === 'parfum') image = 'https://blazing-dinasty-1fad9.web.app/meta-parfum.png';
  else if (diagType === 'skincare' || diagType === 'peauvisage') image = 'https://blazing-dinasty-1fad9.web.app/meta-skincare.png';
  else if (diagType === 'silhouette' || diagType === 'peaucorps') image = 'https://blazing-dinasty-1fad9.web.app/meta-silhouette.png';
  else if (diagType === 'sante') image = 'https://blazing-dinasty-1fad9.web.app/meta-sante.png';
  else if (params.get('recrutement')) image = 'https://blazing-dinasty-1fad9.web.app/meta-recrutement.png';

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
      titre = "Decouvre l univers de " + nom + " 🌿";
      description = nom + " partage ses produits beaute preferes et son parcours Mihi. Clique pour en savoir plus !";
    } else if (recrutSlug) {
      titre = `Rejoins l’equipe de ${nom} ! 🔥`;
      description = `Decouvre comment creer ta boutique en ligne gratuite et developper ton business beaute depuis chez toi.`;
    } else if (boutiqueSlug) {
      titre = `La boutique de ${nom} — Mihi France 🛍️`;
      description = `Decouvre des produits cosmetiques de qualite pharmaceutique. Boutique personnalisee par ${nom}.`;
    } else if (diagUid) {
      titre = `Diagnostic beaute offert par ${nom} ✨`;
      description = `Reponds a quelques questions et recois tes recommandations de produits personnalisees. Gratuit !`;
    }
  } catch (e) {
    console.error('MetaTags error:', e);
  }

  const lienOriginal = 'https://blazing-dinasty-1fad9.web.app' + (url.startsWith('/') ? url : '?' + url.split('?')[1]);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta property="og:title" content="${titre}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${image}">
  <meta property="og:url" content="${lienOriginal}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${titre}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${image}">
  <meta http-equiv="refresh" content="0;url=${lienOriginal}">
  <title>${titre}</title>
</head>
<body>
  <script>window.location.href = "${lienOriginal}";</script>
</body>
</html>`;

  res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
  res.send(html);
});
