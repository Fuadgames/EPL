import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { 
  Plus, Trash2, GripVertical, Play, Code2, Sparkles, ChevronRight, ChevronDown, 
  Layers, MousePointer, Cpu, Zap, Copy, Check, Eye, HelpCircle, ArrowUp, ArrowDown 
} from 'lucide-react';
import { clsx } from 'clsx';
import { EPL_DICTIONARY, TokenDef } from '../lib/epl-dictionary';

export interface BlockItem {
  id: string;
  type: 'event' | 'action' | 'entity' | 'control';
  name: string; // e.g. 'started?', 'clicked?', 'move', 'button', 'if'
  params: Record<string, string>;
  children?: BlockItem[];
  collapsed?: boolean;
}

interface BlockEditorProps {
  code: string;
  onChange: (newCode: string) => void;
}

const PRESET_BLOCKS: Array<{
  type: 'event' | 'action' | 'entity' | 'control';
  name: string;
  label: string;
  description: string;
  params: Record<string, string>;
  hasChildren?: boolean;
}> = [
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

  // Control
  { type: 'control', name: 'if', label: 'if ... then', description: 'Условие если', params: { check: 'score >= 10' }, hasChildren: true },
  { type: 'control', name: 'repeat', label: 'repeat', description: 'Повторить N раз', params: { times: '5' }, hasChildren: true },
  { type: 'control', name: 'forever', label: 'forever', description: 'Бесконечный цикл', params: {}, hasChildren: true },
  { type: 'control', name: 'wait', label: 'wait', description: 'Пауза в секундах', params: { seconds: '1' } },
];

