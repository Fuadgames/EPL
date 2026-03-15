import React, { useEffect } from 'react';
import Layout from './components/Layout';
import { useStore } from './store/useStore';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

// Lazy load components
const StoreView = React.lazy(() => import('./components/StoreView'));
const EditorView = React.lazy(() => import('./components/EditorView'));
const MyAppsView = React.lazy(() => import('./components/MyAppsView'));
const ProfileView = React.lazy(() => import('./components/ProfileView'));
const PlayerView = React.lazy(() => import('./components/PlayerView'));
const SettingsView = React.lazy(() => import('./components/SettingsView'));

export default function App() {
  const { currentView, setUser } = useStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, [setUser]);

  const renderView = () => {
    switch (currentView) {
      case 'store': return <StoreView />;
      case 'editor': return <EditorView />;
      case 'my-apps': return <MyAppsView />;
      case 'profile': return <ProfileView />;
      case 'player': return <PlayerView />;
      case 'settings': return <SettingsView />;
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
