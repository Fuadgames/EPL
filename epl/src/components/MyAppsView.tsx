import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useStore } from '../store/useStore';
import { Package, Edit2, Trash2, Plus, Terminal, Lock, Key } from 'lucide-react';
import { clsx } from 'clsx';

interface AppData {
  id: string;
  title: string;
  description: string;
  version: string;
  downloads: number;
  isAiGenerated?: boolean;
  isPrivate?: boolean;
  isLocked?: boolean;
}

export default function MyAppsView() {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const setCurrentView = useStore(state => state.setCurrentView);
  const setEditingAppId = useStore(state => state.setEditingAppId);
  const user = useStore(state => state.user);

  const [appToDelete, setAppToDelete] = useState<string | null>(null);

  const fetchApps = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const q = query(collection(db, 'apps'), where('authorId', '==', user.uid));
      const snapshot = await getDocs(q);
      const appsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppData));
      // Sort in memory to avoid needing a composite index
      appsData.sort((a, b) => {
        const dateA = (a as any).updatedAt ? new Date((a as any).updatedAt).getTime() : 0;
        const dateB = (b as any).updatedAt ? new Date((b as any).updatedAt).getTime() : 0;
        return dateB - dateA;
      });
      setApps(appsData);
    } catch (error) {
      console.error("Error fetching user apps", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, [user]);

  const handleDelete = async () => {
    if (appToDelete) {
      try {
        await deleteDoc(doc(db, 'apps', appToDelete));
        setApps(apps.filter(app => app.id !== appToDelete));
      } catch (error) {
        console.error("Error deleting app", error);
      } finally {
        setAppToDelete(null);
      }
    }
  };

  if (!user) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <Package className={clsx("w-16 h-16 mb-4", isFrutigerAero ? "text-blue-500/50" : "text-zinc-500 opacity-50")} />
        <h2 className={clsx("text-2xl font-bold mb-2", isFrutigerAero ? "text-blue-900" : "")}>Sign in to view your apps</h2>
        <p className={clsx("max-w-md", isFrutigerAero ? "text-blue-800/70" : "text-zinc-500")}>You need an account to create and publish apps to the EPL Store.</p>
      </div>
    );
  }

  return (
    <div className={clsx("h-full flex flex-col p-4 sm:p-8 overflow-y-auto", isFrutigerAero ? "frutiger-aero-bg" : "")}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className={clsx("text-3xl font-bold tracking-tight", isFrutigerAero ? "text-blue-900" : "")}>My Apps</h1>
          <p className={clsx("mt-2", isFrutigerAero ? "text-blue-800/70" : theme !== 'light' ? 'text-zinc-400' : 'text-zinc-500')}>Manage your published EPL applications.</p>
        </div>
        <button
          onClick={() => {
            setEditingAppId(null);
            setCurrentView('editor');
          }}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors shadow-lg",
            isFrutigerAero ? "frutiger-aero-button" : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20"
          )}
        >
          <Plus className="w-4 h-4" /> New App
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className={clsx("animate-spin rounded-full h-8 w-8 border-b-2", isFrutigerAero ? "border-blue-500" : "border-emerald-500")}></div>
        </div>
      ) : apps.length === 0 ? (
        <div className={clsx(
          "flex-1 flex flex-col items-center justify-center text-center border-2 border-dashed rounded-3xl p-12",
          isFrutigerAero ? "border-white/40 bg-white/20 backdrop-blur-sm" : "border-zinc-800"
        )}>
          <Package className={clsx("w-16 h-16 mb-4", isFrutigerAero ? "text-blue-600/50" : "text-zinc-600")} />
          <h3 className={clsx("text-xl font-semibold mb-2", isFrutigerAero ? "text-blue-900" : "")}>No apps yet</h3>
          <p className={clsx("mb-6 max-w-sm", isFrutigerAero ? "text-blue-800/70" : "text-zinc-500")}>You haven't published any apps yet. Head over to the Code Editor to create your first EPL program.</p>
          <button
            onClick={() => {
              setEditingAppId(null);
              setCurrentView('editor');
            }}
            className={clsx(
              "px-6 py-2.5 rounded-xl font-medium transition-colors",
              isFrutigerAero ? "frutiger-aero-button" : "bg-zinc-800 hover:bg-zinc-700 text-white"
            )}
          >
            Open Editor
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps.map(app => (
            <div key={app.id} className={clsx(
              "p-6 rounded-2xl border transition-all relative overflow-hidden",
              isFrutigerAero ? "bg-white/40 border-white/50 backdrop-blur-md shadow-sm" :
              theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
            )}>
              <div className="flex justify-between items-start mb-1">
                <h3 className={clsx("text-lg font-semibold truncate flex-1", isFrutigerAero ? "text-blue-900" : "")}>{app.title}</h3>
                <div className="flex gap-1">
                  {app.isPrivate && (
                    <div className={clsx("p-1 rounded-md", isFrutigerAero ? "bg-zinc-500/20" : "bg-zinc-800")} title="Private (Local Only)">
                      <Lock className={clsx("w-3 h-3", isFrutigerAero ? "text-zinc-600" : "text-zinc-400")} />
                    </div>
                  )}
                  {app.isLocked && (
                    <div className={clsx("p-1 rounded-md", isFrutigerAero ? "bg-emerald-500/20" : "bg-emerald-500/10")} title="Locked with Code">
                      <Key className={clsx("w-3 h-3", isFrutigerAero ? "text-emerald-600" : "text-emerald-500")} />
                    </div>
                  )}
                  {app.isAiGenerated && (
                    <div className={clsx("p-1 rounded-md", isFrutigerAero ? "bg-blue-500/20" : "bg-emerald-500/10")} title="AI Generated">
                      <Terminal className={clsx("w-3 h-3", isFrutigerAero ? "text-blue-600" : "text-emerald-500")} />
                    </div>
                  )}
                </div>
              </div>
              <p className={clsx("text-sm mb-4 line-clamp-2 h-10", isFrutigerAero ? "text-blue-800/70" : theme !== 'light' ? 'text-zinc-400' : 'text-zinc-500')}>
                {app.description}
              </p>
              
              <div className={clsx("flex items-center gap-4 text-xs mb-6", isFrutigerAero ? "text-blue-800/60" : "text-zinc-500")}>
                <span>v{app.version}</span>
                <span>•</span>
                <span>{app.downloads} downloads</span>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setEditingAppId(app.id);
                    setCurrentView('editor');
                  }}
                  className={clsx(
                    "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isFrutigerAero ? "bg-white/50 hover:bg-white/70 text-blue-800 border border-white/60 shadow-sm" : "bg-zinc-800 hover:bg-zinc-700 text-white"
                  )}
                >
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
                <button 
                  onClick={() => setAppToDelete(app.id)}
                  className={clsx(
                    "p-2 rounded-lg transition-colors",
                    isFrutigerAero ? "bg-red-500/20 text-red-600 hover:bg-red-500 hover:text-white border border-red-500/30" : "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
                  )}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {appToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={clsx(
            "w-full max-w-sm rounded-2xl p-6 shadow-2xl",
            isFrutigerAero ? "bg-white/80 border border-white/50 backdrop-blur-md" :
            theme !== 'light' ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'
          )}>
            <h3 className={clsx("text-xl font-bold mb-2", isFrutigerAero ? "text-blue-900" : "")}>Delete App</h3>
            <p className={clsx("mb-6", isFrutigerAero ? "text-blue-800/70" : "text-zinc-500")}>Are you sure you want to delete this app? This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setAppToDelete(null)}
                className={clsx(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  isFrutigerAero ? "text-blue-800/60 hover:text-blue-800" : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
