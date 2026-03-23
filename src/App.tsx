import React, { useEffect } from 'react';
import Layout from './components/Layout';
import { useStore } from './store/useStore';
import { auth, subscribeToUserData, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { setDoc, doc, updateDoc } from 'firebase/firestore';

// Lazy load components
const StoreView = React.lazy(() => import('./components/StoreView'));
const EditorView = React.lazy(() => import('./components/EditorView'));
const MyAppsView = React.lazy(() => import('./components/MyAppsView'));
const ProfileView = React.lazy(() => import('./components/ProfileView'));
const PlayerView = React.lazy(() => import('./components/PlayerView'));
const SettingsView = React.lazy(() => import('./components/SettingsView'));
const PremiumView = React.lazy(() => import('./components/PremiumView'));
const ControlView = React.lazy(() => import('./components/ControlView'));
const AssetStoreView = React.lazy(() => import('./components/AssetStoreView'));

export default function App() {
  const currentView = useStore(state => state.currentView);
  const setUser = useStore(state => state.setUser);
  const setUserData = useStore(state => state.setUserData);
  const user = useStore(state => state.user);
  const userData = useStore(state => state.userData);
  const isBackdoor = useStore(state => state.isBackdoor);

  useEffect(() => {
    // Restore mock user if backdoor is active
    if (isBackdoor && !user && userData) {
      const mockUser = {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.name,
        photoURL: null,
        emailVerified: true,
      } as any;
      setUser(mockUser);
    }
  }, [isBackdoor, user, userData, setUser]);

  useEffect(() => {
    let unsubscribeUser: (() => void) | undefined;
    
    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      // If we are in backdoor mode, don't let Firebase Auth reset the user to null
      if (isBackdoor && !fbUser) {
        return;
      }
      
      setUser(fbUser);
      if (unsubscribeUser) {
        unsubscribeUser();
        unsubscribeUser = undefined;
      }
      if (fbUser) {
        unsubscribeUser = subscribeToUserData(fbUser.uid, async (data) => {
          if (!data || !data.role) {
            // Document might not exist yet, create it
            console.log("User document missing, creating...");
            try {
              await setDoc(doc(db, 'users', fbUser.uid), {
                uid: fbUser.uid,
                name: fbUser.displayName || 'User',
                email: fbUser.email,
                photoUrl: fbUser.photoURL,
                role: fbUser.email === 'fufazada@gmail.com' ? 'developer' : 'user',
                eplCoins: 0,
                purchasedItems: [],
                createdAt: new Date().toISOString()
              });
            } catch (err) {
              console.error("Error creating user document in App.tsx", err);
            }
          } else {
            // Force developer role for fufazada@gmail.com if not already set
            if (fbUser.email === 'fufazada@gmail.com' && data.role !== 'developer') {
              try {
                await updateDoc(doc(db, 'users', fbUser.uid), { role: 'developer' });
              } catch (err) {
                console.error("Error updating developer role for fufazada@gmail.com", err);
              }
            }
            setUserData(data);
          }
        });
      }
    });
    
    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, [setUser, isBackdoor]);

  const renderView = () => {
    switch (currentView) {
      case 'store': return <StoreView />;
      case 'editor': return <EditorView />;
      case 'my-apps': return <MyAppsView />;
      case 'profile': return <ProfileView />;
      case 'player': return <PlayerView />;
      case 'settings': return <SettingsView />;
      case 'premium': return <PremiumView />;
      case 'asset-store': return <AssetStoreView />;
      case 'control': 
        if (user?.email === 'fufazada@gmail.com') {
          return <ControlView />;
        }
        return <StoreView />;
      default: return <StoreView />;
    }
  };

  return (
    <Layout>
      <React.Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>}>
        {renderView()}
      </React.Suspense>
    </Layout>
  );
}
