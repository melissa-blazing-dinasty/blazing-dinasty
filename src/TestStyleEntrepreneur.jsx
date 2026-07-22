import { useState } from 'react';

const C = {
  brun: '#5A3829', or: '#C4A962', creme: '#FAF7F2', pale: '#EDE8E0',
  texte: '#2D1F1F', gris: '#9A8C8C', blanc: '#FFFFFF',
};

const STYLES = {
  visionnaire: {
    nom: 'La Visionnaire',
    emoji: '🚀',
    couleur: '#7E57C2',
    desc: 'Tu vois grand, tu penses stratégie et tu inspires les autres avec ta vision du futur. Tu es toujours en train d\'imaginer la prochaine étape.',
    forces: ['Vision à long terme', 'Inspiration naturelle', 'Innovation', 'Capacité à motiver'],
    defis: ['Peut manquer de structure', 'Difficile de finir ce qu\'elle commence', 'Besoin d\'une opératrice à ses côtés'],
    business: 'Tu es faite pour fixer la direction de ton équipe et créer du contenu inspirant. Tu brilles en recrutement et en présentation de l\'opportunité Mihi.',
    conseil: 'Entoure-toi de personnes organisées qui peuvent concrétiser tes idées. Toi tu traces la route, laisse les autres gérer les détails.',
    stars: ['Oprah Winfrey', 'Marie Forleo', 'Sophia Amoruso'],
  },
  operatrice: {
    nom: 'L\'Opératrice',
    emoji: '⚙️',
    couleur: '#0097A7',
    desc: 'Tu es la reine de l\'exécution. Là où d\'autres rêvent, toi tu fais. Organisée, fiable, méthodique — tu transformes les idées en résultats concrets.',
    forces: ['Exécution impeccable', 'Organisation', 'Fiabilité', 'Gestion des systèmes'],
    defis: ['Peut être trop dans les détails', 'Résistance au changement rapide', 'A besoin de clarté sur la vision'],
    business: 'Tu es excellente pour créer des systèmes dans ton équipe, former tes recrues et assurer le suivi client. Tes process font ta force.',
    conseil: 'Travaille avec une visionnaire pour avoir une direction claire. Toi tu t\'occupes de rendre les choses possibles et efficaces.',
    stars: ['Sheryl Sandberg', 'Indra Nooyi'],
  },
  connectrice: {
    nom: 'La Connectrice',
    emoji: '🤝',
    couleur: '#E91E8C',
    desc: 'Tu es une magicienne des relations humaines. Tu sais qui est qui, tu fais les bonnes introductions et tu crées des communautés soudées autour de toi.',
    forces: ['Réseau puissant', 'Intelligence émotionnelle', 'Communauté', 'Confiance naturelle'],
    defis: ['Peut mettre les relations avant les résultats', 'Difficile de rester concentrée sur les priorités', 'Peut tout faire pour tout le monde'],
    business: 'Tu es la reine du bouche-à-oreille et de la fidélisation. Tes clientes restent avec toi pour toujours. Le recrutement se fait naturellement dans ton entourage.',
    conseil: 'Capitalise sur ta communauté. Crée un groupe, anime, fédère. Les gens achètent À TOI avant d\'acheter le produit.',
    stars: ['Brené Brown', 'Arianna Huffington'],
  },
  creatrice: {
    nom: 'La Créatrice',
    emoji: '🎨',
    couleur: '#FF6B35',
    desc: 'Tu transformes tout en art. Tes visuels, tes vidéos, tes mots — tout a une signature unique. Tu crées du contenu qui marque et qui reste.',
    forces: ['Contenu unique et mémorable', 'Esthétique forte', 'Storytelling puissant', 'Personal branding'],
    defis: ['Peut passer trop de temps à créer vs vendre', 'Perfectionnisme parfois bloquant', 'A besoin d\'être vue pour se sentir légitime'],
    business: 'Tes réseaux sociaux sont ton terrain de jeu. Tes diagnostics et ordonnances sont de vraies oeuvres. Tu as un avantage énorme en marketing de contenu.',
    conseil: 'Mets ta créativité au service des ventes. Un beau contenu qui ne convertit pas ne sert à rien. Ajoute des CTAs clairs à chaque création.',
    stars: ['Virginie Efira', 'Léa Seydoux', 'Chimamanda Ngozi Adichie'],
  },
};

