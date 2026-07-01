import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { C } from './constants';
import { MELISSA } from './ClientsTab';
import { CopyBtn } from './components';
import { ANTHROPIC_API_KEY, DecouverteTour } from './App';

const IDEES_POSTS = {
  storytelling: [
    "Ma vie avant/après Mihi — la vraie transformation",
    "Le jour où j'ai dit oui à cette opportunité",
    "Ce que personne ne voit derrière mes posts",
    "Mon plus grand doute quand j'ai commencé",
    "La semaine où tout a failli s'arrêter",
    "Comment je concilie maternité et entrepreneuriat",
    "Mon premier chèque Mihi — ce que j'ai ressenti",
    "Pourquoi j'ai quitté mon ancien job",
  ],
  identification: [
    "Tu te reconnais ? Lever à 6h coucher à 23h...",
    "Maman épuisée qui rêve d'autre chose 🙋",
    "Quand tu passes 8h au bureau pour un salaire qui ne suit pas",
    "Le syndrome de la femme qui fait tout pour tout le monde",
    "Quand l'agenda des autres dicte ta vie",
    "Tu mérites mieux qu'un salaire minimum à 45 ans",
    "Bosser dur sans voir la couleur de ton argent",
  ],
  produit: [
    "3 semaines pour voir la différence — voici le résultat",
    "Le produit qui a remplacé ma routine complète",
    "Pourquoi je ne peux plus me passer de X",
    "Avant/après — et non c'est pas un filtre",
    "Le secret de ma peau à 35 ans",
    "J'ai testé pendant 30 jours — voilà ce que j'en pense",
    "Mes 3 essentiels Mihi du mois",
    "Focus sur notre best-seller — pourquoi il cartonne",
  ],
  preuve_sociale: [
    "Elle était sceptique. Résultat après 1 mois →",
    "Témoignage de la semaine — elle a tout essayé avant",
    "Quand une cliente me dit ça, mon coeur 🥺",
    "Message reçu ce matin qui m'a fait pleurer",
    "Elle a perdu X kg en X semaines avec cette routine",
    "Mon équipe cette semaine — je suis trop fière",
  ],
  recrutement: [
    "Je cherche 3 femmes motivées pour rejoindre mon équipe",
    "Ce que personne ne te dit sur le MLM (la vérité)",
    "Comment je gagne un revenu complémentaire depuis chez moi",
    "Tu veux travailler depuis n'importe où ?",
    "Les places pour P9 sont ouvertes — qui est partante ?",
    "Rejoindre Mihi c'est quoi concrètement ?",
    "Mon équipe grandit — tu veux en faire partie ?",
  ],
  lifestyle: [
    "Vendredi 14h — je récupère mon enfant. Pas de permission.",
    "Mon bureau aujourd'hui (indice : c'est un café)",
    "Travailler en pyjama — la réalité vs le fantasme 😅",
    "Ce que la liberté financière change vraiment",
    "Une journée dans ma vie de maman-entrepreneuse",
    "Mon matin sans alarme 🌅",
    "Le luxe de choisir ses horaires",
  ],
  conversion: [
    "CTA MINCEUR — Tu veux perdre du poids sans régime ?",
    "CTA DIAGNOSTIC — Ton profil beauté dit tout",
    "CTA EQUIPE — Opportunité de revenu complémentaire",
    "CTA SILHOUETTE — Carnet recettes gourmandes offert",
    "Question sondage — Tu préfères routine courte ou rituel complet ?",
    "Appel direct — DM-moi le mot MINCEUR",
  ],
  humour: [
    "La réalité de bosser depuis chez soi (thread honnête)",
    "Les questions qu'on me pose sur Mihi 😂",
    "Ce que ma famille pense de mon activité vs la réalité",
    "Mon bureau vu par les réseaux vs mon bureau IRL",
    "Les 5 phases de la distributrice Mihi",
  ],
};

