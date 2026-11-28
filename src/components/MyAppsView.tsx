import React, { useEffect, useState } from 'react';
import { collection, query, where, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store/useStore';
import { confirmAction, notify } from '../store/useDialogStore';
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
  status?: string;
  moderationStatus?: 'approved' | 'rejected' | 'pending';
  moderationReason?: string;
}

export default function MyAppsView() {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const theme = useStore((state) => state.theme);
  const language = useStore((state) => state.language);
  const isFrutigerAero = useStore((state) => state.isFrutigerAero);
  const setCurrentView = useStore((state) => state.setCurrentView);
  const setEditingAppId = useStore((state) => state.setEditingAppId);
  const setSelectedExtraCategory = useStore((state) => state.setSelectedExtraCategory);
  const user = useStore((state) => state.user);

  const isLight = theme === 'light' && !isFrutigerAero;

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'apps'), where('authorId', '==', user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const appsData = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as AppData));
        appsData.sort((a, b) => {
          const dateA = (a as any).updatedAt ? new Date((a as any).updatedAt).getTime() : 0;
          const dateB = (b as any).updatedAt ? new Date((b as any).updatedAt).getTime() : 0;
          return dateB - dateA;
        });
        setApps(appsData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching user apps', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleDelete = async (app: AppData) => {
    const confirmed = await confirmAction({
      title: language === 'ru' ? 'Удалить проект?' : 'Delete App?',
      message:
        language === 'ru'
          ? `Вы уверены, что хотите удалить «${app.title}»? Это действие необратимо.`
          : `Delete "${app.title}" permanently? This action cannot be undone.`,
      confirmText: language === 'ru' ? 'Удалить' : 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, 'apps', app.id));
      notify.success(language === 'ru' ? 'Проект удалён' : 'App deleted');
    } catch (error) {
      console.error('Error deleting app', error);
      notify.error(language === 'ru' ? 'Не удалось удалить проект' : 'Failed to delete app');
    }
  };

  if (!user) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <Package className="w-12 h-12 mb-4 opacity-40" />
        <h2 className="text-xl font-bold mb-1">
          {language === 'ru' ? 'Войдите для просмотра проектов' : 'Sign in to view your apps'}
        </h2>
        <p className="text-sm opacity-70 max-w-md">
          {language === 'ru'
            ? 'Войдите в аккаунт, чтобы создавать и публиковать приложения в EPL Studio.'
            : 'Sign in to create and publish applications to the EPL Store.'}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-3.5 sm:p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {language === 'ru' ? 'Мои проекты' : 'My Apps'}
            </h1>
            <p className="text-sm opacity-70 mt-0.5">
              {language === 'ru'
                ? 'Управление опубликованными и локальными проектами EPL'
                : 'Manage your published and draft EPL applications.'}
            </p>
          </div>
          <button
            onClick={() => {
              setEditingAppId(null);
              setSelectedExtraCategory('Normal');
              setCurrentView('editor');
            }}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0',
              isFrutigerAero
                ? 'frutiger-aero-button'
                : 'bg-[#10B981] hover:bg-[#059669] text-[#09120E]'
            )}
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'ru' ? 'Новый проект' : 'New App'}</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#10B981]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-current border-t-transparent" />
          </div>
        ) : apps.length === 0 ? (
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
            <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <h3 className="text-base font-semibold mb-1">
              {language === 'ru' ? 'Проектов пока нет' : 'No apps yet'}
            </h3>
            <p className="text-sm opacity-70 mb-5">
              {language === 'ru'
                ? 'Откройте редактор кода, чтобы создать своё первое приложение.'
                : 'Open the IDE Editor to build your first EPL program.'}
            </p>
            <button
              onClick={() => {
                setEditingAppId(null);
                setSelectedExtraCategory('Normal');
                setCurrentView('editor');
              }}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                isFrutigerAero
                  ? 'frutiger-aero-button'
                  : 'bg-[#10B981] hover:bg-[#059669] text-[#09120E]'
              )}
            >
              {language === 'ru' ? 'Открыть редактор' : 'Open Editor'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {apps.map((app) => (
              <article
                key={app.id}
                className={clsx(
                  'p-5 rounded-xl border flex flex-col justify-between transition-colors',
                  isFrutigerAero
                    ? 'frutiger-aero-glass'
                    : isLight
                    ? 'bg-white border-[#E2E5EA] hover:border-[#D1D5DB]'
                    : 'bg-[#181B20] border-[#262B33] hover:border-[#374151]'
                )}
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="text-base font-semibold truncate flex-1">{app.title}</h3>
                    <div className="flex items-center gap-1 shrink-0">
                      {app.isPrivate && (
                        <span
                          className="p-1 rounded border border-current/15 opacity-70"
                          title="Private (Local Only)"
                        >
                          <Lock className="w-3 h-3" />
                        </span>
                      )}
                      {app.isLocked && (
                        <span
                          className="p-1 rounded border border-[#10B981]/30 text-[#10B981]"
                          title="Locked with Access Code"
                        >
                          <Key className="w-3 h-3" />
                        </span>
                      )}
                      {app.isAiGenerated && (
                        <span
                          className="p-1 rounded border border-[#10B981]/30 text-[#10B981]"
                          title="AI Assisted"
                        >
                          <Terminal className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>

                  {app.moderationStatus && (
                    <div className="mb-2.5">
                      {app.moderationStatus === 'approved' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-500/10 text-[#10B981] border border-emerald-500/30">
                          AI Verified
                        </span>
                      )}
                      {app.moderationStatus === 'rejected' && (
                        <div className="p-2.5 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-xs">
                          <div className="font-semibold">{language === 'ru' ? 'Отклонено ИИ' : 'Rejected by AI'}</div>
                          {app.moderationReason && (
                            <div className="text-[11px] opacity-85 line-clamp-2 mt-0.5">
                              {app.moderationReason}
                            </div>
                          )}
                        </div>
                      )}
                      {app.moderationStatus === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#D97706]/10 text-[#D97706] border border-[#D97706]/30">
                          {language === 'ru' ? 'На проверке' : 'Pending Review'}
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-sm opacity-75 line-clamp-2 mb-4">
                    {app.description || (language === 'ru' ? 'Без описания' : 'No description')}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-3 text-xs opacity-60 mb-4 font-mono-num">
                    <span>v{app.version || '1.0.0'}</span>
                    <span>·</span>
                    <span>{app.downloads || 0} downloads</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingAppId(app.id);
                        setSelectedExtraCategory('Normal');
                        setCurrentView('editor');
                      }}
                      className={clsx(
                        'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap',
                        isFrutigerAero
                          ? 'frutiger-aero-button'
                          : isLight
                          ? 'bg-[#F5F6F8] border-[#E2E5EA] hover:bg-[#EBEDF0]'
                          : 'bg-[#111315] border-[#262B33] hover:bg-[#20242B]'
                      )}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>{language === 'ru' ? 'Открыть в IDE' : 'Edit'}</span>
                    </button>
                    <button
                      onClick={() => handleDelete(app)}
                      className="p-2 rounded-lg border border-[#DC2626]/30 bg-[#DC2626]/10 text-[#DC2626] hover:bg-[#DC2626]/20 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
