import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Star, Lock, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';

export default function PremiumView() {
  const { theme, isPremium, setIsPremium, setTheme, setAiMode } = useStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleUnlock = () => {
    if (code === 'System.Unlock.Premium: Code XXXX-XXXX-XXXX') {
      setIsPremium(true);
      setSuccess(true);
      setError('');
    } else {
      setError('Invalid unlock code.');
      setSuccess(false);
    }
  };

  const handleCancelPremium = () => {
    setIsPremium(false);
    if (theme === 'gradient') {
      setTheme('dark');
    }
    setAiMode('fast');
    setCode('');
    setSuccess(false);
  };

  return (
    <div className="h-full flex flex-col p-4 sm:p-8 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        <h1 className="text-3xl font-bold tracking-tight mb-8 flex items-center gap-3">
          <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
          Premium Features
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
                <h2 className="text-2xl font-bold">Premium Active</h2>
                <p className="text-zinc-500">Thank you for supporting EPL Studio!</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-lg">Your Premium Features:</h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <Star className="w-5 h-5 text-emerald-500" />
                  <span>Unlimited AI requests</span>
                </li>
                <li className="flex items-center gap-3">
                  <Star className="w-5 h-5 text-emerald-500" />
                  <span>Faster AI response times</span>
                </li>
                <li className="flex items-center gap-3">
                  <Star className="w-5 h-5 text-emerald-500" />
                  <span>Pro & Thinking AI modes unlocked</span>
                </li>
                <li className="flex items-center gap-3">
                  <Star className="w-5 h-5 text-emerald-500" />
                  <span>Exclusive Gradient Theme</span>
                </li>
              </ul>
            </div>
            
            <div className="pt-6 border-t border-emerald-500/20 flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-end">
              <div>
                <h3 className="font-bold mb-4">Theme Settings</h3>
                <button
                  onClick={() => setTheme(theme === 'gradient' ? 'dark' : 'gradient')}
                  className={clsx(
                    "px-4 py-2 rounded-xl font-medium transition-colors",
                    theme === 'gradient' 
                      ? "bg-zinc-800 text-white hover:bg-zinc-700" 
                      : "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:opacity-90"
                  )}
                >
                  {theme === 'gradient' ? 'Disable Gradient Theme' : 'Enable Gradient Theme'}
                </button>
              </div>
              
              <div>
                <button
                  onClick={handleCancelPremium}
                  className="px-4 py-2 rounded-xl font-medium transition-colors bg-red-500/10 text-red-500 hover:bg-red-500/20"
                >
                  Cancel Premium
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className={clsx(
            "p-8 rounded-3xl border",
            theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
          )}>
            <div className="flex items-center gap-4 mb-6">
              <Lock className="w-8 h-8 text-zinc-500" />
              <h2 className="text-xl font-bold">Unlock Premium</h2>
            </div>
            <p className="text-zinc-500 mb-6">Enter your unlock code to get unlimited access.</p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter code to activate premium"
              className={clsx(
                "w-full p-4 rounded-xl border mb-4 font-mono placeholder:text-zinc-500",
                theme !== 'light' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
              )}
            />
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button
              onClick={handleUnlock}
              className="w-full py-3 px-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
            >
              Unlock Premium
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
