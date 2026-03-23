import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { clsx } from 'clsx';
import { ShieldCheck, CheckCircle, XCircle, Users, Coins, Search } from 'lucide-react';
import { collection, getDocs, doc, updateDoc, query, where, onSnapshot, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { AppData } from '../types';

export default function ControlView() {
  const theme = useStore(state => state.theme);
  const userData = useStore(state => state.userData);
  const [apps, setApps] = useState<AppData[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'apps' | 'users'>('apps');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    
    // Subscribe to apps
    const appsUnsubscribe = onSnapshot(collection(db, 'apps'), (snapshot) => {
      const appsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppData));
      setApps(appsData.filter(app => !app.isPrivate));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching apps", error);
      setLoading(false);
    });

    // Subscribe to users
    const usersUnsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
    }, (error) => {
      console.error("Error fetching users", error);
    });

    return () => {
      appsUnsubscribe();
      usersUnsubscribe();
    };
  }, []);

  const handleVerifyApp = async (appId: string, status: 'verified' | 'pending') => {
    try {
      await updateDoc(doc(db, 'apps', appId), { status });
    } catch (error) {
      console.error("Error verifying app", error);
    }
  };

  const handleUpdateUserRole = async (userId: string, role: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role });
    } catch (error) {
      console.error("Error updating role", error);
    }
  };

  const handleGiveCoins = async (userId: string, amount: number) => {
    try {
      await updateDoc(doc(db, 'users', userId), { 
        eplCoins: increment(amount) 
      });
    } catch (error) {
      console.error("Error giving coins", error);
    }
  };

  if (userData?.role !== 'developer' && userData?.role !== 'admin') {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center">
        <ShieldCheck className="w-16 h-16 text-red-500 mb-4 opacity-50" />
        <h2 className="text-2xl font-bold mb-2 text-red-500">Access Denied</h2>
        <p className="text-zinc-500">You do not have permission to view this page.</p>
      </div>
    );
  }

  const filteredUsers = users.filter(u => u.email?.toLowerCase().includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="h-full flex flex-col p-4 sm:p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full">
        <h1 className="text-3xl font-bold tracking-tight mb-8 flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-emerald-500" />
          Control Panel
        </h1>
        
        <div className="flex gap-4 mb-6 overflow-x-auto no-scrollbar pb-2">
          <button
            onClick={() => setActiveTab('apps')}
            className={clsx(
              "px-6 py-2 rounded-xl font-medium transition-colors whitespace-nowrap",
              activeTab === 'apps' ? 'bg-emerald-500 text-white' : theme !== 'light' ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
            )}
          >
            App Verification
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={clsx(
              "px-6 py-2 rounded-xl font-medium transition-colors whitespace-nowrap",
              activeTab === 'users' ? 'bg-emerald-500 text-white' : theme !== 'light' ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
            )}
          >
            User Management
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : activeTab === 'apps' ? (
          <div className="space-y-4">
            {apps.map(app => (
              <div key={app.id} className={clsx(
                "p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
                theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
              )}>
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    {app.title}
                    {app.status === 'verified' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                  </h3>
                  <p className="text-sm text-zinc-500">By {app.authorName} • {app.category}</p>
                </div>
                <div className="flex gap-2">
                  {app.status !== 'verified' ? (
                    <button
                      onClick={() => handleVerifyApp(app.id, 'verified')}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      Verify App
                    </button>
                  ) : (
                    <button
                      onClick={() => handleVerifyApp(app.id, 'pending')}
                      className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      Revoke Verification
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search users by email or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={clsx(
                  "w-full pl-10 pr-4 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500",
                  theme !== 'light' ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-4">
              {filteredUsers.map(u => (
                <div key={u.id} className={clsx(
                  "p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
                  theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
                )}>
                  <div className="flex items-center gap-4">
                    <img src={u.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`} alt="" className="w-12 h-12 rounded-full bg-zinc-800" />
                    <div>
                      <h3 className="font-bold">{u.name}</h3>
                      <p className="text-sm text-zinc-500">{u.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-1 rounded-md bg-zinc-800 text-zinc-300 capitalize">{u.role || 'user'}</span>
                        <span className="text-xs px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 font-bold flex items-center gap-1">
                          <Coins className="w-3 h-3" /> {u.eplCoins || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={u.role || 'user'}
                      onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                      className={clsx(
                        "px-3 py-2 rounded-xl text-sm border focus:outline-none",
                        theme !== 'light' ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-100 border-zinc-200 text-zinc-900'
                      )}
                      disabled={userData?.role !== 'developer' && u.role === 'developer'}
                    >
                      <option value="user">User</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                      <option value="shopkeeper">Shopkeeper</option>
                      {userData?.role === 'developer' && <option value="developer">Developer</option>}
                    </select>
                    <button
                      onClick={() => {
                        updateDoc(doc(db, 'users', u.id), { isVerifiedAuthor: !u.isVerifiedAuthor }).catch(console.error);
                      }}
                      className={clsx(
                        "px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                        u.isVerifiedAuthor ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      )}
                    >
                      {u.isVerifiedAuthor ? 'Verified Author' : 'Verify Author'}
                    </button>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Amount"
                        defaultValue={100}
                        id={`coins-${u.id}`}
                        className={clsx(
                          "w-20 px-2 py-2 rounded-xl text-sm border focus:outline-none",
                          theme !== 'light' ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-100 border-zinc-200 text-zinc-900'
                        )}
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById(`coins-${u.id}`) as HTMLInputElement;
                          const amt = parseInt(input.value) || 0;
                          handleGiveCoins(u.id, amt);
                        }}
                        className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-1"
                      >
                        Give Coins
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
