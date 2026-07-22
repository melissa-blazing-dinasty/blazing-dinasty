$path = "C:\Users\melou\blazing-dynasty\src\App.js"

$content = [System.IO.File]::ReadAllText($path)
Write-Host "Longueur AVANT modification : $($content.Length) caracteres"

# ── Remplacement 1 : ajout des states + polling ──
$old1 = @'
  const[showObjectifs,setShowObjectifs]=useState(false);
'@

$new1 = @'
  const[showObjectifs,setShowObjectifs]=useState(false);

  // ── POWER HOUR — popups démarrage/fin ──
  const[showPowerHourStart,setShowPowerHourStart]=useState(false);
  const[showPowerHourEnd,setShowPowerHourEnd]=useState(false);
  const[powerHourInfo,setPowerHourInfo]=useState(null);
  useEffect(()=>{
    if(!userId||screen!=="app")return;
    const DUREE_PH=20*60000;
    const checkPowerHour=async()=>{
      try{
        const snap=await getDoc(doc(db,"equipe","power-hour"));
        if(!snap.exists())return;
        const d=snap.data();
        if(!d.startedAt)return;
        const elapsed=Date.now()-d.startedAt;
        let seenStart=null,seenEnd=null;
        try{seenStart=localStorage.getItem("bd-ph-start-seen");}catch{}
        try{seenEnd=localStorage.getItem("bd-ph-end-seen");}catch{}
        if(elapsed>=0&&elapsed<2*60000&&String(d.startedAt)!==seenStart){
          setPowerHourInfo(d);setShowPowerHourStart(true);
          try{localStorage.setItem("bd-ph-start-seen",String(d.startedAt));}catch{}
        }
        if(elapsed>=DUREE_PH&&elapsed<DUREE_PH+2*60000&&String(d.startedAt)!==seenEnd){
          setPowerHourInfo(d);setShowPowerHourEnd(true);
          try{localStorage.setItem("bd-ph-end-seen",String(d.startedAt));}catch{}
        }
      }catch{}
    };
    checkPowerHour();
    const t=setInterval(checkPowerHour,15000);
    return()=>clearInterval(t);
  },[userId,screen]);
'@

# ── Remplacement 2 : affichage des popups dans le rendu ──
$old2 = @'
      {showNewChallenge&&newChallengeData&&(
        <NouveauChallengePopup challenge={newChallengeData} onClose={async()=>{
          setShowNewChallenge(false);
          try{
            const uRef=doc(db,"users",userId);
            const uSnap=await getDoc(uRef);
            const vusActuels=uSnap.exists()?(uSnap.data()["db-challenges-vus"]||[]):[];
            await setDoc(uRef,{"db-challenges-vus":[...vusActuels,newChallengeData.id]},{merge:true});
          }catch{}
        }}/>
      )}
'@

$new2 = @'
      {showNewChallenge&&newChallengeData&&(
        <NouveauChallengePopup challenge={newChallengeData} onClose={async()=>{
          setShowNewChallenge(false);
          try{
            const uRef=doc(db,"users",userId);
            const uSnap=await getDoc(uRef);
            const vusActuels=uSnap.exists()?(uSnap.data()["db-challenges-vus"]||[]):[];
            await setDoc(uRef,{"db-challenges-vus":[...vusActuels,newChallengeData.id]},{merge:true});
          }catch{}
        }}/>
      )}
      {showPowerHourStart&&powerHourInfo&&(
        <PowerHourStartPopup session={powerHourInfo} onClose={()=>setShowPowerHourStart(false)}/>
      )}
      {showPowerHourEnd&&powerHourInfo&&(
        <PowerHourEndPopup session={powerHourInfo} onClose={()=>setShowPowerHourEnd(false)}/>
      )}
'@

# ── Remplacement 3 : nouveaux composants popup ──
$old3 = @'
function NouveauChallengePopup({challenge, onClose}){
'@

$new3 = @'
function PowerHourStartPopup({session, onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,31,14,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:"1rem"}}>
      <div style={{background:C.blanc,borderRadius:20,width:"100%",maxWidth:420,overflow:"hidden",boxShadow:"0 8px 40px rgba(0,0,0,.3)"}}>
        <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,padding:"1.5rem 1.2rem",textAlign:"center"}}>
          <div style={{fontSize:"2.4rem",marginBottom:".4rem"}}>⚡</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.3rem",fontWeight:300,color:C.blanc}}>Power Hour lancée !</div>
          <div style={{fontSize:".8rem",color:C.pale,marginTop:".3rem"}}>par {session.startedBy} · 20 minutes de focus intense</div>
        </div>
        <div style={{padding:"1.2rem"}}>
          <button onClick={onClose}
            style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:12,padding:".9rem",fontSize:".88rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
            Je participe 🚀
          </button>
        </div>
      </div>
    </div>
  );
}
function PowerHourEndPopup({session, onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,31,14,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:"1rem"}}>
      <div style={{background:C.blanc,borderRadius:20,width:"100%",maxWidth:420,overflow:"hidden",boxShadow:"0 8px 40px rgba(0,0,0,.3)"}}>
        <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,padding:"1.5rem 1.2rem",textAlign:"center"}}>
          <div style={{fontSize:"2.4rem",marginBottom:".4rem"}}>✅</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.3rem",fontWeight:300,color:C.blanc}}>Power Hour terminée !</div>
          <div style={{fontSize:".8rem",color:C.pale,marginTop:".3rem"}}>Bravo pour ces 20 minutes de focus 🎉</div>
        </div>
        <div style={{padding:"1.2rem"}}>
          <button onClick={onClose}
            style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:12,padding:".9rem",fontSize:".88rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
            Merci 🌟
          </button>
        </div>
      </div>
    </div>
  );
}
function NouveauChallengePopup({challenge, onClose}){
'@

# ── Vérification puis application des 3 remplacements ──
$replacements = @(
  @{ old = $old1; new = $new1; name = "1 - states + polling" },
  @{ old = $old2; new = $new2; name = "2 - affichage popups" },
  @{ old = $old3; new = $new3; name = "3 - composants popup" }
)

foreach ($r in $replacements) {
  if (-not $content.Contains($r.old)) {
    Write-Host "ERREUR : bloc ancre introuvable pour le remplacement '$($r.name)'. Arret sans modification." -ForegroundColor Red
    exit 1
  }
}

foreach ($r in $replacements) {
  $content = $content.Replace($r.old, $r.new)
  Write-Host "Remplacement applique : $($r.name)"
}

Write-Host "Longueur APRES modification : $($content.Length) caracteres"

[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Host "Fichier sauvegarde avec succes." -ForegroundColor Green