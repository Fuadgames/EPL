import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from 'firebase/auth';
import { ACHIEVEMENTS_DB, AchievementData } from '../lib/achievements';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

type View = 'store' | 'editor' | 'my-apps' | 'profile' | 'settings' | 'player' | 'premium' | 'control' | 'asset-store' | 'leaderboards' | 'donate';

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
  uploadedFiles?: { name: string; url: string }[];
  permissions?: UserPermissions;
  installedApps?: { [appId: string]: string }; // appId -> version
  purchasedApps?: string[]; // list of appIds
  unlockedAchievements?: string[]; // list of achievement ids
  createdAt?: string;
  premiumExpiry?: string | null;
  isPremium?: boolean;
  isBanned?: boolean;
  banReason?: string;
}

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
  language: 'en' | 'ru';
  setLanguage: (lang: 'en' | 'ru') => void;
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
  aiMode: 'fast' | 'thinking' | 'pro';
  setAiMode: (mode: 'fast' | 'thinking' | 'pro') => void;
  requestCount: number;
  setRequestCount: (count: number) => void;
  lastResetTime: string;
  setLastResetTime: (time: string) => void;
  computerStyle: boolean;
  setComputerStyle: (enabled: boolean) => void;
  selectedExtraCategory: 'Normal' | 'OS' | 'Asset' | 'PreviewEditing' | null;
  setSelectedExtraCategory: (category: 'Normal' | 'OS' | 'Asset' | 'PreviewEditing' | null) => void;
  previewType: '2D' | '3D' | null;
  setPreviewType: (type: '2D' | '3D' | null) => void;
  addSceneNode: (node: any) => void;
  setAddSceneNode: (fn: (node: any) => void) => void;
  isBackdoor: boolean;
  setIsBackdoor: (isBackdoor: boolean) => void;
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
  achievementQueue: AchievementData[];
  popAchievement: () => void;
  unlockAchievement: (id: string) => void;
}

export const useStore = create<AppState>()(persist((set) => ({
  currentView: 'store',
  setCurrentView: (view) => set({ currentView: view }),
  user: null,
  setUser: (user) => set({ user }),
  userData: null,
  setUserData: (userData) => set({ userData }),
  theme: 'dark',
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
  setTheme: (theme) => set({ theme }),
  editingAppId: null,
  setEditingAppId: (id) => set({ editingAppId: id }),
  code: '',
  setCode: (code) => set({ code }),
  playingAppId: null,
  setPlayingAppId: (id) => set({ playingAppId: id }),
  selectedAppId: null,
  setSelectedAppId: (id) => set({ selectedAppId: id }),
  copiedAppData: null,
  setCopiedAppData: (data) => set({ copiedAppData: data }),
  aiAnswerMode: 'text',
  setAiAnswerMode: (mode) => set({ aiAnswerMode: mode }),
  aiChangesEnabled: false,
  setAiChangesEnabled: (enabled) => set({ aiChangesEnabled: enabled }),
  language: 'en',
  setLanguage: (lang) => set({ language: lang }),
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
  aiMode: 'fast',
  setAiMode: (mode) => set({ aiMode: mode }),
  requestCount: 0,
  setRequestCount: (count) => set({ requestCount: count }),
  lastResetTime: new Date().toISOString(),
  setLastResetTime: (time) => set({ lastResetTime: time }),
  computerStyle: false,
  setComputerStyle: (enabled) => set({ computerStyle: enabled }),
  selectedExtraCategory: null,
  setSelectedExtraCategory: (category) => set({ selectedExtraCategory: category }),
  previewType: null,
  setPreviewType: (type) => set({ previewType: type }),
  addSceneNode: () => {},
  setAddSceneNode: (fn) => set({ addSceneNode: fn }),
  isBackdoor: false,
  setIsBackdoor: (isBackdoor) => set({ isBackdoor }),
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
      
      // Async save
      console.log("Updating achievements for:", userData.uid, newUnlocked);
      updateDoc(doc(db, 'users', userData.uid), { unlockedAchievements: newUnlocked }).catch(err => {
        console.error("Failed to check app achievements", err);
      });

      return {
        userData: { ...userData, unlockedAchievements: newUnlocked },
        // Forced rebuild: check achievementQueue update
        achievementQueue: achievement ? [...state.achievementQueue, achievement] : state.achievementQueue
      };
    });
  },
}), {
  name: 'app-storage',
  partialize: (state) => ({ 
    tutorialLevel: state.tutorialLevel, 
    tutorialStep: state.tutorialStep, 
    tutorialStepCompleted: state.tutorialStepCompleted,
    language: state.language,
    theme: state.theme,
    isPremium: state.isPremium,
    aiMode: state.aiMode,
    requestCount: state.requestCount,
    lastResetTime: state.lastResetTime,
    computerStyle: state.computerStyle,
    selectedExtraCategory: state.selectedExtraCategory,
    userData: state.userData,
    isBackdoor: state.isBackdoor,
    isFrutigerAero: state.isFrutigerAero,
    simulatedRole: state.simulatedRole,
    premiumCode: state.premiumCode,
    premiumExpiry: state.premiumExpiry,
    code: state.code
  }),
}));
