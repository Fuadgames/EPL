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
  const { theme, setCurrentView, setEditingAppId, user } = useStore();

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
        <Package className="w-16 h-16 text-zinc-500 mb-4 opacity-50" />
        <h2 className="text-2xl font-bold mb-2">Sign in to view your apps</h2>
        <p className="text-zinc-500 max-w-md">You need an account to create and publish apps to the EPL Store.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 sm:p-8 overflow-y-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Apps</h1>
          <p className={clsx("mt-2", theme !== 'light' ? 'text-zinc-400' : 'text-zinc-500')}>Manage your published EPL applications.</p>
        </div>
        <button
          onClick={() => {
            setEditingAppId(null);
            setCurrentView('editor');
          }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" /> New App
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      ) : apps.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center border-2 border-dashed border-zinc-800 rounded-3xl p-12">
          <Package className="w-16 h-16 text-zinc-600 mb-4" />
          <h3 className="text-xl font-semibold mb-2">No apps yet</h3>
          <p className="text-zinc-500 mb-6 max-w-sm">You haven't published any apps yet. Head over to the Code Editor to create your first EPL program.</p>
          <button
            onClick={() => {
              setEditingAppId(null);
              setCurrentView('editor');
            }}
            className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
          >
            Open Editor
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps.map(app => (
            <div key={app.id} className={clsx(
              "p-6 rounded-2xl border transition-all relative overflow-hidden",
              theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
            )}>
              <div className="flex justify-between items-start mb-1">
                <h3 className="text-lg font-semibold truncate flex-1">{app.title}</h3>
                <div className="flex gap-1">
                  {app.isPrivate && (
                    <div className="bg-zinc-800 p-1 rounded-md" title="Private (Local Only)">
                      <Lock className="w-3 h-3 text-zinc-400" />
                    </div>
                  )}
                  {app.isLocked && (
                    <div className="bg-emerald-500/10 p-1 rounded-md" title="Locked with Code">
                      <Key className="w-3 h-3 text-emerald-500" />
                    </div>
                  )}
                  {app.isAiGenerated && (
                    <div className="bg-emerald-500/10 p-1 rounded-md" title="AI Generated">
                      <Terminal className="w-3 h-3 text-emerald-500" />
                    </div>
                  )}
                </div>
              </div>
              <p className={clsx("text-sm mb-4 line-clamp-2 h-10", theme !== 'light' ? 'text-zinc-400' : 'text-zinc-500')}>
                {app.description}
              </p>
              
              <div className="flex items-center gap-4 text-xs text-zinc-500 mb-6">
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
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
                <button 
                  onClick={() => setAppToDelete(app.id)}
                  className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
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
            theme !== 'light' ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'
          )}>
            <h3 className="text-xl font-bold mb-2">Delete App</h3>
            <p className="text-zinc-500 mb-6">Are you sure you want to delete this app? This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setAppToDelete(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
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
