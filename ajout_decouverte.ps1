$path = "C:\Users\melou\blazing-dynasty\src\DiagnosticsTab.js"
$content = [System.IO.File]::ReadAllText($path)

# --- Étape 1 : ajouter les 2 nouveaux useState ---
$funcMarker = "function LinkBioPublicPage({slug}){"
$funcCount = ([regex]::Matches($content, [regex]::Escape($funcMarker))).Count
if ($funcCount -ne 1) { Write-Host "ERREUR: marker fonction trouvé $funcCount fois (attendu 1). Abandon."; exit }

$newStates = "`n  const[dqjsOpen,setDqjsOpen]=useState(false);`n  const[dqjsTab,setDqjsTab]=useState(`"histoire`");"
$content = $content.Replace($funcMarker, $funcMarker + $newStates)

# --- Étape 2 : remplacer le bloc "Mon Parcours" par le système d'onglets ---
$startMarker = '{((profil.parcoursTexte1||profil.parcoursTexte2||profil.parcoursTexte3||(profil.parcoursPhotos||[]).some(p=>p)||(profil.parcoursProduits||[]).length>0))&&('
$endMarker = '{/* Section diagnostics */}'

$startCount = ([regex]::Matches($content, [regex]::Escape($startMarker))).Count
$endCount = ([regex]::Matches($content, [regex]::Escape($endMarker))).Count
if ($startCount -ne 1) { Write-Host "ERREUR: marker début trouvé $startCount fois (attendu 1). Abandon."; exit }
if ($endCount -ne 1) { Write-Host "ERREUR: marker fin trouvé $endCount fois (attendu 1). Abandon."; exit }

$startIndex = $content.IndexOf($startMarker)
$endIndex = $content.IndexOf($endMarker)
if ($endIndex -le $startIndex) { Write-Host "ERREUR: ordre des marqueurs incohérent. Abandon."; exit }

$before = $content.Substring(0, $startIndex)
$after = $content.Substring($endIndex)

$newBlock = @'
{((profil.parcoursTexte1||profil.parcoursTexte2||profil.parcoursTexte3||(profil.parcoursPhotos||[]).some(p=>p)||(profil.parcoursProduits||[]).length>0))&&(
          <div style={{padding:"1rem",background:theme.bg}}>
            <button onClick={()=>setDqjsOpen(o=>!o)} style={{width:"100%",background:`linear-gradient(135deg,${theme.accent},${theme.accent}cc)`,border:"none",borderRadius:14,padding:".85rem 1rem",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",fontFamily:"inherit"}}>
              <span style={{fontSize:".72rem",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"white"}}>✦ Découvre qui je suis</span>
              <span style={{fontSize:"1rem",color:"white",transform:dqjsOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>⌄</span>
            </button>
            {dqjsOpen&&(
              <div style={{marginTop:".75rem"}}>
                <div style={{display:"flex",gap:".4rem",marginBottom:".85rem"}}>
                  <button onClick={()=>setDqjsTab("histoire")} style={{flex:1,background:dqjsTab==="histoire"?theme.accent:theme.accent+"15",color:dqjsTab==="histoire"?"white":theme.accent,border:"none",borderRadius:10,padding:".55rem .5rem",fontSize:".68rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Mon histoire</button>
                  <button onClick={()=>setDqjsTab("produits")} style={{flex:1,background:dqjsTab==="produits"?theme.accent:theme.accent+"15",color:dqjsTab==="produits"?"white":theme.accent,border:"none",borderRadius:10,padding:".55rem .5rem",fontSize:".68rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Mes produits préférés</button>
                </div>
                {dqjsTab==="histoire"&&(
                  <div>
                    {(profil.parcoursPhotos||[]).filter(p=>p).length>0&&(
                      <div style={{display:"flex",gap:".5rem",overflowX:"auto",marginBottom:".85rem",paddingBottom:".3rem"}}>
                        {profil.parcoursPhotos.filter(p=>p).map((ph,i)=>(<img key={i} src={ph} alt="" style={{width:120,height:120,borderRadius:12,objectFit:"cover",flexShrink:0}}/>))}
                      </div>
                    )}
                    {[profil.parcoursTexte1,profil.parcoursTexte2,profil.parcoursTexte3].filter(t=>t).map((t,i)=>(<div key={i} style={{fontSize:".78rem",lineHeight:1.7,color:sub,marginBottom:".65rem"}}>{t}</div>))}
                  </div>
                )}
                {dqjsTab==="produits"&&(profil.parcoursProduits||[]).filter(p=>p.nom||p.photo).length>0&&(
                  <div>
                    {profil.parcoursProduits.filter(p=>p.nom||p.photo).map((p,i)=>(
                      <div key={i} style={{background:theme.accent+"10",borderRadius:12,padding:".75rem",marginBottom:".6rem"}}>
                        <div style={{display:"flex",gap:".65rem",alignItems:"flex-start"}}>
                          {p.photo&&<img src={p.photo} alt="" style={{width:60,height:60,borderRadius:10,objectFit:"cover",flexShrink:0}}/>}
                          <div style={{flex:1}}>
                            {p.nom&&<div style={{fontSize:".8rem",fontWeight:700,color:theme.header,marginBottom:".2rem"}}>{p.nom}</div>}
                            {p.texte&&<div style={{fontSize:".7rem",color:sub,lineHeight:1.5}}>{p.texte}</div>}
                          </div>
                        </div>
                        {p.videoUrl&&<video src={p.videoUrl} controls style={{width:"100%",borderRadius:10,marginTop:".5rem"}}/>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
'@
$newBlock = $newBlock + "        "

$newContent = $before + $newBlock + $after

[System.IO.File]::WriteAllText($path, $newContent, [System.Text.Encoding]::UTF8)
Write-Host "Fichier modifié avec succès. Longueur avant: $($content.Length) / après: $($newContent.Length)"