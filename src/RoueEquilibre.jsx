import { useState, useEffect, useRef } from 'react';

const DOMAINES = [
  { id: 'sante', label: 'Santé & Bien-être', emoji: '💚', color: '#4CAF50' },
  { id: 'famille', label: 'Famille & Proches', emoji: '👨‍👩‍👧', color: '#E91E8C' },
  { id: 'finances', label: 'Finances', emoji: '💰', color: '#C4A962' },
  { id: 'business', label: 'Business & Carrière', emoji: '🔥', color: '#FF6B35' },
  { id: 'epanouissement', label: 'Épanouissement', emoji: '✨', color: '#9575CD' },
  { id: 'relations', label: 'Relations sociales', emoji: '🤝', color: '#29B6F6' },
  { id: 'developpement', label: 'Développement perso', emoji: '🌱', color: '#66BB6A' },
  { id: 'loisirs', label: 'Loisirs & Plaisir', emoji: '🎯', color: '#FF8A65' },
];

const C = {
  brun: '#5A3829', or: '#C4A962', creme: '#FAF7F2', pale: '#EDE8E0',
  texte: '#2D1F1F', gris: '#9A8C8C', blanc: '#FFFFFF', rose: '#C9A0A0',
};

function RoueCanvas({ scores }) {
  const canvasRef = useRef(null);
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 20;
  const n = DOMAINES.length;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    // Grille
    for (let ring = 1; ring <= 10; ring++) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const r = (ring / 10) * maxR;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = ring === 10 ? '#C4A96244' : '#EDE8E033';
      ctx.lineWidth = ring === 10 ? 1.5 : 0.8;
      ctx.stroke();
    }

    // Rayons
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
      ctx.strokeStyle = '#EDE8E044';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Zone colorée
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const score = scores[DOMAINES[i].id] || 0;
      const r = (score / 10) * maxR;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = C.or + '33';
    ctx.fill();
    ctx.strokeStyle = C.or;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Points
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const score = scores[DOMAINES[i].id] || 0;
      const r = (score / 10) * maxR;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = DOMAINES[i].color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Labels
    ctx.font = '10px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const r = maxR + 14;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r + 4;
      ctx.fillStyle = C.texte;
      ctx.fillText(DOMAINES[i].emoji, x, y);
    }
  }, [scores]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ display: 'block', margin: '0 auto' }} />;
}

