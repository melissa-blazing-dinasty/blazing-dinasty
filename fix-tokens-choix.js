const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

// Trouver le state tokenChoisi
const ancreState = "  const [formSending, setFormSending] = useState(false);";
if (!c.includes('tokenChoisi') && c.includes(ancreState)) {
  c = c.replace(ancreState,
    "  const [tokenChoisi, setTokenChoisi] = useState(null);\n" +
    "  const [tokenConfirm, setTokenConfirm] = useState(false);\n  " +
    ancreState.trim()
  );
  console.log('1 OK - states token');
} else console.log('1 SKIP');

// Remplacer le bloc offre limitee existant par le nouveau avec choix
const ancreOffre = "      {/* OFFRE LIMITÉE (tokens) */}";
const finOffre = "\n      {/* BOUTIQUE */}";

const idxDebut = c.indexOf(ancreOffre);
const idxFin = c.indexOf(finOffre, idxDebut);

if (idxDebut !== -1 && idxFin !== -1 && !c.includes('typesTokens')) {
  const nouveauBloc = `      {/* OFFRE LIMITÉE (tokens) */}
      {tokens.length > 0 && (
        <div style={{ margin: '0 1rem 1rem', borderRadius: 16, padding: 3, background: 'linear-gradient(135deg,' + accent + ',#fff,' + accent + ')', boxShadow: '0 0 24px ' + accent + '66' }}>
          <div style={{ background: 'linear-gradient(135deg,#1A0800,#2D1400)', borderRadius: 14, padding: '1.2rem', color: 'white' }}>
            <div style={{ textAlign: 'center', marginBottom: '.8rem' }}>
              <div style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: accent, marginBottom: '.3rem' }}>OFFRE LIMITEE</div>
              {!tokenChoisi && !tokenConfirm && <div style={{ fontFamily: 'Georgia,serif', fontSize: '1.15rem', fontWeight: 700, marginBottom: '.2rem' }}>Choisis ton cadeau</div>}
              {!tokenChoisi && !tokenConfirm && <div style={{ fontSize: '.72rem', opacity: .8 }}>Pour toute inscription — offre a usage unique</div>}
            </div>
            {!tokenChoisi && !tokenConfirm && (<>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '.5rem', marginBottom: '.7rem' }}>
                {[{v:countdown.h,l:'h'},{v:countdown.m,l:'min'},{v:countdown.s,l:'sec'}].map(({v,l}) => (
                  <div key={l} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid ' + accent + '44', borderRadius: 8, padding: '.4rem .6rem', minWidth: 42, textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace', color: accent }}>{pad(v)}</div>
                    <div style={{ fontSize: '.55rem', opacity: .7 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '.7rem', textAlign: 'center', color: accent, marginBottom: '.8rem' }}>Plus que <strong>{tokens.length}</strong> offre{tokens.length > 1 ? 's' : ''} disponible{tokens.length > 1 ? 's' : ''}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                {[...new Map(tokens.map(t => [t.type, t])).values()].map(tok => (
                  <button key={tok.id} onClick={() => setTokenChoisi(tok)}
                    style={{ background: 'rgba(255,255,255,.08)', border: '1.5px solid ' + accent + '66', borderRadius: 10, padding: '.75rem 1rem', color: 'white', fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.7rem', textAlign: 'left' }}>
                    <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{tok.emoji || '🎁'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '.82rem', fontWeight: 700, color: accent }}>{tok.labelPerso || tok.label}</div>
                      <div style={{ fontSize: '.7rem', opacity: .75 }}>{tok.description}</div>
                    </div>
                    <span style={{ color: accent }}>→</span>
                  </button>
                ))}
              </div>
            </>)}
            {tokenChoisi && !tokenConfirm && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>{tokenChoisi.emoji || '🎁'}</div>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: '1.1rem', fontWeight: 700, color: accent, marginBottom: '.4rem' }}>{tokenChoisi.labelPerso || tokenChoisi.label}</div>
                <div style={{ fontSize: '.75rem', opacity: .85, marginBottom: '.8rem' }}>Tu vas etre redirigee vers la boutique Mihi pour activer ton offre.</div>
                <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 10, padding: '.6rem', fontSize: '.72rem', marginBottom: '.9rem' }}>Ce lien est a usage unique.</div>
                <button onClick={() => { setTokenConfirm(true); setTimeout(() => { window.location.href = tokenChoisi.lien; }, 1500); }}
                  style={{ width: '100%', background: accent, color: 'white', border: 'none', borderRadius: 10, padding: '.75rem', fontSize: '.85rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', marginBottom: '.5rem' }}>
                  Activer mon offre →
                </button>
                <button onClick={() => setTokenChoisi(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.6)', fontFamily: 'inherit', cursor: 'pointer', fontSize: '.75rem' }}>← Revenir</button>
              </div>
            )}
            {tokenConfirm && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '.5rem' }}>🎉</div>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: '1.1rem', fontWeight: 700, color: accent }}>Offre activee !</div>
                <div style={{ fontSize: '.78rem', opacity: .8, marginTop: '.4rem' }}>Redirection en cours...</div>
              </div>
            )}
          </div>
        </div>
      )}
`;
  c = c.slice(0, idxDebut) + nouveauBloc + c.slice(idxFin);
  fs.writeFileSync(f, c, 'utf8');
  console.log('2 OK - bloc choix tokens');
} else if (c.includes('typesTokens')) {
  console.log('2 DEJA FAIT');
} else {
  console.log('2 ECHEC - idxDebut:' + idxDebut + ' idxFin:' + idxFin);
}