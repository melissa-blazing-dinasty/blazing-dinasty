$path = "C:\Users\melou\blazing-dynasty\src\DiagnosticsTab.js"
$lines = [System.IO.File]::ReadAllLines($path)

$checkStart = $lines[1630].Trim()
$checkEnd = $lines[1651].Trim()

if($checkStart -notmatch "diag_externes"){
    Write-Host "ERREUR debut: $checkStart"
} elseif($checkEnd -ne 'setMode("attente");'){
    Write-Host "ERREUR fin: $checkEnd"
} else {
    $before = $lines[0..1629]
    $after = $lines[1652..($lines.Length-1)]
    $newBlock = @(
        '        const soumettreDiagnosticFn = httpsCallable(fbFunctions, "soumettreDiagnostic");',
        '        await soumettreDiagnosticFn({uid, type, nomClient:nomFinal, contact, reponses:repSansContact});',
        '        setMode("attente");'
    )
    $result = $before + $newBlock + $after
    [System.IO.File]::WriteAllLines($path, $result, [System.Text.Encoding]::UTF8)
    Write-Host "SUCCES DIAGNOSTIC VIA FONCTION"
}