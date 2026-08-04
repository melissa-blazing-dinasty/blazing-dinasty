export function ObjPersoTab({obj,save,uid,userName,distributeurs=[]}){
  const[confettiTrigger,setConfettiTrigger]=useState(0);
  const[fireworksTrigger,setFireworksTrigger]=useState(0);
  const[showDecouverte,setShowDecouverte]=useState(false);
  const[suiviCATotal,setSuiviCATotal]=useState(0);useEffect(()=>{(async()=>{try{const snap=await getDoc(doc(db,"users",uid));if(snap.exists()&&snap.data()["db-suivi-ca"]){const sc=JSON.parse(snap.data()["db-suivi-ca"]);const total=Object.values(sc).reduce((s,v)=>s+(parseFloat(v)||0),0);setSuiviCATotal(total);}}catch{}})();},[uid]);
  const[graphEnGros,setGraphEnGros]=useState(null);
  const[recrutementOuvert,setRecrutementOuvert]=useState(()=>!!(obj.recruesObj&&obj.recruesObj!=="0"));
  const raw=getPeriodeInfo();
  const pCourant=getPeriodeActuelle();

  // Score période précédente depuis l'historique
  const histPerso=obj.historique||[];
  const dernierHist=histPerso.length>0?histPerso[histPerso.length-1]:null;
  const scorePrecBadge=dernierHist?(
    <div style={{display:"flex",gap:".5rem",alignItems:"center",background:"rgba(196,154,138,.1)",border:`1px solid ${C.pale}`,borderRadius:8,padding:".3rem .65rem",marginBottom:".6rem",flexWrap:"wrap"}}>
      <span style={{fontSize:".58rem",color:C.gris}}>📊 Période précédente ({fmtPLabel(dernierHist.periode||pCourant-1)}) :</span>
      <span style={{fontSize:".65rem",fontWeight:700,color:C.rose}}>💰 {dernierHist.ca||0}€</span>
      <span style={{fontSize:".65rem",fontWeight:700,color:C.brun}}>🛍️ {dernierHist.caPerso||0}€ perso</span>
      <span style={{fontSize:".65rem",fontWeight:700,color:C.lilas}}>👥 {dernierHist.recruesReal||0} recrues</span>
    </div>
  ):null;

  const pctCA=()=>{if(!obj.caObj||!obj.ca)return 0;return Math.min(100,Math.round(+obj.ca/+obj.caObj*100));};
  const pctR=()=>{if(!obj.recruesObj||obj.recruesObj==="0"||!obj.recruesReal)return 0;return Math.min(100,Math.round(+obj.recruesReal/+obj.recruesObj*100));};
  const pct=(r,o)=>{if(!o||!r)return 0;return Math.min(100,Math.round(+r/+o*100));};

  const checkAndCelebrate=(nextObj)=>{
    const wasNot100CA=pctCA()<100,wasNot100R=pctR()<100;
    const nextPctCA=(!nextObj.caObj||!nextObj.ca)?0:Math.min(100,Math.round(+nextObj.ca/+nextObj.caObj*100));
    const nextPctR=(!nextObj.recruesObj||nextObj.recruesObj==="0"||!nextObj.recruesReal)?0:Math.min(100,Math.round(+nextObj.recruesReal/+nextObj.recruesObj*100));
    if((wasNot100CA&&nextPctCA>=100)||(wasNot100R&&nextPctR>=100))setConfettiTrigger(t=>t+1);
    if(wasNot100CA&&nextPctCA>=100&&uid&&userName)postToWallOfFame(uid,userName,"a atteint son objectif CA ! 💰","🎉");
    if(wasNot100R&&nextPctR>=100&&uid&&userName)postToWallOfFame(uid,userName,"a atteint son objectif recrutement ! 👥","🎉");
    save(nextObj);
  };

  const historique=obj.historique||[];
  const snapshotNow=()=>{
    const entry={date:todayLocalStr(),ca:+obj.ca||0,caObj:+obj.caObj||0,caPerso:+obj.caPerso||0,recruesReal:+obj.recruesReal||0,recruesObj:+obj.recruesObj||0,palier:obj.palier||"2%"};
    return [...historique,entry].slice(-24);
  };

  const resetPeriode=async()=>{
    const hist=snapshotNow();
    const next={...obj,ca:"",caObj:"",caPerso:"",caEquipe:"",recruesReal:"0",historique:hist};
    const totalCaCumul=(+obj.totalCaCumul||0)+(+obj.ca||0);
    const totalRecruesCumul=(+obj.totalRecruesCumul||0)+(+obj.recruesReal||0);
    checkAndCelebrate({...next,totalCaCumul,totalRecruesCumul});
  };

  const enregistrerPoint=()=>{save({...obj,historique:snapshotNow()});};
  const comparaisonPeriode=(hist,valActuelle,key)=>{if(!hist||hist.length<1)return null;const last=hist[hist.length-1];const prev=last[key]||0;const curr=+valActuelle||0;const diff=curr-prev;const pct2=prev?Math.round(diff/prev*100):0;return{diff,previous:prev,pct:pct2};};

  const PALIERS_PERSO=["2%","4%","6%","8%","10%","12%","14%","17%","SR","Directeur","Structural","Business Director","SR Business Director","Business"];
  const currentPalierIdx=PALIERS_PERSO.indexOf(obj.palier||"2%");
  const nextPalier=currentPalierIdx<PALIERS_PERSO.length-1?PALIERS_PERSO[currentPalierIdx+1]:null;

  // Mini graphique inline
  const MiniGraph=({data,dataKey,color,label,onClick})=>{
    if(!data||data.length<2)return null;
    const vals=data.map(d=>+d[dataKey]||0);
    const max=Math.max(...vals,1);
    const w=120,h=50;
    const pts=vals.map((v,i)=>`${Math.round(i/(vals.length-1)*w)},${Math.round(h-(v/max*h*.85+h*.05))}`).join(" ");
    return(
      <div onClick={onClick} style={{flex:1,minWidth:0,cursor:"pointer",padding:".4rem",background:C.blanc,borderRadius:9,border:`1px solid ${C.pale}`,transition:"transform .15s"}} title="Cliquer pour agrandir">
        <div style={{fontSize:".58rem",color:C.gris,marginBottom:".2rem",fontWeight:600}}>{label}</div>
        <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",height:50,display:"block"}}>
          <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} fillOpacity={.12} stroke="none"/>
        </svg>
        <div style={{fontSize:".55rem",color,fontWeight:700,textAlign:"right",marginTop:".1rem"}}>{vals[vals.length-1]}</div>
      </div>
    );
  };

  // Graphique en grand (popup)
  const GrandGraph=({data,dataKey,color,label,unit=""})=>{
    const vals=data.map(d=>+d[dataKey]||0);
    const dates=data.map(d=>d.date?.slice(5)||"");
    const max=Math.max(...vals,1);
    const w=280,h=120;
    const pts=vals.map((v,i)=>`${Math.round(i/(vals.length-1)*w)},${Math.round(h-(v/max*h*.85+h*.05))}`).join(" ");
    return(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}} onClick={()=>setGraphEnGros(null)}>
        <div style={{background:C.blanc,borderRadius:16,padding:"1.25rem",width:"90%",maxWidth:360}} onClick={e=>e.stopPropagation()}>
          <div style={{fontFamily:"Georgia,serif",fontSize:".95rem",fontWeight:600,color:C.brun,marginBottom:".75rem"}}>{label}</div>
          <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",height:140,display:"block",marginBottom:".5rem"}}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} fillOpacity={.1} stroke="none"/>
            {vals.map((v,i)=>(
              <g key={i}>
                <circle cx={Math.round(i/(vals.length-1)*w)} cy={Math.round(h-(v/max*h*.85+h*.05))} r={3} fill={color}/>
                <text x={Math.round(i/(vals.length-1)*w)} y={h-2} textAnchor="middle" fontSize="7" fill={C.gris}>{dates[i]}</text>
              </g>
            ))}
          </svg>
          {vals.map((v,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:".65rem",color:C.gris,padding:".2rem 0",borderBottom:`1px solid ${C.pale}`}}>
              <span>{dates[i]||`Point ${i+1}`}</span>
              <span style={{fontWeight:700,color}}>{v}{unit}</span>
            </div>
          ))}
          <button onClick={()=>setGraphEnGros(null)} style={{width:"100%",marginTop:".75rem",background:C.brun,color:C.blanc,border:"none",borderRadius:9,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>Fermer</button>
        </div>
      </div>
    );
  };

  return(
    <div>
      <Confetti trigger={confettiTrigger}/>
      <Fireworks trigger={fireworksTrigger}/>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:".5rem"}}><button onClick={()=>setShowDecouverte(true)} style={{background:"#C49A8A",color:"white",border:"none",borderRadius:20,padding:".35rem 1rem",fontSize:".75rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(196,154,138,.4)"}}>🧭 Découverte</button></div>
      {showDecouverte&&<DecouverteTour outil="objectifs" onClose={()=>setShowDecouverte(false)}/>}
      {graphEnGros&&historique.length>=2&&<GrandGraph data={historique} dataKey={graphEnGros} color={graphEnGros==="recruesReal"?C.lilas:graphEnGros==="caPerso"?C.rose:C.brun} label={graphEnGros==="recruesReal"?"👥 Recrues":graphEnGros==="caPerso"?"🛍️ Ventes perso":"💰 CA total"} unit={graphEnGros==="recruesReal"?"":" €"}/>}

      {/* 1. PÉRIODE EN COURS */}
      <div id="decouverte-periode" style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:12,padding:".85rem 1rem",marginBottom:".75rem",color:C.blanc}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:".55rem",fontWeight:700,color:C.or,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".15rem"}}>⏱️ Période en cours</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,color:C.blanc}}>{fmtPLabel(pCourant)}</div>
            <div style={{fontSize:".65rem",color:C.pale}}>{raw.daysLeft}j {raw.hoursLeft}h restants</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{height:4,width:80,background:"rgba(255,255,255,.15)",borderRadius:10,overflow:"hidden",marginBottom:".2rem"}}>
              <div style={{height:"100%",background:C.or,width:raw.pctElapsed+"%",borderRadius:10}}/>
            </div>
            <div style={{fontSize:".58rem",color:C.pale}}>{raw.pctElapsed}% écoulé</div>
          </div>
        </div>
      </div>

      {/* Bouton confirmer objectifs posés */}
      {obj.objectifsPosesPeriode!==pCourant&&(
        <button onClick={()=>save({...obj,objectifsPosesPeriode:pCourant})}
          style={{width:"100%",background:C.creme,border:`1.5px dashed ${C.or}`,borderRadius:10,padding:".5rem",fontSize:".75rem",fontWeight:600,color:"#856404",fontFamily:"inherit",cursor:"pointer",marginBottom:".75rem"}}>
          ✅ Mes objectifs sont posés pour cette période
        </button>
      )}

      {/* Score période précédente */}
      {scorePrecBadge}

      {/* 2. TOTAL DEPUIS LE DÉBUT */}
      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem .85rem",marginBottom:".75rem"}}>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",fontWeight:700,color:C.brun}}>{(+obj.totalCaCumul||0)+(+obj.ca||0)+(+suiviCATotal||0)}€</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",fontWeight:700,color:C.brun}}>{(+obj.totalCaCumul||0)+(+obj.ca||0)}€</div>
        <div style={{fontSize:".58rem",color:C.gris}}>{(+obj.totalRecruesCumul||0)+(+obj.recruesReal||0)} recrues total</div>
      </div>

      {/* 3. PALIER À ATTEINDRE */}
      <div id="decouverte-palier" style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem 1rem",marginBottom:".75rem"}}>
        <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.or,marginBottom:".5rem"}}>🎯 Palier à atteindre</div>
        <div style={{display:"flex",gap:".4rem",flexWrap:"wrap"}}>
          {PALIERS_PERSO.map((p,idx)=>(
            <button key={p} onClick={()=>save({...obj,palier:p})}
              style={{padding:".3rem .55rem",fontSize:".65rem",fontWeight:600,borderRadius:8,border:`1.5px solid ${obj.palier===p?C.or:C.pale}`,background:idx<currentPalierIdx?"#E8F5E9":obj.palier===p?C.or+"20":C.blanc,color:idx<currentPalierIdx?C.vert:obj.palier===p?C.brun:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              {idx<currentPalierIdx?"✓ ":""}{p}
            </button>
          ))}
        </div>
        {nextPalier&&<div style={{fontSize:".65rem",color:C.gris,marginTop:".4rem"}}>Prochain palier → <strong style={{color:C.brun}}>{nextPalier}</strong></div>}
      </div>

      {/* 4. CHIFFRE D'AFFAIRES */}
      <div id="decouverte-ca" style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:".75rem"}}>
        <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>💰 Chiffre d'affaires</div>
        <div style={{display:"flex",gap:".5rem",marginBottom:".6rem"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:".62rem",color:C.gris,marginBottom:".25rem"}}><T k="obj.objectif">Objectif (€)</T></div>
            <input type="number" placeholder="Ex: 500" value={obj.caObj||""} onChange={e=>save({...obj,caObj:e.target.value})}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".9rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none",fontWeight:600}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:".62rem",color:C.gris,marginBottom:".25rem"}}><T k="obj.ca_total">CA total = ventes équipe (€)</T></div>
            <input type="number" placeholder="Ex: 250" value={obj.ca||""} onChange={e=>checkAndCelebrate({...obj,ca:e.target.value,caEquipe:String(Math.max(0,(parseFloat(e.target.value)||0)-(parseFloat(obj.caPerso)||0)))})}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".9rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none",fontWeight:600}}/>
          </div>
        </div>
        <div style={{background:C.creme,borderRadius:9,padding:".45rem .7rem",marginBottom:".5rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%"}}><span style={{fontSize:".68rem",color:C.gris}}>🛍️ Dont mes ventes perso</span><span style={{fontSize:".62rem",color:C.gris}}>Objectif : <input type="number" placeholder="0" value={obj.caPersoObj||""} onChange={e=>save({...obj,caPersoObj:e.target.value})} style={{width:55,border:"1px solid "+C.rose+"40",borderRadius:6,padding:".2rem .35rem",fontSize:".72rem",fontFamily:"inherit",color:C.rose,background:"white",outline:"none",textAlign:"center"}}/> €</span></div>
          <div style={{display:"flex",gap:".4rem",alignItems:"center"}}>
            <span style={{fontSize:".62rem",color:C.gris,fontWeight:600,marginRight:".25rem"}}>Réalisé</span>
            <input type="number" placeholder="0" value={obj.caPerso||""} onChange={e=>{
              const perso=parseFloat(e.target.value)||0;
              save({...obj,caPerso:e.target.value,caEquipe:String(Math.max(0,(parseFloat(obj.ca)||0)-perso))});
            }} style={{width:70,border:`1px solid ${C.rose}40`,borderRadius:7,padding:".28rem .45rem",fontSize:".8rem",fontFamily:"inherit",color:C.brun,background:"white",outline:"none",fontWeight:600,textAlign:"right"}}/>
            <span style={{fontSize:".65rem",color:C.gris}}>€</span>
          </div>
        </div>
        <div style={{height:8,background:C.pale,borderRadius:10,overflow:"hidden",marginBottom:".3rem"}}>
          <div style={{height:"100%",background:pctCA()>=100?C.vert:C.rose,width:pctCA()+"%",borderRadius:10,transition:"width .4s"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:".62rem",color:C.gris}}>
          <span>CA équipe : {Math.max(0,(parseFloat(obj.ca)||0)-(parseFloat(obj.caPerso)||0))}€</span>
          <span style={{fontWeight:700,color:pctCA()>=100?C.vert:C.rose}}>{pctCA()}%</span>
        </div>
        {pctCA()>=100&&<div style={{textAlign:"center",fontSize:".75rem",color:C.vert,fontWeight:700,marginTop:".4rem"}}>🎉 Objectif CA atteint !</div>}

        {/* Recrues */}
        {recrutementOuvert&&(
          <div style={{marginTop:".75rem",paddingTop:".6rem",borderTop:`1px solid ${C.pale}`}}>
            <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.lilas,marginBottom:".4rem"}}>👥 Recrues</div>
            <div style={{display:"flex",gap:".5rem"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem"}}>Objectif</div>
                <input type="number" placeholder="0" value={obj.recruesObj||""} onChange={e=>save({...obj,recruesObj:e.target.value})}
                  style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".38rem .55rem",fontSize:".82rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none",fontWeight:600}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem"}}>Réalisé</div>
                <input type="number" placeholder="0" value={obj.recruesReal||""} onChange={e=>checkAndCelebrate({...obj,recruesReal:e.target.value})}
                  style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".38rem .55rem",fontSize:".82rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none",fontWeight:600}}/>
              </div>
            </div>
            <div style={{height:6,background:C.pale,borderRadius:10,overflow:"hidden",marginTop:".4rem"}}>
              <div style={{height:"100%",background:pctR()>=100?C.vert:C.lilas,width:pctR()+"%",borderRadius:10}}/>
            </div>
            <button onClick={()=>{setRecrutementOuvert(false);save({...obj,recruesObj:"0",recruesReal:""});}}
              style={{marginTop:".4rem",background:"none",border:"none",color:C.gris,fontSize:".64rem",fontFamily:"inherit",cursor:"pointer",textDecoration:"underline"}}>
              Retirer cet objectif
            </button>
          </div>
        )}
        {!recrutementOuvert&&(
          <button onClick={()=>{setRecrutementOuvert(true);save({...obj,recruesObj:"1"});}} style={{marginTop:".5rem",background:"none",border:`1px dashed ${C.pale}`,borderRadius:8,padding:".35rem .65rem",fontSize:".68rem",color:C.gris,fontFamily:"inherit",cursor:"pointer",width:"100%"}}>
            + Ajouter un objectif recrutement
          </button>
        )}
      </div>

      {/* 5. CALCUL DU RESTE */}
      <div id="decouverte-reste"><ResteCalculateur obj={obj} save={save} distributeurs={distributeurs}/></div>

      {/* 6. GRAPHIQUES CÔTE À CÔTE */}
      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem",marginBottom:".75rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".6rem"}}>
            <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.gris}}>📈 Évolution</div>
            <button onClick={enregistrerPoint} style={{background:C.lilas,color:"white",border:"none",borderRadius:7,padding:".22rem .55rem",fontSize:".62rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>+ Point</button>
          </div>
          <div style={{display:"flex",gap:".5rem"}}>
            {historique.length>=2?(<>
              <MiniGraph data={historique} dataKey="ca" color={C.brun} label="💰 CA total" onClick={()=>setGraphEnGros("ca")}/>
            <MiniGraph data={historique} dataKey="caPerso" color={C.rose} label="🛍️ Ventes perso" onClick={()=>setGraphEnGros("caPerso")}/>
            <MiniGraph data={historique} dataKey="recruesReal" color={C.lilas} label="👥 Recrues" onClick={()=>setGraphEnGros("recruesReal")}/>
            </>):(
              <div style={{textAlign:"center",padding:"1rem .5rem",fontSize:".72rem",color:C.gris,lineHeight:1.6}}>
                Reviens ici une fois que tu auras enregistre au moins 2 periodes pour voir tes graphiques d'evolution.
              </div>
            )}
          </div>
          <div style={{fontSize:".58rem",color:C.pale,textAlign:"center",marginTop:".4rem"}}>Clique sur un graphique pour l'agrandir</div>
        </div>

      {/* 7. PRIMES DE QUALIFICATION */}
      <PrimesAccordeon obj={obj} save={save} onPrimeValidee={()=>setFireworksTrigger(t=>t+1)}/>
    </div>
  );
}

// ── GESTION MEMBRES (Melissa uniquement) ─────────────────────────────────────