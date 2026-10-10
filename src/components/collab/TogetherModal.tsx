import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useCollab } from '../../lib/collab/useCollab';
import { 
  Users, 
  Sparkles, 
  X, 
  Plus, 
  LogIn, 
  Share2, 
  Shield, 
  Copy, 
  Check, 
  LogOut, 
  FolderPlus,
  FileCode,
  ArrowRight,
  Save
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
  appId
}: TogetherModalProps) {
  const user = useStore(state => state.user);
  const userData = useStore(state => state.userData);
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const language = useStore(state => state.language);

  const { client, session, isActive, yourRole, isOwner, leaveSession, saveSession } = useCollab();

  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [sessionName, setSessionName] = useState(appTitle || 'My EPL App');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

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
          content: currentCode || '// Started with Together Create\nstarted?\n  create{type=world, background=skyblue}\n  create{type=text_label, text="Live Collaboration", x=50, y=50, color=white}\nend',
          type: 'file',
          updatedAt: Date.now()
        },
        {
          id: 'file-player',
          name: 'player.epl',
          path: 'player.epl',
          content: '// Player logic module\n// Edit this simultaneously with other collaborators!\ncreate{type=player, x=100, y=100, color=red}',
          type: 'file',
          updatedAt: Date.now()
        }
      ];

      const res = await fetch('/api/collab/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId,
          ownerName,
          projectName: sessionName.trim() || 'Together Create Project',
          files: initialFiles,
          projectId: appId || undefined
        })
      });

      if (!res.ok) {
        throw new Error('Failed to create collaborative session');
      }

      const data = await res.json();
      const newSession = data.session;

      // Join the created session via WebSocket
      client.join(newSession.id, {
        uid: ownerId,
        name: ownerName,
        avatarUrl
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

    // If a full URL was pasted, extract code
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
      avatarUrl: userData?.avatarUrl || user?.photoURL || undefined
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className={clsx(
        "w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col transition-all",
        isFrutigerAero ? "bg-white/95 border-white/60 text-zinc-900 backdrop-blur-xl" :
        theme !== 'light' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900"
      )}>
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-500 shadow-md shadow-blue-500/10">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                <span>Together Create</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                  Realtime IDE
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Multiplayer collaborative coding with live cursors & CRDT synchronization
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* If ALREADY inside an active session: show active session manager */}
        {isActive && session ? (
          <div className="p-6 space-y-5">
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider">Currently In Session</p>
                <h4 className="text-xl font-bold text-white mt-0.5">{session.projectName}</h4>
                <p className="text-xs text-zinc-400 mt-1">
                  Session Code: <span className="font-mono font-bold text-blue-300">{session.id}</span> • Role: <span className="capitalize font-bold text-emerald-400">{yourRole}</span>
                </p>
              </div>
              <button
                onClick={handleCopyLink}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/25 cursor-pointer"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedLink ? 'Link Copied!' : 'Invite'}</span>
              </button>
            </div>

            <div className="space-y-2 text-xs text-zinc-300">
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/40">
                <span className="text-zinc-400">Host</span>
                <span className="font-semibold text-white">{session.ownerName}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/40">
                <span className="text-zinc-400">Total Project Files</span>
                <span className="font-semibold text-white">{session.files.length} files</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/40">
                <span className="text-zinc-400">Sync Status</span>
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Real-time CRDT Active
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  saveSession();
                  alert("Project saved successfully!");
                }}
                className="flex-1 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Project</span>
              </button>
              <button
                onClick={() => {
                  leaveSession();
                  onClose();
                }}
                className="flex-1 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Leave Session</span>
              </button>
            </div>
          </div>
        ) : (
          /* Create or Join Tabs */
          <div className="p-6 space-y-5">
            {/* Tabs Switcher */}
            <div className="flex p-1 rounded-2xl bg-zinc-800/50 border border-zinc-800">
              <button
                onClick={() => { setActiveTab('create'); setError(null); }}
                className={clsx(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                  activeTab === 'create'
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Session</span>
              </button>
              <button
                onClick={() => { setActiveTab('join'); setError(null); }}
                className={clsx(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                  activeTab === 'join'
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Join Session</span>
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}

            {activeTab === 'create' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Project / Session Name
                  </label>
                  <input
                    type="text"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="Enter project name..."
                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-zinc-800/30 border border-zinc-800/60 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                    <FileCode className="w-4 h-4 text-emerald-400" />
                    <span>Included Project Files</span>
                  </div>
                  <ul className="text-xs text-zinc-400 space-y-1 pl-6 list-disc">
                    <li><strong className="text-zinc-200">main.epl</strong> (contains your current editor code)</li>
                    <li><strong className="text-zinc-200">player.epl</strong> (modular component for teammates)</li>
                  </ul>
                  <p className="text-[11px] text-zinc-500 pt-1">
                    You can add, rename, or delete additional files and folders anytime in the editor!
                  </p>
                </div>

                <button
                  onClick={handleCreateSession}
                  disabled={isCreating}
                  className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-bold text-sm shadow-xl shadow-blue-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isCreating ? 'Creating Workspace...' : 'Create Together Session'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Session Code or Invite URL
                  </label>
                  <input
                    type="text"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value)}
                    placeholder="e.g. ABC123 or https://..."
                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-2xl font-mono text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all uppercase"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-zinc-800/30 border border-zinc-800/60 text-xs text-zinc-400 space-y-1.5">
                  <p className="font-semibold text-zinc-300">How to join:</p>
                  <p>1. Ask your project host for their 6-character code or invite link.</p>
                  <p>2. Paste it above and click Connect.</p>
                  <p>3. You will immediately enter their workspace and see their code and cursors!</p>
                </div>

                <button
                  onClick={handleJoinSession}
                  disabled={isJoining}
                  className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-bold text-sm shadow-xl shadow-blue-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
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
