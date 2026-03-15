import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { db, auth, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection } from 'firebase/firestore';
import { EPLInterpreter } from '../lib/epl-interpreter';
import { EPL_DICTIONARY } from '../lib/epl-dictionary';
import { Play, StopCircle, UploadCloud, Save, Terminal, LayoutTemplate, Code2, File, Edit, View, HelpCircle, Moon, Sun, Trash2, FileText, X } from 'lucide-react';
import { clsx } from 'clsx';
import VisualEditor from './VisualEditor';
import AppPreview from './AppPreview';
import AIAgent from './AIAgent';

const DEFAULT_CODE = ``;

export default function EditorView() {
  const { theme, user, editingAppId, setEditingAppId, aiAnswerMode, aiChangesEnabled } = useStore();
  const [code, setCode] = useState(DEFAULT_CODE);
  const [history, setHistory] = useState<string[]>([DEFAULT_CODE]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [output, setOutput] = useState<string[]>([]);
  const [uiState, setUiState] = useState<any>({ entities: {} });
  const [isRunning, setIsRunning] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingLocally, setIsSavingLocally] = useState(false);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [isMobilePlayerOpen, setIsMobilePlayerOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const storageRef = ref(storage, `images/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      alert(`Image uploaded! URL: ${url}\n\nCopy this URL to use in your EPL code: image=${url}`);
    } catch (error) {
      console.error("Error uploading image", error);
      alert("Failed to upload image.");
    } finally {
      setIsUploading(false);
    }
  };
  
  // Menu State
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Publish Modal State
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [appTitle, setAppTitle] = useState('My EPL App');
  const [appDesc, setAppDesc] = useState('A cool app written in EPL.');
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [supportedPlatforms, setSupportedPlatforms] = useState<string[]>(['web', 'windows', 'macos', 'linux', 'apk']);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rightPanelWidth, setRightPanelWidth] = useState(384);
  const isResizing = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > 200 && newWidth < window.innerWidth - 300) {
      setRightPanelWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  };

  const interpreterRef = useRef<EPLInterpreter | null>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (editingAppId) {
      const fetchApp = async () => {
        const docRef = doc(db, 'apps', editingAppId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCode(data.code);
          setAppTitle(data.title);
          setAppDesc(data.description);
          setAppVersion(data.version);
          setIsAiGenerated(data.isAiGenerated || false);
          if (data.supportedPlatforms) setSupportedPlatforms(data.supportedPlatforms);
        }
      };
      fetchApp();
    } else {
      setCode(DEFAULT_CODE);
      setAppTitle('My EPL App');
      setAppDesc('A cool app written in EPL.');
      setAppVersion('1.0.0');
      setIsAiGenerated(false);
      setSupportedPlatforms(['web', 'windows', 'macos', 'linux', 'apk']);
    }
  }, [editingAppId]);

  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newCode);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCode(history[newIndex]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCode(history[newIndex]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (e.key === 'y') {
          e.preventDefault();
          redo();
        }
      }
      if (isRunning && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        handleUIEvent('key_pressed?', e.key);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, history, historyIndex]);

  const handleRun = async () => {
    if (window.innerWidth < 640) {
      setIsMobilePlayerOpen(true);
    }
    setOutput([]);
    setUiState({ entities: {} });
    setIsRunning(true);
    
    interpreterRef.current = new EPLInterpreter(
      (msg) => setOutput((prev) => [...prev, msg]),
      (entities) => setUiState({ entities }),
      { answerMode: aiAnswerMode, changesEnabled: aiChangesEnabled }
    );

    try {
      await interpreterRef.current.run(code);
    } catch (e: any) {
      setOutput((prev) => [...prev, `Error: ${e.message}`]);
    } finally {
      // Don't set isRunning to false immediately if there are UI events waiting
      if (!interpreterRef.current?.hasEvents()) {
        setIsRunning(false);
        setIsMobilePlayerOpen(false);
      }
    }
  };

  const handleStop = () => {
    if (interpreterRef.current) {
      interpreterRef.current.stop();
    }
    setIsRunning(false);
    setIsMobilePlayerOpen(false);
    setOutput((prev) => [...prev, "Program stopped."]);
  };

  const handlePublish = async () => {
    if (!user) return alert("You must be signed in to publish apps.");
    setIsPublishing(true);
    try {
      const appId = editingAppId || doc(collection(db, 'apps')).id;
      const appData: any = {
        id: appId,
        title: appTitle,
        description: appDesc,
        code,
        version: appVersion,
        supportedPlatforms,
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous',
        isAiGenerated,
        isPrivate: false,
        updatedAt: new Date().toISOString()
      };

      if (!editingAppId) {
        appData.createdAt = new Date().toISOString();
        appData.downloads = 0;
        appData.rating = 0;
      }

      await setDoc(doc(db, 'apps', appId), appData, { merge: true });
      setEditingAppId(appId);
      setShowPublishModal(false);
      alert("App published successfully!");
    } catch (error) {
      console.error("Error publishing app", error);
      alert("Failed to publish app.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveLocally = async () => {
    if (!user) return alert("You must be signed in to save apps.");
    setIsSavingLocally(true);
    try {
      const appId = editingAppId || doc(collection(db, 'apps')).id;
      const appData: any = {
        id: appId,
        title: appTitle,
        description: appDesc,
        code,
        version: appVersion,
        supportedPlatforms,
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous',
        isAiGenerated,
        isPrivate: true,
        updatedAt: new Date().toISOString()
      };

      if (!editingAppId) {
        appData.createdAt = new Date().toISOString();
        appData.downloads = 0;
        appData.rating = 0;
      }

      await setDoc(doc(db, 'apps', appId), appData, { merge: true });
      setEditingAppId(appId);
      setActiveMenu(null);
      alert("App saved locally to your account!");
    } catch (error) {
      console.error("Error saving app locally", error);
      alert("Failed to save app locally.");
    } finally {
      setIsSavingLocally(false);
    }
  };

  const handleSaveAs = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${appTitle.replace(/\s+/g, '_').toLowerCase()}.epl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setActiveMenu(null);
  };

  const handleLoadAs = () => {
    fileInputRef.current?.click();
    setActiveMenu(null);
  };

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCode(content);
      setEditingAppId(null); // Clear editing app id as it's a new file
    };
    reader.readAsText(file);
  };

  const handleUIEvent = (eventName: string, target?: string) => {
    if (interpreterRef.current && isRunning) {
      interpreterRef.current.triggerEvent(eventName, target);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Menu Bar */}
      <div 
        ref={menuRef}
        className={clsx(
          "flex items-center gap-1 px-2 py-1 border-b text-sm relative z-50",
          theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-zinc-100 border-zinc-200 text-zinc-700'
        )}
      >
        <div className="relative">
          <button 
            onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
            className={clsx("px-3 py-1 rounded transition-colors", activeMenu === 'file' ? 'bg-zinc-200 dark:bg-zinc-800' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800')}
          >
            File
          </button>
          {activeMenu === 'file' && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl py-1">
              <button onClick={() => { setCode(''); setEditingAppId(null); setActiveMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2">
                <FileText className="w-4 h-4" /> New File
              </button>
              <button onClick={handleSaveAs} className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2">
                <Save className="w-4 h-4" /> Save As (.epl)
              </button>
              <button onClick={handleLoadAs} className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2">
                <UploadCloud className="w-4 h-4" /> Load As (.epl)
              </button>
              <button onClick={() => { 
                  if (editingAppId) handlePublish(); 
                  else setShowPublishModal(true); 
                  setActiveMenu(null); 
                }} 
                className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2"
              >
                <UploadCloud className="w-4 h-4" /> Publish to Store
              </button>
              <button 
                onClick={handleSaveLocally}
                disabled={isSavingLocally}
                className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> {isSavingLocally ? 'Saving...' : 'Save Locally'}
              </button>
            </div>
          )}
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept=".epl" onChange={handleFileLoad} />

        <div className="relative">
          <button 
            onClick={() => setActiveMenu(activeMenu === 'edit' ? null : 'edit')}
            className={clsx("px-3 py-1 rounded transition-colors", activeMenu === 'edit' ? 'bg-zinc-200 dark:bg-zinc-800' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800')}
          >
            Edit
          </button>
          {activeMenu === 'edit' && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl py-1">
              <button onClick={() => { setCode(''); setActiveMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 text-red-500">
                <Trash2 className="w-4 h-4" /> Clear All Code
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button 
            onClick={() => setActiveMenu(activeMenu === 'help' ? null : 'help')}
            className={clsx("px-3 py-1 rounded transition-colors", activeMenu === 'help' ? 'bg-zinc-200 dark:bg-zinc-800' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800')}
          >
            Help
          </button>
          {activeMenu === 'help' && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl py-1">
              <button onClick={() => { setShowHelpModal(true); setActiveMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" /> Syntax Guide
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className={clsx(
        "flex flex-wrap items-center justify-between gap-4 px-4 sm:px-6 py-4 border-b",
        theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
      )}>
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Code2 className="w-5 h-5 text-emerald-500" />
            <span className="hidden sm:inline">EPL Editor</span>
          </h2>
          <div className="h-6 w-px bg-zinc-700/50 mx-2 hidden sm:block"></div>
          {!isRunning ? (
            <button onClick={handleRun} className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors">
              <Play className="w-4 h-4" /> Run
            </button>
          ) : (
            <button onClick={handleStop} className="flex items-center gap-2 px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors">
              <StopCircle className="w-4 h-4" /> Stop
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
            className="sm:hidden px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isRightPanelOpen ? 'Hide UI' : 'Show UI'}
          </button>
          <button 
            onClick={() => imageInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <UploadCloud className="w-4 h-4" /> <span className="hidden sm:inline">{isUploading ? 'Uploading...' : 'Upload Image'}</span>
          </button>
          <input type="file" ref={imageInputRef} className="hidden" accept="image/png, image/jpeg" onChange={handleImageUpload} />
          {user && (
            <button 
              onClick={() => setShowPublishModal(true)}
              className="flex items-center gap-2 px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <UploadCloud className="w-4 h-4" /> <span className="hidden sm:inline">Publish</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Player Overlay */}
      {isMobilePlayerOpen && (
        <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col">
          <div className="flex justify-between items-center p-4 border-b border-zinc-800">
            <h2 className="text-lg font-bold">App Preview</h2>
            <button onClick={handleStop} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium">Stop</button>
          </div>
          <div className="flex-1 relative overflow-hidden">
            <AppPreview entities={uiState.entities} handleUIEvent={handleUIEvent} />
          </div>
        </div>
      )}

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col sm:flex-row overflow-y-auto sm:overflow-hidden">
        {/* Code Input */}
        <div className={clsx(
          "flex-1 flex flex-col sm:border-r min-h-[50vh] sm:min-h-0",
          theme === 'dark' ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-zinc-50'
        )}>
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <VisualEditor code={code} onChange={handleCodeChange} />
          </div>
          <AIAgent 
            onCodeGenerated={(newCode) => {
              setCode(newCode);
              setIsAiGenerated(true);
            }} 
            currentCode={code} 
          />
        </div>

        {/* Resize Handle */}
        <div 
          className="hidden sm:block w-1 hover:w-1.5 bg-zinc-800 hover:bg-emerald-500 cursor-col-resize transition-all z-20"
          onMouseDown={handleMouseDown}
        />

        {/* Right Panel: UI Preview & Console */}
        <div 
          className={clsx(
            "w-full sm:flex flex-col bg-zinc-900/20 min-h-[50vh] sm:min-h-0 border-t sm:border-t-0 border-zinc-800",
            !isRightPanelOpen && "hidden sm:flex"
          )}
          style={{ width: typeof window !== 'undefined' && window.innerWidth > 640 ? rightPanelWidth : undefined }}
        >
          {/* UI Preview */}
          <div className={clsx(
            "flex-1 flex flex-col border-b relative",
            theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'
          )}>
            <div className="px-4 py-2 text-xs font-medium uppercase tracking-wider flex items-center gap-2 text-zinc-500 border-b border-zinc-800/50 z-10 bg-zinc-900/80 backdrop-blur-sm">
              <LayoutTemplate className="w-3.5 h-3.5" /> App UI
            </div>
            <div 
              className="flex-1 relative overflow-hidden"
            >
              {Object.keys(uiState.entities).length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-500 text-sm italic">
                  No entities created yet.
                </div>
              ) : (
                <AppPreview entities={uiState.entities} handleUIEvent={handleUIEvent} />
              )}
            </div>
          </div>

          {/* Console */}
          <div className="h-64 flex flex-col bg-black/90 text-zinc-300 font-mono text-xs">
            <div className="px-4 py-2 flex items-center gap-2 border-b border-zinc-800 text-zinc-500 uppercase tracking-wider font-sans font-medium">
              <Terminal className="w-3.5 h-3.5" /> Console
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              {output.length === 0 ? (
                <div className="text-zinc-600 italic">Ready.</div>
              ) : (
                output.map((line, i) => (
                  <div key={i} className="mb-1">{line}</div>
                ))
              )}
              <div ref={outputEndRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={clsx(
            "w-full max-w-md rounded-2xl p-6 shadow-2xl",
            theme === 'dark' ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'
          )}>
            <h3 className="text-xl font-bold mb-4">Publish App</h3>
            <p className="text-sm text-zinc-500 mb-6">
              Publishing your app will make it publicly visible in the App Store for everyone to see and play.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-400">App Name</label>
                <input
                  type="text"
                  value={appTitle}
                  onChange={(e) => setAppTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-400">Description</label>
                <textarea
                  value={appDesc}
                  onChange={(e) => setAppDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors resize-none h-24"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-400">Version</label>
                <input
                  type="text"
                  value={appVersion}
                  onChange={(e) => setAppVersion(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-zinc-400">Supported Platforms</label>
                <div className="flex flex-wrap gap-3">
                  {['web', 'windows', 'macos', 'linux', 'apk'].map((platform) => (
                    <label key={platform} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={supportedPlatforms.includes(platform)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSupportedPlatforms([...supportedPlatforms, platform]);
                          } else {
                            setSupportedPlatforms(supportedPlatforms.filter(p => p !== platform));
                          }
                        }}
                        className="w-4 h-4 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500 bg-zinc-800/50"
                      />
                      <span className="text-sm capitalize text-zinc-300">{platform === 'web' ? 'Web (Online)' : platform}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-8">
              <button
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={isPublishing}
                className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isPublishing ? 'Publishing...' : 'Publish to Store'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={clsx(
            "w-full max-w-2xl rounded-2xl p-6 shadow-2xl max-h-[80vh] flex flex-col",
            theme === 'dark' ? 'bg-zinc-900 border border-zinc-800 text-zinc-200' : 'bg-white border border-zinc-200 text-zinc-800'
          )}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-500" />
                EPL Syntax Guide
              </h3>
              <button onClick={() => setShowHelpModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {/* Tutorial Section */}
              <section>
                <h4 className="font-bold text-emerald-500 mb-2 border-b border-zinc-800 pb-1">Getting Started</h4>
                <p className="text-sm text-zinc-400 mb-2">EPL is a simple event-driven language. Here is how to build your first app:</p>
                <ol className="list-decimal pl-5 text-sm space-y-1 text-zinc-300">
                  <li>Define what happens when the app starts using <code>started?</code>.</li>
                  <li>Use <code>create</code> to add entities like <code>sprite</code> or <code>button</code>.</li>
                  <li>Use events like <code>clicked?</code> to make your app interactive.</li>
                  <li>Always end your blocks with <code>end</code>.</li>
                </ol>
              </section>

              {/* Components Section */}
              <section>
                <h4 className="font-bold text-emerald-500 mb-2 border-b border-zinc-800 pb-1">All Components (Entities)</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(EPL_DICTIONARY).filter(([_, def]) => def.type === 'entity').map(([name, def]) => (
                    <div key={name} className="bg-zinc-800/50 p-2 rounded">
                      <code className="text-emerald-400 font-bold">{name}</code>
                      <div className="text-xs text-zinc-500 mt-1">
                        {def.schema && Object.keys(def.schema).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Syntax Guide Section */}
              <section>
                <h4 className="font-bold text-emerald-500 mb-2 border-b border-zinc-800 pb-1">Syntax Reference</h4>
                <div className="space-y-4">
                  <div>
                    <h5 className="font-semibold text-zinc-300">Control Flow</h5>
                    <p className="text-xs text-zinc-500">if, else, check, repeat, wait, stop</p>
                  </div>
                  <div>
                    <h5 className="font-semibold text-zinc-300">Events</h5>
                    <p className="text-xs text-zinc-500">started?, created?, clicked?, collided?, key_pressed?, writed?, timer_tick?</p>
                  </div>
                  <div>
                    <h5 className="font-semibold text-zinc-300">Actions</h5>
                    <p className="text-xs text-zinc-500">set up, background, move, create, type, destroy, hide, show, rotate, scale, play_sound, ai</p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
