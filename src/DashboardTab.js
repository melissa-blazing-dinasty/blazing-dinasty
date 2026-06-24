import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { C } from './constants';
import { ss, sg } from './utils';
import { useLang, Btn, SearchSelect, SecTitle } from './components';

import { getPeriodeInfo, getPeriodeActuelle, fmtPLabel, Confetti, postToWallOfFame, CopyBtn, syncAnnuaire, computeBadges, BADGES_DEF, FAST_START_DAYS, MarrainePopup, AnnonceBanner, ConversionPopup, JaugeSucces, BadgesPanel, CitationDuJour, BiblioActionsPopup, TodoPerso, ClassementEquipe, CmdPeriodeBlock, NoticePanel, ObjPersoTab, WallOfFameTab, SuiviCATab, HistoriquePeriodes } from './App';
import { MELISSA } from './ClientsTab';
import { EntonnoirTab, DiagResultsTab } from './DiagnosticsTab';
import { ObjectionsTab, ScriptsTab } from './ScriptsTab';
import { FastStartTab } from './FastStartTab';
import { AssistanteIATab } from './AssistanteIATab';
import { DreamBoardWidget } from './DreamBoardTab';
import { EditorialTab } from './EditorialTab';
import { ClientsTab, ClientsRelanceTab, DistributeursTab, RelancesTab } from './ClientsTab';
import { SuiviRecruTab } from './App';
import { DefisTab, PowerHourTab } from './App';
import { todayLocalStr, sgAll } from './utils';

