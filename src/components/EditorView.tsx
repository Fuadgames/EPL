import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { db, auth, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection } from 'firebase/firestore';
import { EPLInterpreter } from '../lib/epl-interpreter';
import { EPL_DICTIONARY } from '../lib/epl-dictionary';
import { Play, StopCircle, UploadCloud, Save, Terminal, LayoutTemplate, Code2, File, Edit, View, HelpCircle, Moon, Sun, Trash2, FileText, X, Languages, FolderOpen, Lock, Image as ImageIcon, Sparkles, Camera, Loader2, RefreshCw, Move } from 'lucide-react';
import { clsx } from 'clsx';
import { GoogleGenAI } from "@google/genai";
import VisualEditor from './VisualEditor';
import AppPreview from './AppPreview';
import AIAgent from './AIAgent';
import Tutorial from './Tutorial';
import { translations, tutorialContent } from '../lib/translations';

const DEFAULT_CODE = ``;

export default function EditorView() {
  const theme = useStore(state => state.theme);
  const user = useStore(state => state.user);
  const editingAppId = useStore(state => state.editingAppId);
  const setEditingAppId = useStore(state => state.setEditingAppId);
  const copiedAppData = useStore(state => state.copiedAppData);
  const setCopiedAppData = useStore(state => state.setCopiedAppData);
  const aiAnswerMode = useStore(state => state.aiAnswerMode);
  const aiChangesEnabled = useStore(state => state.aiChangesEnabled);
  const language = useStore(state => state.language);
  const setLanguage = useStore(state => state.setLanguage);
  const tutorialMinimized = useStore(state => state.tutorialMinimized);
  const setTutorialMinimized = useStore(state => state.setTutorialMinimized);
  const tutorialLevel = useStore(state => state.tutorialLevel);
  const tutorialStep = useStore(state => state.tutorialStep);
  const tutorialStepCompleted = useStore(state => state.tutorialStepCompleted);
  const setTutorialStepCompleted = useStore(state => state.setTutorialStepCompleted);
  const tutorialCheckRequested = useStore(state => state.tutorialCheckRequested);
  const setTutorialCheckRequested = useStore(state => state.setTutorialCheckRequested);
  const isPremium = useStore(state => state.isPremium);
  const t = translations[language];
  const [code, setCode] = useState(DEFAULT_CODE);
  const [history, setHistory] = useState<string[]>([DEFAULT_CODE]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [output, setOutput] = useState<string[]>([]);
  const [uiState, setUiState] = useState<any>({ entities: {} });
  const [isRunning, setIsRunning] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingLocally, setIsSavingLocally] = useState(false);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowCopy, setAllowCopy] = useState(true);
  const [originalAppId, setOriginalAppId] = useState<string | null>(null);
  const [originalAppName, setOriginalAppName] = useState<string | null>(null);
  const [isMobilePlayerOpen, setIsMobilePlayerOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const prevTutorialStep = useRef({ level: tutorialLevel, step: tutorialStep });

  // Reset code when tutorial step changes
  useEffect(() => {
    if (prevTutorialStep.current.level !== tutorialLevel) {
      setCode('');
    }
    prevTutorialStep.current = { level: tutorialLevel, step: tutorialStep };
  }, [tutorialLevel, tutorialStep]);

  const [isUploading, setIsUploading] = useState(false);

  const outputRef = useRef(output);
  const uiStateRef = useRef(uiState);
  const codeRef = useRef(code);

  useEffect(() => {
    outputRef.current = output;
    uiStateRef.current = uiState;
    codeRef.current = code;
  }, [output, uiState, code]);

  useEffect(() => {
    if (tutorialCheckRequested) {
      let isDone = false;
      const entities = Object.values(uiStateRef.current.entities) as any[];
      const interpreter = interpreterRef.current;
      
      const levels = tutorialContent[language];
      const step = levels[tutorialLevel].steps[tutorialStep];
      const answer = (step as any).answer;

      // Check if code matches answer (ignoring whitespace and case)
      if (answer) {
        const cleanCode = codeRef.current.replace(/\s/g, '').toLowerCase();
        const cleanAnswer = answer.replace(/\s/g, '').toLowerCase();
        if (cleanCode.includes(cleanAnswer)) isDone = true;
      }
      
      // Validation based on Level and Step (if not already done by code check)
      if (!isDone) {
        if (tutorialLevel === 0 && tutorialStep === 2) { // Level 1: Background black
        isDone = entities.some(e => e.type === 'world' && (e.background === 'black' || e.color === 'black'));
      } else if (tutorialLevel === 1 && tutorialStep === 2) { // Level 2: Wall block
        isDone = entities.some(e => e.name?.toLowerCase() === 'wall' && e.type === 'block');
      } else if (tutorialLevel === 2 && tutorialStep === 2) { // Level 3: Action button
        isDone = entities.some(e => e.name?.toLowerCase() === 'action' && e.type === 'button');
      } else if (tutorialLevel === 3 && tutorialStep === 2) { // Level 4: Hello in console
        isDone = outputRef.current.some(o => o.toLowerCase().includes('hello'));
      } else if (tutorialLevel === 4 && tutorialStep === 2) { // Level 5: Player move
        isDone = entities.some(e => e.name?.toLowerCase() === 'player' && (e.x !== 0 || e.y !== 0));
      } else if (tutorialLevel === 5 && tutorialStep === 2) { // Level 6: Health variable
        isDone = interpreter?.getVariable('Health') !== undefined;
      } else if (tutorialLevel === 6 && tutorialStep === 2) { // Level 7: Score math
        isDone = interpreter?.getVariable('Score') !== undefined;
      } else if (tutorialLevel === 7 && tutorialStep === 2) { // Level 8: Game Over
        isDone = outputRef.current.some(o => o.toLowerCase().includes('game over'));
      } else if (tutorialLevel === 8 && tutorialStep === 2) { // Level 9: Timer move
        isDone = entities.some(e => e.x !== 0 || e.y !== 0);
      } else if (tutorialLevel === 9 && tutorialStep === 2) { // Level 10: AI
        isDone = outputRef.current.length > 0;
      } else if (tutorialLevel === 10 && tutorialStep === 2) { // Level 11: Ghost sprite
        isDone = entities.some(e => e.name?.toLowerCase() === 'ghost' && e.type === 'sprite');
      } else if (tutorialLevel === 11 && tutorialStep === 2) { // Level 12: Sound
        isDone = true; // Hard to verify sound play, assume success if they tried
      } else if (tutorialLevel === 12 && tutorialStep === 2) { // Level 13: Object block
        isDone = entities.some(e => e.name?.toLowerCase() === 'coin');
      } else if (tutorialLevel === 13 && tutorialStep === 2) { // Level 14: Collision
        isDone = true; // Assume success if they set up collision
      } else if (tutorialLevel === 14 && tutorialStep === 2) { // Level 15: Player WASD
        isDone = entities.some(e => e.type === 'player');
      } else if (tutorialLevel === 15 && tutorialStep === 2) { // Level 16: Particles
        isDone = entities.some(e => e.type === 'particle');
      } else if (tutorialLevel === 16 && tutorialStep === 2) { // Level 17: Textbox
        isDone = entities.some(e => e.type === 'textbox');
      } else if (tutorialLevel === 19 && tutorialStep === 2) { // Level 20: 3Dblock
        isDone = entities.some(e => e.type === '3Dblock' && e.name?.toLowerCase() === 'box3d');
      } else if (tutorialLevel === 20 && tutorialStep === 2) { // Level 21: Text label
        isDone = entities.some(e => e.type === 'text_label' && e.name?.toLowerCase() === 'header');
      } else if (tutorialLevel === 21 && tutorialStep === 2) { // Level 22: Circle
        isDone = entities.some(e => e.type === 'circle' && e.name?.toLowerCase() === 'sun');
      } else if (tutorialLevel === 22 && tutorialStep === 2) { // Level 23: Forever loop
        isDone = entities.some(e => e.name?.toLowerCase() === 'spinner');
      } else {
        // For info/how-to steps or unmapped challenges
        isDone = true;
      }
    }

    if (isDone) {
        setTutorialStepCompleted(true);
        if (tutorialMinimized) {
          setTutorialMinimized(false);
        }
      } else {
        setOutput(prev => [...prev, language === 'ru' ? 'Задание еще не выполнено или выполнено неверно.' : 'Task not completed or incorrect.']);
      }
      
      setTutorialCheckRequested(false);
    }
  }, [tutorialCheckRequested, language, tutorialLevel, tutorialStep, tutorialMinimized, setTutorialStepCompleted, setTutorialMinimized, setOutput]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'icon' | 'banner' | 'screenshot' | 'general' = 'general') => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `apps/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      if (type === 'icon') setAppIconUrl(url);
      else if (type === 'banner') setAppBannerUrl(url);
      else if (type === 'screenshot') setAppScreenshotUrl(url);
      else {
        alert(`Image uploaded! URL: ${url}\n\nCopy this URL to use in your EPL code: image=${url}`);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
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
  const [showFileControlModal, setShowFileControlModal] = useState(false);
  const [appTitle, setAppTitle] = useState('My EPL App');
  const [appDesc, setAppDesc] = useState('A cool app written in EPL.');
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [appCategory, setAppCategory] = useState<string>('Other');
  const [supportedPlatforms, setSupportedPlatforms] = useState<string[]>(['web', 'windows', 'macos', 'linux', 'apk']);
  const [windowsUrl, setWindowsUrl] = useState('');
  const [macosUrl, setMacosUrl] = useState('');
  const [linuxUrl, setLinuxUrl] = useState('');
  const [apkUrl, setApkUrl] = useState('');
  const [appIconUrl, setAppIconUrl] = useState('');
  const [appScreenshotUrl, setAppScreenshotUrl] = useState('');
  const [appBannerUrl, setAppBannerUrl] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [unlockCode, setUnlockCode] = useState('');
  const [events, setEvents] = useState<{ id: string; title: string; description: string; imageUrl: string }[]>([]);
  const [publishTab, setPublishTab] = useState<'general' | 'events'>('general');
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
    if (copiedAppData) {
      setCode(copiedAppData.code);
      setAppTitle(`Copy of ${copiedAppData.title}`);
      setAppDesc(copiedAppData.description);
      setAppVersion('1.0.0');
      setAppCategory(copiedAppData.category || 'Other');
      setIsAiGenerated(copiedAppData.isAiGenerated || false);
      setIsPrivate(true); // Default to private when copying
      setIsLocked(false);
      setUnlockCode('');
      setAllowCopy(true);
      setOriginalAppId(copiedAppData.id);
      setOriginalAppName(copiedAppData.title);
      if (copiedAppData.supportedPlatforms) setSupportedPlatforms(copiedAppData.supportedPlatforms);
      setWindowsUrl('');
      setMacosUrl('');
      setLinuxUrl('');
      setApkUrl('');
      setCopiedAppData(null);
    } else if (editingAppId) {
      const fetchApp = async () => {
        const docRef = doc(db, 'apps', editingAppId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCode(data.code);
          setAppTitle(data.title);
          setAppDesc(data.description);
          setAppVersion(data.version);
          setAppCategory(data.category || 'Other');
          setIsAiGenerated(data.isAiGenerated || false);
          setIsPrivate(data.isPrivate || false);
          setIsLocked(data.isLocked || false);
          setUnlockCode(data.unlockCode || '');
          setAllowCopy(data.allowCopy !== false);
          setOriginalAppId(data.originalAppId || null);
          setOriginalAppName(data.originalAppName || null);
          if (data.supportedPlatforms) setSupportedPlatforms(data.supportedPlatforms);
          setWindowsUrl(data.windowsUrl || '');
          setMacosUrl(data.macosUrl || '');
          setLinuxUrl(data.linuxUrl || '');
          setApkUrl(data.apkUrl || '');
          setAppIconUrl(data.iconUrl || '');
          setAppScreenshotUrl(data.screenshotUrl || '');
          setAppBannerUrl(data.bannerUrl || '');
          setEvents(data.events || []);
        }
      };
      fetchApp();
    } else {
      setAppTitle('My EPL App');
      setAppDesc('A cool app written in EPL.');
      setAppVersion('1.0.0');
      setAppCategory('Other');
      setIsAiGenerated(false);
      setIsPrivate(false);
      setIsLocked(false);
      setUnlockCode('');
      setAllowCopy(true);
      setOriginalAppId(null);
      setOriginalAppName(null);
      setSupportedPlatforms(['web', 'windows', 'macos', 'linux', 'apk']);
      setWindowsUrl('');
      setMacosUrl('');
      setLinuxUrl('');
      setApkUrl('');
    }
  }, [editingAppId, copiedAppData]);

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

  const handleCodeGenerated = useCallback((newCode: string) => {
    setCode(newCode);
    setIsAiGenerated(true);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newCode);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

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
      
      // Tutorial Task Completion Check
      if (showTutorial && tutorialMinimized) {
        setTutorialCheckRequested(true);
      }
    } catch (e: any) {
      setOutput((prev) => [...prev, `Error: ${e.message}`]);
    } finally {
      // Don't set isRunning to false immediately if there are UI events waiting
      if (!interpreterRef.current?.hasEvents()) {
        setIsRunning(false);
        // Keep mobile player open so user can see the result
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

  const handleRestart = async () => {
    handleStop();
    setTimeout(() => {
      handleRun();
    }, 100);
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
        category: appCategory,
        supportedPlatforms,
        windowsUrl,
        macosUrl,
        linuxUrl,
        apkUrl,
        iconUrl: appIconUrl,
        screenshotUrl: appScreenshotUrl,
        bannerUrl: appBannerUrl,
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous',
        isAiGenerated,
        isPrivate,
        isLocked: isPremium ? isLocked : false,
        unlockCode: isPremium && isLocked ? unlockCode : '',
        allowCopy: isPremium ? allowCopy : true,
        originalAppId,
        originalAppName,
        events,
        updatedAt: new Date().toISOString()
      };

      if (!editingAppId) {
        appData.createdAt = new Date().toISOString();
        appData.downloads = 0;
        appData.rating = 0;
        appData.likes = 0;
        appData.dislikes = 0;
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
        category: appCategory,
        supportedPlatforms,
        windowsUrl,
        macosUrl,
        linuxUrl,
        apkUrl,
        iconUrl: appIconUrl,
        screenshotUrl: appScreenshotUrl,
        bannerUrl: appBannerUrl,
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous',
        isAiGenerated,
        isPrivate: true, // handleSaveLocally always sets to private
        isLocked: isPremium ? isLocked : false,
        unlockCode: isPremium && isLocked ? unlockCode : '',
        allowCopy: isPremium ? allowCopy : true,
        originalAppId,
        originalAppName,
        events,
        updatedAt: new Date().toISOString()
      };

      if (!editingAppId) {
        appData.createdAt = new Date().toISOString();
        appData.downloads = 0;
        appData.rating = 0;
        appData.likes = 0;
        appData.dislikes = 0;
      }

      await setDoc(doc(db, 'apps', appId), appData, { merge: true });
      setEditingAppId(appId);
      setIsPrivate(true);
      setActiveMenu(null);
      alert(language === 'ru' ? 'Проект сохранен локально в "Мои приложения".' : 'App saved locally to your account!');
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

  const handleGenerateImage = async (type: 'icon' | 'banner' | 'screenshot') => {
    setIsGeneratingImage(type);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      let prompt = "";
      
      if (type === 'icon') {
        prompt = `Create a high-quality, modern app icon for an app titled "${appTitle}". Description: ${appDesc}. Style: minimalist, vibrant colors, professional.`;
      } else if (type === 'banner') {
        prompt = `Create a stunning promotional banner for an app titled "${appTitle}". Description: ${appDesc}. Wide aspect ratio, professional design, engaging.`;
      } else if (type === 'screenshot') {
        prompt = `Create a professional screenshot of an app interface for "${appTitle}". Description: ${appDesc}. Show a clean UI with modern elements. Based on this code: ${code}`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio: type === 'banner' ? '16:9' : '1:1',
          }
        }
      });

      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (part?.inlineData) {
        const base64Data = part.inlineData.data;
        const mimeType = part.inlineData.mimeType;
        
        // Upload generated image to Firebase Storage
        const blob = await fetch(`data:${mimeType};base64,${base64Data}`).then(res => res.blob());
        const storageRef = ref(storage, `apps/${user?.uid}/${Date.now()}_generated_${type}.png`);
        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);

        if (type === 'icon') setAppIconUrl(url);
        else if (type === 'banner') setAppBannerUrl(url);
        else if (type === 'screenshot') setAppScreenshotUrl(url);
        setIsAiGenerated(true);
      } else {
        alert("Failed to generate image.");
      }
    } catch (error) {
      console.error("Error generating image:", error);
      alert("Error generating image. Please try again.");
    } finally {
      setIsGeneratingImage(null);
    }
  };

  const handleUIEvent = useCallback((eventName: string, target?: string) => {
    if (interpreterRef.current && isRunning) {
      interpreterRef.current.triggerEvent(eventName, target);
    }
  }, [isRunning]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Menu Bar */}
      <div 
        ref={menuRef}
        className={clsx(
          "flex items-center gap-1 px-2 py-1 border-b text-sm relative z-50",
          theme !== 'light' ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-zinc-100 border-zinc-200 text-zinc-700'
        )}
      >
        <div className="relative">
          <button 
            onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
            className={clsx("px-3 py-1 rounded transition-colors", activeMenu === 'file' ? 'bg-zinc-200 dark:bg-zinc-800' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800')}
          >
            {t.file}
          </button>
          {activeMenu === 'file' && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl py-1">
              <button onClick={() => { setCode(''); setEditingAppId(null); setActiveMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2">
                <FileText className="w-4 h-4" /> {t.newFile}
              </button>
              <button onClick={handleSaveAs} className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2">
                <Save className="w-4 h-4" /> {t.saveAs} (.epl)
              </button>
              <button onClick={handleLoadAs} className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2">
                <UploadCloud className="w-4 h-4" /> {t.loadAs} (.epl)
              </button>
              <button onClick={() => { 
                  if (editingAppId) handlePublish(); 
                  else setShowPublishModal(true); 
                  setActiveMenu(null); 
                }} 
                className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2"
              >
                <UploadCloud className="w-4 h-4" /> {t.publish}
              </button>
              <button 
                onClick={handleSaveLocally}
                disabled={isSavingLocally}
                className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> {isSavingLocally ? t.publishing : t.saveLocally}
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
            {t.edit}
          </button>
          {activeMenu === 'edit' && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl py-1">
              <button onClick={() => { setCode(''); setActiveMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 text-red-500">
                <Trash2 className="w-4 h-4" /> {t.clearCode}
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button 
            onClick={() => setActiveMenu(activeMenu === 'help' ? null : 'help')}
            className={clsx("px-3 py-1 rounded transition-colors", activeMenu === 'help' ? 'bg-zinc-200 dark:bg-zinc-800' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800')}
          >
            {t.help}
          </button>
          {activeMenu === 'help' && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl py-1">
              <button onClick={() => { setShowHelpModal(true); setActiveMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" /> {t.syntaxGuide}
              </button>
              <button onClick={() => { setShowTutorial(true); setActiveMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2">
                <Play className="w-4 h-4" /> {t.startTutorial}
              </button>
              <button onClick={() => { setShowTutorial(true); setActiveMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2">
                <Play className="w-4 h-4" /> {language === 'ru' ? 'Продолжить обучение' : 'Continue Tutorial'}
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button 
            onClick={() => setActiveMenu(activeMenu === 'lang' ? null : 'lang')}
            className={clsx("px-3 py-1 rounded transition-colors", activeMenu === 'lang' ? 'bg-zinc-200 dark:bg-zinc-800' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800')}
          >
            <Languages className="w-4 h-4" />
          </button>
          {activeMenu === 'lang' && (
            <div className="absolute top-full left-0 mt-1 w-32 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl py-1">
              <button onClick={() => { setLanguage('en'); setActiveMenu(null); }} className={clsx("w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800", language === 'en' && "text-emerald-500 font-bold")}>
                English
              </button>
              <button onClick={() => { setLanguage('ru'); setActiveMenu(null); }} className={clsx("w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800", language === 'ru' && "text-emerald-500 font-bold")}>
                Русский
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className={clsx(
        "flex flex-wrap items-center justify-between gap-4 px-4 sm:px-6 py-4 border-b",
        theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
      )}>
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Code2 className="w-5 h-5 text-emerald-500" />
            <span className="hidden sm:inline">EPL Editor</span>
          </h2>
          <div className="h-6 w-px bg-zinc-700/50 mx-2 hidden sm:block"></div>
          <div className="flex items-center gap-2">
            {!isRunning ? (
              <button onClick={handleRun} className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors">
                <Play className="w-4 h-4" /> {t.run}
              </button>
            ) : (
              <button onClick={handleStop} className="flex items-center gap-2 px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors">
                <StopCircle className="w-4 h-4" /> {t.stop}
              </button>
            )}
            <button 
              onClick={handleRestart} 
              className="flex items-center justify-center p-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
              title={language === 'ru' ? 'Перезагрузить' : 'Restart'}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
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
            <UploadCloud className="w-4 h-4" /> <span className="hidden sm:inline">{isUploading ? t.publishing : t.uploadFile}</span>
          </button>
          <input type="file" ref={imageInputRef} className="hidden" onChange={handleImageUpload} />
          {user && (
            <button 
              onClick={() => setShowPublishModal(true)}
              className="flex items-center gap-2 px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <UploadCloud className="w-4 h-4" /> <span className="hidden sm:inline">{t.publish}</span>
            </button>
          )}
          <button 
            onClick={() => setShowFileControlModal(true)}
            className="flex items-center gap-2 px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <FolderOpen className="w-4 h-4" /> <span className="hidden sm:inline">Image Control</span>
          </button>
        </div>
      </div>

      {/* Mobile Player Overlay */}
      {isMobilePlayerOpen && (
        <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col">
          <div className="flex justify-between items-center p-4 border-b border-zinc-800">
            <h2 className="text-lg font-bold">App Preview</h2>
            <div className="flex items-center gap-2">
              <button onClick={handleRestart} className="p-2 bg-zinc-800 text-white rounded-lg transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
              {isRunning ? (
                <button onClick={handleStop} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium">Stop</button>
              ) : (
                <button onClick={() => setIsMobilePlayerOpen(false)} className="px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm font-medium">Close</button>
              )}
            </div>
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
          theme !== 'light' ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-zinc-50'
        )}>
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <VisualEditor code={code} onChange={handleCodeChange} />
          </div>
          <AIAgent 
            onCodeGenerated={handleCodeGenerated}
            currentCode={code} 
            onSave={handleSaveLocally}
          />
        </div>

        {/* Resize Handle */}
        <div 
          className="hidden sm:block w-2 hover:w-3 bg-zinc-800 hover:bg-emerald-500 cursor-col-resize transition-all z-20"
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
            theme !== 'light' ? 'border-zinc-800' : 'border-zinc-200'
          )}>
            <div className="px-4 py-2 text-xs font-medium uppercase tracking-wider flex items-center gap-2 text-zinc-500 border-b border-zinc-800/50 z-10 bg-zinc-900/80 backdrop-blur-sm">
              <LayoutTemplate className="w-3.5 h-3.5" /> {t.appUi}
            </div>
            <div 
              className="flex-1 relative overflow-hidden"
            >
              {Object.keys(uiState.entities).length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-500 text-sm italic">
                  {t.noEntities}
                </div>
              ) : (
                <AppPreview entities={uiState.entities} handleUIEvent={handleUIEvent} />
              )}
            </div>
          </div>

          {/* Console */}
          <div className="h-64 flex flex-col bg-black/90 text-zinc-300 font-mono text-xs">
            <div className="px-4 py-2 flex items-center gap-2 border-b border-zinc-800 text-zinc-500 uppercase tracking-wider font-sans font-medium">
              <Terminal className="w-3.5 h-3.5" /> {t.console}
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              {output.length === 0 ? (
                <div className="text-zinc-600 italic">{t.ready}</div>
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
            "w-full max-w-md rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto",
            theme !== 'light' ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'
          )}>
            <h3 className="text-xl font-bold mb-4">{t.publishButton}</h3>
            <p className="text-sm text-zinc-500 mb-6">
              Publishing your app will make it publicly visible in the App Store for everyone to see and play.
            </p>
            <div className="flex gap-2 mb-4 border-b border-zinc-800">
              <button
                onClick={() => setPublishTab('general')}
                className={clsx("px-4 py-2 text-sm font-medium border-b-2 transition-colors", publishTab === 'general' ? "border-emerald-500 text-emerald-500" : "border-transparent text-zinc-400 hover:text-zinc-200")}
              >
                {language === 'ru' ? 'Общие' : 'General'}
              </button>
              <button
                onClick={() => setPublishTab('events')}
                className={clsx("px-4 py-2 text-sm font-medium border-b-2 transition-colors", publishTab === 'events' ? "border-emerald-500 text-emerald-500" : "border-transparent text-zinc-400 hover:text-zinc-200")}
              >
                {language === 'ru' ? 'События' : 'Events'}
              </button>
            </div>

            {publishTab === 'general' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-400">{t.appName}</label>
                <input
                  type="text"
                  value={appTitle}
                  onChange={(e) => setAppTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-400">{t.description}</label>
                <textarea
                  value={appDesc}
                  onChange={(e) => setAppDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors resize-none h-24"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-400">{t.version}</label>
                <input
                  type="text"
                  value={appVersion}
                  onChange={(e) => setAppVersion(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-400">Category</label>
                <select
                  value={appCategory}
                  onChange={(e) => setAppCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  {['games', 'apps', 'work', 'AI', 'Programming Language', 'Store', 'Other'].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-zinc-400">{t.supportedPlatforms}</label>
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

              {/* Image Options */}
              <div className="space-y-4 pt-4 border-t border-zinc-800">
                <h4 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> {language === 'ru' ? 'Изображения приложения' : 'App Images'}
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-zinc-500 uppercase">{language === 'ru' ? 'Иконка' : 'Icon'}</label>
                    <div className="aspect-square rounded-xl bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700 relative group">
                      {appIconUrl ? (
                        <img src={appIconUrl} alt="Icon" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-zinc-600" />
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleGenerateImage('icon')}
                            disabled={!!isGeneratingImage}
                            className="p-2 bg-emerald-500 rounded-full hover:bg-emerald-600 transition-colors disabled:opacity-50"
                            title={language === 'ru' ? 'Сгенерировать' : 'Generate'}
                          >
                            {isGeneratingImage === 'icon' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={() => document.getElementById('icon-upload-modal')?.click()}
                            className="p-2 bg-zinc-700 rounded-full hover:bg-zinc-600 transition-colors"
                            title={language === 'ru' ? 'Загрузить' : 'Upload'}
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                        </div>
                        <input 
                          id="icon-upload-modal"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, 'icon')}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-zinc-500 uppercase">{language === 'ru' ? 'Скриншот' : 'Screenshot'}</label>
                    <div className="aspect-square rounded-xl bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700 relative group">
                      {appScreenshotUrl ? (
                         <img src={appScreenshotUrl} alt="Screenshot" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-8 h-8 text-zinc-600" />
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleGenerateImage('screenshot')}
                            disabled={!!isGeneratingImage}
                            className="p-2 bg-blue-500 rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50"
                            title={language === 'ru' ? 'Сгенерировать' : 'Generate'}
                          >
                            {isGeneratingImage === 'screenshot' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={() => document.getElementById('screenshot-upload-modal')?.click()}
                            className="p-2 bg-zinc-700 rounded-full hover:bg-zinc-600 transition-colors"
                            title={language === 'ru' ? 'Загрузить' : 'Upload'}
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                        </div>
                        <input 
                          id="screenshot-upload-modal"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, 'screenshot')}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-zinc-500 uppercase">{language === 'ru' ? 'Баннер' : 'Banner'}</label>
                  <div className="aspect-video rounded-xl bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700 relative group">
                    {appBannerUrl ? (
                      <img src={appBannerUrl} alt="Banner" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-12 h-12 text-zinc-600" />
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                      <button 
                        onClick={() => handleGenerateImage('banner')}
                        disabled={!!isGeneratingImage}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        {isGeneratingImage === 'banner' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {language === 'ru' ? 'Сгенерировать' : 'Generate'}
                      </button>
                      <button 
                        onClick={() => document.getElementById('banner-upload-modal')?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-700 rounded-lg hover:bg-zinc-600 transition-colors text-sm font-medium"
                      >
                        <Camera className="w-4 h-4" />
                        {language === 'ru' ? 'Загрузить' : 'Upload'}
                      </button>
                      <input 
                        id="banner-upload-modal"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, 'banner')}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-400">{language === 'ru' ? 'Своя ссылка на иконку' : 'Custom Icon URL'}</label>
                  <input
                    type="text"
                    value={appIconUrl}
                    onChange={(e) => setAppIconUrl(e.target.value)}
                    placeholder="https://example.com/icon.png"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-400">{language === 'ru' ? 'Своя ссылка на скриншот' : 'Custom Screenshot URL'}</label>
                  <input
                    type="text"
                    value={appScreenshotUrl}
                    onChange={(e) => setAppScreenshotUrl(e.target.value)}
                    placeholder="https://example.com/screenshot.png"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-400">{language === 'ru' ? 'Своя ссылка на баннер' : 'Custom Banner URL'}</label>
                  <input
                    type="text"
                    value={appBannerUrl}
                    onChange={(e) => setAppBannerUrl(e.target.value)}
                    placeholder="https://example.com/banner.png"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                  />
                </div>
              </div>
              {supportedPlatforms.includes('windows') && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-zinc-400">Windows Download URL (.exe)</label>
                  <input
                    type="text"
                    value={windowsUrl}
                    onChange={(e) => setWindowsUrl(e.target.value)}
                    placeholder="https://example.com/app.exe"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              )}
              {supportedPlatforms.includes('macos') && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-zinc-400">MacOS Download URL (.app)</label>
                  <input
                    type="text"
                    value={macosUrl}
                    onChange={(e) => setMacosUrl(e.target.value)}
                    placeholder="https://example.com/app.dmg"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              )}
              {supportedPlatforms.includes('linux') && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-zinc-400">Linux Download URL</label>
                  <input
                    type="text"
                    value={linuxUrl}
                    onChange={(e) => setLinuxUrl(e.target.value)}
                    placeholder="https://example.com/app.tar.gz"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              )}
              {supportedPlatforms.includes('apk') && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-zinc-400">Android Download URL (.apk)</label>
                  <input
                    type="text"
                    value={apkUrl}
                    onChange={(e) => setApkUrl(e.target.value)}
                    placeholder="https://example.com/app.apk"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              )}
              <div className="pt-4 border-t border-zinc-800">
                <label className={clsx("flex items-center gap-2 mb-3", !isPremium ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
                  <input
                    type="checkbox"
                    checked={isLocked}
                    onChange={(e) => isPremium && setIsLocked(e.target.checked)}
                    disabled={!isPremium}
                    className="w-4 h-4 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500 bg-zinc-800/50"
                  />
                  <span className="text-sm font-medium text-emerald-400 flex items-center gap-2">
                    Lock App with Code (Premium Feature) {!isPremium && <Lock className="w-3 h-3" />}
                  </span>
                </label>
                <label className="flex items-center gap-2 mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500 bg-zinc-800/50"
                  />
                  <span className="text-sm font-medium text-zinc-400">
                    {language === 'ru' ? 'Приватное приложение (не отображать в магазине)' : 'Private App (don\'t show in store)'}
                  </span>
                </label>
                <label className={clsx("flex items-center gap-2 mb-3", !isPremium ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
                  <input
                    type="checkbox"
                    checked={allowCopy}
                    onChange={(e) => isPremium && setAllowCopy(e.target.checked)}
                    disabled={!isPremium}
                    className="w-4 h-4 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500 bg-zinc-800/50"
                  />
                  <span className="text-sm font-medium text-emerald-400 flex items-center gap-2">
                    {language === 'ru' ? 'Разрешить копирование проекта' : 'Allow copying project'} {!isPremium && <Lock className="w-3 h-3" />}
                  </span>
                </label>
                {(!isPremium || isLocked) && (
                  <div>
                    <input
                      type="text"
                      placeholder="Enter unlock code..."
                      value={unlockCode}
                      onChange={(e) => setUnlockCode(e.target.value)}
                      disabled={!isPremium}
                      className={clsx(
                        "w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors font-mono",
                        !isPremium && "opacity-50 cursor-not-allowed"
                      )}
                    />
                    <p className="text-xs text-zinc-500 mt-1">Users will need this code to play your app.</p>
                  </div>
                )}
              </div>
            </div>
            ) : (
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-zinc-300">{language === 'ru' ? 'События' : 'Events'}</h4>
                <div className="space-y-2">
                  {events.map((event, index) => (
                    <div key={index} className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700 flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        {event.imageUrl ? (
                          <img src={event.imageUrl} alt={event.title} className="w-12 h-12 rounded object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white truncate px-1">
                            {event.title.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 space-y-1">
                          <input
                            type="text"
                            value={event.title}
                            onChange={(e) => {
                              const newEvents = [...events];
                              newEvents[index].title = e.target.value;
                              setEvents(newEvents);
                            }}
                            className="w-full text-sm font-medium text-zinc-200 bg-transparent border-none focus:ring-0 p-0"
                          />
                          <input
                            type="text"
                            value={event.description}
                            onChange={(e) => {
                              const newEvents = [...events];
                              newEvents[index].description = e.target.value;
                              setEvents(newEvents);
                            }}
                            className="w-full text-xs text-zinc-400 bg-transparent border-none focus:ring-0 p-0"
                          />
                        </div>
                        <button onClick={() => setEvents(events.filter((_, i) => i !== index))} className="text-red-400 hover:text-red-300">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setEvents([...events, { id: Date.now().toString(), title: 'New Event', description: 'Description', imageUrl: '' }])}
                  className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors"
                >
                  {language === 'ru' ? 'Добавить событие' : 'Add Event'}
                </button>
              </div>
            )}
            <div className="flex items-center justify-end gap-3 mt-8">
              <button
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handlePublish}
                disabled={isPublishing}
                className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isPublishing ? t.publishing : t.publishButton}
              </button>
            </div>
          </div>
        </div>
      )}
      {showFileControlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={clsx(
            "w-full max-w-2xl rounded-2xl p-6 shadow-2xl max-h-[80vh] flex flex-col",
            theme !== 'light' ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'
          )}>
            <h3 className="text-xl font-bold mb-4">Image Control</h3>
            <p className="text-sm text-zinc-500 mb-4">Manage your uploaded files here. Click to copy URL.</p>
            <div className="flex-1 overflow-y-auto space-y-2 border border-zinc-800 rounded-lg p-2">
              <div className="p-4 text-center text-zinc-500">No files uploaded yet.</div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowFileControlModal(false)} className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
      {/* Help Modal */}
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={clsx(
            "w-full max-w-2xl rounded-2xl p-6 shadow-2xl max-h-[80vh] flex flex-col",
            theme !== 'light' ? 'bg-zinc-900 border border-zinc-800 text-zinc-200' : 'bg-white border border-zinc-200 text-zinc-800'
          )}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-500" />
                {t.syntaxGuide}
              </h3>
              <button onClick={() => setShowHelpModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {/* Tutorial Section */}
              <section>
                <h4 className="font-bold text-emerald-500 mb-2 border-b border-zinc-800 pb-1">{t.gettingStarted}</h4>
                <p className="text-sm text-zinc-400 mb-2">EPL is a simple event-driven language. Here is how to build your first app:</p>
                <ol className="list-decimal pl-5 text-sm space-y-1 text-zinc-300">
                  <li>Define what happens when the app starts using <code>started?</code>.</li>
                  <li>Use <code>create</code> to add entities like <code>sprite</code> or <code>button</code>.</li>
                  <li>Use events like <code>clicked?</code> to make your app interactive.</li>
                  <li>Always end your blocks with <code>end</code>.</li>
                </ol>
                <button 
                  onClick={() => { setShowTutorial(true); setShowHelpModal(false); }}
                  className="mt-4 w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium transition-colors border border-emerald-500/20 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" /> {t.launchTutorial}
                </button>
              </section>

              {/* Common Patterns Section */}
              <section>
                <h4 className="font-bold text-emerald-500 mb-2 border-b border-zinc-800 pb-1">{t.commonPatterns}</h4>
                <div className="space-y-4">
                  <div className="bg-zinc-800/30 p-3 rounded-xl border border-zinc-800/50">
                    <h5 className="text-sm font-bold text-zinc-200 mb-1">Click to Move</h5>
                    <pre className="text-[11px] text-zinc-400 bg-black/30 p-2 rounded overflow-x-auto">
{`clicked?{target=MyBtn}
  move{target=Player, x=+10}
end`}
                    </pre>
                  </div>
                  <div className="bg-zinc-800/30 p-3 rounded-xl border border-zinc-800/50">
                    <h5 className="text-sm font-bold text-zinc-200 mb-1">Score System</h5>
                    <pre className="text-[11px] text-zinc-400 bg-black/30 p-2 rounded overflow-x-auto">
{`started?
  variable{name=Score, value=0}
end

clicked?{target=Enemy}
  math{target=Score, op=add, value=1}
  type{text=Score}
end`}
                    </pre>
                  </div>
                  <div className="bg-zinc-800/30 p-3 rounded-xl border border-zinc-800/50">
                    <h5 className="text-sm font-bold text-zinc-200 mb-1">Collision & Health</h5>
                    <pre className="text-[11px] text-zinc-400 bg-black/30 p-2 rounded overflow-x-auto">
{`collided?{target=Player}
  math{target=Health, op=subtract, value=10}
  if
    compare{a=Health, op="<=", b=0}
    type{text="Game Over"}
    stop
  end
end`}
                    </pre>
                  </div>
                </div>
              </section>

              {/* Components Section */}
              <section>
                <h4 className="font-bold text-emerald-500 mb-2 border-b border-zinc-800 pb-1">{t.allComponents}</h4>
                <div className="space-y-3">
                  {Object.entries(EPL_DICTIONARY).filter(([_, def]) => def.type === 'entity').map(([name, def]) => (
                    <div key={name} className="bg-zinc-800/50 p-3 rounded-xl border border-zinc-800/50">
                      <div className="flex items-center justify-between mb-1">
                        <code className="text-emerald-400 font-bold text-base">{name}</code>
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Entity</span>
                      </div>
                      <p className="text-sm text-zinc-300 mb-2">{def.description}</p>
                      {def.schema && (
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(def.schema).map(([prop, type]) => (
                            <span key={prop} className="px-1.5 py-0.5 bg-zinc-900 rounded text-[10px] font-mono text-zinc-400 border border-zinc-800">
                              {prop}: <span className="text-blue-400">{type}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Syntax Guide Section */}
              <section>
                <h4 className="font-bold text-emerald-500 mb-2 border-b border-zinc-800 pb-1">{t.syntaxReference}</h4>
                <div className="space-y-4">
                  <div>
                    <h5 className="font-semibold text-zinc-300 mb-2">Control Flow</h5>
                    <div className="space-y-2">
                      {Object.entries(EPL_DICTIONARY).filter(([_, def]) => def.type === 'control').map(([name, def]) => (
                        <div key={name} className="text-sm">
                          <code className="text-purple-400 font-bold">{name}</code>
                          <span className="text-zinc-500 ml-2">— {def.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h5 className="font-semibold text-zinc-300 mb-2">Events</h5>
                    <div className="space-y-2">
                      {Object.entries(EPL_DICTIONARY).filter(([_, def]) => def.type === 'event').map(([name, def]) => (
                        <div key={name} className="text-sm">
                          <code className="text-orange-400 font-bold">{name}</code>
                          <span className="text-zinc-500 ml-2">— {def.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h5 className="font-semibold text-zinc-300 mb-2">Actions</h5>
                    <div className="space-y-2">
                      {Object.entries(EPL_DICTIONARY).filter(([_, def]) => def.type === 'action').map(([name, def]) => (
                        <div key={name} className="text-sm">
                          <code className="text-blue-400 font-bold">{name}</code>
                          <span className="text-zinc-500 ml-2">— {def.description}</span>
                        </div>
                      ))}
                    </div>
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
