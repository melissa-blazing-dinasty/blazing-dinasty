$path = "C:\Users\melou\blazing-dynasty\src\DiagnosticsTab.js"
$content = [System.IO.File]::ReadAllText($path)

$oldSpan1 = "<span style={{fontSize:`"1.2rem`"}}>`r`n" + [char]::ConvertFromUtf32(0x1F6CD) + "`r`n" + [char]0xFE0F + "`r`n" + "</span>"
$c1 = ([regex]::Matches($content,[regex]::Escape($oldSpan1))).Count
Write-Host "Recherche 1: $c1 trouve"

$oldSpan2 = "<span style={{fontSize:`"1.2rem`"}}>`r`n" + [char]::ConvertFromUtf32(0x1F451) + "`r`n" + "</span>"
$c2 = ([regex]::Matches($content,[regex]::Escape($oldSpan2))).Count
Write-Host "Recherche 2: $c2 trouve"

if($c1 -eq 1 -and $c2 -eq 1){
    $content = $content.Replace($oldSpan1, '<span style={{fontSize:"1.2rem"}}>*</span>')
    $content = $content.Replace($oldSpan2, '<span style={{fontSize:"1.2rem"}}>*</span>')
    [System.IO.File]::WriteAllText($path,$content,[System.Text.Encoding]::UTF8)
    Write-Host "SUCCES EMOJIS CORRIGES"
} else {
    Write-Host "ARRET - motifs non trouves exactement"
}