export default function BlockEditor({ code, onChange }: BlockEditorProps) {
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const language = useStore(state => state.language);
  const [activeTab, setActiveTab] = useState<'all' | 'events' | 'actions' | 'entities' | 'control'>('all');
  const [blocks, setBlocks] = useState<BlockItem[]>([]);
  const [showCodePreview, setShowCodePreview] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Convert block tree into clean EPL code
  const blocksToCode = useCallback((items: BlockItem[], depth = 0): string => {
    const indent = '  '.repeat(depth);
    let result = '';

    for (const item of items) {
      const paramKeys = Object.keys(item.params).filter(k => item.params[k] !== undefined && item.params[k] !== '');
      const paramStr = paramKeys.length > 0 
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

  // Parse EPL code string into BlockItem tree
  const codeToBlocks = useCallback((codeString: string): BlockItem[] => {
    const lines = codeString.split('\n');
    const rootBlocks: BlockItem[] = [];
    const stack: { block: BlockItem; indent: number }[] = [];

    lines.forEach((rawLine, idx) => {
      const line = rawLine.trim();
      if (!line || line.startsWith('//') || line.startsWith('#')) return;

      if (line === 'end') {
        if (stack.length > 0) {
          stack.pop();
        }
        return;
      }

      let namePart = line;
      let params: Record<string, string> = {};
      const paramMatch = line.match(/^(.*?)\{(.*?)\}(.*)$/);
      
      if (paramMatch) {
        namePart = (paramMatch[1] + paramMatch[3]).trim();
        const paramPairs = paramMatch[2].split(',');
        paramPairs.forEach(pair => {
          const [k, v] = pair.split('=').map(s => s?.trim());
          if (k) params[k] = v || '';
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
      } else if (['button', 'block', 'text_label', 'sprite', 'player', 'enemy', '3Dblock', 'circle', 'textbox'].includes(namePart)) {
        blockType = 'entity';
      }

      const newBlock: BlockItem = {
        id: `block_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
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
    });

    return rootBlocks;
  }, []);

  useEffect(() => {
    if (blocks.length === 0 && code.trim()) {
      const parsed = codeToBlocks(code);
      if (parsed.length > 0) {
        setBlocks(parsed);
      }
    }
  }, [code, blocks.length, codeToBlocks]);

  const updateBlocksAndCode = (newBlocks: BlockItem[]) => {
    setBlocks(newBlocks);
    const newCode = blocksToCode(newBlocks);
    onChange(newCode);
  };

  const handleAddPresetBlock = (preset: typeof PRESET_BLOCKS[0], targetParentId?: string) => {
    const newBlock: BlockItem = {
      id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: preset.type,
      name: preset.name,
      params: { ...preset.params },
      ...(preset.hasChildren ? { children: [], collapsed: false } : {})
    };

    if (targetParentId) {
      const addDeep = (items: BlockItem[]): BlockItem[] => {
        return items.map(item => {
          if (item.id === targetParentId) {
            return { ...item, children: [...(item.children || []), newBlock] };
          }
          if (item.children) {
            return { ...item, children: addDeep(item.children) };
          }
          return item;
        });
      };
      updateBlocksAndCode(addDeep(blocks));
    } else {
      updateBlocksAndCode([...blocks, newBlock]);
    }
  };

  const handleDeleteBlock = (blockId: string) => {
    const deleteDeep = (items: BlockItem[]): BlockItem[] => {
      return items
        .filter(item => item.id !== blockId)
        .map(item => ({
          ...item,
          ...(item.children ? { children: deleteDeep(item.children) } : {})
        }));
    };
    updateBlocksAndCode(deleteDeep(blocks));
  };

  // Move block up or down in workspace list
  const handleMoveBlock = (index: number, direction: 'up' | 'down', parentId?: string) => {
    if (parentId) {
      const moveDeep = (items: BlockItem[]): BlockItem[] => {
        return items.map(item => {
          if (item.id === parentId && item.children) {
            const children = [...item.children];
            const targetIdx = direction === 'up' ? index - 1 : index + 1;
            if (targetIdx < 0 || targetIdx >= children.length) return item;
            const temp = children[index];
            children[index] = children[targetIdx];
            children[targetIdx] = temp;
            return { ...item, children };
          }
          if (item.children) {
            return { ...item, children: moveDeep(item.children) };
          }
          return item;
        });
      };
      updateBlocksAndCode(moveDeep(blocks));
    } else {
      const newBlocks = [...blocks];
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= newBlocks.length) return;
      const temp = newBlocks[index];
      newBlocks[index] = newBlocks[targetIdx];
      newBlocks[targetIdx] = temp;
      updateBlocksAndCode(newBlocks);
    }
  };

  const handleUpdateParam = (blockId: string, paramKey: string, newValue: string) => {
    const updateDeep = (items: BlockItem[]): BlockItem[] => {
      return items.map(item => {
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
    };
    updateBlocksAndCode(updateDeep(blocks));
  };

  const handleToggleCollapse = (blockId: string) => {
    setBlocks(prev => {
      const toggleDeep = (items: BlockItem[]): BlockItem[] => {
        return items.map(item => {
          if (item.id === blockId) {
            return { ...item, collapsed: !item.collapsed };
          }
          if (item.children) {
            return { ...item, children: toggleDeep(item.children) };
          }
          return item;
        });
      };
      return toggleDeep(prev);
    });
  };

  const generatedCode = blocksToCode(blocks);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const filteredPresets = PRESET_BLOCKS.filter(p => {
    if (activeTab === 'all') return true;
    if (activeTab === 'events') return p.type === 'event';
    if (activeTab === 'actions') return p.type === 'action';
    if (activeTab === 'entities') return p.type === 'entity';
    if (activeTab === 'control') return p.type === 'control';
    return true;
  });

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden select-none">
      {/* Palette Sidebar */}
      <div className={clsx(
        "w-full md:w-80 border-b md:border-b-0 md:border-r flex flex-col shrink-0 overflow-hidden",
        isFrutigerAero ? "bg-white/40 border-white/50 backdrop-blur-md" :
        theme !== 'light' ? "bg-zinc-900/90 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
      )}>
        <div className="p-3 sm:p-4 border-b border-zinc-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Layers className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-sm">
              {language === 'ru' ? 'Палитра Блоков' : 'Block Palette'}
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Scratch EPL
          </span>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1 p-2 border-b border-zinc-800/60 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: language === 'ru' ? 'Все' : 'All' },
            { id: 'events', label: 'События' },
            { id: 'actions', label: 'Действия' },
            { id: 'entities', label: 'Объекты' },
            { id: 'control', label: 'Логика' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                "px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                  : "bg-zinc-800/40 text-zinc-400 hover:text-zinc-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Presets List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
          {filteredPresets.map((preset, idx) => {
            let colorClasses = "bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20";
            let badgeBg = "bg-purple-500";
            if (preset.type === 'event') {
              colorClasses = "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20";
              badgeBg = "bg-amber-500";
            } else if (preset.type === 'action') {
              colorClasses = "bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20";
              badgeBg = "bg-blue-500";
            } else if (preset.type === 'entity') {
              colorClasses = "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20";
              badgeBg = "bg-emerald-500";
            }

            return (
              <div
                key={idx}
                onClick={() => handleAddPresetBlock(preset)}
                className={clsx(
                  "p-3 rounded-2xl border transition-all cursor-pointer group hover:scale-[1.02] flex items-center justify-between gap-2 shadow-sm",
                  colorClasses
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={clsx("w-2.5 h-2.5 rounded-full shrink-0", badgeBg)} />
                  <div className="min-w-0">
                    <div className="font-bold text-xs truncate flex items-center gap-1.5">
                      <span>{preset.label}</span>
                    </div>
                    <p className="text-[10px] opacity-70 truncate">{preset.description}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddPresetBlock(preset);
                  }}
                  className="p-1 rounded-lg bg-zinc-800/60 hover:bg-purple-600 text-zinc-300 hover:text-white transition-colors shrink-0 cursor-pointer"
                  title="Добавить блок на холст"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Block Canvas Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className={clsx(
          "p-3 sm:px-6 py-2.5 border-b flex items-center justify-between gap-3 shrink-0",
          isFrutigerAero ? "bg-white/30 border-white/40" :
          theme !== 'light' ? "bg-zinc-900/60 border-zinc-800" : "bg-white border-zinc-200"
        )}>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Zap className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-sm text-zinc-200">
              {language === 'ru' ? 'Холст Блоков EPL' : 'EPL Block Workspace'}
            </h3>
            <span className="text-xs text-zinc-500">
              ({blocks.length} {language === 'ru' ? 'блоков' : 'blocks'})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCodePreview(!showCodePreview)}
              className={clsx(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border",
                showCodePreview 
                  ? "bg-purple-600 text-white border-purple-500/50 shadow-md shadow-purple-600/20" 
                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700/50"
              )}
            >
              <Code2 className="w-3.5 h-3.5 text-blue-400" />
              <span>{showCodePreview ? (language === 'ru' ? 'Скрыть код' : 'Hide Code') : (language === 'ru' ? 'Код EPL' : 'View Code')}</span>
            </button>

            {blocks.length > 0 && (
              <button
                onClick={() => updateBlocksAndCode([])}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors cursor-pointer flex items-center gap-1"
                title="Очистить весь холст"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{language === 'ru' ? 'Очистить' : 'Clear'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Canvas Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 custom-scrollbar relative">
          {blocks.map((block, index) => (
            <RenderBlockCard
              key={block.id}
              block={block}
              index={index}
              totalCount={blocks.length}
              onDelete={handleDeleteBlock}
              onMove={handleMoveBlock}
              onUpdateParam={handleUpdateParam}
              onToggleCollapse={handleToggleCollapse}
              onAddChild={handleAddPresetBlock}
              isFrutigerAero={isFrutigerAero}
              theme={theme}
              language={language}
            />
          ))}

          {blocks.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 border-2 border-dashed rounded-3xl border-zinc-800 text-zinc-500 my-auto">
              <Layers className="w-12 h-12 opacity-30 mb-3 text-purple-400 animate-bounce" />
              <h4 className="font-bold text-base text-zinc-300 mb-1">
                {language === 'ru' ? 'Холст блоков пуст' : 'Workspace is empty'}
              </h4>
              <p className="text-xs max-w-sm opacity-70 mb-4">
                {language === 'ru'
                  ? 'Нажмите на любой блок в левой палитре (События, Действия, Объекты), чтобы добавить его сюда!'
                  : 'Click any block in the left palette to start building your EPL app!'}
              </p>
              <button
                onClick={() => handleAddPresetBlock(PRESET_BLOCKS[0])}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {language === 'ru' ? 'Добавить блок "started?"' : 'Add "started?" Event'}
              </button>
            </div>
          )}
        </div>

        {/* Floating Side-by-Side EPL Code Preview Box */}
        {showCodePreview && (
          <div className="absolute top-14 right-4 z-40 w-80 sm:w-96 rounded-2xl bg-zinc-950/90 border border-purple-500/40 shadow-2xl p-4 backdrop-blur-xl text-xs space-y-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-purple-300">
                <Code2 className="w-4 h-4" />
                <span>{language === 'ru' ? 'Сгенерированный код EPL' : 'Generated EPL Code'}</span>
              </div>
              <button
                onClick={handleCopyCode}
                className="p-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center gap-1 text-[10px] cursor-pointer"
              >
                {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode ? 'Скопировано!' : 'Копировать'}</span>
              </button>
            </div>
            <pre className="p-3 bg-black/60 rounded-xl font-mono text-[11px] leading-relaxed text-emerald-400 overflow-x-auto max-h-64 custom-scrollbar border border-zinc-800">
              {generatedCode || '// Блоки отсутствуют'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

interface RenderBlockCardProps {
  block: BlockItem;
  index: number;
  totalCount: number;
  parentId?: string;
  onDelete: (id: string) => void;
  onMove: (index: number, direction: 'up' | 'down', parentId?: string) => void;
  onUpdateParam: (id: string, key: string, value: string) => void;
  onToggleCollapse: (id: string) => void;
  onAddChild: (preset: typeof PRESET_BLOCKS[0], parentId: string) => void;
  isFrutigerAero: boolean;
  theme: string;
  language: 'en' | 'ru';
}

function RenderBlockCard({
  block,
  index,
  totalCount,
  parentId,
  onDelete,
  onMove,
  onUpdateParam,
  onToggleCollapse,
  onAddChild,
  isFrutigerAero,
  theme,
  language
}: RenderBlockCardProps) {
  let headerBg = "bg-purple-950/40 border-purple-800/60 text-purple-200";
  let badgeBg = "bg-purple-500";

  if (block.type === 'event') {
    headerBg = "bg-amber-950/40 border-amber-800/60 text-amber-200";
    badgeBg = "bg-amber-500";
  } else if (block.type === 'action') {
    headerBg = "bg-blue-950/40 border-blue-800/60 text-blue-200";
    badgeBg = "bg-blue-500";
  } else if (block.type === 'entity') {
    headerBg = "bg-emerald-950/40 border-emerald-800/60 text-emerald-200";
    badgeBg = "bg-emerald-500";
  }

  const paramKeys = Object.keys(block.params);

  return (
    <div className={clsx("rounded-2xl border transition-all shadow-md overflow-hidden", headerBg)}>
      {/* Block Header */}
      <div className="p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex flex-col gap-0.5 shrink-0">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => onMove(index, 'up', parentId)}
              className="p-0.5 rounded hover:bg-zinc-800/60 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Переместить вверх"
            >
              <ArrowUp className="w-3 h-3" />
            </button>
            <button
              type="button"
              disabled={index === totalCount - 1}
              onClick={() => onMove(index, 'down', parentId)}
              className="p-0.5 rounded hover:bg-zinc-800/60 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Переместить вниз"
            >
              <ArrowDown className="w-3 h-3" />
            </button>
          </div>

          <span className={clsx("w-3 h-3 rounded-full shrink-0", badgeBg)} />
          <span className="font-mono font-bold text-xs sm:text-sm text-zinc-100">
            {block.type === 'entity' ? `create ${block.name}` : block.name}
          </span>

          <div className="flex items-center gap-2 flex-wrap">
            {paramKeys.map(key => (
              <div key={key} className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-lg border border-zinc-700/55">
                <span className="text-[10px] text-zinc-400 font-mono">{key}:</span>
                <input
                  type="text"
                  value={block.params[key] || ''}
                  onChange={(e) => onUpdateParam(block.id, key, e.target.value)}
                  className="bg-transparent border-none text-xs font-mono text-emerald-300 focus:outline-none w-20 sm:w-28"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {block.children !== undefined && (
            <button
              type="button"
              onClick={() => onToggleCollapse(block.id)}
              className="p-1 rounded-lg hover:bg-zinc-800/60 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              {block.collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => onDelete(block.id)}
            className="p-1 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
            title="Удалить блок"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Children Container for Event / Control Blocks */}
      {block.children !== undefined && !block.collapsed && (
        <div className="p-3 pt-0 pl-6 sm:pl-8 space-y-2 border-t border-zinc-800/40 bg-black/20">
          {block.children.map((child, childIdx) => (
            <RenderBlockCard
              key={child.id}
              block={child}
              index={childIdx}
              totalCount={block.children!.length}
              parentId={block.id}
              onDelete={onDelete}
              onMove={onMove}
              onUpdateParam={onUpdateParam}
              onToggleCollapse={onToggleCollapse}
              onAddChild={onAddChild}
              isFrutigerAero={isFrutigerAero}
              theme={theme}
              language={language}
            />
          ))}

          {block.children.length === 0 && (
            <div className="p-2 text-center text-[11px] text-zinc-500 italic border border-dashed border-zinc-800/60 rounded-xl">
              {language === 'ru' ? 'Вложите сюда действия из палитры' : 'Drop actions or entities inside here'}
            </div>
          )}

          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={() => onAddChild(PRESET_BLOCKS[5], block.id)}
              className="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
            >
              <Plus className="w-3 h-3" />
              {language === 'ru' ? 'Добавить внутри' : 'Add inside'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
