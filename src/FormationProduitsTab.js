import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, storage } from './firebase';
import { ref as storageRefVideo, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { C } from './constants';
import { useLang, useTranslatedProduit } from './components';

// ── FORMATION PRODUITS ───────────────────────────────────────────────────────
const CATEGORIES_PRODUITS = [
  {id:"parfum",        label:"Parfum",                  icon:"🌸", color:"#9B59B6"},
  {id:"makeup",        label:"Maquillage",               icon:"💄", color:"#E91E8C"},
  {id:"complement",    label:"Compléments alimentaires", icon:"💊", color:"#27AE60"},
  {id:"poids",         label:"Perte de poids",           icon:"⚖️", color:"#E67E22"},
  {id:"skincare",      label:"Skincare",                 icon:"✨", color:"#C49A8A"},
  {id:"cheveux",       label:"Soins cheveux",            icon:"💇", color:"#8E44AD"},
  {id:"corpsoin",      label:"Soins corps",              icon:"🧴", color:"#3498DB"},
  {id:"entretien",     label:"Produits d'entretien",     icon:"🏠", color:"#7F8C8D"},
  {id:"problematiques",label:"Par Problématiques",       icon:"🎯", color:"#C0392B"},
];

// Sous-thèmes de la catégorie Problématiques
const PROBLEMATIQUES_THEMES = [
  {id:"anti_age",       label:"Anti-âge",            icon:"⏳", color:"#8E44AD"},
  {id:"acne",           label:"Acné / Imperfections", icon:"🌿", color:"#27AE60"},
  {id:"peau_seche",     label:"Peau sèche",           icon:"💧", color:"#3498DB"},
  {id:"peau_grasse",    label:"Peau grasse",          icon:"🫧", color:"#1ABC9C"},
  {id:"eclat",          label:"Éclat / Teint terne",  icon:"☀️", color:"#F39C12"},
  {id:"cernes",         label:"Cernes / Fatigue",     icon:"🌙", color:"#6C3483"},
  {id:"cellulite",      label:"Cellulite / Fermeté",  icon:"💪", color:"#E67E22"},
  {id:"cheveux_abimes", label:"Cheveux abîmés",        icon:"💇", color:"#5D6D7E"},
  {id:"perte_cheveux",  label:"Perte de cheveux",     icon:"🔄", color:"#C0392B"},
  {id:"stress",         label:"Stress / Sommeil",     icon:"😴", color:"#2980B9"},
  {id:"digestion",      label:"Digestion",            icon:"🌱", color:"#27AE60"},
  {id:"immunite",       label:"Immunité",             icon:"🛡️", color:"#E74C3C"},
  {id:"energie",        label:"Énergie / Vitalité",   icon:"⚡", color:"#F1C40F"},
  {id:"minceur",        label:"Minceur globale",      icon:"🎯", color:"#E67E22"},
];


function FormationProduitsTab(){
  const {lang} = useLang();
  const[produits,setProduits]=useState({});
  const[loading,setLoading]=useState(true);
  const[catActive,setCatActive]=useState("parfum");
  const[produitOuvert,setProduitOuvert]=useState(null); // {id, cat}
  const[ongletProduit,setOngletProduit]=useState("texte");
  const[makeupSousOnglet,setMakeupSousOnglet]=useState("produits"); // produits | tips

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","formation_produits"));
        if(snap.exists()) setProduits(snap.data().produits||{});
      }catch{}
      setLoading(false);
    })();
  },[]);

  const cat=CATEGORIES_PRODUITS.find(c=>c.id===catActive)||CATEGORIES_PRODUITS[0];
  const[themeActif,setThemeActif]=useState(null);
  const makeupKey = catActive==="makeup" ? (makeupSousOnglet==="tips" ? "makeup_tips" : "makeup") : catActive;
  const listeCat=produits[makeupKey]||[];
  // Pour problématiques : filtrer par thème si sélectionné
  const listeAffichee=catActive==="problematiques"&&themeActif
    ?listeCat.filter(p=>p.theme===themeActif)
    :listeCat;
  const produitActifRaw=produitOuvert?listeCat.find(p=>p.id===produitOuvert.id):null;
  const produitActif=useTranslatedProduit(produitActifRaw);

  if(loading)return <div style={{textAlign:"center",padding:"2rem",color:C.gris}}>Chargement...</div>;

  // Vue détail produit
  if(produitActif){
    return(
      <div>
        {/* Header produit */}
        <button onClick={()=>{setProduitOuvert(null);setOngletProduit("texte");}}
          style={{background:"none",border:"none",color:C.gris,fontSize:".75rem",cursor:"pointer",fontFamily:"inherit",marginBottom:"1rem",padding:0,display:"flex",alignItems:"center",gap:".3rem"}}>
          ← Retour {cat.label}
        </button>

        {/* Image avec titre superposé */}
        <div style={{position:"relative",borderRadius:14,overflow:"hidden",marginBottom:"1rem",minHeight:produitActif.image?200:80}}>
          {produitActif.image
            ?<img src={produitActif.image} alt={produitActif.titre} style={{width:"100%",maxHeight:240,objectFit:"cover",display:"block"}}/>
            :<div style={{background:`linear-gradient(135deg,${cat.color},${cat.color}88)`,height:120}}/>
          }
          <div style={{position:"absolute",top:0,left:0,right:0,padding:"1rem",background:"linear-gradient(180deg,rgba(0,0,0,.55) 0%,transparent 100%)"}}>
            <div style={{fontSize:".55rem",fontWeight:700,color:"rgba(255,255,255,.8)",letterSpacing:".12em",textTransform:"uppercase",marginBottom:".2rem"}}>{cat.icon} {cat.label}</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,color:"white",lineHeight:1.35}}>{produitActif.titre}</div>
          </div>
        </div>

        {/* Onglets Texte / Vidéo */}
        <div style={{display:"flex",gap:".4rem",marginBottom:"1rem"}}>
          {[{id:"texte",label:"📄 Texte"},{id:"video",label:"▶ Vidéo"}].map(o=>(
            <button key={o.id} onClick={()=>setOngletProduit(o.id)}
              style={{flex:1,padding:".5rem",fontSize:".78rem",fontWeight:600,borderRadius:10,border:`1.5px solid ${ongletProduit===o.id?cat.color:C.pale}`,background:ongletProduit===o.id?cat.color:C.blanc,color:ongletProduit===o.id?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              {o.label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        {ongletProduit==="texte"&&(
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem"}}>
            {produitActif.description
              ?<div style={{fontSize:".82rem",color:C.texte,lineHeight:1.75,whiteSpace:"pre-wrap"}}>{produitActif.description}</div>
              :<div style={{textAlign:"center",padding:"1.5rem",color:C.gris,fontSize:".75rem",fontStyle:"italic"}}>Aucun texte pour ce produit.</div>
            }
          </div>
        )}

        {ongletProduit==="video"&&(
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem"}}>
            {produitActif.videoUrl
              ?<a href={produitActif.videoUrl} target="_blank" rel="noopener noreferrer"
                  style={{display:"flex",alignItems:"center",gap:".75rem",background:`linear-gradient(135deg,${cat.color},${cat.color}aa)`,borderRadius:10,padding:".85rem 1rem",textDecoration:"none"}}>
                  <div style={{width:44,height:44,borderRadius:"50%",background:"rgba(255,255,255,.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.3rem",flexShrink:0}}>▶</div>
                  <div>
                    <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:"white"}}>{produitActif.titreVideo||"Voir la vidéo"}</div>
                    <div style={{fontSize:".65rem",color:"rgba(255,255,255,.75)",marginTop:".15rem"}}>Cliquer pour regarder</div>
                  </div>
                </a>
              :<div style={{textAlign:"center",padding:"1.5rem",color:C.gris,fontSize:".75rem",fontStyle:"italic"}}>
                🎬 Vidéo à venir prochainement
              </div>
            }
          </div>
        )}
      </div>
    );
  }

  // Vue liste
  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".75rem"}}>
        Formation <em style={{fontStyle:"italic",color:C.rose}}>Produits</em>
      </div>

      {/* Catégories */}
      <div style={{display:"flex",gap:".3rem",overflowX:"auto",paddingBottom:".3rem",marginBottom:"1rem"}}>
        {CATEGORIES_PRODUITS.map(c=>(
          <button key={c.id} onClick={()=>{setCatActive(c.id);setProduitOuvert(null);}}
            style={{flexShrink:0,padding:".42rem .75rem",fontSize:".7rem",fontWeight:600,borderRadius:20,border:`1.5px solid ${catActive===c.id?c.color:C.pale}`,background:catActive===c.id?c.color:C.blanc,color:catActive===c.id?"white":C.gris,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Sous-onglets Maquillage */}
      {catActive==="makeup"&&(
        <div style={{display:"flex",gap:".4rem",marginBottom:"1rem"}}>
          {[{id:"produits",label:"💄 Produits"},{id:"tips",label:"✨ Tips & Astuces"}].map(o=>(
            <button key={o.id} onClick={()=>setMakeupSousOnglet(o.id)}
              style={{flex:1,padding:".5rem",fontSize:".78rem",fontWeight:600,borderRadius:10,border:"1.5px solid "+(makeupSousOnglet===o.id?"#E91E8C":C.pale),background:makeupSousOnglet===o.id?"#E91E8C":"white",color:makeupSousOnglet===o.id?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              {o.label}
            </button>
          ))}
        </div>
      )}

      {/* Sous-thèmes pour Problématiques */}
      {catActive==="problematiques"&&(
        <div style={{marginBottom:".75rem"}}>
          <div style={{fontSize:".6rem",color:C.gris,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:".4rem"}}>Filtrer par problématique</div>
          <div style={{display:"flex",gap:".25rem",flexWrap:"wrap"}}>
            <button onClick={()=>setThemeActif(null)}
              style={{padding:".28rem .6rem",fontSize:".65rem",fontWeight:600,borderRadius:20,border:`1.5px solid ${!themeActif?"#C0392B":C.pale}`,background:!themeActif?"#C0392B":C.blanc,color:!themeActif?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              Tout voir ({listeCat.length})
            </button>
            {PROBLEMATIQUES_THEMES.filter(t=>listeCat.some(p=>p.theme===t.id)).map(t=>(
              <button key={t.id} onClick={()=>setThemeActif(themeActif===t.id?null:t.id)}
                style={{padding:".28rem .6rem",fontSize:".65rem",fontWeight:600,borderRadius:20,border:`1.5px solid ${themeActif===t.id?t.color:C.pale}`,background:themeActif===t.id?t.color:C.blanc,color:themeActif===t.id?"white":C.gris,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                {t.icon} {t.label} ({listeCat.filter(p=>p.theme===t.id).length})
              </button>
            ))}
            {/* Afficher les thèmes vides en gris si tous les thèmes */}
            {PROBLEMATIQUES_THEMES.filter(t=>!listeCat.some(p=>p.theme===t.id)).map(t=>(
              <span key={t.id} style={{padding:".28rem .6rem",fontSize:".62rem",borderRadius:20,border:`1px solid ${C.pale}`,color:C.pale,whiteSpace:"nowrap"}}>
                {t.icon} {t.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Grille produits */}
      {listeAffichee.length===0
        ?<div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".76rem",fontStyle:"italic"}}>
            {catActive==="problematiques"&&themeActif?"Aucun produit pour cette problématique.":"Aucun produit dans cette catégorie pour l'instant."}
          </div>
        :<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".65rem"}}>
          {listeAffichee.map(p=>(
            <div key={p.id} onClick={()=>{setProduitOuvert({id:p.id,cat:catActive});setOngletProduit("texte");}}
              style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,overflow:"hidden",cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,.05)",transition:"transform .15s"}}
              onTouchStart={e=>e.currentTarget.style.transform="scale(.97)"}
              onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>
              {/* Image */}
              <div style={{position:"relative",height:110,background:`linear-gradient(135deg,${cat.color}30,${cat.color}15)`,overflow:"hidden"}}>
                {p.image
                  ?<img src={p.image} alt={p.titre} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  :<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",fontSize:"2.5rem"}}>{cat.icon}</div>
                }
                {/* Titre superposé en haut à gauche */}
                <div style={{position:"absolute",top:0,left:0,right:0,padding:".5rem .6rem",background:"linear-gradient(180deg,rgba(0,0,0,.6) 0%,transparent 100%)"}}>
                  <div style={{fontFamily:"Georgia,serif",fontSize:".78rem",fontWeight:700,color:"white",lineHeight:1.3,textShadow:"0 1px 3px rgba(0,0,0,.5)"}}>{p.titre}</div>
                </div>
                {/* Badge vidéo */}
                {p.videoUrl&&<div style={{position:"absolute",bottom:4,right:4,background:"rgba(0,0,0,.5)",borderRadius:20,padding:".1rem .35rem",fontSize:".55rem",color:"white"}}>▶ Vidéo</div>}
              </div>
              {/* Extrait */}
              {p.description&&<div style={{padding:".5rem .65rem",fontSize:".68rem",color:C.gris,lineHeight:1.5}}>
                {p.description.slice(0,80)}{p.description.length>80?"...":""}
              </div>}
            </div>
          ))}
        </div>
      }
    </div>
  );
}

// Admin Formation Produits
// Composant upload photo — sélection depuis galerie OU URL
export function UploadPhoto({value, onChange, label="Photo", folder="produits"}){
  const[uploading,setUploading]=useState(false);
  const[preview,setPreview]=useState(value||"");

  useEffect(()=>setPreview(value||""),[value]);

  const handleFile=async(e)=>{
    const file=e.target.files?.[0];
    if(!file)return;
    setUploading(true);
    try{
      // Preview immédiat
      const reader=new FileReader();
      reader.onload=ev=>setPreview(ev.target.result);
      reader.readAsDataURL(file);
      // Compresser l image avant sauvegarde
      const img=new Image();
      img.onload=()=>{
        const canvas=document.createElement("canvas");
        const MAX=400;
        let w=img.width,h=img.height;
        if(w>h){if(w>MAX){h=h*(MAX/w);w=MAX;}}else{if(h>MAX){w=w*(MAX/h);h=MAX;}}
        canvas.width=w;canvas.height=h;
        canvas.getContext("2d").drawImage(img,0,0,w,h);
        const compressed=canvas.toDataURL("image/jpeg",0.7);
        onChange(compressed);
      };
      const reader2=new FileReader();reader2.onload=ev=>{img.src=ev.target.result;setUploading(false);};reader2.readAsDataURL(file);return;
    }catch(err){
      alert("Erreur upload : "+err.message);
    }
    setUploading(false);
  };

  return(
    <div style={{marginBottom:".55rem"}}>
      <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>{label}</div>
      <div style={{display:"flex",gap:".4rem",alignItems:"flex-start"}}>
        {preview&&<img src={preview} alt="" style={{width:52,height:52,borderRadius:8,objectFit:"cover",flexShrink:0,border:`1px solid ${C.pale}`}}/>}
        <div style={{flex:1}}>
          <label style={{display:"block",background:uploading?"#aaa":C.brun,color:"white",borderRadius:8,padding:".38rem .65rem",fontSize:".72rem",fontWeight:600,textAlign:"center",cursor:uploading?"default":"pointer",fontFamily:"inherit",marginBottom:".25rem"}}>
            {uploading?"⏳ Envoi en cours...":preview?"🔄 Changer la photo":"📷 Choisir une photo"}
            <input type="file" accept="image/*" onChange={handleFile} style={{display:"none"}} disabled={uploading} key={preview}/>
          </label>
          {preview&&<button onClick={()=>{setPreview("");onChange("");}} style={{display:"block",width:"100%",background:"none",border:`1px solid ${C.pale}`,borderRadius:7,padding:".22rem .5rem",fontSize:".65rem",color:C.gris,cursor:"pointer",fontFamily:"inherit",marginBottom:".25rem"}}>✕ Supprimer</button>}
          <input value={value||""} onChange={e=>{onChange(e.target.value);setPreview(e.target.value);}} placeholder="...ou coller une URL"
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:7,padding:".32rem .5rem",fontSize:".7rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
        </div>
      </div>
    </div>
  );
}
export function UploadVideo({value, onChange, label="Video", folder="linkbio-videos", uid="anon"}){
  const[uploading,setUploading]=useState(false);
  const[progress,setProgress]=useState(0);
  const[preview,setPreview]=useState(value||"");
  useEffect(()=>setPreview(value||""),[value]);
  const handleFile=async(e)=>{
    const file=e.target.files?.[0];
    if(!file)return;
    if(file.size>50*1024*1024){ alert("Video trop volumineuse (50 Mo max)."); return; }
    setUploading(true);setProgress(0);
    try{
      const path=`${folder}/${uid}/${Date.now()}-${file.name}`;
      const fileRef=storageRefVideo(storage,path);
      const uploadTask=uploadBytesResumable(fileRef,file);
      uploadTask.on("state_changed",
        (snap)=>{ setProgress(Math.round((snap.bytesTransferred/snap.totalBytes)*100)); },
        (err)=>{ alert("Erreur upload video : "+err.message); setUploading(false); },
        async()=>{
          const url=await getDownloadURL(uploadTask.snapshot.ref);
          setPreview(url);
          onChange(url);
          setUploading(false);
        }
      );
    }catch(err){
      alert("Erreur upload : "+err.message);
      setUploading(false);
    }
  };
  return(
    <div style={{marginBottom:".55rem"}}>
      <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>{label}</div>
      {preview&&<video src={preview} controls style={{width:"100%",maxWidth:220,borderRadius:8,marginBottom:".3rem",display:"block"}}/>}
      <label style={{display:"block",background:uploading?"#aaa":C.brun,color:"white",borderRadius:8,padding:".38rem .65rem",fontSize:".72rem",fontWeight:600,textAlign:"center",cursor:uploading?"default":"pointer",fontFamily:"inherit",marginBottom:".25rem"}}>
        {uploading?`Envoi... ${progress}%`:preview?"Changer la video":"Choisir une video"}
        <input type="file" accept="video/*" onChange={handleFile} style={{display:"none"}} disabled={uploading}/>
      </label>
      {preview&&!uploading&&<button onClick={()=>{setPreview("");onChange("");}} style={{display:"block",width:"100%",background:"none",border:`1px solid ${C.pale}`,borderRadius:7,padding:".22rem .5rem",fontSize:".65rem",color:C.gris,cursor:"pointer",fontFamily:"inherit"}}>Supprimer la video</button>}
    </div>
  );
}

// Composant global — ne jamais définir à l'intérieur d'un autre composant
function FormField({label, value, onChange, placeholder, textarea=false, type="text"}){
  return(
    <div style={{marginBottom:".5rem"}}>
      <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>{label}</div>
      {textarea
        ?<textarea value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={5}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",resize:"vertical",lineHeight:1.6}}/>
        :<input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
      }
    </div>
  );
}

function AdminFormationProduits(){
  const[produits,setProduits]=useState({});
  const[loading,setLoading]=useState(true);
  const[catActive,setCatActive]=useState("parfum");
  const[showForm,setShowForm]=useState(false);
  const[editId,setEditId]=useState(null);
  const[form,setForm]=useState({titre:"",image:"",description:"",videoUrl:"",titreVideo:"",theme:""});
  const[saving,setSaving]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","formation_produits"));
        if(snap.exists()) setProduits(snap.data().produits||{});
      }catch{}
      setLoading(false);
    })();
  },[]);

  const save=async(nextProduits)=>{
    setSaving(true);
    try{await setDoc(doc(db,"admin","formation_produits"),{produits:nextProduits});setProduits(nextProduits);}catch{}
    setSaving(false);
  };

  const ajouter=async()=>{
    if(!form.titre.trim())return;
    const cat=catActive;
    const listeCat=produits[cat]||[];
    let next;
    if(editId){
      next={...produits,[cat]:listeCat.map(p=>p.id===editId?{...p,...form}:p)};
    } else {
      next={...produits,[cat]:[...listeCat,{id:`p${Date.now()}`,...form}]};
    }
    await save(next);
    setForm({titre:"",image:"",description:"",videoUrl:"",titreVideo:"",theme:""});
    setShowForm(false);setEditId(null);
  };

  const supprimer=async(cat,id)=>{
    if(!window.confirm("Supprimer ce produit ?"))return;
    await save({...produits,[cat]:(produits[cat]||[]).filter(p=>p.id!==id)});
  };

  if(loading)return null;

  const listeCat=produits[catActive]||[];

  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1.25rem"}}>
      <div style={{fontSize:".6rem",fontWeight:700,color:C.rose,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".75rem"}}>🧴 Formation Produits — Gestion du contenu</div>

      {/* Catégories */}
      <div style={{display:"flex",gap:".25rem",overflowX:"auto",marginBottom:".75rem",paddingBottom:".2rem"}}>
        {CATEGORIES_PRODUITS.map(c=>(
          <button key={c.id} onClick={()=>{setCatActive(c.id);setShowForm(false);setEditId(null);}}
            style={{flexShrink:0,padding:".3rem .55rem",fontSize:".65rem",fontWeight:600,borderRadius:8,border:`1.5px solid ${catActive===c.id?c.color:C.pale}`,background:catActive===c.id?c.color:C.blanc,color:catActive===c.id?"white":C.gris,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Formulaire */}
      {showForm&&(
        <div style={{background:C.creme,borderRadius:10,padding:".85rem",marginBottom:".75rem",border:`1px solid ${C.pale}`}}>
          <div style={{fontSize:".65rem",fontWeight:700,color:C.brun,marginBottom:".6rem"}}>{editId?"✏️ Modifier":"+ Nouveau produit"} — {CATEGORIES_PRODUITS.find(c=>c.id===catActive)?.label}</div>
          <FormField label="Titre du produit *" value={form.titre} onChange={v=>setForm(p=>({...p,titre:v}))} placeholder="Ex: Eau de parfum Rose Dorée"/>
          <UploadPhoto label="Image du produit" value={form.image} onChange={v=>setForm(p=>({...p,image:v}))} folder="produits"/>
          {catActive==="problematiques"&&(
            <div style={{marginBottom:".5rem"}}>
              <div style={{fontSize:".6rem",color:C.gris,marginBottom:".3rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>🎯 Problématique</div>
              <select value={form.theme} onChange={e=>setForm(p=>({...p,theme:e.target.value}))}
                style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}>
                <option value="">— Choisir une problématique —</option>
                {PROBLEMATIQUES_THEMES.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
              </select>
            </div>
          )}
          <FormField label="Texte / Description" value={form.description} onChange={v=>setForm(p=>({...p,description:v}))} placeholder="Composition, bienfaits, conseils d'utilisation..." textarea={true}/>
          <FormField label="Lien vidéo (YouTube, Zoom...)" value={form.videoUrl} onChange={v=>setForm(p=>({...p,videoUrl:v}))} placeholder="https://..."/>
          <FormField label="Titre de la vidéo" value={form.titreVideo} onChange={v=>setForm(p=>({...p,titreVideo:v}))} placeholder="Ex: Présentation de la gamme"/>
          <div style={{display:"flex",gap:".4rem",marginTop:".25rem"}}>
            <button onClick={ajouter} disabled={saving||!form.titre.trim()}
              style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".48rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              {saving?"Sauvegarde...":editId?"✓ Modifier":"✓ Ajouter"}
            </button>
            <button onClick={()=>{setShowForm(false);setEditId(null);setForm({titre:"",image:"",description:"",videoUrl:"",titreVideo:"",theme:""}); }}
              style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".48rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {!showForm&&<button onClick={()=>setShowForm(true)}
        style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".48rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:".6rem"}}>
        + Ajouter un produit dans {CATEGORIES_PRODUITS.find(c=>c.id===catActive)?.label}
      </button>}

      {/* Liste existante */}
      {listeCat.map(p=>(
        <div key={p.id} style={{display:"flex",alignItems:"center",gap:".5rem",background:C.creme,borderRadius:9,padding:".5rem .75rem",marginBottom:".35rem",border:`1px solid ${C.pale}`}}>
          {p.image&&<img src={p.image} alt="" style={{width:40,height:40,borderRadius:7,objectFit:"cover",flexShrink:0}}/>}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:".78rem",fontWeight:600,color:C.brun,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.titre}</div>
            <div style={{fontSize:".6rem",color:C.gris}}>{p.videoUrl?"▶ Vidéo · ":""}{p.theme?`🎯 ${PROBLEMATIQUES_THEMES.find(t=>t.id===p.theme)?.label||p.theme} · `:""}{p.description?.slice(0,40)||"Pas de texte"}{p.description?.length>40?"...":""}</div>
          </div>
          <button onClick={()=>{setEditId(p.id);setForm({titre:p.titre||"",image:p.image||"",description:p.description||"",videoUrl:p.videoUrl||"",titreVideo:p.titreVideo||"",theme:p.theme||""});setShowForm(true);}}
            style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:6,padding:".2rem .4rem",fontSize:".62rem",color:C.gris,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>✏️</button>
          <button onClick={()=>supprimer(catActive,p.id)}
            style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:6,padding:".2rem .4rem",fontSize:".62rem",color:"#B04040",cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>✕</button>
        </div>
      ))}
      {listeCat.length===0&&<div style={{textAlign:"center",fontSize:".72rem",color:C.gris,padding:".5rem",fontStyle:"italic"}}>Aucun produit — ajoute le premier !</div>}
    </div>
  );
}



export { FormationProduitsTab, AdminFormationProduits, CATEGORIES_PRODUITS };
