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
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import imageCompression from 'browser-image-compression';

export interface Task {
  id: string;
  projectId: string;
  companyId: string;
  title: string;
  description: string;
  priority: 'Critica' | 'Alta' | 'Media' | 'Baja';
  deadline: string;
  createdBy?: string;
  assignedUserIds: string[];
  assignedTeamIds: string[];
  progress: number;
  isComplete: boolean;
  requiresEvidence: boolean;
  referenceImages: string[];
  createdAt: any;
  updatedAt: any;
}

export interface TaskUpdate {
  id: string;
  taskId: string;
  userId: string;
  comment: string;
  progressReported: number;
  photoUrl?: string | null; // Legacy
  photoUrls?: string[]; // Multiple photos support
  createdAt: any;
}

export type RecurrenceType = 'daily_interval' | 'weekly' | 'monthly_date' | 'yearly_date' | 'monthly_interval' | 'monthly_specific_day';

export interface RecurrenceConfig {
  interval?: number; // Para daily_interval y monthly_interval (ej. cada X días o meses)
  daysOfWeek?: number[]; // Para weekly (0=Dom, 1=Lun...)
  dayOfMonth?: number; // Para monthly_date (1-31)
  targetDate?: string; // Para yearly_date (YYYY-MM-DD o MM-DD, usaremos una fecha completa de referencia)
  weekOfMonth?: number; // Para monthly_specific_day (1, 2, 3, 4, -1 para último)
  dayOfWeek?: number; // Para monthly_specific_day (0-6)
}

export interface RecurringTask {
  id: string;
  projectId: string;
  companyId: string;
  
  title: string;
  description?: string;
  priority: 'Baja' | 'Media' | 'Alta' | 'Urgente';
  assignedUserIds: string[];
  requiresEvidence: boolean;
  referenceImages?: string[];
  
  recurrenceType: RecurrenceType;
  recurrenceConfig: RecurrenceConfig;
  
  durationDays: number; // Tiempo para completar (usado para calcular el deadline de las tareas generadas)
  
  nextScheduledDate: string; // Formato YYYY-MM-DD
  endDate?: string; // Fecha en la que deja de generarse (opcional)
  isActive: boolean;
  
  createdAt: any;
  updatedAt: any;
}

// 1. Create a new task in a project
export const createTask = async (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'progress' | 'isComplete'>) => {
  const taskRef = doc(collection(db, 'tasks')); // Flat tasks collection
  
  const newTask = {
    id: taskRef.id,
    ...data,
    progress: 0,
    isComplete: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(taskRef, newTask);
  return newTask;
};

// 2. Get Tasks for a Project
export const getProjectTasks = async (projectId: string) => {
  const tasksRef = collection(db, 'tasks');
  const q = query(
    tasksRef, 
    where('projectId', '==', projectId)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as Task);
};

export const subscribeToProjectTasks = (projectId: string, callback: (tasks: Task[]) => void) => {
  const tasksRef = collection(db, 'tasks');
  const q = query(tasksRef, where('projectId', '==', projectId));
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => doc.data() as Task);
    callback(tasks);
  });
};

// 2b. Get a single task by ID
export const getTaskById = async (taskId: string) => {
  const taskRef = doc(db, 'tasks', taskId);
  const taskSnap = await getDoc(taskRef);
  if (taskSnap.exists()) {
    return taskSnap.data() as Task;
  }
  return null;
};

export const subscribeToTaskById = (taskId: string, callback: (task: Task | null) => void) => {
  const taskRef = doc(db, 'tasks', taskId);
  return onSnapshot(taskRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as Task);
    } else {
      callback(null);
    }
  });
};

// 3. Compress Image (Client Side)
const compressImage = async (imageFile: File) => {
  const options = {
    maxSizeMB: 0.5, // 500 KB max
    maxWidthOrHeight: 1024,
    useWebWorker: true,
    fileType: 'image/webp' // Convert to WebP for better compression
  };
  try {
    return await imageCompression(imageFile, options);
  } catch (error) {
    console.error("Compression error:", error);
    throw error;
  }
};

