import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Package, X, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { collection, query, where, documentId, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { StoreAsset } from '../types';

export default function InventoryModal({ onClose }: { onClose: () => void }) {
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const userData = useStore(state => state.userData);
  const setCodeGlobal = useStore(state => state.setCode);
  const code = useStore(state => state.code);
  
  const [inventoryItems, setInventoryItems] = useState<StoreAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInventory = async () => {
      if (!userData?.purchasedItems || userData.purchasedItems.length === 0) {
        setLoading(false);
        return;
      }

      try {
        // Firestore 'in' query supports up to 30 elements
        // For simplicity, we'll take the first 30 or implement chunking if needed
        const purchasedIds = userData.purchasedItems.slice(0, 30);
        const q = query(
          collection(db, 'assets'),
          where(documentId(), 'in', purchasedIds)
        );
        
        const querySnapshot = await getDocs(q);
        const items = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as StoreAsset))
          .filter(item => item.type === 'inventory');
          
        setInventoryItems(items);
      } catch (error) {
        console.error("Error fetching inventory items:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInventory();
  }, [userData?.purchasedItems]);

  const handleAddToCode = (itemCode: string) => {
    setCodeGlobal(code + '\n' + itemCode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={clsx(
        "w-full max-w-lg rounded-2xl p-6 shadow-2xl max-h-[90vh] flex flex-col",
        isFrutigerAero ? "bg-white/80 border border-white/50 backdrop-blur-md" :
        theme !== 'light' ? 'bg-zinc-900 border border-zinc-800 text-zinc-100' : 'bg-white border border-zinc-200 text-zinc-900'
      )}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Package className={clsx("w-6 h-6", isFrutigerAero ? "text-blue-500" : "text-emerald-500")} />
            <h3 className={clsx("text-xl font-bold", isFrutigerAero ? "text-blue-900" : "")}>Your Inventory</h3>
          </div>
          <button 
            onClick={onClose} 
            className={clsx(
              "p-2 rounded-lg transition-colors",
              isFrutigerAero ? "hover:bg-blue-100/50 text-blue-900" : "hover:bg-zinc-800"
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 min-h-[300px]">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin opacity-50" />
            </div>
          ) : inventoryItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
              <Package className="w-12 h-12 mb-4" />
              <p>Your inventory is empty.</p>
              <p className="text-sm">Buy modular items from the Asset Store to see them here!</p>
            </div>
          ) : (
            inventoryItems.map(item => (
              <div 
                key={item.id} 
                className={clsx(
                  "p-4 rounded-xl border transition-all hover:scale-[1.01]",
                  isFrutigerAero ? "bg-white/50 border-white/60 shadow-sm" : "bg-zinc-800/40 border-zinc-inter-800/60"
                )}
              >
                <div className="flex items-center gap-4 mb-3">
                  <div className={clsx("p-2 rounded-lg", isFrutigerAero ? "bg-blue-100" : "bg-emerald-500/10")}>
                    <Package className={clsx("w-5 h-5", isFrutigerAero ? "text-blue-600" : "text-emerald-500")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold truncate">{item.title}</h4>
                    <p className="text-xs opacity-60 truncate">{item.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-current/10">
                  <span className="text-[10px] font-mono opacity-40 uppercase tracking-wider">EPL Snippet</span>
                  <button 
                    onClick={() => handleAddToCode(item.content)}
                    className={clsx(
                      "px-4 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95",
                      isFrutigerAero ? "bg-blue-500 hover:bg-blue-600 text-white shadow-md" : "bg-emerald-600 hover:bg-emerald-500 text-white"
                    )}
                  >
                    Add to Code
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="mt-6 pt-4 border-t border-current/10 text-center">
          <p className="text-[10px] opacity-40 italic">Items added from inventory will appear at the bottom of your code.</p>
        </div>
      </div>
    </div>
  );
}
