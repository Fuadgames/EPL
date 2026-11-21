import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  OAuthProvider,
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  signOut,
  connectAuthEmulator
} from "firebase/auth";
import { getFirestore, doc, updateDoc, increment, onSnapshot, getDoc, setDoc, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebaseConfig from '../firebase-applet-config.json';

import { performGoogleSignIn } from "./lib/googleAuth";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

export const logOut = () => signOut(auth);

export const signInWithGoogle = async () => {
  return performGoogleSignIn();
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
      const now = new Date().toISOString();
      await setDoc(userRef, {
        uid: user.uid,
        name: user.displayName || 'User',
        email: user.email,
        photoUrl: user.photoURL,
        avatarUrl: user.photoURL || '',
        region: 'Global',
        friends: [],
        role: 'user',
        eplCoins: 0,
        purchasedItems: [],
        purchasedApps: [],
        createdAt: now
      });
      await setDoc(doc(db, 'users_public', user.uid), {
        uid: user.uid,
        name: user.displayName || 'User',
        avatarUrl: user.photoURL || '',
        region: 'Global',
        eplCoins: 0,
        role: 'user',
        createdAt: now
      }, { merge: true }).catch(() => {});
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
      
      // Send verification email to enforce F-03
      try {
        await sendEmailVerification(user);
      } catch (emailErr) {
        console.warn("Could not send email verification immediately:", emailErr);
      }
      
      // Create user document with baseline 'user' role only
      const now = new Date().toISOString();
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: name,
        email: user.email,
        avatarUrl: '',
        region: 'Global',
        friends: [],
        role: 'user',
        isPremium: false,
        premiumExpiry: null,
        eplCoins: 0,
        purchasedItems: [],
        purchasedApps: [],
        createdAt: now
      });
      await setDoc(doc(db, 'users_public', user.uid), {
        uid: user.uid,
        name: name,
        avatarUrl: '',
        region: 'Global',
        eplCoins: 0,
        role: 'user',
        createdAt: now
      }, { merge: true }).catch(() => {});
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
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken().catch(() => null);
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch('/api/admin/give-coins', {
      method: 'POST',
      headers,
      body: JSON.stringify({ uid: userId, amount, adminUid: auth.currentUser?.uid })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to update coins');
    }
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
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken().catch(() => null);
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch('/api/admin/manual-review', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        appId: projectId,
        action: 'approve',
        reviewerName: auth.currentUser?.displayName || 'Admin'
      })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to verify project');
    }
    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

export const subscribeToUserData = (userId: string, callback: (data: any) => void) => {
  const userRef = doc(db, 'users', userId);
  return onSnapshot(
    userRef,
    (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() });
      } else {
        callback(null);
      }
    },
    (err) => {
      console.warn('subscribeToUserData listener error:', err);
    }
  );
};
