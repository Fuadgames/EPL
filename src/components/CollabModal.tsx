import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { notify } from '../store/useDialogStore';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  X,
  Users,
  Copy,
  Check,
  Play,
  LogOut,
  UserMinus,
  MessageSquare,
  Send,
  MonitorPlay,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
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
  lockedLines?: Record<number, { uid: string; name: string }>;
  status: 'lobby' | 'active';
  action: 'none' | 'test';
  allowOfflineAccess: boolean;
  joinRequests: {
    uid: string;
    name: string;
  }[];
  createdAt: any;
}

export default function CollabModal({
  isOpen,
  onClose,
  currentCode,
  onCodeChange,
  appTitle,
  appId,
  onTriggerTest,
}: CollabModalProps) {
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
  const [isMinimized, setIsMinimized] = useState(false);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  const currentCodeRef = useRef(currentCode);
  const localSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    currentCodeRef.current = currentCode;
  }, [currentCode]);

  useEffect(() => {
    useStore.getState().setCollabSessionId(sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const unsubscribe = onSnapshot(doc(db, 'collabSessions', sessionId), docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data() as CollabSession;
        setSession(data);
        useStore.getState().setCollabLockedLines(data.lockedLines || {});

        if (data.code !== currentCodeRef.current && !docSnap.metadata.hasPendingWrites) {
          const remoteLines = data.code.split('\n');
          const localLines = currentCodeRef.current.split('\n');
          const lockedLines = data.lockedLines || {};

          const mergedLines = [];
          const maxLen = Math.max(remoteLines.length, localLines.length);
          const localLockIndex = useStore.getState().collabLocalLockIndex;

          let hasLocalLocks = false;

          for (let i = 0; i < maxLen; i++) {
            const lock = lockedLines[i];
            const isOurs = (lock && lock.uid === user?.uid) || localLockIndex === i;
            if (isOurs) {
              mergedLines.push(localLines[i] ?? '');
              hasLocalLocks = true;
            } else if (i < remoteLines.length) {
              mergedLines.push(remoteLines[i]);
            }
          }
          const mergedCode = mergedLines.join('\n');

          if (!hasLocalLocks && !localSyncTimeoutRef.current) {
            onCodeChange(data.code);
          } else if (mergedCode !== currentCodeRef.current) {
            onCodeChange(mergedCode);
          }
        }

        if (data.action === 'test' && user?.uid !== data.hostId) {
          if (onTriggerTest) onTriggerTest();
        }
      } else {
        handleLocalSessionEnd();
      }
    });

    return () => unsubscribe();
  }, [sessionId]);

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [session?.messages]);

  useEffect(() => {
    if (sessionId && session && session.code !== currentCodeRef.current) {
      if (localSyncTimeoutRef.current) clearTimeout(localSyncTimeoutRef.current);

      const timeoutId = setTimeout(async () => {
        try {
          let typingArr = session.typingUsers || [];
          if (!typingArr.includes(user?.uid || '')) {
            typingArr = [...typingArr, user?.uid || ''];
          }

          await updateDoc(doc(db, 'collabSessions', sessionId), {
            code: currentCodeRef.current,
            typingUsers: typingArr,
          });

          if (localSyncTimeoutRef.current === timeoutId) {
            localSyncTimeoutRef.current = null;
          }

          setTimeout(() => {
            updateDoc(doc(db, 'collabSessions', sessionId), {
              typingUsers: arrayRemove(user?.uid),
            }).catch(() => {});
          }, 2000);
        } catch (error) {
          console.error('Error syncing code:', error);
          if (localSyncTimeoutRef.current === timeoutId) {
            localSyncTimeoutRef.current = null;
          }
        }
      }, 500);

      localSyncTimeoutRef.current = timeoutId;

      return () => {
        if (localSyncTimeoutRef.current === timeoutId) {
          clearTimeout(localSyncTimeoutRef.current);
          localSyncTimeoutRef.current = null;
        }
      };
    }
  }, [currentCode, sessionId, user?.uid]);

  const handleLocalSessionEnd = async () => {
    if (session?.allowOfflineAccess && session.hostId !== user?.uid) {
      notify.info(
        language === 'ru'
          ? 'Сессия завершена. Хост разрешил вам сохранить локальную копию.'
          : 'Session ended. The host allowed you to keep a local copy.'
      );
    } else if (!session?.allowOfflineAccess && session?.hostId !== user?.uid) {
      notify.info(language === 'ru' ? 'Сессия завершена.' : 'Session ended.');
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
        participants: [
          {
            uid: user.uid,
            name: userData.name || 'Host',
            avatarUrl: userData.avatarUrl || user.photoURL || '',
          },
        ],
        messages: [],
        typingUsers: [],
        status: 'lobby',
        action: 'none',
        allowOfflineAccess: allowOffline,
        joinRequests: [],
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'collabSessions', newSessionId), sessionData);

      await updateDoc(doc(db, 'users_public', user.uid), {
        activeCollabSession: newSessionId,
        activeCollabAppTitle: sessionData.appTitle,
      }).catch(console.error);

      unlockAchievement('together_create');
      setSessionId(newSessionId);
    } catch (error) {
      console.error('Error creating session:', error);
      notify.error(language === 'ru' ? 'Не удалось создать сессию' : 'Failed to create session');
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
        };
        await updateDoc(sessionRef, {
          participants: arrayUnion(participant),
        });
        unlockAchievement('together_create');
        setSessionId(joinCode.toUpperCase());
      } else {
        notify.error(language === 'ru' ? 'Сессия не найдена.' : 'Session not found.');
      }
    } catch (error) {
      console.error('Error joining session:', error);
      notify.error(language === 'ru' ? 'Не удалось подключиться к сессии.' : 'Failed to join session.');
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
          activeCollabAppTitle: null,
        }).catch(console.error);
      } else {
        const participantToRemove = session.participants.find(p => p.uid === user.uid);
        if (participantToRemove) {
          await updateDoc(doc(db, 'collabSessions', sessionId), {
            participants: arrayRemove(participantToRemove),
          });
        }
      }
      setSessionId(null);
      setSession(null);
    } catch (error) {
      console.error('Error leaving session:', error);
    }
  };

  const kickUser = async (uidToKick: string) => {
    if (!user || !sessionId || !session || session.hostId !== user.uid) return;
    try {
      const participantToRemove = session.participants.find(p => p.uid === uidToKick);
      if (participantToRemove) {
        await updateDoc(doc(db, 'collabSessions', sessionId), {
          participants: arrayRemove(participantToRemove),
        });
      }
    } catch (error) {
      console.error('Error kicking user:', error);
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
      setTimeout(() => {
        updateDoc(doc(db, 'collabSessions', sessionId), { action: 'none' }).catch(() => {});
      }, 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const acceptJoinRequest = async (req: { uid: string; name: string }) => {
    if (!sessionId || session?.hostId !== user?.uid) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', req.uid));
      const avatarUrl = userDoc.exists() ? userDoc.data().avatarUrl || '' : '';

      await updateDoc(doc(db, 'collabSessions', sessionId), {
        joinRequests: arrayRemove(req),
        participants: arrayUnion({
          uid: req.uid,
          name: req.name,
          avatarUrl,
        }),
      });
    } catch (err) {
      console.error('Error accepting request', err);
    }
  };

  const rejectJoinRequest = async (req: { uid: string; name: string }) => {
    if (!sessionId || session?.hostId !== user?.uid) return;
    try {
      await updateDoc(doc(db, 'collabSessions', sessionId), {
        joinRequests: arrayRemove(req),
      });
    } catch (err) {
      console.error('Error rejecting request', err);
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
        timestamp: Date.now(),
      };
      await updateDoc(doc(db, 'collabSessions', sessionId), {
        messages: arrayUnion(newMsg),
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

  const isActive = session?.status === 'active';
  const isDark = theme !== 'light' && !isFrutigerAero;

  return (
    <>
      <div
        className={clsx(
          'fixed z-[200] transition-all duration-300',
          isActive
            ? isMinimized
              ? 'bottom-4 right-4 left-4 sm:left-auto sm:right-4 sm:w-64 h-14'
              : 'bottom-0 left-0 right-0 sm:bottom-20 sm:left-auto sm:right-4 sm:top-20 sm:w-80 flex flex-col h-[60vh] sm:h-auto'
            : 'inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto'
        )}
      >
        <div
          className={clsx(
            'overflow-hidden flex flex-col relative w-full pointer-events-auto border transition-all duration-300',
            isActive
              ? isMinimized
                ? 'h-full rounded-xl shadow-xl'
                : 'h-full sm:rounded-xl rounded-t-2xl shadow-2xl'
              : 'max-w-md rounded-xl shadow-2xl max-h-[90vh]',
            isFrutigerAero
              ? 'frutiger-aero-glass border-white/60 text-blue-950'
              : isDark
              ? 'bg-[#181B20] border-[#262B33] text-[#F1F3F5]'
              : 'bg-white border-[#E2E5EA] text-[#111315]'
          )}
        >
          <div
            className={clsx(
              'flex items-center justify-between p-3.5 sm:p-4 border-b shrink-0',
              isFrutigerAero
                ? 'border-white/50 bg-white/40'
                : isDark
                ? 'border-[#262B33] bg-[#14171B]'
                : 'border-[#E2E5EA] bg-[#F5F6F8]',
              isActive && isMinimized ? 'cursor-pointer' : ''
            )}
            onClick={() => isActive && isMinimized && setIsMinimized(false)}
          >
            <h2
              className={clsx(
                'text-base font-bold flex items-center gap-2',
                isFrutigerAero ? 'text-blue-950' : isDark ? 'text-[#F1F3F5]' : 'text-[#111315]'
              )}
            >
              <Users className={clsx('w-4 h-4', isFrutigerAero ? 'text-blue-600' : 'text-[#10B981]')} />
              <span className="hidden sm:inline">Together Create</span>
              <span className="sm:hidden">Together</span>
              {isActive && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded border border-[#10B981]/40 text-[#10B981] bg-[#10B981]/10">
                  Live
                </span>
              )}
            </h2>
            <div className="flex items-center gap-1">
              {isActive && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setIsMinimized(!isMinimized);
                  }}
                  className={clsx(
                    'p-1.5 rounded-lg transition-colors',
                    isDark ? 'hover:bg-[#21252C] text-[#9BA1A6]' : 'hover:bg-black/5 text-[#5C636E]'
                  )}
                >
                  {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              )}
              <button
                onClick={e => {
                  e.stopPropagation();
                  onClose();
                }}
                className={clsx(
                  'p-1.5 rounded-lg transition-colors',
                  isDark ? 'hover:bg-[#21252C] text-[#9BA1A6]' : 'hover:bg-black/5 text-[#5C636E]'
                )}
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <div className="p-4 overflow-y-auto flex-1 flex flex-col no-scrollbar">
              {!sessionId ? (
                <div className="space-y-5">
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm">
                      {language === 'ru' ? 'Начать новую сессию' : 'Start a new session'}
                    </h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowOffline}
                        onChange={e => setAllowOffline(e.target.checked)}
                        className="w-4 h-4 rounded border-[#262B33] text-[#10B981] focus:ring-[#10B981]"
                      />
                      <span className={clsx('text-sm', isDark ? 'text-[#9BA1A6]' : 'text-[#5C636E]')}>
                        {language === 'ru' ? 'Разрешить участникам оффлайн-копию' : 'Allow offline access for participants'}
                      </span>
                    </label>
                    <button
                      onClick={createSession}
                      disabled={loading}
                      className={clsx(
                        'w-full py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap',
                        isFrutigerAero
                          ? 'frutiger-aero-button text-white'
                          : 'bg-[#10B981] hover:bg-[#059669] text-[#111315]'
                      )}
                    >
                      <Play className="w-4 h-4" />
                      {loading
                        ? language === 'ru'
                          ? 'Создание...'
                          : 'Creating...'
                        : language === 'ru'
                        ? 'Создать сессию'
                        : 'Create Session'}
                    </button>
                  </div>

                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className={clsx('w-full border-t', isDark ? 'border-[#262B33]' : 'border-[#E2E5EA]')} />
                    </div>
                    <div className="relative flex justify-center">
                      <span
                        className={clsx(
                          'px-2 text-xs font-medium uppercase tracking-wider',
                          isFrutigerAero
                            ? 'bg-white/80 text-blue-900'
                            : isDark
                            ? 'bg-[#181B20] text-[#6B7280]'
                            : 'bg-white text-[#8A94A6]'
                        )}
                      >
                        {language === 'ru' ? 'ИЛИ' : 'OR'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm">
                      {language === 'ru' ? 'Присоединиться к сессии' : 'Join a session'}
                    </h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={joinCode}
                        onChange={e => setJoinCode(e.target.value.toUpperCase())}
                        placeholder={language === 'ru' ? 'Код сессии' : 'Enter Session Code'}
                        className={clsx(
                          'flex-1 px-3 py-2 rounded-lg border text-sm font-mono uppercase focus:outline-none focus:border-[#10B981]',
                          isDark
                            ? 'bg-[#111315] border-[#262B33] text-[#F1F3F5]'
                            : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315]'
                        )}
                      />
                      <button
                        onClick={joinSession}
                        disabled={loading || !joinCode.trim()}
                        className={clsx(
                          'px-5 py-2 rounded-lg font-medium text-sm border transition-colors whitespace-nowrap shrink-0',
                          isDark
                            ? 'bg-[#21252C] border-[#262B33] text-[#F1F3F5] hover:bg-[#2A2F38]'
                            : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315] hover:bg-[#EBEEF2]'
                        )}
                      >
                        {language === 'ru' ? 'Войти' : 'Join'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full space-y-4">
                  {!isActive && (
                    <div
                      className={clsx(
                        'p-4 rounded-lg border text-center shrink-0',
                        isDark ? 'bg-[#111315] border-[#262B33]' : 'bg-[#F5F6F8] border-[#E2E5EA]'
                      )}
                    >
                      <p className="text-xs font-medium text-[#10B981] mb-2 uppercase tracking-wider">
                        {language === 'ru' ? 'Код комнаты' : 'Session Room Code'}
                      </p>
                      <div className="flex items-center justify-center gap-3">
                        <span className="text-2xl font-mono font-bold tracking-widest">{sessionId}</span>
                        <button
                          onClick={copyCode}
                          className="p-1.5 rounded-lg border border-[#10B981]/30 hover:bg-[#10B981]/10 text-[#10B981] transition-colors"
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="shrink-0 max-h-48 overflow-y-auto w-full">
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-[#9BA1A6] mb-2 font-mono-num">
                      {language === 'ru' ? 'Участники' : 'Participants'} ({session?.participants?.length || 0})
                    </h3>
                    <div className="space-y-1.5">
                      {session?.participants?.map(p => {
                        const isTyping = session.typingUsers?.includes(p.uid);
                        return (
                          <div
                            key={p.uid}
                            className={clsx(
                              'flex items-center justify-between p-2 rounded-lg border',
                              isDark ? 'bg-[#111315] border-[#262B33]' : 'bg-[#F5F6F8] border-[#E2E5EA]'
                            )}
                          >
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <img
                                src={p.avatarUrl || getDefaultAvatar(p.uid)}
                                alt="Avatar"
                                className="w-6 h-6 rounded-full shrink-0"
                                referrerPolicy="no-referrer"
                              />
                              <div className="truncate flex-1">
                                <p className="font-medium text-xs flex items-center gap-2 truncate">
                                  <span className="truncate max-w-[100px] sm:max-w-none">{p.name}</span>
                                  {p.uid === session.hostId && (
                                    <span className="text-[10px] uppercase tracking-wider border border-amber-500/40 bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded shrink-0">
                                      Host
                                    </span>
                                  )}
                                  {isTyping && <span className="text-[10px] text-[#10B981]">typing...</span>}
                                </p>
                              </div>
                            </div>
                            {session.hostId === user?.uid && p.uid !== user?.uid && (
                              <button
                                onClick={() => kickUser(p.uid)}
                                className="p-1 text-red-500 hover:bg-red-500/10 rounded shrink-0 ml-1"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {isActive && (
                    <div
                      className={clsx(
                        'flex-1 min-h-[200px] flex flex-col rounded-lg overflow-hidden border',
                        isDark ? 'bg-[#111315] border-[#262B33]' : 'bg-[#F5F6F8] border-[#E2E5EA]'
                      )}
                    >
                      <div
                        className={clsx(
                          'p-2.5 border-b flex items-center justify-between',
                          isDark ? 'border-[#262B33] bg-[#14171B]' : 'border-[#E2E5EA] bg-white'
                        )}
                      >
                        <span className="text-xs font-medium text-[#9BA1A6] flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5" /> Team Chat
                        </span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-2.5" ref={chatMessagesRef}>
                        {session.messages?.length === 0 && (
                          <div className="text-center text-xs text-[#6B7280] mt-4">No messages yet.</div>
                        )}
                        {session.messages?.map(msg => (
                          <div
                            key={msg.id}
                            className={clsx('flex flex-col', msg.uid === user?.uid ? 'items-end' : 'items-start')}
                          >
                            <span className="text-[10px] text-[#6B7280] mb-1">{msg.name}</span>
                            <div
                              className={clsx(
                                'px-3 py-1.5 rounded-lg text-xs max-w-[85%] break-words',
                                msg.uid === user?.uid
                                  ? 'bg-[#10B981] text-[#111315] font-medium'
                                  : isDark
                                  ? 'bg-[#21252C] text-[#F1F3F5]'
                                  : 'bg-white border border-[#E2E5EA] text-[#111315]'
                              )}
                            >
                              {msg.text}
                            </div>
                          </div>
                        ))}
                      </div>
                      <form
                        onSubmit={sendMessage}
                        className={clsx(
                          'p-2 border-t flex gap-2',
                          isDark ? 'border-[#262B33] bg-[#14171B]' : 'border-[#E2E5EA] bg-white'
                        )}
                      >
                        <input
                          type="text"
                          value={messageText}
                          onChange={e => setMessageText(e.target.value)}
                          placeholder="Message..."
                          className={clsx(
                            'flex-1 min-w-0 rounded-lg px-3 py-1.5 text-xs focus:outline-none border',
                            isDark
                              ? 'bg-[#111315] border-[#262B33] text-[#F1F3F5]'
                              : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315]'
                          )}
                        />
                        <button
                          type="submit"
                          disabled={!messageText.trim()}
                          className="p-1.5 px-3 bg-[#10B981] text-[#111315] rounded-lg disabled:opacity-50 shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    </div>
                  )}

                  <div className="shrink-0 space-y-2 pt-1">
                    {!isActive && session?.hostId === user?.uid && (
                      <button
                        onClick={startCreation}
                        className="w-full py-2.5 rounded-lg font-semibold bg-[#10B981] hover:bg-[#059669] text-[#111315] text-sm flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        <Play className="w-4 h-4" /> Start Editing
                      </button>
                    )}

                    {isActive && session?.hostId === user?.uid && (
                      <button
                        onClick={testTogether}
                        className={clsx(
                          'w-full py-2.5 rounded-lg font-medium border text-sm flex items-center justify-center gap-2 whitespace-nowrap',
                          isDark
                            ? 'bg-[#21252C] border-[#262B33] text-[#F1F3F5] hover:bg-[#2A2F38]'
                            : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315] hover:bg-[#EBEEF2]'
                        )}
                      >
                        <MonitorPlay className="w-4 h-4" /> Test Together
                      </button>
                    )}

                    <button
                      onClick={leaveSession}
                      className="w-full py-2.5 rounded-lg font-medium bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                    >
                      <LogOut className="w-4 h-4" />
                      {session?.hostId === user?.uid ? 'Close Room' : 'Leave Session'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {session && session.hostId === user?.uid && session.joinRequests?.length > 0 && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className={clsx(
              'border p-5 rounded-xl w-full max-w-sm shadow-2xl',
              isDark ? 'bg-[#181B20] border-[#262B33] text-[#F1F3F5]' : 'bg-white border-[#E2E5EA] text-[#111315]'
            )}
          >
            <h3 className="text-base font-bold mb-4">Join Requests</h3>
            <div className="space-y-3">
              {session.joinRequests.map(req => (
                <div
                  key={req.uid}
                  className={clsx(
                    'border p-3.5 rounded-lg flex flex-col gap-3',
                    isDark ? 'bg-[#111315] border-[#262B33]' : 'bg-[#F5F6F8] border-[#E2E5EA]'
                  )}
                >
                  <p className="text-sm">
                    <span className="font-semibold">{req.name}</span> wants to join{' '}
                    <span className="font-semibold text-[#10B981]">"{session.appTitle}"</span>.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptJoinRequest(req)}
                      className="flex-1 py-2 bg-[#10B981] hover:bg-[#059669] text-[#111315] font-semibold rounded-lg text-xs"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => rejectJoinRequest(req)}
                      className={clsx(
                        'flex-1 py-2 rounded-lg text-xs font-medium border',
                        isDark ? 'bg-[#21252C] border-[#262B33] text-[#F1F3F5]' : 'bg-white border-[#E2E5EA] text-[#111315]'
                      )}
                    >
                      Decline
                    </button>
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
