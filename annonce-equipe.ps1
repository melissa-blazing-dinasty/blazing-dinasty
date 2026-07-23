$path = "C:\Users\melou\blazing-dynasty\src\App.js"
$content = [System.IO.File]::ReadAllText($path)
Write-Host "Longueur AVANT modification : $($content.Length) caracteres"

$startMarker = "{/* Boutons messagerie */}"
$endMarker = "<BoutonMiseAJour"

$startIdx = $content.IndexOf($startMarker)
$endIdx = $content.IndexOf($endMarker, $startIdx)

Write-Host "startIdx : $startIdx"
Write-Host "endIdx : $endIdx"

if ($startIdx -lt 0 -or $endIdx -lt 0 -or $endIdx -le $startIdx) {
  Write-Host "ERREUR : marqueurs toujours introuvables dans le bon ordre. Arret sans modification." -ForegroundColor Red
  exit 1
}

$blocOriginal = $content.Substring($startIdx, $endIdx - $startIdx)
Write-Host "--- Bloc trouve (verifie que ca se termine juste avant BoutonMiseAJour) ---"
Write-Host $blocOriginal
Write-Host "--- fin du bloc ---"

$boutonAjout = @'
{isMelissaChef&&(
        <div style={{marginBottom:"1rem"}}>
          <button onClick={()=>setShowAnnonceAdmin(true)}
            style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:".4rem",background:"#B8442F",color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".76rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
            Annonce officielle a toute l equipe
          </button>
        </div>
      )}

      
'@

$blocNouveau = $blocOriginal + $boutonAjout
$content = $content.Replace($blocOriginal, $blocNouveau)

Write-Host "Longueur APRES modification : $($content.Length) caracteres"
[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Host "Fichier sauvegarde avec succes." -ForegroundColor Green