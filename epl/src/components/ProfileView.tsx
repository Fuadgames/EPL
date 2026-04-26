import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { auth, logOut } from '../firebase';
import { User, Mail, LogOut, Package, ExternalLink, Settings as SettingsIcon, Shield, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ACHIEVEMENTS_DB } from '../lib/achievements';
import { getDefaultAvatar } from '../lib/avatar';

interface AppData {
  id: string;
  title: string;
  downloads: number;
}

interface UserData {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

function RoleManager({ theme, isFrutigerAero }: { theme: string, isFrutigerAero?: boolean }) {
  const [searchEmail, setSearchEmail] = useState('');
  const [foundUser, setFoundUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');
    setFoundUser(null);
    try {
      const q = query(collection(db, 'users'), where('email', '==', searchEmail.trim()));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setError('User not found.');
      } else {
        const docSnap = snapshot.docs[0];
        setFoundUser({ id: docSnap.id, ...docSnap.data() } as UserData);
      }
    } catch (err: any) {
      setError('Error searching for user: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignRole = async (role: string) => {
    if (!foundUser) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await updateDoc(doc(db, 'users', foundUser.id), { role });
      setFoundUser({ ...foundUser, role });
      setSuccess(`Successfully assigned ${role} role to ${foundUser.email}`);
    } catch (err: any) {
      setError('Error assigning role: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={clsx(
      "p-6 rounded-3xl border mt-8",
      isFrutigerAero ? "bg-white/40 border-white/50 backdrop-blur-md shadow-sm" :
      theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
    )}>
      <h3 className={clsx("text-xl font-bold flex items-center gap-2 mb-4", isFrutigerAero ? "text-blue-900" : "")}>
        <Shield className={clsx("w-5 h-5", isFrutigerAero ? "text-blue-500" : "text-emerald-500")} />
        Role Management
      </h3>
      <p className={clsx("text-sm mb-4", isFrutigerAero ? "text-blue-800/70" : "text-zinc-500")}>Assign Admin or Moderator roles to other users.</p>
      
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className={clsx("w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2", isFrutigerAero ? "text-blue-500" : "text-zinc-500")} />
          <input 
            type="email"
            placeholder="User Email"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            className={clsx(
              "w-full pl-9 pr-4 py-2 rounded-xl border focus:outline-none focus:ring-2",
              isFrutigerAero ? "bg-white/60 border-white/40 text-blue-900 placeholder-blue-400 focus:ring-blue-400 backdrop-blur-md shadow-inner" :
              theme !== 'light' ? 'bg-zinc-900 border-zinc-800 text-white focus:ring-emerald-500/50' : 'bg-zinc-50 border-zinc-200 text-black focus:ring-emerald-500/50'
            )}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <button 
          onClick={handleSearch}
          disabled={loading || !searchEmail.trim()}
          className={clsx(
            "px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50",
            isFrutigerAero ? "frutiger-aero-button" : "bg-emerald-500 hover:bg-emerald-600 text-white"
          )}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      {success && <p className={clsx("text-sm mb-4", isFrutigerAero ? "text-blue-600" : "text-emerald-500")}>{success}</p>}

      {foundUser && (
        <div className={clsx(
          "p-4 rounded-xl border flex flex-col gap-4",
          isFrutigerAero ? "bg-white/50 border-white/40 shadow-inner" :
          theme !== 'light' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
        )}>
          <div className="flex justify-between items-center">
            <div>
              <p className={clsx("font-bold", isFrutigerAero ? "text-blue-900" : "")}>{foundUser.displayName || 'Anonymous'}</p>
              <p className={clsx("text-xs", isFrutigerAero ? "text-blue-800/70" : "text-zinc-500")}>{foundUser.email}</p>
            </div>
            <div className={clsx("text-xs font-bold px-2 py-1 rounded uppercase", isFrutigerAero ? "bg-blue-500/20 text-blue-800 border border-blue-500/30" : "bg-zinc-800 text-zinc-300")}>
              {foundUser.role || 'user'}
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => handleAssignRole('developer')}
              disabled={loading || foundUser.role === 'developer'}
              className={clsx(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50",
                isFrutigerAero ? "bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500 hover:text-white border border-emerald-500/30" : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white"
              )}
            >
              Make Developer
            </button>
            <button 
              onClick={() => handleAssignRole('admin')}
              disabled={loading || foundUser.role === 'admin'}
              className={clsx(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50",
                isFrutigerAero ? "bg-blue-500/20 text-blue-700 hover:bg-blue-500 hover:text-white border border-blue-500/30" : "bg-purple-500/10 text-purple-500 hover:bg-purple-500 hover:text-white"
              )}
            >
              Make Admin
            </button>
            <button 
              onClick={() => handleAssignRole('moderator')}
              disabled={loading || foundUser.role === 'moderator'}
              className={clsx(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50",
                isFrutigerAero ? "bg-cyan-500/20 text-cyan-700 hover:bg-cyan-500 hover:text-white border border-cyan-500/30" : "bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white"
              )}
            >
              Make Moderator
            </button>
            <button 
              onClick={() => handleAssignRole('user')}
              disabled={loading || foundUser.role === 'user' || !foundUser.role}
              className={clsx(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50",
                isFrutigerAero ? "bg-white/40 text-blue-800 hover:bg-white/60 border border-white/50" : "bg-zinc-500/10 text-zinc-500 hover:bg-zinc-500 hover:text-white"
              )}
            >
              Make User
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfileView() {
  const user = useStore(state => state.user);
  const userData = useStore(state => state.userData);
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const setCurrentView = useStore(state => state.setCurrentView);
  const setEditingAppId = useStore(state => state.setEditingAppId);
  const setUser = useStore(state => state.setUser);
  const setUserData = useStore(state => state.setUserData);
  const setIsBackdoor = useStore(state => state.setIsBackdoor);
  const [myApps, setMyApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (user) {
      const fetchMyApps = async () => {
        try {
          const q = query(collection(db, 'apps'), where('authorId', '==', user.uid));
          const snapshot = await getDocs(q);
          const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppData));
          // Sort in memory to avoid needing a composite index
          apps.sort((a, b) => {
            const dateA = (a as any).updatedAt ? new Date((a as any).updatedAt).getTime() : 0;
            const dateB = (b as any).updatedAt ? new Date((b as any).updatedAt).getTime() : 0;
            return dateB - dateA;
          });
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
          <h1 className={clsx("text-3xl font-bold tracking-tight", isFrutigerAero ? "text-blue-900" : "")}>Profile</h1>
          <button 
            onClick={() => setCurrentView('settings')}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all",
              isFrutigerAero ? "frutiger-aero-button" :
              theme !== 'light' ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800' : 'bg-white border-zinc-200 hover:bg-zinc-50'
            )}
          >
            <SettingsIcon className="w-4 h-4" /> Settings
          </button>
        </div>

        {/* Achievements Section */}
        <div className={clsx(
          "mb-8 p-6 rounded-3xl border",
          isFrutigerAero ? "bg-white/40 border-white/50 backdrop-blur-md shadow-sm" :
          theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
        )}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={clsx("text-xl font-bold", isFrutigerAero ? "text-blue-900" : "")}>Achievements Collection</h3>
            <span className={clsx("text-sm font-bold", theme !== 'light' ? 'text-zinc-500' : 'text-zinc-400')}>
              {(userData?.unlockedAchievements?.length || 0)} / 10 Unlocked
            </span>
          </div>
          
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {/* Actual earned achievements early */}
              <div className={clsx(
                 "flex flex-col items-center text-center p-3 rounded-2xl border transition-all duration-300",
                 (userData?.unlockedAchievements?.includes('early_adopter')) ? (isFrutigerAero ? "bg-blue-400/20 border-blue-400/50 shadow-inner" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500") : "opacity-40 grayscale border-dashed border-zinc-700 text-zinc-500"
              )}>
                <div className="text-2xl mb-1">🚀</div>
                <div className="font-bold text-[11px] leading-tight mb-1">Early Adopter</div>
                <div className="text-[9px] opacity-70">Joined early beta</div>
              </div>
              
              <div className={clsx(
                 "flex flex-col items-center text-center p-3 rounded-2xl border transition-all duration-300",
                 (userData?.unlockedAchievements?.includes('first_publish')) ? (isFrutigerAero ? "bg-blue-400/20 border-blue-400/50 shadow-inner" : "bg-yellow-500/10 border-yellow-500/30 text-yellow-500") : "opacity-40 grayscale border-dashed border-zinc-700 text-zinc-500"
              )}>
                <div className="text-2xl mb-1">🎮</div>
                <div className="font-bold text-[11px] leading-tight mb-1">First Publish</div>
                <div className="text-[9px] opacity-70">Published an app</div>
              </div>

              <div className={clsx(
                 "flex flex-col items-center text-center p-3 rounded-2xl border transition-all duration-300",
                 (userData?.unlockedAchievements?.includes('popular_creator')) ? (isFrutigerAero ? "bg-blue-400/20 border-blue-400/50 shadow-inner" : "bg-cyan-500/10 border-cyan-500/30 text-cyan-500") : "opacity-40 grayscale border-dashed border-zinc-700 text-zinc-500"
              )}>
                <div className="text-2xl mb-1">🔥</div>
                <div className="font-bold text-[11px] leading-tight mb-1">Popular Creator</div>
                <div className="text-[9px] opacity-70">Got 10+ downloads</div>
              </div>

              <div className={clsx(
                 "flex flex-col items-center text-center p-3 rounded-2xl border transition-all duration-300",
                 (userData?.unlockedAchievements?.includes('vip_member')) ? (isFrutigerAero ? "bg-blue-400/20 border-blue-400/50 shadow-inner" : "bg-purple-500/10 border-purple-500/30 text-purple-500") : "opacity-40 grayscale border-dashed border-zinc-700 text-zinc-500"
              )}>
                <div className="text-2xl mb-1">⭐</div>
                <div className="font-bold text-[11px] leading-tight mb-1">VIP Member</div>
                <div className="text-[9px] opacity-70">Admin/Dev role</div>
              </div>

              <div className={clsx(
                 "flex flex-col items-center text-center p-3 rounded-2xl border transition-all duration-300",
                 (userData?.unlockedAchievements?.includes('creative_soul')) ? (isFrutigerAero ? "bg-blue-400/20 border-blue-400/50 shadow-inner" : "bg-pink-500/10 border-pink-500/30 text-pink-500") : "opacity-40 grayscale border-dashed border-zinc-700 text-zinc-500"
              )}>
                <div className="text-2xl mb-1">🎨</div>
                <div className="font-bold text-[11px] leading-tight mb-1">Creative Soul</div>
                <div className="text-[9px] opacity-70">Created first block</div>
              </div>

              {/* NEW ACHIEVEMENTS */}
              <div className={clsx(
                 "flex flex-col items-center text-center p-3 rounded-2xl border transition-all duration-300",
                 (userData?.unlockedAchievements?.includes('code_trainer')) ? (isFrutigerAero ? "bg-blue-400/20 border-blue-400/50 shadow-inner" : "bg-indigo-500/10 border-indigo-500/30 text-indigo-500") : "opacity-40 grayscale border-dashed border-zinc-700 text-zinc-500"
              )}>
                <div className="text-2xl mb-1">🎓</div>
                <div className="font-bold text-[11px] leading-tight mb-1">Code Trainer</div>
                <div className="text-[9px] opacity-70">Finished Tutorial</div>
              </div>

              <div className={clsx(
                 "flex flex-col items-center text-center p-3 rounded-2xl border transition-all duration-300",
                 (userData?.unlockedAchievements?.includes('vibe_coding')) ? (isFrutigerAero ? "bg-blue-400/20 border-blue-400/50 shadow-inner" : "bg-blue-500/10 border-blue-500/30 text-blue-500") : "opacity-40 grayscale border-dashed border-zinc-700 text-zinc-500"
              )}>
                <div className="text-2xl mb-1">🤖</div>
                <div className="font-bold text-[11px] leading-tight mb-1">Vibe Coding</div>
                <div className="text-[9px] opacity-70">Used AI Agent</div>
              </div>

              <div className={clsx(
                 "flex flex-col items-center text-center p-3 rounded-2xl border transition-all duration-300",
                 (userData?.unlockedAchievements?.includes('together_create')) ? (isFrutigerAero ? "bg-blue-400/20 border-blue-400/50 shadow-inner" : "bg-teal-500/10 border-teal-500/30 text-teal-500") : "opacity-40 grayscale border-dashed border-zinc-700 text-zinc-500"
              )}>
                <div className="text-2xl mb-1">🤝</div>
                <div className="font-bold text-[11px] leading-tight mb-1">Don't create alone!</div>
                <div className="text-[9px] opacity-70">Together Create</div>
              </div>

              <div className={clsx(
                 "flex flex-col items-center text-center p-3 rounded-2xl border transition-all duration-300",
                 (userData?.unlockedAchievements?.includes('trader')) ? (isFrutigerAero ? "bg-blue-400/20 border-blue-400/50 shadow-inner" : "bg-orange-500/10 border-orange-500/30 text-orange-500") : "opacity-40 grayscale border-dashed border-zinc-700 text-zinc-500"
              )}>
                <div className="text-2xl mb-1">🏪</div>
                <div className="font-bold text-[11px] leading-tight mb-1">The Trader</div>
                <div className="text-[9px] opacity-70">Published to Asset Store</div>
              </div>

              <div className={clsx(
                 "flex flex-col items-center text-center p-3 rounded-2xl border transition-all duration-300",
                 (userData?.unlockedAchievements?.includes('gamer')) ? (isFrutigerAero ? "bg-blue-400/20 border-blue-400/50 shadow-inner" : "bg-rose-500/10 border-rose-500/30 text-rose-500") : "opacity-40 grayscale border-dashed border-zinc-700 text-zinc-500"
              )}>
                <div className="text-2xl mb-1">🕹️</div>
                <div className="font-bold text-[11px] leading-tight mb-1">Gamer</div>
                <div className="text-[9px] opacity-70">Downloaded a game</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User Info Card */}
          <div className={clsx(
            "p-8 rounded-3xl border flex flex-col items-center text-center h-fit",
            isFrutigerAero ? "bg-white/40 border-white/50 backdrop-blur-md shadow-sm" :
            theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
          )}>
            <img 
              src={user.photoURL || getDefaultAvatar(user.uid)} 
              alt="Avatar" 
              className={clsx("w-32 h-32 rounded-full mb-6 shadow-xl", isFrutigerAero ? "border-4 border-white/50 shadow-blue-500/20" : "bg-zinc-800 shadow-black/20")}
              referrerPolicy="no-referrer"
            />
            
            <h2 className={clsx("text-2xl font-bold mb-2", isFrutigerAero ? "text-blue-900" : "")}>{user.displayName}</h2>
            
            <div className={clsx("flex items-center gap-2 mb-8", isFrutigerAero ? "text-blue-700/70" : "text-zinc-500")}>
              <Mail className="w-4 h-4" />
              <span className="truncate max-w-[200px]">{user.email}</span>
            </div>

            {/* Role and EPLCoins Display */}
            <div className="w-full flex flex-col gap-2 mb-8">
              <div className={clsx(
                "px-4 py-2 rounded-xl border flex items-center justify-between",
                isFrutigerAero ? "bg-white/50 border-white/40 shadow-inner" :
                theme !== 'light' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
              )}>
                <span className={clsx("text-xs font-bold uppercase", isFrutigerAero ? "text-blue-800/60" : "text-zinc-500")}>Role</span>
                <span className={clsx("font-bold capitalize", isFrutigerAero ? "text-blue-900" : "")}>{userData?.role || 'User'}</span>
              </div>
              <div className={clsx(
                "px-4 py-2 rounded-xl border flex items-center justify-between",
                isFrutigerAero ? "bg-white/50 border-white/40 shadow-inner" :
                theme !== 'light' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
              )}>
                <span className={clsx("text-xs font-bold uppercase", isFrutigerAero ? "text-blue-800/60" : "text-zinc-500")}>EPLCoins</span>
                <span className={clsx("font-bold", isFrutigerAero ? "text-blue-600" : "text-emerald-500")}>{userData?.eplCoins || 0}</span>
              </div>
            </div>

            <div className="w-full grid grid-cols-2 gap-4 mb-8">
              <div className={clsx(
                "p-4 rounded-2xl border flex flex-col items-center justify-center",
                isFrutigerAero ? "bg-white/50 border-white/40 shadow-inner" :
                theme !== 'light' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
              )}>
                <span className={clsx("text-3xl font-bold mb-1", isFrutigerAero ? "text-blue-900" : "")}>{myApps.length}</span>
                <span className={clsx("text-[10px] uppercase tracking-wider font-bold", isFrutigerAero ? "text-blue-800/60" : "text-zinc-500")}>Apps</span>
              </div>
              <div className={clsx(
                "p-4 rounded-2xl border flex flex-col items-center justify-center",
                isFrutigerAero ? "bg-white/50 border-white/40 shadow-inner" :
                theme !== 'light' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
              )}>
                <span className={clsx("text-3xl font-bold mb-1", isFrutigerAero ? "text-blue-900" : "")}>{totalDownloads}</span>
                <span className={clsx("text-[10px] uppercase tracking-wider font-bold", isFrutigerAero ? "text-blue-800/60" : "text-zinc-500")}>Downloads</span>
              </div>
            </div>

            <button 
              onClick={handleLogOut}
              className={clsx(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors w-full justify-center",
                isFrutigerAero ? "bg-red-500/20 text-red-600 hover:bg-red-500 hover:text-white border border-red-500/30 backdrop-blur-sm" :
                "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
              )}
            >
              <LogOut className="w-5 h-5" /> Sign Out
            </button>
            
            {(userData?.role === 'developer' || userData?.role === 'admin') && (
              <RoleManager theme={theme} isFrutigerAero={isFrutigerAero} />
            )}
          </div>

          {/* My Projects Section */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className={clsx("text-xl font-bold flex items-center gap-2", isFrutigerAero ? "text-blue-900" : "")}>
                <Package className={clsx("w-5 h-5", isFrutigerAero ? "text-blue-500" : "text-emerald-500")} />
                My Projects
              </h3>
              <button 
                onClick={() => setCurrentView('my-apps')}
                className={clsx("text-sm hover:underline flex items-center gap-1", isFrutigerAero ? "text-blue-600" : "text-emerald-500")}
              >
                View All <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {loading ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className={clsx("h-24 rounded-2xl border", isFrutigerAero ? "bg-white/30 border-white/40" : theme !== 'light' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200')} />
                ))}
              </div>
            ) : myApps.length === 0 ? (
              <div className={clsx(
                "p-12 rounded-3xl border-2 border-dashed text-center",
                isFrutigerAero ? "border-blue-300/50 text-blue-800/60 bg-white/20" :
                theme !== 'light' ? 'border-zinc-800 text-zinc-600' : 'border-zinc-200 text-zinc-400'
              )}>
                <p>No projects published yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myApps.slice(0, 10).map(app => (
                  <div 
                    key={app.id}
                    className={clsx(
                      "p-5 rounded-2xl border flex items-center justify-between group transition-all hover:scale-[1.01]",
                      isFrutigerAero ? "bg-white/40 border-white/50 backdrop-blur-md shadow-sm hover:bg-white/50" :
                      theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900' : 'bg-white border-zinc-200 hover:bg-zinc-50'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={clsx("w-10 h-10 rounded-lg flex items-center justify-center font-bold", isFrutigerAero ? "bg-blue-500/20 text-blue-700 border border-blue-500/30 shadow-inner" : "bg-emerald-500/10 text-emerald-500")}>
                        {app.title.charAt(0)}
                      </div>
                      <div>
                        <h4 className={clsx("font-bold", isFrutigerAero ? "text-blue-900" : "")}>{app.title}</h4>
                        <p className={clsx("text-xs", isFrutigerAero ? "text-blue-800/70" : "text-zinc-500")}>{app.downloads || 0} downloads</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setEditingAppId(app.id);
                        setCurrentView('editor');
                      }}
                      className={clsx("p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity", isFrutigerAero ? "bg-white/50 text-blue-600 hover:bg-white border border-white/60 shadow-sm" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white")}
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
