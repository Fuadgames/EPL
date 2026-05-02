import React, { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, increment, setDoc, collection, query, where, getDocs, deleteDoc, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store/useStore';
import { X, Star, Download, Play, Monitor, Smartphone, Apple, Terminal, ThumbsUp, ThumbsDown, User, Calendar, Tag, CheckCircle, Coins, MessageSquare, Code2, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { AppData, UserVote } from '../types';

export default function AppDetailView() {
  const selectedAppId = useStore(state => state.selectedAppId);
  const setSelectedAppId = useStore(state => state.setSelectedAppId);
  const theme = useStore(state => state.theme);
  const setPlayingAppId = useStore(state => state.setPlayingAppId);
  const setCurrentView = useStore(state => state.setCurrentView);
  const user = useStore(state => state.user);
  const userData = useStore(state => state.userData);
  const setUserData = useStore(state => state.setUserData);
  const setCopiedAppData = useStore(state => state.setCopiedAppData);
  const setEditingAppId = useStore(state => state.setEditingAppId);
  const isPremium = useStore(state => state.isPremium);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const [app, setApp] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userVote, setUserVote] = useState<'like' | 'dislike' | null>(null);
  const [activeTab, setActiveTab] = useState<'description' | 'screenshots' | 'downloads' | 'events' | 'comments'>('description');
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [buying, setBuying] = useState(false);

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
        
        // Fetch comments
        try {
          const commentsQ = query(collection(db, 'comments'), where('appId', '==', selectedAppId), orderBy('createdAt', 'desc'));
          const commentsSnap = await getDocs(commentsQ);
          setComments(commentsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (commentError) {
          console.error("Error fetching comments", commentError);
          setComments([]); // Fallback to empty comments if permission denied
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

  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [unlockError, setUnlockError] = useState('');

  const handlePlay = () => {
    if (!app) return;
    if (app.isLocked && app.authorId !== user?.uid && app.unlockCode) {
      setShowUnlockModal(true);
      return;
    }
    proceedToPlay();
  };

  const proceedToPlay = () => {
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

  const [downloadingApp, setDownloadingApp] = useState<string | null>(null);

  const handleDownload = (platform: string) => {
    if (!app) return;
    const url = (app as any)[`${platform}Url`];
    if (url && platform !== 'source') {
      window.open(url, '_blank');
      updateDoc(doc(db, 'apps', app.id), { downloads: increment(1) });
    } else {
      // Fallback to simulated download of raw code
      setDownloadingApp(`${app.id}-${platform}`);
      setTimeout(() => {
        const blob = new Blob([app.code], { type: 'text/plain' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        
        let ext = '.epl';
        if (platform === 'windows') ext = '.exe';
        if (platform === 'macos') ext = '.app';
        if (platform === 'linux') ext = '.AppImage';
        if (platform === 'apk') ext = '.apk';
        
        a.download = `${app.title}${ext}`;
        a.click();
        setDownloadingApp(null);
      }, 1000);
    }
  };

  const handleBuy = async () => {
    if (!user || !userData || !app || !app.price) return;
    if ((userData.eplCoins || 0) < app.price) {
      alert("Not enough EPLCoins!");
      return;
    }
    
    setBuying(true);
    try {
      const newCoins = (userData.eplCoins || 0) - app.price;
      const newPurchased = [...(userData.purchasedItems || []), app.id];
      
      await updateDoc(doc(db, 'users', user.uid), {
        eplCoins: newCoins,
        purchasedApps: [...(userData.purchasedApps || []), app.id]
      });
      
      // Give coins to author
      if (app.authorId) {
        const authorRef = doc(db, 'users', app.authorId);
        await updateDoc(authorRef, {
          eplCoins: increment(app.price)
        });
      }
      
      setUserData({ ...userData, eplCoins: newCoins, purchasedApps: [...(userData.purchasedApps || []), app.id] });
    } catch (error) {
      console.error("Error buying app", error);
    } finally {
      setBuying(false);
    }
  };

  const handleAddComment = async () => {
    if (!user || !newComment.trim() || !app) return;
    
    try {
      const commentData = {
        appId: app.id,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        text: newComment.trim(),
        createdAt: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, 'comments'), commentData);
      setComments([{ id: docRef.id, ...commentData }, ...comments]);
      setNewComment('');
    } catch (error) {
      console.error("Error adding comment", error);
    }
  };

  if (!selectedAppId) return null;

  const isPurchased = !app?.price || app.price === 0 || (userData?.purchasedApps || []).includes(app?.id || '') || app?.authorId === user?.uid;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-8">
      <div className={clsx(
        "w-full max-w-4xl h-full max-h-[90vh] rounded-3xl overflow-hidden flex flex-col relative shadow-2xl border",
        isFrutigerAero && "frutiger-aero-bg",
        !isFrutigerAero && (theme !== 'light' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200')
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
                  <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                    {app.title}
                    {app.status === 'verified' && (
                      <span className="flex items-center gap-1 text-sm bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-full">
                        <CheckCircle className="w-4 h-4" /> Verified
                      </span>
                    )}
                  </h1>
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
                  <div className="flex items-center gap-6 border-b border-zinc-800/50 mb-6 overflow-x-auto custom-scrollbar pb-2">
                    {(['description', 'screenshots', 'downloads', 'events', 'comments'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={clsx(
                          "pb-4 text-sm font-medium transition-all relative whitespace-nowrap",
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
                        {['windows', 'macos', 'linux', 'apk', 'source'].map(platform => {
                          const url = platform !== 'source' ? (app as any)[`${platform}Url`] : null;
                          if (platform !== 'source' && !url) return null;
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
                                  {platform === 'source' && <Code2 className="w-6 h-6" />}
                                </div>
                                <div className="text-left">
                                  <div className="font-bold text-base sm:text-lg capitalize leading-tight">{platform === 'source' ? 'Source Code' : platform}</div>
                                  <div className={clsx("text-[10px] sm:text-xs uppercase tracking-widest font-semibold", theme !== 'light' ? 'text-zinc-500' : 'text-zinc-400')}>
                                    {platform === 'apk' ? 'Android Package' : platform === 'source' ? '.epl Project File' : 'Desktop Version'}
                                  </div>
                                </div>
                              </div>
                              <div className={clsx(
                                "w-10 h-10 flex items-center justify-center rounded-full transition-all",
                                theme !== 'light' ? 'bg-zinc-800 text-zinc-400 group-hover:bg-emerald-500 group-hover:text-white' : 'bg-zinc-100 text-zinc-500 group-hover:bg-emerald-500 group-hover:text-white'
                              )}>
                                {downloadingApp === `${app.id}-${platform}` ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
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

                  {activeTab === 'comments' && (
                    <section className="space-y-6">
                      <h2 className="text-xl font-semibold flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" /> Comments
                      </h2>
                      
                      {user ? (
                        <div className="flex gap-4">
                          <input
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Write a comment..."
                            className={clsx(
                              "flex-1 px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500",
                              theme !== 'light' ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'
                            )}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                          />
                          <button
                            onClick={handleAddComment}
                            disabled={!newComment.trim()}
                            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl font-medium transition-colors"
                          >
                            Post
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 text-center text-zinc-500">
                          Please sign in to comment.
                        </div>
                      )}

                      <div className="space-y-4">
                        {comments.length > 0 ? comments.map(comment => (
                          <div key={comment.id} className={clsx(
                            "p-4 rounded-xl border",
                            theme !== 'light' ? 'bg-zinc-900/30 border-zinc-800' : 'bg-white border-zinc-200'
                          )}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-sm">{comment.userName}</span>
                              <span className="text-xs text-zinc-500">{new Date(comment.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm text-zinc-300">{comment.text}</p>
                          </div>
                        )) : (
                          <div className="text-center text-zinc-500 py-8">No comments yet. Be the first!</div>
                        )}
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
                  {!isPurchased ? (
                    <button 
                      onClick={handleBuy}
                      disabled={buying}
                      className="w-full flex items-center justify-center gap-3 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-2xl text-lg font-bold shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.98]"
                    >
                      <Coins className="w-6 h-6" /> Buy for {app.price} Coins
                    </button>
                  ) : (
                    <button 
                      onClick={handlePlay}
                      className="w-full flex items-center justify-center gap-3 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-lg font-bold shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.98]"
                    >
                      <Play className="w-6 h-6 fill-current" /> Play Now
                    </button>
                  )}
                  {app.allowCopy !== false && isPurchased && (
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
                }}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-white hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (enteredCode === app?.unlockCode) {
                    setShowUnlockModal(false);
                    setEnteredCode('');
                    proceedToPlay();
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
