import { useState } from 'react';

const C = {
  brun: '#5A3829', or: '#C4A962', creme: '#FAF7F2', pale: '#EDE8E0',
  texte: '#2D1F1F', gris: '#9A8C8C', blanc: '#FFFFFF',
};

const VALEURS = [
  { id: 'liberte', label: 'Liberté', emoji: '🕊️', desc: 'Faire tes propres choix, vivre à ton rythme', color: '#29B6F6' },
  { id: 'famille', label: 'Famille', emoji: '👨‍👩‍👧', desc: 'Être présente pour tes proches', color: '#E91E8C' },
  { id: 'securite', label: 'Sécurité', emoji: '🛡️', desc: 'Stabilité financière et émotionnelle', color: '#66BB6A' },
  { id: 'reconnaissance', label: 'Reconnaissance', emoji: '🏆', desc: 'Être vue, valorisée, appréciée', color: '#C4A962' },
  { id: 'impact', label: 'Impact', emoji: '🌍', desc: 'Changer les choses, aider les autres', color: '#9575CD' },
  { id: 'croissance', label: 'Croissance', emoji: '🌱', desc: 'Apprendre, évoluer, devenir meilleure', color: '#4CAF50' },
  { id: 'aventure', label: 'Aventure', emoji: '🚀', desc: 'Nouveauté, challenges, sortir de ta zone', color: '#FF6B35' },
  { id: 'authenticite', label: 'Authenticité', emoji: '💎', desc: 'Être vraie, cohérente avec tes convictions', color: '#EC407A' },
  { id: 'excellence', label: 'Excellence', emoji: '⭐', desc: 'Donner le meilleur, viser le sommet', color: '#FF8A65' },
  { id: 'connexion', label: 'Connexion', emoji: '🤝', desc: 'Créer des liens forts et durables', color: '#26C6DA' },
  { id: 'creativite', label: 'Créativité', emoji: '🎨', desc: 'Innover, créer, exprimer ton unicité', color: '#AB47BC' },
  { id: 'sante', label: 'Santé', emoji: '💚', desc: 'Bien-être physique et mental', color: '#2E7D32' },
  { id: 'richesse', label: 'Richesse', emoji: '💰', desc: 'Abondance financière et matérielle', color: '#F9A825' },
  { id: 'spiritualite', label: 'Spiritualité', emoji: '✨', desc: 'Sens profond, foi, connexion à quelque chose de plus grand', color: '#7E57C2' },
  { id: 'plaisir', label: 'Plaisir', emoji: '🎉', desc: 'Joie, légèreté, profiter de la vie', color: '#FF4081' },
];

const DESCRIPTIONS_COMBO = {
  'liberte-famille': 'Tu es une maman-entrepreneuse dans l\'âme. Tu construis ton business pour être libre ET présente pour ceux que tu aimes.',
  'impact-croissance': 'Tu es une leader en devenir. Tu veux laisser une trace et devenir la meilleure version de toi-même.',
  'reconnaissance-excellence': 'Tu es ambitieuse et perfectionniste. Tu veux être vue pour ce que tu fais de mieux.',
  'authenticite-connexion': 'Tu construis des relations profondes et durables. Les gens te font confiance naturellement.',
  'securite-famille': 'Ta priorité absolue c\'est protéger et nourrir ceux que tu aimes. Ton business est un acte d\'amour.',
};

