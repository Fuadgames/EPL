import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, getDocs, query, orderBy, limit, where, doc, updateDoc, increment, setDoc, getDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { db, sendProjectToVerify } from '../firebase';
import { useStore } from '../store/useStore';
import { translations } from '../lib/translations';
import { Search, Star, Download, Play, Monitor, Smartphone, Apple, Terminal, Lock, ThumbsUp, ThumbsDown, RefreshCw, Flame, Clock, Coins, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { AppData, AppCategory, UserVote } from '../types';
import FriendsView from './FriendsView';
import Gradient from './Gradient';

const CATEGORIES: AppCategory[] = ['games', 'apps', 'work', 'AI', 'Programming Language', 'Store', 'Other'];

export default function StoreView() {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'featured' | 'recent' | 'friends'>('featured');
  const [selectedCategory, setSelectedCategory] = useState<AppCategory | 'all'>('all');
  const [downloadingApp, setDownloadingApp] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState<Record<string, 'like' | 'dislike'>>({});
  
  const theme = useStore(state => state.theme);
  const setCurrentView = useStore(state => state.setCurrentView);
  const setPlayingAppId = useStore(state => state.setPlayingAppId);
  const setSelectedAppId = useStore(state => state.setSelectedAppId);
  const user = useStore(state => state.user);
  const userData = useStore(state => state.userData);
  const simulatedRole = useStore(state => state.simulatedRole);
  const effectiveRole = (userData?.role === 'developer' && simulatedRole) ? simulatedRole : userData?.role;
  const isPremium = useStore(state => state.isPremium);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const language = useStore(state => state.language);

  const fetchApps = useCallback(async () => {
    setLoading(true);
    try {
      let q;
      if (activeTab === 'featured') {
        q = query(collection(db, 'apps'), orderBy('downloads', 'desc'), limit(50));
      } else {
        q = query(collection(db, 'apps'), orderBy('createdAt', 'desc'), limit(50));
      }
      
      const snapshot = await getDocs(q);
      let appsData = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) } as AppData));
      
      // Filter out private apps - they should only appear in "My Apps"
      appsData = appsData.filter(app => !app.isPrivate);
      
      if (selectedCategory !== 'all') {
        appsData = appsData.filter(app => app.category === selectedCategory);
      }
      
      setApps(appsData);

      // Fetch user votes if logged in
      if (user) {
        const votesSnapshot = await getDocs(query(collection(db, 'votes'), where('userId', '==', user.uid)));
        const votes: Record<string, 'like' | 'dislike'> = {};
        votesSnapshot.docs.forEach(doc => {
          const data = doc.data() as UserVote;
          votes[data.appId] = data.type;
        });
        setUserVotes(votes);
      }
    } catch (error) {
      console.error("Error fetching apps", error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedCategory, user]);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const handleVote = async (appId: string, type: 'like' | 'dislike') => {
    if (!user) return;
    
    const voteId = `${user.uid}_${appId}`;
    const voteRef = doc(db, 'votes', voteId);
    const appRef = doc(db, 'apps', appId);
    
    const currentVote = userVotes[appId];
    
    try {
      if (currentVote === type) {
        // Remove vote
        await deleteDoc(voteRef);
        await updateDoc(appRef, {
          [type === 'like' ? 'likes' : 'dislikes']: increment(-1)
        });
        setUserVotes(prev => {
          const next = { ...prev };
          delete next[appId];
          return next;
        });
      } else {
        // Add or change vote
        await setDoc(voteRef, { userId: user.uid, appId, type });
        
        const updates: any = {
          [type === 'like' ? 'likes' : 'dislikes']: increment(1)
        };
        
        if (currentVote) {
          updates[currentVote === 'like' ? 'likes' : 'dislikes'] = increment(-1);
        }
        
        await updateDoc(appRef, updates);
        setUserVotes(prev => ({ ...prev, [appId]: type }));
      }
    } catch (error) {
      console.error("Error voting", error);
    }
  };

  const [enteredCode, setEnteredCode] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockTargetApp, setUnlockTargetApp] = useState<AppData | null>(null);

  const proceedToPlay = async (app: AppData) => {
    // Increment visits
    try {
      await updateDoc(doc(db, 'apps', app.id), {
        visits: increment(1)
      });
    } catch (error) {
      console.error("Error incrementing visits", error);
    }

    // Check if update is needed
    const installedAppVersion = userData?.installedApps?.[app.id];
    if (installedAppVersion && installedAppVersion !== app.version) {
      // Update logic
      if (userData?.uid) {
        await updateDoc(doc(db, 'users', userData.uid), {
          [`installedApps.${app.id}`]: app.version
        });
        alert(language === 'ru' ? "Приложение обновлено!" : "App updated!");
      }
    }

    setPlayingAppId(app.id);
    setCurrentView('player');
  };

  const handlePlay = async (app: AppData) => {
    if (!user) return alert("Please sign in to play apps.");
    
    // Check if app is paid and not purchased
    const isPurchased = userData?.purchasedApps?.includes(app.id) || app.authorId === user.uid || !app.price || app.price === 0;
    
    if (!isPurchased) {
      if ((userData?.eplCoins || 0) < (app.price || 0)) {
        return alert(language === 'ru' ? "Недостаточно EPLCoins!" : "Not enough EPLCoins!");
      }
      
      const confirmPurchase = window.confirm(language === 'ru' ? `Купить ${app.title} за ${app.price} EPLCoins?` : `Buy ${app.title} for ${app.price} EPLCoins?`);
      if (!confirmPurchase) return;
      
      try {
        // Deduct from buyer
        await updateDoc(doc(db, 'users', user.uid), {
          eplCoins: increment(-(app.price || 0)),
          purchasedApps: arrayUnion(app.id),
          [`installedApps.${app.id}`]: app.version
        });
        
        // Add to seller
        if (app.authorId) {
          const sellerRef = doc(db, 'users', app.authorId);
          await updateDoc(sellerRef, {
            eplCoins: increment(app.price || 0)
          });
          
          // Also update public profile coins
          const sellerPublicRef = doc(db, 'users_public', app.authorId);
          const sellerPublicSnap = await getDoc(sellerPublicRef);
          if (sellerPublicSnap.exists()) {
            await updateDoc(sellerPublicRef, {
              eplCoins: increment(app.price || 0)
            });
          }
        }
        
        alert(language === 'ru' ? "Приложение куплено!" : "App purchased!");
      } catch (error) {
        console.error("Error purchasing app", error);
        return alert("Purchase failed. Please try again.");
      }
    }

    if (app.isLocked && app.authorId !== user?.uid && app.unlockCode) {
      setUnlockTargetApp(app);
      setShowUnlockModal(true);
      return;
    }

    await proceedToPlay(app);
  };

  const handleDownload = (app: AppData, platform: string) => {
    const url = (app as any)[`${platform}Url`];
    if (url) {
      window.open(url, '_blank');
      updateDoc(doc(db, 'apps', app.id), { downloads: increment(1) });
    } else {
      // Fallback to simulated download
      setDownloadingApp(`${app.id}-${platform}`);
      setTimeout(() => {
        const blob = new Blob([app.code], { type: 'text/plain' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${app.title}-${platform}.txt`;
        a.click();
        setDownloadingApp(null);
      }, 1000);
    }
  };

  const filteredApps = apps.filter(app => 
    app.title.toLowerCase().includes(search.toLowerCase()) || 
    app.description.toLowerCase().includes(search.toLowerCase())
  );

  const getPlatformIcon = (platform: string) => {
    switch(platform) {
      case 'windows': return <Monitor className="w-3 h-3" />;
      case 'macos': return <Apple className="w-3 h-3" />;
      case 'linux': return <Terminal className="w-3 h-3" />;
      case 'apk': return <Smartphone className="w-3 h-3" />;
      default: return null;
    }
  };

  return (
    <div className="h-full flex flex-col pb-8">
      {/* Header & Search */}
      <div className="p-4 sm:p-8 pb-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className={clsx("text-2xl sm:text-3xl font-bold tracking-tight", isFrutigerAero ? "text-blue-900" : "")}>App Store</h1>
            <p className={clsx("mt-1 text-xs sm:text-sm", isFrutigerAero ? "text-blue-800/70" : theme !== 'light' ? 'text-zinc-400' : 'text-zinc-500')}>Discover programs written in EPL.</p>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            {user && (
              <div className={clsx("flex items-center gap-2 px-3 py-1.5 rounded-xl border", isFrutigerAero ? "bg-white/50 text-blue-800 border-white/40 shadow-sm" : "bg-amber-500/10 text-amber-500 border-amber-500/20")}>
                <Coins className="w-4 h-4" />
                <span className="font-bold">{userData?.eplCoins || 0}</span>
              </div>
            )}
            <div className="relative flex-1 sm:w-72 flex gap-2">
              <div className="relative flex-1">
                <Search className={clsx("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", isFrutigerAero ? "text-blue-500" : "text-zinc-400")} />
                <input
                  type="text"
                  placeholder="Search apps..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={clsx(
                    "w-full pl-10 pr-4 py-2 rounded-xl border focus:outline-none focus:ring-2 transition-colors",
                    isFrutigerAero ? "bg-white/60 border-white/40 text-blue-900 placeholder-blue-400 focus:ring-blue-400 backdrop-blur-md shadow-inner" :
                    theme !== 'light' ? 'bg-zinc-900 border-zinc-800 text-zinc-100 focus:ring-emerald-500' : 'bg-white border-zinc-200 text-zinc-900 focus:ring-emerald-500'
                  )}
                />
              </div>
              <button 
                onClick={fetchApps}
                className={clsx(
                  "p-2 rounded-xl border transition-all",
                  isFrutigerAero ? "frutiger-aero-button" :
                  theme !== 'light' ? 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800' : 'bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-100'
                )}
              >
                <RefreshCw className={clsx("w-5 h-5", loading && "animate-spin")} />
              </button>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
          <button
            onClick={() => setSelectedCategory('all')}
            className={clsx(
              "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
              selectedCategory === 'all' 
                ? (isFrutigerAero ? 'bg-blue-500 text-white shadow-md' : 'bg-emerald-500 text-white') 
                : (isFrutigerAero ? 'bg-white/40 text-blue-800 hover:bg-white/60 backdrop-blur-sm' : theme !== 'light' ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200')
            )}
          >
            All
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={clsx(
                "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors capitalize",
                selectedCategory === cat 
                  ? (isFrutigerAero ? 'bg-blue-500 text-white shadow-md' : 'bg-emerald-500 text-white') 
                  : (isFrutigerAero ? 'bg-white/40 text-blue-800 hover:bg-white/60 backdrop-blur-sm' : theme !== 'light' ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200')
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 pb-6 overflow-x-auto no-scrollbar px-1 sticky top-0 z-10">
          <button 
            onClick={() => setActiveTab('featured')}
            className={clsx(
              "flex items-center gap-2 px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all border min-h-[48px] shadow-sm",
              activeTab === 'featured' 
                ? (isFrutigerAero ? "bg-blue-500 text-white border-blue-400 shadow-blue-500/20" : "bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/20") 
                : (isFrutigerAero ? "bg-white/60 text-blue-800 border-white/50 backdrop-blur-md" : theme !== 'light' ? "bg-zinc-900 border-zinc-800 text-zinc-400" : "bg-white border-zinc-200 text-zinc-600")
            )}
          >
            <Flame className="w-5 h-5" />
            Featured
          </button>
          <button 
            onClick={() => setActiveTab('recent')}
            className={clsx(
              "flex items-center gap-2 px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all border min-h-[48px] shadow-sm",
              activeTab === 'recent' 
                ? (isFrutigerAero ? "bg-blue-500 text-white border-blue-400 shadow-blue-500/20" : "bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/20") 
                : (isFrutigerAero ? "bg-white/60 text-blue-800 border-white/50 backdrop-blur-md" : theme !== 'light' ? "bg-zinc-900 border-zinc-800 text-zinc-400" : "bg-white border-zinc-200 text-zinc-600")
            )}
          >
            <Clock className="w-5 h-5" />
            Recent
          </button>
          <button 
            onClick={() => setActiveTab('friends')}
            className={clsx(
              "flex items-center gap-2 px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all border min-h-[48px] shadow-sm",
              activeTab === 'friends' 
                ? (isFrutigerAero ? "bg-blue-500 text-white border-blue-400 shadow-blue-500/20" : "bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/20") 
                : (isFrutigerAero ? "bg-white/60 text-blue-800 border-white/50 backdrop-blur-md" : theme !== 'light' ? "bg-zinc-900 border-zinc-800 text-zinc-400" : "bg-white border-zinc-200 text-zinc-600")
            )}
          >
            <Users className="w-5 h-5" />
            Friends
          </button>
        </div>
      </div>

      {activeTab === 'friends' ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <FriendsView />
        </div>
      ) : (
        /* App List */
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 pt-0 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : (
          <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-10 sm:gap-12">
              <AnimatePresence mode="popLayout">
                {filteredApps.map((app, index) => {
                  return (
                    <motion.div 
                      key={app.id} 
                      layout
                      initial={{ opacity: 0, y: 30, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                      whileHover={{ y: -8, transition: { duration: 0.2 } }}
                      transition={{ 
                        type: "spring",
                        stiffness: 260,
                        damping: 20,
                        delay: index * 0.03 
                      }}
                      className={clsx(
                        "p-8 sm:p-10 rounded-[2.5rem] border transition-all hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] group flex flex-col relative overflow-hidden",
                        isFrutigerAero ? "bg-white/40 border-white/50 backdrop-blur-md shadow-sm hover:bg-white/50" :
                        theme !== 'light' ? 'bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-900/20 border-zinc-800 hover:border-emerald-500/40' : 'bg-gradient-to-br from-white via-white to-emerald-50/30 border-zinc-200 hover:border-emerald-500/40'
                      )}
                    >
                      {/* Decorative Gradient Blob */}
                      <Gradient className="-top-24 -right-24 w-48 h-48" variant="emerald" />
                      
                      <div className="flex justify-between items-start mb-6 sm:mb-8 relative z-10">
                        <motion.div 
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          className={clsx(
                            "w-20 h-20 sm:w-24 sm:h-24 rounded-3xl sm:rounded-[2rem] flex items-center justify-center text-white font-bold text-3xl shadow-xl cursor-pointer overflow-hidden border-2",
                            isFrutigerAero ? "bg-gradient-to-br from-blue-400 to-cyan-400 border-white/50" : "bg-gradient-to-br from-emerald-400 to-cyan-400 border-white/10"
                          )}
                          onClick={() => setSelectedAppId(app.id)}
                        >
                        {app.iconUrl ? (
                          <img 
                            src={app.iconUrl} 
                            alt={app.title} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          app.title.charAt(0)
                        )}
                      </motion.div>
                        <div className="flex flex-col items-end gap-2">
                          {app.price && app.price > 0 && (
                            <motion.div 
                              initial={{ x: 20, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              className="flex items-center gap-1.5 text-amber-400 bg-amber-400/10 px-4 py-2 rounded-full text-sm font-bold border border-amber-400/20 backdrop-blur-sm"
                            >
                              <Coins className="w-4 h-4 fill-current" />
                              {app.price}
                            </motion.div>
                          )}
                          <motion.div 
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 px-4 py-2 rounded-full text-sm font-bold border border-emerald-400/20 backdrop-blur-sm"
                          >
                            <Star className="w-4 h-4 fill-current" />
                            {app.rating.toFixed(1)}
                          </motion.div>
                        </div>
                      </div>
                      
                      <div className="relative z-10 flex-1 flex flex-col">
                        <h3 
                          className={clsx("text-xl sm:text-2xl font-bold mb-3 truncate cursor-pointer transition-colors", isFrutigerAero ? "text-blue-900 hover:text-blue-600" : "hover:text-emerald-500")}
                          onClick={() => setSelectedAppId(app.id)}
                        >
                          {app.title}
                        </h3>
                        <p className={clsx("text-sm sm:text-base mb-8 line-clamp-3 flex-1 leading-relaxed opacity-80", isFrutigerAero ? "text-blue-800" : theme !== 'light' ? 'text-zinc-400' : 'text-zinc-500')}>
                          {app.description}
                        </p>
                        
                        <div className={clsx("flex flex-col gap-6 pt-6 border-t", isFrutigerAero ? "border-white/30" : "border-zinc-800/50")}>
                          <div className={clsx("flex items-center justify-between text-sm", isFrutigerAero ? "text-blue-700/70" : "text-zinc-500")}>
                            <div className="flex items-center gap-2 truncate max-w-[200px]">
                              <span className="font-bold text-emerald-500/80">by {app.authorName}</span>
                              <span className="opacity-30">•</span>
                              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {app.visits || 0}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <button 
                                onClick={() => handleVote(app.id, 'like')}
                                className={clsx("flex items-center gap-1.5 transition-all hover:scale-110", userVotes[app.id] === 'like' ? (isFrutigerAero ? 'text-blue-600' : 'text-emerald-500') : (isFrutigerAero ? 'hover:text-blue-500' : 'hover:text-emerald-400'))}
                              >
                                <ThumbsUp className={clsx("w-4 h-4", userVotes[app.id] === 'like' && "fill-current")} />
                                <span className="font-bold">{app.likes || 0}</span>
                              </button>
                              <button 
                                onClick={() => handleVote(app.id, 'dislike')}
                                className={clsx("flex items-center gap-1.5 transition-all hover:scale-110", userVotes[app.id] === 'dislike' ? 'text-red-500' : 'hover:text-red-400')}
                              >
                                <ThumbsDown className={clsx("w-4 h-4", userVotes[app.id] === 'dislike' && "fill-current")} />
                                <span className="font-bold">{app.dislikes || 0}</span>
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-3">
                            <motion.button 
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handlePlay(app)}
                              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[1.5rem] text-base sm:text-lg font-bold transition-all shadow-xl shadow-emerald-500/30"
                            >
                              <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
                              {userData?.installedApps?.[app.id] && userData.installedApps[app.id] !== app.version
                                ? (translations[language].update || 'Update') 
                                : (translations[language].play || 'Play')}
                            </motion.button>
                            
                            {['windows', 'macos', 'linux', 'apk'].map(platform => {
                              const url = (app as any)[`${platform}Url`];
                              if (!url && (!app.supportedPlatforms || !app.supportedPlatforms.includes(platform))) return null;
                              return (
                                <motion.button
                                  key={platform}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleDownload(app, platform)}
                                  className="p-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-[1.5rem] transition-colors shadow-lg"
                                  title={`Download for ${platform}`}
                                >
                                  {getPlatformIcon(platform)}
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
      )}

      {showUnlockModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-sm">
            <h3 className="text-xl font-bold text-white mb-4">Enter Access Code</h3>
            <p className="text-sm text-zinc-400 mb-4">This app is locked by the creator. Please enter the code to access.</p>
            <input
              type="text"
              value={enteredCode}
              onChange={(e) => {
                setEnteredCode(e.target.value);
                setUnlockError('');
              }}
              placeholder="Access code..."
              className="w-full bg-zinc-800 border-zinc-700 rounded-xl px-4 py-2 text-white mb-4 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            {unlockError && <p className="text-red-500 text-sm mb-4">{unlockError}</p>}
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => {
                  setShowUnlockModal(false);
                  setEnteredCode('');
                  setUnlockError('');
                  setUnlockTargetApp(null);
                }}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-white hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (unlockTargetApp && enteredCode === unlockTargetApp.unlockCode) {
                    setShowUnlockModal(false);
                    setEnteredCode('');
                    proceedToPlay(unlockTargetApp);
                    setUnlockTargetApp(null);
                  } else {
                    setUnlockError('Incorrect code');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 font-medium"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
