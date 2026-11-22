import React, { useEffect, useState, useTransition } from 'react';
import {
  doc,
  getDoc,
  updateDoc,
  increment,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  addDoc,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store/useStore';
import { notify } from '../store/useDialogStore';
import {
  X,
  Star,
  Download,
  Play,
  Monitor,
  Smartphone,
  Apple,
  Terminal,
  ThumbsUp,
  ThumbsDown,
  User,
  Calendar,
  Tag,
  CheckCircle,
  MessageSquare,
  CheckCircle2,
  Layers,
  Coins,
  FileCode,
} from 'lucide-react';
import { clsx } from 'clsx';
import { AppData } from '../types';
import BuildDownloadModal from './BuildDownloadModal';

export default function AppDetailView() {
  const selectedAppId = useStore((state) => state.selectedAppId);
  const setSelectedAppId = useStore((state) => state.setSelectedAppId);
  const theme = useStore((state) => state.theme);
  const language = useStore((state) => state.language);
  const setPlayingAppId = useStore((state) => state.setPlayingAppId);
  const setCurrentView = useStore((state) => state.setCurrentView);
  const user = useStore((state) => state.user);
  const userData = useStore((state) => state.userData);
  const setUserData = useStore((state) => state.setUserData);
  const setCopiedAppData = useStore((state) => state.setCopiedAppData);
  const setEditingAppId = useStore((state) => state.setEditingAppId);
  const isFrutigerAero = useStore((state) => state.isFrutigerAero);
  const isAppInstalled = useStore((state) => state.isAppInstalled);
  const installApp = useStore((state) => state.installApp);
  const [, startTransition] = useTransition();

  const [app, setApp] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userVote, setUserVote] = useState<'like' | 'dislike' | null>(null);
  const [activeTab, setActiveTab] = useState<'description' | 'screenshots' | 'downloads' | 'events' | 'comments'>('description');
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [buying, setBuying] = useState(false);
  const [buildPlatform, setBuildPlatform] = useState<string>('windows');
  const [isBuildModalOpen, setIsBuildModalOpen] = useState(false);
  const [gettingApp, setGettingApp] = useState(false);

  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [unlockError, setUnlockError] = useState('');

  const isLight = theme === 'light' && !isFrutigerAero;

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

        try {
          const commentsQ = query(
            collection(db, 'comments'),
            where('appId', '==', selectedAppId)
          );
          const commentsSnap = await getDocs(commentsQ);
          const loadedComments = commentsSnap.docs
            .map((d) => ({ id: d.id, ...d.data() } as any))
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          setComments(loadedComments);
        } catch (commentError) {
          console.error('Error fetching comments', commentError);
          setComments([]);
        }
      } catch (error) {
        console.error('Error fetching app details', error);
      } finally {
        setLoading(false);
      }
    };

    fetchApp();
  }, [selectedAppId, user]);

  const handleVote = async (type: 'like' | 'dislike') => {
    if (!user || !app) {
      notify.info(language === 'ru' ? 'Войдите, чтобы голосовать' : 'Please sign in to vote');
      return;
    }

    const voteId = `${user.uid}_${app.id}`;
    const voteRef = doc(db, 'votes', voteId);
    const appRef = doc(db, 'apps', app.id);

    try {
      if (userVote === type) {
        await deleteDoc(voteRef);
        await updateDoc(appRef, {
          [type === 'like' ? 'likes' : 'dislikes']: increment(-1),
        });
        setUserVote(null);
        setApp((prev) =>
          prev
            ? {
                ...prev,
                [type === 'like' ? 'likes' : 'dislikes']: Math.max(0, (prev[type === 'like' ? 'likes' : 'dislikes'] || 0) - 1),
              }
            : null
        );
      } else {
        await setDoc(voteRef, { userId: user.uid, appId: app.id, type });
        const updates: any = {
          [type === 'like' ? 'likes' : 'dislikes']: increment(1),
        };
        if (userVote) {
          updates[userVote === 'like' ? 'likes' : 'dislikes'] = increment(-1);
        }
        await updateDoc(appRef, updates);
        setUserVote(type);
        setApp((prev) => {
          if (!prev) return null;
          const next = { ...prev };
          const targetField = type === 'like' ? 'likes' : 'dislikes';
          next[targetField] = (next[targetField] || 0) + 1;
          if (userVote) {
            const prevField = userVote === 'like' ? 'likes' : 'dislikes';
            next[prevField] = Math.max(0, (next[prevField] || 0) - 1);
          }
          return next;
        });
      }
    } catch (error) {
      console.error('Error voting', error);
    }
  };

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
    startTransition(() => {
      setPlayingAppId(app.id);
      setCurrentView('player');
      setSelectedAppId(null);
    });
  };

  const handleCopy = () => {
    if (!app) return;
    startTransition(() => {
      setCopiedAppData(app);
      setEditingAppId(null);
      setCurrentView('editor');
      setSelectedAppId(null);
    });
  };

  const handleDownload = (platform: string) => {
    if (!app) return;
    setBuildPlatform(platform);
    setIsBuildModalOpen(true);
  };

  const handleGet = async () => {
    if (!app) return;
    setGettingApp(true);
    try {
      await installApp(app);
      notify.success(
        language === 'ru' ? `«${app.title}» установлено` : `"${app.title}" installed`
      );
    } catch (e) {
      console.error('Error installing app:', e);
      notify.error(language === 'ru' ? 'Ошибка установки' : 'Failed to install app');
    } finally {
      setGettingApp(false);
    }
  };

  const handleBuy = async () => {
    if (!user || !userData || !app || !app.price) return;
    if ((userData.eplCoins || 0) < app.price) {
      notify.error(language === 'ru' ? 'Недостаточно EPLCoins!' : 'Not enough EPLCoins!');
      return;
    }

    setBuying(true);
    try {
      const newCoins = (userData.eplCoins || 0) - app.price;

      await updateDoc(doc(db, 'users', user.uid), {
        eplCoins: newCoins,
        purchasedApps: arrayUnion(app.id),
      });

      if (app.authorId) {
        const authorRef = doc(db, 'users', app.authorId);
        await updateDoc(authorRef, {
          eplCoins: increment(app.price),
        }).catch(() => {});
      }

      setUserData({
        ...userData,
        eplCoins: newCoins,
        purchasedApps: [...(userData.purchasedApps || []), app.id],
      });
      await installApp(app);
      notify.success(language === 'ru' ? 'Приложение куплено и установлено!' : 'App purchased and installed!');
    } catch (error) {
      console.error('Error buying app', error);
      notify.error(language === 'ru' ? 'Ошибка покупки' : 'Purchase failed');
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
        userName: user.displayName || userData?.name || 'User',
        text: newComment.trim(),
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'comments'), commentData);
      setComments([{ id: docRef.id, ...commentData }, ...comments]);
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment', error);
      notify.error(language === 'ru' ? 'Не удалось добавить комментарий' : 'Failed to post comment');
    }
  };

  if (!selectedAppId) return null;

  const isPurchased =
    !app?.price ||
    app.price === 0 ||
    (userData?.purchasedApps || []).includes(app?.id || '') ||
    app?.authorId === user?.uid;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 sm:p-6">
      <div
        className={clsx(
          'w-full max-w-4xl h-full max-h-[90vh] rounded-xl overflow-hidden flex flex-col relative shadow-2xl border',
          isFrutigerAero
            ? 'frutiger-aero-glass'
            : isLight
            ? 'bg-[#FFFFFF] border-[#E2E5EA] text-[#111315]'
            : 'bg-[#181B20] border-[#262B33] text-[#F3F4F6]'
        )}
      >
        <button
          onClick={() => setSelectedAppId(null)}
          className={clsx(
            'absolute top-4 right-4 p-2 rounded-lg border z-10 transition-colors',
            isLight
              ? 'bg-white/90 border-[#E2E5EA] text-[#111315] hover:bg-[#F5F6F8]'
              : 'bg-[#111315]/90 border-[#262B33] text-[#F3F4F6] hover:bg-[#20242B]'
          )}
        >
          <X className="w-5 h-5" />
        </button>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-[#10B981]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-current border-t-transparent" />
          </div>
        ) : app ? (
          <div className="flex-1 overflow-y-auto">
            {/* Banner Hero */}
            <div
              className={clsx(
                'relative h-48 sm:h-56 border-b flex items-center justify-center p-6 overflow-hidden',
                isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
              )}
              style={
                app.bannerUrl
                  ? {
                      backgroundImage: `url(${app.bannerUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }
                  : undefined
              }
            >
              {app.bannerUrl && <div className="absolute inset-0 bg-black/45" />}
              <div
                className={clsx(
                  'relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl border flex items-center justify-center font-bold text-4xl shadow-lg overflow-hidden',
                  isFrutigerAero
                    ? 'bg-white/80 border-white text-[#0284c7]'
                    : isLight
                    ? 'bg-white border-[#E2E5EA] text-[#059669]'
                    : 'bg-[#181B20] border-[#262B33] text-[#10B981]'
                )}
              >
                {app.iconUrl ? (
                  <img
                    src={app.iconUrl}
                    alt={app.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  (app.title || 'A').charAt(0).toUpperCase()
                )}
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{app.title}</h1>
                    {app.status === 'verified' && (
                      <span className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-[#10B981]">
                        <CheckCircle className="w-3.5 h-3.5" /> Verified
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#9CA3AF]">
                    <button
                      onClick={() => {
                        useStore.getState().setViewingProfileId(app.authorId);
                        useStore.getState().setCurrentView('public-profile');
                        useStore.getState().setSelectedAppId(null);
                      }}
                      className="flex items-center gap-1.5 hover:text-[#10B981] hover:underline transition-colors"
                    >
                      <User className="w-3.5 h-3.5" /> {app.authorName}
                    </button>
                    <span>·</span>
                    <span className="flex items-center gap-1 capitalize">
                      <Tag className="w-3.5 h-3.5" /> {app.category}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1 font-mono-num">
                      <Calendar className="w-3.5 h-3.5" />{' '}
                      {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : 'N/A'}
                    </span>
                    {app.originalAppId && app.originalAppName && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-[#10B981]">
                          <Terminal className="w-3.5 h-3.5" /> Forked from {app.originalAppName}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleVote('like')}
                    className={clsx(
                      'px-3 py-2 rounded-lg border text-xs font-mono-num flex items-center gap-1.5 transition-colors',
                      userVote === 'like'
                        ? 'bg-[#10B981] border-[#10B981] text-[#09120E] font-semibold'
                        : isLight
                        ? 'border-[#E2E5EA] hover:bg-[#F5F6F8] text-[#4B5563]'
                        : 'border-[#262B33] hover:bg-[#20242B] text-[#9CA3AF]'
                    )}
                  >
                    <ThumbsUp className={clsx('w-4 h-4', userVote === 'like' && 'fill-current')} />
                    <span>{app.likes || 0}</span>
                  </button>
                  <button
                    onClick={() => handleVote('dislike')}
                    className={clsx(
                      'px-3 py-2 rounded-lg border text-xs font-mono-num flex items-center gap-1.5 transition-colors',
                      userVote === 'dislike'
                        ? 'bg-[#DC2626] border-[#DC2626] text-white font-semibold'
                        : isLight
                        ? 'border-[#E2E5EA] hover:bg-[#F5F6F8] text-[#4B5563]'
                        : 'border-[#262B33] hover:bg-[#20242B] text-[#9CA3AF]'
                    )}
                  >
                    <ThumbsDown className={clsx('w-4 h-4', userVote === 'dislike' && 'fill-current')} />
                    <span>{app.dislikes || 0}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* Tabs */}
                  <div
                    className={clsx(
                      'flex items-center gap-1 border-b overflow-x-auto no-scrollbar',
                      isLight ? 'border-[#E2E5EA]' : 'border-[#262B33]'
                    )}
                  >
                    {(['description', 'screenshots', 'downloads', 'events', 'comments'] as const).map(
                      (tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={clsx(
                            'px-3 py-2.5 text-sm font-medium transition-colors relative whitespace-nowrap capitalize border-b-2',
                            activeTab === tab
                              ? 'border-[#10B981] text-[#10B981]'
                              : 'border-transparent text-[#6B7280] hover:text-current'
                          )}
                        >
                          {tab}
                        </button>
                      )
                    )}
                  </div>

                  {activeTab === 'description' && (
                    <section>
                      <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap opacity-90">
                        {app.description || (language === 'ru' ? 'Описание не добавлено.' : 'No description provided.')}
                      </p>
                    </section>
                  )}

                  {activeTab === 'events' && (
                    <section>
                      {app.events && app.events.length > 0 ? (
                        <div className="space-y-3">
                          {app.events.map((event, index) => (
                            <div
                              key={index}
                              className={clsx(
                                'p-4 rounded-xl border flex items-center gap-4',
                                isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
                              )}
                            >
                              {event.imageUrl ? (
                                <img
                                  src={event.imageUrl}
                                  alt={event.title}
                                  className="w-14 h-14 rounded-lg object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-14 h-14 rounded-lg bg-current/10 shrink-0" />
                              )}
                              <div>
                                <h3 className="font-semibold text-sm">{event.title}</h3>
                                <p className="text-xs opacity-70 mt-0.5">{event.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div
                          className={clsx(
                            'p-8 rounded-xl border text-center text-sm opacity-60',
                            isLight ? 'border-[#E2E5EA]' : 'border-[#262B33]'
                          )}
                        >
                          No events available.
                        </div>
                      )}
                    </section>
                  )}

                  {activeTab === 'screenshots' && (
                    <section>
                      {app.screenshotUrl ? (
                        <div
                          className={clsx(
                            'rounded-xl overflow-hidden border',
                            isLight ? 'border-[#E2E5EA]' : 'border-[#262B33]'
                          )}
                        >
                          <img
                            src={app.screenshotUrl}
                            alt={`${app.title} Screenshot`}
                            className="w-full h-auto object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div
                          className={clsx(
                            'p-8 rounded-xl border text-center text-sm opacity-60',
                            isLight ? 'border-[#E2E5EA]' : 'border-[#262B33]'
                          )}
                        >
                          No screenshots available.
                        </div>
                      )}
                    </section>
                  )}

                  {activeTab === 'downloads' && (
                    <section className="space-y-2.5">
                      {[
                        { id: 'epl', name: 'Direct EPL App', ext: '.epl.html', icon: FileCode, desc: language === 'ru' ? 'Прямой автономный EPL-файл с иконкой и кодом' : 'Direct standalone EPL project app with icon' },
                        { id: 'windows', name: 'Windows', ext: '.exe', icon: Monitor, desc: 'Portable Executable' },
                        { id: 'macos', name: 'macOS', ext: '.dmg', icon: Apple, desc: 'macOS Application' },
                        { id: 'linux', name: 'Linux', ext: '.AppImage', icon: Terminal, desc: 'Universal AppImage' },
                        { id: 'android', name: 'Android', ext: '.apk', icon: Smartphone, desc: 'Android Package' },
                        { id: 'ios', name: 'iOS', ext: '.mobileconfig', icon: Smartphone, desc: 'WebClip Profile' },
                      ].map((p) => {
                        const IconComponent = p.icon;
                        return (
                          <button
                            key={p.id}
                            onClick={() => handleDownload(p.id)}
                            className={clsx(
                              'w-full flex items-center justify-between p-3.5 rounded-xl border transition-colors text-left',
                              isLight
                                ? 'bg-[#F5F6F8] hover:bg-[#EBEDF0] border-[#E2E5EA]'
                                : 'bg-[#111315] hover:bg-[#20242B] border-[#262B33]'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <IconComponent className="w-5 h-5 text-[#10B981]" />
                              <div>
                                <div className="font-semibold text-sm flex items-center gap-2">
                                  <span>{p.name}</span>
                                  <span className="text-xs font-mono text-[#6B7280]">{p.ext}</span>
                                </div>
                                <div className="text-xs opacity-60">{p.desc}</div>
                              </div>
                            </div>
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#10B981]">
                              <Download className="w-3.5 h-3.5" />
                              Build
                            </span>
                          </button>
                        );
                      })}
                    </section>
                  )}

                  {activeTab === 'comments' && (
                    <section className="space-y-4">
                      {user ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder={language === 'ru' ? 'Написать комментарий...' : 'Write a comment...'}
                            className={clsx(
                              'flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2',
                              isLight
                                ? 'bg-[#F5F6F8] border-[#E2E5EA] focus:ring-[#059669]/40'
                                : 'bg-[#111315] border-[#262B33] focus:ring-[#10B981]/40'
                            )}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                          />
                          <button
                            onClick={handleAddComment}
                            disabled={!newComment.trim()}
                            className="px-4 py-2 bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-[#09120E] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
                          >
                            {language === 'ru' ? 'Отправить' : 'Post'}
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl border border-current/15 text-center text-sm opacity-70">
                          {language === 'ru' ? 'Войдите, чтобы оставить комментарий.' : 'Sign in to comment.'}
                        </div>
                      )}

                      <div className="space-y-2.5">
                        {comments.length > 0 ? (
                          comments.map((comment) => (
                            <div
                              key={comment.id}
                              className={clsx(
                                'p-3.5 rounded-xl border',
                                isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
                              )}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-xs">{comment.userName}</span>
                                <span className="text-[11px] font-mono-num opacity-60">
                                  {new Date(comment.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-sm opacity-90">{comment.text}</p>
                            </div>
                          ))
                        ) : (
                          <div className="text-center text-sm opacity-60 py-6">
                            {language === 'ru' ? 'Комментариев пока нет.' : 'No comments yet.'}
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Metrics */}
                  <section
                    className={clsx(
                      'p-4 rounded-xl border grid grid-cols-3 gap-4 text-center',
                      isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
                    )}
                  >
                    <div>
                      <div className="text-lg font-bold font-mono-num">{app.downloads || 0}</div>
                      <div className="text-[11px] opacity-60 uppercase">Downloads</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold font-mono-num flex items-center justify-center gap-1">
                        {(typeof app.rating === 'number' ? app.rating : 5.0).toFixed(1)}
                        <Star className="w-3.5 h-3.5 text-[#D97706] fill-current" />
                      </div>
                      <div className="text-[11px] opacity-60 uppercase">Rating</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold font-mono-num">{app.version || '1.0.0'}</div>
                      <div className="text-[11px] opacity-60 uppercase">Version</div>
                    </div>
                  </section>
                </div>

                {/* Right Action Column */}
                <div className="space-y-3">
                  {!isPurchased ? (
                    <button
                      onClick={handleBuy}
                      disabled={buying}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#D97706] hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
                    >
                      <Coins className="w-4 h-4" />
                      <span>{buying ? 'Processing...' : `Buy (${app.price} Coins)`}</span>
                    </button>
                  ) : isAppInstalled(app.id) ? (
                    <div className="space-y-2.5">
                      <div
                        className={clsx(
                          'w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-semibold text-[#10B981]',
                          isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
                        )}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{language === 'ru' ? 'Установлено' : 'Installed'}</span>
                      </div>

                      <button
                        onClick={handlePlay}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-[#10B981] hover:bg-[#059669] text-[#09120E] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>{language === 'ru' ? 'Запустить' : 'Launch'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedAppId(null);
                          setCurrentView('installed-apps');
                        }}
                        className={clsx(
                          'w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap',
                          isLight
                            ? 'border-[#E2E5EA] hover:bg-[#F5F6F8]'
                            : 'border-[#262B33] hover:bg-[#20242B]'
                        )}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>{language === 'ru' ? 'Мои установленные' : 'View in Installed'}</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleGet}
                      disabled={gettingApp}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-[#09120E] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
                    >
                      <Download className="w-4 h-4" />
                      <span>{gettingApp ? 'Installing...' : 'Get'}</span>
                    </button>
                  )}

                  {app.allowCopy !== false && (
                    <button
                      onClick={handleCopy}
                      className={clsx(
                        'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap',
                        isLight
                          ? 'bg-[#F5F6F8] border-[#E2E5EA] hover:bg-[#EBEDF0]'
                          : 'bg-[#111315] border-[#262B33] hover:bg-[#20242B]'
                      )}
                    >
                      <Terminal className="w-4 h-4" />
                      <span>{language === 'ru' ? 'Копировать код в IDE' : 'Fork into IDE'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm opacity-60">
            App not found.
          </div>
        )}
      </div>

      {showUnlockModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
          <div
            className={clsx(
              'p-6 rounded-xl border w-full max-w-sm shadow-2xl',
              isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#181B20] border-[#262B33]'
            )}
          >
            <h3 className="text-lg font-bold mb-1">Enter Access Code</h3>
            <p className="text-sm opacity-75 mb-4">
              This app is locked by the creator. Enter the access code to launch.
            </p>
            <input
              type="text"
              value={enteredCode}
              onChange={(e) => {
                setEnteredCode(e.target.value);
                setUnlockError('');
              }}
              placeholder="Access code..."
              className={clsx(
                'w-full rounded-lg px-3 py-2 text-sm border mb-3 focus:outline-none focus:ring-2',
                isLight
                  ? 'bg-[#F5F6F8] border-[#E2E5EA] focus:ring-[#059669]/40'
                  : 'bg-[#111315] border-[#262B33] focus:ring-[#10B981]/40'
              )}
            />
            {unlockError && <p className="text-[#DC2626] text-xs mb-3">{unlockError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowUnlockModal(false);
                  setEnteredCode('');
                  setUnlockError('');
                }}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium border',
                  isLight ? 'border-[#E2E5EA]' : 'border-[#262B33]'
                )}
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
                className="px-4 py-2 rounded-lg bg-[#10B981] text-[#09120E] text-sm font-semibold"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      <BuildDownloadModal
        isOpen={isBuildModalOpen}
        app={app}
        initialPlatform={buildPlatform}
        onClose={() => setIsBuildModalOpen(false)}
      />
    </div>
  );
}
