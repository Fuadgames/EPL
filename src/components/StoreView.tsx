import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store/useStore';
import { Search, Star, Download, Play, Monitor, Smartphone, Apple, Terminal, Lock } from 'lucide-react';
import { clsx } from 'clsx';

interface AppData {
  id: string;
  title: string;
  description: string;
  code: string;
  version: string;
  authorName: string;
  downloads: number;
  rating: number;
  isAiGenerated?: boolean;
  isPrivate?: boolean;
  isLocked?: boolean;
  unlockCode?: string;
  supportedPlatforms?: string[];
}

export default function StoreView() {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [downloadingApp, setDownloadingApp] = useState<string | null>(null);
  const [unlockingApp, setUnlockingApp] = useState<{app: AppData, action: 'play' | 'download', platform?: string} | null>(null);
  const [unlockCodeInput, setUnlockCodeInput] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const { theme, setCurrentView, setPlayingAppId } = useStore();

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const q = query(collection(db, 'apps'), orderBy('downloads', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        const appsData = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as AppData))
          .filter(app => !app.isPrivate);
        setApps(appsData);
      } catch (error) {
        console.error("Error fetching apps", error);
      } finally {
        setLoading(false);
      }
    };
    fetchApps();
  }, []);

  const handlePlay = (app: AppData) => {
    if (app.isLocked) {
      setUnlockingApp({ app, action: 'play' });
      setUnlockCodeInput('');
      setUnlockError('');
    } else {
      executePlay(app);
    }
  };

  const executePlay = (app: AppData) => {
    setPlayingAppId(app.id);
    setCurrentView('player');
  };

  const handleDownload = (app: AppData, platform: string) => {
    if (app.isLocked) {
      setUnlockingApp({ app, action: 'download', platform });
      setUnlockCodeInput('');
      setUnlockError('');
    } else {
      executeDownload(app, platform);
    }
  };

  const executeDownload = (app: AppData, platform: string) => {
    setDownloadingApp(`${app.id}-${platform}`);
    
    // Simulate compilation/download delay
    setTimeout(() => {
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>${app.title}</title>
  <style>
    body { margin: 0; overflow: hidden; background: #09090b; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; }
    .container { text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${app.title}</h1>
    <p>This is a packaged EPL application for ${platform}.</p>
    <p>To run this natively, wrap this HTML with Electron, Tauri, or Capacitor.</p>
    <pre style="text-align: left; background: #18181b; padding: 20px; border-radius: 8px; margin-top: 20px; max-width: 600px; overflow: auto;">${app.code}</pre>
  </div>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${app.title.replace(/\s+/g, '_').toLowerCase()}-${platform}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setDownloadingApp(null);
    }, 1500);
  };

  const filteredApps = apps.filter(app => app.title.toLowerCase().includes(search.toLowerCase()) || app.description.toLowerCase().includes(search.toLowerCase()));

  const getPlatformIcon = (platform: string) => {
    switch(platform) {
      case 'windows': return <Monitor className="w-3 h-3" />;
      case 'macos': return <Apple className="w-3 h-3" />;
      case 'linux': return <Terminal className="w-3 h-3" />;
      case 'apk': return <Smartphone className="w-3 h-3" />;
      default: return null;
    }
  };

  return (
    <div className="h-full flex flex-col p-4 sm:p-8 overflow-y-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">App Store</h1>
          <p className={clsx("mt-2", theme !== 'light' ? 'text-zinc-400' : 'text-zinc-500')}>Discover programs written in EPL.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search apps..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={clsx(
              "w-full pl-10 pr-4 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors",
              theme !== 'light' ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'
            )}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredApps.map(app => (
            <div key={app.id} className={clsx(
              "p-6 rounded-2xl border transition-all hover:shadow-lg group",
              theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200 hover:border-zinc-300'
            )}>
              <div className="flex justify-between items-start mb-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-white font-bold text-xl shadow-inner">
                    {app.title.charAt(0)}
                  </div>
                  {app.isAiGenerated && (
                    <div className="absolute -top-2 -right-2 bg-zinc-900 border border-emerald-500/50 rounded-full p-1 shadow-lg" title="AI Generated">
                      <Terminal className="w-3 h-3 text-emerald-500" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 text-amber-400 bg-amber-400/10 px-2 py-1 rounded-lg text-xs font-medium">
                  <Star className="w-3 h-3 fill-current" />
                  {app.rating.toFixed(1)}
                </div>
              </div>
              
              <h3 className="text-lg font-semibold mb-1 truncate flex items-center gap-2">
                {app.title}
                {app.isLocked && <Lock className="w-4 h-4 text-emerald-500" title="Locked App" />}
              </h3>
              <p className={clsx("text-sm mb-4 line-clamp-2", theme !== 'light' ? 'text-zinc-400' : 'text-zinc-500')}>
                {app.description}
              </p>
              
              <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-zinc-800/50">
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                  <span className="truncate max-w-[100px]">by {app.authorName}</span>
                  <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {app.downloads}</span>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {(!app.supportedPlatforms || app.supportedPlatforms.includes('web')) && (
                    <button 
                      onClick={() => handlePlay(app)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" /> Play Online
                    </button>
                  )}
                  
                  {app.supportedPlatforms && app.supportedPlatforms.filter(p => p !== 'web').map(platform => (
                    <button
                      key={platform}
                      onClick={() => handleDownload(app, platform)}
                      disabled={downloadingApp === `${app.id}-${platform}`}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      title={`Download for ${platform}`}
                    >
                      {downloadingApp === `${app.id}-${platform}` ? (
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current"></div>
                      ) : (
                        <>
                          {getPlatformIcon(platform)}
                          <span className="capitalize">{platform}</span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unlock App Modal */}
      {unlockingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={clsx(
            "w-full max-w-sm rounded-2xl p-6 shadow-2xl",
            theme !== 'light' ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'
          )}>
            <h3 className="text-xl font-bold mb-2">App is Locked</h3>
            <p className="text-sm text-zinc-500 mb-6">
              "{unlockingApp.app.title}" requires an unlock code to {unlockingApp.action}.
            </p>
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Enter unlock code..."
                  value={unlockCodeInput}
                  onChange={(e) => setUnlockCodeInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                />
                {unlockError && <p className="text-red-500 text-xs mt-2">{unlockError}</p>}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-8">
              <button
                onClick={() => setUnlockingApp(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (unlockCodeInput === unlockingApp.app.unlockCode) {
                    if (unlockingApp.action === 'play') {
                      executePlay(unlockingApp.app);
                    } else if (unlockingApp.action === 'download' && unlockingApp.platform) {
                      executeDownload(unlockingApp.app, unlockingApp.platform);
                    }
                    setUnlockingApp(null);
                  } else {
                    setUnlockError('Incorrect unlock code.');
                  }
                }}
                className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
