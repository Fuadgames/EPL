import React, { useState, useMemo } from 'react';
import { useStore, InstalledAppItem } from '../store/useStore';
import { confirmAction, notify } from '../store/useDialogStore';
import {
  Play,
  Trash2,
  Search,
  ArrowUpDown,
  Download,
  PackageOpen,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { clsx } from 'clsx';
import BuildDownloadModal from './BuildDownloadModal';
import CustomSelect from './CustomSelect';

export default function InstalledAppsView() {
  const theme = useStore((state) => state.theme);
  const isFrutigerAero = useStore((state) => state.isFrutigerAero);
  const language = useStore((state) => state.language);
  const setCurrentView = useStore((state) => state.setCurrentView);
  const setPlayingAppId = useStore((state) => state.setPlayingAppId);
  const setSelectedAppId = useStore((state) => state.setSelectedAppId);
  const installedAppsList = useStore((state) => state.installedAppsList);
  const removeInstalledApp = useStore((state) => state.removeInstalledApp);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'version'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [downloadTargetApp, setDownloadTargetApp] = useState<any | null>(null);

  const isLight = theme === 'light' && !isFrutigerAero;

  const filteredApps = useMemo(() => {
    let list = [...(installedAppsList || [])];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (app) =>
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
      code,
      iconUrl: app.icon,
      description: app.description,
      authorName: app.authorName,
      category: app.category,
    });
  };

  const handleRemove = async (app: InstalledAppItem) => {
    const confirmed = await confirmAction({
      title: language === 'ru' ? 'Удалить из библиотеки?' : 'Remove this app?',
      message:
        language === 'ru'
          ? `Удалить «${app.projectName}» из установленных приложений? Вы всегда сможете заново получить его в App Store.`
          : `Remove "${app.projectName}" from Installed Apps? You can get it again from the App Store anytime.`,
      confirmText: language === 'ru' ? 'Удалить' : 'Remove',
      tone: 'danger',
    });
    if (!confirmed) return;
    await removeInstalledApp(app.projectId || app.id);
    notify.info(language === 'ru' ? 'Удалено из установленных' : 'Removed from Installed Apps');
  };

  return (
    <div className="flex-1 h-full overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={clsx(
                'w-10 h-10 rounded-lg border flex items-center justify-center shrink-0',
                isFrutigerAero
                  ? 'bg-white/60 border-white text-[#0284c7]'
                  : isLight
                  ? 'bg-[#FFFFFF] border-[#E2E5EA] text-[#059669]'
                  : 'bg-[#181B20] border-[#262B33] text-[#10B981]'
              )}
            >
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {language === 'ru' ? 'Установленные приложения' : 'Installed Apps'}
              </h1>
              <p className="text-sm opacity-70 font-mono-num">
                {language === 'ru'
                  ? `Библиотека приложений (${installedAppsList?.length || 0})`
                  : `Local & cloud library (${installedAppsList?.length || 0})`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'ru' ? 'Поиск в библиотеке...' : 'Search installed...'}
                className={clsx(
                  'w-full pl-9 pr-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2',
                  isFrutigerAero
                    ? 'bg-white/60 border-white text-[#062038]'
                    : isLight
                    ? 'bg-white border-[#E2E5EA] text-[#111315] focus:ring-[#059669]/40'
                    : 'bg-[#181B20] border-[#262B33] text-[#F3F4F6] focus:ring-[#10B981]/40'
                )}
              />
            </div>

            <CustomSelect
              value={sortBy}
              onChange={(val) => setSortBy(val as 'date' | 'name' | 'version')}
              className="min-w-[140px]"
              options={[
                { value: 'date', label: language === 'ru' ? 'По дате' : 'By Date' },
                { value: 'name', label: language === 'ru' ? 'По названию' : 'By Name' },
                { value: 'version', label: language === 'ru' ? 'По версии' : 'By Version' },
              ]}
            />

            <button
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className={clsx(
                'p-2 rounded-lg border transition-colors',
                isFrutigerAero
                  ? 'bg-white/60 border-white text-[#062038]'
                  : isLight
                  ? 'bg-white border-[#E2E5EA] hover:bg-[#F5F6F8]'
                  : 'bg-[#181B20] border-[#262B33] hover:bg-[#20242B]'
              )}
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Grid / Empty State */}
        {filteredApps.length === 0 ? (
          <div
            className={clsx(
              'rounded-xl border p-12 text-center max-w-lg mx-auto my-8',
              isFrutigerAero
                ? 'frutiger-aero-glass'
                : isLight
                ? 'bg-white border-[#E2E5EA]'
                : 'bg-[#181B20] border-[#262B33]'
            )}
          >
            <PackageOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <h3 className="text-base font-semibold mb-1">
              {searchQuery
                ? language === 'ru'
                  ? 'Ничего не найдено'
                  : 'No matching apps'
                : language === 'ru'
                ? 'Нет установленных приложений'
                : 'No installed apps'}
            </h3>
            <p className="text-sm opacity-70 mb-5">
              {searchQuery
                ? language === 'ru'
                  ? 'Попробуйте изменить поисковый запрос.'
                  : 'Try changing your search query.'
                : language === 'ru'
                ? 'Устанавливайте проекты из App Store кнопкой Get.'
                : 'Install apps from the App Store using the Get button.'}
            </p>
            <button
              onClick={() => setCurrentView('store')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                isFrutigerAero
                  ? 'frutiger-aero-button'
                  : 'bg-[#10B981] hover:bg-[#059669] text-[#09120E]'
              )}
            >
              {language === 'ru' ? 'Перейти в App Store' : 'Browse App Store'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredApps.map((app) => (
              <article
                key={app.id || app.projectId}
                className={clsx(
                  'rounded-xl p-5 border flex flex-col justify-between transition-colors',
                  isFrutigerAero
                    ? 'frutiger-aero-glass'
                    : isLight
                    ? 'bg-white border-[#E2E5EA] hover:border-[#D1D5DB]'
                    : 'bg-[#181B20] border-[#262B33] hover:border-[#374151]'
                )}
              >
                <div>
                  <div className="flex items-start gap-3.5 mb-3">
                    <button
                      onClick={() => setSelectedAppId(app.projectId || app.id)}
                      className={clsx(
                        'w-12 h-12 rounded-xl border flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden cursor-pointer',
                        isFrutigerAero
                          ? 'bg-white/70 border-white text-[#0284c7]'
                          : isLight
                          ? 'bg-[#F5F6F8] border-[#E2E5EA] text-[#059669]'
                          : 'bg-[#111315] border-[#262B33] text-[#10B981]'
                      )}
                    >
                      {app.icon ? (
                        <img src={app.icon} alt={app.projectName} className="w-full h-full object-cover" />
                      ) : (
                        (app.projectName || 'A').charAt(0).toUpperCase()
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <h3
                        onClick={() => setSelectedAppId(app.projectId || app.id)}
                        className="font-semibold text-base truncate cursor-pointer hover:text-[#10B981] transition-colors"
                      >
                        {app.projectName}
                      </h3>
                      <div className="text-xs opacity-70 truncate mt-0.5">
                        <span className="capitalize">{app.category || 'App'}</span>
                        <span className="mx-1.5">·</span>
                        <span>{app.authorName || 'EPL Creator'}</span>
                      </div>
                    </div>
                  </div>

                  {app.description && (
                    <p className="text-sm opacity-75 line-clamp-2 mb-4">{app.description}</p>
                  )}

                  <div
                    className={clsx(
                      'flex items-center justify-between text-xs opacity-70 pt-3 mb-4 border-t font-mono-num',
                      isLight ? 'border-[#E2E5EA]' : 'border-[#262B33]'
                    )}
                  >
                    <span className="inline-flex items-center gap-1 text-[#10B981]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      v{app.version || '1.0.0'}
                    </span>
                    <span>
                      {app.installedAt ? new Date(app.installedAt).toLocaleDateString() : 'Installed'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleLaunch(app)}
                    className={clsx(
                      'flex-1 py-2 px-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 whitespace-nowrap transition-colors',
                      isFrutigerAero
                        ? 'frutiger-aero-button'
                        : 'bg-[#10B981] hover:bg-[#059669] text-[#09120E]'
                    )}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>{language === 'ru' ? 'Запустить' : 'Launch'}</span>
                  </button>

                  <button
                    onClick={() => handleDownloadApp(app)}
                    className={clsx(
                      'p-2 rounded-lg border transition-colors shrink-0',
                      isLight
                        ? 'border-[#E2E5EA] hover:bg-[#F5F6F8] text-[#4B5563]'
                        : 'border-[#262B33] hover:bg-[#20242B] text-[#9CA3AF]'
                    )}
                    title={language === 'ru' ? 'Сборка и скачивание' : 'Build & download'}
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleRemove(app)}
                    className="p-2 rounded-lg border border-[#DC2626]/30 bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#DC2626] transition-colors shrink-0"
                    title={language === 'ru' ? 'Удалить' : 'Remove'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <BuildDownloadModal
        isOpen={!!downloadTargetApp}
        app={downloadTargetApp}
        onClose={() => setDownloadTargetApp(null)}
      />
    </div>
  );
}
