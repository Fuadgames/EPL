import React from 'react';
import { useStore } from '../store/useStore';
import { Store, Code2, Package, User, Settings, LogOut, Sun, Moon } from 'lucide-react';
import { auth, logOut, signInWithGoogle } from '../firebase';
import { clsx } from 'clsx';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { currentView, setCurrentView, user, theme } = useStore();

  const navItems = [
    { id: 'store', label: 'Store', icon: Store },
    { id: 'editor', label: 'Code Editor', icon: Code2 },
    { id: 'my-apps', label: 'My Apps', icon: Package },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <div className={clsx("flex flex-col md:flex-row h-screen w-full transition-colors duration-200", theme === 'dark' ? 'bg-zinc-950 text-zinc-50' : 'bg-zinc-50 text-zinc-900')}>
      {/* Sidebar (Desktop) */}
      <div className={clsx("hidden md:flex w-64 flex-col border-r", theme === 'dark' ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-white')}>
        <div className="p-6">
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            EPL Studio
          </h1>
          <p className="text-xs mt-1 opacity-60">Easy Programming Language</p>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={clsx(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                currentView === item.id
                  ? (theme === 'dark' ? 'bg-zinc-800 text-emerald-400' : 'bg-zinc-100 text-emerald-600')
                  : (theme === 'dark' ? 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900')
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-800/50">
          {user ? (
            <div className="flex items-center gap-3 px-2 py-2">
              <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="Avatar" className="w-8 h-8 rounded-full bg-zinc-800" referrerPolicy="no-referrer" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.displayName}</p>
              </div>
              <button onClick={logOut} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-red-400 transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Mobile Top Bar */}
      <div className={clsx("md:hidden flex items-center justify-between p-4 border-b", theme === 'dark' ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-white')}>
        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          EPL Studio
        </h1>
        <div className="flex items-center gap-2">
          {user ? (
            <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="Avatar" className="w-8 h-8 rounded-full bg-zinc-800" referrerPolicy="no-referrer" />
          ) : (
            <button onClick={signInWithGoogle} className="text-sm font-medium text-emerald-500">Sign In</button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <div className={clsx("md:hidden flex items-center justify-around p-2 border-t pb-4", theme === 'dark' ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-white')}>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
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
