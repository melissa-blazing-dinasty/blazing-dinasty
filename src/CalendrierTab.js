import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { C } from './constants';
import { DecouverteTour } from './App';

const FETES_IMPORTANTES=[
  // ── JANVIER ──
  {title:"🎆 Nouvel An",date:"2026-01-03",type:"fete",notes:"Bonne résolution beauté & bien-être — moment idéal pour pitcher"},
  {title:"👑 Épiphanie / Galette des rois",date:"2026-01-06",type:"fete",notes:"Moment convivial — contenu lifestyle, partage en famille"},
  {title:"🌙 Nouvel An chinois",date:"2026-02-17",type:"fete",notes:"Symbole de renouveau — bon thème pour parler de nouveaux départs"},

  // ── FÉVRIER ──
  {title:"💝 Saint-Valentin",date:"2026-02-14",type:"fete",notes:"Parfums, soins visage, coffrets — offres cadeau à proposer"},
  {title:"😂 Journée mondiale du rire",date:"2026-02-09",type:"fete",notes:"Contenu fun et divertissant — bon pour l'engagement"},

  // ── MARS ──
  {title:"👩 Journée internationale des Femmes",date:"2026-03-08",type:"fete",notes:"Parfaite occasion pour les promos soins & bien-être, mise en avant des femmes entrepreneures"},
  {title:"🍀 Saint-Patrick",date:"2026-03-17",type:"fete",notes:"Thème vert/chance — contenu léger et fun"},
  {title:"🌸 Printemps — Équinoxe",date:"2026-03-20",type:"fete",notes:"Renouveau, fraîcheur — bon moment pour relancer les routines skincare"},
  {title:"🕐 Changement d'heure (été)",date:"2026-03-29",type:"fete",notes:"On perd 1h de sommeil — bon angle pour parler énergie/vitalité"},

  // ── AVRIL ──
  {title:"🐣 Pâques",date:"2026-04-05",type:"fete",notes:"Coffrets cadeaux, chocolat & soin de soi — contenu familial"},
  {title:"🌍 Journée de la Terre",date:"2026-04-22",type:"fete",notes:"Naturalité des produits Mihi — bon angle écoresponsable"},

  // ── MAI ──
  {title:"💪 Fête du Travail",date:"2026-05-01",type:"fete",notes:"Bonne période pour parler liberté financière et indépendance"},
  {title:"🌸 Fête des Mères",date:"2026-05-31",type:"fete",notes:"Meilleure période de l'année — prépare tes offres coffrets"},
  {title:"☀️ Journée mondiale du bien-être",date:"2026-05-09",type:"fete",notes:"Parfait pour mettre en avant les compléments et routines bien-être"},

  // ── JUIN ──
  {title:"👔 Fête des Pères",date:"2026-06-21",type:"fete",notes:"Parfums homme, soins corps — ne pas négliger"},
  {title:"☀️ Été — Solstice",date:"2026-06-21",type:"fete",notes:"Routine été, protection solaire, fraîcheur — bon contenu saisonnier"},
  {title:"🌈 Journée internationale de la Fierté (Pride)",date:"2026-06-28",type:"fete",notes:"Inclusivité — message de bienveillance pour ton équipe"},

  // ── JUILLET ──
  {title:"🇫🇷 Fête Nationale",date:"2026-07-14",type:"fete",notes:"Contenu festif, feu d'artifice — bonne occasion de visibilité légère"},
  {title:"🏖️ Vacances d'été",date:"2026-07-15",type:"fete",notes:"Période calme pour les ventes — privilégier storytelling et préparation rentrée"},

  // ── AOÛT ──
  {title:"☀️ Mi-été",date:"2026-08-15",type:"fete",notes:"Bon moment pour relancer les clientes avant la rentrée"},
  {title:"🎒 Préparation rentrée",date:"2026-08-25",type:"fete",notes:"Bonne période pour recruter — les gens cherchent un revenu complémentaire avant la rentrée"},

  // ── SEPTEMBRE ──
  {title:"🎓 Rentrée",date:"2026-09-01",type:"fete",notes:"Bonne période pour recruter — les gens cherchent un revenu complémentaire"},
  {title:"🍂 Automne — Équinoxe",date:"2026-09-22",type:"fete",notes:"Routine automne, transition skincare — bon contenu saisonnier"},
  {title:"👵 Journée internationale des Grands-Parents",date:"2026-09-13",type:"fete",notes:"Contenu famille et transmission — touchant pour le storytelling"},

  // ── OCTOBRE ──
  {title:"🎃 Halloween",date:"2026-10-31",type:"fete",notes:"Maquillage, soins — contenu fun à créer"},
  {title:"🌷 Journée internationale des Filles",date:"2026-10-11",type:"fete",notes:"Empowerment féminin — bon angle pour le recrutement de femmes"},
  {title:"🕐 Changement d'heure (hiver)",date:"2026-10-25",type:"fete",notes:"On gagne 1h — bon moment pour parler routines du soir et sommeil"},

  // ── NOVEMBRE ──
  {title:"🛍️ Black Friday",date:"2026-11-27",type:"deadline",notes:"Prépare tes offres promotionnelles à l'avance"},
  {title:"🛒 Cyber Monday",date:"2026-11-30",type:"deadline",notes:"Suite du Black Friday — relance digitale"},
  {title:"🎗️ Movember",date:"2026-11-01",type:"fete",notes:"Santé masculine — bon angle pour produits homme et bien-être"},

  // ── DÉCEMBRE ──
  {title:"🎁 Noël (commandes)",date:"2026-12-15",type:"deadline",notes:"⚠️ Dernière date pour commander avant Noël"},
  {title:"🎄 Noël",date:"2026-12-25",type:"fete",notes:"Cadeau parfait : parfums, soins corps, coffrets Mihi"},
  {title:"🎆 Réveillon du Nouvel An",date:"2026-12-31",type:"fete",notes:"Bilan de l'année + lancement nouvelles résolutions — excellent pour le storytelling"},
];


