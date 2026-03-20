import React, { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, increment, setDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store/useStore';
import { X, Star, Download, Play, Monitor, Smartphone, Apple, Terminal, ThumbsUp, ThumbsDown, User, Calendar, Tag } from 'lucide-react';
import { clsx } from 'clsx';
import { AppData, UserVote } from '../types';

export default function AppDetailView() {
  const selectedAppId = useStore(state => state.selectedAppId);
  const setSelectedAppId = useStore(state => state.setSelectedAppId);
  const theme = useStore(state => state.theme);
  const setPlayingAppId = useStore(state => state.setPlayingAppId);
  const setCurrentView = useStore(state => state.setCurrentView);
  const user = useStore(state => state.user);
  const setCopiedAppData = useStore(state => state.setCopiedAppData);
  const setEditingAppId = useStore(state => state.setEditingAppId);
  const [app, setApp] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userVote, setUserVote] = useState<'like' | 'dislike' | null>(null);
  const [activeTab, setActiveTab] = useState<'description' | 'screenshots' | 'downloads' | 'events'>('description');

  useEffect(() => {
    const fetchApp = async () => {
      if (!selectedAppId) return;
      setLoading(true);
      try {
        const docRef = doc(db, 'apps', selectedAppId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setApp({ id: docSnap.id, ...docSnap.data() } as AppData);
        }

        if (user) {
          const voteId = `${user.uid}_${selectedAppId}`;
          const voteSnap = await getDoc(doc(db, 'votes', voteId));
          if (voteSnap.exists()) {
            setUserVote(voteSnap.data().type);
          }
        }
      } catch (error) {
        console.error("Error fetching app details", error);
      } finally {
        setLoading(false);
      }
    };

    fetchApp();
  }, [selectedAppId, user]);

  const handleVote = async (type: 'like' | 'dislike') => {
    if (!user || !app) return;
    
    const voteId = `${user.uid}_${app.id}`;
    const voteRef = doc(db, 'votes', voteId);
    const appRef = doc(db, 'apps', app.id);
    
    try {
      if (userVote === type) {
        await deleteDoc(voteRef);
        await updateDoc(appRef, {
          [type === 'like' ? 'likes' : 'dislikes']: increment(-1)
        });
        setUserVote(null);
        setApp(prev => prev ? { ...prev, [type === 'like' ? 'likes' : 'dislikes']: prev[type === 'like' ? 'likes' : 'dislikes'] - 1 } : null);
      } else {
        await setDoc(voteRef, { userId: user.uid, appId: app.id, type });
        
        const updates: any = {
          [type === 'like' ? 'likes' : 'dislikes']: increment(1)
        };
        
        if (userVote) {
          updates[userVote === 'like' ? 'likes' : 'dislikes'] = increment(-1);
        }
        
        await updateDoc(appRef, updates);
        setUserVote(type);
        setApp(prev => {
          if (!prev) return null;
          const next = { ...prev };
          next[type === 'like' ? 'likes' : 'dislikes'] += 1;
          if (userVote) {
            next[userVote === 'like' ? 'likes' : 'dislikes'] -= 1;
          }
          return next;
        });
      }
    } catch (error) {
      console.error("Error voting", error);
    }
  };

  const handlePlay = () => {
    if (!app) return;
    setPlayingAppId(app.id);
    setCurrentView('player');
    setSelectedAppId(null);
  };

  const handleCopy = () => {
    if (!app) return;
    setCopiedAppData(app);
    setEditingAppId(null);
    setCurrentView('editor');
    setSelectedAppId(null);
  };

  const handleDownload = (platform: string) => {
    if (!app) return;
    const url = (app as any)[`${platform}Url`];
    if (url) {
      window.open(url, '_blank');
      updateDoc(doc(db, 'apps', app.id), { downloads: increment(1) });
    }
  };

  if (!selectedAppId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-8">
      <div className={clsx(
        "w-full max-w-4xl h-full max-h-[90vh] rounded-3xl overflow-hidden flex flex-col relative shadow-2xl border",
        theme !== 'light' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'
      )}>
        <button 
          onClick={() => setSelectedAppId(null)}
          className="absolute top-6 right-6 p-2 rounded-full bg-zinc-800/50 hover:bg-zinc-700 text-white z-10 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          </div>
        ) : app ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Hero Section */}
            <div 
              className="relative h-64 sm:h-80 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center p-8 overflow-hidden"
              style={app.bannerUrl ? {
                backgroundImage: `url(${app.bannerUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              } : {}}
            >
              {app.bannerUrl && <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />}
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-3xl bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-white font-bold text-5xl shadow-2xl transform hover:scale-105 transition-transform overflow-hidden">
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
            </div>

            <div className="p-6 sm:p-10">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-8">
                <div className="flex-1">
                  <h1 className="text-4xl font-bold mb-2">{app.title}</h1>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-400">
                    <span className="flex items-center gap-1.5"><User className="w-4 h-4" /> {app.authorName}</span>
                    <span className="flex items-center gap-1.5"><Tag className="w-4 h-4" /> {app.category}</span>
                    <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {new Date(app.createdAt).toLocaleDateString()}</span>
                    {app.originalAppId && app.originalAppName && (
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <Terminal className="w-4 h-4" />
                        Copied from: {app.originalAppName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center">
                    <button 
                      onClick={() => handleVote('like')}
                      className={clsx(
                        "p-3 rounded-2xl border transition-all",
                        userVote === 'like' 
                          ? "bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20" 
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      )}
                    >
                      <ThumbsUp className={clsx("w-6 h-6", userVote === 'like' && "fill-current")} />
                    </button>
                    <span className="text-xs mt-1 font-medium text-zinc-500">{app.likes || 0}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <button 
                      onClick={() => handleVote('dislike')}
                      className={clsx(
                        "p-3 rounded-2xl border transition-all",
                        userVote === 'dislike' 
                          ? "bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/20" 
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      )}
                    >
                      <ThumbsDown className={clsx("w-6 h-6", userVote === 'dislike' && "fill-current")} />
                    </button>
                    <span className="text-xs mt-1 font-medium text-zinc-500">{app.dislikes || 0}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-8">
                  <div className="flex items-center gap-6 border-b border-zinc-800/50 mb-6">
                    {(['description', 'screenshots', 'downloads', 'events'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={clsx(
                          "pb-4 text-sm font-medium transition-all relative",
                          activeTab === tab ? "text-emerald-500" : "text-zinc-500 hover:text-zinc-300"
                        )}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        {activeTab === tab && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>

                  {activeTab === 'description' && (
                    <section>
                      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        Description
                      </h2>
                      <p className={clsx("text-lg leading-relaxed whitespace-pre-wrap mb-8", theme !== 'light' ? 'text-zinc-300' : 'text-zinc-600')}>
                        {app.description}
                      </p>
                    </section>
                  )}

                  {activeTab === 'events' && (
                    <section>
                      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        Events
                      </h2>
                      {app.events && app.events.length > 0 ? (
                        <div className="space-y-4">
                          {app.events.map((event, index) => (
                            <div key={index} className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 flex items-center gap-4">
                              {event.imageUrl ? (
                                <img src={event.imageUrl} alt={event.title} className="w-16 h-16 rounded-lg object-cover" />
                              ) : (
                                <div className="w-16 h-16 rounded-lg bg-zinc-800" />
                              )}
                              <div>
                                <h3 className="font-bold text-zinc-200">{event.title}</h3>
                                <p className="text-sm text-zinc-400">{event.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-12 rounded-2xl bg-zinc-900/30 border border-zinc-800/50 text-center text-zinc-500">
                          No events available.
                        </div>
                      )}
                    </section>
                  )}

                  {activeTab === 'screenshots' && (
                    <section>
                      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        Screenshots
                      </h2>
                      {app.screenshotUrl ? (
                        <div className="rounded-2xl overflow-hidden border border-zinc-800/50 shadow-xl">
                          <img 
                            src={app.screenshotUrl} 
                            alt={`${app.title} Screenshot`} 
                            className="w-full h-auto object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="p-12 rounded-2xl bg-zinc-900/30 border border-zinc-800/50 text-center text-zinc-500">
                          No screenshots available.
                        </div>
                      )}
                    </section>
                  )}

                  {activeTab === 'downloads' && (
                    <section className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                          Available Platforms
                        </h2>
                        <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold uppercase tracking-wider">
                          Official
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-3 sm:gap-4">
                        {['windows', 'macos', 'linux', 'apk'].map(platform => {
                          const url = (app as any)[`${platform}Url`];
                          if (!url) return null;
                          return (
                            <button
                              key={platform}
                              onClick={() => handleDownload(platform)}
                              className={clsx(
                                "flex items-center justify-between p-4 sm:p-5 rounded-3xl transition-all group border",
                                theme !== 'light' ? 'bg-zinc-900/50 hover:bg-zinc-800/80 border-zinc-800 hover:border-zinc-700' : 'bg-white hover:bg-zinc-50 border-zinc-200 hover:border-zinc-300'
                              )}
                            >
                              <div className="flex items-center gap-4">
                                <div className={clsx(
                                  "w-12 h-12 flex items-center justify-center rounded-2xl transition-all group-hover:scale-110 duration-300",
                                  theme !== 'light' ? 'bg-zinc-800 text-zinc-400 group-hover:text-emerald-400' : 'bg-zinc-100 text-zinc-500 group-hover:text-emerald-500'
                                )}>
                                  {platform === 'windows' && <Monitor className="w-6 h-6" />}
                                  {platform === 'macos' && <Apple className="w-6 h-6" />}
                                  {platform === 'linux' && <Terminal className="w-6 h-6" />}
                                  {platform === 'apk' && <Smartphone className="w-6 h-6" />}
                                </div>
                                <div className="text-left">
                                  <div className="font-bold text-base sm:text-lg capitalize leading-tight">{platform}</div>
                                  <div className={clsx("text-[10px] sm:text-xs uppercase tracking-widest font-semibold", theme !== 'light' ? 'text-zinc-500' : 'text-zinc-400')}>
                                    {platform === 'apk' ? 'Android Package' : 'Desktop Version'}
                                  </div>
                                </div>
                              </div>
                              <div className={clsx(
                                "w-10 h-10 flex items-center justify-center rounded-full transition-all",
                                theme !== 'light' ? 'bg-zinc-800 text-zinc-400 group-hover:bg-emerald-500 group-hover:text-white' : 'bg-zinc-100 text-zinc-500 group-hover:bg-emerald-500 group-hover:text-white'
                              )}>
                                <Download className="w-5 h-5" />
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className={clsx("mt-8 p-6 rounded-3xl border border-dashed text-center", theme !== 'light' ? 'border-zinc-800 bg-zinc-900/20' : 'border-zinc-200 bg-zinc-50')}>
                        <p className={clsx("text-sm", theme !== 'light' ? 'text-zinc-500' : 'text-zinc-400')}>
                          All downloads are scanned for viruses and malware.
                        </p>
                      </div>
                    </section>
                  )}

                  <section className="p-6 rounded-2xl bg-zinc-900/30 border border-zinc-800/50">
                    <h3 className="text-sm font-medium uppercase tracking-wider text-zinc-500 mb-4">Stats</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{app.downloads}</div>
                        <div className="text-[10px] text-zinc-500 uppercase">Downloads</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold flex items-center justify-center gap-1">
                          {app.rating.toFixed(1)} <Star className="w-4 h-4 text-amber-400 fill-current" />
                        </div>
                        <div className="text-[10px] text-zinc-500 uppercase">Rating</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{app.version}</div>
                        <div className="text-[10px] text-zinc-500 uppercase">Version</div>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="space-y-6">
                  <button 
                    onClick={handlePlay}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-lg font-bold shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.98]"
                  >
                    <Play className="w-6 h-6 fill-current" /> Play Now
                  </button>
                  {app.allowCopy !== false && (
                    <button 
                      onClick={handleCopy}
                      className="w-full flex items-center justify-center gap-3 py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl text-lg font-bold shadow-xl transition-all active:scale-[0.98]"
                    >
                      <Terminal className="w-6 h-6" /> Copy & Edit App
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            App not found.
          </div>
        )}
      </div>
    </div>
  );
}
