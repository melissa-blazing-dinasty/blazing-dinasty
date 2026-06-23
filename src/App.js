import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, query, where } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { DiagnosticsTab, DiagResultsTab, DiagnosticParfumTab, LinkBioPublicPage, TunnelHybridePage, RecommandationPubliquePage, FormationAppTab, EntonnoirTab, FORMATION_APP_CATEGORIES, FORMATION_APP_CATEGORIES_DEFAULT } from './DiagnosticsTab';
import { CopyBtn, SuiviRecruTab, DashboardTab, ConversionPopup, NoticePanel, HistoriquePeriodes, getCitationDuJour, getProgress, CHALLENGE_APP_JOURS, CITATIONS_DEFAULT, TYPE_TO_GAMME, SCRIPTS_RELANCE_GAMME } from './DashboardTab';
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
const storage = getStorage(fbApp);
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
      caPerso: objPerso?.caPerso||"",
      caObj: objPerso?.caObj||"",
      recruesReal: objPerso?.recruesReal||"0",
      recruesObj: objPerso?.recruesObj||"0",
      lastActive: Date.now(),
    };
    const snap = await getDoc(ref);
    const existing = snap.exists() && snap.data().membres ? snap.data().membres : {};
    entry.dateEnreg = existing[uid]?.dateEnreg || todayLocalStr();
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

// Remonte la chaîne de marraines pour trouver tous les "chefs" au-dessus d'un membre (jusqu'à la racine)
function getLigneeChefs(annuaire, uid, chefsUids){
  const lignee=[];
  let current=uid;
  const visited=new Set();
  while(current&&!visited.has(current)){
    visited.add(current);
    if(chefsUids.includes(current)) lignee.push(current);
    const m=annuaire[current];
    current=m?.marraine;
  }
  return lignee;
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
        dateEnreg: todayLocalStr(),
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
const APP_VERSION = "2.6.0";


// ── DATE LOCALE (évite le décalage UTC) ─────────────────────────────────────
function todayLocalStr(){
  const d = new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function todayLocalDate(){
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
}
const C={brun:"#3D1F0E",brun2:"#5C3020",rose:"#C49A8A",pale:"#E8D5CC",lilas:"#A89BB5",or:"#C4A882",creme:"#F7F2EE",blanc:"#FDFAF7",texte:"#2E1F17",gris:"#8A7A74",vert:"#7FAF8A"};

// Forcer la mise à jour de l'application
async function forcerMiseAJour(){
  try{
    // Vider tous les caches du service worker
    if("caches" in window){
      const keys=await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k)));
    }
    // Demander au service worker de se mettre à jour
    if("serviceWorker" in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.update()));
    }
  }catch{}
  // Recharger depuis le serveur (bypass cache)
  window.location.reload(true);
}

function BoutonMiseAJour({style={}}){
  const[loading,setLoading]=useState(false);
  const[version,setVersion]=useState(null);

  useEffect(()=>{
    try{
      const v=localStorage.getItem("bd-app-version");
      setVersion(v);
      localStorage.setItem("bd-app-version",APP_VERSION);
    }catch{}
  },[]);

  const handleUpdate=async()=>{
    setLoading(true);
    await forcerMiseAJour();
  };

  const nouvelleVersion=version&&version!==APP_VERSION;

  return(
    <button onClick={handleUpdate} disabled={loading}
      style={{display:"flex",alignItems:"center",gap:".4rem",background:nouvelleVersion?C.rose:C.creme,border:`1px solid ${nouvelleVersion?C.rose:C.pale}`,borderRadius:10,padding:".5rem .85rem",fontSize:".72rem",fontWeight:600,fontFamily:"inherit",cursor:loading?"default":"pointer",color:nouvelleVersion?C.blanc:C.gris,transition:"all .2s",...style}}>
      {loading?"⏳ Mise à jour...":nouvelleVersion?"🆕 Nouvelle version disponible !":"🔄 Mettre à jour l'app"}
    </button>
  );
}

// ── TRADUCTION À LA VOLÉE (FR ↔ PT) ──────────────────────────────────────────
const LangContext = createContext({ lang:"fr", translations:{}, t:(s)=>s });
function useLang(){ return useContext(LangContext); }

// Cache mémoire global
const transCache = {};

// Traduit un array de strings en portugais européen - chunks de 20
async function translateBatch(texts, targetLang){
  if(!texts||!texts.length||targetLang==="fr") return texts;
  const results=[...texts];
  const toTr=[];const idxs=[];
  texts.forEach((t,i)=>{
    if(!t||!t.trim()||t.length<2){return;}
    const k=`${targetLang}::${t}`;
    if(transCache[k])results[i]=transCache[k];
    else{toTr.push(t);idxs.push(i);}
  });
  if(!toTr.length) return results;
  const CHUNK=20;
  for(let c=0;c<toTr.length;c+=CHUNK){
    const chunk=toTr.slice(c,c+CHUNK);
    const cIdx=idxs.slice(c,c+CHUNK);
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:2000,messages:[{role:"user",content:`Traduz do francês para português europeu (Portugal). Responde APENAS com JSON array na mesma ordem:\n${JSON.stringify(chunk)}`}]})
      });
      const data=await res.json();
      const raw=data.content?.map(x=>x.text||"").join("").trim()||"[]";
      const m=raw.match(/\[[\s\S]*\]/);
      if(!m)continue;
      JSON.parse(m[0]).forEach((t,i)=>{
        if(i>=chunk.length)return;
        transCache[`${targetLang}::${chunk[i]}`]=t;
        results[cIdx[i]]=t;
      });
    }catch(e){console.error("translateBatch:",e);}
  }
  return results;
}

// ── TRADUCTION DOM COMPLÈTE ───────────────────────────────────────────────────
// Traduit tous les noeuds texte du DOM en une fois, comme Google Translate
let domOriginals=new Map(); // node → texte original FR

async function translateDOM(targetLang){
  try{
    const root=document.getElementById("root")||document.body;
    if(!root) return;

    const walker=document.createTreeWalker(
      root,
      4,
      {acceptNode:(node)=>{
        const p=node.parentElement;
        if(!p) return 2;
        const tag=p.tagName;
        if(["SCRIPT","STYLE","NOSCRIPT","META","TITLE"].includes(tag)) return 2;
        if(p.closest("[data-no-translate]")) return 2;
        const txt=node.textContent.trim();
        if(!txt||txt.length<2) return 2;
        if(/^[\d\s€%.,/:→←↑↓+\-×÷=🎯🛍️👥🩺🔍📱🏆⚡👑🚀]*$/.test(txt)) return 2;
        if(/^https?:\/\//.test(txt)) return 2;
        return 1;
      }}
    );

    const nodes=[];
    let node;
    while((node=walker.nextNode())) nodes.push(node);

    if(targetLang==="fr"){
      domOriginals.forEach((orig,n)=>{ if(n.parentElement) n.textContent=orig; });
      return;
    }

    // Sauvegarder les originaux
    nodes.forEach(n=>{ if(!domOriginals.has(n)) domOriginals.set(n,n.textContent); });

    const texts=nodes.map(n=>domOriginals.get(n)||n.textContent);
    const translated=await translateBatch(texts,targetLang);
    nodes.forEach((n,i)=>{ if(n.parentElement&&translated[i]) n.textContent=translated[i]; });
  }catch(e){ console.error("translateDOM error:",e); }
}

// Hook déclencheur de traduction DOM - sécurisé
function useTranslation(){
  const {lang}=useLang();
  useEffect(()=>{
    if(!lang||lang==="fr") return;
    const timer=setTimeout(()=>{
      try{ translateDOM(lang); }catch(e){ console.error("translateDOM:",e); }
    },500);
    return()=>clearTimeout(timer);
  },[lang]);
}


// Hook pour traduire dynamiquement du contenu chargé depuis Firebase
function useTranslatedContent(texts){
  const {lang} = useLang();
  const[translated,setTranslated]=useState(texts);

  useEffect(()=>{
    if(lang==="fr"||!texts||texts.length===0){setTranslated(texts);return;}
    let cancelled=false;
    translateBatch(texts,lang).then(res=>{
      if(!cancelled) setTranslated(res);
    });
    return()=>{cancelled=true;};
  },[lang, JSON.stringify(texts)]);

  return translated;
}

// Traduit un objet produit
function useTranslatedProduit(produit){
  const {lang} = useLang();
  const[tr,setTr]=useState(produit);

  useEffect(()=>{
    if(lang==="fr"||!produit){setTr(produit);return;}
    const toTranslate=[produit.titre||"",produit.description||"",produit.titreVideo||""];
    translateBatch(toTranslate,lang).then(res=>{
      setTr({...produit,titre:res[0],description:res[1],titreVideo:res[2]});
    });
  },[lang,produit?.id]);

  return tr;
}

// Composant T — traduit un texte string
function T({children, k}){
  const {lang,translations} = useContext(LangContext);
  if(lang==="fr") return children;
  const key = k||children;
  return translations?.[key]||children;
}

// Collecte tous les textes d'interface à traduire (clé → texte FR)
const UI_TEXTS_PT = {
  "nav.dashboard":"Painel","nav.formation":"Formação","nav.linkbio":"Link-in-Bio","nav.tunnel":"Meu Funil",
  "dtab.today":"⚡ Hoje","dtab.objperso":"🎯 Meus objetivos","dtab.faststart":"🚀 Fast Start",
  "dtab.clients":"🛍️ Clientes","dtab.distributeurs":"👑 Distribuidoras","dtab.prospects":"👥 Prospects",
  "dtab.diagnostics":"🩺 Meus diagnósticos","dtab.posts":"📱 Posts","dtab.equipe":"🏆 Equipa",
  "btn.sauvegarder":"Guardar","btn.annuler":"Cancelar","btn.ajouter":"Adicionar","btn.retour":"← Voltar","btn.copier":"Copiar",
  "diag.commencer":"Começar o diagnóstico","diag.suivant":"Próxima pergunta →","diag.voir_resultats":"Ver os meus resultados",
  "clients.ajouter":"Adicionar uma cliente","prospects.ajouter":"Adicionar uma prospect",
  "ph.lancer":"🚀 Lançar uma Power Hour","ph.en_cours":"⚡ POWER HOUR EM CURSO",
  "form.demarrage":"Início","form.vente":"Vendas","form.recrutement":"Recrutamento","form.contenu":"Conteúdo",
};

const UI_TEXTS = {
  // Navigation
  "nav.dashboard": "Tableau de bord",
  "nav.formation": "Formation",
  "nav.linkbio": "Link-in-Bio",
  "nav.tunnel": "Mon Tunnel",
  // Dashboard onglets
  "dtab.today": "⚡ Aujourd'hui",
  "dtab.objperso": "🎯 Mes objectifs",
  "dtab.faststart": "🚀 Fast Start",
  "dtab.clients": "🛍️ Clients",
  "dtab.distributeurs": "👑 Distributeurs",
  "dtab.prospects": "👥 Prospects",
  "dtab.diagnostics": "🩺 Mes diagnostics",
  "dtab.produits": "🔍 Produits",
  "dtab.posts": "📱 Posts",
  "dtab.equipe": "🏆 Équipe",
  // Objectifs
  "obj.ca_total": "CA total = ventes équipe (€)",
  "obj.objectif": "Objectif (€)",
  "obj.ventes_perso": "🛍️ Dont mes ventes perso",
  "obj.periode": "Période en cours",
  "obj.palier": "Palier à atteindre",
  "obj.reste": "📊 Calcul du Reste",
  "obj.directeurs": "Directeurs dans ma structure",
  // Fast Start
  "fs.module": "Module",
  "fs.valider": "Valider le module",
  "fs.verrouille": "Verrouillé — complète le module précédent",
  "fs.exercice": "📝 Exercice pratique",
  // Clients
  "clients.ajouter": "Ajouter une cliente",
  "clients.nom": "Nom",
  "clients.statut": "Statut",
  "clients.notes": "Notes",
  "clients.commande": "Commande",
  // Prospects
  "prospects.ajouter": "Ajouter un prospect",
  "prospects.statut": "Statut",
  "prospects.interet": "Intérêt",
  // Actions
  "btn.sauvegarder": "Sauvegarder",
  "btn.annuler": "Annuler",
  "btn.modifier": "Modifier",
  "btn.supprimer": "Supprimer",
  "btn.ajouter": "Ajouter",
  "btn.retour": "← Retour",
  "btn.copier": "Copier",
  // Classement
  "rank.ventes": "🛍️ Ventes perso",
  "rank.equipe": "👥 Équipe",
  "rank.recrues": "🤝 Recrues",
  "rank.progression": "📈 Progression",
  // Diagnostics
  "diag.commencer": "Commencer le diagnostic",
  "diag.suivant": "Question suivante →",
  "diag.voir_resultats": "Voir mes résultats",
  // Power Hour
  "ph.lancer": "🚀 Lancer une Power Hour",
  "ph.participe": "Je participe à cette Power Hour",
  "ph.en_cours": "⚡ POWER HOUR EN COURS",
  // Formation
  "form.demarrage": "Démarrage",
  "form.vente": "Vente",
  "form.recrutement": "Recrutement",
  "form.contenu": "Contenu",
  "form.devperso": "Développement Personnel",
  "form.outils": "Outils",
  "form.produits": "Formation Produits",
};



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

function genererScriptRelance(ligne, prenomClient){
  const gamme = TYPE_TO_GAMME[ligne.typeProduit]||"entretien";
  const template = SCRIPTS_RELANCE_GAMME[gamme]||SCRIPTS_RELANCE_GAMME.entretien;
  return template.replace(/{produit}/g, ligne.nom).replace(/{prenom}/g, prenomClient||"toi");
}


// Formulaire édition client avec state local pour éviter le re-render de la liste
// Fiche cliente complète — composant isolé pour éviter le re-render de la liste

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
export const SCRIPTS_DATA=[
  {cat:"🔬 Proposer un diagnostic",scripts:[
    {title:"Story / DM — Diagnostic Peau (général)",text:"🌸 Tu veux enfin comprendre ce dont ta peau a VRAIMENT besoin ?\n\nJe te propose un diagnostic beauté personnalisé — 100% gratuit, 2 minutes chrono ✨\n\nÀ la clé : une ordonnance sur mesure avec les produits faits pour toi 💊\n\n👇 Écris-moi DIAGNOSTIC en MP et je t'envoie le lien !"},
    {title:"DM — Diagnostic Skincare ciblé",text:"Coucou [Prénom] ! 👋\n\nJ'ai vu que tu posais des questions sur [problème peau/routine]... J'ai quelque chose qui pourrait vraiment t'aider !\n\nJe fais des diagnostics peau personnalisés — 5 questions et je te propose une routine adaptée à TON profil avec des produits que j'adore 🌿\n\nC'est gratuit et sans engagement. Tu veux essayer ? 😊"},
    {title:"DM — Diagnostic Cheveux",text:"Coucou [Prénom] ! Je pensais à toi en voyant [contexte]...\n\nEst-ce que tes cheveux te posent des problèmes en ce moment ? (sécheresse, chute, frisottis, etc.)\n\nJe propose des diagnostics capillaires gratuits — ça prend 2 minutes et tu repars avec des conseils 100% adaptés à tes cheveux 💇‍♀️\n\nTu veux que je t'envoie le lien ?"},
    {title:"DM — Diagnostic Makeup & couleurs",text:"Coucou [Prénom] ! 💄\n\nSi tu cherches le maquillage adapté à TON teint, TON style et TON budget... j'ai créé un diagnostic makeup personnalisé !\n\n→ Teinte de fond de teint\n→ Couleurs qui te valorisent\n→ Produits adaptés à ta morphologie\n\nC'est gratuit, ça prend 3 min. Tu veux l'essayer ? 🎨"},
    {title:"DM — Diagnostic Compléments / Minceur",text:"Coucou [Prénom] ! Je voulais te partager quelque chose...\n\nJ'ai un diagnostic bien-être qui aide à identifier exactement QUELS compléments alimentaires peuvent t'aider selon tes objectifs (énergie, minceur, immunité, sommeil...)\n\nBeaucoup de gens prennent des compléments qui ne sont pas adaptés à leurs besoins — ce diagnostic évite ça 💊\n\n2 minutes, gratuit, sans engagement. Ça t'intéresse ? ✨"},
    {title:"DM — Diagnostic Peau Corps",text:"Coucou [Prénom] ! 🌿\n\nEst-ce que tu as des problèmes de peau sur le corps ? (sécheresse, taches, capitons, sensibilité...)\n\nJe fais des diagnostics corps personnalisés pour proposer une routine adaptée. Pas juste \"hydrate-toi\" — une vraie sélection de produits pour TES problèmes spécifiques 💆‍♀️\n\nC'est gratuit, 2 min. Tu veux essayer ?"},
    {title:"DM — Diagnostic Entrepreneur (recrutement)",text:"Coucou [Prénom] ! 😊\n\nJe propose un mini-diagnostic pour savoir si le marketing de réseau pourrait être une option pour toi — sans pression, juste pour avoir une vision claire de ton profil et de tes possibilités.\n\n5 questions, pas de jugement, 100% honnête. Et si ce n'est pas fait pour toi, je te le dirai aussi 😄\n\nTu serais tentée d'essayer ?"},
    {title:"Story — Booster diagnostic (engagement)",text:"🔬 J'ai envoyé [X] diagnostics ce mois-ci...\n\nRésultat : des femmes qui comprennent ENFIN leur peau / leurs cheveux / leurs besoins 🌸\n\n→ Une routine sur mesure\n→ Des produits qu'elles adorent\n→ Des résultats concrets\n\nTu n'as pas encore fait le tien ?\n\n👉 Écris-moi DIAGO en commentaire ou en MP 💬"},
    {title:"Story — Résultat diagnostic (preuve sociale)",text:"Avant le diagnostic : \"Je ne sais pas quels produits prendre, j'ai tout essayé sans résultat\" 😔\n\nAprès le diagnostic : une routine de 3 produits adaptée à son profil exact ✨\n\n→ Résultat en 3 semaines 🌟\n\nC'est ce que j'offre gratuitement à chaque femme qui fait mon diagnostic.\n\nTu veux être la prochaine ? 👇 MP ou commentaire"},
    {title:"Story — Teasing diagnostic makeup",text:"POV : tu portes depuis 3 ans une teinte de fond de teint qui n'est pas vraiment la tienne 😅\n\nJe fais des diagnostics makeup — couleurs, teinte, style — pour trouver exactement ce qui te va.\n\nEt ça change TOUT.\n\n💄 Écris MAKEUP en commentaire pour essayer"},
    {title:"Reel — Accroche diagnostic peau",text:"❌ Tu achètes des produits au hasard sur TikTok\n❌ Tu ne comprends pas pourquoi ta peau ne s'améliore pas\n❌ Tu dépenses une fortune sans résultats\n\n✅ Ce qu'il te faut : un diagnostic peau\n✅ Gratuit\n✅ 2 minutes\n✅ Une ordonnance personnalisée\n\nÉcris PEAU en commentaire 👇"},
    {title:"Approche indirecte — via problème observé",text:"Hé [Prénom] ! J'ai vu ta story avec [problème de peau/cheveux/etc.] — tu galères avec ça depuis longtemps ?\n\nSans pression, mais j'ai un truc qui pourrait vraiment aider. Je fais des petits diagnostics beauté — tu réponds à quelques questions et je te fais une sélection de produits sur mesure.\n\nC'est gratuit. Tu veux qu'on essaie ? 🌸"},
    {title:"Approche via curiosité (mystère)",text:"[Prénom], je t'envoie quelque chose demain que j'envoie seulement à quelques personnes dans mon entourage...\n\n[lendemain]\n\nVoilà ! C'est un diagnostic beauté personnalisé. Ça prend 2 min et tu repars avec une sélection de produits faite pour toi. Gratuit bien sûr 😊\n\nTu veux essayer ?"},
    {title:"Approche via résultat d'une cliente",text:"Je viens de recevoir un message d'une cliente qui a fait mon diagnostic la semaine dernière... Elle me dit que la routine que je lui ai recommandée a changé l'état de sa peau en 10 jours 🤍\n\nSi tu veux, je peux faire le tien aussi ? C'est gratuit et ça prend 2 minutes 😊"},
  ]},
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
  {jour:1,titre:"Module 1 — Bienvenue & Prise en main 🎉",taches:[
    {t:"Regarde la vidéo du Module 1",link:{video:true,module:1}},
    {t:"Rejoins les groupes Telegram de l'équipe 🔵",link:{url:"https://t.me/+2wKWxIROE4c1M2Q0",label:"Banque d'images équipe"},link2:{url:"https://t.me/+pv0RY_JJy4wyYzE8",label:"Groupe témoignages"}},
  ]},
  {jour:2,titre:"Module 2 — Connaître Mihi 🌿",taches:[
    {t:"Regarde la vidéo du Module 2",link:{video:true,module:2}},
    "Commande ou teste au moins 1 produit Mihi si ce n'est pas fait",
    "Exo : Envoie ta liste des 3 produits préférés avec une phrase sur pourquoi à ta marraine",
  ]},
  {jour:3,titre:"Module 3 — Mon histoire & Ma Why 💫",taches:[
    {t:"Regarde la vidéo du Module 3",link:{video:true,module:3}},
    "Prends 15 minutes pour écrire ton 'pourquoi' en 3 phrases : avant / déclic / maintenant",
    "Exo : Envoie ton 'pourquoi' en quelques lignes à ta marraine",
  ]},
  {jour:4,titre:"Module 4 — Mes premiers contacts 📱",taches:[
    {t:"Regarde la vidéo du Module 4",link:{video:true,module:4}},
    "Fais ta liste de 10 contacts potentiels (famille, amies, collègues, voisines...)",
    "Exo : Envoie ta liste de 10 contacts à ta marraine",
  ]},
  {jour:5,titre:"Module 5 — Présenter Mihi 🎯",taches:[
    {t:"Regarde la vidéo du Module 5",link:{video:true,module:5}},
    "Entraîne-toi à ton pitch de 30 secondes à voix haute 3 fois",
    "Exo : Fais une story ou un post et envoie la capture à ta marraine",
  ]},
  {jour:6,titre:"Module 6 — Mes premières ventes 💰",taches:[
    {t:"Regarde la vidéo du Module 6",link:{video:true,module:6}},
    "Note 3 clientes potentielles à contacter cette semaine",
    "Exo : Envoie la confirmation de ta première commande client à ta marraine",
  ]},
  {jour:7,titre:"Module 7 — Je construis mon équipe 👑",taches:[
    {t:"Regarde la vidéo du Module 7",link:{video:true,module:7}},
    "Identifie 1 personne dans ton entourage qui pourrait être intéressée par l'opportunité",
    "Exo : Envoie le nom d'une personne contactée pour l'opportunité à ta marraine",
  ]},
];

// Quiz + exercice de validation pour chaque module
const FAST_START_QUIZ=[
  {
    jour:1,
    exercice:null, // pas d'exercice pour module 1
    quiz:[
      {q:"Où se passe la vie d'équipe au quotidien ?",options:["Sur Facebook","Sur Telegram","Par email","Sur WhatsApp"],rep:1},
      {q:"Que représente Blazing Dynasty ?",options:["Une marque de cosmétiques","L'équipe et la communauté","Le nom de l'appli","Le groupe Facebook"],rep:1},
      {q:"Quelle est ta première mission dans l'équipe ?",options:["Faire une vente","Rejoindre Telegram et explorer l'appli","Recruter une filleule","Poster sur Instagram"],rep:1},
    ],
  },
  {
    jour:2,
    exercice:"Envoie à ta marraine ta liste des 3 produits Mihi préférés avec une phrase sur pourquoi tu les as choisis 🌿",
    quiz:[
      {q:"Qu'est-ce qui différencie Mihi des autres marques ?",options:["Le prix le plus bas","Les ingrédients naturels et la qualité","Le nombre de produits","La livraison gratuite"],rep:1},
      {q:"Pour bien parler des produits, tu dois d'abord...",options:["Les avoir vendus au moins une fois","Les avoir testés toi-même","Lire tous les fiches techniques","Regarder des vidéos YouTube"],rep:1},
      {q:"Combien de gammes principales propose Mihi ?",options:["2","4","6","Plus de 6"],rep:3},
    ],
  },
  {
    jour:3,
    exercice:"Rédige ton 'pourquoi' en 3-5 phrases (avant / déclic / maintenant) et envoie-le à ta marraine 💫",
    quiz:[
      {q:"Pourquoi ton 'pourquoi' est-il important ?",options:["Pour remplir le formulaire","C'est la base de ton authenticité et de ta connexion aux autres","Pour impressionner les prospects","Ce n'est pas vraiment important"],rep:1},
      {q:"La structure d'une bonne histoire personnelle c'est :",options:["Chiffres / résultats / objectifs","Avant / déclic / maintenant","Produits / prix / livraison","Suivis / relances / clôture"],rep:1},
      {q:"Ton histoire doit être :",options:["Parfaite et sans défauts","Longue et détaillée","Authentique et personnelle","Centrée sur les produits"],rep:2},
    ],
  },
  {
    jour:4,
    exercice:"Envoie ta liste de 10 contacts potentiels à ta marraine (prénom + lien avec toi) 📱",
    quiz:[
      {q:"Quel est le meilleur point de départ pour ta liste de contacts ?",options:["Les inconnus sur Instagram","Ton entourage proche (famille, amies, collègues)","Les groupes Facebook","Les pages professionnelles"],rep:1},
      {q:"Comment approcher naturellement un contact ?",options:["En envoyant directement le lien boutique","En prenant des nouvelles d'abord, sans parler de Mihi","En faisant un pitch complet d'emblée","En publiant son contact sur les réseaux"],rep:1},
      {q:"Combien de contacts doit contenir ta liste de départ ?",options:["5 minimum","10 minimum","50 minimum","100 minimum"],rep:1},
    ],
  },
  {
    jour:5,
    exercice:"Publie une story ou un post Mihi et envoie la capture d'écran à ta marraine 🎯",
    quiz:[
      {q:"Un bon pitch de présentation dure :",options:["5 minutes minimum","30 secondes maximum","10 minutes","1 à 2 minutes"],rep:1},
      {q:"Que doit contenir une bonne story de présentation Mihi ?",options:["Tous les prix de la gamme","Ton résultat ou ressenti personnel + appel à l'action","Le lien de la boutique uniquement","Une liste de tous les produits"],rep:1},
      {q:"Quelle est la règle d'or du contenu sur les réseaux ?",options:["Publier le plus souvent possible","Copier-coller ce qui marche pour d'autres","Être authentique et régulière","Parler uniquement des produits"],rep:2},
    ],
  },
  {
    jour:6,
    exercice:"Envoie la confirmation de ta première commande client à ta marraine 💰",
    quiz:[
      {q:"Après une commande, quand recontacter la cliente ?",options:["Jamais, c'est elle qui revient","3 à 5 jours après réception pour prendre des nouvelles","Un mois après","Uniquement si elle a un problème"],rep:1},
      {q:"Le service après-vente c'est :",options:["Une obligation légale","Un outil puissant pour fidéliser et obtenir des recommandations","Une perte de temps","Uniquement pour les problèmes"],rep:1},
      {q:"Comment transformer une cliente en ambassadrice ?",options:["En lui donnant des remises","En la suivant régulièrement et en lui demandant son avis","En lui envoyant beaucoup de messages","En lui proposant de rejoindre l'équipe dès la 1ère commande"],rep:1},
    ],
  },
  {
    jour:7,
    exercice:"Envoie le prénom et le profil d'une personne que tu as contactée pour l'opportunité business à ta marraine 👑",
    quiz:[
      {q:"Comment parler de l'opportunité sans forcer ?",options:["Envoyer le lien d'inscription directement","Partager ton propre parcours et laisser la curiosité venir","Lister tous les avantages financiers","Faire un pitch complet non sollicité"],rep:1},
      {q:"Quel profil est idéal pour l'opportunité Mihi ?",options:["Uniquement les personnes sans emploi","Uniquement les experts en vente","Toute personne motivée, quelle que soit sa situation","Uniquement les femmes de moins de 30 ans"],rep:2},
      {q:"Après 7 modules, la suite c'est :",options:["Arrêter de se former","Tout faire seule","Continuer à te former et t'appuyer sur ta marraine","Attendre les résultats"],rep:2},
    ],
  },
];

function FastStartQuizPopup({jour, uid, userName, marraineUid, onClose, onValide}){
  const config = FAST_START_QUIZ.find(q=>q.jour===jour);
  const[step,setStep]=useState(config?.exercice?"exercice":"quiz");
  const[reponses,setReponses]=useState({});
  const[exoTexte,setExoTexte]=useState("");
  const[sending,setSending]=useState(false);
  const[sent,setSent]=useState(false);
  const[score,setScore]=useState(null);
  if(!config) return null;

  // config existe ici
  const titre=FAST_START_DAYS.find(d=>d.jour===jour)?.titre||`Module ${jour}`;
  const fmt=(id)=>id.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");

  const validerQuiz=()=>{
    let s=0;
    config.quiz.forEach((q,i)=>{ if(reponses[i]===q.rep) s++; });
    setScore(s);
    setStep("envoyer");
  };

  const envoyer=async()=>{
    setSending(true);
    try{
      // Message envoyé à la marraine
      if(marraineUid){
        const ref=doc(db,"messages",marraineUid);
        const snap=await getDoc(ref);
        const existing=snap.exists()?snap.data().msgs||[]:[];

        // Détail des réponses au quiz
        let quizDetail = "";
        if(config.quiz){
          config.quiz.forEach((q,i)=>{
            const repDonnee = reponses[i];
            const estJuste = repDonnee === q.rep;
            quizDetail += `\n${estJuste?"✅":"❌"} Q${i+1}: ${q.q}\n   → Réponse: "${q.options[repDonnee]||"?"}" ${estJuste?"(correct)":"(incorrect — bonne réponse: "+q.options[q.rep]+")"}\n`;
          });
        }

        const msg={
          id:`fs${Date.now()}`,
          de:uid,
          deNom:fmt(uid),
          texte:`✅ ${fmt(uid)} a validé le ${titre}\n\n${config.exercice&&exoTexte?`📝 Exercice :\n${exoTexte}\n`:""}\n📊 Quiz : ${score}/${config.quiz.length} bonnes réponses${quizDetail}`,
          ts:Date.now(),
          lu:false,
          type:"faststart",
          score,
          total:config.quiz.length,
        };
        await setDoc(ref,{msgs:[msg,...existing].slice(0,100)});
      }
      // Marquer le module comme validé
      onValide&&onValide(jour);
      setSent(true);
    }catch{}
    setSending(false);
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,31,14,.75)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:9999}}>
      <div style={{background:C.blanc,borderRadius:"18px 18px 0 0",width:"100%",maxWidth:480,maxHeight:"85vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(0,0,0,.3)"}}>

        {/* Header */}
        <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,padding:"1rem 1.2rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:C.blanc}}>
              {step==="exercice"?"📝 Exercice":step==="quiz"?"📊 Quiz de validation":step==="envoyer"?"📤 Envoyer à ta marraine":"✅ Validé !"}
            </div>
            <div style={{fontSize:".65rem",color:C.pale,marginTop:".15rem"}}>{titre}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.pale,fontSize:"1.2rem",cursor:"pointer"}}>✕</button>
        </div>

        <div style={{padding:"1.2rem"}}>

          {/* ÉTAPE EXERCICE */}
          {step==="exercice"&&config.exercice&&(
            <div>
              <div style={{background:C.creme,borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem",borderLeft:`3px solid ${C.rose}`}}>
                <div style={{fontSize:".7rem",fontWeight:700,color:C.rose,marginBottom:".3rem"}}>📝 Exercice de validation</div>
                <div style={{fontSize:".8rem",color:C.brun,lineHeight:1.65}}>{config.exercice}</div>
              </div>
              <textarea value={exoTexte} onChange={e=>setExoTexte(e.target.value)}
                placeholder="Écris ta réponse ici... ou décris ce que tu as fait"
                style={{width:"100%",minHeight:100,border:`1px solid ${C.pale}`,borderRadius:10,padding:".75rem",fontFamily:"inherit",fontSize:".8rem",color:C.texte,background:C.blanc,resize:"vertical",outline:"none",lineHeight:1.6,marginBottom:"1rem"}}/>
              <button onClick={()=>setStep("quiz")}
                style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".7rem",fontSize:".82rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                Continuer → Quiz de validation
              </button>
            </div>
          )}

          {/* ÉTAPE QUIZ */}
          {step==="quiz"&&(
            <div>
              <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.6}}>
                Réponds aux questions pour valider ce module et débloquer le suivant 🎯
              </p>
              {config.quiz.map((q,i)=>(
                <div key={i} style={{marginBottom:"1rem"}}>
                  <div style={{fontSize:".8rem",fontWeight:600,color:C.brun,marginBottom:".5rem",lineHeight:1.5}}>{i+1}. {q.q}</div>
                  {q.options.map((opt,j)=>(
                    <div key={j} onClick={()=>setReponses(r=>({...r,[i]:j}))}
                      style={{display:"flex",alignItems:"center",gap:".6rem",padding:".5rem .75rem",borderRadius:9,border:`1.5px solid ${reponses[i]===j?C.rose:C.pale}`,background:reponses[i]===j?C.rose+"10":"transparent",marginBottom:".3rem",cursor:"pointer",transition:"all .15s"}}>
                      <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${reponses[i]===j?C.rose:C.pale}`,background:reponses[i]===j?C.rose:"transparent",flexShrink:0}}/>
                      <div style={{fontSize:".76rem",color:C.texte}}>{opt}</div>
                    </div>
                  ))}
                </div>
              ))}
              <button onClick={validerQuiz}
                disabled={Object.keys(reponses).length<config.quiz.length}
                style={{width:"100%",background:Object.keys(reponses).length>=config.quiz.length?C.brun:C.pale,color:Object.keys(reponses).length>=config.quiz.length?C.blanc:C.gris,border:"none",borderRadius:10,padding:".7rem",fontSize:".82rem",fontWeight:600,fontFamily:"inherit",cursor:Object.keys(reponses).length>=config.quiz.length?"pointer":"default",transition:"all .2s"}}>
                Valider le quiz →
              </button>
            </div>
          )}

          {/* ÉTAPE ENVOYER */}
          {step==="envoyer"&&!sent&&(
            <div>
              {/* Score */}
              <div style={{background:score>=2?C.vert+"15":C.rose+"15",border:`1px solid ${score>=2?C.vert:C.rose}`,borderRadius:12,padding:"1rem",textAlign:"center",marginBottom:"1rem"}}>
                <div style={{fontSize:"2rem",marginBottom:".3rem"}}>{score===config.quiz.length?"🏆":score>=2?"✅":"💪"}</div>
                <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,color:C.brun}}>{score}/{config.quiz.length} bonnes réponses</div>
                <div style={{fontSize:".72rem",color:C.gris,marginTop:".2rem"}}>
                  {score===config.quiz.length?"Parfait !":score>=2?"Bien joué !":"Continue à revoir les notions du module"}
                </div>
              </div>

              {/* Récap exercice */}
              {config.exercice&&exoTexte&&(
                <div style={{background:C.creme,borderRadius:10,padding:".75rem",marginBottom:"1rem",fontSize:".74rem",color:C.brun}}>
                  <strong>Ton exercice :</strong> {exoTexte}
                </div>
              )}

              <button onClick={envoyer} disabled={sending}
                style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".75rem",fontSize:".84rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:".5rem"}}>
                {sending?"Envoi en cours...":"📤 Envoyer à ma marraine pour validation"}
              </button>
              <button onClick={onClose}
                style={{width:"100%",background:"none",border:`1px solid ${C.pale}`,borderRadius:10,padding:".55rem",fontSize:".76rem",color:C.gris,fontFamily:"inherit",cursor:"pointer"}}>
                Enregistrer et fermer
              </button>
            </div>
          )}

          {/* ENVOYÉ */}
          {sent&&(
            <div style={{textAlign:"center",padding:"1.5rem 0"}}>
              <div style={{fontSize:"3rem",marginBottom:".5rem"}}>🎉</div>
              <div style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",fontWeight:600,color:C.brun,marginBottom:".5rem"}}>
                Module {jour} validé !
              </div>
              <p style={{fontSize:".78rem",color:C.gris,lineHeight:1.7,marginBottom:"1.2rem"}}>
                Ta marraine a reçu tes réponses et va valider ton module. Le module suivant se débloque automatiquement 🚀
              </p>
              <button onClick={onClose}
                style={{background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".65rem 1.4rem",fontSize:".82rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                Continuer →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FastStartTab({uid, userName, goToFormation}){
  const {lang} = useLang();
  const[taskTranslations,setTaskTranslations]=useState({});

  useEffect(()=>{
    if(lang==="fr"){setTaskTranslations({});return;}
    // Collecter tous les textes de tâches
    const allTexts=[];
    const allKeys=[];
    FAST_START_DAYS.forEach(d=>{
      d.taches.forEach((t,i)=>{
        const txt=typeof t==="string"?t:t.t;
        allTexts.push(txt);
        allKeys.push(`${d.jour}-${i}`);
      });
      allTexts.push(d.titre);
      allKeys.push(`titre-${d.jour}`);
      if(d.objectif){allTexts.push(d.objectif);allKeys.push(`obj-${d.jour}`);}
    });
    translateBatch(allTexts,lang).then(res=>{
      const map={};
      allKeys.forEach((k,i)=>map[k]=res[i]);
      setTaskTranslations(map);
    });
  },[lang]);
  const[showQuiz,setShowQuiz]=useState(null);
  const[marraineUid,setMarraineUid]=useState(null);
  const[modulesValides,setModulesValides]=useState({});

  const[videosFastStart,setVideosFastStart]=useState({});
  const[ordreFormationApp,setOrdreFormationApp]=useState([]);
  const[savingOrdre,setSavingOrdre]=useState(false);
  const[savedOrdre,setSavedOrdre]=useState(false);
  useEffect(()=>{(async()=>{try{const snap=await getDoc(doc(db,"admin","formation_app_ordre"));if(snap.exists()&&snap.data().ordre)setOrdreFormationApp(snap.data().ordre);else setOrdreFormationApp(FORMATION_APP_CATEGORIES_DEFAULT.map(c=>c.id));}catch{}})();},[]);
  const sauvegarderOrdre=async()=>{setSavingOrdre(true);try{await setDoc(doc(db,"admin","formation_app_ordre"),{ordre:ordreFormationApp},{merge:true});FORMATION_APP_CATEGORIES=[...FORMATION_APP_CATEGORIES_DEFAULT].sort((a,b)=>ordreFormationApp.indexOf(a.id)-ordreFormationApp.indexOf(b.id));setSavedOrdre(true);setTimeout(()=>setSavedOrdre(false),2000);}catch{}setSavingOrdre(false);};
  const monterCat=(i)=>{if(i===0)return;const next=[...ordreFormationApp];[next[i-1],next[i]]=[next[i],next[i-1]];setOrdreFormationApp(next);};
  const descendreCat=(i)=>{if(i===ordreFormationApp.length-1)return;const next=[...ordreFormationApp];[next[i],next[i+1]]=[next[i+1],next[i]];setOrdreFormationApp(next);};
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
        setModulesValides(parsed.modulesValides||{});
      }
      // Charger la marraine depuis l'annuaire
      try{
        const snap=await getDoc(doc(db,"equipe","annuaire"));
        if(snap.exists()){
          const ann=snap.data().membres||{};
          const me=ann[uid];
          if(me?.marraine) setMarraineUid(me.marraine);
        }
      }catch{}
      // Charger les vidéos Fast Start
      try{
        const snapV=await getDoc(doc(db,"admin","videos_faststart"));
        if(snapV.exists()) setVideosFastStart(snapV.data().videos||{});
      }catch{}
      setLoaded(true);
    })();
  },[uid]);

  const validerModule=(jour)=>{
    const next={...modulesValides,[jour]:true};
    setModulesValides(next);
    // Sauvegarder
    sg(uid,"db-fast-start").then(data=>{
      const parsed=data?JSON.parse(data):{};
      ss(uid,"db-fast-start",JSON.stringify({...parsed,modulesValides:next}));
    });
  };

  const demarrer=()=>{
    const today = todayLocalStr();
    setStartDate(today);
    ss(uid,"db-fast-start",JSON.stringify({startDate:today, doneTasks:{}}));
  };

  const currentDay = startDate
    ? (()=>{
        const _s=new Date(startDate+"T12:00:00").getTime();
        const _n=new Date();const _t=new Date(_n.getFullYear(),_n.getMonth(),_n.getDate(),12,0,0).getTime();
        return Math.min(7,Math.max(1,Math.floor((_t-_s)/86400000)+1));
      })()
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

      {showQuiz&&(
        <FastStartQuizPopup
          jour={showQuiz}
          uid={uid}
          userName={userName}
          marraineUid={marraineUid}
          onClose={()=>setShowQuiz(null)}
          onValide={(j)=>{validerModule(j);setShowQuiz(null);}}
        />
      )}

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
        // Module 1 toujours accessible, modules suivants débloqués si le précédent est validé
        const prevValide = d.jour===1 ? true : !!modulesValides[d.jour-1];
        const isLocked = !prevValide && !modulesValides[d.jour];
        const moduleValide = modulesValides[d.jour];
        const hasQuiz = FAST_START_QUIZ.find(q=>q.jour===d.jour);
        return(
          <div key={d.jour} style={{background:isCurrent?"rgba(196,154,138,.08)":C.blanc,border:`1.5px solid ${moduleValide?C.vert:isCurrent?C.rose:dayDone?C.vert+"60":C.pale}`,borderRadius:12,padding:".85rem 1rem",marginBottom:".6rem",opacity:isLocked?.55:1}}>
            <div style={{display:"flex",alignItems:"center",gap:".5rem",marginBottom:".5rem"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:moduleValide?C.vert:dayDone?C.vert:isCurrent?C.rose:C.pale,color:"white",fontSize:".72rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {moduleValide?"✓":dayDone?"✓":`J${d.jour}`}
              </div>
              <div style={{fontFamily:"Georgia,serif",fontSize:".92rem",fontWeight:600,color:C.brun,flex:1}}>{taskTranslations[`titre-${d.jour}`]||d.titre}</div>
              {isCurrent&&!moduleValide&&<span style={{fontSize:".58rem",fontWeight:700,color:C.rose,background:C.rose+"15",borderRadius:20,padding:".1rem .5rem"}}>Aujourd'hui</span>}
              {moduleValide&&<span style={{fontSize:".58rem",fontWeight:700,color:C.vert,background:C.vert+"15",borderRadius:20,padding:".1rem .5rem"}}>✓ Validé</span>}
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
                    <div style={{fontSize:".74rem",color:checked?C.gris:C.texte,textDecoration:checked?"line-through":"none",lineHeight:1.5}}>{taskTranslations[`${d.jour}-${i}`]||label}</div>
                  </div>
                  {link&&!isLocked&&(
                    link.video
                    ? (()=>{
                        const vKey=`module${link.module}`;
                        const vData=videosFastStart[vKey];
                        return vData?.url
                          ? <a href={vData.url} target="_blank" rel="noopener noreferrer"
                              style={{marginLeft:"1.55rem",marginTop:".3rem",display:"inline-flex",alignItems:"center",gap:".35rem",fontSize:".72rem",fontWeight:700,color:"white",textDecoration:"none",background:C.brun,borderRadius:8,padding:".3rem .7rem"}}>
                              ▶ Regarder la vidéo
                            </a>
                          : <div style={{marginLeft:"1.55rem",marginTop:".3rem",fontSize:".66rem",color:C.gris,fontStyle:"italic"}}>
                              🎬 Vidéo bientôt disponible
                            </div>;
                      })()
                    : link.sub
                    ? <div onClick={()=>goToFormation&&goToFormation(link.sub)}
                        style={{marginLeft:"1.55rem",marginTop:".3rem",display:"inline-flex",alignItems:"center",gap:".35rem",fontSize:".66rem",fontWeight:600,color:C.rose,cursor:"pointer"}}>
                        ▶ {link.label}
                      </div>
                    : <a href={link.url} target="_blank" rel="noopener noreferrer"
                        style={{marginLeft:"1.55rem",marginTop:".3rem",display:"inline-flex",alignItems:"center",gap:".35rem",fontSize:".66rem",fontWeight:600,color:"#29A0D8",textDecoration:"none"}}>
                        ▶ {link.label}
                      </a>
                  )}
                  {tk.link2&&!isLocked&&(
                    <a href={tk.link2.url} target="_blank" rel="noopener noreferrer"
                      style={{marginLeft:"1.55rem",marginTop:".2rem",display:"inline-flex",alignItems:"center",gap:".35rem",fontSize:".66rem",fontWeight:600,color:"#29A0D8",textDecoration:"none"}}>
                      ▶ {tk.link2.label}
                    </a>
                  )}
                </div>
              );
            })}

            {/* Bouton exercice + quiz quand toutes les tâches sont cochées */}
            {dayDone&&!moduleValide&&hasQuiz&&(
              <button onClick={()=>setShowQuiz(d.jour)}
                style={{width:"100%",marginTop:".65rem",background:`linear-gradient(135deg,${C.brun},${C.brun2})`,color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:".5rem"}}>
                📝 Exercice + Quiz de validation →
              </button>
            )}
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

// ── ASSISTANTE IA DE L'ÉQUIPE ────────────────────────────────────────────────
function AssistanteIATab({uid, userName}){
  const[ouvert,setOuvert]=useState(false);
  const[messages,setMessages]=useState([]);
  const[input,setInput]=useState("");
  const[loading,setLoading]=useState(false);
  const[ordonnanceEnvoyee,setOrdonnanceEnvoyee]=useState({});

  const ouvrirChat=()=>{
    setOuvert(true);
    if(messages.length===0){
      setMessages([{role:"assistant",text:`Coucou ${userName?.split(" ")[0]||""} ! 👋 Je suis ton assistante Blazing Dynasty. Je peux t'aider à conseiller tes clientes sur les produits Mihi (avec ordonnance et prix), répondre à tes questions business, ou juste t'écouter si t'as besoin d'en parler. De quoi as-tu besoin ?`}]);
    }
  };

  const envoyer=async()=>{
    const texte=input.trim();
    if(!texte||loading)return;
    const newMsgs=[...messages,{role:"user",text:texte}];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);

    try{
      // Charger le catalogue produits
      let catalogueText="";
      try{
        const catSnap=await getDoc(doc(db,"admin","catalogue_mihi"));
        if(catSnap.exists()){
          const cat=catSnap.data();
          const allProduits=[...(cat.face||[]),...(cat.hair||[]),...(cat.health||[])].slice(0,80);
          catalogueText=allProduits.map(p=>`- ${p.nom} (${p.serie}) — ${p.prix}€`).join("\n");
        }
      }catch{}

      // Charger les contenus de formation (textes admin)
      let formationText="";
      try{
        const formSnap=await getDoc(doc(db,"admin","contenus"));
        if(formSnap.exists()){
          const items=(formSnap.data().items||[]).filter(i=>i.actif!==false&&i.description);
          formationText=items.slice(0,30).map(i=>`[${i.destination}] ${i.titre}: ${i.description}`).join("\n");
        }
      }catch{}

      // Charger formation produits (textes détaillés par catégorie)
      let produitsFormationText="";
      try{
        const fpSnap=await getDoc(doc(db,"admin","formation_produits"));
        if(fpSnap.exists()){
          const produits=fpSnap.data().produits||{};
          const lignes=[];
          Object.entries(produits).forEach(([cat,liste])=>{
            (liste||[]).forEach(p=>{
              if(p.description) lignes.push(`[${cat}] ${p.titre}: ${p.description.slice(0,200)}`);
            });
          });
          produitsFormationText=lignes.slice(0,40).join("\n");
        }
      }catch{}

      const historique=newMsgs.slice(-8).map(m=>`${m.role==="user"?"Distributrice":"Assistante"}: ${m.text}`).join("\n");

      const prompt=`Tu es l'assistante IA de l'équipe Blazing Dynasty (Mihi France), une équipe de vente directe en MLM. Tu parles à une distributrice de l'équipe, jamais à une cliente finale.

CONTEXTE FORMATIONS DE L'ÉQUIPE :
${formationText||"Aucune formation chargée pour l'instant."}

DÉTAILS PRODUITS (descriptions formation) :
${produitsFormationText||"Aucun détail produit chargé."}

CATALOGUE PRODUITS MIHI AVEC PRIX RÉELS (utilise UNIQUEMENT ces produits et prix exacts si on te demande une recommandation produits — n'invente JAMAIS un produit ou un prix) :
${catalogueText||"Catalogue non chargé."}

HISTORIQUE DE LA CONVERSATION :
${historique}

INSTRUCTIONS :
- Si la distributrice te pose une question PRODUIT (pour conseiller une cliente) : génère une réponse en JSON avec 3 packs et prix exacts du catalogue (format ci-dessous)
- Si la question est BUSINESS (stratégie, recrutement, vente, organisation) : réponds en JSON avec type "texte", contenu utile et concret basé sur les formations ci-dessus
- Si la question est MOOD/personnelle (fatigue, doute, motivation) : réponds en JSON avec type "texte", chaleureux et empathique, sans psychanalyser
- Réponds TOUJOURS en français, ton "cash mais élégant" (direct, bienveillant, jamais mièvre)
- Réponds UNIQUEMENT avec le JSON, sans markdown ni commentaire

FORMAT JSON SI PRODUITS (type="produits") :
{"type":"produits","analyse":"2-3 phrases analysant le besoin","packs":[{"nom":"Pack Essentiel","emoji":"💚","produits":[{"nom":"Nom exact du catalogue","prix":XX,"role":"pourquoi ce produit"}],"total":XX},{"nom":"Pack Recommandé","emoji":"⭐","produits":[...],"total":XX},{"nom":"Pack Premium","emoji":"👑","produits":[...],"total":XX}],"conseil":"conseil final"}

FORMAT JSON SI TEXTE (type="texte", business ou mood) :
{"type":"texte","reponse":"ta réponse complète et utile"}`;

      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:2000,messages:[{role:"user",content:prompt}]})
      });
      const data=await res.json();
      const raw=data.content?.map(x=>x.text||"").join("").trim()||"{}";
      const match=raw.match(/\{[\s\S]*\}/);
      const parsed=match?JSON.parse(match[0]):{type:"texte",reponse:"Désolée, je n'ai pas pu traiter ta demande. Réessaie."};

      setMessages(m=>[...m,{role:"assistant",...parsed}]);
    }catch(e){
      setMessages(m=>[...m,{role:"assistant",type:"texte",reponse:"Oups, petit souci technique 😅 Réessaie dans quelques secondes."}]);
    }
    setLoading(false);
  };

  const envoyerOrdonnance=(msgIdx,packs)=>{
    const texte=packs.map(p=>`${p.emoji} ${p.nom} (${p.total}€)\n${p.produits.map(pr=>`• ${pr.nom} — ${pr.prix}€`).join("\n")}`).join("\n\n");
    navigator.clipboard?.writeText(texte);
    setOrdonnanceEnvoyee(p=>({...p,[msgIdx]:true}));
    setTimeout(()=>setOrdonnanceEnvoyee(p=>({...p,[msgIdx]:false})),2500);
  };

  if(!ouvert){
    return(
      <div onClick={ouvrirChat}
        style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:14,padding:".9rem 1rem",marginBottom:"1rem",cursor:"pointer",display:"flex",alignItems:"center",gap:".75rem",boxShadow:"0 3px 12px rgba(61,31,14,.15)"}}>
        <div style={{width:46,height:46,borderRadius:"50%",background:`linear-gradient(135deg,${C.rose},${C.lilas})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem",flexShrink:0}}>
          🤖
        </div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"Georgia,serif",fontSize:".92rem",fontWeight:600,color:"white"}}>Comment puis-je t'aider et répondre ?</div>
          <div style={{fontSize:".68rem",color:C.pale,marginTop:".1rem"}}>Produits · Business · Petit coup de mou — je suis là</div>
        </div>
        <div style={{color:C.or,fontSize:"1.1rem"}}>→</div>
      </div>
    );
  }

  return(
    <div style={{background:C.blanc,border:`1.5px solid ${C.rose}40`,borderRadius:14,marginBottom:"1rem",overflow:"hidden"}}>
      {/* Header */}
      <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,padding:".75rem 1rem",display:"flex",alignItems:"center",gap:".6rem"}}>
        <div style={{width:36,height:36,borderRadius:"50%",background:`linear-gradient(135deg,${C.rose},${C.lilas})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",flexShrink:0}}>🤖</div>
        <div style={{flex:1}}>
          <div style={{fontSize:".82rem",fontWeight:700,color:"white"}}>Assistante Blazing Dynasty</div>
          <div style={{fontSize:".6rem",color:C.pale}}>Produits · Business · Mood</div>
        </div>
        <button onClick={()=>setOuvert(false)} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:7,padding:".25rem .5rem",color:"white",cursor:"pointer",fontSize:".7rem",fontFamily:"inherit"}}>✕</button>
      </div>

      {/* Messages */}
      <div style={{maxHeight:420,overflowY:"auto",padding:".85rem"}}>
        {messages.map((m,i)=>{
          if(m.role==="user"){
            return(
              <div key={i} style={{display:"flex",justifyContent:"flex-end",marginBottom:".6rem"}}>
                <div style={{background:C.rose,color:"white",borderRadius:"12px 12px 2px 12px",padding:".5rem .75rem",fontSize:".78rem",maxWidth:"80%",lineHeight:1.5}}>{m.text}</div>
              </div>
            );
          }
          // Assistant
          if(m.text){
            // Message d'accueil simple
            return(
              <div key={i} style={{display:"flex",marginBottom:".6rem"}}>
                <div style={{background:C.creme,color:C.texte,borderRadius:"12px 12px 12px 2px",padding:".5rem .75rem",fontSize:".78rem",maxWidth:"85%",lineHeight:1.6}}>{m.text}</div>
              </div>
            );
          }
          if(m.type==="produits"){
            return(
              <div key={i} style={{marginBottom:".75rem"}}>
                <div style={{background:C.creme,borderRadius:"12px 12px 12px 2px",padding:".65rem .8rem",fontSize:".78rem",color:C.texte,lineHeight:1.6,marginBottom:".5rem"}}>
                  {m.analyse}
                </div>
                {(m.packs||[]).map((pack,pi)=>(
                  <div key={pi} style={{background:C.blanc,border:`1.5px solid ${C.pale}`,borderRadius:11,padding:".6rem .75rem",marginBottom:".4rem"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".35rem"}}>
                      <div style={{fontSize:".78rem",fontWeight:700,color:C.brun}}>{pack.emoji} {pack.nom}</div>
                      <div style={{fontFamily:"Georgia,serif",fontSize:".85rem",fontWeight:700,color:C.rose}}>{pack.total}€</div>
                    </div>
                    {(pack.produits||[]).map((pr,pri)=>(
                      <div key={pri} style={{display:"flex",justifyContent:"space-between",fontSize:".68rem",color:C.gris,padding:".15rem 0"}}>
                        <span>• {pr.nom}</span>
                        <span style={{fontWeight:600,color:C.brun,flexShrink:0,marginLeft:".5rem"}}>{pr.prix}€</span>
                      </div>
                    ))}
                  </div>
                ))}
                {m.conseil&&<div style={{fontSize:".72rem",color:C.brun,fontStyle:"italic",padding:".5rem .65rem",background:"#FFF8E1",borderRadius:8,marginBottom:".5rem"}}>💛 {m.conseil}</div>}
                <button onClick={()=>envoyerOrdonnance(i,m.packs)}
                  style={{width:"100%",background:ordonnanceEnvoyee[i]?C.vert:C.brun,color:"white",border:"none",borderRadius:9,padding:".5rem",fontSize:".74rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                  {ordonnanceEnvoyee[i]?"✓ Copiée — colle-la à ta cliente !":"📋 Copier l'ordonnance pour l'envoyer"}
                </button>
              </div>
            );
          }
          if(m.type==="texte"){
            return(
              <div key={i} style={{display:"flex",marginBottom:".6rem"}}>
                <div style={{background:C.creme,color:C.texte,borderRadius:"12px 12px 12px 2px",padding:".5rem .75rem",fontSize:".78rem",maxWidth:"85%",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{m.reponse}</div>
              </div>
            );
          }
          return null;
        })}
        {loading&&(
          <div style={{display:"flex",marginBottom:".6rem"}}>
            <div style={{background:C.creme,borderRadius:"12px 12px 12px 2px",padding:".5rem .75rem",fontSize:".78rem",color:C.gris}}>✨ Je réfléchis...</div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{display:"flex",gap:".4rem",padding:".65rem .85rem",borderTop:`1px solid ${C.pale}`}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&envoyer()}
          placeholder="Pose ta question..."
          style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:9,padding:".5rem .7rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
        <button onClick={envoyer} disabled={loading||!input.trim()}
          style={{background:loading||!input.trim()?C.pale:C.brun,color:"white",border:"none",borderRadius:9,padding:".5rem .85rem",fontSize:".82rem",fontWeight:600,fontFamily:"inherit",cursor:loading?"default":"pointer"}}>
          →
        </button>
      </div>
    </div>
  );
}

function ProduitsSearchTab(){
  const[question,setQuestion]=useState("");
  const[loading,setLoading]=useState(false);
  const[ordonnance,setOrdonnance]=useState(null);
  const[erreur,setErreur]=useState("");
  const[baseFormation,setBaseFormation]=useState({});
  const[baseLoaded,setBaseLoaded]=useState(false);

  // Charger la base Formation Produits au démarrage
  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","formation_produits"));
        if(snap.exists()) setBaseFormation(snap.data().produits||{});
      }catch{}
      setBaseLoaded(true);
    })();
  },[]);

  // Construire le contexte textuel à injecter dans le prompt
  const buildContexte=()=>{
    const lignes=[];
    CATEGORIES_PRODUITS.forEach(cat=>{
      const produits=baseFormation[cat.id]||[];
      if(produits.length===0)return;
      lignes.push(`\n=== ${cat.icon} ${cat.label.toUpperCase()} ===`);
      produits.forEach(p=>{
        lignes.push(`\nProduit : ${p.titre}`);
        if(p.description) lignes.push(`Description : ${p.description.slice(0,600)}`);
      });
    });
    return lignes.join("\n");
  };

  const genererOrdonnance=async()=>{
    const q=question.trim();
    if(!q)return;
    setLoading(true);setErreur("");setOrdonnance(null);

    const contexte=buildContexte();

    if(!contexte||contexte.length<50){
      setErreur("La base de formation produits est vide. Demande à Melissa d'ajouter des produits depuis l'Admin.");
      setLoading(false);return;
    }

    const prompt=`Tu es une conseillère beauté et bien-être experte des produits Mihi, qui aide à trouver la combinaison parfaite pour chaque cliente.

BASE DE CONNAISSANCES PRODUITS MIHI :
${contexte}

QUESTION / BESOIN DE LA CLIENTE :
"${q}"

En te basant UNIQUEMENT sur les produits présents dans la base de connaissances ci-dessus, génère une ordonnance personnalisée en JSON (ne renvoie QUE le JSON, sans markdown ni commentaire) :

{
  "analyse": "2-3 phrases qui analysent le besoin exprimé et expliquent ton approche",
  "packs": [
    {
      "nom": "Pack Essentiel",
      "emoji": "💚",
      "couleur": "#27AE60",
      "description": "L'essentiel pour commencer, budget accessible",
      "produits": [
        {"nom": "Nom exact du produit", "role": "Pourquoi ce produit pour ce besoin", "categorie": "Catégorie"},
        {"nom": "Nom exact du produit 2", "role": "Pourquoi ce produit", "categorie": "Catégorie"}
      ],
      "avantage_cle": "Le principal bénéfice de ce pack en 1 phrase"
    },
    {
      "nom": "Pack Recommandé",
      "emoji": "⭐",
      "couleur": "#C49A8A",
      "description": "La combinaison idéale, notre recommandation",
      "produits": [
        {"nom": "Produit 1", "role": "Rôle", "categorie": "Catégorie"},
        {"nom": "Produit 2", "role": "Rôle", "categorie": "Catégorie"},
        {"nom": "Produit 3", "role": "Rôle", "categorie": "Catégorie"}
      ],
      "avantage_cle": "Pourquoi ce pack est le meilleur choix"
    },
    {
      "nom": "Pack Premium",
      "emoji": "👑",
      "couleur": "#C4A832",
      "description": "La routine complète, résultats maximaux",
      "produits": [
        {"nom": "Produit 1", "role": "Rôle", "categorie": "Catégorie"},
        {"nom": "Produit 2", "role": "Rôle", "categorie": "Catégorie"},
        {"nom": "Produit 3", "role": "Rôle", "categorie": "Catégorie"},
        {"nom": "Produit 4", "role": "Rôle", "categorie": "Catégorie"}
      ],
      "avantage_cle": "L'expérience complète et transformative"
    }
  ],
  "conseil": "Un conseil personnalisé final pour accompagner la cliente, en 2 phrases"
}

RÈGLES IMPORTANTES :
- N'utilise QUE les produits présents dans la base de connaissances
- Si la base ne contient pas assez de produits pour répondre, adapte les packs en conséquence
- Les packs doivent être progressifs en termes de complétude (pas nécessairement de prix)
- Sois précise et concrète dans les explications`;

    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "x-api-key":ANTHROPIC_API_KEY,
          "anthropic-version":"2023-06-01",
          "anthropic-dangerous-direct-browser-access":"true"
        },
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:2000,messages:[{role:"user",content:prompt}]})
      });
      const data=await res.json();
      if(data.error)throw new Error(data.error.message);
      const text=data.content?.map(i=>i.text||"").join("")||"";
      const clean=text.replace(/```json|```/g,"").trim();
      setOrdonnance(JSON.parse(clean));
    }catch(e){
      setErreur("Erreur lors de la génération. Réessaie dans quelques secondes.");
    }
    setLoading(false);
  };

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Conseillère <em style={{fontStyle:"italic",color:C.rose}}>Produits IA</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Décris le besoin de ta cliente — l'IA sélectionne les produits Mihi adaptés et crée une ordonnance personnalisée.
      </p>

      {/* Exemples de questions */}
      {!ordonnance&&!loading&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:".35rem",marginBottom:".75rem"}}>
          {["Peau sèche et terne","Perte de poids + énergie","Maquillage longue tenue","Cheveux abîmés","Complément anti-âge","Parfum féminin doux"].map(ex=>(
            <button key={ex} onClick={()=>setQuestion(ex)}
              style={{padding:".3rem .65rem",fontSize:".68rem",borderRadius:20,border:`1px solid ${C.pale}`,background:C.blanc,color:C.brun,cursor:"pointer",fontFamily:"inherit"}}>
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Champ de saisie */}
      <div style={{position:"relative",marginBottom:".75rem"}}>
        <textarea
          value={question}
          onChange={e=>setQuestion(e.target.value)}
          placeholder="Ex: Ma cliente a la peau grasse avec des imperfections, elle veut aussi perdre du poids durablement..."
          rows={3}
          style={{width:"100%",border:`1px solid ${question?C.rose:C.pale}`,borderRadius:12,padding:".65rem .85rem",fontSize:".82rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",resize:"none",lineHeight:1.6}}
        />
      </div>

      <button onClick={genererOrdonnance} disabled={loading||!question.trim()||!baseLoaded}
        style={{width:"100%",background:loading?"#aaa":question.trim()?C.brun:C.pale,color:"white",border:"none",borderRadius:10,padding:".7rem",fontSize:".85rem",fontWeight:600,fontFamily:"inherit",cursor:loading||!question.trim()?"default":"pointer",marginBottom:"1rem",transition:"background .2s"}}>
        {loading?"✨ L'IA cherche dans les produits...":!baseLoaded?"Chargement de la base...":"✨ Générer l'ordonnance produits"}
      </button>

      {erreur&&<div style={{background:"#FEE",border:"1px solid #E88",borderRadius:9,padding:".65rem .85rem",fontSize:".74rem",color:"#B04040",marginBottom:"1rem"}}>{erreur}</div>}

      {/* ORDONNANCE */}
      {ordonnance&&(
        <div>
          {/* Analyse */}
          <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:12,padding:".9rem 1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".55rem",fontWeight:700,color:C.or,letterSpacing:".12em",textTransform:"uppercase",marginBottom:".35rem"}}>🔍 Analyse du besoin</div>
            <div style={{fontSize:".82rem",color:C.pale,lineHeight:1.7}}>{ordonnance.analyse}</div>
          </div>

          {/* 3 Packs */}
          {(ordonnance.packs||[]).map((pack,idx)=>(
            <div key={idx} style={{background:C.blanc,border:`2px solid ${pack.couleur}30`,borderRadius:14,overflow:"hidden",marginBottom:".75rem"}}>
              {/* Header pack */}
              <div style={{background:`linear-gradient(135deg,${pack.couleur},${pack.couleur}bb)`,padding:".75rem 1rem"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,color:"white"}}>{pack.emoji} {pack.nom}</div>
                    <div style={{fontSize:".68rem",color:"rgba(255,255,255,.8)",marginTop:".1rem"}}>{pack.description}</div>
                  </div>
                </div>
                <div style={{background:"rgba(255,255,255,.2)",borderRadius:8,padding:".4rem .6rem",marginTop:".5rem",fontSize:".7rem",color:"white",fontWeight:600}}>
                  💡 {pack.avantage_cle}
                </div>
              </div>

              {/* Produits du pack */}
              <div style={{padding:".75rem 1rem"}}>
                {(pack.produits||[]).map((p,i)=>(
                  <div key={i} style={{display:"flex",gap:".55rem",alignItems:"flex-start",padding:".45rem 0",borderBottom:i<(pack.produits.length-1)?`1px solid ${C.pale}30`:"none"}}>
                    <div style={{width:28,height:28,borderRadius:"50%",background:pack.couleur+"20",border:`1.5px solid ${pack.couleur}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:".65rem",fontWeight:700,color:pack.couleur}}>
                      {i+1}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:".8rem",fontWeight:700,color:C.brun}}>{p.nom}</div>
                      <div style={{fontSize:".68rem",color:C.gris,fontStyle:"italic",marginTop:".1rem"}}>{p.role}</div>
                      {p.categorie&&<div style={{fontSize:".58rem",color:pack.couleur,marginTop:".1rem",fontWeight:600}}>{CATEGORIES_PRODUITS.find(c=>c.id===p.categorie)?.icon||""} {p.categorie}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Conseil final */}
          {ordonnance.conseil&&(
            <div style={{background:C.creme,borderRadius:10,padding:".75rem 1rem",border:`1px solid ${C.or}40`}}>
              <div style={{fontSize:".8rem",color:C.brun,lineHeight:1.7,fontStyle:"italic"}}>💛 {ordonnance.conseil}</div>
            </div>
          )}

          {/* Nouvelle question */}
          <button onClick={()=>{setOrdonnance(null);setQuestion("");}}
            style={{width:"100%",marginTop:"1rem",background:"none",border:`1px solid ${C.pale}`,borderRadius:9,padding:".5rem",fontSize:".76rem",color:C.gris,fontFamily:"inherit",cursor:"pointer"}}>
            ← Nouvelle question
          </button>
        </div>
      )}
    </div>
  );
}

const OBJECTIONS_VENTE=[
  {id:"cher",icon:"💰",label:"C'est trop cher",reponses:["Je comprends ! Ce qui est intéressant avec Mihi, c'est que les produits sont concentrés — une petite quantité suffit, donc le flacon dure bien plus longtemps qu'un produit classique. Au final, le coût par utilisation est souvent inférieur à ce qu'on trouve en grande surface 😊","La qualité a un prix, mais avec Mihi tu ne paies pas la pub, les intermédiaires ou les rayons de supermarché. Tout va dans le produit. Tu veux que je te montre la différence de composition ?","C'est un investissement dans ta peau et ta santé. Et le plus souvent, mes clientes me disent qu'elles ont arrêté d'acheter 3 ou 4 autres produits parce que Mihi leur suffit !"]},
  {id:"besoin",icon:"🤔",label:"Je n'en ai pas besoin",reponses:["Bien sûr, tu n'es pas obligée ! Mais dis-moi, si tu pouvais avoir une peau plus lumineuse / plus d'énergie / moins de cheveux qui tombent... tu prendrais quoi comme produit actuellement ?","Je t'entends. Et souvent, on ne sait pas qu'on a besoin d'un produit avant de l'essayer. C'est pour ça que je propose des tests 😊 Qu'est-ce qui te manquerait le plus si tu pouvais changer une chose dans ta routine ?","Ce n'est pas un problème ! Je ne vends pas à tout le monde. Je te pose juste la question : est-ce que tu es contente à 100% de tes produits actuels ?"]},
  {id:"reflexion",icon:"💭",label:"Je vais réfléchir",reponses:["Bien sûr ! Je ne veux pas que tu achètes par pression. Pour t'aider à réfléchir : qu'est-ce qui te retient ? Le prix, le fait de ne pas connaître les produits, autre chose ?","Je comprends. Tu veux qu'on se rappelle dans 3 jours ? Comme ça tu as le temps d'y penser tranquillement 😊","À quoi tu dois réfléchir précisément ? Si c'est une question sur les ingrédients, les résultats ou le budget, je peux t'aider maintenant !"]},
  {id:"concurrence",icon:"🔄",label:"J'ai déjà une autre marque",reponses:["Super ! Ça veut dire que tu prends soin de toi 🌸 Et si tu ajoutes juste un produit Mihi à côté pour comparer ? Beaucoup de mes clientes ont fait ça et ont progressivement switché quand elles ont vu la différence.","C'est quoi ta marque actuelle ? Je te dis franchement si Mihi est mieux adapté ou pas à ton cas. Je préfère être honnête plutôt que de vendre pour vendre.","Je ne te demande pas de tout changer d'un coup ! Est-ce qu'il y a un seul besoin pour lequel tu n'es pas 100% satisfaite ? On peut commencer par là 😊"]},
  {id:"pharmacie",icon:"🏥",label:"Je préfère la pharmacie",reponses:["La pharmacie c'est bien pour des problèmes spécifiques ! Mais pour la routine quotidienne, Mihi propose des formules sans sulfates, sans parabènes, sans perturbateurs endocriniens. Des ingrédients que tu ne trouveras pas forcément en pharmacie.","Je comprends la confiance en pharmacie. Mihi c'est une gamme développée par ElfaPharm, qui est justement un laboratoire pharmaceutique. Tu bénéficies de la même rigueur, mais avec une distribution directe qui fait baisser le prix.","Est-ce qu'il y a un produit spécifique que tu achètes en pharmacie ? Je peux te dire si on a un équivalent et te montrer la comparaison d'ingrédients 😊"]},
];

const OBJECTIONS_RECRUTEMENT=[
  {id:"mlm",icon:"😬",label:"C'est du MLM / arnaque",reponses:["Je te comprends totalement, j'avais les mêmes craintes au départ ! La différence fondamentale : avec Mihi, je gagne principalement sur les ventes de vrais produits à de vraies clientes. Pas sur le recrutement. Si je recrutais sans vendre, je ne gagnerais rien.","C'est une vente directe réglementée en France, pas un pyramide. Les produits existent vraiment, les clientes les achètent vraiment. Je peux te montrer mes vrais résultats du mois si tu veux être transparente.","Je ne te demande pas de me croire sur parole ! Je te propose juste de rencontrer quelques membres de l'équipe et de leur poser la question directement. Qu'est-ce qui te ferait changer d'avis si tu pouvais avoir une vraie réponse ?"]},
  {id:"temps",icon:"⏰",label:"Je n'ai pas le temps",reponses:["C'est exactement pour ça que je t'en parle ! Beaucoup de mes membres travaillent depuis leur téléphone, pendant que les enfants dorment ou pendant la pause déjeuner. On adapte à ton rythme de vie, pas l'inverse.","Combien d'heures par semaine tu penses avoir ? Parce qu'avec 3-4h par semaine, certaines de mes membres font déjà 200-300€ de ventes. C'est pas le Pérou, mais c'est un vrai complément.","Je ne veux pas que tu sacrifies du temps que tu n'as pas. On peut juste en parler 20 minutes pour que tu aies toutes les infos ? Après tu décides librement 😊"]},
  {id:"argent",icon:"💶",label:"Je n'ai pas les moyens",reponses:["Le starter kit commence à 39€. C'est le seul investissement — après tu te rembourses sur tes premières ventes. Et si vraiment c'est impossible, on peut trouver une solution ensemble.","Je comprends. Est-ce que c'est un problème de budget ponctuel ou structurel ? Parce que si c'est ponctuel, on peut attendre le bon moment. Et si c'est structurel... n'est-ce pas justement pour ça que tu as besoin de revenus complémentaires ?","On peut commencer progressivement. Parle-en autour de toi, ramène tes premières clientes sans kit, et on voit si l'activité te plaît avant d'investir quoi que ce soit."]},
  {id:"introvertie",icon:"😶",label:"Je suis trop timide / pas commerciale",reponses:["Les meilleures vendeuses de l'équipe sont souvent des personnes discrètes ! Parce qu'elles écoutent vraiment les clientes au lieu de les bombarder. Et avec les produits Mihi, tu n'as pas besoin de 'vendre' — tu partages ce que tu aimes vraiment.","Je n'étais pas commerciale du tout non plus au départ. Ce qui a tout changé : aimer les produits et en parler naturellement. Quand tu crois en ce que tu vends, ça ne ressemble plus à de la vente.","On a une formation complète pour ça ! Scripts, réponses aux objections, stories Instagram... On ne te lâche pas dans le vide. Et les premières ventes se font souvent avec l'entourage proche, pas avec des inconnus 😊"]},
  {id:"experience",icon:"📚",label:"Je n'ai pas d'expérience",reponses:["Bonne nouvelle : on n'en a pas besoin ! J'ai des membres qui n'avaient jamais vendu quoi que ce soit et qui font des centaines d'euros par mois aujourd'hui. On forme tout le monde de zéro.","L'expérience vient en faisant. Et comme je suis ta marraine, tu n'es jamais seule. Chaque question, chaque doute, je suis là pour t'aider à avancer.","La seule chose dont tu as besoin : croire aux produits et être prête à apprendre. Le reste, on te l'enseigne étape par étape dans notre programme de démarrage 🚀"]},
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


// ── BIBLIOTHÈQUE D'IDÉES DE POSTS ────────────────────────────────────────────
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

  const today = new Date();
  const todayStr = today.toISOString().slice(0,10);
  const JOURS = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
  const MOIS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
  const API_KEY = "ANTHROPIC_API_KEY";

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
      const prompt = "Tu es experte content marketing pour Melissa, distributrice Mihi France, maman authentique.\nJour: "+jn+" "+d.getDate()+"/"+d.getMonth()+"\nPost1: "+th.p1.type+" - "+th.p1.hook+"\nPost2: "+th.p2.type+" - "+th.p2.hook+(th.p2.cta?" CTA:"+th.p2.cta:"")+"\nStories: "+th.s.join("|")+"\nReponds UNIQUEMENT en JSON valide sans backticks:\n{\"post1\":{\"hooks\":[\"h1\",\"h2\",\"h3\"],\"legende\":\"150 mots avec emojis\",\"hashtags\":\"#tag1 #tag2 etc\"},\"post2\":{\"hooks\":[\"h1\",\"h2\",\"h3\"],\"legende\":\"avec CTA clair\",\"hashtags\":\"#tag1 #tag2 etc\"},\"stories\":[{\"num\":1,\"script\":\"texte\",\"conseil\":\"visuel\"},{\"num\":2,\"script\":\"sondage\",\"conseil\":\"visuel\"},{\"num\":3,\"script\":\"CTA\",\"conseil\":\"visuel\"}]}";
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
    <div style={{paddingBottom:"2rem"}}>
      {showIdees&&<BiblioPopup dateStr={showIdees.dateStr} postIdx={showIdees.postIdx} onClose={()=>setShowIdees(null)}/>}

      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:"1rem"}}>
        Éditorial <em style={{color:C.rose}}>IA</em>
      </div>
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

function CalendrierTab({uid,userName,isMelissa,isChef}){
  const[events,setEvents]=useState([]);
  const[loaded,setLoaded]=useState(false);
  const[showAdd,setShowAdd]=useState(false);
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

// ── OBJECTIFS POPUP ───────────────────────────────────────────────────────────
// ── PÉRIODE MIHI ─────────────────────────────────────────────────────────────
// Période de 21 jours, commence un mercredi
// Référence : période en cours se termine dans 6j 12h à partir d'aujourd'hui (11/06/2026)
function getPeriodeInfo(){
  // Utiliser le calendrier officiel Mihi
  const campOfficielle = getCampagneMihiActuelle();
  if(campOfficielle){
    const deb = new Date(campOfficielle.debut+"T12:00:00");
    const fin = new Date(campOfficielle.fin+"T23:59:59");
    const now = Date.now();
    const PERIOD_MS = 21*24*60*60*1000;
    const msLeft = fin.getTime() - now;
    const daysLeft = Math.max(0, Math.ceil(msLeft/(1000*60*60*24)));
    const hoursLeft = Math.max(0, Math.floor((msLeft%(1000*60*60*24))/(1000*60*60)));
    const pctElapsed = Math.min(100, Math.round((now-deb.getTime())/PERIOD_MS*100));
    return {periodNum:campOfficielle.num, periodStart:deb, periodEnd:fin, daysLeft, hoursLeft, pctElapsed, pctLeft:Math.max(0,100-pctElapsed)};
  }
  // Fallback calcul linéaire
  const ANCRE = new Date("2026-01-01T12:00:00").getTime();
  const PERIOD_MS = PERIODE_DUREE_JOURS * 24 * 60 * 60 * 1000;
  const d = new Date(); const now = new Date(d.getFullYear(),d.getMonth(),d.getDate(),12,0,0).getTime();
  const periodNum = Math.max(1, Math.floor((now - ANCRE) / PERIOD_MS) + 1);
  const periodStart = new Date(ANCRE + (periodNum-1)*PERIOD_MS);
  const periodEnd = new Date(periodStart.getTime() + PERIOD_MS);
  const msLeft = periodEnd.getTime() - now;
  const daysLeft = Math.max(0, Math.floor(msLeft / (1000*60*60*24)));
  const hoursLeft = Math.max(0, Math.floor((msLeft % (1000*60*60*24)) / (1000*60*60)));
  const pctElapsed = Math.round((1 - msLeft/PERIOD_MS)*100);
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
            <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>💰 CA Total équipe cette période</div>
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
export function Confetti({trigger}){
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
// ── TO-DO LISTE PERSONNELLE ───────────────────────────────────────────────────
// ── BIBLIOTHÈQUE D'ACTIONS ────────────────────────────────────────────────────
const ACTIONS_BIBLIO = {
  ventes: [
    {id:"v1",icon:"📸",label:"Poster une photo avant/après produit"},
    {id:"v2",icon:"🎥",label:"Faire un Reel de démonstration produit"},
    {id:"v3",icon:"💬",label:"Envoyer 3 DM à des personnes qui ont liké tes posts"},
    {id:"v4",icon:"🛍️",label:"Partager un témoignage client en story"},
    {id:"v5",icon:"✨",label:"Faire une story \"routine du matin\" avec tes produits"},
    {id:"v6",icon:"📋",label:"Envoyer un devis personnalisé à une cliente intéressée"},
    {id:"v7",icon:"🎁",label:"Créer une offre groupée de 2-3 produits complémentaires"},
    {id:"v8",icon:"📞",label:"Appeler une ancienne cliente pour prendre des nouvelles"},
    {id:"v9",icon:"💌",label:"Envoyer un message de suivi à une cliente qui a commandé"},
    {id:"v10",icon:"🌟",label:"Poster un top 3 produits de la semaine"},
    {id:"v11",icon:"🎬",label:"Faire un live de 15 min sur un produit phare"},
    {id:"v12",icon:"📊",label:"Créer un sondage story sur les besoins beauté"},
    {id:"v13",icon:"💡",label:"Partager un conseil beauté lié à tes produits"},
    {id:"v14",icon:"🤳",label:"Faire un unboxing d'un produit en story"},
    {id:"v15",icon:"💰",label:"Proposer un paiement en 2-3 fois à une cliente hésitante"},
    {id:"v16",icon:"🎯",label:"Contacter 5 personnes de ta liste chaude"},
    {id:"v17",icon:"📱",label:"Publier le lien de ton diagnostic personnalisé en story"},
    {id:"v18",icon:"🌸",label:"Faire une story \"ma peau ce matin\" naturelle et authentique"},
    {id:"v19",icon:"💆",label:"Poster un rituel soin corps avec tes produits"},
    {id:"v20",icon:"🎉",label:"Annoncer une nouveauté ou lancement produit"},
    {id:"v21",icon:"📷",label:"Poster une photo lifestyle avec le produit intégré naturellement"},
    {id:"v22",icon:"🔖",label:"Partager un article ou étude sur les bienfaits d'un ingrédient"},
    {id:"v23",icon:"👩",label:"Mettre en avant le témoignage d'une cliente satisfaite"},
    {id:"v24",icon:"💎",label:"Créer un contenu comparatif avant/après 30 jours"},
    {id:"v25",icon:"🛒",label:"Faire une story avec le lien direct vers ton catalogue"},
    {id:"v26",icon:"🌙",label:"Partager ta routine du soir en stories"},
    {id:"v27",icon:"☀️",label:"Partager ta routine du matin en stories"},
    {id:"v28",icon:"📣",label:"Faire un post éducatif sur un problème de peau courant"},
    {id:"v29",icon:"🧴",label:"Filmer l'application d'un produit en texture et résultat"},
    {id:"v30",icon:"🤝",label:"Proposer un diagnostic offert à 3 personnes de ta liste"},
    {id:"v31",icon:"🎀",label:"Créer un contenu cadeau idéal pour une occasion"},
    {id:"v32",icon:"💬",label:"Répondre à tous les commentaires de tes posts récents"},
    {id:"v33",icon:"🌿",label:"Poster sur les ingrédients naturels de tes produits"},
    {id:"v34",icon:"👑",label:"Faire un carrousel top 5 produits bestsellers"},
    {id:"v35",icon:"📲",label:"Relancer par DM les personnes qui ont regardé tes stories"},
    {id:"v36",icon:"🎗️",label:"Créer un post autour d'une journée thématique"},
    {id:"v37",icon:"💫",label:"Partager ton propre résultat visible sur un produit"},
    {id:"v38",icon:"🔔",label:"Activer les rappels commandes pour 3 clientes"},
    {id:"v39",icon:"📝",label:"Rédiger 3 scripts de vente pour tes produits phares"},
    {id:"v40",icon:"🌈",label:"Faire un post sur la gamme couleur maquillage"},
    {id:"v41",icon:"🧪",label:"Tester un nouveau produit et partager ta première impression"},
    {id:"v42",icon:"💪",label:"Poster un contenu sur les compléments alimentaires et énergie"},
    {id:"v43",icon:"🏆",label:"Partager tes résultats du mois (ventes, clientes)"},
    {id:"v44",icon:"🎓",label:"Créer un mini-guide beauté à partager en DM"},
    {id:"v45",icon:"🔥",label:"Faire une vente flash 24h sur un produit"},
    {id:"v46",icon:"🌺",label:"Poster sur les bienfaits d'un produit en détail"},
    {id:"v47",icon:"💝",label:"Envoyer un message de remerciement à tes meilleures clientes"},
    {id:"v48",icon:"📌",label:"Épingler ton meilleur post de vente sur ton profil"},
    {id:"v49",icon:"🌟",label:"Demander à 3 clientes un avis écrit ou vidéo"},
    {id:"v50",icon:"🎯",label:"Identifier 10 nouvelles cibles sur Instagram et les suivre"},
    {id:"v51",icon:"💅",label:"Faire un contenu sur les soins ongles/mains"},
    {id:"v52",icon:"🧘",label:"Poster sur bien-être et beauté intérieure"},
    {id:"v53",icon:"🛁",label:"Créer un contenu rituel bain/détente avec tes produits"},
    {id:"v54",icon:"📦",label:"Filmer la préparation d'une commande cliente"},
    {id:"v55",icon:"🌍",label:"Poster sur l'engagement éco ou naturel de la marque"},
    {id:"v56",icon:"❤️",label:"Faire un post sur pourquoi tu as choisi ces produits"},
    {id:"v57",icon:"🎪",label:"Organiser un jeu concours (partage+follow)"},
    {id:"v58",icon:"💬",label:"Créer une FAQ beauté en carrousel"},
    {id:"v59",icon:"🌙",label:"Poster un contenu anti-âge ciblé"},
    {id:"v60",icon:"🏃",label:"Contacter les personnes inactives depuis 3 mois"},
    {id:"v61",icon:"🌸",label:"Faire un post sur les soins sensibles/peaux réactives"},
    {id:"v62",icon:"💡",label:"Créer un contenu mythe vs réalité beauté"},
    {id:"v63",icon:"🎥",label:"Filmer un tutoriel maquillage rapide"},
    {id:"v64",icon:"📱",label:"Mettre à jour ta bio Instagram avec ton lien diagnostic"},
    {id:"v65",icon:"🌿",label:"Poster sur les bienfaits des soins capillaires"},
    {id:"v66",icon:"✨",label:"Faire un post sur l'éclat de peau en 7 jours"},
    {id:"v67",icon:"💎",label:"Présenter la gamme premium en story"},
    {id:"v68",icon:"🛍️",label:"Créer un post \"idée cadeau sous 50€\""},
    {id:"v69",icon:"📊",label:"Faire un sondage sur le problème beauté n°1 de tes followers"},
    {id:"v70",icon:"🤳",label:"Poster une selfie naturelle avec un produit"},
    {id:"v71",icon:"🎁",label:"Offrir un échantillon à une nouvelle cliente"},
    {id:"v72",icon:"💰",label:"Calculer et partager ta marge sur une vente type"},
    {id:"v73",icon:"🌟",label:"Mettre en avant un produit méconnu de la gamme"},
    {id:"v74",icon:"📸",label:"Créer une série de 3 stories \"conseil du jour\""},
    {id:"v75",icon:"💆",label:"Poster sur les bienfaits du massage avec vos produits"},
    {id:"v76",icon:"🔑",label:"Partager 3 astuces pour maximiser l'efficacité d'un produit"},
    {id:"v77",icon:"🌺",label:"Créer un contenu saisonnier (été, hiver, rentrée...)"},
    {id:"v78",icon:"💬",label:"Réactiver une conversation DM en attente"},
    {id:"v79",icon:"📋",label:"Mettre à jour ta liste de produits favoris"},
    {id:"v80",icon:"🎯",label:"Identifier les 5 clientes avec le plus grand potentiel"},
    {id:"v81",icon:"🧴",label:"Comparer deux produits similaires de la gamme en story"},
    {id:"v82",icon:"💪",label:"Poster sur les résultats en 21 jours d'utilisation"},
    {id:"v83",icon:"🌈",label:"Créer un post coloré et vitaminé sur la gamme maquillage"},
    {id:"v84",icon:"🎬",label:"Faire un mini documentaire \"une journée avec mes produits\""},
    {id:"v85",icon:"🤝",label:"Proposer un appel découverte gratuit à 3 prospects"},
    {id:"v86",icon:"📌",label:"Créer un highlight Instagram dédié aux témoignages"},
    {id:"v87",icon:"💫",label:"Poster sur la transformation de ta peau depuis que tu utilises les produits"},
    {id:"v88",icon:"🌙",label:"Faire une story ASMR application produit"},
    {id:"v89",icon:"🎓",label:"Partager un fait méconnu sur un ingrédient clé"},
    {id:"v90",icon:"💝",label:"Envoyer un cadeau surprise à une cliente fidèle"},
    {id:"v91",icon:"📲",label:"Créer un carrousel \"erreurs beauté à éviter\""},
    {id:"v92",icon:"🌿",label:"Poster sur la composition naturelle de tes produits"},
    {id:"v93",icon:"🏆",label:"Célébrer une réussite cliente en story (avec permission)"},
    {id:"v94",icon:"🔥",label:"Lancer un défi beauté 7 jours avec tes clientes"},
    {id:"v95",icon:"💬",label:"Faire un Q&A en story sur tes produits"},
    {id:"v96",icon:"🌺",label:"Poster sur les soins corps en période hivernale"},
    {id:"v97",icon:"✨",label:"Créer un contenu sur les routines minimalistes"},
    {id:"v98",icon:"📦",label:"Faire un haul produits avec descriptions détaillées"},
    {id:"v99",icon:"💡",label:"Partager 5 façons d'utiliser un produit multi-usage"},
    {id:"v100",icon:"🎯",label:"Planifier tes 5 prochains posts de vente à l'avance"},
  ],
  recrutement: [
    {id:"r1",icon:"👥",label:"Partager ton témoignage sur ce que l'activité t'a apporté"},
    {id:"r2",icon:"💰",label:"Poster sur la liberté financière que tu vis"},
    {id:"r3",icon:"🌟",label:"Faire un post \"rejoins mon équipe\" authentique"},
    {id:"r4",icon:"📱",label:"Contacter 3 personnes qui ont montré de l'intérêt"},
    {id:"r5",icon:"🎥",label:"Faire un Reel sur ta journée type en tant que distributrice"},
    {id:"r6",icon:"💡",label:"Poster sur les avantages produits pour les distributrices"},
    {id:"r7",icon:"🤝",label:"Envoyer le lien de présentation à une contact qualifiée"},
    {id:"r8",icon:"🌸",label:"Partager les résultats de ta dernière période"},
    {id:"r9",icon:"📊",label:"Créer un post sur le plan de rémunération simplifié"},
    {id:"r10",icon:"🎯",label:"Identifier 5 profils potentiellement intéressés dans ta liste"},
    {id:"r11",icon:"💬",label:"Inviter une amie à découvrir l'activité autour d'un café"},
    {id:"r12",icon:"🏆",label:"Partager une victoire de ton équipe en story"},
    {id:"r13",icon:"✨",label:"Poster sur l'ambiance et l'esprit d'équipe Blazing Dynasty"},
    {id:"r14",icon:"🎓",label:"Expliquer la formation disponible pour les nouvelles"},
    {id:"r15",icon:"💪",label:"Faire un post sur ce que tu as appris depuis que tu as commencé"},
    {id:"r16",icon:"🌈",label:"Partager un post sur la diversité des profils dans ton équipe"},
    {id:"r17",icon:"📸",label:"Poster une photo de groupe avec ton équipe"},
    {id:"r18",icon:"🔑",label:"Expliquer le système de parrainage en story"},
    {id:"r19",icon:"💫",label:"Partager un témoignage d'une filleule sur sa progression"},
    {id:"r20",icon:"🎁",label:"Faire un post sur les cadeaux et bonus Mihi"},
    {id:"r21",icon:"🌍",label:"Poster sur la possibilité de travailler depuis n'importe où"},
    {id:"r22",icon:"⏰",label:"Faire un post sur la flexibilité des horaires"},
    {id:"r23",icon:"💌",label:"Envoyer un message personnalisé à une prospect recrutement"},
    {id:"r24",icon:"📋",label:"Préparer ton pitch de 2 minutes pour présenter l'activité"},
    {id:"r25",icon:"🎬",label:"Filmer un \"pourquoi j'ai dit oui\" sincère"},
    {id:"r26",icon:"💎",label:"Poster sur les incentives et voyages Mihi"},
    {id:"r27",icon:"🤳",label:"Faire une story sur tes objectifs du mois"},
    {id:"r28",icon:"🌺",label:"Partager un post sur l'épanouissement personnel dans l'activité"},
    {id:"r29",icon:"📱",label:"Partager ton lien diagnostic avec un angle recrutement"},
    {id:"r30",icon:"🏃",label:"Contacter une personne qui cherche un complément de revenus"},
    {id:"r31",icon:"💬",label:"Répondre à tous les commentaires sur ton post recrutement"},
    {id:"r32",icon:"🌟",label:"Faire un post sur les paliers et progression du plan"},
    {id:"r33",icon:"🎯",label:"Organiser une présentation en ligne pour 3-5 personnes"},
    {id:"r34",icon:"💡",label:"Créer un carrousel \"5 idées reçues sur le MLM\""},
    {id:"r35",icon:"🤝",label:"Faire un appel découverte avec une nouvelle prospect"},
    {id:"r36",icon:"📊",label:"Montrer concrètement combien tu as gagné ce mois"},
    {id:"r37",icon:"🎉",label:"Fêter l'anniversaire d'entrée d'une filleule en story"},
    {id:"r38",icon:"💰",label:"Poster sur les revenus passifs possibles avec l'équipe"},
    {id:"r39",icon:"🌸",label:"Partager comment l'activité a changé ta confiance en toi"},
    {id:"r40",icon:"📸",label:"Faire un before/after de ta vie avant/après l'activité"},
    {id:"r41",icon:"🎓",label:"Présenter la formation Fast Start en story"},
    {id:"r42",icon:"💪",label:"Montrer une journée productive avec ton activité Mihi"},
    {id:"r43",icon:"🌈",label:"Poster sur les possibilités d'évolution dans l'équipe"},
    {id:"r44",icon:"🔔",label:"Relancer les prospects recrutement inactifs depuis 2 semaines"},
    {id:"r45",icon:"✨",label:"Faire un post sur \"ma vie dans 1 an grâce à Mihi\""},
    {id:"r46",icon:"🎀",label:"Créer un kit de bienvenue digital pour tes nouvelles"},
    {id:"r47",icon:"💫",label:"Partager les formations et outils disponibles dans l'app"},
    {id:"r48",icon:"🏆",label:"Poster sur un objectif que tu as atteint grâce à l'activité"},
    {id:"r49",icon:"🌍",label:"Faire un post sur l'indépendance et l'entrepreneuriat féminin"},
    {id:"r50",icon:"💬",label:"Faire un sondage \"es-tu intéressée par un revenu complémentaire ?\""},
    {id:"r51",icon:"📲",label:"Créer un highlight Instagram \"rejoins l'équipe\""},
    {id:"r52",icon:"🌺",label:"Partager 3 choses que tu aurais aimé savoir avant de commencer"},
    {id:"r53",icon:"🎥",label:"Filmer une réunion d'équipe ou appel collectif"},
    {id:"r54",icon:"💡",label:"Créer un carrousel \"comment ça marche en 5 étapes\""},
    {id:"r55",icon:"🤝",label:"Présenter une filleule à tes abonnés"},
    {id:"r56",icon:"📋",label:"Écrire 3 objections courantes et tes réponses"},
    {id:"r57",icon:"💰",label:"Poster sur ce que tu as pu payer grâce à tes revenus Mihi"},
    {id:"r58",icon:"🌟",label:"Faire un post sur la communauté et le soutien entre membres"},
    {id:"r59",icon:"🎯",label:"Contacter 3 mamans à la maison dans ta liste"},
    {id:"r60",icon:"💎",label:"Partager les avantages exclusifs pour les chefs d'équipe"},
    {id:"r61",icon:"🌸",label:"Faire un post sur \"on peut commencer sans expérience\""},
    {id:"r62",icon:"📱",label:"Créer une story interactive sur l'activité"},
    {id:"r63",icon:"🏃",label:"Contacter une amie qui t'a déjà dit chercher quelque chose"},
    {id:"r64",icon:"💬",label:"Faire un live \"questions/réponses sur l'activité Mihi\""},
    {id:"r65",icon:"🌈",label:"Poster sur les valeurs de la marque et de l'équipe"},
    {id:"r66",icon:"📸",label:"Partager une photo de ton espace de travail"},
    {id:"r67",icon:"🎉",label:"Célébrer une nouvelle recrue en story"},
    {id:"r68",icon:"💪",label:"Faire un post sur la persévérance et les premiers mois"},
    {id:"r69",icon:"✨",label:"Partager ce qui te motive à continuer chaque jour"},
    {id:"r70",icon:"🎓",label:"Expliquer le rôle de cheffe d'équipe et ses avantages"},
    {id:"r71",icon:"🔑",label:"Partager ton lien de présentation dans ta bio"},
    {id:"r72",icon:"💫",label:"Faire un post sur les paliers atteints cette année"},
    {id:"r73",icon:"🌍",label:"Poster sur la possibilité de recruter en dehors de ta ville"},
    {id:"r74",icon:"💌",label:"Écrire une lettre ouverte \"pourquoi tu devrais rejoindre\""},
    {id:"r75",icon:"🏆",label:"Partager le résultat de ta meilleure période"},
    {id:"r76",icon:"🌺",label:"Faire un post sincère sur les difficultés et comment tu les surmontes"},
    {id:"r77",icon:"📊",label:"Créer une infographie simple sur le plan de rémunération"},
    {id:"r78",icon:"🤳",label:"Faire une story \"ce qui a tout changé pour moi\""},
    {id:"r79",icon:"💡",label:"Poster sur comment combiner Mihi avec un emploi salarié"},
    {id:"r80",icon:"🎯",label:"Envoyer le témoignage d'une filleule à une prospect"},
    {id:"r81",icon:"💬",label:"Créer un sondage sur les freins au démarrage d'une activité"},
    {id:"r82",icon:"🌟",label:"Faire un post sur l'impact de l'activité sur ta famille"},
    {id:"r83",icon:"🎀",label:"Préparer un kit de démarrage pour une nouvelle filleule"},
    {id:"r84",icon:"💰",label:"Calculer et partager le potentiel de revenus à 6 mois"},
    {id:"r85",icon:"🌸",label:"Poster sur les réseaux de femmes et la sororité"},
    {id:"r86",icon:"📲",label:"Contacter 5 personnes qui ont demandé \"comment tu fais\""},
    {id:"r87",icon:"🎥",label:"Faire un mini-reportage sur une journée avec tes filleules"},
    {id:"r88",icon:"💪",label:"Partager ta progression depuis ton lancement"},
    {id:"r89",icon:"✨",label:"Poster sur les reconnaissances et récompenses Mihi"},
    {id:"r90",icon:"🤝",label:"Planifier un appel de suivi avec une recrue récente"},
    {id:"r91",icon:"🌈",label:"Faire un post sur l'activité comme plan B devenu plan A"},
    {id:"r92",icon:"🎓",label:"Créer un mini guide \"commencer avec Mihi\" à partager"},
    {id:"r93",icon:"💎",label:"Partager les avantages produits dont tu bénéficies"},
    {id:"r94",icon:"🏃",label:"Contacter les amies qui ont aimé tes posts récents"},
    {id:"r95",icon:"📋",label:"Mettre à jour ta liste de prospects recrutement"},
    {id:"r96",icon:"💫",label:"Faire un post sur ce que l'activité t'a appris sur toi"},
    {id:"r97",icon:"🌺",label:"Partager les succès de ton équipe ce mois-ci"},
    {id:"r98",icon:"🎯",label:"Organiser un café virtuel recrutement avec 3 personnes"},
    {id:"r99",icon:"💬",label:"Répondre aux questions sur l'activité en story interactive"},
    {id:"r100",icon:"🏆",label:"Écrire et poster ta vision à 12 mois dans l'activité"},
  ],
  algorithme: [
    {id:"al1",icon:"⏰",label:"Poster à l'heure de pointe (7h, 12h ou 19h)"},
    {id:"al2",icon:"💬",label:"Commenter 20 posts de comptes similaires au tien"},
    {id:"al3",icon:"❤️",label:"Liker les 30 derniers posts de tes abonnés actifs"},
    {id:"al4",icon:"📊",label:"Analyser tes statistiques et noter le meilleur post de la semaine"},
    {id:"al5",icon:"🔁",label:"Repartager un contenu pertinent en story avec ton avis"},
    {id:"al6",icon:"📱",label:"Répondre à toutes tes stories reçues en DM"},
    {id:"al7",icon:"🎯",label:"Utiliser 10-15 hashtags ciblés sur ton prochain post"},
    {id:"al8",icon:"🌟",label:"Créer un carrousel (3-10 slides) — fort pour la portée"},
    {id:"al9",icon:"🎥",label:"Publier un Reel de 15-30 secondes dynamique"},
    {id:"al10",icon:"💡",label:"Poser une question ouverte dans ta légende de post"},
    {id:"al11",icon:"🤝",label:"Répondre à tous tes commentaires dans les 30 premières minutes"},
    {id:"al12",icon:"📸",label:"Publier une photo haute qualité avec lumière naturelle"},
    {id:"al13",icon:"🔔",label:"Activer tes notifications pour interagir rapidement"},
    {id:"al14",icon:"🌈",label:"Utiliser une palette de couleurs cohérente sur ton feed"},
    {id:"al15",icon:"📝",label:"Écrire une légende longue et engageante (300+ mots)"},
    {id:"al16",icon:"💫",label:"Créer un sondage en story pour maximiser les interactions"},
    {id:"al17",icon:"🎪",label:"Utiliser la fonction quiz en story"},
    {id:"al18",icon:"🌺",label:"Poster une story avec curseur de notation"},
    {id:"al19",icon:"💬",label:"Faire un \"question box\" en story"},
    {id:"al20",icon:"📌",label:"Épingler ton meilleur commentaire sur un post récent"},
    {id:"al21",icon:"🎬",label:"Faire un live et interagir en temps réel"},
    {id:"al22",icon:"🔗",label:"Mettre à jour le lien en bio avec un lien actuel"},
    {id:"al23",icon:"🌟",label:"Taguer des comptes pertinents dans tes posts (avec sens)"},
    {id:"al24",icon:"📲",label:"Utiliser la géolocalisation sur tes posts"},
    {id:"al25",icon:"🤳",label:"Faire une collab post avec un compte complémentaire"},
    {id:"al26",icon:"⚡",label:"Publier 2 stories minimum par jour"},
    {id:"al27",icon:"🌸",label:"Créer un highlight thématique et le mettre à jour"},
    {id:"al28",icon:"💡",label:"Utiliser les mots-clés dans ta bio Instagram"},
    {id:"al29",icon:"📊",label:"Vérifier tes heures de meilleure audience dans les stats"},
    {id:"al30",icon:"🎯",label:"Interagir pendant 15 min avant de publier ton post"},
    {id:"al31",icon:"💎",label:"Créer un contenu \"save-worthy\" (à sauvegarder)"},
    {id:"al32",icon:"🔥",label:"Créer un contenu \"share-worthy\" (à partager)"},
    {id:"al33",icon:"❤️",label:"Aller commenter les posts en tendance de ta niche"},
    {id:"al34",icon:"🌍",label:"Poster en story depuis un lieu avec géolocalisation"},
    {id:"al35",icon:"📱",label:"Répondre aux DM dans les 2h pour booster l'engagement"},
    {id:"al36",icon:"🎁",label:"Créer un contenu exclusif à partager uniquement en DM"},
    {id:"al37",icon:"🏆",label:"Analyser le contenu viral de ta niche et t'en inspirer"},
    {id:"al38",icon:"💬",label:"Demander à tes abonnés de taguer une amie dans un post"},
    {id:"al39",icon:"📸",label:"Faire un \"before/after\" — format très partagé"},
    {id:"al40",icon:"🎥",label:"Utiliser la tendance audio du moment pour ton Reel"},
    {id:"al41",icon:"✨",label:"Créer un filtre ou sticker de marque en story"},
    {id:"al42",icon:"🌺",label:"Partager un post de ta filleule avec ton commentaire"},
    {id:"al43",icon:"💫",label:"Faire un \"compte à rebours\" en story pour une annonce"},
    {id:"al44",icon:"🔑",label:"Créer un contenu \"liste\" numérotée — très engageant"},
    {id:"al45",icon:"📋",label:"Faire un \"Top 5\" ou \"Top 10\" dans ta niche"},
    {id:"al46",icon:"🌟",label:"Utiliser les sous-titres automatiques sur tes Reels"},
    {id:"al47",icon:"💪",label:"Poster tôt le matin (avant 8h) pour maximiser la portée"},
    {id:"al48",icon:"🎯",label:"Créer du contenu evergreen (intemporel et toujours utile)"},
    {id:"al49",icon:"🌈",label:"Alterner formats : photo, carrousel, Reel, story"},
    {id:"al50",icon:"📲",label:"Activer les sous-titres sur tous tes vidéos"},
    {id:"al51",icon:"💡",label:"Faire un \"mythe vs réalité\" dans ta niche"},
    {id:"al52",icon:"🤳",label:"Poster une selfie authentique et naturelle"},
    {id:"al53",icon:"🎬",label:"Utiliser des transitions créatives dans tes Reels"},
    {id:"al54",icon:"💬",label:"Répondre en vidéo à un commentaire pertinent"},
    {id:"al55",icon:"📊",label:"Faire un tableau ou infographie simple et lisible"},
    {id:"al56",icon:"🌸",label:"Partager un moment de coulisses (behind the scenes)"},
    {id:"al57",icon:"🎀",label:"Faire un \"wrap up\" hebdomadaire en story"},
    {id:"al58",icon:"💰",label:"Créer un contenu avec appel à l'action clair"},
    {id:"al59",icon:"🔔",label:"Demander à tes abonnés d'activer les notifications"},
    {id:"al60",icon:"🌍",label:"Participer à un challenge tendance de ta niche"},
    {id:"al61",icon:"✨",label:"Utiliser le texte animé dans tes stories"},
    {id:"al62",icon:"🏃",label:"Publier à la même heure chaque jour pour la régularité"},
    {id:"al63",icon:"💎",label:"Créer un contenu avec une promesse forte dans le titre"},
    {id:"al64",icon:"🤝",label:"Faire une mention partenaire avec une autre distributrice"},
    {id:"al65",icon:"📸",label:"Varier les angles de prise de vue (dessus, côté, gros plan)"},
    {id:"al66",icon:"🎯",label:"Utiliser des hashtags de niche (10-50k posts) pour la visibilité"},
    {id:"al67",icon:"💬",label:"Épingler une story de présentation de toi"},
    {id:"al68",icon:"🌺",label:"Faire un \"day in my life\" engageant"},
    {id:"al69",icon:"💡",label:"Poster sur un sujet controversé (positivement) de ta niche"},
    {id:"al70",icon:"📱",label:"Utiliser les stickers interactifs sur toutes tes stories"},
    {id:"al71",icon:"🎥",label:"Faire un Reel avec voix off pour plus d'authenticité"},
    {id:"al72",icon:"💫",label:"Créer une série de posts sur un même thème"},
    {id:"al73",icon:"🌟",label:"Optimiser ta bio avec des emojis et mots-clés"},
    {id:"al74",icon:"📊",label:"Tester 2 types de posts différents cette semaine"},
    {id:"al75",icon:"🎁",label:"Offrir un contenu gratuit pour les DM (PDF, guide...)"},
    {id:"al76",icon:"🔥",label:"Poster sur un sujet tendance dans ta niche"},
    {id:"al77",icon:"💬",label:"Commenter les posts des influenceurs de ta niche"},
    {id:"al78",icon:"🌸",label:"Créer un post avec beaucoup de texte pour le temps de lecture"},
    {id:"al79",icon:"❤️",label:"Faire une sélection de tes posts favoris en story"},
    {id:"al80",icon:"📸",label:"Utiliser la photo de profil comme accroche de story"},
    {id:"al81",icon:"🎯",label:"Répondre aux stories de tes abonnés pour créer du lien"},
    {id:"al82",icon:"💡",label:"Créer un post \"voici ce que j'aurais aimé savoir\""},
    {id:"al83",icon:"🏆",label:"Faire un post récapitulatif de ta semaine"},
    {id:"al84",icon:"🌈",label:"Utiliser des couleurs vives et contrastées pour attirer l'œil"},
    {id:"al85",icon:"📲",label:"Tester la fonction \"diffusion\" Instagram"},
    {id:"al86",icon:"💎",label:"Créer du contenu UGC (user generated content) avec clientes"},
    {id:"al87",icon:"🤳",label:"Faire un \"get ready with me\" dans ta niche"},
    {id:"al88",icon:"✨",label:"Utiliser les effets de lumière naturelle pour tes photos"},
    {id:"al89",icon:"🌺",label:"Poster un contenu inspirationnel qui donne envie d'agir"},
    {id:"al90",icon:"🎀",label:"Faire un \"thank you\" sincère à tes abonnés"},
    {id:"al91",icon:"💬",label:"Créer un post avec une liste de ressources utiles"},
    {id:"al92",icon:"📋",label:"Tester un nouveau format de contenu cette semaine"},
    {id:"al93",icon:"🌟",label:"Poster une citation motivante avec ta photo"},
    {id:"al94",icon:"💪",label:"Faire un contenu de \"preuve sociale\" (chiffres, résultats)"},
    {id:"al95",icon:"🎬",label:"Utiliser la musique tendance sur tes Reels"},
    {id:"al96",icon:"🔑",label:"Créer un post avec un titre accrocheur en première ligne"},
    {id:"al97",icon:"💫",label:"Utiliser la fonction \"close friends\" pour du contenu exclusif"},
    {id:"al98",icon:"🌍",label:"Poster sur l'impact positif de tes actions"},
    {id:"al99",icon:"🎯",label:"Analyser et reproduire ton post avec le plus d'engagement"},
    {id:"al100",icon:"🏃",label:"Maintenir un rythme de publication régulier pendant 21 jours"},
  ],
};

function BiblioActionsPopup({onClose, onAjouter, actionsCustom=[]}){
  const[cat,setCat]=useState("ventes");
  const[recherche,setRecherche]=useState("");
  const[actionsChef,setActionsChef]=useState([]);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","actions_biblio"));
        if(snap.exists()) setActionsChef(snap.data().items||[]);
      }catch{}
    })();
  },[]);

  const cats=[
    {id:"ventes",icon:"🛍️",label:"Ventes"},
    {id:"recrutement",icon:"👥",label:"Recrutement"},
    {id:"algorithme",icon:"⚡",label:"Algorithme"},
    {id:"equipe",icon:"✨",label:"Équipe"},
  ];

  const actionsEquipe=actionsChef.filter(a=>a.cat===cat||cat==="equipe"&&a.cat==="equipe");
  const actionsBase=ACTIONS_BIBLIO[cat]||[];
  const actions=cat==="equipe"?actionsEquipe:[...actionsBase,...actionsChef.filter(a=>a.cat===cat)];

  const filtrees=recherche.trim()
    ? [
        ...ACTIONS_BIBLIO.ventes,...ACTIONS_BIBLIO.recrutement,...ACTIONS_BIBLIO.algorithme,
        ...actionsChef
      ].filter(a=>a.label.toLowerCase().includes(recherche.toLowerCase()))
    : actions;

  const dejaAjoutee=(id)=>actionsCustom.some(a=>a.id===id);

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,31,14,.7)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:9999,padding:"0"}}>
      <div style={{background:C.blanc,borderRadius:"18px 18px 0 0",width:"100%",maxWidth:480,maxHeight:"85vh",display:"flex",flexDirection:"column",boxShadow:"0 -8px 40px rgba(0,0,0,.25)"}}>

        {/* Header */}
        <div style={{padding:"1.1rem 1.1rem .6rem",borderBottom:`1px solid ${C.pale}`,flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".7rem"}}>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,color:C.brun}}>💡 Bibliothèque d'actions</div>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:"1.2rem",color:C.gris,cursor:"pointer"}}>✕</button>
          </div>

          {/* Recherche */}
          <input value={recherche} onChange={e=>setRecherche(e.target.value)}
            placeholder="🔍 Rechercher une action..."
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:10,padding:".5rem .8rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".6rem"}}/>

          {/* Onglets catégories */}
          {!recherche&&(
            <div style={{display:"flex",gap:".3rem"}}>
              {cats.map(c=>(
                <button key={c.id} onClick={()=>setCat(c.id)}
                  style={{flex:1,padding:".4rem .2rem",fontSize:".68rem",fontWeight:700,border:"none",borderRadius:8,background:cat===c.id?C.brun:C.creme,color:cat===c.id?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Liste */}
        <div style={{overflowY:"auto",flex:1,padding:".6rem .8rem"}}>
          {filtrees.map(a=>{
            const ajoutee=dejaAjoutee(a.id);
            return(
              <div key={a.id} style={{display:"flex",alignItems:"center",gap:".6rem",padding:".55rem .6rem",borderRadius:10,marginBottom:".3rem",background:ajoutee?C.vert+"10":C.blanc,border:`1px solid ${ajoutee?C.vert+"40":C.pale}`}}>
                <span style={{fontSize:"1.1rem",flexShrink:0}}>{a.icon}</span>
                <div style={{flex:1,fontSize:".76rem",color:C.texte,lineHeight:1.4}}>{a.label}</div>
                <button onClick={()=>!ajoutee&&onAjouter(a)}
                  style={{background:ajoutee?C.vert:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".28rem .6rem",fontSize:".68rem",fontWeight:700,fontFamily:"inherit",cursor:ajoutee?"default":"pointer",flexShrink:0,transition:"all .2s"}}>
                  {ajoutee?"✓ Ajoutée":"+ Ajouter"}
                </button>
              </div>
            );
          })}
        </div>

        {actionsCustom.length>0&&(
          <div style={{padding:".6rem 1rem",borderTop:`1px solid ${C.pale}`,background:C.creme,flexShrink:0}}>
            <div style={{fontSize:".68rem",color:C.gris,textAlign:"center"}}>
              ✅ {actionsCustom.length} action{actionsCustom.length>1?"s":""} ajoutée{actionsCustom.length>1?"s":""} à ta journée
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TodoPerso({uid}){
  const[todos,setTodos]=useState([]);
  const[newTodo,setNewTodo]=useState("");
  const[adding,setAdding]=useState(false);
  const[saving,setSaving]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"users",uid));
        if(snap.exists()&&snap.data()["db-todos"]){
          setTodos(JSON.parse(snap.data()["db-todos"]));
        }
      }catch{}
    })();
  },[uid]);

  const saveTodos=async(next)=>{
    setTodos(next);
    try{await setDoc(doc(db,"users",uid),{"db-todos":JSON.stringify(next)},{merge:true});}catch{}
  };

  const addTodo=async()=>{
    if(!newTodo.trim())return;
    setSaving(true);
    const next=[...todos,{id:`t${Date.now()}`,text:newTodo.trim(),done:false}];
    await saveTodos(next);
    setNewTodo("");setAdding(false);setSaving(false);
  };

  const toggleTodo=(id)=>saveTodos(todos.map(t=>t.id===id?{...t,done:!t.done}:t));
  const delTodo=(id)=>saveTodos(todos.filter(t=>t.id!==id));

  const actives=todos.filter(t=>!t.done);
  const faits=todos.filter(t=>t.done);

  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:14,padding:"1rem",marginBottom:"1rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".65rem"}}>
        <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.brun}}>
          ✅ Ma to-do liste
        </div>
        <button onClick={()=>setAdding(!adding)}
          style={{background:adding?C.rose:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".25rem .65rem",fontSize:".68rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          {adding?"✕":"+ Ajouter"}
        </button>
      </div>

      {adding&&(
        <div style={{display:"flex",gap:".4rem",marginBottom:".65rem"}}>
          <input
            value={newTodo} onChange={e=>setNewTodo(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addTodo()}
            placeholder="Nouvelle tâche..."
            autoFocus
            style={{flex:1,border:`1px solid ${C.rose}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
          <button onClick={addTodo} disabled={!newTodo.trim()||saving}
            style={{background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".42rem .75rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
            ✓
          </button>
        </div>
      )}

      {actives.length===0&&!adding&&(
        <div style={{fontSize:".74rem",color:C.gris,textAlign:"center",padding:".5rem",fontStyle:"italic"}}>
          Aucune tâche — ajoute ta première ! 🎯
        </div>
      )}

      {actives.map(t=>(
        <div key={t.id} style={{display:"flex",alignItems:"center",gap:".55rem",padding:".45rem 0",borderBottom:`1px solid ${C.pale}`}}>
          <div onClick={()=>toggleTodo(t.id)}
            style={{width:20,height:20,borderRadius:5,border:`2px solid ${C.rose}`,background:"transparent",flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
          </div>
          <div style={{flex:1,fontSize:".8rem",color:C.texte,lineHeight:1.4}}>{t.text}</div>
          <button onClick={()=>delTodo(t.id)}
            style={{background:"none",border:"none",color:C.pale,cursor:"pointer",fontSize:".75rem",padding:".1rem .3rem",fontFamily:"inherit"}}>✕</button>
        </div>
      ))}

      {faits.length>0&&(
        <div style={{marginTop:".5rem"}}>
          <div style={{fontSize:".58rem",color:C.gris,marginBottom:".3rem",textTransform:"uppercase",letterSpacing:".08em"}}>Fait ✓</div>
          {faits.map(t=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",gap:".55rem",padding:".35rem 0",opacity:.5}}>
              <div onClick={()=>toggleTodo(t.id)}
                style={{width:20,height:20,borderRadius:5,border:`2px solid ${C.vert}`,background:C.vert,flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>
              </div>
              <div style={{flex:1,fontSize:".78rem",color:C.gris,textDecoration:"line-through"}}>{t.text}</div>
              <button onClick={()=>delTodo(t.id)}
                style={{background:"none",border:"none",color:C.pale,cursor:"pointer",fontSize:".75rem",padding:".1rem .3rem",fontFamily:"inherit"}}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── POPUP BIENVENUE (première connexion) ─────────────────────────────────────
function WelcomePopup({userName, onClose}){
  const prenom = userName.split(" ")[0] || userName;
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,31,14,.75)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:9999,padding:"0"}}>
      <div style={{background:C.blanc,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(0,0,0,.3)"}}>

        {/* Header */}
        <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,padding:"1.5rem 1.2rem 1.2rem",textAlign:"center"}}>
          <div style={{fontSize:"2.2rem",marginBottom:".4rem"}}>👑</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.3rem",fontWeight:300,color:C.blanc,lineHeight:1.3}}>
            Bienvenue {prenom} !
          </div>
          <div style={{fontFamily:"Georgia,serif",fontSize:".85rem",color:C.pale,marginTop:".3rem",fontStyle:"italic"}}>
            Tu fais maintenant partie de Blazing Dynasty ✨
          </div>
        </div>

        <div style={{padding:"1.2rem"}}>

          {/* Message équipe */}
          <div style={{background:C.creme,borderRadius:12,padding:".9rem 1rem",marginBottom:"1rem",borderLeft:`3px solid ${C.or}`}}>
            <div style={{fontSize:".72rem",color:C.brun,lineHeight:1.7}}>
              🌸 Nous sommes tellement heureuses de t'accueillir dans notre équipe. Tu as fait le bon choix — maintenant on est là pour t'accompagner à chaque étape. Let's go ! 💛
            </div>
          </div>

          {/* Telegram */}
          <div style={{background:C.lilas+"15",border:`1px solid ${C.lilas}30`,borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".78rem",fontWeight:700,color:C.brun,marginBottom:".5rem"}}>✈️ Nos groupes Telegram</div>
            <a href="https://t.me/+2wKWxIROE4c1M2Q0" target="_blank" rel="noopener noreferrer"
              style={{display:"flex",alignItems:"center",gap:".6rem",background:"#29A0D8",borderRadius:9,padding:".55rem .85rem",textDecoration:"none",marginBottom:".4rem"}}>
              <span style={{fontSize:"1rem"}}>🖼️</span>
              <div>
                <div style={{fontSize:".78rem",fontWeight:600,color:"white"}}>Banque d'images équipe</div>
                <div style={{fontSize:".62rem",color:"rgba(255,255,255,.75)"}}>Accède aux visuels de l'équipe</div>
              </div>
            </a>
            <a href="https://t.me/+pv0RY_JJy4wyYzE8" target="_blank" rel="noopener noreferrer"
              style={{display:"flex",alignItems:"center",gap:".6rem",background:"#29A0D8",borderRadius:9,padding:".55rem .85rem",textDecoration:"none"}}>
              <span style={{fontSize:"1rem"}}>⭐</span>
              <div>
                <div style={{fontSize:".78rem",fontWeight:600,color:"white"}}>Groupe témoignages</div>
                <div style={{fontSize:".62rem",color:"rgba(255,255,255,.75)"}}>Découvre les résultats de l'équipe</div>
              </div>
            </a>
          </div>

          {/* Tes 2 premiers accès */}
          <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.gris,marginBottom:".5rem"}}>
            🔓 Tes accès du moment
          </div>

          <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:12,padding:".85rem 1rem",marginBottom:".5rem",display:"flex",alignItems:"center",gap:".75rem"}}>
            <div style={{fontSize:"1.4rem",flexShrink:0}}>🚀</div>
            <div>
              <div style={{fontSize:".82rem",fontWeight:700,color:C.blanc}}>Fast Start</div>
              <div style={{fontSize:".68rem",color:C.pale}}>7 modules progressifs pour bien démarrer — commence par là !</div>
            </div>
          </div>

          <div style={{background:C.lilas+"15",border:`1px solid ${C.lilas}30`,borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem",display:"flex",alignItems:"center",gap:".75rem"}}>
            <div style={{fontSize:"1.4rem",flexShrink:0}}>🎬</div>
            <div>
              <div style={{fontSize:".82rem",fontWeight:700,color:C.brun}}>Formation Application</div>
              <div style={{fontSize:".68rem",color:C.gris}}>Apprends à utiliser l'appli pour te faciliter la vie</div>
            </div>
          </div>

          {/* Bandeau déverrouillage */}
          <div style={{background:C.or+"20",border:`1px solid ${C.or}`,borderRadius:10,padding:".65rem .85rem",marginBottom:"1.2rem",display:"flex",alignItems:"center",gap:".5rem"}}>
            <span style={{fontSize:"1rem"}}>🔒</span>
            <div style={{fontSize:".7rem",color:C.brun,lineHeight:1.5}}>
              <strong>Le reste de la formation</strong> se débloque automatiquement quand tu auras terminé tes 7 modules Fast Start 🎉
            </div>
          </div>

          <button onClick={onClose}
            style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:12,padding:".8rem",fontSize:".88rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
            Commencer le Fast Start 🚀
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CLASSEMENT PERMANENT VENTES & RECRUTEMENT ────────────────────────────────
function CmdPeriodeBlock({cmdPeriode}){
  const info=getPeriodeInfo();
  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem",display:"flex",alignItems:"center",gap:".75rem"}}>
      <div style={{width:38,height:38,borderRadius:"50%",background:C.rose+"20",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"1.2rem"}}>🛍️</div>
      <div style={{flex:1}}>
        <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.gris,marginBottom:".15rem"}}>{fmtPLabel(info.periodNum)}</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:700,color:C.brun}}>
          {cmdPeriode.count} commande{cmdPeriode.count>1?"s":""}
          {cmdPeriode.montant>0&&<span style={{fontSize:".75rem",fontWeight:400,color:C.gris}}> · {cmdPeriode.montant}€</span>}
        </div>
      </div>
      <div style={{textAlign:"right",fontSize:".62rem",color:C.gris}}>Se remet à 0<br/>en fin de période</div>
    </div>
  );
}

function ClassementEquipe({uid}){
  const[data,setData]=useState([]);
  const[lastData,setLastData]=useState({});
  const[loading,setLoading]=useState(true);
  const[onglet,setOnglet]=useState("ventes"); // ventes | recrues | progression
  const[lastUpdate,setLastUpdate]=useState(null);

  const charger=async()=>{
    try{
      const annSnap=await getDoc(doc(db,"equipe","annuaire"));
      if(!annSnap.exists()){setLoading(false);return;}
      const membres=annSnap.data().membres||{};

      // Données fraîches du membre courant
      const meSnap=await getDoc(doc(db,"users",uid));
      const meData=meSnap.exists()&&meSnap.data()["db-obj-perso"]?JSON.parse(meSnap.data()["db-obj-perso"]):{};

      // Historique période précédente pour la progression
      const prevPeriode=getPeriodeActuelle()-1;
      const prevKey=`hist_p${prevPeriode}`;

      const valides=Object.entries(membres).map(([mUid,m])=>{
        const isMe=mUid===uid;
        const caPerso=isMe?parseFloat(meData.caPerso)||0:parseFloat(m.caPerso)||0;
        const ca=isMe?parseFloat(meData.ca)||0:parseFloat(m.ca)||0;
        const recrues=isMe?parseInt(meData.recruesReal)||0:parseInt(m.recruesReal)||0;
        const prevCaPerso=parseFloat(m[prevKey+"_caPerso"])||0;
        const prevRecrues=parseInt(m[prevKey+"_recrues"])||0;
        const progVentes=caPerso-prevCaPerso;
        const progRecrues=recrues-prevRecrues;
        const scoreProgression=progVentes+(progRecrues*50);
        return{uid:mUid,prenom:m.prenom||mUid.split("-")[0],caPerso,ca,recrues,progVentes,progRecrues,scoreProgression};
      }).filter(m=>m.ca>0||m.caPerso>0||m.recrues>0||m.uid===uid);
      // Sauvegarder positions précédentes pour les flèches
      const prev=JSON.parse(localStorage.getItem("bd-classement-prev")||"{}");
      setLastData(prev);
      const newPrev={};
      [...valides].sort((a,b)=>b.caPerso-a.caPerso).forEach((m,i)=>{newPrev[m.uid]={v:i,r:[...valides].sort((a,b)=>b.recrues-a.recrues).findIndex(x=>x.uid===m.uid),p:[...valides].sort((a,b)=>b.scoreProgression-a.scoreProgression).findIndex(x=>x.uid===m.uid)};});
      localStorage.setItem("bd-classement-prev",JSON.stringify(newPrev));
      setData(valides);
      setLastUpdate(new Date());
    }catch(e){console.error(e);}
    setLoading(false);
  };

  useEffect(()=>{
    charger();
    const t=setInterval(charger,3*60*1000);
    // Rafraîchir aussi quand la page reprend le focus
    const onFocus=()=>charger();
    window.addEventListener('focus',onFocus);
    return()=>{clearInterval(t);window.removeEventListener('focus',onFocus);};
  },[uid]);

  if(loading)return null;

  const onglets=[
    {id:"ventes",label:"🛍️ Ventes perso",sortKey:"caPerso",unit:"€"},
    {id:"equipe",label:"👥 Équipe",sortKey:"ca",unit:"€"},
    {id:"recrues",label:"🤝 Recrues",sortKey:"recrues",unit:""},
    {id:"progression",label:"📈 Progression",sortKey:"scoreProgression",unit:""},
  ];
  // Filtre 100€ perso seulement pour l'onglet Équipe
  const filtreMin = onglet==="equipe" ? (m)=>m.caPerso>=100||m.uid===uid : ()=>true;
  const currentOnglet=onglets.find(o=>o.id===onglet)||onglets[0];
  const sorted=[...data].filter(filtreMin).sort((a,b)=>b[currentOnglet.sortKey]-a[currentOnglet.sortKey]);
  const medals=["🥇","🥈","🥉"];
  const timeStr=lastUpdate?`${lastUpdate.getHours()}h${String(lastUpdate.getMinutes()).padStart(2,"0")}`:"";

  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:".75rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".75rem"}}>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,color:C.brun}}>🏆 Classement équipe</div>
        <button onClick={charger} title="Rafraîchir"
          style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:7,padding:".2rem .4rem",fontSize:".65rem",color:C.gris,cursor:"pointer",fontFamily:"inherit"}}>🔄</button>
      </div>

      {/* Onglets */}
      <div style={{display:"flex",gap:".25rem",marginBottom:".75rem",overflowX:"auto"}}>
        {onglets.map(o=>(
          <button key={o.id} onClick={()=>setOnglet(o.id)}
            style={{flexShrink:0,padding:".3rem .55rem",fontSize:".63rem",fontWeight:600,borderRadius:9,border:`1.5px solid ${onglet===o.id?C.rose:C.pale}`,background:onglet===o.id?C.rose:C.blanc,color:onglet===o.id?"white":C.gris,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
            {o.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {sorted.length===0&&<div style={{textAlign:"center",fontSize:".72rem",color:C.gris,padding:".5rem"}}>Aucune donnée pour l'instant</div>}
      {sorted.map((m,i)=>{
        const isMe=m.uid===uid;
        const prevPos=lastData[m.uid];
        const curIdx=i;
        const prevIdx=currentOnglet.id==="ventes"?prevPos?.v:currentOnglet.id==="recrues"?prevPos?.r:prevPos?.p;
        const tendance=prevIdx==null?"→":prevIdx>curIdx?"⬆️":prevIdx<curIdx?"⬇️":"→";

        let valPrimary, valSecondary;
        if(onglet==="ventes"){
          valPrimary=`${m.caPerso}€`;
          valSecondary=m.progVentes!==0?`${m.progVentes>=0?"+":""}${m.progVentes}€ vs P préc.`:null;
        } else if(onglet==="equipe"){
          valPrimary=`${m.ca}€`;
          valSecondary=m.caPerso>=100?`dont ${m.caPerso}€ perso`:null;
        } else if(onglet==="recrues"){
          valPrimary=`${m.recrues} recrue${m.recrues>1?"s":""}`;
          valSecondary=m.progRecrues!==0?`${m.progRecrues>=0?"+":""}${m.progRecrues} vs P préc.`:null;
        } else {
          valPrimary=`${m.progVentes>=0?"+":""}${m.progVentes}€ · ${m.progRecrues>=0?"+":""}${m.progRecrues} rec.`;
          valSecondary=null;
        }

        return(
          <div key={m.uid} style={{display:"flex",alignItems:"center",gap:".5rem",padding:".45rem .5rem",borderRadius:9,background:isMe?C.rose+"08":"transparent",marginBottom:".2rem",border:isMe?`1px solid ${C.rose}30`:"none"}}>
            <div style={{width:26,textAlign:"center",fontSize:i<3?"1rem":".7rem",flexShrink:0}}>
              {i<3?medals[i]:`${i+1}.`}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:".78rem",fontWeight:isMe?700:500,color:isMe?C.rose:C.texte}}>{m.prenom}{isMe?" (moi)":""}</div>
              {valSecondary&&<div style={{fontSize:".6rem",color:C.vert}}>{valSecondary}</div>}
            </div>
            <div style={{fontSize:".7rem",color:C.gris,flexShrink:0}}>{tendance}</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:".85rem",fontWeight:700,color:isMe?C.rose:C.brun,flexShrink:0,textAlign:"right"}}>{valPrimary}</div>
          </div>
        );
      })}

      <div style={{fontSize:".55rem",color:C.pale,textAlign:"right",marginTop:".4rem"}}>
        {timeStr?`Màj ${timeStr} · `:""}Rafraîchi auto toutes les 3min
      </div>
    </div>
  );
}

const THEMES_LINKBIO=[
  {id:"elegance",label:"Élégance",bg:"linear-gradient(135deg,#3D1F0E,#5C3020)",header:"linear-gradient(135deg,#3D1F0E,#5C3020)",accent:"#C4A882",text:"white",btnPrimary:"#C49A8A",btnSecondary:"white",btnTertiary:"#3D1F0E",cardBg:"white",preview:"🤎"},
  {id:"rose_gold",label:"Rose Gold",bg:"linear-gradient(135deg,#F9E5E0,#F2C4BB)",header:"linear-gradient(135deg,#C49A8A,#A0716A)",accent:"#C49A8A",text:"white",btnPrimary:"#C49A8A",btnSecondary:"white",btnTertiary:"#5C3020",cardBg:"#FFF5F3",preview:"🌸"},
  {id:"nuit",label:"Nuit Étoilée",bg:"linear-gradient(135deg,#0D0D2B,#1A1A4E)",header:"linear-gradient(135deg,#0D0D2B,#1A1A4E)",accent:"#A89BB5",text:"white",btnPrimary:"#A89BB5",btnSecondary:"rgba(255,255,255,.9)",btnTertiary:"#0D0D2B",cardBg:"#12122E",preview:"🌙"},
  {id:"or_noir",label:"Or & Noir",bg:"#0A0A0A",header:"linear-gradient(135deg,#1A1A1A,#2D2D2D)",accent:"#C4A832",text:"white",btnPrimary:"#C4A832",btnSecondary:"white",btnTertiary:"#1A1A1A",cardBg:"#141414",preview:"⚫"},
  {id:"nature",label:"Nature & Vert",bg:"linear-gradient(135deg,#E8F5E9,#C8E6C9)",header:"linear-gradient(135deg,#2E7D32,#388E3C)",accent:"#2E7D32",text:"white",btnPrimary:"#4CAF50",btnSecondary:"white",btnTertiary:"#1B5E20",cardBg:"white",preview:"🌿"},
  {id:"lavande",label:"Lavande",bg:"linear-gradient(135deg,#EDE7F6,#D1C4E9)",header:"linear-gradient(135deg,#7E57C2,#9575CD)",accent:"#7E57C2",text:"white",btnPrimary:"#9575CD",btnSecondary:"white",btnTertiary:"#4527A0",cardBg:"white",preview:"💜"},
  {id:"soleil",label:"Soleil d'Été",bg:"linear-gradient(135deg,#FFF8E1,#FFF3CD)",header:"linear-gradient(135deg,#F57F17,#F9A825)",accent:"#F57F17",text:"white",btnPrimary:"#FF8F00",btnSecondary:"white",btnTertiary:"#E65100",cardBg:"white",preview:"☀️"},
  {id:"ocean",label:"Océan",bg:"linear-gradient(135deg,#E3F2FD,#BBDEFB)",header:"linear-gradient(135deg,#1565C0,#1976D2)",accent:"#1565C0",text:"white",btnPrimary:"#1976D2",btnSecondary:"white",btnTertiary:"#0D47A1",cardBg:"white",preview:"🌊"},
  {id:"corail",label:"Corail & Blanc",bg:"#FFF9F7",header:"linear-gradient(135deg,#FF6B6B,#FF8E8E)",accent:"#FF6B6B",text:"white",btnPrimary:"#FF6B6B",btnSecondary:"white",btnTertiary:"#C62828",cardBg:"white",preview:"🪸"},
  {id:"minimaliste",label:"Minimaliste",bg:"#FAFAFA",header:"linear-gradient(135deg,#212121,#424242)",accent:"#212121",text:"white",btnPrimary:"#212121",btnSecondary:"white",btnTertiary:"#000",cardBg:"white",preview:"⬛"},
];

// ── TUNNEL DE VENTE & RECRUTEMENT ────────────────────────────────────────────
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

function LinkBioTab({uid, userName}){
  const[profil,setProfil]=useState({
    prenom:"",slogan:"",histoire:"",photo:"",theme:"elegance",
    accroche:"",nbClientes:"",nbDiags:"",nbEquipe:"",nbAnnees:"",
    ctaLabel:"✨ Faire mon diagnostic gratuit",ctaUrl:"",
    urgence:"",banniere:"",banniereUrl:"",badge:"",
    lienBoutique:"",lienRecrutement:"",lienDiag:"",
    liensBonusLabel:[],liensBonusUrl:[],liensBonusPhoto:[],
    photos:[],temoignages:[],produitsStar:[],faq:[],
    diagChoisis:["parfum","skincare","silhouette","sante"],
    showBanniere:true,
    bannierePersoBg:"",bannierePersoTexte:"",bannierePersoLien:"",bannierePersoActif:false,
  });
  const[banniereGlobale,setBanniereGlobale]=useState(null);
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);
  const[loading,setLoading]=useState(true);
  const[copied,setCopied]=useState(false);
  const[activeSection,setActiveSection]=useState("theme"); // theme|profil|liens|banniere|photos

  const slug=(userName||uid).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"-");
  const bioUrl=`https://blazing-dinasty-1fad9.web.app?bio=${slug}`;
  const tunnelUrl=`https://blazing-dinasty-1fad9.web.app?tunnel=${slug}`;
  const theme=THEMES_LINKBIO.find(t=>t.id===profil.theme)||THEMES_LINKBIO[0];

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"linkbio",uid));
        if(snap.exists()) setProfil(p=>({...p,...snap.data()}));
      }catch{}
      try{
        const bSnap=await getDoc(doc(db,"admin","linkbio_banniere"));
        if(bSnap.exists()) setBanniereGlobale(bSnap.data());
      }catch{}
      setLoading(false);
    })();
  },[uid]);

  const save=async()=>{
    setSaving(true);
    try{
      await setDoc(doc(db,"linkbio",uid),{...profil,uid,slug,updatedAt:Date.now()});
      setSaved(true);setTimeout(()=>setSaved(false),2500);
    }catch{}
    setSaving(false);
  };

  const copyUrl=()=>{navigator.clipboard?.writeText(bioUrl);setCopied(true);setTimeout(()=>setCopied(false),2000);};

  const addLienBonus=()=>{
    setProfil(p=>({...p,
      liensBonusLabel:[...(p.liensBonusLabel||[]),""],
      liensBonusUrl:[...(p.liensBonusUrl||[]),""],
      liensBonusPhoto:[...(p.liensBonusPhoto||[]),""],
    }));
  };
  const removeLienBonus=(i)=>{
    setProfil(p=>({...p,
      liensBonusLabel:(p.liensBonusLabel||[]).filter((_,j)=>j!==i),
      liensBonusUrl:(p.liensBonusUrl||[]).filter((_,j)=>j!==i),
      liensBonusPhoto:(p.liensBonusPhoto||[]).filter((_,j)=>j!==i),
    }));
  };

  if(loading)return null;

  const SECTIONS=[
    {id:"theme",icon:"🎨",label:"Thème"},
    {id:"profil",icon:"✨",label:"Profil"},
    {id:"liens",icon:"🔗",label:"Liens"},
    {id:"photos",icon:"📸",label:"Photos"},
    {id:"banniere",icon:"📢",label:"Bannière"},
  ];

  // Prévisualisation
  const Preview=({bg=banniereGlobale})=>(
    <div style={{background:theme.bg,borderRadius:14,overflow:"hidden",maxWidth:300,margin:"0 auto",boxShadow:"0 4px 24px rgba(0,0,0,.12)"}}>
      {/* Bannière */}
      {((bg?.actif&&bg?.texte&&profil.showBanniere)||(profil.bannierePersoActif&&profil.bannierePersoTexte))&&(
        <div style={{background:profil.bannierePersoBg||(profil.bannierePersoActif&&profil.bannierePersoTexte?undefined:bg?.couleur)||theme.btnPrimary,padding:".5rem .75rem",textAlign:"center",fontSize:".7rem",fontWeight:600,color:"white",whiteSpace:"pre-line"}}>
          {profil.bannierePersoActif&&profil.bannierePersoTexte ? profil.bannierePersoTexte : bg?.texte}
        </div>
      )}

      {/* Header */}
      <div style={{background:theme.header,padding:"1.5rem 1rem",textAlign:"center"}}>
        {profil.photo
          ?<img src={profil.photo} alt="" style={{width:72,height:72,borderRadius:"50%",objectFit:"cover",border:"3px solid rgba(255,255,255,.25)",marginBottom:".6rem",display:"block",margin:"0 auto .6rem"}}/>
          :<div style={{width:72,height:72,borderRadius:"50%",background:"rgba(255,255,255,.2)",margin:"0 auto .6rem",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.8rem",fontFamily:"Georgia,serif",color:"white",fontWeight:600}}>
            {(profil.prenom||userName||"B")[0].toUpperCase()}
          </div>
        }
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",fontWeight:600,color:theme.text}}>{profil.prenom||userName}</div>
        {profil.slogan&&<div style={{fontSize:".65rem",color:"rgba(255,255,255,.75)",marginTop:".2rem",lineHeight:1.5}}>{profil.slogan}</div>}
      </div>

      {profil.histoire&&<div style={{padding:".75rem 1rem",fontSize:".72rem",lineHeight:1.65,color:theme.id==="nuit"||theme.id==="or_noir"?"rgba(255,255,255,.75)":C.gris,background:theme.cardBg}}>{profil.histoire}</div>}

      {/* Photos */}
      {(profil.photos||[]).filter(p=>p).length>0&&(
        <div style={{display:"flex",gap:".3rem",padding:".5rem .75rem",overflowX:"auto",background:theme.cardBg}}>
          {profil.photos.filter(p=>p).map((url,i)=>(
            <img key={i} src={url} alt="" style={{width:68,height:68,borderRadius:8,objectFit:"cover",flexShrink:0}}/>
          ))}
        </div>
      )}

      {/* Liens */}
      <div style={{padding:"0 .75rem",display:"flex",flexDirection:"column",gap:".4rem"}}>
        {(profil.liensBonusLabel||[]).map((lbl,i)=>lbl&&profil.liensBonusUrl?.[i]&&(
          <a key={i} href={profil.liensBonusUrl[i]} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:".5rem",background:theme.accent+"15",border:`1.5px solid ${theme.accent}30`,borderRadius:10,padding:".45rem .75rem",textDecoration:"none"}}>
            {profil.liensBonusPhoto?.[i]&&<img src={profil.liensBonusPhoto[i]} alt="" style={{width:30,height:30,borderRadius:6,objectFit:"cover",flexShrink:0}}/>}
            <span style={{fontSize:".75rem",fontWeight:600,color:theme.accent}}>{lbl}</span>
          </a>
        ))}
      </div>
      <div style={{padding:".4rem",textAlign:"center",fontSize:".55rem",color:theme.accent,background:theme.cardBg}}>Blazing Dynasty × Mihi</div>
    </div>
  );

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Mon <em style={{fontStyle:"italic",color:C.rose}}>Link-in-Bio</em>
      </div>

      {/* Lien à copier */}
      <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem",display:"flex",alignItems:"center",gap:".75rem"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:".55rem",fontWeight:700,letterSpacing:".1em",color:C.or,textTransform:"uppercase",marginBottom:".2rem"}}>🔗 Ton lien de bio</div>
          <div style={{fontSize:".68rem",color:C.pale,wordBreak:"break-all"}}>{bioUrl}</div>
        </div>
        <button onClick={copyUrl} style={{background:C.or,color:C.brun,border:"none",borderRadius:8,padding:".38rem .7rem",fontSize:".7rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer",flexShrink:0}}>
          {copied?"✓ Copié!":"📋 Copier"}
        </button>
      </div>

      {/* Navigation sections */}
      <div style={{display:"flex",gap:".3rem",marginBottom:"1rem",overflowX:"auto",paddingBottom:".2rem"}}>
        {SECTIONS.map(s=>(
          <button key={s.id} onClick={()=>setActiveSection(s.id)}
            style={{flexShrink:0,padding:".38rem .65rem",fontSize:".68rem",fontWeight:600,borderRadius:9,border:`1.5px solid ${activeSection===s.id?C.rose:C.pale}`,background:activeSection===s.id?C.rose:C.blanc,color:activeSection===s.id?"white":C.gris,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* SECTION THÈME */}
      {activeSection==="theme"&&(
        <div>
          <div style={{fontSize:".6rem",fontWeight:700,color:C.gris,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".6rem"}}>Choisis ton thème</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:".4rem",marginBottom:"1rem"}}>
            {THEMES_LINKBIO.map(t=>(
              <div key={t.id} onClick={()=>setProfil(p=>({...p,theme:t.id}))}
                style={{textAlign:"center",cursor:"pointer",padding:".4rem .2rem",borderRadius:10,border:`2px solid ${profil.theme===t.id?C.rose:C.pale}`,background:profil.theme===t.id?C.rose+"10":"transparent",transition:"all .15s"}}>
                <div style={{fontSize:"1.4rem"}}>{t.preview}</div>
                <div style={{fontSize:".55rem",fontWeight:600,color:profil.theme===t.id?C.rose:C.gris,marginTop:".2rem",lineHeight:1.2}}>{t.label}</div>
              </div>
            ))}
          </div>
          <Preview/>
        </div>
      )}

      {/* SECTION PROFIL */}
      {activeSection==="profil"&&(
        <div>
          <div style={{fontSize:".6rem",fontWeight:700,color:C.gris,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".6rem"}}>Ton profil</div>
          {[
            {label:"Prénom affiché",key:"prenom",placeholder:"Ex: Melissa"},
            {label:"Phrase d'accroche",key:"slogan",placeholder:"Ex: Maman entrepreneur 🌸"},
          ].map(f=>(
            <div key={f.key} style={{marginBottom:".6rem"}}>
              <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>{f.label}</div>
              <input value={profil[f.key]||""} onChange={e=>setProfil(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder}
                style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
            </div>
          ))}
          <UploadPhoto label="Photo de profil" value={profil.photo} onChange={v=>setProfil(p=>({...p,photo:v}))} folder="linkbio"/>
          <div style={{marginBottom:".6rem"}}>
            <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>Mon histoire</div>
            <textarea value={profil.histoire||""} onChange={e=>setProfil(p=>({...p,histoire:e.target.value}))} placeholder="2-3 phrases : qui tu es, pourquoi Mihi..." rows={3}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",resize:"vertical",lineHeight:1.55}}/>
          </div>

          {/* Accroche forte */}
          <div style={{marginBottom:".6rem"}}>
            <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>💬 Citation / Accroche forte</div>
            <input value={profil.accroche||""} onChange={e=>setProfil(p=>({...p,accroche:e.target.value}))} placeholder="Ex: J'ai retrouvé confiance en moi grâce à Mihi"
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
          </div>

          {/* Stats chiffrées */}
          <div style={{fontSize:".6rem",color:C.gris,marginBottom:".3rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>📊 Chiffres clés (social proof)</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".35rem",marginBottom:".6rem"}}>
            {[
              {key:"nbClientes",placeholder:"Ex: 48 clientes"},
              {key:"nbDiags",placeholder:"Ex: 120 diags"},
              {key:"nbEquipe",placeholder:"Ex: 12 dans l'équipe"},
              {key:"nbAnnees",placeholder:"Ex: 2 ans d'exp."},
            ].map(f=>(
              <input key={f.key} value={profil[f.key]||""} onChange={e=>setProfil(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder}
                style={{border:`1px solid ${C.pale}`,borderRadius:7,padding:".35rem .5rem",fontSize:".72rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
            ))}
          </div>

          {/* CTA Principal */}
          <div style={{fontSize:".6rem",color:C.rose,marginBottom:".3rem",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em"}}>🎯 Bouton d'appel à l'action principal</div>
          <input value={profil.ctaLabel||""} onChange={e=>setProfil(p=>({...p,ctaLabel:e.target.value}))} placeholder="Ex: ✨ Faire mon diagnostic gratuit"
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".35rem"}}/>
          <input value={profil.ctaUrl||""} onChange={e=>setProfil(p=>({...p,ctaUrl:e.target.value}))} placeholder="URL du CTA (lien diagnostic par défaut)"
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".6rem"}}/>

          {/* Urgence */}
          <div style={{fontSize:".6rem",color:C.or,marginBottom:".2rem",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em"}}>⏰ Message d'urgence (optionnel)</div>
          <input value={profil.urgence||""} onChange={e=>setProfil(p=>({...p,urgence:e.target.value}))} placeholder="Ex: Offre limitée — seulement 5 places cette semaine"
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".6rem"}}/>

          {/* Témoignages */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".35rem"}}>
            
          {/* ── Choix des diagnostics ── */}
          <div style={{marginBottom:".75rem",padding:".75rem",background:C.creme,borderRadius:10,border:`1px solid ${C.pale}`}}>
            <div style={{fontSize:".6rem",color:C.gris,marginBottom:".5rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>🩺 Diagnostics affichés sur ton LinkBio</div>
            {[
              {id:"parfum",label:"🌸 Diagnostic Parfum"},
              {id:"skincare",label:"✨ Diagnostic Skincare"},
              {id:"silhouette",label:"⚖️ Diagnostic Silhouette"},
              {id:"sante",label:"💚 Diagnostic Bien-être"},
              {id:"cheveux",label:"💇 Diagnostic Cheveux"},
              {id:"makeup",label:"💄 Diagnostic Makeup"},
              {id:"recrutement",label:"👑 Diagnostic Opportunité"},
              {id:"blocage",label:"👩‍👧 Diagnostic Maman Entrepreneur"},
            ].map(d=>{
              const checked=(profil.diagChoisis||["parfum","skincare","silhouette","sante"]).includes(d.id);
              return(<label key={d.id} style={{display:"flex",alignItems:"center",gap:".5rem",padding:".3rem 0",cursor:"pointer",fontSize:".78rem",color:C.texte}}>
                <input type="checkbox" checked={checked} onChange={()=>{
                  const current=profil.diagChoisis||["parfum","skincare","silhouette","sante"];
                  const next=checked?current.filter(x=>x!==d.id):[...current,d.id];
                  setProfil(p=>({...p,diagChoisis:next}));
                }} style={{accentColor:C.rose,width:15,height:15}}/>
                {d.label}
              </label>);
            })}
          </div>

          <div style={{fontSize:".6rem",color:C.gris,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em"}}>💬 Témoignages clientes</div>
            <button onClick={()=>setProfil(p=>({...p,temoignages:[...(p.temoignages||[]),{texte:"",auteur:""}]}))}
              style={{background:C.brun,color:"white",border:"none",borderRadius:7,padding:".22rem .55rem",fontSize:".65rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>+ Ajouter</button>
          </div>
          {(profil.temoignages||[]).map((t,i)=>(
            <div key={i} style={{background:C.creme,borderRadius:9,padding:".55rem",marginBottom:".35rem",border:`1px solid ${C.pale}`}}>
              <textarea value={t.texte} onChange={e=>{const a=[...(profil.temoignages||[])];a[i]={...a[i],texte:e.target.value};setProfil(p=>({...p,temoignages:a}));}}
                placeholder="Texte du témoignage" rows={2}
                style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:7,padding:".3rem .5rem",fontSize:".72rem",fontFamily:"inherit",color:C.texte,background:"white",outline:"none",resize:"none",marginBottom:".3rem"}}/>
              <div style={{display:"flex",gap:".3rem"}}>
                <input value={t.auteur} onChange={e=>{const a=[...(profil.temoignages||[])];a[i]={...a[i],auteur:e.target.value};setProfil(p=>({...p,temoignages:a}));}}
                  placeholder="Prénom de la cliente" style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:7,padding:".28rem .5rem",fontSize:".7rem",fontFamily:"inherit",color:C.texte,background:"white",outline:"none"}}/>
                <button onClick={()=>setProfil(p=>({...p,temoignages:(p.temoignages||[]).filter((_,j)=>j!==i)}))}
                  style={{background:"none",border:"none",color:C.gris,cursor:"pointer",fontSize:".75rem"}}>✕</button>
              </div>
            </div>
          ))}

          {/* FAQ */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".35rem",marginTop:".6rem"}}>
            <div style={{fontSize:".6rem",color:C.gris,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em"}}>❓ FAQ</div>
            <button onClick={()=>setProfil(p=>({...p,faq:[...(p.faq||[]),{q:"",a:""}]}))}
              style={{background:C.brun,color:"white",border:"none",borderRadius:7,padding:".22rem .55rem",fontSize:".65rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>+ Ajouter</button>
          </div>
          {(profil.faq||[]).map((f,i)=>(
            <div key={i} style={{background:C.creme,borderRadius:9,padding:".55rem",marginBottom:".35rem",border:`1px solid ${C.pale}`}}>
              <input value={f.q} onChange={e=>{const a=[...(profil.faq||[])];a[i]={...a[i],q:e.target.value};setProfil(p=>({...p,faq:a}));}}
                placeholder="Question" style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:7,padding:".3rem .5rem",fontSize:".72rem",fontFamily:"inherit",color:C.texte,background:"white",outline:"none",marginBottom:".3rem"}}/>
              <div style={{display:"flex",gap:".3rem"}}>
                <textarea value={f.a} onChange={e=>{const a=[...(profil.faq||[])];a[i]={...a[i],a:e.target.value};setProfil(p=>({...p,faq:a}));}}
                  placeholder="Réponse" rows={2} style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:7,padding:".3rem .5rem",fontSize:".72rem",fontFamily:"inherit",color:C.texte,background:"white",outline:"none",resize:"none"}}/>
                <button onClick={()=>setProfil(p=>({...p,faq:(p.faq||[]).filter((_,j)=>j!==i)}))}
                  style={{background:"none",border:"none",color:C.gris,cursor:"pointer",fontSize:".75rem",alignSelf:"flex-start"}}>✕</button>
              </div>
            </div>
          ))}

          <Preview/>
        </div>
      )}

      {/* SECTION LIENS */}
      {activeSection==="liens"&&(
        <div>
          <div style={{fontSize:".6rem",fontWeight:700,color:C.gris,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".6rem"}}>Liens principaux</div>
          {[
            {label:"🛍️ Boutique Mihi",key:"lienBoutique",placeholder:"https://mihi.care/fr/..."},
            {label:"👑 Rejoindre l'équipe",key:"lienRecrutement",placeholder:"https://mihi.care/fr/..."},
          ].map(f=>(
            <div key={f.key} style={{marginBottom:".55rem"}}>
              <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600}}>{f.label}</div>
              <input value={profil[f.key]||""} onChange={e=>setProfil(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder}
                style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
            </div>
          ))}

          {/* Diagnostics multiples */}
          <div style={{height:1,background:C.pale,margin:"1rem 0"}}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".5rem"}}>
            <div style={{fontSize:".6rem",fontWeight:700,color:C.rose,letterSpacing:".1em",textTransform:"uppercase"}}>✨ Liens Diagnostics</div>
            <button onClick={()=>setProfil(p=>({...p,liensDiag:[...(p.liensDiag||[]),{label:"",url:""}]}))}
              style={{background:C.rose,color:"white",border:"none",borderRadius:7,padding:".22rem .55rem",fontSize:".65rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>+ Ajouter</button>
          </div>
          {(profil.liensDiag||[{label:"✨ Faire mon diagnostic",url:profil.lienDiag||""}]).map((d,i)=>(
            <div key={i} style={{display:"flex",gap:".3rem",marginBottom:".35rem",alignItems:"center"}}>
              <input value={d.label} onChange={e=>{const a=[...(profil.liensDiag||[])];a[i]={...a[i],label:e.target.value};setProfil(p=>({...p,liensDiag:a}));}}
                placeholder="Label ex: Diagnostic Skincare"
                style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:7,padding:".38rem .5rem",fontSize:".72rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
              <input value={d.url} onChange={e=>{const a=[...(profil.liensDiag||[])];a[i]={...a[i],url:e.target.value};setProfil(p=>({...p,liensDiag:a}));}}
                placeholder="URL https://..."
                style={{flex:2,border:`1px solid ${C.pale}`,borderRadius:7,padding:".38rem .5rem",fontSize:".72rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
              <button onClick={()=>setProfil(p=>({...p,liensDiag:(p.liensDiag||[]).filter((_,j)=>j!==i)}))}
                style={{background:"none",border:"none",color:C.gris,cursor:"pointer",fontSize:".75rem",flexShrink:0}}>✕</button>
            </div>
          ))}

          {/* Liens bonus */}
          <div style={{height:1,background:C.pale,margin:"1rem 0"}}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".6rem"}}>
            <div style={{fontSize:".6rem",fontWeight:700,color:C.gris,letterSpacing:".1em",textTransform:"uppercase"}}>Liens bonus</div>
            <button onClick={addLienBonus} style={{background:C.brun,color:C.blanc,border:"none",borderRadius:7,padding:".25rem .6rem",fontSize:".68rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>+ Ajouter</button>
          </div>
          {(profil.liensBonusLabel||[]).map((_,i)=>(
            <div key={i} style={{background:C.creme,borderRadius:9,padding:".65rem",marginBottom:".5rem",border:`1px solid ${C.pale}`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:".35rem"}}>
                <div style={{fontSize:".62rem",fontWeight:700,color:C.gris}}>Lien bonus {i+1}</div>
                <button onClick={()=>removeLienBonus(i)} style={{background:"none",border:"none",color:C.gris,cursor:"pointer",fontSize:".7rem"}}>✕</button>
              </div>
              <input value={profil.liensBonusLabel?.[i]||""} onChange={e=>{const a=[...(profil.liensBonusLabel||[])];a[i]=e.target.value;setProfil(p=>({...p,liensBonusLabel:a}));}}
                placeholder="Label du bouton" style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:7,padding:".38rem .55rem",fontSize:".76rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".3rem"}}/>
              <input value={profil.liensBonusUrl?.[i]||""} onChange={e=>{const a=[...(profil.liensBonusUrl||[])];a[i]=e.target.value;setProfil(p=>({...p,liensBonusUrl:a}));}}
                placeholder="URL https://..." style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:7,padding:".38rem .55rem",fontSize:".76rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".3rem"}}/>
              <input value={profil.liensBonusPhoto?.[i]||""} onChange={e=>{const a=[...(profil.liensBonusPhoto||[])];a[i]=e.target.value;setProfil(p=>({...p,liensBonusPhoto:a}));}}
                placeholder="Photo miniature (URL optionnel)" style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:7,padding:".38rem .55rem",fontSize:".76rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none"}}/>
            </div>
          ))}
        </div>
      )}

      {/* SECTION PHOTOS */}
      {activeSection==="photos"&&(
        <div>
          <div style={{fontSize:".6rem",fontWeight:700,color:C.gris,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".4rem"}}>Galerie photos</div>
          <p style={{fontSize:".7rem",color:C.gris,lineHeight:1.6,marginBottom:".75rem"}}>
            Ajoute des photos. Tu peux coller une URL ou utiliser les photos de ta galerie (partage → copier le lien).
          </p>
          {Array.from({length:5},(_,i)=>(
            <div key={i} style={{display:"flex",gap:".5rem",alignItems:"center",marginBottom:".4rem"}}>
              <div style={{width:52,height:52,borderRadius:8,background:C.creme,border:`1px solid ${C.pale}`,flexShrink:0,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}
                onClick={()=>{
                  // Ouvrir input file caché
                  document.getElementById(`photo-input-${i}`)?.click();
                }}>
                {profil.photos?.[i]
                  ?<img src={profil.photos[i]} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  :<div style={{textAlign:"center"}}><div style={{fontSize:"1.2rem"}}>📷</div><div style={{fontSize:".5rem",color:C.gris}}>Tap</div></div>
                }
              </div>
              <input value={profil.photos?.[i]||""} onChange={e=>{const a=[...(profil.photos||["","","","",""])];a[i]=e.target.value;setProfil(p=>({...p,photos:a}));}}
                placeholder={`URL photo ${i+1}`}
                style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".38rem .55rem",fontSize:".75rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
              {profil.photos?.[i]&&<button onClick={()=>{const a=[...(profil.photos||[])];a[i]="";setProfil(p=>({...p,photos:a}));}} style={{background:"none",border:"none",color:C.gris,cursor:"pointer",flexShrink:0}}>✕</button>}
            </div>
          ))}
          {(profil.photos||[]).some(p=>p)&&<Preview/>}
        </div>
      )}

      {/* SECTION BANNIÈRE */}
      {activeSection==="banniere"&&(
        <div>
          {/* Bannière globale admin */}
          {banniereGlobale?.actif&&banniereGlobale?.texte&&(
            <div style={{background:C.or+"15",border:`1px solid ${C.or}`,borderRadius:10,padding:".75rem",marginBottom:".85rem"}}>
              <div style={{fontSize:".6rem",fontWeight:700,color:C.or,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".3rem"}}>📢 Bannière équipe (de Melissa)</div>
              <div style={{fontSize:".78rem",color:C.brun,marginBottom:".5rem"}}>{banniereGlobale.texte}</div>
              <label style={{display:"flex",alignItems:"center",gap:".5rem",cursor:"pointer"}}>
                <input type="checkbox" checked={profil.showBanniere!==false} onChange={e=>setProfil(p=>({...p,showBanniere:e.target.checked}))}/>
                <span style={{fontSize:".74rem",color:C.brun,fontWeight:600}}>Afficher sur ma page</span>
              </label>
            </div>
          )}

          {/* Bannière personnelle */}
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem"}}>
            <div style={{fontSize:".6rem",fontWeight:700,color:C.rose,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".6rem"}}>✨ Ma bannière personnelle</div>
            <input value={profil.bannierePersoTexte||""} onChange={e=>setProfil(p=>({...p,bannierePersoTexte:e.target.value}))} placeholder="Ex: Promo -15% ce weekend !" style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".4rem"}}/>


            <input value={profil.bannierePersoLien||""} onChange={e=>setProfil(p=>({...p,bannierePersoLien:e.target.value}))}
              placeholder="Lien optionnel (https://...)"
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".4rem"}}/>
            <div style={{display:"flex",gap:".75rem",alignItems:"center",marginBottom:".5rem"}}>
              <div style={{fontSize:".7rem",color:C.gris}}>Couleur :</div>
              <input type="color" value={profil.bannierePersoBg||"#C49A8A"} onChange={e=>setProfil(p=>({...p,bannierePersoBg:e.target.value}))}
                style={{width:36,height:30,border:"none",borderRadius:6,cursor:"pointer"}}/>
            </div>
            <label style={{display:"flex",alignItems:"center",gap:".5rem",cursor:"pointer"}}>
              <input type="checkbox" checked={!!profil.bannierePersoActif} onChange={e=>setProfil(p=>({...p,bannierePersoActif:e.target.checked}))}/>
              <span style={{fontSize:".74rem",color:C.brun,fontWeight:600}}>Activer ma bannière personnelle</span>
            </label>
          </div>

          {(profil.bannierePersoActif&&profil.bannierePersoTexte)||(banniereGlobale?.actif&&profil.showBanniere!==false)&&(
            <div style={{marginTop:"1rem"}}><Preview/></div>
          )}
        </div>
      )}

      {/* Bouton sauvegarder */}
      <div style={{marginTop:"1.2rem"}}>
        <button onClick={save} disabled={saving}
          style={{width:"100%",background:saved?C.vert:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".75rem",fontSize:".85rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",transition:"background .3s"}}>
          {saving?"Sauvegarde...":saved?"✅ Sauvegardé !":"Sauvegarder ma page"}
        </button>
      </div>
    </div>
  );
}

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
function UploadPhoto({value, onChange, label="Photo", folder="produits"}){
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
      const reader2=new FileReader();reader2.onload=ev=>{onChange(ev.target.result);setUploading(false);};reader2.readAsDataURL(file);return;
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

// ── DREAM BOARD ───────────────────────────────────────────────────────────────
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
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Mon <em style={{fontStyle:"italic",color:C.or}}>Dream Board</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:".75rem",lineHeight:1.65}}>
        Visualise tes rêves chaque jour. Ce que l'on voit clairement, on l'attire à soi. ✨
      </p>

      {/* Barre d'actions */}
      <div style={{display:"flex",gap:".4rem",marginBottom:"1rem"}}>
        <button onClick={()=>{setShowForm(true);setEditIdx(null);setForm({titre:"",description:"",emoji:"🌟",image:"",categorie:"vie"});}}
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
        <div>
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

function CitationDuJour({uid}){
  const[citations,setCitations]=useState(null);
  const[revealed,setRevealed]=useState(true); // toujours visible
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

      const todayStr = todayLocalStr();
      let lastSeen = await sg(uid,"db-citation-vue");
      // Normaliser le format de date stocké
      if(lastSeen && lastSeen.length > 10) lastSeen = lastSeen.slice(0,10);
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
  const todayStr = todayLocalStr();

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
  const[accepted,setAccepted]=useState(false);
  const DUREE_MIN=20;

  const load=async()=>{
    try{
      const snap=await getDoc(doc(db,"equipe","power-hour"));
      if(snap.exists()&&snap.data().startedAt){
        const d=snap.data();
        const elapsed=Date.now()-d.startedAt;
        if(elapsed < DUREE_MIN*60000+5*60000){ setSession(d); }
        else setSession(null);
      } else setSession(null);
      // Charger si l'utilisateur a accepté cette session
      const accSnap=await getDoc(doc(db,"power-hour-accepts",uid));
      if(accSnap.exists()&&accSnap.data().sessionStart===snap.data()?.startedAt){
        setAccepted(true);
      } else setAccepted(false);
    }catch{}
    setLoading(false);
  };

  useEffect(()=>{ load(); const t=setInterval(load,5000); return()=>clearInterval(t); },[]);

  const lancer=async()=>{
    const nouvelle={startedAt:Date.now(),startedBy:userName,messages:[],accepts:{}};
    try{ await setDoc(doc(db,"equipe","power-hour"),nouvelle); setSession(nouvelle); }catch{}
  };

  const accepter=async()=>{
    if(!session)return;
    const next={...session,accepts:{...(session.accepts||{}),[uid]:{userName,ts:Date.now()}}};
    setSession(next);setAccepted(true);
    try{
      await setDoc(doc(db,"equipe","power-hour"),next,{merge:true});
      await setDoc(doc(db,"power-hour-accepts",uid),{sessionStart:session.startedAt,userName,ts:Date.now()});
    }catch{}
  };

  const envoyerMessage=async()=>{
    if(!message.trim()||!session)return;
    const msg={uid,userName,text:message.trim(),ts:Date.now()};
    const next={...session,messages:[...(session.messages||[]),msg].slice(-100)};
    setMessage("");setSession(next);
    try{ await setDoc(doc(db,"equipe","power-hour"),next,{merge:true}); }catch{}
  };

  const arreter=async()=>{
    try{ await setDoc(doc(db,"equipe","power-hour"),{startedAt:0,startedBy:"",messages:[],accepts:{}}); }catch{}
    setSession(null);
  };

  if(loading)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  const elapsed=session?Date.now()-session.startedAt:0;
  const remaining=session?DUREE_MIN*60000-elapsed:0;
  const isActive=session&&remaining>0;
  const minutes=Math.max(0,Math.floor(remaining/60000));
  const seconds=Math.max(0,Math.floor((remaining%60000)/1000));

  // Stats pour chef
  const acceptsList=Object.entries(session?.accepts||{});
  const totalEquipe=Math.max(1,acceptsList.length);

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,color:C.brun,marginBottom:".75rem"}}>⚡ Power Hour</div>

      {!session&&!isActive&&(
        <div style={{background:C.creme,borderRadius:12,padding:"1.25rem",textAlign:"center",marginBottom:"1rem"}}>
          <div style={{fontSize:"2rem",marginBottom:".5rem"}}>⚡</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",color:C.brun,marginBottom:".3rem"}}>Aucune session en cours</div>
          <div style={{fontSize:".72rem",color:C.gris,marginBottom:"1rem"}}>20 minutes de focus intense pour toute l'équipe</div>
          {canCreate&&(
            <button onClick={lancer}
              style={{background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".6rem 1.5rem",fontSize:".82rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
              🚀 Lancer une Power Hour
            </button>
          )}
        </div>
      )}

      {session&&(
        <div>
          {/* Bandeau session */}
          <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:12,padding:".9rem 1rem",marginBottom:"1rem",color:C.blanc}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:".58rem",fontWeight:700,color:C.or,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".15rem"}}>
                  {isActive?"⚡ POWER HOUR EN COURS":"✅ Session terminée"}
                </div>
                <div style={{fontSize:".72rem",color:C.pale}}>Lancée par {session.startedBy}</div>
              </div>
              {isActive&&(
                <div style={{fontFamily:"Georgia,serif",fontSize:"1.8rem",fontWeight:700,color:C.or}}>
                  {String(minutes).padStart(2,"0")}:{String(seconds).padStart(2,"0")}
                </div>
              )}
            </div>

            {/* Coche d'acceptation */}
            {isActive&&(
              <div onClick={!accepted?accepter:null}
                style={{marginTop:".75rem",background:accepted?"rgba(127,175,138,.25)":"rgba(255,255,255,.1)",borderRadius:10,padding:".6rem .85rem",display:"flex",alignItems:"center",gap:".6rem",cursor:accepted?"default":"pointer",border:`1px solid ${accepted?"rgba(127,175,138,.5)":"rgba(255,255,255,.2)"}`}}>
                <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${accepted?"#7FAF8A":"rgba(255,255,255,.4)"}`,background:accepted?"#7FAF8A":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {accepted&&<span style={{color:"white",fontSize:".7rem",fontWeight:700}}>✓</span>}
                </div>
                <span style={{fontSize:".78rem",fontWeight:600,color:accepted?"#B8E6C4":C.pale}}>
                  {accepted?"✅ Tu participes à cette Power Hour !":"Je participe à cette Power Hour"}
                </span>
              </div>
            )}

            {/* Stats chef */}
            {canCreate&&isActive&&(
              <div style={{marginTop:".5rem",background:"rgba(255,255,255,.08)",borderRadius:9,padding:".5rem .75rem"}}>
                <div style={{fontSize:".6rem",color:C.or,fontWeight:700,marginBottom:".3rem"}}>📊 Participation équipe</div>
                <div style={{display:"flex",alignItems:"center",gap:".75rem"}}>
                  <div style={{flex:1,height:6,background:"rgba(255,255,255,.15)",borderRadius:10,overflow:"hidden"}}>
                    <div style={{height:"100%",background:C.vert,width:Math.min(100,(acceptsList.length/Math.max(1,Object.keys(session.accepts||{}).length+5))*100)+"%",borderRadius:10}}/>
                  </div>
                  <span style={{fontSize:".72rem",fontWeight:700,color:C.pale,flexShrink:0}}>{acceptsList.length} participant{acceptsList.length>1?"s":""}</span>
                </div>
                {acceptsList.length>0&&(
                  <div style={{marginTop:".35rem",display:"flex",flexWrap:"wrap",gap:".25rem"}}>
                    {acceptsList.map(([,v])=>(
                      <span key={v.userName} style={{background:"rgba(255,255,255,.12)",borderRadius:20,padding:".1rem .4rem",fontSize:".6rem",color:C.pale}}>{v.userName}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {canCreate&&<button onClick={arreter} style={{marginTop:".6rem",background:"rgba(255,255,255,.15)",border:"none",borderRadius:7,padding:".3rem .8rem",fontSize:".65rem",color:C.pale,cursor:"pointer",fontFamily:"inherit"}}>✕ Arrêter</button>}
          </div>

          {/* Chat */}
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem",marginBottom:".5rem"}}>
            <div style={{fontSize:".6rem",fontWeight:700,color:C.gris,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".5rem"}}>💬 Messages</div>
            <div style={{maxHeight:200,overflowY:"auto",marginBottom:".5rem"}}>
              {(session.messages||[]).length===0&&<div style={{fontSize:".7rem",color:C.gris,textAlign:"center",padding:".5rem"}}>Aucun message</div>}
              {(session.messages||[]).map((m,i)=>(
                <div key={i} style={{marginBottom:".35rem",padding:".35rem .6rem",background:m.uid===uid?C.rose+"12":C.creme,borderRadius:8,border:`1px solid ${m.uid===uid?C.rose+"30":C.pale}`}}>
                  <div style={{fontSize:".6rem",fontWeight:700,color:m.uid===uid?C.rose:C.brun}}>{m.userName}</div>
                  <div style={{fontSize:".75rem",color:C.texte}}>{m.text}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:".4rem"}}>
              <input value={message} onChange={e=>setMessage(e.target.value)} placeholder="Ton message..."
                onKeyDown={e=>e.key==="Enter"&&envoyerMessage()} style={{marginBottom:0,border:`1px solid ${C.pale}`,borderRadius:8,padding:".4rem .6rem",fontSize:".78rem",fontFamily:"inherit",outline:"none",flex:1}}/>
              <button onClick={envoyerMessage} style={{background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".4rem .7rem",fontSize:".72rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",flexShrink:0}}>→</button>
            </div>
          </div>
        </div>
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
function ChallengeCountdown({deadline}){
  const[r,setR]=useState(deadline-Date.now());
  useEffect(()=>{const t=setInterval(()=>setR(deadline-Date.now()),30000);return()=>clearInterval(t);},[deadline]);
  if(r<=0)return <span style={{color:"#B04040",fontWeight:700,fontSize:".72rem"}}>⏰ Terminé</span>;
  const d2=Math.floor(r/86400000),h=Math.floor((r%86400000)/3600000),m=Math.floor((r%3600000)/60000);
  return <span style={{fontWeight:700,color:C.or,fontSize:".72rem"}}>{d2>0?`${d2}j `:""}{h}h {m}min</span>;
}

function DefisTab({uid, userName, canCreate, isChef}){
  const[challenges,setChallenges]=useState([]);
  const[loading,setLoading]=useState(true);
  const[showCreate,setShowCreate]=useState(false);
  const[form,setForm]=useState({titre:"",description:"",type:"flash",dureeHeures:"48",objectif:"",unite:"ventes",cadeau:"",cadeauImage:"",equipesCibles:[],global:true});
  const[equipes,setEquipes]=useState([]);
  const[declarations,setDeclarations]=useState({});
  const[declareInput,setDeclareInput]=useState({});

  const isMelissa = uid==="melissa"||uid==="melissa-da-silveira";

  useEffect(()=>{
    (async()=>{
      let annuaire={};
      let chefsUids=[];
      try{
        // Charger l'annuaire et la liste des chefs en premier
        const annSnap=await getDoc(doc(db,"equipe","annuaire"));
        if(annSnap.exists()){
          annuaire=annSnap.data().membres||{};
          // Un "chef" = quelqu'un qui a au moins une filleule OU marqué isChef
          const marraines=new Set(Object.values(annuaire).map(m=>m.marraine).filter(Boolean));
          const chefsEntries=Object.entries(annuaire).filter(([k,v])=>v.isChef||marraines.has(k));
          // Ajouter Melissa (uid racine) si pas dans l'annuaire
          const melissaEntry={uid:"melissa-da-silveira",nom:"Melissa"};
          const chefsAvecMelissa=[...chefsEntries.map(([k,v])=>({uid:k,nom:v.prenom||k}))];
          if(!chefsAvecMelissa.find(e=>e.uid==="melissa-da-silveira")) chefsAvecMelissa.unshift(melissaEntry);
          chefsUids=chefsAvecMelissa.map(e=>e.uid);
          setEquipes(chefsAvecMelissa.sort((a,b)=>a.nom.localeCompare(b.nom)));
        }
      }catch{}
      try{
        // Charger les challenges
        const snap=await getDoc(doc(db,"challenges","liste"));
        const data=snap.exists()?snap.data().items||[]:[];
        // Filtrer selon l'équipe de l'utilisateur — en remontant sa lignée jusqu'aux chefs
        const now=Date.now();
        const mesChefs=getLigneeChefs(annuaire,uid,chefsUids);
        const actifs=data.filter(c=>{
          if(c.deadline&&c.deadline<now)return false;
          if(isMelissa)return true;
          if(c.global)return true;
          if(!c.equipesCibles||c.equipesCibles.length===0)return true;
          if(c.equipesCibles.includes("all"))return true;
          // Visible si l'utilisateur EST un des chefs ciblés, OU si un de ses chefs (lignée) est ciblé
          return c.equipesCibles.includes(uid)||mesChefs.some(chefUid=>c.equipesCibles.includes(chefUid));
        });
        setChallenges(actifs.sort((a,b)=>b.ts-a.ts));
        // Charger les déclarations par challenge
        const declSnap=await getDoc(doc(db,"challenges","declarations"));
        setDeclarations(declSnap.exists()?declSnap.data():{});
      }catch{}
      setLoading(false);
    })();
  },[uid]);

  const saveAll=async(items)=>{
    await setDoc(doc(db,"challenges","liste"),{items});
    setChallenges(items.filter(c=>{
      if(c.deadline&&c.deadline<Date.now())return false;
      if(isMelissa)return true;
      if(c.global)return true;
      if(!c.equipesCibles||c.equipesCibles.length===0)return true;
      return c.equipesCibles.includes(uid);
    }));
  };

  const creer=async()=>{
    if(!form.titre.trim())return;
    const id=`c${Date.now()}`;
    const nouveau={
      id,titre:form.titre.trim(),description:form.description.trim(),
      type:form.type,
      deadline:form.type==="flash"?Date.now()+(+form.dureeHeures||48)*3600000:form.type==="long"?Date.now()+21*24*3600000:null,
      objectif:+form.objectif||0,unite:form.unite,
      cadeau:form.cadeau.trim(),cadeauImage:form.cadeauImage.trim(),
      global:form.global,equipesCibles:form.global?[]:form.equipesCibles,
      createdBy:userName,ts:Date.now(),
    };
    const snap=await getDoc(doc(db,"challenges","liste"));
    const existing=snap.exists()?snap.data().items||[]:[];
    await saveAll([nouveau,...existing]);
    setShowCreate(false);
    setForm({titre:"",description:"",type:"flash",dureeHeures:"48",objectif:"",unite:"ventes",cadeau:"",cadeauImage:"",equipesCibles:[],global:true});
  };

  const declarer=async(challengeId,amount)=>{
    const d={uid,userName,count:+amount||1,ts:Date.now()};
    const current=declarations[challengeId]||[];
    const next={...declarations,[challengeId]:[...current,d]};
    setDeclarations(next);
    await setDoc(doc(db,"challenges","declarations"),next,{merge:true});
    postToWallOfFame&&postToWallOfFame(uid,userName,`a déclaré ${amount} ${form.unite} sur le challenge "${challengeId}" 💪`,"🚀");
  };

  const supprimer=async(id)=>{
    const snap=await getDoc(doc(db,"challenges","liste"));
    const items=(snap.exists()?(snap.data().items||[]):[]).filter(c=>c.id!==id);
    await saveAll(items);
  };

  if(loading)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  const Countdown=ChallengeCountdown;

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,color:C.brun}}>🏆 Challenges & Défis</div>
        {canCreate&&(
          <button onClick={()=>setShowCreate(p=>!p)}
            style={{background:showCreate?C.pale:C.brun,color:showCreate?C.gris:C.blanc,border:"none",borderRadius:9,padding:".4rem .8rem",fontSize:".72rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
            {showCreate?"✕ Annuler":"+ Créer"}
          </button>
        )}
      </div>

      {/* FORMULAIRE CRÉATION */}
      {showCreate&&canCreate&&(
        <div style={{background:C.blanc,border:`1px solid ${C.rose}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,color:C.rose,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".75rem"}}>✨ Nouveau challenge</div>

          {/* Titre */}
          <input placeholder="Titre du challenge*" value={form.titre} onChange={e=>setForm(p=>({...p,titre:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .65rem",fontSize:".82rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".5rem"}}/>
          <textarea placeholder="Description (optionnel)" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} rows={2}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",resize:"vertical",marginBottom:".5rem"}}/>

          {/* Type */}
          <div style={{display:"flex",gap:".35rem",marginBottom:".5rem"}}>
            {[{v:"flash",l:"⚡ Challenge Flash (24-72h)"},{v:"long",l:"📅 Challenge Long terme (21j)"},{v:"libre",l:"🎯 Challenge Libre"}].map(t=>(
              <button key={t.v} onClick={()=>setForm(p=>({...p,type:t.v}))}
                style={{flex:1,padding:".38rem .3rem",fontSize:".65rem",fontWeight:600,borderRadius:8,border:`1px solid ${form.type===t.v?C.rose:C.pale}`,background:form.type===t.v?C.rose:C.blanc,color:form.type===t.v?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
                {t.l}
              </button>
            ))}
          </div>

          {/* Durée si flash */}
          {form.type==="flash"&&(
            <div style={{display:"flex",gap:".4rem",marginBottom:".5rem",alignItems:"center"}}>
              <span style={{fontSize:".7rem",color:C.gris,flexShrink:0}}>Durée :</span>
              {["24","48","72"].map(h=>(
                <button key={h} onClick={()=>setForm(p=>({...p,dureeHeures:h}))}
                  style={{flex:1,padding:".35rem",fontSize:".7rem",fontWeight:600,borderRadius:7,border:`1px solid ${form.dureeHeures===h?C.rose:C.pale}`,background:form.dureeHeures===h?C.rose:C.blanc,color:form.dureeHeures===h?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
                  {h}h
                </button>
              ))}
            </div>
          )}

          {/* Objectif + unité */}
          <div style={{display:"flex",gap:".4rem",marginBottom:".5rem"}}>
            <input type="number" placeholder="Objectif" value={form.objectif} onChange={e=>setForm(p=>({...p,objectif:e.target.value}))}
              style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .55rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
            <input placeholder="Unité (ventes, €...)" value={form.unite} onChange={e=>setForm(p=>({...p,unite:e.target.value}))}
              style={{flex:2,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .55rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
          </div>

          {/* Cadeau */}
          <input placeholder="🎁 Récompense (ex: Kit produit Mihi, carte cadeau 50€...)" value={form.cadeau} onChange={e=>setForm(p=>({...p,cadeau:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".35rem"}}/>
          <input placeholder="Image du cadeau (URL optionnel)" value={form.cadeauImage} onChange={e=>setForm(p=>({...p,cadeauImage:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".5rem"}}/>

          {/* Ciblage équipes — 2 choix clairs */}
          <div style={{marginBottom:".75rem"}}>
            <div style={{fontSize:".6rem",color:C.gris,fontWeight:600,textTransform:"uppercase",letterSpacing:".08em",marginBottom:".4rem"}}>Portée du challenge</div>
            <div style={{display:"flex",gap:".4rem",marginBottom:".5rem"}}>
              <button onClick={()=>setForm(p=>({...p,global:true,equipesCibles:[]}))}
                style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:9,border:`1.5px solid ${form.global?C.rose:C.pale}`,background:form.global?C.rose:C.blanc,color:form.global?"white":C.gris,cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>
                🌍 Toute l'équipe
              </button>
              <button onClick={()=>setForm(p=>({...p,global:false}))}
                style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:9,border:`1.5px solid ${!form.global?C.or:C.pale}`,background:!form.global?C.or+"15":C.blanc,color:!form.global?C.brun:C.gris,cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>
                👑 Inter-équipes
              </button>
            </div>
            {!form.global&&(
              <div style={{background:C.creme,borderRadius:9,padding:".6rem .75rem",border:`1px solid ${C.or}40`}}>
                <div style={{fontSize:".62rem",color:C.brun,fontWeight:600,marginBottom:".35rem"}}>Sélectionne les équipes participantes :</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:".3rem"}}>
                  {equipes.map(e=>{
                    const sel=form.equipesCibles.includes(e.uid);
                    const estMoi=e.uid===uid;
                    return(
                      <button key={e.uid} onClick={()=>setForm(p=>({...p,equipesCibles:sel?p.equipesCibles.filter(x=>x!==e.uid):[...p.equipesCibles,e.uid]}))}
                        style={{padding:".28rem .65rem",fontSize:".68rem",fontWeight:600,borderRadius:8,border:`1.5px solid ${sel?C.brun:C.pale}`,background:sel?C.brun:C.blanc,color:sel?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
                        {e.nom}{estMoi?" (moi)":""}
                      </button>
                    );
                  })}
                </div>
                {form.equipesCibles.length>=2&&(
                  <div style={{fontSize:".62rem",color:C.vert,fontWeight:600,marginTop:".4rem"}}>
                    ✓ {form.equipesCibles.length} équipes sélectionnées — les membres de chacune verront ce challenge
                  </div>
                )}
                {form.equipesCibles.length<2&&(
                  <div style={{fontSize:".62rem",color:C.gris,marginTop:".4rem",fontStyle:"italic"}}>
                    Sélectionne au moins 2 équipes pour un challenge inter-équipes
                  </div>
                )}
              </div>
            )}
          </div>

          <button onClick={creer}
            style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:9,padding:".6rem",fontSize:".82rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
            🚀 Lancer le challenge
          </button>
        </div>
      )}

      {/* LISTE DES CHALLENGES */}
      {challenges.length===0&&!showCreate&&(
        <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".76rem"}}>
          Aucun challenge en cours 🌸<br/>
          {canCreate&&<span style={{color:C.rose,fontSize:".72rem"}}>Crée le premier !</span>}
        </div>
      )}

      {challenges.map(c=>{
        const decls=declarations[c.id]||[];
        const total=decls.reduce((s,d)=>s+d.count,0);
        const pct=c.objectif?Math.min(100,Math.round(total/c.objectif*100)):0;
        const classement=Object.values(decls.reduce((acc,d)=>{
          acc[d.userName]=acc[d.userName]||{userName:d.userName,total:0};
          acc[d.userName].total+=d.count;
          return acc;
        },{})).sort((a,b)=>b.total-a.total);
        const medals=["🥇","🥈","🥉"];
        const monTotal=decls.filter(d=>d.uid===uid).reduce((s,d)=>s+d.count,0);

        return(
          <div key={c.id} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:14,overflow:"hidden",marginBottom:".75rem"}}>
            {/* Header challenge */}
            <div style={{background:`linear-gradient(135deg,${c.type==="flash"?C.rose:c.type==="long"?C.lilas:C.or},${c.type==="flash"?C.brun2:c.type==="long"?C.brun:C.brun})`,padding:".9rem 1rem"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:".55rem",fontWeight:700,color:"rgba(255,255,255,.7)",letterSpacing:".1em",textTransform:"uppercase",marginBottom:".2rem"}}>
                    {c.type==="flash"?"⚡ Challenge Flash":c.type==="long"?"📅 Challenge Long terme":"🎯 Challenge"}
                    {!c.global&&(c.equipesCibles?.length>1?` · 👑 Challenge entre ${c.equipesCibles.length} équipes`:" · Équipe ciblée")}
                  </div>
                  <div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",fontWeight:600,color:"white"}}>{c.titre}</div>
                  {c.description&&<div style={{fontSize:".7rem",color:"rgba(255,255,255,.75)",marginTop:".2rem",lineHeight:1.5}}>{c.description}</div>}
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:".2rem",flexShrink:0,marginLeft:".5rem"}}>
                  {c.deadline&&<Countdown deadline={c.deadline}/>}
                  {canCreate&&<button onClick={()=>supprimer(c.id)}
                    style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:5,padding:".18rem .4rem",color:"rgba(255,255,255,.6)",cursor:"pointer",fontSize:".6rem",fontFamily:"inherit"}}>
                    ✕
                  </button>}
                </div>
              </div>
            </div>

            <div style={{padding:".85rem 1rem"}}>
              {/* Barre de progression */}
              {c.objectif>0&&(
                <div style={{marginBottom:".75rem"}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:".62rem",color:C.gris,marginBottom:".25rem"}}>
                    <span>Total équipe : {total} {c.unite}</span>
                    <span style={{fontWeight:700,color:pct>=100?C.vert:C.rose}}>{pct}% · objectif {c.objectif}</span>
                  </div>
                  <div style={{height:8,background:C.pale,borderRadius:10,overflow:"hidden"}}>
                    <div style={{height:"100%",background:pct>=100?C.vert:C.rose,width:pct+"%",borderRadius:10,transition:"width .5s"}}/>
                  </div>
                </div>
              )}

              {/* Encadré cadeau */}
              {c.cadeau&&(
                <div style={{background:`linear-gradient(135deg,${C.or}20,${C.creme})`,border:`1.5px solid ${C.or}40`,borderRadius:12,padding:".75rem",marginBottom:".75rem",display:"flex",alignItems:"center",gap:".75rem"}}>
                  {c.cadeauImage
                    ?<img src={c.cadeauImage} alt="cadeau" style={{width:52,height:52,borderRadius:8,objectFit:"cover",flexShrink:0}}/>
                    :<div style={{width:44,height:44,background:`linear-gradient(135deg,${C.or},#B8962A)`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem",flexShrink:0}}>🎁</div>
                  }
                  <div style={{flex:1}}>
                    <div style={{fontSize:".58rem",fontWeight:700,color:C.or,letterSpacing:".08em",textTransform:"uppercase",marginBottom:".15rem"}}>Récompense</div>
                    <div style={{fontSize:".8rem",fontWeight:600,color:C.brun,lineHeight:1.5}}>{c.cadeau}</div>
                  </div>
                </div>
              )}

              {/* Ma participation */}
              <div style={{background:C.creme,borderRadius:10,padding:".65rem .85rem",marginBottom:".75rem",display:"flex",alignItems:"center",gap:".6rem"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:".6rem",color:C.gris,marginBottom:".1rem"}}>Ma participation</div>
                  <div style={{fontFamily:"Georgia,serif",fontSize:".95rem",fontWeight:700,color:C.brun}}>{monTotal} {c.unite}</div>
                </div>
                <input type="number" min="1" value={declareInput[c.id]||""} onChange={e=>setDeclareInput(p=>({...p,[c.id]:e.target.value}))}
                  placeholder="Qté"
                  style={{width:60,border:`1px solid ${C.pale}`,borderRadius:7,padding:".35rem .4rem",fontSize:".8rem",fontFamily:"inherit",textAlign:"center",color:C.texte,background:C.blanc,outline:"none"}}/>
                <button onClick={()=>{declarer(c.id,declareInput[c.id]||1);setDeclareInput(p=>({...p,[c.id]:""}));}}
                  style={{background:C.brun,color:C.blanc,border:"none",borderRadius:7,padding:".35rem .7rem",fontSize:".72rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap"}}>
                  + Déclarer
                </button>
              </div>

              {/* Classement */}
              {classement.length>0&&(
                <div>
                  <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.gris,marginBottom:".4rem"}}>🏆 Classement</div>
                  {classement.slice(0,5).map((p,i)=>(
                    <div key={p.userName} style={{display:"flex",alignItems:"center",gap:".5rem",padding:".3rem 0",borderBottom:i<classement.slice(0,5).length-1?`1px solid ${C.pale}30`:"none"}}>
                      <div style={{width:22,textAlign:"center",fontSize:i<3?"1rem":".7rem",flexShrink:0}}>{i<3?medals[i]:`${i+1}.`}</div>
                      <div style={{flex:1,fontSize:".76rem",fontWeight:p.userName===userName?700:400,color:p.userName===userName?C.rose:C.texte}}>{p.userName}{p.userName===userName?" ✓":""}</div>
                      <div style={{fontFamily:"Georgia,serif",fontSize:".85rem",fontWeight:700,color:C.brun}}>{p.total} {c.unite}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
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

// Paliers de qualification : nombre de directeurs requis + points requis + montant de prime
const PALIERS_QUALIFICATION=[
  {id:"Directeur", nbDirecteurs:1, pts:0, prime:1000},
  {id:"SR", nbDirecteurs:1, pts:7500, ptsOU:true, prime:500}, // 7500 pts OU 1 directeur
  {id:"Structural", nbDirecteurs:2, pts:0, prime:2000},
  {id:"Business Director", nbDirecteurs:3, pts:0, prime:3000},
  {id:"SR Business Director", nbDirecteurs:4, pts:0, prime:4000},
];

// Périodes Mihi — ancre chargée depuis Firebase admin (modifiable)
// Valeur par défaut : 19/12/2024

// ── CALENDRIER OFFICIEL MIHI PAR ANNÉE ──────────────────────────────────────
// Dates exactes extraites des catalogues officiels Mihi
const CALENDRIER_MIHI = {
  2023: [
    {c:1, debut:"2023-01-07", fin:"2023-01-27"},
    {c:2, debut:"2023-01-28", fin:"2023-02-17"},
    {c:3, debut:"2023-02-18", fin:"2023-03-10"},
    {c:4, debut:"2023-03-11", fin:"2023-03-31"},
    {c:5, debut:"2023-04-01", fin:"2023-04-21"},
    {c:6, debut:"2023-04-22", fin:"2023-05-12"},
    {c:7, debut:"2023-05-13", fin:"2023-06-02"},
    {c:8, debut:"2023-06-03", fin:"2023-06-23"},
    {c:9, debut:"2023-06-24", fin:"2023-07-14"},
    {c:10,debut:"2023-07-15", fin:"2023-08-04"},
    {c:11,debut:"2023-08-05", fin:"2023-08-25"},
    {c:12,debut:"2023-08-26", fin:"2023-09-15"},
    {c:13,debut:"2023-09-16", fin:"2023-10-06"},
    {c:14,debut:"2023-10-07", fin:"2023-10-27"},
    {c:15,debut:"2023-10-28", fin:"2023-11-17"},
    {c:16,debut:"2023-11-18", fin:"2023-12-08"},
    {c:17,debut:"2023-12-09", fin:"2023-12-29"},
  ],
  2024: [
    {c:1, debut:"2024-01-18", fin:"2024-02-07"},
    {c:2, debut:"2024-02-08", fin:"2024-02-28"},
    {c:3, debut:"2024-02-29", fin:"2024-03-20"},
    {c:4, debut:"2024-03-21", fin:"2024-04-10"},
    {c:5, debut:"2024-04-11", fin:"2024-05-01"},
    {c:6, debut:"2024-05-02", fin:"2024-05-22"},
    {c:7, debut:"2024-05-23", fin:"2024-06-12"},
    {c:8, debut:"2024-06-13", fin:"2024-07-03"},
    {c:9, debut:"2024-07-04", fin:"2024-07-24"},
    {c:10,debut:"2024-07-25", fin:"2024-08-14"},
    {c:11,debut:"2024-08-15", fin:"2024-09-04"},
    {c:12,debut:"2024-09-05", fin:"2024-09-25"},
    {c:13,debut:"2024-09-26", fin:"2024-10-16"},
    {c:14,debut:"2024-10-17", fin:"2024-11-06"},
    {c:15,debut:"2024-11-07", fin:"2024-11-27"},
    {c:16,debut:"2024-11-28", fin:"2024-12-18"},
    {c:17,debut:"2024-12-19", fin:"2025-01-08"},
    {c:18,debut:"2023-12-28", fin:"2024-01-17"},
  ],
  2025: [
    {c:1, debut:"2025-01-09", fin:"2025-01-29"},
    {c:2, debut:"2025-01-30", fin:"2025-02-19"},
    {c:3, debut:"2025-02-20", fin:"2025-03-12"},
    {c:4, debut:"2025-03-13", fin:"2025-04-02"},
    {c:5, debut:"2025-04-03", fin:"2025-04-23"},
    {c:6, debut:"2025-04-24", fin:"2025-05-14"},
    {c:7, debut:"2025-05-15", fin:"2025-06-04"},
    {c:8, debut:"2025-06-05", fin:"2025-06-25"},
    {c:9, debut:"2025-06-26", fin:"2025-07-16"},
    {c:10,debut:"2025-07-17", fin:"2025-08-06"},
    {c:11,debut:"2025-08-07", fin:"2025-08-27"},
    {c:12,debut:"2025-08-28", fin:"2025-09-17"},
    {c:13,debut:"2025-09-18", fin:"2025-10-08"},
    {c:14,debut:"2025-10-09", fin:"2025-10-29"},
    {c:15,debut:"2025-10-30", fin:"2025-11-19"},
    {c:16,debut:"2025-11-20", fin:"2025-12-10"},
    {c:17,debut:"2025-12-11", fin:"2025-12-31"},
  ],
  2026: [
    {c:1, debut:"2026-01-01", fin:"2026-01-21"},
    {c:2, debut:"2026-01-22", fin:"2026-02-11"},
    {c:3, debut:"2026-02-12", fin:"2026-03-04"},
    {c:4, debut:"2026-03-05", fin:"2026-03-25"},
    {c:5, debut:"2026-03-26", fin:"2026-04-15"},
    {c:6, debut:"2026-04-16", fin:"2026-05-06"},
    {c:7, debut:"2026-05-07", fin:"2026-05-27"},
    {c:8, debut:"2026-05-28", fin:"2026-06-17"},
    {c:9, debut:"2026-06-18", fin:"2026-07-08"},
    {c:10,debut:"2026-07-09", fin:"2026-07-29"},
    {c:11,debut:"2026-07-30", fin:"2026-08-19"},
    {c:12,debut:"2026-08-20", fin:"2026-09-09"},
    {c:13,debut:"2026-09-10", fin:"2026-09-30"},
    {c:14,debut:"2026-10-01", fin:"2026-10-21"},
    {c:15,debut:"2026-10-22", fin:"2026-11-11"},
    {c:16,debut:"2026-11-12", fin:"2026-12-02"},
    {c:17,debut:"2026-12-03", fin:"2026-12-23"},
  ],
};

// Trouve la campagne Mihi officielle pour une date donnée
function getCampagneMihiPourDate(dateStr){
  const d = new Date(dateStr+"T12:00:00").getTime();
  for(const [annee, campagnes] of Object.entries(CALENDRIER_MIHI)){
    for(const c of campagnes){
      const deb = new Date(c.debut+"T00:00:00").getTime();
      const fin = new Date(c.fin+"T23:59:59").getTime();
      if(d >= deb && d <= fin) return {annee:parseInt(annee), num:c.c, debut:c.debut, fin:c.fin};
    }
  }
  return null;
}

// Trouve la campagne Mihi actuelle
function getCampagneMihiActuelle(){
  const today = new Date();
  const dateStr = today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");
  return getCampagneMihiPourDate(dateStr);
}

let ANTHROPIC_API_KEY="";
async function chargerCleAPI(){try{const snap=await getDoc(doc(db,"admin","config"));if(snap.exists()&&snap.data().anthropicKey)ANTHROPIC_API_KEY=snap.data().anthropicKey;}catch{}}
chargerCleAPI();

let PERIODE_DEBUT_ABSOLU_MS = new Date("2026-01-01T12:00:00").getTime();
const PERIODE_DUREE_JOURS = 21;
const PERIODES_PAR_AN = 18;

// Charge l'ancre depuis Firebase (appelé au démarrage de l'app)
async function chargerAncrePeriodesFirebase(){
  try{
    const snap = await getDoc(doc(db,"admin","config_periodes"));
    if(snap.exists()&&snap.data().ancre){
      const savedAncre = new Date(snap.data().ancre).getTime();
      // Utiliser l'ancre sauvegardée seulement si elle est récente (2026+)
      if(savedAncre >= new Date("2025-01-01").getTime()) PERIODE_DEBUT_ABSOLU_MS = savedAncre;
    }
  }catch{}
}

// Appel immédiat au chargement
chargerAncrePeriodesFirebase();

function getPeriodeDebut(nAbsolu){
  // Utiliser le calendrier officiel Mihi 2026 pour la période actuelle
  const campActuelle = getCampagneMihiActuelle();
  if(campActuelle){
    const annee = campActuelle.annee;
    const camps = CALENDRIER_MIHI[annee] || [];
    // nAbsolu relatif = numéro dans l'année courante
    const numAnnee = ((nAbsolu-1) % PERIODES_PAR_AN) + 1;
    const camp = camps.find(c=>c.c===numAnnee);
    if(camp) return new Date(camp.debut+"T12:00:00");
  }
  return new Date(PERIODE_DEBUT_ABSOLU_MS + (nAbsolu-1)*PERIODE_DUREE_JOURS*24*60*60*1000);
}

export function getPeriodeActuelle(){
  const ANCRE = new Date("2026-01-01T12:00:00").getTime();
  const now = new Date(); const todayLocal = new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime(); const diffJours = Math.floor((todayLocal - ANCRE) / (24*60*60*1000));
  return Math.max(1, Math.floor(diffJours / PERIODE_DUREE_JOURS) + 1);
}

function getPeriodeLabel(nAbsolu){
  const debut = getPeriodeDebut(nAbsolu);
  const fin = new Date(debut.getTime() + PERIODE_DUREE_JOURS*24*60*60*1000 - 1);
  const fmt=(d)=>d.toLocaleDateString("fr-FR",{day:"numeric",month:"short"});
  // Numéro dans l'année et année
  // P1 2025 = abs 1, P18 2025 = abs 18, P1 2026 = abs 19...
  const numDansAnnee = ((nAbsolu-1) % PERIODES_PAR_AN + PERIODES_PAR_AN) % PERIODES_PAR_AN + 1;
  const annee = debut.getFullYear();
  return `P${numDansAnnee} ${annee} · ${fmt(debut)}→${fmt(fin)}`;
}

function getPeriodKeys(n=12){
  const current = getPeriodeActuelle();
  const keys = [];
  for(let i=n-1;i>=0;i--){
    const num = current - i;
    if(num > 0) keys.push(`p${num}`);
  }
  return keys;
}

// Label court d'une période : "P7 2026"
function fmtPLabel(nAbsolu){
  const debut = getPeriodeDebut(nAbsolu);
  // Ancre 22/01/2026 = P1 Mihi
  const OFFSET_MIHI = 0;
  const numAnnee = ((nAbsolu - 1 + OFFSET_MIHI) % PERIODES_PAR_AN + PERIODES_PAR_AN) % PERIODES_PAR_AN + 1;
  return `P${numAnnee} ${debut.getFullYear()}`;
}

// Section "Primes de Qualification" — suivi par période de 21j
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
function PrimesAccordeon({obj, save, onPrimeValidee}){
  const[open,setOpen]=useState(true);
  return(
    <div style={{marginBottom:".75rem"}}>
      <div onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:open?"12px 12px 0 0":12,padding:".75rem 1rem",cursor:"pointer",userSelect:"none"}}>
        <div style={{display:"flex",alignItems:"center",gap:".5rem"}}>
          <span style={{fontSize:"1rem"}}>💎</span>
          <div style={{fontSize:".75rem",fontWeight:700,color:C.brun}}>Primes de qualification</div>
        </div>
        <span style={{color:C.gris,fontSize:".8rem",transform:open?"rotate(90deg)":"none",transition:"transform .2s"}}>›</span>
      </div>
      {open&&(
        <div style={{border:`1px solid ${C.pale}`,borderTop:"none",borderRadius:"0 0 12px 12px",overflow:"hidden"}}>
          <PrimesQualificationSection obj={obj} save={save} onPrimeValidee={onPrimeValidee}/>
        </div>
      )}
    </div>
  );
}

// ── CALCUL DU RESTE ──────────────────────────────────────────────────────────
function ResteCalculateur({obj, save, distributeurs=[]}){
  const[annuaire,setAnnuaire]=useState([]);
  // State local pour les saisies CA — indépendant de obj pour éviter les re-renders
  const[vals,setVals]=useState({});
  const[inited,setInited]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"equipe","annuaire"));
        if(snap.exists()){
          const m=snap.data().membres||{};
          setAnnuaire(Object.entries(m).map(([uid,d])=>({id:uid,prenom:d.prenom||"",nom:d.nom||"",ca:d.ca||""})).filter(d=>d.prenom||d.nom).sort((a,b)=>(a.prenom+a.nom).localeCompare(b.prenom+b.nom)));
        }
      }catch{}
    })();
  },[]);

  // Initialiser vals depuis obj.caDirecteurs une seule fois
  useEffect(()=>{
    if(!inited&&obj.caDirecteurs){
      setVals({...obj.caDirecteurs});
      setInited(true);
    }
  },[obj.caDirecteurs,inited]);

  const caEquipe=parseFloat(obj.ca)||0;
  const nbDir=parseInt(obj.nbDirecteurs)||0;
  const selectionnes=obj.dirSelectionnes||{};

  // Calcul depuis le state local vals
  const totalDir=Array.from({length:nbDir},(_,i)=>parseFloat(vals[i])||0).reduce((s,v)=>s+v,0);
  const reste=caEquipe-totalDir;

  const setNbDir=(n)=>{
    const nextCa={...vals};
    const nextSel={...selectionnes};
    for(let i=n;i<6;i++){delete nextCa[i];delete nextSel[i];}
    setVals(nextCa);
    save({...obj,nbDirecteurs:n,caDirecteurs:nextCa,dirSelectionnes:nextSel});
  };

  const setVal=(i,v)=>{
    const next={...vals,[i]:v};
    setVals(next);
    save({...obj,caDirecteurs:next});
  };

  const selDir=(i,uid)=>{
    const d=annuaire.find(x=>x.id===uid);
    const nextSel={...selectionnes,[i]:uid};
    // Ne pas écraser une valeur déjà saisie manuellement
    const nextCa={...vals};
    if(!vals[i]&&d?.ca) nextCa[i]=d.ca;
    setVals(nextCa);
    save({...obj,dirSelectionnes:nextSel,caDirecteurs:nextCa});
  };

  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:".75rem"}}>
      <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.or,marginBottom:".6rem"}}><T k="obj.reste">📊 Calcul du Reste</T></div>

      {/* CA équipe */}
      <div style={{background:C.creme,borderRadius:9,padding:".5rem .75rem",marginBottom:".75rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:".7rem",color:C.gris}}>💰 CA total équipe (mes objectifs)</span>
        <span style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:700,color:C.brun}}>{caEquipe}€</span>
      </div>

      {/* Nombre directeurs */}
      <div style={{marginBottom:".75rem"}}>
        <div style={{fontSize:".62rem",color:C.gris,marginBottom:".35rem",fontWeight:600}}><T k="obj.directeurs">Directeurs dans ma structure</T></div>
        <div style={{display:"flex",gap:".3rem"}}>
          {[0,1,2,3,4,5,6].map(n=>(
            <button key={n} onClick={()=>setNbDir(n)}
              style={{width:34,height:34,borderRadius:8,border:`2px solid ${nbDir===n?C.brun:C.pale}`,background:nbDir===n?C.brun:C.blanc,color:nbDir===n?C.blanc:C.gris,fontSize:".8rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Champs directeurs */}
      {nbDir>0&&(
        <div style={{marginBottom:".75rem"}}>
          {Array.from({length:nbDir},(_,i)=>{
            const selUid=selectionnes[i]||"";
            const selD=selUid?annuaire.find(x=>x.id===selUid):null;
            return(
              <div key={i} style={{background:C.creme,borderRadius:9,padding:".55rem .75rem",marginBottom:".4rem",border:`1px solid ${C.pale}`}}>
                <div style={{display:"flex",alignItems:"center",gap:".5rem",marginBottom:".3rem"}}>
                  <div style={{width:22,height:22,borderRadius:"50%",background:C.brun,color:C.blanc,fontSize:".65rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
                  <select value={selUid} onChange={e=>selDir(i,e.target.value)}
                    style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:7,padding:".32rem .5rem",fontSize:".75rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none"}}>
                    <option value="">— Choisir —</option>
                    {annuaire.map(d=>(
                      <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>
                    ))}
                  </select>
                </div>
                {selD&&<div style={{fontSize:".62rem",color:C.vert,marginBottom:".25rem",fontWeight:600}}>✓ {selD.prenom} {selD.nom}</div>}
                <div style={{display:"flex",alignItems:"center",gap:".4rem"}}>
                  <span style={{fontSize:".65rem",color:C.gris,flexShrink:0}}>CA ce directeur :</span>
                  <input
                    type="number"
                    value={vals[i]||""}
                    onChange={e=>setVal(i,e.target.value)}
                    placeholder="0"
                    style={{flex:1,border:`1.5px solid ${C.rose}`,borderRadius:7,padding:".32rem .5rem",fontSize:".88rem",fontFamily:"inherit",color:C.brun,background:"white",outline:"none",fontWeight:700}}
                  />
                  <span style={{fontSize:".65rem",color:C.gris}}>€</span>
                </div>
              </div>
            );
          })}

          {/* Total directeurs */}
          <div style={{background:C.creme,borderRadius:8,padding:".4rem .75rem",display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:".7rem",color:C.gris}}>Total CA directeurs</span>
            <span style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:700,color:"#B04040"}}>− {totalDir}€</span>
          </div>
        </div>
      )}

      {/* Résultat */}
      <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:10,padding:".85rem 1rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".35rem"}}>
          <div>
            <div style={{fontSize:".58rem",fontWeight:700,color:C.or,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".1rem"}}>✨ Reste qualifiant</div>
            <div style={{fontSize:".62rem",color:C.pale}}>{caEquipe} − {totalDir} =</div>
          </div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.6rem",fontWeight:700,color:reste<0?"#F4A460":C.or}}>{reste}€</div>
        </div>
        {nbDir>0&&(
          <div style={{background:"rgba(255,255,255,.1)",borderRadius:7,padding:".3rem .6rem",fontSize:".65rem",color:C.pale}}>
            {Array.from({length:nbDir},(_,i)=>{
              const selD=selectionnes[i]?annuaire.find(x=>x.id===selectionnes[i]):null;
              return<span key={i}>{i>0?" · ":""}{selD?selD.prenom:`Dir.${i+1}`} : {parseFloat(vals[i])||0}€</span>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}


function ObjPersoTab({obj,save,uid,userName,distributeurs=[]}){
  const[confettiTrigger,setConfettiTrigger]=useState(0);
  const[fireworksTrigger,setFireworksTrigger]=useState(0);
  const[graphEnGros,setGraphEnGros]=useState(null);
  const raw=getPeriodeInfo();
  const pCourant=getPeriodeActuelle();

  // Score période précédente depuis l'historique
  const histPerso=obj.historique||[];
  const dernierHist=histPerso.length>0?histPerso[histPerso.length-1]:null;
  const scorePrecBadge=dernierHist?(
    <div style={{display:"flex",gap:".5rem",alignItems:"center",background:"rgba(196,154,138,.1)",border:`1px solid ${C.pale}`,borderRadius:8,padding:".3rem .65rem",marginBottom:".6rem",flexWrap:"wrap"}}>
      <span style={{fontSize:".58rem",color:C.gris}}>📊 Période précédente ({fmtPLabel(dernierHist.periode||pCourant-1)}) :</span>
      <span style={{fontSize:".65rem",fontWeight:700,color:C.rose}}>💰 {dernierHist.ca||0}€</span>
      <span style={{fontSize:".65rem",fontWeight:700,color:C.brun}}>🛍️ {dernierHist.caPerso||0}€ perso</span>
      <span style={{fontSize:".65rem",fontWeight:700,color:C.lilas}}>👥 {dernierHist.recruesReal||0} recrues</span>
    </div>
  ):null;

  const pctCA=()=>{if(!obj.caObj||!obj.ca)return 0;return Math.min(100,Math.round(+obj.ca/+obj.caObj*100));};
  const pctR=()=>{if(!obj.recruesObj||obj.recruesObj==="0"||!obj.recruesReal)return 0;return Math.min(100,Math.round(+obj.recruesReal/+obj.recruesObj*100));};
  const pct=(r,o)=>{if(!o||!r)return 0;return Math.min(100,Math.round(+r/+o*100));};

  const checkAndCelebrate=(nextObj)=>{
    const wasNot100CA=pctCA()<100,wasNot100R=pctR()<100;
    const nextPctCA=(!nextObj.caObj||!nextObj.ca)?0:Math.min(100,Math.round(+nextObj.ca/+nextObj.caObj*100));
    const nextPctR=(!nextObj.recruesObj||nextObj.recruesObj==="0"||!nextObj.recruesReal)?0:Math.min(100,Math.round(+nextObj.recruesReal/+nextObj.recruesObj*100));
    if((wasNot100CA&&nextPctCA>=100)||(wasNot100R&&nextPctR>=100))setConfettiTrigger(t=>t+1);
    if(wasNot100CA&&nextPctCA>=100&&uid&&userName)postToWallOfFame(uid,userName,"a atteint son objectif CA ! 💰","🎉");
    if(wasNot100R&&nextPctR>=100&&uid&&userName)postToWallOfFame(uid,userName,"a atteint son objectif recrutement ! 👥","🎉");
    save(nextObj);
  };

  const historique=obj.historique||[];
  const snapshotNow=()=>{
    const entry={date:todayLocalStr(),ca:+obj.ca||0,caObj:+obj.caObj||0,caPerso:+obj.caPerso||0,recruesReal:+obj.recruesReal||0,recruesObj:+obj.recruesObj||0,palier:obj.palier||"2%"};
    return [...historique,entry].slice(-24);
  };

  const resetPeriode=async()=>{
    const hist=snapshotNow();
    const next={...obj,ca:"",caObj:"",caPerso:"",caEquipe:"",recruesReal:"0",historique:hist};
    const totalCaCumul=(+obj.totalCaCumul||0)+(+obj.ca||0);
    const totalRecruesCumul=(+obj.totalRecruesCumul||0)+(+obj.recruesReal||0);
    checkAndCelebrate({...next,totalCaCumul,totalRecruesCumul});
  };

  const enregistrerPoint=()=>{save({...obj,historique:snapshotNow()});};
  const comparaisonPeriode=(hist,valActuelle,key)=>{if(!hist||hist.length<1)return null;const last=hist[hist.length-1];const prev=last[key]||0;const curr=+valActuelle||0;const diff=curr-prev;const pct2=prev?Math.round(diff/prev*100):0;return{diff,previous:prev,pct:pct2};};

  const PALIERS_PERSO=["2%","4%","6%","8%","10%","12%","14%","17%","SR","Directeur","Structural","Business Director","SR Business Director","Business"];
  const currentPalierIdx=PALIERS_PERSO.indexOf(obj.palier||"2%");
  const nextPalier=currentPalierIdx<PALIERS_PERSO.length-1?PALIERS_PERSO[currentPalierIdx+1]:null;

  // Mini graphique inline
  const MiniGraph=({data,dataKey,color,label,onClick})=>{
    if(!data||data.length<2)return null;
    const vals=data.map(d=>+d[dataKey]||0);
    const max=Math.max(...vals,1);
    const w=120,h=50;
    const pts=vals.map((v,i)=>`${Math.round(i/(vals.length-1)*w)},${Math.round(h-(v/max*h*.85+h*.05))}`).join(" ");
    return(
      <div onClick={onClick} style={{flex:1,minWidth:0,cursor:"pointer",padding:".4rem",background:C.blanc,borderRadius:9,border:`1px solid ${C.pale}`,transition:"transform .15s"}} title="Cliquer pour agrandir">
        <div style={{fontSize:".58rem",color:C.gris,marginBottom:".2rem",fontWeight:600}}>{label}</div>
        <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",height:50,display:"block"}}>
          <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} fillOpacity={.12} stroke="none"/>
        </svg>
        <div style={{fontSize:".55rem",color,fontWeight:700,textAlign:"right",marginTop:".1rem"}}>{vals[vals.length-1]}</div>
      </div>
    );
  };

  // Graphique en grand (popup)
  const GrandGraph=({data,dataKey,color,label,unit=""})=>{
    const vals=data.map(d=>+d[dataKey]||0);
    const dates=data.map(d=>d.date?.slice(5)||"");
    const max=Math.max(...vals,1);
    const w=280,h=120;
    const pts=vals.map((v,i)=>`${Math.round(i/(vals.length-1)*w)},${Math.round(h-(v/max*h*.85+h*.05))}`).join(" ");
    return(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}} onClick={()=>setGraphEnGros(null)}>
        <div style={{background:C.blanc,borderRadius:16,padding:"1.25rem",width:"90%",maxWidth:360}} onClick={e=>e.stopPropagation()}>
          <div style={{fontFamily:"Georgia,serif",fontSize:".95rem",fontWeight:600,color:C.brun,marginBottom:".75rem"}}>{label}</div>
          <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",height:140,display:"block",marginBottom:".5rem"}}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} fillOpacity={.1} stroke="none"/>
            {vals.map((v,i)=>(
              <g key={i}>
                <circle cx={Math.round(i/(vals.length-1)*w)} cy={Math.round(h-(v/max*h*.85+h*.05))} r={3} fill={color}/>
                <text x={Math.round(i/(vals.length-1)*w)} y={h-2} textAnchor="middle" fontSize="7" fill={C.gris}>{dates[i]}</text>
              </g>
            ))}
          </svg>
          {vals.map((v,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:".65rem",color:C.gris,padding:".2rem 0",borderBottom:`1px solid ${C.pale}`}}>
              <span>{dates[i]||`Point ${i+1}`}</span>
              <span style={{fontWeight:700,color}}>{v}{unit}</span>
            </div>
          ))}
          <button onClick={()=>setGraphEnGros(null)} style={{width:"100%",marginTop:".75rem",background:C.brun,color:C.blanc,border:"none",borderRadius:9,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>Fermer</button>
        </div>
      </div>
    );
  };

  return(
    <div>
      <Confetti trigger={confettiTrigger}/>
      <Fireworks trigger={fireworksTrigger}/>
      {graphEnGros&&historique.length>=2&&<GrandGraph data={historique} dataKey={graphEnGros} color={graphEnGros==="recruesReal"?C.lilas:graphEnGros==="caPerso"?C.rose:C.brun} label={graphEnGros==="recruesReal"?"👥 Recrues":graphEnGros==="caPerso"?"🛍️ Ventes perso":"💰 CA total"} unit={graphEnGros==="recruesReal"?"":" €"}/>}

      {/* 1. PÉRIODE EN COURS */}
      <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:12,padding:".85rem 1rem",marginBottom:".75rem",color:C.blanc}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:".55rem",fontWeight:700,color:C.or,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".15rem"}}>⏱️ Période en cours</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,color:C.blanc}}>{fmtPLabel(pCourant)}</div>
            <div style={{fontSize:".65rem",color:C.pale}}>{raw.daysLeft}j {raw.hoursLeft}h restants</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{height:4,width:80,background:"rgba(255,255,255,.15)",borderRadius:10,overflow:"hidden",marginBottom:".2rem"}}>
              <div style={{height:"100%",background:C.or,width:raw.pctElapsed+"%",borderRadius:10}}/>
            </div>
            <div style={{fontSize:".58rem",color:C.pale}}>{raw.pctElapsed}% écoulé</div>
          </div>
        </div>
      </div>

      {/* Bouton confirmer objectifs posés */}
      {obj.objectifsPosesPeriode!==pCourant&&(
        <button onClick={()=>save({...obj,objectifsPosesPeriode:pCourant})}
          style={{width:"100%",background:C.creme,border:`1.5px dashed ${C.or}`,borderRadius:10,padding:".5rem",fontSize:".75rem",fontWeight:600,color:"#856404",fontFamily:"inherit",cursor:"pointer",marginBottom:".75rem"}}>
          ✅ Mes objectifs sont posés pour cette période
        </button>
      )}

      {/* Score période précédente */}
      {scorePrecBadge}

      {/* 2. TOTAL DEPUIS LE DÉBUT */}
      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem .85rem",marginBottom:".75rem"}}>
        <div style={{fontSize:".55rem",fontWeight:700,color:C.gris,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".3rem"}}>🏆 Total depuis le début</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",fontWeight:700,color:C.brun}}>{(+obj.totalCaCumul||0)+(+obj.ca||0)}€</div>
        <div style={{fontSize:".58rem",color:C.gris}}>{(+obj.totalRecruesCumul||0)+(+obj.recruesReal||0)} recrues total</div>
      </div>

      {/* 3. PALIER À ATTEINDRE */}
      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem 1rem",marginBottom:".75rem"}}>
        <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.or,marginBottom:".5rem"}}>🎯 Palier à atteindre</div>
        <div style={{display:"flex",gap:".4rem",flexWrap:"wrap"}}>
          {PALIERS_PERSO.map((p,idx)=>(
            <button key={p} onClick={()=>save({...obj,palier:p})}
              style={{padding:".3rem .55rem",fontSize:".65rem",fontWeight:600,borderRadius:8,border:`1.5px solid ${obj.palier===p?C.or:C.pale}`,background:idx<currentPalierIdx?"#E8F5E9":obj.palier===p?C.or+"20":C.blanc,color:idx<currentPalierIdx?C.vert:obj.palier===p?C.brun:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              {idx<currentPalierIdx?"✓ ":""}{p}
            </button>
          ))}
        </div>
        {nextPalier&&<div style={{fontSize:".65rem",color:C.gris,marginTop:".4rem"}}>Prochain palier → <strong style={{color:C.brun}}>{nextPalier}</strong></div>}
      </div>

      {/* 4. CHIFFRE D'AFFAIRES */}
      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:".75rem"}}>
        <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>💰 Chiffre d'affaires</div>
        <div style={{display:"flex",gap:".5rem",marginBottom:".6rem"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:".62rem",color:C.gris,marginBottom:".25rem"}}><T k="obj.objectif">Objectif (€)</T></div>
            <input type="number" placeholder="Ex: 500" value={obj.caObj||""} onChange={e=>save({...obj,caObj:e.target.value})}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".9rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none",fontWeight:600}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:".62rem",color:C.gris,marginBottom:".25rem"}}><T k="obj.ca_total">CA total = ventes équipe (€)</T></div>
            <input type="number" placeholder="Ex: 250" value={obj.ca||""} onChange={e=>checkAndCelebrate({...obj,ca:e.target.value,caEquipe:String(Math.max(0,(parseFloat(e.target.value)||0)-(parseFloat(obj.caPerso)||0)))})}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".9rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none",fontWeight:600}}/>
          </div>
        </div>
        <div style={{background:C.creme,borderRadius:9,padding:".45rem .7rem",marginBottom:".5rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%"}}><span style={{fontSize:".68rem",color:C.gris}}>🛍️ Dont mes ventes perso</span><span style={{fontSize:".62rem",color:C.gris}}>Objectif : <input type="number" placeholder="0" value={obj.caPersoObj||""} onChange={e=>save({...obj,caPersoObj:e.target.value})} style={{width:55,border:"1px solid "+C.rose+"40",borderRadius:6,padding:".2rem .35rem",fontSize:".72rem",fontFamily:"inherit",color:C.rose,background:"white",outline:"none",textAlign:"center"}}/> €</span></div>
          <div style={{display:"flex",gap:".4rem",alignItems:"center"}}>
            <span style={{fontSize:".62rem",color:C.gris,fontWeight:600,marginRight:".25rem"}}>Réalisé</span>
            <input type="number" placeholder="0" value={obj.caPerso||""} onChange={e=>{
              const perso=parseFloat(e.target.value)||0;
              save({...obj,caPerso:e.target.value,caEquipe:String(Math.max(0,(parseFloat(obj.ca)||0)-perso))});
            }} style={{width:70,border:`1px solid ${C.rose}40`,borderRadius:7,padding:".28rem .45rem",fontSize:".8rem",fontFamily:"inherit",color:C.brun,background:"white",outline:"none",fontWeight:600,textAlign:"right"}}/>
            <span style={{fontSize:".65rem",color:C.gris}}>€</span>
          </div>
        </div>
        <div style={{height:8,background:C.pale,borderRadius:10,overflow:"hidden",marginBottom:".3rem"}}>
          <div style={{height:"100%",background:pctCA()>=100?C.vert:C.rose,width:pctCA()+"%",borderRadius:10,transition:"width .4s"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:".62rem",color:C.gris}}>
          <span>CA équipe : {Math.max(0,(parseFloat(obj.ca)||0)-(parseFloat(obj.caPerso)||0))}€</span>
          <span style={{fontWeight:700,color:pctCA()>=100?C.vert:C.rose}}>{pctCA()}%</span>
        </div>
        {pctCA()>=100&&<div style={{textAlign:"center",fontSize:".75rem",color:C.vert,fontWeight:700,marginTop:".4rem"}}>🎉 Objectif CA atteint !</div>}

        {/* Recrues */}
        {obj.recruesObj&&obj.recruesObj!=="0"&&(
          <div style={{marginTop:".75rem",paddingTop:".6rem",borderTop:`1px solid ${C.pale}`}}>
            <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.lilas,marginBottom:".4rem"}}>👥 Recrues</div>
            <div style={{display:"flex",gap:".5rem"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem"}}>Objectif</div>
                <input type="number" placeholder="0" value={obj.recruesObj||""} onChange={e=>save({...obj,recruesObj:e.target.value})}
                  style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".38rem .55rem",fontSize:".82rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none",fontWeight:600}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem"}}>Réalisé</div>
                <input type="number" placeholder="0" value={obj.recruesReal||""} onChange={e=>checkAndCelebrate({...obj,recruesReal:e.target.value})}
                  style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".38rem .55rem",fontSize:".82rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none",fontWeight:600}}/>
              </div>
            </div>
            <div style={{height:6,background:C.pale,borderRadius:10,overflow:"hidden",marginTop:".4rem"}}>
              <div style={{height:"100%",background:pctR()>=100?C.vert:C.lilas,width:pctR()+"%",borderRadius:10}}/>
            </div>
          </div>
        )}
        {(!obj.recruesObj||obj.recruesObj==="0")&&(
          <button onClick={()=>save({...obj,recruesObj:"1"})} style={{marginTop:".5rem",background:"none",border:`1px dashed ${C.pale}`,borderRadius:8,padding:".35rem .65rem",fontSize:".68rem",color:C.gris,fontFamily:"inherit",cursor:"pointer",width:"100%"}}>
            + Ajouter un objectif recrutement
          </button>
        )}
      </div>

      {/* 5. CALCUL DU RESTE */}
      <ResteCalculateur obj={obj} save={save} distributeurs={distributeurs}/>

      {/* 6. GRAPHIQUES CÔTE À CÔTE */}
      {historique.length>=2&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem",marginBottom:".75rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".6rem"}}>
            <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.gris}}>📈 Évolution</div>
            <button onClick={enregistrerPoint} style={{background:C.lilas,color:"white",border:"none",borderRadius:7,padding:".22rem .55rem",fontSize:".62rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>+ Point</button>
          </div>
          <div style={{display:"flex",gap:".5rem"}}>
            <MiniGraph data={historique} dataKey="ca" color={C.brun} label="💰 CA total" onClick={()=>setGraphEnGros("ca")}/>
            <MiniGraph data={historique} dataKey="caPerso" color={C.rose} label="🛍️ Ventes perso" onClick={()=>setGraphEnGros("caPerso")}/>
            <MiniGraph data={historique} dataKey="recruesReal" color={C.lilas} label="👥 Recrues" onClick={()=>setGraphEnGros("recruesReal")}/>
          </div>
          <div style={{fontSize:".58rem",color:C.pale,textAlign:"center",marginTop:".4rem"}}>Clique sur un graphique pour l'agrandir</div>
        </div>
      )}

      {/* 7. PRIMES DE QUALIFICATION */}
      <PrimesAccordeon obj={obj} save={save} onPrimeValidee={()=>setFireworksTrigger(t=>t+1)}/>
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
          const data=snap.data();
          setMembres(Array.isArray(data.liste)?data.liste:Object.values(data.liste||{}));
          setChefs(Array.isArray(data.chefs)?data.chefs:Object.values(data.chefs||{}));
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
      const existing = annuaire[membreUid] || {uid:membreUid, prenom:"", nom:"", dateEnreg:todayLocalStr()};
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
    const listeActuelle=Array.isArray(membres)?membres:[];
    if(listeActuelle.includes(full))return;
    const next=[...listeActuelle,full];
    setMembres(next);
    await saveAll(next,Array.isArray(chefs)?chefs:[]);
    setNewMembre({prenom:"",nom:""});
  };

  const remove=async(m)=>{
    if(!window.confirm(`Supprimer l'accès de ${fmt(m)} ? Cette personne ne pourra plus se connecter.`))return;
    const nextM=membres.filter(x=>x!==m);
    const nextC=chefs.filter(x=>x!==m);
    setMembres(nextM);setChefs(nextC);
    await saveAll(nextM,nextC);
    // Bloquer aussi dans Firebase users
    try{
      const mUid=m.toLowerCase().replace(/\s+/g,"-");
      await setDoc(doc(db,"users",mUid),{accesBloqueAdmin:true},{merge:true});
    }catch{}
    try{const snapMe=await getDoc(doc(db,"users",uid));if(snapMe.exists()&&snapMe.data()["db-distributeurs"]){const distList=JSON.parse(snapMe.data()["db-distributeurs"]);const mNom=m.toLowerCase().trim();const nextD=distList.filter(d=>((d.prenom||"")+" "+(d.nom||"")).toLowerCase().trim()!==mNom);if(nextD.length!==distList.length)await setDoc(doc(db,"users",uid),{"db-distributeurs":JSON.stringify(nextD)},{merge:true});}}catch{}
  };
  const [pauses,setPauses]=useState({});
  const togglePause=async(m)=>{
    const mUid=m.toLowerCase().replace(/\s+/g,"-");
    const estPause=pauses[mUid]||false;
    const next={...pauses,[mUid]:!estPause};
    setPauses(next);
    try{
      await setDoc(doc(db,"users",mUid),{accesPause:!estPause},{merge:true});
      await setDoc(doc(db,"acces","pauses"),{[mUid]:!estPause},{merge:true});
    }catch{}
  };

  // Charger les pauses
  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"acces","pauses"));
        if(snap.exists())setPauses(snap.data());
      }catch{}
    })();
  },[]);

  const toggleChef=async(m)=>{
    const isChef=(Array.isArray(chefs)?chefs:Object.values(chefs||{})).includes(m);
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
        const isChef=(Array.isArray(chefs)?chefs:Object.values(chefs||{})).includes(m);
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
              <button onClick={()=>togglePause(m)}
                style={{background:pauses[m.toLowerCase().replace(/\s+/g,"-")]?"#FFF3CD":"none",border:`1px solid ${pauses[m.toLowerCase().replace(/\s+/g,"-")]?"#E6A817":C.pale}`,borderRadius:6,padding:".2rem .55rem",color:pauses[m.toLowerCase().replace(/\s+/g,"-")]?"#856404":C.gris,cursor:"pointer",fontSize:".65rem",fontFamily:"inherit"}}>
                {pauses[m.toLowerCase().replace(/\s+/g,"-")]?"⏸️ En pause":"⏸️"}
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
export function MembreStatsCard({m, expanded, onToggleExpand}){
  const pct=(r,o)=>{if(!o||!r)return 0;return Math.min(100,Math.round(+r/+o*100));};
  const hist = m.historique || [];
  const compCA = comparaisonPeriode(hist, m.ca, "ca");
  const compR = comparaisonPeriode(hist, m.recruesReal, "recruesReal");
  const[extra,setExtra]=useState(null);
  const[loadingExtra,setLoadingExtra]=useState(false);
  const fmt=(id)=>id.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");

  // Charge les données complètes depuis Firebase quand on ouvre la fiche
  useEffect(()=>{
    if(!expanded||!m.uid)return;
    setLoadingExtra(true);
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"users",m.uid));
        let liensReseaux=[];
        try{
          const linkSnap=await getDoc(doc(db,"linkbio",m.uid));
          if(linkSnap.exists()){
            const lb=linkSnap.data();
            const labels=lb.liensBonusLabel||[];
            const urls=lb.liensBonusUrl||[];
            liensReseaux=labels.map((lbl,i)=>({label:lbl,url:urls[i]})).filter(l=>l.label&&l.url);
          }
        }catch{}
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
            liensReseaux,
          });
        }
      }catch{}
      setLoadingExtra(false);
    })();
  },[expanded,m.uid]);

  const today=todayLocalStr();
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

              {/* Fast Start — interface identique à la formation */}
              {extra.fastStart&&(
                <div style={{marginBottom:".75rem"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".6rem"}}>
                    <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose}}>🚀 Suivi Fast Start</div>
                    <div style={{fontSize:".62rem",color:C.gris}}>
                      J1 : {extra.fastStart.startDate?new Date(extra.fastStart.startDate).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}):"—"}
                    </div>
                  </div>

                  {/* Progression globale */}
                  {(()=>{
                    const totalTaches=FAST_START_DAYS.reduce((s,d2)=>s+d2.taches.length,0);
                    const done=FAST_START_DAYS.reduce((s,d2)=>s+d2.taches.filter((_,i)=>extra.fastStart.doneTasks?.[`${d2.jour}-${i}`]).length,0);
                    const modulesValides=Object.values(extra.fastStart.modulesValides||{}).filter(Boolean).length;
                    const p=Math.round(done/totalTaches*100);
                    return(
                      <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:10,padding:".6rem .85rem",marginBottom:".6rem"}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:".3rem"}}>
                          <span style={{fontSize:".65rem",color:C.or,fontWeight:700}}>Progression globale</span>
                          <span style={{fontSize:".65rem",color:C.pale}}>{modulesValides}/7 modules validés</span>
                        </div>
                        <div style={{height:6,background:"rgba(255,255,255,.2)",borderRadius:10,overflow:"hidden",marginBottom:".2rem"}}>
                          <div style={{height:"100%",background:p>=100?C.vert:C.or,width:p+"%",borderRadius:10,transition:"width .5s"}}/>
                        </div>
                        <div style={{fontSize:".6rem",color:C.pale}}>{done}/{totalTaches} tâches · {p}%</div>
                      </div>
                    );
                  })()}

                  {/* Modules détaillés — même interface que FastStartTab */}
                  {FAST_START_DAYS.map(d2=>{
                    const moduleValide=extra.fastStart.modulesValides?.[d2.jour];
                    const prevValide=d2.jour===1?true:!!extra.fastStart.modulesValides?.[d2.jour-1];
                    const isLocked=!prevValide&&!moduleValide;
                    const tachesDone=d2.taches.filter((_,i)=>extra.fastStart.doneTasks?.[`${d2.jour}-${i}`]).length;
                    const total=d2.taches.length;
                    const dayDone=tachesDone===total;
                    return(
                      <div key={d2.jour} style={{background:moduleValide?C.vert+"08":C.blanc,border:`1.5px solid ${moduleValide?C.vert:dayDone?C.vert+"60":isLocked?C.pale:C.rose}`,borderRadius:12,padding:".75rem .9rem",marginBottom:".5rem",opacity:isLocked?.5:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:".6rem",marginBottom:dayDone?".4rem":0}}>
                          <div style={{width:28,height:28,borderRadius:"50%",background:moduleValide?C.vert:isLocked?C.pale:C.rose,color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".75rem",fontWeight:700,flexShrink:0}}>
                            {moduleValide?"✓":isLocked?"🔒":d2.jour}
                          </div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:".75rem",fontWeight:700,color:moduleValide?C.vert:isLocked?C.gris:C.brun}}>{d2.titre}</div>
                            <div style={{height:3,background:C.pale,borderRadius:10,overflow:"hidden",marginTop:".25rem"}}>
                              <div style={{height:"100%",background:moduleValide?C.vert:C.rose,width:(tachesDone/total*100)+"%",borderRadius:10}}/>
                            </div>
                          </div>
                          <div style={{fontSize:".65rem",fontWeight:700,color:moduleValide?C.vert:C.gris,flexShrink:0}}>
                            {moduleValide?"✅ Validé":isLocked?"Verrouillé":`${tachesDone}/${total}`}
                          </div>
                        </div>

                        {/* Tâches détaillées */}
                        {!isLocked&&(
                          <div style={{paddingLeft:".5rem"}}>
                            {d2.taches.map((tache,i)=>{
                              const done2=!!extra.fastStart.doneTasks?.[`${d2.jour}-${i}`];
                              const txt=typeof tache==="string"?tache:tache.t;
                              return(
                                <div key={i} style={{display:"flex",alignItems:"flex-start",gap:".45rem",padding:".25rem 0",borderBottom:i<d2.taches.length-1?`1px solid ${C.pale}30`:"none"}}>
                                  <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${done2?C.vert:C.pale}`,background:done2?C.vert:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:".1rem"}}>
                                    {done2&&<span style={{color:"white",fontSize:".55rem",fontWeight:700}}>✓</span>}
                                  </div>
                                  <span style={{fontSize:".7rem",color:done2?C.vert:C.texte,textDecoration:done2?"line-through":"none",lineHeight:1.5}}>{txt}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!extra.fastStart&&(
                <div style={{background:C.creme,borderRadius:9,padding:".65rem",marginBottom:".75rem",textAlign:"center"}}>
                  <div style={{fontSize:".72rem",color:C.gris,marginBottom:".4rem"}}>🚀 Pas encore de Fast Start assigné</div>
                </div>
              )}

              {/* Liens réseaux sociaux — toujours visible */}
              <LiensReseauxSection memberUid={m.uid}/>

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
        const isChef = isMelissa || (Array.isArray(chefs)?chefs:Object.values(chefs||{})).includes(uid.replace(/-/g," "));
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
        const periodeNum = getPeriodeActuelle();
        const periodeKey = `p${periodeNum}`;
        const debutPeriode = getPeriodeDebut(periodeNum);
        const joursDansLaPeriode = Math.min(
          Math.floor((Date.now()-debutPeriode.getTime())/(1000*60*60*24))+1, 21
        );

        const results = await Promise.all(targetUids.map(async(mUid)=>{
          try{
            const snap=await getDoc(doc(db,"users",mUid));
            if(!snap.exists())return {uid:mUid, noData:true};
            const data=snap.data();
            const actionsRaw = data["db-actions"] ? JSON.parse(data["db-actions"]) : {};
            const todayStr = todayLocalStr();
            const isToday = actionsRaw._date === todayStr;
            const {_date, ...actionsSeules} = actionsRaw;
            const doneToday = isToday ? Object.values(actionsSeules).filter(Boolean).length : 0;
            const assiduite = data["db-assiduite"] ? JSON.parse(data["db-assiduite"]) : {};
            const joursActifs = assiduite[periodeKey]?.jours?.length || 0;
            return {
              uid:mUid,
              lastLogin: data["db-last-login"]||null,
              streak: +data["db-streak"]||0,
              doneToday,
              joursActifs,
              joursDansLaPeriode,
              periodeNum,
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

  const today=todayLocalStr();
  const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Assiduité <em style={{fontStyle:"italic",color:C.rose}}>Équipe</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Connexions, actions du jour et score de la période P{membres[0]?.periodeNum||""} · {membres.length} membre{membres.length>1?"s":""}.
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
        const joursActifs = m.joursActifs||0;
        const joursDispo = m.joursDansLaPeriode||1;
        const scorePct = Math.round(joursActifs/joursDispo*100);

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
                  <div style={{fontSize:".64rem",color:C.gris}}>Aujourd'hui : {doneToday}/{TODAY_ACTIONS_COUNT}</div>
                  {/* Score période */}
                  <div style={{fontSize:".68rem",fontWeight:700,color:scorePct>=80?C.vert:scorePct>=50?C.or:"#C0504D",marginTop:".1rem"}}>
                    📈 {joursActifs}/{joursDispo}j
                  </div>
                </div>
              )}
            </div>

            {!m.noData&&(
              <div style={{marginTop:".5rem"}}>
                <div style={{display:"flex",gap:"3px",marginBottom:".35rem"}}>
                  {Array.from({length:TODAY_ACTIONS_COUNT}).map((_,i)=>(
                    <div key={i} style={{flex:1,height:5,borderRadius:3,background:i<doneToday?C.rose:C.pale}}/>
                  ))}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:".4rem"}}>
                  <span style={{fontSize:".58rem",color:C.gris,flexShrink:0}}>P{m.periodeNum} :</span>
                  <div style={{flex:1,height:5,background:C.pale,borderRadius:10,overflow:"hidden"}}>
                    <div style={{height:"100%",background:scorePct>=80?C.vert:scorePct>=50?C.or:"#C0504D",width:scorePct+"%",borderRadius:10}}/>
                  </div>
                  <span style={{fontSize:".6rem",fontWeight:700,color:scorePct>=80?C.vert:scorePct>=50?C.or:"#C0504D",flexShrink:0}}>{joursActifs}/{joursDispo}j</span>
                </div>
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
  {id:"stats",icon:"📊",label:"Statistiques équipe",desc:"Taux d'utilisation, conversion, diagnostics — chiffres pour recruter",chefOnly:true},
  {id:"challengeapp",icon:"🎮",label:"Challenge Découverte App",desc:"Progression de chaque membre dans le défi 7 jours",chefOnly:true},
  {id:"membres",icon:"⚙️",label:"Accès équipe",desc:"Gérer les membres, chefs, et assigner les marraines",chefOnly:true},
  {id:"assiduite",icon:"📋",label:"Assiduité équipe",desc:"Connexions et actions du jour de chaque membre",chefOnly:true},
  {id:"suivica",icon:"📈",label:"Suivi CA",desc:"Ton chiffre d'affaires période par période avec historique",chefOnly:false},
  {id:"actionsbiblio",icon:"💡",label:"Actions biblio",desc:"Ajouter des actions à la bibliothèque partagée de toute l'équipe",chefOnly:false},
  {id:"defi",icon:"🚀",label:"Challenge Flash",desc:"Lancer un défi collectif pour toute l'équipe",chefOnly:true},
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



// ── ACTIONS BIBLIO CHEF ───────────────────────────────────────────────────────
function ActionsBiblioChefTab({uid}){
  const[actions,setActions]=useState([]);
  const[loading,setLoading]=useState(true);
  const[form,setForm]=useState({icon:"⚡",label:"",cat:"ventes"});
  const[saving,setSaving]=useState(false);
  const[showAdd,setShowAdd]=useState(false);

  const CATS=[
    {id:"ventes",label:"🛍️ Ventes"},
    {id:"recrutement",label:"👥 Recrutement"},
    {id:"algorithme",label:"⚡ Algorithme"},
    {id:"equipe",label:"✨ Équipe"},
  ];

  const ICONS=["⚡","💡","🎯","🔥","💪","🌟","✨","🎉","💬","📱","🤝","🏆","💰","🌸","🎥","📸","🌈","💎","🚀","❤️"];

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","actions_biblio"));
        if(snap.exists()) setActions(snap.data().items||[]);
      }catch{}
      setLoading(false);
    })();
  },[]);

  const save=async(next)=>{
    setActions(next);
    try{await setDoc(doc(db,"admin","actions_biblio"),{items:next},{merge:false});}catch{}
  };

  const add=async()=>{
    if(!form.label.trim())return;
    setSaving(true);
    const next=[...actions,{
      id:`chef-${Date.now()}`,
      icon:form.icon,
      label:form.label.trim(),
      cat:form.cat,
      ajoutePar:uid,
      ts:Date.now(),
    }];
    await save(next);
    setForm({icon:"⚡",label:"",cat:"ventes"});
    setShowAdd(false);
    setSaving(false);
  };

  const del=async(id)=>save(actions.filter(a=>a.id!==id));

  if(loading) return <div style={{padding:"2rem",textAlign:"center",color:C.gris,fontSize:".76rem"}}>Chargement...</div>;

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Actions <em style={{fontStyle:"italic",color:C.rose}}>Bibliothèque</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Les actions que tu ajoutes ici apparaissent dans l'onglet <strong>✨ Équipe</strong> de la bibliothèque d'actions de toutes les membres.
      </p>

      <button onClick={()=>setShowAdd(!showAdd)}
        style={{width:"100%",background:showAdd?C.pale:C.brun,color:showAdd?C.gris:C.blanc,border:"none",borderRadius:10,padding:".65rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:"1rem"}}>
        {showAdd?"✕ Annuler":"+ Ajouter une action"}
      </button>

      {showAdd&&(
        <div style={{background:C.blanc,border:`1px solid ${C.rose}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          {/* Icône */}
          <div style={{fontSize:".6rem",color:C.gris,marginBottom:".3rem"}}>Icône</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:".3rem",marginBottom:".7rem"}}>
            {ICONS.map(ic=>(
              <button key={ic} onClick={()=>setForm(f=>({...f,icon:ic}))}
                style={{background:form.icon===ic?C.brun:"none",border:`1px solid ${form.icon===ic?C.brun:C.pale}`,borderRadius:8,padding:".3rem .4rem",fontSize:".9rem",cursor:"pointer"}}>
                {ic}
              </button>
            ))}
          </div>

          {/* Catégorie */}
          <div style={{fontSize:".6rem",color:C.gris,marginBottom:".3rem"}}>Catégorie</div>
          <div style={{display:"flex",gap:".3rem",flexWrap:"wrap",marginBottom:".7rem"}}>
            {CATS.map(c=>(
              <button key={c.id} onClick={()=>setForm(f=>({...f,cat:c.id}))}
                style={{padding:".3rem .65rem",fontSize:".68rem",fontWeight:600,borderRadius:20,border:`1px solid ${form.cat===c.id?C.rose:C.pale}`,background:form.cat===c.id?C.rose:C.blanc,color:form.cat===c.id?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
                {c.label}
              </button>
            ))}
          </div>

          {/* Label */}
          <div style={{fontSize:".6rem",color:C.gris,marginBottom:".3rem"}}>Description de l'action</div>
          <input value={form.label} onChange={e=>setForm(f=>({...f,label:e.target.value}))}
            placeholder="ex: Envoyer 3 messages de prospection..."
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".5rem .7rem",fontSize:".82rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".7rem"}}/>

          <button onClick={add} disabled={!form.label.trim()||saving}
            style={{width:"100%",background:form.label.trim()?C.brun:C.pale,color:form.label.trim()?C.blanc:C.gris,border:"none",borderRadius:8,padding:".55rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:form.label.trim()?"pointer":"default"}}>
            {saving?"Sauvegarde...":"✓ Publier dans la bibliothèque"}
          </button>
        </div>
      )}

      {/* Liste des actions ajoutées */}
      {actions.length===0&&!showAdd&&(
        <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".76rem"}}>
          <div style={{fontSize:"2rem",marginBottom:".5rem"}}>💡</div>
          Aucune action ajoutée pour l'instant.
        </div>
      )}

      {CATS.map(c=>{
        const items=actions.filter(a=>a.cat===c.id);
        if(items.length===0)return null;
        return(
          <div key={c.id} style={{marginBottom:"1rem"}}>
            <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.gris,marginBottom:".4rem",padding:".2rem .6rem",background:C.pale,borderRadius:20,display:"inline-block"}}>{c.label}</div>
            {items.map(a=>(
              <div key={a.id} style={{display:"flex",alignItems:"center",gap:".6rem",background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:10,padding:".6rem .85rem",marginBottom:".35rem"}}>
                <span style={{fontSize:"1rem"}}>{a.icon}</span>
                <div style={{flex:1,fontSize:".78rem",color:C.texte}}>{a.label}</div>
                <button onClick={()=>del(a.id)}
                  style={{background:"none",border:"none",color:C.pale,cursor:"pointer",fontSize:".75rem",padding:".1rem .3rem",fontFamily:"inherit"}}>✕</button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// Composant global — JAMAIS défini à l'intérieur d'un autre composant
function GrilleJoursCA({pNum, color, courante=false, joursEcoules, data, editCell, editVal, setEditCell, setEditVal, saveJour, setEditPeriode, setEditCA, setEditObj}){
  const d=data[`p${pNum}`]||{ca:0,obj:0,jours:{}};
  const debut=getPeriodeDebut(pNum);
  const _n=new Date();const _t=new Date(_n.getFullYear(),_n.getMonth(),_n.getDate(),12,0,0);const _dj=Math.floor((_t.getTime()-debut.getTime())/(24*60*60*1000));const _je=courante?Math.min(21,Math.max(0,_dj+1)):joursEcoules;const isFutur=(i)=>courante&&i>=_je;const isToday=(i)=>courante&&i===_je-1;
  const pct=(ca,obj)=>obj?Math.min(100,Math.round((ca||0)/obj*100)):0;
  const fmtJour=(d2)=>d2.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'});
  return(
    <div>
      <div style={{background:courante?`linear-gradient(135deg,${C.brun},${C.brun2})`:color+'15',padding:'.5rem .5rem .4rem',borderBottom:`1px solid ${color}30`}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontSize:'.6rem',fontWeight:700,color:courante?C.or:color}}>{fmtPLabel(pNum)}</div>
          <button onClick={()=>{setEditPeriode(pNum);setEditCA(d.ca||'');setEditObj(d.obj||'');}}
            style={{background:'none',border:`1px solid ${courante?'rgba(255,255,255,.25)':color+'40'}`,borderRadius:5,padding:'.1rem .35rem',fontSize:'.52rem',color:courante?C.pale:color,cursor:'pointer',fontFamily:'inherit'}}>✏️</button>
        </div>
        <div style={{fontFamily:'Georgia,serif',fontSize:'.95rem',fontWeight:700,color:courante?C.blanc:color}}>
          {fmtPLabel(pNum)}
        </div>
        <div style={{height:3,background:courante?'rgba(255,255,255,.15)':C.pale,borderRadius:10,overflow:'hidden',marginTop:'.3rem'}}>
          <div style={{height:'100%',background:courante?C.or:color,width:pct(d.ca,d.obj)+'%',borderRadius:10}}/>
        </div>
      </div>
      {Array.from({length:21},(_,i)=>{
        const dateJour=new Date(debut.getTime()+i*24*60*60*1000);
        const val=d.jours?.[i];
        const editing=editCell?.pNum===pNum&&editCell?.jourIdx===i;
        return(
          <div key={i} onClick={()=>!isFutur(i)&&!editing&&(setEditCell({pNum,jourIdx:i}),setEditVal(val||''))}
            style={{display:'flex',alignItems:'center',gap:'.3rem',padding:'.26rem .45rem',borderBottom:`1px solid ${C.pale}20`,background:isToday(i)?C.rose+'25':val>0?C.vert+'08':'transparent',cursor:isFutur(i)?'default':'pointer',opacity:isFutur(i)?.35:1}}>
            <div style={{flex:1}}>
              <div style={{fontSize:'.54rem',color:isToday(i)?C.rose:C.gris,fontWeight:isToday(i)?700:400,lineHeight:1.2}}>{fmtJour(dateJour)}</div>
            </div>
            {editing
              ?<input autoFocus type='number' defaultValue={val||''}
                  onChange={e=>setEditVal(e.target.value)}
                  onBlur={()=>saveJour(pNum,i,editVal)}
                  onKeyDown={e=>e.key==='Enter'&&saveJour(pNum,i,editVal)}
                  style={{width:44,border:`1px solid ${color}`,borderRadius:4,background:'white',textAlign:'right',fontSize:'.65rem',fontWeight:700,outline:'none',padding:'.1rem .25rem',color:C.brun}}/>
              :<div style={{fontSize:'.65rem',fontWeight:700,color:val>0?C.vert:isFutur(i)?C.pale:C.gris+'80',textAlign:'right',minWidth:36}}>
                {val>0?val+'€':'—'}
              </div>
            }
          </div>
        );
      })}
    </div>
  );
}

// ── SUIVI CHALLENGE APP PAR LE CHEF ──────────────────────────────────────────
function ChallengeAppSuiviTab({annuaire}){
  const[membres,setMembres]=useState([]);
  const[loading,setLoading]=useState(true);

  useEffect(()=>{
    (async()=>{
      const liste=Object.entries(annuaire||{});
      const today=new Date();
      today.setHours(0,0,0,0);

      const resultats=await Promise.all(
        liste.map(async([mUid,mData])=>{
          try{
            const snap=await getDoc(doc(db,"users",mUid));
            if(!snap.exists())return null;
            const d=snap.data();
            const ca=d["db-challenge-app"]?JSON.parse(d["db-challenge-app"]):null;
            if(!ca)return{uid:mUid,nom:mData.prenom||mUid,statut:"non_commence",joursValides:[],jourActuel:0,pct:0};

            const startDate=new Date(ca.startDate);
            startDate.setHours(0,0,0,0);
            const diffJours=Math.floor((today-startDate)/(1000*60*60*24));
            const jourActuel=Math.max(0,Math.min(diffJours+1,7));
            const joursValides=ca.joursValides||[];
            const termine=diffJours>=7;
            const pct=Math.round((joursValides.length/7)*100);
            const dateEnreg=mData.dateEnreg||ca.startDate;

            return{
              uid:mUid,
              nom:mData.prenom||mUid,
              statut:termine?"termine":jourActuel===0?"demarre_demain":"actif",
              joursValides,
              jourActuel:Math.max(jourActuel,0),
              pct,
              startDate:ca.startDate,
              dateEnreg,
            };
          }catch{return null;}
        })
      );

      setMembres(resultats.filter(Boolean).sort((a,b)=>b.pct-a.pct||b.joursValides.length-a.joursValides.length));
      setLoading(false);
    })();
  },[annuaire]);

  if(loading)return<div style={{textAlign:"center",padding:"2rem",color:C.gris}}>⏳ Chargement...</div>;

  const nbActifs=membres.filter(m=>m.statut==="actif"||m.statut==="termine").length;
  const nbTermines=membres.filter(m=>m.statut==="termine").length;
  const nbNonCommences=membres.filter(m=>m.statut==="non_commence").length;
  const pctMoyen=membres.length?Math.round(membres.reduce((s,m)=>s+m.pct,0)/membres.length):0;

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.3rem",fontWeight:300,color:C.brun,marginBottom:".75rem"}}>
        Challenge <em style={{fontStyle:"italic",color:C.rose}}>Découverte App</em>
      </div>

      {/* Résumé global */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:"1rem"}}>
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem",textAlign:"center"}}>
          <div style={{fontSize:"1.6rem",fontWeight:700,color:C.rose,fontFamily:"Georgia,serif"}}>{nbActifs}</div>
          <div style={{fontSize:".62rem",color:C.gris,fontWeight:600}}>En cours</div>
        </div>
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem",textAlign:"center"}}>
          <div style={{fontSize:"1.6rem",fontWeight:700,color:C.vert,fontFamily:"Georgia,serif"}}>{nbTermines}</div>
          <div style={{fontSize:".62rem",color:C.gris,fontWeight:600}}>Terminé 🏆</div>
        </div>
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem",textAlign:"center"}}>
          <div style={{fontSize:"1.6rem",fontWeight:700,color:C.or,fontFamily:"Georgia,serif"}}>{pctMoyen}%</div>
          <div style={{fontSize:".62rem",color:C.gris,fontWeight:600}}>Progression moyenne</div>
        </div>
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem",textAlign:"center"}}>
          <div style={{fontSize:"1.6rem",fontWeight:700,color:C.gris,fontFamily:"Georgia,serif"}}>{nbNonCommences}</div>
          <div style={{fontSize:".62rem",color:C.gris,fontWeight:600}}>Pas encore commencé</div>
        </div>
      </div>

      {/* Liste membres */}
      {membres.map((m,i)=>(
        <div key={m.uid} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".8rem 1rem",marginBottom:".5rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".5rem"}}>
            <div style={{display:"flex",alignItems:"center",gap:".5rem"}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:m.statut==="termine"?C.vert+"25":m.statut==="actif"?C.rose+"25":C.pale,color:m.statut==="termine"?C.vert:m.statut==="actif"?C.rose:C.gris,display:"flex",alignItems:"center",justifyContent:"center",fontSize:".78rem",fontWeight:700,flexShrink:0}}>
                {m.nom[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{fontSize:".82rem",fontWeight:600,color:C.brun}}>{m.nom}</div>
                <div style={{fontSize:".6rem",color:C.gris}}>
                  {m.statut==="termine"?"🏆 Challenge terminé !":
                   m.statut==="demarre_demain"?"⏳ Commence demain":
                   m.statut==="non_commence"?"❌ Pas encore commencé":
                   `📅 Jour ${m.jourActuel}/7 en cours`}
                </div>
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:".82rem",fontWeight:700,color:m.pct===100?C.vert:m.pct>=50?C.or:C.gris}}>{m.pct}%</div>
              <div style={{fontSize:".58rem",color:C.gris}}>{m.joursValides.length}/7 jours</div>
            </div>
          </div>

          {/* Barre progression avec cases par jour */}
          <div style={{display:"flex",gap:".2rem"}}>
            {CHALLENGE_APP_JOURS.map((j,ji)=>{
              const fait=m.joursValides.includes(j.jour);
              const estCejour=m.jourActuel===j.jour;
              return(
                <div key={ji} title={j.titre}
                  style={{flex:1,height:28,borderRadius:6,background:fait?C.vert:estCejour?C.or+"40":C.pale,border:`1px solid ${fait?C.vert:estCejour?C.or:C.pale}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:".7rem",position:"relative"}}>
                  {fait?"✓":estCejour?<span style={{fontSize:".6rem",fontWeight:700,color:C.or}}>J{j.jour}</span>:<span style={{fontSize:".55rem",color:C.gris}}>{j.jour}</span>}
                </div>
              );
            })}
          </div>

          {/* Détail des jours validés */}
          {m.joursValides.length>0&&(
            <div style={{marginTop:".4rem",display:"flex",flexWrap:"wrap",gap:".2rem"}}>
              {m.joursValides.sort((a,b)=>a-b).map(j=>(
                <span key={j} style={{fontSize:".58rem",background:C.vert+"15",color:C.vert,borderRadius:20,padding:".1rem .4rem",fontWeight:600}}>
                  ✓ J{j}: {CHALLENGE_APP_JOURS[j-1]?.emoji}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      {membres.length===0&&(
        <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>
          Aucun membre dans l'équipe pour l'instant.
        </div>
      )}
    </div>
  );
}

// ── STATISTIQUES ÉQUIPE ──────────────────────────────────────────────────────
function StatsEquipeTab({uid, annuaire}){
  const[stats,setStats]=useState(null);
  const[loading,setLoading]=useState(true);
  const[periode,setPeriode]=useState("30j");
  const[rechercheMembre,setRechercheMembre]=useState("");

  const fmt=(n,dec=0)=>typeof n==="number"?n.toFixed(dec):"-";
  const pct=(a,b)=>b>0?Math.round((a/b)*100):0;

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try{
        const membres=Object.entries(annuaire||{});
        if(!membres.length){setLoading(false);return;}

        const today=new Date();
        const cutoffJours=periode==="7j"?7:periode==="30j"?30:90;
        const cutoff=new Date(today-cutoffJours*24*60*60*1000).toISOString().slice(0,10);

        // Charger les données de chaque membre en parallèle
        const snapshots=await Promise.all(
          membres.map(([mUid])=>getDoc(doc(db,"users",mUid)).catch(()=>null))
        );

        let totalMembres=membres.length;
        let actifs=0;
        let streakTotal=0;
        let totalDiags=0;
        let totalDiagsAvecOrd=0;
        let totalProspects=0;
        let totalProspectsDepuisDiag=0;
        let totalConvertisClient=0;
        let totalConvertisDistrib=0;
        let totalClients=0;
        let totalCommandes=0;
        let totalCA=0;
        let totalRecommandations=0;
        let totalRecsConverties=0;
        let totalFastStartDone=0;
        let totalFastStartAssigne=0;
        let totalActions=0;
        let membresAvecDreamboard=0;
        let membresAvecLinkbio=0;
        let membreDetails=[];
        let diagParType={}; // comptage par type

        snapshots.forEach((snap,i)=>{
          if(!snap||!snap.exists())return;
          const d=snap.data();
          const [mUid,mData]=membres[i];

          const lastLogin=d["db-last-login"]||"";
          const estActif=lastLogin>=cutoff;
          if(estActif)actifs++;

          const streak=+d["db-streak"]||0;
          streakTotal+=streak;

          // Diagnostics
          const diags=d["db-diagnostics"]?JSON.parse(d["db-diagnostics"]):[];
          const diagsRecents=diags.filter(dg=>dg.date>=cutoff);
          totalDiags+=diagsRecents.length;
          const diagsAvecOrd=diagsRecents.filter(dg=>dg.ordonnance||dg.ordre);
          totalDiagsAvecOrd+=diagsAvecOrd.length;
          // Compter par type
          diagsRecents.forEach(dg=>{
            if(dg.type) diagParType[dg.type]=(diagParType[dg.type]||0)+1;
          });

          // Prospects
          const prospects=d["db-prospects"]?JSON.parse(d["db-prospects"]):[];
          const prospectsRecents=prospects.filter(p=>p.dateAjout>=cutoff||(p.id&&String(p.id).length===13&&new Date(+p.id)>=new Date(cutoff)));
          totalProspects+=prospectsRecents.length;
          const depuisDiag=prospects.filter(p=>p.source==="diagnostic").length;
          totalProspectsDepuisDiag+=depuisDiag;
          const convertisClient=prospects.filter(p=>p.convertiVers==="client").length;
          const convertisDistrib=prospects.filter(p=>p.convertiVers==="distributrice").length;
          totalConvertisClient+=convertisClient;
          totalConvertisDistrib+=convertisDistrib;

          // Recommandations
          const prospectsRec=prospects.filter(p=>p.source==="recommandation").length;
          totalRecommandations+=prospectsRec;
          totalRecsConverties+=prospects.filter(p=>p.source==="recommandation"&&p.convertiVers).length;

          // Clients et commandes
          const clients=d["db-clients"]?JSON.parse(d["db-clients"]):[];
          totalClients+=clients.length;
          clients.forEach(c=>{
            const cmds=(c.commandes||[]).filter(cmd=>cmd.date>=cutoff);
            totalCommandes+=cmds.length;
            totalCA+=cmds.reduce((s,cmd)=>s+(parseFloat(cmd.montant)||0),0);
          });

          // Fast Start
          const fs=d["db-fast-start"]?JSON.parse(d["db-fast-start"]):null;
          if(fs){
            totalFastStartAssigne++;
            const done=Object.values(fs.modulesValides||{}).filter(Boolean).length;
            if(done>=7)totalFastStartDone++;
          }

          // Actions biblio
          const actions=d["db-actions"]?JSON.parse(d["db-actions"]):{};
          const nbActions=Object.keys(actions).filter(k=>!k.startsWith("_")&&actions[k]).length;
          totalActions+=nbActions;

          // Dream board
          if(d["db-dreamboard"])membresAvecDreamboard++;

          membreDetails.push({
            uid:mUid,
            nom:mData.prenom||mUid.split("-").map(w=>w[0]?.toUpperCase()+w.slice(1)).join(" "),
            actif:estActif,
            lastLogin,
            streak,
            nbDiags:diagsRecents.length,
            nbDiagsAvecOrd:diagsAvecOrd.length,
            nbProspects:prospectsRecents.length,
            nbClients:clients.length,
            nbCommandes:totalCommandes,
            nbFsModules:fs?Object.values(fs.modulesValides||{}).filter(Boolean).length:0,
            fsDone:fs&&Object.values(fs.modulesValides||{}).filter(Boolean).length>=7,
          });
        });

        // Charger les recommandations depuis la collection recommandations
        try{
          const recSnap=await Promise.all(membres.map(([mUid])=>getDoc(doc(db,"recommandations",mUid)).catch(()=>null)));
          recSnap.forEach(s=>{if(s&&s.exists()){totalRecommandations+=(s.data().liste||[]).reduce((sum,r)=>sum+(r.personnes?.length||1),0);}});
        }catch{}

        const tauxUtilisation=pct(actifs,totalMembres);
        const tauxConvDiag=pct(totalProspectsDepuisDiag,totalDiags);
        const tauxConvProspect=pct(totalConvertisClient+totalConvertisDistrib,totalProspects+totalProspectsDepuisDiag);
        const tauxFastStart=pct(totalFastStartDone,totalFastStartAssigne||1);
        const tauxConvRec=pct(totalRecsConverties,totalRecommandations||1);

        setStats({
          totalMembres,actifs,tauxUtilisation,
          streakMoyen:totalMembres?Math.round(streakTotal/totalMembres):0,
          totalDiags,totalDiagsAvecOrd,tauxOrdonnance:pct(totalDiagsAvecOrd,totalDiags||1),
          totalProspects,totalProspectsDepuisDiag,tauxConvDiag,
          totalConvertisClient,totalConvertisDistrib,tauxConvProspect,
          totalClients,totalCommandes,totalCA:Math.round(totalCA),
          totalRecommandations,totalRecsConverties,tauxConvRec,
          totalFastStartAssigne,totalFastStartDone,tauxFastStart,
          totalActions,membresAvecDreamboard,
          diagParType,
          membreDetails:membreDetails.sort((a,b)=>b.nbDiags-a.nbDiags),
          cutoff,periode,
        });
      }catch(e){console.error(e);}
      setLoading(false);
    })();
  },[annuaire,periode]);

  const StatCard=({icon,label,value,sub,color,pctVal})=>(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem .85rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:".25rem"}}>
        <div style={{fontSize:".6rem",color:C.gris,fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>{icon} {label}</div>
        {pctVal!==undefined&&(
          <div style={{fontSize:".65rem",fontWeight:700,color:pctVal>=70?C.vert:pctVal>=40?"#E67E22":"#E74C3C",background:(pctVal>=70?C.vert:pctVal>=40?"#E67E22":"#E74C3C")+"15",borderRadius:20,padding:".1rem .4rem"}}>
            {pctVal}%
          </div>
        )}
      </div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.4rem",fontWeight:600,color:color||C.brun}}>{value}</div>
      {sub&&<div style={{fontSize:".62rem",color:C.gris,marginTop:".1rem"}}>{sub}</div>}
    </div>
  );

  if(loading)return(
    <div style={{textAlign:"center",padding:"2rem",color:C.gris}}>
      <div style={{fontSize:"1.5rem",marginBottom:".5rem"}}>📊</div>
      Analyse en cours...
    </div>
  );

  if(!stats)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Aucune donnée disponible.</div>;

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.3rem",fontWeight:300,color:C.brun,marginBottom:".5rem"}}>
        Statistiques <em style={{fontStyle:"italic",color:C.rose}}>Blazing Dynasty</em>
      </div>

      {/* Sélecteur de période */}
      <div style={{display:"flex",gap:".3rem",marginBottom:"1rem"}}>
        {["7j","30j","90j"].map(p=>(
          <button key={p} onClick={()=>setPeriode(p)}
            style={{flex:1,padding:".38rem",fontSize:".72rem",fontWeight:600,borderRadius:8,border:`1px solid ${periode===p?C.rose:C.pale}`,background:periode===p?C.rose:C.blanc,color:periode===p?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
            {p==="7j"?"7 jours":p==="30j"?"30 jours":"90 jours"}
          </button>
        ))}
      </div>

      {/* SECTION 1 — UTILISATION */}
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".45rem"}}>📱 Utilisation de l'application</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:"1rem"}}>
        <StatCard icon="👥" label="Membres actifs" value={`${stats.actifs}/${stats.totalMembres}`} sub={`Connectées sur les ${periode}`} pctVal={stats.tauxUtilisation} color={C.rose}/>
        <StatCard icon="🔥" label="Streak moyen" value={`${stats.streakMoyen}j`} sub="Jours de connexion consécutifs" color={C.or}/>
        <StatCard icon="⚡" label="Actions biblio" value={stats.totalActions} sub={`Actions validées équipe`} color={C.brun}/>
        <StatCard icon="🌟" label="Dream Boards" value={stats.membresAvecDreamboard} sub={`Membres avec un board actif`} color={C.lilas}/>
      </div>

      {/* SECTION 2 — DIAGNOSTICS */}
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".45rem"}}>🔬 Diagnostics & Ordonnances</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:".65rem"}}>
        <StatCard icon="📋" label="Diagnostics envoyés" value={stats.totalDiags} sub={`Sur les ${periode}`} color={C.brun}/>
        <StatCard icon="✨" label="Ordonnances générées" value={stats.totalDiagsAvecOrd} sub="Diagnostics avec résultat IA" pctVal={stats.tauxOrdonnance} color={C.rose}/>
        <StatCard icon="👤" label="Prospects créés / diag" value={stats.totalProspectsDepuisDiag} sub="Fiches créées depuis un diagnostic" color={C.or}/>
        <StatCard icon="🔄" label="Taux diag → prospect" value={`${stats.tauxConvDiag}%`} sub="Diagnostic converti en fiche" color={stats.tauxConvDiag>=30?C.vert:"#E67E22"}/>
      </div>

      {/* Classement diagnostics les plus utilisés */}
      {stats.diagParType&&Object.keys(stats.diagParType).length>0&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem .85rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".62rem",fontWeight:700,color:C.brun,marginBottom:".5rem"}}>🏆 Diagnostics les plus utilisés</div>
          {Object.entries(stats.diagParType)
            .sort((a,b)=>b[1]-a[1])
            .slice(0,8)
            .map(([type,count],i)=>{
              const max=Object.values(stats.diagParType).reduce((a,b)=>Math.max(a,b),1);
              const label={skincare:"✨ Skincare",makeup:"💄 Makeup",peaucorps:"🧴 Peau Corps",cheveux:"💇 Cheveux",sante:"💊 Santé",silhouette:"⚖️ Silhouette",detox:"🌿 Détox",antiage:"🌸 Anti-Âge",budget:"💡 Budget Beauté",recrutement:"🤝 Recrutement",complementrevenu:"💰 Revenu +",entrepreneuriat:"🚀 Entrepreneur",valeurmarche:"💼 Valeur marché",chargementale:"🧠 Charge Mentale",libertefin:"🏖️ Liberté Fin.",maman:"🌸 Maman",reconversion:"🔄 Reconversion",confianceensoi:"💪 Confiance",reseauxsociaux2:"📲 Audit Digital",blocage:"🔓 Recrue bloquée",pasrecruiter:"😓 Non recrutement",pasvendre:"💸 Non ventes",reseaux:"📱 Réseaux"}[type]||type;
              return(
                <div key={type} style={{marginBottom:".4rem"}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:".68rem",marginBottom:".1rem"}}>
                    <span style={{color:C.brun,fontWeight:i<3?700:400}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":""} {label}</span>
                    <span style={{color:C.gris,fontWeight:600}}>{count}</span>
                  </div>
                  <div style={{height:5,background:C.pale,borderRadius:10,overflow:"hidden"}}>
                    <div style={{height:"100%",background:i<3?C.rose:C.gris+"60",borderRadius:10,width:`${Math.round((count/max)*100)}%`,transition:"width .3s"}}/>
                  </div>
                </div>
              );
            })
          }
        </div>
      )}

      {/* SECTION 3 — CONVERSION PROSPECTS */}
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".45rem"}}>🎯 Prospects & Conversion</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:"1rem"}}>
        <StatCard icon="👥" label="Total prospects" value={stats.totalProspects} sub={`Ajoutés sur les ${periode}`} color={C.brun}/>
        <StatCard icon="✅" label="Taux de conversion" value={`${stats.tauxConvProspect}%`} sub={`${stats.totalConvertisClient} clientes · ${stats.totalConvertisDistrib} distribs`} pctVal={stats.tauxConvProspect} color={C.vert}/>
        <StatCard icon="🛍️" label="Clientes totales" value={stats.totalClients} sub="Dans toutes les fiches" color={C.rose}/>
        <StatCard icon="📦" label="Commandes enregistrées" value={stats.totalCommandes} sub={`CA estimé: ${stats.totalCA}€`} color={C.or}/>
      </div>

      {/* SECTION 4 — RECOMMANDATIONS */}
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".45rem"}}>🤝 Système de recommandation</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:"1rem"}}>
        <StatCard icon="📨" label="Recommandations reçues" value={stats.totalRecommandations} sub="Personnes recommandées par clientes" color={C.lilas}/>
        <StatCard icon="🔁" label="Taux conversion recs" value={`${stats.tauxConvRec}%`} sub="Recommandations devenues prospects" pctVal={stats.tauxConvRec} color={C.vert}/>
      </div>

      {/* SECTION 5 — FAST START */}
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".45rem"}}>🚀 Onboarding Fast Start</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:"1rem"}}>
        <StatCard icon="📚" label="Fast Start assignés" value={stats.totalFastStartAssigne} sub="Nouvelles avec parcours actif" color={C.brun}/>
        <StatCard icon="🏁" label="Fast Start terminés" value={stats.totalFastStartDone} sub="7 modules validés" pctVal={stats.tauxFastStart} color={C.vert}/>
      </div>

      {/* SCORE GLOBAL */}
      {(()=>{
        const score=Math.round((stats.tauxUtilisation*0.3)+(stats.tauxOrdonnance*0.2)+(stats.tauxConvProspect*0.25)+(stats.tauxFastStart*0.25));
        const couleur=score>=70?C.vert:score>=45?"#E67E22":"#E74C3C";
        return(
          <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:14,padding:"1rem 1.1rem",marginBottom:"1rem",textAlign:"center"}}>
            <div style={{fontSize:".62rem",color:C.or,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".3rem"}}>⚡ Score global Blazing Dynasty</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"2.5rem",fontWeight:700,color:couleur}}>{score}<span style={{fontSize:"1.2rem",color:"rgba(255,255,255,.6)"}}>/100</span></div>
            <div style={{fontSize:".68rem",color:"rgba(255,255,255,.7)",marginTop:".2rem"}}>
              {score>=70?"🔥 Équipe très engagée — excellent levier de recrutement !":score>=45?"⚡ Bonne dynamique — encore des axes de progression":score>0?"💡 Potentiel à débloquer — concentre-toi sur l'engagement":""}
            </div>
          </div>
        );
      })()}

      {/* PHRASE RECRUTEMENT */}
      <div style={{background:C.creme,borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem",border:`1px solid ${C.or}40`}}>
        <div style={{fontSize:".62rem",fontWeight:700,color:C.or,marginBottom:".35rem"}}>💬 Phrase toute prête pour recruter</div>
        <div style={{fontSize:".74rem",color:C.brun,lineHeight:1.7,fontStyle:"italic"}}>
          "Dans mon équipe, {stats.tauxUtilisation}% des distributrices utilisent l'outil de gestion que j'ai mis en place. Elles ont réalisé {stats.totalDiags} diagnostics clients ce mois, généré {stats.totalDiagsAvecOrd} ordonnances personnalisées, et converti {stats.tauxConvProspect}% de leurs prospects en clientes ou distributrices. C'est pas juste du MLM — c'est une vraie structure qui marche."
        </div>
        <button onClick={()=>{
          const texte=`"Dans mon équipe, ${stats.tauxUtilisation}% des distributrices utilisent l'outil de gestion que j'ai mis en place. Elles ont réalisé ${stats.totalDiags} diagnostics clients ce mois, généré ${stats.totalDiagsAvecOrd} ordonnances personnalisées, et converti ${stats.tauxConvProspect}% de leurs prospects en clientes ou distributrices. C'est pas juste du MLM — c'est une vraie structure qui marche."`;
          navigator.clipboard?.writeText(texte);
          alert("✅ Copié !");
        }}
          style={{width:"100%",background:C.or,color:"white",border:"none",borderRadius:8,padding:".42rem",fontSize:".72rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginTop:".5rem"}}>
          📋 Copier cette phrase
        </button>
      </div>

      {/* TABLEAU MEMBRE PAR MEMBRE */}
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".45rem"}}>👥 Détail par membre</div>
      <input
        placeholder="🔍 Rechercher un membre..."
        value={rechercheMembre}
        onChange={e=>setRechercheMembre(e.target.value)}
        style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:9,padding:".45rem .7rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".5rem"}}
      />
      {stats.membreDetails.filter(m=>m.nom.toLowerCase().includes(rechercheMembre.toLowerCase())).map((m,i)=>(
        <div key={i} style={{background:m.actif?C.blanc:C.creme,border:`1px solid ${m.actif?C.pale:"transparent"}`,borderRadius:10,padding:".55rem .75rem",marginBottom:".35rem",opacity:m.actif?1:.7}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".2rem"}}>
            <div style={{display:"flex",alignItems:"center",gap:".4rem"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:m.actif?C.rose+"25":"#ccc",color:m.actif?C.rose:"#aaa",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".75rem",fontWeight:700,flexShrink:0}}>
                {m.nom[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{fontSize:".74rem",fontWeight:600,color:C.brun}}>{m.nom}</div>
                <div style={{fontSize:".58rem",color:m.actif?C.vert:C.gris}}>{m.actif?"✅ Active":"⬜ Inactive"} · {m.streak}🔥</div>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:".62rem",color:C.gris}}>🔬 {m.nbDiags} diag · 👤 {m.nbProspects} prospects</div>
              <div style={{fontSize:".6rem",color:C.gris}}>🛍️ {m.nbClients} clientes · {m.fsDone?"🏁 FS ✓":"📚 FS "+m.nbFsModules+"/7"}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SuiviCATab({uid}){
  const raw = getPeriodeInfo();
  const[periodeOverride,setPeriodeOverride]=useState(null);
  const[editPeriodeNum,setEditPeriodeNum]=useState(false);
  const[inputPeriodeNum,setInputPeriodeNum]=useState("");
  const pCourante = periodeOverride || raw.periodNum || getPeriodeActuelle();
  const joursEcoules = periodeOverride ? 21 : Math.min(21, Math.max(1, 21 - (raw.daysLeft||0)));

  const[data,setData]=useState({});
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState(false);

  // Colonnes comparaison libres
  const[compareA,setCompareA]=useState(pCourante-1>0?pCourante-1:1);
  const[compareB,setCompareB]=useState(pCourante-PERIODES_PAR_AN>0?pCourante-PERIODES_PAR_AN:1);
  const[editColA,setEditColA]=useState(false);
  const[editColB,setEditColB]=useState(false);
  const[inputA,setInputA]=useState(String(pCourante-1>0?pCourante-1:1));
  const[inputB,setInputB]=useState(String(pCourante-PERIODES_PAR_AN>0?pCourante-PERIODES_PAR_AN:1));

  // Cellule en cours d'édition
  const[editCell,setEditCell]=useState(null);
  const[editVal,setEditVal]=useState('');

  // Édition total + objectif
  const[editPeriode,setEditPeriode]=useState(null);
  const[editCA,setEditCA]=useState('');
  const[editObj,setEditObj]=useState('');

  // Historique — navigation
  const[histAnnee,setHistAnnee]=useState(new Date().getFullYear());
  const[histPeriodeOuverte,setHistPeriodeOuverte]=useState(null); // num absolu

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,'users',uid));
        if(snap.exists()&&snap.data()['db-suivi-ca'])
          setData(JSON.parse(snap.data()['db-suivi-ca']));
      }catch{}
      setLoading(false);
    })();
  },[uid]);

  const saveData=async(next)=>{
    setSaving(true);
    try{await setDoc(doc(db,'users',uid),{'db-suivi-ca':JSON.stringify(next)},{merge:true});setData(next);}catch{}
    setSaving(false);
  };

  const saveJour=(pNum,idx,val)=>{
    const pKey=`p${pNum}`;
    const cur=data[pKey]||{obj:0,jours:{}};
    const jours={...(cur.jours||{}),[idx]:parseFloat(val)||0};
    // Total = valeur du jour le plus récent rempli (saisie cumulée)
    const joursRemplis=Object.entries(jours).filter(([,v])=>parseFloat(v)>0);
    let ca=0;
    if(joursRemplis.length>0){
      const dernierIdx=Math.max(...joursRemplis.map(([k])=>parseInt(k)));
      ca=parseFloat(jours[dernierIdx])||0;
    }
    saveData({...data,[pKey]:{...cur,jours,ca}});
    setEditCell(null);
  };

  const saveEdit=()=>{
    const pKey=`p${editPeriode}`;
    const cur=data[pKey]||{jours:{}};
    saveData({...data,[pKey]:{...cur,ca:parseFloat(editCA)||0,obj:parseFloat(editObj)||0}});
    setEditPeriode(null);
  };

  const pct=(ca,obj)=>obj?Math.min(100,Math.round((ca||0)/obj*100)):0;
  const fmtDate=(d)=>d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
  const fmtJour=(d)=>d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'});

  if(loading)return <div style={{padding:'2rem',textAlign:'center',color:C.gris,fontSize:'.76rem'}}>Chargement...</div>;

  const dCour=data[`p${pCourante}`]||{ca:0,obj:0,jours:{}};
  const attendu=dCour.obj?Math.round(dCour.obj*joursEcoules/21):0;
  const delta=(dCour.ca||0)-attendu;

  // Grille 21 jours pour une période donnée

  // Années disponibles
  const anneesDispos=[];
  const anneeCourante=getPeriodeDebut(pCourante).getFullYear();
  for(let a=2024;a<=anneeCourante;a++) anneesDispos.push(a);

  // Périodes d'une année donnée (numéros absolus)
  const periodesDeAnnee=(annee)=>{
    const result=[];
    for(let n=-50;n<=pCourante;n++){
      if(n===0) continue;
      try{
        const d=getPeriodeDebut(n);
        const f=new Date(d.getTime()+PERIODE_DUREE_JOURS*24*60*60*1000-1);
        if(d.getFullYear()===annee||f.getFullYear()===annee) result.push(n);
      }catch{}
    }
    return [...new Set(result)].sort((a,b)=>a-b);
  };

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".4rem"}}>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun}}>
          Suivi <em style={{fontStyle:"italic",color:C.rose}}>CA</em>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:".3rem"}}>
          {editPeriodeNum
            ?<div style={{display:"flex",gap:".3rem",alignItems:"center"}}>
              <span style={{fontSize:".62rem",color:C.gris}}>P n°</span>
              <input type="number" autoFocus value={inputPeriodeNum} onChange={e=>setInputPeriodeNum(e.target.value)}
                onBlur={()=>{const v=parseInt(inputPeriodeNum);if(v>0)setPeriodeOverride(v);setEditPeriodeNum(false);}}
                onKeyDown={e=>{if(e.key==="Enter"){const v=parseInt(inputPeriodeNum);if(v>0)setPeriodeOverride(v);setEditPeriodeNum(false);}}}
                style={{width:50,border:`1px solid ${C.rose}`,borderRadius:7,padding:".28rem .4rem",fontSize:".78rem",fontFamily:"inherit",textAlign:"center",outline:"none"}}/>
            </div>
            :<button onClick={()=>{setEditPeriodeNum(true);setInputPeriodeNum(String(pCourante));}}
              style={{background:periodeOverride?"#FFF3CD":"none",border:`1px solid ${periodeOverride?"#E6A817":C.pale}`,borderRadius:7,padding:".2rem .45rem",fontSize:".62rem",color:periodeOverride?"#856404":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              {periodeOverride?`⚠️ P${pCourante} (forcé)`:"+/- Période"}
            </button>
          }
          {periodeOverride&&<button onClick={()=>setPeriodeOverride(null)} title="Revenir à la période actuelle" style={{background:"none",border:"none",color:C.gris,cursor:"pointer",fontSize:".72rem"}}>↩️</button>}
        </div>
      </div>

      {/* Bandeau période courante */}
      <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:12,padding:'.85rem 1rem',marginBottom:'1rem',color:C.blanc}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:'.55rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:C.or}}>{fmtPLabel(pCourante)} · J{joursEcoules}/21</div>
            <div style={{fontFamily:'Georgia,serif',fontSize:'1.3rem',fontWeight:600}}>{dCour.ca||0}€ <span style={{fontSize:'.7rem',fontWeight:400,color:C.pale}}>/ {dCour.obj||'—'}€</span></div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:'.72rem',fontWeight:700,color:delta>=0?C.vert:'#F4A460'}}>{delta>=0?'▲ +':'▼ '}{Math.abs(delta)}€</div>
            <div style={{fontSize:'.58rem',color:C.pale}}>{delta>=0?'en avance':'en retard'} · attendu {attendu}€</div>
            <div style={{fontSize:'.55rem',color:C.pale,marginTop:'.15rem'}}>{raw.daysLeft}j {raw.hoursLeft}h restants</div>
          </div>
        </div>
        <div style={{height:5,background:'rgba(255,255,255,.15)',borderRadius:10,overflow:'hidden',marginTop:'.5rem'}}>
          <div style={{height:'100%',background:C.or,width:pct(dCour.ca,dCour.obj)+'%',borderRadius:10}}/>
        </div>
      </div>

      {/* GRILLE 3 COLONNES */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'.4rem',marginBottom:'1rem'}}>
        {/* Colonne B */}
        <div style={{border:`1.5px solid #88888840`,borderRadius:12,overflow:'hidden'}}>
          <div style={{background:'#f5f5f5',padding:'.35rem .4rem .3rem',borderBottom:'1px solid #88888820',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <button onClick={()=>setCompareB(b=>Math.max(1,b-1))} style={{background:'none',border:'none',color:'#aaa',cursor:'pointer',fontSize:'.85rem',lineHeight:1,padding:0}}>‹</button>
            <span onClick={()=>setEditColB(true)} style={{fontSize:'.55rem',fontWeight:700,color:'#888',cursor:'pointer',textAlign:'center'}}>{editColB?<input type='number' autoFocus value={inputB} onChange={e=>setInputB(e.target.value)} onBlur={()=>{const v=parseInt(inputB);if(v>0)setCompareB(v);setEditColB(false);}} onKeyDown={e=>e.key==='Enter'&&(setCompareB(parseInt(inputB)||1),setEditColB(false))} style={{width:36,border:'1px solid #888',borderRadius:4,fontSize:'.55rem',padding:'.08rem',textAlign:'center',fontFamily:'inherit'}}/>:fmtPLabel(compareB)}</span>
            <button onClick={()=>setCompareB(b=>Math.min(pCourante-1,b+1))} style={{background:'none',border:'none',color:'#aaa',cursor:'pointer',fontSize:'.85rem',lineHeight:1,padding:0}}>›</button>
          </div>
          <GrilleJoursCA pNum={compareB} color='#888' joursEcoules={joursEcoules} data={data} editCell={editCell} editVal={editVal} setEditCell={setEditCell} setEditVal={setEditVal} saveJour={saveJour} setEditPeriode={setEditPeriode} setEditCA={setEditCA} setEditObj={setEditObj}/>
        </div>

        {/* Colonne A */}
        <div style={{border:`1.5px solid ${C.lilas}40`,borderRadius:12,overflow:'hidden'}}>
          <div style={{background:C.lilas+'10',padding:'.35rem .4rem .3rem',borderBottom:`1px solid ${C.lilas}20`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <button onClick={()=>setCompareA(a=>Math.max(1,a-1))} style={{background:'none',border:'none',color:C.lilas,cursor:'pointer',fontSize:'.85rem',lineHeight:1,padding:0}}>‹</button>
            <span onClick={()=>setEditColA(true)} style={{fontSize:'.55rem',fontWeight:700,color:C.lilas,cursor:'pointer',textAlign:'center'}}>{editColA?<input type='number' autoFocus value={inputA} onChange={e=>setInputA(e.target.value)} onBlur={()=>{const v=parseInt(inputA);if(v>0)setCompareA(v);setEditColA(false);}} onKeyDown={e=>e.key==='Enter'&&(setCompareA(parseInt(inputA)||1),setEditColA(false))} style={{width:36,border:`1px solid ${C.lilas}`,borderRadius:4,fontSize:'.55rem',padding:'.08rem',textAlign:'center',fontFamily:'inherit'}}/>:fmtPLabel(compareA)}</span>
            <button onClick={()=>setCompareA(a=>Math.min(pCourante-1,a+1))} style={{background:'none',border:'none',color:C.lilas,cursor:'pointer',fontSize:'.85rem',lineHeight:1,padding:0}}>›</button>
          </div>
          <GrilleJoursCA pNum={compareA} color={C.lilas} joursEcoules={joursEcoules} data={data} editCell={editCell} editVal={editVal} setEditCell={setEditCell} setEditVal={setEditVal} saveJour={saveJour} setEditPeriode={setEditPeriode} setEditCA={setEditCA} setEditObj={setEditObj}/>
        </div>
        {/* Colonne courante */}
        <div style={{border:`1.5px solid ${C.rose}40`,borderRadius:12,overflow:'hidden'}}>
          <GrilleJoursCA pNum={pCourante} color={C.rose} courante={true} joursEcoules={joursEcoules} data={data} editCell={editCell} editVal={editVal} setEditCell={setEditCell} setEditVal={setEditVal} saveJour={saveJour} setEditPeriode={setEditPeriode} setEditCA={setEditCA} setEditObj={setEditObj}/>
        </div>
      </div>

      {/* Formulaire édition total */}
      {editPeriode&&(
        <div style={{background:C.blanc,border:`1px solid ${C.rose}`,borderRadius:12,padding:'1rem',marginBottom:'1rem'}}>
          <div style={{fontSize:'.7rem',fontWeight:700,color:C.brun,marginBottom:'.6rem'}}>✏️ {fmtPLabel(editPeriode)} — {fmtDate(getPeriodeDebut(editPeriode))}</div>
          <div style={{display:'flex',gap:'.5rem',marginBottom:'.6rem'}}>
            <div style={{flex:1}}>
              <div style={{fontSize:'.6rem',color:C.gris,marginBottom:'.2rem'}}>CA total (€)</div>
              <input type='number' value={editCA} onChange={e=>setEditCA(e.target.value)} placeholder='0'
                style={{width:'100%',border:`1px solid ${C.pale}`,borderRadius:8,padding:'.45rem .65rem',fontSize:'.85rem',fontFamily:'inherit',color:C.texte,background:C.creme,outline:'none',fontWeight:700}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:'.6rem',color:C.gris,marginBottom:'.2rem'}}>Objectif (€)</div>
              <input type='number' value={editObj} onChange={e=>setEditObj(e.target.value)} placeholder='0'
                style={{width:'100%',border:`1px solid ${C.pale}`,borderRadius:8,padding:'.45rem .65rem',fontSize:'.85rem',fontFamily:'inherit',color:C.texte,background:C.creme,outline:'none',fontWeight:700}}/>
            </div>
          </div>
          <div style={{display:'flex',gap:'.4rem'}}>
            <button onClick={saveEdit} disabled={saving}
              style={{flex:1,background:C.brun,color:C.blanc,border:'none',borderRadius:8,padding:'.5rem',fontSize:'.78rem',fontWeight:600,fontFamily:'inherit',cursor:'pointer'}}>
              {saving?'Sauvegarde...':'✓ Enregistrer'}
            </button>
            <button onClick={()=>setEditPeriode(null)}
              style={{flex:1,background:C.pale,color:C.gris,border:'none',borderRadius:8,padding:'.5rem',fontSize:'.78rem',fontFamily:'inherit',cursor:'pointer'}}>Annuler</button>
          </div>
        </div>
      )}

      {/* HISTORIQUE — par année puis période */}
      <div style={{marginBottom:'.5rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontSize:'.6rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:C.gris}}>📅 Historique</div>
        <div style={{display:'flex',gap:'.3rem'}}>
          {anneesDispos.map(a=>(
            <button key={a} onClick={()=>{setHistAnnee(a);setHistPeriodeOuverte(null);}}
              style={{padding:'.22rem .55rem',fontSize:'.65rem',fontWeight:600,borderRadius:8,border:`1px solid ${histAnnee===a?C.brun:C.pale}`,background:histAnnee===a?C.brun:C.blanc,color:histAnnee===a?C.blanc:C.gris,cursor:'pointer',fontFamily:'inherit'}}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {periodesDeAnnee(histAnnee).reverse().map(num=>{
        const d3=data[`p${num}`]||{};
        const pc3=pct(d3.ca||0,d3.obj||0);
        const isCourante=num===pCourante;
        const isOuverte=histPeriodeOuverte===num;
        const numAnnee=((num-1)%PERIODES_PAR_AN+PERIODES_PAR_AN)%PERIODES_PAR_AN+1;
        return(
          <div key={num} style={{marginBottom:'.4rem',border:`1.5px solid ${isCourante?C.rose:isOuverte?C.brun:C.pale}`,borderRadius:isOuverte?'12px 12px 0 0':12,overflow:'hidden'}}>
            {/* Ligne de la période */}
            <div onClick={()=>setHistPeriodeOuverte(isOuverte?null:num)}
              style={{display:'flex',alignItems:'center',gap:'.6rem',background:isCourante?C.brun:isOuverte?C.brun+'08':C.blanc,padding:'.5rem .85rem',cursor:'pointer'}}>
              <div style={{width:36,height:36,borderRadius:'50%',background:isCourante?C.or+'30':C.rose+'15',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'.65rem',fontWeight:700,color:isCourante?C.or:C.rose}}>P{numAnnee}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:'.62rem',fontWeight:600,color:isCourante?C.blanc:C.brun}}>{fmtDate(getPeriodeDebut(num))} → {fmtDate(new Date(getPeriodeDebut(num).getTime()+20*24*60*60*1000))}</div>
                <div style={{height:4,background:isCourante?'rgba(255,255,255,.15)':C.pale,borderRadius:10,overflow:'hidden',marginTop:'.2rem'}}>
                  <div style={{height:'100%',background:isCourante?C.or:C.rose,width:pc3+'%',borderRadius:10}}/>
                </div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontFamily:'Georgia,serif',fontSize:'.9rem',fontWeight:700,color:isCourante?C.blanc:C.brun}}>{d3.ca||'—'}{d3.ca?'€':''}</div>
                <div style={{fontSize:'.58rem',color:isCourante?C.pale:C.gris}}>{d3.obj?pc3+'%':''}</div>
              </div>
              <div style={{fontSize:'.75rem',color:isCourante?C.pale:C.gris,transform:isOuverte?'rotate(90deg)':'none',transition:'transform .2s',flexShrink:0}}>›</div>
            </div>

            {/* Grille jour par jour dépliable */}
            {isOuverte&&(
              <div style={{borderTop:`1px solid ${C.pale}`,background:C.blanc}}>
                <div style={{padding:'.5rem .65rem .2rem',background:C.creme,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontSize:'.6rem',color:C.gris}}>Clique sur un jour pour saisir ou modifier</div>
                  <button onClick={()=>{setEditPeriode(num);setEditCA(d3.ca||'');setEditObj(d3.obj||'');}}
                    style={{background:C.brun,color:C.blanc,border:'none',borderRadius:6,padding:'.2rem .5rem',fontSize:'.6rem',fontWeight:600,fontFamily:'inherit',cursor:'pointer'}}>✏️ Total & Obj.</button>
                </div>
                <GrilleJoursCA pNum={num} color={isCourante?C.rose:C.lilas} courante={isCourante} joursEcoules={joursEcoules} data={data} editCell={editCell} editVal={editVal} setEditCell={setEditCell} setEditVal={setEditVal} saveJour={saveJour} setEditPeriode={setEditPeriode} setEditCA={setEditCA} setEditObj={setEditObj}/>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


function ResumeSemaineChef({annuaire}){
  const [resume,setResume]=useState(null);
  const [ouvert,setOuvert]=useState(false);
  useEffect(()=>{
    (async()=>{
      try{
        const membres=Object.entries(annuaire||{});
        if(!membres.length) return;
        const lundi=new Date();lundi.setDate(lundi.getDate()-lundi.getDay()+1);
        const lundiStr=lundi.toISOString().slice(0,10);
        const snaps=await Promise.all(membres.map(([mUid])=>getDoc(doc(db,"users",mUid)).catch(()=>null)));
        let actives=0,diags=0,cmds=0,ca=0,det=[];
        snaps.forEach((snap,i)=>{
          if(!snap?.exists()) return;
          const d=snap.data();const [mUid,mData]=membres[i];
          const nom=mData.prenom||mUid.split("-").map(w=>w[0]?.toUpperCase()+w.slice(1)).join(" ");
          const actif=(d["db-last-login"]||"")>=lundiStr;if(actif)actives++;
          const nd=(d["db-diagnostics"]?JSON.parse(d["db-diagnostics"]):[]).filter(dg=>dg.date>=lundiStr).length;diags+=nd;
          let nc=0,nca=0;
          (d["db-clients"]?JSON.parse(d["db-clients"]):[]).forEach(cl=>{(cl.commandes||[]).filter(cmd=>cmd.date>=lundiStr).forEach(cmd=>{nc++;nca+=parseFloat(cmd.montant)||0;});});
          cmds+=nc;ca+=nca;
          det.push({nom,actif,nd,nc,nca:Math.round(nca)});
        });
        setResume({actives,total:membres.length,diags,cmds,ca:Math.round(ca),det:det.sort((a,b)=>(b.actif?1:0)-(a.actif?1:0)||b.nd-a.nd)});
      }catch{}
    })();
  },[annuaire]);
  if(!resume) return null;
  return(
    <div style={{background:C.brun,borderRadius:14,padding:"1rem 1.1rem",marginBottom:"1rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".65rem"}}>
        <div><div style={{fontSize:".55rem",fontWeight:700,letterSpacing:".15em",color:C.or,marginBottom:".2rem"}}>CETTE SEMAINE</div><div style={{fontFamily:"Georgia,serif",fontSize:"1rem",color:"white",fontWeight:300}}>{resume.actives} active{resume.actives>1?"s":""} / {resume.total}</div></div>
        <button onClick={()=>setOuvert(!ouvert)} style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:8,padding:".3rem .65rem",color:"rgba(255,255,255,.8)",fontSize:".68rem",cursor:"pointer",fontFamily:"inherit"}}>{ouvert?"Fermer":"Détails"}</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:".4rem",marginBottom:ouvert?".75rem":"0"}}>
        {[[resume.diags,"Diagnostics",C.rose],[resume.cmds,"Commandes",C.or],[resume.ca+"EUR","CA",C.vert]].map(([val,label,col])=>(<div key={label} style={{textAlign:"center",background:"rgba(255,255,255,.08)",borderRadius:8,padding:".45rem .3rem"}}><div style={{fontSize:"1.1rem",fontWeight:700,color:col}}>{val}</div><div style={{fontSize:".58rem",color:"rgba(255,255,255,.55)"}}>{label}</div></div>))}
      </div>
      {ouvert&&<div style={{borderTop:"1px solid rgba(255,255,255,.1)",paddingTop:".65rem"}}>
        {resume.det.map((m,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:".6rem",padding:".35rem 0",borderBottom:i<resume.det.length-1?"1px solid rgba(255,255,255,.06)":"none"}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:m.actif?C.vert:"rgba(255,255,255,.2)",flexShrink:0}}/>
          <div style={{flex:1,fontSize:".75rem",color:m.actif?"white":"rgba(255,255,255,.4)",fontWeight:m.actif?600:400}}>{m.nom}</div>
          <div style={{display:"flex",gap:".5rem"}}>
            {m.nd>0&&<span style={{fontSize:".62rem",color:C.rose,fontWeight:600}}>{m.nd} diag</span>}
            {m.nc>0&&<span style={{fontSize:".62rem",color:C.or,fontWeight:600}}>{m.nc} cmd</span>}
            {m.nca>0&&<span style={{fontSize:".62rem",color:C.vert,fontWeight:600}}>{m.nca}EUR</span>}
            {!m.actif&&<span style={{fontSize:".6rem",color:"rgba(255,255,255,.3)"}}>Absente</span>}
          </div>
        </div>))}
      </div>}
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
        {section==="stats"&&<StatsEquipeTab uid={uid} annuaire={annuaire}/>}
        {section==="challengeapp"&&<ChallengeAppSuiviTab annuaire={annuaire}/>}
        {section==="suivica"&&<SuiviCATab uid={uid}/>}
        {section==="actionsbiblio"&&<ActionsBiblioChefTab uid={uid}/>}
        {section==="membres"&&<MembresTab uid={uid}/>}
        {section==="assiduite"&&<AssiduiteTab uid={uid}/>}
        {section==="defi"&&<DefisTab uid={uid} userName={uid.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")} canCreate={true} isChef={isChef}/>}
        {section==="powerhour"&&<PowerHourTab uid={uid} userName={uid.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")} canCreate={isChef}/>}
        {section==="distributeurs"&&<DistributeursTab distributeurs={distrib} save={saveDistrib} uid={uid}/>}
        {section==="monequipe"&&<MonEquipeTab uid={uid}/>}
        {section==="nouveaux"&&<SuiviRecruTab uid={uid} isChef={isChef}/>}
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

      {/* Mise à jour app */}
      <div style={{marginBottom:"1rem"}}>
        <BoutonMiseAJour style={{width:"100%",justifyContent:"center"}}/>
      </div>

      <ResumeSemaineChef annuaire={annuaire}/>

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
        const chef=(Array.isArray(chefs)?chefs:Object.values(chefs||{})).includes(uid.replace(/-/g," "))||uid==="melissa-da-silveira"||uid==="melissa";
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
              <button onClick={async()=>{
                try{
                  const ref=doc(db,"users",m.uid);
                  const snap=await getDoc(ref);
                  const existing=snap.exists()&&snap.data()["db-fast-start"]?JSON.parse(snap.data()["db-fast-start"]):{};
                  const nom=(m.prenom||"")+" "+(m.nom||"");
                  if(!existing.startDate){
                    await setDoc(ref,{"db-fast-start":JSON.stringify({startDate:todayLocalStr(),doneTasks:{},modulesValides:{}})},{merge:true});
                    alert("✅ Fast Start assigné à "+nom.trim());
                  } else {
                    if(window.confirm(nom.trim()+" a déjà un Fast Start (démarré le "+existing.startDate+"). Relancer depuis le début ?")){
                      await setDoc(ref,{"db-fast-start":JSON.stringify({startDate:todayLocalStr(),doneTasks:{},modulesValides:{}})},{merge:true});
                      alert("✅ Fast Start relancé pour "+nom.trim());
                    }
                  }
                }catch{alert("Erreur.");}
              }}
                style={{background:C.rose+"15",border:`1px solid ${C.rose}50`,borderRadius:8,padding:".35rem .55rem",fontSize:".65rem",fontWeight:600,color:C.rose,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}
                title="Assigner/relancer le Fast Start">
                🚀
              </button>
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
function AdminConfigPeriodes(){
  const[ancre,setAncre]=useState("2026-01-03");
  const[periodeNum,setPeriodeNum]=useState("");
  const[periodeDebut,setPeriodeDebut]=useState("");
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);
  const[loaded,setLoaded]=useState(false);
  const[resetUid,setResetUid]=useState("");
  const[resetResult,setResetResult]=useState("");
  const[resetSearch,setResetSearch]=useState("");
  const[membres,setMembres]=useState([]);
  const[resetSaving,setResetSaving]=useState(false);
  const[resetVals,setResetVals]=useState({});
  const[resetGlobalSaving,setResetGlobalSaving]=useState(false);
  const[resetGlobalResult,setResetGlobalResult]=useState("");

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","config_periodes"));
        if(snap.exists()&&snap.data().ancre) setAncre(snap.data().ancre.slice(0,10));
      }catch{}
      // Charger aussi les membres de l'annuaire
      try{
        const snap2=await getDoc(doc(db,"equipe","annuaire"));
        if(snap2.exists()) setMembres(Object.entries(snap2.data().membres||{}).map(([uid,m])=>({uid,prenom:m.prenom||"",nom:m.nom||""})).sort((a,b)=>(a.prenom+a.nom).localeCompare(b.prenom+b.nom)));
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const save=async()=>{
    setSaving(true);
    try{
      await setDoc(doc(db,"admin","config_periodes"),{ancre:ancre+"T12:00:00"});
      // Met à jour la variable globale immédiatement
      PERIODE_DEBUT_ABSOLU_MS = new Date(ancre+"T12:00:00").getTime();
      setSaved(true);setTimeout(()=>setSaved(false),2000);
    }catch{}
    setSaving(false);
  };

  // Prévisualisation
  const ancreDate = new Date(ancre+"T00:00:00");
  const today = new Date();
  const diffMs = today.getTime() - ancreDate.getTime();
  const n = diffMs>0 ? Math.floor(diffMs/(PERIODE_DUREE_JOURS*24*60*60*1000))+1 : 1;
  const debut = new Date(ancreDate.getTime()+(n-1)*PERIODE_DUREE_JOURS*24*60*60*1000);
  const fin = new Date(debut.getTime()+PERIODE_DUREE_JOURS*24*60*60*1000-1);
  const numAnnee = ((n-1)%PERIODES_PAR_AN+PERIODES_PAR_AN)%PERIODES_PAR_AN+1;
  const resteDays = Math.ceil((fin.getTime()-today.getTime())/(24*60*60*1000));

  if(!loaded) return null;

  return(
    <div style={{background:"#FFF8E1",border:"1.5px solid #E6A817",borderRadius:12,padding:"1rem",marginBottom:"1.25rem"}}>
      <div style={{fontSize:".6rem",fontWeight:700,color:"#856404",letterSpacing:".1em",textTransform:"uppercase",marginBottom:".6rem"}}>⚙️ Configuration des Périodes Mihi</div>
      <p style={{fontSize:".7rem",color:"#856404",marginBottom:".75rem",lineHeight:1.6}}>
        La date d'ancre détermine le calcul de toutes les périodes pour <strong>toute l'équipe</strong>. Modifie uniquement si les dates sont incorrectes.
      </p>
      <div style={{marginBottom:".6rem"}}>
        <div style={{fontSize:".62rem",color:C.gris,marginBottom:".25rem",fontWeight:600}}>Je suis en periode :</div>
        <div style={{display:"flex",gap:".3rem",flexWrap:"wrap",marginBottom:".6rem"}}>{[6,7,8,9,10,11,12,13,14,15,16,17,18].map(n=>(<button key={n} onClick={()=>setPeriodeNum(String(n))} style={{padding:".3rem .55rem",fontSize:".72rem",fontWeight:700,borderRadius:8,border:"1.5px solid "+(periodeNum===String(n)?"#E6A817":"#E8DDD4"),background:periodeNum===String(n)?"#E6A817":"white",color:periodeNum===String(n)?"white":"#3D1F0E",cursor:"pointer",fontFamily:"inherit"}}>P{n}</button>))}</div>
        <div style={{fontSize:".62rem",color:C.gris,marginBottom:".25rem",fontWeight:600}}>Date de debut de cette periode</div>
        <input type="date" value={periodeDebut||""} onChange={e=>setPeriodeDebut(e.target.value)} style={{width:"100%",border:"1px solid #E6A817",borderRadius:8,padding:".42rem .65rem",fontSize:".85rem",fontFamily:"inherit",color:C.texte,background:"white",outline:"none",marginBottom:".4rem"}}/>
        {periodeNum&&periodeDebut&&<div style={{fontSize:".7rem",color:"#856404",background:"#FFF8E1",borderRadius:6,padding:".4rem .6rem",marginBottom:".4rem"}}>P{periodeNum} commence le {new Date(periodeDebut+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long"})}</div>}
        <div style={{fontSize:".62rem",color:C.gris,marginBottom:".25rem",fontWeight:600}}>Date de début de P1 (ancre)</div>
        <input type="date" value={ancre} onChange={e=>setAncre(e.target.value)}
          style={{width:"100%",border:`1px solid #E6A817`,borderRadius:8,padding:".42rem .65rem",fontSize:".85rem",fontFamily:"inherit",color:C.texte,background:"white",outline:"none",fontWeight:600}}/>
      </div>
      {/* Prévisualisation */}
      <div style={{background:"white",borderRadius:8,padding:".5rem .75rem",marginBottom:".6rem",fontSize:".72rem",color:C.brun}}>
        <strong>Prévisualisation :</strong> Aujourd'hui = <strong style={{color:C.rose}}>P{numAnnee} {debut.getFullYear()}</strong> · {debut.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})} → {fin.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})} · {Math.max(0,resteDays)}j restants
      </div>
      <button onClick={save} disabled={saving}
        style={{width:"100%",background:"#E6A817",color:"white",border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
        {saving?"Sauvegarde...":saved?"✅ Appliqué à toute l'équipe !":"✓ Appliquer à toute l'équipe"}
      </button>

      {/* Reset global tous les membres */}
      <div style={{marginTop:"1rem",paddingTop:"1rem",borderTop:"1px solid #E6A817"}}>
        <div style={{fontSize:".62rem",fontWeight:700,color:"#C0392B",marginBottom:".4rem"}}>🔄 Remise à zéro de toute l'équipe</div>
        <p style={{fontSize:".68rem",color:"#856404",marginBottom:".5rem",lineHeight:1.5}}>
          Remet le CA et les recrues à 0 pour <strong>tous les membres</strong> (sans effacer le cumul ni l'historique). À utiliser au changement de période/campagne.
        </p>
        {resetGlobalResult&&<div style={{fontSize:".7rem",color:resetGlobalResult.startsWith("✅")?C.vert:"#B04040",marginBottom:".4rem"}}>{resetGlobalResult}</div>}
        <button onClick={async()=>{
          if(!window.confirm("Remettre CA et recrues à 0 pour TOUTE l'équipe ? Cette action est irréversible."))return;
          setResetGlobalSaving(true);setResetGlobalResult("");
          try{
            const annRef=doc(db,"equipe","annuaire");
            const annSnap=await getDoc(annRef);
            if(!annSnap.exists()){setResetGlobalResult("❌ Annuaire introuvable.");setResetGlobalSaving(false);return;}
            const membres2=annSnap.data().membres||{};
            const uids=Object.keys(membres2);
            let ok=0,err=0;
            // Reset annuaire en une fois
            const newMembres={};
            uids.forEach(u=>{newMembres[u]={...membres2[u],ca:"",caPerso:"",recruesReal:"0"};});
            await setDoc(annRef,{membres:newMembres},{merge:true});
            // Reset objectifs individuels
            for(const uid2 of uids){
              try{
                const uSnap=await getDoc(doc(db,"users",uid2));
                if(uSnap.exists()){
                  const d2=uSnap.data();
                  if(d2["db-obj-perso"]){
                    const obj2=JSON.parse(d2["db-obj-perso"]);
                    const periode2=getPeriodeActuelle();
                    // Sauvegarder dans historique avant reset
                    const hist2=obj2.historique||[];
                    if(obj2.ca||obj2.caPerso||obj2.recruesReal!=="0"){
                      hist2.push({date:todayLocalStr(),ca:+obj2.ca||0,caPerso:+obj2.caPerso||0,recruesReal:+obj2.recruesReal||0,palier:obj2.palier||"2%"});
                    }
                    const totalCaCumul=(+obj2.totalCaCumul||0)+(+obj2.ca||0);
                    const totalRecruesCumul=(+obj2.totalRecruesCumul||0)+(+obj2.recruesReal||0);
                    const nextObj2={...obj2,ca:"",caPerso:"",caEquipe:"",recruesReal:"0",nbDirecteurs:0,caDirecteurs:{},dirSelectionnes:{},historique:hist2.slice(-24),totalCaCumul:String(totalCaCumul),totalRecruesCumul:String(totalRecruesCumul)};
                    await setDoc(doc(db,"users",uid2),{"db-obj-perso":JSON.stringify(nextObj2),"last_periode":periode2},{merge:true});
                  } else {
                    await setDoc(doc(db,"users",uid2),{"last_periode":getPeriodeActuelle()},{merge:true});
                  }
                  ok++;
                }
              }catch{err++;}
            }
            setResetGlobalResult(`✅ ${ok} membres remis à zéro${err>0?` (${err} erreurs)`:""}. Annuaire mis à jour.`);
          }catch(e){setResetGlobalResult("Erreur : "+e.message);}
          setResetGlobalSaving(false);
        }} disabled={resetGlobalSaving}
          style={{width:"100%",background:resetGlobalSaving?"#aaa":"#C0392B",color:"white",border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:resetGlobalSaving?"default":"pointer"}}>
          {resetGlobalSaving?"Remise à zéro en cours...":"🔄 Remettre toute l'équipe à zéro"}
        </button>
      </div>

      {/* Correction cumul individuel */}
      <div style={{marginTop:"1rem",paddingTop:"1rem",borderTop:"1px solid #E6A817"}}>
        <div style={{fontSize:".62rem",fontWeight:700,color:"#856404",marginBottom:".4rem"}}>🔧 Corriger les objectifs d'un membre</div>
        <p style={{fontSize:".68rem",color:"#856404",marginBottom:".5rem",lineHeight:1.5}}>
          Recherche un membre et modifie directement ses valeurs (cumul, CA, recrues).
        </p>
        <input value={resetSearch} onChange={e=>{setResetSearch(e.target.value);setResetResult("");setResetUid("");}}
          placeholder="Rechercher par prénom ou nom..."
          style={{width:"100%",border:"1px solid #E6A817",borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",background:"white",outline:"none",marginBottom:".4rem"}}/>
        {resetSearch.length>=2&&(()=>{
          const filtres=membres.filter(m=>(m.prenom+" "+m.nom).toLowerCase().includes(resetSearch.toLowerCase())).slice(0,6);
          if(!filtres.length) return <div style={{fontSize:".7rem",color:"#B04040",marginBottom:".4rem"}}>Aucun membre trouvé</div>;
          return(
            <div style={{background:"white",border:"1px solid #E6A817",borderRadius:8,marginBottom:".4rem",overflow:"hidden"}}>
              {filtres.map(m=>(
                <div key={m.uid} onClick={async()=>{
                  setResetUid(m.uid);setResetSearch(m.prenom+" "+m.nom);
                  // Charger les valeurs actuelles
                  try{
                    const snap=await getDoc(doc(db,"users",m.uid));
                    if(snap.exists()){
                      const d=snap.data();
                      const obj2=d["db-obj-perso"]?JSON.parse(d["db-obj-perso"]):{};
                      setResetVals({
                        ca:obj2.ca||"",caPerso:obj2.caPerso||"",recruesReal:obj2.recruesReal||"0",
                        totalCaCumul:obj2.totalCaCumul||"0",totalRecruesCumul:obj2.totalRecruesCumul||"0",
                      });
                    }
                  }catch{}
                }}
                  style={{padding:".45rem .65rem",cursor:"pointer",borderBottom:"1px solid #FFF3CD",display:"flex",justifyContent:"space-between",alignItems:"center",background:resetUid===m.uid?"#FFF3CD":"white"}}>
                  <span style={{fontSize:".78rem",color:C.brun,fontWeight:resetUid===m.uid?700:400}}>{m.prenom} {m.nom}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {resetUid&&(
          <div style={{background:"#FFF8E1",borderRadius:10,padding:".75rem",border:"1px solid #E6A817",marginBottom:".5rem"}}>
            <div style={{fontSize:".65rem",fontWeight:700,color:"#856404",marginBottom:".6rem"}}>✏️ {resetSearch} — valeurs modifiables</div>
            {[
              {label:"CA total période (€)",key:"ca"},
              {label:"Ventes perso (€)",key:"caPerso"},
              {label:"Recrues cette période",key:"recruesReal"},
              {label:"Cumul CA total (€)",key:"totalCaCumul"},
              {label:"Cumul recrues total",key:"totalRecruesCumul"},
            ].map(f=>(
              <div key={f.key} style={{display:"flex",alignItems:"center",gap:".5rem",marginBottom:".35rem"}}>
                <span style={{fontSize:".65rem",color:"#856404",flex:1}}>{f.label}</span>
                <input type="number" value={resetVals[f.key]||""} onChange={e=>setResetVals(p=>({...p,[f.key]:e.target.value}))}
                  style={{width:90,border:"1px solid #E6A817",borderRadius:6,padding:".28rem .45rem",fontSize:".8rem",fontFamily:"inherit",textAlign:"right",outline:"none",fontWeight:700}}/>
              </div>
            ))}
            <div style={{display:"flex",gap:".4rem",marginTop:".5rem"}}>
              <button onClick={async()=>{
                setResetSaving(true);
                try{
                  const ref=doc(db,"users",resetUid);
                  const snap=await getDoc(ref);
                  if(!snap.exists()){setResetResult("❌ Utilisateur non trouvé.");setResetSaving(false);return;}
                  const obj2=snap.data()["db-obj-perso"]?JSON.parse(snap.data()["db-obj-perso"]):{};
                  const next={...obj2,...resetVals};
                  await setDoc(ref,{"db-obj-perso":JSON.stringify(next)},{merge:true});
                  await syncAnnuaire(resetUid,resetSearch,next);
                  setResetResult("✅ Valeurs mises à jour pour "+resetSearch);
                  setResetUid("");setResetSearch("");setResetVals({});
                }catch(e){setResetResult("Erreur : "+e.message);}
                setResetSaving(false);
              }} disabled={resetSaving}
                style={{flex:1,background:"#856404",color:"white",border:"none",borderRadius:8,padding:".45rem",fontSize:".75rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                {resetSaving?"Sauvegarde...":"✓ Appliquer"}
              </button>
              <button onClick={()=>{setResetUid("");setResetSearch("");setResetVals({});}}
                style={{flex:1,background:"#ccc",color:"white",border:"none",borderRadius:8,padding:".45rem",fontSize:".75rem",fontFamily:"inherit",cursor:"pointer"}}>
                Annuler
              </button>
            </div>
          </div>
        )}
        {resetResult&&<div style={{fontSize:".7rem",color:resetResult.startsWith("✅")?C.vert:"#B04040",marginTop:".3rem"}}>{resetResult}</div>}
      </div>
    </div>
  );
}

function AdminLinkBioSection(){
  const[banniere,setBanniere]=useState({texte:"",couleur:"#C49A8A",lien:"",actif:false});
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);
  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","linkbio_banniere"));
        if(snap.exists()) setBanniere(p=>({...p,...snap.data()}));
      }catch{}
    })();
  },[]);
  const save=async()=>{
    setSaving(true);
    try{
      await setDoc(doc(db,"admin","linkbio_banniere"),banniere);
      setSaved(true);setTimeout(()=>setSaved(false),2000);
    }catch{}
    setSaving(false);
  };
  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1.25rem"}}>
      <div style={{fontSize:".6rem",fontWeight:700,color:C.rose,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".75rem"}}>🔗 Bannière Link-in-Bio (toute l'équipe)</div>
      <p style={{fontSize:".7rem",color:C.gris,marginBottom:".75rem",lineHeight:1.6}}>
        Cette bannière s'affichera sur la page de TOUTES les distributrices. Chaque membre peut choisir de l'afficher ou non.
      </p>
      <input value={banniere.texte} onChange={e=>setBanniere(p=>({...p,texte:e.target.value}))} placeholder="Ex: 🎉 Promo -20% jusqu'au 30 juin !"
        style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".4rem"}}/>
      <input value={banniere.lien} onChange={e=>setBanniere(p=>({...p,lien:e.target.value}))} placeholder="Lien (optionnel)"
        style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".4rem"}}/>
      <div style={{display:"flex",alignItems:"center",gap:".75rem",marginBottom:".5rem"}}>
        <div style={{fontSize:".7rem",color:C.gris}}>Couleur :</div>
        <input type="color" value={banniere.couleur} onChange={e=>setBanniere(p=>({...p,couleur:e.target.value}))} style={{width:32,height:28,border:"none",borderRadius:6,cursor:"pointer"}}/>
        <label style={{display:"flex",alignItems:"center",gap:".4rem",cursor:"pointer"}}>
          <input type="checkbox" checked={banniere.actif} onChange={e=>setBanniere(p=>({...p,actif:e.target.checked}))}/>
          <span style={{fontSize:".72rem",color:C.brun,fontWeight:600}}>Activer</span>
        </label>
      </div>
      <button onClick={save} disabled={saving}
        style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
        {saving?"Sauvegarde...":saved?"✅ Sauvegardé !":"✓ Appliquer à toute l'équipe"}
      </button>
    </div>
  );
}

function AdminImportCatalogue(){
  const[importing,setImporting]=useState(false);
  const[result,setResult]=useState(null);
  const[stats,setStats]=useState(null);

  const CAT_MAP={
    'VISAGE':'face','CORPS':'corps','CHEVEUX':'hair',
    'Make Up':'makeup','PARFUMS':'parfums','SANTÉ':'health',
    'Hommes':'hommes','Enfants':'enfants','HOME':'home','Sets':'sets'
  };

  const handleFile=async(e)=>{
    const file=e.target.files?.[0];
    if(!file)return;
    setImporting(true);setResult(null);setStats(null);

    try{
      // Charger SheetJS depuis un tag script déjà présent (index.html) ou CDN via un élément script injecté
      const xlsx = await new Promise((resolve,reject)=>{
        if(window.XLSX){resolve(window.XLSX);return;}
        const s=document.createElement('script');
        s.src='https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
        s.onload=()=>resolve(window.XLSX);
        s.onerror=()=>reject(new Error('SheetJS non chargé'));
        document.head.appendChild(s);
      });

      const buf=await file.arrayBuffer();
      const wb=xlsx.read(buf,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=xlsx.utils.sheet_to_json(ws);

      const seen=new Set();
      const catalogue={};
      Object.values(CAT_MAP).forEach(k=>{catalogue[k]=[];});

      for(const row of rows){
        const art=String(row['Art']||'').replace('.0','').trim();
        if(!art||seen.has(art))continue;
        seen.add(art);
        const cat=row['Category']||'';
        const key=CAT_MAP[cat];
        if(!key)continue;
        const priceRaw=String(row['Price']||'').replace('€','').replace(',','.').trim();
        const prix=parseFloat(priceRaw)||0;
        const offerPriceRaw=String(row['Offer price']||'').replace('€','').replace(',','.').trim();
        catalogue[key].push({
          nom:String(row['Name']||''),
          prix,
          ref:art,
          serie:cat,
          offre:row['Offer']?String(row['Offer']):'',
          prixOffre:offerPriceRaw?parseFloat(offerPriceRaw)||0:'',
        });
      }

      const total=Object.values(catalogue).reduce((s,v)=>s+v.length,0);
      await setDoc(doc(db,"admin","catalogue_mihi"),catalogue);
      const statsObj={};
      Object.entries(catalogue).forEach(([k,v])=>{if(v.length)statsObj[k]=v.length;});
      setStats({total,details:statsObj});
      setResult("✅ Import réussi !");
    }catch(err){
      setResult("❌ Erreur : "+err.message);
    }
    setImporting(false);
    e.target.value="";
  };

  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1.25rem"}}>
      <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>📦 Import Catalogue Mihi (Excel)</div>
      <p style={{fontSize:".72rem",color:C.gris,marginBottom:".75rem",lineHeight:1.6}}>
        Sélectionne le fichier Excel du catalogue Mihi pour mettre à jour les produits dans l'application.
      </p>
      <label style={{display:"block",background:importing?C.pale:C.brun,color:"white",borderRadius:9,padding:".55rem",textAlign:"center",fontSize:".78rem",fontWeight:600,cursor:importing?"default":"pointer",fontFamily:"inherit"}}>
        {importing?"⏳ Import en cours...":"📂 Choisir le fichier Excel (.xlsx)"}
        <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{display:"none"}} disabled={importing}/>
      </label>
      {result&&<div style={{marginTop:".6rem",fontSize:".74rem",fontWeight:600,color:result.startsWith("✅")?C.vert:"#B04040"}}>{result}</div>}
      {stats&&(
        <div style={{background:C.creme,borderRadius:8,padding:".6rem .75rem",marginTop:".5rem"}}>
          <div style={{fontSize:".68rem",fontWeight:700,color:C.brun,marginBottom:".35rem"}}>{stats.total} produits importés :</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:".3rem"}}>
            {Object.entries(stats.details).map(([k,v])=>(
              <span key={k} style={{fontSize:".62rem",background:C.pale,borderRadius:20,padding:".1rem .45rem",color:C.brun}}>{k}: {v}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminTab(){
  const[items,setItems]=useState([]);
  const[loading,setLoading]=useState(true);
  const[showAdd,setShowAdd]=useState(false);
  const[editId,setEditId]=useState(null);
  const[saving,setSaving]=useState(false);
  const[videosFastStart,setVideosFastStart]=useState({});
  const[anthropicKey,setAnthropicKey]=useState("");
  const[savingKey,setSavingKey]=useState(false);
  const[savedKey,setSavedKey]=useState(false);
  useEffect(()=>{(async()=>{try{const snap=await getDoc(doc(db,"admin","config"));if(snap.exists()&&snap.data().anthropicKey)setAnthropicKey(snap.data().anthropicKey);}catch{}})();},[]);
  const sauvegarderCle=async()=>{setSavingKey(true);try{await setDoc(doc(db,"admin","config"),{anthropicKey},{merge:true});ANTHROPIC_API_KEY=anthropicKey;setSavedKey(true);setTimeout(()=>setSavedKey(false),2000);}catch{}setSavingKey(false);};
  const[savingFS,setSavingFS]=useState(false);
  const[filterDest,setFilterDest]=useState("all");

  const EMPLACEMENTS=[
    {groupe:"🎓 Formation",options:[
      {id:"demarrage",       label:"Formation Démarrage"},
      {id:"vente",           label:"Formation Vente"},
      {id:"recrutement",     label:"Formation Recrutement"},
      {id:"contenu",         label:"Formation Contenu/Réseaux"},
      {id:"devperso",        label:"Développement Personnel Business"},
      {id:"videoannexe",     label:"Vidéos Annexes"},
      {id:"outils",          label:"Formation Outils"},
      {id:"formationapp",    label:"Formation App (général)"},
      {id:"formationchef",   label:"Formation App — Chef d'équipe"},
      {id:"dashboard",        label:"Formation App — Tableau de bord"},
      {id:"outils",           label:"Formation App — Outils généraux"},
    ]},
    {groupe:"🧴 Produits",options:[
      {id:"produits_parfum",      label:"Produits — Parfum"},
      {id:"produits_makeup",      label:"Produits — Maquillage"},
      {id:"produits_complement",  label:"Produits — Compléments alimentaires"},
      {id:"produits_poids",       label:"Produits — Perte de poids"},
      {id:"produits_skincare",    label:"Produits — Skincare"},
      {id:"produits_corpsoin",    label:"Produits — Soins corps"},
      {id:"produits_entretien",   label:"Produits — Entretien"},
    ]},
    {groupe:"🏠 Dashboard",options:[
      {id:"today_top",       label:"Aujourd'hui — En-tête"},
      {id:"today_bottom",    label:"Aujourd'hui — Bas de page"},
      {id:"annonces",        label:"Annonces équipe (popup)"},
    ]},
    {groupe:"📱 Réseaux / Posts",options:[
      {id:"posts_instagram", label:"Posts — Idées Instagram"},
      {id:"posts_facebook",  label:"Posts — Idées Facebook"},
      {id:"posts_stories",   label:"Posts — Idées Stories"},
    ]},
    {groupe:"🔗 Liens & Tunnels",options:[
      {id:"linkbio_liens",   label:"Link-in-Bio — Liens supplémentaires"},
      {id:"tunnel_vente",    label:"Tunnel Vente — Ressources"},
      {id:"tunnel_recrut",   label:"Tunnel Recrutement — Ressources"},
    ]},
  ];

  const TOUS_IDS=EMPLACEMENTS.flatMap(g=>g.options.map(o=>o.id));
  const getLabel=(id)=>{
    for(const g of EMPLACEMENTS) for(const o of g.options) if(o.id===id)return o.label;
    return id;
  };

  const TYPES=[
    {id:"video",    label:"▶ Vidéo Zoom",emoji:"🎬"},
    {id:"youtube",  label:"▶ YouTube",   emoji:"▶️"},
    {id:"drive",    label:"📄 Drive",    emoji:"📄"},
    {id:"doc",      label:"📝 Google Doc",emoji:"📝"},
    {id:"image",    label:"🖼️ Image",    emoji:"🖼️"},
    {id:"info",     label:"💡 Texte",    emoji:"💡"},
    {id:"lien",     label:"🔗 Lien",     emoji:"🔗"},
  ];

  const emptyForm={destination:TOUS_IDS[0],titre:"",description:"",url:"",type:"video",actif:true,image:""};
  const[form,setForm]=useState(emptyForm);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","contenus"));
        if(snap.exists())setItems(snap.data().items||[]);
      }catch{}
      try{
        const snap2=await getDoc(doc(db,"admin","videos_faststart"));
        if(snap2.exists())setVideosFastStart(snap2.data().videos||{});
      }catch{}
      setLoading(false);
    })();
  },[]);

  const saveItems=async(next)=>{
    setSaving(true);
    try{await setDoc(doc(db,"admin","contenus"),{items:next});}catch{}
    setSaving(false);
  };

  const saveVideoFS=async(v)=>{
    setSavingFS(true);
    try{await setDoc(doc(db,"admin","videos_faststart"),{videos:v});}catch{}
    setVideosFastStart(v);
    setSavingFS(false);
  };

  const add=async()=>{
    if(!form.titre.trim())return;
    let next;
    if(editId){
      next=items.map(it=>it.id===editId?{...it,...form}:it);
    } else {
      next=[...items,{id:`adm${Date.now()}`,...form}];
    }
    setItems(next);
    await saveItems(next);
    setForm(emptyForm);setShowAdd(false);setEditId(null);
  };

  const del=async(id)=>{
    if(!window.confirm("Supprimer ce contenu ?"))return;
    const next=items.filter(it=>it.id!==id);
    setItems(next);await saveItems(next);
  };

  const toggle=async(id)=>{
    const next=items.map(it=>it.id===id?{...it,actif:!it.actif}:it);
    setItems(next);await saveItems(next);
  };

  const startEdit=(it)=>{
    setForm({destination:it.destination||it.onglet||TOUS_IDS[0],titre:it.titre||"",description:it.description||"",url:it.url||"",type:it.type||"video",actif:it.actif!==false,image:it.image||""});
    setEditId(it.id);setShowAdd(true);
  };

  if(loading)return<div style={{textAlign:"center",padding:"2rem",color:C.gris}}>Chargement...</div>;

  const itemsFiltres=filterDest==="all"?items:items.filter(it=>(it.destination||it.onglet)===filterDest);
  const SEL=({label,field,options,small=false})=>(
    <div style={{marginBottom:".5rem"}}>
      <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>{label}</div>
      <select value={form[field]} onChange={e=>setForm(p=>({...p,[field]:e.target.value}))}
        style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:small?".35rem .5rem":".42rem .65rem",fontSize:small?".75rem":".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}>
        {options}
      </select>
    </div>
  );
  const INP=({label,field,placeholder,textarea=false})=>(
    <div style={{marginBottom:".5rem"}}>
      <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>{label}</div>
      {textarea
        ?<textarea value={form[field]||""} onChange={e=>setForm(p=>({...p,[field]:e.target.value}))} placeholder={placeholder} rows={3}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",resize:"vertical",lineHeight:1.6}}/>
        :<input value={form[field]||""} onChange={e=>setForm(p=>({...p,[field]:e.target.value}))} placeholder={placeholder}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
      }
    </div>
  );

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Espace <em style={{fontStyle:"italic",color:C.rose}}>Admin</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Ajoute du contenu à n'importe quel endroit du site — formations, vidéos, annonces, ressources.
      </p>

      {/* Sections fixes */}
      <AdminLinkBioSection/>
      <AdminConfigPeriodes/>
      <AdminImportCatalogue/>
      <AdminFormationProduits/>

      {/* Fast Start vidéos */}
      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1.25rem"}}>
        <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".75rem"}}>🚀 Vidéos Fast Start — 7 modules</div>
        {FAST_START_DAYS.map(d=>{
          const key=`module${d.jour}`;
          const cur=videosFastStart[key]||{url:"",type:"youtube"};
          return(
            <div key={d.jour} style={{marginBottom:".6rem",paddingBottom:".6rem",borderBottom:`1px solid ${C.pale}`}}>
              <div style={{fontSize:".72rem",fontWeight:600,color:C.brun,marginBottom:".3rem"}}>Module {d.jour} — {d.titre.split("—")[0].trim()}</div>
              <div style={{display:"flex",gap:".4rem"}}>
                <select value={cur.type} onChange={e=>{const v={...videosFastStart,[key]:{...cur,type:e.target.value}};saveVideoFS(v);}}
                  style={{border:`1px solid ${C.pale}`,borderRadius:7,padding:".35rem .4rem",fontSize:".72rem",fontFamily:"inherit",background:C.creme,outline:"none",flexShrink:0}}>
                  <option value="youtube">YouTube</option>
                  <option value="video">Zoom</option>
                  <option value="drive">Drive</option>
                </select>
                <input value={cur.url} onChange={e=>{const v={...videosFastStart,[key]:{...cur,url:e.target.value}};setVideosFastStart(v);}}
                  onBlur={()=>saveVideoFS(videosFastStart)}
                  placeholder="URL de la vidéo"
                  style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:7,padding:".35rem .55rem",fontSize:".75rem",fontFamily:"inherit",background:C.creme,outline:"none"}}/>
              </div>
            </div>
          );
        })}
        {savingFS&&<div style={{fontSize:".65rem",color:C.vert,textAlign:"right"}}>Sauvegardé ✓</div>}
      </div>

      {/* ── CONTENU LIBRE ── */}
      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".75rem"}}>
          <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose}}>📦 Contenu libre — {items.length} éléments</div>
          <button onClick={()=>{setShowAdd(!showAdd);setForm(emptyForm);setEditId(null);}}
            style={{background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".35rem .75rem",fontSize:".72rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
            {showAdd&&!editId?"✕ Annuler":"+ Ajouter"}
          </button>
        </div>

        {/* Formulaire ajout/édition */}
        {showAdd&&(
          <div style={{background:C.creme,borderRadius:10,padding:".85rem",marginBottom:".75rem",border:`1px solid ${C.pale}`}}>
            <div style={{fontSize:".68rem",fontWeight:700,color:C.brun,marginBottom:".65rem"}}>{editId?"✏️ Modifier":"+ Nouveau contenu"}</div>

            {/* Destination */}
            <div style={{marginBottom:".5rem"}}>
              <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>📍 Où afficher ce contenu ?</div>
              <select value={form.destination} onChange={e=>setForm(p=>({...p,destination:e.target.value}))}
                style={{width:"100%",border:`1.5px solid ${C.rose}`,borderRadius:8,padding:".45rem .65rem",fontSize:".82rem",fontFamily:"inherit",color:C.brun,background:"white",outline:"none",fontWeight:600}}>
                {EMPLACEMENTS.map(g=>(
                  <optgroup key={g.groupe} label={g.groupe}>
                    {g.options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            <SEL label="Type de contenu" field="type" options={TYPES.map(t=><option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}/>
            <INP label="Titre *" field="titre" placeholder="Ex: Comment aborder une inconnue sur Instagram"/>
            <INP label="Description" field="description" placeholder="Résumé, conseils..." textarea/>
            {["video","youtube","drive","doc","lien"].includes(form.type)&&
              <INP label="URL" field="url" placeholder="https://..."/>
            }
            {form.type==="image"&&
              <UploadPhoto label="Image" value={form.image} onChange={v=>setForm(p=>({...p,image:v}))} folder="admin-contenu"/>
            }
            <label style={{display:"flex",alignItems:"center",gap:".5rem",fontSize:".75rem",color:C.brun,cursor:"pointer",marginTop:".25rem"}}>
              <input type="checkbox" checked={!!form.actif} onChange={e=>setForm(p=>({...p,actif:e.target.checked}))}/>
              Visible immédiatement
            </label>
            <div style={{display:"flex",gap:".4rem",marginTop:".65rem"}}>
              <button onClick={add} disabled={saving||!form.titre.trim()}
                style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                {saving?"Sauvegarde...":editId?"✓ Modifier":"✓ Ajouter"}
              </button>
              <button onClick={()=>{setShowAdd(false);setEditId(null);setForm(emptyForm);}}
                style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Filtre par destination */}
        <div style={{marginBottom:".65rem"}}>
          <select value={filterDest} onChange={e=>setFilterDest(e.target.value)}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".4rem .65rem",fontSize:".76rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}>
            <option value="all">Tous les contenus ({items.length})</option>
            {EMPLACEMENTS.map(g=>(
              <optgroup key={g.groupe} label={g.groupe}>
                {g.options.map(o=>{
                  const n=items.filter(it=>(it.destination||it.onglet)===o.id).length;
                  return<option key={o.id} value={o.id}>{o.label} ({n})</option>;
                })}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Liste items */}
        {itemsFiltres.length===0&&<div style={{textAlign:"center",fontSize:".72rem",color:C.gris,padding:".75rem",fontStyle:"italic"}}>Aucun contenu{filterDest!=="all"?" dans cet emplacement":""}</div>}
        {itemsFiltres.map(it=>{
          const T=TYPES.find(t=>t.id===it.type)||TYPES[0];
          return(
            <div key={it.id} style={{display:"flex",alignItems:"center",gap:".5rem",background:it.actif?C.creme:"#f0f0f0",borderRadius:9,padding:".5rem .75rem",marginBottom:".35rem",border:`1px solid ${it.actif?C.pale:"#ddd"}`,opacity:it.actif?1:.7}}>
              <span style={{fontSize:"1rem",flexShrink:0}}>{T.emoji}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:".78rem",fontWeight:600,color:C.brun,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.titre}</div>
                <div style={{fontSize:".6rem",color:C.rose,fontWeight:600}}>📍 {getLabel(it.destination||it.onglet||"")}</div>
              </div>
              <button onClick={()=>toggle(it.id)} title={it.actif?"Masquer":"Afficher"}
                style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:6,padding:".18rem .35rem",fontSize:".65rem",color:it.actif?C.vert:C.gris,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                {it.actif?"👁️":"🙈"}
              </button>
              <button onClick={()=>startEdit(it)}
                style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:6,padding:".18rem .35rem",fontSize:".65rem",color:C.gris,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>✏️</button>
              <button onClick={()=>del(it.id)}
                style={{background:"none",border:`1px solid #E0C0C0`,borderRadius:6,padding:".18rem .35rem",fontSize:".65rem",color:"#B04040",cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>✕</button>
            </div>
          );
        })}
      </div>

      {/* Clé API Anthropic */}
      <div style={{background:C.creme,borderRadius:12,padding:"1rem",marginTop:"1rem",border:"1px solid "+C.pale}}>
        <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.brun,marginBottom:".5rem"}}>🔑 Clé API Anthropic (IA)</div>
        <div style={{fontSize:".72rem",color:C.gris,marginBottom:".5rem",lineHeight:1.5}}>Renouvelle-la si les diagnostics IA ne fonctionnent plus.</div>
        <input type="password" placeholder="sk-ant-api03-..." value={anthropicKey} onChange={e=>setAnthropicKey(e.target.value)}
          style={{width:"100%",border:"1px solid "+C.pale,borderRadius:8,padding:".45rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:"white",outline:"none",marginBottom:".5rem"}}/>
        <button onClick={sauvegarderCle} disabled={savingKey||!anthropicKey.trim()}
          style={{background:C.brun,color:"white",border:"none",borderRadius:8,padding:".45rem 1rem",fontSize:".75rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
          {savingKey?"...":savedKey?"✅ Sauvegardée !":"💾 Sauvegarder la clé"}
        </button>
      </div>

      {/* Scripts personnalisés */}
      <div style={{background:C.creme,borderRadius:12,padding:"1rem",marginTop:"1rem",border:"1px solid "+C.pale}}>
        <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.brun,marginBottom:".75rem"}}>📝 Scripts personnalisés</div>
        <AdminScriptsEditor/>
      </div>
    </div>
  );
}

function DevPersoSection({adminItems}){
  const[dvpTab,setDvpTab]=useState("business");
  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".5rem"}}>
        Développement <em style={{fontStyle:"italic",color:C.rose}}>Personnel</em>
      </div>
      <div style={{display:"flex",gap:".35rem",marginBottom:"1rem"}}>
        {[{id:"business",label:"🧠 Business"},{id:"annexe",label:"🎥 Vidéos annexes"}].map(t=>(
          <button key={t.id} onClick={()=>setDvpTab(t.id)}
            style={{flex:1,padding:".5rem",fontSize:".75rem",fontWeight:600,borderRadius:10,border:`1.5px solid ${dvpTab===t.id?C.rose:C.pale}`,background:dvpTab===t.id?C.rose:C.blanc,color:dvpTab===t.id?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
            {t.label}
          </button>
        ))}
      </div>
      {dvpTab==="business"&&(
        <div>
          <AdminContentBlock onglet="devperso" items={adminItems}/>
          {[
            {icon:"🧠",title:"Dégommer son plafond de verre",desc:"Identifier les croyances limitantes qui t'empêchent d'avancer et les transformer en force.",video:"https://us06web.zoom.us/rec/share/XzuZHzXLLZdVOz2rQmBb-7nomO9qxTj92_xluvzizpzlSaYfxRdmTARqoDTdatzs.EHObmbNT1mpbo0Ad"},
            {icon:"🎯",title:"Fixer ses objectifs — méthode complète",desc:"Des objectifs qui fonctionnent vraiment.",video:"https://us06web.zoom.us/rec/share/E1JtWx4furUdNFt4wKKCJYcfD4ScYwhJZ3BfUnHZYOnbUzcRYLzdLq5WuoyJSjw.MsevJMjQXIrzr1rp?startTime=1771357741000"},
            {icon:"👑",title:"Développer son leadership",desc:"Comment inspirer, guider et faire grandir son équipe.",video:"https://us06web.zoom.us/rec/share/hnDWdngAPCK_SGVTYzVhgk70t_nqqfesUvZF7hme8CaEgL-CpszXoantB-d2MSPZ.Yl7wHQ7KV9pZJnCL"},
            {icon:"📱",title:"Personal branding",desc:"Qui tu es en ligne = qui tu attires.",video:"https://youtu.be/j5EUiKmUSgM"},
            {icon:"🤝",title:"Humaniser son contenu",desc:"Pourquoi les gens achètent à des personnes, pas à des marques.",video:"https://youtu.be/WxJFBnigjpw"},
            {icon:"📖",title:"Le storytelling",desc:"Raconter pour vendre, pour convaincre, pour recruter.",video:"https://youtu.be/dgylHebkai4"},
          ].map(item=>(
            <div key={item.title} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem 1rem",marginBottom:".6rem"}}>
              <div style={{display:"flex",gap:".6rem",alignItems:"flex-start",marginBottom:item.video?".6rem":0}}>
                <span style={{fontSize:"1.1rem",flexShrink:0}}>{item.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:C.brun,marginBottom:".15rem"}}>{item.title}</div>
                  <div style={{fontSize:".72rem",color:C.gris,lineHeight:1.55}}>{item.desc}</div>
                </div>
              </div>
              {item.video&&<YTBtn href={item.video} label="▶ Voir la formation"/>}
            </div>
          ))}
        </div>
      )}
      {dvpTab==="annexe"&&(
        <div>
          <AdminContentBlock onglet="videoannexe" items={adminItems}/>
          <div style={{background:C.creme,borderRadius:10,padding:".75rem 1rem",fontSize:".75rem",color:C.gris,lineHeight:1.65}}>
            💡 Les vidéos annexes sont ajoutées depuis l'espace Admin.
          </div>
        </div>
      )}
    </div>
  );
}

function AdminContentBlock({onglet,items}){
  const {lang} = useLang();
  const filtered=(items||[]).filter(i=>(i.destination||i.onglet)===onglet&&i.actif!==false);
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
        return <AdminContentItem key={item.id} item={item} cfg={cfg} lang={lang}/>;
      })}
    </div>
  );
}

function AdminContentItem({item,cfg,lang}){
  const[titre,setTitre]=useState(item.titre||"");
  const[desc,setDesc]=useState(item.description||"");

  useEffect(()=>{
    if(lang==="fr"){setTitre(item.titre||"");setDesc(item.description||"");return;}
    const toTr=[item.titre||"",item.description||""].filter(Boolean);
    if(!toTr.length)return;
    translateBatch(toTr,lang).then(res=>{
      setTitre(res[0]||item.titre);
      if(item.description) setDesc(res[1]||item.description);
    });
  },[lang,item.id]);

  return(
    <div style={{background:"rgba(196,154,138,.08)",border:`1px solid ${C.pale}`,borderRadius:10,padding:".65rem .85rem",marginBottom:".4rem"}}>
      <div style={{fontSize:".78rem",fontWeight:600,color:C.brun,marginBottom:desc?".2rem":item.url?".35rem":0}}>{titre}</div>
      {desc&&<div style={{fontSize:".72rem",color:C.gris,lineHeight:1.5,marginBottom:item.url?".4rem":0}}>{desc}</div>}
      {item.url&&(
        <a href={item.url} target="_blank" rel="noopener noreferrer"
          style={{display:"flex",alignItems:"center",gap:".5rem",background:cfg.color,borderRadius:8,padding:".45rem .8rem",textDecoration:"none",marginTop:".1rem"}}>
          <span style={{fontSize:".8rem",flexShrink:0}}>{cfg.icon}</span>
          <span style={{fontSize:".72rem",fontWeight:600,color:"white"}}>
            {lang==="pt"?"Abrir":"Ouvrir"} — {cfg.label}
          </span>
          <span style={{marginLeft:"auto",color:"rgba(255,255,255,.6)",fontSize:".6rem"}}>→</span>
        </a>
      )}
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
  {id:"perte_poids",icon:"⚖️",label:"Perte de poids"},
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
          <UploadPhoto label="Photo" value={form.url} onChange={v=>setForm(p=>({...p,url:v}))} folder="banque-images"/>
          <div style={{display:"flex",gap:".4rem",marginBottom:".45rem",marginTop:".3rem"}}>
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

// ── DIAGNOSTIC BUSINESS (recrutement / ventes / réseaux) ─────────────────────
export default App;
