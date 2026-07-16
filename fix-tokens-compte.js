const fs = require('fs');
const f = 'src/App.js';
let c = fs.readFileSync(f, 'utf8');

const ancre = '        <div id="decouverte-compte-email"';

if (c.includes('TOKENS-COMPTE')) {
  console.log('DEJA FAIT');
} else if (c.includes(ancre)) {
  const bloc = `        {/* TOKENS-COMPTE */}
        <div style={{background:"#FDF8EC",borderRadius:12,padding:"1rem",marginBottom:"1rem",border:"1px solid #C4A962"}}>
          <div style={{fontSize:".7rem",fontWeight:700,color:"#3D1F0E",marginBottom:".3rem"}}>🎁 Tokens cadeaux — offres exclusives</div>
          <div style={{fontSize:".68rem",color:"#888",marginBottom:".7rem",lineHeight:1.5}}>
            Ajoute des liens tokens Mihi pour offrir des cadeaux a tes nouvelles clientes ou recrues. Chaque lien ne peut etre utilise qu'une seule fois.
          </div>
          <TokensCadeauxTab uid={userId} db={db} prenom={name}/>
        </div>
`;
  c = c.replace(ancre, bloc + ancre);
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK - tokens dans Mon Compte');
} else {
  console.log('ECHEC - ancre introuvable');
}