import React, { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { C } from './constants';
import { ANTHROPIC_API_KEY } from './App';

export function AssistanteIATab({uid, userName, goToTab=()=>{}}){
  const[ouvert,setOuvert]=useState(false);
  const[messages,setMessages]=useState([]);
  const[input,setInput]=useState("");
  const[loading,setLoading]=useState(false);
  const[ordonnanceEnvoyee,setOrdonnanceEnvoyee]=useState({});

  const ouvrirChat=()=>{
    setOuvert(true);
    if(messages.length===0){
      setMessages([{role:"assistant",text:`Coucou ${userName?.split(" ")[0]||""} ! 👋 Je suis ton assistante Blazing Dynasty. Je peux t'aider à conseiller tes clientes sur les produits Mihi (avec ordonnance et prix), répondre à tes questions business, ou juste t'écouter si t'as besoin d'en parler. Ou pour t'aider à utiliser l'appli. De quoi as-tu besoin ?`}]);
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
          const allProduits=[...(cat.face||[]),...(cat.hair||[]),...(cat.health||[]),...(cat.corps||[]),...(cat.makeup||[]),...(cat.parfums||[])].slice(0,60);
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
          produitsFormationText=lignes.slice(0,80).join("\n");
        }
      }catch{}

      const historique=newMsgs.slice(-8).map(m=>`${m.role==="user"?"Distributrice":"Assistante"}: ${m.text}`).join("\n");

      const prompt=`Tu es l'assistante IA de l'équipe Blazing Dynasty (Mihi France), une équipe de vente directe en MLM. Tu parles à une distributrice de l'équipe, jamais à une cliente finale.

CONTEXTE FORMATIONS DE L'ÉQUIPE :
${formationText||"Aucune formation chargée pour l'instant."}

DÉTAILS PRODUITS (descriptions formation) :
${produitsFormationText||"Aucun détail produit chargé."}

AIDE UTILISATION DE L'APPLICATION (utilise ceci si la distributrice demande comment faire quelque chose DANS l'appli Blazing Dynasty, pas pour conseiller une cliente) :
- dashboard (Aujourd'hui) : ecran d'accueil, jauge de progression vers les objectifs, badges, actions du jour a cocher
- objectifs : suivre son chiffre d'affaires periode par periode, definir son objectif CA et palier
- linkbio : creer sa page LinkBio publique (photo, liens boutique/recrutement, Mon Parcours, reseaux sociaux)
- dreamboard : tableau de visualisation des reves, ajouter des photos/reves avec categorie
- diagnostics : faire un diagnostic produit personnalise pour une cliente (skincare, parfum, silhouette...)
- calendrier : voir les evenements d'equipe (Zooms, formations, deadlines)
- scripts : bibliotheque de messages types prets a copier-coller
- banqueimages : visuels a partager pour les reseaux sociaux
- sprint : defis de vente sur une periode courte
- suivi : suivi onboarding des nouvelles recrues
- espacechef : (reserve cheffes d'equipe) statistiques equipe, gestion des acces, challenges, suivi assiduite
- formation : centre de formation (demarrage, vente, recrutement, contenu, developpement perso, outils)
- Pour changer son mot de passe : bouton 🔐 en haut a droite de l'ecran d'accueil
- Pour ajouter/suivre des clientes ou prospects : onglets Clients et Prospects (menu principal)

CATALOGUE PRODUITS MIHI AVEC PRIX RÉELS (utilise ces produits en priorité. Si le catalogue ne couvre pas le besoin, utilise tes connaissances sur les produits Mihi et indique que le prix est à vérifier) :
${catalogueText||"Catalogue non chargé."}

HISTORIQUE DE LA CONVERSATION :
${historique}

INSTRUCTIONS :
- Si la distributrice te pose une question PRODUIT (pour conseiller une cliente) : génère une réponse en JSON avec 3 packs et prix exacts du catalogue (format ci-dessous)
- Si la question est BUSINESS (stratégie, recrutement, vente, organisation) : réponds en JSON avec type "texte", contenu utile et concret basé sur les formations ci-dessus
- Si la question est MOOD/personnelle (fatigue, doute, motivation) : réponds en JSON avec type "texte", chaleureux et empathique, sans psychanalyser
- Si la question porte sur COMMENT UTILISER L'APPLICATION (naviguer, trouver une fonctionnalite, comprendre un outil) : reponds en JSON avec type "app", en te basant sur AIDE UTILISATION DE L'APPLICATION ci-dessus. Inclus le champ "onglet" avec l'identifiant exact de l'outil concerne (ex: "linkbio", "dreamboard") si un seul outil est clairement concerne, sinon omets ce champ
- Réponds TOUJOURS en français, ton "cash mais élégant" (direct, bienveillant, jamais mièvre)
- Réponds UNIQUEMENT avec le JSON, sans markdown ni commentaire

FORMAT JSON SI PRODUITS (type="produits") :
{"type":"produits","analyse":"2-3 phrases analysant le besoin","packs":[{"nom":"Pack Essentiel","emoji":"💚","produits":[{"nom":"Nom exact du catalogue","prix":XX,"role":"pourquoi ce produit"}],"total":XX},{"nom":"Pack Recommandé","emoji":"⭐","produits":[...],"total":XX},{"nom":"Pack Premium","emoji":"👑","produits":[...],"total":XX}],"conseil":"conseil final"}

FORMAT JSON SI TEXTE (type="texte", business ou mood) :
{"type":"texte","reponse":"ta réponse complète et utile"};

FORMAT JSON SI AIDE APPLICATION (type="app") :
{"type":"app","reponse":"explication claire et concrete des etapes a suivre","onglet":"identifiant_onglet_ou_omis"}`;

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
          if(m.type==="app"){
            return(
              <div key={i} style={{display:"flex",marginBottom:".6rem"}}>
                <div style={{background:C.creme,color:C.texte,borderRadius:"12px 12px 12px 2px",padding:".5rem .75rem",fontSize:".78rem",maxWidth:"85%",lineHeight:1.6}}>
                  <div style={{whiteSpace:"pre-wrap",marginBottom:m.onglet?".5rem":0}}>{m.reponse}</div>
                  {m.onglet&&(
                    <button onClick={()=>goToTab(m.onglet)}
                      style={{background:C.brun,color:"white",border:"none",borderRadius:8,padding:".4rem .7rem",fontSize:".7rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                      Aller à cet outil →
                    </button>
                  )}
                </div>
              </div>
            );
          }
          if(m.type==="app"){
            return(
              <div key={i} style={{display:"flex",marginBottom:".6rem"}}>
                <div style={{background:C.creme,color:C.texte,borderRadius:"12px 12px 12px 2px",padding:".5rem .75rem",fontSize:".78rem",maxWidth:"85%",lineHeight:1.6}}>
                  <div style={{whiteSpace:"pre-wrap",marginBottom:m.onglet?".5rem":0}}>{m.reponse}</div>
                  {m.onglet&&(
                    <button onClick={()=>goToTab(m.onglet)}
                      style={{background:C.brun,color:"white",border:"none",borderRadius:8,padding:".4rem .7rem",fontSize:".7rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                      Aller à cet outil →
                    </button>
                  )}
                </div>
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



