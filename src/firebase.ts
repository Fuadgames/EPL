import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  OAuthProvider,
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile,
  signOut
} from "firebase/auth";
import { getFirestore, doc, updateDoc, increment, onSnapshot, getDoc, setDoc } from "firebase/firestore";
import { getStorage } from "firebase/storage";

import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

export const logOut = () => signOut(auth);

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Check if user document exists, if not create it
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        name: user.displayName || 'User',
        email: user.email,
        photoUrl: user.photoURL,
        role: user.email === 'fufazada@gmail.com' ? 'developer' : 'user',
        eplCoins: 0,
        purchasedItems: [],
        createdAt: new Date().toISOString()
      });
    }
    
    return { user, error: null };
  } catch (error: any) {
    return { user: null, error };
  }
};

export const signInWithApple = async () => {
  const provider = new OAuthProvider('apple.com');
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Check if user document exists, if not create it
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        name: user.displayName || 'User',
        email: user.email,
        photoUrl: user.photoURL,
        role: user.email === 'fufazada@gmail.com' ? 'developer' : 'user',
        eplCoins: 0,
        purchasedItems: [],
        createdAt: new Date().toISOString()
      });
    }
    
    return { user, error: null };
  } catch (error: any) {
    return { user: null, error };
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null };
  } catch (error: any) {
    return { user: null, error };
  }
};

export const signUpWithEmail = async (email: string, password: string, name: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;
    
    if (user) {
      await updateProfile(user, { displayName: name });
      
      // Create user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: name,
        email: user.email,
        role: user.email === 'fufazada@gmail.com' ? 'admin' : 'user',
        eplCoins: 0,
        purchasedItems: [],
        createdAt: new Date().toISOString()
      });
    }
    
    return { user, error: null };
  } catch (error: any) {
    return { user: null, error };
  }
};

export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

export const giveCoins = async (userId: string, amount: number) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      eplCoins: increment(amount)
    });
    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

export const sendProjectToVerify = async (projectId: string) => {
  try {
    const appRef = doc(db, 'apps', projectId);
    await updateDoc(appRef, {
      status: 'pending'
    });
    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

export const verifyProject = async (projectId: string) => {
  try {
    const appRef = doc(db, 'apps', projectId);
    await updateDoc(appRef, {
      status: 'verified'
    });
    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

export const subscribeToUserData = (userId: string, callback: (data: any) => void) => {
  const userRef = doc(db, 'users', userId);
  return onSnapshot(userRef, (doc) => {
    callback({ id: doc.id, ...doc.data() });
  });
};
