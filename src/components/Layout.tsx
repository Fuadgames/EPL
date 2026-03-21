import React, { useState } from 'react';
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
  const t = translations[language];
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const navItems = [
    { id: 'store', label: t.store, icon: Store },
    { id: 'editor', label: t.editor, icon: Code2 },
    { id: 'my-apps', label: t.myApps, icon: Package },
    { id: 'premium', label: t.premium, icon: Star },
    { id: 'profile', label: t.profile, icon: User },
    ...((user?.email === 'fufazada@gmail.com' && user?.displayName === 'Fuadgames') || userData?.role === 'admin' ? [{ id: 'control', label: 'Control', icon: ShieldCheck }] : []),
    { id: 'settings', label: t.settings, icon: Settings },
  ] as const;

  return (
    <div className={clsx(
      "flex flex-col md:flex-row h-screen w-full transition-colors duration-200", 
      theme === 'dark' ? 'bg-gradient-to-br from-zinc-900 to-zinc-950 text-zinc-50' : 
      theme === 'gradient' ? 'bg-gradient-to-br from-emerald-900 via-zinc-900 to-cyan-900 text-zinc-50' : 
      'bg-zinc-50 text-zinc-900'
    )}>
      {/* Sidebar (Desktop) */}
      <div className={clsx(
        "hidden md:flex w-64 flex-col border-r", 
        theme === 'dark' ? 'border-zinc-800 bg-zinc-900/50' : 
        theme === 'gradient' ? 'border-emerald-800/50 bg-emerald-950/50' : 
        'border-zinc-200 bg-white'
      )}>
        <div className="flex flex-col h-full p-6">
          <div className="mb-10">
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              EPL Studio
            </h1>
            <p className="text-xs mt-1 opacity-60">Easy Programming Language</p>
          </div>

          {/* Conditional Profile/Sign-in at the Top for Store View */}
          {currentView === 'store' && (
            <div className="mb-6 pb-6 border-b border-zinc-800/50">
              {user ? (
                <div className="flex items-center gap-3 px-2 py-2">
                  <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="Avatar" className="w-8 h-8 rounded-full bg-zinc-800" referrerPolicy="no-referrer" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1">
                      {user.displayName}
                      {isPremium && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="w-3 h-3 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      </div>
                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                        {userData?.eplCoins || 0} Coins
                      </span>
                    </div>
                  </div>
                  <button onClick={logOut} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-red-400 transition-colors">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {t.auth.signIn}
                </button>
              )}
            </div>
          )}

          <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as any)}
              className={clsx(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                currentView === item.id
                  ? (theme === 'dark' ? 'bg-zinc-800 text-emerald-400' : 
                     theme === 'gradient' ? 'bg-emerald-900/50 text-emerald-300' : 
                     'bg-zinc-100 text-emerald-600')
                  : (theme === 'dark' ? 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200' : 
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
          <div className="p-4 border-t border-zinc-800/50">
            {user ? (
              <div className="flex items-center gap-3 px-2 py-2">
                <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="Avatar" className="w-8 h-8 rounded-full bg-zinc-800" referrerPolicy="no-referrer" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate flex items-center gap-1">
                    {user.displayName}
                    {isPremium && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </div>
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                      {userData?.eplCoins || 0} Coins
                    </span>
                  </div>
                </div>
                <button onClick={logOut} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-red-400 transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {t.auth.signIn}
              </button>
            )}
          </div>
        )}
      </div>
    </div>

      {/* Mobile Top Bar */}
      <div className={clsx("md:hidden flex items-center justify-between p-4 border-b", theme !== 'light' ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-white')}>
        <div className="flex items-center gap-3">
          {currentView !== 'editor' && (
            <button 
              onClick={() => setCurrentView('editor')}
              className="p-1.5 rounded-lg bg-zinc-800/50 text-zinc-400 hover:text-zinc-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            EPL Studio
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="Avatar" className="w-8 h-8 rounded-full bg-zinc-800" referrerPolicy="no-referrer" />
          ) : (
            <button onClick={() => setIsAuthModalOpen(true)} className="text-sm font-medium text-emerald-500">
              {t.auth.signIn}
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative flex flex-col">
        {children}
      </main>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {selectedAppId && <AppDetailView />}

      {/* Mobile Bottom Nav */}
      <div className={clsx("md:hidden flex items-center justify-around p-2 border-t pb-4", theme !== 'light' ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-white')}>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id as any)}
            className={clsx(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
              currentView === item.id
                ? "text-emerald-500"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
