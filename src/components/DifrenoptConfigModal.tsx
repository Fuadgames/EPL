import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  X, Cpu, Play, Plus, Search, Sparkles, CheckCircle2,
  AlertTriangle, Box, Gamepad2, LayoutDashboard, Code2, Eye, Layers,
  BookOpen, Check, Ban, Move, Trash2, ChevronDown, Puzzle, ArrowUp,
  ArrowDown, Copy, CornerDownLeft, Wand2, ChevronRight
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
  'move3d', 'rotate3d', 'scale3d', 'move2d', 'storage_load', 'isKeyDown',
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

// ============================================================
// AUTOCOMPLETE ITEMS (Components + Hooks + Helpers + Keywords)
// ============================================================
interface AutocompleteItem {
  name: string;
  kind: 'component' | 'hook' | 'helper' | 'keyword';
  color: string;
  badge: string;
  description: string;
  insertText: string;
}

const HOOK_SUGGESTIONS: { name: string; descRu: string; descEn: string; insertText: string }[] = [
  { name: 'started?', descRu: 'Запускается 1 раз при старте сцены', descEn: 'Runs once on scene boot', insertText: 'started?\n  \nend' },
  { name: 'frame?', descRu: 'Игровой цикл каждый кадр (60 FPS)', descEn: 'Runs every animation frame (60 FPS)', insertText: 'frame?\n  \nend' },
  { name: 'key_pressed?', descRu: 'Нажатие клавиши (переменная key)', descEn: 'Fires when a key is pressed (key var)', insertText: 'key_pressed?\n  if (key == "Space") {\n    \n  }\nend' },
  { name: 'clicked?', descRu: 'Клик по UI кнопке (target)', descEn: 'Fires on UI button click (target var)', insertText: 'clicked?\n  if (target == "btn") {\n    \n  }\nend' },
  { name: 'collided?', descRu: 'Столкновение объектов 2D/3D (a, b)', descEn: 'Collision event between objects a and b', insertText: 'collided?\n  \nend' },
  { name: 'timer_tick?', descRu: 'Событие таймера', descEn: 'Periodic timer tick event', insertText: 'timer_tick?\n  \nend' },
  { name: 'update?', descRu: 'Фиксированный шаг логики', descEn: 'Fixed update logic hook', insertText: 'update?\n  \nend' },
  { name: 'render?', descRu: 'Хук рендера сцены', descEn: 'Render pass event hook', insertText: 'render?\n  \nend' },
  { name: 'end', descRu: 'Закрывает блок события', descEn: 'Closes an EPL event block', insertText: 'end' }
];

const HELPER_SUGGESTIONS: { name: string; signature: string; descRu: string; descEn: string; insertText: string }[] = [
  { name: 'move3d', signature: 'move3d(name, dx, dy, dz)', descRu: 'Сдвинуть 3D объект', descEn: 'Move a 3D entity', insertText: 'move3d("player", 0, 0, -0.1)' },
  { name: 'rotate3d', signature: 'rotate3d(name, rx, ry, rz)', descRu: 'Повернуть 3D объект', descEn: 'Rotate a 3D entity', insertText: 'rotate3d("obj", 0, 0.02, 0)' },
  { name: 'scale3d', signature: 'scale3d(name, sx, sy, sz)', descRu: 'Масштаб 3D объекта', descEn: 'Scale a 3D entity', insertText: 'scale3d("obj", 1.2, 1.2, 1.2)' },
  { name: 'move2d', signature: 'move2d(name, vx, vy)', descRu: 'Импульс / скорость 2D объекта', descEn: 'Apply velocity to 2D entity', insertText: 'move2d("hero", 4, 0)' },
  { name: 'isKeyDown', signature: 'isKeyDown("W")', descRu: 'Проверка зажатой клавиши', descEn: 'Check held keyboard key', insertText: 'isKeyDown("W")' },
  { name: 'setUI', signature: 'setUI(id, prop, val)', descRu: 'Изменить свойство UI виджета', descEn: 'Update UI widget property', insertText: 'setUI("status", "text", "Ready")' },
  { name: 'getUI', signature: 'getUI(id, prop)', descRu: 'Прочитать значение UI виджета', descEn: 'Read UI widget value', insertText: 'getUI("slider1", "value")' },
  { name: 'pushChart', signature: 'pushChart(id, val, max)', descRu: 'Добавить точку на график', descEn: 'Stream data point to ui_chart', insertText: 'pushChart("chart1", 60, 20)' },
  { name: 'logTerminal', signature: 'logTerminal(id, msg)', descRu: 'Вывести строку в ui_terminal', descEn: 'Append log line to ui_terminal', insertText: 'logTerminal("term1", "Loaded OK")' },
  { name: 'getProp', signature: 'getProp(name, prop, fallback)', descRu: 'Свойство 3D объекта (x, y, z)', descEn: 'Read 3D entity property', insertText: 'getProp("player", "y", 0)' },
  { name: 'get2D', signature: 'get2D(name, prop, fallback)', descRu: 'Свойство 2D объекта (x, y)', descEn: 'Read 2D entity property', insertText: 'get2D("hero", "x", 0)' },
  { name: 'storage_load', signature: 'storage_load(key, fallback)', descRu: 'Загрузить сохраненное значение', descEn: 'Load persistent value from storage', insertText: 'storage_load("score", 0)' },
  { name: 'playSfx', signature: 'playSfx(freq, duration)', descRu: 'Воспроизвести звуковой эффект', descEn: 'Play WebAudio synth effect', insertText: 'playSfx(660, 0.12)' },
  { name: 'distance3d', signature: 'distance3d(a, b)', descRu: 'Расстояние между 3D объектами', descEn: 'Distance between two 3D nodes', insertText: 'distance3d("player", "goal")' },
  { name: 'lerp', signature: 'lerp(a, b, t)', descRu: 'Плавная интерполяция', descEn: 'Linear interpolation', insertText: 'lerp(0, 10, 0.1)' },
  { name: 'clamp', signature: 'clamp(v, min, max)', descRu: 'Ограничить число диапазоном', descEn: 'Clamp value to range', insertText: 'clamp(val, 0, 100)' },
  { name: 'rand', signature: 'rand(min, max)', descRu: 'Случайное дробное число', descEn: 'Random float in range', insertText: 'rand(-10, 10)' },
  { name: 'randInt', signature: 'randInt(min, max)', descRu: 'Случайное целое число', descEn: 'Random integer in range', insertText: 'randInt(1, 10)' },
  { name: 'print', signature: 'print(msg)', descRu: 'Печать в консоль', descEn: 'Print message to console', insertText: 'print("Hello DRPL")' },
  { name: 'emit', signature: 'emit(event, data)', descRu: 'Отправить событие', descEn: 'Emit custom event', insertText: 'emit("score", 1)' }
];

const KEYWORD_SUGGESTIONS = [
  'let', 'const', 'int', 'float', 'bool', 'string', 'vec3', 'vec2',
  'def', 'fn', 'class', 'if', 'elif', 'else', 'for', 'while', 'return', 'true', 'false'
];

// ============================================================
// BLOCK CODING PARSER / SERIALIZER
// ============================================================
interface DrplArgPair {
  key: string;
  value: string;
}

interface DrplBlockItem {
  id: string;
  kind: 'hook' | 'component' | 'logic' | 'raw';
  hookName?: string;
  compName?: string;
  args?: DrplArgPair[];
  rawLine?: string;
  children?: DrplBlockItem[];
}

