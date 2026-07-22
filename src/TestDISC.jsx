import { useState } from 'react';

const C = {
  brun: '#5A3829', or: '#C4A962', creme: '#FAF7F2', pale: '#EDE8E0',
  texte: '#2D1F1F', gris: '#9A8C8C', blanc: '#FFFFFF',
};

const PROFILS = {
  D: {
    nom: 'Dominant',
    couleur: '#E74C3C',
    emoji: '🔴',
    titre: 'La Leader Déterminée',
    desc: 'Tu es directe, ambitieuse et orientée résultats. Tu prends des décisions rapidement et tu aimes être aux commandes. Tu n\'as pas peur des défis — tu les cherches.',
    forces: ['Leadership naturel', 'Prise de décision rapide', 'Orientation résultats', 'Courage et audace'],
    defis: ['Impatience', 'Peut sembler autoritaire', 'Écoute à développer'],
    business: 'Tu es faite pour recruter et fixer des objectifs ambitieux. Ton énergie inspire ton équipe. Attention à laisser de la place aux autres.',
    communication: 'Sois directe et concise. Tes clientes apprécient la franchise. Va droit au but sans trop de détails.',
  },
  I: {
    nom: 'Influente',
    couleur: '#F39C12',
    emoji: '🟡',
    titre: 'L\'Enthousiaste Créative',
    desc: 'Tu es rayonnante, enthousiaste et tu as le don de convaincre. Les gens sont naturellement attirés par ton énergie. Tu adores les interactions sociales et tu es la reine des réseaux sociaux.',
    forces: ['Communication naturelle', 'Créativité', 'Enthousiasme contagieux', 'Réseau social solide'],
    defis: ['Organisation à améliorer', 'Peut s\'éparpiller', 'Suivi des détails'],
    business: 'Tu es excellente pour vendre et recruter grâce à ta personnalité magnétique. Tes stories et reels cartonnent. Travaille l\'organisation et le suivi.',
    communication: 'Tes clientes aiment ton énergie et ta chaleur. Partage des histoires, des émotions. Sois authentique et spontanée.',
  },
  S: {
    nom: 'Stable',
    couleur: '#27AE60',
    emoji: '🟢',
    titre: 'La Bienveillante Fidèle',
    desc: 'Tu es loyale, empathique et tu crées des liens profonds. Tu es la colonne vertébrale de ton équipe. Les gens te font confiance naturellement et se confient à toi.',
    forces: ['Empathie profonde', 'Loyauté', 'Patience', 'Écoute active'],
    defis: ['Difficulté à dire non', 'Peut éviter les conflits', 'Changement difficile'],
    business: 'Tu es excellente pour fidéliser les clientes et soutenir ton équipe. Travaille ta confiance pour proposer tes produits sans hésiter.',
    communication: 'Tes clientes apprécient ta douceur et ton soutien. Prends le temps d\'écouter avant de proposer. La relation prime sur la vente.',
  },
  C: {
    nom: 'Consciencieux',
    couleur: '#3498DB',
    emoji: '🔵',
    titre: 'L\'Experte Analytique',
    desc: 'Tu es précise, organisée et tu aimes avoir toutes les informations avant d\'agir. Tu es la référence qualité de ton équipe. Tes clientes te font confiance car tu connais tes produits sur le bout des doigts.',
    forces: ['Rigueur et précision', 'Expertise produits', 'Organisation', 'Fiabilité'],
    defis: ['Peut trop analyser', 'Perfectionnisme', 'Décisions lentes'],
    business: 'Tu es parfaite pour former et créer du contenu expert. Tes diagnostics sont redoutables. Travaille à passer à l\'action même sans avoir tout vérifié.',
    communication: 'Tes clientes apprécient ta précision et tes conseils basés sur des faits. Donne des données, des preuves. Évite de les noyer dans les détails.',
  },
};

