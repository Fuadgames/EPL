import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X, Cpu, Play, Plus, Search, Sparkles, CheckCircle2,
  AlertTriangle, Box, Gamepad2, LayoutDashboard, Code2, Eye, Layers,
  BookOpen, Check, Ban, Move, Trash2, ChevronDown
} from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from '../store/useStore';
import CustomSelect from './CustomSelect';
import DifrenoptViewport, { type VisualPatchEvent } from './DifrenoptViewport';
import {
  DRPL_COMPONENTS,
  DRPL_COMPONENT_COLOR_MAP,
  DRPL_TEMPLATES,
  type DrplCategory,
  type DrplComponentDef,
  type DrplTemplateDef
} from '../lib/drpl-catalog';
import { transpileDRPL } from '../lib/drpl-engine';

interface DifrenoptConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialParams?: Record<string, string>;
  initialDrplCode?: string;
  onApply: (params: Record<string, string>, drplCode: string) => void;
}

const DEFAULT_PARAMS: Record<string, string> = {
  name: 'engine',
  mode: '3d',
  quality: 'ultra',
  fps: '60',
  shadows: 'true',
  bloom: 'true',
  instancing: 'true',
  culling: 'true'
};

const DRPL_KEYWORDS = new Set([
  'class', 'struct', 'interface', 'extends', 'implements', 'def', 'fn', 'func', 'function',
  'void', 'int', 'float', 'double', 'bool', 'string', 'let', 'const', 'var', 'if', 'elif',
  'else', 'for', 'in', 'range', 'while', 'repeat', 'return', 'public', 'private', 'protected',
  'internal', 'static', 'final', 'readonly', 'virtual', 'override', 'abstract', 'new', 'this',
  'self', 'switch', 'case', 'break', 'continue', 'import', 'package', 'using', 'namespace', 'include'
]);

const DRPL_BOOLEANS = new Set(['true', 'false', 'True', 'False', 'null', 'None', 'undefined']);

const DRPL_HELPERS = new Set([
  'setUI', 'getUI', 'pushChart', 'logTerminal', 'setVar', 'getVar', 'getProp', 'get2D',
  'shake', 'playSfx', 'distance3d', 'lerp', 'clamp', 'rand', 'randInt', 'print', 'println',
  'vec2', 'vec3', 'emit', 'onEvent', 'difrenopt', 'create', 'Math', 'Console', 'System'
]);

const DRPL_HOOKS = new Set([
  'started?', 'frame?', 'update?', 'render?', 'clicked?', 'key_pressed?', 'timer_tick?', 'collided?', 'end'
]);

