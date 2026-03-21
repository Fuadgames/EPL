import React, { useEffect } from 'react';
import Layout from './components/Layout';
import { useStore } from './store/useStore';
import { auth, subscribeToUserData } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

// Lazy load components
const StoreView = React.lazy(() => import('./components/StoreView'));
const EditorView = React.lazy(() => import('./components/EditorView'));
const MyAppsView = React.lazy(() => import('./components/MyAppsView'));
const ProfileView = React.lazy(() => import('./components/ProfileView'));
const PlayerView = React.lazy(() => import('./components/PlayerView'));
const SettingsView = React.lazy(() => import('./components/SettingsView'));
const PremiumView = React.lazy(() => import('./components/PremiumView'));
const ControlView = React.lazy(() => import('./components/ControlView'));

export default function App() {
  const currentView = useStore(state => state.currentView);
  const setUser = useStore(state => state.setUser);
  const user = useStore(state => state.user);
  const userData = useStore(state => state.userData);
  const isBackdoor = useStore(state => state.isBackdoor);

  useEffect(() => {
    let unsubscribeUser: (() => void) | undefined;
    
    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      // If we are in backdoor mode, don't let Firebase Auth reset the user to null
      if (isBackdoor && !fbUser) {
        return;
      }
      
      setUser(fbUser);
      if (fbUser) {
        unsubscribeUser = subscribeToUserData(fbUser.uid);
      } else {
        if (unsubscribeUser) unsubscribeUser();
      }
    });
    
    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, [setUser]);

  const renderView = () => {
    switch (currentView) {
      case 'store': return <StoreView />;
      case 'editor': return <EditorView />;
      case 'my-apps': return <MyAppsView />;
      case 'profile': return <ProfileView />;
      case 'player': return <PlayerView />;
      case 'settings': return <SettingsView />;
      case 'premium': return <PremiumView />;
      case 'control': 
        if (userData?.role === 'developer' || userData?.role === 'admin') {
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