// 4. Create an Update (Evidence)
export const createTaskUpdate = async (
  taskId: string, 
  userId: string, 
  comment: string, 
  newProgress: number, 
  photoFiles?: File[]
) => {
  const photoUrls: string[] = [];

  // If there are photos, compress and upload them to Storage
  if (photoFiles && photoFiles.length > 0) {
    for (const file of photoFiles) {
      const compressedFile = await compressImage(file);
      // Generate a unique name using random string + timestamp
      const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
      const storageRef = ref(storage, `task_evidences/${taskId}/${uniqueName}`);
      const snapshot = await uploadBytes(storageRef, compressedFile);
      const url = await getDownloadURL(snapshot.ref);
      photoUrls.push(url);
    }
  }

  const updateRef = doc(collection(db, `tasks/${taskId}/updates`));
  const newUpdate: TaskUpdate = {
    id: updateRef.id,
    taskId,
    userId,
    comment,
    progressReported: newProgress,
    photoUrls,
    createdAt: serverTimestamp()
  };

  // Run atomically (optional here, but we update both the subcollection and the main task)
  await setDoc(updateRef, newUpdate);
  
  // Update the master task progress
  const taskRef = doc(db, 'tasks', taskId);
  await updateDoc(taskRef, {
    progress: newProgress,
    isComplete: newProgress === 100,
    updatedAt: serverTimestamp()
  });

  return newUpdate;
};

// 5. Get Updates for a Task
export const getTaskUpdates = async (taskId: string) => {
  const updatesRef = collection(db, `tasks/${taskId}/updates`);
  // Note: orderBy requires an index in Firestore if used with where(), but here it's just orderBy
  const q = query(updatesRef, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as TaskUpdate);
};

export const subscribeToTaskUpdates = (taskId: string, callback: (updates: TaskUpdate[]) => void) => {
  const updatesRef = collection(db, `tasks/${taskId}/updates`);
  const q = query(updatesRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const updates = snapshot.docs.map(doc => doc.data() as TaskUpdate);
    callback(updates);
  });
};

// 6. Get global tasks where the user is directly assigned
export const getGlobalUserTasks = async (userId: string) => {
  const tasksRef = collection(db, 'tasks');
  const q = query(tasksRef, where('assignedUserIds', 'array-contains', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Task);
};

export const subscribeToGlobalUserTasks = (userId: string, callback: (tasks: Task[]) => void) => {
  const tasksRef = collection(db, 'tasks');
  const q = query(tasksRef, where('assignedUserIds', 'array-contains', userId));
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => doc.data() as Task);
    callback(tasks);
  });
};

// 7. Get global tasks belonging to projects where the user is a member
export const getGlobalSupervisedTasks = async (projectIds: string[]) => {
  if (projectIds.length === 0) return [];
  
  const tasksRef = collection(db, 'tasks');
  const allTasks: Task[] = [];
  
  // Chunking to respect Firestore's 10-item limit per 'in' query
  const chunks = [];
  for (let i = 0; i < projectIds.length; i += 10) {
    chunks.push(projectIds.slice(i, i + 10));
  }
  
  for (const chunk of chunks) {
    const q = query(tasksRef, where('projectId', 'in', chunk));
    const snapshot = await getDocs(q);
    allTasks.push(...snapshot.docs.map(doc => doc.data() as Task));
  }
  
  return allTasks;
};

