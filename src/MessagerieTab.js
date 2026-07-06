import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref as storageRefMsg, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { C } from './constants';
import { UploadPhoto, UploadVideo } from './FormationProduitsTab';

function convId(a, b) {
  return [a, b].sort().join('_');
}

function newGroupId() {
  return 'groupe_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function VoiceRecorder({ uid, onChange, value, autoStart, onSent }) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(value || '');
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => setPreview(value || ''), [value]);
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStart && !autoStarted.current && !value) {
      autoStarted.current = true;
      demarrer();
    }
  }, [autoStart]);

  const demarrer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        clearInterval(timerRef.current);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setUploading(true);
        try {
          const path = `messagerie-vocaux/${uid}/${Date.now()}.webm`;
          const fileRef = storageRefMsg(storage, path);
          const uploadTask = uploadBytesResumable(fileRef, blob);
          uploadTask.on('state_changed', () => {}, (err) => {
            alert('Erreur upload vocal : ' + err.message);
            setUploading(false);
          }, async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            setPreview(url);
            onChange(url);
            setUploading(false);
            if (onSent) onSent(url);
          });
        } catch (err) {
          alert('Erreur : ' + err.message);
          setUploading(false);
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (err) {
      alert("Impossible d'acceder au microphone : " + err.message);
    }
  };

  const arreter = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const fmtSec = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (preview && !recording) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '.5rem' }}>
        <audio src={preview} controls style={{ flex: 1, height: 32 }} />
        <button onClick={() => { setPreview(''); onChange(''); }}
          style={{ background: 'none', border: `1px solid ${C.pale}`, borderRadius: 7, padding: '.3rem .5rem', fontSize: '.65rem', color: C.gris, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '.5rem' }}>
      {uploading ? (
        <div style={{ fontSize: '.72rem', color: C.gris, textAlign: 'center', padding: '.4rem' }}>Envoi du vocal...</div>
      ) : (
        <button onClick={recording ? arreter : demarrer}
          style={{ width: '100%', background: recording ? '#E63946' : 'white', border: `1.5px solid ${recording ? '#E63946' : C.pale}`, color: recording ? 'white' : C.texte, borderRadius: 10, padding: '.5rem', fontSize: '.78rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
          {recording ? `⏺ Enregistrement... ${fmtSec(seconds)} (toucher pour arreter et envoyer)` : '🎤 Message vocal'}
        </button>
      )}
    </div>
  );
}

