import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  HardDrive,
  Link2,
  Loader2,
  MonitorDown,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from '../store/useStore';
import { notify } from '../store/useDialogStore';

interface GeneratedDriveLink {
  fileId: string;
  fileName: string;
  fileSize: string;
  directUrl: string;
  fallbackUrl: string;
  driveViewUrl: string;
  resolvedLive: boolean;
  generatedAt: string;
}

const DEFAULT_FALLBACK: GeneratedDriveLink = {
  fileId: '122nysFUK_GBpxPBcwfV0kMSGhbNuRoSy',
  fileName: 'EPL Studio Desktop Setup 1.0.0.exe',
  fileSize: '108M',
  directUrl:
    'https://drive.usercontent.google.com/download?id=122nysFUK_GBpxPBcwfV0kMSGhbNuRoSy&export=download&confirm=t',
  fallbackUrl:
    'https://drive.google.com/uc?export=download&id=122nysFUK_GBpxPBcwfV0kMSGhbNuRoSy',
  driveViewUrl:
    'https://drive.google.com/file/d/122nysFUK_GBpxPBcwfV0kMSGhbNuRoSy/view?usp=drive_link',
  resolvedLive: false,
  generatedAt: new Date().toISOString(),
};

export default function DesktopDownloadModal() {
  const isOpen = useStore((state) => state.isDesktopDownloadOpen);
  const setIsOpen = useStore((state) => state.setIsDesktopDownloadOpen);
  const theme = useStore((state) => state.theme);
  const isFrutigerAero = useStore((state) => state.isFrutigerAero);
  const language = useStore((state) => state.language);

  const isLight = theme === 'light' && !isFrutigerAero;

  const [isGenerating, setIsGenerating] = useState(false);
  const [linkData, setLinkData] = useState<GeneratedDriveLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const generateLink = useCallback(async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    setCopied(false);
    try {
      const res = await fetch('/api/desktop-app/generate-link', {
        method: 'GET',
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as GeneratedDriveLink;
      setLinkData(data);
    } catch (err: any) {
      setLinkData({
        ...DEFAULT_FALLBACK,
        generatedAt: new Date().toISOString(),
      });
      setErrorMsg(
        language === 'ru'
          ? 'Сформирована резервная прямая ссылка Google Drive.'
          : 'Generated fallback direct Google Drive link.'
      );
      console.warn('Desktop download link generation warning:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [language]);

  useEffect(() => {
    if (isOpen) {
      generateLink();
    }
  }, [isOpen, generateLink]);

  if (!isOpen) return null;

  const activeData = linkData || DEFAULT_FALLBACK;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeData.directUrl);
      setCopied(true);
      notify.success(
        language === 'ru'
          ? 'Прямая ссылка Google Drive скопирована!'
          : 'Direct Google Drive download link copied!'
      );
      setTimeout(() => setCopied(false), 2500);
    } catch {
      notify.info(activeData.directUrl);
    }
  };

  return (
    <div
      onClick={() => setIsOpen(false)}
      className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          'w-full max-w-lg rounded-2xl border overflow-hidden shadow-2xl transition-all',
          isFrutigerAero
            ? 'frutiger-aero-glass border-white text-[#062038]'
            : isLight
              ? 'bg-white border-[#E2E5EA] text-[#111315]'
              : 'bg-[#181B20] border-[#262B33] text-[#F3F4F6]'
        )}
      >
        {/* Header */}
        <div
          className={clsx(
            'px-5 py-4 border-b border-current/10 flex items-center justify-between',
            isFrutigerAero
              ? 'bg-white/40'
              : isLight
                ? 'bg-gradient-to-r from-emerald-50 to-sky-50'
                : 'bg-gradient-to-r from-[#10B981]/10 via-[#06B6D4]/10 to-transparent'
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={clsx(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                isFrutigerAero
                  ? 'bg-white/75 text-[#0284c7] shadow-sm'
                  : 'bg-gradient-to-br from-[#10B981] to-[#06B6D4] text-[#09120E] shadow-md shadow-emerald-500/20'
              )}
            >
              <MonitorDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-1.5">
                <span>EPL Studio Desktop App</span>
                <Sparkles className="w-4 h-4 text-[#10B981]" />
              </h3>
              <p className="text-xs opacity-75">
                {language === 'ru'
                  ? 'Генератор прямой ссылки скачивания с Google Drive'
                  : 'Direct Google Drive Download Link Generator'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-current/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {isGenerating ? (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
              <div className="relative">
                <Loader2 className="w-8 h-8 animate-spin text-[#10B981]" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {language === 'ru'
                    ? 'Генерируем прямую ссылку на скачивание из Google Drive...'
                    : 'Generating verified Google Drive download link...'}
                </p>
                <p className="text-xs opacity-65 mt-1">
                  {language === 'ru'
                    ? 'Получаем токен подтверждения и метаданные файла'
                    : 'Resolving confirmation token and file metadata'}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* File Card */}
              <div
                className={clsx(
                  'p-3.5 rounded-xl border flex items-center justify-between gap-3',
                  isFrutigerAero
                    ? 'bg-white/50 border-white/70'
                    : isLight
                      ? 'bg-[#F5F6F8] border-[#E2E5EA]'
                      : 'bg-[#111315] border-[#262B33]'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-[#10B981]/15 text-[#10B981] flex items-center justify-center shrink-0">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{activeData.fileName}</p>
                    <div className="flex items-center gap-2 text-xs opacity-75 mt-0.5 font-mono-num">
                      <span>{activeData.fileSize}</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-[#10B981]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {activeData.resolvedLive
                          ? language === 'ru'
                            ? 'Прямая ссылка готова'
                            : 'Live link generated'
                          : language === 'ru'
                            ? 'Ссылка готова'
                            : 'Link ready'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={generateLink}
                  title={language === 'ru' ? 'Сгенерировать новую ссылку' : 'Regenerate link'}
                  className={clsx(
                    'p-2 rounded-lg border transition-colors cursor-pointer shrink-0',
                    isLight
                      ? 'bg-white border-[#E2E5EA] hover:bg-zinc-100'
                      : 'bg-[#181B20] border-[#262B33] hover:bg-[#20242B]'
                  )}
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Generated Link Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider opacity-75 inline-flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>
                      {language === 'ru'
                        ? 'Сгенерированная ссылка для скачивания:'
                        : 'Generated Direct Download URL:'}
                    </span>
                  </label>
                  <span className="text-[10px] font-mono opacity-60">
                    {new Date(activeData.generatedAt).toLocaleTimeString()}
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={activeData.directUrl}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className={clsx(
                      'flex-1 px-3 py-2 rounded-xl border text-xs font-mono focus:outline-none select-all',
                      isFrutigerAero
                        ? 'bg-white/75 border-white/80 text-[#062038]'
                        : isLight
                          ? 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315]'
                          : 'bg-[#111315] border-[#262B33] text-[#10B981]'
                    )}
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={clsx(
                      'px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0',
                      copied
                        ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981]'
                        : isLight
                          ? 'bg-[#F5F6F8] border-[#E2E5EA] hover:bg-zinc-200'
                          : 'bg-[#111315] border-[#262B33] hover:bg-[#20242B]'
                    )}
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>
                      {copied
                        ? language === 'ru'
                          ? 'Готово'
                          : 'Copied'
                        : language === 'ru'
                          ? 'Копировать'
                          : 'Copy'}
                    </span>
                  </button>
                </div>
                {errorMsg && <p className="text-[11px] opacity-70 mt-1.5">{errorMsg}</p>}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <a
                  href={activeData.directUrl}
                  download={activeData.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={clsx(
                    'flex-1 py-2.5 px-4 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 transition-all shadow-md hover:-translate-y-0.5',
                    isFrutigerAero
                      ? 'frutiger-aero-button'
                      : 'bg-gradient-to-r from-[#10B981] to-[#06B6D4] hover:brightness-110 text-[#09120E]'
                  )}
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {language === 'ru'
                      ? 'Скачать Desktop App'
                      : 'Download Desktop App'}
                  </span>
                </a>

                <a
                  href={activeData.driveViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={clsx(
                    'px-4 py-2.5 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors',
                    isLight
                      ? 'border-[#E2E5EA] hover:bg-[#F5F6F8] text-[#4B5563]'
                      : 'border-[#262B33] hover:bg-[#20242B] text-[#9CA3AF]'
                  )}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Google Drive</span>
                </a>
              </div>

              <div className="flex items-center gap-2 text-[11px] opacity-65 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                <span>
                  {language === 'ru'
                    ? 'Прямая ссылка обходит страницу предупреждения Google Drive и сразу загружает установщик.'
                    : 'This direct link bypasses the Google Drive scan warning page to start the installer download directly.'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
