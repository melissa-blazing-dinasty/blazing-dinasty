import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, query, where, collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { C } from './constants';

const STATUTS_MIHI = [
  { nom: 'Consultant', seuil: '100e -> 249e', pct: '20% + 2% equipe' },
  { nom: 'Conseiller', seuil: '250e -> 499e', pct: '30% + 4% equipe' },
  { nom: 'Conseiller Principal', seuil: '500e -> 999e', pct: '30% + 6% equipe' },
  { nom: 'Responsable', seuil: '1000e -> 1499e', pct: '30% + 8% equipe' },
  { nom: 'Cadre Superieur', seuil: '1500e -> 1999e', pct: '30% + 10% equipe' },
  { nom: 'Partenaire', seuil: '2000e -> 2999e', pct: '30% + 12% equipe' },
  { nom: 'Directeur Adjoint', seuil: '3000e -> 4999e', pct: '30% + 14% equipe' },
  { nom: 'Directeur', seuil: '5000e et +', pct: '30% + 17% equipe' },
];

const TEMOIGNAGES_CHIFFRES = [
  { nom: 'Marie', metier: 'Coiffeuse', heures: '6h/semaine', clientes: '12 clientes regulieres', revenu: '420' },
  { nom: 'Julie', metier: 'Maman au foyer', heures: '4h/semaine', clientes: '8 clientes', revenu: '320' },
  { nom: 'Sarah', metier: 'Salariee', heures: '8h/semaine', clientes: '20 clientes', revenu: '790' },
];

const TEMOIGNAGES_TEXTE = [
  { texte: "Je n'aurais jamais pense pouvoir avoir ma propre boutique en ligne. Aujourd'hui mes clientes commandent directement et je recois une notification a chaque vente !", auteur: 'Sarah, 3 mois dans l\u2019equipe' },
  { texte: "L'academie m'a tout appris. Les formations, les outils, l'accompagnement, je me sens vraiment professionnelle dans ma facon de travailler.", auteur: 'Lea, 6 mois dans l\u2019equipe' },
  { texte: "Ce qui m'a convaincue c'est la boutique gratuite. Chez Mihi elle est payante, ici elle est offerte et en plus elle est magnifique !", auteur: 'Marine, 1 an dans l\u2019equipe' },
];

function useCountdown() {
  const [temps, setTemps] = useState({ h: 0, m: 0, s: 0 });
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const minuit = new Date(now);
      minuit.setHours(24, 0, 0, 0);
      const diff = Math.max(0, minuit.getTime() - now.getTime());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTemps({ h, m, s });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return temps;
}

