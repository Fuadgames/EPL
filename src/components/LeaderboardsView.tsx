import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { collection, query, orderBy, limit, getDocs, where, documentId } from 'firebase/firestore';
import { db } from '../firebase';
import { Trophy, Globe, MapPin, Users, Medal, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { getDefaultAvatar } from '../lib/avatar';

type LeaderboardTab = 'global' | 'region' | 'friends' | 'popular';

interface LeaderboardUser {
  uid: string;
  name: string;
  avatarUrl: string;
  region: string;
  eplCoins: number;
}

interface PopularProject {
  id: string;
  title: string;
  authorName: string;
  visits: number;
  iconUrl: string;
}

export default function LeaderboardsView() {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('global');
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [popularProjects, setPopularProjects] = useState<PopularProject[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = useStore(state => state.user);
  const userData = useStore(state => state.userData);
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);

  useEffect(() => {
    fetchLeaderboard();
  }, [activeTab, userData]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      let q;
      const usersRef = collection(db, 'users_public');

      if (activeTab === 'global') {
        q = query(usersRef, orderBy('eplCoins', 'desc'), limit(100));
      } else if (activeTab === 'region') {
        const region = userData?.region || 'Global';
        q = query(usersRef, where('region', '==', region), orderBy('eplCoins', 'desc'), limit(100));
      } else if (activeTab === 'popular') {
        const appsRef = collection(db, 'apps');
        const popularQuery = query(appsRef, where('isPrivate', '==', false), orderBy('visits', 'desc'), limit(50));
        const snapshot = await getDocs(popularQuery);
        const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PopularProject));
        setPopularProjects(projects);
        setLoading(false);
        return;
      } else if (activeTab === 'friends') {
        const friendsList = userData?.friends || [];
        const uidsToFetch = [currentUser?.uid, ...friendsList].filter(Boolean) as string[];
        
        if (uidsToFetch.length > 0) {
          // Firestore 'in' query supports up to 10 items. We might need to chunk if more than 10 friends.
          // For simplicity, let's fetch all and sort client-side if it's a small list, or chunk it.
          const chunks = [];
          for (let i = 0; i < uidsToFetch.length; i += 10) {
            chunks.push(uidsToFetch.slice(i, i + 10));
          }
          
          let allFriends: LeaderboardUser[] = [];
          for (const chunk of chunks) {
            const chunkQuery = query(usersRef, where('uid', 'in', chunk));
            const snapshot = await getDocs(chunkQuery);
            const chunkUsers = snapshot.docs.map(doc => doc.data() as LeaderboardUser);
            allFriends = [...allFriends, ...chunkUsers];
          }
          
          allFriends.sort((a, b) => b.eplCoins - a.eplCoins);
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
        const fetchedUsers = snapshot.docs.map(doc => doc.data() as LeaderboardUser);
        setUsers(fetchedUsers);
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Medal className="w-6 h-6 text-yellow-400" />;
    if (index === 1) return <Medal className="w-6 h-6 text-zinc-400" />;
    if (index === 2) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="w-6 text-center font-bold text-zinc-500">{index + 1}</span>;
  };

  const currentUserRank = users.findIndex(u => u.uid === currentUser?.uid);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className={clsx(
        "p-6 border-b flex-shrink-0",
        isFrutigerAero ? "frutiger-aero-glass border-white/40" :
        theme === 'dark' ? "border-zinc-800 bg-zinc-900/50" :
        theme === 'gradient' ? "border-emerald-800/50 bg-emerald-950/50" :
        "border-zinc-200 bg-white"
      )}>
        <div className="flex items-center gap-3 mb-6">
          <div className={clsx(
            "p-3 rounded-xl",
            isFrutigerAero ? "bg-gradient-to-br from-blue-400 to-cyan-400 text-white shadow-sm" :
            "bg-emerald-500/20 text-emerald-500"
          )}>
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h1 className={clsx("text-2xl font-bold", isFrutigerAero ? "frutiger-aero-text" : "")}>Leaderboards</h1>
            <p className={clsx("text-sm", isFrutigerAero ? "text-blue-800/80" : "text-zinc-500")}>See who has the most EPLCoins</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar flex-nowrap touch-pan-x">
          <button
            onClick={() => setActiveTab('global')}
            className={clsx(
              "flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === 'global'
                ? (isFrutigerAero ? "bg-white/60 text-blue-900 shadow-sm" : "bg-emerald-500 text-white")
                : (isFrutigerAero ? "text-blue-800 hover:bg-white/40" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800")
            )}
          >
            <Globe className="w-4 h-4" />
            Global
          </button>
          <button
            onClick={() => setActiveTab('region')}
            className={clsx(
              "flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === 'region'
                ? (isFrutigerAero ? "bg-white/60 text-blue-900 shadow-sm" : "bg-emerald-500 text-white")
                : (isFrutigerAero ? "text-blue-800 hover:bg-white/40" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800")
            )}
          >
            <MapPin className="w-4 h-4" />
            Current Region
          </button>
          <button
            onClick={() => setActiveTab('friends')}
            className={clsx(
              "flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === 'friends'
                ? (isFrutigerAero ? "bg-white/60 text-blue-900 shadow-sm" : "bg-emerald-500 text-white")
                : (isFrutigerAero ? "text-blue-800 hover:bg-white/40" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800")
            )}
          >
            <Users className="w-4 h-4" />
            Friends
          </button>
          <button
            onClick={() => setActiveTab('popular')}
            className={clsx(
              "flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === 'popular'
                ? (isFrutigerAero ? "bg-white/60 text-blue-900 shadow-sm" : "bg-emerald-500 text-white")
                : (isFrutigerAero ? "text-blue-800 hover:bg-white/40" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800")
            )}
          >
            <Sparkles className="w-4 h-4" />
            Popular
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {currentUserRank !== -1 && (
              <div className={clsx(
                "p-4 rounded-xl mb-8 border-2 flex items-center gap-4",
                isFrutigerAero ? "bg-white/60 border-blue-400/50 shadow-md" :
                theme === 'dark' ? "bg-zinc-800/80 border-emerald-500/50" :
                theme === 'gradient' ? "bg-emerald-900/60 border-emerald-400/50" :
                "bg-emerald-50 border-emerald-200"
              )}>
                <div className="flex-shrink-0 w-12 flex justify-center">
                  {getRankIcon(currentUserRank)}
                </div>
                <img 
                  src={users[currentUserRank].avatarUrl || getDefaultAvatar(users[currentUserRank].uid)} 
                  alt="Avatar" 
                  className="w-10 h-10 rounded-full bg-zinc-200"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1">
                  <h3 className="font-bold">You</h3>
                  <p className="text-xs opacity-70">{users[currentUserRank].region}</p>
                </div>
                <div className="font-mono font-bold text-lg text-emerald-500">
                  {users[currentUserRank].eplCoins}
                </div>
              </div>
            )}

            <div className={clsx(
              "rounded-xl overflow-hidden border",
              isFrutigerAero ? "bg-white/40 border-white/50 shadow-sm" :
              theme === 'dark' ? "bg-zinc-900/50 border-zinc-800" :
              theme === 'gradient' ? "bg-zinc-900/30 border-emerald-800/30" :
              "bg-white border-zinc-200"
            )}>
              {activeTab === 'popular' ? (
                popularProjects.map((project, index) => (
                  <div 
                    key={project.id}
                    className={clsx(
                      "flex items-center gap-4 p-4 border-b last:border-0 transition-colors",
                      isFrutigerAero ? "hover:bg-white/60" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    )}
                  >
                    <div className="flex-shrink-0 w-12 flex justify-center">
                      {getRankIcon(index)}
                    </div>
                    <div className={clsx(
                      "w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold overflow-hidden",
                      isFrutigerAero ? "bg-gradient-to-br from-blue-400 to-cyan-400" : "bg-gradient-to-br from-emerald-400 to-cyan-400"
                    )}>
                      {project.iconUrl ? (
                        <img src={project.iconUrl} alt={project.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        project.title.charAt(0)
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold">{project.title}</h3>
                      <p className="text-xs opacity-70">by {project.authorName}</p>
                    </div>
                    <div className="font-mono font-bold text-emerald-500 flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {project.visits || 0}
                    </div>
                  </div>
                ))
              ) : (
                users.map((user, index) => (
                  <div 
                    key={user.uid}
                    className={clsx(
                      "flex items-center gap-4 p-4 border-b last:border-0 transition-colors",
                      user.uid === currentUser?.uid 
                        ? (isFrutigerAero ? "bg-blue-50/50" : theme === 'dark' ? "bg-zinc-800" : "bg-zinc-50")
                        : (isFrutigerAero ? "hover:bg-white/60" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50")
                    )}
                  >
                    <div className="flex-shrink-0 w-12 flex justify-center">
                      {getRankIcon(index)}
                    </div>
                    <img 
                      src={user.avatarUrl || getDefaultAvatar(user.uid)} 
                      alt="Avatar" 
                      className="w-10 h-10 rounded-full bg-zinc-200"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1">
                      <h3 className="font-bold flex items-center gap-2">
                        {user.name}
                        {user.uid === currentUser?.uid && <span className="text-[10px] uppercase tracking-wider bg-emerald-500 text-white px-2 py-0.5 rounded-full">You</span>}
                      </h3>
                      <p className="text-xs opacity-70">{user.region}</p>
                    </div>
                    <div className="font-mono font-bold text-emerald-500">
                      {user.eplCoins}
                    </div>
                  </div>
                ))
              )}
              
              {(activeTab === 'popular' ? popularProjects.length === 0 : users.length === 0) && (
                <div className="p-8 text-center opacity-50">
                  No users found for this leaderboard.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
