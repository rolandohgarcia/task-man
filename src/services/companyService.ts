import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { db } from '../firebase';

export interface Company {
  id: string;
  name: string;
  createdAt: any;
  ownerIds: string[];
  managerIds: string[];
  userIds: string[];
  memberIds: string[];
  pendingMembers: string[];
}

// 1. Create a new company
export const createCompany = async (name: string, ownerId: string) => {
  const companyRef = doc(collection(db, 'companies'));
  
  const newCompany = {
    id: companyRef.id,
    name,
    createdAt: serverTimestamp(),
    ownerIds: [ownerId],
    managerIds: [],
    userIds: [],
    memberIds: [ownerId], // Unified array for easy querying
    pendingMembers: []
  };

  await setDoc(companyRef, newCompany);
  return newCompany;
};

// 2. Get companies where the user is a member OR has a pending invitation
export const getUserCompanies = async (userId: string) => {
  const companiesRef = collection(db, 'companies');
  
  // Queries for active memberships
  const activeQuery = query(companiesRef, where('memberIds', 'array-contains', userId));
  const activeDocs = await getDocs(activeQuery);
  
  // Queries for pending invitations
  const pendingQuery = query(companiesRef, where('pendingMembers', 'array-contains', userId));
  const pendingDocs = await getDocs(pendingQuery);

  const activeCompanies = activeDocs.docs.map(d => d.data() as Company);
  const pendingCompanies = pendingDocs.docs.map(d => d.data() as Company);

  return { activeCompanies, pendingCompanies };
};

// 2b. Get a single company by ID
export const getCompanyById = async (companyId: string) => {
  const docRef = doc(db, 'companies', companyId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as Company;
  }
  throw new Error("Empresa no encontrada");
};

// 3. Handshake 1: Invite User by Email
export const inviteUserByEmail = async (companyId: string, email: string) => {
  // 3a. Look up the email in the public index
  const emailIndexRef = doc(db, 'emailIndex', email.toLowerCase());
  const emailDoc = await getDoc(emailIndexRef);

  if (!emailDoc.exists()) {
    throw new Error('User not found. They must register in the app first.');
  }

  const userIdToInvite = emailDoc.data().id;

  // 3b. Add userId to pendingMembers
  const companyRef = doc(db, 'companies', companyId);
  await updateDoc(companyRef, {
    pendingMembers: arrayUnion(userIdToInvite)
  });

  return userIdToInvite;
};

// 4. Handshake 2: Accept Invitation (Atomic)
export const acceptInvitation = async (companyId: string, userId: string) => {
  const companyRef = doc(db, 'companies', companyId);

  // We use a transaction to ensure atomicity. 
  // It removes the user from pending and adds them to active members at the exact same time.
  await runTransaction(db, async (transaction) => {
    const companyDoc = await transaction.get(companyRef);
    if (!companyDoc.exists()) {
      throw new Error("Company does not exist!");
    }

    const data = companyDoc.data();
    if (!data.pendingMembers || !data.pendingMembers.includes(userId)) {
      throw new Error("You do not have a pending invitation for this company.");
    }

    // Prepare arrays
    const newPending = data.pendingMembers.filter((id: string) => id !== userId);
    const newMembers = [...(data.memberIds || []), userId];
    const newUserIds = [...(data.userIds || []), userId];

    transaction.update(companyRef, {
      pendingMembers: newPending,
      memberIds: newMembers,
      userIds: newUserIds
    });
  });
};

// 5. Remove User from Company (Admin only)
export const removeUserFromCompany = async (companyId: string, userId: string) => {
  const companyRef = doc(db, 'companies', companyId);
  await updateDoc(companyRef, {
    memberIds: arrayRemove(userId),
    ownerIds: arrayRemove(userId),
    managerIds: arrayRemove(userId),
    userIds: arrayRemove(userId)
  });
};

// 6. Revoke pending invitation
export const revokeInvitation = async (companyId: string, userId: string) => {
  const companyRef = doc(db, 'companies', companyId);
  await updateDoc(companyRef, {
    pendingMembers: arrayRemove(userId)
  });
};
