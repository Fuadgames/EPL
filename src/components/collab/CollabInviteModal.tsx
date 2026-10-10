import React, { useState, useEffect } from 'react';
import { useCollab } from '../../lib/collab/useCollab';
import { useStore } from '../../store/useStore';
import { X, Copy, Check, QrCode, Share2, Users, Shield, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import QRCode from 'qrcode';

interface CollabInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CollabInviteModal({ isOpen, onClose }: CollabInviteModalProps) {
  const { session } = useCollab();
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const language = useStore(state => state.language);

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const inviteUrl = session ? `${window.location.origin}/?together=${session.id}` : '';

  useEffect(() => {
    if (inviteUrl) {
      QRCode.toDataURL(inviteUrl, {
        width: 180,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      }).then(url => setQrDataUrl(url)).catch(() => {});
    }
  }, [inviteUrl]);

  if (!isOpen || !session) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(session.id);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className={clsx(
        "w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden flex flex-col transition-all",
        isFrutigerAero ? "bg-white/95 border-white/60 text-zinc-900 backdrop-blur-xl" :
        theme !== 'light' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900"
      )}>
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-500">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Invite to Together Create</h3>
              <p className="text-xs text-zinc-400">{session.projectName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Direct Link */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
              Shareable Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-xs text-zinc-300 select-all focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className={clsx(
                  "px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-md",
                  copiedLink
                    ? "bg-emerald-500 text-white shadow-emerald-500/25"
                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25"
                )}
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Session Code */}
          <div className="p-4 rounded-2xl bg-zinc-800/40 border border-zinc-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400 font-medium">Session Code</p>
              <p className="text-2xl font-mono font-bold tracking-widest text-blue-400">{session.id}</p>
            </div>
            <button
              onClick={handleCopyCode}
              className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCode ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* QR Code */}
          {qrDataUrl && (
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-zinc-800/20 border border-zinc-800/60">
              <img 
                src={qrDataUrl} 
                alt="Invite QR Code" 
                className="w-36 h-36 rounded-xl bg-white p-2 shadow-md mb-2"
              />
              <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5" />
                <span>Scan with phone or mobile browser to join</span>
              </p>
            </div>
          )}

          {/* Permissions note */}
          <div className="flex items-start gap-2.5 text-xs text-zinc-400 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
            <Shield className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span>
              Anyone with this link can join. As Owner, you can change their role to Editor or Viewer anytime from the participants menu.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
