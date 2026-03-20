import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { EPLInterpreter } from '../lib/epl-interpreter';
import { ArrowLeft, Play, StopCircle, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

export default function PlayerView() {
  const theme = useStore(state => state.theme);
  const playingAppId = useStore(state => state.playingAppId);
  const setCurrentView = useStore(state => state.setCurrentView);
  const aiAnswerMode = useStore(state => state.aiAnswerMode);
  const aiChangesEnabled = useStore(state => state.aiChangesEnabled);
  const [appData, setAppData] = useState<any>(null);
  const [uiState, setUiState] = useState<any>({ entities: {} });
  const [output, setOutput] = useState<string[]>([]);
  const [view, setView] = useState<'game' | 'console'>('game');
  const [isRunning, setIsRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
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
          if (['w', 'a', 's', 'd'].includes(e.key.toLowerCase())) {
            handleUIEvent('key_pressed?', e.key);
          }
        } else {
          handleUIEvent('key_pressed?', e.key);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning]);

  const handleRun = async () => {
    if (!appData) return;
    setUiState({ entities: {} });
    setOutput([]);
    setIsRunning(true);
    setError(null);
    
    interpreterRef.current = new EPLInterpreter(
      (msg) => setOutput((prev) => [...prev, msg]),
      (entities) => setUiState({ entities }),
      { answerMode: aiAnswerMode, changesEnabled: aiChangesEnabled }
    );

    try {
      await interpreterRef.current.run(appData.code);
    } catch (e: any) {
      setError(`Runtime Error: ${e.message}`);
    } finally {
      if (interpreterRef.current && Object.keys(interpreterRef.current.context.events).length === 0) {
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
        <button onClick={() => setCurrentView('store')} className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700">
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
    <div className={clsx("h-full flex flex-col overflow-hidden", theme !== 'light' ? 'bg-zinc-950' : 'bg-zinc-50')}>
      <div className={clsx(
        "flex items-center justify-between px-6 py-3 border-b",
        theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'
      )}>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setCurrentView('store')}
            className="p-2 -ml-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-zinc-100">{appData.title}</h2>
            <p className="text-xs text-zinc-500">by {appData.authorName}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!isRunning ? (
            <button onClick={handleRun} className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors">
              <Play className="w-4 h-4" /> Run
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={handleStop} className="flex items-center gap-2 px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors">
                <StopCircle className="w-4 h-4" /> Stop
              </button>
              <button 
                onClick={handleRestart} 
                className="flex items-center justify-center p-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                title="Restart"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}
          <button onClick={toggleFullscreen} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors">
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800">
        <button onClick={() => setView('game')} className={clsx("px-3 py-1 rounded-md text-sm", view === 'game' ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white")}>Game</button>
        <button onClick={() => setView('console')} className={clsx("px-3 py-1 rounded-md text-sm", view === 'console' ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200")}>Console</button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-black/50 overflow-auto">
        {view === 'game' ? (
          <div 
            ref={containerRef}
            className={clsx(
              "relative overflow-hidden shadow-2xl transition-all",
              isFullscreen ? "w-screen h-screen" : "w-full max-w-4xl aspect-video rounded-2xl border border-zinc-800"
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
              Object.values(uiState.entities).map((entity: any) => {
                if (entity.type === 'sprite' || entity.type === 'player' || entity.type === 'enemy' || entity.type === 'png') {
                  return (
                    <img 
                      key={entity.id}
                      src={entity.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${entity.name}`}
                      className="absolute transition-all duration-300"
                      style={{ left: entity.x || 0, top: entity.y || 0, width: entity.width || 64, height: entity.height || 64 }}
                      alt={entity.name}
                      referrerPolicy="no-referrer"
                    />
                  );
                }
                if (entity.type === 'button') {
                  return (
                    <button
                      key={entity.id}
                      onClick={() => handleUIEvent('clicked?', entity.name)}
                      className="absolute px-4 py-2 text-white rounded-lg font-medium shadow-md transition-all hover:scale-105"
                      style={{ 
                        left: entity.x || 0, 
                        top: entity.y || 0,
                        backgroundColor: entity.color || '#10b981'
                      }}
                    >
                      {entity.label || entity.name}
                    </button>
                  );
                }
                if (entity.type === 'block') {
                  return (
                    <div
                      key={entity.id}
                      className="absolute"
                      style={{ 
                        left: entity.x || 0, 
                        top: entity.y || 0,
                        width: entity.width || 50,
                        height: entity.height || 50,
                        backgroundColor: entity.color || '#3f3f46'
                      }}
                    />
                  );
                }
                if (entity.type === '3Dblock') {
                  return (
                    <div
                      key={entity.id}
                      className="absolute"
                      style={{ 
                        left: entity.x || 0, 
                        top: entity.y || 0,
                        width: entity.size || 50,
                        height: entity.size || 50,
                        backgroundColor: entity.color || '#3f3f46',
                        boxShadow: '4px 4px 0px rgba(0,0,0,0.5)'
                      }}
                    />
                  );
                }
                if (entity.type === 'text_label') {
                  return (
                    <div
                      key={entity.id}
                      className="absolute font-bold"
                      style={{ 
                        left: entity.x || 0, 
                        top: entity.y || 0,
                        color: entity.color || '#000000',
                        fontSize: entity.size ? `${entity.size}px` : '16px'
                      }}
                    >
                      {entity.text || entity.name}
                    </div>
                  );
                }
                if (entity.type === 'textbox') {
                  return (
                    <input
                      key={entity.id}
                      type="text"
                      placeholder={entity.placeholder || 'Type here...'}
                      value={entity.text || ''}
                      onChange={(e) => {
                        entity.text = e.target.value;
                        setUiState({ entities: { ...uiState.entities } });
                        handleUIEvent('writed?', entity.name, e.target.value);
                      }}
                      className="absolute px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      style={{ 
                        left: entity.x || 0, 
                        top: entity.y || 0,
                        width: entity.width || 200
                      }}
                    />
                  );
                }
                return null;
              })
            )}
          </div>
        ) : (
          <div className="w-full h-full bg-zinc-900 rounded-lg p-4 font-mono text-sm text-zinc-300 overflow-y-auto">
            {output.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}
