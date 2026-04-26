import React from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

import { useStore } from '../store/useStore';
import { getDefaultAvatar } from '../lib/avatar';

interface AppPreviewProps {
  entities: any;
  uiMode?: { type: string; target?: string } | null;
  handleUIEvent: (eventName: string, target?: string) => void;
  isFullScreen?: boolean;
}

export default function AppPreview({ entities, uiMode, handleUIEvent, isFullScreen }: AppPreviewProps) {
  const computerStyle = useStore(state => state.computerStyle);
  const camera = Object.values(entities).find((e: any) => e.type === '3DCamera') as any;

  // We add a wrapper for camera perspective
  const wrapperStyle: React.CSSProperties = camera ? {
    perspective: '1000px',
    transformStyle: 'preserve-3d',
    transform: `rotateX(${(camera.lookAt === 'center' ? 60 : 0)}deg) translateZ(-100px)`,
    width: '100%',
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0
  } : {
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

  return (
    <div 
      className={clsx("w-full h-full relative overflow-hidden", )}
      style={{
        backgroundColor: computerStyle ? 'transparent' : ((Object.values(entities).find((e: any) => e.type === 'world') as any)?.background || (Object.values(entities).find((e: any) => e.type === 'world') as any)?.color || '#ffffff'),
        backgroundImage: (Object.values(entities).find((e: any) => e.type === 'world') as any)?.backgroundImage ? `url(${(Object.values(entities).find((e: any) => e.type === 'world') as any)?.backgroundImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        perspective: camera ? '1000px' : 'none'
      }}
    >
      {computerStyle && (Object.values(entities).find((e: any) => e.type === 'world') as any)?.backgroundImage && (
        <div className="absolute inset-0 bg-emerald-900/50 mix-blend-color pointer-events-none z-0" />
      )}
      
      <div style={wrapperStyle}>
      {Object.values(entities).map((entity: any) => {
        if (entity.spawnComponent && !entity.isActive) return null;

        if (entity.type === 'sprite' || entity.type === 'player' || entity.type === 'enemy' || entity.type === 'png') {
          return (
            <motion.img 
              key={`${entity.id}_${entity.x||""}_${entity.y||""}`}
              src={entity.image || getDefaultAvatar(entity.name)}
              className="absolute"
              style={{ 
                left: entity.x || 0, 
                top: entity.y || 0, 
                width: entity.width || 64, 
                height: entity.height || 64,
                filter: computerStyle ? 'grayscale(1) sepia(1) hue-rotate(80deg) saturate(500%) brightness(0.8) contrast(2) drop-shadow(0 0 8px rgba(16,185,129,0.8))' : 'none',
                borderRadius: getBorderRadius(entity),
                transitionProperty: 'left, top, transform',
                transitionTimingFunction: 'linear',
                transitionDuration: entity.transitionDuration !== undefined ? `${entity.transitionDuration}s` : '0s',
                transform: `scale(${entity.scale || 1})`
              }}
              alt={entity.name}
              referrerPolicy="no-referrer"
              drag={entity.isDraggable || (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name))}
              dragMomentum={false}
              animate={{ x: 0, y: 0 }}
              transition={{ duration: 0 }}
              onDragEnd={(e, info) => {
                if (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name)) {
                  entity.x = Math.round(parseFloat(entity.x || 0) + info.offset.x);
                  entity.y = Math.round(parseFloat(entity.y || 0) + info.offset.y);
                  handleUIEvent('manipulated?', entity.name); // trigger update
                } else if (entity.isDraggable) {
                  handleUIEvent('dragged?', entity.name);
                }
              }}
            />
          );
        }
        if (entity.type === 'button') {
          return (
            <motion.button
              key={`${entity.id}_${entity.x||""}_${entity.y||""}`}
              onClick={() => handleUIEvent('clicked?', entity.name)}
              className={clsx("absolute px-4 py-2 font-medium shadow-md transition-all hover:scale-105", computerStyle ? "border-2 border-emerald-500 text-emerald-500 bg-black shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "text-white", (entity.borderRadius === undefined && entity.corner === undefined) && "rounded-lg")}
              style={{ 
                left: entity.x || 0, 
                top: entity.y || 0,
                backgroundColor: computerStyle ? '#050505' : (entity.color || '#10b981'),
                borderRadius: getBorderRadius(entity),
                transitionProperty: 'left, top, background-color, transform',
                transitionTimingFunction: 'linear',
                transitionDuration: entity.transitionDuration !== undefined ? `${entity.transitionDuration}s` : '0s',
                transform: `scale(${entity.scale || 1})`
              }}
              drag={entity.isDraggable || (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name))}
              dragMomentum={false}
              animate={{ x: 0, y: 0 }}
              transition={{ duration: 0 }}
              onDragEnd={(e, info) => {
                if (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name)) {
                  entity.x = Math.round(parseFloat(entity.x || 0) + info.offset.x);
                  entity.y = Math.round(parseFloat(entity.y || 0) + info.offset.y);
                  handleUIEvent('manipulated?', entity.name); // trigger update
                } else if (entity.isDraggable) {
                  handleUIEvent('dragged?', entity.name);
                }
              }}
            >
              {entity.label || entity.name}
            </motion.button>
          );
        }
        if (entity.type === 'block') {
          return (
            <motion.div
              key={`${entity.id}_${entity.x||""}_${entity.y||""}`}
              className={clsx("absolute", computerStyle && "border-2 border-emerald-500 bg-black shadow-[0_0_10px_rgba(16,185,129,0.5)]")}
              style={{ 
                left: entity.x || 0, 
                top: entity.y || 0,
                width: entity.width || 50,
                height: entity.height || 50,
                backgroundColor: computerStyle ? '#050505' : (entity.color || '#3f3f46'),
                borderRadius: getBorderRadius(entity),
                transitionProperty: 'left, top, transform',
                transitionTimingFunction: 'linear',
                transitionDuration: entity.transitionDuration !== undefined ? `${entity.transitionDuration}s` : '0s',
                opacity: entity.opacity !== undefined ? entity.opacity : 1,
                transform: `scale(${entity.scale || 1})`
              }}
              drag={entity.isDraggable || (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name))}
              dragMomentum={false}
              animate={{ x: 0, y: 0 }}
              transition={{ duration: 0 }}
              onDragEnd={(e, info) => {
                if (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name)) {
                  entity.x = Math.round(parseFloat(entity.x || 0) + info.offset.x);
                  entity.y = Math.round(parseFloat(entity.y || 0) + info.offset.y);
                  handleUIEvent('manipulated?', entity.name); // trigger update
                } else if (entity.isDraggable) {
                  handleUIEvent('dragged?', entity.name);
                }
              }}
            />
          );
        }
        if (entity.type === '3Dblock') {
          return (
            <motion.div
              key={`${entity.id}_${entity.x||""}_${entity.y||""}`}
              className={clsx("absolute", computerStyle && "border-2 border-emerald-500 bg-black shadow-[4px_4px_0px_rgba(16,185,129,0.5)]")}
              style={{ 
                left: entity.x || 0, 
                top: entity.y || 0,
                width: entity.size || 50,
                height: entity.size || 50,
                backgroundColor: computerStyle ? '#050505' : (entity.color || '#3f3f46'),
                borderRadius: getBorderRadius(entity),
                boxShadow: computerStyle ? undefined : '4px 4px 0px rgba(0,0,0,0.5)',
                transitionProperty: 'left, top, transform',
                transitionTimingFunction: 'linear',
                transitionDuration: entity.transitionDuration !== undefined ? `${entity.transitionDuration}s` : '0s',
                transform: `scale(${entity.scale || 1})`
              }}
              drag={entity.isDraggable || (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name))}
              dragMomentum={false}
              animate={{ x: 0, y: 0 }}
              transition={{ duration: 0 }}
              onDragEnd={(e, info) => {
                if (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name)) {
                  entity.x = Math.round(parseFloat(entity.x || 0) + info.offset.x);
                  entity.y = Math.round(parseFloat(entity.y || 0) + info.offset.y);
                  handleUIEvent('manipulated?', entity.name); // trigger update
                } else if (entity.isDraggable) {
                  handleUIEvent('dragged?', entity.name);
                }
              }}
            />
          );
        }
        if (entity.type === 'text_label') {
          return (
            <motion.div
              key={`${entity.id}_${entity.x||""}_${entity.y||""}`}
              className={clsx("absolute font-bold", computerStyle && "text-emerald-500")}
              style={{ 
                left: entity.x || 0, 
                top: entity.y || 0,
                color: computerStyle ? '#10b981' : (entity.color || '#000000'),
                textShadow: computerStyle ? '0 0 8px rgba(16,185,129,0.8)' : undefined,
                fontSize: entity.size ? `${entity.size}px` : '16px',
                transitionProperty: 'left, top, transform',
                transitionTimingFunction: 'linear',
                transitionDuration: entity.transitionDuration !== undefined ? `${entity.transitionDuration}s` : '0s',
                opacity: entity.opacity !== undefined ? entity.opacity : 1,
                transform: `scale(${entity.scale || 1})`
              }}
              drag={entity.isDraggable || (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name))}
              dragMomentum={false}
              animate={{ x: 0, y: 0 }}
              transition={{ duration: 0 }}
              onDragEnd={(e, info) => {
                if (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name)) {
                  entity.x = Math.round(parseFloat(entity.x || 0) + info.offset.x);
                  entity.y = Math.round(parseFloat(entity.y || 0) + info.offset.y);
                  handleUIEvent('manipulated?', entity.name); // trigger update
                } else if (entity.isDraggable) {
                  handleUIEvent('dragged?', entity.name);
                }
              }}
            >
              {entity.text || entity.name}
            </motion.div>
          );
        }
        if (entity.type === 'textbox') {
          return (
            <motion.input
              key={`${entity.id}_${entity.x||""}_${entity.y||""}`}
              type="text"
              placeholder={entity.placeholder || 'Type here...'}
              value={entity.text || ''}
              onChange={(e) => {
                entity.text = e.target.value;
                handleUIEvent('writed?', entity.name);
              }}
              className={clsx("absolute px-3 py-2 focus:outline-none transition-colors", computerStyle ? "bg-black border border-emerald-500 text-emerald-500 focus:border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-zinc-900 border border-zinc-700 text-white focus:border-emerald-500", (entity.borderRadius === undefined && entity.corner === undefined) && "rounded-lg")}
              style={{ 
                left: entity.x || 0, 
                top: entity.y || 0,
                width: entity.width || 200,
                borderRadius: getBorderRadius(entity),
                transitionProperty: 'left, top, transform',
                transitionTimingFunction: 'linear',
                transitionDuration: entity.transitionDuration !== undefined ? `${entity.transitionDuration}s` : '0s',
                transform: `scale(${entity.scale || 1})`
              }}
              drag={entity.isDraggable || (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name))}
              dragMomentum={false}
              animate={{ x: 0, y: 0 }}
              transition={{ duration: 0 }}
              onDragEnd={(e, info) => {
                if (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name)) {
                  entity.x = Math.round(parseFloat(entity.x || 0) + info.offset.x);
                  entity.y = Math.round(parseFloat(entity.y || 0) + info.offset.y);
                  handleUIEvent('manipulated?', entity.name); // trigger update
                } else if (entity.isDraggable) {
                  handleUIEvent('dragged?', entity.name);
                }
              }}
            />
          );
        }
        if (entity.type === 'circle') {
          return (
            <motion.div
              key={`${entity.id}_${entity.x||""}_${entity.y||""}`}
              className={clsx("absolute", computerStyle && "border-2 border-emerald-500 bg-black shadow-[0_0_10px_rgba(16,185,129,0.5)]", (entity.borderRadius === undefined && entity.corner === undefined) && "rounded-full")}
              style={{ 
                left: entity.x || 0, 
                top: entity.y || 0,
                width: (entity.radius || 25) * 2,
                height: (entity.radius || 25) * 2,
                backgroundColor: computerStyle ? '#050505' : (entity.color || '#3f3f46'),
                borderRadius: getBorderRadius(entity),
                transitionProperty: 'left, top, transform',
                transitionTimingFunction: 'linear',
                transitionDuration: entity.transitionDuration !== undefined ? `${entity.transitionDuration}s` : '0s',
                opacity: entity.opacity !== undefined ? entity.opacity : 1,
                transform: `scale(${entity.scale || 1})`
              }}
              drag={entity.isDraggable || (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name))}
              dragMomentum={false}
              animate={{ x: 0, y: 0 }}
              transition={{ duration: 0 }}
              onDragEnd={(e, info) => {
                if (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name)) {
                  entity.x = Math.round(parseFloat(entity.x || 0) + info.offset.x);
                  entity.y = Math.round(parseFloat(entity.y || 0) + info.offset.y);
                  handleUIEvent('manipulated?', entity.name); // trigger update
                } else if (entity.isDraggable) {
                  handleUIEvent('dragged?', entity.name);
                }
              }}
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
              key={`${entity.id}_${entity.x||""}_${entity.y||""}`}
              className="absolute origin-left"
              style={{ 
                left: x1, 
                top: y1,
                width: length,
                height: entity.thickness || 2,
                backgroundColor: entity.color || '#000000',
                transform: `rotate(${angle}deg) scale(${entity.scale || 1})`,
                opacity: entity.opacity !== undefined ? entity.opacity : 1
              }}
              drag={entity.isDraggable || (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name))}
              dragMomentum={false}
              animate={{ x: 0, y: 0 }}
              transition={{ duration: 0 }}
              onDragEnd={(e, info) => {
                if (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name)) {
                  entity.x = Math.round(parseFloat(entity.x || 0) + info.offset.x);
                  entity.y = Math.round(parseFloat(entity.y || 0) + info.offset.y);
                  handleUIEvent('manipulated?', entity.name); // trigger update
                } else if (entity.isDraggable) {
                  handleUIEvent('dragged?', entity.name);
                }
              }}
            />
          );
        }
        if (entity.type === 'terminal') {
          return (
            <motion.div
              key={`${entity.id}_${entity.x||""}_${entity.y||""}`}
              className="absolute bg-black text-green-500 font-mono p-4 rounded-lg shadow-lg overflow-y-auto border border-zinc-800"
              style={{ 
                left: entity.x || 0, 
                top: entity.y || 0,
                width: entity.width || 400,
                height: entity.height || 300,
                opacity: entity.opacity !== undefined ? entity.opacity : 1
              }}
              drag={entity.isDraggable || (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name))}
              dragMomentum={false}
              animate={{ x: 0, y: 0 }}
              transition={{ duration: 0 }}
              onDragEnd={(e, info) => {
                if (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name)) {
                  entity.x = Math.round(parseFloat(entity.x || 0) + info.offset.x);
                  entity.y = Math.round(parseFloat(entity.y || 0) + info.offset.y);
                  handleUIEvent('manipulated?', entity.name); // trigger update
                } else if (entity.isDraggable) {
                  handleUIEvent('dragged?', entity.name);
                }
              }}
            >
              <div className="flex items-center gap-2 mb-2 border-b border-zinc-800 pb-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <pre className="whitespace-pre-wrap text-sm">{entity.text || 'Welcome to Terminal...'}</pre>
            </motion.div>
          );
        }
        if (entity.type === 'gradient') {
          const variant = entity.variant || 'emerald';
          const size = entity.size || 200;
          return (
            <motion.div
              key={`${entity.id}_${entity.x||""}_${entity.y||""}`}
              className={`absolute blur-[80px] rounded-full mix-blend-screen opacity-50 bg-${variant}-500`}
              style={{
                left: entity.x || 0,
                top: entity.y || 0,
                width: size,
                height: size,
                backgroundColor: entity.variant === 'purple' ? '#a855f7' : entity.variant === 'blue' ? '#3b82f6' : '#10b981',
                opacity: entity.opacity !== undefined ? entity.opacity * 0.5 : 0.5,
                transform: `scale(${entity.scale || 1})`
              }}
              drag={entity.isDraggable || (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name))}
              dragMomentum={false}
              animate={{ x: 0, y: 0 }}
              transition={{ duration: 0 }}
              onDragEnd={(e, info) => {
                if (uiMode?.type === 'position' && (!uiMode.target || uiMode.target === entity.name)) {
                  entity.x = Math.round(parseFloat(entity.x || 0) + info.offset.x);
                  entity.y = Math.round(parseFloat(entity.y || 0) + info.offset.y);
                  handleUIEvent('manipulated?', entity.name); // trigger update
                } else if (entity.isDraggable) {
                  handleUIEvent('dragged?', entity.name);
                }
              }}
            />
          );
        }
        return null;
      })}
      </div>

      {uiMode?.type === 'position' && (
        <div className="absolute top-4 right-4 bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-2xl z-50 text-white w-72 pointer-events-auto shadow-[0_0_20px_rgba(16,185,129,0.2)] max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm text-emerald-400">Position & Properties</h3>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded uppercase font-bold">{uiMode.target}</span>
          </div>
          <p className="text-[10px] text-zinc-500 mb-4 uppercase tracking-wider font-semibold">Fine-tune your entity</p>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex flex-col">
                <label className="text-zinc-500 mb-1">X Position</label>
                <input type="number" 
                  value={(Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.x || 0}
                  className="bg-zinc-800 p-2 rounded outline-none w-full border border-zinc-700 focus:border-emerald-500" 
                  onChange={(e) => {
                  const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                  if (targetEntity) {
                    targetEntity.x = Number(e.target.value);
                    handleUIEvent('manipulated?', uiMode.target);
                  }
                }} />
              </div>
              <div className="flex flex-col">
                <label className="text-zinc-500 mb-1">Y Position</label>
                <input type="number" 
                  value={(Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.y || 0}
                  className="bg-zinc-800 p-2 rounded outline-none w-full border border-zinc-700 focus:border-emerald-500" 
                  onChange={(e) => {
                  const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                  if (targetEntity) {
                    targetEntity.y = Number(e.target.value);
                    handleUIEvent('manipulated?', uiMode.target);
                  }
                }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex flex-col">
                <label className="text-zinc-500 mb-1">Width / Size</label>
                <input type="number" 
                  value={(() => {
                    const ent = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                    return ent?.width || ent?.size || (ent?.radius ? ent.radius * 2 : 0) || 0;
                  })()}
                  className="bg-zinc-800 p-2 rounded outline-none w-full border border-zinc-700 focus:border-emerald-500" 
                  onChange={(e) => {
                  const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                  if (targetEntity) {
                    const val = Number(e.target.value);
                    if (targetEntity.radius !== undefined) targetEntity.radius = val / 2;
                    else if (targetEntity.size !== undefined) targetEntity.size = val;
                    else targetEntity.width = val;
                    handleUIEvent('manipulated?', uiMode.target);
                  }
                }} />
              </div>
              <div className="flex flex-col">
                <label className="text-zinc-500 mb-1">Height</label>
                <input type="number" 
                  value={(Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.height || 0}
                  className="bg-zinc-800 p-2 rounded outline-none w-full border border-zinc-700 focus:border-emerald-500" 
                  onChange={(e) => {
                  const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                  if (targetEntity) {
                    targetEntity.height = Number(e.target.value);
                    handleUIEvent('manipulated?', uiMode.target);
                  }
                }} />
              </div>
            </div>

            <div className="flex flex-col text-xs">
              <label className="text-zinc-500 mb-1">Corner Radius (Smoothing)</label>
              <div className="flex items-center gap-3">
                <input type="range" min="0" max="100" 
                  value={(() => {
                    const ent = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                    return ent?.borderRadius !== undefined ? ent.borderRadius : (ent?.corner || 0);
                  })()}
                  className="flex-1 accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                  onChange={(e) => {
                    const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                    if (targetEntity) {
                      const val = Number(e.target.value);
                      targetEntity.borderRadius = val;
                      targetEntity.corner = val;
                      handleUIEvent('manipulated?', uiMode.target);
                    }
                  }}
                />
                <span className="w-8 text-right font-mono text-emerald-400">{(() => {
                  const ent = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                  return ent?.borderRadius !== undefined ? ent.borderRadius : (ent?.corner || 0);
                })()}</span>
              </div>
            </div>

              <div className="flex flex-col text-xs mt-4">
              <label className="text-zinc-500 mb-1">Scale</label>
              <div className="flex items-center gap-3">
                <input type="range" min="0.1" max="3" step="0.1"
                  value={(Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.scale || 1}
                  className="flex-1 accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                  onChange={(e) => {
                    const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                    if (targetEntity) {
                      targetEntity.scale = Number(e.target.value);
                      handleUIEvent('manipulated?', uiMode.target);
                    }
                  }}
                />
                <span className="w-8 text-right font-mono text-emerald-400">
                  {((Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.scale || 1).toFixed(1)}
                </span>
              </div>
            </div>

            <div className="flex flex-col text-xs mt-4 border-t border-zinc-800 pt-3">
              <label className="flex items-center gap-2 cursor-pointer text-zinc-500">
                <input type="checkbox" 
                  checked={!!(Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.spawnComponent}
                  className="accent-emerald-500"
                  onChange={(e) => {
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
                  <div className="flex items-center gap-2">
                    <input type="color" 
                      value={(Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.color || '#10b981'}
                      className="w-full h-8 cursor-pointer rounded bg-zinc-800 border border-zinc-700 p-0 overflow-hidden" 
                      onChange={(e) => {
                      const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                      if (targetEntity) {
                        targetEntity.color = e.target.value;
                        handleUIEvent('manipulated?', uiMode.target);
                      }
                    }} />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-zinc-500">Opacity</span>
                  <input type="range" min="0" max="1" step="0.1" 
                    value={(Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.opacity ?? 1}
                    className="w-full accent-emerald-500"
                    onChange={(e) => {
                    const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                    if (targetEntity) {
                      targetEntity.opacity = Number(e.target.value);
                      handleUIEvent('manipulated?', uiMode.target);
                    }
                  }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {uiMode?.type === 'design' && (
        <div className="absolute top-4 left-4 bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-2xl z-50 text-white w-64 pointer-events-auto">
          <h3 className="font-bold text-sm mb-2 text-fuchsia-400">Design Tool</h3>
          <p className="text-xs text-zinc-400 mb-4">Adjust colors and textures for {uiMode.target}.</p>
          <div className="flex flex-col gap-3 text-xs">
            <label className="flex flex-col gap-1">
              <span className="text-zinc-500">Color</span>
              <input type="color" className="w-full h-8 cursor-pointer rounded bg-zinc-800 border-none" onChange={(e) => {
                const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                if (targetEntity) {
                  targetEntity.color = e.target.value;
                  handleUIEvent('manipulated?', uiMode.target);
                }
              }} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-zinc-500">Texture URL</span>
              <input type="text" className="bg-zinc-800 p-1.5 rounded outline-none w-full" placeholder="https://..." onChange={(e) => {
                const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                if (targetEntity) {
                  targetEntity.image = e.target.value;
                  targetEntity.backgroundImage = e.target.value;
                  handleUIEvent('manipulated?', uiMode.target);
                }
              }} />
            </label>
          </div>
        </div>
      )}

      {uiMode?.type === '3DEditor' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-2xl z-50 text-white w-80 pointer-events-auto text-center flex flex-col items-center">
          <h3 className="font-bold text-sm mb-2 text-blue-400">3D Editor</h3>
          <p className="text-xs text-zinc-400 mb-4">Import models from Blender (.gltf, .glb).</p>
          <label className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm transition-colors shadow-lg cursor-pointer">
            Import 3D Model
            <input type="file" accept=".gltf,.glb" className="hidden" onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                alert(`Imported ${e.target.files[0].name} successfully! (Preview Mode)`);
              }
            }} />
          </label>
        </div>
      )}
    </div>
  );
}
