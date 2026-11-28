import React, { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  arrayRemove,
  arrayUnion,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import {
  handleFirestoreError,
  OperationType,
} from '../lib/firestore-utils';
import { useStore } from '../store/useStore';
import { confirmAction, notify } from '../store/useDialogStore';
import { EplShopItem } from '../types';
import { renderShopSpecSnapshot } from '../lib/siteSpecRenderer';
import {
  Sparkles,
  Plus,
  Coins,
  Search,
  CheckCircle2,
  RotateCcw,
  Undo2,
  ShoppingBag,
  Trash2,
  Edit3,
  Infinity as InfinityIcon,
  Layers,
  Palette,
} from 'lucide-react';
import { clsx } from 'clsx';

export default function EplShopView() {
  const theme = useStore((s) => s.theme);
  const isFrutigerAero = useStore((s) => s.isFrutigerAero);
  const language = useStore((s) => s.language);
  const user = useStore((s) => s.user);
  const userData = useStore((s) => s.userData);
  const simulatedRole = useStore((s) => s.simulatedRole);
  const setIsAuthModalOpen = useStore((s) => s.setIsAuthModalOpen);
  const openEplShopBuilder = useStore((s) => s.openEplShopBuilder);
  const appliedEplShopItemId = useStore((s) => s.appliedEplShopItemId);
  const previewEplShopSpec = useStore((s) => s.previewEplShopSpec);
  const applyEplShopItem = useStore((s) => s.applyEplShopItem);
  const purchasedEplShopIds = useStore((s) => s.purchasedEplShopIds);
  const markPurchasedEplShopId = useStore((s) => s.markPurchasedEplShopId);
  const unmarkPurchasedEplShopId = useStore((s) => s.unmarkPurchasedEplShopId);

  const actualRole = userData?.role || 'user';
  const effectiveRole = actualRole === 'developer' && simulatedRole ? simulatedRole : actualRole;
  const isDeveloper = effectiveRole === 'developer';
  const isLight = theme === 'light' && !isFrutigerAero;

  const [items, setItems] = useState<EplShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [search, setSearch] = useState('');
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'price'>('newest');

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    const q = query(collection(db, 'eplShopItems'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as Omit<EplShopItem, 'id'>), id: d.id }));
        setItems(list);
        setLoading(false);
        setLoadError(null);
      },
      (err: any) => {
        handleFirestoreError(err, OperationType.LIST, 'eplShopItems');
        setLoadError(
          err?.message ||
            (language === 'ru'
              ? 'Не удалось загрузить товары EPL Shop.'
              : 'Unable to load EPL Shop items.')
        );
        setLoading(false);
      }
    );
    return () => unsub();
  }, [reloadTick, language]);

  const isOwned = (item: EplShopItem) => {
    if (!user) return false;
    if (purchasedEplShopIds.includes(item.id)) return true;
    const p = userData?.purchasedItems || [];
    return p.includes(`eplshop:${item.id}`) || p.includes(item.id);
  };

  const handleApplyItem = async (item: EplShopItem) => {
    if (!isOwned(item)) {
      notify.info(
        language === 'ru'
          ? 'Сначала купите этот товар за EPL Coins'
          : 'Please purchase this build with EPL Coins first'
      );
      return;
    }
    await applyEplShopItem(item);
    notify.success(
      language === 'ru'
        ? `«${item.title}» включена для всего EPL Studio!`
        : `"${item.title}" is now active across EPL Studio!`
    );
  };

  const handleDisableItem = async () => {
    await applyEplShopItem(null);
    notify.info(
      language === 'ru'
        ? 'Оформление EPL Shop отключено'
        : 'EPL Shop build disabled'
    );
  };

  const getRefundAmount = (item: EplShopItem): number => {
    const recorded = userData?.eplShopPurchases?.[item.id];
    if (typeof recorded === 'number' && Number.isFinite(recorded) && recorded >= 0) {
      return Math.round(recorded);
    }
    const fallback = Number(item.price ?? 0);
    return Number.isFinite(fallback) ? Math.max(0, Math.round(fallback)) : 0;
  };

  const handleBuy = async (item: EplShopItem) => {
    if (buyingId === item.id || refundingId === item.id) return;
    if (!user || !auth.currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    if (isOwned(item)) {
      await handleApplyItem(item);
      return;
    }
    if (item.stock !== 'infinite' && Number(item.stock) <= 0) {
      notify.error(language === 'ru' ? 'Товар распродан!' : 'Out of stock!');
      return;
    }

    const rawPrice = Number(item.price ?? 0);
    const price = Number.isFinite(rawPrice) ? Math.max(0, Math.round(rawPrice)) : 0;
    const rawCoins = Number(userData?.eplCoins ?? 0);
    const coins = Number.isFinite(rawCoins) ? rawCoins : 0;
    if (coins < price) {
      notify.error(
        language === 'ru'
          ? `Недостаточно EPL Coins (нужно ${price}, у вас ${coins})`
          : `Not enough EPL Coins (need ${price}, you have ${coins})`
      );
      return;
    }

    const ok = await confirmAction({
      title: language === 'ru' ? 'Покупка в EPL Shop' : 'Purchase EPL Shop Build',
      message:
        language === 'ru'
          ? `Купить «${item.title}» за ${price} EPL Coins? После покупки вы сможете ставить или выключать её в любое время.`
          : `Buy "${item.title}" for ${price} EPL Coins? Once purchased, you can apply or disable it anytime.`,
      confirmText: language === 'ru' ? `Купить (${price} Coins)` : `Buy (${price} Coins)`,
    });
    if (!ok) return;

    setBuyingId(item.id);
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(
        userRef,
        {
          ...(price > 0 ? { eplCoins: increment(-price) } : {}),
          purchasedItems: arrayUnion(`eplshop:${item.id}`),
          eplShopPurchases: { [item.id]: price },
        },
        { merge: true }
      );

      if (item.authorId && item.authorId !== user.uid && price > 0) {
        await Promise.all([
          updateDoc(doc(db, 'users', item.authorId), {
            eplCoins: increment(price),
          }).catch(() => {}),
          updateDoc(doc(db, 'users_public', item.authorId), {
            eplCoins: increment(price),
          }).catch(() => {}),
        ]);
      }

      const nextStock =
        item.stock === 'infinite'
          ? 'infinite'
          : Math.max(0, (Number.isFinite(Number(item.stock)) ? Number(item.stock) : 1) - 1);

      try {
        await updateDoc(doc(db, 'eplShopItems', item.id), {
          stock: nextStock,
          sales: increment(1),
          updatedAt: new Date().toISOString(),
        });
      } catch (stockErr) {
        handleFirestoreError(stockErr, OperationType.UPDATE, `eplShopItems/${item.id}`);
      }

      markPurchasedEplShopId(item.id);
      notify.success(
        language === 'ru'
          ? `«${item.title}» куплена за ${price} EPL Coins! Теперь нажмите «Применить», чтобы включить.`
          : `Purchased "${item.title}" for ${price} EPL Coins! Click Apply to enable it.`
      );
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      notify.error(err?.message || (language === 'ru' ? 'Ошибка покупки' : 'Purchase failed'));
    } finally {
      setBuyingId(null);
    }
  };

  const handleRefund = async (item: EplShopItem) => {
    if (refundingId === item.id || buyingId === item.id) return;
    if (!user || !auth.currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!isOwned(item)) return;

    const refundAmount = getRefundAmount(item);
    const ok = await confirmAction({
      title: language === 'ru' ? 'Возврат EPL Coins' : 'Refund EPL Shop Build',
      message:
        language === 'ru'
          ? `Вернуть «${item.title}» и получить обратно ${refundAmount} EPL Coins?`
          : `Refund "${item.title}" and receive ${refundAmount} EPL Coins back?`,
      confirmText:
        language === 'ru'
          ? `Вернуть (+${refundAmount} Coins)`
          : `Refund (+${refundAmount} Coins)`,
      cancelText: language === 'ru' ? 'Отмена' : 'Cancel',
    });
    if (!ok) return;

    setRefundingId(item.id);
    try {
      const wasActive = appliedEplShopItemId === item.id;
      if (wasActive) {
        await applyEplShopItem(null);
      }

      const userRef = doc(db, 'users', user.uid);
      await setDoc(
        userRef,
        {
          ...(refundAmount > 0 ? { eplCoins: increment(refundAmount) } : {}),
          purchasedItems: arrayRemove(`eplshop:${item.id}`, item.id),
          eplShopPurchases: { [item.id]: deleteField() },
          ...(wasActive ? { activeEplShopItemId: null, activeEplShopSpec: null } : {}),
        },
        { merge: true }
      );

      if (item.authorId && item.authorId !== user.uid && refundAmount > 0) {
        try {
          const authorSnap = await getDoc(doc(db, 'users', item.authorId));
          if (authorSnap.exists()) {
            const authorCoins = Math.max(0, Number(authorSnap.data()?.eplCoins || 0));
            const deduct = Math.min(authorCoins, refundAmount);
            if (deduct > 0) {
              await Promise.all([
                updateDoc(doc(db, 'users', item.authorId), {
                  eplCoins: increment(-deduct),
                }).catch(() => {}),
                updateDoc(doc(db, 'users_public', item.authorId), {
                  eplCoins: increment(-deduct),
                }).catch(() => {}),
              ]);
            }
          }
        } catch {
          // Non-fatal if author profile cannot be read/updated
        }
      }

      const nextStock =
        item.stock === 'infinite'
          ? 'infinite'
          : Math.max(0, (Number.isFinite(Number(item.stock)) ? Number(item.stock) : 0) + 1);
      const nextSales = Math.max(
        0,
        (Number.isFinite(Number(item.sales)) ? Number(item.sales) : 1) - 1
      );

      try {
        await updateDoc(doc(db, 'eplShopItems', item.id), {
          stock: nextStock,
          sales: nextSales,
          updatedAt: new Date().toISOString(),
        });
      } catch (stockErr) {
        handleFirestoreError(stockErr, OperationType.UPDATE, `eplShopItems/${item.id}`);
      }

      unmarkPurchasedEplShopId(item.id);
      notify.success(
        language === 'ru'
          ? `«${item.title}» возвращена! Начислено +${refundAmount} EPL Coins.`
          : `Refunded "${item.title}"! +${refundAmount} EPL Coins returned.`
      );
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      notify.error(err?.message || (language === 'ru' ? 'Ошибка возврата' : 'Refund failed'));
    } finally {
      setRefundingId(null);
    }
  };

  const handleDeleteItem = async (item: EplShopItem) => {
    const ok = await confirmAction({
      title: language === 'ru' ? 'Удалить товар?' : 'Delete Shop Item?',
      message:
        language === 'ru'
          ? `Удалить «${item.title}» из EPL Shop?`
          : `Delete "${item.title}" from EPL Shop?`,
      confirmText: language === 'ru' ? 'Удалить' : 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'eplShopItems', item.id));
      unmarkPurchasedEplShopId(item.id);
      if (appliedEplShopItemId === item.id) {
        await applyEplShopItem(null);
      }
      notify.success(language === 'ru' ? 'Удалено из EPL Shop' : 'Removed from EPL Shop');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `eplShopItems/${item.id}`);
      notify.error(err?.message || 'Delete failed');
    }
  };

  const filtered = items
    .filter((it) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (it.title || '').toLowerCase().includes(q) ||
        (it.description || '').toLowerCase().includes(q) ||
        (it.authorName || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'popular') return (b.sales || 0) - (a.sales || 0);
      if (sortBy === 'price') return (a.price || 0) - (b.price || 0);
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div
        className={clsx(
          'px-5 sm:px-6 py-5 border-b shrink-0',
          isFrutigerAero
            ? 'frutiger-aero-glass border-white/50'
            : isLight
            ? 'bg-white border-[#E2E5EA]'
            : 'bg-[#181B20] border-[#262B33]'
        )}
      >
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#10B981] via-teal-500 to-sky-500 text-[#09120E] flex items-center justify-center shrink-0 shadow-md">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">EPL Shop</h1>
              <p className={clsx('text-xs sm:text-sm mt-1', isLight ? 'text-[#4B5563]' : 'text-[#B4BCC8]')}>
                {language === 'ru'
                  ? 'Покупайте полноценные кастомные версии всего EPL Studio от разработчика — меняют дизайн, вкладки, кнопки и добавляют живые EPL-модули.'
                  : 'Buy complete custom builds of EPL Studio created live by the developer — transforms UI, categories, buttons, and adds live EPL tabs.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {(appliedEplShopItemId || previewEplShopSpec) && (
              <button
                type="button"
                onClick={handleDisableItem}
                className={clsx(
                  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer',
                  isLight
                    ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                    : 'bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20'
                )}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{language === 'ru' ? 'Сбросить тему по умолчанию' : 'Reset to Default'}</span>
              </button>
            )}

            <div
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-mono-num font-semibold',
                isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
              )}
            >
              <Coins className="w-4 h-4 text-[#D97706]" />
              <span>{userData?.eplCoins || 0}</span>
            </div>

            {isDeveloper && (
              <button
                type="button"
                onClick={() => openEplShopBuilder(null)}
                title={language === 'ru' ? 'Создать новый стиль сайта в реальном времени' : 'Create new live site build'}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#10B981] to-[#06B6D4] hover:brightness-110 text-[#09120E] text-sm font-bold shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>{language === 'ru' ? 'Создать сборку сайта' : 'Build Site Mod'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Search + Sort */}
        <div className="max-w-7xl mx-auto mt-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={language === 'ru' ? 'Поиск тем и сборок сайта...' : 'Search site skins & mods...'}
              className={clsx(
                'w-full pl-9 pr-4 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2',
                isLight
                  ? 'bg-[#F5F6F8] border-[#E2E5EA] focus:ring-[#059669]/30'
                  : 'bg-[#111315] border-[#262B33] focus:ring-[#10B981]/30'
              )}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {([
              { id: 'newest', label: language === 'ru' ? 'Новые' : 'Newest' },
              { id: 'popular', label: language === 'ru' ? 'Популярные' : 'Popular' },
              { id: 'price', label: language === 'ru' ? 'Дешевле' : 'Lowest Price' },
            ] as const).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSortBy(s.id)}
                className={clsx(
                  'px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer',
                  sortBy === s.id
                    ? 'bg-[#10B981] border-[#10B981] text-[#09120E]'
                    : isLight
                    ? 'bg-[#F5F6F8] border-[#E2E5EA] text-[#4B5563]'
                    : 'bg-[#111315] border-[#262B33] text-[#B4BCC8]'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 p-5 sm:p-6">
        <div className="max-w-7xl mx-auto">
          {loadError && (
            <div className="mb-5 rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 flex items-center justify-between gap-3 text-sm">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => setReloadTick((t) => t + 1)}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-semibold text-xs cursor-pointer"
              >
                {language === 'ru' ? 'Повторить' : 'Retry'}
              </button>
            </div>
          )}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={clsx(
                    'rounded-2xl border overflow-hidden animate-pulse',
                    isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#181B20] border-[#262B33]'
                  )}
                >
                  <div className="aspect-video bg-current/10" />
                  <div className="p-5 space-y-3">
                    <div className="h-5 w-1/2 rounded bg-current/10" />
                    <div className="h-3 w-full rounded bg-current/10" />
                    <div className="h-9 w-full rounded-xl bg-current/10" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div
              className={clsx(
                'max-w-lg mx-auto my-12 p-10 rounded-2xl border text-center',
                isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#181B20] border-[#262B33]'
              )}
            >
              <ShoppingBag className="w-11 h-11 mx-auto mb-3 text-[#10B981]" />
              <h3 className="text-lg font-bold mb-1">
                {language === 'ru' ? 'В EPL Shop пока нет товаров' : 'EPL Shop is empty'}
              </h3>
              <p className="text-xs sm:text-sm opacity-70 mb-5">
                {isDeveloper
                  ? language === 'ru'
                    ? 'Нажмите «+» выше, чтобы прямо сейчас перекрасить весь сайт, добавить кнопки/вкладки на EPL и выставить сборку на продажу.'
                    : 'Click "+" above to customize the live site directly, add custom EPL tabs/widgets, and publish it for coins.'
                  : language === 'ru'
                    ? 'Разработчик скоро добавит сюда уникальные оформления и модификации сайта!'
                    : 'The developer will soon publish custom full-site themes and mods here!'}
              </p>
              {isDeveloper && (
                <button
                  type="button"
                  onClick={() => openEplShopBuilder(null)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#09120E] text-sm font-bold cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{language === 'ru' ? 'Создать первый товар' : 'Create First Item'}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((item) => {
                const owned = isOwned(item);
                const isActive = appliedEplShopItemId === item.id;
                const soldOut = item.stock !== 'infinite' && Number(item.stock) <= 0;
                const coverSrc =
                  item.screenshotUrl ||
                  item.coverUrl ||
                  renderShopSpecSnapshot(item.spec, item.title);

                const customTabCount = item.spec?.customTabs?.length || 0;
                const widgetCount = item.spec?.widgets?.length || 0;
                const overlayCount = Object.keys(item.spec?.tabEplOverlays || {}).length;

                return (
                  <article
                    key={item.id}
                    className={clsx(
                      'rounded-xl border overflow-hidden flex flex-col transition-all',
                      isActive && 'ring-2 ring-[#10B981]',
                      isFrutigerAero
                        ? 'frutiger-aero-glass'
                        : isLight
                        ? 'bg-white border-[#E2E5EA]'
                        : 'bg-[#181B20] border-[#262B33]'
                    )}
                  >
                    <div className="relative aspect-video bg-[#0d1014] overflow-hidden border-b border-current/10">
                      <img
                        src={coverSrc}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        {isActive && (
                          <span className="px-2.5 py-1 rounded-lg bg-[#10B981] text-[#09120E] text-[11px] font-bold flex items-center gap-1 shadow">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{language === 'ru' ? 'Активно' : 'Active'}</span>
                          </span>
                        )}
                      </div>
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-sm border border-white/15 text-xs font-mono-num font-bold text-amber-300 flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5" />
                          <span>{item.price || 0}</span>
                        </span>
                      </div>
                      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] text-white/90 font-mono">
                        <span className="inline-flex items-center gap-1">
                          <Layers className="w-3 h-3 text-[#10B981]" />
                          {customTabCount} tabs · {widgetCount} widgets · {overlayCount} EPL
                        </span>
                        <span className="inline-flex items-center gap-1">
                          {item.stock === 'infinite' ? (
                            <>
                              <InfinityIcon className="w-3.5 h-3.5 text-sky-400" />
                              <span>∞</span>
                            </>
                          ) : (
                            <span>
                              {language === 'ru' ? 'Ост:' : 'Stock:'} {item.stock}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="text-base font-bold truncate">{item.title}</h3>
                        {isDeveloper && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEplShopBuilder(item)}
                              title={language === 'ru' ? 'Редактировать в конструкторе' : 'Edit in live builder'}
                              className="p-1.5 rounded-lg border border-current/15 hover:bg-current/10 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item)}
                              title={language === 'ru' ? 'Удалить товар' : 'Delete item'}
                              className="p-1.5 rounded-lg border border-current/15 hover:bg-red-500/15 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        )}
                      </div>

                      <p className="text-xs opacity-70 mb-1">
                        {language === 'ru' ? 'Автор:' : 'By'} <span className="text-[#10B981] font-semibold">{item.authorName}</span> · {item.sales || 0}{' '}
                        {language === 'ru' ? 'продаж' : 'sales'}
                      </p>

                      <p className="text-sm opacity-85 line-clamp-2 mb-4 flex-1">
                        {item.description || (language === 'ru' ? 'Кастомное оформление всего EPL Studio.' : 'Custom full-site build for EPL Studio.')}
                      </p>

                      <div className="flex items-center gap-2 pt-3 border-t border-current/10">
                        {isActive ? (
                          <>
                            <button
                              type="button"
                              onClick={handleDisableItem}
                              className="flex-1 py-2 px-3 rounded-xl border border-red-500/35 bg-red-500/10 text-red-300 hover:bg-red-500/20 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>{language === 'ru' ? 'Отключить' : 'Disable'}</span>
                            </button>
                            {owned && (
                              <button
                                type="button"
                                disabled={refundingId === item.id}
                                onClick={() => handleRefund(item)}
                                title={
                                  language === 'ru'
                                    ? `Вернуть за +${getRefundAmount(item)} EPL Coins`
                                    : `Refund for +${getRefundAmount(item)} EPL Coins`
                                }
                                className={clsx(
                                  'py-2 px-3 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0',
                                  isLight
                                    ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                    : 'border-amber-500/35 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                                )}
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                                <span>
                                  {refundingId === item.id
                                    ? '...'
                                    : language === 'ru'
                                      ? `Вернуть · +${getRefundAmount(item)}`
                                      : `Refund · +${getRefundAmount(item)}`}
                                </span>
                              </button>
                            )}
                          </>
                        ) : owned ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApplyItem(item)}
                              className="flex-1 py-2 px-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#09120E] text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>{language === 'ru' ? 'Применить' : 'Apply'}</span>
                            </button>
                            <button
                              type="button"
                              disabled={refundingId === item.id}
                              onClick={() => handleRefund(item)}
                              title={
                                language === 'ru'
                                  ? `Вернуть за +${getRefundAmount(item)} EPL Coins`
                                  : `Refund for +${getRefundAmount(item)} EPL Coins`
                              }
                              className={clsx(
                                'py-2 px-3 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0',
                                isLight
                                  ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                  : 'border-amber-500/35 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                              )}
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                              <span>
                                {refundingId === item.id
                                  ? '...'
                                  : language === 'ru'
                                    ? `Вернуть · +${getRefundAmount(item)}`
                                    : `Refund · +${getRefundAmount(item)}`}
                              </span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={soldOut || buyingId === item.id}
                            onClick={() => handleBuy(item)}
                            className={clsx(
                              'flex-1 py-2 px-4 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
                              soldOut
                                ? 'bg-zinc-700 text-zinc-300'
                                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-[#09120E]'
                            )}
                          >
                            <Coins className="w-3.5 h-3.5" />
                            <span>
                              {buyingId === item.id
                                ? language === 'ru'
                                  ? 'Покупка...'
                                  : 'Buying...'
                                : soldOut
                                  ? language === 'ru'
                                    ? 'Распродано'
                                    : 'Sold Out'
                                  : language === 'ru'
                                    ? `Купить · ${item.price}`
                                    : `Buy · ${item.price}`}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
