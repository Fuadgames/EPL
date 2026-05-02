import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { clsx } from 'clsx';
import { Folder, Box, Plus, Settings, Play, StopCircle, Trash2, Copy, ChevronRight, ChevronDown, Type, MousePointerClick, Cloud, Asterisk, User, Droplet, CloudLightning, Menu, X, Save, Video, Undo2, Redo2 } from 'lucide-react';
import VisualEditor from './VisualEditor';
import { EPLInterpreter } from '../lib/epl-interpreter';

interface PreviewEditorProps {
  type: '2D' | '3D';
  code: string;
  onChange: (newCode: string) => void;
}

interface SceneNode {
  id: string;
  name: string;
  type: string;
  parentId: string;
  properties: Record<string, any>;
}

export default function PreviewEditor({ type, code, onChange }: PreviewEditorProps) {
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const setAddSceneNode = useStore(state => state.setAddSceneNode);
  const [isPlaying, setIsPlaying] = useState(false);
  const [interpreter, setInterpreter] = useState<EPLInterpreter | null>(null);
  const [initialNodesState, setInitialNodesState] = useState<any[] | null>(null);
  const [initialEditorCam, setInitialEditorCam] = useState<any | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNodeIdRef = useRef(selectedNodeId);
  useEffect(() => { selectedNodeIdRef.current = selectedNodeId; }, [selectedNodeId]);

  const isPlayingRef = useRef(isPlaying);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  const [editingScript, setEditingScript] = useState<{ id: string, name: string, content: string } | null>(null);
  const [scriptHistory, setScriptHistory] = useState<string[]>([]);
  const [scriptHistoryIndex, setScriptHistoryIndex] = useState(-1);

  const scriptHistoryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scriptHistoryIndexRef = useRef(scriptHistoryIndex);
  useEffect(() => { scriptHistoryIndexRef.current = scriptHistoryIndex; }, [scriptHistoryIndex]);

  const handleScriptChange = (newContent: string) => {
    if (editingScript) {
      setEditingScript({ ...editingScript, content: newContent });
      
      if (scriptHistoryTimeoutRef.current) {
        clearTimeout(scriptHistoryTimeoutRef.current);
      }

      scriptHistoryTimeoutRef.current = setTimeout(() => {
        setScriptHistory(prevHistory => {
          const newHistory = prevHistory.slice(0, scriptHistoryIndexRef.current + 1);
          if (newHistory.length === 0 || newHistory[newHistory.length - 1] !== newContent) {
            const updatedHistory = [...newHistory, newContent];
            // Limit history size to 50
            if (updatedHistory.length > 50) updatedHistory.shift();
            setScriptHistoryIndex(updatedHistory.length - 1);
            return updatedHistory;
          }
          return prevHistory;
        });
      }, 500);
    }
  };

  const undoScript = () => {
    if (scriptHistoryIndex > 0 && editingScript) {
      const newIndex = scriptHistoryIndex - 1;
      setScriptHistoryIndex(newIndex);
      setEditingScript({ ...editingScript, content: scriptHistory[newIndex] });
    }
  };

  const redoScript = () => {
    if (scriptHistoryIndex < scriptHistory.length - 1 && editingScript) {
      const newIndex = scriptHistoryIndex + 1;
      setScriptHistoryIndex(newIndex);
      setEditingScript({ ...editingScript, content: scriptHistory[newIndex] });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingScript && (e.ctrlKey || e.metaKey)) {
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) redoScript();
          else undoScript();
        } else if (e.key === 'y') {
          e.preventDefault();
          redoScript();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingScript, scriptHistory, scriptHistoryIndex]);
  
  const defaultFolders = [
    { id: 'Project', name: 'Project' },
    { id: 'Variables', name: 'Variables' },
    { id: 'Scripts', name: 'Scripts' },
    { id: 'Multiplayer', name: 'Multiplayer' },
    { id: 'Storage', name: 'Storage' },
    { id: 'Game', name: 'Game' },
  ];

  const [nodes, setNodes] = useState<SceneNode[]>([]);
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['Project', 'Game']));

  const [camera, setCamera] = useState({ x: 0, y: 0, z: type === '3D' ? 0 : 0, rotX: type === '3D' ? 60 : 0, rotY: 0, scale: 1 });
  
  useEffect(() => {
    return () => {
       // Auto-save visual scene on unmount
       if (nodesRef.current.length > 0) {
          // Note: syncToCode uses latest refs for nodes and camera
          syncToCodeRef.current?.(false);
       }
    };
  }, []);

  const [workspaceSettings, setWorkspaceSettings] = useState({
    backgroundColor: type === '3D' ? '#87CEEB' : '#ffffff',
    backgroundImage: '',
  });

  const syncToCodeRef = useRef<any>(null);
  useEffect(() => {
    if (!code || nodes.length > 0) return;
    
    let targetLines: string[] = [];
    const markerStart = '// --- VISUAL_SCENE_START ---';
    const markerEnd = '// --- VISUAL_SCENE_END ---';
    const startIdx = code.indexOf(markerStart);
    const endIdx = code.indexOf(markerEnd);

    if (startIdx !== -1 && endIdx !== -1) {
      const visualSection = code.substring(startIdx + markerStart.length, endIdx);
      targetLines = visualSection.split('\n');
      
      // Look for metadata
      const typeMatch = visualSection.match(/\/\/ mode=(2D|3D)/);
      if (typeMatch) {
        // We can't easily change the 'type' prop from here, but we can update camera
      }
      const camMatch = visualSection.match(/\/\/ camera=(.*)/);
      if (camMatch) {
         try {
           const savedCam = JSON.parse(camMatch[1]);
           setCamera(savedCam);
         } catch(e) {}
      }
    } else {
      // Fallback: only parse if specifically looking for entities to avoid over-parsing
      // But user complained about over-parsing, so let's be strict.
      // If no marker, we don't auto-restore to avoid "unintended blocks"
      return;
    }

    const newNodes: SceneNode[] = [];
    let currentScript: { name: string, content: string } | null = null;

    targetLines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('// camera=') || trimmed.startsWith('// mode=')) return;

      // Detect Script start
      const scriptMatch = trimmed.match(/^\/\/ --- Script: (.*) ---/);
      if (scriptMatch) {
        if (currentScript) {
          newNodes.push({
            id: Math.random().toString(36).substr(2, 9),
            name: currentScript.name,
            type: 'Script',
            parentId: 'Scripts',
            properties: { scriptContent: currentScript.content.trim() }
          });
        }
        currentScript = { name: scriptMatch[1], content: '' };
        return;
      }

      if (currentScript) {
        currentScript.content += line + '\n';
        return;
      }

      // Match variables or entities
      const entityMatch = trimmed.match(/^(\w+)\s*\{(.*)\}/);
      if (entityMatch) {
        const [, typeK, propStr] = entityMatch;
        const props: Record<string, any> = {};
        propStr.split(',').forEach(p => {
          const parts = p.split('=');
          if (parts.length >= 2) {
            const k = parts[0].trim();
            const v = parts.slice(1).join('=').trim();
            const num = parseFloat(v);
            props[k] = isNaN(num) ? v : num;
          }
        });

        let nodeType = 'Block';
        if (typeK === 'text_label') nodeType = 'Text';
        else if (typeK === 'player') nodeType = 'Player';
        else if (typeK === 'button') nodeType = 'Button';
        else if (typeK === 'textbox') nodeType = 'TextBox';
        else if (typeK === '3DCamera') nodeType = 'Camera';
        else if (typeK === 'particle') nodeType = 'Particle';
        else if (typeK === 'variable') nodeType = 'Variable';
        else if (typeK === 'lava') nodeType = 'Lava';
        else if (typeK === 'ground') nodeType = 'Ground';

        newNodes.push({
          id: Math.random().toString(36).substr(2, 9),
          name: props.name || `${nodeType}_${newNodes.length + 1}`,
          type: nodeType,
          parentId: nodeType === 'Variable' ? 'Variables' : 'Project',
          properties: props
        });
      }
    });

    // Final script
    if (currentScript) {
      newNodes.push({
        id: Math.random().toString(36).substr(2, 9),
        name: currentScript.name,
        type: 'Script',
        parentId: 'Scripts',
        properties: { scriptContent: currentScript.content.trim() }
      });
    }

    if (newNodes.length > 0) {
      setNodes(newNodes);
    }
  }, [code]);

  useEffect(() => {
    setAddSceneNode((nodeData: any) => {
      // If we are currently editing a script, append to it instead of creating a new one
      if (editingScript && nodeData.type === 'Script') {
        const newContent = editingScript.content + '\n' + nodeData.properties.scriptContent;
        setEditingScript({ ...editingScript, content: newContent });
        // Also update the node property so it persists if saved
        updateNodeProperty(editingScript.id, 'scriptContent', newContent);
        return;
      }

      const newNode: SceneNode = {
        id: Math.random().toString(36).substr(2, 9),
        name: nodeData.name || `${nodeData.type}_${nodes.length + 1}`,
        type: nodeData.type,
        parentId: nodeData.parentId || (nodeData.type === 'Script' ? 'Scripts' : 'Project'),
        properties: {
          x: 0, y: 0,
          ...(type === '3D' ? { z: 25, zDepth: 50, rotX: 0, rotY: 0, rotZ: 0 } : {}),
          width: 100, height: 100,
          ...nodeData.properties
        }
      };
      setNodes(prev => [...prev, newNode]);
      setSelectedNodeId(newNode.id);
    });
    return () => setAddSceneNode(() => {});
  }, [nodes.length, type, setAddSceneNode, editingScript]);

  const [cameraDrag, setCameraDrag] = useState<{ isPan: boolean, startX: number, startY: number, initialCam: any } | null>(null);
  const [nodeDrag, setNodeDrag] = useState<{ id: string, startX: number, startY: number, initialX: number, initialY: number } | null>(null);
  const [nodeResize, setNodeResize] = useState<{ id: string, startX: number, startY: number, initialW: number, initialH: number } | null>(null);

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [toolboxSearch, setToolboxSearch] = useState('');
  const [toolboxFilter, setToolboxFilter] = useState<'all' | '3d' | '2d' | 'ui' | 'logic'>('all');
  const [mobilePanel, setMobilePanel] = useState<'toolbox' | 'explorer' | 'none'>('none');

  const viewRef = useRef<HTMLDivElement>(null);

  const activeKeys = useRef(new Set<string>());
  const cameraRef = useRef(camera);
  useEffect(() => { cameraRef.current = camera; }, [camera]);

  const interpreterRef = useRef<EPLInterpreter | null>(null);
  useEffect(() => { interpreterRef.current = interpreter; }, [interpreter]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      
      activeKeys.current.add(e.code);

      if (isPlayingRef.current && interpreterRef.current) {
        let key = e.key.toLowerCase();
        if (e.key === 'ArrowUp') key = 'up';
        if (e.key === 'ArrowDown') key = 'down';
        if (e.key === 'ArrowLeft') key = 'left';
        if (e.key === 'ArrowRight') key = 'right';
        interpreterRef.current.keysPressed.add(key);
        interpreterRef.current.triggerEvent('key_pressed?', e.key);
      }

      if ((e.code === 'Delete' || e.code === 'Backspace') && selectedNodeIdRef.current) {
        setNodes(function(prev) {
           return prev.filter(n => n.id !== selectedNodeIdRef.current);
        });
        setSelectedNodeId(null);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      activeKeys.current.delete(e.code);
      if (isPlayingRef.current && interpreterRef.current) {
        let key = e.key.toLowerCase();
        if (e.key === 'ArrowUp') key = 'up';
        if (e.key === 'ArrowDown') key = 'down';
        if (e.key === 'ArrowLeft') key = 'left';
        if (e.key === 'ArrowRight') key = 'right';
        interpreterRef.current.keysPressed.delete(key);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let animationFrame: number;
    const updateCamera = () => {
      const speed = 25;
      const keys = activeKeys.current;

      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        animationFrame = requestAnimationFrame(updateCamera);
        return;
      }

      if (isPlayingRef.current) {
        if (keys.size > 0) {
          setNodes(nds => {
            return nds.map(n => {
              if (n.type === 'Player') {
                const moveSpeed = speed * 0.5;
                let dx = 0;
                let dy = 0;
                if (type === '3D') {
                   // In 3D, player moves relative to camera rotation
                   const rotationRad = (cameraRef.current.rotY * Math.PI) / 180;
                   const sin = Math.sin(rotationRad);
                   const cos = Math.cos(rotationRad);
                   if (keys.has('KeyW')) { dx += sin * moveSpeed; dy -= cos * moveSpeed; }
                   if (keys.has('KeyS')) { dx -= sin * moveSpeed; dy += cos * moveSpeed; }
                   if (keys.has('KeyA')) { dx -= cos * moveSpeed; dy -= sin * moveSpeed; }
                   if (keys.has('KeyD')) { dx += cos * moveSpeed; dy += sin * moveSpeed; }
                } else {
                   if (keys.has('KeyW')) dy -= moveSpeed;
                   if (keys.has('KeyS')) dy += moveSpeed;
                   if (keys.has('KeyA')) dx -= moveSpeed;
                   if (keys.has('KeyD')) dx += moveSpeed;
                }
                if (dx !== 0 || dy !== 0) {
                   const newX = (n.properties.x || 0) + dx;
                   const newY = (n.properties.y || 0) + dy;
                   if (interpreterRef.current) {
                      const entity = interpreterRef.current.context.entities[n.name];
                      if (entity) {
                        entity.x = newX;
                        entity.y = newY;
                      }
                   }
                   return { ...n, properties: { ...n.properties, x: newX, y: newY } };
                }
              }
              return n;
            });
          });
        }
        animationFrame = requestAnimationFrame(updateCamera);
        return;
      }

      if (keys.size === 0) {
        animationFrame = requestAnimationFrame(updateCamera);
        return;
      }

      setCamera(prev => {
        const next = { ...prev };
        const turbo = activeKeys.current.has('ShiftLeft') || activeKeys.current.has('ShiftRight') ? 3 : 1;
        const moveSpeed = speed * (1 / Math.max(0.1, prev.scale)) * turbo;
        
        // In 3D mode, WASD should move relative to view rotation
        if (type === '3D') {
          const rotationRad = (prev.rotY * Math.PI) / 180;
          const sin = Math.sin(rotationRad);
          const cos = Math.cos(rotationRad);

          if (keys.has('KeyW')) {
            next.x -= sin * moveSpeed;
            next.y += cos * moveSpeed;
          }
          if (keys.has('KeyS')) {
            next.x += sin * moveSpeed;
            next.y -= cos * moveSpeed;
          }
          if (keys.has('KeyA')) {
            next.x += cos * moveSpeed;
            next.y += sin * moveSpeed;
          }
          if (keys.has('KeyD')) {
            next.x -= cos * moveSpeed;
            next.y -= sin * moveSpeed;
          }
          
          if (keys.has('KeyQ')) next.z += moveSpeed;
          if (keys.has('KeyE')) next.z -= moveSpeed;
        } else {
          if (keys.has('KeyW')) next.y += moveSpeed;
          if (keys.has('KeyS')) next.y -= moveSpeed;
          if (keys.has('KeyA')) next.x -= moveSpeed;
          if (keys.has('KeyD')) next.x += moveSpeed;
        }
        
        return next;
      });
      animationFrame = requestAnimationFrame(updateCamera);
    };
    animationFrame = requestAnimationFrame(updateCamera);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrame);
    };
  }, [type]);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (cameraDrag) {
        let dx = (e.clientX - cameraDrag.startX) / cameraDrag.initialCam.scale;
        let dy = (e.clientY - cameraDrag.startY) / cameraDrag.initialCam.scale;

        if (cameraDrag.isPan) {
          if (type === '3D') {
             const rad = (-cameraDrag.initialCam.rotY * Math.PI) / 180;
             const s = Math.sin(rad);
             const c = Math.cos(rad);
             const pitchRad = (cameraDrag.initialCam.rotX * Math.PI) / 180;
             const pFactor = Math.cos(pitchRad) || 0.1;
             dy = dy / pFactor;
             const rotDx = dx * c - dy * s;
             const rotDy = dx * s + dy * c;
             dx = rotDx;
             dy = rotDy;
          }
          setCamera({
            ...cameraDrag.initialCam,
            x: cameraDrag.initialCam.x + dx,
            y: cameraDrag.initialCam.y + dy,
          });
        } else {
          const rx = e.clientX - cameraDrag.startX;
          const ry = e.clientY - cameraDrag.startY;
          setCamera({
            ...cameraDrag.initialCam,
            rotX: Math.max(0, Math.min(90, cameraDrag.initialCam.rotX - ry * 0.5)),
            rotY: cameraDrag.initialCam.rotY + rx * 0.5,
          });
        }
      }

      if (nodeDrag) {
        let dx = (e.clientX - nodeDrag.startX) / camera.scale;
        let dy = (e.clientY - nodeDrag.startY) / camera.scale;
        
        if (type === '3D') {
           const rad = (-camera.rotY * Math.PI) / 180;
           const s = Math.sin(rad);
           const c = Math.cos(rad);
           const pitchRad = (camera.rotX * Math.PI) / 180;
           const pFactor = Math.cos(pitchRad) || 0.1;
           dy = dy / pFactor;
           const rotDx = dx * c - dy * s;
           const rotDy = dx * s + dy * c;
           dx = rotDx;
           dy = rotDy;
        }

        setNodes(prev => prev.map(n => {
          if (n.id === nodeDrag.id) {
            const updatedNode = {
              ...n,
              properties: {
                ...n.properties,
                x: nodeDrag.initialX + dx,
                y: nodeDrag.initialY + dy
              }
            };
            // Sync with interpreter if playing
            if (isPlayingRef.current && interpreter) {
               const entity = interpreter.context.entities[n.name];
               if (entity) {
                 entity.x = updatedNode.properties.x;
                 entity.y = updatedNode.properties.y;
               }
            }
            return updatedNode;
          }
          return n;
        }));
      }

      if (nodeResize) {
        let dx = (e.clientX - nodeResize.startX) / camera.scale;
        let dy = (e.clientY - nodeResize.startY) / camera.scale;
        
        setNodes(prev => prev.map(n => {
          if (n.id === nodeResize.id) {
            return {
              ...n,
              properties: {
                ...n.properties,
                width: Math.max(10, nodeResize.initialW + dx),
                height: Math.max(10, nodeResize.initialH + dy)
              }
            };
          }
          return n;
        }));
      }
    };

    const handleGlobalMouseUp = () => {
      setCameraDrag(null);
      setNodeDrag(null);
      setNodeResize(null);
    };

    if (cameraDrag || nodeDrag || nodeResize) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [cameraDrag, nodeDrag, nodeResize]);

  const addEntity = (entityType: string, is3D: boolean = false) => {
    let color = '#3b82f6';
    let text = '';
    if (entityType.includes('Lava')) color = '#ef4444';
    if (entityType.includes('Ground')) color = '#22c55e';
    if (entityType.includes('Text')) text = 'Hello Text';
    if (entityType.includes('Button')) text = 'Button';
    if (entityType.includes('UI Frame')) text = 'UI Element';

    const isLogic = entityType === 'Script' || entityType === 'Variable';
    const newNode: SceneNode = {
      id: Math.random().toString(36).substr(2, 9),
      name: `${entityType}_${nodes.length + 1}`,
      type: entityType,
      parentId: isLogic ? (entityType === 'Script' ? 'Scripts' : 'Variables') : 'Project',
      properties: {
        x: 0, y: 0, 
        ...(is3D ? { z: 25, zDepth: 50, rotX: 0, rotY: 0, rotZ: 0 } : {}),
        width: entityType === 'Ground' ? 1000 : (entityType.includes('Text') ? 200 : 100), 
        height: entityType === 'Ground' ? 1000 : (entityType.includes('Text') ? 50 : 100),
        color: color,
        text: text,
        ...(entityType === 'Effect' ? { effectType: 'fire' } : {}),
        ...(entityType === 'Script' ? { scriptContent: '' } : {}),
        ...(entityType === 'Camera' ? { fov: 60, cameraName: 'Main Camera' } : {})
      }
    };
    setNodes([...nodes, newNode]);
    setSelectedNodeId(newNode.id);
  };

  const updateNodeProperty = (id: string, key: string, value: any) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, properties: { ...n.properties, [key]: value } } : n));
  };

  const deleteNode = (id: string) => {
    setNodes(nodes.filter(n => n.id !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const duplicateNode = (id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    const newNode = { ...node, id: Math.random().toString(36).substr(2, 9), name: `${node.name}_copy` };
    setNodes([...nodes, newNode]);
  };

  const toggleFolder = (id: string) => {
    const next = new Set(expandedFolders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedFolders(next);
  };

  const moveNode = (nodeId: string, targetFolderId: string) => {
    setNodes(nodes.map(n => n.id === nodeId ? { ...n, parentId: targetFolderId } : n));
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  const syncToCode = (showAlert = true) => {
    const currentNodes = nodesRef.current;
    const currentCamera = cameraRef.current;
    
    let visualData = '\n// --- VISUAL_SCENE_START ---\n';
    visualData += `// mode=${type}\n`;
    visualData += `// camera=${JSON.stringify(currentCamera)}\n`;

    currentNodes.filter(n => n.type === 'Variable').forEach(n => {
      visualData += `variable {name=${n.name}, value=${n.properties.value || ''}}\n`;
    });
    currentNodes.filter(n => n.type !== 'Script' && n.type !== 'Variable').forEach(n => {
      let typeK = 'block';
      if (n.type === 'Text') typeK = 'text_label';
      if (n.type === 'Player') typeK = 'player';
      if (n.type === 'Button') typeK = 'button';
      if (n.type === 'TextBox') typeK = 'textbox';
      if (n.type === 'Camera') typeK = '3DCamera';
      if (n.type === 'Particle' || n.type === 'Effect') typeK = 'particle';
      if (n.type === 'Lava') typeK = 'lava';
      if (n.type === 'Ground') typeK = 'ground';

      const props = Object.entries(n.properties)
        .filter(([k,v]) => k !== 'scriptContent' && v !== undefined && v !== '')
        .map(([k,v]) => `${k}=${v}`)
        .join(', ');
      visualData += `${typeK} {name=${n.name}${props ? ', ' + props : ''}}\n`;
    });
    currentNodes.filter(n => n.type === 'Script').forEach(n => {
      visualData += `\n// --- Script: ${n.name} ---\n`;
      visualData += n.properties.scriptContent + '\n';
    });
    visualData += '// --- VISUAL_SCENE_END ---\n';

    let newCode = code;
    const markerStart = '// --- VISUAL_SCENE_START ---';
    const markerEnd = '// --- VISUAL_SCENE_END ---';
    const startIdx = code.indexOf(markerStart);
    const endIdx = code.indexOf(markerEnd);

    if (startIdx !== -1 && endIdx !== -1) {
      newCode = code.substring(0, startIdx) + visualData + code.substring(endIdx + markerEnd.length);
    } else {
      newCode = code + visualData;
    }

    onChange(newCode);
    if (showAlert) alert("Visual scene successfully synced to code!");
  };

  syncToCodeRef.current = syncToCode;

  const handleExplorerClick = (node: SceneNode) => {
    setSelectedNodeId(node.id);
    if (node.type === 'Script') {
      const content = node.properties.scriptContent || '';
      setEditingScript({ id: node.id, name: node.name, content });
      setScriptHistory([content]);
      setScriptHistoryIndex(0);
    }
  };

  // Toolbox rendering helper
  const getIconForType = (nodeType: string) => {
    if (nodeType.includes('Text')) return <Type className="w-4 h-4 text-emerald-400" />;
    if (nodeType.includes('Button')) return <MousePointerClick className="w-4 h-4 text-purple-400" />;
    if (nodeType.includes('Lava')) return <Droplet className="w-4 h-4 text-orange-500" />;
    if (nodeType.includes('Player')) return <User className="w-4 h-4 text-sky-400" />;
    if (nodeType.includes('Particle')) return <Asterisk className="w-4 h-4 text-yellow-500" />;
    if (nodeType.includes('Weather')) return <CloudLightning className="w-4 h-4 text-slate-300" />;
    if (nodeType === 'Camera') return <Video className="w-4 h-4 text-rose-400" />;
    if (nodeType === 'Variable') return <Box className="w-4 h-4 text-amber-400" />;
    return <Box className="w-4 h-4 text-blue-400" />;
  };

  const handleViewportMouseDown = (e: React.MouseEvent) => {
    if (e.target === viewRef.current || (e.target as HTMLElement).id === 'viewport-bg') {
      setSelectedNodeId(null);
      if (type === '3D') {
        if (e.button === 0) setCameraDrag({ isPan: false, startX: e.clientX, startY: e.clientY, initialCam: { ...camera } });
        if (e.button === 2) setCameraDrag({ isPan: true, startX: e.clientX, startY: e.clientY, initialCam: { ...camera } });
      } else {
        setCameraDrag({ isPan: true, startX: e.clientX, startY: e.clientY, initialCam: { ...camera } });
      }
    }
  };

  return (
    <div className={clsx(
      "flex-1 flex flex-col md:flex-row w-full h-full text-white overflow-hidden text-sm relative",
      isFrutigerAero ? "bg-white/20 backdrop-blur-md" :
      theme === 'gradient' ? "bg-transparent" : "bg-zinc-950"
    )}>
      {/* Mobile Top Bar */}
      <div className={clsx(
        "md:hidden flex items-center justify-between p-2 border-b z-30 shrink-0",
        isFrutigerAero ? "border-white/30 bg-white/40 backdrop-blur-md text-blue-900" :
        theme === 'gradient' ? "border-emerald-500/20 bg-black/40 backdrop-blur-xl" : "bg-zinc-900 border-zinc-800"
      )}>
        <button className={clsx("p-2 rounded", isFrutigerAero ? "hover:bg-white/50" : "hover:bg-zinc-800")} onClick={() => setMobilePanel(p => p === 'toolbox' ? 'none' : 'toolbox')}>
          {mobilePanel === 'toolbox' ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <span className="font-bold text-sm">{type} Workspace</span>
        <button className={clsx("p-2 rounded", isFrutigerAero ? "hover:bg-white/50" : "hover:bg-zinc-800")} onClick={() => setMobilePanel(p => p === 'explorer' ? 'none' : 'explorer')}>
          {mobilePanel === 'explorer' ? <X className="w-5 h-5" /> : <Folder className="w-5 h-5 text-yellow-500" />}
        </button>
      </div>

      {/* Toolbox Left */}
      <div className={clsx(
        "w-64 border-r flex flex-col shrink-0 absolute md:relative z-20 h-full transition-transform left-0",
        mobilePanel === 'toolbox' ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        isFrutigerAero ? "border-white/30 bg-white/40 backdrop-blur-md" : 
        theme === 'gradient' ? "border-emerald-500/20 bg-black/40 backdrop-blur-xl" : "border-zinc-800 bg-zinc-900"
      )}>
        <div className="p-3 font-bold border-b border-zinc-800 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Box className="w-5 h-5 text-blue-400" /> Toolbox
          </div>
          <div className="space-y-2">
            <input 
              type="text" 
              placeholder="Search objects..." 
              value={toolboxSearch}
              onChange={(e) => setToolboxSearch(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide no-scrollbar">
              {['all', '3d', 'ui', 'logic'].map(f => (
                <button
                  key={f}
                  onClick={() => setToolboxFilter(f as any)}
                  className={clsx(
                    "px-2 py-0.5 rounded text-[10px] uppercase font-bold transition-colors shrink-0",
                    toolboxFilter === f ? "bg-emerald-500 text-white" : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          <div>
            <div className="text-[10px] font-bold text-zinc-500 uppercase mb-2 px-2">Objects</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Block', tags: ['3d', '2d'] },
                { name: 'Player', tags: ['3d', '2d'] },
                { name: 'Text', tags: ['ui', '3d', '2d'] },
                { name: 'Button', tags: ['ui'] },
                { name: 'TextBox', tags: ['ui'] },
                { name: 'Lava', tags: ['3d', '2d'] },
                { name: 'Ground', tags: ['3d', '2d'] },
                { name: 'Particle', tags: ['3d', '2d', 'vfx'] },
                { name: 'Effect', tags: ['3d', '2d', 'vfx'] },
                { name: 'UI Frame', tags: ['ui'] },
                { name: 'Script', tags: ['logic'] },
                { name: 'Variable', tags: ['logic'] },
                { name: 'Camera', tags: ['logic', '3d'] }
              ]
              .filter(item => {
                const matchesSearch = item.name.toLowerCase().includes(toolboxSearch.toLowerCase());
                const matchesFilter = toolboxFilter === 'all' || item.tags.includes(toolboxFilter);
                return matchesSearch && matchesFilter;
              })
              .map(item => (
                <button
                  key={item.name}
                  draggable
                  onDragStart={(e) => {
                     e.dataTransfer.setData('newEntityType', item.name);
                     e.dataTransfer.setData('is3D', (item.tags.includes('3d') && type === '3D').toString());
                  }}
                  onClick={() => addEntity(item.name, item.tags.includes('3d') && type === '3D')}
                  className="bg-zinc-800/50 hover:bg-zinc-700 border border-zinc-700/50 rounded p-2 text-xs text-center transition-colors flex flex-col items-center gap-1"
                >
                  {getIconForType(item.name)}
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col relative min-w-0"
        onDragOver={(e) => e.preventDefault()}
      >
        <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-4">
            <span className="font-bold text-zinc-300">{type} Workspace</span>
            <span className="text-[10px] text-zinc-500 hidden xl:inline">Movement: Left/Right Click Drag. Shift/Scroll for Zoom.</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => syncToCode()}
              className="px-3 py-1.5 rounded flex items-center gap-2 font-bold text-sm transition-colors bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
              title="Generate Code from Object Placement"
            >
              <Save className="w-4 h-4" /> Sync to Code
            </button>
            <button 
              onClick={() => {
              if (isPlaying) {
                 setIsPlaying(false);
                 if (interpreter) interpreter.stop();
                 setInterpreter(null);
                 if (initialNodesState) setNodes(initialNodesState);
                 if (initialEditorCam) setCamera(initialEditorCam);
              } else {
                 syncToCode(false);
                 setIsPlaying(true);
                 setInitialNodesState(JSON.parse(JSON.stringify(nodes)));
                 setInitialEditorCam({ ...camera });
                 
                 const sceneCamera = nodes.find(n => n.type === 'Camera');
                 if (sceneCamera) {
                    setCamera({
                       x: -(sceneCamera.properties.x || 0),
                       y: -(sceneCamera.properties.y || 0),
                       z: -(sceneCamera.properties.z || 0),
                       rotX: type === '3D' ? 60 + (sceneCamera.properties.rotX || 0) : 0,
                       rotY: -(sceneCamera.properties.rotY || 0),
                       scale: 1, // Reset scale for preview
                    });
                 }
                 // Start Scripts
                 const scripts = nodes
                   .filter(n => n.type === 'Script')
                   .map(n => n.properties.scriptContent)
                   .join('\n');
                 
                 if (scripts.trim()) {
                   const newInterpreter = new EPLInterpreter(
                     (msg) => console.log('Preview SC:', msg),
                     (updatedEntities) => {
                       setNodes(prev => prev.map(node => {
                         const updated = Object.values(updatedEntities).find(e => e.name === node.name);
                         if (updated) {
                           return {
                             ...node,
                             properties: {
                               ...node.properties,
                               ...updated,
                               id: node.id // Safety
                             }
                           };
                         }
                         return node;
                       }));
                     },
                     { answerMode: 'console', changesEnabled: true }
                   );
                   
                   const entities = nodes.reduce((acc, n) => {
                     acc[n.name] = { id: n.id, type: n.type, name: n.name, ...n.properties };
                     return acc;
                   }, {} as any);
                   
                   newInterpreter.context.entities = entities;
                   newInterpreter.context.isRunning = true;
                   newInterpreter.run(scripts);
                   setInterpreter(newInterpreter);
                 }

                 setTimeout(() => viewRef.current?.focus(), 10);
              }
            }}
            className={clsx(
              "px-4 py-1.5 rounded flex items-center gap-2 font-bold text-sm transition-colors",
              isPlaying ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
            )}
          >
            {isPlaying ? <StopCircle className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlaying ? "Stop" : "Play"}
          </button>
          </div>
        </div>
        
        <div 
          ref={viewRef}
          onMouseDown={handleViewportMouseDown}
          onContextMenu={(e) => e.preventDefault()}
          onDragOver={(e) => {
             if (e.dataTransfer.types.includes('newEntityType')) {
                e.preventDefault();
             }
          }}
          onDrop={(e) => {
             e.preventDefault();
             const entityType = e.dataTransfer.getData('newEntityType');
             const is3D = e.dataTransfer.getData('is3D') === 'true';
             if (entityType) {
                 // Calculate drop location relative to camera
                 if (viewRef.current) {
                    const rect = viewRef.current.getBoundingClientRect();
                    const dropX = e.clientX - rect.left;
                    const dropY = e.clientY - rect.top;
                    
                    const centerX = rect.width / 2;
                    const centerY = rect.height / 2;
                    
                    // Simple conversion (ignoring rotation for simplicity)
                    const x = (dropX - centerX) / camera.scale - camera.x;
                    const y = (dropY - centerY) / camera.scale - camera.y;

                    // Add entity logic directly without separate coordinates for now
                    addEntity(entityType, is3D);
                    // Modify the last added entity's position
                    setTimeout(() => {
                        setNodes(prev => {
                           if (prev.length === 0) return prev;
                           const latest = prev[prev.length - 1];
                           return prev.map(n => n.id === latest.id ? { ...n, properties: { ...n.properties, x, y } } : n);
                        });
                    }, 0);
                 }
             }
          }}
          className="flex-1 relative overflow-hidden outline-none select-none overflow-clip cursor-crosshair"
          tabIndex={0}
          onWheel={(e) => {
            if (e.ctrlKey || e.shiftKey) {
              e.preventDefault();
              setCamera(prev => ({...prev, scale: Math.max(0.1, prev.scale - e.deltaY * 0.005)}));
            }
          }}
        >
          <div 
            id="viewport-bg"
            className="absolute inset-0 z-0" 
            style={{ 
              backgroundColor: workspaceSettings.backgroundColor,
              backgroundImage: workspaceSettings.backgroundImage ? `url(${workspaceSettings.backgroundImage})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }} 
          />

          {/* Debug Camera info overlay */}
          <div className="absolute top-2 left-2 text-[10px] text-zinc-500/80 font-mono pointer-events-none z-50 mix-blend-difference selection-none">
            Cam: X:{camera.x.toFixed(0)} Y:{camera.y.toFixed(0)} Z:{camera.z.toFixed(0)} R:{camera.rotX.toFixed(0)}° Zm:{camera.scale.toFixed(1)}x
          </div>

          <div 
            className="absolute top-1/2 left-1/2 z-10 pointer-events-none"
            style={{ 
              transform: type === '3D' 
                 ? `translate(-50%, -50%) scale(${camera.scale}) perspective(1000px) rotateX(${camera.rotX}deg) rotateZ(${camera.rotY}deg) translate3d(${camera.x}px, ${camera.y}px, ${camera.z}px)` 
                 : `translate(-50%, -50%) scale(${camera.scale}) translate3d(${camera.x}px, ${camera.y}px, 0)`,
              transformStyle: type === '3D' ? 'preserve-3d' : 'flat'
            }}
          >
            {/* Grid graphic */}
            {!isPlaying && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[2000px] h-[2000px] border border-zinc-800/20 pointer-events-none"
                   style={{ 
                      backgroundImage: type === '3D' ? 'linear-gradient(#4b5563 2px, transparent 2px), linear-gradient(90deg, #4b5563 2px, transparent 2px)' : 'linear-gradient(#9ca3af 1px, transparent 1px), linear-gradient(90deg, #9ca3af 1px, transparent 1px)', 
                      backgroundSize: type === '3D' ? '100px 100px' : '40px 40px',
                      opacity: type === '3D' ? 0.5 : 0.3,
                   }} />
            )}
            
            {/* Render Nodes */}
            {nodes.filter(n => n.parentId !== 'Storage' && n.type !== 'Script' && n.type !== 'Variable').map(node => {
              const isSelected = selectedNodeId === node.id;
              const is3DStyle = type === '3D';
              
              return (
                <div 
                  key={node.id}
                  onMouseDown={(e) => { 
                    e.stopPropagation(); 
                    if (isPlayingRef.current) {
                      if (interpreterRef.current) {
                        interpreterRef.current.triggerEvent('clicked?', node.name);
                      }
                      return;
                    }
                    setSelectedNodeId(node.id); 
                    setNodeDrag({ id: node.id, startX: e.clientX, startY: e.clientY, initialX: node.properties.x || 0, initialY: node.properties.y || 0 });
                  }}
                  className={clsx(
                    "absolute transition-shadow pointer-events-auto",
                    (isSelected && !isPlaying) ? "ring-2 ring-emerald-500 z-20" : "hover:ring-1 hover:ring-zinc-400/50 z-10",
                    node.type.includes('Text') && !node.properties.backgroundColor && "bg-transparent ring-0"
                  )}
                  style={{
                    left: '50%',
                    top: '50%',
                    marginLeft: - (node.properties.width || 50) / 2,
                    marginTop: - (node.properties.height || 50) / 2,
                    transform: `translate3d(${node.properties.x || 0}px, ${node.properties.y || 0}px, ${type === '3D' ? node.properties.z || 25 : 0}px) rotateX(${node.properties.rotX || 0}deg) rotateY(${node.properties.rotY || 0}deg) rotateZ(${node.properties.rotZ || 0}deg)`,
                    width: node.properties.width || 50,
                    height: node.properties.height || 50,
                    transformStyle: is3DStyle ? 'preserve-3d' : 'flat'
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center bg-transparent overflow-visible" style={{ transformStyle: is3DStyle ? 'preserve-3d' : 'flat' }}>
                    {/* Visual representation based on type */}
                    {node.type === 'Player' ? (
                      <div className="relative w-full h-full" style={{ transformStyle: is3DStyle ? 'preserve-3d' : 'flat' }}>
                         <User className={clsx("absolute inset-0 w-full h-full", is3DStyle ? "text-sky-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]" : "text-sky-400")} />
                         {is3DStyle && (
                           <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
                             {/* Small volume for player */}
                             <div className="absolute h-full w-[20px] bg-sky-600/30" style={{ right: -10, transformOrigin: 'left', transform: 'rotateY(90deg)' }} />
                             <div className="absolute h-[2px] w-full bg-sky-300/50 shadow-[0_0_10px_white]" style={{ bottom: 0, transform: 'rotateX(90deg)' }} />
                           </div>
                         )}
                      </div>
                    ) : node.type === 'Lava' ? (
                      <div className="relative w-full h-full" style={{ transformStyle: is3DStyle ? 'preserve-3d' : 'flat' }}>
                        <div className="absolute inset-0 bg-red-600 animate-pulse border-2 border-orange-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]" />
                        {is3DStyle && (
                           <>
                             {/* Right Face */}
                             <div className="absolute inset-y-0 h-full w-[20px] bg-red-900 border-l border-orange-500/50" style={{ left: '100%', transformOrigin: 'left', transform: 'rotateY(90deg)', width: node.properties.zDepth || 20 }} />
                             {/* Bottom Face */}
                             <div className="absolute inset-x-0 w-full h-[20px] bg-orange-900 border-t border-orange-500/50" style={{ top: '100%', transformOrigin: 'top', transform: 'rotateX(-90deg)', height: node.properties.zDepth || 20 }} />
                             {/* Left Face */}
                             <div className="absolute inset-y-0 h-full w-[20px] bg-red-900 border-r border-orange-500/50" style={{ right: '100%', transformOrigin: 'right', transform: 'rotateY(-90deg)', width: node.properties.zDepth || 20 }} />
                             {/* Top Face */}
                             <div className="absolute inset-x-0 w-full h-[20px] bg-orange-800 border-b border-orange-500/50" style={{ bottom: '100%', transformOrigin: 'bottom', transform: 'rotateX(90deg)', height: node.properties.zDepth || 20 }} />
                           </>
                        )}
                      </div>
                    ) : node.type === 'Ground' ? (
                      <div className="relative w-full h-full" style={{ transformStyle: is3DStyle ? 'preserve-3d' : 'flat' }}>
                        <div className="absolute inset-0 bg-emerald-600 border border-emerald-500/30" />
                        {is3DStyle && (
                           <>
                             {/* Right Face */}
                             <div className="absolute inset-y-0 h-full bg-emerald-900" style={{ left: '100%', transformOrigin: 'left', transform: 'rotateY(90deg)', width: node.properties.zDepth || 50 }} />
                             {/* Bottom Face */}
                             <div className="absolute inset-x-0 w-full bg-emerald-950" style={{ top: '100%', transformOrigin: 'top', transform: 'rotateX(-90deg)', height: node.properties.zDepth || 50 }} />
                             {/* Left Face */}
                             <div className="absolute inset-y-0 h-full bg-emerald-900" style={{ right: '100%', transformOrigin: 'right', transform: 'rotateY(-90deg)', width: node.properties.zDepth || 50 }} />
                             {/* Top Face */}
                             <div className="absolute inset-x-0 w-full bg-emerald-800" style={{ bottom: '100%', transformOrigin: 'bottom', transform: 'rotateX(90deg)', height: node.properties.zDepth || 50 }} />
                           </>
                        )}
                      </div>
                    ) : node.type === 'Button' ? (
                      <button className="w-full h-full bg-purple-600 hover:bg-purple-500 text-white rounded shadow-lg border-b-4 border-purple-800 active:translate-y-1 active:border-b-0 transition-all font-bold text-[10px]">
                        {node.properties.text}
                      </button>
                    ) : node.type === 'TextBox' ? (
                      <div className="w-full h-full bg-white text-black p-2 rounded border-2 border-zinc-300 text-xs shadow-inner flex items-start justify-start overflow-hidden whitespace-pre-wrap">
                        {node.properties.text || 'Enter text...'}
                      </div>
                    ) : node.type === 'UI Frame' ? (
                      <div className="w-full h-full border-2 border-blue-500 bg-blue-500/10 rounded-lg shadow-sm flex flex-col pointer-events-auto overflow-hidden">
                         <div className="w-full h-6 bg-blue-500/20 border-b border-blue-500/30 flex items-center px-2 text-[10px] text-blue-200 font-bold">
                            UI Element
                         </div>
                         <div className="flex-1 p-2 flex items-center justify-center text-blue-300/50 text-xs">
                            {node.properties.text || 'Container'}
                         </div>
                      </div>
                    ) : node.type === 'Effect' ? (
                      <div className="relative w-full h-full flex items-center justify-center overflow-visible pointer-events-none" style={{ transformStyle: is3DStyle ? 'preserve-3d' : 'flat' }}>
                         <div className={clsx(
                           "absolute animate-pulse blur-[10px] rounded-full",
                           node.properties.effectType === 'water' ? "bg-blue-500/60" : "bg-orange-500/60"
                         )} style={{ width: '150%', height: '150%' }} />
                         <div className={clsx(
                           "relative font-bold drop-shadow-lg text-4xl animate-bounce",
                         )}>{node.properties.effectType === 'water' ? '💧' : '🔥'}</div>
                      </div>
                    ) : node.type.includes('Text') ? (
                      <span className="text-xl font-bold drop-shadow-lg text-white" style={{ color: node.properties.color || '#ffffff' }}>
                         {node.properties.text || node.name}
                      </span>
                    ) : node.type === 'Camera' ? (
                      !isPlaying && (
                      <div className="relative w-full h-full flex items-center justify-center text-white/50" style={{ transformStyle: is3DStyle ? 'preserve-3d' : 'flat' }}>
                        <div className="bg-rose-500/10 p-2 rounded border border-rose-500/30">
                          <Video className="w-6 h-6 text-rose-400 drop-shadow-[0_0_5px_rgba(244,63,94,0.8)]" />
                        </div>
                        {is3DStyle && (
                           <>
                             {/* Camera Frustum Lines */}
                             <div className="absolute w-[200px] border border-rose-500/20" style={{ left: '50%', top: '50%', transformOrigin: 'top left', transform: `translate3d(0, 0, ${(node.properties.zDepth || 50)/2}px) rotateX(15deg) rotateY(15deg)` }} />
                             <div className="absolute w-[200px] border border-rose-500/20" style={{ left: '50%', top: '50%', transformOrigin: 'top right', transform: `translate3d(0, 0, ${(node.properties.zDepth || 50)/2}px) rotateX(15deg) rotateY(-15deg)` }} />
                             <div className="absolute inset-x-0 w-full h-full border-4 border-rose-500/10" style={{ transform: `translateZ(${node.properties.zDepth || 50}px) scale(2)` }} />
                           </>
                        )}
                        <div className="absolute bottom-full mb-1 text-[8px] bg-rose-500/20 text-rose-300 px-1 rounded whitespace-nowrap font-mono">
                           Len: {node.properties.zDepth || 50} | W: {node.properties.width || 50} | H: {node.properties.height || 50}
                        </div>
                      </div>
                      )
                    ) : (
                      // Generic Block / 3D Cube
                      <div className="relative w-full h-full" style={{ transformStyle: is3DStyle ? 'preserve-3d' : 'flat' }}>
                        <div className="absolute inset-0 border border-white/10" style={{ backgroundColor: node.properties.color || '#3b82f6' }} />
                        {is3DStyle && (
                          <>
                            {/* Right Face */}
                            <div className="absolute inset-y-0 h-full bg-black/20 border-l border-white/5" 
                                 style={{ left: '100%', transformOrigin: 'left', transform: 'rotateY(90deg)', width: node.properties.zDepth || 50, backgroundColor: node.properties.color || '#3b82f6', filter: 'brightness(0.7)' }} />
                            {/* Bottom Face */}
                            <div className="absolute inset-x-0 w-full bg-black/40 border-t border-white/5" 
                                 style={{ top: '100%', transformOrigin: 'top', transform: 'rotateX(-90deg)', height: node.properties.zDepth || 50, backgroundColor: node.properties.color || '#3b82f6', filter: 'brightness(0.5)' }} />
                            {/* Left Face */}
                            <div className="absolute inset-y-0 h-full bg-black/20" 
                                 style={{ right: '100%', transformOrigin: 'right', transform: 'rotateY(-90deg)', width: node.properties.zDepth || 50, backgroundColor: node.properties.color || '#3b82f6', filter: 'brightness(0.7)' }} />
                            {/* Top Face */}
                            <div className="absolute inset-x-0 w-full bg-black/10" 
                                 style={{ bottom: '100%', transformOrigin: 'bottom', transform: 'rotateX(90deg)', height: node.properties.zDepth || 50, backgroundColor: node.properties.color || '#3b82f6', filter: 'brightness(1.1)' }} />
                          </>
                        )}
                        {!is3DStyle && <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/50 font-bold">{node.name}</div>}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      {/* Script Editor Overlay */}
      {editingScript && (
        <div className={clsx(
          "absolute inset-0 z-[100] flex flex-col",
          theme === 'gradient' ? "bg-slate-950/80 backdrop-blur-2xl" : "bg-zinc-950"
        )}>
          <div className={clsx(
            "h-14 border-b flex items-center justify-between px-6 shadow-xl",
            theme === 'gradient' ? "bg-black/40 border-emerald-500/20" : "bg-zinc-900 border-zinc-800"
          )}>
            <div className="flex items-center gap-3">
              <Asterisk className="w-5 h-5 text-emerald-500" />
              <div>
                <h2 className="font-bold text-white leading-none">{editingScript.name}</h2>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Script Editor</p>
              </div>
              <div className="h-6 w-px bg-zinc-700/50 mx-2"></div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={undoScript}
                  disabled={scriptHistoryIndex <= 0}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={redoScript}
                  disabled={scriptHistoryIndex >= scriptHistory.length - 1}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Redo (Ctrl+Shift+Z)"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <button 
              onClick={() => {
                updateNodeProperty(editingScript.id, 'scriptContent', editingScript.content);
                setEditingScript(null);
              }}
              className="p-2 hover:bg-white/10 rounded-full transition-colors group"
            >
              <X className="w-6 h-6 text-zinc-400 group-hover:text-white" />
            </button>
          </div>
          <div className={clsx(
            "flex-1 relative overflow-auto",
            theme === 'gradient' ? "bg-transparent" : "bg-zinc-950"
          )}>
            <VisualEditor 
              code={editingScript.content} 
              onChange={handleScriptChange}
              entities={nodes.reduce((acc, n) => ({ ...acc, [n.id]: n }), {})}
            />
          </div>
          <div className={clsx(
            "p-3 border-t flex justify-between items-center px-6",
            theme === 'gradient' ? "bg-black/40 border-emerald-500/20" : "bg-zinc-900 border-zinc-800"
          )}>
             <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
               Lines: {editingScript.content.split('\n').length} | Characters: {editingScript.content.length}
             </div>
             <button 
               onClick={() => {
                 updateNodeProperty(editingScript.id, 'scriptContent', editingScript.content);
                 setEditingScript(null);
               }}
               className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
             >
               <Save className="w-4 h-4" /> SAVE & CLOSE
             </button>
          </div>
        </div>
      )}
      </div>

      {/* Explorer Right */}
      <div className={clsx(
        "w-72 border-l flex flex-col shrink-0 absolute md:relative z-20 h-full transition-transform right-0",
        mobilePanel === 'explorer' ? "translate-x-0" : "translate-x-full md:translate-x-0",
        isFrutigerAero ? "border-white/30 bg-white/40 backdrop-blur-md" : 
        theme === 'gradient' ? "border-emerald-500/20 bg-black/40 backdrop-blur-xl" : "border-zinc-800 bg-zinc-900"
      )}>
        <div className="h-1/2 flex flex-col border-b border-zinc-800">
          <div className="p-3 font-bold border-b border-zinc-800 flex items-center justify-between relative">
            <span className="flex items-center gap-2"><Folder className="w-4 h-4 text-yellow-500" /> Explorer</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 text-sm select-none">
            {defaultFolders.filter(f => !(f as any).parent).map(folder => (
              <div key={folder.id}>
                <div 
                  className="flex items-center gap-1 p-1 hover:bg-zinc-800/50 rounded cursor-pointer text-zinc-300"
                  onClick={() => toggleFolder(folder.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const nodeId = e.dataTransfer.getData('nodeId');
                    if (nodeId) moveNode(nodeId, folder.id);
                  }}
                >
                  {expandedFolders.has(folder.id) ? <ChevronDown className="w-3 h-3 text-zinc-500" /> : <ChevronRight className="w-3 h-3 text-zinc-500" />}
                  <Folder className="w-4 h-4 text-yellow-500/80" /> {folder.name}
                </div>
                {expandedFolders.has(folder.id) && (
                  <div className="ml-4 pl-2 border-l border-zinc-800/50 mt-1 space-y-0.5">
                    
                    {/* Items in this folder */}
                    {nodes.filter(n => n.parentId === folder.id).map(node => (
                      <div key={node.id} 
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('nodeId', node.id)}
                        onClick={() => handleExplorerClick(node)}
                        className={clsx(
                          "flex items-center justify-between p-1 rounded cursor-pointer group text-xs",
                          selectedNodeId === node.id ? "bg-emerald-500/20 text-emerald-400" : "hover:bg-zinc-800/80 text-zinc-400"
                        )}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          {getIconForType(node.type)} <span className="truncate">{node.name}</span>
                        </div>
                        <div className="hidden group-hover:flex items-center gap-1 shrink-0 px-1 text-zinc-500">
                          <button onClick={(e) => { e.stopPropagation(); duplicateNode(node.id); }} className="hover:text-white p-0.5"><Copy className="w-3 h-3" /></button>
                          <button onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }} className="hover:text-red-400 p-0.5"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div className={clsx(
          "h-1/2 flex flex-col border-t",
          theme === 'gradient' ? "bg-black/20 border-emerald-500/20 backdrop-blur-md" : "bg-zinc-950/50 border-zinc-800"
        )}>
          <div className="p-3 font-bold border-b border-zinc-800 flex items-center gap-2 text-zinc-300">
            <Settings className="w-4 h-4 text-emerald-500" /> {selectedNode ? 'Object Settings' : 'Workspace Settings'}
          </div>
          <div className="flex-1 overflow-y-auto p-4 text-sm">
            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">Name</label>
                  <input 
                    type="text" 
                    value={selectedNode.name}
                    onChange={(e) => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, name: e.target.value } : n))}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">Type</label>
                  <div className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded px-2 py-1.5 text-zinc-400 select-none">
                    {selectedNode.type}
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800">
                  <div className="text-xs font-bold text-zinc-500 mb-2">Transform</div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="flex flex-col">
                      <label className="text-[9px] text-zinc-500 font-bold uppercase">Pos X</label>
                      <input type="number" value={selectedNode.properties.x || 0} onChange={(e) => updateNodeProperty(selectedNode.id, 'x', Number(e.target.value))} className="w-full bg-zinc-900 border border-zinc-700/50 rounded px-1.5 py-1 text-white text-xs focus:border-emerald-500" />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[9px] text-zinc-500 font-bold uppercase">Pos Y (Depth)</label>
                      <input type="number" value={selectedNode.properties.y || 0} onChange={(e) => updateNodeProperty(selectedNode.id, 'y', Number(e.target.value))} className="w-full bg-zinc-900 border border-zinc-700/50 rounded px-1.5 py-1 text-white text-xs focus:border-emerald-500" />
                    </div>
                    {type === '3D' && (
                      <div className="flex flex-col">
                        <label className="text-[9px] text-emerald-500 font-bold uppercase">Pos Z (Height)</label>
                        <input type="number" value={selectedNode.properties.z || 0} onChange={(e) => updateNodeProperty(selectedNode.id, 'z', Number(e.target.value))} className="w-full bg-zinc-900 border border-zinc-700/50 rounded px-1.5 py-1 text-white text-xs focus:border-emerald-500" />
                      </div>
                    )}

                    <div className="flex flex-col">
                      <label className="text-[9px] text-zinc-500 font-bold uppercase">Size X</label>
                      <input type="number" value={selectedNode.properties.width || 50} onChange={(e) => updateNodeProperty(selectedNode.id, 'width', Number(e.target.value))} className="w-full bg-zinc-900 border border-zinc-700/50 rounded px-1.5 py-1 text-white text-xs focus:border-emerald-500" />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[9px] text-zinc-500 font-bold uppercase">Size Y (Depth)</label>
                      <input type="number" value={selectedNode.properties.height || 50} onChange={(e) => updateNodeProperty(selectedNode.id, 'height', Number(e.target.value))} className="w-full bg-zinc-900 border border-zinc-700/50 rounded px-1.5 py-1 text-white text-xs focus:border-emerald-500" />
                    </div>
                    {type === '3D' && (
                      <div className="flex flex-col">
                        <label className="text-[9px] text-emerald-500 font-bold uppercase">Size Z (Height)</label>
                        <input type="number" value={selectedNode.properties.zDepth || 50} onChange={(e) => updateNodeProperty(selectedNode.id, 'zDepth', Number(e.target.value))} className="w-full bg-zinc-900 border border-zinc-700/50 rounded px-1.5 py-1 text-white text-xs focus:border-emerald-500" />
                      </div>
                    )}

                    {type === '3D' && (
                      <>
                        <div className="flex flex-col">
                          <label className="text-[9px] text-zinc-500 font-bold uppercase">Rot X</label>
                          <input type="number" value={selectedNode.properties.rotX || 0} onChange={(e) => updateNodeProperty(selectedNode.id, 'rotX', Number(e.target.value))} className="w-full bg-zinc-900 border border-zinc-700/50 rounded px-1.5 py-1 text-white text-xs focus:border-emerald-500" />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[9px] text-zinc-500 font-bold uppercase">Rot Y</label>
                          <input type="number" value={selectedNode.properties.rotY || 0} onChange={(e) => updateNodeProperty(selectedNode.id, 'rotY', Number(e.target.value))} className="w-full bg-zinc-900 border border-zinc-700/50 rounded px-1.5 py-1 text-white text-xs focus:border-emerald-500" />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[9px] text-zinc-500 font-bold uppercase">Rot Z</label>
                          <input type="number" value={selectedNode.properties.rotZ || 0} onChange={(e) => updateNodeProperty(selectedNode.id, 'rotZ', Number(e.target.value))} className="w-full bg-zinc-900 border border-zinc-700/50 rounded px-1.5 py-1 text-white text-xs focus:border-emerald-500" />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="text-xs font-bold text-zinc-500 mb-2">Properties</div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedNode.properties)
                      .filter(([key]) => !['x', 'y', 'z', 'width', 'height', 'zDepth', 'rotX', 'rotY', 'rotZ'].includes(key))
                      .map(([key, value]) => (
                      <div key={key} className="flex flex-col">
                        <label className="text-[10px] text-zinc-500 capitalize">{key}</label>
                        {key === 'color' || key === 'backgroundColor' || key === 'textColor' ? (
                          <input 
                            type="color" 
                            value={value}
                            onChange={(e) => updateNodeProperty(selectedNode.id, key, e.target.value)}
                            className="bg-zinc-900 border border-zinc-700/50 p-0 w-full h-8 cursor-pointer rounded"
                          />
                        ) : key === 'effectType' ? (
                           <select
                             value={value}
                             onChange={(e) => updateNodeProperty(selectedNode.id, key, e.target.value)}
                             className="bg-zinc-900 border border-zinc-700/50 rounded px-1.5 py-1 text-white text-xs focus:border-emerald-500 w-full"
                           >
                              <option value="fire">Fire</option>
                              <option value="water">Water</option>
                           </select>
                        ) : typeof value === 'number' ? (
                          <input 
                            type="number" 
                            value={value}
                            onChange={(e) => updateNodeProperty(selectedNode.id, key, Number(e.target.value))}
                            className="w-full bg-zinc-900 border border-zinc-700/50 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-emerald-500"
                          />
                        ) : (
                          <input 
                            type="text" 
                            value={value}
                            onChange={(e) => updateNodeProperty(selectedNode.id, key, e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700/50 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-emerald-500"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6">
                  <button 
                    onClick={() => deleteNode(selectedNode.id)}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 rounded-lg transition-all font-bold uppercase tracking-wider text-xs"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Object
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">Background Color</label>
                  <input 
                    type="color" 
                    value={workspaceSettings.backgroundColor}
                    onChange={(e) => setWorkspaceSettings(prev => ({...prev, backgroundColor: e.target.value}))}
                    className="bg-transparent border-0 p-0 w-full h-8 cursor-pointer rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">Background Image URL</label>
                  <input 
                    type="text" 
                    placeholder="https://..."
                    value={workspaceSettings.backgroundImage}
                    onChange={(e) => setWorkspaceSettings(prev => ({...prev, backgroundImage: e.target.value}))}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">Leave empty to use color.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
