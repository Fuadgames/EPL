import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { notify } from '../store/useDialogStore';
import { translations } from '../lib/translations';
import { clsx } from 'clsx';
import { Plus, Search, Coins, CheckCircle, ShoppingBag } from 'lucide-react';
import { collection, query, onSnapshot, doc, updateDoc, increment, getDocs, where, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { db } from '../firebase';
import { StoreAsset } from '../types';

const FRUTIGER_AERO_COVER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="55%" stop-color="#0ea5e9"/>
          <stop offset="100%" stop-color="#10b981"/>
        </linearGradient>
        <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.75)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0.05)"/>
        </linearGradient>
      </defs>
      <rect width="640" height="360" fill="url(#sky)"/>
      <circle cx="150" cy="110" r="95" fill="rgba(255,255,255,0.22)"/>
      <circle cx="490" cy="240" r="130" fill="rgba(255,255,255,0.16)"/>
      <rect x="70" y="90" width="500" height="180" rx="28" fill="url(#gloss)" stroke="rgba(255,255,255,0.7)" stroke-width="2"/>
      <text x="320" y="185" text-anchor="middle" font-family="sans-serif" font-size="38" font-weight="bold" fill="#ffffff">Frutiger Aero</text>
      <text x="320" y="222" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#e0f2fe">Glass &amp; Aqua Skin for EPL Studio</text>
    </svg>`
  );

const FRUTIGER_AERO_ASSET: StoreAsset = {
  id: 'frutiger-aero',
  title: 'Frutiger Aero',
  description: 'Enable the classic 2000s glass and aqua aesthetic across the entire app.',
  price: 500,
  stock: 'infinite',
  authorId: 'system',
  authorName: 'EPL Studio',
  type: 'style',
  content: '{"theme": "frutiger-aero"}',
  coverUrl: FRUTIGER_AERO_COVER,
  createdAt: '2024-01-01T00:00:00.000Z',
  visits: 0,
};

export default function AssetStoreView() {
  const theme = useStore((state) => state.theme);
  const userData = useStore((state) => state.userData);
  const language = useStore((state) => state.language);
  const simulatedRole = useStore((state) => state.simulatedRole);
  const actualRole = userData?.role || 'user';
  const effectiveRole = actualRole === 'developer' && simulatedRole ? simulatedRole : actualRole;
  const isFrutigerAero = useStore((state) => state.isFrutigerAero);
  const setIsFrutigerAero = useStore((state) => state.setIsFrutigerAero);
  const setIsAuthModalOpen = useStore((state) => state.setIsAuthModalOpen);
  const [assets, setAssets] = useState<StoreAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'style' | 'mod' | 'editor' | 'inventory'>('all');
  const [activeSection, setActiveSection] = useState<'all' | 'featured' | 'recent'>('all');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const isLight = theme === 'light' && !isFrutigerAero;

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'assets'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const assetsData = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as StoreAsset));
        setAssets(assetsData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching assets', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handlePurchase = async (asset: StoreAsset) => {
    if (!userData || !userData.uid) {
      setIsAuthModalOpen(true);
      return;
    }

    setPurchasing(asset.id);
    try {
      if (asset.id !== 'frutiger-aero') {
        await updateDoc(doc(db, 'assets', asset.id), {
          visits: increment(1),
        }).catch(() => {});
      }

      const userRef = doc(db, 'users', userData.uid);
      const currentPurchased = Array.isArray(userData.purchasedItems) ? userData.purchasedItems : [];

      if (currentPurchased.includes(asset.id)) {
        notify.info(language === 'ru' ? 'Вы уже владеете этим ассетом' : 'You already own this asset!');
        return;
      }

      const isFree = effectiveRole === 'admin';
      const priceToPay = isFree ? 0 : asset.price;

      if (userData.eplCoins < priceToPay) {
        notify.error(language === 'ru' ? 'Недостаточно EPLCoins!' : 'Not enough EPLCoins!');
        return;
      }

      await updateDoc(userRef, {
        eplCoins: increment(-priceToPay),
        purchasedItems: [...currentPurchased, asset.id],
      });

      if (asset.stock !== 'infinite') {
        const assetRef = doc(db, 'assets', asset.id);
        const currentStock = typeof asset.stock === 'string' ? parseInt(asset.stock, 10) : asset.stock;
        if (currentStock > 0) {
          await updateDoc(assetRef, {
            stock: currentStock - 1,
          });
        }
      }

      if (asset.id === 'frutiger-aero' || asset.title.toLowerCase() === 'frutiger aero') {
        setIsFrutigerAero(true);
      }

      notify.success(language === 'ru' ? 'Ассет успешно приобретён!' : 'Asset purchased successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userData.uid}`);
      notify.error(language === 'ru' ? 'Ошибка при покупке ассета' : 'Error purchasing asset');
    } finally {
      setPurchasing(null);
    }
  };

  const allAssets = [
    FRUTIGER_AERO_ASSET,
    ...assets.filter(
      (a) => a && a.id !== 'frutiger-aero' && (a.title ? a.title.toLowerCase() !== 'frutiger aero' : true)
    ),
  ];

  const filteredAssets = allAssets
    .filter((asset) => {
      if (!asset) return false;
      const title = (asset.title || '').toLowerCase();
      const desc = (asset.description || '').toLowerCase();
      const queryText = search.toLowerCase();
      const matchesSearch = title.includes(queryText) || desc.includes(queryText);
      const matchesTab = activeTab === 'all' || asset.type === activeTab;

      if (activeSection === 'featured') {
        return matchesSearch && matchesTab && asset.status === 'verified' && (asset.visits || 0) > 10;
      }
      if (activeSection === 'recent') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        return matchesSearch && matchesTab && new Date(asset.createdAt || 0) > oneWeekAgo;
      }

      return matchesSearch && matchesTab;
    })
    .sort((a, b) => {
      if (activeSection === 'recent') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (activeSection === 'featured') {
        return (b.visits || 0) - (a.visits || 0);
      }
      return 0;
    });

  const canPublish =
    userData?.role === 'admin' || userData?.role === 'developer' || userData?.role === 'shopkeeper';

  return (
    <div className="h-full flex flex-col overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={clsx(
                'w-10 h-10 rounded-lg border flex items-center justify-center shrink-0',
                isFrutigerAero
                  ? 'bg-white/60 border-white text-[#0284c7]'
                  : isLight
                  ? 'bg-white border-[#E2E5EA] text-[#059669]'
                  : 'bg-[#181B20] border-[#262B33] text-[#10B981]'
              )}
            >
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Asset Store</h1>
              <p className="text-sm opacity-70">
                {language === 'ru'
                  ? 'Стили оформления, моды, модули редактора и объекты'
                  : 'UI themes, editor modules, mods, and scene inventory'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-mono-num font-semibold',
                isFrutigerAero
                  ? 'bg-white/60 border-white text-[#062038]'
                  : isLight
                  ? 'bg-white border-[#E2E5EA] text-[#111315]'
                  : 'bg-[#181B20] border-[#262B33] text-[#F3F4F6]'
              )}
            >
              <Coins className="w-4 h-4 text-[#D97706]" />
              <span>{userData?.eplCoins || 0} Coins</span>
            </div>

            {canPublish && (
              <button
                onClick={() => setShowPublishModal(true)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap',
                  isFrutigerAero
                    ? 'frutiger-aero-button'
                    : 'bg-[#10B981] hover:bg-[#059669] text-[#09120E]'
                )}
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'ru' ? 'Опубликовать' : 'Publish'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Search + Filter Controls */}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <input
              type="text"
              placeholder={language === 'ru' ? 'Поиск ассетов...' : 'Search assets...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={clsx(
                'w-full pl-9 pr-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2',
                isFrutigerAero
                  ? 'bg-white/60 border-white text-[#062038]'
                  : isLight
                  ? 'bg-white border-[#E2E5EA] text-[#111315] focus:ring-[#059669]/40'
                  : 'bg-[#181B20] border-[#262B33] text-[#F3F4F6] focus:ring-[#10B981]/40'
              )}
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {['all', 'featured', 'recent'].map((section) => (
              <button
                key={section}
                onClick={() => setActiveSection(section as any)}
                className={clsx(
                  'px-3 py-2 rounded-lg text-xs font-medium capitalize border transition-colors whitespace-nowrap shrink-0',
                  activeSection === section
                    ? isFrutigerAero
                      ? 'frutiger-aero-button'
                      : 'bg-[#10B981] text-[#09120E] border-[#10B981] font-semibold'
                    : isLight
                    ? 'bg-white border-[#E2E5EA] text-[#4B5563]'
                    : 'bg-[#181B20] border-[#262B33] text-[#9CA3AF]'
                )}
              >
                {(translations[language] as any)[section] || section}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {['all', 'style', 'mod', 'editor', 'inventory'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={clsx(
                  'px-3 py-2 rounded-lg text-xs font-medium capitalize border transition-colors whitespace-nowrap shrink-0',
                  activeTab === tab
                    ? isLight
                      ? 'bg-[#111315] text-white border-[#111315]'
                      : 'bg-[#262B33] text-[#F3F4F6] border-[#374151]'
                    : isLight
                    ? 'bg-white border-[#E2E5EA] text-[#4B5563]'
                    : 'bg-[#181B20] border-[#262B33] text-[#9CA3AF]'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-20 text-[#10B981]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-current border-t-transparent" />
          </div>
        ) : filteredAssets.length === 0 ? (
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
            <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-35" />
            <h3 className="text-base font-semibold mb-1">No assets found</h3>
            <p className="text-sm opacity-70">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredAssets.map((asset) => {
              if (!asset) return null;
              const assetId = asset.id;
              const hasPurchased = userData?.purchasedItems?.includes(assetId);
              const isOutOfStock =
                asset.stock !== 'infinite' &&
                (typeof asset.stock === 'string' ? parseInt(asset.stock, 10) : asset.stock) <= 0;
              const assetTitle = asset.title || (language === 'ru' ? 'Без названия' : 'Untitled Asset');
              const assetDesc = asset.description || '';
              const assetType = asset.type || 'style';
              const assetPrice = typeof asset.price === 'number' ? asset.price : 0;

              return (
                <article
                  key={assetId}
                  className={clsx(
                    'rounded-xl border overflow-hidden flex flex-col transition-colors',
                    isFrutigerAero
                      ? 'frutiger-aero-glass'
                      : isLight
                      ? 'bg-white border-[#E2E5EA] hover:border-[#D1D5DB]'
                      : 'bg-[#181B20] border-[#262B33] hover:border-[#374151]'
                  )}
                >
                  <div
                    className={clsx(
                      'aspect-[16/9] w-full border-b overflow-hidden flex items-center justify-center',
                      isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
                    )}
                  >
                    {asset.coverUrl ? (
                      <img
                        src={asset.coverUrl}
                        alt={assetTitle}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <ShoppingBag className="w-10 h-10 opacity-25" />
                    )}
                  </div>

                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h3 className="font-semibold text-base line-clamp-1">{assetTitle}</h3>
                      <span className="text-[11px] font-mono uppercase tracking-wider opacity-65 shrink-0">
                        {assetType}
                      </span>
                    </div>

                    <p className="text-sm opacity-75 mb-4 line-clamp-2 flex-1">{assetDesc}</p>

                    <div
                      className={clsx(
                        'flex items-center justify-between pt-3 border-t text-xs',
                        isLight ? 'border-[#E2E5EA]' : 'border-[#262B33]'
                      )}
                    >
                      <div className="font-mono-num">
                        <div className="font-semibold text-[#D97706] flex items-center gap-1 text-sm">
                          <Coins className="w-3.5 h-3.5" />
                          <span>{effectiveRole === 'admin' ? 0 : assetPrice}</span>
                        </div>
                        <div className="opacity-60 mt-0.5">
                          {asset.visits || 0} {language === 'ru' ? 'визитов' : 'visits'} ·{' '}
                          {asset.stock === 'infinite' ? '∞' : `${asset.stock ?? 0} left`}
                        </div>
                      </div>

                      {hasPurchased ? (
                        <button
                          disabled
                          className={clsx(
                            'px-3.5 py-2 rounded-lg text-xs font-semibold border flex items-center gap-1.5 text-[#10B981]',
                            isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
                          )}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Owned</span>
                        </button>
                      ) : isOutOfStock ? (
                        <button
                          disabled
                          className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/30"
                        >
                          Out of Stock
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePurchase(asset)}
                          disabled={purchasing === asset.id || (userData?.eplCoins || 0) < assetPrice}
                          className={clsx(
                            'px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap',
                            isFrutigerAero
                              ? 'frutiger-aero-button'
                              : 'bg-[#10B981] hover:bg-[#059669] text-[#09120E]'
                          )}
                        >
                          {purchasing === asset.id ? 'Purchasing...' : 'Purchase'}
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

      {showPublishModal && <PublishModal onClose={() => setShowPublishModal(false)} />}
    </div>
  );
}

function PublishModal({ onClose }: { onClose: () => void }) {
  const theme = useStore((state) => state.theme);
  const userData = useStore((state) => state.userData);
  const language = useStore((state) => state.language);
  const isFrutigerAero = useStore((state) => state.isFrutigerAero);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState(10);
  const [stock, setStock] = useState<string | number>('infinite');
  const [type, setType] = useState<'style' | 'mod' | 'editor' | 'inventory'>('style');
  const [content, setContent] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [userApps, setUserApps] = useState<any[]>([]);
  const [fetchingApps, setFetchingApps] = useState(false);
  const [showAppSelector, setShowAppSelector] = useState(false);

  const isLight = theme === 'light' && !isFrutigerAero;

  const fetchUserApps = async () => {
    if (!userData?.uid) return;
    setFetchingApps(true);
    setShowAppSelector(true);
    setShowCodeInput(false);
    try {
      const q = query(collection(db, 'apps'), where('authorId', '==', userData.uid));
      const snapshot = await getDocs(q);
      const appsData = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setUserApps(appsData);
    } catch (error) {
      console.error('Error fetching user apps:', error);
    } finally {
      setFetchingApps(false);
    }
  };

  const handlePublish = async () => {
    if (!title || !description || !content || !userData?.uid) return;

    setPublishing(true);
    const newAssetRef = doc(collection(db, 'assets'));
    try {
      const newAsset: StoreAsset = {
        id: newAssetRef.id,
        title,
        description,
        price: isFree ? 0 : price,
        stock: stock === 'infinite' ? 'infinite' : (typeof stock === 'string' ? parseInt(stock, 10) : stock) || 0,
        type,
        content,
        coverUrl,
        authorId: userData.uid,
        authorName: userData.name || 'Unknown',
        createdAt: new Date().toISOString(),
        visits: 0,
      };

      await setDoc(newAssetRef, newAsset);
      onClose();
      notify.success(language === 'ru' ? 'Ассет опубликован!' : 'Asset published!');
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.WRITE, `assets/${newAssetRef.id}`);
      notify.error(
        language === 'ru' ? `Ошибка при публикации: ${errInfo.error}` : `Error publishing asset: ${errInfo.error}`
      );
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
      <div
        className={clsx(
          'w-full max-w-2xl rounded-xl p-6 border shadow-2xl max-h-[90vh] overflow-y-auto',
          isFrutigerAero
            ? 'frutiger-aero-glass'
            : isLight
            ? 'bg-white border-[#E2E5EA] text-[#111315]'
            : 'bg-[#181B20] border-[#262B33] text-[#F3F4F6]'
        )}
      >
        <h2 className="text-xl font-bold mb-5">Publish New Asset</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 opacity-70">Asset Type</label>
            <div className="flex gap-2 flex-wrap">
              {['style', 'mod', 'editor', 'inventory'].map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t as any)}
                  className={clsx(
                    'flex-1 py-2 rounded-lg text-sm font-medium capitalize border transition-colors',
                    type === t
                      ? 'bg-[#10B981] border-[#10B981] text-[#09120E] font-semibold'
                      : isLight
                      ? 'bg-[#F5F6F8] border-[#E2E5EA] text-[#4B5563]'
                      : 'bg-[#111315] border-[#262B33] text-[#9CA3AF]'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2',
                isLight
                  ? 'bg-[#F5F6F8] border-[#E2E5EA] focus:ring-[#059669]/40'
                  : 'bg-[#111315] border-[#262B33] focus:ring-[#10B981]/40'
              )}
              placeholder="e.g., Graphite Shader Pack"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 min-h-[90px]',
                isLight
                  ? 'bg-[#F5F6F8] border-[#E2E5EA] focus:ring-[#059669]/40'
                  : 'bg-[#111315] border-[#262B33] focus:ring-[#10B981]/40'
              )}
              placeholder="Describe your asset..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Price</label>
              <div
                className={clsx(
                  'flex rounded-lg p-1 mb-2 border',
                  isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
                )}
              >
                <button
                  onClick={() => setIsFree(true)}
                  className={clsx(
                    'flex-1 py-1 rounded text-xs font-semibold transition-colors',
                    isFree ? 'bg-[#10B981] text-[#09120E]' : 'opacity-70'
                  )}
                >
                  Free
                </button>
                <button
                  onClick={() => setIsFree(false)}
                  className={clsx(
                    'flex-1 py-1 rounded text-xs font-semibold transition-colors',
                    !isFree ? 'bg-[#10B981] text-[#09120E]' : 'opacity-70'
                  )}
                >
                  Paid
                </button>
              </div>
              {!isFree && (
                <input
                  type="number"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(parseInt(e.target.value, 10) || 0)}
                  className={clsx(
                    'w-full px-3 py-2 rounded-lg border text-sm focus:outline-none',
                    isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
                  )}
                  placeholder="EPLCoins"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Stock</label>
              <div className="flex gap-2">
                <input
                  type={stock === 'infinite' ? 'text' : 'number'}
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  disabled={stock === 'infinite'}
                  className={clsx(
                    'w-full px-3 py-2 rounded-lg border text-sm focus:outline-none',
                    stock === 'infinite' && 'opacity-50',
                    isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
                  )}
                />
                <button
                  onClick={() => setStock(stock === 'infinite' ? '100' : 'infinite')}
                  className={clsx(
                    'px-3 py-2 rounded-lg text-xs font-semibold border whitespace-nowrap',
                    stock === 'infinite'
                      ? 'bg-[#10B981] border-[#10B981] text-[#09120E]'
                      : isLight
                      ? 'border-[#E2E5EA]'
                      : 'border-[#262B33]'
                  )}
                >
                  Infinite
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">Cover Image URL (Optional)</label>
            <input
              type="text"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border text-sm focus:outline-none',
                isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
              )}
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">Content (EPL Code or JSON)</label>
            {showAppSelector ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>Select an app to import code from:</span>
                  <button
                    onClick={() => {
                      setShowAppSelector(false);
                      setShowCodeInput(true);
                    }}
                    className="text-[#10B981] hover:underline"
                  >
                    Enter Manually
                  </button>
                </div>
                {fetchingApps ? (
                  <div className="p-3 text-center text-xs opacity-60">Loading apps...</div>
                ) : userApps.length === 0 ? (
                  <div className="p-3 text-center text-xs opacity-60">No apps found.</div>
                ) : (
                  <div className="max-h-44 overflow-y-auto space-y-1.5">
                    {userApps.map((app) => (
                      <button
                        key={app.id}
                        onClick={() => {
                          let codeStr = app.code || '';
                          if (app.components && app.components.length > 0) {
                            codeStr += '\n' + app.components.map((c: any) => c.code).join('\n');
                          }
                          setContent(codeStr);
                          setShowAppSelector(false);
                          setShowCodeInput(true);
                        }}
                        className={clsx(
                          'w-full text-left px-3 py-2 rounded-lg border text-sm flex items-center justify-between',
                          isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
                        )}
                      >
                        <span className="font-medium">{app.title || 'Untitled App'}</span>
                        <span className="text-xs opacity-60">Select</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : showCodeInput ? (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className={clsx(
                  'w-full px-3 py-2 rounded-lg border min-h-[140px] font-mono text-xs focus:outline-none',
                  isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
                )}
                placeholder="Paste your EPL code here..."
              />
            ) : content ? (
              <div
                className={clsx(
                  'w-full px-3 py-2 rounded-lg border font-mono text-xs flex items-center justify-between',
                  isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]'
                )}
              >
                <span>EPL Code Added ({content.length} chars)</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowCodeInput(true)} className="text-[#10B981]">
                    Edit
                  </button>
                  <button onClick={() => setContent('')} className="text-[#DC2626]">
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={fetchUserApps}
                className={clsx(
                  'w-full px-4 py-3 rounded-lg border border-dashed text-sm font-medium',
                  isLight ? 'border-[#D1D5DB] hover:bg-[#F5F6F8]' : 'border-[#374151] hover:bg-[#20242B]'
                )}
              >
                Import from My Apps or Enter EPL Code
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium border',
              isLight ? 'border-[#E2E5EA]' : 'border-[#262B33]'
            )}
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || !title || !description || !content}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-[#09120E]"
          >
            {publishing ? 'Publishing...' : 'Publish Asset'}
          </button>
        </div>
      </div>
    </div>
  );
}
