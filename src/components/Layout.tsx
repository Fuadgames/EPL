import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Store, Code2, Package, User, Settings, LogOut, Sun, Moon, Star, ArrowLeft, ShieldCheck } from 'lucide-react';
import { auth, logOut } from '../firebase';
import { clsx } from 'clsx';
import { translations } from '../lib/translations';
import AuthModal from './AuthModal';
import AppDetailView from './AppDetailView';

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
  const effectiveRole = (userData?.role === 'developer' && simulatedRole) ? simulatedRole : userData?.role;

  useEffect(() => {
    if (currentView === 'control' && !(effectiveRole === 'developer' || effectiveRole === 'admin' || effectiveRole === 'moderator')) {
      setCurrentView('store');
    }
  }, [currentView, effectiveRole, setCurrentView]);

  const navItems = [
    { id: 'store', label: t.store, icon: Store, permission: 'accessAssetStore' },
    { id: 'editor', label: t.editor, icon: Code2, permission: 'publishApps' },
    { id: 'my-apps', label: t.myApps, icon: Package },
    { id: 'asset-store', label: 'Asset Store', icon: Store, permission: 'accessAssetStore' },
    { id: 'premium', label: t.premium, icon: Star, permission: 'accessPremium' },
    { id: 'profile', label: t.profile, icon: User },
    ...(effectiveRole === 'developer' || effectiveRole === 'admin' || effectiveRole === 'moderator' ? [{ id: 'control', label: 'Control', icon: ShieldCheck, permission: 'accessControl' }] : []),
    { id: 'settings', label: t.settings, icon: Settings },
  ] as const;

  const filteredNavItems = navItems.filter(item => {
    if ('permission' in item && userData?.permissions) {
      const permKey = item.permission as keyof typeof userData.permissions;
      return userData.permissions[permKey] !== false;
    }
    return true;
  });

  const isFrutigerAero = useStore(state => state.isFrutigerAero);

  return (
    <div className={clsx(
      "flex flex-col md:flex-row h-screen w-full transition-colors duration-200", 
      isFrutigerAero ? 'frutiger-aero-bg text-blue-900' :
      theme === 'dark' ? 'bg-gradient-to-br from-zinc-900 to-zinc-950 text-zinc-50' : 
      theme === 'gradient' ? 'bg-gradient-to-br from-emerald-900 via-zinc-900 to-cyan-900 text-zinc-50' : 
      'bg-zinc-50 text-zinc-900'
    )}>
      {/* Sidebar (Desktop) */}
      <div className={clsx(
        "hidden md:flex w-64 flex-col border-r relative z-10", 
        isFrutigerAero ? 'frutiger-aero-glass border-white/50' :
        theme === 'dark' ? 'border-zinc-800 bg-zinc-900/50' : 
        theme === 'gradient' ? 'border-emerald-800/50 bg-emerald-950/50' : 
        'border-zinc-200 bg-white'
      )}>
        <div className="flex flex-col h-full p-6">
          <div className="mb-10">
            <h1 className={clsx("text-2xl font-bold tracking-tight", isFrutigerAero ? "frutiger-aero-text" : "bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent")}>
              EPL Studio
            </h1>
            <p className={clsx("text-xs mt-1", isFrutigerAero ? "text-blue-800/80" : "opacity-60")}>Easy Programming Language</p>
          </div>

          {/* Conditional Profile/Sign-in at the Top for Store View */}
          {currentView === 'store' && (
            <div className={clsx("mb-6 pb-6 border-b", isFrutigerAero ? "border-white/40" : "border-zinc-800/50")}>
              {user ? (
                <div className="flex items-center gap-3 px-2 py-2">
                  <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="Avatar" className={clsx("w-8 h-8 rounded-full", isFrutigerAero ? "border border-white/60 shadow-sm" : "bg-zinc-800")} referrerPolicy="no-referrer" />
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
          )}

          <nav className="flex-1 px-4 space-y-2">
          {filteredNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as any)}
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

        {/* Conditional Profile/Sign-in at the Bottom for Non-Store Views */}
        {currentView !== 'store' && (
          <div className={clsx("p-4 border-t", isFrutigerAero ? "border-white/40" : "border-zinc-800/50")}>
            {user ? (
              <div className="flex items-center gap-3 px-2 py-2">
                <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="Avatar" className={clsx("w-8 h-8 rounded-full", isFrutigerAero ? "border border-white/60 shadow-sm" : "bg-zinc-800")} referrerPolicy="no-referrer" />
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
        )}
      </div>
    </div>

      {/* Mobile Top Bar */}
      <div className={clsx("md:hidden flex items-center justify-between p-4 border-b relative z-10", isFrutigerAero ? 'frutiger-aero-glass border-white/50' : theme !== 'light' ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-white')}>
        <div className="flex items-center gap-3">
          {currentView !== 'editor' && (
            <button 
              onClick={() => setCurrentView('editor')}
              className={clsx("p-1.5 rounded-lg transition-colors", isFrutigerAero ? "text-blue-800 hover:bg-white/40" : "bg-zinc-800/50 text-zinc-400 hover:text-zinc-200")}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className={clsx("text-xl font-bold tracking-tight", isFrutigerAero ? "frutiger-aero-text" : "bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent")}>
            EPL Studio
          </h1>
          {isBackdoor && (
            <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded uppercase animate-pulse">
              Backdoor Mode (No Cloud Save)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="Avatar" className={clsx("w-8 h-8 rounded-full", isFrutigerAero ? "border border-white/60 shadow-sm" : "bg-zinc-800")} referrerPolicy="no-referrer" />
          ) : (
            <button onClick={() => setIsAuthModalOpen(true)} className={clsx("text-sm font-medium", isFrutigerAero ? "frutiger-aero-button px-3 py-1.5 rounded-lg" : "text-emerald-500")}>
              {t.auth.signIn}
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative flex flex-col z-10">
        {children}
      </main>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {selectedAppId && <AppDetailView />}

      {/* Mobile Bottom Nav */}
      <div className={clsx("md:hidden flex items-center p-2 border-t pb-4 overflow-x-auto no-scrollbar relative z-10", isFrutigerAero ? 'frutiger-aero-glass border-white/50' : theme !== 'light' ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-white')}>
        <div className="flex items-center justify-around w-full min-w-max px-2 gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as any)}
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
