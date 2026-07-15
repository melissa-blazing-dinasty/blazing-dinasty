// Script : ajoute la section depliable "Tokens cadeaux" dans l'onglet Boutique
// Usage : node fix-tokens-boutique.js
const fs = require('fs');

const fApp = 'src/App.js';
const fLink = 'src/LinkBioTab.js';

let ok = 0;
let total = 0;

// ══════════════════════════════════════════════════════════════
// 1. App.js : RETIRER l'onglet tokens separe (s'il existe)
// ══════════════════════════════════════════════════════════════
let a = fs.readFileSync(fApp, 'utf8');
fs.writeFileSync(fApp + '.bak_tokens', a);

total++;
const ongletTokens = '\n    {id:"tokens",label:"\u{1F381} Tokens cadeaux"},';
if (a.includes(ongletTokens)) {
  a = a.replace(ongletTokens, '');
  console.log('1 OK - onglet separe retire');
  ok++;
} else if (!a.includes('{id:"tokens"')) {
  console.log('1 OK - pas d\'onglet separe (rien a retirer)');
  ok++;
} else {
  console.log('1 ECHEC - onglet tokens present mais format inattendu');
}

total++;
const renderTokens = '\n        {tab==="boiteaoutils"&&outilsSousOnglet==="tokens"&&<TokensCadeauxTab uid={userId} db={db} prenom={name}/>}';
if (a.includes(renderTokens)) {
  a = a.replace(renderTokens, '');
  console.log('2 OK - rendu separe retire');
  ok++;
} else if (!a.includes('outilsSousOnglet==="tokens"')) {
  console.log('2 OK - pas de rendu separe (rien a retirer)');
  ok++;
} else {
  console.log('2 ECHEC - rendu tokens present mais format inattendu');
}

total++;
const importTokens = "\nimport { TokensCadeauxTab } from './TokensCadeauxTab';";
if (a.includes(importTokens)) {
  a = a.replace(importTokens, '');
  console.log('3 OK - import App.js retire');
  ok++;
} else {
  console.log('3 OK - pas d\'import a retirer');
  ok++;
}

// ══════════════════════════════════════════════════════════════
// 2. LinkBioTab.js : AJOUTER l'import
// ══════════════════════════════════════════════════════════════
let l = fs.readFileSync(fLink, 'utf8');
fs.writeFileSync(fLink + '.bak_tokens', l);

total++;
const impAnchor = "import { DecouverteTour } from './App';";
if (l.includes('TokensCadeauxTab')) {
  console.log('4 OK - import LinkBioTab deja present');
  ok++;
} else if (l.includes(impAnchor)) {
  l = l.replace(impAnchor, impAnchor + "\nimport { TokensCadeauxTab } from './TokensCadeauxTab';");
  console.log('4 OK - import LinkBioTab ajoute');
  ok++;
} else {
  console.log('4 ECHEC - ancre import introuvable');
}

// ══════════════════════════════════════════════════════════════
// 3. LinkBioTab.js : AJOUTER le state d'ouverture
// ══════════════════════════════════════════════════════════════
total++;
const stateAnchor = 'const boutiqueUrl=`https://blazing-dinasty-1fad9.web.app?boutique=${slug}`;';
if (l.includes('tokensOuvert')) {
  console.log('5 OK - state deja present');
  ok++;
} else if (l.includes(stateAnchor)) {
  l = l.replace(stateAnchor, stateAnchor + '\n  const[tokensOuvert,setTokensOuvert]=useState(false);');
  console.log('5 OK - state ajoute');
  ok++;
} else {
  console.log('5 ECHEC - ancre state introuvable');
}

// ══════════════════════════════════════════════════════════════
// 4. LinkBioTab.js : AJOUTER la section depliable
// ══════════════════════════════════════════════════════════════
total++;
// Detection auto du type de saut de ligne (Windows \r\n ou Unix \n)
const NL = l.includes('\r\n') ? '\r\n' : '\n';
const secAnchor = [
  '            </div>',
  '          </>)}',
  '        </div>',
  '      )}',
  '',
  '      {/* Bouton sauvegarder */}'
].join(NL);

const sectionTokens = `            </div>

            {/* ── SECTION TOKENS CADEAUX (depliable) ────────────────── */}
            <div style={{marginTop:".8rem",marginBottom:".6rem"}}>
              <button onClick={()=>setTokensOuvert(o=>!o)}
                style={{width:"100%",background:tokensOuvert?"linear-gradient(135deg,#C4A962,#9E6B6B)":C.creme,border:\`1.5px solid \${tokensOuvert?"transparent":C.or}\`,borderRadius:12,padding:".7rem .85rem",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>
                <span style={{display:"flex",alignItems:"center",gap:".5rem"}}>
                  <span style={{fontSize:"1.1rem"}}>🎁</span>
                  <span style={{fontSize:".78rem",fontWeight:700,color:tokensOuvert?"white":C.brun}}>Mes tokens cadeaux</span>
                </span>
                <span style={{fontSize:"1rem",color:tokensOuvert?"white":C.or,transform:tokensOuvert?"rotate(180deg)":"none",transition:"transform .2s"}}>⌄</span>
              </button>
              {!tokensOuvert&&(
                <div style={{fontSize:".65rem",color:C.gris,marginTop:".4rem",lineHeight:1.5,paddingLeft:".2rem"}}>
                  Offre des reductions exclusives a tes clientes. Chaque lien ne peut etre utilise qu'une seule fois — la popup s'affiche automatiquement sur ta boutique.
                </div>
              )}
              {tokensOuvert&&(
                <div style={{marginTop:".7rem",background:C.blanc,border:\`1px solid \${C.pale}\`,borderRadius:12,padding:".8rem"}}>
                  <TokensCadeauxTab uid={uid} db={db} prenom={userName}/>
                </div>
              )}
            </div>
          </>)}
        </div>
      )}

      {/* Bouton sauvegarder */}`;

if (l.includes('tokensOuvert&&(')) {
  console.log('6 OK - section deja presente');
  ok++;
} else if (l.includes(secAnchor)) {
  l = l.replace(secAnchor, sectionTokens);
  console.log('6 OK - section depliable ajoutee');
  ok++;
} else {
  console.log('6 ECHEC - ancre section introuvable');
}

// ══════════════════════════════════════════════════════════════
// SAUVEGARDE
// ══════════════════════════════════════════════════════════════
console.log('');
if (ok === total) {
  fs.writeFileSync(fApp, a);
  fs.writeFileSync(fLink, l);
  console.log('=== ' + ok + '/' + total + ' — TOUT EST BON, fichiers sauvegardes ===');
  console.log('Backups : src/App.js.bak_tokens et src/LinkBioTab.js.bak_tokens');
} else {
  console.log('=== ' + ok + '/' + total + ' seulement — RIEN n\'a ete sauvegarde ===');
}
