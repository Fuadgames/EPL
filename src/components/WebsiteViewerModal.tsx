import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Globe, RefreshCw, X, Volume2, VolumeX, Maximize2, Minimize2, Sparkles, Lock } from 'lucide-react';
import { clsx } from 'clsx';
import { AppData } from '../types';
import { EPLInterpreter } from '../lib/epl-interpreter';
import { useStore } from '../store/useStore';
import AppPreview from './AppPreview';

interface WebsiteViewerModalProps {
  isOpen: boolean;
  app: AppData | null;
  onClose: () => void;
}

export default function WebsiteViewerModal({ isOpen, app, onClose }: WebsiteViewerModalProps) {
  const theme = useStore(state => state.theme);
  const language = useStore(state => state.language);
  const userUploadedFiles = useStore(state => state.userData?.uploadedFiles);
  const projectFiles = useStore(state => state.projectFiles);
  const aiAnswerMode = useStore(state => state.aiAnswerMode);
  const aiChangesEnabled = useStore(state => state.aiChangesEnabled);

  const [uiState, setUiState] = useState<{
    entities: Record<string, any>;
    variables?: Record<string, any>;
    camera?: any;
    uiMode?: any;
  }>({ entities: {}, variables: {}, camera: null, uiMode: null });
  const [isRunning, setIsRunning] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [showIntroBanner, setShowIntroBanner] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const interpreterRef = useRef<EPLInterpreter | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const stopSite = useCallback(() => {
    if (interpreterRef.current) {
      try {
        interpreterRef.current.stop();
      } catch {
        // ignore stop cleanup error
      }
      interpreterRef.current = null;
    }
    setIsRunning(false);
  }, []);

  useEffect(() => {
    if (!isOpen || !app) {
      stopSite();
      setShowIntroBanner(false);
      return;
    }

    let cancelled = false;
    setRuntimeError(null);
    setUiState({ entities: {}, variables: {}, camera: null, uiMode: null });
    setIsRunning(true);

    if (!app.hideWatermark) {
      setShowIntroBanner(true);
    } else {
      setShowIntroBanner(false);
    }

    const bannerTimer = !app.hideWatermark
      ? window.setTimeout(() => {
          setShowIntroBanner(false);
        }, 2800)
      : undefined;

    const mergedFiles = [
      ...((app as any).uploadedFiles || []),
      ...(userUploadedFiles || []),
      ...(projectFiles || [])
    ];

    const interpreter = new EPLInterpreter(
      () => {},
      (entities, uiMode, meta) => {
        if (cancelled) return;
        setUiState({
          entities,
          uiMode: uiMode || null,
          variables: meta?.variables || {},
          camera: meta?.camera || null
        });
      },
      { answerMode: aiAnswerMode, changesEnabled: aiChangesEnabled },
      [],
      false,
      mergedFiles
    );
    interpreter.setMuted(isMuted);
    interpreterRef.current = interpreter;

    interpreter
      .run(app.code || '')
      .catch((err: any) => {
        if (!cancelled) {
          setRuntimeError(err?.message || 'Site execution error');
        }
      })
      .finally(() => {
        if (!cancelled && !interpreter.hasEvents()) {
          setIsRunning(false);
        }
      });

    return () => {
      cancelled = true;
      if (bannerTimer) window.clearTimeout(bannerTimer);
      interpreter.stop();
      if (interpreterRef.current === interpreter) {
        interpreterRef.current = null;
      }
    };
  }, [isOpen, app?.id, reloadTick]);

  useEffect(() => {
    interpreterRef.current?.setMuted(isMuted);
  }, [isMuted]);

  useEffect(() => {
    if (!isOpen || !isRunning) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      interpreterRef.current?.triggerEvent('key_pressed?', e.key);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      interpreterRef.current?.triggerEvent('key_released?', e.key);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isOpen, isRunning]);

  const handleUIEvent = useCallback((eventName: string, target?: string, value?: string) => {
    if (interpreterRef.current) {
      interpreterRef.current.triggerEvent(eventName, target, value);
    }
  }, []);

  if (!isOpen || !app) return null;

  const isLight = theme === 'light';
  const rawSlug = (app.websiteDomain || `${(app.title || 'site').toLowerCase().replace(/[^a-z0-9-]+/g, '-')}.epl`)
    .replace(/^https?:\/\//i, '');
  const displayDomain = rawSlug.endsWith('.epl') ? rawSlug : `${rawSlug}.epl`;

  const worldEntity = Object.values(uiState.entities).find((e: any) => e.type === 'world') as any;

  return (
    <div className="fixed inset-0 z-[230] bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div
        className={clsx(
          'flex flex-col overflow-hidden border shadow-2xl transition-all',
          isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-6xl h-[90vh] rounded-2xl',
          isLight ? 'bg-white border-[#E2E5EA] text-[#111315]' : 'bg-[#111315] border-[#262B33] text-[#F3F4F6]'
        )}
      >
        {/* Browser Chrome Header */}
        <div
          className={clsx(
            'px-3 sm:px-4 py-2.5 border-b flex items-center gap-3 shrink-0',
            isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#181B20] border-[#262B33]'
          )}
        >
          {/* Identity */}
          <div className="flex items-center gap-2 min-w-0 max-w-[180px] sm:max-w-[240px] shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#10B981]/15 border border-[#10B981]/35 flex items-center justify-center overflow-hidden shrink-0">
              {app.iconUrl ? (
                <img src={app.iconUrl} alt={app.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Globe className="w-4 h-4 text-[#10B981]" />
              )}
            </div>
            <div className="min-w-0 hidden sm:block">
              <div className="text-xs font-bold truncate">{app.title}</div>
              <div className="text-[10px] opacity-60 truncate">by {app.authorName || 'Creator'}</div>
            </div>
          </div>

          {/* Address Bar */}
          <div
            className={clsx(
              'flex-1 min-w-0 flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono text-xs',
              isLight ? 'bg-white border-[#E2E5EA] text-slate-700' : 'bg-[#0A0C0E] border-[#262B33] text-[#E5E7EB]'
            )}
          >
            <Lock className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
            <span className="truncate select-all">
              <span className="opacity-50">https://</span>
              <span className="text-[#10B981] font-semibold">{displayDomain}</span>
            </span>
          </div>

          {/* Browser Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setReloadTick(t => t + 1)}
              className={clsx(
                'p-2 rounded-lg border transition-colors cursor-pointer',
                isLight ? 'bg-white border-[#E2E5EA] hover:bg-slate-100' : 'bg-[#111315] border-[#262B33] hover:bg-[#21252C]'
              )}
              title={language === 'ru' ? 'Перезагрузить сайт' : 'Reload site'}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsMuted(m => !m)}
              className={clsx(
                'p-2 rounded-lg border transition-colors cursor-pointer',
                isLight ? 'bg-white border-[#E2E5EA] hover:bg-slate-100' : 'bg-[#111315] border-[#262B33] hover:bg-[#21252C]'
              )}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-[#10B981]" />}
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen(f => !f)}
              className={clsx(
                'p-2 rounded-lg border transition-colors cursor-pointer hidden sm:flex',
                isLight ? 'bg-white border-[#E2E5EA] hover:bg-slate-100' : 'bg-[#111315] border-[#262B33] hover:bg-[#21252C]'
              )}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                stopSite();
                onClose();
              }}
              className={clsx(
                'p-2 rounded-lg border transition-colors cursor-pointer',
                isLight ? 'bg-white border-[#E2E5EA] hover:bg-rose-50 hover:text-rose-600' : 'bg-[#111315] border-[#262B33] hover:bg-rose-500/15 hover:text-rose-400'
              )}
              title={language === 'ru' ? 'Закрыть сайт' : 'Close website'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Website Content Viewport */}
        <div
          ref={viewportRef}
          className="flex-1 relative overflow-hidden bg-[#0A0C0E]"
          style={{
            backgroundColor: worldEntity?.background || '#0A0C0E',
            backgroundImage: worldEntity?.backgroundImage ? `url(${worldEntity.backgroundImage})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {runtimeError ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-rose-400">
              <div className="text-sm font-bold mb-1">
                {language === 'ru' ? 'Ошибка загрузки сайта' : 'Website Error'}
              </div>
              <div className="text-xs font-mono opacity-80 max-w-md">{runtimeError}</div>
            </div>
          ) : (
            <AppPreview
              entities={uiState.entities}
              variables={uiState.variables}
              camera={uiState.camera}
              uiMode={uiState.uiMode}
              handleUIEvent={handleUIEvent}
              isFullScreen={isFullscreen}
              showGrid={false}
            />
          )}

          {/* Intro Splash Banner: "Created in EPL Studio" (unless Premium removed watermark) */}
          {!app.hideWatermark && showIntroBanner && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#090B0E]/85 backdrop-blur-sm p-4 animate-in fade-in duration-300">
              <div className="max-w-sm w-full rounded-2xl border border-[#10B981]/40 bg-[#14171C] p-6 text-center shadow-2xl space-y-3">
                <div className="w-12 h-12 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 flex items-center justify-center mx-auto text-[#10B981]">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="text-xs font-mono uppercase tracking-widest text-[#10B981]">
                  {displayDomain}
                </div>
                <h3 className="text-lg font-bold text-[#F3F4F6]">Created in EPL Studio</h3>
                <p className="text-xs text-[#9CA3AF]">
                  {language === 'ru'
                    ? `Открываем сайт «${app.title}»...`
                    : `Loading "${app.title}"...`}
                </p>
                <button
                  type="button"
                  onClick={() => setShowIntroBanner(false)}
                  className="px-4 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#09120E] text-xs font-bold cursor-pointer transition-colors"
                >
                  {language === 'ru' ? 'Перейти на сайт' : 'Continue to Site'}
                </button>
              </div>
            </div>
          )}

          {/* Persistent Subtle Corner Watermark (unless Premium removed watermark) */}
          {!app.hideWatermark && !showIntroBanner && (
            <div className="pointer-events-none absolute bottom-3 right-3 z-20 px-2.5 py-1 rounded-lg bg-black/75 border border-[#10B981]/40 text-[11px] font-semibold text-[#E5E7EB] flex items-center gap-1.5 shadow-lg">
              <Sparkles className="w-3 h-3 text-[#10B981]" />
              <span>Created in EPL Studio</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
