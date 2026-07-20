$path = "C:\Users\melou\blazing-dynasty\src\DiagnosticsTab.js"
$content = [System.IO.File]::ReadAllText($path)

$oldSpan1 = "<span style={{fontSize:`"1.2rem`"}}>`r`n" + [char]::ConvertFromUtf32(0x1F6CD) + "`r`n" + [char]0xFE0F + "`r`n" + "</span>"
$c1 = ([regex]::Matches($content,[regex]::Escape($oldSpan1))).Count

$oldSpan2 = "<span style={{fontSize:`"1.2rem`"}}>`r`n" + [char]::ConvertFromUtf32(0x1F451) + "`r`n" + "</span>"
$c2 = ([regex]::Matches($content,[regex]::Escape($oldSpan2))).Count

if($c1 -eq 2 -and $c2 -eq 2){
    $content = $content.Replace($oldSpan1, '<span style={{fontSize:"1.2rem"}}>*</span>')
    $content = $content.Replace($oldSpan2, '<span style={{fontSize:"1.2rem"}}>*</span>')
    [System.IO.File]::WriteAllText($path,$content,[System.Text.Encoding]::UTF8)
    Write-Host "SUCCES EMOJIS CORRIGES"
} else {
    Write-Host "ARRET - c1=$c1 c2=$c2"
}