export const subscribeToGlobalSupervisedTasks = (projectIds: string[], callback: (tasks: Task[]) => void) => {
  if (projectIds.length === 0) {
    callback([]);
    return () => {};
  }
  
  const tasksRef = collection(db, 'tasks');
  const chunks = [];
  for (let i = 0; i < projectIds.length; i += 10) {
    chunks.push(projectIds.slice(i, i + 10));
  }
  
  const unsubscribes: (() => void)[] = [];
  const tasksMap = new Map<string, Task[]>();

  chunks.forEach((chunk, index) => {
    const q = query(tasksRef, where('projectId', 'in', chunk));
    const unsub = onSnapshot(q, (snapshot) => {
      tasksMap.set(index.toString(), snapshot.docs.map(doc => doc.data() as Task));
      const allTasks = Array.from(tasksMap.values()).flat();
      callback(allTasks);
    });
    unsubscribes.push(unsub);
  });

  return () => unsubscribes.forEach(unsub => unsub());
};

// 8. Upload reference images
export const uploadReferenceImages = async (taskId: string, photoFiles: File[]) => {
  const urls: string[] = [];
  for (const file of photoFiles) {
    const compressedFile = await compressImage(file);
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
    const storageRef = ref(storage, `tasks/${taskId}/reference_${uniqueName}`);
    const snapshot = await uploadBytes(storageRef, compressedFile);
    urls.push(await getDownloadURL(snapshot.ref));
  }
  return urls;
};

// 9. Create a Recurring Task Template
export const createRecurringTask = async (data: Omit<RecurringTask, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>) => {
  const recurringRef = doc(collection(db, 'recurring_tasks'));
  
  const newRecurringTask: RecurringTask = {
    id: recurringRef.id,
    ...data,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(recurringRef, newRecurringTask);
  return newRecurringTask;
};

export const subscribeToGlobalRecurringTasks = (projectIds: string[], callback: (tasks: RecurringTask[]) => void) => {
  if (projectIds.length === 0) {
    callback([]);
    return () => {};
  }
  
  const recurringRef = collection(db, 'recurring_tasks');
  const chunks = [];
  for (let i = 0; i < projectIds.length; i += 10) {
    chunks.push(projectIds.slice(i, i + 10));
  }
  
  const unsubscribes: (() => void)[] = [];
  const tasksMap = new Map<string, RecurringTask[]>();

  chunks.forEach((chunk, index) => {
    const q = query(recurringRef, where('projectId', 'in', chunk), where('isActive', '==', true));
    const unsub = onSnapshot(q, (snapshot) => {
      tasksMap.set(index.toString(), snapshot.docs.map(doc => doc.data() as RecurringTask));
      const allRecurring = Array.from(tasksMap.values()).flat();
      callback(allRecurring);
    });
    unsubscribes.push(unsub);
  });

  return () => unsubscribes.forEach(unsub => unsub());
};

// 10. Get Recurring Tasks
export const getRecurringTasks = async (companyId: string, projectId?: string): Promise<RecurringTask[]> => {
  const recurringRef = collection(db, 'recurring_tasks');
  let q;
  if (projectId) {
    q = query(recurringRef, where('projectId', '==', projectId), where('isActive', '==', true));
  } else {
    q = query(recurringRef, where('companyId', '==', companyId), where('isActive', '==', true));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RecurringTask));
};

export const getGlobalRecurringTasks = async (projectIds: string[]): Promise<RecurringTask[]> => {
  if (projectIds.length === 0) return [];
  
  const recurringRef = collection(db, 'recurring_tasks');
  const allTasks: RecurringTask[] = [];
  
  // Firebase 'in' queries are limited to 10 items. Chunk the projectIds.
  const chunkSize = 10;
  for (let i = 0; i < projectIds.length; i += chunkSize) {
    const chunk = projectIds.slice(i, i + chunkSize);
    const q = query(recurringRef, where('projectId', 'in', chunk), where('isActive', '==', true));
    const snapshot = await getDocs(q);
    snapshot.docs.forEach(doc => {
      allTasks.push({ id: doc.id, ...doc.data() } as RecurringTask);
    });
  }
  
  return allTasks;
};

