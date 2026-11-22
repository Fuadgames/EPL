import React, { useState, useEffect, useRef, useTransition } from 'react';
import { useStore } from '../store/useStore';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { EPLInterpreter } from '../lib/epl-interpreter';
import { ArrowLeft, Play, StopCircle, Maximize2, Minimize2, RefreshCw, Volume2, VolumeX, Grid } from 'lucide-react';
import { clsx } from 'clsx';
import AppPreview from './AppPreview';

export default function PlayerView() {
  const theme = useStore(state => state.theme);
  const playingAppId = useStore(state => state.playingAppId);
  const setCurrentView = useStore(state => state.setCurrentView);
  const aiAnswerMode = useStore(state => state.aiAnswerMode);
  const aiChangesEnabled = useStore(state => state.aiChangesEnabled);
  const unlockAchievement = useStore(state => state.unlockAchievement);
  const userUploadedFiles = useStore(state => state.userData?.uploadedFiles);
  const projectFiles = useStore(state => state.projectFiles);
  const [isPending, startTransition] = useTransition();
  const [appData, setAppData] = useState<any>(null);
  const [uiState, setUiState] = useState<{ entities: Record<string, any>; variables?: Record<string, any>; camera?: any; uiMode?: any }>({ entities: {}, variables: {}, camera: null, uiMode: null });
  const [output, setOutput] = useState<string[]>([]);
  const [view, setView] = useState<'game' | 'console'>('game');
  const [isRunning, setIsRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const interpreterRef = useRef<EPLInterpreter | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (playingAppId) {
      const fetchApp = async () => {
        try {
          const docRef = doc(db, 'apps', playingAppId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setAppData(docSnap.data());
          } else {
            setError('App not found.');
          }
        } catch (e: any) {
          setError(e.message);
        }
      };
      fetchApp();
    }
  }, [playingAppId]);

  useEffect(() => {
    if (appData && !isRunning) {
      handleRun();
    }
    return () => {
      handleStop();
    };
  }, [appData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isRunning && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        const controlType = interpreterRef.current?.context.controlType;
        if (controlType === 'wasd') {
          if (['w', 'a', 's', 'd', ' '].includes(e.key.toLowerCase())) {
            handleUIEvent('key_pressed?', e.key);
          }
        } else {
          handleUIEvent('key_pressed?', e.key);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (isRunning && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        handleUIEvent('key_released?', e.key);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isRunning]);

  useEffect(() => {
    interpreterRef.current?.setMuted(isMuted);
  }, [isMuted]);

  const handleRun = async () => {
    if (!appData) return;
    setUiState({ entities: {}, variables: {}, camera: null, uiMode: null });
    setOutput([]);
    setIsRunning(true);
    setError(null);
    
    const mergedFiles = [...(appData.uploadedFiles || []), ...(userUploadedFiles || []), ...(projectFiles || [])];

    interpreterRef.current = new EPLInterpreter(
      (msg) => {
        if (msg === '__CLEAR__') {
          setOutput([]);
        } else {
          setOutput((prev) => [...prev, msg]);
        }
      },
      (entities, uiMode, meta) => setUiState({
        entities,
        uiMode: uiMode || null,
        variables: meta?.variables || {},
        camera: meta?.camera || null
      }),
      { answerMode: aiAnswerMode, changesEnabled: aiChangesEnabled },
      [],
      false,
      mergedFiles
    );
    interpreterRef.current.setMuted(isMuted);

    try {
      if (appData.code.includes('create block')) {
        unlockAchievement('creative_soul');
      }
      await interpreterRef.current.run(appData.code);
    } catch (e: any) {
      setError(`Runtime Error: ${e.message}`);
    } finally {
      if (interpreterRef.current && !interpreterRef.current.hasEvents()) {
        setIsRunning(false);
      }
    }
  };

  const handleStop = () => {
    if (interpreterRef.current) {
      interpreterRef.current.stop();
    }
    setIsRunning(false);
  };

  const handleRestart = async () => {
    handleStop();
    setTimeout(() => {
      handleRun();
    }, 100);
  };

  const handleUIEvent = (eventName: string, target?: string, value?: string) => {
    if (interpreterRef.current && isRunning) {
      interpreterRef.current.triggerEvent(eventName, target, value);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <div className="text-red-500 mb-4">{error}</div>
        <button onClick={() => startTransition(() => setCurrentView('store'))} className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700">
          Back to Store
        </button>
      </div>
    );
  }

  if (!appData) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className={clsx("h-full flex flex-col overflow-hidden", theme !== 'light' ? 'bg-[#111315]' : 'bg-[#F5F6F8]')}>
      <div className={clsx(
        "flex items-center justify-between px-5 py-3 border-b",
        theme !== 'light' ? 'bg-[#181B20] border-[#262B33] text-[#F3F4F6]' : 'bg-white border-[#E2E5EA] text-[#111315]'
      )}>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => startTransition(() => setCurrentView('store'))}
            className={clsx(
              "p-2 -ml-1 rounded-lg border transition-colors cursor-pointer",
              theme !== 'light' ? "bg-[#111315] border-[#262B33] text-[#9CA3AF] hover:text-[#F3F4F6]" : "bg-[#F5F6F8] border-[#E2E5EA] text-[#525866] hover:text-[#111315]"
            )}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-bold leading-tight">{appData.title}</h2>
            <p className="text-xs text-[#9CA3AF]">by {appData.authorName}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2.5">
          {!isRunning ? (
            <button onClick={handleRun} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E] rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap">
              <Play className="w-3.5 h-3.5" /> Run
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={handleStop} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap">
                <StopCircle className="w-3.5 h-3.5" /> Stop
              </button>
              <button 
                onClick={handleRestart} 
                className="flex items-center justify-center p-1.5 bg-[#111315] border border-[#262B33] hover:bg-[#22262E] text-[#F3F4F6] rounded-lg transition-colors cursor-pointer"
                title="Restart"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}
          <button
            onClick={() => setShowGrid(v => !v)}
            className={clsx(
              "p-2 rounded-lg border transition-colors cursor-pointer",
              showGrid
                ? "bg-emerald-500/20 border-emerald-500/40 text-[#10B981]"
                : theme !== 'light'
                  ? "bg-[#111315] border-[#262B33] text-[#9CA3AF] hover:text-[#F3F4F6]"
                  : "bg-[#F5F6F8] border-[#E2E5EA] text-[#525866] hover:text-[#111315]"
            )}
            title="Grid"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMuted(v => !v)}
            className={clsx(
              "p-2 rounded-lg border transition-colors cursor-pointer",
              isMuted
                ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                : theme !== 'light'
                  ? "bg-[#111315] border-[#262B33] text-[#9CA3AF] hover:text-[#F3F4F6]"
                  : "bg-[#F5F6F8] border-[#E2E5EA] text-[#525866] hover:text-[#111315]"
            )}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleFullscreen}
            className={clsx(
              "p-2 rounded-lg border transition-colors cursor-pointer",
              theme !== 'light' ? "bg-[#111315] border-[#262B33] text-[#9CA3AF] hover:text-[#F3F4F6]" : "bg-[#F5F6F8] border-[#E2E5EA] text-[#525866] hover:text-[#111315]"
            )}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className={clsx("flex items-center gap-2 px-4 py-2 border-b", theme !== 'light' ? "bg-[#181B20] border-[#262B33]" : "bg-white border-[#E2E5EA]")}>
        <button onClick={() => setView('game')} className={clsx("px-3 py-1 rounded-md text-xs font-semibold cursor-pointer", view === 'game' ? "bg-[#10B981] text-[#0A0C0E]" : "text-[#9CA3AF] hover:text-[#F3F4F6]")}>Game</button>
        <button onClick={() => setView('console')} className={clsx("px-3 py-1 rounded-md text-xs font-semibold cursor-pointer", view === 'console' ? "bg-[#10B981] text-[#0A0C0E]" : "text-[#9CA3AF] hover:text-[#F3F4F6]")}>Console</button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-black/50 overflow-auto">
        {view === 'game' ? (
          <div 
            ref={containerRef}
            className={clsx(
              "relative overflow-hidden shadow-2xl transition-all",
              isFullscreen ? "w-screen h-screen" : "w-full max-w-4xl aspect-video rounded-xl border border-[#262B33]"
            )}
            style={{
              backgroundColor: (Object.values(uiState.entities).find((e: any) => e.type === 'world') as any)?.background || '#ffffff',
              backgroundImage: (Object.values(uiState.entities).find((e: any) => e.type === 'world') as any)?.backgroundImage ? `url(${(Object.values(uiState.entities).find((e: any) => e.type === 'world') as any)?.backgroundImage})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {Object.keys(uiState.entities).length === 0 && isRunning ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm italic">
                App is running...
              </div>
            ) : (
              <AppPreview
                entities={uiState.entities}
                variables={uiState.variables}
                camera={uiState.camera}
                uiMode={uiState.uiMode}
                handleUIEvent={handleUIEvent}
                isFullScreen={isFullscreen}
                showGrid={showGrid}
              />
            )}
          </div>
        ) : (
          <div className="w-full h-full bg-[#181B20] border border-[#262B33] rounded-xl p-4 font-mono text-xs text-[#D1D5DB] overflow-y-auto">
            {output.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}
