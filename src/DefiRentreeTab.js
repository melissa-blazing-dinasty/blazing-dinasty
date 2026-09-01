import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { C } from './constants';
import { httpsCallable } from 'firebase/functions';
import { fbFunctions } from './App';

// Date de démarrage du défi — à ajuster si besoin
const DATE_DEBUT = "2026-09-01";

const THEMES = [
  { id:"vente", label:"🛍️ Vente", couleur:C.rose,
    actions:[
      {txt:"Partage 1 produit en story/publication", pts:10},
      {txt:"Contacte 1 cliente pour un réassort ou une nouveauté", pts:10},
      {txt:"Conclus 1 vente aujourd'hui", pts:20},
    ]},
  { id:"recrutement", label:"👑 Recrutement", couleur:C.or,
    actions:[
      {txt:"Partage ton lien tunnel recrutement", pts:10},
      {txt:"Présente l'opportunité à 1 personne", pts:15},
      {txt:"Obtiens 1 nouvelle inscription", pts:30},
    ]},
  { id:"contenu", label:"📱 Contenu", couleur:C.lilas,
    actions:[
      {txt:"Poste 1 story", pts:5},
      {txt:"Poste 1 reel ou 1 publication", pts:10},
    ]},
  { id:"equipe", label:"🤝 Équipe", couleur:C.brun,
    actions:[
      {txt:"Aide ou encourage une coéquipière", pts:10},
      {txt:"Partage une astuce ou une réussite dans le groupe", pts:5},
    ]},
  { id:"vente2", label:"🛍️ Vente", couleur:C.rose,
    actions:[
      {txt:"Partage 1 produit en story/publication", pts:10},
      {txt:"Propose un produit complémentaire à une cliente existante", pts:10},
      {txt:"Conclus 1 vente aujourd'hui", pts:20},
    ]},
  { id:"recrutement2", label:"👑 Recrutement", couleur:C.or,
    actions:[
      {txt:"Partage ton lien tunnel recrutement", pts:10},
      {txt:"Relance 1 prospect déjà en contact", pts:15},
      {txt:"Obtiens 1 nouvelle inscription", pts:30},
    ]},
  { id:"bonus", label:"✨ Bilan & Objectifs", couleur:C.vert||"#2E7D32",
    actions:[
      {txt:"Fais ton bilan de la semaine écoulée", pts:10},
      {txt:"Fixe ton objectif pour la semaine prochaine", pts:10},
    ]},
];

const PALIERS = [
  {seuil:100, label:"-70% sur 1 produit au choix", icon:"🥉"},
  {seuil:250, label:"Cadeau surprise", icon:"🥈"},
  {seuil:500, label:"5€ de réduction", icon:"🥇"},
];

const RECOMPENSES_CLASSEMENT = [
  {rang:1, label:"50€", icon:"🥇"},
  {rang:2, label:"30€", icon:"🥈"},
  {rang:3, label:"20€", icon:"🥉"},
];

function joursDepuisDebut(){
  const debut=new Date(DATE_DEBUT+"T00:00:00");
  const auj=new Date();
  const diff=Math.floor((auj-debut)/(1000*60*60*24))+1;
  return diff;
}

