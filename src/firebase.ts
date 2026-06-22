import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableMultiTabIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable Offline Persistence
enableMultiTabIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a a time.');
  } else if (err.code === 'unimplemented') {
    console.warn('The current browser does not support all of the features required to enable persistence');
  }
});

export const storage = getStorage(app);

// Messaging is tricky on mobile web (especially iOS), so we export a function 
// to initialize it safely only when needed and supported.
export const getMessagingInstance = async () => {
  try {
    const { isSupported } = await import("firebase/messaging");
    const supported = await isSupported();
    if (supported) {
      return getMessaging(app);
    }
    return null;
  } catch (error) {
    console.error("Firebase Messaging not supported", error);
    return null;
  }
};

export const requestNotificationPermission = async () => {
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) return null;
    
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const { getToken } = await import('firebase/messaging');
      // Asegúrate de que VITE_FIREBASE_VAPID_KEY esté en el archivo .env
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        console.warn('Falta el VAPID_KEY en .env para notificaciones push');
        return null;
      }
      
      const currentToken = await getToken(messaging, { vapidKey });
      if (currentToken) {
        return currentToken;
      } else {
        console.log('No se pudo obtener el token de registro. Pide permisos para generar uno.');
        return null;
      }
    } else {
      console.log('Permiso de notificación no concedido.');
      return null;
    }
  } catch (error) {
    console.error('Ocurrió un error al intentar obtener el token.', error);
    return null;
  }
};

export default app;
