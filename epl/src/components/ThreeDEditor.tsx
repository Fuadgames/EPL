import React, { useState, Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box, Sphere, Cylinder, useGLTF, TransformControls } from '@react-three/drei';
import { clsx } from 'clsx';
import { Download, Plus, Move, Move3d } from 'lucide-react';

interface Shape {
  id: string;
  type: 'box' | 'sphere' | 'cylinder' | 'model';
  position: [number, number, number];
  color: string;
  url?: string;
}

function Model({ url, color, isSelected }: { url: string, color: string, isSelected?: boolean }) {
  const { scene } = useGLTF(url);
  return (
    <primitive object={scene} scale={1.5} />
  );
}

export default function ThreeDEditor() {
  const [shapes, setShapes] = useState<Shape[]>([
    { id: '1', type: 'box', position: [0, 0, 0], color: '#10b981' }
  ]);
  const [selectedId, setSelectedId] = useState<string>('1');
  const [currentColor, setCurrentColor] = useState('#10b981');
  const [dragMode, setDragMode] = useState<'translate' | 'rotate' | 'scale'>('translate');

  // Handle keyboard deletes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't delete if they are typing in an input
      if (document.activeElement?.tagName === 'INPUT') return;
      
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedId) {
          setShapes(s => s.filter(shape => shape.id !== selectedId));
          setSelectedId('');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId]);

  const handleAddShape = (type: 'box' | 'sphere' | 'cylinder') => {
    const newId = Math.random().toString();
    setShapes([...shapes, { 
      id: newId, 
      type, 
      position: [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1], 
      color: currentColor 
    }]);
    setSelectedId(newId);
  };

  const handleImportModel = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      const newId = Math.random().toString();
      setShapes([...shapes, {
          id: newId,
          type: 'model',
          position: [0, 0, 0],
          color: currentColor,
          url
      }]);
      setSelectedId(newId);
    }
  };

  const updateColor = (color: string) => {
    setCurrentColor(color);
    setShapes(s => s.map(shape => shape.id === selectedId ? { ...shape, color } : shape));
  };

  return (
    <div className="flex flex-col h-full w-full bg-zinc-900 rounded focus:outline-none" tabIndex={0}>
      {/* Toolbar */}
      <div className="flex p-2 gap-2 bg-zinc-800 border-b border-zinc-700 mx-auto justify-center w-full flex-wrap">
        <button onClick={() => handleAddShape('box')} className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded flex items-center gap-1 text-zinc-200">
           <Plus size={14} /> Cube
        </button>
        <button onClick={() => handleAddShape('sphere')} className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded flex items-center gap-1 text-zinc-200">
           <Plus size={14} /> Sphere
        </button>
        <button onClick={() => handleAddShape('cylinder')} className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded flex items-center gap-1 text-zinc-200">
           <Plus size={14} /> Cylinder
        </button>
        
        <div className="w-px h-6 bg-zinc-600 self-center mx-2" />

        <label className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded flex items-center gap-1 text-zinc-200 cursor-pointer">
           <Download size={14} /> Import .gltf
           <input type="file" accept=".gltf,.glb" className="hidden" onChange={handleImportModel} />
        </label>

        <div className="w-px h-6 bg-zinc-600 self-center mx-2" />

        <button 
          onClick={() => setDragMode('translate')} 
          className={clsx("px-2 py-1 text-xs rounded flex items-center gap-1", dragMode === 'translate' ? "bg-emerald-600 text-white" : "bg-zinc-700 text-zinc-200")}
        >
          <Move size={14} /> Move
        </button>
        <button 
          onClick={() => setDragMode('rotate')} 
          className={clsx("px-2 py-1 text-xs rounded flex items-center gap-1", dragMode === 'rotate' ? "bg-emerald-600 text-white" : "bg-zinc-700 text-zinc-200")}
        >
          <Move3d size={14} /> Rotate
        </button>

        <div className="w-px h-6 bg-zinc-600 self-center mx-2" />

        <input 
          type="color" 
          value={currentColor} 
          onChange={(e) => updateColor(e.target.value)} 
          className="w-8 h-8 rounded cursor-pointer border-0 p-0 self-center"
          title="Color"
        />
      </div>

      <div className="flex-1 w-full h-full min-h-[300px] bg-zinc-950 relative">
        <Canvas camera={{ position: [5, 5, 5], fov: 50 }} onPointerMissed={() => setSelectedId('')}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <Grid />
          <OrbitControls makeDefault />
          <Suspense fallback={null}>
            {shapes.map((shape) => {
              const isSelected = shape.id === selectedId;
              const emissiveColor = isSelected ? shape.color : '#000000';
              const emissiveIntensity = isSelected ? 0.3 : 0;
              
              let content;
              if (shape.type === 'model' && shape.url) {
                  content = (
                      <group onClick={(e) => { e.stopPropagation(); setSelectedId(shape.id); setCurrentColor(shape.color); }}>
                          <Model url={shape.url} color={shape.color} isSelected={isSelected} />
                      </group>
                  );
              } else {
                  const ShapeComp = shape.type === 'box' ? Box : shape.type === 'sphere' ? Sphere : Cylinder;
                  content = (
                    <ShapeComp 
                        onClick={(e) => { e.stopPropagation(); setSelectedId(shape.id); setCurrentColor(shape.color); }}
                    >
                      <meshStandardMaterial color={shape.color} emissive={emissiveColor} emissiveIntensity={emissiveIntensity} />
                    </ShapeComp>
                  );
              }

              if (isSelected) {
                  return (
                      <TransformControls key={shape.id} mode={dragMode} position={shape.position}>
                          {content}
                      </TransformControls>
                  );
              }

              return (
                  <group key={shape.id} position={shape.position}>
                      {content}
                  </group>
              );
            })}
          </Suspense>
        </Canvas>
      </div>
      <div className="absolute bottom-4 right-4 text-zinc-500 text-xs text-center pointer-events-none">
        Press Backspace to delete selected<br/>Click empty space to deselect
      </div>
    </div>
  );
}

function Grid() {
    return (
        <gridHelper args={[20, 20, '#444444', '#222222']} />
    );
}
