import React, { useEffect, useState, useTransition } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  where,
  doc,
  updateDoc,
  increment,
  setDoc,
  getDoc,
  deleteDoc,
  arrayUnion,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store/useStore';
import { notify, confirmAction } from '../store/useDialogStore';
import {
  Search,
  Star,
  Download,
  Monitor,
  Smartphone,
  Apple,
  Terminal,
  ThumbsUp,
  ThumbsDown,
  Flame,
  Clock,
  Coins,
  Users,
  CheckCircle2,
  Play,
  Package,
  Globe,
  Code2,
  Plus,
  Terminal as TerminalIcon,
  Gamepad2,
  Sparkles,
} from 'lucide-react';
import { clsx } from 'clsx';
import { AppData, AppCategory, UserVote } from '../types';
import FriendsView from './FriendsView';
import BuildDownloadModal from './BuildDownloadModal';
import WebsiteViewerModal from './WebsiteViewerModal';
import UserRoleBadge from './UserRoleBadge';
import VerifiedBadge from './VerifiedBadge';
import {
  DEMO_PROJECT_ID,
  FEATURED_DEMO_APP,
  STARTER_EDITOR_CODE,
  getAppCardDescription,
} from '../lib/demoProjects';

const CATEGORIES: AppCategory[] = [
  'games',
  'apps',
  'work',
  'AI',
  'Programming Language',
  'Store',
  'Custom Editor',
  'Other',
];

