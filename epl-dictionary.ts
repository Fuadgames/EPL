export type TokenType = 'control' | 'event' | 'action' | 'entity' | 'property';

export interface TokenDef {
  word: string;
  type: TokenType;
  color: string;
  schema?: Record<string, 'string' | 'number' | 'boolean' | 'options'>;
  options?: string[]; // For 'options' type
}

export const EPL_DICTIONARY: Record<string, TokenDef> = {
  // Control Flow
  'if': { word: 'if', type: 'control', color: 'text-purple-500' },
  'else': { word: 'else', type: 'control', color: 'text-purple-500' },
  'then': { word: 'then', type: 'control', color: 'text-purple-500' },
  'end': { word: 'end', type: 'control', color: 'text-purple-500' },
  'check': { word: 'check', type: 'control', color: 'text-purple-500', schema: { expression: 'string' } },
  'return': { word: 'return', type: 'control', color: 'text-purple-500', schema: { value: 'string' } },
  'stop': { word: 'stop', type: 'control', color: 'text-purple-500' },
  'repeat': { word: 'repeat', type: 'control', color: 'text-purple-500', schema: { times: 'number' } },
  'forever': { word: 'forever', type: 'control', color: 'text-purple-500' },
  'wait': { word: 'wait', type: 'control', color: 'text-purple-500', schema: { seconds: 'number' } },
  
  // Events
  'started?': { word: 'started?', type: 'event', color: 'text-orange-500' },
  'created?': { word: 'created?', type: 'event', color: 'text-orange-500', schema: { target: 'string' } },
  'clicked?': { word: 'clicked?', type: 'event', color: 'text-orange-500', schema: { target: 'string' } },
  'collided?': { word: 'collided?', type: 'event', color: 'text-orange-500', schema: { targetA: 'string', targetB: 'string' } },
  'key_pressed?': { word: 'key_pressed?', type: 'event', color: 'text-orange-500', schema: { key: 'string' } },
  'writed?': { word: 'writed?', type: 'event', color: 'text-orange-500', schema: { target: 'string', text: 'string' } },
  'timer_tick?': { word: 'timer_tick?', type: 'event', color: 'text-orange-500', schema: { name: 'string' } },
  'control': { word: 'control', type: 'control', color: 'text-purple-500', schema: { type: 'string' } },
  
  // Actions
  'set up': { word: 'set up', type: 'action', color: 'text-blue-500', schema: { target: 'string', property: 'string', value: 'string' } },
  'background': { word: 'background', type: 'action', color: 'text-blue-500', schema: { color: 'string', image: 'string' } },
  'move': { word: 'move', type: 'action', color: 'text-blue-500', schema: { target: 'string', x: 'number', y: 'number', speed: 'number' } },
  'create': { word: 'create', type: 'action', color: 'text-blue-500' },
  'type': { word: 'type', type: 'action', color: 'text-blue-500', schema: { text: 'string' } },
  'destroy': { word: 'destroy', type: 'action', color: 'text-blue-500', schema: { target: 'string' } },
  'hide': { word: 'hide', type: 'action', color: 'text-blue-500', schema: { target: 'string' } },
  'show': { word: 'show', type: 'action', color: 'text-blue-500', schema: { target: 'string' } },
  'rotate': { word: 'rotate', type: 'action', color: 'text-blue-500', schema: { target: 'string', degrees: 'number' } },
  'scale': { word: 'scale', type: 'action', color: 'text-blue-500', schema: { target: 'string', factor: 'number' } },
  'play_sound': { word: 'play_sound', type: 'action', color: 'text-blue-500', schema: { sound: 'string', volume: 'number' } },
  'stop_sound': { word: 'stop_sound', type: 'action', color: 'text-blue-500', schema: { sound: 'string' } },
  'clear': { word: 'clear', type: 'action', color: 'text-blue-500' },
  'ai': { word: 'ai', type: 'action', color: 'text-purple-600', schema: { mode: 'options', prompt: 'string', target: 'string' }, options: ['text', 'changes'] },
  'object': { word: 'object', type: 'entity', color: 'text-orange-500', schema: { name: 'string' } },
  
  // Entities
  'world': { word: 'world', type: 'entity', color: 'text-emerald-500', schema: { background: 'string', gravity: 'number' } },
  'button': { word: 'button', type: 'entity', color: 'text-emerald-500', schema: { name: 'string', label: 'string', color: 'string', x: 'number', y: 'number' } },
  'block': { word: 'block', type: 'entity', color: 'text-emerald-500', schema: { name: 'string', width: 'number', height: 'number', color: 'string', x: 'number', y: 'number' } },
  '3Dblock': { word: '3Dblock', type: 'entity', color: 'text-emerald-500', schema: { name: 'string', size: 'number', color: 'string', x: 'number', y: 'number', z: 'number' } },
  'sprite': { word: 'sprite', type: 'entity', color: 'text-emerald-500', schema: { name: 'string', image: 'string', hitbox: 'string', x: 'number', y: 'number' } },
  'png': { word: 'png', type: 'entity', color: 'text-emerald-500', schema: { name: 'string', file: 'string', x: 'number', y: 'number' } },
  'text_label': { word: 'text_label', type: 'entity', color: 'text-emerald-500', schema: { name: 'string', text: 'string', color: 'string', x: 'number', y: 'number' } },
  'particle': { word: 'particle', type: 'entity', color: 'text-emerald-500', schema: { name: 'string', type: 'string', count: 'number', x: 'number', y: 'number' } },
  'sound': { word: 'sound', type: 'entity', color: 'text-emerald-500', schema: { name: 'string', file: 'string' } },
  'timer': { word: 'timer', type: 'entity', color: 'text-emerald-500', schema: { name: 'string', interval: 'number' } },
  'player': { word: 'player', type: 'entity', color: 'text-emerald-500', schema: { name: 'string', speed: 'number', health: 'number', x: 'number', y: 'number' } },
  'enemy': { word: 'enemy', type: 'entity', color: 'text-emerald-500', schema: { name: 'string', damage: 'number', ai: 'string', x: 'number', y: 'number' } },
  'textbox': { word: 'textbox', type: 'entity', color: 'text-emerald-500', schema: { name: 'string', placeholder: 'string', text: 'string', x: 'number', y: 'number', width: 'number' } },
};

// Sort keywords by length descending so longer phrases like "set up" match before "set"
export const KEYWORDS = Object.keys(EPL_DICTIONARY).sort((a, b) => b.length - a.length);

// Escape keywords for regex
const ESCAPED_KEYWORDS = KEYWORDS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

// Regex matches: (keyword){settings} or just (keyword) or (#comment)
export const TOKEN_REGEX = new RegExp(`(${ESCAPED_KEYWORDS.join('|')})(?:\\{([^}]*)\\})?|(#.*)`, 'g');
