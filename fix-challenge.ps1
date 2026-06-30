$path = "C:\Users\melou\blazing-dynasty\src\App.js"
$content = [System.IO.File]::ReadAllText($path)

$old1 = "setUserId(uid);setName(n);setScreen(`"app`");load(uid);verifierChangementPeriode(uid);`r`n            try{const fk=`"bd-first-`"+uid;"
$new1 = "setUserId(uid);setName(n);setScreen(`"app`");load(uid);verifierChangementPeriode(uid);getDoc(doc(db,`"users`",uid)).then(snapCA=>{const caRaw=snapCA.exists()?snapCA.data()[`"db-challenge-app`"]:null;if(caRaw){const ca=JSON.parse(caRaw);const startDate=new Date(ca.startDate);const today=new Date();today.setHours(0,0,0,0);const diffJours=Math.floor((today-startDate)/(1000*60*60*24));if(diffJours<7)setTimeout(()=>setShowChallengeApp(true),2000);}else{setTimeout(()=>setShowChallengeApp(true),2000);}}).catch(()=>{setTimeout(()=>setShowChallengeApp(true),2000);});`r`n            try{const fk=`"bd-first-`"+uid;"

$count1 = ([regex]::Matches($content, [regex]::Escape($old1))).Count
if ($count1 -ne 1) {
    Write-Host "ERREUR old1: trouve $count1 fois au lieu de 1 - ARRET"
} else {
    $content = $content.Replace($old1, $new1)

    $old2 = "}).catch(()=>{`r`n            setUserId(uid);setName(n);setScreen(`"app`");load(uid);verifierChangementPeriode(uid);`r`n          });"
    $new2 = "}).catch(()=>{`r`n            setUserId(uid);setName(n);setScreen(`"app`");load(uid);verifierChangementPeriode(uid);getDoc(doc(db,`"users`",uid)).then(snapCA=>{const caRaw=snapCA.exists()?snapCA.data()[`"db-challenge-app`"]:null;if(caRaw){const ca=JSON.parse(caRaw);const startDate=new Date(ca.startDate);const today=new Date();today.setHours(0,0,0,0);const diffJours=Math.floor((today-startDate)/(1000*60*60*24));if(diffJours<7)setTimeout(()=>setShowChallengeApp(true),2000);}else{setTimeout(()=>setShowChallengeApp(true),2000);}}).catch(()=>{setTimeout(()=>setShowChallengeApp(true),2000);});`r`n          });"

    $count2 = ([regex]::Matches($content, [regex]::Escape($old2))).Count
    if ($count2 -ne 1) {
        Write-Host "ERREUR old2: trouve $count2 fois au lieu de 1 - ARRET"
    } else {
        $content = $content.Replace($old2, $new2)

        $old3 = 'if(etat==="termine_jour"||etat==="termine"){onClose();return null;}'
        $new3 = 'if(etat==="termine_jour"||etat==="termine"){return null;}'

        $count3 = ([regex]::Matches($content, [regex]::Escape($old3))).Count
        if ($count3 -ne 1) {
            Write-Host "ERREUR old3: trouve $count3 fois au lieu de 1 - ARRET"
        } else {
            $content = $content.Replace($old3, $new3)

            $old4 = "      }catch{setEtat(`"annonce`");}`r`n    })();`r`n  },[uid]);"
            $new4 = "      }catch{setEtat(`"annonce`");}`r`n    })();`r`n  },[uid]);`r`n`r`n  useEffect(()=>{`r`n    if(etat===`"termine_jour`"||etat===`"termine`"){ onClose(); }`r`n  },[etat]);"

            $count4 = ([regex]::Matches($content, [regex]::Escape($old4))).Count
            if ($count4 -ne 1) {
                Write-Host "ERREUR old4: trouve $count4 fois au lieu de 1 - ARRET"
            } else {
                $content = $content.Replace($old4, $new4)
                [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
                Write-Host "SUCCES - 4 corrections appliquees"
            }
        }
    }
}