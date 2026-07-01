$path = "C:\Users\melou\blazing-dynasty\src\EspaceChefTab.js"
$content = [System.IO.File]::ReadAllText($path)

$marker = '        <div key={s.id} onClick={()=>{if(s.id==="distributeurs")loadDistrib();setSection(s.id);}}'
$count = ([regex]::Matches($content, [regex]::Escape($marker))).Count
if ($count -ne 1) { Write-Host "ERREUR: marker trouve $count fois (attendu 1). Abandon."; exit }

$newLine = '        <div key={s.id} id={"decouverte-chef-"+s.id} onClick={()=>{if(s.id==="distributeurs")loadDistrib();setSection(s.id);}}'

$content = $content.Replace($marker, $newLine)
[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Host "Cibles ajoutees avec succes dans EspaceChefTab.js."