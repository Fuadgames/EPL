import React, { useState, useRef, useEffect } from 'react';
import { useCollab } from '../../lib/collab/useCollab';
import { useStore } from '../../store/useStore';
import { 
  Users, 
  Share2, 
  Copy, 
  Check, 
  LogOut, 
  Shield, 
  UserCheck, 
  Eye, 
  Edit3, 
  Sparkles, 
  Wifi, 
  WifiOff, 
  ChevronDown, 
  QrCode,
  Lock,
  Save,
  MessageSquare
} from 'lucide-react';
import { clsx } from 'clsx';
import QRCode from 'qrcode';

interface CollabHeaderProps {
  onOpenInviteModal: () => void;
  onOpenChatModal?: () => void;
}

export default function CollabHeader({ onOpenInviteModal, onOpenChatModal }: CollabHeaderProps) {
  const {
    session,
    status,
    yourRole,
    yourColor,
    participants,
    isOwner,
    updateRole,
    leaveSession,
    saveSession
  } = useCollab();

  const user = useStore(state => state.user);
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const language = useStore(state => state.language);

  const [showParticipantsDropdown, setShowParticipantsDropdown] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowParticipantsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  if (!session) return null;

  const handleCopyInviteLink = () => {
    const url = `${window.location.origin}/?together=${session.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleManualSave = () => {
    saveSession();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className={clsx(
      "h-10 px-3 flex items-center justify-between border-b text-xs select-none relative z-30 shrink-0",
      isFrutigerAero ? "bg-white/60 border-white/50 backdrop-blur-md shadow-xs" :
      theme !== 'light' ? "bg-zinc-900/90 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-800"
    )}>
      {/* Left: Together Create Session badge & Status */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/10 text-blue-500 font-bold tracking-wide">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Together Create:</span>
          <span className="font-mono text-zinc-100">{session.id}</span>
        </div>

        {/* Connection status indicator */}
        <div 
          className={clsx(
            "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors",
            status === 'connected' && "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
            status === 'reconnecting' && "bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse",
            status === 'offline' && "bg-red-500/15 text-red-400 border border-red-500/30"
          )}
          title={`Connection status: ${status}`}
        >
          <span className={clsx(
            "w-2 h-2 rounded-full",
            status === 'connected' && "bg-emerald-400 animate-pulse",
            status === 'reconnecting' && "bg-amber-400 animate-ping",
            status === 'offline' && "bg-red-500"
          )} />
          <span className="capitalize font-sans font-semibold">
            {status === 'connected' ? 'Connected' : status === 'reconnecting' ? 'Reconnecting...' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Center: Realtime editing notice */}
      <div className="hidden lg:flex items-center gap-2 text-zinc-400 text-[11px]">
        <span>{session.projectName}</span>
        <span>•</span>
        <span>Host: {session.ownerName}</span>
      </div>

      {/* Right: Participants list, Invite button, Actions */}
      <div className="flex items-center gap-2" ref={dropdownRef}>
        {/* Participants Stack with Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowParticipantsDropdown(prev => !prev)}
            className={clsx(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-all border cursor-pointer",
              showParticipantsDropdown 
                ? "bg-blue-600/20 border-blue-500/40 text-blue-400 shadow-sm"
                : "hover:bg-zinc-800/40 border-transparent text-zinc-300"
            )}
            title="View participants & manage permissions"
          >
            {/* Colored Avatars Stack */}
            <div className="flex -space-x-1.5 items-center mr-0.5">
              {participants.slice(0, 3).map((p) => (
                <div
                  key={p.uid}
                  className="w-5 h-5 rounded-full border border-black flex items-center justify-center text-[9px] font-bold text-white shadow-xs"
                  style={{ backgroundColor: p.color }}
                  title={`${p.name} (${p.role})`}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>
              ))}
              {participants.length > 3 && (
                <div className="w-5 h-5 rounded-full bg-zinc-700 text-[9px] text-zinc-300 flex items-center justify-center font-bold">
                  +{participants.length - 3}
                </div>
              )}
            </div>

            <span className="font-semibold text-xs hidden sm:inline">
              {participants.length} online
            </span>
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>

          {/* Participants Dropdown Details */}
          {showParticipantsDropdown && (
            <div className={clsx(
              "absolute right-0 top-full mt-2 w-72 rounded-2xl shadow-2xl border p-3 z-50 animate-in fade-in zoom-in-95",
              isFrutigerAero ? "bg-white/95 border-white/60 text-zinc-800 backdrop-blur-xl" :
              theme !== 'light' ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
            )}>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/60">
                <span className="font-bold text-xs uppercase tracking-wider text-zinc-400">
                  Participants ({participants.length})
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  Code: {session.id}
                </span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {participants.map((p) => {
                  const isCurrentUser = p.uid === user?.uid;
                  const activeFile = session.files.find(f => f.id === p.currentFileId);

                  return (
                    <div 
                      key={p.uid} 
                      className="p-2 rounded-xl bg-zinc-800/30 border border-zinc-800/50 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-xs"
                            style={{ backgroundColor: p.color }}
                          >
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-xs flex items-center gap-1.5">
                              <span>{p.name}</span>
                              {isCurrentUser && <span className="text-[9px] text-zinc-400">(You)</span>}
                            </div>
                            <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                              <span className={clsx("w-1.5 h-1.5 rounded-full", p.isTyping ? "bg-emerald-400 animate-pulse" : "bg-zinc-500")} />
                              <span>{p.isTyping ? 'Writing...' : (activeFile ? `Editing: ${activeFile.name}` : 'Viewing')}</span>
                            </div>
                          </div>
                        </div>

                        {/* Role Badge */}
                        <div className="flex items-center gap-1">
                          <span className={clsx(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                            p.role === 'owner' ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                            p.role === 'editor' ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" :
                            "bg-zinc-700/40 text-zinc-400"
                          )}>
                            {p.role}
                          </span>
                        </div>
                      </div>

                      {/* Owner controls: switch roles between Editor and Viewer */}
                      {isOwner && !isCurrentUser && (
                        <div className="flex items-center justify-end gap-1 mt-1 pt-1 border-t border-zinc-800/50">
                          <span className="text-[10px] text-zinc-500 mr-auto">Change permission:</span>
                          <button
                            onClick={() => updateRole(p.uid, 'editor')}
                            className={clsx(
                              "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                              p.role === 'editor' ? "bg-blue-600 text-white font-bold" : "hover:bg-zinc-700 text-zinc-400"
                            )}
                          >
                            Editor
                          </button>
                          <button
                            onClick={() => updateRole(p.uid, 'viewer')}
                            className={clsx(
                              "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                              p.role === 'viewer' ? "bg-amber-600 text-white font-bold" : "hover:bg-zinc-700 text-zinc-400"
                            )}
                          >
                            Viewer
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Leave Session Button */}
              <div className="mt-3 pt-2 border-t border-zinc-800/60">
                <button
                  onClick={leaveSession}
                  className="w-full py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Leave Together Create</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Invite Button */}
        <button
          onClick={onOpenInviteModal}
          className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Invite</span>
        </button>

        {/* Quick Save to Project */}
        <button
          onClick={handleManualSave}
          className={clsx(
            "p-1.5 rounded-xl border transition-colors cursor-pointer",
            savedSuccess 
              ? "bg-emerald-500 text-white border-emerald-400 shadow-md"
              : "hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700"
          )}
          title="Save project changes"
        >
          {savedSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
