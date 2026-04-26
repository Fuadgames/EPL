import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import clsx from 'clsx';
import { Trophy } from 'lucide-react';

export const AchievementNotifications: React.FC = () => {
  const achievementQueue = useStore(state => state.achievementQueue);
  const popAchievement = useStore(state => state.popAchievement);
  const theme = useStore((state) => state.theme);
  const isFrutigerAero = useStore((state) => state.isFrutigerAero);
  
  const [current, setCurrent] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!current && achievementQueue.length > 0) {
      setCurrent(achievementQueue[0]);
    }
  }, [achievementQueue, current]);

  useEffect(() => {
    if (current) {
      // Small delay before animating in
      const inTimer = setTimeout(() => {
        setVisible(true);
      }, 50);
      
      const hideTimer = setTimeout(() => {
        setVisible(false);
      }, 4000);

      const popTimer = setTimeout(() => {
        setCurrent(null);
        popAchievement();
      }, 4600); // Give enough time for the 500ms exit transition

      return () => {
        clearTimeout(inTimer);
        clearTimeout(hideTimer);
        clearTimeout(popTimer);
      };
    }
  }, [current]); // Only depend on current

  if (!current) return null;

  return (
    <div
      className={clsx(
        "fixed bottom-6 right-6 z-50 transition-all duration-500 transform shadow-2xl",
        visible ? "translate-y-0 opacity-100 scale-100" : "translate-y-8 opacity-0 scale-95",
        "flex flex-col overflow-hidden min-w-[300px]",
        isFrutigerAero 
          ? "bg-gradient-to-br from-blue-300 via-white to-blue-200 border-2 border-white rounded-[24px] shadow-[inset_0_2px_12px_rgba(255,255,255,0.8),0_8px_32px_rgba(0,0,0,0.15)]" 
          : theme !== 'light' 
          ? 'bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl shadow-black/50' 
          : 'bg-white border border-zinc-200 rounded-2xl shadow-xl'
      )}
    >
      {/* Top Header */}
      <div className={clsx(
        "px-4 pt-3 pb-2 flex items-center gap-2",
        isFrutigerAero ? "bg-white/40" : theme !== 'light' ? "bg-zinc-800/50" : "bg-zinc-50"
      )}>
        <Trophy className={clsx("w-4 h-4", isFrutigerAero ? "text-blue-600" : "text-emerald-500")} />
        <span className={clsx(
          "text-[10px] font-bold uppercase tracking-widest",
          isFrutigerAero ? "text-blue-900" : theme !== 'light' ? "text-zinc-400" : "text-zinc-500"
        )}>
          Achievement Unlocked
        </span>
      </div>

      {/* Content */}
      <div className="p-4 flex items-center gap-4">
        <div className={clsx(
          "w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-inner",
          isFrutigerAero ? "bg-gradient-to-tr from-white to-blue-100 border border-white" : theme !== 'light' ? "bg-zinc-800 border border-zinc-700" : "bg-zinc-100 border border-zinc-200"
        )}>
          {current.icon}
        </div>
        <div>
          <div className={clsx(
            "font-bold text-base leading-tight",
            isFrutigerAero ? "text-blue-900 drop-shadow-sm" : theme !== 'light' ? "text-zinc-100" : "text-zinc-900"
          )}>
            {current.title}
          </div>
          <div className={clsx(
            "font-medium tracking-tight text-[11px] mt-0.5",
            isFrutigerAero ? "text-blue-700" : theme !== 'light' ? "text-zinc-400" : "text-zinc-500"
          )}>
            {current.description}
          </div>
        </div>
      </div>
    </div>
  );
};
