// fix-boutique-complete.js
// Ajoute TOUTE la gestion boutique dans l'onglet Boutique de LinkBioTab.js
// node fix-boutique-complete.js

const fs = require('fs');
const f = 'src/LinkBioTab.js';
let c = fs.readFileSync(f, 'utf8');
fs.writeFileSync(f + '.bak-complete', c);
let ok = 0;

// A - import setDoc si absent
const p_imp1 = "import { doc, getDoc, setDoc } from 'firebase/firestore';";
const p_imp1b = "import { doc, getDoc } from 'firebase/firestore';";
if (c.includes(p_imp1)) { ok++; console.log('A OK setDoc deja present'); }
else if (c.includes(p_imp1b)) {
  c = c.replace(p_imp1b, p_imp1);
  ok++; console.log('A OK setDoc ajoute');
} else { ok++; console.log('A SKIP'); }

// B - import TokensCadeauxTab
const p_imp2 = "import { DecouverteTour } from './App';";
if (c.includes('TokensCadeauxTab')) { ok++; console.log('B DEJA'); }
else if (c.includes(p_imp2)) {
  c = c.replace(p_imp2, p_imp2 + "\nimport { TokensCadeauxTab } from './TokensCadeauxTab';");
  ok++; console.log('B OK import tokens');
} else console.log('B ECHEC');

// C - prop initialSection
const p_fn = 'function LinkBioTab({uid, userName}){';
if (c.includes('initialSection')) { ok++; console.log('C DEJA'); }
else if (c.includes(p_fn)) {
  c = c.replace(p_fn, 'function LinkBioTab({uid, userName, initialSection="theme"}){');
  ok++; console.log('C OK prop');
} else console.log('C ECHEC');

// D - useState boutique states
const p_state = 'const[showDecouverte,setShowDecouverte]=useState(false);';
const newStates = p_state + `
  // BOUTIQUE STATES
  const[lienPaypalMe,setLienPaypalMe]=useState("");
  const[lienStripePerso,setLienStripePerso]=useState("");
  const[paiementSaving,setPaiementSaving]=useState(false);
  const[paiementSaved,setPaiementSaved]=useState(false);
  const[emailNotif,setEmailNotif]=useState("");
  const[emailNotifSaving,setEmailNotifSaving]=useState(false);
  const[emailNotifSaved,setEmailNotifSaved]=useState(false);
  const[afficherPrixVIP,setAfficherPrixVIP]=useState(false);
  const[lienInscriptionMihi,setLienInscriptionMihi]=useState("");
  const[lienInscriptionSaving,setLienInscriptionSaving]=useState(false);
  const[lienInscriptionSaved,setLienInscriptionSaved]=useState(false);
  const[tokensOuvert,setTokensOuvert]=useState(false);`;

if (c.includes('lienPaypalMe')) { ok++; console.log('D DEJA'); }
else if (c.includes(p_state)) {
  c = c.replace(p_state, newStates);
  ok++; console.log('D OK states boutique');
} else console.log('D ECHEC');

// E - useEffect pour initialSection + chargement boutique
const p_eff = 'const[activeSection,setActiveSection]=useState("theme");';
const newEff = 'const[activeSection,setActiveSection]=useState(initialSection||"theme");\n' +
  '  useEffect(()=>{setActiveSection(initialSection||"theme");},[initialSection]);\n' +
  '  useEffect(()=>{(async()=>{try{\n' +
  '    const snap=await getDoc(doc(db,"users",uid));\n' +
  '    if(snap.exists()){const d=snap.data();\n' +
  '      setLienPaypalMe(d["db-lien-paypalme"]||"");\n' +
  '      setLienStripePerso(d["db-lien-stripe-perso"]||"");\n' +
  '      setEmailNotif(d["db-email-notif-commandes"]||"");\n' +
  '      setAfficherPrixVIP(!!d["db-afficher-prix-vip"]);\n' +
  '      setLienInscriptionMihi(d["db-lien-inscription-mihi"]||"");\n' +
  '    }}catch{}})();},[uid]);';

