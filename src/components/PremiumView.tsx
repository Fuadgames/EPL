import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import {
  Star, Lock, CheckCircle, Monitor, Crown, Sparkles, MessageSquare, Send, X, Zap, Check, Ban
} from 'lucide-react';
import { clsx } from 'clsx';
import { translations } from '../lib/translations';
import { db, auth } from '../firebase';
import { doc, updateDoc, setDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { notify } from '../store/useDialogStore';
import { PREMIUM_TIERS, resolveEffectiveTier } from '../lib/premiumTiers';
import { PremiumChatMessage, PremiumTier } from '../types';

export default function PremiumView() {
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const isPremium = useStore(state => state.isPremium);
  const setIsPremium = useStore(state => state.setIsPremium);
  const premiumTier = useStore(state => state.premiumTier);
  const setPremiumTier = useStore(state => state.setPremiumTier);
  const setTheme = useStore(state => state.setTheme);
  const setAiMode = useStore(state => state.setAiMode);
  const computerStyle = useStore(state => state.computerStyle);
  const setComputerStyle = useStore(state => state.setComputerStyle);
  const language = useStore(state => state.language);
  const premiumExpiry = useStore(state => state.premiumExpiry);
  const setPremiumExpiry = useStore(state => state.setPremiumExpiry);
  const setCurrentView = useStore(state => state.setCurrentView);
  const user = useStore(state => state.user);
  const userData = useStore(state => state.userData);
  const setIsAuthModalOpen = useStore(state => state.setIsAuthModalOpen);

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [isProcessingStripe, setIsProcessingStripe] = useState(false);

  // Message to Developer chat state
  const [isDevChatOpen, setIsDevChatOpen] = useState(false);
  const [devMessages, setDevMessages] = useState<PremiumChatMessage[]>([]);
  const [devChatInput, setDevChatInput] = useState('');
  const [sendingDevMsg, setSendingDevMsg] = useState(false);

  const t = translations[language].premiumFeatures;
  const isLight = theme === 'light' && !isFrutigerAero;
  const activeTier: PremiumTier = resolveEffectiveTier(isPremium || userData?.isPremium, userData?.premiumTier || premiumTier);
  const hasAnyPremium = activeTier !== 'none';

  // Subscribe to player's Message to Developer chat
  useEffect(() => {
    if (!auth.currentUser || !user?.uid || !isDevChatOpen) return;
    const q = query(collection(db, 'premiumChats', user.uid, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setDevMessages(snap.docs.map(d => ({ ...(d.data() as any), id: d.id } as PremiumChatMessage)));
      },
      (err) => {
        console.warn('Dev chat messages listener error:', err);
      }
    );
    updateDoc(doc(db, 'premiumChats', user.uid), { unreadForUser: false }).catch(() => {});
    return () => unsub();
  }, [user?.uid, isDevChatOpen]);

  const handleCheckout = async () => {
    try {
      setIsProcessingStripe(true);
      setError('');

      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.uid || 'guest' }),
      });

      if (!res.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error(err);
      const msg = language === 'ru' ? 'Ошибка оплаты' : 'Payment error';
      setError(msg);
      notify.error(msg);
      setIsProcessingStripe(false);
    }
  };

  const handleUnlock = async () => {
    if (hasAnyPremium) {
      const msg =
        language === 'ru'
          ? 'У вас уже активен премиум. Сначала отмените текущую подписку, чтобы ввести новый код.'
          : 'You already have an active Premium plan. Cancel your current subscription first to redeem a new code.';
      setError(msg);
      notify.error(msg);
      return;
    }

    if (!code.trim() || !user) {
      setError(language === 'ru' ? 'Войдите в аккаунт и введите код' : 'Please log in and enter a code');
      return;
    }

    setRedeeming(true);
    setError('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken().catch(() => '');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/premium/redeem', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code: code.trim(), userId: user.uid }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.invalidCode);
        return;
      }

      const activatedTier: PremiumTier =
        data.tier === 'plus' || data.tier === 'premium' || data.tier === 'ultra'
          ? data.tier
          : code.trim().toUpperCase().startsWith('PLUS-')
            ? 'plus'
            : code.trim().toUpperCase().startsWith('ULTR-')
              ? 'ultra'
              : 'premium';

      await setDoc(doc(db, 'users', user.uid), {
        isPremium: true,
        premiumTier: activatedTier,
        premiumExpiry: data.premiumExpiry || null,
      }, { merge: true }).catch(() => {});

      await setDoc(doc(db, 'users_public', user.uid), {
        premiumTier: activatedTier,
      }, { merge: true }).catch(() => {});

      setIsPremium(true);
      setPremiumTier(activatedTier);
      setPremiumExpiry(data.premiumExpiry || null);
      setCode('');
      setError('');
      notify.success(
        language === 'ru'
          ? `Уровень ${activatedTier.toUpperCase()} активирован! Доступен Extra Premium Access!`
          : `${activatedTier.toUpperCase()} Tier activated! Extra Premium Access unlocked!`
      );
    } catch (err: any) {
      console.error('Error unlocking premium', err);
      setError(language === 'ru' ? 'Ошибка при проверке кода' : 'Error checking code');
    } finally {
      setRedeeming(false);
    }
  };

  const handleCancelPremium = async () => {
    setIsPremium(false);
    setPremiumTier('none');
    setPremiumExpiry(null);
    if (theme === 'gradient') {
      setTheme('dark');
    }
    setAiMode('fast');
    setCode('');
    notify.info(language === 'ru' ? 'Подписка отключена' : 'Premium cancelled');

    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          isPremium: false,
          premiumTier: 'none',
          premiumExpiry: null,
        });
        await setDoc(doc(db, 'users_public', user.uid), {
          premiumTier: 'none',
        }, { merge: true }).catch(() => {});
      } catch (err) {
        console.error('Error cancelling premium', err);
      }
    }
  };

  const handleSendDevMessage = async () => {
    const text = devChatInput.trim();
    if (!text) return;
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    setSendingDevMsg(true);
    try {
      await setDoc(doc(db, 'premiumChats', user.uid, 'messages', msgId), {
        id: msgId,
        senderId: user.uid,
        senderName: userData?.name || user.displayName || 'Player',
        senderRole: 'user',
        text,
        createdAt: now,
      });

      await setDoc(doc(db, 'premiumChats', user.uid), {
        userId: user.uid,
        userName: userData?.name || user.displayName || 'Player',
        userAvatar: userData?.avatarUrl || user.photoURL || '',
        premiumTier: activeTier,
        lastMessage: text,
        lastSenderRole: 'user',
        lastMessageAt: now,
        unreadForDev: true,
        unreadForUser: false,
      }, { merge: true });

      setDevChatInput('');
      notify.success(language === 'ru' ? 'Сообщение отправлено разработчику!' : 'Message sent to developer!');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `premiumChats/${user.uid}/messages/${msgId}`);
    } finally {
      setSendingDevMsg(false);
    }
  };

  const cardSurface = isFrutigerAero
    ? 'bg-white/45 border-white/60 backdrop-blur-md shadow-sm'
    : isLight
      ? 'bg-white border-[#E2E5EA]'
      : 'bg-[#181B20] border-[#262B33]';

  return (
    <div className="h-full flex flex-col p-4 sm:p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-current/10">
          <div>
            <h1
              className={clsx(
                'text-2xl font-bold tracking-tight flex items-center gap-2.5',
                isFrutigerAero ? 'text-blue-900' : isLight ? 'text-[#111315]' : 'text-[#F3F4F6]'
              )}
            >
              <Crown className="w-6 h-6 text-amber-400" />
              {language === 'ru' ? 'Премиум-подписки EPL' : t.title}
            </h1>
            <p className={clsx('text-xs mt-1', isFrutigerAero ? 'text-blue-800/75' : 'text-[#9CA3AF]')}>
              {language === 'ru'
                ? '3 уровня доступа: Plus, Premium и Ultra • Extra Premium Access • Прямая связь с разработчиком'
                : '3 distinct tiers: Plus, Premium & Ultra • Extra Premium Access • Direct Developer Messaging'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {hasAnyPremium && (
              <button
                type="button"
                onClick={() => setCurrentView('extra-premium')}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-pink-500 to-cyan-500 text-white text-xs font-bold shadow-lg hover:scale-[1.02] transition-transform flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Zap className="w-4 h-4" />
                <span>Extra Premium Access</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (!user) {
                  setIsAuthModalOpen(true);
                  return;
                }
                setIsDevChatOpen(prev => !prev);
              }}
              className={clsx(
                'px-4 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap',
                isDevChatOpen
                  ? 'bg-[#10B981] border-[#10B981] text-[#0A0C0E]'
                  : isLight
                    ? 'bg-white border-[#E2E5EA] text-[#111315] hover:border-[#059669]'
                    : 'bg-[#181B20] border-[#262B33] text-[#F3F4F6] hover:border-[#10B981]'
              )}
            >
              <MessageSquare className="w-4 h-4 text-[#10B981]" />
              <span>{language === 'ru' ? 'Message to Developer' : 'Message to Developer'}</span>
            </button>
          </div>
        </div>

        {/* Message to Developer Drawer/Panel */}
        {isDevChatOpen && (
          <div className={clsx('rounded-2xl border p-5 space-y-4', cardSurface)}>
            <div className="flex items-center justify-between border-b border-current/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981]">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold">
                    {language === 'ru' ? 'Прямой чат с разработчиком (Message to Developer)' : 'Direct Message to Developer'}
                  </h2>
                  <p className="text-[11px] text-[#9CA3AF]">
                    {language === 'ru'
                      ? 'Ваш диалог попадает прямо во вкладку Premium Chat в панели разработчика.'
                      : 'Your messages go straight into the Developer’s Premium Chat tab.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDevChatOpen(false)}
                className="p-1.5 rounded-lg hover:bg-current/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={clsx('rounded-xl border p-3.5 h-60 overflow-y-auto space-y-2.5', isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]')}>
              {devMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-xs text-[#9CA3AF]">
                  <MessageSquare className="w-8 h-8 opacity-30 mb-2" />
                  <p>
                    {language === 'ru'
                      ? 'Напишите любое сообщение, идею или вопрос разработчику EPL Studio!'
                      : 'Send any feedback, question, or message directly to the EPL Studio Developer!'}
                  </p>
                </div>
              ) : (
                devMessages.map(m => {
                  const isMine = m.senderRole !== 'developer';
                  return (
                    <div key={m.id} className={clsx('flex flex-col max-w-[82%]', isMine ? 'ml-auto items-end' : 'mr-auto items-start')}>
                      <div
                        className={clsx(
                          'px-3.5 py-2 rounded-xl text-xs sm:text-sm border',
                          isMine
                            ? 'bg-[#10B981] text-[#0A0C0E] border-[#10B981] font-medium'
                            : 'bg-amber-500/15 text-amber-200 border-amber-500/35'
                        )}
                      >
                        {m.text}
                      </div>
                      <span className="text-[10px] text-[#9CA3AF] mt-0.5 px-1">
                        {m.senderRole === 'developer' ? 'Developer' : m.senderName} •{' '}
                        {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendDevMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={devChatInput}
                onChange={(e) => setDevChatInput(e.target.value)}
                placeholder={language === 'ru' ? 'Написать сообщение разработчику...' : 'Write a message to developer...'}
                className={clsx(
                  'flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none',
                  isLight ? 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315]' : 'bg-[#111315] border-[#262B33] text-[#F3F4F6] focus:border-[#10B981]'
                )}
              />
              <button
                type="submit"
                disabled={!devChatInput.trim() || sendingDevMsg}
                className="px-4 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E] text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{language === 'ru' ? 'Отправить' : 'Send'}</span>
              </button>
            </form>
          </div>
        )}

        {/* Active Subscription Banner */}
        {hasAnyPremium && (
          <div
            className={clsx(
              'p-6 rounded-2xl border space-y-5 relative overflow-hidden',
              activeTier === 'ultra'
                ? 'bg-gradient-to-br from-[#1A140A] via-[#1C1224] to-[#0B1E26] border-amber-400/60 text-white shadow-[0_0_35px_rgba(245,158,11,0.22)]'
                : activeTier === 'premium'
                  ? 'bg-gradient-to-br from-[#131828] via-[#18162B] to-[#0F221D] border-violet-400/50 text-white shadow-[0_0_25px_rgba(139,92,246,0.2)]'
                  : cardSurface
            )}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={clsx(
                    'p-3.5 rounded-xl border shrink-0',
                    activeTier === 'ultra'
                      ? 'bg-gradient-to-br from-amber-400 to-pink-500 text-black border-amber-300 shadow-lg'
                      : activeTier === 'premium'
                        ? 'bg-gradient-to-br from-violet-500 to-emerald-500 text-white border-violet-300'
                        : 'bg-slate-500/20 text-sky-400 border-slate-500/40'
                  )}
                >
                  {activeTier === 'ultra' ? (
                    <Crown className="w-7 h-7" />
                  ) : activeTier === 'premium' ? (
                    <Sparkles className="w-7 h-7" />
                  ) : (
                    <CheckCircle className="w-7 h-7" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-extrabold">
                      {language === 'ru'
                        ? `Активен уровень: ${PREMIUM_TIERS[activeTier].name}`
                        : `Active Tier: ${PREMIUM_TIERS[activeTier].name}`}
                    </h2>
                    <span
                      className={clsx(
                        'text-[10px] px-2.5 py-0.5 rounded-md font-black uppercase tracking-wider',
                        activeTier === 'ultra'
                          ? 'bg-gradient-to-r from-amber-400 via-pink-500 to-cyan-400 text-black'
                          : activeTier === 'premium'
                            ? 'bg-violet-500 text-white'
                            : 'bg-slate-600 text-white'
                      )}
                    >
                      {PREMIUM_TIERS[activeTier].badgeText}
                    </span>
                  </div>
                  <p className="text-xs opacity-80 mt-0.5">
                    {language === 'ru' ? PREMIUM_TIERS[activeTier].taglineRu : PREMIUM_TIERS[activeTier].taglineEn}
                  </p>
                  {premiumExpiry && (
                    <p className="text-xs font-mono-num text-[#10B981] mt-1 font-semibold">
                      {language === 'ru' ? `Действует до: ${new Date(premiumExpiry).toLocaleDateString()}` : `Expires: ${new Date(premiumExpiry).toLocaleDateString()}`}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setComputerStyle(!computerStyle)}
                  className={clsx(
                    'px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5',
                    computerStyle
                      ? 'bg-[#10B981] border-[#10B981] text-[#0A0C0E]'
                      : 'bg-black/25 border-white/15 hover:bg-black/40'
                  )}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>
                    {computerStyle
                      ? language === 'ru' ? 'Выкл. комп. стиль' : 'Disable Computer Style'
                      : language === 'ru' ? 'Компьютерный стиль' : 'Computer Style'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleCancelPremium}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
                >
                  {t.cancelPremium}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Code Redemption & Stripe Purchase Card */}
        <div className={clsx('p-6 rounded-2xl border', cardSurface)}>
          <div className="flex items-center gap-3 mb-3">
            <div className={clsx('p-2.5 rounded-xl border', isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]')}>
              <Lock className="w-5 h-5 text-[#10B981]" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {hasAnyPremium
                  ? language === 'ru'
                    ? 'Ввод кода заблокирован на время активного Премиума'
                    : 'Code Entry Locked While Premium Is Active'
                  : t.unlockPremium}
              </h2>
              <p className="text-xs text-[#9CA3AF]">
                {hasAnyPremium
                  ? language === 'ru'
                    ? 'У вас уже активна подписка (Plus, Premium или Ultra). Отмените текущую подписку выше, чтобы ввести другой ключ.'
                    : 'An active Plus, Premium, or Ultra plan is enabled. Cancel it above before redeeming another code.'
                  : language === 'ru'
                    ? 'Введите ключ вида PLUS-XXXX-XXXX, PREM-XXXX-XXXX или ULTR-XXXX-XXXX'
                    : 'Enter a tier key (PLUS-XXXX-XXXX, PREM-XXXX-XXXX, or ULTR-XXXX-XXXX)'}
              </p>
            </div>
          </div>

          {hasAnyPremium && (
            <div className="mb-3 px-3.5 py-2.5 rounded-xl border border-amber-500/35 bg-amber-500/10 text-amber-300 text-xs font-medium flex items-center justify-between gap-3">
              <span>
                {language === 'ru'
                  ? `Активен тариф: ${activeTier.toUpperCase()}. Поле ввода кода отключено до отмены подписки.`
                  : `Active plan: ${activeTier.toUpperCase()}. Code input is locked until you cancel.`}
              </span>
              <button
                type="button"
                onClick={handleCancelPremium}
                className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500 hover:text-white text-red-200 border border-red-500/40 font-semibold transition-colors cursor-pointer shrink-0"
              >
                {t.cancelPremium}
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={hasAnyPremium ? '' : code}
              disabled={hasAnyPremium}
              onChange={(e) => !hasAnyPremium && setCode(e.target.value)}
              placeholder={
                hasAnyPremium
                  ? language === 'ru'
                    ? 'Сначала отмените текущий Премиум...'
                    : 'Cancel current Premium to enter a code...'
                  : 'PLUS-XXXX-XXXX / PREM-XXXX-XXXX / ULTR-XXXX-XXXX'
              }
              className={clsx(
                'flex-1 px-4 py-2.5 rounded-xl border font-mono text-sm placeholder:text-[#6B7280] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
                isFrutigerAero
                  ? 'bg-white/60 border-white/40 text-blue-900'
                  : isLight
                    ? 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315] focus:border-[#059669]'
                    : 'bg-[#111315] border-[#262B33] text-[#F3F4F6] focus:border-[#10B981]'
              )}
            />
            <button
              type="button"
              disabled={redeeming || hasAnyPremium}
              onClick={handleUnlock}
              className={clsx(
                'py-2.5 px-6 rounded-xl text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
                isFrutigerAero ? 'frutiger-aero-button' : 'bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E]'
              )}
            >
              {redeeming ? (language === 'ru' ? 'Проверка...' : 'Checking...') : t.unlockButton}
            </button>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={isProcessingStripe || hasAnyPremium}
              className="py-2.5 px-5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap font-mono-num"
            >
              {isProcessingStripe
                ? language === 'ru' ? 'Загрузка...' : 'Loading...'
                : language === 'ru' ? 'Stripe ($5.99)' : 'Pay with Stripe ($5.99)'}
            </button>
          </div>
          {error && <p className="text-red-400 text-xs font-medium mt-2.5">{error}</p>}
        </div>

        {/* 3 Distinct Premium Tier Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 1. PLUS — Understated / non-unique */}
          {(() => {
            const meta = PREMIUM_TIERS.plus;
            const isCurrent = activeTier === 'plus';
            return (
              <div
                className={clsx(
                  'rounded-xl border p-5 flex flex-col justify-between transition-all',
                  isLight
                    ? 'bg-[#F8FAFC] border-slate-300 text-slate-800'
                    : 'bg-[#16191D] border-slate-700/70 text-slate-200',
                  isCurrent && 'ring-2 ring-slate-400'
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-0.5 rounded bg-slate-600/30 border border-slate-500/40 text-slate-300 text-[11px] font-bold uppercase">
                      {meta.badgeText}
                    </span>
                    <span className="text-xs font-mono-num opacity-70">{meta.priceLabel}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-1">{meta.name}</h3>
                  <p className="text-xs opacity-70 mb-4">
                    {language === 'ru' ? meta.taglineRu : meta.taglineEn}
                  </p>

                  <div className="text-[11px] font-bold uppercase tracking-wider opacity-60 mb-2">
                    {language === 'ru' ? 'Доступно:' : 'Included:'}
                  </div>
                  <ul className="space-y-2 text-xs mb-4">
                    {(language === 'ru' ? meta.allowedRu : meta.allowedEn).map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="text-[11px] font-bold uppercase tracking-wider text-red-400/80 mb-2">
                    {language === 'ru' ? 'Недоступно:' : 'Not included:'}
                  </div>
                  <ul className="space-y-1.5 text-xs opacity-70">
                    {(language === 'ru' ? meta.lockedRu : meta.lockedEn).map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Ban className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 pt-3 border-t border-current/10 text-[11px] font-mono opacity-65">
                  {language === 'ru' ? 'Формат ключа: PLUS-XXXX-XXXX' : 'Key format: PLUS-XXXX-XXXX'}
                </div>
              </div>
            );
          })()}

          {/* 2. PREMIUM — Distinct Crystalline Violet-Emerald */}
          {(() => {
            const meta = PREMIUM_TIERS.premium;
            const isCurrent = activeTier === 'premium';
            return (
              <div
                className={clsx(
                  'rounded-2xl border p-5 flex flex-col justify-between transition-all relative overflow-hidden',
                  isLight
                    ? 'bg-gradient-to-b from-violet-50 via-white to-emerald-50 border-violet-400 text-[#111315] shadow-md'
                    : 'bg-gradient-to-b from-[#1B1630] via-[#171A26] to-[#11221E] border-violet-500/60 text-[#F3F4F6] shadow-[0_0_28px_rgba(139,92,246,0.18)]',
                  isCurrent && 'ring-2 ring-emerald-400'
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-0.5 rounded-md bg-gradient-to-r from-violet-500 to-emerald-500 text-white text-[11px] font-bold uppercase flex items-center gap-1 shadow-sm">
                      <Sparkles className="w-3 h-3" />
                      {meta.badgeText}
                    </span>
                    <span className="text-xs font-mono-num text-emerald-400 font-bold">{meta.priceLabel}</span>
                  </div>
                  <h3 className="text-xl font-extrabold mb-1 bg-gradient-to-r from-violet-400 to-emerald-400 bg-clip-text text-transparent">
                    {meta.name}
                  </h3>
                  <p className="text-xs opacity-75 mb-4">
                    {language === 'ru' ? meta.taglineRu : meta.taglineEn}
                  </p>

                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2">
                    {language === 'ru' ? 'Доступно:' : 'Included:'}
                  </div>
                  <ul className="space-y-2 text-xs mb-4">
                    {(language === 'ru' ? meta.allowedRu : meta.allowedEn).map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400/80 mb-2">
                    {language === 'ru' ? 'Только в Ultra:' : 'Ultra Only:'}
                  </div>
                  <ul className="space-y-1.5 text-xs opacity-75">
                    {(language === 'ru' ? meta.lockedRu : meta.lockedEn).map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 pt-3 border-t border-current/10 text-[11px] font-mono text-violet-300">
                  {language === 'ru' ? 'Формат ключа: PREM-XXXX-XXXX' : 'Key format: PREM-XXXX-XXXX'}
                </div>
              </div>
            );
          })()}

          {/* 3. ULTRA — Most Epic & Unique Flagship */}
          {(() => {
            const meta = PREMIUM_TIERS.ultra;
            const isCurrent = activeTier === 'ultra';
            return (
              <div
                className={clsx(
                  'rounded-2xl border-2 p-5 flex flex-col justify-between transition-all relative overflow-hidden',
                  'bg-gradient-to-br from-[#1C1408] via-[#201228] to-[#081F26] border-amber-400 text-white shadow-[0_0_40px_rgba(245,158,11,0.28)]',
                  isCurrent && 'ring-2 ring-cyan-300'
                )}
              >
                <div className="pointer-events-none absolute -top-20 -right-20 w-44 h-44 rounded-full bg-amber-400/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-20 -left-20 w-44 h-44 rounded-full bg-pink-500/20 blur-3xl" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-3 py-1 rounded-lg bg-gradient-to-r from-amber-400 via-pink-500 to-cyan-400 text-black text-[11px] font-black uppercase flex items-center gap-1.5 shadow-md">
                      <Crown className="w-3.5 h-3.5" />
                      {meta.badgeText}
                    </span>
                    <span className="text-xs font-mono-num text-amber-300 font-bold">{meta.priceLabel}</span>
                  </div>
                  <h3 className="text-2xl font-black mb-1 bg-gradient-to-r from-amber-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">
                    {meta.name}
                  </h3>
                  <p className="text-xs text-amber-100/80 mb-4">
                    {language === 'ru' ? meta.taglineRu : meta.taglineEn}
                  </p>

                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300 mb-2">
                    {language === 'ru' ? 'Открыто абсолютно ВСЁ:' : 'Everything Unlocked:'}
                  </div>
                  <ul className="space-y-2.5 text-xs">
                    {(language === 'ru' ? meta.allowedRu : meta.allowedEn).map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0 mt-0.5" />
                        <span className="text-white/95">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="relative z-10 mt-5 pt-3 border-t border-amber-400/25 text-[11px] font-mono text-amber-300 font-semibold">
                  {language === 'ru' ? 'Формат ключа: ULTR-XXXX-XXXX' : 'Key format: ULTR-XXXX-XXXX'}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
