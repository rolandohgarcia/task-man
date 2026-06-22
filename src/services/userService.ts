import { collection, doc, query, where, getDocs, updateDoc, documentId } from 'firebase/firestore';
import { db } from '../firebase';

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  emoji?: string;
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
