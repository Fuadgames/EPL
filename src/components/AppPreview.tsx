import React, { useMemo } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { Smartphone } from 'lucide-react';

import { useStore } from '../store/useStore';
import { notify } from '../store/useDialogStore';
import { EPLCameraState, EPLValue } from '../lib/epl-interpreter';

interface AppPreviewProps {
  entities: any;
  variables?: Record<string, EPLValue>;
  camera?: EPLCameraState | null;
  uiMode?: { type: string; target?: string } | null;
  handleUIEvent: (eventName: string, target?: string, value?: string) => void;
  isFullScreen?: boolean;
  showGrid?: boolean;
}

function interpolateTemplate(
  raw: any,
  variables: Record<string, EPLValue>,
  entities: Record<string, any>
): string {
  if (raw === undefined || raw === null) return '';
  const str = String(raw);
  return str.replace(/\{([a-zA-Z0-9_.]+)\}/g, (full, key) => {
    if (key.includes('.')) {
      const [eName, prop] = key.split('.');
      const ent = Object.values(entities).find(
        (e: any) => String(e.name || '').toLowerCase() === eName.toLowerCase()
      ) as any;
      if (ent && ent[prop] !== undefined) return String(ent[prop]);
      return full;
    }
    if (variables && variables[key] !== undefined && variables[key] !== null) {
      return String(variables[key]);
    }
    return full;
  });
}

function ParticleBurst({ entity, left, top }: { entity: any; left: number; top: number }) {
  const count = Math.min(28, Math.max(6, Number(entity.count || 14)));
  const effect = String(entity.effectType || entity.particleType || entity.type || 'spark').toLowerCase();
  const baseColor =
    entity.color ||
    (effect.includes('fire')
      ? '#f97316'
      : effect.includes('snow') || effect.includes('water')
        ? '#38bdf8'
        : effect.includes('magic')
          ? '#a855f7'
          : '#10b981');

  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, idx) => {
      const angle = (idx / count) * Math.PI * 2 + (idx % 3) * 0.4;
      const dist = 18 + ((idx * 17) % 44);
      const size = 4 + (idx % 5) * 1.5;
      const delay = (idx % 6) * 0.08;
      return { angle, dist, size, delay, idx };
    });
  }, [count]);

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left, top, width: 1, height: 1, zIndex: entity.zIndex ?? 15 }}
    >
      {particles.map(p => {
        const dx = Math.cos(p.angle) * p.dist;
        const dy = effect.includes('fire')
          ? -Math.abs(Math.sin(p.angle) * p.dist) - 18
          : effect.includes('snow')
            ? Math.abs(Math.sin(p.angle) * p.dist) + 20
            : Math.sin(p.angle) * p.dist;

        const confettiPalette = ['#10b981', '#f59e0b', '#38bdf8', '#f43f5e', '#a855f7'];
        const color = effect.includes('confetti') ? confettiPalette[p.idx % confettiPalette.length] : baseColor;

        return (
          <motion.span
            key={p.idx}
            className="absolute rounded-full block"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: color,
              boxShadow: `0 0 8px ${color}`
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: [0, dx * 0.6, dx],
              y: [0, dy * 0.6, dy],
              opacity: [0.95, 0.75, 0],
              scale: [0.8, 1.15, 0.2]
            }}
            transition={{
              duration: 1.15,
              repeat: Infinity,
              delay: p.delay,
              ease: 'easeOut'
            }}
          />
        );
      })}
    </div>
  );
}