const QUESTIONS = [
  {
    id: 1,
    question: 'Quand tu dois prendre une décision importante, tu :',
    options: [
      { text: 'Décides vite et assumes les conséquences', profil: 'D', score: 3 },
      { text: 'En parles à tout le monde et suit ton instinct', profil: 'I', score: 3 },
      { text: 'Prends ton temps et consultes les personnes de confiance', profil: 'S', score: 3 },
      { text: 'Analyses toutes les données disponibles avant d\'agir', profil: 'C', score: 3 },
    ],
  },
  {
    id: 2,
    question: 'Dans ton équipe, tu es surtout connue pour :',
    options: [
      { text: 'Fixer des objectifs ambitieux et pousser tout le monde', profil: 'D', score: 3 },
      { text: 'Motiver et créer une super ambiance', profil: 'I', score: 3 },
      { text: 'Être toujours là pour soutenir et écouter', profil: 'S', score: 3 },
      { text: 'Avoir les bonnes informations et être fiable', profil: 'C', score: 3 },
    ],
  },
  {
    id: 3,
    question: 'Face à un conflit avec une cliente ou une recrue, tu :',
    options: [
      { text: 'Dis ce que tu penses directement sans détour', profil: 'D', score: 3 },
      { text: 'Essaies de détendre l\'atmosphère et trouver un terrain commun', profil: 'I', score: 3 },
      { text: 'Préfères éviter le conflit et trouver un compromis', profil: 'S', score: 3 },
      { text: 'Analyses la situation objectivement et proposes une solution logique', profil: 'C', score: 3 },
    ],
  },
  {
    id: 4,
    question: 'Ta force principale dans la vente Mihi, c\'est :',
    options: [
      { text: 'Conclure rapidement et ne pas laisser une opportunité passer', profil: 'D', score: 3 },
      { text: 'Créer une connexion émotionnelle et rendre le produit désirable', profil: 'I', score: 3 },
      { text: 'Établir une relation de confiance sur le long terme', profil: 'S', score: 3 },
      { text: 'Expliquer en détail les bénéfices et ingrédients du produit', profil: 'C', score: 3 },
    ],
  },
  {
    id: 5,
    question: 'Ce qui te motive le plus dans ton business :',
    options: [
      { text: 'Atteindre des records et être la meilleure', profil: 'D', score: 3 },
      { text: 'Être reconnue, appréciée et créer du lien', profil: 'I', score: 3 },
      { text: 'Aider les autres et contribuer à quelque chose de beau', profil: 'S', score: 3 },
      { text: 'Maîtriser les produits et être une vraie experte', profil: 'C', score: 3 },
    ],
  },
  {
    id: 6,
    question: 'Sur les réseaux sociaux, tu postes plutôt :',
    options: [
      { text: 'Des défis, des objectifs, des résultats concrets', profil: 'D', score: 3 },
      { text: 'Des histoires fun, des coulisses, du lifestyle', profil: 'I', score: 3 },
      { text: 'Des moments authentiques et du contenu qui touche les gens', profil: 'S', score: 3 },
      { text: 'Des analyses, des comparatifs, des conseils experts', profil: 'C', score: 3 },
    ],
  },
  {
    id: 7,
    question: 'Quand quelque chose ne va pas dans ton business :',
    options: [
      { text: 'Tu changes de stratégie immédiatement et tu passes à l\'action', profil: 'D', score: 3 },
      { text: 'Tu en parles à ton équipe et tu cherches du soutien moral', profil: 'I', score: 3 },
      { text: 'Tu prends le temps de comprendre et tu gardes ton calme', profil: 'S', score: 3 },
      { text: 'Tu analyses ce qui s\'est passé et tu cherches la cause précise', profil: 'C', score: 3 },
    ],
  },
  {
    id: 8,
    question: 'Ta cliente idéale, tu la gères comment ?',
    options: [
      { text: 'Efficacement et rapidement — pas de temps à perdre', profil: 'D', score: 3 },
      { text: 'Avec beaucoup d\'enthousiasme et de personnalité', profil: 'I', score: 3 },
      { text: 'Avec patience, en prenant soin de ses besoins profonds', profil: 'S', score: 3 },
      { text: 'Avec des conseils précis et personnalisés basés sur ses besoins', profil: 'C', score: 3 },
    ],
  },
  {
    id: 9,
    question: 'Dans une réunion d\'équipe, tu :',
    options: [
      { text: 'Prends les commandes et orientes les discussions', profil: 'D', score: 3 },
      { text: 'Animes, plaisantes et gardes tout le monde engagé', profil: 'I', score: 3 },
      { text: 'Écoutes attentivement et soutiens les décisions du groupe', profil: 'S', score: 3 },
      { text: 'Poses des questions précises et vérifie que tout est bien cadré', profil: 'C', score: 3 },
    ],
  },
  {
    id: 10,
    question: 'Ce que les autres disent souvent de toi :',
    options: [
      { text: '"Elle va toujours de l\'avant, rien ne l\'arrête"', profil: 'D', score: 3 },
      { text: '"Elle est tellement fun et positive, j\'adore son énergie"', profil: 'I', score: 3 },
      { text: '"On peut toujours compter sur elle, elle est tellement douce"', profil: 'S', score: 3 },
      { text: '"Elle sait vraiment de quoi elle parle, c\'est une experte"', profil: 'C', score: 3 },
    ],
  },
];

