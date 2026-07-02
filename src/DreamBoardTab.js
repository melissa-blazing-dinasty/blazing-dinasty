import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { C } from './constants';
import { UploadPhoto } from './FormationProduitsTab';
import { todayLocalStr } from './utils';
import { DecouverteTour } from './App';

function DreamBoardWidget({uid}){
  const[dreams,setDreams]=useState([]);
  const[loading,setLoading]=useState(true);
  const[expanded,setExpanded]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"users",uid));
        if(snap.exists()&&snap.data()["db-dreamboard"]){
          setDreams(JSON.parse(snap.data()["db-dreamboard"]));
        }
      }catch{}
      setLoading(false);
    })();
  },[uid]);

  if(loading||dreams.length===0) return null;

  const visibles=expanded?dreams:dreams.slice(0,3);

  return(
    <div style={{marginBottom:"1rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".5rem"}}>
        <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.or}}>✨ Mon Dream Board</div>
        <button onClick={()=>setExpanded(e=>!e)} style={{background:"none",border:"none",fontSize:".65rem",color:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
          {expanded?"Réduire":"Voir tout"}
        </button>
      </div>
      <div style={{display:"flex",gap:".5rem",overflowX:expanded?"visible":"auto",flexWrap:expanded?"wrap":"nowrap",paddingBottom:".25rem"}}>
        {visibles.map((d,i)=>(
          <div key={i} style={{flexShrink:0,width:expanded?"calc(33% - .35rem)":100,height:100,borderRadius:12,overflow:"hidden",position:"relative",background:`linear-gradient(135deg,${C.brun},${C.brun2})`}}>
            {d.image
              ?<img src={d.image} alt={d.titre} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              :<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",fontSize:"2rem"}}>{d.emoji||"🌟"}</div>
            }
            <div style={{position:"absolute",bottom:0,left:0,right:0,padding:".3rem .4rem",background:"linear-gradient(0deg,rgba(0,0,0,.65),transparent)"}}>
              <div style={{fontSize:".58rem",fontWeight:700,color:"white",lineHeight:1.2}}>{d.titre}</div>
            </div>
          </div>
        ))}
        {dreams.length>3&&!expanded&&(
          <div onClick={()=>setExpanded(true)} style={{flexShrink:0,width:100,height:100,borderRadius:12,background:C.brun+"20",border:`1.5px dashed ${C.pale}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexDirection:"column",gap:".2rem"}}>
            <div style={{fontSize:"1.2rem"}}>+{dreams.length-3}</div>
            <div style={{fontSize:".58rem",color:C.gris}}>rêves</div>
          </div>
        )}
      </div>
    </div>
  );
}

function DreamBoardTab({uid}){
  const[dreams,setDreams]=useState([]);
  const[loading,setLoading]=useState(true);
  const[showForm,setShowForm]=useState(false);
  const[editIdx,setEditIdx]=useState(null);
  const[form,setForm]=useState({titre:"",description:"",emoji:"🌟",image:"",categorie:"vie"});
  const[saving,setSaving]=useState(false);
  const[zoom,setZoom]=useState(null); // reve zoomé en plein écran
  const[vue,setVue]=useState("mosaique"); // mosaique | liste
  const[showDecouverte,setShowDecouverte]=useState(false);

  const CATEGORIES=[
    {id:"vie",label:"✨ Vie de rêve",color:C.or},
    {id:"finance",label:"💰 Finances",color:C.vert},
    {id:"famille",label:"👨‍👩‍👧 Famille",color:C.rose},
    {id:"voyage",label:"✈️ Voyages",color:"#3498DB"},
    {id:"sante",label:"💪 Santé",color:"#27AE60"},
    {id:"maison",label:"🏠 Maison",color:"#E67E22"},
    {id:"business",label:"👑 Business",color:C.brun},
    {id:"perso",label:"🌸 Personnel",color:C.lilas},
  ];
  const EMOJIS=["🌟","🏠","✈️","💰","👑","💪","🌸","❤️","🎯","🚀","🌊","🏖️","💎","🎨","📚","🎵","🐾","🌺","🍀","🦋","🏡","🌍","💫","🌈","🔑","🎭","🏆","🌙"];

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"users",uid));
        if(snap.exists()&&snap.data()["db-dreamboard"])
          setDreams(JSON.parse(snap.data()["db-dreamboard"]));
      }catch{}
      setLoading(false);
    })();
  },[uid]);

  const saveDreams=async(next)=>{
    setSaving(true);
    try{ await setDoc(doc(db,"users",uid),{"db-dreamboard":JSON.stringify(next)},{merge:true}); setDreams(next); }catch{}
    setSaving(false);
  };

  const addDream=async()=>{
    if(!form.titre.trim())return;
    let next;
    if(editIdx!==null){ next=dreams.map((d,i)=>i===editIdx?{...form}:d); }
    else{ next=[...dreams,{...form,date:todayLocalStr()}]; }
    await saveDreams(next);
    setForm({titre:"",description:"",emoji:"🌟",image:"",categorie:"vie"});
    setShowForm(false);setEditIdx(null);
  };

  const del=(idx)=>{ if(window.confirm("Supprimer ce rêve ?")) saveDreams(dreams.filter((_,i)=>i!==idx)); };
  const toggleRealise=(idx)=>{ saveDreams(dreams.map((d,i)=>i===idx?{...d,realise:!d.realise}:d)); };

  if(loading)return null;

  // Popup zoom
  if(zoom!==null){
    const d=dreams[zoom];
    const cat=CATEGORIES.find(c=>c.id===d.categorie)||CATEGORIES[0];
    return(
      <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,.92)",zIndex:1000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}
        onClick={()=>setZoom(null)}>
        <div style={{maxWidth:480,width:"90%"}} onClick={e=>e.stopPropagation()}>
          {d.image
            ?<img src={d.image} alt={d.titre} style={{width:"100%",borderRadius:20,objectFit:"cover",maxHeight:"55vh",display:"block"}}/>
            :<div style={{height:220,borderRadius:20,background:`linear-gradient(135deg,${cat.color},${C.brun})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"5rem"}}>{d.emoji}</div>
          }
          <div style={{background:"white",borderRadius:"0 0 20px 20px",padding:"1.1rem 1.3rem"}}>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",fontWeight:600,color:C.brun,marginBottom:".4rem"}}>{d.titre}</div>
            {d.description&&<div style={{fontSize:".8rem",color:C.gris,lineHeight:1.7,marginBottom:".6rem"}}>{d.description}</div>}
            <div style={{display:"flex",gap:".4rem",marginTop:".5rem"}}>
              <button onClick={()=>toggleRealise(zoom)}
                style={{flex:1,background:d.realise?C.vert:cat.color,color:"white",border:"none",borderRadius:9,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                {d.realise?"↩ En cours":"🎉 Réalisé !"}
              </button>
              <button onClick={()=>{setZoom(null);setEditIdx(zoom);setForm({titre:d.titre,description:d.description||"",emoji:d.emoji||"🌟",image:d.image||"",categorie:d.categorie||"vie"});setShowForm(true);}}
                style={{background:C.creme,border:`1px solid ${C.pale}`,borderRadius:9,padding:".5rem .9rem",fontSize:".78rem",cursor:"pointer"}}>✏️</button>
              <button onClick={()=>{del(zoom);setZoom(null);}}
                style={{background:"#FEE2E2",border:"none",borderRadius:9,padding:".5rem .9rem",fontSize:".78rem",cursor:"pointer",color:"#B04040"}}>🗑️</button>
              <button onClick={()=>setZoom(null)}
                style={{background:C.pale,border:"none",borderRadius:9,padding:".5rem .9rem",fontSize:".78rem",cursor:"pointer"}}>✕</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return(
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:".5rem"}}><button onClick={()=>setShowDecouverte(true)} style={{background:"#C49A8A",color:"white",border:"none",borderRadius:20,padding:".35rem 1rem",fontSize:".75rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(196,154,138,.4)"}}>🧭 Découverte</button></div>
      {showDecouverte&&<DecouverteTour outil="dreamboard" onClose={()=>setShowDecouverte(false)}/>}
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Mon <em style={{fontStyle:"italic",color:C.or}}>Dream Board</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:".75rem",lineHeight:1.65}}>
        Visualise tes rêves chaque jour. Ce que l'on voit clairement, on l'attire à soi. ✨
      </p>

      {/* Barre d'actions */}
      <div style={{display:"flex",gap:".4rem",marginBottom:"1rem"}}>
        <button id="decouverte-dream-add" onClick={()=>{setShowForm(true);setEditIdx(null);setForm({titre:"",description:"",emoji:"🌟",image:"",categorie:"vie"});}}
          style={{flex:1,background:`linear-gradient(135deg,${C.brun},${C.brun2})`,color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          + Ajouter un rêve
        </button>
        <button onClick={()=>setVue(v=>v==="mosaique"?"liste":"mosaique")}
          style={{background:C.creme,border:`1px solid ${C.pale}`,borderRadius:10,padding:".6rem .75rem",fontSize:".78rem",cursor:"pointer"}}>
          {vue==="mosaique"?"☰":"⊞"}
        </button>
      </div>

      {/* Formulaire */}
      {showForm&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:14,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".68rem",fontWeight:700,color:C.brun,marginBottom:".65rem"}}>{editIdx!==null?"✏️ Modifier":"✨ Nouveau rêve"}</div>

          {/* Upload photo en premier — visuellement prioritaire */}
          <UploadPhoto label="📸 Photo d'inspiration (optionnel)" value={form.image} onChange={v=>setForm(p=>({...p,image:v}))} folder="dreamboard"/>

          {/* Aperçu immédiat */}
          {form.image&&(
            <div style={{borderRadius:12,overflow:"hidden",height:140,marginBottom:".6rem",position:"relative"}}>
              <img src={form.image} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              <button onClick={()=>setForm(p=>({...p,image:""}))} style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,.5)",border:"none",borderRadius:20,color:"white",fontSize:".7rem",padding:".2rem .5rem",cursor:"pointer"}}>✕ Retirer</button>
            </div>
          )}

          {/* Emoji (affiché seulement si pas de photo) */}
          {!form.image&&(
            <div style={{marginBottom:".5rem"}}>
              <div style={{fontSize:".6rem",color:C.gris,marginBottom:".3rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>Emoji (si pas de photo)</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:".25rem"}}>
                {EMOJIS.map(em=>(
                  <button key={em} onClick={()=>setForm(p=>({...p,emoji:em}))}
                    style={{width:32,height:32,borderRadius:8,border:`2px solid ${form.emoji===em?C.brun:C.pale}`,background:form.emoji===em?C.brun+"15":"white",fontSize:"1rem",cursor:"pointer"}}>
                    {em}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{marginBottom:".5rem"}}>
            <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>Titre *</div>
            <input value={form.titre} onChange={e=>setForm(p=>({...p,titre:e.target.value}))} placeholder="Ex: Ma maison de rêve à Bali"
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".82rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
          </div>

          <div style={{marginBottom:".5rem"}}>
            <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>Description (facultatif)</div>
            <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="Décris ce rêve en détail..." rows={2}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",resize:"vertical"}}/>
          </div>

          <div style={{marginBottom:".65rem"}}>
            <div style={{fontSize:".6rem",color:C.gris,marginBottom:".3rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>Catégorie</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:".25rem"}}>
              {CATEGORIES.map(cat=>(
                <button key={cat.id} onClick={()=>setForm(p=>({...p,categorie:cat.id}))}
                  style={{padding:".25rem .5rem",fontSize:".65rem",borderRadius:8,border:`1.5px solid ${form.categorie===cat.id?cat.color:C.pale}`,background:form.categorie===cat.id?cat.color+"20":"white",color:form.categorie===cat.id?cat.color:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{display:"flex",gap:".4rem"}}>
            <button onClick={addDream} disabled={saving||!form.titre.trim()}
              style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              {saving?"Sauvegarde...":editIdx!==null?"✓ Modifier":"✓ Ajouter"}
            </button>
            <button onClick={()=>{setShowForm(false);setEditIdx(null);}}
              style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>Annuler</button>
          </div>
        </div>
      )}

      {/* Board vide */}
      {dreams.length===0&&(
        <div style={{textAlign:"center",padding:"2.5rem 1rem",background:C.creme,borderRadius:14,border:`1.5px dashed ${C.pale}`}}>
          <div style={{fontSize:"2.5rem",marginBottom:".5rem"}}>🌟</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:".95rem",color:C.brun,marginBottom:".3rem"}}>Ton board est vide</div>
          <div style={{fontSize:".72rem",color:C.gris,lineHeight:1.6}}>Ajoute ta première photo d'inspiration — maison, voyage, famille...<br/>Visualise-la chaque matin pour l'attirer à toi.</div>
        </div>
      )}

      {/* VUE MOSAÏQUE */}
      {vue==="mosaique"&&dreams.length>0&&(
        <div id="decouverte-dream-mosaique">
          {/* Rêves réalisés séparés */}
          {dreams.filter(d=>!d.realise).length>0&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:"1rem"}}>
              {dreams.map((d,i)=>{
                if(d.realise)return null;
                const cat=CATEGORIES.find(c=>c.id===d.categorie)||CATEGORIES[0];
                const hasImg=!!d.image;
                return(
                  <div key={i} onClick={()=>setZoom(i)}
                    style={{borderRadius:14,overflow:"hidden",position:"relative",cursor:"pointer",
                      background:hasImg?"transparent":`linear-gradient(135deg,${cat.color}CC,${C.brun})`,
                      height:i===0?200:150, // premier rêve plus grand
                    }}>
                    {hasImg
                      ?<img src={d.image} alt={d.titre} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                      :<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",fontSize:i===0?"3.5rem":"2.5rem"}}>{d.emoji||"🌟"}</div>
                    }
                    <div style={{position:"absolute",bottom:0,left:0,right:0,padding:".45rem .6rem",background:"linear-gradient(0deg,rgba(0,0,0,.7),transparent)"}}>
                      <div style={{fontSize:i===0?".82rem":".7rem",fontWeight:700,color:"white",lineHeight:1.2}}>{d.titre}</div>
                      <div style={{fontSize:".58rem",color:"rgba(255,255,255,.7)"}}>{cat.label.split(" ").slice(1).join(" ")}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* Rêves réalisés */}
          {dreams.filter(d=>d.realise).length>0&&(
            <div>
              <div style={{fontSize:".62rem",color:C.vert,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:".4rem"}}>✅ Réalisés ({dreams.filter(d=>d.realise).length})</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:".4rem"}}>
                {dreams.map((d,i)=>{
                  if(!d.realise)return null;
                  const cat=CATEGORIES.find(c=>c.id===d.categorie)||CATEGORIES[0];
                  return(
                    <div key={i} onClick={()=>setZoom(i)}
                      style={{borderRadius:10,overflow:"hidden",position:"relative",height:80,cursor:"pointer",border:`2px solid ${C.vert}`,opacity:.75}}>
                      {d.image
                        ?<img src={d.image} alt={d.titre} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                        :<div style={{background:`linear-gradient(135deg,${cat.color},${C.brun})`,height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.8rem"}}>{d.emoji}</div>
                      }
                      <div style={{position:"absolute",bottom:0,left:0,right:0,padding:".2rem .3rem",background:"rgba(0,0,0,.6)"}}>
                        <div style={{fontSize:".55rem",color:"white",fontWeight:600}}>{d.titre.slice(0,20)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VUE LISTE */}
      {vue==="liste"&&dreams.length>0&&dreams.map((d,i)=>{
        const cat=CATEGORIES.find(c=>c.id===d.categorie)||CATEGORIES[0];
        return(
          <div key={i} style={{display:"flex",gap:".65rem",background:d.realise?"#F0FFF4":C.blanc,border:`1px solid ${d.realise?C.vert:C.pale}`,borderRadius:12,padding:".6rem",marginBottom:".4rem",opacity:d.realise?.8:1}}>
            <div style={{width:60,height:60,borderRadius:10,overflow:"hidden",flexShrink:0,background:`linear-gradient(135deg,${cat.color},${C.brun})`}}>
              {d.image
                ?<img src={d.image} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                :<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",fontSize:"1.8rem"}}>{d.emoji}</div>
              }
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:".82rem",fontWeight:600,color:C.brun}}>{d.titre}</div>
              <div style={{fontSize:".6rem",color:cat.color,fontWeight:600}}>{cat.label}</div>
              {d.description&&<div style={{fontSize:".68rem",color:C.gris,marginTop:".1rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.description}</div>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:".25rem",flexShrink:0}}>
              <button onClick={()=>toggleRealise(i)} style={{background:"none",border:"none",fontSize:".75rem",cursor:"pointer"}}>{d.realise?"↩":"🎉"}</button>
              <button onClick={()=>{setEditIdx(i);setForm({titre:d.titre,description:d.description||"",emoji:d.emoji||"🌟",image:d.image||"",categorie:d.categorie||"vie"});setShowForm(true);}} style={{background:"none",border:"none",fontSize:".75rem",cursor:"pointer"}}>✏️</button>
              <button onClick={()=>del(i)} style={{background:"none",border:"none",fontSize:".75rem",cursor:"pointer",color:"#B04040"}}>✕</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}


export { DreamBoardWidget, DreamBoardTab };