function BuiltinGameSprite({ entity }: { entity: any }) {
  const color = entity.color || (entity.type === 'player' ? '#10b981' : entity.type === 'enemy' ? '#ef4444' : '#38bdf8');
  if (entity.type === 'player') {
    return (
      <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-md">
        <rect x="12" y="14" width="40" height="40" rx="12" fill={color} stroke="#0A0C0E" strokeWidth="2.5" />
        <rect x="20" y="21" width="24" height="14" rx="5" fill="#0F172A" />
        <circle cx="28" cy="28" r="2.8" fill="#38BDF8" />
        <circle cx="38" cy="28" r="2.8" fill="#38BDF8" />
        <rect x="20" y="42" width="24" height="5" rx="2.5" fill="#0A0C0E" opacity="0.35" />
      </svg>
    );
  }
  if (entity.type === 'enemy') {
    return (
      <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-md">
        <path d="M12 46 L16 20 L26 26 L32 14 L38 26 L48 20 L52 46 Z" fill={color} stroke="#0A0C0E" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="25" cy="34" r="3.5" fill="#FEF08A" />
        <circle cx="39" cy="34" r="3.5" fill="#FEF08A" />
        <path d="M24 43 Q32 39 40 43" stroke="#0A0C0E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-md">
      <polygon points="32,8 56,32 32,56 8,32" fill={color} stroke="#0A0C0E" strokeWidth="2.5" />
      <polygon points="32,16 46,32 32,48 18,32" fill="#FFFFFF" opacity="0.25" />
    </svg>
  );
}

export default function AppPreview({
  entities,
  variables = {},
  camera: runtimeCamera,
  uiMode,
  handleUIEvent,
  showGrid = false
}: AppPreviewProps) {
  const [isMobileUI, setIsMobileUI] = React.useState(false);
  const [isRealMobile, setIsRealMobile] = React.useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);

  React.useEffect(() => {
    const handleResize = () => setIsRealMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const displayMobile = isMobileUI || isRealMobile;
  const getX = (entity: any) =>
    displayMobile && entity.mobile_x !== undefined ? Number(entity.mobile_x) : Number(entity.x || 0);
  const getY = (entity: any) =>
    displayMobile && entity.mobile_y !== undefined ? Number(entity.mobile_y) : Number(entity.y || 0);

  const computerStyle = useStore(state => state.computerStyle);
  const worldEntity = Object.values(entities).find((e: any) => e.type === 'world') as any;
  const cameraEntity = Object.values(entities).find((e: any) => e.type === '3DCamera') as any;

  // Camera follow offset
  let camOffsetX = runtimeCamera?.shakeX || 0;
  let camOffsetY = runtimeCamera?.shakeY || 0;
  const followName = runtimeCamera?.follow || cameraEntity?.follow;
  if (followName) {
    const followTarget = Object.values(entities).find(
      (e: any) => String(e.name || '').toLowerCase() === String(followName).toLowerCase()
    ) as any;
    if (followTarget) {
      camOffsetX += Math.round(320 - getX(followTarget));
      camOffsetY += Math.round(210 - getY(followTarget));
    }
  }

  const cameraZoom = Number(runtimeCamera?.zoom || cameraEntity?.zoom || 1);

  const wrapperStyle: React.CSSProperties = cameraEntity
    ? {
        perspective: '1000px',
        transformStyle: 'preserve-3d',
        transform: `translate(${camOffsetX}px, ${camOffsetY}px) scale(${cameraZoom}) rotateX(${cameraEntity.lookAt === 'center' ? 35 : 0}deg)`,
        width: '100%',
        height: '100%',
        position: 'absolute',
        left: 0,
        top: 0
      }
    : {
        transform: `translate(${camOffsetX}px, ${camOffsetY}px) scale(${cameraZoom})`,
        transformOrigin: 'center center',
        width: '100%',
        height: '100%',
        position: 'absolute',
        left: 0,
        top: 0
      };

  const getBorderRadius = (entity: any) => {
    const radius = entity.borderRadius !== undefined ? entity.borderRadius : entity.corner;
    if (radius === undefined) return undefined;
    return `${radius}px`;
  };

  const makeDragEnd = (entity: any) => (_e: any, info: any) => {
    if (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name)) {
      if (displayMobile) {
        entity.mobile_x = Math.round(parseFloat(entity.mobile_x || entity.x || 0) + info.offset.x);
        entity.mobile_y = Math.round(parseFloat(entity.mobile_y || entity.y || 0) + info.offset.y);
      } else {
        entity.x = Math.round(parseFloat(entity.x || 0) + info.offset.x);
        entity.y = Math.round(parseFloat(entity.y || 0) + info.offset.y);
      }
      handleUIEvent('manipulated?', entity.name);
    } else if (entity.isDraggable) {
      entity.x = Math.round(parseFloat(entity.x || 0) + info.offset.x);
      entity.y = Math.round(parseFloat(entity.y || 0) + info.offset.y);
      handleUIEvent('dragged?', entity.name);
    }
  };

  const worldBg = computerStyle
    ? '#050806'
    : worldEntity?.background || worldEntity?.color || '#ffffff';

  const shouldShowGrid = showGrid || worldEntity?.grid === true || uiMode?.type === 'position';

  return (
    <div
      tabIndex={0}
      className={clsx(
        'w-full h-full relative flex items-center justify-center outline-none',
        displayMobile && 'bg-black/80 z-10'
      )}
    >
      <div
        className={clsx(
          'relative overflow-hidden',
          displayMobile
            ? 'w-[375px] h-[812px] bg-white rounded-[40px] border-[8px] border-zinc-900 shadow-2xl shrink-0'
            : 'w-full h-full'
        )}
        style={{
          boxShadow: displayMobile ? '0 0 0 1px #333, 0 10px 40px rgba(0,0,0,0.5)' : undefined,
          backgroundColor: worldBg,
          backgroundImage: worldEntity?.backgroundImage ? `url(${worldEntity.backgroundImage})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          perspective: cameraEntity ? '1000px' : 'none'
        }}
      >
        {shouldShowGrid && (
          <div
            className="absolute inset-0 pointer-events-none z-0 opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(16,185,129,0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(16,185,129,0.28) 1px, transparent 1px)',
              backgroundSize: '32px 32px'
            }}
          />
        )}

        {computerStyle && worldEntity?.backgroundImage && (
          <div className="absolute inset-0 bg-emerald-900/50 mix-blend-color pointer-events-none z-0" />
        )}

        <div style={wrapperStyle}>
          {Object.values(entities).map((entity: any) => {
            if ((entity.spawnComponent && !entity.isActive) || entity.hidden) return null;

            const isDragEnabled =
              Boolean(entity.isDraggable) ||
              (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name));

            const commonTransform = `rotate(${entity.rotation || 0}deg) scale(${entity.scale || 1})${
              entity.flipX ? ' scaleX(-1)' : ''
            }`;

            if (entity.type === 'panel') {
              return (
                <motion.div
                  key={entity.id}
                  className={clsx(
                    'absolute border flex flex-col overflow-hidden',
                    computerStyle && 'border-emerald-500/60 bg-black/90 text-emerald-400'
                  )}
                  style={{
                    left: getX(entity),
                    top: getY(entity),
                    width: entity.width || 240,
                    height: entity.height || 160,
                    backgroundColor: computerStyle ? '#050806' : entity.color || '#181B20',
                    borderColor: computerStyle ? '#10b981' : entity.borderColor || '#262B33',
                    borderRadius: getBorderRadius(entity) || '12px',
                    opacity: entity.opacity ?? 1,
                    zIndex: entity.zIndex ?? 1,
                    transform: commonTransform
                  }}
                  drag={isDragEnabled}
                  dragMomentum={false}
                  animate={{ x: 0, y: 0 }}
                  transition={{ duration: 0 }}
                  onDragEnd={makeDragEnd(entity)}
                >
                  {entity.title && (
                    <div className="px-3 py-2 border-b border-white/10 text-xs font-semibold text-white/90">
                      {interpolateTemplate(entity.title, variables, entities)}
                    </div>
                  )}
                </motion.div>
              );
            }

            if (entity.type === 'progress') {
              const rawVal =
                entity.variable && variables[entity.variable] !== undefined
                  ? Number(variables[entity.variable])
                  : Number(entity.value ?? 50);
              const maxVal = Math.max(1, Number(entity.max ?? 100));
              const pct = Math.max(0, Math.min(100, (rawVal / maxVal) * 100));

              return (
                <motion.div
                  key={entity.id}
                  className="absolute flex flex-col gap-1"
                  style={{
                    left: getX(entity),
                    top: getY(entity),
                    width: entity.width || 200,
                    zIndex: entity.zIndex ?? 10,
                    transform: commonTransform
                  }}
                  drag={isDragEnabled}
                  dragMomentum={false}
                  animate={{ x: 0, y: 0 }}
                  transition={{ duration: 0 }}
                  onDragEnd={makeDragEnd(entity)}
                >
                  {entity.label && (
                    <div className="flex justify-between text-[11px] font-semibold text-zinc-200 drop-shadow">
                      <span>{interpolateTemplate(entity.label, variables, entities)}</span>
                      <span className="font-mono">{Math.round(rawVal)}/{maxVal}</span>
                    </div>
                  )}
                  <div
                    className="w-full rounded-full overflow-hidden bg-black/40 border border-white/15"
                    style={{ height: entity.height || 14 }}
                  >
                    <div
                      className="h-full transition-all duration-150"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: computerStyle ? '#10b981' : entity.color || '#10b981'
                      }}
                    />
                  </div>
                </motion.div>
              );
            }

            if (entity.type === 'checkbox') {
              const checked =
                entity.variable && variables[entity.variable] !== undefined
                  ? Boolean(variables[entity.variable])
                  : Boolean(entity.checked);
              return (
                <motion.label
                  key={entity.id}
                  className="absolute inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#181B20]/90 border border-[#262B33] text-xs font-medium text-[#F3F4F6] cursor-pointer select-none shadow-sm"
                  style={{
                    left: getX(entity),
                    top: getY(entity),
                    zIndex: entity.zIndex ?? 10,
                    transform: commonTransform
                  }}
                  drag={isDragEnabled}
                  dragMomentum={false}
                  animate={{ x: 0, y: 0 }}
                  transition={{ duration: 0 }}
                  onDragEnd={makeDragEnd(entity)}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => {
                      entity.checked = e.target.checked;
                      handleUIEvent('changed?', entity.name, String(e.target.checked));
                    }}
                    className="w-4 h-4 accent-[#10B981] cursor-pointer"
                  />
                  <span>{interpolateTemplate(entity.label || entity.name, variables, entities)}</span>
                </motion.label>
              );
            }

            if (entity.type === 'slider') {
              const min = Number(entity.min ?? 0);
              const max = Number(entity.max ?? 100);
              const val =
                entity.variable && variables[entity.variable] !== undefined
                  ? Number(variables[entity.variable])
                  : Number(entity.value ?? 50);

              return (
                <motion.div
                  key={entity.id}
                  className="absolute flex flex-col gap-1 bg-[#181B20]/90 border border-[#262B33] px-3 py-2 rounded-lg text-xs text-[#F3F4F6] shadow-sm"
                  style={{
                    left: getX(entity),
                    top: getY(entity),
                    width: entity.width || 190,
                    zIndex: entity.zIndex ?? 10,
                    transform: commonTransform
                  }}
                  drag={isDragEnabled}
                  dragMomentum={false}
                  animate={{ x: 0, y: 0 }}
                  transition={{ duration: 0 }}
                  onDragEnd={makeDragEnd(entity)}
                >
                  <div className="flex justify-between text-[11px] font-medium">
                    <span>{interpolateTemplate(entity.label || entity.name, variables, entities)}</span>
                    <span className="font-mono text-[#10B981]">{val}</span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={val}
                    onChange={e => {
                      entity.value = Number(e.target.value);
                      handleUIEvent('changed?', entity.name, e.target.value);
                    }}
                    className="w-full accent-[#10B981] cursor-pointer"
                  />
                </motion.div>
              );
            }

            if (entity.type === 'particle') {
              return <ParticleBurst key={entity.id} entity={entity} left={getX(entity)} top={getY(entity)} />;
            }

            if (entity.type === 'sprite' || entity.type === 'player' || entity.type === 'enemy' || entity.type === 'png') {
              const imgSource = entity.image || entity.file;
              const hasCustomImage =
                typeof imgSource === 'string' &&
                (imgSource.startsWith('http://') ||
                  imgSource.startsWith('https://') ||
                  imgSource.startsWith('data:') ||
                  imgSource.startsWith('blob:') ||
                  imgSource.startsWith('/'));

              const w = Number(entity.width || 56);
              const h = Number(entity.height || 56);
              const showHpBar = entity.health !== undefined && (entity.type === 'player' || entity.type === 'enemy');
              const maxHp = Math.max(1, Number(entity.maxHealth || entity.health || 100));
              const hpPct = Math.max(0, Math.min(100, (Number(entity.health) / maxHp) * 100));

              return (
                <motion.div
                  key={entity.id}
                  onClick={() => handleUIEvent('clicked?', entity.name)}
                  className="absolute select-none"
                  style={{
                    left: getX(entity),
                    top: getY(entity),
                    width: w,
                    height: h,
                    borderRadius: getBorderRadius(entity),
                    transitionProperty: 'left, top, transform',
                    transitionTimingFunction: 'linear',
                    transitionDuration: entity.transitionDuration !== undefined ? `${entity.transitionDuration}s` : '0s',
                    transform: commonTransform,
                    zIndex: entity.zIndex ?? (entity.type === 'player' ? 8 : 6),
                    opacity: entity.opacity ?? 1
                  }}
                  drag={isDragEnabled}
                  dragMomentum={false}
                  animate={{ x: 0, y: 0 }}
                  transition={{ duration: 0 }}
                  onDragEnd={makeDragEnd(entity)}
                >
                  {showHpBar && (
                    <div className="absolute -top-2.5 left-0 right-0 h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/15">
                      <div
                        className="h-full transition-all duration-150"
                        style={{
                          width: `${hpPct}%`,
                          backgroundColor: entity.type === 'player' ? '#10b981' : '#ef4444'
                        }}
                      />
                    </div>
                  )}
                  {hasCustomImage ? (
                    <img
                      src={imgSource}
                      alt={entity.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain pointer-events-none"
                      style={{
                        borderRadius: getBorderRadius(entity),
                        filter: computerStyle
                          ? 'grayscale(1) sepia(1) hue-rotate(80deg) saturate(500%) brightness(0.8) contrast(2) drop-shadow(0 0 8px rgba(16,185,129,0.8))'
                          : 'none'
                      }}
                    />
                  ) : (
                    <BuiltinGameSprite entity={entity} />
                  )}
                </motion.div>
              );
            }

            if (entity.type === 'button') {
              return (
                <motion.button
                  key={entity.id}
                  onClick={() => handleUIEvent('clicked?', entity.name)}
                  className={clsx(
                    'absolute px-4 py-2 font-semibold shadow-md transition-colors cursor-pointer active:translate-y-0.5',
                    computerStyle
                      ? 'border-2 border-emerald-500 text-emerald-400 bg-black shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                      : 'text-white hover:brightness-110',
                    entity.borderRadius === undefined && entity.corner === undefined && 'rounded-lg'
                  )}
                  style={{
                    left: getX(entity),
                    top: getY(entity),
                    backgroundColor: computerStyle ? '#050505' : entity.color || '#10b981',
                    borderRadius: getBorderRadius(entity),
                    transitionProperty: 'left, top, background-color, transform',
                    transitionTimingFunction: 'linear',
                    transitionDuration: entity.transitionDuration !== undefined ? `${entity.transitionDuration}s` : '0s',
                    transform: commonTransform,
                    zIndex: entity.zIndex ?? 9
                  }}
                  drag={isDragEnabled}
                  dragMomentum={false}
                  animate={{ x: 0, y: 0 }}
                  transition={{ duration: 0 }}
                  onDragEnd={makeDragEnd(entity)}
                >
                  {interpolateTemplate(entity.label || entity.name, variables, entities)}
                </motion.button>
              );
            }

            if (entity.type === 'block') {
              return (
                <motion.div
                  key={entity.id}
                  onClick={() => handleUIEvent('clicked?', entity.name)}
                  className={clsx(
                    'absolute',
                    computerStyle && 'border-2 border-emerald-500 bg-black shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                  )}
                  style={{
                    left: getX(entity),
                    top: getY(entity),
                    width: entity.width || 50,
                    height: entity.height || 50,
                    backgroundColor: computerStyle ? '#050505' : entity.color || '#3f3f46',
                    borderRadius: getBorderRadius(entity),
                    transitionProperty: 'left, top, transform',
                    transitionTimingFunction: 'linear',
                    transitionDuration: entity.transitionDuration !== undefined ? `${entity.transitionDuration}s` : '0s',
                    opacity: entity.opacity !== undefined ? entity.opacity : 1,
                    transform: commonTransform,
                    zIndex: entity.zIndex ?? 4,
                    boxShadow: entity.solid ? 'inset 0 2px 0 rgba(255,255,255,0.12), 0 4px 10px rgba(0,0,0,0.25)' : undefined
                  }}
                  drag={isDragEnabled}
                  dragMomentum={false}
                  animate={{ x: 0, y: 0 }}
                  transition={{ duration: 0 }}
                  onDragEnd={makeDragEnd(entity)}
                />
              );
            }

            if (entity.type === '3Dblock') {
              const size = Number(entity.size || 54);
              const baseColor = computerStyle ? '#064e3b' : entity.color || '#10b981';
              const depth = Math.max(8, Math.round(size * 0.28));
              return (
                <motion.div
                  key={entity.id}
                  onClick={() => handleUIEvent('clicked?', entity.name)}
                  className="absolute"
                  style={{
                    left: getX(entity),
                    top: getY(entity) - (Number(entity.z || 0) * 0.35),
                    width: size,
                    height: size,
                    transformStyle: 'preserve-3d',
                    transform: `rotateX(${entity.rotX || 0}deg) rotateY(${entity.rotY || 0}deg) rotate(${entity.rotation || 0}deg) scale(${entity.scale || 1})`,
                    zIndex: entity.zIndex ?? 5
                  }}
                  drag={isDragEnabled}
                  dragMomentum={false}
                  animate={{ x: 0, y: 0 }}
                  transition={{ duration: 0 }}
                  onDragEnd={makeDragEnd(entity)}
                >
                  {/* Top Shaded Face */}
                  <div
                    className="absolute left-0 right-0 pointer-events-none"
                    style={{
                      top: -depth,
                      height: depth,
                      backgroundColor: baseColor,
                      filter: 'brightness(1.25)',
                      transform: `skewX(-45deg)`,
                      transformOrigin: 'bottom left',
                      border: '1px solid rgba(255,255,255,0.2)'
                    }}
                  />
                  {/* Right Shaded Face */}
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{
                      right: -depth,
                      width: depth,
                      backgroundColor: baseColor,
                      filter: 'brightness(0.7)',
                      transform: `skewY(-45deg)`,
                      transformOrigin: 'top left',
                      border: '1px solid rgba(0,0,0,0.25)'
                    }}
                  />
                  {/* Front Face */}
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundColor: baseColor,
                      borderRadius: getBorderRadius(entity),
                      border: computerStyle ? '1.5px solid #10b981' : '1px solid rgba(255,255,255,0.18)',
                      boxShadow: '0 12px 20px rgba(0,0,0,0.35)'
                    }}
                  />
                </motion.div>
              );
            }

            if (entity.type === 'text_label') {
              return (
                <motion.div
                  key={entity.id}
                  onClick={() => handleUIEvent('clicked?', entity.name)}
                  className={clsx('absolute font-bold select-none', computerStyle && 'text-emerald-500')}
                  style={{
                    left: getX(entity),
                    top: getY(entity),
                    color: computerStyle ? '#10b981' : entity.color || '#000000',
                    textShadow: computerStyle ? '0 0 8px rgba(16,185,129,0.8)' : undefined,
                    fontSize: entity.size ? `${entity.size}px` : '16px',
                    transitionProperty: 'left, top, transform',
                    transitionTimingFunction: 'linear',
                    transitionDuration: entity.transitionDuration !== undefined ? `${entity.transitionDuration}s` : '0s',
                    opacity: entity.opacity !== undefined ? entity.opacity : 1,
                    transform: commonTransform,
                    zIndex: entity.zIndex ?? 10
                  }}
                  drag={isDragEnabled}
                  dragMomentum={false}
                  animate={{ x: 0, y: 0 }}
                  transition={{ duration: 0 }}
                  onDragEnd={makeDragEnd(entity)}
                >
                  {interpolateTemplate(entity.text || entity.name, variables, entities)}
                </motion.div>
              );
            }

            if (entity.type === 'textbox') {
              return (
                <motion.input
                  key={entity.id}
                  type="text"
                  placeholder={entity.placeholder || 'Type here...'}
                  value={entity.text || ''}
                  onChange={e => {
                    entity.text = e.target.value;
                    handleUIEvent('writed?', entity.name, e.target.value);
                  }}
                  className={clsx(
                    'absolute px-3 py-2 focus:outline-none transition-colors',
                    computerStyle
                      ? 'bg-black border border-emerald-500 text-emerald-500 focus:border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                      : 'bg-zinc-900 border border-zinc-700 text-white focus:border-emerald-500',
                    entity.borderRadius === undefined && entity.corner === undefined && 'rounded-lg'
                  )}
                  style={{
                    left: getX(entity),
                    top: getY(entity),
                    width: entity.width || 200,
                    borderRadius: getBorderRadius(entity),
                    transitionProperty: 'left, top, transform',
                    transitionTimingFunction: 'linear',
                    transitionDuration: entity.transitionDuration !== undefined ? `${entity.transitionDuration}s` : '0s',
                    transform: commonTransform,
                    zIndex: entity.zIndex ?? 10
                  }}
                  drag={isDragEnabled}
                  dragMomentum={false}
                  animate={{ x: 0, y: 0 }}
                  transition={{ duration: 0 }}
                  onDragEnd={makeDragEnd(entity)}
                />
              );
            }

            if (entity.type === 'circle') {
              return (
                <motion.div
                  key={entity.id}
                  onClick={() => handleUIEvent('clicked?', entity.name)}
                  className={clsx(
                    'absolute',
                    computerStyle && 'border-2 border-emerald-500 bg-black shadow-[0_0_10px_rgba(16,185,129,0.5)]',
                    entity.borderRadius === undefined && entity.corner === undefined && 'rounded-full'
                  )}
                  style={{
                    left: getX(entity),
                    top: getY(entity),
                    width: (entity.radius || 25) * 2,
                    height: (entity.radius || 25) * 2,
                    backgroundColor: computerStyle ? '#050505' : entity.color || '#3f3f46',
                    borderRadius: getBorderRadius(entity),
                    transitionProperty: 'left, top, transform',
                    transitionTimingFunction: 'linear',
                    transitionDuration: entity.transitionDuration !== undefined ? `${entity.transitionDuration}s` : '0s',
                    opacity: entity.opacity !== undefined ? entity.opacity : 1,
                    transform: commonTransform,
                    zIndex: entity.zIndex ?? 5
                  }}
                  drag={isDragEnabled}
                  dragMomentum={false}
                  animate={{ x: 0, y: 0 }}
                  transition={{ duration: 0 }}
                  onDragEnd={makeDragEnd(entity)}
                />
              );
            }

            if (entity.type === 'line') {
              const x1 = entity.x1 || 0;
              const y1 = entity.y1 || 0;
              const x2 = entity.x2 || 100;
              const y2 = entity.y2 || 100;
              const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
              const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

              return (
                <motion.div
                  key={entity.id}
                  className="absolute origin-left"
                  style={{
                    left: x1,
                    top: y1,
                    width: length,
                    height: entity.thickness || 2,
                    backgroundColor: entity.color || '#000000',
                    transform: `rotate(${angle}deg) scale(${entity.scale || 1})`,
                    opacity: entity.opacity !== undefined ? entity.opacity : 1,
                    zIndex: entity.zIndex ?? 3
                  }}
                  drag={isDragEnabled}
                  dragMomentum={false}
                  animate={{ x: 0, y: 0 }}
                  transition={{ duration: 0 }}
                  onDragEnd={makeDragEnd(entity)}
                />
              );
            }

            if (entity.type === 'terminal') {
              return (
                <motion.div
                  key={entity.id}
                  className="absolute bg-black text-green-500 font-mono p-4 rounded-lg shadow-lg overflow-y-auto border border-zinc-800"
                  style={{
                    left: getX(entity),
                    top: getY(entity),
                    width: entity.width || 400,
                    height: entity.height || 300,
                    opacity: entity.opacity !== undefined ? entity.opacity : 1,
                    zIndex: entity.zIndex ?? 8
                  }}
                  drag={isDragEnabled}
                  dragMomentum={false}
                  animate={{ x: 0, y: 0 }}
                  transition={{ duration: 0 }}
                  onDragEnd={makeDragEnd(entity)}
                >
                  <div className="flex items-center gap-2 mb-2 border-b border-zinc-800 pb-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm">
                    {interpolateTemplate(entity.text || 'Welcome to Terminal...', variables, entities)}
                  </pre>
                </motion.div>
              );
            }

            if (entity.type === 'gradient') {
              const size = entity.size || 200;
              return (
                <motion.div
                  key={entity.id}
                  className="absolute blur-[80px] rounded-full mix-blend-screen opacity-50 pointer-events-none"
                  style={{
                    left: getX(entity),
                    top: getY(entity),
                    width: size,
                    height: size,
                    backgroundColor:
                      entity.variant === 'purple' ? '#a855f7' : entity.variant === 'blue' ? '#3b82f6' : '#10b981',
                    opacity: entity.opacity !== undefined ? entity.opacity * 0.5 : 0.5,
                    transform: `scale(${entity.scale || 1})`
                  }}
                />
              );
            }

            return null;
          })}
        </div>
      </div>

      {uiMode?.type === 'position' && (
        <div className="absolute top-auto bottom-0 left-0 right-0 sm:top-4 sm:bottom-auto sm:left-auto sm:right-4 bg-zinc-900 sm:border border-t border-zinc-800 p-4 rounded-t-2xl sm:rounded-xl shadow-2xl z-50 text-white w-full sm:w-72 pointer-events-auto shadow-[0_-10px_20px_rgba(16,185,129,0.2)] sm:shadow-[0_0_20px_rgba(16,185,129,0.2)] max-h-[50vh] sm:max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm text-emerald-400">Position & Properties</h3>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded uppercase font-bold">
              {uiMode.target}
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 mb-4 uppercase tracking-wider font-semibold">Fine-tune your entity</p>

          <button
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              setIsMobileUI(!isMobileUI);
            }}
            className={clsx(
              'w-full py-2 mb-4 hover:bg-zinc-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2',
              isMobileUI ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-emerald-400'
            )}
          >
            <Smartphone className="w-4 h-4" /> {isMobileUI ? 'PC UI (default)' : 'Mobile UI'}
          </button>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex flex-col">
                <label className="text-zinc-500 mb-1">X Position</label>
                <input
                  type="number"
                  value={
                    (Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.[
                      displayMobile ? 'mobile_x' : 'x'
                    ] ||
                    (Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.x ||
                    0
                  }
                  className="bg-zinc-800 p-2 rounded outline-none w-full border border-zinc-700 focus:border-emerald-500"
                  onChange={e => {
                    const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                    if (targetEntity) {
                      if (displayMobile) targetEntity.mobile_x = Number(e.target.value);
                      else targetEntity.x = Number(e.target.value);
                      handleUIEvent('manipulated?', uiMode.target);
                    }
                  }}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-zinc-500 mb-1">Y Position</label>
                <input
                  type="number"
                  value={
                    (Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.[
                      displayMobile ? 'mobile_y' : 'y'
                    ] ||
                    (Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.y ||
                    0
                  }
                  className="bg-zinc-800 p-2 rounded outline-none w-full border border-zinc-700 focus:border-emerald-500"
                  onChange={e => {
                    const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                    if (targetEntity) {
                      if (displayMobile) targetEntity.mobile_y = Number(e.target.value);
                      else targetEntity.y = Number(e.target.value);
                      handleUIEvent('manipulated?', uiMode.target);
                    }
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex flex-col">
                <label className="text-zinc-500 mb-1">Width / Size</label>
                <input
                  type="number"
                  value={(() => {
                    const ent = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                    return ent?.width || ent?.size || (ent?.radius ? ent.radius * 2 : 0) || 0;
                  })()}
                  className="bg-zinc-800 p-2 rounded outline-none w-full border border-zinc-700 focus:border-emerald-500"
                  onChange={e => {
                    const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                    if (targetEntity) {
                      const val = Number(e.target.value);
                      if (targetEntity.radius !== undefined) targetEntity.radius = val / 2;
                      else if (targetEntity.size !== undefined) targetEntity.size = val;
                      else targetEntity.width = val;
                      handleUIEvent('manipulated?', uiMode.target);
                    }
                  }}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-zinc-500 mb-1">Height</label>
                <input
                  type="number"
                  value={(Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.height || 0}
                  className="bg-zinc-800 p-2 rounded outline-none w-full border border-zinc-700 focus:border-emerald-500"
                  onChange={e => {
                    const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                    if (targetEntity) {
                      targetEntity.height = Number(e.target.value);
                      handleUIEvent('manipulated?', uiMode.target);
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col text-xs">
              <label className="text-zinc-500 mb-1">Corner Radius (Smoothing)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={(() => {
                    const ent = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                    return ent?.borderRadius !== undefined ? ent.borderRadius : ent?.corner || 0;
                  })()}
                  className="flex-1 accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                  onChange={e => {
                    const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                    if (targetEntity) {
                      const val = Number(e.target.value);
                      targetEntity.borderRadius = val;
                      targetEntity.corner = val;
                      handleUIEvent('manipulated?', uiMode.target);
                    }
                  }}
                />
                <span className="w-8 text-right font-mono text-emerald-400">
                  {(() => {
                    const ent = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                    return ent?.borderRadius !== undefined ? ent.borderRadius : ent?.corner || 0;
                  })()}
                </span>
              </div>
            </div>

            <div className="flex flex-col text-xs mt-4">
              <label className="text-zinc-500 mb-1">Scale</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={(Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.scale || 1}
                  className="flex-1 accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                  onChange={e => {
                    const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                    if (targetEntity) {
                      targetEntity.scale = Number(e.target.value);
                      handleUIEvent('manipulated?', uiMode.target);
                    }
                  }}
                />
                <span className="w-8 text-right font-mono text-emerald-400">
                  {Number((Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.scale || 1).toFixed(1)}
                </span>
              </div>
            </div>

            <div className="flex flex-col text-xs mt-4 border-t border-zinc-800 pt-3">
              <label className="flex items-center gap-2 cursor-pointer text-zinc-500">
                <input
                  type="checkbox"
                  checked={!!(Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.spawnComponent}
                  className="accent-emerald-500"
                  onChange={e => {
                    const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                    if (targetEntity) {
                      targetEntity.spawnComponent = e.target.checked;
                      handleUIEvent('manipulated?', uiMode.target);
                    }
                  }}
                />
                Spawn Component
              </label>
            </div>

            <div className="border-t border-zinc-800 pt-3">
              <label className="text-zinc-500 text-[10px] uppercase mb-2 block">Quick Visuals</label>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex flex-col gap-1">
                  <span className="text-zinc-500">Color</span>
                  <input
                    type="color"
                    value={(Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.color || '#10b981'}
                    className="w-full h-8 cursor-pointer rounded bg-zinc-800 border border-zinc-700 p-0 overflow-hidden"
                    onChange={e => {
                      const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                      if (targetEntity) {
                        targetEntity.color = e.target.value;
                        handleUIEvent('manipulated?', uiMode.target);
                      }
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-zinc-500">Opacity</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={(Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.opacity ?? 1}
                    className="w-full accent-emerald-500"
                    onChange={e => {
                      const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                      if (targetEntity) {
                        targetEntity.opacity = Number(e.target.value);
                        handleUIEvent('manipulated?', uiMode.target);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {uiMode?.type === 'design' && (
        <div className="absolute top-auto bottom-0 left-0 right-0 sm:top-4 sm:bottom-auto sm:right-auto sm:left-4 bg-zinc-900 sm:border border-t border-zinc-800 p-4 rounded-t-2xl sm:rounded-xl shadow-2xl z-50 text-white w-full sm:w-64 pointer-events-auto max-h-[50vh] sm:max-h-[80vh] overflow-y-auto">
          <h3 className="font-bold text-sm mb-2 text-emerald-400">Design Tool</h3>
          <p className="text-xs text-zinc-400 mb-4">Adjust colors and textures for {uiMode.target}.</p>
          <div className="flex flex-col gap-3 text-xs">
            <label className="flex flex-col gap-1">
              <span className="text-zinc-500">Color</span>
              <input
                type="color"
                className="w-full h-8 cursor-pointer rounded bg-zinc-800 border-none"
                onChange={e => {
                  const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                  if (targetEntity) {
                    targetEntity.color = e.target.value;
                    handleUIEvent('manipulated?', uiMode.target);
                  }
                }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-zinc-500">Texture URL</span>
              <input
                type="text"
                className="bg-zinc-800 p-1.5 rounded outline-none w-full"
                placeholder="https://..."
                onChange={e => {
                  const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                  if (targetEntity) {
                    targetEntity.image = e.target.value;
                    targetEntity.backgroundImage = e.target.value;
                    handleUIEvent('manipulated?', uiMode.target);
                  }
                }}
              />
            </label>
          </div>
        </div>
      )}

      {uiMode?.type === '3DEditor' && (
        <div className="absolute bottom-0 left-0 right-0 sm:bottom-4 sm:left-1/2 sm:-translate-x-1/2 bg-zinc-900 border-t sm:border border-zinc-800 p-4 rounded-t-2xl sm:rounded-xl shadow-2xl z-50 text-white w-full sm:w-80 pointer-events-auto text-center flex flex-col items-center max-h-[50vh] sm:max-h-[80vh] overflow-y-auto">
          <h3 className="font-bold text-sm mb-2 text-blue-400">3D Editor</h3>
          <p className="text-xs text-zinc-400 mb-4">Import models from Blender (.gltf, .glb).</p>
          <label className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm transition-colors shadow-lg cursor-pointer">
            Import 3D Model
            <input
              type="file"
              accept=".gltf,.glb"
              className="hidden"
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  notify.success(`Imported ${e.target.files[0].name} successfully! (Preview Mode)`);
                }
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
