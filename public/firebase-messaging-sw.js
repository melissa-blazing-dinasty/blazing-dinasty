importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBhsxeZe7JvliHh3kBRgRKSKA2XSiAUg9k",
  authDomain: "blazing-dinasty-1fad9.firebaseapp.com",
  projectId: "blazing-dinasty-1fad9",
  messagingSenderId: "499869328828",
  appId: "1:499869328828:web:28900482512a07ca3a77b9"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || 'Blazing Dynasty', {
    body: body || '',
    icon: '/logo192.png',
  });
});