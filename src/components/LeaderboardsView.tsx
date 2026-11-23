import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Trophy, Globe, MapPin, Users, Medal, Flame } from 'lucide-react';
import { clsx } from 'clsx';
import { getDefaultAvatar } from '../lib/avatar';
import UserRoleBadge from './UserRoleBadge';
import VerifiedBadge from './VerifiedBadge';

type LeaderboardTab = 'global' | 'region' | 'friends' | 'popular';

interface LeaderboardUser {
  uid: string;
  name: string;
  avatarUrl: string;
  region: string;
  eplCoins: number;
  role?: string;
  isVerifiedAuthor?: boolean;
  isBanned?: boolean;
}

interface PopularProject {
  id: string;
  title: string;
  authorId?: string;
  authorName: string;
  visits: number;
  iconUrl: string;
}

export default function LeaderboardsView() {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('global');
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [popularProjects, setPopularProjects] = useState<PopularProject[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = useStore((state) => state.user);
  const userData = useStore((state) => state.userData);
  const theme = useStore((state) => state.theme);
  const language = useStore((state) => state.language);
  const isFrutigerAero = useStore((state) => state.isFrutigerAero);

  const isLight = theme === 'light' && !isFrutigerAero;

  useEffect(() => {
    fetchLeaderboard();
  }, [activeTab, userData]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      let q;
      const usersRef = collection(db, 'users_public');

      // Always collect banned UIDs from `users` as well so even legacy bans without users_public.isBanned are excluded
      const bannedUids = new Set<string>();
      try {
        const bannedSnap = await getDocs(query(collection(db, 'users'), where('isBanned', '==', true)));
        bannedSnap.docs.forEach((d) => {
          const data = d.data() as any;
          if (data?.isBanned) {
            bannedUids.add(data.uid || d.id);
          }
        });
      } catch (err) {
        console.warn('Could not query banned users set:', err);
      }

      if (activeTab === 'global') {
        q = query(usersRef, orderBy('eplCoins', 'desc'), limit(150));
      } else if (activeTab === 'region') {
        q = query(usersRef, orderBy('eplCoins', 'desc'), limit(250));
      } else if (activeTab === 'popular') {
        const appsRef = collection(db, 'apps');
        const popularQuery = query(
          appsRef,
          orderBy('visits', 'desc'),
          limit(100)
        );
        const snapshot = await getDocs(popularQuery);
        const projects = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as PopularProject & { isPrivate?: boolean }))
          .filter((p) => !p.isPrivate && (!p.authorId || !bannedUids.has(p.authorId)))
          .slice(0, 50);
        setPopularProjects(projects);
        setLoading(false);
        return;
      } else if (activeTab === 'friends') {
        const friendsList = userData?.friends || [];
        const uidsToFetch = [currentUser?.uid, ...friendsList].filter(Boolean) as string[];

        if (uidsToFetch.length > 0) {
          const chunks = [];
          for (let i = 0; i < uidsToFetch.length; i += 10) {
            chunks.push(uidsToFetch.slice(i, i + 10));
          }

          let allFriends: LeaderboardUser[] = [];
          for (const chunk of chunks) {
            const chunkQuery = query(usersRef, where('uid', 'in', chunk));
            const snapshot = await getDocs(chunkQuery);
            const chunkUsers = snapshot.docs
              .map((docSnap) => ({ uid: docSnap.id, ...(docSnap.data() as Record<string, any>) } as LeaderboardUser))
              .filter((u) => !u.isBanned && !bannedUids.has(u.uid));
            allFriends = [...allFriends, ...chunkUsers];
          }

          allFriends.sort((a, b) => (b.eplCoins || 0) - (a.eplCoins || 0));
          setUsers(allFriends);
          setLoading(false);
          return;
        } else {
          setUsers([]);
          setLoading(false);
          return;
        }
      }

      if (q) {
        const snapshot = await getDocs(q);
        let fetchedUsers = snapshot.docs.map((docSnap) => ({
          uid: docSnap.id,
          ...(docSnap.data() as Record<string, any>)
        } as LeaderboardUser));
        fetchedUsers = fetchedUsers.filter((u) => {
          const name = (u.name || '').toLowerCase();
          const matchesRegion = activeTab !== 'region' || (u.region || 'Global') === (userData?.region || 'Global');
          const notBanned = !u.isBanned && !bannedUids.has(u.uid);
          return (
            notBanned &&
            matchesRegion &&
            !name.includes('взлом') &&
            !name.includes('hacked') &&
            !name.includes('breach') &&
            !name.includes('pwned') &&
            (typeof u.eplCoins !== 'number' || u.eplCoins <= 100000)
          );
        });
        setUsers(fetchedUsers);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Medal className="w-5 h-5 text-amber-400" />;
    if (index === 1) return <Medal className="w-5 h-5 text-zinc-400" />;
    if (index === 2) return <Medal className="w-5 h-5 text-amber-700" />;
    return <span className="w-5 text-center font-mono-num font-semibold text-sm opacity-60">{index + 1}</span>;
  };

  const currentUserRank = users.findIndex((u) => u.uid === currentUser?.uid);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div
        className={clsx(
          'px-6 py-5 border-b shrink-0',
          isFrutigerAero
            ? 'frutiger-aero-glass border-white/50'
            : isLight
            ? 'bg-white border-[#E2E5EA]'
            : 'bg-[#181B20] border-[#262B33]'
        )}
      >
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center gap-3">
            <div
              className={clsx(
                'w-10 h-10 rounded-lg border flex items-center justify-center shrink-0',
                isFrutigerAero
                  ? 'bg-white/60 border-white text-[#0284c7]'
                  : isLight
                  ? 'bg-[#F5F6F8] border-[#E2E5EA] text-[#059669]'
                  : 'bg-[#111315] border-[#262B33] text-[#10B981]'
              )}
            >
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {language === 'ru' ? 'Рейтинги' : 'Leaderboards'}
              </h1>
              <p className="text-sm opacity-70">
                {language === 'ru'
                  ? 'Лидеры платформы по балансу EPLCoins и популярности проектов'
                  : 'Top EPL creators by EPLCoins and project runs'}
              </p>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {[
              { id: 'global', label: 'Global', icon: Globe },
              { id: 'region', label: language === 'ru' ? 'Регион' : 'Region', icon: MapPin },
              { id: 'friends', label: language === 'ru' ? 'Друзья' : 'Friends', icon: Users },
              { id: 'popular', label: language === 'ru' ? 'Проекты' : 'Popular Apps', icon: Flame },
            ].map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as LeaderboardTab)}
                  className={clsx(
                    'flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap shrink-0',
                    active
                      ? isFrutigerAero
                        ? 'frutiger-aero-button'
                        : 'bg-[#10B981] border-[#10B981] text-[#09120E] font-semibold'
                      : isLight
                      ? 'bg-[#F5F6F8] border-[#E2E5EA] text-[#4B5563]'
                      : 'bg-[#111315] border-[#262B33] text-[#9CA3AF]'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#10B981]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-current border-t-transparent" />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-5">
            {currentUserRank !== -1 && activeTab !== 'popular' && (
              <div
                className={clsx(
                  'p-4 rounded-xl border flex items-center gap-4',
                  isFrutigerAero
                    ? 'frutiger-aero-glass'
                    : isLight
                    ? 'bg-white border-[#059669]/40'
                    : 'bg-[#181B20] border-[#10B981]/40'
                )}
              >
                <div className="w-8 flex justify-center shrink-0">{getRankIcon(currentUserRank)}</div>
                <img
                  src={users[currentUserRank].avatarUrl || getDefaultAvatar(users[currentUserRank].uid)}
                  alt="Avatar"
                  className="w-10 h-10 rounded-lg object-cover border border-current/15"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{language === 'ru' ? 'Ваша позиция' : 'Your Rank'}</div>
                  <div className="text-xs opacity-65">{users[currentUserRank].region || 'Global'}</div>
                </div>
                <div className="font-mono-num font-bold text-base text-[#10B981]">
                  {users[currentUserRank].eplCoins}
                </div>
              </div>
            )}

            <div
              className={clsx(
                'rounded-xl overflow-hidden border divide-y',
                isFrutigerAero
                  ? 'frutiger-aero-glass divide-white/40'
                  : isLight
                  ? 'bg-white border-[#E2E5EA] divide-[#E2E5EA]'
                  : 'bg-[#181B20] border-[#262B33] divide-[#262B33]'
              )}
            >
              {activeTab === 'popular' ? (
                popularProjects.map((project, index) => (
                  <div key={project.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="w-8 flex justify-center shrink-0">{getRankIcon(index)}</div>
                    <div
                      className={clsx(
                        'w-10 h-10 rounded-lg border flex items-center justify-center font-bold overflow-hidden shrink-0',
                        isLight
                          ? 'bg-[#F5F6F8] border-[#E2E5EA] text-[#059669]'
                          : 'bg-[#111315] border-[#262B33] text-[#10B981]'
                      )}
                    >
                      {project.iconUrl ? (
                        <img
                          src={project.iconUrl}
                          alt={project.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        (project.title || 'A').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{project.title}</div>
                      <div className="text-xs opacity-65 truncate">by {project.authorName}</div>
                    </div>
                    <div className="font-mono-num font-semibold text-sm text-[#10B981] shrink-0">
                      {project.visits || 0} runs
                    </div>
                  </div>
                ))
              ) : (
                users.map((u, index) => (
                  <div
                    key={u.uid}
                    className={clsx(
                      'flex items-center gap-4 px-5 py-3.5',
                      u.uid === currentUser?.uid && (isLight ? 'bg-[#F5F6F8]' : 'bg-[#20242B]/50')
                    )}
                  >
                    <div className="w-8 flex justify-center shrink-0">{getRankIcon(index)}</div>
                    <img
                      src={u.avatarUrl || getDefaultAvatar(u.uid)}
                      alt="Avatar"
                      className="w-10 h-10 rounded-lg object-cover border border-current/15 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm flex items-center gap-1.5 min-w-0">
                        {u.isVerifiedAuthor && <VerifiedBadge size="xs" />}
                        <span className="truncate">{u.name}</span>
                        <UserRoleBadge role={u.role} isVerifiedAuthor={u.isVerifiedAuthor} size="xs" showLabel />
                      </div>
                      <div className="text-xs opacity-65">{u.region || 'Global'}</div>
                    </div>
                    <div className="font-mono-num font-semibold text-sm text-[#10B981] shrink-0">
                      {u.eplCoins}
                    </div>
                  </div>
                ))
              )}

              {(activeTab === 'popular' ? popularProjects.length === 0 : users.length === 0) && (
                <div className="p-8 text-center text-sm opacity-60">No entries found for this leaderboard.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