if (c.includes('useState(initialSection')) { ok++; console.log('E DEJA'); }
else if (c.includes(p_eff)) {
  c = c.replace(p_eff, newEff);
  ok++; console.log('E OK useEffect');
} else console.log('E ECHEC');

// F - fonctions save boutique (apres useEffect chargement linkbio)
const p_fn_anc = 'const slug=(userName||uid).toLowerCase()';
const boutiqueFns = `
  // BOUTIQUE FONCTIONS
  const sauverPaiement=async()=>{
    setPaiementSaving(true);
    try{
      await setDoc(doc(db,"users",uid),{"db-lien-paypalme":lienPaypalMe.trim(),"db-lien-stripe-perso":lienStripePerso.trim()},{merge:true});
      await setDoc(doc(db,"contacts_publics",uid),{"db-lien-paypalme":lienPaypalMe.trim(),"db-lien-stripe-perso":lienStripePerso.trim()},{merge:true});
      setPaiementSaved(true); setTimeout(()=>setPaiementSaved(false),3000);
    }catch{}
    setPaiementSaving(false);
  };
  const sauverEmailNotif=async()=>{
    setEmailNotifSaving(true);
    try{await setDoc(doc(db,"users",uid),{"db-email-notif-commandes":emailNotif.trim()},{merge:true});setEmailNotifSaved(true);setTimeout(()=>setEmailNotifSaved(false),3000);}catch{}
    setEmailNotifSaving(false);
  };
  const toggleVIP=async()=>{
    const next=!afficherPrixVIP;
    setAfficherPrixVIP(next);
    try{await setDoc(doc(db,"users",uid),{"db-afficher-prix-vip":next},{merge:true});}catch{}
  };
  const sauverLienInscription=async()=>{
    setLienInscriptionSaving(true);
    try{await setDoc(doc(db,"users",uid),{"db-lien-inscription-mihi":lienInscriptionMihi.trim()},{merge:true});setLienInscriptionSaved(true);setTimeout(()=>setLienInscriptionSaved(false),3000);}catch{}
    setLienInscriptionSaving(false);
  };
  `;

if (c.includes('sauverPaiement') && c.includes('toggleVIP')) { ok++; console.log('F DEJA'); }
else if (c.includes(p_fn_anc)) {
  c = c.replace(p_fn_anc, boutiqueFns + '\n  const slug=(userName||uid).toLowerCase()');
  ok++; console.log('F OK fonctions boutique');
} else console.log('F ECHEC');

// G - onglet Boutique dans nav
const p_nav = '{id:"liens",icon:"\uD83D\uDD17",label:"Liens"}';
if (c.includes('label:"Boutique"')) { ok++; console.log('G DEJA'); }
else if (c.includes(p_nav)) {
  c = c.replace(p_nav, p_nav + ',\n    {id:"boutique",icon:"\uD83D\uDECD\uFE0F",label:"Boutique"}');
  ok++; console.log('G OK nav');
} else console.log('G ECHEC');

// H - section boutique JSX apres ebooks
const p_sec = 'activeSection==="ebooks"&&(<EbooksLinkBioSection';
const sectionJSX = 'activeSection==="boutique"&&(\n' +
'        <div style={{paddingBottom:"1rem"}}>\n' +

'          <div style={{background:"#F4F0FF",borderRadius:12,padding:"1rem",marginBottom:"1rem",border:"1px solid #D8CCFF"}}>\n' +
'            <div style={{fontSize:".7rem",fontWeight:700,color:"#3D1F0E",marginBottom:".3rem"}}>\uD83D\uDECD\uFE0F Mon lien boutique</div>\n' +
'            <div style={{background:"#3D1F0E",borderRadius:8,padding:".5rem .8rem",color:"white",fontSize:".68rem",wordBreak:"break-all",marginBottom:".5rem"}}>{boutiqueUrl}</div>\n' +
'            <button onClick={()=>{navigator.clipboard.writeText(boutiqueUrl);}} style={{width:"100%",background:"#C4A962",color:"white",border:"none",borderRadius:8,padding:".5rem",fontSize:".76rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>\uD83D\uDCCB Copier mon lien boutique</button>\n' +
'          </div>\n' +

