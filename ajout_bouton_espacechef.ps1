$path = "C:\Users\melou\blazing-dynasty\src\EspaceChefTab.js"
$content = [System.IO.File]::ReadAllText($path)

# 1. Ajout de l'import
$importMarker = "import { DistributeursTab } from './ClientsTab';"
$importCount = ([regex]::Matches($content, [regex]::Escape($importMarker))).Count
if ($importCount -ne 1) { Write-Host "ERREUR: import marker trouve $importCount fois. Abandon."; exit }
$content = $content.Replace($importMarker, $importMarker + "`nimport { DecouverteTour } from './App';")

# 2. Ajout de l'etat showDecouverte
$stateMarker = "  const[nbMsgsNonLus,setNbMsgsNonLus]=useState(0);"
$stateCount = ([regex]::Matches($content, [regex]::Escape($stateMarker))).Count
if ($stateCount -ne 1) { Write-Host "ERREUR: state marker trouve $stateCount fois. Abandon."; exit }
$content = $content.Replace($stateMarker, $stateMarker + "`n  const[showDecouverte,setShowDecouverte]=useState(false);")

# 3. Ajout du bouton + composant DecouverteTour, juste avant le titre "Espace Chef"
$titleMarker = @'
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Espace <em style={{fontStyle:"italic",color:C.rose}}>Chef</em>
      </div>
'@
$titleCount = ([regex]::Matches($content, [regex]::Escape($titleMarker))).Count
if ($titleCount -ne 1) { Write-Host "ERREUR: title marker trouve $titleCount fois. Abandon."; exit }

$newTitleBlock = @'
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:".5rem"}}><button onClick={()=>setShowDecouverte(true)} style={{background:"#C49A8A",color:"white",border:"none",borderRadius:20,padding:".35rem 1rem",fontSize:".75rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(196,154,138,.4)"}}>🧭 Découverte</button></div>
      {showDecouverte&&<DecouverteTour outil="espacechef" onClose={()=>setShowDecouverte(false)}/>}
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Espace <em style={{fontStyle:"italic",color:C.rose}}>Chef</em>
      </div>
'@

$content = $content.Replace($titleMarker, $newTitleBlock)

[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Host "Bouton et import ajoutes avec succes dans EspaceChefTab.js."