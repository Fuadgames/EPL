import { create } from 'zustand';
import { User } from 'firebase/auth';

type View = 'store' | 'editor' | 'my-apps' | 'profile' | 'settings' | 'player';

interface AppState {
  currentView: View;
  setCurrentView: (view: View) => void;
  user: User | null;
  setUser: (user: User | null) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  editingAppId: string | null;
  setEditingAppId: (id: string | null) => void;
  playingAppId: string | null;
  setPlayingAppId: (id: string | null) => void;
  aiAnswerMode: 'text' | 'console';
  setAiAnswerMode: (mode: 'text' | 'console') => void;
  aiChangesEnabled: boolean;
  setAiChangesEnabled: (enabled: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  currentView: 'store',
  setCurrentView: (view) => set({ currentView: view }),
  user: null,
  setUser: (user) => set({ user }),
  theme: 'dark',
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
  editingAppId: null,
  setEditingAppId: (id) => set({ editingAppId: id }),
  playingAppId: null,
  setPlayingAppId: (id) => set({ playingAppId: id }),
  aiAnswerMode: 'text',
  setAiAnswerMode: (mode) => set({ aiAnswerMode: mode }),
  aiChangesEnabled: false,
  setAiChangesEnabled: (enabled) => set({ aiChangesEnabled: enabled }),
}));
