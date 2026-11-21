import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { notify } from '../../store/useDialogStore';
import { useCollab } from '../../lib/collab/useCollab';
import {
  Users,
  X,
  Plus,
  LogIn,
  Share2,
  Check,
  LogOut,
  FileCode,
  ArrowRight,
  Save,
} from 'lucide-react';
import { clsx } from 'clsx';
import { ProjectFile } from '../../lib/collab/types';

interface TogetherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCode: string;
  appTitle?: string;
  appId?: string | null;
}

export default function TogetherModal({
  isOpen,
  onClose,
  currentCode,
  appTitle = 'My EPL App',
  appId,
}: TogetherModalProps) {
  const user = useStore(state => state.user);
  const userData = useStore(state => state.userData);
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const language = useStore(state => state.language);

  const { client, session, isActive, yourRole, leaveSession, saveSession } = useCollab();

  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [sessionName, setSessionName] = useState(appTitle || 'My EPL App');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const isDark = theme !== 'light' && !isFrutigerAero;

  const handleCreateSession = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const ownerId = user?.uid || `guest_${Math.random().toString(36).substr(2, 6)}`;
      const ownerName = userData?.name || user?.displayName || 'Developer';
      const avatarUrl = userData?.avatarUrl || user?.photoURL || undefined;

      const initialFiles: ProjectFile[] = [
        {
          id: 'file-main',
          name: 'main.epl',
          path: 'main.epl',
          content:
            currentCode ||
            '// Started with Together Create\nstarted?\n  create{type=world, background=skyblue}\n  create{type=text_label, text="Live Collaboration", x=50, y=50, color=white}\nend',
          type: 'file',
          updatedAt: Date.now(),
        },
        {
          id: 'file-player',
          name: 'player.epl',
          path: 'player.epl',
          content:
            '// Player logic module\n// Edit this simultaneously with other collaborators!\ncreate{type=player, x=100, y=100, color=red}',
          type: 'file',
          updatedAt: Date.now(),
        },
      ];

      const res = await fetch('/api/collab/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId,
          ownerName,
          projectName: sessionName.trim() || 'Together Create Project',
          files: initialFiles,
          projectId: appId || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create collaborative session');
      }

      const data = await res.json();
      const newSession = data.session;

      client.join(newSession.id, {
        uid: ownerId,
        name: ownerName,
        avatarUrl,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Error creating session');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinSession = () => {
    let code = joinCodeInput.trim().toUpperCase();
    if (!code) {
      setError('Please enter a session code or URL');
      return;
    }

    if (code.includes('TOGETHER=')) {
      code = code.split('TOGETHER=')[1].split('&')[0];
    } else if (code.includes('/TOGETHER/')) {
      code = code.split('/TOGETHER/')[1].split('/')[0];
    }

    code = code.replace(/[^A-Z0-9]/g, '');

    if (code.length < 4) {
      setError('Invalid session code format');
      return;
    }

    setIsJoining(true);
    const participantUser = {
      uid: user?.uid || `guest_${Math.random().toString(36).substr(2, 6)}`,
      name: userData?.name || user?.displayName || 'Developer',
      avatarUrl: userData?.avatarUrl || user?.photoURL || undefined,
    };

    client.join(code, participantUser);
    onClose();
  };

  const handleCopyLink = () => {
    if (!session) return;
    const url = `${window.location.origin}/?together=${session.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div
        className={clsx(
          'w-full max-w-lg rounded-xl border shadow-2xl overflow-hidden flex flex-col transition-all',
          isFrutigerAero
            ? 'frutiger-aero-glass border-white/60 text-blue-950'
            : isDark
            ? 'bg-[#181B20] border-[#262B33] text-[#F1F3F5]'
            : 'bg-white border-[#E2E5EA] text-[#111315]'
        )}
      >
        <div
          className={clsx(
            'p-4 sm:p-5 border-b flex items-center justify-between',
            isFrutigerAero ? 'border-white/50' : isDark ? 'border-[#262B33]' : 'border-[#E2E5EA]'
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={clsx(
                'p-2.5 rounded-lg border',
                isFrutigerAero
                  ? 'bg-blue-500/15 border-blue-400/40 text-blue-700'
                  : 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
              )}
            >
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>Together Create</span>
                <span className="px-2 py-0.5 rounded border border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981] text-[10px] font-semibold uppercase tracking-wider">
                  CRDT IDE
                </span>
              </h3>
              <p className={clsx('text-xs', isDark ? 'text-[#9BA1A6]' : 'text-[#5C636E]')}>
                {language === 'ru'
                  ? 'Совместная разработка в реальном времени'
                  : 'Multiplayer collaborative coding with live cursors'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              isDark ? 'hover:bg-[#21252C] text-[#9BA1A6]' : 'hover:bg-black/5 text-[#5C636E]'
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isActive && session ? (
          <div className="p-5 space-y-4">
            <div
              className={clsx(
                'p-4 rounded-lg border flex items-center justify-between gap-3',
                isDark ? 'bg-[#111315] border-[#262B33]' : 'bg-[#F5F6F8] border-[#E2E5EA]'
              )}
            >
              <div className="min-w-0">
                <p className="text-[11px] text-[#10B981] font-semibold uppercase tracking-wider">
                  {language === 'ru' ? 'Активная сессия' : 'Currently In Session'}
                </p>
                <h4 className="text-lg font-bold mt-0.5 truncate">{session.projectName}</h4>
                <p className={clsx('text-xs mt-1 font-mono-num', isDark ? 'text-[#9BA1A6]' : 'text-[#5C636E]')}>
                  Code: <span className="font-mono font-bold text-[#10B981]">{session.id}</span> · Role:{' '}
                  <span className="capitalize font-semibold">{yourRole}</span>
                </p>
              </div>
              <button
                onClick={handleCopyLink}
                className={clsx(
                  'px-3.5 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap',
                  isFrutigerAero
                    ? 'frutiger-aero-button text-white'
                    : 'bg-[#10B981] hover:bg-[#059669] text-[#111315]'
                )}
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedLink ? (language === 'ru' ? 'Скопировано' : 'Copied') : language === 'ru' ? 'Пригласить' : 'Invite'}</span>
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <div
                className={clsx(
                  'flex items-center justify-between p-3 rounded-lg border',
                  isDark ? 'bg-[#111315] border-[#262B33]' : 'bg-[#F5F6F8] border-[#E2E5EA]'
                )}
              >
                <span className="text-[#9BA1A6]">Host</span>
                <span className="font-semibold">{session.ownerName}</span>
              </div>
              <div
                className={clsx(
                  'flex items-center justify-between p-3 rounded-lg border',
                  isDark ? 'bg-[#111315] border-[#262B33]' : 'bg-[#F5F6F8] border-[#E2E5EA]'
                )}
              >
                <span className="text-[#9BA1A6]">Total Project Files</span>
                <span className="font-semibold font-mono-num">{session.files.length} files</span>
              </div>
              <div
                className={clsx(
                  'flex items-center justify-between p-3 rounded-lg border',
                  isDark ? 'bg-[#111315] border-[#262B33]' : 'bg-[#F5F6F8] border-[#E2E5EA]'
                )}
              >
                <span className="text-[#9BA1A6]">Sync Status</span>
                <span className="font-semibold text-[#10B981]">Real-time CRDT Active</span>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => {
                  saveSession();
                  notify.success(language === 'ru' ? 'Проект сохранен!' : 'Project saved successfully!');
                }}
                className={clsx(
                  'flex-1 py-2.5 rounded-lg border font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap',
                  isDark
                    ? 'bg-[#21252C] border-[#262B33] text-[#F1F3F5] hover:bg-[#2A2F38]'
                    : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315] hover:bg-[#EBEEF2]'
                )}
              >
                <Save className="w-4 h-4" />
                <span>{language === 'ru' ? 'Сохранить проект' : 'Save Project'}</span>
              </button>
              <button
                onClick={() => {
                  leaveSession();
                  onClose();
                }}
                className="flex-1 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-4 h-4" />
                <span>{language === 'ru' ? 'Покинуть сессию' : 'Leave Session'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            <div
              className={clsx(
                'flex p-1 rounded-lg border',
                isDark ? 'bg-[#111315] border-[#262B33]' : 'bg-[#F5F6F8] border-[#E2E5EA]'
              )}
            >
              <button
                onClick={() => {
                  setActiveTab('create');
                  setError(null);
                }}
                className={clsx(
                  'flex-1 py-2 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap',
                  activeTab === 'create'
                    ? isFrutigerAero
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#10B981] text-[#111315]'
                    : isDark
                    ? 'text-[#9BA1A6] hover:text-[#F1F3F5]'
                    : 'text-[#5C636E] hover:text-[#111315]'
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{language === 'ru' ? 'Создать сессию' : 'Create Session'}</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('join');
                  setError(null);
                }}
                className={clsx(
                  'flex-1 py-2 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap',
                  activeTab === 'join'
                    ? isFrutigerAero
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#10B981] text-[#111315]'
                    : isDark
                    ? 'text-[#9BA1A6] hover:text-[#F1F3F5]'
                    : 'text-[#5C636E] hover:text-[#111315]'
                )}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{language === 'ru' ? 'Войти в сессию' : 'Join Session'}</span>
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs">{error}</div>
            )}

            {activeTab === 'create' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#9BA1A6] mb-1.5 uppercase tracking-wider">
                    {language === 'ru' ? 'Название проекта / сессии' : 'Project / Session Name'}
                  </label>
                  <input
                    type="text"
                    value={sessionName}
                    onChange={e => setSessionName(e.target.value)}
                    placeholder="Enter project name..."
                    className={clsx(
                      'w-full px-3.5 py-2.5 border rounded-lg text-sm focus:outline-none focus:border-[#10B981]',
                      isDark
                        ? 'bg-[#111315] border-[#262B33] text-[#F1F3F5] placeholder-[#6B7280]'
                        : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315] placeholder-[#8A94A6]'
                    )}
                  />
                </div>

                <div
                  className={clsx(
                    'p-4 rounded-lg border space-y-2',
                    isDark ? 'bg-[#111315] border-[#262B33]' : 'bg-[#F5F6F8] border-[#E2E5EA]'
                  )}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <FileCode className="w-4 h-4 text-[#10B981]" />
                    <span>{language === 'ru' ? 'Файлы проекта' : 'Included Project Files'}</span>
                  </div>
                  <ul className={clsx('text-xs space-y-1 pl-6 list-disc', isDark ? 'text-[#9BA1A6]' : 'text-[#5C636E]')}>
                    <li>
                      <strong className={isDark ? 'text-[#F1F3F5]' : 'text-[#111315]'}>main.epl</strong> (current editor
                      code)
                    </li>
                    <li>
                      <strong className={isDark ? 'text-[#F1F3F5]' : 'text-[#111315]'}>player.epl</strong> (modular
                      component)
                    </li>
                  </ul>
                </div>

                <button
                  onClick={handleCreateSession}
                  disabled={isCreating}
                  className={clsx(
                    'w-full py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap',
                    isFrutigerAero
                      ? 'frutiger-aero-button text-white'
                      : 'bg-[#10B981] hover:bg-[#059669] text-[#111315]'
                  )}
                >
                  <Users className="w-4 h-4" />
                  <span>{isCreating ? 'Creating Workspace...' : 'Create Together Session'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#9BA1A6] mb-1.5 uppercase tracking-wider">
                    {language === 'ru' ? 'Код сессии или ссылка' : 'Session Code or Invite URL'}
                  </label>
                  <input
                    type="text"
                    value={joinCodeInput}
                    onChange={e => setJoinCodeInput(e.target.value)}
                    placeholder="e.g. ABC123 or https://..."
                    className={clsx(
                      'w-full px-3.5 py-2.5 border rounded-lg font-mono text-sm focus:outline-none focus:border-[#10B981] uppercase',
                      isDark
                        ? 'bg-[#111315] border-[#262B33] text-[#F1F3F5] placeholder-[#6B7280]'
                        : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315] placeholder-[#8A94A6]'
                    )}
                  />
                </div>

                <div
                  className={clsx(
                    'p-4 rounded-lg border text-xs space-y-1.5',
                    isDark ? 'bg-[#111315] border-[#262B33] text-[#9BA1A6]' : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#5C636E]'
                  )}
                >
                  <p className={clsx('font-semibold', isDark ? 'text-[#F1F3F5]' : 'text-[#111315]')}>How to join:</p>
                  <p>1. Ask your project host for their 6-character code or invite link.</p>
                  <p>2. Paste it above and click Connect.</p>
                  <p>3. You will enter the shared workspace with live cursors.</p>
                </div>

                <button
                  onClick={handleJoinSession}
                  disabled={isJoining}
                  className={clsx(
                    'w-full py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap',
                    isFrutigerAero
                      ? 'frutiger-aero-button text-white'
                      : 'bg-[#10B981] hover:bg-[#059669] text-[#111315]'
                  )}
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>{isJoining ? 'Connecting...' : 'Connect to Session'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
