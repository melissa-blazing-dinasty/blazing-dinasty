$path = "C:\Users\melou\blazing-dynasty\src\DiagnosticsTab.js"
$content = [System.IO.File]::ReadAllText($path)

$old1 = "import { SCRIPTS_DATA, DecouverteTour } from './App';"
$c1 = ([regex]::Matches($content,[regex]::Escape($old1))).Count
if($c1 -ne 1){ Write-Host "ERREUR old1: $c1 - ARRET"; exit }
$new1 = $old1 + "`r`n" + "import { fbFunctions } from './App';" + "`r`n" + "import { httpsCallable } from 'firebase/functions';"
$content = $content.Replace($old1,$new1)

$old2 = @'
        // Stocker dans diag_externes (pour référence)
        const ref=doc(db,"diag_externes",`${uid}_${Date.now()}`);
        await setDoc(ref,{
          uid, type, nomClient:nomFinal, contact,
          reponses:repSansContact,
          date:todayLocalStr(),
          ts:Date.now(), traite:false
        });
        // Stocker aussi dans users/{uid}/db-diagnostics pour apparaître dans l'historique
        const userRef=doc(db,"users",uid);
        const snap=await getDoc(userRef);
        const existing=snap.exists()&&snap.data()["db-diagnostics"]?JSON.parse(snap.data()["db-diagnostics"]):[];
        const newDiag={
          id:`diag${Date.now()}`,
          type, nomClient:nomFinal, contact,
          reponses:repSansContact,
          date:todayLocalStr(),
          ts:Date.now(),
          externe:true, nonLu:true,
        };
        await setDoc(userRef,{"db-diagnostics":JSON.stringify([newDiag,...existing].slice(0,50))},{merge:true});
        setMode("attente");
'@

$c2 = ([regex]::Matches($content,[regex]::Escape($old2))).Count
if($c2 -ne 1){ Write-Host "ERREUR old2: $c2 - ARRET"; exit }

$new2 = @'
        const soumettreDiagnosticFn = httpsCallable(fbFunctions, "soumettreDiagnostic");
        await soumettreDiagnosticFn({uid, type, nomClient:nomFinal, contact, reponses:repSansContact});
        setMode("attente");
'@

$content = $content.Replace($old2,$new2)
[System.IO.File]::WriteAllText($path,$content,[System.Text.Encoding]::UTF8)
Write-Host "SUCCES DIAGNOSTIC VIA FONCTION"