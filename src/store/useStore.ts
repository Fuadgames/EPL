import { startTransition } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from 'firebase/auth';
import { ACHIEVEMENTS_DB, AchievementData } from '../lib/achievements';
import { updateDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { sanitizeFirestoreData } from '../lib/firestore-utils';
import { PremiumTier, EplSiteCustomizationSpec, EplShopItem } from '../types';
import { STARTER_EDITOR_CODE } from '../lib/demoProjects';

export type View =
  | 'store'
  | 'installed-apps'
  | 'editor'
  | 'my-apps'
  | 'profile'
  | 'public-profile'
  | 'settings'
  | 'player'
  | 'premium'
  | 'extra-premium'
  | 'rate'
  | 'control'
  | 'asset-store'
  | 'epl-shop'
  | 'leaderboards'
  | 'donate'
  | 'news'
  | `custom_${string}`;

export const DEFAULT_NAV_CATEGORY_ORDER = [
  'store',
  'tools',
  'my-stuff',
  'global',
  'paid',
  'developer-tools',
];

export const DEFAULT_NAV_TAB_ORDERS: Record<string, string[]> = {
  store: ['store', 'asset-store', 'epl-shop', 'donate'],
  tools: ['editor', 'settings'],
  'my-stuff': ['installed-apps', 'profile', 'my-apps'],
  global: ['leaderboards', 'news', 'rate'],
  paid: ['premium', 'extra-premium', 'donate'],
  'developer-tools': ['control'],
};

export function createEmptyEplSiteSpec(): EplSiteCustomizationSpec {
  return {
    brandTitle: '',
    brandSubtitle: '',
    brandBadge: '',
    brandIcon: 'terminal',
    theme: {
      canvasBg: '',
      canvasGradient: '',
      sidebarBg: '',
      cardBg: '',
      textColor: '',
      mutedColor: '',
      accentColor: '',
      secondaryColor: '',
      borderColor: '',
      borderRadius: 12,
      fontFamily: 'default',
      fontScale: 1,
      sidebarWidth: 256,
      sidebarSide: 'left',
      glassBlur: 0,
      glowIntensity: 0,
      bgEffect: 'none',
    },
    labelOverrides: {},
    domTextOverrides: {},
    domStyleOverrides: {},
    categoryOrder: [...DEFAULT_NAV_CATEGORY_ORDER],
    categoryNames: {},
    categoryColors: {},
    tabOrders: {
      store: [...DEFAULT_NAV_TAB_ORDERS.store],
      tools: [...DEFAULT_NAV_TAB_ORDERS.tools],
      'my-stuff': [...DEFAULT_NAV_TAB_ORDERS['my-stuff']],
      global: [...DEFAULT_NAV_TAB_ORDERS.global],
      paid: [...DEFAULT_NAV_TAB_ORDERS.paid],
      'developer-tools': [...DEFAULT_NAV_TAB_ORDERS['developer-tools']],
    },
    hiddenTabIds: [],
    customCategories: [],
    customTabs: [],
    widgets: [],
    tabEplOverlays: {},
    globalEplCode: '',
  };
}

export interface ProjectFileItem {
  name: string;
  url: string;
  size?: number;
  type?: string;
  uploadedAt?: string;
}

export interface InstalledAppItem {
  id: string; // projectId
  projectId: string;
  projectName: string;
  version: string;
  installedAt: string;
  icon?: string;
  description?: string;
  authorName?: string;
  category?: string;
  status: 'ready' | 'installed' | 'updating';
  supportedPlatforms?: string[];
  code?: string;
  webUrl?: string;
}

export interface UserPermissions {
  accessRecent: boolean;
  accessAssetStore: boolean;
  accessPremium: boolean;
  accessControl: boolean;
  sellInAssetStore: boolean;
  publishApps: boolean;
  premiumFeatures: boolean;
}

export type UserRole = 'user' | 'admin' | 'moderator' | 'developer' | 'shopkeeper';

export interface UserData {
  uid?: string;
  name?: string;
  email?: string;
  photoUrl?: string;
  avatarUrl?: string;
  region?: string;
  friends?: string[];
  role: UserRole;
  isVerifiedAuthor?: boolean;
  eplCoins: number;
  purchasedItems: string[];
  eplShopPurchases?: Record<string, number>;
  uploadedFiles?: { name: string; url: string }[];
  permissions?: UserPermissions;
  installedApps?: { [appId: string]: string }; // appId -> version
  installedAppsList?: InstalledAppItem[];
  purchasedApps?: string[]; // list of appIds
  unlockedAchievements?: string[]; // list of achievement ids
  createdAt?: string;
  premiumExpiry?: string | null;
  isPremium?: boolean;
  premiumTier?: PremiumTier;
  isBanned?: boolean;
  banReason?: string;
  roleVerification?: string;
  roleVerifiedBy?: string;
  roleVerifiedAt?: string;
}

export interface ExtraPremiumSettings {
  matrixRain: boolean;
  matrixColor: string;
  matrixSpeed: number;
  matrixOpacity: number;
  confettiAutoRain: boolean;
  confettiPreset: 'party' | 'royal' | 'cyber';
  confettiBurstNonce: number;
  accentGlowEnabled: boolean;
  accentGlowColor: string;
  typewriterSfxEnabled: boolean;
  typewriterPack: 'mech' | 'synth' | 'retro';
  typewriterVolume: number;
  pomodoroEnabled: boolean;
  pomodoroMinutes: number;
  pomodoroDrone: boolean;
  rgbCursorEnabled: boolean;
  rgbCursorStyle: 'sparkles' | 'matrix' | 'gold';
  screenFlipEnabled: boolean;
  screenFlipMode: 'upside-down' | 'mirror' | 'tilt';
  discoPartyEnabled: boolean;
  discoSpeed: number;
  earthquakeEnabled: boolean;
  earthquakeIntensity: number;
  textTransformEnabled: boolean;
  textTransformMode: 'uwu' | 'leet' | 'reverse';
  textTransformSample: string;
  hackerHudEnabled: boolean;
}

export const DEFAULT_EXTRA_PREMIUM_SETTINGS: ExtraPremiumSettings = {
  matrixRain: false,
  matrixColor: '#10b981',
  matrixSpeed: 1,
  matrixOpacity: 0.25,
  confettiAutoRain: false,
  confettiPreset: 'party',
  confettiBurstNonce: 0,
  accentGlowEnabled: false,
  accentGlowColor: '#10b981',
  typewriterSfxEnabled: false,
  typewriterPack: 'mech',
  typewriterVolume: 0.25,
  pomodoroEnabled: false,
  pomodoroMinutes: 25,
  pomodoroDrone: false,
  rgbCursorEnabled: false,
  rgbCursorStyle: 'sparkles',
  screenFlipEnabled: false,
  screenFlipMode: 'upside-down',
  discoPartyEnabled: false,
  discoSpeed: 2,
  earthquakeEnabled: false,
  earthquakeIntensity: 4,
  textTransformEnabled: false,
  textTransformMode: 'uwu',
  textTransformSample: 'EPL Studio Extra Premium is awesome!',
  hackerHudEnabled: false,
};

interface AppState {
  currentView: View;
  setCurrentView: (view: View) => void;
  user: User | null;
  setUser: (user: User | null) => void;
  userData: UserData | null;
  setUserData: (userData: UserData | null) => void;
  theme: 'light' | 'dark' | 'gradient';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark' | 'gradient') => void;
  editingAppId: string | null;
  setEditingAppId: (id: string | null) => void;
  code: string;
  setCode: (code: string) => void;
  playingAppId: string | null;
  setPlayingAppId: (id: string | null) => void;
  selectedAppId: string | null;
  setSelectedAppId: (id: string | null) => void;
  copiedAppData: any | null;
  setCopiedAppData: (data: any | null) => void;
  aiAnswerMode: 'text' | 'console';
  setAiAnswerMode: (mode: 'text' | 'console') => void;
  aiChangesEnabled: boolean;
  setAiChangesEnabled: (enabled: boolean) => void;
  language: string;
  setLanguage: (lang: string) => void;
  autoTranslateEnabled: boolean;
  setAutoTranslateEnabled: (enabled: boolean) => void;
  tutorialMinimized: boolean;
  setTutorialMinimized: (minimized: boolean) => void;
  tutorialLevel: number;
  setTutorialLevel: (level: number) => void;
  tutorialStep: number;
  setTutorialStep: (step: number) => void;
  tutorialStepCompleted: boolean;
  setTutorialStepCompleted: (completed: boolean) => void;
  tutorialCheckRequested: boolean;
  setTutorialCheckRequested: (requested: boolean) => void;
  isPremium: boolean;
  setIsPremium: (isPremium: boolean) => void;
  premiumTier: PremiumTier;
  setPremiumTier: (tier: PremiumTier) => void;
  extraPremiumSettings: ExtraPremiumSettings;
  setExtraPremiumSetting: <K extends keyof ExtraPremiumSettings>(key: K, value: ExtraPremiumSettings[K]) => void;
  resetExtraPremiumSettings: () => void;
  aiMode: 'fast' | 'thinking' | 'pro';
  setAiMode: (mode: 'fast' | 'thinking' | 'pro') => void;
  requestCount: number;
  setRequestCount: (count: number) => void;
  lastResetTime: string;
  setLastResetTime: (time: string) => void;
  computerStyle: boolean;
  setComputerStyle: (enabled: boolean) => void;
  selectedExtraCategory: 'Normal' | 'OS' | 'Asset' | 'PreviewEditing' | 'CustomEditor' | 'BlockEditing' | string | null;
  setSelectedExtraCategory: (category: 'Normal' | 'OS' | 'Asset' | 'PreviewEditing' | 'CustomEditor' | 'BlockEditing' | string | null) => void;
  previewType: '2D' | '3D' | null;
  setPreviewType: (type: '2D' | '3D' | null) => void;
  addSceneNode: (node: any) => void;
  setAddSceneNode: (fn: (node: any) => void) => void;
  isFrutigerAero: boolean;
  setIsFrutigerAero: (enabled: boolean) => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (isOpen: boolean) => void;
  simulatedRole: UserRole | null;
  setSimulatedRole: (role: UserRole | null) => void;
  premiumCode: string | null;
  setPremiumCode: (code: string | null) => void;
  premiumExpiry: string | null;
  setPremiumExpiry: (expiry: string | null) => void;
  viewingProfileId: string | null;
  setViewingProfileId: (id: string | null) => void;
  achievementQueue: AchievementData[];
  popAchievement: () => void;
  unlockAchievement: (id: string) => void;
  collabSessionId: string | null;
  setCollabSessionId: (id: string | null) => void;
  collabLockedLines: Record<number, { uid: string, name: string }>;
  setCollabLockedLines: (lines: Record<number, { uid: string, name: string }>) => void;
  collabLocalLockIndex: number | null;
  setCollabLocalLockIndex: (index: number | null) => void;
  installedAppsList: InstalledAppItem[];
  setInstalledAppsList: (apps: InstalledAppItem[]) => void;
  installApp: (app: any) => Promise<void>;
  removeInstalledApp: (projectId: string) => Promise<void>;
  isAppInstalled: (projectId: string) => boolean;
  livePreviewEnabled: boolean;
  setLivePreviewEnabled: (enabled: boolean) => void;
  projectFiles: ProjectFileItem[];
  setProjectFiles: (files: ProjectFileItem[]) => void;
  addProjectFile: (file: ProjectFileItem) => void;
  removeProjectFile: (name: string) => void;
  hiddenTabs: string[];
  hideTab: (tabId: string) => void;
  showTab: (tabId: string) => void;
  toggleTabVisibility: (tabId: string) => void;
  restoreAllTabs: () => void;
  isSidebarHidden: boolean;
  setIsSidebarHidden: (hidden: boolean) => void;
  toggleSidebarHidden: () => void;
  isMobileNavHidden: boolean;
  setIsMobileNavHidden: (hidden: boolean) => void;
  toggleMobileNavHidden: () => void;
  isDesktopDownloadOpen: boolean;
  setIsDesktopDownloadOpen: (open: boolean) => void;
  legacyNavigation: boolean;
  setLegacyNavigation: (enabled: boolean) => void;
  collapsedNavCategories: string[];
  toggleNavCategoryCollapsed: (catId: string) => void;
  navCategoryOrder: string[];
  setNavCategoryOrder: (order: string[]) => void;
  moveNavCategory: (catId: string, dir: 'up' | 'down') => void;
  reorderNavCategories: (fromId: string, toId: string) => void;
  navTabOrders: Record<string, string[]>;
  setNavTabOrder: (catId: string, tabIds: string[]) => void;
  reorderNavTab: (catId: string, fromTabId: string, toTabId: string) => void;
  moveNavTab: (catId: string, tabId: string, dir: 'up' | 'down') => void;
  resetNavOrder: () => void;
  isEplShopBuilderOpen: boolean;
  eplShopPreviewMode: boolean;
  eplShopBuilderTool: 'select' | 'add' | 'tap';
  editingShopItemId: string | null;
  editingShopItem: EplShopItem | null;
  selectedBuilderWidgetId: string | null;
  setSelectedBuilderWidgetId: (id: string | null) => void;
  draftEplShopSpec: EplSiteCustomizationSpec;
  appliedEplShopItemId: string | null;
  appliedEplShopSpec: EplSiteCustomizationSpec | null;
  previewEplShopSpec: EplSiteCustomizationSpec | null;
  purchasedEplShopIds: string[];
  openEplShopBuilder: (item?: EplShopItem | null) => void;
  closeEplShopBuilder: () => void;
  setEplShopPreviewMode: (preview: boolean) => void;
  setEplShopBuilderTool: (tool: 'select' | 'add' | 'tap') => void;
  updateDraftEplShopSpec: (updater: (prev: EplSiteCustomizationSpec) => EplSiteCustomizationSpec) => void;
  applyEplShopItem: (item: EplShopItem | null) => Promise<void>;
  setPreviewEplShopSpec: (spec: EplSiteCustomizationSpec | null) => void;
  markPurchasedEplShopId: (id: string) => void;
  unmarkPurchasedEplShopId: (id: string) => void;
}

export const useStore = create<AppState>()(persist((set, get) => ({
  currentView: 'store',
  setCurrentView: (view) => startTransition(() => { set({ currentView: view }); }),
  user: null,
  setUser: (user) => startTransition(() => { set({ user }); }),
  userData: null,
  setUserData: (userData) => startTransition(() => {
    set((state) => {
      const currentList = state.installedAppsList || [];
      const userList = userData?.installedAppsList || [];
      
      // Union merge: never lose locally installed items when snapshot arrives
      const itemMap = new Map<string, InstalledAppItem>();
      currentList.forEach(item => {
        const key = item.projectId || item.id;
        if (key) itemMap.set(key, item);
      });
      userList.forEach(item => {
        const key = item.projectId || item.id;
        if (key) {
          itemMap.set(key, { ...(itemMap.get(key) || {}), ...item });
        }
      });
      const mergedList = Array.from(itemMap.values());

      const mergedInstalledMap: { [key: string]: string } = {
        ...(state.userData?.installedApps || {}),
        ...(userData?.installedApps || {})
      };
      mergedList.forEach(item => {
        const key = item.projectId || item.id;
        if (key && !mergedInstalledMap[key]) {
          mergedInstalledMap[key] = item.version || '1.0.0';
        }
      });

      return { 
        userData: userData ? { 
          ...userData, 
          installedApps: mergedInstalledMap,
          installedAppsList: mergedList 
        } : null,
        installedAppsList: mergedList
      };
    });
  }),
  theme: 'dark',
  toggleTheme: () => startTransition(() => { set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })); }),
  setTheme: (theme) => startTransition(() => { set({ theme }); }),
  editingAppId: null,
  setEditingAppId: (id) => startTransition(() => { set({ editingAppId: id }); }),
  code: STARTER_EDITOR_CODE,
  setCode: (code) => set({ code }),
  playingAppId: null,
  setPlayingAppId: (id) => startTransition(() => { set({ playingAppId: id }); }),
  selectedAppId: null,
  setSelectedAppId: (id) => startTransition(() => { set({ selectedAppId: id }); }),
  copiedAppData: null,
  setCopiedAppData: (data) => set({ copiedAppData: data }),
  aiAnswerMode: 'text',
  setAiAnswerMode: (mode) => set({ aiAnswerMode: mode }),
  aiChangesEnabled: false,
  setAiChangesEnabled: (enabled) => set({ aiChangesEnabled: enabled }),
  language: 'en',
  setLanguage: (lang) => set({ language: lang }),
  autoTranslateEnabled: true,
  setAutoTranslateEnabled: (enabled) => set({ autoTranslateEnabled: enabled }),
  tutorialMinimized: false,
  setTutorialMinimized: (minimized) => set({ tutorialMinimized: minimized }),
  tutorialLevel: 0,
  setTutorialLevel: (level) => set({ tutorialLevel: level }),
  tutorialStep: 0,
  setTutorialStep: (step) => set({ tutorialStep: step }),
  tutorialStepCompleted: false,
  setTutorialStepCompleted: (completed) => set({ tutorialStepCompleted: completed }),
  tutorialCheckRequested: false,
  setTutorialCheckRequested: (requested) => set({ tutorialCheckRequested: requested }),
  isPremium: false,
  setIsPremium: (isPremium) => set({ isPremium }),
  premiumTier: 'none',
  setPremiumTier: (premiumTier) => set({ premiumTier }),
  extraPremiumSettings: DEFAULT_EXTRA_PREMIUM_SETTINGS,
  setExtraPremiumSetting: (key, value) => set((state) => ({
    extraPremiumSettings: { ...state.extraPremiumSettings, [key]: value },
  })),
  resetExtraPremiumSettings: () => set({ extraPremiumSettings: DEFAULT_EXTRA_PREMIUM_SETTINGS }),
  aiMode: 'fast',
  setAiMode: (mode) => set({ aiMode: mode }),
  requestCount: 0,
  setRequestCount: (count) => set({ requestCount: count }),
  lastResetTime: new Date().toISOString(),
  setLastResetTime: (time) => set({ lastResetTime: time }),
  computerStyle: false,
  setComputerStyle: (enabled) => set({ computerStyle: enabled }),
  selectedExtraCategory: 'Normal',
  setSelectedExtraCategory: (category) => set({ selectedExtraCategory: category }),
  previewType: null,
  setPreviewType: (type) => set({ previewType: type }),
  addSceneNode: () => {},
  setAddSceneNode: (fn) => set({ addSceneNode: fn }),
  isFrutigerAero: false,
  setIsFrutigerAero: (enabled) => set({ isFrutigerAero: enabled }),
  isAuthModalOpen: false,
  setIsAuthModalOpen: (isOpen) => set({ isAuthModalOpen: isOpen }),
  simulatedRole: null,
  setSimulatedRole: (role) => set({ simulatedRole: role }),
  premiumCode: null,
  setPremiumCode: (code) => set({ premiumCode: code }),
  premiumExpiry: null,
  setPremiumExpiry: (expiry) => set({ premiumExpiry: expiry }),
  viewingProfileId: null,
  setViewingProfileId: (id) => set({ viewingProfileId: id }),
  achievementQueue: [],
  popAchievement: () => set((state) => {
    try {
      return { achievementQueue: state.achievementQueue.slice(1) };
    } catch (e) {
      console.error("Error popping achievement:", e);
      return state;
    }
  }),
  unlockAchievement: (id) => {
    set((state) => {
      const userData = state.userData;
      if (!userData || !userData.uid) return state;
      const unlocked = userData.unlockedAchievements || [];
      if (unlocked.includes(id)) return state;
      
      const newUnlocked = [...unlocked, id];
      const achievement = ACHIEVEMENTS_DB[id];
      
      // Async save when Firebase Auth session is active
      if (auth.currentUser && auth.currentUser.uid === userData.uid) {
        updateDoc(doc(db, 'users', userData.uid), { unlockedAchievements: newUnlocked }).catch(err => {
          console.error("Failed to check app achievements", err);
        });
      }

      return {
        userData: { ...userData, unlockedAchievements: newUnlocked },
        // Forced rebuild: check achievementQueue update
        achievementQueue: achievement ? [...state.achievementQueue, achievement] : state.achievementQueue
      };
    });
  },
  collabSessionId: null,
  setCollabSessionId: (id) => set({ collabSessionId: id }),
  collabLockedLines: {},
  setCollabLockedLines: (lines) => set({ collabLockedLines: lines }),
  collabLocalLockIndex: null,
  setCollabLocalLockIndex: (index) => set({ collabLocalLockIndex: index }),
  installedAppsList: [],
  setInstalledAppsList: (apps) => set({ installedAppsList: apps }),
  isAppInstalled: (projectId: string) => {
    const state = get();
    if (!projectId) return false;
    if (state.userData?.installedApps?.[projectId]) return true;
    if (state.userData?.installedAppsList?.some(i => i.projectId === projectId || i.id === projectId)) return true;
    if (state.installedAppsList?.some(i => i.projectId === projectId || i.id === projectId)) return true;
    try {
      const stored = localStorage.getItem('app-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.state?.installedAppsList?.some((i: any) => i.projectId === projectId || i.id === projectId)) {
          return true;
        }
      }
    } catch (_) {}
    return false;
  },
  installApp: async (app: any) => {
    const state = get();
    const projectId = app.id || app.projectId;
    if (!projectId) return;

    const newItem: InstalledAppItem = {
      id: projectId,
      projectId: projectId,
      projectName: app.title || app.projectName || 'Untitled App',
      version: app.version || '1.0.0',
      installedAt: new Date().toISOString(),
      icon: app.iconUrl || app.icon || '',
      description: app.description || '',
      authorName: app.authorName || 'Unknown',
      category: app.category || 'apps',
      status: 'ready',
      supportedPlatforms: app.supportedPlatforms || ['windows', 'macos', 'linux', 'android', 'ios'],
      code: app.code || ''
    };

    const currentList = state.installedAppsList || [];
    const exists = currentList.some(item => item.projectId === projectId || item.id === projectId);
    const updatedList = exists 
      ? currentList.map(item => (item.projectId === projectId || item.id === projectId) ? { ...item, ...newItem } : item)
      : [newItem, ...currentList];

    const currentInstalledMap = { ...(state.userData?.installedApps || {}), [projectId]: newItem.version };

    // Update state immediately
    set({
      installedAppsList: updatedList,
      userData: state.userData ? {
        ...state.userData,
        installedApps: currentInstalledMap,
        installedAppsList: updatedList
      } : null
    });

    // Sync with Firestore if Firebase user is authenticated
    if (state.user?.uid && auth.currentUser?.uid === state.user.uid) {
      try {
        const userRef = doc(db, 'users', state.user.uid);
        await updateDoc(userRef, {
          installedApps: currentInstalledMap,
          installedAppsList: updatedList
        }).catch(async () => {
          // Fallback with setDoc merge
          await setDoc(userRef, {
            installedApps: currentInstalledMap,
            installedAppsList: updatedList
          }, { merge: true });
        });

        // Also save to top-level installed_apps collection
        const installDocRef = doc(db, 'installed_apps', `${state.user.uid}_${projectId}`);
        await setDoc(installDocRef, {
          userId: state.user.uid,
          ...newItem
        }, { merge: true });
      } catch (err) {
        console.warn('Notice: Local app install preserved, Firestore sync caught:', err);
      }
    }
  },
  removeInstalledApp: async (projectId: string) => {
    const state = get();
    const updatedList = (state.installedAppsList || []).filter(item => item.projectId !== projectId && item.id !== projectId);
    
    const currentInstalledMap = { ...(state.userData?.installedApps || {}) };
    delete currentInstalledMap[projectId];

    set({
      installedAppsList: updatedList,
      userData: state.userData ? {
        ...state.userData,
        installedApps: currentInstalledMap,
        installedAppsList: updatedList
      } : null
    });

    if (state.user?.uid && auth.currentUser?.uid === state.user.uid) {
      try {
        const userRef = doc(db, 'users', state.user.uid);
        await updateDoc(userRef, {
          installedApps: currentInstalledMap,
          installedAppsList: updatedList
        });

        const installDocRef = doc(db, 'installed_apps', `${state.user.uid}_${projectId}`);
        await deleteDoc(installDocRef).catch(() => {});
      } catch (err) {
        console.error('Error removing installed app from Firestore:', err);
      }
    }
  },
  livePreviewEnabled: true,
  setLivePreviewEnabled: (enabled) => set({ livePreviewEnabled: enabled }),
  projectFiles: [],
  setProjectFiles: (files) => set({ projectFiles: files }),
  addProjectFile: (file) => set((state) => {
    const existing = state.projectFiles || [];
    const filtered = existing.filter((f) => f.name !== file.name);
    return { projectFiles: [file, ...filtered] };
  }),
  removeProjectFile: (name) => set((state) => ({
    projectFiles: (state.projectFiles || []).filter((f) => f.name !== name),
  })),
  hiddenTabs: [],
  hideTab: (tabId) => set((state) => {
    if (!tabId || tabId === 'settings') return state;
    const current = state.hiddenTabs || [];
    const nextHidden = current.includes(tabId) ? current : [...current, tabId];
    const nextView = state.currentView === tabId ? 'settings' : state.currentView;
    return { hiddenTabs: nextHidden, currentView: nextView };
  }),
  showTab: (tabId) => set((state) => ({
    hiddenTabs: (state.hiddenTabs || []).filter((id) => id !== tabId),
  })),
  toggleTabVisibility: (tabId) => {
    const state = get();
    if (!tabId || tabId === 'settings') return;
    if ((state.hiddenTabs || []).includes(tabId)) {
      state.showTab(tabId);
    } else {
      state.hideTab(tabId);
    }
  },
  restoreAllTabs: () => set({ hiddenTabs: [] }),
  isSidebarHidden: false,
  setIsSidebarHidden: (hidden) => set({ isSidebarHidden: hidden }),
  toggleSidebarHidden: () => set((state) => ({ isSidebarHidden: !state.isSidebarHidden })),
  isMobileNavHidden: false,
  setIsMobileNavHidden: (hidden) => set({ isMobileNavHidden: hidden }),
  toggleMobileNavHidden: () => set((state) => ({ isMobileNavHidden: !state.isMobileNavHidden })),
  isDesktopDownloadOpen: false,
  setIsDesktopDownloadOpen: (open) => set({ isDesktopDownloadOpen: open }),
  legacyNavigation: false,
  setLegacyNavigation: (enabled) => set({ legacyNavigation: enabled }),
  collapsedNavCategories: [],
  toggleNavCategoryCollapsed: (catId) => set((state) => {
    const current = state.collapsedNavCategories || [];
    const exists = current.includes(catId);
    return {
      collapsedNavCategories: exists ? current.filter((id) => id !== catId) : [...current, catId],
    };
  }),
  navCategoryOrder: [...DEFAULT_NAV_CATEGORY_ORDER],
  setNavCategoryOrder: (order) => set({ navCategoryOrder: order }),
  moveNavCategory: (catId, dir) => set((state) => {
    const order = [...(state.navCategoryOrder?.length ? state.navCategoryOrder : DEFAULT_NAV_CATEGORY_ORDER)];
    const idx = order.indexOf(catId);
    if (idx === -1) return state;
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= order.length) return state;
    const [moved] = order.splice(idx, 1);
    order.splice(targetIdx, 0, moved);
    return { navCategoryOrder: order };
  }),
  reorderNavCategories: (fromId, toId) => set((state) => {
    if (!fromId || !toId || fromId === toId) return state;
    const order = [...(state.navCategoryOrder?.length ? state.navCategoryOrder : DEFAULT_NAV_CATEGORY_ORDER)];
    if (!order.includes(fromId)) order.push(fromId);
    if (!order.includes(toId)) order.push(toId);
    const fromIdx = order.indexOf(fromId);
    const toIdx = order.indexOf(toId);
    if (fromIdx === -1 || toIdx === -1) return state;
    const [moved] = order.splice(fromIdx, 1);
    order.splice(toIdx, 0, moved);
    return { navCategoryOrder: order };
  }),
  navTabOrders: { ...DEFAULT_NAV_TAB_ORDERS },
  setNavTabOrder: (catId, tabIds) => set((state) => ({
    navTabOrders: { ...(state.navTabOrders || DEFAULT_NAV_TAB_ORDERS), [catId]: tabIds },
  })),
  reorderNavTab: (catId, fromTabId, toTabId) => set((state) => {
    if (!fromTabId || !toTabId || fromTabId === toTabId) return state;
    const base = [...(state.navTabOrders?.[catId] || DEFAULT_NAV_TAB_ORDERS[catId] || [])];
    if (!base.includes(fromTabId)) base.push(fromTabId);
    if (!base.includes(toTabId)) base.push(toTabId);
    const fromIdx = base.indexOf(fromTabId);
    const toIdx = base.indexOf(toTabId);
    if (fromIdx === -1 || toIdx === -1) return state;
    const [moved] = base.splice(fromIdx, 1);
    base.splice(toIdx, 0, moved);
    return { navTabOrders: { ...(state.navTabOrders || DEFAULT_NAV_TAB_ORDERS), [catId]: base } };
  }),
  moveNavTab: (catId, tabId, dir) => set((state) => {
    const base = [...(state.navTabOrders?.[catId] || DEFAULT_NAV_TAB_ORDERS[catId] || [])];
    const idx = base.indexOf(tabId);
    if (idx === -1) return state;
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= base.length) return state;
    const [moved] = base.splice(idx, 1);
    base.splice(targetIdx, 0, moved);
    return { navTabOrders: { ...(state.navTabOrders || DEFAULT_NAV_TAB_ORDERS), [catId]: base } };
  }),
  resetNavOrder: () => set({
    collapsedNavCategories: [],
    navCategoryOrder: [...DEFAULT_NAV_CATEGORY_ORDER],
    navTabOrders: {
      store: [...DEFAULT_NAV_TAB_ORDERS.store],
      tools: [...DEFAULT_NAV_TAB_ORDERS.tools],
      'my-stuff': [...DEFAULT_NAV_TAB_ORDERS['my-stuff']],
      global: [...DEFAULT_NAV_TAB_ORDERS.global],
      paid: [...DEFAULT_NAV_TAB_ORDERS.paid],
      'developer-tools': [...DEFAULT_NAV_TAB_ORDERS['developer-tools']],
    },
  }),
  isEplShopBuilderOpen: false,
  eplShopPreviewMode: false,
  eplShopBuilderTool: 'select',
  editingShopItemId: null,
  editingShopItem: null,
  selectedBuilderWidgetId: null,
  setSelectedBuilderWidgetId: (id) => set({ selectedBuilderWidgetId: id }),
  draftEplShopSpec: createEmptyEplSiteSpec(),
  appliedEplShopItemId: null,
  appliedEplShopSpec: null,
  previewEplShopSpec: null,
  purchasedEplShopIds: [],
  openEplShopBuilder: (item) => {
    const base = item?.spec
      ? JSON.parse(JSON.stringify(item.spec))
      : createEmptyEplSiteSpec();
    set({
      isEplShopBuilderOpen: true,
      eplShopPreviewMode: false,
      eplShopBuilderTool: 'select',
      editingShopItemId: item?.id || null,
      editingShopItem: item ? JSON.parse(JSON.stringify(item)) : null,
      selectedBuilderWidgetId: null,
      draftEplShopSpec: {
        ...createEmptyEplSiteSpec(),
        ...base,
        theme: { ...createEmptyEplSiteSpec().theme, ...(base.theme || {}) },
        labelOverrides: base.labelOverrides || {},
        domTextOverrides: base.domTextOverrides || {},
        domStyleOverrides: base.domStyleOverrides || {},
        customCategories: base.customCategories || [],
        customTabs: base.customTabs || [],
        widgets: base.widgets || [],
        tabEplOverlays: base.tabEplOverlays || {},
      },
    });
  },
  closeEplShopBuilder: () =>
    set({
      isEplShopBuilderOpen: false,
      eplShopPreviewMode: false,
      eplShopBuilderTool: 'select',
      editingShopItemId: null,
      editingShopItem: null,
      selectedBuilderWidgetId: null,
    }),
  setEplShopPreviewMode: (preview) => set({ eplShopPreviewMode: preview }),
  setEplShopBuilderTool: (tool) => set({ eplShopBuilderTool: tool }),
  updateDraftEplShopSpec: (updater) => set((state) => ({
    draftEplShopSpec: updater(state.draftEplShopSpec),
  })),
  applyEplShopItem: async (item) => {
    const state = get();
    if (!item) {
      set({ appliedEplShopItemId: null, appliedEplShopSpec: null, previewEplShopSpec: null });
      if (state.user?.uid && auth.currentUser?.uid === state.user.uid) {
        updateDoc(doc(db, 'users', state.user.uid), {
          activeEplShopItemId: null,
          activeEplShopSpec: null,
        }).catch(() => {});
      }
      return;
    }
    set({
      appliedEplShopItemId: item.id,
      appliedEplShopSpec: item.spec,
      previewEplShopSpec: null,
    });
    if (state.user?.uid && auth.currentUser?.uid === state.user.uid) {
      setDoc(
        doc(db, 'users', state.user.uid),
        {
          activeEplShopItemId: item.id,
          activeEplShopSpec: sanitizeFirestoreData(item.spec),
        },
        { merge: true }
      ).catch(() => {});
    }
  },
  setPreviewEplShopSpec: (spec) => set({ previewEplShopSpec: spec }),
  markPurchasedEplShopId: (id) => set((state) => ({
    purchasedEplShopIds: state.purchasedEplShopIds.includes(id)
      ? state.purchasedEplShopIds
      : [...state.purchasedEplShopIds, id],
  })),
  unmarkPurchasedEplShopId: (id) => set((state) => ({
    purchasedEplShopIds: state.purchasedEplShopIds.filter((x) => x !== id),
  })),
}), {
  name: 'app-storage',
  partialize: (state) => ({ 
    tutorialLevel: state.tutorialLevel, 
    tutorialStep: state.tutorialStep, 
    tutorialStepCompleted: state.tutorialStepCompleted,
    language: state.language,
    autoTranslateEnabled: state.autoTranslateEnabled,
    theme: state.theme,
    isPremium: state.isPremium,
    premiumTier: state.premiumTier,
    extraPremiumSettings: state.extraPremiumSettings,
    aiMode: state.aiMode,
    requestCount: state.requestCount,
    lastResetTime: state.lastResetTime,
    computerStyle: state.computerStyle,
    selectedExtraCategory: state.selectedExtraCategory,
    userData: state.userData,
    isFrutigerAero: state.isFrutigerAero,
    simulatedRole: state.simulatedRole,
    premiumCode: state.premiumCode,
    premiumExpiry: state.premiumExpiry,
    code: state.code,
    installedAppsList: state.installedAppsList,
    livePreviewEnabled: state.livePreviewEnabled,
    projectFiles: state.projectFiles,
    hiddenTabs: state.hiddenTabs,
    isSidebarHidden: state.isSidebarHidden,
    isMobileNavHidden: state.isMobileNavHidden,
    legacyNavigation: state.legacyNavigation,
    collapsedNavCategories: state.collapsedNavCategories,
    navCategoryOrder: state.navCategoryOrder,
    navTabOrders: state.navTabOrders,
    appliedEplShopItemId: state.appliedEplShopItemId,
    appliedEplShopSpec: state.appliedEplShopSpec,
    purchasedEplShopIds: state.purchasedEplShopIds
  }),
}));