function DefiRentreeTab({uid, userName}){
  const [showRegles,setShowRegles]=useState(false);
  const [venteManuelle,setVenteManuelle]=useState("");
  const ajouterVenteManuelle=async()=>{
    const montant=parseFloat(venteManuelle);
    if(!montant||montant<=0)return;
    const nouveauTotal=(monEntree.pointsVentes||0)+montant;
    const maj={...monEntree, prenom:userName||"Distributrice", pointsVentes:nouveauTotal};
    setMonEntree(maj);
    setVenteManuelle("");
    try{ await setDoc(doc(db,"equipe","defi-rentree"),{participants:{[uid]:maj}},{merge:true}); }catch{}
  };
  const[loading,setLoading]=useState(true);
  const[monEntree,setMonEntree]=useState({points:0,streak:0,dernierJourValide:0,historique:{}});
  const[participants,setParticipants]=useState({});
  const[onglet,setOnglet]=useState("aujourdhui");
  const[nomRecrue,setNomRecrue]=useState("");
  const[declarationEnCours,setDeclarationEnCours]=useState(false);
  const[declarationOk,setDeclarationOk]=useState(false);

  const jourActuel=joursDepuisDebut();
  const jourAffiche=Math.min(Math.max(jourActuel,1),21);
  const themeJour=THEMES[(jourAffiche-1)%THEMES.length];
  const dejaValideAujourdhui=!!(monEntree.historique&&monEntree.historique[jourAffiche]);
  const actionsFaitesAujourdhui=(monEntree.historique&&monEntree.historique[jourAffiche]&&monEntree.historique[jourAffiche].actions)||[];

  useEffect(()=>{
    const ref=doc(db,"equipe","defi-rentree");
    const unsub=onSnapshot(ref,(snap)=>{
      const data=snap.exists()?(snap.data().participants||{}):{};
      setParticipants(data);
      if(data[uid]) setMonEntree(data[uid]);
      setLoading(false);
    },()=>setLoading(false));
    return()=>unsub();
  },[uid]);

  const toggleAction=async(idx)=>{
    const actionsActuelles=[...actionsFaitesAujourdhui];
    const dejaFaite=actionsActuelles.includes(idx);
    const nouvellesActions=dejaFaite?actionsActuelles.filter(i=>i!==idx):[...actionsActuelles,idx];

    const pointsJourAvant=actionsActuelles.reduce((s,i)=>s+themeJour.actions[i].pts,0);
    const pointsJourApres=nouvellesActions.reduce((s,i)=>s+themeJour.actions[i].pts,0);
    const diffPoints=pointsJourApres-pointsJourAvant;

    const nouvelHistorique={...(monEntree.historique||{}),[jourAffiche]:{actions:nouvellesActions,points:pointsJourApres}};
    const nouveauTotal=Math.max(0,(monEntree.points||0)+diffPoints);

    let nouveauStreak=monEntree.streak||0;
    if(!dejaValideAujourdhui&&nouvellesActions.length>0){
      nouveauStreak=(monEntree.dernierJourValide===jourAffiche-1)?nouveauStreak+1:1;
    }

    const maj={
      prenom:userName||"Distributrice",
      points:nouveauTotal,
      streak:nouveauStreak,
      dernierJourValide:nouvellesActions.length>0?jourAffiche:monEntree.dernierJourValide,
      historique:nouvelHistorique
    };
    setMonEntree(maj);
    try{
      await setDoc(doc(db,"equipe","defi-rentree"),{participants:{[uid]:maj}},{merge:true});
      const palierFranchi=PALIERS.some(p=>(monEntree.points||0)<p.seuil&&nouveauTotal>=p.seuil);
      if(palierFranchi){
        const fn=httpsCallable(fbFunctions,"notifierPalierDefiRentreeActions");
        fn({prenom:userName,ancienPoints:monEntree.points||0,nouveauxPoints:nouveauTotal}).catch(()=>{});
      }
    }catch{}
  };

  const classement=Object.entries(participants)
    .map(([id,d])=>({id,...d}))
    .sort((a,b)=>(b.points||0)-(a.points||0));

  const classementVentes=Object.entries(participants)
    .map(([id,d])=>({id,...d}))
    .sort((a,b)=>(b.pointsVentes||0)-(a.pointsVentes||0));

  const classementRecrutement=Object.entries(participants)
    .map(([id,d])=>({id,...d}))
    .sort((a,b)=>(b.pointsRecrutement||0)-(a.pointsRecrutement||0));

  const declarerRecrue=async()=>{
    if(!nomRecrue.trim())return;
    setDeclarationEnCours(true);
    try{
      const fn=httpsCallable(fbFunctions,"declarerRecrueDefiRentree");
      await fn({nomRecrue:nomRecrue.trim()});
      setNomRecrue("");
      setDeclarationOk(true);
      setTimeout(()=>setDeclarationOk(false),2500);
    }catch(e){
      alert("Erreur lors de la déclaration : "+e.message);
    }
    setDeclarationEnCours(false);
  };

  const palierAtteint=[...PALIERS].reverse().find(p=>(monEntree.points||0)>=p.seuil);
  const prochainPalier=PALIERS.find(p=>(monEntree.points||0)<p.seuil);

  if(loading)return null;

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Défi <em style={{fontStyle:"italic",color:C.rose}}>Rentrée</em> · 21 jours
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Jour {jourAffiche}/21 — un thème par jour, des actions simples, des points qui comptent. On avance ensemble 💪
      </p>
      <button onClick={()=>setShowRegles(p=>!p)} style={{width:"100%",background:C.creme,border:`1px solid ${C.pale}`,borderRadius:10,padding:".55rem",fontSize:".72rem",fontWeight:600,color:C.brun,cursor:"pointer",fontFamily:"inherit",marginBottom:showRegles?".6rem":"1rem"}}>📋 Voir les regles du defi</button>
      {showRegles&&(<div style={{background:C.creme,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem",fontSize:".78rem",color:C.texte,lineHeight:1.7}}>
        <p><strong>Comment gagner des points ?</strong><br/>Chaque jour a son theme. Coche les actions realisees pour gagner leurs points.</p>
        <p><strong>Tes recompenses personnelles :</strong><br/>100 points : -70% sur 1 produit au choix<br/>250 points : cadeau surprise<br/>500 points : 5€ de reduction</p>
        <p><strong>Classement equipe (recompenses du top 3 a la fin) :</strong><br/>1ere place : 50€<br/>2eme place : 30€<br/>3eme place : 20€</p>
        <p style={{margin:0}}>Reviens chaque jour pour ne pas perdre ton streak, et declare tes nouvelles recrues pour gagner encore plus de points !</p>
      </div>)}
      <p style={{display:"none"}}>
      </p>

      {/* Mes stats */}
      <div style={{display:"flex",gap:".5rem",marginBottom:"1rem"}}>
        <div style={{flex:1,background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:12,padding:".75rem",textAlign:"center"}}>
          <div style={{fontSize:"1.3rem",fontWeight:700,color:"white"}}>{monEntree.points||0}</div>
          <div style={{fontSize:".6rem",color:C.pale,textTransform:"uppercase",letterSpacing:".08em"}}>Points</div>
        </div>
        <div style={{flex:1,background:C.creme,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem",textAlign:"center"}}>
          <div style={{fontSize:"1.3rem",fontWeight:700,color:C.brun}}>🔥 {monEntree.streak||0}</div>
          <div style={{fontSize:".6rem",color:C.gris,textTransform:"uppercase",letterSpacing:".08em"}}>Jours de suite</div>
        </div>
      </div>

      {palierAtteint&&(
        <div style={{background:C.or+"15",border:`1px solid ${C.or}`,borderRadius:10,padding:".5rem .75rem",marginBottom:".5rem",fontSize:".72rem",color:C.brun,fontWeight:600}}>
          {palierAtteint.icon} Palier {palierAtteint.label} atteint !
        </div>
      )}
      {prochainPalier&&(
        <div style={{background:C.creme,borderRadius:10,padding:".5rem .75rem",marginBottom:"1rem",fontSize:".68rem",color:C.gris}}>
          Encore {prochainPalier.seuil-(monEntree.points||0)} pts pour le palier {prochainPalier.label} {prochainPalier.icon}
        </div>
      )}

      {/* Navigation onglets */}
      <div style={{display:"flex",gap:".3rem",marginBottom:".75rem",flexWrap:"wrap"}}>
        {[{id:"aujourdhui",label:"📅 Aujourd'hui"},{id:"ventes",label:"💰 Ventes"},{id:"recrutement",label:"👑 Recrutement"},{id:"classement",label:`🏆 Classement (${classement.length})`}].map(o=>(
          <button key={o.id} onClick={()=>setOnglet(o.id)}
            style={{flex:1,padding:".5rem .3rem",fontSize:".7rem",fontWeight:600,borderRadius:10,border:`1.5px solid ${onglet===o.id?C.rose:C.pale}`,background:onglet===o.id?C.rose:C.blanc,color:onglet===o.id?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
            {o.label}
          </button>
        ))}
      </div>

      {onglet==="aujourdhui"&&(
        <div>
          <div style={{background:themeJour.couleur,borderRadius:12,padding:"1rem",marginBottom:".75rem"}}>
            <div style={{fontSize:".95rem",fontWeight:700,color:"white"}}>{themeJour.label}</div>
            <div style={{fontSize:".65rem",color:"rgba(255,255,255,.85)"}}>Thème du jour {jourAffiche}</div>
          </div>
          {themeJour.actions.map((a,idx)=>{
            const faite=actionsFaitesAujourdhui.includes(idx);
            return(
              <div key={idx} onClick={()=>toggleAction(idx)}
                style={{display:"flex",alignItems:"center",gap:".6rem",background:faite?C.vert+"15"||"#E8F5E9":C.blanc,border:`1.5px solid ${faite?(C.vert||"#2E7D32"):C.pale}`,borderRadius:10,padding:".65rem .85rem",marginBottom:".4rem",cursor:"pointer"}}>
                <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${faite?(C.vert||"#2E7D32"):C.pale}`,background:faite?(C.vert||"#2E7D32"):"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"white",fontSize:".75rem"}}>
                  {faite?"✓":""}
                </div>
                <div style={{flex:1,fontSize:".78rem",color:C.brun,textDecoration:faite?"line-through":"none"}}>{a.txt}</div>
                <div style={{fontSize:".68rem",fontWeight:700,color:C.rose,flexShrink:0}}>+{a.pts}</div>
              </div>
            );
          })}
        </div>
      )}

      {onglet==="ventes"&&(
        <div>
          <div style={{background:C.rose,borderRadius:12,padding:"1rem",marginBottom:".75rem",textAlign:"center"}}>
            <div style={{fontSize:"1.5rem",fontWeight:700,color:"white"}}>{(monEntree.pointsVentes||0).toFixed(0)}€</div>
            <div style={{fontSize:".65rem",color:"rgba(255,255,255,.85)"}}>Total vendu pendant le défi</div>
          </div>
          <div style={{background:C.creme,borderRadius:10,padding:".6rem .8rem",marginBottom:".75rem",fontSize:".68rem",color:C.gris,lineHeight:1.6}}>
            💡 Ce compteur se remplit automatiquement dès qu'une de tes commandes boutique est confirmée. Tu peux aussi ajouter une vente faite en direct (hors boutique) ci-dessous.
          </div>
          <div style={{display:"flex",gap:".4rem",marginBottom:"1rem"}}>
            <input type="number" min="0" step="0.01" value={venteManuelle} onChange={e=>setVenteManuelle(e.target.value)}
              placeholder="Montant en euros"
              style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".5rem .7rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none"}}/>
            <button onClick={ajouterVenteManuelle}
              style={{background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".5rem .9rem",fontSize:".75rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap"}}>
              + Ajouter
            </button>
          </div>
          <div style={{fontSize:".62rem",fontWeight:700,color:C.gris,textTransform:"uppercase",letterSpacing:".08em",marginBottom:".5rem"}}>Classement Ventes</div>
          {classementVentes.filter(p=>(p.pointsVentes||0)>0).length===0&&(
            <div style={{textAlign:"center",padding:"1rem",color:C.gris,fontSize:".75rem",fontStyle:"italic"}}>Aucune vente enregistrée pour l'instant.</div>
          )}
          {classementVentes.filter(p=>(p.pointsVentes||0)>0).map((p,i)=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:".6rem",background:p.id===uid?C.rose+"10":C.blanc,border:`1px solid ${p.id===uid?C.rose:C.pale}`,borderRadius:10,padding:".55rem .8rem",marginBottom:".3rem"}}>
              <div style={{width:24,fontSize:i<3?"1rem":".78rem",fontWeight:700,color:C.brun,textAlign:"center",flexShrink:0}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</div>
              <div style={{flex:1,fontSize:".78rem",fontWeight:p.id===uid?700:600,color:C.brun}}>{p.prenom}{p.id===uid?" (toi)":""}</div>
              <div style={{fontSize:".8rem",fontWeight:700,color:C.rose}}>{(p.pointsVentes||0).toFixed(0)}€</div>
            </div>
          ))}
        </div>
      )}

      {onglet==="recrutement"&&(
        <div>
          <div style={{background:C.or,borderRadius:12,padding:"1rem",marginBottom:".75rem",textAlign:"center"}}>
            <div style={{fontSize:"1.5rem",fontWeight:700,color:"white"}}>{monEntree.pointsRecrutement||0} pts</div>
            <div style={{fontSize:".65rem",color:"rgba(255,255,255,.85)"}}>{(monEntree.recrues||[]).length} recrue(s) confirmée(s)</div>
          </div>
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".72rem",fontWeight:700,color:C.brun,marginBottom:".5rem"}}>Déclarer une nouvelle recrue</div>
            <div style={{fontSize:".65rem",color:C.gris,marginBottom:".6rem",lineHeight:1.5}}>
              À valider uniquement si la personne s'est bien inscrite <strong>et</strong> a passé sa première commande (+100 pts).
            </div>
            <input placeholder="Prénom de la recrue" value={nomRecrue} onChange={e=>setNomRecrue(e.target.value)}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".5rem .7rem",fontSize:".78rem",fontFamily:"inherit",marginBottom:".5rem",outline:"none"}}/>
            <button onClick={declarerRecrue} disabled={declarationEnCours||!nomRecrue.trim()}
              style={{width:"100%",background:declarationOk?(C.vert||"#2E7D32"):C.or,color:"white",border:"none",borderRadius:8,padding:".55rem",fontSize:".76rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
              {declarationEnCours?"...":declarationOk?"✅ Recrue déclarée !":"+ Déclarer cette recrue"}
            </button>
          </div>
          <div style={{fontSize:".62rem",fontWeight:700,color:C.gris,textTransform:"uppercase",letterSpacing:".08em",marginBottom:".5rem"}}>Classement Recrutement</div>
          {classementRecrutement.filter(p=>(p.pointsRecrutement||0)>0).length===0&&(
            <div style={{textAlign:"center",padding:"1rem",color:C.gris,fontSize:".75rem",fontStyle:"italic"}}>Aucune recrue déclarée pour l'instant.</div>
          )}
          {classementRecrutement.filter(p=>(p.pointsRecrutement||0)>0).map((p,i)=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:".6rem",background:p.id===uid?C.rose+"10":C.blanc,border:`1px solid ${p.id===uid?C.rose:C.pale}`,borderRadius:10,padding:".55rem .8rem",marginBottom:".3rem"}}>
              <div style={{width:24,fontSize:i<3?"1rem":".78rem",fontWeight:700,color:C.brun,textAlign:"center",flexShrink:0}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</div>
              <div style={{flex:1,fontSize:".78rem",fontWeight:p.id===uid?700:600,color:C.brun}}>{p.prenom}{p.id===uid?" (toi)":""}</div>
              <div style={{fontSize:".8rem",fontWeight:700,color:C.rose}}>{p.pointsRecrutement||0} pts</div>
            </div>
          ))}
        </div>
      )}

      {onglet==="classement"&&(
        <div>
          <div style={{background:C.creme,border:`1px solid ${C.or}`,borderRadius:10,padding:".6rem .8rem",marginBottom:".75rem",fontSize:".68rem",color:C.brun,lineHeight:1.7}}>
            <strong>🏆 Récompenses finales (jour 21)</strong><br/>
            {RECOMPENSES_CLASSEMENT.map(r=>`${r.icon} ${r.rang}${r.rang===1?"ère":"ème"} — ${r.label}`).join("  ·  ")}
          </div>
          {classement.length===0&&(
            <div style={{textAlign:"center",padding:"1.5rem",color:C.gris,fontSize:".75rem",fontStyle:"italic"}}>
              Personne n'a encore commencé le défi. Sois la première ! 🚀
            </div>
          )}
          {classement.map((p,i)=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:".6rem",background:p.id===uid?C.rose+"10":C.blanc,border:`1px solid ${p.id===uid?C.rose:C.pale}`,borderRadius:10,padding:".6rem .85rem",marginBottom:".35rem"}}>
              <div style={{width:26,fontSize:i<3?"1.1rem":".8rem",fontWeight:700,color:C.brun,textAlign:"center",flexShrink:0}}>
                {i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}
              </div>
              <div style={{flex:1,fontSize:".8rem",fontWeight:p.id===uid?700:600,color:C.brun}}>{p.prenom}{p.id===uid?" (toi)":""}</div>
              <div style={{fontSize:".65rem",color:C.gris}}>🔥{p.streak||0}</div>
              <div style={{fontSize:".85rem",fontWeight:700,color:C.rose,flexShrink:0}}>{p.points||0} pts</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { DefiRentreeTab, THEMES, joursDepuisDebut };
