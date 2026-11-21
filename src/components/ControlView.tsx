import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { translations } from '../lib/translations';
import { clsx } from 'clsx';
import {
  ShieldCheck, CheckCircle, XCircle, Users, Coins, Search, Ban, AlertCircle, X, Trash2,
  RefreshCw, Check, FileCode, ShieldAlert, BadgeCheck, Clock, AlertTriangle, Bot, Send,
  Terminal, CheckCircle2, Zap, Copy, Shield
} from 'lucide-react';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, onSnapshot, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { db, auth } from '../firebase';
import { AppData } from '../types';
import { getDefaultAvatar } from '../lib/avatar';
import UserRoleBadge from './UserRoleBadge';
import VerifiedBadge from './VerifiedBadge';
import { notify, confirmAction, promptAction } from '../store/useDialogStore';
import CustomSelect from './CustomSelect';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (err) {
    console.warn('Could not retrieve Firebase ID token:', err);
  }
  return headers;
}

export default function ControlView() {
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
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

  const actualRole = userData?.role || 'user';
  const effectiveRole = actualRole === 'developer' && simulatedRole ? simulatedRole : actualRole;
  const isDeveloper = actualRole === 'developer' || effectiveRole === 'developer';

  const [activeTab, setActiveTab] = useState<'apps' | 'users' | 'assets' | 'roles' | 'premium' | 'requests' | 'moderation' | 'ai-help'>(
    isDeveloper ? 'moderation' : 'apps'
  );
  const [search, setSearch] = useState('');
  const [localPermissions, setLocalPermissions] = useState<{ [userId: string]: any }>({});
  const [saving, setSaving] = useState<string | null>(null);

  // AI Help Security Assistant state
  const [aiHelpInput, setAiHelpInput] = useState('');
  const [aiHelpLoading, setAiHelpLoading] = useState(false);
  const [aiHelpMessages, setAiHelpMessages] = useState<
    Array<{
      id: string;
      sender: 'user' | 'ai';
      text: string;
      actionResult?: { type: string; executed: boolean; reason?: string; target?: string };
      timestamp: string;
    }>
  >([
    {
      id: 'welcome',
      sender: 'ai',
      text:
        'Здравствуйте! Я — строгий ИИ-помощник по безопасности платформы EPL Studio. Я отвечаю ИСКЛЮЧИТЕЛЬНО за безопасность платформы: модерацию контента, поиск матов, 18+ и эксплойтов, блокировку нарушителей (баны/разбаны), проверку статусов "Role is allowed by dev" и защиту кода. Напишите вашу команду безопасности или используйте быстрые действия.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  // Moderation state
  const [moderationLogs, setModerationLogs] = useState<any[]>([]);
  const [moderationFilter, setModerationFilter] = useState<'all' | 'approved' | 'rejected' | 'pending'>('all');
  const [viewingCodeApp, setViewingCodeApp] = useState<{ title: string; code: string; authorName: string } | null>(null);
  const [manualRejectApp, setManualRejectApp] = useState<AppData | null>(null);
  const [manualRejectReasonInput, setManualRejectReasonInput] = useState('');
  const [isRescanning, setIsRescanning] = useState<string | null>(null);

  // User Moderation Sub-tab state
  const [moderationSubTab, setModerationSubTab] = useState<'projects' | 'users'>('projects');
  const [userModerationFilter, setUserModerationFilter] = useState<'all' | 'banned' | 'clean' | 'flagged'>('all');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isScanningAllUsers, setIsScanningAllUsers] = useState(false);
  const [scanningUserId, setScanningUserId] = useState<string | null>(null);

  // Ban management modal states
  const [banModalUser, setBanModalUser] = useState<any | null>(null);
  const [banReasonInput, setBanReasonInput] = useState('');
  const [unbanModalUser, setUnbanModalUser] = useState<any | null>(null);

  const [hourlyStatus, setHourlyStatus] = useState<any>(null);
  const [isTriggeringHourly, setIsTriggeringHourly] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'error') notify.error(msg);
    else notify.success(msg);
  };

  const t = translations[language];
  const isLight = theme === 'light' && !isFrutigerAero;

  const cardClass = clsx(
    'rounded-xl border',
    isFrutigerAero
      ? 'bg-white/40 border-white/50 backdrop-blur-md shadow-sm'
      : isLight
        ? 'bg-white border-[#E2E5EA]'
        : 'bg-[#181B20] border-[#262B33]'
  );

  const subSurfaceClass = clsx(
    'rounded-lg border',
    isFrutigerAero
      ? 'bg-white/50 border-white/40'
      : isLight
        ? 'bg-[#F5F6F8] border-[#E2E5EA]'
        : 'bg-[#111315] border-[#262B33]'
  );

  const inputClass = clsx(
    'rounded-lg border text-sm focus:outline-none transition-colors',
    isFrutigerAero
      ? 'bg-white/60 border-white/40 text-blue-950 placeholder-blue-500'
      : isLight
        ? 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315] focus:border-[#059669]'
        : 'bg-[#111315] border-[#262B33] text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981]'
  );

  const fetchHourlyStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/hourly-moderation-status');
      if (res.ok) {
        const data = await res.json();
        setHourlyStatus(data);
      }
    } catch (_) {}
  }, []);

  const handleTriggerHourly = async () => {
    setIsTriggeringHourly(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/ai/run-hourly-moderation', { method: 'POST', headers });
      if (res.ok) {
        showToast(language === 'ru' ? 'Почасовая проверка ИИ успешно завершена!' : 'Hourly AI moderation completed!', 'success');
        fetchHourlyStatus();
        fetch('/api/admin/moderation-logs', { headers })
          .then(r => r.json())
          .then(d => {
            if (Array.isArray(d.logs)) setModerationLogs(d.logs);
          })
          .catch(() => {});
      } else {
        throw new Error('Failed to run hourly moderation');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsTriggeringHourly(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'moderation' && !isDeveloper) {
      setActiveTab('apps');
    }
  }, [activeTab, isDeveloper]);

  useEffect(() => {
    setLoading(true);

    // Subscribe to apps
    const appsUnsubscribe = onSnapshot(
      collection(db, 'apps'),
      (snapshot) => {
        const appsData = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as AppData));
        setApps(appsData.filter(app => !app.isPrivate));
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching apps', error);
        setLoading(false);
      }
    );

    // Load all users from backend API & users_public fallback to ensure all users always appear in Control Panel
    const loadAllUsers = async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/admin/users', { headers });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.users) && data.users.length > 0) {
            setUsers(prev => {
              const map = new Map<string, any>();
              prev.forEach(u => map.set(u.id || u.uid || u.email, u));
              data.users.forEach((u: any) => {
                const docId = u.id || u.uid;
                const key = docId || u.email;
                map.set(key, { ...(map.get(key) || {}), ...u, id: docId, uid: u.uid || docId });
              });
              return Array.from(map.values());
            });
          }
        }
      } catch (e) {
        console.warn('Failed to load /api/admin/users:', e);
      }

      try {
        const pubSnap = await getDocs(collection(db, 'users_public'));
        if (!pubSnap.empty) {
          const pubUsers = pubSnap.docs.map(d => ({ ...d.data(), id: d.id, uid: d.data().uid || d.id }));
          setUsers(prev => {
            const map = new Map<string, any>();
            prev.forEach(u => map.set(u.id || u.uid || u.email, u));
            pubUsers.forEach((u: any) => {
              const key = u.id || u.uid || u.email;
              map.set(key, { ...(map.get(key) || {}), ...u, id: u.id, uid: u.uid || u.id });
            });
            return Array.from(map.values());
          });
        }
      } catch (_) {}
    };
    loadAllUsers();

    // Subscribe to users
    const usersUnsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const usersData = snapshot.docs.map(d => ({ ...d.data(), id: d.id, uid: d.data().uid || d.id }));
        setUsers(prev => {
          const map = new Map<string, any>();
          prev.forEach(u => map.set(u.id || u.uid || u.email, u));
          usersData.forEach((u: any) => {
            const key = u.id || u.uid || u.email;
            map.set(key, { ...(map.get(key) || {}), ...u, id: u.id, uid: u.uid || u.id });
          });
          return Array.from(map.values());
        });
      },
      (error) => {
        console.warn('Firestore users snapshot restricted, using server API fallback:', error);
        loadAllUsers();
      }
    );

    // Subscribe to assets
    const assetsUnsubscribe = onSnapshot(
      collection(db, 'assets'),
      (snapshot) => {
        const assetsData = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
        setAssets(assetsData);
      },
      (error) => {
        console.error('Error fetching assets', error);
      }
    );

    // Subscribe to admin requests
    const requestsUnsubscribe = onSnapshot(
      collection(db, 'adminRequests'),
      (snapshot) => {
        const reqsData = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
        setAdminRequests(reqsData);
      },
      (error) => {
        console.error('Error fetching admin requests:', error);
      }
    );

    // Subscribe to premium codes if accessible
    const codesUnsubscribe = onSnapshot(
      collection(db, 'premiumCodes'),
      (snapshot) => {
        setPremiumCodes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      () => {}
    );

    // Merge moderation logs helper
    const mergeModerationLogs = (incoming: any[]) => {
      setModerationLogs(prev => {
        const map = new Map<string, any>();
        prev.forEach(item => map.set(item.id, item));
        incoming.forEach(item => {
          if (item && item.id) map.set(item.id, { ...(map.get(item.id) || {}), ...item });
        });
        return Array.from(map.values()).sort(
          (a, b) => new Date(b.createdAt || b.timestamp || 0).getTime() - new Date(a.createdAt || a.timestamp || 0).getTime()
        );
      });
    };

    // Subscribe to realtime aiModerationLogs
    const logsUnsubscribe = onSnapshot(
      collection(db, 'aiModerationLogs'),
      (snapshot) => {
        const snapLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (snapLogs.length > 0) mergeModerationLogs(snapLogs);
      },
      () => {}
    );

    // Fetch initial moderation logs
    const fetchLogs = async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/admin/moderation-logs', { headers });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.logs)) mergeModerationLogs(data.logs);
        }
      } catch (_) {}
    };
    fetchLogs();
    fetchHourlyStatus();

    return () => {
      appsUnsubscribe();
      usersUnsubscribe();
      assetsUnsubscribe();
      requestsUnsubscribe();
      codesUnsubscribe();
      logsUnsubscribe();
    };
  }, [fetchHourlyStatus]);

  const handleManualApprove = async (appId: string, appTitle: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/manual-review', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          appId,
          appTitle,
          action: 'approve',
          reason: language === 'ru' ? 'Одобрено модератором вручную' : 'Approved by staff manually',
          reviewerName: userData?.name || 'Staff',
        }),
      });
      if (!res.ok) {
        await updateDoc(doc(db, 'apps', appId), {
          status: 'verified',
          moderationStatus: 'approved',
          moderationReason: language === 'ru' ? 'Одобрено модератором вручную' : 'Approved by staff manually',
          moderatedAt: new Date().toISOString(),
        });
      }

      setApps(prev => prev.map(a => (a.id === appId ? { ...a, status: 'verified', moderationStatus: 'approved' } : a)));
      showToast(language === 'ru' ? `Проект "${appTitle}" одобрен вручную и опубликован!` : `Project "${appTitle}" approved and published!`, 'success');

      fetch('/api/admin/moderation-logs', { headers })
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d.logs) && d.logs.length > 0) setModerationLogs(d.logs);
        })
        .catch(() => {});
    } catch (err: any) {
      showToast(err.message || 'Error', 'error');
    }
  };

  const handleManualReject = async () => {
    if (!manualRejectApp) return;
    const reason =
      manualRejectReasonInput.trim() ||
      (language === 'ru' ? 'Отклонено модератором: нарушение правил платформы' : 'Rejected by staff: rules violation');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/manual-review', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          appId: manualRejectApp.id,
          appTitle: manualRejectApp.title,
          action: 'reject',
          reason,
          reviewerName: userData?.name || 'Staff',
        }),
      });
      if (!res.ok) {
        await updateDoc(doc(db, 'apps', manualRejectApp.id), {
          status: 'rejected',
          moderationStatus: 'rejected',
          moderationReason: reason,
          moderatedAt: new Date().toISOString(),
        });
      }

      setApps(prev =>
        prev.map(a =>
          a.id === manualRejectApp.id ? { ...a, status: 'rejected', moderationStatus: 'rejected', moderationReason: reason } : a
        )
      );
      showToast(language === 'ru' ? `Проект "${manualRejectApp.title}" отклонен` : `Project "${manualRejectApp.title}" rejected`, 'success');

      fetch('/api/admin/moderation-logs', { headers })
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d.logs) && d.logs.length > 0) setModerationLogs(d.logs);
        })
        .catch(() => {});
    } catch (err: any) {
      showToast(err.message || 'Error', 'error');
    } finally {
      setManualRejectApp(null);
      setManualRejectReasonInput('');
    }
  };

  const handleRescanWithAi = async (app: AppData) => {
    setIsRescanning(app.id);
    showToast(language === 'ru' ? 'ИИ проверяет проект...' : 'AI checking project...', 'success');
    try {
      const res = await fetch('/api/ai/moderate-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: app.title,
          description: app.description,
          code: app.code,
          authorName: app.authorName,
        }),
      });

      let modResult: any = null;
      const text = await res.text();
      try {
        modResult = JSON.parse(text);
      } catch {
        console.warn('Non-JSON response from moderate-app:', text);
      }

      if (!res.ok || !modResult) {
        const combined = `${app.title} ${app.description || ''} ${app.code || ''}`.toLowerCase();
        const badWords = [
          'хуй', 'пизда', 'ебать', 'блять', 'сука', 'fuck', 'shit', 'nigger',
          'porn', 'xxx', 'hentai', 'you hacked', 'hacked by', 'fuada was hacked', 'взломали', 'kamil',
        ];
        const matches = badWords.filter(w => combined.includes(w));
        if (matches.length > 0) {
          modResult = {
            approved: false,
            reason: `Обнаружены запрещенные слова или признаки дефейса/взлома: ${matches.slice(0, 3).join(', ')}`,
            flags: ['profanity', 'restricted_terms'],
            riskScore: 9,
          };
        } else {
          modResult = {
            approved: true,
            reason: 'Проект проверен локальной системой безопасности: нарушений не обнаружено',
            flags: [],
            riskScore: 0,
          };
        }
      }

      try {
        await updateDoc(doc(db, 'apps', app.id), {
          status: modResult.approved ? 'verified' : 'rejected',
          moderationStatus: modResult.approved ? 'approved' : 'rejected',
          moderationReason: modResult.reason,
          moderationFlags: modResult.flags || [],
          moderatedAt: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.warn('Direct Firestore update notice:', dbErr);
      }

      try {
        const headers = await getAuthHeaders();
        await fetch('/api/admin/manual-review', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            appId: app.id,
            appTitle: app.title,
            action: modResult.approved ? 'approve' : 'reject',
            reason: modResult.reason,
            reviewerName: 'Nemotron 3.5 AI Moderator',
          }),
        });
      } catch (_) {}

      setApps(prev =>
        prev.map(a =>
          a.id === app.id
            ? {
                ...a,
                status: modResult.approved ? 'verified' : 'rejected',
                moderationStatus: modResult.approved ? 'approved' : 'rejected',
                moderationReason: modResult.reason,
              }
            : a
        )
      );

      showToast(
        modResult.approved
          ? language === 'ru'
            ? 'ИИ одобрил проект!'
            : 'AI approved project!'
          : language === 'ru'
            ? `ИИ отклонил: ${modResult.reason}`
            : `AI rejected: ${modResult.reason}`,
        modResult.approved ? 'success' : 'error'
      );

      const logHeaders = await getAuthHeaders();
      fetch('/api/admin/moderation-logs', { headers: logHeaders })
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d.logs) && d.logs.length > 0) setModerationLogs(d.logs);
        })
        .catch(() => {});
    } catch (err: any) {
      console.error('Error re-scanning with AI:', err);
      showToast(err.message || 'Error re-scanning with AI', 'error');
    } finally {
      setIsRescanning(null);
    }
  };

  const evaluateUserLocally = (u: any) => {
    const roleStr = (u.role || 'user').toLowerCase().trim();
    const hasElevatedRole = roleStr !== '' && roleStr !== 'user';
    const isVerified = u.isVerifiedAuthor === true;
    if (hasElevatedRole && !isVerified) {
      return {
        approved: false,
        reason: `У пользователя установлена роль "${u.role}" без галочки (VERIFIED). Любые роли кроме "user" без галочки VERIFIED запрещены и блокируются ИИ.`,
        flags: ['unauthorized_role_elevation', 'missing_verified_badge'],
        riskScore: 10,
      };
    }
    return {
      approved: true,
      reason: isVerified
        ? `У пользователя установлена галочка (VERIFIED) — роль "${u.role || 'user'}" подтверждена, профиль одобрен.`
        : 'Профиль проверен: нарушений не обнаружено.',
      flags: [],
      riskScore: 0,
    };
  };

  const handleScanUserWithAi = async (u: any) => {
    const uid = u.id || u.uid;
    setScanningUserId(uid);
    showToast(language === 'ru' ? `ИИ проверяет профиль "${u.name || u.email}"...` : `AI checking profile "${u.name || u.email}"...`, 'success');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/ai/moderate-user', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: uid,
          name: u.name || 'User',
          email: u.email || '',
          bio: u.bio || u.description || '',
          avatarUrl: u.photoUrl || u.avatarUrl || '',
          role: u.role || 'user',
          isVerifiedAuthor: u.isVerifiedAuthor === true,
          roleVerification: u.roleVerification,
          roleVerifiedBy: u.roleVerifiedBy,
        }),
      });

      let modResult: any = null;
      const text = await res.text();
      try {
        modResult = JSON.parse(text);
      } catch {
        console.warn('Non-JSON response from moderate-user:', text);
      }

      if (!res.ok || !modResult) {
        modResult = evaluateUserLocally(u);
      }

      const now = new Date().toISOString();
      try {
        await setDoc(
          doc(db, 'users', uid),
          {
            isBanned: !modResult.approved,
            banReason: !modResult.approved ? modResult.reason : null,
            moderationStatus: modResult.approved ? 'approved' : 'rejected',
            moderationReason: modResult.reason,
            moderationFlags: modResult.flags || [],
            moderatedAt: now,
          },
          { merge: true }
        );
        await setDoc(
          doc(db, 'users_public', uid),
          {
            isBanned: !modResult.approved,
            banReason: !modResult.approved ? modResult.reason : null,
          },
          { merge: true }
        );
      } catch (dbErr) {
        console.warn('Direct Firestore user scan sync notice:', dbErr);
      }

      setUsers(prev =>
        prev.map(item =>
          (item.id || item.uid) === uid
            ? {
                ...item,
                isBanned: !modResult.approved,
                banReason: !modResult.approved ? modResult.reason : null,
                moderationStatus: modResult.approved ? 'approved' : 'rejected',
                moderationReason: modResult.reason,
                moderationFlags: modResult.flags,
                moderatedAt: now,
              }
            : item
        )
      );

      showToast(
        modResult.approved
          ? language === 'ru'
            ? `Профиль "${u.name || u.email}" соответствует правилам`
            : `User profile "${u.name || u.email}" approved`
          : language === 'ru'
            ? `Пользователь забанен ИИ: ${modResult.reason}`
            : `User banned by AI: ${modResult.reason}`,
        modResult.approved ? 'success' : 'error'
      );

      fetch('/api/admin/moderation-logs', { headers })
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d.logs) && d.logs.length > 0) setModerationLogs(d.logs);
        })
        .catch(() => {});
    } catch (err: any) {
      showToast(err.message || 'Error scanning user profile', 'error');
    } finally {
      setScanningUserId(null);
    }
  };

  const handleScanAllUsersWithAi = async () => {
    if (users.length === 0) return;
    setIsScanningAllUsers(true);
    showToast(language === 'ru' ? `Запуск полной проверки ИИ для ${users.length} пользователей...` : `Started scanning ${users.length} users with AI...`, 'success');
    let bannedCount = 0;
    let cleanCount = 0;
    const headers = await getAuthHeaders();

    for (const u of users) {
      const uid = u.id || u.uid;
      try {
        setScanningUserId(uid);
        const res = await fetch('/api/ai/moderate-user', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            userId: uid,
            name: u.name || 'User',
            email: u.email || '',
            bio: u.bio || u.description || '',
            avatarUrl: u.photoUrl || u.avatarUrl || '',
            role: u.role || 'user',
            isVerifiedAuthor: u.isVerifiedAuthor === true,
            roleVerification: u.roleVerification,
            roleVerifiedBy: u.roleVerifiedBy,
          }),
        });

        let modResult: any = null;
        const text = await res.text();
        try {
          modResult = JSON.parse(text);
        } catch (_) {}

        if (!res.ok || !modResult) {
          modResult = evaluateUserLocally(u);
        }

        const now = new Date().toISOString();
        try {
          await setDoc(
            doc(db, 'users', uid),
            {
              isBanned: !modResult.approved,
              banReason: !modResult.approved ? modResult.reason : null,
              moderationStatus: modResult.approved ? 'approved' : 'rejected',
              moderationReason: modResult.reason,
              moderationFlags: modResult.flags || [],
              moderatedAt: now,
            },
            { merge: true }
          );
          await setDoc(
            doc(db, 'users_public', uid),
            {
              isBanned: !modResult.approved,
              banReason: !modResult.approved ? modResult.reason : null,
            },
            { merge: true }
          );
        } catch (_) {}

        if (!modResult.approved) bannedCount++;
        else cleanCount++;

        setUsers(prev =>
          prev.map(item =>
            (item.id || item.uid) === uid
              ? {
                  ...item,
                  isBanned: !modResult.approved,
                  banReason: !modResult.approved ? modResult.reason : null,
                  moderationStatus: modResult.approved ? 'approved' : 'rejected',
                  moderationReason: modResult.reason,
                  moderationFlags: modResult.flags,
                  moderatedAt: now,
                }
              : item
          )
        );
      } catch (e) {
        console.warn('Error scanning user:', uid, e);
      }
    }

    setScanningUserId(null);
    setIsScanningAllUsers(false);
    showToast(
      language === 'ru' ? `Проверка завершена: ${bannedCount} забанено, ${cleanCount} одобрено` : `Scan complete: ${bannedCount} banned, ${cleanCount} approved`,
      'success'
    );
  };

  const handleSendAiHelp = async (customMessage?: string) => {
    const textToSend = (customMessage || aiHelpInput).trim();
    if (!textToSend || aiHelpLoading) return;

    const userMsg = {
      id: 'msg_' + Date.now(),
      sender: 'user' as const,
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setAiHelpMessages(prev => [...prev, userMsg]);
    if (!customMessage) setAiHelpInput('');
    setAiHelpLoading(true);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/ai/admin-help', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: textToSend,
          callerName: userData?.name || 'Staff Member',
          callerRole: effectiveRole,
        }),
      });

      let data: any = null;
      const rawText = await res.text();
      try {
        data = JSON.parse(rawText);
      } catch {
        console.warn('Non-JSON from admin-help:', rawText);
      }

      if (!res.ok || !data) {
        data = {
          reply:
            language === 'ru'
              ? 'Я специализированный ИИ безопасности платформы. Ваш запрос принят. Я отвечаю ТОЛЬКО за безопасность платформы, модерацию и санкции.'
              : 'I am the Security AI Assistant. I respond ONLY to security, moderation and platform safety requests.',
          action: { type: 'none' },
        };
      }

      if (data.action && data.action.type !== 'none') {
        const act = data.action;
        if (act.type === 'ban_user' && act.targetUserId) {
          setUsers(prev =>
            prev.map(u => (u.id === act.targetUserId || u.uid === act.targetUserId ? { ...u, isBanned: true, banReason: act.reason || 'Banned via AI Help' } : u))
          );
          showToast(language === 'ru' ? 'Пользователь заблокирован ИИ помощником' : 'User banned by AI Security', 'success');
        } else if (act.type === 'unban_user' && act.targetUserId) {
          setUsers(prev =>
            prev.map(u => (u.id === act.targetUserId || u.uid === act.targetUserId ? { ...u, isBanned: false, banReason: null } : u))
          );
          showToast(language === 'ru' ? 'Пользователь разблокирован ИИ помощником' : 'User unbanned by AI Security', 'success');
        } else if (act.type === 'reject_app' && act.targetAppId) {
          setApps(prev =>
            prev.map(a => (a.id === act.targetAppId ? { ...a, status: 'rejected', moderationStatus: 'rejected', moderationReason: act.reason } : a))
          );
          showToast(language === 'ru' ? 'Проект отклонен и заблокирован' : 'App rejected and blocked', 'success');
        } else if (act.type === 'approve_app' && act.targetAppId) {
          setApps(prev => prev.map(a => (a.id === act.targetAppId ? { ...a, status: 'verified', moderationStatus: 'approved' } : a)));
          showToast(language === 'ru' ? 'Проект одобрен' : 'App approved', 'success');
        } else if (act.type === 'run_scan') {
          handleTriggerHourly();
        }
      }

      const aiMsg = {
        id: 'msg_' + Date.now(),
        sender: 'ai' as const,
        text: data.reply || (language === 'ru' ? 'Команда безопасности выполнена.' : 'Security command processed.'),
        actionResult:
          data.actionResult ||
          (data.action?.type !== 'none'
            ? { type: data.action.type, executed: true, reason: data.action.reason, target: data.action.targetUserId || data.action.targetAppId }
            : undefined),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setAiHelpMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      setAiHelpMessages(prev => [
        ...prev,
        {
          id: 'msg_' + Date.now(),
          sender: 'ai' as const,
          text:
            language === 'ru'
              ? `Ошибка соединения с модулем безопасности: ${err.message}. Напоминаю: ИИ отвечает исключительно за безопасность.`
              : `Security module error: ${err.message}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setAiHelpLoading(false);
    }
  };

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
        updatedAt: new Date().toISOString(),
      });
      notify.success(language === 'ru' ? 'Запрос отправлен разработчику' : 'Request sent to developer');
    } catch (err) {
      console.error(err);
      notify.error(language === 'ru' ? 'Ошибка создания запроса' : 'Error creating request');
    }
  };

  const handleVerifyApp = async (appId: string, status: 'verified' | 'pending') => {
    try {
      await updateDoc(doc(db, 'apps', appId), { status });
      notify.success(language === 'ru' ? 'Статус приложения обновлен' : 'App status updated');
    } catch (error: any) {
      notify.error(error.message);
      handleFirestoreError(error, OperationType.UPDATE, `apps/${appId}`);
    }
  };

  const handleVerifyAsset = async (assetId: string, status: 'verified' | 'pending') => {
    try {
      await updateDoc(doc(db, 'assets', assetId), { status });
      notify.success(language === 'ru' ? 'Статус ассета обновлен' : 'Asset status updated');
    } catch (error: any) {
      notify.error(error.message);
      handleFirestoreError(error, OperationType.UPDATE, `assets/${assetId}`);
    }
  };

  const handleUpdateUserRole = async (userId: string, role: string) => {
    if (actualRole !== 'developer' && actualRole !== 'admin') {
      showToast(language === 'ru' ? 'Недостаточно прав!' : 'Insufficient permissions!', 'error');
      return;
    }
    try {
      let persisted = false;
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/admin/set-role', {
          method: 'POST',
          headers,
          body: JSON.stringify({ uid: userId, role, adminUid: userData?.uid }),
        });
        if (res.ok) persisted = true;
      } catch (_) {}

      if (!persisted) {
        await setDoc(doc(db, 'users', userId), { role }, { merge: true });
        await setDoc(doc(db, 'users_public', userId), { role }, { merge: true }).catch(() => {});
      }

      setUsers(prev => prev.map(u => ((u.id || u.uid) === userId ? { ...u, role } : u)));
      showToast(language === 'ru' ? 'Роль пользователя обновлена' : 'User role updated', 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const handleToggleVerifiedBadge = async (u: any) => {
    const uid = u.id || u.uid;
    if (actualRole !== 'developer' && effectiveRole !== 'developer') {
      showToast(
        language === 'ru' ? 'Только разработчик может выдавать галочки!' : 'Only developer can grant verified badge!',
        'error'
      );
      return;
    }
    const nextVal = !u.isVerifiedAuthor;
    try {
      await setDoc(doc(db, 'users', uid), { isVerifiedAuthor: nextVal }, { merge: true });
      await setDoc(doc(db, 'users_public', uid), { isVerifiedAuthor: nextVal }, { merge: true }).catch(() => {});
      setUsers(prev => prev.map(item => ((item.id || item.uid) === uid ? { ...item, isVerifiedAuthor: nextVal } : item)));
      showToast(
        language === 'ru' ? (nextVal ? 'Галочка успешно выдана!' : 'Галочка снята') : 'Verified badge updated',
        'success'
      );
    } catch (e: any) {
      showToast(e.message || 'Failed to update verified badge', 'error');
    }
  };

  const handleVerifyRole = async (userId: string) => {
    if (actualRole !== 'developer' && actualRole !== 'admin') {
      showToast(language === 'ru' ? 'Только разработчик может верифицировать роли!' : 'Only developer can verify roles!', 'error');
      return;
    }
    try {
      const headers = await getAuthHeaders();
      let serverOk = false;
      try {
        const res = await fetch('/api/admin/verify-role', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            uid: userId,
            adminUid: userData?.uid,
            adminName: userData?.name || 'developer',
          }),
        });
        serverOk = res.ok;
      } catch (_) {}

      let clientOk = false;
      try {
        await setDoc(
          doc(db, 'users', userId),
          {
            roleVerification: 'Role is allowed by dev',
            roleVerifiedBy: userData?.name || 'developer',
            roleVerifiedAt: new Date().toISOString(),
            isBanned: false,
            banReason: null,
          },
          { merge: true }
        );

        await setDoc(
          doc(db, 'users_public', userId),
          {
            roleVerification: 'Role is allowed by dev',
            roleVerifiedBy: userData?.name || 'developer',
            roleVerifiedAt: new Date().toISOString(),
            isBanned: false,
            banReason: null,
          },
          { merge: true }
        );
        clientOk = true;
      } catch (_) {}

      if (!clientOk && !serverOk) {
        throw new Error(language === 'ru' ? 'Нет прав на подтверждение роли' : 'Permission denied verifying role');
      }

      setUsers(prev =>
        prev.map(u => ((u.id || u.uid) === userId ? { ...u, roleVerification: 'Role is allowed by dev', isBanned: false, banReason: null } : u))
      );
      showToast(
        language === 'ru' ? "Роль подтверждена! Назначена отметка 'Role is allowed by dev'" : "Role verified! Added 'Role is allowed by dev'",
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to verify role', 'error');
    }
  };

  const handleDeleteApp = async (appId: string, appTitle: string) => {
    const confirmed = await confirmAction({
      title: language === 'ru' ? 'Удаление проекта' : 'Delete Project',
      message: language === 'ru' ? `Удалить проект "${appTitle}" навсегда?` : `Permanently delete app "${appTitle}"?`,
      confirmText: language === 'ru' ? 'Удалить' : 'Delete',
      cancelText: language === 'ru' ? 'Отмена' : 'Cancel',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      let clientOk = false;
      let serverOk = false;
      let lastError: any = null;

      try {
        await deleteDoc(doc(db, 'apps', appId));
        clientOk = true;
      } catch (err: any) {
        lastError = err;
        console.warn('Client deleteDoc(apps) failed:', err?.message || err);
      }

      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/admin/delete-app', {
          method: 'POST',
          headers,
          body: JSON.stringify({ appId }),
        });
        if (res.ok) {
          serverOk = true;
        } else {
          const data = await res.json().catch(() => ({}));
          if (!lastError) lastError = new Error(data.error || `Server error (${res.status})`);
        }
      } catch (err: any) {
        if (!lastError) lastError = err;
      }

      if (!clientOk && !serverOk) {
        throw lastError || new Error(language === 'ru' ? 'Не удалось удалить проект (нет прав)' : 'Failed to delete app');
      }

      try {
        const reqsRef = collection(db, 'adminRequests');
        const q = query(reqsRef, where('targetId', '==', appId));
        const qSnap = await getDocs(q);
        await Promise.all(qSnap.docs.map(d => deleteDoc(d.ref).catch(() => {})));
      } catch (_) {}

      setApps(prev => prev.filter(a => a.id !== appId));
      showToast(language === 'ru' ? `Проект "${appTitle}" удален` : `App "${appTitle}" deleted`, 'success');
    } catch (err: any) {
      console.error('Delete app error:', err);
      showToast(err.message || 'Error deleting app', 'error');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    const confirmed = await confirmAction({
      title: language === 'ru' ? 'Удаление аккаунта' : 'Delete Account',
      message: language === 'ru' ? `Удалить аккаунт "${userName}" навсегда?` : `Permanently delete account "${userName}"?`,
      confirmText: language === 'ru' ? 'Удалить' : 'Delete',
      cancelText: language === 'ru' ? 'Отмена' : 'Cancel',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      let clientOk = false;
      let serverOk = false;
      let lastError: any = null;

      try {
        await deleteDoc(doc(db, 'users', userId));
        await deleteDoc(doc(db, 'users_public', userId)).catch(() => {});
        clientOk = true;
      } catch (err: any) {
        lastError = err;
        console.warn('Client deleteDoc(users) failed:', err?.message || err);
      }

      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/admin/delete-user', {
          method: 'POST',
          headers,
          body: JSON.stringify({ userId }),
        });
        if (res.ok) {
          serverOk = true;
        } else {
          const data = await res.json().catch(() => ({}));
          if (!lastError) lastError = new Error(data.error || `Server error (${res.status})`);
        }
      } catch (err: any) {
        if (!lastError) lastError = err;
      }

      if (!clientOk && !serverOk) {
        throw lastError || new Error(language === 'ru' ? 'Не удалось удалить пользователя' : 'Failed to delete user');
      }

      setUsers(prev => prev.filter(u => (u.id || u.uid) !== userId));
      showToast(language === 'ru' ? `Пользователь "${userName}" удален` : `User "${userName}" deleted`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error deleting user', 'error');
    }
  };

  const handleExecuteBan = async () => {
    if (!banModalUser) return;
    const uid = banModalUser.id || banModalUser.uid;
    const reason =
      banReasonInput.trim() || (language === 'ru' ? 'Нарушение правил сообщества' : 'Violation of community terms');
    try {
      let clientOk = false;
      let serverOk = false;
      let lastError: any = null;

      try {
        await setDoc(doc(db, 'users', uid), { isBanned: true, banReason: reason }, { merge: true });
        await setDoc(doc(db, 'users_public', uid), { isBanned: true, banReason: reason }, { merge: true }).catch(() => {});
        clientOk = true;
      } catch (err: any) {
        lastError = err;
        console.warn('Client ban setDoc failed:', err?.message || err);
      }

      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/admin/ban', {
          method: 'POST',
          headers,
          body: JSON.stringify({ userId: uid, isBanned: true, reason }),
        });
        if (res.ok) {
          serverOk = true;
        } else {
          const data = await res.json().catch(() => ({}));
          if (!lastError) lastError = new Error(data.error || `Server error (${res.status})`);
        }
      } catch (err: any) {
        if (!lastError) lastError = err;
      }

      if (!clientOk && !serverOk) {
        throw lastError || new Error(language === 'ru' ? 'Не удалось заблокировать пользователя' : 'Failed to ban user');
      }

      setUsers(prev => prev.map(u => ((u.id || u.uid) === uid ? { ...u, isBanned: true, banReason: reason } : u)));
      showToast(
        language === 'ru' ? `Пользователь ${banModalUser.name || 'User'} заблокирован` : `User ${banModalUser.name || 'User'} has been banned`,
        'success'
      );
    } catch (e: any) {
      console.error('Ban error:', e);
      showToast(e?.message || (language === 'ru' ? 'Ошибка при блокировке пользователя' : 'Error banning user'), 'error');
    } finally {
      setBanModalUser(null);
      setBanReasonInput('');
    }
  };

  const handleExecuteUnban = async () => {
    if (!unbanModalUser) return;
    const uid = unbanModalUser.id || unbanModalUser.uid;
    try {
      let clientOk = false;
      let serverOk = false;
      let lastError: any = null;

      try {
        await setDoc(doc(db, 'users', uid), { isBanned: false, banReason: null }, { merge: true });
        await setDoc(doc(db, 'users_public', uid), { isBanned: false, banReason: null }, { merge: true }).catch(() => {});
        clientOk = true;
      } catch (err: any) {
        lastError = err;
        console.warn('Client unban setDoc failed:', err?.message || err);
      }

      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/admin/ban', {
          method: 'POST',
          headers,
          body: JSON.stringify({ userId: uid, isBanned: false, reason: null }),
        });
        if (res.ok) {
          serverOk = true;
        } else {
          const data = await res.json().catch(() => ({}));
          if (!lastError) lastError = new Error(data.error || `Server error (${res.status})`);
        }
      } catch (err: any) {
        if (!lastError) lastError = err;
      }

      if (!clientOk && !serverOk) {
        throw lastError || new Error(language === 'ru' ? 'Не удалось разблокировать пользователя' : 'Failed to unban user');
      }

      setUsers(prev => prev.map(u => ((u.id || u.uid) === uid ? { ...u, isBanned: false, banReason: null } : u)));
      showToast(
        language === 'ru'
          ? `Пользователь ${unbanModalUser.name || 'User'} разблокирован`
          : `User ${unbanModalUser.name || 'User'} has been unbanned`,
        'success'
      );
    } catch (e: any) {
      console.error('Unban error:', e);
      showToast(e?.message || (language === 'ru' ? 'Ошибка при разблокировке пользователя' : 'Error unbanning user'), 'error');
    } finally {
      setUnbanModalUser(null);
    }
  };

  const handleUpdateUserPermissions = async (userId: string) => {
    if (actualRole !== 'developer' && actualRole !== 'admin') {
      showToast(language === 'ru' ? 'Недостаточно прав!' : 'Insufficient permissions!', 'error');
      return;
    }
    const permissions = localPermissions[userId];
    if (!permissions) return;

    setSaving(userId);
    try {
      await updateDoc(doc(db, 'users', userId), { permissions });
      showToast(language === 'ru' ? 'Изменения сохранены!' : 'Changes saved!', 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    } finally {
      setSaving(null);
    }
  };

  const handleGiveCoins = async (userId: string, amount: number) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/give-coins', {
        method: 'POST',
        headers,
        body: JSON.stringify({ uid: userId, amount, adminUid: userData?.uid }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to give coins');
      }
      setUsers(prev => prev.map(u => ((u.id || u.uid) === userId ? { ...u, eplCoins: (u.eplCoins || 0) + amount } : u)));
      showToast(language === 'ru' ? `Монеты выданы: ${amount}` : `Coins given: ${amount}`, 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const handleGenerateCode = async () => {
    if (!userData?.uid) {
      showToast(language === 'ru' ? 'Ошибка: пользователь не авторизован' : 'Error: User not authenticated', 'error');
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/premium/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ adminUid: userData.uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate code');

      const newEntry = {
        id: data.id || data.code,
        code: data.code,
        used: false,
        createdAt: new Date().toISOString(),
        createdBy: userData.uid,
      };
      await setDoc(doc(db, 'premiumCodes', newEntry.id), newEntry, { merge: true }).catch(() => {});
      setPremiumCodes(prev => {
        if (prev.some(c => c.code === data.code || c.id === newEntry.id)) return prev;
        return [newEntry, ...prev];
      });
      setPremiumCode(data.code);
      showToast(language === 'ru' ? `Новый код сгенерирован: ${data.code}` : `New code generated: ${data.code}`, 'success');
    } catch (error: any) {
      console.error('Error generating premium code:', error);
      showToast(error.message || 'Error generating premium code', 'error');
    }
  };

  if (!userData) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#262B33] border-t-[#10B981]" />
      </div>
    );
  }

  if (userData.role !== 'developer' && effectiveRole !== 'admin' && effectiveRole !== 'moderator') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <ShieldCheck className="w-14 h-14 text-red-500 mb-3 opacity-70" />
        <h2 className="text-xl font-bold mb-1 text-red-400">Access Denied</h2>
        <p className="text-sm text-[#9CA3AF]">You do not have permission to view this page.</p>
      </div>
    );
  }

  const filteredUsers = users.filter(
    u => u.email?.toLowerCase().includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase())
  );

  const rejectedCount = apps.filter(a => a.moderationStatus === 'rejected' || a.status === 'rejected').length;

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-[#262B33]/60">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-2 rounded-lg bg-[#10B981]/15 border border-[#10B981]/30">
              <ShieldCheck className="w-5 h-5 text-[#10B981]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className={clsx('text-xl font-bold tracking-tight', isFrutigerAero ? 'text-blue-900' : isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>
                  Control Panel
                </h1>
                {simulatedRole && (
                  <span className="text-[11px] px-2 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-md font-semibold uppercase tracking-wider">
                    {t.simulationActive}: {simulatedRole}
                  </span>
                )}
              </div>
              <p className={clsx('text-xs', isFrutigerAero ? 'text-blue-800/70' : 'text-[#9CA3AF]')}>
                Platform security console, moderation engine, roles & asset governance
              </p>
            </div>
          </div>

          {userData.role === 'developer' && (
            <div className="flex flex-wrap gap-1.5">
              {[
                { role: 'moderator', label: t.moderatorMode },
                { role: 'admin', label: t.adminMode },
                { role: 'user', label: t.userMode },
                { role: 'shopkeeper', label: t.shopkeeperMode },
              ].map(mode => (
                <button
                  key={mode.role}
                  onClick={() => setSimulatedRole(simulatedRole === mode.role ? null : (mode.role as any))}
                  className={clsx(
                    'px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                    simulatedRole === mode.role
                      ? 'bg-[#10B981] border-[#10B981] text-[#0A0C0E]'
                      : isLight
                        ? 'bg-white border-[#E2E5EA] text-[#525866] hover:text-[#111315]'
                        : 'bg-[#181B20] border-[#262B33] text-[#9CA3AF] hover:text-[#F3F4F6]'
                  )}
                >
                  {mode.label}
                </button>
              ))}
              {simulatedRole && (
                <button
                  onClick={() => setSimulatedRole(null)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {t.developerMode}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Main Navigation Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
          {isDeveloper && (
            <button
              onClick={() => setActiveTab('moderation')}
              className={clsx(
                'px-3.5 py-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer',
                activeTab === 'moderation'
                  ? 'bg-[#10B981] border-[#10B981] text-[#0A0C0E]'
                  : isLight
                    ? 'bg-white border-[#E2E5EA] text-[#525866] hover:text-[#111315]'
                    : 'bg-[#181B20] border-[#262B33] text-[#9CA3AF] hover:text-[#F3F4F6]'
              )}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{language === 'ru' ? 'Модерация ИИ' : 'AI Moderation'}</span>
              {rejectedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded font-mono-num text-[10px] font-bold bg-red-500 text-white">
                  {rejectedCount}
                </span>
              )}
            </button>
          )}

          {[
            { id: 'apps', label: t.appVerification || 'App Verification', show: true },
            { id: 'users', label: t.userManagement || 'User Management', show: true },
            { id: 'assets', label: t.assetStoreManagement || 'Asset Store', show: effectiveRole === 'admin' || effectiveRole === 'developer' },
            { id: 'roles', label: t.roleControl || 'Role Control', show: effectiveRole === 'developer' || effectiveRole === 'admin' },
            { id: 'premium', label: language === 'ru' ? 'Премиум коды' : 'Premium Codes', show: effectiveRole === 'developer' || effectiveRole === 'admin' },
            { id: 'requests', label: language === 'ru' ? 'Запросы' : 'Sent Requests', show: true },
          ]
            .filter(tab => tab.show)
            .map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={clsx(
                  'px-3.5 py-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                  activeTab === tab.id
                    ? 'bg-[#10B981] border-[#10B981] text-[#0A0C0E]'
                    : isLight
                      ? 'bg-white border-[#E2E5EA] text-[#525866] hover:text-[#111315]'
                      : 'bg-[#181B20] border-[#262B33] text-[#9CA3AF] hover:text-[#F3F4F6]'
                )}
              >
                {tab.label}
              </button>
            ))}

          {(effectiveRole === 'developer' || effectiveRole === 'admin' || effectiveRole === 'moderator') && (
            <button
              onClick={() => setActiveTab('ai-help')}
              className={clsx(
                'px-3.5 py-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer',
                activeTab === 'ai-help'
                  ? 'bg-[#10B981] border-[#10B981] text-[#0A0C0E]'
                  : isLight
                    ? 'bg-white border-[#E2E5EA] text-[#525866] hover:text-[#111315]'
                    : 'bg-[#181B20] border-[#262B33] text-[#9CA3AF] hover:text-[#F3F4F6]'
              )}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Ai Help</span>
              <span
                className={clsx(
                  'px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase tracking-wider border',
                  activeTab === 'ai-help'
                    ? 'bg-black/15 border-black/25 text-[#0A0C0E]'
                    : 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
                )}
              >
                Security
              </span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#262B33] border-t-[#10B981]" />
          </div>
        ) : activeTab === 'moderation' ? (
          <div className="space-y-5">
            {/* Hourly AI Moderation Engine Status Card */}
            <div className={clsx(cardClass, 'p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4')}>
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={clsx('font-bold text-base', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>
                      {language === 'ru' ? 'ИИ Модератор: Почасовая проверка' : 'AI Moderator: Hourly Scan'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                      {language === 'ru' ? 'Каждый 1 час' : 'Every 1 hour'}
                    </span>
                  </div>
                  <p className="text-xs text-[#9CA3AF] mt-1">
                    {language === 'ru'
                      ? 'ИИ автоматически проверяет все проекты и пользователей каждый час. Аккаунты с ролями без галочки Verified / "Role is allowed by dev" блокируются.'
                      : 'AI automatically scans projects and users hourly. Unverified elevated accounts without "Role is allowed by dev" are banned.'}
                  </p>
                  <div className="flex flex-wrap gap-4 text-xs text-[#9CA3AF] mt-2 font-mono-num">
                    {hourlyStatus?.lastRunTime && (
                      <span>
                        {language === 'ru' ? 'Последняя проверка: ' : 'Last check: '}
                        <strong className={isLight ? 'text-[#111315]' : 'text-[#F3F4F6]'}>
                          {new Date(hourlyStatus.lastRunTime).toLocaleTimeString()}
                        </strong>
                      </span>
                    )}
                    {hourlyStatus?.nextRunTime && (
                      <span>
                        {language === 'ru' ? 'Следующая проверка: ' : 'Next check: '}
                        <strong className="text-[#10B981]">{new Date(hourlyStatus.nextRunTime).toLocaleTimeString()}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={handleTriggerHourly}
                disabled={isTriggeringHourly}
                className={clsx(
                  'px-4 py-2.5 rounded-lg font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0',
                  isTriggeringHourly ? 'bg-[#262B33] text-[#6B7280] cursor-not-allowed' : 'bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E]'
                )}
              >
                <RefreshCw className={clsx('w-3.5 h-3.5', isTriggeringHourly && 'animate-spin')} />
                <span>
                  {isTriggeringHourly
                    ? language === 'ru'
                      ? 'Проверка...'
                      : 'Checking...'
                    : language === 'ru'
                      ? 'Запустить проверку ИИ сейчас'
                      : 'Run Hourly AI Check Now'}
                </span>
              </button>
            </div>

            {/* Sub-tab Navigation for AI Moderation: Projects vs Users */}
            <div className={clsx('inline-flex items-center gap-1.5 p-1 rounded-lg border', subSurfaceClass)}>
              <button
                type="button"
                onClick={() => setModerationSubTab('projects')}
                className={clsx(
                  'px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap',
                  moderationSubTab === 'projects'
                    ? 'bg-[#10B981] text-[#0A0C0E]'
                    : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                )}
              >
                <span>{language === 'ru' ? 'Модерация Проектов' : 'Projects Moderation'}</span>
                <span className={clsx('px-1.5 py-0.2 rounded font-mono-num text-[10px]', moderationSubTab === 'projects' ? 'bg-black/15 text-[#0A0C0E]' : 'bg-[#262B33] text-[#9CA3AF]')}>
                  {apps.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setModerationSubTab('users')}
                className={clsx(
                  'px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap',
                  moderationSubTab === 'users'
                    ? 'bg-[#10B981] text-[#0A0C0E]'
                    : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                )}
              >
                <span>{language === 'ru' ? 'Модерация Пользователей' : 'Users Moderation'}</span>
                {users.filter(u => u.isBanned).length > 0 && (
                  <span className="px-1.5 py-0.2 rounded font-mono-num text-[10px] bg-red-500 text-white font-bold">
                    {users.filter(u => u.isBanned).length}
                  </span>
                )}
              </button>
            </div>

            {moderationSubTab === 'projects' ? (
              <div className="space-y-5">
                {/* Summary Panel */}
                <div className={clsx(cardClass, 'p-5')}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                        <h2 className={clsx('text-base font-bold', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>
                          {language === 'ru' ? 'ИИ Модерация проектов' : 'AI Project Moderation'}
                        </h2>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                          Safety Filter Active
                        </span>
                      </div>
                      <p className="text-xs text-[#9CA3AF] max-w-2xl">
                        {language === 'ru'
                          ? 'Опубликованные проекты анализируются на 18+ контент, ненормативную лексику, вредоносный код и попытки взлома. Можно просмотреть код, одобрить или отклонить вручную.'
                          : 'Published projects are scanned for adult content, profanity, exploits, and malicious code. Staff can inspect code and manually approve or reject.'}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        const headers = await getAuthHeaders();
                        fetch('/api/admin/moderation-logs', { headers })
                          .then(r => r.json())
                          .then(d => {
                            if (Array.isArray(d.logs)) setModerationLogs(d.logs);
                            showToast(language === 'ru' ? 'Логи обновлены' : 'Logs refreshed');
                          })
                          .catch(() => {});
                      }}
                      className={clsx(
                        'flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0',
                        subSurfaceClass,
                        'text-[#9CA3AF] hover:text-[#F3F4F6]'
                      )}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {language === 'ru' ? 'Обновить логи' : 'Refresh Data'}
                    </button>
                  </div>

                  {/* Stat Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    <div className={clsx(subSurfaceClass, 'p-3.5')}>
                      <div className="text-[11px] text-[#9CA3AF] font-medium">{language === 'ru' ? 'Всего проектов' : 'Total Projects'}</div>
                      <div className={clsx('text-xl font-mono-num font-bold mt-1', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>{apps.length}</div>
                    </div>
                    <div className="p-3.5 rounded-lg border bg-[#10B981]/10 border-[#10B981]/25">
                      <div className="text-[11px] text-[#10B981] font-medium">{language === 'ru' ? 'Одобрено ИИ' : 'Approved by AI'}</div>
                      <div className="text-xl font-mono-num font-bold mt-1 text-[#10B981]">
                        {apps.filter(a => a.moderationStatus === 'approved' || a.status === 'verified').length}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg border bg-red-500/10 border-red-500/25">
                      <div className="text-[11px] text-red-400 font-medium">{language === 'ru' ? 'Заблокировано ИИ' : 'Blocked by AI'}</div>
                      <div className="text-xl font-mono-num font-bold mt-1 text-red-400">{rejectedCount}</div>
                    </div>
                    <div className="p-3.5 rounded-lg border bg-amber-500/10 border-amber-500/25">
                      <div className="text-[11px] text-amber-400 font-medium">{language === 'ru' ? 'На проверке' : 'Pending Review'}</div>
                      <div className="text-xl font-mono-num font-bold mt-1 text-amber-400">
                        {apps.filter(a => a.moderationStatus === 'pending' || a.status === 'pending').length}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 border-b border-[#262B33]/60 pb-3 overflow-x-auto no-scrollbar">
                  {[
                    { key: 'all', label: language === 'ru' ? 'Все проекты' : 'All Projects', count: apps.length },
                    { key: 'rejected', label: language === 'ru' ? 'Отклоненные' : 'Rejected', count: rejectedCount },
                    {
                      key: 'approved',
                      label: language === 'ru' ? 'Одобренные' : 'Approved',
                      count: apps.filter(a => a.moderationStatus === 'approved' || a.status === 'verified').length,
                    },
                    {
                      key: 'pending',
                      label: language === 'ru' ? 'Ожидают' : 'Pending',
                      count: apps.filter(a => a.moderationStatus === 'pending' || a.status === 'pending').length,
                    },
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setModerationFilter(f.key as any)}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap',
                        moderationFilter === f.key
                          ? 'bg-[#10B981] border-[#10B981] text-[#0A0C0E]'
                          : isLight
                            ? 'bg-white border-[#E2E5EA] text-[#525866]'
                            : 'bg-[#181B20] border-[#262B33] text-[#9CA3AF] hover:text-[#F3F4F6]'
                      )}
                    >
                      <span>{f.label}</span>
                      <span
                        className={clsx(
                          'px-1.5 py-0.2 rounded font-mono-num text-[10px]',
                          moderationFilter === f.key ? 'bg-black/15 text-[#0A0C0E]' : 'bg-[#111315] text-[#9CA3AF]'
                        )}
                      >
                        {f.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Apps List */}
                <div className="space-y-3">
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
                            'p-5 rounded-xl border transition-colors',
                            isRejected
                              ? 'bg-red-950/15 border-red-900/40'
                              : isApproved
                                ? cardClass
                                : 'bg-amber-950/15 border-amber-900/40'
                          )}
                        >
                          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                            <div className="space-y-2 flex-1 min-w-0">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className={clsx('font-bold text-base', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>{app.title}</h3>
                                {isRejected ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
                                    <ShieldAlert className="w-3.5 h-3.5" />
                                    {language === 'ru' ? 'Заблокировано ИИ' : 'Blocked by AI'}
                                  </span>
                                ) : isApproved ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    {language === 'ru' ? 'Одобрено ИИ' : 'Approved by AI'}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    {language === 'ru' ? 'Ожидает' : 'Pending Review'}
                                  </span>
                                )}
                                <span className={clsx('text-[11px] px-2 py-0.5 rounded border', subSurfaceClass, 'text-[#9CA3AF]')}>
                                  {app.category || 'Game'}
                                </span>
                              </div>

                              <p className="text-xs text-[#9CA3AF]">
                                {language === 'ru' ? 'Автор:' : 'Author:'} <span className={clsx('font-semibold', isLight ? 'text-[#111315]' : 'text-[#D1D5DB]')}>{app.authorName}</span>
                                {app.createdAt ? ` • ${new Date(app.createdAt).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US')}` : ''}
                              </p>

                              <div
                                className={clsx(
                                  'p-3 rounded-lg border text-xs space-y-1.5',
                                  isRejected ? 'bg-red-950/25 border-red-900/40 text-red-200' : subSurfaceClass
                                )}
                              >
                                <div className="flex items-center gap-1.5 font-semibold text-[#10B981]">
                                  <Shield className="w-3.5 h-3.5" />
                                  <span>{language === 'ru' ? 'Вердикт безопасности ИИ:' : 'Security AI Verdict:'}</span>
                                </div>
                                <p className={clsx('leading-relaxed', isLight && !isRejected ? 'text-[#374151]' : 'text-[#D1D5DB]')}>
                                  {app.moderationReason ||
                                    (isRejected ? 'Заблокировано автоматической системой безопасности' : 'Проект прошел проверку ИИ, нарушений не найдено')}
                                </p>

                                {app.moderationFlags && app.moderationFlags.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 pt-1">
                                    {app.moderationFlags.map((flag: string) => {
                                      let label = flag;
                                      if (flag === 'hack_attempt') label = language === 'ru' ? 'Попытка взлома' : 'Hack attempt';
                                      if (flag === 'nsfw_18+') label = language === 'ru' ? '18+ Контент' : 'Adult content';
                                      if (flag === 'profanity') label = language === 'ru' ? 'Ненормативная лексика' : 'Profanity';
                                      if (flag === 'exploit') label = language === 'ru' ? 'Эксплойт' : 'Exploit';
                                      if (flag === 'destructive_code') label = language === 'ru' ? 'Вредоносный код' : 'Destructive code';
                                      return (
                                        <span key={flag} className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                                          {label}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setViewingCodeApp({ title: app.title, code: app.code, authorName: app.authorName })}
                                className={clsx(
                                  'px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap',
                                  subSurfaceClass,
                                  isLight ? 'text-[#111315] hover:bg-zinc-200' : 'text-[#D1D5DB] hover:bg-[#22262E]'
                                )}
                              >
                                <FileCode className="w-3.5 h-3.5 text-[#10B981]" />
                                {language === 'ru' ? 'Просмотр кода' : 'View Code'}
                              </button>

                              <button
                                type="button"
                                disabled={isRescanning === app.id}
                                onClick={() => handleRescanWithAi(app)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#10B981] border border-[#10B981]/30 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                              >
                                <RefreshCw className={clsx('w-3.5 h-3.5', isRescanning === app.id && 'animate-spin')} />
                                {isRescanning === app.id
                                  ? language === 'ru'
                                    ? 'ИИ сканирует...'
                                    : 'Scanning...'
                                  : language === 'ru'
                                    ? 'Перепроверить ИИ'
                                    : 'Re-check AI'}
                              </button>

                              {!isApproved && (
                                <button
                                  type="button"
                                  onClick={() => handleManualApprove(app.id, app.title)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  {language === 'ru' ? 'Одобрить' : 'Approve'}
                                </button>
                              )}

                              {!isRejected && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setManualRejectApp(app);
                                    setManualRejectReasonInput(app.moderationReason || '');
                                  }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  {language === 'ru' ? 'Отклонить' : 'Reject'}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDeleteApp(app.id, app.title)}
                                className={clsx(
                                  'px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap',
                                  subSurfaceClass,
                                  'text-[#9CA3AF] hover:text-red-400 hover:border-red-500/40'
                                )}
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
                    <div className="text-center p-10 text-sm text-[#9CA3AF]">
                      {language === 'ru' ? 'Нет доступных проектов для модерации' : 'No projects available for moderation'}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* User Moderation Header */}
                <div className={clsx(cardClass, 'p-5')}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <Users className="w-4 h-4 text-[#10B981]" />
                        <h2 className={clsx('text-base font-bold', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>
                          {language === 'ru' ? 'ИИ Модерация пользователей' : 'AI User Profile Moderation'}
                        </h2>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                          Automatic Account Enforcement
                        </span>
                      </div>
                      <p className="text-xs text-[#9CA3AF] max-w-2xl">
                        {language === 'ru'
                          ? 'ИИ проверяет имена, био и роли пользователей на 18+ контент, оскорбления, дефейс и наличие галочки Verified / "Role is allowed by dev".'
                          : 'AI scans usernames, bios, and roles for adult content, insults, defacement, and Verified / "Role is allowed by dev" authorization.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isScanningAllUsers || users.length === 0}
                      onClick={handleScanAllUsersWithAi}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      <RefreshCw className={clsx('w-3.5 h-3.5', isScanningAllUsers && 'animate-spin')} />
                      <span>
                        {isScanningAllUsers
                          ? language === 'ru'
                            ? 'ИИ сканирует всех...'
                            : 'Scanning All...'
                          : language === 'ru'
                            ? 'Перепроверить всех ИИ'
                            : 'Scan All Users with AI'}
                      </span>
                    </button>
                  </div>

                  {/* Stat Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    <div className={clsx(subSurfaceClass, 'p-3.5')}>
                      <div className="text-[11px] text-[#9CA3AF] font-medium">{language === 'ru' ? 'Всего пользователей' : 'Total Users'}</div>
                      <div className={clsx('text-xl font-mono-num font-bold mt-1', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>{users.length}</div>
                    </div>
                    <div className="p-3.5 rounded-lg border bg-red-500/10 border-red-500/25">
                      <div className="text-[11px] text-red-400 font-medium">{language === 'ru' ? 'Забанено ИИ' : 'Banned'}</div>
                      <div className="text-xl font-mono-num font-bold mt-1 text-red-400">{users.filter(u => u.isBanned).length}</div>
                    </div>
                    <div className="p-3.5 rounded-lg border bg-[#10B981]/10 border-[#10B981]/25">
                      <div className="text-[11px] text-[#10B981] font-medium">{language === 'ru' ? 'Проверено ИИ' : 'Approved'}</div>
                      <div className="text-xl font-mono-num font-bold mt-1 text-[#10B981]">
                        {users.filter(u => !u.isBanned && u.moderationStatus === 'approved').length}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg border bg-amber-500/10 border-amber-500/25">
                      <div className="text-[11px] text-amber-400 font-medium">{language === 'ru' ? 'С галочкой Verified' : 'Verified Badges'}</div>
                      <div className="text-xl font-mono-num font-bold mt-1 text-amber-400">{users.filter(u => u.isVerifiedAuthor).length}</div>
                    </div>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-[#262B33]/60 pb-3">
                  <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {[
                      { key: 'all', label: language === 'ru' ? 'Все' : 'All Users', count: users.length },
                      { key: 'banned', label: language === 'ru' ? 'Забаненные' : 'Banned', count: users.filter(u => u.isBanned).length },
                      {
                        key: 'clean',
                        label: language === 'ru' ? 'Проверенные' : 'Approved',
                        count: users.filter(u => !u.isBanned && u.moderationStatus === 'approved').length,
                      },
                      {
                        key: 'flagged',
                        label: language === 'ru' ? 'С флажками' : 'Flagged',
                        count: users.filter(u => u.moderationFlags && u.moderationFlags.length > 0).length,
                      },
                    ].map(f => (
                      <button
                        key={f.key}
                        onClick={() => setUserModerationFilter(f.key as any)}
                        className={clsx(
                          'px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap',
                          userModerationFilter === f.key
                            ? 'bg-[#10B981] border-[#10B981] text-[#0A0C0E]'
                            : isLight
                              ? 'bg-white border-[#E2E5EA] text-[#525866]'
                              : 'bg-[#181B20] border-[#262B33] text-[#9CA3AF] hover:text-[#F3F4F6]'
                        )}
                      >
                        <span>{f.label}</span>
                        <span
                          className={clsx(
                            'px-1.5 py-0.2 rounded font-mono-num text-[10px]',
                            userModerationFilter === f.key ? 'bg-black/15 text-[#0A0C0E]' : 'bg-[#111315] text-[#9CA3AF]'
                          )}
                        >
                          {f.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="relative min-w-[220px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" />
                    <input
                      type="text"
                      placeholder={language === 'ru' ? 'Поиск по имени или email...' : 'Search by name or email...'}
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className={clsx(inputClass, 'w-full pl-9 pr-3 py-1.5 text-xs')}
                    />
                  </div>
                </div>

                {/* User Moderation List */}
                <div className="space-y-3">
                  {users
                    .filter(u => {
                      const matchesSearch =
                        !userSearchQuery ||
                        u.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                        u.email?.toLowerCase().includes(userSearchQuery.toLowerCase());
                      if (!matchesSearch) return false;
                      if (userModerationFilter === 'banned') return u.isBanned;
                      if (userModerationFilter === 'clean') return !u.isBanned && u.moderationStatus === 'approved';
                      if (userModerationFilter === 'flagged') return u.moderationFlags && u.moderationFlags.length > 0;
                      return true;
                    })
                    .map(u => {
                      const uid = u.id || u.uid;
                      const isScanning = scanningUserId === uid;
                      return (
                        <div
                          key={uid}
                          className={clsx('p-5 rounded-xl border transition-colors', u.isBanned ? 'bg-red-950/15 border-red-900/40' : cardClass)}
                        >
                          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                            <div className="flex items-start gap-3.5 flex-1 min-w-0">
                              <img
                                src={u.photoUrl || u.avatarUrl || getDefaultAvatar(uid)}
                                alt=""
                                className="w-11 h-11 rounded-lg object-cover bg-[#111315] border border-[#262B33] shrink-0"
                              />
                              <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {u.isVerifiedAuthor && <VerifiedBadge size="sm" />}
                                  <h3 className={clsx('font-bold text-sm', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>{u.name || 'User'}</h3>
                                  <UserRoleBadge role={u.role} isVerifiedAuthor={u.isVerifiedAuthor} size="xs" showLabel />

                                  {u.isBanned ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
                                      <Ban className="w-3 h-3" />
                                      {language === 'ru' ? 'ЗАБАНЕН' : 'BANNED'}
                                    </span>
                                  ) : u.moderationStatus === 'approved' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                                      <CheckCircle className="w-3 h-3" />
                                      {language === 'ru' ? 'Проверен ИИ' : 'AI Verified'}
                                    </span>
                                  ) : null}
                                </div>

                                <p className="text-xs text-[#9CA3AF] flex items-center gap-2 flex-wrap">
                                  <span>{u.email}</span>
                                  <span>•</span>
                                  <span className="font-mono-num">
                                    <Coins className="w-3 h-3 inline text-amber-400 mr-1" />
                                    {u.eplCoins || 0}
                                  </span>
                                </p>

                                {u.bio && (
                                  <p className={clsx('text-xs italic px-3 py-1.5 rounded-lg border', subSurfaceClass, 'text-[#9CA3AF]')}>
                                    "{u.bio}"
                                  </p>
                                )}

                                <div
                                  className={clsx(
                                    'p-3 rounded-lg border text-xs space-y-1',
                                    u.isBanned ? 'bg-red-950/25 border-red-900/40 text-red-200' : subSurfaceClass
                                  )}
                                >
                                  <div className="flex items-center gap-1.5 font-semibold text-[#10B981]">
                                    <Shield className="w-3.5 h-3.5" />
                                    <span>{language === 'ru' ? 'Вердикт безопасности:' : 'Security Verdict:'}</span>
                                  </div>
                                  <p className={clsx('leading-relaxed', isLight && !u.isBanned ? 'text-[#374151]' : 'text-[#D1D5DB]')}>
                                    {u.banReason ||
                                      u.moderationReason ||
                                      (u.isBanned ? 'Заблокирован автоматической системой безопасности' : 'Нарушений в профиле не обнаружено')}
                                  </p>
                                  {u.moderationFlags && u.moderationFlags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                      {u.moderationFlags.map((flag: string) => (
                                        <span key={flag} className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                                          {flag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
                              <button
                                type="button"
                                disabled={isScanning}
                                onClick={() => handleScanUserWithAi(u)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#10B981] border border-[#10B981]/30 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                              >
                                <RefreshCw className={clsx('w-3.5 h-3.5', isScanning && 'animate-spin')} />
                                {isScanning ? (language === 'ru' ? 'Сканирование...' : 'Scanning...') : language === 'ru' ? 'Сканировать ИИ' : 'Scan AI'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleVerifiedBadge(u)}
                                className={clsx(
                                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 border whitespace-nowrap',
                                  u.isVerifiedAuthor
                                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30'
                                    : clsx(subSurfaceClass, 'text-[#9CA3AF] hover:text-[#F3F4F6]')
                                )}
                              >
                                <BadgeCheck className="w-3.5 h-3.5 text-blue-400" />
                                {language === 'ru' ? (u.isVerifiedAuthor ? 'Галочка выдана' : 'Выдать галочку') : u.isVerifiedAuthor ? 'Verified' : 'Grant Badge'}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (u.isBanned) {
                                    setUnbanModalUser(u);
                                  } else {
                                    setBanModalUser(u);
                                    setBanReasonInput('');
                                  }
                                }}
                                className={clsx(
                                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 border whitespace-nowrap',
                                  u.isBanned
                                    ? 'bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E] border-[#10B981]'
                                    : 'bg-red-500/15 hover:bg-red-600 text-red-400 hover:text-white border-red-500/30'
                                )}
                              >
                                <Ban className="w-3.5 h-3.5" />
                                {u.isBanned ? (language === 'ru' ? 'Разбанить' : 'Unban') : language === 'ru' ? 'Забанить' : 'Ban User'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteUser(uid, u.name || u.email || 'User')}
                                className={clsx(
                                  'px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap',
                                  subSurfaceClass,
                                  'text-[#9CA3AF] hover:text-red-400 hover:border-red-500/40'
                                )}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                {language === 'ru' ? 'Удалить' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {users.length === 0 && (
                    <div className="text-center p-10 text-sm text-[#9CA3AF]">
                      {language === 'ru' ? 'Пользователи не найдены' : 'No users found'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI Moderation Audit Logs Section */}
            <div className="pt-5 border-t border-[#262B33]/60">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                  <h3 className={clsx('font-bold text-sm', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>
                    {language === 'ru' ? 'Журнал проверок ИИ (Audit Logs)' : 'AI Audit Logs'}
                  </h3>
                </div>
                <span className="text-xs font-mono-num text-[#9CA3AF]">
                  {moderationLogs.length} {language === 'ru' ? 'записей' : 'records'}
                </span>
              </div>

              <div className="space-y-2">
                {moderationLogs.slice(0, 15).map((log: any) => (
                  <div
                    key={log.id}
                    className={clsx(
                      'p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                      !log.approved ? 'bg-red-950/20 border-red-900/40 text-red-200' : cardClass
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={clsx(
                            'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                            log.approved ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          )}
                        >
                          {log.approved ? 'APPROVED' : 'REJECTED'}
                        </span>
                        <span className={clsx('font-bold', isLight && log.approved ? 'text-[#111315]' : 'text-[#F3F4F6]')}>{log.appTitle}</span>
                        <span className="text-[#9CA3AF]">by {log.authorName}</span>
                      </div>
                      <p className="text-[#9CA3AF]">{log.reason}</p>
                    </div>
                    <div className="text-right shrink-0 text-[11px] font-mono-num text-[#9CA3AF]">
                      {log.createdAt || log.timestamp
                        ? new Date(log.createdAt || log.timestamp).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US')
                        : ''}
                      {log.riskScore !== undefined && <div className="font-semibold">Risk: {log.riskScore}/100</div>}
                    </div>
                  </div>
                ))}

                {moderationLogs.length === 0 && (
                  <div className="p-6 text-center text-xs text-[#9CA3AF] rounded-xl border border-dashed border-[#262B33]">
                    {language === 'ru' ? 'Логи проверок пока пусты' : 'No audit logs yet'}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'apps' ? (
          <div className="space-y-3">
            {apps.map(app => (
              <div key={app.id} className={clsx(cardClass, 'p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4')}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className={clsx('font-bold text-base flex items-center gap-2', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>
                      {app.title}
                      {app.status === 'verified' && <CheckCircle className="w-4 h-4 text-[#10B981]" />}
                    </h3>
                    {app.moderationStatus === 'rejected' && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
                        {language === 'ru' ? 'Заблокировано ИИ' : 'Blocked by AI'}
                      </span>
                    )}
                    {app.moderationStatus === 'approved' && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                        {language === 'ru' ? 'Одобрено ИИ' : 'AI Approved'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#9CA3AF]">
                    By {app.authorName} • {app.category}
                  </p>
                  {app.moderationReason && (
                    <p className="text-xs text-[#9CA3AF] mt-1 max-w-xl truncate">
                      {language === 'ru' ? 'Причина:' : 'Reason:'} {app.moderationReason}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewingCodeApp({ title: app.title, code: app.code, authorName: app.authorName })}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap',
                      subSurfaceClass,
                      isLight ? 'text-[#111315] hover:bg-zinc-200' : 'text-[#D1D5DB] hover:bg-[#22262E]'
                    )}
                  >
                    <FileCode className="w-3.5 h-3.5 text-[#10B981]" />
                    {language === 'ru' ? 'Код' : 'Code'}
                  </button>
                  {effectiveRole === 'developer' ||
                  effectiveRole === 'admin' ||
                  effectiveRole === 'moderator' ||
                  actualRole === 'developer' ||
                  actualRole === 'admin' ||
                  actualRole === 'moderator' ? (
                    <>
                      {app.status !== 'verified' ? (
                        <button
                          onClick={() => handleVerifyApp(app.id, 'verified')}
                          className="px-3.5 py-1.5 bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E] rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Verify App
                        </button>
                      ) : (
                        <button
                          onClick={() => handleVerifyApp(app.id, 'pending')}
                          className="px-3.5 py-1.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500 hover:text-black rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Revoke
                        </button>
                      )}
                      {app.authorId && (
                        <button
                          onClick={() => {
                            const authorUser = users.find(u => (u.id || u.uid) === app.authorId) || {
                              id: app.authorId,
                              uid: app.authorId,
                              name: app.authorName || 'Author',
                              email: '',
                            };
                            if (authorUser.isBanned) {
                              setUnbanModalUser(authorUser);
                            } else {
                              setBanModalUser(authorUser);
                              setBanReasonInput('');
                            }
                          }}
                          className="px-3.5 py-1.5 bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          {language === 'ru' ? 'Бан автора' : 'Ban Author'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteApp(app.id, app.title)}
                        className="px-3.5 py-1.5 bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {language === 'ru' ? 'Удалить' : 'Delete'}
                      </button>
                      <button
                        onClick={async () => {
                          const confirmed = await confirmAction({
                            title: language === 'ru' ? 'Сброс дислайков' : 'Remove Dislikes',
                            message: language === 'ru' ? 'Обнулить все дислайки у проекта?' : 'Remove all dislikes?',
                            confirmText: language === 'ru' ? 'Сбросить' : 'Reset',
                          });
                          if (confirmed) {
                            try {
                              await updateDoc(doc(db, 'apps', app.id), { dislikes: 0 });
                              notify.success(language === 'ru' ? 'Дислайки обнулены' : 'Dislikes cleared');
                            } catch (err: any) {
                              notify.error(err.message);
                              handleFirestoreError(err, OperationType.UPDATE, `apps/${app.id}`);
                            }
                          }
                        }}
                        className="px-3.5 py-1.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Remove Dislikes
                      </button>
                    </>
                  ) : (
                    <>
                      {app.status !== 'verified' && (
                        <button
                          onClick={() => createAdminRequest('verify_app', app.id, app.title)}
                          className="px-3.5 py-1.5 bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 hover:bg-[#10B981] hover:text-[#0A0C0E] rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Request Verify
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          const reason = await promptAction({
                            title: language === 'ru' ? 'Запрос на удаление' : 'Request Deletion',
                            message: language === 'ru' ? 'Укажите причину удаления проекта:' : 'Reason for deletion?',
                            placeholder: language === 'ru' ? 'Причина...' : 'Reason...',
                          });
                          if (reason !== null) {
                            createAdminRequest('delete_app', app.id, app.title, reason);
                          }
                        }}
                        className="px-3.5 py-1.5 bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
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
          <div className="space-y-3">
            {assets.map(asset => (
              <div key={asset.id} className={clsx(cardClass, 'p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4')}>
                <div>
                  <h3 className={clsx('font-bold text-base flex items-center gap-2', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>
                    {asset.title}
                    {asset.status === 'verified' && <CheckCircle className="w-4 h-4 text-[#10B981]" />}
                  </h3>
                  <p className="text-xs text-[#9CA3AF]">
                    By {asset.authorName} • {asset.type}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {effectiveRole === 'developer' ? (
                    <>
                      {asset.status !== 'verified' ? (
                        <button
                          onClick={() => handleVerifyAsset(asset.id, 'verified')}
                          className="px-3.5 py-1.5 bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Verify Asset
                        </button>
                      ) : (
                        <button
                          onClick={() => handleVerifyAsset(asset.id, 'pending')}
                          className="px-3.5 py-1.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500 hover:text-black rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Revoke
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          const confirmed = await confirmAction({
                            title: language === 'ru' ? 'Удаление ассета' : 'Delete Asset',
                            message: language === 'ru' ? `Удалить ассет "${asset.title}"?` : 'Delete this asset?',
                            confirmText: language === 'ru' ? 'Удалить' : 'Delete',
                            tone: 'danger',
                          });
                          if (confirmed) {
                            try {
                              await deleteDoc(doc(db, 'assets', asset.id));
                              const reqsRef = collection(db, 'adminRequests');
                              const q = query(reqsRef, where('targetId', '==', asset.id));
                              const qSnap = await getDocs(q);
                              await Promise.all(qSnap.docs.map(d => deleteDoc(d.ref)));
                              notify.success(language === 'ru' ? 'Ассет удален' : 'Asset deleted');
                            } catch (err) {
                              handleFirestoreError(err, OperationType.DELETE, `assets/${asset.id}`);
                            }
                          }
                        }}
                        className="px-3.5 py-1.5 bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      {asset.status !== 'verified' && (
                        <button
                          onClick={() => createAdminRequest('verify_asset', asset.id, asset.title)}
                          className="px-3.5 py-1.5 bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 hover:bg-[#10B981] hover:text-[#0A0C0E] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Request Verify
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          const reason = await promptAction({
                            title: language === 'ru' ? 'Запрос на удаление' : 'Request Deletion',
                            message: language === 'ru' ? 'Причина удаления ассета:' : 'Reason for deletion?',
                          });
                          if (reason !== null) {
                            createAdminRequest('delete_asset', asset.id, asset.title, reason);
                          }
                        }}
                        className="px-3.5 py-1.5 bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
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
          <div className="space-y-5">
            <div className={clsx(cardClass, 'p-6')}>
              <h2 className={clsx('text-base font-bold mb-1', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>
                {language === 'ru' ? 'Генератор премиум кодов' : 'Premium Code Generator'}
              </h2>
              <p className="text-xs text-[#9CA3AF] mb-5">
                {language === 'ru' ? 'Сгенерируйте одноразовый ключ для активации подписки.' : 'Generate a one-time key for premium activation.'}
              </p>

              <div className="flex flex-col gap-3">
                <div className={clsx(subSurfaceClass, 'p-4 font-mono text-center text-2xl tracking-widest text-[#10B981]')}>
                  {premiumCode || 'XXXX-XXXX-XXXX'}
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    onClick={handleGenerateCode}
                    className="flex-1 py-2.5 px-5 bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E] rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                  >
                    {language === 'ru' ? 'Сгенерировать новый код' : 'Generate New Code'}
                  </button>

                  {premiumCode && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(premiumCode);
                        notify.success(language === 'ru' ? 'Код скопирован!' : 'Code copied!');
                      }}
                      className={clsx(
                        'py-2.5 px-5 rounded-lg border text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer',
                        subSurfaceClass,
                        isLight ? 'text-[#111315] hover:bg-zinc-200' : 'text-[#F3F4F6] hover:bg-[#22262E]'
                      )}
                    >
                      <Copy className="w-4 h-4" />
                      {language === 'ru' ? 'Копировать код' : 'Copy Code'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className={clsx(cardClass, 'p-6')}>
              <h2 className={clsx('text-base font-bold mb-4', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>
                {language === 'ru' ? 'Список кодов' : 'Codes List'}
              </h2>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {[...premiumCodes]
                  .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                  .map(c => (
                    <div key={c.id} className={clsx(subSurfaceClass, 'p-3.5 flex items-center justify-between')}>
                      <div className="flex flex-col">
                        <span className="font-mono text-sm font-bold">{c.code}</span>
                        <span className="text-[11px] font-mono-num text-[#9CA3AF]">{new Date(c.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        {c.used ? (
                          <span className="text-[11px] px-2 py-0.5 bg-red-500/15 text-red-400 border border-red-500/30 rounded font-semibold">
                            {language === 'ru' ? 'Использован' : 'Used'}
                          </span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 rounded font-semibold">
                            {language === 'ru' ? 'Активен' : 'Active'}
                          </span>
                        )}
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(c.code);
                            notify.success(language === 'ru' ? 'Код скопирован!' : 'Code copied!');
                          }}
                          className="p-1.5 rounded hover:bg-[#22262E] text-[#9CA3AF] hover:text-[#F3F4F6] transition-colors cursor-pointer"
                          title="Copy code"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : activeTab === 'roles' ? (
          <div className="space-y-5">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={clsx(inputClass, 'w-full pl-9 pr-4 py-2')}
              />
            </div>
            <div className="grid grid-cols-1 gap-3">
              {filteredUsers.map(u => {
                const uid = u.id || u.uid;
                return (
                  <div key={uid} className={clsx(cardClass, 'p-5 flex flex-col gap-4')}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <img src={u.photoUrl || u.avatarUrl || getDefaultAvatar(uid)} alt="" className="w-10 h-10 rounded-lg object-cover bg-[#111315] border border-[#262B33]" />
                        <div className="min-w-0">
                          <h3 className={clsx('font-bold text-sm truncate', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>{u.name || 'User'}</h3>
                          <p className="text-xs text-[#9CA3AF] truncate">{u.email}</p>
                          <span className={clsx('text-[10px] px-2 py-0.5 rounded border capitalize mt-1 inline-block', subSurfaceClass, 'text-[#9CA3AF]')}>
                            {u.role || 'user'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUpdateUserPermissions(uid)}
                        disabled={saving === uid || !localPermissions[uid]}
                        className={clsx(
                          'px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                          saving === uid || !localPermissions[uid]
                            ? 'bg-[#262B33] text-[#6B7280] cursor-not-allowed'
                            : 'bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E]'
                        )}
                      >
                        {saving === uid ? 'Saving...' : t.saveChanges}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-3 border-t border-[#262B33]/60">
                      {[
                        { key: 'accessAssetStore', label: 'Asset Store' },
                        { key: 'accessPremium', label: 'Premium' },
                        { key: 'accessControl', label: 'Control Panel' },
                        { key: 'sellInAssetStore', label: 'Sell Assets' },
                        { key: 'publishApps', label: 'Publish Apps' },
                        { key: 'premiumFeatures', label: 'Premium Features' },
                        { key: 'accessRecent', label: 'Recent Tab' },
                      ].map(perm => {
                        const DEFAULT_PERMISSIONS = {
                          accessAssetStore: true,
                          accessPremium: true,
                          accessControl: false,
                          sellInAssetStore: true,
                          publishApps: true,
                          premiumFeatures: true,
                          accessRecent: true,
                        };
                        const isSelfDev = uid === userData.uid && actualRole === 'developer' && perm.key === 'accessControl';
                        const isDisabled = isSelfDev || (actualRole !== 'developer' && actualRole !== 'admin');
                        const currentVal =
                          localPermissions[uid]?.[perm.key as keyof typeof DEFAULT_PERMISSIONS] ??
                          u.permissions?.[perm.key as keyof typeof DEFAULT_PERMISSIONS] ??
                          DEFAULT_PERMISSIONS[perm.key as keyof typeof DEFAULT_PERMISSIONS];

                        return (
                          <label key={perm.key} className={clsx('flex items-center gap-2 cursor-pointer group', isDisabled && 'opacity-50 cursor-not-allowed')}>
                            <input
                              type="checkbox"
                              checked={currentVal}
                              disabled={isDisabled}
                              onChange={(e) => {
                                const existingPermissions = localPermissions[uid] || u.permissions || DEFAULT_PERMISSIONS;
                                const newPermissions = {
                                  ...existingPermissions,
                                  [perm.key]: e.target.checked,
                                };
                                setLocalPermissions(prev => ({ ...prev, [uid]: newPermissions }));
                              }}
                              className="w-4 h-4 rounded border-[#262B33] text-[#10B981] focus:ring-[#10B981] bg-[#111315]"
                            />
                            <span className="text-xs font-medium group-hover:text-[#10B981] transition-colors">{perm.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : activeTab === 'requests' ? (
          <div className="space-y-4">
            <h2 className={clsx('text-base font-bold', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>
              {language === 'ru' ? 'Отправленные запросы' : 'Sent Requests'}
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {adminRequests.map(req => {
                if (!req) return null;
                if (effectiveRole !== 'developer' && effectiveRole !== 'admin' && req.requesterId !== userData?.uid) return null;

                const reqType = typeof req.type === 'string' ? req.type : '';
                const reqStatus = typeof req.status === 'string' ? req.status : 'pending';
                const reqTargetName = req.targetName || req.targetId || (language === 'ru' ? 'Объект' : 'Item');
                const reqRequesterName = req.requesterName || req.requesterId || (language === 'ru' ? 'Пользователь' : 'User');
                const isDeleteOrBan = reqType.includes('delete') || reqType.includes('ban');

                return (
                  <div key={req.id || Math.random()} className={clsx(cardClass, 'p-5 flex flex-col sm:flex-row items-start justify-between gap-4')}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={clsx(
                            'px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border',
                            isDeleteOrBan
                              ? 'bg-red-500/15 text-red-400 border-red-500/30'
                              : 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                          )}
                        >
                          {reqType ? reqType.replace(/_/g, ' ') : 'REQUEST'}
                        </span>
                        <span
                          className={clsx(
                            'px-2 py-0.5 rounded text-[11px] font-bold capitalize border',
                            reqStatus === 'pending'
                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : reqStatus === 'approved'
                                ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                                : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
                          )}
                        >
                          {reqStatus}
                        </span>
                      </div>
                      <h3 className={clsx('font-bold text-base', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>{reqTargetName}</h3>
                      <p className="text-xs text-[#9CA3AF]">
                        {language === 'ru' ? 'Отправитель:' : 'Requester:'} {reqRequesterName}
                      </p>
                      {req.reason && (
                        <p className={clsx('text-xs text-[#9CA3AF] mt-2 p-2.5 rounded-lg border italic', subSurfaceClass)}>
                          "{req.reason}"
                        </p>
                      )}
                      {reqType === 'avatar_change' && req.avatarUrl && (
                        <div className="mt-3">
                          <p className="text-xs mb-1.5 text-[#9CA3AF]">Avatar Image:</p>
                          <img src={req.avatarUrl} alt="New Avatar" className="w-20 h-20 rounded-xl object-cover border border-[#262B33]" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 min-w-[140px]">
                      {(effectiveRole === 'developer' || effectiveRole === 'admin') && reqStatus === 'pending' && (
                        <>
                          <button
                            onClick={async () => {
                              try {
                                const headers = await getAuthHeaders();
                                if (reqType === 'verify_app' && req.targetId) await updateDoc(doc(db, 'apps', req.targetId), { status: 'verified' });
                                if (reqType === 'verify_asset' && req.targetId) await updateDoc(doc(db, 'assets', req.targetId), { status: 'verified' });
                                if (reqType === 'delete_app' && req.targetId) {
                                  await deleteDoc(doc(db, 'apps', req.targetId)).catch(() => {});
                                  await fetch('/api/admin/delete-app', {
                                    method: 'POST',
                                    headers,
                                    body: JSON.stringify({ appId: req.targetId }),
                                  }).catch(() => {});
                                  setApps(prev => prev.filter(a => a.id !== req.targetId));
                                }
                                if (reqType === 'delete_asset' && req.targetId) {
                                  await deleteDoc(doc(db, 'assets', req.targetId));
                                }
                                if (reqType === 'ban_user' && req.targetId) {
                                  await setDoc(doc(db, 'users', req.targetId), { isBanned: true, banReason: req.reason }, { merge: true }).catch(() => {});
                                  await setDoc(doc(db, 'users_public', req.targetId), { isBanned: true, banReason: req.reason }, { merge: true }).catch(() => {});
                                  await fetch('/api/admin/ban', {
                                    method: 'POST',
                                    headers,
                                    body: JSON.stringify({ userId: req.targetId, isBanned: true, reason: req.reason }),
                                  }).catch(() => {});
                                  setUsers(prev => prev.map(u => ((u.id || u.uid) === req.targetId ? { ...u, isBanned: true, banReason: req.reason } : u)));
                                }

                                if (reqType.startsWith('delete_') && req.targetId) {
                                  const q = query(collection(db, 'adminRequests'), where('targetId', '==', req.targetId));
                                  const qSnap = await getDocs(q);
                                  await Promise.all(qSnap.docs.map(d => deleteDoc(d.ref)));
                                } else if (req.id) {
                                  await updateDoc(doc(db, 'adminRequests', req.id), { status: 'approved' });
                                }
                                showToast(language === 'ru' ? 'Выполнено' : 'Approved and applied', 'success');
                              } catch (e) {
                                handleFirestoreError(e, OperationType.UPDATE, `adminRequests/${req.id} or target`);
                              }
                            }}
                            className="w-full px-3.5 py-2 bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                          >
                            {reqType === 'avatar_change' ? 'Allow' : 'Approve'}
                          </button>
                          <button
                            onClick={async () => {
                              if (reqType === 'avatar_change' && req.targetId) {
                                try {
                                  const defaultAvatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(reqTargetName);
                                  await updateDoc(doc(db, 'users', req.targetId), { avatarUrl: defaultAvatar });
                                  await updateDoc(doc(db, 'users_public', req.targetId), { avatarUrl: defaultAvatar });
                                  if (req.id) await updateDoc(doc(db, 'adminRequests', req.id), { status: 'rejected' });
                                  showToast(language === 'ru' ? 'Отклонено' : 'Rejected', 'success');
                                } catch (e) {
                                  console.error(e);
                                }
                              } else if (req.id) {
                                await updateDoc(doc(db, 'adminRequests', req.id), { status: 'rejected' });
                                showToast(language === 'ru' ? 'Отклонено' : 'Rejected', 'success');
                              }
                            }}
                            className="w-full px-3.5 py-2 bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg text-xs font-semibold hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {(effectiveRole === 'developer' || effectiveRole === 'admin' || req.requesterId === userData?.uid) && (
                        <>
                          {req.requesterId === userData?.uid && reqStatus === 'pending' && reqType !== 'avatar_change' && req.id && (
                            <button
                              onClick={async () => {
                                const newReason = await promptAction({
                                  title: language === 'ru' ? 'Изменить причину' : 'Edit Reason',
                                  message: language === 'ru' ? 'Укажите новую причину запроса:' : 'Enter updated reason:',
                                  defaultValue: req.reason || '',
                                });
                                if (newReason !== null) {
                                  await updateDoc(doc(db, 'adminRequests', req.id), { reason: newReason, updatedAt: new Date().toISOString() });
                                  notify.success(language === 'ru' ? 'Причина обновлена' : 'Reason updated');
                                }
                              }}
                              className="w-full px-3.5 py-2 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-semibold hover:bg-blue-600 hover:text-white transition-colors cursor-pointer"
                            >
                              Edit Reason
                            </button>
                          )}
                          {req.id && (
                            <button
                              onClick={async () => {
                                const confirmed = await confirmAction({
                                  title: language === 'ru' ? 'Удаление запроса' : 'Delete Request',
                                  message: language === 'ru' ? 'Удалить этот запрос?' : 'Delete this request?',
                                  confirmText: language === 'ru' ? 'Удалить' : 'Delete',
                                  tone: 'danger',
                                });
                                if (confirmed) {
                                  try {
                                    await deleteDoc(doc(db, 'adminRequests', req.id));
                                    showToast(language === 'ru' ? 'Запрос удален' : 'Request deleted', 'success');
                                  } catch (e) {
                                    handleFirestoreError(e, OperationType.DELETE, `adminRequests/${req.id}`);
                                  }
                                }
                              }}
                              className={clsx(
                                'w-full px-3.5 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer',
                                subSurfaceClass,
                                'text-[#9CA3AF] hover:bg-red-600 hover:text-white hover:border-red-600'
                              )}
                            >
                              Delete Request
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {adminRequests.length === 0 && (
                <div className="p-8 text-center text-sm text-[#9CA3AF]">
                  {language === 'ru' ? 'Запросов нет' : 'No requests found'}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'ai-help' ? (
          <div className="space-y-5">
            {/* AI Help Security Header */}
            <div className={clsx(cardClass, 'p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4')}>
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-lg bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 flex items-center justify-center shrink-0">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={clsx('text-base font-bold', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>Ai Help</h2>
                    <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                      Security Core
                    </span>
                    <span className={clsx('text-[11px] px-2 py-0.5 rounded font-mono border', subSurfaceClass, 'text-[#9CA3AF]')}>
                      gemini-4-hydrogen-sec
                    </span>
                  </div>
                  <p className="text-xs text-[#9CA3AF] mt-1 max-w-2xl leading-relaxed">
                    {language === 'ru'
                      ? 'Строгий ИИ-ассистент безопасности платформы. Выполняет модерацию, проверку матов и взломов, баны и разбаны пользователей, блокировку проектов. Отвечает ТОЛЬКО за безопасность.'
                      : 'Strict platform security assistant. Handles moderation, exploit/profanity detection, user bans/unbans, and project takedowns. Operates SOLELY for safety.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTriggerHourly}
                disabled={isTriggeringHourly}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E] transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className={clsx('w-3.5 h-3.5', isTriggeringHourly && 'animate-spin')} />
                <span>{isTriggeringHourly ? (language === 'ru' ? 'Сканирование...' : 'Scanning...') : language === 'ru' ? 'Запустить проверку' : 'Run Scan'}</span>
              </button>
            </div>

            {/* Strict Responsibility Warning Banner */}
            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                {language === 'ru'
                  ? 'Правило ИИ: Данный ассистент отвечает ТОЛЬКО на запросы безопасности и модерации. Посторонние запросы отклоняются.'
                  : 'AI Constraint: This assistant is restricted SOLELY to security, moderation and enforcement tasks.'}
              </span>
            </div>

            {/* Quick Security Actions */}
            <div>
              <div className="text-[11px] font-semibold text-[#9CA3AF] mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>{language === 'ru' ? 'Быстрые команды безопасности:' : 'Quick Security Directives:'}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    label: language === 'ru' ? 'Проверить "Role is allowed by dev"' : 'Check "Role is allowed by dev"',
                    cmd: 'Проверь всех пользователей: если у кого-то есть повышенная роль без надписи "Role is allowed by dev", забань их',
                  },
                  {
                    label: language === 'ru' ? 'Запустить почасовую проверку' : 'Run Hourly Scan',
                    cmd: 'Запусти почасовую проверку безопасности проектов и пользователей',
                  },
                  {
                    label: language === 'ru' ? 'Забанить за маты' : 'Ban Profanity Violators',
                    cmd: 'Забань пользователя с матами или запрещенными словами',
                  },
                  {
                    label: language === 'ru' ? 'Проверить проекты на эксплойты' : 'Scan Apps for Exploits',
                    cmd: 'Просканируй все проекты на наличие эксплойтов, дефейсов, бесконечных циклов и матов',
                  },
                  { label: language === 'ru' ? 'Разбанить пользователя' : 'Unban User', cmd: 'Разбань пользователя' },
                ].map((act, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendAiHelp(act.cmd)}
                    disabled={aiHelpLoading}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50',
                      subSurfaceClass,
                      isLight ? 'text-[#111315] hover:bg-zinc-200' : 'text-[#D1D5DB] hover:bg-[#22262E]'
                    )}
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Log Window */}
            <div className={clsx(cardClass, 'flex flex-col h-[500px] overflow-hidden')}>
              <div className="flex-1 p-5 overflow-y-auto space-y-4">
                {aiHelpMessages.map(msg => (
                  <div key={msg.id} className={clsx('flex gap-3 max-w-[85%]', msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto')}>
                    <div
                      className={clsx(
                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold border',
                        msg.sender === 'user'
                          ? 'bg-[#10B981] border-[#10B981] text-[#0A0C0E]'
                          : 'bg-[#10B981]/15 border-[#10B981]/30 text-[#10B981]'
                      )}
                    >
                      {msg.sender === 'user' ? 'Вы' : <Bot className="w-4 h-4" />}
                    </div>

                    <div className="space-y-1">
                      <div
                        className={clsx(
                          'p-3.5 rounded-xl text-xs sm:text-sm leading-relaxed border',
                          msg.sender === 'user'
                            ? 'bg-[#10B981] text-[#0A0C0E] border-[#10B981] font-medium'
                            : isLight
                              ? 'bg-[#F5F6F8] text-[#111315] border-[#E2E5EA]'
                              : 'bg-[#111315] text-[#D1D5DB] border-[#262B33]'
                        )}
                      >
                        <p className="whitespace-pre-wrap">{msg.text}</p>

                        {msg.actionResult && (
                          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center gap-2 text-xs font-semibold text-[#10B981]">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>
                              {language === 'ru' ? 'Действие безопасности выполнено:' : 'Security Action Executed:'} {msg.actionResult.type}{' '}
                              {msg.actionResult.target ? `(${msg.actionResult.target})` : ''}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className={clsx('text-[10px] font-mono-num text-[#6B7280] px-1 flex items-center gap-2', msg.sender === 'user' ? 'justify-end' : 'justify-start')}>
                        <span>{msg.sender === 'user' ? userData?.name || 'Staff' : 'Security AI'}</span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {aiHelpLoading && (
                  <div className="flex gap-3 max-w-[85%] mr-auto items-center">
                    <div className="w-8 h-8 rounded-lg bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className={clsx(subSurfaceClass, 'p-3 text-xs flex items-center gap-2 text-[#9CA3AF]')}>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#10B981]" />
                      <span>{language === 'ru' ? 'ИИ анализирует директиву безопасности...' : 'Security AI analyzing directive...'}</span>
                    </div>
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendAiHelp();
                }}
                className={clsx('p-3.5 border-t flex items-center gap-2', isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]')}
              >
                <div className="relative flex-1">
                  <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  <input
                    type="text"
                    value={aiHelpInput}
                    onChange={(e) => setAiHelpInput(e.target.value)}
                    placeholder={
                      language === 'ru'
                        ? 'Напишите команду безопасности (забанить, разбанить, удалить проект, проверить маты)...'
                        : 'Enter security directive (ban, unban, remove project, check profanity)...'
                    }
                    disabled={aiHelpLoading}
                    className={clsx(inputClass, 'w-full pl-9 pr-4 py-2')}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!aiHelpInput.trim() || aiHelpLoading}
                  className="px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E] rounded-lg text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{language === 'ru' ? 'Отправить' : 'Send'}</span>
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* User Management Tab */
          <div className="space-y-5">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <input
                type="text"
                placeholder="Search users by email or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={clsx(inputClass, 'w-full pl-9 pr-4 py-2')}
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              {filteredUsers.map(u => {
                const uid = u.id || u.uid;
                return (
                  <div key={uid} className={clsx(cardClass, 'p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4')}>
                    <div className="flex items-center gap-3.5 min-w-0">
                      <img
                        src={u.photoUrl || u.avatarUrl || getDefaultAvatar(uid)}
                        alt=""
                        className="w-11 h-11 rounded-lg object-cover bg-[#111315] border border-[#262B33] shrink-0"
                      />
                      <div className="min-w-0">
                        <h3 className={clsx('font-bold text-sm flex items-center gap-2 flex-wrap', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>
                          {u.isVerifiedAuthor && <VerifiedBadge size="sm" />}
                          <span>{u.name || 'User'}</span>
                          <UserRoleBadge role={u.role} isVerifiedAuthor={u.isVerifiedAuthor} size="xs" showLabel />
                          {u.isBanned && (
                            <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/40 rounded text-red-400 text-[10px] uppercase font-bold tracking-wider">
                              BANNED
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-[#9CA3AF] truncate">{u.email}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className={clsx('text-[11px] px-2 py-0.5 rounded border capitalize', subSurfaceClass, 'text-[#9CA3AF]')}>
                            {u.role || 'user'}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-[#10B981]/10 border border-[#10B981]/25 text-[#10B981] font-mono-num font-bold flex items-center gap-1">
                            <Coins className="w-3 h-3" /> {u.eplCoins || 0}
                          </span>
                          {u.roleVerification === 'Role is allowed by dev' ? (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 font-semibold flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Role is allowed by dev
                            </span>
                          ) : u.role && u.role !== 'user' && u.email !== 'fufazada@gmail.com' ? (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              {language === 'ru' ? 'Нет Role is allowed by dev' : 'Missing Role is allowed by dev'}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      {actualRole === 'developer' || actualRole === 'admin' ? (
                        <CustomSelect
                          value={u.role || 'user'}
                          onChange={(val) => handleUpdateUserRole(uid, val)}
                          size="sm"
                          className="min-w-[130px]"
                          options={[
                            { value: 'user', label: 'User' },
                            { value: 'moderator', label: 'Moderator' },
                            { value: 'admin', label: 'Admin' },
                            { value: 'shopkeeper', label: 'Shopkeeper' },
                            { value: 'developer', label: 'Developer' },
                          ]}
                        />
                      ) : (
                        <div className={clsx(subSurfaceClass, 'px-2.5 py-1.5 text-xs text-[#9CA3AF]')}>{u.role || 'user'}</div>
                      )}

                      {(actualRole === 'developer' || actualRole === 'admin') && (
                        <button
                          onClick={() => handleVerifyRole(uid)}
                          className={clsx(
                            'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 border whitespace-nowrap',
                            u.roleVerification === 'Role is allowed by dev'
                              ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30 hover:bg-[#10B981]/25'
                              : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500'
                          )}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{u.roleVerification === 'Role is allowed by dev' ? 'Verified Role' : 'Verify Role'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleToggleVerifiedBadge(u)}
                        className={clsx(
                          'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 border whitespace-nowrap',
                          u.isVerifiedAuthor
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30'
                            : clsx(subSurfaceClass, 'text-[#9CA3AF] hover:text-[#F3F4F6]')
                        )}
                      >
                        <BadgeCheck className="w-3.5 h-3.5 text-blue-400" />
                        {language === 'ru' ? (u.isVerifiedAuthor ? 'Галочка выдана' : 'Выдать галочку') : u.isVerifiedAuthor ? 'Verified' : 'Grant Badge'}
                      </button>

                      {effectiveRole === 'developer' ||
                      effectiveRole === 'admin' ||
                      effectiveRole === 'moderator' ||
                      actualRole === 'developer' ||
                      actualRole === 'admin' ||
                      actualRole === 'moderator' ? (
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
                              'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap',
                              u.isBanned
                                ? 'bg-[#10B981] border-[#10B981] text-[#0A0C0E] hover:bg-[#059669]'
                                : 'bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white'
                            )}
                          >
                            <Ban className="w-3.5 h-3.5" />
                            {u.isBanned ? (language === 'ru' ? 'Разбанить' : 'Unban') : language === 'ru' ? 'Забанить' : 'Ban User'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(uid, u.name || 'User')}
                            title={language === 'ru' ? 'Удалить аккаунт' : 'Delete Account'}
                            className="px-3 py-1.5 bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{language === 'ru' ? 'Удалить' : 'Delete'}</span>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            if (u.isBanned) return showToast('User is already banned', 'error');
                            createAdminRequest('ban_user', uid, u.name || 'User', 'Community rule violation report');
                          }}
                          className="px-3 py-1.5 bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Request Ban
                        </button>
                      )}

                      {(actualRole === 'developer' || actualRole === 'admin') && (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            placeholder="Amount"
                            defaultValue={100}
                            id={`coins-${uid}`}
                            className={clsx(inputClass, 'w-20 px-2 py-1.5 text-xs font-mono-num')}
                          />
                          <button
                            onClick={() => {
                              const input = document.getElementById(`coins-${uid}`) as HTMLInputElement;
                              const amt = parseInt(input?.value || '0', 10) || 0;
                              handleGiveCoins(uid, amt);
                            }}
                            className="px-3 py-1.5 bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E] rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Give Coins
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Ban User Modal */}
      {banModalUser && (
        <div className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={clsx(cardClass, 'w-full max-w-md p-6 shadow-2xl relative')}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#262B33]/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30">
                  <Ban className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={clsx('font-bold text-base', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>
                    {language === 'ru' ? 'Блокировка пользователя' : 'Ban User'}
                  </h3>
                  <p className="text-[11px] font-mono text-[#9CA3AF]">ID: {banModalUser.id || banModalUser.uid}</p>
                </div>
              </div>
              <button
                onClick={() => setBanModalUser(null)}
                className="p-1.5 rounded-lg hover:bg-[#22262E] text-[#9CA3AF] hover:text-[#F3F4F6] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className={clsx(subSurfaceClass, 'p-3 flex items-center gap-3')}>
                <img src={banModalUser.photoUrl || banModalUser.avatarUrl || getDefaultAvatar(banModalUser.id || banModalUser.uid)} alt="" className="w-9 h-9 rounded-lg object-cover" />
                <div>
                  <div className="font-semibold text-sm flex items-center gap-1.5">
                    <span>{banModalUser.name || 'User'}</span>
                    <UserRoleBadge role={banModalUser.role} isVerifiedAuthor={banModalUser.isVerifiedAuthor} size="xs" />
                  </div>
                  <div className="text-xs text-[#9CA3AF]">{banModalUser.email || 'No email'}</div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5 text-[#9CA3AF]">
                  {language === 'ru' ? 'Причина бана' : 'Ban Reason'}
                </label>
                <input
                  type="text"
                  value={banReasonInput}
                  onChange={(e) => setBanReasonInput(e.target.value)}
                  placeholder={language === 'ru' ? 'Укажите причину блокировки...' : 'Enter reason for ban...'}
                  className={clsx(inputClass, 'w-full px-3.5 py-2')}
                />

                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {[
                    language === 'ru' ? 'Нарушение правил' : 'Rules violation',
                    language === 'ru' ? 'Спам / Флуд' : 'Spam / Flood',
                    language === 'ru' ? 'Попытка взлома / Чит' : 'Exploit / Cheat',
                    language === 'ru' ? 'Неприемлемый контент' : 'Inappropriate content',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBanReasonInput(preset)}
                      className={clsx(
                        'text-[11px] px-2.5 py-1 rounded border transition-colors cursor-pointer',
                        banReasonInput === preset
                          ? 'bg-red-600 text-white border-red-600'
                          : clsx(subSurfaceClass, 'text-[#9CA3AF] hover:text-[#F3F4F6]')
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
                  className={clsx('flex-1 py-2 px-4 rounded-lg border text-xs font-semibold transition-colors cursor-pointer', subSurfaceClass)}
                >
                  {language === 'ru' ? 'Отмена' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBan}
                  className="flex-1 py-2 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={clsx(cardClass, 'w-full max-w-sm p-6 shadow-2xl relative')}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-2 rounded-lg bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                <CheckCircle className="w-4 h-4" />
              </div>
              <h3 className={clsx('font-bold text-base', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>
                {language === 'ru' ? 'Разблокировать?' : 'Unban User?'}
              </h3>
            </div>
            <p className="text-xs text-[#9CA3AF] mb-5 leading-relaxed">
              {language === 'ru'
                ? `Вы уверены, что хотите снять блокировку с пользователя "${unbanModalUser.name || 'User'}"?`
                : `Are you sure you want to unban "${unbanModalUser.name || 'User'}"?`}
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setUnbanModalUser(null)}
                className={clsx('flex-1 py-2 px-4 rounded-lg border text-xs font-semibold transition-colors cursor-pointer', subSurfaceClass)}
              >
                {language === 'ru' ? 'Отмена' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleExecuteUnban}
                className="flex-1 py-2 px-4 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E] font-semibold text-xs transition-colors cursor-pointer"
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
          <div className={clsx(cardClass, 'w-full max-w-4xl max-h-[90vh] p-6 shadow-2xl flex flex-col relative')}>
            <div className="flex items-center justify-between pb-4 border-b border-[#262B33]/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={clsx('font-bold text-base', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>{viewingCodeApp.title}</h3>
                  <p className="text-xs text-[#9CA3AF] font-mono-num">
                    {language === 'ru' ? 'Автор:' : 'Author:'} {viewingCodeApp.authorName} • {viewingCodeApp.code ? viewingCodeApp.code.length : 0}{' '}
                    {language === 'ru' ? 'символов' : 'characters'}
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
                  className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer', subSurfaceClass)}
                >
                  {language === 'ru' ? 'Копировать код' : 'Copy Code'}
                </button>
                <button
                  type="button"
                  onClick={() => setViewingCodeApp(null)}
                  className="p-1.5 rounded-lg hover:bg-[#22262E] text-[#9CA3AF] hover:text-[#F3F4F6] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto mt-4 rounded-lg bg-[#111315] p-4 border border-[#262B33]">
              <pre className="text-xs font-mono text-[#D1D5DB] whitespace-pre-wrap break-all leading-relaxed">
                <code>{viewingCodeApp.code || '// Empty code'}</code>
              </pre>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingCodeApp(null)}
                className={clsx('px-4 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer', subSurfaceClass)}
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
          <div className={clsx(cardClass, 'w-full max-w-md p-6 shadow-2xl relative')}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={clsx('font-bold text-sm', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>
                    {language === 'ru' ? 'Отклонить публикацию' : 'Reject Publication'}
                  </h3>
                  <p className="text-xs text-[#9CA3AF]">{manualRejectApp.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManualRejectApp(null)}
                className="p-1 rounded-lg hover:bg-[#22262E] text-[#9CA3AF] hover:text-[#F3F4F6] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <label className="text-xs font-medium text-[#9CA3AF] block">
                {language === 'ru' ? 'Укажите причину отклонения (будет видна автору):' : 'Rejection reason (visible to author):'}
              </label>
              <textarea
                value={manualRejectReasonInput}
                onChange={(e) => setManualRejectReasonInput(e.target.value)}
                placeholder={language === 'ru' ? 'Например: Проект содержит вредоносный код или недопустимый контент' : 'e.g. Inappropriate content or exploit'}
                className={clsx(inputClass, 'w-full h-24 p-3 resize-none')}
              />

              <div className="flex flex-wrap gap-1.5">
                {[
                  language === 'ru' ? '18+ Контент / Неприемлемо' : '18+ Adult content',
                  language === 'ru' ? 'Попытка взлома / Эксплойт' : 'Exploit / Hack attempt',
                  language === 'ru' ? 'Ненормативная лексика' : 'Profanity / Vulgarity',
                  language === 'ru' ? 'Спам / Накрутка' : 'Spam / Bot flood',
                  language === 'ru' ? 'Бесконечный цикл / DoS' : 'Crash loop / DoS',
                ].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setManualRejectReasonInput(preset)}
                    className={clsx(
                      'text-[11px] px-2.5 py-1 rounded border transition-colors cursor-pointer',
                      manualRejectReasonInput === preset
                        ? 'bg-red-600 text-white border-red-600'
                        : clsx(subSurfaceClass, 'text-[#9CA3AF] hover:text-[#F3F4F6]')
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
                className={clsx('flex-1 py-2 px-4 rounded-lg border text-xs font-semibold transition-colors cursor-pointer', subSurfaceClass)}
              >
                {language === 'ru' ? 'Отмена' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleManualReject}
                className="flex-1 py-2 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                {language === 'ru' ? 'Отклонить проект' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
