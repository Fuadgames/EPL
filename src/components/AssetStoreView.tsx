import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { translations } from '../lib/translations';
import { clsx } from 'clsx';
import { ShoppingBag, Plus, Search, Coins, CheckCircle, Package } from 'lucide-react';
import { collection, query, onSnapshot, doc, updateDoc, increment, getDoc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { db } from '../firebase';
import { StoreAsset } from '../types';

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
  coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop',
  createdAt: '2024-01-01T00:00:00.000Z',
  visits: 0
};

export default function AssetStoreView() {
  const theme = useStore(state => state.theme);
  const userData = useStore(state => state.userData);
  const language = useStore(state => state.language);
  const simulatedRole = useStore(state => state.simulatedRole);
  const effectiveRole = (userData?.role === 'developer' && simulatedRole) ? simulatedRole : userData?.role;
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const setIsFrutigerAero = useStore(state => state.setIsFrutigerAero);
  const setIsAuthModalOpen = useStore(state => state.setIsAuthModalOpen);
  const [assets, setAssets] = useState<StoreAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'style' | 'mod' | 'editor'>('all');
  const [activeSection, setActiveSection] = useState<'all' | 'featured' | 'recent'>('all');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'assets'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const assetsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoreAsset));
      setAssets(assetsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching assets", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handlePurchase = async (asset: StoreAsset) => {
    if (!userData || !userData.uid) {
      setIsAuthModalOpen(true);
      return;
    }

    setPurchasing(asset.id);
    try {
      // Increment visits only for assets that exist in Firestore
      if (asset.id !== 'frutiger-aero') {
        try {
          await updateDoc(doc(db, 'assets', asset.id), {
            visits: increment(1)
          });
        } catch (e) {
          // Ignore visit increment errors
        }
      }

      const userRef = doc(db, 'users', userData.uid);
      
      // Deduct coins and add to purchased items
      const currentPurchased = Array.isArray(userData.purchasedItems) ? userData.purchasedItems : [];
      
      if (currentPurchased.includes(asset.id)) {
        console.log(language === 'ru' ? "Вы уже купили этот ассет!" : "You already owned this asset!");
        return;
      }

      const isFree = effectiveRole === 'admin';
      const priceToPay = isFree ? 0 : asset.price;

      if (userData.eplCoins < priceToPay) {
        console.warn(language === 'ru' ? "Недостаточно EPLCoins!" : "Not enough EPLCoins!");
        return;
      }

      await updateDoc(userRef, {
        eplCoins: increment(-priceToPay),
        purchasedItems: [...currentPurchased, asset.id]
      });

      // Update stock if not infinite
      if (asset.stock !== 'infinite') {
        const assetRef = doc(db, 'assets', asset.id);
        const currentStock = typeof asset.stock === 'string' ? parseInt(asset.stock) : asset.stock;
        if (currentStock > 0) {
          await updateDoc(assetRef, {
            stock: currentStock - 1
          });
        }
      }

      // If it's Frutiger Aero, enable it
      if (asset.id === 'frutiger-aero' || asset.title.toLowerCase() === 'frutiger aero') {
        setIsFrutigerAero(true);
      }

      console.log(language === 'ru' ? "Покупка прошла успешно!" : "Purchase successful!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.WRITE, `users/${userData.uid}`);
      console.error("Error purchasing asset", error);
    } finally {
      setPurchasing(null);
    }
  };

  const allAssets = [
    FRUTIGER_AERO_ASSET,
    ...assets.filter(a => a.id !== 'frutiger-aero' && a.title.toLowerCase() !== 'frutiger aero')
  ];

  const filteredAssets = allAssets.filter(asset => {
    const matchesSearch = asset.title.toLowerCase().includes(search.toLowerCase()) || asset.description.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'all' || asset.type === activeTab;
    
    if (activeSection === 'featured') {
      return matchesSearch && matchesTab && asset.status === 'verified' && (asset.visits || 0) > 10;
    }
    if (activeSection === 'recent') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return matchesSearch && matchesTab && new Date(asset.createdAt) > oneWeekAgo;
    }
    
    return matchesSearch && matchesTab;
  }).sort((a, b) => {
    if (activeSection === 'recent') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (activeSection === 'featured') return (b.visits || 0) - (a.visits || 0);
    return 0;
  });

  const canPublish = userData?.role === 'admin' || userData?.role === 'developer' || userData?.role === 'shopkeeper';

  return (
    <div className={clsx("h-full flex flex-col p-4 sm:p-8 overflow-y-auto", isFrutigerAero ? "bg-gradient-to-br from-cyan-100 to-blue-200" : "")}>
      <div className="max-w-6xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <h1 className={clsx("text-3xl font-bold tracking-tight flex items-center gap-3", isFrutigerAero ? "text-blue-800" : "")}>
            <ShoppingBag className={clsx("w-8 h-8", isFrutigerAero ? "text-blue-500" : "text-emerald-500")} />
            Asset Store
          </h1>
          
          <div className="flex items-center gap-4">
            <div className={clsx("flex items-center gap-2 px-4 py-2 rounded-xl font-bold", isFrutigerAero ? "bg-white/50 text-blue-800 backdrop-blur-md border border-white/40 shadow-sm" : theme !== 'light' ? "bg-zinc-800 text-emerald-400" : "bg-emerald-100 text-emerald-600")}>
              <Coins className="w-5 h-5" />
              {userData?.eplCoins || 0} EPLCoins
            </div>
            {canPublish && (
              <button
                onClick={() => setShowPublishModal(true)}
                className={clsx("flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors", isFrutigerAero ? "bg-blue-500 hover:bg-blue-600 text-white shadow-md" : "bg-emerald-500 hover:bg-emerald-600 text-white")}
              >
                <Plus className="w-5 h-5" />
                Publish
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={clsx(
                "w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2",
                isFrutigerAero ? "bg-white/60 border-white/40 text-blue-900 placeholder-blue-400 focus:ring-blue-400 backdrop-blur-md shadow-inner" : theme !== 'light' ? 'bg-zinc-900 border-zinc-800 text-zinc-100 focus:ring-emerald-500' : 'bg-white border-zinc-200 text-zinc-900 focus:ring-emerald-500'
              )}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 sm:pb-0">
            {['all', 'featured', 'recent'].map((section) => (
              <button
                key={section}
                onClick={() => setActiveSection(section as any)}
                className={clsx(
                  "px-4 py-2 rounded-xl font-medium capitalize whitespace-nowrap transition-colors",
                  activeSection === section 
                    ? isFrutigerAero ? 'bg-blue-500 text-white shadow-md' : 'bg-emerald-500 text-white' 
                    : isFrutigerAero ? 'bg-white/40 text-blue-800 hover:bg-white/60 backdrop-blur-sm' : theme !== 'light' ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
                )}
              >
                {translations[language][section as keyof typeof translations['en']] || section}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 sm:pb-0">
            {['all', 'style', 'mod', 'editor'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={clsx(
                  "px-4 py-2 rounded-xl font-medium capitalize whitespace-nowrap transition-colors",
                  activeTab === tab 
                    ? isFrutigerAero ? 'bg-blue-500 text-white shadow-md' : 'bg-emerald-500 text-white' 
                    : isFrutigerAero ? 'bg-white/40 text-blue-800 hover:bg-white/60 backdrop-blur-sm' : theme !== 'light' ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className={clsx("animate-spin rounded-full h-8 w-8 border-b-2", isFrutigerAero ? "border-blue-500" : "border-emerald-500")}></div>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="text-center p-12">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold mb-2">No assets found</h3>
            <p className="text-zinc-500">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAssets.map(asset => {
              const hasPurchased = userData?.purchasedItems?.includes(asset.id);
              const isOutOfStock = asset.stock !== 'infinite' && (typeof asset.stock === 'string' ? parseInt(asset.stock) : asset.stock) <= 0;
              
              return (
                <div key={asset.id} className={clsx(
                  "rounded-2xl border overflow-hidden flex flex-col transition-transform hover:scale-[1.02]",
                  isFrutigerAero ? "bg-white/40 border-white/50 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.1)]" : theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'
                )}>
                  {asset.coverUrl ? (
                    <img src={asset.coverUrl} alt={asset.title} className="w-full h-48 object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className={clsx("w-full h-48 flex items-center justify-center", isFrutigerAero ? "bg-gradient-to-br from-blue-200 to-cyan-200" : theme !== 'light' ? "bg-zinc-800" : "bg-zinc-100")}>
                      <Package className="w-12 h-12 opacity-20" />
                    </div>
                  )}
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={clsx("font-bold text-lg line-clamp-1", isFrutigerAero ? "text-blue-900" : "")}>{asset.title}</h3>
                      <span className={clsx("text-xs px-2 py-1 rounded-md capitalize font-medium", isFrutigerAero ? "bg-blue-100 text-blue-700" : theme !== 'light' ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-600")}>
                        {asset.type}
                      </span>
                    </div>
                    <p className={clsx("text-sm mb-4 line-clamp-2 flex-1", isFrutigerAero ? "text-blue-700/80" : "text-zinc-500")}>{asset.description}</p>
                    
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-zinc-500/20">
                      <div className="flex flex-col">
                        <span className={clsx("font-bold flex items-center gap-1", isFrutigerAero ? "text-blue-600" : "text-emerald-500")}>
                          <Coins className="w-4 h-4" /> {effectiveRole === 'admin' ? 0 : asset.price}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {asset.visits || 0} {language === 'ru' ? 'визитов' : 'visits'} • {asset.stock === 'infinite' ? 'Infinite stock' : `${asset.stock} left`}
                        </span>
                      </div>
                      
                      {hasPurchased ? (
                        <button disabled className={clsx("px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2", isFrutigerAero ? "bg-white/50 text-blue-800" : theme !== 'light' ? "bg-zinc-800 text-emerald-500" : "bg-zinc-100 text-emerald-600")}>
                          <CheckCircle className="w-4 h-4" /> Owned
                        </button>
                      ) : isOutOfStock ? (
                        <button disabled className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500/10 text-red-500">
                          Out of Stock
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePurchase(asset)}
                          disabled={purchasing === asset.id || (userData?.eplCoins || 0) < asset.price}
                          className={clsx(
                            "px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2",
                            purchasing === asset.id ? "opacity-50 cursor-not-allowed" : "",
                            (userData?.eplCoins || 0) < asset.price ? "opacity-50 cursor-not-allowed bg-zinc-500 text-white" : isFrutigerAero ? "bg-blue-500 hover:bg-blue-600 text-white shadow-md" : "bg-emerald-500 hover:bg-emerald-600 text-white"
                          )}
                        >
                          {purchasing === asset.id ? 'Purchasing...' : 'Purchase'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showPublishModal && (
        <PublishModal onClose={() => setShowPublishModal(false)} />
      )}
    </div>
  );
}

function PublishModal({ onClose }: { onClose: () => void }) {
  const theme = useStore(state => state.theme);
  const userData = useStore(state => state.userData);
  const language = useStore(state => state.language);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(10);
  const [stock, setStock] = useState('infinite');
  const [type, setType] = useState<'style' | 'mod' | 'editor'>('style');
  const [content, setContent] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [publishing, setPublishing] = useState(false);

  const handlePublish = async () => {
    if (!title || !description || !content || !userData?.uid) return;
    
    setPublishing(true);
    const newAssetRef = doc(collection(db, 'assets'));
    try {
      const newAsset: StoreAsset = {
        id: newAssetRef.id,
        title,
        description,
        price,
        stock: stock === 'infinite' ? 'infinite' : parseInt(stock) || 0,
        type,
        content,
        coverUrl,
        authorId: userData.uid,
        authorName: userData.name || 'Unknown',
        createdAt: new Date().toISOString(),
        visits: 0
      };

      await setDoc(newAssetRef, newAsset);
      onClose();
      alert(language === 'ru' ? "Ассет опубликован!" : "Asset published!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.WRITE, `assets/${newAssetRef.id}`);
      console.error("Error publishing asset", error);
      alert(language === 'ru' ? `Ошибка при публикации: ${errInfo.error}` : `Error publishing asset: ${errInfo.error}`);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={clsx(
        "w-full max-w-2xl rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto",
        isFrutigerAero ? "bg-white/80 backdrop-blur-xl border border-white/50" : theme !== 'light' ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'
      )}>
        <h2 className={clsx("text-2xl font-bold mb-6", isFrutigerAero ? "text-blue-900" : "")}>Publish New Asset</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 opacity-70">Asset Type</label>
            <div className="flex gap-2">
              {['style', 'mod', 'editor'].map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t as any)}
                  className={clsx(
                    "flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-colors",
                    type === t 
                      ? isFrutigerAero ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white' 
                      : isFrutigerAero ? 'bg-white/50 text-blue-800 hover:bg-white/80' : theme !== 'light' ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 opacity-70">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={clsx(
                "w-full px-4 py-2 rounded-xl border focus:outline-none focus:ring-2",
                isFrutigerAero ? "bg-white/60 border-white/40 focus:ring-blue-400" : theme !== 'light' ? 'bg-zinc-800 border-zinc-700 focus:ring-emerald-500' : 'bg-zinc-50 border-zinc-200 focus:ring-emerald-500'
              )}
              placeholder="e.g., Neon Cyberpunk Theme"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 opacity-70">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={clsx(
                "w-full px-4 py-2 rounded-xl border focus:outline-none focus:ring-2 min-h-[100px]",
                isFrutigerAero ? "bg-white/60 border-white/40 focus:ring-blue-400" : theme !== 'light' ? 'bg-zinc-800 border-zinc-700 focus:ring-emerald-500' : 'bg-zinc-50 border-zinc-200 focus:ring-emerald-500'
              )}
              placeholder="Describe your asset..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 opacity-70">Price (EPLCoins)</label>
              <input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
                className={clsx(
                  "w-full px-4 py-2 rounded-xl border focus:outline-none focus:ring-2",
                  isFrutigerAero ? "bg-white/60 border-white/40 focus:ring-blue-400" : theme !== 'light' ? 'bg-zinc-800 border-zinc-700 focus:ring-emerald-500' : 'bg-zinc-50 border-zinc-200 focus:ring-emerald-500'
                )}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 opacity-70">Stock</label>
              <div className="flex gap-2">
                <input
                  type={stock === 'infinite' ? 'text' : 'number'}
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  disabled={stock === 'infinite'}
                  className={clsx(
                    "w-full px-4 py-2 rounded-xl border focus:outline-none focus:ring-2",
                    stock === 'infinite' ? "opacity-50" : "",
                    isFrutigerAero ? "bg-white/60 border-white/40 focus:ring-blue-400" : theme !== 'light' ? 'bg-zinc-800 border-zinc-700 focus:ring-emerald-500' : 'bg-zinc-50 border-zinc-200 focus:ring-emerald-500'
                  )}
                  placeholder="Quantity"
                />
                <button
                  onClick={() => setStock(stock === 'infinite' ? '100' : 'infinite')}
                  className={clsx(
                    "px-4 py-2 rounded-xl font-medium transition-colors whitespace-nowrap",
                    stock === 'infinite' 
                      ? isFrutigerAero ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white'
                      : isFrutigerAero ? 'bg-white/50 text-blue-800' : theme !== 'light' ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
                  )}
                >
                  Infinite
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 opacity-70">Cover Image URL (Optional)</label>
            <input
              type="text"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              className={clsx(
                "w-full px-4 py-2 rounded-xl border focus:outline-none focus:ring-2",
                isFrutigerAero ? "bg-white/60 border-white/40 focus:ring-blue-400" : theme !== 'light' ? 'bg-zinc-800 border-zinc-700 focus:ring-emerald-500' : 'bg-zinc-50 border-zinc-200 focus:ring-emerald-500'
              )}
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 opacity-70">Content (EPL Code or JSON)</label>
            {content ? (
              <div className={clsx(
                "w-full px-4 py-2 rounded-xl border font-mono text-sm min-h-[150px] flex items-center justify-between",
                isFrutigerAero ? "bg-white/60 border-white/40" : theme !== 'light' ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-50 border-zinc-200'
              )}>
                <span className="truncate">EPL Code Added</span>
                <button onClick={() => setContent('')} className="text-red-500 hover:text-red-600">Remove</button>
              </div>
            ) : (
              <button
                onClick={() => {
                  // TODO: Implement workflow
                  alert("Workflow not yet implemented");
                }}
                className={clsx(
                  "w-full px-4 py-4 rounded-xl border-2 border-dashed font-medium transition-colors",
                  isFrutigerAero ? "bg-white/30 border-blue-400 text-blue-900 hover:bg-white/50" : theme !== 'light' ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700' : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                )}
              >
                Add EPL Code
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button
            onClick={onClose}
            className={clsx(
              "px-6 py-2 rounded-xl font-medium transition-colors",
              isFrutigerAero ? "bg-white/50 text-blue-800 hover:bg-white/80" : theme !== 'light' ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
            )}
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || !title || !description || !content}
            className={clsx(
              "px-6 py-2 rounded-xl font-medium text-white transition-colors flex items-center gap-2",
              publishing || !title || !description || !content ? "opacity-50 cursor-not-allowed" : "",
              isFrutigerAero ? "bg-blue-500 hover:bg-blue-600 shadow-md" : "bg-emerald-500 hover:bg-emerald-600"
            )}
          >
            {publishing ? 'Publishing...' : 'Publish Asset'}
          </button>
        </div>
      </div>
    </div>
  );
}
