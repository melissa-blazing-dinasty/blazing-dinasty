import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { C } from './constants';
import { UploadPhoto } from './FormationProduitsTab';

function convId(a, b) {
  return [a, b].sort().join('_');
}

function MessagerieTab({ uid, userName }) {
  const [ecran, setEcran] = useState('liste'); // liste | recherche | conversation
  const [conversations, setConversations] = useState({});
  const [loading, setLoading] = useState(true);
  const [annuaire, setAnnuaire] = useState({});
  const [recherche, setRecherche] = useState('');
  const [contactActif, setContactActif] = useState(null);
  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState('');
  const [photo, setPhoto] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const chargerIndex = async () => {
    try {
      const snap = await getDoc(doc(db, 'messagerie_index', uid));
      if (snap.exists()) setConversations(snap.data().partenaires || {});
    } catch {}
    setLoading(false);
  };

  useEffect(() => { chargerIndex(); }, [uid]);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'equipe', 'annuaire'));
        if (snap.exists()) setAnnuaire(snap.data().membres || {});
      } catch {}
    })();
  }, []);

  const ouvrirConversation = async (autreUid, autreNom) => {
    setContactActif({ uid: autreUid, nom: autreNom });
    setEcran('conversation');
    try {
      const cid = convId(uid, autreUid);
      const snap = await getDoc(doc(db, 'conversations', cid));
      setMessages(snap.exists() ? (snap.data().messages || []) : []);
    } catch {
      setMessages([]);
    }
    try {
      const idxRef = doc(db, 'messagerie_index', uid);
      const idxSnap = await getDoc(idxRef);
      const partenaires = idxSnap.exists() ? (idxSnap.data().partenaires || {}) : {};
      if (partenaires[autreUid]) {
        partenaires[autreUid] = { ...partenaires[autreUid], unreadCount: 0 };
        await setDoc(idxRef, { partenaires }, { merge: true });
        setConversations(partenaires);
      }
    } catch {}
  };

  const envoyerMessage = async () => {
    if (!texte.trim() && !photo) return;
    if (!contactActif) return;
    setEnvoi(true);
    try {
      const cid = convId(uid, contactActif.uid);
      const msg = {
        id: 'm' + Date.now(),
        de: uid,
        deNom: userName,
        texte: texte.trim(),
        photo: photo || '',
        ts: Date.now(),
      };
      const next = [...messages, msg];
      setMessages(next);
      await setDoc(doc(db, 'conversations', cid), { messages: next, participants: [uid, contactActif.uid] }, { merge: true });

      const idxRefMoi = doc(db, 'messagerie_index', uid);
      const idxMoiSnap = await getDoc(idxRefMoi);
      const partenairesMoi = idxMoiSnap.exists() ? (idxMoiSnap.data().partenaires || {}) : {};
      partenairesMoi[contactActif.uid] = { nom: contactActif.nom, lastMsg: texte.trim() || 'Photo', lastTs: msg.ts, unread: false };
      await setDoc(idxRefMoi, { partenaires: partenairesMoi }, { merge: true });
      setConversations(partenairesMoi);

      const idxRefAutre = doc(db, 'messagerie_index', contactActif.uid);
      const idxAutreSnap = await getDoc(idxRefAutre);
      const partenairesAutre = idxAutreSnap.exists() ? (idxAutreSnap.data().partenaires || {}) : {};
      partenairesAutre[uid] = { nom: userName, lastMsg: texte.trim() || 'Photo', lastTs: msg.ts, unreadCount: ((partenairesAutre[uid]&&partenairesAutre[uid].unreadCount)||0)+1 };
      await setDoc(idxRefAutre, { partenaires: partenairesAutre }, { merge: true });

      setTexte('');
      setPhoto('');
    } catch {}
    setEnvoi(false);
  };

  const timeAgo = (ts) => {
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60) return "a l'instant";
    if (d < 3600) return `il y a ${Math.floor(d / 60)} min`;
    if (d < 86400) return `il y a ${Math.floor(d / 3600)}h`;
    return `il y a ${Math.floor(d / 86400)}j`;
  };

  const membresFiltres = Object.entries(annuaire)
    .filter(([mUid, m]) => mUid !== uid)
    .filter(([mUid, m]) => {
      if (!recherche.trim()) return true;
      const s = recherche.toLowerCase();
      return ((m.prenom || '') + ' ' + (m.nom || '')).toLowerCase().includes(s);
    });

  const listeConversations = Object.entries(conversations).sort((a, b) => (b[1].lastTs || 0) - (a[1].lastTs || 0));

  if (ecran === 'conversation' && contactActif) {
    return (
      <div>
        <button onClick={() => { setEcran('liste'); chargerIndex(); }}
          style={{ background: 'none', border: 'none', color: C.rose, fontSize: '.78rem', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '.75rem', padding: 0 }}>
          ← Retour aux conversations
        </button>
        <div style={{ fontFamily: 'Georgia,serif', fontSize: '1.1rem', fontWeight: 600, color: C.brun, marginBottom: '.75rem' }}>
          {contactActif.nom}
        </div>
        <div style={{ background: C.creme, borderRadius: 12, padding: '.85rem', marginBottom: '.75rem', minHeight: 200, maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: C.gris, fontSize: '.78rem', padding: '1rem' }}>
              Aucun message pour l'instant. Dis bonjour !
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} style={{ alignSelf: m.de === uid ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
              <div style={{ background: m.de === uid ? C.rose : 'white', color: m.de === uid ? 'white' : C.texte, borderRadius: 12, padding: '.55rem .75rem', fontSize: '.8rem', lineHeight: 1.5 }}>
                {m.photo && <img src={m.photo} alt="" style={{ width: '100%', borderRadius: 8, marginBottom: m.texte ? '.4rem' : 0, display: 'block' }} />}
                {m.texte && <div>{m.texte}</div>}
              </div>
              <div style={{ fontSize: '.6rem', color: C.gris, marginTop: '.2rem', textAlign: m.de === uid ? 'right' : 'left' }}>
                {timeAgo(m.ts)}
              </div>
            </div>
          ))}
        </div>
        <UploadPhoto label="Photo (optionnel)" value={photo} onChange={(v) => setPhoto(v)} folder="messagerie" />
        <div style={{ display: 'flex', gap: '.4rem', marginTop: '.5rem' }}>
          <input value={texte} onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && envoyerMessage()}
            placeholder="Ecris ton message..."
            style={{ flex: 1, border: `1px solid ${C.pale}`, borderRadius: 10, padding: '.55rem .75rem', fontSize: '.8rem', fontFamily: 'inherit', color: C.texte, background: 'white', outline: 'none' }} />
          <button onClick={envoyerMessage} disabled={envoi || (!texte.trim() && !photo)}
            style={{ background: C.brun, color: 'white', border: 'none', borderRadius: 10, padding: '.55rem 1rem', fontSize: '.8rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
            Envoyer
          </button>
        </div>
      </div>
    );
  }

  if (ecran === 'recherche') {
    return (
      <div>
        <button onClick={() => setEcran('liste')}
          style={{ background: 'none', border: 'none', color: C.rose, fontSize: '.78rem', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '.75rem', padding: 0 }}>
          ← Retour aux conversations
        </button>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un membre..."
          style={{ width: '100%', border: `1px solid ${C.pale}`, borderRadius: 10, padding: '.55rem .75rem', fontSize: '.8rem', fontFamily: 'inherit', color: C.texte, background: 'white', outline: 'none', marginBottom: '.75rem' }} />
        {membresFiltres.map(([mUid, m]) => (
          <div key={mUid} onClick={() => ouvrirConversation(mUid, (m.prenom || '') + ' ' + (m.nom || ''))}
            style={{ display: 'flex', alignItems: 'center', gap: '.6rem', background: 'white', border: `1px solid ${C.pale}`, borderRadius: 10, padding: '.6rem .8rem', marginBottom: '.4rem', cursor: 'pointer' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.rose + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.8rem', fontWeight: 700, color: C.rose, flexShrink: 0 }}>
              {(m.prenom || '?')[0].toUpperCase()}
            </div>
            <div style={{ fontSize: '.8rem', color: C.texte, fontWeight: 600 }}>{m.prenom} {m.nom}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => setEcran('recherche')}
        style={{ width: '100%', background: C.brun, color: 'white', border: 'none', borderRadius: 10, padding: '.6rem', fontSize: '.8rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', marginBottom: '.75rem' }}>
        + Nouvelle conversation
      </button>
      {loading && <div style={{ textAlign: 'center', color: C.gris, fontSize: '.78rem', padding: '1rem' }}>Chargement...</div>}
      {!loading && listeConversations.length === 0 && (
        <div style={{ textAlign: 'center', color: C.gris, fontSize: '.78rem', padding: '1.5rem' }}>
          Aucune conversation pour l'instant.
        </div>
      )}
      {listeConversations.map(([mUid, c]) => (
        <div key={mUid} onClick={() => ouvrirConversation(mUid, c.nom)}
          style={{ display: 'flex', alignItems: 'center', gap: '.6rem', background: 'white', border: `1px solid ${c.unreadCount ? C.rose : C.pale}`, borderRadius: 10, padding: '.6rem .8rem', marginBottom: '.4rem', cursor: 'pointer' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.rose + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.85rem', fontWeight: 700, color: C.rose, flexShrink: 0 }}>
            {(c.nom || '?')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '.8rem', color: C.texte, fontWeight: c.unreadCount ? 700 : 600 }}>{c.nom}</div>
            <div style={{ fontSize: '.7rem', color: C.gris, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.lastMsg}</div>
          </div>
          {c.unreadCount > 0 && <div style={{ minWidth: 20, height: 20, borderRadius: 10, background: '#E63946', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 .3rem' }}><span style={{ color: 'white', fontSize: '.65rem', fontWeight: 700 }}>{c.unreadCount}</span></div>}
        </div>
      ))}
    </div>
  );
}

async function getUnreadMessagesCount(uid) {
  try {
    const snap = await getDoc(doc(db, 'messagerie_index', uid));
    if (!snap.exists()) return 0;
    const partenaires = snap.data().partenaires || {};
    return Object.values(partenaires).reduce((s, p) => s + (p.unreadCount || 0), 0);
  } catch { return 0; }
}

export { MessagerieTab, getUnreadMessagesCount };