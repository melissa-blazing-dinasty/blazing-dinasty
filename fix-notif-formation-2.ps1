$path = "C:\Users\melou\blazing-dynasty\src\App.js"
$content = [System.IO.File]::ReadAllText($path)
Write-Host "Longueur AVANT modification : $($content.Length) caracteres"

# ── Etape 1 : recuperer la date reelle du dernier ajout de produit ──
$old1 = 'Object.keys(progress).forEach(k=>{if(progress[k]?.termine)termines[k]=true;});'
$new1 = @'
Object.keys(progress).forEach(k=>{if(progress[k]?.termine)termines[k]=true;});
        let dateFormaProduits=FORMATION_DATES_MAJ.formaproduits;
        try{
          const fpSnap=await getDoc(doc(db,"admin","formation_produits"));
          if(fpSnap.exists()&&fpSnap.data().derniereMaj){
            dateFormaProduits=new Date(fpSnap.data().derniereMaj).toISOString().slice(0,10);
          }
        }catch{}
'@

# ── Etape 2 : utiliser cette date reelle pour formaproduits, sinon la date en dur pour le reste ──
$old2 = 'const maj=FORMATION_DATES_MAJ[id];'
$new2 = 'const maj=id==="formaproduits"?dateFormaProduits:FORMATION_DATES_MAJ[id];'

if (-not $content.Contains($old1)) { Write-Host "ERREUR ancre 1 introuvable" -ForegroundColor Red; exit 1 }
if (-not $content.Contains($old2)) { Write-Host "ERREUR ancre 2 introuvable" -ForegroundColor Red; exit 1 }

$content = $content.Replace($old1, $new1)
Write-Host "Remplacement applique : 1"
$content = $content.Replace($old2, $new2)
Write-Host "Remplacement applique : 2"

Write-Host "Longueur APRES modification : $($content.Length) caracteres"
[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Host "Fichier sauvegarde avec succes." -ForegroundColor Green