const QUESTIONS = [
  {
    id: 1,
    question: 'Quand tu imagines ton business dans 3 ans, tu vois :',
    options: [
      { text: 'Une équipe de 50+ personnes qui suit ta vision et change des vies', style: 'visionnaire', score: 3 },
      { text: 'Un système parfaitement huilé qui tourne tout seul avec des process clairs', style: 'operatrice', score: 3 },
      { text: 'Une communauté de femmes soudées qui s\'entraident et se recommandent', style: 'connectrice', score: 3 },
      { text: 'Une marque personnelle forte reconnue partout sur les réseaux', style: 'creatrice', score: 3 },
    ],
  },
  {
    id: 2,
    question: 'Ce que tu fais le mieux dans ton business :',
    options: [
      { text: 'Inspirer et donner une direction claire à mon équipe', style: 'visionnaire', score: 3 },
      { text: 'Mettre en place des systèmes et assurer le suivi', style: 'operatrice', score: 3 },
      { text: 'Créer des liens et faire se rencontrer les bonnes personnes', style: 'connectrice', score: 3 },
      { text: 'Créer du contenu qui attire et engage les gens', style: 'creatrice', score: 3 },
    ],
  },
  {
    id: 3,
    question: 'Quand tu recrutes une nouvelle distributrice, tu mises sur :',
    options: [
      { text: 'Ta vision et les possibilités infinies qu\'offre cette opportunité', style: 'visionnaire', score: 3 },
      { text: 'La structure solide, les outils et la formation que tu offres', style: 'operatrice', score: 3 },
      { text: 'L\'ambiance de l\'équipe et les relations humaines belles que vous créez', style: 'connectrice', score: 3 },
      { text: 'Ton histoire personnelle et le contenu authentique que tu partages', style: 'creatrice', score: 3 },
    ],
  },
  {
    id: 4,
    question: 'Ta matinée type quand tu travailles sur ton business :',
    options: [
      { text: 'Tu planifies ta stratégie des prochains mois et fixes des objectifs ambitieux', style: 'visionnaire', score: 3 },
      { text: 'Tu checkes tes indicateurs, tes suivis et organises ta to-do list', style: 'operatrice', score: 3 },
      { text: 'Tu réponds aux messages, prends des nouvelles de tes recrues et clientes', style: 'connectrice', score: 3 },
      { text: 'Tu filmes, tu écris, tu crées du contenu pour tes réseaux', style: 'creatrice', score: 3 },
    ],
  },
  {
    id: 5,
    question: 'Ce qui te frustre le plus dans ton business :',
    options: [
      { text: 'Quand les gens ne comprennent pas la vision et ne s\'engagent pas vraiment', style: 'visionnaire', score: 3 },
      { text: 'Quand il n\'y a pas de process clairs et que tout est désorganisé', style: 'operatrice', score: 3 },
      { text: 'Quand les gens ne maintiennent pas le lien et disparaissent', style: 'connectrice', score: 3 },
      { text: 'Quand ton travail créatif n\'est pas vu et reconnu à sa juste valeur', style: 'creatrice', score: 3 },
    ],
  },
  {
    id: 6,
    question: 'Dans une collaboration avec une autre distributrice, tu apportes :',
    options: [
      { text: 'L\'idée, la stratégie et l\'élan pour aller loin', style: 'visionnaire', score: 3 },
      { text: 'L\'organisation, le planning et la rigueur pour que ça tienne', style: 'operatrice', score: 3 },
      { text: 'Le réseau, les introductions et la chaleur humaine', style: 'connectrice', score: 3 },
      { text: 'Les visuels, les textes et tout ce qui rend le projet beau', style: 'creatrice', score: 3 },
    ],
  },
  {
    id: 7,
    question: 'Quel outil tu utilises le plus dans ton business :',
    options: [
      { text: 'Un tableau de vision avec mes objectifs à long terme', style: 'visionnaire', score: 3 },
      { text: 'Un tableur ou une to-do list pour tout tracker', style: 'operatrice', score: 3 },
      { text: 'WhatsApp et les groupes pour rester connectée à tout le monde', style: 'connectrice', score: 3 },
      { text: 'Canva, CapCut ou tout ce qui me permet de créer du beau contenu', style: 'creatrice', score: 3 },
    ],
  },
  {
    id: 8,
    question: 'Quand une recrue stagne, tu :',
    options: [
      { text: 'La remets dans la vision et l\'ambition de ce qu\'elle peut accomplir', style: 'visionnaire', score: 3 },
      { text: 'Analyses avec elle ce qui ne fonctionne pas et crées un plan d\'action', style: 'operatrice', score: 3 },
      { text: 'Prends le temps de comprendre sa situation personnelle et l\'écoutes vraiment', style: 'connectrice', score: 3 },
      { text: 'Crées du contenu inspirant spécialement pour elle ou l\'équipe', style: 'creatrice', score: 3 },
    ],
  },
  {
    id: 9,
    question: 'Ton rêve ultime avec Mihi :',
    options: [
      { text: 'Devenir la distributrice N°1 en France et transformer l\'industrie', style: 'visionnaire', score: 3 },
      { text: 'Avoir un business qui tourne parfaitement même quand tu n\'es pas là', style: 'operatrice', score: 3 },
      { text: 'Créer une communauté de femmes qui changent leur vie grâce à toi', style: 'connectrice', score: 3 },
      { text: 'Avoir une marque personnelle si forte qu\'on vient à toi naturellement', style: 'creatrice', score: 3 },
    ],
  },
  {
    id: 10,
    question: 'Ce que les autres te disent souvent :',
    options: [
      { text: '"Tu as toujours des idées folles et tu nous emmènes ailleurs"', style: 'visionnaire', score: 3 },
      { text: '"On peut compter sur toi, tu es fiable et organisée"', style: 'operatrice', score: 3 },
      { text: '"Tu connais tout le monde et tu sais toujours qui peut aider qui"', style: 'connectrice', score: 3 },
      { text: '"Tout ce que tu crées est magnifique, tu as un vrai talent"', style: 'creatrice', score: 3 },
    ],
  },
];