// ══════════════════════════════════════════════════════════════════════════════
// CALENDRIER ÉDITORIAL IA — Planning contenu automatique
// ══════════════════════════════════════════════════════════════════════════════
const THEMES_SEMAINE = [
  { // Lundi
    post1:{ type:"Storytelling", theme:"Ma vie avant/après Mihi", angle:"Transformation personnelle", hook:"Je n'avais pas prévu que ça changerait autant ma vie...", cta:"", conseil_photo:"Dyptique avant/après — lumière naturelle côté fenêtre, expression authentique" },
    post2:{ type:"Conversion", theme:"CTA Minceur", angle:"Appel à l'action produit minceur", hook:"Tu veux perdre du poids sans régime draconien ?", cta:"MINCEUR", conseil_photo:"Produit posé sur surface blanche avec feuille verte" },
    stories:["📸 Coulisses de ton lundi — montre ta vraie vie (café, bureau, enfant)","❓ Sondage : Tu te bats plus contre la fatigue ou la balance ? (A/B)","🔥 Glisse vers ma bio pour le diagnostic GRATUIT →"]
  },
  { // Mardi
    post1:{ type:"Identification", theme:"La douleur de la maman épuisée", angle:"Miroir émotionnel", hook:"Lever à 6h, coucher à 23h, et toujours l'impression de ne rien faire de bien.", cta:"", conseil_photo:"Selfie spontané — pas de maquillage parfait, expression vraie, lumière douce" },
    post2:{ type:"Diagnostic", theme:"CTA Diagnostic beauté", angle:"Personnalisation", hook:"Ton profil beauté/bien-être dit tout sur tes besoins. Tu le connais ?", cta:"DIAGNOSTIC", conseil_photo:"Flatlay soins sur marbre — lumière naturelle, pas de flash" },
    stories:["🌅 Ton matin en 3 photos — sans filtres, sans mise en scène","🎯 Question : Qu'est-ce qui t'épuise le plus en ce moment ?","💊 Le produit qui a tout changé pour moi → voir en bio"]
  },
  { // Mercredi
    post1:{ type:"Expertise Produit", theme:"Focus produit star", angle:"Bénéfice concret + résultat", hook:"3 semaines. C'est le temps qu'il a fallu pour voir la différence.", cta:"", conseil_photo:"Produit en main avec ongles soignés — fond neutre clair" },
    post2:{ type:"Recrutement", theme:"CTA Équipe", angle:"Opportunité discrète", hook:"Je cherche 3 femmes motivées pour développer leur activité depuis chez elles.", cta:"ÉQUIPE", conseil_photo:"Photo de toi au travail — ordinateur, sourire, lumière naturelle" },
    stories:["💡 Astuce du jour : Le rituel matin qui a transformé ma peau","📊 Sondage : Tu préfères les compléments ou les soins topiques ?","👉 Rejoins mon équipe — détails en DM : tape ÉQUIPE"]
  },
  { // Jeudi
    post1:{ type:"Preuve Sociale", theme:"Témoignage cliente", angle:"Résultat réel", hook:"Elle était sceptique. Moi aussi j'aurais été. Et pourtant...", cta:"", conseil_photo:"Capture écran témoignage sur fond de ta couleur de marque" },
    post2:{ type:"Objection Destroyer", theme:"Ce qu'on dit sur le MLM", angle:"Vérité cash", hook:"'C'est une arnaque' — voilà ce qu'on m'a dit quand j'ai commencé.", cta:"", conseil_photo:"Toi face caméra — direct, confiant, lumière frontale douce" },
    stories:["⭐ Résultat d'une cliente cette semaine — sans filtre","🤔 Sondage : Tu as déjà essayé des compléments alimentaires ?","📩 Tu veux ce résultat ? Écris-moi en DM"]
  },
  { // Vendredi
    post1:{ type:"Lifestyle", theme:"Mon vendredi sans patron", angle:"Liberté concrète", hook:"Vendredi 14h. Je récupère mon enfant à l'école. Pas de permission demandée.", cta:"", conseil_photo:"Photo extérieure — lifestyle réel, sourire naturel, tenue décontractée" },
    post2:{ type:"Cadeau", theme:"CTA Silhouette", angle:"Lead magnet carnet", hook:"7 jours de recettes gourmandes pour te sentir plus légère — OFFERT.", cta:"SILHOUETTE", conseil_photo:"Carnet ouvert avec recette visible — fond bois clair, herbes fraîches" },
    stories:["✨ Mon vendredi en images — liberté d'horaires, c'est possible","🎁 Qui veut le carnet silhouette OFFERT ? Réponds à cette story","🌿 Recette du vendredi : smoothie détox express"]
  },
  { // Samedi
    post1:{ type:"Humour / Coulisses", theme:"La réalité de l'entrepreneuriat", angle:"Humour authentique", hook:"La réalité de travailler en pyjama (spoiler : c'est pas toujours glamour 😅)", cta:"", conseil_photo:"Photo candide — pyjama assumé, café, sourire complice" },
    post2:{ type:"Question Interactive", theme:"Sondage communauté", angle:"Engagement fort", hook:"Dis-moi : tu préfères les routines courtes ou les rituels complets ?", cta:"", conseil_photo:"Toi avec tes produits — mise en scène simple, fond uni" },
    stories:["😂 Coulisses honnêtes — le truc qui a mal tourné cette semaine","🗳️ Vote : Routine 5 min ou rituel 20 min ? (A/B)","💬 Raconte-moi ta routine bien-être en DM !"]
  },
  { // Dimanche
    post1:{ type:"Bilan / Inspiration", theme:"Résultats de la semaine", angle:"Preuve que ça marche", hook:"Cette semaine dans mon équipe : voilà ce qui s'est passé.", cta:"", conseil_photo:"Flat lay de la semaine — agenda, produits, chiffres" },
    post2:{ type:"Recrutement Fort", theme:"Places ouvertes nouvelle période", angle:"Urgence douce + opportunité", hook:"La nouvelle période commence. Les premières places sont disponibles.", cta:"ÉQUIPE", conseil_photo:"Toi devant tes produits — posture confiante, regard caméra" },
    stories:["📊 Mon bilan semaine — chiffres et apprentissages","🌟 Cette semaine dans l'équipe — les victoires","💫 Tu veux commencer la semaine prochaine ? DM-moi"]
  },
];

