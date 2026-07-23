$path = "C:\Users\melou\blazing-dynasty\functions\index.js"
$content = [System.IO.File]::ReadAllText($path)
Write-Host "Longueur AVANT modification : $($content.Length) caracteres"

$marker = "notifPowerHourFin error"
$idx = $content.IndexOf($marker)
Write-Host "Marqueur trouve a l'index : $idx"

if ($idx -lt 0) {
  Write-Host "ERREUR : marqueur introuvable. Arret sans modification." -ForegroundColor Red
  exit 1
}

$closeIdx = $content.IndexOf("});", $idx)
Write-Host "Fermeture trouvee a l'index : $closeIdx"

if ($closeIdx -lt 0) {
  Write-Host "ERREUR : fermeture de fonction introuvable. Arret sans modification." -ForegroundColor Red
  exit 1
}

$insertPoint = $closeIdx + 3

$nouvelleFonction = @'


exports.notifAnnonceEquipe = onDocumentWritten("equipe/derniere-annonce", async (event) => {
  try {
    const before = event.data.before.exists ? event.data.before.data() : {};
    const after = event.data.after.exists ? event.data.after.data() : {};
    if (after.id && after.id !== before.id) {
      const titre = (after.icone || "info") + " " + (after.titre || "Annonce de l equipe");
      await sendNotifToAll(titre, after.message || "");
    }
  } catch(e) { console.error("notifAnnonceEquipe error", e); }
});
'@

$avant = $content.Substring(0, $insertPoint)
$apres = $content.Substring($insertPoint)
$content = $avant + $nouvelleFonction + $apres

Write-Host "Longueur APRES modification : $($content.Length) caracteres"
[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Host "Fichier sauvegarde avec succes." -ForegroundColor Green