import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { C } from './constants';
import { MELISSA } from './ClientsTab';
import { UploadPhoto } from './FormationProduitsTab';
import { WallOfFameTab, DefisTab, PowerHourTab, THEMES_IMAGES } from './App';
import { MessagerieTab, getUnreadMessagesCount } from './MessagerieTab';
import { CopyBtn } from './components';

function CommunauteTab({uid, userName, isChef}){
  const[posts,setPosts]=useState([]);
  const[infos,setInfos]=useState([]);
  const[loading,setLoading]=useState(true);
  const[ctab,setCtab]=useState("tous");
  
  const[newText,setNewText]=useState("");
  const[newType,setNewType]=useState("victoire");
  const[newInfo,setNewInfo]=useState({titre:"",texte:"",important:false});
  const[showAddInfo,setShowAddInfo]=useState(false);
  const[posting,setPosting]=useState(false);
  const[newPhoto,setNewPhoto]=useState("");
  const[newTemoignageTheme,setNewTemoignageTheme]=useState("skincare");
  const[bulleOuverte,setBulleOuverte]=useState(null);
  const[challengeATraiter,setChallengeATraiter]=useState(false);
  const[nouvelleInfo,setNouvelleInfo]=useState(false);
  const[messagesNonLus,setMessagesNonLus]=useState(0);
  const chargerMessagesNonLus=async()=>{
    const n=await getUnreadMessagesCount(uid);
    setMessagesNonLus(n);
  };
  useEffect(()=>{chargerMessagesNonLus();},[uid]);
  useEffect(()=>{
    (async()=>{
      try{
        const snapC=await getDoc(doc(db,"challenges","liste"));
        const items=snapC.exists()?(snapC.data().items||[]):[];
        const now=Date.now();
        const actifs=items.filter(c=>!c.deadline||c.deadline>now);
        if(actifs.length===0){setChallengeATraiter(false);return;}
        const snapD=await getDoc(doc(db,"challenges","declarations"));
        const decls=snapD.exists()?snapD.data():{};
        const pasFait=actifs.some(c=>{
          const mesDecl=(decls[c.id]||[]).filter(d=>d.uid===uid);
          return mesDecl.length===0;
        });
        setChallengeATraiter(pasFait);
      }catch{}
    })();
  },[uid]);
  const[commentInputs,setCommentInputs]=useState({});
  const[openComments,setOpenComments]=useState({});
  const isMelissa=uid==="melissa"||uid==="melissa-da-silveira";

  const loadPosts=async()=>{
    try{
      const ref=doc(db,"communaute","posts");
      const snap=await getDoc(ref);
      if(snap.exists()){
        const data=snap.data();
        const arr=Object.values(data).sort((a,b)=>b.ts-a.ts);
        setPosts(arr);
      }
    }catch{}
    try{
      const ref2=doc(db,"communaute","infos");
      const snap2=await getDoc(ref2);
      if(snap2.exists()){
        const data2=snap2.data();
        const infosArr=Object.values(data2).sort((a,b)=>b.ts-a.ts);
        setInfos(infosArr);
        try{
          const uSnap=await getDoc(doc(db,"users",uid));
          const lastVu=uSnap.exists()?(uSnap.data()["db-last-infos-vu"]||0):0;
          const plusRecente=infosArr.length>0?Math.max(...infosArr.map(i=>i.ts||0)):0;
          setNouvelleInfo(plusRecente>lastVu);
        }catch{}
      }
    }catch{}
    setLoading(false);
  };

  useEffect(()=>{loadPosts();},[]);

  const savePosts=async(arr)=>{
    const obj={};
    arr.forEach(p=>{obj[p.id]=p;});
    try{
      const ref=doc(db,"communaute","posts");
      await setDoc(ref,obj);
    }catch{}
  };

  const addPost=async()=>{
    if(!newText.trim())return;
    setPosting(true);
    const p={
      id:`p${Date.now()}`,
      author:userName,
      type:newType,
      text:newText.trim(),
      photo:newPhoto||"",
      ts:Date.now(),
      likes:[],
    };
    const next=[p,...posts];
    setPosts(next);
    await savePosts(next);

    // Classement automatique dans la Banque d'Images si c'est un témoignage avec photo
    if(newType==="temoignage"&&newPhoto){
      try{
        const refBanque=doc(db,"banque","images");
        const snapBanque=await getDoc(refBanque);
        const items=snapBanque.exists()?(snapBanque.data().items||[]):[];
        const item={
          id:`img${Date.now()}`,
          titre:`Témoignage de ${userName}`,
          url:newPhoto,
          texte:newText.trim(),
          theme:newTemoignageTheme,
          sousTheme:"temoignages",
          type:"image",
          auteur:userName,
          valide:!!(isMelissa||isChef),
        };
        await setDoc(refBanque,{items:[...items,item]});
      }catch{}
    }

    setNewText("");
    setNewPhoto("");
    setPosting(false);
  };

  const toggleLike=async(pid)=>{
    const next=posts.map(p=>{
      if(p.id!==pid)return p;
      const liked=p.likes.includes(uid);
      return{...p,likes:liked?p.likes.filter(l=>l!==uid):[...p.likes,uid]};
    });
    setPosts(next);
    await savePosts(next);
  };

  const addComment=async(pid)=>{
    const text=(commentInputs[pid]||"").trim();
    if(!text)return;
    const next=posts.map(p=>{
      if(p.id!==pid)return p;
      const c={id:`cm${Date.now()}`,author:userName,text,ts:Date.now()};
      return{...p,comments:[...(p.comments||[]),c]};
    });
    setPosts(next);
    await savePosts(next);
    setCommentInputs(prev=>({...prev,[pid]:""}));
  };
  const delPost=async(pid)=>{
    const next=posts.filter(p=>p.id!==pid);
    setPosts(next);
    await savePosts(next);
  };

  const saveInfos=async(arr)=>{
    const obj={};arr.forEach(i=>{obj[i.id]=i;});
    try{await setDoc(doc(db,"communaute","infos"),obj);}catch{}
  };

  const addInfo=async()=>{
    if(!newInfo.titre.trim()||!newInfo.texte.trim())return;
    const i={id:`inf${Date.now()}`,titre:newInfo.titre.trim(),texte:newInfo.texte.trim(),important:newInfo.important,ts:Date.now()};
    const next=[i,...infos];
    setInfos(next);await saveInfos(next);
    setNewInfo({titre:"",texte:"",important:false});setShowAddInfo(false);
  };

  const delInfo=async(id)=>{
    const next=infos.filter(i=>i.id!==id);
    setInfos(next);await saveInfos(next);
  };

  const TYPE_CONFIG={
    annonce:{icon:"📢",label:"Annonce",color:C.brun,bg:C.brun+"15"},
    victoire:{icon:"🏆",label:"Victoire",color:C.or,bg:C.or+"20"},
    question:{icon:"❓",label:"Question",color:C.lilas,bg:C.lilas+"20"},
    temoignage:{icon:"💬",label:"Témoignage",color:C.rose,bg:C.rose+"20"},
    conseil:{icon:"💡",label:"Conseil",color:C.vert,bg:C.vert+"20"},
  };

  const CTABS=[
    {id:"tous",label:"Tous"},
    {id:"infos",label:"📌 Infos importantes"},
    {id:"annonce",label:"📢 Annonces"},
    {id:"victoire",label:"🏆 Victoires"},
    {id:"question",label:"❓ Questions"},
    {id:"temoignage",label:"💬 Témoignages"},
  ];

  const filtered=ctab==="tous"?posts:posts.filter(p=>p.type===ctab);
  const annonces=posts.filter(p=>p.type==="annonce");

  const timeAgo=(ts)=>{
    const d=Math.floor((Date.now()-ts)/1000);
    if(d<60)return "à l'instant";
    if(d<3600)return `il y a ${Math.floor(d/60)} min`;
    if(d<86400)return `il y a ${Math.floor(d/3600)}h`;
    return `il y a ${Math.floor(d/86400)}j`;
  };

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Espace <em style={{fontStyle:"italic",color:C.rose}}>Communauté</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Partage tes victoires, pose tes questions, lis les annonces de Melissa.
      </p>

      {/* Annonces épinglées */}
      {annonces.length>0&&ctab==="tous"&&(
        <div style={{marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.brun,marginBottom:".4rem"}}>📢 Annonces de Melissa</div>
          {annonces.slice(0,3).map(p=>(
            <div key={p.id} style={{background:C.brun,borderRadius:12,padding:".85rem 1rem",marginBottom:".45rem",border:`1px solid ${C.or}40`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:".35rem"}}>
                <div style={{display:"flex",gap:".4rem",alignItems:"center"}}>
                  <span style={{fontSize:".7rem"}}>📢</span>
                  <span style={{fontSize:".72rem",fontWeight:700,color:C.or}}>Melissa</span>
                </div>
                <span style={{fontSize:".6rem",color:C.pale,opacity:.6}}>{timeAgo(p.ts)}</span>
              </div>
              <p style={{fontSize:".78rem",color:C.blanc,lineHeight:1.65,margin:0}}>{p.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Bulles cliquables */}
      <div style={{display:"flex",gap:".4rem",marginBottom:"1rem"}}>
        {[{id:"partager",label:"✍️ Partager",icon:"✍️"},{id:"mur",label:"🏆 Mur de la gloire",icon:"🏆"},{id:"defis",label:"🎯 Défis",icon:"🎯"},{id:"messages",label:"💬 Messages",icon:"💬"}].map(b=>(
          <div key={b.id} onClick={()=>{setBulleOuverte(prev=>{const next=prev===b.id?null:b.id;if(b.id==="messages"&&prev==="messages")chargerMessagesNonLus();return next;});}}
            style={{flex:1,textAlign:"center",background:bulleOuverte===b.id?C.rose:C.blanc,border:`1.5px solid ${bulleOuverte===b.id?C.rose:C.pale}`,borderRadius:14,padding:".7rem .4rem",cursor:"pointer",transition:"all .2s",position:"relative"}}>
            {b.id==="defis"&&challengeATraiter&&(
              <span style={{position:"absolute",top:-4,right:-4,width:18,height:18,borderRadius:"50%",background:"#E63946",border:"2px solid white",boxShadow:"0 0 0 3px rgba(230,57,70,.3), 0 2px 6px rgba(230,57,70,.5)"}}/>
            )}
            {b.id==="messages"&&messagesNonLus>0&&(
              <span style={{position:"absolute",top:-4,right:-4,minWidth:18,height:18,borderRadius:9,background:"#E63946",border:"2px solid white",boxShadow:"0 0 0 3px rgba(230,57,70,.3), 0 2px 6px rgba(230,57,70,.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 .25rem"}}>
                <span style={{color:"white",fontSize:".6rem",fontWeight:700}}>{messagesNonLus}</span>
              </span>
            )}
            <div style={{fontSize:"1.1rem",marginBottom:".2rem"}}>{b.icon}</div>
            <div style={{fontSize:".6rem",fontWeight:600,color:bulleOuverte===b.id?"white":C.gris}}>{b.label.replace(b.icon+" ","")}</div>
          </div>
        ))}
      </div>
      {bulleOuverte==="mur"&&(
        <div style={{marginBottom:"1rem",background:C.creme,borderRadius:14,padding:"1rem"}}>
          <WallOfFameTab uid={uid} userName={userName}/>
        </div>
      )}
      {bulleOuverte==="defis"&&(
        <div style={{marginBottom:"1rem",background:C.creme,borderRadius:14,padding:"1rem"}}>
          <DefisTab uid={uid} userName={userName} canCreate={true} isChef={isChef}/>
          <div style={{marginTop:"1rem"}}>
            <PowerHourTab uid={uid} userName={userName} canCreate={isChef}/>
          </div>
        </div>
      )}
      {bulleOuverte==="messages"&&(
        <div style={{marginBottom:"1rem",background:C.creme,borderRadius:14,padding:"1rem"}}>
          <MessagerieTab uid={uid} userName={userName}/>
        </div>
      )}
      {/* Formulaire nouveau post — masqué sur onglet infos */}
      {ctab!=="infos"&&bulleOuverte==="partager"&&(
      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
        <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>
          ✍️ Partager avec l'équipe
        </div>

        {/* Type de post */}
        <div style={{display:"flex",gap:".3rem",flexWrap:"wrap",marginBottom:".6rem"}}>
          {Object.entries(TYPE_CONFIG)
            .filter(([k])=>isMelissa||k!=="annonce")
            .map(([k,v])=>(
            <button key={k} onClick={()=>setNewType(k)}
              style={{padding:".25rem .6rem",fontSize:".65rem",fontWeight:600,borderRadius:20,border:`1px solid ${newType===k?v.color:C.pale}`,background:newType===k?v.color:C.blanc,color:newType===k?"white":C.gris,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>

        <UploadPhoto label="Photo (optionnel)" value={newPhoto} onChange={v=>setNewPhoto(v)} folder="communaute" maxSize={1200} quality={0.88}/>
        {newType==="temoignage"&&newPhoto&&(
          <div style={{marginBottom:".6rem"}}>
            <div style={{fontSize:".62rem",color:C.gris,marginBottom:".3rem"}}>📁 Thème (pour le classement automatique dans la Banque d'Images)</div>
            <select value={newTemoignageTheme} onChange={e=>setNewTemoignageTheme(e.target.value)}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}>
              {THEMES_IMAGES.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
            </select>
          </div>
        )}
        <textarea
          placeholder={
            newType==="victoire"?"🏆 Partage ta victoire du moment...":
            newType==="question"?"❓ Pose ta question à l'équipe...":
            newType==="annonce"?"📢 Écris ton annonce pour l'équipe...":
            newType==="temoignage"?"💬 Partage ton témoignage...":
            "💡 Partage ton conseil..."
          }
          value={newText}
          onChange={e=>setNewText(e.target.value)}
          style={{width:"100%",minHeight:80,border:`1px solid ${C.pale}`,borderRadius:8,padding:".6rem",fontFamily:"inherit",fontSize:".78rem",color:C.texte,background:C.creme,resize:"vertical",outline:"none",lineHeight:1.6,marginBottom:".6rem"}}
        />
        {newType==="temoignage"&&newPhoto&&(
          <div style={{fontSize:".65rem",color:C.rose,marginBottom:".5rem",fontStyle:"italic"}}>
            ✨ Sera aussi {isMelissa||isChef?"rangé automatiquement":"proposé"} dans la Banque d'Images{!(isMelissa||isChef)&&" (après validation de Melissa)"}
          </div>
        )}
        <button onClick={addPost} disabled={!newText.trim()||posting}
          style={{width:"100%",background:newText.trim()?C.brun:C.pale,color:newText.trim()?C.blanc:C.gris,border:"none",borderRadius:8,padding:".55rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:newText.trim()?"pointer":"default",transition:"all .2s"}}>
          {posting?"Publication...":"Publier →"}
        </button>
      </div>
      )}

      {/* ── ONGLET INFOS IMPORTANTES ── */}
      {ctab==="infos"&&(
        <div>
          {isMelissa&&(
            <div style={{marginBottom:"1rem"}}>
              <button onClick={()=>setShowAddInfo(p=>!p)}
                style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                📌 Ajouter une info importante
              </button>
              {showAddInfo&&(
                <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginTop:".6rem"}}>
                  <input placeholder="Titre (ex: Deadline période, Nouveau produit...)" value={newInfo.titre} onChange={e=>setNewInfo(p=>({...p,titre:e.target.value}))}
                    style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .7rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".5rem"}}/>
                  <textarea placeholder="Détails de l'info..." value={newInfo.texte} onChange={e=>setNewInfo(p=>({...p,texte:e.target.value}))}
                    style={{width:"100%",minHeight:80,border:`1px solid ${C.pale}`,borderRadius:8,padding:".5rem .7rem",fontFamily:"inherit",fontSize:".78rem",color:C.texte,background:C.creme,resize:"vertical",outline:"none",lineHeight:1.6,marginBottom:".5rem"}}/>
                  <div style={{display:"flex",alignItems:"center",gap:".6rem",marginBottom:".65rem"}}>
                    <div onClick={()=>setNewInfo(p=>({...p,important:!p.important}))}
                      style={{width:18,height:18,borderRadius:4,border:`2px solid ${"#C44B1A"}`,background:newInfo.important?"#C44B1A":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {newInfo.important&&<span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>}
                    </div>
                    <span style={{fontSize:".75rem",color:C.texte}}>Marquer comme urgent 🔴</span>
                  </div>
                  <div style={{display:"flex",gap:".4rem"}}>
                    <button onClick={addInfo} style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>Publier</button>
                    <button onClick={()=>setShowAddInfo(false)} style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>Annuler</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {infos.length===0&&(
            <div style={{textAlign:"center",padding:"2.5rem 1rem",color:C.gris}}>
              <div style={{fontSize:"2rem",marginBottom:".6rem"}}>📌</div>
              <div style={{fontSize:".78rem"}}>Aucune info importante pour l'instant.<br/>{isMelissa?"Ajoute la première ci-dessus.":"Melissa publiera les infos importantes ici."}</div>
            </div>
          )}

          {infos.map(info=>(
            <div key={info.id} style={{background:info.important?"#FFF3E0":C.blanc,border:`2px solid ${info.important?"#C44B1A":C.pale}`,borderRadius:12,padding:".9rem 1rem",marginBottom:".6rem"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:".45rem"}}>
                <div style={{display:"flex",gap:".5rem",alignItems:"center",flex:1}}>
                  {info.important&&<span style={{fontSize:".7rem",background:"#C44B1A",color:"white",padding:".1rem .4rem",borderRadius:20,fontWeight:700,flexShrink:0}}>🔴 URGENT</span>}
                  <div style={{fontFamily:"Georgia,serif",fontSize:".92rem",fontWeight:600,color:C.brun}}>{info.titre}</div>
                </div>
                {isMelissa&&<button onClick={()=>delInfo(info.id)} style={{background:"none",border:"none",color:C.pale,cursor:"pointer",fontSize:".75rem",padding:".2rem",fontFamily:"inherit",flexShrink:0}}>✕</button>}
              </div>
              <p style={{fontSize:".78rem",color:C.texte,lineHeight:1.7,margin:"0 0 .4rem"}}>{info.texte}</p>
              <div style={{fontSize:".62rem",color:C.gris}}>{timeAgo(info.ts)}</div>
            </div>
          ))}
        </div>
      )}
      {/* Filtres */}
      <div style={{display:"flex",gap:".3rem",overflowX:"auto",marginBottom:"1rem",paddingBottom:".3rem"}}>
        {CTABS.map(t=>(
          <button key={t.id} onClick={async()=>{setCtab(t.id);if(t.id==="infos"){setNouvelleInfo(false);try{await setDoc(doc(db,"users",uid),{"db-last-infos-vu":Date.now()},{merge:true});}catch{}}}}
            style={{flex:"none",padding:".38rem .75rem",fontSize:".65rem",fontWeight:600,borderRadius:20,border:`1px solid ${ctab===t.id?C.rose:C.pale}`,background:ctab===t.id?C.rose:C.blanc,color:ctab===t.id?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit",transition:"all .2s",whiteSpace:"nowrap",position:"relative"}}>
            {t.id==="infos"&&nouvelleInfo&&(
              <span style={{position:"absolute",top:-3,right:-3,width:11,height:11,borderRadius:"50%",background:"#E63946",border:"1.5px solid white",boxShadow:"0 0 0 2px rgba(230,57,70,.3)"}}/>
            )}
            {t.label}
          </button>
        ))}
      </div>

      {/* Liste des posts */}
      {loading&&<div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".78rem"}}>Chargement...</div>}

      {!loading&&filtered.length===0&&(
        <div style={{textAlign:"center",padding:"2rem",color:C.gris}}>
          <div style={{fontSize:"1.8rem",marginBottom:".5rem"}}>🌟</div>
          <div style={{fontSize:".78rem"}}>Aucun post pour l'instant.<br/>Sois la première à partager !</div>
        </div>
      )}

      {filtered.filter(p=>p.type!=="annonce"||ctab==="annonce"||ctab==="tous"&&false).map(p=>{
        const cfg=TYPE_CONFIG[p.type]||TYPE_CONFIG.victoire;
        const liked=p.likes.includes(uid);
        const isOwner=p.author.toLowerCase().replace(/\s+/g,"-")===uid||isMelissa;
        const authorIsMelissa=p.author.toLowerCase().replace(/\s+/g,"-")===MELISSA||p.author.toLowerCase()===MELISSA;
        if(p.type==="annonce"&&ctab==="tous")return null;
        return(
          <div key={p.id} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem 1rem",marginBottom:".55rem",transition:"all .2s"}}>
            {/* Header post */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:".45rem"}}>
              <div style={{display:"flex",gap:".5rem",alignItems:"center"}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:authorIsMelissa?C.brun:cfg.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:".85rem",flexShrink:0}}>
                  {authorIsMelissa?"👑":p.author[0].toUpperCase()}
                </div>
                <div>
                  <div style={{fontSize:".78rem",fontWeight:600,color:C.brun}}>
                    {p.author}{authorIsMelissa&&<span style={{fontSize:".6rem",color:C.or,marginLeft:".3rem"}}>✦ Melissa</span>}
                  </div>
                  <div style={{display:"flex",gap:".35rem",alignItems:"center"}}>
                    <span style={{background:cfg.bg,color:cfg.color,fontSize:".55rem",fontWeight:700,padding:".1rem .4rem",borderRadius:20}}>{cfg.icon} {cfg.label}</span>
                    <span style={{fontSize:".6rem",color:C.gris}}>{timeAgo(p.ts)}</span>
                  </div>
                </div>
              </div>
              {isOwner&&(
                <button onClick={()=>delPost(p.id)}
                  style={{background:"none",border:"none",color:C.pale,cursor:"pointer",fontSize:".75rem",padding:".2rem",fontFamily:"inherit"}}>✕</button>
              )}
            </div>

            {/* Texte */}
            <p style={{fontSize:".78rem",color:C.texte,lineHeight:1.65,margin:"0 0 .6rem"}}>{p.text}</p>
            {p.photo&&<img src={p.photo} alt="" style={{width:"100%",borderRadius:10,marginBottom:".6rem",display:"block"}}/>}

            {/* Likes */}
            <div style={{display:"flex",alignItems:"center",gap:".5rem"}}>
              <button onClick={()=>toggleLike(p.id)}
                style={{display:"flex",alignItems:"center",gap:".3rem",background:liked?C.rose+"20":"none",border:`1px solid ${liked?C.rose:C.pale}`,borderRadius:20,padding:".22rem .65rem",cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>
                <span style={{fontSize:".8rem"}}>{liked?"❤️":"🤍"}</span>
                <span style={{fontSize:".68rem",fontWeight:600,color:liked?C.rose:C.gris}}>{p.likes.length}</span>
              </button>
              {p.likes.length>0&&(
                <span style={{fontSize:".62rem",color:C.gris,fontStyle:"italic"}}>
                  {p.likes.length===1?"1 personne aime ça":`${p.likes.length} personnes aiment ça`}
                </span>
              )}
            </div>
            {/* Commentaires */}
            <div style={{marginTop:".5rem"}}>
              <button onClick={()=>setOpenComments(prev=>({...prev,[p.id]:!prev[p.id]}))}
                style={{background:"none",border:"none",color:C.gris,fontSize:".65rem",cursor:"pointer",fontFamily:"inherit",padding:0}}>
                💬 {(p.comments||[]).length>0?(p.comments.length+" commentaire"+(p.comments.length>1?"s":"")):"Repondre"}
              </button>
              {openComments[p.id]&&(
                <div style={{marginTop:".5rem"}}>
                  {(p.comments||[]).map(c=>(
                    <div key={c.id} style={{background:C.creme,borderRadius:8,padding:".4rem .6rem",marginBottom:".3rem"}}>
                      <div style={{fontSize:".65rem",fontWeight:700,color:C.brun}}>{c.author}</div>
                      <div style={{fontSize:".7rem",color:C.texte,lineHeight:1.5}}>{c.text}</div>
                    </div>
                  ))}
                  <div style={{display:"flex",gap:".3rem",marginTop:".4rem"}}>
                    <input value={commentInputs[p.id]||""} onChange={e=>setCommentInputs(prev=>({...prev,[p.id]:e.target.value}))}
                      onKeyDown={e=>e.key==="Enter"&&addComment(p.id)}
                      placeholder="Ecris une reponse..."
                      style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".35rem .5rem",fontSize:".72rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none"}}/>
                    <button onClick={()=>addComment(p.id)}
                      style={{background:C.brun,color:"white",border:"none",borderRadius:8,padding:".35rem .6rem",fontSize:".68rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                      Envoyer
                    </button>
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
export { CommunauteTab };
