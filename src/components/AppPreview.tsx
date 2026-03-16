import React from 'react';
import { clsx } from 'clsx';

interface AppPreviewProps {
  entities: any;
  handleUIEvent: (eventName: string, target?: string) => void;
}

export default function AppPreview({ entities, handleUIEvent }: AppPreviewProps) {
  return (
    <div 
      className="w-full h-full relative overflow-hidden"
      style={{
        backgroundColor: (Object.values(entities).find((e: any) => e.type === 'world') as any)?.background || '#ffffff',
        backgroundImage: (Object.values(entities).find((e: any) => e.type === 'world') as any)?.backgroundImage ? `url(${(Object.values(entities).find((e: any) => e.type === 'world') as any)?.backgroundImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {Object.values(entities).map((entity: any) => {
        if (entity.type === 'sprite' || entity.type === 'player' || entity.type === 'enemy' || entity.type === 'png') {
          return (
            <img 
              key={entity.id}
              src={entity.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${entity.name}`}
              className="absolute transition-all duration-300"
              style={{ left: entity.x || 0, top: entity.y || 0, width: entity.width || 64, height: entity.height || 64 }}
              alt={entity.name}
              referrerPolicy="no-referrer"
            />
          );
        }
        if (entity.type === 'button') {
          return (
            <button
              key={entity.id}
              onClick={() => handleUIEvent('clicked?', entity.name)}
              className="absolute px-4 py-2 text-white rounded-lg font-medium shadow-md transition-all hover:scale-105"
              style={{ 
                left: entity.x || 0, 
                top: entity.y || 0,
                backgroundColor: entity.color || '#10b981'
              }}
            >
              {entity.label || entity.name}
            </button>
          );
        }
        if (entity.type === 'block') {
          return (
            <div
              key={entity.id}
              className="absolute"
              style={{ 
                left: entity.x || 0, 
                top: entity.y || 0,
                width: entity.width || 50,
                height: entity.height || 50,
                backgroundColor: entity.color || '#3f3f46'
              }}
            />
          );
        }
        if (entity.type === '3Dblock') {
          return (
            <div
              key={entity.id}
              className="absolute"
              style={{ 
                left: entity.x || 0, 
                top: entity.y || 0,
                width: entity.size || 50,
                height: entity.size || 50,
                backgroundColor: entity.color || '#3f3f46',
                boxShadow: '4px 4px 0px rgba(0,0,0,0.5)'
              }}
            />
          );
        }
        if (entity.type === 'text_label') {
          return (
            <div
              key={entity.id}
              className="absolute font-bold"
              style={{ 
                left: entity.x || 0, 
                top: entity.y || 0,
                color: entity.color || '#000000',
                fontSize: entity.size ? `${entity.size}px` : '16px'
              }}
            >
              {entity.text || entity.name}
            </div>
          );
        }
        if (entity.type === 'textbox') {
          return (
            <input
              key={entity.id}
              type="text"
              placeholder={entity.placeholder || 'Type here...'}
              value={entity.text || ''}
              onChange={(e) => {
                entity.text = e.target.value;
                // Note: This won't trigger re-render of AppPreview directly, 
                // but handleUIEvent will trigger re-render of EditorView which will re-render AppPreview
                handleUIEvent('writed?', entity.name);
              }}
              className="absolute px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition-colors"
              style={{ 
                left: entity.x || 0, 
                top: entity.y || 0,
                width: entity.width || 200
              }}
            />
          );
        }
        if (entity.type === 'circle') {
          return (
            <div
              key={entity.id}
              className="absolute rounded-full"
              style={{ 
                left: entity.x || 0, 
                top: entity.y || 0,
                width: (entity.radius || 25) * 2,
                height: (entity.radius || 25) * 2,
                backgroundColor: entity.color || '#3f3f46'
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
            <div
              key={entity.id}
              className="absolute origin-left"
              style={{ 
                left: x1, 
                top: y1,
                width: length,
                height: entity.thickness || 2,
                backgroundColor: entity.color || '#000000',
                transform: `rotate(${angle}deg)`
              }}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
