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
        partenaires[autreUid] = { ...partenaires[autreUid], unread: false };
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
      await setDoc(doc(db, 'conversations', cid), { messages: next, participants: