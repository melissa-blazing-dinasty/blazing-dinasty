$path = "C:\Users\melou\blazing-dynasty\functions\index.js"
$content = [System.IO.File]::ReadAllText($path)
Write-Host "Longueur AVANT modification : $($content.Length) caracteres"

$startMarker = "exports.notifPowerHourDebut"
$endMarker = "const stripeSecretKey = defineSecret"
$startIdx = $content.IndexOf($startMarker)
$endIdx = $content.IndexOf($endMarker)

if ($startIdx -lt 0 -or $endIdx -lt 0 -or $endIdx -le $startIdx) {
  Write-Host "ERREUR : marqueurs introuvables. Arret sans modification." -ForegroundColor Red
  exit 1
}

$nouveauBloc = @'
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

'@

$blocOriginal = $content.Substring($startIdx, $endIdx - $startIdx)
$content = $content.Replace($blocOriginal, $nouveauBloc)
Write-Host "Remplacement applique."

Write-Host "Longueur APRES modification : $($content.Length) caracteres"
[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Host "Fichier sauvegarde avec succes." -ForegroundColor Green