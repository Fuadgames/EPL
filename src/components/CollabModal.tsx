import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { collection, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { X, Users, Copy, Check, Play, LogOut, UserMinus } from 'lucide-react';
import { clsx } from 'clsx';

interface CollabModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCode: string;
  onCodeChange: (code: string) => void;
}

interface CollabSession {
  id: string;
  hostId: string;
  currentCode: string;
  participants: {
    uid: string;
    name: string;
    avatarUrl: string;
    isTyping: boolean;
  }[];
  createdAt: any;
}

export default function CollabModal({ isOpen, onClose, currentCode, onCodeChange }: CollabModalProps) {
  const user = useStore(state => state.user);
  const userData = useStore(state => state.userData);
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [session, setSession] = useState<CollabSession | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = onSnapshot(doc(db, 'collabSessions', sessionId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as CollabSession;
        setSession(data);
        
        // If we are not the one who just typed, update our local code
        // In a real app, we'd use Operational Transformation or CRDTs for this
        // For now, simple sync if code is different
        if (data.currentCode !== currentCode) {
          onCodeChange(data.currentCode);
        }
      } else {
        // Session ended
        setSession(null);
        setSessionId(null);
        alert('Collaboration session has ended.');
      }
    });

    return () => unsubscribe();
  }, [sessionId]);

  // Sync our local code changes to the session
  useEffect(() => {
    if (sessionId && session && session.currentCode !== currentCode) {
      const syncCode = async () => {
        try {
          await updateDoc(doc(db, 'collabSessions', sessionId), {
            currentCode: currentCode
          });
        } catch (error) {
          console.error("Error syncing code:", error);
        }
      };
      // Debounce this in a real app
      const timeout = setTimeout(syncCode, 500);
      return () => clearTimeout(timeout);
    }
  }, [currentCode, sessionId]);

  const createSession = async () => {
    if (!user || !userData) return;
    setLoading(true);
    console.log("Creating session...");
    try {
      const newSessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
      console.log("Generated session ID:", newSessionId);
      const sessionData: CollabSession = {
        id: newSessionId,
        hostId: user.uid,
        currentCode: currentCode,
        participants: [{
          uid: user.uid,
          name: userData.name || 'Host',
          avatarUrl: userData.avatarUrl || user.photoURL || '',
          isTyping: false
        }],
        createdAt: serverTimestamp()
      };
      
      await setDoc(doc(db, 'collabSessions', newSessionId), sessionData);
      console.log("Session created successfully");
      setSessionId(newSessionId);
    } catch (error) {
      console.error("Error creating session:", error);
      alert("Failed to create session: " + error);
    } finally {
      setLoading(false);
    }
  };

  const joinSession = async () => {
    if (!user || !userData || !joinCode.trim()) return;
    setLoading(true);
    try {
      const sessionRef = doc(db, 'collabSessions', joinCode.toUpperCase());
      const sessionSnap = await getDoc(sessionRef);
      
      if (sessionSnap.exists()) {
        const participant = {
          uid: user.uid,
          name: userData.name || 'Guest',
          avatarUrl: userData.avatarUrl || user.photoURL || '',
          isTyping: false
        };
        
        await updateDoc(sessionRef, {
          participants: arrayUnion(participant)
        });
        
        setSessionId(joinCode.toUpperCase());
      } else {
        alert("Session not found.");
      }
    } catch (error) {
      console.error("Error joining session:", error);
      alert("Failed to join session.");
    } finally {
      setLoading(false);
    }
  };

  const leaveSession = async () => {
    if (!user || !sessionId || !session) return;
    try {
      if (session.hostId === user.uid) {
        // Host leaving ends the session
        await deleteDoc(doc(db, 'collabSessions', sessionId));
      } else {
        // Guest leaving
        const participantToRemove = session.participants.find(p => p.uid === user.uid);
        if (participantToRemove) {
          await updateDoc(doc(db, 'collabSessions', sessionId), {
            participants: arrayRemove(participantToRemove)
          });
        }
      }
      setSessionId(null);
      setSession(null);
    } catch (error) {
      console.error("Error leaving session:", error);
    }
  };

  const kickUser = async (uidToKick: string) => {
    if (!user || !sessionId || !session || session.hostId !== user.uid) return;
    try {
      const participantToRemove = session.participants.find(p => p.uid === uidToKick);
      if (participantToRemove) {
        await updateDoc(doc(db, 'collabSessions', sessionId), {
          participants: arrayRemove(participantToRemove)
        });
      }
    } catch (error) {
      console.error("Error kicking user:", error);
    }
  };

  const copyCode = () => {
    if (sessionId) {
      navigator.clipboard.writeText(sessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={clsx(
        "w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]",
        isFrutigerAero ? "bg-white/80 border border-white/50 backdrop-blur-xl" :
        theme === 'dark' ? "bg-zinc-900 border border-zinc-800" :
        theme === 'gradient' ? "bg-zinc-900/90 border border-emerald-800/50 backdrop-blur-xl" :
        "bg-white border border-zinc-200"
      )}>
        <div className={clsx(
          "flex items-center justify-between p-4 border-b",
          isFrutigerAero ? "border-white/40 bg-white/40" :
          theme === 'dark' ? "border-zinc-800" :
          theme === 'gradient' ? "border-emerald-800/30" :
          "border-zinc-100"
        )}>
          <h2 className={clsx("text-lg font-bold flex items-center gap-2", isFrutigerAero ? "text-blue-900" : "")}>
            <Users className="w-5 h-5" />
            Together Create
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-500/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {!sessionId ? (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium">Start a new session</h3>
                <p className="text-sm opacity-70">Create a session and invite your friends to code together in real-time.</p>
                <button
                  onClick={createSession}
                  disabled={loading}
                  className={clsx(
                    "w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                    isFrutigerAero ? "frutiger-aero-button" : "bg-emerald-500 hover:bg-emerald-600 text-white"
                  )}
                >
                  <Play className="w-4 h-4" />
                  {loading ? 'Creating...' : 'Create Session'}
                </button>
              </div>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-500/20"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className={clsx("px-2 text-sm", isFrutigerAero ? "bg-white/80 text-blue-800" : "bg-zinc-900 text-zinc-500")}>OR</span>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">Join a session</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Enter Session Code"
                    className={clsx(
                      "flex-1 px-4 py-2 rounded-xl border focus:outline-none focus:ring-2 transition-all font-mono uppercase",
                      isFrutigerAero ? "bg-white/60 border-white/40 text-blue-900 focus:ring-blue-400 shadow-inner" :
                      theme !== 'light' ? 'bg-zinc-800 border-zinc-700 text-white focus:ring-emerald-500/50' : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:ring-emerald-500/50'
                    )}
                  />
                  <button
                    onClick={joinSession}
                    disabled={loading || !joinCode.trim()}
                    className={clsx(
                      "px-6 py-2 rounded-xl font-medium transition-all",
                      isFrutigerAero ? "bg-blue-500 text-white shadow-md hover:bg-blue-600" : "bg-zinc-800 text-white hover:bg-zinc-700"
                    )}
                  >
                    Join
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-2">Session Code</p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-3xl font-mono font-bold tracking-widest">{sessionId}</span>
                  <button onClick={copyCode} className="p-2 rounded-lg hover:bg-emerald-500/20 text-emerald-500 transition-colors">
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-3 flex items-center justify-between">
                  Participants ({session?.participants.length || 0})
                </h3>
                <div className="space-y-2">
                  {session?.participants.map(p => (
                    <div key={p.uid} className="flex items-center justify-between p-3 rounded-lg bg-zinc-500/5">
                      <div className="flex items-center gap-3">
                        <img src={p.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.uid}`} alt="Avatar" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                        <div>
                          <p className="font-medium text-sm flex items-center gap-2">
                            {p.name}
                            {p.uid === session.hostId && <span className="text-[10px] uppercase tracking-wider bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full">Host</span>}
                            {p.uid === user?.uid && <span className="text-[10px] uppercase tracking-wider bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-full">You</span>}
                          </p>
                        </div>
                      </div>
                      {session.hostId === user?.uid && p.uid !== user?.uid && (
                        <button onClick={() => kickUser(p.uid)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg" title="Kick User">
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={leaveSession}
                className="w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
              >
                <LogOut className="w-4 h-4" />
                {session?.hostId === user?.uid ? 'End Session' : 'Leave Session'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
