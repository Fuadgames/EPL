import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { logOut, db, auth } from '../firebase';
import { User, Mail, LogOut, Package, ExternalLink, Settings as SettingsIcon, Shield, Search, ShieldCheck, Trophy } from 'lucide-react';
import { clsx } from 'clsx';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { getDefaultAvatar } from '../lib/avatar';
import { notify } from '../store/useDialogStore';

interface AppData {
  id: string;
  title: string;
  downloads: number;
}

interface UserData {
  id: string;
  email: string;
  name?: string;
  displayName?: string;
  role: string;
}

function RoleManager({ theme, isFrutigerAero }: { theme: string; isFrutigerAero?: boolean }) {
  const [searchEmail, setSearchEmail] = useState('');
  const [foundUser, setFoundUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSearch = async () => {
    const trimmed = searchEmail.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    setSuccess('');
    setFoundUser(null);
    try {
      let q = query(collection(db, 'users'), where('email', '==', trimmed));
      let snapshot = await getDocs(q);
      if (snapshot.empty && trimmed !== trimmed.toLowerCase()) {
        q = query(collection(db, 'users'), where('email', '==', trimmed.toLowerCase()));
        snapshot = await getDocs(q);
      }
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
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken().catch(() => '');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      let apiOk = false;
      try {
        const res = await fetch('/api/admin/set-role', {
          method: 'POST',
          headers,
          body: JSON.stringify({ uid: foundUser.id, role, adminUid: auth.currentUser?.uid }),
        });
        apiOk = res.ok;
      } catch (_) {}

      await setDoc(doc(db, 'users', foundUser.id), { role }, { merge: true }).catch((e) => {
        if (!apiOk) throw e;
      });
      await setDoc(doc(db, 'users_public', foundUser.id), { role }, { merge: true }).catch(() => {});

      setFoundUser({ ...foundUser, role });
      const msg = `Successfully assigned ${role} role to ${foundUser.email}`;
      setSuccess(msg);
      notify.success(msg);
    } catch (err: any) {
      const msg = 'Error assigning role: ' + err.message;
      setError(msg);
      notify.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={clsx(
      "p-5 rounded-xl border mt-6 w-full text-left",
      isFrutigerAero ? "bg-white/40 border-white/50 backdrop-blur-md shadow-sm" :
      theme !== 'light' ? 'bg-[#181B20] border-[#262B33]' : 'bg-white border-[#E2E5EA]'
    )}>
      <h3 className={clsx("text-sm font-bold uppercase tracking-wider flex items-center gap-2 mb-1.5", isFrutigerAero ? "text-blue-900" : theme !== 'light' ? "text-[#F3F4F6]" : "text-[#111315]")}>
        <Shield className={clsx("w-4 h-4", isFrutigerAero ? "text-blue-500" : "text-[#10B981]")} />
        Role Management
      </h3>
      <p className={clsx("text-xs mb-4", isFrutigerAero ? "text-blue-800/70" : theme !== 'light' ? "text-[#9CA3AF]" : "text-[#525866]")}>
        Assign Developer, Admin, or Moderator roles by email.
      </p>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search className={clsx("w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2", isFrutigerAero ? "text-blue-500" : "text-[#6B7280]")} />
          <input
            type="email"
            placeholder="User Email"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            className={clsx(
              "w-full pl-9 pr-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors",
              isFrutigerAero ? "bg-white/60 border-white/40 text-blue-900 placeholder-blue-400" :
              theme !== 'light' ? 'bg-[#111315] border-[#262B33] text-[#F3F4F6] focus:border-[#10B981]' : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315] focus:border-[#059669]'
            )}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || !searchEmail.trim()}
          className={clsx(
            "px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer",
            isFrutigerAero ? "frutiger-aero-button" : "bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E]"
          )}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && <p className="text-red-400 text-xs mb-3 font-medium">{error}</p>}
      {success && <p className={clsx("text-xs mb-3 font-medium", isFrutigerAero ? "text-blue-600" : "text-[#10B981]")}>{success}</p>}

      {foundUser && (
        <div className={clsx(
          "p-3.5 rounded-lg border flex flex-col gap-3",
          isFrutigerAero ? "bg-white/50 border-white/40 shadow-inner" :
          theme !== 'light' ? 'bg-[#111315] border-[#262B33]' : 'bg-[#F5F6F8] border-[#E2E5EA]'
        )}>
          <div className="flex justify-between items-center gap-2">
            <div className="min-w-0">
              <p className={clsx("font-semibold text-sm truncate", isFrutigerAero ? "text-blue-900" : theme !== 'light' ? "text-[#F3F4F6]" : "text-[#111315]")}>
                {foundUser.name || foundUser.displayName || 'Anonymous'}
              </p>
              <p className={clsx("text-xs truncate", isFrutigerAero ? "text-blue-800/70" : "text-[#6B7280]")}>
                {foundUser.email}
              </p>
            </div>
            <div className={clsx(
              "text-[10px] font-mono-num font-bold px-2 py-0.5 rounded border uppercase shrink-0",
              isFrutigerAero ? "bg-blue-500/20 text-blue-800 border-blue-500/30" : theme !== 'light' ? "bg-[#181B20] border-[#262B33] text-[#9CA3AF]" : "bg-white border-[#E2E5EA] text-[#525866]"
            )}>
              {foundUser.role || 'user'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleAssignRole('developer')}
              disabled={loading || foundUser.role === 'developer'}
              className={clsx(
                "py-1.5 px-2 rounded-md text-xs font-semibold border transition-colors disabled:opacity-40 cursor-pointer",
                isFrutigerAero ? "bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500 hover:text-white border-emerald-500/30" :
                theme !== 'light' ? "bg-[#181B20] border-[#262B33] text-[#10B981] hover:bg-[#10B981]/15" : "bg-white border-[#E2E5EA] text-[#059669] hover:bg-emerald-50"
              )}
            >
              Developer
            </button>
            <button
              onClick={() => handleAssignRole('admin')}
              disabled={loading || foundUser.role === 'admin'}
              className={clsx(
                "py-1.5 px-2 rounded-md text-xs font-semibold border transition-colors disabled:opacity-40 cursor-pointer",
                isFrutigerAero ? "bg-blue-500/20 text-blue-700 hover:bg-blue-500 hover:text-white border-blue-500/30" :
                theme !== 'light' ? "bg-[#181B20] border-[#262B33] text-[#F3F4F6] hover:bg-[#262B33]" : "bg-white border-[#E2E5EA] text-[#111315] hover:bg-zinc-100"
              )}
            >
              Admin
            </button>
            <button
              onClick={() => handleAssignRole('moderator')}
              disabled={loading || foundUser.role === 'moderator'}
              className={clsx(
                "py-1.5 px-2 rounded-md text-xs font-semibold border transition-colors disabled:opacity-40 cursor-pointer",
                isFrutigerAero ? "bg-cyan-500/20 text-cyan-700 hover:bg-cyan-500 hover:text-white border-cyan-500/30" :
                theme !== 'light' ? "bg-[#181B20] border-[#262B33] text-[#9CA3AF] hover:bg-[#262B33] hover:text-[#F3F4F6]" : "bg-white border-[#E2E5EA] text-[#525866] hover:bg-zinc-100"
              )}
            >
              Moderator
            </button>
            <button
              onClick={() => handleAssignRole('user')}
              disabled={loading || foundUser.role === 'user' || !foundUser.role}
              className={clsx(
                "py-1.5 px-2 rounded-md text-xs font-semibold border transition-colors disabled:opacity-40 cursor-pointer",
                isFrutigerAero ? "bg-white/40 text-blue-800 hover:bg-white/60 border-white/50" :
                theme !== 'light' ? "bg-[#181B20] border-[#262B33] text-[#6B7280] hover:bg-[#262B33] hover:text-[#9CA3AF]" : "bg-white border-[#E2E5EA] text-[#525866] hover:bg-zinc-100"
              )}
            >
              User
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const ACHIEVEMENTS_LIST = [
  { id: 'early_adopter', icon: '🚀', title: 'Early Adopter', desc: 'Joined early beta' },
  { id: 'first_publish', icon: '🎮', title: 'First Publish', desc: 'Published an app' },
  { id: 'popular_creator', icon: '🔥', title: 'Popular Creator', desc: 'Got 10+ downloads' },
  { id: 'vip_member', icon: '⭐', title: 'VIP Member', desc: 'Admin/Dev role' },
  { id: 'creative_soul', icon: '🎨', title: 'Creative Soul', desc: 'Created first block' },
  { id: 'code_trainer', icon: '🎓', title: 'Code Trainer', desc: 'Finished Tutorial' },
  { id: 'vibe_coding', icon: '🤖', title: 'Vibe Coding', desc: 'Used AI Agent' },
  { id: 'together_create', icon: '🤝', title: "Don't create alone!", desc: 'Together Create' },
  { id: 'trader', icon: '🏪', title: 'The Trader', desc: 'Published to Asset Store' },
  { id: 'gamer', icon: '🕹️', title: 'Gamer', desc: 'Downloaded a game' },
];

export default function ProfileView() {
  const user = useStore(state => state.user);
  const userData = useStore(state => state.userData);
  const theme = useStore(state => state.theme);
  const language = useStore(state => state.language);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const setCurrentView = useStore(state => state.setCurrentView);
  const setEditingAppId = useStore(state => state.setEditingAppId);
  const setUser = useStore(state => state.setUser);
  const setUserData = useStore(state => state.setUserData);
  const [myApps, setMyApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);

  const handleLogOut = async () => {
    try {
      await logOut();
    } catch (e) {
      console.error(e);
    }
    setUser(null);
    setUserData(null);
  };

  useEffect(() => {
    if (!user) {
      setMyApps([]);
      setLoading(false);
      return;
    }
    const fetchMyApps = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'apps'), where('authorId', '==', user.uid));
        const snapshot = await getDocs(q);
        const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppData));
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
  }, [user]);

  if (!user) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 sm:p-8 text-center">
        <User className="w-14 h-14 text-[#6B7280] mb-4 opacity-60" />
        <h2 className="text-xl font-bold mb-2">
          {language === 'ru' ? 'Вы не вошли в аккаунт' : 'Not Signed In'}
        </h2>
        <p className="text-sm text-[#9CA3AF] max-w-md">
          {language === 'ru'
            ? 'Войдите через боковую панель, чтобы просматривать профиль и управлять аккаунтом.'
            : 'Sign in from the sidebar to view your profile and manage your account.'}
        </p>
      </div>
    );
  }

  const totalDownloads = myApps.reduce((acc, app) => acc + (app.downloads || 0), 0);
  const unlockedIds = userData?.unlockedAchievements || [];

  return (
    <div className="h-full flex flex-col p-3.5 sm:p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-[#262B33]/60">
          <div>
            <h1 className={clsx("text-xl sm:text-2xl font-bold tracking-tight", isFrutigerAero ? "text-blue-900" : theme !== 'light' ? "text-[#F3F4F6]" : "text-[#111315]")}>
              {language === 'ru' ? 'Профиль' : 'Profile'}
            </h1>
            <p className={clsx("text-xs mt-0.5", isFrutigerAero ? "text-blue-800/70" : theme !== 'light' ? "text-[#9CA3AF]" : "text-[#525866]")}>
              {language === 'ru' ? 'Метрики аккаунта, профиль и ваши проекты' : 'Account metrics, credentials, and published builds'}
            </p>
          </div>
          <button
            onClick={() => setCurrentView('settings')}
            className={clsx(
              "flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer",
              isFrutigerAero ? "frutiger-aero-button" :
              theme !== 'light' ? 'bg-[#181B20] border-[#262B33] text-[#F3F4F6] hover:bg-[#22262E]' : 'bg-white border-[#E2E5EA] text-[#111315] hover:bg-[#F5F6F8]'
            )}
          >
            <SettingsIcon className="w-4 h-4" /> {language === 'ru' ? 'Настройки' : 'Settings'}
          </button>
        </div>

        {/* Achievements Section */}
        <div className={clsx(
          "mb-6 p-4 sm:p-5 rounded-xl border",
          isFrutigerAero ? "bg-white/40 border-white/50 backdrop-blur-md shadow-sm" :
          theme !== 'light' ? 'bg-[#181B20] border-[#262B33]' : 'bg-white border-[#E2E5EA]'
        )}>
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className={clsx("text-sm font-bold uppercase tracking-wider flex items-center gap-2", isFrutigerAero ? "text-blue-900" : theme !== 'light' ? "text-[#F3F4F6]" : "text-[#111315]")}>
              <Trophy className={clsx("w-4 h-4", isFrutigerAero ? "text-blue-600" : "text-[#10B981]")} />
              {language === 'ru' ? 'Достижения' : 'Achievements'}
            </h3>
            <span className={clsx("text-xs font-mono-num font-semibold px-2 py-0.5 rounded border shrink-0", isFrutigerAero ? "bg-white/50 border-white/40 text-blue-900" : theme !== 'light' ? 'bg-[#111315] border-[#262B33] text-[#9CA3AF]' : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#525866]')}>
              {unlockedIds.length} / {ACHIEVEMENTS_LIST.length} {language === 'ru' ? 'открыто' : 'Unlocked'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {ACHIEVEMENTS_LIST.map((ach) => {
              const unlocked = unlockedIds.includes(ach.id);
              return (
                <div
                  key={ach.id}
                  className={clsx(
                    "flex flex-col items-center text-center p-3 rounded-lg border transition-colors",
                    unlocked
                      ? isFrutigerAero
                        ? "bg-blue-400/20 border-blue-400/50 shadow-inner text-blue-900"
                        : theme !== 'light'
                          ? "bg-[#10B981]/10 border-[#10B981]/40 text-[#F3F4F6]"
                          : "bg-emerald-50 border-[#059669]/30 text-[#111315]"
                      : isFrutigerAero
                        ? "opacity-45 grayscale border-dashed border-blue-300/60 text-blue-900/60"
                        : theme !== 'light'
                          ? "opacity-40 grayscale bg-[#111315] border-dashed border-[#262B33] text-[#6B7280]"
                          : "opacity-45 grayscale bg-[#F5F6F8] border-dashed border-[#E2E5EA] text-[#6B7280]"
                  )}
                >
                  <div className="text-xl mb-1">{ach.icon}</div>
                  <div className="font-semibold text-[11px] leading-tight mb-0.5">{ach.title}</div>
                  <div className="text-[10px] opacity-75">{ach.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Info Card */}
          <div className="flex flex-col">
            <div className={clsx(
              "p-6 rounded-xl border flex flex-col items-center text-center h-fit",
              isFrutigerAero ? "bg-white/40 border-white/50 backdrop-blur-md shadow-sm" :
              theme !== 'light' ? 'bg-[#181B20] border-[#262B33]' : 'bg-white border-[#E2E5EA]'
            )}>
              <img
                src={user.photoURL || getDefaultAvatar(user.uid)}
                alt="Avatar"
                className={clsx(
                  "w-24 h-24 rounded-xl object-cover mb-4 border",
                  isFrutigerAero ? "border-4 border-white/60 shadow-blue-500/20 shadow-lg" : theme !== 'light' ? "bg-[#111315] border-[#262B33]" : "bg-[#F5F6F8] border-[#E2E5EA]"
                )}
                referrerPolicy="no-referrer"
              />

              <h2 className={clsx("text-xl font-bold mb-1", isFrutigerAero ? "text-blue-900" : theme !== 'light' ? "text-[#F3F4F6]" : "text-[#111315]")}>
                {user.displayName}
              </h2>

              <div className={clsx("flex items-center gap-1.5 text-xs mb-6", isFrutigerAero ? "text-blue-700/80" : "text-[#9CA3AF]")}>
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[210px]">{user.email}</span>
              </div>

              {/* Role and EPLCoins Display */}
              <div className="w-full flex flex-col gap-2 mb-5">
                <div className={clsx(
                  "px-3.5 py-2.5 rounded-lg border flex items-center justify-between gap-2",
                  isFrutigerAero ? "bg-white/50 border-white/40 shadow-inner" :
                  theme !== 'light' ? 'bg-[#111315] border-[#262B33]' : 'bg-[#F5F6F8] border-[#E2E5EA]'
                )}>
                  <span className={clsx("text-[11px] font-bold uppercase tracking-wider", isFrutigerAero ? "text-blue-800/70" : "text-[#6B7280]")}>Role</span>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <span className={clsx("text-sm font-semibold capitalize", isFrutigerAero ? "text-blue-900" : theme !== 'light' ? "text-[#F3F4F6]" : "text-[#111315]")}>
                      {userData?.role || 'User'}
                    </span>
                    {userData?.roleVerification === 'Role is allowed by dev' && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/35 font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-[#10B981]" />
                        Role is allowed by dev
                      </span>
                    )}
                  </div>
                </div>
                <div className={clsx(
                  "px-3.5 py-2.5 rounded-lg border flex items-center justify-between",
                  isFrutigerAero ? "bg-white/50 border-white/40 shadow-inner" :
                  theme !== 'light' ? 'bg-[#111315] border-[#262B33]' : 'bg-[#F5F6F8] border-[#E2E5EA]'
                )}>
                  <span className={clsx("text-[11px] font-bold uppercase tracking-wider", isFrutigerAero ? "text-blue-800/70" : "text-[#6B7280]")}>EPLCoins</span>
                  <span className={clsx("font-mono-num font-bold text-sm", isFrutigerAero ? "text-blue-600" : "text-[#10B981]")}>
                    {userData?.eplCoins || 0}
                  </span>
                </div>
              </div>

              <div className="w-full grid grid-cols-2 gap-2.5 mb-5">
                <div className={clsx(
                  "p-3.5 rounded-lg border flex flex-col items-center justify-center",
                  isFrutigerAero ? "bg-white/50 border-white/40 shadow-inner" :
                  theme !== 'light' ? 'bg-[#111315] border-[#262B33]' : 'bg-[#F5F6F8] border-[#E2E5EA]'
                )}>
                  <span className={clsx("text-2xl font-mono-num font-bold mb-0.5", isFrutigerAero ? "text-blue-900" : theme !== 'light' ? "text-[#F3F4F6]" : "text-[#111315]")}>
                    {myApps.length}
                  </span>
                  <span className={clsx("text-[10px] uppercase tracking-wider font-semibold", isFrutigerAero ? "text-blue-800/60" : "text-[#6B7280]")}>
                    Apps
                  </span>
                </div>
                <div className={clsx(
                  "p-3.5 rounded-lg border flex flex-col items-center justify-center",
                  isFrutigerAero ? "bg-white/50 border-white/40 shadow-inner" :
                  theme !== 'light' ? 'bg-[#111315] border-[#262B33]' : 'bg-[#F5F6F8] border-[#E2E5EA]'
                )}>
                  <span className={clsx("text-2xl font-mono-num font-bold mb-0.5", isFrutigerAero ? "text-blue-900" : theme !== 'light' ? "text-[#F3F4F6]" : "text-[#111315]")}>
                    {totalDownloads}
                  </span>
                  <span className={clsx("text-[10px] uppercase tracking-wider font-semibold", isFrutigerAero ? "text-blue-800/60" : "text-[#6B7280]")}>
                    Downloads
                  </span>
                </div>
              </div>

              <button
                onClick={handleLogOut}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors w-full justify-center cursor-pointer",
                  isFrutigerAero ? "bg-red-500/20 text-red-600 hover:bg-red-500 hover:text-white border-red-500/30 backdrop-blur-sm" :
                  "bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500 hover:text-white"
                )}
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>

            {(userData?.role === 'developer' || userData?.role === 'admin') && (
              <RoleManager theme={theme} isFrutigerAero={isFrutigerAero} />
            )}
          </div>

          {/* My Projects Section */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className={clsx("text-base font-bold flex items-center gap-2", isFrutigerAero ? "text-blue-900" : theme !== 'light' ? "text-[#F3F4F6]" : "text-[#111315]")}>
                <Package className={clsx("w-4 h-4", isFrutigerAero ? "text-blue-500" : "text-[#10B981]")} />
                My Projects
              </h3>
              <button
                onClick={() => setCurrentView('my-apps')}
                className={clsx("text-xs font-semibold hover:underline flex items-center gap-1 cursor-pointer", isFrutigerAero ? "text-blue-600" : "text-[#10B981]")}
              >
                View All <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className={clsx("h-16 rounded-xl border", isFrutigerAero ? "bg-white/30 border-white/40" : theme !== 'light' ? 'bg-[#181B20] border-[#262B33]' : 'bg-white border-[#E2E5EA]')} />
                ))}
              </div>
            ) : myApps.length === 0 ? (
              <div className={clsx(
                "p-12 rounded-xl border border-dashed text-center text-sm",
                isFrutigerAero ? "border-blue-300/50 text-blue-800/60 bg-white/20" :
                theme !== 'light' ? 'border-[#262B33] text-[#6B7280] bg-[#181B20]/50' : 'border-[#E2E5EA] text-[#6B7280] bg-white'
              )}>
                <p>No projects published yet.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {myApps.slice(0, 10).map(app => (
                  <div
                    key={app.id}
                    className={clsx(
                      "p-4 rounded-xl border flex items-center justify-between group transition-colors",
                      isFrutigerAero ? "bg-white/40 border-white/50 backdrop-blur-md shadow-sm hover:bg-white/60" :
                      theme !== 'light' ? 'bg-[#181B20] border-[#262B33] hover:border-[#374151]' : 'bg-white border-[#E2E5EA] hover:bg-[#F5F6F8]'
                    )}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={clsx(
                        "w-10 h-10 rounded-lg border flex items-center justify-center font-bold shrink-0",
                        isFrutigerAero ? "bg-blue-500/20 text-blue-700 border-blue-500/30 shadow-inner" :
                        theme !== 'light' ? "bg-[#10B981]/10 border-[#10B981]/25 text-[#10B981]" : "bg-emerald-50 border-emerald-200 text-[#059669]"
                      )}>
                        {(app.title || 'A').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className={clsx("font-semibold text-sm truncate", isFrutigerAero ? "text-blue-900" : theme !== 'light' ? "text-[#F3F4F6]" : "text-[#111315]")}>
                          {app.title}
                        </h4>
                        <p className={clsx("text-xs font-mono-num", isFrutigerAero ? "text-blue-800/70" : "text-[#9CA3AF]")}>
                          {app.downloads || 0} downloads
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditingAppId(app.id);
                        setCurrentView('editor');
                      }}
                      title="Open in Editor"
                      className={clsx(
                        "p-2 rounded-lg border transition-colors cursor-pointer shrink-0",
                        isFrutigerAero ? "bg-white/50 text-blue-600 hover:bg-white border-white/60 shadow-sm" :
                        theme !== 'light' ? "bg-[#111315] border-[#262B33] text-[#9CA3AF] hover:text-[#F3F4F6] hover:border-[#374151]" : "bg-[#F5F6F8] border-[#E2E5EA] text-[#525866] hover:text-[#111315]"
                      )}
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
