import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { clsx } from 'clsx';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { getDefaultAvatar } from '../lib/avatar';
import { AppData } from '../types';
import { ExternalLink, Star, Download, ChevronDown, ChevronUp, User as UserIcon } from 'lucide-react';

export default function PublicProfileView() {
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const viewingProfileId = useStore(state => state.viewingProfileId);
  const setCurrentView = useStore(state => state.setCurrentView);
  const setSelectedAppId = useStore(state => state.setSelectedAppId);

  const [profileData, setProfileData] = useState<any>(null);
  const [profileApps, setProfileApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [bioExpanded, setBioExpanded] = useState(false);

  useEffect(() => {
    if (!viewingProfileId) return;

    const fetchProfile = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'users_public', viewingProfileId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfileData(docSnap.data());
        } else {
          // fallback to users collection if public is not available
          const fallbackSnap = await getDoc(doc(db, 'users', viewingProfileId));
          if (fallbackSnap.exists()) {
            setProfileData(fallbackSnap.data());
          }
        }

        const q = query(
          collection(db, 'apps'), 
          where('authorId', '==', viewingProfileId),
          where('isPrivate', '==', false)
        );
        const appsSnap = await getDocs(q);
        const appsData = appsSnap.docs.map(d => ({ id: d.id, ...d.data() } as AppData));
        setProfileApps(appsData.sort((a, b) => b.downloads - a.downloads));
      } catch (err) {
        console.error("Error fetching public profile", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [viewingProfileId]);

  if (!viewingProfileId) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-zinc-500">No profile selected.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="h-full flex items-center justify-center flex-col gap-4">
        <UserIcon className="w-16 h-16 text-zinc-500" />
        <h2 className="text-2xl font-bold">User Not Found</h2>
        <button onClick={() => setCurrentView('store')} className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium">Return to Store</button>
      </div>
    );
  }

  const bio: string = profileData.bio || '';
  const isBioLong = bio.length > 80;

  return (
    <div className="h-full flex flex-col p-4 sm:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full">
        {/* Profile Card */}
        <div className={clsx(
          "p-6 sm:p-10 rounded-3xl border mb-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left",
          isFrutigerAero ? "bg-white/40 border-white/50 backdrop-blur-md shadow-lg" :
          theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'
        )}>
          <img 
            src={profileData.avatarUrl || getDefaultAvatar(viewingProfileId)} 
            alt="Avatar" 
            className="w-32 h-32 rounded-full object-cover shadow-xl border-4 border-zinc-800"
          />
          <div className="flex-1 mt-2">
            <h1 className={clsx("text-3xl font-bold mb-2 tracking-tight flex items-center justify-center sm:justify-start gap-2", isFrutigerAero ? "text-blue-900" : "")}>
              {profileData.name || 'Unknown User'}
            </h1>
            <p className={clsx("text-sm mb-4 font-medium", isFrutigerAero ? "text-blue-800/70" : "text-zinc-500")}>
              From {profileData.region || 'Unknown Region'} • User
            </p>
            
            {bio && (
              <div className={clsx("mt-4 text-left p-4 rounded-xl border relative", 
                isFrutigerAero ? "bg-white/50 border-white/30 text-blue-900" :
                theme !== 'light' ? "bg-zinc-950 border-zinc-800/50 text-zinc-300" : "bg-zinc-50 border-zinc-200 text-zinc-700"
              )}>
                <p className={clsx("whitespace-pre-wrap leading-relaxed", !bioExpanded && isBioLong ? "line-clamp-3" : "")}>
                  {bio}
                </p>
                {isBioLong && (
                  <div className="mt-2 flex justify-end">
                    <button 
                      onClick={() => setBioExpanded(!bioExpanded)}
                      className="text-emerald-500 hover:text-emerald-400 font-bold text-sm flex items-center gap-1 transition-colors"
                    >
                      {bioExpanded ? (
                        <>Hide <ChevronUp className="w-4 h-4" /></>
                      ) : (
                        <>more... <ChevronDown className="w-4 h-4" /></>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Apps Section */}
        <h2 className={clsx("text-2xl font-bold mb-6 tracking-tight", isFrutigerAero ? "text-blue-900" : "")}>Published Apps</h2>
        {profileApps.length === 0 ? (
          <div className={clsx("p-8 text-center rounded-3xl border", isFrutigerAero ? "bg-white/30 border-white/40" : theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800 text-zinc-500' : 'bg-white border-zinc-200 text-zinc-500')}>
            This user hasn't published any public apps yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {profileApps.map(app => (
              <div 
                key={app.id}
                onClick={() => {
                  setSelectedAppId(app.id);
                }}
                className={clsx(
                  "group relative overflow-hidden rounded-3xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer",
                  isFrutigerAero ? "bg-white/40 border-white/50 hover:bg-white/60 hover:shadow-blue-500/20 backdrop-blur-md" :
                  theme !== 'light' 
                    ? 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 hover:shadow-emerald-500/10' 
                    : 'bg-white border-zinc-200 hover:shadow-emerald-500/10'
                )}
              >
                <div className="aspect-[16/10] bg-zinc-800 overflow-hidden relative">
                  {app.bannerUrl || app.screenshotUrl ? (
                    <img src={app.bannerUrl || app.screenshotUrl} alt={app.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center">
                      <ExternalLink className="w-12 h-12 text-emerald-500/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  
                  <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                    <div className="flex items-center gap-3">
                       {app.iconUrl && <img src={app.iconUrl} className="w-10 h-10 rounded-xl" />}
                       <div>
                         <h3 className="font-bold text-white leading-tight line-clamp-1">{app.title}</h3>
                         <p className="text-xs text-zinc-300 capitalize">{app.category}</p>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-emerald-500 font-medium">
                      <Download className="w-4 h-4" />
                      {app.downloads || 0}
                    </div>
                    <div className="flex items-center gap-1.5 text-amber-500 font-medium">
                      <Star className="w-4 h-4" />
                      {(app.rating || 0).toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