// 11. Deactivate (Soft Delete) a Recurring Task
export const deactivateRecurringTask = async (id: string): Promise<void> => {
  const taskRef = doc(db, 'recurring_tasks', id);
  await updateDoc(taskRef, {
    isActive: false,
    updatedAt: serverTimestamp()
  });
};

import { addDays, setDate, addMonths, isAfter, getDay, startOfDay, format, addYears, setMonth, setYear, nextDay, startOfMonth, lastDayOfMonth } from 'date-fns';

export const calculateNextScheduledDate = (type: RecurrenceType, config: RecurrenceConfig, fromDateStr?: string): string => {
  const fromDate = fromDateStr ? startOfDay(new Date(fromDateStr + 'T00:00:00')) : startOfDay(new Date());
  
  if (type === 'daily_interval') {
    const interval = config.interval || 1;
    return format(addDays(fromDate, interval), 'yyyy-MM-dd');
  } 
  
  if (type === 'monthly_interval') {
    const interval = config.interval || 1;
    return format(addMonths(fromDate, interval), 'yyyy-MM-dd');
  }
  
  if (type === 'weekly') {
    const targetDays = config.daysOfWeek || []; // 0=Sun, 1=Mon...
    if (targetDays.length === 0) return format(addDays(fromDate, 1), 'yyyy-MM-dd');
    
    let nextDate = addDays(fromDate, 1);
    for (let i = 0; i < 8; i++) {
      if (targetDays.includes(getDay(nextDate))) {
        return format(nextDate, 'yyyy-MM-dd');
      }
      nextDate = addDays(nextDate, 1);
    }
  }
  
  if (type === 'monthly_date') {
    const targetDate = config.dayOfMonth || 1;
    let nextDate = setDate(fromDate, targetDate);
    if (!isAfter(nextDate, fromDate)) {
      nextDate = setDate(addMonths(fromDate, 1), targetDate);
    }
    return format(nextDate, 'yyyy-MM-dd');
  }
  
  if (type === 'yearly_date') {
    if (!config.targetDate) return format(addYears(fromDate, 1), 'yyyy-MM-dd');
    const parts = config.targetDate.split('-'); // YYYY-MM-DD
    const targetMonth = parseInt(parts[1], 10) - 1; // 0-based
    const targetDay = parseInt(parts[2], 10);
    
    let nextDate = setDate(setMonth(fromDate, targetMonth), targetDay);
    if (!isAfter(nextDate, fromDate)) {
      nextDate = addYears(nextDate, 1);
    }
    return format(nextDate, 'yyyy-MM-dd');
  }
  
  if (type === 'monthly_specific_day') {
    // dayOfWeek: 0-6 (Sun-Sat)
    // weekOfMonth: 1, 2, 3, 4, -1
    const targetDow = config.dayOfWeek ?? 1; // Default Mon
    const week = config.weekOfMonth ?? 1;
    
    // We need to check this month first, if it's already passed, check next month.
    let dateObj = fromDate;
    for (let attempt = 0; attempt < 2; attempt++) {
      const monthStart = startOfMonth(dateObj);
      let targetDate: Date;
      
      if (week === -1) {
        // Last occurrence of dayOfWeek in the month
        const monthEnd = lastDayOfMonth(dateObj);
        const endDow = getDay(monthEnd);
        const diff = (endDow - targetDow + 7) % 7;
        targetDate = addDays(monthEnd, -diff);
      } else {
        // Find first occurrence of dayOfWeek
        const startDow = getDay(monthStart);
        const diff = (targetDow - startDow + 7) % 7;
        const firstOcc = addDays(monthStart, diff);
        targetDate = addDays(firstOcc, (week - 1) * 7);
      }
      
      if (isAfter(targetDate, fromDate)) {
        return format(targetDate, 'yyyy-MM-dd');
      }
      // If we missed it this month, try next month
      dateObj = startOfMonth(addMonths(fromDate, 1));
    }
  }
  
  return format(addDays(fromDate, 1), 'yyyy-MM-dd');
};
