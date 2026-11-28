import React from 'react';
import { Star, Coins } from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from '../store/useStore';
import { notify } from '../store/useDialogStore';

export default function DonatePage() {
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const language = useStore(state => state.language);

  const packs = [
    { coins: 10, price: 1.99 },
    { coins: 50, price: 3.99 },
    { coins: 100, price: 5.99 },
    { coins: 150, price: 7.99 },
    { coins: 1500, price: 9.99 },
  ];

  const handleSelectPack = (coins: number, price: number) => {
    notify.info(
      language === 'ru'
        ? `Пакет ${coins} EPLCoins ($${price.toFixed(2)}) — пополнение скоро будет доступно в Stripe.`
        : `${coins} EPLCoins ($${price.toFixed(2)}) checkout will open via Stripe soon.`
    );
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 pb-4 border-b border-[#262B33]/60">
          <h1 className={clsx('text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2.5', isFrutigerAero ? 'text-blue-900' : theme !== 'light' ? 'text-[#F3F4F6]' : 'text-[#111315]')}>
            <Star className="w-6 h-6 text-amber-400 fill-amber-400 shrink-0" />
            {language === 'ru' ? 'Пополнение EPLCoins' : 'Donate EPLCoins'}
          </h1>
          <p className={clsx('text-xs mt-1', isFrutigerAero ? 'text-blue-800/70' : theme !== 'light' ? 'text-[#9CA3AF]' : 'text-[#525866]')}>
            {language === 'ru'
              ? 'Поддержите EPL Studio и пополните баланс EPLCoins.'
              : 'Support EPL Studio and boost your balance with EPLCoins.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {packs.map((pack) => (
            <button
              key={pack.coins}
              onClick={() => handleSelectPack(pack.coins, pack.price)}
              className={clsx(
                'p-6 rounded-xl border transition-colors flex flex-col items-center gap-2 cursor-pointer',
                isFrutigerAero
                  ? 'bg-white/40 border-white/50 hover:bg-white/60 backdrop-blur-md shadow-sm'
                  : theme !== 'light'
                    ? 'bg-[#181B20] border-[#262B33] hover:border-[#10B981]/60 hover:bg-[#1E2229]'
                    : 'bg-white border-[#E2E5EA] hover:border-[#059669]/60 hover:bg-[#F5F6F8]'
              )}
            >
              <Coins className={clsx('w-6 h-6 mb-1', isFrutigerAero ? 'text-blue-600' : 'text-[#10B981]')} />
              <span className={clsx('text-xl font-bold font-mono-num', isFrutigerAero ? 'text-blue-900' : 'text-[#10B981]')}>
                {pack.coins} EPLCoins
              </span>
              <span className={clsx('text-base font-mono-num font-semibold', isFrutigerAero ? 'text-blue-800/80' : theme !== 'light' ? 'text-[#D1D5DB]' : 'text-[#525866]')}>
                ${pack.price.toFixed(2)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
