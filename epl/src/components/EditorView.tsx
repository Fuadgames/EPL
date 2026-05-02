import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { db, auth, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { EPLInterpreter } from '../lib/epl-interpreter';
import { EPL_DICTIONARY } from '../lib/epl-dictionary';
import { Play, StopCircle, UploadCloud, Save, Terminal, LayoutTemplate, Code2, File, Edit, View, HelpCircle, Moon, Sun, Trash2, FileText, X, Languages, FolderOpen, Lock, Image as ImageIcon, Sparkles, Camera, Loader2, RefreshCw, Move, FileCode, Copy, Link as LinkIcon, Upload, Maximize, Minimize, Users, Package, Undo2, Redo2 } from 'lucide-react';
import { clsx } from 'clsx';
import { GoogleGenAI } from "@google/genai";
import VisualEditor from './VisualEditor';
import AppPreview from './AppPreview';
import AIAgent from './AIAgent';
import Tutorial from './Tutorial';
import CollabModal from './CollabModal';
import InventoryModal from './InventoryModal';
import { translations, tutorialContent } from '../lib/translations';
const PreviewEditor = React.lazy(() => import('./PreviewEditor'));

const DEFAULT_CODE = ``;

export default function EditorView() {
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const user = useStore(state => state.user);
  const userData = useStore(state => state.userData);
  const setUserData = useStore(state => state.setUserData);
  const editingAppId = useStore(state => state.editingAppId);
  const setEditingAppId = useStore(state => state.setEditingAppId);
  const copiedAppData = useStore(state => state.copiedAppData);
  const setCopiedAppData = useStore(state => state.setCopiedAppData);
  const aiAnswerMode = useStore(state => state.aiAnswerMode);
  const aiChangesEnabled = useStore(state => state.aiChangesEnabled);
  const language = useStore(state => state.language);
  const setLanguage = useStore(state => state.setLanguage);
  const code = useStore(state => state.code);
  const setCodeGlobal = useStore(state => state.setCode);
  const tutorialMinimized = useStore(state => state.tutorialMinimized);
  const setTutorialMinimized = useStore(state => state.setTutorialMinimized);
  const tutorialLevel = useStore(state => state.tutorialLevel);
  const tutorialStep = useStore(state => state.tutorialStep);
  const tutorialStepCompleted = useStore(state => state.tutorialStepCompleted);
  const setTutorialStepCompleted = useStore(state => state.setTutorialStepCompleted);
  const tutorialCheckRequested = useStore(state => state.tutorialCheckRequested);
  const setTutorialCheckRequested = useStore(state => state.setTutorialCheckRequested);
  const isPremium = useStore(state => state.isPremium);
  const setIsPremium = useStore(state => state.setIsPremium);
  const computerStyle = useStore(state => state.computerStyle);
  const selectedExtraCategory = useStore(state => state.selectedExtraCategory);
  const setSelectedExtraCategory = useStore(state => state.setSelectedExtraCategory);
  const previewType = useStore(state => state.previewType);
  const setPreviewType = useStore(state => state.setPreviewType);
  const unlockAchievement = useStore(state => state.unlockAchievement);
  const t = translations[language];
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
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [isMobilePlayerOpen, setIsMobilePlayerOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const prevTutorialStep = useRef({ level: tutorialLevel, step: tutorialStep });

  // Reset code when tutorial step changes
  useEffect(() => {
    if (prevTutorialStep.current.level !== tutorialLevel) {
      setCodeGlobal('');
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
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'icon' | 'banner' | 'screenshot' | 'general' = 'general') => {
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
        // Update uploadedFiles in Firestore
        const userRef = doc(db, 'users', user.uid);
        const newFile = { name: file.name, url: url };
        const updatedFiles = [...(userData?.uploadedFiles || []), newFile];
        await updateDoc(userRef, { uploadedFiles: updatedFiles });
        setUserData({ ...userData!, uploadedFiles: updatedFiles });
        alert(`${translations[language].uploadSuccess}\n\n${translations[language].copyUrl} ${url}\n\n${language === 'en' ? 'Or use the file name directly in your code: image=' : 'Или используйте имя файла прямо в коде: image='}${file.name}`);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert(translations[language].uploadFailed);
    } finally {
      setIsUploading(false);
    }
  };
  
  // Menu State
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [showExtraCategoryModal, setShowExtraCategoryModal] = useState(false);

  const handleNewFile = () => {
    setShowExtraCategoryModal(true);
    setActiveMenu(null);
  };

  useEffect(() => {
    if (selectedExtraCategory === null) {
      setShowExtraCategoryModal(true);
    }
  }, []);

  const [showPreviewTypeModal, setShowPreviewTypeModal] = useState(false);

  const confirmNewFile = (category: 'Normal' | 'OS' | 'Asset' | 'PreviewEditing') => {
    setCodeGlobal('');
    setEditingAppId(null);
    setSelectedExtraCategory(category);
    setShowExtraCategoryModal(false);
    
    if (category === 'Asset') {
      setUiState({
        entities: {
          'world': { id: 'world', type: 'world', name: 'world', background: '#09090b' },
          // Sidebar
          'sidebar': { id: 'sidebar', type: 'block', name: 'sidebar', x: 0, y: 0, width: 256, height: 600, color: '#18181b' },
          'title': { id: 'title', type: 'text_label', name: 'Title', text: 'EPL Studio', x: 20, y: 30, color: '#10b981', size: 24 },
          'subtitle': { id: 'subtitle', type: 'text_label', name: 'Subtitle', text: 'Easy Programming Language', x: 20, y: 60, color: '#a1a1aa', size: 12 },
          'nav_store': { id: 'nav_store', type: 'button', name: 'Store', text: 'Store', x: 20, y: 100, color: '#27272a', width: 216 },
          'nav_editor': { id: 'nav_editor', type: 'button', name: 'Editor', text: 'Editor', x: 20, y: 140, color: '#27272a', width: 216 },
          'nav_myapps': { id: 'nav_myapps', type: 'button', name: 'MyApps', text: 'My Apps', x: 20, y: 180, color: '#27272a', width: 216 },
          'nav_asset': { id: 'nav_asset', type: 'button', name: 'AssetStore', text: 'Asset Store', x: 20, y: 220, color: '#27272a', width: 216 },
          'fullscreen_button': { id: 'fullscreen_button', type: 'button', name: 'FullScreen', text: 'Full Screen', x: 20, y: 260, color: '#3b82f6', width: 216 },
          // Main Content
          'main': { id: 'main', type: 'block', name: 'main', x: 256, y: 0, width: 544, height: 600, color: '#09090b' },
          'toolbar': { id: 'toolbar', type: 'block', name: 'toolbar', x: 256, y: 0, width: 544, height: 50, color: '#18181b' },
          'run_button': { id: 'run_button', type: 'button', name: 'RunButton', text: 'Run', x: 270, y: 10, color: '#10b981', width: 80 },
          'main_title': { id: 'main_title', type: 'text_label', name: 'MainTitle', text: 'Welcome to EPL Studio', x: 276, y: 80, color: '#ffffff', size: 20 },
          'main_desc': { id: 'main_desc', type: 'text_label', name: 'MainDesc', text: 'Start building your app by adding assets.', x: 276, y: 110, color: '#a1a1aa', size: 14 }
        }
      });
    }
  };

  const handleBuyStoreItem = async (itemId: string, price: number) => {
    if (!user || !userData) return;
    if (userData.eplCoins < price) {
      alert("Not enough EPLCoins!");
      return;
    }

    try {
      const userRef = doc(db, 'users', user.uid);
      const newCoins = userData.eplCoins - price;
      const newPurchasedItems = [...(userData.purchasedItems || []), itemId];
      
      await updateDoc(userRef, {
        eplCoins: newCoins,
        purchasedItems: newPurchasedItems
      });

      setUserData({
        ...userData,
        eplCoins: newCoins,
        purchasedItems: newPurchasedItems
      });

      if (itemId === 'premium') {
        setIsPremium(true);
      } else if (itemId === 'template_rpg') {
        setCodeGlobal(`started?\n  create{type=world, background=black}\n  create{type=player, x=100, y=100, color=blue}\n  create{type=text_label, text="RPG Template", x=10, y=10, color=white}\nend`);
        setShowEditorStoreModal(false);
      } else if (itemId === 'template_platformer') {
        setCodeGlobal(`started?\n  create{type=world, background=skyblue}\n  create{type=player, x=50, y=300, color=red}\n  create{type=block, name=ground, x=0, y=350, width=800, height=50, color=green}\nend`);
        setShowEditorStoreModal(false);
      }

      alert(`Successfully purchased ${itemId}!`);
    } catch (error) {
      console.error("Error purchasing item:", error);
      alert("Failed to purchase item.");
    }
  };

  // Publish Modal State
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showFileControlModal, setShowFileControlModal] = useState(false);
  const [showEditorStoreModal, setShowEditorStoreModal] = useState(false);
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [appTitle, setAppTitle] = useState('My EPL App');
  const [appDesc, setAppDesc] = useState('A cool app written in EPL.');
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [appCategory, setAppCategory] = useState<string>('Other');
  const [appPrice, setAppPrice] = useState<number>(0);
  const [supportedPlatforms, setSupportedPlatforms] = useState<string[]>(['web', 'windows', 'macos', 'linux', 'apk']);
  const [windowsUrl, setWindowsUrl] = useState('');
  const [macosUrl, setMacosUrl] = useState('');
  const [linuxUrl, setLinuxUrl] = useState('');
  const [apkUrl, setApkUrl] = useState('');
  const [appIconUrl, setAppIconUrl] = useState('');
  const [appBannerUrl, setAppBannerUrl] = useState('');
  const [appScreenshotUrl, setAppScreenshotUrl] = useState('');
  const [isGeneratingScreenshot, setIsGeneratingScreenshot] = useState(false);
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
    if (newWidth > 50 && newWidth < window.innerWidth - 50) {
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
      setCodeGlobal(copiedAppData.code);
      setAppTitle(`Copy of ${copiedAppData.title}`);
      setAppDesc(copiedAppData.description);
      setAppVersion('1.0.0');
      setAppCategory(copiedAppData.category || 'Other');
      setAppPrice(copiedAppData.price || 0);
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
          setCodeGlobal(data.code);
          setAppTitle(data.title);
          setAppDesc(data.description);
          setAppVersion(data.version);
          setAppCategory(data.category || 'Other');
          setAppPrice(data.price || 0);
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

          // Auto-detect PreviewEditing mode and 3D
          if (data.code && data.code.includes('// mode=3D')) {
            setPreviewType('3D');
            setSelectedExtraCategory('PreviewEditing');
          } else if (data.code && data.code.includes('// mode=2D')) {
            setPreviewType('2D');
            setSelectedExtraCategory('PreviewEditing');
          } else if (data.code && (data.code.includes('3DCamera') || data.code.includes('lava') || data.code.includes('ground'))) {
            setPreviewType('3D');
            setSelectedExtraCategory('PreviewEditing');
          } else if (data.code && (data.code.includes('block {') || data.code.includes('text_label {'))) {
            setPreviewType('2D');
            setSelectedExtraCategory('PreviewEditing');
          }
        }
      };
      fetchApp();
    } else {
      setAppTitle('My EPL App');
      setAppDesc('A cool app written in EPL.');
      setAppVersion('1.0.0');
      setAppCategory('Other');
      setAppPrice(0);
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

  const historyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const historyIndexRef = useRef(historyIndex);
  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);

  const handleCodeChange = (newCode: string) => {
    setCodeGlobal(newCode);
    
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
    }

    historyTimeoutRef.current = setTimeout(() => {
      setHistory(prevHistory => {
        const newHistory = prevHistory.slice(0, historyIndexRef.current + 1);
        // Only push if different from last history entry
        if (newHistory.length === 0 || newHistory[newHistory.length - 1] !== newCode) {
          const updatedHistory = [...newHistory, newCode];
          if (updatedHistory.length > 100) updatedHistory.shift();
          setHistoryIndex(updatedHistory.length - 1);
          return updatedHistory;
        }
        return prevHistory;
      });
    }, 500); // 500ms debounce
  };

  const handleCodeGenerated = useCallback((newCode: string) => {
    setCodeGlobal(newCode);
    setIsAiGenerated(true);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newCode);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex, setCodeGlobal]);

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCodeGlobal(history[newIndex]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCodeGlobal(history[newIndex]);
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

    if (selectedExtraCategory === 'OS') {
      // Set background to black
      setUiState({ entities: { 'world_bios': { id: 'world_bios', type: 'world', name: 'world', background: '#000000' } } });
      
      // AllBIOS simulation in UI
      setUiState(prev => ({
        entities: {
          ...prev.entities,
          'bios_text': { id: 'bios_text', type: 'text_label', name: 'bios_text', text: 'AllBIOS: Running from disk', x: 10, y: 10, color: '#FFFFFF' }
        }
      }));
      
      if (!code.trim()) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setUiState(prev => ({
          entities: {
            ...prev.entities,
            'bios_text': { ...prev.entities['bios_text'], text: 'AllBIOS: Could not start, no OS code found.', color: '#FFFFFF' }
          }
        }));
        setIsRunning(false);
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      setUiState(prev => ({
        entities: {
          ...prev.entities,
          'bios_text': { ...prev.entities['bios_text'], text: 'AllBIOS: Copying files', color: '#FFFFFF' }
        }
      }));

      await new Promise(resolve => setTimeout(resolve, 1000));
      setUiState(prev => ({
        entities: {
          ...prev.entities,
          'bios_text': { ...prev.entities['bios_text'], text: 'AllBIOS: Running Code', color: '#FFFFFF' }
        }
      }));

      await new Promise(resolve => setTimeout(resolve, 1000));
      setUiState(prev => ({
        entities: {
          ...prev.entities,
          'bios_text': { ...prev.entities['bios_text'], text: 'AllBIOS: EPL opening', color: '#FFFFFF' }
        }
      }));

      await new Promise(resolve => setTimeout(resolve, 1000));
      setUiState(prev => ({
        entities: {
          ...prev.entities,
          'bios_text': { ...prev.entities['bios_text'], text: 'AllBIOS: Loading OS', color: '#FFFFFF' }
        }
      }));
      
      // Final delay before running
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else if (selectedExtraCategory === 'Asset') {
      // EPL Studio Clone UI
      setUiState({
        entities: {
          'world': { id: 'world', type: 'world', name: 'world', background: '#09090b' },
          // Sidebar
          'sidebar': { id: 'sidebar', type: 'block', name: 'sidebar', x: 0, y: 0, width: 256, height: 600, color: '#18181b' },
          'title': { id: 'title', type: 'text_label', name: 'Title', text: 'EPL Studio', x: 20, y: 30, color: '#10b981', size: 24 },
          'nav_store': { id: 'nav_store', type: 'button', name: 'Store', text: 'Store', x: 20, y: 100, color: '#27272a', width: 216 },
          'nav_editor': { id: 'nav_editor', type: 'button', name: 'Editor', text: 'Editor', x: 20, y: 140, color: '#27272a', width: 216 },
          'nav_myapps': { id: 'nav_myapps', type: 'button', name: 'MyApps', text: 'My Apps', x: 20, y: 180, color: '#27272a', width: 216 },
          'nav_asset': { id: 'nav_asset', type: 'button', name: 'AssetStore', text: 'Asset Store', x: 20, y: 220, color: '#27272a', width: 216 },
          'fullscreen_button': { id: 'fullscreen_button', type: 'button', name: 'FullScreen', text: 'Full Screen', x: 20, y: 260, color: '#3b82f6', width: 216 },
          // Main Content
          'main': { id: 'main', type: 'block', name: 'main', x: 256, y: 0, width: 544, height: 600, color: '#09090b' },
          'toolbar': { id: 'toolbar', type: 'block', name: 'toolbar', x: 256, y: 0, width: 544, height: 50, color: '#18181b' },
          'run_button': { id: 'run_button', type: 'button', name: 'RunButton', text: 'Run', x: 270, y: 10, color: '#10b981', width: 80 },
          'main_title': { id: 'main_title', type: 'text_label', name: 'MainTitle', text: 'Welcome to EPL Studio', x: 276, y: 80, color: '#ffffff', size: 20 },
          'main_desc': { id: 'main_desc', type: 'text_label', name: 'MainDesc', text: 'Start building your app by adding assets.', x: 276, y: 110, color: '#a1a1aa', size: 14 }
        }
      });
    }
    
    interpreterRef.current = new EPLInterpreter(
      (msg) => setOutput((prev) => [...prev, msg]),
      (entities) => setUiState({ entities }),
      { answerMode: aiAnswerMode, changesEnabled: aiChangesEnabled },
      userData?.purchasedItems || [],
      isPremium,
      userData?.uploadedFiles || []
    );

    try {
      if (code.includes('create block')) {
        unlockAchievement('creative_soul');
      }
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

  const handleGenerateAiScreenshot = async () => {
    if (!isPremium && userData?.role !== 'developer') return alert("AI Screenshot is a Premium feature.");
    setIsGeneratingScreenshot(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `Generate a high-quality, professional app icon and banner for an app with the following title: "${appTitle}" and description: "${appDesc}". 
      The app is written in EPL (Easy Programming Language). 
      Here is the app code for context:
      ${code}
      
      Style: Modern, vibrant, and clean. The image should look like a professional app interface or a high-quality promotional graphic for this specific app. It should represent the functionality described in the code.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
      });

      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (part?.inlineData) {
        const base64Data = part.inlineData.data;
        const mimeType = part.inlineData.mimeType;
        const imageUrl = `data:${mimeType};base64,${base64Data}`;
        
        // Upload to Firebase Storage for persistence
        const blob = await fetch(imageUrl).then(res => res.blob());
        const storageRef = ref(storage, `apps/${user?.uid}/${Date.now()}_ai_screenshot.png`);
        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);
        
        setAppIconUrl(url);
        setAppBannerUrl(url);
        setAppScreenshotUrl(url);
        setIsAiGenerated(true);
      } else {
        alert("Failed to generate AI screenshot.");
      }
    } catch (error) {
      console.error("Error generating AI screenshot", error);
      alert("Failed to generate AI screenshot. Please try again.");
    } finally {
      setIsGeneratingScreenshot(false);
    }
  };

  const handlePublish = async () => {
    if (!user) return alert("You must be signed in to publish apps.");
    setIsPublishing(true);
    try {
      const appId = editingAppId || doc(collection(db, 'apps')).id;
      const finalPrice = isPremium ? appPrice : 0;
      const appData: any = {
        id: appId,
        title: appTitle,
        description: appDesc,
        code,
        version: appVersion,
        category: appCategory,
        price: finalPrice,
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
        comments: [],
        isVerified: false,
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
      console.log("App published successfully!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.WRITE, `apps/${editingAppId || 'new'}`);
      console.error("Error publishing app", error);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveLocally = async () => {
    if (!user) return alert("You must be signed in to save apps.");
    setIsSavingLocally(true);
    try {
      const appId = editingAppId || doc(collection(db, 'apps')).id;
      const finalPrice = isPremium ? appPrice : 0;
      const appData: any = {
        id: appId,
        title: appTitle,
        description: appDesc,
        code,
        version: appVersion,
        category: appCategory,
        price: finalPrice,
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
        comments: [],
        isVerified: false,
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
      console.log(language === 'ru' ? 'Проект сохранен локально в "Мои приложения".' : 'App saved locally to your account!');
    } catch (error) {
      console.error("Error saving app locally", error);
    } finally {
      setIsSavingLocally(false);
    }
  };

  const handleSaveAs = () => {
    const blob = new Blob([code], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = (appTitle || 'project').replace(/\s+/g, '_').toLowerCase();
    a.download = `${fileName}.epl`;
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
      setCodeGlobal(content);
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
    if (eventName === 'premium_unlocked?') {
      setIsPremium(true);
      return;
    }
    
    // Handle navigation for Asset UI clone
    if (eventName === 'clicked?') {
      if (target === 'Store') {
        useStore.getState().setCurrentView('store');
        return;
      } else if (target === 'Editor') {
        useStore.getState().setCurrentView('editor');
        return;
      } else if (target === 'MyApps') {
        useStore.getState().setCurrentView('my-apps');
        return;
      } else if (target === 'AssetStore') {
        useStore.getState().setCurrentView('asset-store');
        return;
      } else if (target === 'FullScreen') {
        setIsFullScreen(!isFullScreen);
        return;
      } else if (target === 'RunButton') {
        handleRun();
        return;
      }
    }

    if (interpreterRef.current && isRunning) {
      interpreterRef.current.triggerEvent(eventName, target);
    }
  }, [isRunning, setIsPremium, handleRun, isFullScreen, setIsFullScreen]);

  return (
    <div className={clsx("h-full flex flex-col overflow-hidden relative", isFrutigerAero && "frutiger-aero-bg", computerStyle && "computer-style")}>
      {/* Menu Bar */}
      <div 
        ref={menuRef}
        className={clsx(
          "flex items-center gap-1 px-2 py-1 border-b text-sm relative z-50 whitespace-nowrap",
          isFrutigerAero ? "frutiger-aero-glass" : theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : theme === 'gradient' ? 'bg-black/40 border-emerald-500/20 text-emerald-100 backdrop-blur-xl' : 'bg-zinc-100 border-zinc-200 text-zinc-700',
          computerStyle && "bg-transparent border-emerald-500/30 text-emerald-500"
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
            <div className={clsx("absolute top-full left-0 mt-1 w-48 border rounded-lg shadow-xl py-1 z-50", isFrutigerAero ? "frutiger-aero-glass" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800")}>
              <button onClick={handleNewFile} className={clsx("w-full text-left px-4 py-2 flex items-center gap-2", isFrutigerAero ? "hover:bg-white/50 text-blue-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}>
                <FileText className="w-4 h-4" /> {t.newFile}
              </button>
              <button onClick={handleSaveAs} className={clsx("w-full text-left px-4 py-2 flex items-center gap-2", isFrutigerAero ? "hover:bg-white/50 text-blue-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}>
                <Save className="w-4 h-4" /> {t.saveAs} (.epl)
              </button>
              <button onClick={handleLoadAs} className={clsx("w-full text-left px-4 py-2 flex items-center gap-2", isFrutigerAero ? "hover:bg-white/50 text-blue-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}>
                <UploadCloud className="w-4 h-4" /> {t.loadAs} (.epl)
              </button>
              <button onClick={() => { 
                  setShowPublishModal(true); 
                  setActiveMenu(null); 
                }} 
                className={clsx("w-full text-left px-4 py-2 flex items-center gap-2", isFrutigerAero ? "hover:bg-white/50 text-blue-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}
              >
                <UploadCloud className="w-4 h-4" /> {t.publish}
              </button>
              <button 
                onClick={handleSaveLocally}
                disabled={isSavingLocally}
                className={clsx("w-full text-left px-4 py-2 flex items-center gap-2", isFrutigerAero ? "hover:bg-white/50 text-blue-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}
              >
                <Save className="w-4 h-4" /> {isSavingLocally ? t.publishing : t.saveLocally}
              </button>
              <button onClick={() => { setShowCollabModal(true); setActiveMenu(null); }} className={clsx("w-full text-left px-4 py-2 flex items-center gap-2", isFrutigerAero ? "hover:bg-white/50 text-blue-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}>
                <Users className="w-4 h-4" /> {language === 'ru' ? 'Совместное создание' : 'Together Create'}
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
            <div className={clsx("absolute top-full left-0 mt-1 w-48 border rounded-lg shadow-xl py-1 z-50", isFrutigerAero ? "frutiger-aero-glass" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800")}>
              <button onClick={() => { setCodeGlobal(''); setActiveMenu(null); }} className={clsx("w-full text-left px-4 py-2 flex items-center gap-2 text-red-500", isFrutigerAero ? "hover:bg-white/50" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}>
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
            <div className={clsx("absolute top-full left-0 mt-1 w-48 border rounded-lg shadow-xl py-1 z-50", isFrutigerAero ? "frutiger-aero-glass" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800")}>
              <button onClick={() => { setShowHelpModal(true); setActiveMenu(null); }} className={clsx("w-full text-left px-4 py-2 flex items-center gap-2", isFrutigerAero ? "hover:bg-white/50 text-blue-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}>
                <HelpCircle className="w-4 h-4" /> {t.syntaxGuide}
              </button>
              <button onClick={() => { setShowTutorial(true); setActiveMenu(null); }} className={clsx("w-full text-left px-4 py-2 flex items-center gap-2", isFrutigerAero ? "hover:bg-white/50 text-blue-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}>
                <Play className="w-4 h-4" /> {t.startTutorial}
              </button>
              <button onClick={() => { setShowTutorial(true); setActiveMenu(null); }} className={clsx("w-full text-left px-4 py-2 flex items-center gap-2", isFrutigerAero ? "hover:bg-white/50 text-blue-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}>
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
            <div className={clsx("absolute top-full left-0 mt-1 w-32 border rounded-lg shadow-xl py-1 z-50", isFrutigerAero ? "frutiger-aero-glass" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800")}>
              <button onClick={() => { setLanguage('en'); setActiveMenu(null); }} className={clsx("w-full text-left px-4 py-2 flex items-center gap-2", isFrutigerAero ? "hover:bg-white/50 text-blue-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800", language === 'en' && "text-emerald-500 font-bold")}>
                English
              </button>
              <button onClick={() => { setLanguage('ru'); setActiveMenu(null); }} className={clsx("w-full text-left px-4 py-2 flex items-center gap-2", isFrutigerAero ? "hover:bg-white/50 text-blue-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800", language === 'ru' && "text-emerald-500 font-bold")}>
                Русский
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className={clsx(
        "flex items-center justify-between gap-4 px-4 sm:px-6 py-4 border-b overflow-x-auto no-scrollbar",
        isFrutigerAero ? "bg-white/40 border-white/50 backdrop-blur-md shadow-sm" :
        theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
      )}>
        <div className="flex items-center gap-4 min-w-max">
          <h2 className={clsx("text-xl font-bold flex items-center gap-2", isFrutigerAero ? "text-blue-900" : "")}>
            <Code2 className={clsx("w-5 h-5", isFrutigerAero ? "text-blue-600" : "text-emerald-500")} />
            <span className="hidden sm:inline">EPL Editor</span>
          </h2>
          <div className={clsx("h-6 w-px mx-2 hidden sm:block", isFrutigerAero ? "bg-blue-800/20" : "bg-zinc-700/50")}></div>
          <div className="flex items-center gap-2">
            {!isRunning ? (
              <button onClick={handleRun} className={clsx(
                "flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap",
                isFrutigerAero ? "frutiger-aero-button" : "bg-emerald-500 hover:bg-emerald-600 text-white"
              )}>
                <Play className="w-4 h-4" /> {t.run}
              </button>
            ) : (
              <button onClick={handleStop} className={clsx(
                "flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap",
                isFrutigerAero ? "bg-red-500/80 hover:bg-red-500 text-white border border-red-500/50 shadow-sm backdrop-blur-sm" : "bg-red-500 hover:bg-red-600 text-white"
              )}>
                <StopCircle className="w-4 h-4" /> {t.stop}
              </button>
            )}
            <button 
              onClick={handleRestart} 
              className={clsx(
                "flex items-center justify-center p-1.5 rounded-xl transition-colors",
                isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-800 border border-white/60 shadow-sm" : "bg-zinc-800 hover:bg-zinc-700 text-white"
              )}
              title={language === 'ru' ? 'Перезагрузить' : 'Restart'}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className={clsx("h-6 w-px mx-1", isFrutigerAero ? "bg-blue-800/10" : "bg-zinc-700/30")}></div>
            <button 
              onClick={undo}
              disabled={historyIndex <= 0}
              className={clsx(
                "flex items-center justify-center p-1.5 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-800 border border-white/60 shadow-sm" : "bg-zinc-800 hover:bg-zinc-700 text-white"
              )}
              title={language === 'ru' ? 'Отменить' : 'Undo'}
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button 
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className={clsx(
                "flex items-center justify-center p-1.5 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-800 border border-white/60 shadow-sm" : "bg-zinc-800 hover:bg-zinc-700 text-white"
              )}
              title={language === 'ru' ? 'Повторить' : 'Redo'}
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-3 min-w-max">
          <button 
            onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
            className={clsx(
              "sm:hidden px-3 py-1.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap",
              isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-800 border border-white/60 shadow-sm" : "bg-zinc-800 hover:bg-zinc-700 text-white"
            )}
          >
            {isRightPanelOpen ? 'Hide UI' : 'Show UI'}
          </button>
          <button 
            onClick={() => imageInputRef.current?.click()}
            disabled={isUploading}
            className={clsx(
              "flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap",
              isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-800 border border-white/60 shadow-sm" : "bg-zinc-800 hover:bg-zinc-700 text-white"
            )}
          >
            <UploadCloud className="w-4 h-4" /> <span className="hidden sm:inline">{isUploading ? t.publishing : t.uploadFile}</span>
          </button>
          <button 
            onClick={() => setShowInventoryModal(true)}
            className={clsx(
              "flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap",
              isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-800 border border-white/60 shadow-sm" : "bg-zinc-800 hover:bg-zinc-700 text-white"
            )}
          >
            <Package className="w-4 h-4" /> <span className="hidden sm:inline">Inventory</span>
          </button>
          <input type="file" ref={imageInputRef} className="hidden" onChange={handleFileUpload} />
          {user && (
            <button 
              onClick={() => setShowPublishModal(true)}
              className={clsx(
                "flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap",
                isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-800 border border-white/60 shadow-sm" : "bg-zinc-800 hover:bg-zinc-700 text-white"
              )}
            >
              <UploadCloud className="w-4 h-4" /> <span className="hidden sm:inline">{t.publish}</span>
            </button>
          )}
          <button 
            onClick={() => setShowEditorStoreModal(true)}
            className={clsx(
              "flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap",
              isFrutigerAero ? "frutiger-aero-button" : "bg-emerald-500 hover:bg-emerald-600 text-white"
            )}
          >
            <Sparkles className="w-4 h-4" /> <span className="hidden sm:inline">Editor Store</span>
          </button>
          <button 
            onClick={() => setShowFileControlModal(true)}
            className={clsx(
              "flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap",
              isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-800 border border-white/60 shadow-sm" : "bg-zinc-800 hover:bg-zinc-700 text-white"
            )}
          >
            <FolderOpen className="w-4 h-4" /> <span className="hidden sm:inline">File Control</span>
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
          <div className={clsx("flex-1 relative overflow-hidden", isFullScreen && "fixed inset-0 z-[100] bg-black")}>
            <AppPreview entities={uiState.entities} handleUIEvent={handleUIEvent} />
          </div>
        </div>
      )}

      {/* Main Editor Area */}
      {selectedExtraCategory === 'PreviewEditing' ? (
        <React.Suspense fallback={<div className="flex-1 flex justify-center items-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>}>
          <PreviewEditor type={previewType || '2D'} code={code} onChange={handleCodeChange} />
        </React.Suspense>
      ) : (
      <div className="flex-1 flex flex-col sm:flex-row overflow-y-auto sm:overflow-hidden">
        {!isFullScreen && (
          <>
            {/* Code Input */}
            <div className={clsx(
              "flex-1 flex flex-col sm:border-r min-h-[50vh] sm:min-h-0",
              isFrutigerAero ? "bg-white/20 border-white/30 backdrop-blur-sm" :
              theme === 'dark' ? 'border-zinc-800 bg-zinc-950' : 
              theme === 'gradient' ? 'border-emerald-500/20 bg-black/40 backdrop-blur-xl' : 'border-zinc-200 bg-white'
            )}>
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <VisualEditor code={code} onChange={handleCodeChange} entities={uiState.entities} />
              </div>
              <AIAgent 
                onCodeGenerated={handleCodeGenerated}
                currentCode={code} 
                onSave={handleSaveLocally}
              />
            </div>

            {/* Resize Handle */}
            <div 
              className={clsx(
                "hidden sm:block w-2 hover:w-3 cursor-col-resize transition-all z-20",
                isFrutigerAero ? "bg-blue-500/20 hover:bg-blue-500/50 border-x border-white/20" : "bg-zinc-800 hover:bg-emerald-500"
              )}
              onMouseDown={handleMouseDown}
            />
          </>
        )}

        {/* Right Panel: UI Preview & Console */}
        <div 
          className={clsx(
            "w-full sm:flex flex-col min-h-[50vh] sm:min-h-0 border-t sm:border-t-0",
            isFrutigerAero ? "bg-white/30 border-white/30 backdrop-blur-md" : "bg-zinc-900/20 border-zinc-800",
            !isRightPanelOpen && "hidden sm:flex",
            isFullScreen && "fixed inset-0 z-[100] w-screen h-screen border-0",
            computerStyle && "bg-transparent border-emerald-500/30"
          )}
          style={{ width: isFullScreen ? '100%' : (typeof window !== 'undefined' && window.innerWidth > 640 ? rightPanelWidth : undefined) }}
        >
          {/* UI Preview */}
          <div className={clsx(
            "flex-1 flex flex-col border-b relative",
            isFrutigerAero ? "border-white/30" :
            theme !== 'light' ? 'border-zinc-800' : 'border-zinc-200',
            isFullScreen && "border-0"
          )}>
            {!isFullScreen && (
              <div className={clsx(
                "px-4 py-2 text-xs font-medium uppercase tracking-wider flex items-center justify-between border-b z-10",
                isFrutigerAero ? "bg-white/50 border-white/30 text-blue-900 backdrop-blur-md" : "text-zinc-500 border-zinc-800/50 bg-zinc-900/80 backdrop-blur-sm"
              )}>
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="w-3.5 h-3.5" /> {selectedExtraCategory === 'OS' ? 'AllVM' : t.appUi}
                </div>
                <button onClick={() => setIsFullScreen(true)} className="p-1 rounded hover:bg-zinc-800">
                  <Maximize className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div 
              className={clsx("flex-1 relative overflow-hidden", isFullScreen && "fixed inset-0 z-[100] bg-black")}
            >
              {isFullScreen && (
                <button 
                  onClick={() => setIsFullScreen(false)} 
                  className="absolute top-4 right-4 z-[200] p-2 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur transition-all"
                >
                  <Minimize className="w-5 h-5" />
                </button>
              )}
              {Object.keys(uiState.entities).length === 0 ? (
                <div className={clsx("h-full flex items-center justify-center text-sm italic", isFrutigerAero ? "text-blue-800/60" : "text-zinc-500")}>
                  {t.noEntities}
                </div>
              ) : (
                <AppPreview entities={uiState.entities} handleUIEvent={handleUIEvent} isFullScreen={isFullScreen} />
              )}
            </div>
          </div>

          {/* Console */}
          {!isFullScreen && (
            <div className={clsx(
              "h-64 flex flex-col font-mono text-xs",
              isFrutigerAero ? "bg-black/70 text-green-400 backdrop-blur-md" : "bg-black/90 text-zinc-300",
              computerStyle && "bg-transparent text-emerald-500 border-t border-emerald-500/30"
            )}>
              <div className={clsx(
                "px-4 py-2 flex items-center gap-2 border-b uppercase tracking-wider font-sans font-medium",
                isFrutigerAero ? "border-white/20 text-green-500 bg-black/50" : "border-zinc-800 text-zinc-500",
                computerStyle && "border-emerald-500/30 text-emerald-500"
              )}>
                <Terminal className="w-3.5 h-3.5" /> {t.console}
              </div>
              <div className="flex-1 p-4 overflow-y-auto">
                {output.length === 0 ? (
                  <div className={clsx("italic", isFrutigerAero ? "text-green-700/50" : "text-zinc-600")}>{t.ready}</div>
                ) : (
                  output.map((line, i) => (
                    <div key={i} className="mb-1">{line}</div>
                  ))
                )}
                <div ref={outputEndRef} />
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Preview Type Selection Modal (2D vs 3D) */}
      {showPreviewTypeModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={clsx(
            "w-full max-w-sm rounded-2xl p-6 shadow-2xl",
            isFrutigerAero ? "bg-white/80 border border-white/50 backdrop-blur-md" :
            theme !== 'light' ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'
          )}>
            <h2 className={clsx("text-xl font-bold mb-4", isFrutigerAero ? "text-blue-900" : "")}>Select Project Type</h2>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setPreviewType('2D')}
                className={clsx(
                  "flex flex-col items-center justify-center p-6 rounded-xl border transition-colors",
                  previewType === '2D' ? "border-blue-500 bg-blue-500/10" :
                  isFrutigerAero ? "bg-white/50 border-white/60 hover:bg-white/70" : "border-zinc-700 hover:bg-zinc-800"
                )}
              >
                <div className="text-2xl font-bold mb-2">2D</div>
                <div className="text-xs text-center text-zinc-500">2D Workspace</div>
              </button>
              <button 
                onClick={() => setPreviewType('3D')}
                className={clsx(
                  "flex flex-col items-center justify-center p-6 rounded-xl border transition-colors",
                  previewType === '3D' ? "border-emerald-500 bg-emerald-500/10" :
                  isFrutigerAero ? "bg-white/50 border-white/60 hover:bg-white/70" : "border-zinc-700 hover:bg-zinc-800"
                )}
              >
                <div className="text-2xl font-bold mb-2">3D</div>
                <div className="text-xs text-center text-zinc-500">3D Workspace</div>
              </button>
            </div>
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => {
                  setShowPreviewTypeModal(false);
                  setPreviewType(null);
                  setSelectedExtraCategory('Normal');
                }}
                className={clsx(
                  "flex-1 p-3 rounded-xl transition-colors font-medium",
                  isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-900" : "bg-zinc-800 hover:bg-zinc-700 text-white"
                )}
              >
                Cancel
              </button>
              <button 
                disabled={!previewType}
                onClick={() => {
                  setShowPreviewTypeModal(false);
                  setSelectedExtraCategory('PreviewEditing');
                }}
                className={clsx(
                  "flex-1 p-3 rounded-xl transition-colors font-medium",
                  !previewType ? "opacity-50 cursor-not-allowed bg-zinc-700 text-zinc-400" :
                  "bg-emerald-600 hover:bg-emerald-500 text-white"
                )}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extra Category Modal */}
      {showExtraCategoryModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={clsx(
            "w-full max-w-md rounded-2xl p-6 shadow-2xl",
            isFrutigerAero ? "bg-white/80 border border-white/50 backdrop-blur-md" :
            theme !== 'light' ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'
          )}>
            <h2 className={clsx("text-xl font-bold mb-4", isFrutigerAero ? "text-blue-900" : "")}>Select Extra Category</h2>
            <div className="space-y-3">
              <button 
                onClick={() => confirmNewFile('Normal')}
                className={clsx(
                  "w-full text-left p-4 rounded-xl border transition-colors",
                  isFrutigerAero ? "bg-white/50 border-white/60 hover:bg-white/70 shadow-sm" : "border-zinc-700 hover:bg-zinc-800"
                )}
              >
                <div className={clsx("font-bold", isFrutigerAero ? "text-blue-900" : "")}>Normal</div>
                <div className={clsx("text-sm", isFrutigerAero ? "text-blue-800/70" : "text-zinc-500")}>Absolutely normal editor as usual</div>
              </button>
              <button 
                onClick={() => confirmNewFile('OS')}
                className={clsx(
                  "w-full text-left p-4 rounded-xl border transition-colors",
                  isFrutigerAero ? "bg-white/50 border-white/60 hover:bg-white/70 shadow-sm" : "border-zinc-700 hover:bg-zinc-800"
                )}
              >
                <div className={clsx("font-bold", isFrutigerAero ? "text-blue-900" : "")}>OS</div>
                <div className={clsx("text-sm", isFrutigerAero ? "text-blue-800/70" : "text-zinc-500")}>AllVM environment with AllBIOS and OS-specific components</div>
              </button>
              <button 
                onClick={() => confirmNewFile('Asset')}
                className={clsx(
                  "w-full text-left p-4 rounded-xl border transition-colors",
                  isFrutigerAero ? "bg-white/50 border-white/60 hover:bg-white/70 shadow-sm" : "border-zinc-700 hover:bg-zinc-800"
                )}
              >
                <div className={clsx("font-bold", isFrutigerAero ? "text-blue-900" : "")}>Asset</div>
                <div className={clsx("text-sm", isFrutigerAero ? "text-blue-800/70" : "text-zinc-500")}>EPL Asset for the Asset Store</div>
              </button>
              <button 
                onClick={() => {
                  setShowExtraCategoryModal(false);
                  setShowPreviewTypeModal(true);
                }}
                className={clsx(
                  "w-full text-left p-4 rounded-xl border transition-colors",
                  isFrutigerAero ? "bg-white/50 border-white/60 hover:bg-white/70 shadow-sm" : "border-zinc-700 hover:bg-zinc-800"
                )}
              >
                <div className={clsx("font-bold", isFrutigerAero ? "text-blue-900" : "")}>Preview Editing</div>
                <div className={clsx("text-sm", isFrutigerAero ? "text-blue-800/70" : "text-zinc-500")}>Visual 2D/3D environment for building standalone apps. EPL automatically generates optimized native binaries for all systems, downloadable directly within the workspace.</div>
              </button>
            </div>
            <button 
              onClick={() => setShowExtraCategoryModal(false)}
              className={clsx(
                "mt-6 w-full p-3 rounded-xl transition-colors font-medium",
                isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-800 border border-white/60 shadow-sm" : "bg-zinc-800 hover:bg-zinc-700"
              )}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={clsx(
            "w-full max-w-md rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto",
            isFrutigerAero ? "bg-white/80 border border-white/50 backdrop-blur-md" :
            theme !== 'light' ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'
          )}>
            <h3 className={clsx("text-xl font-bold mb-4", isFrutigerAero ? "text-blue-900" : "")}>{t.publishButton}</h3>
            <p className={clsx("text-sm mb-6", isFrutigerAero ? "text-blue-800/70" : "text-zinc-500")}>
              Publishing your app will make it publicly visible in the App Store for everyone to see and play.
            </p>
            <div className={clsx("flex gap-2 mb-4 border-b", isFrutigerAero ? "border-white/30" : "border-zinc-800")}>
              <button
                onClick={() => setPublishTab('general')}
                className={clsx("px-4 py-2 text-sm font-medium border-b-2 transition-colors", publishTab === 'general' ? (isFrutigerAero ? "border-blue-500 text-blue-600" : "border-emerald-500 text-emerald-500") : (isFrutigerAero ? "border-transparent text-blue-800/60 hover:text-blue-800" : "border-transparent text-zinc-400 hover:text-zinc-200"))}
              >
                {language === 'ru' ? 'Общие' : 'General'}
              </button>
              <button
                onClick={() => setPublishTab('events')}
                className={clsx("px-4 py-2 text-sm font-medium border-b-2 transition-colors", publishTab === 'events' ? (isFrutigerAero ? "border-blue-500 text-blue-600" : "border-emerald-500 text-emerald-500") : (isFrutigerAero ? "border-transparent text-blue-800/60 hover:text-blue-800" : "border-transparent text-zinc-400 hover:text-zinc-200"))}
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

              {/* App Assets Section */}
              <div className="space-y-4 pt-4 border-t border-zinc-800">
                <label className={clsx("block text-sm font-medium", isFrutigerAero ? "text-blue-900" : "text-zinc-400")}>
                  {language === 'ru' ? 'Ассеты приложения' : 'App Assets'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Icon */}
                  <div className={clsx("p-4 rounded-xl border", isFrutigerAero ? "bg-white/40 border-white/50" : "bg-zinc-800/50 border-zinc-700")}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider opacity-50">Icon</span>
                      <button 
                        onClick={() => imageInputRef.current?.click()}
                        className="p-1 hover:bg-zinc-700 rounded-lg transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="aspect-square rounded-lg bg-zinc-900 flex items-center justify-center overflow-hidden border border-zinc-700">
                      {appIconUrl ? (
                        <img src={appIconUrl} alt="Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <ImageIcon className="w-8 h-8 opacity-20" />
                      )}
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      ref={imageInputRef} 
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'icon')}
                    />
                  </div>

                  {/* Banner */}
                  <div className={clsx("p-4 rounded-xl border", isFrutigerAero ? "bg-white/40 border-white/50" : "bg-zinc-800/50 border-zinc-700")}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider opacity-50">Banner</span>
                      <button 
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => handleFileUpload(e as any, 'banner');
                          input.click();
                        }}
                        className="p-1 hover:bg-zinc-700 rounded-lg transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="aspect-video rounded-lg bg-zinc-900 flex items-center justify-center overflow-hidden border border-zinc-700">
                      {appBannerUrl ? (
                        <img src={appBannerUrl} alt="Banner" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <ImageIcon className="w-8 h-8 opacity-20" />
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleGenerateAiScreenshot}
                  disabled={isGeneratingScreenshot || (!isPremium && userData?.role !== 'developer')}
                  className={clsx(
                    "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all",
                    (isPremium || userData?.role === 'developer')
                      ? (isFrutigerAero ? "frutiger-aero-button" : "bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:opacity-90 shadow-lg shadow-purple-500/20")
                      : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  )}
                >
                  {isGeneratingScreenshot ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                  {language === 'ru' ? 'Сгенерировать ассеты через ИИ' : 'Generate Assets with AI'}
                  {!isPremium && userData?.role !== 'developer' && <Lock className="w-4 h-4 ml-1" />}
                </button>
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
                
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1 text-zinc-400 flex items-center gap-2">
                    {language === 'ru' ? 'Цена (в EPLCoins)' : 'Price (in EPLCoins)'}
                    {!isPremium && <Lock className="w-3 h-3 text-yellow-500" />}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={appPrice}
                    onChange={(e) => isPremium && setAppPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    disabled={!isPremium}
                    placeholder={!isPremium ? (language === 'ru' ? 'Только для Премиум' : 'Premium Only') : ''}
                    className={clsx(
                      "w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors font-mono",
                      !isPremium && "opacity-50 cursor-not-allowed"
                    )}
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    {isPremium 
                      ? (language === 'ru' ? 'Установите 0 для бесплатного доступа. Пользователи будут платить эту сумму за доступ.' : 'Set to 0 for free. Users will pay this amount to access your app.')
                      : (language === 'ru' ? 'Установка цены доступна только для Премиум пользователей.' : 'Setting a price is only available for Premium users.')
                    }
                  </p>
                </div>

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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={clsx(
            "w-full max-w-2xl rounded-2xl p-6 shadow-2xl max-h-[80vh] flex flex-col",
            isFrutigerAero ? "bg-white/80 border border-white/50 backdrop-blur-md" :
            theme !== 'light' ? 'bg-zinc-900 border border-zinc-800 text-zinc-200' : 'bg-white border border-zinc-200 text-zinc-800'
          )}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={clsx("text-xl font-bold flex items-center gap-2", isFrutigerAero ? "text-blue-900" : "")}>
                <FileCode className={clsx("w-5 h-5", isFrutigerAero ? "text-blue-600" : "text-emerald-500")} />
                {translations[language].fileControl}
              </h3>
              <button onClick={() => setShowFileControlModal(false)} className={clsx("hover:text-zinc-300", isFrutigerAero ? "text-blue-800/60 hover:text-blue-800" : "text-zinc-500")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className={clsx("text-sm mb-4", isFrutigerAero ? "text-blue-800/70" : "text-zinc-500")}>{translations[language].fileControlDesc}</p>
            
            <div className={clsx("flex-1 overflow-y-auto space-y-2 border rounded-lg p-2", isFrutigerAero ? "border-white/40 bg-white/20" : "border-zinc-800")}>
              {userData?.uploadedFiles && userData.uploadedFiles.length > 0 ? (
                userData.uploadedFiles.map((file, idx) => (
                  <div 
                    key={idx} 
                    className={clsx(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors group",
                      isFrutigerAero ? "bg-white/40 border-white/50 hover:border-blue-400/50" : "bg-zinc-800/50 border-zinc-700 hover:border-emerald-500/50"
                    )}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={clsx("w-10 h-10 rounded flex items-center justify-center flex-shrink-0", isFrutigerAero ? "bg-blue-500/20" : "bg-zinc-700")}>
                        {file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <img src={file.url} alt={file.name} className="w-full h-full object-cover rounded" referrerPolicy="no-referrer" />
                        ) : (
                          <FileCode className={clsx("w-6 h-6", isFrutigerAero ? "text-blue-600" : "text-zinc-400")} />
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <div className={clsx("text-sm font-medium truncate", isFrutigerAero ? "text-blue-900" : "text-zinc-200")}>{file.name}</div>
                        <div className={clsx("text-xs truncate", isFrutigerAero ? "text-blue-800/60" : "text-zinc-500")}>{file.url}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(file.name);
                          alert(language === 'en' ? 'File name copied!' : 'Имя файла скопировано!');
                        }}
                        className={clsx("p-2 rounded-lg transition-colors", isFrutigerAero ? "hover:bg-white/50 text-blue-800/60 hover:text-blue-600" : "hover:bg-zinc-700 text-zinc-400 hover:text-emerald-400")}
                        title={language === 'en' ? 'Copy Name' : 'Копировать имя'}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(file.url);
                          alert(language === 'en' ? 'URL copied!' : 'URL скопирован!');
                        }}
                        className={clsx("p-2 rounded-lg transition-colors", isFrutigerAero ? "hover:bg-white/50 text-blue-800/60 hover:text-blue-600" : "hover:bg-zinc-700 text-zinc-400 hover:text-emerald-400")}
                        title={language === 'en' ? 'Copy URL' : 'Копировать URL'}
                      >
                        <LinkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className={clsx("p-8 text-center flex flex-col items-center gap-3", isFrutigerAero ? "text-blue-800/50" : "text-zinc-500")}>
                  <FileCode className="w-12 h-12 opacity-20" />
                  <div>No files uploaded yet.</div>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-between items-center">
              <button
                onClick={() => imageInputRef.current?.click()}
                className={clsx(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                  isFrutigerAero ? "frutiger-aero-button" : "bg-emerald-500 hover:bg-emerald-600 text-white"
                )}
              >
                <Upload className="w-4 h-4" />
                {translations[language].uploadFile}
              </button>
              <button 
                onClick={() => setShowFileControlModal(false)} 
                className={clsx(
                  "px-4 py-2 rounded-lg transition-colors",
                  isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-800 border border-white/60 shadow-sm" : "bg-zinc-800 hover:bg-zinc-700"
                )}
              >
                {translations[language].cancel}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Editor Store Modal */}
      {showEditorStoreModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={clsx(
            "w-full max-w-3xl rounded-2xl p-6 shadow-2xl max-h-[80vh] flex flex-col",
            isFrutigerAero ? "bg-white/80 border border-white/50 backdrop-blur-md" :
            theme !== 'light' ? 'bg-zinc-900 border border-zinc-800 text-zinc-200' : 'bg-white border border-zinc-200 text-zinc-800'
          )}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={clsx("text-xl font-bold flex items-center gap-2", isFrutigerAero ? "text-blue-900" : "")}>
                <Sparkles className={clsx("w-5 h-5", isFrutigerAero ? "text-blue-500" : "text-emerald-500")} />
                Editor Store
              </h3>
              <div className="flex items-center gap-4">
                <div className={clsx("flex items-center gap-2 px-3 py-1 rounded-full border", isFrutigerAero ? "bg-white/50 border-white/60 shadow-inner" : "bg-zinc-800 border-zinc-700")}>
                  <span className={clsx("font-bold text-sm", isFrutigerAero ? "text-blue-600" : "text-yellow-400")}>EPL</span>
                  <span className={clsx("font-mono text-sm", isFrutigerAero ? "text-blue-900" : "text-zinc-200")}>{userData?.eplCoins || 0}</span>
                </div>
                <button onClick={() => setShowEditorStoreModal(false)} className={clsx("hover:text-zinc-300", isFrutigerAero ? "text-blue-800/60 hover:text-blue-800" : "text-zinc-500")}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: 'premium', title: 'Premium Access', desc: 'Unlock all premium features including app locking and copying.', price: 100, type: 'feature', icon: Sparkles },
                  { id: 'terminal', title: 'Terminal Component', desc: 'Advanced terminal UI component for your apps.', price: 20, type: 'component', icon: Terminal },
                  { id: '3d_engine', title: '3D Engine (Big File)', desc: 'Unlock 3D rendering capabilities.', price: 50, type: 'engine', icon: Code2 },
                  { id: 'physics', title: 'Physics Engine', desc: 'Advanced 2D physics for your games.', price: 40, type: 'engine', icon: Move },
                  { id: 'template_rpg', title: 'RPG Template', desc: 'A complete RPG game starter template.', price: 15, type: 'template', icon: LayoutTemplate },
                  { id: 'template_platformer', title: 'Platformer Template', desc: 'A complete platformer game starter template.', price: 15, type: 'template', icon: LayoutTemplate },
                ].map(item => {
                  const isPurchased = userData?.purchasedItems?.includes(item.id) || (item.id === 'premium' && isPremium);
                  const Icon = item.icon;
                  return (
                    <div key={item.id} className={clsx("p-4 rounded-xl border flex flex-col gap-3", isFrutigerAero ? "bg-white/40 border-white/50 shadow-sm" : "border-zinc-800 bg-zinc-800/30")}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={clsx("p-2 rounded-lg", isFrutigerAero ? "bg-blue-500/20 shadow-inner" : "bg-zinc-800")}>
                            <Icon className={clsx("w-5 h-5", isFrutigerAero ? "text-blue-600" : "text-emerald-500")} />
                          </div>
                          <div>
                            <h4 className={clsx("font-bold", isFrutigerAero ? "text-blue-900" : "")}>{item.title}</h4>
                            <span className={clsx("text-xs uppercase tracking-wider", isFrutigerAero ? "text-blue-800/60" : "text-zinc-500")}>{item.type}</span>
                          </div>
                        </div>
                        <div className={clsx("font-mono text-sm font-bold", isFrutigerAero ? "text-blue-600" : "text-yellow-400")}>{item.price} EPL</div>
                      </div>
                      <p className={clsx("text-sm flex-1", isFrutigerAero ? "text-blue-800/80" : "text-zinc-400")}>{item.desc}</p>
                      <button 
                        onClick={() => handleBuyStoreItem(item.id, item.price)}
                        disabled={isPurchased || (userData?.eplCoins || 0) < item.price}
                        className={clsx(
                          "w-full py-2 rounded-lg text-sm font-medium transition-colors",
                          isPurchased ? (isFrutigerAero ? "bg-white/50 text-blue-600 border border-white/60 cursor-not-allowed" : "bg-zinc-800 text-emerald-500 cursor-not-allowed") :
                          (userData?.eplCoins || 0) < item.price ? (isFrutigerAero ? "bg-white/30 text-blue-800/40 border border-white/40 cursor-not-allowed" : "bg-zinc-800 text-zinc-500 cursor-not-allowed") :
                          (isFrutigerAero ? "frutiger-aero-button" : "bg-emerald-500 hover:bg-emerald-600 text-white")
                        )}
                      >
                        {isPurchased ? 'Purchased' : 'Buy Now'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Help Modal */}
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}
      {showHelpModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={clsx(
            "w-full max-w-2xl rounded-2xl p-6 shadow-2xl max-h-[80vh] flex flex-col",
            isFrutigerAero ? "bg-white/80 border border-white/50 backdrop-blur-md" :
            theme !== 'light' ? 'bg-zinc-900 border border-zinc-800 text-zinc-200' : 'bg-white border border-zinc-200 text-zinc-800'
          )}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={clsx("text-xl font-bold flex items-center gap-2", isFrutigerAero ? "text-blue-900" : "")}>
                <HelpCircle className={clsx("w-5 h-5", isFrutigerAero ? "text-blue-600" : "text-emerald-500")} />
                {t.syntaxGuide}
              </h3>
              <button onClick={() => setShowHelpModal(false)} className={clsx("hover:text-zinc-300", isFrutigerAero ? "text-blue-800/60 hover:text-blue-800" : "text-zinc-500")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {/* Tutorial Section */}
              <section>
                <h4 className={clsx("font-bold mb-2 border-b pb-1", isFrutigerAero ? "text-blue-800 border-white/30" : "text-emerald-500 border-zinc-800")}>{t.gettingStarted}</h4>
                <p className={clsx("text-sm mb-2", isFrutigerAero ? "text-blue-800/70" : "text-zinc-400")}>EPL is a simple event-driven language. Here is how to build your first app:</p>
                <ol className={clsx("list-decimal pl-5 text-sm space-y-1", isFrutigerAero ? "text-blue-900/80" : "text-zinc-300")}>
                  <li>Define what happens when the app starts using <code className={clsx("px-1 rounded", isFrutigerAero ? "bg-white/50" : "bg-zinc-800")}>started?</code>.</li>
                  <li>Use <code className={clsx("px-1 rounded", isFrutigerAero ? "bg-white/50" : "bg-zinc-800")}>create</code> to add entities like <code className={clsx("px-1 rounded", isFrutigerAero ? "bg-white/50" : "bg-zinc-800")}>sprite</code> or <code className={clsx("px-1 rounded", isFrutigerAero ? "bg-white/50" : "bg-zinc-800")}>button</code>.</li>
                  <li>Use events like <code className={clsx("px-1 rounded", isFrutigerAero ? "bg-white/50" : "bg-zinc-800")}>clicked?</code> to make your app interactive.</li>
                  <li>Always end your blocks with <code className={clsx("px-1 rounded", isFrutigerAero ? "bg-white/50" : "bg-zinc-800")}>end</code>.</li>
                </ol>
                <button 
                  onClick={() => { setShowTutorial(true); setShowHelpModal(false); }}
                  className={clsx(
                    "mt-4 w-full py-2 rounded-lg text-sm font-medium transition-colors border flex items-center justify-center gap-2",
                    isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-800 border-white/60 shadow-sm" : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20"
                  )}
                >
                  <Play className="w-4 h-4" /> {t.launchTutorial}
                </button>
              </section>

              {/* Common Patterns Section */}
              <section>
                <h4 className={clsx("font-bold mb-2 border-b pb-1", isFrutigerAero ? "text-blue-800 border-white/30" : "text-emerald-500 border-zinc-800")}>{t.commonPatterns}</h4>
                <div className="space-y-4">
                  <div className={clsx("p-3 rounded-xl border", isFrutigerAero ? "bg-white/40 border-white/50 shadow-sm" : "bg-zinc-800/30 border-zinc-800/50")}>
                    <h5 className={clsx("text-sm font-bold mb-1", isFrutigerAero ? "text-blue-900" : "text-zinc-200")}>Click to Move</h5>
                    <pre className={clsx("text-[11px] p-2 rounded overflow-x-auto", isFrutigerAero ? "bg-white/60 text-blue-900 border border-white/40" : "text-zinc-400 bg-black/30")}>
{`clicked?{target=MyBtn}
  move{target=Player, x=+10}
end`}
                    </pre>
                  </div>
                  <div className={clsx("p-3 rounded-xl border", isFrutigerAero ? "bg-white/40 border-white/50 shadow-sm" : "bg-zinc-800/30 border-zinc-800/50")}>
                    <h5 className={clsx("text-sm font-bold mb-1", isFrutigerAero ? "text-blue-900" : "text-zinc-200")}>Score System</h5>
                    <pre className={clsx("text-[11px] p-2 rounded overflow-x-auto", isFrutigerAero ? "bg-white/60 text-blue-900 border border-white/40" : "text-zinc-400 bg-black/30")}>
{`started?
  variable{name=Score, value=0}
end

clicked?{target=Enemy}
  math{target=Score, op=add, value=1}
  type{text=Score}
end`}
                    </pre>
                  </div>
                  <div className={clsx("p-3 rounded-xl border", isFrutigerAero ? "bg-white/40 border-white/50 shadow-sm" : "bg-zinc-800/30 border-zinc-800/50")}>
                    <h5 className={clsx("text-sm font-bold mb-1", isFrutigerAero ? "text-blue-900" : "text-zinc-200")}>Collision & Health</h5>
                    <pre className={clsx("text-[11px] p-2 rounded overflow-x-auto", isFrutigerAero ? "bg-white/60 text-blue-900 border border-white/40" : "text-zinc-400 bg-black/30")}>
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
                <h4 className={clsx("font-bold mb-2 border-b pb-1", isFrutigerAero ? "text-blue-800 border-white/30" : "text-emerald-500 border-zinc-800")}>{t.allComponents}</h4>
                <div className="space-y-3">
                  {Object.entries(EPL_DICTIONARY).filter(([_, def]) => def.type === 'entity').map(([name, def]) => (
                    <div key={name} className={clsx("p-3 rounded-xl border", isFrutigerAero ? "bg-white/40 border-white/50 shadow-sm" : "bg-zinc-800/50 border-zinc-800/50")}>
                      <div className="flex items-center justify-between mb-1">
                        <code className={clsx("font-bold text-base", isFrutigerAero ? "text-blue-600" : "text-emerald-400")}>{name}</code>
                        <span className={clsx("text-[10px] uppercase tracking-wider font-bold", isFrutigerAero ? "text-blue-800/60" : "text-zinc-500")}>Entity</span>
                      </div>
                      <p className={clsx("text-sm mb-2", isFrutigerAero ? "text-blue-900/80" : "text-zinc-300")}>{def.description}</p>
                      {def.schema && (
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(def.schema).map(([prop, type]) => (
                            <span key={prop} className={clsx("px-1.5 py-0.5 rounded text-[10px] font-mono border", isFrutigerAero ? "bg-white/50 border-white/40 text-blue-800/70" : "bg-zinc-900 text-zinc-400 border-zinc-800")}>
                              {prop}: <span className={clsx(isFrutigerAero ? "text-blue-600" : "text-blue-400")}>{type}</span>
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
                <h4 className={clsx("font-bold mb-2 border-b pb-1", isFrutigerAero ? "text-blue-800 border-white/30" : "text-emerald-500 border-zinc-800")}>{t.syntaxReference}</h4>
                <div className="space-y-4">
                  <div>
                    <h5 className={clsx("font-semibold mb-2", isFrutigerAero ? "text-blue-900" : "text-zinc-300")}>Control Flow</h5>
                    <div className="space-y-2">
                      {Object.entries(EPL_DICTIONARY).filter(([_, def]) => def.type === 'control').map(([name, def]) => (
                        <div key={name} className="text-sm">
                          <code className={clsx("font-bold", isFrutigerAero ? "text-purple-600" : "text-purple-400")}>{name}</code>
                          <span className={clsx("ml-2", isFrutigerAero ? "text-blue-800/60" : "text-zinc-500")}>— {def.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h5 className={clsx("font-semibold mb-2", isFrutigerAero ? "text-blue-900" : "text-zinc-300")}>Events</h5>
                    <div className="space-y-2">
                      {Object.entries(EPL_DICTIONARY).filter(([_, def]) => def.type === 'event').map(([name, def]) => (
                        <div key={name} className="text-sm">
                          <code className={clsx("font-bold", isFrutigerAero ? "text-orange-600" : "text-orange-400")}>{name}</code>
                          <span className={clsx("ml-2", isFrutigerAero ? "text-blue-800/60" : "text-zinc-500")}>— {def.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h5 className={clsx("font-semibold mb-2", isFrutigerAero ? "text-blue-900" : "text-zinc-300")}>Actions</h5>
                    <div className="space-y-2">
                      {Object.entries(EPL_DICTIONARY).filter(([_, def]) => def.type === 'action').map(([name, def]) => (
                        <div key={name} className="text-sm">
                          <code className={clsx("font-bold", isFrutigerAero ? "text-blue-600" : "text-blue-400")}>{name}</code>
                          <span className={clsx("ml-2", isFrutigerAero ? "text-blue-800/60" : "text-zinc-500")}>— {def.description}</span>
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

      {showInventoryModal && (
        <InventoryModal onClose={() => setShowInventoryModal(false)} />
      )}
      <CollabModal
        isOpen={showCollabModal}
        onClose={() => setShowCollabModal(false)}
        currentCode={code}
        onCodeChange={handleCodeChange}
        appTitle={appTitle}
        appId={editingAppId}
        onTriggerTest={() => handleRun()}
      />
    </div>
  );
}
