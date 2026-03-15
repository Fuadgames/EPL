import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { auth } from '../firebase';
import { updateProfile } from 'firebase/auth';
import { Sun, Moon, User, Save, CheckCircle2, AlertCircle, Bot } from 'lucide-react';
import { clsx } from 'clsx';

export default function SettingsView() {
  const { theme, toggleTheme, user, setUser, aiAnswerMode, setAiAnswerMode, aiChangesEnabled, setAiChangesEnabled } = useStore();
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
        <h1 className="text-3xl font-bold tracking-tight mb-8">Settings</h1>

        <div className="space-y-6">
          {/* Appearance Section */}
          <section className={clsx(
            "p-6 rounded-3xl border",
            theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
          )}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                <Sun className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold">Appearance</h2>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Theme Mode</p>
                <p className="text-sm text-zinc-500">Switch between light and dark themes</p>
              </div>
              <button
                onClick={toggleTheme}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all",
                  theme === 'dark' 
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700' 
                    : 'bg-zinc-100 border-zinc-200 text-zinc-800 hover:bg-zinc-200'
                )}
              >
                {theme === 'dark' ? (
                  <><Moon className="w-4 h-4" /> Dark</>
                ) : (
                  <><Sun className="w-4 h-4" /> Light</>
                )}
              </button>
            </div>
          </section>

          {/* AI Section */}
          <section className={clsx(
            "p-6 rounded-3xl border",
            theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
          )}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
                <Bot className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold">AI Settings</h2>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Answer Mode</p>
                  <p className="text-sm text-zinc-500">How the AI should output answers</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAiAnswerMode('text')}
                    className={clsx(
                      "px-4 py-2 rounded-xl border transition-all",
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
                  <p className="font-medium">AI Changes</p>
                  <p className="text-sm text-zinc-500">Allow AI to modify app entities</p>
                </div>
                <button
                  onClick={() => setAiChangesEnabled(!aiChangesEnabled)}
                  className={clsx(
                    "w-12 h-6 rounded-full transition-all relative",
                    aiChangesEnabled ? 'bg-purple-500' : 'bg-zinc-700'
                  )}
                >
                  <div className={clsx(
                    "w-4 h-4 rounded-full bg-white absolute top-1 transition-all",
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
              theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
            )}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                  <User className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold">Account Settings</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-500 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={clsx(
                      "w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all",
                      theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                    )}
                    placeholder="Enter your name"
                  />
                </div>

                {status && (
                  <div className={clsx(
                    "flex items-center gap-2 p-3 rounded-xl text-sm",
                    status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                  )}>
                    {status.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {status.message}
                  </div>
                )}

                <button
                  onClick={handleUpdateProfile}
                  disabled={isUpdating || displayName === user.displayName}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-white rounded-xl font-medium transition-all"
                >
                  <Save className="w-5 h-5" />
                  {isUpdating ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </section>
          )}

          {!user && (
            <div className="text-center p-8 text-zinc-500 italic">
              Sign in to access account settings.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
