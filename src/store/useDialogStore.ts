import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'primary' | 'danger';
}

export interface PromptOptions {
  title?: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
}

interface DialogState {
  toasts: ToastItem[];
  showToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: string) => void;

  confirmState: (ConfirmOptions & { resolve: (value: boolean) => void }) | null;
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  resolveConfirm: (value: boolean) => void;

  promptState: (PromptOptions & { resolve: (value: string | null) => void }) | null;
  prompt: (options: PromptOptions | string, defaultValue?: string) => Promise<string | null>;
  resolvePrompt: (value: string | null) => void;
}

export const useDialogStore = create<DialogState>((set, get) => ({
  toasts: [],
  showToast: (message, type = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({
      toasts: [...state.toasts.slice(-4), { id, message, type }],
    }));
    setTimeout(() => {
      get().dismissToast(id);
    }, 4000);
  },
  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  confirmState: null,
  confirm: (options) => {
    const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      set({
        confirmState: {
          ...opts,
          resolve,
        },
      });
    });
  },
  resolveConfirm: (value) => {
    const current = get().confirmState;
    if (current) {
      current.resolve(value);
      set({ confirmState: null });
    }
  },

  promptState: null,
  prompt: (options, defaultValue) => {
    const opts: PromptOptions =
      typeof options === 'string' ? { message: options, defaultValue } : options;
    return new Promise<string | null>((resolve) => {
      set({
        promptState: {
          ...opts,
          resolve,
        },
      });
    });
  },
  resolvePrompt: (value) => {
    const current = get().promptState;
    if (current) {
      current.resolve(value);
      set({ promptState: null });
    }
  },
}));

export const notify = {
  success: (msg: string) => useDialogStore.getState().showToast(msg, 'success'),
  error: (msg: string) => useDialogStore.getState().showToast(msg, 'error'),
  info: (msg: string) => useDialogStore.getState().showToast(msg, 'info'),
};

export const confirmAction = (options: ConfirmOptions | string) =>
  useDialogStore.getState().confirm(options);

export const promptAction = (options: PromptOptions | string, defaultValue?: string) =>
  useDialogStore.getState().prompt(options, defaultValue);
