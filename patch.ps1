$lines = [System.IO.File]::ReadAllLines("C:\Users\melou\blazing-dynasty\src\DiagnosticsTab.js", [System.Text.Encoding]::UTF8)
$lines[1385] = "      setReponsesFinales(newRep); setMode(""contact"");"
[System.IO.File]::WriteAllLines("C:\Users\melou\blazing-dynasty\src\DiagnosticsTab.js", $lines, [System.Text.Encoding]::UTF8)
Write-Host "Done"
