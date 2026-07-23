$path = "C:\Users\melou\blazing-dynasty\src\App.js"
$content = [System.IO.File]::ReadAllText($path)
Write-Host "Longueur AVANT modification : $($content.Length) caracteres"

$old1 = "  const[diagResultsTrigger,setDiagResultsTrigger]=useState(0);"
$new1 = @'
  const[nbMsgsNonLusApp,setNbMsgsNonLusApp]=useState(0);
  useEffect(()=>{
    if(!userId)return;
    const checkMsgsEspaceChef=async()=>{
      try{
        const snap=await getDoc(doc(db,"messages",userId));
        if(!snap.exists()){setNbMsgsNonLusApp(0);return;}
        const msgs=snap.data().msgs||[];
        setNbMsgsNonLusApp(msgs.filter(m=>!m.lu).length);
      }catch{}
    };
    checkMsgsEspaceChef();
    const t=setInterval(checkMsgsEspaceChef,30000);
    return()=>clearInterval(t);
  },[userId]);
  const[diagResultsTrigger,setDiagResultsTrigger]=useState(0);
'@

$old2 = 'if(tb.id==="calendrier")n=nbNotifCalendrier;'
$new2 = @'
if(tb.id==="calendrier")n=nbNotifCalendrier;
              if(tb.id==="espacechef")n=nbMsgsNonLusApp;
'@

if (-not $content.Contains($old1)) { Write-Host "ERREUR ancre 1 introuvable" -ForegroundColor Red; exit 1 }
if (-not $content.Contains($old2)) { Write-Host "ERREUR ancre 2 introuvable" -ForegroundColor Red; exit 1 }

$content = $content.Replace($old1, $new1)
Write-Host "Remplacement applique : 1"
$content = $content.Replace($old2, $new2)
Write-Host "Remplacement applique : 2"

Write-Host "Longueur APRES modification : $($content.Length) caracteres"
[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Host "Fichier sauvegarde avec succes." -ForegroundColor Green