export default function RoueEquilibre() {
  const [scores, setScores] = useState(() => {
    const s = {};
    DOMAINES.forEach(d => s[d.id] = 5);
    return s;
  });
  const [step, setStep] = useState('fill'); // fill | result
  const [historique, setHistorique] = useState(() => {
    try { return JSON.parse(localStorage.getItem('roue_historique') || '[]'); } catch { return []; }
  });
  const [activeTab, setActiveTab] = useState('roue'); // roue | historique

  const moyenne = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / DOMAINES.length * 10) / 10;

  const sauvegarder = () => {
    const entry = { date: new Date().toLocaleDateString('fr-FR'), scores: { ...scores }, moyenne };
    const next = [entry, ...historique].slice(0, 12);
    setHistorique(next);
    localStorage.setItem('roue_historique', JSON.stringify(next));
    setStep('result');
  };

  const recommencer = () => {
    const s = {};
    DOMAINES.forEach(d => s[d.id] = 5);
    setScores(s);
    setStep('fill');
  };

  const domainesTriés = [...DOMAINES].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", maxWidth: 480, margin: '0 auto', padding: '0 0 3rem', background: C.creme, minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.brun}, #3D2020)`, padding: '1.5rem 1rem', textAlign: 'center', color: 'white' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.4rem', fontWeight: 600 }}>🎯 Ma Roue de l'Équilibre</div>
        <div style={{ fontSize: '.78rem', opacity: .8, marginTop: '.3rem' }}>Évalue ton équilibre de vie · Historique</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '.5rem', padding: '.8rem 1rem', background: 'white', borderBottom: `1px solid ${C.pale}` }}>
        {[{ id: 'roue', label: '🎯 Évaluation' }, { id: 'historique', label: '📊 Historique' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ flex: 1, padding: '.5rem', borderRadius: 10, border: 'none', background: activeTab === t.id ? C.brun : C.pale, color: activeTab === t.id ? 'white' : C.gris, fontFamily: 'inherit', fontSize: '.78rem', fontWeight: activeTab === t.id ? 700 : 400, cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'roue' && (
        <div style={{ padding: '1rem' }}>

          {/* Roue */}
          <div style={{ background: 'white', borderRadius: 16, padding: '1rem', marginBottom: '1rem', border: `1px solid ${C.pale}` }}>
            <RoueCanvas scores={scores} />
            <div style={{ textAlign: 'center', marginTop: '.5rem' }}>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: '1.8rem', fontWeight: 700, color: C.or }}>{moyenne}</span>
              <span style={{ fontSize: '.75rem', color: C.gris }}> / 10</span>
              <div style={{ fontSize: '.7rem', color: C.gris, marginTop: '.2rem' }}>Score moyen</div>
            </div>
          </div>

          {/* Sliders */}
          {step === 'fill' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem', marginBottom: '1rem' }}>
                {DOMAINES.map(d => (
                  <div key={d.id} style={{ background: 'white', borderRadius: 12, padding: '.8rem 1rem', border: `1px solid ${C.pale}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.4rem' }}>
                      <div style={{ fontSize: '.82rem', fontWeight: 600, color: C.texte }}>{d.emoji} {d.label}</div>
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.1rem', fontWeight: 700, color: d.color }}>{scores[d.id]}</div>
                    </div>
                    <input type="range" min={0} max={10} step={1} value={scores[d.id]}
                      onChange={e => setScores(s => ({ ...s, [d.id]: parseInt(e.target.value) }))}
                      style={{ width: '100%', accentColor: d.color }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.6rem', color: C.gris }}>
                      <span>0</span><span>5</span><span>10</span>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={sauvegarder}
                style={{ width: '100%', background: C.brun, color: 'white', border: 'none', borderRadius: 12, padding: '.9rem', fontSize: '.88rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                ✨ Sauvegarder mon évaluation
              </button>
            </>
          )}

          {step === 'result' && (
            <>
              <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: '1rem', border: `1px solid ${C.pale}` }}>
                <div style={{ fontSize: '.78rem', fontWeight: 700, color: C.brun, marginBottom: '.8rem' }}>📊 Tes résultats</div>
                {domainesTriés.map((d, i) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '.8rem', marginBottom: '.5rem' }}>
                    <div style={{ fontSize: '.75rem', width: 20, color: i < 3 ? C.or : C.gris, fontWeight: 700 }}>{i + 1}</div>
                    <div style={{ fontSize: '.78rem', flex: 1, color: C.texte }}>{d.emoji} {d.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                      <div style={{ width: 60, height: 6, background: C.pale, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${(scores[d.id] / 10) * 100}%`, height: '100%', background: d.color, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: '.75rem', fontWeight: 700, color: d.color, minWidth: 20 }}>{scores[d.id]}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Analyse */}
              <div style={{ background: `${C.or}15`, border: `1px solid ${C.or}44`, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '.78rem', fontWeight: 700, color: C.brun, marginBottom: '.5rem' }}>💡 Analyse</div>
                <div style={{ fontSize: '.75rem', color: C.texte, lineHeight: 1.6 }}>
                  {moyenne >= 7 ? '🌟 Excellent équilibre ! Tu gères bien les différents aspects de ta vie.' :
                   moyenne >= 5 ? '✨ Bon début ! Quelques domaines méritent ton attention.' :
                   '🌱 Il y a de beaux progrès à faire. Commence par le domaine qui te tient le plus à cœur.'}
                  {' '}Le domaine le plus fort : <strong>{domainesTriés[0].emoji} {domainesTriés[0].label}</strong>
                  {'. '}À renforcer : <strong>{domainesTriés[domainesTriés.length - 1].emoji} {domainesTriés[domainesTriés.length - 1].label}</strong>.
                </div>
              </div>

              <button onClick={recommencer}
                style={{ width: '100%', background: 'white', color: C.brun, border: `1.5px solid ${C.brun}`, borderRadius: 12, padding: '.9rem', fontSize: '.88rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                🔄 Nouvelle évaluation
              </button>
            </>
          )}
        </div>
      )}

      {activeTab === 'historique' && (
        <div style={{ padding: '1rem' }}>
          {historique.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: C.gris }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '.7rem' }}>📊</div>
              <div style={{ fontSize: '.85rem', fontWeight: 600, color: C.brun, marginBottom: '.3rem' }}>Aucune évaluation encore</div>
              <div style={{ fontSize: '.75rem' }}>Complète ta première roue pour voir ton historique</div>
            </div>
          ) : (
            historique.map((entry, i) => (
              <div key={i} style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: '.8rem', border: `1px solid ${C.pale}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.8rem' }}>
                  <div style={{ fontSize: '.8rem', fontWeight: 700, color: C.brun }}>📅 {entry.date}</div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.2rem', fontWeight: 700, color: C.or }}>{entry.moyenne}/10</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.3rem' }}>
                  {DOMAINES.map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                      <span style={{ fontSize: '.7rem' }}>{d.emoji}</span>
                      <div style={{ flex: 1, height: 4, background: C.pale, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${((entry.scores[d.id] || 0) / 10) * 100}%`, height: '100%', background: d.color, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: '.65rem', color: C.gris, minWidth: 14 }}>{entry.scores[d.id] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
