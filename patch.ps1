$content = [System.IO.File]::ReadAllText("C:\Users\melou\blazing-dynasty\src\DashboardTab.js", [System.Text.Encoding]::UTF8)
$old = '      if(prospectInteretFiltre==="none")return !p.interet;
      return p.interet===prospectInteretFiltre;'
$new = '      if(prospectInteretFiltre==="recommandation")return p.source==="recommandation"||p.interet==="Recommandation";
      if(prospectInteretFiltre==="none")return !p.interet;
      return p.interet===prospectInteretFiltre;'
$content = $content.Replace($old, $new)
[System.IO.File]::WriteAllText("C:\Users\melou\blazing-dynasty\src\DashboardTab.js", $content, [System.Text.Encoding]::UTF8)
Write-Host "Done"
