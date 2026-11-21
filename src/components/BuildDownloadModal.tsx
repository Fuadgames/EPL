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
  Cpu,
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
            category: app.category,
          },
        }),
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

  const platforms: { id: PlatformType; name: string; ext: string; icon: any; guide: string }[] = [
    {
      id: 'windows',
      name: 'Windows',
      ext: '.exe',
      icon: Monitor,
      guide:
        language === 'ru'
          ? 'Компилирует проект в готовый исполняемый файл Windows (.exe). Запускается сразу как отдельное приложение.'
          : 'Compiles project into a standalone Windows Executable (.exe). Runs immediately in dedicated application window.',
    },
    {
      id: 'macos',
      name: 'macOS',
      ext: '.zip / .app',
      icon: Apple,
      guide:
        language === 'ru'
          ? 'Сборка бандла приложения .app для macOS с нативным лаунчером и ресурсами.'
          : 'macOS Application Bundle (.app) containing native launcher script and standalone resources.',
    },
    {
      id: 'linux',
      name: 'Linux',
      ext: '.zip / .desktop',
      icon: Terminal,
      guide:
        language === 'ru'
          ? 'Пакет для Linux: запускается в отдельном окне через launch.sh и включает установщик в меню приложений.'
          : 'Linux Desktop Application: launches in dedicated window via launch.sh with desktop entry.',
    },
    {
      id: 'android',
      name: 'Android',
      ext: '.zip / PWA',
      icon: Smartphone,
      guide:
        language === 'ru'
          ? 'Пакет для Android: автономный WebAPK/PWA с Service Worker, сенсорным D-Pad и установкой на экран.'
          : 'Android Mobile Application: standalone PWA with offline Service Worker and touch D-Pad.',
    },
    {
      id: 'ios',
      name: 'iOS',
      ext: '.mobileconfig',
      icon: Smartphone,
      guide:
        language === 'ru'
          ? 'Apple WebClip профиль: устанавливает приложение прямо на домашний экран iPhone/iPad в полноэкранном режиме.'
          : 'Apple WebClip profile: installs the app directly to iPhone/iPad Home Screen in full-screen.',
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
    { key: 'installing', label: language === 'ru' ? 'Зависимости' : 'Deps' },
    { key: 'building', label: language === 'ru' ? 'Компиляция' : 'Compiling' },
    { key: 'packaging', label: language === 'ru' ? 'Упаковка' : 'Packaging' },
    { key: 'validating', label: language === 'ru' ? 'Валидация' : 'Validating' },
    { key: 'completed', label: language === 'ru' ? 'Готово' : 'Ready' },
  ];

  const getStepIndex = (s: BuildStep) => {
    switch (s) {
      case 'preparing':
        return 0;
      case 'installing':
        return 1;
      case 'building':
        return 2;
      case 'packaging':
        return 3;
      case 'validating':
        return 4;
      case 'completed':
        return 5;
      default:
        return -1;
    }
  };

  const currentStepIdx = getStepIndex(status);
  const isDark = theme !== 'light' && !isFrutigerAero;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className={clsx(
          'w-full max-w-xl rounded-xl overflow-hidden shadow-2xl border flex flex-col relative',
          isFrutigerAero
            ? 'frutiger-aero-glass border-white/60 text-blue-950'
            : isDark
            ? 'bg-[#181B20] border-[#262B33] text-[#F1F3F5]'
            : 'bg-white border-[#E2E5EA] text-[#111315]'
        )}
      >
        <div
          className={clsx(
            'flex items-center justify-between p-4 sm:p-5 border-b',
            isFrutigerAero ? 'border-white/50' : isDark ? 'border-[#262B33]' : 'border-[#E2E5EA]'
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={clsx(
                'w-10 h-10 rounded-lg overflow-hidden border flex items-center justify-center font-bold',
                isDark ? 'bg-[#111315] border-[#262B33] text-[#10B981]' : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#059669]'
              )}
            >
              {app.iconUrl ? (
                <img src={app.iconUrl} alt={app.title} className="w-full h-full object-cover" />
              ) : (
                app.title.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight truncate max-w-[260px]">{app.title}</h2>
              <p className={clsx('text-xs', isDark ? 'text-[#9BA1A6]' : 'text-[#5C636E]')}>
                {language === 'ru' ? 'Сборка исполняемого файла приложения' : 'Native Application Compiler'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={clsx(
              'p-1.5 rounded-lg transition-colors cursor-pointer',
              isDark ? 'hover:bg-[#21252C] text-[#9BA1A6]' : 'hover:bg-black/5 text-[#5C636E]'
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[#9BA1A6] mb-2.5 block">
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
                      'flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-colors cursor-pointer',
                      isSelected
                        ? isFrutigerAero
                          ? 'bg-blue-500/20 border-blue-500 text-blue-900'
                          : 'bg-[#10B981]/10 border-[#10B981] text-[#10B981]'
                        : isDark
                        ? 'bg-[#111315] border-[#262B33] text-[#9BA1A6] hover:border-[#374151] hover:text-[#F1F3F5]'
                        : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#5C636E] hover:border-[#CBD5E1] hover:text-[#111315]'
                    )}
                  >
                    <IconComponent className="w-5 h-5 mb-1.5" />
                    <span className="text-xs font-semibold">{p.name}</span>
                    <span className="text-[10px] opacity-75 font-mono">{p.ext}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className={clsx(
              'p-3.5 rounded-lg border text-xs flex items-start gap-2.5',
              isDark ? 'bg-[#111315] border-[#262B33] text-[#D1D5DB]' : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#5C636E]'
            )}
          >
            <Cpu className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
            <div className="leading-relaxed">{platforms.find(p => p.id === platform)?.guide}</div>
          </div>

          {status !== 'idle' && (
            <div
              className={clsx(
                'rounded-lg p-4 border space-y-3.5',
                isDark ? 'bg-[#111315] border-[#262B33]' : 'bg-[#F5F6F8] border-[#E2E5EA]'
              )}
            >
              <div className="flex items-center justify-between text-[10px] font-medium gap-1">
                {steps.map((step, idx) => {
                  const isDone = currentStepIdx > idx || status === 'completed';
                  const isCurrent = currentStepIdx === idx && status !== 'completed' && status !== 'failed';
                  return (
                    <div key={step.key} className="flex flex-col items-center gap-1 flex-1 text-center">
                      <div
                        className={clsx(
                          'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors font-mono-num',
                          isDone
                            ? 'bg-[#10B981] text-[#111315]'
                            : isCurrent
                            ? 'bg-[#10B981]/20 border border-[#10B981] text-[#10B981]'
                            : isDark
                            ? 'bg-[#21252C] text-[#6B7280]'
                            : 'bg-[#E2E5EA] text-[#8A94A6]'
                        )}
                      >
                        {isDone ? '✓' : idx + 1}
                      </div>
                      <span
                        className={clsx(
                          'text-[10px] truncate max-w-[60px]',
                          isDone || isCurrent ? 'text-[#10B981] font-semibold' : 'text-[#6B7280]'
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className={clsx('w-full h-1.5 rounded-full overflow-hidden', isDark ? 'bg-[#21252C]' : 'bg-[#E2E5EA]')}>
                <div
                  className={clsx(
                    'h-full transition-all duration-300',
                    status === 'failed' ? 'bg-red-500' : 'bg-[#10B981]'
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {statusMessage && (
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 truncate">
                    {(status === 'preparing' ||
                      status === 'installing' ||
                      status === 'building' ||
                      status === 'packaging' ||
                      status === 'validating') && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#10B981] shrink-0" />}
                    {status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0" />}
                    {status === 'failed' && <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                    <span className="truncate">{statusMessage}</span>
                  </span>
                  <span className="font-mono font-mono-num text-[#10B981] shrink-0 ml-2">{progress}%</span>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-500 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-1">
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="text-[11px] text-[#9BA1A6] hover:text-[#F1F3F5] flex items-center gap-1 font-medium transition-colors cursor-pointer"
                >
                  <Terminal className="w-3 h-3" />
                  <span>
                    {showLogs
                      ? language === 'ru'
                        ? 'Скрыть лог компилятора'
                        : 'Hide compiler logs'
                      : language === 'ru'
                      ? 'Показать лог компилятора'
                      : 'Show compiler logs'}{' '}
                    ({logs.length})
                  </span>
                  {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {showLogs && (
                  <div className="mt-2 p-2.5 rounded-lg bg-[#0B0D0F] border border-[#262B33] font-mono text-[10px] text-[#10B981] max-h-36 overflow-y-auto space-y-0.5">
                    {logs.map((log, i) => (
                      <div key={i} className="leading-tight break-all">
                        {log}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>

              {status === 'completed' && fileName && (
                <div
                  className={clsx(
                    'pt-2 border-t text-xs flex items-center justify-between',
                    isDark ? 'border-[#262B33] text-[#9BA1A6]' : 'border-[#E2E5EA] text-[#5C636E]'
                  )}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Package className="w-4 h-4 text-[#10B981] shrink-0" />
                    <span className="font-mono truncate max-w-[240px] font-semibold">{fileName}</span>
                  </div>
                  <span className="font-mono font-mono-num font-semibold">{formatSize(fileSize)}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            {status === 'idle' && (
              <button
                onClick={() => startBuild(platform)}
                className={clsx(
                  'w-full py-3 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap',
                  isFrutigerAero
                    ? 'frutiger-aero-button text-white'
                    : 'bg-[#10B981] hover:bg-[#059669] text-[#111315]'
                )}
              >
                <Download className="w-4 h-4" />
                {language === 'ru'
                  ? platform === 'windows'
                    ? `Скомпилировать ${app.title}.exe`
                    : `Собрать приложение (${platforms.find(p => p.id === platform)?.ext})`
                  : platform === 'windows'
                  ? `Compile ${app.title}.exe`
                  : `Build Application (${platforms.find(p => p.id === platform)?.ext})`}
              </button>
            )}

            {(status === 'preparing' ||
              status === 'installing' ||
              status === 'building' ||
              status === 'packaging' ||
              status === 'validating') && (
              <button
                disabled
                className={clsx(
                  'w-full py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 cursor-not-allowed',
                  isDark ? 'bg-[#21252C] text-[#9BA1A6]' : 'bg-[#E2E5EA] text-[#5C636E]'
                )}
              >
                <RefreshCw className="w-4 h-4 animate-spin text-[#10B981]" />
                <span>
                  {status === 'preparing' && (language === 'ru' ? 'Подготовка...' : 'Preparing...')}
                  {status === 'installing' && (language === 'ru' ? 'Зависимости...' : 'Dependencies...')}
                  {status === 'building' && (language === 'ru' ? 'Компиляция рантайма...' : 'Compiling runtime...')}
                  {status === 'packaging' &&
                    (language === 'ru' ? (platform === 'windows' ? 'Компиляция EXE...' : 'Упаковка...') : 'Packaging...')}
                  {status === 'validating' && (language === 'ru' ? 'Валидация...' : 'Validating...')}
                </span>
              </button>
            )}

            {status === 'completed' && downloadUrl && (
              <div className="w-full flex gap-2">
                <a
                  href={downloadUrl}
                  download={fileName || 'app-build'}
                  className="flex-1 py-3 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#111315] font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
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
                  className={clsx(
                    'px-4 py-3 rounded-lg border font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap',
                    isDark
                      ? 'bg-[#21252C] border-[#262B33] text-[#F1F3F5] hover:bg-[#2A2F38]'
                      : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315] hover:bg-[#EBEEF2]'
                  )}
                >
                  {language === 'ru' ? 'Другая платформа' : 'Other Platform'}
                </button>
              </div>
            )}

            {status === 'failed' && (
              <button
                onClick={() => startBuild(platform)}
                className="w-full py-3 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#111315] font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
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
