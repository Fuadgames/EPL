import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  useStore,
  DEFAULT_NAV_CATEGORY_ORDER,
  DEFAULT_NAV_TAB_ORDERS,
} from '../store/useStore';
import {
  Store,
  Code2,
  Package,
  User,
  Settings,
  LogOut,
  Star,
  ArrowLeft,
  ShieldCheck,
  Trophy,
  Layers,
  Terminal,
  Coins,
  ShoppingBag,
  Newspaper,
  MonitorDown,
  Download,
  Eye,
  EyeOff,
  SlidersHorizontal,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  PanelBottomClose,
  PanelBottomOpen,
  Crown,
  MessageSquareHeart,
  Palette,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from 'lucide-react';
import { logOut } from '../firebase';
import { clsx } from 'clsx';
import { translations } from '../lib/translations';
import AuthModal from './AuthModal';
import AppDetailView from './AppDetailView';
import DesktopDownloadModal from './DesktopDownloadModal';
import ExtraPremiumReceiver from './ExtraPremiumReceiver';
import EplShopBuilderOverlay from './EplShopBuilderOverlay';
import EplEmbeddedRunner from './EplEmbeddedRunner';
import { getDefaultAvatar } from '../lib/avatar';
import UserRoleBadge from './UserRoleBadge';
import VerifiedBadge from './VerifiedBadge';
import { resolveEffectiveTier } from '../lib/premiumTiers';
import { getActiveSiteSpec, resolveSiteLabel } from '../lib/siteSpecRenderer';
import { EplCustomWidget } from '../types';
import { notify } from '../store/useDialogStore';

interface NavTabDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  isEpicExtra?: boolean;
  badge?: string;
  customColor?: string;
}

interface NavCategoryDef {
  id: string;
  label: string;
  color?: string;
  tabs: NavTabDef[];
}

