import { EplSiteCustomizationSpec } from '../types';
import { createEmptyEplSiteSpec } from '../store/useStore';

export function getActiveSiteSpec(opts: {
  isEplShopBuilderOpen: boolean;
  draftEplShopSpec: EplSiteCustomizationSpec;
  previewEplShopSpec: EplSiteCustomizationSpec | null;
  appliedEplShopSpec: EplSiteCustomizationSpec | null;
}): EplSiteCustomizationSpec | null {
  if (opts.isEplShopBuilderOpen) return opts.draftEplShopSpec;
  if (opts.previewEplShopSpec) return opts.previewEplShopSpec;
  return opts.appliedEplShopSpec;
}

export function resolveSiteLabel(
  spec: EplSiteCustomizationSpec | null | undefined,
  key: string,
  fallback: string
): string {
  const val = spec?.labelOverrides?.[key];
  return val && val.trim() ? val : fallback;
}

export function renderShopSpecSnapshot(
  spec: EplSiteCustomizationSpec,
  title: string
): string {
  if (typeof document === 'undefined') return '';
  const width = 640;
  const height = 360;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const t = spec.theme || {};
  const bg = t.canvasBg || '#0e1116';
  const sidebarBg = t.sidebarBg || '#161a21';
  const cardBg = t.cardBg || '#1c212b';
  const accent = t.accentColor || '#10b981';
  const secondary = t.secondaryColor || '#38bdf8';
  const text = t.textColor || '#f3f4f6';
  const border = t.borderColor || '#262b33';
  const radius = Math.min(20, Math.max(2, Number(t.borderRadius ?? 10)));

  // Canvas background
  if (t.canvasGradient) {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, bg);
    grad.addColorStop(1, secondary);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = bg;
  }
  ctx.fillRect(0, 0, width, height);

  // Subtle background effect
  if (t.bgEffect === 'grid') {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  } else if (t.bgEffect === 'dots' || t.bgEffect === 'stars') {
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (let x = 20; x < width; x += 34) {
      for (let y = 20; y < height; y += 34) {
        ctx.beginPath();
        ctx.arc(x, y, t.bgEffect === 'stars' ? 1.8 : 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Sidebar (left or right)
  const sbWidth = 152;
  const sbX = t.sidebarSide === 'right' ? width - sbWidth : 0;
  const mainX = t.sidebarSide === 'right' ? 16 : sbWidth + 16;
  const mainW = width - sbWidth - 32;

  ctx.fillStyle = sidebarBg;
  ctx.fillRect(sbX, 0, sbWidth, height);
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(t.sidebarSide === 'right' ? sbX : sbWidth, 0);
  ctx.lineTo(t.sidebarSide === 'right' ? sbX : sbWidth, height);
  ctx.stroke();

  // Brand title
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(sbX + 14, 16, 22, 22, 6);
  ctx.fill();
  ctx.fillStyle = text;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText((spec.brandTitle || title || 'EPL Studio').slice(0, 14), sbX + 42, 31);

  // Sample sidebar tabs
  const tabsPreview = [
    spec.labelOverrides?.['nav.store'] || 'App Store',
    spec.labelOverrides?.['nav.epl-shop'] || 'EPL Shop',
    spec.labelOverrides?.['nav.editor'] || 'Editor',
    ...(spec.customTabs || []).slice(0, 3).map((ct) => ct.label),
  ].slice(0, 6);

  tabsPreview.forEach((lbl, idx) => {
    const ty = 60 + idx * 34;
    ctx.fillStyle = idx === 0 ? accent : 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.roundRect(sbX + 12, ty, sbWidth - 24, 26, Math.min(8, radius));
    ctx.fill();
    ctx.fillStyle = idx === 0 ? '#09120e' : text;
    ctx.font = idx === 0 ? 'bold 11px sans-serif' : '11px sans-serif';
    ctx.fillText(lbl.slice(0, 16), sbX + 22, ty + 17);
  });

  // Main Header Card
  ctx.fillStyle = cardBg;
  ctx.beginPath();
  ctx.roundRect(mainX, 20, mainW, 74, radius);
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.stroke();

  ctx.fillStyle = text;
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText((spec.brandTitle || title || 'Custom EPL Theme').slice(0, 28), mainX + 18, 50);
  ctx.fillStyle = t.mutedColor || '#9ca3af';
  ctx.font = '12px sans-serif';
  ctx.fillText(
    (spec.brandSubtitle || 'Custom UI Layout + EPL Widgets & Tabs').slice(0, 44),
    mainX + 18,
    72
  );

  // 3 Content Cards
  const cardW = (mainW - 24) / 3;
  for (let i = 0; i < 3; i++) {
    const cx = mainX + i * (cardW + 12);
    ctx.fillStyle = cardBg;
    ctx.beginPath();
    ctx.roundRect(cx, 112, cardW, 130, radius);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.stroke();

    ctx.fillStyle = i % 2 === 0 ? accent : secondary;
    ctx.beginPath();
    ctx.roundRect(cx + 10, 122, cardW - 20, 56, Math.min(8, radius));
    ctx.fill();

    ctx.fillStyle = text;
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`Module ${i + 1}`, cx + 12, 198);

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(cx + 10, 212, cardW - 20, 20, 6);
    ctx.fill();
  }

  // Draggable widgets preview
  (spec.widgets || []).slice(0, 4).forEach((w, idx) => {
    const wx = Math.min(width - 140, Math.max(mainX, mainX + (w.x % (mainW - 100))));
    const wy = Math.min(height - 44, Math.max(255, 255 + idx * 24));
    ctx.fillStyle = w.bgColor || accent;
    ctx.beginPath();
    ctx.roundRect(wx, wy, 124, 30, Math.min(10, w.borderRadius ?? 8));
    ctx.fill();
    ctx.fillStyle = w.textColor || '#09120e';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText((w.text || 'Widget').slice(0, 16), wx + 10, wy + 19);
  });

  return canvas.toDataURL('image/jpeg', 0.86);
}

export const EPL_SHOP_STARTER_PRESETS: Array<{
  id: string;
  name: string;
  apply: (base: EplSiteCustomizationSpec) => EplSiteCustomizationSpec;
}> = [
  {
    id: 'cyber-emerald',
    name: 'Cyber Neon',
    apply: () => ({
      ...createEmptyEplSiteSpec(),
      brandTitle: 'Cyber EPL OS',
      brandSubtitle: 'Neon Core Edition',
      brandIcon: 'cpu',
      theme: {
        canvasBg: '#060913',
        canvasGradient: 'radial-gradient(circle at top right, rgba(6,182,212,0.18), transparent 55%)',
        sidebarBg: '#0b1020',
        cardBg: '#10172a',
        textColor: '#f8fafc',
        mutedColor: '#94a3b8',
        accentColor: '#06b6d4',
        secondaryColor: '#a855f7',
        borderColor: '#1e293b',
        borderRadius: 14,
        fontFamily: 'space',
        fontScale: 1,
        sidebarWidth: 264,
        sidebarSide: 'left',
        glassBlur: 8,
        glowIntensity: 18,
        bgEffect: 'grid',
      },
      labelOverrides: {
        'nav.store': 'Cyber Market',
        'nav.editor': 'Neural IDE',
      },
    }),
  },
  {
    id: 'solar-gold',
    name: 'Solar Royal',
    apply: () => ({
      ...createEmptyEplSiteSpec(),
      brandTitle: 'Royal EPL',
      brandSubtitle: 'Golden Studio',
      brandIcon: 'crown',
      theme: {
        canvasBg: '#120e09',
        canvasGradient: 'radial-gradient(circle at top left, rgba(245,158,11,0.18), transparent 50%)',
        sidebarBg: '#1a140c',
        cardBg: '#231b11',
        textColor: '#fef3c7',
        mutedColor: '#d6bfa0',
        accentColor: '#f59e0b',
        secondaryColor: '#ec4899',
        borderColor: '#3f2e18',
        borderRadius: 16,
        fontFamily: 'serif',
        fontScale: 1,
        sidebarWidth: 268,
        sidebarSide: 'left',
        glassBlur: 4,
        glowIntensity: 14,
        bgEffect: 'stars',
      },
      labelOverrides: {},
    }),
  },
  {
    id: 'retro-terminal',
    name: 'Retro Terminal',
    apply: () => ({
      ...createEmptyEplSiteSpec(),
      brandTitle: 'EPL://MAINFRAME',
      brandSubtitle: 'TTY-01 Kernel',
      brandIcon: 'terminal',
      theme: {
        canvasBg: '#030804',
        sidebarBg: '#050d06',
        cardBg: '#08130a',
        textColor: '#86efac',
        mutedColor: '#4ade80',
        accentColor: '#22c55e',
        secondaryColor: '#10b981',
        borderColor: '#14532d',
        borderRadius: 4,
        fontFamily: 'mono',
        fontScale: 1,
        sidebarWidth: 256,
        sidebarSide: 'left',
        glassBlur: 0,
        glowIntensity: 10,
        bgEffect: 'scanlines',
      },
      labelOverrides: {},
    }),
  },
];
