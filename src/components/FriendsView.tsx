import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { confirmAction, notify } from '../store/useDialogStore';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Search, UserPlus, UserCheck, UserX, Clock, Check, X, Copy } from 'lucide-react';
import { clsx } from 'clsx';
import QRCode from 'qrcode';
import { getDefaultAvatar } from '../lib/avatar';

interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  senderName?: string;
  senderAvatar?: string;
}

interface PublicUser {
  uid: string;
  name: string;
  avatarUrl: string;
  region: string;
  eplCoins: number;
  activeCollabSession?: string | null;
  activeCollabAppTitle?: string | null;
}

export default function FriendsView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const user = useStore((state) => state.user);
  const userData = useStore((state) => state.userData);
  const theme = useStore((state) => state.theme);
  const isFrutigerAero = useStore((state) => state.isFrutigerAero);
  const language = useStore((state) => state.language);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const friendLink = `${window.location.origin}/profile/${user?.uid}`;
  const isLight = theme === 'light' && !isFrutigerAero;

  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchRequests();
    }
  }, [user, userData?.friends]);

  useEffect(() => {
    if (canvasRef.current && user) {
      QRCode.toCanvas(canvasRef.current, friendLink, { width: 112, margin: 1 });
    }
  }, [user, friendLink]);

  const fetchFriends = async () => {
    if (!userData?.friends || userData.friends.length === 0) {
      setFriends([]);
      return;
    }

    try {
      const usersRef = collection(db, 'users_public');
      const chunks = [];
      for (let i = 0; i < userData.friends.length; i += 10) {
        chunks.push(userData.friends.slice(i, i + 10));
      }

      let allFriends: PublicUser[] = [];
      for (const chunk of chunks) {
        const chunkQuery = query(usersRef, where('uid', 'in', chunk));
        const snapshot = await getDocs(chunkQuery);
        allFriends = [...allFriends, ...snapshot.docs.map((docSnap) => docSnap.data() as PublicUser)];
      }
      setFriends(allFriends);
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const fetchRequests = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'friendRequests'),
        where('receiverId', '==', user.uid),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(q);
      const reqs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as FriendRequest));

      const reqsWithDetails = await Promise.all(
        reqs.map(async (req) => {
          const senderDoc = await getDocs(
            query(collection(db, 'users_public'), where('uid', '==', req.senderId))
          );
          if (!senderDoc.empty) {
            const senderData = senderDoc.docs[0].data();
            return { ...req, senderName: senderData.name, senderAvatar: senderData.avatarUrl };
          }
          return req;
        })
      );

      setRequests(reqsWithDetails);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !user) return;

    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'users_public'));
      const allUsers = snapshot.docs.map((docSnap) => docSnap.data() as PublicUser);

      const results = allUsers.filter(
        (u) => u.uid !== user.uid && (u.name || '').toLowerCase().includes(searchQuery.toLowerCase())
      );

      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async (receiverId: string) => {
    if (!user) return;
    try {
      const requestId = `${user.uid}_${receiverId}`;
      await setDoc(doc(db, 'friendRequests', requestId), {
        id: requestId,
        senderId: user.uid,
        senderName: userData?.name || 'Unknown User',
        receiverId,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      notify.success(language === 'ru' ? 'Запрос в друзья отправлен' : 'Friend request sent!');
    } catch (error) {
      console.error('Error sending request:', error);
      notify.error(language === 'ru' ? 'Не удалось отправить запрос' : 'Failed to send request.');
    }
  };

  const handleRequest = async (requestId: string, senderId: string, accept: boolean) => {
    if (!user) return;
    try {
      const reqRef = doc(db, 'friendRequests', requestId);
      if (accept) {
        await updateDoc(reqRef, { status: 'accepted' });
        await updateDoc(doc(db, 'users', user.uid), {
          friends: arrayUnion(senderId),
        });
        await updateDoc(doc(db, 'users', senderId), {
          friends: arrayUnion(user.uid),
        });
        notify.success(language === 'ru' ? 'Пользователь добавлен в друзья' : 'Friend added!');
      } else {
        await updateDoc(reqRef, { status: 'declined' });
      }
      fetchRequests();
    } catch (error) {
      console.error('Error handling request:', error);
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!user) return;
    const confirmed = await confirmAction({
      title: language === 'ru' ? 'Удалить из друзей?' : 'Remove Friend?',
      message:
        language === 'ru'
          ? 'Вы уверены, что хотите удалить этого пользователя из списка друзей?'
          : 'Are you sure you want to remove this friend?',
      confirmText: language === 'ru' ? 'Удалить' : 'Remove',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        friends: arrayRemove(friendId),
      });
      await updateDoc(doc(db, 'users', friendId), {
        friends: arrayRemove(user.uid),
      });
      fetchFriends();
      notify.info(language === 'ru' ? 'Удалено из друзей' : 'Friend removed');
    } catch (error) {
      console.error('Error removing friend:', error);
    }
  };

  const [waitingForCollab, setWaitingForCollab] = useState<string | null>(null);

  const sendCollabJoinRequest = async (friend: PublicUser) => {
    if (!user || !friend.activeCollabSession) return;
    try {
      await updateDoc(doc(db, 'collabSessions', friend.activeCollabSession), {
        joinRequests: arrayUnion({
          uid: user.uid,
          name: userData?.name || 'Friend',
        }),
      });
      setWaitingForCollab(friend.activeCollabSession);
    } catch (err) {
      console.error('Error sending join request', err);
      notify.error('Failed to send collab request.');
    }
  };

  useEffect(() => {
    if (!waitingForCollab || !user) return;
    const unsub = onSnapshot(
      doc(db, 'collabSessions', waitingForCollab),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.participants?.some((p: any) => p.uid === user.uid)) {
            notify.success(
              `Accepted! Open Editor -> Together Create and enter code: ${waitingForCollab}`
            );
            setWaitingForCollab(null);
          }
        }
      },
      (err) => {
        console.warn('Error watching collab session:', err);
        setWaitingForCollab(null);
      }
    );
    return () => unsub();
  }, [waitingForCollab, user]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* My ID + QR */}
      <div
        className={clsx(
          'p-5 rounded-xl border flex flex-col md:flex-row items-center gap-6',
          isFrutigerAero
            ? 'frutiger-aero-glass'
            : isLight
            ? 'bg-white border-[#E2E5EA]'
            : 'bg-[#181B20] border-[#262B33]'
        )}
      >
        <div className="flex-1 space-y-2 w-full">
          <h2 className="text-lg font-bold">My Friend ID</h2>
          <p className="text-sm opacity-70">Share this ID or QR code to add friends.</p>
          <div
            className={clsx(
              'flex items-center justify-between gap-2 px-3 py-2 rounded-lg border',
              isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
            )}
          >
            <span className="font-mono text-xs truncate">{user?.uid || 'Not signed in'}</span>
            {user?.uid && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(user.uid);
                  notify.success('Copied ID');
                }}
                className="p-1 opacity-70 hover:opacity-100"
              >
                <Copy className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <canvas ref={canvasRef} className="rounded-lg bg-white p-1" />
          <span className="text-[11px] font-mono opacity-60">QR Code</span>
        </div>
      </div>

      {/* Find Friends */}
      <div
        className={clsx(
          'p-5 rounded-xl border',
          isFrutigerAero
            ? 'frutiger-aero-glass'
            : isLight
            ? 'bg-white border-[#E2E5EA]'
            : 'bg-[#181B20] border-[#262B33]'
        )}
      >
        <h2 className="text-lg font-bold mb-3">Find Friends</h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name..."
              className={clsx(
                'w-full pl-9 pr-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2',
                isLight
                  ? 'bg-[#F5F6F8] border-[#E2E5EA] focus:ring-[#059669]/40'
                  : 'bg-[#111315] border-[#262B33] focus:ring-[#10B981]/40'
              )}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap',
              isFrutigerAero
                ? 'frutiger-aero-button'
                : 'bg-[#10B981] hover:bg-[#059669] text-[#09120E]'
            )}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {searchResults.map((result) => (
              <div
                key={result.uid}
                className={clsx(
                  'flex items-center justify-between p-3 rounded-lg border',
                  isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
                )}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={result.avatarUrl || getDefaultAvatar(result.uid)}
                    alt="Avatar"
                    className="w-9 h-9 rounded-lg object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <p className="font-medium text-sm">{result.name}</p>
                    <p className="text-xs opacity-65">{result.region}</p>
                  </div>
                </div>
                {userData?.friends?.includes(result.uid) ? (
                  <span className="text-[#10B981] text-xs font-semibold flex items-center gap-1">
                    <UserCheck className="w-4 h-4" /> Friends
                  </span>
                ) : (
                  <button
                    onClick={() => sendRequest(result.uid)}
                    className="p-2 text-[#10B981] hover:bg-[#10B981]/10 rounded-lg"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Requests */}
      {requests.length > 0 && (
        <div
          className={clsx(
            'p-5 rounded-xl border',
            isFrutigerAero
              ? 'frutiger-aero-glass'
              : isLight
              ? 'bg-white border-[#E2E5EA]'
              : 'bg-[#181B20] border-[#262B33]'
          )}
        >
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#D97706]" />
            Friend Requests
          </h2>
          <div className="space-y-2">
            {requests.map((req) => (
              <div
                key={req.id}
                className={clsx(
                  'flex items-center justify-between p-3 rounded-lg border',
                  isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
                )}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={req.senderAvatar || getDefaultAvatar(req.senderId)}
                    alt="Avatar"
                    className="w-9 h-9 rounded-lg object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <p className="font-medium text-sm">{req.senderName || 'Unknown User'}</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleRequest(req.id, req.senderId, true)}
                    className="p-2 text-[#10B981] hover:bg-[#10B981]/10 rounded-lg"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRequest(req.id, req.senderId, false)}
                    className="p-2 text-[#DC2626] hover:bg-[#DC2626]/10 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div
        className={clsx(
          'p-5 rounded-xl border',
          isFrutigerAero
            ? 'frutiger-aero-glass'
            : isLight
            ? 'bg-white border-[#E2E5EA]'
            : 'bg-[#181B20] border-[#262B33]'
        )}
      >
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-[#10B981]" />
          My Friends ({friends.length})
        </h2>
        {friends.length === 0 ? (
          <p className="text-center text-sm opacity-60 py-6">You haven't added any friends yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {friends.map((friend) => (
              <div
                key={friend.uid}
                className={clsx(
                  'flex items-center justify-between p-3.5 rounded-lg border',
                  isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={friend.avatarUrl || getDefaultAvatar(friend.uid)}
                    alt="Avatar"
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{friend.name}</p>
                    <p className="text-xs opacity-65">{friend.region}</p>
                    {friend.activeCollabSession && (
                      <span className="text-[11px] text-[#10B981] font-mono block truncate mt-0.5">
                        Session: {friend.activeCollabAppTitle}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {friend.activeCollabSession && (
                    <button
                      onClick={() => sendCollabJoinRequest(friend)}
                      disabled={waitingForCollab === friend.activeCollabSession}
                      className="px-3 py-1.5 bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-[#09120E] text-xs font-semibold rounded-lg transition-colors"
                    >
                      {waitingForCollab === friend.activeCollabSession ? 'Requested' : 'Join'}
                    </button>
                  )}
                  <button
                    onClick={() => removeFriend(friend.uid)}
                    className="p-2 text-[#DC2626] hover:bg-[#DC2626]/10 rounded-lg transition-colors"
                    title="Remove Friend"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {waitingForCollab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
          <div
            className={clsx(
              'p-6 rounded-xl border max-w-sm w-full text-center shadow-2xl',
              isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#181B20] border-[#262B33]'
            )}
          >
            <h3 className="text-lg font-bold mb-1">Waiting for Answer</h3>
            <p className="text-sm opacity-70 mb-5">The host is reviewing your request to join.</p>
            <div className="w-7 h-7 rounded-full border-2 border-[#10B981] border-t-transparent animate-spin mx-auto mb-4" />
            <button
              onClick={() => setWaitingForCollab(null)}
              className="text-sm opacity-70 hover:opacity-100 transition-opacity"
            >
              Cancel waiting
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
