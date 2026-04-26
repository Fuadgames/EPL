import React, { useEffect } from 'react';
import Layout from './components/Layout';
import { useStore } from './store/useStore';
import { auth, subscribeToUserData, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { setDoc, doc, updateDoc } from 'firebase/firestore';
import { AchievementNotifications } from './components/AchievementNotifications';
import { useAchievementEnforcer } from './hooks/useAchievementEnforcer';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SuccessPage from './components/SuccessPage';

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

const LeaderboardsView = React.lazy(() => import('./components/LeaderboardsView'));

export default function App() {
  useAchievementEnforcer();
  const currentView = useStore(state => state.currentView);
  const setUser = useStore(state => state.setUser);
  const setUserData = useStore(state => state.setUserData);
  const user = useStore(state => state.user);
  const userData = useStore(state => state.userData);
  const isBackdoor = useStore(state => state.isBackdoor);

  const isPremium = useStore(state => state.isPremium);
  const setIsPremium = useStore(state => state.setIsPremium);
  const premiumExpiry = useStore(state => state.premiumExpiry);
  const setPremiumExpiry = useStore(state => state.setPremiumExpiry);

  const simulatedRole = useStore(state => state.simulatedRole);
  const effectiveRole = (userData?.role === 'developer' && simulatedRole) ? simulatedRole : userData?.role;

  useEffect(() => {
    if (isPremium && premiumExpiry) {
      const expiryDate = new Date(premiumExpiry);
      if (expiryDate < new Date()) {
        setIsPremium(false);
        setPremiumExpiry(null);
        console.log("Premium expired.");
      }
    }
  }, [isPremium, premiumExpiry, setIsPremium, setPremiumExpiry]);

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
              const isDevEmail = fbUser.email === 'fufazada@gmail.com' || fbUser.uid === 'dev-backdoor-uid';
              await setDoc(doc(db, 'users', fbUser.uid), {
                uid: fbUser.uid,
                name: fbUser.displayName || 'User',
                email: fbUser.email,
                photoUrl: fbUser.photoURL,
                avatarUrl: fbUser.photoURL || '',
                region: 'Global',
                friends: [],
                role: isDevEmail ? 'developer' : 'user',
                eplCoins: 0,
                purchasedItems: [],
                purchasedApps: [],
                createdAt: new Date().toISOString(),
                premiumExpiry: null,
                isPremium: false
              });
              await setDoc(doc(db, 'users_public', fbUser.uid), {
                uid: fbUser.uid,
                name: fbUser.displayName || 'User',
                avatarUrl: fbUser.photoURL || '',
                region: 'Global',
                eplCoins: 0,
                createdAt: new Date().toISOString()
              });
            } catch (err) {
              console.error("Error creating user document in App.tsx", err);
            }
          } else {
            // Force developer role for fufazada@gmail.com if not already set
            const isDevEmail = fbUser.email === 'fufazada@gmail.com' || fbUser.uid === 'dev-backdoor-uid';
            if (isDevEmail && data.role !== 'developer') {
              try {
                await updateDoc(doc(db, 'users', fbUser.uid), { role: 'developer' });
                data.role = 'developer'; // Update local data object too
              } catch (err) {
                console.error("Error updating developer role for fufazada@gmail.com", err);
              }
            }
            
            setUserData(data);
            
            // Sync users_public
            try {
              await setDoc(doc(db, 'users_public', fbUser.uid), {
                uid: fbUser.uid,
                name: data.name || fbUser.displayName || 'User',
                avatarUrl: data.avatarUrl || data.photoUrl || '',
                region: data.region || 'Global',
                eplCoins: data.eplCoins || 0,
                createdAt: data.createdAt || new Date().toISOString()
              }, { merge: true });
            } catch (err) {
              console.error("Error syncing users_public", err);
            }

            if (data.isPremium !== undefined) {
              setIsPremium(data.isPremium);
            }
            if (data.premiumExpiry) {
              const expiryDate = new Date(data.premiumExpiry);
              if (expiryDate < new Date()) {
                setIsPremium(false);
                setPremiumExpiry(null);
              } else {
                setIsPremium(true);
                setPremiumExpiry(data.premiumExpiry);
              }
            }
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
        if (effectiveRole === 'developer' || effectiveRole === 'admin' || effectiveRole === 'moderator') {
          return <ControlView />;
        }
        return <StoreView />;
      case 'leaderboards': return <LeaderboardsView />;
      default: return <StoreView />;
    }
  };

  if (userData?.isBanned) {
    return (
      <div className="fixed inset-0 bg-red-950 text-white flex flex-col items-center justify-center p-8 z-[100]">
        <style dangerouslySetInnerHTML={{__html: `body { background-color: #450a0a !important; }`}} />
        <h1 className="text-4xl sm:text-6xl font-bold mb-4 text-red-500">You have been banned</h1>
        <p className="text-xl text-red-200 text-center max-w-lg mb-8">
          Reason: {userData.banReason || 'Violation of terms of service.'}
        </p>
        <button 
          onClick={() => auth.signOut()}
          className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg transition-colors"
        >
          Log Out
        </button>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/success" element={<SuccessPage />} />
        <Route path="*" element={
          <Layout>
            <AchievementNotifications />
            <React.Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>}>
              {renderView()}
            </React.Suspense>
          </Layout>
        } />
      </Routes>
    </BrowserRouter>
  );
}