export default function TestValeurs() {
  const [step, setStep] = useState('selection'); // selection | classement | result
  const [selected, setSelected] = useState([]);
  const [ranked, setRanked] = useState([]);
  const [dragging, setDragging] = useState(null);
  const [historique, setHistorique] = useState(() => {
    try { return JSON.parse(localStorage.getItem('valeurs_historique') || '[]'); } catch { return []; }
  });
  const [activeTab, setActiveTab] = useState('test');

  const toggleValeur = (id) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(s => s !== id));
    } else if (selected.length < 8) {
      setSelected([...selected, id]);
    }
  };

  const passerClassement = () => {
    setRanked(selected.map(id => VALEURS.find(v => v.id === id)));
    setStep('classement');
  };

  const moveUp = (i) => {
    if (i === 0) return;
    const next = [...ranked];
    [next[i-1], next[i]] = [next[i], next[i-1]];
    setRanked(next);
  };

  const moveDown = (i) => {
    if (i === ranked.length - 1) return;
    const next = [...ranked];
    [next[i], next[i+1]] = [next[i+1], next[i]];
    setRanked(next);
  };

  const valider = () => {
    const top5 = ranked.slice(0, 5);
    const entry = {
      date: new Date().toLocaleDateString('fr-FR'),
      top5: top5.map(v => v.id),
    };
    const hist = [entry, ...historique].slice(0, 6);
    setHistorique(hist);
    localStorage.setItem('valeurs_historique', JSON.stringify(hist));
    setStep('result');
  };

  const recommencer = () => {
    setSelected([]);
    setRanked([]);
    setStep('selection');
  };

  const top5 = ranked.slice(0, 5);
  const valeurPrincipale = ranked[0];

  // Trouver combo description
  const comboKey = top5.slice(0, 2).map(v => v?.id).sort().join('-');
  const comboDesc = DESCRIPTIONS_COMBO[comboKey];

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", maxWidth: 480, margin: '0 auto', background: C.creme, minHeight: '100vh', paddingBottom: '3rem' }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.brun}, #3D2020)`, padding: '1.5rem 1rem', textAlign: 'center', color: 'white' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.4rem', fontWeight: 600 }}>💎 Mes Valeurs Profondes</div>
        <div style={{ fontSize: '.78rem', opacity: .8, marginTop: '.3rem' }}>Découvre ce qui te motive vraiment</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '.5rem', padding: '.8rem 1rem', background: 'white', borderBottom: `1px solid ${C.pale}` }}>
        {[{ id: 'test', label: '💎 Test' }, { id: 'historique', label: '📊 Historique' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ flex: 1, padding: '.5rem', borderRadius: 10, border: 'none', background: activeTab === t.id ? C.brun : C.pale, color: activeTab === t.id ? 'white' : C.gris, fontFamily: 'inherit', fontSize: '.78rem', fontWeight: activeTab === t.id ? 700 : 400, cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'test' && (
        <div style={{ padding: '1rem' }}>

          {step === 'selection' && (
            <div>
              <div style={{ background: `${C.or}15`, border: `1px solid ${C.or}44`, borderRadius: 12, padding: '1rem', marginBottom: '1rem', fontSize: '.75rem', color: C.texte, lineHeight: 1.6 }}>
                <strong>Étape 1 :</strong> Sélectionne <strong>8 valeurs</strong> qui résonnent le plus avec toi. ({selected.length}/8 sélectionnées)
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', marginBottom: '1rem' }}>
                {VALEURS.map(v => {
                  const isSelected = selected.includes(v.id);
                  const isDisabled = !isSelected && selected.length >= 8;
                  return (
                    <button key={v.id} onClick={() => toggleValeur(v.id)} disabled={isDisabled}
                      style={{
                        background: isSelected ? `${v.color}22` : 'white',
                        border: `2px solid ${isSelected ? v.color : C.pale}`,
                        borderRadius: 12, padding: '.7rem',
                        textAlign: 'left', cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.4 : 1, fontFamily: 'inherit',
                        transition: 'all .15s',
                      }}>
                      <div style={{ fontSize: '1.2rem', marginBottom: '.2rem' }}>{v.emoji}</div>
                      <div style={{ fontSize: '.78rem', fontWeight: 700, color: isSelected ? v.color : C.texte }}>{v.label}</div>
                      <div style={{ fontSize: '.65rem', color: C.gris, lineHeight: 1.3, marginTop: '.2rem' }}>{v.desc}</div>
                      {isSelected && <div style={{ marginTop: '.3rem', fontSize: '.65rem', color: v.color, fontWeight: 700 }}>✓ Sélectionnée</div>}
                    </button>
                  );
                })}
              </div>

              <button onClick={passerClassement} disabled={selected.length < 5}
                style={{ width: '100%', background: selected.length >= 5 ? C.brun : C.pale, color: selected.length >= 5 ? 'white' : C.gris, border: 'none', borderRadius: 12, padding: '.9rem', fontSize: '.88rem', fontWeight: 700, fontFamily: 'inherit', cursor: selected.length >= 5 ? 'pointer' : 'not-allowed' }}>
                {selected.length >= 5 ? `Classer mes ${selected.length} valeurs →` : `Sélectionne au moins 5 valeurs (${selected.length}/5)`}
              </button>
            </div>
          )}

          {step === 'classement' && (
            <div>
              <div style={{ background: `${C.or}15`, border: `1px solid ${C.or}44`, borderRadius: 12, padding: '1rem', marginBottom: '1rem', fontSize: '.75rem', color: C.texte, lineHeight: 1.6 }}>
                <strong>Étape 2 :</strong> Classe tes valeurs par ordre d'importance. La plus importante en premier avec les flèches ↑↓
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', marginBottom: '1rem' }}>
                {ranked.map((v, i) => (
                  <div key={v.id} style={{
                    background: 'white', border: `2px solid ${i < 5 ? v.color : C.pale}`,
                    borderRadius: 12, padding: '.7rem 1rem',
                    display: 'flex', alignItems: 'center', gap: '.7rem',
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: i < 5 ? v.color : C.pale,
                      color: i < 5 ? 'white' : C.gris,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '.75rem', fontWeight: 700, flexShrink: 0,
                    }}>{i + 1}</div>
                    <span style={{ fontSize: '1.1rem' }}>{v.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '.8rem', fontWeight: 700, color: i < 5 ? v.color : C.gris }}>{v.label}</div>
                      {i === 0 && <div style={{ fontSize: '.65rem', color: C.or }}>⭐ Valeur principale</div>}
                      {i < 5 && i > 0 && <div style={{ fontSize: '.65rem', color: C.gris }}>Top 5</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
                      <button onClick={() => moveUp(i)} disabled={i === 0}
                        style={{ background: C.pale, border: 'none', borderRadius: 6, width: 28, height: 28, cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1, fontSize: '.8rem' }}>↑</button>
                      <button onClick={() => moveDown(i)} disabled={i === ranked.length - 1}
                        style={{ background: C.pale, border: 'none', borderRadius: 6, width: 28, height: 28, cursor: i === ranked.length - 1 ? 'default' : 'pointer', opacity: i === ranked.length - 1 ? 0.3 : 1, fontSize: '.8rem' }}>↓</button>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={valider}
                style={{ width: '100%', background: C.brun, color: 'white', border: 'none', borderRadius: 12, padding: '.9rem', fontSize: '.88rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                ✨ Valider mon classement
              </button>
            </div>
          )}

          {step === 'result' && valeurPrincipale && (
            <div>
              {/* Valeur principale */}
              <div style={{ background: `linear-gradient(135deg, ${valeurPrincipale.color}22, white)`, border: `2px solid ${valeurPrincipale.color}44`, borderRadius: 16, padding: '1.5rem', marginBottom: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '.5rem' }}>{valeurPrincipale.emoji}</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.3rem', fontWeight: 600, color: valeurPrincipale.color }}>Ta valeur #1</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: C.brun, marginBottom: '.4rem' }}>{valeurPrincipale.label}</div>
                <div style={{ fontSize: '.78rem', color: C.texte, lineHeight: 1.6 }}>{valeurPrincipale.desc}</div>
              </div>

              {/* Top 5 */}
              <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: '1rem', border: `1px solid ${C.pale}` }}>
                <div style={{ fontSize: '.78rem', fontWeight: 700, color: C.brun, marginBottom: '.8rem' }}>🏆 Ton Top 5 de valeurs</div>
                {top5.map((v, i) => (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '.7rem', marginBottom: '.6rem' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: v.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.7rem', fontWeight: 700, flexShrink: 0 }}>{i+1}</div>
                    <span style={{ fontSize: '1rem' }}>{v.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '.8rem', fontWeight: 700, color: v.color }}>{v.label}</div>
                      <div style={{ fontSize: '.68rem', color: C.gris }}>{v.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Combo */}
              {comboDesc && (
                <div style={{ background: `${C.or}15`, border: `1px solid ${C.or}44`, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '.75rem', fontWeight: 700, color: C.brun, marginBottom: '.4rem' }}>✨ Ce que ça dit de toi</div>
                  <div style={{ fontSize: '.75rem', color: C.texte, lineHeight: 1.6 }}>{comboDesc}</div>
                </div>
              )}

              {/* Business alignment */}
              <div style={{ background: `${C.brun}11`, border: `1px solid ${C.brun}22`, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '.75rem', fontWeight: 700, color: C.brun, marginBottom: '.4rem' }}>🔥 Aligner ton business avec tes valeurs</div>
                <div style={{ fontSize: '.75rem', color: C.texte, lineHeight: 1.6 }}>
                  Ton business Mihi devrait te permettre d'exprimer {top5.slice(0,3).map(v=>v.label).join(', ')}. 
                  Si tu te sens décalée, c'est peut-être que tu as perdu de vue ces valeurs dans ton quotidien.
                  Rappelle-toi pourquoi tu as commencé.
                </div>
              </div>

              <button onClick={recommencer}
                style={{ width: '100%', background: 'white', color: C.brun, border: `1.5px solid ${C.brun}`, borderRadius: 12, padding: '.9rem', fontSize: '.88rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                🔄 Refaire le test
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'historique' && (
        <div style={{ padding: '1rem' }}>
          {historique.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: C.gris }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '.7rem' }}>💎</div>
              <div style={{ fontSize: '.85rem', fontWeight: 600, color: C.brun }}>Aucun test encore</div>
            </div>
          ) : (
            historique.map((entry, i) => (
              <div key={i} style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: '.8rem', border: `1px solid ${C.pale}` }}>
                <div style={{ fontSize: '.78rem', color: C.gris, marginBottom: '.6rem' }}>📅 {entry.date}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
                  {entry.top5.map((id, j) => {
                    const v = VALEURS.find(val => val.id === id);
                    if (!v) return null;
                    return (
                      <div key={id} style={{ background: `${v.color}15`, border: `1px solid ${v.color}44`, borderRadius: 20, padding: '.25rem .6rem', fontSize: '.7rem', color: v.color, fontWeight: j === 0 ? 700 : 400 }}>
                        {v.emoji} {j === 0 ? '⭐ ' : ''}{v.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
