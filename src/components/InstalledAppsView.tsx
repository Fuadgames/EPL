import React, { useState, useMemo } from 'react';
import { useStore, InstalledAppItem } from '../store/useStore';
import { Play, Trash2, Search, ArrowUpDown, Download, ExternalLink, PackageOpen, Layers, CheckCircle2, AlertTriangle, Monitor, Apple, Terminal, Smartphone } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import BuildDownloadModal from './BuildDownloadModal';

export default function InstalledAppsView() {
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const language = useStore(state => state.language);
  const setCurrentView = useStore(state => state.setCurrentView);
  const setPlayingAppId = useStore(state => state.setPlayingAppId);
  const setSelectedAppId = useStore(state => state.setSelectedAppId);
  const installedAppsList = useStore(state => state.installedAppsList);
  const removeInstalledApp = useStore(state => state.removeInstalledApp);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'version'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [appToRemove, setAppToRemove] = useState<InstalledAppItem | null>(null);
  const [downloadTargetApp, setDownloadTargetApp] = useState<any | null>(null);

  const filteredApps = useMemo(() => {
    let list = [...(installedAppsList || [])];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(app => 
        (app.projectName || '').toLowerCase().includes(q) ||
        (app.description || '').toLowerCase().includes(q) ||
        (app.authorName || '').toLowerCase().includes(q) ||
        (app.category || '').toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let comp = 0;
      if (sortBy === 'date') {
        comp = new Date(b.installedAt || 0).getTime() - new Date(a.installedAt || 0).getTime();
      } else if (sortBy === 'name') {
        comp = (a.projectName || '').localeCompare(b.projectName || '');
      } else if (sortBy === 'version') {
        comp = (b.version || '').localeCompare(a.version || '');
      }
      return sortOrder === 'asc' ? -comp : comp;
    });

    return list;
  }, [installedAppsList, searchQuery, sortBy, sortOrder]);

  const handleLaunch = (app: InstalledAppItem) => {
    setPlayingAppId(app.projectId || app.id);
    setCurrentView('player');
  };

  const handleDownloadApp = async (app: InstalledAppItem) => {
    let code = app.code || '';
    if (!code && (app.projectId || app.id)) {
      try {
        const { getDoc, doc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        const snap = await getDoc(doc(db, 'apps', app.projectId || app.id));
        if (snap.exists()) {
          code = snap.data().code || '';
        }
      } catch (e) {
        console.error('Error fetching full app code for build:', e);
      }
    }

    setDownloadTargetApp({
      id: app.projectId || app.id,
      title: app.projectName,
      version: app.version || '1.0.0',
      code: code,
      iconUrl: app.icon,
      description: app.description,
      authorName: app.authorName,
      category: app.category
    });
  };

  const handleConfirmRemove = async () => {
    if (!appToRemove) return;
    await removeInstalledApp(appToRemove.projectId || appToRemove.id);
    setAppToRemove(null);
  };

  return (
    <div className="flex-1 h-full overflow-y-auto custom-scrollbar p-4 sm:p-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className={clsx(
              "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
              isFrutigerAero ? "bg-blue-600 text-white shadow-blue-400/40" : "bg-blue-600 text-white shadow-blue-600/30"
            )}>
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className={clsx(
                "text-2xl sm:text-3xl font-extrabold tracking-tight",
                isFrutigerAero ? "text-blue-950" : theme !== 'light' ? "text-white" : "text-zinc-900"
              )}>
                {language === 'ru' ? 'Установленные приложения' : 'Installed Apps'}
              </h1>
              <p className={clsx("text-xs sm:text-sm", theme !== 'light' ? "text-zinc-400" : "text-zinc-500")}>
                {language === 'ru'
                  ? `Ваша персональная библиотека (${installedAppsList?.length || 0})`
                  : `Your local and cloud library (${installedAppsList?.length || 0})`}
              </p>
            </div>
          </div>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className={clsx(
            "flex items-center gap-2 px-3.5 py-2 rounded-2xl border flex-1 sm:w-64 transition-all",
            theme !== 'light' ? "bg-zinc-900/60 border-zinc-800 focus-within:border-blue-500" : "bg-white border-zinc-200 focus-within:border-blue-500"
          )}>
            <Search className="w-4 h-4 text-zinc-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'ru' ? 'Поиск приложений...' : 'Search installed apps...'}
              className="bg-transparent border-none outline-none text-xs sm:text-sm w-full placeholder:text-zinc-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className={clsx(
                "px-3 py-2 rounded-2xl border text-xs sm:text-sm font-medium outline-none cursor-pointer",
                theme !== 'light' ? "bg-zinc-900/60 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-700"
              )}
            >
              <option value="date">{language === 'ru' ? 'По дате' : 'By Date'}</option>
              <option value="name">{language === 'ru' ? 'По названию' : 'By Name'}</option>
              <option value="version">{language === 'ru' ? 'По версии' : 'By Version'}</option>
            </select>

            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className={clsx(
                "p-2 rounded-2xl border transition-colors",
                theme !== 'light' ? "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-300" : "bg-white border-zinc-200 hover:border-zinc-300 text-zinc-700"
              )}
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid or Empty State */}
      {filteredApps.length === 0 ? (
        <div className={clsx(
          "rounded-3xl border p-12 text-center flex flex-col items-center justify-center my-12",
          isFrutigerAero ? "frutiger-aero-glass border-white/60" :
          theme !== 'light' ? "bg-zinc-900/30 border-zinc-800/80" : "bg-white border-zinc-200 shadow-sm"
        )}>
          <div className="w-16 h-16 rounded-3xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4">
            <PackageOpen className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold mb-2">
            {searchQuery ? (language === 'ru' ? 'Ничего не найдено' : 'No matching apps') : (language === 'ru' ? 'Нет установленных приложений' : 'No installed apps')}
          </h3>
          <p className="text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
            {searchQuery
              ? (language === 'ru' ? 'Попробуйте изменить поисковый запрос.' : 'Try changing your search keywords.')
              : (language === 'ru' ? 'Вы можете получить любые игры и приложения в App Store нажав кнопку GET.' : 'You can get any games and applications from the App Store by clicking the GET button.')}
          </p>
          <button
            onClick={() => setCurrentView('store')}
            className="px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-500/25 transition-all active:scale-[0.98] cursor-pointer"
          >
            {language === 'ru' ? 'Перейти в App Store' : 'Browse App Store'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {filteredApps.map((app) => (
              <motion.div
                key={app.id || app.projectId}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={clsx(
                  "rounded-3xl p-5 sm:p-6 border flex flex-col justify-between transition-all duration-300 relative group hover:shadow-xl",
                  isFrutigerAero ? "frutiger-aero-glass border-white/60 hover:-translate-y-1" :
                  theme !== 'light' ? "bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/70" : "bg-white border-zinc-200 hover:border-zinc-300 shadow-sm"
                )}
              >
                <div>
                  {/* Top Bar with Icon and Metadata */}
                  <div className="flex items-start gap-4 mb-4">
                    <div 
                      onClick={() => setSelectedAppId(app.projectId || app.id)}
                      className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl shadow-md shrink-0 cursor-pointer hover:scale-105 transition-transform"
                    >
                      {app.icon ? (
                        <img src={app.icon} alt={app.projectName} className="w-full h-full object-cover" />
                      ) : (
                        (app.projectName || 'A').charAt(0)
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {app.category || 'App'}
                        </span>
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Ready
                        </span>
                      </div>

                      <h3 
                        onClick={() => setSelectedAppId(app.projectId || app.id)}
                        className="font-bold text-base sm:text-lg leading-tight truncate cursor-pointer hover:text-blue-400 transition-colors"
                      >
                        {app.projectName}
                      </h3>

                      <p className="text-xs text-zinc-400 truncate mt-0.5">
                        by {app.authorName || 'EPL Creator'}
                      </p>
                    </div>
                  </div>

                  {/* Details */}
                  {app.description && (
                    <p className="text-xs text-zinc-400 line-clamp-2 mb-4 leading-relaxed">
                      {app.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-5 pt-3 border-t border-zinc-800/40">
                    <span>v{app.version || '1.0.0'}</span>
                    <span>
                      {app.installedAt 
                        ? new Date(app.installedAt).toLocaleDateString()
                        : 'Installed'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleLaunch(app)}
                      className="flex-1 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      {language === 'ru' ? 'ЗАПУСТИТЬ' : 'LAUNCH'}
                    </button>

                    <button
                      onClick={() => handleDownloadApp(app)}
                      className={clsx(
                        "p-3 rounded-2xl border transition-colors cursor-pointer",
                        theme !== 'light' ? "bg-zinc-800/60 hover:bg-zinc-700 border-zinc-700 text-zinc-300" : "bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700"
                      )}
                      title={language === 'ru' ? 'Собрать и скачать приложение для платформы' : 'Build & download application for platform'}
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setAppToRemove(app)}
                      className="p-3 rounded-2xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                      title={language === 'ru' ? 'Удалить из установленных' : 'Remove from Installed Apps'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Confirmation Modal for Remove */}
      {appToRemove && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className={clsx(
            "w-full max-w-sm rounded-3xl p-6 border shadow-2xl space-y-4",
            isFrutigerAero ? "frutiger-aero-glass border-white/60 text-blue-950" :
            theme !== 'light' ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
          )}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base">
                  {language === 'ru' ? 'Удалить приложение?' : 'Remove this app?'}
                </h3>
                <p className="text-xs text-zinc-400">
                  {appToRemove.projectName}
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              {language === 'ru'
                ? 'Приложение будет удалено из вашей библиотеки Installed Apps. Вы всегда сможете снова получить его в App Store.'
                : 'This app will be removed from your Installed Apps library. You can always get it again from the App Store.'}
            </p>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setAppToRemove(null)}
                className="px-4 py-2.5 rounded-xl border border-zinc-700/60 bg-zinc-800/40 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
              >
                {language === 'ru' ? 'Отмена' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmRemove}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-lg shadow-red-600/25"
              >
                {language === 'ru' ? 'Удалить' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Build & Download Modal */}
      <BuildDownloadModal
        isOpen={!!downloadTargetApp}
        app={downloadTargetApp}
        onClose={() => setDownloadTargetApp(null)}
      />
    </div>
  );
}
