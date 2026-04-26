import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { translations } from '../lib/translations';
import { clsx } from 'clsx';
import { ShieldCheck, CheckCircle, XCircle, Users, Coins, Search } from 'lucide-react';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, onSnapshot, increment, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AppData } from '../types';
import { getDefaultAvatar } from '../lib/avatar';

export default function ControlView() {
  const theme = useStore(state => state.theme);
  const userData = useStore(state => state.userData);
  const language = useStore(state => state.language);
  const simulatedRole = useStore(state => state.simulatedRole);
  const setSimulatedRole = useStore(state => state.setSimulatedRole);
  const premiumCode = useStore(state => state.premiumCode);
  const setPremiumCode = useStore(state => state.setPremiumCode);
  const [apps, setApps] = useState<AppData[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [premiumCodes, setPremiumCodes] = useState<any[]>([]);
  const [adminRequests, setAdminRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'apps' | 'users' | 'assets' | 'roles' | 'premium' | 'requests'>('apps');
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

    // Subscribe to premium codes
    const codesUnsubscribe = onSnapshot(collection(db, 'premium_codes'), (snapshot) => {
      const codesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPremiumCodes(codesData);
    }, (error) => {
      console.error("Error fetching premium codes:", error);
    });
    
    // Subscribe to admin requests
    const requestsUnsubscribe = onSnapshot(collection(db, 'adminRequests'), (snapshot) => {
      const reqsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAdminRequests(reqsData);
    }, (error) => {
      console.error("Error fetching admin requests:", error);
    });

    return () => {
      appsUnsubscribe();
      usersUnsubscribe();
      assetsUnsubscribe();
      codesUnsubscribe();
      requestsUnsubscribe();
    };
  }, []);

  const createAdminRequest = async (type: string, targetId: string, targetName: string, reason: string = '') => {
    if (!userData) return;
    try {
      const reqId = `${userData.uid}_${Date.now()}`;
      await setDoc(doc(db, 'adminRequests', reqId), {
        id: reqId,
        type,
        targetId,
        targetName,
        requesterId: userData.uid,
        requesterName: userData.name || userData.email,
        reason,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      alert(language === 'ru' ? 'Запрос отправлен разработчику' : 'Request sent to developer');
    } catch (err) {
      console.error(err);
      alert('Error creating request');
    }
  };

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
    if (userData?.role !== 'developer') {
      alert(language === 'ru' ? "Только разработчик может менять роли!" : "Only developers can change roles!");
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId), { role });
    } catch (error) {
      console.error("Error updating role", error);
    }
  };

  const handleUpdateUserPermissions = async (userId: string) => {
    if (userData?.role !== 'developer') {
      alert(language === 'ru' ? "Только разработчик может менять права!" : "Only developers can change permissions!");
      return;
    }
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

  const handleGenerateCode = async () => {
    if (!userData?.uid) {
      alert(language === 'ru' ? "Ошибка: пользователь не авторизован" : "Error: User not authenticated");
      return;
    }

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const gen = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const newCode = `${gen()}-${gen()}-${gen()}`;
    
    try {
      // Add to premium_codes collection
      await setDoc(doc(db, 'premium_codes', newCode), {
        code: newCode,
        used: false,
        createdAt: new Date().toISOString(),
        createdBy: userData.uid
      });
      
      // Update local state to show the new code
      setPremiumCode(newCode);
      
      alert(language === 'ru' ? `Новый код сгенерирован: ${newCode}` : `New code generated: ${newCode}`);
    } catch (error) {
      console.error("Error generating premium code:", error);
      alert(language === 'ru' ? "Ошибка генерации кода. Проверьте права доступа." : "Error generating premium code. Check your permissions.");
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
          {effectiveRole === 'developer' && (
            <button
              onClick={() => setActiveTab('premium')}
              className={clsx(
                "px-6 py-2 rounded-xl font-medium transition-colors whitespace-nowrap",
                activeTab === 'premium' ? 'bg-emerald-500 text-white' : theme !== 'light' ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
              )}
            >
              {language === 'ru' ? 'Премиум коды' : 'Premium Codes'}
            </button>
          )}
          <button
            onClick={() => setActiveTab('requests')}
            className={clsx(
              "px-6 py-2 rounded-xl font-medium transition-colors whitespace-nowrap",
              activeTab === 'requests' ? 'bg-emerald-500 text-white' : theme !== 'light' ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
            )}
          >
            {language === 'ru' ? 'Отправленные запросы' : 'Sent Requests'}
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
                  {effectiveRole === 'developer' ? (
                    <>
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
                          className="px-4 py-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white rounded-xl text-sm font-medium transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (confirm('Delete this app?')) {
                            await deleteDoc(doc(db, 'apps', app.id));
                          }
                        }}
                        className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-sm font-medium transition-colors"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      {app.status !== 'verified' && (
                        <button
                          onClick={() => createAdminRequest('verify_app', app.id, app.title)}
                          className="px-4 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl text-sm font-medium transition-colors"
                        >
                          Request Verify
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const reason = prompt('Reason for deletion?');
                          if (reason !== null) {
                            createAdminRequest('delete_app', app.id, app.title, reason);
                          }
                        }}
                        className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-sm font-medium transition-colors"
                      >
                        Request Delete
                      </button>
                    </>
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
                  {effectiveRole === 'developer' ? (
                    <>
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
                          className="px-4 py-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white rounded-xl text-sm font-medium transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (confirm('Delete this asset?')) {
                            await deleteDoc(doc(db, 'assets', asset.id));
                          }
                        }}
                        className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-sm font-medium transition-colors"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                     <>
                      {asset.status !== 'verified' && (
                        <button
                          onClick={() => createAdminRequest('verify_asset', asset.id, asset.title)}
                          className="px-4 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl text-sm font-medium transition-colors"
                        >
                          Request Verify
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const reason = prompt('Reason for deletion?');
                          if (reason !== null) {
                            createAdminRequest('delete_asset', asset.id, asset.title, reason);
                          }
                        }}
                        className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-sm font-medium transition-colors"
                      >
                        Request Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'premium' ? (
          <div className="space-y-6">
            <div className={clsx(
              "p-8 rounded-3xl border",
              theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
            )}>
              <h2 className="text-xl font-bold mb-4">{language === 'ru' ? 'Генератор премиум кодов' : 'Premium Code Generator'}</h2>
              <p className="text-zinc-500 mb-6">
                {language === 'ru' ? 'Сгенерируйте код для активации премиума. Коды одноразовые.' : 'Generate a code for premium activation. Codes are one-time use.'}
              </p>
              
              <div className="flex flex-col gap-4">
                <div className={clsx(
                  "p-4 rounded-xl border font-mono text-center text-2xl tracking-widest",
                  theme !== 'light' ? 'bg-zinc-950 border-zinc-800 text-emerald-400' : 'bg-zinc-50 border-zinc-200 text-emerald-600'
                )}>
                  {premiumCode || 'XXXX-XXXX-XXXX'}
                </div>
                
                <button
                  onClick={handleGenerateCode}
                  className="w-full py-3 px-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
                >
                  {language === 'ru' ? 'Сгенерировать новый код' : 'Generate New Code'}
                </button>
                
                {premiumCode && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(premiumCode);
                      alert(language === 'ru' ? 'Код скопирован!' : 'Code copied!');
                    }}
                    className="w-full py-3 px-6 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
                  >
                    {language === 'ru' ? 'Копировать код' : 'Copy Code'}
                  </button>
                )}
              </div>
            </div>

            <div className={clsx(
              "p-8 rounded-3xl border",
              theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
            )}>
              <h2 className="text-xl font-bold mb-4">{language === 'ru' ? 'Список кодов' : 'Codes List'}</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {premiumCodes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(c => (
                  <div key={c.id} className={clsx(
                    "p-4 rounded-xl border flex items-center justify-between",
                    theme !== 'light' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                  )}>
                    <div className="flex flex-col">
                      <span className="font-mono font-bold">{c.code}</span>
                      <span className="text-[10px] opacity-50">{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {c.used ? (
                        <span className="text-xs px-2 py-1 bg-red-500/10 text-red-500 rounded-lg font-bold">
                          {language === 'ru' ? 'Использован' : 'Used'}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg font-bold">
                          {language === 'ru' ? 'Активен' : 'Active'}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(c.code);
                          alert(language === 'ru' ? 'Код скопирован!' : 'Code copied!');
                        }}
                        className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
                      <img src={u.photoUrl || getDefaultAvatar(u.id)} alt="" className="w-12 h-12 rounded-full bg-zinc-800" />
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
                      const DEFAULT_PERMISSIONS = {
                        accessAssetStore: true,
                        accessPremium: true,
                        accessControl: false,
                        sellInAssetStore: true,
                        publishApps: true,
                        premiumFeatures: true,
                        accessRecent: true
                      };
                      const isSelfDev = u.id === userData.uid && userData.role === 'developer' && perm.key === 'accessControl';
                      const isDisabled = isSelfDev || userData.role !== 'developer';
                      const currentVal = localPermissions[u.id]?.[perm.key as keyof typeof DEFAULT_PERMISSIONS] ?? u.permissions?.[perm.key as keyof typeof DEFAULT_PERMISSIONS] ?? DEFAULT_PERMISSIONS[perm.key as keyof typeof DEFAULT_PERMISSIONS];
                      
                      return (
                        <label key={perm.key} className={clsx("flex items-center gap-2 cursor-pointer group", isDisabled && "opacity-50 cursor-not-allowed")}>
                          <input
                            type="checkbox"
                            checked={currentVal}
                            disabled={isDisabled}
                            onChange={(e) => {
                              const existingPermissions = localPermissions[u.id] || u.permissions || DEFAULT_PERMISSIONS;
                              const newPermissions = {
                                ...existingPermissions,
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
        ) : activeTab === 'requests' ? (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">{language === 'ru' ? 'Отправленные запросы' : 'Sent Requests'}</h2>
            <div className="grid grid-cols-1 gap-4">
              {adminRequests.map(req => {
                // If not developer, only show own requests
                if (effectiveRole !== 'developer' && req.requesterId !== userData?.uid) return null;
                
                return (
                  <div key={req.id} className={clsx(
                    "p-6 rounded-2xl border flex flex-col sm:flex-row items-start justify-between gap-4",
                    theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
                  )}>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={clsx("px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider", 
                          req.type.includes('delete') || req.type.includes('ban') ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'
                        )}>
                          {req.type.replace('_', ' ')}
                        </span>
                        <span className={clsx("px-2 py-1 rounded-md text-xs font-bold capitalize",
                          req.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                          req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-500/10 text-zinc-500'
                        )}>
                          {req.status}
                        </span>
                      </div>
                      <h3 className="font-bold text-lg">{req.targetName}</h3>
                      <p className="text-sm text-zinc-500">
                        {language === 'ru' ? 'Отправитель:' : 'Requester:'} {req.requesterName}
                      </p>
                      {req.reason && (
                        <p className="text-sm text-zinc-400 mt-2 p-3 bg-black/10 rounded-lg italic">
                          "{req.reason}"
                        </p>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-2 min-w-[140px]">
                      {effectiveRole === 'developer' && req.status === 'pending' && (
                        <>
                          <button
                            onClick={async () => {
                              try {
                                if (req.type === 'verify_app') await updateDoc(doc(db, 'apps', req.targetId), { status: 'verified' });
                                if (req.type === 'verify_asset') await updateDoc(doc(db, 'assets', req.targetId), { status: 'verified' });
                                if (req.type === 'delete_app') await deleteDoc(doc(db, 'apps', req.targetId));
                                if (req.type === 'delete_asset') await deleteDoc(doc(db, 'assets', req.targetId));
                                if (req.type === 'ban_user') await updateDoc(doc(db, 'users', req.targetId), { isBanned: true, banReason: req.reason });
                                await updateDoc(doc(db, 'adminRequests', req.id), { status: 'approved' });
                              } catch(e) { console.error('Approve err', e); }
                            }}
                            className="w-full px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={async () => {
                              await updateDoc(doc(db, 'adminRequests', req.id), { status: 'rejected' });
                            }}
                            className="w-full px-4 py-2 bg-red-500/10 text-red-500 rounded-xl text-sm font-medium hover:bg-red-500 hover:text-white transition-colors"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      
                      {(effectiveRole === 'developer' || req.requesterId === userData?.uid) && (
                        <>
                          {req.requesterId === userData?.uid && req.status === 'pending' && (
                            <button
                              onClick={async () => {
                                const newReason = prompt('New format/reason:', req.reason);
                                if (newReason !== null) {
                                  await updateDoc(doc(db, 'adminRequests', req.id), { reason: newReason, updatedAt: new Date().toISOString() });
                                }
                              }}
                              className="w-full px-4 py-2 bg-blue-500/10 text-blue-500 rounded-xl text-sm font-medium hover:bg-blue-500 hover:text-white transition-colors"
                            >
                              Edit Reason
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              if (confirm('Delete this request?')) {
                                await deleteDoc(doc(db, 'adminRequests', req.id));
                              }
                            }}
                            className="w-full px-4 py-2 bg-zinc-800 text-zinc-400 rounded-xl text-sm font-medium hover:bg-red-500 hover:text-white transition-colors"
                          >
                            Delete Request
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {adminRequests.length === 0 && (
                <div className="p-8 text-center text-zinc-500">
                  {language === 'ru' ? 'Запросов нет' : 'No requests found'}
                </div>
              )}
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
                    <img src={u.photoUrl || getDefaultAvatar(u.id)} alt="" className="w-12 h-12 rounded-full bg-zinc-800" />
                    <div>
                      <h3 className="font-bold flex items-center gap-2">
                        {u.name}
                        {u.isBanned && <span className="px-2 py-0.5 bg-red-500 rounded text-white text-[10px] uppercase font-bold tracking-wider">BANNED</span>}
                      </h3>
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
                    {userData?.role === 'developer' ? (
                      <select
                        value={u.role || 'user'}
                        onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                        className={clsx(
                          "px-3 py-2 rounded-xl text-sm border focus:outline-none",
                          theme !== 'light' ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-100 border-zinc-200 text-zinc-900'
                        )}
                      >
                        <option value="user">User</option>
                        <option value="moderator">Moderator</option>
                        <option value="admin">Admin</option>
                        <option value="shopkeeper">Shopkeeper</option>
                        <option value="developer">Developer</option>
                      </select>
                    ) : (
                      <div className={clsx(
                        "px-3 py-2 rounded-xl text-sm border",
                        theme !== 'light' ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-zinc-100 border-zinc-200 text-zinc-500'
                      )}>
                        {u.role || 'user'}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        if (userData?.role !== 'developer') return alert(language === 'ru' ? "Только разработчик может верифицировать авторов!" : "Only developers can verify authors!");
                        updateDoc(doc(db, 'users', u.id), { isVerifiedAuthor: !u.isVerifiedAuthor }).catch(console.error);
                      }}
                      className={clsx(
                        "px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                        u.isVerifiedAuthor ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      )}
                    >
                      {u.isVerifiedAuthor ? 'Verified Author' : 'Verify Author'}
                    </button>
                    {effectiveRole === 'developer' ? (
                      <button
                        onClick={async () => {
                          if (u.isBanned) {
                            if (confirm('Unban this user?')) await updateDoc(doc(db, 'users', u.id), { isBanned: false, banReason: null });
                          } else {
                            const reason = prompt('Ban Reason:');
                            if (reason !== null) await updateDoc(doc(db, 'users', u.id), { isBanned: true, banReason: reason });
                          }
                        }}
                        className={clsx(
                          "px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                          u.isBanned ? "bg-red-500 text-white hover:bg-red-600" : "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
                        )}
                      >
                        {u.isBanned ? 'Unban' : 'Ban User'}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (u.isBanned) return alert('Already banned');
                          const reason = prompt('Ban Reason?');
                          if (reason !== null) createAdminRequest('ban_user', u.id, u.name || u.email || 'Unknown', reason);
                        }}
                        className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-sm font-medium transition-colors"
                      >
                        Request Ban
                      </button>
                    )}
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
