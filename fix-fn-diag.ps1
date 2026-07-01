$path = "C:\Users\melou\blazing-dynasty\functions\index.js"
$content = [System.IO.File]::ReadAllText($path)

$marker = "exports.definirMotDePasse = onCall(async (request) => {"
$c = ([regex]::Matches($content,[regex]::Escape($marker))).Count
if($c -ne 1){ Write-Host "ERREUR: $c trouve - ARRET"; exit }

$newFn = @'
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

'@

$content = $content.Replace($marker, $newFn + $marker)
[System.IO.File]::WriteAllText($path,$content,[System.Text.Encoding]::UTF8)
Write-Host "SUCCES FONCTION DIAGNOSTIC AJOUTEE"