function CalendrierTab({uid,userName,isMelissa,isChef}){
  const[events,setEvents]=useState([]);
  const[loaded,setLoaded]=useState(false);
  const[showAdd,setShowAdd]=useState(false);
  const[showDecouverte,setShowDecouverte]=useState(false);
  const[showFetes,setShowFetes]=useState(true);
  const[fetesOverrides,setFetesOverrides]=useState({}); // {title: {date, notes}}
  const[editFete,setEditFete]=useState(null); // title en cours d'édition
  const[editFeteDate,setEditFeteDate]=useState("");

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"equipe","fetes-overrides"));
        if(snap.exists()) setFetesOverrides(snap.data()||{});
      }catch{}
    })();
  },[]);

  const saveFeteOverride=async(title,date)=>{
    const next={...fetesOverrides,[title]:{date}};
    setFetesOverrides(next);
    try{ await setDoc(doc(db,"equipe","fetes-overrides"),next,{merge:true}); }catch{}
    setEditFete(null);
  };
  const[form,setForm]=useState({title:"",date:"",time:"",type:"zoom",link:"",notes:""});
  const[saving,setSaving]=useState(false);
  const canAdd=isMelissa||isChef;

  const EVENT_TYPES={
    zoom:{icon:"🎥",label:"Zoom formation",color:C.brun},
    vente:{icon:"🛍️",label:"Événement vente",color:C.rose},
    recrutement:{icon:"👥",label:"Présentation recrutement",color:C.lilas},
    deadline:{icon:"⏰",label:"Deadline / Échéance",color:"#C44B1A"},
    fete:{icon:"🎉",label:"Fête / Opportunité",color:C.or},
    other:{icon:"📌",label:"Autre",color:C.gris},
  };

  useEffect(()=>{
    (async()=>{
      try{
        const ref=doc(db,"equipe","calendrier");
        const snap=await getDoc(ref);
        if(snap.exists()){
          const data=snap.data();
          const arr=Object.values(data).sort((a,b)=>a.dateTs-b.dateTs);
          setEvents(arr);
        }
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const saveEvents=async(arr)=>{
    const obj={};
    arr.forEach(e=>{obj[e.id]=e;});
    try{
      const ref=doc(db,"equipe","calendrier");
      await setDoc(ref,obj);
    }catch{}
  };

  const addEvent=async()=>{
    if(!form.title.trim()||!form.date)return;
    setSaving(true);
    const e={
      id:`ev${Date.now()}`,
      ...form,
      dateTs:new Date(form.date+(form.time?`T${form.time}`:"")).getTime(),
      createdBy:userName,
    };
    const next=[...events,e].sort((a,b)=>a.dateTs-b.dateTs);
    setEvents(next);
    await saveEvents(next);
    setForm({title:"",date:"",time:"",type:"zoom",link:"",notes:""});
    setShowAdd(false);
    setSaving(false);
  };

  const delEvent=async(id)=>{
    const next=events.filter(e=>e.id!==id);
    setEvents(next);
    await saveEvents(next);
  };

  const today=new Date();
  today.setHours(0,0,0,0);
  const upcoming=events.filter(e=>new Date(e.dateTs)>=today);
  const past=events.filter(e=>new Date(e.dateTs)<today);

  const[editDateId,setEditDateId]=useState(null);
  const[editDateVal,setEditDateVal]=useState("");
  const[editTimeVal,setEditTimeVal]=useState("");

  const saveEditDate=async(id)=>{
    if(!editDateVal)return;
    const dateTs=new Date(editDateVal+"T"+(editTimeVal||"00:00")).getTime();
    const next=events.map(e=>e.id===id?{...e,date:editDateVal,time:editTimeVal,dateTs}:e).sort((a,b)=>a.dateTs-b.dateTs);
    setEvents(next);
    try{await setDoc(doc(db,"calendrier","events"),{items:next},{merge:true});}catch{}
    setEditDateId(null);
  };

  const EventCard=({e,canDel})=>{
    const cfg=EVENT_TYPES[e.type]||EVENT_TYPES.other;
    const d=new Date(e.dateTs);
    const isPast=d<today;
    const isEditing=editDateId===e.id;
    return(
      <div style={{background:isPast?C.pale+"40":C.blanc,border:`1px solid ${isPast?C.pale:cfg.color+"40"}`,borderRadius:12,padding:".8rem 1rem",marginBottom:".5rem",opacity:isPast?.7:1}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:".35rem"}}>
          <div style={{display:"flex",gap:".5rem",alignItems:"center",flex:1}}>
            <span style={{fontSize:"1.1rem",flexShrink:0}}>{cfg.icon}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:".82rem",fontWeight:600,color:C.brun}}>{e.title}</div>
              <div style={{display:"flex",gap:".4rem",alignItems:"center",marginTop:".15rem",flexWrap:"wrap"}}>
                <span style={{background:cfg.color+"20",color:cfg.color,fontSize:".58rem",fontWeight:700,padding:".1rem .4rem",borderRadius:20}}>{cfg.label}</span>
                <span style={{fontSize:".65rem",color:C.gris}}>
                  {d.toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})}
                  {e.time&&` à ${e.time}`}
                </span>
                {canDel&&!isEditing&&(
                  <button onClick={()=>{setEditDateId(e.id);setEditDateVal(e.date||"");setEditTimeVal(e.time||"");}}
                    style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:6,padding:".1rem .35rem",fontSize:".55rem",color:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
                    ✏️ Date
                  </button>
                )}
              </div>
            </div>
          </div>
          {canDel&&(
            <button onClick={()=>delEvent(e.id)} style={{background:"none",border:"none",color:C.pale,cursor:"pointer",fontSize:".75rem",padding:".2rem",fontFamily:"inherit",flexShrink:0}}>✕</button>
          )}
        </div>
        {isEditing&&(
          <div style={{display:"flex",gap:".3rem",alignItems:"center",marginBottom:".4rem",background:C.creme,borderRadius:8,padding:".4rem .5rem"}}>
            <input type="date" value={editDateVal} onChange={e=>setEditDateVal(e.target.value)}
              style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:7,padding:".3rem .45rem",fontSize:".72rem",fontFamily:"inherit",color:C.texte,background:"white",outline:"none"}}/>
            <input type="time" value={editTimeVal} onChange={e=>setEditTimeVal(e.target.value)}
              style={{width:80,border:`1px solid ${C.pale}`,borderRadius:7,padding:".3rem .45rem",fontSize:".72rem",fontFamily:"inherit",color:C.texte,background:"white",outline:"none"}}/>
            <button onClick={()=>saveEditDate(e.id)}
              style={{background:C.vert,color:"white",border:"none",borderRadius:7,padding:".3rem .55rem",fontSize:".68rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✓</button>
            <button onClick={()=>setEditDateId(null)}
              style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:7,padding:".3rem .45rem",fontSize:".68rem",cursor:"pointer",color:C.gris,fontFamily:"inherit"}}>✕</button>
          </div>
        )}
        {e.notes&&<p style={{fontSize:".73rem",color:C.gris,lineHeight:1.55,margin:".3rem 0 0",fontStyle:"italic"}}>{e.notes}</p>}
        {e.link&&<a href={e.link} target="_blank" rel="noopener noreferrer"
          style={{display:"inline-flex",alignItems:"center",gap:".3rem",background:cfg.color,color:"white",borderRadius:7,padding:".25rem .7rem",fontSize:".68rem",fontWeight:600,textDecoration:"none",marginTop:".45rem"}}>
          🔗 Rejoindre
        </a>}
      </div>
    );
  };

  if(!loaded)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  return(
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:".5rem"}}><button onClick={()=>setShowDecouverte(true)} style={{background:"#C49A8A",color:"white",border:"none",borderRadius:20,padding:".35rem 1rem",fontSize:".75rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(196,154,138,.4)"}}>🧭 Découverte</button></div>
      {showDecouverte&&<DecouverteTour outil="calendrier" onClose={()=>setShowDecouverte(false)}/>}
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Calendrier <em style={{fontStyle:"italic",color:C.rose}}>Équipe</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Événements partagés avec toute l'équipe. {canAdd?"Tu peux ajouter et supprimer des événements.":"Mis à jour par Melissa ou les chefs d'équipe."}
      </p>

      {canAdd&&(
        <div id="decouverte-cal-add"><button onClick={()=>setShowAdd(p=>!p)}
          style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:"1rem"}}>
          ➕ Ajouter un événement
        </button></div>
      )}

      {showAdd&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>Nouvel événement</div>
          <input placeholder="Titre" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".45rem"}}/>
          <div style={{display:"flex",gap:".4rem",marginBottom:".45rem"}}>
            <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}
              style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
            <input type="time" value={form.time} onChange={e=>setForm(p=>({...p,time:e.target.value}))}
              style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
          </div>
          <select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".45rem"}}>
            {Object.entries(EVENT_TYPES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
          <input placeholder="Lien Zoom (optionnel)" value={form.link} onChange={e=>setForm(p=>({...p,link:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".45rem"}}/>
          <input placeholder="Notes (optionnel)" value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".6rem"}}/>
          <div style={{display:"flex",gap:".4rem"}}>
            <button onClick={addEvent} disabled={saving||!form.title.trim()||!form.date}
              style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              {saving?"...":"Ajouter"}
            </button>
            <button onClick={()=>setShowAdd(false)}
              style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Événements à venir */}
      <div id="decouverte-cal-liste" style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.brun,marginBottom:".5rem"}}>
        📅 À venir ({upcoming.length})
      </div>
      {upcoming.length===0&&(
        <div style={{textAlign:"center",padding:"1.5rem",color:C.gris,fontSize:".76rem",marginBottom:"1rem"}}>
          Aucun événement prévu.{canAdd?" Ajoute le prochain Zoom !":""}
        </div>
      )}
      {upcoming.map(e=><EventCard key={e.id} e={e} canDel={canAdd}/>)}

      {/* Fêtes importantes */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"1rem 0 .5rem"}}>
        <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.or}}>🎉 Fêtes & Opportunités commerciales</div>
        <button onClick={()=>setShowFetes(p=>!p)} style={{background:"none",border:"none",color:C.gris,fontSize:".65rem",cursor:"pointer",fontFamily:"inherit"}}>{showFetes?"Masquer":"Voir"}</button>
      </div>
      {showFetes&&FETES_IMPORTANTES.filter(f=>{
        const dateEffective=fetesOverrides[f.title]?.date||f.date;
        return new Date(dateEffective)>=new Date(new Date().setHours(0,0,0,0));
      }).slice(0,10).map(f=>{
        const dateEffective=fetesOverrides[f.title]?.date||f.date;
        const cfg=EVENT_TYPES[f.type]||EVENT_TYPES.other;
        const d=new Date(dateEffective);
        const isEditing=editFete===f.title;
        return(
          <div key={f.title} style={{background:C.blanc,border:`1px solid ${C.or}30`,borderRadius:12,padding:".8rem 1rem",marginBottom:".5rem",opacity:.9}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:".3rem"}}>
              <div style={{display:"flex",gap:".5rem",alignItems:"center",flex:1}}>
                <span style={{fontSize:"1.1rem",flexShrink:0}}>{cfg.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:".82rem",fontWeight:600,color:C.brun}}>{f.title}</div>
                  <div style={{display:"flex",alignItems:"center",gap:".4rem"}}>
                    <span style={{fontSize:".62rem",color:C.gris}}>{d.toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"long"})}</span>
                    {fetesOverrides[f.title]&&<span style={{fontSize:".55rem",color:C.or,fontWeight:700}}>✏️ modifiée</span>}
                    {canAdd&&!isEditing&&(
                      <button onClick={()=>{setEditFete(f.title);setEditFeteDate(dateEffective);}}
                        style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:6,padding:".08rem .3rem",fontSize:".55rem",color:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
                        ✏️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {isEditing&&(
              <div style={{display:"flex",gap:".3rem",alignItems:"center",marginBottom:".4rem",background:C.creme,borderRadius:8,padding:".4rem .5rem"}}>
                <input type="date" value={editFeteDate} onChange={e=>setEditFeteDate(e.target.value)}
                  style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:7,padding:".3rem .45rem",fontSize:".72rem",fontFamily:"inherit",color:C.texte,background:"white",outline:"none"}}/>
                <button onClick={()=>saveFeteOverride(f.title,editFeteDate)}
                  style={{background:C.vert,color:"white",border:"none",borderRadius:7,padding:".3rem .55rem",fontSize:".68rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✓</button>
                <button onClick={()=>{if(fetesOverrides[f.title]){const n={...fetesOverrides};delete n[f.title];setFetesOverrides(n);setDoc(doc(db,"equipe","fetes-overrides"),n).catch(()=>{});}setEditFete(null);}}
                  style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:7,padding:".3rem .45rem",fontSize:".68rem",cursor:"pointer",color:"#B04040",fontFamily:"inherit"}}>↩</button>
              </div>
            )}
            {f.notes&&<p style={{fontSize:".72rem",color:C.gris,lineHeight:1.55,margin:".2rem 0 0",fontStyle:"italic"}}>{f.notes}</p>}
          </div>
        );
      })}

      {/* Événements passés */}
      {past.length>0&&(
        <>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.gris,margin:"1rem 0 .5rem"}}>
            Passés ({past.length})
          </div>
          {past.slice(-3).reverse().map(e=><EventCard key={e.id} e={e} canDel={canAdd}/>)}
        </>
      )}
    </div>
  );
}

export { CalendrierTab };
