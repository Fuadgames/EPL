import React, { useEffect, useTransition } from 'react';
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
} from 'lucide-react';
import { logOut } from '../firebase';
import { clsx } from 'clsx';
import { translations } from '../lib/translations';
import AuthModal from './AuthModal';
import AppDetailView from './AppDetailView';
import { getDefaultAvatar } from '../lib/avatar';
import UserRoleBadge from './UserRoleBadge';
import VerifiedBadge from './VerifiedBadge';

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
  const t = translations[language];

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
    { id: 'settings', label: translations[language].settings, icon: Settings },
  ] as const;

  const filteredNavItems = navItems.filter((item) => {
    if (actualRole === 'developer' || actualRole === 'admin') return true;
    if ('permission' in item && userData?.permissions) {
      const permKey = item.permission as keyof typeof userData.permissions;
      return userData.permissions[permKey] !== false;
    }
    return true;
  });

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
              'mb-4 pb-4 border-b',
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
                    'p-1.5 rounded-lg transition-colors shrink-0',
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
                  'w-full py-2 px-3 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap',
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

          {/* Primary Navigation */}
          <nav className="flex-1 overflow-y-auto space-y-1 pr-0.5">
            {filteredNavItems.map((item) => {
              const active = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 border',
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
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header
        className={clsx(
          'md:hidden flex items-center justify-between px-4 py-3 border-b relative z-10',
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
          'flex-1 overflow-y-auto relative flex flex-col z-10',
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

      {/* Mobile Bottom Nav */}
      <nav
        className={clsx(
          'md:hidden flex items-center p-2 border-t overflow-x-auto no-scrollbar relative z-10 touch-pan-x',
          isFrutigerAero
            ? 'frutiger-aero-glass border-white/50'
            : isLight
            ? 'border-[#E2E5EA] bg-[#FFFFFF]'
            : 'border-[#262B33] bg-[#181B20]'
        )}
      >
        <div className="flex items-center justify-start min-w-max px-1 gap-1.5 w-full">
          {filteredNavItems.map((item) => {
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={clsx(
                  'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors min-w-[60px] whitespace-nowrap shrink-0',
                  active
                    ? isFrutigerAero
                      ? 'text-[#0284c7] bg-white/50'
                      : isLight
                      ? 'text-[#059669] bg-[#059669]/10'
                      : 'text-[#10B981] bg-[#10B981]/10'
                    : isFrutigerAero
                    ? 'text-[#062038]/70'
                    : isLight
                    ? 'text-[#6B7280]'
                    : 'text-[#9CA3AF]'
                )}
              >
                <item.icon className="w-4 h-4" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
