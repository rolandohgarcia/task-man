import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableMultiTabIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";
import { getInstallations, getToken as getInstallationsToken } from "firebase/installations";
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: isLocalhost ? "1:851609085907:web:f9b95b4c639b3d79d5f126" : "1:851609085907:web:d0970a0dde88357bd5f126",
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
      
      // --- DEBUG MASIVO ---
      console.log('[PUSH] [DEBUG MASIVO] 1. Probando Firebase Installations...');
      let debugFisToken = "";
      try {
        const { getInstallations, getToken: getInstallationsToken } = await import("firebase/installations");
        const installations = getInstallations(app);
        debugFisToken = await getInstallationsToken(installations);
        console.log('[PUSH] [DEBUG MASIVO] 2. FIS Token:', debugFisToken ? debugFisToken.substring(0, 15) + '...' : 'VACÍO');
      } catch (e) {
        console.error('[PUSH] [DEBUG MASIVO] Error obteniendo FIS Token:', e);
      }

      console.log('[PUSH] [DEBUG MASIVO] 3. Probando petición RAW a fcmregistrations...');
      try {
        if (registration && debugFisToken) {
          const sub = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKey
          });
          
          const p256dhBuffer = sub.getKey('p256dh') as ArrayBuffer;
          const authBuffer = sub.getKey('auth') as ArrayBuffer;
          
          if (p256dhBuffer && authBuffer) {
            const p256dh = btoa(String.fromCharCode.apply(null, new Uint8Array(p256dhBuffer) as unknown as number[])).replace(/\+/g, '-').replace(/\//g, '_');
            const auth = btoa(String.fromCharCode.apply(null, new Uint8Array(authBuffer) as unknown as number[])).replace(/\+/g, '-').replace(/\//g, '_');
            
            const res = await fetch(`https://fcmregistrations.googleapis.com/v1/projects/${firebaseConfig.projectId}/registrations`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': firebaseConfig.apiKey || "",
                'x-goog-firebase-installations-auth': debugFisToken,
              },
              body: JSON.stringify({
                web: {
                  endpoint: sub.endpoint,
                  p256dh: p256dh,
                  auth: auth
                }
              })
            });
            const body = await res.text();
            console.log(`[PUSH] [DEBUG MASIVO RAW HTTP] Status: ${res.status} Body: ${body}`);
          }
        }
      } catch (e) {
        console.error('[PUSH] [DEBUG MASIVO] Error en petición RAW:', e);
      }
      // --------------------

      try {
        const currentToken = await getToken(messaging, { 
          vapidKey,
          serviceWorkerRegistration: registration
        });
        
        if (currentToken) {
          console.log('[PUSH] Token obtenido con éxito:', currentToken.substring(0, 15) + '...');
          return currentToken;
        } else {
          console.log('[PUSH] No se pudo obtener el token (no disponible).');
          return null;
        }
      } catch (err: any) {
        console.error('[PUSH] ERROR CRÍTICO obteniendo el token:', err);
        
        // Auto-curación: Si el token falla por 401/Unauthorized
        if (err.message && err.message.includes('authentication credential')) {
          console.log('[PUSH] AUTO-CURACIÓN: Detectado caché corrupto o AppID viejo. Limpiando datos de FCM locales...');
          try {
            if (!sessionStorage.getItem('fcm_healed')) {
              sessionStorage.setItem('fcm_healed', 'true');
              // 1. Destruir la suscripción Push nativa del navegador
              const regs = await navigator.serviceWorker.getRegistrations();
              for (let r of regs) {
                if (r.pushManager) {
                  const sub = await r.pushManager.getSubscription();
                  if (sub) {
                    console.log('[PUSH] Destruyendo suscripción Push nativa...');
                    await sub.unsubscribe();
                  }
                }
                await r.unregister();
              }
              // 2. Borrar las bases de datos de IndexedDB usadas por Firebase FCM e Installations
              indexedDB.deleteDatabase('firebase-installations-database');
              indexedDB.deleteDatabase('firebase-messaging-database');
              indexedDB.deleteDatabase('fcm_token_details_db');
              
              alert("Limpieza profunda de notificaciones completada. La página se recargará para aplicar los cambios.");
              window.location.reload();
            } else {
              console.error('[PUSH] La auto-curación ya se ejecutó en esta sesión y no funcionó.');
            }
          } catch (cleanupErr) {
            console.error('[PUSH] Error durante la auto-curación:', cleanupErr);
          }
        }
        
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