function getFontCss(font?: string): string | undefined {
  switch (font) {
    case 'mono':
      return '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace';
    case 'space':
      return '"Space Grotesk", "Inter", system-ui, sans-serif';
    case 'serif':
      return 'Georgia, Cambria, "Times New Roman", serif';
    case 'rounded':
      return 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif';
    default:
      return undefined;
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const currentView = useStore((state) => state.currentView);
  const setCurrentView = useStore((state) => state.setCurrentView);
  const user = useStore((state) => state.user);
  const theme = useStore((state) => state.theme);
  const language = useStore((state) => state.language);
  const isPremium = useStore((state) => state.isPremium);
  const premiumTier = useStore((state) => state.premiumTier);
  const selectedAppId = useStore((state) => state.selectedAppId);
  const userData = useStore((state) => state.userData);
  const effectivePremiumTier = resolveEffectiveTier(
    isPremium || userData?.isPremium,
    userData?.premiumTier || premiumTier
  );
  const hasActivePremium = effectivePremiumTier !== 'none';
  const isAuthModalOpen = useStore((state) => state.isAuthModalOpen);
  const setIsAuthModalOpen = useStore((state) => state.setIsAuthModalOpen);
  const isFrutigerAero = useStore((state) => state.isFrutigerAero);
  const setUser = useStore((state) => state.setUser);
  const setUserData = useStore((state) => state.setUserData);
  const simulatedRole = useStore((state) => state.simulatedRole);
  const hiddenTabs = useStore((state) => state.hiddenTabs) || [];
  const hideTab = useStore((state) => state.hideTab);
  const showTab = useStore((state) => state.showTab);
  const toggleTabVisibility = useStore((state) => state.toggleTabVisibility);
  const restoreAllTabs = useStore((state) => state.restoreAllTabs);
  const isSidebarHidden = useStore((state) => state.isSidebarHidden);
  const setIsSidebarHidden = useStore((state) => state.setIsSidebarHidden);
  const toggleSidebarHidden = useStore((state) => state.toggleSidebarHidden);
  const isMobileNavHidden = useStore((state) => state.isMobileNavHidden);
  const setIsMobileNavHidden = useStore((state) => state.setIsMobileNavHidden);
  const setIsDesktopDownloadOpen = useStore((state) => state.setIsDesktopDownloadOpen);

  // Navigation categorization & sorting
  const legacyNavigation = useStore((state) => state.legacyNavigation);
  const collapsedNavCategories = useStore((state) => state.collapsedNavCategories) || [];
  const toggleNavCategoryCollapsed = useStore((state) => state.toggleNavCategoryCollapsed);
  const navCategoryOrder = useStore((state) => state.navCategoryOrder) || DEFAULT_NAV_CATEGORY_ORDER;
  const moveNavCategory = useStore((state) => state.moveNavCategory);
  const reorderNavCategories = useStore((state) => state.reorderNavCategories);
  const navTabOrders = useStore((state) => state.navTabOrders) || DEFAULT_NAV_TAB_ORDERS;
  const reorderNavTab = useStore((state) => state.reorderNavTab);
  const moveNavTab = useStore((state) => state.moveNavTab);
  const resetNavOrder = useStore((state) => state.resetNavOrder);

  // EPL Shop live customization spec
  const isEplShopBuilderOpen = useStore((state) => state.isEplShopBuilderOpen);
  const eplShopPreviewMode = useStore((state) => state.eplShopPreviewMode);
  const eplShopBuilderTool = useStore((state) => state.eplShopBuilderTool);
  const draftEplShopSpec = useStore((state) => state.draftEplShopSpec);
  const appliedEplShopSpec = useStore((state) => state.appliedEplShopSpec);
  const previewEplShopSpec = useStore((state) => state.previewEplShopSpec);
  const setPreviewEplShopSpec = useStore((state) => state.setPreviewEplShopSpec);
  const updateDraftEplShopSpec = useStore((state) => state.updateDraftEplShopSpec);
  const selectedBuilderWidgetId = useStore((state) => state.selectedBuilderWidgetId);
  const setSelectedBuilderWidgetId = useStore((state) => state.setSelectedBuilderWidgetId);

  const activeSiteSpec = getActiveSiteSpec({
    isEplShopBuilderOpen,
    draftEplShopSpec,
    previewEplShopSpec,
    appliedEplShopSpec,
  });

  const t = translations[language];
  const [isCustomizeTabs, setIsCustomizeTabs] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [dragCategoryId, setDragCategoryId] = useState<string | null>(null);
  const [dragTabState, setDragTabState] = useState<{ catId: string; tabId: string } | null>(null);

  const mobileNavRef = useRef<HTMLDivElement>(null);
  const mobileTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        e.preventDefault();
        toggleSidebarHidden();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleSidebarHidden]);

  const handleLogOut = async () => {
    try {
      await logOut();
    } catch (e) {
      console.error(e);
    }
    setUser(null);
    setUserData(null);
  };

  const actualRole = userData?.role || 'user';
  const effectiveRole = actualRole === 'developer' && simulatedRole ? simulatedRole : actualRole;
  const isStaff =
    effectiveRole === 'developer' ||
    effectiveRole === 'admin' ||
    effectiveRole === 'moderator';

  useEffect(() => {
    if (currentView === 'control' && !isStaff) {
      setCurrentView('store');
    }
  }, [currentView, isStaff, setCurrentView]);

  useEffect(() => {
    const btn = mobileTabRefs.current[currentView];
    if (btn && typeof btn.scrollIntoView === 'function') {
      btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [currentView]);

  const [isPending, startTransition] = useTransition();

  const handleNavClick = (view: string) => {
    startTransition(() => {
      setCurrentView(view as any);
    });
  };

  // Master tab definitions map (preserving icons & permissions)
  const tabRegistry = useMemo<Record<string, NavTabDef>>(() => {
    const base: Record<string, NavTabDef> = {
      store: {
        id: 'store',
        label: resolveSiteLabel(activeSiteSpec, 'nav.store', 'App Store'),
        icon: Store,
        permission: 'accessRecent',
      },
      'asset-store': {
        id: 'asset-store',
        label: resolveSiteLabel(activeSiteSpec, 'nav.asset-store', 'Asset Store'),
        icon: ShoppingBag,
        permission: 'accessAssetStore',
      },
      'epl-shop': {
        id: 'epl-shop',
        label: resolveSiteLabel(activeSiteSpec, 'nav.epl-shop', 'EPL Shop'),
        icon: Palette,
      },
      donate: {
        id: 'donate',
        label: resolveSiteLabel(
          activeSiteSpec,
          'nav.donate',
          language === 'ru' ? 'Поддержать' : 'Donate'
        ),
        icon: Coins,
      },
      editor: {
        id: 'editor',
        label: resolveSiteLabel(activeSiteSpec, 'nav.editor', translations[language].editor),
        icon: Code2,
        permission: 'publishApps',
      },
      settings: {
        id: 'settings',
        label: resolveSiteLabel(activeSiteSpec, 'nav.settings', translations[language].settings),
        icon: Settings,
      },
      'installed-apps': {
        id: 'installed-apps',
        label: resolveSiteLabel(
          activeSiteSpec,
          'nav.installed-apps',
          translations[language].installedApps || 'Installed Apps'
        ),
        icon: Layers,
      },
      profile: {
        id: 'profile',
        label: resolveSiteLabel(activeSiteSpec, 'nav.profile', translations[language].profile),
        icon: User,
      },
      'my-apps': {
        id: 'my-apps',
        label: resolveSiteLabel(activeSiteSpec, 'nav.my-apps', translations[language].myApps),
        icon: Package,
      },
      leaderboards: {
        id: 'leaderboards',
        label: resolveSiteLabel(
          activeSiteSpec,
          'nav.leaderboards',
          language === 'ru' ? 'Рейтинги' : 'Leaderboards'
        ),
        icon: Trophy,
      },
      news: {
        id: 'news',
        label: resolveSiteLabel(
          activeSiteSpec,
          'nav.news',
          translations[language].news || (language === 'ru' ? 'Новости' : 'News')
        ),
        icon: Newspaper,
      },
      rate: {
        id: 'rate',
        label: resolveSiteLabel(
          activeSiteSpec,
          'nav.rate',
          language === 'ru' ? 'Оценить' : 'Rate'
        ),
        icon: MessageSquareHeart,
      },
      premium: {
        id: 'premium',
        label: resolveSiteLabel(activeSiteSpec, 'nav.premium', translations[language].premium),
        icon: Star,
        permission: 'accessPremium',
      },
      ...(hasActivePremium
        ? {
            'extra-premium': {
              id: 'extra-premium',
              label: resolveSiteLabel(
                activeSiteSpec,
                'nav.extra-premium',
                'Extra Premium Access'
              ),
              icon: Crown,
              permission: 'accessPremium',
              isEpicExtra: true,
            },
          }
        : {}),
      ...(isStaff
        ? {
            control: {
              id: 'control',
              label: resolveSiteLabel(activeSiteSpec, 'nav.control', 'Control'),
              icon: ShieldCheck,
              permission: 'accessControl',
            },
          }
        : {}),
    };

    (activeSiteSpec?.customTabs || []).forEach((ct) => {
      base[ct.id] = {
        id: ct.id,
        label: ct.label,
        icon: Sparkles,
        badge: ct.badge,
        customColor: ct.color,
      };
    });

    return base;
  }, [activeSiteSpec, language, hasActivePremium, isStaff]);

  const isTabPermitted = (tab: NavTabDef) => {
    if (!tab) return false;
    if (tab.id === 'control' && !isStaff) return false;
    if (actualRole === 'developer' || actualRole === 'admin') return true;
    if (tab.permission && userData?.permissions) {
      const permKey = tab.permission as keyof typeof userData.permissions;
      return userData.permissions[permKey] !== false;
    }
    return true;
  };

  // Flat list used for Legacy Navigation, Mobile Bottom Bar, and Hidden Tab Counter
  const flatPermittedItems = useMemo<NavTabDef[]>(() => {
    const baseFlatOrder = [
      'store',
      'installed-apps',
      'leaderboards',
      'editor',
      'my-apps',
      'asset-store',
      'epl-shop',
      'donate',
      'premium',
      ...(hasActivePremium ? ['extra-premium'] : []),
      'profile',
      ...(isStaff ? ['control'] : []),
      'rate',
      'news',
      'settings',
      ...(activeSiteSpec?.customTabs || []).map((c) => c.id),
    ];
    const specHidden = activeSiteSpec?.hiddenTabIds || [];
    return baseFlatOrder
      .map((id) => tabRegistry[id])
      .filter((item): item is NavTabDef => !!item && isTabPermitted(item) && !specHidden.includes(item.id));
  }, [tabRegistry, hasActivePremium, isStaff, activeSiteSpec, actualRole, userData]);

  const visibleNavItems = flatPermittedItems.filter(
    (item) => item.id === 'settings' || !hiddenTabs.includes(item.id)
  );
  const hiddenPermittedItems = flatPermittedItems.filter(
    (item) => item.id !== 'settings' && hiddenTabs.includes(item.id)
  );

  // Build 6 Categorized Sections + Custom Categories from active EPL Shop Spec
  const categorizedNav = useMemo<NavCategoryDef[]>(() => {
    const defaultCategoryLabels: Record<string, string> = {
      store: language === 'ru' ? 'Магазин' : 'Store',
      tools: language === 'ru' ? 'Инструменты' : 'Tools',
      'my-stuff': language === 'ru' ? 'Моё' : 'My Stuff',
      global: language === 'ru' ? 'Глобальное' : 'Global',
      paid: language === 'ru' ? 'Платное' : 'Paid',
      'developer-tools': language === 'ru' ? 'Для разработчиков' : 'Developer Tools',
    };

    const customCats = activeSiteSpec?.customCategories || [];
    const customCatMap = new Map(customCats.map((c) => [c.id, c]));

    const combinedCatOrderRaw = [
      ...(navCategoryOrder || DEFAULT_NAV_CATEGORY_ORDER),
      ...(activeSiteSpec?.categoryOrder || []),
      ...DEFAULT_NAV_CATEGORY_ORDER,
      ...customCats.map((c) => c.id),
    ];
    const uniqueCatOrder = Array.from(new Set(combinedCatOrderRaw));
    const specHidden = activeSiteSpec?.hiddenTabIds || [];

    return uniqueCatOrder
      .filter((catId) => {
        if (catId === 'developer-tools' && !isStaff) return false;
        return !!defaultCategoryLabels[catId] || customCatMap.has(catId);
      })
      .map((catId) => {
        const customCat = customCatMap.get(catId);
        const defaultTabIds = DEFAULT_NAV_TAB_ORDERS[catId] || [];
        const specTabIds = activeSiteSpec?.tabOrders?.[catId] || [];
        const storeTabIds = navTabOrders?.[catId] || [];
        const customTabsInCat = (activeSiteSpec?.customTabs || [])
          .filter((ct) => ct.categoryId === catId)
          .map((ct) => ct.id);

        const mergedTabIds = Array.from(
          new Set([...storeTabIds, ...specTabIds, ...defaultTabIds, ...customTabsInCat])
        );

        const resolvedTabs = mergedTabIds
          .map((tid) => tabRegistry[tid])
          .filter(
            (tab): tab is NavTabDef =>
              !!tab && isTabPermitted(tab) && !specHidden.includes(tab.id)
          );

        const label =
          activeSiteSpec?.categoryNames?.[catId] ||
          customCat?.label ||
          resolveSiteLabel(
            activeSiteSpec,
            `cat.${catId}`,
            defaultCategoryLabels[catId] || catId
          );

        return {
          id: catId,
          label,
          color: activeSiteSpec?.categoryColors?.[catId] || customCat?.color,
          tabs: resolvedTabs,
        };
      })
      .filter((cat) => cat.tabs.length > 0 || customCatMap.has(cat.id));
  }, [
    activeSiteSpec,
    language,
    navCategoryOrder,
    navTabOrders,
    tabRegistry,
    isStaff,
    actualRole,
    userData,
  ]);

  // Safely apply AND restore live DOM text, style & transform overrides when an EPL Shop spec is active
  useEffect(() => {
    const root = document.getElementById('epl-site-root');
    if (!root) return;
    const textOverrides = activeSiteSpec?.domTextOverrides || {};
    const styleOverrides = activeSiteSpec?.domStyleOverrides || {};

    const findLeafTextHost = (el: HTMLElement): HTMLElement | null => {
      if (el.children.length === 0) return el;
      const spans = Array.from(el.querySelectorAll<HTMLElement>('span, p, strong, em, label'));
      const nonEmpty = spans.find(
        (s) => s.children.length === 0 && (s.textContent || '').trim().length > 0
      );
      return nonEmpty || null;
    };

    const findDirectTextNode = (el: HTMLElement): Text | null => {
      for (const node of Array.from(el.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE && (node.textContent || '').trim().length > 0) {
          return node as Text;
        }
      }
      return null;
    };

    const restoreElement = (el: HTMLElement) => {
      if (el.dataset.eplTouched !== '1') return;
      el.style.backgroundColor = el.dataset.eplOrigBg ?? '';
      el.style.color = el.dataset.eplOrigColor ?? '';
      el.style.borderColor = el.dataset.eplOrigBorder ?? '';
      el.style.borderRadius = el.dataset.eplOrigRadius ?? '';
      el.style.fontSize = el.dataset.eplOrigFontSize ?? '';
      el.style.transform = el.dataset.eplOrigTransform ?? '';
      el.style.display = el.dataset.eplOrigDisplay ?? '';

      const leaf = findLeafTextHost(el);
      if (leaf && leaf.dataset.eplOrigLeafText !== undefined) {
        leaf.textContent = leaf.dataset.eplOrigLeafText;
        delete leaf.dataset.eplOrigLeafText;
      } else if (el.dataset.eplOrigDirectText !== undefined) {
        const tn = findDirectTextNode(el);
        if (tn) tn.textContent = el.dataset.eplOrigDirectText;
        delete el.dataset.eplOrigDirectText;
      }
      delete el.dataset.eplTouched;
    };

    const touchedEls = root.querySelectorAll<HTMLElement>('[data-epl-touched="1"]');
    if (!activeSiteSpec || (Object.keys(textOverrides).length === 0 && Object.keys(styleOverrides).length === 0)) {
      touchedEls.forEach(restoreElement);
      return;
    }

    const candidates = root.querySelectorAll<HTMLElement>(
      'button, a, h1, h2, h3, [data-epl-key]'
    );
    const activeSet = new Set<HTMLElement>();

    candidates.forEach((el) => {
      if (el.closest('[data-epl-builder-ui="true"]')) return;
      if (!el.dataset.eplOrigKey) {
        const explicit = el.getAttribute('data-epl-key');
        const raw = (el.textContent || '').trim().slice(0, 42).replace(/\s+/g, ' ');
        el.dataset.eplOrigKey = explicit || (raw ? `${el.tagName.toLowerCase()}:${raw}` : '');
      }
      const key = el.dataset.eplOrigKey;
      if (!key) return;

      const styleOvr = styleOverrides[key];
      const txtOvr = textOverrides[key];
      if (!styleOvr && !(txtOvr && txtOvr.trim())) {
        return;
      }

      activeSet.add(el);

      if (el.dataset.eplTouched !== '1') {
        el.dataset.eplTouched = '1';
        el.dataset.eplOrigBg = el.style.backgroundColor || '';
        el.dataset.eplOrigColor = el.style.color || '';
        el.dataset.eplOrigBorder = el.style.borderColor || '';
        el.dataset.eplOrigRadius = el.style.borderRadius || '';
        el.dataset.eplOrigFontSize = el.style.fontSize || '';
        el.dataset.eplOrigTransform = el.style.transform || '';
        el.dataset.eplOrigDisplay = el.style.display || '';
      }

      if (styleOvr) {
        el.style.backgroundColor = styleOvr.bg || (el.dataset.eplOrigBg ?? '');
        el.style.color = styleOvr.color || (el.dataset.eplOrigColor ?? '');
        el.style.borderColor = styleOvr.borderColor || (el.dataset.eplOrigBorder ?? '');
        el.style.borderRadius =
          styleOvr.radius !== undefined ? `${styleOvr.radius}px` : (el.dataset.eplOrigRadius ?? '');
        el.style.fontSize =
          styleOvr.fontSize !== undefined ? `${styleOvr.fontSize}px` : (el.dataset.eplOrigFontSize ?? '');
        el.style.transform =
          styleOvr.tx || styleOvr.ty
            ? `translate(${Math.round(styleOvr.tx || 0)}px, ${Math.round(styleOvr.ty || 0)}px)`
            : (el.dataset.eplOrigTransform ?? '');
        el.style.display = styleOvr.hidden ? 'none' : (el.dataset.eplOrigDisplay ?? '');
      }

      const leaf = findLeafTextHost(el);
      if (leaf) {
        if (txtOvr && txtOvr.trim()) {
          if (leaf.dataset.eplOrigLeafText === undefined) {
            leaf.dataset.eplOrigLeafText = leaf.textContent || '';
          }
          if (leaf.textContent !== txtOvr) {
            leaf.textContent = txtOvr;
          }
        } else if (leaf.dataset.eplOrigLeafText !== undefined) {
          leaf.textContent = leaf.dataset.eplOrigLeafText;
          delete leaf.dataset.eplOrigLeafText;
        }
      } else {
        const tn = findDirectTextNode(el);
        if (tn) {
          if (txtOvr && txtOvr.trim()) {
            if (el.dataset.eplOrigDirectText === undefined) {
              el.dataset.eplOrigDirectText = tn.textContent || '';
            }
            if (tn.textContent !== txtOvr) {
              tn.textContent = ` ${txtOvr}`;
            }
          } else if (el.dataset.eplOrigDirectText !== undefined) {
            tn.textContent = el.dataset.eplOrigDirectText;
            delete el.dataset.eplOrigDirectText;
          }
        }
      }
    });

    touchedEls.forEach((el) => {
      if (!activeSet.has(el)) {
        restoreElement(el);
      }
    });
  }, [activeSiteSpec, currentView, legacyNavigation]);

  // Draggable custom widget position tracking
  const draggingWidgetRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const suppressWidgetClickRef = useRef(false);

  useEffect(() => {
    if (!isEplShopBuilderOpen || eplShopPreviewMode || eplShopBuilderTool === 'tap') {
      draggingWidgetRef.current = null;
      return;
    }
    const onMove = (e: PointerEvent) => {
      const drag = draggingWidgetRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        drag.moved = true;
      }
      const nx = Math.max(8, Math.round(drag.origX + dx));
      const ny = Math.max(8, Math.round(drag.origY + dy));
      updateDraftEplShopSpec((prev) => ({
        ...prev,
        widgets: (prev.widgets || []).map((w) =>
          w.id === drag.id ? { ...w, x: nx, y: ny } : w
        ),
      }));
    };
    const onUp = () => {
      if (draggingWidgetRef.current?.moved) {
        suppressWidgetClickRef.current = true;
        setTimeout(() => {
          suppressWidgetClickRef.current = false;
        }, 120);
      }
      draggingWidgetRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [isEplShopBuilderOpen, eplShopPreviewMode, eplShopBuilderTool, updateDraftEplShopSpec]);

  const isLight = theme === 'light' && !isFrutigerAero;
  const specTheme = activeSiteSpec?.theme;
  const sidebarSide = specTheme?.sidebarSide || 'left';
  const sidebarWidth = specTheme?.sidebarWidth || 256;
  const customFontFamily = getFontCss(specTheme?.fontFamily);
  const brandTitle =
    activeSiteSpec?.brandTitle?.trim() || (isPremium ? 'EPL Premium' : 'EPL Studio');
  const brandSubtitle =
    activeSiteSpec?.brandSubtitle?.trim() || 'Easy Programming Language';
  const desktopCtaLabel = resolveSiteLabel(
    activeSiteSpec,
    'cta.desktopApp',
    'Download Desktop App'
  );

  const visibleWidgets: EplCustomWidget[] = (activeSiteSpec?.widgets || []).filter(
    (w) => !w.visibleOn || w.visibleOn === 'all' || w.visibleOn === currentView
  );

  // Dynamic CSS override block when a custom EPL Shop theme is active
  const dynamicThemeCss = useMemo(() => {
    if (!specTheme) return '';
    const rules: string[] = [];
    if (specTheme.cardBg) {
      rules.push(
        `#epl-main-workspace article, #epl-main-workspace section:not([data-epl-builder-ui="true"]) { background-color: ${specTheme.cardBg} !important; }`
      );
    }
    if (specTheme.borderColor) {
      rules.push(
        `#epl-site-root aside, #epl-main-workspace article, #epl-main-workspace section { border-color: ${specTheme.borderColor} !important; }`
      );
    }
    if (specTheme.borderRadius !== undefined && specTheme.borderRadius !== 12) {
      rules.push(
        `#epl-main-workspace article, #epl-main-workspace section { border-radius: ${specTheme.borderRadius}px !important; }`
      );
    }
    if (specTheme.accentColor && specTheme.glowIntensity && specTheme.glowIntensity > 0) {
      rules.push(
        `#epl-main-workspace article, #epl-main-workspace section { box-shadow: 0 0 ${specTheme.glowIntensity}px ${specTheme.accentColor}28; }`
      );
    }
    return rules.join('\n');
  }, [specTheme]);

  const renderDesktopTabButton = (item: NavTabDef, catId?: string) => {
    const active = currentView === item.id;
    const canHide = item.id !== 'settings';
    const isEpicExtra = !!item.isEpicExtra;

    return (
      <div
        key={catId ? `${catId}::${item.id}` : item.id}
        draggable={!!catId && !isCustomizeTabs}
        onDragStart={() => {
          if (catId) setDragTabState({ catId, tabId: item.id });
        }}
        onDragOver={(e) => {
          if (catId && dragTabState && dragTabState.catId === catId && dragTabState.tabId !== item.id) {
            e.preventDefault();
          }
        }}
        onDrop={(e) => {
          if (catId && dragTabState && dragTabState.catId === catId && dragTabState.tabId !== item.id) {
            e.preventDefault();
            reorderNavTab(catId, dragTabState.tabId, item.id);
            setDragTabState(null);
          }
        }}
        onDragEnd={() => setDragTabState(null)}
        className="group relative flex items-center"
      >
        <button
          onClick={() => handleNavClick(item.id)}
          style={
            active && specTheme?.accentColor && !isEpicExtra
              ? {
                  backgroundColor: `${specTheme.accentColor}22`,
                  color: specTheme.accentColor,
                  borderColor: `${specTheme.accentColor}66`,
                }
              : item.customColor && !active
              ? { borderLeft: `3px solid ${item.customColor}` }
              : undefined
          }
          className={clsx(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap shrink-0 border cursor-pointer',
            canHide && 'pr-8',
            isEpicExtra
              ? active
                ? 'bg-gradient-to-r from-amber-400 via-fuchsia-500 to-cyan-400 text-black font-extrabold border-amber-200 shadow-[0_0_22px_rgba(245,158,11,0.45)]'
                : effectivePremiumTier === 'ultra'
                  ? 'bg-gradient-to-r from-amber-500/20 via-pink-500/15 to-cyan-500/20 border-amber-400/55 text-amber-300 hover:border-amber-300 hover:shadow-[0_0_16px_rgba(245,158,11,0.3)] font-bold'
                  : effectivePremiumTier === 'premium'
                    ? 'bg-gradient-to-r from-violet-500/20 to-emerald-500/20 border-violet-400/50 text-violet-300 hover:border-violet-300 font-bold'
                    : 'bg-sky-500/15 border-sky-400/40 text-sky-300 hover:border-sky-300 font-semibold'
              : active
                ? isFrutigerAero
                  ? 'frutiger-aero-button border-white/80'
                  : isLight
                    ? 'bg-[#059669]/10 text-[#059669] border-[#059669]/25 font-semibold'
                    : 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/25 font-semibold'
                : isFrutigerAero
                  ? 'border-transparent text-[#062038]/80 hover:bg-white/40'
                  : isLight
                    ? 'border-transparent text-[#4B5563] hover:bg-[#F5F6F8] hover:text-[#111315]'
                    : 'border-transparent text-[#9CA3AF] hover:bg-[#20242B] hover:text-[#F3F4F6]'
          )}
        >
          <item.icon
            className={clsx(
              'w-4 h-4 shrink-0',
              isEpicExtra && !active && 'text-amber-400'
            )}
          />
          <span className="truncate flex-1 text-left">{item.label}</span>
          {item.badge && (
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#10B981]/20 text-[#10B981]">
              {item.badge}
            </span>
          )}
        </button>
        {canHide && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              hideTab(item.id);
            }}
            title={language === 'ru' ? 'Скрыть вкладку' : 'Hide tab'}
            className={clsx(
              'absolute right-1.5 p-1 rounded-md opacity-0 group-hover:opacity-80 hover:!opacity-100 transition-opacity cursor-pointer',
              isLight ? 'hover:bg-black/10 text-[#6B7280]' : 'hover:bg-white/10 text-[#9CA3AF]'
            )}
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      id="epl-site-root"
      style={{
        fontFamily: customFontFamily,
        fontSize: specTheme?.fontScale ? `${specTheme.fontScale * 100}%` : undefined,
        color: specTheme?.textColor || undefined,
      }}
      className={clsx(
        'flex flex-col h-[100dvh] w-full transition-colors duration-150 overflow-hidden relative',
        sidebarSide === 'right' ? 'md:flex-row-reverse' : 'md:flex-row',
        isFrutigerAero
          ? 'frutiger-aero-bg text-[#062038]'
          : isLight
          ? 'bg-[#F5F6F8] text-[#111315]'
          : 'bg-[#111315] text-[#F3F4F6]'
      )}
    >
      {dynamicThemeCss && <style>{dynamicThemeCss}</style>}

      {isPending && (
        <div className="fixed top-0 left-0 w-full h-0.5 bg-[#10B981]/25 z-[1000] overflow-hidden">
          <div className="h-full w-1/3 bg-[#10B981] transition-transform" />
        </div>
      )}

      {/* Floating Restore Sidebar Button when Sidebar is Hidden (Desktop) */}
      {isSidebarHidden && (
        <button
          type="button"
          onClick={() => setIsSidebarHidden(false)}
          title={language === 'ru' ? 'Вернуть боковое меню (Ctrl+B)' : 'Show sidebar (Ctrl+B)'}
          className={clsx(
            'hidden md:inline-flex fixed top-3 z-40 items-center gap-2 px-3 py-2 rounded-xl border shadow-lg backdrop-blur-md text-xs font-semibold transition-all hover:scale-[1.03] cursor-pointer',
            sidebarSide === 'right' ? 'right-3' : 'left-3',
            isFrutigerAero
              ? 'frutiger-aero-button border-white'
              : isLight
                ? 'bg-white/95 border-[#E2E5EA] text-[#111315] hover:border-[#059669]'
                : 'bg-[#181B20]/95 border-[#262B33] text-[#F3F4F6] hover:border-[#10B981]'
          )}
        >
          <PanelLeftOpen className="w-4 h-4 text-[#10B981]" />
          <span>{language === 'ru' ? 'Меню' : 'Menu'}</span>
        </button>
      )}

      {/* Desktop Sidebar */}
      {!isSidebarHidden && (
        <aside
          style={{
            width: `${sidebarWidth}px`,
            backgroundColor: specTheme?.sidebarBg || undefined,
            borderColor: specTheme?.borderColor || undefined,
          }}
          className={clsx(
            'hidden md:flex shrink-0 flex-col relative z-10 h-[100dvh]',
            sidebarSide === 'right' ? 'border-l' : 'border-r',
            isFrutigerAero
              ? 'frutiger-aero-glass border-white/50'
              : isLight
              ? 'border-[#E2E5EA] bg-[#FFFFFF]'
              : 'border-[#262B33] bg-[#181B20]'
          )}
        >
          <div className="flex flex-col h-full p-4">
            {/* Clean IDE Brand Header + Hide Whole Panel Button */}
            <div className="px-2 pt-1 pb-4 mb-3 border-b border-current/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  style={
                    specTheme?.accentColor
                      ? {
                          color: specTheme.accentColor,
                          borderColor: `${specTheme.accentColor}55`,
                          backgroundColor: `${specTheme.accentColor}1A`,
                        }
                      : undefined
                  }
                  className={clsx(
                    'w-8 h-8 rounded-lg flex items-center justify-center border shrink-0',
                    isFrutigerAero
                      ? 'bg-white/60 border-white text-[#0284c7]'
                      : isLight
                      ? 'bg-[#059669]/10 border-[#059669]/30 text-[#059669]'
                      : 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
                  )}
                >
                  <Terminal className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h1
                    className={clsx(
                      'text-base font-bold tracking-tight leading-none truncate',
                      isFrutigerAero
                        ? 'frutiger-aero-text'
                        : isLight
                        ? 'text-[#111315]'
                        : 'text-[#F3F4F6]'
                    )}
                  >
                    {brandTitle}
                  </h1>
                  <p
                    className={clsx(
                      'text-[11px] mt-1 font-mono truncate',
                      isFrutigerAero
                        ? 'text-[#1e4b73]'
                        : isLight
                        ? 'text-[#6B7280]'
                        : 'text-[#9CA3AF]'
                    )}
                  >
                    {brandSubtitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSidebarHidden(true)}
                title={language === 'ru' ? 'Скрыть панель (Ctrl+B)' : 'Hide panel (Ctrl+B)'}
                className={clsx(
                  'p-1.5 rounded-lg border transition-colors shrink-0 cursor-pointer',
                  isFrutigerAero
                    ? 'border-white/60 text-[#1e4b73] hover:bg-white/50'
                    : isLight
                      ? 'border-[#E2E5EA] text-[#6B7280] hover:bg-[#F5F6F8] hover:text-[#111315]'
                      : 'border-[#262B33] text-[#9CA3AF] hover:bg-[#20242B] hover:text-[#F3F4F6]'
                )}
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            {/* Account Summary */}
            <div
              className={clsx(
                'mb-3 pb-3 border-b',
                isFrutigerAero
                  ? 'border-white/40'
                  : isLight
                  ? 'border-[#E2E5EA]'
                  : 'border-[#262B33]'
              )}
            >
              {user ? (
                <div className="flex items-center gap-2.5 px-1.5 py-1">
                  <img
                    src={user.photoURL || userData?.avatarUrl || getDefaultAvatar(user.uid)}
                    alt="Avatar"
                    className={clsx(
                      'w-8 h-8 rounded-lg object-cover shrink-0 border',
                      isFrutigerAero
                        ? 'border-white/80'
                        : isLight
                        ? 'border-[#E2E5EA] bg-[#F5F6F8]'
                        : 'border-[#262B33] bg-[#111315]'
                    )}
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 min-w-0">
                      {userData?.isVerifiedAuthor && <VerifiedBadge size="xs" />}
                      <span className="text-sm font-semibold truncate">
                        {userData?.name || user.displayName || 'User'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={clsx(
                          'text-[11px] font-mono-num font-medium',
                          isFrutigerAero
                            ? 'text-[#0284c7]'
                            : isLight
                            ? 'text-[#059669]'
                            : 'text-[#10B981]'
                        )}
                      >
                        {userData?.eplCoins || 0} Coins
                      </span>
                      <UserRoleBadge
                        role={effectiveRole}
                        isVerifiedAuthor={false}
                        size="xs"
                        showLabel
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleLogOut}
                    title={language === 'ru' ? 'Выйти' : 'Sign out'}
                    className={clsx(
                      'p-1.5 rounded-lg transition-colors shrink-0 cursor-pointer',
                      isFrutigerAero
                        ? 'text-[#1e4b73] hover:bg-white/40 hover:text-red-600'
                        : isLight
                        ? 'text-[#6B7280] hover:bg-[#F5F6F8] hover:text-[#DC2626]'
                        : 'text-[#9CA3AF] hover:bg-[#20242B] hover:text-[#DC2626]'
                    )}
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className={clsx(
                    'w-full py-2 px-3 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer',
                    isFrutigerAero
                      ? 'frutiger-aero-button'
                      : isLight
                      ? 'bg-[#059669] hover:bg-[#047857] text-white'
                      : 'bg-[#10B981] hover:bg-[#059669] text-[#09120E]'
                  )}
                >
                  {t.auth.signIn}
                </button>
              )}
            </div>

            {/* Navigation Header & Tab/Sort Customization Controls */}
            <div className="flex items-center justify-between px-2 mb-1.5 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                {isCustomizeTabs
                  ? language === 'ru'
                    ? 'Сортировка и вид'
                    : 'Sort & Visibility'
                  : language === 'ru'
                    ? 'Вкладки'
                    : 'Navigation'}
              </span>
              <div className="flex items-center gap-1">
                {isCustomizeTabs && !legacyNavigation && (
                  <button
                    type="button"
                    onClick={resetNavOrder}
                    title={language === 'ru' ? 'Сбросить порядок' : 'Reset order'}
                    className="p-1 rounded text-[10px] opacity-70 hover:opacity-100 hover:bg-current/10 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
                {hiddenPermittedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={restoreAllTabs}
                    title={
                      language === 'ru'
                        ? 'Вернуть все скрытые вкладки'
                        : 'Restore all hidden tabs'
                    }
                    className={clsx(
                      'px-1.5 py-0.5 rounded text-[10px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer',
                      isFrutigerAero
                        ? 'bg-white/60 text-[#0284c7] hover:bg-white/80'
                        : 'bg-[#10B981]/15 text-[#10B981] hover:bg-[#10B981]/25'
                    )}
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>{hiddenPermittedItems.length}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsCustomizeTabs((prev) => !prev)}
                  title={
                    language === 'ru'
                      ? 'Сортировать категории или скрыть вкладки'
                      : 'Sort categories or hide tabs'
                  }
                  className={clsx(
                    'p-1 rounded-md transition-colors cursor-pointer',
                    isCustomizeTabs
                      ? 'bg-[#10B981]/15 text-[#10B981]'
                      : 'opacity-60 hover:opacity-100 hover:bg-current/10'
                  )}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Primary Navigation */}
            <nav className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 no-scrollbar">
              {legacyNavigation ? (
                // ========== CLASSIC FLAT LEGACY NAVIGATION ==========
                isCustomizeTabs ? (
                  flatPermittedItems.map((item) => {
                    const isHidden = hiddenTabs.includes(item.id);
                    const isSettings = item.id === 'settings';
                    return (
                      <div
                        key={item.id}
                        className={clsx(
                          'w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors',
                          isHidden
                            ? 'opacity-50 border-dashed border-current/20'
                            : isFrutigerAero
                              ? 'border-white/50 bg-white/30'
                              : isLight
                                ? 'border-[#E2E5EA] bg-[#F5F6F8]/60'
                                : 'border-[#262B33] bg-[#111315]/60'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (!isHidden) {
                              handleNavClick(item.id);
                              setIsCustomizeTabs(false);
                            }
                          }}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <item.icon className="w-4 h-4 shrink-0" />
                          <span
                            className={clsx(
                              'truncate text-xs font-medium',
                              isHidden && 'line-through'
                            )}
                          >
                            {item.label}
                          </span>
                        </button>
                        {!isSettings && (
                          <button
                            type="button"
                            onClick={() => toggleTabVisibility(item.id)}
                            className={clsx(
                              'p-1 rounded transition-colors shrink-0 cursor-pointer',
                              isHidden
                                ? 'text-[#10B981] hover:bg-[#10B981]/15'
                                : 'opacity-70 hover:opacity-100 hover:text-amber-500'
                            )}
                          >
                            {isHidden ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  visibleNavItems.map((item) => renderDesktopTabButton(item))
                )
              ) : (
                // ========== CATEGORIZED, COLLAPSIBLE & SORTABLE NAVIGATION ==========
                categorizedNav.map((cat, catIndex) => {
                  const isCollapsed = collapsedNavCategories.includes(cat.id);
                  const visibleTabsInCat = isCustomizeTabs
                    ? cat.tabs
                    : cat.tabs.filter(
                        (tab) => tab.id === 'settings' || !hiddenTabs.includes(tab.id)
                      );

                  if (!isCustomizeTabs && visibleTabsInCat.length === 0) return null;

                  return (
                    <div
                      key={cat.id}
                      draggable={!isCustomizeTabs}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setDragCategoryId(cat.id);
                      }}
                      onDragOver={(e) => {
                        if (dragCategoryId && dragCategoryId !== cat.id) {
                          e.preventDefault();
                        }
                      }}
                      onDrop={(e) => {
                        if (dragCategoryId && dragCategoryId !== cat.id) {
                          e.preventDefault();
                          reorderNavCategories(dragCategoryId, cat.id);
                          setDragCategoryId(null);
                        }
                      }}
                      onDragEnd={() => setDragCategoryId(null)}
                      className={clsx(
                        'rounded-xl border border-transparent transition-colors',
                        dragCategoryId === cat.id && 'opacity-50 border-dashed border-[#10B981]/60'
                      )}
                    >
                      {/* Category Header (Collapsible + Sortable) */}
                      <div className="flex items-center justify-between gap-1 px-1.5 py-1 group/cat">
                        <button
                          type="button"
                          onClick={() => toggleNavCategoryCollapsed(cat.id)}
                          className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer py-0.5"
                        >
                          <GripVertical className="w-3 h-3 opacity-35 group-hover/cat:opacity-80 shrink-0" />
                          {isCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5 opacity-65 shrink-0" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 opacity-65 shrink-0" />
                          )}
                          {cat.color && (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                          )}
                          <span className="text-[11px] font-bold uppercase tracking-wider opacity-75 group-hover/cat:opacity-100 truncate">
                            {cat.label}
                          </span>
                        </button>

                        {isCustomizeTabs ? (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              disabled={catIndex === 0}
                              onClick={() => moveNavCategory(cat.id, 'up')}
                              className="p-0.5 rounded hover:bg-current/10 disabled:opacity-25 cursor-pointer"
                              title={language === 'ru' ? 'Выше' : 'Move category up'}
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={catIndex === categorizedNav.length - 1}
                              onClick={() => moveNavCategory(cat.id, 'down')}
                              className="p-0.5 rounded hover:bg-current/10 disabled:opacity-25 cursor-pointer"
                              title={language === 'ru' ? 'Ниже' : 'Move category down'}
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono opacity-45 px-1">
                            {visibleTabsInCat.length}
                          </span>
                        )}
                      </div>

                      {/* Tabs inside category */}
                      {!isCollapsed && (
                        <div className="pl-2 pr-0.5 pb-1 space-y-1">
                          {isCustomizeTabs
                            ? visibleTabsInCat.map((item, tIdx) => {
                                const isHidden = hiddenTabs.includes(item.id);
                                const isSettings = item.id === 'settings';
                                return (
                                  <div
                                    key={`${cat.id}::${item.id}`}
                                    className={clsx(
                                      'w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-sm border transition-colors',
                                      isHidden
                                        ? 'opacity-50 border-dashed border-current/20'
                                        : isFrutigerAero
                                          ? 'border-white/50 bg-white/30'
                                          : isLight
                                            ? 'border-[#E2E5EA] bg-[#F5F6F8]/60'
                                            : 'border-[#262B33] bg-[#111315]/60'
                                    )}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!isHidden) {
                                          handleNavClick(item.id);
                                          setIsCustomizeTabs(false);
                                        }
                                      }}
                                      className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                                    >
                                      <item.icon className="w-3.5 h-3.5 shrink-0" />
                                      <span
                                        className={clsx(
                                          'truncate text-xs font-medium',
                                          isHidden && 'line-through'
                                        )}
                                      >
                                        {item.label}
                                      </span>
                                    </button>
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <button
                                        type="button"
                                        disabled={tIdx === 0}
                                        onClick={() => moveNavTab(cat.id, item.id, 'up')}
                                        className="p-0.5 rounded hover:bg-current/10 disabled:opacity-25 cursor-pointer"
                                      >
                                        <ArrowUp className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={tIdx === visibleTabsInCat.length - 1}
                                        onClick={() => moveNavTab(cat.id, item.id, 'down')}
                                        className="p-0.5 rounded hover:bg-current/10 disabled:opacity-25 cursor-pointer"
                                      >
                                        <ArrowDown className="w-3 h-3" />
                                      </button>
                                      {!isSettings && (
                                        <button
                                          type="button"
                                          onClick={() => toggleTabVisibility(item.id)}
                                          className={clsx(
                                            'p-1 rounded transition-colors cursor-pointer',
                                            isHidden
                                              ? 'text-[#10B981] hover:bg-[#10B981]/15'
                                              : 'opacity-70 hover:opacity-100 hover:text-amber-500'
                                          )}
                                        >
                                          {isHidden ? (
                                            <Eye className="w-3.5 h-3.5" />
                                          ) : (
                                            <EyeOff className="w-3.5 h-3.5" />
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            : visibleTabsInCat.map((item) =>
                                renderDesktopTabButton(item, cat.id)
                              )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Compact Restore Hidden Tabs bar inside nav if any tabs are hidden */}
              {!isCustomizeTabs && hiddenPermittedItems.length > 0 && (
                <div className="pt-2 mt-2 border-t border-current/10">
                  <button
                    type="button"
                    onClick={() => setIsCustomizeTabs(true)}
                    className={clsx(
                      'w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed transition-colors cursor-pointer',
                      isFrutigerAero
                        ? 'border-[#0284c7]/40 text-[#0284c7] bg-white/30 hover:bg-white/50'
                        : isLight
                          ? 'border-[#059669]/35 text-[#059669] bg-[#059669]/5 hover:bg-[#059669]/10'
                          : 'border-[#10B981]/30 text-[#10B981] bg-[#10B981]/5 hover:bg-[#10B981]/10'
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" />
                      <span>
                        {language === 'ru'
                          ? `Скрытые вкладки (${hiddenPermittedItems.length})`
                          : `Hidden tabs (${hiddenPermittedItems.length})`}
                      </span>
                    </span>
                    <span className="text-[10px] underline">
                      {language === 'ru' ? 'Вернуть' : 'Restore'}
                    </span>
                  </button>
                </div>
              )}
            </nav>

            {/* Download Desktop App CTA */}
            <div className="pt-3 mt-2 border-t border-current/10 shrink-0">
              <button
                type="button"
                onClick={() => setIsDesktopDownloadOpen(true)}
                className={clsx(
                  'group relative w-full flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-200 overflow-hidden text-left cursor-pointer',
                  isFrutigerAero
                    ? 'frutiger-aero-button border-white shadow-md hover:-translate-y-0.5'
                    : isLight
                      ? 'bg-gradient-to-r from-[#059669] via-[#0D9488] to-[#0284C7] text-white border-emerald-600/30 shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 hover:-translate-y-0.5'
                      : 'bg-gradient-to-r from-[#10B981]/20 via-[#06B6D4]/15 to-[#3B82F6]/20 border-[#10B981]/45 text-[#F3F4F6] hover:border-[#10B981] hover:shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:-translate-y-0.5'
                )}
              >
                <div
                  className={clsx(
                    'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105',
                    isFrutigerAero
                      ? 'bg-white/75 text-[#0284c7]'
                      : isLight
                        ? 'bg-white/20 text-white backdrop-blur-sm'
                        : 'bg-gradient-to-br from-[#10B981] to-[#06B6D4] text-[#09120E] shadow-sm'
                  )}
                >
                  <MonitorDown className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold tracking-tight truncate">
                      {desktopCtaLabel}
                    </span>
                    <Sparkles
                      className={clsx(
                        'w-3 h-3 shrink-0 opacity-85',
                        isLight ? 'text-amber-200' : 'text-[#10B981]'
                      )}
                    />
                  </div>
                  <p
                    className={clsx(
                      'text-[10px] truncate mt-0.5',
                      isFrutigerAero
                        ? 'text-[#1e4b73]'
                        : isLight
                          ? 'text-white/85'
                          : 'text-[#9CA3AF]'
                    )}
                  >
                    {language === 'ru'
                      ? 'Создать ссылку для ПК'
                      : 'Generate PC Download Link'}
                  </p>
                </div>
                <Download className="w-4 h-4 shrink-0 opacity-80 transition-transform duration-200 group-hover:translate-y-0.5" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Mobile Top Bar */}
      <header
        style={{
          backgroundColor: specTheme?.sidebarBg || undefined,
          borderColor: specTheme?.borderColor || undefined,
        }}
        className={clsx(
          'md:hidden flex items-center justify-between px-4 py-3 border-b relative z-10 shrink-0',
          isFrutigerAero
            ? 'frutiger-aero-glass border-white/50'
            : isLight
            ? 'border-[#E2E5EA] bg-[#FFFFFF]'
            : 'border-[#262B33] bg-[#181B20]'
        )}
      >
        <div className="flex items-center gap-2.5">
          {currentView !== 'editor' && currentView !== 'store' && (
            <button
              onClick={() => setCurrentView('store')}
              className={clsx(
                'p-1.5 rounded-lg transition-colors border',
                isFrutigerAero
                  ? 'border-white/60 text-[#062038] hover:bg-white/40'
                  : isLight
                  ? 'border-[#E2E5EA] text-[#4B5563] hover:bg-[#F5F6F8]'
                  : 'border-[#262B33] text-[#9CA3AF] hover:bg-[#20242B]'
              )}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Terminal
              className={clsx(
                'w-4 h-4',
                isFrutigerAero
                  ? 'text-[#0284c7]'
                  : isLight
                  ? 'text-[#059669]'
                  : 'text-[#10B981]'
              )}
            />
            <h1 className="text-base font-bold tracking-tight truncate max-w-[160px]">
              {brandTitle}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2">
              <UserRoleBadge
                role={effectiveRole}
                isVerifiedAuthor={userData?.isVerifiedAuthor}
                size="xs"
              />
              <img
                src={user.photoURL || userData?.avatarUrl || getDefaultAvatar(user.uid)}
                alt="Avatar"
                className={clsx(
                  'w-7 h-7 rounded-lg object-cover border',
                  isFrutigerAero
                    ? 'border-white/60'
                    : isLight
                    ? 'border-[#E2E5EA]'
                    : 'border-[#262B33]'
                )}
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className={clsx(
                'text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap',
                isFrutigerAero
                  ? 'frutiger-aero-button'
                  : isLight
                  ? 'bg-[#059669] text-white'
                  : 'bg-[#10B981] text-[#09120E]'
              )}
            >
              {t.auth.signIn}
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main
        id="epl-main-workspace"
        style={{
          backgroundColor: specTheme?.canvasBg || undefined,
          backgroundImage: specTheme?.canvasGradient || undefined,
        }}
        className={clsx(
          'flex-1 min-h-0 overflow-y-auto relative flex flex-col z-10',
          isFrutigerAero
            ? 'frutiger-aero-bg'
            : isLight
            ? 'bg-[#F5F6F8]'
            : 'bg-[#111315]'
        )}
      >
        {/* Background Visual FX overlay when customized in EPL Shop */}
        {specTheme?.bgEffect && specTheme.bgEffect !== 'none' && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 opacity-45"
            style={
              specTheme.bgEffect === 'grid'
                ? {
                    backgroundImage:
                      'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)',
                    backgroundSize: '28px 28px',
                  }
                : specTheme.bgEffect === 'dots'
                ? {
                    backgroundImage:
                      'radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)',
                    backgroundSize: '22px 22px',
                  }
                : specTheme.bgEffect === 'scanlines'
                ? {
                    backgroundImage:
                      'repeating-linear-gradient(0deg, rgba(0,0,0,0.22), rgba(0,0,0,0.22) 1px, transparent 1px, transparent 4px)',
                  }
                : specTheme.bgEffect === 'stars'
                ? {
                    backgroundImage:
                      'radial-gradient(circle at 20% 25%, rgba(255,255,255,0.22) 1px, transparent 1.5px), radial-gradient(circle at 75% 65%, rgba(255,255,255,0.18) 1px, transparent 1.5px)',
                    backgroundSize: '80px 80px',
                  }
                : {
                    backgroundImage: `radial-gradient(ellipse at top right, ${specTheme.accentColor || '#10B981'}28, transparent 55%), radial-gradient(ellipse at bottom left, ${specTheme.secondaryColor || '#38BDF8'}22, transparent 55%)`,
                  }
            }
          />
        )}

        {/* Buyer Preview Mode Banner */}
        {previewEplShopSpec && !isEplShopBuilderOpen && (
          <div
            data-epl-builder-ui="true"
            className="shrink-0 z-30 px-4 py-2 bg-gradient-to-r from-sky-500/20 via-[#10B981]/20 to-violet-500/20 border-b border-sky-400/40 flex flex-wrap items-center justify-between gap-2 text-xs"
          >
            <div className="flex items-center gap-2 font-semibold">
              <Eye className="w-4 h-4 text-sky-400" />
              <span>
                {language === 'ru'
                  ? 'Режим примерки темы из EPL Shop — ходите по вкладкам, чтобы проверить всё вживую!'
                  : 'EPL Shop Live Preview Mode — browse tabs to test this build!'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {currentView !== 'epl-shop' && (
                <button
                  type="button"
                  onClick={() => handleNavClick('epl-shop')}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 font-semibold cursor-pointer"
                >
                  {language === 'ru' ? 'В EPL Shop' : 'Back to EPL Shop'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setPreviewEplShopSpec(null)}
                className="px-2.5 py-1 rounded-lg bg-sky-500 text-black font-bold cursor-pointer"
              >
                {language === 'ru' ? 'Выйти из примерки' : 'Exit Preview'}
              </button>
            </div>
          </div>
        )}

        {/* Floating Custom Widgets & Draggable Mini-Apps */}
        {visibleWidgets.length > 0 && (
          <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
            {visibleWidgets.map((w) => {
              const canDrag =
                isEplShopBuilderOpen && !eplShopPreviewMode && eplShopBuilderTool !== 'tap';
              const isSelectedWidget = canDrag && selectedBuilderWidgetId === w.id;
              return (
                <div
                  key={w.id}
                  data-epl-widget-id={w.id}
                  style={{
                    left: `${w.x}px`,
                    top: `${w.y}px`,
                    width: w.width ? `${w.width}px` : undefined,
                    backgroundColor:
                      w.kind === 'epl-mini-app' ? '#0d1016' : w.bgColor || '#10B981',
                    color: w.textColor || '#09120E',
                    borderRadius: `${w.borderRadius ?? 12}px`,
                    fontSize: `${w.fontSize ?? 13}px`,
                    borderColor: w.borderColor || 'rgba(255,255,255,0.2)',
                  }}
                  onPointerDown={(e) => {
                    if (!canDrag) return;
                    if ((e.target as HTMLElement).closest('button[data-widget-action]')) return;
                    e.stopPropagation();
                    setSelectedBuilderWidgetId(w.id);
                    draggingWidgetRef.current = {
                      id: w.id,
                      startX: e.clientX,
                      startY: e.clientY,
                      origX: w.x,
                      origY: w.y,
                      moved: false,
                    };
                  }}
                  onClick={(e) => {
                    if (canDrag) {
                      e.stopPropagation();
                      if (!suppressWidgetClickRef.current) {
                        setSelectedBuilderWidgetId(w.id);
                      }
                      return;
                    }
                    if (w.targetView) {
                      handleNavClick(w.targetView);
                    } else if (w.kind === 'button') {
                      notify.info(w.text);
                    }
                  }}
                  className={clsx(
                    'pointer-events-auto absolute border shadow-lg transition-shadow select-none',
                    canDrag
                      ? 'cursor-grab active:cursor-grabbing'
                      : w.kind === 'button' || w.targetView
                      ? 'cursor-pointer hover:brightness-110'
                      : '',
                    isSelectedWidget && 'outline-2 outline-[#10B981] outline-offset-2'
                  )}
                >
                  {w.kind === 'epl-mini-app' ? (
                    <div className="p-2 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#F3F4F6] px-1">
                        <span>{w.text}</span>
                      </div>
                      <EplEmbeddedRunner
                        code={w.eplCode || ''}
                        height={w.height || 170}
                        title={w.text}
                      />
                    </div>
                  ) : w.kind === 'card' ? (
                    <div className="px-3.5 py-2.5">
                      <div className="font-bold leading-snug">{w.text}</div>
                      {w.subtext && (
                        <div className="text-[11px] opacity-85 mt-0.5">{w.subtext}</div>
                      )}
                    </div>
                  ) : (
                    <div className="px-3.5 py-2 font-semibold flex items-center gap-1.5">
                      <span>{w.text}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="relative z-10 flex-1 min-h-0 flex flex-col">{children}</div>
      </main>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {selectedAppId && <AppDetailView />}

      <DesktopDownloadModal />

      <ExtraPremiumReceiver />

      {/* Live EPL Shop Builder Overlay (Available only when Developer opened it) */}
      {(effectiveRole === 'developer' || isEplShopBuilderOpen) && <EplShopBuilderOverlay />}

      {/* Mobile Bottom Sheet for Tab Customization & Download Desktop App */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={clsx(
              'w-full max-h-[78vh] rounded-t-2xl border-t p-4 flex flex-col gap-4 shadow-2xl',
              isFrutigerAero
                ? 'frutiger-aero-glass border-white'
                : isLight
                  ? 'bg-white border-[#E2E5EA] text-[#111315]'
                  : 'bg-[#181B20] border-[#262B33] text-[#F3F4F6]'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">
                {language === 'ru' ? 'Вкладки и приложение для ПК' : 'Tabs & Desktop App'}
              </span>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-lg hover:bg-current/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsDesktopDownloadOpen(true);
              }}
              className={clsx(
                'flex items-center gap-3 p-3 rounded-xl border transition-all text-left w-full cursor-pointer',
                isFrutigerAero
                  ? 'frutiger-aero-button border-white'
                  : isLight
                    ? 'bg-gradient-to-r from-[#059669] to-[#0284C7] text-white border-emerald-600/30'
                    : 'bg-gradient-to-r from-[#10B981]/20 via-[#06B6D4]/15 to-[#3B82F6]/20 border-[#10B981]/45 text-[#F3F4F6]'
              )}
            >
              <div className="w-9 h-9 rounded-lg bg-[#10B981] text-[#09120E] flex items-center justify-center shrink-0">
                <MonitorDown className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{desktopCtaLabel}</div>
                <div className="text-[11px] opacity-80 truncate">
                  {language === 'ru'
                    ? 'Сгенерировать ссылку на скачивание'
                    : 'Generate Download Link'}
                </div>
              </div>
              <Download className="w-4 h-4 shrink-0" />
            </button>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider opacity-70">
                {language === 'ru' ? 'Показать / скрыть вкладки' : 'Show / Hide Tabs'}
              </span>
              {hiddenPermittedItems.length > 0 && (
                <button
                  type="button"
                  onClick={restoreAllTabs}
                  className="text-xs font-semibold text-[#10B981] inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{language === 'ru' ? 'Вернуть все' : 'Restore all'}</span>
                </button>
              )}
            </div>

            <div className="overflow-y-auto space-y-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              {legacyNavigation ? (
                <div className="grid grid-cols-2 gap-2">
                  {flatPermittedItems.map((item) => {
                    const isHidden = hiddenTabs.includes(item.id);
                    const isSettings = item.id === 'settings';
                    return (
                      <div
                        key={item.id}
                        className={clsx(
                          'flex items-center justify-between gap-2 px-2.5 py-2.5 rounded-xl border text-xs',
                          isHidden ? 'opacity-50 border-dashed border-current/25' : 'border-current/15'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (isHidden) showTab(item.id);
                            handleNavClick(item.id);
                            setIsMobileMenuOpen(false);
                          }}
                          className="flex items-center gap-2 min-w-0 flex-1 text-left"
                        >
                          <item.icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate font-medium">{item.label}</span>
                        </button>
                        {!isSettings && (
                          <button
                            type="button"
                            onClick={() => toggleTabVisibility(item.id)}
                            className="p-1.5 rounded hover:bg-current/10 shrink-0"
                            title={isHidden ? (language === 'ru' ? 'Показать' : 'Show') : (language === 'ru' ? 'Скрыть' : 'Hide')}
                          >
                            {isHidden ? (
                              <Eye className="w-3.5 h-3.5 text-[#10B981]" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5 opacity-70" />
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                categorizedNav.map((cat) => {
                  const isCollapsed = collapsedNavCategories.includes(cat.id);
                  return (
                    <div key={cat.id} className="rounded-xl border border-current/10 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleNavCategoryCollapsed(cat.id)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left bg-current/[0.03]"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          {isCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5 opacity-65 shrink-0" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 opacity-65 shrink-0" />
                          )}
                          {cat.color && (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                          )}
                          <span className="text-[11px] font-bold uppercase tracking-wider truncate">
                            {cat.label}
                          </span>
                        </span>
                        <span className="text-[10px] font-mono opacity-60">{cat.tabs.length}</span>
                      </button>
                      {!isCollapsed && (
                        <div className="p-2 grid grid-cols-2 gap-1.5">
                          {cat.tabs.map((item) => {
                            const isHidden = hiddenTabs.includes(item.id);
                            const isSettings = item.id === 'settings';
                            return (
                              <div
                                key={`${cat.id}::${item.id}`}
                                className={clsx(
                                  'flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-xl border text-xs',
                                  isHidden ? 'opacity-50 border-dashed border-current/25' : 'border-current/15'
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isHidden) showTab(item.id);
                                    handleNavClick(item.id);
                                    setIsMobileMenuOpen(false);
                                  }}
                                  className="flex items-center gap-2 min-w-0 flex-1 text-left"
                                >
                                  <item.icon className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate font-medium">{item.label}</span>
                                </button>
                                {!isSettings && (
                                  <button
                                    type="button"
                                    onClick={() => toggleTabVisibility(item.id)}
                                    className="p-1.5 rounded hover:bg-current/10 shrink-0"
                                    title={isHidden ? (language === 'ru' ? 'Показать' : 'Show') : (language === 'ru' ? 'Скрыть' : 'Hide')}
                                  >
                                    {isHidden ? (
                                      <Eye className="w-3.5 h-3.5 text-[#10B981]" />
                                    ) : (
                                      <EyeOff className="w-3.5 h-3.5 opacity-70" />
                                    )}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Restore Nav Bar Button when Hidden */}
      {isMobileNavHidden ? (
        <button
          type="button"
          onClick={() => setIsMobileNavHidden(false)}
          title={language === 'ru' ? 'Вернуть панель вкладок' : 'Show navigation bar'}
          className={clsx(
            'md:hidden fixed bottom-3 right-3 z-40 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border shadow-lg backdrop-blur-md text-xs font-semibold cursor-pointer',
            isFrutigerAero
              ? 'frutiger-aero-button border-white'
              : isLight
                ? 'bg-white/95 border-[#E2E5EA] text-[#111315]'
                : 'bg-[#181B20]/95 border-[#262B33] text-[#F3F4F6]'
          )}
        >
          <PanelBottomOpen className="w-4 h-4 text-[#10B981]" />
          <span>{language === 'ru' ? 'Меню' : 'Menu'}</span>
        </button>
      ) : (
        <footer
          style={{
            backgroundColor: specTheme?.sidebarBg || undefined,
            borderColor: specTheme?.borderColor || undefined,
          }}
          className={clsx(
            'md:hidden shrink-0 w-full flex items-center border-t relative z-20 px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] gap-1',
            isFrutigerAero
              ? 'frutiger-aero-glass border-white/50'
              : isLight
              ? 'border-[#E2E5EA] bg-[#FFFFFF]'
              : 'border-[#262B33] bg-[#181B20]'
          )}
        >
          <button
            type="button"
            onClick={() => mobileNavRef.current?.scrollBy({ left: -160, behavior: 'smooth' })}
            aria-label={language === 'ru' ? 'Прокрутить влево' : 'Scroll tabs left'}
            className="p-2 min-h-[40px] min-w-[36px] flex items-center justify-center rounded-lg opacity-65 hover:opacity-100 active:scale-95 shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <nav
            ref={mobileNavRef}
            className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden no-scrollbar touch-pan-x scroll-smooth snap-x"
          >
            <div className="inline-flex items-center gap-1 whitespace-nowrap px-0.5">
              {visibleNavItems.map((item) => {
                const active = currentView === item.id;
                const isEpicExtra = !!item.isEpicExtra;
                return (
                  <button
                    key={item.id}
                    ref={(el) => {
                      mobileTabRefs.current[item.id] = el;
                    }}
                    onClick={() => handleNavClick(item.id)}
                    className={clsx(
                      'flex flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 min-h-[44px] rounded-lg transition-colors min-w-[62px] whitespace-nowrap shrink-0 snap-start',
                      isEpicExtra
                        ? active
                          ? 'bg-gradient-to-r from-amber-400 via-fuchsia-500 to-cyan-400 text-black font-bold'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-400/40 font-semibold'
                        : active
                          ? isFrutigerAero
                            ? 'text-[#0284c7] bg-white/60 font-semibold'
                            : isLight
                            ? 'text-[#059669] bg-[#059669]/10 font-semibold'
                            : 'text-[#10B981] bg-[#10B981]/10 font-semibold'
                          : isFrutigerAero
                          ? 'text-[#062038]/75'
                          : isLight
                          ? 'text-[#6B7280]'
                          : 'text-[#9CA3AF]'
                    )}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="text-[10px] font-medium leading-tight">
                      {isEpicExtra ? 'Extra' : item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          <button
            type="button"
            onClick={() => mobileNavRef.current?.scrollBy({ left: 160, behavior: 'smooth' })}
            aria-label="Scroll tabs right"
            className="p-1.5 rounded-lg opacity-65 hover:opacity-100 active:scale-95 shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            title={language === 'ru' ? 'Вкладки и Desktop App' : 'Tabs & Desktop App'}
            className={clsx(
              'relative p-2 rounded-lg border shrink-0 transition-colors',
              isFrutigerAero
                ? 'border-white/70 bg-white/40 text-[#0284c7]'
                : isLight
                ? 'border-[#E2E5EA] bg-[#F5F6F8] text-[#111315]'
                : 'border-[#262B33] bg-[#111315] text-[#F3F4F6]'
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {hiddenPermittedItems.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#10B981] text-[#09120E] text-[9px] font-bold flex items-center justify-center">
                {hiddenPermittedItems.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsMobileNavHidden(true)}
            title={language === 'ru' ? 'Скрыть панель вкладок' : 'Hide navigation bar'}
            className={clsx(
              'p-2 rounded-lg border shrink-0 transition-colors',
              isFrutigerAero
                ? 'border-white/70 bg-white/40 text-[#062038]'
                : isLight
                ? 'border-[#E2E5EA] bg-[#F5F6F8] text-[#6B7280]'
                : 'border-[#262B33] bg-[#111315] text-[#9CA3AF]'
            )}
          >
            <PanelBottomClose className="w-4 h-4" />
          </button>
        </footer>
      )}
    </div>
  );
}
