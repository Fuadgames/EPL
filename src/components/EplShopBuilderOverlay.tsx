import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import {
  handleFirestoreError,
  OperationType,
  sanitizeFirestoreData,
} from '../lib/firestore-utils';
import { useStore, type View } from '../store/useStore';
import { notify } from '../store/useDialogStore';
import {
  EplCustomWidget,
  EplShopItem,
  EplSiteCustomizationSpec,
} from '../types';
import {
  EPL_SHOP_STARTER_PRESETS,
  renderShopSpecSnapshot,
} from '../lib/siteSpecRenderer';
import {
  Palette,
  Layers,
  Code2,
  Eye,
  EyeOff,
  Check,
  X,
  Plus,
  Trash2,
  MousePointer2,
  MousePointerClick,
  PlusSquare,
  SlidersHorizontal,
  Upload,
  Infinity as InfinityIcon,
  RotateCcw,
  Move,
  EyeOff as HideIcon,
  Copy,
} from 'lucide-react';
import { clsx } from 'clsx';

type BuilderTool = 'select' | 'add' | 'tap';
type InspectorTab = 'element' | 'site' | 'nav';

interface SelectedDomTarget {
  key: string;
  tag: string;
  label: string;
}

interface RectBox {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  kind: 'dom' | 'widget';
  keyOrId: string;
}

const DEFAULT_EPL_WIDGET_SAMPLE = `started?
  create background { color=#0b1220 }
  create text_label { name=t1, text="Custom EPL Module Active!", x=24, y=20, color=#10b981, size=20 }
  create block { name=box1, x=24, y=64, width=180, height=48, color=#38bdf8, corner=10 }
  create button { name=act, text="Click Me!", x=220, y=68, width=130, height=40, color=#f59e0b }
  create particle { name=fx, x=380, y=88, color=#10b981, count=12 }
end

clicked? { target=act }
  play_sound { sound=coin, volume=0.4 }
  move { target=box1, x=20, y=0 }
end`;

const SELECTABLE_DOM_SELECTOR = 'button, a, h1, h2, h3, [data-epl-key]';

function getDomElementKey(el: HTMLElement): string | null {
  if (el.dataset.eplOrigKey) return el.dataset.eplOrigKey;
  const explicit = el.getAttribute('data-epl-key');
  if (explicit) {
    el.dataset.eplOrigKey = explicit;
    return explicit;
  }
  const raw = (el.textContent || '').trim().slice(0, 42).replace(/\s+/g, ' ');
  if (!raw) return null;
  const computed = `${el.tagName.toLowerCase()}:${raw}`;
  el.dataset.eplOrigKey = computed;
  return computed;
}

function getElementCurrentText(el: HTMLElement): string {
  const txt = (el.textContent || '').trim().replace(/\s+/g, ' ');
  return txt.slice(0, 60) || el.tagName.toLowerCase();
}