'          <div style={{background:"#F4F0FF",borderRadius:12,padding:"1rem",marginBottom:"1rem",border:"1px solid #D8CCFF"}}>\n' +
'            <div style={{fontSize:".7rem",fontWeight:700,color:"#3D1F0E",marginBottom:".3rem"}}>\uD83D\uDCB3 Encaisser tes ventes</div>\n' +
'            <div style={{fontSize:".65rem",color:"#888",marginBottom:".7rem",lineHeight:1.5}}>Renseigne ton lien de paiement personnel (PayPal et/ou Stripe).</div>\n' +
'            <div style={{fontSize:".68rem",fontWeight:700,color:"#0070BA",marginBottom:".3rem"}}>\uD83C\uDD7F\uFE0F PayPal.me</div>\n' +
'            <div style={{display:"flex",alignItems:"center",border:"1px solid #D8CCFF",borderRadius:8,marginBottom:".8rem",overflow:"hidden"}}>\n' +
'              <span style={{padding:".42rem .5rem",fontSize:".76rem",color:"#888",background:"#F4F0FF",whiteSpace:"nowrap",fontFamily:"inherit"}}>paypal.me/</span>\n' +
'              <input value={lienPaypalMe.replace(/^https?:\\/\\/(www\\.)?paypal\\.me\\//i,"")} onChange={e=>setLienPaypalMe("https://paypal.me/"+e.target.value.replace(/^\\/+/,""))} placeholder="tonpseudo" style={{flex:1,border:"none",padding:".42rem .5rem",fontSize:".76rem",fontFamily:"inherit",outline:"none"}}/>\n' +
'            </div>\n' +
'            <div style={{fontSize:".68rem",fontWeight:700,color:"#635BFF",marginBottom:".3rem"}}>\uD83D\uDCB3 Lien Stripe</div>\n' +
'            <input value={lienStripePerso} onChange={e=>setLienStripePerso(e.target.value)} placeholder="https://buy.stripe.com/..." style={{width:"100%",border:"1px solid #D8CCFF",borderRadius:8,padding:".42rem .65rem",fontSize:".76rem",fontFamily:"inherit",marginBottom:".8rem",outline:"none"}}/>\n' +
'            <button onClick={sauverPaiement} disabled={paiementSaving} style={{width:"100%",background:paiementSaved?"#2E7D32":"#3D1F0E",color:"white",border:"none",borderRadius:8,padding:".55rem",fontSize:".78rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>\n' +
'              {paiementSaving?"...":paiementSaved?"\u2705 Enregistr\u00e9 !":"Enregistrer mes liens de paiement"}\n' +
'            </button>\n' +
'          </div>\n' +

'          <div style={{background:"#FFF3EC",borderRadius:12,padding:"1rem",marginBottom:"1rem",border:"1px solid #F0D8C8"}}>\n' +
'            <div style={{fontSize:".7rem",fontWeight:700,color:"#3D1F0E",marginBottom:".3rem"}}>\uD83D\uDD14 Alerte email nouvelle commande</div>\n' +
'            <div style={{fontSize:".65rem",color:"#888",marginBottom:".6rem",lineHeight:1.5}}>Re\u00e7ois un email \u00e0 chaque commande dans ta boutique.</div>\n' +
'            <input placeholder="ton-email@exemple.com" type="email" value={emailNotif} onChange={e=>setEmailNotif(e.target.value)} style={{width:"100%",border:"1px solid #E8DDD4",borderRadius:10,padding:".55rem .8rem",fontSize:".78rem",fontFamily:"inherit",marginBottom:".6rem",outline:"none"}}/>\n' +
'            <button onClick={sauverEmailNotif} disabled={emailNotifSaving} style={{width:"100%",background:emailNotifSaved?"#2E7D32":"#C44B1A",color:"white",border:"none",borderRadius:8,padding:".55rem",fontSize:".78rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>\n' +
'              {emailNotifSaving?"...":emailNotifSaved?"\u2705 Enregistr\u00e9 !":"Enregistrer mon email"}\n' +
'            </button>\n' +
'          </div>\n' +

