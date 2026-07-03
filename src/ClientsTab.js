import { useState, useEffect } from 'react';
import { db, storage } from './firebase';
import { doc, getDoc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { C } from './constants';
import { todayLocalStr, ss, sg, sgAll } from './utils';
import { getPeriodeActuelle, Confetti, MembreStatsCard } from './App';

function FicheClienteCard({c, sel, setSel, clients, save, uid, STATUTS_CLIENT, PRECISIONS_STATUT, TYPES_PRODUITS_DUREE, getPeriodeActuelle, sgAll, ss, daysDiff}){
  const isActive = sel===c.id;
  const[showCmd,setShowCmd]=useState(false);
  const[showRappel,setShowRappel]=useState(false);
  const[editMode,setEditMode]=useState(false);
  const[cmdDetailOuverte,setCmdDetailOuverte]=useState(null);
  const[cmdForm,setCmdForm]=useState({lignes:[{nom:"",typeProduit:"shampoing"}],montant:"",date:todayLocalStr()});
  const[catalogue,setCatalogue]=useState(null);

  // Charger le catalogue Mihi une seule fois quand on ouvre le formulaire commande
  useEffect(()=>{
    if(!showCmd||catalogue)return;
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","catalogue_mihi"));
        if(snap.exists()){
          const cat=snap.data();
          // Grouper par catégorie avec label lisible
          const ORDRE=[
            {key:"face",label:"✨ Visage"},
            {key:"corps",label:"🧴 Corps"},
            {key:"hair",label:"💇 Cheveux"},
            {key:"makeup",label:"💄 Makeup"},
            {key:"parfums",label:"🌸 Parfums"},
            {key:"health",label:"💊 Santé"},
            {key:"hommes",label:"👨 Hommes"},
            {key:"enfants",label:"👶 Enfants"},
            {key:"home",label:"🏠 Home"},
            {key:"sets",label:"🎁 Sets"},
          ];
          const tousLesProduits=[];
          ORDRE.forEach(({key,label})=>{
            (cat[key]||[]).forEach(p=>{
              if(p.nom) tousLesProduits.push({...p,categorie:label});
            });
          });
          // Tri alphabétique dans chaque catégorie (l'ordre par catégorie est conservé)
          setCatalogue(tousLesProduits);
          console.log(`Catalogue chargé: ${tousLesProduits.length} produits`);
        } else {
          setCatalogue([]);
          console.warn("Catalogue Mihi vide en Firebase — importez-le depuis Admin");
        }
      }catch(e){
        setCatalogue([]);
        console.error("Erreur chargement catalogue:", e);
      }
    })();
  },[showCmd]);

  // Devine le type de produit (durée d'utilisation) selon des mots-clés du nom
  const deviinerType=(nomProduit)=>{
    const n=(nomProduit||"").toLowerCase();
    if(n.includes("shampoo")||n.includes("shampoing"))return"shampoing";
    if(n.includes("hair")||n.includes("cheveux")||n.includes("mask")&&n.includes("hair"))return"soin-cheveux";
    if(n.includes("shower")||n.includes("douche")||n.includes("gel"))return"gel-douche";
    if(n.includes("face cream")||n.includes("crème visage")||n.includes("day cream")||n.includes("night cream"))return"creme-visage";
    if(n.includes("serum")||n.includes("sérum"))return"serum";
    if(n.includes("eye")||n.includes("yeux"))return"contour-yeux";
    if(n.includes("body")||n.includes("corps")||n.includes("lotion"))return"baume-corps";
    if(n.includes("deo")||n.includes("déodorant"))return"deodorant";
    if(n.includes("perfume")||n.includes("parfum")||n.includes("eau de"))return"parfum";
    if(n.includes("capsule")||n.includes("complement")||n.includes("complément")||n.includes("vitamin"))return"complement";
    if(n.includes("makeup")||n.includes("lipstick")||n.includes("mascara")||n.includes("foundation"))return"maquillage";
    return"autre";
  };

  const lastCmdDate=(cl)=>{
    if(!cl.commandes||cl.commandes.length===0)return null;
    return cl.commandes.reduce((best,cmd)=>new Date(cmd.date)>new Date(best.date)?cmd:best).date;
  };
  const lastD=lastCmdDate(c);
  const overdue=lastD&&daysDiff(lastD)>=60;
  const s=c.statut?STATUTS_CLIENT.find(x=>x.id===c.statut):null;

  const updateStatut=(statut)=>save(clients.map(cl=>cl.id===c.id?{...cl,statut}:cl));
  const updateNotes=(v)=>save(clients.map(cl=>cl.id===c.id?{...cl,notes:v}:cl));
  const updatePrecisions=(pid,checked)=>{const cur=c.precisions||[];const next=checked?[...cur.filter(x=>x!==pid),pid]:cur.filter(x=>x!==pid);save(clients.map(cl=>cl.id===c.id?{...cl,precisions:next}:cl));};
  const delClient=()=>{if(!window.confirm("Supprimer cette cliente ?"))return;save(clients.filter(cl=>cl.id!==c.id));setSel(null);};

  const updateLigne=(idx,field,val)=>setCmdForm(p=>({...p,lignes:p.lignes.map((l,i)=>i===idx?{...l,[field]:val}:l)}));
  const addLigne=()=>setCmdForm(p=>({...p,lignes:[...p.lignes,{nom:"",typeProduit:"shampoing"}]}));
  const removeLigne=(idx)=>setCmdForm(p=>({...p,lignes:p.lignes.filter((_,i)=>i!==idx)}));

  const addCmd=()=>{
    const lignesValides=cmdForm.lignes.filter(l=>(l.nom==="__autre__"?l.nomLibre:l.nom)?.trim());
    if(!lignesValides.length)return;
    const lignes=lignesValides.map(l=>{
      const t=TYPES_PRODUITS_DUREE.find(t=>t.id===l.typeProduit)||TYPES_PRODUITS_DUREE[5];
      const nomFinal=l.nom==="__autre__"?l.nomLibre.trim():l.nom;
      const produitCatalogue=catalogue?.find(p=>p.nom===l.nom);
      return{nom:nomFinal,typeProduit:l.typeProduit,typeLabel:t.label,dureeJours:t.jours,prix:produitCatalogue?.prix||null};
    });
    // Si le montant est vide, calculer automatiquement la somme des prix du catalogue
    const montantFinal=cmdForm.montant||(lignes.some(l=>l.prix)?lignes.reduce((s,l)=>s+(parseFloat(l.prix)||0),0):"");
    const cmd={id:Date.now(),date:cmdForm.date,lignes,produits:lignes.map(l=>l.nom).join(", "),montant:montantFinal,suivi8:false,suivi21:false};
    save(clients.map(cl=>cl.id===c.id?{...cl,commandes:[...(cl.commandes||[]),cmd]}:cl));
    if(getPeriodeActuelle&&sgAll&&ss){
      const periodeKey=`p${getPeriodeActuelle()}`;
      sgAll(uid).then(data=>{
        try{
          const cp=data["db-cmd-periode"]?JSON.parse(data["db-cmd-periode"]):{};
          const cur=cp[periodeKey]||{count:0,montant:0};
          cp[periodeKey]={count:cur.count+1,montant:cur.montant+(parseFloat(montantFinal)||0)};
          ss(uid,"db-cmd-periode",JSON.stringify(cp));
        }catch{}
      });
    }
    setCmdForm({lignes:[{nom:"",typeProduit:"shampoing"}],montant:"",date:todayLocalStr()});
    setShowCmd(false);
  };

  const addRappel=(texte,date)=>{
    const r={id:Date.now(),texte,date,fait:false};
    save(clients.map(cl=>cl.id===c.id?{...cl,rappels:[...(cl.rappels||[]),r]}:cl));
  };
  const delRappel=(rid)=>save(clients.map(cl=>cl.id===c.id?{...cl,rappels:(cl.rappels||[]).filter(r=>r.id!==rid)}:cl));

  return(
    <div id={"client-"+c.id}>
      {/* Ligne cliente */}
      <div style={{display:"flex",alignItems:"center",gap:".6rem",background:isActive?C.brun+"08":C.creme,border:`1.5px solid ${overdue?"#E6A817":isActive?C.rose:C.pale}`,borderRadius:isActive?"10px 10px 0 0":10,padding:".5rem .75rem",cursor:"pointer"}}
        onClick={()=>setSel(isActive?null:c.id)}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:".35rem"}}>
            <div style={{fontSize:".8rem",fontWeight:600,color:isActive?C.rose:C.brun}}>{c.prenom} {c.nom}</div>
            {s&&<span style={{fontSize:".55rem",fontWeight:700,color:s.color,background:s.bg,borderRadius:10,padding:".05rem .3rem",border:`1px solid ${s.color}30`}}>{s.icon} {s.label}</span>}
          </div>
          <div style={{fontSize:".6rem",color:C.gris}}>
            {lastD?`Dernière cmd : ${new Date(lastD).toLocaleDateString("fr-FR")}`:c.commandes?.length===0?"Aucune commande":""}
            {overdue?" ⚠️ À relancer":""}
          </div>
        </div>
        <button onClick={e=>{e.stopPropagation();setSel(c.id);setEditMode(true);}}
          style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:6,padding:".2rem .45rem",fontSize:".62rem",color:C.gris,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
          ✏️
        </button>
        <div style={{fontSize:".75rem",color:isActive?C.rose:C.pale,flexShrink:0,transform:isActive?"rotate(90deg)":"none",transition:"transform .2s"}}>›</div>
      </div>

      {/* Fiche dépliée */}
      {isActive&&(
        <div style={{border:`1.5px solid ${C.rose}`,borderTop:"none",borderRadius:"0 0 10px 10px",overflow:"hidden"}}>
          {/* Header */}
          <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,padding:".75rem 1rem",display:"flex",gap:".65rem",alignItems:"flex-start"}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:C.rose,color:"white",fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {((c.prenom&&c.prenom[0])||(c.nom&&c.nom[0])||"?").toUpperCase()}
            </div>
            <div style={{flex:1}}>
              <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:C.blanc}}>{c.prenom} {c.nom}{c.statut==="vip"?" ⭐":""}</div>
              {c.tel&&<div style={{fontSize:".62rem",color:C.pale}}>📞 {c.tel}</div>}
              {c.email&&<div style={{fontSize:".62rem",color:C.pale}}>✉️ {c.email}</div>}
              {c.adresse&&<div style={{fontSize:".62rem",color:C.pale}}>📍 {c.adresse}</div>}
              {c.ddn&&<div style={{fontSize:".6rem",color:C.or}}>🎂 {new Date(c.ddn).toLocaleDateString("fr-FR")}</div>}
              {PRECISIONS_STATUT&&(c.precisions||[]).length>0&&(
                <div style={{display:"flex",flexWrap:"wrap",gap:".2rem",marginTop:".3rem"}}>
                  {(c.precisions||[]).slice(0,2).map(pid=>{
                    const label=Object.values(PRECISIONS_STATUT).flat().find(p=>p.id===pid)?.label;
                    return label?<div key={pid} style={{fontSize:".5rem",background:"rgba(255,255,255,.15)",color:"white",borderRadius:10,padding:".1rem .35rem"}}>{label}</div>:null;
                  })}
                  {(c.precisions||[]).length>2&&<div style={{fontSize:".5rem",color:"rgba(255,255,255,.6)"}}>+{(c.precisions||[]).length-2}</div>}
                </div>
              )}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:".25rem",alignItems:"flex-end"}}>
              <select value={c.statut||""} onChange={e=>updateStatut(e.target.value)}
                style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.3)",borderRadius:7,padding:".22rem .4rem",fontSize:".58rem",fontFamily:"inherit",color:C.blanc,cursor:"pointer",outline:"none"}}>
                <option value="">Statut...</option>
                {STATUTS_CLIENT.map(st=><option key={st.id} value={st.id}>{st.icon} {st.label}</option>)}
              </select>
              <button onClick={delClient} style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:5,padding:".18rem .4rem",color:C.pale,cursor:"pointer",fontSize:".58rem",fontFamily:"inherit"}}>✕ Supprimer</button>
            </div>
          </div>

          {/* Formulaire édition */}
          {editMode&&<EditClientForm client={c} onSave={(f)=>{save(clients.map(cl=>cl.id===c.id?{...cl,...f}:cl));setEditMode(false);}} onCancel={()=>setEditMode(false)}/>}

          <div style={{padding:".85rem 1rem"}}>
            {/* Commandes */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".5rem"}}>
              <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose}}>📦 Commandes ({c.commandes?.length||0})</div>
              <button onClick={()=>setShowCmd(p=>!p)} style={{background:C.brun,color:C.blanc,border:"none",borderRadius:6,padding:".2rem .55rem",fontSize:".63rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>+ Commande</button>
            </div>
            {showCmd&&(
              <div style={{background:C.creme,borderRadius:9,padding:".65rem",marginBottom:".65rem",border:`1px solid ${C.pale}`}}>
                {!catalogue&&<div style={{fontSize:".68rem",color:C.gris,marginBottom:".4rem"}}>Chargement du catalogue...</div>}
                {cmdForm.lignes.map((ligne,idx)=>(
                  <div key={idx} style={{marginBottom:".5rem",background:C.blanc,borderRadius:8,padding:".5rem",border:`1px solid ${C.pale}`}}>
                    <div style={{display:"flex",gap:".3rem",marginBottom:".3rem",alignItems:"center"}}>
                      <div style={{flex:1,position:"relative"}}>
                        <input
                          value={ligne.recherche!==undefined?ligne.recherche:(ligne.nom==="__autre__"?"":ligne.nom)}
                          onChange={e=>{
                            updateLigne(idx,"recherche",e.target.value);
                            updateLigne(idx,"rechercheOuverte",true);
                            updateLigne(idx,"nom","");
                          }}
                          onFocus={()=>updateLigne(idx,"rechercheOuverte",true)}
                          placeholder="🔍 Rechercher un produit Mihi..."
                          style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:7,padding:".35rem .4rem",fontSize:".74rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none"}}/>
                        {ligne.rechercheOuverte&&(
                          <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:20,background:"white",border:`1px solid ${C.pale}`,borderRadius:8,marginTop:".2rem",maxHeight:200,overflowY:"auto",boxShadow:"0 4px 12px rgba(0,0,0,.1)"}}>
                        {!catalogue&&<div style={{padding:".5rem",fontSize:".68rem",color:C.gris}}>Chargement du catalogue...</div>}
                            {catalogue&&catalogue.length===0&&<div style={{padding:".5rem .65rem",fontSize:".68rem",color:"#B04040"}}>⚠️ Catalogue vide — importez-le depuis Admin → 📦 Import Catalogue</div>}
                            {catalogue&&catalogue.length>0&&(()=>{
                              const recherche=(ligne.recherche||"").toLowerCase().trim();
                              const filtres=recherche
                                ?catalogue.filter(p=>p.nom.toLowerCase().includes(recherche)||p.categorie.toLowerCase().includes(recherche))
                                :catalogue;
                              if(filtres.length===0) return <div style={{padding:".5rem .65rem",fontSize:".68rem",color:C.gris}}>Aucun produit trouvé</div>;
                              // Grouper par catégorie
                              const grouped={};
                              filtres.forEach(p=>{
                                const cat=p.categorie||"Autre";
                                if(!grouped[cat]) grouped[cat]=[];
                                grouped[cat].push(p);
                              });
                              return Object.entries(grouped).map(([cat,prods])=>(
                                <div key={cat}>
                                  <div style={{padding:".25rem .6rem",fontSize:".58rem",fontWeight:700,color:C.gris,background:C.creme,letterSpacing:".06em"}}>{cat} ({prods.length})</div>
                                  {prods.slice(0,recherche?50:10).map((p,pi)=>(
                                    <div key={pi} onClick={()=>{
                                        const typeAuto=deviinerType(p.nom);
                                        updateLigne(idx,"nom",p.nom);
                                        updateLigne(idx,"recherche",p.nom);
                                        updateLigne(idx,"typeProduit",typeAuto);
                                        updateLigne(idx,"rechercheOuverte",false);
                                      }}
                                      style={{padding:".38rem .6rem",fontSize:".72rem",color:C.texte,cursor:"pointer",borderBottom:`1px solid ${C.pale}20`,display:"flex",justifyContent:"space-between"}}
                                      onMouseDown={e=>e.preventDefault()}>
                                      <span>{p.nom}</span>
                                      <span style={{color:C.brun,fontWeight:600,flexShrink:0,marginLeft:".5rem"}}>{p.prix}€</span>
                                    </div>
                                  ))}
                                  {!recherche&&prods.length>10&&<div style={{padding:".2rem .6rem",fontSize:".6rem",color:C.gris,fontStyle:"italic"}}>+ {prods.length-10} autres — tape pour filtrer</div>}
                                </div>
                              ));
                            })()}
                            <div onClick={()=>{
                                updateLigne(idx,"nom","__autre__");
                                updateLigne(idx,"rechercheOuverte",false);
                              }}
                              style={{padding:".4rem .6rem",fontSize:".7rem",color:C.gris,cursor:"pointer",fontStyle:"italic"}}
                              onMouseDown={e=>e.preventDefault()}>
                              ✏️ Autre (saisie libre)
                            </div>
                          </div>
                        )}
                      </div>
                      {cmdForm.lignes.length>1&&<button onClick={()=>removeLigne(idx)} style={{background:"none",border:"none",color:C.gris,cursor:"pointer",fontSize:".75rem",flexShrink:0}}>✕</button>}
                    </div>
                    {ligne.nom&&ligne.nom!=="__autre__"&&!ligne.rechercheOuverte&&(
                      <div style={{fontSize:".62rem",color:C.vert,marginBottom:".3rem"}}>✓ {ligne.nom}</div>
                    )}
                    {ligne.nom==="__autre__"&&(
                      <input placeholder="Nom du produit" value={ligne.nomLibre||""} onChange={e=>updateLigne(idx,"nomLibre",e.target.value)}
                        style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:7,padding:".32rem .5rem",fontSize:".73rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".3rem"}}/>
                    )}
                    <div style={{display:"flex",alignItems:"center",gap:".4rem"}}>
                      <span style={{fontSize:".62rem",color:C.gris,flexShrink:0}}>⏱️ Durée d'utilisation :</span>
                      <select value={ligne.typeProduit} onChange={e=>updateLigne(idx,"typeProduit",e.target.value)}
                        style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:6,padding:".25rem .35rem",fontSize:".66rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none"}}>
                        {TYPES_PRODUITS_DUREE.map(t=><option key={t.id} value={t.id}>{t.label} — {t.jours}j</option>)}
                      </select>
                    </div>
                  </div>
                ))}
                <button onClick={addLigne} style={{background:"none",border:`1px dashed ${C.pale}`,borderRadius:7,padding:".28rem .55rem",fontSize:".66rem",color:C.gris,fontFamily:"inherit",cursor:"pointer",marginBottom:".4rem"}}>+ Produit</button>
                {(()=>{
                  const totalCatalogue=cmdForm.lignes.reduce((s,l)=>{
                    const p=catalogue?.find(x=>x.nom===l.nom);
                    return s+(p?parseFloat(p.prix)||0:0);
                  },0);
                  return totalCatalogue>0&&!cmdForm.montant&&(
                    <div style={{fontSize:".64rem",color:C.vert,marginBottom:".4rem"}}>💡 Total catalogue détecté : {totalCatalogue}€ (sera utilisé si tu laisses le montant vide)</div>
                  );
                })()}
                <div style={{display:"flex",gap:".4rem"}}>
                  <input placeholder="Montant (€) — auto si vide" value={cmdForm.montant} onChange={e=>setCmdForm(p=>({...p,montant:e.target.value}))}
                    style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:7,padding:".38rem .55rem",fontSize:".75rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none"}}/>
                  <input type="date" value={cmdForm.date} onChange={e=>setCmdForm(p=>({...p,date:e.target.value}))}
                    style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:7,padding:".38rem .55rem",fontSize:".75rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none"}}/>
                </div>
                <div style={{display:"flex",gap:".4rem",marginTop:".4rem"}}>
                  <button onClick={addCmd} style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:7,padding:".42rem",fontSize:".73rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>Enregistrer</button>
                  <button onClick={()=>setShowCmd(false)} style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:7,padding:".42rem",fontSize:".73rem",fontFamily:"inherit",cursor:"pointer"}}>Annuler</button>
                </div>
              </div>
            )}
            {c.commandes&&c.commandes.length>0?[...c.commandes].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(cmd=>{
              const dd=daysDiff(cmd.date);
              const typeInfo=cmd.lignes?.[0]?TYPES_PRODUITS_DUREE.find(t=>t.id===cmd.lignes[0].typeProduit):null;
              const dureeRappel=typeInfo?.jours||cmd.lignes?.[0]?.dureeJours||30;
              const dateRappel=new Date(new Date(cmd.date).getTime()+dureeRappel*24*60*60*1000);
              const joursAvantRappel=Math.ceil((dateRappel-new Date())/(1000*60*60*24));
              const cmdOuverte=cmdDetailOuverte===cmd.id;
              return(
                <div key={cmd.id} style={{background:!cmd.rappelFait&&((dd>=8&&!cmd.suivi8)||(dd>=21&&!cmd.suivi21))?"#FFF8E1":C.creme,border:`1px solid ${!cmd.rappelFait&&((dd>=8&&!cmd.suivi8)||(dd>=21&&!cmd.suivi21))?"#E6A817":C.pale}`,borderRadius:9,padding:".55rem .8rem",marginBottom:".4rem",cursor:"pointer"}}
                  onClick={()=>setCmdDetailOuverte(cmdOuverte?null:cmd.id)}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:".2rem"}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:".74rem",fontWeight:600,color:C.brun}}>{cmd.produits||cmd.lignes?.map(l=>l.nom).join(", ")||"Produit"}</div>
                      <div style={{fontSize:".6rem",color:C.gris}}>{new Date(cmd.date).toLocaleDateString("fr-FR")} · il y a {dd}j</div>
                      {cmd.lignes?.[0]?.typeLabel&&(
                        <div style={{fontSize:".58rem",color:C.lilas,fontWeight:600,marginTop:".1rem"}}>🏷️ {cmd.lignes.map(l=>l.typeLabel).join(", ")}</div>
                      )}
                      <div style={{fontSize:".58rem",color:cmd.rappelFait?C.vert:joursAvantRappel<=0?"#C44B1A":C.gris,marginTop:".1rem",fontWeight:cmd.rappelFait||joursAvantRappel<=0?700:400}}>
                        {cmd.rappelFait?"✅ Rappel effectué":joursAvantRappel<=0?`⏰ Rappel dépassé (prévu le ${dateRappel.toLocaleDateString("fr-FR")})`:`🔔 Prochain rappel dans ${joursAvantRappel}j (${dateRappel.toLocaleDateString("fr-FR")})`}
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"flex-start",gap:".4rem",flexShrink:0}}>
                      {cmd.montant&&<div style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:C.brun}}>{cmd.montant}€</div>}
                      <span style={{fontSize:".7rem",color:C.gris,transform:cmdOuverte?"rotate(90deg)":"none",transition:"transform .2s"}}>›</span>
                    </div>
                  </div>

                  {/* Détail complet dépliable */}
                  {cmdOuverte&&(
                    <div style={{marginTop:".5rem",paddingTop:".5rem",borderTop:`1px solid ${C.pale}`}} onClick={e=>e.stopPropagation()}>
                      <div style={{fontSize:".62rem",fontWeight:700,color:C.brun,marginBottom:".35rem",textTransform:"uppercase",letterSpacing:".06em"}}>📋 Détail de la commande</div>
                      {cmd.lignes&&cmd.lignes.length>0?cmd.lignes.map((l,i)=>(
                        <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:".7rem",color:C.texte,padding:".25rem 0",borderBottom:i<cmd.lignes.length-1?`1px solid ${C.pale}30`:"none"}}>
                          <span>{l.nom}</span>
                          <span style={{color:C.lilas,fontSize:".62rem"}}>{l.typeLabel}</span>
                        </div>
                      )):<div style={{fontSize:".7rem",color:C.gris}}>{cmd.produits}</div>}
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:".68rem",color:C.gris,marginTop:".4rem"}}>
                        <span>Date de commande</span><span style={{fontWeight:600,color:C.brun}}>{new Date(cmd.date).toLocaleDateString("fr-FR")}</span>
                      </div>
                      {cmd.montant&&(
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:".68rem",color:C.gris,marginTop:".2rem"}}>
                          <span>Montant</span><span style={{fontWeight:700,color:C.brun}}>{cmd.montant}€</span>
                        </div>
                      )}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:".68rem",color:C.gris,marginTop:".2rem",marginBottom:".5rem"}}>
                        <span>Date de rappel prévue</span><span style={{fontWeight:600,color:joursAvantRappel<=0?"#C44B1A":C.brun}}>{dateRappel.toLocaleDateString("fr-FR")}</span>
                      </div>

                      {/* Case à cocher rappel fait */}
                      <div onClick={()=>save(clients.map(cl=>cl.id===c.id?{...cl,commandes:cl.commandes.map(cm=>cm.id===cmd.id?{...cm,rappelFait:!cm.rappelFait}:cm)}:cl))}
                        style={{display:"flex",alignItems:"center",gap:".5rem",background:cmd.rappelFait?"#E8F5E9":C.creme,border:`1.5px solid ${cmd.rappelFait?C.vert:C.pale}`,borderRadius:8,padding:".45rem .6rem",cursor:"pointer",marginBottom:".4rem"}}>
                        <div style={{width:18,height:18,borderRadius:5,border:`2px solid ${cmd.rappelFait?C.vert:C.pale}`,background:cmd.rappelFait?C.vert:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          {cmd.rappelFait&&<span style={{color:"white",fontSize:".6rem",fontWeight:700}}>✓</span>}
                        </div>
                        <span style={{fontSize:".7rem",fontWeight:600,color:cmd.rappelFait?C.vert:C.brun}}>
                          {cmd.rappelFait?"✓ Rappel effectué":"Marquer le rappel comme fait"}
                        </span>
                      </div>

                      <button onClick={()=>{if(window.confirm("Supprimer cette commande ?"))save(clients.map(cl=>cl.id===c.id?{...cl,commandes:cl.commandes.filter(cm=>cm.id!==cmd.id)}:cl));}}
                        style={{background:"none",border:"1px solid #E0C0C0",borderRadius:6,padding:".25rem .5rem",fontSize:".62rem",color:"#B04040",cursor:"pointer",fontFamily:"inherit"}}>
                        ✕ Supprimer cette commande
                      </button>
                    </div>
                  )}

                  {/* Boutons suivi — toujours visibles, désactivés avant échéance */}
                  <div style={{display:"flex",gap:".3rem",marginTop:".4rem"}} onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>dd>=8&&save(clients.map(cl=>cl.id===c.id?{...cl,commandes:cl.commandes.map(cm=>cm.id===cmd.id?{...cm,suivi8:true}:cm)}:cl))}
                      disabled={dd<8}
                      style={{background:cmd.suivi8?"#E8F5E9":dd>=8?C.pale:"#f5f5f5",color:cmd.suivi8?C.vert:dd>=8?C.gris:"#bbb",border:"none",borderRadius:6,padding:".18rem .45rem",fontSize:".6rem",fontWeight:600,fontFamily:"inherit",cursor:dd>=8?"pointer":"default"}}>
                      {cmd.suivi8?"✓ J+8":dd>=8?"Suivi J+8":`J+8 (dans ${8-dd}j)`}
                    </button>
                    <button onClick={()=>dd>=21&&save(clients.map(cl=>cl.id===c.id?{...cl,commandes:cl.commandes.map(cm=>cm.id===cmd.id?{...cm,suivi21:true}:cm)}:cl))}
                      disabled={dd<21}
                      style={{background:cmd.suivi21?"#E8F5E9":dd>=21?C.pale:"#f5f5f5",color:cmd.suivi21?C.vert:dd>=21?C.gris:"#bbb",border:"none",borderRadius:6,padding:".18rem .45rem",fontSize:".6rem",fontWeight:600,fontFamily:"inherit",cursor:dd>=21?"pointer":"default"}}>
                      {cmd.suivi21?"✓ J+21":dd>=21?"Suivi J+21":`J+21 (dans ${21-dd}j)`}
                    </button>
                  </div>
                </div>
              );
            }):<div style={{fontSize:".7rem",color:C.gris,padding:".3rem 0"}}>Aucune commande.</div>}

            {/* Précisions statut */}
            {c.statut&&PRECISIONS_STATUT&&PRECISIONS_STATUT[c.statut]&&(
              <div style={{marginBottom:".75rem"}}>
                <div style={{fontSize:".6rem",fontWeight:700,color:"#C49A8A",letterSpacing:".1em",textTransform:"uppercase",marginBottom:".4rem"}}>✅ Précisions</div>
                <div style={{display:"flex",flexDirection:"column",gap:".3rem"}}>
                  {PRECISIONS_STATUT[c.statut].map(p=>(
                    <label key={p.id} style={{display:"flex",alignItems:"center",gap:".5rem",cursor:"pointer",fontFamily:"Trebuchet MS,sans-serif",fontSize:".75rem",color:"#3D1F0E"}}>
                      <input type="checkbox" checked={(c.precisions||[]).includes(p.id)} onChange={e=>updatePrecisions(p.id,e.target.checked)} style={{accentColor:"#C49A8A",width:14,height:14}}/>
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {/* Notes — defaultValue + onBlur pour éviter re-render */}
            <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.gris,margin:".75rem 0 .35rem"}}>📝 Notes</div>
            <textarea key={`notes-${c.id}`} defaultValue={c.notes||""} onBlur={e=>updateNotes(e.target.value)}
              placeholder="Notes personnelles..." style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:9,padding:".55rem .75rem",fontSize:".74rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",resize:"vertical",minHeight:60,lineHeight:1.5}}/>

            {/* Rappels */}
            <RappelsSection clientId={c.id} rappels={c.rappels||[]} clients={clients} save={save}/>

            {/* Carte de fidélité */}
            <CarteFideliteSection client={c} clients={clients} save={save} uid={uid}/>

            {/* Recommandation */}
            <RecommandationSection client={c} uid={uid}/>
          </div>
        </div>
      )}
    </div>
  );
}

