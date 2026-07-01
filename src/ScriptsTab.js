import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { C } from './constants';
import { CopyBtn, DecouverteTour } from './App';
import { SCRIPTS_DATA, OBJECTIONS_VENTE, OBJECTIONS_RECRUTEMENT } from './App';

function ObjectionBubbles({objections, titre, sousTitre}){
  const[open,setOpen]=useState(null);
  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        {titre}
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        {sousTitre}
      </p>
      <div style={{display:"flex",flexWrap:"wrap",gap:".4rem",marginBottom:"1rem"}}>
        {objections.map(o=>(
          <div key={o.id} onClick={()=>setOpen(open===o.id?null:o.id)}
            style={{padding:".45rem .85rem",borderRadius:20,fontSize:".74rem",fontWeight:600,cursor:"pointer",border:`1.5px solid ${open===o.id?C.rose:C.pale}`,background:open===o.id?C.rose:C.blanc,color:open===o.id?C.blanc:C.brun,transition:"all .2s"}}>
            {o.icon} {o.label}
          </div>
        ))}
      </div>
      {open&&(objections.find(x=>x.id===open))&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem"}}>
          <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".7rem"}}>{objections.find(x=>x.id===open).icon} Réponses possibles</div>
          {objections.find(x=>x.id===open).reponses.map((r,i)=>(
            <div key={i} style={{background:C.creme,borderLeft:`3px solid ${C.lilas}`,borderRadius:"0 8px 8px 0",padding:".6rem .8rem",fontSize:".74rem",color:C.texte,lineHeight:1.7,marginBottom:".5rem",display:"flex",justifyContent:"space-between",gap:".5rem",alignItems:"flex-start"}}>
              <span style={{flex:1}}>{r}</span>
              <CopyBtn text={r}/>
            </div>
          ))}
          <div style={{fontSize:".6rem",color:C.gris,fontStyle:"italic",marginTop:".3rem"}}>
            💡 Adapte le ton et les détails (durée, prénom...) à ta conversation avant d'envoyer.
          </div>
        </div>
      )}
    </div>
  );
}

export function ObjectionsTab(){
  const[mode,setMode]=useState("vente");
  return(
    <div>
      <div style={{display:"flex",gap:".3rem",marginBottom:"1rem"}}>
        <button onClick={()=>setMode("vente")}
          style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${mode==="vente"?C.rose:C.pale}`,background:mode==="vente"?C.rose:C.blanc,color:mode==="vente"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
          🛍️ Objections Vente
        </button>
        <button onClick={()=>setMode("recrutement")}
          style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${mode==="recrutement"?C.rose:C.pale}`,background:mode==="recrutement"?C.rose:C.blanc,color:mode==="recrutement"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
          👑 Objections Recrutement
        </button>
      </div>
      {mode==="vente"&&<ObjectionBubbles objections={OBJECTIONS_VENTE} titre={<>Objections <em style={{fontStyle:"italic",color:C.rose}}>Vente</em></>} sousTitre="Clique sur l'objection que ta cliente vient de te dire pour obtenir des réponses prêtes à copier-coller."/>}
      {mode==="recrutement"&&<ObjectionBubbles objections={OBJECTIONS_RECRUTEMENT} titre={<>Objections <em style={{fontStyle:"italic",color:C.rose}}>Recrutement</em></>} sousTitre="Clique sur l'objection que ta prospecte vient de te dire pour obtenir des réponses prêtes à copier-coller."/>}
    </div>
  );
}


