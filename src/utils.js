import { db } from './firebase';
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';
import { messaging } from './firebase';

export async function saveFCMToken(uid) {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
    const token = await getToken(messaging, {
      vapidKey: 'BFI7Uodh64p0EnejAc9xQ6y0hOS0w4CVA2QO-3mCxFmcm13orUtX7mYDwSRuaS8iDs8ovcClbKj2j2JzMi47sRE'
    });
    if (token) await setDoc(doc(db, 'fcm_tokens', uid), { web: token });
  } catch {}
}

export async function sg(uid, k) {
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return data[k];
    }
  } catch {}
}

export async function ss(uid, k, v) {
  try {
    const ref = doc(db, 'users', uid);
    await setDoc(ref, { [k]: v }, { merge: true });
  } catch {}
}

export async function sgAll(uid) {
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data();
  } catch {}
}

export function todayLocalStr() {
  const d = new Date();
  return d.getFullYear()+'-'+(String(d.getMonth()+1).padStart(2,'0'))+'-'+String(d.getDate()).padStart(2,'0');
}