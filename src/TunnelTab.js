import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { C } from './constants';
import { UploadPhoto } from './FormationProduitsTab';

function TunnelTab({uid, userName}){
  const slug=(userName||uid).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"-");
  const[config,setConfig]=useState({
    // Tunnel Vente
    venteActif:true,
    venteTitre:"Découvrez vos produits idéaux",
    venteAccroche:"Répondez à quelques questions et recevez vos recommandations personnalisées",
    venteImage:"",
    venteCTA:"Commencer mon diagnostic",
    venteLienBoutique:"",
    // Tunnel Recrutement
    recrutActif:true,
    recrutTitre:"Et si vous rejoigniez notre équipe ?",
    recrutAccroche:"Liberté, revenus complémentaires, communauté bienveillante — découvrez si cette aventure est faite pour vous",
    recrutImage:"",
    recrutCTA:"Découvrir l'opportunité",
    recrutLienContact:"",
    // Commun
    couleurPrincipale:"#C49A8A",
    nomAffiche:"",
    photoAffichee:"",
  });
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);
  const[loading,setLoading]=useState(true);
  const[onglet,setOnglet]=useState("vente");
  const[prospects,setProspects]=useState([]);
  const[loadingProspects,setLoadingProspects]=useState(false);

  const urlVente=`https://blazing-dinasty-1fad9.web.app/funnel/${slug}/vente`;
  const urlRecrut=`https://blazing-dinasty-1fad9.web.app/funnel/${slug}/recrutement`;

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"tunnels",uid));
        if(snap.exists()) setConfig(c=>({...c,...snap.data()}));
      }catch{}
      setLoading(false);
    })();
  },[uid]);

  // Charger les prospects générés par le tunnel
  const chargerProspects=async()=>{
    setLoadingProspects(true);
    try{
      const snap=await getDoc(doc(db,"tunnel-prospects",uid));
      if(snap.exists()) setProspects(snap.data().liste||[]);
    }catch{}
    setLoadingProspects(false);
  };

  useEffect(()=>{chargerProspects();},[uid]);

  const save=async()=>{
    setSaving(true);
    try{
      await setDoc(doc(db,"tunnels",uid),{...config,uid,slug,updatedAt:Date.now()});
      setSaved(true);setTimeout(()=>setSaved(false),2000);
    }catch{}
    setSaving(false);
  };

  const copy=(url)=>{navigator.clipboard?.writeText(url);};

  const INP=({label,field,placeholder,textarea=false,type="text"})=>(
    <div style={{marginBottom:".55rem"}}>
      <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>{label}</div>
      {textarea
        ?<textarea value={config[field]||""} onChange={e=>setConfig(c=>({...c,[field]:e.target.value}))} placeholder={placeholder} rows={2}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",resize:"vertical"}}/>
        :<input type={type} value={config[field]||""} onChange={e=>setConfig(c=>({...c,[field]:e.target.value}))} placeholder={placeholder}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
      }
    </div>
  );

  if(loading)return null;

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Mon <em style={{fontStyle:"italic",color:C.rose}}>Tunnel</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        2 tunnels personnalisables — vente et recrutement. Les prospects qui remplissent le formulaire arrivent directement dans ta liste.
      </p>

      {/* Liens à copier */}
      {[{label:"🛍️ Tunnel Vente",url:urlVente,actif:config.venteActif},{label:"👑 Tunnel Recrutement",url:urlRecrut,actif:config.recrutActif}].map(t=>(
        <div key={t.url} style={{background:t.actif?`linear-gradient(135deg,${C.brun},${C.brun2})`:"#888",borderRadius:11,padding:".7rem .9rem",marginBottom:".5rem",display:"flex",alignItems:"center",gap:".6rem"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:".58rem",fontWeight:700,color:C.or,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".15rem"}}>{t.label}</div>
            <div style={{fontSize:".65rem",color:C.pale,wordBreak:"break-all"}}>{t.url}</div>
          </div>
          <button onClick={()=>copy(t.url)} style={{background:C.or,color:C.brun,border:"none",borderRadius:7,padding:".3rem .6rem",fontSize:".65rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer",flexShrink:0}}>
            📋 Copier
          </button>
        </div>
      ))}

      {/* Navigation onglets */}
      <div style={{display:"flex",gap:".3rem",margin:"1rem 0 .75rem"}}>
        {[{id:"vente",label:"🛍️ Vente"},{id:"recrutement",label:"👑 Recrutement"},{id:"prospects",label:`📥 Prospects (${prospects.length})`}].map(o=>(
          <button key={o.id} onClick={()=>{setOnglet(o.id);if(o.id==="prospects")chargerProspects();}}
            style={{flex:1,padding:".45rem .3rem",fontSize:".68rem",fontWeight:600,borderRadius:10,border:`1.5px solid ${onglet===o.id?C.rose:C.pale}`,background:onglet===o.id?C.rose:C.blanc,color:onglet===o.id?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
            {o.label}
          </button>
        ))}
      </div>

      {/* TUNNEL VENTE */}
      {onglet==="vente"&&(
        <div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:".75rem"}}>
            <div style={{fontSize:".6rem",fontWeight:700,color:C.rose,letterSpacing:".1em",textTransform:"uppercase"}}>⚙️ Configuration tunnel vente</div>
            <label style={{display:"flex",alignItems:"center",gap:".4rem",cursor:"pointer"}}>
              <input type="checkbox" checked={!!config.venteActif} onChange={e=>setConfig(c=>({...c,venteActif:e.target.checked}))}/>
              <span style={{fontSize:".72rem",color:C.brun,fontWeight:600}}>{config.venteActif?"Actif":"Inactif"}</span>
            </label>
          </div>
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
            <INP label="Titre principal" field="venteTitre" placeholder="Découvrez vos produits idéaux"/>
            <INP label="Phrase d'accroche" field="venteAccroche" placeholder="Répondez à quelques questions..." textarea/>
            <UploadPhoto label="Image de fond" value={config.venteImage} onChange={v=>setConfig(c=>({...c,venteImage:v}))} folder="tunnels"/>
            <INP label="Texte du bouton principal" field="venteCTA" placeholder="Commencer mon diagnostic"/>
            <INP label="Lien boutique Mihi" field="venteLienBoutique" placeholder="https://mihi.care/fr/..."/>
            <INP label="Couleur principale" field="couleurPrincipale" type="color"/>
          </div>

          {/* Preview vente */}
          <div style={{background:C.creme,borderRadius:12,padding:".75rem",border:`1.5px dashed ${C.pale}`}}>
            <div style={{fontSize:".6rem",color:C.gris,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:".5rem"}}>👁️ Aperçu</div>
            <div style={{background:config.couleurPrincipale||C.brun,borderRadius:10,padding:"1.5rem 1rem",textAlign:"center"}}>
              {config.venteImage&&<img src={config.venteImage} alt="" style={{width:"100%",maxHeight:120,objectFit:"cover",borderRadius:8,marginBottom:".75rem"}}/>}
              <div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",fontWeight:600,color:"white",marginBottom:".4rem"}}>{config.venteTitre||"Titre du tunnel"}</div>
              <div style={{fontSize:".72rem",color:"rgba(255,255,255,.8)",marginBottom:".85rem",lineHeight:1.6}}>{config.venteAccroche||"Accroche..."}</div>
              <div style={{background:"white",color:config.couleurPrincipale||C.brun,borderRadius:9,padding:".55rem 1rem",fontSize:".82rem",fontWeight:700,display:"inline-block"}}>{config.venteCTA||"CTA"}</div>
            </div>
          </div>
        </div>
      )}

      {/* TUNNEL RECRUTEMENT */}
      {onglet==="recrutement"&&(
        <div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:".75rem"}}>
            <div style={{fontSize:".6rem",fontWeight:700,color:C.rose,letterSpacing:".1em",textTransform:"uppercase"}}>⚙️ Configuration tunnel recrutement</div>
            <label style={{display:"flex",alignItems:"center",gap:".4rem",cursor:"pointer"}}>
              <input type="checkbox" checked={!!config.recrutActif} onChange={e=>setConfig(c=>({...c,recrutActif:e.target.checked}))}/>
              <span style={{fontSize:".72rem",color:C.brun,fontWeight:600}}>{config.recrutActif?"Actif":"Inactif"}</span>
            </label>
          </div>
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
            <INP label="Titre principal" field="recrutTitre" placeholder="Et si vous rejoigniez notre équipe ?"/>
            <INP label="Phrase d'accroche" field="recrutAccroche" placeholder="Liberté, revenus, communauté..." textarea/>
            <UploadPhoto label="Image de fond" value={config.recrutImage} onChange={v=>setConfig(c=>({...c,recrutImage:v}))} folder="tunnels"/>
            <INP label="Texte du bouton principal" field="recrutCTA" placeholder="Découvrir l'opportunité"/>
            <INP label="Lien contact / WhatsApp" field="recrutLienContact" placeholder="https://wa.me/33..."/>
          </div>

          <div style={{background:C.creme,borderRadius:12,padding:".75rem",border:`1.5px dashed ${C.pale}`}}>
            <div style={{fontSize:".6rem",color:C.gris,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:".5rem"}}>👁️ Aperçu</div>
            <div style={{background:`linear-gradient(135deg,${C.brun},${config.couleurPrincipale||C.brun2})`,borderRadius:10,padding:"1.5rem 1rem",textAlign:"center"}}>
              {config.recrutImage&&<img src={config.recrutImage} alt="" style={{width:"100%",maxHeight:120,objectFit:"cover",borderRadius:8,marginBottom:".75rem"}}/>}
              <div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",fontWeight:600,color:"white",marginBottom:".4rem"}}>{config.recrutTitre||"Titre du tunnel"}</div>
              <div style={{fontSize:".72rem",color:"rgba(255,255,255,.8)",marginBottom:".85rem",lineHeight:1.6}}>{config.recrutAccroche||"Accroche..."}</div>
              <div style={{background:config.couleurPrincipale||C.rose,color:"white",borderRadius:9,padding:".55rem 1rem",fontSize:".82rem",fontWeight:700,display:"inline-block"}}>{config.recrutCTA||"CTA"}</div>
            </div>
          </div>
        </div>
      )}

      {/* PROSPECTS générés */}
      {onglet==="prospects"&&(
        <div>
          <div style={{fontSize:".6rem",fontWeight:700,color:C.gris,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".6rem"}}>📥 Prospects arrivés via ton tunnel</div>
          {loadingProspects&&<div style={{textAlign:"center",color:C.gris,fontSize:".75rem"}}>Chargement...</div>}
          {!loadingProspects&&prospects.length===0&&(
            <div style={{textAlign:"center",padding:"1.5rem",color:C.gris,fontSize:".75rem",fontStyle:"italic"}}>
              Aucun prospect pour l'instant. Partage tes liens pour en recevoir !
            </div>
          )}
          {prospects.map((p,i)=>(
            <div key={i} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:10,padding:".65rem .85rem",marginBottom:".35rem"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:".82rem",fontWeight:600,color:C.brun}}>{p.prenom} {p.nom}</div>
                  {p.email&&<div style={{fontSize:".65rem",color:C.gris}}>✉️ {p.email}</div>}
                  {p.tel&&<div style={{fontSize:".65rem",color:C.gris}}>📞 {p.tel}</div>}
                  {p.message&&<div style={{fontSize:".68rem",color:C.gris,marginTop:".25rem",fontStyle:"italic"}}>"{p.message}"</div>}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:".6rem",fontWeight:700,color:p.type==="vente"?C.rose:C.or,background:p.type==="vente"?C.rose+"15":C.or+"15",borderRadius:20,padding:".1rem .4rem",marginBottom:".2rem"}}>
                    {p.type==="vente"?"🛍️ Vente":"👑 Recrutement"}
                  </div>
                  <div style={{fontSize:".58rem",color:C.pale}}>{p.date?new Date(p.date).toLocaleDateString("fr-FR"):""}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bouton sauvegarder */}
      {onglet!=="prospects"&&(
        <button onClick={save} disabled={saving} style={{width:"100%",marginTop:"1rem",background:saved?C.vert:C.brun,color:"white",border:"none",borderRadius:10,padding:".7rem",fontSize:".85rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          {saving?"Sauvegarde...":saved?"✅ Sauvegardé !":"Sauvegarder mon tunnel"}
        </button>
      )}
    </div>
  );
}

export { TunnelTab };
