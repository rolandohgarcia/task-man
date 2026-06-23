import { collection, doc, query, where, getDocs, updateDoc, documentId } from 'firebase/firestore';
import { db } from '../firebase';

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  emoji?: string;
  fcmTokens?: string[];
}

export const getUsersByIds = async (userIds: string[]) => {
  if (!userIds || userIds.length === 0) return [];
  
  // Firestore 'in' query supports up to 10 items.
  // For a robust app we'd chunk this, but for MVP < 10 is fine for a single query,
  // or we can chunk it if we want to be safe.
  const chunks = [];
  for (let i = 0; i < userIds.length; i += 10) {
    chunks.push(userIds.slice(i, i + 10));
  }

  let allUsers: UserProfile[] = [];

  for (const chunk of chunks) {
    const q = query(collection(db, 'userProfiles'), where(documentId(), 'in', chunk));
    const snapshot = await getDocs(q);
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
    allUsers = [...allUsers, ...users];
  }

  return allUsers;
};

// Update user profile (Name and Emoji)
export const updateUserProfile = async (userId: string, data: Partial<UserProfile>) => {
  const docRef = doc(db, 'userProfiles', userId);
  await updateDoc(docRef, data);
};

import { getDoc } from 'firebase/firestore';

export const addFcmTokenToProfile = async (userId: string, token: string) => {
  const docRef = doc(db, 'userProfiles', userId);
  const userSnap = await getDoc(docRef);
  
  if (userSnap.exists()) {
    const data = userSnap.data() as UserProfile;
    let tokens = data.fcmTokens || [];
    
    // Si el usuario tenía fcmToken viejo (string), lo agregamos al arreglo
    if (data.fcmToken && !tokens.includes(data.fcmToken)) {
      tokens.push(data.fcmToken);
    }
    
    // Removemos el token si ya existía para volver a ponerlo al final (como más reciente)
    tokens = tokens.filter(t => t !== token);
    
    // Añadimos el nuevo al principio
    tokens.unshift(token);
    
    // Conservamos solo los primeros 4 (los más recientes)
    if (tokens.length > 4) {
      tokens = tokens.slice(0, 4);
    }
    
    await updateDoc(docRef, {
      fcmTokens: tokens
    });
  } else {
    // Si por alguna razón el perfil no existiera
    await updateDoc(docRef, {
      fcmTokens: [token]
    });
  }
};
