import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, UserPlus, UserCheck, UserX, Clock, Check, X, Copy, QrCode } from 'lucide-react';
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

  const user = useStore(state => state.user);
  const userData = useStore(state => state.userData);
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const friendLink = `${window.location.origin}/profile/${user?.uid}`;

  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchRequests();
    }
  }, [user, userData?.friends]);

  useEffect(() => {
    if (canvasRef.current && user) {
      QRCode.toCanvas(canvasRef.current, friendLink, { width: 128, margin: 1 });
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
        allFriends = [...allFriends, ...snapshot.docs.map(doc => doc.data() as PublicUser)];
      }
      setFriends(allFriends);
    } catch (error) {
      console.error("Error fetching friends:", error);
    }
  };

  const fetchRequests = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'friendRequests'), where('receiverId', '==', user.uid), where('status', '==', 'pending'));
      const snapshot = await getDocs(q);
      const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest));
      
      // Fetch sender details
      const reqsWithDetails = await Promise.all(reqs.map(async (req) => {
        const senderDoc = await getDocs(query(collection(db, 'users_public'), where('uid', '==', req.senderId)));
        if (!senderDoc.empty) {
          const senderData = senderDoc.docs[0].data();
          return { ...req, senderName: senderData.name, senderAvatar: senderData.avatarUrl };
        }
        return req;
      }));
      
      setRequests(reqsWithDetails);
    } catch (error) {
      console.error("Error fetching requests:", error);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !user) return;

    setLoading(true);
    try {
      // Simple search by exact name for now, or we could fetch all and filter client-side if small
      // Firestore doesn't support native partial text search easily without external services
      // Let's fetch all users_public and filter client side for this demo
      const snapshot = await getDocs(collection(db, 'users_public'));
      const allUsers = snapshot.docs.map(doc => doc.data() as PublicUser);
      
      const results = allUsers.filter(u => 
        u.uid !== user.uid && 
        u.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async (receiverId: string) => {
    if (!user) return;
    try {
      const requestId = `${user.uid}_${receiverId}`;
      await setDoc(doc(db, 'friendRequests', requestId), {
        senderId: user.uid,
        receiverId,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      alert('Friend request sent!');
    } catch (error) {
      console.error("Error sending request:", error);
      alert('Failed to send request.');
    }
  };

  const handleRequest = async (requestId: string, senderId: string, accept: boolean) => {
    if (!user) return;
    try {
      const reqRef = doc(db, 'friendRequests', requestId);
      if (accept) {
        await updateDoc(reqRef, { status: 'accepted' });
        // Add to each other's friends list
        await updateDoc(doc(db, 'users', user.uid), {
          friends: arrayUnion(senderId)
        });
        await updateDoc(doc(db, 'users', senderId), {
          friends: arrayUnion(user.uid)
        });
        alert('Friend added!');
      } else {
        await updateDoc(reqRef, { status: 'declined' });
      }
      fetchRequests();
    } catch (error) {
      console.error("Error handling request:", error);
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!user || !confirm('Are you sure you want to remove this friend?')) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        friends: arrayRemove(friendId)
      });
      await updateDoc(doc(db, 'users', friendId), {
        friends: arrayRemove(user.uid)
      });
      fetchFriends();
    } catch (error) {
      console.error("Error removing friend:", error);
    }
  };

  const [waitingForCollab, setWaitingForCollab] = useState<string | null>(null);

  const sendCollabJoinRequest = async (friend: PublicUser) => {
    if (!user || !friend.activeCollabSession) return;
    try {
      await updateDoc(doc(db, 'collabSessions', friend.activeCollabSession), {
         joinRequests: arrayUnion({
           uid: user.uid,
           name: userData?.name || 'Friend'
         })
      });
      setWaitingForCollab(friend.activeCollabSession);
    } catch (err) {
      console.error("Error sending join request", err);
      alert('Failed to send request.');
    }
  };

  useEffect(() => {
    if (!waitingForCollab || !user) return;
    const unsub = onSnapshot(doc(db, 'collabSessions', waitingForCollab), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.participants?.some((p: any) => p.uid === user.uid)) {
           alert("You have been accepted! Go to the Editor and open 'Together Create', then enter code: " + waitingForCollab);
           setWaitingForCollab(null);
        }
      }
    });
    return () => unsub();
  }, [waitingForCollab, user]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* My Profile Section */}
      <div className={clsx(
        "p-6 rounded-xl border flex flex-col md:flex-row items-center gap-6",
        isFrutigerAero ? "bg-white/40 border-white/50 shadow-sm" :
        theme === 'dark' ? "bg-zinc-900/50 border-zinc-800" :
        theme === 'gradient' ? "bg-zinc-900/30 border-emerald-800/30" :
        "bg-white border-zinc-200"
      )}>
        <div className="flex-1 space-y-2">
          <h2 className="text-xl font-bold">My Profile</h2>
          <p className="text-sm opacity-70">Share this ID or QR code to add friends.</p>
          <div className="flex items-center gap-2 bg-zinc-500/10 p-2 rounded-lg">
            <span className="font-mono text-sm">{user?.uid}</span>
            <button onClick={() => navigator.clipboard.writeText(user?.uid || '')} className="p-1 hover:bg-zinc-500/20 rounded">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <canvas ref={canvasRef} />
          <span className="text-xs opacity-50">QR Code</span>
        </div>
      </div>

      {/* Search Section */}
      <div className={clsx(
        "p-6 rounded-xl border",
        isFrutigerAero ? "bg-white/40 border-white/50 shadow-sm" :
        theme === 'dark' ? "bg-zinc-900/50 border-zinc-800" :
        theme === 'gradient' ? "bg-zinc-900/30 border-emerald-800/30" :
        "bg-white border-zinc-200"
      )}>
        <h2 className="text-xl font-bold mb-4">Find Friends</h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name..."
              className={clsx(
                "w-full pl-10 pr-4 py-2 rounded-lg outline-none transition-all",
                isFrutigerAero ? "bg-white/60 border border-white/40 focus:bg-white focus:shadow-inner" :
                theme === 'dark' ? "bg-zinc-800 border-zinc-700 focus:border-emerald-500" :
                theme === 'gradient' ? "bg-zinc-800/50 border-emerald-800/50 focus:border-emerald-500" :
                "bg-zinc-100 border-transparent focus:bg-white focus:border-emerald-500 border"
              )}
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            className={clsx(
              "px-4 py-2 rounded-lg font-medium transition-colors",
              isFrutigerAero ? "frutiger-aero-button" : "bg-emerald-500 hover:bg-emerald-600 text-white"
            )}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {searchResults.map(result => (
              <div key={result.uid} className="flex items-center justify-between p-3 rounded-lg bg-zinc-500/5">
                <div className="flex items-center gap-3">
                  <img src={result.avatarUrl || getDefaultAvatar(result.uid)} alt="Avatar" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                  <div>
                    <p className="font-medium">{result.name}</p>
                    <p className="text-xs opacity-70">{result.region}</p>
                  </div>
                </div>
                {userData?.friends?.includes(result.uid) ? (
                  <span className="text-emerald-500 text-sm font-medium flex items-center gap-1"><UserCheck className="w-4 h-4" /> Friends</span>
                ) : (
                  <button onClick={() => sendRequest(result.uid)} className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg">
                    <UserPlus className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Requests */}
      {requests.length > 0 && (
        <div className={clsx(
          "p-6 rounded-xl border",
          isFrutigerAero ? "bg-white/40 border-white/50 shadow-sm" :
          theme === 'dark' ? "bg-zinc-900/50 border-zinc-800" :
          theme === 'gradient' ? "bg-zinc-900/30 border-emerald-800/30" :
          "bg-white border-zinc-200"
        )}>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Friend Requests
          </h2>
          <div className="space-y-2">
            {requests.map(req => (
              <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-500/5">
                <div className="flex items-center gap-3">
                  <img src={req.senderAvatar || getDefaultAvatar(req.senderId)} alt="Avatar" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                  <p className="font-medium">{req.senderName || 'Unknown User'}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleRequest(req.id, req.senderId, true)} className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg">
                    <Check className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleRequest(req.id, req.senderId, false)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div className={clsx(
        "p-6 rounded-xl border",
        isFrutigerAero ? "bg-white/40 border-white/50 shadow-sm" :
        theme === 'dark' ? "bg-zinc-900/50 border-zinc-800" :
        theme === 'gradient' ? "bg-zinc-900/30 border-emerald-800/30" :
        "bg-white border-zinc-200"
      )}>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-emerald-500" />
          My Friends ({friends.length})
        </h2>
        {friends.length === 0 ? (
          <p className="text-center opacity-50 py-8">You haven't added any friends yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {friends.map(friend => (
              <div key={friend.uid} className="flex items-center justify-between p-4 rounded-lg bg-zinc-500/5 hover:bg-zinc-500/10 transition-colors">
                <div className="flex items-center gap-3">
                  <img src={friend.avatarUrl || getDefaultAvatar(friend.uid)} alt="Avatar" className="w-12 h-12 rounded-full" referrerPolicy="no-referrer" />
                  <div>
                    <p className="font-medium">{friend.name}</p>
                    <p className="text-xs opacity-70 mb-1">{friend.region}</p>
                    {friend.activeCollabSession && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                        Creating: {friend.activeCollabAppTitle}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {friend.activeCollabSession && (
                    <button onClick={() => sendCollabJoinRequest(friend)} disabled={waitingForCollab === friend.activeCollabSession} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors">
                      {waitingForCollab === friend.activeCollabSession ? 'Requested' : 'Join'}
                    </button>
                  )}
                  <button onClick={() => removeFriend(friend.uid)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors" title="Remove Friend">
                    <UserX className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {waitingForCollab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-sm w-full text-center shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-2">Waiting for Answer</h3>
              <p className="text-sm text-zinc-400 mb-6">The host is reviewing your request to join.</p>
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mx-auto mb-4"></div>
              <button onClick={() => setWaitingForCollab(null)} className="text-sm text-zinc-500 hover:text-white transition-colors">Cancel waiting</button>
           </div>
        </div>
      )}
    </div>
  );
}
