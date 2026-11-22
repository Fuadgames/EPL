import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../store/useStore';
import {
  Plus, Trash2, GripVertical, Code2, ChevronRight, ChevronDown,
  Layers, Zap, Copy, Check, FolderInput, X, Cpu
} from 'lucide-react';
import { clsx } from 'clsx';
import DifrenoptConfigModal from './DifrenoptConfigModal';
import {
  extractDifrenoptBlock,
  isDifrenoptStartLine,
  serializeDifrenoptBlock,
  DRPL_TEMPLATES
} from '../lib/drpl-catalog';

export interface BlockItem {
  id: string;
  type: 'event' | 'action' | 'entity' | 'control';
  name: string;
  params: Record<string, string>;
  drplCode?: string;
  children?: BlockItem[];
  collapsed?: boolean;
}

interface BlockEditorProps {
  code: string;
  onChange: (newCode: string) => void;
}

interface PresetBlockDef {
  type: 'event' | 'action' | 'entity' | 'control';
  name: string;
  label: string;
  description: string;
  params: Record<string, string>;
  hasChildren?: boolean;
}

const PRESET_BLOCKS: PresetBlockDef[] = [
  // Events
  { type: 'event', name: 'started?', label: 'started?', description: 'При запуске приложения', params: {}, hasChildren: true },
  { type: 'event', name: 'clicked?', label: 'clicked?', description: 'При клике на объект', params: { target: 'button1' }, hasChildren: true },
  { type: 'event', name: 'key_pressed?', label: 'key_pressed?', description: 'При нажатии клавиши', params: { key: 'space' }, hasChildren: true },
  { type: 'event', name: 'collided?', label: 'collided?', description: 'При столкновении двух объектов', params: { targetA: 'player', targetB: 'enemy' }, hasChildren: true },
  { type: 'event', name: 'timer_tick?', label: 'timer_tick?', description: 'По таймеру', params: { name: 'timer1' }, hasChildren: true },

  // Actions
  { type: 'action', name: 'move', label: 'move', description: 'Переместить объект', params: { target: 'player', x: '+10', y: '0' } },
  { type: 'action', name: 'type', label: 'type', description: 'Вывести сообщение на экран', params: { text: 'Привет, мир!' } },
  { type: 'action', name: 'background', label: 'background', description: 'Изменить цвет фона', params: { color: '#09090b' } },
  { type: 'action', name: 'set up', label: 'set up', description: 'Изменить свойство объекта', params: { target: 'button1', property: 'color', value: '#10b981' } },
  { type: 'action', name: 'variable', label: 'variable', description: 'Установить переменную', params: { name: 'score', value: '0' } },
  { type: 'action', name: 'math', label: 'math', description: 'Математическая операция', params: { target: 'score', op: 'add', value: '1' } },
  { type: 'action', name: 'destroy', label: 'destroy', description: 'Удалить объект', params: { target: 'enemy' } },
  { type: 'action', name: 'play_sound', label: 'play_sound', description: 'Воспроизвести звук', params: { sound: 'click.mp3' } },

  // Entities
  { type: 'entity', name: 'button', label: 'create button', description: 'Создать кнопку', params: { name: 'myBtn', label: 'Старт', x: '100', y: '100', color: '#10b981' } },
  { type: 'entity', name: 'block', label: 'create block', description: 'Создать прямоугольный блок', params: { name: 'wall', x: '50', y: '200', width: '200', height: '30', color: '#27272a' } },
  { type: 'entity', name: 'text_label', label: 'create text_label', description: 'Создать текстовую надпись', params: { name: 'title', text: 'Игра начата!', x: '100', y: '50', color: '#ffffff' } },
  { type: 'entity', name: 'sprite', label: 'create sprite', description: 'Создать спрайт / персонаж', params: { name: 'hero', image: 'hero.png', x: '150', y: '150' } },
  { type: 'entity', name: 'player', label: 'create player', description: 'Создать управляемого игрока', params: { name: 'player1', speed: '5', health: '100', x: '100', y: '100' } },
  { type: 'entity', name: 'enemy', label: 'create enemy', description: 'Создать врага', params: { name: 'enemy1', damage: '10', x: '300', y: '100' } },
  { type: 'entity', name: 'difrenopt', label: 'difrenopt (DRPL)', description: '3D/2D/App оптимизатор рендера на языке DRPL', params: { name: 'engine', mode: '3d', quality: 'ultra', fps: '60', shadows: 'true', bloom: 'true', instancing: 'true', culling: 'true' } },

  // Control
  { type: 'control', name: 'if', label: 'if ... then', description: 'Условие если', params: { check: 'score >= 10' }, hasChildren: true },
  { type: 'control', name: 'repeat', label: 'repeat', description: 'Повторить N раз', params: { times: '5' }, hasChildren: true },
  { type: 'control', name: 'forever', label: 'forever', description: 'Бесконечный цикл', params: {}, hasChildren: true },
  { type: 'control', name: 'wait', label: 'wait', description: 'Пауза в секундах', params: { seconds: '1' } },
];

type DragPayload =
  | { source: 'palette'; presetIndex: number }
  | { source: 'workspace'; blockId: string };

type DropTarget =
  | { type: 'sibling'; blockId: string; parentId: string | null; placement: 'before' | 'after' }
  | { type: 'container'; parentId: string }
  | { type: 'root-end' }
  | null;

