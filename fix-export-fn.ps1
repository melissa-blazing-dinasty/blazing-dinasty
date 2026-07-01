$path = "C:\Users\melou\blazing-dynasty\src\App.js"
$content = [System.IO.File]::ReadAllText($path)

$old = "const fbFunctions = getFunctions(fbApp,'us-central1');"
$c = ([regex]::Matches($content,[regex]::Escape($old))).Count
if($c -ne 1){ Write-Host "ERREUR: $c trouve - ARRET"; exit }

$new = "export const fbFunctions = getFunctions(fbApp,'us-central1');"
$content = $content.Replace($old,$new)

[System.IO.File]::WriteAllText($path,$content,[System.Text.Encoding]::UTF8)
Write-Host "SUCCES EXPORT FBFUNCTIONS"