export default function StoreView() {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'featured' | 'recent' | 'friends'>('featured');
  const [selectedCategory, setSelectedCategory] = useState<AppCategory | 'all'>('all');
  const [userVotes, setUserVotes] = useState<Record<string, 'like' | 'dislike'>>({});

  const theme = useStore((state) => state.theme);
  const setCurrentView = useStore((state) => state.setCurrentView);
  const setPlayingAppId = useStore((state) => state.setPlayingAppId);
  const setSelectedAppId = useStore((state) => state.setSelectedAppId);
  const setCode = useStore((state) => state.setCode);
  const setEditingAppId = useStore((state) => state.setEditingAppId);
  const setCopiedAppData = useStore((state) => state.setCopiedAppData);
  const setSelectedExtraCategory = useStore((state) => state.setSelectedExtraCategory);
  const setLivePreviewEnabled = useStore((state) => state.setLivePreviewEnabled);
  const user = useStore((state) => state.user);
  const userData = useStore((state) => state.userData);
  const isFrutigerAero = useStore((state) => state.isFrutigerAero);
  const language = useStore((state) => state.language);
  const isAppInstalled = useStore((state) => state.isAppInstalled);
  const [, startTransition] = useTransition();

  const [buildTargetApp, setBuildTargetApp] = useState<AppData | null>(null);
  const [buildTargetPlatform, setBuildTargetPlatform] = useState<string | undefined>(undefined);
  const [visitingWebsiteApp, setVisitingWebsiteApp] = useState<AppData | null>(null);

  const [enteredCode, setEnteredCode] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockTargetApp, setUnlockTargetApp] = useState<AppData | null>(null);

  const handleVisitWebsite = async (app: AppData) => {
    setVisitingWebsiteApp(app);
    try {
      await updateDoc(doc(db, 'apps', app.id), {
        visits: increment(1),
      });
    } catch (err) {
      console.error('Error incrementing website visits:', err);
    }
  };

  const handleCreateFirstProject = () => {
    setEditingAppId(null);
    setCopiedAppData(null);
    setSelectedExtraCategory('Normal');
    setLivePreviewEnabled(true);
    const currentCode = useStore.getState().code || '';
    if (!currentCode.trim()) {
      setCode(STARTER_EDITOR_CODE);
    }
    startTransition(() => {
      setCurrentView('editor');
    });
  };

  const handleOpenCodeInEditor = (sourceCode: string) => {
    setEditingAppId(null);
    setCopiedAppData(null);
    setSelectedExtraCategory('Normal');
    setLivePreviewEnabled(true);
    setCode(sourceCode);
    startTransition(() => {
      setCurrentView('editor');
    });
  };

  const handlePlayDemo = () => {
    startTransition(() => {
      setPlayingAppId(DEMO_PROJECT_ID);
      setCurrentView('player');
    });
  };

  const isLight = theme === 'light' && !isFrutigerAero;

  useEffect(() => {
    setLoading(true);
    const q =
      activeTab === 'featured'
        ? query(collection(db, 'apps'), orderBy('downloads', 'desc'), limit(50))
        : query(collection(db, 'apps'), orderBy('createdAt', 'desc'), limit(50));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let appsData = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            ...data,
            id: docSnap.id,
            rating: typeof data?.rating === 'number' && !isNaN(data.rating) ? data.rating : 5.0,
            downloads: typeof data?.downloads === 'number' ? data.downloads : 0,
            visits: typeof data?.visits === 'number' ? data.visits : 0,
            likes: typeof data?.likes === 'number' ? data.likes : 0,
            dislikes: typeof data?.dislikes === 'number' ? data.dislikes : 0,
            price: typeof data?.price === 'number' ? data.price : 0,
          } as AppData;
        });

        appsData = appsData.filter((app) => {
          if (app.isPrivate) return false;
          if (app.moderationStatus === 'rejected' || app.status === 'rejected') return false;
          const title = (app.title || '').toLowerCase();
          const desc = (app.description || '').toLowerCase();
          if (
            title.includes('hacked') ||
            title.includes('взлом') ||
            desc.includes('hacked') ||
            desc.includes('взлом')
          ) {
            return false;
          }
          return true;
        });

        if (selectedCategory !== 'all') {
          appsData = appsData.filter((app) => app.category === selectedCategory);
        }

        setApps(appsData);
        setLoading(false);
      },
      (error) => {
        console.error('Error subscribing to apps', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeTab, selectedCategory]);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'votes'), where('userId', '==', user.uid));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const votes: Record<string, 'like' | 'dislike'> = {};
          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data() as UserVote;
            votes[data.appId] = data.type;
          });
          setUserVotes(votes);
        },
        (error) => {
          console.error('Error subscribing to votes', error);
        }
      );
      return () => unsubscribe();
    }
  }, [user]);

  const handleVote = async (appId: string, type: 'like' | 'dislike') => {
    if (!user) {
      notify.info(language === 'ru' ? 'Войдите в аккаунт для оценки' : 'Sign in to vote.');
      return;
    }

    const voteId = `${user.uid}_${appId}`;
    const voteRef = doc(db, 'votes', voteId);
    const appRef = doc(db, 'apps', appId);
    const currentVote = userVotes[appId];

    try {
      if (currentVote === type) {
        await deleteDoc(voteRef);
        await updateDoc(appRef, {
          [type === 'like' ? 'likes' : 'dislikes']: increment(-1),
        });
        setUserVotes((prev) => {
          const next = { ...prev };
          delete next[appId];
          return next;
        });
      } else {
        await setDoc(voteRef, { userId: user.uid, appId, type });
        const updates: any = {
          [type === 'like' ? 'likes' : 'dislikes']: increment(1),
        };
        if (currentVote) {
          updates[currentVote === 'like' ? 'likes' : 'dislikes'] = increment(-1);
        }
        await updateDoc(appRef, updates);
        setUserVotes((prev) => ({ ...prev, [appId]: type }));
      }
    } catch (error) {
      console.error('Error voting', error);
    }
  };

  const proceedToPlay = async (app: AppData) => {
    try {
      await updateDoc(doc(db, 'apps', app.id), {
        visits: increment(1),
      });
    } catch (error) {
      console.error('Error incrementing visits', error);
    }

    const installedAppVersion = userData?.installedApps?.[app.id];
    if (installedAppVersion && installedAppVersion !== app.version && userData?.uid) {
      await updateDoc(doc(db, 'users', userData.uid), {
        [`installedApps.${app.id}`]: app.version,
      }).catch(() => {});
      notify.info(language === 'ru' ? 'Приложение обновлено до новой версии.' : 'App updated to latest version.');
    }

    startTransition(() => {
      setPlayingAppId(app.id);
      setCurrentView('player');
    });
  };

  const handlePlay = async (app: AppData) => {
    if (app.id === DEMO_PROJECT_ID) {
      handlePlayDemo();
      return;
    }
    if (!user) {
      notify.info(language === 'ru' ? 'Войдите, чтобы запускать пользовательские приложения.' : 'Please sign in to play user apps.');
      return;
    }

    const isPurchased =
      userData?.purchasedApps?.includes(app.id) ||
      app.authorId === user.uid ||
      !app.price ||
      app.price === 0;

    if (!isPurchased) {
      if ((userData?.eplCoins || 0) < (app.price || 0)) {
        notify.error(language === 'ru' ? 'Недостаточно EPLCoins!' : 'Not enough EPLCoins!');
        return;
      }

      const confirmed = await confirmAction({
        title: language === 'ru' ? 'Покупка приложения' : 'Purchase App',
        message:
          language === 'ru'
            ? `Купить «${app.title}» за ${app.price} EPLCoins?`
            : `Buy "${app.title}" for ${app.price} EPLCoins?`,
        confirmText: language === 'ru' ? 'Купить' : 'Buy',
      });
      if (!confirmed) return;

      try {
        await updateDoc(doc(db, 'users', user.uid), {
          eplCoins: increment(-(app.price || 0)),
          purchasedApps: arrayUnion(app.id),
          [`installedApps.${app.id}`]: app.version,
        });

        if (app.authorId) {
          const sellerRef = doc(db, 'users', app.authorId);
          await updateDoc(sellerRef, {
            eplCoins: increment(app.price || 0),
          }).catch(() => {});

          const sellerPublicRef = doc(db, 'users_public', app.authorId);
          const sellerPublicSnap = await getDoc(sellerPublicRef);
          if (sellerPublicSnap.exists()) {
            await updateDoc(sellerPublicRef, {
              eplCoins: increment(app.price || 0),
            }).catch(() => {});
          }
        }

        notify.success(language === 'ru' ? 'Приложение успешно куплено!' : 'App purchased!');
      } catch (error) {
        console.error('Error purchasing app', error);
        notify.error(language === 'ru' ? 'Ошибка покупки. Попробуйте снова.' : 'Purchase failed. Please try again.');
        return;
      }
    }

    if (app.isLocked && app.authorId !== user?.uid && app.unlockCode) {
      setUnlockTargetApp(app);
      setShowUnlockModal(true);
      return;
    }

    await proceedToPlay(app);
  };

  const filteredApps = apps.filter(
    (app) =>
      (app.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (app.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'windows':
        return <Monitor className="w-3.5 h-3.5" />;
      case 'macos':
        return <Apple className="w-3.5 h-3.5" />;
      case 'linux':
        return <Terminal className="w-3.5 h-3.5" />;
      case 'android':
      case 'apk':
      case 'ios':
        return <Smartphone className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header & Controls */}
      <div
        className={clsx(
          'px-5 sm:px-6 py-4 border-b shrink-0',
          isFrutigerAero
            ? 'frutiger-aero-glass border-white/50'
            : isLight
            ? 'bg-[#FFFFFF] border-[#E2E5EA]'
            : 'bg-[#181B20] border-[#262B33]'
        )}
      >
        <div className="max-w-7xl mx-auto space-y-3.5">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="min-w-0 max-w-2xl">
              <h1 className="text-2xl font-bold tracking-tight">App Store</h1>
              <p
                className={clsx(
                  'text-sm mt-1 leading-snug',
                  isFrutigerAero
                    ? 'text-[#1e4b73]'
                    : isLight
                    ? 'text-[#4B5563]'
                    : 'text-[#C4CAD3]'
                )}
              >
                {language === 'ru'
                  ? 'Создавайте 2D/3D-игры, приложения и .epl-сайты в браузере на простом языке EPL — или запустите готовый проект.'
                  : 'Build 2D/3D games, apps, and .epl websites right in your browser with EPL — or launch community projects.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              <button
                onClick={handleCreateFirstProject}
                className={clsx(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                  isFrutigerAero
                    ? 'frutiger-aero-button'
                    : isLight
                    ? 'bg-[#059669] hover:bg-[#047857] text-white'
                    : 'bg-[#10B981] hover:bg-[#059669] text-[#09120E]'
                )}
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'ru' ? 'Создать первый проект' : 'Create First Project'}</span>
              </button>

              {user && (
                <div
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-mono-num font-semibold shrink-0',
                    isFrutigerAero
                      ? 'bg-white/60 border-white text-[#062038]'
                      : isLight
                      ? 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315]'
                      : 'bg-[#111315] border-[#262B33] text-[#F3F4F6]'
                  )}
                >
                  <Coins className="w-4 h-4 text-[#D97706]" />
                  <span>{userData?.eplCoins || 0}</span>
                </div>
              )}

              <div className="relative flex-1 sm:w-64 min-w-0 sm:min-w-[200px]">
                <Search className={clsx('absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4', isLight ? 'text-[#6B7280]' : 'text-[#A3AAB5]')} />
                <input
                  type="text"
                  placeholder={language === 'ru' ? 'Поиск приложений...' : 'Search apps...'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={clsx(
                    'w-full pl-9 pr-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-colors',
                    isFrutigerAero
                      ? 'bg-white/65 border-white text-[#062038] placeholder-[#3b6f9c] focus:ring-blue-400'
                      : isLight
                      ? 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315] placeholder-[#6B7280] focus:ring-[#059669]/40'
                      : 'bg-[#111315] border-[#262B33] text-[#F3F4F6] placeholder-[#9CA3AF] focus:ring-[#10B981]/40'
                  )}
                />
              </div>
            </div>
          </div>

          {/* Section Tabs & Wrapping Category Filter Row (fits cleanly inside 1280px) */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'featured', label: language === 'ru' ? 'Популярное' : 'Featured', icon: Flame },
                { id: 'recent', label: language === 'ru' ? 'Новые' : 'Recent', icon: Clock },
                { id: 'friends', label: language === 'ru' ? 'Друзья' : 'Friends', icon: Users },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                      active
                        ? isFrutigerAero
                          ? 'frutiger-aero-button'
                          : isLight
                          ? 'bg-[#059669] text-white border-[#059669]'
                          : 'bg-[#10B981] text-[#09120E] border-[#10B981] font-semibold'
                        : isFrutigerAero
                        ? 'bg-white/40 border-white/50 text-[#062038] hover:bg-white/60'
                        : isLight
                        ? 'bg-[#F5F6F8] border-[#E2E5EA] text-[#4B5563] hover:text-[#111315]'
                        : 'bg-[#111315] border-[#262B33] text-[#C4CAD3] hover:text-[#F3F4F6]'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {activeTab !== 'friends' && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={clsx(
                    'px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                    selectedCategory === 'all'
                      ? isFrutigerAero
                        ? 'bg-sky-600 text-white border-sky-600'
                        : isLight
                        ? 'bg-[#111315] text-white border-[#111315]'
                        : 'bg-[#2A303B] text-[#F3F4F6] border-[#4B5563]'
                      : isFrutigerAero
                      ? 'bg-white/40 border-white/50 text-[#062038]'
                      : isLight
                      ? 'bg-transparent border-[#E2E5EA] text-[#4B5563] hover:bg-[#F5F6F8]'
                      : 'bg-transparent border-[#262B33] text-[#B4BCC8] hover:bg-[#20242B] hover:text-[#F3F4F6]'
                  )}
                >
                  {language === 'ru' ? 'Все' : 'All'}
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={clsx(
                      'px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 capitalize cursor-pointer',
                      selectedCategory === cat
                        ? isFrutigerAero
                          ? 'bg-sky-600 text-white border-sky-600'
                          : isLight
                          ? 'bg-[#111315] text-white border-[#111315]'
                          : 'bg-[#2A303B] text-[#F3F4F6] border-[#4B5563]'
                        : isFrutigerAero
                        ? 'bg-white/40 border-white/50 text-[#062038]'
                        : isLight
                        ? 'bg-transparent border-[#E2E5EA] text-[#4B5563] hover:bg-[#F5F6F8]'
                        : 'bg-transparent border-[#262B33] text-[#B4BCC8] hover:bg-[#20242B] hover:text-[#F3F4F6]'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      {activeTab === 'friends' ? (
        <div className="flex-1 overflow-y-auto">
          <FriendsView />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Standout Featured Demo Project */}
            {!search.trim() && (selectedCategory === 'all' || selectedCategory === 'games') && (
              <section
                className={clsx(
                  'rounded-xl border p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5',
                  isFrutigerAero
                    ? 'frutiger-aero-glass border-white/60'
                    : isLight
                    ? 'bg-[#FFFFFF] border-[#E2E5EA]'
                    : 'bg-[#181B20] border-[#262B33]'
                )}
              >
                <div className="space-y-2 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                    <span className={isLight ? 'text-[#059669]' : 'text-[#10B981]'}>
                      {language === 'ru'
                        ? 'Готовый пример возможностей · EPL Studio'
                        : 'Featured Showcase · EPL Studio'}
                    </span>
                    <span className="opacity-40">·</span>
                    <span className="font-mono-num text-[#10B981]">WASD + HUD</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                    {FEATURED_DEMO_APP.title}
                  </h2>
                  <p
                    className={clsx(
                      'text-sm leading-relaxed',
                      isFrutigerAero ? 'text-[#1e4b73]' : isLight ? 'text-[#4B5563]' : 'text-[#C4CAD3]'
                    )}
                  >
                    {language === 'ru'
                      ? 'Управляйте неоновым героем на WASD, собирайте сферы, уклоняйтесь от патрульного дрона и меняйте любые правила прямо в коде.'
                      : 'Control a neon hero with WASD, collect gold orbs, dodge a patrolling drone, and edit any mechanic live in the EPL Editor.'}
                  </p>
                  <p className={clsx('text-xs', isLight ? 'text-[#4B5563]' : 'text-[#B4BCC8]')}>
                    {language === 'ru'
                      ? 'Физика столкновений · Синтезатор звука · Живой счёт без регистрации'
                      : 'Collision events · Synth audio · Live HUD without sign-in'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => handleOpenCodeInEditor(FEATURED_DEMO_APP.code)}
                    className={clsx(
                      'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                      isFrutigerAero
                        ? 'frutiger-aero-button'
                        : isLight
                        ? 'bg-[#111315] hover:bg-[#1F242A] text-white'
                        : 'bg-[#F3F4F6] hover:bg-white text-[#111315]'
                    )}
                  >
                    <Code2 className="w-4 h-4" />
                    <span>{language === 'ru' ? 'Открыть в редакторе' : 'Open in Editor'}</span>
                  </button>

                  <button
                    onClick={handlePlayDemo}
                    className={clsx(
                      'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                      isFrutigerAero
                        ? 'bg-white/60 border-white text-[#062038] hover:bg-white/80'
                        : isLight
                        ? 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315] hover:border-[#059669]'
                        : 'bg-[#111315] border-[#262B33] text-[#F3F4F6] hover:border-[#10B981] hover:text-[#10B981]'
                    )}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>{language === 'ru' ? 'Запустить демо' : 'Play Demo'}</span>
                  </button>
                </div>
              </section>
            )}

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className={clsx(
                      'rounded-xl border overflow-hidden flex flex-col justify-between',
                      isFrutigerAero
                        ? 'frutiger-aero-glass opacity-60'
                        : isLight
                        ? 'bg-white border-[#E2E5EA]'
                        : 'bg-[#181B20] border-[#262B33]'
                    )}
                  >
                    <div className="p-5 space-y-3">
                      <div className="h-4 w-2/3 rounded bg-current/10" />
                      <div className="h-3 w-full rounded bg-current/10" />
                      <div className="h-9 w-full rounded-lg bg-current/10" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredApps.length === 0 ? (
              <div
                className={clsx(
                  'rounded-xl border p-12 text-center max-w-lg mx-auto my-8',
                  isFrutigerAero
                    ? 'frutiger-aero-glass'
                    : isLight
                    ? 'bg-white border-[#E2E5EA]'
                    : 'bg-[#181B20] border-[#262B33]'
                )}
              >
                <Package className="w-10 h-10 mx-auto mb-3 text-[#B4BCC8]" />
                <h3 className="text-base font-semibold mb-1">
                  {language === 'ru' ? 'Приложения не найдены' : 'No applications found'}
                </h3>
                <p className={clsx('text-sm', isLight ? 'text-[#4B5563]' : 'text-[#B4BCC8]')}>
                  {language === 'ru'
                    ? 'Попробуйте изменить поисковый запрос, запустить демо выше или создать собственный проект.'
                    : 'Try adjusting your search query, running the featured demo above, or creating your own project.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredApps.map((app) => {
                  const installed = isAppInstalled(app.id);
                  const ratingText = (typeof app.rating === 'number' ? app.rating : 5.0).toFixed(1);
                  const descriptionText = getAppCardDescription(app, language);
                  const isWebsite = Boolean(app.isWebsite || app.websiteDomain);
                  const isGame = String(app.category || '').toLowerCase() === 'games';
                  const isAiOrCode = ['ai', 'programming language', 'custom editor'].includes(
                    String(app.category || '').toLowerCase()
                  );

                  return (
                    <article
                      key={app.id}
                      className={clsx(
                        'rounded-xl border overflow-hidden flex flex-col transition-colors',
                        isFrutigerAero
                          ? 'frutiger-aero-glass hover:border-white'
                          : isLight
                          ? 'bg-[#FFFFFF] border-[#E2E5EA] hover:border-[#D1D5DB]'
                          : 'bg-[#181B20] border-[#262B33] hover:border-[#374151]'
                      )}
                    >
                      <div className="p-5 flex-1 flex flex-col">
                        {/* Compact Category / Domain + Rating bar */}
                        <div className="flex items-center justify-between gap-2 text-[11px] mb-3">
                          <span className={clsx('truncate font-medium capitalize', isLight ? 'text-[#4B5563]' : 'text-[#9CA3AF]')}>
                            {isWebsite
                              ? app.websiteDomain || `${(app.title || 'site').toLowerCase().replace(/[^a-z0-9-]+/g, '-')}.epl`
                              : `${app.category || 'App'} · ${app.visits || 0} ${language === 'ru' ? 'зап.' : 'runs'}`}
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono-num font-semibold shrink-0 text-[#FBBF24]">
                            <Star className="w-3.5 h-3.5 fill-current" />
                            {ratingText}
                          </span>
                        </div>
                        {/* Title + App Icon Row */}
                        <div className="flex items-start gap-3 mb-2.5">
                          <button
                            type="button"
                            onClick={() => setSelectedAppId(app.id)}
                            className={clsx(
                              'w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 overflow-hidden cursor-pointer',
                              isFrutigerAero
                                ? 'bg-white/70 border-white text-[#0284c7]'
                                : isLight
                                ? 'bg-[#F5F6F8] border-[#E2E5EA] text-[#059669]'
                                : 'bg-[#111315] border-[#262B33] text-[#10B981]'
                            )}
                          >
                            {app.iconUrl ? (
                              <img
                                src={app.iconUrl}
                                alt={app.title}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : isWebsite ? (
                              <Globe className="w-5 h-5 text-sky-400" />
                            ) : isGame ? (
                              <Gamepad2 className="w-5 h-5" />
                            ) : isAiOrCode ? (
                              <Sparkles className="w-5 h-5" />
                            ) : (
                              <TerminalIcon className="w-5 h-5" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <h3
                              onClick={() => setSelectedAppId(app.id)}
                              className="text-base font-semibold truncate cursor-pointer hover:text-[#10B981] transition-colors"
                            >
                              {app.title}
                            </h3>

                            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  useStore.getState().setViewingProfileId(app.authorId);
                                  useStore.getState().setCurrentView('public-profile');
                                }}
                                className="text-xs font-medium hover:underline flex items-center gap-1 truncate text-[#10B981]"
                              >
                                {(app.isVerified || (app as any).isVerifiedAuthor) && (
                                  <VerifiedBadge size="xs" />
                                )}
                                <span className="truncate">{app.authorName || 'Author'}</span>
                              </button>
                              <UserRoleBadge
                                role={(app as any).authorRole}
                                isVerifiedAuthor={app.isVerified}
                                size="xs"
                              />
                              {app.price && app.price > 0 ? (
                                <span className="text-xs font-mono-num font-semibold text-[#FBBF24] ml-auto shrink-0">
                                  {app.price} Coins
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        <p
                          className={clsx(
                            'text-sm line-clamp-2 leading-relaxed mb-4 flex-1',
                            isFrutigerAero
                              ? 'text-[#1e4b73]'
                              : isLight
                              ? 'text-[#4B5563]'
                              : 'text-[#C4CAD3]'
                          )}
                        >
                          {descriptionText}
                        </p>

                        {/* Votes + Platform Actions */}
                        <div
                          className={clsx(
                            'flex items-center justify-between pt-3 mb-3 border-t text-xs',
                            isFrutigerAero
                              ? 'border-white/40'
                              : isLight
                              ? 'border-[#E2E5EA]'
                              : 'border-[#262B33]'
                          )}
                        >
                          <div className="flex items-center gap-3 font-mono-num">
                            <button
                              onClick={() => handleVote(app.id, 'like')}
                              className={clsx(
                                'inline-flex items-center gap-1 transition-colors cursor-pointer',
                                userVotes[app.id] === 'like'
                                  ? 'text-[#10B981] font-semibold'
                                  : isLight
                                  ? 'text-[#4B5563] hover:text-[#059669]'
                                  : 'text-[#B4BCC8] hover:text-[#10B981]'
                              )}
                            >
                              <ThumbsUp className={clsx('w-3.5 h-3.5', userVotes[app.id] === 'like' && 'fill-current')} />
                              <span>{app.likes || 0}</span>
                            </button>
                            <button
                              onClick={() => handleVote(app.id, 'dislike')}
                              className={clsx(
                                'inline-flex items-center gap-1 transition-colors cursor-pointer',
                                userVotes[app.id] === 'dislike'
                                  ? 'text-[#EF4444] font-semibold'
                                  : isLight
                                  ? 'text-[#4B5563] hover:text-[#DC2626]'
                                  : 'text-[#B4BCC8] hover:text-[#EF4444]'
                              )}
                            >
                              <ThumbsDown
                                className={clsx('w-3.5 h-3.5', userVotes[app.id] === 'dislike' && 'fill-current')}
                              />
                              <span>{app.dislikes || 0}</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            {['windows', 'macos', 'linux', 'android', 'ios'].map((platform) => (
                              <button
                                key={platform}
                                onClick={() => {
                                  setBuildTargetApp(app);
                                  setBuildTargetPlatform(platform);
                                }}
                                className={clsx(
                                  'p-1.5 rounded border transition-colors cursor-pointer',
                                  isFrutigerAero
                                    ? 'border-white/60 text-[#062038] hover:bg-white/60'
                                    : isLight
                                    ? 'border-[#E2E5EA] text-[#4B5563] hover:bg-[#F5F6F8]'
                                    : 'border-[#262B33] text-[#B4BCC8] hover:bg-[#20242B] hover:text-[#F3F4F6]'
                                )}
                                title={`Build & Download for ${platform.toUpperCase()}`}
                              >
                                {getPlatformIcon(platform)}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Primary Action */}
                        {isWebsite ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVisitWebsite(app);
                            }}
                            className={clsx(
                              'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer',
                              isFrutigerAero
                                ? 'frutiger-aero-button'
                                : isLight
                                ? 'bg-[#0284C7] hover:bg-[#0369A1] text-white'
                                : 'bg-sky-500 hover:bg-sky-400 text-[#07111A]'
                            )}
                          >
                            <Globe className="w-4 h-4" />
                            <span>Visit</span>
                          </button>
                        ) : installed ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handlePlay(app)}
                              className={clsx(
                                'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer',
                                isFrutigerAero
                                  ? 'frutiger-aero-button'
                                  : isLight
                                  ? 'bg-[#059669] hover:bg-[#047857] text-white'
                                  : 'bg-[#10B981] hover:bg-[#059669] text-[#09120E]'
                              )}
                            >
                              <Play className="w-4 h-4 fill-current" />
                              <span>{language === 'ru' ? 'Запустить' : 'Launch'}</span>
                            </button>
                            <span
                              className={clsx(
                                'px-2.5 py-2 rounded-lg border text-xs font-medium inline-flex items-center gap-1 shrink-0',
                                isFrutigerAero
                                  ? 'bg-white/50 border-white text-[#0284c7]'
                                  : isLight
                                  ? 'bg-[#F5F6F8] border-[#E2E5EA] text-[#059669]'
                                  : 'bg-[#111315] border-[#262B33] text-[#10B981]'
                              )}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{language === 'ru' ? 'Установлено' : 'Installed'}</span>
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAppId(app.id);
                            }}
                            className={clsx(
                              'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer',
                              isFrutigerAero
                                ? 'frutiger-aero-button'
                                : isLight
                                ? 'bg-[#059669] hover:bg-[#047857] text-white'
                                : 'bg-[#10B981] hover:bg-[#059669] text-[#09120E]'
                            )}
                          >
                            <Download className="w-4 h-4" />
                            <span>Get</span>
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Unlock Code Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
          <div
            className={clsx(
              'p-6 rounded-xl border w-full max-w-sm shadow-2xl',
              isFrutigerAero
                ? 'frutiger-aero-glass'
                : isLight
                ? 'bg-white border-[#E2E5EA] text-[#111315]'
                : 'bg-[#181B20] border-[#262B33] text-[#F3F4F6]'
            )}
          >
            <h3 className="text-lg font-bold mb-1">
              {language === 'ru' ? 'Введите код доступа' : 'Enter Access Code'}
            </h3>
            <p className="text-sm opacity-75 mb-4">
              {language === 'ru'
                ? 'Это приложение защищено автором. Введите код для запуска.'
                : 'This app is locked by the creator. Enter the access code to launch.'}
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
                  setUnlockTargetApp(null);
                }}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium border',
                  isLight ? 'border-[#E2E5EA] hover:bg-[#F5F6F8]' : 'border-[#262B33] hover:bg-[#20242B]'
                )}
              >
                {language === 'ru' ? 'Отмена' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  if (unlockTargetApp && enteredCode === unlockTargetApp.unlockCode) {
                    setShowUnlockModal(false);
                    setEnteredCode('');
                    proceedToPlay(unlockTargetApp);
                    setUnlockTargetApp(null);
                  } else {
                    setUnlockError(language === 'ru' ? 'Неверный код' : 'Incorrect code');
                  }
                }}
                className="px-4 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#09120E] text-sm font-semibold"
              >
                {language === 'ru' ? 'Открыть' : 'Unlock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Build & Download Modal */}
      <BuildDownloadModal
        isOpen={!!buildTargetApp}
        app={buildTargetApp}
        initialPlatform={buildTargetPlatform}
        onClose={() => setBuildTargetApp(null)}
      />

      {/* Website Viewer Modal */}
      <WebsiteViewerModal
        isOpen={!!visitingWebsiteApp}
        app={visitingWebsiteApp}
        onClose={() => setVisitingWebsiteApp(null)}
      />
    </div>
  );
}
