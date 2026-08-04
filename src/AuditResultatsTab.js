import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * AuditResultatsTab
 *
 * Chaque distributrice voit les réponses issues de son lien.
 * Melissa (UID_ADMIN) voit la totalité.
 *
 * Usage : <AuditResultatsTab uid={user.uid} />
 */

const UID_ADMIN = 'melissa-da-silveira';

const OR = '#c9a227';
const NUIT = '#12101f';
const ROSE = '#e8c4c0';
const LILAS = '#b9a7d9';
const CREME = '#f6f1e7';

/* Questions à agréger sous forme de barres */
const BARRES = [
  { id: 'profil', titre: 'Qui a répondu' },
  { id: 'reaction', titre: 'Première réaction face à Mihi' },
  { id: 'doutes', titre: 'Sources de doute', multi: true },
  { id: 'frein_achat', titre: 'Ce qui bloque à l’achat', multi: true, cle: true },
  { id: 'prix', titre: 'Perception du prix' },
  { id: 'rassurance', titre: 'Ce qui rassurerait', multi: true, cle: true },
  { id: 'contenu_aime', titre: 'Contenus qui attirent', multi: true },
  { id: 'contenu_rebute', titre: 'Contenus qui repoussent', multi: true, cle: true },
  { id: 'trop_vendu', titre: '« Tu vends trop »' },
  { id: 'resultats', titre: 'Résultats vs attentes' },
  { id: 'manque_suivi', titre: 'Ce qui a manqué après la commande', multi: true },
  { id: 'opportunite', titre: 'Envie de se lancer' },
  { id: 'frein_opportunite', titre: 'Freins au recrutement', multi: true, cle: true },
  { id: 'source', titre: 'Canal d’acquisition' },
  { id: 'anciennete', titre: 'Ancienneté' },
];

/* Questions ouvertes */
const VERBATIMS = [
  { id: 'arreter', titre: 'Ce que je devrais arrêter', cle: true },
  { id: 'faire_plus', titre: 'Ce que je devrais faire plus', cle: true },
  { id: 'baguette', titre: 'Baguette magique' },
  { id: 'trois_mots', titre: 'Mihi en trois mots' },
  { id: 'question_libre', titre: 'Questions jamais posées' },
  { id: 'parler_plus', titre: 'Sujets attendus' },
  { id: 'recommander_achat', titre: 'Ce qui déclencherait une recommande' },
];

