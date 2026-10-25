import React, { useEffect, Suspense, lazy } from 'react';
import Layout from './components/Layout';
import { useStore } from './store/useStore';
import { auth, subscribeToUserData, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { setDoc, doc, updateDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { AchievementNotifications } from './components/AchievementNotifications';
import { useAchievementEnforcer } from './hooks/useAchievementEnforcer';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SuccessPage from './components/SuccessPage';

// Lazy load components
const StoreView = lazy(() => import('./components/StoreView'));
const EditorView = lazy(() => import('./components/EditorView'));
const MyAppsView = lazy(() => import('./components/MyAppsView'));
const ProfileView = lazy(() => import('./components/ProfileView'));
const PublicProfileView = lazy(() => import('./components/PublicProfileView'));
const PlayerView = lazy(() => import('./components/PlayerView'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const PremiumView = lazy(() => import('./components/PremiumView'));
const ControlView = lazy(() => import('./components/ControlView'));
const AssetStoreView = lazy(() => import('./components/AssetStoreView'));
const DonatePage = lazy(() => import('./components/DonatePage'));
const LeaderboardsView = lazy(() => import('./components/LeaderboardsView'));
const InstalledAppsView = lazy(() => import('./components/InstalledAppsView'));

function ViewRenderer() {
  const currentView = useStore(state => state.currentView);
  const user = useStore(state => state.user);
  const userData = useStore(state => state.userData);
  const simulatedRole = useStore(state => state.simulatedRole);
  
  const actualRole = (user?.email === 'fufazada@gmail.com') ? 'admin' : userData?.role;
  const effectiveRole = (actualRole === 'admin' && simulatedRole) ? simulatedRole : actualRole;

  switch (currentView) {
    case 'store': return <StoreView />;
    case 'installed-apps': return <InstalledAppsView />;
    case 'editor': return <EditorView />;
    case 'my-apps': return <MyAppsView />;
    case 'profile': return <ProfileView />;
    case 'public-profile': return <PublicProfileView />;
    case 'player': return <PlayerView />;
    case 'settings': return <SettingsView />;
    case 'premium': return <PremiumView />;
    case 'donate': return <DonatePage />;
    case 'asset-store': return <AssetStoreView />;
    case 'control': 
      if (effectiveRole === 'developer' || effectiveRole === 'admin' || effectiveRole === 'moderator') {
        return <ControlView />;
      }
      return <StoreView />;
    case 'leaderboards': return <LeaderboardsView />;
    default: return <StoreView />;
  }
}

export default function App() {
  useAchievementEnforcer();
  const currentView = useStore(state => state.currentView);
  const setUser = useStore(state => state.setUser);
  const setUserData = useStore(state => state.setUserData);
  const user = useStore(state => state.user);
  const userData = useStore(state => state.userData);
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const language = useStore(state => state.language);

  const isPremium = useStore(state => state.isPremium);
  const setIsPremium = useStore(state => state.setIsPremium);
  const premiumExpiry = useStore(state => state.premiumExpiry);
  const setPremiumExpiry = useStore(state => state.setPremiumExpiry);

  const simulatedRole = useStore(state => state.simulatedRole);
  const actualRole = (user?.email === 'fufazada@gmail.com') ? 'developer' : userData?.role;
  const effectiveRole = (actualRole === 'developer' && simulatedRole) ? simulatedRole : actualRole;

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
    let unsubscribeUser: (() => void) | undefined;
    
    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
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
              const isDevEmail = fbUser.email === 'fufazada@gmail.com';
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
            const isDevEmail = fbUser.email === 'fufazada@gmail.com';
            if (isDevEmail && data.role !== 'developer') {
              try {
                await updateDoc(doc(db, 'users', fbUser.uid), { role: 'developer' });
                data.role = 'developer'; // Update local data object too
              } catch (err) {
                console.error("Error updating developer role for fufazada@gmail.com", err);
              }
            }
            
            setUserData(data);

            // Restore user's installed apps from cloud if available
            try {
              if (data.installedAppsList && Array.isArray(data.installedAppsList) && data.installedAppsList.length > 0) {
                useStore.getState().setInstalledAppsList(data.installedAppsList);
              } else {
                const installedSnap = await getDocs(query(collection(db, 'installed_apps'), where('userId', '==', fbUser.uid)));
                if (!installedSnap.empty) {
                  const cloudInstalled = installedSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
                  useStore.getState().setInstalledAppsList(cloudInstalled);
                }
              }
            } catch (err) {
              console.warn("Error restoring installed apps from cloud:", err);
            }
            
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
  }, [setUser]);

  if (userData?.isBanned) {
    return (
      <div className="fixed inset-0 bg-red-950 text-white flex flex-col items-center justify-center p-8 z-[100]">
        <style dangerouslySetInnerHTML={{__html: `body { background-color: #450a0a !important; }`}} />
        <h1 className="text-4xl sm:text-6xl font-bold mb-4 text-red-500 text-center">
          {language === 'ru' ? 'Извините, но вы были забанены' : 'You have been banned'}
        </h1>
        <p className="text-xl text-red-200 text-center max-w-lg mb-8">
          {language === 'ru' ? 'Причина:' : 'Reason:'} {userData.banReason || (language === 'ru' ? 'Нарушение правил' : 'Violation of terms of service.')}
        </p>
        <button 
          onClick={() => auth.signOut()}
          className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg transition-colors"
        >
          {language === 'ru' ? 'Выйти' : 'Log Out'}
        </button>
      </div>
    );
  }

  useEffect(() => {
    const root = document.documentElement;
    const currentTheme = isFrutigerAero ? 'frutiger-aero' : theme;
    root.setAttribute('data-theme', currentTheme);
    root.classList.remove('theme-light', 'theme-dark', 'theme-gradient', 'frutiger-aero');
    if (isFrutigerAero) {
      root.classList.add('frutiger-aero');
    } else {
      root.classList.add(`theme-${theme}`);
    }
  }, [theme, isFrutigerAero]);

  return (
    <BrowserRouter>
      <style dangerouslySetInnerHTML={{ __html: `
        html, body, #root { 
          ${isFrutigerAero 
            ? `background: linear-gradient(135deg, #a0e8f5 0%, #d4f0ff 40%, #87d4f5 60%, #4cb8f5 100%) !important; color: #062038 !important;` 
            : theme === 'light'
            ? `background-color: #f8fafc !important; color: #0f172a !important;`
            : `background-color: #09090b !important; color: #fafafa !important;`}
          margin: 0; 
          padding: 0; 
          height: 100%; 
          overflow: hidden;
        }
      `}} />
      <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-zinc-950 text-emerald-500"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div></div>}>
        <Routes>
          <Route path="/success" element={<SuccessPage />} />
          <Route path="*" element={
            <Layout>
              <AchievementNotifications />
              <Suspense fallback={<div className="flex-1 flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>}>
                <ViewRenderer />
              </Suspense>
            </Layout>
          } />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
