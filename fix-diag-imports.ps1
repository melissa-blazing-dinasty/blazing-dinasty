$path = "C:\Users\melou\blazing-dynasty\src\DiagnosticsTab.js"
$content = [System.IO.File]::ReadAllText($path)

$old1 = "import { SCRIPTS_DATA, DecouverteTour } from './App';"
$c1 = ([regex]::Matches($content,[regex]::Escape($old1))).Count
if($c1 -ne 1){ Write-Host "ERREUR old1: $c1 - ARRET"; exit }
$new1 = $old1 + "`r`n" + "import { fbFunctions } from './App';" + "`r`n" + "import { httpsCallable } from 'firebase/functions';"
$content = $content.Replace($old1,$new1)

[System.IO.File]::WriteAllText($path,$content,[System.Text.Encoding]::UTF8)
Write-Host "SUCCES IMPORTS AJOUTES"