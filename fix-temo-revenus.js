const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

// Ajouter section temoignages revenus dans les reglages
// On l'ajoute juste avant la section "Tokens"
const ancre = `{titre:'\uD83C\uDF81 Tokens'`;

const section = `{titre:'\uD83D\uDCB0 T\u00e9moignages revenus',children:(cfg.temoignagesRevenus||TEMOIGNAGES_REVENUS_DEFAULT).map((t,i)=>(
          <div key={i} style={{background:CR.creme,borderRadius:10,padding:'.7rem',marginBottom:'.6rem'}}>
            <div style={{fontSize:'.7rem',fontWeight:700,color:CR.or,marginBottom:'.4rem'}}>T\u00e9moignage {i+1}</div>
            <input value={t.prenom} onChange={e=>{const a=[...(cfg.temoignagesRevenus||TEMOIGNAGES_REVENUS_DEFAULT)];a[i]={...a[i],prenom:e.target.value};setCfg(c=>({...c,temoignagesRevenus:a}));}} placeholder="Pr\u00e9nom" style={{width:'100%',border:'1px solid '+CR.pale,borderRadius:8,padding:'.5rem .7rem',fontSize:'.78rem',fontFamily:'inherit',outline:'none',boxSizing:'border-box',marginBottom:'.4rem'}}/>
            <input value={t.metier} onChange={e=>{const a=[...(cfg.temoignagesRevenus||TEMOIGNAGES_REVENUS_DEFAULT)];a[i]={...a[i],metier:e.target.value};setCfg(c=>({...c,temoignagesRevenus:a}));}} placeholder="M\u00e9tier" style={{width:'100%',border:'1px solid '+CR.pale,borderRadius:8,padding:'.5rem .7rem',fontSize:'.78rem',fontFamily:'inherit',outline:'none',boxSizing:'border-box',marginBottom:'.4rem'}}/>
            <input value={t.montant} onChange={e=>{const a=[...(cfg.temoignagesRevenus||TEMOIGNAGES_REVENUS_DEFAULT)];a[i]={...a[i],montant:e.target.value};setCfg(c=>({...c,temoignagesRevenus:a}));}} placeholder="Montant \u20ac/mois" style={{width:'100%',border:'1px solid '+CR.pale,borderRadius:8,padding:'.5rem .7rem',fontSize:'.78rem',fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}/>
          </div>
        ))},
        `;

if (c.includes('T\u00e9moignages revenus') && c.includes('prenom:e.target')) {
  console.log('DEJA FAIT');
} else if (c.includes(ancre)) {
  c = c.replace(ancre, section + ancre);
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK - temoignages revenus modifiables ajoutes');
} else {
  console.log('ECHEC - ancre introuvable');
  // Chercher ce qui existe
  const idx = c.indexOf('Tokens');
  console.log('Tokens trouve a: ' + c.substring(0,idx).split('\n').length);
}