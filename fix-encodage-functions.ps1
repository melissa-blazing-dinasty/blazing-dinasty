$path = "C:\Users\melou\blazing-dynasty\src\App.js"
$content = [System.IO.File]::ReadAllText($path)
Write-Host "Longueur AVANT modification : $($content.Length) caracteres"

# ── A : etat themeInput ──
$oldA = @'
  const[accepted,setAccepted]=useState(false);
  const DUREE_MIN=20;
'@
$newA = @'
  const[accepted,setAccepted]=useState(false);
  const[themeInput,setThemeInput]=useState("");
  const DUREE_MIN=20;
'@

# ── B : fonction lancer avec theme ──
$oldB = @'
  const lancer=async()=>{
    const nouvelle={startedAt:Date.now(),startedBy:userName,messages:[],accepts:{}};
    try{ await setDoc(doc(db,"equipe","power-hour"),nouvelle); setSession(nouvelle); }catch{}
  };
'@
$newB = @'
  const lancer=async()=>{
    const nouvelle={startedAt:Date.now(),startedBy:userName,theme:themeInput.trim(),messages:[],accepts:{}};
    try{ await setDoc(doc(db,"equipe","power-hour"),nouvelle); setSession(nouvelle); setThemeInput(""); }catch{}
  };
'@

if (-not $content.Contains($oldA)) { Write-Host "ERREUR ancre A introuvable" -ForegroundColor Red; exit 1 }
if (-not $content.Contains($oldB)) { Write-Host "ERREUR ancre B introuvable" -ForegroundColor Red; exit 1 }
$content = $content.Replace($oldA, $newA)
Write-Host "Remplacement applique : A"
$content = $content.Replace($oldB, $newB)
Write-Host "Remplacement applique : B"

# ── C : champ theme insere via marqueur ASCII pur (evite tout accent) ──
$btnIdx = $content.IndexOf("<button onClick={lancer}")
if ($btnIdx -lt 0) { Write-Host "ERREUR : marqueur bouton lancer introuvable" -ForegroundColor Red; exit 1 }
$wrapIdx = $content.LastIndexOf("{canCreate&&(", $btnIdx)
if ($wrapIdx -lt 0) { Write-Host "ERREUR : marqueur canCreate introuvable" -ForegroundColor Red; exit 1 }

$inputBloc = @'
          {canCreate&&(
            <input value={themeInput} onChange={e=>setThemeInput(e.target.value)} placeholder="Theme du jour (optionnel) ex: Prospection"
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:10,padding:".6rem .8rem",fontFamily:"inherit",fontSize:".8rem",color:C.texte,marginBottom:".7rem",outline:"none",textAlign:"center"}}/>
          )}

'@
$content = $content.Insert($wrapIdx, $inputBloc)
Write-Host "Remplacement applique : C (champ theme insere)"

# ── D : affichage theme dans le bandeau, via marqueur ASCII pur ──
$oldD = "{session.startedBy}</div>"
if (-not $content.Contains($oldD)) { Write-Host "ERREUR ancre D introuvable" -ForegroundColor Red; exit 1 }
$newD = "{session.startedBy}{session.theme?(`" - Theme : `"+session.theme):`"`"}</div>"
$content = $content.Replace($oldD, $newD)
Write-Host "Remplacement applique : D"

# ── E : reecriture propre des popups (corrige les emojis/accents casses) ──
$startMarker = "function PowerHourStartPopup"
$endMarker = "function NouveauChallengePopup"
$startIdx = $content.IndexOf($startMarker)
$endIdx = $content.IndexOf($endMarker)

if ($startIdx -lt 0 -or $endIdx -lt 0 -or $endIdx -le $startIdx) {
  Write-Host "ERREUR : marqueurs des popups introuvables." -ForegroundColor Red
  exit 1
}