function makeBlockId(): string {
  return `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function splitTopLevelArgs(argStr: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let quote: string | null = null;
  let paren = 0;
  let bracket = 0;
  for (let i = 0; i < argStr.length; i++) {
    const ch = argStr[i];
    if ((ch === '"' || ch === "'") && argStr[i - 1] !== '\\') {
      if (quote === ch) quote = null;
      else if (!quote) quote = ch;
      cur += ch;
    } else if (!quote) {
      if (ch === '(') paren++;
      else if (ch === ')') paren = Math.max(0, paren - 1);
      else if (ch === '[') bracket++;
      else if (ch === ']') bracket = Math.max(0, bracket - 1);
      if (ch === ',' && paren === 0 && bracket === 0) {
        if (cur.trim()) parts.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function parseSingleBlockLine(trimmed: string): DrplBlockItem {
  const compMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\(([\s\S]*)\)\s*;?$/);
  if (compMatch && DRPL_COMPONENT_COLOR_MAP[compMatch[1]]) {
    const compName = compMatch[1];
    const parts = splitTopLevelArgs(compMatch[2]);
    const args: DrplArgPair[] = parts.map((p, idx) => {
      const eqIdx = p.indexOf('=');
      if (eqIdx > 0 && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(p.slice(0, eqIdx).trim())) {
        return {
          key: p.slice(0, eqIdx).trim(),
          value: p.slice(eqIdx + 1).trim()
        };
      }
      return { key: `arg${idx + 1}`, value: p };
    });
    return { id: makeBlockId(), kind: 'component', compName, args };
  }

  if (/^(let|const|int|float|double|bool|string|def|fn|if|for|while|print|setUI|pushChart|move3d|rotate3d|move2d|playSfx|storage_save|logTerminal)\b/.test(trimmed)) {
    return { id: makeBlockId(), kind: 'logic', rawLine: trimmed };
  }

  return { id: makeBlockId(), kind: 'raw', rawLine: trimmed };
}

function parseDrplToBlocks(source: string): DrplBlockItem[] {
  if (!source.trim()) return [];
  const lines = source.split('\n');
  const root: DrplBlockItem[] = [];
  let activeHook: DrplBlockItem | null = null;
  let innerDepth = 0;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    if (!activeHook && /^(started\?|frame\?|update\?|render\?|clicked\?|key_pressed\?|timer_tick\?|collided\?)\b/.test(trimmed) && !trimmed.includes('{')) {
      activeHook = {
        id: makeBlockId(),
        kind: 'hook',
        hookName: trimmed,
        children: []
      };
      innerDepth = 0;
      continue;
    }

    if (activeHook) {
      if (/^if\b.*\bthen$/i.test(trimmed) || (/^(repeat|forever)\b/i.test(trimmed) && !trimmed.includes('{'))) {
        innerDepth++;
      } else if (trimmed === 'end' || /^end\s*(?:#|\/\/|$)/i.test(trimmed)) {
        if (innerDepth === 0) {
          root.push(activeHook);
          activeHook = null;
          continue;
        }
        innerDepth--;
      }
      activeHook.children = activeHook.children || [];
      activeHook.children.push(parseSingleBlockLine(trimmed));
    } else {
      root.push(parseSingleBlockLine(trimmed));
    }
  }

  if (activeHook) {
    root.push(activeHook);
  }
  return root;
}

function serializeBlocksToDrpl(blocks: DrplBlockItem[]): string {
  const serializeItem = (b: DrplBlockItem, indent: string): string => {
    if (b.kind === 'hook') {
      const inner = (b.children || []).map(ch => serializeItem(ch, `${indent}  `)).join('\n');
      return inner ? `${indent}${b.hookName || 'frame?'}\n${inner}\n${indent}end` : `${indent}${b.hookName || 'frame?'}\n${indent}  // ... \n${indent}end`;
    }
    if (b.kind === 'component' && b.compName) {
      const argsStr = (b.args || [])
        .filter(a => a.key.trim() !== '' && a.value.trim() !== '')
        .map(a => (/^arg\d+$/.test(a.key) ? a.value : `${a.key}=${a.value}`))
        .join(', ');
      return `${indent}${b.compName}(${argsStr})`;
    }
    return `${indent}${b.rawLine || ''}`;
  };

  return blocks.map(b => serializeItem(b, '')).join('\n');
}

