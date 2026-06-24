importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyB277QJjuZjdlxC-lQvajd3ag3RYQNhKls",
  authDomain: "task-man-3ca46.firebaseapp.com",
  projectId: "task-man-3ca46",
  storageBucket: "task-man-3ca46.firebasestorage.app",
  messagingSenderId: "851609085907",
  appId: "1:851609085907:web:f9b95b4c639b3d79d5f126",
  measurementId: "G-28XVXWBGDT"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/tasks.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
