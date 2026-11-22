import React, { useEffect, useRef, useState, useTransition } from 'react';
import { useStore } from '../store/useStore';
import {
  Store,
  Code2,
  Package,
  User,
  Settings,
  LogOut,
  Star,
  ArrowLeft,
  ShieldCheck,
  Trophy,
  Layers,
  Terminal,
  Coins,
  ShoppingBag,
  Newspaper,
  MonitorDown,
  Download,
  Eye,
  EyeOff,
  SlidersHorizontal,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
} from 'lucide-react';
import { logOut } from '../firebase';
import { clsx } from 'clsx';
import { translations } from '../lib/translations';
import AuthModal from './AuthModal';
import AppDetailView from './AppDetailView';
import { getDefaultAvatar } from '../lib/avatar';
import UserRoleBadge from './UserRoleBadge';
import VerifiedBadge from './VerifiedBadge';

const DESKTOP_APP_DOWNLOAD_URL =
  'https://drive.google.com/uc?export=download&id=122nysFUK_GBpxPBcwfV0kMSGhbNuRoSy';

export default function Layout({ children }: { children: React.ReactNode }) {
  const currentView = useStore((state) => state.currentView);
  const setCurrentView = useStore((state) => state.setCurrentView);
  const user = useStore((state) => state.user);
  const theme = useStore((state) => state.theme);
  const language = useStore((state) => state.language);
  const isPremium = useStore((state) => state.isPremium);
  const selectedAppId = useStore((state) => state.selectedAppId);
  const userData = useStore((state) => state.userData);
  const isAuthModalOpen = useStore((state) => state.isAuthModalOpen);
  const setIsAuthModalOpen = useStore((state) => state.setIsAuthModalOpen);
  const isFrutigerAero = useStore((state) => state.isFrutigerAero);
  const setUser = useStore((state) => state.setUser);
  const setUserData = useStore((state) => state.setUserData);
  const simulatedRole = useStore((state) => state.simulatedRole);
  const hiddenTabs = useStore((state) => state.hiddenTabs) || [];
  const hideTab = useStore((state) => state.hideTab);
  const showTab = useStore((state) => state.showTab);
  const toggleTabVisibility = useStore((state) => state.toggleTabVisibility);
  const restoreAllTabs = useStore((state) => state.restoreAllTabs);
  const t = translations[language];

  const [isCustomizeTabs, setIsCustomizeTabs] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const mobileTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleLogOut = async () => {
    try {
      await logOut();
    } catch (e) {
      console.error(e);
    }
    setUser(null);
    setUserData(null);
  };

  const actualRole = userData?.role || 'user';
  const effectiveRole = actualRole === 'developer' && simulatedRole ? simulatedRole : actualRole;

  useEffect(() => {
    if (
      currentView === 'control' &&
      !(effectiveRole === 'developer' || effectiveRole === 'admin' || effectiveRole === 'moderator')
    ) {
      setCurrentView('store');
    }
  }, [currentView, effectiveRole, setCurrentView]);

  useEffect(() => {
    const btn = mobileTabRefs.current[currentView];
    if (btn && typeof btn.scrollIntoView === 'function') {
      btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [currentView]);

  const [isPending, startTransition] = useTransition();

  const handleNavClick = (view: string) => {
    startTransition(() => {
      setCurrentView(view as any);
    });
  };

  const navItems = [
    { id: 'store', label: 'App Store', icon: Store, permission: 'accessRecent' },
    { id: 'installed-apps', label: translations[language].installedApps || 'Installed', icon: Layers },
    { id: 'leaderboards', label: language === 'ru' ? 'Рейтинги' : 'Leaderboards', icon: Trophy },
    { id: 'editor', label: translations[language].editor, icon: Code2, permission: 'publishApps' },
    { id: 'my-apps', label: translations[language].myApps, icon: Package },
    { id: 'asset-store', label: 'Asset Store', icon: ShoppingBag, permission: 'accessAssetStore' },
    { id: 'donate', label: language === 'ru' ? 'Поддержать' : 'Donate', icon: Coins },
    { id: 'premium', label: translations[language].premium, icon: Star, permission: 'accessPremium' },
    { id: 'profile', label: translations[language].profile, icon: User },
    ...(effectiveRole === 'developer' || effectiveRole === 'admin' || effectiveRole === 'moderator'
      ? [{ id: 'control', label: 'Control', icon: ShieldCheck, permission: 'accessControl' }]
      : []),
    { id: 'news', label: translations[language].news || (language === 'ru' ? 'Новости' : 'News'), icon: Newspaper },
    { id: 'settings', label: translations[language].settings, icon: Settings },
  ] as const;

  const permittedNavItems = navItems.filter((item) => {
    if (actualRole === 'developer' || actualRole === 'admin') return true;
    if ('permission' in item && userData?.permissions) {
      const permKey = item.permission as keyof typeof userData.permissions;
      return userData.permissions[permKey] !== false;
    }
    return true;
  });

  const visibleNavItems = permittedNavItems.filter(
    (item) => item.id === 'settings' || !hiddenTabs.includes(item.id)
  );
  const hiddenPermittedItems = permittedNavItems.filter(
    (item) => item.id !== 'settings' && hiddenTabs.includes(item.id)
  );

  const isLight = theme === 'light' && !isFrutigerAero;

  return (
    <div
      className={clsx(
        'flex flex-col md:flex-row h-screen w-full transition-colors duration-150 overflow-hidden relative',
        isFrutigerAero
          ? 'frutiger-aero-bg text-[#062038]'
          : isLight
          ? 'bg-[#F5F6F8] text-[#111315]'
          : 'bg-[#111315] text-[#F3F4F6]'
      )}
    >
      {isPending && (
        <div className="fixed top-0 left-0 w-full h-0.5 bg-[#10B981]/25 z-[1000] overflow-hidden">
          <div className="h-full w-1/3 bg-[#10B981] transition-transform" />
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside
        className={clsx(
          'hidden md:flex w-64 shrink-0 flex-col border-r relative z-10 h-screen',
          isFrutigerAero
            ? 'frutiger-aero-glass border-white/50'
            : isLight
            ? 'border-[#E2E5EA] bg-[#FFFFFF]'
            : 'border-[#262B33] bg-[#181B20]'
        )}
      >
        <div className="flex flex-col h-full p-4">
          {/* Clean IDE Brand Header */}
          <div className="px-2 pt-1 pb-4 mb-4 border-b border-current/10">
            <div className="flex items-center gap-2.5">
              <div
                className={clsx(
                  'w-8 h-8 rounded-lg flex items-center justify-center border shrink-0',
                  isFrutigerAero
                    ? 'bg-white/60 border-white text-[#0284c7]'
                    : isLight
                    ? 'bg-[#059669]/10 border-[#059669]/30 text-[#059669]'
                    : 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
                )}
              >
                <Terminal className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h1
                  className={clsx(
                    'text-base font-bold tracking-tight leading-none truncate',
                    isFrutigerAero
                      ? 'frutiger-aero-text'
                      : isLight
                      ? 'text-[#111315]'
                      : 'text-[#F3F4F6]'
                  )}
                >
                  {isPremium ? 'EPL Premium' : 'EPL Studio'}
                </h1>
                <p
                  className={clsx(
                    'text-[11px] mt-1 font-mono truncate',
                    isFrutigerAero
                      ? 'text-[#1e4b73]'
                      : isLight
                      ? 'text-[#6B7280]'
                      : 'text-[#9CA3AF]'
                  )}
                >
                  Easy Programming Language
                </p>
              </div>
            </div>
          </div>

          {/* Account Summary */}
          <div
            className={clsx(
              'mb-3 pb-3 border-b',
              isFrutigerAero
                ? 'border-white/40'
                : isLight
                ? 'border-[#E2E5EA]'
                : 'border-[#262B33]'
            )}
          >
            {user ? (
              <div className="flex items-center gap-2.5 px-1.5 py-1">
                <img
                  src={user.photoURL || userData?.avatarUrl || getDefaultAvatar(user.uid)}
                  alt="Avatar"
                  className={clsx(
                    'w-8 h-8 rounded-lg object-cover shrink-0 border',
                    isFrutigerAero
                      ? 'border-white/80'
                      : isLight
                      ? 'border-[#E2E5EA] bg-[#F5F6F8]'
                      : 'border-[#262B33] bg-[#111315]'
                  )}
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 min-w-0">
                    {userData?.isVerifiedAuthor && <VerifiedBadge size="xs" />}
                    <span className="text-sm font-semibold truncate">
                      {userData?.name || user.displayName || 'User'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={clsx(
                        'text-[11px] font-mono-num font-medium',
                        isFrutigerAero
                          ? 'text-[#0284c7]'
                          : isLight
                          ? 'text-[#059669]'
                          : 'text-[#10B981]'
                      )}
                    >
                      {userData?.eplCoins || 0} Coins
                    </span>
                    <UserRoleBadge
                      role={effectiveRole}
                      isVerifiedAuthor={false}
                      size="xs"
                      showLabel
                    />
                  </div>
                </div>
                <button
                  onClick={handleLogOut}
                  title={language === 'ru' ? 'Выйти' : 'Sign out'}
                  className={clsx(
                    'p-1.5 rounded-lg transition-colors shrink-0 cursor-pointer',
                    isFrutigerAero
                      ? 'text-[#1e4b73] hover:bg-white/40 hover:text-red-600'
                      : isLight
                      ? 'text-[#6B7280] hover:bg-[#F5F6F8] hover:text-[#DC2626]'
                      : 'text-[#9CA3AF] hover:bg-[#20242B] hover:text-[#DC2626]'
                  )}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className={clsx(
                  'w-full py-2 px-3 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer',
                  isFrutigerAero
                    ? 'frutiger-aero-button'
                    : isLight
                    ? 'bg-[#059669] hover:bg-[#047857] text-white'
                    : 'bg-[#10B981] hover:bg-[#059669] text-[#09120E]'
                )}
              >
                {t.auth.signIn}
              </button>
            )}
          </div>

          {/* Navigation Header & Tab Visibility Controls */}
          <div className="flex items-center justify-between px-2 mb-1.5 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-55">
              {isCustomizeTabs
                ? language === 'ru'
                  ? 'Настройка вкладок'
                  : 'Customize Tabs'
                : language === 'ru'
                  ? 'Вкладки'
                  : 'Navigation'}
            </span>
            <div className="flex items-center gap-1">
              {hiddenPermittedItems.length > 0 && (
                <button
                  type="button"
                  onClick={restoreAllTabs}
                  title={language === 'ru' ? 'Вернуть все скрытые вкладки' : 'Restore all hidden tabs'}
                  className={clsx(
                    'px-1.5 py-0.5 rounded text-[10px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer',
                    isFrutigerAero
                      ? 'bg-white/60 text-[#0284c7] hover:bg-white/80'
                      : 'bg-[#10B981]/15 text-[#10B981] hover:bg-[#10B981]/25'
                  )}
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>{hiddenPermittedItems.length}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsCustomizeTabs((prev) => !prev)}
                title={language === 'ru' ? 'Скрыть или вернуть вкладки' : 'Hide or restore tabs'}
                className={clsx(
                  'p-1 rounded-md transition-colors cursor-pointer',
                  isCustomizeTabs
                    ? 'bg-[#10B981]/15 text-[#10B981]'
                    : 'opacity-60 hover:opacity-100 hover:bg-current/10'
                )}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Primary Navigation */}
          <nav className="flex-1 overflow-y-auto space-y-1 pr-0.5 no-scrollbar">
            {isCustomizeTabs
              ? permittedNavItems.map((item) => {
                  const isHidden = hiddenTabs.includes(item.id);
                  const isSettings = item.id === 'settings';
                  return (
                    <div
                      key={item.id}
                      className={clsx(
                        'w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors',
                        isHidden
                          ? 'opacity-50 border-dashed border-current/20'
                          : isFrutigerAero
                            ? 'border-white/50 bg-white/30'
                            : isLight
                              ? 'border-[#E2E5EA] bg-[#F5F6F8]/60'
                              : 'border-[#262B33] bg-[#111315]/60'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (!isHidden) {
                            handleNavClick(item.id);
                            setIsCustomizeTabs(false);
                          }
                        }}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span className={clsx('truncate text-xs font-medium', isHidden && 'line-through')}>
                          {item.label}
                        </span>
                      </button>
                      {!isSettings && (
                        <button
                          type="button"
                          onClick={() => toggleTabVisibility(item.id)}
                          title={
                            isHidden
                              ? language === 'ru'
                                ? 'Вернуть вкладку'
                                : 'Show tab'
                              : language === 'ru'
                                ? 'Скрыть вкладку'
                                : 'Hide tab'
                          }
                          className={clsx(
                            'p-1 rounded transition-colors shrink-0 cursor-pointer',
                            isHidden
                              ? 'text-[#10B981] hover:bg-[#10B981]/15'
                              : 'opacity-70 hover:opacity-100 hover:text-amber-500'
                          )}
                        >
                          {isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  );
                })
              : visibleNavItems.map((item) => {
                  const active = currentView === item.id;
                  const canHide = item.id !== 'settings';
                  return (
                    <div key={item.id} className="group relative flex items-center">
                      <button
                        onClick={() => handleNavClick(item.id)}
                        className={clsx(
                          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 border cursor-pointer',
                          canHide && 'pr-8',
                          active
                            ? isFrutigerAero
                              ? 'frutiger-aero-button border-white/80'
                              : isLight
                                ? 'bg-[#059669]/10 text-[#059669] border-[#059669]/25 font-semibold'
                                : 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/25 font-semibold'
                            : isFrutigerAero
                              ? 'border-transparent text-[#062038]/80 hover:bg-white/40'
                              : isLight
                                ? 'border-transparent text-[#4B5563] hover:bg-[#F5F6F8] hover:text-[#111315]'
                                : 'border-transparent text-[#9CA3AF] hover:bg-[#20242B] hover:text-[#F3F4F6]'
                        )}
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                      {canHide && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            hideTab(item.id);
                          }}
                          title={language === 'ru' ? 'Скрыть вкладку' : 'Hide tab'}
                          className={clsx(
                            'absolute right-1.5 p-1 rounded-md opacity-0 group-hover:opacity-80 hover:!opacity-100 transition-opacity cursor-pointer',
                            isLight ? 'hover:bg-black/10 text-[#6B7280]' : 'hover:bg-white/10 text-[#9CA3AF]'
                          )}
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}

            {/* Compact Restore Hidden Tabs bar inside nav if any tabs are hidden */}
            {!isCustomizeTabs && hiddenPermittedItems.length > 0 && (
              <div className="pt-2 mt-2 border-t border-current/10">
                <button
                  type="button"
                  onClick={() => setIsCustomizeTabs(true)}
                  className={clsx(
                    'w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed transition-colors cursor-pointer',
                    isFrutigerAero
                      ? 'border-[#0284c7]/40 text-[#0284c7] bg-white/30 hover:bg-white/50'
                      : isLight
                        ? 'border-[#059669]/35 text-[#059669] bg-[#059669]/5 hover:bg-[#059669]/10'
                        : 'border-[#10B981]/30 text-[#10B981] bg-[#10B981]/5 hover:bg-[#10B981]/10'
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    <span>
                      {language === 'ru'
                        ? `Скрытые вкладки (${hiddenPermittedItems.length})`
                        : `Hidden tabs (${hiddenPermittedItems.length})`}
                    </span>
                  </span>
                  <span className="text-[10px] underline">
                    {language === 'ru' ? 'Вернуть' : 'Restore'}
                  </span>
                </button>
              </div>
            )}
          </nav>

          {/* Stylish Download Desktop App CTA directly BELOW Settings */}
          <div className="pt-3 mt-2 border-t border-current/10 shrink-0">
            <a
              href={DESKTOP_APP_DOWNLOAD_URL}
              download
              target="_blank"
              rel="noopener noreferrer"
              className={clsx(
                'group relative w-full flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-200 overflow-hidden',
                isFrutigerAero
                  ? 'frutiger-aero-button border-white shadow-md hover:-translate-y-0.5'
                  : isLight
                    ? 'bg-gradient-to-r from-[#059669] via-[#0D9488] to-[#0284C7] text-white border-emerald-600/30 shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 hover:-translate-y-0.5'
                    : 'bg-gradient-to-r from-[#10B981]/20 via-[#06B6D4]/15 to-[#3B82F6]/20 border-[#10B981]/45 text-[#F3F4F6] hover:border-[#10B981] hover:shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:-translate-y-0.5'
              )}
            >
              <div
                className={clsx(
                  'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105',
                  isFrutigerAero
                    ? 'bg-white/75 text-[#0284c7]'
                    : isLight
                      ? 'bg-white/20 text-white backdrop-blur-sm'
                      : 'bg-gradient-to-br from-[#10B981] to-[#06B6D4] text-[#09120E] shadow-sm'
                )}
              >
                <MonitorDown className="w-4.5 h-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold tracking-tight truncate">
                    Download Desktop App
                  </span>
                  <Sparkles
                    className={clsx(
                      'w-3 h-3 shrink-0 opacity-85',
                      isLight ? 'text-amber-200' : 'text-[#10B981]'
                    )}
                  />
                </div>
                <p
                  className={clsx(
                    'text-[10px] truncate mt-0.5',
                    isFrutigerAero
                      ? 'text-[#1e4b73]'
                      : isLight
                        ? 'text-white/85'
                        : 'text-[#9CA3AF]'
                  )}
                >
                  {language === 'ru' ? 'Нативная версия для ПК' : 'Native PC Installer'}
                </p>
              </div>
              <Download className="w-4 h-4 shrink-0 opacity-80 transition-transform duration-200 group-hover:translate-y-0.5" />
            </a>
          </div>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header
        className={clsx(
          'md:hidden flex items-center justify-between px-4 py-3 border-b relative z-10 shrink-0',
          isFrutigerAero
            ? 'frutiger-aero-glass border-white/50'
            : isLight
            ? 'border-[#E2E5EA] bg-[#FFFFFF]'
            : 'border-[#262B33] bg-[#181B20]'
        )}
      >
        <div className="flex items-center gap-2.5">
          {currentView !== 'editor' && currentView !== 'store' && (
            <button
              onClick={() => setCurrentView('store')}
              className={clsx(
                'p-1.5 rounded-lg transition-colors border',
                isFrutigerAero
                  ? 'border-white/60 text-[#062038] hover:bg-white/40'
                  : isLight
                  ? 'border-[#E2E5EA] text-[#4B5563] hover:bg-[#F5F6F8]'
                  : 'border-[#262B33] text-[#9CA3AF] hover:bg-[#20242B]'
              )}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Terminal
              className={clsx(
                'w-4 h-4',
                isFrutigerAero
                  ? 'text-[#0284c7]'
                  : isLight
                  ? 'text-[#059669]'
                  : 'text-[#10B981]'
              )}
            />
            <h1 className="text-base font-bold tracking-tight">
              {isPremium ? 'EPL Premium' : 'EPL Studio'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2">
              <UserRoleBadge
                role={effectiveRole}
                isVerifiedAuthor={userData?.isVerifiedAuthor}
                size="xs"
              />
              <img
                src={user.photoURL || userData?.avatarUrl || getDefaultAvatar(user.uid)}
                alt="Avatar"
                className={clsx(
                  'w-7 h-7 rounded-lg object-cover border',
                  isFrutigerAero
                    ? 'border-white/60'
                    : isLight
                    ? 'border-[#E2E5EA]'
                    : 'border-[#262B33]'
                )}
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className={clsx(
                'text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap',
                isFrutigerAero
                  ? 'frutiger-aero-button'
                  : isLight
                  ? 'bg-[#059669] text-white'
                  : 'bg-[#10B981] text-[#09120E]'
              )}
            >
              {t.auth.signIn}
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main
        className={clsx(
          'flex-1 min-h-0 overflow-y-auto relative flex flex-col z-10',
          isFrutigerAero
            ? 'frutiger-aero-bg'
            : isLight
            ? 'bg-[#F5F6F8]'
            : 'bg-[#111315]'
        )}
      >
        {children}
      </main>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {selectedAppId && <AppDetailView />}

      {/* Mobile Bottom Sheet for Tab Customization & Download Desktop App */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={clsx(
              'w-full max-h-[78vh] rounded-t-2xl border-t p-4 flex flex-col gap-4 shadow-2xl',
              isFrutigerAero
                ? 'frutiger-aero-glass border-white'
                : isLight
                  ? 'bg-white border-[#E2E5EA] text-[#111315]'
                  : 'bg-[#181B20] border-[#262B33] text-[#F3F4F6]'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">
                {language === 'ru' ? 'Вкладки и приложение для ПК' : 'Tabs & Desktop App'}
              </span>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-lg hover:bg-current/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Download Desktop App CTA on Mobile */}
            <a
              href={DESKTOP_APP_DOWNLOAD_URL}
              download
              target="_blank"
              rel="noopener noreferrer"
              className={clsx(
                'flex items-center gap-3 p-3 rounded-xl border transition-all',
                isFrutigerAero
                  ? 'frutiger-aero-button border-white'
                  : isLight
                    ? 'bg-gradient-to-r from-[#059669] to-[#0284C7] text-white border-emerald-600/30'
                    : 'bg-gradient-to-r from-[#10B981]/20 via-[#06B6D4]/15 to-[#3B82F6]/20 border-[#10B981]/45 text-[#F3F4F6]'
              )}
            >
              <div className="w-9 h-9 rounded-lg bg-[#10B981] text-[#09120E] flex items-center justify-center shrink-0">
                <MonitorDown className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">Download Desktop App</div>
                <div className="text-[11px] opacity-80 truncate">
                  {language === 'ru' ? 'Скачать версию для компьютера' : 'Download Desktop Build'}
                </div>
              </div>
              <Download className="w-4 h-4 shrink-0" />
            </a>

            {/* Mobile Tab Visibility Manager */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider opacity-70">
                {language === 'ru' ? 'Показать / скрыть вкладки' : 'Show / Hide Tabs'}
              </span>
              {hiddenPermittedItems.length > 0 && (
                <button
                  type="button"
                  onClick={restoreAllTabs}
                  className="text-xs font-semibold text-[#10B981] inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{language === 'ru' ? 'Вернуть все' : 'Restore all'}</span>
                </button>
              )}
            </div>

            <div className="overflow-y-auto grid grid-cols-2 gap-2 pb-2">
              {permittedNavItems.map((item) => {
                const isHidden = hiddenTabs.includes(item.id);
                const isSettings = item.id === 'settings';
                return (
                  <div
                    key={item.id}
                    className={clsx(
                      'flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border text-xs',
                      isHidden ? 'opacity-50 border-dashed border-current/25' : 'border-current/15'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (isHidden) showTab(item.id);
                        handleNavClick(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    >
                      <item.icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate font-medium">{item.label}</span>
                    </button>
                    {!isSettings && (
                      <button
                        type="button"
                        onClick={() => toggleTabVisibility(item.id)}
                        className="p-1 rounded hover:bg-current/10 shrink-0"
                        title={isHidden ? 'Show' : 'Hide'}
                      >
                        {isHidden ? (
                          <Eye className="w-3.5 h-3.5 text-[#10B981]" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 opacity-70" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav (Fixed smooth horizontal scrolling across ALL tabs) */}
      <footer
        className={clsx(
          'md:hidden shrink-0 w-full flex items-center border-t relative z-20 px-1 py-1.5 gap-1',
          isFrutigerAero
            ? 'frutiger-aero-glass border-white/50'
            : isLight
            ? 'border-[#E2E5EA] bg-[#FFFFFF]'
            : 'border-[#262B33] bg-[#181B20]'
        )}
      >
        <button
          type="button"
          onClick={() => mobileNavRef.current?.scrollBy({ left: -160, behavior: 'smooth' })}
          aria-label="Scroll tabs left"
          className="p-1.5 rounded-lg opacity-65 hover:opacity-100 active:scale-95 shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <nav
          ref={mobileNavRef}
          className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden no-scrollbar touch-pan-x scroll-smooth snap-x"
        >
          <div className="inline-flex items-center gap-1 whitespace-nowrap px-0.5">
            {visibleNavItems.map((item) => {
              const active = currentView === item.id;
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    mobileTabRefs.current[item.id] = el;
                  }}
                  onClick={() => handleNavClick(item.id)}
                  className={clsx(
                    'flex flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 rounded-lg transition-colors min-w-[62px] whitespace-nowrap shrink-0 snap-start',
                    active
                      ? isFrutigerAero
                        ? 'text-[#0284c7] bg-white/60 font-semibold'
                        : isLight
                        ? 'text-[#059669] bg-[#059669]/10 font-semibold'
                        : 'text-[#10B981] bg-[#10B981]/10 font-semibold'
                      : isFrutigerAero
                      ? 'text-[#062038]/75'
                      : isLight
                      ? 'text-[#6B7280]'
                      : 'text-[#9CA3AF]'
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <button
          type="button"
          onClick={() => mobileNavRef.current?.scrollBy({ left: 160, behavior: 'smooth' })}
          aria-label="Scroll tabs right"
          className="p-1.5 rounded-lg opacity-65 hover:opacity-100 active:scale-95 shrink-0"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          title={language === 'ru' ? 'Вкладки и Desktop App' : 'Tabs & Desktop App'}
          className={clsx(
            'relative p-2 rounded-lg border shrink-0 transition-colors',
            isFrutigerAero
              ? 'border-white/70 bg-white/40 text-[#0284c7]'
              : isLight
              ? 'border-[#E2E5EA] bg-[#F5F6F8] text-[#111315]'
              : 'border-[#262B33] bg-[#111315] text-[#F3F4F6]'
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {hiddenPermittedItems.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#10B981] text-[#09120E] text-[9px] font-bold flex items-center justify-center">
              {hiddenPermittedItems.length}
            </span>
          )}
        </button>
      </footer>
    </div>
  );
}
