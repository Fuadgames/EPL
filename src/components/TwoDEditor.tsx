import React, { useRef, useState, useEffect } from 'react';
import { Paintbrush, PaintBucket, Eraser } from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from '../store/useStore';

interface TwoDEditorProps {
  targetEntity?: any;
  onSave?: (imageDataUrl: string) => void;
}

export default function TwoDEditor({ targetEntity, onSave }: TwoDEditorProps) {
  const language = useStore(state => state.language);
  const isRu = language === 'ru';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<'brush' | 'fill' | 'eraser'>('brush');
  const [color, setColor] = useState('#10b981');
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const imageUrl = targetEntity?.image || targetEntity?.file;
        if (imageUrl) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
            const x = (canvas.width / 2) - (img.width / 2) * scale;
            const y = (canvas.height / 2) - (img.height / 2) * scale;
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
          };
          img.src = imageUrl;
        }
      }
    }
  }, [targetEntity]);

  const handleSave = () => {
    if (canvasRef.current && onSave) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      onSave(dataUrl);
    }
  };

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX: number;
    let clientY: number;
    if ('touches' in e) {
      const touch = e.touches?.[0] || e.changedTouches?.[0];
      if (!touch) return null;
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const coords = getCoordinates(e);
    if (!coords || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (tool === 'fill') {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setIsDrawing(false);
      return;
    }

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || tool === 'fill') return;
    const coords = getCoordinates(e);
    if (!coords || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = tool === 'eraser' ? 20 : 5;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  return (
    <div className="flex flex-col h-full w-full bg-zinc-900 rounded">
      {/* Toolbar */}
      <div className="flex flex-wrap p-2 gap-2 bg-zinc-800 border-b border-zinc-700 mx-auto justify-center rounded-t w-full">
        <button
          onClick={() => setTool('brush')}
          className={clsx("p-2 rounded min-h-[38px] min-w-[38px] flex items-center justify-center", tool === 'brush' ? "bg-zinc-700 text-blue-400" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700")}
          title={isRu ? 'Кисть' : 'Brush'}
        >
          <Paintbrush size={18} />
        </button>
        <button
          onClick={() => setTool('fill')}
          className={clsx("p-2 rounded min-h-[38px] min-w-[38px] flex items-center justify-center", tool === 'fill' ? "bg-zinc-700 text-blue-400" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700")}
          title={isRu ? 'Заливка' : 'Fill'}
        >
          <PaintBucket size={18} />
        </button>
        <button
          onClick={() => setTool('eraser')}
          className={clsx("p-2 rounded min-h-[38px] min-w-[38px] flex items-center justify-center", tool === 'eraser' ? "bg-zinc-700 text-blue-400" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700")}
          title={isRu ? 'Ластик' : 'Eraser'}
        >
          <Eraser size={18} />
        </button>

        <div className="w-px h-6 bg-zinc-600 self-center mx-1 hidden sm:block" />

        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-0 p-0 self-center"
          title={isRu ? 'Цвет' : 'Color'}
        />

        <div className="w-px h-6 bg-zinc-600 self-center mx-1 hidden sm:block" />

        <button
          onClick={handleSave}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded shadow transition-colors self-center"
        >
          {isRu ? 'Сохранить в объект' : 'Save to Object'}
        </button>
      </div>

      <div className="flex-1 flex justify-center items-center bg-zinc-950 p-2 sm:p-4 overflow-hidden relative">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="bg-white rounded shadow max-w-full max-h-full object-contain touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
    </div>
  );
}