$nouveauBloc = @'
function PowerHourStartPopup({session, onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,31,14,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:"1rem"}}>
      <div style={{background:C.blanc,borderRadius:20,width:"100%",maxWidth:420,overflow:"hidden",boxShadow:"0 8px 40px rgba(0,0,0,.3)"}}>
        <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,padding:"1.5rem 1.2rem",textAlign:"center"}}>
          <div style={{fontSize:"2.4rem",marginBottom:".4rem"}}>{"\u{26A1}"}</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.3rem",fontWeight:300,color:C.blanc}}>Power Hour lancee !</div>
          <div style={{fontSize:".8rem",color:C.pale,marginTop:".3rem"}}>par {session.startedBy} - 20 minutes de focus intense</div>
          {session.theme&&(
            <div style={{fontSize:".78rem",color:C.or,marginTop:".5rem",fontWeight:700,background:"rgba(255,255,255,.15)",display:"inline-block",padding:".3rem .8rem",borderRadius:20}}>
              Theme : {session.theme}
            </div>
          )}
        </div>
        <div style={{padding:"1.2rem"}}>
          <button onClick={onClose}
            style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:12,padding:".9rem",fontSize:".88rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
            Je participe {"\u{1F680}"}
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
          <div style={{fontSize:"2.4rem",marginBottom:".4rem"}}>{"\u{2705}"}</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.3rem",fontWeight:300,color:C.blanc}}>Power Hour terminee !</div>
          <div style={{fontSize:".8rem",color:C.pale,marginTop:".3rem"}}>Bravo pour ces 20 minutes de focus {"\u{1F389}"}</div>
        </div>
        <div style={{padding:"1.2rem"}}>
          <button onClick={onClose}
            style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:12,padding:".9rem",fontSize:".88rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
            Merci {"\u{2728}"}
          </button>
        </div>
      </div>
    </div>
  );
}
function AnnonceRecuePopup({annonce, onClose}){
  const urgent=!!annonce.urgente;
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,31,14,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:"1rem"}}>
      <div style={{background:C.blanc,borderRadius:20,width:"100%",maxWidth:420,overflow:"hidden",boxShadow:"0 8px 40px rgba(0,0,0,.3)"}}>
        <div style={{background:urgent?"#B8442F":`linear-gradient(135deg,${C.brun},${C.brun2})`,padding:"1.5rem 1.2rem",textAlign:"center"}}>
          <div style={{fontSize:"2.4rem",marginBottom:".4rem"}}>{annonce.icone||"\u{1F4E2}"}</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",fontWeight:300,color:C.blanc}}>{annonce.titre||"Annonce de l equipe"}</div>
          {urgent&&<div style={{fontSize:".68rem",color:"#FFD9D0",marginTop:".3rem",fontWeight:700,letterSpacing:".05em",textTransform:"uppercase"}}>Important</div>}
        </div>
        <div style={{padding:"1.2rem"}}>
          <p style={{fontSize:".84rem",color:C.texte,lineHeight:1.7,marginBottom:"1rem",whiteSpace:"pre-wrap"}}>{annonce.message}</p>
          <button onClick={onClose}
            style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:12,padding:".9rem",fontSize:".88rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
            J'ai compris {"\u{2713}"}
          </button>
        </div>
      </div>
    </div>
  );
}
function AnnonceAdminPopup({uid, onClose}){
  const ICONES=["\u{1F4E2}","\u{26A1}","\u{1F389}","\u{26A0}","\u{1F393}","\u{1F4B0}","\u{1F525}","\u{2728}"];
  const[titre,setTitre]=useState("");
  const[message,setMessage]=useState("");
  const[icone,setIcone]=useState("\u{1F4E2}");
  const[urgente,setUrgente]=useState(false);
  const[sending,setSending]=useState(false);
  const[sent,setSent]=useState(false);

  const publier=async()=>{
    if(!titre.trim()||!message.trim())return;
    setSending(true);
    try{
      await setDoc(doc(db,"equipe","derniere-annonce"),{
        id:Date.now(),
        titre:titre.trim(),
        message:message.trim(),
        icone,
        urgente,
        creePar:uid,
        creeLe:Date.now(),
      });
      setSent(true);
      setTimeout(()=>{onClose();},1500);
    }catch{}
    setSending(false);
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,31,14,.6)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:9998,padding:"1rem"}}>
      <div style={{background:C.blanc,borderRadius:"16px 16px 0 0",padding:"1.4rem",width:"100%",maxWidth:480,boxShadow:"0 -8px 32px rgba(0,0,0,.2)",maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,color:C.brun}}>{"\u{1F4E2}"} Annonce officielle</div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:"1.2rem",color:C.gris,cursor:"pointer",padding:".2rem"}}>x</button>
        </div>
        <p style={{fontSize:".72rem",color:C.gris,marginBottom:"1rem",lineHeight:1.6}}>
          Envoyee a toute l equipe, en popup dans l appli et en notification push sur leur telephone.
        </p>
        <div style={{display:"flex",gap:".4rem",marginBottom:"1rem",flexWrap:"wrap"}}>
          {ICONES.map(ic=>(
            <button key={ic} onClick={()=>setIcone(ic)}
              style={{fontSize:"1.3rem",background:icone===ic?C.brun+"20":C.creme,border:icone===ic?`2px solid ${C.brun}`:"1px solid transparent",borderRadius:10,padding:".4rem .6rem",cursor:"pointer"}}>
              {ic}
            </button>
          ))}
        </div>
        <input value={titre} onChange={e=>setTitre(e.target.value)} placeholder="Titre de l'annonce"
          style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:10,padding:".7rem .85rem",fontFamily:"inherit",fontSize:".85rem",color:C.texte,marginBottom:".7rem",outline:"none"}}/>
        <textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Ton message..."
          style={{width:"100%",minHeight:110,border:`1px solid ${C.pale}`,borderRadius:10,padding:".75rem",fontFamily:"inherit",fontSize:".82rem",color:C.texte,resize:"vertical",outline:"none",lineHeight:1.6,marginBottom:".8rem"}}/>
        <label style={{display:"flex",alignItems:"center",gap:".5rem",fontSize:".78rem",color:C.brun,marginBottom:"1rem",cursor:"pointer"}}>
          <input type="checkbox" checked={urgente} onChange={e=>setUrgente(e.target.checked)}/>
          Marquer comme importante (mise en avant en rouge)
        </label>
        <button onClick={publier} disabled={!titre.trim()||!message.trim()||sending||sent}
          style={{width:"100%",background:sent?C.vert:(titre.trim()&&message.trim())?C.brun:C.pale,color:(titre.trim()&&message.trim())?C.blanc:C.gris,border:"none",borderRadius:10,padding:".8rem",fontSize:".85rem",fontWeight:700,fontFamily:"inherit",cursor:(titre.trim()&&message.trim())?"pointer":"default"}}>
          {sent?"Envoyee a toute l equipe !":sending?"Envoi...":"Publier a toute l equipe ->"}
        </button>
      </div>
    </div>
  );
}

'@

$blocOriginal = $content.Substring($startIdx, $endIdx - $startIdx)
$content = $content.Replace($blocOriginal, $nouveauBloc)
Write-Host "Remplacement applique : E (popups reecrits proprement)"

Write-Host "Longueur APRES modification : $($content.Length) caracteres"
[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Host "Fichier sauvegarde avec succes." -ForegroundColor Green