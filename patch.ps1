$lines = [System.IO.File]::ReadAllLines("C:\Users\melou\blazing-dynasty\src\App.js", [System.Text.Encoding]::UTF8)
$lines[9739] = '      </div>
      {/* Forcer mise a jour */}
      <div style={{background:"#F0F7FF",borderRadius:12,padding:"1rem",marginTop:"1rem",border:"1px solid #B0C4DE"}}>
        <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"#1a5276",marginBottom:".5rem"}}>🔄 Forcer la mise à jour pour tous</div>
        <div style={{fontSize:".72rem",color:"#888",marginBottom:".75rem",lineHeight:1.5}}>Force toutes les membres à recharger l application au prochain chargement.</div>
        <button onClick={async()=>{
          try{
            await setDoc(doc(db,"admin","config"),{forceReload:Date.now()},{merge:true});
            alert("✅ Mise à jour forcée !");
          }catch(e){alert("Erreur: "+e.message);}
        }} style={{background:"#1a5276",color:"white",border:"none",borderRadius:8,padding:".55rem 1rem",fontSize:".75rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
          🔄 Forcer la mise à jour
        </button>
      </div>'
[System.IO.File]::WriteAllLines("C:\Users\melou\blazing-dynasty\src\App.js", $lines, [System.Text.Encoding]::UTF8)
Write-Host "Done"
