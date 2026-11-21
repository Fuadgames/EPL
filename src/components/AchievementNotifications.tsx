import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import clsx from 'clsx';
import { Trophy } from 'lucide-react';

export const AchievementNotifications: React.FC = () => {
  const achievementQueue = useStore(state => state.achievementQueue);
  const popAchievement = useStore(state => state.popAchievement);
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);

  const [current, setCurrent] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!current && achievementQueue.length > 0) {
      setCurrent(achievementQueue[0]);
    }
  }, [achievementQueue, current]);

  useEffect(() => {
    if (current) {
      const inTimer = setTimeout(() => {
        setVisible(true);
      }, 50);

      const hideTimer = setTimeout(() => {
        setVisible(false);
      }, 4000);

      const popTimer = setTimeout(() => {
        setCurrent(null);
        popAchievement();
      }, 4600);

      return () => {
        clearTimeout(inTimer);
        clearTimeout(hideTimer);
        clearTimeout(popTimer);
      };
    }
  }, [current]);

  if (!current) return null;

  const isDark = theme !== 'light' && !isFrutigerAero;

  return (
    <div
      className={clsx(
        'fixed bottom-6 right-6 z-50 transition-all duration-300 transform shadow-2xl flex flex-col overflow-hidden min-w-[300px]',
        visible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-6 opacity-0 scale-95',
        isFrutigerAero
          ? 'bg-gradient-to-br from-blue-300 via-white to-blue-200 border-2 border-white rounded-[20px] shadow-[inset_0_2px_12px_rgba(255,255,255,0.8),0_8px_32px_rgba(0,0,0,0.15)]'
          : isDark
          ? 'bg-[#181B20] border border-[#262B33] rounded-xl text-[#F1F3F5]'
          : 'bg-white border border-[#E2E5EA] rounded-xl text-[#111315]'
      )}
    >
      <div
        className={clsx(
          'px-4 pt-2.5 pb-2 flex items-center gap-2 border-b',
          isFrutigerAero
            ? 'bg-white/40 border-white/40'
            : isDark
            ? 'bg-[#14171B] border-[#262B33]'
            : 'bg-[#F5F6F8] border-[#E2E5EA]'
        )}
      >
        <Trophy className={clsx('w-3.5 h-3.5', isFrutigerAero ? 'text-blue-600' : 'text-[#10B981]')} />
        <span
          className={clsx(
            'text-[10px] font-bold uppercase tracking-widest',
            isFrutigerAero ? 'text-blue-900' : 'text-[#9BA1A6]'
          )}
        >
          Achievement Unlocked
        </span>
      </div>

      <div className="p-4 flex items-center gap-3.5">
        <div
          className={clsx(
            'w-11 h-11 rounded-lg flex items-center justify-center text-xl border',
            isFrutigerAero
              ? 'bg-gradient-to-tr from-white to-blue-100 border-white'
              : isDark
              ? 'bg-[#111315] border-[#262B33]'
              : 'bg-[#F5F6F8] border-[#E2E5EA]'
          )}
        >
          {current.icon}
        </div>
        <div>
          <div
            className={clsx(
              'font-bold text-sm leading-tight',
              isFrutigerAero ? 'text-blue-950' : isDark ? 'text-[#F1F3F5]' : 'text-[#111315]'
            )}
          >
            {current.title}
          </div>
          <div
            className={clsx(
              'font-medium text-xs mt-0.5',
              isFrutigerAero ? 'text-blue-700' : 'text-[#9BA1A6]'
            )}
          >
            {current.description}
          </div>
        </div>
      </div>
    </div>
  );
};
