import React, { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query, orderBy, limit, where, doc, updateDoc, increment, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, sendProjectToVerify } from '../firebase';
import { useStore } from '../store/useStore';
import { Search, Star, Download, Play, Monitor, Smartphone, Apple, Terminal, Lock, ThumbsUp, ThumbsDown, RefreshCw, Flame, Clock, Coins } from 'lucide-react';
import { clsx } from 'clsx';
import { AppData, AppCategory, UserVote } from '../types';

const CATEGORIES: AppCategory[] = ['games', 'apps', 'work', 'AI', 'Programming Language', 'Store', 'Other'];

export default function StoreView() {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'featured' | 'recent'>('featured');
  const [selectedCategory, setSelectedCategory] = useState<AppCategory | 'all'>('all');
  const [downloadingApp, setDownloadingApp] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState<Record<string, 'like' | 'dislike'>>({});
  
  const theme = useStore(state => state.theme);
  const setCurrentView = useStore(state => state.setCurrentView);
  const setPlayingAppId = useStore(state => state.setPlayingAppId);
  const setSelectedAppId = useStore(state => state.setSelectedAppId);
  const user = useStore(state => state.user);
  const userData = useStore(state => state.userData);
  const isPremium = useStore(state => state.isPremium);

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

  const handlePlay = (app: AppData) => {
    setPlayingAppId(app.id);
    setCurrentView('player');
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
    <div className="h-full flex flex-col pb-20 sm:pb-8">
      {/* Header & Search */}
      <div className="p-4 sm:p-8 pb-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">App Store</h1>
            <p className={clsx("mt-1 text-xs sm:text-sm", theme !== 'light' ? 'text-zinc-400' : 'text-zinc-500')}>Discover programs written in EPL.</p>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            {user && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20">
                <Coins className="w-4 h-4" />
                <span className="font-bold">{userData?.eplCoins || 0}</span>
              </div>
            )}
            <div className="relative flex-1 sm:w-72 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search apps..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={clsx(
                    "w-full pl-10 pr-4 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors",
                    theme !== 'light' ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'
                  )}
                />
              </div>
              <button 
                onClick={fetchApps}
                className={clsx(
                  "p-2 rounded-xl border hover:bg-zinc-800 transition-all",
                  theme !== 'light' ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'
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
                ? "bg-emerald-500 text-white" 
                : theme !== 'light' ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
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
                  ? "bg-emerald-500 text-white" 
                  : theme !== 'light' ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* App List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 pt-0 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Featured Section on Mobile */}
            {activeTab === 'featured' && filteredApps.length > 0 && (
              <section className="sm:hidden">
                <h2 className="text-lg font-bold mb-4">Featured App</h2>
                <div 
                  onClick={() => setSelectedAppId(filteredApps[0].id)}
                  className={clsx(
                    "relative aspect-[16/9] rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl group cursor-pointer",
                    theme !== 'light' ? 'bg-zinc-900' : 'bg-white'
                  )}
                >
                  {filteredApps[0].bannerUrl ? (
                    <img 
                      src={filteredApps[0].bannerUrl} 
                      alt={filteredApps[0].title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                      <Play className="w-12 h-12 text-emerald-500/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold shadow-lg overflow-hidden">
                        {filteredApps[0].iconUrl ? (
                          <img src={filteredApps[0].iconUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          filteredApps[0].title.charAt(0)
                        )}
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-lg leading-tight">{filteredApps[0].title}</h3>
                        <p className="text-zinc-300 text-xs">{filteredApps[0].category}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredApps.map((app, index) => {
                // Skip the first app on mobile featured section to avoid duplication if needed
                // but usually it's fine to show it in the list too.
                return (
                  <div 
                    key={app.id} 
                    className={clsx(
                      "p-4 sm:p-6 rounded-2xl border transition-all hover:shadow-lg group flex flex-col",
                      theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200 hover:border-zinc-300'
                    )}
                  >
                    <div className="flex justify-between items-start mb-3 sm:mb-4">
                      <div 
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-white font-bold text-xl shadow-inner cursor-pointer overflow-hidden"
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
                      </div>
                      <div className="flex items-center gap-3">
                        {app.price && app.price > 0 && (
                          <div className="flex items-center gap-1 text-amber-400 bg-amber-400/10 px-2 py-1 rounded-lg text-[10px] sm:text-xs font-medium">
                            <Coins className="w-3 h-3 fill-current" />
                            {app.price}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-amber-400 bg-amber-400/10 px-2 py-1 rounded-lg text-[10px] sm:text-xs font-medium">
                          <Star className="w-3 h-3 fill-current" />
                          {app.rating.toFixed(1)}
                        </div>
                      </div>
                    </div>
                    
                    <h3 
                      className="text-base sm:text-lg font-semibold mb-1 truncate cursor-pointer hover:text-emerald-500 transition-colors"
                      onClick={() => setSelectedAppId(app.id)}
                    >
                      {app.title}
                    </h3>
                    <p className={clsx("text-xs sm:text-sm mb-4 line-clamp-2 flex-1", theme !== 'light' ? 'text-zinc-400' : 'text-zinc-500')}>
                      {app.description}
                    </p>
                    
                    <div className="flex flex-col gap-3 pt-3 sm:pt-4 border-t border-zinc-800/50">
                      <div className="flex items-center justify-between text-[10px] sm:text-xs text-zinc-500">
                        <span className="truncate max-w-[100px]">by {app.authorName}</span>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => handleVote(app.id, 'like')}
                            className={clsx("flex items-center gap-1 transition-colors", userVotes[app.id] === 'like' ? 'text-emerald-500' : 'hover:text-emerald-400')}
                          >
                            <ThumbsUp className={clsx("w-3 h-3 sm:w-3.5 sm:h-3.5", userVotes[app.id] === 'like' && "fill-current")} />
                            {app.likes || 0}
                          </button>
                          <button 
                            onClick={() => handleVote(app.id, 'dislike')}
                            className={clsx("flex items-center gap-1 transition-colors", userVotes[app.id] === 'dislike' ? 'text-red-500' : 'hover:text-red-400')}
                          >
                            <ThumbsDown className={clsx("w-3 h-3 sm:w-3.5 sm:h-3.5", userVotes[app.id] === 'dislike' && "fill-current")} />
                            {app.dislikes || 0}
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => handlePlay(app)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs sm:text-sm font-medium transition-colors"
                        >
                          <Play className="w-3.5 h-3.5" /> Play
                        </button>
                        
                        {['windows', 'macos', 'linux', 'apk'].map(platform => {
                          const url = (app as any)[`${platform}Url`];
                          if (!url && (!app.supportedPlatforms || !app.supportedPlatforms.includes(platform))) return null;
                          return (
                            <button
                              key={platform}
                              onClick={() => handleDownload(app, platform)}
                              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors"
                              title={`Download for ${platform}`}
                            >
                              {getPlatformIcon(platform)}
                            </button>
                          );
                        })}
                        {userData?.role === 'moderator' && app.status !== 'pending' && app.status !== 'verified' && (
                          <button
                            onClick={async () => {
                              await sendProjectToVerify(app.id);
                              alert('Project sent to verify!');
                            }}
                            className="p-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white rounded-xl transition-colors"
                            title="Send to Verify"
                          >
                            Send to Verify
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation (Mobile Style) */}
      <div className={clsx(
        "fixed bottom-0 left-0 right-0 h-16 border-t flex items-center justify-around px-6 z-40",
        theme !== 'light' ? 'bg-zinc-950/80 border-zinc-800 backdrop-blur-lg' : 'bg-white/80 border-zinc-200 backdrop-blur-lg',
        isPremium && theme === 'gradient' && "bg-gradient-to-r from-yellow-500/10 to-emerald-500/10 border-t-yellow-500/30"
      )}>
        <button 
          onClick={() => setActiveTab('featured')}
          className={clsx(
            "flex flex-col items-center gap-1 transition-colors p-2 rounded-xl",
            activeTab === 'featured' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300',
            (isPremium && theme === 'gradient') && "bg-gradient-to-r from-yellow-500/10 to-emerald-500/10 border border-yellow-500/20"
          )}
        >
          <Flame className="w-5 h-5" />
          <span className="text-[10px] font-medium uppercase tracking-wider">Featured</span>
        </button>
        <button 
          onClick={() => setActiveTab('recent')}
          className={clsx(
            "flex flex-col items-center gap-1 transition-colors p-2 rounded-xl",
            activeTab === 'recent' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300',
            (isPremium && theme === 'gradient') && "bg-gradient-to-r from-yellow-500/10 to-emerald-500/10 border border-yellow-500/20"
          )}
        >
          <Clock className="w-5 h-5" />
          <span className="text-[10px] font-medium uppercase tracking-wider">Recent</span>
        </button>
        <button 
          onClick={() => fetchApps()}
          className={clsx(
            "flex flex-col items-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors p-2 rounded-xl",
            (isPremium && theme === 'gradient') && "bg-gradient-to-r from-yellow-500/10 to-emerald-500/10 border border-yellow-500/20"
          )}
        >
          <RefreshCw className={clsx("w-5 h-5", loading && "animate-spin")} />
          <span className="text-[10px] font-medium uppercase tracking-wider">Refresh</span>
        </button>
      </div>
    </div>
  );
}
