const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

const ancre = "      {/* Bouton sauver */}";

const bloc = `      {/* Temoignages revenus */}
      <div style={{ background: 'white', border: '1px solid ' + CR.pale, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '.72rem', fontWeight: 700, color: CR.or, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: '.7rem' }}>Revenus de l equipe</div>
        {(cfg.temoignagesRevenus || TEMOIGNAGES_REVENUS_DEFAULT).map((t, i) => (
          <div key={i} style={{ background: CR.creme, borderRadius: 10, padding: '.7rem', marginBottom: '.6rem' }}>
            <div style={{ fontSize: '.7rem', fontWeight: 700, color: CR.or, marginBottom: '.4rem' }}>Personne {i + 1}</div>
            <input value={t.prenom} onChange={e => { const a = [...(cfg.temoignagesRevenus || TEMOIGNAGES_REVENUS_DEFAULT)]; a[i] = { ...a[i], prenom: e.target.value }; setCfg(c => ({ ...c, temoignagesRevenus: a })); }} placeholder="Prenom"
              style={{ width: '100%', border: '1px solid ' + CR.pale, borderRadius: 8, padding: '.5rem .7rem', fontSize: '.78rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: '.4rem' }} />
            <input value={t.metier} onChange={e => { const a = [...(cfg.temoignagesRevenus || TEMOIGNAGES_REVENUS_DEFAULT)]; a[i] = { ...a[i], metier: e.target.value }; setCfg(c => ({ ...c, temoignagesRevenus: a })); }} placeholder="Metier"
              style={{ width: '100%', border: '1px solid ' + CR.pale, borderRadius: 8, padding: '.5rem .7rem', fontSize: '.78rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: '.4rem' }} />
            <input value={t.montant} onChange={e => { const a = [...(cfg.temoignagesRevenus || TEMOIGNAGES_REVENUS_DEFAULT)]; a[i] = { ...a[i], montant: e.target.value }; setCfg(c => ({ ...c, temoignagesRevenus: a })); }} placeholder="Montant euros/mois"
              style={{ width: '100%', border: '1px solid ' + CR.pale, borderRadius: 8, padding: '.5rem .7rem', fontSize: '.78rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        ))}
      </div>

`;

if (c.includes('temoignagesRevenus: a })); }} placeholder="Prenom"')) {
  console.log('DEJA FAIT');
} else if