import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { collection, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { X, Users, Copy, Check, Play, LogOut, UserMinus, MessageSquare, Send, ShieldAlert, MonitorPlay, Save } from 'lucide-react';
import { clsx } from 'clsx';
import { getDefaultAvatar } from '../lib/avatar';

interface CollabModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCode: string;
  onCodeChange: (code: string) => void;
  appTitle?: string;
  appId?: string | null;
  onTriggerTest?: () => void;
}

interface CollabSession {
  id: string;
  hostId: string;
  appId?: string;
  appTitle?: string;
  code: string;
  participants: {
    uid: string;
    name: string;
    avatarUrl: string;
  }[];
  messages: {
    id: string;
    uid: string;
    name: string;
    text: string;
    timestamp: any;
  }[];
  typingUsers: string[];
  status: 'lobby' | 'active';
  action: 'none' | 'test';
  allowOfflineAccess: boolean;
  joinRequests: {
    uid: string;
    name: string;
  }[];
  createdAt: any;
}

export default function CollabModal({ isOpen, onClose, currentCode, onCodeChange, appTitle, appId, onTriggerTest }: CollabModalProps) {
  const user = useStore(state => state.user);
  const userData = useStore(state => state.userData);
  const unlockAchievement = useStore(state => state.unlockAchievement);
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const language = useStore(state => state.language);
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [session, setSession] = useState<CollabSession | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [allowOffline, setAllowOffline] = useState(true);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  
  // Real-time listener
  useEffect(() => {
    if (!sessionId) return;
    const unsubscribe = onSnapshot(doc(db, 'collabSessions', sessionId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as CollabSession;
        setSession(data);
        
        // Sync code if we are not the one who just typed and code differs
        if (data.code !== currentCode) {
          onCodeChange(data.code);
        }
        
        // Trigger test if host asked to test together
        if (data.action === 'test' && user?.uid !== data.hostId) {
          if (onTriggerTest) onTriggerTest();
        }
      } else {
        // Session ended
        handleLocalSessionEnd();
      }
    });

    return () => unsubscribe();
  }, [sessionId, currentCode]);

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [session?.messages]);

  // Sync our local code changes to the session
  useEffect(() => {
    if (sessionId && session && session.code !== currentCode) {
      const syncCode = async () => {
        try {
          // If active, record typing status briefly
          let typingArr = session.typingUsers || [];
          if (!typingArr.includes(user?.uid || '')) {
             typingArr = [...typingArr, user?.uid || ''];
          }
          await updateDoc(doc(db, 'collabSessions', sessionId), {
            code: currentCode,
            typingUsers: typingArr
          });
          
          // Clear typing indicator after 2s
          setTimeout(() => {
            updateDoc(doc(db, 'collabSessions', sessionId), {
              typingUsers: arrayRemove(user?.uid)
            }).catch(() => {});
          }, 2000);
        } catch (error) {
          console.error("Error syncing code:", error);
        }
      };
      const timeout = setTimeout(syncCode, 500);
      return () => clearTimeout(timeout);
    }
  }, [currentCode, sessionId, user?.uid]);

  const handleLocalSessionEnd = async () => {
    if (session?.allowOfflineAccess && session.hostId !== user?.uid) {
      alert(language === 'ru' ? 'Сессия завершена. Хост разрешил вам сохранить локальную копию.' : 'Session ended. The host allowed you to keep a local copy.');
      // Keep code in state, maybe save as a new local app?
      // Since it's in the editor, it's auto saved as unsaved local changes so they can publish it.
    } else if (!session?.allowOfflineAccess && session?.hostId !== user?.uid) {
      alert(language === 'ru' ? 'Сессия завершена.' : 'Session ended.');
    }
    setSession(null);
    setSessionId(null);
  };

  const createSession = async () => {
    if (!user || !userData) return;
    setLoading(true);
    try {
      const newSessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const sessionData: CollabSession = {
        id: newSessionId,
        hostId: user.uid,
        appId: appId || '',
        appTitle: appTitle || 'Untitled App',
        code: currentCode,
        participants: [{
          uid: user.uid,
          name: userData.name || 'Host',
          avatarUrl: userData.avatarUrl || user.photoURL || ''
        }],
        messages: [],
        typingUsers: [],
        status: 'lobby',
        action: 'none',
        allowOfflineAccess: allowOffline,
        joinRequests: [],
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'collabSessions', newSessionId), sessionData);
      
      // Update public user profile so friends can join
      await updateDoc(doc(db, 'users_public', user.uid), {
        activeCollabSession: newSessionId,
        activeCollabAppTitle: sessionData.appTitle
      }).catch(console.error);

      unlockAchievement('together_create');
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
          avatarUrl: userData.avatarUrl || user.photoURL || ''
        };
        await updateDoc(sessionRef, {
          participants: arrayUnion(participant)
        });
        unlockAchievement('together_create');
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
        await deleteDoc(doc(db, 'collabSessions', sessionId));
        await updateDoc(doc(db, 'users_public', user.uid), {
          activeCollabSession: null,
          activeCollabAppTitle: null
        }).catch(console.error);
      } else {
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

  const startCreation = async () => {
    if (!sessionId || session?.hostId !== user?.uid) return;
    try {
      await updateDoc(doc(db, 'collabSessions', sessionId), { status: 'active' });
    } catch (err) {
      console.error(err);
    }
  };

  const testTogether = async () => {
    if (!sessionId || session?.hostId !== user?.uid) return;
    try {
      await updateDoc(doc(db, 'collabSessions', sessionId), { action: 'test' });
      if (onTriggerTest) onTriggerTest();
      // Reset action after 3s so it can be triggered again later
      setTimeout(() => {
        updateDoc(doc(db, 'collabSessions', sessionId), { action: 'none' }).catch(() => {});
      }, 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // Friend logic implementation...
  const acceptJoinRequest = async (req: {uid: string, name: string}) => {
     if (!sessionId || session?.hostId !== user?.uid) return;
     try {
       // Find user profile to get avatar
       const userDoc = await getDoc(doc(db, 'users', req.uid));
       const avatarUrl = userDoc.exists() ? userDoc.data().avatarUrl || '' : '';
       
       await updateDoc(doc(db, 'collabSessions', sessionId), {
          joinRequests: arrayRemove(req),
          participants: arrayUnion({
             uid: req.uid,
             name: req.name,
             avatarUrl: avatarUrl
          })
       });
     } catch (err) {
       console.error("Error accepting request", err);
     }
  };

  const rejectJoinRequest = async (req: {uid: string, name: string}) => {
     if (!sessionId || session?.hostId !== user?.uid) return;
     try {
       await updateDoc(doc(db, 'collabSessions', sessionId), {
          joinRequests: arrayRemove(req)
       });
     } catch (err) {
       console.error("Error rejecting request", err);
     }
  };


  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !sessionId || !user) return;
    try {
      const newMsg = {
        id: Math.random().toString(36).substring(2, 9),
        uid: user.uid,
        name: userData?.name || 'User',
        text: messageText,
        timestamp: Date.now()
      };
      await updateDoc(doc(db, 'collabSessions', sessionId), {
        messages: arrayUnion(newMsg)
      });
      setMessageText('');
    } catch (err) {
      console.error(err);
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

  // Let's make the active modal positioned fixed to the right
  const isActive = session?.status === 'active';

  return (
    <>
      <div className={clsx(
        "fixed z-[100] transition-all duration-300",
        isActive ? "right-4 top-20 bottom-20 w-80 flex flex-col" : "inset-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm pointer-events-auto"
      )}>
        <div className={clsx(
          "rounded-2xl overflow-hidden flex flex-col relative w-full pointer-events-auto",
          isActive ? "h-full border shadow-2xl backdrop-blur-md" : "max-w-md shadow-2xl max-h-[90vh]",
          isFrutigerAero ? "bg-white/90 border-white/50" :
          theme === 'dark' || isActive ? "bg-zinc-900 border-zinc-800" :
          theme === 'gradient' ? "bg-zinc-900/90 border-emerald-800/50" :
          "bg-white border-zinc-200"
        )}>
          <div className={clsx(
            "flex items-center justify-between p-4 border-b shrink-0",
            isFrutigerAero ? "border-white/40 bg-white/40" :
            "border-zinc-800"
          )}>
            <h2 className={clsx("text-lg font-bold flex items-center gap-2", isFrutigerAero ? "text-blue-900" : "text-white")}>
              <Users className="w-5 h-5" />
              Together Create {isActive && <span className="ml-2 w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>}
            </h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-500/20 text-zinc-400 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 overflow-y-auto flex-1 flex flex-col no-scrollbar">
            {!sessionId ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-medium text-white">Start a new session</h3>
                  <label className="flex items-center gap-2 cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      checked={allowOffline}
                      onChange={e => setAllowOffline(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500 bg-zinc-800"
                    />
                    <span className="text-sm text-zinc-300">Allow offline access for participants</span>
                  </label>
                  <button
                    onClick={createSession}
                    disabled={loading}
                    className={clsx(
                      "w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                      isFrutigerAero ? "frutiger-aero-button" : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                    )}
                  >
                    <Play className="w-4 h-4" />
                    {loading ? 'Creating...' : 'Create Session'}
                  </button>
                </div>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-800"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-2 text-sm bg-zinc-900 text-zinc-500">OR</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium text-white">Join a session</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="Enter Session Code"
                      className="flex-1 px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono uppercase"
                    />
                    <button
                      onClick={joinSession}
                      disabled={loading || !joinCode.trim()}
                      className="px-6 py-2 rounded-xl bg-zinc-800 text-white hover:bg-zinc-700 font-medium transition-colors"
                    >
                      Join
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full space-y-4">
                {!isActive && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center shrink-0">
                    <p className="text-sm text-emerald-500 mb-2">Session Room Code</p>
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-3xl font-mono font-bold tracking-widest text-white">{sessionId}</span>
                      <button onClick={copyCode} className="p-2 rounded-lg hover:bg-emerald-500/20 text-emerald-500 transition-colors">
                        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="shrink-0 max-h-48 overflow-y-auto w-full">
                  <h3 className="font-medium text-sm text-zinc-400 mb-2 flex items-center justify-between">
                    Participants ({session?.participants?.length || 0})
                  </h3>
                  <div className="space-y-1">
                    {session?.participants?.map(p => {
                      const isTyping = session.typingUsers?.includes(p.uid);
                      return (
                        <div key={p.uid} className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/50">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <img src={p.avatarUrl || getDefaultAvatar(p.uid)} alt="Avatar" className="w-6 h-6 rounded-full shrink-0" referrerPolicy="no-referrer" />
                            <div className="truncate flex-1">
                              <p className="font-medium text-xs text-white flex items-center gap-2 truncate">
                                <span className="truncate max-w-[80px] sm:max-w-none">{p.name}</span>
                                {p.uid === session.hostId && <span className="text-[9px] uppercase tracking-wider bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-full shrink-0">Host</span>}
                                {isTyping && <span className="text-[9px] text-emerald-400 animate-pulse">typing...</span>}
                              </p>
                            </div>
                          </div>
                          {session.hostId === user?.uid && p.uid !== user?.uid && (
                            <button onClick={() => kickUser(p.uid)} className="p-1 text-red-500 hover:bg-red-500/10 rounded-lg shrink-0 ml-1">
                              <UserMinus className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {isActive && (
                  <div className="flex-1 min-h-[200px] flex flex-col bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800">
                    <div className="p-2 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-400 flex items-center gap-1"><MessageSquare className="w-3 h-3"/> Team Chat</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3" ref={chatMessagesRef}>
                      {session.messages?.length === 0 && (
                        <div className="text-center text-xs text-zinc-600 mt-4">No messages yet. Say hi!</div>
                      )}
                      {session.messages?.map(msg => (
                        <div key={msg.id} className={clsx("flex flex-col", msg.uid === user?.uid ? "items-end" : "items-start")}>
                          <span className="text-[10px] text-zinc-500 mb-1">{msg.name}</span>
                          <div className={clsx(
                            "px-3 py-1.5 rounded-xl text-sm max-w-[85%] break-words",
                            msg.uid === user?.uid ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-200"
                          )}>
                            {msg.text}
                          </div>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={sendMessage} className="p-2 border-t border-zinc-800 bg-zinc-900 flex gap-2">
                      <input
                        type="text"
                        value={messageText}
                        onChange={e => setMessageText(e.target.value)}
                        placeholder="Message..."
                        className="flex-1 min-w-0 bg-zinc-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
                      />
                      <button type="submit" disabled={!messageText.trim()} className="p-1.5 px-3 bg-emerald-500 text-white rounded-lg disabled:opacity-50 shrink-0">
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                )}

                <div className="shrink-0 space-y-2 pt-2">
                  {!isActive && session?.hostId === user?.uid && (
                    <button
                      onClick={startCreation}
                      className="w-full py-2.5 rounded-xl font-medium bg-emerald-500 hover:bg-emerald-600 text-white text-sm flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4" /> Start Editing
                    </button>
                  )}

                  {isActive && session?.hostId === user?.uid && (
                    <button
                      onClick={testTogether}
                      className="w-full py-2.5 rounded-xl font-medium bg-blue-500 hover:bg-blue-600 text-white text-sm flex items-center justify-center gap-2 line-clamp-1"
                    >
                      <MonitorPlay className="w-4 h-4" /> Test Together
                    </button>
                  )}

                  <button
                    onClick={leaveSession}
                    className="w-full py-2.5 rounded-xl font-medium bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    {session?.hostId === user?.uid ? 'Close Room' : 'Leave Session'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Join Requests Overlay for Host */}
      {session && session.hostId === user?.uid && session.joinRequests?.length > 0 && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Join Requests</h3>
            <div className="space-y-3">
              {session.joinRequests.map(req => (
                <div key={req.uid} className="bg-zinc-800/50 border border-zinc-700 p-4 rounded-xl flex flex-col gap-3">
                  <p className="text-sm text-zinc-300">
                    <span className="font-bold text-white">{req.name}</span> wants to join <span className="font-bold text-emerald-400">"{session.appTitle}"</span>.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => acceptJoinRequest(req)} className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium">Accept</button>
                    <button onClick={() => rejectJoinRequest(req)} className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium">Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
