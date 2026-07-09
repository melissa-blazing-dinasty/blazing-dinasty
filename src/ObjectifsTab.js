import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { C } from './constants';

function ObjectifsTab({uid,userName,isMelissa}){
  const[obj,setObj]=useState({ventesObj:"",ventesReal:"",recruesObj:"",recruesReal:"",caObj:"",caReal:"",msg:"",updatedBy:"",updatedAt:0});
  const[loaded,setLoaded]=useState(false);
  const[saving,setSaving]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const ref=doc(db,"equipe","objectifs");
        const snap=await getDoc(ref);
        if(snap.exists())setObj(snap.data());
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const save=async(next)=>{
    setSaving(true);
    try{
      const ref=doc(db,"equipe","objectifs");
      await setDoc(ref,{...next,updatedBy:userName,updatedAt:Date.now()});
      setObj({...next,updatedBy:userName,updatedAt:Date.now()});
    }catch{}
    setSaving(false);
  };

  const pct=(r,o)=>{
    if(!o||!r)return 0;
    return Math.min(100,Math.round(+r/+o*100));
  };

  const KPIs=[
    {key:"recrues",icon:"👥",label:"Nouvelles recrues",color:C.lilas},
    {key:"ca",icon:"💰",label:"CA équipe (€)",color:C.or},
  ];

  if(!loaded)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Objectifs <em style={{fontStyle:"italic",color:C.rose}}>Équipe</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Chiffres partagés avec toute l'équipe. {isMelissa?"Tu peux modifier les objectifs et résultats.":"Mis à jour par Melissa."}
      </p>

      {obj.updatedAt>0&&(
        <div style={{fontSize:".63rem",color:C.gris,marginBottom:"1rem",textAlign:"right"}}>
          Mis à jour par {obj.updatedBy} · {new Date(obj.updatedAt).toLocaleDateString("fr-FR")}
        </div>
      )}

      {/* Message Melissa */}
      {obj.msg&&(
        <div style={{background:C.brun,borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.or,marginBottom:".35rem"}}>👑 Message de Melissa</div>
          <p style={{fontSize:".78rem",color:C.blanc,lineHeight:1.65,margin:0}}>{obj.msg}</p>
        </div>
      )}

      {/* KPIs */}
      {KPIs.map(({key,icon,label,color})=>{
        const p=pct(obj[key+"Real"],obj[key+"Obj"]);
        return(
          <div key={key} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:".65rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".5rem"}}>
              <div style={{fontSize:".8rem",fontWeight:600,color:C.brun}}>{icon} {label}</div>
              <div style={{fontFamily:"Georgia,serif",fontSize:"1.3rem",fontWeight:600,color:p>=100?C.vert:color}}>{p}%</div>
            </div>
            <div style={{height:8,background:C.pale,borderRadius:10,overflow:"hidden",marginBottom:".5rem"}}>
              <div style={{height:"100%",background:p>=100?C.vert:color,width:p+"%",borderRadius:10,transition:"width .4s"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:".68rem",color:C.gris}}>
              <span>Réalisé : <strong style={{color:C.brun}}>{obj[key+"Real"]||"—"}</strong></span>
              <span>Objectif : <strong style={{color:C.brun}}>{obj[key+"Obj"]||"—"}</strong></span>
            </div>
            {isMelissa&&(
              <div style={{display:"flex",gap:".4rem",marginTop:".6rem"}}>
                <input placeholder="Réalisé" value={obj[key+"Real"]||""} onChange={e=>setObj(p=>({...p,[key+"Real"]:e.target.value}))}
                  style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:7,padding:".35rem .6rem",fontSize:".75rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
                <input placeholder="Objectif" value={obj[key+"Obj"]||""} onChange={e=>setObj(p=>({...p,[key+"Obj"]:e.target.value}))}
                  style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:7,padding:".35rem .6rem",fontSize:".75rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
              </div>
            )}
          </div>
        );
      })}

      {isMelissa&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>📝 Message pour l'équipe</div>
          <textarea value={obj.msg||""} onChange={e=>setObj(p=>({...p,msg:e.target.value}))}
            placeholder="Écris un message de motivation pour ton équipe..."
            style={{width:"100%",minHeight:80,border:`1px solid ${C.pale}`,borderRadius:8,padding:".6rem",fontFamily:"inherit",fontSize:".78rem",color:C.texte,background:C.creme,resize:"vertical",outline:"none",lineHeight:1.6,marginBottom:".6rem"}}/>
          <button onClick={()=>save(obj)} disabled={saving}
            style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".55rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
            {saving?"Sauvegarde...":"Mettre à jour pour l'équipe →"}
          </button>
        </div>
      )}
    </div>
  );
}


export { ObjectifsTab };
