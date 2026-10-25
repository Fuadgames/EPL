import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithCredential, 
  User 
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useStore } from "../store/useStore";

export const GOOGLE_CONFIG = {
  clientId: "1032956490388-t7bmuodcijk59u6d8pktu944dbsajdps.apps.googleusercontent.com",
  projectId: "aerial-vehicle-480319-k0",
  clientSecret: "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",
  redirectUris: ["https://epl-eta.vercel.app/"],
  javascriptOrigins: ["https://epl-eta.vercel.app"]
};

export interface GoogleUserProfile {
  sub: string;
  name: string;
  email: string;
  picture?: string;
  email_verified?: boolean;
}

// Decode Google JWT ID token
export function parseJwt(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// Ensure user profile in Firestore
export async function syncGoogleUserToFirestore(profile: GoogleUserProfile) {
  const uid = profile.sub;
  
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      const userData = {
        uid,
        name: profile.name || 'User',
        email: profile.email,
        photoUrl: profile.picture || '',
        avatarUrl: profile.picture || '',
        region: 'Global',
        friends: [],
        role: 'user',
        eplCoins: 0,
        purchasedItems: [],
        purchasedApps: [],
        createdAt: new Date().toISOString(),
        premiumExpiry: null,
        isPremium: false
      };
      await setDoc(userRef, userData);
      await setDoc(doc(db, 'users_public', uid), {
        uid,
        name: profile.name || 'User',
        avatarUrl: profile.picture || '',
        region: 'Global',
        eplCoins: 0,
        createdAt: new Date().toISOString()
      });
      return userData;
    } else {
      return snap.data();
    }
  } catch (err) {
    console.warn("Could not sync directly to Firestore client-side, trying backend:", err);
    // Send to backend proxy
    try {
      const res = await fetch('/api/auth/google-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile })
      });
      const data = await res.json();
      return data.userData;
    } catch (e) {
      console.error("Backend sync also failed:", e);
      return null;
    }
  }
}

// Complete Google Sign-In handler supporting both Firebase Auth and Google Identity Services
export async function performGoogleSignIn(): Promise<{ user: any; error: any }> {
  // Method 1: Try Firebase Google Popup first (standard Firebase Auth)
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const fbUser = result.user;

    const profile: GoogleUserProfile = {
      sub: fbUser.uid,
      name: fbUser.displayName || 'User',
      email: fbUser.email || '',
      picture: fbUser.photoURL || '',
      email_verified: fbUser.emailVerified
    };

    const userData = await syncGoogleUserToFirestore(profile);
    if (userData) {
      useStore.getState().setUserData(userData as any);
    }

    return { user: fbUser, error: null };
  } catch (fbErr: any) {
    console.warn("Firebase signInWithPopup failed or not permitted, trying Google Identity Services:", fbErr);

    // If popup was explicitly closed by user, don't cascade unnecessarily
    if (fbErr.code === 'auth/popup-closed-by-user') {
      return { user: null, error: fbErr };
    }

    // Method 2: Google Identity Services (GIS) TokenClient / ID token with custom client_id
    return new Promise((resolve) => {
      const google = (window as any).google;
      if (google?.accounts?.oauth2) {
        try {
          const client = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CONFIG.clientId,
            scope: 'openid email profile',
            callback: async (tokenResponse: any) => {
              if (tokenResponse.error) {
                console.error("GIS token response error:", tokenResponse);
                return resolve({ 
                  user: null, 
                  error: new Error(tokenResponse.error_description || tokenResponse.error) 
                });
              }

              try {
                // Fetch profile using access token
                const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                });
                const profile: GoogleUserProfile = await userInfoRes.json();

                if (!profile.email) {
                  throw new Error('Google did not return an email address.');
                }

                const userData = await syncGoogleUserToFirestore(profile);

                // Create synthetic user object for store
                const syntheticUser: any = {
                  uid: profile.sub,
                  email: profile.email,
                  displayName: profile.name,
                  photoURL: profile.picture,
                  emailVerified: profile.email_verified ?? true,
                  getIdToken: async () => tokenResponse.access_token
                };

                useStore.getState().setUser(syntheticUser);
                if (userData) {
                  useStore.getState().setUserData(userData as any);
                }

                resolve({ user: syntheticUser, error: null });
              } catch (profileErr: any) {
                resolve({ user: null, error: profileErr });
              }
            }
          });

          client.requestAccessToken({ prompt: 'select_account' });
        } catch (gisInitErr: any) {
          console.error("GIS initTokenClient error:", gisInitErr);
          resolve({ user: null, error: gisInitErr || fbErr });
        }
      } else {
        // Fallback: return the original Firebase error
        resolve({ user: null, error: fbErr });
      }
    });
  }
}
