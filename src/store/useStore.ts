import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from 'firebase/auth';

type View = 'store' | 'editor' | 'my-apps' | 'profile' | 'settings' | 'player' | 'premium';

interface AppState {
  currentView: View;
  setCurrentView: (view: View) => void;
  user: User | null;
  setUser: (user: User | null) => void;
  theme: 'light' | 'dark' | 'gradient';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark' | 'gradient') => void;
  editingAppId: string | null;
  setEditingAppId: (id: string | null) => void;
  playingAppId: string | null;
  setPlayingAppId: (id: string | null) => void;
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
}

export const useStore = create<AppState>()(persist((set) => ({
  currentView: 'store',
  setCurrentView: (view) => set({ currentView: view }),
  user: null,
  setUser: (user) => set({ user }),
  theme: 'dark',
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
  setTheme: (theme) => set({ theme }),
  editingAppId: null,
  setEditingAppId: (id) => set({ editingAppId: id }),
  playingAppId: null,
  setPlayingAppId: (id) => set({ playingAppId: id }),
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
    lastResetTime: state.lastResetTime
  }),
}));
