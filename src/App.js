import { useState, useCallback, useEffect, createContext, useContext } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// ── FIREBASE ──────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBhsxeZe7JvliHh3kBRgRKSKA2XSiAUg9k",
  authDomain: "blazing-dinasty-1fad9.firebaseapp.com",
  projectId: "blazing-dinasty-1fad9",
  storageBucket: "blazing-dinasty-1fad9.firebasestorage.app",
  messagingSenderId: "499869328828",
  appId: "1:499869328828:web:28900482512a07ca3a77b9",
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
let messaging = null;
try { messaging = getMessaging(fbApp); } catch {}

async function saveFCMToken(uid) {
  if (!messaging) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    const token = await getToken(messaging, {
      vapidKey: "BFI7Uodh64p0EnejAc9xQ6y0hOS0w4CVA2QO-3mCxFmcm13orUtX7mYDwSRuaS8iDs8ovcClbKj2j2JzMi47sRE"
    });
    if (token) {
      await setDoc(doc(db, "fcm_tokens", uid), { token, uid, updatedAt: Date.now() });
    }
  } catch {}
}

// ── STORAGE (Firebase Firestore) ──────────────────────────────────────────────
async function sg(uid, k) {
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return data[k] !== undefined ? data[k] : null;
    }
    return null;
  } catch { return null; }
}

async function ss(uid, k, v) {
  try {
    const ref = doc(db, "users", uid);
    await setDoc(ref, { [k]: v }, { merge: true });
  } catch {}
}

// Charge toutes les données d'un utilisateur en une seule requête
async function sgAll(uid) {
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : {};
  } catch { return {}; }
}

// Met à jour la fiche d'un membre dans l'annuaire global (équipe/annuaire)
async function syncAnnuaire(uid, displayName, objPerso, marraineUid){
  try{
    const ref = doc(db,"equipe","annuaire");
    const [prenom, ...rest] = (displayName||"").split(" ");
    const entry = {
      uid,
      prenom: prenom||"",
      nom: rest.join(" ")||"",
      palier: objPerso?.palier||"2%",
      ca: objPerso?.ca||"",
      caObj: objPerso?.caObj||"",
      recruesReal: objPerso?.recruesReal||"0",
      recruesObj: objPerso?.recruesObj||"0",
      lastActive: Date.now(),
    };
    const snap = await getDoc(ref);
    const existing = snap.exists() && snap.data().membres ? snap.data().membres : {};
    entry.dateEnreg = existing[uid]?.dateEnreg || new Date().toISOString().slice(0,10);
    if(existing[uid]?.notes) entry.notes = existing[uid].notes;
    // Marraine : utilise la nouvelle valeur si fournie, sinon conserve l'existante
    if(marraineUid) entry.marraine = marraineUid;
    else if(existing[uid]?.marraine) entry.marraine = existing[uid].marraine;
    await setDoc(ref, {membres: {...existing, [uid]: entry}}, {merge:true});
  }catch{}
}


// Construit récursivement l'arbre des filleules (recrues directes et indirectes) d'un membre
function buildEquipeTree(annuaire, uid){
  const enfants = Object.values(annuaire).filter(m=>m.marraine===uid);
  return enfants.map(m=>({
    ...m,
    enfants: buildEquipeTree(annuaire, m.uid),
  }));
}

// Compte récursivement le nombre total de personnes dans une équipe (sous-arbre)
function countEquipe(node){
  return (node.enfants||[]).reduce((sum,e)=>sum+1+countEquipe(e), 0);
}

// Compte toute la descendance d'un uid dans l'annuaire, avec protection anti-cycle
function countEquipeSafe(annuaire, rootUid){
  const visited=new Set([rootUid]);
  const queue=[rootUid];
  while(queue.length){
    const current=queue.pop();
    Object.values(annuaire).forEach(m=>{
      if(m.marraine===current && !visited.has(m.uid)){
        visited.add(m.uid);
        queue.push(m.uid);
      }
    });
  }
  return visited.size-1;
}


async function seedAnnuaireFromMembres(){
  try{
    const accSnap = await getDoc(doc(db,"acces","membres"));
    const liste = accSnap.exists() ? accSnap.data().liste||[] : [];
    const ref = doc(db,"equipe","annuaire");
    const annSnap = await getDoc(ref);
    const existing = annSnap.exists() && annSnap.data().membres ? annSnap.data().membres : {};
    const next = {...existing};
    let added = 0;
    for(const fullName of liste){
      const uid = fullName.trim().toLowerCase().replace(/\s+/g,"-");
      if(next[uid]) continue;
      const parts = fullName.trim().split(/\s+/);
      const prenom = parts[0]||"";
      const nom = parts.slice(1).join(" ")||"";
      // Charger les objectifs existants de cette personne si dispo
      let objPerso = null;
      try{
        const userSnap = await getDoc(doc(db,"users",uid));
        if(userSnap.exists()&&userSnap.data()["db-obj-perso"]) objPerso = JSON.parse(userSnap.data()["db-obj-perso"]);
      }catch{}
      next[uid] = {
        uid,
        prenom: prenom.charAt(0).toUpperCase()+prenom.slice(1),
        nom: nom.split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" "),
        palier: objPerso?.palier||"2%",
        ca: objPerso?.ca||"",
        caObj: objPerso?.caObj||"",
        recruesReal: objPerso?.recruesReal||"0",
        recruesObj: objPerso?.recruesObj||"0",
        dateEnreg: new Date().toISOString().slice(0,10),
        lastActive: 0,
      };
      added++;
    }
    await setDoc(ref, {membres: next}, {merge:true});
    return added;
  }catch{ return 0; }
}


// Champ de sélection avec recherche/autocomplete (pour choisir une marraine dans une longue liste)
function SearchSelect({value, onChange, options, placeholder, compact}){
  const[query,setQuery]=useState("");
  const[open,setOpen]=useState(false);

  const fmt=(m)=>m.split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");

  const filtered = options.filter(m=>fmt(m).toLowerCase().includes(query.toLowerCase()));

  return(
    <div style={{position:"relative",marginBottom:compact?0:"1rem"}}>
      <input
        value={value?fmt(value):query}
        onChange={e=>{setQuery(e.target.value);onChange("");setOpen(true);}}
        onFocus={()=>setOpen(true)}
        placeholder={placeholder}
        style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:compact?8:10,padding:compact?".35rem .6rem":".6rem .9rem",fontSize:compact?".72rem":".85rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
      {open&&filtered.length>0&&(
        <div style={{position:"absolute",top:"100%",left:0,right:0,background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:10,marginTop:".25rem",maxHeight:180,overflowY:"auto",zIndex:20,boxShadow:"0 4px 12px rgba(0,0,0,.08)"}}>
          {filtered.slice(0,30).map(m=>(
            <div key={m} onClick={()=>{onChange(m);setQuery("");setOpen(false);}}
              style={{padding:".5rem .8rem",fontSize:".8rem",color:C.texte,cursor:"pointer",borderBottom:`1px solid ${C.creme}`}}
              onMouseDown={e=>e.preventDefault()}>
              {fmt(m)}
            </div>
          ))}
        </div>
      )}
      {open&&(
        <div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:10}}/>
      )}
    </div>
  );
}


// ── PALETTE ───────────────────────────────────────────────────────────────────
const C={brun:"#3D1F0E",brun2:"#5C3020",rose:"#C49A8A",pale:"#E8D5CC",lilas:"#A89BB5",or:"#C4A882",creme:"#F7F2EE",blanc:"#FDFAF7",texte:"#2E1F17",gris:"#8A7A74",vert:"#7FAF8A"};

// ── TRADUCTION À LA VOLÉE (FR ↔ PT) ──────────────────────────────────────────
const LangContext = createContext({ lang: "fr" });

const translationMemCache = {};

async function translateText(text, targetLang){
  if(!text || !text.trim()) return text;
  if(targetLang==="fr") return text;

  const cacheKey = targetLang+"::"+text;
  if(translationMemCache[cacheKey]) return translationMemCache[cacheKey];

  try{
    const docId = btoa(unescape(encodeURIComponent(cacheKey))).replace(/[\/+=]/g,"_").slice(0,500);
    const ref = doc(db,"traductions",docId);
    const snap = await getDoc(ref);
    if(snap.exists() && snap.data().translated){
      translationMemCache[cacheKey] = snap.data().translated;
      return snap.data().translated;
    }
  } catch {}

  try{
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "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",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        messages: [{ role: "user", content: `Traduis ce texte du français vers le portugais (portugais du Portugal). Réponds UNIQUEMENT avec la traduction, sans aucun commentaire, sans guillemets, sans markdown:\n\n${text}` }]
      })
    });
    const data = await response.json();
    if(data.error) return text;
    const translated = (data.content?.map(i=>i.text||"").join("")||"").trim();
    if(!translated) return text;

    translationMemCache[cacheKey] = translated;
    try{
      const docId = btoa(unescape(encodeURIComponent(cacheKey))).replace(/[\/+=]/g,"_").slice(0,500);
      await setDoc(doc(db,"traductions",docId),{original:text,translated,lang:targetLang});
    } catch {}

    return translated;
  } catch {
    return text;
  }
}

function T({children}){
  const ctx = useContext(LangContext);
  const lang = ctx.lang;
  const [display, setDisplay] = useState(children);

  useEffect(()=>{
    if(lang==="fr"){ setDisplay(children); return; }
    let cancelled=false;
    translateText(children, lang).then(t=>{ if(!cancelled) setDisplay(t); });
    return ()=>{ cancelled=true; };
  },[lang, children]);

  return display;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function Btn({href,label,color=C.brun,icon="🔗"}){
  return <a href={href} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:".55rem",background:color,borderRadius:9,padding:".6rem .9rem",textDecoration:"none",marginBottom:".45rem"}}>
    <span style={{fontSize:".85rem",flexShrink:0}}>{icon}</span>
    <span style={{fontSize:".75rem",fontWeight:600,color:C.blanc,lineHeight:1.3}}>{label}</span>
    <span style={{marginLeft:"auto",color:C.pale,fontSize:".65rem",opacity:.7,flexShrink:0}}>→</span>
  </a>;
}
function YTBtn({href,label}){return <Btn href={href} label={label} color="#8B1A1A" icon="▶"/>;}
function DriveBtn({href,label}){return <Btn href={href} label={label} color={C.brun2} icon="📄"/>;}
function DocBtn({href,label}){return <Btn href={href} label={label} color="#1a4a8b" icon="📝"/>;}

function Card({title,sub,icon,color=C.rose,children,defaultOpen=false}){
  const[open,setOpen]=useState(defaultOpen);
  return <div style={{background:C.blanc,border:`1px solid ${open?color:C.pale}`,borderRadius:14,marginBottom:".75rem",overflow:"hidden",transition:"border-color .2s"}}>
    <div onClick={()=>setOpen(p=>!p)} style={{padding:".82rem 1rem",display:"flex",alignItems:"center",gap:".6rem",cursor:"pointer",userSelect:"none"}}>
      <div style={{width:32,height:32,borderRadius:"50%",background:color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".9rem",flexShrink:0}}>{icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:"Georgia,serif",fontSize:".92rem",fontWeight:600,color:C.brun,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</div>
        {sub&&<div style={{fontSize:".62rem",color:C.gris,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sub}</div>}
      </div>
      <div style={{color:C.rose,fontSize:".68rem",transform:open?"rotate(180deg)":"none",transition:"transform .2s",flexShrink:0}}>▼</div>
    </div>
    {open&&<div style={{borderTop:`1px solid ${C.pale}`,padding:".85rem 1rem 1rem"}}>{children}</div>}
  </div>;
}

function Info({children,color=C.rose}){
  return <div style={{background:color+"15",border:`1px solid ${color}40`,borderRadius:9,padding:".7rem .9rem",fontSize:".75rem",color:C.texte,lineHeight:1.65,marginBottom:".75rem"}}>{children}</div>;
}

function Tag({label,bg,col}){
  return <span style={{background:bg,color:col,fontSize:".52rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",padding:".13rem .42rem",borderRadius:20,flexShrink:0,display:"inline-block"}}>{label}</span>;
}

function SecTitle({title,em,desc}){
  return <>
    <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
      <T>{title}</T> <em style={{fontStyle:"italic",color:C.rose}}><T>{em}</T></em>
    </div>
    {desc&&<p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}><T>{desc}</T></p>}
  </>;
}

function CopyBtn({text}){
  const[c,setC]=useState(false);
  return <button onClick={()=>{navigator.clipboard.writeText(text);setC(true);setTimeout(()=>setC(false),2000);}}
    style={{fontSize:".55rem",padding:".15rem .45rem",border:`1px solid ${c?C.vert:C.pale}`,borderRadius:5,background:"none",color:c?C.vert:C.gris,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>{c?"✓":"Copier"}</button>;
}

// ── POST IDEAS DATA ───────────────────────────────────────────────────────────
const POST_IDEAS = [
  {theme:"💄 Make-up & Beauté", color:C.rose, posts:[
    {id:"p1",hook:"On m'a encore demandé \"c'est quoi ton parfum ?\"",caption:"Plot twist → moins de 20€ et on me fait des compliments NON-STOP. Tu veux savoir lequel ? Écris PARFUM en commentaire 😏"},
    {id:"p2",hook:"Makeup du jour : rapide, naturel, pas besoin de 15 produits",caption:"J'utilise une mini routine makeup que je recommande souvent aux mamans pressées. Tu veux la liste des produits exacts ? Commente MAKEUP 💄"},
    {id:"p3",hook:"Toi aussi tu adores les rouges à lèvres pigmentés qui tiennent longtemps ?",caption:"Alors je pense que comme moi tu vas adorer ces petites pépites !! Tape PÉPITES je te réserve une belle surprise ❤️"},
    {id:"p4",hook:"⏰ 5 minutes. C'est le temps que je mets pour ma routine (vraiment).",caption:"Skincare + touche de makeup + parfum. Tu veux ma routine express et les produits exacts ? Écris 5MIN 💕"},
    {id:"p5",hook:"Makeup qui tient toute la journée même avec un masque ?",caption:"Oui ça existe 😂 Je vous montre ma technique en story ce soir. Restez connectées 👀"},
  ]},
  {theme:"🌿 Skincare & Soin", color:C.lilas, posts:[
    {id:"p6",hook:"💭 On parle souvent de skincare hors de prix… J'ai une routine visage SIMPLE à moins de 25€",caption:"Rien de compliqué. Rien de gadget. Juste ce qu'il faut pour une peau propre, nette et confortable. Tu veux la liste exacte ? Dis-le moi en commentaire 👇"},
    {id:"p7",hook:"On pense souvent que pour que ça marche… il faut que ce soit cher. Faux.",caption:"J'utilise des produits beaucoup plus accessibles et les résultats sont là. Tu veux voir ce que j'utilise vraiment ? Écris LISTE en commentaire."},
    {id:"p8",hook:"Prendre soin de soi ≠ se ruiner.",caption:"J'ai construit une routine complète soin + bien-être, accessible et rapide. Tu veux la liste détaillée ? Dis MOI 👇"},
    {id:"p9",hook:"Le problème ce n'est pas toi. C'est juste que ta peau n'a pas la bonne routine.",caption:"Même peau, même personne. La seule différence ? Une routine adaptée à 25€. Résultat : teint unifié, peau hydratée. Tu veux la routine ? Écris ROUTINE 👇"},
  ]},
  {theme:"💆 Bien-être & Énergie", color:C.or, posts:[
    {id:"p10",hook:"Non, je ne prends pas 12 compléments par jour.",caption:"J'ai une routine ultra simple pour l'énergie, le bien-être, me sentir mieux au quotidien. Tu veux savoir ce que je prends exactement ? Écris ROUTINE en commentaire."},
    {id:"p11",hook:"Tu te lèves fatiguée même après 8h de sommeil ?",caption:"J'étais pareille. Un truc m'a changé la vie et c'est pas du café 😂 Écris ÉNERGIE je t'explique tout 👇"},
    {id:"p12",hook:"Ventre gonflé, digestion difficile, fatigue chronique…",caption:"C'est pas une fatalité. J'ai trouvé une solution naturelle et ça m'a transformée. Qui veut en savoir plus ? 👋"},
  ]},
  {theme:"💰 Opportunité & Liberté", color:C.brun, posts:[
    {id:"p13",hook:"Je ne cherchais pas un 2ème emploi. Je cherchais quelque chose qui s'adapte à ma vie.",caption:"Aujourd'hui je travaille depuis mon canapé pendant que mes enfants dorment. Et je ne l'ai jamais regretté. Tu veux savoir comment ? Écris LIBERTÉ en commentaire 🖤"},
    {id:"p14",hook:"Mardi 15h. Je récupère mon enfant à l'école.",caption:"Pas de congés posés. Pas de permission demandée. Juste... ma vie. C'est ça que j'ai construit avec Blazing Dynasty 🖤"},
    {id:"p15",hook:"Belle journée qui commence ☀️ Appel équipe dans 1h.",caption:"J'adore ce que je fais parce que ça me ressemble. Tu es curieuse de savoir comment ? Réponds à ce message 🙂"},
    {id:"p16",hook:"La semaine a été productive 🖤",caption:"Je vous explique bientôt ce qu'il se passe dans les coulisses... Restez connectées 👀"},
    {id:"p17",hook:"On m'a demandé aujourd'hui combien je gagnais avec \"ça\".",caption:"J'ai répondu : assez pour ne plus avoir à demander de congés. Qui veut en savoir plus ? Écris ÉQUIPE en commentaire 🔥"},
  ]},
  {theme:"🌸 Storytelling & Vie perso", color:C.rose, posts:[
    {id:"p18",hook:"Il y a [X mois], j'ai pris une décision qui m'a fait peur.",caption:"Aujourd'hui je ne l'ai pas regrettée une seule fois. [Continue ton histoire authentiquement. Partage tes doutes, ta décision, où tu en es aujourd'hui.]"},
    {id:"p19",hook:"Ce que personne ne voit derrière mes posts.",caption:"Les galères, les doutes, les jours où j'avais envie d'arrêter. Je vous raconte tout parce que vous méritez la vérité, pas juste les moments parfaits."},
    {id:"p20",hook:"J'aurais aimé que quelqu'un me dise ça quand j'ai commencé.",caption:"[Partage un conseil clé que tu aurais aimé avoir. Ton expérience terrain est ton meilleur contenu.]"},
  ]},
  {theme:"🔑 Recrutement détourné", color:C.lilas, posts:[
    {id:"p21",hook:"Tu cherches un complément de revenu sans sacrifier ta famille ?",caption:"Je construis une équipe de femmes ambitieuses. Pas de stock, pas de porte-à-porte. Juste du sérieux et une vraie méthode. Écris ÉQUIPE si tu veux en savoir plus 🖤"},
    {id:"p22",hook:"3 choses que j'aurais voulu savoir avant de commencer.",caption:"1. C'est du vrai travail. 2. Ça vaut vraiment le coup. 3. Tu n'es pas seule. C'est ça Blazing Dynasty. Curiosité ? Réponds à ce message 🙂"},
    {id:"p23",hook:"Ce mois-ci j'ai gagné [montant] en travaillant depuis chez moi.",caption:"Sans boss. Sans horaires fixes. Sans sacrifier ma famille. Si tu veux comprendre comment — écris MOI en commentaire."},
  ]},
  {theme:"✨ Face Architect", color:"#9B7FA8", posts:[
    {id:"p24",hook:"Mes rides ont l'air de disparaître... et non c'est pas du filtre 😮",caption:"Le sérum que j'utilise fait vraiment la différence. C'est la gamme Face Architect de Mihi. Tu veux que je t'explique comment ça marche ? Commente VISAGE 👇"},
    {id:"p25",hook:"47 ans et on me donne 35. Mon secret en 3 produits.",caption:"Crème ExoLifting + sérum Spicule + soin contour des yeux. Moins de 80€ les 3. Tu veux les détails ? Écris ANTIAGE en commentaire ✨"},
  ]},
  {theme:"💇 Hair Architect", color:C.or, posts:[
    {id:"p26",hook:"Tes cheveux font la tête ? Secs, cassants ou carrément ternes ?",caption:"Et si je te disais qu'avec seulement 25€, tu peux leur redonner vie et brillance comme en sortant de chez le coiffeur ? Commente CHEVEUX en dessous ! 👇"},
    {id:"p27",hook:"J'ai arrêté de dépenser une fortune chez le coiffeur.",caption:"J'ai trouvé une routine capillaire qui coûte moins de 30€ et mes cheveux n'ont jamais été aussi beaux. Tu veux le nom des produits ? Écris CHEVEUX 💛"},
  ]},
];

// ── SPRINT DATA ───────────────────────────────────────────────────────────────
const SPRINT=[
  {day:1,title:"Préparer le terrain",goal:"Profil optimisé + liste des 20",focus:"rs",tasks:[
    {id:"s1a",label:"Optimiser ta bio (photo + description + lien)"},
    {id:"s1b",label:"Poster une story d'énergie — pas de pitch"},
    {id:"s1c",label:"Écrire et classer ta liste des 20 contacts"},
    {id:"s1d",label:"Liker 10 publications de ta cible",script:'"Cette semaine je me fixe un défi. Je vous tiens au courant 🔥"'},
  ]},
  {day:2,title:"Premiers contacts chauds",goal:"3 messages + 1 conversation",focus:"bao",tasks:[
    {id:"s2a",label:'3 messages WhatsApp personnels aux contacts "Chauds"',script:'"Coucou [Prénom], je pense à toi. Je développe quelque chose qui te correspondrait peut-être. 3 min à regarder ? 🙂"'},
    {id:"s2b",label:"Story vie quotidienne sans pitch"},
    {id:"s2c",label:"Répondre à toutes les réactions en DM"},
  ]},
  {day:3,title:"Contenu d'attraction",goal:"1 Reel publié + réponses mot-clé",focus:"rs",tasks:[
    {id:"s3a",label:"Créer et publier un Reel avec CTA mot-clé",script:'"Je ne cherchais pas un 2ᵉ emploi. Je cherchais quelque chose qui s\'adapte à ma vie. Écris ÉQUIPE en commentaire 🖤"'},
    {id:"s3b",label:"DM à chaque personne qui répond avec le mot-clé"},
    {id:"s3c",label:'Relancer 1–2 personnes sans réponse hier',script:'"Coucou ! Pas de souci si tu es occupée — je te laisse regarder quand t\'as 5 min 🙂"'},
  ]},
  {day:4,title:"Présenter l'opportunité",goal:"1 présentation + 5 contacts relancés",focus:"mix",tasks:[
    {id:"s4a",label:"Faire 1 présentation complète (15–30 min)",script:'"J\'ai commencé parce que j\'avais besoin de quelque chose qui s\'adapte à ma vie. Ce n\'est pas un schéma miracle — c\'est du travail qui a du sens."'},
    {id:"s4b",label:"3 nouveaux messages aux contacts Tièdes"},
    {id:"s4c",label:'Story "résultat flou" — sans tout dévoiler'},
  ]},
  {day:5,title:"Amplifier la portée",goal:"2 recommandations + 1 témoignage",focus:"mix",tasks:[
    {id:"s5a",label:"Demander à 2–3 amies de partager ta publication"},
    {id:"s5b",label:'À celles qui ont décliné : "Tu connais quelqu\'un ?"',script:'"Pas de souci ! Est-ce que tu aurais quelqu\'un dans ton entourage qui cherche un revenu complémentaire ? 🙂"'},
    {id:"s5c",label:"Post témoignage produit authentique"},
  ]},
  {day:6,title:"Café ou Zoom découverte",goal:"Événement réalisé + suivi envoyé",focus:"bao",tasks:[
    {id:"s6a",label:"Organiser un café ou Zoom 30–45 min avec 3–5 personnes"},
    {id:"s6b",label:"Présenter ton histoire + les 3 façons d'entrer"},
    {id:"s6c",label:"Suivi individuel à chaque participante dans les 2h",script:'"Merci d\'avoir pris le temps ce soir 🧡 Je suis là si tu as des questions. Pas de pression."'},
  ]},
  {day:7,title:"Bilan & relances",goal:"Bilan chiffré + plan semaine 2",focus:"mix",tasks:[
    {id:"s7a",label:"Compter : contacts · réponses · présentations · recrues"},
    {id:"s7b",label:'Relancer les personnes "en réflexion"',script:'"Coucou ! Je voulais prendre des nouvelles 🙂 Pas de pression — je suis là si tu veux avancer."'},
    {id:"s7c",label:"Story de bilan + planifier la semaine 2"},
  ]},
];

// ── CITATIONS DU JOUR ─────────────────────────────────────────────────────────
const CITATIONS_DEFAULT=[
  "Le succès, c'est tomber 7 fois et se relever 8.",
  "Chaque jour est une nouvelle chance de changer ta vie.",
  "La discipline, c'est se rappeler ce que tu veux vraiment.",
  "Tu n'as pas besoin d'être parfaite, juste constante.",
  "Le doute tue plus de rêves que l'échec jamais ne le fera.",
  "Petit pas par petit pas, on construit de grandes choses.",
  "Ton énergie d'aujourd'hui dessine ton avenir de demain.",
  "Crois en toi, même quand personne d'autre ne le fait.",
  "La motivation te lance. L'habitude te fait tenir.",
  "Tu es plus forte que ce que tu penses.",
  "Le meilleur moment pour commencer, c'était hier. Le 2ème, c'est maintenant.",
  "Chaque 'non' te rapproche d'un 'oui'.",
  "La constance bat le talent quand le talent ne travaille pas.",
  "Sois fière de chaque petit progrès — c'est ainsi que naissent les grands changements.",
  "Ton futur toi te remerciera pour les efforts d'aujourd'hui.",
  "Les femmes fortes lèvent les autres femmes en se levant elles-mêmes.",
  "Ce n'est pas le temps qui manque, c'est la décision qui compte.",
  "Une graine plantée chaque jour devient une forêt.",
  "Ta différence est ta force, pas ta faiblesse.",
  "Avance à ton rythme — l'important c'est de ne jamais reculer.",
  "L'échec n'est qu'une information : il te dit ce qu'il faut ajuster.",
  "Les grandes histoires commencent toujours par un petit 'je vais essayer'.",
  "Investir en toi-même est le meilleur placement que tu feras jamais.",
  "Le travail discret d'aujourd'hui devient le résultat visible de demain.",
  "Sois la raison pour laquelle quelqu'un croit encore en la bonté et la persévérance.",
  "Chaque expert a un jour été débutant.",
  "Ta vie peut changer en une décision — celle de continuer.",
  "On ne grandit pas dans la zone de confort.",
  "Le secret pour avancer, c'est de commencer.",
  "Fais aujourd'hui ce que les autres ne font pas, pour avoir demain ce que les autres n'auront pas.",
  "Tu ne perds jamais vraiment — tu apprends ou tu gagnes.",
  "Une femme qui se lève chaque matin pour ses rêves est déjà une gagnante.",
  "Ton rythme n'a pas à ressembler à celui de quelqu'un d'autre.",
  "La patience n'est pas l'attente passive — c'est l'action continue.",
  "Choisis-toi, encore et encore.",
  "Les rêves ne fonctionnent que si tu fonctionnes.",
  "Aujourd'hui, fais un pas — même tout petit.",
  "Ta valeur ne dépend pas de ta productivité, mais ton avenir en dépend un peu.",
  "Le courage, c'est d'avancer même quand on a peur.",
  "On ne devient pas confiante en attendant — on le devient en agissant.",
  "Si ce n'était pas difficile, tout le monde le ferait.",
  "Le changement commence à la fin de ta zone de confort.",
  "Sois la version de toi que tu admirerais.",
  "Construire quelque chose qui dure prend du temps — et c'est normal.",
  "Ne compare pas ton chapitre 1 au chapitre 20 de quelqu'un d'autre.",
  "Une décision aujourd'hui peut changer toute ta trajectoire.",
  "Les obstacles sont souvent les détours qui mènent au bon endroit.",
  "Ton 'pourquoi' doit être plus fort que tes excuses.",
  "Le succès silencieux d'aujourd'hui sera la victoire visible de demain.",
  "Tu n'as pas à tout savoir pour commencer — juste à commencer.",
  "Avance même si c'est imparfait. Le mouvement crée la clarté.",
  "Plus tu sèmes, plus tu récoltes — sois patiente avec la croissance.",
  "Tu es la PDG de ta vie. Agis en conséquence.",
  "Le repos fait partie du progrès — prends-en sans culpabiliser.",
  "Une routine simple, répétée chaque jour, change une vie entière.",
  "Les femmes qui réussissent ne sont pas parfaites — elles sont déterminées.",
  "Ose demander, ose proposer, ose avancer.",
  "Ton énergie attire ce qui te ressemble — reste alignée.",
  "Fais-le avec amour, même les jours difficiles.",
  "Chaque client que tu aides, c'est une vie que tu touches.",
  "La liberté se construit une action à la fois.",
  "Ne laisse pas un mauvais jour devenir une mauvaise semaine.",
  "Ton parcours inspire plus de gens que tu ne le crois.",
  "L'authenticité attire plus que la perfection.",
  "Sois patiente avec toi-même — tu apprends quelque chose de nouveau chaque jour.",
  "La régularité transforme l'ordinaire en extraordinaire.",
  "Une bonne journée commence par une bonne décision dès le réveil.",
  "Tu construis ton empire une conversation à la fois.",
  "Le plus dur, c'est de commencer. Le reste suit.",
  "Si ton rêve ne te fait pas un peu peur, il n'est peut-être pas assez grand.",
  "Sois reconnaissante pour où tu es, ambitieuse pour où tu vas.",
  "Ce que tu fais aujourd'hui compte, même si ça ne se voit pas encore.",
  "Les femmes qui se soutiennent vont plus loin, ensemble.",
  "Reste fidèle à ton histoire — c'est elle qui touche les gens.",
  "On ne sait jamais quelle conversation va tout changer.",
  "Ta confiance grandit chaque fois que tu agis malgré la peur.",
  "Un petit progrès chaque jour donne de grands résultats avec le temps.",
  "Le travail acharné bat le talent quand le talent ne travaille pas.",
  "Donne-toi le droit d'évoluer, de changer d'avis, de grandir.",
  "Sois celle qui essaie, même si elle n'est pas sûre de réussir.",
  "La meilleure publicité, c'est ton enthousiasme sincère.",
  "Une cliente satisfaite en parle à 3 personnes. Une cliente transformée en parle à 30.",
  "Ne minimise jamais l'impact d'un simple message envoyé avec le cœur.",
  "Ton authenticité est ton meilleur argument de vente.",
  "La vente, c'est de l'attention donnée avant d'être reçue.",
  "Sers d'abord, vends ensuite — la confiance fera le reste.",
  "Les grandes équipes se construisent une personne à la fois, avec patience.",
  "Un leader, c'est quelqu'un qui montre le chemin en marchant devant.",
  "Aide quelqu'un à réussir et tu réussiras toi-même.",
  "Ta lumière peut allumer celle de quelqu'un d'autre — partage-la.",
  "Les femmes qui osent sont celles qui changent leur vie.",
  "Une habitude positive aujourd'hui est un cadeau pour ta toi de demain.",
  "Le succès n'est pas linéaire — accepte les hauts et les bas.",
  "Ce que tu sèmes en silence, tu le récolteras en lumière.",
  "Donne du sens à chaque action, même la plus petite.",
  "Sois fière du chemin parcouru, même s'il reste du chemin à faire.",
  "Aujourd'hui est un excellent jour pour recommencer, si besoin.",
  "Ta présence à elle seule peut inspirer quelqu'un aujourd'hui.",
  "Le plus grand risque, c'est de ne jamais essayer.",
  "Concentre-toi sur le progrès, pas sur la perfection.",
  "Un 'pas encore' n'est pas un 'jamais'.",
  "Tu mérites le succès que tu travailles si dur pour obtenir.",
  "Les meilleures opportunités se cachent souvent dans l'inconfort.",
  "Garde ton cap, même quand le vent change.",
  "Une vie extraordinaire est faite de jours ordinaires bien vécus.",
  "Sois la femme que ta fille ou ton fils admirera plus tard.",
  "Chaque grand changement a commencé par une personne qui a osé.",
  "Le bonheur n'est pas une destination — c'est une façon de voyager.",
  "Tu as déjà survécu à 100% de tes pires journées. Continue.",
  "Ce que tu fais avec constance devient ce que tu es.",
  "Une bonne énergie attire de bonnes opportunités.",
  "Les détails font la différence — prends soin des petites choses.",
  "L'audace paie, même quand elle fait peur.",
  "Le travail que tu fais en privé crée le résultat que tout le monde voit.",
  "Avancer lentement vaut mieux que ne pas avancer du tout.",
  "Crois dans ton projet autant que tu voudrais que les autres y croient.",
  "Une bonne nouvelle peut arriver à n'importe quel moment — reste prête.",
  "Sois reconnaissante chaque jour pour 3 choses, même petites.",
  "La gratitude transforme ce que tu as en suffisant.",
  "Le futur appartient à celles qui se préparent aujourd'hui.",
  "Chaque jour, choisis d'être un peu meilleure qu'hier.",
  "Ton rêve ne périmera pas — alors prends ton temps mais avance.",
  "La vraie force, c'est de continuer même quand c'est dur.",
  "Plus tu donnes de valeur, plus tu en reçois en retour.",
  "Une décision prise avec le cœur est rarement une erreur.",
  "Le succès aime la cohérence plus que l'intensité.",
  "Sois patiente : les graines ne deviennent pas des arbres en un jour.",
  "Ta vulnérabilité partagée peut devenir la force de quelqu'un d'autre.",
  "Aujourd'hui, fais quelque chose que ta future toi te remerciera d'avoir fait.",
  "L'important n'est pas où tu commences, mais où tu choisis d'aller.",
  "Un esprit positif attire des résultats positifs.",
  "Ose être vue, même imparfaite.",
  "Une vie pleine commence par des choix alignés avec tes valeurs.",
  "La meilleure version de toi t'attend du côté de l'effort.",
  "Quand tu doutes, regarde tout le chemin déjà parcouru.",
  "Les femmes inspirantes ne sont pas sans peur — elles avancent avec.",
  "Ne renonce pas à un bon rêve à cause d'une mauvaise journée.",
  "Construire un business, c'est construire sa liberté, jour après jour.",
  "Le respect de soi commence par tenir ses propres promesses.",
  "Un jour à la fois suffit — pas besoin de tout voir d'un coup.",
  "La beauté de recommencer, c'est qu'on peut le faire à chaque instant.",
  "Sois douce avec toi-même — tu fais de ton mieux avec ce que tu as.",
  "Le progrès imparfait vaut mieux que l'inaction parfaite.",
  "Crois en la magie des nouveaux départs.",
  "Un sourire sincère peut ouvrir des portes que les mots ne peuvent pas.",
  "Le succès, c'est aussi savoir s'arrêter pour se reposer sans culpabilité.",
  "Reste curieuse — c'est elle qui fait grandir tes compétences.",
  "Une petite victoire aujourd'hui mérite d'être célébrée.",
  "Ta façon unique de faire les choses est précisément ce qui te distingue.",
  "Le temps que tu investis en toi n'est jamais perdu.",
  "Avance avec foi, même sans toutes les réponses.",
  "La meilleure énergie, c'est celle qui inspire sans épuiser.",
  "Chaque conversation est une graine — certaines mettent du temps à germer.",
  "Sois fière de demander de l'aide — c'est un signe de force, pas de faiblesse.",
  "Un esprit reposé prend de meilleures décisions.",
  "Le succès partagé est un succès multiplié.",
  "Ta voix compte — utilise-la pour inspirer.",
  "Le travail d'équipe transforme les rêves individuels en réalité collective.",
  "Une bonne organisation aujourd'hui t'offre de la liberté demain.",
  "Apprends de chaque expérience — même de celles qui n'ont pas marché.",
  "Le succès n'est pas un sprint, c'est un marathon avec de bonnes chaussures.",
  "Sois reconnaissante pour les personnes qui croient en toi.",
  "La vraie richesse, c'est le temps que tu choisis pour toi-même.",
  "Un objectif écrit a beaucoup plus de chances de se réaliser.",
  "Célèbre les progrès de tes collègues comme les tiens.",
  "Une journée productive commence souvent par une bonne nuit de sommeil.",
  "Tu n'as pas besoin de la permission de quiconque pour réussir.",
  "Le doute est normal — l'action malgré le doute, c'est le courage.",
  "Sois fière de ton parcours, même les chapitres difficiles.",
  "Les graines plantées dans la difficulté donnent souvent les plus belles fleurs.",
  "Aujourd'hui compte, même si demain semble plus important.",
  "La persévérance transforme l'impossible en inévitable.",
  "Avance avec gratitude, pas avec pression.",
  "Ton intuition est souvent plus sage que tu ne le penses.",
  "Le succès attire le succès — commence petit, mais commence.",
  "Une bonne attitude vaut souvent plus qu'une bonne stratégie sans elle.",
  "Reste alignée avec tes valeurs, même quand c'est plus difficile.",
  "Le travail que tu fais aujourd'hui construit la confiance de demain.",
  "Une femme qui aide une autre femme construit un monde meilleur.",
  "Sois généreuse avec ton sourire — il ne coûte rien et vaut beaucoup.",
  "L'inspiration vient en agissant, pas en attendant.",
  "Tu es exactement où tu dois être pour grandir vers où tu veux aller.",
  "Le succès aime ceux qui se montrent, même les jours difficiles.",
  "Avance vers tes rêves un appel, un message, une action à la fois.",
  "La confiance se construit en tenant ses engagements envers soi-même.",
  "Ne sous-estime jamais l'impact d'un mot encourageant.",
  "Le bonheur authentique se voit — et il attire.",
  "Sois la femme qui se relève, encore et encore.",
  "Ta détermination d'aujourd'hui façonne ton histoire de demain.",
  "Apprends à célébrer les petites victoires — elles construisent les grandes.",
  "Le succès, c'est faire ce qu'il faut, même quand personne ne regarde.",
  "Une vie épanouie est faite de choix alignés, jour après jour.",
  "Crois en ton projet même quand tu es la seule à y croire.",
  "Le meilleur investissement, c'est celui que tu fais sur toi-même.",
  "Avance vers la lumière, même à petits pas.",
  "Une équipe soudée peut accomplir bien plus que des individus seuls.",
  "Sois patiente envers ton évolution — Rome ne s'est pas faite en un jour.",
  "Le travail discret paie toujours, tôt ou tard.",
  "Reste fidèle à ta mission, même quand le chemin est sinueux.",
  "Une cliente bien accompagnée devient une amie fidèle.",
  "La gratitude attire l'abondance.",
  "Sois ouverte aux opportunités qui se présentent sous une forme inattendue.",
  "Le courage de commencer est souvent plus grand que celui de continuer.",
  "Avance avec confiance — même les experts ont commencé par un premier pas.",
  "Le succès se construit en coulisses, longtemps avant d'être visible.",
  "Garde le sourire — il influence ta journée plus que tu ne le penses.",
  "La discipline aujourd'hui est la liberté de demain.",
  "Sois fière de chaque message envoyé, chaque appel passé, chaque effort fait.",
  "Le changement que tu cherches commence souvent par un petit geste.",
  "Avance malgré la fatigue — le repos viendra, mais d'abord, l'action.",
  "Ta réussite peut être la preuve dont quelqu'un d'autre a besoin pour croire.",
  "Le succès aime les femmes qui n'abandonnent pas après un 'non'.",
  "Sois reconnaissante pour les leçons, même celles qui ont fait mal.",
  "Une bonne énergie matinale donne le ton de toute la journée.",
  "Le progrès se mesure en mois et en années, pas en heures.",
  "Avance vers ton 'pourquoi' chaque jour, même imparfaitement.",
  "La confiance vient en répétant ce qui te fait peur jusqu'à ce que ça ne le soit plus.",
  "Sois fière d'être différente — c'est ce qui te rend mémorable.",
  "Le succès, c'est continuer même quand les résultats se font attendre.",
  "Une femme déterminée trouve toujours un chemin.",
  "Avance avec le cœur — les chiffres suivront.",
  "La meilleure version de toi grandit chaque jour, même invisiblement.",
  "Sois douce avec ton rythme — il est unique, et c'est correct.",
  "Le travail que tu fais aujourd'hui a un impact que tu ne mesures pas encore.",
  "Avance avec foi en l'avenir et discipline dans le présent.",
  "Une bonne habitude vaut mieux qu'une grande motivation ponctuelle.",
  "Sois reconnaissante envers la personne que tu étais — elle a fait de son mieux.",
  "Le succès n'attend pas la perfection — il aime l'action.",
  "Avance, même si tu ne vois pas encore la ligne d'arrivée.",
  "La vraie liberté, c'est choisir comment tu passes ton temps.",
  "Sois fière de toi pour avoir essayé, peu importe le résultat.",
  "Le succès se cultive comme un jardin — avec patience et constance.",
  "Avance avec gratitude pour ce que tu as et ambition pour ce que tu veux.",
  "Une bonne action aujourd'hui peut changer le cours de ta semaine.",
  "Sois la lumière dont quelqu'un d'autre a besoin aujourd'hui.",
  "Le succès récompense ceux qui restent quand c'est difficile.",
  "Avance vers tes rêves même quand le chemin semble flou.",
  "La confiance en soi se construit une petite victoire à la fois.",
  "Sois fière de ton authenticité — elle attire les bonnes personnes.",
  "Le succès aime la régularité plus que les grands sprints occasionnels.",
  "Avance avec le sourire — même les jours difficiles ont une fin.",
  "Une bonne nouvelle peut arriver juste après le moment où tu voulais abandonner.",
  "Sois patiente : la croissance la plus belle est souvent la plus lente.",
  "Le succès se construit jour après jour, action après action.",
  "Avance avec courage — la peur ne disparaît pas, mais elle s'apaise avec l'action.",
  "La vraie force, c'est de se relever après chaque chute, encore et encore.",
  "Sois fière de chaque étape, même les plus petites.",
  "Le succès n'a pas d'horaire — continue d'avancer à ton rythme.",
  "Avance vers la version de toi que tu rêves de devenir.",
  "Une attitude positive transforme les obstacles en opportunités.",
  "Sois reconnaissante pour aujourd'hui — c'est un cadeau.",
  "Le succès aime celles qui croient en elles avant même d'avoir des preuves.",
  "Avance avec détermination — chaque pas compte, même invisible.",
  "La meilleure façon de prédire ton avenir, c'est de le créer.",
  "Sois fière de ton parcours unique — personne d'autre ne peut le vivre comme toi.",
  "Le succès commence souvent par une décision simple : continuer.",
  "Avance avec confiance — tu as déjà tout ce qu'il faut pour réussir.",
  "Une vie pleine de sens commence par des actions alignées avec ton cœur.",
  "Sois patiente avec le processus — les meilleures choses prennent du temps.",
  "Le succès aime ceux qui se présentent, jour après jour, sans exception.",
  "Avance avec gratitude pour le chemin parcouru et excitation pour celui à venir.",
  "La vraie réussite se mesure aussi en sourires donnés et en vies touchées.",
  "Sois fière de ta croissance, même si elle est invisible aux yeux des autres.",
  "Le succès, c'est l'addition de tous les jours où tu as choisi de continuer.",
  "Avance avec amour pour ce que tu fais — ça se ressent toujours.",
  "Une bonne journée commence par une bonne intention.",
  "Sois reconnaissante pour les défis — ils te font grandir.",
  "Le succès aime la cohérence plus que la perfection.",
  "Avance vers tes objectifs avec patience et persévérance.",
  "La meilleure motivation, c'est de se rappeler pourquoi tu as commencé.",
  "Sois fière de toi pour être arrivée jusqu'ici.",
  "Le succès, c'est avancer même quand on ne voit pas encore les résultats.",
  "Avance avec foi — les graines plantées aujourd'hui fleuriront demain.",
  "Une femme inspirée inspire d'autres femmes.",
  "Sois patiente avec ton évolution — chaque jour compte.",
  "Le succès aime celles qui restent fidèles à elles-mêmes.",
  "Avance avec gratitude — chaque jour est une nouvelle opportunité.",
  "La vraie force vient de l'intérieur — nourris-la chaque jour.",
  "Sois fière de ton chemin, même s'il est différent de celui des autres.",
  "Le succès, c'est continuer d'avancer même à petits pas.",
  "Avance avec confiance vers la vie que tu mérites.",
  "Une bonne énergie attire de bonnes personnes et de bonnes opportunités.",
  "Sois reconnaissante pour chaque opportunité, même les plus petites.",
  "Le succès aime celles qui osent rêver grand et agir petit, chaque jour.",
  "Avance avec le cœur ouvert et l'esprit déterminé.",
  "La meilleure version de toi est à un choix de distance.",
  "Sois fière de ton courage — même quand il est invisible aux autres.",
  "Le succès, c'est la somme de tous les efforts que personne ne voit.",
  "Avance avec espoir — demain est plein de possibilités.",
  "Une vie extraordinaire commence par des choix ordinaires répétés.",
  "Sois patiente — le meilleur est souvent à venir.",
  "Le succès aime celles qui ne renoncent jamais à leurs rêves.",
  "Avance avec gratitude pour aujourd'hui et espoir pour demain.",
  "Ta passion d'aujourd'hui est le métier de demain.",
  "Une femme qui se lève après chaque chute devient inarrêtable.",
  "Le succès commence dans ta tête, avant de se voir dans tes résultats.",
  "Avance avec le sourire, même les jours gris.",
  "Sois fière du chemin, pas seulement de la destination.",
  "Une petite graine de constance donne un grand arbre de résultats.",
  "Ton rythme est le bon rythme, tant que tu avances.",
  "Le courage n'attend pas que la peur disparaisse — il avance avec elle.",
  "Chaque jour est une page blanche — écris-la avec intention.",
  "La meilleure énergie est celle qu'on choisit, pas celle qu'on subit.",
  "Sois la preuve vivante que le changement est possible.",
  "Un esprit reconnaissant trouve toujours une raison de sourire.",
  "Avance, même lentement — l'essentiel est de ne pas t'arrêter.",
  "Ta lumière intérieure ne dépend pas du regard des autres.",
  "Le succès se construit dans les habitudes du quotidien.",
  "Sois douce avec toi-même comme tu le serais avec une amie.",
  "Chaque relance est une preuve de ta détermination.",
  "La confiance grandit chaque fois que tu choisis d'agir.",
  "Avance avec ton cœur — il connaît souvent le chemin.",
  "Le futur se construit une décision à la fois, aujourd'hui.",
  "Le succès, c'est tomber 7 fois et se relever 8 Continue.",
  "Chaque jour est une nouvelle chance de changer ta vie Continue.",
  "La discipline, c'est se rappeler ce que tu veux vraiment Continue.",
  "Tu n'as pas besoin d'être parfaite, juste constante Continue.",
  "Le doute tue plus de rêves que l'échec jamais ne le fera Continue.",
  "Petit pas par petit pas, on construit de grandes choses Continue.",
  "Ton énergie d'aujourd'hui dessine ton avenir de demain Continue.",
  "Crois en toi, même quand personne d'autre ne le fait Continue.",
  "La motivation te lance. L'habitude te fait tenir Continue.",
  "Tu es plus forte que ce que tu penses Continue.",
  "Le meilleur moment pour commencer, c'était hier. Le 2ème, c'est maintenant Continue.",
  "Chaque 'non' te rapproche d'un 'oui' Continue.",
  "La constance bat le talent quand le talent ne travaille pas Continue.",
  "Sois fière de chaque petit progrès — c'est ainsi que naissent les grands changements Continue.",
  "Ton futur toi te remerciera pour les efforts d'aujourd'hui Continue.",
  "Les femmes fortes lèvent les autres femmes en se levant elles-mêmes Continue.",
  "Ce n'est pas le temps qui manque, c'est la décision qui compte Continue.",
  "Une graine plantée chaque jour devient une forêt Continue.",
  "Ta différence est ta force, pas ta faiblesse Continue.",
  "Avance à ton rythme — l'important c'est de ne jamais reculer Continue.",
  "L'échec n'est qu'une information : il te dit ce qu'il faut ajuster Continue.",
  "Les grandes histoires commencent toujours par un petit 'je vais essayer' Continue.",
  "Investir en toi-même est le meilleur placement que tu feras jamais Continue.",
  "Le travail discret d'aujourd'hui devient le résultat visible de demain Continue.",
  "Sois la raison pour laquelle quelqu'un croit encore en la bonté et la persévérance Continue.",
  "Chaque expert a un jour été débutant Continue.",
  "Ta vie peut changer en une décision — celle de continuer Continue.",
  "On ne grandit pas dans la zone de confort Continue.",
  "Le secret pour avancer, c'est de commencer Continue.",
  "Fais aujourd'hui ce que les autres ne font pas, pour avoir demain ce que les autres n'auront pas Continue.",
  "Tu ne perds jamais vraiment — tu apprends ou tu gagnes Continue.",
  "Une femme qui se lève chaque matin pour ses rêves est déjà une gagnante Continue.",
  "Ton rythme n'a pas à ressembler à celui de quelqu'un d'autre Continue.",
  "La patience n'est pas l'attente passive — c'est l'action continue Continue.",
  "Choisis-toi, encore et encore Continue.",
  "Les rêves ne fonctionnent que si tu fonctionnes Continue.",
  "Aujourd'hui, fais un pas — même tout petit Continue.",
  "Ta valeur ne dépend pas de ta productivité, mais ton avenir en dépend un peu Continue.",
  "Le courage, c'est d'avancer même quand on a peur Continue.",
  "On ne devient pas confiante en attendant — on le devient en agissant Continue.",
  "Si ce n'était pas difficile, tout le monde le ferait Continue.",
  "Le changement commence à la fin de ta zone de confort Continue.",
  "Sois la version de toi que tu admirerais Continue.",
  "Construire quelque chose qui dure prend du temps — et c'est normal Continue.",
  "Ne compare pas ton chapitre 1 au chapitre 20 de quelqu'un d'autre Continue.",
  "Une décision aujourd'hui peut changer toute ta trajectoire Continue.",
  "Les obstacles sont souvent les détours qui mènent au bon endroit Continue.",
  "Ton 'pourquoi' doit être plus fort que tes excuses Continue.",
  "Le succès silencieux d'aujourd'hui sera la victoire visible de demain Continue.",
  "Tu n'as pas à tout savoir pour commencer — juste à commencer Continue.",
  "Avance même si c'est imparfait. Le mouvement crée la clarté Continue.",
  "Plus tu sèmes, plus tu récoltes — sois patiente avec la croissance Continue.",
];

function getCitationDuJour(citations){
  const list=(citations&&citations.length>0)?citations:CITATIONS_DEFAULT;
  const today=new Date();
  const dayOfYear=Math.floor((today-new Date(today.getFullYear(),0,0))/86400000);
  return list[dayOfYear%list.length];
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App(){
  const[screen,setScreen]=useState("login");
  const[loginStep,setLoginStep]=useState(1); // 1=identité, 2=chef équipe
  const[userId,setUserId]=useState("");
  const[isChefApp,setIsChefApp]=useState(false);
  const[hasTeamApp,setHasTeamApp]=useState(false);

  useEffect(()=>{
    if(!userId)return;
    if(userId==="melissa"||userId==="melissa-da-silveira"){setIsChefApp(true);setHasTeamApp(true);return;}
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"acces","membres"));
        const chefs=snap.exists()?snap.data().chefs||[]:[];
        setIsChefApp(chefs.includes(userId.replace(/-/g," ")));
      }catch{setIsChefApp(false);}
      try{
        const annSnap=await getDoc(doc(db,"equipe","annuaire"));
        const annuaire=annSnap.exists()?annSnap.data().membres||{}:{};
        setHasTeamApp(Object.values(annuaire).some(m=>m.marraine===userId));
      }catch{setHasTeamApp(false);}
    })();
  },[userId]);

  const[name,setName]=useState("");
  const[nameInput,setNameInput]=useState("");
  const[prenomInput,setPrenomInput]=useState("");
  const[nomInput,setNomInput]=useState("");
  const[codeInput,setCodeInput]=useState("");
  const[loginError,setLoginError]=useState("");
  const[loginLoading,setLoginLoading]=useState(false);
  const[chefs,setChefs]=useState([]);
  const[chefChoisi,setChefChoisi]=useState("");
  const[membresListe,setMembresListe]=useState([]);
  const[marraineChoisie,setMarraineChoisie]=useState("");
  const[pendingUid,setPendingUid]=useState("");
  const[pendingName,setPendingName]=useState("");
  const[pendingIsMelissa,setPendingIsMelissa]=useState(false);

  const SECRET_CODE="BD-2026-FIRE";

  // ── AUTO-LOGIN depuis localStorage ──
  useEffect(()=>{
    try{
      const saved=localStorage.getItem("bd-user");
      if(saved){
        const{uid,n,codeOk}=JSON.parse(saved);
        if(uid&&n&&codeOk===true){
          setUserId(uid);setName(n);
          setScreen("app");load(uid);
        } else {
          // Session invalide - effacer et forcer reconnexion
          localStorage.removeItem("bd-user");
        }
      }
    }catch{}
  },[]);

  const login=async()=>{
    if(!prenomInput.trim()||!nomInput.trim()||!codeInput.trim())return;
    if(codeInput.trim().toUpperCase()!==SECRET_CODE){
      setLoginError("❌ Code d'accès incorrect.");return;
    }
    setLoginLoading(true);setLoginError("");
    try{
      const ref=doc(db,"acces","membres");
      const snap=await getDoc(ref);
      const fullName=`${prenomInput.trim().toLowerCase()} ${nomInput.trim().toLowerCase()}`;
      const isMelissa=prenomInput.trim().toLowerCase()==="melissa";
      // Auto-ajouter Melissa comme chef d'équipe
      if(isMelissa){
        try{
          const accRef=doc(db,"acces","membres");
          const accSnap=await getDoc(accRef);
          const existing=accSnap.exists()?accSnap.data():{};
          const chefs=existing.chefs||[];
          const melissaId="melissa da silveira";
          if(!chefs.includes(melissaId)){
            await setDoc(accRef,{...existing,chefs:[...chefs,melissaId]},{merge:true});
          }
        }catch{}
      }
      if(!isMelissa){
        if(!snap.exists()){
          setLoginError("❌ Accès non autorisé. Contacte Melissa.");
          setLoginLoading(false);return;
        }
        const membres=snap.data().liste||[];
        const autorise=membres.some(m=>m.toLowerCase()===fullName);
        if(!autorise){
          setLoginError("❌ Prénom/Nom non reconnu. Contacte Melissa.");
          setLoginLoading(false);return;
        }
      }
      const uid=fullName.replace(/\s+/g,"-");
      const displayName=`${prenomInput.trim()} ${nomInput.trim()}`;

      // Vérifier si déjà un chef assigné
      const userSnap=await getDoc(doc(db,"users",uid));
      const alreadyHasChef=userSnap.exists()&&userSnap.data()["chef-equipe"];

      if(!isMelissa&&!alreadyHasChef){
        // Charger la liste des chefs et des membres (pour la marraine)
        const chefsSnap=await getDoc(doc(db,"acces","membres"));
        const liste=chefsSnap.exists()?chefsSnap.data().chefs||[]:[];
        const tousMembres=chefsSnap.exists()?chefsSnap.data().liste||[]:[];
        setPendingUid(uid);setPendingName(displayName);setPendingIsMelissa(false);
        setChefs(liste);
        setMembresListe(["melissa da silveira", ...tousMembres.filter(m=>m.toLowerCase()!==fullName&&m.toLowerCase()!=="melissa da silveira")]);
        setLoginLoading(false);
        setLoginStep(2);return;
      }

      // Connexion directe
      try{localStorage.setItem("bd-user",JSON.stringify({uid,n:displayName,codeOk:true}));}catch{}
      setUserId(uid);setName(displayName);setScreen("app");load(uid);
      // Enregistrer token FCM pour les notifications
      saveFCMToken(uid);
      // Synchroniser l'annuaire global des distributeurs
      sg(uid,"db-obj-perso").then(data=>{
        syncAnnuaire(uid, displayName, data?JSON.parse(data):null);
      });
    }catch{
      setLoginError("❌ Erreur de connexion. Réessaie.");
    }
    setLoginLoading(false);
  };

  const confirmerChef=async()=>{
    setLoginLoading(true);
    try{
      if(chefChoisi){
        const ref=doc(db,"users",pendingUid);
        await setDoc(ref,{"chef-equipe":chefChoisi},{ merge:true });
        // Ajouter dans l'équipe du chef
        const chefUid=chefChoisi.toLowerCase().replace(/\s+/g,"-");
        const chefRef=doc(db,"users",chefUid);
        const chefSnap=await getDoc(chefRef);
        const equipe=chefSnap.exists()&&chefSnap.data()["mon-equipe"]?JSON.parse(chefSnap.data()["mon-equipe"]):[];
        if(!equipe.includes(pendingUid)){
          await setDoc(chefRef,{"mon-equipe":JSON.stringify([...equipe,pendingUid])},{merge:true});
        }
      }
      let marraineUid="";
      if(marraineChoisie){
        marraineUid=marraineChoisie.toLowerCase().replace(/\s+/g,"-");
        await setDoc(doc(db,"users",pendingUid),{"marraine":marraineUid},{merge:true});
      }
      try{localStorage.setItem("bd-user",JSON.stringify({uid:pendingUid,n:pendingName,codeOk:true}));}catch{}
      setUserId(pendingUid);setName(pendingName);setScreen("app");load(pendingUid);
      saveFCMToken(pendingUid);
      sg(pendingUid,"db-obj-perso").then(data=>{
        syncAnnuaire(pendingUid, pendingName, data?JSON.parse(data):null, marraineUid);
      });
    }catch{}
    setLoginLoading(false);
  };
  const[tab,setTab]=useState("dashboard");
  const[formationSubTab,setFormationSubTab]=useState("");
  const[showObjectifs,setShowObjectifs]=useState(false);
  const[lang,setLang]=useState("fr");
  const[checks,setChecks]=useState({});
  const[tasks,setTasks]=useState({});
  const[posts,setPosts]=useState({});
  const[kpis,setKpis]=useState({k1:"",k2:"",k3:"",k4:""});
  const[notes,setNotes]=useState("");
  const[loading,setLoading]=useState(false);
  const[openDays,setOpenDays]=useState({1:true});

  const load=useCallback(async(uid)=>{
    setLoading(true);
    try{
      const data = await sgAll(uid);
      if(data.checks) setChecks(JSON.parse(data.checks));
      if(data.tasks)  setTasks(JSON.parse(data.tasks));
      if(data.posts)  setPosts(JSON.parse(data.posts));
      if(data.kpis)   setKpis(JSON.parse(data.kpis));
      if(data.notes)  setNotes(data.notes);
    }catch{}
    setLoading(false);
  },[]);

  const save=useCallback(async(uid,c,t,_s,p,k,n)=>{
    if(!uid)return;
    try{await Promise.all([
      ss(uid,"checks",JSON.stringify(c)),ss(uid,"tasks",JSON.stringify(t)),
      ss(uid,"posts",JSON.stringify(p)),
      ss(uid,"kpis",JSON.stringify(k)),ss(uid,"notes",n),
    ]);}catch{}
  },[]);

  const tog=(type,id)=>{
    const setters={checks:[checks,setChecks],tasks:[tasks,setTasks],posts:[posts,setPosts]};
    const[state,setter]=setters[type];
    if(!state)return;
    const next={...state,[id]:!state[id]};
    setter(next);
    if(type==="tasks")save(userId,checks,next,{},posts,kpis,notes);
    else if(type==="posts")save(userId,checks,tasks,{},next,kpis,notes);
    else save(userId,next,tasks,{},posts,kpis,notes);
  };
  const updKpi=(k,v)=>{const next={...kpis,[k]:v};setKpis(next);save(userId,checks,tasks,null,posts,next,notes);};
  const updNotes=(v)=>{setNotes(v);save(userId,checks,tasks,null,posts,kpis,v);};

  const allTask=SPRINT.flatMap(d=>d.tasks.map(t=>t.id));
  const allPosts=POST_IDEAS.flatMap(th=>th.posts.map(p=>p.id));
  const donePosts=allPosts.filter(id=>posts[id]).length;

  // ── Période et bannières ──
  const periodeInfoInit=getPeriodeInfo();
  const isDebutPeriodeInit=periodeInfoInit.pctElapsed<=10;
  const bannerKeyInit=`bd-banner-${periodeInfoInit.periodEnd.toISOString().slice(0,10)}`;
  const[showBanner,setShowBanner]=useState(()=>{try{return isDebutPeriodeInit&&!localStorage.getItem(bannerKeyInit);}catch{return false;}});
  const[dismissedPeriode,setDismissedPeriode]=useState(false);

  // ── Admin items ──
  const[adminItems,setAdminItems]=useState([]);
  const[adminPosts,setAdminPosts]=useState([]);
  const[homeObjPerso,setHomeObjPerso]=useState(null);
  const[homeTextes,setHomeTextes]=useState(null);
  useEffect(()=>{
    if(screen!=="app")return;
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","contenus"));
        if(snap.exists())setAdminItems((snap.data().items||[]).filter(i=>i.actif));
      }catch{}
      try{
        const snap2=await getDoc(doc(db,"admin","posts_extra"));
        if(snap2.exists())setAdminPosts(snap2.data().items||[]);
      }catch{}
      try{
        const snap3=await getDoc(doc(db,"users",userId));
        if(snap3.exists()&&snap3.data()["db-obj-perso"]) setHomeObjPerso(JSON.parse(snap3.data()["db-obj-perso"]));
      }catch{}
      try{
        const snap4=await getDoc(doc(db,"admin","textes"));
        if(snap4.exists()) setHomeTextes(snap4.data());
      }catch{}
    })();
  },[screen]);

  // ── Protection clavier ──
  useEffect(()=>{
    const block=(e)=>{
      if(e.key==="F12"||(e.ctrlKey&&["u","s","a","p"].includes(e.key.toLowerCase()))){
        e.preventDefault();e.stopPropagation();
      }
    };
    document.addEventListener("keydown",block);
    return()=>document.removeEventListener("keydown",block);
  },[]);

  const TABS=[
    {id:"home",label:"🏠"},
    {id:"dashboard",label:"📊 Tableau de bord"},
    {id:"calendrier",label:"📅 Calendrier"},
    {id:"communaute",label:"🌟 Communauté"},
    {id:"blazing",label:"🔥 BD"},
    {id:"mihi",label:"🏢 Mihi"},
    {id:"formation",label:"🎓 Formation"},
    {id:"sprint",label:"⚡ Sprint 7 jours"},
    {id:"scripts",label:"📝 Scripts"},
    {id:"banqueimages",label:"🖼️ Banque Images"},
    {id:"diagnostics",label:"🩺 Diagnostics"},
    ...(isChefApp||hasTeamApp?[{id:"espacechef",label:"👑 Espace Chef"}]:[]),
  ];

  // Sous-onglets du menu Formation
  const FORMATION_TABS=[
    {id:"demarrage",label:"📚 Démarrage",icon:"📚",col:C.rose,desc:"8 parties — étape par étape pour bien démarrer"},
    {id:"formationapp",label:"🎬 Formation App",icon:"🎬",col:C.lilas,desc:"Comment utiliser l'application Blazing Dynasty"},
    {id:"vente",label:"🎯 Vente",icon:"🎯",col:C.or,desc:"Stratégies, scripts et objections pour booster tes ventes"},
    {id:"recrutement",label:"👥 Recrutement",icon:"👥",col:C.rose,desc:"Recrutement, affiliation et stratégies d'équipe"},
    {id:"contenu",label:"📱 Contenu",icon:"📱",col:C.lilas,desc:"Posts, storytelling, contenu qui attire"},
    {id:"outils",label:"🛠️ Outils",icon:"🛠️",col:C.or,desc:"Canva, CapCut, Linktree et plus"},
    {id:"devperso",label:"🧠 Dév. Personnel",icon:"🧠",col:C.lilas,desc:"Mindset et développement personnel"},
    {id:"formaproduits",label:"🧴 Formation Produits",icon:"🧴",col:C.rose,desc:"Tout savoir sur les produits Mihi"},
  ];

  // ── LOGIN ────────────────────────────────────────────────────────────────────
  if(screen==="login")return(
    <div style={{minHeight:"100vh",background:C.brun,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem 1.2rem",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".25em",color:C.or,marginBottom:".5rem"}}>✦ BLAZING DYNASTY ✦</div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"clamp(1.8rem,5vw,2.6rem)",fontWeight:300,color:C.blanc,textAlign:"center",lineHeight:1.1}}>Espace Formation</div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"clamp(1.8rem,5vw,2.6rem)",fontStyle:"italic",color:C.pale,textAlign:"center",lineHeight:1.1,marginBottom:".3rem"}}>Privé</div>
      <div style={{width:48,height:1,background:C.or,margin:".85rem auto"}}/>
      <p style={{fontSize:".76rem",color:"rgba(232,213,204,.7)",textAlign:"center",marginBottom:"2rem",maxWidth:300}}>Formations · Stratégies · Outils · Suivi</p>

      <div style={{background:C.blanc,borderRadius:16,padding:"1.5rem 1.4rem",width:"100%",maxWidth:360,boxShadow:"0 8px 32px rgba(0,0,0,.25)"}}>

        {/* ÉTAPE 1 — Identité */}
        {loginStep===1&&<>
          <div style={{fontSize:".68rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".75rem",textAlign:"center"}}>🔐 Accès membres</div>
          <div style={{display:"flex",gap:".5rem",marginBottom:".45rem"}}>
            <input type="text" placeholder="Prénom" value={prenomInput} onChange={e=>{setPrenomInput(e.target.value);setLoginError("");}}
              style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:10,padding:".6rem .9rem",fontSize:".85rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}} autoFocus/>
            <input type="text" placeholder="Nom" value={nomInput} onChange={e=>{setNomInput(e.target.value);setLoginError("");}}
              style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:10,padding:".6rem .9rem",fontSize:".85rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
          </div>
          <input type="password" placeholder="Code d'accès" value={codeInput} onChange={e=>{setCodeInput(e.target.value);setLoginError("");}} onKeyDown={e=>e.key==="Enter"&&login()}
            style={{width:"100%",border:`1px solid ${loginError?C.rose:C.pale}`,borderRadius:10,padding:".6rem .9rem",fontSize:".85rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".5rem"}}/>
          {loginError&&<div style={{fontSize:".72rem",color:"#B04040",marginBottom:".5rem",textAlign:"center"}}>{loginError}</div>}
          <button onClick={login} disabled={!prenomInput.trim()||!nomInput.trim()||!codeInput.trim()||loginLoading}
            style={{width:"100%",background:(prenomInput.trim()&&nomInput.trim()&&codeInput.trim())?C.brun:C.pale,color:(prenomInput.trim()&&nomInput.trim()&&codeInput.trim())?C.blanc:C.gris,border:"none",borderRadius:10,padding:".7rem",fontSize:".85rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",transition:"all .2s"}}>
            {loginLoading?"Vérification...":"Continuer →"}
          </button>
          <p style={{fontSize:".62rem",color:C.gris,textAlign:"center",marginTop:".7rem"}}>Espace réservé aux membres Blazing Dynasty.</p>
        </>}

        {/* ÉTAPE 2 — Choix chef d'équipe */}
        {loginStep===2&&<>
          <div style={{fontSize:".68rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem",textAlign:"center"}}>👑 Ta chef d'équipe</div>
          <p style={{fontSize:".76rem",color:C.gris,textAlign:"center",marginBottom:"1rem",lineHeight:1.6}}>
            Bienvenue {pendingName.split(" ")[0]} ! 🎉<br/>Choisis ta chef d'équipe.
          </p>
          <select value={chefChoisi} onChange={e=>setChefChoisi(e.target.value)}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:10,padding:".6rem .9rem",fontSize:".85rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:"1rem"}}>
            <option value="">— Sélectionne ta chef —</option>
            {chefs.map(c=><option key={c} value={c}>{c.split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")}</option>)}
          </select>

          <div style={{fontSize:".68rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.lilas,marginBottom:".5rem",textAlign:"center"}}>🌸 Ta marraine</div>
          <p style={{fontSize:".74rem",color:C.gris,textAlign:"center",marginBottom:".7rem",lineHeight:1.6}}>
            Qui t'a parrainée dans l'aventure ? (optionnel)
          </p>
          <SearchSelect value={marraineChoisie} onChange={setMarraineChoisie} options={membresListe} placeholder="🔍 Tape le nom de ta marraine..."/>
          <button onClick={confirmerChef} disabled={!chefChoisi||loginLoading}
            style={{width:"100%",background:chefChoisi?C.brun:C.pale,color:chefChoisi?C.blanc:C.gris,border:"none",borderRadius:10,padding:".7rem",fontSize:".85rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",transition:"all .2s"}}>
            {loginLoading?"Sauvegarde...":"Accéder à mon espace →"}
          </button>
          <button onClick={confirmerChef} disabled={loginLoading}
            style={{width:"100%",background:"none",border:"none",color:C.gris,fontSize:".7rem",marginTop:".5rem",cursor:"pointer",fontFamily:"inherit",padding:".3rem"}}>
            Passer cette étape
          </button>
        </>}

      </div>
    </div>
  );


  // ── APP ──────────────────────────────────────────────────────────────────────
  const todayKey=new Date().toISOString().slice(0,10);
  const dailyActions=["a1","a2","a3","a4","a5"];
  const actionsToday=dailyActions.filter(id=>checks[`${todayKey}-${id}`]||checks[id]).length;
  const actionsIncomplete=actionsToday<5;
  const periodeInfo=getPeriodeInfo();
  const isDebutPeriode=periodeInfo.pctElapsed<=10;
  const bannerKey=`bd-banner-${periodeInfo.periodEnd.toISOString().slice(0,10)}`;
  const closeBanner=()=>{try{localStorage.setItem(bannerKey,"1");}catch{}setShowBanner(false);};
  const showPeriodeBanner=isDebutPeriode&&!dismissedPeriode;

  return(
    <LangContext.Provider value={{lang}}>
    <div
      style={{minHeight:"100vh",background:C.creme,fontFamily:"'DM Sans',system-ui,sans-serif",color:C.texte,userSelect:"none"}}
      onContextMenu={e=>e.preventDefault()}
      onCopy={e=>e.preventDefault()}
      onCut={e=>e.preventDefault()}
    >

      {/* BANNIÈRE NOUVELLE PÉRIODE */}
      {showPeriodeBanner&&(
        <div style={{background:"linear-gradient(135deg,#C44B1A,#8B3010)",padding:".85rem 1rem",display:"flex",gap:".75rem",alignItems:"flex-start",position:"sticky",top:0,zIndex:150}}>
          <span style={{fontSize:"1.2rem",flexShrink:0}}>🎯</span>
          <div style={{flex:1}}>
            <div style={{fontSize:".78rem",fontWeight:700,color:"white",marginBottom:".2rem"}}>
              Nouvelle période — Fixe tes objectifs !
            </div>
            <div style={{fontSize:".7rem",color:"rgba(255,255,255,.85)",lineHeight:1.5}}>
              Une nouvelle période de 21 jours vient de commencer. Prends 2 minutes pour définir ton CA cible, ton palier et ton objectif de recrues.
            </div>
            <button onClick={()=>{setTab("dashboard");setDismissedPeriode(true);}}
              style={{marginTop:".5rem",background:"white",color:"#C44B1A",border:"none",borderRadius:8,padding:".3rem .75rem",fontSize:".72rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
              → Définir mes objectifs
            </button>
          </div>
          <button onClick={()=>setDismissedPeriode(true)}
            style={{background:"none",border:"none",color:"rgba(255,255,255,.6)",cursor:"pointer",fontSize:".9rem",padding:".1rem",flexShrink:0,fontFamily:"inherit"}}>
            ✕
          </button>
        </div>
      )}

      {/* HEADER */}
      <div style={{background:C.brun,padding:"1rem 1rem .85rem",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(45deg,transparent,transparent 20px,rgba(196,168,130,.04) 20px,rgba(196,168,130,.04) 21px)"}}/>
        <div style={{position:"relative",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:".52rem",fontWeight:700,letterSpacing:".2em",color:C.or}}>✦ BLAZING DYNASTY</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",fontWeight:300,color:C.blanc,marginTop:".15rem"}}>
              Bonjour <strong style={{color:C.or,fontWeight:600}}>{name}</strong>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:".5rem"}}>
            {/* Langue */}
            <button onClick={()=>setLang(l=>l==="fr"?"pt":"fr")}
              style={{background:"rgba(196,168,130,.15)",border:`1px solid ${C.or}40`,borderRadius:20,padding:".22rem .55rem",cursor:"pointer",fontFamily:"inherit",fontSize:".62rem",fontWeight:700,color:C.or}}>
              {lang==="fr"?"🇵🇹":"🇫🇷"}
            </button>
            {/* Notification actions du jour */}
            {actionsIncomplete&&(
              <button onClick={()=>setTab("dashboard")}
                style={{display:"flex",alignItems:"center",gap:".35rem",background:"rgba(196,154,138,.2)",border:`1px solid ${C.rose}`,borderRadius:20,padding:".25rem .6rem",cursor:"pointer",fontFamily:"inherit"}}>
                <span style={{width:16,height:16,borderRadius:"50%",background:C.rose,color:"white",fontSize:".52rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{5-actionsToday}</span>
                <span style={{fontSize:".6rem",color:C.pale,fontWeight:600}}>actions restantes</span>
              </button>
            )}
            {!actionsIncomplete&&(
              <div style={{display:"flex",alignItems:"center",gap:".3rem",background:"rgba(127,175,138,.15)",border:`1px solid ${C.vert}`,borderRadius:20,padding:".25rem .6rem"}}>
                <span style={{fontSize:".7rem"}}>✅</span>
                <span style={{fontSize:".6rem",color:C.vert,fontWeight:600}}>Journée complète !</span>
              </div>
            )}
            <button onClick={()=>{try{localStorage.removeItem("bd-user");}catch{}setScreen("login");}} style={{padding:".25rem .6rem",fontSize:".6rem",color:C.gris,border:`1px solid rgba(196,168,130,.2)`,borderRadius:20,background:"none",cursor:"pointer",fontFamily:"inherit"}}>↩</button>
          </div>
        </div>
        <div style={{position:"relative",marginTop:".6rem",display:"flex",gap:".5rem"}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:".55rem",color:C.pale,opacity:.7,marginBottom:".2rem"}}>
              <span>Posts cochés</span><span>{donePosts}/{allPosts.length}</span>
            </div>
            <div style={{height:3,background:"rgba(255,255,255,.1)",borderRadius:10,overflow:"hidden"}}>
              <div style={{height:"100%",background:C.rose,width:(allPosts.length?Math.round(donePosts/allPosts.length*100):0)+"%",borderRadius:10,transition:"width .4s"}}/>
            </div>
          </div>
        </div>
      </div>

      {/* NAV */}
      <div style={{background:C.blanc,borderBottom:`1px solid ${C.pale}`,display:"flex",overflowX:"auto",position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 8px rgba(61,31,14,.06)"}}>
        {TABS.map(tb=>(
          <button key={tb.id} onClick={()=>setTab(tb.id)}
            style={{flex:"none",padding:".72rem .85rem",fontSize:".6rem",fontWeight:600,letterSpacing:".05em",textTransform:"uppercase",color:tab===tb.id?C.brun:C.gris,border:"none",borderBottom:`2px solid ${tab===tb.id?C.rose:"transparent"}`,background:"none",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit",transition:"all .2s"}}>
            {tb.label}
          </button>
        ))}
      </div>

      {/* RETOUR FORMATION (quand un dossier est ouvert) */}
      {tab==="formation"&&formationSubTab&&(
        <div style={{background:C.creme,borderBottom:`1px solid ${C.pale}`,position:"sticky",top:0,zIndex:99,padding:".5rem 1rem"}}>
          <button onClick={()=>setFormationSubTab("")}
            style={{background:"none",border:"none",color:C.rose,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0}}>
            ← Retour à Formation
          </button>
        </div>
      )}

      {/* BANNIÈRE DÉBUT DE PÉRIODE */}
      {showBanner&&(
        <div style={{background:"linear-gradient(135deg,#C44B1A,#8B3010)",padding:".85rem 1rem",position:"relative",zIndex:50}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:".75rem"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:".65rem",fontWeight:700,letterSpacing:".12em",color:"rgba(255,220,180,.9)",marginBottom:".2rem"}}>🎯 NOUVELLE PÉRIODE MIHI</div>
              <div style={{fontFamily:"Georgia,serif",fontSize:".95rem",color:"white",fontWeight:300,lineHeight:1.3,marginBottom:".35rem"}}>
                C'est le moment de définir<br/><em style={{fontStyle:"italic",color:"#FFD9A0"}}>tes objectifs pour cette période</em>
              </div>
              <p style={{fontSize:".72rem",color:"rgba(255,220,180,.8)",lineHeight:1.5,margin:"0 0 .6rem"}}>
                CA visé · Palier à atteindre · Nombre de recrues — note-les maintenant pour suivre ta progression.
              </p>
              <div style={{display:"flex",gap:".5rem"}}>
                <button onClick={()=>{setTab("dashboard");closeBanner();}}
                  style={{background:"rgba(255,255,255,.2)",border:"1px solid rgba(255,255,255,.4)",borderRadius:8,padding:".35rem .75rem",fontSize:".72rem",fontWeight:700,color:"white",cursor:"pointer",fontFamily:"inherit"}}>
                  Définir mes objectifs →
                </button>
                <button onClick={closeBanner}
                  style={{background:"none",border:"1px solid rgba(255,255,255,.2)",borderRadius:8,padding:".35rem .65rem",fontSize:".72rem",color:"rgba(255,255,255,.6)",cursor:"pointer",fontFamily:"inherit"}}>
                  Plus tard
                </button>
              </div>
            </div>
            <button onClick={closeBanner}
              style={{background:"none",border:"none",color:"rgba(255,255,255,.5)",fontSize:".9rem",cursor:"pointer",padding:".2rem",flexShrink:0,fontFamily:"inherit"}}>
              ✕
            </button>
          </div>
        </div>
      )}

      {loading&&<div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>}

      <div style={{maxWidth:680,margin:"0 auto",padding:"1.1rem 1rem 4rem"}}>

        {/* ── HOME ── */}
        {tab==="home"&&(
          <div>
            {/* ── RÉCAP DU JOUR ── */}
            <HomeRecap name={name} objPerso={homeObjPerso} textes={homeTextes}/>

            <div style={{background:C.brun,borderRadius:16,padding:"1.4rem",marginBottom:"1rem",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-15,right:-15,width:90,height:90,borderRadius:"50%",background:"rgba(196,154,138,.08)"}}/>
              <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".18em",color:C.or,marginBottom:".4rem"}}>✦ ESPACE PRIVÉ</div>
              <div style={{fontFamily:"Georgia,serif",fontSize:"1.25rem",fontWeight:300,color:C.blanc,lineHeight:1.2,marginBottom:".4rem"}}>
                Ton hub de formation<br/><em style={{fontStyle:"italic",color:C.pale}}>Blazing Dynasty</em>
              </div>
              <p style={{fontSize:".73rem",color:C.pale,lineHeight:1.65,opacity:.85}}>
                Formations · Stratégies · Outils · Idées de posts · Suivi recrutement. Tout est ici.
              </p>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:".5rem",marginBottom:"1rem"}}>
              {[["8","parties démarrage",C.rose],["11","replays Zoom",C.or],[String(allPosts.length),"idées de posts",C.lilas]].map(([n,l,col])=>(
                <div key={l} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".7rem .5rem",textAlign:"center"}}>
                  <div style={{fontFamily:"Georgia,serif",fontSize:"1.6rem",fontWeight:600,color:col,lineHeight:1}}>{n}</div>
                  <div style={{fontSize:".58rem",color:C.gris,marginTop:".15rem",lineHeight:1.3}}>{l}</div>
                </div>
              ))}
            </div>
            {[
              {id:"blazing",sub:null,icon:"🔥",col:C.rose,label:"Blazing Dynasty — La vision"},
              {id:"mihi",sub:null,icon:"🏢",col:C.or,label:"Comprendre Mihi & gagner de l'argent"},
              {id:"formation",sub:"demarrage",icon:"📚",col:C.rose,label:"Formation Démarrage Rapide — 8 parties"},
              {id:"formation",sub:"vente",icon:"🎯",col:C.or,label:"Vente · Stratégies · Booster ses ventes"},
              {id:"formation",sub:"recrutement",icon:"👥",col:C.rose,label:"Recrutement · Affiliation · Diagnostique"},
              {id:"formation",sub:"contenu",icon:"📱",col:C.lilas,label:"Contenu · Posts · Storytelling · Cible"},
              {id:"formation",sub:"devperso",icon:"🧠",col:C.lilas,label:"Développement Personnel"},
              {id:"formation",sub:"outils",icon:"🛠️",col:C.or,label:"Outils — Canva · CapCut · Linktree"},
              {id:"sprint",sub:null,icon:"⚡",col:C.rose,label:"Sprint Recrutement 7 jours"},
              {id:"suivi",sub:null,icon:"📋",col:C.lilas,label:"Checklist Nouvelle Recrue"},
            ].map(s=>(
              <div key={s.label} onClick={()=>{setTab(s.id); if(s.sub) setFormationSubTab(s.sub);}}
                style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".7rem 1rem",marginBottom:".45rem",display:"flex",alignItems:"center",gap:".65rem",cursor:"pointer"}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:s.col+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".85rem",flexShrink:0}}>{s.icon}</div>
                <div style={{fontFamily:"Georgia,serif",fontSize:".88rem",fontWeight:600,color:C.brun,flex:1}}>{s.label}</div>
                <div style={{color:C.rose,fontSize:".68rem"}}>→</div>
              </div>
            ))}
          </div>
        )}

        {/* ── BLAZING DYNASTY ── */}
        {tab==="blazing"&&(
          <div>
            <div style={{background:C.brun,borderRadius:16,padding:"2rem 1.4rem",marginBottom:"1rem",textAlign:"center",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:200,height:200,borderRadius:"50%",background:"rgba(196,154,138,.05)"}}/>
              <div style={{position:"relative",fontSize:".58rem",fontWeight:700,letterSpacing:".25em",color:C.or,marginBottom:".5rem"}}>✦ NOTRE ÉQUIPE ✦</div>
              <div style={{position:"relative",fontFamily:"Georgia,serif",fontSize:"clamp(2rem,6vw,2.8rem)",fontWeight:300,color:C.blanc,lineHeight:1}}>Blazing</div>
              <div style={{position:"relative",fontFamily:"Georgia,serif",fontSize:"clamp(2rem,6vw,2.8rem)",fontStyle:"italic",color:C.pale,lineHeight:1.1}}>Dynasty</div>
              <div style={{width:48,height:1,background:C.or,margin:".9rem auto"}}/>
              <p style={{position:"relative",fontSize:".77rem",color:C.pale,opacity:.85,lineHeight:1.7,maxWidth:380,margin:"0 auto"}}>
                Une équipe de femmes et d'hommes ambitieux, bienveillants et déterminés. Pas juste un groupe — une famille qui avance ensemble vers la liberté financière.
              </p>
            </div>
            {[
              ["🌍","Une équipe internationale","Présente en France, au Portugal et au-delà. Nous grandissons ensemble, sans frontières."],
              ["💎","L'excellence comme standard","Pas pour être parfaite — pour être la meilleure version de soi. Chaque jour un peu plus."],
              ["🤝","L'entraide avant tout","Ici on ne laisse personne derrière. Si tu avances, tu tends la main à celles qui arrivent après toi."],
              ["🔥","L'ambition assumée","Nous ne nous excusons pas d'avoir des objectifs. Nous les partageons, nous nous y tenons, nous les atteignons."],
              ["👑","Des leaders, pas des vendeuses","Blazing Dynasty forme des entrepreneures et des leaders de réseau."],
            ].map(([icon,title,desc])=>(
              <div key={title} style={{display:"flex",gap:".65rem",marginBottom:".65rem",alignItems:"flex-start",background:C.blanc,borderRadius:12,padding:".75rem",border:`1px solid ${C.pale}`}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:C.pale,display:"flex",alignItems:"center",justifyContent:"center",fontSize:".85rem",flexShrink:0}}>{icon}</div>
                <div><div style={{fontSize:".8rem",fontWeight:600,color:C.brun,marginBottom:".1rem"}}>{title}</div><div style={{fontSize:".72rem",color:C.gris,lineHeight:1.55}}>{desc}</div></div>
              </div>
            ))}
            <div style={{background:C.brun,borderRadius:14,padding:"1.2rem",marginBottom:".75rem"}}>
              <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,color:C.or,marginBottom:".65rem"}}>✦ Nos valeurs</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".4rem"}}>
                {["Authenticité","Ambition","Bienveillance","Excellence","Liberté","Sororité"].map(v=>(
                  <div key={v} style={{background:"rgba(196,168,130,.12)",borderRadius:8,padding:".4rem .65rem",fontSize:".72rem",fontWeight:600,color:C.pale,textAlign:"center"}}>✦ {v}</div>
                ))}
              </div>
            </div>
            <div style={{background:`linear-gradient(135deg,rgba(196,154,138,.12),rgba(168,155,181,.08))`,border:`1px solid ${C.pale}`,borderRadius:14,padding:"1.1rem",textAlign:"center"}}>
              <div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",fontStyle:"italic",color:C.brun,lineHeight:1.65}}>"Seule on va plus vite. Ensemble on va plus loin."</div>
              <div style={{fontSize:".63rem",color:C.gris,marginTop:".4rem"}}>— Blazing Dynasty</div>
            </div>
          </div>
        )}

        {/* ── MIHI ── */}
        {tab==="mihi"&&(
          <div>
            <SecTitle title="Comprendre" em="Mihi" desc="L'essentiel sur la marque, les gammes et comment construire ton revenu."/>
            <Card title="Qui est Mihi ?" sub="Histoire · Valeurs · Forces" icon="🏢" color={C.or} defaultOpen>
              <Info color={C.or}>Mihi est une marque polonaise de bien-être, beauté et soins, portée par le laboratoire pharmaceutique <strong>ElfaPharm</strong>. Des produits avec de vraies études scientifiques derrière.</Info>
              {[
                ["🧬","Fondée par ElfaPharm","Un laboratoire pharmaceutique sérieux. Ce n'est pas du marketing — il y a une vraie R&D derrière les produits."],
                ["🌍","Présente dans 30+ pays","Une marque qui grandit vite, avec des produits testés et approuvés sur plusieurs marchés européens."],
                ["💎","Rapport qualité/prix","Des produits comparables aux grandes marques de pharmacie, à des prix distributeur compétitifs."],
                ["🔄","Modèle de vente directe","Tu distribues en direct, tes clientes commandent sur ta boutique personnelle. Pas de stock obligatoire."],
              ].map(([icon,title,desc])=>(
                <div key={title} style={{display:"flex",gap:".6rem",marginBottom:".55rem",alignItems:"flex-start"}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:C.pale,display:"flex",alignItems:"center",justifyContent:"center",fontSize:".8rem",flexShrink:0}}>{icon}</div>
                  <div><div style={{fontSize:".78rem",fontWeight:600,color:C.brun,marginBottom:".1rem"}}>{title}</div><div style={{fontSize:".71rem",color:C.gris,lineHeight:1.5}}>{desc}</div></div>
                </div>
              ))}
            </Card>

            <Card title="Les gammes Mihi" sub="Ce que tu peux vendre" icon="💄" color={C.lilas}>
              {[
                ["✨","Skincare — Soin visage","Crèmes anti-âge, sérums, contour des yeux, gommages visage, mousses nettoyantes. Des soins avec de vraies actifs à des prix accessibles."],
                ["💇","Soins cheveux","Shampoings réparateurs, baumes, soins capillaires. Résultats visibles rapidement. Argument fort : résultats comparables aux marques pro, prix bien inférieurs."],
                ["💄","Make-up","Mascara volume, fond de teint matifiant, rouge à lèvres longue tenue. Qualité professionnelle. Facile à démontrer, facile à vendre."],
                ["💊","Compléments alimentaires & Perte de poids","Détox, brûle-graisses, booster de métabolisme, ginkgo biloba, vitamines. Gamme très demandée. Les résultats créent de la fidélité."],
                ["🌸","Parfums","Des jus de qualité, comparables aux grandes marques, à moins de 20€. C'est l'argument qui surprend tout le monde et crée des ventes immédiates."],
                ["🧴","Soin corps","Gommages effet or, baumes satinés, enveloppements. Un rituel luxueux à prix accessible. Parfait pour les box surprises et cadeaux."],
                ["🏠","HOME — Soins maison","Produits d'entretien naturels, désodorisants, soins textiles. Une gamme innovante pour celles qui veulent vendre à toute la famille, pas seulement sur la beauté."],
              ].map(([icon,title,desc])=>(
                <div key={title} style={{display:"flex",gap:".6rem",marginBottom:".5rem",padding:".6rem .7rem",background:C.creme,borderRadius:9,border:`1px solid ${C.pale}`}}>
                  <span style={{fontSize:"1.1rem",flexShrink:0}}>{icon}</span>
                  <div><div style={{fontSize:".78rem",fontWeight:600,color:C.brun,marginBottom:".1rem"}}>{title}</div><div style={{fontSize:".7rem",color:C.gris,lineHeight:1.55}}>{desc}</div></div>
                </div>
              ))}
            </Card>

            <Card title="Comment gagner de l'argent avec Mihi" sub="Le plan de rémunération détaillé" icon="💰" color={C.or}>
              <Info color={C.or}>Il y a <strong>3 façons</strong> de gagner de l'argent avec Mihi, cumulables. Plus tu avances dans les deux, plus ton revenu est stable et croissant.</Info>

              <div style={{background:C.brun,borderRadius:10,padding:".85rem 1rem",marginBottom:".75rem"}}>
                <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.or,marginBottom:".6rem"}}>💰 Levier 1 — Vente directe</div>
                {[
                  ["Prix distributeur","Tu achètes les produits avec une remise de 20 à 30% sur le prix catalogue selon ton statut."],
                  ["Ta marge","Tu revends au prix catalogue. Ta marge = 20 à 30% du prix de vente. Ex : un produit à 40€ catalogue → tu l'achètes ~28-32€ → tu gagnes 8-12€ par vente."],
                  ["Pas de minimum","Pas de stock obligatoire, pas de commande minimum. Tu commandes ce que tes clientes ont commandé."],
                  ["Immédiat","Le bénéfice est direct, dès ta première vente. Pas de palier à atteindre."],
                ].map(([t,d])=>(
                  <div key={t} style={{display:"flex",gap:".5rem",marginBottom:".45rem"}}>
                    <span style={{color:C.or,flexShrink:0,fontSize:".75rem"}}>✦</span>
                    <div style={{fontSize:".73rem",color:C.pale,lineHeight:1.5}}><strong style={{color:C.or}}>{t} :</strong> {d}</div>
                  </div>
                ))}
              </div>

              <div style={{background:C.brun2,borderRadius:10,padding:".85rem 1rem",marginBottom:".75rem"}}>
                <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.or,marginBottom:".6rem"}}>👥 Levier 2 — Commissions équipe</div>
                {[
                  ["Comment ça marche","Tu recrutes des distributrices dans ton équipe. À chaque commande qu'elles passent, tu touches un pourcentage sur leur volume."],
                  ["Revenu passif","Même quand tu ne travailles pas, ton équipe génère du volume. C'est la base de la liberté financière."],
                  ["Duplication","Plus ton équipe recrute à son tour, plus ta structure grandit et plus tes commissions augmentent — sans que tu aies à faire plus de travail direct."],
                  ["Profondeur","Tu touches des commissions sur plusieurs niveaux de ton équipe selon ton statut de qualification."],
                ].map(([t,d])=>(
                  <div key={t} style={{display:"flex",gap:".5rem",marginBottom:".45rem"}}>
                    <span style={{color:C.or,flexShrink:0,fontSize:".75rem"}}>✦</span>
                    <div style={{fontSize:".73rem",color:C.pale,lineHeight:1.5}}><strong style={{color:C.or}}>{t} :</strong> {d}</div>
                  </div>
                ))}
              </div>

              <div style={{background:"rgba(196,168,130,.12)",border:`1px solid ${C.or}40`,borderRadius:10,padding:".85rem 1rem",marginBottom:".75rem"}}>
                <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.or,marginBottom:".6rem"}}>🏆 Levier 3 — Bonus et qualifications</div>
                {[
                  ["Bonus de démarrage","Quand tu démarres fort les 90 premiers jours, Mihi te verse des bonus supplémentaires sur ton volume personnel et équipe."],
                  ["Bonus mensuel","À chaque mois où tu atteins les objectifs de ton palier, tu touches un bonus en plus de tes commissions."],
                  ["Paliers de qualification","Distributrice → Senior → Directrice → Senior Directrice → Directrice Business. Chaque palier = plus de pourcentages et plus de bonus."],
                  ["Voyages & récompenses","Les meilleurs rangs ont accès à des voyages et événements offerts par Mihi."],
                ].map(([t,d])=>(
                  <div key={t} style={{display:"flex",gap:".5rem",marginBottom:".45rem"}}>
                    <span style={{color:C.or,flexShrink:0,fontSize:".75rem"}}>✦</span>
                    <div style={{fontSize:".73rem",color:C.texte,lineHeight:1.5}}><strong style={{color:C.brun}}>{t} :</strong> {d}</div>
                  </div>
                ))}
              </div>

              <div style={{background:C.brun,borderRadius:9,padding:".7rem .9rem",fontSize:".74rem",color:C.pale,lineHeight:1.65}}>
                💡 <strong style={{color:C.or}}>Exemple concret :</strong> Tu vends 500€ de produits ce mois → tu gardes ~125-150€ de marge. Ton équipe génère 2 000€ de volume → tu touches ~100-200€ de commissions en plus. Total : 225-350€ pour ce mois. Plus ton équipe grandit, plus le ratio s'inverse en ta faveur.
              </div>
            </Card>

            <Card title="Les programmes clients Mihi" sub="Tes arguments de vente — détails complets" icon="🎁" color={C.rose}>
              <Info>Ces programmes sont tes <strong>arguments de vente et de fidélisation</strong>. Connais-les par cœur — une cliente bien informée revient toujours.</Info>

              {[
                {icon:"🎁",title:"Welcome Bonus",tag:"1ʳᵉ commande",color:C.rose,details:[
                  "5 € offerts automatiquement sur le compte promo de chaque nouvelle cliente, dès l'inscription.",
                  "Un set de produits best-sellers disponible pour les débutants à prix réduit.",
                  "Des échantillons offerts pour toute commande passée dans les 24h après l'inscription.",
                  "👉 Comment l'utiliser : \"En t'inscrivant via mon lien aujourd'hui, tu reçois 5 € sur ta première commande. C'est automatique, pas de code promo.\"",
                ]},
                {icon:"♾️",title:"Infinity Bonus",tag:"Fidélité",color:C.lilas,details:[
                  "À partir de la 2ᵉ commande : dès 40 € de commande au prix catalogue, ta cliente choisit 1 produit du catalogue avec -70%.",
                  "Ce bonus est ILLIMITÉ — il se renouvelle à chaque période, tant qu'elle commande.",
                  "Si elle saute une période : elle doit recommander 2 périodes consécutives pour retrouver le droit.",
                  "Tous les produits sont éligibles sauf les sets et les produits \"Extra\".",
                  "👉 Comment l'utiliser : \"À chaque commande de 40 €, tu as le droit de choisir un produit à -70 %. Ça fait souvent une valeur de 20-30 € offerts.\"",
                ]},
                {icon:"🎟️",title:"Token Store",tag:"Ton outil de réachat",color:C.or,details:[
                  "Tu achètes des tokens avec ton compte promo ou ton Recruitment Bonus, et tu les envoies à tes clientes.",
                  "3 types de tokens : 5 € en cadeau (coûte 2 € pour toi) · Produit offert (2,50 €) · Remise -70% (0,50 €).",
                  "Le token est valable 24h après envoi. Si la cliente ne l'utilise pas → tu es remboursée automatiquement.",
                  "Fonctionne sur commande minimum de 40 €.",
                  "👉 Quand l'utiliser : pour relancer une cliente silencieuse, anniversaire, après une vente réussie, ou pour déclencher une 1ʳᵉ commande.",
                ]},
                {icon:"💰",title:"Recruitment Bonus",tag:"Pour toi en tant que distributrice",color:C.brun,details:[
                  "À chaque période où tu enregistres au moins 1 nouveau client avec une commande : 5 € crédités dans ton Token Store.",
                  "Ces 5 € servent directement à acheter des tokens pour tes clientes.",
                  "Non cumulatif sur plusieurs nouveaux clients — c'est 5 € fixe par période active.",
                  "👉 Utilité directe : recrute des clientes régulièrement pour alimenter ton Token Store sans bourse délier.",
                ]},
                {icon:"🛍️",title:"Smart Shopping Program",tag:"Automatique",color:C.lilas,details:[
                  "L'IA Mihi analyse les achats de chaque cliente et lui envoie automatiquement un SMS personnalisé.",
                  "L'offre : -50 % sur un produit de sa commande précédente, valable 24h.",
                  "En plus : une recommandation pop-up au moment du panier avec +5 % de remise sur un produit complémentaire.",
                  "Tu n'as rien à faire — mais informe tes clientes que ce programme existe pour qu'elles commandent à chaque période.",
                  "👉 Argument vente : \"Mihi t'envoie automatiquement des offres -50% sur tes produits préférés. Raison de plus de commander régulièrement.\"",
                ]},
                {icon:"👑",title:"Premium Club",tag:"Statut VIP",color:C.or,details:[
                  "Statut accessible aux clientes qui commandent régulièrement des volumes importants.",
                  "Avantages exclusifs : accès à des produits et sets réservés aux membres Premium, remises spéciales, privilèges.",
                  "👉 Comment le vendre : propose-le comme une récompense à tes meilleures clientes. \"Tu commandes souvent — tu mérites le statut Premium Club avec des avantages exclusifs.\"",
                ]},
              ].map(prog=>(
                <div key={prog.title} style={{background:C.creme,borderRadius:10,padding:".8rem",marginBottom:".65rem",border:`1px solid ${C.pale}`}}>
                  <div style={{display:"flex",gap:".5rem",alignItems:"center",marginBottom:".55rem"}}>
                    <span style={{fontSize:"1.1rem"}}>{prog.icon}</span>
                    <div style={{fontSize:".82rem",fontWeight:600,color:C.brun,flex:1}}>{prog.title}</div>
                    <span style={{background:prog.color+"22",color:prog.color===C.or?C.brun2:prog.color,fontSize:".55rem",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",padding:".13rem .4rem",borderRadius:20}}>{prog.tag}</span>
                  </div>
                  {prog.details.map((d,i)=>(
                    <div key={i} style={{fontSize:".72rem",color:d.startsWith("👉")?C.brun:C.gris,lineHeight:1.6,marginBottom:".28rem",fontWeight:d.startsWith("👉")?600:400,fontStyle:d.startsWith("👉")?"italic":"normal"}}>{d}</div>
                  ))}
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ── DÉMARRAGE RAPIDE ── */}
        {/* ── FORMATION : LISTE DE DOSSIERS ── */}
        {tab==="formation"&&!formationSubTab&&(
          <div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
              Centre de <em style={{fontStyle:"italic",color:C.rose}}>Formation</em>
            </div>
            <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
              Choisis une catégorie pour accéder à ses formations, vidéos et ressources.
            </p>
            {FORMATION_TABS.map(f=>(
              <div key={f.id} onClick={()=>setFormationSubTab(f.id)}
                style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".8rem 1rem",marginBottom:".5rem",cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:".7rem"}}>
                  <div style={{width:38,height:38,borderRadius:"50%",background:f.col+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",flexShrink:0}}>{f.icon}</div>
                  <div>
                    <div style={{fontFamily:"Georgia,serif",fontSize:".92rem",fontWeight:600,color:C.brun}}>{f.label.replace(/^\S+\s/,"")}</div>
                    <div style={{fontSize:".66rem",color:C.gris}}>{f.desc}</div>
                  </div>
                </div>
                <span style={{color:C.pale}}>›</span>
              </div>
            ))}
          </div>
        )}

        {tab==="formation"&&formationSubTab==="demarrage"&&(
          <div>
            <SecTitle title="Formation" em="Démarrage Rapide" desc="8 parties — étape par étape ce qu'il faut faire pour réussir. Court, efficace, actionnable."/>
            <div onClick={()=>setTab("dashboard")}
              style={{background:`linear-gradient(135deg, ${C.brun}, ${C.brun2})`,borderRadius:12,padding:".9rem 1rem",marginBottom:"1rem",cursor:"pointer"}}>
              <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".15em",textTransform:"uppercase",color:C.or,marginBottom:".3rem"}}>🚀 NOUVELLE ICI ?</div>
              <div style={{fontSize:".78rem",color:"white",fontWeight:600,lineHeight:1.5}}>
                Découvre ton parcours <strong>Fast Start J1-J7</strong> dans le Tableau de bord — des petites tâches guidées chaque jour pour bien démarrer 💪
              </div>
            </div>
            <Info>💡 Commence par la Partie 1 et avance dans l'ordre. Chaque partie a ses ressources et ses exercices.</Info>
            <AdminContentBlock onglet="demarrage" items={adminItems}/>

            {[
              {num:"1",title:"Les bases — Par où commencer",desc:"Comprendre l'environnement, les outils essentiels et poser les premières fondations.",links:[
                {type:"drive",label:"Vidéo — Les bases partie 1",url:"https://drive.google.com/file/d/1R0tOp4vVBULqHWE8W8vkUDIZ3g03vXYl/view"},
                {type:"drive",label:"Vidéo — Les bases partie 2",url:"https://drive.google.com/file/d/1lJN37k3pwtvz5h7Hx_9PLATq9t00__sn/view"},
                {type:"drive",label:"Vidéo — Les bases partie 3",url:"https://drive.google.com/file/d/1A3N676HlNI0WL07xzNLLnZTnJaxazEP6/view"},
              ],ex:["Configure ta boutique Mihi personnelle","Fais ta liste des 20 premiers contacts","Prends en main les outils de base"]},
              {num:"2",title:"Le post de lancement",desc:"Comment créer et publier ton premier post d'annonce — le moment clé de ton démarrage.",links:[
                {type:"drive",label:"Vidéo — Le post de lancement partie 1",url:"https://drive.google.com/file/d/1Y6HDL3sieUjISsmPCr45rUHSPgQlva4G/view"},
                {type:"drive",label:"Vidéo — Le post de lancement partie 2",url:"https://drive.google.com/file/d/1pGuFpiVhUaVwReo4iuZGJYSSJjepG1uA/view"},
              ],ex:["Rédige ton post de lancement (authentique, pas copié-collé)","Publie-le sur Instagram ET Facebook","Note les personnes qui interagissent — ce sont tes premiers prospects"]},
              {num:"3",title:"Ton profil et ta stratégie de contenu",desc:"Comment optimiser ton profil et structurer ton contenu pour attirer naturellement.",links:[
                {type:"drive",label:"Vidéo — Profil et contenu",url:"https://drive.google.com/file/d/1-KohFYBfAhXQwrGRYJ3RxOOoryONttOb/view"},
                {type:"doc",label:"Document — Stratégie contenu",url:"https://docs.google.com/document/d/16sNdKx-lE77hGHb8lPdGsN7gUwIScIHTPVXkBDj_FsA/edit"},
                {type:"drive",label:"Vidéo complémentaire",url:"https://drive.google.com/file/d/1xVrfvzzIyeqoUQjeBkJv5c2YnzOt0Wdw/view"},
              ],ex:["Optimise ta bio (photo pro + description + lien)",
"Planifie tes 3 premiers posts de la semaine","Mets en place ta routine de stories quotidiennes"]},
              {num:"4",title:"La prospection et le suivi",desc:"Comment approcher les gens, relancer sans être relou, et convertir les curieuses.",links:[
                {type:"drive",label:"Vidéo — Prospection partie 1",url:"https://drive.google.com/file/d/1Psoqrqxw9-xZKIcmLKCBwc7Jn3KD-Zys/view"},
                {type:"drive",label:"Vidéo — Prospection partie 2",url:"https://drive.google.com/file/d/1WA_42brh1YzCfnLM2p32NsiNOSlHDGLN/view"},
                {type:"doc",label:"Document — Scripts de prospection",url:"https://docs.google.com/document/d/12mT8rwV0q8L8hqEe27lsRyeMG-lO0P4fOzaZxwKsQlc/edit"},
              ],ex:["Envoie 3 messages personnels à tes contacts chauds","Utilise les scripts du document en les adaptant à ta voix","Note toutes tes conversations dans un tableau de suivi"]},
              {num:"5",title:"Les présentations et le closing",desc:"Comment présenter l'opportunité et les produits pour déclencher la décision.",links:[
                {type:"drive",label:"Vidéo — Présentation et closing 1",url:"https://drive.google.com/file/d/1dwWb4ti6DOo7wKj23baLnDgyOU4U4QYL/view"},
                {type:"drive",label:"Vidéo — Présentation et closing 2",url:"https://drive.google.com/file/d/1mgtSJqfTZv8_qJhyLRIF01SFqzyApA8-.view"},
              ],ex:["Pratique le pitch express (30 sec) jusqu'à ce que ce soit naturel","Prépare ta présentation complète de 15 min","Fais une présentation test avec une amie avant la vraie"]},
              {num:"6",title:"Les réseaux sociaux en profondeur",desc:"Algorithmes, stratégies de visibilité, ce qui marche vraiment en 2024/2025.",links:[
                {type:"drive",label:"Vidéo — Réseaux sociaux 1",url:"https://drive.google.com/file/d/1bQXLCCw3Ztz-JqEeYF2lPurC2XnfCjNp/view"},
                {type:"drive",label:"Vidéo — Réseaux sociaux 2",url:"https://drive.google.com/file/d/1yLaBkGy_Vu_nMjO54QgG7F2xRjZPXuf8/view"},
              ],ex:["Identifie 3 types de contenus qui fonctionnent sur ton profil","Mets en place ton planning editorial hebdomadaire","Teste un nouveau format cette semaine (Reel, carrousel, story sondage)"]},
              {num:"7",title:"Développer son équipe",desc:"Comment recruter, accueillir et dupliquer — construire une vraie organisation.",links:[
                {type:"drive",label:"Vidéo — Développement équipe 1",url:"https://drive.google.com/file/d/1X4IwW_9jLY0NjTAzKbu79q57KXw1Psqw/view"},
                {type:"drive",label:"Vidéo — Développement équipe 2",url:"https://drive.google.com/file/d/1khEwcug2I_oU4W29_ZIZ-p3uXYgme9J-.view"},
              ],ex:["Identifie 3 personnes dans ta liste pour qui l'opportunité Blazing Dynasty serait parfaite","Prépare ton message d'approche personnalisé pour chacune","Mets en place la checklist d'accueil pour ta première recrue"]},
              {num:"8",title:"Passer à la vitesse supérieure",desc:"Leadership, duplication, construire une organisation qui tourne même quand tu n'es pas là.",links:[
                {type:"drive",label:"Vidéo — Leadership et duplication 1",url:"https://drive.google.com/file/d/1Qyv57Lb6ogn-RPiptlfUnXAaOa8spdMf/view"},
                {type:"drive",label:"Vidéo — Leadership et duplication 2",url:"https://drive.google.com/file/d/1eKJCfgcQbDN5Tqqv9_skMzB3qYVo-lZj/view"},
              ],ex:["Forme ta première recrue en lui faisant suivre ce même parcours","Délègue une tâche à un membre de ton équipe cette semaine","Fixe ton objectif de qualification Mihi pour les 90 prochains jours"]},
            ].map(part=>{
              const checkId=`forma-part-${part.num}`;
              const done=checks[checkId];
              return(
              <Card key={part.num} title={`Partie ${part.num} — ${part.title}`} sub={part.desc} icon={done?"✅":part.num} color={done?C.vert:C.rose}>
                {/* Case à cocher formation validée */}
                <div onClick={()=>tog("checks",checkId)}
                  style={{display:"flex",alignItems:"center",gap:".6rem",background:done?C.vert+"15":C.creme,borderRadius:9,padding:".55rem .8rem",marginBottom:".75rem",cursor:"pointer",border:`1px solid ${done?C.vert:C.pale}`}}>
                  <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${done?C.vert:C.gris}`,background:done?C.vert:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
                    {done&&<span style={{fontSize:".65rem",color:"white",fontWeight:700}}>✓</span>}
                  </div>
                  <span style={{fontSize:".75rem",fontWeight:600,color:done?C.vert:C.gris}}>{done?"✅ Formation validée !":"Cocher quand la formation est terminée"}</span>
                </div>
                <p style={{fontSize:".76rem",color:C.texte,lineHeight:1.65,marginBottom:".75rem"}}>{part.desc}</p>
                <div style={{marginBottom:".75rem"}}>
                  <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".4rem"}}>📹 Ressources</div>
                  {part.links.map(l=>l.type==="drive"?<DriveBtn key={l.url} href={l.url} label={l.label}/>:<DocBtn key={l.url} href={l.url} label={l.label}/>)}
                </div>
                <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.lilas,marginBottom:".4rem"}}>✦ Exercices</div>
                {part.ex.map((ex,i)=>(
                  <div key={i} style={{display:"flex",gap:".55rem",padding:".42rem 0",borderBottom:`1px solid rgba(232,213,204,.3)`}}>
                    <div style={{width:19,height:19,borderRadius:"50%",background:C.rose+"22",color:C.rose,fontSize:".58rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{i+1}</div>
                    <div style={{fontSize:".75rem",color:C.texte,lineHeight:1.45,flex:1}}>{ex}</div>
                  </div>
                ))}
              </Card>
            );})}

            <Card title="Vidéos formation — À utiliser dans tes formations" sub="4 vidéos essentielles" icon="📹" color={C.or}>
              <Info color={C.or}>Ces vidéos complètent ta formation. Regarde-les dans l'ordre et applique immédiatement.</Info>
              <DriveBtn href="https://drive.google.com/file/d/1Qit_DVf9bNHqX7Kh188J6B0PYGda8w15/view" label="1 · Parler des produits pour vendre"/>
              <Btn href="https://us06web.zoom.us/rec/share/hnDWdngAPCK_SGVTYzVhgk70t_nqqfesUvZF7hme8CaEgL-CpszXoantB-d2MSPZ.Yl7wHQ7KV9pZJnCL" label="2 · Communiquer différemment pour passer au niveau supérieur" icon="▶" color={C.brun}/>
              <DriveBtn href="https://drive.google.com/file/d/1TOxUHEMeNXQepUGlYcaoAVaW7c4MdLfA/view" label="3 · Tips pour créer un Reel"/>
              <DriveBtn href="https://drive.google.com/file/d/1kBWsarJ0SDW8tc3UpLC0UBKRMUffO8p1/view" label="4 · Faire ses premières vidéos"/>
            </Card>
          </div>
        )}

        {/* ── VENTE ── */}
        {tab==="formation"&&formationSubTab==="vente"&&(
          <div>
            <SecTitle title="Vente &" em="Stratégies" desc="Tout pour vendre plus, fidéliser tes clientes et booster ton activité."/>
            <AdminContentBlock onglet="vente" items={adminItems}/>

            <Card title="Replays Zoom Vente" sub="Les sessions de formation vente" icon="🎥" color={C.or} defaultOpen>
              <Btn href="https://us06web.zoom.us/rec/share/3i2Txz0KmPwoECQyE7ADbkCr_kDej-QYp_7vW2_YmzpWGSnkipRh5-v7t7oa6r2U.czfOEisyPOYCjYsG" label="Tips de vente + comprendre son pourquoi" icon="▶" color={C.brun}/>
              <Btn href="https://us06web.zoom.us/rec/share/IFStg6CC8vBngO3HPu9G5fh91zV9W6fuwaR3txBwRc96v7vO0-azbiea2eA-d1Hf.MgYK9kyFy7z2kIHB" label="Comment faire ses Lives + déclencher des ventes" icon="▶" color={C.brun}/>
              <Btn href="https://us06web.zoom.us/rec/share/RwAb_48QbKt_jrn_91SJbfXZ8Sf8shCOpxzixhX0HdElfb4xDOU9nBEq-OdNms2b.RRxzRJZ53fmbvprr" label="Les réunions à domicile" icon="▶" color={C.brun}/>
              <Btn href="https://us06web.zoom.us/rec/share/nMz-EPawKi9Iz7vnwqFELpJaK6kJH2aXLaE-evMxN9KiPzBuRIjbmrA77-e41RMv.wpFb79BqNh9yETMe" label="Comment parler des produits (exercice équipe)" icon="▶" color={C.brun}/>
            </Card>

            <Card title="Stratégies de vente" sub="Les méthodes qui marchent" icon="💡" color={C.or}>
              <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.or,marginBottom:".5rem"}}>📁 Documents stratégies</div>
              <DocBtn href="https://docs.google.com/document/d/1BMF1FiXl7HTjQ-kIJYNl_cHh-J-K1Mk5irfunsN6s4c/edit" label="Stratégie Enveloppe Mystère — Document complet"/>
              <DriveBtn href="https://drive.google.com/file/d/1XkJRZMArmWqTy11xCTaJagR4s-vEOdtL/view" label="Stratégie Catalogue — Vidéo"/>
              <DocBtn href="https://docs.google.com/document/d/19wRJArnlDVpzBd1RFxefJCvNcTStFS_TeMNzBe6SUnc/edit" label="Stratégie Catalogue — Document complet"/>
              <DriveBtn href="https://drive.google.com/file/d/1S7IMHB9xUqY43JQRuqa8mtlqY7kabv8t/view" label="Stratégie Défi Live — Vidéo"/>
              <DocBtn href="https://docs.google.com/document/d/1B9b2O7W2crNlRSgTub1QQ1h_lSn87kgGf7Q8dng_nwo/edit" label="Stratégie Défi Live — Document complet"/>
              <DriveBtn href="https://drive.google.com/file/d/1KldVcCgrfLjirxVZjyXtFCpECinKevWs/view" label="Stratégie Liste — Vidéo"/>
              <DocBtn href="https://docs.google.com/document/d/1-GSGmYlH9eyIWn-QjUW8JdGDmN7-ZtA-CfWyMO8AF6s/edit" label="Stratégie C'est Interdit 🔥"/>
            </Card>

            <Card title="Idées pour booster ses ventes" sub="Méthodes créatives et efficaces" icon="🚀" color={C.rose}>
              {[
                ["📦","Box surprises","La cliente choisit un montant (ex: 30€, 50€, 80€). Tu crées une box surprise avec des produits adaptés. Avantage : tu décides de la marge, tu mets en valeur les produits, effet cadeau = émotion = réachat.","Comment vendre ça : \"Tu me donnes un budget, je te crée une box personnalisée avec ce que j'aurai choisi spécialement pour toi. Parfait pour s'offrir ou offrir.\""],
                ["🎰","Tombola produits","La tombola s'auto-finance : les billets paient le lot. Objectif : faire découvrir les produits à de nouvelles personnes. 1 billet = 1 produit Mihi à tester. Les gagnantes deviennent souvent des clientes.","Organisation : 10 billets à 3€ = 30€. Tu achètes le lot à prix distributeur (~15€). Bénéfice réel = 5 nouvelles personnes qui ont découvert les produits."],
                ["🎒","Palette voyageuse","Une trousse avec des échantillons, produits phares, le catalogue et un bon de commande. Tu la fais circuler dans ton entourage (famille, collègues, voisines). Chaque personne la garde 48h.","Résultat : des ventes sans sortir de chez toi. Les gens touchent, testent, commandent."],
                ["🧪","Offre testeurs","Tu recherches 5 personnes pour tester une nouvelle gamme à prix coûtant. Objectif : créer de la preuve sociale et fidéliser. En échange : un témoignage honnête.","Comment le pitcher : \"Je recherche 5 femmes pour tester la nouvelle gamme Face Architect à prix coûtant. En échange, juste ton retour honnête. Intéressée ?\""],
                ["🎮","Jeu concours","Un jeu simple sur tes stories (sondage, devinette, tirage au sort). Le lot = un produit Mihi. Objectif : engagement + visibilité + nouvelles personnes.","Règle d'or : le jeu doit être simple (une action max), le lot doit être désirable, et tu dois relancer les participantes en DM après."],
              ].map(([icon,title,desc,tip])=>(
                <div key={title} style={{background:C.creme,borderRadius:10,padding:".8rem",marginBottom:".65rem",border:`1px solid ${C.pale}`}}>
                  <div style={{display:"flex",gap:".5rem",alignItems:"flex-start",marginBottom:".4rem"}}>
                    <span style={{fontSize:"1rem",flexShrink:0}}>{icon}</span>
                    <div style={{fontSize:".8rem",fontWeight:600,color:C.brun}}>{title}</div>
                  </div>
                  <p style={{fontSize:".74rem",color:C.texte,lineHeight:1.6,marginBottom:".35rem"}}>{desc}</p>
                  <div style={{background:C.blanc,borderRadius:7,padding:".5rem .65rem",fontSize:".71rem",color:C.brun,lineHeight:1.6,fontStyle:"italic",borderLeft:`2px solid ${C.or}`}}>{tip}</div>
                </div>
              ))}
            </Card>

            <Card title="Groupe Messenger clientes" sub="Comment gérer ta communauté cliente" icon="💬" color={C.lilas}>
              <Info color={C.lilas}>Un groupe Messenger bien géré = des clientes engagées qui reviennent. Un groupe mal géré = désengagement et sorties silencieuses.</Info>
              <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.vert,marginBottom:".4rem"}}>✅ À faire</div>
              {["Présenter le groupe dès l'arrivée d'une nouvelle cliente (ton nom, ce que tu partages ici)","Partager des contenus utiles et valorisants (tips beauté, routine, offres en cours)","Annoncer les nouvelles gammes et les programmes clients Mihi","Créer de l'interaction (sondages, questions, avis produits)","Célébrer les résultats des clientes (avant/après, témoignages)","Partager les promotions Mihi (Infinity Bonus, Smart Shopping, tokens)"].map((item,i)=>(
                <div key={i} style={{display:"flex",gap:".5rem",marginBottom:".35rem",alignItems:"flex-start",fontSize:".75rem",color:C.texte}}>
                  <span style={{color:C.vert,flexShrink:0}}>✓</span>{item}
                </div>
              ))}
              <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"#B04040",marginBottom:".4rem",marginTop:".7rem"}}>❌ À ne pas faire</div>
              {["Spammer avec des promotions tous les jours","Copier-coller des messages génériques Mihi sans personnalisation","Ignorer les questions ou mettre du temps à répondre","Partager des prix sans contexte (toujours montrer la valeur avant le prix)","Créer plusieurs groupes pour la même clientèle (confusion)"].map((item,i)=>(
                <div key={i} style={{display:"flex",gap:".5rem",marginBottom:".35rem",alignItems:"flex-start",fontSize:".75rem",color:C.texte}}>
                  <span style={{color:"#B04040",flexShrink:0}}>✗</span>{item}
                </div>
              ))}
            </Card>

            <Card title="Base du suivi client" sub="Ne plus jamais perdre une cliente" icon="📊" color={C.or}>
              <Info color={C.or}>Une cliente qui ne commande plus n'est pas perdue — elle est juste oubliée. Le suivi c'est ce qui fait la différence entre une activité qui stagne et une qui grandit.</Info>
              {[
                ["Après la 1ʳᵉ commande","Message de remerciement dans les 24h. Demande si tout s'est bien passé. Propose un conseil d'utilisation."],
                ["À J+7","Comment elle trouve les produits ? Elle a des questions ? C'est le moment de créer le lien."],
                ["À J+21","Avant la prochaine période : \"La nouvelle période Mihi arrive, tu veux que je te prévienne des offres en cours ?\""],
                ["Si silence +30j","Relance avec un token ou une offre personnalisée. \"J'ai pensé à toi pour cette offre — ça correspond à ce que tu avais aimé.\""],
                ["À chaque anniversaire","Un message personnel. Un token en cadeau si possible. Les petites attentions créent la fidélité à vie."],
              ].map(([moment,action],i)=>(
                <div key={i} style={{display:"flex",gap:".6rem",marginBottom:".55rem",alignItems:"flex-start"}}>
                  <div style={{width:22,height:22,borderRadius:"50%",background:C.or+"30",color:C.brun2,fontSize:".58rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2}}>{i+1}</div>
                  <div><div style={{fontSize:".77rem",fontWeight:600,color:C.brun,marginBottom:".1rem"}}>{moment}</div><div style={{fontSize:".71rem",color:C.gris,lineHeight:1.5}}>{action}</div></div>
                </div>
              ))}
            </Card>

            <Card title="Les Lives — Guide complet" sub="Différentes idées, comment varier" icon="🎥" color={C.rose}>
              {[
                ["🌟","Live démo produit","Tu montres un produit en live, tu l'appliques sur toi, tu réponds aux questions. Le plus simple et le plus efficace.","Durée : 20-30 min. Annonce 24h avant. Commence même si peu de monde."],
                ["❓","Live FAQ","\"Je réponds à toutes vos questions sur [thème].\" Collect les questions avant en story.","Crée de la confiance et de l'expertise. Les spectatrices reviennent."],
                ["🎯","Live défi en direct","\"Ce soir on fait le défi [teint parfait / cheveux brillants] ensemble.\" Chacune montre son avant.","Engagement maximal. Les participantes deviennent des ambassadrices."],
                ["🛍️","Live vente flash","\"Ce soir seulement, offre spéciale sur [produit].\" Crée l'urgence.","Ne pas en abuser. Réserver aux occasions : nouvelle gamme, fin de période, anniversaire."],
                ["📖","Live storytelling","Tu racontes ton histoire : pourquoi tu as rejoint Mihi, tes galères, tes victoires.","C'est le live le plus puissant pour le recrutement. L'authenticité convertit."],
              ].map(([icon,title,desc,tip])=>(
                <div key={title} style={{background:C.creme,borderRadius:10,padding:".75rem",marginBottom:".6rem",border:`1px solid ${C.pale}`}}>
                  <div style={{display:"flex",gap:".5rem",marginBottom:".3rem"}}><span>{icon}</span><div style={{fontSize:".8rem",fontWeight:600,color:C.brun}}>{title}</div></div>
                  <p style={{fontSize:".73rem",color:C.texte,lineHeight:1.6,marginBottom:".3rem"}}>{desc}</p>
                  <div style={{fontSize:".7rem",color:C.gris,fontStyle:"italic",borderLeft:`2px solid ${C.rose}`,paddingLeft:".5rem"}}>{tip}</div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ── RECRUTEMENT ── */}
        {tab==="formation"&&formationSubTab==="recrutement"&&(
          <div>
            <SecTitle title="Recrutement &" em="Affiliation" desc="Stratégies, diagnostique, affiliation — tout pour développer ton équipe."/>
            <AdminContentBlock onglet="recrutement" items={adminItems}/>

            <Card title="Replays Zoom Recrutement" sub="Les sessions formation recrutement" icon="🎥" color={C.rose} defaultOpen>
              <Btn href="https://us06web.zoom.us/rec/share/viyM_OY-wZkKDCyLj-qhIEbIiDv1Yl7j06l9WctzEbvdOS6YPyNJ8RbKKINR5wcO.m5X0v3XgsWBn0ymc" label="Outils de démarrage & recrutement" icon="▶" color={C.brun}/>
              <Btn href="https://us06web.zoom.us/rec/share/hnDWdngAPCK_SGVTYzVhgk70t_nqqfesUvZF7hme8CaEgL-CpszXoantB-d2MSPZ.Yl7wHQ7KV9pZJnCL" label="Communiquer différemment pour passer au niveau supérieur" icon="▶" color={C.brun}/>
              <Btn href="https://us06web.zoom.us/rec/share/Ifld2R1bAsLQ1bJKuj0mr80yNxPt5kPOKAapDNv5jJundkKNIXrdr7de0H0Cn_qR.Yqhq_7quf10A7wtw?startTime=1774984148000" label="Stratégie — Je ne dois pas te le dire mais... 🔥" icon="▶" color={C.brun}/>
            </Card>

            <Card title="Stratégies pour attirer" sub="Comment attirer les bonnes personnes naturellement" icon="🧲" color={C.or}>
              <Info color={C.or}>Attirer c'est mieux que convaincre. Ces stratégies créent un flux entrant de personnes intéressées — sans avoir à courir après.</Info>
              {[
                ["🪝","Le profil qui attire","Ton profil Instagram/Facebook doit répondre à une question en 3 secondes : qui est cette personne et pourquoi je devrais la suivre ? Photo pro + bio qui parle à ta cible + lien Linktree. Sans ça, tout le reste ne sert à rien."],
                ["📖","Le storytelling quotidien","Partage ton histoire — tes galères, tes doutes, tes victoires. Les gens ne s'identifient pas à la perfection. Ils s'identifient à l'authenticité. Une distributrice qui raconte sa transformation attire plus que dix publications produit."],
                ["🔥","Le contenu de preuve","Témoignages clientes, résultats visuels, before/after, messages reçus. La preuve sociale est le moteur n°1 du désir. Partage tout ce qui montre que ça marche — pas en te vantant, mais en partageant."],
                ["🎯","Les hooks qui interpellent","Ta 1ʳᵉ phrase sur chaque publication doit stopper le scroll. \"Je ne cherchais pas un 2ᵉ emploi.\" \"Il y a 6 mois je ne savais pas quoi faire.\" \"Ce que personne ne te dit sur le marketing relationnel.\" La curiosité attire."],
                ["💬","L'interaction stratégique","Commente des publications de ta cible avec de vrais commentaires — pas des emojis. Réponds à toutes les stories. Pose des questions en DM sans pitcher. Crée la relation avant la proposition."],
                ["⚡","Le mot-clé en commentaire","Sur chaque publication opportunité, ferme avec un mot-clé : \"Écris ÉQUIPE en commentaire\". Tu ne réponds qu'aux personnes qui ont montré de l'intérêt. Qualité > quantité."],
              ].map(([icon,title,desc])=>(
                <div key={title} style={{background:C.creme,borderRadius:9,padding:".7rem .85rem",marginBottom:".55rem",border:`1px solid ${C.pale}`}}>
                  <div style={{display:"flex",gap:".5rem",marginBottom:".3rem",alignItems:"flex-start"}}>
                    <span style={{fontSize:"1rem",flexShrink:0}}>{icon}</span>
                    <div style={{fontSize:".8rem",fontWeight:600,color:C.brun}}>{title}</div>
                  </div>
                  <div style={{fontSize:".72rem",color:C.gris,lineHeight:1.6}}>{desc}</div>
                </div>
              ))}
              <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.or,marginBottom:".4rem",marginTop:".5rem"}}>📹 Vidéos diagnostic à envoyer selon le profil</div>
              <DriveBtn href="https://drive.google.com/file/d/1oNIJBA9XKsZjB7idX_xV4oWxgzhHGST9/view" label="👉 Je veux m'affilier — vidéo à envoyer"/>
              <DriveBtn href="https://drive.google.com/file/d/18YRagfzUyTrlarrABNHJouqwUlzC948x/view" label="👉 Vidéo sur l'affiliation"/>
              <DriveBtn href="https://drive.google.com/file/d/1rm5kaTh90zhbd50dYjHxBVi10ud1wqqg/view" label="👉 Je ne veux pas m'affilier — vidéo à envoyer"/>
              <DriveBtn href="https://drive.google.com/file/d/1UvvOQuRetaJymObMLnuxRz6_RzvxOwBT/view" label="👉 Vidéo complémentaire"/>
            </Card>

            <Card title="Stratégies de recrutement" sub="Les méthodes avec documents complets" icon="📁" color={C.lilas}>
              <DriveBtn href="https://drive.google.com/file/d/1dLOGuCg-LkiOX-YUsW_Bce5pr3mwYPVN/view" label="Démarcher — Vidéo"/>
              <DocBtn href="https://docs.google.com/document/d/19GWloCMuOPG8Q_7UQTmTph6AyCMnPWNVTywqRIQPaLY/edit" label="Démarcher — Document complet"/>
              <DriveBtn href="https://drive.google.com/file/d/1WutnDp_no7zU-mmGEgWsiVq7cJ6j7LkA/view" label="Démarcher — Vidéo complémentaire"/>
            </Card>

            <Card title="Récap outils de l'équipe" sub="Tout ce que l'équipe utilise au quotidien" icon="📋" color={C.or}>
              <DocBtn href="https://docs.google.com/document/d/1BU0MH-AcaiWTn1eODBKppavTI8g_77jN833sasmfwU8/edit" label="📋 Récapitulatif complet des outils de l'équipe"/>
              <Info color={C.or}>Ce document contient la liste de tous les outils, liens et ressources utilisés par l'équipe Blazing Dynasty. Garde-le sous la main.</Info>
            </Card>
          </div>
        )}

        {/* ── CONTENU ── */}
        {tab==="formation"&&formationSubTab==="contenu"&&(
          <div>
            <SecTitle title="Contenu &" em="Stratégie" desc="Personal branding, storytelling, mixing contenu — et ton tableau d'idées à cocher."/>
            <AdminContentBlock onglet="contenu" items={adminItems}/>

            <Card title="Formations vidéo Contenu" sub="YouTube · Les bases à connaître" icon="▶" color={C.lilas} defaultOpen>
              <YTBtn href="https://youtu.be/76SKVl4lHsw" label="📸 Comment se prendre en photo pour se mettre en valeur"/>
              <YTBtn href="https://youtu.be/j5EUiKmUSgM" label="👤 Le Personal Branding — Construire ton image"/>
              <YTBtn href="https://youtu.be/WxJFBnigjpw" label="🤝 Humaniser son contenu — Pourquoi et comment"/>
              <YTBtn href="https://youtu.be/dgylHebkai4" label="📖 Le Storytelling — Raconter pour vendre"/>
              <YTBtn href="https://youtu.be/JCgNdVywUME" label="📱 Comprendre les réseaux sociaux"/>
              <YTBtn href="https://youtu.be/6g0k-ET_lW8" label="🎯 Définir sa cible — Vente et recrutement"/>
            </Card>

            <Card title="Mixer ses publications" sub="La règle du mix pour ne pas lasser" icon="🔄" color={C.rose}>
              <Info>La règle de base : sur 10 publications, <strong>4 produits · 3 vie perso/storytelling · 2 opportunité · 1 divertissement/interaction</strong>. Ne jamais être mono-thème.</Info>
              {[
                ["💄","Contenu Produit (40%)","Démo, avant/après, routine, astuce d'utilisation, témoignage cliente, résultat concret. Toujours avec un CTA (mot-clé en commentaire, DM, lien)."],
                ["🌸","Storytelling & Vie perso (30%)","Ton histoire, tes doutes, tes victoires, ta famille, tes valeurs. Ce que les gens ne voient pas. L'authenticité crée la confiance."],
                ["🔥","Opportunité (20%)","Partager l'activité de manière détournée : liberté, moments de vie, résultats flous, témoignages d'équipe. Jamais de pitch direct en publication."],
                ["😄","Divertissement & Interaction (10%)","Sondage, quiz, question ouverte, contenu léger et fun. Ce qui fait réagir sans demander d'effort."],
              ].map(([icon,title,desc])=>(
                <div key={title} style={{display:"flex",gap:".6rem",marginBottom:".6rem",alignItems:"flex-start",background:C.creme,borderRadius:9,padding:".65rem"}}>
                  <span style={{fontSize:"1rem",flexShrink:0}}>{icon}</span>
                  <div><div style={{fontSize:".78rem",fontWeight:600,color:C.brun,marginBottom:".1rem"}}>{title}</div><div style={{fontSize:".71rem",color:C.gris,lineHeight:1.55}}>{desc}</div></div>
                </div>
              ))}
            </Card>

            <Card title="Idées de hooks par thème" sub="10 hooks par sujet — pour accrocher dès la 1ʳᵉ ligne" icon="🪝" color={C.or}>
              <Info color={C.or}>Un hook c'est ta 1ʳᵉ phrase — celle qui donne envie de lire la suite. Sans bon hook, même le meilleur contenu ne sera pas lu.</Info>
              {[
                ["💄 Make-up",[
                  "On m'a demandé combien ça m'avait coûté... ils ont pas cru la réponse 😂",
                  "Tu veux le même résultat sans y passer 1h ?",
                  "Le makeup qui tient 12h même avec un masque — oui ça existe.",
                  "3 produits. 5 minutes. Un résultat qui change tout.",
                  "J'ai arrêté le fond de teint hors de prix. Voilà ce que j'utilise maintenant.",
                  "Le mascara dont tout le monde me demande le nom.",
                  "Mes lèvres tiennent toute la journée sans retouche — secret ?",
                  "Je maquille mes clientes depuis X ans. Le produit que je recommande à TOUTES.",
                  "Makeup naturel en moins de 5 min pour les mamans pressées.",
                  "Elle pensait que ça coûtait 80€. En vrai c'est moins de 20€ 😏",
                ]],
                ["🌿 Skincare",[
                  "La vérité sur le skincare hors de prix que personne ne te dit.",
                  "J'ai testé ça pendant 30 jours. Ce que j'ai découvert m'a surprise.",
                  "Peau terne, boutons, imperfections — j'avais tout ça. Voilà ce qui a tout changé.",
                  "Routine visage complète à moins de 25€. Simple, efficace, sans gadget.",
                  "Mon dermato m'a demandé ce que j'utilisais. Il a été étonné.",
                  "Le serum que j'utilise depuis X semaines — mes rides ont l'air de disparaître.",
                  "Non, ce n'est pas un filtre. C'est juste ma routine soin.",
                  "J'ai 47 ans. On me donne 35. Mes 3 produits secrets.",
                  "Tu penses que les bons soins sont forcément chers. Voilà pourquoi tu as tort.",
                  "Peau sèche, déshydratée, qui tire ? J'ai trouvé LA solution à 18€.",
                ]],
                ["💆 Bien-être & Énergie",[
                  "Je me levais fatiguée chaque matin malgré 8h de sommeil. Puis j'ai changé UN truc.",
                  "Non, ce n'est pas du café. Et non, ce n'est pas de l'eau.",
                  "Tu ne devrais pas avoir à souffrir de ton corps chaque jour.",
                  "Mon ventre plat n'est pas dû à une diète. C'est ça mon secret.",
                  "Fatigue chronique, digestion difficile, ventre gonflé — ce que personne ne t'a dit.",
                  "J'ai perdu X kilos sans régime. Voilà ce qui a changé.",
                  "La routine bien-être que j'aurais aimé commencer 10 ans plus tôt.",
                  "3 compléments. Pas 12. Juste 3. Et ça a tout changé.",
                  "Mon énergie avant VS après. La différence est hallucinante.",
                  "Pour celles qui veulent se sentir mieux sans se ruiner ni se priver.",
                ]],
                ["💇 Cheveux",[
                  "Tes cheveux font la tête ? Secs, ternes, cassants — ça s'explique.",
                  "J'ai arrêté de dépenser 80€ chez le coiffeur. Voilà ce que je fais maintenant.",
                  "Ma routine capillaire à 25€ qui donne des cheveux de rêve.",
                  "Ce produit a sauvé mes cheveux après la grossesse.",
                  "Brillance, douceur, volume — sans alourdir. Le secret ?",
                  "On m'a demandé ce que j'utilisais dans les cheveux. Encore et encore.",
                  "Cheveux abîmés par la coloration ? Ce soin a tout réparé.",
                  "Ma coiffeuse voulait savoir ce que j'avais changé. Voilà la réponse.",
                  "Pour celles qui ont abandonné l'idée d'avoir de beaux cheveux.",
                  "En 2 semaines, la différence était visible. Sans aller chez le coiffeur.",
                ]],
                ["🌸 Parfums",[
                  "Petit jeu : devinez le prix de mon parfum. Réponse en commentaire 😏",
                  "On me fait des compliments sur mon parfum depuis 3 semaines. Il coûte 18€.",
                  "J'ai arrêté de me ruiner en parfum. Voilà pourquoi.",
                  "Mon parfum du quotidien à moins de 20€ — et il tient toute la journée.",
                  "\"C'est quoi ton parfum ?\" La question qu'on m'a posée encore aujourd'hui.",
                  "Qualité grande marque, prix accessible. Ça existe pour les parfums aussi.",
                  "J'utilise ça depuis X mois et je ne retournerai jamais en arrière.",
                  "Pour les amoureux des beaux parfums avec un petit budget.",
                  "Ils ont cru que ça coûtait au moins 80€. Plot twist ❌",
                  "Le parfum dont je suis accro depuis que je l'ai découvert.",
                ]],
                ["💰 Opportunité & Liberté",[
                  "Je ne cherchais pas un 2ème emploi. Je cherchais quelque chose qui s'adapte à ma vie.",
                  "Mardi 15h. Je récupère mon enfant à l'école. Pas de congés posés.",
                  "Il y a 6 mois je ne savais pas quoi faire. Aujourd'hui voilà où j'en suis.",
                  "On m'a demandé si c'était une arnaque. Voilà ma réponse honnête.",
                  "Ce que j'aurais aimé que quelqu'un me dise avant de commencer.",
                  "Je ne vends pas du rêve. Je partage ce qui marche vraiment pour moi.",
                  "La liberté financière ce n'est pas pour les autres. C'est pour toi aussi.",
                  "Ce mois-ci j'ai gagné [montant] en travaillant depuis mon canapé.",
                  "5 femmes dans mon équipe ont changé de vie cette année. Comment ?",
                  "La vraie question ce n'est pas \"est-ce que ça marche ?\" C'est \"est-ce que tu vas essayer ?\"",
                ]],
                ["🔑 Recrutement détourné",[
                  "Tu cherches un complément de revenu sans sacrifier ta famille ?",
                  "3 choses que j'aurais voulu savoir avant de commencer.",
                  "Ce que personne ne montre vraiment sur les réseaux dans ce business.",
                  "J'ai refusé 3 fois avant d'accepter. Voilà pourquoi j'ai eu tort.",
                  "Le business qu'on m'a présenté et que j'ai failli ignorer.",
                  "Pour les mamans qui veulent travailler sans tout sacrifier.",
                  "Travailler de chez soi c'est possible. Pas facile. Mais possible.",
                  "Mon équipe cherche 3 femmes sérieuses. Pas des milliers. Juste 3.",
                  "Ce n'est pas pour tout le monde. Mais peut-être que c'est pour toi.",
                  "Avant de juger, lis jusqu'au bout. Tu pourrais être surpris(e).",
                ]],
              ].map(([theme,hooks])=>(
                <div key={theme} style={{marginBottom:".85rem"}}>
                  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",padding:".22rem .6rem",background:C.or+"20",color:C.brun2,borderRadius:20,display:"inline-block",marginBottom:".5rem"}}>{theme}</div>
                  {hooks.map((hook,i)=>(
                    <div key={i} style={{display:"flex",gap:".5rem",background:C.creme,borderRadius:8,padding:".45rem .65rem",marginBottom:".28rem",alignItems:"flex-start"}}>
                      <span style={{fontSize:".65rem",color:C.gris,flexShrink:0,marginTop:".1rem"}}>🪝</span>
                      <div style={{fontSize:".73rem",color:C.texte,lineHeight:1.5,flex:1,fontStyle:"italic"}}>{hook}</div>
                      <CopyBtn text={hook}/>
                    </div>
                  ))}
                </div>
              ))}
            </Card>

            {adminPosts.length>0&&(
              <Card title="✨ Idées ajoutées par Melissa" sub={`${adminPosts.length} nouvelle${adminPosts.length>1?"s":""} idée${adminPosts.length>1?"s":""}`} icon="🌟" color={C.or} defaultOpen>
                {adminPosts.map(theme=>(
                  <div key={theme.theme} style={{marginBottom:"1rem"}}>
                    <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",padding:".25rem .6rem",background:(theme.color||C.or)+"20",color:theme.color===C.or?C.brun2:(theme.color||C.brun2),borderRadius:20,display:"inline-block",marginBottom:".5rem"}}>{theme.theme}</div>
                    {theme.posts.map(post=>(
                      <div key={post.id} style={{background:posts[post.id]?C.pale+"80":C.creme,borderRadius:9,padding:".65rem .8rem",marginBottom:".35rem",border:`1px solid ${posts[post.id]?C.rose:C.pale}`,transition:"all .2s"}}>
                        <div style={{display:"flex",gap:".55rem",alignItems:"flex-start",marginBottom:posts[post.id]?0:".35rem"}}>
                          <div onClick={()=>tog("posts",post.id)} style={{width:18,height:18,borderRadius:4,border:`2px solid ${posts[post.id]?C.rose:C.pale}`,background:posts[post.id]?C.rose:"transparent",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all .15s"}}>
                            {posts[post.id]&&<span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>}
                          </div>
                          <div style={{fontSize:".76rem",fontWeight:600,color:posts[post.id]?C.gris:C.brun,textDecoration:posts[post.id]?"line-through":"none",flex:1}}>{post.hook}</div>
                          <CopyBtn text={post.hook+"\n\n"+post.caption}/>
                        </div>
                        {!posts[post.id]&&<div style={{fontSize:".71rem",color:C.gris,lineHeight:1.55,marginLeft:"1.45rem"}}>{post.caption}</div>}
                      </div>
                    ))}
                  </div>
                ))}
              </Card>
            )}

            <Card title="Tableau d'idées de posts à cocher" sub={`${donePosts}/${allPosts.length} posts utilisés`} icon="📋" color={C.rose}>
              <Info>Coche les posts que tu as déjà utilisés pour suivre ta diversité de contenu. Adapte toujours à ta voix et à ton vécu.</Info>
              <div style={{marginBottom:".35rem",display:"flex",gap:".5rem",flexWrap:"wrap"}}>
                <span style={{fontSize:".62rem",color:C.gris}}>{donePosts} utilisés · {allPosts.length-donePosts} restants</span>
              </div>
              {POST_IDEAS.map(theme=>(
                <div key={theme.theme} style={{marginBottom:"1rem"}}>
                  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",padding:".25rem .6rem",background:theme.color+"20",color:theme.color===C.or?C.brun2:theme.color,borderRadius:20,display:"inline-block",marginBottom:".5rem"}}>{theme.theme}</div>
                  {theme.posts.map(post=>(
                    <div key={post.id} style={{background:posts[post.id]?C.pale+"80":C.creme,borderRadius:9,padding:".65rem .8rem",marginBottom:".35rem",border:`1px solid ${posts[post.id]?C.rose:C.pale}`,transition:"all .2s"}}>
                      <div style={{display:"flex",gap:".55rem",alignItems:"flex-start",marginBottom:posts[post.id]?0:".35rem"}}>
                        <div onClick={()=>tog("posts",post.id)} style={{width:18,height:18,borderRadius:4,border:`2px solid ${posts[post.id]?C.rose:C.pale}`,background:posts[post.id]?C.rose:"transparent",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all .15s"}}>
                          {posts[post.id]&&<span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>}
                        </div>
                        <div style={{fontSize:".76rem",fontWeight:600,color:posts[post.id]?C.gris:C.brun,textDecoration:posts[post.id]?"line-through":"none",flex:1}}>{post.hook}</div>
                        <CopyBtn text={post.hook+"\n\n"+post.caption}/>
                      </div>
                      {!posts[post.id]&&<div style={{fontSize:".71rem",color:C.gris,lineHeight:1.55,marginLeft:"1.45rem"}}>{post.caption}</div>}
                    </div>
                  ))}
                </div>
              ))}
            </Card>

            <Card title="Ressources supplémentaires" sub="Documents stratégie contenu" icon="📄" color={C.lilas}>
              <DocBtn href="https://docs.google.com/document/d/19-pcqclkBvCHcAt6ONAGk_U8uDMmW0xg2UhOnO-l-fY/edit" label="Idées de publications — Document complet"/>
              <DocBtn href="https://docs.google.com/document/d/12tkS-4d0iLgZkpcnIgBZ0K4hIIXWgclC3IwnjkuyJ3s/edit" label="Stratégie contenu avancée"/>
              <YTBtn href="https://youtu.be/1m37A50VRN8" label="Formation Produit — Gestion perte de poids"/>
              <YTBtn href="https://youtu.be/r0MFA4bj1SY" label="Formation Produit — Ginkgo Biloba"/>
            </Card>
          </div>
        )}

        {/* ── OUTILS ── */}
        {tab==="formation"&&formationSubTab==="devperso"&&(
          <div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
              Développement <em style={{fontStyle:"italic",color:C.rose}}>Personnel</em>
            </div>
            <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
              Mindset, leadership, objectifs — travaille sur toi pour franchir tes propres limites.
            </p>
            <AdminContentBlock onglet="devperso" items={adminItems}/>

            <div style={{background:"linear-gradient(135deg,rgba(196,154,138,.12),rgba(168,155,181,.08))",border:`1px solid ${C.pale}`,borderRadius:10,padding:".75rem 1rem",marginBottom:"1rem",fontSize:".76rem",color:C.texte,lineHeight:1.65}}>
              💡 <strong>6 formations disponibles.</strong> D'autres modules seront ajoutés progressivement par Melissa.
            </div>

            {[
              {icon:"🧠",title:"Dégommer son plafond de verre",desc:"Identifier les croyances limitantes qui t'empêchent d'avancer et les transformer en force.",video:"https://us06web.zoom.us/rec/share/XzuZHzXLLZdVOz2rQmBb-7nomO9qxTj92_xluvzizpzlSaYfxRdmTARqoDTdatzs.EHObmbNT1mpbo0Ad",tag:"dispo"},
              {icon:"🎯",title:"Fixer ses objectifs — méthode complète",desc:"Des objectifs qui fonctionnent vraiment. La méthode pour les poser et les tenir dans le temps.",video:"https://us06web.zoom.us/rec/share/E1JtWx4furUdNFt4wKKCJYcfD4ScYwhJZ3BfUnHZYOnbUzcRYLzdLq5WuoyJSjw.MsevJMjQXIrzr1rp?startTime=1771357741000",tag:"dispo"},
              {icon:"👑",title:"Développer son leadership",desc:"Comment inspirer, guider et faire grandir son équipe. La posture du leader que les autres veulent suivre.",video:"https://us06web.zoom.us/rec/share/hnDWdngAPCK_SGVTYzVhgk70t_nqqfesUvZF7hme8CaEgL-CpszXoantB-d2MSPZ.Yl7wHQ7KV9pZJnCL",tag:"dispo"},
              {icon:"📱",title:"Personal branding — Construire son image",desc:"Qui tu es en ligne = qui tu attires. Comment construire une image authentique et cohérente.",video:"https://youtu.be/j5EUiKmUSgM",tag:"dispo"},
              {icon:"🤝",title:"Humaniser son contenu",desc:"Pourquoi les gens achètent à des personnes, pas à des marques. Comment montrer ta vraie personnalité.",video:"https://youtu.be/WxJFBnigjpw",tag:"dispo"},
              {icon:"📖",title:"Le storytelling",desc:"Raconter pour vendre, pour convaincre, pour recruter. La puissance de l'histoire vraie.",video:"https://youtu.be/dgylHebkai4",tag:"dispo"},
            ].map(item=>(
              <div key={item.title} style={{background:C.blanc,border:`1px solid ${item.tag==="dispo"?C.pale:C.pale}`,borderRadius:12,padding:".85rem 1rem",marginBottom:".6rem",opacity:item.tag==="soon"?.65:1}}>
                <div style={{display:"flex",gap:".6rem",alignItems:"flex-start",marginBottom:item.video?".6rem":0}}>
                  <span style={{fontSize:"1.1rem",flexShrink:0}}>{item.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",gap:".5rem",alignItems:"center",marginBottom:".15rem"}}>
                      <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:C.brun}}>{item.title}</div>
                      <span style={{background:item.tag==="dispo"?C.vert+"25":C.pale,color:item.tag==="dispo"?C.vert:C.gris,fontSize:".52rem",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",padding:".12rem .4rem",borderRadius:20,flexShrink:0}}>
                        {item.tag==="dispo"?"Disponible":"Bientôt"}
                      </span>
                    </div>
                    <div style={{fontSize:".72rem",color:C.gris,lineHeight:1.55}}>{item.desc}</div>
                  </div>
                </div>
                {item.video&&<YTBtn href={item.video} label="▶ Voir la formation"/>}
              </div>
            ))}
          </div>
        )}

        {tab==="formation"&&formationSubTab==="outils"&&(
          <div>
            <SecTitle title="Outils" em="indispensables" desc="Les bases de Canva, CapCut et Linktree — ce qu'il faut savoir et pas plus."/>
            <AdminContentBlock onglet="outils" items={adminItems}/>

            <Card title="Canva — Créer ses visuels" sub="Les bases pour des posts professionnels" icon="🎨" color={C.rose} defaultOpen>
              <Info>Canva c'est l'outil n°1 pour créer tes visuels sans être graphiste. Gratuit, sur mobile et desktop.</Info>
              <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".45rem"}}>Les 5 choses à maîtriser</div>
              {[
                ["1","Les formats","Story = 1080x1920px · Post carré = 1080x1080px · Reel = 1080x1920px. Toujours commencer par choisir le bon format."],
                ["2","Les templates","Cherche \"Instagram story beauté\" ou \"post cosmétique\" dans la barre de recherche. Choisis un template, adapte les couleurs à ton branding (brun + rose + or pour Blazing Dynasty)."],
                ["3","Cohérence visuelle","Utilise toujours les mêmes 3 couleurs, les mêmes 2 polices, le même style de photos. Ton profil doit être reconnaissable au 1ᵉʳ coup d'œil."],
                ["4","Les éléments graphiques","Stickers, formes, lignes — utilise-les avec parcimonie. Moins c'est souvent plus. Un visuel épuré convertit mieux qu'un visuel surchargé."],
                ["5","Exporter et partager","Télécharge en PNG pour les images, MP4 pour les vidéos animées. Active \"Partager le lien\" pour collaborer avec ton équipe."],
              ].map(([n,title,desc])=>(
                <div key={n} style={{display:"flex",gap:".55rem",marginBottom:".55rem",alignItems:"flex-start"}}>
                  <div style={{width:22,height:22,borderRadius:"50%",background:C.rose,color:"white",fontSize:".62rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{n}</div>
                  <div><div style={{fontSize:".77rem",fontWeight:600,color:C.brun,marginBottom:".1rem"}}>{title}</div><div style={{fontSize:".71rem",color:C.gris,lineHeight:1.5}}>{desc}</div></div>
                </div>
              ))}
              <Btn href="https://www.canva.com" label="Ouvrir Canva" color={C.rose} icon="🎨"/>
            </Card>

            <Card title="CapCut — Monter ses vidéos" sub="Les bases pour des Reels et stories vidéo" icon="🎬" color={C.lilas}>
              <Info color={C.lilas}>CapCut c'est l'appli de montage vidéo la plus simple et la plus puissante pour créer des Reels. Gratuite sur mobile.</Info>
              {[
                ["1","Importer et couper","Importe ta vidéo, utilise l'outil \"Séparer\" pour couper les silences et les parties ratées. Garde les moments naturels — l'authenticité convertit."],
                ["2","Les sous-titres automatiques","Outils → Auto-sous-titres. CapCut génère automatiquement les sous-titres. Édite les erreurs. 85% des vidéos sont regardées sans le son."],
                ["3","La musique et les tendances","Bibliothèque → Sons tendances. Utilise une musique tendance pour augmenter ta portée. Vérifie qu'elle est autorisée pour Instagram/TikTok."],
                ["4","Les templates","Onglet \"Templates\" → cherche un format de Reel tendance. Tu remplaces juste les vidéos — le montage est déjà fait."],
                ["5","Exporter","Toujours exporter en 1080p. Désactive le filigrane CapCut si possible (ça nuit à la portée sur Instagram)."],
              ].map(([n,title,desc])=>(
                <div key={n} style={{display:"flex",gap:".55rem",marginBottom:".55rem",alignItems:"flex-start"}}>
                  <div style={{width:22,height:22,borderRadius:"50%",background:C.lilas,color:"white",fontSize:".62rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{n}</div>
                  <div><div style={{fontSize:".77rem",fontWeight:600,color:C.brun,marginBottom:".1rem"}}>{title}</div><div style={{fontSize:".71rem",color:C.gris,lineHeight:1.5}}>{desc}</div></div>
                </div>
              ))}
            </Card>

            <Card title="Linktree — Ton lien unique" sub="Un seul lien, toutes tes ressources" icon="🔗" color={C.or}>
              <Info color={C.or}>Linktree c'est la page qui réunit tous tes liens importants. Tu mets UN seul lien dans ta bio Instagram, et les gens y trouvent tout.</Info>
              {[
                ["1","Créer ton compte","Va sur linktree.com, inscris-toi gratuitement avec ton adresse email."],
                ["2","Ajouter tes liens","Clique \"+Ajouter lien\" pour chaque ressource : ta boutique Mihi, ton groupe Facebook, ton Telegram, ton WhatsApp, ton profil Instagram."],
                ["3","Les liens essentiels à mettre","Ma boutique Mihi · Rejoindre mon équipe · Me contacter sur WhatsApp · Mon Instagram · Mon groupe clientes."],
                ["4","Personnaliser l'apparence","Choisis un fond sombre (cohérent avec tes couleurs Blazing Dynasty). Mets ta photo de profil. Ajoute ton nom et une courte description."],
                ["5","Mettre à jour ta bio","Copie ton lien Linktree (ex: linktr.ee/tonprenom). Colle-le dans ta bio Instagram, Facebook et TikTok. Un seul lien pour tout."],
              ].map(([n,title,desc])=>(
                <div key={n} style={{display:"flex",gap:".55rem",marginBottom:".55rem",alignItems:"flex-start"}}>
                  <div style={{width:22,height:22,borderRadius:"50%",background:C.or,color:C.brun,fontSize:".62rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{n}</div>
                  <div><div style={{fontSize:".77rem",fontWeight:600,color:C.brun,marginBottom:".1rem"}}>{title}</div><div style={{fontSize:".71rem",color:C.gris,lineHeight:1.5}}>{desc}</div></div>
                </div>
              ))}
              <Btn href="https://linktr.ee" label="Créer mon Linktree" color={C.or} icon="🔗"/>
            </Card>

            <Card title="Récap outils de l'équipe" sub="Document officiel Blazing Dynasty" icon="📋" color={C.brun}>
              <DocBtn href="https://docs.google.com/document/d/1BU0MH-AcaiWTn1eODBKppavTI8g_77jN833sasmfwU8/edit" label="📋 Récapitulatif complet des outils de l'équipe"/>
            </Card>
          </div>
        )}

        {/* ── FORMATION PRODUITS ── */}
        {tab==="formation"&&formationSubTab==="formaproduits"&&(
          <div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
              Formation <em style={{fontStyle:"italic",color:C.rose}}>Produits</em>
            </div>
            <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
              Tout savoir sur les produits Mihi pour mieux les vendre et les recommander.
            </p>
            <AdminContentBlock onglet="formaproduits" items={adminItems}/>
            <div style={{background:C.brun,borderRadius:14,padding:"1.4rem",textAlign:"center"}}>
              <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".2em",color:C.or,marginBottom:".5rem"}}>✦ À VENIR ✦</div>
              <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",color:C.blanc,fontWeight:300,lineHeight:1.4}}>
                Les formations produits<br/><em style={{fontStyle:"italic",color:C.pale}}>arrivent bientôt</em>
              </div>
            </div>
          </div>
        )}

        {/* ── SPRINT / ACCÉLÈRE ── */}
        {tab==="sprint"&&(
          <div>
            <SecTitle title="Prends" em="de la vitesse" desc="7 actions quotidiennes pour passer à l'action. Chaque jour compte — coche et avance."/>
            <div style={{background:C.brun,borderRadius:10,padding:".7rem 1rem",marginBottom:"1rem",fontSize:".74rem",color:C.pale,lineHeight:1.6}}>
              🚀 Chaque conversation déclenchée est une graine. Les graines d'aujourd'hui = les recrues de demain.
            </div>
            <div style={{marginBottom:"1rem"}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:".62rem",color:C.gris,marginBottom:".22rem"}}>
                <span>Progression sprint</span><span>{SPRINT.flatMap(d=>d.tasks).filter(t=>tasks[t.id]).length}/{allTask.length}</span>
              </div>
              <div style={{height:4,background:C.pale,borderRadius:10,overflow:"hidden"}}>
                <div style={{height:"100%",background:C.rose,width:(allTask.length?Math.round(SPRINT.flatMap(d=>d.tasks).filter(t=>tasks[t.id]).length/allTask.length*100):0)+"%",borderRadius:10,transition:"width .3s"}}/>
              </div>
            </div>
            {SPRINT.map(day=>{
              const isOpen=openDays[day.day];
              const dayDone=day.tasks.filter(t=>tasks[t.id]).length;
              const dayPct=Math.round(dayDone/day.tasks.length*100);
              const allDone=dayPct===100;
              const fc={rs:C.lilas,bao:C.or,mix:C.rose}[day.focus];
              const fl={rs:"Réseaux",bao:"Terrain",mix:"Mixte"}[day.focus];
              return(
                <div key={day.day} style={{background:C.blanc,border:`1px solid ${isOpen?C.rose:C.pale}`,borderRadius:14,marginBottom:".75rem",overflow:"hidden",transition:"all .2s"}}>
                  <div onClick={()=>setOpenDays(p=>({...p,[day.day]:!p[day.day]}))}
                    style={{padding:".82rem 1rem",display:"flex",alignItems:"center",gap:".6rem",cursor:"pointer",userSelect:"none"}}>
                    <div style={{width:34,height:34,borderRadius:"50%",background:allDone?C.vert:C.brun,color:allDone?"white":C.or,fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {allDone?"✓":day.day}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:"Georgia,serif",fontSize:".92rem",fontWeight:600,color:C.brun}}>{day.title}</div>
                      <div style={{fontSize:".6rem",color:C.gris}}>{day.goal}</div>
                    </div>
                    <span style={{background:fc+"22",color:fc===C.or?C.brun2:fc,fontSize:".55rem",fontWeight:700,textTransform:"uppercase",padding:".15rem .45rem",borderRadius:20,flexShrink:0}}>{fl}</span>
                    <div style={{color:C.rose,fontSize:".68rem",transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s",flexShrink:0}}>▼</div>
                  </div>
                  {isOpen&&(
                    <div style={{borderTop:`1px solid ${C.pale}`}}>
                      <div style={{padding:".5rem 1rem .3rem"}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:".6rem",color:C.gris,marginBottom:".22rem"}}>
                          <span>{dayDone}/{day.tasks.length}</span><span>{dayPct}%</span>
                        </div>
                        <div style={{height:4,background:C.pale,borderRadius:10,overflow:"hidden"}}>
                          <div style={{height:"100%",background:C.rose,width:dayPct+"%",transition:"width .3s",borderRadius:10}}/>
                        </div>
                      </div>
                      <div style={{padding:".5rem 1rem .85rem"}}>
                        {day.tasks.map(task=>(
                          <div key={task.id}>
                            <div onClick={()=>tog("tasks",task.id)} style={{display:"flex",alignItems:"flex-start",gap:".55rem",padding:".45rem 0",borderBottom:`1px solid rgba(232,213,204,.3)`,cursor:"pointer"}}>
                              <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${C.rose}`,background:tasks[task.id]?C.rose:"transparent",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
                                {tasks[task.id]&&<span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>}
                              </div>
                              <div style={{fontSize:".76rem",color:tasks[task.id]?C.gris:C.texte,textDecoration:tasks[task.id]?"line-through":"none",lineHeight:1.45,flex:1}}>{task.label}</div>
                            </div>
                            {task.script&&(
                              <div style={{background:C.creme,borderLeft:`3px solid ${C.lilas}`,borderRadius:"0 8px 8px 0",padding:".5rem .75rem",fontSize:".72rem",fontStyle:"italic",color:C.texte,lineHeight:1.7,margin:".3rem 0 .4rem",display:"flex",gap:".5rem",alignItems:"flex-start"}}>
                                <span style={{flex:1}}>{task.script}</span>
                                <CopyBtn text={task.script}/>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:14,padding:"1.1rem"}}>
              <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,color:C.brun,marginBottom:".75rem"}}>📊 Mes chiffres</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:".75rem"}}>
                {[["k1","Messages envoyés"],["k2","Réponses reçues"],["k3","Présentations"],["k4","Nouvelles recrues"]].map(([k,l])=>(
                  <div key={k} style={{background:C.creme,border:`1px solid ${C.pale}`,borderRadius:10,padding:".6rem",textAlign:"center"}}>
                    <input type="number" min="0" value={kpis[k]||""} placeholder="0" onChange={e=>updKpi(k,e.target.value)}
                      style={{width:52,fontFamily:"Georgia,serif",fontSize:"1.6rem",fontWeight:600,color:C.brun,border:"none",background:"none",textAlign:"center",outline:"none"}}/>
                    <div style={{fontSize:".58rem",color:C.gris,marginTop:".12rem"}}>{l}</div>
                  </div>
                ))}
              </div>
              <textarea value={notes} onChange={e=>updNotes(e.target.value)} placeholder="Notes, blocages, questions..."
                style={{width:"100%",minHeight:80,border:`1px solid ${C.pale}`,borderRadius:8,padding:".6rem",fontFamily:"inherit",fontSize:".76rem",color:C.texte,background:C.creme,resize:"vertical",outline:"none",lineHeight:1.6}}/>
            </div>
          </div>
        )}

        {/* ── SUIVI RECRUES ── */}
        {tab==="suivi"&&<SuiviRecruTab uid={userId}/>}

        {/* ── TABLEAU DE BORD ── */}
        {tab==="dashboard"&&<DashboardTab uid={userId} goToFormation={(sub)=>{setTab("formation");setFormationSubTab(sub);}}/>}
        {tab==="communaute"&&<CommunauteTab uid={userId} userName={name}/>}
        {tab==="scripts"&&<ScriptsTab/>}
        {tab==="banqueimages"&&<BanqueImagesTab isMelissa={name.toLowerCase().startsWith("melissa")}/>}
        {tab==="diagnostics"&&<DiagnosticsTab uid={userId} userName={name}/>}
        {tab==="espacechef"&&(isChefApp||hasTeamApp)&&<EspaceChefTab uid={userId} isChef={isChefApp}/>}
        {tab==="formation"&&formationSubTab==="formationapp"&&<FormationAppTab adminItems={adminItems}/>}
        {tab==="objectifs"&&<ObjectifsTab uid={userId} userName={name} isMelissa={name.toLowerCase().startsWith("melissa")}/>}
        {tab==="calendrier"&&<CalendrierTab uid={userId} userName={name} isMelissa={name.toLowerCase().startsWith("melissa")} isChef={false}/>}

      </div>

      {/* WATERMARK invisible — prénom de la personne connectée */}
      <div style={{position:"fixed",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:9999,overflow:"hidden",opacity:.03}}>
        {Array.from({length:20}).map((_,i)=>(
          <div key={i} style={{position:"absolute",top:`${(i*11)%100}%`,left:`${(i*17)%100}%`,fontSize:"1.2rem",fontWeight:700,color:C.brun,transform:"rotate(-30deg)",whiteSpace:"nowrap",letterSpacing:".15em"}}>
            {name.toUpperCase()} · BLAZING DYNASTY
          </div>
        ))}
      </div>

      <div style={{textAlign:"center",padding:"1.1rem",fontSize:".6rem",color:C.gris,borderTop:`1px solid ${C.pale}`}}>
        <strong style={{color:C.rose}}>Blazing Dynasty</strong> · Espace Formation Privé
      </div>

      {/* ── BOUTON FLOTTANT OBJECTIFS ── */}
      <button onClick={()=>setShowObjectifs(p=>!p)}
        style={{position:"fixed",bottom:"5rem",right:"1.2rem",width:56,height:56,borderRadius:"50%",background:C.brun,border:`2px solid ${C.or}`,boxShadow:"0 4px 20px rgba(61,31,14,.4)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,transition:"all .2s",padding:0,overflow:"hidden"}}>
        {showObjectifs
          ? <span style={{fontSize:"1rem",color:C.or,fontWeight:700}}>✕</span>
          : <span style={{fontSize:"1.4rem"}}>👑</span>
        }
      </button>

      {/* ── POPUP OBJECTIFS ── */}
      {showObjectifs&&(
        <div style={{position:"fixed",bottom:"8rem",right:"1.2rem",width:285,background:C.blanc,borderRadius:16,boxShadow:"0 8px 32px rgba(61,31,14,.25)",border:`1px solid ${C.pale}`,zIndex:199,overflow:"hidden"}}>
          <div style={{background:C.brun,padding:".85rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",gap:".6rem",alignItems:"center"}}>
              <span style={{fontSize:"1.4rem"}}>👑</span>
              <div>
                <div style={{fontSize:".55rem",fontWeight:700,letterSpacing:".15em",color:C.or}}>✦ OBJECTIFS ÉQUIPE</div>
                <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",color:C.blanc,fontWeight:300}}>Ce mois-ci</div>
              </div>
            </div>
          </div>
          <ObjectifsPopup uid={userId}/>
        </div>
      )}
    </div>
    </LangContext.Provider>
  );
}

// ── HOME RECAP (page d'accueil) ──────────────────────────────────────────────
function HomeRecap({name, objPerso, textes}){
  const periodeInfo=getPeriodeInfo();
  const citation=getCitationDuJour(textes?.citations);
  const prenom=name.split(" ")[0];

  const pct=(r,o)=>{
    if(!o||!r||+o===0)return 0;
    return Math.min(100,Math.round(+r/+o*100));
  };

  const pctCA=objPerso?pct(objPerso.ca,objPerso.caObj):0;
  const pctRecrues=objPerso?pct(objPerso.recruesReal,objPerso.recruesObj):0;
  const hasObjCA=objPerso&&objPerso.caObj;
  const hasObjRecrues=objPerso&&objPerso.recruesObj&&objPerso.recruesObj!=="0";

  const urgent=periodeInfo.daysLeft<3;

  return(
    <div style={{marginBottom:"1rem"}}>
      {/* Bienvenue */}
      <div style={{background:`linear-gradient(135deg, ${C.brun}, ${C.brun2})`,borderRadius:16,padding:"1.4rem",marginBottom:".75rem",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-20,right:-20,width:100,height:100,borderRadius:"50%",background:"rgba(196,168,130,.1)"}}/>
        <div style={{position:"relative"}}>
          <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".18em",color:C.or,marginBottom:".35rem"}}>✦ BIENVENUE</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.3rem",fontWeight:300,color:C.blanc,lineHeight:1.25,marginBottom:".5rem"}}>
            Salut <em style={{fontStyle:"italic",color:C.pale}}>{prenom}</em> 👋
          </div>
          {textes?.messageAccueil&&(
            <p style={{fontSize:".74rem",color:C.pale,opacity:.9,lineHeight:1.6,marginBottom:0}}>{textes.messageAccueil}</p>
          )}
        </div>
      </div>

      {/* Période + objectifs */}
      <div style={{display:"grid",gridTemplateColumns:hasObjCA||hasObjRecrues?"1fr 1fr":"1fr",gap:".5rem",marginBottom:".75rem"}}>
        {/* Période */}
        <div style={{background:urgent?"#FFF3E0":C.blanc,border:`1px solid ${urgent?"#E6A817":C.pale}`,borderRadius:12,padding:".85rem"}}>
          <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:urgent?"#8B5E00":C.rose,marginBottom:".4rem"}}>⏱️ Période en cours</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.6rem",fontWeight:600,color:urgent?"#C44B1A":C.brun,lineHeight:1}}>
            {periodeInfo.daysLeft}<span style={{fontSize:".8rem",fontWeight:400,color:C.gris}}> j {periodeInfo.hoursLeft}h</span>
          </div>
          <div style={{fontSize:".6rem",color:C.gris,marginTop:".15rem"}}>restants{urgent?" ⚠️":""}</div>
          <div style={{height:4,background:C.pale,borderRadius:10,overflow:"hidden",marginTop:".5rem"}}>
            <div style={{height:"100%",background:urgent?"#E6A817":C.rose,width:periodeInfo.pctElapsed+"%",borderRadius:10}}/>
          </div>
        </div>

        {/* Objectif CA */}
        {hasObjCA&&(
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem"}}>
            <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.or,marginBottom:".4rem"}}>💰 Mon CA</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1.6rem",fontWeight:600,color:pctCA>=100?C.vert:C.brun,lineHeight:1}}>
              {pctCA}<span style={{fontSize:".8rem",fontWeight:400,color:C.gris}}>%</span>
            </div>
            <div style={{fontSize:".6rem",color:C.gris,marginTop:".15rem"}}>{objPerso.ca||0}€ / {objPerso.caObj}€</div>
            <div style={{height:4,background:C.pale,borderRadius:10,overflow:"hidden",marginTop:".5rem"}}>
              <div style={{height:"100%",background:pctCA>=100?C.vert:C.or,width:pctCA+"%",borderRadius:10}}/>
            </div>
          </div>
        )}

        {/* Objectif recrues (si pas de CA, prend la 2e colonne) */}
        {hasObjRecrues&&!hasObjCA&&(
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem"}}>
            <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.lilas,marginBottom:".4rem"}}>👥 Mes recrues</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1.6rem",fontWeight:600,color:pctRecrues>=100?C.vert:C.brun,lineHeight:1}}>
              {pctRecrues}<span style={{fontSize:".8rem",fontWeight:400,color:C.gris}}>%</span>
            </div>
            <div style={{fontSize:".6rem",color:C.gris,marginTop:".15rem"}}>{objPerso.recruesReal||0} / {objPerso.recruesObj}</div>
            <div style={{height:4,background:C.pale,borderRadius:10,overflow:"hidden",marginTop:".5rem"}}>
              <div style={{height:"100%",background:pctRecrues>=100?C.vert:C.lilas,width:pctRecrues+"%",borderRadius:10}}/>
            </div>
          </div>
        )}
      </div>

      {/* Objectif recrues — 2e ligne si CA présent aussi */}
      {hasObjCA&&hasObjRecrues&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem",marginBottom:".75rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".4rem"}}>
            <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.lilas}}>👥 Mes recrues</div>
            <div style={{fontSize:".75rem",fontWeight:700,color:pctRecrues>=100?C.vert:C.brun}}>{objPerso.recruesReal||0} / {objPerso.recruesObj} · {pctRecrues}%</div>
          </div>
          <div style={{height:5,background:C.pale,borderRadius:10,overflow:"hidden"}}>
            <div style={{height:"100%",background:pctRecrues>=100?C.vert:C.lilas,width:pctRecrues+"%",borderRadius:10,transition:"width .4s"}}/>
          </div>
        </div>
      )}

      {!hasObjCA&&!hasObjRecrues&&(
        <div style={{background:"rgba(196,154,138,.08)",border:`1px solid ${C.pale}`,borderRadius:10,padding:".7rem 1rem",marginBottom:".75rem",fontSize:".74rem",color:C.brun,lineHeight:1.6}}>
          💡 Définis tes objectifs du mois dans <strong>Tableau de bord → Mes objectifs</strong> pour les voir apparaître ici chaque jour.
        </div>
      )}

      {/* Citation du jour */}
      <div style={{background:`linear-gradient(135deg, rgba(196,154,138,.12), rgba(168,155,181,.08))`,border:`1px solid ${C.pale}`,borderRadius:14,padding:"1.1rem",textAlign:"center"}}>
        <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".18em",color:C.rose,marginBottom:".5rem"}}>✦ PENSÉE DU JOUR ✦</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",fontStyle:"italic",color:C.brun,lineHeight:1.65}}>"{citation}"</div>
      </div>
    </div>
  );
}

// ── SUIVI RECRUES COMPONENT ───────────────────────────────────────────────────
const CHECKLIST_BLOCKS=[
  {day:"J+1",color:"#B04040",title:"Accueil immédiat",tasks:[
    {id:"c1",label:"Message de bienvenue vocal ou vidéo envoyé"},
    {id:"c2",label:"Accès Formation Démarrage Rapide transmis"},
    {id:"c3",label:"Date du call de suivi fixée"},
    {id:"c4",label:"Exercices expliqués (liste 20 / profil / story)"},
  ]},
  {day:"J+2",color:"#8B5E00",title:"Formation & exercices",tasks:[
    {id:"c5",label:"Formation terminée — vérifier avec elle"},
    {id:"c6",label:"Liste des 20 contacts réalisée"},
    {id:"c7",label:"Profil optimisé (photo + bio + lien)"},
    {id:"c8",label:"Première story publiée"},
    {id:"c9",label:"Call démarrage 30 min réalisé"},
  ]},
  {day:"J+3",color:"#4A4A9C",title:"Intégration équipe",tasks:[
    {id:"c10",label:"Ajoutée au groupe Facebook Blazing Dynasty"},
    {id:"c11",label:"Ajoutée au canal Telegram"},
    {id:"c12",label:"Accès site de formation transmis"},
    {id:"c13",label:"Présentée à la communauté"},
    {id:"c14",label:"Premier contact prospect approché"},
  ]},
  {day:"S1",color:"#5C8A60",title:"Semaine 1 — Premiers résultats",tasks:[
    {id:"c15",label:"1 story par jour (vie quotidienne)"},
    {id:"c16",label:"5+ personnes contactées en message personnel"},
    {id:"c17",label:"1 présentation de l'opportunité faite"},
    {id:"c18",label:"Première vente OU premier recrutement ✨"},
    {id:"c19",label:"Point de suivi hebdomadaire effectué"},
  ]},
  {day:"S2-4",color:"#6B5B8A",title:"Semaines 2-4 — Routine & croissance",tasks:[
    {id:"c20",label:"Contenu régulier publié (3x/semaine minimum)"},
    {id:"c21",label:"Sprint 7j complété dans l'appli"},
    {id:"c22",label:"Premier café ou Zoom découverte organisé"},
    {id:"c23",label:"2ᵉ vente ou 1ʳᵉ recrue dans son équipe"},
    {id:"c24",label:"Formation produits avancée suivie"},
    {id:"c25",label:"Bilan du mois réalisé avec distributrice"},
  ]},
];

const ALL_TASK_IDS=CHECKLIST_BLOCKS.flatMap(b=>b.tasks.map(t=>t.id));
const MAX_RECRUES=15;

function getProgress(r){
  const done=ALL_TASK_IDS.filter(id=>r.checks&&r.checks[id]).length;
  return{done,total:ALL_TASK_IDS.length,pct:Math.round(done/ALL_TASK_IDS.length*100)};
}

function phaseLabel(pct){
  if(pct===0)return{label:"Pas encore démarrée",col:C.gris};
  if(pct<30)return{label:"Démarrage J+1/J+2",col:"#B04040"};
  if(pct<60)return{label:"Intégration en cours",col:"#8B5E00"};
  if(pct<85)return{label:"Semaine 1 active",col:C.rose};
  if(pct<100)return{label:"En pleine progression",col:C.lilas};
  return{label:"Parcours complété 🎉",col:C.vert};
}

function RecrueFiche({recrue,onToggle,onRemove,uid,userName}){
  const[openBlocks,setOpenBlocks]=useState({"J+1":true});
  const[confirmDel,setConfirmDel]=useState(false);
  const[confettiTrigger,setConfettiTrigger]=useState(0);
  const{done,total,pct}=getProgress(recrue);
  const ph=phaseLabel(pct);

  useEffect(()=>{
    if(pct===100){
      setConfettiTrigger(t=>t+1);
      if(uid&&userName){
        postToWallOfFame(uid, userName, `a terminé le parcours d'onboarding de sa recrue ${recrue.name} ! 🎉`, "🌟");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pct]);

  return(
    <div>
      <Confetti trigger={confettiTrigger}/>
      {/* Header */}
      <div style={{background:C.brun,borderRadius:14,padding:"1rem 1.1rem",marginBottom:"1rem",display:"flex",alignItems:"center",gap:".85rem"}}>
        <div style={{width:42,height:42,borderRadius:"50%",background:C.rose,color:"white",fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {recrue.name[0].toUpperCase()}
        </div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,color:C.blanc}}>{recrue.name}</div>
          <div style={{fontSize:".62rem",color:C.pale,opacity:.75}}>Entrée le {recrue.date}</div>
          <div style={{fontSize:".65rem",fontWeight:700,color:ph.col,marginTop:".15rem"}}>{ph.label}</div>
        </div>
        <div style={{textAlign:"right",marginRight:".4rem"}}>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.4rem",fontWeight:600,color:pct===100?C.vert:C.or,lineHeight:1}}>{pct}%</div>
          <div style={{fontSize:".58rem",color:C.pale,opacity:.7}}>{done}/{total}</div>
        </div>
        {!confirmDel
          ? <button onClick={()=>setConfirmDel(true)} style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:6,padding:".3rem .5rem",color:C.pale,cursor:"pointer",fontSize:".7rem",fontFamily:"inherit",flexShrink:0}}>✕</button>
          : <div style={{display:"flex",gap:".3rem",flexShrink:0}}>
              <button onClick={()=>onRemove(recrue.id)} style={{background:"#B04040",border:"none",borderRadius:6,padding:".3rem .55rem",color:"white",cursor:"pointer",fontSize:".65rem",fontFamily:"inherit"}}>Supprimer</button>
              <button onClick={()=>setConfirmDel(false)} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:6,padding:".3rem .55rem",color:C.pale,cursor:"pointer",fontSize:".65rem",fontFamily:"inherit"}}>Annuler</button>
            </div>
        }
      </div>

      {/* Barre globale */}
      <div style={{marginBottom:"1rem"}}>
        <div style={{height:6,background:C.pale,borderRadius:10,overflow:"hidden"}}>
          <div style={{height:"100%",background:pct===100?C.vert:C.rose,width:pct+"%",borderRadius:10,transition:"width .4s"}}/>
        </div>
      </div>

      <div style={{background:"linear-gradient(135deg,rgba(196,154,138,.1),rgba(168,155,181,.07))",border:`1px solid ${C.pale}`,borderRadius:10,padding:".75rem 1rem",marginBottom:"1rem",fontSize:".74rem",color:C.texte,lineHeight:1.65}}>
        🏆 Objectif : 1 première vente ou 1 premier recrutement dans les 7 premiers jours.
      </div>

      {/* Blocs checklist */}
      {CHECKLIST_BLOCKS.map(block=>{
        const isOpen=openBlocks[block.day];
        const blockDone=block.tasks.filter(t=>recrue.checks&&recrue.checks[t.id]).length;
        const blockPct=Math.round(blockDone/block.tasks.length*100);
        return(
          <div key={block.day} style={{background:C.blanc,border:`1px solid ${isOpen?C.rose:C.pale}`,borderRadius:14,marginBottom:".6rem",overflow:"hidden",transition:"all .2s"}}>
            <div onClick={()=>setOpenBlocks(p=>({...p,[block.day]:!p[block.day]}))}
              style={{padding:".75rem 1rem",display:"flex",alignItems:"center",gap:".6rem",cursor:"pointer",userSelect:"none"}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:blockPct===100?C.vert:block.color,color:"white",fontSize:".65rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {blockPct===100?"✓":block.day}
              </div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:C.brun}}>{block.title}</div>
                <div style={{fontSize:".58rem",color:C.gris}}>{blockDone}/{block.tasks.length} · {blockPct}%</div>
              </div>
              <div style={{width:48,height:4,background:C.pale,borderRadius:10,overflow:"hidden",flexShrink:0}}>
                <div style={{height:"100%",background:blockPct===100?C.vert:block.color,width:blockPct+"%",borderRadius:10,transition:"width .3s"}}/>
              </div>
              <div style={{color:C.rose,fontSize:".65rem",transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s",flexShrink:0}}>▼</div>
            </div>
            {isOpen&&(
              <div style={{borderTop:`1px solid ${C.pale}`,padding:".6rem 1rem .8rem"}}>
                {block.tasks.map(task=>{
                  const checked=recrue.checks&&recrue.checks[task.id];
                  return(
                    <div key={task.id} onClick={()=>onToggle(recrue.id,task.id)}
                      style={{display:"flex",alignItems:"flex-start",gap:".55rem",padding:".42rem 0",borderBottom:`1px solid rgba(232,213,204,.3)`,cursor:"pointer"}}>
                      <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${checked?block.color:C.rose}`,background:checked?block.color:"transparent",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
                        {checked&&<span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>}
                      </div>
                      <div style={{fontSize:".75rem",color:checked?C.gris:C.texte,textDecoration:checked?"line-through":"none",lineHeight:1.45,flex:1}}>{task.label}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SuiviRecruTab({uid}){
  const[recrues,setRecrues]=useState([]);
  const[activeId,setActiveId]=useState(null);
  const[newName,setNewName]=useState("");
  const[newDate,setNewDate]=useState("");
  const[loaded,setLoaded]=useState(false);
  const[filleulesRecentes,setFilleulesRecentes]=useState([]);
  const[sortieDemarrage,setSortieDemarrage]=useState([]);
  const[search,setSearch]=useState("");

  useEffect(()=>{
    sgAll(uid).then(data=>{
      if(data["recrues"]){
        const d=JSON.parse(data["recrues"]);
        setRecrues(d);
        if(d.length>0)setActiveId(d[0].id);
      }
      if(data["sortie-demarrage"]){
        try{setSortieDemarrage(JSON.parse(data["sortie-demarrage"]));}catch{}
      }
      setLoaded(true);
    });
    // Filleules directes inscrites depuis moins de 2 mois (annuaire/marraine)
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"equipe","annuaire"));
        const annuaire=snap.exists()?snap.data().membres||{}:{};
        const seuil = Date.now() - 60*86400000;
        const recentes = Object.values(annuaire).filter(m=>
          m.marraine===uid && m.dateEnreg && new Date(m.dateEnreg).getTime()>=seuil
        );
        setFilleulesRecentes(recentes);
      }catch{}
    })();
  },[uid]);

  const sortirDuDemarrage=(mUid)=>{
    const next=[...sortieDemarrage, mUid];
    setSortieDemarrage(next);
    ss(uid,"sortie-demarrage",JSON.stringify(next));
  };

  const saveRecrues=(r)=>{setRecrues(r);ss(uid,"recrues",JSON.stringify(r));};

  const addRecrue=()=>{
    if(!newName.trim()||recrues.length>=MAX_RECRUES)return;
    const r={id:Date.now(),name:newName.trim(),date:newDate||new Date().toLocaleDateString("fr-FR"),checks:{}};
    const next=[...recrues,r];
    saveRecrues(next);
    setActiveId(r.id);
    setNewName("");setNewDate("");
  };

  const toggleCheck=(rid,tid)=>{
    const next=recrues.map(r=>{
      if(r.id!==rid)return r;
      const checks={...r.checks,[tid]:!r.checks[tid]};
      return{...r,checks};
    });
    saveRecrues(next);
  };

  const removeRecrue=(rid)=>{
    const next=recrues.filter(r=>r.id!==rid);
    saveRecrues(next);
    setActiveId(next.length>0?next[0].id:null);
  };

  // Démarre le suivi d'onboarding d'une filleule auto-détectée (si pas déjà présente)
  const fmtUid=(u)=>u.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
  const startTrackingFilleule=(m)=>{
    const name=fmtUid(m.uid);
    const existing=recrues.find(r=>r.name.toLowerCase()===name.toLowerCase());
    if(existing){setActiveId(existing.id);return;}
    if(recrues.length>=MAX_RECRUES)return;
    const r={id:Date.now(),name,date:m.dateEnreg?new Date(m.dateEnreg).toLocaleDateString("fr-FR"):new Date().toLocaleDateString("fr-FR"),checks:{}};
    const next=[...recrues,r];
    saveRecrues(next);
    setActiveId(r.id);
  };

  const active=recrues.find(r=>r.id===activeId)||null;

  if(!loaded)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Suivi <em style={{fontStyle:"italic",color:C.rose}}>Nouveaux Distributeurs</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Jusqu'à {MAX_RECRUES} recrues simultanées. Sélectionne une recrue pour voir et cocher ses étapes.
      </p>

      {/* Filleules récentes auto-détectées (<2 mois) */}
      {filleulesRecentes.filter(m=>!sortieDemarrage.includes(m.uid)).length>0&&(
        <div style={{background:"rgba(168,155,181,.08)",border:`1px solid ${C.lilas}40`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.lilas,marginBottom:".5rem"}}>
            🌸 Tes nouvelles filleules (moins de 2 mois)
          </div>
          {filleulesRecentes.filter(m=>!sortieDemarrage.includes(m.uid)).map(m=>{
            const name=fmtUid(m.uid);
            const dejaSuivie=recrues.some(r=>r.name.toLowerCase()===name.toLowerCase());
            return(
              <div key={m.uid} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:".4rem 0",borderBottom:`1px solid ${C.pale}`,gap:".4rem"}}>
                <div>
                  <div style={{fontSize:".78rem",fontWeight:600,color:C.brun}}>{name}</div>
                  <div style={{fontSize:".6rem",color:C.gris}}>Inscrite le {new Date(m.dateEnreg).toLocaleDateString("fr-FR")}</div>
                </div>
                <div style={{display:"flex",gap:".35rem",flexShrink:0}}>
                  <button onClick={()=>startTrackingFilleule(m)}
                    style={{background:dejaSuivie?C.vert+"20":C.lilas,color:dejaSuivie?C.vert:"white",border:"none",borderRadius:8,padding:".35rem .65rem",fontSize:".68rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                    {dejaSuivie?"✓ Suivie":"Suivre l'onboarding"}
                  </button>
                  <button onClick={()=>sortirDuDemarrage(m.uid)} title="Cette personne est déjà bien installée — la sortir du démarrage"
                    style={{background:"none",border:`1px solid ${C.pale}`,color:C.gris,borderRadius:8,padding:".35rem .55rem",fontSize:".64rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap"}}>
                    → Sortir du démarrage
                  </button>
                </div>
              </div>
            );
          })}
          <div style={{fontSize:".6rem",color:C.gris,marginTop:".4rem",fontStyle:"italic"}}>
            Après 2 mois, ou si tu cliques "Sortir du démarrage", elles n'apparaîtront plus que dans l'onglet Distributeurs.
          </div>
        </div>
      )}

      {/* Ajouter */}
      {recrues.length<MAX_RECRUES&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>
            ➕ Ajouter une recrue ({recrues.length}/{MAX_RECRUES})
          </div>
          <div style={{display:"flex",gap:".5rem",marginBottom:".5rem"}}>
            <input placeholder="Prénom" value={newName} onChange={e=>setNewName(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&addRecrue()}
              style={{flex:2,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
            <input type="date" value={newDate} onChange={e=>setNewDate(e.target.value)}
              style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".75rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
          </div>
          <button onClick={addRecrue} disabled={!newName.trim()}
            style={{width:"100%",background:newName.trim()?C.brun:C.pale,color:newName.trim()?C.blanc:C.gris,border:"none",borderRadius:8,padding:".52rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:newName.trim()?"pointer":"default",transition:"all .2s"}}>
            Ajouter
          </button>
        </div>
      )}
      {recrues.length>=MAX_RECRUES&&(
        <div style={{background:"rgba(196,154,138,.1)",border:`1px solid ${C.rose}`,borderRadius:10,padding:".65rem 1rem",marginBottom:"1rem",fontSize:".74rem",color:C.brun}}>
          ✨ 15 recrues suivies — maximum atteint. Supprime-en une pour en ajouter une nouvelle.
        </div>
      )}

      {/* Sélecteur recrues */}
      {recrues.length>0&&(
        <>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.gris,marginBottom:".5rem"}}>
            Mes recrues ({recrues.length})
          </div>
          <input placeholder="🔍 Rechercher une recrue..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .7rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".5rem",boxSizing:"border-box"}}/>
          <div style={{display:"flex",flexWrap:"wrap",gap:".4rem",marginBottom:"1rem"}}>
            {recrues.filter(r=>!search||r.name.toLowerCase().includes(search.toLowerCase())).map(r=>{
              const{pct}=getProgress(r);
              const isActive=activeId===r.id;
              return(
                <div key={r.id} onClick={()=>setActiveId(r.id)}
                  style={{display:"flex",alignItems:"center",gap:".45rem",background:isActive?C.brun:C.blanc,border:`2px solid ${isActive?C.rose:C.pale}`,borderRadius:10,padding:".42rem .7rem",cursor:"pointer",transition:"all .2s",flexShrink:0}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:isActive?"rgba(255,255,255,.12)":C.creme,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative"}}>
                    <svg width="28" height="28" style={{position:"absolute",top:0,left:0,transform:"rotate(-90deg)"}}>
                      <circle cx="14" cy="14" r="11" fill="none" stroke={isActive?"rgba(255,255,255,.18)":C.pale} strokeWidth="2.5"/>
                      <circle cx="14" cy="14" r="11" fill="none" stroke={pct===100?C.vert:C.rose} strokeWidth="2.5"
                        strokeDasharray={`${2*Math.PI*11*pct/100} ${2*Math.PI*11*(1-pct/100)}`} strokeLinecap="round"/>
                    </svg>
                    <span style={{fontSize:".55rem",fontWeight:700,color:isActive?C.blanc:C.brun,position:"relative",zIndex:1}}>{pct}%</span>
                  </div>
                  <div>
                    <div style={{fontSize:".77rem",fontWeight:600,color:isActive?C.blanc:C.brun}}>{r.name}</div>
                    <div style={{fontSize:".57rem",color:isActive?C.pale:C.gris}}>{r.date}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Fiche de la recrue active */}
          {active&&(
            <RecrueFiche
              recrue={active}
              onToggle={toggleCheck}
              onRemove={removeRecrue}
              uid={uid}
              userName={uid.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")}
            />
          )}
        </>
      )}

      {recrues.length===0&&(
        <div style={{textAlign:"center",padding:"3rem 1rem",color:C.gris}}>
          <div style={{fontSize:"2rem",marginBottom:".75rem"}}>👥</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",color:C.brun,marginBottom:".4rem"}}>Aucune recrue pour l'instant</div>
          <div style={{fontSize:".75rem",lineHeight:1.6}}>Ajoute ta première recrue ci-dessus pour commencer à suivre son parcours.</div>
        </div>
      )}
    </div>
  );
}
function DashboardTab({uid, goToFormation}){
  const[dtab,setDtab]=useState("today");
  const[actions,setActions]=useState({});
  const[prospects,setProspects]=useState([]);
  const[newP,setNewP]=useState({name:"",statut:"Nouveau",note:"",interet:""});
  const[prospectSearch,setProspectSearch]=useState("");
  const[prospectFiltre,setProspectFiltre]=useState("Tous");
  const[prospectInteretFiltre,setProspectInteretFiltre]=useState("");
  const[posts,setPosts]=useState([]);
  const[newPost,setNewPost]=useState({type:"Post",sujet:"",fait:false});
  const[stats,setStats]=useState({messages:"",reponses:"",presentations:"",ventes:"",recrues:"",objectif:"2"});
  const[clients,setClients]=useState([]);
  const[distributeurs,setDistributeurs]=useState([]);
  const[objPerso,setObjPerso]=useState({ca:"",caObj:"",palier:"2%",recruesObj:"0"});
  const[isChefDash,setIsChefDash]=useState(false);
  const[loaded,setLoaded]=useState(false);
  const[totalRecrues,setTotalRecrues]=useState(0);
  const[streak,setStreak]=useState(0);
  const[totalActionsValidees,setTotalActionsValidees]=useState(0);
  const[confettiTrigger,setConfettiTrigger]=useState(0);
  const[equipeFunTab,setEquipeFunTab]=useState("wall");
  const[clientsSubTab,setClientsSubTab]=useState("clients");
  const[distriSubTab,setDistriSubTab]=useState("distributeurs");
  const[fastStartDone,setFastStartDone]=useState(false);
  const[mood,setMood]=useState(null);
  const userName = uid.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");

  useEffect(()=>{
    sgAll(uid).then(data=>{
      if(data["db-actions"])       setActions(JSON.parse(data["db-actions"]));
      if(data["db-prospects"])     setProspects(JSON.parse(data["db-prospects"]));
      if(data["db-posts"])         setPosts(JSON.parse(data["db-posts"]));
      if(data["db-stats"])         setStats(JSON.parse(data["db-stats"]));
      if(data["db-clients"])       setClients(JSON.parse(data["db-clients"]));
      if(data["db-distributeurs"]) setDistributeurs(JSON.parse(data["db-distributeurs"]));
      if(data["db-obj-perso"])     setObjPerso(JSON.parse(data["db-obj-perso"]));
      if(data["recrues"]){
        try{ setTotalRecrues(JSON.parse(data["recrues"]).length); }catch{}
      }
      if(data["db-actions-cumul"]) setTotalActionsValidees(+data["db-actions-cumul"]||0);
      if(data["db-fast-start"]){
        try{
          const fs=JSON.parse(data["db-fast-start"]);
          const totalTaches=FAST_START_DAYS.reduce((s,d)=>s+d.taches.length,0);
          const totalDone=Object.values(fs.doneTasks||{}).filter(Boolean).length;
          setFastStartDone(fs.startDate && totalDone>=totalTaches);
        }catch{}
      }

      // Calcul du streak de connexion quotidienne
      const today = new Date().toISOString().slice(0,10);
      const lastLogin = data["db-last-login"];
      let newStreak = +data["db-streak"] || 0;
      if(lastLogin !== today){
        const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
        newStreak = (lastLogin===yesterday) ? newStreak+1 : 1;
        ss(uid,"db-streak",String(newStreak));
        ss(uid,"db-last-login",today);
      }
      setStreak(newStreak);

      setLoaded(true);
    });
    // Vérifier si chef d'équipe
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"acces","membres"));
        const chefs=snap.exists()?snap.data().chefs||[]:[];
        setIsChefDash(chefs.includes(uid.replace(/-/g," ")));
      }catch{}
    })();
  },[uid]);

  const saveActions=(a, justChecked)=>{
    setActions(a);ss(uid,"db-actions",JSON.stringify(a));
    if(justChecked){
      const newCumul = totalActionsValidees+1;
      setTotalActionsValidees(newCumul);
      ss(uid,"db-actions-cumul",String(newCumul));
      const newDone = todayActions.filter(act=>a[act.id]).length;
      if(newDone===5) setConfettiTrigger(t=>t+1);
    }
  };
  const saveProspects=p=>{setProspects(p);ss(uid,"db-prospects",JSON.stringify(p));};
  const savePosts=p=>{setPosts(p);ss(uid,"db-posts",JSON.stringify(p));};
  const saveStats=s=>{setStats(s);ss(uid,"db-stats",JSON.stringify(s));};
  const saveClients=c=>{setClients(c);ss(uid,"db-clients",JSON.stringify(c));};
  const saveDistributeurs=d=>{setDistributeurs(d);ss(uid,"db-distributeurs",JSON.stringify(d));};
  const saveObjPerso=o=>{setObjPerso(o);ss(uid,"db-obj-perso",JSON.stringify(o));syncAnnuaire(uid,userName,o);};

  const todayActions=[
    {id:"a1",icon:"📝",label:"Publier mon post du jour",sub:"1 contenu fort — photo, Reel ou carrousel"},
    {id:"a2",icon:"💬",label:"Envoyer 5 messages de suivi",sub:"Personnes qui ont liké, commenté ou vu mes stories"},
    {id:"a3",icon:"🤝",label:"Interagir avec 10 comptes ciblés",sub:"Femmes qui correspondent à ma cible — vrais commentaires"},
    {id:"a4",icon:"❓",label:'Story "question du jour"',sub:"Une question simple pour générer des réponses en DM"},
    {id:"a5",icon:"📋",label:"Mettre à jour mes prospects",sub:"Relances, nouveaux contacts, statuts à jour"},
  ];
  const doneCount=todayActions.filter(a=>actions[a.id]).length;
  const displayedActions = (mood==="depasse")
    ? todayActions.filter(a=>!actions[a.id]).slice(0,1).concat(todayActions.filter(a=>actions[a.id]))
    : todayActions;

  const pctCAGauge = (()=>{
    if(!objPerso.caObj||!objPerso.ca)return 0;
    return Math.round(+objPerso.ca/+objPerso.caObj*100);
  })();
  const pctRecruesGauge = (()=>{
    if(!objPerso.recruesObj||objPerso.recruesObj==="0"||!objPerso.recruesReal)return 0;
    return Math.round(+objPerso.recruesReal/+objPerso.recruesObj*100);
  })();
  const badgeData = {
    totalActionsValidees, totalRecrues, streak,
    pctCA: pctCAGauge, pctRecrues: pctRecruesGauge,
    ca: +objPerso.ca||0, doneCount,
  };
  const badges = computeBadges(badgeData);

  const todayStr = new Date().toISOString().slice(0,10);
  const aRecontacterAujourdhui = prospects.filter(p=>p.relance && p.relance<=todayStr);

  const ordreInteret={client:0, distributeur:1, "":2};
  const prospectsFiltres = prospects
    .filter(p=>prospectFiltre==="Tous"||p.statut===prospectFiltre)
    .filter(p=>{
      if(!prospectInteretFiltre)return true;
      if(prospectInteretFiltre==="none")return !p.interet;
      return p.interet===prospectInteretFiltre;
    })
    .filter(p=>!prospectSearch.trim()||p.name.toLowerCase().includes(prospectSearch.trim().toLowerCase())||(p.note||"").toLowerCase().includes(prospectSearch.trim().toLowerCase()))
    .slice()
    .sort((a,b)=>{
      const aToday = a.relance && a.relance<=todayStr;
      const bToday = b.relance && b.relance<=todayStr;
      if(aToday&&!bToday)return -1;
      if(bToday&&!aToday)return 1;
      const oa=ordreInteret[a.interet||""], ob=ordreInteret[b.interet||""];
      if(oa!==ob) return oa-ob;
      if(a.relance&&b.relance)return a.relance<b.relance?-1:1;
      if(a.relance)return -1;
      if(b.relance)return 1;
      return 0;
    });

  // Annonce automatique sur le Wall of Fame quand un nouveau badge est débloqué
  useEffect(()=>{
    if(!loaded) return;
    const unlockedIds = badges.filter(b=>b.unlocked).map(b=>b.id);
    if(unlockedIds.length===0) return;
    sg(uid,"db-badges-unlocked").then(stored=>{
      const prev = stored ? JSON.parse(stored) : [];
      const nouveaux = unlockedIds.filter(id=>!prev.includes(id));
      if(nouveaux.length>0){
        nouveaux.forEach(id=>{
          const b = BADGES_DEF.find(x=>x.id===id);
          if(b) postToWallOfFame(uid, userName, `vient de débloquer le badge ${b.icon} "${b.label}" !`, "🏅");
        });
        ss(uid,"db-badges-unlocked",JSON.stringify(unlockedIds));
      } else if(unlockedIds.length!==prev.length){
        ss(uid,"db-badges-unlocked",JSON.stringify(unlockedIds));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[loaded, badges.filter(b=>b.unlocked).map(b=>b.id).join(",")]);

  const STATUTS=["Nouveau","Contact fait","🔥 Chaud","🌡️ Tiède","❄️ Froid","📅 Invité présentation","👀 En réflexion","✅ Converti","❌ Pas intéressé"];
  const statusColor={"Nouveau":C.gris,"Contact fait":C.lilas,"🔥 Chaud":"#C44B1A","🌡️ Tiède":C.or,"❄️ Froid":"#5B8DB8","📅 Invité présentation":C.rose,"👀 En réflexion":"#8B5E00","✅ Converti":C.vert,"❌ Pas intéressé":"#B04040"};

  const DTABS=[
    {id:"today",label:"⚡ Aujourd'hui"},
    {id:"objperso",label:"🎯 Mes objectifs"},
    ...(!fastStartDone?[{id:"faststart",label:"🚀 Fast Start"}]:[]),
    {id:"clients",label:"🛍️ Clients"},
    {id:"distributeurs",label:"👑 Distributeurs"},
    {id:"prospects",label:"👥 Prospects"},
    {id:"diagnostics",label:"🩺 Mes diagnostics"},
    {id:"produits",label:"🔍 Produits"},
    {id:"posts",label:"📱 Posts"},
    {id:"equipe-fun",label:"🏆 Équipe"},
  ];

  return(
    <div>
      <SecTitle title="Tableau" em="de bord" desc="Tes actions quotidiennes · Tes prospects · Tes publications · Tes stats."/>

      {/* Sub-nav */}
      <div style={{display:"flex",gap:".3rem",marginBottom:"1rem",overflowX:"auto",paddingBottom:".3rem"}}>
        {DTABS.map(t=>(
          <button key={t.id} onClick={()=>setDtab(t.id)}
            style={{flex:"none",padding:".5rem .9rem",fontSize:".68rem",fontWeight:600,borderRadius:20,border:`1px solid ${dtab===t.id?C.rose:C.pale}`,background:dtab===t.id?C.rose:C.blanc,color:dtab===t.id?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",transition:"all .2s"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* FAST START J1-J7 */}
      {dtab==="faststart"&&<FastStartTab uid={uid} userName={userName} goToFormation={goToFormation}/>}

      {/* TODAY */}
      {dtab==="today"&&(
        <div>
          <Confetti trigger={confettiTrigger}/>
          <MarrainePopup uid={uid} userName={userName}/>
          <AnnonceBanner uid={uid}/>
          {aRecontacterAujourdhui.length>0&&(
            <div onClick={()=>setDtab("prospects")}
              style={{background:"linear-gradient(135deg,#C44B1A,#C49A8A)",borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem",cursor:"pointer"}}>
              <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"white",marginBottom:".3rem"}}>📞 À recontacter aujourd'hui</div>
              <div style={{fontSize:".78rem",color:"white",fontWeight:600}}>
                {aRecontacterAujourdhui.length} prospect{aRecontacterAujourdhui.length>1?"s":""} : {aRecontacterAujourdhui.slice(0,3).map(p=>p.name).join(", ")}{aRecontacterAujourdhui.length>3?"...":""}
              </div>
              <div style={{fontSize:".62rem",color:"rgba(255,255,255,.85)",marginTop:".2rem"}}>Touche pour voir tes prospects →</div>
            </div>
          )}
          <JaugeSucces pctCA={pctCAGauge} pctRecrues={pctRecruesGauge}/>
          <BadgesPanel badges={badges}/>
          {streak>=2&&(
            <div style={{display:"flex",alignItems:"center",gap:".4rem",background:"rgba(196,168,130,.15)",border:`1px solid ${C.or}40`,borderRadius:10,padding:".5rem .8rem",marginBottom:"1rem",fontSize:".72rem",color:C.brun}}>
              <span style={{fontSize:"1.1rem"}}>🔥</span>
              <span><strong>{streak} jours</strong> de connexion d'affilée — continue comme ça !</span>
            </div>
          )}
          <CitationDuJour uid={uid}/>
          <MoodCheck uid={uid} onMoodChange={setMood}/>
          <div style={{background:C.brun,borderRadius:14,padding:"1.1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".15em",textTransform:"uppercase",color:C.or,marginBottom:".4rem"}}>
              ⚡ {mood==="depasse"?"AUJOURD'HUI, UNE SEULE ACTION":"MES 5 ACTIONS DU JOUR"}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:".62rem",color:C.pale,marginBottom:".35rem"}}>
              <span>Progression</span><span style={{fontWeight:700,color:doneCount===5?C.vert:C.or}}>{doneCount} / 5</span>
            </div>
            <div style={{height:5,background:"rgba(255,255,255,.1)",borderRadius:10,overflow:"hidden",marginBottom:".75rem"}}>
              <div style={{height:"100%",background:doneCount===5?C.vert:C.rose,width:(doneCount/5*100)+"%",borderRadius:10,transition:"width .3s"}}/>
            </div>
            {displayedActions.map(a=>(
              <div key={a.id} onClick={()=>saveActions({...actions,[a.id]:!actions[a.id]}, !actions[a.id])}
                style={{display:"flex",gap:".65rem",padding:".6rem 0",borderBottom:`1px solid rgba(196,154,138,.2)`,cursor:"pointer",alignItems:"flex-start"}}>
                <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${actions[a.id]?C.rose:C.pale+"80"}`,background:actions[a.id]?C.rose:"transparent",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
                  {actions[a.id]&&<span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:".78rem",fontWeight:600,color:actions[a.id]?C.gris:C.blanc,textDecoration:actions[a.id]?"line-through":"none"}}>{a.icon} {a.label}</div>
                  <div style={{fontSize:".65rem",color:C.pale,opacity:.7,marginTop:".1rem"}}>{a.sub}</div>
                </div>
              </div>
            ))}
            {mood==="depasse"&&doneCount<5&&(
              <div style={{fontSize:".66rem",color:C.pale,opacity:.8,marginTop:".5rem",fontStyle:"italic"}}>
                Les autres actions reviendront demain — concentre-toi sur celle-ci, c'est déjà énorme 💛
              </div>
            )}
          </div>


          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>🔄 Réactivation base existante</div>
            <p style={{fontSize:".75rem",color:C.texte,lineHeight:1.65}}>Contacter 10 anciens silencieux cette semaine.</p>
            <div style={{background:C.creme,borderLeft:`3px solid ${C.lilas}`,borderRadius:"0 8px 8px 0",padding:".5rem .75rem",fontSize:".73rem",fontStyle:"italic",color:C.texte,lineHeight:1.7,marginTop:".5rem"}}>
              "Coucou, ça fait longtemps ! Comment tu vas ?"
              <CopyBtn text="Coucou, ça fait longtemps ! Comment tu vas ?"/>
            </div>
          </div>

          <div style={{background:`linear-gradient(135deg,rgba(196,154,138,.1),rgba(196,168,130,.08))`,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem 1rem",textAlign:"center"}}>
            <div style={{fontSize:".75rem",color:C.brun,fontStyle:"italic",lineHeight:1.65}}>
              💡 <strong>"Posts = attirer. Actions quotidiennes = convertir.<br/>Les deux ensemble, c'est là que ça décolle."</strong>
            </div>
          </div>
        </div>
      )}

      {/* PROSPECTS */}
      {dtab==="prospects"&&(
        <div>
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".65rem"}}>➕ Ajouter un prospect ({prospects.length})</div>
            <input placeholder="Prénom" value={newP.name} onChange={e=>setNewP(p=>({...p,name:e.target.value}))}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .7rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".45rem"}}/>
            <select value={newP.statut} onChange={e=>setNewP(p=>({...p,statut:e.target.value}))}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .7rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".45rem"}}>
              {STATUTS.map(s=><option key={s}>{s}</option>)}
            </select>
            <select value={newP.interet} onChange={e=>setNewP(p=>({...p,interet:e.target.value}))}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .7rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".45rem"}}>
              <option value="">Intérêt : non défini</option>
              <option value="client">🛍️ Intéressée par les produits (cliente)</option>
              <option value="distributeur">👑 Intéressée par l'activité (distributrice)</option>
            </select>
            <input placeholder="Note (optionnel)" value={newP.note} onChange={e=>setNewP(p=>({...p,note:e.target.value}))}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .7rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".65rem"}}/>
            <button onClick={()=>{
              if(!newP.name.trim())return;
              const next=[{...newP,id:Date.now(),date:new Date().toLocaleDateString("fr-FR"),relance:""},...prospects];
              saveProspects(next);setNewP({name:"",statut:"Nouveau",note:"",interet:""});
            }} style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".55rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              Ajouter le prospect
            </button>
          </div>

          {/* Navigation par dossier : Clients potentiels / Distributeurs potentiels / Non classé */}
          {!prospectInteretFiltre&&(
            <div>
              <div style={{fontSize:".68rem",color:C.gris,marginBottom:".6rem"}}>Choisis une catégorie pour voir tes prospects :</div>
              {[
                ["client","🛍️ Clients potentiels",C.rose],
                ["distributeur","👑 Distributeurs potentiels",C.lilas],
                ["none","📌 Non classé",C.gris],
              ].map(([val,label,col])=>{
                const count = prospects.filter(p=>(p.interet||"none")===val).length;
                return(
                  <div key={val} onClick={()=>setProspectInteretFiltre(val)}
                    style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".8rem 1rem",marginBottom:".5rem",cursor:"pointer"}}>
                    <div style={{fontFamily:"Georgia,serif",fontSize:".95rem",fontWeight:600,color:C.brun}}>{label}</div>
                    <div style={{display:"flex",alignItems:"center",gap:".4rem"}}>
                      <span style={{fontSize:".7rem",fontWeight:700,color:col,background:col+"15",borderRadius:20,padding:".15rem .6rem"}}>{count}</span>
                      <span style={{color:C.pale}}>›</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {prospectInteretFiltre&&(
          <div>
          <button onClick={()=>{setProspectInteretFiltre("");setProspectFiltre("Tous");setProspectSearch("");}}
            style={{background:"none",border:"none",color:C.rose,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:".2rem",marginBottom:".75rem"}}>
            ← Retour aux catégories
          </button>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,color:C.brun,marginBottom:".6rem"}}>
            {prospectInteretFiltre==="client"?"🛍️ Clients potentiels":prospectInteretFiltre==="distributeur"?"👑 Distributeurs potentiels":"📌 Non classé"}
          </div>

          {/* Recherche et filtres */}
          <input placeholder="🔍 Rechercher par nom ou note..." value={prospectSearch} onChange={e=>setProspectSearch(e.target.value)}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .7rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".5rem"}}/>
          <div style={{display:"flex",gap:".3rem",marginBottom:".75rem",overflowX:"auto",paddingBottom:".2rem"}}>
            {["Tous",...STATUTS].map(s=>(
              <button key={s} onClick={()=>setProspectFiltre(s)}
                style={{flex:"none",padding:".3rem .65rem",fontSize:".64rem",fontWeight:600,borderRadius:20,border:`1px solid ${prospectFiltre===s?C.rose:C.pale}`,background:prospectFiltre===s?C.rose:C.blanc,color:prospectFiltre===s?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                {s}
              </button>
            ))}
          </div>

          <div style={{fontSize:".62rem",color:C.gris,marginBottom:".5rem"}}>{prospectsFiltres.length} prospect{prospectsFiltres.length>1?"s":""}{prospectFiltre!=="Tous"||prospectSearch?` (filtré${prospectsFiltres.length>1?"s":""})`:""}</div>
          {prospectsFiltres.map(p=>{
            const isToday = p.relance && p.relance<=todayStr;
            return(
            <div key={p.id} style={{background:isToday?"rgba(196,74,26,.06)":C.blanc,border:`1px solid ${isToday?"#C44B1A60":C.pale}`,borderRadius:10,padding:".7rem .9rem",marginBottom:".45rem"}}>
              <div style={{display:"flex",gap:".65rem",alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:".5rem",alignItems:"center",marginBottom:".2rem",flexWrap:"wrap"}}>
                    <div style={{fontSize:".82rem",fontWeight:600,color:C.brun}}>{p.name}</div>
                    <select value={p.statut} onChange={e=>{
                      const next=prospects.map(x=>x.id===p.id?{...x,statut:e.target.value}:x);
                      saveProspects(next);
                    }} style={{fontSize:".6rem",fontWeight:700,padding:".1rem .4rem",borderRadius:20,border:`1px solid ${statusColor[p.statut]||C.pale}`,background:(statusColor[p.statut]||C.gris)+"20",color:statusColor[p.statut]||C.gris,fontFamily:"inherit",cursor:"pointer",outline:"none"}}>
                      {STATUTS.map(s=><option key={s}>{s}</option>)}
                    </select>
                    {isToday&&<span style={{fontSize:".58rem",fontWeight:700,color:"#C44B1A",background:"#C44B1A15",borderRadius:20,padding:".1rem .5rem"}}>📞 À recontacter</span>}
                    <select value={p.interet||""} onChange={e=>{
                      const next=prospects.map(x=>x.id===p.id?{...x,interet:e.target.value}:x);
                      saveProspects(next);
                    }} style={{fontSize:".6rem",fontWeight:600,padding:".1rem .4rem",borderRadius:20,border:`1px solid ${p.interet?C.lilas:C.pale}`,background:p.interet?C.lilas+"15":"transparent",color:p.interet?C.lilas:C.gris,fontFamily:"inherit",cursor:"pointer",outline:"none"}}>
                      <option value="">❔ Non défini</option>
                      <option value="client">🛍️ Cliente</option>
                      <option value="distributeur">👑 Distributrice</option>
                    </select>
                  </div>
                  {p.note&&<div style={{fontSize:".7rem",color:C.gris,fontStyle:"italic"}}>{p.note}</div>}
                  <div style={{fontSize:".6rem",color:C.pale,marginTop:".15rem"}}>Ajouté le {p.date}</div>
                </div>
                <button onClick={()=>saveProspects(prospects.filter(x=>x.id!==p.id))}
                  style={{background:"none",border:"none",color:C.pale,cursor:"pointer",fontSize:".8rem",flexShrink:0,padding:".2rem"}}>✕</button>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:".4rem",marginTop:".5rem",paddingTop:".5rem",borderTop:`1px solid ${C.pale}`}}>
                <span style={{fontSize:".62rem",color:C.gris}}>🔔 Relance :</span>
                <input type="date" value={p.relance||""} onChange={e=>{
                  const next=prospects.map(x=>x.id===p.id?{...x,relance:e.target.value}:x);
                  saveProspects(next);
                }} style={{border:`1px solid ${C.pale}`,borderRadius:6,padding:".25rem .4rem",fontSize:".68rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
                {p.relance&&(
                  <button onClick={()=>{
                    const next=prospects.map(x=>x.id===p.id?{...x,relance:""}:x);
                    saveProspects(next);
                  }} style={{background:"none",border:"none",color:C.gris,cursor:"pointer",fontSize:".62rem",fontFamily:"inherit",textDecoration:"underline"}}>
                    effacer
                  </button>
                )}
              </div>
            </div>
          );})}
          {prospectsFiltres.length===0&&<div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".78rem"}}>{prospects.length===0?<>Aucun prospect pour l'instant.<br/>Ajoute ta 1ʳᵉ personne ci-dessus.</>:"Aucun prospect ne correspond à ta recherche/filtre."}</div>}
          </div>
          )}
        </div>
      )}

      {/* PRODUITS */}
      {dtab==="produits"&&<ProduitsSearchTab/>}

      {/* CLIENTS (+ sous-onglet Objections) */}
      {dtab==="clients"&&(
        <div>
          <div style={{display:"flex",gap:".3rem",marginBottom:"1rem"}}>
            <button onClick={()=>setClientsSubTab("clients")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${clientsSubTab==="clients"?C.rose:C.pale}`,background:clientsSubTab==="clients"?C.rose:C.blanc,color:clientsSubTab==="clients"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              🛍️ Clients
            </button>
            <button onClick={()=>setClientsSubTab("objections")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${clientsSubTab==="objections"?C.rose:C.pale}`,background:clientsSubTab==="objections"?C.rose:C.blanc,color:clientsSubTab==="objections"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              💬 Objections
            </button>
          </div>
          {clientsSubTab==="clients"&&<ClientsTab clients={clients} save={saveClients}/>}
          {clientsSubTab==="objections"&&<ObjectionsTab/>}
        </div>
      )}
      {dtab==="objperso"&&(
        <div>
          <ObjPersoTab obj={objPerso} save={saveObjPerso} uid={uid} userName={userName}/>
          <button onClick={()=>setDtab("stats")}
            style={{width:"100%",background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".7rem",fontSize:".8rem",fontWeight:600,color:C.brun,fontFamily:"inherit",cursor:"pointer",marginTop:".5rem"}}>
            📊 Voir mes statistiques détaillées
          </button>
        </div>
      )}

      {/* ÉQUIPE - GAMIFICATION */}
      {dtab==="equipe-fun"&&(
        <div>
          <div style={{display:"flex",gap:".3rem",marginBottom:"1rem"}}>
            <button onClick={()=>setEquipeFunTab("wall")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${equipeFunTab==="wall"?C.rose:C.pale}`,background:equipeFunTab==="wall"?C.rose:C.blanc,color:equipeFunTab==="wall"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              🌟 Wall of Fame
            </button>
            <button onClick={()=>setEquipeFunTab("defi")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${equipeFunTab==="defi"?C.rose:C.pale}`,background:equipeFunTab==="defi"?C.rose:C.blanc,color:equipeFunTab==="defi"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              🚀 Défi Flash
            </button>
            <button onClick={()=>setEquipeFunTab("powerhour")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${equipeFunTab==="powerhour"?C.rose:C.pale}`,background:equipeFunTab==="powerhour"?C.rose:C.blanc,color:equipeFunTab==="powerhour"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              ⏱️ Power Hour
            </button>
          </div>
          {equipeFunTab==="wall"&&<WallOfFameTab uid={uid} userName={userName}/>}
          {equipeFunTab==="defi"&&<DefisTab uid={uid} userName={userName} canCreate={isChefDash||uid===MELISSA||uid==="melissa-da-silveira"}/>}
          {equipeFunTab==="powerhour"&&<PowerHourTab uid={uid} userName={userName} canCreate={isChefDash||uid===MELISSA||uid==="melissa-da-silveira"}/>}
        </div>
      )}
      {dtab==="diagnostics"&&<DiagResultsTab uid={uid}/>}

      {/* DISTRIBUTEURS (+ sous-onglet Nouveaux Distributeurs) */}
      {dtab==="distributeurs"&&(
        <div>
          <div style={{display:"flex",gap:".3rem",marginBottom:"1rem"}}>
            <button onClick={()=>setDistriSubTab("distributeurs")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${distriSubTab==="distributeurs"?C.rose:C.pale}`,background:distriSubTab==="distributeurs"?C.rose:C.blanc,color:distriSubTab==="distributeurs"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              👑 Distributeurs
            </button>
            <button onClick={()=>setDistriSubTab("nouveaux")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${distriSubTab==="nouveaux"?C.rose:C.pale}`,background:distriSubTab==="nouveaux"?C.rose:C.blanc,color:distriSubTab==="nouveaux"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              📋 Nouveaux Distri
            </button>
          </div>
          {distriSubTab==="distributeurs"&&<DistributeursTab distributeurs={distributeurs} save={saveDistributeurs} uid={uid}/>}
          {distriSubTab==="nouveaux"&&<SuiviRecruTab uid={uid}/>}
        </div>
      )}

      {/* POSTS */}
      {dtab==="posts"&&(
        <div>
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".65rem"}}>➕ Planifier un contenu</div>
            <div style={{display:"flex",gap:".5rem",marginBottom:".45rem"}}>
              {["Post","Story","Reel","Live"].map(t=>(
                <button key={t} onClick={()=>setNewPost(p=>({...p,type:t}))}
                  style={{flex:1,padding:".4rem",fontSize:".7rem",fontWeight:600,borderRadius:8,border:`1px solid ${newPost.type===t?C.rose:C.pale}`,background:newPost.type===t?C.rose:C.blanc,color:newPost.type===t?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>
                  {t}
                </button>
              ))}
            </div>
            <input placeholder="Sujet / hook (ex: routine visage à 25€)" value={newPost.sujet} onChange={e=>setNewPost(p=>({...p,sujet:e.target.value}))}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .7rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".65rem"}}/>
            <button onClick={()=>{
              if(!newPost.sujet.trim())return;
              const next=[{...newPost,id:Date.now(),date:new Date().toLocaleDateString("fr-FR"),fait:false},...posts];
              savePosts(next);setNewPost(p=>({...p,sujet:""}));
            }} style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".55rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              Ajouter au planning
            </button>
          </div>

          <div style={{display:"flex",justifyContent:"space-between",fontSize:".62rem",color:C.gris,marginBottom:".5rem"}}>
            <span>{posts.length} contenu{posts.length>1?"s":""} planifié{posts.length>1?"s":""}</span>
            <span style={{color:C.vert}}>{posts.filter(p=>p.fait).length} publié{posts.filter(p=>p.fait).length>1?"s":""}</span>
          </div>
          {posts.map(p=>(
            <div key={p.id} style={{background:p.fait?C.pale+"60":C.blanc,border:`1px solid ${p.fait?C.rose:C.pale}`,borderRadius:10,padding:".65rem .9rem",marginBottom:".4rem",display:"flex",gap:".6rem",alignItems:"center"}}>
              <div onClick={()=>savePosts(posts.map(x=>x.id===p.id?{...x,fait:!x.fait}:x))}
                style={{width:18,height:18,borderRadius:4,border:`2px solid ${p.fait?C.rose:C.pale}`,background:p.fait?C.rose:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all .15s"}}>
                {p.fait&&<span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>}
              </div>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:".4rem",alignItems:"center"}}>
                  <span style={{fontSize:".58rem",fontWeight:700,background:C.rose+"20",color:C.rose,padding:".1rem .35rem",borderRadius:10}}>{p.type}</span>
                  <div style={{fontSize:".77rem",fontWeight:600,color:p.fait?C.gris:C.brun,textDecoration:p.fait?"line-through":"none"}}>{p.sujet}</div>
                </div>
                <div style={{fontSize:".6rem",color:C.pale,marginTop:".1rem"}}>{p.date}</div>
              </div>
              <button onClick={()=>savePosts(posts.filter(x=>x.id!==p.id))}
                style={{background:"none",border:"none",color:C.pale,cursor:"pointer",fontSize:".8rem",flexShrink:0,padding:".2rem"}}>✕</button>
            </div>
          ))}
          {posts.length===0&&<div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".78rem"}}>Aucun contenu planifié.<br/>Ajoute ton prochain post ci-dessus.</div>}
        </div>
      )}

      {/* STATS */}
      {dtab==="stats"&&(
        <div>
          <button onClick={()=>setDtab("objperso")}
            style={{background:"none",border:"none",color:C.rose,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:".2rem",marginBottom:".75rem"}}>
            ← Retour à Mes Objectifs
          </button>
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".65rem"}}>🎯 Mon objectif du mois</div>
            <div style={{display:"flex",alignItems:"center",gap:".7rem"}}>
              <input type="number" min="1" value={stats.objectif} onChange={e=>saveStats({...stats,objectif:e.target.value})}
                style={{width:55,fontFamily:"Georgia,serif",fontSize:"1.8rem",fontWeight:600,color:C.brun,border:`1px solid ${C.pale}`,borderRadius:8,textAlign:"center",outline:"none",background:C.creme,padding:".2rem"}}/>
              <div style={{fontSize:".78rem",color:C.gris}}>nouvelle{+stats.objectif>1?"s":""} recrue{+stats.objectif>1?"s":""} ce mois</div>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".55rem",marginBottom:"1rem"}}>
            {[
              ["messages","Messages envoyés",C.lilas],
              ["reponses","Réponses reçues",C.or],
              ["presentations","Présentations",C.rose],
              ["ventes","Ventes",C.vert],
              ["recrues","Nouvelles recrues",C.brun],
            ].map(([k,l,col])=>(
              <div key={k} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".7rem",textAlign:"center",gridColumn:k==="recrues"?"1 / -1":"auto"}}>
                <input type="number" min="0" value={stats[k]||""} placeholder="0" onChange={e=>saveStats({...stats,[k]:e.target.value})}
                  style={{width:60,fontFamily:"Georgia,serif",fontSize:"1.8rem",fontWeight:600,color:col,border:"none",background:"none",textAlign:"center",outline:"none"}}/>
                <div style={{fontSize:".62rem",color:C.gris,marginTop:".15rem"}}>{l}</div>
              </div>
            ))}
          </div>

          <div style={{background:`linear-gradient(135deg,rgba(196,154,138,.1),rgba(168,155,181,.07))`,border:`1px solid ${C.pale}`,borderRadius:10,padding:".85rem 1rem",marginBottom:"1rem",fontSize:".74rem",color:C.texte,lineHeight:1.65}}>
            📐 <strong>Ratio cible :</strong> 10 messages → 5 réponses → 3 présentations → 1 recrue.<br/>
            Volume insuffisant → plus de contacts. Réponses mais pas de recrues → retravailler le pitch.
          </div>

          {/* Progress bar objectif */}
          {stats.recrues&&stats.objectif&&(
            <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem"}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:".7rem",color:C.gris,marginBottom:".4rem"}}>
                <span>Progression vers l'objectif</span>
                <span style={{fontWeight:700,color:+stats.recrues>=+stats.objectif?C.vert:C.rose}}>{stats.recrues} / {stats.objectif}</span>
              </div>
              <div style={{height:8,background:C.pale,borderRadius:10,overflow:"hidden"}}>
                <div style={{height:"100%",background:+stats.recrues>=+stats.objectif?C.vert:C.rose,width:Math.min(100,Math.round(+stats.recrues/+stats.objectif*100))+"%",borderRadius:10,transition:"width .4s"}}/>
              </div>
              {+stats.recrues>=+stats.objectif&&<div style={{textAlign:"center",fontSize:".75rem",color:C.vert,fontWeight:700,marginTop:".5rem"}}>🎉 Objectif atteint !</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── SUIVI CLIENTS ─────────────────────────────────────────────────────────────
const INP = (props) => <input {...props} style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".45rem",...props.style}}/>;

// Types de produits courants avec durée d'utilisation typique (en jours) — pour les rappels de réapprovisionnement
const TYPES_PRODUITS_DUREE=[
  {id:"shampoing",label:"🧴 Shampoing",jours:45},
  {id:"soin-cheveux",label:"💇 Soin/masque cheveux",jours:60},
  {id:"gel-douche",label:"🚿 Gel douche",jours:30},
  {id:"creme-visage",label:"✨ Crème visage",jours:60},
  {id:"serum",label:"💧 Sérum",jours:60},
  {id:"contour-yeux",label:"👁️ Contour des yeux",jours:75},
  {id:"baume-corps",label:"🧴 Baume/lait corps",jours:45},
  {id:"deodorant",label:"🌿 Déodorant",jours:60},
  {id:"parfum",label:"🌸 Parfum",jours:180},
  {id:"complement",label:"💊 Complément alimentaire",jours:30},
  {id:"maquillage",label:"💄 Maquillage",jours:90},
  {id:"autre",label:"📦 Autre",jours:30},
];

// Scripts de relance réapprovisionnement, par gamme — {produit} est remplacé par le nom tapé dans la commande
const SCRIPTS_RELANCE_GAMME={
  skincare:"Coucou {prenom} ! 😊 Je me disais que ton {produit} doit bientôt arriver à la fin... Comment se porte ta peau avec ? Si tu veux, je peux te renvoyer la même référence ou te conseiller autre chose selon ce que tu ressens en ce moment 💛",
  "soins-cheveux":"Hello {prenom} ! Petite pensée pour toi 🌸 Ton {produit} doit être presque terminé non ? Comment tu trouves le résultat sur tes cheveux ? Dis-moi si tu veux qu'on en recommande, ou si tu préfères essayer autre chose cette fois !",
  complements:"Coucou {prenom} ! Ça fait un petit moment que tu as commencé ton {produit} — comment tu te sens, des effets que tu remarques ? 😊 Si tu veux continuer la cure, c'est le bon moment pour recommander avant la fin du pot !",
  corps:"Hey {prenom} ! 🧴 Ton {produit} doit bientôt être fini... Tu en es contente ? Je peux te le renvoyer si tu veux, ou te faire découvrir une autre texture pour changer un peu 😊",
  parfum:"Coucou {prenom} ! Petit message pour prendre de tes nouvelles 🌸 Ton {produit} doit être presque vide... Toujours autant fan de cette odeur ou tu serais tentée d'essayer une nouvelle fragrance ?",
  entretien:"Hello {prenom} ! 🌿 Ton {produit} doit bientôt arriver à la fin — verdict, tu l'as trouvé efficace ? Je te le remets de côté si tu veux, dis-moi !",
};

// Mappe chaque type de produit (TYPES_PRODUITS_DUREE) vers sa gamme de script
const TYPE_TO_GAMME={
  shampoing:"soins-cheveux", "soin-cheveux":"soins-cheveux",
  "gel-douche":"corps","baume-corps":"corps","deodorant":"corps",
  "creme-visage":"skincare",serum:"skincare","contour-yeux":"skincare",maquillage:"skincare",
  parfum:"parfum",
  complement:"complements",
  autre:"entretien",
};

function genererScriptRelance(ligne, prenomClient){
  const gamme = TYPE_TO_GAMME[ligne.typeProduit]||"entretien";
  const template = SCRIPTS_RELANCE_GAMME[gamme]||SCRIPTS_RELANCE_GAMME.entretien;
  return template.replace(/{produit}/g, ligne.nom).replace(/{prenom}/g, prenomClient||"toi");
}


function ClientsTab({clients,save}){
  const[sel,setSel]=useState(null);
  const[form,setForm]=useState({nom:"",prenom:"",tel:"",email:"",ddn:"",adresse:"",notes:""});
  const[cmdForm,setCmdForm]=useState({lignes:[{nom:"",typeProduit:"shampoing"}],montant:"",date:new Date().toISOString().slice(0,10)});
  const[rappelForm,setRappelForm]=useState({texte:"",date:"",fait:false});
  const[showAdd,setShowAdd]=useState(false);
  const[showCmd,setShowCmd]=useState(false);
  const[showRappel,setShowRappel]=useState(false);
  const[search,setSearch]=useState("");
  const[confettiTrigger,setConfettiTrigger]=useState(0);

  const today=new Date();
  const daysDiff=(d)=>Math.floor((today-new Date(d))/(1000*60*60*24));

  const addClient=()=>{
    if(!form.nom.trim()&&!form.prenom.trim())return;
    const c={...form,id:Date.now(),commandes:[],notes:form.notes};
    save([...clients,c]);
    setSel(c.id);setForm({nom:"",prenom:"",tel:"",email:"",ddn:"",adresse:"",notes:""});setShowAdd(false);
    setConfettiTrigger(t=>t+1);
  };

  const addCmd=(cid)=>{
    const lignesValides = cmdForm.lignes.filter(l=>l.nom.trim());
    if(lignesValides.length===0)return;
    const lignes = lignesValides.map(l=>{
      const typeInfo = TYPES_PRODUITS_DUREE.find(t=>t.id===l.typeProduit)||TYPES_PRODUITS_DUREE[TYPES_PRODUITS_DUREE.length-1];
      return {nom:l.nom.trim(), typeProduit:l.typeProduit, typeLabel:typeInfo.label, dureeJours:typeInfo.jours};
    });
    const cmd={id:Date.now(),date:cmdForm.date,lignes,produits:lignes.map(l=>l.nom).join(", "),montant:cmdForm.montant,suivi7:false,suivi21:false};
    save(clients.map(c=>c.id===cid?{...c,commandes:[...(c.commandes||[]),cmd]}:c));
    setCmdForm({lignes:[{nom:"",typeProduit:"shampoing"}],montant:"",date:new Date().toISOString().slice(0,10)});setShowCmd(false);
  };

  const updateLigne=(idx,field,val)=>{
    setCmdForm(p=>({...p,lignes:p.lignes.map((l,i)=>i===idx?{...l,[field]:val}:l)}));
  };
  const addLigne=()=>setCmdForm(p=>({...p,lignes:[...p.lignes,{nom:"",typeProduit:"shampoing"}]}));
  const removeLigne=(idx)=>setCmdForm(p=>({...p,lignes:p.lignes.filter((_,i)=>i!==idx)}));

  const addRappel=(cid)=>{
    if(!rappelForm.texte.trim()||!rappelForm.date)return;
    const r={id:Date.now(),texte:rappelForm.texte.trim(),date:rappelForm.date,fait:false};
    save(clients.map(c=>c.id===cid?{...c,rappels:[...(c.rappels||[]),r]}:c));
    setRappelForm({texte:"",date:"",fait:false});setShowRappel(false);
  };

  const toggleRappel=(cid,rid)=>{
    save(clients.map(c=>c.id===cid?{...c,rappels:(c.rappels||[]).map(r=>r.id===rid?{...r,fait:!r.fait}:r)}:c));
  };

  const delRappel=(cid,rid)=>{
    save(clients.map(c=>c.id===cid?{...c,rappels:(c.rappels||[]).filter(r=>r.id!==rid)}:c));
  };

  const toggleSuivi=(cid,cmdId,type)=>{
    save(clients.map(c=>c.id===cid?{...c,commandes:(c.commandes||[]).map(cm=>cm.id===cmdId?{...cm,[type]:!cm[type]}:cm)}:c));
  };

  const updateNotes=(cid,v)=>save(clients.map(c=>c.id===cid?{...c,notes:v}:c));
  const delClient=(id)=>{save(clients.filter(c=>c.id!==id));if(sel===id)setSel(null);};

  // Alertes
  const alerts=clients.filter(c=>{
    if(!c.commandes||c.commandes.length===0)return false;
    const last=c.commandes.sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
    return daysDiff(last.date)>=60;
  });

  // Clientes dont au moins un produit arrive à "fin de flacon" (J-7 à J+0)
  const flaconAlerts=clients.filter(c=>{
    if(!c.commandes)return false;
    return c.commandes.some(cmd=>{
      const lignes = cmd.lignes || (cmd.dureeJours ? [cmd] : []);
      return lignes.some(l=>{
        if(!l.dureeJours)return false;
        const reste=l.dureeJours-daysDiff(cmd.date);
        return reste<=7&&reste>=0;
      });
    });
  });

  const filtered=clients.filter(c=>{
    const q=search.toLowerCase();
    return !q||(c.nom+c.prenom+c.tel+c.email).toLowerCase().includes(q);
  });

  const active=clients.find(c=>c.id===sel);

  return(
    <div>
      <Confetti trigger={confettiTrigger}/>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Suivi <em style={{fontStyle:"italic",color:C.rose}}>Clients</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        {clients.length} client{clients.length>1?"s":""} · Coordonnées, commandes, suivis et rappels.
      </p>

      {/* Alertes 2 mois */}
      {alerts.length>0&&(
        <div style={{background:"#FFF3E0",border:"1px solid #E6A817",borderRadius:10,padding:".75rem 1rem",marginBottom:"1rem",fontSize:".75rem",color:"#8B5E00"}}>
          ⚠️ <strong>{alerts.length} client{alerts.length>1?"s":""} sans commande depuis 2 mois :</strong> {alerts.map(c=>`${c.prenom} ${c.nom}`).join(", ")}
        </div>
      )}

      {/* Alertes fin de flacon */}
      {flaconAlerts.length>0&&(
        <div style={{background:"rgba(196,74,26,.08)",border:"1px solid #C44B1A60",borderRadius:10,padding:".75rem 1rem",marginBottom:"1rem",fontSize:".75rem",color:"#C44B1A"}}>
          🔔 <strong>{flaconAlerts.length} client{flaconAlerts.length>1?"s":""} bientôt à sec :</strong> {flaconAlerts.map(c=>`${c.prenom} ${c.nom}`).join(", ")} — bon moment pour prendre des nouvelles !
        </div>
      )}

      {/* Barre actions */}
      <div style={{display:"flex",gap:".5rem",marginBottom:"1rem"}}>
        <input placeholder="🔍 Rechercher..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .7rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
        <button onClick={()=>setShowAdd(p=>!p)}
          style={{background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".42rem .85rem",fontSize:".75rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",flexShrink:0}}>
          ➕ Client
        </button>
      </div>

      {/* Formulaire ajout */}
      {showAdd&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>Nouveau client</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".4rem"}}>
            <INP placeholder="Prénom" value={form.prenom} onChange={e=>setForm(p=>({...p,prenom:e.target.value}))}/>
            <INP placeholder="Nom" value={form.nom} onChange={e=>setForm(p=>({...p,nom:e.target.value}))}/>
          </div>
          <INP placeholder="Téléphone / WhatsApp" value={form.tel} onChange={e=>setForm(p=>({...p,tel:e.target.value}))}/>
          <INP placeholder="Email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/>
          <INP type="date" placeholder="Date de naissance" value={form.ddn} onChange={e=>setForm(p=>({...p,ddn:e.target.value}))} style={{marginBottom:".45rem"}}/>
          <INP placeholder="Adresse (optionnel)" value={form.adresse} onChange={e=>setForm(p=>({...p,adresse:e.target.value}))}/>
          <textarea placeholder="Notes" value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",resize:"vertical",minHeight:60,marginBottom:".65rem"}}/>
          <div style={{display:"flex",gap:".5rem"}}>
            <button onClick={addClient} style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".52rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>Ajouter</button>
            <button onClick={()=>setShowAdd(false)} style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".52rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>Annuler</button>
          </div>
        </div>
      )}

      {/* Liste clients */}
      <div style={{display:"flex",flexWrap:"wrap",gap:".4rem",marginBottom:"1rem"}}>
        {filtered.map(c=>{
          const isActive=sel===c.id;
          const lastCmd=c.commandes&&c.commandes.length>0?c.commandes.sort((a,b)=>new Date(b.date)-new Date(a.date))[0]:null;
          const overdue=lastCmd&&daysDiff(lastCmd.date)>=60;
          return(
            <div key={c.id} onClick={()=>setSel(isActive?null:c.id)}
              style={{background:isActive?C.brun:C.blanc,border:`2px solid ${overdue?"#E6A817":isActive?C.rose:C.pale}`,borderRadius:10,padding:".42rem .75rem",cursor:"pointer",flexShrink:0,transition:"all .2s"}}>
              <div style={{fontSize:".78rem",fontWeight:600,color:isActive?C.blanc:C.brun}}>{c.prenom} {c.nom}</div>
              <div style={{fontSize:".58rem",color:isActive?C.pale:C.gris}}>{c.commandes?.length||0} cmd{c.commandes?.length>1?"s":""}{overdue?" ⚠️":""}</div>
            </div>
          );
        })}
        {filtered.length===0&&<div style={{fontSize:".76rem",color:C.gris,padding:".5rem"}}>Aucun client trouvé.</div>}
      </div>

      {/* Fiche client */}
      {active&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:14,overflow:"hidden"}}>
          {/* Header */}
          <div style={{background:C.brun,padding:"1rem 1.1rem",display:"flex",alignItems:"center",gap:".8rem"}}>
            <div style={{width:40,height:40,borderRadius:"50%",background:C.rose,color:"white",fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {(active.prenom[0]||active.nom[0]||"?").toUpperCase()}
            </div>
            <div style={{flex:1}}>
              <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,color:C.blanc}}>{active.prenom} {active.nom}</div>
              <div style={{fontSize:".62rem",color:C.pale,opacity:.8}}>{active.tel} {active.email&&`· ${active.email}`}</div>
              {active.ddn&&<div style={{fontSize:".6rem",color:C.or}}>🎂 {new Date(active.ddn).toLocaleDateString("fr-FR")}</div>}
            </div>
            <button onClick={()=>delClient(active.id)} style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:6,padding:".3rem .5rem",color:C.pale,cursor:"pointer",fontSize:".7rem",fontFamily:"inherit"}}>✕</button>
          </div>

          <div style={{padding:"1rem"}}>
            {/* Commandes */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".6rem"}}>
              <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose}}>📦 Commandes ({active.commandes?.length||0})</div>
              <button onClick={()=>setShowCmd(p=>!p)} style={{background:C.brun,color:C.blanc,border:"none",borderRadius:6,padding:".2rem .55rem",fontSize:".65rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>+ Commande</button>
            </div>

            {showCmd&&(
              <div style={{background:C.creme,borderRadius:9,padding:".75rem",marginBottom:".75rem",border:`1px solid ${C.pale}`}}>
                <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:C.gris,marginBottom:".4rem"}}>Produits commandés</div>
                {cmdForm.lignes.map((ligne,idx)=>(
                  <div key={idx} style={{display:"flex",gap:".35rem",marginBottom:".35rem",alignItems:"center"}}>
                    <select value={ligne.typeProduit} onChange={e=>updateLigne(idx,"typeProduit",e.target.value)}
                      style={{border:`1px solid ${C.pale}`,borderRadius:8,padding:".4rem .3rem",fontSize:".72rem",fontFamily:"inherit",color:C.brun,background:C.blanc,outline:"none",fontWeight:600,flexShrink:0,width:150}}>
                      {TYPES_PRODUITS_DUREE.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                    <input placeholder="Nom du produit" value={ligne.nom} onChange={e=>updateLigne(idx,"nom",e.target.value)}
                      style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".4rem .6rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none"}}/>
                    {cmdForm.lignes.length>1&&(
                      <button onClick={()=>removeLigne(idx)} style={{background:"none",border:"none",color:C.gris,cursor:"pointer",fontSize:".8rem",flexShrink:0,padding:".2rem"}}>✕</button>
                    )}
                  </div>
                ))}
                <button onClick={addLigne} style={{background:"none",border:`1px dashed ${C.pale}`,borderRadius:7,padding:".3rem .6rem",fontSize:".68rem",color:C.gris,fontFamily:"inherit",cursor:"pointer",marginBottom:".5rem"}}>
                  + Ajouter un produit
                </button>
                <div style={{display:"flex",gap:".4rem"}}>
                  <INP placeholder="Montant total (€)" value={cmdForm.montant} onChange={e=>setCmdForm(p=>({...p,montant:e.target.value}))} style={{flex:1}}/>
                  <INP type="date" value={cmdForm.date} onChange={e=>setCmdForm(p=>({...p,date:e.target.value}))} style={{flex:1}}/>
                </div>
                <div style={{display:"flex",gap:".4rem",marginTop:".1rem"}}>
                  <button onClick={()=>addCmd(active.id)} style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:7,padding:".45rem",fontSize:".75rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>Enregistrer</button>
                  <button onClick={()=>setShowCmd(false)} style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:7,padding:".45rem",fontSize:".75rem",fontFamily:"inherit",cursor:"pointer"}}>Annuler</button>
                </div>
              </div>
            )}

            {active.commandes&&active.commandes.length>0?(
              [...active.commandes].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(cmd=>{
                const d=daysDiff(cmd.date);
                const need7=d>=7&&d<21&&!cmd.suivi7;
                const need21=d>=21&&!cmd.suivi21;
                // Compatibilité ancien format (1 produit par commande) → on le transforme en lignes[]
                const lignes = cmd.lignes || (cmd.typeProduit ? [{nom:cmd.produits, typeProduit:cmd.typeProduit, typeLabel:cmd.typeLabel, dureeJours:cmd.dureeJours}] : []);
                const anyFinFlacon = lignes.some(l=>{
                  if(!l.dureeJours)return false;
                  const reste=l.dureeJours-d;
                  return reste<=7&&reste>-15;
                });
                return(
                  <div key={cmd.id} style={{background:C.creme,borderRadius:9,padding:".7rem .85rem",marginBottom:".45rem",border:`1px solid ${(need7||need21||anyFinFlacon)?"#E6A817":C.pale}`}}>
                    <div style={{marginBottom:".35rem"}}>
                      <div style={{fontSize:".78rem",fontWeight:600,color:C.brun}}>{cmd.produits}</div>
                      <div style={{fontSize:".62rem",color:C.gris}}>{new Date(cmd.date).toLocaleDateString("fr-FR")}{cmd.montant&&` · ${cmd.montant}€`} · J+{d}</div>
                    </div>

                    {/* Rappels fin de flacon par produit */}
                    {lignes.map((l,li)=>{
                      if(!l.dureeJours)return null;
                      const reste=l.dureeJours-d;
                      const finFlacon = reste<=7&&reste>-15;
                      if(!finFlacon)return null;
                      const script = genererScriptRelance(l, active.prenom);
                      return(
                        <div key={li} style={{background:reste>=0?"#FFF3E0":"#FFE8E0",border:`1px solid ${reste>=0?"#E6A817":"#C44B1A"}`,borderRadius:6,padding:".45rem .55rem",marginBottom:".4rem"}}>
                          <div style={{display:"flex",alignItems:"center",gap:".35rem",fontSize:".68rem",color:reste>=0?"#8B5E00":"#C44B1A",marginBottom:".35rem"}}>
                            🔔 {reste>=0
                              ? `${l.typeLabel||l.nom} bientôt fini (dans ~${reste}j)`
                              : `${l.typeLabel||l.nom} devrait être terminé depuis ~${-reste}j`}
                          </div>
                          <div style={{background:C.blanc,borderLeft:`3px solid ${C.lilas}`,borderRadius:"0 6px 6px 0",padding:".5rem .65rem",fontSize:".7rem",color:C.texte,lineHeight:1.6,display:"flex",justifyContent:"space-between",gap:".5rem",alignItems:"flex-start"}}>
                            <span style={{flex:1}}>{script}</span>
                            <CopyBtn text={script}/>
                          </div>
                        </div>
                      );
                    })}

                    <div style={{display:"flex",gap:".5rem",flexWrap:"wrap"}}>
                      {[["suivi7","✅ Suivi J+7",7,14],["suivi21","✅ Suivi J+21",21,999]].map(([key,label,min,max])=>{
                        const due=d>=min&&d<max;
                        const done=cmd[key];
                        return(
                          <div key={key} onClick={()=>toggleSuivi(active.id,cmd.id,key)}
                            style={{display:"flex",alignItems:"center",gap:".3rem",background:done?C.vert+"20":due?"#FFF3E0":C.pale+"60",borderRadius:6,padding:".2rem .5rem",cursor:"pointer",border:`1px solid ${done?C.vert:due?"#E6A817":C.pale}`,fontSize:".65rem",color:done?C.vert:due?"#8B5E00":C.gris}}>
                            <div style={{width:12,height:12,borderRadius:3,border:`1.5px solid ${done?C.vert:due?"#E6A817":C.gris}`,background:done?C.vert:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                              {done&&<span style={{fontSize:".45rem",color:"white",fontWeight:700}}>✓</span>}
                            </div>
                            {label}{due&&!done?" 🔔":""}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ):<div style={{fontSize:".74rem",color:C.gris,fontStyle:"italic",marginBottom:".75rem"}}>Aucune commande enregistrée.</div>}

            {/* Notes */}
            <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".4rem",marginTop:".5rem"}}>📝 Notes</div>
            <textarea value={active.notes||""} onChange={e=>updateNotes(active.id,e.target.value)}
              placeholder="Préférences, allergies, produits favoris, historique..."
              style={{width:"100%",minHeight:80,border:`1px solid ${C.pale}`,borderRadius:8,padding:".6rem",fontFamily:"inherit",fontSize:".77rem",color:C.texte,background:C.creme,resize:"vertical",outline:"none",lineHeight:1.6}}/>

            {/* Rappels personnalisés */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".5rem",marginTop:".75rem"}}>
              <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.lilas}}>🔔 Rappels personnalisés</div>
              <button onClick={()=>setShowRappel(p=>!p)} style={{background:C.lilas,color:"white",border:"none",borderRadius:6,padding:".2rem .55rem",fontSize:".65rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>+ Rappel</button>
            </div>
            {showRappel&&(
              <div style={{background:C.creme,borderRadius:9,padding:".75rem",marginBottom:".65rem",border:`1px solid ${C.pale}`}}>
                <input placeholder="Ex: Rappeler pour renouvellement crème" value={rappelForm.texte} onChange={e=>setRappelForm(p=>({...p,texte:e.target.value}))}
                  style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".4rem"}}/>
                <input type="date" value={rappelForm.date} onChange={e=>setRappelForm(p=>({...p,date:e.target.value}))}
                  style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".5rem"}}/>
                <div style={{display:"flex",gap:".4rem"}}>
                  <button onClick={()=>addRappel(active.id)} style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:7,padding:".45rem",fontSize:".75rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>Ajouter</button>
                  <button onClick={()=>setShowRappel(false)} style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:7,padding:".45rem",fontSize:".75rem",fontFamily:"inherit",cursor:"pointer"}}>Annuler</button>
                </div>
              </div>
            )}
            {(active.rappels||[]).length===0&&!showRappel&&<div style={{fontSize:".72rem",color:C.gris,fontStyle:"italic",marginBottom:".5rem"}}>Aucun rappel programmé.</div>}
            {(active.rappels||[]).sort((a,b)=>new Date(a.date)-new Date(b.date)).map(r=>{
              const isToday=r.date===new Date().toISOString().slice(0,10);
              const isPast=new Date(r.date)<new Date()&&!isToday;
              return(
                <div key={r.id} style={{display:"flex",gap:".55rem",alignItems:"flex-start",padding:".45rem .65rem",borderRadius:8,marginBottom:".3rem",background:r.fait?C.pale+"60":isToday?"#FFF3E0":C.blanc,border:`1px solid ${isToday?"#E6A817":r.fait?C.pale:C.pale}`}}>
                  <div onClick={()=>toggleRappel(active.id,r.id)} style={{width:18,height:18,borderRadius:4,border:`2px solid ${r.fait?C.vert:C.lilas}`,background:r.fait?C.vert:"transparent",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all .15s"}}>
                    {r.fait&&<span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:".76rem",color:r.fait?C.gris:C.brun,textDecoration:r.fait?"line-through":"none"}}>{r.texte}</div>
                    <div style={{fontSize:".62rem",color:isToday?"#8B5E00":isPast?"#B04040":C.gris,fontWeight:isToday?700:400}}>
                      {isToday?"🔔 Aujourd'hui !":isPast?"⚠️ Passé — ":""}{new Date(r.date).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  <button onClick={()=>delRappel(active.id,r.id)} style={{background:"none",border:"none",color:C.pale,cursor:"pointer",fontSize:".7rem",padding:".1rem",flexShrink:0}}>✕</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SUIVI DISTRIBUTEURS ───────────────────────────────────────────────────────
const PALIERS=["2%","4%","6%","8%","10%","12%","14%","17%","SR","Structural","Business","SR Business"];
const PALIER_COLORS={"2%":C.gris,"4%":C.gris,"6%":C.lilas,"8%":C.lilas,"10%":C.rose,"12%":C.rose,"14%":C.or,"17%":C.or,"SR":C.brun2,"Structural":"#6B5B8A","Business":"#4A7A5C","SR Business":C.brun};

function DistributeursTab({distributeurs,save,uid}){
  const[sel,setSel]=useState(null);
  const[form,setForm]=useState({prenom:"",nom:"",tel:"",email:"",dateEnreg:"",notes:""});
  const[showAdd,setShowAdd]=useState(false);
  const[search,setSearch]=useState("");
  const[annuaire,setAnnuaire]=useState({});
  const[loaded,setLoaded]=useState(false);
  const[path,setPath]=useState([]);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"equipe","annuaire"));
        setAnnuaire(snap.exists()?snap.data().membres||{}:{});
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const add=async()=>{
    if(!form.prenom.trim())return;
    const d={...form,id:Date.now(),palier:"2%",notes:form.notes};
    save([...distributeurs,d]);
    setSel(d.id);setForm({prenom:"",nom:"",tel:"",email:"",dateEnreg:"",notes:""});setShowAdd(false);
    // Crée aussi une entrée dans l'annuaire d'équipe (pour Mon Équipe / sous-dossiers)
    try{
      const newUid=(form.prenom.trim()+"-"+form.nom.trim()).toLowerCase().replace(/\s+/g,"-").replace(/-+$/,"");
      if(newUid){
        const ref=doc(db,"equipe","annuaire");
        const entry={uid:newUid, prenom:form.prenom.trim(), nom:form.nom.trim(), marraine:uid, palier:"2%", manuel:true, dateEnreg:new Date().toISOString().slice(0,10)};
        await setDoc(ref,{membres:{[newUid]:entry}},{merge:true});
        setAnnuaire(prev=>({...prev,[newUid]:entry}));
      }
    }catch{}
  };

  const updatePalier=(id,p)=>save(distributeurs.map(d=>d.id===id?{...d,palier:p}:d));
  const updateNotes=(id,v)=>save(distributeurs.map(d=>d.id===id?{...d,notes:v}:d));
  const del=(id)=>{save(distributeurs.filter(d=>d.id!==id));if(sel===id)setSel(null);};

  const updateAutoNotes=async(uid,v)=>{
    setAnnuaire(prev=>({...prev,[uid]:{...prev[uid],notes:v}}));
    try{
      const ref=doc(db,"equipe","annuaire");
      await setDoc(ref,{membres:{[uid]:{...annuaire[uid],notes:v}}},{merge:true});
    }catch{}
  };

  // Fusionne les entrées automatiques (annuaire) et manuelles
  const isMelissa = uid==="melissa"||uid==="melissa-da-silveira";

  // Récupère récursivement tous les uids de la descendance (filleules directes et indirectes)
  const getDescendants = (rootUid) => {
    const result = new Set();
    const queue = [rootUid];
    while(queue.length){
      const current = queue.pop();
      Object.values(annuaire).forEach(m=>{
        if(m.marraine===current && !result.has(m.uid)){
          result.add(m.uid);
          queue.push(m.uid);
        }
      });
    }
    return result;
  };

  const descendants = isMelissa ? null : getDescendants(uid);

  const autoEntries = Object.values(annuaire)
    .filter(m=> isMelissa || (descendants && descendants.has(m.uid)))
    .map(m=>{
      // Dérive prenom/nom depuis uid si absents
      const parts = m.uid.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1));
      const prenom = m.prenom || parts[0] || "";
      const nom = m.nom || parts.slice(1).join(" ") || "";
      return {...m, prenom, nom, id:"auto-"+m.uid, auto:true};
    });
  const allEntries = [...autoEntries, ...distributeurs.map(d=>({...d, auto:false}))];

  // Helpers navigation par équipe (basé sur le champ marraine de l'annuaire)
  const fmtNom=(u)=>u.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
  const enfantsDe=(u)=>Object.values(annuaire).filter(m=>m.marraine===u);
  const sousEquipeCount=(u)=>{
    const visited=new Set([u]);
    const queue=[u];
    while(queue.length){
      const current=queue.pop();
      Object.values(annuaire).forEach(m=>{
        if(m.marraine===current && !visited.has(m.uid)){
          visited.add(m.uid);
          queue.push(m.uid);
        }
      });
    }
    return visited.size-1;
  };

  const filtered=allEntries.filter(d=>{
    const q=search.toLowerCase();
    return !q||((d.prenom||"")+(d.nom||"")+(d.tel||"")).toLowerCase().includes(q);
  });

  const active=allEntries.find(d=>d.id===sel);

  // ── VUE ÉQUIPE D'UNE PERSONNE (navigation par sous-dossiers) ──
  if(path.length>0){
    const currentUid=path[path.length-1];
    const currentPerson=annuaire[currentUid];
    const enfants=enfantsDe(currentUid);
    return(
      <div>
        <div style={{display:"flex",flexWrap:"wrap",gap:".3rem",alignItems:"center",marginBottom:"1rem",fontSize:".7rem"}}>
          <button onClick={()=>setPath([])} style={{background:"none",border:"none",color:C.rose,fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:".2rem"}}>👑 Distributeurs</button>
          {path.map((pUid,i)=>(
            <span key={pUid} style={{display:"flex",alignItems:"center",gap:".3rem"}}>
              <span style={{color:C.pale}}>›</span>
              <button onClick={()=>setPath(path.slice(0,i+1))}
                style={{background:"none",border:"none",color:i===path.length-1?C.brun:C.rose,fontWeight:i===path.length-1?700:600,cursor:"pointer",fontFamily:"inherit",padding:".2rem"}}>
                {fmtNom(pUid)}
              </button>
            </span>
          ))}
        </div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,color:C.brun,marginBottom:".2rem"}}>
          Équipe de {currentPerson?fmtNom(currentPerson.uid):fmtNom(currentUid)}
        </div>
        <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem"}}>
          {enfants.length} filleule{enfants.length>1?"s":""} directe{enfants.length>1?"s":""}.
        </p>
        {enfants.length===0&&(
          <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".76rem"}}>Cette personne n'a pas encore de filleules.</div>
        )}
        {enfants.map(m=>{
          const count=sousEquipeCount(m.uid);
          const isExpanded=sel===("path-"+m.uid);
          return(
            <div key={m.uid} style={{background:C.blanc,border:`1px solid ${isExpanded?C.rose:C.pale}`,borderRadius:12,padding:".7rem 1rem",marginBottom:".5rem"}}>
              <div style={{display:"flex",alignItems:"center",gap:".6rem"}}>
                <div style={{width:34,height:34,borderRadius:"50%",background:C.rose+"20",color:C.rose,fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative"}}>
                  {fmtNom(m.uid)[0]}
                  {count>0&&(
                    <div style={{position:"absolute",top:-4,right:-4,background:C.lilas,color:"white",borderRadius:"50%",minWidth:16,height:16,fontSize:".58rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>
                      {count}
                    </div>
                  )}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:C.brun}}>{fmtNom(m.uid)}</div>
                  <div style={{fontSize:".62rem",color:C.gris}}>{m.palier||"2%"}{m.ca?` · ${m.ca}€`:""}</div>
                </div>
                {count>0&&(
                  <button onClick={()=>setPath([...path,m.uid])}
                    style={{display:"flex",alignItems:"center",gap:".3rem",background:C.lilas+"15",border:`1px solid ${C.lilas}50`,borderRadius:8,padding:".35rem .6rem",fontSize:".68rem",fontWeight:600,color:C.lilas,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                    📁 Équipe
                  </button>
                )}
                <button onClick={()=>setSel(isExpanded?null:"path-"+m.uid)}
                  style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:8,padding:".35rem .55rem",fontSize:".68rem",color:C.gris,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                  {isExpanded?"▲":"▼"}
                </button>
              </div>
              {isExpanded&&(
                <div style={{marginTop:".6rem",paddingTop:".6rem",borderTop:`1px solid ${C.pale}`}}>
                  <MembreStatsCard m={m} expanded={true} onToggleExpand={()=>setSel(null)}/>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Suivi <em style={{fontStyle:"italic",color:C.rose}}>Distributeurs</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        {allEntries.length} distributeur{allEntries.length>1?"s":""} ({autoEntries.length} connecté{autoEntries.length>1?"s":""} à l'app, {distributeurs.length} ajouté{distributeurs.length>1?"s":""} manuellement) · Progression dans le plan de rémunération.
        {!loaded&&" Chargement de l'annuaire..."}
      </p>

      <div style={{display:"flex",gap:".5rem",marginBottom:"1rem"}}>
        <input placeholder="🔍 Rechercher..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .7rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
        <button onClick={()=>setShowAdd(p=>!p)}
          style={{background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".42rem .85rem",fontSize:".75rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",flexShrink:0}}>
          ➕ Distributeur
        </button>
      </div>

      {showAdd&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>Nouveau distributeur</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".4rem"}}>
            <INP placeholder="Prénom" value={form.prenom} onChange={e=>setForm(p=>({...p,prenom:e.target.value}))}/>
            <INP placeholder="Nom" value={form.nom} onChange={e=>setForm(p=>({...p,nom:e.target.value}))}/>
          </div>
          <INP placeholder="Téléphone / WhatsApp" value={form.tel} onChange={e=>setForm(p=>({...p,tel:e.target.value}))}/>
          <INP placeholder="Email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/>
          <INP type="date" placeholder="Date d'enregistrement" value={form.dateEnreg} onChange={e=>setForm(p=>({...p,dateEnreg:e.target.value}))}/>
          <div style={{display:"flex",gap:".4rem",marginTop:".1rem"}}>
            <button onClick={add} style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>Ajouter</button>
            <button onClick={()=>setShowAdd(false)} style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>Annuler</button>
          </div>
        </div>
      )}

      {/* Liste */}
      {filtered.length===0&&<div style={{fontSize:".76rem",color:C.gris,padding:".5rem"}}>Aucun distributeur trouvé.</div>}

      {filtered.map(d=>{
        const isActive=sel===d.id;
        const dUid=d.uid||((d.prenom||"")+"-"+(d.nom||"")).toLowerCase().replace(/\s+/g,"-");
        const teamCount=sousEquipeCount(dUid);
        const nom=d.prenom||d.nom?`${d.prenom||""} ${d.nom||""}`.trim():fmtNom(d.uid||"");
        return(
          <div key={d.id} style={{background:C.blanc,border:`1.5px solid ${isActive?C.rose:C.pale}`,borderRadius:12,marginBottom:".45rem",overflow:"hidden",transition:"border-color .2s"}}>
            <div style={{display:"flex",alignItems:"center",gap:".6rem",padding:".6rem .85rem"}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:isActive?C.rose+"20":C.creme,color:isActive?C.rose:C.brun,fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {(nom[0]||"?").toUpperCase()}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:".82rem",fontWeight:600,color:C.brun,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {nom}{d.auto&&<span style={{marginLeft:".3rem",fontSize:".65rem"}}>📱</span>}
                </div>
                <div style={{fontSize:".6rem",color:C.gris}}>{d.palier||"2%"}{d.ca?` · ${d.ca}€`:""}</div>
              </div>
              {teamCount>0&&(
                <button onClick={(e)=>{e.stopPropagation();setPath([dUid]);}}
                  style={{background:C.lilas+"15",border:`1px solid ${C.lilas}50`,borderRadius:8,padding:".3rem .55rem",fontSize:".65rem",fontWeight:700,color:C.lilas,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                  📁 {teamCount}
                </button>
              )}
              <button onClick={()=>setSel(isActive?null:d.id)}
                style={{background:isActive?C.rose:C.creme,border:`1px solid ${isActive?C.rose:C.pale}`,borderRadius:8,padding:".3rem .55rem",fontSize:".7rem",color:isActive?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit",flexShrink:0,transition:"all .2s"}}>
                {isActive?"▲":"▼"}
              </button>
            </div>

            {isActive&&(
              <div style={{borderTop:`1px solid ${C.pale}`,padding:"1rem"}}>
                {d.auto&&(
                  <div style={{display:"flex",gap:".5rem",marginBottom:".75rem"}}>
                    <div style={{flex:1,background:C.creme,borderRadius:9,padding:".6rem",textAlign:"center"}}>
                      <div style={{fontSize:".58rem",color:C.gris,marginBottom:".15rem"}}>💰 CA</div>
                      <div style={{fontSize:"1rem",fontWeight:700,color:C.rose}}>{d.ca||"—"}{d.ca?"€":""}{d.caObj?` / ${d.caObj}€`:""}</div>
                    </div>
                    <div style={{flex:1,background:C.creme,borderRadius:9,padding:".6rem",textAlign:"center"}}>
                      <div style={{fontSize:".58rem",color:C.gris,marginBottom:".15rem"}}>👥 Recrues</div>
                      <div style={{fontSize:"1rem",fontWeight:700,color:C.lilas}}>{d.recruesReal||"0"}{d.recruesObj&&d.recruesObj!=="0"?` / ${d.recruesObj}`:""}</div>
                    </div>
                  </div>
                )}

                <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>💰 Plan de rémunération</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:".3rem",marginBottom:".85rem"}}>
                  {PALIERS.map((p,i)=>{
                    const current=d.palier===p;
                    const passed=PALIERS.indexOf(d.palier||"2%")>i;
                    const col=PALIER_COLORS[p]||C.gris;
                    return(
                      <div key={p} onClick={()=>!d.auto&&updatePalier(d.id,p)}
                        style={{padding:".22rem .55rem",borderRadius:20,fontSize:".65rem",fontWeight:600,cursor:d.auto?"default":"pointer",border:`2px solid ${current?col:passed?col+"60":C.pale}`,background:current?col:passed?col+"15":"transparent",color:current?"white":passed?col:C.gris}}>
                        {passed&&!current?"✓ ":""}{p}
                      </div>
                    );
                  })}
                </div>

                {d.auto&&dUid&&(
                  <MembreStatsCard
                    m={{...d, uid:dUid, historique:d.historique||[]}}
                    expanded={false}
                    onToggleExpand={()=>{}}
                  />
                )}

                <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".4rem",marginTop:".75rem"}}>📝 Notes</div>
                <textarea value={d.notes||""} onChange={e=>d.auto?updateAutoNotes(dUid,e.target.value):updateNotes(d.id,e.target.value)}
                  placeholder="Objectifs, blocages, points de suivi..."
                  style={{width:"100%",minHeight:80,border:`1px solid ${C.pale}`,borderRadius:8,padding:".6rem",fontFamily:"inherit",fontSize:".76rem",color:C.texte,background:C.creme,resize:"vertical",outline:"none",lineHeight:1.6}}/>

                {!d.auto&&(
                  <button onClick={()=>del(d.id)}
                    style={{marginTop:".5rem",background:"none",border:`1px solid #B0404040`,borderRadius:8,padding:".3rem .7rem",fontSize:".68rem",color:"#B04040",fontFamily:"inherit",cursor:"pointer"}}>
                    Supprimer
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── COMMUNAUTÉ ────────────────────────────────────────────────────────────────
const MELISSA = "melissa";

function CommunauteTab({uid, userName}){
  const[posts,setPosts]=useState([]);
  const[infos,setInfos]=useState([]);
  const[loading,setLoading]=useState(true);
  const[ctab,setCtab]=useState("tous");
  const[newText,setNewText]=useState("");
  const[newType,setNewType]=useState("victoire");
  const[newInfo,setNewInfo]=useState({titre:"",texte:"",important:false});
  const[showAddInfo,setShowAddInfo]=useState(false);
  const[posting,setPosting]=useState(false);
  const isMelissa=userName.toLowerCase().replace(/\s+/g,"-")===MELISSA||userName.toLowerCase()===MELISSA;

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
        setInfos(Object.values(data2).sort((a,b)=>b.ts-a.ts));
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
      ts:Date.now(),
      likes:[],
    };
    const next=[p,...posts];
    setPosts(next);
    await savePosts(next);
    setNewText("");
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

      {/* Formulaire nouveau post — masqué sur onglet infos */}
      {ctab!=="infos"&&(
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
          <button key={t.id} onClick={()=>setCtab(t.id)}
            style={{flex:"none",padding:".38rem .75rem",fontSize:".65rem",fontWeight:600,borderRadius:20,border:`1px solid ${ctab===t.id?C.rose:C.pale}`,background:ctab===t.id?C.rose:C.blanc,color:ctab===t.id?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit",transition:"all .2s",whiteSpace:"nowrap"}}>
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
          </div>
        );
      })}
    </div>
  );
}

// ── SCRIPTS ───────────────────────────────────────────────────────────────────
const SCRIPTS_DATA=[
  {cat:"💬 Premier contact",scripts:[
    {title:"Contact WhatsApp — Produits",text:"Coucou [Prénom] 😊 Je pensais à toi ! Je travaille avec une marque de beauté et bien-être qui m'a bluffée. Je me demandais si tu aurais 5 min pour jeter un œil ? Pas d'obligation, juste partager quelque chose qui m'a vraiment plu 🙏"},
    {title:"Contact WhatsApp — Opportunité",text:"Coucou [Prénom] ! J'espère que tu vas bien 🙂 Je développe quelque chose qui m'a permis de gagner un revenu complémentaire depuis chez moi. Ça m'a fait penser à toi — tu serais ouverte à en discuter 5 min ?"},
    {title:"Réponse à une story",text:"Coucou ! J'ai vu ta story sur [sujet] — ça m'a donné envie de te contacter 😊 Je travaille avec une marque que tu pourrais vraiment aimer. Tu veux que je t'envoie quelques infos ?"},
  ]},
  {cat:"🔄 Relance",scripts:[
    {title:"Relance douce",text:"Coucou [Prénom] ! Pas de pression du tout 🙂 Je voulais juste prendre de tes nouvelles. Tu avais eu le temps de regarder ce que je t'avais envoyé ?"},
    {title:"Relance après silence",text:"Coucou [Prénom] ! Ça fait un moment 😊 Je pense souvent à toi. Si tu es toujours curieuse de ce que je fais, je serais ravie d'en parler. Et si tu n'es pas intéressée, c'est ok aussi — dis-le moi simplement !"},
    {title:"Relance après un 'non'",text:"Pas de souci du tout [Prénom] ! Je comprends totalement. Est-ce que tu connais quelqu'un dans ton entourage qui cherche un revenu complémentaire ? Je suis preneuse de toute recommandation 🙏"},
  ]},
  {cat:"🎯 Présentation opportunité",scripts:[
    {title:"Pitch express 30 secondes",text:"En gros — je distribue des produits beauté et bien-être Mihi. Je gagne entre 20 et 30% sur chaque vente, et je touche des commissions sur l'équipe que je construis. Je travaille depuis mon téléphone, à mes heures. Ce n'est pas un miracle — c'est du vrai travail. Mais ça m'a permis de [ton résultat]. Tu veux en savoir plus ?"},
    {title:"Présentation complète — intro",text:"Je vais t'expliquer ce que je fais en 3 points. 1️⃣ Je vends des produits Mihi — beauté, bien-être, perte de poids. 2️⃣ Je gagne une marge de 20 à 30% sur chaque vente. 3️⃣ Je développe une équipe et je touche des commissions sur leur activité. Ce qui me plaît c'est que ça s'adapte à ma vie — pas l'inverse."},
    {title:"Réponse à 'c'est du MLM ?'",text:"Je comprends la méfiance — j'avais les mêmes questions 😊 Oui c'est de la vente directe. La différence avec les arnaques : il y a de vrais produits qu'on vend à de vraies clientes, avec une vraie marge. Je ne gagne pas d'argent en recrutant — je gagne en vendant et en formant une équipe qui vend. Tu veux que je te montre les chiffres concrets ?"},
  ]},
  {cat:"🛍️ Vente produits",scripts:[
    {title:"Présenter les parfums",text:"Tu sais ce que je réponds quand on me demande combien coûte mon parfum ? 😏 Moins de 20€. Et non c'est pas une arnaque — c'est Mihi, une marque que je distribue. La qualité est vraiment là. Tu veux que je t'en envoie quelques références ?"},
    {title:"Présenter les soins visage",text:"Je testais une nouvelle crème ce matin et j'ai pensé à toi 😊 La gamme soin visage que je distribue a des résultats hallucinants — et à des prix vraiment accessibles. Si tu veux, je peux te faire une sélection selon ton type de peau ?"},
    {title:"Inviter à commander",text:"Si tu veux essayer, le plus simple c'est de passer par ma boutique personnelle. Je t'envoie le lien ? Et si tu as des questions sur les produits, je suis là pour t'orienter 🙂"},
  ]},
  {cat:"👑 Recrutement équipe",scripts:[
    {title:"Approche douce recrutement",text:"Coucou [Prénom] ! Je développe mon équipe Blazing Dynasty et en te voyant, je me suis dit que tu pourrais vraiment avoir ta place ici. Je ne te demande pas de dire oui — juste d'écouter 10 min. Qu'est-ce que tu en penses ?"},
    {title:"Après une présentation",text:"Merci d'avoir pris le temps ce soir 🧡 Je suis là si tu as des questions. Pas de pression — prends le temps qu'il te faut. Si ça peut t'aider à décider, je peux te mettre en contact avec une de mes filles qui a démarré dans la même situation que toi."},
    {title:"Gérer l'objection 'je n'ai pas le temps'",text:"Je comprends totalement — moi aussi j'avais l'impression de ne pas avoir le temps au départ 😊 Ce qui m'a surprise c'est que ça prend vraiment le temps qu'on lui donne. Certaines filles de mon équipe commencent avec 30 min par jour. On peut en parler si tu veux ?"},
    {title:"Gérer l'objection 'je ne suis pas vendeuse'",text:"Moi non plus je ne me considérais pas comme vendeuse ! 😅 Ce que je fais c'est surtout partager ce que j'aime avec les gens autour de moi. Les ventes viennent naturellement après. Est-ce que tu partages déjà des produits que tu aimes avec tes amies ? Alors tu sais déjà faire 😊"},
  ]},
  {cat:"📱 Stories & contenu",scripts:[
    {title:"CTA mot-clé commentaire",text:"Tu veux savoir quel est ce produit qui me fait des compliments à chaque fois ? Écris PRODUIT en commentaire et je t'envoie tout en privé 😊"},
    {title:"CTA pour l'opportunité",text:"Tu cherches un revenu complémentaire qui s'adapte à ta vie ? Écris ÉQUIPE en commentaire — je te réponds en privé 🖤"},
    {title:"Intro storytelling",text:"Il y a [X mois], je ne savais pas quoi faire. Aujourd'hui [ton résultat]. Ce n'est pas un miracle — c'est ce que j'ai construit, étape par étape. Je vous raconte ça ce soir en story 👇"},
  ]},
];

// ── ANNONCE IMPORTANTE (pop-up + bandeau) ─────────────────────────────────────

function MarrainePopup({uid, userName}){
  const[show,setShow]=useState(false);
  const[membres,setMembres]=useState([]);
  const[choix,setChoix]=useState("");
  const[dismissed,setDismissed]=useState(false);
  const[saving,setSaving]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const annSnap=await getDoc(doc(db,"equipe","annuaire"));
        const annuaire=annSnap.exists()?annSnap.data().membres||{}:{};
        const moi=annuaire[uid];
        if(moi&&!moi.marraine){
          const accSnap=await getDoc(doc(db,"acces","membres"));
          const liste=accSnap.exists()?accSnap.data().liste||[]:[];
          setMembres(["melissa da silveira", ...liste.filter(m=>m.toLowerCase().replace(/\s+/g,"-")!==uid&&m.toLowerCase()!=="melissa da silveira")]);
          setShow(true);
        }
      }catch{}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[uid]);

  const confirmer=async()=>{
    if(!choix){setShow(false);setDismissed(true);return;}
    setSaving(true);
    const marraineUid=choix.toLowerCase().replace(/\s+/g,"-");
    try{
      await setDoc(doc(db,"users",uid),{marraine:marraineUid},{merge:true});
      const ref=doc(db,"equipe","annuaire");
      const snap=await getDoc(ref);
      const existing=snap.exists()&&snap.data().membres?snap.data().membres:{};
      await setDoc(ref,{membres:{...existing,[uid]:{...existing[uid],marraine:marraineUid}}},{merge:true});
    }catch{}
    setSaving(false);setShow(false);
  };

  if(!show||dismissed) return null;

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,31,14,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9998,padding:"1rem"}}>
      <div style={{background:C.blanc,borderRadius:16,padding:"1.4rem",maxWidth:380,width:"100%",boxShadow:"0 10px 40px rgba(0,0,0,.25)"}}>
        <div style={{fontSize:"1.8rem",textAlign:"center",marginBottom:".4rem"}}>🌸</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",fontWeight:600,color:C.brun,textAlign:"center",marginBottom:".5rem"}}>Qui t'a parrainée ?</div>
        <p style={{fontSize:".76rem",color:C.gris,textAlign:"center",lineHeight:1.6,marginBottom:"1rem"}}>
          Ça permettra à ta marraine de te retrouver dans son équipe automatiquement 💛
        </p>
        <SearchSelect value={choix} onChange={setChoix} options={membres} placeholder="🔍 Tape le nom de ta marraine..."/>
        <button onClick={confirmer} disabled={saving}
          style={{width:"100%",background:C.rose,color:"white",border:"none",borderRadius:9,padding:".6rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:".5rem"}}>
          {saving?"...":choix?"Confirmer":"Je ne sais pas / pas de marraine"}
        </button>
        <button onClick={()=>{setShow(false);setDismissed(true);}}
          style={{width:"100%",background:"none",border:"none",color:C.gris,fontSize:".7rem",cursor:"pointer",fontFamily:"inherit",padding:".2rem"}}>
          Plus tard
        </button>
      </div>
    </div>
  );
}


function AnnonceBanner({uid}){
  const[annonce,setAnnonce]=useState(null);
  const[showPopup,setShowPopup]=useState(false);
  const[dismissed,setDismissed]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap = await getDoc(doc(db,"admin","annonce"));
        if(snap.exists()&&snap.data().actif&&snap.data().message){
          const a = snap.data();
          setAnnonce(a);
          const vu = await sg(uid,"db-annonce-vue");
          if(!vu || +vu !== a.ts){
            setShowPopup(true);
          }
        }
      }catch{}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[uid]);

  const fermerPopup=()=>{
    setShowPopup(false);
    if(annonce) ss(uid,"db-annonce-vue",String(annonce.ts));
  };

  if(!annonce||dismissed) return null;

  return(
    <>
      {showPopup&&(
        <div style={{position:"fixed",inset:0,background:"rgba(61,31,14,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9998,padding:"1rem"}}>
          <div style={{background:C.blanc,borderRadius:16,padding:"1.4rem",maxWidth:380,width:"100%",boxShadow:"0 10px 40px rgba(0,0,0,.25)"}}>
            <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".18em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>📣 ANNONCE IMPORTANTE</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",color:C.brun,lineHeight:1.6,marginBottom:"1.2rem",whiteSpace:"pre-wrap"}}>{annonce.message}</div>
            <button onClick={fermerPopup}
              style={{width:"100%",background:C.rose,color:"white",border:"none",borderRadius:9,padding:".6rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              Compris !
            </button>
          </div>
        </div>
      )}
      <div style={{background:"linear-gradient(135deg,rgba(196,168,130,.15),rgba(196,154,138,.1))",border:`1px solid ${C.or}50`,borderRadius:12,padding:".8rem 1rem",marginBottom:"1rem",display:"flex",gap:".6rem",alignItems:"flex-start"}}>
        <div style={{fontSize:"1.1rem",flexShrink:0}}>📣</div>
        <div style={{flex:1}}>
          <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.brun,marginBottom:".2rem"}}>Annonce</div>
          <div style={{fontSize:".74rem",color:C.texte,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{annonce.message}</div>
        </div>
        <button onClick={()=>setDismissed(true)}
          style={{background:"none",border:"none",color:C.gris,cursor:"pointer",fontSize:".75rem",flexShrink:0,padding:".1rem"}}>✕</button>
      </div>
    </>
  );
}

function AdminAnnuaireSync(){
  const[status,setStatus]=useState(null);
  const[loading,setLoading]=useState(false);

  const run=async()=>{
    setLoading(true);
    const added = await seedAnnuaireFromMembres();
    setStatus(added);
    setLoading(false);
  };

  return(
    <div>
      <button onClick={run} disabled={loading}
        style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:9,padding:".55rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
        {loading?"Synchronisation...":"🔄 Synchroniser tous les membres maintenant"}
      </button>
      {status!==null&&(
        <div style={{fontSize:".68rem",color:C.vert,marginTop:".5rem",textAlign:"center"}}>
          ✅ {status} nouveau{status>1?"x":""} membre{status>1?"s":""} ajouté{status>1?"s":""} à l'annuaire.
        </div>
      )}
    </div>
  );
}


function AdminAnnonceEditor(){
  const[message,setMessage]=useState("");
  const[actif,setActif]=useState(false);
  const[loaded,setLoaded]=useState(false);
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","annonce"));
        if(snap.exists()){
          setMessage(snap.data().message||"");
          setActif(!!snap.data().actif);
        }
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const save=async(nextActif)=>{
    setSaving(true);
    try{
      await setDoc(doc(db,"admin","annonce"),{message, actif:nextActif, ts:Date.now()});
      setActif(nextActif);
      setSaved(true);
      setTimeout(()=>setSaved(false),2500);
    }catch{}
    setSaving(false);
  };

  if(!loaded) return <div style={{fontSize:".74rem",color:C.gris}}>Chargement...</div>;

  return(
    <div>
      <textarea placeholder="Ex: La soirée formation de ce soir est décalée à 21h !" value={message} onChange={e=>setMessage(e.target.value)}
        style={{width:"100%",minHeight:90,border:`1px solid ${C.pale}`,borderRadius:9,padding:".6rem .8rem",fontFamily:"inherit",fontSize:".8rem",color:C.texte,background:C.creme,resize:"vertical",outline:"none",lineHeight:1.6,marginBottom:".6rem"}}/>
      {actif&&(
        <div style={{fontSize:".68rem",color:C.vert,fontWeight:600,marginBottom:".6rem"}}>✓ Annonce actuellement active — visible par toute l'équipe</div>
      )}
      <div style={{display:"flex",gap:".5rem"}}>
        <button onClick={()=>save(true)} disabled={saving||!message.trim()}
          style={{flex:1,background:C.rose,color:"white",border:"none",borderRadius:9,padding:".55rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          {saving?"...":saved?"✅ Publié !":"Publier l'annonce"}
        </button>
        {actif&&(
          <button onClick={()=>save(false)} disabled={saving}
            style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:9,padding:".55rem .9rem",fontSize:".78rem",color:C.gris,fontFamily:"inherit",cursor:"pointer"}}>
            Désactiver
          </button>
        )}
      </div>
    </div>
  );
}



const FAST_START_DAYS=[
  {jour:1,titre:"Premiers pas",taches:[
    {t:"Regarde la vidéo de bienvenue de l'équipe (onglet Démarrage, Partie 1)",link:{sub:"demarrage",label:"Voir Démarrage — Partie 1"}},
    "Configure ta boutique Mihi personnelle",
    "Rejoins le groupe Facebook et le Telegram de l'équipe",
  ]},
  {jour:2,titre:"Ta liste de contacts",taches:[
    "Liste tes 20 premiers contacts (famille, amis, collègues...)",
    "Note pour chacun une info personnelle (besoin, situation, lien avec toi)",
    "Identifie 3 personnes \"chaudes\" pour commencer",
  ]},
  {jour:3,titre:"Ton profil",taches:[
    {t:"Optimise ta bio (photo pro + description + lien)",link:{sub:"demarrage",label:"Voir Démarrage — Partie 3 (Profil & contenu)"}},
    {t:"Publie ton post de lancement (authentique, pas copié-collé)",link:{sub:"demarrage",label:"Voir Démarrage — Partie 2 (Post de lancement)"}},
    "Partage-le sur Instagram ET Facebook",
  ]},
  {jour:4,titre:"Premiers messages",taches:[
    {t:"Envoie ce message à 5 personnes de ta liste : \"Coucou, ça fait longtemps ! Comment tu vas ?\"",link:{sub:"demarrage",label:"Voir Démarrage — Partie 4 (Prospection & suivi)"}},
    "Réponds à tous les commentaires/réactions sur ton post de lancement",
    "Note les réponses dans tes prospects (onglet Prospects)",
  ]},
  {jour:5,titre:"Story et interaction",taches:[
    {t:"Publie une story \"question du jour\" pour générer des réponses en DM",link:{sub:"demarrage",label:"Voir Démarrage — Partie 6 (Réseaux sociaux)"}},
    "Interagis avec 10 comptes ciblés (vrais commentaires, pas juste des likes)",
    "Relance 2 personnes qui n'ont pas répondu au message du J4",
  ]},
  {jour:6,titre:"Première présentation",taches:[
    "Repère 1 personne intéressée pour lui présenter les produits ou l'opportunité",
    {t:"Pratique ton pitch express (30 sec) à voix haute 3 fois",link:{sub:"demarrage",label:"Voir Démarrage — Partie 5 (Présentations & closing)"}},
    "Fixe un moment pour ta première vraie présentation",
  ]},
  {jour:7,titre:"Bilan et célébration",taches:[
    "Fais le bilan de ta semaine : combien de contacts, de réponses, de ventes/recrues ?",
    "Note 3 choses que tu as bien faites cette semaine",
    {t:"Célèbre — même un petit pas est une victoire ! 🎉 (Et regarde la suite dans Démarrage, Parties 2 à 8)",link:{sub:"demarrage",label:"Voir la suite — Démarrage Parties 2 à 8"}},
  ]},
];

function FastStartTab({uid, userName, goToFormation}){
  const[startDate,setStartDate]=useState(null);
  const[doneTasks,setDoneTasks]=useState({});
  const[loaded,setLoaded]=useState(false);
  const[confettiTrigger,setConfettiTrigger]=useState(0);

  useEffect(()=>{
    (async()=>{
      const data = await sg(uid,"db-fast-start");
      if(data){
        const parsed = JSON.parse(data);
        setStartDate(parsed.startDate);
        setDoneTasks(parsed.doneTasks||{});
      }
      setLoaded(true);
    })();
  },[uid]);

  const demarrer=()=>{
    const today = new Date().toISOString().slice(0,10);
    setStartDate(today);
    ss(uid,"db-fast-start",JSON.stringify({startDate:today, doneTasks:{}}));
  };

  const currentDay = startDate
    ? Math.min(7, Math.max(1, Math.floor((Date.now()-new Date(startDate).getTime())/86400000)+1))
    : 1;

  const toggleTask=(jour,idx)=>{
    const key=`${jour}-${idx}`;
    const next={...doneTasks,[key]:!doneTasks[key]};
    setDoneTasks(next);
    ss(uid,"db-fast-start",JSON.stringify({startDate, doneTasks:next}));

    // Vérifier si toute la semaine est terminée
    const allDone = FAST_START_DAYS.every(d=>d.taches.every((_,i)=>next[`${d.jour}-${i}`]));
    if(allDone){
      setConfettiTrigger(t=>t+1);
      postToWallOfFame(uid, userName, `a terminé son parcours Fast Start (7 jours) ! 🚀`, "🌟");
    }
  };

  if(!loaded) return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  if(!startDate){
    return(
      <div style={{textAlign:"center",padding:"2rem 1rem"}}>
        <Confetti trigger={confettiTrigger}/>
        <div style={{fontSize:"2.5rem",marginBottom:".5rem"}}>🚀</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",fontWeight:300,color:C.brun,marginBottom:".5rem"}}>
          Bienvenue dans <em style={{fontStyle:"italic",color:C.rose}}>Blazing Dynasty</em> !
        </div>
        <p style={{fontSize:".78rem",color:C.gris,lineHeight:1.7,marginBottom:"1.5rem",maxWidth:340,marginLeft:"auto",marginRight:"auto"}}>
          On va t'accompagner pas à pas pendant tes 7 premiers jours.<br/>
          Chaque jour, seulement quelques tâches simples — pas de quoi être débordée, juste avancer un peu chaque jour.
        </p>
        <button onClick={demarrer}
          style={{background:C.rose,color:"white",border:"none",borderRadius:10,padding:".65rem 1.4rem",fontSize:".82rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          Commencer mon J1 !
        </button>
      </div>
    );
  }

  const totalTaches = FAST_START_DAYS.reduce((s,d)=>s+d.taches.length,0);
  const totalDone = Object.values(doneTasks).filter(Boolean).length;
  const pctGlobal = Math.round(totalDone/totalTaches*100);
  const allDone = totalDone===totalTaches;

  return(
    <div>
      <Confetti trigger={confettiTrigger}/>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Fast <em style={{fontStyle:"italic",color:C.rose}}>Start</em> — J1 à J7
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        {allDone ? "Bravo, tu as terminé ton parcours Fast Start ! 🎉 La suite t'attend dans Démarrage." : `Tu es au Jour ${currentDay}. Avance à ton rythme — chaque petite tâche compte.`}
      </p>

      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:".62rem",color:C.gris,marginBottom:".3rem"}}>
          <span>Progression globale</span>
          <span style={{fontWeight:700,color:pctGlobal===100?C.vert:C.rose}}>{totalDone}/{totalTaches} ({pctGlobal}%)</span>
        </div>
        <div style={{height:8,background:C.pale,borderRadius:10,overflow:"hidden"}}>
          <div style={{height:"100%",background:pctGlobal===100?C.vert:C.rose,width:pctGlobal+"%",borderRadius:10,transition:"width .4s"}}/>
        </div>
      </div>

      {FAST_START_DAYS.map(d=>{
        const isCurrent = d.jour===currentDay && !allDone;
        const dayDone = d.taches.every((_,i)=>doneTasks[`${d.jour}-${i}`]);
        const isLocked = d.jour > currentDay && !allDone;
        return(
          <div key={d.jour} style={{background:isCurrent?"rgba(196,154,138,.08)":C.blanc,border:`1.5px solid ${isCurrent?C.rose:dayDone?C.vert+"60":C.pale}`,borderRadius:12,padding:".85rem 1rem",marginBottom:".6rem",opacity:isLocked?.55:1}}>
            <div style={{display:"flex",alignItems:"center",gap:".5rem",marginBottom:".5rem"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:dayDone?C.vert:isCurrent?C.rose:C.pale,color:"white",fontSize:".72rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {dayDone?"✓":`J${d.jour}`}
              </div>
              <div style={{fontFamily:"Georgia,serif",fontSize:".92rem",fontWeight:600,color:C.brun}}>{d.titre}</div>
              {isCurrent&&<span style={{fontSize:".58rem",fontWeight:700,color:C.rose,background:C.rose+"15",borderRadius:20,padding:".1rem .5rem",marginLeft:"auto"}}>Aujourd'hui</span>}
            </div>
            {d.taches.map((tk,i)=>{
              const key=`${d.jour}-${i}`;
              const checked=doneTasks[key];
              const isObj = typeof tk === "object";
              const label = isObj ? tk.t : tk;
              const link = isObj ? tk.link : null;
              return(
                <div key={key} style={{padding:".35rem 0"}}>
                  <div onClick={()=>!isLocked&&toggleTask(d.jour,i)}
                    style={{display:"flex",alignItems:"flex-start",gap:".55rem",cursor:isLocked?"default":"pointer"}}>
                    <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${checked?C.vert:C.pale}`,background:checked?C.vert:"transparent",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {checked&&<span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>}
                    </div>
                    <div style={{fontSize:".74rem",color:checked?C.gris:C.texte,textDecoration:checked?"line-through":"none",lineHeight:1.5}}>{label}</div>
                  </div>
                  {link&&!isLocked&&(
                    <div onClick={()=>goToFormation&&goToFormation(link.sub)}
                      style={{marginLeft:"1.55rem",marginTop:".3rem",display:"inline-flex",alignItems:"center",gap:".35rem",fontSize:".66rem",fontWeight:600,color:C.rose,cursor:"pointer"}}>
                      ▶ {link.label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}



const PRODUITS_DEFAULT=[
  {id:"sk-anti-age",categorie:"Skincare",icon:"✨",nom:"Crème/Sérum anti-âge",besoins:"Rides, fermeté, peau mature",pointsForts:"Actifs concentrés, résultats visibles, texture premium",prix:""},
  {id:"sk-hydratant",categorie:"Skincare",icon:"✨",nom:"Soin hydratant visage",besoins:"Peau sèche, déshydratée, tiraillements",pointsForts:"Hydratation longue durée, confort immédiat",prix:""},
  {id:"sk-nettoyant",categorie:"Skincare",icon:"✨",nom:"Mousse / gel nettoyant",besoins:"Nettoyage en douceur, peaux sensibles",pointsForts:"Respecte le film hydrolipidique, non agressif",prix:""},
  {id:"sk-contour",categorie:"Skincare",icon:"✨",nom:"Contour des yeux",besoins:"Cernes, poches, ridules",pointsForts:"Effet coup d'éclat immédiat, action longue durée",prix:""},
  {id:"sk-gommage",categorie:"Skincare",icon:"✨",nom:"Gommage visage",besoins:"Peau terne, pores bouchés, teint irrégulier",pointsForts:"Grains fins, action douce, peau lissée immédiatement",prix:""},

  {id:"ch-secs",categorie:"Soins cheveux",icon:"💇",nom:"Shampoing/Soin cheveux secs",besoins:"Cheveux secs, abîmés, pointes fourchues",pointsForts:"Nutrition intense, résultats comparables marques pro",prix:""},
  {id:"ch-gras",categorie:"Soins cheveux",icon:"💇",nom:"Shampoing cheveux gras / racines",besoins:"Racines grasses, cheveux qui regraissent vite",pointsForts:"Effet purifiant, fraîcheur longue durée",prix:""},
  {id:"ch-reparateur",categorie:"Soins cheveux",icon:"💇",nom:"Baume / masque réparateur",besoins:"Cheveux colorés, cassants, abîmés par la chaleur",pointsForts:"Répare la fibre en profondeur, brillance retrouvée",prix:""},
  {id:"ch-volume",categorie:"Soins cheveux",icon:"💇",nom:"Soin volumateur",besoins:"Cheveux fins, sans volume, qui s'aplatissent",pointsForts:"Effet volume visible dès la première utilisation",prix:""},
  {id:"ch-anticalc",categorie:"Soins cheveux",icon:"💇",nom:"Soin anti-calcaire/eau dure",besoins:"Cheveux qui nettoient mal avec l'eau du robinet, dépôts calcaires",pointsForts:"Nettoie sans abîmer ni dessécher, douceur préservée",prix:""},

  {id:"mu-mascara",categorie:"Make-up",icon:"💄",nom:"Mascara volume",besoins:"Cils plats, peu de tenue, envie de volume",pointsForts:"Volume immédiat, longue tenue, qualité pro",prix:""},
  {id:"mu-fdt",categorie:"Make-up",icon:"💄",nom:"Fond de teint matifiant",besoins:"Peau grasse, brillances, envie de teint unifié",pointsForts:"Tenue longue durée, fini matifié naturel",prix:""},
  {id:"mu-rouge",categorie:"Make-up",icon:"💄",nom:"Rouge à lèvres longue tenue",besoins:"Couleur qui ne tient pas, lèvres sèches",pointsForts:"Tenue longue durée, confort, large choix de teintes",prix:""},
  {id:"mu-teint",categorie:"Make-up",icon:"💄",nom:"Correcteur / anti-cernes",besoins:"Cernes, imperfections, teint terne",pointsForts:"Couvrance modulable, fini naturel",prix:""},

  {id:"co-detox",categorie:"Compléments alimentaires",icon:"💊",nom:"Détox / draineur",besoins:"Sensation de lourdeur, rétention, besoin de \"reset\"",pointsForts:"Formule naturelle, effet ressenti rapidement",prix:""},
  {id:"co-brulegraisse",categorie:"Compléments alimentaires",icon:"💊",nom:"Brûle-graisses / métabolisme",besoins:"Perte de poids, coup de pouce métabolisme",pointsForts:"Booste l'énergie, soutient la perte de poids",prix:""},
  {id:"co-vitamines",categorie:"Compléments alimentaires",icon:"💊",nom:"Vitamines / énergie",besoins:"Fatigue, baisse d'énergie, immunité",pointsForts:"Formule complète, effet ressenti sur l'énergie quotidienne",prix:""},
  {id:"co-ginkgo",categorie:"Compléments alimentaires",icon:"💊",nom:"Ginkgo biloba / circulation",besoins:"Jambes lourdes, mémoire, circulation",pointsForts:"Plante reconnue, action ciblée",prix:""},

  {id:"pa-femme",categorie:"Parfums",icon:"🌸",nom:"Parfum Femme",besoins:"Envie d'un nouveau parfum, budget serré sur les grandes marques",pointsForts:"Qualité comparable aux grandes marques, à moins de 20€",prix:""},
  {id:"pa-homme",categorie:"Parfums",icon:"🌸",nom:"Parfum Homme",besoins:"Cadeau homme, parfum du quotidien",pointsForts:"Sillage qualitatif, prix très accessible",prix:""},

  {id:"sc-gommage-or",categorie:"Soin corps",icon:"🧴",nom:"Gommage effet or",besoins:"Peau terne, envie de rituel cocooning",pointsForts:"Expérience sensorielle premium, peau douce immédiatement",prix:""},
  {id:"sc-baume",categorie:"Soin corps",icon:"🧴",nom:"Baume satiné corps",besoins:"Peau sèche, manque d'éclat",pointsForts:"Hydratation longue durée, fini satiné non gras",prix:""},
  {id:"sc-enveloppement",categorie:"Soin corps",icon:"🧴",nom:"Enveloppement / soin minceur",besoins:"Cellulite, fermeté, rituel minceur",pointsForts:"Effet rituel spa, parfait pour box cadeaux",prix:""},
];

function ProduitsSearchTab(){
  const[search,setSearch]=useState("");
  const[produits,setProduits]=useState(PRODUITS_DEFAULT);
  const[loaded,setLoaded]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","produits"));
        if(snap.exists()&&snap.data().items&&snap.data().items.length>0) setProduits(snap.data().items);
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const q = search.trim().toLowerCase();
  const resultats = !q ? [] : produits.filter(p=>
    p.nom.toLowerCase().includes(q) ||
    p.besoins.toLowerCase().includes(q) ||
    p.categorie.toLowerCase().includes(q) ||
    p.pointsForts.toLowerCase().includes(q)
  );

  const parCategorie = {};
  produits.forEach(p=>{ parCategorie[p.categorie]=(parCategorie[p.categorie]||0)+1; });

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Recherche <em style={{fontStyle:"italic",color:C.rose}}>Produits</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Ta cliente te demande "qu'est-ce que tu as pour..." ? Tape le mot-clé ici 👇
      </p>

      <input placeholder="Ex: cheveux secs, calcaire, anti-âge, mascara..." value={search} onChange={e=>setSearch(e.target.value)}
        style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".55rem .8rem",fontSize:".82rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:"1rem"}}/>

      {!q&&(
        <div>
          <div style={{fontSize:".62rem",color:C.gris,marginBottom:".5rem"}}>Catégories disponibles :</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:".4rem"}}>
            {Object.entries(parCategorie).map(([cat,count])=>(
              <div key={cat} style={{padding:".35rem .75rem",borderRadius:20,fontSize:".7rem",fontWeight:600,border:`1px solid ${C.pale}`,background:C.blanc,color:C.brun}}>
                {produits.find(p=>p.categorie===cat)?.icon} {cat} ({count})
              </div>
            ))}
          </div>
          {!loaded&&<div style={{textAlign:"center",padding:"1rem",color:C.gris,fontSize:".74rem"}}>Chargement...</div>}
        </div>
      )}

      {q&&resultats.length===0&&(
        <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".76rem"}}>
          Aucun produit trouvé pour "{search}".<br/>Essaie un autre mot-clé (ex: peau, cheveux, parfum...).
        </div>
      )}

      {resultats.map(p=>(
        <div key={p.id} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem 1rem",marginBottom:".6rem"}}>
          <div style={{display:"flex",gap:".6rem",alignItems:"flex-start"}}>
            <div style={{fontSize:"1.4rem",flexShrink:0}}>{p.icon}</div>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:".5rem"}}>
                <div style={{fontFamily:"Georgia,serif",fontSize:".95rem",fontWeight:600,color:C.brun}}>{p.nom}</div>
                {p.prix&&<div style={{fontSize:".85rem",fontWeight:700,color:C.rose,flexShrink:0}}>{p.prix}€</div>}
              </div>
              <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:C.lilas,marginTop:".15rem"}}>{p.categorie}</div>
              <div style={{fontSize:".7rem",color:C.gris,marginTop:".4rem"}}><strong>Pour :</strong> {p.besoins}</div>
              <div style={{fontSize:".7rem",color:C.texte,marginTop:".25rem"}}><strong>Points forts :</strong> {p.pointsForts}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Éditeur admin pour les prix produits (Melissa)
function AdminProduitsEditor(){
  const[produits,setProduits]=useState(PRODUITS_DEFAULT);
  const[loaded,setLoaded]=useState(false);
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","produits"));
        if(snap.exists()&&snap.data().items&&snap.data().items.length>0) setProduits(snap.data().items);
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const updatePrix=(id,prix)=>{
    setProduits(prev=>prev.map(p=>p.id===id?{...p,prix}:p));
  };

  const save=async()=>{
    setSaving(true);
    try{
      await setDoc(doc(db,"admin","produits"),{items:produits});
      setSaved(true);
      setTimeout(()=>setSaved(false),2500);
    }catch{}
    setSaving(false);
  };

  if(!loaded) return <div style={{fontSize:".74rem",color:C.gris}}>Chargement...</div>;

  const categories = [...new Set(produits.map(p=>p.categorie))];

  return(
    <div>
      {categories.map(cat=>(
        <div key={cat} style={{marginBottom:"1rem"}}>
          <div style={{fontSize:".65rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.brun,marginBottom:".4rem"}}>{cat}</div>
          {produits.filter(p=>p.categorie===cat).map(p=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:".5rem",padding:".4rem 0",borderBottom:`1px solid ${C.pale}`}}>
              <div style={{flex:1,fontSize:".74rem",color:C.texte}}>{p.nom}</div>
              <input type="number" placeholder="Prix €" value={p.prix||""} onChange={e=>updatePrix(p.id,e.target.value)}
                style={{width:80,border:`1px solid ${C.pale}`,borderRadius:6,padding:".3rem .5rem",fontSize:".74rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none",fontWeight:600}}/>
            </div>
          ))}
        </div>
      ))}
      <button onClick={save} disabled={saving}
        style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:9,padding:".55rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
        {saving?"Sauvegarde...":saved?"✅ Sauvegardé !":"Sauvegarder les prix"}
      </button>
    </div>
  );
}



const OBJECTIONS_VENTE = [
  {id:"prix",icon:"💸",label:"\"C'est trop cher\"",
    reponses:[
      "Je te comprends, c'est un budget ! Cela dit, ramené à l'usage quotidien, ça revient à moins d'1€/jour pour un soin qui dure {durée}. Tu veux que je te montre le détail ?",
      "C'est vrai que sur le moment ça peut sembler élevé, mais c'est un produit concentré donc tu en utilises très peu à chaque fois — il te dure beaucoup plus longtemps qu'un produit classique 😊",
      "Je te propose qu'on regarde ensemble ce qui correspond le mieux à ton budget — il y a souvent une alternative plus accessible qui donne déjà de très bons résultats !",
    ]},
  {id:"reflexion",icon:"🤔",label:"\"Je vais réfléchir\"",
    reponses:[
      "Bien sûr, prends le temps qu'il te faut 🙂 Je reste dispo si tu as des questions en attendant. Tu veux que je te recontacte dans quelques jours pour en discuter ?",
      "Pas de souci ! Pour t'aider à réfléchir, est-ce qu'il y a un point en particulier qui te freine ? Le prix, le produit, le moment... je peux peut-être éclaircir ça.",
      "Je comprends totalement. Sache que l'offre/le tarif actuel peut évoluer, donc si jamais tu te décides, dis-le moi et je te garde au courant 😊",
    ]},
  {id:"deja-produit",icon:"🧴",label:"\"J'ai déjà un produit similaire\"",
    reponses:[
      "Top, ça veut dire que tu prends déjà soin de toi ! Qu'est-ce que tu aimes / n'aimes pas dans ce que tu utilises actuellement ? Ça m'aide à voir si ça vaut le coup de changer.",
      "C'est noté ! Sur quoi tu n'es pas 100% satisfaite avec ton produit actuel ? Parfois on découvre une vraie différence sur un point précis (texture, odeur, résultat...).",
      "Aucun souci, pas besoin de tout changer d'un coup — beaucoup de mes clientes commencent par essayer un seul produit en complément pour voir la différence 🙂",
    ]},
  {id:"pas-besoin",icon:"🙅",label:"\"Je n'en ai pas besoin\"",
    reponses:[
      "Je comprends ! Est-ce que je peux te poser une petite question : as-tu une préoccupation particulière en ce moment (peau, cheveux, énergie...) ? Histoire de voir si ça pourrait t'aider sans pression 😊",
      "Pas de souci du tout ! Si jamais ça change ou que tu as une question un jour, je suis là 🙂",
      "C'est noté ! Est-ce que ça t'intéresserait quand même que je t'envoie une petite astuce ou un conseil de temps en temps, sans obligation d'achat ?",
    ]},
  {id:"pas-le-temps",icon:"⏰",label:"\"Je n'ai pas le temps d'essayer\"",
    reponses:[
      "Je te rassure, c'est justement pensé pour les vies bien remplies — {temps_application} et c'est fait, ça s'intègre facilement dans une routine déjà existante.",
      "Je comprends totalement ! Et si je t'envoyais juste un petit échantillon/une astuce simple à tester quand tu auras 2 minutes, sans pression ?",
      "Pas de souci, on peut aussi en reparler à un moment qui te convient mieux. Quand est-ce que ce serait plus simple pour toi ?",
    ]},
];

const OBJECTIONS_RECRUTEMENT = [
  {id:"pas-le-temps-recrut",icon:"⏰",label:"\"Je n'ai pas le temps\"",
    reponses:[
      "Je te comprends complètement, c'est exactement pour ça que ce projet est pensé en flexible — tu avances à ton rythme, même 30 min par jour suffisent pour commencer 😊",
      "C'est justement le côté intéressant : tu choisis TES horaires. Beaucoup de filles dans l'équipe ont commencé en plus de leur job/famille, en grappillant des petits moments.",
      "Je comprends ! Et si on regardait ensemble à quoi pourrait ressembler ton planning si tu démarrais en mode \"léger\" pour tester, sans pression ?",
    ]},
  {id:"pas-vendeuse",icon:"🙊",label:"\"Je ne sais pas vendre / je ne suis pas à l'aise\"",
    reponses:[
      "Tu sais, moi non plus au départ je n'étais pas \"vendeuse\" — c'est justement pour ça qu'il y a toute une formation et un accompagnement pas à pas, on n'est jamais seule !",
      "C'est très commun, et c'est rassurant : tout le monde démarre comme ça. Le plus important c'est d'être soi-même et de partager ce qu'on aime — le reste s'apprend avec le temps et le soutien de l'équipe.",
      "Je te rassure, vendre n'est pas le point de départ ! On commence par partager son expérience avec des produits qu'on utilise déjà et qu'on aime. Le reste vient naturellement 🙂",
    ]},
  {id:"argent-investir",icon:"💰",label:"\"Je n'ai pas d'argent à investir\"",
    reponses:[
      "Je comprends totalement, c'est une vraie question à se poser. Le kit de démarrage est pensé pour être accessible, et l'idée c'est qu'il se rentabilise vite avec les premières ventes — tu veux qu'on regarde les chiffres ensemble ?",
      "C'est exactement pour ça qu'il existe différentes options de démarrage selon le budget — on peut regarder ensemble celle qui te convient le mieux, sans pression.",
      "Je te rassure, ce n'est pas un investissement énorme, et beaucoup le voient comme \"se faire plaisir avec des produits qu'on utilise + se former en plus\". Et si on en discutait pour voir ce qui est réaliste pour toi ?",
    ]},
  {id:"deja-essaye",icon:"😕",label:"\"J'ai déjà essayé un MLM et ça n'a pas marché\"",
    reponses:[
      "Je comprends, ça peut laisser une mauvaise expérience... Qu'est-ce qui n'avait pas fonctionné selon toi ? Ça m'aide à voir si ici ce serait différent pour toi.",
      "Merci de me le dire honnêtement. Chaque entreprise et chaque équipe est différente — ici, l'accompagnement et la formation sont au cœur du projet, justement pour éviter ce qui n'avait pas marché avant.",
      "C'est une expérience qui compte ! Est-ce que ça te dérangerait qu'on en discute 10 minutes pour voir ce qui était différent, et si la situation aujourd'hui pourrait changer la donne ?",
    ]},
  {id:"avis-conjoint",icon:"👫",label:"\"Je dois en parler à mon conjoint / réfléchir en famille\"",
    reponses:[
      "C'est totalement normal et même une bonne idée d'en discuter ensemble ! Si ça peut aider, je peux t'envoyer un récap simple avec les infos clés à partager avec lui/elle 😊",
      "Bien sûr, prends le temps qu'il faut. Est-ce qu'il y a des questions précises qu'il/elle pourrait avoir, pour que je puisse t'aider à y répondre dès maintenant ?",
      "Aucun souci ! Je reste disponible si vous avez des questions tous les deux. Tu veux qu'on se refixe un moment dans quelques jours pour en reparler ?",
    ]},
];

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
      {open&&(()=>{
        const o = objections.find(x=>x.id===open);
        return(
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem"}}>
            <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".7rem"}}>{o.icon} Réponses possibles</div>
            {o.reponses.map((r,i)=>(
              <div key={i} style={{background:C.creme,borderLeft:`3px solid ${C.lilas}`,borderRadius:"0 8px 8px 0",padding:".6rem .8rem",fontSize:".74rem",color:C.texte,lineHeight:1.7,marginBottom:".5rem",display:"flex",justifyContent:"space-between",gap:".5rem",alignItems:"flex-start"}}>
                <span style={{flex:1}}>{r}</span>
                <CopyBtn text={r}/>
              </div>
            ))}
            <div style={{fontSize:".6rem",color:C.gris,fontStyle:"italic",marginTop:".3rem"}}>
              💡 Adapte le ton et les détails (durée, prénom...) à ta conversation avant d'envoyer.
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function ObjectionsTab(){
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
  );
}

// ── OBJECTIFS ÉQUIPE ──────────────────────────────────────────────────────────
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
    {key:"ventes",icon:"🛍️",label:"Ventes ce mois",color:C.rose},
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

// ── CALENDRIER ────────────────────────────────────────────────────────────────
const FETES_IMPORTANTES=[
  // ── JANVIER ──
  {title:"🎆 Nouvel An",date:"2026-01-01",type:"fete",notes:"Bonne résolution beauté & bien-être — moment idéal pour pitcher"},
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

function CalendrierTab({uid,userName,isMelissa,isChef}){
  const[events,setEvents]=useState([]);
  const[loaded,setLoaded]=useState(false);
  const[showAdd,setShowAdd]=useState(false);
  const[showFetes,setShowFetes]=useState(true);
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

  const EventCard=({e,canDel})=>{
    const cfg=EVENT_TYPES[e.type]||EVENT_TYPES.other;
    const d=new Date(e.dateTs);
    const isPast=d<today;
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
              </div>
            </div>
          </div>
          {canDel&&(
            <button onClick={()=>delEvent(e.id)} style={{background:"none",border:"none",color:C.pale,cursor:"pointer",fontSize:".75rem",padding:".2rem",fontFamily:"inherit",flexShrink:0}}>✕</button>
          )}
        </div>
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
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Calendrier <em style={{fontStyle:"italic",color:C.rose}}>Équipe</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Événements partagés avec toute l'équipe. {canAdd?"Tu peux ajouter et supprimer des événements.":"Mis à jour par Melissa ou les chefs d'équipe."}
      </p>

      {canAdd&&(
        <button onClick={()=>setShowAdd(p=>!p)}
          style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:"1rem"}}>
          ➕ Ajouter un événement
        </button>
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
      <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.brun,marginBottom:".5rem"}}>
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
      {showFetes&&FETES_IMPORTANTES.filter(f=>new Date(f.date)>=new Date(new Date().setHours(0,0,0,0))).slice(0,6).map(f=>{
        const cfg=EVENT_TYPES[f.type]||EVENT_TYPES.other;
        const d=new Date(f.date);
        return(
          <div key={f.title} style={{background:C.blanc,border:`1px solid ${C.or}30`,borderRadius:12,padding:".8rem 1rem",marginBottom:".5rem",opacity:.9}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:".3rem"}}>
              <div style={{display:"flex",gap:".5rem",alignItems:"center"}}>
                <span style={{fontSize:"1.1rem",flexShrink:0}}>{cfg.icon}</span>
                <div>
                  <div style={{fontSize:".82rem",fontWeight:600,color:C.brun}}>{f.title}</div>
                  <span style={{fontSize:".62rem",color:C.gris}}>{d.toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"long"})}</span>
                </div>
              </div>
            </div>
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

// ── OBJECTIFS POPUP ───────────────────────────────────────────────────────────
// ── PÉRIODE MIHI ─────────────────────────────────────────────────────────────
// Période de 21 jours, commence un mercredi
// Référence : période en cours se termine dans 6j 12h à partir d'aujourd'hui (11/06/2026)
function getPeriodeInfo(){
  const now = new Date();
  // Référence : prochain mercredi de fin = 11/06/2026 + 6j12h = 18/06/2026 à 12h00
  const refEnd = new Date("2026-06-18T12:00:00");
  
  // Calculer le nombre de périodes écoulées depuis refEnd
  const PERIOD_MS = 21 * 24 * 60 * 60 * 1000;
  let periodEnd = new Date(refEnd);
  
  // Avancer ou reculer jusqu'à la prochaine fin de période
  while(periodEnd <= now) periodEnd = new Date(periodEnd.getTime() + PERIOD_MS);
  while(periodEnd - now > PERIOD_MS) periodEnd = new Date(periodEnd.getTime() - PERIOD_MS);
  
  const periodStart = new Date(periodEnd.getTime() - PERIOD_MS);
  const msLeft = periodEnd - now;
  
  const daysLeft = Math.floor(msLeft / (1000*60*60*24));
  const hoursLeft = Math.floor((msLeft % (1000*60*60*24)) / (1000*60*60));
  const pctElapsed = Math.round((1 - msLeft/PERIOD_MS)*100);
  
  // Numéro de période (depuis refEnd)
  const periodNum = Math.floor((now - new Date("2024-01-03")) / PERIOD_MS) + 1;
  
  return { daysLeft, hoursLeft, pctElapsed, periodEnd, periodStart, periodNum };
}

function PeriodeTimer(){
  const[info,setInfo]=useState(getPeriodeInfo());
  useEffect(()=>{
    const t=setInterval(()=>setInfo(getPeriodeInfo()),60000);
    return()=>clearInterval(t);
  },[]);
  
  const urgent = info.daysLeft < 3;
  
  return(
    <div style={{background:urgent?"#FFF3E0":C.creme,border:`1px solid ${urgent?"#E6A817":C.pale}`,borderRadius:10,padding:".65rem .85rem",marginBottom:".75rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".35rem"}}>
        <div style={{fontSize:".65rem",fontWeight:700,color:urgent?"#8B5E00":C.brun}}>
          ⏱️ Période en cours
        </div>
        <div style={{fontSize:".65rem",fontWeight:700,color:urgent?"#C44B1A":C.rose}}>
          {info.daysLeft}j {info.hoursLeft}h restants{urgent?" ⚠️":""}
        </div>
      </div>
      <div style={{height:6,background:C.pale,borderRadius:10,overflow:"hidden",marginBottom:".3rem"}}>
        <div style={{height:"100%",background:urgent?"#E6A817":C.rose,width:info.pctElapsed+"%",borderRadius:10,transition:"width .5s"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:".58rem",color:C.gris}}>
        <span>Début {info.periodStart.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</span>
        <span>{info.pctElapsed}% écoulé</span>
        <span>Fin {info.periodEnd.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</span>
      </div>
    </div>
  );
}

function ObjectifsPopup({uid}){
  const[obj,setObj]=useState(null);
  const[perso,setPerso]=useState(null);
  const[ptab,setPtab]=useState("perso");

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"equipe","objectifs"));
        if(snap.exists())setObj(snap.data());
      }catch{}
      if(uid){
        try{
          const snap2=await getDoc(doc(db,"users",uid));
          if(snap2.exists()&&snap2.data()["db-obj-perso"])
            setPerso(JSON.parse(snap2.data()["db-obj-perso"]));
        }catch{}
      }
    })();
  },[uid]);

  const pct=(r,o)=>{if(!o||!r)return 0;return Math.min(100,Math.round(+r/+o*100));};

  return(
    <div>
      {/* Timer période */}
      <div style={{padding:"1rem 1rem 0"}}><PeriodeTimer/></div>

      {/* Mini tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${C.pale}`}}>
        {[{id:"perso",label:"🎯 Mes objectifs"},{id:"ca",label:"💰 CA Équipe"}].map(t=>(
          <button key={t.id} onClick={()=>setPtab(t.id)}
            style={{flex:1,padding:".5rem",fontSize:".65rem",fontWeight:600,border:"none",borderBottom:`2px solid ${ptab===t.id?C.rose:"transparent"}`,background:"none",color:ptab===t.id?C.brun:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{padding:"1rem"}}>
        {/* MES OBJECTIFS */}
        {ptab==="perso"&&(
          !perso
          ? <div style={{textAlign:"center",padding:"1rem",fontSize:".74rem",color:C.gris}}>
              Définis tes objectifs dans<br/><strong>Tableau de bord → Mes objectifs</strong>
            </div>
          : <>
            {[
              {label:"💰 Mon CA",val:perso.ca,obj:perso.caObj,unit:"€",color:C.rose},
            ].map(({label,val,obj,unit,color})=>(
              <div key={label} style={{marginBottom:".65rem"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".25rem"}}>
                  <div style={{fontSize:".74rem",fontWeight:600,color:C.brun}}>{label}</div>
                  <div style={{display:"flex",gap:".3rem",alignItems:"center"}}>
                    <span style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:pct(val,obj)>=100?C.vert:color}}>{val||"—"}{unit}</span>
                    <span style={{fontSize:".6rem",color:C.gris}}>/ {obj||"—"}{unit}</span>
                    <span style={{background:color+"20",color:color,fontSize:".58rem",fontWeight:700,padding:".1rem .35rem",borderRadius:20}}>{pct(val,obj)}%</span>
                  </div>
                </div>
                <div style={{height:5,background:C.pale,borderRadius:10,overflow:"hidden"}}>
                  <div style={{height:"100%",background:pct(val,obj)>=100?C.vert:color,width:pct(val,obj)+"%",borderRadius:10,transition:"width .5s"}}/>
                </div>
              </div>
            ))}
            {perso.recruesObj&&perso.recruesObj!=="0"&&(
              <div style={{marginBottom:".65rem"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".25rem"}}>
                  <div style={{fontSize:".74rem",fontWeight:600,color:C.brun}}>👥 Mes recrues</div>
                  <div style={{display:"flex",gap:".3rem",alignItems:"center"}}>
                    <span style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:pct(perso.recruesReal,perso.recruesObj)>=100?C.vert:C.lilas}}>{perso.recruesReal||0}</span>
                    <span style={{fontSize:".6rem",color:C.gris}}>/ {perso.recruesObj}</span>
                    <span style={{background:C.lilas+"20",color:C.lilas,fontSize:".58rem",fontWeight:700,padding:".1rem .35rem",borderRadius:20}}>{pct(perso.recruesReal,perso.recruesObj)}%</span>
                  </div>
                </div>
                <div style={{height:5,background:C.pale,borderRadius:10,overflow:"hidden"}}>
                  <div style={{height:"100%",background:pct(perso.recruesReal,perso.recruesObj)>=100?C.vert:C.lilas,width:pct(perso.recruesReal,perso.recruesObj)+"%",borderRadius:10,transition:"width .5s"}}/>
                </div>
              </div>
            )}
            <div style={{background:C.creme,borderRadius:8,padding:".5rem .75rem",fontSize:".72rem",color:C.brun,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>🏆 Palier visé</span>
              <strong style={{color:C.or}}>{perso.palier||"2%"}</strong>
            </div>
          </>
        )}

        {/* ÉQUIPE */}
        {ptab==="ca"&&(
          !perso||!perso.caObj
          ? <div style={{textAlign:"center",padding:"1rem",fontSize:".74rem",color:C.gris}}>
              Définis ton objectif CA dans<br/><strong>Tableau de bord → Mes objectifs</strong>
            </div>
          : <>
            <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>💰 Mon CA cette période</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:".5rem"}}>
              <div style={{fontFamily:"Georgia,serif",fontSize:"2rem",fontWeight:600,color:C.brun}}>{perso.ca||0}€</div>
              <div style={{fontSize:".78rem",color:C.gris}}>objectif : <strong style={{color:C.brun}}>{perso.caObj}€</strong></div>
            </div>
            <div style={{height:10,background:C.pale,borderRadius:10,overflow:"hidden",marginBottom:".4rem"}}>
              <div style={{height:"100%",background:pct(perso.ca,perso.caObj)>=100?C.vert:C.rose,width:pct(perso.ca,perso.caObj)+"%",borderRadius:10,transition:"width .5s"}}/>
            </div>
            <div style={{textAlign:"right",fontSize:".72rem",fontWeight:700,color:pct(perso.ca,perso.caObj)>=100?C.vert:C.rose}}>
              {pct(perso.ca,perso.caObj)}%{pct(perso.ca,perso.caObj)>=100?" 🎉 Objectif atteint !":""}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

// ── GAMIFICATION (Lot 2a) ─────────────────────────────────────────────────────

// Pluie de confettis CSS pure, déclenchée à chaque changement de la prop "trigger"
function Confetti({trigger}){
  const [pieces, setPieces] = useState([]);
  useEffect(()=>{
    if(!trigger) return;
    const colors = [C.rose, C.or, C.lilas, C.vert, "#FFD700", C.brun2];
    const arr = Array.from({length:60},(_,i)=>({
      id: i+"-"+trigger,
      left: Math.random()*100,
      delay: Math.random()*0.4,
      duration: 2 + Math.random()*1.5,
      color: colors[Math.floor(Math.random()*colors.length)],
      size: 6 + Math.random()*6,
      rotate: Math.random()*360,
    }));
    setPieces(arr);
    const t = setTimeout(()=>setPieces([]), 3500);
    return ()=>clearTimeout(t);
  },[trigger]);

  if(pieces.length===0) return null;

  return(
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,overflow:"hidden"}}>
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity:1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity:0; }
        }
      `}</style>
      {pieces.map(p=>(
        <div key={p.id} style={{
          position:"absolute", top:0, left:p.left+"vw",
          width:p.size, height:p.size*0.4, background:p.color,
          animation:`confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
          borderRadius:2, transform:`rotate(${p.rotate}deg)`,
        }}/>
      ))}
    </div>
  );
}

// Feu d'artifice — pour les grandes célébrations (primes validées)
function Fireworks({trigger}){
  const [bursts, setBursts] = useState([]);
  useEffect(()=>{
    if(!trigger) return;
    const colors = [C.rose, C.or, C.lilas, C.vert, "#FFD700", "#FF6B6B", "#4ECDC4"];
    const arr = Array.from({length:5},(_,i)=>({
      id: i+"-"+trigger,
      x: 15 + Math.random()*70,
      y: 15 + Math.random()*50,
      delay: i*0.3,
      color: colors[Math.floor(Math.random()*colors.length)],
      particles: Array.from({length:16},(_,j)=>({
        angle: (j/16)*360,
        dist: 40+Math.random()*40,
      })),
    }));
    setBursts(arr);
    const t = setTimeout(()=>setBursts([]), 4500);
    return ()=>clearTimeout(t);
  },[trigger]);

  if(bursts.length===0) return null;

  return(
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,overflow:"hidden"}}>
      <style>{`
        @keyframes firework-particle {
          0% { transform: translate(0,0) scale(1); opacity:1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity:0; }
        }
        @keyframes firework-flash {
          0% { opacity:0; }
          15% { opacity:1; }
          100% { opacity:0; }
        }
      `}</style>
      {bursts.map(b=>(
        <div key={b.id} style={{position:"absolute",left:b.x+"vw",top:b.y+"vh",animation:`firework-flash 4s ${b.delay}s forwards`}}>
          {b.particles.map((p,i)=>(
            <div key={i} style={{
              position:"absolute",width:8,height:8,borderRadius:"50%",background:b.color,
              "--dx":`${Math.cos(p.angle*Math.PI/180)*p.dist}vw`,
              "--dy":`${Math.sin(p.angle*Math.PI/180)*p.dist}vh`,
              animation:`firework-particle 1.4s ease-out ${b.delay}s forwards`,
            }}/>
          ))}
        </div>
      ))}
    </div>
  );
}

// Définition des badges disponibles
const BADGES_DEF=[
  {id:"king-suivi",icon:"📞",label:"King du Suivi",desc:"10 actions de suivi validées",
    check:(d)=> (d.totalActionsValidees||0) >= 10},
  {id:"recruteur-elite",icon:"👑",label:"Recruteur Élite",desc:"5 recrues au total",
    check:(d)=> (d.totalRecrues||0) >= 5},
  {id:"premiere-recrue",icon:"🌱",label:"Première Recrue",desc:"Ta toute première recrue",
    check:(d)=> (d.totalRecrues||0) >= 1},
  {id:"regularite",icon:"🔥",label:"Régularité",desc:"5 jours de connexion d'affilée",
    check:(d)=> (d.streak||0) >= 5},
  {id:"regularite-or",icon:"⭐",label:"Régularité Or",desc:"15 jours de connexion d'affilée",
    check:(d)=> (d.streak||0) >= 15},
  {id:"objectif-ca",icon:"💰",label:"Objectif CA Atteint",desc:"100% de ton objectif CA du mois",
    check:(d)=> (d.pctCA||0) >= 100},
  {id:"objectif-recrues",icon:"🎯",label:"Objectif Recrues Atteint",desc:"100% de ton objectif recrues du mois",
    check:(d)=> (d.pctRecrues||0) >= 100},
  {id:"premiere-vente",icon:"💎",label:"Première Vente",desc:"Ton premier point CA enregistré",
    check:(d)=> (d.ca||0) > 0},
  {id:"semaine-parfaite",icon:"✅",label:"Semaine Parfaite",desc:"Les 5 actions du jour validées",
    check:(d)=> (d.doneCount||0) >= 5},
];

// Calcule les badges débloqués à partir des données de l'utilisatrice
function computeBadges(d){
  return BADGES_DEF.map(b=>({...b, unlocked: b.check(d)}));
}

// Citation / conseil / question d'auto-coaching du jour — carte à retourner à la 1ère ouverture du jour
function CitationDuJour({uid}){
  const[citations,setCitations]=useState(null);
  const[revealed,setRevealed]=useState(true);
  const[isFirstToday,setIsFirstToday]=useState(false);
  const[flipping,setFlipping]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","textes"));
        setCitations(snap.exists()?snap.data().citations:null);
      }catch{ setCitations(null); }

      const forceCard = new URLSearchParams(window.location.search).get("testcard")==="1";
      if(forceCard){
        setIsFirstToday(true);
        setRevealed(false);
        return;
      }

      const todayStr = new Date().toISOString().slice(0,10);
      const lastSeen = await sg(uid,"db-citation-vue");
      if(lastSeen !== todayStr){
        setIsFirstToday(true);
        setRevealed(false);
        ss(uid,"db-citation-vue",todayStr);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[uid]);

  const citation = getCitationDuJour(citations);

  const reveal=()=>{
    if(revealed)return;
    setFlipping(true);
    setTimeout(()=>{ setRevealed(true); setFlipping(false); }, 350);
  };

  if(!isFirstToday || revealed){
    return(
      <div style={{background:`linear-gradient(135deg, rgba(196,154,138,.12), rgba(168,155,181,.08))`,border:`1px solid ${C.pale}`,borderRadius:14,padding:"1.1rem",textAlign:"center",marginBottom:"1rem",animation:isFirstToday?"card-flip-in .4s ease":"none"}}>
        <style>{`@keyframes card-flip-in{from{opacity:0;transform:scale(.96);}to{opacity:1;transform:scale(1);}}`}</style>
        <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".18em",color:C.rose,marginBottom:".5rem"}}>✦ PENSÉE DU JOUR ✦</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",fontStyle:"italic",color:C.brun,lineHeight:1.65}}>"{citation}"</div>
      </div>
    );
  }

  // Carte fermée — à découvrir
  return(
    <button onClick={reveal}
      style={{display:"block",width:"100%",background:`linear-gradient(135deg, ${C.brun}, ${C.brun2})`,border:`1px solid ${C.pale}`,borderRadius:14,padding:"1.3rem",textAlign:"center",marginBottom:"1rem",cursor:"pointer",opacity:flipping?0:1,transition:"opacity .35s ease",boxShadow:"0 4px 16px rgba(61,31,14,.2)",fontFamily:"inherit",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",WebkitAppearance:"none",appearance:"none"}}>
      <div style={{fontSize:"1.8rem",marginBottom:".4rem"}}>🎴</div>
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".18em",color:C.or,marginBottom:".3rem"}}>✦ NOUVELLE CARTE DU JOUR ✦</div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontStyle:"italic",color:"white",lineHeight:1.5}}>Touche pour découvrir ta pensée du jour</div>
    </button>
  );
}

// Mood-check quotidien : adapte le ton de la to-do du jour
const MOODS=[
  {id:"top",icon:"⚡",label:"Au top",message:"Génial ! C'est le moment idéal pour viser tes 5 actions à fond aujourd'hui 🚀"},
  {id:"fatigue",icon:"🐢",label:"Un peu fatigué(e)",message:"Pas de souci, on avance à son rythme aujourd'hui. Fais ce que tu peux, l'essentiel c'est de ne pas t'arrêter complètement 🌱"},
  {id:"depasse",icon:"🤯",label:"Dépassé(e)",message:"Pas de panique, aujourd'hui on fait léger : choisis juste UNE action essentielle ci-dessous et fête ta victoire 💛"},
];

// Causes possibles de fatigue/surcharge (perso + travail), avec conseil ciblé
const CAUSES_FATIGUE=[
  {id:"sommeil",icon:"😴",label:"Manque de sommeil",
    conseils:[
      "Ce soir, essaie de te coucher 30 min plus tôt — même un petit ajustement peut faire une vraie différence sur ton énergie demain.",
      "Et si tu testais une micro-sieste de 15-20 min cet après-midi ? Pas besoin de dormir profondément, juste fermer les yeux peut relancer ton énergie.",
      "Le manque de sommeil affecte direct la motivation et la concentration — sois indulgente avec toi-même aujourd'hui, fais ce que tu peux, pas plus.",
      "Essaie de couper les écrans 30 min avant de dormir ce soir — ça aide vraiment à mieux récupérer pour demain.",
      "Une tisane, une lumière tamisée, un peu de calme avant le coucher... Petits rituels, grands effets sur le sommeil 🌙",
    ],
    conseilRepetition:"Ça fait plusieurs jours que le sommeil te pèse... Si ça continue, ce serait peut-être bien d'en parler à quelqu'un (médecin, proche) — ton corps t'envoie peut-être un message à écouter 💛",
  },
  {id:"charge-mentale",icon:"🧠",label:"Charge mentale élevée",
    conseils:[
      "Essaie de tout sortir de ta tête sur une liste (perso + travail) — ça libère de la place mentale, même sans tout faire aujourd'hui.",
      "Choisis UNE seule priorité pour aujourd'hui et laisse le reste de côté sans culpabiliser. Une chose à la fois.",
      "Et si tu déléguais ou reportais une tâche qui peut attendre ? Ce n'est pas un échec, c'est de la gestion intelligente.",
      "5 minutes pour respirer, sans rien faire d'autre — ça peut sembler inutile mais ça aide vraiment à retrouver de la clarté.",
      "Quand tout s'accumule, écrire ce qui tourne en boucle (même en vrac, sans ordre) aide souvent à redescendre la pression.",
    ],
    conseilRepetition:"La charge mentale revient souvent ces derniers jours... Est-ce qu'il y a une chose précise qui pèse plus que les autres ? Parfois identifier LA chose aide à mieux la gérer 🧩",
  },
  {id:"famille",icon:"👨‍👩‍👧",label:"Famille / enfants",
    conseils:[
      "C'est normal que la famille passe en priorité parfois. Ton activité Mihi peut attendre quelques heures — l'important c'est de ne pas culpabiliser.",
      "Même 10 minutes entre deux tâches familiales peuvent suffire pour répondre à un message client. Petits créneaux, ça compte aussi !",
      "Les périodes familiales chargées sont temporaires — ton activité reprendra son rythme. Profite de ces moments, ils ne reviennent pas.",
      "Et si tu impliquais un peu ta famille dans ton activité ? Parfois ça crée des moments complices en plus.",
      "Pas de pression aujourd'hui — la régularité se mesure sur la durée, pas sur une seule journée.",
    ],
    conseilRepetition:"La famille prend beaucoup de place ces derniers temps, et c'est complètement normal. Pense à te accorder aussi un petit moment pour toi, même court — tu en as besoin aussi 💛",
  },
  {id:"sante",icon:"🤒",label:"Pas en forme / santé",
    conseils:[
      "Prends soin de toi en premier. Si tu peux, hydrate-toi, repose-toi un peu — ton business sera toujours là demain.",
      "Écoute ton corps aujourd'hui. Si tu as besoin de ralentir complètement, fais-le sans culpabiliser — la santé passe avant tout.",
      "Pas en forme ne veut pas dire pas productive : même une petite action de 5 minutes compte, le reste peut attendre.",
      "Un peu d'air frais, même 5 minutes à la fenêtre ou sur le pas de la porte, peut parfois aider à se sentir un peu mieux.",
      "Si ça persiste, n'hésite pas à consulter — ce n'est jamais une perte de temps de prendre soin de sa santé.",
    ],
    conseilRepetition:"Ça fait plusieurs jours que tu ne te sens pas bien... Si ça continue, pense à consulter un professionnel de santé — ta santé est plus importante que n'importe quel objectif 💛",
  },
  {id:"motivation",icon:"💭",label:"Manque de motivation",
    conseils:[
      "C'est ok d'avoir des baisses de motivation, ça arrive à tout le monde. Relis un de tes objectifs ou un message d'une cliente satisfaite, ça peut redonner un petit coup de boost 💪",
      "Et si tu commençais par la tâche la plus facile de ta liste ? Parfois un petit succès rapide relance toute la dynamique.",
      "La motivation suit souvent l'action, pas l'inverse. Fais un petit geste, même sans envie, et observe si ça change quelque chose.",
      "Repense à ton 'pourquoi' — pourquoi as-tu commencé cette activité ? Reconnecter avec ça peut redonner du sens.",
      "Regarde le chemin déjà parcouru plutôt que ce qui reste à faire — tu as déjà avancé, et ça compte 🌱",
    ],
    conseilRepetition:"Le manque de motivation revient souvent en ce moment... Est-ce que tes objectifs actuels te parlent encore, ou est-ce qu'il serait temps de les ajuster ? Parfois un petit changement de cap redonne de l'élan 🔄",
  },
  {id:"surcharge-travail",icon:"💼",label:"Surcharge travail/emploi du temps",
    conseils:[
      "Aujourd'hui, vise juste 1 action de 10 minutes maximum. Mieux vaut un petit pas régulier qu'un gros effort suivi d'un abandon.",
      "Et si tu bloquais un créneau fixe de 15 min dans ton agenda, juste pour Mihi ? Un rendez-vous avec toi-même, non négociable.",
      "Quand tout s'accumule, trier par urgence/importance aide à voir plus clair. Tout n'a pas besoin d'être fait aujourd'hui.",
      "La surcharge est souvent temporaire. Identifie ce qui peut attendre une semaine sans conséquence, et laisse-le de côté pour l'instant.",
      "Un planning trop chargé mène souvent à rien faire du tout par overwhelm. Réduire la liste, c'est parfois la clé pour avancer.",
    ],
    conseilRepetition:"La surcharge revient souvent ces derniers jours... Est-ce qu'il y a quelque chose dans ton emploi du temps qui pourrait être allégé ou délégué sur la durée ? Un ajustement structurel aiderait peut-être plus qu'un effort ponctuel 📋",
  },
];


// Actions bonus optionnelles si "Au top"
const ACTIONS_BONUS=[
  {id:"b1",icon:"🎥",label:"Filme un contenu en avance",sub:"Prépare 1 Reel ou story pour un jour où tu seras moins motivée"},
  {id:"b2",icon:"📞",label:"Contacte 3 anciens prospects \"froids\"",sub:"Un petit message sympa pour reprendre contact, sans pression"},
  {id:"b3",icon:"🌟",label:"Aide une personne de ton équipe",sub:"Un message d'encouragement ou un conseil à une collègue"},
];

function MoodCheck({uid, onMoodChange, onBonusToggle}){
  const[mood,setMood]=useState(null);
  const[causes,setCauses]=useState([]);
  const[bonusDone,setBonusDone]=useState({});
  const[loaded,setLoaded]=useState(false);
  const[conseilHistory,setConseilHistory]=useState({});
  const todayStr = new Date().toISOString().slice(0,10);

  useEffect(()=>{
    (async()=>{
      const data = await sg(uid,"db-mood");
      if(data){
        const parsed = JSON.parse(data);
        if(parsed.date===todayStr){
          setMood(parsed.mood);
          setCauses(parsed.causes||[]);
          setBonusDone(parsed.bonusDone||{});
          onMoodChange&&onMoodChange(parsed.mood);
        }
      }
      const hist = await sg(uid,"db-mood-conseil-history");
      if(hist){
        try{ setConseilHistory(JSON.parse(hist)); }catch{}
      }
      setLoaded(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[uid]);

  const persist=(next)=>{
    ss(uid,"db-mood",JSON.stringify({date:todayStr, mood, causes, bonusDone, ...next}));
  };

  // Choisit un conseil pour une cause donnée, en évitant la répétition immédiate
  // et en proposant un message spécial si la cause revient plusieurs jours d'affilée
  const getConseilPourCause=(c, history)=>{
    const h = history[c.id] || {lastDate:null, lastIndex:-1, streak:0};
    // Streak de jours consécutifs (y compris aujourd'hui)
    const streak = h.lastDate===todayStr ? h.streak
      : (h.lastDate && isYesterday(h.lastDate)) ? h.streak+1 : 1;

    if(streak>=3 && c.conseilRepetition){
      return {text:c.conseilRepetition, index:-1, streak};
    }
    // Choix pseudo-aléatoire évitant la répétition immédiate
    let index = Math.floor(Math.random()*c.conseils.length);
    if(c.conseils.length>1 && index===h.lastIndex){
      index = (index+1)%c.conseils.length;
    }
    // Si déjà choisi aujourd'hui, garder le même (cohérence si re-render)
    if(h.lastDate===todayStr && h.lastIndex>=0 && h.lastIndex<c.conseils.length){
      index = h.lastIndex;
    }
    return {text:c.conseils[index], index, streak};
  };

  const isYesterday=(dateStr)=>{
    const d=new Date(dateStr);
    const yest=new Date();
    yest.setDate(yest.getDate()-1);
    return d.toISOString().slice(0,10)===yest.toISOString().slice(0,10);
  };

  const choisir=(moodId)=>{
    setMood(moodId);
    setCauses([]);
    onMoodChange&&onMoodChange(moodId);
    ss(uid,"db-mood",JSON.stringify({date:todayStr, mood:moodId, causes:[], bonusDone:{}}));
  };

  const toggleCause=(causeId)=>{
    const next = causes.includes(causeId) ? causes.filter(c=>c!==causeId) : [...causes, causeId];
    setCauses(next);
    persist({causes:next});

    // Si on vient de cocher (pas décocher), fige le conseil du jour dans l'historique
    if(!causes.includes(causeId)){
      const c = CAUSES_FATIGUE.find(x=>x.id===causeId);
      if(c){
        const {index, streak} = getConseilPourCause(c, conseilHistory);
        const nextHistory = {...conseilHistory, [causeId]:{lastDate:todayStr, lastIndex:index, streak}};
        setConseilHistory(nextHistory);
        ss(uid,"db-mood-conseil-history",JSON.stringify(nextHistory));
      }
    }
  };

  const toggleBonus=(bonusId)=>{
    const next = {...bonusDone, [bonusId]:!bonusDone[bonusId]};
    setBonusDone(next);
    persist({bonusDone:next});
    onBonusToggle&&onBonusToggle(next);
  };

  if(!loaded) return null;
  const selected = MOODS.find(m=>m.id===mood);
  const showCauses = mood==="fatigue"||mood==="depasse";

  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
      <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.brun,marginBottom:".6rem"}}>💛 Comment tu te sens aujourd'hui ?</div>
      <div style={{display:"flex",gap:".4rem",marginBottom:mood?".6rem":0}}>
        {MOODS.map(m=>(
          <button key={m.id} onClick={()=>choisir(m.id)}
            style={{flex:1,padding:".55rem .3rem",borderRadius:10,border:`1.5px solid ${mood===m.id?C.rose:C.pale}`,background:mood===m.id?C.rose+"15":C.blanc,cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>
            <div style={{fontSize:"1.3rem"}}>{m.icon}</div>
            <div style={{fontSize:".62rem",color:mood===m.id?C.brun:C.gris,fontWeight:mood===m.id?700:400,marginTop:".15rem"}}>{m.label}</div>
          </button>
        ))}
      </div>
      {selected&&(
        <div style={{fontSize:".74rem",color:C.texte,lineHeight:1.6,background:C.creme,borderRadius:8,padding:".6rem .8rem"}}>
          {selected.message}
        </div>
      )}

      {/* Mini-questionnaire causes (fatigue/dépassée) */}
      {showCauses&&(
        <div style={{marginTop:".7rem",paddingTop:".7rem",borderTop:`1px solid ${C.pale}`}}>
          <div style={{fontSize:".68rem",color:C.gris,marginBottom:".5rem"}}>Si tu veux, dis-moi ce qui pèse aujourd'hui (tu peux en cocher plusieurs) :</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:".35rem",marginBottom:causes.length>0?".6rem":0}}>
            {CAUSES_FATIGUE.map(c=>{
              const active = causes.includes(c.id);
              return(
                <button key={c.id} onClick={()=>toggleCause(c.id)}
                  style={{padding:".3rem .6rem",borderRadius:20,fontSize:".68rem",fontWeight:600,border:`1px solid ${active?C.lilas:C.pale}`,background:active?C.lilas+"15":C.blanc,color:active?C.brun:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
                  {c.icon} {c.label}
                </button>
              );
            })}
          </div>
          {causes.map(causeId=>{
            const c = CAUSES_FATIGUE.find(x=>x.id===causeId);
            if(!c) return null;
            const {text, streak} = getConseilPourCause(c, conseilHistory);
            return(
              <div key={causeId} style={{fontSize:".72rem",color:C.texte,lineHeight:1.6,background:streak>=3?"rgba(196,154,138,.12)":"rgba(168,155,181,.1)",borderLeft:`3px solid ${streak>=3?C.rose:C.lilas}`,borderRadius:"0 8px 8px 0",padding:".5rem .7rem",marginBottom:".35rem"}}>
                {streak>=3&&<span style={{fontWeight:700}}>💛 </span>}{text}
              </div>
            );
          })}
        </div>
      )}

      {/* Actions bonus (au top) */}
      {mood==="top"&&(
        <div style={{marginTop:".7rem",paddingTop:".7rem",borderTop:`1px solid ${C.pale}`}}>
          <div style={{fontSize:".68rem",color:C.gris,marginBottom:".5rem"}}>Envie d'aller plus loin ? Quelques actions bonus (optionnelles) :</div>
          {ACTIONS_BONUS.map(b=>{
            const checked = bonusDone[b.id];
            return(
              <div key={b.id} onClick={()=>toggleBonus(b.id)}
                style={{display:"flex",alignItems:"flex-start",gap:".5rem",padding:".4rem 0",cursor:"pointer"}}>
                <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${checked?C.or:C.pale}`,background:checked?C.or:"transparent",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {checked&&<span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>}
                </div>
                <div>
                  <div style={{fontSize:".74rem",fontWeight:600,color:checked?C.gris:C.texte,textDecoration:checked?"line-through":"none"}}>{b.icon} {b.label}</div>
                  <div style={{fontSize:".62rem",color:C.gris,marginTop:".1rem"}}>{b.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


function JaugeSucces({pctCA, pctRecrues}){
  const score = Math.round((Math.min(100,pctCA||0) + Math.min(100,pctRecrues||0)) / 2);
  let couleur = C.rose, message = "C'est parti ! 💪";
  if(score>=100){couleur=C.vert; message="Objectif du mois atteint, bravo ! 🎉";}
  else if(score>=75){couleur=C.or; message="Tu y es presque ! 🔥";}
  else if(score>=40){couleur=C.lilas; message="Belle progression, continue ! ✨";}

  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:".4rem"}}>
        <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.brun}}>🚀 Jauge de succès du mois</div>
        <div style={{fontSize:"1rem",fontWeight:700,color:couleur}}>{score}%</div>
      </div>
      <div style={{height:14,background:C.pale,borderRadius:10,overflow:"hidden"}}>
        <div style={{height:"100%",background:couleur,width:score+"%",borderRadius:10,transition:"width .5s ease"}}/>
      </div>
      <div style={{fontSize:".68rem",color:C.gris,marginTop:".4rem",textAlign:"center"}}>{message}</div>
    </div>
  );
}

// Galerie de badges
function BadgesPanel({badges}){
  const unlocked = badges.filter(b=>b.unlocked);
  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:".6rem"}}>
        <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.brun}}>🏅 Mes Badges</div>
        <div style={{fontSize:".68rem",color:C.gris}}>{unlocked.length} / {badges.length}</div>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:".5rem"}}>
        {badges.map(b=>(
          <div key={b.id} title={b.desc}
            style={{
              flex:"1 1 30%", minWidth:90, textAlign:"center", padding:".6rem .3rem",
              borderRadius:10, border:`1px solid ${b.unlocked?C.or+"60":C.pale}`,
              background:b.unlocked?C.or+"15":C.creme, opacity:b.unlocked?1:.45,
              transition:"all .2s",
            }}>
            <div style={{fontSize:"1.5rem",marginBottom:".2rem",filter:b.unlocked?"none":"grayscale(1)"}}>{b.icon}</div>
            <div style={{fontSize:".62rem",fontWeight:700,color:C.brun,lineHeight:1.3}}>{b.label}</div>
            <div style={{fontSize:".56rem",color:C.gris,marginTop:".15rem",lineHeight:1.3}}>{b.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── WALL OF FAME & DÉFIS ÉQUIPE (Lot 2b) ──────────────────────────────────────

const REACTION_EMOJIS = ["🔥","❤️","👏","💪"];

// Publie automatiquement une réussite sur le Wall of Fame (global, partagé)
async function postToWallOfFame(uid, userName, message, icon="🎉"){
  try{
    const ref = doc(db,"equipe","wall-of-fame");
    const snap = await getDoc(ref);
    const existing = snap.exists() && snap.data().posts ? snap.data().posts : [];
    // Éviter les doublons rapprochés (même message, même personne, < 1h)
    const recent = existing.find(p=>p.uid===uid&&p.message===message&&(Date.now()-p.ts)<3600000);
    if(recent) return;
    const post = {id:`wf${Date.now()}`, uid, userName, message, icon, ts:Date.now(), reactions:{}};
    const next = [post, ...existing].slice(0,50);
    await setDoc(ref, {posts: next}, {merge:true});
  }catch{}
}

// Power Hour — Sprint collectif synchrone de 20 minutes, lançable par tout chef d'équipe
function PowerHourTab({uid, userName, canCreate}){
  const[session,setSession]=useState(null);
  const[loading,setLoading]=useState(true);
  const[message,setMessage]=useState("");
  const DUREE_MIN=20;

  const load=async()=>{
    try{
      const snap=await getDoc(doc(db,"equipe","power-hour"));
      if(snap.exists()&&snap.data().startedAt){
        const d=snap.data();
        const elapsed = Date.now()-d.startedAt;
        if(elapsed < DUREE_MIN*60000+5*60000){ // garde la session visible 5min après la fin pour le récap
          setSession(d);
        } else setSession(null);
      } else setSession(null);
    }catch{}
    setLoading(false);
  };

  useEffect(()=>{
    load();
    const t=setInterval(load, 5000);
    return ()=>clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const lancer=async()=>{
    const nouvelle={startedAt:Date.now(), startedBy:userName, messages:[]};
    try{ await setDoc(doc(db,"equipe","power-hour"), nouvelle); setSession(nouvelle); }catch{}
  };

  const envoyerMessage=async()=>{
    if(!message.trim()||!session)return;
    const msg={uid,userName,text:message.trim(),ts:Date.now()};
    const next={...session, messages:[...(session.messages||[]),msg].slice(-100)};
    setMessage("");
    setSession(next);
    try{ await setDoc(doc(db,"equipe","power-hour"), next, {merge:true}); }catch{}
  };

  const arreter=async()=>{
    try{ await setDoc(doc(db,"equipe","power-hour"), {startedAt:0, startedBy:"", messages:[]}); }catch{}
    setSession(null);
  };

  if(loading) return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  const elapsed = session ? Date.now()-session.startedAt : 0;
  const remaining = session ? DUREE_MIN*60000-elapsed : 0;
  const isActive = session && remaining>0;
  const isFinished = session && remaining<=0;

  const Countdown=()=>{
    const[, setTick]=useState(0);
    useEffect(()=>{
      const t=setInterval(()=>setTick(x=>x+1),1000);
      return ()=>clearInterval(t);
    },[]);
    const rem = DUREE_MIN*60000-(Date.now()-session.startedAt);
    if(rem<=0) return <span style={{color:C.vert,fontWeight:700}}>Terminé !</span>;
    const m=Math.floor(rem/60000), s=Math.floor((rem%60000)/1000);
    return <span style={{fontFamily:"Georgia,serif",fontSize:"2.2rem",fontWeight:700,color:C.or}}>{m}:{String(s).padStart(2,"0")}</span>;
  };

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Power <em style={{fontStyle:"italic",color:C.rose}}>Hour</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        20 minutes, toute l'équipe ensemble, on envoie nos messages en même temps. L'énergie collective à distance est surpuissante 🚀
      </p>

      {!session&&(
        <div style={{textAlign:"center",padding:"2rem 1rem"}}>
          <div style={{fontSize:"2rem",marginBottom:".5rem"}}>⏱️</div>
          <div style={{fontSize:".8rem",color:C.gris,marginBottom:"1rem"}}>Aucune Power Hour en cours actuellement.</div>
          {canCreate?(
            <button onClick={lancer}
              style={{background:C.rose,color:"white",border:"none",borderRadius:10,padding:".6rem 1.2rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              🚀 Lancer une Power Hour (20 min)
            </button>
          ):(
            <div style={{fontSize:".7rem",color:C.gris}}>Seule ta chef d'équipe (ou Melissa) peut en lancer une.</div>
          )}
        </div>
      )}

      {session&&(
        <>
          <div style={{background:C.brun,borderRadius:14,padding:"1.2rem",marginBottom:"1rem",textAlign:"center"}}>
            <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".15em",textTransform:"uppercase",color:C.or,marginBottom:".5rem"}}>
              {isFinished?"⏱️ POWER HOUR TERMINÉE":"🚀 POWER HOUR EN COURS"}
            </div>
            {isActive?<Countdown/>:<span style={{fontFamily:"Georgia,serif",fontSize:"1.5rem",fontWeight:700,color:C.vert}}>Bravo l'équipe ! 🎉</span>}
            <div style={{fontSize:".68rem",color:C.pale,marginTop:".5rem"}}>Lancée par {session.startedBy}</div>
          </div>

          {/* Chat en direct */}
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>💬 Chat de l'équipe</div>
            <div style={{maxHeight:220,overflowY:"auto",marginBottom:".6rem"}}>
              {(session.messages||[]).length===0&&(
                <div style={{fontSize:".7rem",color:C.gris,textAlign:"center",padding:"1rem 0"}}>
                  Personne n'a encore écrit. Lance le mouvement : "Ok, j'envoie mes messages, qui est avec moi ?" 💪
                </div>
              )}
              {(session.messages||[]).map((m,i)=>(
                <div key={i} style={{marginBottom:".4rem"}}>
                  <span style={{fontSize:".68rem",fontWeight:700,color:C.brun}}>{m.userName}: </span>
                  <span style={{fontSize:".7rem",color:C.texte}}>{m.text}</span>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:".4rem"}}>
              <input value={message} onChange={e=>setMessage(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&envoyerMessage()}
                placeholder="Ok, j'envoie mes messages !"
                style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .7rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
              <button onClick={envoyerMessage}
                style={{background:C.rose,color:"white",border:"none",borderRadius:8,padding:".45rem .9rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                Envoyer
              </button>
            </div>
          </div>

          {canCreate&&(
            <button onClick={arreter}
              style={{width:"100%",background:"none",border:"1px solid #B0404040",borderRadius:8,padding:".4rem",fontSize:".68rem",color:"#B04040",fontFamily:"inherit",cursor:"pointer"}}>
              Clôturer la Power Hour
            </button>
          )}
        </>
      )}
    </div>
  );
}


function WallOfFameTab({uid, userName}){
  const[posts,setPosts]=useState([]);
  const[loading,setLoading]=useState(true);

  const load=async()=>{
    setLoading(true);
    try{
      const snap = await getDoc(doc(db,"equipe","wall-of-fame"));
      setPosts(snap.exists()&&snap.data().posts ? snap.data().posts : []);
    }catch{}
    setLoading(false);
  };

  useEffect(()=>{ load(); },[]);

  const react=async(postId, emoji)=>{
    const next = posts.map(p=>{
      if(p.id!==postId) return p;
      const reactions = {...(p.reactions||{})};
      const users = reactions[emoji] || [];
      reactions[emoji] = users.includes(uid) ? users.filter(u=>u!==uid) : [...users, uid];
      return {...p, reactions};
    });
    setPosts(next);
    try{ await setDoc(doc(db,"equipe","wall-of-fame"), {posts: next}, {merge:true}); }catch{}
  };

  const timeAgo=(ts)=>{
    const diff = Date.now()-ts;
    const mins = Math.floor(diff/60000);
    if(mins<1) return "à l'instant";
    if(mins<60) return `il y a ${mins} min`;
    const hours = Math.floor(mins/60);
    if(hours<24) return `il y a ${hours}h`;
    return `il y a ${Math.floor(hours/24)}j`;
  };

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Wall of <em style={{fontStyle:"italic",color:C.rose}}>Fame</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Les réussites de toute l'équipe Blazing Dynasty 🎉 — réagis pour encourager !
      </p>

      <button onClick={load} disabled={loading}
        style={{width:"100%",background:"none",border:`1px solid ${C.pale}`,borderRadius:8,padding:".4rem",fontSize:".68rem",color:C.gris,fontFamily:"inherit",cursor:"pointer",marginBottom:"1rem"}}>
        {loading?"Chargement...":"🔄 Actualiser"}
      </button>

      {posts.length===0&&!loading&&(
        <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".76rem"}}>
          Rien pour l'instant... Les prochaines réussites de l'équipe apparaîtront ici automatiquement ! ✨
        </div>
      )}

      {posts.map(p=>(
        <div key={p.id} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem 1rem",marginBottom:".6rem"}}>
          <div style={{display:"flex",gap:".6rem",alignItems:"flex-start"}}>
            <div style={{fontSize:"1.4rem",flexShrink:0}}>{p.icon||"🎉"}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:".75rem",color:C.texte,lineHeight:1.55}}>
                <strong style={{color:C.brun}}>{p.userName}</strong> {p.message}
              </div>
              <div style={{fontSize:".6rem",color:C.gris,marginTop:".2rem"}}>{timeAgo(p.ts)}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:".35rem",marginTop:".6rem"}}>
            {REACTION_EMOJIS.map(emoji=>{
              const users = (p.reactions&&p.reactions[emoji])||[];
              const active = users.includes(uid);
              return(
                <button key={emoji} onClick={()=>react(p.id,emoji)}
                  style={{display:"flex",alignItems:"center",gap:".25rem",border:`1px solid ${active?C.rose:C.pale}`,background:active?C.rose+"15":"transparent",borderRadius:20,padding:".2rem .55rem",fontSize:".72rem",cursor:"pointer",fontFamily:"inherit",color:active?C.brun:C.gris}}>
                  <span>{emoji}</span>{users.length>0&&<span style={{fontWeight:700}}>{users.length}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Module de Défis éphémères équipe
function DefisTab({uid, userName, canCreate}){
  const[defi,setDefi]=useState(null);
  const[loading,setLoading]=useState(true);
  const[showCreate,setShowCreate]=useState(false);
  const[form,setForm]=useState({titre:"",objectif:"3",unite:"ventes",dureeHeures:"48"});
  const[declareAmount,setDeclareAmount]=useState("1");

  const load=async()=>{
    setLoading(true);
    try{
      const snap = await getDoc(doc(db,"equipe","defi-actuel"));
      const d = snap.exists()?snap.data():null;
      if(d&&d.deadline&&d.deadline<Date.now()){ setDefi(null); }
      else setDefi(d&&d.titre?d:null);
    }catch{}
    setLoading(false);
  };

  useEffect(()=>{ load(); },[]);

  const creerDefi=async()=>{
    if(!form.titre.trim())return;
    const nouveau = {
      titre: form.titre.trim(),
      objectif: +form.objectif||1,
      unite: form.unite,
      deadline: Date.now() + (+form.dureeHeures||48)*3600000,
      createdBy: userName,
      declarations: [],
      ts: Date.now(),
    };
    await setDoc(doc(db,"equipe","defi-actuel"), nouveau);
    setDefi(nouveau);
    setShowCreate(false);
    setForm({titre:"",objectif:"3",unite:"ventes",dureeHeures:"48"});
  };

  const declarer=async()=>{
    if(!defi)return;
    const amount = +declareAmount||1;
    const declarations = [...(defi.declarations||[]), {uid, userName, count:amount, ts:Date.now()}];
    const next = {...defi, declarations};
    setDefi(next);
    try{ await setDoc(doc(db,"equipe","defi-actuel"), next, {merge:true}); }catch{}
    postToWallOfFame(uid, userName, `vient de déclarer ${amount} ${defi.unite} pour le défi "${defi.titre}" 💪`, "🚀");
  };

  const supprimerDefi=async()=>{
    try{ await setDoc(doc(db,"equipe","defi-actuel"), {titre:"", deadline:0}, {merge:false}); }catch{}
    setDefi(null);
  };

  if(loading) return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  // Compte à rebours
  const Countdown=({deadline})=>{
    const[remaining,setRemaining]=useState(deadline-Date.now());
    useEffect(()=>{
      const t=setInterval(()=>setRemaining(deadline-Date.now()),1000);
      return ()=>clearInterval(t);
    },[deadline]);
    if(remaining<=0) return <span style={{color:"#B04040",fontWeight:700}}>Terminé</span>;
    const h=Math.floor(remaining/3600000), m=Math.floor((remaining%3600000)/60000);
    return <span style={{fontWeight:700,color:C.or}}>{h}h {m}min restantes</span>;
  };

  const totalDeclare = defi ? (defi.declarations||[]).reduce((s,d)=>s+d.count,0) : 0;
  const pctDefi = defi ? Math.min(100,Math.round(totalDeclare/defi.objectif*100)) : 0;

  // Classement par personne
  const classement = defi ? Object.values(
    (defi.declarations||[]).reduce((acc,d)=>{
      acc[d.userName]=acc[d.userName]||{userName:d.userName,total:0};
      acc[d.userName].total += d.count;
      return acc;
    },{})
  ).sort((a,b)=>b.total-a.total) : [];

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Défi <em style={{fontStyle:"italic",color:C.rose}}>Flash</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Un défi collectif, toute l'équipe ensemble — déclare tes actions en direct !
      </p>

      {!defi&&!showCreate&&(
        <div style={{textAlign:"center",padding:"2rem 1rem",color:C.gris}}>
          <div style={{fontSize:"2rem",marginBottom:".5rem"}}>🏁</div>
          <div style={{fontSize:".8rem",marginBottom:"1rem"}}>Aucun défi en cours actuellement.</div>
          {canCreate&&(
            <button onClick={()=>setShowCreate(true)}
              style={{background:C.rose,color:"white",border:"none",borderRadius:10,padding:".6rem 1.2rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              🚀 Lancer un défi
            </button>
          )}
        </div>
      )}

      {showCreate&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>🚀 Nouveau défi flash</div>
          <input placeholder='Ex: "3 ventes ce week-end !"' value={form.titre} onChange={e=>setForm(f=>({...f,titre:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .7rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".5rem"}}/>
          <div style={{display:"flex",gap:".5rem",marginBottom:".5rem"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem"}}>Objectif total</div>
              <input type="number" value={form.objectif} onChange={e=>setForm(f=>({...f,objectif:e.target.value}))}
                style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".85rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none",fontWeight:600}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem"}}>Unité</div>
              <select value={form.unite} onChange={e=>setForm(f=>({...f,unite:e.target.value}))}
                style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".85rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none",fontWeight:600}}>
                <option value="ventes">ventes</option>
                <option value="recrues">recrues</option>
                <option value="messages">messages</option>
                <option value="contacts">contacts</option>
              </select>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem"}}>Durée (h)</div>
              <input type="number" value={form.dureeHeures} onChange={e=>setForm(f=>({...f,dureeHeures:e.target.value}))}
                style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".85rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none",fontWeight:600}}/>
            </div>
          </div>
          <div style={{display:"flex",gap:".5rem"}}>
            <button onClick={creerDefi}
              style={{flex:1,background:C.rose,color:"white",border:"none",borderRadius:8,padding:".5rem",fontSize:".76rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              Lancer le défi
            </button>
            <button onClick={()=>setShowCreate(false)}
              style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:8,padding:".5rem .9rem",fontSize:".76rem",color:C.gris,fontFamily:"inherit",cursor:"pointer"}}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {defi&&(
        <>
          <div style={{background:C.brun,borderRadius:14,padding:"1.1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".15em",textTransform:"uppercase",color:C.or,marginBottom:".3rem"}}>🚀 DÉFI EN COURS</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1.15rem",fontWeight:600,color:C.blanc,marginBottom:".4rem"}}>{defi.titre}</div>
            <div style={{fontSize:".7rem",color:C.pale,marginBottom:".5rem"}}>
              <Countdown deadline={defi.deadline}/> · lancé par {defi.createdBy}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:".68rem",color:C.pale,marginBottom:".3rem"}}>
              <span>Progression collective</span>
              <span style={{fontWeight:700,color:pctDefi>=100?C.vert:C.or}}>{totalDeclare} / {defi.objectif} {defi.unite} ({pctDefi}%)</span>
            </div>
            <div style={{height:10,background:"rgba(255,255,255,.1)",borderRadius:10,overflow:"hidden"}}>
              <div style={{height:"100%",background:pctDefi>=100?C.vert:C.rose,width:pctDefi+"%",borderRadius:10,transition:"width .4s"}}/>
            </div>
            {pctDefi>=100&&<div style={{textAlign:"center",fontSize:".78rem",color:C.vert,fontWeight:700,marginTop:".5rem"}}>🎉 Défi collectif réussi, bravo l'équipe !</div>}
          </div>

          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>✋ Je déclare !</div>
            <div style={{display:"flex",gap:".5rem"}}>
              <input type="number" min="1" value={declareAmount} onChange={e=>setDeclareAmount(e.target.value)}
                style={{width:70,border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .65rem",fontSize:".85rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none",fontWeight:600,textAlign:"center"}}/>
              <button onClick={declarer}
                style={{flex:1,background:C.rose,color:"white",border:"none",borderRadius:8,padding:".5rem",fontSize:".76rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                + {declareAmount} {defi.unite} fait{declareAmount>1?"s":""} !
              </button>
            </div>
          </div>

          {classement.length>0&&(
            <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
              <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.lilas,marginBottom:".6rem"}}>🏆 Classement</div>
              {classement.map((c,i)=>(
                <div key={c.userName} style={{display:"flex",justifyContent:"space-between",padding:".35rem 0",borderBottom:i<classement.length-1?`1px solid ${C.pale}`:"none",fontSize:".74rem"}}>
                  <span style={{color:C.texte}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`} {c.userName}</span>
                  <span style={{fontWeight:700,color:C.brun}}>{c.total} {defi.unite}</span>
                </div>
              ))}
            </div>
          )}

          <button onClick={load}
            style={{width:"100%",background:"none",border:`1px solid ${C.pale}`,borderRadius:8,padding:".4rem",fontSize:".68rem",color:C.gris,fontFamily:"inherit",cursor:"pointer",marginBottom:".5rem"}}>
            🔄 Actualiser
          </button>

          {canCreate&&(
            <button onClick={supprimerDefi}
              style={{width:"100%",background:"none",border:`1px solid #B0404040`,borderRadius:8,padding:".4rem",fontSize:".68rem",color:"#B04040",fontFamily:"inherit",cursor:"pointer"}}>
              Clôturer ce défi
            </button>
          )}
        </>
      )}
    </div>
  );
}


// Mini graphique d'évolution (SVG, sans dépendance externe)
function MiniChart({data, dataKey, objKey, color, unit=""}){
  if(!data || data.length < 2) return (
    <div style={{textAlign:"center",fontSize:".68rem",color:C.gris,padding:".75rem 0"}}>
      Pas encore assez d'historique — reviens après ta prochaine période pour voir ta courbe 📈
    </div>
  );

  const w=300, h=110, pad=8;
  const values = data.map(d=>+d[dataKey]||0);
  const objValues = data.map(d=>+d[objKey]||0);
  const maxV = Math.max(...values, ...objValues, 1);

  const points = values.map((v,i)=>{
    const x = pad + (i/(data.length-1)) * (w-2*pad);
    const y = h-pad - (v/maxV)*(h-2*pad);
    return `${x},${y}`;
  }).join(" ");

  const lastObj = objValues[objValues.length-1];
  const objY = h-pad - (lastObj/maxV)*(h-2*pad);

  return(
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",height:"auto",display:"block"}}>
        {lastObj>0&&(
          <line x1={pad} y1={objY} x2={w-pad} y2={objY} stroke={C.or} strokeWidth="1" strokeDasharray="4 3"/>
        )}
        <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
        {values.map((v,i)=>{
          const x = pad + (i/(data.length-1)) * (w-2*pad);
          const y = h-pad - (v/maxV)*(h-2*pad);
          return <circle key={i} cx={x} cy={y} r="3" fill={color}/>;
        })}
      </svg>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:".58rem",color:C.gris,marginTop:".2rem"}}>
        <span>{new Date(data[0].date).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</span>
        {lastObj>0&&<span style={{color:C.or}}>┄ Objectif : {lastObj}{unit}</span>}
        <span>{new Date(data[data.length-1].date).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</span>
      </div>
    </div>
  );
}

// Calcule la comparaison vs la période précédente
function comparaisonPeriode(historique, currentVal, key){
  if(!historique || historique.length===0) return null;
  const previous = +historique[historique.length-1][key] || 0;
  const current = +currentVal || 0;
  const diff = current - previous;
  const pct = previous!==0 ? Math.round((diff/previous)*100) : (current>0?100:0);
  return {previous, current, diff, pct};
}


// ── OBJECTIFS PERSONNELS ──────────────────────────────────────────────────────
const PALIERS_PERSO=["2%","4%","6%","8%","10%","12%","14%","17%","SR","Directeur","Structural","Business Director","SR Business Director","Business"];

// Objectif CA suggéré selon le palier visé (pré-remplissage automatique)
const PALIER_CA_OBJ={
  "2%":100, "4%":250, "6%":500, "8%":1000, "10%":1500, "12%":2000, "14%":3000, "17%":5000, "SR":7500,
};

// Paliers de qualification "Directeur" : nombre de directeurs requis dans la structure + montant de prime
const PALIERS_QUALIFICATION=[
  {id:"Directeur", nbDirecteurs:1, prime:1000},
  {id:"SR", nbDirecteurs:0, prime:500},
  {id:"Structural", nbDirecteurs:2, prime:2000},
  {id:"Business Director", nbDirecteurs:3, prime:3000},
  {id:"SR Business Director", nbDirecteurs:4, prime:4000},
];

const MOIS_LABELS=["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];

// Section "Primes de Qualification" — suivi mensuel par palier (Directeur, SR, Structural, Business Director, SR Business Director)
function PrimesQualificationSection({obj, save, onPrimeValidee}){
  const qualifs = obj.qualifs || {};
  const annee = new Date().getFullYear();

  const setDirecteurs=(palierId, n)=>{
    const current = qualifs[palierId] || {directeurs:0, mois:{}, primes:{}};
    save({...obj, qualifs:{...qualifs, [palierId]:{...current, directeurs:n}}});
  };

  const toggleMois=(palierId, moisKey)=>{
    const current = qualifs[palierId] || {directeurs:0, mois:{}, primes:{}};
    const mois = {...current.mois, [moisKey]:!current.mois[moisKey]};
    const next = {...current, mois};

    // Calcul consécutif (en remontant depuis le mois courant)
    const moisKeys=[];
    const now=new Date();
    for(let i=0;i<12;i++){
      const d=new Date(now.getFullYear(), now.getMonth()-i, 1);
      moisKeys.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
    }
    let consecutifs=0;
    for(const k of moisKeys){
      if(mois[k]) consecutifs++;
      else break;
    }
    const totalSur12 = moisKeys.filter(k=>mois[k]).length;

    const primes = {...(current.primes||{})};
    let nouvelle=false;
    if(consecutifs>=2 && !primes.consecutif){primes.consecutif=true;nouvelle=true;}
    if(totalSur12>=6 && !primes.sur12){primes.sur12=true;nouvelle=true;}

    next.primes = primes;
    save({...obj, qualifs:{...qualifs, [palierId]:next}});
    if(nouvelle) onPrimeValidee&&onPrimeValidee();
  };

  // Affiche uniquement le palier actuel et les paliers déjà atteints (qualification progressive)
  const currentIdx = PALIERS_PERSO.indexOf(obj.palier||"2%");
  const srIdx = PALIERS_PERSO.indexOf("SR");
  if(currentIdx < srIdx) return null; // pas encore au niveau SR, pas de primes de qualification

  const now=new Date();
  const moisKeys=[];
  for(let i=11;i>=0;i--){
    const d=new Date(now.getFullYear(), now.getMonth()-i, 1);
    moisKeys.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  }

  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:".75rem"}}>
      <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.or,marginBottom:".3rem"}}>💎 Primes de qualification</div>
      <p style={{fontSize:".66rem",color:C.gris,marginBottom:".75rem",lineHeight:1.6}}>
        Pour chaque niveau atteint, coche le mois où tu valides la qualification. 2 mois d'affilée ou 6 mois sur 12 → prime débloquée 🎉
      </p>

      {PALIERS_QUALIFICATION.map(pq=>{
        const q = qualifs[pq.id] || {directeurs:0, mois:{}, primes:{}};
        const consecutifs = (()=>{
          let c=0;
          for(let i=moisKeys.length-1;i>=0;i--){
            if(q.mois[moisKeys[i]]) c++;
            else break;
          }
          return c;
        })();
        const totalSur12 = moisKeys.filter(k=>q.mois[k]).length;

        return(
          <div key={pq.id} style={{marginBottom:"1rem",paddingBottom:"1rem",borderBottom:`1px solid ${C.pale}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:".4rem"}}>
              <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:C.brun}}>{pq.id}</div>
              <div style={{fontSize:".68rem",fontWeight:700,color:C.or}}>{pq.prime}€ par prime</div>
            </div>

            {/* Cases directeurs requis */}
            {pq.nbDirecteurs>0&&(
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

            {/* Grille 12 mois */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:".3rem",marginBottom:".5rem"}}>
              {moisKeys.map(k=>{
                const [y,m]=k.split("-");
                const checked=q.mois[k];
                const isCurrent = k===moisKeys[moisKeys.length-1];
                return(
                  <div key={k} onClick={()=>toggleMois(pq.id,k)}
                    style={{textAlign:"center",padding:".3rem 0",borderRadius:6,border:`1.5px solid ${checked?C.vert:isCurrent?C.rose:C.pale}`,background:checked?C.vert+"20":"transparent",cursor:"pointer"}}>
                    <div style={{fontSize:".6rem",fontWeight:600,color:checked?C.vert:C.gris}}>{MOIS_LABELS[+m-1]}</div>
                    <div style={{fontSize:".55rem",color:C.pale}}>{y.slice(2)}</div>
                    {checked&&<div style={{fontSize:".6rem"}}>✓</div>}
                  </div>
                );
              })}
            </div>

            {/* Statut primes */}
            <div style={{display:"flex",gap:".5rem",flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:120,padding:".4rem .6rem",borderRadius:8,background:consecutifs>=2?C.vert+"15":C.creme,border:`1px solid ${consecutifs>=2?C.vert:C.pale}`,fontSize:".64rem",color:consecutifs>=2?C.vert:C.gris}}>
                {consecutifs>=2?"🎉":"⏳"} 2 mois d'affilée : <strong>{Math.min(consecutifs,2)}/2</strong> {consecutifs>=2&&"— Prime validée !"}
              </div>
              <div style={{flex:1,minWidth:120,padding:".4rem .6rem",borderRadius:8,background:totalSur12>=6?C.vert+"15":C.creme,border:`1px solid ${totalSur12>=6?C.vert:C.pale}`,fontSize:".64rem",color:totalSur12>=6?C.vert:C.gris}}>
                {totalSur12>=6?"🎉":"⏳"} 6 mois / 12 : <strong>{Math.min(totalSur12,6)}/6</strong> {totalSur12>=6&&"— Prime validée !"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


function ObjPersoTab({obj,save,uid,userName}){
  const[confettiTrigger,setConfettiTrigger]=useState(0);
  const[fireworksTrigger,setFireworksTrigger]=useState(0);
  const pctCA=()=>{
    if(!obj.caObj||!obj.ca)return 0;
    return Math.min(100,Math.round(+obj.ca/+obj.caObj*100));
  };
  const pctR=()=>{
    if(!obj.recruesObj||obj.recruesObj==="0"||!obj.recruesReal)return 0;
    return Math.min(100,Math.round(+obj.recruesReal/+obj.recruesObj*100));
  };
  const checkAndCelebrate=(nextObj)=>{
    const wasNot100CA = pctCA()<100, wasNot100R = pctR()<100;
    const nextPctCA = (!nextObj.caObj||!nextObj.ca)?0:Math.min(100,Math.round(+nextObj.ca/+nextObj.caObj*100));
    const nextPctR = (!nextObj.recruesObj||nextObj.recruesObj==="0"||!nextObj.recruesReal)?0:Math.min(100,Math.round(+nextObj.recruesReal/+nextObj.recruesObj*100));
    if((wasNot100CA&&nextPctCA>=100)||(wasNot100R&&nextPctR>=100)){
      setConfettiTrigger(t=>t+1);
    }
    if(wasNot100CA&&nextPctCA>=100&&uid&&userName){
      postToWallOfFame(uid, userName, `a atteint son objectif CA du mois ! 💰`, "🎉");
    }
    if(wasNot100R&&nextPctR>=100&&uid&&userName){
      postToWallOfFame(uid, userName, `a atteint son objectif recrutement du mois ! 👥`, "🎉");
    }
    save(nextObj);
  };

  const historique = obj.historique || [];

  const snapshotNow = () => {
    const entry = {
      date: new Date().toISOString().slice(0,10),
      ca: +obj.ca || 0,
      caObj: +obj.caObj || 0,
      recruesReal: +obj.recruesReal || 0,
      recruesObj: +obj.recruesObj || 0,
      palier: obj.palier || "2%",
    };
    return [...historique, entry].slice(-24); // garde les 24 derniers points
  };

  const resetPeriode=()=>{
    const nextHist = snapshotNow();
    const totalCaCumul = (+obj.totalCaCumul||0) + (+obj.ca||0);
    const totalRecruesCumul = (+obj.totalRecruesCumul||0) + (+obj.recruesReal||0);
    save({...obj,ca:"",recruesReal:"0",historique:nextHist,totalCaCumul,totalRecruesCumul});
  };

  const enregistrerPoint=()=>{
    save({...obj,historique:snapshotNow()});
  };

  return(
    <div>
      <Confetti trigger={confettiTrigger}/>
      <Fireworks trigger={fireworksTrigger}/>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Mes <em style={{fontStyle:"italic",color:C.rose}}>Objectifs</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Tes objectifs personnels ce mois-ci. Visibles dans le bouton 📊 en bas à droite.
      </p>

      {/* Timer période */}
      <PeriodeTimer/>

      {/* Bouton reset */}
      <div style={{background:"rgba(196,74,26,.08)",border:"1px solid rgba(196,74,26,.2)",borderRadius:10,padding:".65rem 1rem",marginBottom:"1rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:".73rem",fontWeight:600,color:C.brun}}>🔄 Nouvelle période</div>
          <div style={{fontSize:".65rem",color:C.gris}}>Remet CA réalisé et recrues à zéro</div>
        </div>
        <button onClick={resetPeriode}
          style={{background:"#C44B1A",color:"white",border:"none",borderRadius:8,padding:".35rem .75rem",fontSize:".72rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          Remettre à zéro
        </button>
      </div>

      {/* Récap période en cours + total global */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:"1rem"}}>
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem"}}>
          <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".4rem"}}>📅 Cette période</div>
          <div style={{fontSize:".68rem",color:C.gris}}>💰 CA</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.25rem",fontWeight:600,color:C.brun,lineHeight:1.2}}>{obj.ca||0}€</div>
          <div style={{fontSize:".68rem",color:C.gris,marginTop:".3rem"}}>👥 Recrues</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.25rem",fontWeight:600,color:C.brun,lineHeight:1.2}}>{obj.recruesReal||0}</div>
        </div>
        <div style={{background:`linear-gradient(135deg, ${C.brun}, ${C.brun2})`,borderRadius:12,padding:".75rem"}}>
          <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.or,marginBottom:".4rem"}}>🏆 Total depuis le début</div>
          <div style={{fontSize:".68rem",color:C.pale,opacity:.85}}>💰 CA cumulé</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.25rem",fontWeight:600,color:"white",lineHeight:1.2}}>{(+obj.totalCaCumul||0)+(+obj.ca||0)}€</div>
          <div style={{fontSize:".68rem",color:C.pale,opacity:.85,marginTop:".3rem"}}>👥 Recrues cumulées</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.25rem",fontWeight:600,color:"white",lineHeight:1.2}}>{(+obj.totalRecruesCumul||0)+(+obj.recruesReal||0)}</div>
        </div>
      </div>

      {/* PALIER */}
      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:".75rem"}}>
        <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.or,marginBottom:".6rem"}}>🏆 Palier à atteindre</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:".35rem"}}>
          {PALIERS_PERSO.map(p=>{
            const current=obj.palier===p;
            const idx=PALIERS_PERSO.indexOf(p);
            const currentIdx=PALIERS_PERSO.indexOf(obj.palier||"2%");
            const passed=currentIdx>idx;
            return(
              <div key={p} onClick={()=>{
                  const suggestion = PALIER_CA_OBJ[p];
                  save(suggestion!==undefined ? {...obj,palier:p,caObj:String(suggestion)} : {...obj,palier:p});
                }}
                style={{padding:".3rem .75rem",borderRadius:20,fontSize:".72rem",fontWeight:600,cursor:"pointer",border:`2px solid ${current?C.or:passed?C.or+"50":C.pale}`,background:current?C.or:passed?C.or+"15":"transparent",color:current?C.brun:passed?C.brun2:C.gris,transition:"all .2s"}}>
                {passed&&!current?"✓ ":""}{p}
              </div>
            );
          })}
        </div>
        <div style={{marginTop:".75rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:".62rem",color:C.gris,marginBottom:".25rem"}}>
            <span>Progression plan de rémunération</span>
            <span style={{fontWeight:700,color:C.or}}>{PALIERS_PERSO.indexOf(obj.palier||"2%")+1}/{PALIERS_PERSO.length}</span>
          </div>
          <div style={{height:8,background:C.pale,borderRadius:10,overflow:"hidden"}}>
            <div style={{height:"100%",background:C.or,width:(((PALIERS_PERSO.indexOf(obj.palier||"2%")+1)/PALIERS_PERSO.length)*100)+"%",borderRadius:10,transition:"width .4s"}}/>
          </div>
        </div>
      </div>

      {/* CA */}
      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:".75rem"}}>
        <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>💰 Chiffre d'affaires</div>
        <div style={{display:"flex",gap:".5rem",marginBottom:".6rem"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:".62rem",color:C.gris,marginBottom:".25rem"}}>Mon objectif (€)</div>
            <input type="number" placeholder="Ex: 500" value={obj.caObj||""} onChange={e=>save({...obj,caObj:e.target.value})}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".9rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none",fontWeight:600}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:".62rem",color:C.gris,marginBottom:".25rem"}}>Réalisé (€)</div>
            <input type="number" placeholder="Ex: 250" value={obj.ca||""} onChange={e=>checkAndCelebrate({...obj,ca:e.target.value})}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".9rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none",fontWeight:600}}/>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:".62rem",color:C.gris,marginBottom:".25rem"}}>
          <span>Progression</span>
          <span style={{fontWeight:700,color:pctCA()>=100?C.vert:C.rose}}>{pctCA()}%</span>
        </div>
        <div style={{height:10,background:C.pale,borderRadius:10,overflow:"hidden"}}>
          <div style={{height:"100%",background:pctCA()>=100?C.vert:C.rose,width:pctCA()+"%",borderRadius:10,transition:"width .4s"}}/>
        </div>
        {pctCA()>=100&&<div style={{textAlign:"center",fontSize:".75rem",color:C.vert,fontWeight:700,marginTop:".4rem"}}>🎉 Objectif CA atteint !</div>}
        {(() => {
          const comp = comparaisonPeriode(historique, obj.ca, "ca");
          if(!comp) return null;
          const up = comp.diff >= 0;
          return (
            <div style={{display:"flex",alignItems:"center",gap:".3rem",marginTop:".5rem",fontSize:".66rem",color:up?C.vert:"#B04040"}}>
              <span>{up?"📈":"📉"}</span>
              <span style={{fontWeight:700}}>{comp.diff>=0?"+":""}{comp.diff}€</span>
              <span style={{color:C.gris}}>vs période précédente ({comp.previous}€{comp.pct!==0?` · ${comp.pct>0?"+":""}${comp.pct}%`:""})</span>
            </div>
          );
        })()}
        {historique.length>=2&&(
          <div style={{marginTop:".75rem",paddingTop:".6rem",borderTop:`1px solid ${C.pale}`}}>
            <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:C.gris,marginBottom:".4rem"}}>📈 Évolution de ton CA</div>
            <MiniChart data={historique} dataKey="ca" objKey="caObj" color={C.rose} unit="€"/>
          </div>
        )}
      </div>

      {/* PRIMES DE QUALIFICATION */}
      <PrimesQualificationSection obj={obj} save={save} onPrimeValidee={()=>setFireworksTrigger(t=>t+1)}/>

      {/* RECRUES */}
      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:".75rem"}}>
        <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.lilas,marginBottom:".6rem"}}>👥 Objectif recrues</div>
        <div style={{display:"flex",gap:".5rem",marginBottom:".6rem"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:".62rem",color:C.gris,marginBottom:".25rem"}}>Objectif (recrues)</div>
            <select value={obj.recruesObj||"0"} onChange={e=>save({...obj,recruesObj:e.target.value})}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".9rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none",fontWeight:600}}>
              {Array.from({length:16},(_,i)=>i).map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:".62rem",color:C.gris,marginBottom:".25rem"}}>Recrutées</div>
            <select value={obj.recruesReal||"0"} onChange={e=>checkAndCelebrate({...obj,recruesReal:e.target.value})}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".9rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none",fontWeight:600}}>
              {Array.from({length:16},(_,i)=>i).map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        {obj.recruesObj&&obj.recruesObj!=="0"&&(
          <>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:".62rem",color:C.gris,marginBottom:".25rem"}}>
              <span>Progression</span>
              <span style={{fontWeight:700,color:pctR()>=100?C.vert:C.lilas}}>{pctR()}%</span>
            </div>
            <div style={{height:10,background:C.pale,borderRadius:10,overflow:"hidden"}}>
              <div style={{height:"100%",background:pctR()>=100?C.vert:C.lilas,width:pctR()+"%",borderRadius:10,transition:"width .4s"}}/>
            </div>
            {pctR()>=100&&<div style={{textAlign:"center",fontSize:".75rem",color:C.vert,fontWeight:700,marginTop:".4rem"}}>🎉 Objectif recrues atteint !</div>}
          </>
        )}
        {(() => {
          const comp = comparaisonPeriode(historique, obj.recruesReal, "recruesReal");
          if(!comp) return null;
          const up = comp.diff >= 0;
          return (
            <div style={{display:"flex",alignItems:"center",gap:".3rem",marginTop:".5rem",fontSize:".66rem",color:up?C.vert:"#B04040"}}>
              <span>{up?"📈":"📉"}</span>
              <span style={{fontWeight:700}}>{comp.diff>=0?"+":""}{comp.diff}</span>
              <span style={{color:C.gris}}>vs période précédente ({comp.previous})</span>
            </div>
          );
        })()}
        {historique.length>=2&&(
          <div style={{marginTop:".75rem",paddingTop:".6rem",borderTop:`1px solid ${C.pale}`}}>
            <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:C.gris,marginBottom:".4rem"}}>📈 Évolution de tes recrues</div>
            <MiniChart data={historique} dataKey="recruesReal" objKey="recruesObj" color={C.lilas}/>
          </div>
        )}
      </div>

      {/* Enregistrer un point manuel */}
      <div style={{background:"rgba(168,155,181,.08)",border:`1px solid ${C.lilas}40`,borderRadius:10,padding:".65rem 1rem",marginBottom:".75rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:".73rem",fontWeight:600,color:C.brun}}>📍 Enregistrer un point sur la courbe</div>
          <div style={{fontSize:".62rem",color:C.gris}}>Ajoute ta progression actuelle à l'historique, sans réinitialiser</div>
        </div>
        <button onClick={enregistrerPoint}
          style={{background:C.lilas,color:"white",border:"none",borderRadius:8,padding:".35rem .75rem",fontSize:".72rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",flexShrink:0}}>
          + Point
        </button>
      </div>
    </div>
  );
}

// ── GESTION MEMBRES (Melissa uniquement) ─────────────────────────────────────
function MembresTab({uid}){
  const isMelissa=uid==="melissa"||uid==="melissa-da-silveira";
  const[membres,setMembres]=useState([]);
  const[chefs,setChefs]=useState([]);
  const[newMembre,setNewMembre]=useState({prenom:"",nom:""});
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState(false);
  const[search,setSearch]=useState("");
  const[annuaire,setAnnuaire]=useState({});

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"acces","membres"));
        if(snap.exists()){
          setMembres(snap.data().liste||[]);
          setChefs(snap.data().chefs||[]);
        }
        const annSnap=await getDoc(doc(db,"equipe","annuaire"));
        setAnnuaire(annSnap.exists()?annSnap.data().membres||{}:{});
      }catch{}
      setLoading(false);
    })();
  },[]);

  // Assigne/modifie la marraine d'un membre directement depuis l'admin
  const assignerMarraine=async(membreFullName, marraineFullName)=>{
    const membreUid = membreFullName.toLowerCase().replace(/\s+/g,"-");
    const marraineUid = marraineFullName ? marraineFullName.toLowerCase().replace(/\s+/g,"-") : "";
    try{
      const ref=doc(db,"equipe","annuaire");
      const existing = annuaire[membreUid] || {uid:membreUid, prenom:"", nom:"", dateEnreg:new Date().toISOString().slice(0,10)};
      const updated = {...existing, marraine:marraineUid||null};
      const nextAnnuaire = {...annuaire, [membreUid]:updated};
      setAnnuaire(nextAnnuaire);
      await setDoc(ref, {membres:{[membreUid]:updated}}, {merge:true});
      if(marraineUid) await setDoc(doc(db,"users",membreUid),{marraine:marraineUid},{merge:true});
    }catch{}
  };

  const saveAll=async(liste,chefsList)=>{
    setSaving(true);
    try{await setDoc(doc(db,"acces","membres"),{liste,chefs:chefsList});}catch{}
    setSaving(false);
  };

  const add=async()=>{
    if(!newMembre.prenom.trim()||!newMembre.nom.trim())return;
    const full=`${newMembre.prenom.trim().toLowerCase()} ${newMembre.nom.trim().toLowerCase()}`;
    if(membres.includes(full))return;
    const next=[...membres,full];
    setMembres(next);
    await saveAll(next,chefs);
    setNewMembre({prenom:"",nom:""});
  };

  const remove=async(m)=>{
    const nextM=membres.filter(x=>x!==m);
    const nextC=chefs.filter(x=>x!==m);
    setMembres(nextM);setChefs(nextC);
    await saveAll(nextM,nextC);
  };

  const toggleChef=async(m)=>{
    const isChef=chefs.includes(m);
    const nextC=isChef?chefs.filter(x=>x!==m):[...chefs,m];
    setChefs(nextC);
    await saveAll(membres,nextC);
  };

  const fmt=(m)=>m.split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");

  if(loading)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Accès <em style={{fontStyle:"italic",color:C.rose}}>Équipe</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Gère les membres et les chefs d'équipe. Code d'accès : <strong style={{color:C.brun}}>BD-2025-FIRE</strong>
      </p>

      {/* Ajouter */}
      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
        <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>➕ Ajouter un membre</div>
        <div style={{display:"flex",gap:".4rem",marginBottom:".5rem"}}>
          <input placeholder="Prénom" value={newMembre.prenom} onChange={e=>setNewMembre(p=>({...p,prenom:e.target.value}))}
            style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
          <input placeholder="Nom" value={newMembre.nom} onChange={e=>setNewMembre(p=>({...p,nom:e.target.value}))}
            onKeyDown={e=>e.key==="Enter"&&add()}
            style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
        </div>
        <button onClick={add} disabled={saving||!newMembre.prenom.trim()||!newMembre.nom.trim()}
          style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".52rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          {saving?"Sauvegarde...":"Ajouter"}
        </button>
      </div>

      {/* Barre de recherche */}
      <input placeholder="🔍 Rechercher un membre..." value={search} onChange={e=>setSearch(e.target.value)}
        style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .7rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".75rem",boxSizing:"border-box"}}/>

      {/* Liste */}
      <div style={{fontSize:".62rem",color:C.gris,marginBottom:".5rem"}}>
        {membres.length} membre{membres.length>1?"s":""} · {chefs.length} chef{chefs.length>1?"s":""} d'équipe
      </div>
      {membres.filter(m=>!search||m.toLowerCase().includes(search.toLowerCase())).map(m=>{
        const isChef=chefs.includes(m);
        const mUid = m.toLowerCase().replace(/\s+/g,"-");
        const currentMarraine = annuaire[mUid]?.marraine || "";
        const currentMarraineLabel = currentMarraine ? fmt(currentMarraine) : "";
        return(
          <div key={m} style={{background:C.blanc,border:`1px solid ${isChef?C.or:C.pale}`,borderRadius:10,padding:".65rem 1rem",marginBottom:".4rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",gap:".6rem",alignItems:"center"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:isChef?C.or+"30":C.rose+"20",color:isChef?C.brun2:C.rose,fontSize:".8rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {isChef?"👑":fmt(m)[0]}
              </div>
              <div>
                <div style={{fontSize:".82rem",fontWeight:600,color:C.brun}}>{fmt(m)}</div>
                {isChef&&<div style={{fontSize:".6rem",color:C.or,fontWeight:700}}>Chef d'équipe</div>}
              </div>
            </div>
            <div style={{display:"flex",gap:".4rem"}}>
              <button onClick={()=>toggleChef(m)}
                style={{background:isChef?C.or+"20":"none",border:`1px solid ${isChef?C.or:C.pale}`,borderRadius:6,padding:".2rem .55rem",color:isChef?C.brun2:C.gris,cursor:"pointer",fontSize:".65rem",fontFamily:"inherit",fontWeight:isChef?700:400}}>
                {isChef?"👑 Chef":"→ Chef"}
              </button>
              <button onClick={()=>remove(m)}
                style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:6,padding:".2rem .55rem",color:"#B04040",cursor:"pointer",fontSize:".7rem",fontFamily:"inherit"}}>
                ✕
              </button>
            </div>
          </div>
          {/* Marraine */}
          <div style={{marginTop:".5rem",paddingTop:".5rem",borderTop:`1px solid ${C.creme}`,display:"flex",alignItems:"center",gap:".5rem"}}>
            <span style={{fontSize:".64rem",color:C.gris,flexShrink:0}}>🌸 Marraine :</span>
            <div style={{flex:1}}>
              <SearchSelect
                value={currentMarraineLabel ? currentMarraineLabel.toLowerCase() : ""}
                onChange={(val)=>assignerMarraine(m, val)}
                options={["melissa da silveira", ...membres.filter(x=>x.toLowerCase()!==m.toLowerCase())]}
                placeholder="🔍 Aucune — tape pour assigner" compact/>
            </div>
            {currentMarraine&&(
              <button onClick={()=>assignerMarraine(m,"")}
                style={{background:"none",border:"none",color:C.gris,cursor:"pointer",fontSize:".62rem",fontFamily:"inherit",textDecoration:"underline",flexShrink:0}}>
                retirer
              </button>
            )}
          </div>
        </div>
        );
      })}
      {membres.length===0&&(
        <div style={{textAlign:"center",padding:"1.5rem",color:C.gris,fontSize:".76rem"}}>Aucun membre ajouté.</div>
      )}
      <div style={{background:"rgba(196,74,26,.08)",border:"1px solid rgba(196,74,26,.2)",borderRadius:10,padding:".7rem 1rem",marginTop:"1rem",fontSize:".73rem",color:C.brun,lineHeight:1.6}}>
        💡 Clique sur <strong>"→ Chef"</strong> pour promouvoir une fille chef d'équipe. Elle pourra voir les objectifs des filles qui l'ont choisie à leur inscription.
      </div>
    </div>
  );
}

// ── MON ÉQUIPE (chefs d'équipe) ───────────────────────────────────────────────
// Carte stats d'un membre (réutilisée dans MonEquipeTab et le navigateur d'équipe)
function MembreStatsCard({m, expanded, onToggleExpand}){
  const pct=(r,o)=>{if(!o||!r)return 0;return Math.min(100,Math.round(+r/+o*100));};
  const hist = m.historique || [];
  const compCA = comparaisonPeriode(hist, m.ca, "ca");
  const compR = comparaisonPeriode(hist, m.recruesReal, "recruesReal");
  const[extra,setExtra]=useState(null);
  const[loadingExtra,setLoadingExtra]=useState(false);
  const fmt=(id)=>id.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");

  // Charge les données complètes depuis Firebase quand on ouvre la fiche
  useEffect(()=>{
    if(!expanded||extra||!m.uid)return;
    setLoadingExtra(true);
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"users",m.uid));
        if(snap.exists()){
          const d=snap.data();
          setExtra({
            streak:+d["db-streak"]||0,
            lastLogin:d["db-last-login"]||null,
            actions:d["db-actions"]?JSON.parse(d["db-actions"]):{},
            totalCA:+d["db-actions-cumul"]||0,
            recrues:d["recrues"]?JSON.parse(d["recrues"]):[],
            badges:d["db-badges-unlocked"]?JSON.parse(d["db-badges-unlocked"]):[],
            notes:d["db-distributeurs-notes"]||"",
            fastStart:d["db-fast-start"]?JSON.parse(d["db-fast-start"]):null,
          });
        }
      }catch{}
      setLoadingExtra(false);
    })();
  },[expanded,m.uid]);

  const today=new Date().toISOString().slice(0,10);
  const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);

  return(
    <div>
      {/* ── RÉSUMÉ RAPIDE ── */}
      {[
        {label:"💰 CA",val:m.ca,goal:m.caObj,unit:"€",color:C.rose},
        {label:"👥 Recrues",val:m.recruesReal,goal:m.recruesObj,unit:"",color:C.lilas},
      ].map(({label,val,goal,unit,color})=>(
        <div key={label} style={{marginBottom:".5rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:".72rem",color:C.texte,marginBottom:".2rem"}}>
            <span style={{fontWeight:600}}>{label}</span>
            <span style={{color:pct(val,goal)>=100?C.vert:color,fontWeight:700}}>{val||"—"}{unit} / {goal||"—"}{unit} · {pct(val,goal)}%</span>
          </div>
          <div style={{height:5,background:C.pale,borderRadius:10,overflow:"hidden"}}>
            <div style={{height:"100%",background:pct(val,goal)>=100?C.vert:color,width:pct(val,goal)+"%",borderRadius:10,transition:"width .4s"}}/>
          </div>
        </div>
      ))}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:".35rem",fontSize:".7rem",color:C.gris}}>
        <span>Palier visé</span>
        <span style={{fontWeight:700,color:C.or}}>{m.palier||"2%"}</span>
      </div>

      {(compCA||compR)&&(
        <div style={{display:"flex",gap:".6rem",marginTop:".5rem",flexWrap:"wrap"}}>
          {compCA&&<span style={{fontSize:".64rem",color:compCA.diff>=0?C.vert:"#B04040"}}>{compCA.diff>=0?"📈":"📉"} CA {compCA.diff>=0?"+":""}{compCA.diff}€ vs avant</span>}
          {compR&&<span style={{fontSize:".64rem",color:compR.diff>=0?C.vert:"#B04040"}}>{compR.diff>=0?"📈":"📉"} Recrues {compR.diff>=0?"+":""}{compR.diff} vs avant</span>}
        </div>
      )}

      <button onClick={onToggleExpand}
        style={{width:"100%",background:"none",border:`1px solid ${C.pale}`,borderRadius:8,padding:".3rem",fontSize:".66rem",color:C.gris,fontFamily:"inherit",cursor:"pointer",marginTop:".5rem"}}>
        {expanded?"▲ Masquer la fiche complète":"▼ Voir la fiche complète"}
      </button>

      {/* ── FICHE COMPLÈTE ── */}
      {expanded&&(
        <div style={{marginTop:".6rem",paddingTop:".6rem",borderTop:`1px solid ${C.pale}`}}>
          {loadingExtra&&<div style={{textAlign:"center",fontSize:".72rem",color:C.gris,padding:".5rem"}}>Chargement...</div>}

          {extra&&(
            <div>
              {/* Connexion & Streak */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:".4rem",marginBottom:".75rem"}}>
                <div style={{background:C.creme,borderRadius:9,padding:".5rem",textAlign:"center"}}>
                  <div style={{fontSize:".58rem",color:C.gris,marginBottom:".15rem"}}>🔥 Streak</div>
                  <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:700,color:extra.streak>=5?C.or:C.brun}}>{extra.streak}j</div>
                </div>
                <div style={{background:C.creme,borderRadius:9,padding:".5rem",textAlign:"center"}}>
                  <div style={{fontSize:".58rem",color:C.gris,marginBottom:".15rem"}}>📅 Connexion</div>
                  <div style={{fontSize:".62rem",fontWeight:700,color:extra.lastLogin===today?C.vert:extra.lastLogin===yesterday?C.or:"#C0504D"}}>
                    {extra.lastLogin===today?"Aujourd'hui":extra.lastLogin===yesterday?"Hier":extra.lastLogin?new Date(extra.lastLogin).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}):"Jamais"}
                  </div>
                </div>
                <div style={{background:C.creme,borderRadius:9,padding:".5rem",textAlign:"center"}}>
                  <div style={{fontSize:".58rem",color:C.gris,marginBottom:".15rem"}}>⚡ Actions/j</div>
                  <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:700,color:C.brun}}>
                    {Object.values(extra.actions).filter(Boolean).length}/5
                  </div>
                </div>
              </div>

              {/* Barre actions du jour */}
              <div style={{marginBottom:".75rem"}}>
                <div style={{fontSize:".6rem",color:C.gris,marginBottom:".3rem"}}>Actions du jour</div>
                <div style={{display:"flex",gap:"3px"}}>
                  {Array.from({length:5}).map((_,i)=>(
                    <div key={i} style={{flex:1,height:6,borderRadius:3,background:i<Object.values(extra.actions).filter(Boolean).length?C.rose:C.pale}}/>
                  ))}
                </div>
              </div>

              {/* Objectifs détaillés */}
              <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:10,padding:".75rem",marginBottom:".75rem"}}>
                <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.or,marginBottom:".5rem"}}>🎯 Objectifs période</div>
                {[
                  {label:"💰 CA",val:m.ca,goal:m.caObj,unit:"€",color:C.rose},
                  {label:"👥 Recrues",val:m.recruesReal,goal:m.recruesObj,unit:"",color:C.lilas},
                ].map(({label,val,goal,unit,color})=>{
                  const p=pct(val,goal);
                  return(
                    <div key={label} style={{marginBottom:".5rem"}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:".68rem",color:C.pale,marginBottom:".2rem"}}>
                        <span>{label}</span>
                        <span style={{fontWeight:700,color:p>=100?C.vert:color}}>{val||0}{unit} / {goal||"—"}{unit} · {p}%</span>
                      </div>
                      <div style={{height:5,background:"rgba(255,255,255,.1)",borderRadius:10,overflow:"hidden"}}>
                        <div style={{height:"100%",background:p>=100?C.vert:color,width:p+"%",borderRadius:10}}/>
                      </div>
                    </div>
                  );
                })}
                <div style={{display:"flex",justifyContent:"space-between",fontSize:".68rem",color:C.pale,marginTop:".3rem"}}>
                  <span>Palier visé</span>
                  <span style={{fontWeight:700,color:C.or}}>{m.palier||"2%"}</span>
                </div>
              </div>

              {/* Recrues en suivi */}
              {extra.recrues.length>0&&(
                <div style={{background:C.creme,borderRadius:9,padding:".65rem",marginBottom:".75rem"}}>
                  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.lilas,marginBottom:".4rem"}}>
                    📋 Recrues en suivi ({extra.recrues.length})
                  </div>
                  {extra.recrues.map(r=>{
                    const{pct:p}=getProgress(r);
                    return(
                      <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:".3rem 0",borderBottom:`1px solid ${C.pale}`,fontSize:".7rem"}}>
                        <span style={{color:C.brun,fontWeight:600}}>{r.name}</span>
                        <span style={{color:p>=100?C.vert:C.rose,fontWeight:700}}>{p}%</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Fast Start */}
              {extra.fastStart&&(
                <div style={{background:C.creme,borderRadius:9,padding:".65rem",marginBottom:".75rem"}}>
                  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".3rem"}}>🚀 Fast Start</div>
                  {(()=>{
                    const totalTaches=FAST_START_DAYS.reduce((s,d)=>s+d.taches.length,0);
                    const done=Object.values(extra.fastStart.doneTasks||{}).filter(Boolean).length;
                    const p=Math.round(done/totalTaches*100);
                    return(
                      <>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:".68rem",color:C.gris,marginBottom:".25rem"}}>
                          <span>Progression</span><span style={{fontWeight:700,color:p>=100?C.vert:C.brun}}>{done}/{totalTaches} ({p}%)</span>
                        </div>
                        <div style={{height:5,background:C.pale,borderRadius:10,overflow:"hidden"}}>
                          <div style={{height:"100%",background:p>=100?C.vert:C.rose,width:p+"%",borderRadius:10}}/>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Badges */}
              {extra.badges.length>0&&(
                <div style={{marginBottom:".75rem"}}>
                  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.gris,marginBottom:".4rem"}}>🏅 Badges débloqués</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:".3rem"}}>
                    {BADGES_DEF.filter(b=>extra.badges.includes(b.id)).map(b=>(
                      <div key={b.id} title={b.desc} style={{background:C.or+"20",border:`1px solid ${C.or}40`,borderRadius:8,padding:".3rem .5rem",fontSize:".65rem",color:C.brun,fontWeight:600}}>
                        {b.icon} {b.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Courbes historique */}
              {hist.length>=2&&(
                <>
                  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:C.gris,marginBottom:".3rem"}}>📈 CA</div>
                  <MiniChart data={hist} dataKey="ca" objKey="caObj" color={C.rose} unit="€"/>
                  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:C.gris,marginBottom:".3rem",marginTop:".6rem"}}>📈 Recrues</div>
                  <MiniChart data={hist} dataKey="recruesReal" objKey="recruesObj" color={C.lilas}/>
                </>
              )}
              {hist.length<2&&<div style={{fontSize:".68rem",color:C.gris,textAlign:"center"}}>Pas encore d'historique pour cette personne.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Onglet "Assiduité équipe" — visible chefs/Melissa : connexions + actions du jour de chaque membre
const TODAY_ACTIONS_COUNT = 5;

function AssiduiteTab({uid}){
  const[loading,setLoading]=useState(true);
  const[isAuthorized,setIsAuthorized]=useState(false);
  const[membres,setMembres]=useState([]);
  const[search,setSearch]=useState("");

  const fmtUid=(u)=>u.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");

  useEffect(()=>{
    (async()=>{
      try{
        const isMelissa = uid==="melissa"||uid==="melissa-da-silveira";
        const accesSnap=await getDoc(doc(db,"acces","membres"));
        const chefs=accesSnap.exists()?accesSnap.data().chefs||[]:[];
        const isChef = isMelissa || chefs.includes(uid.replace(/-/g," "));
        if(!isChef){ setIsAuthorized(false); setLoading(false); return; }
        setIsAuthorized(true);

        const annSnap=await getDoc(doc(db,"equipe","annuaire"));
        const annuaire = annSnap.exists()?annSnap.data().membres||{}:{};

        // Détermine la liste des uids à afficher : toute l'équipe (Melissa) ou la descendance (chef)
        let targetUids;
        if(isMelissa){
          targetUids = Object.keys(annuaire);
        } else {
          const visited=new Set();
          const queue=[uid];
          while(queue.length){
            const current=queue.pop();
            Object.values(annuaire).forEach(m=>{
              if(m.marraine===current && !visited.has(m.uid)){
                visited.add(m.uid);
                queue.push(m.uid);
              }
            });
          }
          targetUids = [...visited];
        }

        // Charge les données d'assiduité de chaque membre
        const results = await Promise.all(targetUids.map(async(mUid)=>{
          try{
            const snap=await getDoc(doc(db,"users",mUid));
            if(!snap.exists())return {uid:mUid, noData:true};
            const data=snap.data();
            const actions = data["db-actions"] ? JSON.parse(data["db-actions"]) : {};
            const doneToday = Object.values(actions).filter(Boolean).length;
            return {
              uid:mUid,
              lastLogin: data["db-last-login"]||null,
              streak: +data["db-streak"]||0,
              doneToday,
              noData:false,
            };
          }catch{ return {uid:mUid, noData:true}; }
        }));

        // Tri : streak décroissant, puis nom
        results.sort((a,b)=> (b.streak||0)-(a.streak||0) || a.uid.localeCompare(b.uid));
        setMembres(results);
      }catch{}
      setLoading(false);
    })();
  },[uid]);

  if(loading)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  if(!isAuthorized)return(
    <div style={{textAlign:"center",padding:"3rem 1rem",color:C.gris}}>
      <div style={{fontSize:"2rem",marginBottom:".75rem"}}>👑</div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",color:C.brun,marginBottom:".4rem"}}>Accès chef d'équipe</div>
      <div style={{fontSize:".75rem",lineHeight:1.6}}>Cet espace est réservé aux chefs d'équipe.<br/>Melissa peut te promouvoir depuis son espace.</div>
    </div>
  );

  const today=new Date().toISOString().slice(0,10);
  const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Assiduité <em style={{fontStyle:"italic",color:C.rose}}>Équipe</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Connexions et actions du jour de ton équipe. {membres.length} personne{membres.length>1?"s":""}.
      </p>

      <input placeholder="🔍 Rechercher un membre..." value={search} onChange={e=>setSearch(e.target.value)}
        style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .7rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".75rem",boxSizing:"border-box"}}/>

      {membres.filter(m=>!search||fmtUid(m.uid).toLowerCase().includes(search.toLowerCase())).length===0&&(
        <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".76rem"}}>{membres.length===0?"Aucune donnée d'équipe pour l'instant.":"Aucun membre ne correspond à la recherche."}</div>
      )}

      {membres.filter(m=>!search||fmtUid(m.uid).toLowerCase().includes(search.toLowerCase())).map(m=>{
        const connectedToday = m.lastLogin===today;
        const connectedYesterday = m.lastLogin===yesterday;
        let statusColor, statusLabel;
        if(m.noData||!m.lastLogin){ statusColor=C.gris; statusLabel="Jamais connectée"; }
        else if(connectedToday){ statusColor=C.vert; statusLabel="Connectée aujourd'hui"; }
        else if(connectedYesterday){ statusColor=C.or; statusLabel="Connectée hier"; }
        else { statusColor="#C0504D"; statusLabel=`Dernière connexion : ${new Date(m.lastLogin).toLocaleDateString("fr-FR")}`; }

        const doneToday = m.noData ? 0 : Math.min(m.doneToday, TODAY_ACTIONS_COUNT);

        return(
          <div key={m.uid} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".7rem 1rem",marginBottom:".5rem"}}>
            <div style={{display:"flex",gap:".6rem",alignItems:"center"}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:statusColor+"20",color:statusColor,fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative"}}>
                {fmtUid(m.uid)[0]}
                <div style={{position:"absolute",bottom:-2,right:-2,width:10,height:10,borderRadius:"50%",background:statusColor,border:`2px solid ${C.blanc}`}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:C.brun}}>{fmtUid(m.uid)}</div>
                <div style={{fontSize:".62rem",color:statusColor}}>{statusLabel}</div>
              </div>
              {!m.noData&&(
                <div style={{textAlign:"right",flexShrink:0}}>
                  {m.streak>=2&&<div style={{fontSize:".68rem",fontWeight:700,color:C.or}}>🔥 {m.streak}j</div>}
                  <div style={{fontSize:".64rem",color:C.gris}}>Actions : {doneToday}/{TODAY_ACTIONS_COUNT}</div>
                </div>
              )}
            </div>
            {!m.noData&&(
              <div style={{display:"flex",gap:"3px",marginTop:".5rem"}}>
                {Array.from({length:TODAY_ACTIONS_COUNT}).map((_,i)=>(
                  <div key={i} style={{flex:1,height:5,borderRadius:3,background:i<doneToday?C.rose:C.pale}}/>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


// Onglet "Espace Chef" — regroupe toutes les fonctions chef d'équipe au même endroit
const ESPACE_CHEF_SECTIONS=[
  {id:"membres",icon:"⚙️",label:"Accès équipe",desc:"Gérer les membres, chefs, et assigner les marraines",chefOnly:true},
  {id:"assiduite",icon:"📊",label:"Assiduité équipe",desc:"Connexions et actions du jour de chaque membre",chefOnly:true},
  {id:"defi",icon:"🚀",label:"Défi Flash",desc:"Lancer un défi collectif pour toute l'équipe",chefOnly:true},
  {id:"powerhour",icon:"⏱️",label:"Power Hour",desc:"Sprint collectif synchrone de 20 minutes",chefOnly:true},
  {id:"distributeurs",icon:"👑",label:"Distributeurs",desc:"Voir et naviguer dans l'arborescence de ton équipe",chefOnly:false},
  {id:"nouveaux",icon:"📋",label:"Nouveaux Distri",desc:"Suivi onboarding des filleules récentes",chefOnly:false},
  {id:"admin",icon:"🔧",label:"Administration",desc:"Gérer les contenus, citations, scripts, annonces et produits",melissaOnly:true},
];

// ── MESSAGERIE ÉQUIPE ────────────────────────────────────────────────────────
// Popup pour envoyer un message perso ou groupé à son équipe
function MessageEquipePopup({uid, userName, annuaire, onClose}){
  const[mode,setMode]=useState("choix"); // choix | perso | groupe
  const[destinataire,setDestinataire]=useState(null);
  const[texte,setTexte]=useState("");
  const[sending,setSending]=useState(false);
  const[sent,setSent]=useState(false);

  const fmt=(id)=>id.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");

  // Récupère tous les descendants directs
  const getDescendants=(rootUid)=>{
    const result=new Set();
    const queue=[rootUid];
    while(queue.length){
      const current=queue.pop();
      Object.values(annuaire).forEach(m=>{
        if(m.marraine===current&&!result.has(m.uid)){
          result.add(m.uid);
          queue.push(m.uid);
        }
      });
    }
    return [...result];
  };

  const equipe=getDescendants(uid);
  const directes=Object.values(annuaire).filter(m=>m.marraine===uid);

  const envoyerMsg=async(destinataires)=>{
    if(!texte.trim()||destinataires.length===0)return;
    setSending(true);
    const msg={
      id:`msg${Date.now()}`,
      de:uid,
      deNom:userName,
      texte:texte.trim(),
      ts:Date.now(),
      lu:false,
    };
    try{
      await Promise.all(destinataires.map(async(destUid)=>{
        const ref=doc(db,"messages",destUid);
        const snap=await getDoc(ref);
        const existing=snap.exists()?snap.data().msgs||[]:[];
        await setDoc(ref,{msgs:[msg,...existing].slice(0,100)},{merge:false});
      }));
      setSent(true);
      setTexte("");
      setTimeout(()=>{setSent(false);setMode("choix");setDestinataire(null);},2000);
    }catch{}
    setSending(false);
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,31,14,.6)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:9998,padding:"1rem"}}>
      <div style={{background:C.blanc,borderRadius:"16px 16px 0 0",padding:"1.4rem",width:"100%",maxWidth:480,boxShadow:"0 -8px 32px rgba(0,0,0,.2)",maxHeight:"80vh",overflowY:"auto"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,color:C.brun}}>
            {mode==="choix"?"💬 Envoyer un message":mode==="groupe"?"👥 Message groupé":"💬 Message personnel"}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:"1.2rem",color:C.gris,cursor:"pointer",padding:".2rem"}}>✕</button>
        </div>

        {/* CHOIX */}
        {mode==="choix"&&(
          <div>
            <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.6}}>
              Tu as <strong style={{color:C.brun}}>{equipe.length}</strong> personne{equipe.length>1?"s":""} dans ton équipe.
            </p>
            <div onClick={()=>setMode("groupe")}
              style={{background:C.brun,borderRadius:12,padding:"1rem",marginBottom:".6rem",cursor:"pointer",display:"flex",alignItems:"center",gap:".75rem"}}>
              <div style={{fontSize:"1.5rem"}}>👥</div>
              <div>
                <div style={{fontSize:".88rem",fontWeight:600,color:C.blanc}}>Message groupé</div>
                <div style={{fontSize:".68rem",color:C.pale}}>Envoyer à toute ton équipe ({equipe.length} personnes)</div>
              </div>
            </div>
            <div onClick={()=>setMode("perso")}
              style={{background:C.rose+"15",border:`1px solid ${C.rose}`,borderRadius:12,padding:"1rem",cursor:"pointer",display:"flex",alignItems:"center",gap:".75rem"}}>
              <div style={{fontSize:"1.5rem"}}>💌</div>
              <div>
                <div style={{fontSize:".88rem",fontWeight:600,color:C.brun}}>Message personnel</div>
                <div style={{fontSize:".68rem",color:C.gris}}>Choisir une personne spécifique</div>
              </div>
            </div>
          </div>
        )}

        {/* MESSAGE GROUPÉ */}
        {mode==="groupe"&&(
          <div>
            <button onClick={()=>setMode("choix")} style={{background:"none",border:"none",color:C.rose,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0,marginBottom:"1rem"}}>← Retour</button>
            <div style={{background:C.creme,borderRadius:10,padding:".7rem",marginBottom:"1rem",fontSize:".72rem",color:C.gris}}>
              📤 Sera envoyé à : <strong style={{color:C.brun}}>{equipe.map(fmt).join(", ")}</strong>
            </div>
            <textarea
              placeholder="Écris ton message ici... ex: Bravo à toutes pour cette semaine ! 🔥 On continue sur cette lancée !"
              value={texte} onChange={e=>setTexte(e.target.value)}
              style={{width:"100%",minHeight:120,border:`1px solid ${C.pale}`,borderRadius:10,padding:".75rem",fontFamily:"inherit",fontSize:".82rem",color:C.texte,background:C.blanc,resize:"vertical",outline:"none",lineHeight:1.65,marginBottom:"1rem"}}/>
            <button onClick={()=>envoyerMsg(equipe)} disabled={!texte.trim()||sending||sent}
              style={{width:"100%",background:sent?C.vert:texte.trim()?C.brun:C.pale,color:texte.trim()?C.blanc:C.gris,border:"none",borderRadius:10,padding:".7rem",fontSize:".82rem",fontWeight:600,fontFamily:"inherit",cursor:texte.trim()?"pointer":"default",transition:"all .2s"}}>
              {sent?"✅ Envoyé !":sending?"Envoi...":"Envoyer à toute l'équipe →"}
            </button>
          </div>
        )}

        {/* MESSAGE PERSONNEL — CHOIX DESTINATAIRE */}
        {mode==="perso"&&!destinataire&&(
          <div>
            <button onClick={()=>setMode("choix")} style={{background:"none",border:"none",color:C.rose,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0,marginBottom:"1rem"}}>← Retour</button>
            <p style={{fontSize:".74rem",color:C.gris,marginBottom:".75rem"}}>Choisis la destinataire :</p>
            {equipe.map(mUid=>(
              <div key={mUid} onClick={()=>setDestinataire(mUid)}
                style={{display:"flex",alignItems:"center",gap:".65rem",background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:10,padding:".65rem .85rem",marginBottom:".4rem",cursor:"pointer"}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:C.rose+"20",color:C.rose,fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {fmt(mUid)[0]}
                </div>
                <div>
                  <div style={{fontSize:".82rem",fontWeight:600,color:C.brun}}>{fmt(mUid)}</div>
                  <div style={{fontSize:".62rem",color:C.gris}}>
                    {annuaire[mUid]?.marraine===uid?"Filleule directe":"Filleule indirecte"}
                  </div>
                </div>
                <span style={{marginLeft:"auto",color:C.pale}}>›</span>
              </div>
            ))}
          </div>
        )}

        {/* MESSAGE PERSONNEL — SAISIE */}
        {mode==="perso"&&destinataire&&(
          <div>
            <button onClick={()=>setDestinataire(null)} style={{background:"none",border:"none",color:C.rose,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0,marginBottom:"1rem"}}>← Retour</button>
            <div style={{display:"flex",alignItems:"center",gap:".6rem",background:C.creme,borderRadius:10,padding:".65rem .85rem",marginBottom:"1rem"}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:C.rose+"20",color:C.rose,fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {fmt(destinataire)[0]}
              </div>
              <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:C.brun}}>{fmt(destinataire)}</div>
            </div>
            <textarea
              placeholder={`Écris ton message pour ${fmt(destinataire)}...`}
              value={texte} onChange={e=>setTexte(e.target.value)}
              style={{width:"100%",minHeight:120,border:`1px solid ${C.pale}`,borderRadius:10,padding:".75rem",fontFamily:"inherit",fontSize:".82rem",color:C.texte,background:C.blanc,resize:"vertical",outline:"none",lineHeight:1.65,marginBottom:"1rem"}}/>
            <button onClick={()=>envoyerMsg([destinataire])} disabled={!texte.trim()||sending||sent}
              style={{width:"100%",background:sent?C.vert:texte.trim()?C.brun:C.pale,color:texte.trim()?C.blanc:C.gris,border:"none",borderRadius:10,padding:".7rem",fontSize:".82rem",fontWeight:600,fontFamily:"inherit",cursor:texte.trim()?"pointer":"default",transition:"all .2s"}}>
              {sent?"✅ Envoyé !":sending?"Envoi...":`Envoyer à ${fmt(destinataire)} →`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Affichage des messages reçus (popup sur le tableau de bord)
function MessagesRecusPopup({uid, onClose}){
  const[msgs,setMsgs]=useState([]);
  const[loading,setLoading]=useState(true);
  const fmt=(id)=>id.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"messages",uid));
        if(snap.exists()) setMsgs(snap.data().msgs||[]);
      }catch{}
      setLoading(false);
    })();
  },[uid]);

  const marquerLus=async()=>{
    const next=msgs.map(m=>({...m,lu:true}));
    setMsgs(next);
    try{await setDoc(doc(db,"messages",uid),{msgs:next});}catch{}
  };

  useEffect(()=>{
    if(msgs.length>0) marquerLus();
  },[msgs.length]);

  const nonLus=msgs.filter(m=>!m.lu).length;

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,31,14,.6)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:9998,padding:"1rem"}}>
      <div style={{background:C.blanc,borderRadius:"16px 16px 0 0",padding:"1.4rem",width:"100%",maxWidth:480,boxShadow:"0 -8px 32px rgba(0,0,0,.2)",maxHeight:"80vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,color:C.brun}}>
            💬 Mes messages {nonLus>0&&<span style={{background:C.rose,color:"white",borderRadius:20,fontSize:".6rem",padding:".1rem .45rem",marginLeft:".3rem"}}>{nonLus}</span>}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:"1.2rem",color:C.gris,cursor:"pointer"}}>✕</button>
        </div>
        {loading&&<div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".78rem"}}>Chargement...</div>}
        {!loading&&msgs.length===0&&(
          <div style={{textAlign:"center",padding:"2rem",color:C.gris}}>
            <div style={{fontSize:"2rem",marginBottom:".5rem"}}>📭</div>
            <div style={{fontSize:".76rem"}}>Aucun message pour l'instant.</div>
          </div>
        )}
        {msgs.map(m=>(
          <div key={m.id} style={{background:m.lu?C.creme:C.rose+"10",border:`1px solid ${m.lu?C.pale:C.rose+"40"}`,borderRadius:12,padding:".85rem 1rem",marginBottom:".6rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".4rem"}}>
              <div style={{fontSize:".78rem",fontWeight:700,color:C.brun}}>{fmt(m.de)}</div>
              <div style={{fontSize:".6rem",color:C.gris}}>{new Date(m.ts).toLocaleDateString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</div>
            </div>
            <div style={{fontSize:".78rem",color:C.texte,lineHeight:1.65}}>{m.texte}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


function EspaceChefTab({uid, isChef}){
  const[section,setSection]=useState("");
  const[distrib,setDistrib]=useState([]);
  const[annuaire,setAnnuaire]=useState({});
  const[showMsg,setShowMsg]=useState(false);
  const[showMsgsRecus,setShowMsgsRecus]=useState(false);
  const[nbMsgsNonLus,setNbMsgsNonLus]=useState(0);
  const userName=uid.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
  const isMelissaChef = uid==="melissa"||uid==="melissa-da-silveira";
  const sections = ESPACE_CHEF_SECTIONS.filter(s=>{
    if(s.melissaOnly) return isMelissaChef;
    if(s.chefOnly) return isChef;
    return true;
  });

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"equipe","annuaire"));
        setAnnuaire(snap.exists()?snap.data().membres||{}:{});
      }catch{}
      try{
        const snap2=await getDoc(doc(db,"messages",uid));
        if(snap2.exists()){
          const msgs=snap2.data().msgs||[];
          setNbMsgsNonLus(msgs.filter(m=>!m.lu).length);
        }
      }catch{}
    })();
  },[uid]);

  // Charge les distributeurs manuels depuis Firebase quand on entre dans cette section
  const loadDistrib=async()=>{
    const data=await sgAll(uid);
    if(data["db-distributeurs"]){try{setDistrib(JSON.parse(data["db-distributeurs"]));}catch{}}
  };
  const saveDistrib=(d)=>{setDistrib(d);ss(uid,"db-distributeurs",JSON.stringify(d));};

  if(section){
    const s=sections.find(x=>x.id===section);
    return(
      <div>
        <button onClick={()=>setSection("")}
          style={{background:"none",border:"none",color:C.rose,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0,marginBottom:".75rem"}}>
          ← Retour à Espace Chef
        </button>
        {section==="membres"&&<MembresTab uid={uid}/>}
        {section==="assiduite"&&<AssiduiteTab uid={uid}/>}
        {section==="defi"&&<DefisTab uid={uid} userName={uid.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")} canCreate={isChef}/>}
        {section==="powerhour"&&<PowerHourTab uid={uid} userName={uid.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")} canCreate={isChef}/>}
        {section==="distributeurs"&&<DistributeursTab distributeurs={distrib} save={saveDistrib} uid={uid}/>}
        {section==="monequipe"&&<MonEquipeTab uid={uid}/>}
        {section==="nouveaux"&&<SuiviRecruTab uid={uid}/>}
        {section==="admin"&&(uid==="melissa"||uid==="melissa-da-silveira")&&<AdminTab/>}
      </div>
    );
  }

  return(
    <div>
      {showMsg&&<MessageEquipePopup uid={uid} userName={userName} annuaire={annuaire} onClose={()=>setShowMsg(false)}/>}
      {showMsgsRecus&&<MessagesRecusPopup uid={uid} onClose={()=>{setShowMsgsRecus(false);setNbMsgsNonLus(0);}}/>}

      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Espace <em style={{fontStyle:"italic",color:C.rose}}>Chef</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Toutes tes fonctions de cheffe d'équipe, au même endroit.
      </p>

      {/* Boutons messagerie */}
      <div style={{display:"flex",gap:".5rem",marginBottom:"1rem"}}>
        <button onClick={()=>setShowMsg(true)}
          style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:".4rem",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".76rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          💬 Envoyer un message
        </button>
        <button onClick={()=>setShowMsgsRecus(true)}
          style={{position:"relative",background:nbMsgsNonLus>0?C.rose+"15":C.creme,border:`1px solid ${nbMsgsNonLus>0?C.rose:C.pale}`,borderRadius:10,padding:".6rem .9rem",fontSize:".76rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",color:nbMsgsNonLus>0?C.rose:C.gris}}>
          📭 Reçus
          {nbMsgsNonLus>0&&(
            <span style={{position:"absolute",top:-6,right:-6,background:C.rose,color:"white",borderRadius:"50%",minWidth:18,height:18,fontSize:".6rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>
              {nbMsgsNonLus}
            </span>
          )}
        </button>
      </div>
      {sections.map(s=>(
        <div key={s.id} onClick={()=>{if(s.id==="distributeurs")loadDistrib();setSection(s.id);}}
          style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".8rem 1rem",marginBottom:".5rem",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:".7rem"}}>
            <div style={{width:38,height:38,borderRadius:"50%",background:C.rose+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",flexShrink:0}}>{s.icon}</div>
            <div>
              <div style={{fontFamily:"Georgia,serif",fontSize:".92rem",fontWeight:600,color:C.brun}}>{s.label}</div>
              <div style={{fontSize:".66rem",color:C.gris}}>{s.desc}</div>
            </div>
          </div>
          <span style={{color:C.pale}}>›</span>
        </div>
      ))}
    </div>
  );
}


function MonEquipeTab({uid}){
  const[annuaire,setAnnuaire]=useState({});
  const[loading,setLoading]=useState(true);
  const[isChef,setIsChef]=useState(false);
  const[authorized,setAuthorized]=useState(false);
  const[expanded,setExpanded]=useState(null);
  const[search,setSearch]=useState(""); // Chemin de navigation : liste d'uids, le dernier = dossier actuellement ouvert
  const[path,setPath]=useState([]);

  useEffect(()=>{
    (async()=>{
      try{
        const accesSnap=await getDoc(doc(db,"acces","membres"));
        const chefs=accesSnap.exists()?accesSnap.data().chefs||[]:[];
        const chef=chefs.includes(uid.replace(/-/g," "))||uid==="melissa-da-silveira"||uid==="melissa";
        setIsChef(chef);

        const annSnap=await getDoc(doc(db,"equipe","annuaire"));
        const annuaire=annSnap.exists()?annSnap.data().membres||{}:{};
        setAnnuaire(annuaire);

        const hasTeam = Object.values(annuaire).some(m=>m.marraine===uid);
        if(!chef&&!hasTeam){setLoading(false);return;}
        setAuthorized(true);
      }catch{}
      setLoading(false);
    })();
  },[uid]);

  const fmt=(id)=>id.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");

  if(loading)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  if(!authorized)return(
    <div style={{textAlign:"center",padding:"3rem 1rem",color:C.gris}}>
      <div style={{fontSize:"2rem",marginBottom:".75rem"}}>👑</div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",color:C.brun,marginBottom:".4rem"}}>Pas encore d'équipe</div>
      <div style={{fontSize:".75rem",lineHeight:1.6}}>Cet espace s'active dès que tu as au moins une filleule.<br/>Reviens ici quand quelqu'un t'aura choisie comme marraine !</div>
    </div>
  );

  // Racine = mes propres filleules directes
  const currentUid = path.length>0 ? path[path.length-1] : uid;
  const enfants = Object.values(annuaire).filter(m=>m.marraine===currentUid);
  const currentPerson = path.length>0 ? annuaire[currentUid] : null;

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Mon <em style={{fontStyle:"italic",color:C.rose}}>Équipe</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        {path.length===0
          ? `Tes ${enfants.length} filleule${enfants.length>1?"s":""} directe${enfants.length>1?"s":""}. Clique sur 📁 pour voir la sous-équipe d'une personne.`
          : `Équipe de ${currentPerson?fmt(currentPerson.uid):""} — ${enfants.length} filleule${enfants.length>1?"s":""} directe${enfants.length>1?"s":""}.`}
      </p>

      {/* Fil d'ariane */}
      {path.length>0&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:".3rem",alignItems:"center",marginBottom:"1rem",fontSize:".7rem"}}>
          <button onClick={()=>setPath([])} style={{background:"none",border:"none",color:C.rose,fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:".2rem"}}>🏠 Mon équipe</button>
          {path.map((pUid,i)=>(
            <span key={pUid} style={{display:"flex",alignItems:"center",gap:".3rem"}}>
              <span style={{color:C.pale}}>›</span>
              <button onClick={()=>setPath(path.slice(0,i+1))}
                style={{background:"none",border:"none",color:i===path.length-1?C.brun:C.rose,fontWeight:i===path.length-1?700:600,cursor:"pointer",fontFamily:"inherit",padding:".2rem"}}>
                {fmt(pUid)}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Fiche de la personne dont on consulte l'équipe */}
      {currentPerson&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".9rem 1rem",marginBottom:"1rem"}}>
          <div style={{display:"flex",gap:".6rem",alignItems:"center",marginBottom:".6rem"}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:C.rose+"20",color:C.rose,fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {fmt(currentPerson.uid)[0]}
            </div>
            <div style={{fontFamily:"Georgia,serif",fontSize:".95rem",fontWeight:600,color:C.brun}}>{fmt(currentPerson.uid)}</div>
          </div>
          <MembreStatsCard m={currentPerson} expanded={expanded===currentPerson.uid} onToggleExpand={()=>setExpanded(expanded===currentPerson.uid?null:currentPerson.uid)}/>
        </div>
      )}

      {enfants.length===0&&!search&&(
        <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".76rem"}}>
          {path.length===0
            ?<>Aucune fille ne t'a encore choisie comme marraine.<br/>Elles apparaîtront ici dès qu'elles t'auront sélectionnée à l'inscription ou via le pop-up.</>
            :"Cette personne n'a pas encore de filleules."}
        </div>
      )}

      {enfants.length>0&&(
        <input placeholder="🔍 Rechercher dans l'équipe..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .7rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".75rem",boxSizing:"border-box"}}/>
      )}

      {enfants.filter(m=>!search||fmt(m.uid).toLowerCase().includes(search.toLowerCase())).map(m=>{
        const sousEquipeCount = countEquipeSafe(annuaire, m.uid);
        const hasTeam = sousEquipeCount>0;
        return(
          <div key={m.uid} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".7rem 1rem",marginBottom:".5rem"}}>
            <div style={{display:"flex",gap:".6rem",alignItems:"center"}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:C.rose+"20",color:C.rose,fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {fmt(m.uid)[0]}
              </div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"Georgia,serif",fontSize:".92rem",fontWeight:600,color:C.brun}}>{fmt(m.uid)}</div>
                <div style={{fontSize:".62rem",color:C.gris}}>{m.palier||"2%"}{m.ca?` · ${m.ca}€`:""}</div>
              </div>
              {hasTeam&&(
                <button onClick={()=>setPath([...path,m.uid])}
                  style={{display:"flex",alignItems:"center",gap:".3rem",background:C.lilas+"15",border:`1px solid ${C.lilas}50`,borderRadius:8,padding:".35rem .6rem",fontSize:".68rem",fontWeight:600,color:C.lilas,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                  📁 {sousEquipeCount}
                </button>
              )}
              <button onClick={()=>setExpanded(expanded===m.uid?null:m.uid)}
                style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:8,padding:".35rem .55rem",fontSize:".68rem",color:C.gris,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                {expanded===m.uid?"▲":"▼"}
              </button>
            </div>
            {expanded===m.uid&&(
              <div style={{marginTop:".6rem",paddingTop:".6rem",borderTop:`1px solid ${C.pale}`}}>
                <MembreStatsCard m={m} expanded={true} onToggleExpand={()=>setExpanded(null)}/>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ADMIN TAB (Melissa uniquement) ───────────────────────────────────────────
function AdminTab(){
  const[sections,setSections]=useState([]);
  const[loading,setLoading]=useState(true);
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({onglet:"demarrage",titre:"",description:"",url:"",type:"video",actif:true});
  const[saving,setSaving]=useState(false);

  const ONGLETS=[
    {id:"demarrage",label:"📚 Démarrage"},
    {id:"vente",label:"🎯 Vente"},
    {id:"recrutement",label:"👥 Recrutement"},
    {id:"contenu",label:"📱 Contenu"},
    {id:"devperso",label:"🧠 Dév. Personnel"},
    {id:"outils",label:"🛠️ Outils"},
    {id:"formaproduits",label:"🧴 Formation Produits"},
    {id:"formationapp",label:"🎬 Formation App"},
  ];

  const TYPES=[
    {id:"video",label:"▶ Vidéo Zoom"},
    {id:"youtube",label:"▶ YouTube"},
    {id:"drive",label:"📄 Drive"},
    {id:"doc",label:"📝 Google Doc"},
    {id:"info",label:"💡 Info texte"},
  ];

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","contenus"));
        if(snap.exists()) setSections(snap.data().items||[]);
      }catch{}
      setLoading(false);
    })();
  },[]);

  const saveItems=async(items)=>{
    setSaving(true);
    try{await setDoc(doc(db,"admin","contenus"),{items});}catch{}
    setSaving(false);
  };

  const add=async()=>{
    if(!form.titre.trim())return;
    const item={id:`adm${Date.now()}`,...form};
    const next=[...sections,item];
    setSections(next);
    await saveItems(next);
    setForm({onglet:"demarrage",titre:"",description:"",url:"",type:"video",actif:true});
    setShowAdd(false);
  };

  const del=async(id)=>{
    const next=sections.filter(s=>s.id!==id);
    setSections(next);
    await saveItems(next);
  };

  const toggle=async(id)=>{
    const next=sections.map(s=>s.id===id?{...s,actif:!s.actif}:s);
    setSections(next);
    await saveItems(next);
  };

  if(loading)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Espace <em style={{fontStyle:"italic",color:C.rose}}>Admin</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Ajoute des formations, vidéos et ressources directement sans toucher au code.
      </p>

      <button onClick={()=>setShowAdd(p=>!p)}
        style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".65rem",fontSize:".82rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:"1rem"}}>
        ➕ Ajouter un contenu
      </button>

      {showAdd&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>Nouveau contenu</div>

          <div style={{marginBottom:".45rem"}}>
            <div style={{fontSize:".62rem",color:C.gris,marginBottom:".2rem"}}>Onglet de destination</div>
            <select value={form.onglet} onChange={e=>setForm(p=>({...p,onglet:e.target.value}))}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}>
              {ONGLETS.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>

          <div style={{marginBottom:".45rem"}}>
            <div style={{fontSize:".62rem",color:C.gris,marginBottom:".2rem"}}>Type de contenu</div>
            <div style={{display:"flex",gap:".3rem",flexWrap:"wrap"}}>
              {TYPES.map(t=>(
                <button key={t.id} onClick={()=>setForm(p=>({...p,type:t.id}))}
                  style={{padding:".25rem .6rem",fontSize:".65rem",fontWeight:600,borderRadius:20,border:`1px solid ${form.type===t.id?C.rose:C.pale}`,background:form.type===t.id?C.rose:C.blanc,color:form.type===t.id?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <input placeholder="Titre (ex: Tips de vente — Session 3)" value={form.titre} onChange={e=>setForm(p=>({...p,titre:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".45rem"}}/>

          <input placeholder="URL (lien Zoom, YouTube, Drive...)" value={form.url} onChange={e=>setForm(p=>({...p,url:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".45rem"}}/>

          <textarea placeholder="Description courte (optionnel)" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}
            style={{width:"100%",minHeight:60,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontFamily:"inherit",fontSize:".78rem",color:C.texte,background:C.creme,resize:"vertical",outline:"none",lineHeight:1.5,marginBottom:".6rem"}}/>

          <div style={{display:"flex",gap:".4rem"}}>
            <button onClick={add} disabled={saving||!form.titre.trim()}
              style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".52rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              {saving?"Sauvegarde...":"Publier"}
            </button>
            <button onClick={()=>setShowAdd(false)}
              style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".52rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste par onglet */}
      {ONGLETS.map(onglet=>{
        const items=sections.filter(s=>s.onglet===onglet.id);
        if(items.length===0)return null;
        return(
          <div key={onglet.id} style={{marginBottom:"1rem"}}>
            <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.brun,marginBottom:".4rem",padding:".2rem .6rem",background:C.pale,borderRadius:20,display:"inline-block"}}>{onglet.label}</div>
            {items.map(item=>(
              <div key={item.id} style={{background:item.actif?C.blanc:C.pale+"60",border:`1px solid ${item.actif?C.pale:"#ddd"}`,borderRadius:10,padding:".7rem .9rem",marginBottom:".4rem",opacity:item.actif?1:.6}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:".8rem",fontWeight:600,color:C.brun,marginBottom:".15rem"}}>{item.titre}</div>
                    {item.description&&<div style={{fontSize:".7rem",color:C.gris,marginBottom:".15rem"}}>{item.description}</div>}
                    {item.url&&<div style={{fontSize:".65rem",color:C.lilas,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200}}>{item.url}</div>}
                  </div>
                  <div style={{display:"flex",gap:".3rem",flexShrink:0,marginLeft:".5rem"}}>
                    <button onClick={()=>toggle(item.id)}
                      style={{background:item.actif?C.vert+"20":"none",border:`1px solid ${item.actif?C.vert:C.pale}`,borderRadius:6,padding:".2rem .5rem",color:item.actif?C.vert:C.gris,cursor:"pointer",fontSize:".65rem",fontFamily:"inherit"}}>
                      {item.actif?"✓ Actif":"Masqué"}
                    </button>
                    <button onClick={()=>del(item.id)}
                      style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:6,padding:".2rem .45rem",color:"#B04040",cursor:"pointer",fontSize:".7rem",fontFamily:"inherit"}}>✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {sections.length===0&&(
        <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".76rem"}}>
          Aucun contenu ajouté.<br/>Utilise le bouton ci-dessus pour commencer.
        </div>
      )}

      <div style={{background:"rgba(196,154,138,.1)",border:`1px solid ${C.pale}`,borderRadius:10,padding:".75rem 1rem",marginTop:"1rem",fontSize:".73rem",color:C.brun,lineHeight:1.65}}>
        💡 Les contenus que tu ajoutes ici apparaissent dans les onglets correspondants pour toute l'équipe. Tu peux les masquer temporairement sans les supprimer.
      </div>

      {/* ── SECTION TEXTES & CITATIONS ── */}
      <div style={{marginTop:"1.5rem",paddingTop:"1rem",borderTop:`1px solid ${C.pale}`}}>
        <div style={{fontSize:".7rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>💬 Citations & Messages</div>
        <p style={{fontSize:".72rem",color:C.gris,lineHeight:1.6,marginBottom:"1rem"}}>
          Gère les citations motivantes affichées sur la page d'accueil (une différente chaque jour) et le message d'accueil de l'équipe.
        </p>
        <AdminTextesEditor/>
      </div>

      {/* ── SECTION SCRIPTS SUPPLÉMENTAIRES ── */}
      <div style={{marginTop:"1.5rem",paddingTop:"1rem",borderTop:`1px solid ${C.pale}`}}>
        <div style={{fontSize:".7rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>📝 Ajouter des scripts</div>
        <p style={{fontSize:".72rem",color:C.gris,lineHeight:1.6,marginBottom:"1rem"}}>
          Ajoute de nouveaux scripts prêts à l'emploi. Ils apparaîtront dans la Bibliothèque Scripts pour toute l'équipe, dans une section "Ajoutés par Melissa".
        </p>
        <AdminScriptsEditor/>
      </div>

      {/* ── SECTION POSTS SUPPLÉMENTAIRES ── */}
      <div style={{marginTop:"1.5rem",paddingTop:"1rem",borderTop:`1px solid ${C.pale}`}}>
        <div style={{fontSize:".7rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>📱 Ajouter des idées de posts</div>
        <p style={{fontSize:".72rem",color:C.gris,lineHeight:1.6,marginBottom:"1rem"}}>
          Ajoute de nouvelles idées de publications (hook + caption). Elles apparaîtront dans l'onglet Contenu pour toute l'équipe, dans une section "Idées ajoutées par Melissa".
        </p>
        <AdminPostsEditor/>
      </div>

      {/* ── SECTION ANNUAIRE DISTRIBUTEURS ── */}
      <div style={{marginTop:"1.5rem",paddingTop:"1rem",borderTop:`1px solid ${C.pale}`}}>
        <div style={{fontSize:".7rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>👑 Annuaire Distributeurs</div>
        <p style={{fontSize:".72rem",color:C.gris,lineHeight:1.6,marginBottom:"1rem"}}>
          L'onglet Distributeurs se met à jour automatiquement à chaque connexion d'un membre. Clique ici pour ajouter immédiatement tous les membres déjà autorisés (même s'ils ne se sont pas encore reconnectés depuis cette mise à jour).
        </p>
        <AdminAnnuaireSync/>
      </div>

      {/* ── SECTION ANNONCE IMPORTANTE ── */}
      <div style={{marginTop:"1.5rem",paddingTop:"1rem",borderTop:`1px solid ${C.pale}`}}>
        <div style={{fontSize:".7rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>📣 Annonce importante</div>
        <p style={{fontSize:".72rem",color:C.gris,lineHeight:1.6,marginBottom:"1rem"}}>
          Affiche un message en pop-up (une fois) + bandeau permanent sur le Tableau de bord de toute l'équipe.
        </p>
        <AdminAnnonceEditor/>
      </div>

      {/* ── SECTION PRIX PRODUITS ── */}
      <div style={{marginTop:"1.5rem",paddingTop:"1rem",borderTop:`1px solid ${C.pale}`}}>
        <div style={{fontSize:".7rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>🔍 Prix de la recherche rapide produits</div>
        <p style={{fontSize:".72rem",color:C.gris,lineHeight:1.6,marginBottom:"1rem"}}>
          Renseigne les prix qui apparaîtront dans l'outil "Recherche Produits" de toute l'équipe.
        </p>
        <AdminProduitsEditor/>
      </div>

      {/* ── SECTION DIAGNOSTICS PRODUITS ── */}
      <div style={{marginTop:"1.5rem",paddingTop:"1rem",borderTop:`1px solid ${C.pale}`}}>
        <div style={{fontSize:".7rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>🩺 Personnaliser les packs diagnostics</div>
        <p style={{fontSize:".72rem",color:C.gris,lineHeight:1.6,marginBottom:"1rem"}}>
          Tu peux ajouter des notes ou corrections sur les produits que l'IA recommande dans les diagnostics. Ces notes seront intégrées dans les prochaines ordonnances.
        </p>
        <DiagAdminEditor/>
      </div>
    </div>
  );
}

// ── ADMIN CONTENT BLOCK (injecté dans les onglets) ───────────────────────────
function AdminContentBlock({onglet,items}){
  const filtered=items.filter(i=>i.onglet===onglet);
  if(filtered.length===0)return null;

  const typeConfig={
    video:{icon:"▶",color:"#8B1A1A",label:"Zoom"},
    youtube:{icon:"▶",color:"#8B1A1A",label:"YouTube"},
    drive:{icon:"📄",color:"#5C3020",label:"Drive"},
    doc:{icon:"📝",color:"#1a4a8b",label:"Doc"},
    info:{icon:"💡",color:"#5C8A60",label:"Info"},
  };

  return(
    <div style={{marginTop:".5rem"}}>
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".4rem"}}>✦ Ajouté par Melissa</div>
      {filtered.map(item=>{
        const cfg=typeConfig[item.type]||typeConfig.info;
        return(
          <div key={item.id} style={{background:"rgba(196,154,138,.08)",border:`1px solid ${C.pale}`,borderRadius:10,padding:".65rem .85rem",marginBottom:".4rem"}}>
            <div style={{fontSize:".78rem",fontWeight:600,color:C.brun,marginBottom:item.description?".2rem":item.url?".35rem":0}}>{item.titre}</div>
            {item.description&&<div style={{fontSize:".72rem",color:C.gris,lineHeight:1.5,marginBottom:item.url?".4rem":0}}>{item.description}</div>}
            {item.url&&(
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                style={{display:"flex",alignItems:"center",gap:".5rem",background:cfg.color,borderRadius:8,padding:".45rem .8rem",textDecoration:"none",marginTop:".1rem"}}>
                <span style={{fontSize:".8rem",flexShrink:0}}>{cfg.icon}</span>
                <span style={{fontSize:".72rem",fontWeight:600,color:"white"}}>Ouvrir — {cfg.label}</span>
                <span style={{marginLeft:"auto",color:"rgba(255,255,255,.6)",fontSize:".6rem"}}>→</span>
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ADMIN POSTS EDITOR ───────────────────────────────────────────────────────
function AdminPostsEditor(){
  const[items,setItems]=useState([]);
  const[loaded,setLoaded]=useState(false);
  const[saving,setSaving]=useState(false);
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({theme:"",hook:"",caption:""});

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","posts_extra"));
        if(snap.exists()) setItems(snap.data().items||[]);
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const save=async(next)=>{
    setSaving(true);
    try{await setDoc(doc(db,"admin","posts_extra"),{items:next});}catch{}
    setItems(next);
    setSaving(false);
  };

  const add=()=>{
    if(!form.theme.trim()||!form.hook.trim()||!form.caption.trim())return;
    const postId="adm-post-"+Date.now();
    const themeKey=form.theme.trim();
    const existing=items.find(t=>t.theme===themeKey);
    let next;
    if(existing){
      next=items.map(t=>t.theme===themeKey?{...t,posts:[...t.posts,{id:postId,hook:form.hook.trim(),caption:form.caption.trim()}]}:t);
    } else {
      next=[...items,{theme:themeKey,color:C.or,posts:[{id:postId,hook:form.hook.trim(),caption:form.caption.trim()}]}];
    }
    save(next);
    setForm({theme:"",hook:"",caption:""});
    setShowAdd(false);
  };

  const delPost=(themeKey,postId)=>{
    let next=items.map(t=>t.theme===themeKey?{...t,posts:t.posts.filter(p=>p.id!==postId)}:t).filter(t=>t.posts.length>0);
    save(next);
  };

  const totalPosts=items.reduce((a,t)=>a+t.posts.length,0);

  if(!loaded) return <div style={{fontSize:".74rem",color:C.gris}}>Chargement...</div>;

  return(
    <div>
      <button onClick={()=>setShowAdd(p=>!p)}
        style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:"1rem"}}>
        ➕ Ajouter une idée de post ({totalPosts})
      </button>

      {showAdd&&(
        <div style={{background:C.creme,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>Nouvelle idée</div>
          <input placeholder="Thème (ex: 🎉 Promo de printemps)" value={form.theme} onChange={e=>setForm(p=>({...p,theme:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".45rem"}}/>
          <input placeholder="Hook (1ère phrase qui accroche)" value={form.hook} onChange={e=>setForm(p=>({...p,hook:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".45rem"}}/>
          <textarea placeholder="Caption complète (avec CTA)" value={form.caption} onChange={e=>setForm(p=>({...p,caption:e.target.value}))}
            style={{width:"100%",minHeight:80,border:`1px solid ${C.pale}`,borderRadius:8,padding:".5rem .65rem",fontFamily:"inherit",fontSize:".78rem",color:C.texte,background:C.blanc,resize:"vertical",outline:"none",lineHeight:1.6,marginBottom:".6rem"}}/>
          <div style={{display:"flex",gap:".4rem"}}>
            <button onClick={add} disabled={saving} style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              {saving?"...":"Ajouter"}
            </button>
            <button onClick={()=>setShowAdd(false)} style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {items.map(theme=>(
        <div key={theme.theme} style={{marginBottom:".75rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",padding:".2rem .6rem",background:C.or+"20",color:C.brun2,borderRadius:20,display:"inline-block",marginBottom:".4rem"}}>{theme.theme}</div>
          {theme.posts.map(post=>(
            <div key={post.id} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:9,padding:".55rem .75rem",marginBottom:".3rem",display:"flex",gap:".5rem",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:".75rem",fontWeight:600,color:C.brun}}>{post.hook}</div>
                <div style={{fontSize:".68rem",color:C.gris,marginTop:".15rem"}}>{post.caption}</div>
              </div>
              <button onClick={()=>delPost(theme.theme,post.id)} style={{background:"none",border:"none",color:"#B04040",cursor:"pointer",fontSize:".7rem",padding:".15rem",fontFamily:"inherit",flexShrink:0}}>✕</button>
            </div>
          ))}
        </div>
      ))}
      {items.length===0&&<div style={{fontSize:".73rem",color:C.gris,fontStyle:"italic"}}>Aucune idée ajoutée encore.</div>}
    </div>
  );
}

// ── ADMIN SCRIPTS EDITOR ─────────────────────────────────────────────────────
function AdminScriptsEditor(){
  const[items,setItems]=useState([]);
  const[loaded,setLoaded]=useState(false);
  const[saving,setSaving]=useState(false);
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({cat:"",title:"",text:""});

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","scripts_extra"));
        if(snap.exists()) setItems(snap.data().items||[]);
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const save=async(next)=>{
    setSaving(true);
    try{await setDoc(doc(db,"admin","scripts_extra"),{items:next});}catch{}
    setItems(next);
    setSaving(false);
  };

  const add=()=>{
    if(!form.cat.trim()||!form.title.trim()||!form.text.trim())return;
    const catKey=form.cat.trim();
    const existing=items.find(c=>c.cat===catKey);
    let next;
    if(existing){
      next=items.map(c=>c.cat===catKey?{...c,scripts:[...c.scripts,{title:form.title.trim(),text:form.text.trim()}]}:c);
    } else {
      next=[...items,{cat:catKey,scripts:[{title:form.title.trim(),text:form.text.trim()}]}];
    }
    save(next);
    setForm({cat:"",title:"",text:""});
    setShowAdd(false);
  };

  const delScript=(catKey,title)=>{
    let next=items.map(c=>c.cat===catKey?{...c,scripts:c.scripts.filter(s=>s.title!==title)}:c).filter(c=>c.scripts.length>0);
    save(next);
  };

  const total=items.reduce((a,c)=>a+c.scripts.length,0);

  if(!loaded) return <div style={{fontSize:".74rem",color:C.gris}}>Chargement...</div>;

  return(
    <div>
      <button onClick={()=>setShowAdd(p=>!p)}
        style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:"1rem"}}>
        ➕ Ajouter un script ({total})
      </button>

      {showAdd&&(
        <div style={{background:C.creme,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>Nouveau script</div>
          <input placeholder="Catégorie (ex: 💬 Premier contact)" value={form.cat} onChange={e=>setForm(p=>({...p,cat:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".45rem"}}/>
          <input placeholder="Titre du script" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".45rem"}}/>
          <textarea placeholder="Texte du script" value={form.text} onChange={e=>setForm(p=>({...p,text:e.target.value}))}
            style={{width:"100%",minHeight:90,border:`1px solid ${C.pale}`,borderRadius:8,padding:".5rem .65rem",fontFamily:"inherit",fontSize:".78rem",color:C.texte,background:C.blanc,resize:"vertical",outline:"none",lineHeight:1.6,marginBottom:".6rem"}}/>
          <div style={{display:"flex",gap:".4rem"}}>
            <button onClick={add} disabled={saving} style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              {saving?"...":"Ajouter"}
            </button>
            <button onClick={()=>setShowAdd(false)} style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {items.map(cat=>(
        <div key={cat.cat} style={{marginBottom:".75rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",padding:".2rem .6rem",background:C.or+"20",color:C.brun2,borderRadius:20,display:"inline-block",marginBottom:".4rem"}}>{cat.cat}</div>
          {cat.scripts.map(s=>(
            <div key={s.title} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:9,padding:".55rem .75rem",marginBottom:".3rem",display:"flex",gap:".5rem",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:".75rem",fontWeight:600,color:C.brun}}>{s.title}</div>
                <div style={{fontSize:".68rem",color:C.gris,marginTop:".15rem"}}>{s.text}</div>
              </div>
              <button onClick={()=>delScript(cat.cat,s.title)} style={{background:"none",border:"none",color:"#B04040",cursor:"pointer",fontSize:".7rem",padding:".15rem",fontFamily:"inherit",flexShrink:0}}>✕</button>
            </div>
          ))}
        </div>
      ))}
      {items.length===0&&<div style={{fontSize:".73rem",color:C.gris,fontStyle:"italic"}}>Aucun script ajouté encore.</div>}
    </div>
  );
}

// ── ADMIN TEXTES EDITOR ──────────────────────────────────────────────────────
function AdminTextesEditor(){
  const[citations,setCitations]=useState([]);
  const[messageAccueil,setMessageAccueil]=useState("");
  const[loaded,setLoaded]=useState(false);
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);
  const[newCitation,setNewCitation]=useState("");

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","textes"));
        if(snap.exists()){
          const d=snap.data();
          setCitations(d.citations||CITATIONS_DEFAULT);
          setMessageAccueil(d.messageAccueil||"");
        } else {
          setCitations(CITATIONS_DEFAULT);
        }
      }catch{
        setCitations(CITATIONS_DEFAULT);
      }
      setLoaded(true);
    })();
  },[]);

  const save=async(nextCitations,nextMsg)=>{
    setSaving(true);
    try{await setDoc(doc(db,"admin","textes"),{citations:nextCitations,messageAccueil:nextMsg});}catch{}
    setSaving(false);
    setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  };

  const addCitation=()=>{
    if(!newCitation.trim())return;
    const next=[...citations,newCitation.trim()];
    setCitations(next);
    setNewCitation("");
    save(next,messageAccueil);
  };

  const delCitation=(idx)=>{
    const next=citations.filter((_,i)=>i!==idx);
    setCitations(next);
    save(next,messageAccueil);
  };

  const saveMsg=()=>save(citations,messageAccueil);

  if(!loaded) return <div style={{fontSize:".74rem",color:C.gris}}>Chargement...</div>;

  return(
    <div>
      {/* Message d'accueil équipe */}
      <div style={{marginBottom:"1.25rem"}}>
        <div style={{fontSize:".65rem",fontWeight:700,color:C.brun,marginBottom:".4rem"}}>👋 Message d'accueil (page d'accueil de l'équipe)</div>
        <textarea
          placeholder="Ex: Bienvenue dans ton espace Blazing Dynasty ! On est fières de t'avoir avec nous 🖤"
          value={messageAccueil}
          onChange={e=>setMessageAccueil(e.target.value)}
          style={{width:"100%",minHeight:70,border:`1px solid ${C.pale}`,borderRadius:9,padding:".6rem .8rem",fontFamily:"inherit",fontSize:".76rem",color:C.texte,background:C.creme,resize:"vertical",outline:"none",lineHeight:1.6,marginBottom:".5rem"}}/>
        <button onClick={saveMsg} disabled={saving}
          style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:9,padding:".5rem",fontSize:".76rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          {saving?"Sauvegarde...":saved?"✅ Sauvegardé !":"Sauvegarder le message"}
        </button>
      </div>

      {/* Citations */}
      <div>
        <div style={{fontSize:".65rem",fontWeight:700,color:C.brun,marginBottom:".4rem"}}>✨ Citations motivantes ({citations.length})</div>
        <p style={{fontSize:".68rem",color:C.gris,marginBottom:".5rem",lineHeight:1.5}}>Une citation différente s'affiche chaque jour sur la page d'accueil, dans l'ordre du jour de l'année (rotation automatique).</p>
        <div style={{display:"flex",gap:".4rem",marginBottom:".75rem"}}>
          <input placeholder="Nouvelle citation..." value={newCitation} onChange={e=>setNewCitation(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addCitation()}
            style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
          <button onClick={addCitation} disabled={saving||!newCitation.trim()}
            style={{background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".42rem .8rem",fontSize:".76rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",flexShrink:0}}>
            Ajouter
          </button>
        </div>
        <div style={{maxHeight:280,overflowY:"auto"}}>
          {citations.map((c,i)=>(
            <div key={i} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:8,padding:".5rem .7rem",marginBottom:".3rem",display:"flex",gap:".5rem",alignItems:"flex-start"}}>
              <div style={{flex:1,fontSize:".74rem",color:C.texte,fontStyle:"italic",lineHeight:1.5}}>{c}</div>
              <button onClick={()=>delCitation(i)} style={{background:"none",border:"none",color:"#B04040",cursor:"pointer",fontSize:".7rem",padding:".15rem",fontFamily:"inherit",flexShrink:0}}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── BANQUE D'IMAGES ───────────────────────────────────────────────────────────
const THEMES_IMAGES=[
  {id:"skincare",icon:"✨",label:"Skincare"},
  {id:"cheveux",icon:"💇",label:"Soins cheveux"},
  {id:"makeup",icon:"💄",label:"Make-up"},
  {id:"complements",icon:"💊",label:"Compléments"},
  {id:"parfums",icon:"🌸",label:"Parfums"},
  {id:"corps",icon:"🧴",label:"Soin corps"},
  {id:"home",icon:"🏠",label:"HOME"},
  {id:"recrutement",icon:"👑",label:"Recrutement"},
  {id:"outils",icon:"🛠️",label:"Outils équipe"},
];

function BanqueImagesTab({isMelissa}){
  const[images,setImages]=useState([]);
  const[theme,setTheme]=useState("skincare");
  const[sousTheme,setSousTheme]=useState("visuels");
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({titre:"",url:"",theme:"skincare",sousTheme:"visuels"});
  const[saving,setSaving]=useState(false);
  const[loaded,setLoaded]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"banque","images"));
        if(snap.exists()) setImages(snap.data().items||[]);
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const saveImages=async(items)=>{
    setSaving(true);
    try{await setDoc(doc(db,"banque","images"),{items});}catch{}
    setSaving(false);
  };

  const add=async()=>{
    if(!form.titre.trim()||!form.url.trim())return;
    const item={id:`img${Date.now()}`,...form};
    const next=[...images,item];
    setImages(next);await saveImages(next);
    setForm({titre:"",url:"",theme:"skincare",sousTheme:"visuels"});
    setShowAdd(false);
  };

  const del=async(id)=>{
    const next=images.filter(i=>i.id!==id);
    setImages(next);await saveImages(next);
  };

  const filtered=images.filter(i=>i.theme===theme&&i.sousTheme===sousTheme);

  if(!loaded)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Banque <em style={{fontStyle:"italic",color:C.rose}}>d'Images</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Télécharge les visuels et témoignages pour tes publications.
      </p>

      {isMelissa&&(
        <button onClick={()=>setShowAdd(p=>!p)}
          style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:"1rem"}}>
          ➕ Ajouter une image
        </button>
      )}

      {showAdd&&isMelissa&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>Nouvelle image</div>
          <input placeholder="Titre (ex: Avant/Après Skincare)" value={form.titre} onChange={e=>setForm(p=>({...p,titre:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".45rem"}}/>
          <input placeholder="URL de l'image (Google Drive, Imgur...)" value={form.url} onChange={e=>setForm(p=>({...p,url:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".45rem"}}/>
          <div style={{display:"flex",gap:".4rem",marginBottom:".45rem"}}>
            <select value={form.theme} onChange={e=>setForm(p=>({...p,theme:e.target.value}))}
              style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}>
              {THEMES_IMAGES.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
            </select>
            <select value={form.sousTheme} onChange={e=>setForm(p=>({...p,sousTheme:e.target.value}))}
              style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}>
              <option value="visuels">📸 Visuels</option>
              <option value="temoignages">💬 Témoignages</option>
            </select>
          </div>
          <div style={{display:"flex",gap:".4rem"}}>
            <button onClick={add} disabled={saving||!form.titre.trim()||!form.url.trim()}
              style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".52rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              {saving?"...":"Ajouter"}
            </button>
            <button onClick={()=>setShowAdd(false)}
              style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".52rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Filtres thèmes */}
      <div style={{display:"flex",gap:".3rem",overflowX:"auto",marginBottom:".75rem",paddingBottom:".3rem"}}>
        {THEMES_IMAGES.map(t=>(
          <button key={t.id} onClick={()=>setTheme(t.id)}
            style={{flex:"none",padding:".35rem .7rem",fontSize:".65rem",fontWeight:600,borderRadius:20,border:`1px solid ${theme===t.id?C.rose:C.pale}`,background:theme===t.id?C.rose:C.blanc,color:theme===t.id?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Sous-thème */}
      <div style={{display:"flex",gap:".4rem",marginBottom:"1rem"}}>
        {[{id:"visuels",label:"📸 Visuels"},{id:"temoignages",label:"💬 Témoignages"}].map(s=>(
          <button key={s.id} onClick={()=>setSousTheme(s.id)}
            style={{flex:1,padding:".4rem",fontSize:".72rem",fontWeight:600,borderRadius:9,border:`1px solid ${sousTheme===s.id?C.brun:C.pale}`,background:sousTheme===s.id?C.brun:C.blanc,color:sousTheme===s.id?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Grille d'images */}
      {filtered.length===0&&(
        <div style={{textAlign:"center",padding:"2.5rem 1rem",color:C.gris}}>
          <div style={{fontSize:"2rem",marginBottom:".5rem"}}>🖼️</div>
          <div style={{fontSize:".76rem"}}>
            {isMelissa?"Aucune image dans cette catégorie. Ajoutes-en une !":"Melissa n'a pas encore ajouté d'images ici."}
          </div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".65rem"}}>
        {filtered.map(img=>(
          <div key={img.id} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,overflow:"hidden",position:"relative"}}>
            <div style={{aspectRatio:"1",background:C.creme,overflow:"hidden",cursor:"pointer"}}
              onClick={()=>window.open(img.url,"_blank")}>
              <img src={img.url} alt={img.titre}
                style={{width:"100%",height:"100%",objectFit:"cover"}}
                onError={e=>{e.target.style.display="none";}}/>
            </div>
            <div style={{padding:".5rem .65rem"}}>
              <div style={{fontSize:".72rem",fontWeight:600,color:C.brun,marginBottom:".35rem"}}>{img.titre}</div>
              <div style={{display:"flex",gap:".3rem"}}>
                <a href={img.url} download target="_blank" rel="noopener noreferrer"
                  style={{flex:1,background:C.brun,color:C.blanc,borderRadius:7,padding:".3rem",fontSize:".65rem",fontWeight:600,textDecoration:"none",textAlign:"center",display:"block"}}>
                  ⬇ Télécharger
                </a>
                {isMelissa&&(
                  <button onClick={()=>del(img.id)}
                    style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:7,padding:".3rem .5rem",color:"#B04040",cursor:"pointer",fontSize:".65rem",fontFamily:"inherit"}}>✕</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DIAGNOSTICS ───────────────────────────────────────────────────────────────

// ── DIAGNOSTIC IA ────────────────────────────────────────────────────────────
// ── DIAGNOSTIC IA ────────────────────────────────────────────────────────────
// ── DIAGNOSTIC IA ────────────────────────────────────────────────────────────
// ── DIAGNOSTIC IA ────────────────────────────────────────────────────────────
async function genererOrdonnanceIA(type, reponses, nomClient) {
  // Charger les notes admin si elles existent
  let notesAdmin = "";
  try {
    const snap = await getDoc(doc(db,"admin","diag_notes"));
    if(snap.exists() && snap.data()[type]) notesAdmin = snap.data()[type];
  } catch {}

  // Charger le catalogue réel des produits Mihi
  let catalogueText = "";
  try {
    const catSnap = await getDoc(doc(db,"admin","catalogue_mihi"));
    if(catSnap.exists()){
      const cat = catSnap.data();
      const cle = type === "skincare" ? "face" : type === "cheveux" ? "hair" : "health";
      let produits = cat[cle] || [];
      // Limite à 40 produits max pour ne pas surcharger le prompt
      if(produits.length > 40) produits = produits.slice(0, 40);
      catalogueText = produits.map(p => `- ${p.nom} (série ${p.serie}) — ${p.prix}€`).join("\n");
    }
  } catch (e) {
    console.error("Erreur chargement catalogue:", e);
  }

  if(!catalogueText){
    console.error("Catalogue vide pour le type:", type);
  }

  const typeLabel = type === "skincare" ? "soin visage/peau" : type === "cheveux" ? "soin capillaire" : "santé et compléments alimentaires";
  
  const reponsesText = Object.entries(reponses).map(([k,v]) => `- ${k}: ${v}`).join("\n");
  
  const prompt = `Tu es une experte en cosmétiques et bien-être pour la marque MIHI (mihi.care). 
Une cliente vient de répondre à un diagnostic ${typeLabel}.

Prénom cliente: ${nomClient || "Cliente"}
Réponses au questionnaire:
${reponsesText}
${notesAdmin ? `\nInstructions spéciales de la distributrice:\n${notesAdmin}` : ""}

CATALOGUE RÉEL DES PRODUITS MIHI DISPONIBLES (les noms sont en anglais — utilise UNIQUEMENT ces produits et leurs prix EXACTS, n'invente JAMAIS de produit ou de prix qui n'est pas dans cette liste) :
${catalogueText}

Génère une ordonnance beauté complète avec 3 packs basés EXCLUSIVEMENT sur les produits ci-dessus :

1. 💚 PACK PETIT BUDGET — 1 à 2 produits maximum, les plus essentiels pour commencer
2. ⭐ PACK BEST SELLER — 3 à 4 produits, la routine complète recommandée
3. 🚀 PACK BOOST — 4 à 5 produits, la routine premium avec maximum de résultats

IMPORTANT — TRADUCTION DES NOMS :
Les noms de produits du catalogue sont en anglais. Dans ta réponse, traduis chaque nom de produit en français naturel et commercial (garde le nom de la série/gamme si c'est une marque, ex: "Face Architect" peut rester tel quel, mais traduis les mots descriptifs comme "cream"→"crème", "serum"→"sérum", "shampoo"→"shampoing", "eye cream"→"crème contour des yeux", etc.). Le prix doit rester EXACTEMENT celui du catalogue.

Pour chaque pack donne:
- Les produits du catalogue ci-dessus, avec leur nom TRADUIT EN FRANÇAIS et leur prix EXACT (inchangé)
- L'ordre d'utilisation (matin / soir)
- Le bénéfice principal de chaque produit
- Le total réel = somme exacte des prix des produits choisis (calcule-le toi-même, en te basant sur les prix originaux du catalogue)

Réponds UNIQUEMENT en JSON valide sans markdown, sans texte avant ou après, format exact:
{
  "introduction": "texte personnalisé de 2 phrases pour ${nomClient || 'la cliente'} basé sur son profil",
  "budget": {
    "total": "29.6€",
    "produits": [
      {"nom": "Nom du produit traduit en français", "prix": "29.6€", "usage": "Matin et soir", "benefice": "..."}
    ],
    "routine": "Description courte de la routine"
  },
  "bestseller": {
    "total": "65.4€", 
    "produits": [
      {"nom": "Nom du produit traduit en français", "prix": "21.5€", "usage": "Matin", "benefice": "..."}
    ],
    "routine": "Description courte de la routine"
  },
  "boost": {
    "total": "102.3€",
    "produits": [
      {"nom": "Nom du produit traduit en français", "prix": "32.3€", "usage": "Soir", "benefice": "..."}
    ],
    "routine": "Description courte de la routine"
  }
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "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",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();

    if(data.error){
      console.error("Erreur API Claude:", data.error);
      return null;
    }

    const text = data.content?.map(i => i.text || "").join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();

    try {
      return JSON.parse(clean);
    } catch(parseErr) {
      console.error("Erreur parsing JSON:", parseErr);
      console.error("Texte reçu de l'IA:", text);
      return null;
    }
  } catch (fetchErr) {
    console.error("Erreur réseau / fetch:", fetchErr);
    return null;
  }
}

function getRecommandations(type, reponses) { return null; }

// ── QUIZ DE PROFIL RECRUTEMENT (4 niveaux, ton "tu") ─────────────────────────
const QUIZ_RECRUTEMENT = [
  {id:"q1", question:"Quand tu penses à te lancer dans une nouvelle activité, qu'est-ce qui te motive le plus ?", options:[
    {value:"a",label:"Gagner un peu d'argent en plus sans trop me bouger",score:1},
    {value:"b",label:"Avoir plus de liberté dans mon quotidien et mes horaires",score:3},
    {value:"c",label:"Construire quelque chose à moi, sur le long terme",score:4},
    {value:"d",label:"Je ne sais pas trop, je suis curieuse",score:2},
  ]},
  {id:"q2", question:"Comment réagis-tu quand quelqu'un te dit non ou n'est pas intéressé par ce que tu proposes ?", options:[
    {value:"a",label:"Ça me touche beaucoup, j'ai du mal à insister ou recontacter",score:1},
    {value:"b",label:"Ça me déçoit un peu mais je passe à autre chose",score:2},
    {value:"c",label:"Je le prends avec du recul, ce n'est pas personnel",score:3},
    {value:"d",label:"Je vois ça comme normal, ça fait partie du jeu",score:4},
  ]},
  {id:"q3", question:"À quelle fréquence pourrais-tu consacrer du temps à une activité, même 20-30 minutes ?", options:[
    {value:"a",label:"Très irrégulièrement, ça dépend vraiment des semaines",score:1},
    {value:"b",label:"Quelques fois par semaine quand j'y pense",score:2},
    {value:"c",label:"Presque tous les jours, je peux m'organiser un petit créneau",score:3},
    {value:"d",label:"Tous les jours, j'aime avoir une routine",score:4},
  ]},
  {id:"q4", question:"Comment te sens-tu à l'idée de parler de toi, de ton quotidien, sur les réseaux sociaux ?", options:[
    {value:"a",label:"Ça me met très mal à l'aise, je préfère rester discrète",score:1},
    {value:"b",label:"Je peux le faire un peu mais ça me demande un effort",score:2},
    {value:"c",label:"Ça ne me dérange pas, je le fais déjà parfois",score:3},
    {value:"d",label:"J'aime bien partager, je le fais naturellement",score:4},
  ]},
  {id:"q5", question:"Si les réseaux sociaux n'étaient pas une option, penses-tu pouvoir développer une activité uniquement via ton entourage et le bouche-à-oreille ?", options:[
    {value:"a",label:"Non, je ne vois pas comment faire sans réseaux",score:1},
    {value:"b",label:"Peut-être, mais ça me semble compliqué et lent",score:2},
    {value:"c",label:"Oui, j'ai un bon réseau de connaissances autour de moi",score:3},
    {value:"d",label:"Oui clairement, je suis quelqu'un de très sociable et connectée localement",score:4},
  ]},
  {id:"q6", question:"Quand tu apprends quelque chose de nouveau (une méthode, un outil), comment réagis-tu ?", options:[
    {value:"a",label:"J'ai tendance à procrastiner, j'ai peur de mal faire",score:1},
    {value:"b",label:"Je mets du temps à m'y mettre mais j'y arrive",score:2},
    {value:"c",label:"Je me lance assez vite, en apprenant petit à petit",score:3},
    {value:"d",label:"J'adore apprendre et tester de nouvelles choses",score:4},
  ]},
  {id:"q7", question:"Comment décrirais-tu ta situation financière actuelle / ton besoin ?", options:[
    {value:"a",label:"J'ai vraiment besoin d'un revenu rapide et conséquent",score:1},
    {value:"b",label:"Je teste surtout par curiosité, sans vraie attente financière",score:2},
    {value:"c",label:"J'aimerais un revenu complémentaire mais sans urgence",score:3},
    {value:"d",label:"Je veux construire un projet sur le moyen/long terme",score:4},
  ]},
  {id:"q8", question:"Comment réagis-tu face aux résultats qui prennent du temps à arriver ?", options:[
    {value:"a",label:"Je me décourage vite si je ne vois rien après quelques semaines",score:1},
    {value:"b",label:"Ça m'use un peu mais je tiens si je vois des petits progrès",score:2},
    {value:"c",label:"Je sais que ça prend du temps, je reste patiente",score:3},
    {value:"d",label:"Je vois ça comme un investissement, je suis sur la durée",score:4},
  ]},
  {id:"q9", question:"As-tu déjà accompagné, conseillé ou aidé des gens autour de toi (même sans contexte professionnel) ?", options:[
    {value:"a",label:"Pas vraiment, je suis plutôt discrète sur ces sujets",score:1},
    {value:"b",label:"De temps en temps, avec des proches",score:2},
    {value:"c",label:"Oui assez souvent, on me demande facilement conseil",score:3},
    {value:"d",label:"Oui, c'est même quelque chose qui me définit bien",score:4},
  ]},
  {id:"q10", question:"Sur une échelle de motivation, où te situes-tu aujourd'hui pour te lancer dans un vrai projet ?", options:[
    {value:"a",label:"Je suis curieuse mais pas vraiment prête à m'investir",score:1},
    {value:"b",label:"Motivée, mais j'ai besoin d'être accompagnée pas à pas",score:2},
    {value:"c",label:"Motivée et prête à apprendre et essayer",score:3},
    {value:"d",label:"Très motivée, je veux me lancer sérieusement",score:4},
  ]},
];

function getRecrutementLevel(score, max){
  const pct = score/max;
  if(pct < 0.4) return {
    level:1, label:"Pas le bon moment",
    desc:"À ce stade, le marketing relationnel risque de te demander beaucoup d'efforts pour des résultats qui mettront du temps à arriver, ce qui peut être décourageant. Ce n'est pas une question de valeur personnelle — simplement, certains piliers (régularité, gestion du non, visibilité) ne sont pas encore en place pour toi.",
    advice:[
      {h:"Pas de pression",t:"Inutile de te précipiter vers une inscription rapide : le risque d'abandon précoce est élevé."},
      {h:"Garde le lien",t:"Reste connectée de manière légère (contenu inspirant) sans te forcer. Le bon moment peut arriver plus tard, dans un autre contexte de vie."},
      {h:"Si tu veux essayer",t:"Commence plutôt par une expérience client (produits) avant de te lancer dans l'activité — ça te permet de tester sans pression."},
    ]
  };
  if(pct < 0.65) return {
    level:2, label:"Belle marge de progression",
    desc:"Tu as des qualités intéressantes mais tu auras besoin d'un accompagnement rapproché, surtout sur la régularité et la gestion du rejet. Le bouche-à-oreille sera probablement plus naturel pour toi que les réseaux sociaux dans un premier temps.",
    advice:[
      {h:"Démarrage en douceur",t:"Commence centrée sur ton entourage proche (bouche-à-oreille) plutôt que sur les réseaux, moins anxiogène pour démarrer."},
      {h:"Cadre et suivi",t:"Mets en place un point hebdomadaire les premières semaines pour t'aider à tenir la régularité — c'est ton principal point de vigilance."},
      {h:"Petites victoires",t:"Valorise chaque petite action (un message envoyé, une présentation faite) pour construire ta confiance progressivement."},
    ]
  };
  if(pct < 0.85) return {
    level:3, label:"Bon profil",
    desc:"Tu as les bases pour réussir : motivation correcte, ouverture à apprendre, capacité à gérer le rejet. Tu peux te lancer sereinement avec un accompagnement classique, en testant à la fois réseaux et bouche-à-oreille.",
    advice:[
      {h:"Lancement mixte",t:"Teste les deux leviers (réseaux + entourage) dès le départ pour trouver ce qui te correspond le mieux."},
      {h:"Formation structurée",t:"Le programme START & CASH est parfaitement adapté pour structurer ton démarrage sur les premières semaines."},
      {h:"Autonomie progressive",t:"Tu n'as pas besoin d'un cadre trop serré — avance à ton rythme tout en restant accompagnée."},
    ]
  };
  return {
    level:4, label:"Profil idéal",
    desc:"Profil très prometteur : motivation forte, aisance sociale, résilience face au rejet, et appétence pour les réseaux ET le bouche-à-oreille. Tu as un fort potentiel de leadership et tu pourrais toi-même devenir une recruteuse efficace rapidement.",
    advice:[
      {h:"Accélération",t:"Mets-toi rapidement sur le programme START & CASH ET sur MOCHA pour développer ta présence sur les réseaux dès le début."},
      {h:"Vision leadership",t:"Pense assez vite à la dimension équipe/leadership — ton profil suggère que tu peux viser le développement d'une équipe rapidement."},
      {h:"Mise en lumière",t:"N'hésite pas à partager ton expérience tôt — ton énergie sera un atout pour attirer d'autres profils similaires."},
    ]
  };
}

// Note interne pour la distributrice : pas de tags dans ce quiz, on dérive le levier
// conseillé à partir des questions q4 (réseaux) et q5 (bouche-à-oreille)
function getRecrutementInternalNote(reponses, level){
  const scoreVal = (qid, v) => {
    const q = QUIZ_RECRUTEMENT.find(x=>x.id===qid);
    const opt = q?.options.find(o=>o.value===v);
    return opt?.score || 0;
  };
  const scoreReseaux = scoreVal("q4", reponses.q4);
  const scoreBouche = scoreVal("q5", reponses.q5);

  let levier, action;
  if(scoreReseaux>=3 && scoreBouche>=3){
    levier = "Mix réseaux + bouche-à-oreille — cette personne est à l'aise sur les deux canaux.";
    action = "Propose un démarrage sur les deux fronts : entourage proche en premier (conversion plus rapide), réseaux sociaux en parallèle pour construire sa visibilité.";
  } else if(scoreReseaux>=3){
    levier = "Réseaux sociaux — c'est le canal le plus naturel pour cette personne.";
    action = "Oriente-la vers le programme MOCHA pour structurer sa présence sur les réseaux dès le départ.";
  } else if(scoreBouche>=3){
    levier = "Bouche-à-oreille / entourage — c'est le canal le plus naturel pour cette personne.";
    action = "Aide-la à construire sa liste de contacts proches et donne-lui des scripts de conversation simples pour parler naturellement de son activité.";
  } else {
    levier = "Aucun canal naturel identifié pour l'instant — accompagnement rapproché nécessaire.";
    action = "Avant de parler de canal, prends un temps pour explorer avec elle où elle se sent le plus à l'aise. Propose un test cadré sur 2 semaines (1 semaine réseaux, 1 semaine entourage).";
  }

  if(level<=1){
    action += " Vu son niveau de motivation actuel, ne mets aucune pression — reste disponible sans insister.";
  } else if(level>=4){
    action += " Et n'hésite pas à lui parler rapidement de la dimension équipe/leadership.";
  }

  return {levier, action};
}

// ── QUIZ "RECRUE BLOQUÉE" (orientation réseaux / bouche-à-oreille / mix) ─────
const QUIZ_BLOCAGE = [
  {id:"b1", question:"Depuis combien de temps as-tu démarré ton activité ?", options:[
    {value:"a",label:"Moins d'1 mois",score:1},
    {value:"b",label:"1 à 3 mois",score:2},
    {value:"c",label:"3 à 6 mois",score:3},
    {value:"d",label:"Plus de 6 mois",score:4},
  ]},
  {id:"b2", question:"Combien de personnes contactes-tu en moyenne par semaine (réseaux + entourage) ?", options:[
    {value:"a",label:"Aucune, je n'ose pas vraiment",score:1},
    {value:"b",label:"1 à 2 personnes",score:2},
    {value:"c",label:"3 à 5 personnes",score:3},
    {value:"d",label:"Plus de 5 personnes régulièrement",score:4},
  ]},
  {id:"b3", question:"Publies-tu du contenu sur les réseaux sociaux (posts, stories) ?", options:[
    {value:"a",label:"Jamais ou presque jamais",score:1},
    {value:"b",label:"De temps en temps, sans régularité",score:2},
    {value:"c",label:"Quelques fois par semaine",score:3},
    {value:"d",label:"Tous les jours ou presque",score:4},
  ]},
  {id:"b4", question:"À l'inverse, parles-tu de ton activité à ton entourage proche (famille, amis, voisins, collègues) ?", options:[
    {value:"a",label:"Jamais, j'ai peur de leur réaction",score:1},
    {value:"b",label:"Rarement, seulement si on me pose la question",score:2},
    {value:"c",label:"Régulièrement, j'en parle naturellement",score:3},
    {value:"d",label:"Très souvent, c'est ma principale source de contacts",score:4},
  ]},
  {id:"b5", question:"Quand tu envoies un message à un prospect, fais-tu un suivi (relance) si la personne ne répond pas ?", options:[
    {value:"a",label:"Non, je n'ose pas relancer",score:1},
    {value:"b",label:"Parfois, mais je culpabilise un peu",score:2},
    {value:"c",label:"Oui, je relance après quelques jours",score:3},
    {value:"d",label:"Oui systématiquement, avec un suivi organisé",score:4},
  ]},
  {id:"b6", question:"Comment te sens-tu face à la caméra (lives, vidéos, stories) ?", options:[
    {value:"a",label:"Très mal à l'aise, j'évite complètement",score:1},
    {value:"b",label:"Mal à l'aise mais je commence à essayer",score:2},
    {value:"c",label:"Plutôt à l'aise, je le fais de temps en temps",score:3},
    {value:"d",label:"Très à l'aise, j'aime ça",score:4},
  ]},
  {id:"b7", question:"As-tu une routine quotidienne ou hebdomadaire pour ton activité (actions planifiées) ?", options:[
    {value:"a",label:"Non, je fais au feeling selon le temps que j'ai",score:1},
    {value:"b",label:"J'ai quelques idées mais pas vraiment de planning",score:2},
    {value:"c",label:"Oui, j'ai une routine mais je ne la suis pas toujours",score:3},
    {value:"d",label:"Oui, j'ai une routine claire que je suis régulièrement",score:4},
  ]},
  {id:"b8", question:"Te sens-tu à l'aise pour expliquer simplement ce que tu fais et tes produits/opportunité ?", options:[
    {value:"a",label:"Pas vraiment, j'ai du mal à expliquer clairement",score:1},
    {value:"b",label:"Un peu, mais je tourne parfois autour du pot",score:2},
    {value:"c",label:"Oui, j'ai un discours assez clair",score:3},
    {value:"d",label:"Oui, je me sens à l'aise et naturelle",score:4},
  ]},
  {id:"b9", question:"Quel est, selon toi, ton plus grand frein actuel ?", options:[
    {value:"a",label:"La peur du jugement / du regard des autres",score:1},
    {value:"b",label:"Le manque de temps ou d'organisation",score:2},
    {value:"c",label:"Le manque de méthode / je ne sais pas par où commencer",score:2},
    {value:"d",label:"Le manque de régularité, je commence bien puis je lâche",score:3},
  ]},
  {id:"b10", question:"Si tu devais miser sur UN levier pour développer ton activité dans les 30 prochains jours, lequel choisirais-tu naturellement ?", options:[
    {value:"a",label:"Le bouche-à-oreille / mon entourage proche",score:3,tag:"bouche-a-oreille"},
    {value:"b",label:"Les réseaux sociaux (posts, stories, lives)",score:3,tag:"reseaux"},
    {value:"c",label:"Un mix des deux, mais je ne sais pas comment m'organiser",score:2,tag:"mix"},
    {value:"d",label:"Je ne sais pas, je n'ai pas de préférence",score:1,tag:"indecise"},
  ]},
];

function getBlocageOrientation(score, max, reponses){
  const pct = score/max;
  const lastQ = QUIZ_BLOCAGE[QUIZ_BLOCAGE.length-1];
  const lastVal = reponses[lastQ.id];
  const lastOpt = lastQ.options.find(o=>o.value===lastVal);
  const preferredLever = lastOpt?.tag || null;

  let orientation;
  if(preferredLever === "reseaux"){
    orientation = {
      title:"Orientation : Réseaux sociaux",
      desc:"Tu as une appétence naturelle pour les réseaux sociaux. C'est ce levier qu'il faut renforcer en priorité.",
      actions:[
        {h:"Programme MOCHA",t:"Inscris-toi (ou refais) le programme MOCHA pour structurer ta présence sur les réseaux : régularité de publication, formats qui convertissent, CTA par mots-clés."},
        {h:"Objectif simple",t:"Fixe-toi un objectif minimal mais tenable : 1 story par jour + 1 post fort par semaine, plutôt qu'une cadence intenable."},
        {h:"Visage et présence",t:"Si tu es mal à l'aise face caméra, commence par des formats sans visage (texte sur fond, voix off) avant d'introduire progressivement la vidéo."},
      ]
    };
  } else if(preferredLever === "bouche-a-oreille"){
    orientation = {
      title:"Orientation : Bouche-à-oreille / Entourage",
      desc:"Tu es plus à l'aise dans les interactions directes avec ton entourage. Misons sur ce canal naturel.",
      actions:[
        {h:"Liste chaude",t:"Construis (ou réactive) ta liste de contacts proches : famille, amis, anciens collègues, voisins — avec un angle naturel (partage d'expérience produit plutôt que pitch direct)."},
        {h:"Scripts de conversation",t:"Utilise des phrases d'accroche simples pour parler naturellement de ton activité dans une conversation normale, sans que ça paraisse être un argumentaire."},
        {h:"Suivi systématique",t:"Travaille la relance : beaucoup de blocages viennent de l'absence de suivi après un premier contact. Un rappel structuré (via cet outil) peut t'aider."},
      ]
    };
  } else if(preferredLever === "mix"){
    orientation = {
      title:"Orientation : Mix réseaux + entourage, avec un cadre",
      desc:"Tu vois l'intérêt des deux leviers mais tu manques d'organisation pour les mener de front. Il faut te donner un cadre simple.",
      actions:[
        {h:"Planning simplifié",t:"Propose-toi une répartition simple : par exemple lundi/mercredi/vendredi = contenu réseaux, mardi/jeudi = contacts entourage. Pas plus de 2-3 actions par jour."},
        {h:"Une priorité à la fois",t:"Même si tu veux tout faire, choisis UN levier prioritaire pour les 2 prochaines semaines, l'autre restant en complément léger."},
        {h:"START & CASH",t:"Le programme START & CASH peut t'aider à retrouver une structure claire semaine par semaine."},
      ]
    };
  } else {
    orientation = {
      title:"Orientation : Clarification du levier avant tout",
      desc:"Tu n'as pas encore identifié ce qui te correspond. Avant de parler d'action, il faut t'aider à te positionner.",
      actions:[
        {h:"Discussion exploratoire",t:"Prends un temps pour explorer où tu te sens le plus à l'aise naturellement : parler à des gens que tu connais, ou créer du contenu en ligne."},
        {h:"Test sur 2 semaines",t:"Propose-toi un test cadré : 1 semaine centrée réseaux, 1 semaine centrée entourage, puis compare ce qui t'a semblé le plus naturel."},
        {h:"Réassurance",t:"L'indécision cache souvent une peur de mal faire. Rassure-toi : il n'y a pas de mauvais choix, seulement des essais à ajuster."},
      ]
    };
  }

  let levelInfo;
  if(pct < 0.4) levelInfo = {level:1, label:"Blocage profond — réassurance prioritaire",
    extra:"Au-delà de l'orientation réseaux/entourage, le frein principal semble être la confiance et la régularité. Avant tout plan d'action, un accompagnement rapproché (appels courts, encouragements) est nécessaire pour éviter le découragement complet."};
  else if(pct < 0.65) levelInfo = {level:2, label:"Blocage modéré — besoin de cadre",
    extra:"Tu as des bases mais tu manques de structure. Un planning simple et des objectifs atteignables sur 2-3 semaines devraient permettre de relancer la dynamique."};
  else if(pct < 0.85) levelInfo = {level:3, label:"Blocage léger — ajustement ciblé",
    extra:"Tu es globalement sur la bonne voie ; il s'agit surtout d'ajuster un levier précis ou de renforcer la régularité sur un point spécifique plutôt que de tout reprendre."};
  else levelInfo = {level:4, label:"Pas vraiment bloquée — affiner la stratégie",
    extra:"Ton score est élevé : il ne s'agit probablement pas d'un blocage profond mais d'un ajustement de stratégie ou d'un passage à un niveau supérieur (par exemple : viser le leadership d'équipe)."};

  return {orientation, levelInfo};
}

// ── QUESTIONS DIAGNOSTICS ────────────────────────────────────────────────────
const QUESTIONS = {
  skincare: [
    {id:"typePeau", question:"Quel est ton type de peau ?", options:[
      {value:"seche",label:"🌵 Sèche — tiraillements, inconfort"},
      {value:"grasse",label:"✨ Grasse — brillances, pores visibles"},
      {value:"mixte",label:"☯️ Mixte — zone T grasse, joues sèches"},
      {value:"sensible",label:"🌸 Sensible — rougeurs, réactions"},
    ]},
    {id:"concern", question:"Ta préoccupation principale ?", options:[
      {value:"rides",label:"⏳ Rides & Fermeté"},
      {value:"eclat",label:"✨ Éclat & Teint terne"},
      {value:"hydratation",label:"💧 Hydratation"},
      {value:"imperfections",label:"🔍 Imperfections & Pores"},
    ]},
    {id:"age", question:"Ton âge ?", options:[
      {value:"moins25",label:"🌱 Moins de 25 ans"},
      {value:"25_35",label:"🌿 25-35 ans"},
      {value:"35_50",label:"🌺 35-50 ans"},
      {value:"plus50",label:"🌸 Plus de 50 ans"},
    ]},
    {id:"routine", question:"Ta routine actuelle ?", options:[
      {value:"aucune",label:"❌ Aucune routine"},
      {value:"basique",label:"🧼 Basique — nettoyage uniquement"},
      {value:"intermediaire",label:"💆 Intermédiaire — crème quotidienne"},
      {value:"complete",label:"🌟 Complète — plusieurs étapes"},
    ]},
    {id:"allergie", question:"As-tu des allergies ou sensibilités ?", options:[
      {value:"non",label:"✅ Non, aucune"},
      {value:"parfums",label:"🌸 Parfums & huiles essentielles"},
      {value:"alcool",label:"🍷 Alcool"},
      {value:"oui_autres",label:"⚠️ Oui, autres"},
    ]},
  ],
  cheveux: [
    {id:"typeCheveux", question:"Ton type de cheveux ?", options:[
      {value:"fins",label:"🍃 Fins & plats"},
      {value:"epais",label:"🦁 Épais & volumineux"},
      {value:"boucles",label:"🌀 Bouclés & frisés"},
      {value:"lisses",label:"✨ Lisses & droits"},
    ]},
    {id:"probleme", question:"Ton problème principal ?", options:[
      {value:"chute",label:"🍂 Chute & manque de densité"},
      {value:"sec",label:"🌵 Sécheresse & manque de brillance"},
      {value:"abime",label:"✂️ Cheveux abîmés & cassants"},
      {value:"colores",label:"🎨 Couleur à protéger"},
    ]},
    {id:"cuirChevelu", question:"Ton cuir chevelu ?", options:[
      {value:"normal",label:"✅ Normal"},
      {value:"gras",label:"💧 Gras — racines rapides"},
      {value:"sec",label:"🌵 Sec — démangeaisons"},
      {value:"pellicules",label:"❄️ Pellicules"},
    ]},
    {id:"traitements", question:"Traitements chimiques ?", options:[
      {value:"aucun",label:"🌿 Aucun"},
      {value:"coloration",label:"🎨 Coloration / Mèches"},
      {value:"lissage",label:"💆 Lissage / Défrisage"},
      {value:"permanente",label:"🌀 Permanente"},
    ]},
    {id:"objectifCheveux", question:"Ton objectif principal ?", options:[
      {value:"pousse",label:"📈 Faire pousser mes cheveux"},
      {value:"volume",label:"💨 Ajouter du volume"},
      {value:"brillance",label:"✨ Retrouver la brillance"},
      {value:"reparation",label:"🔧 Réparer & fortifier"},
    ]},
  ],
  sante: [
    {id:"objectif", question:"Ton objectif santé principal ?", options:[
      {value:"poids",label:"⚖️ Contrôle du poids & Minceur"},
      {value:"energie",label:"⚡ Énergie & Vitalité"},
      {value:"stress",label:"🧘 Stress & Sommeil"},
      {value:"immunite",label:"🛡️ Immunité & Défenses"},
    ]},
    {id:"mode", question:"Ton mode de vie ?", options:[
      {value:"actif",label:"🏃 Actif — sport régulier"},
      {value:"modere",label:"🚶 Modéré — marche, léger"},
      {value:"sedentaire",label:"🪑 Sédentaire — travail de bureau"},
    ]},
    {id:"alimentation", question:"Ton alimentation ?", options:[
      {value:"equilibree",label:"🥗 Équilibrée"},
      {value:"grignotage",label:"🍫 Grignotage fréquent"},
      {value:"restrictive",label:"🥦 Restrictive / Régime"},
      {value:"variable",label:"🎲 Variable selon les jours"},
    ]},
    {id:"probleme_sante", question:"Un problème spécifique ?", options:[
      {value:"digestion",label:"🫃 Digestion difficile"},
      {value:"fatigue",label:"😴 Fatigue chronique"},
      {value:"articulations",label:"🦴 Articulations & Mobilité"},
      {value:"aucun",label:"✅ Aucun problème particulier"},
    ]},
    {id:"budget", question:"Budget mensuel compléments ?", options:[
      {value:"petit",label:"💚 Moins de 30€"},
      {value:"moyen",label:"⭐ 30-70€"},
      {value:"confort",label:"🚀 70€ et plus"},
    ]},
  ],
  recrutement: QUIZ_RECRUTEMENT,
  blocage: QUIZ_BLOCAGE,
};

// Onglet "Formation App" — vidéos de prise en main de l'application, par catégorie
const FORMATION_APP_DASHBOARD_SUBS=[
  {id:"objectifs", num:"1", icon:"🎯", title:"Mes Objectifs", desc:"CA, recrues, paliers de qualification, primes — comment suivre et faire évoluer tes objectifs personnels.", url:""},
  {id:"clients", num:"2", icon:"🛍️", title:"Clients", desc:"Fiches clientes, commandes multi-produits, alertes fin de flacon, scripts de relance et objections.", url:""},
  {id:"distributeurs", num:"3", icon:"👑", title:"Distributeurs", desc:"Annuaire automatique, suivi des nouveaux distributeurs, plan de rémunération et onboarding.", url:""},
  {id:"prospects", num:"4", icon:"👥", title:"Prospects", desc:"Organiser tes prospects par catégorie (clients/distributeurs potentiels), statuts et relances.", url:""},
  {id:"equipe", num:"5", icon:"🏆", title:"Équipe", desc:"Wall of Fame, Défi Flash, Power Hour et navigation dans Mon Équipe (pour les chefs).", url:""},
];

const FORMATION_APP_CATEGORIES=[
  {id:"formationchef", num:"1", icon:"👑", title:"Formation Chef d'équipe", desc:"Espace Chef, Accès équipe, Assiduité, Mon équipe — pour les cheffes d'équipe.", url:""},
  {id:"dashboard", num:"2", icon:"⚡", title:"Tableau de bord & Aujourd'hui", desc:"Mood-check, actions du jour, citation du jour, annonces — et tous les sous-dossiers (objectifs, clients, distributeurs, prospects, équipe).", url:"", folder:FORMATION_APP_DASHBOARD_SUBS},
  {id:"outils", num:"3", icon:"🛠️", title:"Outils généraux", desc:"Les bases de l'application : navigation, recherche produits, diagnostics, idées de posts.", url:""},
];

function FormationAppTab({adminItems=[]}){
  const[openFolder,setOpenFolder]=useState(null);

  if(openFolder){
    const cat=FORMATION_APP_CATEGORIES.find(c=>c.id===openFolder);
    return(
      <div>
        <button onClick={()=>setOpenFolder(null)}
          style={{background:"none",border:"none",color:C.rose,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0,marginBottom:".75rem"}}>
          ← Retour
        </button>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",fontWeight:600,color:C.brun,marginBottom:".2rem"}}>
          {cat.icon} {cat.title}
        </div>
        <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>{cat.desc}</p>
        <AdminContentBlock onglet="formationapp" items={adminItems}/>

        {cat.url
          ? <DriveBtn href={cat.url} label={`Vidéo — ${cat.title}`}/>
          : (
            <div style={{display:"flex",alignItems:"center",gap:".5rem",background:C.creme,borderRadius:9,padding:".6rem .9rem",fontSize:".74rem",color:C.gris,fontStyle:"italic",marginBottom:cat.folder?"1rem":0}}>
              🎬 Vidéo à venir — disponible prochainement
            </div>
          )}

        {cat.folder&&cat.folder.map(sub=>(
          <Card key={sub.id} title={`${sub.num}. ${sub.title}`} sub={sub.desc} icon={sub.icon} color={C.rose} defaultOpen={false}>
            {sub.url
              ? <DriveBtn href={sub.url} label={`Vidéo — ${sub.title}`}/>
              : (
                <div style={{display:"flex",alignItems:"center",gap:".5rem",background:C.creme,borderRadius:9,padding:".6rem .9rem",fontSize:".74rem",color:C.gris,fontStyle:"italic"}}>
                  🎬 Vidéo à venir — disponible prochainement
                </div>
              )}
          </Card>
        ))}
      </div>
    );
  }

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Formation <em style={{fontStyle:"italic",color:C.rose}}>Application</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Une vidéo par grande catégorie pour découvrir toutes les fonctionnalités de l'application Blazing Dynasty. Clique sur une catégorie pour l'ouvrir 🎬
      </p>

      {FORMATION_APP_CATEGORIES.map(cat=>(
        <div key={cat.id} onClick={()=>setOpenFolder(cat.id)}
          style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".8rem 1rem",marginBottom:".5rem",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:".7rem"}}>
            <div style={{width:38,height:38,borderRadius:"50%",background:C.rose+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",flexShrink:0}}>{cat.icon}</div>
            <div>
              <div style={{fontFamily:"Georgia,serif",fontSize:".92rem",fontWeight:600,color:C.brun}}>{cat.num}. {cat.title}</div>
              <div style={{fontSize:".66rem",color:C.gris}}>{cat.desc}</div>
            </div>
          </div>
          <span style={{color:C.pale}}>›</span>
        </div>
      ))}
    </div>
  );
}



function DiagnosticsTab({ uid, userName }) {
  const [mode, setMode] = useState("choix");
  const [type, setType] = useState("");
  const [step, setStep] = useState(0);
  const [reponses, setReponses] = useState({});
  const [nomClient, setNomClient] = useState("");
  const [ordonnance, setOrdonnance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");

  const questions = type ? QUESTIONS[type] : [];
  const q = questions[step];

  const repondre = (val) => {
    const newRep = { ...reponses, [q.id]: val };
    setReponses(newRep);
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else if (TYPES_SCORING.includes(type)) {
      genererResultatScoring(newRep);
    } else {
      genererOrdonnance(newRep);
    }
  };

  // Calcule score/niveau pour les diagnostics de type scoring (recrutement, blocage)
  const genererResultatScoring = (rep) => {
    const quiz = QUESTIONS[type];
    const score = quiz.reduce((s,qq) => {
      const opt = qq.options.find(o=>o.value===rep[qq.id]);
      return s + (opt?.score || 0);
    }, 0);
    const max = quiz.length * 4;
    let result;
    if(type === "recrutement"){
      const niveau = getRecrutementLevel(score, max);
      const internalNote = getRecrutementInternalNote(rep, niveau.level);
      result = { kind:"recrutement", score, max, niveau, internalNote };
    } else {
      const { orientation, levelInfo } = getBlocageOrientation(score, max, rep);
      result = { kind:"blocage", score, max, orientation, levelInfo };
    }
    setOrdonnance(result);
    setMode("resultat");
    saveResult(result, rep);
  };

  const genererOrdonnance = async (rep) => {
    setMode("loading");
    setErreur("");
    const result = await genererOrdonnanceIA(type, rep, nomClient);
    if (result) {
      setOrdonnance(result);
      setMode("resultat");
      saveResult(result, rep);
    } else {
      setErreur("Erreur de génération. Réessaie.");
      setMode("questionnaire");
    }
  };

  const saveResult = async (reco, rep) => {
    try {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      const existing = snap.exists() && snap.data()["db-diagnostics"] ? JSON.parse(snap.data()["db-diagnostics"]) : [];
      const newDiag = { id: `diag${Date.now()}`, type, nomClient: nomClient||"Cliente", reponses: rep||reponses, ordonnance: reco, date: new Date().toISOString().slice(0,10), ts: Date.now() };
      await setDoc(ref, { "db-diagnostics": JSON.stringify([newDiag,...existing].slice(0,50)) }, { merge: true });
    } catch {}
  };

  const copierLien = () => {
    const lien = `https://blazing-dinasty-1fad9.web.app?diag=${type}&uid=${uid}&client=${encodeURIComponent(nomClient||"")}`;
    navigator.clipboard.writeText(lien).catch(()=>{});
  };

  const reset = () => { setMode("choix"); setType(""); setStep(0); setReponses({}); setNomClient(""); setOrdonnance(null); setErreur(""); };

  const copierPack = (pack) => {
    const p = ordonnance[pack];
    const text = `✨ ${pack==="budget"?"💚 Pack Petit Budget":pack==="bestseller"?"⭐ Pack Best Seller":"🚀 Pack Boost"} — ${p.total}\n\n${p.produits.map(pr=>`• ${pr.nom} (${pr.prix})\n  → ${pr.usage} | ${pr.benefice}`).join("\n")}\n\nRoutine: ${p.routine}`;
    navigator.clipboard.writeText(text).catch(()=>{});
  };

  const copierTout = () => {
    if(!ordonnance) return;
    const packs = ["budget","bestseller","boost"];
    const labels = {budget:"💚 Pack Petit Budget",bestseller:"⭐ Pack Best Seller",boost:"🚀 Pack Boost"};
    const text = `✨ ORDONNANCE BEAUTÉ — ${nomClient||"Cliente"}\n${ordonnance.introduction}\n\n${packs.map(pk=>{
      const p=ordonnance[pk];
      return `${labels[pk]} — ${p.total}\n${p.produits.map(pr=>`• ${pr.nom} (${pr.prix}) — ${pr.usage}`).join("\n")}\nRoutine: ${p.routine}`;
    }).join("\n\n")}`;
    navigator.clipboard.writeText(text).catch(()=>{});
  };

  const TYPES_DIAG = [
    { id: "skincare", icon: "✨", label: "Diagnostic Skincare", desc: "Type de peau, préoccupations, routine" },
    { id: "cheveux", icon: "💇", label: "Diagnostic Cheveux", desc: "Type, problèmes, traitements" },
    { id: "sante", icon: "💊", label: "Diagnostic Santé", desc: "Objectifs, mode de vie, compléments" },
    { id: "recrutement", icon: "🤝", label: "Diagnostic Recrutement", desc: "Profil face au marketing relationnel — pour un prospect activité" },
    { id: "blocage", icon: "🔄", label: "Diagnostic Recrue bloquée", desc: "Identifie le levier (réseaux / bouche-à-oreille) et un plan d'action" },
  ];

  const TYPES_SCORING = ["recrutement","blocage"];

  if (mode === "choix") return (
    <div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: "1.35rem", fontWeight: 300, color: C.brun, marginBottom: ".2rem" }}>
        Diagnostics <em style={{ fontStyle: "italic", color: C.rose }}>Clients</em>
      </div>
      <p style={{ fontSize: ".74rem", color: C.gris, marginBottom: "1rem", lineHeight: 1.65 }}>
        Remplis un diagnostic avec ta cliente pour lui proposer les produits Mihi les plus adaptés. L'IA génère une ordonnance personnalisée avec les vrais produits et prix.
      </p>
      <div style={{ marginBottom: ".75rem" }}>
        <div style={{ fontSize: ".62rem", color: C.gris, marginBottom: ".4rem" }}>Prénom de la personne (optionnel)</div>
        <input placeholder="Ex: Sophie Martin" value={nomClient} onChange={e => setNomClient(e.target.value)}
          style={{ width: "100%", border: `1px solid ${C.pale}`, borderRadius: 9, padding: ".5rem .8rem", fontSize: ".85rem", fontFamily: "inherit", color: C.texte, background: C.creme, outline: "none" }} />
      </div>
      {TYPES_DIAG.map(t => (
        <div key={t.id} style={{ background: C.blanc, border: `1px solid ${C.pale}`, borderRadius: 14, padding: "1rem 1.1rem", marginBottom: ".65rem" }}>
          <div style={{ display: "flex", gap: ".8rem", alignItems: "center", marginBottom: ".65rem" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.rose+"20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>{t.icon}</div>
            <div>
              <div style={{ fontFamily: "Georgia,serif", fontSize: ".95rem", fontWeight: 600, color: C.brun, marginBottom: ".2rem" }}>{t.label}</div>
              <div style={{ fontSize: ".72rem", color: C.gris }}>{t.desc}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: ".4rem" }}>
            <button onClick={() => { setType(t.id); setMode("questionnaire"); setStep(0); setReponses({}); }}
              style={{ flex: 1, background: C.brun, color: C.blanc, border: "none", borderRadius: 9, padding: ".5rem", fontSize: ".75rem", fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
              📋 Remplir maintenant
            </button>
            <button onClick={() => { setType(t.id); copierLienDirect(t.id); }}
              style={{ flex: 1, background: C.rose+"20", color: C.rose, border: `1px solid ${C.rose}`, borderRadius: 9, padding: ".5rem", fontSize: ".75rem", fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
              🔗 Envoyer le lien
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  function copierLienDirect(diagType) {
    const lien = `https://blazing-dinasty-1fad9.web.app?diag=${diagType}&uid=${uid}&distributrice=${encodeURIComponent(userName)}&client=${encodeURIComponent(nomClient||"")}`;
    navigator.clipboard.writeText(lien).then(()=>{
      alert(`✅ Lien copié !\n\nEnvoie ce lien à ${nomClient||"ta cliente"} par WhatsApp ou SMS.\nSes résultats arriveront dans ton tableau de bord.\n\n${lien}`);
    }).catch(()=>{
      prompt("Copie ce lien et envoie-le à ta cliente :", lien);
    });
  }

  if (mode === "loading") return (
    <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: "1rem", animation: "spin 1s linear infinite" }}>✨</div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: "1.1rem", color: C.brun, marginBottom: ".5rem" }}>Génération en cours...</div>
      <p style={{ fontSize: ".76rem", color: C.gris, lineHeight: 1.6 }}>
        L'IA analyse les réponses et sélectionne les meilleurs produits Mihi pour {nomClient||"ta cliente"} 🖤
      </p>
    </div>
  );

  if (mode === "questionnaire") return (
    <div>
      <button onClick={reset} style={{ background: "none", border: "none", color: C.gris, fontSize: ".75rem", cursor: "pointer", fontFamily: "inherit", marginBottom: "1rem", padding: 0 }}>← Retour</button>
      <div style={{ fontFamily: "Georgia,serif", fontSize: "1.1rem", color: C.brun, marginBottom: ".3rem" }}>
        {type === "skincare" ? "✨ Diagnostic Skincare" : type === "cheveux" ? "💇 Diagnostic Cheveux" : type === "sante" ? "💊 Diagnostic Santé" : type === "recrutement" ? "🤝 Diagnostic Recrutement" : "🔄 Diagnostic Recrue bloquée"}
        {nomClient && <span style={{ fontSize: ".8rem", color: C.rose, marginLeft: ".5rem" }}>— {nomClient}</span>}
      </div>
      <div style={{ height: 4, background: C.pale, borderRadius: 10, overflow: "hidden", marginBottom: "1.5rem" }}>
        <div style={{ height: "100%", background: C.rose, width: `${((step+1)/questions.length)*100}%`, borderRadius: 10, transition: "width .3s" }} />
      </div>
      <div style={{ fontSize: ".6rem", color: C.gris, marginBottom: ".75rem" }}>Question {step+1} / {questions.length}</div>
      {erreur && <div style={{ background: "#FFF0F0", border: "1px solid #F44", borderRadius: 8, padding: ".6rem .8rem", marginBottom: ".75rem", fontSize: ".75rem", color: "#B04040" }}>{erreur}</div>}
      <div style={{ fontFamily: "Georgia,serif", fontSize: "1.1rem", color: C.brun, fontWeight: 400, marginBottom: "1.25rem", lineHeight: 1.45 }}>{q.question}</div>
      {q.options.map(opt => (
        <div key={opt.value} onClick={() => repondre(opt.value)}
          style={{ background: C.blanc, border: `1px solid ${C.pale}`, borderRadius: 12, padding: ".85rem 1rem", marginBottom: ".5rem", cursor: "pointer", fontSize: ".82rem", color: C.texte, transition: "all .15s", display: "flex", alignItems: "center", gap: ".6rem" }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${C.pale}`, flexShrink: 0 }} />
          {opt.label}
        </div>
      ))}
    </div>
  );

  if (mode === "resultat" && ordonnance && ordonnance.kind === "recrutement") {
    const { niveau, internalNote, score, max } = ordonnance;
    const levelColors = { 1:"#A85C5C", 2:"#B8804A", 3:"#5C8A6A", 4:C.lilas };
    const col = levelColors[niveau.level] || C.rose;
    return (
      <div>
        <button onClick={reset} style={{ background: "none", border: "none", color: C.gris, fontSize: ".75rem", cursor: "pointer", fontFamily: "inherit", marginBottom: "1rem", padding: 0 }}>← Nouveau diagnostic</button>

        <div style={{ display:"inline-block", background: col+"20", color: col, fontSize:".6rem", fontWeight:700, textTransform:"uppercase", letterSpacing:".1em", borderRadius:20, padding:".25rem .75rem", marginBottom:".6rem" }}>
          Niveau {niveau.level}/4 — {niveau.label}
        </div>
        <div style={{ fontFamily:"Georgia,serif", fontSize:"1.2rem", color:C.brun, marginBottom:".3rem" }}>
          {nomClient ? `Ton résultat, ${nomClient}` : "Ton résultat"}
        </div>
        <div style={{ fontFamily:"Georgia,serif", fontStyle:"italic", fontSize:"2.2rem", color:C.lilas, marginBottom:".6rem" }}>{score} / {max}</div>
        <p style={{ fontSize:".8rem", color:C.texte, lineHeight:1.7, marginBottom:"1rem" }}>{niveau.desc}</p>

        {niveau.advice.map((a,i)=>(
          <div key={i} style={{ background:C.creme, borderLeft:`4px solid ${C.lilas}`, borderRadius:"0 10px 10px 0", padding:".7rem .9rem", marginBottom:".6rem" }}>
            <div style={{ fontSize:".8rem", fontWeight:700, color:C.brun, marginBottom:".2rem" }}>{a.h}</div>
            <div style={{ fontSize:".76rem", color:C.texte, lineHeight:1.6 }}>{a.t}</div>
          </div>
        ))}

        <div style={{ background:C.lilas+"15", border:`1px solid ${C.lilas}40`, borderRadius:10, padding:".8rem .9rem", marginTop:"1rem" }}>
          <div style={{ fontSize:".76rem", fontWeight:700, color:C.brun, marginBottom:".4rem" }}>👀 Pour toi (note interne)</div>
          <div style={{ fontSize:".75rem", color:C.texte, lineHeight:1.6, marginBottom:".3rem" }}><strong>Levier conseillé :</strong> {internalNote.levier}</div>
          <div style={{ fontSize:".75rem", color:C.texte, lineHeight:1.6 }}><strong>Action recommandée :</strong> {internalNote.action}</div>
          <div style={{ fontSize:".65rem", color:C.gris, marginTop:".4rem" }}>Cette note est privée et reste visible uniquement dans "Mes diagnostics".</div>
        </div>

        <p style={{ fontSize:".65rem", color:C.gris, textAlign:"center", marginTop:"1rem" }}>Résultat sauvegardé dans ton tableau de bord 🖤</p>
      </div>
    );
  }

  if (mode === "resultat" && ordonnance && ordonnance.kind === "blocage") {
    const { orientation, levelInfo, score, max } = ordonnance;
    const levelColors = { 1:"#A85C5C", 2:"#B8804A", 3:"#5C8A6A", 4:C.lilas };
    const col = levelColors[levelInfo.level] || C.rose;
    return (
      <div>
        <button onClick={reset} style={{ background: "none", border: "none", color: C.gris, fontSize: ".75rem", cursor: "pointer", fontFamily: "inherit", marginBottom: "1rem", padding: 0 }}>← Nouveau diagnostic</button>

        <div style={{ display:"inline-block", background: col+"20", color: col, fontSize:".6rem", fontWeight:700, textTransform:"uppercase", letterSpacing:".1em", borderRadius:20, padding:".25rem .75rem", marginBottom:".6rem" }}>
          Niveau {levelInfo.level}/4 — {levelInfo.label}
        </div>
        <div style={{ fontFamily:"Georgia,serif", fontSize:"1.2rem", color:C.brun, marginBottom:".3rem" }}>
          {nomClient ? `Ton résultat, ${nomClient}` : "Ton résultat"}
        </div>
        <div style={{ fontFamily:"Georgia,serif", fontStyle:"italic", fontSize:"2.2rem", color:C.lilas, marginBottom:".6rem" }}>{score} / {max}</div>
        <p style={{ fontSize:".8rem", color:C.texte, lineHeight:1.7, marginBottom:"1rem" }}>{levelInfo.extra}</p>

        <div style={{ background:C.rose+"15", borderLeft:`4px solid ${C.rose}`, borderRadius:"0 10px 10px 0", padding:".7rem .9rem", marginBottom:".6rem" }}>
          <div style={{ fontSize:".8rem", fontWeight:700, color:C.brun, marginBottom:".2rem" }}>{orientation.title}</div>
          <div style={{ fontSize:".76rem", color:C.texte, lineHeight:1.6 }}>{orientation.desc}</div>
        </div>

        {orientation.actions.map((a,i)=>(
          <div key={i} style={{ background:C.creme, borderLeft:`4px solid ${C.lilas}`, borderRadius:"0 10px 10px 0", padding:".7rem .9rem", marginBottom:".6rem" }}>
            <div style={{ fontSize:".8rem", fontWeight:700, color:C.brun, marginBottom:".2rem" }}>{a.h}</div>
            <div style={{ fontSize:".76rem", color:C.texte, lineHeight:1.6 }}>{a.t}</div>
          </div>
        ))}

        <p style={{ fontSize:".65rem", color:C.gris, textAlign:"center", marginTop:"1rem" }}>Résultat sauvegardé dans ton tableau de bord 🖤</p>
      </div>
    );
  }

  if (mode === "resultat" && ordonnance) {
    const packs = [
      { key: "budget", label: "💚 Pack Petit Budget", color: "#5C8A60", bg: "#5C8A6015" },
      { key: "bestseller", label: "⭐ Pack Best Seller", color: C.or, bg: C.or+"15" },
      { key: "boost", label: "🚀 Pack Boost", color: C.rose, bg: C.rose+"15" },
    ];

    return (
      <div>
        <button onClick={reset} style={{ background: "none", border: "none", color: C.gris, fontSize: ".75rem", cursor: "pointer", fontFamily: "inherit", marginBottom: "1rem", padding: 0 }}>← Nouveau diagnostic</button>

        <div style={{ background: C.brun, borderRadius: 14, padding: "1rem 1.1rem", marginBottom: "1.25rem" }}>
          <div style={{ fontSize: ".55rem", fontWeight: 700, letterSpacing: ".15em", color: C.or, marginBottom: ".3rem" }}>✦ ORDONNANCE IA — PRODUITS MIHI</div>
          <div style={{ fontFamily: "Georgia,serif", fontSize: "1rem", color: C.blanc, fontWeight: 300, lineHeight: 1.5 }}>
            {ordonnance.introduction}
          </div>
        </div>

        {packs.map(pack => {
          const p = ordonnance[pack.key];
          if (!p) return null;
          return (
            <div key={pack.key} style={{ background: pack.bg, border: `2px solid ${pack.color}30`, borderRadius: 14, padding: "1rem 1.1rem", marginBottom: ".75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".65rem" }}>
                <div style={{ fontSize: ".82rem", fontWeight: 700, color: pack.color }}>{pack.label}</div>
                <div style={{ background: pack.color, color: "white", fontSize: ".7rem", fontWeight: 700, padding: ".2rem .6rem", borderRadius: 20 }}>{p.total}</div>
              </div>

              {p.produits && p.produits.map((prod, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,.7)", borderRadius: 9, padding: ".55rem .75rem", marginBottom: ".35rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: ".15rem" }}>
                    <div style={{ fontSize: ".78rem", fontWeight: 600, color: C.brun, flex: 1, paddingRight: ".5rem" }}>{prod.nom}</div>
                    <div style={{ fontSize: ".75rem", fontWeight: 700, color: pack.color, flexShrink: 0 }}>{prod.prix}</div>
                  </div>
                  <div style={{ fontSize: ".65rem", color: C.gris }}>
                    <span style={{ background: pack.color+"20", color: pack.color, padding: ".1rem .35rem", borderRadius: 20, marginRight: ".35rem", fontWeight: 600 }}>{prod.usage}</span>
                    {prod.benefice}
                  </div>
                </div>
              ))}

              <div style={{ background: "rgba(255,255,255,.5)", borderRadius: 8, padding: ".5rem .7rem", marginTop: ".5rem", fontSize: ".7rem", color: C.brun, fontStyle: "italic", marginBottom: ".5rem" }}>
                📋 {p.routine}
              </div>

              <button onClick={() => copierPack(pack.key)}
                style={{ width: "100%", background: pack.color, color: "white", border: "none", borderRadius: 8, padding: ".42rem", fontSize: ".72rem", fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                📋 Copier ce pack
              </button>
            </div>
          );
        })}

        <button onClick={copierTout}
          style={{ width: "100%", background: C.brun, color: C.blanc, border: "none", borderRadius: 10, padding: ".65rem", fontSize: ".82rem", fontWeight: 600, fontFamily: "inherit", cursor: "pointer", marginBottom: ".5rem" }}>
          📋 Copier l'ordonnance complète
        </button>
        <p style={{ fontSize: ".65rem", color: C.gris, textAlign: "center" }}>Résultat sauvegardé dans ton tableau de bord 🖤</p>
      </div>
    );
  }
  return null;
}

// ── RESULTATS DIAGNOSTICS (Dashboard) ────────────────────────────────────────
function DiagResultsTab({ uid }) {
  const [diags, setDiags] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [sel, setSel] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists() && snap.data()["db-diagnostics"])
          setDiags(JSON.parse(snap.data()["db-diagnostics"]));
      } catch {}
      setLoaded(true);
    })();
  }, [uid]);

  const del = async (id) => {
    const next = diags.filter(d => d.id !== id);
    setDiags(next);
    try { await setDoc(doc(db, "users", uid), { "db-diagnostics": JSON.stringify(next) }, { merge: true }); } catch {}
  };

  const TYPE_LABELS = { skincare: "✨ Skincare", cheveux: "💇 Cheveux", sante: "💊 Santé", recrutement: "🤝 Recrutement", blocage: "🔄 Recrue bloquée" };

  if (!loaded) return <div style={{ textAlign: "center", padding: "2rem", color: C.gris, fontSize: ".8rem" }}>Chargement...</div>;

  if (sel && (sel.type === "recrutement" || sel.type === "blocage")) {
    const ord = sel.ordonnance || {};
    const isRecrutement = sel.type === "recrutement";
    const lvl = isRecrutement ? ord.niveau : ord.levelInfo;
    const levelColors = { 1:"#A85C5C", 2:"#B8804A", 3:"#5C8A6A", 4:C.lilas };
    const col = levelColors[lvl?.level] || C.rose;
    return (
      <div>
        <button onClick={() => setSel(null)} style={{ background: "none", border: "none", color: C.gris, fontSize: ".75rem", cursor: "pointer", fontFamily: "inherit", marginBottom: "1rem", padding: 0 }}>← Retour</button>
        <div style={{ fontFamily: "Georgia,serif", fontSize: "1rem", color: C.brun, marginBottom: ".3rem" }}>{sel.nomClient} — {TYPE_LABELS[sel.type]}</div>
        <div style={{ fontSize: ".65rem", color: C.gris, marginBottom: "1rem" }}>{sel.date}</div>

        <div style={{ display:"inline-block", background: col+"20", color: col, fontSize:".6rem", fontWeight:700, textTransform:"uppercase", letterSpacing:".1em", borderRadius:20, padding:".25rem .75rem", marginBottom:".6rem" }}>
          Niveau {lvl?.level}/4 — {lvl?.label}
        </div>
        <div style={{ fontFamily:"Georgia,serif", fontStyle:"italic", fontSize:"1.8rem", color:C.lilas, marginBottom:".6rem" }}>{ord.score} / {ord.max}</div>

        {isRecrutement ? (
          <>
            <p style={{ fontSize:".78rem", color:C.texte, lineHeight:1.7, marginBottom:"1rem" }}>{ord.niveau?.desc}</p>
            {(ord.niveau?.advice||[]).map((a,i)=>(
              <div key={i} style={{ background:C.creme, borderLeft:`4px solid ${C.lilas}`, borderRadius:"0 10px 10px 0", padding:".7rem .9rem", marginBottom:".6rem" }}>
                <div style={{ fontSize:".78rem", fontWeight:700, color:C.brun, marginBottom:".2rem" }}>{a.h}</div>
                <div style={{ fontSize:".73rem", color:C.texte, lineHeight:1.6 }}>{a.t}</div>
              </div>
            ))}
            {ord.internalNote && (
              <div style={{ background:C.lilas+"15", border:`1px solid ${C.lilas}40`, borderRadius:10, padding:".8rem .9rem", marginTop:".6rem" }}>
                <div style={{ fontSize:".74rem", fontWeight:700, color:C.brun, marginBottom:".4rem" }}>👀 Pour toi (note interne)</div>
                <div style={{ fontSize:".73rem", color:C.texte, lineHeight:1.6, marginBottom:".3rem" }}><strong>Levier conseillé :</strong> {ord.internalNote.levier}</div>
                <div style={{ fontSize:".73rem", color:C.texte, lineHeight:1.6 }}><strong>Action recommandée :</strong> {ord.internalNote.action}</div>
              </div>
            )}
          </>
        ) : (
          <>
            <p style={{ fontSize:".78rem", color:C.texte, lineHeight:1.7, marginBottom:"1rem" }}>{ord.levelInfo?.extra}</p>
            <div style={{ background:C.rose+"15", borderLeft:`4px solid ${C.rose}`, borderRadius:"0 10px 10px 0", padding:".7rem .9rem", marginBottom:".6rem" }}>
              <div style={{ fontSize:".78rem", fontWeight:700, color:C.brun, marginBottom:".2rem" }}>{ord.orientation?.title}</div>
              <div style={{ fontSize:".73rem", color:C.texte, lineHeight:1.6 }}>{ord.orientation?.desc}</div>
            </div>
            {(ord.orientation?.actions||[]).map((a,i)=>(
              <div key={i} style={{ background:C.creme, borderLeft:`4px solid ${C.lilas}`, borderRadius:"0 10px 10px 0", padding:".7rem .9rem", marginBottom:".6rem" }}>
                <div style={{ fontSize:".78rem", fontWeight:700, color:C.brun, marginBottom:".2rem" }}>{a.h}</div>
                <div style={{ fontSize:".73rem", color:C.texte, lineHeight:1.6 }}>{a.t}</div>
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  if (sel) {
    const packs = [
      { key: "budget", label: "💚 Pack Petit Budget", color: "#5C8A60" },
      { key: "bestseller", label: "⭐ Pack Best Seller", color: C.or },
      { key: "boost", label: "🚀 Pack Boost", color: C.rose },
    ];
    const ord = sel.ordonnance;
    return (
      <div>
        <button onClick={() => setSel(null)} style={{ background: "none", border: "none", color: C.gris, fontSize: ".75rem", cursor: "pointer", fontFamily: "inherit", marginBottom: "1rem", padding: 0 }}>← Retour</button>
        <div style={{ fontFamily: "Georgia,serif", fontSize: "1rem", color: C.brun, marginBottom: ".3rem" }}>{sel.nomClient} — {TYPE_LABELS[sel.type]}</div>
        <div style={{ fontSize: ".65rem", color: C.gris, marginBottom: "1rem" }}>{sel.date}</div>
        {ord?.introduction && (
          <div style={{ background: C.brun, borderRadius: 12, padding: ".85rem 1rem", marginBottom: "1rem" }}>
            <p style={{ fontSize: ".76rem", color: C.pale, lineHeight: 1.6, margin: 0 }}>{ord.introduction}</p>
          </div>
        )}
        {packs.map(pack => {
          const p = ord?.[pack.key];
          if (!p) return null;
          return (
            <div key={pack.key} style={{ background: C.blanc, border: `1px solid ${pack.color}30`, borderRadius: 12, padding: ".85rem 1rem", marginBottom: ".6rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: ".5rem" }}>
                <div style={{ fontSize: ".76rem", fontWeight: 700, color: pack.color }}>{pack.label}</div>
                <div style={{ fontSize: ".72rem", fontWeight: 700, color: pack.color }}>{p.total}</div>
              </div>
              {(p.produits || []).map((pr, i) => (
                <div key={i} style={{ fontSize: ".74rem", color: C.texte, padding: ".25rem 0", borderBottom: i < (p.produits.length-1) ? `1px solid ${C.pale}` : "none" }}>
                  <strong>{pr.nom}</strong> — {pr.prix} | {pr.usage}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: "1.35rem", fontWeight: 300, color: C.brun, marginBottom: ".2rem" }}>
        Mes <em style={{ fontStyle: "italic", color: C.rose }}>Diagnostics</em>
      </div>
      <p style={{ fontSize: ".74rem", color: C.gris, marginBottom: "1rem", lineHeight: 1.65 }}>
        Historique de tes diagnostics clients.
      </p>
      {diags.length === 0 && (
        <div style={{ textAlign: "center", padding: "2rem", color: C.gris, fontSize: ".76rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: ".5rem" }}>🩺</div>
          Aucun diagnostic encore. Va dans l'onglet Diagnostics pour commencer.
        </div>
      )}
      {diags.map(d => (
        <div key={d.id} style={{ background: C.blanc, border: `1px solid ${C.pale}`, borderRadius: 12, padding: ".8rem 1rem", marginBottom: ".5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div onClick={() => setSel(d)} style={{ cursor: "pointer", flex: 1 }}>
            <div style={{ fontSize: ".82rem", fontWeight: 600, color: C.brun }}>{d.nomClient}</div>
            <div style={{ display: "flex", gap: ".4rem", marginTop: ".2rem" }}>
              <span style={{ background: C.rose + "20", color: C.rose, fontSize: ".6rem", fontWeight: 700, padding: ".1rem .4rem", borderRadius: 20 }}>{TYPE_LABELS[d.type]}</span>
              <span style={{ fontSize: ".62rem", color: C.gris }}>{d.date}</span>
            </div>
          </div>
          <button onClick={() => del(d.id)} style={{ background: "none", border: "none", color: C.pale, cursor: "pointer", fontSize: ".75rem", padding: ".2rem", fontFamily: "inherit" }}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ── DIAG ADMIN EDITOR ────────────────────────────────────────────────────────
function DiagAdminEditor(){
  const[notes,setNotes]=useState({skincare:"",cheveux:"",sante:""});
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);
  const[loaded,setLoaded]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","diag_notes"));
        if(snap.exists()) setNotes(snap.data());
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const save=async()=>{
    setSaving(true);
    try{
      await setDoc(doc(db,"admin","diag_notes"),notes);
      setSaved(true);
      setTimeout(()=>setSaved(false),2500);
    }catch{}
    setSaving(false);
  };

  const DIAGS=[
    {id:"skincare",icon:"✨",label:"Skincare"},
    {id:"cheveux",icon:"💇",label:"Cheveux"},
    {id:"sante",icon:"💊",label:"Santé"},
  ];

  if(!loaded) return <div style={{fontSize:".74rem",color:C.gris}}>Chargement...</div>;

  return(
    <div>
      {DIAGS.map(d=>(
        <div key={d.id} style={{marginBottom:".85rem"}}>
          <div style={{fontSize:".65rem",fontWeight:700,color:C.brun,marginBottom:".3rem"}}>{d.icon} {d.label} — Instructions pour l'IA</div>
          <textarea
            placeholder={`Ex: Pour le diagnostic ${d.label}, toujours inclure le produit X dans le pack boost. Éviter les produits contenant du parfum pour les peaux sensibles...`}
            value={notes[d.id]||""}
            onChange={e=>setNotes(p=>({...p,[d.id]:e.target.value}))}
            style={{width:"100%",minHeight:80,border:`1px solid ${C.pale}`,borderRadius:9,padding:".6rem .8rem",fontFamily:"inherit",fontSize:".76rem",color:C.texte,background:C.creme,resize:"vertical",outline:"none",lineHeight:1.6}}/>
        </div>
      ))}
      <button onClick={save} disabled={saving}
        style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:9,padding:".55rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
        {saving?"Sauvegarde...":saved?"✅ Sauvegardé !":"Sauvegarder les instructions"}
      </button>
      <p style={{fontSize:".65rem",color:C.gris,textAlign:"center",marginTop:".4rem"}}>
        Ces instructions seront intégrées dans chaque génération d'ordonnance IA.
      </p>
    </div>
  );
}