function MessagerieTab({ uid, userName }) {
  const [ecran, setEcran] = useState('liste');
  const [conversations, setConversations] = useState({});
  const [loading, setLoading] = useState(true);
  const [annuaire, setAnnuaire] = useState({});
  const [recherche, setRecherche] = useState('');
  const [contactActif, setContactActif] = useState(null);
  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState('');
  const [photo, setPhoto] = useState('');
  const [video, setVideo] = useState('');
  const [vocal, setVocal] = useState('');
  const [modeJoint, setModeJoint] = useState(null); // null | 'photo' | 'video' | 'vocal'
  const [envoi, setEnvoi] = useState(false);
  const [groupeNom, setGroupeNom] = useState('');
  const [groupeMembres, setGroupeMembres] = useState([]);

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

  const ouvrirConversation = async (id, nom, isGroupe, participants) => {
    setContactActif({ id, nom, isGroupe: !!isGroupe, participants: participants || [uid, id] });
    setEcran('conversation');
    const cid = isGroupe ? id : convId(uid, id);
    try {
      const snap = await getDoc(doc(db, 'conversations', cid));
      setMessages(snap.exists() ? (snap.data().messages || []) : []);
    } catch {
      setMessages([]);
    }
    try {
      const idxRef = doc(db, 'messagerie_index', uid);
      const idxSnap = await getDoc(idxRef);
      const partenaires = idxSnap.exists() ? (idxSnap.data().partenaires || {}) : {};
      if (partenaires[id]) {
        partenaires[id] = { ...partenaires[id], unreadCount: 0 };
        await setDoc(idxRef, { partenaires }, { merge: true });
        setConversations(partenaires);
      }
    } catch {}
  };

  const apercuDernierMsg = (texte, photo, video, vocal) => {
    if (texte) return texte;
    if (photo) return 'Photo';
    if (video) return 'Video';
    if (vocal) return 'Message vocal';
    return '';
  };

  const envoyerMessage = async (vocalOverride) => {
    const vocalAEnvoyer = vocalOverride || vocal;
    if (!texte.trim() && !photo && !video && !vocalAEnvoyer) return;
    if (!contactActif) return;
    setEnvoi(true);
    try {
      const cid = contactActif.isGroupe ? contactActif.id : convId(uid, contactActif.id);
      const msg = {
        id: 'm' + Date.now(),
        de: uid,
        deNom: userName,
        texte: texte.trim(),
        photo: photo || '',
        video: video || '',
        vocal: vocalAEnvoyer || '',
        ts: Date.now(),
      };
      const next = [...messages, msg];
      setMessages(next);
      const participants = contactActif.isGroupe ? contactActif.participants : [uid, contactActif.id];
      await setDoc(doc(db, 'conversations', cid), {
        messages: next,
        participants,
        isGroupe: !!contactActif.isGroupe,
        nomGroupe: contactActif.isGroupe ? contactActif.nom : '',
      }, { merge: true });

      const apercu = apercuDernierMsg(texte.trim(), photo, video, vocalAEnvoyer);

      const idxRefMoi = doc(db, 'messagerie_index', uid);
      const idxMoiSnap = await getDoc(idxRefMoi);
      const partenairesMoi = idxMoiSnap.exists() ? (idxMoiSnap.data().partenaires || {}) : {};
      partenairesMoi[contactActif.id] = { nom: contactActif.nom, lastMsg: apercu, lastTs: msg.ts, unreadCount: 0, isGroupe: !!contactActif.isGroupe, participants: contactActif.isGroupe ? participants : undefined };
      await setDoc(idxRefMoi, { partenaires: partenairesMoi }, { merge: true });
      setConversations(partenairesMoi);

      const autresParticipants = participants.filter(p => p !== uid);
      for (const autreUid of autresParticipants) {
        try {
          const idxRefAutre = doc(db, 'messagerie_index', autreUid);
          const idxAutreSnap = await getDoc(idxRefAutre);
          const partenairesAutre = idxAutreSnap.exists() ? (idxAutreSnap.data().partenaires || {}) : {};
          const cleAutre = contactActif.isGroupe ? contactActif.id : uid;
          const nomPourAutre = contactActif.isGroupe ? contactActif.nom : userName;
          partenairesAutre[cleAutre] = {
            nom: nomPourAutre,
            lastMsg: (contactActif.isGroupe ? (userName + ': ') : '') + apercu,
            lastTs: msg.ts,
            unreadCount: ((partenairesAutre[cleAutre] && partenairesAutre[cleAutre].unreadCount) || 0) + 1,
            isGroupe: !!contactActif.isGroupe,
            participants: contactActif.isGroupe ? participants : undefined,
          };
          await setDoc(idxRefAutre, { partenaires: partenairesAutre }, { merge: true });
        } catch {}
      }

      setTexte('');
      setPhoto('');
      setVideo('');
      setVocal('');
      setModeJoint(null);
    } catch {}
    setEnvoi(false);
  };

  const creerGroupe = async () => {
    if (!groupeNom.trim() || groupeMembres.length === 0) return;
    const gid = newGroupId();
    const participants = [uid, ...groupeMembres];
    try {
      await setDoc(doc(db, 'conversations', gid), { messages: [], participants, isGroupe: true, nomGroupe: groupeNom.trim() }, { merge: true });
      for (const p of participants) {
        try {
          const idxRef = doc(db, 'messagerie_index', p);
          const idxSnap = await getDoc(idxRef);
          const partenaires = idxSnap.exists() ? (idxSnap.data().partenaires || {}) : {};
          partenaires[gid] = { nom: groupeNom.trim(), lastMsg: 'Groupe cree', lastTs: Date.now(), unreadCount: 0, isGroupe: true, participants };
          await setDoc(idxRef, { partenaires }, { merge: true });
        } catch {}
      }
      setGroupeNom('');
      setGroupeMembres([]);
      await chargerIndex();
      ouvrirConversation(gid, groupeNom.trim(), true, participants);
    } catch {}
  };

  const toggleMembreGroupe = (mUid) => {
    setGroupeMembres(cur => cur.includes(mUid) ? cur.filter(x => x !== mUid) : [...cur, mUid]);
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

  if (ecran === 'creerGroupe') {
    return (
      <div>
        <button onClick={() => { setEcran('liste'); setGroupeNom(''); setGroupeMembres([]); }}
          style={{ background: 'none', border: 'none', color: C.rose, fontSize: '.78rem', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '.75rem', padding: 0 }}>
          ← Retour aux conversations
        </button>
        <div style={{ fontFamily: 'Georgia,serif', fontSize: '1rem', fontWeight: 600, color: C.brun, marginBottom: '.6rem' }}>
          Nouveau groupe
        </div>
        <input value={groupeNom} onChange={(e) => setGroupeNom(e.target.value)}
          placeholder="Nom du groupe (ex: Equipe Marseille)"
          style={{ width: '100%', border: `1px solid ${C.pale}`, borderRadius: 10, padding: '.55rem .75rem', fontSize: '.8rem', fontFamily: 'inherit', color: C.texte, background: 'white', outline: 'none', marginBottom: '.6rem' }} />
        <div style={{ fontSize: '.7rem', color: C.gris, marginBottom: '.4rem' }}>Choisis les membres ({groupeMembres.length} selectionne{groupeMembres.length > 1 ? 's' : ''})</div>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un membre..."
          style={{ width: '100%', border: `1px solid ${C.pale}`, borderRadius: 10, padding: '.5rem .7rem', fontSize: '.78rem', fontFamily: 'inherit', color: C.texte, background: 'white', outline: 'none', marginBottom: '.6rem' }} />
        <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: '.75rem' }}>
          {membresFiltres.map(([mUid, m]) => {
            const selectionne = groupeMembres.includes(mUid);
            return (
              <div key={mUid} onClick={() => toggleMembreGroupe(mUid)}
                style={{ display: 'flex', alignItems: 'center', gap: '.6rem', background: selectionne ? C.rose + '15' : 'white', border: `1.5px solid ${selectionne ? C.rose : C.pale}`, borderRadius: 10, padding: '.55rem .7rem', marginBottom: '.35rem', cursor: 'pointer' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.rose + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', fontWeight: 700, color: C.rose, flexShrink: 0 }}>
                  {(m.prenom || '?')[0].toUpperCase()}
                </div>
                <div style={{ fontSize: '.78rem', color: C.texte, fontWeight: 600, flex: 1 }}>{m.prenom} {m.nom}</div>
                {selectionne && <span style={{ color: C.rose, fontSize: '.9rem' }}>✓</span>}
              </div>
            );
          })}
        </div>
        <button onClick={creerGroupe} disabled={!groupeNom.trim() || groupeMembres.length === 0}
          style={{ width: '100%', background: (!groupeNom.trim() || groupeMembres.length === 0) ? C.pale : C.brun, color: 'white', border: 'none', borderRadius: 10, padding: '.6rem', fontSize: '.8rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
          Creer le groupe
        </button>
      </div>
    );
  }

  if (ecran === 'conversation' && contactActif) {
    return (
      <div>
        <button onClick={() => { setEcran('liste'); chargerIndex(); setModeJoint(null); }}
          style={{ background: 'none', border: 'none', color: C.rose, fontSize: '.78rem', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '.75rem', padding: 0 }}>
          ← Retour aux conversations
        </button>
        <div style={{ fontFamily: 'Georgia,serif', fontSize: '1.1rem', fontWeight: 600, color: C.brun, marginBottom: '.75rem' }}>
          {contactActif.isGroupe && '👥 '}{contactActif.nom}
          {contactActif.isGroupe && <div style={{ fontSize: '.65rem', color: C.gris, fontWeight: 400, marginTop: '.15rem' }}>{contactActif.participants.length} membres</div>}
        </div>
        <div style={{ background: C.creme, borderRadius: 12, padding: '.85rem', marginBottom: '.75rem', minHeight: 200, maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: C.gris, fontSize: '.78rem', padding: '1rem' }}>
              Aucun message pour l'instant. Dis bonjour !
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} style={{ alignSelf: m.de === uid ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
              {contactActif.isGroupe && m.de !== uid && (
                <div style={{ fontSize: '.62rem', color: C.rose, fontWeight: 700, marginBottom: '.15rem', marginLeft: '.2rem' }}>{m.deNom}</div>
              )}
              <div style={{ background: m.de === uid ? C.rose : 'white', color: m.de === uid ? 'white' : C.texte, borderRadius: 12, padding: '.55rem .75rem', fontSize: '.8rem', lineHeight: 1.5 }}>
                {m.photo && <img src={m.photo} alt="" style={{ width: '100%', borderRadius: 8, marginBottom: (m.texte || m.video || m.vocal) ? '.4rem' : 0, display: 'block' }} />}
                {m.video && <video src={m.video} controls style={{ width: '100%', borderRadius: 8, marginBottom: (m.texte || m.vocal) ? '.4rem' : 0, display: 'block' }} />}
                {m.vocal && <audio src={m.vocal} controls style={{ width: '100%', marginBottom: (m.texte) ? '.4rem' : 0, display: 'block' }} />}
                {m.texte && <div>{m.texte}</div>}
              </div>
              <div style={{ fontSize: '.6rem', color: C.gris, marginTop: '.2rem', textAlign: m.de === uid ? 'right' : 'left' }}>
                {timeAgo(m.ts)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '.3rem', marginBottom: '.5rem' }}>
          <button onClick={() => setModeJoint(modeJoint === 'photo' ? null : 'photo')}
            style={{ flex: 1, background: modeJoint === 'photo' ? C.rose : 'white', color: modeJoint === 'photo' ? 'white' : C.texte, border: `1px solid ${modeJoint === 'photo' ? C.rose : C.pale}`, borderRadius: 8, padding: '.4rem', fontSize: '.68rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
            📷 Photo
          </button>
          <button onClick={() => setModeJoint(modeJoint === 'video' ? null : 'video')}
            style={{ flex: 1, background: modeJoint === 'video' ? C.rose : 'white', color: modeJoint === 'video' ? 'white' : C.texte, border: `1px solid ${modeJoint === 'video' ? C.rose : C.pale}`, borderRadius: 8, padding: '.4rem', fontSize: '.68rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
            🎬 Video
          </button>
          <button onClick={() => setModeJoint(modeJoint === 'vocal' ? null : 'vocal')}
            style={{ flex: 1, background: modeJoint === 'vocal' ? C.rose : 'white', color: modeJoint === 'vocal' ? 'white' : C.texte, border: `1px solid ${modeJoint === 'vocal' ? C.rose : C.pale}`, borderRadius: 8, padding: '.4rem', fontSize: '.68rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
            🎤 Vocal
          </button>
        </div>

        {modeJoint === 'photo' && <UploadPhoto label="Photo" value={photo} onChange={(v) => setPhoto(v)} folder="messagerie" />}
        {modeJoint === 'video' && <UploadVideo label="Video" value={video} onChange={(v) => setVideo(v)} folder="messagerie-videos" uid={uid} />}
        {modeJoint === 'vocal' && <VoiceRecorder uid={uid} value={vocal} onChange={(v) => setVocal(v)} autoStart={true} onSent={(url) => envoyerMessage(url)} />}

        <div style={{ display: 'flex', gap: '.4rem', marginTop: '.5rem' }}>
          <input value={texte} onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && envoyerMessage()}
            placeholder="Ecris ton message..."
            style={{ flex: 1, border: `1px solid ${C.pale}`, borderRadius: 10, padding: '.55rem .75rem', fontSize: '.8rem', fontFamily: 'inherit', color: C.texte, background: 'white', outline: 'none' }} />
          <button onClick={() => envoyerMessage()} disabled={envoi || (!texte.trim() && !photo && !video && !vocal)}
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
          <div key={mUid} onClick={() => ouvrirConversation(mUid, (m.prenom || '') + ' ' + (m.nom || ''), false)}
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
      <div style={{ display: 'flex', gap: '.4rem', marginBottom: '.75rem' }}>
        <button onClick={() => setEcran('recherche')}
          style={{ flex: 1, background: C.brun, color: 'white', border: 'none', borderRadius: 10, padding: '.6rem', fontSize: '.75rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
          + Conversation
        </button>
        <button onClick={() => setEcran('creerGroupe')}
          style={{ flex: 1, background: 'white', border: `1.5px solid ${C.brun}`, color: C.brun, borderRadius: 10, padding: '.6rem', fontSize: '.75rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
          + Groupe
        </button>
      </div>
      {loading && <div style={{ textAlign: 'center', color: C.gris, fontSize: '.78rem', padding: '1rem' }}>Chargement...</div>}
      {!loading && listeConversations.length === 0 && (
        <div style={{ textAlign: 'center', color: C.gris, fontSize: '.78rem', padding: '1.5rem' }}>
          Aucune conversation pour l'instant.
        </div>
      )}
      {listeConversations.map(([cid, c]) => (
        <div key={cid} onClick={() => ouvrirConversation(cid, c.nom, c.isGroupe, c.participants)}
          style={{ display: 'flex', alignItems: 'center', gap: '.6rem', background: 'white', border: `1px solid ${c.unreadCount > 0 ? C.rose : C.pale}`, borderRadius: 10, padding: '.6rem .8rem', marginBottom: '.4rem', cursor: 'pointer' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.rose + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.85rem', fontWeight: 700, color: C.rose, flexShrink: 0 }}>
            {c.isGroupe ? '👥' : (c.nom || '?')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '.8rem', color: C.texte, fontWeight: c.unreadCount > 0 ? 700 : 600 }}>{c.nom}</div>
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