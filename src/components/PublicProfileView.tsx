import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { clsx } from 'clsx';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { getDefaultAvatar } from '../lib/avatar';
import { AppData } from '../types';
import { ExternalLink, Star, Download, ChevronDown, ChevronUp, User as UserIcon, Ban, ShieldCheck } from 'lucide-react';
import UserRoleBadge from './UserRoleBadge';
import VerifiedBadge from './VerifiedBadge';
import { notify } from '../store/useDialogStore';

export default function PublicProfileView() {
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const viewingProfileId = useStore(state => state.viewingProfileId);
  const setCurrentView = useStore(state => state.setCurrentView);
  const setSelectedAppId = useStore(state => state.setSelectedAppId);
  const userData = useStore(state => state.userData);
  const language = useStore(state => state.language);
  const simulatedRole = useStore(state => state.simulatedRole);
  const isStaff =
    userData?.role === 'developer' ||
    userData?.role === 'admin' ||
    userData?.role === 'moderator' ||
    simulatedRole === 'developer' ||
    simulatedRole === 'admin' ||
    simulatedRole === 'moderator';

  const [profileData, setProfileData] = useState<any>(null);
  const [profileApps, setProfileApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [banning, setBanning] = useState(false);

  const handleToggleBan = async () => {
    if (!viewingProfileId || !profileData) return;
    const isCurrentlyBanned = !!profileData.isBanned;
    setBanning(true);
    try {
      const updates = { isBanned: !isCurrentlyBanned, banReason: !isCurrentlyBanned ? 'Rules violation' : null };
      await setDoc(doc(db, 'users', viewingProfileId), updates, { merge: true });
      await setDoc(doc(db, 'users_public', viewingProfileId), updates, { merge: true });
      setProfileData((prev: any) => ({ ...prev, ...updates }));
      notify.success(
        !isCurrentlyBanned
          ? language === 'ru' ? 'Пользователь заблокирован' : 'User banned'
          : language === 'ru' ? 'Пользователь разблокирован' : 'User unbanned'
      );
    } catch (e) {
      console.warn('PublicProfile direct ban attempt had error, using fallback API:', e);
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (auth.currentUser) {
          const token = await auth.currentUser.getIdToken();
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch('/api/admin/ban', {
          method: 'POST',
          headers,
          body: JSON.stringify({ userId: viewingProfileId, isBanned: !isCurrentlyBanned, reason: !isCurrentlyBanned ? 'Rules violation' : null }),
        });
        if (res.ok) {
          const updates = { isBanned: !isCurrentlyBanned, banReason: !isCurrentlyBanned ? 'Rules violation' : null };
          setProfileData((prev: any) => ({ ...prev, ...updates }));
          notify.success(
            !isCurrentlyBanned
              ? language === 'ru' ? 'Пользователь заблокирован' : 'User banned'
              : language === 'ru' ? 'Пользователь разблокирован' : 'User unbanned'
          );
        } else {
          notify.error(language === 'ru' ? 'Не удалось изменить статус блокировки' : 'Failed to update ban status');
        }
      } catch {
        notify.error(language === 'ru' ? 'Ошибка сети при блокировке' : 'Network error updating ban status');
      }
    } finally {
      setBanning(false);
    }
  };

  useEffect(() => {
    if (!viewingProfileId) return;

    const fetchProfile = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'users_public', viewingProfileId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfileData(docSnap.data());
        } else {
          const fallbackSnap = await getDoc(doc(db, 'users', viewingProfileId));
          if (fallbackSnap.exists()) {
            setProfileData(fallbackSnap.data());
          }
        }

        const q = query(
          collection(db, 'apps'),
          where('authorId', '==', viewingProfileId)
        );
        const appsSnap = await getDocs(q);
        const appsData = appsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as AppData))
          .filter(a => !a.isPrivate);
        setProfileApps(appsData.sort((a, b) => (b.downloads || 0) - (a.downloads || 0)));
      } catch (err) {
        console.error('Error fetching public profile', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [viewingProfileId]);

  if (!viewingProfileId) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[#9CA3AF] text-sm">No profile selected.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#262B33] border-t-[#10B981]"></div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="h-full flex items-center justify-center flex-col gap-4">
        <UserIcon className="w-14 h-14 text-[#6B7280]" />
        <h2 className="text-xl font-bold">User Not Found</h2>
        <button
          onClick={() => setCurrentView('store')}
          className="px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E] rounded-lg text-sm font-semibold cursor-pointer"
        >
          Return to Store
        </button>
      </div>
    );
  }

  const bio: string = profileData.bio || '';
  const isBioLong = bio.length > 80;

  return (
    <div className="h-full flex flex-col p-4 sm:p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full">
        {/* Profile Card */}
        <div
          className={clsx(
            'p-6 sm:p-8 rounded-xl border mb-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left',
            isFrutigerAero
              ? 'bg-white/40 border-white/50 backdrop-blur-md shadow-lg'
              : theme !== 'light'
                ? 'bg-[#181B20] border-[#262B33]'
                : 'bg-white border-[#E2E5EA]'
          )}
        >
          <img
            src={profileData.avatarUrl || getDefaultAvatar(viewingProfileId)}
            alt="Avatar"
            className={clsx(
              'w-24 h-24 rounded-xl object-cover border shrink-0',
              isFrutigerAero ? 'border-4 border-white/60 shadow-lg' : theme !== 'light' ? 'border-[#262B33] bg-[#111315]' : 'border-[#E2E5EA] bg-[#F5F6F8]'
            )}
          />
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-3">
              <div>
                <h1
                  className={clsx(
                    'text-2xl font-bold mb-1 tracking-tight flex flex-wrap items-center justify-center sm:justify-start gap-2',
                    isFrutigerAero ? 'text-blue-900' : theme !== 'light' ? 'text-[#F3F4F6]' : 'text-[#111315]'
                  )}
                >
                  {profileData.isVerifiedAuthor && <VerifiedBadge size="md" />}
                  <span>{profileData.name || 'Unknown User'}</span>
                  <UserRoleBadge role={profileData.role} isVerifiedAuthor={profileData.isVerifiedAuthor} size="sm" showLabel />
                  {profileData.roleVerification === 'Role is allowed by dev' && (
                    <span className="px-2 py-0.5 rounded-md bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/35 text-[11px] font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                      Role is allowed by dev
                    </span>
                  )}
                  {profileData.isBanned && (
                    <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/40 rounded text-red-400 text-[11px] uppercase font-bold tracking-wider">
                      BANNED
                    </span>
                  )}
                </h1>
                <p className={clsx('text-xs mb-3 font-medium', isFrutigerAero ? 'text-blue-800/70' : 'text-[#9CA3AF]')}>
                  From {profileData.region || 'Unknown Region'} • {profileData.role || 'User'}
                </p>
              </div>
              {isStaff && (
                <button
                  type="button"
                  disabled={banning}
                  onClick={handleToggleBan}
                  className={clsx(
                    'px-3.5 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0',
                    profileData.isBanned
                      ? 'bg-[#10B981] hover:bg-[#059669] border-[#10B981] text-[#0A0C0E]'
                      : 'bg-red-500/15 text-red-400 hover:bg-red-500 hover:text-white border-red-500/30'
                  )}
                >
                  <Ban className="w-3.5 h-3.5" />
                  {profileData.isBanned ? (language === 'ru' ? 'Разбанить' : 'Unban User') : language === 'ru' ? 'Забанить' : 'Ban User'}
                </button>
              )}
            </div>

            {bio && (
              <div
                className={clsx(
                  'mt-3 text-left p-3.5 rounded-lg border text-sm',
                  isFrutigerAero
                    ? 'bg-white/50 border-white/30 text-blue-900'
                    : theme !== 'light'
                      ? 'bg-[#111315] border-[#262B33] text-[#D1D5DB]'
                      : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#374151]'
                )}
              >
                <p className={clsx('whitespace-pre-wrap leading-relaxed', !bioExpanded && isBioLong ? 'line-clamp-3' : '')}>{bio}</p>
                {isBioLong && (
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => setBioExpanded(!bioExpanded)}
                      className="text-[#10B981] hover:text-[#34D399] font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {bioExpanded ? (
                        <>
                          Hide <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          more... <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Apps Section */}
        <h2 className={clsx('text-lg font-bold mb-4 tracking-tight', isFrutigerAero ? 'text-blue-900' : theme !== 'light' ? 'text-[#F3F4F6]' : 'text-[#111315]')}>
          Published Apps
        </h2>
        {profileApps.length === 0 ? (
          <div
            className={clsx(
              'p-8 text-center rounded-xl border text-sm',
              isFrutigerAero ? 'bg-white/30 border-white/40' : theme !== 'light' ? 'bg-[#181B20] border-[#262B33] text-[#9CA3AF]' : 'bg-white border-[#E2E5EA] text-[#525866]'
            )}
          >
            This user hasn't published any public apps yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {profileApps.map(app => (
              <div
                key={app.id}
                onClick={() => setSelectedAppId(app.id)}
                className={clsx(
                  'group relative overflow-hidden rounded-xl border transition-colors cursor-pointer',
                  isFrutigerAero
                    ? 'bg-white/40 border-white/50 hover:bg-white/60 backdrop-blur-md'
                    : theme !== 'light'
                      ? 'bg-[#181B20] border-[#262B33] hover:border-[#374151]'
                      : 'bg-white border-[#E2E5EA] hover:border-[#CBD5E1]'
                )}
              >
                <div className="p-4 flex items-center gap-3">
                  {app.iconUrl ? (
                    <img src={app.iconUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-current/15 shrink-0" />
                  ) : (
                    <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center border border-current/15 shrink-0', theme !== 'light' ? 'bg-[#111315]' : 'bg-[#F5F6F8]')}>
                      <ExternalLink className="w-5 h-5 text-[#10B981]/60" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm leading-tight truncate">{app.title}</h3>
                    <p className="text-[11px] opacity-65 capitalize mt-0.5">{app.category}</p>
                  </div>
                </div>

                <div className="px-4 py-3 flex items-center justify-between text-xs border-t border-[#262B33]/40">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-[#10B981] font-mono-num font-semibold">
                      <Download className="w-3.5 h-3.5" />
                      {app.downloads || 0}
                    </div>
                    <div className="flex items-center gap-1.5 text-amber-400 font-mono-num font-semibold">
                      <Star className="w-3.5 h-3.5" />
                      {(app.rating || 0).toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
