import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import {
  Search,
  UserPlus,
  UserCheck,
  UserX,
  Clock,
  Check,
  X,
  Copy,
  QrCode,
  Camera,
  Upload,
  KeyRound,
} from 'lucide-react';
import { clsx } from 'clsx';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
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
  friendCode?: string;
  activeCollabSession?: string | null;
  activeCollabAppTitle?: string | null;
}

export function getFriendCode(uid?: string | null): string {
  if (!uid) return 'EPL-0000-0000';
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < uid.length; i++) {
    const ch = uid.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + i), 0x85ebca6b) >>> 0;
  }
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const encode4 = (num: number) => {
    let out = '';
    let n = num >>> 0;
    for (let i = 0; i < 4; i++) {
      out += alphabet[n % alphabet.length];
      n = Math.floor(n / alphabet.length);
    }
    return out;
  };
  return `EPL-${encode4(h1)}-${encode4(h2)}`;
}

export default function FriendsView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [addingByCode, setAddingByCode] = useState(false);
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannerActive, setScannerActive] = useState(false);

  const user = useStore((state) => state.user);
  const userData = useStore((state) => state.userData);
  const theme = useStore((state) => state.theme);
  const isFrutigerAero = useStore((state) => state.isFrutigerAero);
  const language = useStore((state) => state.language);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrImageInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const myFriendCode = user ? (userData as any)?.friendCode || getFriendCode(user.uid) : '';
  const friendQrPayload = user ? `epl-friend:${user.uid}` : '';
  const isLight = theme === 'light' && !isFrutigerAero;

  // Persist deterministic friendCode onto users & users_public if missing
  useEffect(() => {
    if (!user?.uid) return;
    const expectedCode = getFriendCode(user.uid);
    if ((userData as any)?.friendCode !== expectedCode) {
      updateDoc(doc(db, 'users', user.uid), { friendCode: expectedCode }).catch(() => {});
    }
    setDoc(
      doc(db, 'users_public', user.uid),
      { uid: user.uid, friendCode: expectedCode },
      { merge: true }
    ).catch(() => {});
  }, [user?.uid, (userData as any)?.friendCode]);

  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchRequests();
    }
  }, [user, userData?.friends]);

  useEffect(() => {
    if (canvasRef.current && user && friendQrPayload) {
      QRCode.toCanvas(canvasRef.current, friendQrPayload, { width: 116, margin: 1 });
    }
  }, [user, friendQrPayload]);

  const stopScanner = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScannerActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

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
      const qLower = searchQuery.trim().toLowerCase();

      const results = allUsers.filter(
        (u) =>
          u.uid !== user.uid &&
          ((u.name || '').toLowerCase().includes(qLower) ||
            (u.friendCode || getFriendCode(u.uid)).toLowerCase() === qLower ||
            u.uid.toLowerCase() === qLower)
      );

      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async (receiverId: string, targetName?: string) => {
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
      notify.success(
        language === 'ru'
          ? `Запрос в друзья отправлен${targetName ? ` (${targetName})` : ''}`
          : `Friend request sent${targetName ? ` to ${targetName}` : ''}!`
      );
    } catch (error) {
      console.error('Error sending request:', error);
      notify.error(language === 'ru' ? 'Не удалось отправить запрос' : 'Failed to send request.');
    }
  };

  const resolveFriendTarget = async (rawValue: string) => {
    if (!user) {
      notify.info(language === 'ru' ? 'Войдите в аккаунт' : 'Please sign in first');
      return false;
    }
    let clean = rawValue.trim();
    if (!clean) return false;

    if (clean.toLowerCase().startsWith('epl-friend:')) {
      clean = clean.slice('epl-friend:'.length).trim();
    } else if (clean.includes('/profile/')) {
      clean = clean.split('/profile/').pop()?.split(/[?#]/)[0]?.trim() || clean;
    }

    setAddingByCode(true);
    try {
      const snapshot = await getDocs(collection(db, 'users_public'));
      const allUsers = snapshot.docs.map((docSnap) => ({
        uid: docSnap.id,
        ...(docSnap.data() as any),
      })) as PublicUser[];

      const normalized = clean.toUpperCase();
      const target = allUsers.find(
        (u) =>
          u.uid === clean ||
          (u.friendCode || '').toUpperCase() === normalized ||
          getFriendCode(u.uid).toUpperCase() === normalized
      );

      if (!target) {
        notify.error(
          language === 'ru'
            ? 'Пользователь с таким кодом или QR не найден'
            : 'No user found matching that invite code or QR'
        );
        return false;
      }

      if (target.uid === user.uid) {
        notify.info(language === 'ru' ? 'Нельзя добавить самого себя' : 'You cannot add yourself');
        return false;
      }

      if (userData?.friends?.includes(target.uid)) {
        notify.info(
          language === 'ru'
            ? `${target.name || 'Пользователь'} уже в ваших друзьях`
            : `${target.name || 'User'} is already your friend`
        );
        return true;
      }

      await sendRequest(target.uid, target.name);
      setInviteCodeInput('');
      return true;
    } catch (err) {
      console.error('Error resolving friend code:', err);
      notify.error(language === 'ru' ? 'Ошибка поиска кода' : 'Failed to look up code');
      return false;
    } finally {
      setAddingByCode(false);
    }
  };

  const startCameraScanner = async () => {
    setScannerError(null);
    stopScanner();
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerError(
        language === 'ru'
          ? 'Камера недоступна в этом браузере. Загрузите изображение QR-кода ниже.'
          : 'Camera not supported in this browser. Upload a QR image below.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setScannerActive(true);

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();

        const tick = () => {
          if (!videoRef.current || !scanCanvasRef.current || !streamRef.current) return;
          const v = videoRef.current;
          const c = scanCanvasRef.current;
          if (v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth > 0 && v.videoHeight > 0) {
            c.width = v.videoWidth;
            c.height = v.videoHeight;
            const ctx = c.getContext('2d');
            if (ctx) {
              ctx.drawImage(v, 0, 0, c.width, c.height);
              const imgData = ctx.getImageData(0, 0, c.width, c.height);
              const code = jsQR(imgData.data, imgData.width, imgData.height);
              if (code?.data) {
                stopScanner();
                setShowScannerModal(false);
                resolveFriendTarget(code.data);
                return;
              }
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setScannerError(
        language === 'ru'
          ? 'Нет доступа к камере. Вы можете загрузить фото/скриншот QR-кода ниже.'
          : 'Camera permission denied or unavailable. You can upload a QR image below.'
      );
      stopScanner();
    }
  };

  const handleOpenScannerModal = () => {
    setShowScannerModal(true);
    setTimeout(() => {
      startCameraScanner();
    }, 60);
  };

  const handleCloseScannerModal = () => {
    stopScanner();
    setShowScannerModal(false);
    setScannerError(null);
  };

  const handleQrImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height);
        if (decoded?.data) {
          handleCloseScannerModal();
          resolveFriendTarget(decoded.data);
        } else {
          setScannerError(
            language === 'ru'
              ? 'QR-код на изображении не распознан. Попробуйте более четкое фото.'
              : 'Could not detect a QR code in that image.'
          );
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
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
      {/* My Invite Code + ID + QR */}
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
        <div className="flex-1 space-y-3 w-full">
          <div>
            <h2 className="text-lg font-bold">
              {language === 'ru' ? 'Мой код приглашения и QR' : 'My Invite Code & QR'}
            </h2>
            <p className="text-sm opacity-70">
              {language === 'ru'
                ? 'Поделитесь кодом приглашения или QR-кодом, чтобы добавить друзей.'
                : 'Share your invite code or QR code to add friends.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div
              className={clsx(
                'flex items-center justify-between gap-2 px-3 py-2 rounded-lg border',
                isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
              )}
            >
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider opacity-60 font-semibold">
                  {language === 'ru' ? 'Код приглашения' : 'Invite Code'}
                </div>
                <div className="font-mono text-sm font-bold text-[#10B981] truncate">
                  {user ? myFriendCode : 'Not signed in'}
                </div>
              </div>
              {user && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(myFriendCode);
                    notify.success(language === 'ru' ? 'Код скопирован' : 'Copied invite code');
                  }}
                  className="p-1.5 opacity-75 hover:opacity-100 cursor-pointer"
                  title={language === 'ru' ? 'Скопировать код' : 'Copy invite code'}
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}
            </div>

            <div
              className={clsx(
                'flex items-center justify-between gap-2 px-3 py-2 rounded-lg border',
                isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
              )}
            >
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider opacity-60 font-semibold">Friend UID</div>
                <div className="font-mono text-xs truncate opacity-85">{user?.uid || 'Not signed in'}</div>
              </div>
              {user?.uid && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(user.uid);
                    notify.success(language === 'ru' ? 'UID скопирован' : 'Copied UID');
                  }}
                  className="p-1.5 opacity-75 hover:opacity-100 cursor-pointer"
                  title="Copy UID"
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <canvas ref={canvasRef} className="rounded-lg bg-white p-1.5 shadow-sm" />
          <span className="text-[11px] font-mono opacity-60">QR Code</span>
        </div>
      </div>

      {/* Add Friends by Code or QR */}
      <div
        className={clsx(
          'p-5 rounded-xl border space-y-3',
          isFrutigerAero
            ? 'frutiger-aero-glass'
            : isLight
            ? 'bg-white border-[#E2E5EA]'
            : 'bg-[#181B20] border-[#262B33]'
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#10B981]" />
              <span>{language === 'ru' ? 'Добавить друга по коду или QR' : 'Add Friends by Code'}</span>
            </h2>
            <p className="text-xs opacity-65 mt-0.5">
              {language === 'ru'
                ? 'Введите код приглашения (например EPL-XXXX-XXXX) или отсканируйте QR-код друга.'
                : 'Enter an invite code (e.g. EPL-XXXX-XXXX) or scan a friend QR code.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenScannerModal}
            className={clsx(
              'px-3.5 py-2 rounded-lg border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors',
              isFrutigerAero
                ? 'frutiger-aero-button'
                : isLight
                ? 'bg-[#F5F6F8] hover:bg-emerald-50 border-[#E2E5EA] text-[#059669]'
                : 'bg-[#111315] hover:bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981]'
            )}
          >
            <QrCode className="w-4 h-4" />
            <span>{language === 'ru' ? 'Сканировать QR-код' : 'Scan QR Code'}</span>
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            resolveFriendTarget(inviteCodeInput);
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            type="text"
            value={inviteCodeInput}
            onChange={(e) => setInviteCodeInput(e.target.value)}
            placeholder={language === 'ru' ? 'Код приглашения (EPL-XXXX-XXXX) или UID...' : 'Enter invite code (EPL-XXXX-XXXX) or UID...'}
            className={clsx(
              'flex-1 px-3 py-2 rounded-lg border font-mono text-sm focus:outline-none focus:ring-2',
              isLight
                ? 'bg-[#F5F6F8] border-[#E2E5EA] focus:ring-[#059669]/40'
                : 'bg-[#111315] border-[#262B33] focus:ring-[#10B981]/40'
            )}
          />
          <button
            type="submit"
            disabled={addingByCode || !inviteCodeInput.trim()}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer',
              isFrutigerAero
                ? 'frutiger-aero-button'
                : 'bg-[#10B981] hover:bg-[#059669] text-[#09120E]'
            )}
          >
            <UserPlus className="w-4 h-4" />
            <span>
              {addingByCode
                ? language === 'ru' ? 'Поиск...' : 'Adding...'
                : language === 'ru' ? 'Добавить по коду' : 'Add by Code'}
            </span>
          </button>
        </form>
      </div>

      {/* Find Friends by Name */}
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
        <h2 className="text-lg font-bold mb-3">
          {language === 'ru' ? 'Поиск друзей по имени' : 'Find Friends'}
        </h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'ru' ? 'Поиск по имени или коду...' : 'Search by name or code...'}
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
            {loading ? (language === 'ru' ? 'Поиск...' : 'Searching...') : (language === 'ru' ? 'Найти' : 'Search')}
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
                    <p className="text-xs opacity-65 font-mono">
                      {result.friendCode || getFriendCode(result.uid)} · {result.region}
                    </p>
                  </div>
                </div>
                {userData?.friends?.includes(result.uid) ? (
                  <span className="text-[#10B981] text-xs font-semibold flex items-center gap-1">
                    <UserCheck className="w-4 h-4" /> Friends
                  </span>
                ) : (
                  <button
                    onClick={() => sendRequest(result.uid, result.name)}
                    className="p-2 text-[#10B981] hover:bg-[#10B981]/10 rounded-lg cursor-pointer"
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
            {language === 'ru' ? 'Запросы в друзья' : 'Friend Requests'}
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
          {language === 'ru' ? `Мои друзья (${friends.length})` : `My Friends (${friends.length})`}
        </h2>
        {friends.length === 0 ? (
          <p className="text-center text-sm opacity-60 py-6">
            {language === 'ru' ? 'Вы еще не добавили друзей.' : "You haven't added any friends yet."}
          </p>
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
                    <p className="text-xs opacity-65 font-mono truncate">
                      {friend.friendCode || getFriendCode(friend.uid)} · {friend.region}
                    </p>
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

      {/* QR Code Scanner Modal */}
      {showScannerModal && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div
            className={clsx(
              'p-5 rounded-2xl border max-w-md w-full space-y-4 shadow-2xl',
              isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#181B20] border-[#262B33]'
            )}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#10B981]" />
                <span>{language === 'ru' ? 'Сканер QR-кода друга' : 'Scan Friend QR Code'}</span>
              </h3>
              <button
                type="button"
                onClick={handleCloseScannerModal}
                className="p-1.5 rounded-lg hover:bg-current/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black border border-[#262B33] flex items-center justify-center">
              <video
                ref={videoRef}
                muted
                playsInline
                className={clsx('w-full h-full object-cover', !scannerActive && 'hidden')}
              />
              <canvas ref={scanCanvasRef} className="hidden" />
              {scannerActive && (
                <div className="pointer-events-none absolute inset-8 border-2 border-[#10B981]/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              )}
              {!scannerActive && (
                <div className="p-6 text-center space-y-2 text-xs text-[#9CA3AF]">
                  <QrCode className="w-10 h-10 mx-auto text-[#10B981] opacity-70" />
                  <p>{scannerError || (language === 'ru' ? 'Запуск камеры...' : 'Starting camera...')}</p>
                </div>
              )}
            </div>

            {scannerError && scannerActive && (
              <div className="text-xs text-rose-400 text-center">{scannerError}</div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={startCameraScanner}
                className={clsx(
                  'px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer',
                  isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
                )}
              >
                <Camera className="w-3.5 h-3.5 text-[#10B981]" />
                <span>{language === 'ru' ? 'Включить камеру' : 'Retry Camera'}</span>
              </button>

              <button
                type="button"
                onClick={() => qrImageInputRef.current?.click()}
                className="px-3.5 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#09120E] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{language === 'ru' ? 'Загрузить фото QR' : 'Upload QR Image'}</span>
              </button>
              <input
                ref={qrImageInputRef}
                type="file"
                accept="image/*"
                onChange={handleQrImageUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>
      )}

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