function shuffleOptions(options) {
  return [...options].sort(() => Math.random() - 0.5);
}

export default function TestDISC() {
  const [step, setStep] = useState('intro'); // intro | quiz | result
  const [current, setCurrent] = useState(0);
  const [scores, setScores] = useState({ D: 0, I: 0, S: 0, C: 0 });
  const [shuffled] = useState(() => QUESTIONS.map(q => ({ ...q, options: shuffleOptions(q.options) })));
  const [historique, setHistorique] = useState(() => {
    try { return JSON.parse(localStorage.getItem('disc_historique') || '[]'); } catch { return []; }
  });
  const [activeTab, setActiveTab] = useState('test');

  const repondre = (option) => {
    const next = { ...scores, [option.profil]: scores[option.profil] + option.score };
    setScores(next);
    if (current + 1 < shuffled.length) {
      setCurrent(current + 1);
    } else {
      // Calculer le profil dominant
      const profilDominant = Object.entries(next).sort((a, b) => b[1] - a[1])[0][0];
      const entry = { date: new Date().toLocaleDateString('fr-FR'), profil: profilDominant, scores: next };
      const hist = [entry, ...historique].slice(0, 6);
      setHistorique(hist);
      localStorage.setItem('disc_historique', JSON.stringify(hist));
      setStep('result');
    }
  };

  const recommencer = () => {
    setScores({ D: 0, I: 0, S: 0, C: 0 });
    setCurrent(0);
    setStep('intro');
  };

  const profilDominant = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  const profil = PROFILS[profilDominant];
  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1;

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", maxWidth: 480, margin: '0 auto', background: C.creme, minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.brun}, #3D2020)`, padding: '1.5rem 1rem', textAlign: 'center', color: 'white' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.4rem', fontWeight: 600 }}>🎨 Test DISC</div>
        <div style={{ fontSize: '.78rem', opacity: .8, marginTop: '.3rem' }}>Découvre ton profil de personnalité</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '.5rem', padding: '.8rem 1rem', background: 'white', borderBottom: `1px solid ${C.pale}` }}>
        {[{ id: 'test', label: '🎨 Test' }, { id: 'historique', label: '📊 Historique' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ flex: 1, padding: '.5rem', borderRadius: 10, border: 'none', background: activeTab === t.id ? C.brun : C.pale, color: activeTab === t.id ? 'white' : C.gris, fontFamily: 'inherit', fontSize: '.78rem', fontWeight: activeTab === t.id ? 700 : 400, cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'test' && (
        <div style={{ padding: '1rem' }}>

          {step === 'intro' && (
            <div>
              {/* Présentation des 4 profils */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '.82rem', fontWeight: 700, color: C.brun, marginBottom: '.8rem', textAlign: 'center' }}>
                  Quel est ton profil de personnalité ?
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.6rem', marginBottom: '1rem' }}>
                  {Object.entries(PROFILS).map(([key, p]) => (
                    <div key={key} style={{ background: 'white', border: `2px solid ${p.couleur}22`, borderRadius: 12, padding: '.8rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '.3rem' }}>{p.emoji}</div>
                      <div style={{ fontSize: '.8rem', fontWeight: 700, color: p.couleur }}>{p.nom}</div>
                      <div style={{ fontSize: '.68rem', color: C.gris, marginTop: '.2rem' }}>{p.titre}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: `${C.or}15`, border: `1px solid ${C.or}44`, borderRadius: 12, padding: '1rem', marginBottom: '1rem', fontSize: '.75rem', color: C.texte, lineHeight: 1.6 }}>
                  <strong>10 questions</strong> pour identifier ton profil dominant. Réponds instinctivement, il n'y a pas de bonne ou mauvaise réponse !
                </div>
              </div>
              <button onClick={() => setStep('quiz')}
                style={{ width: '100%', background: C.brun, color: 'white', border: 'none', borderRadius: 12, padding: '.9rem', fontSize: '.88rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                🎨 Commencer le test
              </button>
            </div>
          )}

          {step === 'quiz' && (
            <div>
              {/* Progress */}
              <div style={{ background: 'white', borderRadius: 12, padding: '.8rem 1rem', marginBottom: '1rem', border: `1px solid ${C.pale}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.4rem' }}>
                  <span style={{ fontSize: '.72rem', color: C.gris }}>Question {current + 1} / {shuffled.length}</span>
                  <span style={{ fontSize: '.72rem', color: C.or, fontWeight: 700 }}>{Math.round(((current) / shuffled.length) * 100)}%</span>
                </div>
                <div style={{ height: 4, background: C.pale, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${(current / shuffled.length) * 100}%`, height: '100%', background: C.or, borderRadius: 2, transition: 'width .3s' }} />
                </div>
              </div>

              <div style={{ background: 'white', borderRadius: 16, padding: '1.2rem', marginBottom: '1rem', border: `1px solid ${C.pale}` }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '1rem', color: C.brun, lineHeight: 1.5, marginBottom: '1.2rem', textAlign: 'center' }}>
                  {shuffled[current].question}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                  {shuffled[current].options.map((opt, i) => (
                    <button key={i} onClick={() => repondre(opt)}
                      style={{ background: C.creme, border: `1.5px solid ${C.pale}`, borderRadius: 10, padding: '.75rem 1rem', textAlign: 'left', fontSize: '.8rem', color: C.texte, fontFamily: 'inherit', cursor: 'pointer', lineHeight: 1.5, transition: 'all .15s' }}
                      onMouseEnter={e => { e.target.style.borderColor = C.or; e.target.style.background = `${C.or}10`; }}
                      onMouseLeave={e => { e.target.style.borderColor = C.pale; e.target.style.background = C.creme; }}>
                      {opt.text}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'result' && (
            <div>
              {/* Profil dominant */}
              <div style={{ background: `linear-gradient(135deg, ${profil.couleur}22, white)`, border: `2px solid ${profil.couleur}44`, borderRadius: 16, padding: '1.2rem', marginBottom: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '.5rem' }}>{profil.emoji}</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.3rem', fontWeight: 600, color: profil.couleur }}>{profil.nom}</div>
                <div style={{ fontSize: '.82rem', color: C.gris, marginBottom: '.8rem' }}>{profil.titre}</div>
                <div style={{ fontSize: '.78rem', color: C.texte, lineHeight: 1.6 }}>{profil.desc}</div>
              </div>

              {/* Scores */}
              <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: '1rem', border: `1px solid ${C.pale}` }}>
                <div style={{ fontSize: '.78rem', fontWeight: 700, color: C.brun, marginBottom: '.8rem' }}>📊 Ton mix DISC</div>
                {Object.entries(PROFILS).map(([key, p]) => (
                  <div key={key} style={{ marginBottom: '.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.2rem' }}>
                      <span style={{ fontSize: '.75rem', color: C.texte }}>{p.emoji} {p.nom}</span>
                      <span style={{ fontSize: '.75rem', fontWeight: 700, color: p.couleur }}>{Math.round((scores[key] / total) * 100)}%</span>
                    </div>
                    <div style={{ height: 6, background: C.pale, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${(scores[key] / total) * 100}%`, height: '100%', background: p.couleur, borderRadius: 3, transition: 'width .5s' }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Forces & Défis */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.6rem', marginBottom: '1rem' }}>
                <div style={{ background: '#E8F5E9', borderRadius: 12, padding: '.8rem' }}>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#2D7A4F', marginBottom: '.5rem' }}>💪 Tes forces</div>
                  {profil.forces.map((f, i) => <div key={i} style={{ fontSize: '.7rem', color: C.texte, marginBottom: '.25rem' }}>✓ {f}</div>)}
                </div>
                <div style={{ background: '#FFF3E0', borderRadius: 12, padding: '.8rem' }}>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#E65100', marginBottom: '.5rem' }}>🎯 À travailler</div>
                  {profil.defis.map((d, i) => <div key={i} style={{ fontSize: '.7rem', color: C.texte, marginBottom: '.25rem' }}>→ {d}</div>)}
                </div>
              </div>

              {/* Business */}
              <div style={{ background: `${C.brun}11`, border: `1px solid ${C.brun}22`, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '.75rem', fontWeight: 700, color: C.brun, marginBottom: '.4rem' }}>🔥 Ton style business Mihi</div>
                <div style={{ fontSize: '.75rem', color: C.texte, lineHeight: 1.6 }}>{profil.business}</div>
              </div>

              {/* Communication */}
              <div style={{ background: `${C.or}11`, border: `1px solid ${C.or}33`, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '.75rem', fontWeight: 700, color: C.brun, marginBottom: '.4rem' }}>💬 Comment communiquer avec tes clientes</div>
                <div style={{ fontSize: '.75rem', color: C.texte, lineHeight: 1.6 }}>{profil.communication}</div>
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
              <div style={{ fontSize: '2.5rem', marginBottom: '.7rem' }}>🎨</div>
              <div style={{ fontSize: '.85rem', fontWeight: 600, color: C.brun, marginBottom: '.3rem' }}>Aucun test encore</div>
              <div style={{ fontSize: '.75rem' }}>Complète ton premier test DISC</div>
            </div>
          ) : (
            historique.map((entry, i) => {
              const p = PROFILS[entry.profil];
              return (
                <div key={i} style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: '.8rem', border: `2px solid ${p.couleur}33` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
                    <div style={{ fontSize: '.8rem', color: C.gris }}>📅 {entry.date}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                      <span style={{ fontSize: '1rem' }}>{p.emoji}</span>
                      <span style={{ fontSize: '.8rem', fontWeight: 700, color: p.couleur }}>{p.nom}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '.4rem' }}>
                    {Object.entries(PROFILS).map(([key, pr]) => (
                      <div key={key} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '.65rem', color: pr.couleur, fontWeight: 700 }}>{key}</div>
                        <div style={{ height: 30, background: C.pale, borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
                          <div style={{ width: '100%', height: `${((entry.scores[key] || 0) / (Object.values(entry.scores).reduce((a,b)=>a+b,1))) * 100}%`, background: pr.couleur }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
