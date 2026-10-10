import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useCollab } from '../../lib/collab/useCollab';
import { Sparkles, Users, ArrowRight, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface JoinSessionModalProps {
  sessionId: string;
  onClose: () => void;
}

export default function JoinSessionModal({ sessionId, onClose }: JoinSessionModalProps) {
  const user = useStore(state => state.user);
  const userData = useStore(state => state.userData);
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const setCurrentView = useStore(state => state.setCurrentView);
  const { client, status, session } = useCollab();

  const [loading, setLoading] = useState(true);
  const [sessionMeta, setSessionMeta] = useState<{
    id: string;
    projectName: string;
    ownerName: string;
    participantCount: number;
    fileCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    // Fetch session preview from backend
    fetch(`/api/collab/${sessionId.toUpperCase().trim()}`)
      .then(async res => {
        if (!res.ok) {
          throw new Error('Session not found or has expired.');
        }
        return res.json();
      })
      .then(data => {
        setSessionMeta(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Could not find session');
        setLoading(false);
      });
  }, [sessionId]);

  const handleJoin = () => {
    setIsJoining(true);
    const participantUser = {
      uid: user?.uid || `guest_${Math.random().toString(36).substr(2, 6)}`,
      name: userData?.name || user?.displayName || 'Developer',
      avatarUrl: userData?.avatarUrl || user?.photoURL || undefined
    };

    client.join(sessionId, participantUser);
    setCurrentView('editor');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className={clsx(
        "w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden p-6 sm:p-8 text-center transition-all",
        isFrutigerAero ? "bg-white/95 border-white/70 text-zinc-900 backdrop-blur-xl" :
        theme !== 'light' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900"
      )}>
        {/* Glow Icon */}
        <div className="w-16 h-16 rounded-3xl bg-blue-500/20 text-blue-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/20">
          <Sparkles className="w-8 h-8 animate-pulse" />
        </div>

        <h2 className="text-2xl font-bold tracking-tight mb-1">Join Together Create</h2>
        <p className="text-xs text-zinc-400 mb-6">
          You've been invited to collaborate on a live EPL Studio project in real-time.
        </p>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-zinc-400">Connecting to session {sessionId}...</span>
          </div>
        ) : error ? (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-6 flex items-center gap-2 text-left">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : sessionMeta ? (
          <div className="space-y-4 mb-6 text-left">
            <div className="p-4 rounded-2xl bg-zinc-800/40 border border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Project:</span>
                <span className="font-bold text-white text-sm">{sessionMeta.projectName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Host:</span>
                <span className="font-semibold text-blue-400">{sessionMeta.ownerName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Active Collaborators:</span>
                <span className="font-semibold text-emerald-400">{sessionMeta.participantCount} online</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Files:</span>
                <span className="font-mono text-zinc-300">{sessionMeta.fileCount} items</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
              <ShieldCheck className="w-4 h-4 shrink-0 text-blue-400" />
              <span>Real-time multiplayer synchronization with CRDT algorithm enabled.</span>
            </div>
          </div>
        ) : null}

        {/* Buttons */}
        <div className="flex flex-col gap-2">
          {sessionMeta && (
            <button
              onClick={handleJoin}
              disabled={isJoining}
              className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-bold text-sm shadow-xl shadow-blue-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>{isJoining ? 'Connecting...' : 'JOIN'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
