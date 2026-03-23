import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { translations } from '../lib/translations';
import { clsx } from 'clsx';
import { ShieldCheck, CheckCircle, XCircle, Users, Coins, Search } from 'lucide-react';
import { collection, getDocs, doc, updateDoc, query, where, onSnapshot, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { AppData } from '../types';

export default function ControlView() {
  const theme = useStore(state => state.theme);
  const userData = useStore(state => state.userData);
  const language = useStore(state => state.language);
  const simulatedRole = useStore(state => state.simulatedRole);
  const setSimulatedRole = useStore(state => state.setSimulatedRole);
  const [apps, setApps] = useState<AppData[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'apps' | 'users' | 'assets' | 'roles'>('apps');
  const [search, setSearch] = useState('');
  const [localPermissions, setLocalPermissions] = useState<{ [userId: string]: any }>({});
  const [saving, setSaving] = useState<string | null>(null);
  const t = translations[language];

  const effectiveRole = (userData?.role === 'developer' && simulatedRole) ? simulatedRole : userData?.role;

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

    // Subscribe to assets
    const assetsUnsubscribe = onSnapshot(collection(db, 'assets'), (snapshot) => {
      const assetsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAssets(assetsData);
    }, (error) => {
      console.error("Error fetching assets", error);
    });

    return () => {
      appsUnsubscribe();
      usersUnsubscribe();
      assetsUnsubscribe();
    };
  }, []);

  const handleVerifyApp = async (appId: string, status: 'verified' | 'pending') => {
    try {
      await updateDoc(doc(db, 'apps', appId), { status });
    } catch (error) {
      console.error("Error verifying app", error);
    }
  };

  const handleVerifyAsset = async (assetId: string, status: 'verified' | 'pending') => {
    try {
      await updateDoc(doc(db, 'assets', assetId), { status });
    } catch (error) {
      console.error("Error verifying asset", error);
    }
  };

  const handleUpdateUserRole = async (userId: string, role: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role });
    } catch (error) {
      console.error("Error updating role", error);
    }
  };

  const handleUpdateUserPermissions = async (userId: string) => {
    const permissions = localPermissions[userId];
    if (!permissions) return;

    setSaving(userId);
    try {
      await updateDoc(doc(db, 'users', userId), { permissions });
      console.log(language === 'ru' ? "Изменения сохранены!" : "Changes saved!");
    } catch (error) {
      console.error("Error updating permissions", error);
    } finally {
      setSaving(null);
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

  if (!userData) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (userData.role !== 'developer' && effectiveRole !== 'admin' && effectiveRole !== 'moderator' && userData.email !== 'fufazada@gmail.com') {
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
        <h1 className="text-3xl font-bold tracking-tight mb-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-emerald-500" />
            Control Panel
            {simulatedRole && (
              <span className="text-xs px-2 py-1 bg-amber-500/20 text-amber-500 rounded-lg font-bold animate-pulse">
                {t.simulationActive}: {simulatedRole}
              </span>
            )}
          </div>
          
          {userData.role === 'developer' && (
            <div className="flex flex-wrap gap-2">
              {[
                { role: 'moderator', label: t.moderatorMode, color: 'bg-blue-500' },
                { role: 'admin', label: t.adminMode, color: 'bg-purple-500' },
                { role: 'user', label: t.userMode, color: 'bg-zinc-500' },
                { role: 'shopkeeper', label: t.shopkeeperMode, color: 'bg-orange-500' }
              ].map(mode => (
                <button
                  key={mode.role}
                  onClick={() => setSimulatedRole(simulatedRole === mode.role ? null : mode.role as any)}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    simulatedRole === mode.role ? mode.color + " text-white shadow-lg scale-105" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  )}
                >
                  {mode.label}
                </button>
              ))}
              {simulatedRole && (
                <button
                  onClick={() => setSimulatedRole(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  {t.developerMode}
                </button>
              )}
            </div>
          )}
        </h1>
        
        <div className="flex gap-4 mb-6 overflow-x-auto no-scrollbar pb-2">
          <button
            onClick={() => setActiveTab('apps')}
            className={clsx(
              "px-6 py-2 rounded-xl font-medium transition-colors whitespace-nowrap",
              activeTab === 'apps' ? 'bg-emerald-500 text-white' : theme !== 'light' ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
            )}
          >
            {t.appVerification || 'App Verification'}
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={clsx(
              "px-6 py-2 rounded-xl font-medium transition-colors whitespace-nowrap",
              activeTab === 'users' ? 'bg-emerald-500 text-white' : theme !== 'light' ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
            )}
          >
            {t.userManagement || 'User Management'}
          </button>
          {(effectiveRole === 'admin' || effectiveRole === 'developer') && (
            <button
              onClick={() => setActiveTab('assets')}
              className={clsx(
                "px-6 py-2 rounded-xl font-medium transition-colors whitespace-nowrap",
                activeTab === 'assets' ? 'bg-emerald-500 text-white' : theme !== 'light' ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
              )}
            >
              {t.assetStoreManagement || 'Asset Store Management'}
            </button>
          )}
          {effectiveRole === 'developer' && (
            <button
              onClick={() => setActiveTab('roles')}
              className={clsx(
                "px-6 py-2 rounded-xl font-medium transition-colors whitespace-nowrap",
                activeTab === 'roles' ? 'bg-emerald-500 text-white' : theme !== 'light' ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
              )}
            >
              {t.roleControl || 'Role Control'}
            </button>
          )}
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
        ) : activeTab === 'assets' ? (
          <div className="space-y-4">
            {assets.map(asset => (
              <div key={asset.id} className={clsx(
                "p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
                theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
              )}>
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    {asset.title}
                    {asset.status === 'verified' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                  </h3>
                  <p className="text-sm text-zinc-500">By {asset.authorName} • {asset.type}</p>
                </div>
                <div className="flex gap-2">
                  {asset.status !== 'verified' ? (
                    <button
                      onClick={() => handleVerifyAsset(asset.id, 'verified')}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      Verify Asset
                    </button>
                  ) : (
                    <button
                      onClick={() => handleVerifyAsset(asset.id, 'pending')}
                      className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      Revoke Verification
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'roles' ? (
          <div className="space-y-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search users..."
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
                  "p-6 rounded-2xl border flex flex-col gap-4",
                  theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <img src={u.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`} alt="" className="w-12 h-12 rounded-full bg-zinc-800" />
                      <div>
                        <h3 className="font-bold">{u.name}</h3>
                        <p className="text-sm text-zinc-500">{u.email}</p>
                        <span className="text-xs px-2 py-1 rounded-md bg-zinc-800 text-zinc-300 capitalize mt-1 inline-block">{u.role || 'user'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUpdateUserPermissions(u.id)}
                      disabled={saving === u.id || !localPermissions[u.id]}
                      className={clsx(
                        "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                        saving === u.id ? "bg-zinc-800 text-zinc-500" : 
                        !localPermissions[u.id] ? "bg-zinc-800/50 text-zinc-600 cursor-not-allowed" :
                        "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                      )}
                    >
                      {saving === u.id ? 'Saving...' : t.saveChanges}
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-4 border-t border-zinc-800/50">
                    {[
                      { key: 'accessAssetStore', label: 'Asset Store' },
                      { key: 'accessPremium', label: 'Premium' },
                      { key: 'accessControl', label: 'Control Panel' },
                      { key: 'sellInAssetStore', label: 'Sell Assets' },
                      { key: 'publishApps', label: 'Publish Apps' },
                      { key: 'premiumFeatures', label: 'Premium Features' },
                      { key: 'accessRecent', label: 'Recent Tab' }
                    ].map(perm => {
                      const isSelfDev = u.id === userData.uid && userData.role === 'developer' && perm.key === 'accessControl';
                      const currentVal = localPermissions[u.id]?.[perm.key] ?? u.permissions?.[perm.key] ?? true;
                      
                      return (
                        <label key={perm.key} className={clsx("flex items-center gap-2 cursor-pointer group", isSelfDev && "opacity-50 cursor-not-allowed")}>
                          <input
                            type="checkbox"
                            checked={currentVal}
                            disabled={isSelfDev}
                            onChange={(e) => {
                              const newPermissions = {
                                ...(localPermissions[u.id] || u.permissions || {
                                  accessAssetStore: true,
                                  accessPremium: true,
                                  accessControl: false,
                                  sellInAssetStore: true,
                                  publishApps: true,
                                  premiumFeatures: true,
                                  accessRecent: true
                                }),
                                [perm.key]: e.target.checked
                              };
                              setLocalPermissions(prev => ({ ...prev, [u.id]: newPermissions }));
                            }}
                            className="w-4 h-4 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500 bg-zinc-800"
                          />
                          <span className="text-xs font-medium group-hover:text-emerald-400 transition-colors">{perm.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
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
                      {effectiveRole !== 'admin' && effectiveRole !== 'moderator' && (
                        <>
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
                        </>
                      )}
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