export function AuditResultatsTab({ uid, prenom }) {
  const [reponses, setReponses] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [ouvert, setOuvert] = useState('freins');
  const [copie, setCopie] = useState(false);
  const [reglages, setReglages] = useState({ actif: true, equipe: false });
  const [filtre, setFiltre] = useState('tout');
  const [sauvegarde, setSauvegarde] = useState(false);

  const estAdmin = uid === UID_ADMIN;

  /* Réglages d'ouverture : actif = le quiz accepte des réponses,
     equipe = les distributrices ont accès à leur lien. */
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'reglages_publics', 'audit'));
        if (!annule && snap.exists()) {
          setReglages({ actif: true, equipe: false, ...snap.data() });
        }
      } catch (e) {
        /* document absent : on garde les valeurs par défaut */
      }
    })();
    return () => { annule = true; };
  }, []);

  const basculer = async (cle) => {
    const suivant = { ...reglages, [cle]: !reglages[cle] };
    setReglages(suivant);
    setSauvegarde(true);
    try {
      await setDoc(doc(db, 'reglages_publics', 'audit'), suivant, { merge: true });
    } catch (e) {
      setReglages(reglages); // retour arrière si l'écriture échoue
      setErreur('Réglage non enregistré : ' + e.message);
    } finally {
      setSauvegarde(false);
    }
  };

  useEffect(() => {
    let annule = false;
    (async () => {
      setChargement(true);
      setErreur(null);
      try {
        const base = collection(db, 'audit_reponses');
        const q = estAdmin
          ? query(base, orderBy('envoyeLe', 'desc'))
          : query(base, where('ref', '==', uid));
        const snap = await getDocs(q);
        if (annule) return;
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (b.envoyeLe || '').localeCompare(a.envoyeLe || ''));
        setReponses(docs);
      } catch (e) {
        if (!annule) setErreur(e.message);
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => { annule = true; };
  }, [uid, estAdmin]);

  const lienPerso = estAdmin
    ? 'https://blazingdinasty.com/audit-blazing.html'
    : `https://blazingdinasty.com/audit-blazing.html?ref=${uid}` +
      (prenom ? `&p=${encodeURIComponent(prenom)}` : '');

  /* Les toutes premières réponses portent ref:"melissa" (avant que
     l'UID complet ne soit utilisé). On rattache les deux à Melissa. */
  const estMoi = (r) => r.ref === uid || r.ref === 'melissa';

  const distributrices = useMemo(() => {
    const t = {};
    reponses.forEach((r) => {
      if (estMoi(r)) return;
      const k = r.ref || 'inconnu';
      t[k] = (t[k] || 0) + 1;
    });
    return Object.entries(t).sort((a, b) => b[1] - a[1]);
  }, [reponses, uid]);

  const nbMoi = reponses.filter(estMoi).length;

  const liste = useMemo(() => {
    if (!estAdmin || filtre === 'tout') return reponses;
    if (filtre === 'moi') return reponses.filter(estMoi);
    return reponses.filter((r) => r.ref === filtre);
  }, [reponses, filtre, estAdmin, uid]);

  const stats = useMemo(() => {
    const n = liste.length;
    const moyenne = (cle) => {
      const v = liste.map((r) => r[cle]).filter((x) => typeof x === 'number');
      return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null;
    };
    const promoteurs = liste.filter((r) => typeof r.nps === 'number' && r.nps >= 9).length;
    const detracteurs = liste.filter((r) => typeof r.nps === 'number' && r.nps <= 6).length;
    const avecNps = liste.filter((r) => typeof r.nps === 'number').length;
    return {
      n,
      confiance: moyenne('confiance'),
      npsMoyen: moyenne('nps'),
      nps: avecNps ? Math.round(((promoteurs - detracteurs) / avecNps) * 100) : null,
      rappels: liste.filter((r) => r.accepteRappel).length,
      duree: n
        ? Math.round(
            liste.reduce((a, r) => a + (r.dureeSecondes || 0), 0) / n / 60
          )
        : 0,
    };
  }, [liste]);

  const compter = (id, multi) => {
    const tally = {};
    liste.forEach((r) => {
      const v = r[id];
      if (v === undefined || v === null) return;
      (multi ? (Array.isArray(v) ? v : [v]) : [v]).forEach((o) => {
        tally[o] = (tally[o] || 0) + 1;
      });
    });
    return Object.entries(tally).sort((a, b) => b[1] - a[1]);
  };

  const copier = () => {
    navigator.clipboard.writeText(lienPerso).then(() => {
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    });
  };

  const exporterCsv = () => {
    const cles = Array.from(new Set(liste.flatMap((r) => Object.keys(r))));
    const ligne = (vals) =>
      vals.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';');
    const csv = [
      ligne(cles),
      ...liste.map((r) =>
        ligne(cles.map((c) => (Array.isArray(r[c]) ? r[c].join(' | ') : r[c])))
      ),
    ].join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ------------------------------ rendu ------------------------------ */

  if (chargement)
    return <p style={S.info}>Chargement des réponses…</p>;

  if (erreur)
    return (
      <div style={S.info}>
        <p>Lecture impossible : {erreur}</p>
        <p style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>
          Si le message parle de permissions, vérifie les règles Firestore sur
          la collection <code>audit_reponses</code>.
        </p>
      </div>
    );

  const sections = [
    { id: 'freins', label: 'Freins' },
    { id: 'contenus', label: 'Contenus' },
    { id: 'profils', label: 'Profils' },
    { id: 'verbatims', label: 'Verbatims' },
  ];

  const parSection = {
    freins: BARRES.filter((b) =>
      ['frein_achat', 'prix', 'rassurance', 'doutes', 'frein_opportunite', 'opportunite'].includes(b.id)
    ),
    contenus: BARRES.filter((b) =>
      ['contenu_aime', 'contenu_rebute', 'trop_vendu'].includes(b.id)
    ),
    profils: BARRES.filter((b) =>
      ['profil', 'anciennete', 'source', 'reaction', 'resultats', 'manque_suivi'].includes(b.id)
    ),
  };

  return (
    <div style={S.page}>
      {/* réglages, visibles par Melissa seule */}
      {estAdmin && (
        <div style={S.encart}>
          <p style={S.eyebrow}>Réglages{sauvegarde ? ' · enregistrement…' : ''}</p>
          <Interrupteur
            actif={reglages.actif}
            onClick={() => basculer('actif')}
            titre="Le questionnaire est ouvert"
            detail="Décoché, toute personne qui ouvre un lien voit un écran « c'est clos pour le moment ». Les réponses déjà reçues sont conservées."
          />
          <Interrupteur
            actif={reglages.equipe}
            onClick={() => basculer('equipe')}
            titre="L'équipe peut le partager"
            detail="Décoché, les distributrices ne voient pas leur lien dans cet onglet. Toi, tu gardes le tien."
          />
        </div>
      )}

      {/* lien de partage */}
      {(estAdmin || reglages.equipe) ? (
        <div style={S.encart}>
          <p style={S.eyebrow}>Ton lien à partager</p>
          <p style={S.lien}>{lienPerso}</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button style={S.btnOr} onClick={copier}>
              {copie ? 'Copié' : 'Copier le lien'}
            </button>
            {reponses.length > 0 && (
              <button style={S.btnVide} onClick={exporterCsv}>
                Export CSV
              </button>
            )}
          </div>
          <p style={S.note}>
            {estAdmin
              ? 'Tu vois toutes les réponses de l’équipe.'
              : 'Tu vois uniquement les réponses venues de ton lien.'}
          </p>
        </div>
      ) : (
        <div style={S.vide}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>L’audit n’est pas encore ouvert à l’équipe.</p>
          <p style={{ opacity: 0.65, fontSize: 14 }}>
            Melissa te préviendra dès que ton lien sera disponible.
          </p>
        </div>
      )}

      {/* filtre par origine, Melissa seule */}
      {estAdmin && reponses.length > 0 && (
        <div style={S.filtres}>
          <button
            onClick={() => setFiltre('tout')}
            style={{ ...S.puceFiltre, ...(filtre === 'tout' ? S.puceFiltreOn : {}) }}
          >
            Tout · {reponses.length}
          </button>
          <button
            onClick={() => setFiltre('moi')}
            style={{ ...S.puceFiltre, ...(filtre === 'moi' ? S.puceFiltreOn : {}) }}
          >
            Les miennes · {nbMoi}
          </button>
          {distributrices.length > 0 && (
            <select
              value={distributrices.some(([r]) => r === filtre) ? filtre : ''}
              onChange={(e) => setFiltre(e.target.value || 'tout')}
              style={{
                ...S.puceFiltre,
                ...(distributrices.some(([r]) => r === filtre) ? S.puceFiltreOn : {}),
              }}
            >
              <option value="">Par distributrice…</option>
              {distributrices.map(([ref, n]) => (
                <option key={ref} value={ref}>
                  {ref} · {n}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {reponses.length === 0 ? (
        <div style={S.vide}>
          <p style={{ fontSize: 17, marginBottom: 8 }}>Aucune réponse pour l’instant.</p>
          <p style={{ opacity: 0.65, fontSize: 14 }}>
            Partage ton lien en story et en message privé. Les premières réponses
            arrivent en général dans les heures qui suivent.
          </p>
        </div>
      ) : (
        <>
          {/* chiffres clés */}
          <div style={S.grille}>
            <Chiffre valeur={stats.n} label="réponses" />
            <Chiffre valeur={stats.confiance ?? '—'} label="confiance / 10" />
            <Chiffre valeur={stats.nps ?? '—'} label="NPS" />
            <Chiffre valeur={stats.rappels} label="ouvertes au contact" />
          </div>

          {/* onglets */}
          <div style={S.onglets}>
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setOuvert(s.id)}
                style={{ ...S.onglet, ...(ouvert === s.id ? S.ongletActif : {}) }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {ouvert !== 'verbatims' &&
            parSection[ouvert].map((b) => {
              const data = compter(b.id, b.multi);
              if (!data.length) return null;
              const max = data[0][1];
              return (
                <div key={b.id} style={S.bloc}>
                  <h3 style={S.h3}>
                    {b.titre}
                    {b.cle && <span style={S.pastille}>à lire</span>}
                  </h3>
                  {data.map(([label, n]) => (
                    <div key={label} style={{ marginBottom: 9 }}>
                      <div style={S.ligneBarre}>
                        <span>{label}</span>
                        <span style={{ opacity: 0.6 }}>
                          {n} · {Math.round((n / stats.n) * 100)}%
                        </span>
                      </div>
                      <div style={S.piste}>
                        <div style={{ ...S.remplissage, width: `${(n / max) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

          {ouvert === 'verbatims' &&
            VERBATIMS.map((v) => {
              const textes = liste
                .map((r) => ({ t: (r[v.id] || '').trim(), qui: r.prenom }))
                .filter((x) => x.t.length > 1);
              if (!textes.length) return null;
              return (
                <div key={v.id} style={S.bloc}>
                  <h3 style={S.h3}>
                    {v.titre}
                    {v.cle && <span style={S.pastille}>à lire</span>}
                    <span style={{ ...S.pastille, background: 'transparent', color: 'rgba(246,241,231,.5)', border: '1px solid rgba(246,241,231,.2)' }}>
                      {textes.length}
                    </span>
                  </h3>
                  {textes.map((x, i) => (
                    <blockquote key={i} style={S.citation}>
                      {x.t}
                      {x.qui && <footer style={S.signature}>— {x.qui}</footer>}
                    </blockquote>
                  ))}
                </div>
              );
            })}
        </>
      )}
    </div>
  );
}

function Interrupteur({ actif, onClick, titre, detail }) {
  return (
    <button onClick={onClick} style={S.interrupteur}>
      <span style={{ ...S.case, ...(actif ? S.caseOn : {}) }}>{actif ? '✓' : ''}</span>
      <span style={{ textAlign: 'left' }}>
        <span style={{ display: 'block', fontSize: 14.5, marginBottom: 3 }}>{titre}</span>
        <span style={{ display: 'block', fontSize: 12.5, lineHeight: 1.45, opacity: 0.6 }}>{detail}</span>
      </span>
    </button>
  );
}

function Chiffre({ valeur, label }) {
  return (
    <div style={S.carte}>
      <div style={S.grand}>{valeur}</div>
      <div style={S.petit}>{label}</div>
    </div>
  );
}

/* ------------------------------- styles ------------------------------- */

const S = {
  page: { background: NUIT, color: CREME, padding: '20px 16px 60px', minHeight: '100%', fontFamily: "'DM Sans', system-ui, sans-serif" },
  info: { background: NUIT, color: CREME, padding: 40, textAlign: 'center' },
  encart: { border: `1px solid rgba(201,162,39,.35)`, padding: 18, marginBottom: 22 },
  eyebrow: { fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', color: OR, marginBottom: 10 },
  lien: { fontSize: 13, wordBreak: 'break-all', color: 'rgba(246,241,231,.8)', lineHeight: 1.5 },
  note: { fontSize: 12.5, color: ROSE, marginTop: 12 },
  btnOr: { background: OR, border: 'none', color: NUIT, padding: '11px 18px', fontSize: 12, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit' },
  btnVide: { background: 'transparent', border: `1px solid rgba(246,241,231,.3)`, color: CREME, padding: '11px 18px', fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit' },
  interrupteur: { display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%', background: 'transparent', border: 'none', color: CREME, padding: '10px 0', cursor: 'pointer', fontFamily: 'inherit' },
  case: { flex: '0 0 20px', width: 20, height: 20, border: `1px solid rgba(246,241,231,.4)`, display: 'grid', placeItems: 'center', fontSize: 12, color: NUIT, marginTop: 2 },
  caseOn: { background: OR, borderColor: OR },
  vide: { textAlign: 'center', padding: '50px 20px', border: '1px dashed rgba(246,241,231,.2)' },
  filtres: { display: 'flex', gap: 7, marginBottom: 20, flexWrap: 'wrap' },
  puceFiltre: { background: 'transparent', border: `1px solid rgba(246,241,231,.28)`, color: 'rgba(246,241,231,.7)', padding: '8px 13px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', maxWidth: '100%' },
  puceFiltreOn: { background: LILAS, borderColor: LILAS, color: NUIT, fontWeight: 600 },
  grille: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 22 },
  carte: { background: 'rgba(246,241,231,.05)', border: '1px solid rgba(246,241,231,.14)', padding: '16px 14px', textAlign: 'center' },
  grand: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 34, color: OR, lineHeight: 1 },
  petit: { fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(246,241,231,.55)', marginTop: 7 },
  onglets: { display: 'flex', gap: 6, marginBottom: 22, overflowX: 'auto' },
  onglet: { flex: '0 0 auto', background: 'transparent', border: '1px solid rgba(246,241,231,.2)', color: 'rgba(246,241,231,.65)', padding: '9px 15px', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit' },
  ongletActif: { background: OR, borderColor: OR, color: NUIT, fontWeight: 600 },
  bloc: { marginBottom: 30 },
  h3: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 21, fontWeight: 500, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pastille: { fontFamily: "'DM Sans', sans-serif", fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', background: ROSE, color: NUIT, padding: '3px 7px' },
  ligneBarre: { display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 5, gap: 12 },
  piste: { height: 6, background: 'rgba(246,241,231,.1)' },
  remplissage: { height: '100%', background: OR },
  citation: { borderLeft: `2px solid ${LILAS}`, paddingLeft: 14, margin: '0 0 14px', fontSize: 14.5, lineHeight: 1.6, color: 'rgba(246,241,231,.88)' },
  signature: { fontSize: 12, color: ROSE, marginTop: 6 },
};

export default AuditResultatsTab;
