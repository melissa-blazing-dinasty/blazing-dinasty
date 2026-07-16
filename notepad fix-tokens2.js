const fs = require('fs');
const f = 'src/LinkBioTab.js';
let c = fs.readFileSync(f, 'utf8');
fs.writeFileSync(f + '.bak-tok', c);

let ok = 0;

const imp = "import { DecouverteTour } from './App';";
if (c.includes('TokensCadeauxTab')) { ok++; console.log('A DEJA FAIT'); }
else if (c.includes(imp)) {
  c = c.replace(imp, imp + "\nimport { TokensCadeauxTab } from './TokensCadeauxTab';");
  ok++; console.log('A OK import');
} else console.log('A ECHEC');

const st = 'const[activeSection,setActiveSection]=useState(initialSection);';
if (c.includes('tokensOuvert')) { ok++; console.log('B DEJA FAIT'); }
else if (c.includes(st)) {
  c = c.replace(st, st + '\n  const[tokensOuvert,setTokensOuvert]=useState(false);');
  ok++; console.log('B OK state');
} else console.log('B ECHEC');

const anc = 'Enregistrer mes liens de paiement"}';
if (c.includes('TOKENS-SECTION')) { ok++; console.log('C DEJA FAIT'); }
else if (c.includes(anc)) {
  const i1 = c.indexOf(anc);
  const i2 = c.indexOf('</button>', i1);
  const i3 = c.indexOf('</div>', i2) + 6;
  const b = '\n\n            {/* TOKENS-SECTION */}\n'
   + '            <div style={{marginBottom:"1rem",border:`1.5px solid ${C.or}`,borderRadius:12,overflow:"hidden"}}>\n'
   + '              <button onClick={()=>setTokensOuvert(o=>!o)} style={{width:"100%",background:tokensOuvert?C.or:"#FDF8EC",border:"none",padding:".8rem 1rem",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",fontFamily:"inherit"}}>\n'
   + '                <div style={{display:"flex",alignItems:"center",gap:".6rem"}}>\n'
   + '                  <span style={{fontSize:"1.1rem"}}>\u{1F381}</span>\n'
   + '                  <div style={{textAlign:"left"}}>\n'
   + '                    <div style={{fontSize:".76rem",fontWeight:700,color:tokensOuvert?"white":C.brun}}>Tokens cadeaux</div>\n'
   + '                    <div style={{fontSize:".62rem",color:tokensOuvert?"rgba(255,255,255,.85)":C.gris}}>Offres exclusives a usage unique</div>\n'
   + '                  </div>\n'
   + '                </div>\n'
   + '                <span style={{fontSize:"1rem",color:tokensOuvert?"white":C.or}}>{tokensOuvert?"\u25B2":"\u25BC"}</span>\n'
   + '              </button>\n'
   + '              {tokensOuvert&&(\n'
   + '                <div style={{padding:".9rem",background:"white",borderTop:`1px solid ${C.pale}`}}>\n'
   + '                  <TokensCadeauxTab uid={uid} db={db} prenom={userName}/>\n'
   + '                </div>\n'
   + '              )}\n'
   + '            </div>';
  c = c.slice(0, i3) + b + c.slice(i3);
  ok++; console.log('C OK section');
} else console.log('C ECHEC');

if (ok === 3) { fs.writeFileSync(f, c); console.log('=== TOUT BON, sauvegarde ==='); }
else console.log('=== ' + ok + '/3, RIEN sauvegarde ===');