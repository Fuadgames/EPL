import React, { useState, useEffect, useTransition } from 'react';
import { useStore } from '../store/useStore';
import { Store, Code2, Package, User, Settings, LogOut, Sun, Moon, Star, ArrowLeft, ShieldCheck, Trophy } from 'lucide-react';
import { auth, logOut } from '../firebase';
import { clsx } from 'clsx';
import Gradient from './Gradient';
import { translations } from '../lib/translations';
import AuthModal from './AuthModal';
import AppDetailView from './AppDetailView';
import { getDefaultAvatar } from '../lib/avatar';

export default function Layout({ children }: { children: React.ReactNode }) {
  const currentView = useStore(state => state.currentView);
  const setCurrentView = useStore(state => state.setCurrentView);
  const user = useStore(state => state.user);
  const theme = useStore(state => state.theme);
  const language = useStore(state => state.language);
  const isPremium = useStore(state => state.isPremium);
  const selectedAppId = useStore(state => state.selectedAppId);
  const userData = useStore(state => state.userData);
  const isBackdoor = useStore(state => state.isBackdoor);
  const setIsBackdoor = useStore(state => state.setIsBackdoor);
  const isAuthModalOpen = useStore(state => state.isAuthModalOpen);
  const setIsAuthModalOpen = useStore(state => state.setIsAuthModalOpen);
  const t = translations[language];

  const setUser = useStore(state => state.setUser);
  const setUserData = useStore(state => state.setUserData);

  const handleLogOut = async () => {
    try {
      await logOut();
    } catch (e) {
      console.error(e);
    }
    setIsBackdoor(false);
    setUser(null);
    setUserData(null);
  };

  const simulatedRole = useStore(state => state.simulatedRole);
  const actualRole = (user?.email === 'fufazada@gmail.com') ? 'developer' : userData?.role;
  const effectiveRole = (actualRole === 'developer' && simulatedRole) ? simulatedRole : actualRole;

  useEffect(() => {
    if (currentView === 'control' && !(effectiveRole === 'developer' || effectiveRole === 'admin' || effectiveRole === 'moderator')) {
      setCurrentView('store');
    }
  }, [currentView, effectiveRole, setCurrentView]);

  const [isPending, startTransition] = useTransition();

  const handleNavClick = (view: string) => {
    startTransition(() => {
      setCurrentView(view as any);
    });
  };

  const navItems = [
    { id: 'store', label: 'App Store', icon: Store, permission: 'accessRecent' },
    { id: 'leaderboards', label: 'Leaderboards', icon: Trophy },
    { id: 'editor', label: translations[language].editor, icon: Code2, permission: 'publishApps' },
    { id: 'my-apps', label: translations[language].myApps, icon: Package },
    { id: 'asset-store', label: 'Asset Store', icon: Package, permission: 'accessAssetStore' },
    { id: 'donate', label: 'Donate', icon: Star },
    { id: 'premium', label: translations[language].premium, icon: Star, permission: 'accessPremium' },
    { id: 'profile', label: translations[language].profile, icon: User },
    ...(effectiveRole === 'developer' || effectiveRole === 'admin' || effectiveRole === 'moderator' ? [{ id: 'control', label: 'Control', icon: ShieldCheck, permission: 'accessControl' }] : []),
    { id: 'settings', label: translations[language].settings, icon: Settings },
  ] as const;

  const filteredNavItems = navItems.filter(item => {
    if (user?.email === 'fufazada@gmail.com') return true;
    if ('permission' in item && userData?.permissions) {
      const permKey = item.permission as keyof typeof userData.permissions;
      return userData.permissions[permKey] !== false;
    }
    return true;
  });

  const isFrutigerAero = useStore(state => state.isFrutigerAero);

  return (
    <div className={clsx(
      "flex flex-col md:flex-row h-screen w-full transition-colors duration-200 overflow-hidden relative", 
      isFrutigerAero ? 'frutiger-aero-bg text-blue-900' :
      theme === 'dark' ? 'bg-zinc-950 text-zinc-50' : 
      theme === 'gradient' ? 'bg-[#020617] text-zinc-50' : 
      'bg-zinc-50 text-zinc-900'
    )}>
      {isPending && (
        <div className="fixed top-0 left-0 w-full h-1 bg-emerald-500/20 z-[1000] overflow-hidden">
          <div className="h-full bg-emerald-500 animate-progress origin-left" />
        </div>
      )}
      {theme === 'gradient' && !isFrutigerAero && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-[10%] -left-[10%] w-[70%] h-[70%] rounded-full bg-emerald-500/20 blur-[120px] animate-pulse" />
          <div className="absolute top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-cyan-500/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute -bottom-[10%] left-[20%] w-[50%] h-[50%] rounded-full bg-blue-500/20 blur-[120px] animate-pulse" style={{ animationDelay: '4s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100%] h-[100%] bg-gradient-to-br from-emerald-900/10 via-transparent to-cyan-900/10" />
        </div>
      )}
      {/* Sidebar (Desktop) */}
      <div className={clsx(
        "hidden md:flex w-64 flex-col border-r relative z-10 h-screen", 
        isFrutigerAero ? 'frutiger-aero-glass border-white/50' :
        theme === 'dark' ? 'border-zinc-800 bg-zinc-950 shadow-2xl' : 
        theme === 'gradient' ? 'border-emerald-500/20 bg-black/40 backdrop-blur-2xl' : 
        'border-zinc-200 bg-white'
      )}>
        <div className={clsx(
          "flex flex-col h-full p-6",
          isFrutigerAero ? "" : 
          theme === 'gradient' ? "bg-transparent" :
          theme === 'dark' ? "bg-zinc-950" : 
          "bg-white"
        )}>
          <div className="mb-6">
            <h1 className={clsx("text-xl font-bold tracking-tight", isFrutigerAero ? "frutiger-aero-text" : "bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent")}>
              {isPremium ? 'EPL Premium' : 'EPL Studio'}
            </h1>
            <p className={clsx("text-[10px] mt-0.5", isFrutigerAero ? "text-blue-800/80" : "opacity-60 uppercase tracking-widest font-bold")}>Easy Programming Language</p>
          </div>

          {/* Profile/Sign-in at the Top for All Views */}
          <div className={clsx("mb-4 pb-4 border-b text-zinc-50", isFrutigerAero ? "border-white/40" : "border-zinc-800/50")}>
            {user ? (
              <div className="flex items-center gap-3 px-2 py-2">
                <img src={user.photoURL || getDefaultAvatar(user.uid)} alt="Avatar" className={clsx("w-8 h-8 rounded-full", isFrutigerAero ? "border border-white/60 shadow-sm" : "bg-zinc-800")} referrerPolicy="no-referrer" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate flex items-center gap-1">
                    {user.displayName}
                    {isPremium && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className={clsx("w-3 h-3 rounded-full flex items-center justify-center", isFrutigerAero ? "bg-blue-500/20" : "bg-emerald-500/20")}>
                      <div className={clsx("w-1.5 h-1.5 rounded-full", isFrutigerAero ? "bg-blue-500" : "bg-emerald-500")} />
                    </div>
                    <span className={clsx("text-[10px] font-bold uppercase tracking-wider", isFrutigerAero ? "text-blue-600" : "text-emerald-500")}>
                      {userData?.eplCoins || 0} Coins
                    </span>
                  </div>
                </div>
                <button onClick={handleLogOut} className={clsx("p-2 rounded-lg transition-colors", isFrutigerAero ? "text-blue-600 hover:bg-white/40 hover:text-red-500" : "hover:bg-zinc-800 text-zinc-400 hover:text-red-400")}>
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className={clsx("w-full py-2.5 px-4 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2", isFrutigerAero ? "frutiger-aero-button" : "bg-emerald-500 hover:bg-emerald-600 text-white")}
              >
                {t.auth.signIn}
              </button>
            )}
          </div>

          <nav className="px-4 space-y-2">
          {filteredNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id as any)}
              className={clsx(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                currentView === item.id
                  ? (isFrutigerAero ? 'frutiger-aero-button shadow-md' : theme === 'dark' ? 'bg-zinc-800 text-emerald-400' : 
                     theme === 'gradient' ? 'bg-emerald-900/50 text-emerald-300' : 
                     'bg-zinc-100 text-emerald-600')
                  : (isFrutigerAero ? 'text-blue-800 hover:bg-white/40 hover:shadow-sm' : theme === 'dark' ? 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200' : 
                     theme === 'gradient' ? 'text-emerald-200/70 hover:bg-emerald-900/30 hover:text-emerald-100' : 
                     'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900')
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </div>

      {/* Mobile Top Bar */}
      <div className={clsx("md:hidden flex items-center justify-between p-4 border-b relative z-10", isFrutigerAero ? 'frutiger-aero-glass border-white/50' : theme !== 'light' ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-white')}>
        <div className="flex items-center gap-3">
          {currentView !== 'editor' && currentView !== 'store' && (
            <button 
              onClick={() => setCurrentView('editor')}
              className={clsx("p-1.5 rounded-lg transition-colors", isFrutigerAero ? "text-blue-800 hover:bg-white/40" : "bg-zinc-800/50 text-zinc-400 hover:text-zinc-200")}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className={clsx("text-xl font-bold tracking-tight", isFrutigerAero ? "frutiger-aero-text" : "bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent")}>
            {isPremium ? 'EPL Premium' : 'EPL Studio'}
          </h1>
          {isBackdoor && (
            <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded uppercase animate-pulse">
              Backdoor Mode (No Cloud Save)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <img src={user.photoURL || getDefaultAvatar(user.uid)} alt="Avatar" className={clsx("w-8 h-8 rounded-full", isFrutigerAero ? "border border-white/60 shadow-sm" : "bg-zinc-800")} referrerPolicy="no-referrer" />
          ) : (
            <button onClick={() => setIsAuthModalOpen(true)} className={clsx("text-sm font-medium", isFrutigerAero ? "frutiger-aero-button px-3 py-1.5 rounded-lg" : "text-emerald-500")}>
              {t.auth.signIn}
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className={clsx(
        "flex-1 overflow-y-auto relative flex flex-col z-10",
        isFrutigerAero ? 'frutiger-aero-bg' :
        theme === 'dark' ? 'bg-zinc-950' :
        theme === 'gradient' ? 'bg-transparent' :
        'bg-zinc-50'
      )}>
        {children}
      </main>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {selectedAppId && <AppDetailView />}

      {/* Mobile Bottom Nav */}
      <div className={clsx("md:hidden flex items-center p-2 border-t pb-4 overflow-x-auto no-scrollbar relative z-10", isFrutigerAero ? 'frutiger-aero-glass border-white/50' : theme !== 'light' ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-white')}>
        <div className="flex items-center justify-around w-full min-w-max px-2 gap-1">
          {filteredNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id as any)}
              className={clsx(
                "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[64px]",
                currentView === item.id
                  ? (isFrutigerAero ? "text-blue-600 bg-white/40 shadow-sm" : "text-emerald-500")
                  : (isFrutigerAero ? "text-blue-800/70 hover:text-blue-800" : "text-zinc-500 hover:text-zinc-300")
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