// Carte de fidélité interactive — tampons + cadeau configurable
function CarteFideliteSection({client, clients, save, uid}){
  const[showConfig,setShowConfig]=useState(false);
  const[nbTampons,setNbTampons]=useState(10);
  const[cadeau,setCadeau]=useState("Un produit offert au choix");
  const[configChargee,setConfigChargee]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"users",uid));
        if(snap.exists()&&snap.data()["db-fidelite-config"]){
          const cfg=JSON.parse(snap.data()["db-fidelite-config"]);
          setNbTampons(cfg.nbTampons||10);
          setCadeau(cfg.cadeau||"Un produit offert au choix");
        }
      }catch{}
      setConfigChargee(true);
    })();
  },[uid]);

  const sauverConfig=async(next)=>{
    try{await setDoc(doc(db,"users",uid),{"db-fidelite-config":JSON.stringify(next)},{merge:true});}catch{}
  };

  const tampons=client.fideliteTampons||0;
  const tamponsArray=Array.from({length:nbTampons},(_,i)=>i<tampons);
  const carteComplete=tampons>=nbTampons;

  const toggleTampon=(idx)=>{
    const newTampons=idx<tampons?idx:idx+1;
    save(clients.map(cl=>cl.id===client.id?{...cl,fideliteTampons:Math.min(newTampons,nbTampons)}:cl));
  };

  const reinitialiser=()=>{
    if(!window.confirm("Réinitialiser la carte de fidélité de cette cliente (cadeau remis) ?"))return;
    save(clients.map(cl=>cl.id===client.id?{...cl,fideliteTampons:0,fideliteHistorique:[...(cl.fideliteHistorique||[]),{date:new Date().toISOString(),cadeau}]}:cl));
  };

  const envoyerCarte=()=>{
    const texte=`🎁 Voici ta carte de fidélité !\n\n${"⭐".repeat(tampons)}${"☆".repeat(nbTampons-tampons)}\n\n${tampons}/${nbTampons} tampons collectés\n\n${carteComplete?`🎉 Félicitations ! Tu as débloqué : ${cadeau}`:`Plus que ${nbTampons-tampons} achat${nbTampons-tampons>1?"s":""} pour débloquer : ${cadeau}`}`;
    navigator.clipboard?.writeText(texte);
    alert("✅ Carte copiée ! Colle-la dans ta conversation avec la cliente.");
  };

  if(!configChargee)return null;

  return(
    <div style={{marginTop:".85rem",paddingTop:".75rem",borderTop:`1px solid ${C.pale}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".5rem"}}>
        <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.or}}>🎁 Carte de fidélité</div>
        <button onClick={()=>setShowConfig(p=>!p)} style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:6,padding:".18rem .45rem",fontSize:".6rem",color:C.gris,fontFamily:"inherit",cursor:"pointer"}}>
          ⚙️ Configurer
        </button>
      </div>

      {showConfig&&(
        <div style={{background:C.creme,borderRadius:9,padding:".65rem",marginBottom:".6rem",border:`1px solid ${C.pale}`}}>
          <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600}}>Nombre de tampons pour débloquer le cadeau</div>
          <input type="number" min="3" max="30" value={nbTampons} onChange={e=>{const v=parseInt(e.target.value)||10;setNbTampons(v);sauverConfig({nbTampons:v,cadeau});}}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:7,padding:".35rem .55rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:"white",outline:"none",marginBottom:".4rem"}}/>
          <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600}}>Cadeau offert</div>
          <input value={cadeau} onChange={e=>setCadeau(e.target.value)} onBlur={()=>sauverConfig({nbTampons,cadeau})}
            placeholder="Ex: Un parfum offert, -20% sur la prochaine commande..."
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:7,padding:".35rem .55rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:"white",outline:"none"}}/>
          <div style={{fontSize:".58rem",color:C.gris,marginTop:".3rem",fontStyle:"italic"}}>💡 Cette config s'applique à toutes tes clientes</div>
        </div>
      )}

      {/* Carte visuelle */}
      <div style={{background:carteComplete?`linear-gradient(135deg,${C.or},#E6C158)`:C.creme,borderRadius:12,padding:".75rem",border:`1.5px solid ${carteComplete?C.or:C.pale}`}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:".35rem",justifyContent:"center",marginBottom:".5rem"}}>
          {tamponsArray.map((rempli,i)=>(
            <div key={i} onClick={()=>toggleTampon(i)}
              style={{width:28,height:28,borderRadius:"50%",background:rempli?C.or:carteComplete?"rgba(255,255,255,.3)":"white",border:`2px solid ${rempli?C.or:C.pale}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:".85rem",cursor:"pointer",transition:"all .15s"}}>
              {rempli?"⭐":""}
            </div>
          ))}
        </div>
        <div style={{textAlign:"center",fontSize:".72rem",fontWeight:600,color:carteComplete?"white":C.brun,marginBottom:".3rem"}}>
          {tampons}/{nbTampons} tampons
        </div>
        <div style={{textAlign:"center",fontSize:".68rem",color:carteComplete?"white":C.gris,fontWeight:carteComplete?700:400}}>
          {carteComplete?`🎉 Cadeau débloqué : ${cadeau}`:`🎁 Récompense : ${cadeau}`}
        </div>
      </div>

      <div style={{display:"flex",gap:".4rem",marginTop:".5rem"}}>
        <button onClick={envoyerCarte}
          style={{flex:1,background:C.brun,color:"white",border:"none",borderRadius:8,padding:".42rem",fontSize:".72rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          📤 Envoyer la carte
        </button>
        {carteComplete&&(
          <button onClick={reinitialiser}
            style={{flex:1,background:C.vert,color:"white",border:"none",borderRadius:8,padding:".42rem",fontSize:".72rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
            ✓ Cadeau remis — Reset
          </button>
        )}
      </div>
    </div>
  );
}

// Système de recommandation — lien à envoyer, cadeau configurable, prospects auto
function RecommandationSection({client, uid}){
  const[showConfig,setShowConfig]=useState(false);
  const[cadeauRecommandation,setCadeauRecommandation]=useState("Un produit offert dès la 1ère recommandation");
  const[configChargee,setConfigChargee]=useState(false);
  const[copied,setCopied]=useState(false);

  const slug=uid;
  const lienRecommandation=`https://blazing-dinasty-1fad9.web.app/recommande/${slug}?cliente=${encodeURIComponent(client.nom||client.prenom||"")}`;

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"users",uid));
        if(snap.exists()&&snap.data()["db-recommandation-config"]){
          const cfg=JSON.parse(snap.data()["db-recommandation-config"]);
          setCadeauRecommandation(cfg.cadeau||"Un produit offert dès la 1ère recommandation");
        }
      }catch{}
      setConfigChargee(true);
    })();
  },[uid]);

  const sauverConfig=async(cadeau)=>{
    try{await setDoc(doc(db,"users",uid),{"db-recommandation-config":JSON.stringify({cadeau})},{merge:true});}catch{}
  };

  const copierLien=()=>{
    const texte=`🌸 Tu aimes mes produits ? Recommande-moi à 3 à 5 amies et reçois : ${cadeauRecommandation} !\n\n👉 ${lienRecommandation}`;
    navigator.clipboard?.writeText(texte);
    setCopied(true);
    setTimeout(()=>setCopied(false),2500);
  };

  if(!configChargee)return null;

  return(
    <div style={{marginTop:".85rem",paddingTop:".75rem",borderTop:`1px solid ${C.pale}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".5rem"}}>
        <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.lilas}}>🤝 Recommandation</div>
        <button onClick={()=>setShowConfig(p=>!p)} style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:6,padding:".18rem .45rem",fontSize:".6rem",color:C.gris,fontFamily:"inherit",cursor:"pointer"}}>
          ⚙️ Configurer
        </button>
      </div>

      {showConfig&&(
        <div style={{background:C.creme,borderRadius:9,padding:".65rem",marginBottom:".6rem",border:`1px solid ${C.pale}`}}>
          <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600}}>Cadeau offert (dès 3 personnes recommandées, jusqu'à 5)</div>
          <input value={cadeauRecommandation} onChange={e=>setCadeauRecommandation(e.target.value)} onBlur={()=>sauverConfig(cadeauRecommandation)}
            placeholder="Ex: -15% sur ta prochaine commande, un échantillon offert..."
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:7,padding:".35rem .55rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:"white",outline:"none"}}/>
          <div style={{fontSize:".58rem",color:C.gris,marginTop:".3rem",fontStyle:"italic"}}>💡 S'applique à toutes tes clientes</div>
        </div>
      )}

      <div style={{background:C.creme,borderRadius:10,padding:".65rem .75rem",border:`1px solid ${C.pale}`}}>
        <div style={{fontSize:".7rem",color:C.brun,lineHeight:1.6,marginBottom:".5rem"}}>
          🎁 Récompense : <strong>{cadeauRecommandation}</strong>
        </div>
        <div style={{fontSize:".62rem",color:C.gris,wordBreak:"break-all",marginBottom:".5rem"}}>{lienRecommandation}</div>
        <button onClick={copierLien}
          style={{width:"100%",background:copied?C.vert:C.lilas,color:"white",border:"none",borderRadius:8,padding:".45rem",fontSize:".74rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          {copied?"✓ Copié — colle-le dans ta conversation !":"📤 Copier le lien à envoyer"}
        </button>
      </div>
    </div>
  );
}

// Rappels en composant isolé
function RappelsSection({clientId, rappels, clients, save}){
  const[show,setShow]=useState(false);
  const[texte,setTexte]=useState("");
  const[date,setDate]=useState("");
  const[heure,setHeure]=useState("");
  const ajouter=()=>{
    if(!texte.trim()||!date)return;
    const r={id:Date.now(),texte,date,heure,fait:false};
    save(clients.map(c=>c.id===clientId?{...c,rappels:[...(c.rappels||[]),r]}:c));
    setTexte("");setDate("");setHeure("");setShow(false);
  };
  const supprimer=(rid)=>save(clients.map(c=>c.id===clientId?{...c,rappels:(c.rappels||[]).filter(r=>r.id!==rid)}:c));
  const toggle=(rid)=>save(clients.map(c=>c.id===clientId?{...c,rappels:(c.rappels||[]).map(r=>r.id===rid?{...r,fait:!r.fait}:r)}:c));
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:".75rem 0 .35rem"}}>
        <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.gris}}>🔔 Rappels</div>
        <button onClick={()=>setShow(p=>!p)} style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:6,padding:".18rem .45rem",fontSize:".63rem",color:C.gris,fontFamily:"inherit",cursor:"pointer"}}>+ Rappel</button>
      </div>
      {show&&(
        <div style={{background:C.creme,borderRadius:9,padding:".6rem",marginBottom:".4rem",border:`1px solid ${C.pale}`}}>
          <input placeholder="Note de rappel..." value={texte} onChange={e=>setTexte(e.target.value)}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:7,padding:".35rem .55rem",fontSize:".74rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".35rem"}}/>
          <div style={{display:"flex",gap:".35rem",marginBottom:".35rem"}}>
            <div style={{position:"relative",flex:1}}>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)}
                style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:7,padding:".35rem .55rem",fontSize:".74rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none"}}/>
              <span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",fontSize:".8rem"}}>📅</span>
            </div>
            <input type="time" value={heure} onChange={e=>setHeure(e.target.value)}
              style={{width:90,border:`1px solid ${C.pale}`,borderRadius:7,padding:".35rem .4rem",fontSize:".74rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none"}}/>
          </div>
          <div style={{display:"flex",gap:".35rem"}}>
            <button onClick={ajouter} style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:7,padding:".4rem",fontSize:".72rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>Ajouter</button>
            <button onClick={()=>setShow(false)} style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:7,padding:".4rem",fontSize:".72rem",fontFamily:"inherit",cursor:"pointer"}}>Annuler</button>
          </div>
        </div>
      )}
      {rappels.map(r=>(
        <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:r.fait?"#E8F5E9":C.creme,borderRadius:8,padding:".4rem .7rem",marginBottom:".3rem",border:`1px solid ${r.fait?C.vert:C.pale}`}}>
          <div>
            <div style={{fontSize:".73rem",color:C.texte,textDecoration:r.fait?"line-through":"none"}}>{r.texte}</div>
            <div style={{fontSize:".58rem",color:C.gris}}>{r.date&&new Date(r.date).toLocaleDateString("fr-FR")}{r.heure&&" a "+r.heure}</div>
          </div>
          <div style={{display:"flex",gap:".25rem"}}>
            <button onClick={()=>toggle(r.id)} style={{background:r.fait?C.vert:"none",border:`1px solid ${r.fait?C.vert:C.pale}`,borderRadius:5,padding:".15rem .38rem",fontSize:".6rem",color:r.fait?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>{r.fait?"✓":"Fait"}</button>
            <button onClick={()=>supprimer(r.id)} style={{background:"none",border:"none",color:C.pale,cursor:"pointer",fontSize:".68rem"}}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Input global — JAMAIS défini dans un composant pour éviter la perte de focus
const GInput=({type="text",value,onChange,placeholder,style={}})=>(
  <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".35rem",...style}}/>
);

function EditClientForm({client, onSave, onCancel}){
  const[f,setF]=useState({
    prenom:client.prenom||"",nom:client.nom||"",
    tel:client.tel||"",email:client.email||"",
    ddn:client.ddn||"",adresse:client.adresse||"",
    notes:client.notes||""
  });
  return(
    <div style={{background:C.creme,padding:".75rem 1rem",borderBottom:`1px solid ${C.pale}`}}>
      <div style={{fontSize:".6rem",fontWeight:700,color:C.rose,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".4rem"}}>✏️ Modifier</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".35rem"}}>
        <GInput value={f.prenom} onChange={e=>setF(p=>({...p,prenom:e.target.value}))} placeholder="Prénom"/>
        <GInput value={f.nom} onChange={e=>setF(p=>({...p,nom:e.target.value}))} placeholder="Nom"/>
      </div>
      <GInput value={f.tel} onChange={e=>setF(p=>({...p,tel:e.target.value}))} placeholder="Téléphone"/>
      <GInput value={f.email} onChange={e=>setF(p=>({...p,email:e.target.value}))} placeholder="Email"/>
      <GInput type="date" value={f.ddn} onChange={e=>setF(p=>({...p,ddn:e.target.value}))}/>
      <GInput value={f.adresse} onChange={e=>setF(p=>({...p,adresse:e.target.value}))} placeholder="Adresse"/>
      <textarea value={f.notes} onChange={e=>setF(p=>({...p,notes:e.target.value}))} placeholder="Notes"
        style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".75rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",resize:"vertical",minHeight:50,marginBottom:".4rem"}}/>
      <div style={{display:"flex",gap:".4rem"}}>
        <button onClick={()=>onSave(f)} style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".42rem",fontSize:".75rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>✓ Enregistrer</button>
        <button onClick={onCancel} style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".42rem",fontSize:".75rem",fontFamily:"inherit",cursor:"pointer"}}>Annuler</button>
      </div>
    </div>
  );
}

const ACTIONS_RELANCE=[
  {id:"a1",label:"Envoyer un message personnalisé pour prendre des nouvelles"},
  {id:"a2",label:"Partager un résultat client ou avant/après pertinent"},
  {id:"a3",label:"Proposer un nouveau produit adapté à son profil"},
  {id:"a4",label:"Offrir un conseil beauté/bien-être gratuit"},
  {id:"a5",label:"Inviter à un live, event ou dégustation"},
];

const TEXTES_RELANCE=[
  {id:"t1",label:"Relance douce",texte:`Coucou [Prénom] ! 🌸\n\nJe pensais à toi en voyant les nouveautés Mihi. Tu m'avais dit que [rappel besoin/produit]... Je me demandais si tu avais eu l'occasion de le tester ?\n\nJe suis là si tu as des questions 😊`},
  {id:"t2",label:"Partage de résultat",texte:`Bonjour [Prénom] ! ✨\n\nJe voulais partager avec toi le témoignage d'une cliente qui avait le même besoin que toi : [résultat client].\n\nÇa m'a fait penser à toi — est-ce que tu serais tentée d'essayer ? Je t'offre mes conseils personnalisés 💛`},
  {id:"t3",label:"Offre exclusive",texte:`Hello [Prénom] ! 👋\n\nJ'ai une petite surprise pour mes clientes fidèles — [offre/nouveauté]. Je pense que ça pourrait vraiment t'intéresser vu [raison personnalisée].\n\nDis-moi si tu veux qu'on en parle ! 🌿`},
];


function RelancesTab({prospects,clients,saveProspects,saveClients}){
  prospects=prospects||[];clients=clients||[];
  const [section,setSection]=useState("prospects");
  const [copied,setCopied]=useState(null);
  const today=todayLocalStr();
  const todayFr=new Date().toLocaleDateString("fr-FR");
  const prospectsTries=[...prospects].sort((a,b)=>(a.prenom||"").localeCompare(b.prenom||"","fr"));
  const aRecontacter=prospectsTries.filter(p=>p.relance&&p.relance<=today&&p.statut!=="Converti"&&p.statut!=="Archive").sort((a,b)=>a.relance<b.relance?-1:1);
  const sansContact=prospectsTries.filter(p=>!p.relance&&p.statut!=="Converti"&&p.statut!=="Archive"&&p.date).filter(p=>{try{const pts=p.date.split("/");const d=new Date(pts[2],pts[1]-1,pts[0]);return(new Date()-d)>14*24*60*60*1000;}catch{return false;}});
    const endormies=[...clients].sort((a,b)=>(a.prenom||"").localeCompare(b.prenom||"","fr")).filter(c=>{const cmds=c.commandes||[];if(!cmds.length)return false;const d=[...cmds].sort((a,b)=>new Date(b.date)-new Date(a.date))[0];return Math.floor((new Date()-new Date(d.date))/(864e5))>=60;}).map(c=>{const cmds=[...c.commandes].sort((a,b)=>new Date(b.date)-new Date(a.date));return{...c,joursSans:Math.floor((new Date()-new Date(cmds[0].date))/(864e5)),derniereCmd:cmds[0]};}).sort((a,b)=>b.joursSans-a.joursSans);
  const copy=(text,id)=>{navigator.clipboard?.writeText(text);setCopied(id);setTimeout(()=>setCopied(null),2000);};
  const msgP=(p)=>"Coucou "+(p.name&&p.name.split(" ")[0]||"")+" ! On avait echange il y a quelques jours. Tu as eu le temps de reflechir ? Je suis la si tu as des questions";
  const msgE=(c)=>"Coucou "+c.prenom+" ! Ca fait un moment qu'on ne s'est pas parlees. J'ai pense a toi avec nos nouvelles references. Tu veux qu'on fasse le point sur ta routine ?";
  const marquerFait=(p)=>saveProspects(prospects.map(x=>x.id===p.id?{...x,relance:"",journal:[...(x.journal||[]),{date:todayFr,msg:"Relance effectuee"}]}:x));
  const pasInteresse=(p)=>saveProspects(prospects.map(x=>x.id===p.id?{...x,statut:"Archive",relance:"",journal:[...(x.journal||[]),{date:todayFr,msg:"Pas interesse"}]}:x));
  const progRelance=(p,j)=>{const d=new Date();d.setDate(d.getDate()+j);const ds=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");saveProspects(prospects.map(x=>x.id===p.id?{...x,relance:ds}:x));};
  return(
    <div style={{paddingBottom:"2rem"}}>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>Relances <em style={{fontStyle:"italic",color:C.rose}}>du jour</em></div>
      <div id="decouverte-relances-stats" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:".4rem",marginBottom:"1rem"}}>
        {[[aRecontacter.length,"A recontacter",C.rose],[sansContact.length,"Sans contact 14j+",C.or],[endormies.length,"Endormies 60j+",C.lilas]].map(([val,label,col])=>(<div key={label} style={{background:C.creme,borderRadius:10,padding:".65rem .5rem",textAlign:"center",border:"1px solid "+C.pale}}><div style={{fontSize:"1.2rem",fontWeight:700,color:col}}>{val}</div><div style={{fontSize:".58rem",color:C.gris,lineHeight:1.3}}>{label}</div></div>))}
      </div>
      <div id="decouverte-relances-tabs" style={{display:"flex",gap:".3rem",marginBottom:"1rem"}}>
        {[{id:"prospects",label:"Prospects ("+(aRecontacter.length+sansContact.length)+")"},{id:"endormies",label:"Endormies ("+endormies.length+")"},{id:"inactives",label:"Inactives ("+(clients||[]).filter(c=>c.statut==="inactif").length+")"}].map(t=>(<button key={t.id} onClick={()=>setSection(t.id)} style={{flex:"none",padding:".4rem .75rem",fontSize:".7rem",fontWeight:600,borderRadius:20,border:"1.5px solid "+(section===t.id?C.rose:C.pale),background:section===t.id?C.rose:"white",color:section===t.id?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>{t.label}</button>))}
      </div>
      {section==="prospects"&&<div>
        {aRecontacter.length===0&&sansContact.length===0&&<div style={{textAlign:"center",padding:"2rem",color:C.gris}}><div style={{fontSize:"2rem"}}>✅</div><div style={{fontSize:".82rem"}}>Aucun prospect a relancer !</div></div>}
        {aRecontacter.length>0&&<div style={{marginBottom:"1rem"}}>
          <div style={{fontSize:".62rem",fontWeight:700,color:"#C44B1A",letterSpacing:".1em",textTransform:"uppercase",marginBottom:".5rem"}}>A recontacter ({aRecontacter.length})</div>
          {aRecontacter.map(p=>(<div key={p.id} style={{background:"white",border:"1.5px solid #C44B1A40",borderRadius:12,padding:".85rem 1rem",marginBottom:".5rem"}}>
            <div style={{fontSize:".85rem",fontWeight:700,color:C.brun,marginBottom:".3rem"}}>{p.name}</div>
            <div style={{background:C.creme,borderRadius:8,padding:".5rem .7rem",fontSize:".72rem",color:C.texte,lineHeight:1.6,marginBottom:".5rem",fontStyle:"italic"}}>"{msgP(p)}"</div>
            <div style={{display:"flex",gap:".3rem",flexWrap:"wrap"}}>
              <button onClick={()=>copy(msgP(p),"m"+p.id)} style={{background:copied==="m"+p.id?C.vert:C.brun,color:"white",border:"none",borderRadius:8,padding:".3rem .6rem",fontSize:".65rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>{copied==="m"+p.id?"Copie !":"Copier"}</button>
              <button onClick={()=>marquerFait(p)} style={{background:"none",border:"1px solid "+C.vert,color:C.vert,borderRadius:8,padding:".3rem .6rem",fontSize:".65rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>Fait</button>
              <button onClick={()=>progRelance(p,3)} style={{background:"none",border:"1px solid "+C.pale,color:C.gris,borderRadius:8,padding:".3rem .6rem",fontSize:".65rem",fontFamily:"inherit",cursor:"pointer"}}>+3j</button>
              <button onClick={()=>progRelance(p,7)} style={{background:"none",border:"1px solid "+C.pale,color:C.gris,borderRadius:8,padding:".3rem .6rem",fontSize:".65rem",fontFamily:"inherit",cursor:"pointer"}}>+7j</button>
            </div>
          </div>))}
        </div>}
        {sansContact.length>0&&<div>
          <div style={{fontSize:".62rem",fontWeight:700,color:C.or,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".5rem"}}>Sans contact 14j+ ({sansContact.length})</div>
          {sansContact.map(p=>(<div key={p.id} style={{background:"white",border:"1px solid "+C.pale,borderRadius:12,padding:".85rem 1rem",marginBottom:".5rem"}}>
            <div style={{fontSize:".85rem",fontWeight:700,color:C.brun,marginBottom:".3rem"}}>{p.name}</div>
            <div style={{display:"flex",gap:".3rem"}}><button onClick={()=>copy(msgP(p),"m2"+p.id)} style={{background:copied==="m2"+p.id?C.vert:C.brun,color:"white",border:"none",borderRadius:8,padding:".3rem .6rem",fontSize:".65rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>{copied==="m2"+p.id?"Copie !":"Copier message"}</button><button onClick={()=>progRelance(p,3)} style={{background:"none",border:"1px solid "+C.rose,color:C.rose,borderRadius:8,padding:".3rem .6rem",fontSize:".65rem",fontFamily:"inherit",cursor:"pointer"}}>Programmer relance</button></div>
          </div>))}
        </div>}
      </div>}
      {section==="inactives"&&<div>
        {(clients||[]).filter(c=>c.statut==="inactif").length===0&&<div style={{textAlign:"center",padding:"2rem",color:C.gris}}><div style={{fontSize:"2rem"}}>✅</div><div style={{fontSize:".82rem"}}>Aucune cliente inactive !</div></div>}
        {(clients||[]).filter(c=>c.statut==="inactif").map(c=>(<div key={c.id} style={{background:"white",border:"1.5px solid #5B8DB840",borderRadius:12,padding:".85rem 1rem",marginBottom:".5rem"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".4rem"}}><div><div style={{fontSize:".85rem",fontWeight:700,color:C.brun}}>{c.prenom} {c.nom||""}</div><div style={{fontSize:".65rem",color:C.gris}}>{c.tel||c.email||""}</div></div><div style={{fontSize:".6rem",color:"#5B8DB8",fontWeight:700}}>❄️ Inactive</div></div><div style={{display:"flex",gap:".3rem",flexWrap:"wrap"}}><button onClick={()=>saveClients(clients.map(x=>x.id===c.id?{...x,statut:"consolider"}:x))} style={{background:"none",border:"1px solid "+C.or,color:C.or,borderRadius:8,padding:".3rem .6rem",fontSize:".65rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>🔄 Reactiver</button><button onClick={()=>saveClients(clients.map(x=>x.id===c.id?{...x,pasInteressee:true}:x))} style={{background:"none",border:"1px solid #fdd",color:"#B04040",borderRadius:8,padding:".3rem .6rem",fontSize:".65rem",fontFamily:"inherit",cursor:"pointer"}}>❌ Pas interessee</button></div></div>))}
      </div>}
      {section==="endormies"&&<div>
        {endormies.length===0&&<div style={{textAlign:"center",padding:"2rem",color:C.gris}}><div style={{fontSize:"2rem"}}>🌟</div><div style={{fontSize:".82rem"}}>Toutes tes clientes sont actives !</div></div>}
        {endormies.map(c=>(<div key={c.id} style={{background:"white",border:"1.5px solid #A89BB540",borderRadius:12,padding:".85rem 1rem",marginBottom:".5rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:".4rem"}}>
            <div><div style={{fontSize:".85rem",fontWeight:700,color:C.brun}}>{c.prenom} {c.nom||""}</div><div style={{fontSize:".65rem",color:"#C62828"}}>{c.joursSans}j sans commande</div></div>
            <div style={{fontSize:".7rem",fontWeight:700,color:C.brun}}>{(c.commandes||[]).reduce((s,cmd)=>s+(parseFloat(cmd.montant)||0),0).toFixed(0)}EUR</div>
          </div>
          <div style={{background:"#FFF3F0",borderRadius:8,padding:".5rem .7rem",fontSize:".72rem",color:C.texte,lineHeight:1.6,marginBottom:".5rem",fontStyle:"italic"}}>"{msgE(c)}"</div>
          <button onClick={()=>copy(msgE(c),"e"+c.id)} style={{background:copied==="e"+c.id?C.vert:C.brun,color:"white",border:"none",borderRadius:8,padding:".3rem .6rem",fontSize:".65rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>{copied==="e"+c.id?"Copie !":"Copier"}</button>
        </div>))}
        {endormies.length>0&&<button onClick={()=>{copy(endormies.map(c=>c.prenom+": "+msgE(c)).join("\n\n"),"all");}} style={{width:"100%",background:copied==="all"?C.vert:C.lilas,color:"white",border:"none",borderRadius:8,padding:".5rem",fontSize:".75rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginTop:".5rem"}}>{copied==="all"?"Tous copies !":"Copier tous les messages"}</button>}
      </div>}
    </div>
  );
}
function ClientsRelanceTab({clients,save,uid}){
  const[openClient,setOpenClient]=useState(null);
  const[openTexte,setOpenTexte]=useState(null);
  const[copied,setCopied]=useState(null);

  const clientsCibles=(clients||[]).filter(c=>c.statut==="inactif"||c.statut==="consolider");
  const inactifs=clientsCibles.filter(c=>c.statut==="inactif");
  const consolider=clientsCibles.filter(c=>c.statut==="consolider");

  const toggleAction=(clientId,actionId)=>{
    const c=clients.find(x=>x.id===clientId);
    if(!c)return;
    const actions=c.actionsRelance||{};
    const next={...actions,[actionId]:!actions[actionId]};
    save(clients.map(x=>x.id===clientId?{...x,actionsRelance:next}:x));
  };

  const copyTexte=(texte)=>{
    navigator.clipboard?.writeText(texte);
    setCopied(texte);
    setTimeout(()=>setCopied(null),2000);
  };

  const renderSection=(titre,liste,couleur,icon)=>{
    if(liste.length===0)return null;
    return(
      <div style={{marginBottom:"1rem"}}>
        <div style={{display:"flex",alignItems:"center",gap:".5rem",marginBottom:".5rem"}}>
          <span style={{fontSize:"1rem"}}>{icon}</span>
          <div style={{fontFamily:"Georgia,serif",fontSize:".95rem",color:couleur,fontWeight:600}}>{titre}</div>
          <div style={{background:couleur+"20",color:couleur,borderRadius:20,padding:".1rem .5rem",fontSize:".65rem",fontWeight:700}}>{liste.length}</div>
        </div>
        {liste.map(c=>{
          const isOpen=openClient===c.id;
          const actions=c.actionsRelance||{};
          const done=ACTIONS_RELANCE.filter(a=>actions[a.id]).length;
          return(
            <div key={c.id} style={{background:C.blanc,border:`1.5px solid ${isOpen?couleur:C.pale}`,borderRadius:12,marginBottom:".4rem",overflow:"hidden"}}>
              <div onClick={()=>setOpenClient(isOpen?null:c.id)}
                style={{display:"flex",alignItems:"center",gap:".6rem",padding:".55rem .85rem",cursor:"pointer"}}>
                <div style={{width:34,height:34,borderRadius:"50%",background:couleur+"20",color:couleur,fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {(c.nom||"?")[0].toUpperCase()}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:".82rem",fontWeight:600,color:C.brun}}>{c.nom}</div>
                  <div style={{fontSize:".6rem",color:C.gris}}>
                    {done}/{ACTIONS_RELANCE.length} actions · {c.statut==="inactif"?"Inactive":"À consolider"}
                  </div>
                </div>
                {done===ACTIONS_RELANCE.length
                  ?<div style={{fontSize:".65rem",color:C.vert,fontWeight:700}}>✅ Complet</div>
                  :<div style={{width:36,height:6,background:C.pale,borderRadius:10,overflow:"hidden"}}>
                    <div style={{height:"100%",background:couleur,width:(done/ACTIONS_RELANCE.length*100)+"%",borderRadius:10}}/>
                  </div>
                }
                <div style={{fontSize:".75rem",color:C.gris,transform:isOpen?"rotate(90deg)":"none",transition:"transform .2s"}}>›</div>
              </div>

              {isOpen&&(
                <div style={{borderTop:`1px solid ${C.pale}`,padding:".75rem .85rem"}}>
                  {/* 5 actions */}
                  <div style={{fontSize:".6rem",fontWeight:700,color:couleur,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".45rem"}}>
                    ✅ 5 actions pour réactiver ce contact
                  </div>
                  {ACTIONS_RELANCE.map(a=>(
                    <div key={a.id} onClick={()=>toggleAction(c.id,a.id)}
                      style={{display:"flex",alignItems:"flex-start",gap:".5rem",padding:".35rem 0",cursor:"pointer",borderBottom:`1px solid ${C.pale}20`}}>
                      <div style={{width:18,height:18,borderRadius:5,border:`2px solid ${actions[a.id]?C.vert:C.pale}`,background:actions[a.id]?C.vert:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:".1rem"}}>
                        {actions[a.id]&&<span style={{color:"white",fontSize:".6rem",fontWeight:700}}>✓</span>}
                      </div>
                      <span style={{fontSize:".75rem",color:actions[a.id]?C.vert:C.texte,textDecoration:actions[a.id]?"line-through":"none",lineHeight:1.5}}>{a.label}</span>
                    </div>
                  ))}

                  {/* 3 textes de relance */}
                  <div style={{fontSize:".6rem",fontWeight:700,color:C.rose,letterSpacing:".1em",textTransform:"uppercase",marginTop:".75rem",marginBottom:".45rem"}}>
                    💬 Idées de message de relance
                  </div>
                  {TEXTES_RELANCE.map(t=>(
                    <div key={t.id} style={{background:C.creme,borderRadius:9,padding:".55rem .75rem",marginBottom:".35rem",border:`1px solid ${C.pale}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".3rem"}}>
                        <div style={{fontSize:".68rem",fontWeight:700,color:C.brun}}>{t.label}</div>
                        <button onClick={()=>copyTexte(t.texte.replace(/\[Prénom\]/g,c.nom.split(" ")[0]))}
                          style={{background:copied===t.texte?C.vert:C.brun,color:"white",border:"none",borderRadius:6,padding:".18rem .5rem",fontSize:".62rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                          {copied===t.texte?"✓ Copié":"📋 Copier"}
                        </button>
                      </div>
                      <div onClick={()=>setOpenTexte(openTexte===t.id+"_"+c.id?null:t.id+"_"+c.id)}
                        style={{fontSize:".7rem",color:C.gris,lineHeight:1.6,cursor:"pointer",maxHeight:openTexte===t.id+"_"+c.id?"none":"2.5rem",overflow:"hidden",whiteSpace:"pre-line"}}>
                        {t.texte.replace(/\[Prénom\]/g,c.nom.split(" ")[0])}
                      </div>
                      {openTexte!==t.id+"_"+c.id&&(
                        <div style={{fontSize:".6rem",color:C.rose,marginTop:".2rem",cursor:"pointer"}} onClick={()=>setOpenTexte(t.id+"_"+c.id)}>Voir tout →</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:300,color:C.brun,marginBottom:".25rem"}}>
        Stratégie de <em style={{fontStyle:"italic",color:"#5B8DB8"}}>Relance</em>
      </div>
      <p style={{fontSize:".72rem",color:C.gris,lineHeight:1.65,marginBottom:"1rem"}}>
        Clients inactifs et à consolider — 5 actions et 3 messages de relance pour chaque contact.
      </p>

      {clientsCibles.length===0&&(
        <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".76rem",fontStyle:"italic"}}>
          🎉 Aucun client inactif ou à consolider pour l'instant !
        </div>
      )}
      {renderSection("❄️ Clients gelés",inactifs,"#5B8DB8","❄️")}
      {renderSection("🔔 À consolider",consolider,C.or,"🔔")}
    </div>
  );
}

function ClientsTab({clients,save,uid,cibleId}){
  const[sel,setSel]=useState(null);
  useEffect(()=>{if(cibleId){setSel(cibleId);const cible=clients.find(c=>c.id===cibleId);if(cible){const key=cible.statut||"sans";setGroupesOuverts(g=>({...g,[key]:true}));}}},[cibleId]);
  const[form,setForm]=useState({nom:"",prenom:"",tel:"",email:"",ddn:"",adresse:"",notes:""});
  const[editMode,setEditMode]=useState(false);
  const[editForm,setEditForm]=useState({});
  const[cmdForm,setCmdForm]=useState({lignes:[{nom:"",typeProduit:"shampoing"}],montant:"",date:todayLocalStr()});
  const[rappelForm,setRappelForm]=useState({texte:"",date:"",fait:false});
  const[showAdd,setShowAdd]=useState(false);
  const[showCmd,setShowCmd]=useState(false);
  const[showRappel,setShowRappel]=useState(false);
  const[searches,setSearches]=useState({});
  const[vuePrecisions,setVuePrecisions]=useState(false);
  const[groupesOuverts,setGroupesOuverts]=useState({});
  const[confettiTrigger,setConfettiTrigger]=useState(0);

  const today=new Date();
  const daysDiff=(d)=>Math.floor((today-new Date(d))/(1000*60*60*24));
  const lastCmdDate=(c)=>{
    if(!c.commandes||c.commandes.length===0) return null;
    return c.commandes.reduce((best,cmd)=>new Date(cmd.date)>new Date(best.date)?cmd:best).date;
  };

  const STATUTS_CLIENT=[
    {id:"vip",label:"VIP",icon:"⭐",color:"#C4A832",bg:"#FFF8E1"},
    {id:"fidele",label:"Fidèle",icon:"💚",color:C.vert,bg:C.vert+"15"},
    {id:"consolider",label:"À consolider",icon:"🔔",color:C.or,bg:C.or+"15"},
    {id:"inactif",label:"Inactif",icon:"❄️",color:"#5B8DB8",bg:"#E8F0FA"},
  ];
  const STATUTS_ORDRE=["vip","fidele","consolider","inactif",null];
  const PRECISIONS_STATUT={
    vip:[
      {id:"ambassadrice",label:"Ambassadrice potentielle"},
      {id:"hotesse_validee",label:"H\u00f4tesse de r\u00e9union valid\u00e9e"},
      {id:"demande_reunion",label:"Demande \u00e0 faire une r\u00e9union"},
      {id:"fidelite_actif",label:"Programme fid\u00e9lit\u00e9 actif"},
      {id:"interesse_business",label:"Int\u00e9ress\u00e9e par l'opportunit\u00e9 business"},
      {id:"parraine_amies",label:"Parraine des amies"},
      {id:"discussion_vip",label:"Pr\u00e9sente dans discussion VIP"},
    ],
    fidele:[
      {id:"demande_reunion",label:"Demande \u00e0 faire une r\u00e9union"},
      {id:"hotesse_validee",label:"H\u00f4tesse de r\u00e9union valid\u00e9e"},
      {id:"proposer_vip",label:"\u00c0 proposer en VIP"},
      {id:"parraine_amies",label:"Parraine des amies"},
      {id:"discussion_vip",label:"Pr\u00e9sente dans discussion VIP"},
    ],
    consolider:[
      {id:"relance_en_cours",label:"Relance en cours"},
      {id:"demande_reunion",label:"Demande \u00e0 faire une r\u00e9union"},
      {id:"diag_prevu",label:"Rendez-vous diagnostic pr\u00e9vu"},
      {id:"devis_envoye",label:"Devis envoy\u00e9"},
      {id:"attente_reponse",label:"En attente de r\u00e9ponse"},
    ],
    inactif:[
      {id:"relance_envoyee",label:"Message de relance envoy\u00e9"},
      {id:"numero_verifier",label:"Num\u00e9ro \u00e0 v\u00e9rifier"},
      {id:"archiver_si_silence",label:"\u00c0 archiver si pas de r\u00e9ponse"},
      {id:"reactiver",label:"Ancienne cliente \u00e0 r\u00e9activer"},
    ],
  };
  const TYPES_PRODUITS_DUREE=[
    {id:"shampoing",label:"Shampoing",jours:30},
    {id:"soin_visage",label:"Soin Visage",jours:45},
    {id:"complement",label:"Complément",jours:30},
    {id:"maquillage",label:"Maquillage",jours:90},
    {id:"parfum",label:"Parfum",jours:120},
    {id:"autre",label:"Autre",jours:60},
  ];

  const updateStatut=(cid,statut)=>save(clients.map(c=>c.id===cid?{...c,statut}:c));
  const updateNotes=(cid,v)=>save(clients.map(c=>c.id===cid?{...c,notes:v}:c));

  const addClient=()=>{
    if(!form.nom.trim()&&!form.prenom.trim())return;
    const c={...form,id:Date.now(),commandes:[],notes:form.notes};
    save([...clients,c]);
    setSel(c.id);setForm({nom:"",prenom:"",tel:"",email:"",ddn:"",adresse:"",notes:""});setShowAdd(false);
    setConfettiTrigger(t=>t+1);
  };

  const saveEdit=(formData)=>{
    save(clients.map(c=>c.id===sel?{...c,...formData}:c));
    setEditMode(false);
  };

  const delClient=(cid)=>{
    if(!window.confirm("Supprimer cette cliente ?"))return;
    save(clients.filter(c=>c.id!==cid));setSel(null);
  };

  const addCmd=(cid)=>{
    const lignesValides=cmdForm.lignes.filter(l=>l.nom.trim());
    if(lignesValides.length===0)return;
    const lignes=lignesValides.map(l=>{
      const typeInfo=TYPES_PRODUITS_DUREE.find(t=>t.id===l.typeProduit)||TYPES_PRODUITS_DUREE[5];
      return{nom:l.nom.trim(),typeProduit:l.typeProduit,typeLabel:typeInfo.label,dureeJours:typeInfo.jours};
    });
    const cmd={id:Date.now(),date:cmdForm.date,lignes,produits:lignes.map(l=>l.nom).join(", "),montant:cmdForm.montant,suivi8:false,suivi21:false};
    save(clients.map(c=>c.id===cid?{...c,commandes:[...(c.commandes||[]),cmd]}:c));
    // Compteur période
    const periodeNum=getPeriodeActuelle?getPeriodeActuelle():0;
    const periodeKey=`p${periodeNum}`;
    sgAll(uid).then(data=>{
      try{
        const cp=data["db-cmd-periode"]?JSON.parse(data["db-cmd-periode"]):{};
        const cur=cp[periodeKey]||{count:0,montant:0};
        const montantCmd=parseFloat(cmdForm.montant)||0;
        cp[periodeKey]={count:cur.count+1,montant:cur.montant+montantCmd};
        ss(uid,"db-cmd-periode",JSON.stringify(cp));
      }catch{}
    });
    setCmdForm({lignes:[{nom:"",typeProduit:"shampoing"}],montant:"",date:todayLocalStr()});setShowCmd(false);
  };

  const updateLigne=(idx,field,val)=>setCmdForm(p=>({...p,lignes:p.lignes.map((l,i)=>i===idx?{...l,[field]:val}:l)}));
  const addLigne=()=>setCmdForm(p=>({...p,lignes:[...p.lignes,{nom:"",typeProduit:"shampoing"}]}));
  const removeLigne=(idx)=>setCmdForm(p=>({...p,lignes:p.lignes.filter((_,i)=>i!==idx)}));
  const addRappel=(cid)=>{
    if(!rappelForm.texte.trim()||!rappelForm.date)return;
    const r={id:Date.now(),...rappelForm};
    save(clients.map(c=>c.id===cid?{...c,rappels:[...(c.rappels||[]),r]}:c));
    setRappelForm({texte:"",date:"",fait:false});setShowRappel(false);
  };
  const delRappel=(cid,rid)=>save(clients.map(c=>c.id===cid?{...c,rappels:(c.rappels||[]).filter(r=>r.id!==rid)}:c));

  const active=clients.find(c=>c.id===sel);

  // Grouper par statut, triées par dernière commande DESC dans chaque groupe
  const groupes = STATUTS_ORDRE.map(statut=>{
    const statutInfo = statut ? STATUTS_CLIENT.find(s=>s.id===statut) : null;
    const membres = clients
      .filter(c=>(c.statut||null)===statut)
      .sort((a,b)=>(a.prenom||a.nom||"").localeCompare(b.prenom||b.nom||"","fr"));
    return {statut, statutInfo, membres};
  }).filter(g=>g.membres.length>0);

  return(
    <div>
      <Confetti trigger={confettiTrigger}/>

      <div id="decouverte-toggle-vue" style={{display:"flex",gap:".4rem",marginBottom:".65rem"}}>
        <button onClick={()=>setVuePrecisions(false)} style={{flex:1,background:!vuePrecisions?C.brun:C.creme,color:!vuePrecisions?C.blanc:C.gris,border:"1px solid "+(!vuePrecisions?C.brun:C.pale),borderRadius:8,padding:".4rem",fontSize:".72rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>👥 Mes clientes</button>
        <button onClick={()=>setVuePrecisions(true)} style={{flex:1,background:vuePrecisions?C.brun:C.creme,color:vuePrecisions?C.blanc:C.gris,border:"1px solid "+(vuePrecisions?C.brun:C.pale),borderRadius:8,padding:".4rem",fontSize:".72rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>📋 Vue précisions</button>
      </div>
      {vuePrecisions&&<VuePrecisionsClientes clients={clients} PRECISIONS_STATUT={PRECISIONS_STATUT} setSel={setSel} setVuePrecisions={setVuePrecisions}/>}
      {!vuePrecisions&&<div id="decouverte-clients-liste">
      <div id="decouverte-nouvelle-cliente" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun}}>
          Mes <em style={{fontStyle:"italic",color:C.rose}}>Clientes</em>
        </div>
        <button onClick={()=>setShowAdd(p=>!p)}
          style={{background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".45rem .85rem",fontSize:".76rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          + Nouvelle cliente
        </button>
      </div>

      {/* Formulaire ajout */}
      {showAdd&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>Nouvelle cliente</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".4rem"}}>
            <GInput placeholder="Prénom" value={form.prenom} onChange={e=>setForm(p=>({...p,prenom:e.target.value}))}/>
            <GInput placeholder="Nom" value={form.nom} onChange={e=>setForm(p=>({...p,nom:e.target.value}))}/>
          </div>
          <GInput placeholder="Téléphone / WhatsApp" value={form.tel} onChange={e=>setForm(p=>({...p,tel:e.target.value}))}/>
          <GInput placeholder="Email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/>
          <GInput type="date" value={form.ddn} onChange={e=>setForm(p=>({...p,ddn:e.target.value}))} style={{marginBottom:".45rem"}}/>
          <GInput placeholder="Adresse (optionnel)" value={form.adresse} onChange={e=>setForm(p=>({...p,adresse:e.target.value}))}/>
          <textarea placeholder="Notes" value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",resize:"vertical",minHeight:60,marginBottom:".65rem"}}/>
          <div style={{display:"flex",gap:".5rem"}}>
            <button onClick={addClient} style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".52rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>Ajouter</button>
            <button onClick={()=>setShowAdd(false)} style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".52rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>Annuler</button>
          </div>
        </div>
      )}

      {/* Groupes par statut */}
      {groupes.map(({statut, statutInfo, membres})=>{
        const searchKey = statut||"sans";
        const searchVal = searches[searchKey]||"";
        const isOpen = !!groupesOuverts[searchKey];
        const filtered = membres.filter(c=>{
          if(!searchVal) return true;
          const s=searchVal.toLowerCase();
          return (c.prenom+c.nom+c.tel+c.email).toLowerCase().includes(s);
        });

        return(
          <div key={statut||"sans"} style={{marginBottom:".65rem"}}>
            {/* En-tête groupe — cliquable pour ouvrir/fermer */}
            <div onClick={()=>setGroupesOuverts(g=>({...g,[searchKey]:!g[searchKey]}))}
              style={{display:"flex",alignItems:"center",gap:".6rem",background:statutInfo?statutInfo.bg:C.creme,border:`1.5px solid ${statutInfo?statutInfo.color+"40":C.pale}`,borderRadius:isOpen?"12px 12px 0 0":12,padding:".65rem .9rem",cursor:"pointer",userSelect:"none"}}>
              <div style={{fontSize:".85rem"}}>{statutInfo?statutInfo.icon:"📋"}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:".78rem",fontWeight:700,color:statutInfo?statutInfo.color:C.gris}}>
                  {statutInfo?statutInfo.label:"Sans statut"}
                </div>
                <div style={{fontSize:".6rem",color:C.gris}}>{membres.length} cliente{membres.length>1?"s":""}</div>
              </div>
              <div style={{fontSize:".8rem",color:statutInfo?statutInfo.color:C.gris,transform:isOpen?"rotate(90deg)":"rotate(0deg)",transition:"transform .2s"}}>›</div>
            </div>

            {/* Contenu du groupe — visible seulement si ouvert */}
            {isOpen&&(
              <div style={{border:`1.5px solid ${statutInfo?statutInfo.color+"40":C.pale}`,borderTop:"none",borderRadius:"0 0 12px 12px",padding:".75rem",background:C.blanc}}>
                {/* Barre de recherche */}
                <input placeholder={`Rechercher dans ${statutInfo?statutInfo.label:"ce groupe"}...`}
                  value={searchVal} onChange={e=>setSearches(s=>({...s,[searchKey]:e.target.value}))}
                  style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".38rem .65rem",fontSize:".72rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".5rem",boxSizing:"border-box"}}/>

                {/* Cartes clientes */}
                <div style={{display:"flex",flexDirection:"column",gap:".35rem"}}>
                  {filtered.map(c=>(
                    <FicheClienteCard
                      key={c.id}
                      c={c}
                      sel={sel}
                      setSel={setSel}
                      clients={clients}
                      save={save}
                      uid={uid}
                      STATUTS_CLIENT={STATUTS_CLIENT}
                      PRECISIONS_STATUT={PRECISIONS_STATUT}
                      TYPES_PRODUITS_DUREE={TYPES_PRODUITS_DUREE}
                      getPeriodeActuelle={getPeriodeActuelle}
                      sgAll={sgAll}
                      ss={ss}
                      daysDiff={daysDiff}
                    />
                  ))}
                  {filtered.length===0&&<div style={{fontSize:".72rem",color:C.gris,padding:".3rem .5rem"}}>Aucun résultat</div>}
                </div>
              </div>
            )}
          </div>
        );
      })}

      </div>}
      {clients.length===0&&<div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".76rem"}}>Aucune cliente pour l'instant.</div>}
    </div>
  );
}

// Affiche les liens réseaux sociaux d'un membre — réutilisable
function LiensReseauxSection({memberUid}){
  const[liens,setLiens]=useState(null);
  const[loading,setLoading]=useState(true);

  useEffect(()=>{
    if(!memberUid){setLoading(false);return;}
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"linkbio",memberUid));
        if(snap.exists()){
          const lb=snap.data();
          const labels=lb.liensBonusLabel||[];
          const urls=lb.liensBonusUrl||[];
          setLiens(labels.map((lbl,i)=>({label:lbl,url:urls[i]})).filter(l=>l.label&&l.url));
        } else {
          setLiens([]);
        }
      }catch{ setLiens([]); }
      setLoading(false);
    })();
  },[memberUid]);

  return(
    <div style={{marginBottom:".75rem"}}>
      <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.lilas,marginBottom:".4rem"}}>🔗 Ses réseaux</div>
      {loading
        ?<div style={{fontSize:".68rem",color:C.gris}}>Chargement...</div>
        :liens&&liens.length>0
          ?liens.map((l,i)=>(
            <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.creme,borderRadius:8,padding:".4rem .65rem",marginBottom:".3rem",textDecoration:"none"}}>
              <span style={{fontSize:".72rem",color:C.brun,fontWeight:600}}>{l.label}</span>
              <span style={{fontSize:".65rem",color:C.lilas}}>→</span>
            </a>
          ))
          :<div style={{background:C.creme,borderRadius:8,padding:".5rem .65rem",fontSize:".68rem",color:C.gris,fontStyle:"italic"}}>
            Aucun lien renseigné pour l'instant
          </div>
      }
    </div>
  );
}

function DistributeursTab({distributeurs,save,uid}){
  const PALIERS=["2%","4%","6%","8%","10%","12%","14%","17%","SR","Directeur","Structural","Business Director","SR Business Director","Business"];
  const PALIER_COLORS={"2%":C.gris,"4%":C.gris,"6%":C.lilas,"8%":C.lilas,"10%":C.rose,"12%":C.rose,"14%":C.or,"17%":C.or,"SR":"#8B6914","Directeur":C.brun,"Structural":"#5C3A8C","Business Director":"#1A6B3C","SR Business Director":"#B8600A","Business":"#C4A832"};
  const[sel,setSel]=useState(null);
  const[form,setForm]=useState({prenom:"",nom:"",tel:"",email:"",dateEnreg:"",notes:""});
  const[showAdd,setShowAdd]=useState(false);
  const[search,setSearch]=useState("");
  const[annuaire,setAnnuaire]=useState({});
  const[loaded,setLoaded]=useState(false);
  const[path,setPath]=useState([]);
  const[expandedFiche,setExpandedFiche]=useState({});

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
        const entry={uid:newUid, prenom:form.prenom.trim(), nom:form.nom.trim(), marraine:uid, palier:"2%", manuel:true, dateEnreg:todayLocalStr()};
        await setDoc(ref,{membres:{[newUid]:entry}},{merge:true});
        setAnnuaire(prev=>({...prev,[newUid]:entry}));
      }
    }catch{}
  };
  const distributeursTries=[...distributeurs].sort((a,b)=>(a.prenom||"").localeCompare(b.prenom||"","fr"));

  const updatePalier=(id,p)=>save(distributeursTries.map(d=>d.id===id?{...d,palier:p}:d));
  const updateNotes=(id,v)=>save(distributeursTries.map(d=>d.id===id?{...d,notes:v}:d));
  const updateRecrues=(id,field,v)=>save(distributeursTries.map(d=>d.id===id?{...d,[field]:v}:d));
  const updatePremiereCommande=(id,v)=>save(distributeursTries.map(d=>d.id===id?{...d,premiereCommande:v}:d));
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
  const manualFiltered = isMelissa ? distributeursTries : distributeursTries.filter(d=>{
    const dUid=(d.prenom+"-"+d.nom).toLowerCase().replace(/\s+/g,"-").replace(/-+$/,"");
    return !descendants||descendants.has(dUid)||Object.values(annuaire).some(m=>(m.prenom===d.prenom&&m.nom===d.nom)&&descendants.has(m.uid));
  });
  const AFFILIES_IDS = ["julie-marchand"];
  const getDescendantUids = (rootUid) => {
    const r=new Set([rootUid]);const q=[rootUid];
    while(q.length){const c=q.pop();Object.values(annuaire).forEach(m=>{if(m.marraine===c&&!r.has(m.uid)){r.add(m.uid);q.push(m.uid);}});}
    return r;
  };
  const affiliesUids = new Set(AFFILIES_IDS.flatMap(id=>[...getDescendantUids(id)]));
  const allEntriesFull = [...autoEntries, ...manualFiltered.map(d=>({...d, auto:false}))].sort((a,b)=>(a.prenom||a.nom||"").localeCompare(b.prenom||b.nom||"","fr"));
  const allEntries = allEntriesFull.filter(e=>!affiliesUids.has(e.uid||(""+e.prenom+"-"+e.nom).toLowerCase().replace(/\s+/g,"-")));
  const affiliesEntries = allEntriesFull.filter(e=>affiliesUids.has(e.uid||(""+e.prenom+"-"+e.nom).toLowerCase().replace(/\s+/g,"-")));

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

      <div id="decouverte-distrib-add" style={{display:"flex",gap:".5rem",marginBottom:"1rem"}}>
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
            <GInput placeholder="Prénom" value={form.prenom} onChange={e=>setForm(p=>({...p,prenom:e.target.value}))}/>
            <GInput placeholder="Nom" value={form.nom} onChange={e=>setForm(p=>({...p,nom:e.target.value}))}/>
          </div>
          <GInput placeholder="Téléphone / WhatsApp" value={form.tel} onChange={e=>setForm(p=>({...p,tel:e.target.value}))}/>
          <GInput placeholder="Email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/>
          <GInput type="date" placeholder="Date d'enregistrement" value={form.dateEnreg} onChange={e=>setForm(p=>({...p,dateEnreg:e.target.value}))}/>
          <div style={{display:"flex",gap:".4rem",marginTop:".1rem"}}>
            <button onClick={add} style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>Ajouter</button>
            <button onClick={()=>setShowAdd(false)} style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>Annuler</button>
          </div>
        </div>
      )}

      {/* Liste */}
      <div id="decouverte-distrib-liste">{filtered.length===0&&<div style={{fontSize:".76rem",color:C.gris,padding:".5rem"}}>Aucun distributeur trouvé.</div>}

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

                {/* Recrues & Première commande */}
                <div style={{display:"flex",gap:".5rem",marginBottom:".75rem"}}>
                  <div style={{flex:1,background:C.creme,borderRadius:9,padding:".55rem .65rem"}}>
                    <div style={{fontSize:".55rem",color:C.gris,marginBottom:".2rem",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em"}}>👥 Recrues</div>
                    <input type="number" min="0" value={d.recrues||0} onChange={e=>updateRecrues(d.id,"recrues",+e.target.value)}
                      style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:7,padding:".28rem .45rem",fontSize:".85rem",fontFamily:"inherit",color:C.brun,background:"white",outline:"none",fontWeight:600,textAlign:"center"}}/>
                    <div style={{fontSize:".55rem",color:C.gris,marginTop:".15rem",textAlign:"center"}}>total</div>
                  </div>
                  <div style={{flex:1,background:C.creme,borderRadius:9,padding:".55rem .65rem"}}>
                    <div style={{fontSize:".55rem",color:C.gris,marginBottom:".2rem",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em"}}>🛍️ Avec commande</div>
                    <input type="number" min="0" value={d.recruesAvecCmd||0} onChange={e=>updateRecrues(d.id,"recruesAvecCmd",+e.target.value)}
                      style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:7,padding:".28rem .45rem",fontSize:".85rem",fontFamily:"inherit",color:C.brun,background:"white",outline:"none",fontWeight:600,textAlign:"center"}}/>
                    <div style={{fontSize:".55rem",color:C.gris,marginTop:".15rem",textAlign:"center"}}>ont commandé</div>
                  </div>
                  <div style={{flex:1,background:d.premiereCommande?C.vert+"10":C.creme,borderRadius:9,padding:".55rem .65rem",border:`1px solid ${d.premiereCommande?C.vert+"40":C.pale}`}}>
                    <div style={{fontSize:".55rem",color:C.gris,marginBottom:".3rem",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em"}}>🛒 1ère cmd</div>
                    <div style={{textAlign:"center"}}>
                      <label style={{cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:".2rem"}}>
                        <input type="checkbox" checked={!!d.premiereCommande} onChange={e=>updatePremiereCommande(d.id,e.target.checked)} style={{width:18,height:18}}/>
                        <span style={{fontSize:".6rem",color:d.premiereCommande?C.vert:C.gris,fontWeight:700}}>{d.premiereCommande?"✅ Oui":"Pas encore"}</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Liens réseaux sociaux */}
                <LiensReseauxSection memberUid={dUid}/>

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
                    expanded={!!expandedFiche[d.id]}
                    onToggleExpand={()=>setExpandedFiche(p=>({...p,[d.id]:!p[d.id]}))}
                  />
                )}

                <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".4rem",marginTop:".75rem"}}>📝 Notes</div>
                <textarea value={d.notes||""} onChange={e=>d.auto?updateAutoNotes(dUid,e.target.value):updateNotes(d.id,e.target.value)}
                  placeholder="Objectifs, blocages, points de suivi..."
                  style={{width:"100%",minHeight:80,border:`1px solid ${C.pale}`,borderRadius:8,padding:".6rem",fontFamily:"inherit",fontSize:".76rem",color:C.texte,background:C.creme,resize:"vertical",outline:"none",lineHeight:1.6}}/>

                {
                  <button onClick={()=>del(d.id)}
                    style={{marginTop:".5rem",background:"none",border:`1px solid #B0404040`,borderRadius:8,padding:".3rem .7rem",fontSize:".68rem",color:"#B04040",fontFamily:"inherit",cursor:"pointer"}}>
                    Supprimer
                  </button>
                }

                {/* Bouton Fast Start */}
                <button onClick={async()=>{
                  const fUid=dUid||d.uid;
                  if(!fUid){alert("Ce distributeur n'a pas encore de compte app.");return;}
                  try{
                    const ref=doc(db,"users",fUid);
                    const snap=await getDoc(ref);
                    const existing=snap.exists()&&snap.data()["db-fast-start"]?JSON.parse(snap.data()["db-fast-start"]):{};
                    const nom=`${d.prenom||""} ${d.nom||""}`.trim();
                    if(!existing.startDate){
                      await setDoc(ref,{"db-fast-start":JSON.stringify({startDate:todayLocalStr(),doneTasks:{},modulesValides:{}})},{merge:true});
                      alert("✅ Fast Start assigné à "+nom);
                    } else {
                      if(window.confirm(nom+" a déjà un Fast Start (démarré le "+existing.startDate+"). Relancer depuis le début ?")){
                        await setDoc(ref,{"db-fast-start":JSON.stringify({startDate:todayLocalStr(),doneTasks:{},modulesValides:{}})},{merge:true});
                        alert("✅ Fast Start relancé pour "+nom);
                      }
                    }
                  }catch{alert("Ce distributeur n'est pas encore inscrit dans l'app.");}
                }}
                  style={{marginTop:".5rem",marginLeft:".5rem",background:C.rose+"15",border:`1px solid ${C.rose}50`,borderRadius:8,padding:".3rem .7rem",fontSize:".68rem",fontWeight:600,color:C.rose,fontFamily:"inherit",cursor:"pointer"}}>
                  🚀 Assigner Fast Start
                </button>
              </div>
            )}
          </div>
        );
      })}
      {affiliesEntries.length>0&&(<div style={{marginTop:"1.5rem",background:"#FFF8E1",border:"1px solid #F0C040",borderRadius:12,padding:".75rem 1rem"}}><div style={{fontSize:".62rem",fontWeight:700,color:"#8B6914",letterSpacing:".1em",textTransform:"uppercase",marginBottom:".5rem"}}>🌿 Réseau affilié (hors stats Blazing Dynasty)</div>{affiliesEntries.filter(d=>{const t=(d.prenom+" "+(d.nom||"")).toLowerCase();return!search||t.includes(search.toLowerCase());}).map(d=>(<div key={d.id} style={{background:"rgba(255,255,255,.7)",borderRadius:10,padding:".5rem .75rem",marginBottom:".4rem",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><div style={{fontSize:".82rem",fontWeight:700,color:C.brun}}>{d.prenom} {d.nom||""}</div><div style={{fontSize:".62rem",color:"#8B6914"}}>{d.palier||"2%"} · {d.uid||""}</div></div><div style={{fontSize:".6rem",color:"#8B6914",fontStyle:"italic"}}>affilié</div></div>))}<div style={{fontSize:".62rem",color:"#8B6914",marginTop:".4rem",fontStyle:"italic"}}>Les chiffres de ce réseau ne comptent pas dans vos stats globales.</div></div>)}
    </div>
    </div>
  );
}


function VuePrecisionsClientes({clients, PRECISIONS_STATUT, setSel, setVuePrecisions}){
  const toutesLePrecisions=Object.values(PRECISIONS_STATUT).flat().filter((p,i,arr)=>arr.findIndex(x=>x.id===p.id)===i);
  const clientsAvecPrecision=(pid)=>clients.filter(c=>(c.precisions||[]).includes(pid));
  const STATUT_COLORS={vip:"#C4A832",fidele:"#5C8A6A",consolider:"#C49A2A",inactif:"#5B8DB8"};
  const[ouvert,setOuvert]=useState(null);
  const precAvecClientes=toutesLePrecisions.filter(p=>clientsAvecPrecision(p.id).length>0);
  if(precAvecClientes.length===0) return(
    <div style={{textAlign:"center",padding:"2rem",color:"#888",fontFamily:"Trebuchet MS,sans-serif",fontSize:".78rem"}}>
      <div style={{fontSize:"2rem",marginBottom:".5rem"}}>📋</div>
      Aucune précision cochée pour l'instant.<br/>Ouvre une fiche cliente et coche des cases !
    </div>
  );
  return(
    <div>
      <div style={{fontFamily:"Trebuchet MS,sans-serif",fontSize:".68rem",color:"#888",marginBottom:".75rem"}}>Clique sur une catégorie pour voir les clientes</div>
      {precAvecClientes.map(p=>{
        const clientes=clientsAvecPrecision(p.id);
        const isOpen=ouvert===p.id;
        return(
          <div key={p.id} style={{marginBottom:".5rem"}}>
            <div onClick={()=>setOuvert(isOpen?null:p.id)}
              style={{background:isOpen?C.brun:C.blanc,border:"1.5px solid "+(isOpen?C.brun:C.pale),borderRadius:isOpen?"12px 12px 0 0":"12px",padding:".65rem .85rem",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontFamily:"Trebuchet MS,sans-serif",fontSize:".78rem",fontWeight:700,color:isOpen?C.blanc:C.brun}}>{p.label}</div>
                <div style={{fontFamily:"Trebuchet MS,sans-serif",fontSize:".62rem",color:isOpen?"rgba(255,255,255,.7)":C.gris,marginTop:".1rem"}}>{clientes.length} cliente{clientes.length>1?"s":""}</div>
              </div>
              <div style={{color:isOpen?C.blanc:C.gris,fontSize:".72rem"}}>{isOpen?"▲":"▼"}</div>
            </div>
            {isOpen&&(
              <div style={{background:C.creme,border:"1.5px solid "+C.brun,borderTop:"none",borderRadius:"0 0 12px 12px",padding:".5rem .65rem"}}>
                {clientes.map(c=>(
                  <div key={c.id} onClick={()=>{setSel(c.id);setVuePrecisions(false);}}
                    style={{display:"flex",alignItems:"center",gap:".65rem",padding:".5rem .6rem",borderRadius:8,marginBottom:".3rem",background:C.blanc,cursor:"pointer",border:"1px solid "+C.pale}}>
                    <div style={{width:32,height:32,borderRadius:"50%",background:STATUT_COLORS[c.statut]||C.brun,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontFamily:"Georgia,serif",fontSize:".75rem",fontWeight:600,color:"white"}}>{((c.prenom&&c.prenom[0])||(c.nom&&c.nom[0])||"?").toUpperCase()}</span>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:"Georgia,serif",fontSize:".82rem",fontWeight:600,color:C.brun}}>{c.prenom} {c.nom}</div>
                      <div style={{fontFamily:"Trebuchet MS,sans-serif",fontSize:".62rem",color:C.gris}}>{c.tel||c.email||""}</div>
                    </div>
                    <div style={{fontFamily:"Trebuchet MS,sans-serif",fontSize:".6rem",color:STATUT_COLORS[c.statut]||C.gris,fontWeight:600,flexShrink:0}}>
                      {c.statut==="vip"?"⭐ VIP":c.statut==="fidele"?"💚 Fidèle":c.statut==="consolider"?"🔔 À consolider":c.statut==="inactif"?"❄️ Inactive":""}
                    </div>
                  </div>
                ))}
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


export { FicheClienteCard, ClientsRelanceTab, ClientsTab, DistributeursTab, RelancesTab, LiensReseauxSection, MELISSA };
