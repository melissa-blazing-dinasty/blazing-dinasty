import { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let ANTHROPIC_API_KEY = '';

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

function extraireIdYoutube(url){
  const m=url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/);
  return m?m[1]:null;
}
function extraireIdDrive(url){
  const m=url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  return m?m[1]:null;
}

// Bouton video qui se deplie sur place (YouTube ou Drive) au lieu d'ouvrir un nouvel onglet
function VideoBtnInline({href,label,color,icon,embedUrl}){
  const[open,setOpen]=useState(false);
  return(
    <div style={{marginBottom:".45rem"}}>
      <div onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:".55rem",background:color,borderRadius:9,padding:".6rem .9rem",cursor:"pointer"}}>
        <span style={{fontSize:".85rem",flexShrink:0}}>{icon}</span>
        <span style={{fontSize:".75rem",fontWeight:600,color:C.blanc,lineHeight:1.3}}>{label}</span>
        <span style={{marginLeft:"auto",color:C.pale,fontSize:".7rem",opacity:.8,flexShrink:0,transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}>⌄</span>
      </div>
      {open&&(
        <div style={{marginTop:".4rem",borderRadius:9,overflow:"hidden",position:"relative",paddingBottom:"56.25%",height:0,background:"#000"}}>
          <iframe src={embedUrl} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen title={label}
            style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:"none"}}/>
        </div>
      )}
    </div>
  );
}

function YTBtn({href,label}){
  const id=extraireIdYoutube(href);
  if(!id) return <Btn href={href} label={label} color="#8B1A1A" icon="▶"/>;
  return <VideoBtnInline href={href} label={label} color="#8B1A1A" icon="▶" embedUrl={`https://www.youtube.com/embed/${id}`}/>;
}
function DriveBtn({href,label}){
  const id=extraireIdDrive(href);
  if(!id) return <Btn href={href} label={label} color={C.brun2} icon="📄"/>;
  return <VideoBtnInline href={href} label={label} color={C.brun2} icon="📄" embedUrl={`https://drive.google.com/file/d/${id}/preview`}/>;
}
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


export { buildEquipeTree, countEquipe, getLigneeChefs, countEquipeSafe, SearchSelect,
  todayLocalDate, todayLocalStr, BoutonMiseAJour, useLang, useTranslation, useTranslatedContent,
  useTranslatedProduit, T, Btn, YTBtn, DriveBtn, DocBtn, Card, Info, Tag, SecTitle,
  LangContext, UI_TEXTS, UI_TEXTS_PT, domOriginals, translateDOM, translateBatch,
  seedAnnuaireFromMembres, APP_VERSION, C };
