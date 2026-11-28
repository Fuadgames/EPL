import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { auth } from '../firebase';
import { updateProfile } from 'firebase/auth';
import {
  Sun,
  Moon,
  User,
  Save,
  CheckCircle2,
  AlertCircle,
  Bot,
  ShieldCheck,
  Upload,
  Code2,
  Eye,
  Layers,
  MonitorDown,
  Download,
  Sparkles,
  FolderTree,
  RotateCcw,
  Languages,
  RefreshCw,
  ChevronDown,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { getEmojiAvatar } from '../lib/avatar';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { notify } from '../store/useDialogStore';
import CustomSelect from './CustomSelect';
import {
  SUPPORTED_LANGUAGES,
  getLanguageMeta,
} from '../lib/languages';

export default function SettingsView() {
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);
  const language = useStore((state) => state.language);
  const setLanguage = useStore((state) => state.setLanguage);
  const autoTranslateEnabled = useStore((state) => state.autoTranslateEnabled);
  const setAutoTranslateEnabled = useStore((state) => state.setAutoTranslateEnabled);
  const livePreviewEnabled = useStore((state) => state.livePreviewEnabled);
  const setLivePreviewEnabled = useStore((state) => state.setLivePreviewEnabled);
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.setUser);
  const aiAnswerMode = useStore((state) => state.aiAnswerMode);
  const setAiAnswerMode = useStore((state) => state.setAiAnswerMode);
  const aiChangesEnabled = useStore((state) => state.aiChangesEnabled);
  const setAiChangesEnabled = useStore((state) => state.setAiChangesEnabled);
  const isFrutigerAero = useStore((state) => state.isFrutigerAero);
  const setIsFrutigerAero = useStore((state) => state.setIsFrutigerAero);
  const userData = useStore((state) => state.userData);
  const setUserData = useStore((state) => state.setUserData);
  const simulatedRole = useStore((state) => state.simulatedRole);
  const setSimulatedRole = useStore((state) => state.setSimulatedRole);
  const setIsDesktopDownloadOpen = useStore((state) => state.setIsDesktopDownloadOpen);
  const legacyNavigation = useStore((state) => state.legacyNavigation);
  const setLegacyNavigation = useStore((state) => state.setLegacyNavigation);
  const resetNavOrder = useStore((state) => state.resetNavOrder);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState((userData as any)?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(userData?.avatarUrl || user?.photoURL || '');
  const [region, setRegion] = useState(userData?.region || 'Global');
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  const [isUpdating, setIsUpdating] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const langSelectRef = useRef<HTMLSelectElement>(null);

  const isRu = language === 'ru';

  useEffect(() => {
    const onTranslationStatus = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      setIsTranslating(Boolean(detail?.translating));
    };
    window.addEventListener('epl:translation-status', onTranslationStatus);
    return () => window.removeEventListener('epl:translation-status', onTranslationStatus);
  }, []);

  useEffect(() => {
    if (isLangMenuOpen) {
      requestAnimationFrame(() => langSelectRef.current?.focus());
    }
  }, [isLangMenuOpen]);

  useEffect(() => {
    setDisplayName((prev) => (prev ? prev : userData?.name || user?.displayName || ''));
    setBio((prev) => (prev ? prev : (userData as any)?.bio || ''));
    setAvatarUrl((prev) => (prev ? prev : userData?.avatarUrl || user?.photoURL || ''));
    setRegion((prev) => (prev && prev !== 'Global' ? prev : userData?.region || 'Global'));
  }, [user, userData]);

  const activeLangMeta = useMemo(() => getLanguageMeta(language), [language]);

  const handleSelectLanguage = (code: string) => {
    if (!autoTranslateEnabled) {
      setAutoTranslateEnabled(true);
    }
    setLanguage(code);
    const meta = getLanguageMeta(code);
    notify.success(`${meta.flag} ${meta.name}`);
  };

  const handleRetranslateNow = () => {
    if (!autoTranslateEnabled) {
      setAutoTranslateEnabled(true);
    }
    window.dispatchEvent(new CustomEvent('epl:retranslate'));
    notify.info(isRu ? 'Обновляем перевод сайта...' : 'Refreshing site translation...');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUpdating(true);
    setStatus(null);
    try {
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../firebase');
      const storageRef = ref(storage, `avatars/${user.uid}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setAvatarUrl(url);
      const msg = isRu
        ? 'Аватар загружен! Нажмите «Сохранить изменения», чтобы применить.'
        : 'Avatar uploaded! Click "Save Changes" to apply.';
      setStatus({ type: 'success', message: msg });
      notify.success(msg);
    } catch (error: any) {
      const msg = (isRu ? 'Ошибка загрузки: ' : 'Upload failed: ') + error.message;
      setStatus({ type: 'error', message: msg });
      notify.error(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUpdating(true);
    setStatus(null);
    try {
      if (!auth.currentUser) throw new Error(isRu ? 'Пользователь не авторизован' : 'No authenticated user');
      await updateProfile(auth.currentUser, { displayName, photoURL: avatarUrl });

      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');

      const updateData = {
        uid: user.uid,
        name: displayName,
        bio,
        avatarUrl,
        region,
      };

      await setDoc(doc(db, 'users', user.uid), updateData, { merge: true });
      await setDoc(doc(db, 'users_public', user.uid), updateData, { merge: true }).catch(() => {});

      const oldAvatar = userData?.avatarUrl || user.photoURL || '';
      if (avatarUrl !== oldAvatar) {
        await setDoc(doc(db, 'adminRequests', `${user.uid}_avatar_${Date.now()}`), {
          id: `${user.uid}_avatar_${Date.now()}`,
          type: 'avatar_change',
          targetId: user.uid,
          targetName: displayName,
          requesterId: user.uid,
          requesterName: displayName,
          avatarUrl,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
      }

      setUser({ ...user, displayName, photoURL: avatarUrl } as any);
      setUserData({ ...userData, name: displayName, bio, avatarUrl, region } as any);

      const okMsg = isRu ? 'Профиль успешно обновлён!' : 'Profile updated successfully!';
      setStatus({ type: 'success', message: okMsg });
      notify.success(okMsg);
    } catch (error: any) {
      setStatus({ type: 'error', message: error.message });
      notify.error(error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const isDirty =
    displayName !== (user?.displayName || '') ||
    bio !== ((userData as any)?.bio || '') ||
    avatarUrl !== (userData?.avatarUrl || user?.photoURL || '') ||
    region !== (userData?.region || 'Global');

  const sectionCard = clsx(
    'p-4 sm:p-6 rounded-xl border',
    isFrutigerAero
      ? 'bg-white/40 border-white/50 backdrop-blur-md shadow-sm'
      : theme !== 'light'
        ? 'bg-[#181B20] border-[#262B33]'
        : 'bg-white border-[#E2E5EA]'
  );

  const inputClass = clsx(
    'w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors',
    isFrutigerAero
      ? 'bg-white/60 border-white/40 text-blue-900 shadow-inner'
      : theme !== 'light'
        ? 'bg-[#111315] border-[#262B33] text-[#F3F4F6] focus:border-[#10B981]'
        : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315] focus:border-[#059669]'
  );

  const headingCls = isFrutigerAero
    ? 'text-blue-900'
    : theme !== 'light'
      ? 'text-[#F3F4F6]'
      : 'text-[#111315]';

  const mutedCls = isFrutigerAero
    ? 'text-blue-800/70'
    : theme !== 'light'
      ? 'text-[#9CA3AF]'
      : 'text-[#525866]';

  return (
    <div className="h-full flex flex-col p-3.5 sm:p-8 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full pb-6">
        <div className="mb-5 pb-4 border-b border-[#262B33]/60">
          <h1 className={clsx('text-2xl font-bold tracking-tight', headingCls)}>
            {isRu ? 'Настройки' : 'Settings'}
          </h1>
          <p className={clsx('text-xs mt-0.5', mutedCls)}>
            {isRu
              ? 'Язык интерфейса, оформление, параметры редактора, навигация и профиль'
              : 'Site language, theme preferences, live workspace options, navigation, and account'}
          </p>
        </div>

        <div className="space-y-4 sm:space-y-5">
          {/* Developer Simulation Section */}
          {userData?.role === 'developer' && simulatedRole && (
            <section
              className={clsx(
                'p-4 sm:p-6 rounded-xl border border-amber-500/40 bg-amber-500/10',
                isFrutigerAero ? 'backdrop-blur-md shadow-sm' : ''
              )}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h2 className={clsx('text-lg font-bold', headingCls)}>
                  {isRu ? 'Симуляция роли разработчика' : 'Developer Simulation'}
                </h2>
              </div>
              <p className={clsx('text-sm mb-4', isFrutigerAero ? 'text-blue-800/80' : theme !== 'light' ? 'text-[#D1D5DB]' : 'text-[#374151]')}>
                {isRu ? 'Сейчас активна симуляция роли: ' : 'You are currently simulating the '}
                <strong>{simulatedRole}</strong>
                {isRu ? '.' : ' role.'}
              </p>
              <button
                onClick={() => setSimulatedRole(null)}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-black transition-colors cursor-pointer"
              >
                {isRu ? 'Вернуться в режим разработчика' : 'Revert to Developer Mode'}
              </button>
            </section>
          )}

          {/* Language & Whole-Site Translation Section */}
          <section className={sectionCard}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={clsx(
                    'p-2 rounded-lg border shrink-0',
                    isFrutigerAero
                      ? 'bg-blue-500/20 border-blue-400/30 text-blue-600'
                      : 'bg-[#10B981]/10 border-[#10B981]/25 text-[#10B981]'
                  )}
                >
                  <Languages className="w-4 h-4" />
                </div>
                <div>
                  <h2 className={clsx('text-base font-bold', headingCls)}>
                    {isRu ? 'Перевод и язык сайта' : 'Site Translation & Language'}
                  </h2>
                  <p className={clsx('text-xs', mutedCls)}>
                    {isRu
                      ? `Поддержка ${SUPPORTED_LANGUAGES.length} языков с автоматическим переводом всего интерфейса`
                      : `${SUPPORTED_LANGUAGES.length} languages available with full automatic interface translation`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                {isTranslating && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#10B981]/15 text-[#10B981] text-xs font-medium">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>{isRu ? 'Перевод...' : 'Translating...'}</span>
                  </span>
                )}
                <div
                  data-no-translate="true"
                  className={clsx(
                    'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold shrink-0',
                    isFrutigerAero
                      ? 'bg-white/60 border-white/60 text-blue-900'
                      : theme !== 'light'
                        ? 'bg-[#111315] border-[#262B33] text-[#F3F4F6]'
                        : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315]'
                  )}
                >
                  <span className="text-base leading-none">{activeLangMeta.flag}</span>
                  <span>{activeLangMeta.name}</span>
                  <span className="font-mono text-[10px] opacity-65 uppercase">
                    {activeLangMeta.code}
                  </span>
                </div>
              </div>
            </div>

            {/* Change Language Button + Current Language Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsLangMenuOpen((prev) => !prev)}
                  className={clsx(
                    'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer min-h-[42px] shadow-xs',
                    isFrutigerAero
                      ? 'frutiger-aero-button'
                      : 'bg-[#10B981] hover:bg-[#059669] text-[#09120E]'
                  )}
                >
                  <Languages className="w-4 h-4 shrink-0" />
                  <span>{isRu ? 'Поменять язык' : 'Change Language'}</span>
                  <ChevronDown
                    className={clsx(
                      'w-4 h-4 shrink-0 transition-transform',
                      isLangMenuOpen && 'rotate-180'
                    )}
                  />
                </button>

                <div
                  data-no-translate="true"
                  className={clsx(
                    'inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold min-h-[42px]',
                    isFrutigerAero
                      ? 'bg-white/60 border-white/60 text-blue-900'
                      : theme !== 'light'
                        ? 'bg-[#111315] border-[#262B33] text-[#F3F4F6]'
                        : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315]'
                  )}
                >
                  <span className="text-base leading-none">{activeLangMeta.flag}</span>
                  <span>{activeLangMeta.name}</span>
                  <span className="font-mono text-[10px] opacity-65 uppercase">
                    {activeLangMeta.code}
                  </span>
                </div>
              </div>
            </div>

            {/* Opened Language Selection Menu (native <select>) */}
            {isLangMenuOpen && (
              <div
                className={clsx(
                  'mb-4 p-3.5 rounded-xl border space-y-2.5',
                  isFrutigerAero
                    ? 'bg-white/70 border-white/80 backdrop-blur-md shadow-sm'
                    : theme !== 'light'
                      ? 'bg-[#111315] border-[#10B981]/50 shadow-lg'
                      : 'bg-[#F5F6F8] border-[#059669]/40 shadow-sm'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="epl-site-language-select"
                    className={clsx('text-xs font-semibold', headingCls)}
                  >
                    {isRu
                      ? `Выберите язык (${SUPPORTED_LANGUAGES.length} языков)`
                      : `Select a language (${SUPPORTED_LANGUAGES.length} languages)`}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsLangMenuOpen(false)}
                    aria-label={isRu ? 'Закрыть меню языков' : 'Close language menu'}
                    className={clsx(
                      'p-1 rounded-lg transition-colors cursor-pointer',
                      theme !== 'light'
                        ? 'text-[#9CA3AF] hover:text-white hover:bg-[#1F242C]'
                        : 'text-[#525866] hover:text-black hover:bg-zinc-200'
                    )}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <select
                  id="epl-site-language-select"
                  ref={langSelectRef}
                  data-no-translate="true"
                  value={language}
                  onChange={(e) => {
                    handleSelectLanguage(e.target.value);
                    setIsLangMenuOpen(false);
                  }}
                  className={clsx(
                    'w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium focus:outline-none cursor-pointer min-h-[44px]',
                    isFrutigerAero
                      ? 'bg-white/90 border-blue-300 text-blue-950'
                      : theme !== 'light'
                        ? 'bg-[#181B20] border-[#262B33] text-[#F3F4F6] focus:border-[#10B981]'
                        : 'bg-white border-[#D1D5DB] text-[#111315] focus:border-[#059669]'
                  )}
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name} — {lang.englishName} ({lang.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Auto-Translation Toggle & Refresh Bar */}
            <div
              className={clsx(
                'p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                isFrutigerAero
                  ? 'bg-white/45 border-white/50'
                  : theme !== 'light'
                    ? 'bg-[#111315] border-[#262B33]'
                    : 'bg-[#F5F6F8] border-[#E2E5EA]'
              )}
            >
              <div className="min-w-0">
                <div className={clsx('text-xs font-semibold', headingCls)}>
                  {isRu ? 'Автоперевод всего сайта' : 'Auto-Translate Entire Website'}
                </div>
                <div className={clsx('text-[11px] mt-0.5', mutedCls)}>
                  {isRu
                    ? 'Автоматически переводит все кнопки, разделы и подсказки на выбранный язык'
                    : 'Automatically translates all menus, buttons, and pages into the selected language'}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleRetranslateNow}
                  disabled={isTranslating}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer min-h-[34px] disabled:opacity-60',
                    isFrutigerAero
                      ? 'bg-white/70 border-white/60 text-blue-900 hover:bg-white'
                      : theme !== 'light'
                        ? 'bg-[#181B20] border-[#262B33] text-[#E5E7EB] hover:border-[#10B981]/50'
                        : 'bg-white border-[#E2E5EA] text-[#111315] hover:border-[#059669]/50'
                  )}
                >
                  <RefreshCw className={clsx('w-3.5 h-3.5', isTranslating && 'animate-spin')} />
                  <span>{isRu ? 'Перевести сейчас' : 'Translate Now'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAutoTranslateEnabled(!autoTranslateEnabled)}
                  aria-label={isRu ? 'Переключить автоперевод сайта' : 'Toggle Auto-Translate'}
                  className={clsx(
                    'w-11 h-6 rounded-full transition-colors relative cursor-pointer border shrink-0',
                    autoTranslateEnabled
                      ? 'bg-[#10B981] border-[#10B981]'
                      : isFrutigerAero
                        ? 'bg-white/50 border-white/60'
                        : theme !== 'light'
                          ? 'bg-[#181B20] border-[#262B33]'
                          : 'bg-[#E2E5EA] border-[#CBD5E1]'
                  )}
                >
                  <div
                    className={clsx(
                      'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all shadow-sm',
                      autoTranslateEnabled ? 'left-6' : 'left-0.5'
                    )}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Appearance Section */}
          <section className={sectionCard}>
            <div className="flex items-center gap-3 mb-5">
              <div
                className={clsx(
                  'p-2 rounded-lg border',
                  isFrutigerAero
                    ? 'bg-blue-500/20 border-blue-400/30 text-blue-600'
                    : 'bg-[#10B981]/10 border-[#10B981]/25 text-[#10B981]'
                )}
              >
                <Sun className="w-4 h-4" />
              </div>
              <h2 className={clsx('text-base font-bold', headingCls)}>
                {isRu ? 'Оформление' : 'Appearance'}
              </h2>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className={clsx('text-sm font-semibold', headingCls)}>
                  {isRu ? 'Тема интерфейса' : 'Theme Mode'}
                </p>
                <p className={clsx('text-xs mt-0.5', mutedCls)}>
                  {isRu
                    ? 'Переключение между светлой и тёмной темой среды'
                    : 'Switch between crisp light and dark graphite IDE themes'}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setTheme('light')}
                  className={clsx(
                    'flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer whitespace-nowrap min-h-[40px]',
                    isFrutigerAero && theme === 'light'
                      ? 'bg-blue-500 text-white border-blue-600 shadow-sm'
                      : isFrutigerAero
                        ? 'bg-white/50 border-white/40 text-blue-800 hover:bg-white/70'
                        : theme === 'light'
                          ? 'bg-[#111315] border-[#111315] text-white'
                          : 'bg-[#111315] border-[#262B33] text-[#9CA3AF] hover:text-[#F3F4F6]'
                  )}
                >
                  <Sun className="w-4 h-4" /> {isRu ? 'Светлая' : 'Light'}
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={clsx(
                    'flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer whitespace-nowrap min-h-[40px]',
                    isFrutigerAero && theme === 'dark'
                      ? 'bg-blue-500 text-white border-blue-600 shadow-sm'
                      : isFrutigerAero
                        ? 'bg-white/50 border-white/40 text-blue-800 hover:bg-white/70'
                        : theme !== 'light'
                          ? 'bg-[#10B981] border-[#10B981] text-[#0A0C0E] font-semibold'
                          : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#525866] hover:text-[#111315]'
                  )}
                >
                  <Moon className="w-4 h-4" /> {isRu ? 'Тёмная' : 'Dark'}
                </button>
              </div>
            </div>

            {/* Frutiger Aero Toggle (Preserved Purchasable Skin) */}
            {userData?.purchasedItems?.includes('frutiger-aero') && (
              <div
                className={clsx(
                  'flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-5 pt-5 border-t',
                  isFrutigerAero
                    ? 'border-white/30'
                    : theme !== 'light'
                      ? 'border-[#262B33]'
                      : 'border-[#E2E5EA]'
                )}
              >
                <div>
                  <p className={clsx('text-sm font-semibold flex items-center gap-2', headingCls)}>
                    <Layers className="w-4 h-4 text-blue-500" />
                    <span>{isRu ? 'Стиль Frutiger Aero' : 'Frutiger Aero Style'}</span>
                  </p>
                  <p className={clsx('text-xs mt-0.5', mutedCls)}>
                    {isRu
                      ? 'Включить классический стеклянно-аквамариновый стиль'
                      : 'Enable the classic glass and aqua aesthetic'}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setIsFrutigerAero(true)}
                    className={clsx(
                      'px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer min-h-[38px]',
                      isFrutigerAero
                        ? 'bg-blue-500 text-white border-blue-600 shadow-sm'
                        : theme !== 'light'
                          ? 'bg-[#111315] border-[#262B33] text-[#9CA3AF] hover:text-[#F3F4F6]'
                          : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#525866]'
                    )}
                  >
                    {isRu ? 'Да' : 'Yes'}
                  </button>
                  <button
                    onClick={() => setIsFrutigerAero(false)}
                    className={clsx(
                      'px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer min-h-[38px]',
                      !isFrutigerAero
                        ? theme !== 'light'
                          ? 'bg-[#262B33] border-[#374151] text-[#F3F4F6]'
                          : 'bg-[#111315] border-[#111315] text-white'
                        : 'bg-white/50 border-white/40 text-blue-800 hover:bg-white/70'
                    )}
                  >
                    {isRu ? 'Нет' : 'No'}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Editor Section */}
          <section className={sectionCard}>
            <div className="flex items-center gap-3 mb-5">
              <div
                className={clsx(
                  'p-2 rounded-lg border',
                  isFrutigerAero
                    ? 'bg-blue-500/20 border-blue-400/30 text-blue-600'
                    : 'bg-[#10B981]/10 border-[#10B981]/25 text-[#10B981]'
                )}
              >
                <Code2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className={clsx('text-base font-bold', headingCls)}>
                  {isRu ? 'Редактор' : 'Editor'}
                </h2>
                <p className={clsx('text-xs', mutedCls)}>
                  {isRu ? 'Параметры рабочей области и отображения кода' : 'Workspace and code preview settings'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="max-w-md">
                <p className={clsx('text-sm font-semibold flex items-center gap-2', headingCls)}>
                  <Eye className="w-4 h-4 text-[#10B981]" />
                  <span>{isRu ? 'Живой просмотр (Live Preview)' : 'Live Preview'}</span>
                </p>
                <p className={clsx('text-xs mt-1', mutedCls)}>
                  {isRu
                    ? 'Включает интерактивный показ проекта прямо в редакторе без нажатия на кнопку Run.'
                    : 'Shows interactive project preview directly in the editor without clicking Run.'}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setLivePreviewEnabled(true)}
                  className={clsx(
                    'px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer min-h-[38px]',
                    livePreviewEnabled
                      ? isFrutigerAero
                        ? 'bg-blue-500 text-white border-blue-600'
                        : 'bg-[#10B981] text-[#0A0C0E] border-[#10B981] font-semibold'
                      : isFrutigerAero
                        ? 'bg-white/50 border-white/40 text-blue-800'
                        : theme !== 'light'
                          ? 'bg-[#111315] border-[#262B33] text-[#9CA3AF] hover:text-[#F3F4F6]'
                          : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#525866]'
                  )}
                >
                  {isRu ? 'Вкл' : 'On'}
                </button>
                <button
                  onClick={() => setLivePreviewEnabled(false)}
                  className={clsx(
                    'px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer min-h-[38px]',
                    !livePreviewEnabled
                      ? isFrutigerAero
                        ? 'bg-blue-500 text-white border-blue-600'
                        : theme !== 'light'
                          ? 'bg-[#262B33] border-[#374151] text-[#F3F4F6]'
                          : 'bg-[#111315] border-[#111315] text-white'
                      : isFrutigerAero
                        ? 'bg-white/50 border-white/40 text-blue-800'
                        : theme !== 'light'
                          ? 'bg-[#111315] border-[#262B33] text-[#9CA3AF] hover:text-[#F3F4F6]'
                          : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#525866]'
                  )}
                >
                  {isRu ? 'Выкл' : 'Off'}
                </button>
              </div>
            </div>
          </section>

          {/* Navigation Section (Legacy Navigation & Category Sort Reset) */}
          <section className={sectionCard}>
            <div className="flex items-center gap-3 mb-5">
              <div
                className={clsx(
                  'p-2 rounded-lg border',
                  isFrutigerAero
                    ? 'bg-blue-500/20 border-blue-400/30 text-blue-600'
                    : 'bg-[#10B981]/10 border-[#10B981]/25 text-[#10B981]'
                )}
              >
                <FolderTree className="w-4 h-4" />
              </div>
              <div>
                <h2 className={clsx('text-base font-bold', headingCls)}>
                  {isRu ? 'Навигация и вкладки' : 'Navigation & Tabs'}
                </h2>
                <p className={clsx('text-xs', mutedCls)}>
                  {isRu
                    ? 'Управление категориями меню или возврат к классическому плоскому списку'
                    : 'Choose categorized collapsible sidebar or classic flat tab list'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="max-w-md">
                  <p className={clsx('text-sm font-semibold', headingCls)}>
                    {isRu ? 'Классическая навигация (без категорий)' : 'Legacy Navigation'}
                  </p>
                  <p className={clsx('text-xs mt-1', mutedCls)}>
                    {isRu
                      ? 'Включите, чтобы вернуть старое отображение всех вкладок списком без разделения на категории.'
                      : 'Enable to restore the classic ungrouped list of tabs without categories.'}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setLegacyNavigation(true)}
                    className={clsx(
                      'px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer min-h-[38px]',
                      legacyNavigation
                        ? isFrutigerAero
                          ? 'bg-blue-500 text-white border-blue-600'
                          : 'bg-[#10B981] text-[#0A0C0E] border-[#10B981] font-semibold'
                        : isFrutigerAero
                          ? 'bg-white/50 border-white/40 text-blue-800'
                          : theme !== 'light'
                            ? 'bg-[#111315] border-[#262B33] text-[#9CA3AF] hover:text-[#F3F4F6]'
                            : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#525866]'
                    )}
                  >
                    {isRu ? 'Вкл' : 'On'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLegacyNavigation(false)}
                    className={clsx(
                      'px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer min-h-[38px]',
                      !legacyNavigation
                        ? isFrutigerAero
                          ? 'bg-blue-500 text-white border-blue-600'
                          : theme !== 'light'
                            ? 'bg-[#262B33] border-[#374151] text-[#F3F4F6]'
                            : 'bg-[#111315] border-[#111315] text-white'
                        : isFrutigerAero
                          ? 'bg-white/50 border-white/40 text-blue-800'
                          : theme !== 'light'
                            ? 'bg-[#111315] border-[#262B33] text-[#9CA3AF] hover:text-[#F3F4F6]'
                            : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#525866]'
                    )}
                  >
                    {isRu ? 'Выкл' : 'Off'}
                  </button>
                </div>
              </div>

              {!legacyNavigation && (
                <div
                  className={clsx(
                    'pt-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                    isFrutigerAero
                      ? 'border-white/30'
                      : theme !== 'light'
                        ? 'border-[#262B33]'
                        : 'border-[#E2E5EA]'
                  )}
                >
                  <div>
                    <p className={clsx('text-xs font-semibold', headingCls)}>
                      {isRu ? 'Порядок категорий и вкладок' : 'Category & Tab Sorting'}
                    </p>
                    <p className={clsx('text-[11px] mt-0.5', mutedCls)}>
                      {isRu
                        ? 'Сбросить расположение категорий и вкладок к стандартному.'
                        : 'Restore default order of sidebar categories and tabs.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      resetNavOrder();
                      notify.success(isRu ? 'Порядок категорий сброшен' : 'Navigation order reset');
                    }}
                    className={clsx(
                      'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer shrink-0 min-h-[38px]',
                      isFrutigerAero
                        ? 'bg-white/60 border-white/40 text-blue-900 hover:bg-white/80'
                        : theme !== 'light'
                          ? 'bg-[#111315] border-[#262B33] text-[#E5E7EB] hover:bg-[#20242B]'
                          : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315] hover:bg-zinc-200'
                    )}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isRu ? 'Сбросить порядок' : 'Reset Order'}</span>
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* AI Section */}
          <section className={sectionCard}>
            <div className="flex items-center gap-3 mb-5">
              <div
                className={clsx(
                  'p-2 rounded-lg border',
                  isFrutigerAero
                    ? 'bg-blue-500/20 border-blue-400/30 text-blue-600'
                    : 'bg-[#10B981]/10 border-[#10B981]/25 text-[#10B981]'
                )}
              >
                <Bot className="w-4 h-4" />
              </div>
              <h2 className={clsx('text-base font-bold', headingCls)}>
                {isRu ? 'Настройки ИИ' : 'AI Settings'}
              </h2>
            </div>

            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className={clsx('text-sm font-semibold', headingCls)}>
                    {isRu ? 'Режим ответа' : 'Answer Mode'}
                  </p>
                  <p className={clsx('text-xs mt-0.5', mutedCls)}>
                    {isRu ? 'Как ИИ-ассистент должен выводить ответы' : 'How the AI should output answers'}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setAiAnswerMode('text')}
                    className={clsx(
                      'px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer min-h-[38px]',
                      aiAnswerMode === 'text'
                        ? isFrutigerAero
                          ? 'bg-blue-500 text-white border-blue-600'
                          : 'bg-[#10B981] text-[#0A0C0E] border-[#10B981] font-semibold'
                        : isFrutigerAero
                          ? 'bg-white/50 border-white/40 text-blue-800'
                          : theme !== 'light'
                            ? 'bg-[#111315] border-[#262B33] text-[#9CA3AF] hover:text-[#F3F4F6]'
                            : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#525866]'
                    )}
                  >
                    {isRu ? 'Текст' : 'Text'}
                  </button>
                  <button
                    onClick={() => setAiAnswerMode('console')}
                    className={clsx(
                      'px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer min-h-[38px]',
                      aiAnswerMode === 'console'
                        ? isFrutigerAero
                          ? 'bg-blue-500 text-white border-blue-600'
                          : 'bg-[#10B981] text-[#0A0C0E] border-[#10B981] font-semibold'
                        : isFrutigerAero
                          ? 'bg-white/50 border-white/40 text-blue-800'
                          : theme !== 'light'
                            ? 'bg-[#111315] border-[#262B33] text-[#9CA3AF] hover:text-[#F3F4F6]'
                            : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#525866]'
                    )}
                  >
                    {isRu ? 'Консоль' : 'Console'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className={clsx('text-sm font-semibold', headingCls)}>
                    {isRu ? 'Правки через ИИ' : 'AI Changes'}
                  </p>
                  <p className={clsx('text-xs mt-0.5', mutedCls)}>
                    {isRu
                      ? 'Разрешить ИИ изменять объекты и код приложения'
                      : 'Allow AI to modify app entities'}
                  </p>
                </div>
                <button
                  onClick={() => setAiChangesEnabled(!aiChangesEnabled)}
                  aria-label={isRu ? 'Переключить правки через ИИ' : 'Toggle AI Changes'}
                  className={clsx(
                    'w-11 h-6 rounded-full transition-colors relative cursor-pointer border shrink-0',
                    aiChangesEnabled
                      ? 'bg-[#10B981] border-[#10B981]'
                      : isFrutigerAero
                        ? 'bg-white/50 border-white/60'
                        : theme !== 'light'
                          ? 'bg-[#111315] border-[#262B33]'
                          : 'bg-[#E2E5EA] border-[#CBD5E1]'
                  )}
                >
                  <div
                    className={clsx(
                      'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all shadow-sm',
                      aiChangesEnabled ? 'left-6' : 'left-0.5'
                    )}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Account Section */}
          {user && (
            <section className={sectionCard}>
              <div className="flex items-center gap-3 mb-5">
                <div
                  className={clsx(
                    'p-2 rounded-lg border',
                    isFrutigerAero
                      ? 'bg-blue-500/20 border-blue-400/30 text-blue-600'
                      : 'bg-[#10B981]/10 border-[#10B981]/25 text-[#10B981]'
                  )}
                >
                  <User className="w-4 h-4" />
                </div>
                <h2 className={clsx('text-base font-bold', headingCls)}>
                  {isRu ? 'Настройки аккаунта' : 'Account Settings'}
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={clsx('block text-xs font-semibold uppercase tracking-wider mb-1.5', mutedCls)}>
                    {isRu ? 'Отображаемое имя' : 'Display Name'}
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={inputClass}
                    placeholder={isRu ? 'Введите ваше имя' : 'Enter your name'}
                  />
                </div>

                <div>
                  <label className={clsx('block text-xs font-semibold uppercase tracking-wider mb-1.5', mutedCls)}>
                    {isRu ? 'О себе (описание)' : 'Bio (Description)'}
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={500}
                    rows={3}
                    className={clsx(inputClass, 'resize-none')}
                    placeholder={isRu ? 'Расскажите о себе...' : 'Tell us about yourself...'}
                  />
                  <div className={clsx('text-[11px] font-mono-num text-right mt-1', mutedCls)}>
                    {bio.length}/500
                  </div>
                </div>

                <div>
                  <label className={clsx('block text-xs font-semibold uppercase tracking-wider mb-1.5', mutedCls)}>
                    {isRu ? 'Ссылка на аватар (или загрузите / выберите эмодзи)' : 'Avatar URL (Or upload / choose emoji)'}
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2 mb-3">
                    <input
                      type="text"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      className={clsx(inputClass, 'flex-1')}
                      placeholder={isRu ? 'Введите URL аватара' : 'Enter avatar URL'}
                    />
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={clsx(
                        'px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2 shrink-0 cursor-pointer min-h-[40px]',
                        isFrutigerAero
                          ? 'bg-white/60 border-white/40 text-blue-800 hover:bg-white/80'
                          : theme !== 'light'
                            ? 'bg-[#111315] border-[#262B33] text-[#F3F4F6] hover:bg-[#22262E]'
                            : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315] hover:bg-zinc-200'
                      )}
                    >
                      <Upload className="w-4 h-4" /> {isRu ? 'Загрузить' : 'Upload'}
                    </button>
                  </div>
                  <div className="mb-2">
                    <EmojiPicker
                      onEmojiClick={(emojiData) => setAvatarUrl(getEmojiAvatar(emojiData.emoji))}
                      theme={theme === 'light' ? Theme.LIGHT : Theme.DARK}
                      lazyLoadEmojis={true}
                      width="100%"
                      height={260}
                    />
                  </div>
                </div>

                <div>
                  <label className={clsx('block text-xs font-semibold uppercase tracking-wider mb-1.5', mutedCls)}>
                    {isRu ? 'Регион' : 'Region'}
                  </label>
                  <CustomSelect
                    value={region}
                    onChange={setRegion}
                    className="w-full"
                    options={[
                      { value: 'Global', label: isRu ? 'Весь мир' : 'Global' },
                      { value: 'North America', label: isRu ? 'Северная Америка' : 'North America' },
                      { value: 'Europe', label: isRu ? 'Европа' : 'Europe' },
                      { value: 'Asia', label: isRu ? 'Азия' : 'Asia' },
                      { value: 'South America', label: isRu ? 'Южная Америка' : 'South America' },
                      { value: 'Oceania', label: isRu ? 'Океания' : 'Oceania' },
                      { value: 'Africa', label: isRu ? 'Африка' : 'Africa' },
                    ]}
                  />
                </div>

                {status && (
                  <div
                    className={clsx(
                      'flex items-center gap-2 p-3 rounded-lg border text-sm',
                      status.type === 'success'
                        ? isFrutigerAero
                          ? 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30'
                          : 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
                        : isFrutigerAero
                          ? 'bg-red-500/20 text-red-700 border-red-500/30'
                          : 'bg-red-500/10 border-red-500/30 text-red-400'
                    )}
                  >
                    {status.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{status.message}</span>
                  </div>
                )}

                <button
                  onClick={handleUpdateProfile}
                  disabled={isUpdating || !isDirty}
                  className={clsx(
                    'w-full flex items-center justify-center gap-2 px-5 py-2.5 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors cursor-pointer min-h-[42px]',
                    isFrutigerAero
                      ? 'frutiger-aero-button'
                      : 'bg-[#10B981] hover:bg-[#059669] disabled:hover:bg-[#10B981] text-[#0A0C0E]'
                  )}
                >
                  <Save className="w-4 h-4" />
                  {isUpdating
                    ? isRu
                      ? 'Сохранение...'
                      : 'Updating...'
                    : isRu
                      ? 'Сохранить изменения'
                      : 'Save Changes'}
                </button>
              </div>
            </section>
          )}

          {!user && (
            <div className={clsx('text-center p-6 sm:p-8 text-sm', mutedCls)}>
              {isRu
                ? 'Войдите в аккаунт, чтобы открыть настройки профиля.'
                : 'Sign in to access account settings.'}
            </div>
          )}

          {/* Download Desktop App Section */}
          <section
            className={clsx(
              'p-4 sm:p-6 rounded-xl border relative overflow-hidden',
              isFrutigerAero
                ? 'bg-white/55 border-white/80 backdrop-blur-md shadow-sm'
                : theme !== 'light'
                  ? 'bg-gradient-to-br from-[#181B20] via-[#132420] to-[#111922] border-[#10B981]/35'
                  : 'bg-gradient-to-br from-emerald-50 via-teal-50/70 to-sky-50 border-emerald-200'
            )}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={clsx(
                    'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border',
                    isFrutigerAero
                      ? 'bg-blue-500/20 border-blue-400/30 text-blue-600'
                      : theme !== 'light'
                        ? 'bg-gradient-to-br from-[#10B981] to-[#06B6D4] text-[#09120E] border-transparent shadow-md shadow-emerald-500/20'
                        : 'bg-[#059669] text-white border-transparent shadow-sm'
                  )}
                >
                  <MonitorDown className="w-5 h-5" />
                </div>
                <div>
                  <h2 className={clsx('text-base font-bold flex items-center gap-1.5', headingCls)}>
                    <span>{isRu ? 'EPL Studio для ПК' : 'EPL Studio Desktop App'}</span>
                    <Sparkles className="w-4 h-4 text-[#10B981]" />
                  </h2>
                  <p className={clsx('text-xs mt-1 max-w-md', mutedCls)}>
                    {isRu
                      ? 'Скачайте десктопную версию EPL Studio для максимально быстрой работы IDE и 3D/2D рендера прямо на вашем компьютере.'
                      : 'Get the standalone desktop build of EPL Studio for fast local execution and full IDE performance.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDesktopDownloadOpen(true)}
                className={clsx(
                  'group inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 shadow-md hover:-translate-y-0.5 cursor-pointer min-h-[42px]',
                  isFrutigerAero
                    ? 'frutiger-aero-button'
                    : theme !== 'light'
                      ? 'bg-gradient-to-r from-[#10B981] to-[#06B6D4] hover:brightness-110 text-[#09120E] shadow-emerald-500/20'
                      : 'bg-gradient-to-r from-[#059669] to-[#0284C7] hover:brightness-110 text-white shadow-emerald-600/20'
                )}
              >
                <Download className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
                <span>{isRu ? 'Скачать приложение для ПК' : 'Download Desktop App'}</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
