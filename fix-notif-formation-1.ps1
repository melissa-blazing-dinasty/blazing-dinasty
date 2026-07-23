$path = "C:\Users\melou\blazing-dynasty\src\FormationProduitsTab.js"
$content = [System.IO.File]::ReadAllText($path)
Write-Host "Longueur AVANT modification : $($content.Length) caracteres"

$old = 'setDoc(doc(db,"admin","formation_produits"),{produits:nextProduits})'
$new = 'setDoc(doc(db,"admin","formation_produits"),{produits:nextProduits,derniereMaj:Date.now()})'

if (-not $content.Contains($old)) {
  Write-Host "ERREUR : ancre introuvable. Arret sans modification." -ForegroundColor Red
  exit 1
}

$content = $content.Replace($old, $new)
Write-Host "Remplacement applique."

Write-Host "Longueur APRES modification : $($content.Length) caracteres"
[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Host "Fichier sauvegarde avec succes." -ForegroundColor Green