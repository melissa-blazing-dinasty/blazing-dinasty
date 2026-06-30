import io

path = r"C:\Users\melou\blazing-dynasty\src\App.js"
with io.open(path, "r", encoding="utf-8") as f:
    content = f.read()

old1 = 'setUserId(uid);setName(n);setScreen("app");load(uid);verifierChangementPeriode(uid);\n            try{const fk="bd-first-"+uid;'
new1 = 'setUserId(uid);setName(n);setScreen("app");load(uid);verifierChangementPeriode(uid);getDoc(doc(db,"users",uid)).then(snapCA=>{const caRaw=snapCA.exists()?snapCA.data()["db-challenge-app"]:null;if(caRaw){const ca=JSON.parse(caRaw);const startDate=new Date(ca.startDate);const today=new Date();today.setHours(0,0,0,0);const diffJours=Math.floor((today-startDate)/(1000*60*60*24));if(diffJours<7)setTimeout(()=>setShowChallengeApp(true),2000);}else{setTimeout(()=>setShowChallengeApp(true),2000);}}).catch(()=>{setTimeout(()=>setShowChallengeApp(true),2000);});\n            try{const fk="bd-first-"+uid;'

count1 = content.count(old1)
if count1 != 1:
    print("ERREUR old1: trouve " + str(count1) + " fois au lieu de 1 - ARRET, rien modifie")
else:
    content = content.replace(old1, new1)

    old2 = '}).catch(()=>{\n            setUserId(uid);setName(n);setScreen("app");load(uid);verifierChangementPeriode(uid);\n          });'
    new2 = '}).catch(()=>{\n            setUserId(uid);setName(n);setScreen("app");load(uid);verifierChangementPeriode(uid);getDoc(doc(db,"users",uid)).then(snapCA=>{const caRaw=snapCA.exists()?snapCA.data()["db-challenge-app"]:null;if(caRaw){const ca=JSON.parse(caRaw);const startDate=new Date(ca.startDate);const today=new Date();today.setHours(0,0,0,0);const diffJours=Math.floor((today-startDate)/(1000*60*60*24));if(diffJours<7)setTimeout(()=>setShowChallengeApp(true),2000);}else{setTimeout(()=>setShowChallengeApp(true),2000);}}).catch(()=>{setTimeout(()=>setShowChallengeApp(true),2000);});\n          });'

    count2 = content.count(old2)
    if count2 != 1:
        print("ERREUR old2: trouve " + str(count2) + " fois au lieu de 1 - ARRET, rien modifie")
    else:
        content = content.replace(old2, new2)

        old3 = 'if(etat==="termine_jour"||etat==="termine"){onClose();return null;}'
        new3 = 'if(etat==="termine_jour"||etat==="termine"){return null;}'

        count3 = content.count(old3)
        if count3 != 1:
            print("ERREUR old3: trouve " + str(count3) + " fois au lieu de 1 - ARRET, rien modifie")
        else:
            content = content.replace(old3, new3)

            old4 = '      }catch{setEtat("annonce");}\n    })();\n  },[uid]);'
            new4 = '      }catch{setEtat("annonce");}\n    })();\n  },[uid]);\n\n  useEffect(()=>{\n    if(etat==="termine_jour"||etat==="termine"){ onClose(); }\n  },[etat]);'

            count4 = content.count(old4)
            if count4 != 1:
                print("ERREUR old4: trouve " + str(count4) + " fois au lieu de 1 - ARRET, rien modifie")
            else:
                content = content.replace(old4, new4)
                with io.open(path, "w", encoding="utf-8", newline="") as f:
                    f.write(content)
                print("SUCCES - 4 corrections appliquees")