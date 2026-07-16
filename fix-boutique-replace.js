const fs = require('fs');
const f = 'src/LinkBioTab.js';
let c = fs.readFileSync(f, 'utf8');
fs.writeFileSync(f + '.bak-replace', c);

// Trouver et remplacer toute la section boutique incomplete
const debut = '      {activeSection==="boutique"&&(';
const fin = '      )}\n      {activeSection==="ebooks"';
const finAlt = '      )}\n      {' + 'activeSection==="ebooks"';

const i1 = c.indexOf(debut);
let i2 = c.indexOf(fin);
if (i2 === -1) i2 = c.indexOf(finAlt);

if (i1 === -1) { console.log('ECHEC - debut section introuvable'); process.exit(1); }
if (i2 === -1) { console.log('ECHEC - fin section introuvable'); process.exit(1); }

console.log('Section trouvee lignes ' + c.slice(0,i1).split('\n').length + ' a ' + c.slice(0,i2).split('\n').length);

const newSection = `      {activeSection==="boutique"&&(
        <div style={{paddingBottom:"1rem"}}>

          <div style={{background:"#F4F0FF",borderRadius:12,padding:"1rem",marginBottom:"1rem",border:"1px solid #D8CCFF"}}>
            <div style={{fontSize:".7rem",fontWeight:700,color:"#3D1F0E",marginBottom:".3rem"}}>🛍️ Mon lien boutique</div>
            <div style={{background:"#3D1F0E",borderRadius:8,padding:".5rem .8rem",color:"white",fontSize:".68rem",wordBreak:"break-all",marginBottom:".5rem"}}>{boutiqueUrl}</div>
            <button onClick={()=>{navigator.clipboard.writeText(boutiqueUrl);}} style={{width:"100%",background:"#C4A962",color:"white",border:"none",borderRadius:8,padding:".5rem",fontSize:".76rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>📋 Copier mon lien boutique</button>
          </div>

          <div style={{background:"#F4F0FF",borderRadius:12,padding:"1rem",marginBottom:"1rem",border:"1px solid #D8CCFF"}}>
            <div style={{fontSize:".7rem",fontWeight:700,color:"#3D1F0E",marginBottom:".3rem"}}>💳 Encaisser tes ventes</div>
            <div style={{fontSize:".65rem",color:"#888",marginBottom:".7rem",lineHeight:1.5}}>Renseigne ton lien de paiement personnel (PayPal et/ou Stripe).</div>
            <div style={{fontSize:".68rem",fontWeight:700,color:"#0070BA",marginBottom:".3rem"}}>🅿️ PayPal.me</div>
            <div style={{display:"flex",alignItems:"center",border:"1px solid #D8CCFF",borderRadius:8,marginBottom:".8rem",overflow:"hidden"}}>
              <span style={{padding:".42rem .5rem",fontSize:".76rem",color:"#888",background:"#F4F0FF",whiteSpace:"nowrap",fontFamily:"inherit"}}>paypal.me/</span>
              <input value={lienPaypalMe.replace(/^https?:\/\/(www\.)?paypal\.me\//i,"")} onChange={e=>setLienPaypalMe("https://paypal.me/"+e.target.value.replace(/^\/+/,""))} placeholder="tonpseudo" style={{flex:1,border:"none",padding:".42rem .5rem",fontSize:".76rem",fontFamily:"inherit",outline:"none"}}/>
            </div>
            <div style={{fontSize:".68rem",fontWeight:700,color:"#635BFF",marginBottom:".3rem"}}>💳 Lien Stripe</div>
            <input value={lienStripePerso} onChange={e=>setLienStripePerso(e.target.value)} placeholder="https://buy.stripe.com/..." style={{width:"100%",border:"1px solid #D8CCFF",borderRadius:8,padding:".42rem .65rem",fontSize:".76rem",fontFamily:"inherit",marginBottom:".8rem",outline:"none"}}/>
            <button onClick={sauverPaiement} disabled={paiementSaving} style={{width:"100%",background:paiementSaved?"#2E7D32":"#3D1F0E",color:"white",border:"none",borderRadius:8,padding:".55rem",fontSize:".78rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
              {paiementSaving?"...":paiementSaved?"✅ Enregistré !":"Enregistrer mes liens de paiement"}
            </button>
          </div>

          <div style={{background:"#FFF3EC",borderRadius:12,padding:"1rem",marginBottom:"1rem",border:"1px solid #F0D8C8"}}>
            <div style={{fontSize:".7rem",fontWeight:700,color:"#3D1F0E",marginBottom:".3rem"}}>🔔 Alerte email nouvelle commande</div>
            <div style={{fontSize:".65rem",color:"#888",marginBottom:".6rem",lineHeight:1.5}}>Reçois un email à chaque commande dans ta boutique.</div>
            <input placeholder="ton-email@exemple.com" type="email" value={emailNotif} onChange={e=>setEmailNotif(e.target.value)} style={{width:"100%",border:"1px solid #E8DDD4",borderRadius:10,padding:".55rem .8rem",fontSize:".78rem",fontFamily:"inherit",marginBottom:".6rem",outline:"none"}}/>
            <button onClick={sauverEmailNotif} disabled={emailNotifSaving} style={{width:"100%",background:emailNotifSaved?"#2E7D32":"#C44B1A",color:"white",border:"none",borderRadius:8,padding:".55rem",fontSize:".78rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
              {emailNotifSaving?"...":emailNotifSaved?"✅ Enregistré !":"Enregistrer mon email"}
            </button>
          </div>

          <div style={{background:"#F3EEFB",borderRadius:12,padding:"1rem",marginBottom:"1rem",border:"1px solid #E0D4F5"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".3rem"}}>
              <div style={{fontSize:".7rem",fontWeight:700,color:"#3D1F0E"}}>💎 Prix VIP</div>
              <div onClick={toggleVIP} style={{width:40,height:22,borderRadius:20,background:afficherPrixVIP?"#8B6FB3":"#DDD",position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}>
                <div style={{width:18,height:18,borderRadius:"50%",background:"white",position:"absolute",top:2,left:afficherPrixVIP?20:2,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.3)"}}/>
              </div>
            </div>
            <div style={{fontSize:".65rem",color:"#888",lineHeight:1.5}}>Affiche le prix VIP dans tes diagnostics et recommandations IA.</div>
            {afficherPrixVIP&&(
              <div style={{marginTop:".8rem",paddingTop:".8rem",borderTop:"1px solid #E0D4F5"}}>
                <div style={{fontSize:".68rem",fontWeight:700,color:"#3D1F0E",marginBottom:".3rem"}}>🔗 Lien inscription Mihi</div>
                <input value={lienInscriptionMihi} onChange={e=>setLienInscriptionMihi(e.target.value)} placeholder="https://..." style={{width:"100%",border:"1px solid #E0D4F5",borderRadius:8,padding:".45rem .65rem",fontSize:".78rem",fontFamily:"inherit",marginBottom:".5rem",outline:"none"}}/>
                <button onClick={sauverLienInscription} disabled={lienInscriptionSaving} style={{width:"100%",background:lienInscriptionSaved?"#2E7D32":"#8B6FB3",color:"white",border:"none",borderRadius:8,padding:".5rem",fontSize:".76rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
                  {lienInscriptionSaving?"...":lienInscriptionSaved?"✅ Enregistré !":"Enregistrer ce lien"}
                </button>
              </div>
            )}
          </div>

          <div style={{border:"1.5px solid #C4A962",borderRadius:12,overflow:"hidden",marginBottom:"1rem"}}>
            <button onClick={()=>setTokensOuvert(o=>!o)} style={{width:"100%",background:tokensOuvert?"#C4A962":"#FDF8EC",border:"none",padding:".8rem 1rem",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",fontFamily:"inherit"}}>
              <div style={{display:"flex",alignItems:"center",gap:".6rem"}}>
                <span style={{fontSize:"1.1rem"}}>🎁</span>
                <div>
                  <div style={{fontSize:".76rem",fontWeight:700,color:tokensOuvert?"white":"#3D1F0E"}}>Tokens cadeaux</div>
                  <div style={{fontSize:".62rem",color:tokensOuvert?"rgba(255,255,255,.85)":"#888"}}>Offres à usage unique pour tes clientes</div>
                </div>
              </div>
              <span style={{color:tokensOuvert?"white":"#C4A962"}}>{tokensOuvert?"▲":"▼"}</span>
            </button>
            {tokensOuvert&&<div style={{padding:".9rem",background:"white",borderTop:"1px solid #E8DDD4"}}><TokensCadeauxTab uid={uid} db={db} prenom={userName}/></div>}
          </div>

        </div>
      )}\n      {activeSection==="ebooks"`;

c = c.slice(0, i1) + newSection + c.slice(i2 + fin.length);
fs.writeFileSync(f, c);
console.log('=== Section boutique remplacee et sauvegardee ===');