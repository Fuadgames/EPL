import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { translations } from '../lib/translations';
import { clsx } from 'clsx';
<<<<<<< HEAD
import { ShieldCheck, CheckCircle, XCircle, Users, Coins, Search, Ban, AlertCircle, X, Trash2, Sparkles, Eye, RefreshCw, Check, FileCode, ShieldAlert, BadgeCheck } from 'lucide-react';
=======
import { ShieldCheck, CheckCircle, XCircle, Users, Coins, Search } from 'lucide-react';
>>>>>>> 76052c4025bd6f96aed23817f0502844c437bf0d
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, onSnapshot, increment, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { db } from '../firebase';
import { AppData } from '../types';
import { getDefaultAvatar } from '../lib/avatar';
<<<<<<< HEAD
import UserRoleBadge from './UserRoleBadge';
import VerifiedBadge from './VerifiedBadge';

export default function ControlView() {
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
=======

export default function ControlView() {
  const theme = useStore(state => state.theme);
>>>>>>> 76052c4025bd6f96aed23817f0502844c437bf0d
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
<<<<<<< HEAD
  const user = useStore(state => state.user);
  const actualRole = (user?.email === 'fufazada@gmail.com') ? 'developer' : userData?.role;
  const effectiveRole = (actualRole === 'developer' && simulatedRole) ? simulatedRole : actualRole;
  const isDeveloper = (actualRole === 'developer' || effectiveRole === 'developer');

  const [activeTab, setActiveTab] = useState<'apps' | 'users' | 'assets' | 'roles' | 'premium' | 'requests' | 'moderation'>(isDeveloper ? 'moderation' : 'apps');
  const [search, setSearch] = useState('');
  const [localPermissions, setLocalPermissions] = useState<{ [userId: string]: any }>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Moderation state
  const [moderationLogs, setModerationLogs] = useState<any[]>([]);
  const [moderationFilter, setModerationFilter] = useState<'all' | 'approved' | 'rejected' | 'pending'>('all');
  const [viewingCodeApp, setViewingCodeApp] = useState<{ title: string; code: string; authorName: string } | null>(null);
  const [manualRejectApp, setManualRejectApp] = useState<AppData | null>(null);
  const [manualRejectReasonInput, setManualRejectReasonInput] = useState('');
  const [isRescanning, setIsRescanning] = useState<string | null>(null);

  // Ban management modal states
  const [banModalUser, setBanModalUser] = useState<any | null>(null);
  const [banReasonInput, setBanReasonInput] = useState('');
  const [unbanModalUser, setUnbanModalUser] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3500);
  };
  const t = translations[language];

  useEffect(() => {
    if (activeTab === 'moderation' && !isDeveloper) {
      setActiveTab('apps');
    }
  }, [activeTab, isDeveloper]);
=======
  const [activeTab, setActiveTab] = useState<'apps' | 'users' | 'assets' | 'roles' | 'premium' | 'requests'>('apps');
  const [search, setSearch] = useState('');
  const [localPermissions, setLocalPermissions] = useState<{ [userId: string]: any }>({});
  const [saving, setSaving] = useState<string | null>(null);
  const t = translations[language];

  const user = useStore(state => state.user);
  const actualRole = (user?.email === 'fufazada@gmail.com') ? 'developer' : userData?.role;
  const effectiveRole = (actualRole === 'developer' && simulatedRole) ? simulatedRole : actualRole;
>>>>>>> 76052c4025bd6f96aed23817f0502844c437bf0d

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

<<<<<<< HEAD
    // Fetch initial moderation logs
    const fetchLogs = async () => {
      try {
        const res = await fetch('/api/admin/moderation-logs');
        if (res.ok) {
          const data = await res.json();
          setModerationLogs(data.logs || []);
        }
      } catch (e) {}
    };
    fetchLogs();

=======
>>>>>>> 76052c4025bd6f96aed23817f0502844c437bf0d
    return () => {
      appsUnsubscribe();
      usersUnsubscribe();
      assetsUnsubscribe();
      codesUnsubscribe();
      requestsUnsubscribe();
    };
  }, []);

<<<<<<< HEAD
  const handleManualApprove = async (appId: string, appTitle: string) => {
    try {
      const res = await fetch('/api/admin/manual-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId,
          appTitle,
          action: 'approve',
          reason: language === 'ru' ? 'Одобрено модератором вручную' : 'Approved by staff manually',
          reviewerName: userData?.name || 'Staff'
        })
      });
      if (!res.ok) throw new Error('Failed to approve');

      setApps(prev => prev.map(a => a.id === appId ? { ...a, status: 'verified', moderationStatus: 'approved' } : a));
      showToast(language === 'ru' ? `Проект "${appTitle}" одобрен вручную и опубликован!` : `Project "${appTitle}" approved and published!`, 'success');
      
      fetch('/api/admin/moderation-logs').then(r => r.json()).then(d => setModerationLogs(d.logs || [])).catch(() => {});
    } catch (err: any) {
      showToast(err.message || 'Error', 'error');
    }
  };

  const handleManualReject = async () => {
    if (!manualRejectApp) return;
    const reason = manualRejectReasonInput.trim() || (language === 'ru' ? 'Отклонено модератором: нарушение правил платформы' : 'Rejected by staff: rules violation');
    try {
      const res = await fetch('/api/admin/manual-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: manualRejectApp.id,
          appTitle: manualRejectApp.title,
          action: 'reject',
          reason,
          reviewerName: userData?.name || 'Staff'
        })
      });
      if (!res.ok) throw new Error('Failed to reject');

      setApps(prev => prev.map(a => a.id === manualRejectApp.id ? { ...a, status: 'rejected', moderationStatus: 'rejected', moderationReason: reason } : a));
      showToast(language === 'ru' ? `Проект "${manualRejectApp.title}" отклонен` : `Project "${manualRejectApp.title}" rejected`, 'success');

      fetch('/api/admin/moderation-logs').then(r => r.json()).then(d => setModerationLogs(d.logs || [])).catch(() => {});
    } catch (err: any) {
      showToast(err.message || 'Error', 'error');
    } finally {
      setManualRejectApp(null);
      setManualRejectReasonInput('');
    }
  };

  const handleRescanWithAi = async (app: AppData) => {
    setIsRescanning(app.id);
    showToast(language === 'ru' ? 'ИИ (NVIDIA Nemotron 3.5) проверяет проект...' : 'AI (NVIDIA Nemotron 3.5) checking project...', 'success');
    try {
      const res = await fetch('/api/ai/moderate-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: app.title,
          description: app.description,
          code: app.code,
          authorName: app.authorName
        })
      });

      const modResult = await res.json();
      if (!res.ok) throw new Error(modResult.error || 'AI check failed');

      await fetch('/api/admin/manual-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: app.id,
          appTitle: app.title,
          action: modResult.approved ? 'approve' : 'reject',
          reason: modResult.reason,
          reviewerName: 'nvidia/nemotron-3.5-super-vl:free'
        })
      });

      setApps(prev => prev.map(a => a.id === app.id ? {
        ...a,
        status: modResult.approved ? 'verified' : 'rejected',
        moderationStatus: modResult.approved ? 'approved' : 'rejected',
        moderationReason: modResult.reason
      } : a));

      showToast(
        modResult.approved 
          ? (language === 'ru' ? 'ИИ одобрил проект!' : 'AI approved project!')
          : (language === 'ru' ? `ИИ отклонил: ${modResult.reason}` : `AI rejected: ${modResult.reason}`),
        modResult.approved ? 'success' : 'error'
      );

      fetch('/api/admin/moderation-logs').then(r => r.json()).then(d => setModerationLogs(d.logs || [])).catch(() => {});
    } catch (err: any) {
      showToast(err.message || 'Error re-scanning with AI', 'error');
    } finally {
      setIsRescanning(null);
    }
  };

