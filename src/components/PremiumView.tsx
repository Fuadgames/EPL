import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Star, Lock, CheckCircle, Monitor } from 'lucide-react';
import { clsx } from 'clsx';
import { translations } from '../lib/translations';
import { db, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { notify } from '../store/useDialogStore';

export default function PremiumView() {
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const isPremium = useStore(state => state.isPremium);
  const setIsPremium = useStore(state => state.setIsPremium);
  const setTheme = useStore(state => state.setTheme);
  const setAiMode = useStore(state => state.setAiMode);
  const computerStyle = useStore(state => state.computerStyle);
  const setComputerStyle = useStore(state => state.setComputerStyle);
  const language = useStore(state => state.language);
  const premiumExpiry = useStore(state => state.premiumExpiry);
  const setPremiumExpiry = useStore(state => state.setPremiumExpiry);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isProcessingStripe, setIsProcessingStripe] = useState(false);

  const user = useStore(state => state.user);
  const t = translations[language].premiumFeatures;

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
    if (!code.trim() || !user) {
      setError(language === 'ru' ? 'Войдите в аккаунт для активации' : 'Please log in to redeem');
      return;
    }

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

      await updateDoc(doc(db, 'users', user.uid), {
        isPremium: true,
        premiumExpiry: data.premiumExpiry || null,
      }).catch(() => {});

      setIsPremium(true);
      setPremiumExpiry(data.premiumExpiry || null);
      setError('');
      notify.success(language === 'ru' ? 'Premium активирован!' : 'Premium activated!');
    } catch (err: any) {
      console.error('Error unlocking premium', err);
      setError(language === 'ru' ? 'Ошибка при проверке кода' : 'Error checking code');
    }
  };

  const handleFreeTrial = async () => {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    const expiryStr = expiry.toISOString();
    setIsPremium(true);
    setPremiumExpiry(expiryStr);
    setError('');
    notify.success(language === 'ru' ? 'Пробный период на 7 дней активирован' : '7-day trial activated');

    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          isPremium: true,
          premiumExpiry: expiryStr,
        });
      } catch (err) {
        console.error('Error updating premium trial', err);
      }
    }
  };

  const handleCancelPremium = async () => {
    setIsPremium(false);
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
          premiumExpiry: null,
        });
      } catch (err) {
        console.error('Error cancelling premium', err);
      }
    }
  };

  return (
    <div className="h-full flex flex-col p-4 sm:p-8 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        <div className="mb-6 pb-4 border-b border-[#262B33]/60">
          <h1 className={clsx('text-2xl font-bold tracking-tight flex items-center gap-2.5', isFrutigerAero ? 'text-blue-900' : theme !== 'light' ? 'text-[#F3F4F6]' : 'text-[#111315]')}>
            <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
            {t.title}
          </h1>
          <p className={clsx('text-xs mt-0.5', isFrutigerAero ? 'text-blue-800/70' : theme !== 'light' ? 'text-[#9CA3AF]' : 'text-[#525866]')}>
            Extended AI capacity, IP protection, and workspace skins
          </p>
        </div>

        {isPremium ? (
          <div
            className={clsx(
              'p-6 sm:p-8 rounded-xl border text-left space-y-6',
              isFrutigerAero
                ? 'bg-white/40 border-white/50 backdrop-blur-md shadow-sm'
                : theme !== 'light'
                  ? 'bg-[#181B20] border-[#10B981]/40'
                  : 'bg-white border-[#059669]/40'
            )}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30">
                <CheckCircle className="w-8 h-8 text-[#10B981]" />
              </div>
              <div>
                <h2 className={clsx('text-xl font-bold', isFrutigerAero ? 'text-blue-900' : theme !== 'light' ? 'text-[#F3F4F6]' : 'text-[#111315]')}>
                  {t.active}
                </h2>
                <p className={clsx('text-sm', isFrutigerAero ? 'text-blue-800/70' : 'text-[#9CA3AF]')}>{t.thanks}</p>
                {premiumExpiry && (
                  <p className="text-xs font-mono-num text-[#10B981] mt-1 font-semibold">
                    {language === 'ru' ? `Истекает: ${new Date(premiumExpiry).toLocaleDateString()}` : `Expires: ${new Date(premiumExpiry).toLocaleDateString()}`}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className={clsx('font-bold text-xs uppercase tracking-wider', isFrutigerAero ? 'text-blue-900' : 'text-[#9CA3AF]')}>
                {t.yourFeatures}
              </h3>
              <ul className="grid grid-cols-1 gap-3 text-sm">
                <li className="flex items-start gap-2.5">
                  <Star className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
                  <span className="font-medium">{t.unlimitedAi}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Star className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
                  <span className="font-medium">{t.fasterAi}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Star className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
                  <span className="font-medium">{t.proAi}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Star className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium">{t.copyBlocking}</span>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">{t.copyBlockingDesc}</p>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <Monitor className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium">{language === 'ru' ? 'Компьютерный стиль' : 'Computer Style'}</span>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">
                      {language === 'ru' ? 'Включите компьютерный стиль для редактора' : 'Enable computer style for the editor'}
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            <div className={clsx('pt-5 border-t flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-end', theme !== 'light' ? 'border-[#262B33]' : 'border-[#E2E5EA]')}>
              <div>
                <h3 className={clsx('font-bold text-sm mb-2', isFrutigerAero ? 'text-blue-900' : theme !== 'light' ? 'text-[#F3F4F6]' : 'text-[#111315]')}>
                  {language === 'ru' ? 'Стиль редактора' : 'Editor Style'}
                </h3>
                <button
                  onClick={() => setComputerStyle(!computerStyle)}
                  className={clsx(
                    'px-4 py-2 rounded-lg text-sm font-semibold border transition-colors cursor-pointer',
                    computerStyle
                      ? theme !== 'light'
                        ? 'bg-[#111315] border-[#262B33] text-[#F3F4F6] hover:bg-[#22262E]'
                        : 'bg-[#111315] border-[#111315] text-white'
                      : 'bg-[#10B981] border-[#10B981] text-[#0A0C0E] hover:bg-[#059669]'
                  )}
                >
                  {computerStyle
                    ? language === 'ru' ? 'Выключить компьютерный стиль' : 'Disable Computer Style'
                    : language === 'ru' ? 'Включить компьютерный стиль' : 'Enable Computer Style'}
                </button>
              </div>

              <button
                onClick={handleCancelPremium}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
              >
                {t.cancelPremium}
              </button>
            </div>
          </div>
        ) : (
          <div
            className={clsx(
              'p-6 sm:p-8 rounded-xl border',
              isFrutigerAero
                ? 'bg-white/40 border-white/50 backdrop-blur-md shadow-sm'
                : theme !== 'light'
                  ? 'bg-[#181B20] border-[#262B33]'
                  : 'bg-white border-[#E2E5EA]'
            )}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={clsx('p-2.5 rounded-lg border', theme !== 'light' ? 'bg-[#111315] border-[#262B33]' : 'bg-[#F5F6F8] border-[#E2E5EA]')}>
                <Lock className="w-5 h-5 text-[#9CA3AF]" />
              </div>
              <h2 className={clsx('text-lg font-bold', isFrutigerAero ? 'text-blue-900' : theme !== 'light' ? 'text-[#F3F4F6]' : 'text-[#111315]')}>
                {t.unlockPremium}
              </h2>
            </div>

            <p className="text-sm text-[#9CA3AF] mb-4">{t.enterCode}</p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t.placeholder}
              className={clsx(
                'w-full px-4 py-3 rounded-lg border mb-4 font-mono text-sm placeholder:text-[#6B7280] focus:outline-none',
                isFrutigerAero
                  ? 'bg-white/60 border-white/40 text-blue-900'
                  : theme !== 'light'
                    ? 'bg-[#111315] border-[#262B33] text-[#F3F4F6] focus:border-[#10B981]'
                    : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315] focus:border-[#059669]'
              )}
            />
            {error && <p className="text-red-400 text-xs font-medium mb-4">{error}</p>}
            <button
              onClick={handleUnlock}
              className={clsx(
                'w-full py-2.5 px-5 rounded-lg text-sm font-semibold transition-colors mb-4 cursor-pointer',
                isFrutigerAero ? 'frutiger-aero-button' : 'bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E]'
              )}
            >
              {t.unlockButton}
            </button>

            <div className="relative flex items-center justify-center my-5">
              <div className={clsx('absolute inset-x-0 border-t', theme !== 'light' ? 'border-[#262B33]' : 'border-[#E2E5EA]')} />
              <span className={clsx('relative px-3 text-xs font-medium', theme !== 'light' ? 'bg-[#181B20] text-[#6B7280]' : 'bg-white text-[#6B7280]')}>
                {language === 'ru' ? 'или безопасно с картой' : 'or securely via card'}
              </span>
            </div>

            <button
              onClick={handleCheckout}
              disabled={isProcessingStripe}
              className="w-full py-2.5 px-5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center mb-3 disabled:opacity-50 cursor-pointer font-mono-num"
            >
              {isProcessingStripe
                ? language === 'ru' ? 'Загрузка...' : 'Loading...'
                : language === 'ru' ? 'Оплатить через Stripe ($5.99)' : 'Pay with Stripe ($5.99)'}
            </button>

            <button
              onClick={handleFreeTrial}
              className={clsx(
                'w-full py-2.5 px-5 rounded-lg border text-sm font-medium transition-colors cursor-pointer',
                theme !== 'light'
                  ? 'bg-[#111315] border-[#262B33] text-[#F3F4F6] hover:bg-[#22262E]'
                  : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315] hover:bg-zinc-200'
              )}
            >
              {language === 'ru' ? 'Включить бесплатную пробную версию на 1 неделю' : 'Enable free trial for 1 week'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
