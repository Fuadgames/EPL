import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Package, X, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { notify } from '../store/useDialogStore';
import { collection, query, where, documentId, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { StoreAsset } from '../types';

export default function InventoryModal({ onClose }: { onClose: () => void }) {
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const language = useStore(state => state.language);
  const userData = useStore(state => state.userData);
  const setCodeGlobal = useStore(state => state.setCode);
  const code = useStore(state => state.code);
  const selectedExtraCategory = useStore(state => state.selectedExtraCategory);
  const addSceneNode = useStore(state => state.addSceneNode);

  const [inventoryItems, setInventoryItems] = useState<StoreAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInventory = async () => {
      if (!userData?.purchasedItems || userData.purchasedItems.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const purchasedIds = userData.purchasedItems.slice(0, 30);
        const q = query(collection(db, 'assets'), where(documentId(), 'in', purchasedIds));

        const querySnapshot = await getDocs(q);
        const items = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as StoreAsset))
          .filter(item => item.type === 'inventory');

        setInventoryItems(items);
      } catch (error) {
        console.error('Error fetching inventory items:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInventory();
  }, [userData?.purchasedItems]);

  const handleAddToCode = (item: StoreAsset) => {
    if (selectedExtraCategory === 'PreviewEditing') {
      addSceneNode({
        type: 'Script',
        name: item.title.replace(/\s+/g, '_'),
        properties: {
          scriptContent: item.content,
        },
      });
      notify.success(
        language === 'ru'
          ? `"${item.title}" добавлен как Script-объект на сцену!`
          : `Added "${item.title}" as a Script object to your scene!`
      );
    } else {
      setCodeGlobal(code + '\n' + item.content);
      notify.success(language === 'ru' ? `Сниппет "${item.title}" добавлен в код` : `Added "${item.title}" to code`);
    }
    onClose();
  };

  const isDark = theme !== 'light' && !isFrutigerAero;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
      <div
        className={clsx(
          'w-full max-w-lg rounded-xl p-6 shadow-2xl max-h-[90vh] flex flex-col border',
          isFrutigerAero
            ? 'frutiger-aero-glass border-white/60 text-blue-950'
            : isDark
            ? 'bg-[#181B20] border-[#262B33] text-[#F1F3F5]'
            : 'bg-white border-[#E2E5EA] text-[#111315]'
        )}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <Package className={clsx('w-5 h-5', isFrutigerAero ? 'text-blue-600' : 'text-[#10B981]')} />
            <h3 className={clsx('text-lg font-bold', isFrutigerAero ? 'text-blue-950' : '')}>
              {language === 'ru' ? 'Ваш инвентарь' : 'Your Inventory'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className={clsx(
              'p-1.5 rounded-lg transition-colors',
              isFrutigerAero ? 'hover:bg-blue-100/50 text-blue-900' : isDark ? 'hover:bg-[#21252C] text-[#9BA1A6]' : 'hover:bg-[#F5F6F8] text-[#5C636E]'
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 min-h-[280px]">
          {loading ? (
            <div className="h-full flex items-center justify-center py-12">
              <Loader2 className="w-7 h-7 animate-spin text-[#10B981]" />
            </div>
          ) : inventoryItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#9BA1A6]">
              <Package className="w-10 h-10 mb-3 opacity-60" />
              <p className="font-medium text-sm">{language === 'ru' ? 'Инвентарь пуст.' : 'Your inventory is empty.'}</p>
              <p className="text-xs mt-1">
                {language === 'ru'
                  ? 'Покупайте модульные сниппеты в магазине ассетов.'
                  : 'Buy modular items from the Asset Store to see them here.'}
              </p>
            </div>
          ) : (
            inventoryItems.map(item => (
              <div
                key={item.id}
                className={clsx(
                  'p-4 rounded-lg border transition-colors',
                  isFrutigerAero
                    ? 'bg-white/60 border-white/60'
                    : isDark
                    ? 'bg-[#111315] border-[#262B33]'
                    : 'bg-[#F5F6F8] border-[#E2E5EA]'
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={clsx(
                      'p-2 rounded-lg border',
                      isFrutigerAero ? 'bg-blue-100 border-blue-200' : 'bg-[#10B981]/10 border-[#10B981]/30'
                    )}
                  >
                    <Package className={clsx('w-4 h-4', isFrutigerAero ? 'text-blue-600' : 'text-[#10B981]')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm truncate">{item.title}</h4>
                    <p className={clsx('text-xs truncate', isDark ? 'text-[#9BA1A6]' : 'text-[#5C636E]')}>
                      {item.description}
                    </p>
                  </div>
                </div>

                <div
                  className={clsx(
                    'flex items-center justify-between gap-3 pt-2.5 border-t',
                    isDark ? 'border-[#262B33]' : 'border-[#E2E5EA]'
                  )}
                >
                  <span className="text-[10px] font-mono text-[#9BA1A6] uppercase tracking-wider">EPL Snippet</span>
                  <button
                    onClick={() => handleAddToCode(item)}
                    className={clsx(
                      'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap',
                      isFrutigerAero
                        ? 'frutiger-aero-button text-white'
                        : 'bg-[#10B981] hover:bg-[#059669] text-[#111315]'
                    )}
                  >
                    {language === 'ru' ? 'Добавить в код' : 'Add to Code'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={clsx('mt-4 pt-3 border-t text-center', isDark ? 'border-[#262B33]' : 'border-[#E2E5EA]')}>
          <p className="text-[11px] text-[#9BA1A6]">
            {language === 'ru'
              ? 'Элементы из инвентаря добавляются в конец кода.'
              : 'Items added from inventory appear at the bottom of your code.'}
          </p>
        </div>
      </div>
    </div>
  );
}