=======
>>>>>>> 76052c4025bd6f96aed23817f0502844c437bf0d
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
      alert(language === 'ru' ? 'Статус приложения обновлен' : 'App status updated');
    } catch (error: any) {
      alert(error.message);
      handleFirestoreError(error, OperationType.UPDATE, `apps/${appId}`);
    }
  };

  const handleVerifyAsset = async (assetId: string, status: 'verified' | 'pending') => {
    try {
      await updateDoc(doc(db, 'assets', assetId), { status });
      alert(language === 'ru' ? 'Статус ассета обновлен' : 'Asset status updated');
    } catch (error: any) {
      alert(error.message);
      handleFirestoreError(error, OperationType.UPDATE, `assets/${assetId}`);
    }
  };

  const handleUpdateUserRole = async (userId: string, role: string) => {
    if (actualRole !== 'developer' && actualRole !== 'admin') {
<<<<<<< HEAD
      showToast(language === 'ru' ? "Недостаточно прав!" : "Insufficient permissions!", 'error');
=======
      alert(language === 'ru' ? "Недостаточно прав!" : "Insufficient permissions!");
>>>>>>> 76052c4025bd6f96aed23817f0502844c437bf0d
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId), { role });
<<<<<<< HEAD
      showToast(language === 'ru' ? 'Роль пользователя обновлена' : 'User role updated', 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
=======
      alert(language === 'ru' ? 'Роль пользователя обновлена' : 'User role updated');
    } catch (error: any) {
      alert(error.message);
>>>>>>> 76052c4025bd6f96aed23817f0502844c437bf0d
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

<<<<<<< HEAD
  const handleDeleteApp = async (appId: string, appTitle: string) => {
    if (!confirm(language === 'ru' ? `Удалить проект "${appTitle}" навсегда?` : `Permanently delete app "${appTitle}"?`)) return;
    try {
      // 1. Call server admin API
      await fetch('/api/admin/delete-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId })
      });

      // 2. Client fallback
      try {
        await deleteDoc(doc(db, 'apps', appId));
      } catch (e) {}

      // 3. Delete any associated requests
      try {
        const reqsRef = collection(db, 'adminRequests');
        const q = query(reqsRef, where('targetId', '==', appId));
        const qSnap = await getDocs(q);
        await Promise.all(qSnap.docs.map(d => deleteDoc(d.ref)));
      } catch (e) {}

      // 4. Update state directly
      setApps(prev => prev.filter(a => a.id !== appId));
      showToast(language === 'ru' ? `Проект "${appTitle}" удален` : `App "${appTitle}" deleted`, 'success');
    } catch (err: any) {
      console.error('Delete app error:', err);
      showToast(err.message || 'Error deleting app', 'error');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(language === 'ru' ? `Удалить аккаунт "${userName}" навсегда?` : `Permanently delete account "${userName}"?`)) return;
    try {
      await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      try {
        await deleteDoc(doc(db, 'users', userId));
        await deleteDoc(doc(db, 'users_public', userId));
      } catch (e) {}

      setUsers(prev => prev.filter(u => u.id !== userId));
      showToast(language === 'ru' ? `Пользователь "${userName}" удален` : `User "${userName}" deleted`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error deleting user', 'error');
    }
  };

  const handleExecuteBan = async () => {
    if (!banModalUser) return;
    const reason = banReasonInput.trim() || (language === 'ru' ? 'Нарушение правил сообщества' : 'Violation of community terms');
    try {
      // 1. Server ban API
      await fetch('/api/admin/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: banModalUser.id, isBanned: true, reason })
      });

      // 2. Client fallback
      try {
        await setDoc(doc(db, 'users', banModalUser.id), { isBanned: true, banReason: reason }, { merge: true });
        await setDoc(doc(db, 'users_public', banModalUser.id), { isBanned: true, banReason: reason }, { merge: true });
      } catch (e) {}

      // 3. Update local state
      setUsers(prev => prev.map(u => u.id === banModalUser.id ? { ...u, isBanned: true, banReason: reason } : u));
      showToast(language === 'ru' ? `Пользователь ${banModalUser.name || 'User'} заблокирован` : `User ${banModalUser.name || 'User'} has been banned`, 'success');
    } catch (e: any) {
      console.error('Ban error:', e);
      showToast(language === 'ru' ? 'Ошибка при блокировке пользователя' : 'Error banning user', 'error');
    } finally {
      setBanModalUser(null);
      setBanReasonInput('');
    }
  };

  const handleExecuteUnban = async () => {
    if (!unbanModalUser) return;
    try {
      // 1. Server ban API
      await fetch('/api/admin/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: unbanModalUser.id, isBanned: false, reason: null })
      });

      // 2. Client fallback
      try {
        await setDoc(doc(db, 'users', unbanModalUser.id), { isBanned: false, banReason: null }, { merge: true });
        await setDoc(doc(db, 'users_public', unbanModalUser.id), { isBanned: false, banReason: null }, { merge: true });
      } catch (e) {}

      // 3. Update local state
      setUsers(prev => prev.map(u => u.id === unbanModalUser.id ? { ...u, isBanned: false, banReason: null } : u));
      showToast(language === 'ru' ? `Пользователь ${unbanModalUser.name || 'User'} разблокирован` : `User ${unbanModalUser.name || 'User'} has been unbanned`, 'success');
    } catch (e: any) {
      console.error('Unban error:', e);
      showToast(language === 'ru' ? 'Ошибка при разблокировке пользователя' : 'Error unbanning user', 'error');
    } finally {
      setUnbanModalUser(null);
    }
  };

  const handleUpdateUserPermissions = async (userId: string) => {
    if (actualRole !== 'developer' && actualRole !== 'admin') {
      showToast(language === 'ru' ? "Недостаточно прав!" : "Insufficient permissions!", 'error');
=======
  const handleUpdateUserPermissions = async (userId: string) => {
    if (actualRole !== 'developer' && actualRole !== 'admin') {
      alert(language === 'ru' ? "Недостаточно прав!" : "Insufficient permissions!");
>>>>>>> 76052c4025bd6f96aed23817f0502844c437bf0d
      return;
    }
    const permissions = localPermissions[userId];
    if (!permissions) return;

    setSaving(userId);
    try {
      await updateDoc(doc(db, 'users', userId), { permissions });
<<<<<<< HEAD
      showToast(language === 'ru' ? "Изменения сохранены!" : "Changes saved!", 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
=======
      alert(language === 'ru' ? "Изменения сохранены!" : "Changes saved!");
    } catch (error: any) {
      alert(error.message);
>>>>>>> 76052c4025bd6f96aed23817f0502844c437bf0d
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    } finally {
      setSaving(null);
    }
  };

  const handleGiveCoins = async (userId: string, amount: number) => {
    try {
      await updateDoc(doc(db, 'users', userId), { 
        eplCoins: increment(amount) 
      });
      alert(language === 'ru' ? `Монеты выданы: ${amount}` : `Coins given: ${amount}`);
    } catch (error: any) {
      alert(error.message);
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
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
    return <div className="h-full flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>;
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
<<<<<<< HEAD
          {isDeveloper && (
            <button
              onClick={() => setActiveTab('moderation')}
              className={clsx(
                "px-5 py-2 rounded-xl font-medium transition-colors whitespace-nowrap flex items-center gap-2",
                activeTab === 'moderation' 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' 
                  : theme !== 'light' ? 'bg-zinc-800 text-zinc-400 hover:text-white' : 'bg-zinc-200 text-zinc-600 hover:text-zinc-900'
              )}
            >
              <Sparkles className="w-4 h-4 text-purple-300" />
              {language === 'ru' ? 'Модерация ИИ (Nemotron 3.5)' : 'AI Moderation (Nemotron 3.5)'}
              {apps.filter(a => a.moderationStatus === 'rejected' || a.status === 'rejected').length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white">
                  {apps.filter(a => a.moderationStatus === 'rejected' || a.status === 'rejected').length}
                </span>
              )}
            </button>
          )}
=======
>>>>>>> 76052c4025bd6f96aed23817f0502844c437bf0d
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
          {(effectiveRole === 'developer' || effectiveRole === 'admin') && (
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
          {(effectiveRole === 'developer' || effectiveRole === 'admin') && (
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
<<<<<<< HEAD
        ) : activeTab === 'moderation' ? (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className={clsx(
              "p-6 rounded-3xl border relative overflow-hidden",
              theme !== 'light' ? 'bg-purple-950/20 border-purple-800/40 text-purple-100' : 'bg-purple-50 border-purple-200 text-purple-900'
            )}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      <Sparkles className="w-5 h-5" />
                    </span>
                    <h2 className="text-xl font-bold">
                      {language === 'ru' ? 'ИИ Модерация проектов (NVIDIA Nemotron 3.5 Super VL)' : 'AI Project Moderation (NVIDIA Nemotron 3.5 Super VL)'}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      OpenRouter API Active
                    </span>
                  </div>
                  <p className="text-sm opacity-80 max-w-2xl">
                    {language === 'ru' 
                      ? 'Каждая опубликованная игра или приложение автоматически анализируется нейросетью на 18+ контент, ненормативную лексику, вредоносный код и попытки взлома (hack/hacked/exploits). Администраторы могут просматривать исходный код, вручную одобрять или отклонять проекты.'
                      : 'Every published project is automatically scanned for adult content, profanity, exploit attempts, and malicious loops. Staff can inspect code and manually approve or reject.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      fetch('/api/admin/moderation-logs')
                        .then(r => r.json())
                        .then(d => {
                          setModerationLogs(d.logs || []);
                          showToast(language === 'ru' ? 'Логи обновлены' : 'Logs refreshed');
                        })
                        .catch(() => {});
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-semibold transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {language === 'ru' ? 'Обновить данные' : 'Refresh Data'}
                  </button>
                </div>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                <div className={clsx("p-4 rounded-2xl border", theme !== 'light' ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200')}>
                  <div className="text-xs text-zinc-400 font-medium">{language === 'ru' ? 'Всего проектов' : 'Total Projects'}</div>
                  <div className="text-2xl font-bold mt-1 text-zinc-100">{apps.length}</div>
                </div>
                <div className={clsx("p-4 rounded-2xl border", theme !== 'light' ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-emerald-50 border-emerald-200')}>
                  <div className="text-xs text-emerald-400 font-medium">{language === 'ru' ? 'Одобрено ИИ' : 'Approved by AI'}</div>
                  <div className="text-2xl font-bold mt-1 text-emerald-400">
                    {apps.filter(a => a.moderationStatus === 'approved' || a.status === 'verified').length}
                  </div>
                </div>
                <div className={clsx("p-4 rounded-2xl border", theme !== 'light' ? 'bg-red-950/20 border-red-800/40' : 'bg-red-50 border-red-200')}>
                  <div className="text-xs text-red-400 font-medium">{language === 'ru' ? 'Заблокировано ИИ' : 'Blocked by AI'}</div>
                  <div className="text-2xl font-bold mt-1 text-red-400">
                    {apps.filter(a => a.moderationStatus === 'rejected' || a.status === 'rejected').length}
                  </div>
                </div>
                <div className={clsx("p-4 rounded-2xl border", theme !== 'light' ? 'bg-amber-950/20 border-amber-800/40' : 'bg-amber-50 border-amber-200')}>
                  <div className="text-xs text-amber-400 font-medium">{language === 'ru' ? 'На проверке' : 'Pending Review'}</div>
                  <div className="text-2xl font-bold mt-1 text-amber-400">
                    {apps.filter(a => a.moderationStatus === 'pending' || a.status === 'pending').length}
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 border-b border-zinc-800/60 pb-3">
              {[
                { key: 'all', label: language === 'ru' ? 'Все проекты' : 'All Projects', count: apps.length },
                { key: 'rejected', label: language === 'ru' ? 'Заблокированные / Отклоненные' : 'Blocked / Rejected', count: apps.filter(a => a.moderationStatus === 'rejected' || a.status === 'rejected').length },
                { key: 'approved', label: language === 'ru' ? 'Одобренные' : 'Approved', count: apps.filter(a => a.moderationStatus === 'approved' || a.status === 'verified').length },
                { key: 'pending', label: language === 'ru' ? 'Ожидают' : 'Pending', count: apps.filter(a => a.moderationStatus === 'pending' || a.status === 'pending').length }
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setModerationFilter(f.key as any)}
                  className={clsx(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer",
                    moderationFilter === f.key
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                      : "bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 border border-zinc-700/40"
                  )}
                >
                  {f.label}
                  <span className={clsx(
                    "px-1.5 py-0.5 rounded-full text-[10px]",
                    moderationFilter === f.key ? "bg-purple-800 text-white" : "bg-zinc-800 text-zinc-400"
                  )}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            {/* List of Applications with Moderation State */}
            <div className="space-y-4">
              {apps
                .filter(app => {
                  if (moderationFilter === 'rejected') return app.moderationStatus === 'rejected' || app.status === 'rejected';
                  if (moderationFilter === 'approved') return app.moderationStatus === 'approved' || app.status === 'verified';
                  if (moderationFilter === 'pending') return app.moderationStatus === 'pending' || app.status === 'pending';
                  return true;
                })
                .map(app => {
                  const isRejected = app.moderationStatus === 'rejected' || app.status === 'rejected';
                  const isApproved = app.moderationStatus === 'approved' || app.status === 'verified';
                  return (
                    <div
                      key={app.id}
                      className={clsx(
                        "p-6 rounded-3xl border transition-all relative overflow-hidden",
                        isRejected 
                          ? 'bg-red-950/15 border-red-900/40 text-zinc-100'
                          : isApproved
                          ? theme !== 'light' ? 'bg-zinc-900/40 border-zinc-800' : 'bg-white border-zinc-200'
                          : 'bg-amber-950/15 border-amber-900/40 text-zinc-100'
                      )}
                    >
                      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-bold text-lg text-zinc-100 flex items-center gap-2">
                              {app.title}
                            </h3>
                            {/* Verdict badge */}
                            {isRejected ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                {language === 'ru' ? 'Заблокировано ИИ' : 'Blocked by AI'}
                              </span>
                            ) : isApproved ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle className="w-3.5 h-3.5" />
                                {language === 'ru' ? 'Одобрено ИИ' : 'Approved by AI'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                <AlertCircle className="w-3.5 h-3.5" />
                                {language === 'ru' ? 'Ожидает проверки' : 'Pending Review'}
                              </span>
                            )}

                            <span className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800/80 text-zinc-400 border border-zinc-700/40">
                              {app.category || 'Game'}
                            </span>
                          </div>

                          <p className="text-xs text-zinc-400">
                            {language === 'ru' ? 'Автор:' : 'Author:'} <span className="font-semibold text-zinc-300">{app.authorName}</span>
                            {app.createdAt ? ` • ${new Date(app.createdAt).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US')}` : ''}
                          </p>

                          {/* Moderation Explanation Box */}
                          <div className={clsx(
                            "p-3 rounded-2xl border text-xs space-y-1.5 mt-2",
                            isRejected 
                              ? "bg-red-950/30 border-red-800/40 text-red-200" 
                              : "bg-zinc-800/40 border-zinc-700/40 text-zinc-300"
                          )}>
                            <div className="flex items-center gap-2 font-semibold">
                              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                              <span>{language === 'ru' ? 'Вердикт NVIDIA Nemotron 3.5:' : 'NVIDIA Nemotron 3.5 Verdict:'}</span>
                            </div>
                            <p className="leading-relaxed text-xs">
                              {app.moderationReason || (isRejected ? 'Заблокировано автоматической системой безопасности' : 'Проект прошел автоматическую проверку ИИ, нарушений не найдено')}
                            </p>

                            {/* Flags */}
                            {app.moderationFlags && app.moderationFlags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {app.moderationFlags.map((flag: string) => {
                                  let label = flag;
                                  if (flag === 'hack_attempt') label = language === 'ru' ? '🛑 Попытка взлома' : '🛑 Hack attempt';
                                  if (flag === 'nsfw_18+') label = language === 'ru' ? '🔞 18+ Контент' : '🔞 Adult content';
                                  if (flag === 'profanity') label = language === 'ru' ? '🤬 Ненормативная лексика' : '🤬 Profanity';
                                  if (flag === 'exploit') label = language === 'ru' ? '⚠️ Эксплойт' : '⚠️ Exploit';
                                  if (flag === 'destructive_code') label = language === 'ru' ? '💣 Вредоносный код' : '💣 Destructive code';
                                  return (
                                    <span key={flag} className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                                      {label}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
                          {/* Code Viewer */}
                          <button
                            type="button"
                            onClick={() => setViewingCodeApp({ title: app.title, code: app.code, authorName: app.authorName })}
                            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/50 flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <FileCode className="w-3.5 h-3.5 text-blue-400" />
                            {language === 'ru' ? 'Просмотр кода' : 'View Code'}
                          </button>

                          {/* Rescan AI */}
                          <button
                            type="button"
                            disabled={isRescanning === app.id}
                            onClick={() => handleRescanWithAi(app)}
                            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw className={clsx("w-3.5 h-3.5", isRescanning === app.id && "animate-spin")} />
                            {isRescanning === app.id 
                              ? (language === 'ru' ? 'ИИ сканирует...' : 'Scanning...') 
                              : (language === 'ru' ? 'Перепроверить ИИ' : 'Re-check AI')}
                          </button>

                          {/* Manual Approve */}
                          {!isApproved && (
                            <button
                              type="button"
                              onClick={() => handleManualApprove(app.id, app.title)}
                              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/20"
                            >
                              <Check className="w-3.5 h-3.5" />
                              {language === 'ru' ? 'Одобрить вручную' : 'Approve'}
                            </button>
                          )}

                          {/* Manual Reject */}
                          {!isRejected && (
                            <button
                              type="button"
                              onClick={() => {
                                setManualRejectApp(app);
                                setManualRejectReasonInput(app.moderationReason || '');
                              }}
                              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              {language === 'ru' ? 'Отклонить вручную' : 'Reject'}
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDeleteApp(app.id, app.title)}
                            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800/40 hover:bg-red-600/20 text-zinc-400 hover:text-red-400 border border-zinc-700/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {language === 'ru' ? 'Удалить' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

              {apps.length === 0 && (
                <div className="text-center p-12 text-zinc-500">
                  {language === 'ru' ? 'Нет доступных проектов для модерации' : 'No projects available for moderation'}
                </div>
              )}
            </div>

            {/* AI Moderation Audit Logs Section */}
            <div className="pt-6 border-t border-zinc-800/60">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-base text-zinc-200">
                    {language === 'ru' ? 'Журнал проверок ИИ (Audit Logs)' : 'AI Audit Logs'}
                  </h3>
                </div>
                <span className="text-xs text-zinc-500">
                  {moderationLogs.length} {language === 'ru' ? 'записей' : 'records'}
                </span>
              </div>

              <div className="space-y-2.5">
                {moderationLogs.slice(0, 15).map((log: any) => (
                  <div
                    key={log.id}
                    className={clsx(
                      "p-3.5 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                      !log.approved ? "bg-red-950/20 border-red-900/40 text-red-200" : "bg-zinc-900/50 border-zinc-800/60 text-zinc-300"
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={clsx(
                          "px-2 py-0.5 rounded-md text-[10px] font-bold",
                          log.approved ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"
                        )}>
                          {log.approved ? 'APPROVED' : 'REJECTED'}
                        </span>
                        <span className="font-bold text-zinc-100">{log.appTitle}</span>
                        <span className="text-zinc-500">by {log.authorName}</span>
                      </div>
                      <p className="text-zinc-400">{log.reason}</p>
                    </div>
                    <div className="text-right shrink-0 text-[11px] text-zinc-500">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US') : ''}
                      {log.riskScore !== undefined && (
                        <div className="font-semibold text-zinc-400">Risk: {log.riskScore}/100</div>
                      )}
                    </div>
                  </div>
                ))}

                {moderationLogs.length === 0 && (
                  <div className="p-6 text-center text-xs text-zinc-500 rounded-2xl border border-dashed border-zinc-800">
                    {language === 'ru' ? 'Логи проверок пока пусты' : 'No audit logs yet'}
                  </div>
                )}
              </div>
            </div>
          </div>
=======
>>>>>>> 76052c4025bd6f96aed23817f0502844c437bf0d
        ) : activeTab === 'apps' ? (
          <div className="space-y-4">
            {apps.map(app => (
              <div key={app.id} className={clsx(
                "p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
                theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
              )}>
                <div>
<<<<<<< HEAD
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      {app.title}
                      {app.status === 'verified' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                    </h3>
                    {app.moderationStatus === 'rejected' && (
                      <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                        {language === 'ru' ? 'Заблокировано ИИ' : 'Blocked by AI'}
                      </span>
                    )}
                    {app.moderationStatus === 'approved' && (
                      <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {language === 'ru' ? 'Одобрено ИИ' : 'AI Approved'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500">By {app.authorName} • {app.category}</p>
                  {app.moderationReason && (
                    <p className="text-xs text-zinc-400 mt-1 max-w-xl truncate">
                      {language === 'ru' ? 'Причина:' : 'Reason:'} {app.moderationReason}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setViewingCodeApp({ title: app.title, code: app.code, authorName: app.authorName })}
                      className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer border border-zinc-700/50"
                    >
                      <FileCode className="w-3.5 h-3.5 text-blue-400" />
                      {language === 'ru' ? 'Код' : 'Code'}
                    </button>
                    {(effectiveRole === 'developer' || effectiveRole === 'admin' || effectiveRole === 'moderator' || actualRole === 'developer' || actualRole === 'admin') ? (
=======
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    {app.title}
                    {app.status === 'verified' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                  </h3>
                  <p className="text-sm text-zinc-500">By {app.authorName} • {app.category}</p>
                </div>
                <div className="flex gap-2">
                    {(effectiveRole === 'developer' || effectiveRole === 'admin') ? (
>>>>>>> 76052c4025bd6f96aed23817f0502844c437bf0d
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
<<<<<<< HEAD
                          onClick={() => handleDeleteApp(app.id, app.title)}
                          className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-sm font-medium transition-colors"
                        >
                          {language === 'ru' ? 'Удалить' : 'Delete'}
=======
                          onClick={async () => {
                            if (confirm('Delete this app?')) {
                              try {
                                // Delete the app
                                await deleteDoc(doc(db, 'apps', app.id));
                                // Delete any associated requests
                                const reqsRef = collection(db, 'adminRequests');
                                const q = query(reqsRef, where('targetId', '==', app.id));
                                const qSnap = await getDocs(q);
                                const deletePromises = qSnap.docs.map(d => deleteDoc(d.ref));
                                await Promise.all(deletePromises);
                                alert(language === 'ru' ? 'Приложение удалено' : 'App deleted');
                              } catch (err: any) {
                                alert(err.message);
                                handleFirestoreError(err, OperationType.DELETE, `apps/${app.id}`);
                              }
                            }
                          }}
                          className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-sm font-medium transition-colors"
                        >
                          Delete
>>>>>>> 76052c4025bd6f96aed23817f0502844c437bf0d
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('Remove all dislikes?')) {
                              try {
                                await updateDoc(doc(db, 'apps', app.id), { dislikes: 0 });
                                alert(language === 'ru' ? 'Дислайки обнулены' : 'Dislikes cleared');
                              } catch (err: any) {
                                alert(err.message);
                                handleFirestoreError(err, OperationType.UPDATE, `apps/${app.id}`);
                              }
                            }
                          }}
                          className="px-4 py-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white rounded-xl text-sm font-medium transition-colors"
                        >
                          Remove Dislikes
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
                            try {
                              // Delete the asset
                              await deleteDoc(doc(db, 'assets', asset.id));
                              // Delete any associated requests
                              const reqsRef = collection(db, 'adminRequests');
                              const q = query(reqsRef, where('targetId', '==', asset.id));
                              const qSnap = await getDocs(q);
                              const deletePromises = qSnap.docs.map(d => deleteDoc(d.ref));
                              await Promise.all(deletePromises);
                            } catch (err) {
                              handleFirestoreError(err, OperationType.DELETE, `assets/${asset.id}`);
                            }
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
                      const isSelfDev = u.id === userData.uid && actualRole === 'developer' && perm.key === 'accessControl';
                      const isDisabled = isSelfDev || (actualRole !== 'developer' && actualRole !== 'admin');
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
                // If not developer or admin, only show own requests
                if (effectiveRole !== 'developer' && effectiveRole !== 'admin' && req.requesterId !== userData?.uid) return null;
                
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
                      {req.type === 'avatar_change' && req.avatarUrl && (
                        <div className="mt-4">
                          <p className="text-sm mb-2 text-zinc-500">Avatar Image:</p>
                          <img src={req.avatarUrl} alt="New Avatar" className="w-24 h-24 rounded-full object-cover border border-zinc-700 bg-zinc-800" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-2 min-w-[140px]">
                      {(effectiveRole === 'developer' || effectiveRole === 'admin') && req.status === 'pending' && (
                        <>
                          <button
                            onClick={async () => {
                              try {
                                if (req.type === 'verify_app') await updateDoc(doc(db, 'apps', req.targetId), { status: 'verified' });
                                if (req.type === 'verify_asset') await updateDoc(doc(db, 'assets', req.targetId), { status: 'verified' });
                                if (req.type === 'delete_app') {
<<<<<<< HEAD
                                  try {
                                    await fetch('/api/admin/delete-app', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ appId: req.targetId })
                                    });
                                  } catch (err) {}
                                  try {
                                    await deleteDoc(doc(db, 'apps', req.targetId));
                                  } catch (err) {}
                                  setApps(prev => prev.filter(a => a.id !== req.targetId));
=======
                                  await deleteDoc(doc(db, 'apps', req.targetId));
>>>>>>> 76052c4025bd6f96aed23817f0502844c437bf0d
                                }
                                if (req.type === 'delete_asset') {
                                  await deleteDoc(doc(db, 'assets', req.targetId));
                                }
<<<<<<< HEAD
                                if (req.type === 'ban_user') {
                                  try {
                                    await fetch('/api/admin/ban', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ userId: req.targetId, isBanned: true, reason: req.reason })
                                    });
                                  } catch (err) {}
                                  try {
                                    await updateDoc(doc(db, 'users', req.targetId), { isBanned: true, banReason: req.reason });
                                  } catch (err) {}
                                  setUsers(prev => prev.map(u => u.id === req.targetId ? { ...u, isBanned: true, banReason: req.reason } : u));
                                }
                                
                                // If it was a deletion request, delete all requests for this target
=======
                                if (req.type === 'ban_user') await updateDoc(doc(db, 'users', req.targetId), { isBanned: true, banReason: req.reason });
                                
                                // If it was a deletion request, we should probably delete all requests for this target
>>>>>>> 76052c4025bd6f96aed23817f0502844c437bf0d
                                if (req.type.startsWith('delete_')) {
                                  const q = query(collection(db, 'adminRequests'), where('targetId', '==', req.targetId));
                                  const qSnap = await getDocs(q);
                                  await Promise.all(qSnap.docs.map(d => deleteDoc(d.ref)));
                                } else {
                                  await updateDoc(doc(db, 'adminRequests', req.id), { status: 'approved' });
                                }
<<<<<<< HEAD
                                showToast(language === 'ru' ? 'Выполнено' : 'Approved and applied', 'success');
=======
                                alert(language === 'ru' ? 'Выполнено' : 'Approved and applied');
>>>>>>> 76052c4025bd6f96aed23817f0502844c437bf0d
                              } catch(e) {
                                handleFirestoreError(e, OperationType.UPDATE, `adminRequests/${req.id} or target`);
                              }
                            }}
                            className="w-full px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition-colors"
                          >
                            {req.type === 'avatar_change' ? 'Allow' : 'Approve'}
                          </button>
                          <button
                            onClick={async () => {
                              if (req.type === 'avatar_change') {
                                try {
                                  // Reject avatar = reset to emoji
                                  const defaultAvatar = 'https://ui-avatars.com/api/?name=' + req.targetName;
                                  await updateDoc(doc(db, 'users', req.targetId), { avatarUrl: defaultAvatar });
                                  await updateDoc(doc(db, 'users_public', req.targetId), { avatarUrl: defaultAvatar });
                                  await updateDoc(doc(db, 'adminRequests', req.id), { status: 'rejected' });
                                  alert(language === 'ru' ? 'Отклонено' : 'Rejected');
                                } catch(e) {
                                  console.error(e);
                                }
                              } else {
                                await updateDoc(doc(db, 'adminRequests', req.id), { status: 'rejected' });
                              }
                            }}
                            className="w-full px-4 py-2 bg-red-500/10 text-red-500 rounded-xl text-sm font-medium hover:bg-red-500 hover:text-white transition-colors"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      
                      {(effectiveRole === 'developer' || effectiveRole === 'admin' || req.requesterId === userData?.uid) && (
                        <>
                          {req.requesterId === userData?.uid && req.status === 'pending' && req.type !== 'avatar_change' && (
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
                                try {
                                  await deleteDoc(doc(db, 'adminRequests', req.id));
                                } catch (e) {
                                  handleFirestoreError(e, OperationType.DELETE, `adminRequests/${req.id}`);
                                }
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
<<<<<<< HEAD
                        {u.isVerifiedAuthor && <VerifiedBadge size="sm" />}
                        <span>{u.name}</span>
                        <UserRoleBadge role={u.role} isVerifiedAuthor={u.isVerifiedAuthor} size="xs" showLabel />
=======
                        {u.name}
>>>>>>> 76052c4025bd6f96aed23817f0502844c437bf0d
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
                    {(actualRole === 'developer' || actualRole === 'admin') ? (
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
<<<<<<< HEAD
                        if (actualRole !== 'developer' && effectiveRole !== 'developer') {
                          return showToast(language === 'ru' ? "Только разработчик может выдавать галочки!" : "Only developer can grant verified badge!", 'error');
                        }
                        updateDoc(doc(db, 'users', u.id), { isVerifiedAuthor: !u.isVerifiedAuthor })
                          .then(() => showToast(language === 'ru' ? (u.isVerifiedAuthor ? 'Галочка снята' : 'Галочка успешно выдана!') : 'Verified status updated', 'success'))
                          .catch((e) => showToast(e.message, 'error'));
                      }}
                      className={clsx(
                        "px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border",
                        u.isVerifiedAuthor 
                          ? "bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30" 
                          : "bg-zinc-800 text-zinc-400 border-zinc-700/60 hover:text-white hover:bg-zinc-700"
                      )}
                    >
                      <BadgeCheck className="w-4 h-4 text-blue-400 fill-blue-500/20" />
                      {language === 'ru' ? (u.isVerifiedAuthor ? '✓ Галочка выдана' : 'Выдать галочку') : (u.isVerifiedAuthor ? '✓ Verified' : 'Grant Badge')}
                    </button>
                    {(effectiveRole === 'developer' || effectiveRole === 'admin' || effectiveRole === 'moderator' || actualRole === 'developer' || actualRole === 'admin' || actualRole === 'moderator') ? (
                      <>
                      <button
                        onClick={() => {
                          if (u.isBanned) {
                            setUnbanModalUser(u);
                          } else {
                            setBanModalUser(u);
                            setBanReasonInput('');
                          }
                        }}
                        className={clsx(
                          "px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5",
                          u.isBanned 
                            ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm" 
                            : "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
                        )}
                      >
                        <Ban className="w-4 h-4" />
                        {u.isBanned ? (language === 'ru' ? 'Разбанить' : 'Unban') : (language === 'ru' ? 'Забанить' : 'Ban User')}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id, u.name || 'User')}
                        title={language === 'ru' ? 'Удалить аккаунт' : 'Delete Account'}
                        className="px-3 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">{language === 'ru' ? 'Удалить' : 'Delete'}</span>
                      </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          if (u.isBanned) return showToast('User is already banned', 'error');
                          createAdminRequest('ban_user', u.id, u.name || 'User', 'Community rule violation report');
                        }}
                        className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
=======
                        if (actualRole !== 'developer' && actualRole !== 'admin') return alert(language === 'ru' ? "Недостаточно прав!" : "Insufficient permissions!");
                        updateDoc(doc(db, 'users', u.id), { isVerifiedAuthor: !u.isVerifiedAuthor }).catch(console.error);
                      }}
                      className={clsx(
                        "px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                        u.isVerifiedAuthor ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      )}
                    >
                      {u.isVerifiedAuthor ? 'Verified Author' : 'Verify Author'}
                    </button>
                    {(effectiveRole === 'developer' || effectiveRole === 'admin') ? (
                      <button
                        onClick={async () => {
                          try {
                              if (u.isBanned) {
                                if (confirm('Unban this user?')) {
                                  await updateDoc(doc(db, 'users', u.id), { isBanned: false, banReason: null });
                                  alert(language === 'ru' ? 'Пользователь разбанен' : 'User unbanned');
                                }
                              } else {
                                const reason = prompt('Ban Reason:');
                                if (reason !== null) {
                                  await updateDoc(doc(db, 'users', u.id), { isBanned: true, banReason: reason });
                                  alert(language === 'ru' ? 'Пользователь забанен' : 'User banned');
                                }
                              }
                          } catch (e) {
                            handleFirestoreError(e, OperationType.UPDATE, `users/${u.id}`);
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
>>>>>>> 76052c4025bd6f96aed23817f0502844c437bf0d
                      >
                        Request Ban
                      </button>
                    )}
                    <div className="flex items-center gap-2">

                      {(actualRole === 'developer' || actualRole === 'admin') && (
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
<<<<<<< HEAD

      {/* Toast Alert */}
      {toastMessage && (
        <div className={clsx(
          "fixed bottom-6 right-6 z-[120] px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2",
          toastType === 'error' ? "bg-red-950/90 border-red-800 text-red-200" : "bg-emerald-950/90 border-emerald-800 text-emerald-200"
        )}>
          {toastType === 'error' ? <AlertCircle className="w-5 h-5 text-red-400 shrink-0" /> : <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />}
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Ban User Modal */}
      {banModalUser && (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={clsx(
            "w-full max-w-md rounded-3xl p-6 border shadow-2xl relative",
            isFrutigerAero ? "frutiger-aero-glass text-blue-950" : theme === 'light' ? "bg-white border-zinc-200 text-zinc-900" : "bg-zinc-900 border-zinc-800 text-zinc-100"
          )}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{language === 'ru' ? 'Блокировка пользователя' : 'Ban User'}</h3>
                  <p className="text-xs opacity-60">ID: {banModalUser.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setBanModalUser(null)}
                className="p-2 rounded-xl hover:bg-zinc-800/20 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-zinc-800/30 border border-zinc-700/30 flex items-center gap-3">
                <img src={banModalUser.photoUrl || getDefaultAvatar(banModalUser.id)} alt="" className="w-10 h-10 rounded-full" />
                <div>
                  <div className="font-semibold flex items-center gap-1.5">
                    <span>{banModalUser.name || 'User'}</span>
                    <UserRoleBadge role={banModalUser.role} isVerifiedAuthor={banModalUser.isVerifiedAuthor} size="xs" />
                  </div>
                  <div className="text-xs text-zinc-500">{banModalUser.email || 'No email'}</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 opacity-70">
                  {language === 'ru' ? 'Причина бана' : 'Ban Reason'}
                </label>
                <input
                  type="text"
                  value={banReasonInput}
                  onChange={(e) => setBanReasonInput(e.target.value)}
                  placeholder={language === 'ru' ? 'Укажите причину блокировки...' : 'Enter reason for ban...'}
                  className={clsx(
                    "w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-red-500",
                    theme === 'light' ? "bg-zinc-50 border-zinc-300 text-zinc-900" : "bg-zinc-800/80 border-zinc-700 text-zinc-100"
                  )}
                />
                
                {/* Quick preset chips */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {[
                    language === 'ru' ? 'Нарушение правил' : 'Rules violation',
                    language === 'ru' ? 'Спам / Флуд' : 'Spam / Flood',
                    language === 'ru' ? 'Попытка взлома / Чит' : 'Exploit / Cheat',
                    language === 'ru' ? 'Неприемлемый контент' : 'Inappropriate content'
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBanReasonInput(preset)}
                      className={clsx(
                        "text-[11px] px-2.5 py-1 rounded-lg border transition-colors cursor-pointer",
                        banReasonInput === preset 
                          ? "bg-red-500 text-white border-red-500" 
                          : "bg-zinc-800/40 border-zinc-700/50 text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setBanModalUser(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-700/50 hover:bg-zinc-800/40 font-medium text-sm transition-colors cursor-pointer"
                >
                  {language === 'ru' ? 'Отмена' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBan}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors cursor-pointer shadow-lg shadow-red-600/20"
                >
                  {language === 'ru' ? 'Заблокировать' : 'Confirm Ban'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unban User Modal */}
      {unbanModalUser && (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={clsx(
            "w-full max-w-sm rounded-3xl p-6 border shadow-2xl relative",
            isFrutigerAero ? "frutiger-aero-glass text-blue-950" : theme === 'light' ? "bg-white border-zinc-200 text-zinc-900" : "bg-zinc-900 border-zinc-800 text-zinc-100"
          )}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <CheckCircle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg">{language === 'ru' ? 'Разблокировать?' : 'Unban User?'}</h3>
            </div>
            <p className="text-sm opacity-80 mb-5">
              {language === 'ru' 
                ? `Вы уверены, что хотите снять блокировку с пользователя "${unbanModalUser.name || 'User'}"?` 
                : `Are you sure you want to unban "${unbanModalUser.name || 'User'}"?`}
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setUnbanModalUser(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-700/50 hover:bg-zinc-800/40 font-medium text-sm transition-colors cursor-pointer"
              >
                {language === 'ru' ? 'Отмена' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleExecuteUnban}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors cursor-pointer shadow-lg shadow-emerald-600/20"
              >
                {language === 'ru' ? 'Разбанить' : 'Confirm Unban'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Code Modal */}
      {viewingCodeApp && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={clsx(
            "w-full max-w-4xl max-h-[90vh] rounded-3xl p-6 border shadow-2xl flex flex-col relative",
            theme === 'light' ? "bg-white border-zinc-200 text-zinc-900" : "bg-zinc-900 border-zinc-800 text-zinc-100"
          )}>
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{viewingCodeApp.title}</h3>
                  <p className="text-xs text-zinc-400">
                    {language === 'ru' ? 'Автор:' : 'Author:'} {viewingCodeApp.authorName} • {viewingCodeApp.code ? viewingCodeApp.code.length : 0} {language === 'ru' ? 'символов' : 'characters'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(viewingCodeApp.code || '');
                    showToast(language === 'ru' ? 'Код скопирован в буфер' : 'Code copied to clipboard');
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition-colors cursor-pointer"
                >
                  {language === 'ru' ? 'Копировать код' : 'Copy Code'}
                </button>
                <button
                  type="button"
                  onClick={() => setViewingCodeApp(null)}
                  className="p-1.5 rounded-xl hover:bg-zinc-800/80 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto mt-4 rounded-2xl bg-zinc-950 p-4 border border-zinc-800/80">
              <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap break-all leading-relaxed">
                <code>{viewingCodeApp.code || '// Empty code'}</code>
              </pre>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingCodeApp(null)}
                className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-semibold text-xs text-zinc-200 transition-colors cursor-pointer"
              >
                {language === 'ru' ? 'Закрыть' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Reject Modal */}
      {manualRejectApp && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={clsx(
            "w-full max-w-md rounded-3xl p-6 border shadow-2xl relative",
            theme === 'light' ? "bg-white border-zinc-200 text-zinc-900" : "bg-zinc-900 border-zinc-800 text-zinc-100"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">{language === 'ru' ? 'Отклонить публикацию' : 'Reject Publication'}</h3>
                  <p className="text-xs text-zinc-400">{manualRejectApp.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManualRejectApp(null)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <label className="text-xs font-medium text-zinc-400 block">
                {language === 'ru' ? 'Укажите причину отклонения (будет видна автору):' : 'Rejection reason (visible to author):'}
              </label>
              <textarea
                value={manualRejectReasonInput}
                onChange={(e) => setManualRejectReasonInput(e.target.value)}
                placeholder={language === 'ru' ? 'Например: Проект содержит вредоносный код или недопустимый контент' : 'e.g. Inappropriate content, hack attempt, or spam'}
                className="w-full h-24 p-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500/60 resize-none"
              />

              {/* Quick preset chips */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  language === 'ru' ? '18+ Контент / Неприемлемо' : '18+ Adult content',
                  language === 'ru' ? 'Попытка взлома / Эксплойт' : 'Exploit / Hack attempt',
                  language === 'ru' ? 'Ненормативная лексика' : 'Profanity / Vulgarity',
                  language === 'ru' ? 'Спам / Накрутка' : 'Spam / Bot flood',
                  language === 'ru' ? 'Бесконечный цикл / DoS' : 'Crash loop / DoS'
                ].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setManualRejectReasonInput(preset)}
                    className={clsx(
                      "text-[11px] px-2.5 py-1 rounded-lg border transition-colors cursor-pointer",
                      manualRejectReasonInput === preset 
                        ? "bg-red-500 text-white border-red-500" 
                        : "bg-zinc-800/40 border-zinc-700/50 text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setManualRejectApp(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-700/50 hover:bg-zinc-800/40 font-medium text-xs transition-colors cursor-pointer"
              >
                {language === 'ru' ? 'Отмена' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleManualReject}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-lg shadow-red-600/20"
              >
                {language === 'ru' ? 'Отклонить проект' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
=======
>>>>>>> 76052c4025bd6f96aed23817f0502844c437bf0d
    </div>
  );
}
