const fs = require('fs');
const f = 'src/LinkBioTab.js';
let c = fs.readFileSync(f, 'utf8');
fs.writeFileSync(f + '.bak-v2', c);
let ok = 0;

// A - prop initialSection
const p1 = 'function LinkBioTab({uid, userName}){';
if (c.includes('initialSection')) { ok++; console.log('A DEJA'); }
else if (c.includes(p1)) {
  c = c.replace(p1, 'function LinkBioTab({uid, userName, initialSection="theme"}){');
  ok++; console.log('A OK');
} else console.log('A ECHEC');

// B - useState + useEffect
const p2 = 'const[activeSection,setActiveSection]=useState("theme");';
if (c.includes('useState(initialSection')) { ok++; console.log('B DEJA'); }
else if (c.includes(p2)) {
  c = c.replace(p2, 'const[activeSection,setActiveSection]=useState(initialSection||"theme");\n  useEffect(()=>{setActiveSection(initialSection||"theme");},[initialSection]);');
  ok++; console.log('B OK');
} else console.log('B ECHEC');

// C - import TokensCadeauxTab
const p3 = "import { DecouverteTour } from './App';";
if (c.includes('TokensCadeauxTab')) { ok++; console.log('C DEJA'); }
else if (c.includes(p3)) {
  c = c.replace(p3, p3 + "\nimport { TokensCadeauxTab } from './TokensCadeauxTab';");
  ok++; console.log('C OK');
} else console.log('C ECHEC');

// D - state tokensOuvert
const p4 = 'const[showDecouverte,setShowDecouverte]=useState(false);';
if (c.includes('tokensOuvert')) { ok++; console.log('D DEJA'); }
else if (c.includes(p4)) {
  c = c.replace(p4, p4 + '\n  const[tokensOuvert,setTokensOuvert]=useState(false);');
  ok++; console.log('D OK');
} else console.log('D ECHEC');

// E - onglet Boutique dans nav
const p5 = '{id:"liens",icon:"\uD83D\uDD17",label:"Liens"}';
if (c.includes('label:"Boutique"')) { ok++; console.log('E DEJA'); }
else if (c.includes(p5)) {
  c = c.replace(p5, p5 + ',\n    {id:"boutique",icon:"\uD83D\uDECD\uFE0F",label:"Boutique"}');
  ok++; console.log('E OK');
} else console.log('E ECHEC');

// F - inserer section boutique apres />)} sur la ligne ebooks/banniere
const p6 = '/>)}{activeSection==="banniere"&&(';
const section = '/>)}\n'
  + '      {activeSection==="boutique"&&(\n'
  + '        <div>\n'
  + '          <div style={{background:"#F4F0FF",borderRadius:12,padding:"1rem",marginBottom:"1rem",border:"1px solid #D8CCFF"}}>\n'
  + '            <div style={{fontSize:".7rem",fontWeight:700,color:"#3D1F0E",marginBottom:".5rem"}}>\uD83D\uDECD\uFE0F Ma boutique Mihi</div>\n'
  + '            <div style={{fontSize:".65rem",color:"#888",marginBottom:".6rem",lineHeight:1.5}}>Ton lien boutique personnalis\u00e9</div>\n'
  + '            <div style={{background:"#3D1F0E",borderRadius:8,padding:".5rem .8rem",color:"white",fontSize:".68rem",wordBreak:"break-all",marginBottom:".6rem"}}>{boutiqueUrl}</div>\n'
  + '            <button onClick={()=>{navigator.clipboard.writeText(boutiqueUrl);}}\n'
  + '              style={{width:"100%",background:"#C4A962",color:"white",border:"none",borderRadius:8,padding:".5rem",fontSize:".76rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer",marginBottom:".5rem"}}>\n'
  + '              \uD83D\uDCCB Copier mon lien boutique\n'
  + '            </button>\n'
  + '          </div>\n'
  + '          <div style={{border:"1.5px solid #C4A962",borderRadius:12,overflow:"hidden",marginBottom:"1rem"}}>\n'
  + '            <button onClick={()=>setTokensOuvert(o=>!o)} style={{width:"100%",background:tokensOuvert?"#C4A962":"#FDF8EC",border:"none",padding:".8rem 1rem",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",fontFamily:"inherit"}}>\n'
  + '              <div style={{display:"flex",alignItems:"center",gap:".6rem"}}>\n'
  + '                <span style={{fontSize:"1.1rem"}}>\uD83C\uDF81</span>\n'
  + '                <div>\n'
  + '                  <div style={{fontSize:".76rem",fontWeight:700,color:tokensOuvert?"white":"#3D1F0E"}}>Tokens cadeaux</div>\n'
  + '                  <div style={{fontSize:".62rem",color:tokensOuvert?"rgba(255,255,255,.85)":"#888"}}>Offres \u00e0 usage unique</div>\n'
  + '                </div>\n'
  + '              </div>\n'
  + '              <span style={{color:tokensOuvert?"white":"#C4A962"}}>{tokensOuvert?"\u25B2":"\u25BC"}</span>\n'
  + '            </button>\n'
  + '            {tokensOuvert&&<div style={{padding:".9rem",background:"white",borderTop:"1px solid #E8DDD4"}}><TokensCadeauxTab uid={uid} db={db} prenom={userName}/></div>}\n'
  + '          </div>\n'
  + '        </div>\n'
  + '      )}\n'
  + '      {activeSection==="banniere"&&(';

if (c.includes('activeSection==="boutique"')) { ok++; console.log('F DEJA'); }
else if (c.includes(p6)) {
  c = c.replace(p6, section);
  ok++; console.log('F OK');
} else console.log('F ECHEC');

if (ok === 6) {
  fs.writeFileSync(f, c);
  console.log('=== TOUT BON (6/6) sauvegarde ===');
} else {
  console.log('=== ' + ok + '/6 - RIEN sauvegarde ===');
}