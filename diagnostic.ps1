$path = "C:\Users\melou\blazing-dynasty\src\App.js"
$content = [System.IO.File]::ReadAllText($path)

$old1 = @'
    checkPowerHour();
    const t=setInterval(checkPowerHour,15000);
    return()=>clearInterval(t);
  },[userId,screen]);
'@

$old2 = @'
      {showPowerHourStart&&powerHourInfo&&(
        <PowerHourStartPopup session={powerHourInfo} onClose={()=>setShowPowerHourStart(false)}/>
      )}
      {showPowerHourEnd&&powerHourInfo&&(
        <PowerHourEndPopup session={powerHourInfo} onClose={()=>setShowPowerHourEnd(false)}/>
      )}
'@

$old3 = @'
function NouveauChallengePopup({challenge, onClose}){
'@

$old4 = @'
  const[showMsg,setShowMsg]=useState(false);
'@

$old5 = @'
      {showMsg&&<MessageEquipePopup uid={uid} userName={userName} annuaire={annuaire} onClose={()=>setShowMsg(false)}/>}
'@

$old6 = @'
      {/* Boutons messagerie */}
      <div style={{display:"flex",gap:".5rem",marginBottom:"1rem"}}>
        <button onClick={()=>setShowMsg(true)}
          style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:".4rem",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".76rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          💬 Envoyer un message
        </button>
        <button onClick={()=>setShowMsgsRecus(true)}
          style={{position:"relative",background:nbMsgsNonLus>0?C.rose+"15":C.creme,border:`1px solid ${nbMsgsNonLus>0?C.rose:C.pale}`,borderRadius:10,padding:".6rem .9rem",fontSize:".76rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",color:nbMsgsNonLus>0?C.rose:C.gris}}>
          📭 Reçus
          {nbMsgsNonLus>0&&(
            <span style={{position:"absolute",top:-6,right:-6,background:C.rose,color:"white",borderRadius:"50%",minWidth:18,height:18,fontSize:".6rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>
              {nbMsgsNonLus}
            </span>
          )}
        </button>
      </div>
'@

Write-Host "old1 trouve : $($content.Contains($old1))"
Write-Host "old2 trouve : $($content.Contains($old2))"
Write-Host "old3 trouve : $($content.Contains($old3))"
Write-Host "old4 trouve : $($content.Contains($old4))"
Write-Host "old5 trouve : $($content.Contains($old5))"
Write-Host "old6 trouve : $($content.Contains($old6))"

Write-Host ""
Write-Host "--- Contenu reel autour de 'Boutons messagerie' ---"
$idx = $content.IndexOf("Boutons messagerie")
if ($idx -ge 0) {
  $extrait = $content.Substring($idx, 900)
  Write-Host $extrait
} else {
  Write-Host "Texte 'Boutons messagerie' introuvable du tout dans le fichier !"
}