function ScriptsTab(){
  const[open,setOpen]=useState({});
  const[showDecouverte,setShowDecouverte]=useState(false);
  const[adminScripts,setAdminScripts]=useState([]);
  const[loaded,setLoaded]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","scripts_extra"));
        if(snap.exists()) setAdminScripts(snap.data().items||[]);
      }catch{}
      setLoaded(true);
    })();
  },[]);

  return(
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:".5rem"}}><button onClick={()=>setShowDecouverte(true)} style={{background:"#C49A8A",color:"white",border:"none",borderRadius:20,padding:".35rem 1rem",fontSize:".75rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(196,154,138,.4)"}}>🧭 Découverte</button></div>
      {showDecouverte&&<DecouverteTour outil="scripts" onClose={()=>setShowDecouverte(false)}/>}
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Bibliothèque <em style={{fontStyle:"italic",color:C.rose}}>Scripts</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Scripts prêts à utiliser. Adapte toujours à ta voix — copie et personnalise.
      </p>

      {loaded&&adminScripts.length>0&&(
        <div style={{marginBottom:"1rem"}}>
          <div style={{fontSize:".65rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.brun,marginBottom:".5rem",padding:".25rem .7rem",background:C.or+"30",borderRadius:20,display:"inline-block"}}>✨ Ajoutés par Melissa</div>
          {adminScripts.map(cat=>{
            const isOpen=open["adm-"+cat.cat];
            return(
            <div key={"adm-"+cat.cat}>
              <div style={{fontSize:".65rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.brun,marginBottom:".5rem",marginTop:".5rem",padding:".25rem .7rem",background:C.pale,borderRadius:20,display:"inline-block"}}>{cat.cat}</div>
              {cat.scripts.map(s=>{
                const isOpenS=open["adm-"+s.title];
                return(
                  <div key={"adm-"+s.title} style={{background:C.blanc,border:`1px solid ${isOpenS?C.rose:C.pale}`,borderRadius:12,marginBottom:".45rem",overflow:"hidden"}}>
                    <div onClick={()=>setOpen(p=>({...p,["adm-"+s.title]:!p["adm-"+s.title]}))}
                      style={{padding:".7rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",userSelect:"none"}}>
                      <div style={{fontSize:".8rem",fontWeight:600,color:C.brun}}>{s.title}</div>
                      <div style={{display:"flex",gap:".5rem",alignItems:"center"}}>
                        <CopyBtn text={s.text}/>
                        <span style={{color:C.rose,fontSize:".65rem",transform:isOpenS?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
                      </div>
                    </div>
                    {isOpenS&&(
                      <div style={{borderTop:`1px solid ${C.pale}`,padding:".7rem 1rem .85rem",background:C.creme}}>
                        <p style={{fontSize:".78rem",color:C.texte,lineHeight:1.75,margin:0,fontStyle:"italic"}}>{s.text}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            );
          })}
        </div>
      )}

      <div id="decouverte-scripts-liste">
      {SCRIPTS_DATA.map(cat=>(
        <div key={cat.cat} style={{marginBottom:"1rem"}}>
          <div style={{fontSize:".65rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.brun,marginBottom:".5rem",padding:".25rem .7rem",background:C.pale,borderRadius:20,display:"inline-block"}}>{cat.cat}</div>
          {cat.scripts.map(s=>{
            const isOpen=open[s.title];
            return(
              <div key={s.title} style={{background:C.blanc,border:`1px solid ${isOpen?C.rose:C.pale}`,borderRadius:12,marginBottom:".45rem",overflow:"hidden"}}>
                <div onClick={()=>setOpen(p=>({...p,[s.title]:!p[s.title]}))}
                  style={{padding:".7rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",userSelect:"none"}}>
                  <div style={{fontSize:".8rem",fontWeight:600,color:C.brun}}>{s.title}</div>
                  <div style={{display:"flex",gap:".5rem",alignItems:"center"}}>
                    <CopyBtn text={s.text}/>
                    <span style={{color:C.rose,fontSize:".65rem",transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
                  </div>
                </div>
                {isOpen&&(
                  <div style={{borderTop:`1px solid ${C.pale}`,padding:".7rem 1rem .85rem",background:C.creme}}>
                    <p style={{fontSize:".78rem",color:C.texte,lineHeight:1.75,margin:0,fontStyle:"italic"}}>{s.text}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
    </div>
  );
}

// ── OBJECTIFS ÉQUIPE ──────────────────────────────────────────────────────────

export { ObjectionBubbles, ScriptsTab };
