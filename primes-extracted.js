function PrimesQualificationSection({obj, save, onPrimeValidee}){
  const qualifs = obj.qualifs || {};

  const setDirecteurs=(palierId, n)=>{
    const current = qualifs[palierId] || {directeurs:0, periodes:{}, primes:{}, pts:0};
    save({...obj, qualifs:{...qualifs, [palierId]:{...current, directeurs:n}}});
  };

  const setPts=(palierId, n)=>{
    const current = qualifs[palierId] || {directeurs:0, periodes:{}, primes:{}, pts:0};
    save({...obj, qualifs:{...qualifs, [palierId]:{...current, pts:n}}});
  };

  const togglePeriode=(palierId, periodeKey)=>{
    const current = qualifs[palierId] || {directeurs:0, periodes:{}, primes:{}, pts:0};
    const periodes = {...(current.periodes||{}), [periodeKey]:!current.periodes?.[periodeKey]};
    const next = {...current, periodes};

    const keys = getPeriodKeys(12);

    // Calcul des consécutives : trouve le nombre max de périodes consécutives dans les 12
    // (pas forcément depuis la fin — on cherche le max)
    let maxConsecutifs=0, courant=0;
    for(let i=0;i<keys.length;i++){
      if(periodes[keys[i]]){ courant++; maxConsecutifs=Math.max(maxConsecutifs,courant); }
      else courant=0;
    }
    // Consécutives depuis la fin (les plus récentes)
    let consecutifsRecents=0;
    for(let i=keys.length-1;i>=0;i--){
      if(periodes[keys[i]]) consecutifsRecents++;
      else break;
    }

    const totalSur12 = keys.filter(k=>periodes[k]).length;

    const primes = {...(current.primes||{})};

    // Prime 1 : 2 périodes consécutives
    if(maxConsecutifs>=2 && !primes.consecutif){
      primes.consecutif=true;
      setTimeout(()=>onPrimeValidee&&onPrimeValidee(), 100);
    }

    // Prime 2 : 6 périodes sur 12
    if(totalSur12>=6 && !primes.sur12){
      primes.sur12=true;
      setTimeout(()=>onPrimeValidee&&onPrimeValidee(), 600); // décalé pour que les deux feux s'enchaînent
    }

    next.primes = primes;
    save({...obj, qualifs:{...qualifs, [palierId]:next}});
  };

  const currentIdx = PALIERS_PERSO.indexOf(obj.palier||"2%");
  const srIdx = PALIERS_PERSO.indexOf("SR");
  if(currentIdx < srIdx) return null;

  const periodeKeys = getPeriodKeys(12);
  const currentPeriode = getPeriodeActuelle();

  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:".75rem"}}>
      <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.or,marginBottom:".3rem"}}>💎 Primes de qualification</div>
      <p style={{fontSize:".66rem",color:C.gris,marginBottom:".75rem",lineHeight:1.6}}>
        Coche les périodes de 21 jours où tu valides la qualification. 2 périodes consécutives ou 6 sur 12 → prime débloquée 🎉
      </p>

      {PALIERS_QUALIFICATION.map(pq=>{
        const q = qualifs[pq.id] || {directeurs:0, periodes:{}, primes:{}, pts:0};
        const periodes = q.periodes || {};
        // Consécutives récentes (depuis la fin)
        let consecutifs=0;
        for(let i=periodeKeys.length-1;i>=0;i--){
          if(periodes[periodeKeys[i]]) consecutifs++;
          else break;
        }
        // Max consécutives sur les 12
        let maxConsecutifs=0, courant=0;
        for(let i=0;i<periodeKeys.length;i++){
          if(periodes[periodeKeys[i]]){ courant++; maxConsecutifs=Math.max(maxConsecutifs,courant); }
          else courant=0;
        }
        const totalSur12 = periodeKeys.filter(k=>periodes[k]).length;

        // Condition SR : 7500 pts OU 1 directeur
        const srPtsValide = pq.ptsOU && (q.pts||0)>=pq.pts;
        const srDirValide = pq.ptsOU && q.directeurs>=1;
        const srQualifie = pq.ptsOU ? (srPtsValide || srDirValide) : true;

        return(
          <div key={pq.id} style={{marginBottom:"1rem",paddingBottom:"1rem",borderBottom:`1px solid ${C.pale}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:".4rem"}}>
              <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:C.brun}}>{pq.id}</div>
              <div style={{fontSize:".68rem",fontWeight:700,color:C.or}}>{pq.prime}€ par prime</div>
            </div>

            {/* Condition SR double */}
            {pq.ptsOU&&(
              <div style={{background:C.creme,borderRadius:8,padding:".5rem .7rem",marginBottom:".5rem",fontSize:".68rem",color:C.gris}}>
                <div style={{fontWeight:700,color:C.brun,marginBottom:".3rem"}}>Condition d'accès (au choix) :</div>
                <div style={{display:"flex",gap:".4rem",flexWrap:"wrap"}}>
                  {/* Option A : 7500 pts */}
                  <div style={{flex:1,background:srPtsValide?C.vert+"20":C.blanc,border:`1.5px solid ${srPtsValide?C.vert:C.pale}`,borderRadius:8,padding:".5rem .65rem"}}>
                    <div style={{fontSize:".62rem",fontWeight:700,color:srPtsValide?C.vert:C.gris,marginBottom:".3rem"}}>Option A — 7 500 pts</div>
                    <div style={{display:"flex",alignItems:"center",gap:".4rem"}}>
                      <input type="number" value={q.pts||""} onChange={e=>setPts(pq.id,+e.target.value||0)}
                        placeholder="0"
                        style={{width:70,border:`1px solid ${C.pale}`,borderRadius:6,padding:".25rem .4rem",fontSize:".78rem",fontFamily:"inherit",textAlign:"center"}}/>
                      <span style={{fontSize:".62rem",color:C.gris}}>/ 7500 pts</span>
                      {srPtsValide&&<span style={{color:C.vert,fontWeight:700,fontSize:".68rem"}}>✓</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",fontSize:".72rem",color:C.gris,fontWeight:700}}>OU</div>
                  {/* Option B : 1 directeur */}
                  <div style={{flex:1,background:srDirValide?C.vert+"20":C.blanc,border:`1.5px solid ${srDirValide?C.vert:C.pale}`,borderRadius:8,padding:".5rem .65rem"}}>
                    <div style={{fontSize:".62rem",fontWeight:700,color:srDirValide?C.vert:C.gris,marginBottom:".3rem"}}>Option B — 1 Directeur</div>
                    <div onClick={()=>setDirecteurs(pq.id, q.directeurs>=1?0:1)}
                      style={{width:24,height:24,borderRadius:6,border:`2px solid ${srDirValide?C.vert:C.pale}`,background:srDirValide?C.vert:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:".7rem",color:"white",fontWeight:700}}>
                      {srDirValide?"✓":"1"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Directeurs requis (non-SR) */}
            {pq.nbDirecteurs>0&&!pq.ptsOU&&(
              <div style={{display:"flex",alignItems:"center",gap:".4rem",marginBottom:".5rem",flexWrap:"wrap"}}>
                <span style={{fontSize:".64rem",color:C.gris}}>Directeurs dans ma structure :</span>
                {Array.from({length:pq.nbDirecteurs},(_,i)=>i+1).map(n=>(
                  <div key={n} onClick={()=>setDirecteurs(pq.id, q.directeurs>=n?n-1:n)}
                    style={{width:22,height:22,borderRadius:6,border:`2px solid ${q.directeurs>=n?C.vert:C.pale}`,background:q.directeurs>=n?C.vert:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:".68rem",color:"white",fontWeight:700}}>
                    {q.directeurs>=n?"✓":n}
                  </div>
                ))}
                <span style={{fontSize:".62rem",color:q.directeurs>=pq.nbDirecteurs?C.vert:C.gris,fontWeight:600}}>
                  {q.directeurs}/{pq.nbDirecteurs} {q.directeurs>=pq.nbDirecteurs?"✓ Qualifiée !":""}
                </span>
              </div>
            )}

            {/* Grille périodes */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:".25rem",marginBottom:".5rem"}}>
              {periodeKeys.map(k=>{
                const num=parseInt(k.slice(1));
                const checked=periodes[k];
                const isCurrent = num===currentPeriode;
                return(
                  <div key={k} onClick={()=>togglePeriode(pq.id,k)}
                    style={{textAlign:"center",padding:".3rem 0",borderRadius:6,border:`1.5px solid ${checked?C.vert:isCurrent?C.rose:C.pale}`,background:checked?C.vert+"20":"transparent",cursor:"pointer"}}>
                    <div style={{fontSize:".58rem",fontWeight:600,color:checked?C.vert:isCurrent?C.rose:C.gris}}>{fmtPLabel(num)}</div>
                    <div style={{fontSize:".52rem",color:checked?C.vert:C.pale}}>{checked?"✓":""}</div>
                  </div>
                );
              })}
            </div>

            {/* Statut primes — 2 onglets débloquables */}
            <div style={{display:"flex",flexDirection:"column",gap:".35rem",marginTop:".5rem"}}>

              {/* Prime 1 : 2 consécutives */}
              <div style={{
                background:q.primes?.consecutif?`linear-gradient(135deg,${C.vert},#4a9a5a)`:maxConsecutifs>=2?C.or+"15":C.creme,
                border:`1.5px solid ${q.primes?.consecutif?C.vert:maxConsecutifs>=2?C.or:C.pale}`,
                borderRadius:10,padding:".6rem .85rem",
                display:"flex",justifyContent:"space-between",alignItems:"center"
              }}>
                <div>
                  <div style={{fontSize:".7rem",fontWeight:700,color:q.primes?.consecutif?"white":maxConsecutifs>=2?C.brun:C.gris}}>
                    {q.primes?.consecutif?"🎉 Prime 1 débloquée !":maxConsecutifs>=2?"✓ Condition remplie":"○ Prime 1"}
                  </div>
                  <div style={{fontSize:".6rem",color:q.primes?.consecutif?"rgba(255,255,255,.8)":C.gris,marginTop:".1rem"}}>
                    2 périodes consécutives · {maxConsecutifs}/2
                  </div>
                </div>
                <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:700,color:q.primes?.consecutif?"white":maxConsecutifs>=2?C.vert:C.gris}}>
                  {pq.prime}€
                </div>
              </div>

              {/* Prime 2 : 6 sur 12 */}
              <div style={{
                background:q.primes?.sur12?`linear-gradient(135deg,${C.or},#b8962a)`:totalSur12>=6?C.vert+"15":C.creme,
                border:`1.5px solid ${q.primes?.sur12?C.or:totalSur12>=6?C.vert:C.pale}`,
                borderRadius:10,padding:".6rem .85rem",
                display:"flex",justifyContent:"space-between",alignItems:"center"
              }}>
                <div>
                  <div style={{fontSize:".7rem",fontWeight:700,color:q.primes?.sur12?"white":totalSur12>=6?C.brun:C.gris}}>
                    {q.primes?.sur12?"🎉 Prime 2 débloquée !":totalSur12>=6?"✓ Condition remplie":"○ Prime 2"}
                  </div>
                  <div style={{fontSize:".6rem",color:q.primes?.sur12?"rgba(255,255,255,.8)":C.gris,marginTop:".1rem"}}>
                    6 périodes sur 12 · {totalSur12}/6
                  </div>
                </div>
                <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:700,color:q.primes?.sur12?"white":totalSur12>=6?C.vert:C.gris}}>
                  {pq.prime}€
                </div>
              </div>

              {/* Total débloqué */}
              {(q.primes?.consecutif||q.primes?.sur12)&&(
                <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:10,padding:".55rem .85rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontSize:".72rem",fontWeight:600,color:C.or}}>
                    💰 Total débloqué pour {pq.id}
                  </div>
                  <div style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",fontWeight:700,color:C.or}}>
                    {((q.primes?.consecutif?1:0)+(q.primes?.sur12?1:0)) * pq.prime}€
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );



}
