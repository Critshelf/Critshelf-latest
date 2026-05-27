// Import and initialize the Firebase Admin SDK.
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  projectId: "gen-lang-client-0089099566",
  appId: "1:230593991410:web:d1decc78cee40b31bc366b",
  apiKey: "AIzaSyA-NHXH4Ir1IrG7t5wNUUBXv5QYDolNejo",
  authDomain: "gen-lang-client-0089099566.firebaseapp.com",
  messagingSenderId: "230593991410",
  storageBucket: "gen-lang-client-0089099566.firebasestorage.app"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/icon.png', // replace with actual icon path if available
    data: payload.data
  };
  
  self.registration.showNotification(notificationTitle, notificationOptions);
});
