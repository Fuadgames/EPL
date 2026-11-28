import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { useDialogStore } from '../store/useDialogStore';
import { useStore } from '../store/useStore';

export default function GlobalDialogs() {
  const toasts = useDialogStore((s) => s.toasts);
  const dismissToast = useDialogStore((s) => s.dismissToast);
  const confirmState = useDialogStore((s) => s.confirmState);
  const resolveConfirm = useDialogStore((s) => s.resolveConfirm);
  const promptState = useDialogStore((s) => s.promptState);
  const resolvePrompt = useDialogStore((s) => s.resolvePrompt);

  const theme = useStore((s) => s.theme);
  const isFrutigerAero = useStore((s) => s.isFrutigerAero);
  const language = useStore((s) => s.language);

  const [promptInput, setPromptInput] = useState('');

  useEffect(() => {
    if (promptState) {
      setPromptInput(promptState.defaultValue || '');
    }
  }, [promptState]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmState) resolveConfirm(false);
        if (promptState) resolvePrompt(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmState, promptState, resolveConfirm, resolvePrompt]);

  const isLight = theme === 'light' && !isFrutigerAero;

  return (
    <>
      {/* Toast Stack */}
      <div className="fixed bottom-20 md:bottom-4 right-0 sm:right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={clsx(
              'pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg transition-all text-sm',
              isFrutigerAero
                ? 'frutiger-aero-glass text-[#062038]'
                : isLight
                ? 'bg-white border-[#E2E5EA] text-[#111315]'
                : 'bg-[#181B20] border-[#262B33] text-[#F3F4F6]'
            )}
          >
            {toast.type === 'success' && (
              <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
            )}
            {toast.type === 'error' && (
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
            )}
            {toast.type === 'info' && (
              <Info className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
            )}
            <span className="flex-1 leading-snug whitespace-pre-line break-words">{toast.message}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              className="opacity-60 hover:opacity-100 transition-opacity shrink-0 p-0.5"
              aria-label="Close notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm Modal */}
      {confirmState && (
        <div
          className="fixed inset-0 z-[10000] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => resolveConfirm(false)}
        >
          <div
            className={clsx(
              'w-full max-w-md rounded-xl border p-6 shadow-2xl',
              isFrutigerAero
                ? 'frutiger-aero-glass text-[#062038]'
                : isLight
                ? 'bg-white border-[#E2E5EA] text-[#111315]'
                : 'bg-[#181B20] border-[#262B33] text-[#F3F4F6]'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div
                className={clsx(
                  'p-2 rounded-lg shrink-0 border',
                  confirmState.tone === 'danger'
                    ? 'bg-red-500/10 border-red-500/30 text-[#DC2626]'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-[#10B981]'
                )}
              >
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold tracking-tight">
                  {confirmState.title || (language === 'ru' ? 'Подтверждение действия' : 'Confirm Action')}
                </h3>
                <p
                  className={clsx(
                    'text-sm mt-1 leading-relaxed whitespace-pre-line',
                    isFrutigerAero ? 'text-[#062038]/80' : isLight ? 'text-[#4B5563]' : 'text-[#9CA3AF]'
                  )}
                >
                  {confirmState.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => resolveConfirm(false)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap shrink-0',
                  isFrutigerAero
                    ? 'bg-white/60 border-white/70 text-[#062038] hover:bg-white/80'
                    : isLight
                    ? 'bg-[#F5F6F8] border-[#E2E5EA] text-[#374151] hover:bg-[#EBEDF0]'
                    : 'bg-[#111315] border-[#262B33] text-[#D1D5DB] hover:bg-[#21252C]'
                )}
              >
                {confirmState.cancelText || (language === 'ru' ? 'Отмена' : 'Cancel')}
              </button>
              <button
                autoFocus
                onClick={() => resolveConfirm(true)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0',
                  confirmState.tone === 'danger'
                    ? 'bg-[#DC2626] hover:bg-red-700 text-white'
                    : isFrutigerAero
                    ? 'frutiger-aero-button'
                    : 'bg-[#10B981] hover:bg-[#059669] text-[#09120E] font-semibold'
                )}
              >
                {confirmState.confirmText || (language === 'ru' ? 'Подтвердить' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Modal */}
      {promptState && (
        <div
          className="fixed inset-0 z-[10000] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => resolvePrompt(null)}
        >
          <form
            className={clsx(
              'w-full max-w-md rounded-xl border p-6 shadow-2xl',
              isFrutigerAero
                ? 'frutiger-aero-glass text-[#062038]'
                : isLight
                ? 'bg-white border-[#E2E5EA] text-[#111315]'
                : 'bg-[#181B20] border-[#262B33] text-[#F3F4F6]'
            )}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              resolvePrompt(promptInput);
            }}
          >
            <h3 className="text-base font-semibold tracking-tight mb-1">
              {promptState.title || (language === 'ru' ? 'Введите значение' : 'Input Required')}
            </h3>
            <p
              className={clsx(
                'text-sm mb-4',
                isFrutigerAero ? 'text-[#062038]/80' : isLight ? 'text-[#4B5563]' : 'text-[#9CA3AF]'
              )}
            >
              {promptState.message}
            </p>
            <input
              autoFocus
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder={promptState.placeholder || ''}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2',
                isFrutigerAero
                  ? 'bg-white/75 border-white text-[#062038] focus:ring-blue-400'
                  : isLight
                  ? 'bg-[#F5F6F8] border-[#D1D5DB] text-[#111315] focus:ring-[#059669]/40'
                  : 'bg-[#111315] border-[#262B33] text-[#F3F4F6] focus:ring-[#10B981]/40'
              )}
            />
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => resolvePrompt(null)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap shrink-0',
                  isFrutigerAero
                    ? 'bg-white/60 border-white/70 text-[#062038] hover:bg-white/80'
                    : isLight
                    ? 'bg-[#F5F6F8] border-[#E2E5EA] text-[#374151] hover:bg-[#EBEDF0]'
                    : 'bg-[#111315] border-[#262B33] text-[#D1D5DB] hover:bg-[#21252C]'
                )}
              >
                {promptState.cancelText || (language === 'ru' ? 'Отмена' : 'Cancel')}
              </button>
              <button
                type="submit"
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0',
                  isFrutigerAero
                    ? 'frutiger-aero-button'
                    : 'bg-[#10B981] hover:bg-[#059669] text-[#09120E]'
                )}
              >
                {promptState.confirmText || (language === 'ru' ? 'ОК' : 'Save')}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
