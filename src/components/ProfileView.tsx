import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { auth, logOut } from '../firebase';
import { User, Mail, LogOut, Package, ExternalLink, Settings as SettingsIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface AppData {
  id: string;
  title: string;
  downloads: number;
}

export default function ProfileView() {
  const { user, theme, setCurrentView, setEditingAppId } = useStore();
  const [myApps, setMyApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const fetchMyApps = async () => {
        try {
          const q = query(collection(db, 'apps'), where('authorId', '==', user.uid));
          const snapshot = await getDocs(q);
          const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppData));
          setMyApps(apps);
        } catch (error) {
          console.error("Error fetching user apps", error);
        } finally {
          setLoading(false);
        }
      };
      fetchMyApps();
    }
  }, [user]);

  if (!user) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <User className="w-16 h-16 text-zinc-500 mb-4 opacity-50" />
        <h2 className="text-2xl font-bold mb-2">Not Signed In</h2>
        <p className="text-zinc-500 max-w-md">Sign in from the sidebar to view your profile and manage your account.</p>
      </div>
    );
  }

  const totalDownloads = myApps.reduce((acc, app) => acc + (app.downloads || 0), 0);

  return (
    <div className="h-full flex flex-col p-4 sm:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          <button 
            onClick={() => setCurrentView('settings')}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all",
              theme !== 'light' ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800' : 'bg-white border-zinc-200 hover:bg-zinc-50'
            )}
          >
            <SettingsIcon className="w-4 h-4" /> Settings
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User Info Card */}
          <div className={clsx(
            "p-8 rounded-3xl border flex flex-col items-center text-center h-fit",
            theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
          )}>
            <img 
              src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
              alt="Avatar" 
              className="w-32 h-32 rounded-full bg-zinc-800 mb-6 shadow-xl shadow-black/20"
              referrerPolicy="no-referrer"
            />
            
            <h2 className="text-2xl font-bold mb-2">{user.displayName}</h2>
            
            <div className="flex items-center gap-2 text-zinc-500 mb-8">
              <Mail className="w-4 h-4" />
              <span className="truncate max-w-[200px]">{user.email}</span>
            </div>

            <div className="w-full grid grid-cols-2 gap-4 mb-8">
              <div className={clsx(
                "p-4 rounded-2xl border flex flex-col items-center justify-center",
                theme !== 'light' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
              )}>
                <span className="text-3xl font-bold mb-1">{myApps.length}</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Apps</span>
              </div>
              <div className={clsx(
                "p-4 rounded-2xl border flex flex-col items-center justify-center",
                theme !== 'light' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
              )}>
                <span className="text-3xl font-bold mb-1">{totalDownloads}</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Downloads</span>
              </div>
            </div>

            <button 
              onClick={logOut}
              className="flex items-center gap-2 px-6 py-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl font-medium transition-colors w-full justify-center"
            >
              <LogOut className="w-5 h-5" /> Sign Out
            </button>
          </div>

          {/* My Projects Section */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-500" />
                My Projects
              </h3>
              <button 
                onClick={() => setCurrentView('my-apps')}
                className="text-sm text-emerald-500 hover:underline flex items-center gap-1"
              >
                View All <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {loading ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className={clsx("h-24 rounded-2xl border", theme !== 'light' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200')} />
                ))}
              </div>
            ) : myApps.length === 0 ? (
              <div className={clsx(
                "p-12 rounded-3xl border-2 border-dashed text-center",
                theme !== 'light' ? 'border-zinc-800 text-zinc-600' : 'border-zinc-200 text-zinc-400'
              )}>
                <p>No projects published yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myApps.slice(0, 5).map(app => (
                  <div 
                    key={app.id}
                    className={clsx(
                      "p-5 rounded-2xl border flex items-center justify-between group transition-all hover:scale-[1.01]",
                      theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900' : 'bg-white border-zinc-200 hover:bg-zinc-50'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                        {app.title.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold">{app.title}</h4>
                        <p className="text-xs text-zinc-500">{app.downloads || 0} downloads</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setEditingAppId(app.id);
                        setCurrentView('editor');
                      }}
                      className="p-2 rounded-lg bg-zinc-800 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
