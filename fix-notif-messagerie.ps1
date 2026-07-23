$path = "C:\Users\melou\blazing-dynasty\functions\index.js"
$content = [System.IO.File]::ReadAllText($path)
Write-Host "Longueur AVANT modification : $($content.Length) caracteres"

$startMarker = "exports.notifAnnonceEquipe"
$endMarker = "const stripeSecretKey = defineSecret"
$startIdx = $content.IndexOf($startMarker)
$endIdx = $content.IndexOf($endMarker)

if ($startIdx -lt 0 -or $endIdx -lt 0 -or $endIdx -le $startIdx) {
  Write-Host "ERREUR : marqueurs introuvables. Arret sans modification." -ForegroundColor Red
  exit 1
}

$nouveauBloc = @'
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

exports.notifMessageEquipe = onDocumentWritten("messages/{destUid}", async (event) => {
  try {
    const destUid = event.params.destUid;
    const before = event.data.before.exists ? event.data.before.data() : {};
    const after = event.data.after.exists ? event.data.after.data() : {};
    const msgsBefore = before.msgs || [];
    const msgsAfter = after.msgs || [];
    if (!msgsAfter.length) return;
    const dernier = msgsAfter[0];
    const dernierAvant = msgsBefore[0];
    if (dernierAvant && dernierAvant.id === dernier.id) return;
    const apercu = dernier.texte ? dernier.texte.slice(0, 60) : "";
    const titre = "\u{1F4AC} " + (dernier.deNom || "Message de l equipe");
    await sendNotifToUid(destUid, titre, apercu);
  } catch(e) { console.error("notifMessageEquipe error", e); }
});

'@

$blocOriginal = $content.Substring($startIdx, $endIdx - $startIdx)
$content = $content.Replace($blocOriginal, $nouveauBloc)
Write-Host "Remplacement applique."

Write-Host "Longueur APRES modification : $($content.Length) caracteres"
[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Host "Fichier sauvegarde avec succes." -ForegroundColor Green