import React, { useState, useEffect, useRef, useCallback, useTransition } from 'react';
import { useStore } from '../store/useStore';
import { db, auth, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, getDocs, query, where, setDoc, updateDoc, serverTimestamp, collection } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { EPLInterpreter } from '../lib/epl-interpreter';
import { EPL_DICTIONARY } from '@/src/lib/epl-dictionary';
import { Play, StopCircle, UploadCloud, Save, Terminal, LayoutTemplate, Code2, File, Edit, View, HelpCircle, Moon, Sun, Trash2, FileText, X, FolderOpen, Lock, Image as ImageIcon, Camera, Loader2, RefreshCw, Move, FileCode, Copy, Link as LinkIcon, Upload, Maximize, Minimize, Users, Package, Undo2, Redo2, Monitor, Smartphone, Eye, ShieldCheck, ShieldAlert, AlertTriangle, Layers, ChevronDown, Store, Cpu, Volume2, VolumeX, Grid, Activity, Globe, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { generateImageWithAI } from '../lib/gemini';
import { notify } from '../store/useDialogStore';
import VisualEditor from './VisualEditor';
import BlockEditor from './BlockEditor';
import AppPreview from './AppPreview';
import CustomSelect from './CustomSelect';
import AIAgent from './AIAgent';
import Tutorial from './Tutorial';
import CollabModal from './CollabModal';
import InventoryModal from './InventoryModal';
import DifrenoptConfigModal from './DifrenoptConfigModal';
import { findFirstDifrenoptInCode, upsertDifrenoptInCode } from '../lib/drpl-catalog';
import { translations, tutorialContent } from '../lib/translations';
import { hasTierAccess, resolveEffectiveTier } from '../lib/premiumTiers';
import { STARTER_EDITOR_CODE } from '../lib/demoProjects';
const PreviewEditor = React.lazy(() => import('./PreviewEditor'));

const DEFAULT_CODE = STARTER_EDITOR_CODE;

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
  const premiumTier = useStore(state => state.premiumTier);
  const effectiveTier = resolveEffectiveTier(isPremium || userData?.isPremium, userData?.premiumTier || premiumTier);
  const canPremiumPlus = hasTierAccess(effectiveTier, 'premium') || userData?.role === 'developer';
  const computerStyle = useStore(state => state.computerStyle);
  const selectedExtraCategory = useStore(state => state.selectedExtraCategory);
  const setSelectedExtraCategory = useStore(state => state.setSelectedExtraCategory);
  const previewType = useStore(state => state.previewType);
  const setPreviewType = useStore(state => state.setPreviewType);
  const unlockAchievement = useStore(state => state.unlockAchievement);
  const setCurrentView = useStore(state => state.setCurrentView);
  const livePreviewEnabled = useStore(state => state.livePreviewEnabled);
  const setLivePreviewEnabled = useStore(state => state.setLivePreviewEnabled);
  const projectFiles = useStore(state => state.projectFiles);
  const addProjectFile = useStore(state => state.addProjectFile);
  const [isPending, startTransition] = useTransition();
  const t = translations[language];
  const [history, setHistory] = useState<string[]>(() => [useStore.getState().code || DEFAULT_CODE]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [output, setOutput] = useState<string[]>([]);
  const [uiState, setUiState] = useState<{ entities: Record<string, any>; variables?: Record<string, any>; camera?: any; uiMode?: any }>({ entities: {}, variables: {}, camera: null, uiMode: null });
  const [isRunning, setIsRunning] = useState(false);
  const [runMode, setRunMode] = useState<'none' | 'pc' | 'mobile' | 'run'>('none');

  // Live Preview & Stage Controls
  const liveInterpreterRef = useRef<EPLInterpreter | null>(null);
  const [liveUiState, setLiveUiState] = useState<{ entities: Record<string, any>; variables?: Record<string, any>; camera?: any; uiMode?: any }>({ entities: {}, variables: {}, camera: null, uiMode: null });
  const [liveOutput, setLiveOutput] = useState<string[]>([]);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [showLiveConsole, setShowLiveConsole] = useState(false);
  const [showStageGrid, setShowStageGrid] = useState(false);
  const [isStageMuted, setIsStageMuted] = useState(false);
  const [showLiveVars, setShowLiveVars] = useState(false);
  const [isPhoneRotated, setIsPhoneRotated] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingLocally, setIsSavingLocally] = useState(false);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowCopy, setAllowCopy] = useState(true);
  const [originalAppId, setOriginalAppId] = useState<string | null>(null);
  const [originalAppName, setOriginalAppName] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [customEditors, setCustomEditors] = useState<any[]>([]);
  const [publishingStepText, setPublishingStepText] = useState('');
  const [moderationResult, setModerationResult] = useState<{ approved: boolean; reason: string; flags: string[]; riskScore?: number; modelUsed?: string; checkedByAI?: boolean } | null>(null);
  const [showModerationModal, setShowModerationModal] = useState(false);
  const [showDrplStudioModal, setShowDrplStudioModal] = useState(false);
  const [isPreCheckingAi, setIsPreCheckingAi] = useState(false);
  const [preCheckStatus, setPreCheckStatus] = useState<{ approved?: boolean; reason?: string; checked: boolean } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchCustomEditors = async () => {
      try {
        const { getDocs, query, collection, where } = await import('firebase/firestore');
        const q = query(collection(db, 'assets'), where('type', '==', 'editor'));
        const querySnapshot = await getDocs(q);
        const editors = querySnapshot.docs
          .map(doc => doc.data())
          .filter(data => data.authorId === user.uid || (userData?.purchasedItems || []).includes(data.id));
        setCustomEditors(editors);
      } catch (err) {
        console.error('Error fetching custom editors:', err);
      }
    };
    fetchCustomEditors();
  }, [user, userData?.purchasedItems]);
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
  const skipNextResetRef = useRef(false);

  useEffect(() => {
    outputRef.current = output;
    uiStateRef.current = uiState;
    codeRef.current = code;
  }, [output, uiState, code]);

  const setCodeSync = useCallback((nextCode: string) => {
    codeRef.current = nextCode;
    setCodeGlobal(nextCode);
  }, [setCodeGlobal]);

  const mergedProjectFiles = React.useMemo(() => {
    const map = new Map<string, { name: string; url: string; size?: number; type?: string; uploadedAt?: string }>();
    [...(userData?.uploadedFiles || []), ...(projectFiles || [])].forEach(f => {
      if (f?.name) map.set(f.name, f);
    });
    return Array.from(map.values());
  }, [userData?.uploadedFiles, projectFiles]);

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
    if (!file) return;

    setIsUploading(true);
    try {
      let url = '';

      if (user) {
        try {
          const storageRef = ref(storage, `apps/${user.uid}/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          url = await getDownloadURL(storageRef);
        } catch (storageErr) {
          console.warn('Firebase Storage upload skipped, falling back to project server storage:', storageErr);
        }
      }

      if (!url) {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

        try {
          const resp = await fetch('/api/files/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              base64Data
            })
          });
          if (resp.ok) {
            const uploaded = await resp.json();
            url = uploaded.url;
          }
        } catch (serverErr) {
          console.warn('Server upload fallback check:', serverErr);
        }

        if (!url) {
          url = base64Data;
        }
      }

      if (type === 'icon') setAppIconUrl(url);
      else if (type === 'banner') setAppBannerUrl(url);
      else if (type === 'screenshot') setAppScreenshotUrl(url);
      else {
        const newFile = {
          name: file.name,
          url,
          size: file.size,
          type: file.type || 'application/octet-stream',
          uploadedAt: new Date().toISOString()
        };
        addProjectFile(newFile);

        if (user && userData) {
          const existing = (userData.uploadedFiles || []).filter(f => f.name !== file.name);
          const updatedFiles = [{ name: file.name, url }, ...existing];
          setUserData({ ...userData, uploadedFiles: updatedFiles });
          updateDoc(doc(db, 'users', user.uid), { uploadedFiles: updatedFiles }).catch(err => {
            console.warn('Could not sync uploadedFiles to Firestore (kept locally):', err);
          });
        }

        if (interpreterRef.current?.context.isRunning) {
          interpreterRef.current.uploadedFiles = [newFile, ...interpreterRef.current.uploadedFiles.filter(f => f.name !== newFile.name)];
          interpreterRef.current.triggerEvent('file_added?', file.name);
        }
        if (liveInterpreterRef.current?.context.isRunning) {
          liveInterpreterRef.current.uploadedFiles = [newFile, ...liveInterpreterRef.current.uploadedFiles.filter(f => f.name !== newFile.name)];
          liveInterpreterRef.current.triggerEvent('file_added?', file.name);
        }

        notify.success(`${translations[language].uploadSuccess} (${file.name})`);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      notify.error(translations[language].uploadFailed);
    } finally {
      e.target.value = '';
      setIsUploading(false);
    }
  };
  
  // Menu State
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [showExtraCategoryModal, setShowExtraCategoryModal] = useState(false);
  const [extraModalAction, setExtraModalAction] = useState<'new' | 'switch'>('new');

  const handleNewFile = () => {
    setExtraModalAction('new');
    setShowExtraCategoryModal(true);
    setActiveMenu(null);
  };

  const handleSwitchFile = () => {
    setExtraModalAction('switch');
    setShowExtraCategoryModal(true);
    setActiveMenu(null);
  };

  useEffect(() => {
    if (selectedExtraCategory === null) {
      setSelectedExtraCategory('Normal');
    }
  }, []);

  const [showPreviewTypeModal, setShowPreviewTypeModal] = useState(false);

  const confirmNewFile = (category: 'Normal' | 'OS' | 'Asset' | 'PreviewEditing' | 'CustomEditor' | string) => {
    if (extraModalAction === 'new') {
      const nextStarter = '';
      setCodeSync(nextStarter);
      setEditingAppId(null);
      setHistory([nextStarter]);
      setHistoryIndex(0);
      if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
        historyTimeoutRef.current = null;
      }
    }
    setSelectedExtraCategory(category);
    setShowExtraCategoryModal(false);
    
    if (extraModalAction === 'new') {
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
      } else if (!['Normal', 'OS', 'PreviewEditing', 'CustomEditor'].includes(category)) {
        const customEditor = customEditors.find(e => e.id === category);
        if (customEditor) {
          const interpreter = new EPLInterpreter(
            (msg) => console.log(msg),
            (entities) => setUiState({ entities }),
            { answerMode: aiAnswerMode, changesEnabled: aiChangesEnabled },
            userData?.purchasedItems || [],
            isPremium,
            userData?.uploadedFiles || []
          );
          interpreter.run(customEditor.content);
        }
      } else {
        setUiState({ entities: {} });
      }
    }
  };

  const handleBuyStoreItem = async (itemId: string, price: number) => {
    if (!user || !userData) return;
    if (userData.eplCoins < price) {
      notify.error(language === 'ru' ? 'Недостаточно EPLCoins!' : 'Not enough EPLCoins!');
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

      notify.success(language === 'ru' ? `Успешно куплено: ${itemId}` : `Successfully purchased ${itemId}!`);
    } catch (error) {
      console.error("Error purchasing item:", error);
      notify.error(language === 'ru' ? 'Не удалось совершить покупку.' : 'Failed to purchase item.');
    }
  };

  // Publish Modal State
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showPublishWebsiteModal, setShowPublishWebsiteModal] = useState(false);
  const [websiteSlug, setWebsiteSlug] = useState('');
  const [hideWebsiteWatermark, setHideWebsiteWatermark] = useState(false);
  const [isPublishingWebsite, setIsPublishingWebsite] = useState(false);
  const websiteIconInputRef = useRef<HTMLInputElement>(null);
  const websiteBannerInputRef = useRef<HTMLInputElement>(null);
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

  const interpreterRef = useRef<EPLInterpreter | null>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);

  const handleStop = useCallback(() => {
    if (interpreterRef.current) {
      interpreterRef.current.stop();
    }
    setIsRunning(false);
    setRunMode('none');
    setIsMobilePlayerOpen(false);
    setOutput((prev) => [...prev, "Program stopped."]);
  }, []);

  const handleRun = useCallback(async (mode: 'pc' | 'mobile' | 'run' = 'run', overrideCode?: string) => {
    const activeCode = overrideCode !== undefined ? overrideCode : (codeRef.current || useStore.getState().code || '');
    if (window.innerWidth < 640) {
      setIsMobilePlayerOpen(true);
    } else {
      setRunMode(mode);
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
      
      if (!activeCode.trim()) {
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
      userData?.purchasedItems || [],
      isPremium,
      mergedProjectFiles
    );
    interpreterRef.current.setMuted(isStageMuted);

    try {
      if (activeCode.includes('create block')) {
        unlockAchievement('creative_soul');
      }
      await interpreterRef.current.run(activeCode);
      
      // Tutorial Task Completion Check
      if (showTutorial && tutorialMinimized) {
        setTutorialCheckRequested(true);
      }
    } catch (e: any) {
      setOutput((prev) => [...prev, `Error: ${e.message}`]);
    } finally {
      // Keep running whenever events, timers, or interactive UI widgets exist
      if (!interpreterRef.current?.hasEvents()) {
        setIsRunning(false);
      }
    }
  }, [selectedExtraCategory, aiAnswerMode, aiChangesEnabled, userData, mergedProjectFiles, isPremium, isStageMuted, showTutorial, tutorialMinimized, unlockAchievement, setTutorialCheckRequested]);

  const handleRestart = useCallback(async () => {
    handleStop();
    setTimeout(() => {
      handleRun('run', codeRef.current);
    }, 100);
  }, [handleStop, handleRun]);

  // Live Preview engine: automatically execute code as it changes in real-time
  useEffect(() => {
    if (!livePreviewEnabled) {
      if (liveInterpreterRef.current) {
        liveInterpreterRef.current.stop();
      }
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLiveError(null);
        if (liveInterpreterRef.current) {
          liveInterpreterRef.current.stop();
        }
        liveInterpreterRef.current = new EPLInterpreter(
          (msg) => {
            if (msg === '__CLEAR__') {
              setLiveOutput([]);
            } else {
              setLiveOutput(prev => [...prev.slice(-30), msg]);
            }
          },
          (entities, uiMode, meta) => setLiveUiState({
            entities,
            uiMode: uiMode || null,
            variables: meta?.variables || {},
            camera: meta?.camera || null
          }),
          { answerMode: aiAnswerMode, changesEnabled: aiChangesEnabled },
          userData?.purchasedItems || [],
          isPremium,
          mergedProjectFiles
        );
        liveInterpreterRef.current.setMuted(isStageMuted);
        await liveInterpreterRef.current.run(code);
      } catch (err: any) {
        setLiveError(err.message || 'Error running live code');
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [code, livePreviewEnabled, aiAnswerMode, aiChangesEnabled, userData?.purchasedItems, mergedProjectFiles, isPremium]);

  useEffect(() => {
    interpreterRef.current?.setMuted(isStageMuted);
    liveInterpreterRef.current?.setMuted(isStageMuted);
  }, [isStageMuted]);

  const handleLiveUIEvent = useCallback((eventName: string, target?: string, value?: string) => {
    if (eventName === 'premium_unlocked?') {
      setIsPremium(true);
      return;
    }
    if (liveInterpreterRef.current) {
      liveInterpreterRef.current.triggerEvent(eventName, target, value);
    }
  }, [setIsPremium]);

  const handleLiveRestart = useCallback(async () => {
    if (liveInterpreterRef.current) {
      liveInterpreterRef.current.stop();
    }
    setLiveUiState({ entities: {}, variables: {}, camera: null, uiMode: null });
    setLiveOutput([]);
    setLiveError(null);
    liveInterpreterRef.current = new EPLInterpreter(
      (msg) => {
        if (msg === '__CLEAR__') {
          setLiveOutput([]);
        } else {
          setLiveOutput(prev => [...prev.slice(-30), msg]);
        }
      },
      (entities, uiMode, meta) => setLiveUiState({
        entities,
        uiMode: uiMode || null,
        variables: meta?.variables || {},
        camera: meta?.camera || null
      }),
      { answerMode: aiAnswerMode, changesEnabled: aiChangesEnabled },
      userData?.purchasedItems || [],
      isPremium,
      mergedProjectFiles
    );
    liveInterpreterRef.current.setMuted(isStageMuted);
    await liveInterpreterRef.current.run(codeRef.current || code);
  }, [code, aiAnswerMode, aiChangesEnabled, userData, mergedProjectFiles, isPremium, isStageMuted]);

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
      const nextCode = copiedAppData.code || '';
      setCodeSync(nextCode);
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
      skipNextResetRef.current = true;
      setCopiedAppData(null);
      // Auto-run copied code using explicit override so closure is never stale
      setTimeout(() => handleRun('run', nextCode), 150);
    } else if (editingAppId) {
      const fetchApp = async () => {
        const docRef = doc(db, 'apps', editingAppId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const loadedCode = data.code || '';
          setCodeSync(loadedCode);
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

          // Auto-detect PreviewType but default to Normal mode for editing
          setSelectedExtraCategory('Normal');
          if (loadedCode.includes('// mode=3D')) {
            setPreviewType('3D');
          } else if (loadedCode.includes('// mode=2D')) {
            setPreviewType('2D');
          } else if (loadedCode.includes('3DCamera') || loadedCode.includes('lava') || loadedCode.includes('ground')) {
            setPreviewType('3D');
          } else if (loadedCode.includes('block {') || loadedCode.includes('text_label {')) {
            setPreviewType('2D');
          }
          // Auto-run loaded My Apps project with explicit code
          setTimeout(() => handleRun('run', loadedCode), 150);
        }
      };
      fetchApp();
    } else {
      if (skipNextResetRef.current) {
        skipNextResetRef.current = false;
        return;
      }
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
    setCodeSync(newCode);
    
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

  // Live Preview Auto-run (Disabled per user request)
  // const autoRunTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // useEffect(() => {
  //   if (autoRunTimeoutRef.current) clearTimeout(autoRunTimeoutRef.current);
  //   
  //   if (selectedExtraCategory !== 'Normal' && selectedExtraCategory !== 'Asset') return;
  //
  //   autoRunTimeoutRef.current = setTimeout(() => {
  //     if (code.trim()) {
  //       handleRun();
  //     }
  //   }, 2000);
  //
  //   return () => {
  //     if (autoRunTimeoutRef.current) clearTimeout(autoRunTimeoutRef.current);
  //   };
  // }, [code, selectedExtraCategory]);

  const handleCodeGenerated = useCallback((newCode: string) => {
    setCodeGlobal(newCode);
    setIsAiGenerated(true);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newCode);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex, setCodeGlobal]);

  const historyRef = useRef(history);
  useEffect(() => { historyRef.current = history; }, [history]);

  const undo = () => {
    // If we have a pending uncommitted change (timeout is active), then the current `code` is NOT in history yet.
    // In this case, undo should simply revert back to the last committed history state.
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
      historyTimeoutRef.current = null;
    }
    
    // Check if the current code is different from the current history item
    // If different, we just reset it to the current history state.
    if (codeRef.current !== historyRef.current[historyIndexRef.current]) {
      setCodeGlobal(historyRef.current[historyIndexRef.current]);
      return;
    }

    if (historyIndexRef.current > 0) {
      const newIndex = historyIndexRef.current - 1;
      setHistoryIndex(newIndex);
      setCodeGlobal(historyRef.current[newIndex]);
    }
  };

  const redo = () => {
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
      historyTimeoutRef.current = null;
    }

    if (historyIndexRef.current < historyRef.current.length - 1) {
      const newIndex = historyIndexRef.current + 1;
      setHistoryIndex(newIndex);
      setCodeGlobal(historyRef.current[newIndex]);
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
  }, [isRunning]); // Removed history, historyIndex, code to prevent rebinding on every keystroke


  const handleGenerateAiScreenshot = async () => {
    if (!isPremium && userData?.role !== 'developer') {
      notify.info(language === 'ru' ? 'Генерация ассетов через ИИ доступна в Premium.' : 'AI Asset generation is a Premium feature.');
      return;
    }
    setIsGeneratingScreenshot(true);
    try {
      const prompt = `Generate a high-quality, professional app icon and banner for an app titled "${appTitle}". Description: "${appDesc}". Written in EPL. Style: crisp geometric industrial interface graphic.`;
      const result = await generateImageWithAI(prompt, { aspectRatio: '16:9', title: appTitle });
      const dataUrl = `data:${result.mimeType};base64,${result.imageBase64}`;
      let finalUrl = dataUrl;
      if (user && !result.isSvgFallback) {
        try {
          const blob = await fetch(dataUrl).then(r => r.blob());
          const storageRef = ref(storage, `apps/${user.uid}/${Date.now()}_ai_screenshot.png`);
          await uploadBytes(storageRef, blob);
          finalUrl = await getDownloadURL(storageRef);
        } catch (uploadErr) {
          console.warn('Storage upload skipped, using generated asset URI:', uploadErr);
        }
      }
      setAppIconUrl(finalUrl);
      setAppBannerUrl(finalUrl);
      setAppScreenshotUrl(finalUrl);
      setIsAiGenerated(true);
      notify.success(language === 'ru' ? 'ИИ-ассеты сгенерированы!' : 'AI assets generated!');
    } catch (error) {
      console.error('Error generating AI screenshot', error);
      notify.error(language === 'ru' ? 'Не удалось сгенерировать ассеты.' : 'Failed to generate AI assets.');
    } finally {
      setIsGeneratingScreenshot(false);
    }
  };

  const handlePreCheckWithAi = async () => {
    setIsPreCheckingAi(true);
    try {
      const res = await fetch('/api/ai/moderate-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: appTitle,
          description: appDesc,
          code,
          authorName: user?.displayName || 'Developer'
        })
      });

      let modData: any = null;
      const text = await res.text();
      try {
        modData = JSON.parse(text);
      } catch (parseErr) {
        console.warn('Non-JSON moderation response:', text);
      }

      if (!res.ok || !modData) {
        const combined = `${appTitle} ${appDesc} ${code}`.toLowerCase();
        const explicitTerms = ['hacked by', 'you hacked', 'fuada was hacked', 'взломали', 'порно', 'porn', 'xxx', 'hentai', 'хуй', 'пизда', 'ебать', 'блять', 'сука', 'fuck', 'shit', 'nigger', 'cunt', 'dick'];
        const matched = explicitTerms.filter(t => combined.includes(t));
        const isApproved = matched.length === 0;
        modData = {
          approved: isApproved,
          reason: isApproved ? 'Проект безопасен и проверен' : `Обнаружены запрещенные слова: ${matched.join(', ')}`,
          flags: matched.length > 0 ? ['restricted_content'] : [],
          riskScore: isApproved ? 0 : 8
        };
      }

      setModerationResult(modData);
      setPreCheckStatus({
        approved: modData.approved,
        reason: modData.reason,
        checked: true
      });

      setShowModerationModal(true);
    } catch (err: any) {
      notify.error(err.message || (language === 'ru' ? 'Ошибка проверки ИИ' : 'AI verification error'));
    } finally {
      setIsPreCheckingAi(false);
    }
  };

  const handlePublish = async () => {
    if (!user) {
      notify.error(language === 'ru' ? 'Необходимо войти в аккаунт для публикации' : 'You must be signed in to publish apps.');
      return;
    }
    if (preCheckStatus?.checked && !preCheckStatus.approved) {
      notify.error(
        language === 'ru'
          ? `Проект отклонен модерацией ИИ: ${preCheckStatus.reason}`
          : `Rejected by AI moderation: ${preCheckStatus.reason}`
      );
      setShowModerationModal(true);
      return;
    }
    setIsPublishing(true);
    setPublishingStepText(language === 'ru' ? 'ИИ проверяет проект на нарушения и безопасность...' : 'AI is inspecting project safety...');
    try {
      const finalPrice = isPremium ? appPrice : 0;
      const appPayload: any = {
        id: editingAppId || undefined,
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
        screenshotUrl: '',
        bannerUrl: appBannerUrl || '',
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous',
        isAiGenerated,
        isPrivate,
        isLocked: isPremium ? isLocked : false,
        unlockCode: isPremium && isLocked ? unlockCode : '',
        allowCopy: isPremium ? allowCopy : true,
        originalAppId,
        originalAppName,
        events
      };

      let moderationData: any = null;
      let usedServer = false;

      try {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
        const res = await fetch('/api/apps/publish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
          },
          body: JSON.stringify(appPayload)
        });

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const json = await res.json();
          if (res.ok || json.reason) {
            moderationData = json;
            usedServer = true;
          }
        }
      } catch (netErr) {
        console.warn('Backend publish API unreachable, using client Firestore fallback:', netErr);
      }

      // If server API was unavailable (e.g. deployed statically on Vercel), publish directly to Firestore
      if (!moderationData) {
        const finalAppId = appPayload.id || ('app_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8));
        const combined = `${appTitle} ${appDesc} ${code}`.toLowerCase();
        const explicitTerms = ['hacked by', 'you hacked', 'fuada was hacked', 'взломали', 'порно', 'porn', 'xxx', 'hentai', 'хуй', 'пизда', 'ебать', 'блять', 'сука', 'fuck', 'shit', 'nigger', 'cunt', 'dick'];
        const matched = explicitTerms.filter(t => combined.includes(t));
        const isApproved = matched.length === 0;

        const recordToSave = {
          ...appPayload,
          id: finalAppId,
          status: isApproved ? 'verified' : 'rejected',
          moderationStatus: isApproved ? 'approved' : 'rejected',
          moderationReason: isApproved ? 'Проект безопасен и проверен' : `Обнаружены запрещенные слова: ${matched.join(', ')}`,
          moderationFlags: matched.length > 0 ? ['restricted_content'] : [],
          moderatedAt: new Date().toISOString(),
          moderatedBy: 'client-ai-moderator',
          updatedAt: new Date().toISOString(),
          createdAt: appPayload.createdAt || new Date().toISOString(),
          downloads: appPayload.downloads || 0,
          rating: appPayload.rating || 5.0,
          likes: appPayload.likes || 0,
          dislikes: appPayload.dislikes || 0,
          visits: appPayload.visits || 0
        };

        // Write directly to Firestore
        await setDoc(doc(db, 'apps', finalAppId), recordToSave, { merge: true });

        // Record request for admin/moderator oversight
        try {
          await setDoc(doc(db, 'adminRequests', `modreq_${finalAppId}`), {
            id: `modreq_${finalAppId}`,
            type: isApproved ? 'ai_moderation_approved' : 'ai_moderation_alert',
            targetId: finalAppId,
            targetName: appTitle,
            requesterId: user.uid,
            requesterName: user.displayName || 'Anonymous',
            reason: recordToSave.moderationReason,
            status: isApproved ? 'approved' : 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (_) {}

        moderationData = {
          success: isApproved,
          approved: isApproved,
          appId: finalAppId,
          reason: recordToSave.moderationReason,
          flags: recordToSave.moderationFlags,
          riskScore: isApproved ? 0 : 8
        };
      }

      setModerationResult(moderationData);
      if (moderationData.appId) setEditingAppId(moderationData.appId);
      setShowPublishModal(false);
      setShowModerationModal(true);
    } catch (error: any) {
      console.error("Error publishing app:", error);
      notify.error(error.message || (language === 'ru' ? 'Не удалось опубликовать приложение' : 'Failed to publish app'));
    } finally {
      setIsPublishing(false);
      setPublishingStepText('');
    }
  };

  const handlePublishWebsite = async () => {
    if (!user) {
      notify.error(language === 'ru' ? 'Необходимо войти в аккаунт для публикации' : 'You must be signed in to publish websites.');
      return;
    }
    const cleanSlug = websiteSlug
      .trim()
      .toLowerCase()
      .replace(/\.epl$/i, '')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (cleanSlug.length < 2) {
      notify.error(
        language === 'ru'
          ? 'Введите корректный домен (минимум 2 латинские буквы или цифры)'
          : 'Enter a valid domain slug (at least 2 lowercase letters or digits).'
      );
      return;
    }
    if (!code.trim()) {
      notify.error(language === 'ru' ? 'Код проекта пустой!' : 'Project code cannot be empty.');
      return;
    }

    const fullDomain = `${cleanSlug}.epl`;
    const canRemoveWatermark = canPremiumPlus;
    setIsPublishingWebsite(true);

    try {
      // Check domain uniqueness in Firestore
      const domainSnap = await getDocs(query(collection(db, 'apps'), where('websiteDomain', '==', fullDomain)));
      const takenByOther = domainSnap.docs.some((d) => d.id !== editingAppId);
      if (takenByOther) {
        notify.error(
          language === 'ru'
            ? `Домен ${fullDomain} уже занят. Выберите другой.`
            : `Domain ${fullDomain} is already taken.`
        );
        return;
      }

      const sitePayload: any = {
        id: editingAppId || undefined,
        title: appTitle,
        description: appDesc,
        code,
        version: appVersion,
        category: appCategory || 'apps',
        price: 0,
        supportedPlatforms: ['web'],
        iconUrl: appIconUrl,
        screenshotUrl: '',
        bannerUrl: appBannerUrl || '',
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous',
        isAiGenerated,
        isPrivate: false,
        isLocked: false,
        unlockCode: '',
        allowCopy: isPremium ? allowCopy : true,
        originalAppId,
        originalAppName,
        events,
        isWebsite: true,
        websiteDomain: fullDomain,
        hideWatermark: canRemoveWatermark ? hideWebsiteWatermark : false
      };

      let moderationData: any = null;
      try {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
        const res = await fetch('/api/apps/publish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
          },
          body: JSON.stringify(sitePayload)
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const json = await res.json();
          if (res.ok || json.reason) {
            moderationData = json;
          }
        }
      } catch (netErr) {
        console.warn('Backend website publish fallback to Firestore:', netErr);
      }

      if (!moderationData) {
        const finalAppId = sitePayload.id || ('site_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8));
        const recordToSave = {
          ...sitePayload,
          id: finalAppId,
          status: 'verified',
          moderationStatus: 'approved',
          moderationReason: 'Сайт успешно опубликован в домене .epl',
          moderationFlags: [],
          moderatedAt: new Date().toISOString(),
          moderatedBy: 'client-ai-moderator',
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          downloads: 0,
          rating: 5.0,
          likes: 0,
          dislikes: 0,
          visits: 0
        };
        await setDoc(doc(db, 'apps', finalAppId), recordToSave, { merge: true });
        moderationData = {
          success: true,
          approved: true,
          appId: finalAppId,
          reason: recordToSave.moderationReason,
          flags: []
        };
      }

      if (moderationData.appId) setEditingAppId(moderationData.appId);
      setModerationResult(moderationData);
      setShowPublishWebsiteModal(false);
      setShowModerationModal(true);
      notify.success(
        language === 'ru'
          ? `Сайт ${fullDomain} опубликован в магазине!`
          : `Website ${fullDomain} published to Store!`
      );
    } catch (err: any) {
      console.error('Error publishing website:', err);
      notify.error(err?.message || (language === 'ru' ? 'Ошибка публикации сайта' : 'Failed to publish website'));
    } finally {
      setIsPublishingWebsite(false);
    }
  };

  const handlePublishToAssetStore = async () => {
    if (!user) {
      notify.error(language === 'ru' ? 'Необходимо войти в аккаунт для публикации ассетов.' : 'You must be signed in to publish assets.');
      return;
    }
    setIsPublishing(true);
    try {
      const assetRef = doc(collection(db, 'assets'));
      const assetData: any = {
        id: assetRef.id,
        title: appTitle,
        description: appDesc,
        coverUrl: appBannerUrl || appScreenshotUrl || appIconUrl || '',
        price: appPrice,
        stock: 'infinite',
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous',
        type: 'editor',
        content: code,
        createdAt: new Date().toISOString(),
        visits: 0
      };
      await setDoc(assetRef, assetData);
      setShowPublishModal(false);
      notify.success(language === 'ru' ? 'Успешно опубликовано в Asset Store!' : 'Published to Asset Store successfully!');
    } catch (error) {
      console.error("Error publishing asset", error);
      notify.error(language === 'ru' ? 'Не удалось опубликовать в Asset Store.' : 'Failed to publish to Asset Store.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveLocally = async () => {
    if (!user) {
      notify.error(language === 'ru' ? 'Необходимо войти в аккаунт для сохранения.' : 'You must be signed in to save apps.');
      return;
    }
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
        updatedAt: new Date().toISOString()
      };

      if (!editingAppId) {
        appData.createdAt = new Date().toISOString();
        appData.downloads = 0;
        appData.rating = 0;
        appData.likes = 0;
        appData.dislikes = 0;
        appData.comments = [];
        appData.isVerified = false;
      }

      await setDoc(doc(db, 'apps', appId), appData, { merge: true });
      setEditingAppId(appId);
      setIsPrivate(true);
      setActiveMenu(null);
      notify.success(language === 'ru' ? 'Проект сохранен локально в "Мои приложения".' : 'App saved locally to your account!');
    } catch (error) {
      console.error("Error saving app locally", error);
      notify.error(language === 'ru' ? 'Ошибка сохранения проекта.' : 'Failed to save app.');
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
      let prompt = '';
      if (type === 'icon') {
        prompt = `Minimalist crisp industrial app icon for "${appTitle}". Description: ${appDesc}.`;
      } else if (type === 'banner') {
        prompt = `Promotional wide technical banner for "${appTitle}". Description: ${appDesc}.`;
      } else {
        prompt = `Clean UI screenshot preview for "${appTitle}". Description: ${appDesc}.`;
      }

      const result = await generateImageWithAI(prompt, {
        aspectRatio: type === 'banner' ? '16:9' : '1:1',
        title: appTitle,
      });
      const dataUrl = `data:${result.mimeType};base64,${result.imageBase64}`;
      let finalUrl = dataUrl;
      if (user && !result.isSvgFallback) {
        try {
          const blob = await fetch(dataUrl).then(r => r.blob());
          const storageRef = ref(storage, `apps/${user.uid}/${Date.now()}_generated_${type}.png`);
          await uploadBytes(storageRef, blob);
          finalUrl = await getDownloadURL(storageRef);
        } catch (uploadErr) {
          console.warn('Storage upload skipped, using generated asset URI:', uploadErr);
        }
      }

      if (type === 'icon') setAppIconUrl(finalUrl);
      else if (type === 'banner') setAppBannerUrl(finalUrl);
      else if (type === 'screenshot') setAppScreenshotUrl(finalUrl);
      setIsAiGenerated(true);
      notify.success(language === 'ru' ? 'Изображение сгенерировано!' : 'Image generated!');
    } catch (error) {
      console.error('Error generating image:', error);
      notify.error(language === 'ru' ? 'Не удалось сгенерировать изображение.' : 'Error generating image. Please try again.');
    } finally {
      setIsGeneratingImage(null);
    }
  };

  const handleUIEvent = useCallback((eventName: string, target?: string, value?: string) => {
    if (eventName === 'premium_unlocked?') {
      setIsPremium(true);
      return;
    }
    
    // Handle navigation for Asset UI clone
    if (eventName === 'trigger_mobile_emulator?') {
      setRunMode('mobile');
      return;
    }

    if (eventName === 'clicked?') {
      if (target === 'Store') {
        startTransition(() => setCurrentView('store'));
        return;
      } else if (target === 'Editor') {
        startTransition(() => setCurrentView('editor'));
        return;
      } else if (target === 'MyApps') {
        startTransition(() => setCurrentView('my-apps'));
        return;
      } else if (target === 'AssetStore') {
        startTransition(() => setCurrentView('asset-store'));
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
      interpreterRef.current.triggerEvent(eventName, target, value);
    }
  }, [isRunning, setIsPremium, handleRun, isFullScreen, setIsFullScreen]);

  return (
    <div className={clsx("h-full flex flex-col overflow-hidden relative", isFrutigerAero && "frutiger-aero-bg", computerStyle && "computer-style")}>
      {/* Menu Bar */}
      <div 
        ref={menuRef}
        className={clsx(
          "flex flex-wrap items-center gap-1 px-2 py-1 border-b text-sm relative z-50",
          isFrutigerAero ? "frutiger-aero-glass" : theme !== 'light' ? 'bg-[#111315] border-[#262B33] text-[#E5E7EB]' : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#374151]',
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
            <div className={clsx("absolute top-full left-0 mt-1 w-60 border rounded-lg shadow-xl py-1 z-50", isFrutigerAero ? "frutiger-aero-glass" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800")}>
              <button onClick={handleNewFile} className={clsx("w-full text-left px-4 py-2 flex items-center gap-2", isFrutigerAero ? "hover:bg-white/50 text-blue-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}>
                <FileText className="w-4 h-4" /> {t.newFile}
              </button>
              <button onClick={handleSwitchFile} className={clsx("w-full text-left px-4 py-2 flex items-center gap-2", isFrutigerAero ? "hover:bg-white/50 text-blue-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}>
                <RefreshCw className="w-4 h-4" /> Switch
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
                onClick={() => {
                  const autoSlug = (appTitle || 'my-site').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'my-site';
                  if (!websiteSlug) setWebsiteSlug(autoSlug);
                  setShowPublishWebsiteModal(true);
                  setActiveMenu(null);
                }}
                className={clsx("w-full text-left px-4 py-2 flex items-center gap-2", isFrutigerAero ? "hover:bg-white/50 text-blue-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}
              >
                <Globe className="w-4 h-4 text-sky-400 shrink-0" />
                <span>{language === 'ru' ? 'Опубликовать как новый сайт' : 'Publish as new website'}</span>
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
            <div className={clsx("absolute top-full left-0 mt-1 w-60 border rounded-lg shadow-xl py-1 z-50", isFrutigerAero ? "frutiger-aero-glass" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800")}>
              <button
                onClick={() => {
                  setSelectedExtraCategory('Normal');
                  setCodeSync(STARTER_EDITOR_CODE);
                  setHistory(prev => [...prev.slice(0, historyIndexRef.current + 1), STARTER_EDITOR_CODE]);
                  setHistoryIndex(prev => prev + 1);
                  setActiveMenu(null);
                }}
                className={clsx("w-full text-left px-4 py-2 flex items-center gap-2 text-xs font-semibold text-[#10B981]", isFrutigerAero ? "hover:bg-white/50" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}
              >
                <Sparkles className="w-4 h-4" /> {language === 'ru' ? 'Стартовый пример (блок + WASD)' : 'Load Starter Example'}
              </button>
              <button onClick={() => { setCodeGlobal(''); setActiveMenu(null); }} className={clsx("w-full text-left px-4 py-2 flex items-center gap-2 text-red-400", isFrutigerAero ? "hover:bg-white/50" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}>
                <Trash2 className="w-4 h-4" /> {t.clearCode}
              </button>

              <button 
                onClick={() => { 
                  setSelectedExtraCategory(selectedExtraCategory === 'BlockEditing' ? 'Normal' : 'BlockEditing'); 
                  setActiveMenu(null); 
                }} 
                className={clsx("w-full text-left px-4 py-2 flex items-center gap-2 text-xs font-semibold", isFrutigerAero ? "hover:bg-white/50 text-blue-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}
              >
                <Layers className="w-4 h-4 text-purple-400" /> 
                {selectedExtraCategory === 'BlockEditing' 
                  ? (language === 'ru' ? 'В обычный код' : 'Switch to Code Editor') 
                  : (language === 'ru' ? 'В блочный редактор (block editing)' : 'Switch to Block Editing')
                }
              </button>

              {selectedExtraCategory === 'PreviewEditing' ? (
                <button 
                  onClick={() => { 
                    setSelectedExtraCategory('Normal'); 
                    setActiveMenu(null); 
                  }} 
                  className={clsx("w-full text-left px-4 py-2 flex items-center gap-2 text-xs font-semibold", isFrutigerAero ? "hover:bg-white/50 text-blue-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}
                >
                  <Code2 className="w-4 h-4" /> {language === 'ru' ? 'В обычный редактор' : 'Switch to Code Editor'}
                </button>
              ) : (
                <button 
                  onClick={() => { 
                    setSelectedExtraCategory('PreviewEditing'); 
                    if (!previewType) setPreviewType('2D');
                    setActiveMenu(null); 
                  }} 
                  className={clsx("w-full text-left px-4 py-2 flex items-center gap-2 text-xs font-semibold", isFrutigerAero ? "hover:bg-white/50 text-blue-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}
                >
                  <LayoutTemplate className="w-4 h-4" /> {language === 'ru' ? 'В визуальный редактор' : 'Switch to Visual Editor'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Extra Category Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setActiveMenu(activeMenu === 'extra_category' ? null : 'extra_category')}
            className={clsx("px-2.5 sm:px-3 py-1 rounded transition-colors font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap", activeMenu === 'extra_category' ? 'bg-zinc-200 dark:bg-zinc-800' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800')}
          >
            <Layers className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
            <span className="truncate max-w-[170px] sm:max-w-none">
              {language === 'ru' ? 'Режим' : 'Mode'}: {selectedExtraCategory === 'BlockEditing' ? (language === 'ru' ? 'Блоки' : 'Blocks') : selectedExtraCategory === 'PreviewEditing' ? (language === 'ru' ? 'Визуальный' : 'Visual') : selectedExtraCategory || 'Normal'}
            </span>
            <ChevronDown className="w-3 h-3 opacity-75 shrink-0" />
          </button>
          {activeMenu === 'extra_category' && (
            <div className={clsx("absolute top-full left-0 mt-1 w-60 max-w-[calc(100vw-1rem)] border rounded-xl shadow-2xl py-1.5 z-50", isFrutigerAero ? "frutiger-aero-glass text-blue-900" : "bg-white dark:bg-[#181B20] border-[#E2E5EA] dark:border-[#262B33] text-[#111315] dark:text-[#F1F3F5]")}>
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#B4BCC8] border-b border-zinc-800/50 mb-1">
                {language === 'ru' ? 'Категория / Режим:' : 'Category Mode:'}
              </div>

              <button 
                onClick={() => { setSelectedExtraCategory('Normal'); setActiveMenu(null); }} 
                className={clsx("w-full text-left px-3.5 py-2 flex items-center gap-2 text-xs font-medium hover:bg-zinc-800/50 cursor-pointer", (selectedExtraCategory === 'Normal' || !selectedExtraCategory) && "text-emerald-400 font-bold bg-emerald-500/10")}
              >
                <Code2 className="w-4 h-4 text-emerald-400" />
                <span>{language === 'ru' ? 'Normal (Текстовый код)' : 'Normal (Text Code)'}</span>
              </button>

              <button 
                onClick={() => { setSelectedExtraCategory('BlockEditing'); setActiveMenu(null); }} 
                className={clsx("w-full text-left px-3.5 py-2 flex items-center gap-2 text-xs font-medium hover:bg-zinc-800/50 cursor-pointer", selectedExtraCategory === 'BlockEditing' && "text-[#10B981] font-bold bg-[#10B981]/10")}
              >
                <Layers className="w-4 h-4 text-[#10B981]" />
                <span>{language === 'ru' ? 'Блочный редактор (блоки)' : 'Block Editing (Visual Blocks)'}</span>
              </button>

              <button 
                onClick={() => { 
                  setSelectedExtraCategory('PreviewEditing'); 
                  if (!previewType) setPreviewType('2D');
                  setActiveMenu(null); 
                }} 
                className={clsx("w-full text-left px-3.5 py-2 flex items-center gap-2 text-xs font-medium hover:bg-zinc-800/50 cursor-pointer", selectedExtraCategory === 'PreviewEditing' && "text-blue-400 font-bold bg-blue-500/10")}
              >
                <LayoutTemplate className="w-4 h-4 text-blue-400" />
                <span>{language === 'ru' ? 'Визуальный редактор' : 'Visual Editor'}</span>
              </button>

              <button 
                onClick={() => { setSelectedExtraCategory('OS'); setActiveMenu(null); }} 
                className={clsx("w-full text-left px-3.5 py-2 flex items-center gap-2 text-xs font-medium hover:bg-zinc-800/50 cursor-pointer", selectedExtraCategory === 'OS' && "text-cyan-400 font-bold bg-cyan-500/10")}
              >
                <Monitor className="w-4 h-4 text-cyan-400" />
                <span>{language === 'ru' ? 'Симуляция ОС (AllBIOS)' : 'OS Simulation (AllBIOS)'}</span>
              </button>

              <button 
                onClick={() => { setSelectedExtraCategory('Asset'); setActiveMenu(null); }} 
                className={clsx("w-full text-left px-3.5 py-2 flex items-center gap-2 text-xs font-medium hover:bg-zinc-800/50 cursor-pointer", selectedExtraCategory === 'Asset' && "text-amber-400 font-bold bg-amber-500/10")}
              >
                <Package className="w-4 h-4 text-amber-400" />
                <span>{language === 'ru' ? 'Режим ассета магазина' : 'Asset Store UI Mode'}</span>
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button 
            onClick={() => setActiveMenu(activeMenu === 'help' ? null : 'help')}
            className={clsx("px-2.5 sm:px-3 py-1 rounded transition-colors", activeMenu === 'help' ? 'bg-zinc-200 dark:bg-zinc-800' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800')}
          >
            {t.help}
          </button>
          {activeMenu === 'help' && (
            <div className={clsx("absolute top-full right-0 sm:left-0 sm:right-auto mt-1 w-48 max-w-[calc(100vw-1rem)] border rounded-lg shadow-xl py-1 z-50", isFrutigerAero ? "frutiger-aero-glass" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800")}>
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
      </div>

      {/* Toolbar — wraps cleanly at 1280px without horizontal clipping */}
      <div className={clsx(
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2.5 border-b",
        isFrutigerAero ? "bg-white/40 border-white/50 backdrop-blur-md shadow-sm" :
        theme !== 'light' ? 'bg-[#181B20] border-[#262B33]' : 'bg-white border-[#E2E5EA]'
      )}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={clsx("text-base font-bold flex items-center gap-2 whitespace-nowrap shrink-0", isFrutigerAero ? "text-blue-900" : "")}>
            <Code2 className={clsx("w-4 h-4", isFrutigerAero ? "text-blue-600" : "text-[#10B981]")} />
            <span className="hidden sm:inline">EPL Editor</span>
          </h2>
          <div className={clsx("h-4 w-px mx-0.5 hidden sm:block", isFrutigerAero ? "bg-blue-800/20" : "bg-[#262B33]")}></div>
          <div className="flex flex-wrap items-center gap-1.5">
            {!isRunning ? (
              <>
                <button 
                  onClick={() => setLivePreviewEnabled(!livePreviewEnabled)} 
                  className={clsx(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer border",
                    livePreviewEnabled 
                      ? (isFrutigerAero ? "bg-blue-500 text-white border-blue-600" : "bg-[#10B981]/15 border-[#10B981]/50 text-[#10B981]") 
                      : (isFrutigerAero ? "bg-white/40 hover:bg-white/60 text-blue-900 border-white/40" : "bg-[#21252C] border-[#262B33] hover:bg-[#2A2F38] text-[#C4CAD3] hover:text-[#F1F3F5]")
                  )}
                  title={livePreviewEnabled ? "Live Preview is ON (real-time)" : "Live Preview is OFF"}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Live Preview</span>
                </button>
                <button onClick={() => handleRun('pc')} className={clsx(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 border cursor-pointer",
                  isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-900 border-white/50" : theme !== 'light' ? "bg-[#21252C] border-[#262B33] hover:bg-[#2A2F38] text-[#F1F3F5]" : "bg-[#F5F6F8] border-[#E2E5EA] hover:bg-[#EBEEF2] text-[#111315]"
                )}>
                  <Monitor className="w-3.5 h-3.5" /> {language === 'ru' ? 'ПК' : 'PC'}
                </button>
                <button onClick={() => handleRun('mobile')} className={clsx(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 border cursor-pointer",
                  isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-900 border-white/50" : theme !== 'light' ? "bg-[#21252C] border-[#262B33] hover:bg-[#2A2F38] text-[#F1F3F5]" : "bg-[#F5F6F8] border-[#E2E5EA] hover:bg-[#EBEEF2] text-[#111315]"
                )}>
                  <Smartphone className="w-3.5 h-3.5" /> {language === 'ru' ? 'Телефон' : 'Mobile'}
                </button>
                <button onClick={() => handleRun('run')} className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer",
                  isFrutigerAero ? "frutiger-aero-button" : "bg-[#10B981] hover:bg-[#059669] text-[#111315]"
                )}>
                  <Play className="w-3.5 h-3.5" /> {t.run}
                </button>
              </>
            ) : (
              <button onClick={handleStop} className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer",
                isFrutigerAero ? "bg-red-500/80 hover:bg-red-500 text-white border border-red-500/50 shadow-sm backdrop-blur-sm" : "bg-red-500 hover:bg-red-600 text-white"
              )}>
                <StopCircle className="w-3.5 h-3.5" /> {t.stop}
              </button>
            )}
            <button 
              onClick={handleRestart} 
              className={clsx(
                "flex items-center justify-center p-1.5 rounded-lg transition-colors cursor-pointer shrink-0",
                isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-800 border border-white/60 shadow-sm" : "bg-zinc-800 hover:bg-zinc-700 text-white"
              )}
              title={language === 'ru' ? 'Перезагрузить' : 'Restart'}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <div className={clsx("h-4 w-px mx-0.5", isFrutigerAero ? "bg-blue-800/10" : "bg-zinc-700/40")}></div>
            <button 
              onClick={undo}
              disabled={historyIndex <= 0}
              className={clsx(
                "flex items-center justify-center p-1.5 rounded-lg transition-colors disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer shrink-0",
                isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-800 border border-white/60 shadow-sm" : "bg-zinc-800 hover:bg-zinc-700 text-white"
              )}
              title={language === 'ru' ? 'Отменить' : 'Undo'}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className={clsx(
                "flex items-center justify-center p-1.5 rounded-lg transition-colors disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer shrink-0",
                isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-800 border border-white/60 shadow-sm" : "bg-zinc-800 hover:bg-zinc-700 text-white"
              )}
              title={language === 'ru' ? 'Повторить' : 'Redo'}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-1.5">
          {livePreviewEnabled && (
            <button 
              onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
              className={clsx(
                "sm:hidden px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1",
                isRightPanelOpen
                  ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40"
                  : isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-800 border border-white/60 shadow-sm" : "bg-zinc-800 hover:bg-zinc-700 text-white"
              )}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>
                {language === 'ru'
                  ? (isRightPanelOpen ? 'Скрыть вид' : 'Предпросмотр')
                  : (isRightPanelOpen ? 'Hide UI' : 'Show UI')}
              </span>
            </button>
          )}
          <button 
            onClick={() => imageInputRef.current?.click()}
            disabled={isUploading}
            className={clsx(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer",
              isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-800 border border-white/60 shadow-sm" : "bg-zinc-800 hover:bg-zinc-700 text-white"
            )}
          >
            <UploadCloud className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{isUploading ? t.publishing : t.uploadFile}</span>
          </button>
          <button 
            onClick={() => setShowInventoryModal(true)}
            className={clsx(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer",
              isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-800 border border-white/60 shadow-sm" : "bg-zinc-800 hover:bg-zinc-700 text-white"
            )}
          >
            <Package className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{language === 'ru' ? 'Инвентарь' : 'Inventory'}</span>
          </button>
          <input type="file" ref={imageInputRef} className="hidden" onChange={handleFileUpload} />
          {user && (
            <button 
              onClick={() => setShowPublishModal(true)}
              className={clsx(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer",
                isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-800 border border-white/60 shadow-sm" : "bg-zinc-800 hover:bg-zinc-700 text-white"
              )}
            >
              <UploadCloud className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t.publish}</span>
            </button>
          )}
          <button 
            onClick={() => setShowDrplStudioModal(true)}
            className={clsx(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border cursor-pointer",
              isFrutigerAero
                ? "bg-white/60 hover:bg-white/80 text-blue-900 border-white/60"
                : "bg-[#10B981]/15 hover:bg-[#10B981]/25 border-[#10B981]/50 text-[#10B981]"
            )}
            title="difrenopt Studio (DRPL 3D/2D/App Engine)"
          >
            <Cpu className="w-3.5 h-3.5" /> <span className="hidden sm:inline">DRPL Studio</span>
          </button>
          <button 
            onClick={() => setShowEditorStoreModal(true)}
            className={clsx(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer",
              isFrutigerAero ? "frutiger-aero-button" : "bg-[#10B981] hover:bg-[#059669] text-[#111315]"
            )}
          >
            <Store className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{language === 'ru' ? 'Магазин' : 'Editor Store'}</span>
          </button>
          <button 
            onClick={() => setShowFileControlModal(true)}
            className={clsx(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer",
              isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-800 border border-white/60 shadow-sm" : "bg-zinc-800 hover:bg-zinc-700 text-white"
            )}
          >
            <FolderOpen className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t.fileControl}</span>
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
            <AppPreview
              entities={uiState.entities}
              variables={uiState.variables}
              camera={uiState.camera}
              uiMode={uiState.uiMode}
              handleUIEvent={handleUIEvent}
              showGrid={showStageGrid}
            />
          </div>
        </div>
      )}

      {/* Main Editor Area */}
      {selectedExtraCategory === 'PreviewEditing' ? (
        <React.Suspense fallback={<div className="flex-1 flex justify-center items-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>}>
          <PreviewEditor type={previewType || '2D'} code={code} onChange={handleCodeChange} />
        </React.Suspense>
      ) : selectedExtraCategory === 'BlockEditing' ? (
        <BlockEditor code={code} onChange={handleCodeChange} />
      ) : (
      <div className="flex-1 flex flex-col sm:flex-row overflow-y-auto sm:overflow-hidden">
        {!isFullScreen && (
          <>
            {/* Code Input */}
            <div className={clsx(
              "flex-1 flex flex-col sm:border-r min-h-[50vh] sm:min-h-0",
              isFrutigerAero ? "bg-white/20 border-white/30 backdrop-blur-sm" :
              theme !== 'light' ? 'border-[#262B33] bg-[#111315]' : 'border-[#E2E5EA] bg-white'
            )}>
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                {selectedExtraCategory === 'CustomEditor' && runMode === 'run' ? (
                  <>
                    <AppPreview
                      entities={uiState.entities}
                      variables={uiState.variables}
                      camera={uiState.camera}
                      uiMode={uiState.uiMode}
                      handleUIEvent={handleUIEvent}
                      isFullScreen={true}
                      showGrid={showStageGrid}
                    />
                    <button onClick={handleStop} className="absolute top-4 right-4 z-50 px-4 py-2 bg-red-500 text-white font-bold rounded-lg shadow-lg hover:bg-red-600 flex items-center gap-2">
                      <StopCircle className="w-5 h-5" /> Stop
                    </button>
                  </>
                ) : (
                  <>
                    {selectedExtraCategory && !['Normal', 'OS', 'Asset', 'PreviewEditing', 'CustomEditor'].includes(selectedExtraCategory) && (
                      <div className="absolute inset-0 z-0">
                        <AppPreview
                          entities={uiState.entities}
                          variables={uiState.variables}
                          camera={uiState.camera}
                          uiMode={uiState.uiMode}
                          handleUIEvent={handleUIEvent}
                          isFullScreen={true}
                          showGrid={showStageGrid}
                        />
                      </div>
                    )}
                    <div className="relative z-10 h-full flex flex-col pointer-events-none">
                      <div className="pointer-events-auto h-full flex flex-col">
                        <VisualEditor code={code} onChange={handleCodeChange} entities={uiState.entities} />
                      </div>
                    </div>
                  </>
                )}
              </div>
              <AIAgent 
                onCodeGenerated={handleCodeGenerated}
                currentCode={code} 
                onSave={handleSaveLocally}
              />
            </div>

            {/* Live Preview Side Panel */}
            {livePreviewEnabled && (
              <div 
                style={{ 
                  width: typeof window !== 'undefined' && window.innerWidth >= 640 ? '384px' : undefined 
                }}
                className={clsx(
                  "flex-col border-t sm:border-t-0 sm:border-l relative overflow-hidden transition-all shrink-0 h-[38dvh] sm:h-auto sm:flex-1 md:flex-initial",
                  isRightPanelOpen ? "flex" : "hidden sm:flex",
                  isFrutigerAero ? "bg-white/30 border-white/40 backdrop-blur-md" :
                  theme !== 'light' ? "bg-zinc-900/60 border-zinc-800" : "bg-zinc-50 border-zinc-200"
                )}
              >
                {/* Header */}
                <div className={clsx(
                  "h-10 px-3.5 flex items-center justify-between border-b text-xs select-none shrink-0",
                  theme !== 'light' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                )}>
                  <div className="flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-[#10B981]" />
                    <span className="font-semibold uppercase tracking-wider text-[11px]">
                      {language === 'ru' ? 'Живой просмотр' : 'Live Preview'}
                    </span>
                    {liveError && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400 border border-red-500/30 truncate max-w-[140px]" title={liveError}>
                        {liveError}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setShowStageGrid(v => !v)}
                      className={clsx(
                        "p-1.5 rounded-lg transition-colors cursor-pointer",
                        showStageGrid ? "bg-emerald-500/20 text-[#10B981]" : "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                      )}
                      title={language === 'ru' ? 'Сетка сцены' : 'Stage Grid'}
                    >
                      <Grid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setIsStageMuted(v => !v)}
                      className={clsx(
                        "p-1.5 rounded-lg transition-colors cursor-pointer",
                        isStageMuted ? "bg-amber-500/20 text-amber-400" : "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                      )}
                      title={isStageMuted ? (language === 'ru' ? 'Включить звук' : 'Unmute Audio') : (language === 'ru' ? 'Выключить звук' : 'Mute Audio')}
                    >
                      {isStageMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => setShowLiveVars(v => !v)}
                      className={clsx(
                        "p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-mono",
                        showLiveVars ? "bg-emerald-500/20 text-[#10B981]" : "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                      )}
                      title={language === 'ru' ? 'Переменные движка' : 'Engine Variables'}
                    >
                      <Activity className="w-3.5 h-3.5" />
                      {Object.keys(liveUiState.variables || {}).length > 0 && (
                        <span>{Object.keys(liveUiState.variables || {}).length}</span>
                      )}
                    </button>
                    <button 
                      onClick={() => setShowLiveConsole(!showLiveConsole)}
                      className={clsx(
                        "p-1.5 rounded-lg transition-colors cursor-pointer",
                        showLiveConsole ? "bg-zinc-800 text-blue-400" : "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                      )}
                      title={showLiveConsole ? "Hide Console" : "Show Console"}
                    >
                      <Terminal className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={handleLiveRestart}
                      className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      title="Restart Live Preview"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleRun('run')}
                      className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      title="Open Fullscreen Player"
                    >
                      <Maximize className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setLivePreviewEnabled(false)}
                      className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      title="Turn off Live Preview"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Live Variables Inspector Strip */}
                {showLiveVars && (
                  <div className="px-3 py-1.5 border-b border-zinc-800 bg-zinc-950/90 flex flex-wrap gap-2 text-[10px] font-mono text-zinc-300 shrink-0">
                    {Object.keys(liveUiState.variables || {}).length === 0 ? (
                      <span className="text-zinc-400 italic">{language === 'ru' ? 'Нет активных переменных' : 'No active variables'}</span>
                    ) : (
                      Object.entries(liveUiState.variables || {}).map(([k, v]) => (
                        <span key={k} className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                          <span className="text-emerald-400">{k}</span>=<span className="text-amber-300">{String(v)}</span>
                        </span>
                      ))
                    )}
                  </div>
                )}

                {/* Viewport */}
                <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
                  {Object.keys(liveUiState.entities).length === 0 ? (
                    <div className="text-center p-6 space-y-2">
                      <div className="w-10 h-10 rounded-2xl bg-zinc-800/80 text-zinc-300 flex items-center justify-center mx-auto mb-2">
                        <LayoutTemplate className="w-5 h-5" />
                      </div>
                      <p className="text-xs text-zinc-300 font-medium">{t.noEntities}</p>
                      <p className="text-xs text-zinc-400 max-w-xs">
                        {language === 'ru' 
                          ? 'Напишите в коде create block или background чтобы увидеть результат.'
                          : 'Write EPL code like create block to see elements live.'}
                      </p>
                    </div>
                  ) : (
                    <AppPreview
                      entities={liveUiState.entities}
                      variables={liveUiState.variables}
                      camera={liveUiState.camera}
                      uiMode={liveUiState.uiMode}
                      handleUIEvent={handleLiveUIEvent}
                      showGrid={showStageGrid}
                    />
                  )}
                </div>

                {/* Live Console Drawer */}
                {showLiveConsole && (
                  <div className="h-32 border-t border-zinc-800 bg-zinc-950 font-mono text-[11px] p-2.5 overflow-y-auto text-emerald-400 space-y-0.5 shrink-0">
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1 flex items-center justify-between font-sans">
                      <span>Console output</span>
                      <button onClick={() => setLiveOutput([])} className="hover:text-zinc-200">clear</button>
                    </div>
                    {liveOutput.length === 0 ? (
                      <div className="italic text-zinc-400 text-xs">Ready.</div>
                    ) : (
                      liveOutput.map((l, idx) => (
                        <div key={idx} className="leading-tight break-all">{l}</div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      )}

      {/* --- RUN MODE OVERLAYS --- */}
      {runMode === 'pc' && (
        <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-8">
          <div className="w-full max-w-5xl h-[88dvh] sm:h-[80vh] flex flex-col bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl">
            <div className="h-12 bg-zinc-800 border-b border-zinc-700 flex items-center justify-between px-3 sm:px-4">
              <span className="text-xs sm:text-sm font-bold text-zinc-300 truncate">{language === 'ru' ? 'Предпросмотр (ПК)' : 'Preview (PC Standard)'}</span>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setShowStageGrid(v => !v)} className={clsx("p-1.5 rounded border text-xs cursor-pointer", showStageGrid ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-zinc-900 border-zinc-700 text-zinc-300")} title={language === 'ru' ? 'Сетка' : 'Toggle Grid'}><Grid className="w-4 h-4" /></button>
                <button onClick={() => setIsStageMuted(v => !v)} className={clsx("p-1.5 rounded border text-xs cursor-pointer", isStageMuted ? "bg-amber-500/20 border-amber-500/40 text-amber-400" : "bg-zinc-900 border-zinc-700 text-zinc-300")} title={language === 'ru' ? 'Звук' : 'Mute/Unmute'}>{isStageMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</button>
                <button onClick={handleStop} className="px-3 sm:px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded text-xs sm:text-sm font-medium transition-colors cursor-pointer">{t.stop}</button>
              </div>
            </div>
            <div className="flex-1 relative bg-black overflow-hidden">
              {Object.keys(uiState.entities).length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm italic text-zinc-400">{t.noEntities}</div>
              ) : (
                <AppPreview
                  entities={uiState.entities}
                  variables={uiState.variables}
                  camera={uiState.camera}
                  uiMode={uiState.uiMode}
                  handleUIEvent={handleUIEvent}
                  isFullScreen={true}
                  showGrid={showStageGrid}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {runMode === 'mobile' && (
        <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2 sm:gap-4">
            <button onClick={() => setIsPhoneRotated(!isPhoneRotated)} className="px-3 sm:px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer">
              <RefreshCw className="w-4 h-4" /> {language === 'ru' ? 'Повернуть' : 'Rotate'}
            </button>
            <button onClick={() => setIsStageMuted(v => !v)} className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors cursor-pointer" title={language === 'ru' ? 'Звук' : 'Mute/Unmute'}>
              {isStageMuted ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button onClick={handleStop} className="px-3 sm:px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer">
              <StopCircle className="w-4 h-4" /> {t.stop}
            </button>
          </div>
          <div 
            className={clsx(
              "relative bg-black border-[8px] sm:border-[12px] border-zinc-800 rounded-[2.25rem] sm:rounded-[3rem] overflow-hidden shadow-2xl transition-all duration-300 ease-in-out",
              isPhoneRotated ? "w-[min(800px,calc(100vw-1.5rem))] h-[min(375px,68dvh)]" : "w-[min(375px,calc(100vw-1.5rem))] h-[min(800px,76dvh)]"
            )}
          >
            {/* Phone notch */}
            {!isPhoneRotated && <div className="absolute top-0 inset-x-0 h-5 sm:h-6 bg-zinc-800 rounded-b-xl w-28 sm:w-32 mx-auto z-50"></div>}
            {isPhoneRotated && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-5 sm:w-6 h-28 sm:h-32 bg-zinc-800 rounded-r-xl z-50"></div>}
            
            {Object.keys(uiState.entities).length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm italic text-zinc-500">{t.noEntities}</div>
            ) : (
              <AppPreview
                entities={uiState.entities}
                variables={uiState.variables}
                camera={uiState.camera}
                uiMode={uiState.uiMode}
                handleUIEvent={handleUIEvent}
                isFullScreen={true}
                showGrid={showStageGrid}
              />
            )}
          </div>
        </div>
      )}

      {runMode === 'run' && selectedExtraCategory !== 'CustomEditor' && (
        <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-8">
          <div className="w-full max-w-6xl h-[90dvh] sm:h-[85vh] flex flex-col lg:flex-row bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl">
            <div className="flex-[2] min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r border-zinc-800">
              <div className="px-3 sm:px-4 py-2 text-xs font-medium uppercase tracking-wider flex items-center justify-between bg-zinc-800/50 border-b border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-300">
                  <LayoutTemplate className="w-3.5 h-3.5" /> {language === 'ru' ? 'Экран приложения' : 'App UI'}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowStageGrid(v => !v)} className={clsx("p-1.5 rounded border text-xs cursor-pointer", showStageGrid ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-zinc-900 border-zinc-700 text-zinc-300")} title={language === 'ru' ? 'Сетка' : 'Toggle Grid'}><Grid className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setIsStageMuted(v => !v)} className={clsx("p-1.5 rounded border text-xs cursor-pointer", isStageMuted ? "bg-amber-500/20 border-amber-500/40 text-amber-400" : "bg-zinc-900 border-zinc-700 text-zinc-300")} title={language === 'ru' ? 'Звук' : 'Mute/Unmute'}>{isStageMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}</button>
                  <button onClick={handleStop} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer">
                    <StopCircle className="w-3.5 h-3.5" /> {t.stop}
                  </button>
                </div>
              </div>
              <div className="flex-1 relative overflow-hidden bg-black">
                {Object.keys(uiState.entities).length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm italic text-zinc-500">{t.noEntities}</div>
                ) : (
                  <AppPreview
                    entities={uiState.entities}
                    variables={uiState.variables}
                    camera={uiState.camera}
                    uiMode={uiState.uiMode}
                    handleUIEvent={handleUIEvent}
                    isFullScreen={true}
                    showGrid={showStageGrid}
                  />
                )}
              </div>
            </div>
            <div className="flex-[1] min-h-0 h-44 lg:h-auto flex flex-col bg-black font-mono text-xs text-zinc-300 min-w-0 lg:min-w-[300px]">
              <div className="h-[36px] px-4 flex items-center gap-2 border-b border-zinc-800 uppercase tracking-wider font-sans font-medium bg-zinc-900 text-zinc-400">
                <Terminal className="w-3.5 h-3.5" /> {t.console}
              </div>
              <div className="flex-1 p-4 overflow-y-auto">
                {output.length === 0 ? (
                  <div className="italic text-zinc-600">{t.ready}</div>
                ) : (
                  output.map((line, i) => (
                    <div key={i} className="mb-1 break-all">{line}</div>
                  ))
                )}
                <div ref={outputEndRef} />
              </div>
            </div>
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
          <div className={clsx(
            "w-full max-w-md rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[90dvh] overflow-y-auto",
            isFrutigerAero ? "bg-white/80 border border-white/50 backdrop-blur-md" :
            theme !== 'light' ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'
          )}>
            <h2 className={clsx("text-lg sm:text-xl font-bold mb-4", isFrutigerAero ? "text-blue-900" : "")}>
              {language === 'ru' ? 'Выберите режим проекта' : 'Select Extra Category'}
            </h2>
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
                onClick={() => confirmNewFile('CustomEditor')}
                className={clsx(
                  "w-full text-left p-4 rounded-xl border transition-colors",
                  isFrutigerAero ? "bg-white/50 border-white/60 hover:bg-white/70 shadow-sm" : "border-zinc-700 hover:bg-zinc-800"
                )}
              >
                <div className={clsx("font-bold", isFrutigerAero ? "text-blue-900" : "")}>Custom Editor</div>
                <div className={clsx("text-sm", isFrutigerAero ? "text-blue-800/70" : "text-zinc-500")}>Build a custom editor using EPL code</div>
              </button>
              
              {customEditors.map(editor => (
                <button 
                  key={editor.id}
                  onClick={() => confirmNewFile(editor.id)}
                  className={clsx(
                    "w-full text-left p-4 rounded-xl border transition-colors",
                    isFrutigerAero ? "bg-white/50 border-white/60 hover:bg-white/70 shadow-sm" : "border-zinc-700 hover:bg-zinc-800"
                  )}
                >
                  <div className={clsx("font-bold", isFrutigerAero ? "text-blue-900" : "text-emerald-500")}>{editor.title}</div>
                  <div className={clsx("text-sm", isFrutigerAero ? "text-blue-800/70" : "text-zinc-500")}>Custom Editor</div>
                </button>
              ))}

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
                <CustomSelect
                  value={appCategory}
                  onChange={setAppCategory}
                  options={['games', 'apps', 'work', 'AI', 'Programming Language', 'Store', 'Custom Editor', 'Other'].map(cat => ({
                    value: cat,
                    label: cat
                  }))}
                />
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
                    "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors border",
                    (isPremium || userData?.role === 'developer')
                      ? (isFrutigerAero ? "frutiger-aero-button" : "bg-[#21252C] border-[#10B981]/50 text-[#10B981] hover:bg-[#10B981]/10")
                      : "bg-[#21252C] border-[#262B33] text-[#6B7280] cursor-not-allowed"
                  )}
                >
                  {isGeneratingScreenshot ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
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
                  <label className={clsx("flex items-center gap-2 mb-3", !canPremiumPlus ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
                    <input
                      type="checkbox"
                      checked={isLocked}
                      onChange={(e) => canPremiumPlus && setIsLocked(e.target.checked)}
                      disabled={!canPremiumPlus}
                      className="w-4 h-4 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500 bg-zinc-800/50"
                    />
                    <span className="text-sm font-medium text-emerald-400 flex items-center gap-2">
                      Lock App with Code (Premium+) {!canPremiumPlus && <Lock className="w-3 h-3" />}
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
                    {!canPremiumPlus && <Lock className="w-3 h-3 text-yellow-500" />}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={appPrice}
                    onChange={(e) => canPremiumPlus && setAppPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    disabled={!canPremiumPlus}
                    placeholder={!canPremiumPlus ? (language === 'ru' ? 'Только для Premium / Ultra' : 'Premium / Ultra Only') : ''}
                    className={clsx(
                      "w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors font-mono",
                      !canPremiumPlus && "opacity-50 cursor-not-allowed"
                    )}
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    {canPremiumPlus 
                      ? (language === 'ru' ? 'Установите 0 для бесплатного доступа. Пользователи будут платить эту сумму за доступ.' : 'Set to 0 for free. Users will pay this amount to access your app.')
                      : (language === 'ru' ? 'Установка цены доступна с уровня Premium или Ultra.' : 'Setting a price requires Premium or Ultra tier.')
                    }
                  </p>
                </div>

                {(!canPremiumPlus || isLocked) && (
                  <div>
                    <input
                      type="text"
                      placeholder="Enter unlock code..."
                      value={unlockCode}
                      onChange={(e) => setUnlockCode(e.target.value)}
                      disabled={!canPremiumPlus}
                      className={clsx(
                        "w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors font-mono",
                        !canPremiumPlus && "opacity-50 cursor-not-allowed"
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
                          <div className="w-12 h-12 rounded bg-[#21252C] border border-[#262B33] flex items-center justify-center text-xs font-bold text-[#10B981] truncate px-1">
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
            {/* AI Pre-check Status Banner */}
            {preCheckStatus?.checked && (
              <div className={clsx(
                "p-3 rounded-xl border mt-5 text-xs flex items-center justify-between gap-2 animate-in fade-in",
                preCheckStatus.approved 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              )}>
                <div className="flex items-center gap-2">
                  {preCheckStatus.approved ? (
                    <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
                  )}
                  <span>
                    {preCheckStatus.approved 
                      ? (language === 'ru' ? '✓ Одобрено ИИ (NVIDIA Nemotron 3.5). Проект готов к публикации.' : '✓ Approved by AI (Nemotron 3.5). Ready to publish.')
                      : (language === 'ru' ? `⚠ Отклонено ИИ: ${preCheckStatus.reason}` : `⚠ Rejected by AI: ${preCheckStatus.reason}`)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModerationModal(true)}
                  className="underline text-[11px] font-semibold hover:opacity-80 shrink-0 cursor-pointer"
                >
                  {language === 'ru' ? 'Подробнее' : 'Details'}
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 mt-8">
              {/* Pre-check AI Button */}
              <button
                type="button"
                onClick={handlePreCheckWithAi}
                disabled={isPreCheckingAi || isPublishing}
                className={clsx(
                  "px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 border cursor-pointer whitespace-nowrap",
                  preCheckStatus?.checked && preCheckStatus.approved
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25"
                    : preCheckStatus?.checked && !preCheckStatus.approved
                    ? "bg-red-500/15 border-red-500/40 text-red-400 hover:bg-red-500/25"
                    : "bg-[#21252C] hover:bg-[#2A2F38] border-[#262B33] text-[#F1F3F5]"
                )}
              >
                {isPreCheckingAi ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#10B981]" />
                    <span>{language === 'ru' ? 'ИИ проверяет...' : 'AI checking...'}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                    <span>{language === 'ru' ? 'Проверить через ИИ' : 'Pre-check with AI'}</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-3 ml-auto">
                <button
                  onClick={() => setShowPublishModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[#9BA1A6] hover:text-[#F1F3F5] transition-colors"
                >
                  {t.cancel}
                </button>
                {appCategory === 'Custom Editor' && (
                  <button
                    onClick={handlePublishToAssetStore}
                    disabled={isPublishing}
                    className="px-5 py-2 bg-[#21252C] hover:bg-[#2A2F38] border border-[#262B33] text-[#F1F3F5] rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Package className="w-4 h-4" /> Asset Store
                  </button>
                )}
                <button
                  onClick={handlePublish}
                  disabled={isPublishing || isPreCheckingAi || (preCheckStatus?.checked && !preCheckStatus.approved)}
                  className={clsx(
                    "px-5 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap",
                    preCheckStatus?.checked && !preCheckStatus.approved
                      ? "bg-[#21252C] text-[#6B7280] cursor-not-allowed border border-[#262B33]"
                      : "bg-[#10B981] hover:bg-[#059669] text-[#111315] disabled:opacity-50"
                  )}
                  title={preCheckStatus?.checked && !preCheckStatus.approved ? (language === 'ru' ? 'Исправьте нарушения перед публикацией' : 'Resolve violations before publishing') : ''}
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{publishingStepText || t.publishing}</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>{t.publishButton}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Publish as New Website Modal (.epl) */}
      {showPublishWebsiteModal && (() => {
        const canRemoveWatermark = canPremiumPlus;
        const previewSlug = websiteSlug
          .trim()
          .toLowerCase()
          .replace(/\.epl$/i, '')
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'my-site';
        return (
          <div className="fixed inset-0 z-[205] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className={clsx(
              "w-full max-w-md rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto border",
              isFrutigerAero ? "bg-white/85 border-white/60 backdrop-blur-md text-blue-950" :
              theme !== 'light' ? 'bg-zinc-900 border-zinc-800 text-[#F3F4F6]' : 'bg-white border-zinc-200 text-[#111315]'
            )}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-sky-500/15 border border-sky-500/35 text-sky-400">
                    <Globe className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold">
                    {language === 'ru' ? 'Опубликовать как новый сайт' : 'Publish as New Website'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPublishWebsiteModal(false)}
                  className="p-1.5 rounded-lg hover:bg-current/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs opacity-70 mb-5">
                {language === 'ru'
                  ? 'Ваш проект появится в App Store с кнопкой Visit и будет открываться как сайт в домене .epl.'
                  : 'Your project will appear in the Store with a Visit button and launch as an interactive .epl website.'}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1 opacity-70">
                    {language === 'ru' ? 'Название сайта' : 'Website Title'}
                  </label>
                  <input
                    type="text"
                    value={appTitle}
                    onChange={(e) => setAppTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1 opacity-70">
                    {language === 'ru' ? 'Домен .epl' : 'Custom .epl Domain'}
                  </label>
                  <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-800/50 overflow-hidden focus-within:border-sky-500">
                    <span className="px-2.5 py-2 text-xs font-mono opacity-55 border-r border-zinc-700 bg-zinc-900/60">
                      https://
                    </span>
                    <input
                      type="text"
                      value={websiteSlug}
                      onChange={(e) => setWebsiteSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="my-awesome-site"
                      className="flex-1 px-2.5 py-2 bg-transparent font-mono text-sm focus:outline-none min-w-0"
                    />
                    <span className="px-2.5 py-2 text-xs font-mono font-bold text-[#10B981] border-l border-zinc-700 bg-zinc-900/60">
                      .epl
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-sky-400 mt-1">
                    URL: https://{previewSlug}.epl
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1 opacity-70">
                    {t.description}
                  </label>
                  <textarea
                    value={appDesc}
                    onChange={(e) => setAppDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 text-sm focus:outline-none focus:border-sky-500 resize-none h-20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1 opacity-70">Category</label>
                  <CustomSelect
                    value={appCategory}
                    onChange={setAppCategory}
                    options={['apps', 'games', 'work', 'AI', 'Programming Language', 'Store', 'Custom Editor', 'Other'].map(cat => ({
                      value: cat,
                      label: cat
                    }))}
                  />
                </div>

                {/* Icon & Banner Upload */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-xl border border-zinc-700 bg-zinc-800/40">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold uppercase opacity-60">Site Icon</span>
                      <button
                        type="button"
                        onClick={() => websiteIconInputRef.current?.click()}
                        className="p-1 hover:bg-zinc-700 rounded cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="aspect-square rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center overflow-hidden">
                      {appIconUrl ? (
                        <img src={appIconUrl} alt="Site Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Globe className="w-7 h-7 opacity-25 text-sky-400" />
                      )}
                    </div>
                    <input
                      ref={websiteIconInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'icon')}
                      className="hidden"
                    />
                  </div>

                  <div className="p-3 rounded-xl border border-zinc-700 bg-zinc-800/40">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold uppercase opacity-60">Banner</span>
                      <button
                        type="button"
                        onClick={() => websiteBannerInputRef.current?.click()}
                        className="p-1 hover:bg-zinc-700 rounded cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="aspect-square rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center overflow-hidden">
                      {appBannerUrl ? (
                        <img src={appBannerUrl} alt="Site Banner" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <ImageIcon className="w-7 h-7 opacity-25" />
                      )}
                    </div>
                    <input
                      ref={websiteBannerInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'banner')}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Premium Watermark Toggle */}
                <div className="p-3.5 rounded-xl border border-zinc-700/80 bg-zinc-800/40 space-y-1.5">
                  <label className={clsx("flex items-center justify-between gap-2", canRemoveWatermark ? "cursor-pointer" : "cursor-not-allowed opacity-65")}>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-xs font-semibold">
                        {language === 'ru'
                          ? 'Убрать водяной знак "Created in EPL Studio"'
                          : 'Remove "Created in EPL Studio" watermark'}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={canRemoveWatermark ? hideWebsiteWatermark : false}
                      disabled={!canRemoveWatermark}
                      onChange={(e) => canRemoveWatermark && setHideWebsiteWatermark(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-600 text-emerald-500 focus:ring-emerald-500"
                    />
                  </label>
                  <p className="text-[11px] opacity-65">
                    {canRemoveWatermark
                      ? (language === 'ru'
                          ? 'Доступно для Premium: при включении заставка и водяной знак будут скрыты.'
                          : 'Premium unlocked: splash screen and watermark badge will be hidden.')
                      : (language === 'ru'
                          ? 'Требуется Premium, чтобы убрать заставку и надпись "Created in EPL Studio".'
                          : 'Premium required to hide the "Created in EPL Studio" intro & watermark.')}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-6">
                <button
                  type="button"
                  onClick={() => setShowPublishWebsiteModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium opacity-75 hover:opacity-100 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={handlePublishWebsite}
                  disabled={isPublishingWebsite}
                  className="px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-[#07111A] text-sm font-bold flex items-center gap-2 cursor-pointer"
                >
                  {isPublishingWebsite ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{language === 'ru' ? 'Публикация...' : 'Publishing...'}</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4" />
                      <span>{language === 'ru' ? 'Опубликовать сайт' : 'Publish Website'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* AI Moderation Result Modal */}
      {showModerationModal && moderationResult && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className={clsx(
            "w-full max-w-lg rounded-xl p-6 sm:p-7 shadow-2xl relative border",
            isFrutigerAero ? "frutiger-aero-glass border-white/60 text-blue-950" :
            theme !== 'light' ? "bg-[#181B20] border-[#262B33] text-[#F1F3F5]" : "bg-white border-[#E2E5EA] text-[#111315]"
          )}>
            <div className="flex items-center gap-3 mb-5">
              <div className={clsx(
                "p-3 rounded-lg border",
                moderationResult.approved 
                  ? "bg-emerald-500/10 text-[#10B981] border-emerald-500/30" 
                  : "bg-red-500/10 text-red-500 border-red-500/30"
              )}>
                {moderationResult.approved ? (
                  <ShieldCheck className="w-7 h-7" />
                ) : (
                  <ShieldAlert className="w-7 h-7" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold">
                  {moderationResult.approved 
                    ? (language === 'ru' ? 'Проект проверен и одобрен ИИ' : 'Project Verified & Approved by AI')
                    : (language === 'ru' ? 'Проект отклонен модерацией ИИ' : 'Project Rejected by AI Moderation')
                  }
                </h3>
                <div className="text-xs text-[#9BA1A6] flex items-center gap-1.5 mt-0.5">
                  <Cpu className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>
                    {moderationResult.modelUsed && moderationResult.modelUsed !== 'local-heuristic'
                      ? `Nemotron AI (${moderationResult.modelUsed.split('/').pop()})`
                      : 'AI Security Audit'}
                  </span>
                </div>
              </div>
            </div>

            <div className={clsx(
              "p-4 rounded-2xl border mb-5 text-sm leading-relaxed",
              moderationResult.approved 
                ? (theme !== 'light' ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-200" : "bg-emerald-50 border-emerald-200 text-emerald-900")
                : (theme !== 'light' ? "bg-red-950/20 border-red-800/40 text-red-200" : "bg-red-50 border-red-200 text-red-900")
            )}>
              <div className="font-semibold text-xs uppercase tracking-wider mb-1.5 opacity-70">
                {language === 'ru' ? 'Заключение модерации:' : 'Moderation Report:'}
              </div>
              <p>{moderationResult.reason}</p>
            </div>

            {moderationResult.flags && moderationResult.flags.length > 0 && (
              <div className="mb-5">
                <span className="text-xs font-bold uppercase tracking-wider opacity-60 block mb-2">
                  {language === 'ru' ? 'Зафиксированные маркеры:' : 'Detected Flags:'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {moderationResult.flags.map((flag, i) => (
                    <span 
                      key={i} 
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20"
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowModerationModal(false)}
                className={clsx(
                  "flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-colors",
                  moderationResult.approved
                    ? (isFrutigerAero ? "frutiger-aero-button" : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20")
                    : (isFrutigerAero ? "bg-white/60 text-blue-900 border border-blue-200" : "bg-zinc-800 hover:bg-zinc-700 text-white")
                )}
              >
                {moderationResult.approved 
                  ? (language === 'ru' ? 'Отлично' : 'Awesome') 
                  : (language === 'ru' ? 'Редактировать проект' : 'Fix & Edit Project')
                }
              </button>
              {moderationResult.approved && (
                <button
                  onClick={() => {
                    setShowModerationModal(false);
                    setCurrentView('store');
                  }}
                  className="px-5 py-3 rounded-xl font-bold text-sm bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
                >
                  {language === 'ru' ? 'В Магазин' : 'Go to Store'}
                </button>
              )}
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
              {mergedProjectFiles.length > 0 ? (
                mergedProjectFiles.map((file, idx) => (
                  <div 
                    key={idx} 
                    className={clsx(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors group",
                      isFrutigerAero ? "bg-white/40 border-white/50 hover:border-blue-400/50" : "bg-zinc-800/50 border-zinc-700 hover:border-emerald-500/50"
                    )}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={clsx("w-10 h-10 rounded flex items-center justify-center flex-shrink-0", isFrutigerAero ? "bg-blue-500/20" : "bg-zinc-700")}>
                        {file.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? (
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
                          notify.success(language === 'en' ? 'File name copied!' : 'Имя файла скопировано!');
                        }}
                        className={clsx("p-2 rounded-lg transition-colors", isFrutigerAero ? "hover:bg-white/50 text-blue-800/60 hover:text-blue-600" : "hover:bg-zinc-700 text-zinc-400 hover:text-emerald-400")}
                        title={language === 'en' ? 'Copy Name' : 'Копировать имя'}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(file.url);
                          notify.success(language === 'en' ? 'URL copied!' : 'URL скопирован!');
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
            "w-full max-w-3xl rounded-xl p-6 shadow-2xl max-h-[80vh] flex flex-col border",
            isFrutigerAero ? "frutiger-aero-glass border-white/50" :
            theme !== 'light' ? 'bg-[#181B20] border-[#262B33] text-[#F1F3F5]' : 'bg-white border-[#E2E5EA] text-[#111315]'
          )}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={clsx("text-xl font-bold flex items-center gap-2", isFrutigerAero ? "text-blue-900" : "")}>
                <Store className={clsx("w-5 h-5", isFrutigerAero ? "text-blue-500" : "text-[#10B981]")} />
                Editor Store
              </h3>
              <div className="flex items-center gap-4">
                <div className={clsx("flex items-center gap-2 px-3 py-1 rounded-lg border font-mono-num", isFrutigerAero ? "bg-white/50 border-white/60 shadow-inner" : "bg-[#111315] border-[#262B33]")}>
                  <span className={clsx("font-bold text-xs", isFrutigerAero ? "text-blue-600" : "text-[#10B981]")}>EPL</span>
                  <span className={clsx("font-mono text-sm", isFrutigerAero ? "text-blue-900" : "text-[#F1F3F5]")}>{userData?.eplCoins || 0}</span>
                </div>
                <button onClick={() => setShowEditorStoreModal(false)} className={clsx("hover:text-zinc-300", isFrutigerAero ? "text-blue-800/60 hover:text-blue-800" : "text-zinc-500")}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: 'premium', title: 'Premium Access', desc: 'Unlock all premium features including app locking and copying.', price: 100, type: 'feature', icon: ShieldCheck },
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
      {(() => {
        const parsed = findFirstDifrenoptInCode(code);
        return (
          <DifrenoptConfigModal
            isOpen={showDrplStudioModal}
            onClose={() => setShowDrplStudioModal(false)}
            initialParams={parsed?.params}
            initialDrplCode={parsed?.drplCode}
            onApply={(nextParams, nextDrpl) => {
              const nextCode = upsertDifrenoptInCode(code, nextParams, nextDrpl, parsed?.startLine);
              handleCodeChange(nextCode);
              if (!livePreviewEnabled) setLivePreviewEnabled(true);
            }}
          />
        );
      })()}
    </div>
  );
}