function DashboardTab({uid, goToFormation, fastStartDone=false, onFastStartDone=()=>{}, hasFastStart=false, onHasFastStart=()=>{}, isChef=false, onObjPersoChange=()=>{}}){
  const[dtab,setDtab]=useState("today");
  const[showNotice,setShowNotice]=useState(false);
  const[noticeVideos,setNoticeVideos]=useState({});
  const[btab,setBtab]=useState("suivica");

  // Rafraîchir automatiquement les prospects à chaque ouverture de l'onglet
  useEffect(()=>{
    if(dtab==="prospects"&&uid){
      getDoc(doc(db,"users",uid)).then(snap=>{
        if(snap.exists()&&snap.data()["db-prospects"]){
          try{setProspects(JSON.parse(snap.data()["db-prospects"]));}catch{}
        }
      }).catch(()=>{});
    }
  },[dtab,uid]);
  const[actions,setActions]=useState({});
  const[prospects,setProspects]=useState([]);
  const[newP,setNewP]=useState({name:"",statut:"Nouveau",note:"",interet:""});
  const[conversionPopup,setConversionPopup]=useState(null); // {prospect, vers: 'client'|'distributrice'}
  const[prospectSearch,setProspectSearch]=useState("");
  const[prospectFiltre,setProspectFiltre]=useState("Tous");
  const[prospectInteretFiltre,setProspectInteretFiltre]=useState("");
  const[posts,setPosts]=useState([]);
  const[newPost,setNewPost]=useState({type:"Post",sujet:"",fait:false});
  const[stats,setStats]=useState({messages:"",reponses:"",presentations:"",ventes:"",recrues:"",objectif:"2"});
  const[clients,setClients]=useState([]);
  const[distributeurs,setDistributeurs]=useState([]);
  const[objPerso,setObjPerso]=useState({ca:"",caObj:"",palier:"2%",recruesObj:"0"});
  const[isChefDash,setIsChefDash]=useState(false);
  const[loaded,setLoaded]=useState(false);
  const[totalRecrues,setTotalRecrues]=useState(0);
  const[cmdPeriode,setCmdPeriode]=useState({count:0,montant:0});
  const[streak,setStreak]=useState(0);
  const[totalActionsValidees,setTotalActionsValidees]=useState(0);
  const[confettiTrigger,setConfettiTrigger]=useState(0);
  const[equipeFunTab,setEquipeFunTab]=useState("wall");
  const[clientsSubTab,setClientsSubTab]=useState("clients");
  const[distriSubTab,setDistriSubTab]=useState("distributeurs");
  const[mood,setMood]=useState(null);
  const userName = uid.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");

  useEffect(()=>{
    let cancelled=false;
    sgAll(uid).then(data=>{
      if(cancelled) return;
      if(data["db-actions"]){
        try{
          const parsed = JSON.parse(data["db-actions"]);
          const today = todayLocalStr();
          // Si les actions ont été sauvegardées aujourd'hui → les charger
          // Sinon → repartir à zéro (nouveau jour)
          if(parsed._date === today){
            const {_date, ...actionsSeules} = parsed;
            setActions(actionsSeules);
          } else {
            // Nouveau jour → actions vides
            setActions({});
            ss(uid,"db-actions",JSON.stringify({_date:today}));
          }
        }catch{ setActions({}); }
      }
      if(data["db-prospects"])     setProspects(JSON.parse(data["db-prospects"]));
      if(data["db-posts"])         setPosts(JSON.parse(data["db-posts"]));
      if(data["db-stats"])         setStats(JSON.parse(data["db-stats"]));
      if(data["db-clients"])       setClients(JSON.parse(data["db-clients"]));
      if(data["db-distributeurs"]) setDistributeurs(JSON.parse(data["db-distributeurs"]));
      if(data["db-obj-perso"])     setObjPerso(JSON.parse(data["db-obj-perso"]));
      if(data["recrues"]){
        try{ setTotalRecrues(JSON.parse(data["recrues"]).length); }catch{}
      }
      if(data["db-actions-cumul"]) setTotalActionsValidees(+data["db-actions-cumul"]||0);
      if(data["db-actions-custom"]){
        try{
          const cd=JSON.parse(data["db-actions-custom"]);
          const tod=todayLocalStr();
          if(Array.isArray(cd)){setActionsCustomRaw([]);ss(uid,"db-actions-custom",JSON.stringify({_date:tod,actions:[]}));}
          else if(cd._date===tod){setActionsCustomRaw(cd.actions||[]);}
          else{setActionsCustomRaw([]);ss(uid,"db-actions-custom",JSON.stringify({_date:tod,actions:[]}));}
        }catch{}
      }
      if(data["db-cmd-periode"]){
        try{
          const raw = JSON.parse(data["db-cmd-periode"]);
          const periodeNum = getPeriodeActuelle ? getPeriodeActuelle() : 0;
          const p = raw[`p${periodeNum}`]||{count:0,montant:0};
          setCmdPeriode(p);
        }catch{}
      }
      if(data["db-fast-start"]){
        try{
          const fs=JSON.parse(data["db-fast-start"]);
          // Fast Start "fait" = tous les 7 modules validés par la marraine
          const nbModulesValides=Object.values(fs.modulesValides||{}).filter(Boolean).length;
          const done=fs.startDate && nbModulesValides>=FAST_START_DAYS.length;
          onFastStartDone(done);
          // Visible seulement si assigné ET pas tous les modules validés
          onHasFastStart(!!fs.startDate && !done);
        }catch{}
      }

      // Calcul du streak de connexion quotidienne
      const today = todayLocalStr();
      const lastLogin = data["db-last-login"];
      let newStreak = +data["db-streak"] || 0;
      if(lastLogin !== today){
        const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
        newStreak = (lastLogin===yesterday) ? newStreak+1 : 1;
        ss(uid,"db-streak",String(newStreak));
        ss(uid,"db-last-login",today);
      }
      setStreak(newStreak);

      setLoaded(true);
    });
    // Vérifier si chef d'équipe
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"acces","membres"));
        const chefs=snap.exists()?snap.data().chefs||[]:[];
        setIsChefDash((Array.isArray(chefs)?chefs:Object.values(chefs||{})).includes(uid.replace(/-/g," ")));
      }catch{}
    })();
    return()=>{cancelled=true;};
  },[uid]);

  const saveActions=(a, justChecked)=>{
    const today = todayLocalStr();
    setActions(a);
    ss(uid,"db-actions",JSON.stringify({...a, _date:today}));

    // Compter ce jour comme actif dans l'historique d'assiduité
    if(justChecked){
      const periodeNum = getPeriodeActuelle ? getPeriodeActuelle() : 0;
      const periodeKey = `p${periodeNum}`;
      sgAll(uid).then(data=>{
        try{
          const hist = data["db-assiduite"] ? JSON.parse(data["db-assiduite"]) : {};
          const periode = hist[periodeKey] || {jours:[]};
          const joursArr=Array.isArray(periode.jours)?periode.jours:Object.values(periode.jours||{});
          if(!joursArr.includes(today)){
            periode.jours = [...joursArr, today];
            hist[periodeKey] = periode;
            ss(uid,"db-assiduite",JSON.stringify(hist));
          }
        }catch{}
      });
    }
    if(justChecked){
      const newCumul = totalActionsValidees+1;
      setTotalActionsValidees(newCumul);
      ss(uid,"db-actions-cumul",String(newCumul));
      const newDone = allTodayActions.filter(act=>a[act.id]).length;
      if(newDone===5) setConfettiTrigger(t=>t+1);
    }
  };
  const saveProspects=p=>{setProspects(p);ss(uid,"db-prospects",JSON.stringify(p));};
  const savePosts=p=>{setPosts(p);ss(uid,"db-posts",JSON.stringify(p));};
  const saveStats=s=>{setStats(s);ss(uid,"db-stats",JSON.stringify(s));};
  const saveClients=c=>{setClients(c);ss(uid,"db-clients",JSON.stringify(c));};
  const saveDistributeurs=d=>{setDistributeurs(d);ss(uid,"db-distributeurs",JSON.stringify(d));};
  const saveObjPerso=async(o)=>{setObjPerso(o);ss(uid,"db-obj-perso",JSON.stringify(o));try{await syncAnnuaire(uid,userName,o);}catch{};onObjPersoChange(o);};

  const todayActions=[
    {id:"a1",icon:"📝",label:"Publier mon post du jour",sub:"1 contenu fort — photo, Reel ou carrousel"},
    {id:"a2",icon:"💬",label:"Envoyer 5 messages de suivi",sub:"Personnes qui ont liké, commenté ou vu mes stories"},
    {id:"a3",icon:"🤝",label:"Interagir avec 10 comptes ciblés",sub:"Femmes qui correspondent à ma cible — vrais commentaires"},
    {id:"a4",icon:"❓",label:'Story "question du jour"',sub:"Une question simple pour générer des réponses en DM"},
    {id:"a5",icon:"📋",label:"Mettre à jour mes prospects",sub:"Relances, nouveaux contacts, statuts à jour"},
  ];
  const[actionsCustom,setActionsCustomRaw]=useState([]);
  const setActionsCustom=(updater)=>{
    setActionsCustomRaw(prev=>{
      const next=typeof updater==="function"?updater(prev):updater;
      ss(uid,"db-actions-custom",JSON.stringify({_date:todayLocalStr(),actions:next}));
      return next;
    });
  };
  const[showBiblio,setShowBiblio]=useState(false);
  const allTodayActions=[...todayActions,...actionsCustom];
  const doneCount=allTodayActions.filter(a=>actions[a.id]).length;
  const totalActions=allTodayActions.length;
  const displayedActions = allTodayActions;

  const pctCAGauge = (()=>{
    if(!objPerso.caObj||!objPerso.ca)return 0;
    return Math.round(+objPerso.ca/+objPerso.caObj*100);
  })();
  const pctRecruesGauge = (()=>{
    if(!objPerso.recruesObj||objPerso.recruesObj==="0"||!objPerso.recruesReal)return 0;
    return Math.round(+objPerso.recruesReal/+objPerso.recruesObj*100);
  })();
  const badgeData = {
    totalActionsValidees, totalRecrues, streak,
    pctCA: pctCAGauge, pctRecrues: pctRecruesGauge,
    ca: +objPerso.ca||0, doneCount,
  };
  const badges = computeBadges(badgeData);

  const todayStr = todayLocalStr();
  const aRecontacterAujourdhui = prospects.filter(p=>p.relance && p.relance<=todayStr);

  // Anniversaires clients dans les 7 prochains jours
  const anniversairesProches = (clients||[]).filter(c=>{
    if(!c.ddn)return false;
    const ddn=new Date(c.ddn);
    const today=new Date();
    const thisYearBday=new Date(today.getFullYear(),ddn.getMonth(),ddn.getDate());
    if(thisYearBday<today.setHours(0,0,0,0)) thisYearBday.setFullYear(today.getFullYear()+1);
    const diffJours=Math.ceil((thisYearBday-new Date().setHours(0,0,0,0))/(1000*60*60*24));
    return diffJours>=0&&diffJours<=7;
  }).map(c=>{
    const ddn=new Date(c.ddn);
    const today=new Date();
    const thisYearBday=new Date(today.getFullYear(),ddn.getMonth(),ddn.getDate());
    if(thisYearBday<new Date(today.getFullYear(),today.getMonth(),today.getDate())) thisYearBday.setFullYear(today.getFullYear()+1);
    const diffJours=Math.ceil((thisYearBday-new Date(today.getFullYear(),today.getMonth(),today.getDate()))/(1000*60*60*24));
    return{...c,joursAvant:diffJours};
  }).sort((a,b)=>a.joursAvant-b.joursAvant);

  const ordreInteret={client:0, distributeur:1, "":2};
  const prospectsFiltres = prospects
    .filter(p=>prospectFiltre==="Tous"||(prospectFiltre==="🤝 Recommandés"?p.source==="recommandation":p.statut===prospectFiltre))
    .filter(p=>{
      if(!prospectInteretFiltre)return true;
      if(prospectInteretFiltre==="recommandation")return p.source==="recommandation"||p.interet==="Recommandation";
      if(prospectInteretFiltre==="none")return !p.interet;
      return p.interet===prospectInteretFiltre;
    .filter(p=>!prospectSearch.trim()||p.name.toLowerCase().includes(prospectSearch.trim().toLowerCase())||(p.note||"").toLowerCase().includes(prospectSearch.trim().toLowerCase()))
    .slice()
    .sort((a,b)=>{
      const aToday = a.relance && a.relance<=todayStr;
      const bToday = b.relance && b.relance<=todayStr;
      if(aToday&&!bToday)return -1;
      if(bToday&&!aToday)return 1;
      const oa=ordreInteret[a.interet||""], ob=ordreInteret[b.interet||""];
      if(oa!==ob) return oa-ob;
      if(a.relance&&b.relance)return a.relance<b.relance?-1:1;
      if(a.relance)return -1;
      if(b.relance)return 1;
      return 0;
    });

  // Annonce automatique sur le Wall of Fame quand un nouveau badge est débloqué
  useEffect(()=>{
    if(!loaded) return;
    const unlockedIds = badges.filter(b=>b.unlocked).map(b=>b.id);
    if(unlockedIds.length===0) return;
    sg(uid,"db-badges-unlocked").then(stored=>{
      const prevRaw = stored ? JSON.parse(stored) : [];
      const prev = Array.isArray(prevRaw) ? prevRaw : Object.values(prevRaw||{});
      const nouveaux = unlockedIds.filter(id=>!prev.includes(id));
      if(nouveaux.length>0){
        nouveaux.forEach(id=>{
          const b = BADGES_DEF.find(x=>x.id===id);
          if(b) postToWallOfFame(uid, userName, `vient de débloquer le badge ${b.icon} "${b.label}" !`, "🏅");
        });
        ss(uid,"db-badges-unlocked",JSON.stringify(unlockedIds));
      } else if(unlockedIds.length!==prev.length){
        ss(uid,"db-badges-unlocked",JSON.stringify(unlockedIds));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[loaded, badges.filter(b=>b.unlocked).map(b=>b.id).join(",")]);

  const STATUTS=["Nouveau","Contact fait","🔥 Chaud","🌡️ Tiède","❄️ Froid","📅 Invité présentation","👀 En réflexion","✅ Converti","❌ Pas intéressé"];
  const statusColor={"Nouveau":C.gris,"Contact fait":C.lilas,"🔥 Chaud":"#C44B1A","🌡️ Tiède":C.or,"❄️ Froid":"#5B8DB8","📅 Invité présentation":C.rose,"👀 En réflexion":"#8B5E00","✅ Converti":C.vert,"❌ Pas intéressé":"#B04040"};

  const {t} = useLang();
  const DTABS=[
    {id:"today",        label:"⚡ Aujourd'hui"},
    // Fast Start — visible seulement si assigné ET pas encore terminé
    ...((hasFastStart&&!fastStartDone)?[{id:"faststart",label:"🚀 Fast Start"}]:[]),
    {id:"objperso",     label:"🎯 Objectifs"},
    {id:"clients",      label:"🛍️ Clients"},
    {id:"distributeurs",label:"👑 Distributeurs"},
    {id:"prospects",    label:"👥 Prospects"},
    // Suivi CA — visible seulement pour les chefs
    {id:"relances",label:"🔔 Relances"},
    {id:"editorial",label:"✍️ Éditorial"},{id:"business",label:"📊 Business"},
    {id:"diagnostics",  label:"🩺 Diagnostics"},
    
    {id:"equipe-fun",   label:"🏆 Équipe"},
  ];

  return(
    <div>
      <SecTitle title="Tableau" em="de bord" desc="Tes actions quotidiennes · Tes prospects · Tes publications · Tes stats."/>

      {/* Sub-nav */}
      <div style={{display:"flex",gap:".3rem",marginBottom:"1rem",overflowX:"auto",paddingBottom:".3rem"}}>
        {DTABS.map(t=>(
          <button key={t.id} onClick={()=>setDtab(t.id)}
            style={{flex:"none",padding:".5rem .9rem",fontSize:".68rem",fontWeight:600,borderRadius:20,border:`1px solid ${dtab===t.id?C.rose:C.pale}`,background:dtab===t.id?C.rose:C.blanc,color:dtab===t.id?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",transition:"all .2s"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* FAST START J1-J7 */}
      {dtab==="faststart"&&<FastStartTab uid={uid} userName={userName} goToFormation={goToFormation}/>}

      {/* TODAY */}
      {dtab==="today"&&(
        <div>
          <Confetti trigger={confettiTrigger}/>
          <MarrainePopup uid={uid} userName={userName}/>
          <AnnonceBanner uid={uid}/>

          {/* POPUP CONVERSION PROSPECT */}
          {conversionPopup&&(
            <ConversionPopup
              prospect={conversionPopup.prospect}
              clients={clients}
              distributeurs={distributeurs}
              saveClients={saveClients}
              saveDistributeurs={saveDistributeurs}
              saveProspects={saveProspects}
              prospects={prospects}
              onClose={()=>setConversionPopup(null)}
            />
          )}
          {aRecontacterAujourdhui.length>0&&(
            <div onClick={()=>setDtab("prospects")}
              style={{background:"linear-gradient(135deg,#C44B1A,#C49A8A)",borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem",cursor:"pointer"}}>
              <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"white",marginBottom:".3rem"}}>📞 À recontacter aujourd'hui</div>
              <div style={{fontSize:".78rem",color:"white",fontWeight:600}}>
                {aRecontacterAujourdhui.length} prospect{aRecontacterAujourdhui.length>1?"s":""} : {aRecontacterAujourdhui.slice(0,3).map(p=>p.name).join(", ")}{aRecontacterAujourdhui.length>3?"...":""}
              </div>
              <div style={{fontSize:".62rem",color:"rgba(255,255,255,.85)",marginTop:".2rem"}}>Touche pour voir tes prospects →</div>
            </div>
          )}
          {anniversairesProches.length>0&&(
            <div onClick={()=>setDtab("clients")}
              style={{background:"linear-gradient(135deg,#C49A8A,#E8B4A8)",borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem",cursor:"pointer"}}>
              <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"white",marginBottom:".3rem"}}>🎂 Anniversaires à venir</div>
              {anniversairesProches.slice(0,3).map(c=>(
                <div key={c.id} style={{fontSize:".75rem",color:"white",fontWeight:600,marginBottom:".15rem"}}>
                  {c.joursAvant===0?"🎉 Aujourd'hui":c.joursAvant===1?"Demain":`Dans ${c.joursAvant}j`} — {c.prenom} {c.nom}
                </div>
              ))}
              <div style={{fontSize:".62rem",color:"rgba(255,255,255,.85)",marginTop:".2rem"}}>Touche pour voir tes clientes →</div>
            </div>
          )}
          <AssistanteIATab uid={uid} userName={userName}/>
          <JaugeSucces pctCA={pctCAGauge} pctRecrues={pctRecruesGauge}/>
          <BadgesPanel badges={badges}/>
          {streak>=2&&(
            <div style={{display:"flex",alignItems:"center",gap:".4rem",background:"rgba(196,168,130,.15)",border:`1px solid ${C.or}40`,borderRadius:10,padding:".5rem .8rem",marginBottom:"1rem",fontSize:".72rem",color:C.brun}}>
              <span style={{fontSize:"1.1rem"}}>🔥</span>
              <span><strong>{streak} jours</strong> de connexion d'affilée — continue comme ça !</span>
            </div>
          )}
          <CitationDuJour uid={uid}/>
          <DreamBoardWidget uid={uid}/>
          {showBiblio&&<BiblioActionsPopup
            onClose={()=>setShowBiblio(false)}
            actionsCustom={actionsCustom}
            onAjouter={(a)=>{
              if(!actionsCustom.some(x=>x.id===a.id)){
                setActionsCustom(prev=>[...prev,a]);
              }
            }}
          />}

          <div style={{background:C.brun,borderRadius:14,padding:"1.1rem",marginBottom:"1rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".4rem"}}>
              <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".15em",textTransform:"uppercase",color:C.or}}>
                ⚡ MES ACTIONS DU JOUR
              </div>
              <button onClick={()=>setShowBiblio(true)}
                style={{background:C.or+"25",border:`1px solid ${C.or}50`,borderRadius:8,padding:".2rem .55rem",fontSize:".62rem",fontWeight:700,color:C.or,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                + Actions
              </button>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:".62rem",color:C.pale,marginBottom:".35rem"}}>
              <span>Progression</span><span style={{fontWeight:700,color:doneCount===totalActions?C.vert:C.or}}>{doneCount} / {totalActions}</span>
            </div>
            <div style={{height:5,background:"rgba(255,255,255,.1)",borderRadius:10,overflow:"hidden",marginBottom:".75rem"}}>
              <div style={{height:"100%",background:doneCount===totalActions?C.vert:C.rose,width:(doneCount/Math.max(totalActions,1)*100)+"%",borderRadius:10,transition:"width .3s"}}/>
            </div>
            {displayedActions.map(a=>(
              <div key={a.id} onClick={()=>saveActions({...actions,[a.id]:!actions[a.id]}, !actions[a.id])}
                style={{display:"flex",gap:".65rem",padding:".6rem 0",borderBottom:`1px solid rgba(196,154,138,.2)`,cursor:"pointer",alignItems:"flex-start"}}>
                <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${actions[a.id]?C.rose:C.pale+"80"}`,background:actions[a.id]?C.rose:"transparent",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
                  {actions[a.id]&&<span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:".78rem",fontWeight:600,color:actions[a.id]?C.gris:C.blanc,textDecoration:actions[a.id]?"line-through":"none"}}>{a.icon} {a.label}</div>
                  <div style={{fontSize:".65rem",color:C.pale,opacity:.7,marginTop:".1rem"}}>{a.sub}</div>
                </div>
              </div>
            ))}
          </div>


          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>🔄 Réactivation base existante</div>
            <p style={{fontSize:".75rem",color:C.texte,lineHeight:1.65}}>Contacter 10 anciens silencieux cette semaine.</p>
            <div style={{background:C.creme,borderLeft:`3px solid ${C.lilas}`,borderRadius:"0 8px 8px 0",padding:".5rem .75rem",fontSize:".73rem",fontStyle:"italic",color:C.texte,lineHeight:1.7,marginTop:".5rem"}}>
              "Coucou, ça fait longtemps ! Comment tu vas ?"
              <CopyBtn text="Coucou, ça fait longtemps ! Comment tu vas ?"/>
            </div>
          </div>

          <TodoPerso uid={uid}/>
          <ClassementEquipe uid={uid}/>

          {/* Compteur commandes période */}
          <CmdPeriodeBlock cmdPeriode={cmdPeriode}/>

          <div style={{background:`linear-gradient(135deg,rgba(196,154,138,.1),rgba(196,168,130,.08))`,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem 1rem",textAlign:"center"}}>
            <div style={{fontSize:".75rem",color:C.brun,fontStyle:"italic",lineHeight:1.65}}>
              💡 <strong>"Posts = attirer. Actions quotidiennes = convertir.<br/>Les deux ensemble, c'est là que ça décolle."</strong>
            </div>
          </div>
        </div>
      )}

      {/* PROSPECTS */}
      {dtab==="prospects"&&(
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:".6rem"}}><button onClick={()=>setShowNotice(true)} style={{background:"#C49A8A",color:"white",border:"none",borderRadius:20,padding:".35rem 1rem",fontSize:".75rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(196,154,138,.4)"}}>❓ Guide</button></div>{showNotice&&<NoticePanel cleOutil="prospects" onClose={()=>setShowNotice(false)} videoUrl={noticeVideos["prospects"]||""}/>}
          <button onClick={async()=>{
            try{
              const snap=await getDoc(doc(db,"users",uid));
              if(snap.exists()&&snap.data()["db-prospects"]){
                const liste=JSON.parse(snap.data()["db-prospects"]);
                setProspects(liste);
                alert(`✅ ${liste.length} prospects chargés (dont ${liste.filter(p=>p.source==="recommandation").length} recommandations)`);
              } else {
                alert("Aucun prospect trouvé dans Firebase pour ce compte.");
              }
            }catch(e){alert("Erreur : "+e.message);}
          }}
            style={{width:"100%",background:C.creme,border:`1px solid ${C.pale}`,borderRadius:9,padding:".4rem",fontSize:".68rem",fontWeight:600,color:C.brun,fontFamily:"inherit",cursor:"pointer",marginBottom:".6rem"}}>
            🔄 Rafraîchir (pour voir les nouvelles recommandations)
          </button>
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".65rem"}}>➕ Ajouter un prospect ({prospects.length})</div>
            <input placeholder="Prénom" value={newP.name} onChange={e=>setNewP(p=>({...p,name:e.target.value}))}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .7rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".45rem"}}/>
            <select value={newP.statut} onChange={e=>setNewP(p=>({...p,statut:e.target.value}))}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .7rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".45rem"}}>
              {STATUTS.map(s=><option key={s}>{s}</option>)}
            </select>
            <select value={newP.interet} onChange={e=>setNewP(p=>({...p,interet:e.target.value}))}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .7rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".45rem"}}>
              <option value="">Intérêt : non défini</option>
              <option value="client">🛍️ Intéressée par les produits (cliente)</option>
              <option value="distributeur">👑 Intéressée par l'activité (distributrice)</option>
            </select>
            <input placeholder="Note (optionnel)" value={newP.note} onChange={e=>setNewP(p=>({...p,note:e.target.value}))}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .7rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".65rem"}}/>
            <button onClick={()=>{
              if(!newP.name.trim())return;
              const next=[{...newP,id:Date.now(),date:new Date().toLocaleDateString("fr-FR"),relance:""},...prospects];
              saveProspects(next);setNewP({name:"",statut:"Nouveau",note:"",interet:""});
            }} style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".55rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              Ajouter le prospect
            </button>
          </div>

          {/* Navigation par dossier : Clients potentiels / Distributeurs potentiels / Non classé */}
          {!prospectInteretFiltre&&(
            <div>
              <div style={{fontSize:".68rem",color:C.gris,marginBottom:".6rem"}}>Choisis une catégorie pour voir tes prospects :</div>
              {[
                ["client","🛍️ Clients potentiels",C.rose],
                ["distributeur","👑 Distributeurs potentiels",C.lilas],
                
                ["recommandation","🤝 Recommandations",C.gris],
              ].map(([val,label,col])=>{
                const count = val==="recommandation"
                  ?prospects.filter(p=>p.source==="recommandation"||p.interet==="Recommandation").length
                  :prospects.filter(p=>p.interet===val).length;
                return(
                  <div key={val} onClick={()=>setProspectInteretFiltre(val)}
                    style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".8rem 1rem",marginBottom:".5rem",cursor:"pointer"}}>
                    <div style={{fontFamily:"Georgia,serif",fontSize:".95rem",fontWeight:600,color:C.brun}}>{label}</div>
                    <div style={{display:"flex",alignItems:"center",gap:".4rem"}}>
                      <span style={{fontSize:".7rem",fontWeight:700,color:col,background:col+"15",borderRadius:20,padding:".15rem .6rem"}}>{count}</span>
                      <span style={{color:C.pale}}>›</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {prospectInteretFiltre&&(
          <div>
          <button onClick={()=>{setProspectInteretFiltre("");setProspectFiltre("Tous");setProspectSearch("");}}
            style={{background:"none",border:"none",color:C.rose,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:".2rem",marginBottom:".75rem"}}>
            ← Retour aux catégories
          </button>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,color:C.brun,marginBottom:".6rem"}}>
            {prospectInteretFiltre==="client"?"🛍️ Clients potentiels":prospectInteretFiltre==="distributeur"?"👑 Distributeurs potentiels":prospectInteretFiltre==="recommandation"?"🤝 Recommandations":"📌 Non classé"}
          </div>

          {/* Recherche et filtres */}
          <input placeholder="🔍 Rechercher par nom ou note..." value={prospectSearch} onChange={e=>setProspectSearch(e.target.value)}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .7rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".5rem"}}/>
          <div style={{display:"flex",gap:".3rem",marginBottom:".75rem",overflowX:"auto",paddingBottom:".2rem"}}>
            {["🤝 Recommandés","Tous",...STATUTS].map(s=>(
              <button key={s} onClick={()=>{setProspectFiltre(s);setProspectInteretFiltre("");}}
                style={{flex:"none",padding:".3rem .65rem",fontSize:".64rem",fontWeight:600,borderRadius:20,border:`1px solid ${prospectFiltre===s?C.rose:C.pale}`,background:prospectFiltre===s?C.rose:C.blanc,color:prospectFiltre===s?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                {s}
              </button>
            ))}
          </div>

          <div style={{fontSize:".62rem",color:C.gris,marginBottom:".5rem"}}>{prospectsFiltres.length} prospect{prospectsFiltres.length>1?"s":""}{prospectFiltre!=="Tous"||prospectSearch?` (filtré${prospectsFiltres.length>1?"s":""})`:""}</div>
          {prospectsFiltres.map(p=>{
            const isToday = p.relance && p.relance<=todayStr;
            return(
            <div key={p.id} style={{background:isToday?"rgba(196,74,26,.06)":C.blanc,border:`1px solid ${isToday?"#C44B1A60":C.pale}`,borderRadius:10,padding:".7rem .9rem",marginBottom:".45rem"}}>
              <div style={{display:"flex",gap:".65rem",alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:".5rem",alignItems:"center",marginBottom:".2rem",flexWrap:"wrap"}}>
                    <div style={{fontSize:".82rem",fontWeight:600,color:C.brun}}>{p.name}</div>
                    {p.source==="recommandation"&&(
                      <span style={{fontSize:".58rem",fontWeight:700,padding:".1rem .4rem",borderRadius:20,background:C.lilas+"20",color:C.lilas}}>🤝 Recommandé(e)</span>
                    )}
                    <select value={p.statut} onChange={e=>{
                      const next=prospects.map(x=>x.id===p.id?{...x,statut:e.target.value}:x);
                      saveProspects(next);
                    }} style={{fontSize:".6rem",fontWeight:700,padding:".1rem .4rem",borderRadius:20,border:`1px solid ${statusColor[p.statut]||C.pale}`,background:(statusColor[p.statut]||C.gris)+"20",color:statusColor[p.statut]||C.gris,fontFamily:"inherit",cursor:"pointer",outline:"none"}}>
                      {STATUTS.map(s=><option key={s}>{s}</option>)}
                    </select>
                    {isToday&&<span style={{fontSize:".58rem",fontWeight:700,color:"#C44B1A",background:"#C44B1A15",borderRadius:20,padding:".1rem .5rem"}}>📞 À recontacter</span>}
                    <select value={p.interet||""} onChange={e=>{
                      const next=prospects.map(x=>x.id===p.id?{...x,interet:e.target.value}:x);
                      saveProspects(next);
                    }} style={{fontSize:".6rem",fontWeight:600,padding:".1rem .4rem",borderRadius:20,border:`1px solid ${p.interet?C.lilas:C.pale}`,background:p.interet?C.lilas+"15":"transparent",color:p.interet?C.lilas:C.gris,fontFamily:"inherit",cursor:"pointer",outline:"none"}}>
                      <option value="">❔ Non défini</option>
                      <option value="client">🛍️ Cliente</option>
                      <option value="distributeur">👑 Distributrice</option>
                    </select>
                  </div>
                  {p.note&&<div style={{fontSize:".7rem",color:C.gris,fontStyle:"italic"}}>{p.note}</div>}
                  <div style={{fontSize:".6rem",color:C.pale,marginTop:".15rem"}}>Ajouté le {p.date}</div>
                </div>
                <button onClick={()=>saveProspects(prospects.filter(x=>x.id!==p.id))}
                  style={{background:"none",border:"none",color:C.pale,cursor:"pointer",fontSize:".8rem",flexShrink:0,padding:".2rem"}}>✕</button>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:".4rem",marginTop:".5rem",paddingTop:".5rem",borderTop:`1px solid ${C.pale}`}}>
                <span style={{fontSize:".62rem",color:C.gris}}>🔔 Relance :</span>
                <input type="date" value={p.relance||""} onChange={e=>{
                  const next=prospects.map(x=>x.id===p.id?{...x,relance:e.target.value}:x);
                  saveProspects(next);
                }} style={{border:`1px solid ${C.pale}`,borderRadius:6,padding:".25rem .4rem",fontSize:".68rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
                {p.relance&&(
                  <button onClick={()=>{
                    const next=prospects.map(x=>x.id===p.id?{...x,relance:""}:x);
                    saveProspects(next);
                  }} style={{background:"none",border:"none",color:C.gris,cursor:"pointer",fontSize:".62rem",fontFamily:"inherit",textDecoration:"underline"}}>
                    effacer
                  </button>
                )}
              </div>

              {/* Journal conversation */}
              <div style={{marginTop:".5rem",paddingTop:".5rem",borderTop:"1px solid #E8DDD4"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".3rem"}}>
                  <div style={{fontSize:".6rem",fontWeight:700,color:"#3D1F0E",textTransform:"uppercase",letterSpacing:".08em"}}>Journal</div>
                  <button onClick={()=>{const msg=prompt("Message envoyé ou reçu");if(!msg)return;const j=[...(p.journal||[]),{date:new Date().toLocaleDateString("fr-FR"),msg}];saveProspects(prospects.map(x=>x.id===p.id?{...x,journal:j}:x));}} style={{background:"none",border:"1px solid #E8DDD4",borderRadius:6,padding:".15rem .45rem",fontSize:".62rem",color:"#888",cursor:"pointer",fontFamily:"inherit"}}>+ Ajouter</button>
                </div>
                {(p.journal||[]).length===0?<div style={{fontSize:".65rem",color:"#888",fontStyle:"italic"}}>Aucun echange</div>:(p.journal||[]).slice(-3).reverse().map((e,i)=>(<div key={i} style={{display:"flex",gap:".4rem",marginBottom:".2rem"}}><span style={{fontSize:".6rem",color:"#888",flexShrink:0}}>{e.date}</span><span style={{fontSize:".7rem",color:"#3D2B1F"}}>{e.msg}</span></div>))}
              </div>

              {/* Bouton conversion si statut Converti */}
              {p.statut==="✅ Converti"&&(
                <div style={{marginTop:".5rem",paddingTop:".5rem",borderTop:`1px solid ${C.pale}`}}>
                  <button onClick={()=>{
                    saveProspects(prospects.filter(x=>x.id!==p.id));
                    setConversionPopup({prospect:p, vers:null});
                  }}
                    style={{width:"100%",background:`linear-gradient(135deg,${C.vert},#4a9a5a)`,color:"white",border:"none",borderRadius:9,padding:".5rem",fontSize:".76rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:".4rem"}}>
                    ✅ Convertir et transférer →
                  </button>
                </div>
              )}

              {/* Boutons conversion rapide pour diagnostics et recommandations */}
              {(p.source==="diagnostic"||p.source==="recommandation")&&p.statut!=="✅ Converti"&&!p.convertiVers&&(
                <div style={{marginTop:".5rem",paddingTop:".5rem",borderTop:`1px solid ${C.pale}`}}>
                  <div style={{fontSize:".58rem",color:C.gris,marginBottom:".3rem",fontWeight:600}}>
                    {p.source==="diagnostic"?"🔬 Issu d'un diagnostic":"🤝 Issu d'une recommandation"} — Marquer la conversion :
                  </div>
                  <div style={{display:"flex",gap:".3rem"}}>
                    <button onClick={()=>{
                      const next=prospects.map(x=>x.id===p.id?{...x,convertiVers:"client",statut:"✅ Converti",dateConversion:todayLocalStr()}:x);
                      saveProspects(next);
                    }}
                      style={{flex:1,background:C.vert+"20",border:`1px solid ${C.vert}`,borderRadius:8,padding:".35rem",fontSize:".66rem",fontWeight:700,color:C.vert,cursor:"pointer",fontFamily:"inherit"}}>
                      🛍️ Convertie en cliente
                    </button>
                    <button onClick={()=>{
                      const next=prospects.map(x=>x.id===p.id?{...x,convertiVers:"distributrice",statut:"✅ Converti",dateConversion:todayLocalStr()}:x);
                      saveProspects(next);
                    }}
                      style={{flex:1,background:C.or+"20",border:`1px solid ${C.or}`,borderRadius:8,padding:".35rem",fontSize:".66rem",fontWeight:700,color:C.or,cursor:"pointer",fontFamily:"inherit"}}>
                      👑 Convertie en distributrice
                    </button>
                  </div>
                </div>
              )}

              {/* Badge conversion réussie */}
              {p.convertiVers&&(
                <div style={{marginTop:".5rem",paddingTop:".5rem",borderTop:`1px solid ${C.pale}`,display:"flex",alignItems:"center",gap:".4rem"}}>
                  <span style={{fontSize:".65rem",fontWeight:700,color:p.convertiVers==="client"?C.vert:C.or,background:(p.convertiVers==="client"?C.vert:C.or)+"20",borderRadius:20,padding:".2rem .55rem"}}>
                    {p.convertiVers==="client"?"✅ Convertie en cliente":"✅ Convertie en distributrice"}
                  </span>
                  {p.dateConversion&&<span style={{fontSize:".58rem",color:C.gris}}>le {new Date(p.dateConversion).toLocaleDateString("fr-FR")}</span>}
                  <button onClick={()=>{
                    const next=prospects.map(x=>x.id===p.id?{...x,convertiVers:undefined,statut:"Nouveau",dateConversion:undefined}:x);
                    saveProspects(next);
                  }} style={{marginLeft:"auto",background:"none",border:"none",fontSize:".58rem",color:C.gris,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}>annuler</button>
                </div>
              )}
            </div>
          );})}
          {prospectsFiltres.length===0&&<div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".78rem"}}>{prospects.length===0?<>Aucun prospect pour l'instant.<br/>Ajoute ta 1ʳᵉ personne ci-dessus.</>:"Aucun prospect ne correspond à ta recherche/filtre."}</div>}
          </div>
          )}
        </div>
      )}

      {/* PRODUITS */}
      {/* Suppression onglet Produits — remplacé par IA Conseillère */}

      {/* CLIENTS (+ sous-onglet Objections) */}
      {dtab==="clients"&&(
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:".6rem"}}><button onClick={()=>setShowNotice(true)} style={{background:"#C49A8A",color:"white",border:"none",borderRadius:20,padding:".35rem 1rem",fontSize:".75rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(196,154,138,.4)",display:"flex",alignItems:"center",gap:".35rem"}}>❓ Guide</button></div>{showNotice&&<NoticePanel cleOutil="clients" onClose={()=>setShowNotice(false)} videoUrl={noticeVideos["clients"]||""}/>}
          <div style={{display:"flex",gap:".3rem",marginBottom:"1rem"}}>
            <button onClick={()=>setClientsSubTab("clients")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${clientsSubTab==="clients"?C.rose:C.pale}`,background:clientsSubTab==="clients"?C.rose:C.blanc,color:clientsSubTab==="clients"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              🛍️ Clients
            </button>
            <button onClick={()=>setClientsSubTab("relance")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${clientsSubTab==="relance"?"#5B8DB8":C.pale}`,background:clientsSubTab==="relance"?"#5B8DB8":C.blanc,color:clientsSubTab==="relance"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              ❄️ Relance
            </button>
            <button onClick={()=>setClientsSubTab("objections")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${clientsSubTab==="objections"?C.rose:C.pale}`,background:clientsSubTab==="objections"?C.rose:C.blanc,color:clientsSubTab==="objections"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              💬 Objections
            </button>
          </div>
          {clientsSubTab==="clients"&&<ClientsTab clients={clients} save={saveClients} uid={uid}/>}
          {clientsSubTab==="relance"&&<ClientsRelanceTab clients={clients} save={saveClients} uid={uid}/>}
          {clientsSubTab==="objections"&&<ObjectionsTab/>}
        </div>
      )}
      {dtab==="objperso"&&(
        <div>
          <ObjPersoTab obj={objPerso} save={saveObjPerso} uid={uid} userName={userName} distributeurs={distributeurs}/>
        </div>
      )}

      {/* ÉQUIPE - GAMIFICATION */}
      {dtab==="equipe-fun"&&(
        <div>
          <div style={{display:"flex",gap:".3rem",marginBottom:"1rem"}}>
            <button onClick={()=>setEquipeFunTab("wall")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${equipeFunTab==="wall"?C.rose:C.pale}`,background:equipeFunTab==="wall"?C.rose:C.blanc,color:equipeFunTab==="wall"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              🌟 Wall of Fame
            </button>
            <button onClick={()=>setEquipeFunTab("defi")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${equipeFunTab==="defi"?C.rose:C.pale}`,background:equipeFunTab==="defi"?C.rose:C.blanc,color:equipeFunTab==="defi"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              ⚡ Challenge Flash
            </button>
            <button onClick={()=>setEquipeFunTab("powerhour")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${equipeFunTab==="powerhour"?C.rose:C.pale}`,background:equipeFunTab==="powerhour"?C.rose:C.blanc,color:equipeFunTab==="powerhour"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              ⏱️ Power Hour
            </button>
          </div>
          {equipeFunTab==="wall"&&<WallOfFameTab uid={uid} userName={userName}/>}
          {equipeFunTab==="defi"&&<DefisTab uid={uid} userName={userName} canCreate={true} isChef={isChefDash}/>}
          {equipeFunTab==="powerhour"&&<PowerHourTab uid={uid} userName={userName} canCreate={isChefDash||uid===MELISSA||uid==="melissa-da-silveira"}/>}
        </div>
      )}
      {dtab==="editorial"&&<div><div style={{display:"flex",justifyContent:"flex-end",marginBottom:".6rem"}}><button onClick={()=>setShowNotice(true)} style={{background:"#C49A8A",color:"white",border:"none",borderRadius:20,padding:".35rem 1rem",fontSize:".75rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(196,154,138,.4)",display:"flex",alignItems:"center",gap:".35rem"}}>❓ Guide</button></div>{showNotice&&<NoticePanel cleOutil="editorial" onClose={()=>setShowNotice(false)} videoUrl={noticeVideos["editorial"]||""}/>}<EditorialTab uid={uid} userName={userName}/></div>}
      {dtab==="relances"&&<div><div style={{display:"flex",justifyContent:"flex-end",marginBottom:".6rem"}}><button onClick={()=>setShowNotice(true)} style={{background:"#C49A8A",color:"white",border:"none",borderRadius:20,padding:".35rem 1rem",fontSize:".75rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(196,154,138,.4)",display:"flex",alignItems:"center",gap:".35rem"}}>❓ Guide</button></div>{showNotice&&<NoticePanel cleOutil="relances" onClose={()=>setShowNotice(false)} videoUrl={noticeVideos["relances"]||""}/>}<RelancesTab prospects={prospects} clients={clients} saveProspects={saveProspects} saveClients={saveClients}/></div>}
      {dtab==="business"&&(<div><div style={{display:"flex",justifyContent:"flex-end",marginBottom:".6rem"}}><button onClick={()=>setShowNotice(true)} style={{background:"#C49A8A",color:"white",border:"none",borderRadius:20,padding:".35rem 1rem",fontSize:".75rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(196,154,138,.4)"}}>❓ Guide</button></div>{showNotice&&<NoticePanel cleOutil="business" onClose={()=>setShowNotice(false)} videoUrl={noticeVideos["business"]||""}/>}<div style={{display:"flex",gap:".3rem",marginBottom:"1rem",overflowX:"auto"}}>{[{id:"suivica",label:"CA"},{id:"entonnoir",label:"Entonnoir"},{id:"historique",label:"Historique"}].map(t=>(<button key={t.id} onClick={()=>setBtab(t.id)} style={{flex:"none",padding:".4rem .85rem",fontSize:".7rem",fontWeight:600,borderRadius:20,border:"1.5px solid "+(btab===t.id?"#C49A8A":"#E8DDD4"),background:btab===t.id?"#C49A8A":"white",color:btab===t.id?"white":"#888",cursor:"pointer",fontFamily:"inherit"}}>{t.label}</button>))}</div>{btab==="suivica"&&<SuiviCATab uid={uid}/>}
          {btab==="entonnoir"&&<div><div style={{background:"#FAF7F2",borderRadius:10,padding:".65rem .85rem",marginBottom:"1rem",border:"1px solid #E8DDD4",fontSize:".7rem",color:"#3D1F0E",lineHeight:1.6}}><strong>Comment lire l entonnoir ?</strong><br/>Les barres montrent combien de personnes passent d une etape a l autre. P vers C = % de prospects devenus clientes. C vers D = % de clientes qui ont rejoint l equipe. Plus ces taux sont eleves, meilleure est ta conversion.</div><EntonnoirTab prospects={prospects} clients={clients} distributeurs={distributeurs}/></div>}
          {btab==="historique"&&<div><div style={{background:"#FAF7F2",borderRadius:10,padding:".65rem .85rem",marginBottom:"1rem",border:"1px solid #E8DDD4",fontSize:".7rem",color:"#3D1F0E",lineHeight:1.6}}><strong>Comment lire l historique ?</strong><br/>Chaque barre = une periode de 21 jours. La barre la plus longue = ta meilleure periode. Clique sur une periode pour voir le detail des commandes. Si la periode affichee ne correspond pas (ex: P9 au lieu de P8), corrige la date dans Admin - Configuration des Periodes.</div><HistoriquePeriodes uid={uid}/></div>}</div>)}
      {dtab==="diagnostics"&&<DiagResultsTab uid={uid}/>}

      {/* DISTRIBUTEURS (+ sous-onglet Nouveaux Distributeurs) */}
      {dtab==="distributeurs"&&(
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:".6rem"}}><button onClick={()=>setShowNotice(true)} style={{background:"#C49A8A",color:"white",border:"none",borderRadius:20,padding:".35rem 1rem",fontSize:".75rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(196,154,138,.4)"}}>❓ Guide</button></div>{showNotice&&<NoticePanel cleOutil="distributeurs" onClose={()=>setShowNotice(false)} videoUrl={noticeVideos["distributeurs"]||""}/>}
          <div style={{display:"flex",gap:".3rem",marginBottom:"1rem"}}>
            <button onClick={()=>setDistriSubTab("distributeurs")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${distriSubTab==="distributeurs"?C.rose:C.pale}`,background:distriSubTab==="distributeurs"?C.rose:C.blanc,color:distriSubTab==="distributeurs"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              👑 Distributeurs
            </button>
            <button onClick={()=>setDistriSubTab("nouveaux")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${distriSubTab==="nouveaux"?C.rose:C.pale}`,background:distriSubTab==="nouveaux"?C.rose:C.blanc,color:distriSubTab==="nouveaux"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              📋 Nouveaux Distri
            </button>
          </div>
          {distriSubTab==="distributeurs"&&<DistributeursTab distributeurs={distributeurs} save={saveDistributeurs} uid={uid}/>}
          {distriSubTab==="nouveaux"&&<SuiviRecruTab uid={uid} isChef={isChef}/>}
        </div>
      )}

      {/* POSTS */}
      {dtab==="posts_disabled"&&(
        <div>
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".65rem"}}>➕ Planifier un contenu</div>
            <div style={{display:"flex",gap:".5rem",marginBottom:".45rem"}}>
              {["Post","Story","Reel","Live"].map(t=>(
                <button key={t} onClick={()=>setNewPost(p=>({...p,type:t}))}
                  style={{flex:1,padding:".4rem",fontSize:".7rem",fontWeight:600,borderRadius:8,border:`1px solid ${newPost.type===t?C.rose:C.pale}`,background:newPost.type===t?C.rose:C.blanc,color:newPost.type===t?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>
                  {t}
                </button>
              ))}
            </div>
            <input placeholder="Sujet / hook (ex: routine visage à 25€)" value={newPost.sujet} onChange={e=>setNewPost(p=>({...p,sujet:e.target.value}))}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .7rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".65rem"}}/>
            <button onClick={()=>{
              if(!newPost.sujet.trim())return;
              const next=[{...newPost,id:Date.now(),date:new Date().toLocaleDateString("fr-FR"),fait:false},...posts];
              savePosts(next);setNewPost(p=>({...p,sujet:""}));
            }} style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".55rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              Ajouter au planning
            </button>
          </div>

          <div style={{display:"flex",justifyContent:"space-between",fontSize:".62rem",color:C.gris,marginBottom:".5rem"}}>
            <span>{posts.length} contenu{posts.length>1?"s":""} planifié{posts.length>1?"s":""}</span>
            <span style={{color:C.vert}}>{posts.filter(p=>p.fait).length} publié{posts.filter(p=>p.fait).length>1?"s":""}</span>
          </div>
          {posts.map(p=>(
            <div key={p.id} style={{background:p.fait?C.pale+"60":C.blanc,border:`1px solid ${p.fait?C.rose:C.pale}`,borderRadius:10,padding:".65rem .9rem",marginBottom:".4rem",display:"flex",gap:".6rem",alignItems:"center"}}>
              <div onClick={()=>savePosts(posts.map(x=>x.id===p.id?{...x,fait:!x.fait}:x))}
                style={{width:18,height:18,borderRadius:4,border:`2px solid ${p.fait?C.rose:C.pale}`,background:p.fait?C.rose:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all .15s"}}>
                {p.fait&&<span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>}
              </div>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:".4rem",alignItems:"center"}}>
                  <span style={{fontSize:".58rem",fontWeight:700,background:C.rose+"20",color:C.rose,padding:".1rem .35rem",borderRadius:10}}>{p.type}</span>
                  <div style={{fontSize:".77rem",fontWeight:600,color:p.fait?C.gris:C.brun,textDecoration:p.fait?"line-through":"none"}}>{p.sujet}</div>
                </div>
                <div style={{fontSize:".6rem",color:C.pale,marginTop:".1rem"}}>{p.date}</div>
              </div>
              <button onClick={()=>savePosts(posts.filter(x=>x.id!==p.id))}
                style={{background:"none",border:"none",color:C.pale,cursor:"pointer",fontSize:".8rem",flexShrink:0,padding:".2rem"}}>✕</button>
            </div>
          ))}
          {posts.length===0&&<div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".78rem"}}>Aucun contenu planifié.<br/>Ajoute ton prochain post ci-dessus.</div>}
        </div>
      )}

      {/* STATS */}
      {dtab==="stats"&&(
        <div>
          <button onClick={()=>setDtab("objperso")}
            style={{background:"none",border:"none",color:C.rose,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:".2rem",marginBottom:".75rem"}}>
            ← Retour à Mes Objectifs
          </button>
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".65rem"}}>🎯 Mon objectif du mois</div>
            <div style={{display:"flex",alignItems:"center",gap:".7rem"}}>
              <input type="number" min="1" value={stats.objectif} onChange={e=>saveStats({...stats,objectif:e.target.value})}
                style={{width:55,fontFamily:"Georgia,serif",fontSize:"1.8rem",fontWeight:600,color:C.brun,border:`1px solid ${C.pale}`,borderRadius:8,textAlign:"center",outline:"none",background:C.creme,padding:".2rem"}}/>
              <div style={{fontSize:".78rem",color:C.gris}}>nouvelle{+stats.objectif>1?"s":""} recrue{+stats.objectif>1?"s":""} ce mois</div>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".55rem",marginBottom:"1rem"}}>
            {[
              ["messages","Messages envoyés",C.lilas],
              ["reponses","Réponses reçues",C.or],
              ["presentations","Présentations",C.rose],
              ["ventes","Ventes",C.vert],
              ["recrues","Nouvelles recrues",C.brun],
            ].map(([k,l,col])=>(
              <div key={k} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".7rem",textAlign:"center",gridColumn:k==="recrues"?"1 / -1":"auto"}}>
                <input type="number" min="0" value={stats[k]||""} placeholder="0" onChange={e=>saveStats({...stats,[k]:e.target.value})}
                  style={{width:60,fontFamily:"Georgia,serif",fontSize:"1.8rem",fontWeight:600,color:col,border:"none",background:"none",textAlign:"center",outline:"none"}}/>
                <div style={{fontSize:".62rem",color:C.gris,marginTop:".15rem"}}>{l}</div>
              </div>
            ))}
          </div>

          <div style={{background:`linear-gradient(135deg,rgba(196,154,138,.1),rgba(168,155,181,.07))`,border:`1px solid ${C.pale}`,borderRadius:10,padding:".85rem 1rem",marginBottom:"1rem",fontSize:".74rem",color:C.texte,lineHeight:1.65}}>
            📐 <strong>Ratio cible :</strong> 10 messages → 5 réponses → 3 présentations → 1 recrue.<br/>
            Volume insuffisant → plus de contacts. Réponses mais pas de recrues → retravailler le pitch.
          </div>

          {/* Progress bar objectif */}
          {stats.recrues&&stats.objectif&&(
            <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem"}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:".7rem",color:C.gris,marginBottom:".4rem"}}>
                <span>Progression vers l'objectif</span>
                <span style={{fontWeight:700,color:+stats.recrues>=+stats.objectif?C.vert:C.rose}}>{stats.recrues} / {stats.objectif}</span>
              </div>
              <div style={{height:8,background:C.pale,borderRadius:10,overflow:"hidden"}}>
                <div style={{height:"100%",background:+stats.recrues>=+stats.objectif?C.vert:C.rose,width:Math.min(100,Math.round(+stats.recrues/+stats.objectif*100))+"%",borderRadius:10,transition:"width .4s"}}/>
              </div>
              {+stats.recrues>=+stats.objectif&&<div style={{textAlign:"center",fontSize:".75rem",color:C.vert,fontWeight:700,marginTop:".5rem"}}>🎉 Objectif atteint !</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { DashboardTab };
