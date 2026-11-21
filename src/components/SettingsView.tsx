import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { auth } from '../firebase';
import { updateProfile } from 'firebase/auth';
import { Sun, Moon, User, Save, CheckCircle2, AlertCircle, Bot, ShieldCheck, Upload, Code2, Eye, Layers } from 'lucide-react';
import { clsx } from 'clsx';
import { getEmojiAvatar } from '../lib/avatar';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { notify } from '../store/useDialogStore';
import CustomSelect from './CustomSelect';

export default function SettingsView() {
  const theme = useStore(state => state.theme);
  const setTheme = useStore(state => state.setTheme);
  const language = useStore(state => state.language);
  const livePreviewEnabled = useStore(state => state.livePreviewEnabled);
  const setLivePreviewEnabled = useStore(state => state.setLivePreviewEnabled);
  const user = useStore(state => state.user);
  const setUser = useStore(state => state.setUser);
  const aiAnswerMode = useStore(state => state.aiAnswerMode);
  const setAiAnswerMode = useStore(state => state.setAiAnswerMode);
  const aiChangesEnabled = useStore(state => state.aiChangesEnabled);
  const setAiChangesEnabled = useStore(state => state.setAiChangesEnabled);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const setIsFrutigerAero = useStore(state => state.setIsFrutigerAero);
  const userData = useStore(state => state.userData);
  const setUserData = useStore(state => state.setUserData);
  const simulatedRole = useStore(state => state.simulatedRole);
  const setSimulatedRole = useStore(state => state.setSimulatedRole);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState((userData as any)?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(userData?.avatarUrl || user?.photoURL || '');
  const [region, setRegion] = useState(userData?.region || 'Global');

  const [isUpdating, setIsUpdating] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayName(prev => (prev ? prev : userData?.name || user?.displayName || ''));
    setBio(prev => (prev ? prev : (userData as any)?.bio || ''));
    setAvatarUrl(prev => (prev ? prev : userData?.avatarUrl || user?.photoURL || ''));
    setRegion(prev => (prev && prev !== 'Global' ? prev : userData?.region || 'Global'));
  }, [user, userData]);

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
      const msg = 'Avatar uploaded! Click "Save Changes" to apply.';
      setStatus({ type: 'success', message: msg });
      notify.success(msg);
    } catch (error: any) {
      const msg = 'Upload failed: ' + error.message;
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
      if (!auth.currentUser) throw new Error('No authenticated user');
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

      setStatus({ type: 'success', message: 'Profile updated successfully!' });
      notify.success('Profile updated successfully!');
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
    'p-6 rounded-xl border',
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

  return (
    <div className="h-full flex flex-col p-4 sm:p-8 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        <div className="mb-6 pb-4 border-b border-[#262B33]/60">
          <h1 className={clsx('text-2xl font-bold tracking-tight', isFrutigerAero ? 'text-blue-900' : theme !== 'light' ? 'text-[#F3F4F6]' : 'text-[#111315]')}>
            Settings
          </h1>
          <p className={clsx('text-xs mt-0.5', isFrutigerAero ? 'text-blue-800/70' : theme !== 'light' ? 'text-[#9CA3AF]' : 'text-[#525866]')}>
            IDE theme preferences, live workspace options, and account configuration
          </p>
        </div>

        <div className="space-y-5">
          {/* Developer Simulation Section */}
          {userData?.role === 'developer' && simulatedRole && (
            <section className={clsx('p-6 rounded-xl border border-amber-500/40 bg-amber-500/10', isFrutigerAero ? 'backdrop-blur-md shadow-sm' : '')}>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h2 className={clsx('text-lg font-bold', isFrutigerAero ? 'text-blue-900' : theme !== 'light' ? 'text-[#F3F4F6]' : 'text-[#111315]')}>
                  Developer Simulation
                </h2>
              </div>
              <p className={clsx('text-sm mb-4', isFrutigerAero ? 'text-blue-800/80' : theme !== 'light' ? 'text-[#D1D5DB]' : 'text-[#374151]')}>
                You are currently simulating the <strong>{simulatedRole}</strong> role.
              </p>
              <button
                onClick={() => setSimulatedRole(null)}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-black transition-colors cursor-pointer"
              >
                Revert to Developer Mode
              </button>
            </section>
          )}

          {/* Appearance Section */}
          <section className={sectionCard}>
            <div className="flex items-center gap-3 mb-5">
              <div className={clsx('p-2 rounded-lg border', isFrutigerAero ? 'bg-blue-500/20 border-blue-400/30 text-blue-600' : 'bg-[#10B981]/10 border-[#10B981]/25 text-[#10B981]')}>
                <Sun className="w-4 h-4" />
              </div>
              <h2 className={clsx('text-base font-bold', isFrutigerAero ? 'text-blue-900' : theme !== 'light' ? 'text-[#F3F4F6]' : 'text-[#111315]')}>
                Appearance
              </h2>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className={clsx('text-sm font-semibold', isFrutigerAero ? 'text-blue-900' : theme !== 'light' ? 'text-[#F3F4F6]' : 'text-[#111315]')}>
                  Theme Mode
                </p>
                <p className={clsx('text-xs mt-0.5', isFrutigerAero ? 'text-blue-800/70' : 'text-[#9CA3AF]')}>
                  Switch between crisp light and dark graphite IDE themes
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setTheme('light')}
                  className={clsx(
                    'flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer whitespace-nowrap',
                    isFrutigerAero && theme === 'light'
                      ? 'bg-blue-500 text-white border-blue-600 shadow-sm'
                      : isFrutigerAero
                        ? 'bg-white/50 border-white/40 text-blue-800 hover:bg-white/70'
                        : theme === 'light'
                          ? 'bg-[#111315] border-[#111315] text-white'
                          : 'bg-[#111315] border-[#262B33] text-[#9CA3AF] hover:text-[#F3F4F6]'
                  )}
                >
                  <Sun className="w-4 h-4" /> Light
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={clsx(
                    'flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer whitespace-nowrap',
                    isFrutigerAero && theme === 'dark'
                      ? 'bg-blue-500 text-white border-blue-600 shadow-sm'
                      : isFrutigerAero
                        ? 'bg-white/50 border-white/40 text-blue-800 hover:bg-white/70'
                        : theme !== 'light'
                          ? 'bg-[#10B981] border-[#10B981] text-[#0A0C0E] font-semibold'
                          : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#525866] hover:text-[#111315]'
                  )}
                >
                  <Moon className="w-4 h-4" /> Dark
                </button>
              </div>
            </div>

            {/* Frutiger Aero Toggle (Preserved Purchasable Skin) */}
            {userData?.purchasedItems?.includes('frutiger-aero') && (
              <div className={clsx('flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-5 pt-5 border-t', isFrutigerAero ? 'border-white/30' : theme !== 'light' ? 'border-[#262B33]' : 'border-[#E2E5EA]')}>
                <div>
                  <p className={clsx('text-sm font-semibold flex items-center gap-2', isFrutigerAero ? 'text-blue-900' : theme !== 'light' ? 'text-[#F3F4F6]' : 'text-[#111315]')}>
                    <Layers className="w-4 h-4 text-blue-500" />
                    Frutiger Aero Style
                  </p>
                  <p className={clsx('text-xs mt-0.5', isFrutigerAero ? 'text-blue-800/70' : 'text-[#9CA3AF]')}>
                    Enable the classic glass and aqua aesthetic
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setIsFrutigerAero(true)}
                    className={clsx(
                      'px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer',
                      isFrutigerAero
                        ? 'bg-blue-500 text-white border-blue-600 shadow-sm'
                        : theme !== 'light'
                          ? 'bg-[#111315] border-[#262B33] text-[#9CA3AF] hover:text-[#F3F4F6]'
                          : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#525866]'
                    )}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setIsFrutigerAero(false)}
                    className={clsx(
                      'px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer',
                      !isFrutigerAero
                        ? theme !== 'light'
                          ? 'bg-[#262B33] border-[#374151] text-[#F3F4F6]'
                          : 'bg-[#111315] border-[#111315] text-white'
                        : 'bg-white/50 border-white/40 text-blue-800 hover:bg-white/70'
                    )}
                  >
                    No
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Editor Section */}
          <section className={sectionCard}>
            <div className="flex items-center gap-3 mb-5">
              <div className={clsx('p-2 rounded-lg border', isFrutigerAero ? 'bg-blue-500/20 border-blue-400/30 text-blue-600' : 'bg-[#10B981]/10 border-[#10B981]/25 text-[#10B981]')}>
                <Code2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className={clsx('text-base font-bold', isFrutigerAero ? 'text-blue-900' : theme !== 'light' ? 'text-[#F3F4F6]' : 'text-[#111315]')}>
                  {language === 'ru' ? 'Редактор' : 'Editor'}
                </h2>
                <p className={clsx('text-xs', isFrutigerAero ? 'text-blue-800/70' : 'text-[#9CA3AF]')}>
                  {language === 'ru' ? 'Параметры рабочей области и отображения кода' : 'Workspace and code preview settings'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="max-w-md">
                <p className={clsx('text-sm font-semibold flex items-center gap-2', isFrutigerAero ? 'text-blue-900' : theme !== 'light' ? 'text-[#F3F4F6]' : 'text-[#111315]')}>
                  <Eye className="w-4 h-4 text-[#10B981]" />
                  <span>{language === 'ru' ? 'Живой просмотр (Live Preview)' : 'Live Preview'}</span>
                </p>
                <p className={clsx('text-xs mt-1', isFrutigerAero ? 'text-blue-800/70' : 'text-[#9CA3AF]')}>
                  {language === 'ru'
                    ? 'Включает интерактивный показ проекта прямо в редакторе без нажатия на кнопку Run.'
                    : 'Shows interactive project preview directly in the editor without clicking Run.'}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setLivePreviewEnabled(true)}
                  className={clsx(
                    'px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer',
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
                  {language === 'ru' ? 'Вкл' : 'On'}
                </button>
                <button
                  onClick={() => setLivePreviewEnabled(false)}
                  className={clsx(
                    'px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer',
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
                  {language === 'ru' ? 'Выкл' : 'Off'}
                </button>
              </div>
            </div>
          </section>

          {/* AI Section */}
          <section className={sectionCard}>
            <div className="flex items-center gap-3 mb-5">
              <div className={clsx('p-2 rounded-lg border', isFrutigerAero ? 'bg-blue-500/20 border-blue-400/30 text-blue-600' : 'bg-[#10B981]/10 border-[#10B981]/25 text-[#10B981]')}>
                <Bot className="w-4 h-4" />
              </div>
              <h2 className={clsx('text-base font-bold', isFrutigerAero ? 'text-blue-900' : theme !== 'light' ? 'text-[#F3F4F6]' : 'text-[#111315]')}>
                AI Settings
              </h2>
            </div>

            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className={clsx('text-sm font-semibold', isFrutigerAero ? 'text-blue-900' : theme !== 'light' ? 'text-[#F3F4F6]' : 'text-[#111315]')}>
                    Answer Mode
                  </p>
                  <p className={clsx('text-xs mt-0.5', isFrutigerAero ? 'text-blue-800/70' : 'text-[#9CA3AF]')}>
                    How the AI should output answers
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setAiAnswerMode('text')}
                    className={clsx(
                      'px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer',
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
                    Text
                  </button>
                  <button
                    onClick={() => setAiAnswerMode('console')}
                    className={clsx(
                      'px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer',
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
                    Console
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className={clsx('text-sm font-semibold', isFrutigerAero ? 'text-blue-900' : theme !== 'light' ? 'text-[#F3F4F6]' : 'text-[#111315]')}>
                    AI Changes
                  </p>
                  <p className={clsx('text-xs mt-0.5', isFrutigerAero ? 'text-blue-800/70' : 'text-[#9CA3AF]')}>
                    Allow AI to modify app entities
                  </p>
                </div>
                <button
                  onClick={() => setAiChangesEnabled(!aiChangesEnabled)}
                  className={clsx(
                    'w-11 h-6 rounded-full transition-colors relative cursor-pointer border',
                    aiChangesEnabled
                      ? 'bg-[#10B981] border-[#10B981]'
                      : isFrutigerAero
                        ? 'bg-white/50 border-white/60'
                        : theme !== 'light'
                          ? 'bg-[#111315] border-[#262B33]'
                          : 'bg-[#E2E5EA] border-[#CBD5E1]'
                  )}
                >
                  <div className={clsx('w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all shadow-sm', aiChangesEnabled ? 'left-6' : 'left-0.5')} />
                </button>
              </div>
            </div>
          </section>

          {/* Account Section */}
          {user && (
            <section className={sectionCard}>
              <div className="flex items-center gap-3 mb-5">
                <div className={clsx('p-2 rounded-lg border', isFrutigerAero ? 'bg-blue-500/20 border-blue-400/30 text-blue-600' : 'bg-[#10B981]/10 border-[#10B981]/25 text-[#10B981]')}>
                  <User className="w-4 h-4" />
                </div>
                <h2 className={clsx('text-base font-bold', isFrutigerAero ? 'text-blue-900' : theme !== 'light' ? 'text-[#F3F4F6]' : 'text-[#111315]')}>
                  Account Settings
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={clsx('block text-xs font-semibold uppercase tracking-wider mb-1.5', isFrutigerAero ? 'text-blue-800/80' : 'text-[#9CA3AF]')}>
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={inputClass}
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <label className={clsx('block text-xs font-semibold uppercase tracking-wider mb-1.5', isFrutigerAero ? 'text-blue-800/80' : 'text-[#9CA3AF]')}>
                    Bio (Description)
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={500}
                    rows={3}
                    className={clsx(inputClass, 'resize-none')}
                    placeholder="Tell us about yourself..."
                  />
                  <div className={clsx('text-[11px] font-mono-num text-right mt-1', isFrutigerAero ? 'text-blue-800/60' : 'text-[#6B7280]')}>
                    {bio.length}/500
                  </div>
                </div>

                <div>
                  <label className={clsx('block text-xs font-semibold uppercase tracking-wider mb-1.5', isFrutigerAero ? 'text-blue-800/80' : 'text-[#9CA3AF]')}>
                    Avatar URL (Or upload / choose emoji)
                  </label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      className={clsx(inputClass, 'flex-1')}
                      placeholder="Enter avatar URL"
                    />
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={clsx(
                        'px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2 shrink-0 cursor-pointer',
                        isFrutigerAero
                          ? 'bg-white/60 border-white/40 text-blue-800 hover:bg-white/80'
                          : theme !== 'light'
                            ? 'bg-[#111315] border-[#262B33] text-[#F3F4F6] hover:bg-[#22262E]'
                            : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315] hover:bg-zinc-200'
                      )}
                    >
                      <Upload className="w-4 h-4" /> Upload
                    </button>
                  </div>
                  <div className="mb-2">
                    <EmojiPicker
                      onEmojiClick={(emojiData) => setAvatarUrl(getEmojiAvatar(emojiData.emoji))}
                      theme={theme === 'light' ? Theme.LIGHT : Theme.DARK}
                      lazyLoadEmojis={true}
                      width="100%"
                      height={320}
                    />
                  </div>
                </div>

                <div>
                  <label className={clsx('block text-xs font-semibold uppercase tracking-wider mb-1.5', isFrutigerAero ? 'text-blue-800/80' : 'text-[#9CA3AF]')}>
                    Region
                  </label>
                  <CustomSelect
                    value={region}
                    onChange={setRegion}
                    className="w-full"
                    options={[
                      { value: 'Global', label: 'Global' },
                      { value: 'North America', label: 'North America' },
                      { value: 'Europe', label: 'Europe' },
                      { value: 'Asia', label: 'Asia' },
                      { value: 'South America', label: 'South America' },
                      { value: 'Oceania', label: 'Oceania' },
                      { value: 'Africa', label: 'Africa' },
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
                    {status.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{status.message}</span>
                  </div>
                )}

                <button
                  onClick={handleUpdateProfile}
                  disabled={isUpdating || !isDirty}
                  className={clsx(
                    'w-full flex items-center justify-center gap-2 px-5 py-2.5 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors cursor-pointer',
                    isFrutigerAero ? 'frutiger-aero-button' : 'bg-[#10B981] hover:bg-[#059669] disabled:hover:bg-[#10B981] text-[#0A0C0E]'
                  )}
                >
                  <Save className="w-4 h-4" />
                  {isUpdating ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </section>
          )}

          {!user && (
            <div className={clsx('text-center p-8 text-sm', isFrutigerAero ? 'text-blue-800/60' : 'text-[#9CA3AF]')}>
              Sign in to access account settings.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
