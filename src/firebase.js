import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: 'AIzaSyBhsxeZe7JvliHh3kBRgRKSKA2XSiAUg9k',
  authDomain: 'blazing-dinasty-1fad9.firebaseapp.com',
  projectId: 'blazing-dinasty-1fad9',
  storageBucket: 'blazing-dinasty-1fad9.firebasestorage.app',
  messagingSenderId: '499869328828',
  appId: '1:499869328828:web:28900482512a07ca3a77b9',
};

export const fbApp = initializeApp(firebaseConfig);
export const db = getFirestore(fbApp);
export const storage = getStorage(fbApp);
export const auth = getAuth(fbApp);
export const functions = getFunctions(fbApp, 'us-central1');
export let messaging = null;
try { messaging = getMessaging(fbApp); } catch {}