export default function TestStyleEntrepreneur() {
  const [step, setStep] = useState('intro');
  const [current, setCurrent] = useState(0);
  const [scores, setScores] = useState({ visionnaire: 0, operatrice: 0, connectrice: 0, creatrice: 0 });
  const [historique, setHistorique] = useState(() => {
    try { return JSON.parse(localStorage.getItem('style_historique') || '[]'); } catch { return []; }
  });
  const [activeTab, setActiveTab] = useState('test');

  const repondre = (option) => {
    const next = { ...scores, [option.style]: scores[option.style] + option.score };
    setScores(next);
    if (current + 1 < QUESTIONS.length) {
      setCurrent(current + 1);
    } else {
      const styleDominant = Object.entries(next).sort((a, b) => b[1] - a[1])[0][0];
      const entry = { date: new Date().toLocaleDateString('fr-FR'), style: styleDominant, scores: next };
      const hist = [entry, ...historique].slice(0, 6);
      setHistorique(hist);
      localStorage.setItem('style_historique', JSON.stringify(hist));
      setStep('result');
    }
  };

  const recommencer = () => {
    setScores({ visionnaire: 0, operatrice: 0, connectrice: 0, creatrice: 0 });
    setCurrent(0);
    setStep('intro');
  };

  const styleDominant = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  const profil = STYLES[styleDominant];
  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1;

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", maxWidth: 480, margin: '0 auto', background: C.creme, minHeight: '100vh', paddingBottom: '3rem' }}>

      <div style={{ background: `linear-gradient(135deg, ${C.brun}, #3D2020)`, padding: '1.5rem 1rem', textAlign: 'center', color: 'white' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.4rem', fontWeight: 600 }}>⚡ Mon Style d'Entrepreneuriat</div>
        <div style={{ fontSize: '.78rem', opacity: .8, marginTop: '.3rem' }}>Visionnaire · Opératrice · Connectrice · Créatrice</div>
      </div>

      <div style={{ display: 'flex', gap: '.5rem', padding: '.8rem 1rem', background: 'white', borderBottom: `1px solid ${C.pale}` }}>
        {[{ id: 'test', label: '⚡ Test' }, { id: 'historique', label: '📊 Historique' }].map(t => (
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.6rem', marginBottom: '1rem' }}>
                {Object.entries(STYLES).map(([key, s]) => (
                  <div key={key} style={{ background: 'white', border: `2px solid ${s.couleur}22`, borderRadius: 12, padding: '.8rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '.3rem' }}>{s.emoji}</div>
                    <div style={{ fontSize: '.8rem', fontWeight: 700, color: s.couleur }}>{s.nom}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: `${C.or}15`, border: `1px solid ${C.or}44`, borderRadius: 12, padding: '1rem', marginBottom: '1rem', fontSize: '.75rem', color: C.texte, lineHeight: 1.6 }}>
                <strong>10 questions</strong> pour identifier ton style naturel d'entrepreneuse. Réponds avec ton instinct, pas ce que tu penses devoir dire !
              </div>
              <button onClick={() => setStep('quiz')}
                style={{ width: '100%', background: C.brun, color: 'white', border: 'none', borderRadius: 12, padding: '.9rem', fontSize: '.88rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                ⚡ Découvrir mon style
              </button>
            </div>
          )}

          {step === 'quiz' && (
            <div>
              <div style={{ background: 'white', borderRadius: 12, padding: '.8rem 1rem', marginBottom: '1rem', border: `1px solid ${C.pale}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.4rem' }}>
                  <span style={{ fontSize: '.72rem', color: C.gris }}>Question {current + 1} / {QUESTIONS.length}</span>
                  <span style={{ fontSize: '.72rem', color: C.or, fontWeight: 700 }}>{Math.round((current / QUESTIONS.length) * 100)}%</span>
                </div>
                <div style={{ height: 4, background: C.pale, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${(current / QUESTIONS.length) * 100}%`, height: '100%', background: C.or, borderRadius: 2, transition: 'width .3s' }} />
                </div>
              </div>

              <div style={{ background: 'white', borderRadius: 16, padding: '1.2rem', marginBottom: '1rem', border: `1px solid ${C.pale}` }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '1rem', color: C.brun, lineHeight: 1.5, marginBottom: '1.2rem', textAlign: 'center' }}>
                  {QUESTIONS[current].question}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                  {QUESTIONS[current].options.map((opt, i) => (
                    <button key={i} onClick={() => repondre(opt)}
                      style={{ background: C.creme, border: `1.5px solid ${C.pale}`, borderRadius: 10, padding: '.75rem 1rem', textAlign: 'left', fontSize: '.8rem', color: C.texte, fontFamily: 'inherit', cursor: 'pointer', lineHeight: 1.5 }}>
                      {opt.text}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'result' && (
            <div>
              <div style={{ background: `linear-gradient(135deg, ${profil.couleur}22, white)`, border: `2px solid ${profil.couleur}44`, borderRadius: 16, padding: '1.5rem', marginBottom: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '.5rem' }}>{profil.emoji}</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.3rem', fontWeight: 600, color: profil.couleur }}>{profil.nom}</div>
                <div style={{ fontSize: '.78rem', color: C.texte, lineHeight: 1.6, marginTop: '.5rem' }}>{profil.desc}</div>
              </div>

              {/* Mix */}
              <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: '1rem', border: `1px solid ${C.pale}` }}>
                <div style={{ fontSize: '.78rem', fontWeight: 700, color: C.brun, marginBottom: '.8rem' }}>📊 Ton mix de styles</div>
                {Object.entries(STYLES).map(([key, s]) => (
                  <div key={key} style={{ marginBottom: '.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.2rem' }}>
                      <span style={{ fontSize: '.75rem', color: C.texte }}>{s.emoji} {s.nom}</span>
                      <span style={{ fontSize: '.75rem', fontWeight: 700, color: s.couleur }}>{Math.round((scores[key] / total) * 100)}%</span>
                    </div>
                    <div style={{ height: 6, background: C.pale, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${(scores[key] / total) * 100}%`, height: '100%', background: s.couleur, borderRadius: 3 }} />
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
              <div style={{ background: `${C.brun}11`, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '.75rem', fontWeight: 700, color: C.brun, marginBottom: '.4rem' }}>🔥 Ton style business Mihi</div>
                <div style={{ fontSize: '.75rem', color: C.texte, lineHeight: 1.6 }}>{profil.business}</div>
              </div>

              {/* Conseil */}
              <div style={{ background: `${C.or}11`, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '.75rem', fontWeight: 700, color: C.brun, marginBottom: '.4rem' }}>💡 Mon conseil pour toi</div>
                <div style={{ fontSize: '.75rem', color: C.texte, lineHeight: 1.6 }}>{profil.conseil}</div>
              </div>

              {/* Stars */}
              <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: '1rem', border: `1px solid ${C.pale}` }}>
                <div style={{ fontSize: '.75rem', fontWeight: 700, color: C.brun, marginBottom: '.4rem' }}>⭐ Entrepreneuses qui te ressemblent</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
                  {profil.stars.map((s, i) => (
                    <div key={i} style={{ background: `${profil.couleur}15`, border: `1px solid ${profil.couleur}33`, borderRadius: 20, padding: '.25rem .7rem', fontSize: '.72rem', color: profil.couleur }}>{s}</div>
                  ))}
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
              <div style={{ fontSize: '2.5rem', marginBottom: '.7rem' }}>⚡</div>
              <div style={{ fontSize: '.85rem', fontWeight: 600, color: C.brun }}>Aucun test encore</div>
            </div>
          ) : (
            historique.map((entry, i) => {
              const s = STYLES[entry.style];
              return (
                <div key={i} style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: '.8rem', border: `2px solid ${s.couleur}33` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
                    <div style={{ fontSize: '.8rem', color: C.gris }}>📅 {entry.date}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                      <span style={{ fontSize: '1rem' }}>{s.emoji}</span>
                      <span style={{ fontSize: '.8rem', fontWeight: 700, color: s.couleur }}>{s.nom}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '.4rem' }}>
                    {Object.entries(STYLES).map(([key, st]) => {
                      const tot = Object.values(entry.scores).reduce((a,b)=>a+b,1);
                      return (
                        <div key={key} style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ fontSize: '.65rem', color: st.couleur }}>{st.emoji}</div>
                          <div style={{ height: 24, background: C.pale, borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'flex-end', marginTop: '.2rem' }}>
                            <div style={{ width: '100%', height: `${((entry.scores[key]||0)/tot)*100}%`, background: st.couleur }} />
                          </div>
                          <div style={{ fontSize: '.6rem', color: C.gris, marginTop: '.2rem' }}>{Math.round(((entry.scores[key]||0)/tot)*100)}%</div>
                        </div>
                      );
                    })}
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
