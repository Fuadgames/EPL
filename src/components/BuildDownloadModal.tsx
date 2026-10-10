import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Monitor, 
  Apple, 
  Terminal, 
  Smartphone, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Package,
  Sparkles,
  Cpu
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

export interface BuildAppTarget {
  id: string;
  title: string;
  version?: string;
  code: string;
  iconUrl?: string;
  description?: string;
  authorName?: string;
  category?: string;
  supportedPlatforms?: string[];
  windowsUrl?: string;
  macosUrl?: string;
  linuxUrl?: string;
  apkUrl?: string;
}

interface BuildDownloadModalProps {
  app: BuildAppTarget | null;
  initialPlatform?: string;
  isOpen: boolean;
  onClose: () => void;
}

type PlatformType = 'windows' | 'macos' | 'linux' | 'android' | 'ios';
type BuildStep = 'idle' | 'preparing' | 'installing' | 'building' | 'packaging' | 'validating' | 'completed' | 'failed';

export default function BuildDownloadModal({ app, initialPlatform, isOpen, onClose }: BuildDownloadModalProps) {
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const language = useStore(state => state.language);

  const [platform, setPlatform] = useState<PlatformType>('windows');
  const [buildId, setBuildId] = useState<string | null>(null);
  const [status, setStatus] = useState<BuildStep>('idle');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialPlatform) {
      if (initialPlatform === 'apk') setPlatform('android');
      else if (initialPlatform === 'source' || initialPlatform === 'exe') setPlatform('windows');
      else if (initialPlatform === 'dmg') setPlatform('macos');
      else if (initialPlatform === 'appimage') setPlatform('linux');
      else setPlatform(initialPlatform as PlatformType);
    }
  }, [initialPlatform]);

  useEffect(() => {
    if (!isOpen) {
      setBuildId(null);
      setStatus('idle');
      setProgress(0);
      setStatusMessage('');
      setLogs([]);
      setDownloadUrl(null);
      setError(null);
      setShowLogs(false);
    }
  }, [isOpen]);

  // Auto-scroll logs
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

  const startBuild = async (targetPlatform: PlatformType = platform) => {
    if (!app) return;
    setError(null);
    setStatus('preparing');
    setProgress(10);
    setStatusMessage(language === 'ru' ? 'Подготовка окружения и компилятора...' : 'Preparing build environment...');
    setLogs([`[${new Date().toLocaleTimeString()}] Initializing build worker for ${targetPlatform.toUpperCase()}...`]);
    setDownloadUrl(null);

    try {
      const res = await fetch('/api/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: app.id,
          platform: targetPlatform,
          version: app.version || '1.0.0',
          appData: {
            id: app.id,
            title: app.title,
            code: app.code,
            version: app.version || '1.0.0',
            iconUrl: app.iconUrl,
            description: app.description,
            authorName: app.authorName,
            category: app.category
          }
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to initialize build pipeline');
      }

      const data = await res.json();
      setBuildId(data.buildId);
    } catch (e: any) {
      console.error('Build start error:', e);
      setStatus('failed');
      setError(e.message || 'Build initialization failed');
      setLogs(prev => [...prev, `[ERROR] ${e.message || 'Build initialization failed'}`]);
    }
  };

  // Poll status while active
  useEffect(() => {
    if (!buildId || status === 'idle' || status === 'completed' || status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/build/${buildId}/status`);
        if (!res.ok) throw new Error('Status check failed');

        const data = await res.json();
        setStatus(data.status);
        setProgress(data.progress || 0);
        setStatusMessage(data.statusMessage || '');
        if (data.logs && Array.isArray(data.logs)) {
          setLogs(data.logs);
        }

        if (data.status === 'completed') {
          setDownloadUrl(data.downloadUrl);
          setFileName(data.fileName);
          setFileSize(data.fileSize);
          clearInterval(interval);

          // Auto-trigger download
          const a = document.createElement('a');
          a.href = data.downloadUrl;
          a.download = data.fileName || 'app-build';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else if (data.status === 'failed') {
          setError(data.error || 'Compilation or packaging failed');
          clearInterval(interval);
        }
      } catch (err: any) {
        console.error('Polling error:', err);
      }
    }, 350);

    return () => clearInterval(interval);
  }, [buildId, status]);

  if (!isOpen || !app) return null;

  const platforms: { id: PlatformType; name: string; ext: string; icon: any; desc: string; guide: string }[] = [
    { 
      id: 'windows', 
      name: 'Windows', 
      ext: '.exe', 
      icon: Monitor, 
      desc: 'Executable (.exe)',
      guide: language === 'ru' 
        ? 'Компилирует проект в готовый исполняемый файл Windows (.exe). Запускается сразу как отдельное приложение без вкладок браузера и без необходимости сборки.' 
        : 'Compiles project into a standalone Windows Executable (.exe). Runs immediately in dedicated application window with 0 setup.'
    },
    { 
      id: 'macos', 
      name: 'macOS', 
      ext: '.zip / .app', 
      icon: Apple, 
      desc: 'App Bundle',
      guide: language === 'ru'
        ? 'Сборка бандла приложения .app для macOS с нативным лаунчером и ресурсами.'
        : 'macOS Application Bundle (.app) containing native launcher script and standalone resources.'
    },
    { 
      id: 'linux', 
      name: 'Linux', 
      ext: '.zip / .desktop', 
      icon: Terminal, 
      desc: 'Desktop App',
      guide: language === 'ru'
        ? 'Пакет для Linux: запускается в отдельном окне через launch.sh и включает установщик в меню приложений.'
        : 'Linux Desktop Application: launches in dedicated window via launch.sh with desktop entry.'
    },
    { 
      id: 'android', 
      name: 'Android', 
      ext: '.zip / PWA', 
      icon: Smartphone, 
      desc: 'Mobile App',
      guide: language === 'ru'
        ? 'Пакет для Android: автономный WebAPK/PWA с Service Worker, сенсорным D-Pad и установкой на экран.'
        : 'Android Mobile Application: standalone PWA with offline Service Worker and touch D-Pad.'
    },
    { 
      id: 'ios', 
      name: 'iOS', 
      ext: '.mobileconfig', 
      icon: Smartphone, 
      desc: 'WebClip Profile',
      guide: language === 'ru'
        ? 'Apple WebClip профиль: устанавливает приложение прямо на домашний экран iPhone/iPad в полноэкранном режиме.'
        : 'Apple WebClip profile: installs the app directly to iPhone/iPad Home Screen in full-screen.'
    },
  ];

  const formatSize = (bytes?: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const steps = [
    { key: 'preparing', label: language === 'ru' ? 'Подготовка' : 'Preparing' },
    { key: 'installing', label: language === 'ru' ? 'Зависимости' : 'Dependencies' },
    { key: 'building', label: language === 'ru' ? 'Компиляция' : 'Compiling' },
    { key: 'packaging', label: language === 'ru' ? 'Сборка EXE' : 'Packaging' },
    { key: 'validating', label: language === 'ru' ? 'Валидация' : 'Validating' },
    { key: 'completed', label: language === 'ru' ? 'Готово' : 'Ready' },
  ];

  const getStepIndex = (s: BuildStep) => {
    switch (s) {
      case 'preparing': return 0;
      case 'installing': return 1;
      case 'building': return 2;
      case 'packaging': return 3;
      case 'validating': return 4;
      case 'completed': return 5;
      case 'failed': return -1;
      default: return -1;
    }
  };

  const currentStepIdx = getStepIndex(status);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={clsx(
          "w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl border flex flex-col relative",
          isFrutigerAero ? "frutiger-aero-glass border-white/60 text-blue-950" :
          theme !== 'light' ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md">
              {app.iconUrl ? (
                <img src={app.iconUrl} alt={app.title} className="w-full h-full object-cover" />
              ) : (
                app.title.charAt(0)
              )}
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight truncate max-w-[260px]">{app.title}</h2>
              <p className="text-xs text-zinc-400">
                {language === 'ru' ? 'Сборка исполняемого файла приложения' : 'Native Application Compiler'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Platform Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5 block">
              {language === 'ru' ? 'Целевая платформа' : 'Select Target Platform'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {platforms.map(p => {
                const isSelected = platform === p.id;
                const IconComponent = p.icon;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPlatform(p.id);
                      if (status === 'completed' || status === 'failed') {
                        setStatus('idle');
                        setDownloadUrl(null);
                        setLogs([]);
                      }
                    }}
                    className={clsx(
                      "flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all cursor-pointer",
                      isSelected
                        ? "bg-blue-600/20 border-blue-500 text-blue-400 shadow-md ring-1 ring-blue-500/50"
                        : theme !== 'light'
                        ? "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                        : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
                    )}
                  >
                    <IconComponent className="w-5 h-5 mb-1.5" />
                    <span className="text-xs font-bold">{p.name}</span>
                    <span className="text-[10px] opacity-75 font-mono">{p.ext}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Platform Description */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs flex items-start gap-2.5 text-zinc-300">
            <Cpu className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              {platforms.find(p => p.id === platform)?.guide}
            </div>
          </div>

          {/* Build Pipeline Stage Stepper */}
          {status !== 'idle' && (
            <div className="rounded-2xl p-4 border bg-zinc-900/40 border-zinc-800 space-y-3.5">
              {/* Stepper Breadcrumb */}
              <div className="flex items-center justify-between text-[10px] font-medium gap-1">
                {steps.map((step, idx) => {
                  const isDone = currentStepIdx > idx || status === 'completed';
                  const isCurrent = currentStepIdx === idx && status !== 'completed' && status !== 'failed';
                  return (
                    <div key={step.key} className="flex flex-col items-center gap-1 flex-1 text-center">
                      <div className={clsx(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all",
                        isDone ? "bg-emerald-500 text-white shadow-xs" :
                        isCurrent ? "bg-blue-600 text-white ring-2 ring-blue-400/40 animate-pulse" :
                        "bg-zinc-800 text-zinc-500"
                      )}>
                        {isDone ? '✓' : idx + 1}
                      </div>
                      <span className={clsx(
                        "text-[9px] truncate max-w-[55px]",
                        isDone ? "text-emerald-400 font-semibold" :
                        isCurrent ? "text-blue-400 font-bold" :
                        "text-zinc-500"
                      )}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden relative">
                <div 
                  className={clsx(
                    "h-full transition-all duration-300 rounded-full",
                    status === 'failed' ? "bg-red-500" :
                    status === 'completed' ? "bg-emerald-500" : "bg-blue-500 animate-pulse"
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Status Message */}
              {statusMessage && (
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span className="flex items-center gap-2 truncate">
                    {(status === 'preparing' || status === 'installing' || status === 'building' || status === 'packaging' || status === 'validating') && (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400 shrink-0" />
                    )}
                    {status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    {status === 'failed' && <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                    <span className="truncate">{statusMessage}</span>
                  </span>
                  <span className="font-mono text-blue-400 shrink-0 ml-2">{progress}%</span>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Toggle Build Logs */}
              <div className="pt-1">
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                >
                  <Terminal className="w-3 h-3" />
                  <span>{showLogs ? (language === 'ru' ? 'Скрыть лог компилятора' : 'Hide compiler logs') : (language === 'ru' ? 'Показать лог компилятора' : 'Show compiler logs')} ({logs.length})</span>
                  {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {showLogs && (
                  <div className="mt-2 p-2.5 rounded-xl bg-black border border-zinc-800 font-mono text-[10px] text-emerald-400 max-h-36 overflow-y-auto space-y-0.5">
                    {logs.map((log, i) => (
                      <div key={i} className="leading-tight break-all">{log}</div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>

              {/* Ready Artifact Details */}
              {status === 'completed' && fileName && (
                <div className="pt-2 border-t border-zinc-800 text-xs flex items-center justify-between text-zinc-400">
                  <div className="flex items-center gap-1.5 truncate">
                    <Package className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-mono truncate max-w-[240px] text-zinc-200 font-semibold">{fileName}</span>
                  </div>
                  <span className="font-mono font-bold text-zinc-300">{formatSize(fileSize)}</span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {status === 'idle' && (
              <button
                onClick={() => startBuild(platform)}
                className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4" />
                {language === 'ru' 
                  ? (platform === 'windows' ? `Скомпилировать ${app.title}.exe` : `Собрать приложение (${platforms.find(p => p.id === platform)?.ext})`) 
                  : (platform === 'windows' ? `Compile ${app.title}.exe` : `Build Application (${platforms.find(p => p.id === platform)?.ext})`)}
              </button>
            )}

            {(status === 'preparing' || status === 'installing' || status === 'building' || status === 'packaging' || status === 'validating') && (
              <button
                disabled
                className="w-full py-3.5 rounded-2xl bg-zinc-800 text-zinc-400 font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                <span>
                  {status === 'preparing' && (language === 'ru' ? 'Подготовка...' : 'Preparing...')}
                  {status === 'installing' && (language === 'ru' ? 'Зависимости...' : 'Dependencies...')}
                  {status === 'building' && (language === 'ru' ? 'Компиляция рантайма...' : 'Compiling runtime...')}
                  {status === 'packaging' && (language === 'ru' ? (platform === 'windows' ? 'Компиляция EXE...' : 'Упаковка...') : 'Packaging...')}
                  {status === 'validating' && (language === 'ru' ? 'Валидация...' : 'Validating...')}
                </span>
              </button>
            )}

            {status === 'completed' && downloadUrl && (
              <div className="w-full flex gap-2">
                <a
                  href={downloadUrl}
                  download={fileName || 'app-build'}
                  className="flex-1 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  {language === 'ru' ? `Скачать ${fileName || 'приложение'}` : `Download ${fileName || 'App'}`}
                </a>
                <button
                  onClick={() => {
                    setStatus('idle');
                    setDownloadUrl(null);
                    setLogs([]);
                  }}
                  className="px-4 py-3.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-sm transition-all cursor-pointer"
                >
                  {language === 'ru' ? 'Другая платформа' : 'Other Platform'}
                </button>
              </div>
            )}

            {status === 'failed' && (
              <button
                onClick={() => startBuild(platform)}
                className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <RefreshCw className="w-4 h-4" />
                {language === 'ru' ? 'Повторить сборку' : 'Retry Build'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
