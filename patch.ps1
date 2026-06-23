$content = [System.IO.File]::ReadAllText("C:\Users\melou\blazing-dynasty\src\App.js", [System.Text.Encoding]::UTF8)
$old = '  const SECRET_CODE="BD-2026-FIRE";'
$new = '  const SECRET_CODE="BD-2026-FIRE";
  const verifierMdp=async()=>{
    if(!mdpInput.trim())return;
    setLoginLoading(true);setLoginError("");
    try{
      const snap=await getDoc(doc(db,"users",pendingUid));
      const mdpStocke=snap.exists()?snap.data()["db-mdp"]:"";
      if(mdpInput.trim()!==mdpStocke){setLoginError("Code personnel incorrect.");setLoginLoading(false);return;}
      try{localStorage.setItem("bd-user",JSON.stringify({uid:pendingUid,n:pendingName,codeOk:true}));}catch{}
      setUserId(pendingUid);setName(pendingName);setScreen("app");load(pendingUid);verifierChangementPeriode(pendingUid);
      setTimeout(()=>setShowChallengeApp(true),2000);
      saveFCMToken(pendingUid);
      sg(pendingUid,"db-obj-perso").then(data=>{syncAnnuaire(pendingUid,pendingName,data?JSON.parse(data):null);});
    }catch{setLoginError("Erreur. Reessaie.");}
    setLoginLoading(false);
  };'
$result = $content.Replace($old, $new)
[System.IO.File]::WriteAllText("C:\Users\melou\blazing-dynasty\src\App.js", $result, [System.Text.Encoding]::UTF8)
Write-Host "Done"