const GUIDE_MINI_LESSONS: {
  id: string;
  badge: string;
  titleRu: string;
  titleEn: string;
  descRu: string;
  descEn: string;
  mode: string;
  code: string;
}[] = [
  {
    id: 'lesson_3d_move',
    badge: '3D + WASD',
    titleRu: 'Урок 1: 3D мир + движение игрока на WASD',
    titleEn: 'Lesson 1: 3D Scene + WASD Movement',
    descRu: 'Создаем небо sky3d, землю terrain3d, игрока player3d и двигаем его каждый кадр в frame? с помощью isKeyDown и move3d.',
    descEn: 'Sets up sky3d, terrain3d, player3d, and moves smoothly in frame? using isKeyDown and move3d.',
    mode: '3d',
    code: `// Урок 1: 3D сцена + управление WASD
use3d(lighting="studio", bloom=1.1, shadows=true)
sky3d(style="cyber_aurora", stars=700)
terrain3d(name="floor", size=90, height=1.2, color="#111827")
player3d(name="hero", x=0, y=1.5, z=4, color="#10b981")
camera3d(mode="chase", target="hero", distance=10, height=4)
ui_badge(id="hint", text="WASD = Move | Space = Jump", color="#10b981")

let speed = 0.16

frame?
  if (isKeyDown("W") || isKeyDown("ArrowUp")) { move3d("hero", 0, 0, -speed) }
  if (isKeyDown("S") || isKeyDown("ArrowDown")) { move3d("hero", 0, 0, speed) }
  if (isKeyDown("A") || isKeyDown("ArrowLeft")) { move3d("hero", -speed, 0, 0) }
  if (isKeyDown("D") || isKeyDown("ArrowRight")) { move3d("hero", speed, 0, 0) }
end`
  },
  {
    id: 'lesson_2d_jump',
    badge: '2D Physics',
    titleRu: 'Урок 2: 2D платформер с пружиной и сбором монет',
    titleEn: 'Lesson 2: 2D Platformer with Spring & Coins',
    descRu: '2D движок use2d, платформы platform2d, пружина spring2d и герой player2d + счёт в HUD ui_counter.',
    descEn: '2D engine with platform2d, spring2d, coins, and a live ui_counter HUD.',
    mode: '2d',
    code: `// Урок 2: 2D Платформер
use2d(bg="#07101f", gravity=980, lighting=true)
platform2d(name="ground", x=200, y=350, w=560, h=28, color="#10b981")
spring2d(name="boing", x=360, y=325, force=580, color="#fbbf24")
coin2d(name="c1", x=280, y=240, color="#facc15")
coin2d(name="c2", x=360, y=170, color="#facc15")
player2d(name="hero", x=140, y=250, speed=260, jump=430, color="#38bdf8")
ui_counter(id="coins", label="SCORE", value=0, color="#fbbf24")`
  },
  {
    id: 'lesson_app_hud',
    badge: 'App + Data',
    titleRu: 'Урок 3: Интерактивное приложение + График + Память',
    titleEn: 'Lesson 3: Interactive Dashboard + Storage',
    descRu: 'Приложение без 3D/2D: панель статистики ui_statbar, живой график ui_chart, кнопка ui_button и сохранение storage_save.',
    descEn: 'App UI mode with ui_statbar, live ui_chart, interactive button and storage_save.',
    mode: 'app',
    code: `// Урок 3: Приложение и аналитика
useapp(theme="dark", accent="#10b981")
ui_statbar(id="xp", label="EXPERIENCE", value=45, max=100, color="#10b981")
ui_chart(id="telemetry", title="Activity Stream", points=[20, 35, 28, 52, 60], color="#38bdf8")
ui_button(id="boost", text="Add +15 XP", color="#10b981")

let totalXp = storage_load("demo_xp", 45)

clicked?
  if (target == "boost") {
    totalXp = clamp(totalXp + 15, 0, 100)
    setUI("xp", "value", totalXp)
    pushChart("telemetry", totalXp, 16)
    storage_save("demo_xp", totalXp)
    playSfx(720, 0.1)
  }
end`
  }
];

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
  const [activeView, setActiveView] = useState<'studio' | 'blocks' | 'guide'>('studio');
  const [isVisualEdit, setIsVisualEdit] = useState(false);
  const [showExamplePicker, setShowExamplePicker] = useState(false);
  const [exampleCategory, setExampleCategory] = useState<'all' | '3d' | '2d' | 'app'>('all');

  // Autocomplete State
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [autocompletePrefix, setAutocompletePrefix] = useState('');
  const [autocompleteRange, setAutocompleteRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [autocompletePos, setAutocompletePos] = useState<{ top: number; left: number }>({ top: 36, left: 16 });
  const [autocompleteIdx, setAutocompleteIdx] = useState(0);

  // Block Coding State
  const [blocksTree, setBlocksTree] = useState<DrplBlockItem[]>([]);
  const [selectedHookId, setSelectedHookId] = useState<string | null>(null);
  const [blockPaletteTab, setBlockPaletteTab] = useState<'events' | 'logic' | '3d' | '2d' | 'app'>('3d');
  const [blockSearch, setBlockSearch] = useState('');

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterInnerRef = useRef<HTMLDivElement>(null);
  const examplePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const codeInit = initialDrplCode?.trim() ? initialDrplCode : '';
      setParams({ ...DEFAULT_PARAMS, ...(initialParams || {}) });
      setDrplCode(codeInit);
      setBlocksTree(parseDrplToBlocks(codeInit));
      setIsVisualEdit(false);
      setShowExamplePicker(false);
      setAutocompleteOpen(false);
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

  // Unified Autocomplete Catalog (Components + Hooks + Helpers + Keywords)
  const autocompleteCatalog = useMemo<AutocompleteItem[]>(() => {
    const items: AutocompleteItem[] = [];
    for (const c of DRPL_COMPONENTS) {
      items.push({
        name: c.name,
        kind: 'component',
        color: c.color,
        badge: c.category.toUpperCase(),
        description: language === 'ru' ? c.roleRu : c.roleEn,
        insertText: c.snippet
      });
    }
    for (const h of HOOK_SUGGESTIONS) {
      items.push({
        name: h.name,
        kind: 'hook',
        color: '#FBBF24',
        badge: 'HOOK',
        description: language === 'ru' ? h.descRu : h.descEn,
        insertText: h.insertText
      });
    }
    for (const fn of HELPER_SUGGESTIONS) {
      items.push({
        name: fn.name,
        kind: 'helper',
        color: '#2DD4BF',
        badge: 'FN',
        description: language === 'ru' ? `${fn.descRu} — ${fn.signature}` : `${fn.descEn} — ${fn.signature}`,
        insertText: fn.insertText
      });
    }
    for (const kw of KEYWORD_SUGGESTIONS) {
      items.push({
        name: kw,
        kind: 'keyword',
        color: '#C084FC',
        badge: 'KW',
        description: language === 'ru' ? 'Ключевое слово DRPL' : 'DRPL language keyword',
        insertText: kw
      });
    }
    return items;
  }, [language]);

  const autocompleteMatches = useMemo(() => {
    const q = autocompletePrefix.trim().toLowerCase();
    if (!q) return [];
    const starts = autocompleteCatalog.filter(it => it.name.toLowerCase().startsWith(q));
    const contains = autocompleteCatalog.filter(
      it => !it.name.toLowerCase().startsWith(q) && it.name.toLowerCase().includes(q)
    );
    return [...starts, ...contains].slice(0, 12);
  }, [autocompleteCatalog, autocompletePrefix]);

  const evaluateAutocompleteAtCursor = useCallback(
    (codeStr: string, el: HTMLTextAreaElement | null) => {
      if (!el) return;
      const caret = el.selectionStart ?? 0;
      if (caret !== (el.selectionEnd ?? caret)) {
        setAutocompleteOpen(false);
        return;
      }
      const upToCaret = codeStr.slice(0, caret);
      const lineStart = upToCaret.lastIndexOf('\n') + 1;
      const currentLineBefore = upToCaret.slice(lineStart);

      // Suppress inside comments or open string literals
      if (/^\s*(\/\/|#)/.test(currentLineBefore)) {
        setAutocompleteOpen(false);
        return;
      }
      const quotesCount = (currentLineBefore.match(/(?<!\\)"/g) || []).length;
      if (quotesCount % 2 === 1) {
        setAutocompleteOpen(false);
        return;
      }

      const tokenMatch = currentLineBefore.match(/([a-zA-Z_][a-zA-Z0-9_?]*)$/);
      if (!tokenMatch || tokenMatch[1].length < 1) {
        setAutocompleteOpen(false);
        return;
      }

      const word = tokenMatch[1];
      const wordStart = caret - word.length;
      const linesBefore = upToCaret.split('\n');
      const lineIdx = linesBefore.length - 1;
      const colIdx = linesBefore[linesBefore.length - 1].length;

      const wrapH = editorWrapperRef.current?.clientHeight || 380;
      const wrapW = editorWrapperRef.current?.clientWidth || 500;
      const rawTop = 12 + (lineIdx + 1) * 24 - el.scrollTop;
      const clampedTop = Math.max(8, Math.min(rawTop, Math.max(8, wrapH - 236)));
      const rawLeft = 12 + colIdx * 7.22 - el.scrollLeft;
      const clampedLeft = Math.max(8, Math.min(rawLeft, Math.max(8, wrapW - 330)));

      setAutocompletePos({ top: clampedTop, left: clampedLeft });
      setAutocompleteRange({ start: wordStart, end: caret });
      setAutocompletePrefix(prev => {
        if (prev !== word) setAutocompleteIdx(0);
        return word;
      });
      setAutocompleteOpen(true);
    },
    []
  );

  const applyAutocomplete = useCallback(
    (item: AutocompleteItem) => {
      const el = editorRef.current;
      const { start, end } = autocompleteRange;
      const lineStartIdx = drplCode.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      const lineIndentMatch = drplCode.slice(lineStartIdx, start).match(/^(\s*)/);
      const indent = lineIndentMatch ? lineIndentMatch[1] : '';

      const snippetLines = item.insertText.split('\n');
      const formattedInsert =
        snippetLines.length > 1
          ? snippetLines.map((ln, idx) => (idx === 0 ? ln : `${indent}${ln}`)).join('\n')
          : item.insertText;

      const nextCode = drplCode.slice(0, start) + formattedInsert + drplCode.slice(end);
      setDrplCode(nextCode);
      setAutocompleteOpen(false);

      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        // If snippet is a multi-line hook with inner blank indent line, place cursor nicely inside
        let cursorOffset = start + formattedInsert.length;
        if (snippetLines.length === 3 && snippetLines[1].trim() === '') {
          cursorOffset = start + snippetLines[0].length + 1 + indent.length + snippetLines[1].length;
        }
        el.setSelectionRange(cursorOffset, cursorOffset);
      });
    },
    [autocompleteRange, drplCode]
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

  const syncBlocksToCode = useCallback((nextTree: DrplBlockItem[]) => {
    setBlocksTree(nextTree);
    const nextCode = serializeBlocksToDrpl(nextTree);
    setDrplCode(nextCode);
  }, []);

  const switchView = (next: 'studio' | 'blocks' | 'guide') => {
    if (next === 'blocks') {
      setBlocksTree(parseDrplToBlocks(drplCode));
    }
    setAutocompleteOpen(false);
    setActiveView(next);
  };

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
    setBlocksTree(parseDrplToBlocks(tpl.drplCode));
    setShowExamplePicker(false);
    setActiveView('studio');
    setShowLivePreview(true);
    setPreviewRevision(r => r + 1);
  };

  const loadCodeLesson = (mode: string, lessonCode: string) => {
    setParams(prev => ({ ...prev, mode }));
    setDrplCode(lessonCode);
    setBlocksTree(parseDrplToBlocks(lessonCode));
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
    setAutocompleteOpen(false);
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (autocompleteOpen && autocompleteMatches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocompleteIdx(i => (i + 1) % autocompleteMatches.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocompleteIdx(i => (i - 1 + autocompleteMatches.length) % autocompleteMatches.length);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        const chosen = autocompleteMatches[autocompleteIdx] || autocompleteMatches[0];
        if (chosen) applyAutocomplete(chosen);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAutocompleteOpen(false);
        return;
      }
    }

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

  // Block Coding Helpers
  const addBlockFromSnippet = (rawLine: string, asHookName?: string) => {
    if (asHookName) {
      const newHook: DrplBlockItem = {
        id: makeBlockId(),
        kind: 'hook',
        hookName: asHookName,
        children: []
      };
      syncBlocksToCode([...blocksTree, newHook]);
      setSelectedHookId(newHook.id);
      return;
    }
    const newChild = parseSingleBlockLine(rawLine);
    if (selectedHookId) {
      const next = blocksTree.map(b =>
        b.id === selectedHookId && b.kind === 'hook'
          ? { ...b, children: [...(b.children || []), newChild] }
          : b
      );
      syncBlocksToCode(next);
    } else {
      syncBlocksToCode([...blocksTree, newChild]);
    }
  };

  const moveBlock = (parentHookId: string | null, index: number, dir: -1 | 1) => {
    if (!parentHookId) {
      const target = index + dir;
      if (target < 0 || target >= blocksTree.length) return;
      const copy = [...blocksTree];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      syncBlocksToCode(copy);
    } else {
      const next = blocksTree.map(b => {
        if (b.id !== parentHookId || !b.children) return b;
        const target = index + dir;
        if (target < 0 || target >= b.children.length) return b;
        const ch = [...b.children];
        const [item] = ch.splice(index, 1);
        ch.splice(target, 0, item);
        return { ...b, children: ch };
      });
      syncBlocksToCode(next);
    }
  };

  const deleteBlock = (parentHookId: string | null, blockId: string) => {
    if (!parentHookId) {
      if (selectedHookId === blockId) setSelectedHookId(null);
      syncBlocksToCode(blocksTree.filter(b => b.id !== blockId));
    } else {
      syncBlocksToCode(
        blocksTree.map(b =>
          b.id === parentHookId && b.children
            ? { ...b, children: b.children.filter(c => c.id !== blockId) }
            : b
        )
      );
    }
  };

  const updateComponentArg = (parentHookId: string | null, blockId: string, argIdx: number, newVal: string) => {
    const patchItem = (b: DrplBlockItem): DrplBlockItem => {
      if (b.id !== blockId || !b.args) return b;
      const nextArgs = b.args.map((a, idx) => (idx === argIdx ? { ...a, value: newVal } : a));
      return { ...b, args: nextArgs };
    };
    if (!parentHookId) {
      syncBlocksToCode(blocksTree.map(patchItem));
    } else {
      syncBlocksToCode(
        blocksTree.map(b =>
          b.id === parentHookId && b.children ? { ...b, children: b.children.map(patchItem) } : b
        )
      );
    }
  };

  const updateRawLineBlock = (parentHookId: string | null, blockId: string, newLine: string) => {
    const patchItem = (b: DrplBlockItem): DrplBlockItem =>
      b.id === blockId ? { ...b, rawLine: newLine } : b;
    if (!parentHookId) {
      syncBlocksToCode(blocksTree.map(patchItem));
    } else {
      syncBlocksToCode(
        blocksTree.map(b =>
          b.id === parentHookId && b.children ? { ...b, children: b.children.map(patchItem) } : b
        )
      );
    }
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
                  ? `DRPL (${DRPL_COMPONENTS.length} компонентов • Tab-подсказки • Блочный режим)`
                  : `DRPL (${DRPL_COMPONENTS.length} Components • Tab Autocomplete • Block Coding)`}
              </p>
            </div>
          </div>

          {/* Primary Action & Mode Switch Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Mode Switcher: Code Studio | Block Coding | DRPL Guide */}
            <div className={clsx(
              'flex items-center rounded-lg border p-0.5',
              isLight ? 'bg-slate-100 border-[#E2E5EA]' : 'bg-[#0D1014] border-[#262B33]'
            )}>
              <button
                type="button"
                onClick={() => switchView('studio')}
                className={clsx(
                  'px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors',
                  activeView === 'studio'
                    ? 'bg-[#10B981] text-[#0A0C0E]'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-[#9CA3AF] hover:text-white'
                )}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{language === 'ru' ? 'Код IDE' : 'Code Studio'}</span>
              </button>
              <button
                type="button"
                onClick={() => switchView('blocks')}
                className={clsx(
                  'px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors',
                  activeView === 'blocks'
                    ? 'bg-violet-500 text-white'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-[#9CA3AF] hover:text-white'
                )}
              >
                <Puzzle className="w-3.5 h-3.5" />
                <span>{language === 'ru' ? 'Блоки' : 'Block Coding'}</span>
              </button>
              <button
                type="button"
                onClick={() => switchView('guide')}
                className={clsx(
                  'px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors',
                  activeView === 'guide'
                    ? 'bg-sky-500 text-[#07111A]'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-[#9CA3AF] hover:text-white'
                )}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{language === 'ru' ? 'Гайд DRPL' : 'DRPL Guide'}</span>
              </button>
            </div>

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
                          <span className="text-xs font-bold flex items-center gap-1.5">
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
                  setBlocksTree([]);
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
                    if (activeView === 'guide') setActiveView('studio');
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
              <span>Edit Visual</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeView === 'guide') setActiveView('studio');
                setShowLivePreview(v => !v);
              }}
              className={clsx(
                'px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors',
                showLivePreview && activeView !== 'guide'
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

        {/* Optimizer Configuration Strip */}
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

        {/* ============================================================ */}
        {/* MAIN WORKSPACE: GUIDE | BLOCK CODING | STUDIO IDE            */}
        {/* ============================================================ */}
        {activeView === 'guide' ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
            {/* Step-by-Step How DRPL Works */}
            <div className={clsx(
              'p-4 sm:p-5 rounded-2xl border space-y-4',
              isLight ? 'bg-[#F8FAFC] border-[#E2E5EA]' : 'bg-[#16191E] border-[#262B33]'
            )}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#10B981]">
                    {language === 'ru'
                      ? 'Как устроен и работает DRPL — 4 простых шага'
                      : 'How DRPL Works — 4 Core Building Steps'}
                  </h3>
                  <p className={clsx('text-xs mt-0.5', isLight ? 'text-slate-600' : 'text-[#9CA3AF]')}>
                    {language === 'ru'
                      ? 'DRPL объединяет привычный синтаксис Python, JS, C#, C++ и Java с простыми компонентами сцены и событиями EPL.'
                      : 'DRPL blends Python, JS, C#, C++ and Java syntax with single-line scene components and EPL event hooks.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className={clsx('p-3.5 rounded-xl border space-y-1.5', isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]')}>
                  <div className="text-xs font-bold text-emerald-400">
                    {language === 'ru' ? 'Шаг 1. Выберите движок' : 'Step 1. Pick Your Engine'}
                  </div>
                  <p className={clsx('text-[11px] leading-relaxed', isLight ? 'text-slate-600' : 'text-[#9CA3AF]')}>
                    {language === 'ru'
                      ? 'Начните с use3d(...), use2d(...) или useapp(...). Это задает 3D свет/туман, 2D физику или UI-приложение.'
                      : 'Start with use3d(...), use2d(...), or useapp(...). This initializes 3D PBR, 2D physics, or App HUD mode.'}
                  </p>
                  <code className="block font-mono text-[10px] p-1.5 rounded bg-[#0A0C0E] text-emerald-300">
                    use3d(lighting="studio", bloom=1.1)
                  </code>
                </div>

                <div className={clsx('p-3.5 rounded-xl border space-y-1.5', isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]')}>
                  <div className="text-xs font-bold text-sky-400">
                    {language === 'ru' ? 'Шаг 2. Добавьте объекты и HUD' : 'Step 2. Add Nodes & HUD'}
                  </div>
                  <p className={clsx('text-[11px] leading-relaxed', isLight ? 'text-slate-600' : 'text-[#9CA3AF]')}>
                    {language === 'ru'
                      ? 'Каждому объекту давайте name="..." или id="...", чтобы потом двигать его или обновлять из кода.'
                      : 'Give objects a unique name="..." or id="..." so event loops and helpers can animate or update them.'}
                  </p>
                  <code className="block font-mono text-[10px] p-1.5 rounded bg-[#0A0C0E] text-sky-300">
                    car3d(name="racer", color="#10b981")
                  </code>
                </div>

                <div className={clsx('p-3.5 rounded-xl border space-y-1.5', isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]')}>
                  <div className="text-xs font-bold text-violet-400">
                    {language === 'ru' ? 'Шаг 3. Логика на любом языке' : 'Step 3. Polyglot Logic'}
                  </div>
                  <p className={clsx('text-[11px] leading-relaxed', isLight ? 'text-slate-600' : 'text-[#9CA3AF]')}>
                    {language === 'ru'
                      ? 'Пишите let x = 0, int hp = 100, def jump():, for i in range(5): или C/JS скобки { } — движок понимает всё!'
                      : 'Write let x = 0, int hp = 100, def jump():, for i in range(5): or { } blocks seamlessly together.'}
                  </p>
                  <code className="block font-mono text-[10px] p-1.5 rounded bg-[#0A0C0E] text-violet-300">
                    let spd = 0.2; int coins = 0
                  </code>
                </div>

                <div className={clsx('p-3.5 rounded-xl border space-y-1.5', isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]')}>
                  <div className="text-xs font-bold text-amber-400">
                    {language === 'ru' ? 'Шаг 4. События EPL + Tab' : 'Step 4. EPL Hooks + Tab'}
                  </div>
                  <p className={clsx('text-[11px] leading-relaxed', isLight ? 'text-slate-600' : 'text-[#9CA3AF]')}>
                    {language === 'ru'
                      ? 'frame? работает 60 раз в сек, key_pressed? ловит клавиши, clicked? ловит кнопки. Нажмите Tab в редакторе для автоподстановки!'
                      : 'frame? runs 60 FPS, key_pressed? catches keys, clicked? handles HUD buttons. Press Tab while typing to autocomplete!'}
                  </p>
                  <code className="block font-mono text-[10px] p-1.5 rounded bg-[#0A0C0E] text-amber-300">
                    frame? ... end
                  </code>
                </div>
              </div>
            </div>

            {/* Interactive Guided Mini-Lessons */}
            <div className="space-y-3">
              <div className="text-sm font-bold flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-[#10B981]" />
                <span>
                  {language === 'ru'
                    ? 'Интерактивные мини-уроки: что с чем соединять'
                    : 'Interactive Mini-Lessons: Practical Recipes'}
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {GUIDE_MINI_LESSONS.map(lesson => (
                  <div
                    key={lesson.id}
                    className={clsx(
                      'p-4 rounded-xl border flex flex-col justify-between gap-3',
                      isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#14171C] border-[#262B33]'
                    )}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] font-bold">
                          {lesson.badge}
                        </span>
                        <button
                          type="button"
                          onClick={() => loadCodeLesson(lesson.mode, lesson.code)}
                          className="px-2.5 py-1 rounded-md bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3 h-3" />
                          <span>{language === 'ru' ? 'Попробовать' : 'Try in Studio'}</span>
                        </button>
                      </div>
                      <h4 className="text-xs font-bold">
                        {language === 'ru' ? lesson.titleRu : lesson.titleEn}
                      </h4>
                      <p className={clsx('text-[11px] leading-snug', isLight ? 'text-slate-600' : 'text-[#9CA3AF]')}>
                        {language === 'ru' ? lesson.descRu : lesson.descEn}
                      </p>
                      <pre className={clsx(
                        'text-[10px] font-mono p-2.5 rounded-lg border overflow-x-auto max-h-40 custom-scrollbar',
                        isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#0A0C0E] border-[#22262E] text-emerald-300'
                      )}>
                        {lesson.code}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Compatibility Matrix & Live Helpers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div
                className={clsx(
                  'p-4 rounded-xl border space-y-2.5',
                  isLight ? 'bg-[#F8FAFC] border-[#E2E5EA]' : 'bg-[#16191E] border-[#262B33]'
                )}
              >
                <div className="text-xs font-bold uppercase tracking-wider text-sky-400">
                  {language === 'ru' ? 'Матрица совместимости: что с чем работает' : 'Compatibility Matrix'}
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                    <div className="font-semibold text-emerald-400">3D: use3d + *3d + ui_* + synth_music</div>
                    <div className={clsx('text-[11px] mt-0.5', isLight ? 'text-slate-700' : 'text-[#D1D5DB]')}>
                      {language === 'ru'
                        ? 'Все *3d объекты (terrain3d, car3d, raycast3d, hologram3d, checkpoint3d, portal3d) + любой HUD ui_* + музыка.'
                        : 'All *3d nodes + any ui_* HUD widget + synth_music/sfx2d.'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-teal-500/30 bg-teal-500/10">
                    <div className="font-semibold text-teal-400">2D: use2d + *2d + ui_* + synth_music</div>
                    <div className={clsx('text-[11px] mt-0.5', isLight ? 'text-slate-700' : 'text-[#D1D5DB]')}>
                      {language === 'ru'
                        ? 'Все *2d объекты (player2d, spawner2d, spring2d, hazard2d, shield2d, dialog2d) + ui_* HUD.'
                        : 'All *2d entities + ui_* HUD overlays + audio.'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10">
                    <div className="font-semibold text-indigo-400">App UI: useapp + ui_* + storage_save</div>
                    <div className={clsx('text-[11px] mt-0.5', isLight ? 'text-slate-700' : 'text-[#D1D5DB]')}>
                      {language === 'ru'
                        ? 'ui_inventory, ui_statbar, ui_timer, ui_chat, ui_grid, ui_chart, storage_save — универсальны для игр и приложений!'
                        : 'ui_* widgets and storage_save run standalone or atop any 3D/2D game.'}
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
                  {language === 'ru' ? 'Функции управления в реальном времени' : 'Live Runtime Helpers'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] font-mono">
                  <div className={clsx('px-2.5 py-1.5 rounded border', isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#0A0C0E] border-[#22262E]')}>
                    <span className="text-emerald-400">move3d(n, dx, dy, dz)</span>
                    <div className="text-[10px] opacity-65 font-sans">{language === 'ru' ? 'Сдвиг 3D объекта' : 'Move 3D node'}</div>
                  </div>
                  <div className={clsx('px-2.5 py-1.5 rounded border', isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#0A0C0E] border-[#22262E]')}>
                    <span className="text-emerald-400">move2d(n, vx, vy)</span>
                    <div className="text-[10px] opacity-65 font-sans">{language === 'ru' ? 'Движение 2D спрайта' : 'Move 2D entity'}</div>
                  </div>
                  <div className={clsx('px-2.5 py-1.5 rounded border', isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#0A0C0E] border-[#22262E]')}>
                    <span className="text-sky-400">setUI(id, prop, val)</span>
                    <div className="text-[10px] opacity-65 font-sans">{language === 'ru' ? 'Обновить UI виджет' : 'Update UI widget'}</div>
                  </div>
                  <div className={clsx('px-2.5 py-1.5 rounded border', isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#0A0C0E] border-[#22262E]')}>
                    <span className="text-sky-400">pushChart(id, v, max)</span>
                    <div className="text-[10px] opacity-65 font-sans">{language === 'ru' ? 'Точка на график' : 'Push chart value'}</div>
                  </div>
                  <div className={clsx('px-2.5 py-1.5 rounded border', isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#0A0C0E] border-[#22262E]')}>
                    <span className="text-violet-400">isKeyDown("W")</span>
                    <div className="text-[10px] opacity-65 font-sans">{language === 'ru' ? 'Проверка клавиши' : 'Check key state'}</div>
                  </div>
                  <div className={clsx('px-2.5 py-1.5 rounded border', isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#0A0C0E] border-[#22262E]')}>
                    <span className="text-amber-400">storage_load(k, def)</span>
                    <div className="text-[10px] opacity-65 font-sans">{language === 'ru' ? 'Загрузка сохранения' : 'Load saved state'}</div>
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
                    ? `Полный справочник (${DRPL_COMPONENTS.length} компонентов)`
                    : `Complete ${DRPL_COMPONENTS.length}-Component Reference`}
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
        ) : activeView === 'blocks' ? (
          /* ============================================================ */
          /* VISUAL DRPL BLOCK CODING WORKSPACE                           */
          /* ============================================================ */
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
            {/* LEFT PALETTE: Events, Logic, 3D, 2D, App */}
            <div
              className={clsx(
                'w-full lg:w-80 border-b lg:border-b-0 lg:border-r flex flex-col shrink-0 h-56 lg:h-auto overflow-hidden',
                isLight ? 'bg-[#F8FAFC] border-[#E2E5EA]' : 'bg-[#16191E] border-[#262B33]'
              )}
            >
              <div className="p-3 border-b border-[#262B33]/60 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
                    <Puzzle className="w-3.5 h-3.5" />
                    <span>{language === 'ru' ? 'Палитра блоков' : 'Block Palette'}</span>
                  </span>
                  {selectedHookId && (
                    <button
                      type="button"
                      onClick={() => setSelectedHookId(null)}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 cursor-pointer"
                    >
                      {language === 'ru' ? 'Внутри события ×' : 'Inside Hook ×'}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {([
                    { id: 'events', label: language === 'ru' ? 'События' : 'Events' },
                    { id: 'logic', label: language === 'ru' ? 'Логика' : 'Logic' },
                    { id: '3d', label: '3D' },
                    { id: '2d', label: '2D' },
                    { id: 'app', label: 'App' }
                  ] as const).map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setBlockPaletteTab(tab.id)}
                      className={clsx(
                        'px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors',
                        blockPaletteTab === tab.id
                          ? 'bg-violet-500 text-white'
                          : isLight
                            ? 'bg-white border border-[#E2E5EA] text-slate-600'
                            : 'bg-[#111315] border border-[#262B33] text-[#9CA3AF]'
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {(blockPaletteTab === '3d' || blockPaletteTab === '2d' || blockPaletteTab === 'app') && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                    <input
                      type="text"
                      value={blockSearch}
                      onChange={e => setBlockSearch(e.target.value)}
                      placeholder={language === 'ru' ? 'Поиск блока...' : 'Search block...'}
                      className={clsx(
                        'w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs focus:outline-none focus:border-violet-400',
                        isLight ? 'bg-white border-[#E2E5EA]' : 'bg-[#0A0C0E] border-[#262B33] text-[#E5E7EB]'
                      )}
                    />
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
                {blockPaletteTab === 'events' && (
                  <>
                    {[
                      { hook: 'started?', labelRu: 'При запуске (1 раз)', labelEn: 'On Start (once)' },
                      { hook: 'frame?', labelRu: 'Каждый кадр (60 FPS)', labelEn: 'Every Frame (60 FPS)' },
                      { hook: 'key_pressed?', labelRu: 'Нажатие клавиши', labelEn: 'On Key Pressed' },
                      { hook: 'clicked?', labelRu: 'Клик по кнопке UI', labelEn: 'On UI Click' },
                      { hook: 'collided?', labelRu: 'Столкновение объектов', labelEn: 'On Collision' },
                      { hook: 'timer_tick?', labelRu: 'Тик таймера', labelEn: 'On Timer Tick' }
                    ].map(ev => (
                      <button
                        key={ev.hook}
                        type="button"
                        onClick={() => addBlockFromSnippet('', ev.hook)}
                        className="w-full text-left p-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 transition-colors cursor-pointer flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-mono font-bold text-xs text-amber-400">{ev.hook} ... end</div>
                          <div className="text-[11px] opacity-75">
                            {language === 'ru' ? ev.labelRu : ev.labelEn}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-amber-400 shrink-0" />
                      </button>
                    ))}
                  </>
                )}

                {blockPaletteTab === 'logic' && (
                  <>
                    {[
                      { code: 'let score = 0', descRu: 'Создать переменную', descEn: 'Declare variable' },
                      { code: 'move3d("player", 0, 0, -0.15)', descRu: 'Двигать 3D объект', descEn: 'Move 3D entity' },
                      { code: 'rotate3d("obj", 0, 0.03, 0)', descRu: 'Вращать 3D объект', descEn: 'Rotate 3D entity' },
                      { code: 'move2d("hero", 4, 0)', descRu: 'Двигать 2D героя', descEn: 'Move 2D entity' },
                      { code: 'if (isKeyDown("W")) { move3d("player", 0, 0, -0.15) }', descRu: 'Условие клавиши WASD', descEn: 'If WASD key held' },
                      { code: 'if (target == "btn1") { playSfx(740, 0.12) }', descRu: 'Проверка клика по UI', descEn: 'Check clicked target' },
                      { code: 'setUI("status", "text", "Active")', descRu: 'Обновить UI виджет', descEn: 'Update UI text/value' },
                      { code: 'pushChart("chart1", 72, 20)', descRu: 'Точка на график', descEn: 'Push chart value' },
                      { code: 'playSfx(660, 0.15)', descRu: 'Воспроизвести звук', descEn: 'Play synth sound' },
                      { code: 'print("Debug step")', descRu: 'Печать в консоль', descEn: 'Print log message' }
                    ].map((stmt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => addBlockFromSnippet(stmt.code)}
                        className="w-full text-left p-2.5 rounded-xl border border-violet-500/35 bg-violet-500/10 hover:bg-violet-500/20 transition-colors cursor-pointer space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-violet-300">
                            {language === 'ru' ? stmt.descRu : stmt.descEn}
                          </span>
                          <Plus className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        </div>
                        <div className="font-mono text-[10px] text-sky-300 truncate">{stmt.code}</div>
                      </button>
                    ))}
                  </>
                )}

                {(blockPaletteTab === '3d' || blockPaletteTab === '2d' || blockPaletteTab === 'app') &&
                  DRPL_COMPONENTS.filter(c => {
                    if (c.category !== blockPaletteTab) return false;
                    const q = blockSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      c.name.toLowerCase().includes(q) ||
                      c.roleRu.toLowerCase().includes(q) ||
                      c.roleEn.toLowerCase().includes(q)
                    );
                  }).map(comp => (
                    <button
                      key={comp.id}
                      type="button"
                      onClick={() => addBlockFromSnippet(comp.snippet)}
                      style={{ borderColor: `${comp.color}50` }}
                      className={clsx(
                        'w-full text-left p-2.5 rounded-xl border transition-colors cursor-pointer space-y-1',
                        isLight ? 'bg-white hover:bg-slate-50' : 'bg-[#111315] hover:bg-[#191E26]'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-xs flex items-center gap-1.5" style={{ color: comp.color }}>
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: comp.color }} />
                          {comp.name}
                        </span>
                        <Plus className="w-3.5 h-3.5 shrink-0" style={{ color: comp.color }} />
                      </div>
                      <div className="text-[11px] opacity-75 truncate">
                        {language === 'ru' ? comp.roleRu : comp.roleEn}
                      </div>
                    </button>
                  ))}
              </div>
            </div>

            {/* CENTER: Interactive Block Stack + Code Sync */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#0C0E12]">
              <div className="px-4 py-2 border-b border-[#262B33] bg-[#12151A] flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Puzzle className="w-4 h-4 text-violet-400" />
                  <span className="font-semibold">
                    {language === 'ru'
                      ? `Стек блоков (${blocksTree.length})`
                      : `Visual Block Program (${blocksTree.length})`}
                  </span>
                  {selectedHookId && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                      {language === 'ru' ? 'Добавление внутрь события' : 'Target: inside selected hook'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => switchView('studio')}
                    className="px-2.5 py-1 rounded-md border border-[#262B33] hover:border-[#10B981]/50 text-[#10B981] text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>{language === 'ru' ? 'Открыть текст DRPL' : 'Open Text Code'}</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
                {blocksTree.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#9CA3AF] space-y-3">
                    <Puzzle className="w-10 h-10 text-violet-400 opacity-70" />
                    <div className="text-sm font-semibold text-[#E5E7EB]">
                      {language === 'ru' ? 'Поле блоков пока пустое' : 'No blocks yet'}
                    </div>
                    <p className="text-xs max-w-sm">
                      {language === 'ru'
                        ? 'Нажимайте на блоки слева (3D, 2D, App, События, Логика) — они соберутся в готовую программу и сразу отрендерятся на сцене!'
                        : 'Click blocks on the left (Events, Logic, 3D, 2D, App) to assemble your program and render it live!'}
                    </p>
                    <button
                      type="button"
                      onClick={() => addBlockFromSnippet('use3d(lighting="studio", bloom=1.1, shadows=true)')}
                      className="px-3.5 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{language === 'ru' ? 'Начать с 3D сцены (use3d)' : 'Start with use3d Engine'}</span>
                    </button>
                  </div>
                ) : (
                  blocksTree.map((blk, idx) => {
                    if (blk.kind === 'hook') {
                      const isTarget = selectedHookId === blk.id;
                      return (
                        <div
                          key={blk.id}
                          className={clsx(
                            'rounded-xl border p-3 space-y-2 transition-colors',
                            isTarget
                              ? 'border-amber-400 bg-amber-500/12'
                              : 'border-amber-500/40 bg-amber-500/6'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedHookId(isTarget ? null : blk.id)}
                              className="flex items-center gap-2 font-mono font-bold text-xs text-amber-400 cursor-pointer"
                            >
                              <ChevronRight className={clsx('w-4 h-4 transition-transform', isTarget && 'rotate-90')} />
                              <span>{blk.hookName}</span>
                              <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                                {isTarget
                                  ? (language === 'ru' ? 'Выбрано для добавления' : 'Active target')
                                  : (language === 'ru' ? 'Клик — добавлять внутрь' : 'Click to add inside')}
                              </span>
                            </button>
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => moveBlock(null, idx, -1)} className="p-1 rounded hover:bg-white/10 text-[#9CA3AF] cursor-pointer"><ArrowUp className="w-3.5 h-3.5" /></button>
                              <button type="button" onClick={() => moveBlock(null, idx, 1)} className="p-1 rounded hover:bg-white/10 text-[#9CA3AF] cursor-pointer"><ArrowDown className="w-3.5 h-3.5" /></button>
                              <button type="button" onClick={() => deleteBlock(null, blk.id)} className="p-1 rounded hover:bg-rose-500/20 text-rose-400 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>

                          <div className="pl-4 space-y-2 border-l-2 border-amber-500/35">
                            {(blk.children || []).length === 0 ? (
                              <div className="text-[11px] font-mono text-amber-200/50 py-1">
                                {language === 'ru'
                                  ? '// Выберите блок слева — он добавится сюда'
                                  : '// Select this hook and click blocks on the left'}
                              </div>
                            ) : (
                              (blk.children || []).map((ch, cIdx) => {
                                const chColor = ch.compName ? DRPL_COMPONENT_COLOR_MAP[ch.compName] || '#10B981' : '#A78BFA';
                                return (
                                  <div
                                    key={ch.id}
                                    style={{ borderColor: `${chColor}55` }}
                                    className="p-2.5 rounded-lg border bg-[#111315] space-y-2"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: chColor }} />
                                        <span className="font-mono font-bold text-xs truncate" style={{ color: chColor }}>
                                          {ch.compName || (ch.kind === 'logic' ? 'logic' : 'code')}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button type="button" onClick={() => moveBlock(blk.id, cIdx, -1)} className="p-1 rounded hover:bg-white/10 text-[#9CA3AF] cursor-pointer"><ArrowUp className="w-3 h-3" /></button>
                                        <button type="button" onClick={() => moveBlock(blk.id, cIdx, 1)} className="p-1 rounded hover:bg-white/10 text-[#9CA3AF] cursor-pointer"><ArrowDown className="w-3 h-3" /></button>
                                        <button type="button" onClick={() => deleteBlock(blk.id, ch.id)} className="p-1 rounded hover:bg-rose-500/20 text-rose-400 cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                                      </div>
                                    </div>
                                    {ch.kind === 'component' && ch.args ? (
                                      <div className="flex flex-wrap gap-1.5">
                                        {ch.args.map((arg, aIdx) => (
                                          <label key={aIdx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0A0C0E] border border-[#262B33] text-[11px] font-mono">
                                            <span className="text-[#93C5FD]">{arg.key}=</span>
                                            <input
                                              type="text"
                                              value={arg.value}
                                              onChange={e => updateComponentArg(blk.id, ch.id, aIdx, e.target.value)}
                                              className="w-20 bg-transparent text-[#FDBA74] focus:outline-none"
                                            />
                                          </label>
                                        ))}
                                      </div>
                                    ) : (
                                      <input
                                        type="text"
                                        value={ch.rawLine || ''}
                                        onChange={e => updateRawLineBlock(blk.id, ch.id, e.target.value)}
                                        className="w-full px-2 py-1 rounded bg-[#0A0C0E] border border-[#262B33] font-mono text-[11px] text-[#E5E7EB] focus:outline-none focus:border-violet-400"
                                      />
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                          <div className="font-mono font-bold text-xs text-amber-400">end</div>
                        </div>
                      );
                    }

                    const blkColor = blk.compName ? DRPL_COMPONENT_COLOR_MAP[blk.compName] || '#10B981' : '#A78BFA';
                    return (
                      <div
                        key={blk.id}
                        style={{ borderColor: `${blkColor}55` }}
                        className="p-3 rounded-xl border bg-[#14171C] space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: blkColor }} />
                            <span className="font-mono font-bold text-xs truncate" style={{ color: blkColor }}>
                              {blk.compName || (blk.kind === 'logic' ? 'logic' : 'code')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => moveBlock(null, idx, -1)} className="p-1 rounded hover:bg-white/10 text-[#9CA3AF] cursor-pointer"><ArrowUp className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => moveBlock(null, idx, 1)} className="p-1 rounded hover:bg-white/10 text-[#9CA3AF] cursor-pointer"><ArrowDown className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => deleteBlock(null, blk.id)} className="p-1 rounded hover:bg-rose-500/20 text-rose-400 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        {blk.kind === 'component' && blk.args ? (
                          <div className="flex flex-wrap gap-1.5">
                            {blk.args.map((arg, aIdx) => (
                              <label key={aIdx} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#0A0C0E] border border-[#262B33] text-[11px] font-mono">
                                <span className="text-[#93C5FD]">{arg.key}=</span>
                                <input
                                  type="text"
                                  value={arg.value}
                                  onChange={e => updateComponentArg(null, blk.id, aIdx, e.target.value)}
                                  className="w-24 bg-transparent text-[#FDBA74] focus:outline-none"
                                />
                              </label>
                            ))}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={blk.rawLine || ''}
                            onChange={e => updateRawLineBlock(null, blk.id, e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#0A0C0E] border border-[#262B33] font-mono text-xs text-[#E5E7EB] focus:outline-none focus:border-violet-400"
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Synced Code Preview Strip */}
              <div className="border-t border-[#262B33] bg-[#0A0C0E] px-3 py-2 flex items-center justify-between gap-2 text-[11px] font-mono text-[#9CA3AF]">
                <span className="truncate">
                  {drplCode ? `${codeLines.length} lines generated` : '// Ready'}
                </span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(drplCode)}
                  className="px-2 py-0.5 rounded border border-[#262B33] hover:text-[#10B981] flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy DRPL</span>
                </button>
              </div>
            </div>

            {/* RIGHT: Live Preview Viewport */}
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
        ) : (
        /* ============================================================ */
        /* STUDIO IDE VIEW (With Tab Autocomplete Popup)                */
        /* ============================================================ */
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT: Massive DRPL Component Library (Each Colorized) */}
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

          {/* CENTER: DRPL Hybrid Code Editor with Tab Autocomplete */}
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
                <span className="text-[#10B981] font-semibold">Tab = Autocomplete</span>
                <span>•</span>
                <span className="text-sky-400">let / int / float / vec3</span>
                <span>•</span>
                <span className="text-amber-400">started? / frame? / end</span>
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

            {/* Editor Area: Synced Line Gutter + Highlight Overlay + Transparent Textarea + Floating Autocomplete */}
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

              <div ref={editorWrapperRef} className="relative flex-1 min-w-0 h-full overflow-hidden">
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
                      {'// Start typing a letter (e.g. "c", "u", "f") and press Tab to autocomplete!'}
                    </span>
                  )}
                </pre>
                <textarea
                  ref={editorRef}
                  value={drplCode}
                  onChange={e => {
                    const nextVal = e.target.value;
                    setDrplCode(nextVal);
                    evaluateAutocompleteAtCursor(nextVal, e.currentTarget);
                  }}
                  onClick={e => evaluateAutocompleteAtCursor(drplCode, e.currentTarget)}
                  onBlur={() => {
                    setTimeout(() => setAutocompleteOpen(false), 140);
                  }}
                  onScroll={handleEditorScroll}
                  onKeyDown={handleEditorKeyDown}
                  wrap="off"
                  spellCheck={false}
                  autoComplete="off"
                  style={{ tabSize: 2 }}
                  className="relative z-10 w-full h-full resize-none bg-transparent text-transparent caret-[#10B981] font-mono text-xs leading-6 p-3 focus:outline-none overflow-auto whitespace-pre selection:bg-[#10B981]/25 custom-scrollbar"
                />

                {/* IDE Tab Autocomplete Popup */}
                {autocompleteOpen && autocompleteMatches.length > 0 && (
                  <div
                    style={{ top: `${autocompletePos.top}px`, left: `${autocompletePos.left}px` }}
                    className="absolute z-40 w-72 sm:w-80 max-h-56 overflow-y-auto rounded-xl border border-[#2A313D] bg-[#141820] shadow-2xl p-1.5 space-y-0.5 custom-scrollbar"
                  >
                    <div className="px-2 py-1 text-[10px] font-mono text-[#6B7280] flex items-center justify-between border-b border-[#222731] mb-1">
                      <span>
                        {language === 'ru' ? `Подсказки для «${autocompletePrefix}»` : `Matches for "${autocompletePrefix}"`}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[#10B981] font-bold">
                        <CornerDownLeft className="w-2.5 h-2.5" /> Tab / Enter
                      </span>
                    </div>
                    {autocompleteMatches.map((item, idx) => {
                      const active = idx === autocompleteIdx;
                      return (
                        <button
                          key={`${item.kind}_${item.name}`}
                          type="button"
                          onMouseDown={e => {
                            e.preventDefault();
                            applyAutocomplete(item);
                          }}
                          onMouseEnter={() => setAutocompleteIdx(idx)}
                          className={clsx(
                            'w-full text-left px-2 py-1.5 rounded-lg flex items-start justify-between gap-2 cursor-pointer transition-colors',
                            active ? 'bg-[#10B981]/18 border border-[#10B981]/45' : 'border border-transparent hover:bg-white/5'
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-xs shrink-0"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="font-mono text-xs font-bold truncate" style={{ color: item.color }}>
                                {item.name}
                              </span>
                            </div>
                            <div className="text-[10px] text-[#9CA3AF] truncate mt-0.5">
                              {item.description}
                            </div>
                          </div>
                          <span
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 border"
                            style={{
                              color: item.color,
                              borderColor: `${item.color}40`,
                              backgroundColor: `${item.color}15`
                            }}
                          >
                            {item.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
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
