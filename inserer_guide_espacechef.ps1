$path = "C:\Users\melou\blazing-dynasty\src\App.js"
$content = [System.IO.File]::ReadAllText($path)

$txtPath = "C:\Users\melou\blazing-dynasty\guide_espacechef.txt"
$newEntry = [System.IO.File]::ReadAllText($txtPath)
$newEntry = $newEntry.TrimEnd("`r","`n")

$marker = "  objectifs: ["
$count = ([regex]::Matches($content, [regex]::Escape($marker))).Count
if ($count -ne 1) { Write-Host "ERREUR: marker trouve $count fois (attendu 1). Abandon."; exit }

$content = $content.Replace($marker, $newEntry)
[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Host "Guide espacechef ajoute avec succes dans App.js."