function rectsIntersect(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number }
) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export default function EplShopBuilderOverlay() {
  const isOpen = useStore((s) => s.isEplShopBuilderOpen);
  const previewMode = useStore((s) => s.eplShopPreviewMode);
  const setPreviewMode = useStore((s) => s.setEplShopPreviewMode);
  const closeBuilder = useStore((s) => s.closeEplShopBuilder);
  const draftSpec = useStore((s) => s.draftEplShopSpec);
  const updateDraft = useStore((s) => s.updateDraftEplShopSpec);
  const editingItemId = useStore((s) => s.editingShopItemId);
  const editingItem = useStore((s) => s.editingShopItem);
  const selectedWidgetId = useStore((s) => s.selectedBuilderWidgetId);
  const setSelectedWidgetId = useStore((s) => s.setSelectedBuilderWidgetId);
  const currentView = useStore((s) => s.currentView);
  const setCurrentView = useStore((s) => s.setCurrentView);
  const user = useStore((s) => s.user);
  const userData = useStore((s) => s.userData);
  const language = useStore((s) => s.language);
  const theme = useStore((s) => s.theme);
  const isFrutigerAero = useStore((s) => s.isFrutigerAero);

  const isLight = theme === 'light' && !isFrutigerAero;

  // Tool & Inspector state
  const tool = useStore((s) => s.eplShopBuilderTool);
  const setTool = useStore((s) => s.setEplShopBuilderTool);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('element');
  const [pendingAddKind, setPendingAddKind] = useState<EplCustomWidget['kind']>('button');

  // Selected DOM elements (supporting single click & rectangle marquee multi-selection)
  const [selectedDomTargets, setSelectedDomTargets] = useState<SelectedDomTarget[]>([]);
  const [hoveredBox, setHoveredBox] = useState<RectBox | null>(null);
  const [selectedBoxes, setSelectedBoxes] = useState<RectBox[]>([]);
  const [marqueeRect, setMarqueeRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  // Category & Custom Tab creation form
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatColor, setNewCatColor] = useState('#10B981');
  const [newTabLabel, setNewTabLabel] = useState('');
  const [newTabCat, setNewTabCat] = useState('store');
  const [newTabColor, setNewTabColor] = useState('#38BDF8');
  const [newTabBadge, setNewTabBadge] = useState('NEW');
  const [selectedEplTargetTab, setSelectedEplTargetTab] = useState<string>('store');

  // Publish ("Готово") modal
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [pubTitle, setPubTitle] = useState('');
  const [pubDesc, setPubDesc] = useState('');
  const [pubPrice, setPubPrice] = useState<number>(150);
  const [pubInfiniteStock, setPubInfiniteStock] = useState(true);
  const [pubStockCount, setPubStockCount] = useState<number>(25);
  const [pubCoverUrl, setPubCoverUrl] = useState('');
  const [hasCustomCover, setHasCustomCover] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);

  // Sync publish metadata when opening builder for a new or existing item
  useEffect(() => {
    if (!isOpen) {
      setShowPublishModal(false);
      return;
    }
    if (editingItem) {
      setPubTitle(editingItem.title || '');
      setPubDesc(editingItem.description || '');
      setPubPrice(Number(editingItem.price || 0));
      if (editingItem.stock === 'infinite') {
        setPubInfiniteStock(true);
        setPubStockCount(25);
      } else {
        setPubInfiniteStock(false);
        setPubStockCount(Math.max(1, Number(editingItem.stock || 1)));
      }
      setPubCoverUrl(editingItem.coverUrl || '');
      setHasCustomCover(Boolean(editingItem.coverUrl));
    } else {
      setPubTitle('');
      setPubDesc('');
      setPubPrice(150);
      setPubInfiniteStock(true);
      setPubStockCount(25);
      setPubCoverUrl('');
      setHasCustomCover(false);
    }
    setShowPublishModal(false);
    setSelectedDomTargets([]);
    setHoveredBox(null);
    setMarqueeRect(null);
    setTool('select');
    setInspectorOpen(true);
  }, [isOpen, editingItem]);

  useEffect(() => {
    if (isOpen && currentView) {
      setSelectedEplTargetTab(currentView);
    }
  }, [isOpen, currentView]);

  // Switch inspector to "Element" whenever user selects a DOM target or a custom widget
  useEffect(() => {
    if (selectedWidgetId || selectedDomTargets.length > 0) {
      setInspectorTab('element');
      setInspectorOpen(true);
    }
  }, [selectedWidgetId, selectedDomTargets.length]);

  // Compute live bounding rectangles for all currently selected DOM elements & custom widgets
  const refreshSelectionBoxes = useCallback(() => {
    if (!isOpen || previewMode || tool === 'tap') {
      setSelectedBoxes([]);
      return;
    }
    const root = document.getElementById('epl-site-root');
    if (!root) {
      setSelectedBoxes([]);
      return;
    }

    const boxes: RectBox[] = [];

    if (selectedWidgetId) {
      const wEl = document.querySelector<HTMLElement>(
        `[data-epl-widget-id="${selectedWidgetId}"]`
      );
      if (wEl) {
        const r = wEl.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          boxes.push({
            x: r.left,
            y: r.top,
            w: r.width,
            h: r.height,
            label: wEl.textContent?.trim().slice(0, 22) || 'Widget',
            kind: 'widget',
            keyOrId: selectedWidgetId,
          });
        }
      }
    }

    if (selectedDomTargets.length > 0) {
      const wantedKeys = new Set(selectedDomTargets.map((t) => t.key));
      const candidates = root.querySelectorAll<HTMLElement>(SELECTABLE_DOM_SELECTOR);
      const matchedKeys = new Set<string>();
      candidates.forEach((el) => {
        if (el.closest('[data-epl-builder-ui="true"]')) return;
        const k = getDomElementKey(el);
        if (!k || !wantedKeys.has(k) || matchedKeys.has(k)) return;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        matchedKeys.add(k);
        boxes.push({
          x: r.left,
          y: r.top,
          w: r.width,
          h: r.height,
          label: getElementCurrentText(el).slice(0, 24),
          kind: 'dom',
          keyOrId: k,
        });
      });
    }

    setSelectedBoxes(boxes);
  }, [isOpen, previewMode, tool, selectedDomTargets, selectedWidgetId]);

  useEffect(() => {
    refreshSelectionBoxes();
    if (!isOpen || previewMode || tool === 'tap') return;
    const onScrollOrResize = () => refreshSelectionBoxes();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    const id = window.setInterval(refreshSelectionBoxes, 220);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      window.clearInterval(id);
    };
  }, [isOpen, previewMode, tool, refreshSelectionBoxes, draftSpec, currentView]);

  const handleAddWidgetAt = useCallback(
    (kind: EplCustomWidget['kind'], x?: number, y?: number) => {
      const id = `w_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      const fallbackX = Math.max(270, Math.round(window.innerWidth * 0.35));
      const fallbackY = Math.max(96, Math.round(window.innerHeight * 0.25));
      const tSpec = draftSpec.theme || {};
      const newWidget: EplCustomWidget = {
        id,
        kind,
        text:
          kind === 'button'
            ? language === 'ru'
              ? 'Новая кнопка'
              : 'New Button'
            : kind === 'banner'
            ? language === 'ru'
              ? 'Новый баннер EPL Studio'
              : 'Custom EPL Banner'
            : kind === 'epl-mini-app'
            ? 'EPL Mini App'
            : kind === 'card'
            ? language === 'ru'
              ? 'Инфо-карточка'
              : 'Custom Card'
            : 'NEW',
        ...(kind === 'card'
          ? {
              subtext:
                language === 'ru'
                  ? 'Перетащите элемент в любое место'
                  : 'Drag anywhere on the screen',
            }
          : {}),
        x: x !== undefined ? Math.max(16, Math.round(x)) : fallbackX,
        y: y !== undefined ? Math.max(64, Math.round(y)) : fallbackY,
        width: kind === 'epl-mini-app' ? 320 : kind === 'banner' ? 360 : 200,
        ...(kind === 'epl-mini-app' ? { height: 180, eplCode: DEFAULT_EPL_WIDGET_SAMPLE } : {}),
        bgColor: tSpec.accentColor || '#10B981',
        textColor: '#09120E',
        borderColor: isLight ? '#CBD5E1' : '#374151',
        borderRadius: 10,
        fontSize: 13,
        visibleOn: 'all',
      };
      updateDraft((prev) => ({
        ...prev,
        widgets: [...(prev.widgets || []), newWidget],
      }));
      setSelectedDomTargets([]);
      setSelectedWidgetId(id);
      setTool('select');
      setInspectorTab('element');
      setInspectorOpen(true);
    },
    [draftSpec.theme, isLight, language, setSelectedWidgetId, updateDraft]
  );

  // Interactive Canvas Overlay: Hover box, Click-to-Select, Drag-Rectangle Marquee, Drag-to-Move selected DOM element, Click-to-Place in Add mode
  const interactionRef = useRef<{
    type: 'marquee' | 'drag-dom' | 'pending-click';
    startX: number;
    startY: number;
    shiftKey: boolean;
    clickedKey?: string;
    clickedTag?: string;
    clickedLabel?: string;
    domDragOrig?: Record<string, { tx: number; ty: number }>;
  } | null>(null);

  useEffect(() => {
    if (!isOpen || previewMode || tool === 'tap') {
      setHoveredBox(null);
      setMarqueeRect(null);
      interactionRef.current = null;
      return;
    }

    const getInteractiveHit = (clientX: number, clientY: number): HTMLElement | null => {
      const stack = document.elementsFromPoint(clientX, clientY) as HTMLElement[];
      for (const node of stack) {
        if (node.closest('[data-epl-builder-ui="true"]')) return null;
        if (node.closest('[data-epl-widget-id]')) return null; // widgets handle their own pointer events
        const hit = node.closest(SELECTABLE_DOM_SELECTOR) as HTMLElement | null;
        if (hit && !hit.closest('[data-epl-builder-ui="true"]') && document.getElementById('epl-site-root')?.contains(hit)) {
          return hit;
        }
      }
      return null;
    };

    const onPointerMove = (e: PointerEvent) => {
      const state = interactionRef.current;
      if (state) {
        const dx = e.clientX - state.startX;
        const dy = e.clientY - state.startY;
        const dist = Math.hypot(dx, dy);

        if (state.type === 'pending-click' && dist > 5) {
          const isClickedAlreadySelected =
            state.clickedKey && selectedDomTargets.some((t) => t.key === state.clickedKey);

          if (isClickedAlreadySelected && state.clickedKey) {
            const origMap: Record<string, { tx: number; ty: number }> = {};
            selectedDomTargets.forEach((t) => {
              const cur = draftSpec.domStyleOverrides?.[t.key];
              origMap[t.key] = { tx: cur?.tx || 0, ty: cur?.ty || 0 };
            });
            state.type = 'drag-dom';
            state.domDragOrig = origMap;
          } else {
            state.type = 'marquee';
          }
        }

        if (state.type === 'drag-dom' && state.domDragOrig) {
          const origMap = state.domDragOrig;
          updateDraft((prev) => {
            const nextStyles = { ...(prev.domStyleOverrides || {}) };
            Object.entries(origMap).forEach(([k, orig]) => {
              nextStyles[k] = {
                ...nextStyles[k],
                tx: Math.round(orig.tx + dx),
                ty: Math.round(orig.ty + dy),
              };
            });
            return { ...prev, domStyleOverrides: nextStyles };
          });
          return;
        }

        if (state.type === 'marquee') {
          const left = Math.min(state.startX, e.clientX);
          const top = Math.min(state.startY, e.clientY);
          const width = Math.abs(e.clientX - state.startX);
          const height = Math.abs(e.clientY - state.startY);
          setMarqueeRect({ left, top, width, height });
          return;
        }
      }

      if (tool !== 'select') {
        setHoveredBox(null);
        return;
      }

      const hit = getInteractiveHit(e.clientX, e.clientY);
      if (!hit) {
        setHoveredBox(null);
        return;
      }
      const key = getDomElementKey(hit);
      if (!key) {
        setHoveredBox(null);
        return;
      }
      const r = hit.getBoundingClientRect();
      setHoveredBox({
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
        label: getElementCurrentText(hit).slice(0, 26),
        kind: 'dom',
        keyOrId: key,
      });
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-epl-builder-ui="true"]')) return;
      if (target.closest('[data-epl-widget-id]')) return;

      const root = document.getElementById('epl-site-root');
      if (!root || !root.contains(target)) return;

      if (tool === 'add') {
        e.preventDefault();
        e.stopPropagation();
        handleAddWidgetAt(pendingAddKind, e.clientX - 80, e.clientY - 20);
        return;
      }

      if (tool === 'select') {
        const hit = getInteractiveHit(e.clientX, e.clientY);
        const key = hit ? getDomElementKey(hit) : null;
        e.preventDefault();
        e.stopPropagation();
        interactionRef.current = {
          type: 'pending-click',
          startX: e.clientX,
          startY: e.clientY,
          shiftKey: e.shiftKey,
          clickedKey: key || undefined,
          clickedTag: hit?.tagName.toLowerCase(),
          clickedLabel: hit ? getElementCurrentText(hit) : undefined,
        };
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const state = interactionRef.current;
      if (!state) return;
      interactionRef.current = null;

      if (state.type === 'marquee') {
        const selRect = {
          left: Math.min(state.startX, e.clientX),
          top: Math.min(state.startY, e.clientY),
          right: Math.max(state.startX, e.clientX),
          bottom: Math.max(state.startY, e.clientY),
        };
        setMarqueeRect(null);

        const root = document.getElementById('epl-site-root');
        if (!root) return;
        const foundDom: SelectedDomTarget[] = [];
        const seenKeys = new Set<string>();
        root.querySelectorAll<HTMLElement>(SELECTABLE_DOM_SELECTOR).forEach((el) => {
          if (el.closest('[data-epl-builder-ui="true"]')) return;
          const k = getDomElementKey(el);
          if (!k || seenKeys.has(k)) return;
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return;
          if (rectsIntersect(selRect, r)) {
            seenKeys.add(k);
            foundDom.push({
              key: k,
              tag: el.tagName.toLowerCase(),
              label: getElementCurrentText(el),
            });
          }
        });

        // Also check if a custom widget falls inside the marquee
        let foundWidgetId: string | null = null;
        document.querySelectorAll<HTMLElement>('[data-epl-widget-id]').forEach((wEl) => {
          const r = wEl.getBoundingClientRect();
          if (rectsIntersect(selRect, r) && !foundWidgetId) {
            foundWidgetId = wEl.getAttribute('data-epl-widget-id');
          }
        });

        if (foundDom.length > 0) {
          setSelectedWidgetId(null);
          setSelectedDomTargets((prev) => {
            if (!state.shiftKey) return foundDom;
            const merged = [...prev];
            foundDom.forEach((f) => {
              if (!merged.some((m) => m.key === f.key)) merged.push(f);
            });
            return merged;
          });
          setInspectorTab('element');
          setInspectorOpen(true);
        } else if (foundWidgetId) {
          setSelectedDomTargets([]);
          setSelectedWidgetId(foundWidgetId);
          setInspectorTab('element');
          setInspectorOpen(true);
        } else if (!state.shiftKey) {
          setSelectedDomTargets([]);
          setSelectedWidgetId(null);
        }
        return;
      }

      if (state.type === 'pending-click') {
        if (state.clickedKey) {
          const targetObj: SelectedDomTarget = {
            key: state.clickedKey,
            tag: state.clickedTag || 'el',
            label: state.clickedLabel || state.clickedKey,
          };
          setSelectedWidgetId(null);
          setSelectedDomTargets((prev) => {
            if (state.shiftKey) {
              const exists = prev.some((p) => p.key === targetObj.key);
              return exists
                ? prev.filter((p) => p.key !== targetObj.key)
                : [...prev, targetObj];
            }
            return [targetObj];
          });
          setInspectorTab('element');
          setInspectorOpen(true);
        } else if (!state.shiftKey) {
          setSelectedDomTargets([]);
          setSelectedWidgetId(null);
        }
      }
    };

    const suppressClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-epl-builder-ui="true"]')) return;
      if (target.closest('[data-epl-widget-id]')) return;
      const root = document.getElementById('epl-site-root');
      if (!root || !root.contains(target)) return;
      if (tool === 'select' || tool === 'add') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('click', suppressClick, true);
    return () => {
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('click', suppressClick, true);
    };
  }, [
    isOpen,
    previewMode,
    tool,
    pendingAddKind,
    selectedDomTargets,
    draftSpec.domStyleOverrides,
    handleAddWidgetAt,
    setSelectedWidgetId,
    updateDraft,
  ]);

  const selectedWidget = useMemo(
    () => (draftSpec.widgets || []).find((w) => w.id === selectedWidgetId) || null,
    [draftSpec.widgets, selectedWidgetId]
  );

  if (!isOpen) return null;

  const tSpec = draftSpec.theme || {};

  const setThemeField = <K extends keyof EplSiteCustomizationSpec['theme']>(
    key: K,
    val: EplSiteCustomizationSpec['theme'][K]
  ) => {
    updateDraft((prev) => ({
      ...prev,
      theme: { ...prev.theme, [key]: val },
    }));
  };

  const applyToSelectedDomStyles = (
    patch: Partial<EplSiteCustomizationSpec['domStyleOverrides'][string]>
  ) => {
    if (selectedDomTargets.length === 0) return;
    updateDraft((prev) => {
      const next = { ...(prev.domStyleOverrides || {}) };
      selectedDomTargets.forEach((t) => {
        next[t.key] = { ...(next[t.key] || {}), ...patch };
      });
      return { ...prev, domStyleOverrides: next };
    });
  };

  const resetSelectedDomTargets = () => {
    if (selectedDomTargets.length === 0) return;
    updateDraft((prev) => {
      const nextStyles = { ...(prev.domStyleOverrides || {}) };
      const nextTexts = { ...(prev.domTextOverrides || {}) };
      selectedDomTargets.forEach((t) => {
        delete nextStyles[t.key];
        delete nextTexts[t.key];
      });
      return {
        ...prev,
        domStyleOverrides: nextStyles,
        domTextOverrides: nextTexts,
      };
    });
  };

  const handleAddCategory = () => {
    const label = newCatLabel.trim();
    if (!label) return;
    const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    updateDraft((prev) => ({
      ...prev,
      customCategories: [...(prev.customCategories || []), { id, label, color: newCatColor }],
      categoryOrder: [
        ...(prev.categoryOrder || ['store', 'tools', 'my-stuff', 'global', 'paid', 'developer-tools']),
        id,
      ],
    }));
    setNewCatLabel('');
    setNewTabCat(id);
  };

  const handleAddCustomTab = () => {
    const label = newTabLabel.trim();
    if (!label) return;
    const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    updateDraft((prev) => ({
      ...prev,
      customTabs: [
        ...(prev.customTabs || []),
        {
          id,
          label,
          categoryId: newTabCat || 'store',
          color: newTabColor,
          ...(newTabBadge.trim() ? { badge: newTabBadge.trim() } : {}),
          subtitle: language === 'ru' ? 'Кастомная вкладка EPL' : 'Custom EPL Tab',
          eplCode: DEFAULT_EPL_WIDGET_SAMPLE,
        },
      ],
    }));
    setNewTabLabel('');
    setSelectedEplTargetTab(id);
  };

  const handleOpenDoneModal = () => {
    const nextTitle = pubTitle || draftSpec.brandTitle || 'Custom EPL Build';
    const autoSnap = renderShopSpecSnapshot(draftSpec, nextTitle);
    if (!pubTitle) {
      setPubTitle(draftSpec.brandTitle || 'Custom EPL Theme');
    }
    if (!hasCustomCover || !pubCoverUrl) {
      setPubCoverUrl(autoSnap);
    }
    setShowPublishModal(true);
  };

  const handleUploadCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 720;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setPubCoverUrl(canvas.toDataURL('image/jpeg', 0.82));
          setHasCustomCover(true);
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handlePublishShopItem = async () => {
    if (!user || !auth.currentUser) {
      notify.error(language === 'ru' ? 'Войдите в аккаунт' : 'Sign in required');
      return;
    }
    const cleanTitle = pubTitle.trim();
    if (!cleanTitle) {
      notify.error(language === 'ru' ? 'Введите название товара' : 'Enter a title');
      return;
    }

    setPublishing(true);
    try {
      const id =
        editingItemId ||
        `shop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const safeTitle = cleanTitle.slice(0, 160);
      const rawCover =
        pubCoverUrl || renderShopSpecSnapshot(draftSpec, safeTitle);
      const finalCover =
        rawCover.length <= 850000
          ? rawCover
          : renderShopSpecSnapshot(draftSpec, safeTitle);
      const now = new Date().toISOString();

      const itemDoc: EplShopItem = sanitizeFirestoreData({
        id,
        title: safeTitle,
        description: (
          pubDesc.trim() ||
          (language === 'ru'
            ? 'Полная кастомизация сайта EPL Studio с новыми элементами и стилем.'
            : 'Complete EPL Studio site customization with custom layout and modules.')
        ).slice(0, 4000),
        coverUrl: finalCover,
        screenshotUrl: finalCover,
        price: Math.max(0, Math.round(Number(pubPrice) || 0)),
        stock: pubInfiniteStock
          ? 'infinite'
          : Math.max(1, Math.round(Number(pubStockCount) || 1)),
        sales: editingItem?.sales ?? 0,
        authorId: editingItem?.authorId || user.uid,
        authorName: (
          editingItem?.authorName ||
          userData?.name ||
          user.displayName ||
          'Developer'
        ).slice(0, 100),
        spec: draftSpec,
        status: 'active',
        createdAt: editingItem?.createdAt || now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'eplShopItems', id), itemDoc, { merge: true });
      if (useStore.getState().appliedEplShopItemId === id) {
        useStore.setState({ appliedEplShopSpec: itemDoc.spec });
      }
      notify.success(
        language === 'ru'
          ? `Товар «${safeTitle}» опубликован в EPL Shop!`
          : `Published "${safeTitle}" to EPL Shop!`
      );
      setShowPublishModal(false);
      closeBuilder();
    } catch (err: any) {
      handleFirestoreError(
        err,
        editingItemId ? OperationType.UPDATE : OperationType.CREATE,
        `eplShopItems/${editingItemId || 'new'}`
      );
      notify.error(err?.message || 'Failed to publish to EPL Shop');
    } finally {
      setPublishing(false);
    }
  };

  const surfaceCls = isFrutigerAero
    ? 'frutiger-aero-glass border-white/60 text-[#062038]'
    : isLight
    ? 'bg-white border-[#E2E5EA] text-[#111315]'
    : 'bg-[#181B20] border-[#262B33] text-[#F3F4F6]';

  const inputCls = isFrutigerAero
    ? 'bg-white/65 border-white text-[#062038]'
    : isLight
    ? 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315]'
    : 'bg-[#111315] border-[#262B33] text-[#F3F4F6]';

  const mutedTextCls = isFrutigerAero
    ? 'text-[#1e4b73]'
    : isLight
    ? 'text-[#4B5563]'
    : 'text-[#9CA3AF]';

  // Preview mode bar (native theme)
  if (previewMode) {
    return (
      <div
        data-epl-builder-ui="true"
        className={clsx(
          'fixed bottom-4 right-4 z-[95] flex items-center gap-2 p-2 rounded-xl border shadow-xl',
          surfaceCls
        )}
      >
        <span className="px-2.5 py-1 text-xs font-semibold text-[#10B981] flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" />
          <span>{language === 'ru' ? 'Предпросмотр' : 'Preview'}</span>
        </span>
        <button
          type="button"
          onClick={() => setPreviewMode(false)}
          className={clsx(
            'px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer inline-flex items-center gap-1.5',
            inputCls
          )}
        >
          <EyeOff className="w-3.5 h-3.5" />
          <span>{language === 'ru' ? 'Вернуться в редактор' : 'Back to Edit'}</span>
        </button>
        <button
          type="button"
          onClick={handleOpenDoneModal}
          className="px-3.5 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#09120E] text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          <span>{language === 'ru' ? 'Готово' : 'Done'}</span>
        </button>
      </div>
    );
  }

  const allCategoryChoices = [
    { id: 'store', label: 'Store' },
    { id: 'tools', label: 'Tools' },
    { id: 'my-stuff', label: 'My Stuff' },
    { id: 'global', label: 'Global' },
    { id: 'paid', label: 'Paid' },
    ...(draftSpec.customCategories || []),
  ];

  const pageJumpChoices = [
    { id: 'store', label: 'App Store' },
    { id: 'epl-shop', label: 'EPL Shop' },
    { id: 'asset-store', label: 'Asset Store' },
    { id: 'editor', label: 'Editor' },
    { id: 'installed-apps', label: 'Installed Apps' },
    { id: 'profile', label: 'Profile' },
    { id: 'my-apps', label: 'My Apps' },
    { id: 'leaderboards', label: 'Leaderboards' },
    { id: 'news', label: 'News' },
    { id: 'rate', label: 'Rate' },
    { id: 'premium', label: 'Premium' },
    { id: 'donate', label: 'Donate' },
    { id: 'settings', label: 'Settings' },
    ...(draftSpec.customTabs || []).map((t) => ({ id: t.id, label: t.label })),
  ];

  const overlayTabChoices = [
    { id: 'global', label: language === 'ru' ? 'Весь сайт (верх)' : 'Global Site Top' },
    ...pageJumpChoices,
  ];

  const isCustomTabSelected = (draftSpec.customTabs || []).some(
    (t) => t.id === selectedEplTargetTab
  );
  const selectedCustomTab = (draftSpec.customTabs || []).find(
    (t) => t.id === selectedEplTargetTab
  );
  const currentTabOverlay =
    selectedEplTargetTab === 'global'
      ? { code: draftSpec.globalEplCode || '', position: 'top' as const }
      : draftSpec.tabEplOverlays?.[selectedEplTargetTab] || { code: '', position: 'top' as const };

  const primaryDomTarget = selectedDomTargets[0] || null;
  const primaryDomStyle = primaryDomTarget
    ? draftSpec.domStyleOverrides?.[primaryDomTarget.key] || {}
    : {};

  return (
    <>
      {/* Live Selection Rectangles & Marquee Overlay */}
      <div
        data-epl-builder-ui="true"
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[85]"
      >
        {/* Hover rectangle */}
        {hoveredBox && (
          <div
            style={{
              left: hoveredBox.x - 2,
              top: hoveredBox.y - 2,
              width: hoveredBox.w + 4,
              height: hoveredBox.h + 4,
            }}
            className="absolute border border-dashed border-[#10B981]/85 rounded-md bg-[#10B981]/5 transition-[left,top,width,height] duration-75"
          >
            <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded bg-[#10B981] text-[#09120E] text-[10px] font-medium whitespace-nowrap shadow-sm">
              {hoveredBox.label}
            </span>
          </div>
        )}

        {/* Selected element rectangle(s) with corner handles */}
        {selectedBoxes.map((b) => (
          <div
            key={`${b.kind}_${b.keyOrId}`}
            style={{
              left: b.x - 2,
              top: b.y - 2,
              width: b.w + 4,
              height: b.h + 4,
            }}
            className="absolute border-2 border-[#10B981] rounded-md bg-[#10B981]/10"
          >
            <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded bg-[#10B981] text-[#09120E] text-[10px] font-semibold whitespace-nowrap shadow-sm">
              {b.label}
            </span>
            <span className="absolute -top-1 -left-1 w-2 h-2 bg-white border border-[#10B981] rounded-[1px]" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-white border border-[#10B981] rounded-[1px]" />
            <span className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border border-[#10B981] rounded-[1px]" />
            <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-white border border-[#10B981] rounded-[1px]" />
          </div>
        ))}

        {/* Drag-to-select Marquee Rectangle */}
        {marqueeRect && (
          <div
            style={{
              left: marqueeRect.left,
              top: marqueeRect.top,
              width: marqueeRect.width,
              height: marqueeRect.height,
            }}
            className="absolute border-[1.5px] border-[#10B981] bg-[#10B981]/15 rounded-xs"
          >
            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-[#111315]/90 text-[#10B981] text-[10px] font-mono tabular-nums">
              {Math.round(marqueeRect.width)}×{Math.round(marqueeRect.height)}
            </span>
          </div>
        )}
      </div>

      {/* Add-mode hint bar when placing element */}
      {tool === 'add' && (
        <div
          data-epl-builder-ui="true"
          className={clsx(
            'fixed top-16 left-1/2 -translate-x-1/2 z-[94] px-3.5 py-2 rounded-lg border shadow-lg flex items-center gap-2.5 text-xs',
            surfaceCls
          )}
        >
          <PlusSquare className="w-4 h-4 text-[#10B981] shrink-0" />
          <span className="font-medium">
            {language === 'ru'
              ? 'Кликните в любое место экрана, чтобы добавить элемент, или выберите тип:'
              : 'Click anywhere on screen to place element, or choose type:'}
          </span>
          <div className="flex items-center gap-1">
            {([
              { kind: 'button', label: language === 'ru' ? 'Кнопка' : 'Button' },
              { kind: 'card', label: language === 'ru' ? 'Карточка' : 'Card' },
              { kind: 'banner', label: language === 'ru' ? 'Баннер' : 'Banner' },
              { kind: 'badge', label: language === 'ru' ? 'Метка' : 'Label' },
              { kind: 'epl-mini-app', label: 'EPL' },
            ] as const).map((item) => (
              <button
                key={item.kind}
                type="button"
                onClick={() => setPendingAddKind(item.kind)}
                className={clsx(
                  'px-2 py-1 rounded-md text-[11px] font-medium border cursor-pointer transition-colors',
                  pendingAddKind === item.kind
                    ? 'bg-[#10B981] border-[#10B981] text-[#09120E]'
                    : inputCls
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setTool('select')}
            className="px-2 py-1 rounded-md text-[11px] hover:bg-current/10 cursor-pointer"
          >
            {language === 'ru' ? 'Отмена' : 'Cancel'}
          </button>
        </div>
      )}

      {/* Top Studio Architect Toolbar (Native EPL Studio Design) */}
      <div
        data-epl-builder-ui="true"
        className={clsx(
          'fixed top-2 inset-x-2 md:inset-x-auto md:top-2.5 md:left-1/2 md:-translate-x-1/2 z-[95] px-2.5 sm:px-3 py-1.5 rounded-xl border shadow-xl flex items-center gap-1.5 sm:gap-2 md:max-w-[96vw] overflow-x-auto no-scrollbar',
          surfaceCls
        )}
      >
        <div className="hidden sm:flex items-center gap-2 pr-2 border-r border-current/10 shrink-0">
          <Palette className="w-4 h-4 text-[#10B981] shrink-0" />
          <span className="text-xs font-semibold whitespace-nowrap">
            {language === 'ru' ? 'Редактор EPL Shop' : 'EPL Shop Editor'}
          </span>
        </div>

        {/* Select / Add / Tap segmented controls */}
        <div className={clsx('flex items-center gap-1 p-0.5 rounded-lg border', inputCls)}>
          <button
            type="button"
            onClick={() => setTool('select')}
            title={
              language === 'ru'
                ? 'Выделять элементы кликом или прямоугольником и перетаскивать их'
                : 'Select elements by click or marquee rectangle and drag them'
            }
            className={clsx(
              'px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap',
              tool === 'select'
                ? 'bg-[#10B981] text-[#09120E] font-semibold'
                : 'hover:bg-current/10'
            )}
          >
            <MousePointer2 className="w-3.5 h-3.5" />
            <span>{language === 'ru' ? 'Выделить' : 'Select'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTool(tool === 'add' ? 'select' : 'add')}
            title={language === 'ru' ? 'Добавить элемент на экран' : 'Add element on screen'}
            className={clsx(
              'px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap',
              tool === 'add'
                ? 'bg-[#10B981] text-[#09120E] font-semibold'
                : 'hover:bg-current/10'
            )}
          >
            <PlusSquare className="w-3.5 h-3.5" />
            <span>{language === 'ru' ? 'Добавить' : 'Add'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTool('tap')}
            title={
              language === 'ru'
                ? 'Режим Tap: обычное нажатие с действием без выделения элементов'
                : 'Tap mode: trigger normal clicks and actions without selecting elements'
            }
            className={clsx(
              'px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap',
              tool === 'tap'
                ? 'bg-[#10B981] text-[#09120E] font-semibold'
                : 'hover:bg-current/10'
            )}
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            <span>Tap</span>
          </button>
        </div>

        {/* Active Page Switcher while editing */}
        <select
          value={currentView}
          onChange={(e) => {
            setSelectedDomTargets([]);
            setCurrentView(e.target.value as View);
          }}
          aria-label={language === 'ru' ? 'Страница для редактирования' : 'Page to edit'}
          className={clsx('px-2 py-1 rounded-lg border text-xs font-medium cursor-pointer', inputCls)}
        >
          {pageJumpChoices.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setInspectorOpen((v) => !v)}
          className={clsx(
            'px-2.5 py-1 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap',
            inspectorOpen ? 'border-[#10B981]/60 text-[#10B981]' : inputCls
          )}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{language === 'ru' ? 'Свойства' : 'Inspector'}</span>
        </button>

        <button
          type="button"
          onClick={() => setPreviewMode(true)}
          className={clsx(
            'px-2.5 py-1 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap',
            inputCls
          )}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{language === 'ru' ? 'Вид' : 'Preview'}</span>
        </button>

        <button
          type="button"
          onClick={handleOpenDoneModal}
          className="px-3 py-1 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#09120E] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <Check className="w-3.5 h-3.5" />
          <span>{language === 'ru' ? 'Готово' : 'Done'}</span>
        </button>

        <button
          type="button"
          onClick={closeBuilder}
          title={language === 'ru' ? 'Закрыть редактор' : 'Close Editor'}
          className="p-1.5 rounded-lg hover:bg-red-500/15 text-red-500 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Right Docked Studio Inspector Panel (Bottom Sheet on Mobile) */}
      {inspectorOpen && (
        <aside
          data-epl-builder-ui="true"
          className={clsx(
            'fixed inset-x-2 bottom-2 top-auto h-[48dvh] rounded-t-2xl sm:inset-x-auto sm:top-16 sm:right-3 sm:bottom-3 sm:h-auto z-[94] sm:w-[348px] sm:rounded-xl border shadow-xl flex flex-col overflow-hidden',
            surfaceCls
          )}
        >
          {/* Inspector Section Switcher */}
          <div className={clsx('grid grid-cols-3 p-1.5 gap-1 border-b border-current/10 shrink-0', isLight ? 'bg-[#F5F6F8]' : 'bg-[#111315]')}>
            {([
              { id: 'element', icon: Move, label: language === 'ru' ? 'Элемент' : 'Element' },
              { id: 'site', icon: Palette, label: language === 'ru' ? 'Дизайн' : 'Theme' },
              { id: 'nav', icon: Layers, label: language === 'ru' ? 'Вкладки/EPL' : 'Tabs/EPL' },
            ] as const).map((tab) => {
              const Icon = tab.icon;
              const active = inspectorTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setInspectorTab(tab.id)}
                  className={clsx(
                    'py-1.5 px-2 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap',
                    active
                      ? isLight
                        ? 'bg-white text-[#059669] shadow-xs border border-[#E2E5EA]'
                        : 'bg-[#181B20] text-[#10B981] border border-[#262B33]'
                      : mutedTextCls
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Inspector Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {inspectorTab === 'element' && (
              <div className="space-y-4">
                {/* 1. Custom Widget Selected */}
                {selectedWidget ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-current/10 pb-2">
                      <div>
                        <div className="text-sm font-semibold">
                          {language === 'ru' ? 'Добавленный элемент' : 'Custom Element'}
                        </div>
                        <div className={clsx('text-[11px] font-mono tabular-nums', mutedTextCls)}>
                          {selectedWidget.kind} · X {Math.round(selectedWidget.x)} · Y {Math.round(selectedWidget.y)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            handleAddWidgetAt(
                              selectedWidget.kind,
                              selectedWidget.x + 24,
                              selectedWidget.y + 24
                            )
                          }
                          title={language === 'ru' ? 'Дублировать' : 'Duplicate'}
                          className="p-1.5 rounded-lg hover:bg-current/10 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateDraft((p) => ({
                              ...p,
                              widgets: p.widgets.filter((x) => x.id !== selectedWidget.id),
                            }));
                            setSelectedWidgetId(null);
                          }}
                          title={language === 'ru' ? 'Удалить' : 'Delete'}
                          className="p-1.5 rounded-lg hover:bg-red-500/15 text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className={clsx('block text-[11px] font-medium mb-1', mutedTextCls)}>
                        {language === 'ru' ? 'Текст' : 'Text'}
                      </label>
                      <input
                        type="text"
                        value={selectedWidget.text}
                        onChange={(e) =>
                          updateDraft((p) => ({
                            ...p,
                            widgets: p.widgets.map((x) =>
                              x.id === selectedWidget.id ? { ...x, text: e.target.value } : x
                            ),
                          }))
                        }
                        className={clsx('w-full px-2.5 py-1.5 rounded-lg border text-xs', inputCls)}
                      />
                    </div>

                    {selectedWidget.kind === 'card' && (
                      <div>
                        <label className={clsx('block text-[11px] font-medium mb-1', mutedTextCls)}>
                          {language === 'ru' ? 'Подзаголовок' : 'Subtext'}
                        </label>
                        <input
                          type="text"
                          value={selectedWidget.subtext || ''}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              widgets: p.widgets.map((x) =>
                                x.id === selectedWidget.id ? { ...x, subtext: e.target.value } : x
                              ),
                            }))
                          }
                          className={clsx('w-full px-2.5 py-1.5 rounded-lg border text-xs', inputCls)}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                      <label className={clsx('p-2 rounded-lg border flex flex-col gap-1', inputCls)}>
                        <span className={clsx('text-[10px]', mutedTextCls)}>
                          {language === 'ru' ? 'Фон' : 'BG'}
                        </span>
                        <input
                          type="color"
                          value={selectedWidget.bgColor || '#10B981'}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              widgets: p.widgets.map((x) =>
                                x.id === selectedWidget.id ? { ...x, bgColor: e.target.value } : x
                              ),
                            }))
                          }
                          className="w-full h-5 bg-transparent border-0 cursor-pointer p-0"
                        />
                      </label>
                      <label className={clsx('p-2 rounded-lg border flex flex-col gap-1', inputCls)}>
                        <span className={clsx('text-[10px]', mutedTextCls)}>
                          {language === 'ru' ? 'Текст' : 'Text'}
                        </span>
                        <input
                          type="color"
                          value={selectedWidget.textColor || '#09120E'}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              widgets: p.widgets.map((x) =>
                                x.id === selectedWidget.id ? { ...x, textColor: e.target.value } : x
                              ),
                            }))
                          }
                          className="w-full h-5 bg-transparent border-0 cursor-pointer p-0"
                        />
                      </label>
                      <label className={clsx('p-2 rounded-lg border flex flex-col gap-1', inputCls)}>
                        <span className={clsx('text-[10px]', mutedTextCls)}>
                          {language === 'ru' ? 'Рамка' : 'Border'}
                        </span>
                        <input
                          type="color"
                          value={selectedWidget.borderColor || '#262B33'}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              widgets: p.widgets.map((x) =>
                                x.id === selectedWidget.id ? { ...x, borderColor: e.target.value } : x
                              ),
                            }))
                          }
                          className="w-full h-5 bg-transparent border-0 cursor-pointer p-0"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={clsx('block text-[11px] mb-1 tabular-nums', mutedTextCls)}>
                          {language === 'ru' ? `Ширина: ${selectedWidget.width || 200}px` : `Width: ${selectedWidget.width || 200}px`}
                        </label>
                        <input
                          type="range"
                          min={90}
                          max={640}
                          value={selectedWidget.width || 200}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              widgets: p.widgets.map((x) =>
                                x.id === selectedWidget.id ? { ...x, width: Number(e.target.value) } : x
                              ),
                            }))
                          }
                          className="w-full accent-[#10B981]"
                        />
                      </div>
                      <div>
                        <label className={clsx('block text-[11px] mb-1 tabular-nums', mutedTextCls)}>
                          {language === 'ru' ? `Скругление: ${selectedWidget.borderRadius ?? 10}px` : `Radius: ${selectedWidget.borderRadius ?? 10}px`}
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={24}
                          value={selectedWidget.borderRadius ?? 10}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              widgets: p.widgets.map((x) =>
                                x.id === selectedWidget.id
                                  ? { ...x, borderRadius: Number(e.target.value) }
                                  : x
                              ),
                            }))
                          }
                          className="w-full accent-[#10B981]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={clsx('block text-[11px] mb-1', mutedTextCls)}>
                          {language === 'ru' ? 'Переход по клику' : 'On Click Navigate'}
                        </label>
                        <select
                          value={selectedWidget.targetView || ''}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              widgets: p.widgets.map((x) =>
                                x.id === selectedWidget.id ? { ...x, targetView: e.target.value } : x
                              ),
                            }))
                          }
                          className={clsx('w-full px-2 py-1.5 rounded-lg border text-xs', inputCls)}
                        >
                          <option value="">{language === 'ru' ? 'Без перехода' : 'None'}</option>
                          {pageJumpChoices.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={clsx('block text-[11px] mb-1', mutedTextCls)}>
                          {language === 'ru' ? 'Показывать на' : 'Visible On'}
                        </label>
                        <select
                          value={selectedWidget.visibleOn || 'all'}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              widgets: p.widgets.map((x) =>
                                x.id === selectedWidget.id ? { ...x, visibleOn: e.target.value } : x
                              ),
                            }))
                          }
                          className={clsx('w-full px-2 py-1.5 rounded-lg border text-xs', inputCls)}
                        >
                          <option value="all">{language === 'ru' ? 'Все вкладки' : 'All Tabs'}</option>
                          {pageJumpChoices.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {selectedWidget.kind === 'epl-mini-app' && (
                      <div>
                        <label className={clsx('block text-[11px] mb-1', mutedTextCls)}>
                          EPL Code
                        </label>
                        <textarea
                          rows={5}
                          value={selectedWidget.eplCode || ''}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              widgets: p.widgets.map((x) =>
                                x.id === selectedWidget.id ? { ...x, eplCode: e.target.value } : x
                              ),
                            }))
                          }
                          className={clsx('w-full p-2 rounded-lg border font-mono text-[11px]', inputCls)}
                        />
                      </div>
                    )}
                  </div>
                ) : selectedDomTargets.length > 0 ? (
                  /* 2. Selected Site DOM Element(s) via Click or Marquee Rectangle */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-current/10 pb-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">
                          {selectedDomTargets.length === 1
                            ? primaryDomTarget.label
                            : language === 'ru'
                            ? `Выделено элементов: ${selectedDomTargets.length}`
                            : `${selectedDomTargets.length} elements selected`}
                        </div>
                        <div className={clsx('text-[11px]', mutedTextCls)}>
                          {language === 'ru'
                            ? 'Потяните за выделенный элемент на экране, чтобы переместить его'
                            : 'Drag the highlighted element on screen to reposition it'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={resetSelectedDomTargets}
                        title={language === 'ru' ? 'Сбросить изменения элемента' : 'Reset element'}
                        className="p-1.5 rounded-lg hover:bg-current/10 cursor-pointer shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {selectedDomTargets.length > 1 && (
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {selectedDomTargets.map((t) => (
                          <button
                            key={t.key}
                            type="button"
                            onClick={() => setSelectedDomTargets([t])}
                            className={clsx(
                              'px-2 py-0.5 rounded-md border text-[11px] truncate max-w-[140px] cursor-pointer hover:border-[#10B981]',
                              inputCls
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedDomTargets.length === 1 && primaryDomTarget && (
                      <div>
                        <label className={clsx('block text-[11px] font-medium mb-1', mutedTextCls)}>
                          {language === 'ru' ? 'Текст элемента' : 'Element Text'}
                        </label>
                        <input
                          type="text"
                          value={
                            draftSpec.domTextOverrides?.[primaryDomTarget.key] ??
                            primaryDomTarget.label
                          }
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              domTextOverrides: {
                                ...p.domTextOverrides,
                                [primaryDomTarget.key]: e.target.value,
                              },
                            }))
                          }
                          className={clsx('w-full px-2.5 py-1.5 rounded-lg border text-xs', inputCls)}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                      <label className={clsx('p-2 rounded-lg border flex flex-col gap-1', inputCls)}>
                        <span className={clsx('text-[10px]', mutedTextCls)}>
                          {language === 'ru' ? 'Фон' : 'BG'}
                        </span>
                        <input
                          type="color"
                          value={primaryDomStyle.bg || '#10B981'}
                          onChange={(e) => applyToSelectedDomStyles({ bg: e.target.value })}
                          className="w-full h-5 bg-transparent border-0 cursor-pointer p-0"
                        />
                      </label>
                      <label className={clsx('p-2 rounded-lg border flex flex-col gap-1', inputCls)}>
                        <span className={clsx('text-[10px]', mutedTextCls)}>
                          {language === 'ru' ? 'Текст' : 'Text'}
                        </span>
                        <input
                          type="color"
                          value={primaryDomStyle.color || '#F3F4F6'}
                          onChange={(e) => applyToSelectedDomStyles({ color: e.target.value })}
                          className="w-full h-5 bg-transparent border-0 cursor-pointer p-0"
                        />
                      </label>
                      <label className={clsx('p-2 rounded-lg border flex flex-col gap-1', inputCls)}>
                        <span className={clsx('text-[10px]', mutedTextCls)}>
                          {language === 'ru' ? 'Рамка' : 'Border'}
                        </span>
                        <input
                          type="color"
                          value={primaryDomStyle.borderColor || '#262B33'}
                          onChange={(e) =>
                            applyToSelectedDomStyles({ borderColor: e.target.value })
                          }
                          className="w-full h-5 bg-transparent border-0 cursor-pointer p-0"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={clsx('block text-[11px] mb-1 tabular-nums', mutedTextCls)}>
                          {language === 'ru'
                            ? `Сдвиг X: ${primaryDomStyle.tx ?? 0}px`
                            : `Offset X: ${primaryDomStyle.tx ?? 0}px`}
                        </label>
                        <input
                          type="range"
                          min={-240}
                          max={240}
                          value={primaryDomStyle.tx ?? 0}
                          onChange={(e) =>
                            applyToSelectedDomStyles({ tx: Number(e.target.value) })
                          }
                          className="w-full accent-[#10B981]"
                        />
                      </div>
                      <div>
                        <label className={clsx('block text-[11px] mb-1 tabular-nums', mutedTextCls)}>
                          {language === 'ru'
                            ? `Сдвиг Y: ${primaryDomStyle.ty ?? 0}px`
                            : `Offset Y: ${primaryDomStyle.ty ?? 0}px`}
                        </label>
                        <input
                          type="range"
                          min={-240}
                          max={240}
                          value={primaryDomStyle.ty ?? 0}
                          onChange={(e) =>
                            applyToSelectedDomStyles({ ty: Number(e.target.value) })
                          }
                          className="w-full accent-[#10B981]"
                        />
                      </div>
                      <div>
                        <label className={clsx('block text-[11px] mb-1 tabular-nums', mutedTextCls)}>
                          {language === 'ru'
                            ? `Скругление: ${primaryDomStyle.radius ?? 8}px`
                            : `Radius: ${primaryDomStyle.radius ?? 8}px`}
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={28}
                          value={primaryDomStyle.radius ?? 8}
                          onChange={(e) =>
                            applyToSelectedDomStyles({ radius: Number(e.target.value) })
                          }
                          className="w-full accent-[#10B981]"
                        />
                      </div>
                      <div>
                        <label className={clsx('block text-[11px] mb-1 tabular-nums', mutedTextCls)}>
                          {language === 'ru'
                            ? `Размер текста: ${primaryDomStyle.fontSize ?? 13}px`
                            : `Font Size: ${primaryDomStyle.fontSize ?? 13}px`}
                        </label>
                        <input
                          type="range"
                          min={10}
                          max={32}
                          value={primaryDomStyle.fontSize ?? 13}
                          onChange={(e) =>
                            applyToSelectedDomStyles({ fontSize: Number(e.target.value) })
                          }
                          className="w-full accent-[#10B981]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          applyToSelectedDomStyles({ hidden: !primaryDomStyle.hidden })
                        }
                        className={clsx(
                          'flex-1 py-1.5 px-3 rounded-lg border text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer',
                          inputCls
                        )}
                      >
                        <HideIcon className="w-3.5 h-3.5" />
                        <span>
                          {primaryDomStyle.hidden
                            ? language === 'ru'
                              ? 'Показать'
                              : 'Show'
                            : language === 'ru'
                            ? 'Скрыть элемент'
                            : 'Hide Element'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={resetSelectedDomTargets}
                        className="py-1.5 px-3 rounded-lg border border-red-500/35 text-red-500 hover:bg-red-500/10 text-xs font-medium cursor-pointer"
                      >
                        {language === 'ru' ? 'Сбросить' : 'Reset'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 3. Empty selection state + Add New Element palette */
                  <div className="space-y-4">
                    <div className={clsx('p-3.5 rounded-lg border space-y-1.5', inputCls)}>
                      <div className="font-semibold text-xs">
                        {language === 'ru'
                          ? 'Выделение элементов на экране'
                          : 'Interactive Screen Selection'}
                      </div>
                      <p className={clsx('text-[11px] leading-relaxed', mutedTextCls)}>
                        {language === 'ru'
                          ? 'Кликните по любой кнопке, заголовку или карточке — или зажмите мышь и обведите область прямоугольником, чтобы выделить сразу несколько элементов и перетаскивать или настраивать их.'
                          : 'Click any button, heading, or card — or click-and-drag a selection rectangle anywhere on screen to highlight multiple elements and drag or style them.'}
                      </p>
                    </div>

                    <div>
                      <div className={clsx('text-[11px] font-medium mb-2', mutedTextCls)}>
                        {language === 'ru' ? 'Добавить новый элемент' : 'Add New Element'}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { kind: 'button', label: language === 'ru' ? '+ Кнопка' : '+ Button' },
                          { kind: 'card', label: language === 'ru' ? '+ Карточка' : '+ Card' },
                          { kind: 'banner', label: language === 'ru' ? '+ Баннер' : '+ Banner' },
                          { kind: 'badge', label: language === 'ru' ? '+ Метка' : '+ Label' },
                          { kind: 'epl-mini-app', label: language === 'ru' ? '+ EPL Модуль' : '+ EPL Mini-App' },
                        ] as const).map((item) => (
                          <button
                            key={item.kind}
                            type="button"
                            onClick={() => handleAddWidgetAt(item.kind)}
                            className={clsx(
                              'py-2 px-3 rounded-lg border text-xs font-medium text-left hover:border-[#10B981] cursor-pointer transition-colors',
                              inputCls
                            )}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(draftSpec.widgets || []).length > 0 && (
                      <div className="space-y-1.5">
                        <div className={clsx('text-[11px] font-medium', mutedTextCls)}>
                          {language === 'ru' ? 'Добавленные элементы' : 'Placed Elements'}
                        </div>
                        {draftSpec.widgets.map((w) => (
                          <div
                            key={w.id}
                            className={clsx(
                              'flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border',
                              inputCls
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedWidgetId(w.id)}
                              className="flex-1 text-left truncate font-medium hover:text-[#10B981] cursor-pointer"
                            >
                              {w.text}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateDraft((p) => ({
                                  ...p,
                                  widgets: p.widgets.filter((x) => x.id !== w.id),
                                }))
                              }
                              className="text-red-500 hover:text-red-400 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {inspectorTab === 'site' && (
              <div className="space-y-4">
                <div>
                  <div className={clsx('text-[11px] font-medium mb-1.5', mutedTextCls)}>
                    {language === 'ru' ? 'Готовые пресеты' : 'Quick Presets'}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {EPL_SHOP_STARTER_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          updateDraft((prev) => ({
                            ...p.apply(prev),
                            customCategories: prev.customCategories,
                            customTabs: prev.customTabs,
                            widgets: prev.widgets,
                            tabEplOverlays: prev.tabEplOverlays,
                            domTextOverrides: prev.domTextOverrides,
                            domStyleOverrides: prev.domStyleOverrides,
                          }))
                        }
                        className={clsx(
                          'px-2.5 py-1 rounded-lg border text-[11px] font-medium hover:border-[#10B981] cursor-pointer',
                          inputCls
                        )}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={clsx('block text-[11px] mb-1', mutedTextCls)}>
                      {language === 'ru' ? 'Название сайта' : 'Site Title'}
                    </label>
                    <input
                      type="text"
                      value={draftSpec.brandTitle || ''}
                      onChange={(e) => updateDraft((p) => ({ ...p, brandTitle: e.target.value }))}
                      placeholder="EPL Studio"
                      className={clsx('w-full px-2.5 py-1.5 rounded-lg border text-xs', inputCls)}
                    />
                  </div>
                  <div>
                    <label className={clsx('block text-[11px] mb-1', mutedTextCls)}>
                      {language === 'ru' ? 'Подзаголовок' : 'Subtitle'}
                    </label>
                    <input
                      type="text"
                      value={draftSpec.brandSubtitle || ''}
                      onChange={(e) =>
                        updateDraft((p) => ({ ...p, brandSubtitle: e.target.value }))
                      }
                      placeholder="Easy Programming Language"
                      className={clsx('w-full px-2.5 py-1.5 rounded-lg border text-xs', inputCls)}
                    />
                  </div>
                </div>

                <div>
                  <div className={clsx('text-[11px] font-medium mb-1.5', mutedTextCls)}>
                    {language === 'ru' ? 'Палитра сайта' : 'Site Palette'}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { k: 'canvasBg', label: language === 'ru' ? 'Фон окна' : 'Canvas BG', def: '#111315' },
                      { k: 'sidebarBg', label: language === 'ru' ? 'Меню' : 'Sidebar BG', def: '#181B20' },
                      { k: 'cardBg', label: language === 'ru' ? 'Карточки' : 'Cards BG', def: '#181B20' },
                      { k: 'accentColor', label: language === 'ru' ? 'Акцент' : 'Accent', def: '#10B981' },
                      { k: 'secondaryColor', label: language === 'ru' ? 'Второй цвет' : 'Secondary', def: '#38BDF8' },
                      { k: 'textColor', label: language === 'ru' ? 'Текст' : 'Text Color', def: '#F3F4F6' },
                      { k: 'borderColor', label: language === 'ru' ? 'Рамки' : 'Borders', def: '#262B33' },
                    ] as const).map((item) => (
                      <label
                        key={item.k}
                        className={clsx('flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border', inputCls)}
                      >
                        <span className="truncate text-[11px]">{item.label}</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            value={tSpec[item.k] || item.def}
                            onChange={(e) => setThemeField(item.k, e.target.value)}
                            className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
                          />
                          {tSpec[item.k] && (
                            <button
                              type="button"
                              onClick={() => setThemeField(item.k, '')}
                              className="text-[10px] opacity-60 hover:opacity-100 cursor-pointer"
                            >
                              ↺
                            </button>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={clsx('block text-[11px] mb-1', mutedTextCls)}>
                      {language === 'ru' ? 'Шрифт' : 'Font Family'}
                    </label>
                    <select
                      value={tSpec.fontFamily || 'default'}
                      onChange={(e) => setThemeField('fontFamily', e.target.value as EplSiteCustomizationSpec['theme']['fontFamily'])}
                      className={clsx('w-full px-2 py-1.5 rounded-lg border text-xs', inputCls)}
                    >
                      <option value="default">Default Sans</option>
                      <option value="mono">JetBrains Mono</option>
                      <option value="space">Geometric Sans</option>
                      <option value="serif">Editorial Serif</option>
                      <option value="rounded">Rounded UI</option>
                    </select>
                  </div>
                  <div>
                    <label className={clsx('block text-[11px] mb-1', mutedTextCls)}>
                      {language === 'ru' ? 'Эффект фона' : 'BG Effect'}
                    </label>
                    <select
                      value={tSpec.bgEffect || 'none'}
                      onChange={(e) => setThemeField('bgEffect', e.target.value as EplSiteCustomizationSpec['theme']['bgEffect'])}
                      className={clsx('w-full px-2 py-1.5 rounded-lg border text-xs', inputCls)}
                    >
                      <option value="none">None</option>
                      <option value="grid">Grid</option>
                      <option value="dots">Dots</option>
                      <option value="scanlines">Scanlines</option>
                      <option value="stars">Stars</option>
                      <option value="aurora">Aurora Glow</option>
                    </select>
                  </div>
                  <div>
                    <label className={clsx('block text-[11px] mb-1', mutedTextCls)}>
                      {language === 'ru' ? 'Позиция меню' : 'Sidebar Side'}
                    </label>
                    <div className="flex gap-1">
                      {(['left', 'right'] as const).map((side) => (
                        <button
                          key={side}
                          type="button"
                          onClick={() => setThemeField('sidebarSide', side)}
                          className={clsx(
                            'flex-1 py-1.5 rounded-lg border text-[11px] font-medium capitalize cursor-pointer',
                            (tSpec.sidebarSide || 'left') === side
                              ? 'bg-[#10B981] border-[#10B981] text-[#09120E]'
                              : inputCls
                          )}
                        >
                          {side}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={clsx('block text-[11px] mb-1 tabular-nums', mutedTextCls)}>
                      {language === 'ru'
                        ? `Скругление: ${tSpec.borderRadius ?? 12}px`
                        : `Radius: ${tSpec.borderRadius ?? 12}px`}
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={24}
                      value={tSpec.borderRadius ?? 12}
                      onChange={(e) => setThemeField('borderRadius', Number(e.target.value))}
                      className="w-full accent-[#10B981]"
                    />
                  </div>
                </div>
              </div>
            )}

            {inspectorTab === 'nav' && (
              <div className="space-y-4">
                <div className={clsx('p-3 rounded-lg border space-y-2', inputCls)}>
                  <div className="text-xs font-semibold">
                    {language === 'ru' ? 'Добавить категорию в меню' : 'Add Sidebar Category'}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCatLabel}
                      onChange={(e) => setNewCatLabel(e.target.value)}
                      placeholder={language === 'ru' ? 'Название...' : 'Name...'}
                      className={clsx('flex-1 px-2.5 py-1.5 rounded-lg border text-xs', surfaceCls)}
                    />
                    <input
                      type="color"
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                      className="w-8 h-8 rounded bg-transparent border-0 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="px-3 py-1.5 rounded-lg bg-[#10B981] text-[#09120E] font-semibold text-xs cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className={clsx('p-3 rounded-lg border space-y-2', inputCls)}>
                  <div className="text-xs font-semibold">
                    {language === 'ru' ? 'Добавить вкладку (EPL)' : 'Add Custom EPL Tab'}
                  </div>
                  <input
                    type="text"
                    value={newTabLabel}
                    onChange={(e) => setNewTabLabel(e.target.value)}
                    placeholder={language === 'ru' ? 'Название вкладки...' : 'Tab name...'}
                    className={clsx('w-full px-2.5 py-1.5 rounded-lg border text-xs', surfaceCls)}
                  />
                  <div className="grid grid-cols-3 gap-1.5">
                    <select
                      value={newTabCat}
                      onChange={(e) => setNewTabCat(e.target.value)}
                      className={clsx('col-span-2 px-2 py-1.5 rounded-lg border text-xs', surfaceCls)}
                    >
                      {allCategoryChoices.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={newTabBadge}
                      onChange={(e) => setNewTabBadge(e.target.value)}
                      placeholder="Badge"
                      className={clsx('px-2 py-1.5 rounded-lg border text-xs', surfaceCls)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 text-[11px]">
                      <span>{language === 'ru' ? 'Цвет:' : 'Color:'}</span>
                      <input
                        type="color"
                        value={newTabColor}
                        onChange={(e) => setNewTabColor(e.target.value)}
                        className="w-6 h-5 bg-transparent border-0 cursor-pointer"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleAddCustomTab}
                      className="px-3 py-1.5 rounded-lg bg-[#10B981] text-[#09120E] font-semibold text-xs cursor-pointer inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{language === 'ru' ? 'Создать' : 'Create'}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2 border-t border-current/10 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5 text-[#10B981]" />
                      {language === 'ru' ? 'EPL-код на вкладку' : 'EPL Code Injection'}
                    </span>
                  </div>
                  <select
                    value={selectedEplTargetTab}
                    onChange={(e) => setSelectedEplTargetTab(e.target.value)}
                    className={clsx('w-full px-2.5 py-1.5 rounded-lg border text-xs', inputCls)}
                  >
                    {overlayTabChoices.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {!isCustomTabSelected && selectedEplTargetTab !== 'global' && (
                    <div className="flex gap-1.5">
                      {(['top', 'bottom', 'replace'] as const).map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() =>
                            updateDraft((p) => ({
                              ...p,
                              tabEplOverlays: {
                                ...p.tabEplOverlays,
                                [selectedEplTargetTab]: {
                                  code: currentTabOverlay.code || DEFAULT_EPL_WIDGET_SAMPLE,
                                  position: pos,
                                },
                              },
                            }))
                          }
                          className={clsx(
                            'flex-1 py-1 rounded-lg border text-[11px] font-medium capitalize cursor-pointer',
                            currentTabOverlay.position === pos
                              ? 'bg-[#10B981] border-[#10B981] text-[#09120E]'
                              : inputCls
                          )}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  )}
                  <textarea
                    rows={6}
                    value={
                      isCustomTabSelected
                        ? selectedCustomTab?.eplCode || ''
                        : currentTabOverlay.code || ''
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (isCustomTabSelected) {
                        updateDraft((p) => ({
                          ...p,
                          customTabs: p.customTabs.map((t) =>
                            t.id === selectedEplTargetTab ? { ...t, eplCode: val } : t
                          ),
                        }));
                      } else if (selectedEplTargetTab === 'global') {
                        updateDraft((p) => ({ ...p, globalEplCode: val }));
                      } else {
                        updateDraft((p) => ({
                          ...p,
                          tabEplOverlays: {
                            ...p.tabEplOverlays,
                            [selectedEplTargetTab]: {
                              code: val,
                              position: currentTabOverlay.position || 'top',
                            },
                          },
                        }));
                      }
                    }}
                    placeholder="started?&#10;  create text_label { name=hi, text=&quot;Hello EPL!&quot;, x=20, y=20, color=#10b981 }&#10;end"
                    className={clsx('w-full p-2.5 rounded-lg border font-mono text-[11px]', inputCls)}
                  />
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Publish ("Готово") Modal — Native EPL Studio Modal */}
      {showPublishModal && (
        <div
          data-epl-builder-ui="true"
          className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            className={clsx(
              'w-full max-w-md rounded-xl border p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4',
              surfaceCls
            )}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {editingItemId
                  ? language === 'ru'
                    ? 'Сохранить изменения в EPL Shop'
                    : 'Update EPL Shop Item'
                  : language === 'ru'
                  ? 'Публикация в EPL Shop'
                  : 'Publish to EPL Shop'}
              </h3>
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="p-1.5 rounded-lg hover:bg-current/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className={clsx('block text-xs font-medium mb-1', mutedTextCls)}>
                {language === 'ru' ? 'Название' : 'Title'}
              </label>
              <input
                type="text"
                value={pubTitle}
                onChange={(e) => setPubTitle(e.target.value)}
                placeholder="Cyber Neon EPL Edition"
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:border-[#10B981]', inputCls)}
              />
            </div>

            <div>
              <label className={clsx('block text-xs font-medium mb-1', mutedTextCls)}>
                {language === 'ru' ? 'Описание' : 'Description'}
              </label>
              <textarea
                rows={3}
                value={pubDesc}
                onChange={(e) => setPubDesc(e.target.value)}
                placeholder={language === 'ru' ? 'Что меняет эта сборка...' : 'What this site build customizes...'}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm resize-none focus:outline-none focus:border-[#10B981]', inputCls)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={clsx('block text-xs font-medium mb-1', mutedTextCls)}>
                  {language === 'ru' ? 'Цена (EPL Coins)' : 'Price (EPL Coins)'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={pubPrice}
                  onChange={(e) => setPubPrice(Math.max(0, Number(e.target.value)))}
                  className={clsx('w-full px-3 py-2 rounded-lg border text-sm font-mono tabular-nums', inputCls)}
                />
              </div>

              <div>
                <label className={clsx('block text-xs font-medium mb-1', mutedTextCls)}>
                  {language === 'ru' ? 'Количество (Stock)' : 'Stock'}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPubInfiniteStock((v) => !v)}
                    className={clsx(
                      'px-2.5 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0',
                      pubInfiniteStock
                        ? 'bg-[#10B981]/15 border-[#10B981] text-[#10B981]'
                        : inputCls
                    )}
                  >
                    <InfinityIcon className="w-3.5 h-3.5" />
                    <span>∞</span>
                  </button>
                  {!pubInfiniteStock && (
                    <input
                      type="number"
                      min={1}
                      value={pubStockCount}
                      onChange={(e) => setPubStockCount(Math.max(1, Number(e.target.value)))}
                      className={clsx('w-full px-2.5 py-2 rounded-lg border text-sm font-mono tabular-nums', inputCls)}
                    />
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={clsx('text-xs font-medium', mutedTextCls)}>
                  {language === 'ru' ? 'Обложка темы' : 'Theme Cover'}
                </label>
                <button
                  type="button"
                  onClick={() => coverFileRef.current?.click()}
                  className="text-xs font-medium text-[#10B981] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{language === 'ru' ? 'Загрузить файл' : 'Upload Image'}</span>
                </button>
                <input
                  ref={coverFileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadCover}
                  className="hidden"
                />
              </div>
              <div className={clsx('aspect-video rounded-lg overflow-hidden border', inputCls)}>
                {pubCoverUrl && (
                  <img
                    src={pubCoverUrl}
                    alt="EPL Shop Theme Cover"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className={clsx('px-4 py-2 rounded-lg border text-sm font-medium cursor-pointer', inputCls)}
              >
                {language === 'ru' ? 'Назад' : 'Back'}
              </button>
              <button
                type="button"
                disabled={publishing}
                onClick={handlePublishShopItem}
                className="flex-1 py-2 px-5 rounded-lg bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-[#09120E] text-sm font-semibold cursor-pointer"
              >
                {publishing
                  ? language === 'ru'
                    ? 'Сохранение...'
                    : 'Saving...'
                  : editingItemId
                  ? language === 'ru'
                    ? 'Сохранить изменения'
                    : 'Save Changes'
                  : language === 'ru'
                  ? 'Опубликовать в EPL Shop'
                  : 'Publish to EPL Shop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