const createBlockId = () =>
  `block_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const createBlockFromPreset = (preset: PresetBlockDef): BlockItem => ({
  id: createBlockId(),
  type: preset.type,
  name: preset.name,
  params: { ...preset.params },
  ...(preset.name === 'difrenopt' ? { drplCode: DRPL_TEMPLATES[0].drplCode } : {}),
  ...(preset.hasChildren ? { children: [], collapsed: false } : {})
});

const containsBlockId = (items: BlockItem[], targetId: string): boolean => {
  for (const item of items) {
    if (item.id === targetId) return true;
    if (item.children && containsBlockId(item.children, targetId)) return true;
  }
  return false;
};

const isDescendantOrSelf = (items: BlockItem[], sourceId: string, targetId: string | null): boolean => {
  if (!targetId) return false;
  if (sourceId === targetId) return true;
  const findSource = (list: BlockItem[]): BlockItem | null => {
    for (const item of list) {
      if (item.id === sourceId) return item;
      if (item.children) {
        const found = findSource(item.children);
        if (found) return found;
      }
    }
    return null;
  };
  const sourceBlock = findSource(items);
  if (!sourceBlock || !sourceBlock.children) return false;
  return containsBlockId(sourceBlock.children, targetId);
};

const removeBlockById = (
  items: BlockItem[],
  blockId: string
): { nextItems: BlockItem[]; removed: BlockItem | null } => {
  let removed: BlockItem | null = null;
  const nextItems: BlockItem[] = [];

  for (const item of items) {
    if (item.id === blockId) {
      removed = item;
      continue;
    }
    if (item.children) {
      const childRes = removeBlockById(item.children, blockId);
      if (childRes.removed) {
        removed = childRes.removed;
        nextItems.push({ ...item, children: childRes.nextItems });
        continue;
      }
    }
    nextItems.push(item);
  }

  return { nextItems, removed };
};

const insertBlockIntoParent = (
  items: BlockItem[],
  blockToInsert: BlockItem,
  targetParentId: string | null,
  relative?: { siblingId: string; placement: 'before' | 'after' }
): BlockItem[] => {
  const insertInList = (list: BlockItem[]): BlockItem[] => {
    if (!relative) {
      return [...list, blockToInsert];
    }
    const idx = list.findIndex(b => b.id === relative.siblingId);
    if (idx === -1) {
      return [...list, blockToInsert];
    }
    const insertIdx = relative.placement === 'before' ? idx : idx + 1;
    const copy = [...list];
    copy.splice(insertIdx, 0, blockToInsert);
    return copy;
  };

  if (targetParentId === null) {
    return insertInList(items);
  }

  return items.map(item => {
    if (item.id === targetParentId) {
      const existingChildren = item.children || [];
      return {
        ...item,
        collapsed: false,
        children: insertInList(existingChildren)
      };
    }
    if (item.children) {
      return {
        ...item,
        children: insertBlockIntoParent(item.children, blockToInsert, targetParentId, relative)
      };
    }
    return item;
  });
};

export default function BlockEditor({ code, onChange }: BlockEditorProps) {
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const language = useStore(state => state.language);

  const [activeTab, setActiveTab] = useState<'all' | 'events' | 'actions' | 'entities' | 'control'>('all');
  const [blocks, setBlocks] = useState<BlockItem[]>([]);
  const [showCodePreview, setShowCodePreview] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const dragPayloadRef = useRef<DragPayload | null>(null);
  const lastEmittedCodeRef = useRef<string | null>(null);

  const [configuringDifrenoptId, setConfiguringDifrenoptId] = useState<string | null>(null);

  const blocksToCode = useCallback((items: BlockItem[], depth = 0): string => {
    const indent = '  '.repeat(depth);
    let result = '';

    for (const item of items) {
      if (item.name === 'difrenopt') {
        result += serializeDifrenoptBlock(item.params, item.drplCode || DRPL_TEMPLATES[0].drplCode, indent) + '\n\n';
        continue;
      }

      const paramKeys = Object.keys(item.params).filter(
        k => item.params[k] !== undefined && item.params[k] !== ''
      );
      const paramStr =
        paramKeys.length > 0
          ? `{${paramKeys.map(k => `${k}=${item.params[k]}`).join(', ')}}`
          : '';

      if (item.type === 'event') {
        result += `${indent}${item.name}${paramStr}\n`;
        if (item.children && item.children.length > 0) {
          result += blocksToCode(item.children, depth + 1);
        }
        result += `${indent}end\n\n`;
      } else if (item.type === 'control' && item.children !== undefined) {
        if (item.name === 'if') {
          const checkVal = item.params.check || 'true';
          result += `${indent}if ${checkVal} then\n`;
          if (item.children.length > 0) {
            result += blocksToCode(item.children, depth + 1);
          }
          result += `${indent}end\n`;
        } else {
          result += `${indent}${item.name}${paramStr}\n`;
          if (item.children.length > 0) {
            result += blocksToCode(item.children, depth + 1);
          }
          result += `${indent}end\n`;
        }
      } else if (item.type === 'entity') {
        result += `${indent}create ${item.name}${paramStr}\n`;
      } else {
        result += `${indent}${item.name}${paramStr}\n`;
      }
    }

    return result;
  }, []);

  const codeToBlocks = useCallback((codeString: string): BlockItem[] => {
    const lines = codeString.split('\n');
    const rootBlocks: BlockItem[] = [];
    const stack: { block: BlockItem; indent: number }[] = [];

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx].trim();
      if (!line || line.startsWith('//') || line.startsWith('#')) continue;

      if (isDifrenoptStartLine(line)) {
        const params: Record<string, string> = {};
        const paramMatch = line.match(/difrenopt\s*\{([^}]*)\}/i);
        if (paramMatch) {
          paramMatch[1].split(',').forEach(pair => {
            const eqIdx = pair.indexOf('=');
            if (eqIdx !== -1) {
              const k = pair.slice(0, eqIdx).trim();
              const v = pair.slice(eqIdx + 1).trim();
              if (k) params[k] = v;
            }
          });
        }
        const { drplLines, nextIndex } = extractDifrenoptBlock(lines, idx + 1);
        const drplCode = drplLines.map(l => (l.startsWith('  ') ? l.slice(2) : l)).join('\n').trim();
        const newBlock: BlockItem = {
          id: `block_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          type: 'entity',
          name: 'difrenopt',
          params,
          drplCode
        };
        if (stack.length > 0) {
          const parent = stack[stack.length - 1].block;
          if (!parent.children) parent.children = [];
          parent.children.push(newBlock);
        } else {
          rootBlocks.push(newBlock);
        }
        idx = nextIndex - 1;
        continue;
      }

      if (line === 'end') {
        if (stack.length > 0) {
          stack.pop();
        }
        continue;
      }

      let namePart = line;
      const params: Record<string, string> = {};
      const paramMatch = line.match(/^(.*?)\{(.*?)\}(.*)$/);

      if (paramMatch) {
        namePart = (paramMatch[1] + paramMatch[3]).trim();
        const paramPairs = paramMatch[2].split(',');
        paramPairs.forEach(pair => {
          const eqIdx = pair.indexOf('=');
          if (eqIdx !== -1) {
            const k = pair.slice(0, eqIdx).trim();
            const v = pair.slice(eqIdx + 1).trim();
            if (k) params[k] = v;
          }
        });
      }

      namePart = namePart.replace(/^create\s+/, '').trim();

      let blockType: 'event' | 'action' | 'entity' | 'control' = 'action';
      let isContainer = false;

      if (namePart.endsWith('?') || namePart === 'started?') {
        blockType = 'event';
        isContainer = true;
      } else if (['if', 'repeat', 'forever', 'check'].includes(namePart) || line.startsWith('if ')) {
        blockType = 'control';
        isContainer = true;
        if (line.startsWith('if ')) {
          namePart = 'if';
          const condition = line.replace(/^if\s+/, '').replace(/\s+then$/, '').trim();
          params.check = condition;
        }
      } else if (
        ['button', 'block', 'text_label', 'sprite', 'player', 'enemy', '3Dblock', 'circle', 'textbox', 'difrenopt'].includes(namePart)
      ) {
        blockType = 'entity';
      }

      const newBlock: BlockItem = {
        id: `block_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        type: blockType,
        name: namePart,
        params,
        ...(isContainer ? { children: [], collapsed: false } : {})
      };

      if (stack.length > 0) {
        const parent = stack[stack.length - 1].block;
        if (!parent.children) parent.children = [];
        parent.children.push(newBlock);
      } else {
        rootBlocks.push(newBlock);
      }

      if (isContainer) {
        stack.push({ block: newBlock, indent: stack.length });
      }
    }

    return rootBlocks;
  }, []);

  useEffect(() => {
    if (lastEmittedCodeRef.current === code) return;
    if (code.trim()) {
      const parsed = codeToBlocks(code);
      setBlocks(parsed);
      lastEmittedCodeRef.current = code;
    } else if (blocks.length > 0 && lastEmittedCodeRef.current === '') {
      setBlocks([]);
    }
  }, [code, codeToBlocks, blocks.length]);

  const updateBlocksAndCode = useCallback(
    (newBlocks: BlockItem[]) => {
      setBlocks(newBlocks);
      const newCode = blocksToCode(newBlocks);
      lastEmittedCodeRef.current = newCode;
      onChange(newCode);
    },
    [blocksToCode, onChange]
  );

  const handleAddPresetBlock = useCallback(
    (preset: PresetBlockDef, targetParentId?: string) => {
      const newBlock = createBlockFromPreset(preset);
      const next = insertBlockIntoParent(blocks, newBlock, targetParentId ?? null);
      updateBlocksAndCode(next);
    },
    [blocks, updateBlocksAndCode]
  );

  const handleDeleteBlock = useCallback(
    (blockId: string) => {
      const { nextItems } = removeBlockById(blocks, blockId);
      updateBlocksAndCode(nextItems);
    },
    [blocks, updateBlocksAndCode]
  );

  const handleUpdateParam = useCallback(
    (blockId: string, paramKey: string, newValue: string) => {
      const updateDeep = (items: BlockItem[]): BlockItem[] =>
        items.map(item => {
          if (item.id === blockId) {
            return {
              ...item,
              params: { ...item.params, [paramKey]: newValue }
            };
          }
          if (item.children) {
            return { ...item, children: updateDeep(item.children) };
          }
          return item;
        });
      updateBlocksAndCode(updateDeep(blocks));
    },
    [blocks, updateBlocksAndCode]
  );

  const handleToggleCollapse = useCallback((blockId: string) => {
    setBlocks(prev => {
      const toggleDeep = (items: BlockItem[]): BlockItem[] =>
        items.map(item => {
          if (item.id === blockId) {
            return { ...item, collapsed: !item.collapsed };
          }
          if (item.children) {
            return { ...item, children: toggleDeep(item.children) };
          }
          return item;
        });
      return toggleDeep(prev);
    });
  }, []);

  const resolveDragPayload = (e: React.DragEvent): DragPayload | null => {
    if (dragPayloadRef.current) return dragPayloadRef.current;
    try {
      const raw = e.dataTransfer.getData('application/x-epl-block');
      if (raw) return JSON.parse(raw) as DragPayload;
    } catch {
      // ignore
    }
    return null;
  };

  const clearDragState = useCallback(() => {
    dragPayloadRef.current = null;
    setDragPayload(null);
    setDropTarget(null);
  }, []);

  const canDropIntoTarget = useCallback(
    (payload: DragPayload | null, targetBlockOrParentId: string | null): boolean => {
      if (!payload) return false;
      if (payload.source === 'palette') return true;
      if (payload.blockId === targetBlockOrParentId) return false;
      if (targetBlockOrParentId && isDescendantOrSelf(blocks, payload.blockId, targetBlockOrParentId)) {
        return false;
      }
      return true;
    },
    [blocks]
  );

  const executeDrop = useCallback(
    (e: React.DragEvent, target: Exclude<DropTarget, null>) => {
      e.preventDefault();
      e.stopPropagation();

      const payload = resolveDragPayload(e);
      clearDragState();
      if (!payload) return;

      let blockToInsert: BlockItem | null = null;
      let workingTree = blocks;

      if (payload.source === 'palette') {
        const preset = PRESET_BLOCKS[payload.presetIndex];
        if (!preset) return;
        blockToInsert = createBlockFromPreset(preset);
      } else {
        const targetIdToCheck =
          target.type === 'container'
            ? target.parentId
            : target.type === 'sibling'
              ? target.blockId
              : null;

        if (payload.blockId === targetIdToCheck) return;
        if (targetIdToCheck && isDescendantOrSelf(blocks, payload.blockId, targetIdToCheck)) {
          return;
        }
        if (target.type === 'sibling' && target.parentId && isDescendantOrSelf(blocks, payload.blockId, target.parentId)) {
          return;
        }

        const removedRes = removeBlockById(blocks, payload.blockId);
        if (!removedRes.removed) return;
        blockToInsert = removedRes.removed;
        workingTree = removedRes.nextItems;
      }

      if (!blockToInsert) return;

      let nextTree = workingTree;
      if (target.type === 'root-end') {
        nextTree = insertBlockIntoParent(workingTree, blockToInsert, null);
      } else if (target.type === 'container') {
        nextTree = insertBlockIntoParent(workingTree, blockToInsert, target.parentId);
      } else if (target.type === 'sibling') {
        nextTree = insertBlockIntoParent(workingTree, blockToInsert, target.parentId, {
          siblingId: target.blockId,
          placement: target.placement
        });
      }

      updateBlocksAndCode(nextTree);
    },
    [blocks, clearDragState, updateBlocksAndCode]
  );

  const handleStartPaletteDrag = (e: React.DragEvent, presetIndex: number) => {
    const payload: DragPayload = { source: 'palette', presetIndex };
    dragPayloadRef.current = payload;
    setDragPayload(payload);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/x-epl-block', JSON.stringify(payload));
    e.dataTransfer.setData('text/plain', PRESET_BLOCKS[presetIndex].label);
  };

  const handleStartWorkspaceDrag = useCallback((e: React.DragEvent, blockId: string) => {
    e.stopPropagation();
    const payload: DragPayload = { source: 'workspace', blockId };
    dragPayloadRef.current = payload;
    setDragPayload(payload);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-epl-block', JSON.stringify(payload));
    e.dataTransfer.setData('text/plain', blockId);
  }, []);

  const generatedCode = blocksToCode(blocks);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const filteredPresets = PRESET_BLOCKS.map((preset, originalIndex) => ({ preset, originalIndex })).filter(({ preset }) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'events') return preset.type === 'event';
    if (activeTab === 'actions') return preset.type === 'action';
    if (activeTab === 'entities') return preset.type === 'entity';
    if (activeTab === 'control') return preset.type === 'control';
    return true;
  });

  const isLight = theme === 'light' && !isFrutigerAero;

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden select-none">
      {/* Palette Sidebar */}
      <div
        className={clsx(
          'w-full md:w-80 border-b md:border-b-0 md:border-r flex flex-col shrink-0 overflow-hidden',
          isFrutigerAero
            ? 'bg-white/40 border-white/50 backdrop-blur-md text-slate-900'
            : isLight
              ? 'bg-white border-[#E2E5EA] text-[#111315]'
              : 'bg-[#181B20] border-[#262B33] text-[#F3F4F6]'
        )}
      >
        <div
          className={clsx(
            'p-3 sm:p-4 border-b flex items-center justify-between',
            isFrutigerAero ? 'border-white/40' : isLight ? 'border-[#E2E5EA]' : 'border-[#262B33]'
          )}
        >
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
              <Layers className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-sm leading-tight">
                {language === 'ru' ? 'Палитра Блоков' : 'Block Palette'}
              </h3>
              <p className={clsx('text-[10px]', isLight ? 'text-slate-500' : 'text-[#9CA3AF]')}>
                {language === 'ru' ? 'Перетащите на холст или внутрь блока' : 'Drag onto canvas or inside a block'}
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
            EPL
          </span>
        </div>

        {/* Category Tabs */}
        <div
          className={clsx(
            'flex gap-1 p-2 border-b overflow-x-auto no-scrollbar',
            isFrutigerAero ? 'border-white/40' : isLight ? 'border-[#E2E5EA]' : 'border-[#262B33]'
          )}
        >
          {[
            { id: 'all', label: language === 'ru' ? 'Все' : 'All' },
            { id: 'events', label: language === 'ru' ? 'События' : 'Events' },
            { id: 'actions', label: language === 'ru' ? 'Действия' : 'Actions' },
            { id: 'entities', label: language === 'ru' ? 'Объекты' : 'Entities' },
            { id: 'control', label: language === 'ru' ? 'Логика' : 'Logic' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={clsx(
                'px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-[#10B981] text-[#0A0C0E]'
                  : isLight
                    ? 'bg-[#F5F6F8] text-slate-600 hover:text-slate-900'
                    : 'bg-[#111315] text-[#9CA3AF] hover:text-[#F3F4F6]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Presets List (Draggable + Click Quick-Add) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {filteredPresets.map(({ preset, originalIndex }) => {
            let colorClasses = isLight
              ? 'bg-violet-50 border-violet-200 text-violet-900 hover:border-violet-400'
              : 'bg-violet-500/10 border-violet-500/25 text-violet-200 hover:border-violet-400/60';
            let barBg = 'bg-violet-500';

            if (preset.type === 'event') {
              colorClasses = isLight
                ? 'bg-amber-50 border-amber-200 text-amber-900 hover:border-amber-400'
                : 'bg-amber-500/10 border-amber-500/25 text-amber-200 hover:border-amber-400/60';
              barBg = 'bg-amber-500';
            } else if (preset.type === 'action') {
              colorClasses = isLight
                ? 'bg-sky-50 border-sky-200 text-sky-900 hover:border-sky-400'
                : 'bg-sky-500/10 border-sky-500/25 text-sky-200 hover:border-sky-400/60';
              barBg = 'bg-sky-500';
            } else if (preset.type === 'entity') {
              colorClasses = isLight
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:border-emerald-400'
                : 'bg-[#10B981]/10 border-[#10B981]/30 text-emerald-200 hover:border-[#10B981]/70';
              barBg = 'bg-[#10B981]';
            }

            return (
              <div
                key={originalIndex}
                draggable
                onDragStart={e => handleStartPaletteDrag(e, originalIndex)}
                onDragEnd={clearDragState}
                onClick={() => handleAddPresetBlock(preset)}
                className={clsx(
                  'p-2.5 rounded-lg border transition-colors cursor-grab active:cursor-grabbing flex items-center justify-between gap-2',
                  colorClasses
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <GripVertical className="w-3.5 h-3.5 opacity-45 shrink-0" />
                  <span className={clsx('w-1.5 h-6 rounded-sm shrink-0', barBg)} />
                  <div className="min-w-0">
                    <div className="font-mono font-bold text-xs truncate flex items-center gap-1.5">
                      <span>{preset.label}</span>
                      {preset.hasChildren && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-black/20 font-sans font-medium opacity-80">
                          {language === 'ru' ? 'контейнер' : 'container'}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] opacity-75 truncate">{preset.description}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    handleAddPresetBlock(preset);
                  }}
                  className={clsx(
                    'p-1.5 rounded-md transition-colors shrink-0 cursor-pointer',
                    isLight
                      ? 'bg-black/5 hover:bg-[#10B981] text-slate-700 hover:text-white'
                      : 'bg-black/30 hover:bg-[#10B981] text-[#D1D5DB] hover:text-[#0A0C0E]'
                  )}
                  title={language === 'ru' ? 'Добавить на холст' : 'Add to workspace'}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Block Canvas Workspace */}
      <div
        className={clsx(
          'flex-1 flex flex-col overflow-hidden relative',
          isFrutigerAero ? 'bg-transparent' : isLight ? 'bg-[#F5F6F8]' : 'bg-[#111315]'
        )}
      >
        <div
          className={clsx(
            'p-3 sm:px-6 py-2.5 border-b flex items-center justify-between gap-3 shrink-0',
            isFrutigerAero
              ? 'bg-white/30 border-white/40'
              : isLight
                ? 'bg-white border-[#E2E5EA]'
                : 'bg-[#181B20] border-[#262B33]'
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1.5 rounded-lg bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 shrink-0">
              <Zap className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={clsx('font-bold text-sm truncate', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>
                  {language === 'ru' ? 'Холст Блоков EPL' : 'EPL Block Workspace'}
                </h3>
                <span className={clsx('text-xs font-mono', isLight ? 'text-slate-500' : 'text-[#9CA3AF]')}>
                  [{blocks.length}]
                </span>
              </div>
              <p className={clsx('text-[10px] truncate hidden sm:block', isLight ? 'text-slate-500' : 'text-[#9CA3AF]')}>
                {language === 'ru'
                  ? 'Перетаскивайте блоки за маркер ⋮⋮ чтобы менять порядок или вкладывать внутрь'
                  : 'Drag blocks by ⋮⋮ handle to reorder or nest inside containers'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowCodePreview(!showCodePreview)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer border',
                showCodePreview
                  ? 'bg-[#10B981] text-[#0A0C0E] border-[#10B981]'
                  : isLight
                    ? 'bg-[#F5F6F8] hover:bg-slate-200 text-slate-700 border-[#E2E5EA]'
                    : 'bg-[#111315] hover:bg-[#262B33] text-[#D1D5DB] border-[#262B33]'
              )}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>
                {showCodePreview
                  ? language === 'ru'
                    ? 'Скрыть код'
                    : 'Hide Code'
                  : language === 'ru'
                    ? 'Код EPL'
                    : 'View Code'}
              </span>
            </button>

            {blocks.length > 0 && (
              <button
                type="button"
                onClick={() => updateBlocksAndCode([])}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors cursor-pointer flex items-center gap-1"
                title={language === 'ru' ? 'Очистить весь холст' : 'Clear workspace'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{language === 'ru' ? 'Очистить' : 'Clear'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Canvas Body */}
        <div
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5 custom-scrollbar relative"
          onDragOver={e => {
            if (!dragPayloadRef.current && !e.dataTransfer.types.includes('application/x-epl-block')) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = dragPayloadRef.current?.source === 'palette' ? 'copy' : 'move';
            setDropTarget({ type: 'root-end' });
          }}
          onDragLeave={e => {
            if (e.currentTarget === e.target) {
              setDropTarget(prev => (prev?.type === 'root-end' ? null : prev));
            }
          }}
          onDrop={e => executeDrop(e, { type: 'root-end' })}
        >
          {blocks.map(block => (
            <RenderBlockCard
              key={block.id}
              block={block}
              parentId={null}
              draggingBlockId={dragPayload?.source === 'workspace' ? dragPayload.blockId : null}
              dropTarget={dropTarget}
              canDropIntoTarget={canDropIntoTarget}
              dragPayload={dragPayload}
              onDragStartBlock={handleStartWorkspaceDrag}
              onDragEndBlock={clearDragState}
              onSetDropTarget={setDropTarget}
              onExecuteDrop={executeDrop}
              onDelete={handleDeleteBlock}
              onUpdateParam={handleUpdateParam}
              onToggleCollapse={handleToggleCollapse}
              onAddChild={handleAddPresetBlock}
              onConfigureDifrenopt={setConfiguringDifrenoptId}
              isFrutigerAero={isFrutigerAero}
              isLight={isLight}
              language={language}
            />
          ))}

          {/* Root Drop Slot when canvas already has blocks and user is dragging */}
          {blocks.length > 0 && (
            <div
              className={clsx(
                'mt-2 rounded-lg border border-dashed py-3 px-4 text-center text-[11px] font-medium transition-colors',
                dropTarget?.type === 'root-end'
                  ? 'border-[#10B981] bg-[#10B981]/10 text-[#10B981]'
                  : isLight
                    ? 'border-[#E2E5EA] text-slate-400'
                    : 'border-[#262B33] text-[#6B7280]'
              )}
            >
              {language === 'ru'
                ? 'Перетащите блок сюда, чтобы поместить на верхний уровень'
                : 'Drop a block here to place at root level'}
            </div>
          )}

          {blocks.length === 0 && (
            <div
              className={clsx(
                'h-full min-h-[260px] flex flex-col items-center justify-center text-center p-10 border border-dashed rounded-xl transition-colors',
                dropTarget?.type === 'root-end'
                  ? 'border-[#10B981] bg-[#10B981]/10'
                  : isLight
                    ? 'border-[#E2E5EA] bg-white/60 text-slate-500'
                    : 'border-[#262B33] bg-[#181B20]/40 text-[#9CA3AF]'
              )}
            >
              <Layers className="w-10 h-10 opacity-50 mb-3 text-[#10B981]" />
              <h4 className={clsx('font-bold text-sm mb-1', isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>
                {language === 'ru' ? 'Холст блоков пуст' : 'Workspace is empty'}
              </h4>
              <p className="text-xs max-w-sm opacity-80 mb-4">
                {language === 'ru'
                  ? 'Перетащите любой блок из палитры слева сюда, или нажмите кнопку ниже для старта.'
                  : 'Drag any block from the left palette here, or click below to start.'}
              </p>
              <button
                type="button"
                onClick={() => handleAddPresetBlock(PRESET_BLOCKS[0])}
                className="px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E] text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {language === 'ru' ? 'Добавить блок "started?"' : 'Add "started?" Event'}
              </button>
            </div>
          )}
        </div>

        {/* Floating EPL Code Preview Box */}
        {showCodePreview && (
          <div
            className={clsx(
              'absolute top-14 right-4 z-40 w-80 sm:w-96 rounded-xl border shadow-2xl p-4 text-xs space-y-2',
              isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#181B20] border-[#262B33]'
            )}
          >
            <div
              className={clsx(
                'flex items-center justify-between border-b pb-2',
                isLight ? 'border-[#E2E5EA]' : 'border-[#262B33]'
              )}
            >
              <div className="flex items-center gap-1.5 font-bold text-[#10B981]">
                <Code2 className="w-4 h-4" />
                <span>{language === 'ru' ? 'Сгенерированный код EPL' : 'Generated EPL Code'}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className={clsx(
                  'px-2 py-1 rounded-md flex items-center gap-1 text-[10px] font-medium cursor-pointer',
                  isLight ? 'bg-[#F5F6F8] hover:bg-slate-200 text-slate-700' : 'bg-[#111315] hover:bg-[#262B33] text-[#D1D5DB]'
                )}
              >
                {copiedCode ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode ? (language === 'ru' ? 'Скопировано' : 'Copied') : language === 'ru' ? 'Копировать' : 'Copy'}</span>
              </button>
            </div>
            <pre
              className={clsx(
                'p-3 rounded-lg font-mono text-[11px] leading-relaxed overflow-x-auto max-h-64 custom-scrollbar border',
                isLight ? 'bg-[#F5F6F8] text-emerald-700 border-[#E2E5EA]' : 'bg-[#0A0C0E] text-[#10B981] border-[#262B33]'
              )}
            >
              {generatedCode || '// Блоки отсутствуют'}
            </pre>
          </div>
        )}
      </div>

      {configuringDifrenoptId && (() => {
        const findBlock = (items: BlockItem[]): BlockItem | null => {
          for (const b of items) {
            if (b.id === configuringDifrenoptId) return b;
            if (b.children) {
              const f = findBlock(b.children);
              if (f) return f;
            }
          }
          return null;
        };
        const targetBlock = findBlock(blocks);
        if (!targetBlock) return null;
        return (
          <DifrenoptConfigModal
            isOpen={true}
            onClose={() => setConfiguringDifrenoptId(null)}
            initialParams={targetBlock.params}
            initialDrplCode={targetBlock.drplCode}
            onApply={(nextParams, nextDrpl) => {
              const updateDeep = (items: BlockItem[]): BlockItem[] =>
                items.map(item => {
                  if (item.id === targetBlock.id) {
                    return { ...item, params: nextParams, drplCode: nextDrpl };
                  }
                  if (item.children) {
                    return { ...item, children: updateDeep(item.children) };
                  }
                  return item;
                });
              updateBlocksAndCode(updateDeep(blocks));
            }}
          />
        );
      })()}
    </div>
  );
}

interface RenderBlockCardProps {
  block: BlockItem;
  parentId: string | null;
  draggingBlockId: string | null;
  dropTarget: DropTarget;
  dragPayload: DragPayload | null;
  canDropIntoTarget: (payload: DragPayload | null, targetId: string | null) => boolean;
  onDragStartBlock: (e: React.DragEvent, blockId: string) => void;
  onDragEndBlock: () => void;
  onSetDropTarget: (target: DropTarget) => void;
  onExecuteDrop: (e: React.DragEvent, target: Exclude<DropTarget, null>) => void;
  onDelete: (id: string) => void;
  onUpdateParam: (id: string, key: string, value: string) => void;
  onToggleCollapse: (id: string) => void;
  onAddChild: (preset: PresetBlockDef, parentId: string) => void;
  onConfigureDifrenopt: (blockId: string) => void;
  isFrutigerAero: boolean;
  isLight: boolean;
  language: 'en' | 'ru';
}

function RenderBlockCard({
  block,
  parentId,
  draggingBlockId,
  dropTarget,
  dragPayload,
  canDropIntoTarget,
  onDragStartBlock,
  onDragEndBlock,
  onSetDropTarget,
  onExecuteDrop,
  onDelete,
  onUpdateParam,
  onToggleCollapse,
  onAddChild,
  onConfigureDifrenopt,
  isFrutigerAero,
  isLight,
  language
}: RenderBlockCardProps) {
  const [showInnerPicker, setShowInnerPicker] = useState(false);

  const isContainer = block.children !== undefined;
  const isBeingDragged = draggingBlockId === block.id;

  const isSiblingBefore =
    dropTarget?.type === 'sibling' && dropTarget.blockId === block.id && dropTarget.placement === 'before';
  const isSiblingAfter =
    dropTarget?.type === 'sibling' && dropTarget.blockId === block.id && dropTarget.placement === 'after';
  const isContainerTarget = dropTarget?.type === 'container' && dropTarget.parentId === block.id;

  let cardSurface = isLight
    ? 'bg-white border-violet-300 text-slate-900'
    : 'bg-[#181B20] border-violet-500/35 text-[#F3F4F6]';
  let headerStrip = isLight ? 'bg-violet-50/70' : 'bg-violet-500/10';
  let accentBar = 'bg-violet-500';

  if (block.type === 'event') {
    cardSurface = isLight
      ? 'bg-white border-amber-300 text-slate-900'
      : 'bg-[#181B20] border-amber-500/35 text-[#F3F4F6]';
    headerStrip = isLight ? 'bg-amber-50/70' : 'bg-amber-500/10';
    accentBar = 'bg-amber-500';
  } else if (block.type === 'action') {
    cardSurface = isLight
      ? 'bg-white border-sky-300 text-slate-900'
      : 'bg-[#181B20] border-sky-500/35 text-[#F3F4F6]';
    headerStrip = isLight ? 'bg-sky-50/70' : 'bg-sky-500/10';
    accentBar = 'bg-sky-500';
  } else if (block.type === 'entity') {
    cardSurface = isLight
      ? 'bg-white border-emerald-300 text-slate-900'
      : 'bg-[#181B20] border-[#10B981]/40 text-[#F3F4F6]';
    headerStrip = isLight ? 'bg-emerald-50/70' : 'bg-[#10B981]/10';
    accentBar = 'bg-[#10B981]';
  }

  if (isFrutigerAero) {
    cardSurface = 'bg-white/60 border-white/70 text-slate-900 backdrop-blur-md';
  }

  const paramKeys = Object.keys(block.params);
  const innerPresetOptions = PRESET_BLOCKS.filter(p => p.type !== 'event');

  const handleCardHeaderDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!canDropIntoTarget(dragPayload, block.id)) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const ratio = rect.height > 0 ? relY / rect.height : 0.5;

    // If collapsed container and pointer is in middle zone, drop inside container
    if (isContainer && block.collapsed && ratio > 0.28 && ratio < 0.72) {
      onSetDropTarget({ type: 'container', parentId: block.id });
      return;
    }

    const placement: 'before' | 'after' = ratio < 0.5 ? 'before' : 'after';
    onSetDropTarget({
      type: 'sibling',
      blockId: block.id,
      parentId,
      placement
    });
  };

  const handleCardHeaderDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!canDropIntoTarget(dragPayload, block.id)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const ratio = rect.height > 0 ? relY / rect.height : 0.5;

    if (isContainer && block.collapsed && ratio > 0.28 && ratio < 0.72) {
      onExecuteDrop(e, { type: 'container', parentId: block.id });
      return;
    }

    const placement: 'before' | 'after' = ratio < 0.5 ? 'before' : 'after';
    onExecuteDrop(e, {
      type: 'sibling',
      blockId: block.id,
      parentId,
      placement
    });
  };

  const handleContainerBodyDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!canDropIntoTarget(dragPayload, block.id)) return;
    e.preventDefault();
    e.stopPropagation();
    onSetDropTarget({ type: 'container', parentId: block.id });
  };

  const handleContainerBodyDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!canDropIntoTarget(dragPayload, block.id)) return;
    onExecuteDrop(e, { type: 'container', parentId: block.id });
  };

  return (
    <div className="relative">
      {/* Top Insertion Line */}
      {isSiblingBefore && (
        <div className="h-1 -mt-1 mb-1 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.7)] pointer-events-none" />
      )}

      <div
        draggable
        onDragStart={e => onDragStartBlock(e, block.id)}
        onDragEnd={onDragEndBlock}
        className={clsx(
          'rounded-xl border transition-all overflow-hidden',
          cardSurface,
          isBeingDragged && 'opacity-45 ring-1 ring-[#10B981]',
          isContainerTarget && 'ring-2 ring-[#10B981] border-[#10B981]'
        )}
      >
        {/* Block Header */}
        <div
          onDragOver={handleCardHeaderDragOver}
          onDrop={handleCardHeaderDrop}
          className={clsx(
            'p-2.5 sm:p-3 flex items-center justify-between gap-2.5 cursor-grab active:cursor-grabbing',
            headerStrip
          )}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
            <span
              className={clsx(
                'p-1 rounded cursor-grab active:cursor-grabbing shrink-0',
                isLight ? 'text-slate-400 hover:text-slate-700' : 'text-[#6B7280] hover:text-[#F3F4F6]'
              )}
              title={language === 'ru' ? 'Потяните, чтобы переместить' : 'Drag to move'}
            >
              <GripVertical className="w-4 h-4" />
            </span>

            <span className={clsx('w-1.5 h-5 rounded-sm shrink-0', accentBar)} />

            <span className="font-mono font-bold text-xs sm:text-sm">
              {block.type === 'entity' ? `create ${block.name}` : block.name}
            </span>

            <div
              className="flex items-center gap-1.5 flex-wrap"
              draggable
              onDragStart={e => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onMouseDown={e => e.stopPropagation()}
            >
              {paramKeys.map(key => (
                <div
                  key={key}
                  className={clsx(
                    'flex items-center gap-1 px-2 py-0.5 rounded-md border',
                    isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#0A0C0E] border-[#262B33]'
                  )}
                >
                  <span className={clsx('text-[10px] font-mono', isLight ? 'text-slate-500' : 'text-[#9CA3AF]')}>
                    {key}:
                  </span>
                  <input
                    type="text"
                    value={block.params[key] || ''}
                    onChange={e => onUpdateParam(block.id, key, e.target.value)}
                    className={clsx(
                      'bg-transparent border-none text-xs font-mono focus:outline-none w-20 sm:w-28',
                      isLight ? 'text-emerald-700' : 'text-[#10B981]'
                    )}
                  />
                </div>
              ))}
            </div>
          </div>

          <div
            className="flex items-center gap-1 shrink-0"
            onMouseDown={e => e.stopPropagation()}
          >
            {block.name === 'difrenopt' && (
              <button
                type="button"
                onClick={() => onConfigureDifrenopt(block.id)}
                className="px-2.5 py-1 rounded-md bg-[#10B981]/15 hover:bg-[#10B981] text-[#10B981] hover:text-[#0A0C0E] border border-[#10B981]/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer mr-1"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>{language === 'ru' ? 'Настроить DRPL' : 'Configure DRPL'}</span>
              </button>
            )}

            {isContainer && (
              <button
                type="button"
                onClick={() => onToggleCollapse(block.id)}
                className={clsx(
                  'p-1 rounded-md transition-colors cursor-pointer',
                  isLight ? 'hover:bg-black/5 text-slate-500 hover:text-slate-900' : 'hover:bg-white/10 text-[#9CA3AF] hover:text-white'
                )}
                title={block.collapsed ? (language === 'ru' ? 'Развернуть' : 'Expand') : language === 'ru' ? 'Свернуть' : 'Collapse'}
              >
                {block.collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}

            <button
              type="button"
              onClick={() => onDelete(block.id)}
              className="p-1 rounded-md hover:bg-red-500/20 text-[#9CA3AF] hover:text-red-400 transition-colors cursor-pointer"
              title={language === 'ru' ? 'Удалить блок' : 'Delete block'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Children Dropzone for Container Blocks */}
        {isContainer && !block.collapsed && (
          <div
            onDragOver={handleContainerBodyDragOver}
            onDrop={handleContainerBodyDrop}
            className={clsx(
              'p-3 pl-5 sm:pl-7 space-y-2 border-t transition-colors',
              isLight ? 'border-[#E2E5EA] bg-[#F5F6F8]/70' : 'border-[#262B33] bg-[#0A0C0E]/45',
              isContainerTarget && 'bg-[#10B981]/10'
            )}
          >
            {block.children!.map(child => (
              <RenderBlockCard
                key={child.id}
                block={child}
                parentId={block.id}
                draggingBlockId={draggingBlockId}
                dropTarget={dropTarget}
                dragPayload={dragPayload}
                canDropIntoTarget={canDropIntoTarget}
                onDragStartBlock={onDragStartBlock}
                onDragEndBlock={onDragEndBlock}
                onSetDropTarget={onSetDropTarget}
                onExecuteDrop={onExecuteDrop}
                onDelete={onDelete}
                onUpdateParam={onUpdateParam}
                onToggleCollapse={onToggleCollapse}
                onAddChild={onAddChild}
                onConfigureDifrenopt={onConfigureDifrenopt}
                isFrutigerAero={isFrutigerAero}
                isLight={isLight}
                language={language}
              />
            ))}

            {/* Drop Slot inside Container */}
            <div
              onDragOver={handleContainerBodyDragOver}
              onDrop={handleContainerBodyDrop}
              className={clsx(
                'p-2.5 text-center text-[11px] rounded-lg border border-dashed transition-colors flex items-center justify-center gap-1.5',
                isContainerTarget
                  ? 'border-[#10B981] bg-[#10B981]/15 text-[#10B981] font-semibold'
                  : isLight
                    ? 'border-[#D1D5DB] text-slate-500'
                    : 'border-[#262B33] text-[#9CA3AF]'
              )}
            >
              <FolderInput className="w-3.5 h-3.5 opacity-75" />
              <span>
                {block.children!.length === 0
                  ? language === 'ru'
                    ? 'Перетащите сюда любой блок или выберите через «+ В блок»'
                    : 'Drag any block inside here or click "+ Add inside"'
                  : language === 'ru'
                    ? 'Перетащите сюда ещё блок, чтобы добавить внутрь'
                    : 'Drop another block here to insert inside'}
              </span>
            </div>

            {/* Inline Quick-Picker to add any block INSIDE this container */}
            <div className="pt-0.5 space-y-2" onMouseDown={e => e.stopPropagation()}>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowInnerPicker(prev => !prev)}
                  className={clsx(
                    'px-2.5 py-1 rounded-md border text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors',
                    showInnerPicker
                      ? 'bg-[#10B981] text-[#0A0C0E] border-[#10B981]'
                      : isLight
                        ? 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-[#181B20] hover:bg-[#10B981]/15 text-[#10B981] border-[#10B981]/35'
                  )}
                >
                  {showInnerPicker ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  <span>{language === 'ru' ? 'Добавить в блок' : 'Add inside'}</span>
                </button>
              </div>

              {showInnerPicker && (
                <div
                  className={clsx(
                    'p-2.5 rounded-lg border grid grid-cols-2 sm:grid-cols-3 gap-1.5',
                    isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#181B20] border-[#262B33]'
                  )}
                >
                  {innerPresetOptions.map(preset => (
                    <button
                      key={`${preset.type}_${preset.name}`}
                      type="button"
                      onClick={() => {
                        onAddChild(preset, block.id);
                        setShowInnerPicker(false);
                      }}
                      className={clsx(
                        'px-2 py-1.5 rounded-md text-left border transition-colors cursor-pointer flex items-center justify-between gap-1',
                        isLight
                          ? 'bg-[#F5F6F8] hover:bg-emerald-50 border-[#E2E5EA] hover:border-emerald-300 text-slate-800'
                          : 'bg-[#111315] hover:bg-[#10B981]/10 border-[#262B33] hover:border-[#10B981]/40 text-[#F3F4F6]'
                      )}
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] font-semibold truncate">{preset.label}</div>
                        <div className={clsx('text-[9px] truncate', isLight ? 'text-slate-500' : 'text-[#9CA3AF]')}>
                          {preset.description}
                        </div>
                      </div>
                      <Plus className="w-3 h-3 text-[#10B981] shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Insertion Line */}
      {isSiblingAfter && (
        <div className="h-1 mt-1 -mb-1 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.7)] pointer-events-none" />
      )}
    </div>
  );
}
