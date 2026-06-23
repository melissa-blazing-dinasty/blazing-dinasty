import { useState, useEffect } from 'react';
import { db, storage } from './firebase';
import { doc, getDoc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

import { ss, sg, sgAll, syncAnnuaire, getPeriodeInfo, getPeriodeActuelle, getPeriodeDebut, fmtPLabel, GrilleJoursCA, MembreStatsCard, ChallengeAppSuiviTab, ActionsBiblioChefTab, MembresTab, AssiduiteTab, DefisTab, PowerHourTab, SuiviRecruTab, MessageEquipePopup, MessagesRecusPopup, AdminFormationProduits, UploadPhoto, ESPACE_CHEF_SECTIONS, PERIODE_DUREE_JOURS, PERIODES_PAR_AN, PERIODE_DEBUT_ABSOLU_MS, FAST_START_DAYS, CITATIONS_DEFAULT, ANTHROPIC_API_KEY } from './App';
import { todayLocalStr } from './utils';
import { buildEquipeTree, countEquipeSafe, getLigneeChefs, translateBatch, C, APP_VERSION } from './components';

function StatsEquipeTab({uid, annuaire}){
  const[stats,setStats]=useState(null);
  const[loading,setLoading]=useState(true);
  const[periode,setPeriode]=useState("30j");
  const[rechercheMembre,setRechercheMembre]=useState("");

  const fmt=(n,dec=0)=>typeof n==="number"?n.toFixed(dec):"-";
  const pct=(a,b)=>b>0?Math.round((a/b)*100):0;

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try{
        const membres=Object.entries(annuaire||{});
        if(!membres.length){setLoading(false);return;}

        const today=new Date();
        const cutoffJours=periode==="7j"?7:periode==="30j"?30:90;
        const cutoff=new Date(today-cutoffJours*24*60*60*1000).toISOString().slice(0,10);

        // Charger les données de chaque membre en parallèle
        const snapshots=await Promise.all(
          membres.map(([mUid])=>getDoc(doc(db,"users",mUid)).catch(()=>null))
        );

        let totalMembres=membres.length;
        let actifs=0;
        let streakTotal=0;
        let totalDiags=0;
        let totalDiagsAvecOrd=0;
        let totalProspects=0;
        let totalProspectsDepuisDiag=0;
        let totalConvertisClient=0;
        let totalConvertisDistrib=0;
        let totalClients=0;
        let totalCommandes=0;
        let totalCA=0;
        let totalRecommandations=0;
        let totalRecsConverties=0;
        let totalFastStartDone=0;
        let totalFastStartAssigne=0;
        let totalActions=0;
        let membresAvecDreamboard=0;
        let membresAvecLinkbio=0;
        let membreDetails=[];
        let diagParType={}; // comptage par type

        snapshots.forEach((snap,i)=>{
          if(!snap||!snap.exists())return;
          const d=snap.data();
          const [mUid,mData]=membres[i];

          const lastLogin=d["db-last-login"]||"";
          const estActif=lastLogin>=cutoff;
          if(estActif)actifs++;

          const streak=+d["db-streak"]||0;
          streakTotal+=streak;

          // Diagnostics
          const diags=d["db-diagnostics"]?JSON.parse(d["db-diagnostics"]):[];
          const diagsRecents=diags.filter(dg=>dg.date>=cutoff);
          totalDiags+=diagsRecents.length;
          const diagsAvecOrd=diagsRecents.filter(dg=>dg.ordonnance||dg.ordre);
          totalDiagsAvecOrd+=diagsAvecOrd.length;
          // Compter par type
          diagsRecents.forEach(dg=>{
            if(dg.type) diagParType[dg.type]=(diagParType[dg.type]||0)+1;
          });

          // Prospects
          const prospects=d["db-prospects"]?JSON.parse(d["db-prospects"]):[];
          const prospectsRecents=prospects.filter(p=>p.dateAjout>=cutoff||(p.id&&String(p.id).length===13&&new Date(+p.id)>=new Date(cutoff)));
          totalProspects+=prospectsRecents.length;
          const depuisDiag=prospects.filter(p=>p.source==="diagnostic").length;
          totalProspectsDepuisDiag+=depuisDiag;
          const convertisClient=prospects.filter(p=>p.convertiVers==="client").length;
          const convertisDistrib=prospects.filter(p=>p.convertiVers==="distributrice").length;
          totalConvertisClient+=convertisClient;
          totalConvertisDistrib+=convertisDistrib;

          // Recommandations
          const prospectsRec=prospects.filter(p=>p.source==="recommandation").length;
          totalRecommandations+=prospectsRec;
          totalRecsConverties+=prospects.filter(p=>p.source==="recommandation"&&p.convertiVers).length;

          // Clients et commandes
          const clients=d["db-clients"]?JSON.parse(d["db-clients"]):[];
          totalClients+=clients.length;
          clients.forEach(c=>{
            const cmds=(c.commandes||[]).filter(cmd=>cmd.date>=cutoff);
            totalCommandes+=cmds.length;
            totalCA+=cmds.reduce((s,cmd)=>s+(parseFloat(cmd.montant)||0),0);
          });

          // Fast Start
          const fs=d["db-fast-start"]?JSON.parse(d["db-fast-start"]):null;
          if(fs){
            totalFastStartAssigne++;
            const done=Object.values(fs.modulesValides||{}).filter(Boolean).length;
            if(done>=7)totalFastStartDone++;
          }

          // Actions biblio
          const actions=d["db-actions"]?JSON.parse(d["db-actions"]):{};
          const nbActions=Object.keys(actions).filter(k=>!k.startsWith("_")&&actions[k]).length;
          totalActions+=nbActions;

          // Dream board
          if(d["db-dreamboard"])membresAvecDreamboard++;

          membreDetails.push({
            uid:mUid,
            nom:mData.prenom||mUid.split("-").map(w=>w[0]?.toUpperCase()+w.slice(1)).join(" "),
            actif:estActif,
            lastLogin,
            streak,
            nbDiags:diagsRecents.length,
            nbDiagsAvecOrd:diagsAvecOrd.length,
            nbProspects:prospectsRecents.length,
            nbClients:clients.length,
            nbCommandes:totalCommandes,
            nbFsModules:fs?Object.values(fs.modulesValides||{}).filter(Boolean).length:0,
            fsDone:fs&&Object.values(fs.modulesValides||{}).filter(Boolean).length>=7,
          });
        });

        // Charger les recommandations depuis la collection recommandations
        try{
          const recSnap=await Promise.all(membres.map(([mUid])=>getDoc(doc(db,"recommandations",mUid)).catch(()=>null)));
          recSnap.forEach(s=>{if(s&&s.exists()){totalRecommandations+=(s.data().liste||[]).reduce((sum,r)=>sum+(r.personnes?.length||1),0);}});
        }catch{}

        const tauxUtilisation=pct(actifs,totalMembres);
        const tauxConvDiag=pct(totalProspectsDepuisDiag,totalDiags);
        const tauxConvProspect=pct(totalConvertisClient+totalConvertisDistrib,totalProspects+totalProspectsDepuisDiag);
        const tauxFastStart=pct(totalFastStartDone,totalFastStartAssigne||1);
        const tauxConvRec=pct(totalRecsConverties,totalRecommandations||1);

        setStats({
          totalMembres,actifs,tauxUtilisation,
          streakMoyen:totalMembres?Math.round(streakTotal/totalMembres):0,
          totalDiags,totalDiagsAvecOrd,tauxOrdonnance:pct(totalDiagsAvecOrd,totalDiags||1),
          totalProspects,totalProspectsDepuisDiag,tauxConvDiag,
          totalConvertisClient,totalConvertisDistrib,tauxConvProspect,
          totalClients,totalCommandes,totalCA:Math.round(totalCA),
          totalRecommandations,totalRecsConverties,tauxConvRec,
          totalFastStartAssigne,totalFastStartDone,tauxFastStart,
          totalActions,membresAvecDreamboard,
          diagParType,
          membreDetails:membreDetails.sort((a,b)=>b.nbDiags-a.nbDiags),
          cutoff,periode,
        });
      }catch(e){console.error(e);}
      setLoading(false);
    })();
  },[annuaire,periode]);

  const StatCard=({icon,label,value,sub,color,pctVal})=>(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem .85rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:".25rem"}}>
        <div style={{fontSize:".6rem",color:C.gris,fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>{icon} {label}</div>
        {pctVal!==undefined&&(
          <div style={{fontSize:".65rem",fontWeight:700,color:pctVal>=70?C.vert:pctVal>=40?"#E67E22":"#E74C3C",background:(pctVal>=70?C.vert:pctVal>=40?"#E67E22":"#E74C3C")+"15",borderRadius:20,padding:".1rem .4rem"}}>
            {pctVal}%
          </div>
        )}
      </div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.4rem",fontWeight:600,color:color||C.brun}}>{value}</div>
      {sub&&<div style={{fontSize:".62rem",color:C.gris,marginTop:".1rem"}}>{sub}</div>}
    </div>
  );

  if(loading)return(
    <div style={{textAlign:"center",padding:"2rem",color:C.gris}}>
      <div style={{fontSize:"1.5rem",marginBottom:".5rem"}}>📊</div>
      Analyse en cours...
    </div>
  );

  if(!stats)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Aucune donnée disponible.</div>;

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.3rem",fontWeight:300,color:C.brun,marginBottom:".5rem"}}>
        Statistiques <em style={{fontStyle:"italic",color:C.rose}}>Blazing Dynasty</em>
      </div>

      {/* Sélecteur de période */}
      <div style={{display:"flex",gap:".3rem",marginBottom:"1rem"}}>
        {["7j","30j","90j"].map(p=>(
          <button key={p} onClick={()=>setPeriode(p)}
            style={{flex:1,padding:".38rem",fontSize:".72rem",fontWeight:600,borderRadius:8,border:`1px solid ${periode===p?C.rose:C.pale}`,background:periode===p?C.rose:C.blanc,color:periode===p?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
            {p==="7j"?"7 jours":p==="30j"?"30 jours":"90 jours"}
          </button>
        ))}
      </div>

      {/* SECTION 1 — UTILISATION */}
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".45rem"}}>📱 Utilisation de l'application</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:"1rem"}}>
        <StatCard icon="👥" label="Membres actifs" value={`${stats.actifs}/${stats.totalMembres}`} sub={`Connectées sur les ${periode}`} pctVal={stats.tauxUtilisation} color={C.rose}/>
        <StatCard icon="🔥" label="Streak moyen" value={`${stats.streakMoyen}j`} sub="Jours de connexion consécutifs" color={C.or}/>
        <StatCard icon="⚡" label="Actions biblio" value={stats.totalActions} sub={`Actions validées équipe`} color={C.brun}/>
        <StatCard icon="🌟" label="Dream Boards" value={stats.membresAvecDreamboard} sub={`Membres avec un board actif`} color={C.lilas}/>
      </div>

      {/* SECTION 2 — DIAGNOSTICS */}
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".45rem"}}>🔬 Diagnostics & Ordonnances</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:".65rem"}}>
        <StatCard icon="📋" label="Diagnostics envoyés" value={stats.totalDiags} sub={`Sur les ${periode}`} color={C.brun}/>
        <StatCard icon="✨" label="Ordonnances générées" value={stats.totalDiagsAvecOrd} sub="Diagnostics avec résultat IA" pctVal={stats.tauxOrdonnance} color={C.rose}/>
        <StatCard icon="👤" label="Prospects créés / diag" value={stats.totalProspectsDepuisDiag} sub="Fiches créées depuis un diagnostic" color={C.or}/>
        <StatCard icon="🔄" label="Taux diag → prospect" value={`${stats.tauxConvDiag}%`} sub="Diagnostic converti en fiche" color={stats.tauxConvDiag>=30?C.vert:"#E67E22"}/>
      </div>

      {/* Classement diagnostics les plus utilisés */}
      {stats.diagParType&&Object.keys(stats.diagParType).length>0&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem .85rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".62rem",fontWeight:700,color:C.brun,marginBottom:".5rem"}}>🏆 Diagnostics les plus utilisés</div>
          {Object.entries(stats.diagParType)
            .sort((a,b)=>b[1]-a[1])
            .slice(0,8)
            .map(([type,count],i)=>{
              const max=Object.values(stats.diagParType).reduce((a,b)=>Math.max(a,b),1);
              const label={skincare:"✨ Skincare",makeup:"💄 Makeup",peaucorps:"🧴 Peau Corps",cheveux:"💇 Cheveux",sante:"💊 Santé",silhouette:"⚖️ Silhouette",detox:"🌿 Détox",antiage:"🌸 Anti-Âge",budget:"💡 Budget Beauté",recrutement:"🤝 Recrutement",complementrevenu:"💰 Revenu +",entrepreneuriat:"🚀 Entrepreneur",valeurmarche:"💼 Valeur marché",chargementale:"🧠 Charge Mentale",libertefin:"🏖️ Liberté Fin.",maman:"🌸 Maman",reconversion:"🔄 Reconversion",confianceensoi:"💪 Confiance",reseauxsociaux2:"📲 Audit Digital",blocage:"🔓 Recrue bloquée",pasrecruiter:"😓 Non recrutement",pasvendre:"💸 Non ventes",reseaux:"📱 Réseaux"}[type]||type;
              return(
                <div key={type} style={{marginBottom:".4rem"}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:".68rem",marginBottom:".1rem"}}>
                    <span style={{color:C.brun,fontWeight:i<3?700:400}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":""} {label}</span>
                    <span style={{color:C.gris,fontWeight:600}}>{count}</span>
                  </div>
                  <div style={{height:5,background:C.pale,borderRadius:10,overflow:"hidden"}}>
                    <div style={{height:"100%",background:i<3?C.rose:C.gris+"60",borderRadius:10,width:`${Math.round((count/max)*100)}%`,transition:"width .3s"}}/>
                  </div>
                </div>
              );
            })
          }
        </div>
      )}

      {/* SECTION 3 — CONVERSION PROSPECTS */}
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".45rem"}}>🎯 Prospects & Conversion</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:"1rem"}}>
        <StatCard icon="👥" label="Total prospects" value={stats.totalProspects} sub={`Ajoutés sur les ${periode}`} color={C.brun}/>
        <StatCard icon="✅" label="Taux de conversion" value={`${stats.tauxConvProspect}%`} sub={`${stats.totalConvertisClient} clientes · ${stats.totalConvertisDistrib} distribs`} pctVal={stats.tauxConvProspect} color={C.vert}/>
        <StatCard icon="🛍️" label="Clientes totales" value={stats.totalClients} sub="Dans toutes les fiches" color={C.rose}/>
        <StatCard icon="📦" label="Commandes enregistrées" value={stats.totalCommandes} sub={`CA estimé: ${stats.totalCA}€`} color={C.or}/>
      </div>

      {/* SECTION 4 — RECOMMANDATIONS */}
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".45rem"}}>🤝 Système de recommandation</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:"1rem"}}>
        <StatCard icon="📨" label="Recommandations reçues" value={stats.totalRecommandations} sub="Personnes recommandées par clientes" color={C.lilas}/>
        <StatCard icon="🔁" label="Taux conversion recs" value={`${stats.tauxConvRec}%`} sub="Recommandations devenues prospects" pctVal={stats.tauxConvRec} color={C.vert}/>
      </div>

      {/* SECTION 5 — FAST START */}
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".45rem"}}>🚀 Onboarding Fast Start</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:"1rem"}}>
        <StatCard icon="📚" label="Fast Start assignés" value={stats.totalFastStartAssigne} sub="Nouvelles avec parcours actif" color={C.brun}/>
        <StatCard icon="🏁" label="Fast Start terminés" value={stats.totalFastStartDone} sub="7 modules validés" pctVal={stats.tauxFastStart} color={C.vert}/>
      </div>

      {/* SCORE GLOBAL */}
      {(()=>{
        const score=Math.round((stats.tauxUtilisation*0.3)+(stats.tauxOrdonnance*0.2)+(stats.tauxConvProspect*0.25)+(stats.tauxFastStart*0.25));
        const couleur=score>=70?C.vert:score>=45?"#E67E22":"#E74C3C";
        return(
          <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:14,padding:"1rem 1.1rem",marginBottom:"1rem",textAlign:"center"}}>
            <div style={{fontSize:".62rem",color:C.or,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".3rem"}}>⚡ Score global Blazing Dynasty</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"2.5rem",fontWeight:700,color:couleur}}>{score}<span style={{fontSize:"1.2rem",color:"rgba(255,255,255,.6)"}}>/100</span></div>
            <div style={{fontSize:".68rem",color:"rgba(255,255,255,.7)",marginTop:".2rem"}}>
              {score>=70?"🔥 Équipe très engagée — excellent levier de recrutement !":score>=45?"⚡ Bonne dynamique — encore des axes de progression":score>0?"💡 Potentiel à débloquer — concentre-toi sur l'engagement":""}
            </div>
          </div>
        );
      })()}

      {/* PHRASE RECRUTEMENT */}
      <div style={{background:C.creme,borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem",border:`1px solid ${C.or}40`}}>
        <div style={{fontSize:".62rem",fontWeight:700,color:C.or,marginBottom:".35rem"}}>💬 Phrase toute prête pour recruter</div>
        <div style={{fontSize:".74rem",color:C.brun,lineHeight:1.7,fontStyle:"italic"}}>
          "Dans mon équipe, {stats.tauxUtilisation}% des distributrices utilisent l'outil de gestion que j'ai mis en place. Elles ont réalisé {stats.totalDiags} diagnostics clients ce mois, généré {stats.totalDiagsAvecOrd} ordonnances personnalisées, et converti {stats.tauxConvProspect}% de leurs prospects en clientes ou distributrices. C'est pas juste du MLM — c'est une vraie structure qui marche."
        </div>
        <button onClick={()=>{
          const texte=`"Dans mon équipe, ${stats.tauxUtilisation}% des distributrices utilisent l'outil de gestion que j'ai mis en place. Elles ont réalisé ${stats.totalDiags} diagnostics clients ce mois, généré ${stats.totalDiagsAvecOrd} ordonnances personnalisées, et converti ${stats.tauxConvProspect}% de leurs prospects en clientes ou distributrices. C'est pas juste du MLM — c'est une vraie structure qui marche."`;
          navigator.clipboard?.writeText(texte);
          alert("✅ Copié !");
        }}
          style={{width:"100%",background:C.or,color:"white",border:"none",borderRadius:8,padding:".42rem",fontSize:".72rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginTop:".5rem"}}>
          📋 Copier cette phrase
        </button>
      </div>

      {/* TABLEAU MEMBRE PAR MEMBRE */}
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".45rem"}}>👥 Détail par membre</div>
      <input
        placeholder="🔍 Rechercher un membre..."
        value={rechercheMembre}
        onChange={e=>setRechercheMembre(e.target.value)}
        style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:9,padding:".45rem .7rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".5rem"}}
      />
      {stats.membreDetails.filter(m=>m.nom.toLowerCase().includes(rechercheMembre.toLowerCase())).map((m,i)=>(
        <div key={i} style={{background:m.actif?C.blanc:C.creme,border:`1px solid ${m.actif?C.pale:"transparent"}`,borderRadius:10,padding:".55rem .75rem",marginBottom:".35rem",opacity:m.actif?1:.7}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".2rem"}}>
            <div style={{display:"flex",alignItems:"center",gap:".4rem"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:m.actif?C.rose+"25":"#ccc",color:m.actif?C.rose:"#aaa",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".75rem",fontWeight:700,flexShrink:0}}>
                {m.nom[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{fontSize:".74rem",fontWeight:600,color:C.brun}}>{m.nom}</div>
                <div style={{fontSize:".58rem",color:m.actif?C.vert:C.gris}}>{m.actif?"✅ Active":"⬜ Inactive"} · {m.streak}🔥</div>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:".62rem",color:C.gris}}>🔬 {m.nbDiags} diag · 👤 {m.nbProspects} prospects</div>
              <div style={{fontSize:".6rem",color:C.gris}}>🛍️ {m.nbClients} clientes · {m.fsDone?"🏁 FS ✓":"📚 FS "+m.nbFsModules+"/7"}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SuiviCATab({uid}){
  const raw = getPeriodeInfo();
  const[periodeOverride,setPeriodeOverride]=useState(null);
  const[editPeriodeNum,setEditPeriodeNum]=useState(false);
  const[inputPeriodeNum,setInputPeriodeNum]=useState("");
  const pCourante = periodeOverride || raw.periodNum || getPeriodeActuelle();
  const joursEcoules = periodeOverride ? 21 : Math.min(21, Math.max(1, 21 - (raw.daysLeft||0)));

  const[data,setData]=useState({});
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState(false);

  // Colonnes comparaison libres
  const[compareA,setCompareA]=useState(pCourante-1>0?pCourante-1:1);
  const[compareB,setCompareB]=useState(pCourante-PERIODES_PAR_AN>0?pCourante-PERIODES_PAR_AN:1);
  const[editColA,setEditColA]=useState(false);
  const[editColB,setEditColB]=useState(false);
  const[inputA,setInputA]=useState(String(pCourante-1>0?pCourante-1:1));
  const[inputB,setInputB]=useState(String(pCourante-PERIODES_PAR_AN>0?pCourante-PERIODES_PAR_AN:1));

  // Cellule en cours d'édition
  const[editCell,setEditCell]=useState(null);
  const[editVal,setEditVal]=useState('');

  // Édition total + objectif
  const[editPeriode,setEditPeriode]=useState(null);
  const[editCA,setEditCA]=useState('');
  const[editObj,setEditObj]=useState('');

  // Historique — navigation
  const[histAnnee,setHistAnnee]=useState(new Date().getFullYear());
  const[histPeriodeOuverte,setHistPeriodeOuverte]=useState(null); // num absolu

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,'users',uid));
        if(snap.exists()&&snap.data()['db-suivi-ca'])
          setData(JSON.parse(snap.data()['db-suivi-ca']));
      }catch{}
      setLoading(false);
    })();
  },[uid]);

  const saveData=async(next)=>{
    setSaving(true);
    try{await setDoc(doc(db,'users',uid),{'db-suivi-ca':JSON.stringify(next)},{merge:true});setData(next);}catch{}
    setSaving(false);
  };

  const saveJour=(pNum,idx,val)=>{
    const pKey=`p${pNum}`;
    const cur=data[pKey]||{obj:0,jours:{}};
    const jours={...(cur.jours||{}),[idx]:parseFloat(val)||0};
    // Total = valeur du jour le plus récent rempli (saisie cumulée)
    const joursRemplis=Object.entries(jours).filter(([,v])=>parseFloat(v)>0);
    let ca=0;
    if(joursRemplis.length>0){
      const dernierIdx=Math.max(...joursRemplis.map(([k])=>parseInt(k)));
      ca=parseFloat(jours[dernierIdx])||0;
    }
    saveData({...data,[pKey]:{...cur,jours,ca}});
    setEditCell(null);
  };

  const saveEdit=()=>{
    const pKey=`p${editPeriode}`;
    const cur=data[pKey]||{jours:{}};
    saveData({...data,[pKey]:{...cur,ca:parseFloat(editCA)||0,obj:parseFloat(editObj)||0}});
    setEditPeriode(null);
  };

  const pct=(ca,obj)=>obj?Math.min(100,Math.round((ca||0)/obj*100)):0;
  const fmtDate=(d)=>d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
  const fmtJour=(d)=>d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'});

  if(loading)return <div style={{padding:'2rem',textAlign:'center',color:C.gris,fontSize:'.76rem'}}>Chargement...</div>;

  const dCour=data[`p${pCourante}`]||{ca:0,obj:0,jours:{}};
  const attendu=dCour.obj?Math.round(dCour.obj*joursEcoules/21):0;
  const delta=(dCour.ca||0)-attendu;

  // Grille 21 jours pour une période donnée

  // Années disponibles
  const anneesDispos=[];
  const anneeCourante=getPeriodeDebut(pCourante).getFullYear();
  for(let a=2024;a<=anneeCourante;a++) anneesDispos.push(a);

  // Périodes d'une année donnée (numéros absolus)
  const periodesDeAnnee=(annee)=>{
    const result=[];
    for(let n=-50;n<=pCourante;n++){
      if(n===0) continue;
      try{
        const d=getPeriodeDebut(n);
        const f=new Date(d.getTime()+PERIODE_DUREE_JOURS*24*60*60*1000-1);
        if(d.getFullYear()===annee||f.getFullYear()===annee) result.push(n);
      }catch{}
    }
    return [...new Set(result)].sort((a,b)=>a-b);
  };

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".4rem"}}>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun}}>
          Suivi <em style={{fontStyle:"italic",color:C.rose}}>CA</em>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:".3rem"}}>
          {editPeriodeNum
            ?<div style={{display:"flex",gap:".3rem",alignItems:"center"}}>
              <span style={{fontSize:".62rem",color:C.gris}}>P n°</span>
              <input type="number" autoFocus value={inputPeriodeNum} onChange={e=>setInputPeriodeNum(e.target.value)}
                onBlur={()=>{const v=parseInt(inputPeriodeNum);if(v>0)setPeriodeOverride(v);setEditPeriodeNum(false);}}
                onKeyDown={e=>{if(e.key==="Enter"){const v=parseInt(inputPeriodeNum);if(v>0)setPeriodeOverride(v);setEditPeriodeNum(false);}}}
                style={{width:50,border:`1px solid ${C.rose}`,borderRadius:7,padding:".28rem .4rem",fontSize:".78rem",fontFamily:"inherit",textAlign:"center",outline:"none"}}/>
            </div>
            :<button onClick={()=>{setEditPeriodeNum(true);setInputPeriodeNum(String(pCourante));}}
              style={{background:periodeOverride?"#FFF3CD":"none",border:`1px solid ${periodeOverride?"#E6A817":C.pale}`,borderRadius:7,padding:".2rem .45rem",fontSize:".62rem",color:periodeOverride?"#856404":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              {periodeOverride?`⚠️ P${pCourante} (forcé)`:"+/- Période"}
            </button>
          }
          {periodeOverride&&<button onClick={()=>setPeriodeOverride(null)} title="Revenir à la période actuelle" style={{background:"none",border:"none",color:C.gris,cursor:"pointer",fontSize:".72rem"}}>↩️</button>}
        </div>
      </div>

      {/* Bandeau période courante */}
      <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:12,padding:'.85rem 1rem',marginBottom:'1rem',color:C.blanc}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:'.55rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:C.or}}>{fmtPLabel(pCourante)} · J{joursEcoules}/21</div>
            <div style={{fontFamily:'Georgia,serif',fontSize:'1.3rem',fontWeight:600}}>{dCour.ca||0}€ <span style={{fontSize:'.7rem',fontWeight:400,color:C.pale}}>/ {dCour.obj||'—'}€</span></div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:'.72rem',fontWeight:700,color:delta>=0?C.vert:'#F4A460'}}>{delta>=0?'▲ +':'▼ '}{Math.abs(delta)}€</div>
            <div style={{fontSize:'.58rem',color:C.pale}}>{delta>=0?'en avance':'en retard'} · attendu {attendu}€</div>
            <div style={{fontSize:'.55rem',color:C.pale,marginTop:'.15rem'}}>{raw.daysLeft}j {raw.hoursLeft}h restants</div>
          </div>
        </div>
        <div style={{height:5,background:'rgba(255,255,255,.15)',borderRadius:10,overflow:'hidden',marginTop:'.5rem'}}>
          <div style={{height:'100%',background:C.or,width:pct(dCour.ca,dCour.obj)+'%',borderRadius:10}}/>
        </div>
      </div>

      {/* GRILLE 3 COLONNES */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'.4rem',marginBottom:'1rem'}}>
        {/* Colonne B */}
        <div style={{border:`1.5px solid #88888840`,borderRadius:12,overflow:'hidden'}}>
          <div style={{background:'#f5f5f5',padding:'.35rem .4rem .3rem',borderBottom:'1px solid #88888820',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <button onClick={()=>setCompareB(b=>Math.max(1,b-1))} style={{background:'none',border:'none',color:'#aaa',cursor:'pointer',fontSize:'.85rem',lineHeight:1,padding:0}}>‹</button>
            <span onClick={()=>setEditColB(true)} style={{fontSize:'.55rem',fontWeight:700,color:'#888',cursor:'pointer',textAlign:'center'}}>{editColB?<input type='number' autoFocus value={inputB} onChange={e=>setInputB(e.target.value)} onBlur={()=>{const v=parseInt(inputB);if(v>0)setCompareB(v);setEditColB(false);}} onKeyDown={e=>e.key==='Enter'&&(setCompareB(parseInt(inputB)||1),setEditColB(false))} style={{width:36,border:'1px solid #888',borderRadius:4,fontSize:'.55rem',padding:'.08rem',textAlign:'center',fontFamily:'inherit'}}/>:fmtPLabel(compareB)}</span>
            <button onClick={()=>setCompareB(b=>Math.min(pCourante-1,b+1))} style={{background:'none',border:'none',color:'#aaa',cursor:'pointer',fontSize:'.85rem',lineHeight:1,padding:0}}>›</button>
          </div>
          <GrilleJoursCA pNum={compareB} color='#888' joursEcoules={joursEcoules} data={data} editCell={editCell} editVal={editVal} setEditCell={setEditCell} setEditVal={setEditVal} saveJour={saveJour} setEditPeriode={setEditPeriode} setEditCA={setEditCA} setEditObj={setEditObj}/>
        </div>

        {/* Colonne A */}
        <div style={{border:`1.5px solid ${C.lilas}40`,borderRadius:12,overflow:'hidden'}}>
          <div style={{background:C.lilas+'10',padding:'.35rem .4rem .3rem',borderBottom:`1px solid ${C.lilas}20`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <button onClick={()=>setCompareA(a=>Math.max(1,a-1))} style={{background:'none',border:'none',color:C.lilas,cursor:'pointer',fontSize:'.85rem',lineHeight:1,padding:0}}>‹</button>
            <span onClick={()=>setEditColA(true)} style={{fontSize:'.55rem',fontWeight:700,color:C.lilas,cursor:'pointer',textAlign:'center'}}>{editColA?<input type='number' autoFocus value={inputA} onChange={e=>setInputA(e.target.value)} onBlur={()=>{const v=parseInt(inputA);if(v>0)setCompareA(v);setEditColA(false);}} onKeyDown={e=>e.key==='Enter'&&(setCompareA(parseInt(inputA)||1),setEditColA(false))} style={{width:36,border:`1px solid ${C.lilas}`,borderRadius:4,fontSize:'.55rem',padding:'.08rem',textAlign:'center',fontFamily:'inherit'}}/>:fmtPLabel(compareA)}</span>
            <button onClick={()=>setCompareA(a=>Math.min(pCourante-1,a+1))} style={{background:'none',border:'none',color:C.lilas,cursor:'pointer',fontSize:'.85rem',lineHeight:1,padding:0}}>›</button>
          </div>
          <GrilleJoursCA pNum={compareA} color={C.lilas} joursEcoules={joursEcoules} data={data} editCell={editCell} editVal={editVal} setEditCell={setEditCell} setEditVal={setEditVal} saveJour={saveJour} setEditPeriode={setEditPeriode} setEditCA={setEditCA} setEditObj={setEditObj}/>
        </div>
        {/* Colonne courante */}
        <div style={{border:`1.5px solid ${C.rose}40`,borderRadius:12,overflow:'hidden'}}>
          <GrilleJoursCA pNum={pCourante} color={C.rose} courante={true} joursEcoules={joursEcoules} data={data} editCell={editCell} editVal={editVal} setEditCell={setEditCell} setEditVal={setEditVal} saveJour={saveJour} setEditPeriode={setEditPeriode} setEditCA={setEditCA} setEditObj={setEditObj}/>
        </div>
      </div>

      {/* Formulaire édition total */}
      {editPeriode&&(
        <div style={{background:C.blanc,border:`1px solid ${C.rose}`,borderRadius:12,padding:'1rem',marginBottom:'1rem'}}>
          <div style={{fontSize:'.7rem',fontWeight:700,color:C.brun,marginBottom:'.6rem'}}>✏️ {fmtPLabel(editPeriode)} — {fmtDate(getPeriodeDebut(editPeriode))}</div>
          <div style={{display:'flex',gap:'.5rem',marginBottom:'.6rem'}}>
            <div style={{flex:1}}>
              <div style={{fontSize:'.6rem',color:C.gris,marginBottom:'.2rem'}}>CA total (€)</div>
              <input type='number' value={editCA} onChange={e=>setEditCA(e.target.value)} placeholder='0'
                style={{width:'100%',border:`1px solid ${C.pale}`,borderRadius:8,padding:'.45rem .65rem',fontSize:'.85rem',fontFamily:'inherit',color:C.texte,background:C.creme,outline:'none',fontWeight:700}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:'.6rem',color:C.gris,marginBottom:'.2rem'}}>Objectif (€)</div>
              <input type='number' value={editObj} onChange={e=>setEditObj(e.target.value)} placeholder='0'
                style={{width:'100%',border:`1px solid ${C.pale}`,borderRadius:8,padding:'.45rem .65rem',fontSize:'.85rem',fontFamily:'inherit',color:C.texte,background:C.creme,outline:'none',fontWeight:700}}/>
            </div>
          </div>
          <div style={{display:'flex',gap:'.4rem'}}>
            <button onClick={saveEdit} disabled={saving}
              style={{flex:1,background:C.brun,color:C.blanc,border:'none',borderRadius:8,padding:'.5rem',fontSize:'.78rem',fontWeight:600,fontFamily:'inherit',cursor:'pointer'}}>
              {saving?'Sauvegarde...':'✓ Enregistrer'}
            </button>
            <button onClick={()=>setEditPeriode(null)}
              style={{flex:1,background:C.pale,color:C.gris,border:'none',borderRadius:8,padding:'.5rem',fontSize:'.78rem',fontFamily:'inherit',cursor:'pointer'}}>Annuler</button>
          </div>
        </div>
      )}

      {/* HISTORIQUE — par année puis période */}
      <div style={{marginBottom:'.5rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontSize:'.6rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:C.gris}}>📅 Historique</div>
        <div style={{display:'flex',gap:'.3rem'}}>
          {anneesDispos.map(a=>(
            <button key={a} onClick={()=>{setHistAnnee(a);setHistPeriodeOuverte(null);}}
              style={{padding:'.22rem .55rem',fontSize:'.65rem',fontWeight:600,borderRadius:8,border:`1px solid ${histAnnee===a?C.brun:C.pale}`,background:histAnnee===a?C.brun:C.blanc,color:histAnnee===a?C.blanc:C.gris,cursor:'pointer',fontFamily:'inherit'}}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {periodesDeAnnee(histAnnee).reverse().map(num=>{
        const d3=data[`p${num}`]||{};
        const pc3=pct(d3.ca||0,d3.obj||0);
        const isCourante=num===pCourante;
        const isOuverte=histPeriodeOuverte===num;
        const numAnnee=((num-1)%PERIODES_PAR_AN+PERIODES_PAR_AN)%PERIODES_PAR_AN+1;
        return(
          <div key={num} style={{marginBottom:'.4rem',border:`1.5px solid ${isCourante?C.rose:isOuverte?C.brun:C.pale}`,borderRadius:isOuverte?'12px 12px 0 0':12,overflow:'hidden'}}>
            {/* Ligne de la période */}
            <div onClick={()=>setHistPeriodeOuverte(isOuverte?null:num)}
              style={{display:'flex',alignItems:'center',gap:'.6rem',background:isCourante?C.brun:isOuverte?C.brun+'08':C.blanc,padding:'.5rem .85rem',cursor:'pointer'}}>
              <div style={{width:36,height:36,borderRadius:'50%',background:isCourante?C.or+'30':C.rose+'15',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'.65rem',fontWeight:700,color:isCourante?C.or:C.rose}}>P{numAnnee}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:'.62rem',fontWeight:600,color:isCourante?C.blanc:C.brun}}>{fmtDate(getPeriodeDebut(num))} → {fmtDate(new Date(getPeriodeDebut(num).getTime()+20*24*60*60*1000))}</div>
                <div style={{height:4,background:isCourante?'rgba(255,255,255,.15)':C.pale,borderRadius:10,overflow:'hidden',marginTop:'.2rem'}}>
                  <div style={{height:'100%',background:isCourante?C.or:C.rose,width:pc3+'%',borderRadius:10}}/>
                </div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontFamily:'Georgia,serif',fontSize:'.9rem',fontWeight:700,color:isCourante?C.blanc:C.brun}}>{d3.ca||'—'}{d3.ca?'€':''}</div>
                <div style={{fontSize:'.58rem',color:isCourante?C.pale:C.gris}}>{d3.obj?pc3+'%':''}</div>
              </div>
              <div style={{fontSize:'.75rem',color:isCourante?C.pale:C.gris,transform:isOuverte?'rotate(90deg)':'none',transition:'transform .2s',flexShrink:0}}>›</div>
            </div>

            {/* Grille jour par jour dépliable */}
            {isOuverte&&(
              <div style={{borderTop:`1px solid ${C.pale}`,background:C.blanc}}>
                <div style={{padding:'.5rem .65rem .2rem',background:C.creme,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontSize:'.6rem',color:C.gris}}>Clique sur un jour pour saisir ou modifier</div>
                  <button onClick={()=>{setEditPeriode(num);setEditCA(d3.ca||'');setEditObj(d3.obj||'');}}
                    style={{background:C.brun,color:C.blanc,border:'none',borderRadius:6,padding:'.2rem .5rem',fontSize:'.6rem',fontWeight:600,fontFamily:'inherit',cursor:'pointer'}}>✏️ Total & Obj.</button>
                </div>
                <GrilleJoursCA pNum={num} color={isCourante?C.rose:C.lilas} courante={isCourante} joursEcoules={joursEcoules} data={data} editCell={editCell} editVal={editVal} setEditCell={setEditCell} setEditVal={setEditVal} saveJour={saveJour} setEditPeriode={setEditPeriode} setEditCA={setEditCA} setEditObj={setEditObj}/>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


function ResumeSemaineChef({annuaire}){
  const [resume,setResume]=useState(null);
  const [ouvert,setOuvert]=useState(false);
  useEffect(()=>{
    (async()=>{
      try{
        const membres=Object.entries(annuaire||{});
        if(!membres.length) return;
        const lundi=new Date();lundi.setDate(lundi.getDate()-lundi.getDay()+1);
        const lundiStr=lundi.toISOString().slice(0,10);
        const snaps=await Promise.all(membres.map(([mUid])=>getDoc(doc(db,"users",mUid)).catch(()=>null)));
        let actives=0,diags=0,cmds=0,ca=0,det=[];
        snaps.forEach((snap,i)=>{
          if(!snap?.exists()) return;
          const d=snap.data();const [mUid,mData]=membres[i];
          const nom=mData.prenom||mUid.split("-").map(w=>w[0]?.toUpperCase()+w.slice(1)).join(" ");
          const actif=(d["db-last-login"]||"")>=lundiStr;if(actif)actives++;
          const nd=(d["db-diagnostics"]?JSON.parse(d["db-diagnostics"]):[]).filter(dg=>dg.date>=lundiStr).length;diags+=nd;
          let nc=0,nca=0;
          (d["db-clients"]?JSON.parse(d["db-clients"]):[]).forEach(cl=>{(cl.commandes||[]).filter(cmd=>cmd.date>=lundiStr).forEach(cmd=>{nc++;nca+=parseFloat(cmd.montant)||0;});});
          cmds+=nc;ca+=nca;
          det.push({nom,actif,nd,nc,nca:Math.round(nca)});
        });
        setResume({actives,total:membres.length,diags,cmds,ca:Math.round(ca),det:det.sort((a,b)=>(b.actif?1:0)-(a.actif?1:0)||b.nd-a.nd)});
      }catch{}
    })();
  },[annuaire]);
  if(!resume) return null;
  return(
    <div style={{background:C.brun,borderRadius:14,padding:"1rem 1.1rem",marginBottom:"1rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".65rem"}}>
        <div><div style={{fontSize:".55rem",fontWeight:700,letterSpacing:".15em",color:C.or,marginBottom:".2rem"}}>CETTE SEMAINE</div><div style={{fontFamily:"Georgia,serif",fontSize:"1rem",color:"white",fontWeight:300}}>{resume.actives} active{resume.actives>1?"s":""} / {resume.total}</div></div>
        <button onClick={()=>setOuvert(!ouvert)} style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:8,padding:".3rem .65rem",color:"rgba(255,255,255,.8)",fontSize:".68rem",cursor:"pointer",fontFamily:"inherit"}}>{ouvert?"Fermer":"Détails"}</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:".4rem",marginBottom:ouvert?".75rem":"0"}}>
        {[[resume.diags,"Diagnostics",C.rose],[resume.cmds,"Commandes",C.or],[resume.ca+"EUR","CA",C.vert]].map(([val,label,col])=>(<div key={label} style={{textAlign:"center",background:"rgba(255,255,255,.08)",borderRadius:8,padding:".45rem .3rem"}}><div style={{fontSize:"1.1rem",fontWeight:700,color:col}}>{val}</div><div style={{fontSize:".58rem",color:"rgba(255,255,255,.55)"}}>{label}</div></div>))}
      </div>
      {ouvert&&<div style={{borderTop:"1px solid rgba(255,255,255,.1)",paddingTop:".65rem"}}>
        {resume.det.map((m,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:".6rem",padding:".35rem 0",borderBottom:i<resume.det.length-1?"1px solid rgba(255,255,255,.06)":"none"}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:m.actif?C.vert:"rgba(255,255,255,.2)",flexShrink:0}}/>
          <div style={{flex:1,fontSize:".75rem",color:m.actif?"white":"rgba(255,255,255,.4)",fontWeight:m.actif?600:400}}>{m.nom}</div>
          <div style={{display:"flex",gap:".5rem"}}>
            {m.nd>0&&<span style={{fontSize:".62rem",color:C.rose,fontWeight:600}}>{m.nd} diag</span>}
            {m.nc>0&&<span style={{fontSize:".62rem",color:C.or,fontWeight:600}}>{m.nc} cmd</span>}
            {m.nca>0&&<span style={{fontSize:".62rem",color:C.vert,fontWeight:600}}>{m.nca}EUR</span>}
            {!m.actif&&<span style={{fontSize:".6rem",color:"rgba(255,255,255,.3)"}}>Absente</span>}
          </div>
        </div>))}
      </div>}
    </div>
  );
}
function EspaceChefTab({uid, isChef}){
  const[section,setSection]=useState("");
  const[distrib,setDistrib]=useState([]);
  const[annuaire,setAnnuaire]=useState({});
  const[showMsg,setShowMsg]=useState(false);
  const[showMsgsRecus,setShowMsgsRecus]=useState(false);
  const[nbMsgsNonLus,setNbMsgsNonLus]=useState(0);
  const userName=uid.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
  const isMelissaChef = uid==="melissa"||uid==="melissa-da-silveira";
  const sections = ESPACE_CHEF_SECTIONS.filter(s=>{
    if(s.melissaOnly) return isMelissaChef;
    if(s.chefOnly) return isChef;
    return true;
  });

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"equipe","annuaire"));
        setAnnuaire(snap.exists()?snap.data().membres||{}:{});
      }catch{}
      try{
        const snap2=await getDoc(doc(db,"messages",uid));
        if(snap2.exists()){
          const msgs=snap2.data().msgs||[];
          setNbMsgsNonLus(msgs.filter(m=>!m.lu).length);
        }
      }catch{}
    })();
  },[uid]);

  // Charge les distributeurs manuels depuis Firebase quand on entre dans cette section
  const loadDistrib=async()=>{
    const data=await sgAll(uid);
    if(data["db-distributeurs"]){try{setDistrib(JSON.parse(data["db-distributeurs"]));}catch{}}
  };
  const saveDistrib=(d)=>{setDistrib(d);ss(uid,"db-distributeurs",JSON.stringify(d));};

  if(section){
    const s=sections.find(x=>x.id===section);
    return(
      <div>
        <button onClick={()=>setSection("")}
          style={{background:"none",border:"none",color:C.rose,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0,marginBottom:".75rem"}}>
          ← Retour à Espace Chef
        </button>
        {section==="stats"&&<StatsEquipeTab uid={uid} annuaire={annuaire}/>}
        {section==="challengeapp"&&<ChallengeAppSuiviTab annuaire={annuaire}/>}
        {section==="suivica"&&<SuiviCATab uid={uid}/>}
        {section==="actionsbiblio"&&<ActionsBiblioChefTab uid={uid}/>}
        {section==="membres"&&<MembresTab uid={uid}/>}
        {section==="assiduite"&&<AssiduiteTab uid={uid}/>}
        {section==="defi"&&<DefisTab uid={uid} userName={uid.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")} canCreate={true} isChef={isChef}/>}
        {section==="powerhour"&&<PowerHourTab uid={uid} userName={uid.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")} canCreate={isChef}/>}
        {section==="distributeurs"&&<DistributeursTab distributeurs={distrib} save={saveDistrib} uid={uid}/>}
        {section==="monequipe"&&<MonEquipeTab uid={uid}/>}
        {section==="nouveaux"&&<SuiviRecruTab uid={uid} isChef={isChef}/>}
        {section==="admin"&&(uid==="melissa"||uid==="melissa-da-silveira")&&<AdminTab/>}
      </div>
    );
  }

  return(
    <div>
      {showMsg&&<MessageEquipePopup uid={uid} userName={userName} annuaire={annuaire} onClose={()=>setShowMsg(false)}/>}
      {showMsgsRecus&&<MessagesRecusPopup uid={uid} onClose={()=>{setShowMsgsRecus(false);setNbMsgsNonLus(0);}}/>}

      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Espace <em style={{fontStyle:"italic",color:C.rose}}>Chef</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Toutes tes fonctions de cheffe d'équipe, au même endroit.
      </p>

      {/* Boutons messagerie */}
      <div style={{display:"flex",gap:".5rem",marginBottom:"1rem"}}>
        <button onClick={()=>setShowMsg(true)}
          style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:".4rem",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".76rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          💬 Envoyer un message
        </button>
        <button onClick={()=>setShowMsgsRecus(true)}
          style={{position:"relative",background:nbMsgsNonLus>0?C.rose+"15":C.creme,border:`1px solid ${nbMsgsNonLus>0?C.rose:C.pale}`,borderRadius:10,padding:".6rem .9rem",fontSize:".76rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",color:nbMsgsNonLus>0?C.rose:C.gris}}>
          📭 Reçus
          {nbMsgsNonLus>0&&(
            <span style={{position:"absolute",top:-6,right:-6,background:C.rose,color:"white",borderRadius:"50%",minWidth:18,height:18,fontSize:".6rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>
              {nbMsgsNonLus}
            </span>
          )}
        </button>
      </div>

      {/* Mise à jour app */}
      <div style={{marginBottom:"1rem"}}>
        <BoutonMiseAJour style={{width:"100%",justifyContent:"center"}}/>
      </div>

      <ResumeSemaineChef annuaire={annuaire}/>

      {sections.map(s=>(
        <div key={s.id} onClick={()=>{if(s.id==="distributeurs")loadDistrib();setSection(s.id);}}
          style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".8rem 1rem",marginBottom:".5rem",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:".7rem"}}>
            <div style={{width:38,height:38,borderRadius:"50%",background:C.rose+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",flexShrink:0}}>{s.icon}</div>
            <div>
              <div style={{fontFamily:"Georgia,serif",fontSize:".92rem",fontWeight:600,color:C.brun}}>{s.label}</div>
              <div style={{fontSize:".66rem",color:C.gris}}>{s.desc}</div>
            </div>
          </div>
          <span style={{color:C.pale}}>›</span>
        </div>
      ))}
    </div>
  );
}


function MonEquipeTab({uid}){
  const[annuaire,setAnnuaire]=useState({});
  const[loading,setLoading]=useState(true);
  const[isChef,setIsChef]=useState(false);
  const[authorized,setAuthorized]=useState(false);
  const[expanded,setExpanded]=useState(null);
  const[search,setSearch]=useState(""); // Chemin de navigation : liste d'uids, le dernier = dossier actuellement ouvert
  const[path,setPath]=useState([]);

  useEffect(()=>{
    (async()=>{
      try{
        const accesSnap=await getDoc(doc(db,"acces","membres"));
        const chefs=accesSnap.exists()?accesSnap.data().chefs||[]:[];
        const chef=(Array.isArray(chefs)?chefs:Object.values(chefs||{})).includes(uid.replace(/-/g," "))||uid==="melissa-da-silveira"||uid==="melissa";
        setIsChef(chef);

        const annSnap=await getDoc(doc(db,"equipe","annuaire"));
        const annuaire=annSnap.exists()?annSnap.data().membres||{}:{};
        setAnnuaire(annuaire);

        const hasTeam = Object.values(annuaire).some(m=>m.marraine===uid);
        if(!chef&&!hasTeam){setLoading(false);return;}
        setAuthorized(true);
      }catch{}
      setLoading(false);
    })();
  },[uid]);

  const fmt=(id)=>id.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");

  if(loading)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  if(!authorized)return(
    <div style={{textAlign:"center",padding:"3rem 1rem",color:C.gris}}>
      <div style={{fontSize:"2rem",marginBottom:".75rem"}}>👑</div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",color:C.brun,marginBottom:".4rem"}}>Pas encore d'équipe</div>
      <div style={{fontSize:".75rem",lineHeight:1.6}}>Cet espace s'active dès que tu as au moins une filleule.<br/>Reviens ici quand quelqu'un t'aura choisie comme marraine !</div>
    </div>
  );

  // Racine = mes propres filleules directes
  const currentUid = path.length>0 ? path[path.length-1] : uid;
  const enfants = Object.values(annuaire).filter(m=>m.marraine===currentUid);
  const currentPerson = path.length>0 ? annuaire[currentUid] : null;

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Mon <em style={{fontStyle:"italic",color:C.rose}}>Équipe</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        {path.length===0
          ? `Tes ${enfants.length} filleule${enfants.length>1?"s":""} directe${enfants.length>1?"s":""}. Clique sur 📁 pour voir la sous-équipe d'une personne.`
          : `Équipe de ${currentPerson?fmt(currentPerson.uid):""} — ${enfants.length} filleule${enfants.length>1?"s":""} directe${enfants.length>1?"s":""}.`}
      </p>

      {/* Fil d'ariane */}
      {path.length>0&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:".3rem",alignItems:"center",marginBottom:"1rem",fontSize:".7rem"}}>
          <button onClick={()=>setPath([])} style={{background:"none",border:"none",color:C.rose,fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:".2rem"}}>🏠 Mon équipe</button>
          {path.map((pUid,i)=>(
            <span key={pUid} style={{display:"flex",alignItems:"center",gap:".3rem"}}>
              <span style={{color:C.pale}}>›</span>
              <button onClick={()=>setPath(path.slice(0,i+1))}
                style={{background:"none",border:"none",color:i===path.length-1?C.brun:C.rose,fontWeight:i===path.length-1?700:600,cursor:"pointer",fontFamily:"inherit",padding:".2rem"}}>
                {fmt(pUid)}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Fiche de la personne dont on consulte l'équipe */}
      {currentPerson&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".9rem 1rem",marginBottom:"1rem"}}>
          <div style={{display:"flex",gap:".6rem",alignItems:"center",marginBottom:".6rem"}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:C.rose+"20",color:C.rose,fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {fmt(currentPerson.uid)[0]}
            </div>
            <div style={{fontFamily:"Georgia,serif",fontSize:".95rem",fontWeight:600,color:C.brun}}>{fmt(currentPerson.uid)}</div>
          </div>
          <MembreStatsCard m={currentPerson} expanded={expanded===currentPerson.uid} onToggleExpand={()=>setExpanded(expanded===currentPerson.uid?null:currentPerson.uid)}/>
        </div>
      )}

      {enfants.length===0&&!search&&(
        <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".76rem"}}>
          {path.length===0
            ?<>Aucune fille ne t'a encore choisie comme marraine.<br/>Elles apparaîtront ici dès qu'elles t'auront sélectionnée à l'inscription ou via le pop-up.</>
            :"Cette personne n'a pas encore de filleules."}
        </div>
      )}

      {enfants.length>0&&(
        <input placeholder="🔍 Rechercher dans l'équipe..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .7rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".75rem",boxSizing:"border-box"}}/>
      )}

      {enfants.filter(m=>!search||fmt(m.uid).toLowerCase().includes(search.toLowerCase())).map(m=>{
        const sousEquipeCount = countEquipeSafe(annuaire, m.uid);
        const hasTeam = sousEquipeCount>0;
        return(
          <div key={m.uid} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".7rem 1rem",marginBottom:".5rem"}}>
            <div style={{display:"flex",gap:".6rem",alignItems:"center"}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:C.rose+"20",color:C.rose,fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {fmt(m.uid)[0]}
              </div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"Georgia,serif",fontSize:".92rem",fontWeight:600,color:C.brun}}>{fmt(m.uid)}</div>
                <div style={{fontSize:".62rem",color:C.gris}}>{m.palier||"2%"}{m.ca?` · ${m.ca}€`:""}</div>
              </div>
              {hasTeam&&(
                <button onClick={()=>setPath([...path,m.uid])}
                  style={{display:"flex",alignItems:"center",gap:".3rem",background:C.lilas+"15",border:`1px solid ${C.lilas}50`,borderRadius:8,padding:".35rem .6rem",fontSize:".68rem",fontWeight:600,color:C.lilas,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                  📁 {sousEquipeCount}
                </button>
              )}
              <button onClick={async()=>{
                try{
                  const ref=doc(db,"users",m.uid);
                  const snap=await getDoc(ref);
                  const existing=snap.exists()&&snap.data()["db-fast-start"]?JSON.parse(snap.data()["db-fast-start"]):{};
                  const nom=(m.prenom||"")+" "+(m.nom||"");
                  if(!existing.startDate){
                    await setDoc(ref,{"db-fast-start":JSON.stringify({startDate:todayLocalStr(),doneTasks:{},modulesValides:{}})},{merge:true});
                    alert("✅ Fast Start assigné à "+nom.trim());
                  } else {
                    if(window.confirm(nom.trim()+" a déjà un Fast Start (démarré le "+existing.startDate+"). Relancer depuis le début ?")){
                      await setDoc(ref,{"db-fast-start":JSON.stringify({startDate:todayLocalStr(),doneTasks:{},modulesValides:{}})},{merge:true});
                      alert("✅ Fast Start relancé pour "+nom.trim());
                    }
                  }
                }catch{alert("Erreur.");}
              }}
                style={{background:C.rose+"15",border:`1px solid ${C.rose}50`,borderRadius:8,padding:".35rem .55rem",fontSize:".65rem",fontWeight:600,color:C.rose,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}
                title="Assigner/relancer le Fast Start">
                🚀
              </button>
              <button onClick={()=>setExpanded(expanded===m.uid?null:m.uid)}
                style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:8,padding:".35rem .55rem",fontSize:".68rem",color:C.gris,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                {expanded===m.uid?"▲":"▼"}
              </button>
            </div>
            {expanded===m.uid&&(
              <div style={{marginTop:".6rem",paddingTop:".6rem",borderTop:`1px solid ${C.pale}`}}>
                <MembreStatsCard m={m} expanded={true} onToggleExpand={()=>setExpanded(null)}/>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ADMIN TAB (Melissa uniquement) ───────────────────────────────────────────
function AdminConfigPeriodes(){
  const[ancre,setAncre]=useState("2026-01-03");
  const[periodeNum,setPeriodeNum]=useState("");
  const[periodeDebut,setPeriodeDebut]=useState("");
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);
  const[loaded,setLoaded]=useState(false);
  const[resetUid,setResetUid]=useState("");
  const[resetResult,setResetResult]=useState("");
  const[resetSearch,setResetSearch]=useState("");
  const[membres,setMembres]=useState([]);
  const[resetSaving,setResetSaving]=useState(false);
  const[resetVals,setResetVals]=useState({});
  const[resetGlobalSaving,setResetGlobalSaving]=useState(false);
  const[resetGlobalResult,setResetGlobalResult]=useState("");

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","config_periodes"));
        if(snap.exists()&&snap.data().ancre) setAncre(snap.data().ancre.slice(0,10));
      }catch{}
      // Charger aussi les membres de l'annuaire
      try{
        const snap2=await getDoc(doc(db,"equipe","annuaire"));
        if(snap2.exists()) setMembres(Object.entries(snap2.data().membres||{}).map(([uid,m])=>({uid,prenom:m.prenom||"",nom:m.nom||""})).sort((a,b)=>(a.prenom+a.nom).localeCompare(b.prenom+b.nom)));
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const save=async()=>{
    setSaving(true);
    try{
      await setDoc(doc(db,"admin","config_periodes"),{ancre:ancre+"T12:00:00"});
      // Met à jour la variable globale immédiatement
      PERIODE_DEBUT_ABSOLU_MS = new Date(ancre+"T12:00:00").getTime();
      setSaved(true);setTimeout(()=>setSaved(false),2000);
    }catch{}
    setSaving(false);
  };

  // Prévisualisation
  const ancreDate = new Date(ancre+"T00:00:00");
  const today = new Date();
  const diffMs = today.getTime() - ancreDate.getTime();
  const n = diffMs>0 ? Math.floor(diffMs/(PERIODE_DUREE_JOURS*24*60*60*1000))+1 : 1;
  const debut = new Date(ancreDate.getTime()+(n-1)*PERIODE_DUREE_JOURS*24*60*60*1000);
  const fin = new Date(debut.getTime()+PERIODE_DUREE_JOURS*24*60*60*1000-1);
  const numAnnee = ((n-1)%PERIODES_PAR_AN+PERIODES_PAR_AN)%PERIODES_PAR_AN+1;
  const resteDays = Math.ceil((fin.getTime()-today.getTime())/(24*60*60*1000));

  if(!loaded) return null;

  return(
    <div style={{background:"#FFF8E1",border:"1.5px solid #E6A817",borderRadius:12,padding:"1rem",marginBottom:"1.25rem"}}>
      <div style={{fontSize:".6rem",fontWeight:700,color:"#856404",letterSpacing:".1em",textTransform:"uppercase",marginBottom:".6rem"}}>⚙️ Configuration des Périodes Mihi</div>
      <p style={{fontSize:".7rem",color:"#856404",marginBottom:".75rem",lineHeight:1.6}}>
        La date d'ancre détermine le calcul de toutes les périodes pour <strong>toute l'équipe</strong>. Modifie uniquement si les dates sont incorrectes.
      </p>
      <div style={{marginBottom:".6rem"}}>
        <div style={{fontSize:".62rem",color:C.gris,marginBottom:".25rem",fontWeight:600}}>Je suis en periode :</div>
        <div style={{display:"flex",gap:".3rem",flexWrap:"wrap",marginBottom:".6rem"}}>{[6,7,8,9,10,11,12,13,14,15,16,17,18].map(n=>(<button key={n} onClick={()=>setPeriodeNum(String(n))} style={{padding:".3rem .55rem",fontSize:".72rem",fontWeight:700,borderRadius:8,border:"1.5px solid "+(periodeNum===String(n)?"#E6A817":"#E8DDD4"),background:periodeNum===String(n)?"#E6A817":"white",color:periodeNum===String(n)?"white":"#3D1F0E",cursor:"pointer",fontFamily:"inherit"}}>P{n}</button>))}</div>
        <div style={{fontSize:".62rem",color:C.gris,marginBottom:".25rem",fontWeight:600}}>Date de debut de cette periode</div>
        <input type="date" value={periodeDebut||""} onChange={e=>setPeriodeDebut(e.target.value)} style={{width:"100%",border:"1px solid #E6A817",borderRadius:8,padding:".42rem .65rem",fontSize:".85rem",fontFamily:"inherit",color:C.texte,background:"white",outline:"none",marginBottom:".4rem"}}/>
        {periodeNum&&periodeDebut&&<div style={{fontSize:".7rem",color:"#856404",background:"#FFF8E1",borderRadius:6,padding:".4rem .6rem",marginBottom:".4rem"}}>P{periodeNum} commence le {new Date(periodeDebut+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long"})}</div>}
        <div style={{fontSize:".62rem",color:C.gris,marginBottom:".25rem",fontWeight:600}}>Date de début de P1 (ancre)</div>
        <input type="date" value={ancre} onChange={e=>setAncre(e.target.value)}
          style={{width:"100%",border:`1px solid #E6A817`,borderRadius:8,padding:".42rem .65rem",fontSize:".85rem",fontFamily:"inherit",color:C.texte,background:"white",outline:"none",fontWeight:600}}/>
      </div>
      {/* Prévisualisation */}
      <div style={{background:"white",borderRadius:8,padding:".5rem .75rem",marginBottom:".6rem",fontSize:".72rem",color:C.brun}}>
        <strong>Prévisualisation :</strong> Aujourd'hui = <strong style={{color:C.rose}}>P{numAnnee} {debut.getFullYear()}</strong> · {debut.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})} → {fin.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})} · {Math.max(0,resteDays)}j restants
      </div>
      <button onClick={save} disabled={saving}
        style={{width:"100%",background:"#E6A817",color:"white",border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
        {saving?"Sauvegarde...":saved?"✅ Appliqué à toute l'équipe !":"✓ Appliquer à toute l'équipe"}
      </button>

      {/* Reset global tous les membres */}
      <div style={{marginTop:"1rem",paddingTop:"1rem",borderTop:"1px solid #E6A817"}}>
        <div style={{fontSize:".62rem",fontWeight:700,color:"#C0392B",marginBottom:".4rem"}}>🔄 Remise à zéro de toute l'équipe</div>
        <p style={{fontSize:".68rem",color:"#856404",marginBottom:".5rem",lineHeight:1.5}}>
          Remet le CA et les recrues à 0 pour <strong>tous les membres</strong> (sans effacer le cumul ni l'historique). À utiliser au changement de période/campagne.
        </p>
        {resetGlobalResult&&<div style={{fontSize:".7rem",color:resetGlobalResult.startsWith("✅")?C.vert:"#B04040",marginBottom:".4rem"}}>{resetGlobalResult}</div>}
        <button onClick={async()=>{
          if(!window.confirm("Remettre CA et recrues à 0 pour TOUTE l'équipe ? Cette action est irréversible."))return;
          setResetGlobalSaving(true);setResetGlobalResult("");
          try{
            const annRef=doc(db,"equipe","annuaire");
            const annSnap=await getDoc(annRef);
            if(!annSnap.exists()){setResetGlobalResult("❌ Annuaire introuvable.");setResetGlobalSaving(false);return;}
            const membres2=annSnap.data().membres||{};
            const uids=Object.keys(membres2);
            let ok=0,err=0;
            // Reset annuaire en une fois
            const newMembres={};
            uids.forEach(u=>{newMembres[u]={...membres2[u],ca:"",caPerso:"",recruesReal:"0"};});
            await setDoc(annRef,{membres:newMembres},{merge:true});
            // Reset objectifs individuels
            for(const uid2 of uids){
              try{
                const uSnap=await getDoc(doc(db,"users",uid2));
                if(uSnap.exists()){
                  const d2=uSnap.data();
                  if(d2["db-obj-perso"]){
                    const obj2=JSON.parse(d2["db-obj-perso"]);
                    const periode2=getPeriodeActuelle();
                    // Sauvegarder dans historique avant reset
                    const hist2=obj2.historique||[];
                    if(obj2.ca||obj2.caPerso||obj2.recruesReal!=="0"){
                      hist2.push({date:todayLocalStr(),ca:+obj2.ca||0,caPerso:+obj2.caPerso||0,recruesReal:+obj2.recruesReal||0,palier:obj2.palier||"2%"});
                    }
                    const totalCaCumul=(+obj2.totalCaCumul||0)+(+obj2.ca||0);
                    const totalRecruesCumul=(+obj2.totalRecruesCumul||0)+(+obj2.recruesReal||0);
                    const nextObj2={...obj2,ca:"",caPerso:"",caEquipe:"",recruesReal:"0",nbDirecteurs:0,caDirecteurs:{},dirSelectionnes:{},historique:hist2.slice(-24),totalCaCumul:String(totalCaCumul),totalRecruesCumul:String(totalRecruesCumul)};
                    await setDoc(doc(db,"users",uid2),{"db-obj-perso":JSON.stringify(nextObj2),"last_periode":periode2},{merge:true});
                  } else {
                    await setDoc(doc(db,"users",uid2),{"last_periode":getPeriodeActuelle()},{merge:true});
                  }
                  ok++;
                }
              }catch{err++;}
            }
            setResetGlobalResult(`✅ ${ok} membres remis à zéro${err>0?` (${err} erreurs)`:""}. Annuaire mis à jour.`);
          }catch(e){setResetGlobalResult("Erreur : "+e.message);}
          setResetGlobalSaving(false);
        }} disabled={resetGlobalSaving}
          style={{width:"100%",background:resetGlobalSaving?"#aaa":"#C0392B",color:"white",border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:resetGlobalSaving?"default":"pointer"}}>
          {resetGlobalSaving?"Remise à zéro en cours...":"🔄 Remettre toute l'équipe à zéro"}
        </button>
      </div>

      {/* Correction cumul individuel */}
      <div style={{marginTop:"1rem",paddingTop:"1rem",borderTop:"1px solid #E6A817"}}>
        <div style={{fontSize:".62rem",fontWeight:700,color:"#856404",marginBottom:".4rem"}}>🔧 Corriger les objectifs d'un membre</div>
        <p style={{fontSize:".68rem",color:"#856404",marginBottom:".5rem",lineHeight:1.5}}>
          Recherche un membre et modifie directement ses valeurs (cumul, CA, recrues).
        </p>
        <input value={resetSearch} onChange={e=>{setResetSearch(e.target.value);setResetResult("");setResetUid("");}}
          placeholder="Rechercher par prénom ou nom..."
          style={{width:"100%",border:"1px solid #E6A817",borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",background:"white",outline:"none",marginBottom:".4rem"}}/>
        {resetSearch.length>=2&&(()=>{
          const filtres=membres.filter(m=>(m.prenom+" "+m.nom).toLowerCase().includes(resetSearch.toLowerCase())).slice(0,6);
          if(!filtres.length) return <div style={{fontSize:".7rem",color:"#B04040",marginBottom:".4rem"}}>Aucun membre trouvé</div>;
          return(
            <div style={{background:"white",border:"1px solid #E6A817",borderRadius:8,marginBottom:".4rem",overflow:"hidden"}}>
              {filtres.map(m=>(
                <div key={m.uid} onClick={async()=>{
                  setResetUid(m.uid);setResetSearch(m.prenom+" "+m.nom);
                  // Charger les valeurs actuelles
                  try{
                    const snap=await getDoc(doc(db,"users",m.uid));
                    if(snap.exists()){
                      const d=snap.data();
                      const obj2=d["db-obj-perso"]?JSON.parse(d["db-obj-perso"]):{};
                      setResetVals({
                        ca:obj2.ca||"",caPerso:obj2.caPerso||"",recruesReal:obj2.recruesReal||"0",
                        totalCaCumul:obj2.totalCaCumul||"0",totalRecruesCumul:obj2.totalRecruesCumul||"0",
                      });
                    }
                  }catch{}
                }}
                  style={{padding:".45rem .65rem",cursor:"pointer",borderBottom:"1px solid #FFF3CD",display:"flex",justifyContent:"space-between",alignItems:"center",background:resetUid===m.uid?"#FFF3CD":"white"}}>
                  <span style={{fontSize:".78rem",color:C.brun,fontWeight:resetUid===m.uid?700:400}}>{m.prenom} {m.nom}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {resetUid&&(
          <div style={{background:"#FFF8E1",borderRadius:10,padding:".75rem",border:"1px solid #E6A817",marginBottom:".5rem"}}>
            <div style={{fontSize:".65rem",fontWeight:700,color:"#856404",marginBottom:".6rem"}}>✏️ {resetSearch} — valeurs modifiables</div>
            {[
              {label:"CA total période (€)",key:"ca"},
              {label:"Ventes perso (€)",key:"caPerso"},
              {label:"Recrues cette période",key:"recruesReal"},
              {label:"Cumul CA total (€)",key:"totalCaCumul"},
              {label:"Cumul recrues total",key:"totalRecruesCumul"},
            ].map(f=>(
              <div key={f.key} style={{display:"flex",alignItems:"center",gap:".5rem",marginBottom:".35rem"}}>
                <span style={{fontSize:".65rem",color:"#856404",flex:1}}>{f.label}</span>
                <input type="number" value={resetVals[f.key]||""} onChange={e=>setResetVals(p=>({...p,[f.key]:e.target.value}))}
                  style={{width:90,border:"1px solid #E6A817",borderRadius:6,padding:".28rem .45rem",fontSize:".8rem",fontFamily:"inherit",textAlign:"right",outline:"none",fontWeight:700}}/>
              </div>
            ))}
            <div style={{display:"flex",gap:".4rem",marginTop:".5rem"}}>
              <button onClick={async()=>{
                setResetSaving(true);
                try{
                  const ref=doc(db,"users",resetUid);
                  const snap=await getDoc(ref);
                  if(!snap.exists()){setResetResult("❌ Utilisateur non trouvé.");setResetSaving(false);return;}
                  const obj2=snap.data()["db-obj-perso"]?JSON.parse(snap.data()["db-obj-perso"]):{};
                  const next={...obj2,...resetVals};
                  await setDoc(ref,{"db-obj-perso":JSON.stringify(next)},{merge:true});
                  await syncAnnuaire(resetUid,resetSearch,next);
                  setResetResult("✅ Valeurs mises à jour pour "+resetSearch);
                  setResetUid("");setResetSearch("");setResetVals({});
                }catch(e){setResetResult("Erreur : "+e.message);}
                setResetSaving(false);
              }} disabled={resetSaving}
                style={{flex:1,background:"#856404",color:"white",border:"none",borderRadius:8,padding:".45rem",fontSize:".75rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                {resetSaving?"Sauvegarde...":"✓ Appliquer"}
              </button>
              <button onClick={()=>{setResetUid("");setResetSearch("");setResetVals({});}}
                style={{flex:1,background:"#ccc",color:"white",border:"none",borderRadius:8,padding:".45rem",fontSize:".75rem",fontFamily:"inherit",cursor:"pointer"}}>
                Annuler
              </button>
            </div>
          </div>
        )}
        {resetResult&&<div style={{fontSize:".7rem",color:resetResult.startsWith("✅")?C.vert:"#B04040",marginTop:".3rem"}}>{resetResult}</div>}
      </div>
    </div>
  );
}

function AdminLinkBioSection(){
  const[banniere,setBanniere]=useState({texte:"",couleur:"#C49A8A",lien:"",actif:false});
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);
  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","linkbio_banniere"));
        if(snap.exists()) setBanniere(p=>({...p,...snap.data()}));
      }catch{}
    })();
  },[]);
  const save=async()=>{
    setSaving(true);
    try{
      await setDoc(doc(db,"admin","linkbio_banniere"),banniere);
      setSaved(true);setTimeout(()=>setSaved(false),2000);
    }catch{}
    setSaving(false);
  };
  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1.25rem"}}>
      <div style={{fontSize:".6rem",fontWeight:700,color:C.rose,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".75rem"}}>🔗 Bannière Link-in-Bio (toute l'équipe)</div>
      <p style={{fontSize:".7rem",color:C.gris,marginBottom:".75rem",lineHeight:1.6}}>
        Cette bannière s'affichera sur la page de TOUTES les distributrices. Chaque membre peut choisir de l'afficher ou non.
      </p>
      <input value={banniere.texte} onChange={e=>setBanniere(p=>({...p,texte:e.target.value}))} placeholder="Ex: 🎉 Promo -20% jusqu'au 30 juin !"
        style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".4rem"}}/>
      <input value={banniere.lien} onChange={e=>setBanniere(p=>({...p,lien:e.target.value}))} placeholder="Lien (optionnel)"
        style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".4rem"}}/>
      <div style={{display:"flex",alignItems:"center",gap:".75rem",marginBottom:".5rem"}}>
        <div style={{fontSize:".7rem",color:C.gris}}>Couleur :</div>
        <input type="color" value={banniere.couleur} onChange={e=>setBanniere(p=>({...p,couleur:e.target.value}))} style={{width:32,height:28,border:"none",borderRadius:6,cursor:"pointer"}}/>
        <label style={{display:"flex",alignItems:"center",gap:".4rem",cursor:"pointer"}}>
          <input type="checkbox" checked={banniere.actif} onChange={e=>setBanniere(p=>({...p,actif:e.target.checked}))}/>
          <span style={{fontSize:".72rem",color:C.brun,fontWeight:600}}>Activer</span>
        </label>
      </div>
      <button onClick={save} disabled={saving}
        style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
        {saving?"Sauvegarde...":saved?"✅ Sauvegardé !":"✓ Appliquer à toute l'équipe"}
      </button>
    </div>
  );
}

function AdminImportCatalogue(){
  const[importing,setImporting]=useState(false);
  const[result,setResult]=useState(null);
  const[stats,setStats]=useState(null);

  const CAT_MAP={
    'VISAGE':'face','CORPS':'corps','CHEVEUX':'hair',
    'Make Up':'makeup','PARFUMS':'parfums','SANTÉ':'health',
    'Hommes':'hommes','Enfants':'enfants','HOME':'home','Sets':'sets'
  };

  const handleFile=async(e)=>{
    const file=e.target.files?.[0];
    if(!file)return;
    setImporting(true);setResult(null);setStats(null);

    try{
      // Charger SheetJS depuis un tag script déjà présent (index.html) ou CDN via un élément script injecté
      const xlsx = await new Promise((resolve,reject)=>{
        if(window.XLSX){resolve(window.XLSX);return;}
        const s=document.createElement('script');
        s.src='https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
        s.onload=()=>resolve(window.XLSX);
        s.onerror=()=>reject(new Error('SheetJS non chargé'));
        document.head.appendChild(s);
      });

      const buf=await file.arrayBuffer();
      const wb=xlsx.read(buf,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=xlsx.utils.sheet_to_json(ws);

      const seen=new Set();
      const catalogue={};
      Object.values(CAT_MAP).forEach(k=>{catalogue[k]=[];});

      for(const row of rows){
        const art=String(row['Art']||'').replace('.0','').trim();
        if(!art||seen.has(art))continue;
        seen.add(art);
        const cat=row['Category']||'';
        const key=CAT_MAP[cat];
        if(!key)continue;
        const priceRaw=String(row['Price']||'').replace('€','').replace(',','.').trim();
        const prix=parseFloat(priceRaw)||0;
        const offerPriceRaw=String(row['Offer price']||'').replace('€','').replace(',','.').trim();
        catalogue[key].push({
          nom:String(row['Name']||''),
          prix,
          ref:art,
          serie:cat,
          offre:row['Offer']?String(row['Offer']):'',
          prixOffre:offerPriceRaw?parseFloat(offerPriceRaw)||0:'',
        });
      }

      const total=Object.values(catalogue).reduce((s,v)=>s+v.length,0);
      await setDoc(doc(db,"admin","catalogue_mihi"),catalogue);
      const statsObj={};
      Object.entries(catalogue).forEach(([k,v])=>{if(v.length)statsObj[k]=v.length;});
      setStats({total,details:statsObj});
      setResult("✅ Import réussi !");
    }catch(err){
      setResult("❌ Erreur : "+err.message);
    }
    setImporting(false);
    e.target.value="";
  };

  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1.25rem"}}>
      <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>📦 Import Catalogue Mihi (Excel)</div>
      <p style={{fontSize:".72rem",color:C.gris,marginBottom:".75rem",lineHeight:1.6}}>
        Sélectionne le fichier Excel du catalogue Mihi pour mettre à jour les produits dans l'application.
      </p>
      <label style={{display:"block",background:importing?C.pale:C.brun,color:"white",borderRadius:9,padding:".55rem",textAlign:"center",fontSize:".78rem",fontWeight:600,cursor:importing?"default":"pointer",fontFamily:"inherit"}}>
        {importing?"⏳ Import en cours...":"📂 Choisir le fichier Excel (.xlsx)"}
        <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{display:"none"}} disabled={importing}/>
      </label>
      {result&&<div style={{marginTop:".6rem",fontSize:".74rem",fontWeight:600,color:result.startsWith("✅")?C.vert:"#B04040"}}>{result}</div>}
      {stats&&(
        <div style={{background:C.creme,borderRadius:8,padding:".6rem .75rem",marginTop:".5rem"}}>
          <div style={{fontSize:".68rem",fontWeight:700,color:C.brun,marginBottom:".35rem"}}>{stats.total} produits importés :</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:".3rem"}}>
            {Object.entries(stats.details).map(([k,v])=>(
              <span key={k} style={{fontSize:".62rem",background:C.pale,borderRadius:20,padding:".1rem .45rem",color:C.brun}}>{k}: {v}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminTab(){
  const[items,setItems]=useState([]);
  const[loading,setLoading]=useState(true);
  const[showAdd,setShowAdd]=useState(false);
  const[editId,setEditId]=useState(null);
  const[saving,setSaving]=useState(false);
  const[videosFastStart,setVideosFastStart]=useState({});
  const[anthropicKey,setAnthropicKey]=useState("");
  const[savingKey,setSavingKey]=useState(false);
  const[savedKey,setSavedKey]=useState(false);
  useEffect(()=>{(async()=>{try{const snap=await getDoc(doc(db,"admin","config"));if(snap.exists()&&snap.data().anthropicKey)setAnthropicKey(snap.data().anthropicKey);}catch{}})();},[]);
  const sauvegarderCle=async()=>{setSavingKey(true);try{await setDoc(doc(db,"admin","config"),{anthropicKey},{merge:true});ANTHROPIC_API_KEY=anthropicKey;setSavedKey(true);setTimeout(()=>setSavedKey(false),2000);}catch{}setSavingKey(false);};
  const[savingFS,setSavingFS]=useState(false);
  const[filterDest,setFilterDest]=useState("all");

  const EMPLACEMENTS=[
    {groupe:"🎓 Formation",options:[
      {id:"demarrage",       label:"Formation Démarrage"},
      {id:"vente",           label:"Formation Vente"},
      {id:"recrutement",     label:"Formation Recrutement"},
      {id:"contenu",         label:"Formation Contenu/Réseaux"},
      {id:"devperso",        label:"Développement Personnel Business"},
      {id:"videoannexe",     label:"Vidéos Annexes"},
      {id:"outils",          label:"Formation Outils"},
      {id:"formationapp",    label:"Formation App (général)"},
      {id:"formationchef",   label:"Formation App — Chef d'équipe"},
      {id:"dashboard",        label:"Formation App — Tableau de bord"},
      {id:"outils",           label:"Formation App — Outils généraux"},
    ]},
    {groupe:"🧴 Produits",options:[
      {id:"produits_parfum",      label:"Produits — Parfum"},
      {id:"produits_makeup",      label:"Produits — Maquillage"},
      {id:"produits_complement",  label:"Produits — Compléments alimentaires"},
      {id:"produits_poids",       label:"Produits — Perte de poids"},
      {id:"produits_skincare",    label:"Produits — Skincare"},
      {id:"produits_corpsoin",    label:"Produits — Soins corps"},
      {id:"produits_entretien",   label:"Produits — Entretien"},
    ]},
    {groupe:"🏠 Dashboard",options:[
      {id:"today_top",       label:"Aujourd'hui — En-tête"},
      {id:"today_bottom",    label:"Aujourd'hui — Bas de page"},
      {id:"annonces",        label:"Annonces équipe (popup)"},
    ]},
    {groupe:"📱 Réseaux / Posts",options:[
      {id:"posts_instagram", label:"Posts — Idées Instagram"},
      {id:"posts_facebook",  label:"Posts — Idées Facebook"},
      {id:"posts_stories",   label:"Posts — Idées Stories"},
    ]},
    {groupe:"🔗 Liens & Tunnels",options:[
      {id:"linkbio_liens",   label:"Link-in-Bio — Liens supplémentaires"},
      {id:"tunnel_vente",    label:"Tunnel Vente — Ressources"},
      {id:"tunnel_recrut",   label:"Tunnel Recrutement — Ressources"},
    ]},
  ];

  const TOUS_IDS=EMPLACEMENTS.flatMap(g=>g.options.map(o=>o.id));
  const getLabel=(id)=>{
    for(const g of EMPLACEMENTS) for(const o of g.options) if(o.id===id)return o.label;
    return id;
  };

  const TYPES=[
    {id:"video",    label:"▶ Vidéo Zoom",emoji:"🎬"},
    {id:"youtube",  label:"▶ YouTube",   emoji:"▶️"},
    {id:"drive",    label:"📄 Drive",    emoji:"📄"},
    {id:"doc",      label:"📝 Google Doc",emoji:"📝"},
    {id:"image",    label:"🖼️ Image",    emoji:"🖼️"},
    {id:"info",     label:"💡 Texte",    emoji:"💡"},
    {id:"lien",     label:"🔗 Lien",     emoji:"🔗"},
  ];

  const emptyForm={destination:TOUS_IDS[0],titre:"",description:"",url:"",type:"video",actif:true,image:""};
  const[form,setForm]=useState(emptyForm);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","contenus"));
        if(snap.exists())setItems(snap.data().items||[]);
      }catch{}
      try{
        const snap2=await getDoc(doc(db,"admin","videos_faststart"));
        if(snap2.exists())setVideosFastStart(snap2.data().videos||{});
      }catch{}
      setLoading(false);
    })();
  },[]);

  const saveItems=async(next)=>{
    setSaving(true);
    try{await setDoc(doc(db,"admin","contenus"),{items:next});}catch{}
    setSaving(false);
  };

  const saveVideoFS=async(v)=>{
    setSavingFS(true);
    try{await setDoc(doc(db,"admin","videos_faststart"),{videos:v});}catch{}
    setVideosFastStart(v);
    setSavingFS(false);
  };

  const add=async()=>{
    if(!form.titre.trim())return;
    let next;
    if(editId){
      next=items.map(it=>it.id===editId?{...it,...form}:it);
    } else {
      next=[...items,{id:`adm${Date.now()}`,...form}];
    }
    setItems(next);
    await saveItems(next);
    setForm(emptyForm);setShowAdd(false);setEditId(null);
  };

  const del=async(id)=>{
    if(!window.confirm("Supprimer ce contenu ?"))return;
    const next=items.filter(it=>it.id!==id);
    setItems(next);await saveItems(next);
  };

  const toggle=async(id)=>{
    const next=items.map(it=>it.id===id?{...it,actif:!it.actif}:it);
    setItems(next);await saveItems(next);
  };

  const startEdit=(it)=>{
    setForm({destination:it.destination||it.onglet||TOUS_IDS[0],titre:it.titre||"",description:it.description||"",url:it.url||"",type:it.type||"video",actif:it.actif!==false,image:it.image||""});
    setEditId(it.id);setShowAdd(true);
  };

  if(loading)return<div style={{textAlign:"center",padding:"2rem",color:C.gris}}>Chargement...</div>;

  const itemsFiltres=filterDest==="all"?items:items.filter(it=>(it.destination||it.onglet)===filterDest);
  const SEL=({label,field,options,small=false})=>(
    <div style={{marginBottom:".5rem"}}>
      <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>{label}</div>
      <select value={form[field]} onChange={e=>setForm(p=>({...p,[field]:e.target.value}))}
        style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:small?".35rem .5rem":".42rem .65rem",fontSize:small?".75rem":".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}>
        {options}
      </select>
    </div>
  );
  const INP=({label,field,placeholder,textarea=false})=>(
    <div style={{marginBottom:".5rem"}}>
      <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>{label}</div>
      {textarea
        ?<textarea value={form[field]||""} onChange={e=>setForm(p=>({...p,[field]:e.target.value}))} placeholder={placeholder} rows={3}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",resize:"vertical",lineHeight:1.6}}/>
        :<input value={form[field]||""} onChange={e=>setForm(p=>({...p,[field]:e.target.value}))} placeholder={placeholder}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
      }
    </div>
  );

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Espace <em style={{fontStyle:"italic",color:C.rose}}>Admin</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Ajoute du contenu à n'importe quel endroit du site — formations, vidéos, annonces, ressources.
      </p>

      {/* Sections fixes */}
      <AdminLinkBioSection/>
      <AdminConfigPeriodes/>
      <AdminImportCatalogue/>
      <AdminFormationProduits/>

      {/* Fast Start vidéos */}
      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1.25rem"}}>
        <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".75rem"}}>🚀 Vidéos Fast Start — 7 modules</div>
        {FAST_START_DAYS.map(d=>{
          const key=`module${d.jour}`;
          const cur=videosFastStart[key]||{url:"",type:"youtube"};
          return(
            <div key={d.jour} style={{marginBottom:".6rem",paddingBottom:".6rem",borderBottom:`1px solid ${C.pale}`}}>
              <div style={{fontSize:".72rem",fontWeight:600,color:C.brun,marginBottom:".3rem"}}>Module {d.jour} — {d.titre.split("—")[0].trim()}</div>
              <div style={{display:"flex",gap:".4rem"}}>
                <select value={cur.type} onChange={e=>{const v={...videosFastStart,[key]:{...cur,type:e.target.value}};saveVideoFS(v);}}
                  style={{border:`1px solid ${C.pale}`,borderRadius:7,padding:".35rem .4rem",fontSize:".72rem",fontFamily:"inherit",background:C.creme,outline:"none",flexShrink:0}}>
                  <option value="youtube">YouTube</option>
                  <option value="video">Zoom</option>
                  <option value="drive">Drive</option>
                </select>
                <input value={cur.url} onChange={e=>{const v={...videosFastStart,[key]:{...cur,url:e.target.value}};setVideosFastStart(v);}}
                  onBlur={()=>saveVideoFS(videosFastStart)}
                  placeholder="URL de la vidéo"
                  style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:7,padding:".35rem .55rem",fontSize:".75rem",fontFamily:"inherit",background:C.creme,outline:"none"}}/>
              </div>
            </div>
          );
        })}
        {savingFS&&<div style={{fontSize:".65rem",color:C.vert,textAlign:"right"}}>Sauvegardé ✓</div>}
      </div>

      {/* ── CONTENU LIBRE ── */}
      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".75rem"}}>
          <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose}}>📦 Contenu libre — {items.length} éléments</div>
          <button onClick={()=>{setShowAdd(!showAdd);setForm(emptyForm);setEditId(null);}}
            style={{background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".35rem .75rem",fontSize:".72rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
            {showAdd&&!editId?"✕ Annuler":"+ Ajouter"}
          </button>
        </div>

        {/* Formulaire ajout/édition */}
        {showAdd&&(
          <div style={{background:C.creme,borderRadius:10,padding:".85rem",marginBottom:".75rem",border:`1px solid ${C.pale}`}}>
            <div style={{fontSize:".68rem",fontWeight:700,color:C.brun,marginBottom:".65rem"}}>{editId?"✏️ Modifier":"+ Nouveau contenu"}</div>

            {/* Destination */}
            <div style={{marginBottom:".5rem"}}>
              <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>📍 Où afficher ce contenu ?</div>
              <select value={form.destination} onChange={e=>setForm(p=>({...p,destination:e.target.value}))}
                style={{width:"100%",border:`1.5px solid ${C.rose}`,borderRadius:8,padding:".45rem .65rem",fontSize:".82rem",fontFamily:"inherit",color:C.brun,background:"white",outline:"none",fontWeight:600}}>
                {EMPLACEMENTS.map(g=>(
                  <optgroup key={g.groupe} label={g.groupe}>
                    {g.options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            <SEL label="Type de contenu" field="type" options={TYPES.map(t=><option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}/>
            <INP label="Titre *" field="titre" placeholder="Ex: Comment aborder une inconnue sur Instagram"/>
            <INP label="Description" field="description" placeholder="Résumé, conseils..." textarea/>
            {["video","youtube","drive","doc","lien"].includes(form.type)&&
              <INP label="URL" field="url" placeholder="https://..."/>
            }
            {form.type==="image"&&
              <UploadPhoto label="Image" value={form.image} onChange={v=>setForm(p=>({...p,image:v}))} folder="admin-contenu"/>
            }
            <label style={{display:"flex",alignItems:"center",gap:".5rem",fontSize:".75rem",color:C.brun,cursor:"pointer",marginTop:".25rem"}}>
              <input type="checkbox" checked={!!form.actif} onChange={e=>setForm(p=>({...p,actif:e.target.checked}))}/>
              Visible immédiatement
            </label>
            <div style={{display:"flex",gap:".4rem",marginTop:".65rem"}}>
              <button onClick={add} disabled={saving||!form.titre.trim()}
                style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                {saving?"Sauvegarde...":editId?"✓ Modifier":"✓ Ajouter"}
              </button>
              <button onClick={()=>{setShowAdd(false);setEditId(null);setForm(emptyForm);}}
                style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Filtre par destination */}
        <div style={{marginBottom:".65rem"}}>
          <select value={filterDest} onChange={e=>setFilterDest(e.target.value)}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".4rem .65rem",fontSize:".76rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}>
            <option value="all">Tous les contenus ({items.length})</option>
            {EMPLACEMENTS.map(g=>(
              <optgroup key={g.groupe} label={g.groupe}>
                {g.options.map(o=>{
                  const n=items.filter(it=>(it.destination||it.onglet)===o.id).length;
                  return<option key={o.id} value={o.id}>{o.label} ({n})</option>;
                })}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Liste items */}
        {itemsFiltres.length===0&&<div style={{textAlign:"center",fontSize:".72rem",color:C.gris,padding:".75rem",fontStyle:"italic"}}>Aucun contenu{filterDest!=="all"?" dans cet emplacement":""}</div>}
        {itemsFiltres.map(it=>{
          const T=TYPES.find(t=>t.id===it.type)||TYPES[0];
          return(
            <div key={it.id} style={{display:"flex",alignItems:"center",gap:".5rem",background:it.actif?C.creme:"#f0f0f0",borderRadius:9,padding:".5rem .75rem",marginBottom:".35rem",border:`1px solid ${it.actif?C.pale:"#ddd"}`,opacity:it.actif?1:.7}}>
              <span style={{fontSize:"1rem",flexShrink:0}}>{T.emoji}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:".78rem",fontWeight:600,color:C.brun,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.titre}</div>
                <div style={{fontSize:".6rem",color:C.rose,fontWeight:600}}>📍 {getLabel(it.destination||it.onglet||"")}</div>
              </div>
              <button onClick={()=>toggle(it.id)} title={it.actif?"Masquer":"Afficher"}
                style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:6,padding:".18rem .35rem",fontSize:".65rem",color:it.actif?C.vert:C.gris,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                {it.actif?"👁️":"🙈"}
              </button>
              <button onClick={()=>startEdit(it)}
                style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:6,padding:".18rem .35rem",fontSize:".65rem",color:C.gris,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>✏️</button>
              <button onClick={()=>del(it.id)}
                style={{background:"none",border:`1px solid #E0C0C0`,borderRadius:6,padding:".18rem .35rem",fontSize:".65rem",color:"#B04040",cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>✕</button>
            </div>
          );
        })}
      </div>

      {/* Clé API Anthropic */}
      <div style={{background:C.creme,borderRadius:12,padding:"1rem",marginTop:"1rem",border:"1px solid "+C.pale}}>
        <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.brun,marginBottom:".5rem"}}>🔑 Clé API Anthropic (IA)</div>
        <div style={{fontSize:".72rem",color:C.gris,marginBottom:".5rem",lineHeight:1.5}}>Renouvelle-la si les diagnostics IA ne fonctionnent plus.</div>
        <input type="password" placeholder="sk-ant-api03-..." value={anthropicKey} onChange={e=>setAnthropicKey(e.target.value)}
          style={{width:"100%",border:"1px solid "+C.pale,borderRadius:8,padding:".45rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:"white",outline:"none",marginBottom:".5rem"}}/>
        <button onClick={sauvegarderCle} disabled={savingKey||!anthropicKey.trim()}
          style={{background:C.brun,color:"white",border:"none",borderRadius:8,padding:".45rem 1rem",fontSize:".75rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
          {savingKey?"...":savedKey?"✅ Sauvegardée !":"💾 Sauvegarder la clé"}
        </button>
      </div>

      {/* Scripts personnalisés */}
      <div style={{background:C.creme,borderRadius:12,padding:"1rem",marginTop:"1rem",border:"1px solid "+C.pale}}>
        <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.brun,marginBottom:".75rem"}}>📝 Scripts personnalisés</div>
        <AdminScriptsEditor/>
      </div>
    </div>
  );
}

function DevPersoSection({adminItems}){
  const[dvpTab,setDvpTab]=useState("business");
  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".5rem"}}>
        Développement <em style={{fontStyle:"italic",color:C.rose}}>Personnel</em>
      </div>
      <div style={{display:"flex",gap:".35rem",marginBottom:"1rem"}}>
        {[{id:"business",label:"🧠 Business"},{id:"annexe",label:"🎥 Vidéos annexes"}].map(t=>(
          <button key={t.id} onClick={()=>setDvpTab(t.id)}
            style={{flex:1,padding:".5rem",fontSize:".75rem",fontWeight:600,borderRadius:10,border:`1.5px solid ${dvpTab===t.id?C.rose:C.pale}`,background:dvpTab===t.id?C.rose:C.blanc,color:dvpTab===t.id?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
            {t.label}
          </button>
        ))}
      </div>
      {dvpTab==="business"&&(
        <div>
          <AdminContentBlock onglet="devperso" items={adminItems}/>
          {[
            {icon:"🧠",title:"Dégommer son plafond de verre",desc:"Identifier les croyances limitantes qui t'empêchent d'avancer et les transformer en force.",video:"https://us06web.zoom.us/rec/share/XzuZHzXLLZdVOz2rQmBb-7nomO9qxTj92_xluvzizpzlSaYfxRdmTARqoDTdatzs.EHObmbNT1mpbo0Ad"},
            {icon:"🎯",title:"Fixer ses objectifs — méthode complète",desc:"Des objectifs qui fonctionnent vraiment.",video:"https://us06web.zoom.us/rec/share/E1JtWx4furUdNFt4wKKCJYcfD4ScYwhJZ3BfUnHZYOnbUzcRYLzdLq5WuoyJSjw.MsevJMjQXIrzr1rp?startTime=1771357741000"},
            {icon:"👑",title:"Développer son leadership",desc:"Comment inspirer, guider et faire grandir son équipe.",video:"https://us06web.zoom.us/rec/share/hnDWdngAPCK_SGVTYzVhgk70t_nqqfesUvZF7hme8CaEgL-CpszXoantB-d2MSPZ.Yl7wHQ7KV9pZJnCL"},
            {icon:"📱",title:"Personal branding",desc:"Qui tu es en ligne = qui tu attires.",video:"https://youtu.be/j5EUiKmUSgM"},
            {icon:"🤝",title:"Humaniser son contenu",desc:"Pourquoi les gens achètent à des personnes, pas à des marques.",video:"https://youtu.be/WxJFBnigjpw"},
            {icon:"📖",title:"Le storytelling",desc:"Raconter pour vendre, pour convaincre, pour recruter.",video:"https://youtu.be/dgylHebkai4"},
          ].map(item=>(
            <div key={item.title} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem 1rem",marginBottom:".6rem"}}>
              <div style={{display:"flex",gap:".6rem",alignItems:"flex-start",marginBottom:item.video?".6rem":0}}>
                <span style={{fontSize:"1.1rem",flexShrink:0}}>{item.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:C.brun,marginBottom:".15rem"}}>{item.title}</div>
                  <div style={{fontSize:".72rem",color:C.gris,lineHeight:1.55}}>{item.desc}</div>
                </div>
              </div>
              {item.video&&<YTBtn href={item.video} label="▶ Voir la formation"/>}
            </div>
          ))}
        </div>
      )}
      {dvpTab==="annexe"&&(
        <div>
          <AdminContentBlock onglet="videoannexe" items={adminItems}/>
          <div style={{background:C.creme,borderRadius:10,padding:".75rem 1rem",fontSize:".75rem",color:C.gris,lineHeight:1.65}}>
            💡 Les vidéos annexes sont ajoutées depuis l'espace Admin.
          </div>
        </div>
      )}
    </div>
  );
}

function AdminContentBlock({onglet,items}){
  const {lang} = useLang();
  const filtered=(items||[]).filter(i=>(i.destination||i.onglet)===onglet&&i.actif!==false);
  if(filtered.length===0)return null;

  const typeConfig={
    video:{icon:"▶",color:"#8B1A1A",label:"Zoom"},
    youtube:{icon:"▶",color:"#8B1A1A",label:"YouTube"},
    drive:{icon:"📄",color:"#5C3020",label:"Drive"},
    doc:{icon:"📝",color:"#1a4a8b",label:"Doc"},
    info:{icon:"💡",color:"#5C8A60",label:"Info"},
  };

  return(
    <div style={{marginTop:".5rem"}}>
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".4rem"}}>✦ Ajouté par Melissa</div>
      {filtered.map(item=>{
        const cfg=typeConfig[item.type]||typeConfig.info;
        return <AdminContentItem key={item.id} item={item} cfg={cfg} lang={lang}/>;
      })}
    </div>
  );
}

function AdminContentItem({item,cfg,lang}){
  const[titre,setTitre]=useState(item.titre||"");
  const[desc,setDesc]=useState(item.description||"");

  useEffect(()=>{
    if(lang==="fr"){setTitre(item.titre||"");setDesc(item.description||"");return;}
    const toTr=[item.titre||"",item.description||""].filter(Boolean);
    if(!toTr.length)return;
    translateBatch(toTr,lang).then(res=>{
      setTitre(res[0]||item.titre);
      if(item.description) setDesc(res[1]||item.description);
    });
  },[lang,item.id]);

  return(
    <div style={{background:"rgba(196,154,138,.08)",border:`1px solid ${C.pale}`,borderRadius:10,padding:".65rem .85rem",marginBottom:".4rem"}}>
      <div style={{fontSize:".78rem",fontWeight:600,color:C.brun,marginBottom:desc?".2rem":item.url?".35rem":0}}>{titre}</div>
      {desc&&<div style={{fontSize:".72rem",color:C.gris,lineHeight:1.5,marginBottom:item.url?".4rem":0}}>{desc}</div>}
      {item.url&&(
        <a href={item.url} target="_blank" rel="noopener noreferrer"
          style={{display:"flex",alignItems:"center",gap:".5rem",background:cfg.color,borderRadius:8,padding:".45rem .8rem",textDecoration:"none",marginTop:".1rem"}}>
          <span style={{fontSize:".8rem",flexShrink:0}}>{cfg.icon}</span>
          <span style={{fontSize:".72rem",fontWeight:600,color:"white"}}>
            {lang==="pt"?"Abrir":"Ouvrir"} — {cfg.label}
          </span>
          <span style={{marginLeft:"auto",color:"rgba(255,255,255,.6)",fontSize:".6rem"}}>→</span>
        </a>
      )}
    </div>
  );
}

// ── ADMIN POSTS EDITOR ───────────────────────────────────────────────────────
function AdminPostsEditor(){
  const[items,setItems]=useState([]);
  const[loaded,setLoaded]=useState(false);
  const[saving,setSaving]=useState(false);
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({theme:"",hook:"",caption:""});

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","posts_extra"));
        if(snap.exists()) setItems(snap.data().items||[]);
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const save=async(next)=>{
    setSaving(true);
    try{await setDoc(doc(db,"admin","posts_extra"),{items:next});}catch{}
    setItems(next);
    setSaving(false);
  };

  const add=()=>{
    if(!form.theme.trim()||!form.hook.trim()||!form.caption.trim())return;
    const postId="adm-post-"+Date.now();
    const themeKey=form.theme.trim();
    const existing=items.find(t=>t.theme===themeKey);
    let next;
    if(existing){
      next=items.map(t=>t.theme===themeKey?{...t,posts:[...t.posts,{id:postId,hook:form.hook.trim(),caption:form.caption.trim()}]}:t);
    } else {
      next=[...items,{theme:themeKey,color:C.or,posts:[{id:postId,hook:form.hook.trim(),caption:form.caption.trim()}]}];
    }
    save(next);
    setForm({theme:"",hook:"",caption:""});
    setShowAdd(false);
  };

  const delPost=(themeKey,postId)=>{
    let next=items.map(t=>t.theme===themeKey?{...t,posts:t.posts.filter(p=>p.id!==postId)}:t).filter(t=>t.posts.length>0);
    save(next);
  };

  const totalPosts=items.reduce((a,t)=>a+t.posts.length,0);

  if(!loaded) return <div style={{fontSize:".74rem",color:C.gris}}>Chargement...</div>;

  return(
    <div>
      <button onClick={()=>setShowAdd(p=>!p)}
        style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:"1rem"}}>
        ➕ Ajouter une idée de post ({totalPosts})
      </button>

      {showAdd&&(
        <div style={{background:C.creme,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>Nouvelle idée</div>
          <input placeholder="Thème (ex: 🎉 Promo de printemps)" value={form.theme} onChange={e=>setForm(p=>({...p,theme:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".45rem"}}/>
          <input placeholder="Hook (1ère phrase qui accroche)" value={form.hook} onChange={e=>setForm(p=>({...p,hook:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".45rem"}}/>
          <textarea placeholder="Caption complète (avec CTA)" value={form.caption} onChange={e=>setForm(p=>({...p,caption:e.target.value}))}
            style={{width:"100%",minHeight:80,border:`1px solid ${C.pale}`,borderRadius:8,padding:".5rem .65rem",fontFamily:"inherit",fontSize:".78rem",color:C.texte,background:C.blanc,resize:"vertical",outline:"none",lineHeight:1.6,marginBottom:".6rem"}}/>
          <div style={{display:"flex",gap:".4rem"}}>
            <button onClick={add} disabled={saving} style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              {saving?"...":"Ajouter"}
            </button>
            <button onClick={()=>setShowAdd(false)} style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {items.map(theme=>(
        <div key={theme.theme} style={{marginBottom:".75rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",padding:".2rem .6rem",background:C.or+"20",color:C.brun2,borderRadius:20,display:"inline-block",marginBottom:".4rem"}}>{theme.theme}</div>
          {theme.posts.map(post=>(
            <div key={post.id} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:9,padding:".55rem .75rem",marginBottom:".3rem",display:"flex",gap:".5rem",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:".75rem",fontWeight:600,color:C.brun}}>{post.hook}</div>
                <div style={{fontSize:".68rem",color:C.gris,marginTop:".15rem"}}>{post.caption}</div>
              </div>
              <button onClick={()=>delPost(theme.theme,post.id)} style={{background:"none",border:"none",color:"#B04040",cursor:"pointer",fontSize:".7rem",padding:".15rem",fontFamily:"inherit",flexShrink:0}}>✕</button>
            </div>
          ))}
        </div>
      ))}
      {items.length===0&&<div style={{fontSize:".73rem",color:C.gris,fontStyle:"italic"}}>Aucune idée ajoutée encore.</div>}
    </div>
  );
}

// ── ADMIN SCRIPTS EDITOR ─────────────────────────────────────────────────────
function AdminScriptsEditor(){
  const[items,setItems]=useState([]);
  const[loaded,setLoaded]=useState(false);
  const[saving,setSaving]=useState(false);
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({cat:"",title:"",text:""});

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","scripts_extra"));
        if(snap.exists()) setItems(snap.data().items||[]);
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const save=async(next)=>{
    setSaving(true);
    try{await setDoc(doc(db,"admin","scripts_extra"),{items:next});}catch{}
    setItems(next);
    setSaving(false);
  };

  const add=()=>{
    if(!form.cat.trim()||!form.title.trim()||!form.text.trim())return;
    const catKey=form.cat.trim();
    const existing=items.find(c=>c.cat===catKey);
    let next;
    if(existing){
      next=items.map(c=>c.cat===catKey?{...c,scripts:[...c.scripts,{title:form.title.trim(),text:form.text.trim()}]}:c);
    } else {
      next=[...items,{cat:catKey,scripts:[{title:form.title.trim(),text:form.text.trim()}]}];
    }
    save(next);
    setForm({cat:"",title:"",text:""});
    setShowAdd(false);
  };

  const delScript=(catKey,title)=>{
    let next=items.map(c=>c.cat===catKey?{...c,scripts:c.scripts.filter(s=>s.title!==title)}:c).filter(c=>c.scripts.length>0);
    save(next);
  };

  const total=items.reduce((a,c)=>a+c.scripts.length,0);

  if(!loaded) return <div style={{fontSize:".74rem",color:C.gris}}>Chargement...</div>;

  return(
    <div>
      <button onClick={()=>setShowAdd(p=>!p)}
        style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:"1rem"}}>
        ➕ Ajouter un script ({total})
      </button>

      {showAdd&&(
        <div style={{background:C.creme,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>Nouveau script</div>
          <input placeholder="Catégorie (ex: 💬 Premier contact)" value={form.cat} onChange={e=>setForm(p=>({...p,cat:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".45rem"}}/>
          <input placeholder="Titre du script" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".45rem"}}/>
          <textarea placeholder="Texte du script" value={form.text} onChange={e=>setForm(p=>({...p,text:e.target.value}))}
            style={{width:"100%",minHeight:90,border:`1px solid ${C.pale}`,borderRadius:8,padding:".5rem .65rem",fontFamily:"inherit",fontSize:".78rem",color:C.texte,background:C.blanc,resize:"vertical",outline:"none",lineHeight:1.6,marginBottom:".6rem"}}/>
          <div style={{display:"flex",gap:".4rem"}}>
            <button onClick={add} disabled={saving} style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              {saving?"...":"Ajouter"}
            </button>
            <button onClick={()=>setShowAdd(false)} style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {items.map(cat=>(
        <div key={cat.cat} style={{marginBottom:".75rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",padding:".2rem .6rem",background:C.or+"20",color:C.brun2,borderRadius:20,display:"inline-block",marginBottom:".4rem"}}>{cat.cat}</div>
          {cat.scripts.map(s=>(
            <div key={s.title} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:9,padding:".55rem .75rem",marginBottom:".3rem",display:"flex",gap:".5rem",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:".75rem",fontWeight:600,color:C.brun}}>{s.title}</div>
                <div style={{fontSize:".68rem",color:C.gris,marginTop:".15rem"}}>{s.text}</div>
              </div>
              <button onClick={()=>delScript(cat.cat,s.title)} style={{background:"none",border:"none",color:"#B04040",cursor:"pointer",fontSize:".7rem",padding:".15rem",fontFamily:"inherit",flexShrink:0}}>✕</button>
            </div>
          ))}
        </div>
      ))}
      {items.length===0&&<div style={{fontSize:".73rem",color:C.gris,fontStyle:"italic"}}>Aucun script ajouté encore.</div>}
    </div>
  );
}

// ── ADMIN TEXTES EDITOR ──────────────────────────────────────────────────────
function AdminTextesEditor(){
  const[citations,setCitations]=useState([]);
  const[messageAccueil,setMessageAccueil]=useState("");
  const[loaded,setLoaded]=useState(false);
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);
  const[newCitation,setNewCitation]=useState("");

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","textes"));
        if(snap.exists()){
          const d=snap.data();
          setCitations(d.citations||CITATIONS_DEFAULT);
          setMessageAccueil(d.messageAccueil||"");
        } else {
          setCitations(CITATIONS_DEFAULT);
        }
      }catch{
        setCitations(CITATIONS_DEFAULT);
      }
      setLoaded(true);
    })();
  },[]);

  const save=async(nextCitations,nextMsg)=>{
    setSaving(true);
    try{await setDoc(doc(db,"admin","textes"),{citations:nextCitations,messageAccueil:nextMsg});}catch{}
    setSaving(false);
    setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  };

  const addCitation=()=>{
    if(!newCitation.trim())return;
    const next=[...citations,newCitation.trim()];
    setCitations(next);
    setNewCitation("");
    save(next,messageAccueil);
  };

  const delCitation=(idx)=>{
    const next=citations.filter((_,i)=>i!==idx);
    setCitations(next);
    save(next,messageAccueil);
  };

  const saveMsg=()=>save(citations,messageAccueil);

  if(!loaded) return <div style={{fontSize:".74rem",color:C.gris}}>Chargement...</div>;

  return(
    <div>
      {/* Message d'accueil équipe */}
      <div style={{marginBottom:"1.25rem"}}>
        <div style={{fontSize:".65rem",fontWeight:700,color:C.brun,marginBottom:".4rem"}}>👋 Message d'accueil (page d'accueil de l'équipe)</div>
        <textarea
          placeholder="Ex: Bienvenue dans ton espace Blazing Dynasty ! On est fières de t'avoir avec nous 🖤"
          value={messageAccueil}
          onChange={e=>setMessageAccueil(e.target.value)}
          style={{width:"100%",minHeight:70,border:`1px solid ${C.pale}`,borderRadius:9,padding:".6rem .8rem",fontFamily:"inherit",fontSize:".76rem",color:C.texte,background:C.creme,resize:"vertical",outline:"none",lineHeight:1.6,marginBottom:".5rem"}}/>
        <button onClick={saveMsg} disabled={saving}
          style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:9,padding:".5rem",fontSize:".76rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          {saving?"Sauvegarde...":saved?"✅ Sauvegardé !":"Sauvegarder le message"}
        </button>
      </div>

      {/* Citations */}
      <div>
        <div style={{fontSize:".65rem",fontWeight:700,color:C.brun,marginBottom:".4rem"}}>✨ Citations motivantes ({citations.length})</div>
        <p style={{fontSize:".68rem",color:C.gris,marginBottom:".5rem",lineHeight:1.5}}>Une citation différente s'affiche chaque jour sur la page d'accueil, dans l'ordre du jour de l'année (rotation automatique).</p>
        <div style={{display:"flex",gap:".4rem",marginBottom:".75rem"}}>
          <input placeholder="Nouvelle citation..." value={newCitation} onChange={e=>setNewCitation(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addCitation()}
            style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
          <button onClick={addCitation} disabled={saving||!newCitation.trim()}
            style={{background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".42rem .8rem",fontSize:".76rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",flexShrink:0}}>
            Ajouter
          </button>
        </div>
        <div style={{maxHeight:280,overflowY:"auto"}}>
          {citations.map((c,i)=>(
            <div key={i} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:8,padding:".5rem .7rem",marginBottom:".3rem",display:"flex",gap:".5rem",alignItems:"flex-start"}}>
              <div style={{flex:1,fontSize:".74rem",color:C.texte,fontStyle:"italic",lineHeight:1.5}}>{c}</div>
              <button onClick={()=>delCitation(i)} style={{background:"none",border:"none",color:"#B04040",cursor:"pointer",fontSize:".7rem",padding:".15rem",fontFamily:"inherit",flexShrink:0}}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── BANQUE D'IMAGES ───────────────────────────────────────────────────────────
const THEMES_IMAGES=[
  {id:"skincare",icon:"✨",label:"Skincare"},
  {id:"cheveux",icon:"💇",label:"Soins cheveux"},
  {id:"makeup",icon:"💄",label:"Make-up"},
  {id:"complements",icon:"💊",label:"Compléments"},
  {id:"parfums",icon:"🌸",label:"Parfums"},
  {id:"corps",icon:"🧴",label:"Soin corps"},
  {id:"home",icon:"🏠",label:"HOME"},
  {id:"perte_poids",icon:"⚖️",label:"Perte de poids"},
  {id:"recrutement",icon:"👑",label:"Recrutement"},
  {id:"outils",icon:"🛠️",label:"Outils équipe"},
];

function BanqueImagesTab({isMelissa}){
  const[images,setImages]=useState([]);
  const[theme,setTheme]=useState("skincare");
  const[sousTheme,setSousTheme]=useState("visuels");
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({titre:"",url:"",theme:"skincare",sousTheme:"visuels"});
  const[saving,setSaving]=useState(false);
  const[loaded,setLoaded]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"banque","images"));
        if(snap.exists()) setImages(snap.data().items||[]);
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const saveImages=async(items)=>{
    setSaving(true);
    try{await setDoc(doc(db,"banque","images"),{items});}catch{}
    setSaving(false);
  };

  const add=async()=>{
    if(!form.titre.trim()||!form.url.trim())return;
    const item={id:`img${Date.now()}`,...form};
    const next=[...images,item];
    setImages(next);await saveImages(next);
    setForm({titre:"",url:"",theme:"skincare",sousTheme:"visuels"});
    setShowAdd(false);
  };

  const del=async(id)=>{
    const next=images.filter(i=>i.id!==id);
    setImages(next);await saveImages(next);
  };

  const filtered=images.filter(i=>i.theme===theme&&i.sousTheme===sousTheme);

  if(!loaded)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Banque <em style={{fontStyle:"italic",color:C.rose}}>d'Images</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Télécharge les visuels et témoignages pour tes publications.
      </p>

      {isMelissa&&(
        <button onClick={()=>setShowAdd(p=>!p)}
          style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:"1rem"}}>
          ➕ Ajouter une image
        </button>
      )}

      {showAdd&&isMelissa&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>Nouvelle image</div>
          <input placeholder="Titre (ex: Avant/Après Skincare)" value={form.titre} onChange={e=>setForm(p=>({...p,titre:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".45rem"}}/>
          <UploadPhoto label="Photo" value={form.url} onChange={v=>setForm(p=>({...p,url:v}))} folder="banque-images"/>
          <div style={{display:"flex",gap:".4rem",marginBottom:".45rem",marginTop:".3rem"}}>
            <select value={form.theme} onChange={e=>setForm(p=>({...p,theme:e.target.value}))}
              style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}>
              {THEMES_IMAGES.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
            </select>
            <select value={form.sousTheme} onChange={e=>setForm(p=>({...p,sousTheme:e.target.value}))}
              style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}>
              <option value="visuels">📸 Visuels</option>
              <option value="temoignages">💬 Témoignages</option>
            </select>
          </div>
          <div style={{display:"flex",gap:".4rem"}}>
            <button onClick={add} disabled={saving||!form.titre.trim()||!form.url.trim()}
              style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".52rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              {saving?"...":"Ajouter"}
            </button>
            <button onClick={()=>setShowAdd(false)}
              style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".52rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Filtres thèmes */}
      <div style={{display:"flex",gap:".3rem",overflowX:"auto",marginBottom:".75rem",paddingBottom:".3rem"}}>
        {THEMES_IMAGES.map(t=>(
          <button key={t.id} onClick={()=>setTheme(t.id)}
            style={{flex:"none",padding:".35rem .7rem",fontSize:".65rem",fontWeight:600,borderRadius:20,border:`1px solid ${theme===t.id?C.rose:C.pale}`,background:theme===t.id?C.rose:C.blanc,color:theme===t.id?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Sous-thème */}
      <div style={{display:"flex",gap:".4rem",marginBottom:"1rem"}}>
        {[{id:"visuels",label:"📸 Visuels"},{id:"temoignages",label:"💬 Témoignages"}].map(s=>(
          <button key={s.id} onClick={()=>setSousTheme(s.id)}
            style={{flex:1,padding:".4rem",fontSize:".72rem",fontWeight:600,borderRadius:9,border:`1px solid ${sousTheme===s.id?C.brun:C.pale}`,background:sousTheme===s.id?C.brun:C.blanc,color:sousTheme===s.id?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Grille d'images */}
      {filtered.length===0&&(
        <div style={{textAlign:"center",padding:"2.5rem 1rem",color:C.gris}}>
          <div style={{fontSize:"2rem",marginBottom:".5rem"}}>🖼️</div>
          <div style={{fontSize:".76rem"}}>
            {isMelissa?"Aucune image dans cette catégorie. Ajoutes-en une !":"Melissa n'a pas encore ajouté d'images ici."}
          </div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".65rem"}}>
        {filtered.map(img=>(
          <div key={img.id} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,overflow:"hidden",position:"relative"}}>
            <div style={{aspectRatio:"1",background:C.creme,overflow:"hidden",cursor:"pointer"}}
              onClick={()=>window.open(img.url,"_blank")}>
              <img src={img.url} alt={img.titre}
                style={{width:"100%",height:"100%",objectFit:"cover"}}
                onError={e=>{e.target.style.display="none";}}/>
            </div>
            <div style={{padding:".5rem .65rem"}}>
              <div style={{fontSize:".72rem",fontWeight:600,color:C.brun,marginBottom:".35rem"}}>{img.titre}</div>
              <div style={{display:"flex",gap:".3rem"}}>
                <a href={img.url} download target="_blank" rel="noopener noreferrer"
                  style={{flex:1,background:C.brun,color:C.blanc,borderRadius:7,padding:".3rem",fontSize:".65rem",fontWeight:600,textDecoration:"none",textAlign:"center",display:"block"}}>
                  ⬇ Télécharger
                </a>
                {isMelissa&&(
                  <button onClick={()=>del(img.id)}
                    style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:7,padding:".3rem .5rem",color:"#B04040",cursor:"pointer",fontSize:".65rem",fontFamily:"inherit"}}>✕</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DIAGNOSTICS ───────────────────────────────────────────────────────────────

export { StatsEquipeTab, SuiviCATab, ResumeSemaineChef, EspaceChefTab, MonEquipeTab, AdminConfigPeriodes, AdminLinkBioSection, AdminImportCatalogue, AdminTab, DevPersoSection, AdminContentBlock, AdminContentItem, AdminPostsEditor, AdminScriptsEditor, AdminTextesEditor, BanqueImagesTab };