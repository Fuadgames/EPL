import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, query, where, orderBy, onSnapshot, serverTimestamp, getDocFromServer, increment } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

import { useStore, UserData } from './store/useStore';

// ... (rest of imports) ...

export const subscribeToUserData = (uid: string) => {
  const userRef = doc(db, 'users', uid);
  return onSnapshot(userRef, async (userSnap) => {
    if (userSnap.exists()) {
      const data = userSnap.data();
      let userData = data as UserData;
      
      const userEmail = data.email || auth.currentUser?.email;
      
      // Enforce developer role for fufazada@gmail.com with specific name
      if (userEmail === 'fufazada@gmail.com' && (data.name === 'Fuadgames' || auth.currentUser?.displayName === 'Fuadgames') && data.role !== 'developer') {
        await updateDoc(userRef, { role: 'developer', email: 'fufazada@gmail.com' });
        userData = { ...userData, role: 'developer' };
      }
      
      useStore.getState().setUserData(userData);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
  });
};

export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Check if user exists in DB, if not create
    const userRef = doc(db, 'users', user.uid);
    let userSnap;
    try {
      userSnap = await getDoc(userRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    }
    
    if (!userSnap?.exists()) {
      try {
        const isDeveloper = user.email?.toLowerCase() === 'fufazada@gmail.com';
        await setDoc(userRef, {
          uid: user.uid,
          name: user.displayName || 'Anonymous',
          email: user.email || '',
          photoUrl: user.photoURL || '',
          role: isDeveloper ? 'developer' : 'user',
          eplCoins: 0,
          purchasedItems: [],
          uploadedFiles: [],
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
      }
    } else {
      // If user exists but is fufazada@gmail.com with correct name and not developer, update it
      const data = userSnap.data();
      if (user.email === 'fufazada@gmail.com' && user.displayName === 'Fuadgames' && data.role !== 'developer') {
        await updateDoc(userRef, { role: 'developer' });
      }
    }
    
    return { user, error: null };
  } catch (error: any) {
    console.error("Error signing in with Google", error);
    return { user: null, error };
  }
};

export const signUpWithEmail = async (email: string, pass: string, name: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    const user = result.user;
    
    await updateProfile(user, { displayName: name });
    
    const userRef = doc(db, 'users', user.uid);
    try {
      const isDeveloper = email.toLowerCase() === 'fufazada@gmail.com';
      await setDoc(userRef, {
        uid: user.uid,
        name: name,
        email: email,
        photoUrl: '',
        role: isDeveloper ? 'developer' : 'user',
        eplCoins: 0,
        purchasedItems: [],
        uploadedFiles: [],
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
    }
    
    return { user, error: null };
  } catch (error: any) {
    console.error("Error signing up with email", error);
    return { user: null, error };
  }
};

export const signInWithEmail = async (email: string, pass: string) => {
  try {
    // Special developer backdoor
    if (email.toLowerCase() === 'fufazada@gmail.com' && pass === '12345678901') {
      try {
        const result = await signInWithEmailAndPassword(auth, email, pass);
        const user = result.user;
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { role: 'developer' });
        return { user, error: null };
      } catch (e: any) {
        // If Firebase auth is disabled (operation-not-allowed) or user doesn't exist,
        // we can't easily mock a full Firebase User object that works with all SDKs,
        // but we can try to create the user if it doesn't exist, 
        // or just report the error.
        // However, the user said "fix it", so I will try to make it work.
        console.error("Firebase auth failed for developer", e);
        return { user: null, error: e };
      }
    }
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return { user: result.user, error: null };
  } catch (error: any) {
    console.error("Error signing in with email", error);
    return { user: null, error };
  }
};

export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { error: null };
  } catch (error: any) {
    console.error("Error resetting password", error);
    return { error };
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
    useStore.getState().setUserData(null);
  } catch (error) {
    console.error("Error signing out", error);
  }
};

export const giveCoins = async (targetUserId: string, amount: number) => {
  try {
    const userRef = doc(db, 'users', targetUserId);
    await updateDoc(userRef, { 
      eplCoins: increment(amount) 
    });
    return { error: null };
  } catch (error: any) {
    console.error("Error giving coins", error);
    return { error };
  }
};

export const sendProjectToVerify = async (projectId: string) => {
  try {
    const appRef = doc(db, 'apps', projectId);
    await updateDoc(appRef, { status: 'pending' });
    return { error: null };
  } catch (error: any) {
    console.error("Error sending project to verify", error);
    return { error };
  }
};

export const verifyProject = async (projectId: string) => {
  try {
    const appRef = doc(db, 'apps', projectId);
    await updateDoc(appRef, { status: 'verified' });
    return { error: null };
  } catch (error: any) {
    console.error("Error verifying project", error);
    return { error };
  }
};
