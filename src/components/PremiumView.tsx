import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Star, Lock, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { translations } from '../lib/translations';
import { db } from '../firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

export default function PremiumView() {
  const theme = useStore(state => state.theme);
  const isPremium = useStore(state => state.isPremium);
  const setIsPremium = useStore(state => state.setIsPremium);
  const setTheme = useStore(state => state.setTheme);
  const setAiMode = useStore(state => state.setAiMode);
  const computerStyle = useStore(state => state.computerStyle);
  const setComputerStyle = useStore(state => state.setComputerStyle);
  const language = useStore(state => state.language);
  const premiumCode = useStore(state => state.premiumCode);
  const premiumExpiry = useStore(state => state.premiumExpiry);
  const setPremiumExpiry = useStore(state => state.setPremiumExpiry);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);

  const user = useStore(state => state.user);
  const t = translations[language].premiumFeatures;

  const handleUnlock = async () => {
    if (!code.trim()) return;

    if (code === 'System.Unlock.Premium: Code XXXX-XXXX-XXXX') {
      setIsPremium(true);
      setPremiumExpiry(null);
      setSuccess(true);
      setError('');
      if (user) {
        try {
          await updateDoc(doc(db, 'users', user.uid), { isPremium: true, premiumExpiry: null });
        } catch (err) { console.error(err); }
      }
      return;
    }

    try {
      const codeDoc = await getDoc(doc(db, 'premium_codes', code));
      if (codeDoc.exists()) {
        const data = codeDoc.data();
        if (data.used) {
          setError(language === 'ru' ? 'Этот код уже был использован' : 'This code has already been used');
          return;
        }

        // Mark code as used
        await updateDoc(doc(db, 'premium_codes', code), {
          used: true,
          usedBy: user?.uid || 'unknown',
          usedAt: new Date().toISOString()
        });

        setIsPremium(true);
        setPremiumExpiry(null);
        setSuccess(true);
        setError('');

        if (user) {
          await updateDoc(doc(db, 'users', user.uid), {
            isPremium: true,
            premiumExpiry: null
          });
        }
      } else {
        setError(t.invalidCode);
        setSuccess(false);
      }
    } catch (err) {
      console.error("Error unlocking premium", err);
      setError(language === 'ru' ? 'Ошибка при проверке кода' : 'Error checking code');
    }
  };

  const handleFreeTrial = async () => {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    const expiryStr = expiry.toISOString();
    setIsPremium(true);
    setPremiumExpiry(expiryStr);
    setSuccess(true);
    setError('');

    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          isPremium: true,
          premiumExpiry: expiryStr
        });
      } catch (err) {
        console.error("Error updating premium trial", err);
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
    setSuccess(false);

    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          isPremium: false,
          premiumExpiry: null
        });
      } catch (err) {
        console.error("Error cancelling premium", err);
      }
    }
  };

  return (
    <div className="h-full flex flex-col p-4 sm:p-8 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        <h1 className="text-3xl font-bold tracking-tight mb-8 flex items-center gap-3">
          <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
          {t.title}
        </h1>

        {isPremium ? (
          <div className={clsx(
            "p-8 rounded-3xl border text-left space-y-6",
            theme === 'dark' ? 'bg-zinc-900/50 border-emerald-500/50' : 
            theme === 'gradient' ? 'bg-emerald-900/20 border-emerald-500/50' :
            'bg-white border-emerald-500/50'
          )}>
            <div className="flex items-center gap-4 mb-6">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
              <div>
                <h2 className="text-2xl font-bold">{t.active}</h2>
                <p className="text-zinc-500">{t.thanks}</p>
                {premiumExpiry && (
                  <p className="text-sm text-emerald-500 mt-1">
                    {language === 'ru' ? `Истекает: ${new Date(premiumExpiry).toLocaleDateString()}` : `Expires: ${new Date(premiumExpiry).toLocaleDateString()}`}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-lg">{t.yourFeatures}</h3>
              <ul className="grid grid-cols-1 gap-4">
                <li className="flex items-start gap-3">
                  <Star className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                  <div>
                    <span className="font-medium">{t.unlimitedAi}</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Star className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                  <div>
                    <span className="font-medium">{t.fasterAi}</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Star className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                  <div>
                    <span className="font-medium">{t.proAi}</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Star className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                  <div>
                    <span className="font-medium">{t.gradientTheme}</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Star className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                  <div>
                    <span className="font-medium">{t.copyBlocking}</span>
                    <p className="text-sm text-zinc-500 mt-1">{t.copyBlockingDesc}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Star className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                  <div>
                    <span className="font-medium">{language === 'ru' ? 'Компьютерный стиль' : 'Computer Style'}</span>
                    <p className="text-sm text-zinc-500 mt-1">{language === 'ru' ? 'Включите компьютерный стиль для редактора' : 'Enable computer style for the editor'}</p>
                  </div>
                </li>
              </ul>
            </div>
            
            <div className="pt-6 border-t border-emerald-500/20 flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-end">
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="font-bold mb-4">{t.themeSettings}</h3>
                  <button
                    onClick={() => setTheme(theme === 'gradient' ? 'dark' : 'gradient')}
                    className={clsx(
                      "px-4 py-2 rounded-xl font-medium transition-colors",
                      theme === 'gradient' 
                        ? "bg-zinc-800 text-white hover:bg-zinc-700" 
                        : "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:opacity-90"
                    )}
                  >
                    {theme === 'gradient' ? t.disableGradient : t.enableGradient}
                  </button>
                </div>
                <div>
                  <h3 className="font-bold mb-4">{language === 'ru' ? 'Стиль редактора' : 'Editor Style'}</h3>
                  <button
                    onClick={() => setComputerStyle(!computerStyle)}
                    className={clsx(
                      "px-4 py-2 rounded-xl font-medium transition-colors",
                      computerStyle 
                        ? "bg-zinc-800 text-white hover:bg-zinc-700" 
                        : "bg-emerald-500 text-white hover:bg-emerald-600"
                    )}
                  >
                    {computerStyle ? (language === 'ru' ? 'Выключить компьютерный стиль' : 'Disable Computer Style') : (language === 'ru' ? 'Включить компьютерный стиль' : 'Enable Computer Style')}
                  </button>
                </div>
              </div>
              
              <div>
                <button
                  onClick={handleCancelPremium}
                  className="px-4 py-2 rounded-xl font-medium transition-colors bg-red-500/10 text-red-500 hover:bg-red-500/20"
                >
                  {t.cancelPremium}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className={clsx(
            "p-8 rounded-3xl border",
            theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
          )}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Lock className="w-8 h-8 text-zinc-500" />
                <h2 className="text-xl font-bold">{t.unlockPremium}</h2>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-emerald-500">$5.99</span>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{language === 'ru' ? 'Единоразово' : 'One-time payment'}</p>
              </div>
            </div>
            <p className="text-zinc-500 mb-6">{t.enterCode}</p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t.placeholder}
              className={clsx(
                "w-full p-4 rounded-xl border mb-4 font-mono placeholder:text-zinc-500",
                theme !== 'light' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
              )}
            />
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button
              onClick={handleUnlock}
              className="w-full py-3 px-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors mb-4"
            >
              {t.unlockButton}
            </button>

            <button
              onClick={handleFreeTrial}
              className="w-full py-3 px-6 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors mb-4"
            >
              {language === 'ru' ? 'Включить бесплатную пробную версию на 1 неделю' : 'Enable free trial for 1 week'}
            </button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-500/20"></div>
              </div>
              <div className="relative flex justify-center">
                <span className={clsx("px-2 text-sm", theme !== 'light' ? "bg-zinc-900 text-zinc-500" : "bg-white text-zinc-500")}>
                  {language === 'ru' ? 'ИЛИ' : 'OR'}
                </span>
              </div>
            </div>

            {!showPaymentOptions ? (
              <button
                onClick={() => setShowPaymentOptions(true)}
                className="w-full py-3 px-6 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors flex items-center justify-between"
              >
                <span>{language === 'ru' ? 'Купить товар' : 'Buy Product'}</span>
                <span className="text-emerald-500 font-bold">$5.99</span>
              </button>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <p className="text-center text-sm font-medium">
                  {language === 'ru' ? 'Выберите способ оплаты:' : 'Select payment method:'}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => alert(language === 'ru' ? 'Скоро выйдет!' : 'Coming soon!')}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-zinc-800 hover:bg-zinc-800 transition-colors"
                  >
                    <span className="font-bold text-emerald-500">WhatsApp</span>
                    <span className="text-[10px] opacity-50">{language === 'ru' ? 'Скоро' : 'Soon'}</span>
                  </button>
                  <button
                    onClick={() => alert(language === 'ru' ? 'Скоро выйдет!' : 'Coming soon!')}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-zinc-800 hover:bg-zinc-800 transition-colors"
                  >
                    <span className="font-bold text-blue-500">{language === 'ru' ? 'Карта' : 'Card'}</span>
                    <span className="text-[10px] opacity-50">{language === 'ru' ? 'Скоро' : 'Soon'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
