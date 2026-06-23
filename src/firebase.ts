import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableMultiTabIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";
import { getInstallations, getToken as getInstallationsToken } from "firebase/installations";
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: "1:851609085907:web:d0970a0dde88357bd5f126", // Forzado para Firebase App Hosting
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Se ha quitado enableMultiTabIndexedDbPersistence temporalmente para evitar bloqueos
// con el Service Worker y el token de Installations.

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
  console.log('[PUSH] Iniciando requestNotificationPermission...');
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) {
      console.log('[PUSH] No se pudo obtener la instancia de messaging (posiblemente no soportado).');
      return null;
    }
    
    console.log('[PUSH] Estado de permiso actual:', Notification.permission);
    let permission = Notification.permission;
    if (permission !== 'granted') {
      console.log('[PUSH] Solicitando permiso al usuario...');
      permission = await Notification.requestPermission();
      console.log('[PUSH] Resultado de la solicitud:', permission);
    }
    
    if (permission === 'granted') {
      const { getToken } = await import('firebase/messaging');
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        console.error('[PUSH] ERROR: Falta el VAPID_KEY en .env');
        return null;
      }
      
      console.log('[PUSH] [DEBUG CONFIG] Verificando variables exactas:');
      console.log('AppID:', firebaseConfig.appId);
      console.log('ProjectID:', firebaseConfig.projectId);
      console.log('API Key length:', firebaseConfig.apiKey.length);
      console.log('VAPID Key length:', vapidKey.length);
      console.log('VAPID Key:', vapidKey);
      
      console.log('[PUSH] Registrando Service Worker manualmente...');
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('[PUSH] Esperando a que el SW esté listo...');
      await navigator.serviceWorker.ready;
      console.log('[PUSH] SW Registrado y Activo:', registration.scope);

      console.log('[PUSH] Obteniendo token de FCM...');
      const currentToken = await getToken(messaging, { 
        vapidKey,
        serviceWorkerRegistration: registration
      });
      
      if (currentToken) {
        console.log('[PUSH] Token obtenido con éxito:', currentToken.substring(0, 15) + '...');
        return currentToken;
      } else {
        console.warn('[PUSH] No se pudo obtener el token (currentToken es nulo).');
        return null;
      }
    } else {
      console.warn('[PUSH] Permiso de notificación no concedido. Estado:', permission);
      return null;
    }
  } catch (error) {
    console.error('[PUSH] ERROR CRÍTICO obteniendo el token:', error);
    return null;
  }
};

export default app;