const CATEGORIES_IDEES = [
  {id:"storytelling", label:"✨ Storytelling", color:"#C49A8A"},
  {id:"identification", label:"🪞 Identification", color:"#A89BB5"},
  {id:"produit", label:"💊 Produit", color:"#7FAF8A"},
  {id:"preuve_sociale", label:"⭐ Preuve sociale", color:"#C4A882"},
  {id:"recrutement", label:"👑 Recrutement", color:"#3D1F0E"},
  {id:"lifestyle", label:"🌸 Lifestyle", color:"#C49A8A"},
  {id:"conversion", label:"🔥 Conversion CTA", color:"#B04040"},
  {id:"humour", label:"😄 Humour", color:"#5A8A7A"},
];

function EditorialTab({ uid, userName }) {
  const [vue, setVue] = useState("semaine");
  const [contenu, setContenu] = useState({});
  const [generating, setGenerating] = useState(null);
  const [jourOuvert, setJourOuvert] = useState(null);
  const [copied, setCopied] = useState(null);
  const [savedDays, setSavedDays] = useState({});
  const [editMode, setEditMode] = useState(null); // {dateStr, postIdx}
  const [showIdees, setShowIdees] = useState(null); // {dateStr, postIdx}
  const [customThemes, setCustomThemes] = useState({}); // {dateStr: {p1Override, p2Override}}
  const [histoire, setHistoire] = useState(""); // profil global pour influencer l'IA
  const [notesJour, setNotesJour] = useState({}); // {dateStr: "note du jour"}
  const [showHistoire, setShowHistoire] = useState(false);
  const [showDecouverte, setShowDecouverte] = useState(false);

  const today = new Date();
  const todayStr = today.toISOString().slice(0,10);
  const JOURS = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
  const MOIS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
  const API_KEY = ANTHROPIC_API_KEY;

  const THEMES = [
    {p1:{type:"Storytelling",hook:"Je n'avais pas prévu que ça changerait ma vie...",conseil:"Dyptique avant/après, lumière naturelle"},p2:{type:"Conversion Minceur",hook:"Tu veux perdre du poids sans régime draconien ?",cta:"MINCEUR",conseil:"Produit sur fond blanc avec feuille verte"},s:["Coulisses de ton lundi — café, enfant, bureau","Sondage : tu te bats plus contre la fatigue ou la balance ?","Diagnostic GRATUIT → lien en bio"]},
    {p1:{type:"Identification",hook:"Lever à 6h, coucher à 23h, toujours l'impression de ne rien faire de bien.",conseil:"Selfie spontané, lumière douce"},p2:{type:"Diagnostic",hook:"Ton profil beauté dit tout sur tes besoins. Tu le connais ?",cta:"DIAGNOSTIC",conseil:"Flatlay soins sur marbre, lumière naturelle"},s:["Ton matin en 3 photos — sans filtres","Question : qu'est-ce qui t'épuise le plus ?","Le produit qui a tout changé → bio"]},
    {p1:{type:"Expertise Produit",hook:"3 semaines. C'est le temps qu'il a fallu pour voir la différence.",conseil:"Produit en main, fond neutre clair"},p2:{type:"Recrutement",hook:"Je cherche 3 femmes motivées pour développer leur activité.",cta:"EQUIPE",conseil:"Toi au travail, sourire, lumière naturelle"},s:["Astuce du jour sur ma routine","Sondage : compléments ou soins topiques ?","Rejoins mon équipe — tape EQUIPE en DM"]},
    {p1:{type:"Preuve Sociale",hook:"Elle était sceptique. Et pourtant...",conseil:"Screenshot témoignage sur fond marque"},p2:{type:"Objection MLM",hook:"'C'est une arnaque' — voilà ce qu'on m'a dit quand j'ai commencé.",conseil:"Toi face caméra, direct, confiant"},s:["Résultat d'une cliente cette semaine","Sondage : tu as déjà essayé des compléments ?","Tu veux ce résultat ? DM-moi"]},
    {p1:{type:"Lifestyle",hook:"Vendredi 14h. Je récupère mon enfant. Pas de permission demandée.",conseil:"Photo extérieure, sourire naturel"},p2:{type:"Cadeau Silhouette",hook:"7 jours de recettes gourmandes — OFFERT.",cta:"SILHOUETTE",conseil:"Carnet ouvert, fond bois clair"},s:["Mon vendredi en images — liberté d'horaires","Carnet silhouette OFFERT ? Réponds à cette story","Recette du vendredi : smoothie détox"]},
    {p1:{type:"Humour Coulisses",hook:"La réalité de travailler en pyjama (c'est pas toujours glamour 😅)",conseil:"Photo candide, café, sourire complice"},p2:{type:"Question Interactive",hook:"Tu préfères les routines courtes ou les rituels complets ?",conseil:"Toi avec tes produits, fond uni"},s:["Coulisses honnêtes — le truc qui a mal tourné","Vote : Routine 5 min ou rituel 20 min ?","Ta routine en DM !"]},
    {p1:{type:"Bilan Semaine",hook:"Cette semaine dans mon équipe : voilà ce qui s'est passé.",conseil:"Flatlay agenda + produits"},p2:{type:"Recrutement Fort",hook:"La nouvelle période commence. Les premières places sont disponibles.",cta:"EQUIPE",conseil:"Toi face caméra, posture confiante"},s:["Mon bilan semaine — chiffres et apprentissages","Victoires de l'équipe cette semaine","Tu veux commencer la semaine prochaine ? DM-moi"]},
  ];

  const getTheme = (dateStr) => {
    const d = new Date(dateStr);
    const base = THEMES[d.getDay()];
    const custom = customThemes[dateStr];
    return {
      ...base,
      p1: {...base.p1, ...(custom?.p1||{})},
      p2: {...base.p2, ...(custom?.p2||{})},
    };
  };

  const genDays = (n=28) => { const r=[]; for(let i=0;i<n;i++){const d=new Date(today);d.setDate(today.getDate()+i);r.push(d.toISOString().slice(0,10));} return r; };
  const copy = (t,id) => { navigator.clipboard?.writeText(t); setCopied(id); setTimeout(()=>setCopied(null),2000); };

  useEffect(()=>{
    (async()=>{
      try{
        const snap = await getDoc(doc(db,"editorial",uid));
        if(snap.exists()){
          const data = snap.data();
          setContenu(data.contenu||{});
          setCustomThemes(data.customThemes||{});
          setSavedDays(data.savedDays||{});
          setHistoire(data.histoire||"");
          setNotesJour(data.notesJour||{});
        }
      }catch{}
    })();
  },[uid]);

  const saveToFirestore = async(newContenu, newCustom, newSaved) => {
    try{
      await setDoc(doc(db,"editorial",uid),{
        contenu: newContenu !== undefined ? newContenu : contenu,
        customThemes: newCustom !== undefined ? newCustom : customThemes,
        savedDays: newSaved !== undefined ? newSaved : savedDays,
        histoire: histoire,
        notesJour: notesJour,
      },{merge:true});
    }catch{}
  };

  const toggleSaved = (dateStr, key) => {
    const newSaved = {...savedDays, [dateStr+key]: !savedDays[dateStr+key]};
    setSavedDays(newSaved);
    saveToFirestore(undefined, undefined, newSaved);
  };

  const updateCustomTheme = (dateStr, postKey, field, value) => {
    const newCustom = {
      ...customThemes,
      [dateStr]: {
        ...(customThemes[dateStr]||{}),
        [postKey]: {
          ...(customThemes[dateStr]?.[postKey]||{}),
          [field]: value
        }
      }
    };
    setCustomThemes(newCustom);
    saveToFirestore(undefined, newCustom, undefined);
  };

  const generer = async(dateStr) => {
    setGenerating(dateStr);
    const th = getTheme(dateStr);
    const d = new Date(dateStr);
    const jn = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"][d.getDay()];
    try{
      const noteDuJour = notesJour[dateStr]||"";
      const prompt = "Tu es experte content marketing pour Melissa, distributrice Mihi France, maman authentique."+(histoire?"\n\nPROFIL & HISTOIRE DE MELISSA :\n"+histoire:"")+(noteDuJour?"\n\nNOTE DU JOUR (priorité) :\n"+noteDuJour:"")+"\nJour: "+jn+" "+d.getDate()+"/"+d.getMonth()+"\nPost1: "+th.p1.type+" - "+th.p1.hook+"\nPost2: "+th.p2.type+" - "+th.p2.hook+(th.p2.cta?" CTA:"+th.p2.cta:"")+"\nStories: "+th.s.join("|")+"\nReponds UNIQUEMENT en JSON valide sans backticks:\n{\"post1\":{\"hooks\":[\"h1\",\"h2\",\"h3\"],\"legende\":\"150 mots avec emojis\",\"hashtags\":\"#tag1 #tag2 etc\"},\"post2\":{\"hooks\":[\"h1\",\"h2\",\"h3\"],\"legende\":\"avec CTA clair\",\"hashtags\":\"#tag1 #tag2 etc\"},\"stories\":[{\"num\":1,\"script\":\"texte\",\"conseil\":\"visuel\"},{\"num\":2,\"script\":\"sondage\",\"conseil\":\"visuel\"},{\"num\":3,\"script\":\"CTA\",\"conseil\":\"visuel\"}]}";
      const resp = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:2000,messages:[{role:"user",content:prompt}]})
      });
      const data = await resp.json();
      const txt = (data.content?.[0]?.text||"{}").replace(/```json|```/g,"").trim();
      const parsed = JSON.parse(txt);
      const newContenu = {...contenu,[dateStr]:parsed};
      setContenu(newContenu);
      saveToFirestore(newContenu, undefined, undefined);
    }catch(e){console.error("Editorial IA:",e);}
    setGenerating(null);
  };

  // Popup bibliothèque d'idées
  const BiblioPopup = ({dateStr, postIdx, onClose}) => {
    const [catActive, setCatActive] = useState(CATEGORIES_IDEES[0].id);
    return(
      <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9999,background:"rgba(61,31,14,.85)"}} onClick={onClose}>
        <div style={{position:"absolute",bottom:0,left:0,right:0,background:"white",borderRadius:"20px 20px 0 0",maxHeight:"80vh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
          <div style={{padding:"1rem 1.2rem .5rem",borderBottom:"1px solid #E8DDD4",flexShrink:0}}>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",color:"#3D1F0E",marginBottom:".5rem"}}>Bibliothèque d'idées <em style={{color:"#C49A8A"}}>Post {postIdx+1}</em></div>
            <div style={{display:"flex",gap:".3rem",overflowX:"auto",paddingBottom:".3rem"}}>
              {CATEGORIES_IDEES.map(cat=>(
                <button key={cat.id} onClick={()=>setCatActive(cat.id)}
                  style={{flexShrink:0,padding:".3rem .65rem",fontSize:".65rem",fontWeight:600,borderRadius:20,border:"1.5px solid "+(catActive===cat.id?cat.color:"#E8DDD4"),background:catActive===cat.id?cat.color:"white",color:catActive===cat.id?"white":"#888",cursor:"pointer",fontFamily:"inherit"}}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{overflowY:"auto",padding:".75rem 1.2rem 1.5rem"}}>
            {(IDEES_POSTS[catActive]||[]).map((idee,i)=>(
              <div key={i} onClick={()=>{
                updateCustomTheme(dateStr, postIdx===0?"p1":"p2", "hook", idee);
                onClose();
              }}
                style={{padding:".65rem .85rem",borderRadius:10,border:"1px solid #E8DDD4",marginBottom:".4rem",cursor:"pointer",fontSize:".78rem",color:"#3D2B1F",lineHeight:1.55,background:"#FAF7F2"}}>
                {idee}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const VUE = () => (
    <div style={{display:"flex",gap:".3rem",marginBottom:"1rem"}}>
      {[["jour","Aujourd'hui"],["semaine","Semaine"],["mois","Mois"]].map(([v,l])=>(
        <button key={v} onClick={()=>setVue(v)}
          style={{flex:1,padding:".4rem",fontSize:".72rem",fontWeight:600,borderRadius:20,border:"1.5px solid "+(vue===v?C.rose:C.pale),background:vue===v?C.rose:"white",color:vue===v?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
          {l}
        </button>
      ))}
    </div>
  );

  const PostBlock = ({th, postKey, postIdx, dateStr, ct}) => {
    const thPost = th[postKey];
    const ctPost = ct?.[postKey==="p1"?"post1":"post2"];
    const isSaved = savedDays[dateStr+"p"+postIdx];
    const [localHook, setLocalHook] = useState(thPost.hook);
    const isEditing = editMode?.dateStr===dateStr && editMode?.postIdx===postIdx;

    return(
      <div style={{background:"white",borderRadius:10,padding:".75rem",marginBottom:".5rem",border:"1.5px solid "+(isSaved?"#7FAF8A":C.pale)}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:".35rem"}}>
          <div>
            <span style={{background:postIdx===0?C.rose:C.brun,color:"white",borderRadius:20,padding:".1rem .45rem",fontSize:".58rem",fontWeight:700,marginRight:".35rem"}}>Post {postIdx+1}</span>
            <span style={{fontSize:".65rem",color:C.gris}}>{thPost.type}</span>
          </div>
          <div style={{display:"flex",gap:".3rem",alignItems:"center"}}>
            <button onClick={()=>setShowIdees({dateStr,postIdx})}
              style={{background:C.creme,border:`1px solid ${C.pale}`,borderRadius:20,padding:".15rem .5rem",fontSize:".6rem",color:C.brun,cursor:"pointer",fontFamily:"inherit"}}>
              💡 Idées
            </button>
            <button onClick={()=>setEditMode(isEditing?null:{dateStr,postIdx})}
              style={{background:isEditing?C.rose:C.creme,border:`1px solid ${isEditing?C.rose:C.pale}`,borderRadius:20,padding:".15rem .5rem",fontSize:".6rem",color:isEditing?"white":C.brun,cursor:"pointer",fontFamily:"inherit"}}>
              ✏️ Modifier
            </button>
            <button onClick={()=>toggleSaved(dateStr,"p"+postIdx)}
              style={{background:isSaved?"#7FAF8A":"none",color:isSaved?"white":C.gris,border:`1px solid ${isSaved?"#7FAF8A":C.pale}`,borderRadius:20,padding:".15rem .45rem",fontSize:".6rem",cursor:"pointer",fontFamily:"inherit"}}>
              {isSaved?"✅":"○"}
            </button>
          </div>
        </div>

        {isEditing ? (
          <div>
            <textarea value={localHook} onChange={e=>setLocalHook(e.target.value)}
              style={{width:"100%",border:`1px solid ${C.rose}`,borderRadius:8,padding:".4rem .55rem",fontSize:".75rem",fontFamily:"inherit",color:C.texte,resize:"none",outline:"none",minHeight:60}}/>
            <button onClick={()=>{
              updateCustomTheme(dateStr, postKey, "hook", localHook);
              setEditMode(null);
            }}
              style={{background:C.brun,color:"white",border:"none",borderRadius:7,padding:".3rem .75rem",fontSize:".68rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginTop:".3rem"}}>
              Sauvegarder
            </button>
          </div>
        ) : (
          <div style={{fontSize:".78rem",color:C.texte,lineHeight:1.6,fontStyle:"italic",marginBottom:".3rem"}}>"{thPost.hook}"</div>
        )}

        {thPost.cta&&<div style={{background:C.brun+"15",borderRadius:6,padding:".2rem .5rem",fontSize:".65rem",color:C.brun,fontWeight:600,marginBottom:".3rem"}}>CTA : {thPost.cta}</div>}
        {thPost.conseil&&<div style={{background:"#FFF8E1",borderRadius:6,padding:".2rem .5rem",fontSize:".63rem",color:"#856404"}}>📸 {thPost.conseil}</div>}

        {ctPost&&<div style={{marginTop:".5rem"}}>
          {(ctPost.hooks||[]).map((h,i)=>(
            <div key={i} style={{display:"flex",gap:".4rem",background:C.creme,borderRadius:7,padding:".3rem .5rem",marginBottom:".2rem"}}>
              <span style={{fontSize:".7rem",flex:1,fontStyle:"italic"}}>{h}</span>
              <button onClick={()=>copy(h,"h"+postIdx+i+dateStr)} style={{background:copied==="h"+postIdx+i+dateStr?C.vert:C.brun,color:"white",border:"none",borderRadius:5,padding:".15rem .4rem",fontSize:".6rem",cursor:"pointer",flexShrink:0}}>{copied==="h"+postIdx+i+dateStr?"✓":"📋"}</button>
            </div>
          ))}
          {ctPost.legende&&<div style={{marginTop:".3rem"}}><div style={{background:C.creme,borderRadius:7,padding:".4rem .55rem",fontSize:".7rem",lineHeight:1.6,marginBottom:".2rem"}}>{ctPost.legende}</div><button onClick={()=>copy(ctPost.legende,"l"+postIdx+dateStr)} style={{background:copied==="l"+postIdx+dateStr?C.vert:C.brun,color:"white",border:"none",borderRadius:7,padding:".25rem .55rem",fontSize:".63rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>{copied==="l"+postIdx+dateStr?"✅ Copié":"📋 Copier légende"}</button></div>}
        </div>}
      </div>
    );
  };

  const JourCard = ({dateStr, expanded=false}) => {
    const th = getTheme(dateStr);
    const d = new Date(dateStr);
    const isT = dateStr===todayStr;
    const isOpen = expanded || jourOuvert===dateStr;
    const ct = contenu[dateStr];
    const isGen = generating===dateStr;
    const nbFait = [0,1].filter(i=>savedDays[dateStr+"p"+i]).length + [0,1,2].filter(i=>savedDays[dateStr+"s"+i]).length;

    return(
      <div style={{background:C.blanc,border:"1.5px solid "+(isT?C.rose:C.pale),borderRadius:12,marginBottom:".6rem",overflow:"hidden"}}>
        <div onClick={()=>!expanded&&setJourOuvert(isOpen?null:dateStr)}
          style={{padding:".75rem 1rem",cursor:expanded?"default":"pointer",display:"flex",alignItems:"center",gap:".75rem"}}>
          <div style={{width:46,height:46,borderRadius:10,background:isT?C.rose:C.creme,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <div style={{fontSize:".58rem",fontWeight:700,color:isT?"white":C.gris}}>{JOURS[d.getDay()]}</div>
            <div style={{fontSize:"1.1rem",fontWeight:700,color:isT?"white":C.brun}}>{d.getDate()}</div>
            <div style={{fontSize:".52rem",color:isT?"rgba(255,255,255,.7)":C.gris}}>{MOIS[d.getMonth()]}</div>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",gap:".3rem",marginBottom:".2rem",flexWrap:"wrap"}}>
              <span style={{background:C.rose+"20",color:C.rose,borderRadius:20,padding:".1rem .4rem",fontSize:".58rem",fontWeight:700}}>{th.p1.type}</span>
              <span style={{background:C.brun+"15",color:C.brun,borderRadius:20,padding:".1rem .4rem",fontSize:".58rem",fontWeight:700}}>{th.p2.type}</span>
              {ct&&<span style={{background:C.vert+"20",color:C.vert,borderRadius:20,padding:".1rem .4rem",fontSize:".58rem",fontWeight:700}}>✅ IA</span>}
            </div>
            <div style={{height:4,background:C.pale,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",background:nbFait>0?C.rose:C.pale,width:(nbFait/5*100)+"%",transition:"width .3s"}}/></div>
          </div>
          {!expanded&&<span style={{color:C.gris,fontSize:".75rem",transform:isOpen?"rotate(90deg)":"none",transition:"transform .2s"}}>›</span>}
        </div>

        {isOpen&&<div style={{padding:"0 1rem 1rem",borderTop:"1px solid "+C.pale}}>
          {/* Note du jour */}
          <div style={{marginBottom:".65rem"}}>
            <div style={{fontSize:".6rem",fontWeight:700,color:C.gris,textTransform:"uppercase",letterSpacing:".08em",marginBottom:".25rem"}}>💡 Note pour l'IA aujourd'hui</div>
            <textarea value={notesJour[dateStr]||""} onChange={e=>{const n={...notesJour,[dateStr]:e.target.value};setNotesJour(n);saveToFirestore(undefined,undefined,undefined);}} rows={2}
              placeholder="Ex: Je veux parler de la rentrée, de mon retour après les vacances, ou d'un produit spécifique..."
              style={{width:"100%",border:"1px solid "+C.pale,borderRadius:8,padding:".45rem .65rem",fontSize:".72rem",fontFamily:"inherit",color:C.texte,resize:"none",outline:"none",background:C.creme}}/>
          </div>
          <button onClick={()=>generer(dateStr)} disabled={!!generating}
            style={{width:"100%",background:isGen?C.pale:C.brun,color:isGen?C.gris:"white",border:"none",borderRadius:10,padding:".6rem",fontSize:".78rem",fontWeight:700,fontFamily:"inherit",cursor:isGen?"wait":"pointer",margin:".65rem 0",display:"flex",alignItems:"center",justifyContent:"center",gap:".5rem"}}>
            {isGen?<>⏳ Génération...</>:<>✨ {ct?"Regénérer le contenu IA":"Générer le contenu IA"}</>}
          </button>

          <PostBlock th={th} postKey="p1" postIdx={0} dateStr={dateStr} ct={ct}/>
          <PostBlock th={th} postKey="p2" postIdx={1} dateStr={dateStr} ct={ct}/>

          <div style={{background:C.creme,borderRadius:10,padding:".75rem",border:"1px solid "+C.pale}}>
            <div style={{fontSize:".6rem",fontWeight:700,color:C.or,textTransform:"uppercase",marginBottom:".35rem"}}>📱 3 Stories</div>
            {th.s.map((s,i)=>(
              <div key={i} style={{display:"flex",gap:".5rem",alignItems:"flex-start",padding:".3rem 0",borderBottom:i<2?"1px solid "+C.creme:"none"}}>
                <div style={{width:20,height:20,borderRadius:"50%",background:C.or+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".62rem",fontWeight:700,color:C.or,flexShrink:0}}>{i+1}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:".72rem",color:C.texte}}>{s}</div>
                  {ct?.stories?.[i]&&<div style={{fontSize:".68rem",color:C.lilas,marginTop:".1rem",fontStyle:"italic"}}>{ct.stories[i].script}</div>}
                </div>
                <button onClick={()=>toggleSaved(dateStr,"s"+i)}
                  style={{background:savedDays[dateStr+"s"+i]?"#7FAF8A":"none",color:savedDays[dateStr+"s"+i]?"white":C.gris,border:"1px solid "+(savedDays[dateStr+"s"+i]?"#7FAF8A":C.pale),borderRadius:20,padding:".1rem .4rem",fontSize:".58rem",cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                  {savedDays[dateStr+"s"+i]?"✅":"○"}
                </button>
              </div>
            ))}
          </div>
        </div>}
      </div>
    );
  };

  const days = genDays(28);

  return(
    <div id="decouverte-calendrier" style={{paddingBottom:"2rem"}}>
      {showIdees&&<BiblioPopup dateStr={showIdees.dateStr} postIdx={showIdees.postIdx} onClose={()=>setShowIdees(null)}/>}

      <div id="decouverte-profil-ia" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun}}>Éditorial <em style={{color:C.rose}}>IA</em></div>
        <button onClick={()=>setShowDecouverte(true)} style={{background:"#C49A8A",color:"white",border:"none",borderRadius:20,padding:".35rem .85rem",fontSize:".72rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer",marginRight:".4rem"}}>🧭 Découverte</button><button onClick={()=>setShowHistoire(true)} style={{background:C.rose,color:"white",border:"none",borderRadius:20,padding:".35rem .85rem",fontSize:".72rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>✨ Mon profil IA</button>
      </div>

      {showDecouverte&&<DecouverteTour outil="editorial" onClose={()=>setShowDecouverte(false)}/>}
      {showHistoire&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9999,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{background:"white",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,padding:"1.5rem",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,color:C.brun,marginBottom:".5rem"}}>✨ Mon profil pour l'IA</div>
            <div style={{fontSize:".72rem",color:C.gris,marginBottom:"1rem",lineHeight:1.6}}>
              Décris-toi : qui tu es, pourquoi Mihi, ton style de communication, tes valeurs, ta cible... L'IA s'en inspirera pour tous tes contenus.
            </div>
            <textarea value={histoire} onChange={e=>{setHistoire(e.target.value);}} rows={8}
              placeholder="Ex: Je suis Melissa, maman de 5 enfants, distributrice Mihi depuis 2 ans. J'ai rejoint Mihi pour la liberté financière et l'épanouissement. Mon style est authentique, bienveillant et direct. Ma cible : les mamans qui veulent se sentir belles et libres..."
              style={{flex:1,border:"1px solid "+C.pale,borderRadius:10,padding:".75rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,resize:"none",outline:"none",marginBottom:"1rem"}}/>
            <div style={{display:"flex",gap:".5rem"}}>
              <button onClick={async()=>{await saveToFirestore(undefined,undefined,undefined);setShowHistoire(false);}} style={{flex:1,background:C.brun,color:"white",border:"none",borderRadius:10,padding:".65rem",fontSize:".82rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>✓ Enregistrer</button>
              <button onClick={()=>setShowHistoire(false)} style={{background:"none",border:"1px solid "+C.pale,borderRadius:10,padding:".65rem .85rem",fontSize:".78rem",cursor:"pointer",fontFamily:"inherit",color:C.gris}}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      <VUE/>

      {vue==="mois"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:".2rem",marginBottom:".3rem"}}>
            {JOURS.map(j=><div key={j} style={{textAlign:"center",fontSize:".58rem",fontWeight:700,color:C.gris}}>{j}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:".2rem"}}>
            {days.map(dateStr=>{
              const d=new Date(dateStr);const isT=dateStr===todayStr;const has=!!contenu[dateStr];
              return(<div key={dateStr} onClick={()=>{setJourOuvert(dateStr);setVue("semaine");}}
                style={{background:isT?C.rose:has?"#E8F5E9":"white",border:"1px solid "+(isT?C.rose:C.pale),borderRadius:7,padding:".3rem .2rem",cursor:"pointer",textAlign:"center",minHeight:44}}>
                <div style={{fontSize:".72rem",fontWeight:700,color:isT?"white":C.brun}}>{d.getDate()}</div>
                {has&&!isT&&<div style={{fontSize:".5rem",color:C.vert}}>✅</div>}
              </div>);
            })}
          </div>
        </div>
      )}

      {vue==="semaine"&&[0,1,2,3].map(si=>{
        const sem=days.slice(si*7,(si+1)*7);
        return(<div key={si} style={{marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,color:C.brun,textTransform:"uppercase",marginBottom:".4rem",letterSpacing:".1em"}}>Semaine {si+1}</div>
          {sem.map(d=><JourCard key={d} dateStr={d}/>)}
        </div>);
      })}

      {vue==="jour"&&<JourCard dateStr={todayStr} expanded={true}/>}
    </div>
  );
}


export { EditorialTab };
