import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  updateDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db } from '../firebase';

export interface Project {
  id: string;
  companyId: string;
  name: string;
  createdAt: any;
  adminIds: string[];
  supervisorIds: string[];
  collaboratorIds: string[];
  memberIds: string[]; // Unified array of all members in this project
  color: string;
}

export interface Team {
  id: string;
  projectId: string;
  name: string;
  memberIds: string[];
}

// 1. Create a new project inside a company
export const createProject = async (companyId: string, name: string, creatorId: string, color: string = '#000000') => {
  const projectRef = doc(collection(db, 'projects'));
  
  const newProject = {
    id: projectRef.id,
    companyId,
    name,
    createdAt: serverTimestamp(),
    adminIds: [creatorId],
    supervisorIds: [],
    collaboratorIds: [],
    memberIds: [creatorId], 
    color
  };

  await setDoc(projectRef, newProject);
  return newProject;
};

// 2. Get projects for a specific company where the user is a member
export const getCompanyProjects = async (companyId: string, userId: string) => {
  const projectsRef = collection(db, 'projects');
  
  // Only get projects from this company where the user is part of the project
  // NOTE: For simplicity, Owners/Managers of the company might need to see all projects.
  // For now, we fetch projects where the user is explicitly a member.
  const q = query(
    projectsRef, 
    where('companyId', '==', companyId),
    where('memberIds', 'array-contains', userId)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as Project);
};

// 2b. Get a single project
export const getProjectById = async (projectId: string) => {
  const docRef = doc(db, 'projects', projectId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as Project;
  }
  throw new Error("Proyecto no encontrado");
};

// 3. Add a user to a project (Requires admin rights handled via UI/Rules)
export const addUserToProject = async (projectId: string, userId: string, role: 'admin' | 'supervisor' | 'collaborator') => {
  const projectRef = doc(db, 'projects', projectId);
  
  const updates: any = {
    memberIds: arrayUnion(userId)
  };
  
  if (role === 'admin') updates.adminIds = arrayUnion(userId);
  if (role === 'supervisor') updates.supervisorIds = arrayUnion(userId);
  if (role === 'collaborator') updates.collaboratorIds = arrayUnion(userId);

  await updateDoc(projectRef, updates);
};

// 4. Remove a user from a project
export const removeUserFromProject = async (projectId: string, userId: string) => {
  const projectRef = doc(db, 'projects', projectId);
  
  await updateDoc(projectRef, {
    memberIds: arrayRemove(userId),
    adminIds: arrayRemove(userId),
    supervisorIds: arrayRemove(userId),
    collaboratorIds: arrayRemove(userId)
  });
};

// 5. Create a team inside a project
export const createTeam = async (projectId: string, name: string) => {
  const teamRef = doc(collection(db, `projects/${projectId}/teams`));
  
  const newTeam = {
    id: teamRef.id,
    projectId,
    name,
    memberIds: []
  };

  await setDoc(teamRef, newTeam);
  return newTeam;
};

// 6. Get all projects a user belongs to (Global)
export const getUserProjects = async (userId: string) => {
  const projectsRef = collection(db, 'projects');
  const q = query(projectsRef, where('memberIds', 'array-contains', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Project);
};
