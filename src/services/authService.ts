import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export const registerUser = async (email: string, password: string, displayName: string) => {
  try {
    // 1. Create the user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Update display name in Auth profile
    await updateProfile(user, { displayName });

    // 3. Create the user profile document in Firestore
    const userProfileRef = doc(db, 'userProfiles', user.uid);
    await setDoc(userProfileRef, {
      id: user.uid,
      email: user.email,
      displayName: displayName,
      createdAt: new Date().toISOString()
    });

    // 4. Create the email index document (Public/Read-only for search)
    // Ensures emails are lowercase for consistent indexing
    const emailIndexRef = doc(db, 'emailIndex', email.toLowerCase());
    await setDoc(emailIndexRef, {
      id: user.uid
    });

    return user;
  } catch (error) {
    console.error("Error en registro:", error);
    throw error;
  }
};

export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error en login:", error);
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    throw error;
  }
};
