const fs = require('fs');
const f = 'src/TunnelStatsTab.jsx';
let c = fs.readFileSync(f, 'utf8');

const ancre = "      {/* KPIs */}";
const explication = `      {/* Explications */}
      <div style={{background:'#FDF8EC',border:'1px solid '+CR.or,borderRadius:12,padding:'.8rem 1rem',marginBottom:'1rem',fontSize:'.75rem',color:CR.gris,lineHeight:1.7}}>
        <strong style={{color:CR.brun,display:'block',marginBottom:'.3rem'}}>📖 Comprendre tes stats</strong>
        👁️ <strong>Vues</strong> : nombre de personnes ayant ouvert ta page tunnel<br/>
        📋 <strong>Leads</strong> : personnes ayant rempli ton formulaire de contact (prospects chauds à recontacter !)<br/>
        📊 <strong>Taux de conversion</strong> : % de visiteurs qui ont rempli le formulaire<br/>
        🎁 <strong>Tokens utilisés</strong> : offres cadeaux activées par tes prospects
      </div>
`;

if (c.includes('Comprendre tes stats')) {
  console.log('DEJA FAIT');
} else if (c.includes(ancre)) {
  c = c.replace(ancre, explication + ancre);
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK');
} else {
  console.log('ECHEC');
}