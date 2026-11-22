import React, { useEffect, Suspense, lazy } from 'react';
import Layout from './components/Layout';
import { useStore } from './store/useStore';
import { auth, subscribeToUserData, db, logOut } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { setDoc, doc, getDocs, collection, query, where } from 'firebase/firestore';
import { AchievementNotifications } from './components/AchievementNotifications';
import GlobalDialogs from './components/GlobalDialogs';
import { useAchievementEnforcer } from './hooks/useAchievementEnforcer';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SuccessPage from './components/SuccessPage';
import { ShieldAlert, LogOut } from 'lucide-react';

// Safe lazy load with automatic retry for deployment updates or network hiccups
function safeLazy<T extends React.ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err: any) {
      console.warn('Initial chunk load failed, retrying once...', err);
      try {
        return await factory();
      } catch (retryErr) {
        console.error('Chunk retry failed:', retryErr);
        const reloadKey = 'chunk_reload_' + window.location.pathname;
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, '1');
          window.location.reload();
        }
        throw retryErr;
      }
    }
  });
}

const StoreView = safeLazy(() => import('./components/StoreView'));
const EditorView = safeLazy(() => import('./components/EditorView'));
const MyAppsView = safeLazy(() => import('./components/MyAppsView'));
const ProfileView = safeLazy(() => import('./components/ProfileView'));
const PublicProfileView = safeLazy(() => import('./components/PublicProfileView'));
const PlayerView = safeLazy(() => import('./components/PlayerView'));
const SettingsView = safeLazy(() => import('./components/SettingsView'));
const PremiumView = safeLazy(() => import('./components/PremiumView'));
const ControlView = safeLazy(() => import('./components/ControlView'));
const AssetStoreView = safeLazy(() => import('./components/AssetStoreView'));
const DonatePage = safeLazy(() => import('./components/DonatePage'));
const LeaderboardsView = safeLazy(() => import('./components/LeaderboardsView'));
const InstalledAppsView = safeLazy(() => import('./components/InstalledAppsView'));
const NewsView = safeLazy(() => import('./components/NewsView'));

function ViewRenderer() {
  const currentView = useStore(state => state.currentView);
  const userData = useStore(state => state.userData);
  const simulatedRole = useStore(state => state.simulatedRole);

  const actualRole = userData?.role || 'user';
  const effectiveRole = (actualRole === 'developer' && simulatedRole) ? simulatedRole : actualRole;

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
    case 'news': return <NewsView />;
    default: return <StoreView />;
  }
}

export default function App() {
  useAchievementEnforcer();
  const setUser = useStore(state => state.setUser);
  const setUserData = useStore(state => state.setUserData);
  const userData = useStore(state => state.userData);
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const language = useStore(state => state.language);

  const isPremium = useStore(state => state.isPremium);
  const setIsPremium = useStore(state => state.setIsPremium);
  const premiumExpiry = useStore(state => state.premiumExpiry);
  const setPremiumExpiry = useStore(state => state.setPremiumExpiry);

  useEffect(() => {
    if (isPremium && premiumExpiry) {
      const expiryDate = new Date(premiumExpiry);
      if (expiryDate < new Date()) {
        setIsPremium(false);
        setPremiumExpiry(null);
      }
    }
  }, [isPremium, premiumExpiry, setIsPremium, setPremiumExpiry]);

  useEffect(() => {
    const root = document.documentElement;
    const normalizedTheme = theme === 'light' ? 'light' : 'dark';
    const currentTheme = isFrutigerAero ? 'frutiger-aero' : normalizedTheme;
    root.setAttribute('data-theme', currentTheme);
    root.classList.remove('theme-light', 'theme-dark', 'theme-gradient', 'frutiger-aero');
    if (isFrutigerAero) {
      root.classList.add('frutiger-aero');
    } else {
      root.classList.add(`theme-${normalizedTheme}`);
    }
  }, [theme, isFrutigerAero]);

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
            try {
              await setDoc(doc(db, 'users', fbUser.uid), {
                uid: fbUser.uid,
                name: fbUser.displayName || 'User',
                email: fbUser.email,
                photoUrl: fbUser.photoURL,
                avatarUrl: fbUser.photoURL || '',
                region: 'Global',
                friends: [],
                role: 'user',
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
            setUserData(data);

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

            try {
              await setDoc(doc(db, 'users_public', fbUser.uid), {
                uid: fbUser.uid,
                name: data.name || fbUser.displayName || 'User',
                avatarUrl: data.avatarUrl || data.photoUrl || '',
                region: data.region || 'Global',
                eplCoins: data.eplCoins || 0,
                role: data.role || 'user',
                isVerifiedAuthor: !!data.isVerifiedAuthor,
                isBanned: !!data.isBanned,
                banReason: data.banReason || null,
                roleVerification: data.roleVerification || null,
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
      } else {
        setUserData(null);
        setIsPremium(false);
        setPremiumExpiry(null);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, [setUser, setUserData, setIsPremium, setPremiumExpiry]);

  if (userData?.isBanned) {
    return (
      <div className="fixed inset-0 bg-[#111315] text-[#F3F4F6] flex flex-col items-center justify-center p-6 z-[100]">
        <div className="w-full max-w-md rounded-xl bg-[#181B20] border border-[#DC2626]/40 p-8 text-center">
          <div className="w-12 h-12 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            {language === 'ru' ? 'Аккаунт заблокирован' : 'Account Suspended'}
          </h1>
          <p className="text-sm text-[#9CA3AF] leading-relaxed mb-6">
            {language === 'ru' ? 'Причина блокировки: ' : 'Reason: '}
            <span className="text-[#F3F4F6]">
              {userData.banReason || (language === 'ru' ? 'Нарушение правил безопасности платформы' : 'Violation of platform safety rules')}
            </span>
          </p>
          <button
            onClick={async () => {
              try {
                await logOut();
              } catch (e) {
                console.warn('Banned sign-out Firebase warning:', e);
                try {
                  await auth.signOut();
                } catch {}
              }
              setUser(null);
              setUserData(null);
              setIsPremium(false);
              setPremiumExpiry(null);
            }}
            className="w-full py-2.5 px-4 bg-[#DC2626] hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-colors inline-flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            {language === 'ru' ? 'Выйти из аккаунта' : 'Sign Out'}
          </button>
        </div>
        <GlobalDialogs />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-canvas)] text-[var(--accent-emerald)]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-current border-t-transparent" />
          </div>
        }
      >
        <Routes>
          <Route path="/success" element={<SuccessPage />} />
          <Route
            path="*"
            element={
              <Layout>
                <AchievementNotifications />
                <Suspense
                  fallback={
                    <div className="flex-1 flex items-center justify-center h-full text-[var(--accent-emerald)]">
                      <div className="animate-spin rounded-full h-7 w-7 border-2 border-current border-t-transparent" />
                    </div>
                  }
                >
                  <ViewRenderer />
                </Suspense>
              </Layout>
            }
          />
        </Routes>
      </Suspense>
      <GlobalDialogs />
    </BrowserRouter>
  );
}
