const fs = require('fs');
let c = fs.readFileSync('src/App.js', 'utf8');

const lines = c.split('\n');
const idx = lines.findIndex(l => l.includes("Envoyer le lien a la cliente"));

lines[idx] = `            <button onClick={async()=>{const ord=sel?.ordonnance;if(!ord)return;try{const id='ord_'+Date.now();await setDoc(doc(db,'ordonnances_publiques',id),{ordonnance:ord,nomClient:sel?.nomClient||sel?.contact?.prenom||'Cliente',date:todayLocalStr(),ts:Date.now()});const lien=window.location.origin+'?ordonnance='+id;const msg='Voici le lien pour ta cliente :\\n\\n'+lien+'\\n\\nCopie ce lien et envoie-le lui !';if(navigator.share){await navigator.share({title:'Ordonnance Mihi',text:'Ton ordonnance personnalisée Mihi',url:lien});}else{prompt('Copie ce lien et envoie-le à ta cliente :',lien);}}catch(e){alert('Erreur : '+e.message);}}} style={{width:'100%',background:'#7FAF8A',color:'white',border:'none',borderRadius:10,padding:'.6rem',fontSize:'.78rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginTop:'.4rem'}}>Envoyer le lien a la cliente</button>`;

c = lines.join('\n');
fs.writeFileSync('src/App.js', c, 'utf8');
console.log('OK');