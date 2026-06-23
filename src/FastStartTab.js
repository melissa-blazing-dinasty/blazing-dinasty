import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { C } from './constants';
import { ss, sg, todayLocalStr } from './utils';
import { useLang, translateBatch } from './components';
import { FAST_START_DAYS, Confetti, postToWallOfFame, FAST_START_QUIZ, FastStartQuizPopup } from './App';
import { FORMATION_APP_CATEGORIES_DEFAULT, FORMATION_APP_CATEGORIES } from './DiagnosticsTab';

export function FastStartTab({uid, userName, goToFormation}){
  const {lang} = useLang();
  const[taskTranslations,setTaskTranslations]=useState({});

  useEffect(()=>{
    if(lang==="fr"){setTaskTranslations({});return;}
    // Collecter tous les textes de tâches
    const allTexts=[];
    const allKeys=[];
    FAST_START_DAYS.forEach(d=>{
      d.taches.forEach((t,i)=>{
        const txt=typeof t==="string"?t:t.t;
        allTexts.push(txt);
        allKeys.push(`${d.jour}-${i}`);
      });
      allTexts.push(d.titre);
      allKeys.push(`titre-${d.jour}`);
      if(d.objectif){allTexts.push(d.objectif);allKeys.push(`obj-${d.jour}`);}
    });
    translateBatch(allTexts,lang).then(res=>{
      const map={};
      allKeys.forEach((k,i)=>map[k]=res[i]);
      setTaskTranslations(map);
    });
  },[lang]);
  const[showQuiz,setShowQuiz]=useState(null);
  const[marraineUid,setMarraineUid]=useState(null);
  const[modulesValides,setModulesValides]=useState({});

  const[videosFastStart,setVideosFastStart]=useState({});
  const[ordreFormationApp,setOrdreFormationApp]=useState([]);
  const[savingOrdre,setSavingOrdre]=useState(false);
  const[savedOrdre,setSavedOrdre]=useState(false);
  useEffect(()=>{(async()=>{try{const snap=await getDoc(doc(db,"admin","formation_app_ordre"));if(snap.exists()&&snap.data().ordre)setOrdreFormationApp(snap.data().ordre);else setOrdreFormationApp(FORMATION_APP_CATEGORIES_DEFAULT.map(c=>c.id));}catch{}})();},[]);
  const sauvegarderOrdre=async()=>{setSavingOrdre(true);try{await setDoc(doc(db,"admin","formation_app_ordre"),{ordre:ordreFormationApp},{merge:true});FORMATION_APP_CATEGORIES=[...FORMATION_APP_CATEGORIES_DEFAULT].sort((a,b)=>ordreFormationApp.indexOf(a.id)-ordreFormationApp.indexOf(b.id));setSavedOrdre(true);setTimeout(()=>setSavedOrdre(false),2000);}catch{}setSavingOrdre(false);};
  const monterCat=(i)=>{if(i===0)return;const next=[...ordreFormationApp];[next[i-1],next[i]]=[next[i],next[i-1]];setOrdreFormationApp(next);};
  const descendreCat=(i)=>{if(i===ordreFormationApp.length-1)return;const next=[...ordreFormationApp];[next[i],next[i+1]]=[next[i+1],next[i]];setOrdreFormationApp(next);};
  const[startDate,setStartDate]=useState(null);
  const[doneTasks,setDoneTasks]=useState({});
  const[loaded,setLoaded]=useState(false);
  const[confettiTrigger,setConfettiTrigger]=useState(0);

  useEffect(()=>{
    (async()=>{
      const data = await sg(uid,"db-fast-start");
      if(data){
        const parsed = JSON.parse(data);
        setStartDate(parsed.startDate);
        setDoneTasks(parsed.doneTasks||{});
        setModulesValides(parsed.modulesValides||{});
      }
      // Charger la marraine depuis l'annuaire
      try{
        const snap=await getDoc(doc(db,"equipe","annuaire"));
        if(snap.exists()){
          const ann=snap.data().membres||{};
          const me=ann[uid];
          if(me?.marraine) setMarraineUid(me.marraine);
        }
      }catch{}
      // Charger les vidéos Fast Start
      try{
        const snapV=await getDoc(doc(db,"admin","videos_faststart"));
        if(snapV.exists()) setVideosFastStart(snapV.data().videos||{});
      }catch{}
      setLoaded(true);
    })();
  },[uid]);

  const validerModule=(jour)=>{
    const next={...modulesValides,[jour]:true};
    setModulesValides(next);
    // Sauvegarder
    sg(uid,"db-fast-start").then(data=>{
      const parsed=data?JSON.parse(data):{};
      ss(uid,"db-fast-start",JSON.stringify({...parsed,modulesValides:next}));
    });
  };

  const demarrer=()=>{
    const today = todayLocalStr();
    setStartDate(today);
    ss(uid,"db-fast-start",JSON.stringify({startDate:today, doneTasks:{}}));
  };

  const currentDay = startDate
    ? (()=>{
        const _s=new Date(startDate+"T12:00:00").getTime();
        const _n=new Date();const _t=new Date(_n.getFullYear(),_n.getMonth(),_n.getDate(),12,0,0).getTime();
        return Math.min(7,Math.max(1,Math.floor((_t-_s)/86400000)+1));
      })()
    : 1;

  const toggleTask=(jour,idx)=>{
    const key=`${jour}-${idx}`;
    const next={...doneTasks,[key]:!doneTasks[key]};
    setDoneTasks(next);
    ss(uid,"db-fast-start",JSON.stringify({startDate, doneTasks:next}));

    // Vérifier si toute la semaine est terminée
    const allDone = FAST_START_DAYS.every(d=>d.taches.every((_,i)=>next[`${d.jour}-${i}`]));
    if(allDone){
      setConfettiTrigger(t=>t+1);
      postToWallOfFame(uid, userName, `a terminé son parcours Fast Start (7 jours) ! 🚀`, "🌟");
    }
  };

  if(!loaded) return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  if(!startDate){
    return(
      <div style={{textAlign:"center",padding:"2rem 1rem"}}>
        <Confetti trigger={confettiTrigger}/>
        <div style={{fontSize:"2.5rem",marginBottom:".5rem"}}>🚀</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",fontWeight:300,color:C.brun,marginBottom:".5rem"}}>
          Bienvenue dans <em style={{fontStyle:"italic",color:C.rose}}>Blazing Dynasty</em> !
        </div>
        <p style={{fontSize:".78rem",color:C.gris,lineHeight:1.7,marginBottom:"1.5rem",maxWidth:340,marginLeft:"auto",marginRight:"auto"}}>
          On va t'accompagner pas à pas pendant tes 7 premiers jours.<br/>
          Chaque jour, seulement quelques tâches simples — pas de quoi être débordée, juste avancer un peu chaque jour.
        </p>
        <button onClick={demarrer}
          style={{background:C.rose,color:"white",border:"none",borderRadius:10,padding:".65rem 1.4rem",fontSize:".82rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          Commencer mon J1 !
        </button>
      </div>
    );
  }

  const totalTaches = FAST_START_DAYS.reduce((s,d)=>s+d.taches.length,0);
  const totalDone = Object.values(doneTasks).filter(Boolean).length;
  const pctGlobal = Math.round(totalDone/totalTaches*100);
  const allDone = totalDone===totalTaches;

  return(
    <div>
      <Confetti trigger={confettiTrigger}/>

      {showQuiz&&(
        <FastStartQuizPopup
          jour={showQuiz}
          uid={uid}
          userName={userName}
          marraineUid={marraineUid}
          onClose={()=>setShowQuiz(null)}
          onValide={(j)=>{validerModule(j);setShowQuiz(null);}}
        />
      )}

      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Fast <em style={{fontStyle:"italic",color:C.rose}}>Start</em> — J1 à J7
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        {allDone ? "Bravo, tu as terminé ton parcours Fast Start ! 🎉 La suite t'attend dans Démarrage." : `Tu es au Jour ${currentDay}. Avance à ton rythme — chaque petite tâche compte.`}
      </p>

      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:".62rem",color:C.gris,marginBottom:".3rem"}}>
          <span>Progression globale</span>
          <span style={{fontWeight:700,color:pctGlobal===100?C.vert:C.rose}}>{totalDone}/{totalTaches} ({pctGlobal}%)</span>
        </div>
        <div style={{height:8,background:C.pale,borderRadius:10,overflow:"hidden"}}>
          <div style={{height:"100%",background:pctGlobal===100?C.vert:C.rose,width:pctGlobal+"%",borderRadius:10,transition:"width .4s"}}/>
        </div>
      </div>

      {FAST_START_DAYS.map(d=>{
        const isCurrent = d.jour===currentDay && !allDone;
        const dayDone = d.taches.every((_,i)=>doneTasks[`${d.jour}-${i}`]);
        // Module 1 toujours accessible, modules suivants débloqués si le précédent est validé
        const prevValide = d.jour===1 ? true : !!modulesValides[d.jour-1];
        const isLocked = !prevValide && !modulesValides[d.jour];
        const moduleValide = modulesValides[d.jour];
        const hasQuiz = FAST_START_QUIZ.find(q=>q.jour===d.jour);
        return(
          <div key={d.jour} style={{background:isCurrent?"rgba(196,154,138,.08)":C.blanc,border:`1.5px solid ${moduleValide?C.vert:isCurrent?C.rose:dayDone?C.vert+"60":C.pale}`,borderRadius:12,padding:".85rem 1rem",marginBottom:".6rem",opacity:isLocked?.55:1}}>
            <div style={{display:"flex",alignItems:"center",gap:".5rem",marginBottom:".5rem"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:moduleValide?C.vert:dayDone?C.vert:isCurrent?C.rose:C.pale,color:"white",fontSize:".72rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {moduleValide?"✓":dayDone?"✓":`J${d.jour}`}
              </div>
              <div style={{fontFamily:"Georgia,serif",fontSize:".92rem",fontWeight:600,color:C.brun,flex:1}}>{taskTranslations[`titre-${d.jour}`]||d.titre}</div>
              {isCurrent&&!moduleValide&&<span style={{fontSize:".58rem",fontWeight:700,color:C.rose,background:C.rose+"15",borderRadius:20,padding:".1rem .5rem"}}>Aujourd'hui</span>}
              {moduleValide&&<span style={{fontSize:".58rem",fontWeight:700,color:C.vert,background:C.vert+"15",borderRadius:20,padding:".1rem .5rem"}}>✓ Validé</span>}
            </div>
            {d.taches.map((tk,i)=>{
              const key=`${d.jour}-${i}`;
              const checked=doneTasks[key];
              const isObj = typeof tk === "object";
              const label = isObj ? tk.t : tk;
              const link = isObj ? tk.link : null;
              return(
                <div key={key} style={{padding:".35rem 0"}}>
                  <div onClick={()=>!isLocked&&toggleTask(d.jour,i)}
                    style={{display:"flex",alignItems:"flex-start",gap:".55rem",cursor:isLocked?"default":"pointer"}}>
                    <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${checked?C.vert:C.pale}`,background:checked?C.vert:"transparent",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {checked&&<span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>}
                    </div>
                    <div style={{fontSize:".74rem",color:checked?C.gris:C.texte,textDecoration:checked?"line-through":"none",lineHeight:1.5}}>{taskTranslations[`${d.jour}-${i}`]||label}</div>
                  </div>
                  {link&&!isLocked&&(
                    link.video
                    ? (()=>{
                        const vKey=`module${link.module}`;
                        const vData=videosFastStart[vKey];
                        return vData?.url
                          ? <a href={vData.url} target="_blank" rel="noopener noreferrer"
                              style={{marginLeft:"1.55rem",marginTop:".3rem",display:"inline-flex",alignItems:"center",gap:".35rem",fontSize:".72rem",fontWeight:700,color:"white",textDecoration:"none",background:C.brun,borderRadius:8,padding:".3rem .7rem"}}>
                              ▶ Regarder la vidéo
                            </a>
                          : <div style={{marginLeft:"1.55rem",marginTop:".3rem",fontSize:".66rem",color:C.gris,fontStyle:"italic"}}>
                              🎬 Vidéo bientôt disponible
                            </div>;
                      })()
                    : link.sub
                    ? <div onClick={()=>goToFormation&&goToFormation(link.sub)}
                        style={{marginLeft:"1.55rem",marginTop:".3rem",display:"inline-flex",alignItems:"center",gap:".35rem",fontSize:".66rem",fontWeight:600,color:C.rose,cursor:"pointer"}}>
                        ▶ {link.label}
                      </div>
                    : <a href={link.url} target="_blank" rel="noopener noreferrer"
                        style={{marginLeft:"1.55rem",marginTop:".3rem",display:"inline-flex",alignItems:"center",gap:".35rem",fontSize:".66rem",fontWeight:600,color:"#29A0D8",textDecoration:"none"}}>
                        ▶ {link.label}
                      </a>
                  )}
                  {tk.link2&&!isLocked&&(
                    <a href={tk.link2.url} target="_blank" rel="noopener noreferrer"
                      style={{marginLeft:"1.55rem",marginTop:".2rem",display:"inline-flex",alignItems:"center",gap:".35rem",fontSize:".66rem",fontWeight:600,color:"#29A0D8",textDecoration:"none"}}>
                      ▶ {tk.link2.label}
                    </a>
                  )}
                </div>
              );
            })}

            {/* Bouton exercice + quiz quand toutes les tâches sont cochées */}
            {dayDone&&!moduleValide&&hasQuiz&&(
              <button onClick={()=>setShowQuiz(d.jour)}
                style={{width:"100%",marginTop:".65rem",background:`linear-gradient(135deg,${C.brun},${C.brun2})`,color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:".5rem"}}>
                📝 Exercice + Quiz de validation →
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}