'          <div style={{background:"#F3EEFB",borderRadius:12,padding:"1rem",marginBottom:"1rem",border:"1px solid #E0D4F5"}}>\n' +
'            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".3rem"}}>\n' +
'              <div style={{fontSize:".7rem",fontWeight:700,color:"#3D1F0E"}}>\uD83D\uDC8E Prix VIP</div>\n' +
'              <div onClick={toggleVIP} style={{width:40,height:22,borderRadius:20,background:afficherPrixVIP?"#8B6FB3":"#DDD",position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}>\n' +
'                <div style={{width:18,height:18,borderRadius:"50%",background:"white",position:"absolute",top:2,left:afficherPrixVIP?20:2,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.3)"}}/>\n' +
'              </div>\n' +
'            </div>\n' +
'            <div style={{fontSize:".65rem",color:"#888",lineHeight:1.5}}>Affiche le prix VIP dans tes diagnostics et recommandations IA.</div>\n' +
'            {afficherPrixVIP&&(\n' +
'              <div style={{marginTop:".8rem",paddingTop:".8rem",borderTop:"1px solid #E0D4F5"}}>\n' +
'                <div style={{fontSize:".68rem",fontWeight:700,color:"#3D1F0E",marginBottom:".3rem"}}>\uD83D\uDD17 Lien inscription Mihi</div>\n' +
'                <input value={lienInscriptionMihi} onChange={e=>setLienInscriptionMihi(e.target.value)} placeholder="https://..." style={{width:"100%",border:"1px solid #E0D4F5",borderRadius:8,padding:".45rem .65rem",fontSize:".78rem",fontFamily:"inherit",marginBottom:".5rem",outline:"none"}}/>\n' +
'                <button onClick={sauverLienInscription} disabled={lienInscriptionSaving} style={{width:"100%",background:lienInscriptionSaved?"#2E7D32":"#8B6FB3",color:"white",border:"none",borderRadius:8,padding:".5rem",fontSize:".76rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>\n' +
'                  {lienInscriptionSaving?"...":lienInscriptionSaved?"\u2705 Enregistr\u00e9 !":"Enregistrer ce lien"}\n' +
'                </button>\n' +
'              </div>\n' +
'            )}\n' +
'          </div>\n' +

'          <div style={{border:"1.5px solid #C4A962",borderRadius:12,overflow:"hidden",marginBottom:"1rem"}}>\n' +
'            <button onClick={()=>setTokensOuvert(o=>!o)} style={{width:"100%",background:tokensOuvert?"#C4A962":"#FDF8EC",border:"none",padding:".8rem 1rem",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",fontFamily:"inherit"}}>\n' +
'              <div style={{display:"flex",alignItems:"center",gap:".6rem"}}>\n' +
'                <span style={{fontSize:"1.1rem"}}>\uD83C\uDF81</span>\n' +
'                <div>\n' +
'                  <div style={{fontSize:".76rem",fontWeight:700,color:tokensOuvert?"white":"#3D1F0E"}}>Tokens cadeaux</div>\n' +
'                  <div style={{fontSize:".62rem",color:tokensOuvert?"rgba(255,255,255,.85)":"#888"}}>Offres \u00e0 usage unique pour tes clientes</div>\n' +
'                </div>\n' +
'              </div>\n' +
'              <span style={{color:tokensOuvert?"white":"#C4A962"}}>{tokensOuvert?"\u25B2":"\u25BC"}</span>\n' +
'            </button>\n' +
'            {tokensOuvert&&<div style={{padding:".9rem",background:"white",borderTop:"1px solid #E8DDD4"}}><TokensCadeauxTab uid={uid} db={db} prenom={userName}/></div>}\n' +
'          </div>\n' +

'        </div>\n' +
'      )}\n' +
'      {' + 'activeSection==="ebooks"&&(<EbooksLinkBioSection';

if (c.includes('activeSection==="boutique"')) { ok++; console.log('H DEJA'); }
else if (c.includes(p_sec)) {
  c = c.replace(p_sec, sectionJSX);
  ok++; console.log('H OK section boutique');
} else console.log('H ECHEC');

if (ok === 8) {
  fs.writeFileSync(f, c);
  console.log('\n=== TOUT BON (8/8) sauvegarde ===');
} else {
  console.log('\n=== ' + ok + '/8 - RIEN sauvegarde ===');
}
