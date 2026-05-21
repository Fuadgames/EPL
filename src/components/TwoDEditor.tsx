import React, { useRef, useState, useEffect } from 'react';
import { Paintbrush, PaintBucket, Eraser } from 'lucide-react';
import { clsx } from 'clsx';

interface TwoDEditorProps {
  targetEntity?: any;
  onSave?: (imageDataUrl: string) => void;
}

export default function TwoDEditor({ targetEntity, onSave }: TwoDEditorProps) {
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

        // Load targeted entity image if exists
        const imageUrl = targetEntity?.image || targetEntity?.file;
        if (imageUrl) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            // Draw image centered or scaled? Let's scale to fit for now
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
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    let x, y;
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = (e as React.MouseEvent).clientX - rect.left;
      y = (e as React.MouseEvent).clientY - rect.top;
    }
    return { x, y };
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
      <div className="flex p-2 gap-2 bg-zinc-800 border-b border-zinc-700 mx-auto justify-center rounded-t w-full">
        <button 
          onClick={() => setTool('brush')}
          className={clsx("p-2 rounded", tool === 'brush' ? "bg-zinc-700 text-blue-400" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700")}
          title="Brush"
        >
          <Paintbrush size={18} />
        </button>
        <button 
          onClick={() => setTool('fill')}
          className={clsx("p-2 rounded", tool === 'fill' ? "bg-zinc-700 text-blue-400" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700")}
          title="Fill"
        >
          <PaintBucket size={18} />
        </button>
        <button 
          onClick={() => setTool('eraser')}
          className={clsx("p-2 rounded", tool === 'eraser' ? "bg-zinc-700 text-blue-400" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700")}
          title="Eraser"
        >
          <Eraser size={18} />
        </button>

        <div className="w-px h-6 bg-zinc-600 self-center mx-2" />

        <input 
          type="color" 
          value={color} 
          onChange={(e) => setColor(e.target.value)} 
          className="w-8 h-8 rounded cursor-pointer border-0 p-0 self-center"
          title="Color"
        />

        <div className="w-px h-6 bg-zinc-600 self-center mx-2" />

        <button 
          onClick={handleSave}
          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded shadow transition-colors self-center"
        >
          Save to Object
        </button>
      </div>

      <div className="flex-1 flex justify-center items-center bg-zinc-950 p-4 overflow-hidden relative">
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
