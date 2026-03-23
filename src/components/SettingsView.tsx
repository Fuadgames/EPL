import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { auth } from '../firebase';
import { updateProfile } from 'firebase/auth';
import { Sun, Moon, User, Save, CheckCircle2, AlertCircle, Bot, Lock, Sparkles, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';

export default function SettingsView() {
  const theme = useStore(state => state.theme);
  const setTheme = useStore(state => state.setTheme);
  const user = useStore(state => state.user);
  const setUser = useStore(state => state.setUser);
  const aiAnswerMode = useStore(state => state.aiAnswerMode);
  const setAiAnswerMode = useStore(state => state.setAiAnswerMode);
  const aiChangesEnabled = useStore(state => state.aiChangesEnabled);
  const setAiChangesEnabled = useStore(state => state.setAiChangesEnabled);
  const isPremium = useStore(state => state.isPremium);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const setIsFrutigerAero = useStore(state => state.setIsFrutigerAero);
  const userData = useStore(state => state.userData);
  const simulatedRole = useStore(state => state.simulatedRole);
  const setSimulatedRole = useStore(state => state.setSimulatedRole);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUpdating(true);
    setStatus(null);
    try {
      await updateProfile(user, { displayName });
      // Update local store user object
      setUser({ ...user, displayName } as any);
      setStatus({ type: 'success', message: 'Profile updated successfully!' });
    } catch (error: any) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 sm:p-8 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        <h1 className={clsx("text-3xl font-bold tracking-tight mb-8", isFrutigerAero ? "text-blue-900" : "")}>Settings</h1>

        <div className="space-y-6">
          {/* Developer Simulation Section */}
          {userData?.role === 'developer' && simulatedRole && (
            <section className={clsx(
              "p-6 rounded-3xl border border-amber-500/50 bg-amber-500/5",
              isFrutigerAero ? "backdrop-blur-md shadow-sm" : ""
            )}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-500">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h2 className={clsx("text-xl font-bold", isFrutigerAero ? "text-blue-900" : "")}>Developer Simulation</h2>
              </div>
              <p className={clsx("text-sm mb-4", isFrutigerAero ? "text-blue-800/70" : "text-zinc-500")}>
                You are currently simulating the <strong>{simulatedRole}</strong> role.
              </p>
              <button
                onClick={() => setSimulatedRole(null)}
                className="w-full py-3 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white transition-all shadow-lg shadow-amber-500/20"
              >
                Revert to Developer Mode
              </button>
            </section>
          )}

          {/* Appearance Section */}
          <section className={clsx(
            "p-6 rounded-3xl border",
            isFrutigerAero ? "bg-white/40 border-white/50 backdrop-blur-md shadow-sm" :
            theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
          )}>
            <div className="flex items-center gap-3 mb-6">
              <div className={clsx("p-2 rounded-lg", isFrutigerAero ? "bg-blue-500/20 text-blue-600 shadow-inner" : "bg-emerald-500/10 text-emerald-500")}>
                <Sun className="w-5 h-5" />
              </div>
              <h2 className={clsx("text-xl font-bold", isFrutigerAero ? "text-blue-900" : "")}>Appearance</h2>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className={clsx("font-medium", isFrutigerAero ? "text-blue-900" : "")}>Theme Mode</p>
                <p className={clsx("text-sm", isFrutigerAero ? "text-blue-800/70" : "text-zinc-500")}>Switch between light, dark, and gradient themes</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setTheme('light')}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all",
                    isFrutigerAero && theme === 'light' ? "bg-blue-500 text-white border-blue-600 shadow-md" :
                    isFrutigerAero ? "bg-white/50 border-white/40 text-blue-800 hover:bg-white/70" :
                    theme === 'light'
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                      : 'bg-zinc-100 border-zinc-200 text-zinc-800 hover:bg-zinc-200'
                  )}
                >
                  <Sun className="w-4 h-4" /> Light
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all",
                    isFrutigerAero && theme === 'dark' ? "bg-blue-500 text-white border-blue-600 shadow-md" :
                    isFrutigerAero ? "bg-white/50 border-white/40 text-blue-800 hover:bg-white/70" :
                    theme === 'dark'
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                      : 'bg-zinc-100 border-zinc-200 text-zinc-800 hover:bg-zinc-200'
                  )}
                >
                  <Moon className="w-4 h-4" /> Dark
                </button>
                <button
                  onClick={() => isPremium && setTheme('gradient')}
                  disabled={!isPremium}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all",
                    isFrutigerAero && theme === 'gradient' ? "bg-blue-500 text-white border-blue-600 shadow-md" :
                    isFrutigerAero && !isPremium ? "bg-white/30 border-white/20 text-blue-800/50 cursor-not-allowed" :
                    isFrutigerAero ? "bg-white/50 border-white/40 text-blue-800 hover:bg-white/70" :
                    theme === 'gradient'
                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 border-emerald-500 text-white'
                      : !isPremium 
                        ? 'bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed opacity-50'
                        : 'bg-zinc-100 border-zinc-200 text-zinc-800 hover:bg-zinc-200'
                  )}
                >
                  <Sparkles className="w-4 h-4" /> Gradient {!isPremium && <Lock className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Frutiger Aero Toggle */}
            {userData?.purchasedItems?.includes('frutiger-aero') && (
              <div className={clsx("flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 pt-6 border-t", isFrutigerAero ? "border-white/30" : "border-zinc-800/50")}>
                <div>
                  <p className={clsx("font-medium flex items-center gap-2", isFrutigerAero ? "text-blue-900" : "")}>
                    <Sparkles className={clsx("w-4 h-4", isFrutigerAero ? "text-blue-500" : "text-blue-500")} />
                    Frutiger Aero Style
                  </p>
                  <p className={clsx("text-sm", isFrutigerAero ? "text-blue-800/70" : "text-zinc-500")}>Enable the classic glass and aqua aesthetic</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsFrutigerAero(true)}
                    className={clsx(
                      "px-4 py-2 rounded-xl border transition-all font-medium",
                      isFrutigerAero
                        ? 'bg-blue-500 text-white border-blue-600 shadow-md'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
                    )}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setIsFrutigerAero(false)}
                    className={clsx(
                      "px-4 py-2 rounded-xl border transition-all font-medium",
                      !isFrutigerAero
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
                    )}
                  >
                    No
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* AI Section */}
          <section className={clsx(
            "p-6 rounded-3xl border",
            isFrutigerAero ? "bg-white/40 border-white/50 backdrop-blur-md shadow-sm" :
            theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
          )}>
            <div className="flex items-center gap-3 mb-6">
              <div className={clsx("p-2 rounded-lg", isFrutigerAero ? "bg-purple-500/20 text-purple-600 shadow-inner" : "bg-purple-500/10 text-purple-500")}>
                <Bot className="w-5 h-5" />
              </div>
              <h2 className={clsx("text-xl font-bold", isFrutigerAero ? "text-blue-900" : "")}>AI Settings</h2>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className={clsx("font-medium", isFrutigerAero ? "text-blue-900" : "")}>Answer Mode</p>
                  <p className={clsx("text-sm", isFrutigerAero ? "text-blue-800/70" : "text-zinc-500")}>How the AI should output answers</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAiAnswerMode('text')}
                    className={clsx(
                      "px-4 py-2 rounded-xl border transition-all",
                      isFrutigerAero && aiAnswerMode === 'text' ? "bg-purple-500 text-white border-purple-600 shadow-md" :
                      isFrutigerAero ? "bg-white/50 border-white/40 text-purple-800 hover:bg-white/70" :
                      aiAnswerMode === 'text'
                        ? 'bg-purple-500 text-white border-purple-600'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
                    )}
                  >
                    Text
                  </button>
                  <button
                    onClick={() => setAiAnswerMode('console')}
                    className={clsx(
                      "px-4 py-2 rounded-xl border transition-all",
                      isFrutigerAero && aiAnswerMode === 'console' ? "bg-purple-500 text-white border-purple-600 shadow-md" :
                      isFrutigerAero ? "bg-white/50 border-white/40 text-purple-800 hover:bg-white/70" :
                      aiAnswerMode === 'console'
                        ? 'bg-purple-500 text-white border-purple-600'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
                    )}
                  >
                    Console
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className={clsx("font-medium", isFrutigerAero ? "text-blue-900" : "")}>AI Changes</p>
                  <p className={clsx("text-sm", isFrutigerAero ? "text-blue-800/70" : "text-zinc-500")}>Allow AI to modify app entities</p>
                </div>
                <button
                  onClick={() => setAiChangesEnabled(!aiChangesEnabled)}
                  className={clsx(
                    "w-12 h-6 rounded-full transition-all relative",
                    aiChangesEnabled ? 'bg-purple-500' : (isFrutigerAero ? 'bg-white/50 border border-white/60' : 'bg-zinc-700')
                  )}
                >
                  <div className={clsx(
                    "w-4 h-4 rounded-full bg-white absolute top-1 transition-all shadow-sm",
                    aiChangesEnabled ? 'left-7' : 'left-1'
                  )} />
                </button>
              </div>
            </div>
          </section>

          {/* Account Section */}
          {user && (
            <section className={clsx(
              "p-6 rounded-3xl border",
              isFrutigerAero ? "bg-white/40 border-white/50 backdrop-blur-md shadow-sm" :
              theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
            )}>
              <div className="flex items-center gap-3 mb-6">
                <div className={clsx("p-2 rounded-lg", isFrutigerAero ? "bg-blue-500/20 text-blue-600 shadow-inner" : "bg-blue-500/10 text-blue-500")}>
                  <User className="w-5 h-5" />
                </div>
                <h2 className={clsx("text-xl font-bold", isFrutigerAero ? "text-blue-900" : "")}>Account Settings</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={clsx("block text-sm font-medium mb-1", isFrutigerAero ? "text-blue-800/80" : "text-zinc-500")}>Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={clsx(
                      "w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all",
                      isFrutigerAero ? "bg-white/60 border-white/40 text-blue-900 focus:ring-blue-400 shadow-inner" :
                      theme !== 'light' ? 'bg-zinc-800 border-zinc-700 text-white focus:ring-emerald-500/50' : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:ring-emerald-500/50'
                    )}
                    placeholder="Enter your name"
                  />
                </div>

                {status && (
                  <div className={clsx(
                    "flex items-center gap-2 p-3 rounded-xl text-sm",
                    status.type === 'success' 
                      ? (isFrutigerAero ? 'bg-emerald-500/20 text-emerald-700 border border-emerald-500/30' : 'bg-emerald-500/10 text-emerald-500') 
                      : (isFrutigerAero ? 'bg-red-500/20 text-red-700 border border-red-500/30' : 'bg-red-500/10 text-red-500')
                  )}>
                    {status.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {status.message}
                  </div>
                )}

                <button
                  onClick={handleUpdateProfile}
                  disabled={isUpdating || displayName === user.displayName}
                  className={clsx(
                    "w-full flex items-center justify-center gap-2 px-6 py-3 disabled:opacity-50 rounded-xl font-medium transition-all",
                    isFrutigerAero ? "frutiger-aero-button" : "bg-emerald-500 hover:bg-emerald-600 disabled:hover:bg-emerald-500 text-white"
                  )}
                >
                  <Save className="w-5 h-5" />
                  {isUpdating ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </section>
          )}

          {!user && (
            <div className={clsx("text-center p-8 italic", isFrutigerAero ? "text-blue-800/60" : "text-zinc-500")}>
              Sign in to access account settings.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