function RecrutementPage({ slug }) {
  const [profil, setProfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [boutiqueActif, setBoutiqueActif] = useState(false);
  const [form, setForm] = useState({ prenom: '', nom: '', email: '', tel: '', attire: '' });
  const [envoye, setEnvoye] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const temps = useCountdown();

  useEffect(() => {
    (async () => {
      try {
        const snapDirect = await getDoc(doc(db, 'linkbio', slug));
        if (snapDirect.exists()) {
          const data = snapDirect.data();
          setProfil(data);
          setBoutiqueActif(!!data.recrutBoutiqueActif);
        } else {
          const q = query(collection(db, 'linkbio'), where('uid', '==', slug));
          const qs = await getDocs(q);
          if (!qs.empty) {
            const data = qs.docs[0].data();
            setProfil(data);
            setBoutiqueActif(!!data.recrutBoutiqueActif);
          }
        }
      } catch {}
      setLoading(false);
    })();
  }, [slug]);

  const envoyer = async () => {
    if (!form.prenom.trim() || !form.nom.trim()) return;
    setEnvoi(true);
    try {
      await setDoc(doc(db, 'tunnel_prospects', 'p' + Date.now()), {
        distributeurUid: (profil && profil.uid) || slug,
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        email: form.email.trim(),
        tel: form.tel.trim(),
        attire: form.attire.trim(),
        source: 'recrutement-page',
        ts: Date.now(),
        traite: false,
      });
      setEnvoye(true);
    } catch {}
    setEnvoi(false);
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gris, fontFamily: 'inherit' }}>Chargement...</div>;
  }

  const prenomDistrib = (profil && profil.prenom) || 'notre distributrice';
  const photoDistrib = profil && profil.photo;
  const lienBoutique = `https://blazing-dinasty-1fad9.web.app/?linkbio=${slug}`;
  const lienMihiDirect = (profil && profil.lienRecrutement) || '';

  const W = { maxWidth: 480, margin: '0 auto', padding: '0 1rem 2rem' };

  if (envoye) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAF7F2', fontFamily: "'Trebuchet MS',sans-serif", display: 'flex', alignItems: 'center' }}>
        <div style={{ ...W, textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
          <div style={{ fontFamily: 'Georgia,serif', fontSize: '1.3rem', color: '#3D1F0E', marginBottom: '.5rem' }}>Merci {form.prenom} !</div>
          <p style={{ fontSize: '.85rem', color: '#888', lineHeight: 1.7 }}>{prenomDistrib} va te recontacter tres vite pour te presenter l'opportunite en detail.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAF7F2', fontFamily: "'Trebuchet MS',sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#E8C079,#C49A6B)', padding: '2rem 1rem 1.5rem', textAlign: 'center' }}>
        {photoDistrib && (
          <img src={photoDistrib} alt="" style={{ width: 90, height: 90, borderRadius: '50%', objectFit: 'cover', border: '3px solid white', marginBottom: '.75rem' }} />
        )}
        <div style={{ fontFamily: 'Georgia,serif', fontSize: '1.4rem', fontWeight: 700, color: '#3D1F0E' }}>Rejoins l'equipe de {prenomDistrib} ! 🌿</div>
        <div style={{ fontSize: '.8rem', color: '#5C3A22', marginTop: '.4rem' }}>Cree ta propre boutique en ligne gratuite<br />et developpe ton business beaute depuis chez toi</div>
      </div>

      <div style={W}>
        {/* Badge sans risque */}
        <div style={{ background: '#E8F5E9', border: '1px solid #A8D4A8', borderRadius: 12, padding: '.85rem', marginTop: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '.85rem', fontWeight: 700, color: '#2D5A3D', marginBottom: '.2rem' }}>✅ Rejoindre l'equipe c'est sans risque</div>
          <div style={{ fontSize: '.72rem', color: '#3D6B4A' }}>Aucun frais d'inscription • Aucun stock obligatoire • Tu peux arreter quand tu veux</div>
        </div>

        {/* Offre limitee */}
        <div style={{ background: '#8B2E2E', borderRadius: 12, padding: '1rem', marginTop: '1rem', textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.08em' }}>🎁 OFFRE LIMITEE</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, margin: '.3rem 0' }}>-10€ sur ta premiere commande</div>
          <div style={{ fontSize: '.68rem', opacity: .85, marginBottom: '.6rem' }}>Pour toute inscription avant minuit ce soir</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '.6rem' }}>
            {[['h', temps.h], ['m', temps.m], ['s', temps.s]].map(([k, v]) => (
              <div key={k} style={{ background: 'rgba(255,255,255,.15)', borderRadius: 8, padding: '.4rem .7rem', minWidth: 48 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{String(v).padStart(2, '0')}</div>
                <div style={{ fontSize: '.55rem', opacity: .8 }}>{k === 'h' ? 'heures' : k === 'm' ? 'min' : 'sec'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Boutique offerte */}
        {boutiqueActif && (
          <div style={{ background: 'white', border: '1px solid #E8DDD4', borderRadius: 12, padding: '1rem', marginTop: '1rem' }}>
            <div style={{ fontSize: '.85rem', fontWeight: 700, color: '#3D1F0E', marginBottom: '.4rem' }}>🛍️ Ta boutique en ligne offerte</div>
            <p style={{ fontSize: '.75rem', color: '#888', marginBottom: '.7rem', lineHeight: 1.6 }}>Chez Mihi, la boutique en ligne coute cher. Avec notre academie, tu l'as gratuitement, personnalisee avec tes photos, tes produits, tes prix.</p>
            <a href={lienBoutique} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', border: '1.5px solid #C49A6B', color: '#8B6B3D', borderRadius: 10, padding: '.6rem', fontSize: '.8rem', fontWeight: 700, textDecoration: 'none' }}>
              👀 Voir la boutique de {prenomDistrib}
            </a>
          </div>
        )}

        {/* Ce que tu obtiens */}
        <div style={{ background: 'white', border: '1px solid #E8DDD4', borderRadius: 12, padding: '1rem', marginTop: '1rem' }}>
          <div style={{ fontSize: '.85rem', fontWeight: 700, color: '#3D1F0E', marginBottom: '.7rem' }}>✨ Ce que tu obtiens</div>
          {[
            ['🛍️', 'Boutique en ligne gratuite', 'Personnalisee, avec diagnostics IA, suivi de tes clientes...'],
            ['📱', 'Academie Beauty Addict', 'Formations, outils, quiz, badges, suivi de ton activite, tout dans une app'],
            ['💰', '20% a 30% de commission', 'Sur tes propres ventes + jusqu\u2019a 17% sur les ventes de ton equipe'],
            ['🎯', 'Accompagnement personnalise', 'Tu n\u2019es jamais seule, accompagnee a chaque etape'],
            ['⏰', '100% flexible', 'Tu travailles quand tu veux, ou tu veux, a ton rythme'],
            ['🌿', 'Produits cosmetiques premium', 'Gamme complete visage, corps, cheveux, maquillage, made in Europe'],
          ].map(([icon, titre, desc], i) => (
            <div key={i} style={{ display: 'flex', gap: '.6rem', marginBottom: i < 5 ? '.6rem' : 0 }}>
              <div style={{ fontSize: '1.1rem' }}>{icon}</div>
              <div>
                <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#3D1F0E' }}>{titre}</div>
                <div style={{ fontSize: '.7rem', color: '#888' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Temoignages chiffres */}
        <div style={{ background: 'white', border: '1px solid #E8DDD4', borderRadius: 12, padding: '1rem', marginTop: '1rem' }}>
          <div style={{ fontSize: '.85rem', fontWeight: 700, color: '#3D1F0E', marginBottom: '.7rem' }}>💰 Elles ont saute le pas, voila ce qu'elles gagnent</div>
          {TEMOIGNAGES_CHIFFRES.map((t, i) => (
            <div key={i} style={{ background: '#FAF5EE', borderRadius: 10, padding: '.7rem .85rem', marginBottom: '.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#3D1F0E' }}>{t.nom} — {t.metier}</div>
                <div style={{ fontSize: '.68rem', color: '#888' }}>{t.heures} • {t.clientes}</div>
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#C49A6B' }}>{t.revenu}€<span style={{ fontSize: '.6rem', color: '#888' }}>/mois</span></div>
            </div>
          ))}
          <div style={{ fontSize: '.62rem', color: '#aaa', fontStyle: 'italic', marginTop: '.3rem' }}>Revenus moyens constates dans notre equipe. Les resultats varient selon l'investissement personnel.</div>
        </div>

        {/* Statuts Mihi */}
        <div style={{ background: 'white', border: '1px solid #E8DDD4', borderRadius: 12, padding: '1rem', marginTop: '1rem' }}>
          <div style={{ fontSize: '.85rem', fontWeight: 700, color: '#3D1F0E', marginBottom: '.7rem' }}>🏆 Les statuts Mihi</div>
          {STATUTS_MIHI.map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.5rem 0', borderBottom: i < STATUTS_MIHI.length - 1 ? '1px solid #F0EAE2' : 'none' }}>
              <div>
                <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#3D1F0E' }}>{s.nom}</div>
                <div style={{ fontSize: '.65rem', color: '#aaa' }}>{s.seuil}</div>
              </div>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#C49A6B' }}>{s.pct}</div>
            </div>
          ))}
        </div>

        {/* Temoignages texte */}
        <div style={{ background: 'white', border: '1px solid #E8DDD4', borderRadius: 12, padding: '1rem', marginTop: '1rem' }}>
          <div style={{ fontSize: '.85rem', fontWeight: 700, color: '#3D1F0E', marginBottom: '.7rem' }}>💬 Elles ont saute le pas</div>
          {TEMOIGNAGES_TEXTE.map((t, i) => (
            <div key={i} style={{ background: '#FAF5EE', borderRadius: 10, padding: '.7rem .85rem', marginBottom: '.5rem' }}>
              <div style={{ fontSize: '.75rem', color: '#3D1F0E', fontStyle: 'italic', lineHeight: 1.6 }}>{t.texte}</div>
              <div style={{ fontSize: '.65rem', color: '#aaa', marginTop: '.3rem' }}>— {t.auteur}</div>
            </div>
          ))}
        </div>

        {/* Formulaire */}
        <div style={{ background: 'white', border: '1px solid #E8DDD4', borderRadius: 12, padding: '1rem', marginTop: '1rem' }}>
          {[
            ['prenom', 'Prenom *', 'Ton prenom'],
            ['nom', 'Nom *', 'Ton nom'],
            ['email', 'Email *', 'Ton adresse email'],
            ['tel', 'Telephone *', 'Ton numero de telephone'],
          ].map(([k, label, ph]) => (
            <div key={k} style={{ marginBottom: '.6rem' }}>
              <div style={{ fontSize: '.65rem', fontWeight: 700, color: '#3D1F0E', marginBottom: '.2rem' }}>{label}</div>
              <input value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} placeholder={ph}
                style={{ width: '100%', border: '1px solid #E8DDD4', borderRadius: 8, padding: '.5rem .65rem', fontSize: '.8rem', fontFamily: 'inherit', color: '#3D2B1F', background: '#FAF7F2', outline: 'none' }} />
            </div>
          ))}
          <div style={{ marginBottom: '.7rem' }}>
            <div style={{ fontSize: '.65rem', fontWeight: 700, color: '#3D1F0E', marginBottom: '.2rem' }}>Qu'est-ce qui t'attire dans cette opportunite ?</div>
            <textarea value={form.attire} onChange={e => setForm(p => ({ ...p, attire: e.target.value }))} placeholder="Dis-nous en quelques mots..."
              style={{ width: '100%', border: '1px solid #E8DDD4', borderRadius: 8, padding: '.5rem .65rem', fontSize: '.8rem', fontFamily: 'inherit', color: '#3D2B1F', background: '#FAF7F2', outline: 'none', minHeight: 60, resize: 'vertical' }} />
          </div>
          <button onClick={envoyer} disabled={envoi || !form.prenom.trim() || !form.nom.trim()}
            style={{ width: '100%', background: 'linear-gradient(135deg,#E8C079,#C49A6B)', color: '#3D1F0E', border: 'none', borderRadius: 10, padding: '.8rem', fontSize: '.85rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', marginBottom: '.6rem' }}>
            {envoi ? 'Envoi...' : '🌿 Je veux rejoindre l\'equipe !'}
          </button>
          {lienMihiDirect && (
            <>
              <div style={{ textAlign: 'center', fontSize: '.68rem', color: '#aaa', margin: '.5rem 0' }}>Tu es deja prete a demarrer ?</div>
              <a href={lienMihiDirect} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', border: '1.5px solid #7FAF8A', color: '#2D5A3D', borderRadius: 10, padding: '.6rem', fontSize: '.8rem', fontWeight: 700, textDecoration: 'none' }}>
                ✅ M'inscrire directement sur Mihi
              </a>
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', fontSize: '.65rem', color: '#c4b8a8', marginTop: '1.5rem' }}>
          Beauty Addict Academy • Equipe de {prenomDistrib}
        </div>
      </div>
    </div>
  );
}

export { RecrutementPage };