const DRPL_TOKEN_RE = /(\/\/.*$|#.*$|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b(?:started|frame|update|render|clicked|key_pressed|timer_tick|collided)\?|\b\d+(?:\.\d+)?\b|\b[a-zA-Z_][a-zA-Z0-9_]*\b)/gm;

function renderHighlightedDrplLine(line: string, lineIdx: number): React.ReactNode {
  if (!line) return '\u00A0';
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  DRPL_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  let tokIdx = 0;

  while ((match = DRPL_TOKEN_RE.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(line.slice(lastIndex, match.index));
    }
    const token = match[0];
    const afterChar = line.slice(match.index + token.length).match(/^\s*(=?)/)?.[1];
    let style: React.CSSProperties | undefined;

    if (token.startsWith('//') || token.startsWith('#')) {
      style = { color: '#6B7280', fontStyle: 'italic' };
    } else if (token.startsWith('"') || token.startsWith("'")) {
      style = { color: '#FDBA74' };
    } else if (/^\d/.test(token)) {
      style = { color: '#38BDF8' };
    } else if (DRPL_HOOKS.has(token)) {
      style = { color: '#FBBF24', fontWeight: 700 };
    } else if (DRPL_COMPONENT_COLOR_MAP[token]) {
      style = { color: DRPL_COMPONENT_COLOR_MAP[token], fontWeight: 700 };
    } else if (DRPL_KEYWORDS.has(token)) {
      style = { color: '#C084FC', fontWeight: 600 };
    } else if (DRPL_BOOLEANS.has(token)) {
      style = { color: '#F472B6', fontWeight: 600 };
    } else if (DRPL_HELPERS.has(token)) {
      style = { color: '#2DD4BF', fontWeight: 600 };
    } else if (afterChar === '=' && !line.slice(match.index + token.length).trimStart().startsWith('==')) {
      style = { color: '#93C5FD' };
    }

    if (style) {
      nodes.push(
        <span key={`${lineIdx}_${tokIdx++}`} style={style}>
          {token}
        </span>
      );
    } else {
      nodes.push(token);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < line.length) {
    nodes.push(line.slice(lastIndex));
  }
  return nodes;
}

function serializeDrplVal(val: any): string {
  if (typeof val === 'number') return String(Number(val.toFixed(2)));
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return `"${String(val).replace(/"/g, '\\"')}"`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patchDrplSource(source: string, patch: VisualPatchEvent): string {
  const escapedName = escapeRegExp(patch.name);
  const nameAttrRe = new RegExp(`\\bname\\s*=\\s*["']${escapedName}["']`);

  if (patch.type === 'add') {
    const trimmed = source.trimEnd();
    const needsUse3d = patch.mode === '3d' && !/\buse3d\s*\(/.test(trimmed);
    const needsUse2d = patch.mode === '2d' && !/\buse2d\s*\(/.test(trimmed);
    const propsList = [
      `name=${serializeDrplVal(patch.name)}`,
      ...Object.entries(patch.props).map(([k, v]) => `${k}=${serializeDrplVal(v)}`)
    ];
    const newCall = `${patch.kind}(${propsList.join(', ')})`;
    const prefix = needsUse3d
      ? 'use3d(lighting="studio", bloom=1.0, shadows=true)\n'
      : needsUse2d
        ? 'use2d(bg="#060913", gravity=960, lighting=true)\n'
        : '';
    if (!trimmed) return `${prefix}${newCall}`;
    return `${trimmed}\n${prefix}${newCall}`;
  }

  const lines = source.split('\n');
  const lineIdx = lines.findIndex(ln => nameAttrRe.test(ln));
  if (lineIdx === -1) {
    if (patch.type === 'update') {
      const propsList = [
        `name=${serializeDrplVal(patch.name)}`,
        ...Object.entries(patch.props).map(([k, v]) => `${k}=${serializeDrplVal(v)}`)
      ];
      return source.trimEnd() ? `${source.trimEnd()}\n${patch.kind}(${propsList.join(', ')})` : `${patch.kind}(${propsList.join(', ')})`;
    }
    return source;
  }

  if (patch.type === 'delete') {
    lines.splice(lineIdx, 1);
    return lines.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  // patch.type === 'update'
  let line = lines[lineIdx];
  for (const [k, v] of Object.entries(patch.props)) {
    const formatted = serializeDrplVal(v);
    const kvRe = new RegExp(`(\\b${escapeRegExp(k)}\\s*=\\s*)("[^"]*"|'[^']*'|[^,\\s)]+)`);
    if (kvRe.test(line)) {
      line = line.replace(kvRe, `$1${formatted}`);
    } else {
      const closeIdx = line.lastIndexOf(')');
      if (closeIdx !== -1) {
        const before = line.slice(0, closeIdx).trimEnd();
        const sep = before.endsWith('(') ? '' : ', ';
        line = `${before}${sep}${k}=${formatted}${line.slice(closeIdx)}`;
      }
    }
  }
  lines[lineIdx] = line;
  return lines.join('\n');
}

export default function DifrenoptConfigModal({
  isOpen,
  onClose,
  initialParams,
  initialDrplCode,
  onApply
}: DifrenoptConfigModalProps) {
  const theme = useStore(state => state.theme);
  const language = useStore(state => state.language);
  const isLight = theme === 'light';

  const [params, setParams] = useState<Record<string, string>>({
    ...DEFAULT_PARAMS,
    ...(initialParams || {})
  });
  const [drplCode, setDrplCode] = useState<string>(
    initialDrplCode?.trim() ? initialDrplCode : ''
  );
  const [categoryFilter, setCategoryFilter] = useState<'all' | DrplCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [activeView, setActiveView] = useState<'studio' | 'guide'>('studio');
  const [isVisualEdit, setIsVisualEdit] = useState(false);
  const [showExamplePicker, setShowExamplePicker] = useState(false);
  const [exampleCategory, setExampleCategory] = useState<'all' | '3d' | '2d' | 'app'>('all');

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterInnerRef = useRef<HTMLDivElement>(null);
  const examplePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setParams({ ...DEFAULT_PARAMS, ...(initialParams || {}) });
      setDrplCode(initialDrplCode?.trim() ? initialDrplCode : '');
      setIsVisualEdit(false);
      setShowExamplePicker(false);
      setPreviewRevision(r => r + 1);
    }
  }, [isOpen, initialParams, initialDrplCode]);

  useEffect(() => {
    if (!showExamplePicker) return;
    const onDocDown = (e: MouseEvent) => {
      if (examplePickerRef.current && !examplePickerRef.current.contains(e.target as Node)) {
        setShowExamplePicker(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [showExamplePicker]);

  const transpileResult = useMemo(() => transpileDRPL(drplCode), [drplCode]);
  const errorCount = transpileResult.diagnostics.filter(d => d.severity === 'error').length;
  const warningCount = transpileResult.diagnostics.filter(d => d.severity === 'warning').length;
  const codeLines = useMemo(() => drplCode.split('\n'), [drplCode]);
  const lineCount = Math.max(18, codeLines.length);

  const highlightedCodeLines = useMemo(
    () => codeLines.map((line, idx) => (
      <div key={idx} className="leading-6 h-6">
        {renderHighlightedDrplLine(line, idx)}
      </div>
    )),
    [codeLines]
  );

  const filteredComponents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return DRPL_COMPONENTS.filter(c => {
      if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.signature.toLowerCase().includes(q) ||
        c.roleRu.toLowerCase().includes(q) ||
        c.roleEn.toLowerCase().includes(q) ||
        c.descriptionRu.toLowerCase().includes(q) ||
        c.descriptionEn.toLowerCase().includes(q)
      );
    });
  }, [categoryFilter, searchQuery]);

  const insertSnippet = (snippet: string) => {
    const el = editorRef.current;
    if (!el) {
      setDrplCode(prev => (prev.trim() ? `${prev.trimEnd()}\n${snippet}` : snippet));
      return;
    }
    const start = el.selectionStart ?? drplCode.length;
    const end = el.selectionEnd ?? start;
    const before = drplCode.slice(0, start);
    const after = drplCode.slice(end);
    const needLeadingNewline = before.length > 0 && !before.endsWith('\n');
    const needTrailingNewline = after.length > 0 && !after.startsWith('\n');
    const insertion = `${needLeadingNewline ? '\n' : ''}${snippet}${needTrailingNewline ? '\n' : ''}`;
    const nextCode = before + insertion + after;
    setDrplCode(nextCode);

    requestAnimationFrame(() => {
      el.focus();
      const cursor = before.length + insertion.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const applyTemplate = (tpl: DrplTemplateDef) => {
    setParams({ ...DEFAULT_PARAMS, ...tpl.headerParams });
    setDrplCode(tpl.drplCode);
    setShowExamplePicker(false);
    setActiveView('studio');
    setShowLivePreview(true);
    setPreviewRevision(r => r + 1);
  };

  const handleVisualPatch = (patch: VisualPatchEvent) => {
    setDrplCode(prev => {
      if (patch.type === 'add' && !prev.trim()) {
        setParams(p => ({ ...p, mode: patch.mode }));
      }
      return patchDrplSource(prev, patch);
    });
  };

  const handleEditorScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = scrollTop;
      highlightRef.current.scrollLeft = scrollLeft;
    }
    if (gutterInnerRef.current) {
      gutterInnerRef.current.style.transform = `translateY(-${scrollTop}px)`;
    }
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = drplCode.slice(0, start) + '  ' + drplCode.slice(end);
      setDrplCode(next);
      requestAnimationFrame(() => {
        el.setSelectionRange(start + 2, start + 2);
      });
    }
  };

  const toggleFlag = (key: 'shadows' | 'bloom' | 'instancing' | 'culling') => {
    const current = String(params[key] ?? 'true').toLowerCase() !== 'false';
    setParams(prev => ({ ...prev, [key]: current ? 'false' : 'true' }));
  };

  if (!isOpen) return null;

  const previewEntity = {
    id: 'difrenopt_studio_preview',
    type: 'difrenopt',
    name: params.name || 'engine',
    mode: params.mode || '3d',
    quality: params.quality || 'ultra',
    fps: Number(params.fps || 60),
    shadows: params.shadows !== 'false',
    bloom: params.bloom !== 'false',
    instancing: params.instancing !== 'false',
    culling: params.culling !== 'false',
    drplCode
  };

  const categoryCounts = {
    all: DRPL_COMPONENTS.length,
    '3d': DRPL_COMPONENTS.filter(c => c.category === '3d').length,
    '2d': DRPL_COMPONENTS.filter(c => c.category === '2d').length,
    app: DRPL_COMPONENTS.filter(c => c.category === 'app').length
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/75 p-2 sm:p-4">
      <div
        onClick={e => e.stopPropagation()}
        className={clsx(
          'w-full max-w-[1440px] h-[94vh] rounded-2xl border flex flex-col overflow-hidden shadow-2xl',
          isLight
            ? 'bg-white border-[#E2E5EA] text-[#111315]'
            : 'bg-[#111315] border-[#262B33] text-[#F3F4F6]'
        )}
      >
        {/* Top Studio Header */}
        <div
          className={clsx(
            'px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0',
            isLight ? 'bg-[#F8FAFC] border-[#E2E5EA]' : 'bg-[#181B20] border-[#262B33]'
          )}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#10B981]/15 border border-[#10B981]/35 text-[#10B981]">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  difrenopt Studio <span className="text-[#10B981] font-mono text-sm">DRPL v2</span>
                </h2>
              </div>
              <p className={clsx('text-xs', isLight ? 'text-slate-500' : 'text-[#9CA3AF]')}>
                {language === 'ru'
                  ? 'Difficult Render Optimizing & DRPL (Python + C# + C++ + JS + EPL)'
                  : 'Difficult Render Optimizing Engine & Hybrid DRPL IDE'}
              </p>
            </div>
          </div>

          {/* Clean Action Bar: Add an example + Edit Visual + Guide + Preview */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Categorized Add an example Picker */}
            <div className="relative" ref={examplePickerRef}>
              <button
                type="button"
                onClick={() => setShowExamplePicker(v => !v)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors',
                  showExamplePicker
                    ? 'bg-[#10B981]/15 border-[#10B981]/50 text-[#10B981]'
                    : isLight
                      ? 'bg-white hover:bg-emerald-50 border-[#E2E5EA] text-slate-700'
                      : 'bg-[#111315] hover:bg-[#1E222A] border-[#262B33] text-[#E5E7EB]'
                )}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#10B981]" />
                <span>{language === 'ru' ? 'Добавить пример' : 'Add an example'}</span>
                <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', showExamplePicker && 'rotate-180')} />
              </button>

              {showExamplePicker && (
                <div
                  className={clsx(
                    'absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border shadow-2xl z-50 p-3 space-y-2.5',
                    isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#16191E] border-[#262B33]'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#10B981]">
                      {language === 'ru' ? 'Готовые заготовки DRPL' : 'Ready DRPL Templates'}
                    </span>
                    <div className="flex items-center gap-1">
                      {(['all', '3d', '2d', 'app'] as const).map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setExampleCategory(cat)}
                          className={clsx(
                            'px-2 py-0.5 rounded text-[10px] font-mono uppercase cursor-pointer',
                            exampleCategory === cat
                              ? 'bg-[#10B981] text-[#0A0C0E] font-bold'
                              : isLight
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-[#0A0C0E] text-[#9CA3AF]'
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-1.5 custom-scrollbar">
                    {DRPL_TEMPLATES.filter(t => exampleCategory === 'all' || t.category === exampleCategory).map(tpl => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className={clsx(
                          'w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer space-y-1',
                          isLight
                            ? 'bg-slate-50 hover:bg-emerald-50 border-[#E2E5EA] hover:border-emerald-400'
                            : 'bg-[#111315] hover:bg-[#10B981]/10 border-[#262B33] hover:border-[#10B981]/50'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#F3F4F6] flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-[#10B981]" />
                            <span className={isLight ? 'text-slate-900' : 'text-[#F3F4F6]'}>
                              {language === 'ru' ? tpl.nameRu : tpl.nameEn}
                            </span>
                          </span>
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#10B981]/15 text-[#10B981]">
                            {tpl.category}
                          </span>
                        </div>
                        <div className={clsx('text-[11px] leading-snug', isLight ? 'text-slate-600' : 'text-[#9CA3AF]')}>
                          {language === 'ru' ? tpl.descriptionRu : tpl.descriptionEn}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {drplCode.trim() && (
              <button
                type="button"
                onClick={() => {
                  setDrplCode('');
                  setIsVisualEdit(false);
                }}
                className={clsx(
                  'p-1.5 rounded-lg border text-xs cursor-pointer transition-colors',
                  isLight
                    ? 'bg-white hover:bg-red-50 border-[#E2E5EA] text-slate-500 hover:text-red-500'
                    : 'bg-[#111315] hover:bg-red-500/15 border-[#262B33] text-[#9CA3AF] hover:text-red-400'
                )}
                title={language === 'ru' ? 'Очистить код' : 'Clear code'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Edit Visual Scene Toggle */}
            <button
              type="button"
              onClick={() => {
                setIsVisualEdit(prev => {
                  const next = !prev;
                  if (next) {
                    setActiveView('studio');
                    setShowLivePreview(true);
                  }
                  return next;
                });
              }}
              className={clsx(
                'px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors',
                isVisualEdit
                  ? 'bg-[#10B981] border-[#10B981] text-[#0A0C0E] shadow-md'
                  : isLight
                    ? 'bg-white hover:bg-slate-50 border-[#E2E5EA] text-slate-700'
                    : 'bg-[#111315] hover:bg-[#1E222A] border-[#262B33] text-[#D1D5DB]'
              )}
            >
              <Move className="w-3.5 h-3.5" />
              <span>{language === 'ru' ? 'Edit Visual' : 'Edit Visual'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView(v => (v === 'guide' ? 'studio' : 'guide'))}
              className={clsx(
                'px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors',
                activeView === 'guide'
                  ? 'bg-sky-500/15 border-sky-400/50 text-sky-400'
                  : isLight
                    ? 'bg-white hover:bg-slate-50 border-[#E2E5EA] text-slate-700'
                    : 'bg-[#111315] hover:bg-[#1E222A] border-[#262B33] text-[#D1D5DB]'
              )}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>
                {activeView === 'guide'
                  ? language === 'ru' ? 'Назад в редактор' : 'Back to Editor'
                  : language === 'ru' ? 'Гайд DRPL' : 'DRPL Guide'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveView('studio');
                setShowLivePreview(v => !v);
              }}
              className={clsx(
                'px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors',
                showLivePreview && activeView === 'studio'
                  ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981]'
                  : isLight
                    ? 'bg-white border-[#E2E5EA] text-slate-600'
                    : 'bg-[#111315] border-[#262B33] text-[#9CA3AF]'
              )}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{language === 'ru' ? 'Предпросмотр' : 'Live Stage'}</span>
            </button>

            <button
              type="button"
              onClick={() => setPreviewRevision(r => r + 1)}
              className={clsx(
                'px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors',
                isLight
                  ? 'bg-white hover:bg-slate-50 border-[#E2E5EA] text-slate-700'
                  : 'bg-[#21252C] hover:bg-[#2A2F38] border-[#262B33] text-[#E5E7EB]'
              )}
            >
              <Play className="w-3.5 h-3.5 text-[#10B981]" />
              <span>{language === 'ru' ? 'Перезапуск' : 'Reload'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onApply(params, drplCode);
                onClose();
              }}
              className="px-4 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E] text-xs font-bold cursor-pointer transition-colors"
            >
              {language === 'ru' ? 'Сохранить в проект' : 'Apply to Project'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className={clsx(
                'p-1.5 rounded-lg transition-colors cursor-pointer',
                isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-[#262B33] text-[#9CA3AF]'
              )}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Optimizer Configuration Strip (Zero native <select>) */}
        <div
          className={clsx(
            'px-4 py-2.5 border-b flex flex-wrap items-center gap-3 text-xs shrink-0',
            isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#14171C] border-[#262B33]'
          )}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[#9CA3AF] font-medium">Name:</span>
            <input
              type="text"
              value={params.name || 'engine'}
              onChange={e => setParams(prev => ({ ...prev, name: e.target.value }))}
              className={clsx(
                'w-28 px-2 py-1 rounded-md border font-mono text-xs focus:outline-none focus:border-[#10B981]',
                isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#0A0C0E] border-[#262B33] text-[#10B981]'
              )}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[#9CA3AF] font-medium">Mode:</span>
            <CustomSelect
              size="sm"
              value={params.mode || '3d'}
              onChange={v => setParams(prev => ({ ...prev, mode: v }))}
              options={[
                { value: '3d', label: '3D PBR Engine' },
                { value: '2d', label: '2D HiDPI Engine' },
                { value: 'app', label: 'Pro App Studio' },
                { value: 'hybrid', label: 'Hybrid 3D + 2D' }
              ]}
              className="w-36"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[#9CA3AF] font-medium">Quality:</span>
            <CustomSelect
              size="sm"
              value={params.quality || 'ultra'}
              onChange={v => setParams(prev => ({ ...prev, quality: v }))}
              options={[
                { value: 'ultra', label: 'Ultra' },
                { value: 'high', label: 'High' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'perf', label: 'Performance' }
              ]}
              className="w-32"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[#9CA3AF] font-medium">FPS:</span>
            <CustomSelect
              size="sm"
              value={String(params.fps || '60')}
              onChange={v => setParams(prev => ({ ...prev, fps: v }))}
              options={[
                { value: '60', label: '60 FPS' },
                { value: '120', label: '120 FPS' },
                { value: '30', label: '30 FPS' }
              ]}
              className="w-24"
            />
          </div>

          <div className="h-4 w-px bg-[#262B33] hidden sm:block" />

          {/* Optimizer Pipeline Toggles */}
          {(['shadows', 'bloom', 'instancing', 'culling'] as const).map(flag => {
            const active = String(params[flag] ?? 'true').toLowerCase() !== 'false';
            return (
              <button
                key={flag}
                type="button"
                onClick={() => toggleFlag(flag)}
                className={clsx(
                  'px-2.5 py-1 rounded-md border font-mono text-[11px] font-semibold transition-colors cursor-pointer capitalize',
                  active
                    ? 'bg-[#10B981]/15 border-[#10B981]/45 text-[#10B981]'
                    : isLight
                      ? 'bg-slate-100 border-slate-200 text-slate-400'
                      : 'bg-[#111315] border-[#262B33] text-[#6B7280]'
                )}
              >
                {flag}: {active ? 'ON' : 'OFF'}
              </button>
            );
          })}
        </div>

        {/* Main Workspace: Full Interactive DRPL Guide OR 3-Column IDE Studio */}
        {activeView === 'guide' ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
            {/* Guide Overview & Syntax Cheatsheet */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div
                className={clsx(
                  'p-4 rounded-xl border space-y-2.5',
                  isLight ? 'bg-[#F8FAFC] border-[#E2E5EA]' : 'bg-[#16191E] border-[#262B33]'
                )}
              >
                <div className="text-xs font-bold uppercase tracking-wider text-[#10B981]">
                  {language === 'ru' ? '1. Как работает DRPL' : '1. How DRPL Works'}
                </div>
                <p className={clsx('text-xs leading-relaxed', isLight ? 'text-slate-600' : 'text-[#9CA3AF]')}>
                  {language === 'ru'
                    ? 'Код пишется внутри блока difrenopt {mode=3d, quality=ultra} ... end. Язык объединяет Python (def, for i in range), C#/C++/Java (int, float, bool, class), JS (let, Math) и EPL-хуки (started?, frame?, clicked?, key_pressed?, end).'
                    : 'DRPL runs inside difrenopt {mode=3d, quality=ultra} ... end blocks. Combine Python (def, for i in range), C#/C++/Java (int, float, bool, class), JS (let, Math), and EPL hooks (started?, frame?, clicked?, key_pressed?, end).'}
                </p>
                <pre
                  className={clsx(
                    'text-[11px] font-mono p-2.5 rounded-lg border overflow-x-auto',
                    isLight ? 'bg-white border-[#E2E5EA] text-slate-800' : 'bg-[#0A0C0E] border-[#22262E] text-emerald-300'
                  )}
                >{`use3d(lighting="studio", bloom=1.2)
car3d(name="racer", color="#10b981")
ui_gauge(id="spd", label="KM/H", value=0)
frame?
  setUI("spd", "value", 88)
end`}</pre>
              </div>

              <div
                className={clsx(
                  'p-4 rounded-xl border space-y-2.5',
                  isLight ? 'bg-[#F8FAFC] border-[#E2E5EA]' : 'bg-[#16191E] border-[#262B33]'
                )}
              >
                <div className="text-xs font-bold uppercase tracking-wider text-sky-400">
                  {language === 'ru' ? '2. Матрица совместимости' : '2. Compatibility Matrix'}
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                    <div className="font-semibold text-emerald-400">3D: use3d + *3d</div>
                    <div className={clsx('text-[11px] mt-0.5', isLight ? 'text-slate-700' : 'text-[#D1D5DB]')}>
                      {language === 'ru'
                        ? 'Можно: все *3d + любые ui_* + sfx2d. Нельзя: use2d, player2d, tilemap2d.'
                        : 'Compatible: all *3d + ui_* HUD + sfx2d. Avoid mixing with *2d world nodes.'}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg border border-teal-500/30 bg-teal-500/10">
                    <div className="font-semibold text-teal-400">2D: use2d + *2d</div>
                    <div className={clsx('text-[11px] mt-0.5', isLight ? 'text-slate-700' : 'text-[#D1D5DB]')}>
                      {language === 'ru'
                        ? 'Можно: все *2d + любые ui_* + sfx2d. Нельзя: use3d, car3d, mecha3d.'
                        : 'Compatible: all *2d + ui_* HUD + sfx2d. Avoid mixing with *3d nodes.'}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10">
                    <div className="font-semibold text-indigo-400">App UI: useapp + ui_*</div>
                    <div className={clsx('text-[11px] mt-0.5', isLight ? 'text-slate-700' : 'text-[#D1D5DB]')}>
                      {language === 'ru'
                        ? 'Универсальны! ui_* и sfx2d работают и отдельно, и поверх 3D и 2D игр.'
                        : 'Universal HUD & audio! ui_* widgets and sfx2d run standalone or over 3D/2D.'}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={clsx(
                  'p-4 rounded-xl border space-y-2.5',
                  isLight ? 'bg-[#F8FAFC] border-[#E2E5EA]' : 'bg-[#16191E] border-[#262B33]'
                )}
              >
                <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  {language === 'ru' ? '3. Живые функции-помощники' : '3. Live Runtime Helpers'}
                </div>
                <div className="grid grid-cols-1 gap-1.5 text-[11px] font-mono">
                  <div className={clsx('px-2 py-1 rounded border', isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#0A0C0E] border-[#22262E]')}>
                    <span className="text-emerald-400">setUI(id, prop, val)</span> — {language === 'ru' ? 'обновить виджет' : 'update HUD widget'}
                  </div>
                  <div className={clsx('px-2 py-1 rounded border', isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#0A0C0E] border-[#22262E]')}>
                    <span className="text-sky-400">pushChart(id, val, max)</span> — {language === 'ru' ? 'точка на график' : 'stream chart point'}
                  </div>
                  <div className={clsx('px-2 py-1 rounded border', isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#0A0C0E] border-[#22262E]')}>
                    <span className="text-violet-400">move3d / rotate3d / move2d</span> — {language === 'ru' ? 'движение' : 'move entity'}
                  </div>
                  <div className={clsx('px-2 py-1 rounded border', isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#0A0C0E] border-[#22262E]')}>
                    <span className="text-amber-400">getProp / get2D / logTerminal</span> — {language === 'ru' ? 'чтение/логи' : 'read state/log'}
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Strip inside Guide */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#10B981]" />
                <span>
                  {language === 'ru'
                    ? `Справочник всех ${DRPL_COMPONENTS.length} компонентов (цвета, роли, совместимость)`
                    : `Complete ${DRPL_COMPONENTS.length}-Component Reference (Colors, Roles & Rules)`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={language === 'ru' ? 'Фильтр по названию или роли...' : 'Filter by name or role...'}
                    className={clsx(
                      'pl-8 pr-3 py-1.5 rounded-lg border text-xs w-56 focus:outline-none focus:border-[#10B981]',
                      isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#0A0C0E] border-[#262B33] text-[#E5E7EB]'
                    )}
                  />
                </div>
                {(['all', '3d', '2d', 'app'] as const).map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold uppercase cursor-pointer transition-colors',
                      categoryFilter === cat
                        ? 'bg-[#10B981] text-[#0A0C0E]'
                        : isLight
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-[#16191E] border border-[#262B33] text-[#9CA3AF]'
                    )}
                  >
                    {cat} ({categoryCounts[cat]})
                  </button>
                ))}
              </div>
            </div>

            {/* Full Color-Coded Component Directory Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredComponents.map((comp: DrplComponentDef) => (
                <div
                  key={comp.id}
                  style={{ borderColor: `${comp.color}55` }}
                  className={clsx(
                    'p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 transition-colors',
                    isLight ? 'bg-white' : 'bg-[#14171C]'
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-sm shrink-0 border border-white/20"
                          style={{ backgroundColor: comp.color }}
                        />
                        <span className="font-mono font-bold text-sm truncate" style={{ color: comp.color }}>
                          {comp.name}
                        </span>
                        <span
                          className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border"
                          style={{
                            color: comp.color,
                            borderColor: `${comp.color}40`,
                            backgroundColor: `${comp.color}18`
                          }}
                        >
                          {comp.category}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          insertSnippet(comp.snippet);
                          setActiveView('studio');
                        }}
                        style={{
                          color: comp.color,
                          borderColor: `${comp.color}50`,
                          backgroundColor: `${comp.color}1A`
                        }}
                        className="px-2 py-1 rounded-md border text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0 hover:brightness-110"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{language === 'ru' ? 'В код' : 'Insert'}</span>
                      </button>
                    </div>

                    <div className={clsx('text-xs leading-snug', isLight ? 'text-slate-700' : 'text-[#E5E7EB]')}>
                      {language === 'ru' ? comp.roleRu : comp.roleEn}
                    </div>

                    <div
                      className={clsx(
                        'font-mono text-[10px] px-2 py-1 rounded border truncate',
                        isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-[#0A0C0E] border-[#22262E] text-sky-300'
                      )}
                      title={comp.signature}
                    >
                      {comp.signature}
                    </div>
                  </div>

                  <div className="space-y-1 pt-1 border-t border-[#262B33]/60 text-[11px]">
                    <div className="flex items-start gap-1.5 text-emerald-400">
                      <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span className={clsx(isLight ? 'text-slate-600' : 'text-[#9CA3AF]')}>
                        <strong className="text-emerald-400">
                          {language === 'ru' ? 'Можно с: ' : 'Compatible: '}
                        </strong>
                        {comp.compatibleWith.join(', ')}
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5 text-rose-400">
                      <Ban className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span className={clsx(isLight ? 'text-slate-600' : 'text-[#9CA3AF]')}>
                        <strong className="text-rose-400">
                          {language === 'ru' ? 'Нельзя с: ' : 'Avoid: '}
                        </strong>
                        {comp.incompatibleWith.join(', ')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT: Massive DRPL Component Library (48 Components, Each Colorized) */}
          <div
            className={clsx(
              'w-full lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r flex flex-col shrink-0 h-60 lg:h-auto overflow-hidden',
              isLight ? 'bg-[#F8FAFC] border-[#E2E5EA]' : 'bg-[#16191E] border-[#262B33]'
            )}
          >
            <div className="p-3 border-b border-[#262B33]/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>
                    {language === 'ru'
                      ? `Компоненты DRPL (${DRPL_COMPONENTS.length})`
                      : `DRPL Components (${DRPL_COMPONENTS.length})`}
                  </span>
                </span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={language === 'ru' ? 'Поиск компонента...' : 'Search components...'}
                  className={clsx(
                    'w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs focus:outline-none focus:border-[#10B981]',
                    isLight
                      ? 'bg-white border-[#E2E5EA] text-slate-900'
                      : 'bg-[#0A0C0E] border-[#262B33] text-[#E5E7EB]'
                  )}
                />
              </div>

              <div className="grid grid-cols-4 gap-1">
                {[
                  { id: 'all', label: `All (${categoryCounts.all})`, icon: Layers },
                  { id: '3d', label: `3D (${categoryCounts['3d']})`, icon: Box },
                  { id: '2d', label: `2D (${categoryCounts['2d']})`, icon: Gamepad2 },
                  { id: 'app', label: `App (${categoryCounts.app})`, icon: LayoutDashboard }
                ].map(tab => {
                  const Icon = tab.icon;
                  const active = categoryFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCategoryFilter(tab.id as any)}
                      className={clsx(
                        'px-1.5 py-1.5 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors',
                        active
                          ? 'bg-[#10B981] text-[#0A0C0E]'
                          : isLight
                            ? 'bg-white border border-[#E2E5EA] text-slate-600 hover:text-slate-900'
                            : 'bg-[#111315] border border-[#262B33] text-[#9CA3AF] hover:text-white'
                      )}
                    >
                      <Icon className="w-3 h-3 shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
              {filteredComponents.map((comp: DrplComponentDef) => (
                <div
                  key={comp.id}
                  style={{ borderColor: `${comp.color}48` }}
                  className={clsx(
                    'p-2.5 rounded-xl border transition-colors group',
                    isLight
                      ? 'bg-white hover:bg-slate-50'
                      : 'bg-[#111315] hover:bg-[#161B22]'
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: comp.color }}
                      />
                      <span
                        className="font-mono font-bold text-xs truncate"
                        style={{ color: comp.color }}
                      >
                        {comp.name}
                      </span>
                      {comp.badge && (
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                          style={{
                            color: comp.color,
                            borderColor: `${comp.color}38`,
                            backgroundColor: `${comp.color}16`
                          }}
                        >
                          {comp.badge}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => insertSnippet(comp.snippet)}
                      style={{
                        color: comp.color,
                        backgroundColor: `${comp.color}1A`,
                        borderColor: `${comp.color}40`
                      }}
                      className="px-2 py-1 rounded-md border text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 hover:brightness-125"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{language === 'ru' ? 'Вставить' : 'Insert'}</span>
                    </button>
                  </div>
                  <div
                    className={clsx(
                      'text-[11px] leading-snug mb-1.5',
                      isLight ? 'text-slate-600' : 'text-[#9CA3AF]'
                    )}
                  >
                    {language === 'ru' ? comp.roleRu : comp.roleEn}
                  </div>
                  <div
                    className={clsx(
                      'font-mono text-[10px] px-2 py-1 rounded border truncate',
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-700'
                        : 'bg-[#0A0C0E] border-[#22262E] text-sky-300'
                    )}
                    title={comp.signature}
                  >
                    {comp.signature}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CENTER: DRPL Hybrid Code Editor */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Syntax Strip */}
            <div
              className={clsx(
                'px-3 py-2 border-b flex items-center justify-between gap-2 text-[11px] shrink-0 overflow-x-auto no-scrollbar',
                isLight ? 'bg-slate-50 border-[#E2E5EA] text-slate-600' : 'bg-[#0E1013] border-[#262B33] text-[#9CA3AF]'
              )}
            >
              <div className="flex items-center gap-2 whitespace-nowrap font-mono">
                <Code2 className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Syntax:</span>
                <span className="text-sky-400">let / int / float / bool / vec3</span>
                <span>•</span>
                <span className="text-violet-400">def / fn / class / for i in range(n)</span>
                <span>•</span>
                <span className="text-amber-400">started? / frame? / key_pressed? / end</span>
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap">
                {warningCount > 0 && (
                  <span className="flex items-center gap-1 text-amber-300 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{warningCount} Hint(s)</span>
                  </span>
                )}
                {errorCount === 0 ? (
                  <span className="flex items-center gap-1 text-[#10B981] font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>DRPL OK</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-400 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{errorCount} Error(s)</span>
                  </span>
                )}
              </div>
            </div>

            {/* Editor Area: Synced Line Gutter + Multi-Color Syntax Highlight Overlay + Transparent Textarea */}
            <div className="flex-1 min-h-0 flex overflow-hidden relative bg-[#0A0C0E]">
              <div className="w-12 text-right font-mono text-xs leading-6 text-[#4B5563] select-none border-r border-[#1F242B] bg-[#0D1014] overflow-hidden shrink-0">
                <div ref={gutterInnerRef} className="py-3 pr-2.5 will-change-transform">
                  {Array.from({ length: lineCount }).map((_, idx) => (
                    <div key={idx} className="h-6 leading-6">
                      {idx + 1}
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative flex-1 min-w-0 h-full overflow-hidden">
                <pre
                  ref={highlightRef}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 m-0 p-3 font-mono text-xs leading-6 whitespace-pre overflow-hidden text-[#E5E7EB]"
                  style={{ tabSize: 2 }}
                >
                  {drplCode ? (
                    highlightedCodeLines
                  ) : (
                    <span className="text-[#4B5563]">
                      {'// Write DRPL code (Python + Java + C# + C++ + JS + EPL)...'}
                    </span>
                  )}
                </pre>
                <textarea
                  ref={editorRef}
                  value={drplCode}
                  onChange={e => setDrplCode(e.target.value)}
                  onScroll={handleEditorScroll}
                  onKeyDown={handleEditorKeyDown}
                  wrap="off"
                  spellCheck={false}
                  autoComplete="off"
                  style={{ tabSize: 2 }}
                  className="relative z-10 w-full h-full resize-none bg-transparent text-transparent caret-[#10B981] font-mono text-xs leading-6 p-3 focus:outline-none overflow-auto whitespace-pre selection:bg-[#10B981]/25 custom-scrollbar"
                />
              </div>
            </div>

            {/* Diagnostics Footer */}
            {transpileResult.diagnostics.length > 0 && (
              <div className="px-3 py-2 border-t border-[#262B33] bg-[#14171C] max-h-24 overflow-y-auto space-y-1">
                {transpileResult.diagnostics.map((d, i) => (
                  <div
                    key={i}
                    className={clsx(
                      'text-xs font-mono flex items-center gap-2',
                      d.severity === 'error' ? 'text-red-400' : 'text-amber-300'
                    )}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Line {d.line}: {d.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Live Preview & Visual Editor Viewport */}
          {showLivePreview && (
            <div className="w-full lg:w-[44%] xl:w-[46%] h-72 lg:h-auto border-t lg:border-t-0 lg:border-l border-[#262B33] bg-[#07090C] relative shrink-0 overflow-hidden">
              <DifrenoptViewport
                key={previewRevision}
                entity={previewEntity}
                editMode={isVisualEdit}
                onVisualPatch={handleVisualPatch}
              />
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
