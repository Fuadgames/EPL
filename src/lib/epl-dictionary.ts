export type TokenType = 'control' | 'event' | 'action' | 'entity' | 'property';

export interface TokenDef {
  word: string;
  type: TokenType;
  color: string;
  description?: string;
  schema?: Record<string, 'string' | 'number' | 'boolean' | 'options'>;
  options?: string[]; // For 'options' type
}

export const EPL_DICTIONARY: Record<string, TokenDef> = {
  // Control Flow
  'if': { word: 'if', type: 'control', color: 'text-purple-500', description: 'Starts a conditional block. Executes code if the check is true.' },
  'else': { word: 'else', type: 'control', color: 'text-purple-500', description: 'Executes code if the preceding "if" check was false.' },
  'then': { word: 'then', type: 'control', color: 'text-purple-500', description: 'Optional keyword used after "if" or "check".' },
  'end': { word: 'end', type: 'control', color: 'text-purple-500', description: 'Ends a block of code (if, object, event, etc.).' },
  'check': { word: 'check', type: 'control', color: 'text-purple-500', description: 'Evaluates a logical expression (e.g., Player.x > 100).', schema: { expression: 'string' } },
  'return': { word: 'return', type: 'control', color: 'text-purple-500', description: 'Exits the current block and optionally returns a value.', schema: { value: 'string' } },
  'stop': { word: 'stop', type: 'control', color: 'text-purple-500', description: 'Stops the execution of the current script.' },
  'repeat': { word: 'repeat', type: 'control', color: 'text-purple-500', description: 'Repeats a block of code a specific number of times.', schema: { times: 'number' } },
  'forever': { word: 'forever', type: 'control', color: 'text-purple-500', description: 'Repeats a block of code indefinitely.' },
  'wait': { word: 'wait', type: 'control', color: 'text-purple-500', description: 'Pauses execution for a specified amount of time.', schema: { seconds: 'number' } },
  
  // Events
  'started?': { word: 'started?', type: 'event', color: 'text-orange-500', description: 'Triggered when the application first starts.' },
  'created?': { word: 'created?', type: 'event', color: 'text-orange-500', description: 'Triggered when a specific entity is created.', schema: { target: 'string' } },
  'clicked?': { word: 'clicked?', type: 'event', color: 'text-orange-500', description: 'Triggered when a specific entity is clicked.', schema: { target: 'string' } },
  'collided?': { word: 'collided?', type: 'event', color: 'text-orange-500', description: 'Triggered when two entities collide.', schema: { targetA: 'string', targetB: 'string' } },
  'key_pressed?': { word: 'key_pressed?', type: 'event', color: 'text-orange-500', description: 'Triggered when a keyboard key is pressed.', schema: { key: 'string' } },
  'writed?': { word: 'writed?', type: 'event', color: 'text-orange-500', description: 'Triggered when text is entered into a textbox.', schema: { target: 'string', text: 'string' } },
  'timer_tick?': { word: 'timer_tick?', type: 'event', color: 'text-orange-500', description: 'Triggered repeatedly by a timer entity.', schema: { name: 'string' } },
  'control': { word: 'control', type: 'control', color: 'text-purple-500', description: 'Enables specialized control modes like WASD movement.', schema: { type: 'string' } },
  
  // Actions
  'set up': { word: 'set up', type: 'action', color: 'text-blue-500', description: 'Updates a property of an existing entity.', schema: { target: 'string', property: 'string', value: 'string' } },
  'background': { word: 'background', type: 'action', color: 'text-blue-500', description: 'Changes the world background color or image.', schema: { color: 'string', image: 'string' } },
  'move': { word: 'move', type: 'action', color: 'text-blue-500', description: 'Changes the position of an entity (x, y).', schema: { target: 'string', x: 'number', y: 'number', speed: 'number' } },
  'create': { word: 'create', type: 'action', color: 'text-blue-500', description: 'Instantiates a new entity in the world.' },
  'type': { word: 'type', type: 'action', color: 'text-blue-500', description: 'Prints a message to the console or log.', schema: { text: 'string' } },
  'destroy': { word: 'destroy', type: 'action', color: 'text-blue-500', description: 'Removes an entity from the world.', schema: { target: 'string' } },
  'hide': { word: 'hide', type: 'action', color: 'text-blue-500', description: 'Makes an entity invisible.', schema: { target: 'string' } },
  'show': { word: 'show', type: 'action', color: 'text-blue-500', description: 'Makes an entity visible.', schema: { target: 'string' } },
  'rotate': { word: 'rotate', type: 'action', color: 'text-blue-500', description: 'Rotates an entity by a number of degrees.', schema: { target: 'string', degrees: 'number' } },
  'scale': { word: 'scale', type: 'action', color: 'text-blue-500', description: 'Changes the size of an entity.', schema: { target: 'string', factor: 'number' } },
  'play_sound': { word: 'play_sound', type: 'action', color: 'text-blue-500', description: 'Plays a sound entity.', schema: { sound: 'string', volume: 'number' } },
  'stop_sound': { word: 'stop_sound', type: 'action', color: 'text-blue-500', description: 'Stops a playing sound.', schema: { sound: 'string' } },
  'clear': { word: 'clear', type: 'action', color: 'text-blue-500', description: 'Clears the console output.' },
  'ai': { word: 'ai', type: 'action', color: 'text-purple-600', description: 'Uses AI to generate text or modify entities.', schema: { mode: 'options', prompt: 'string', target: 'string' }, options: ['text', 'changes'] },
  'math': { word: 'math', type: 'action', color: 'text-blue-500', description: 'Performs arithmetic operations on variables.', schema: { target: 'string', op: 'options', value: 'string' }, options: ['add', 'subtract', 'multiply', 'divide', 'set'] },
  'variable': { word: 'variable', type: 'action', color: 'text-blue-500', description: 'Creates or updates a variable.', schema: { name: 'string', value: 'string' } },
  'compare': { word: 'compare', type: 'control', color: 'text-purple-500', description: 'Compares two values for logic blocks.', schema: { a: 'string', op: 'options', b: 'string' }, options: ['>', '<', '==', '>=', '<=', '~='] },
  'object': { word: 'object', type: 'entity', color: 'text-orange-500', description: 'Scopes subsequent actions to a specific entity.', schema: { name: 'string' } },
  
  // Entities
  'world': { word: 'world', type: 'entity', color: 'text-emerald-500', description: 'The global environment settings.', schema: { background: 'string', gravity: 'number' } },
  'button': { word: 'button', type: 'entity', color: 'text-emerald-500', description: 'A clickable UI button.', schema: { name: 'string', label: 'string', color: 'string', x: 'number', y: 'number' } },
  'block': { word: 'block', type: 'entity', color: 'text-emerald-500', description: 'A solid 2D rectangle.', schema: { name: 'string', width: 'number', height: 'number', color: 'string', x: 'number', y: 'number' } },
  '3Dblock': { word: '3Dblock', type: 'entity', color: 'text-emerald-500', description: 'A 3D-style cube (isometric).', schema: { name: 'string', size: 'number', color: 'string', x: 'number', y: 'number', z: 'number' } },
  'sprite': { word: 'sprite', type: 'entity', color: 'text-emerald-500', description: 'A 2D image or character.', schema: { name: 'string', image: 'string', hitbox: 'string', x: 'number', y: 'number' } },
  'png': { word: 'png', type: 'entity', color: 'text-emerald-500', description: 'A static image entity.', schema: { name: 'string', file: 'string', x: 'number', y: 'number' } },
  'text_label': { word: 'text_label', type: 'entity', color: 'text-emerald-500', description: 'A static text display on the screen.', schema: { name: 'string', text: 'string', color: 'string', x: 'number', y: 'number' } },
  'particle': { word: 'particle', type: 'entity', color: 'text-emerald-500', description: 'Visual effects like fire or explosions.', schema: { name: 'string', type: 'string', count: 'number', x: 'number', y: 'number' } },
  'sound': { word: 'sound', type: 'entity', color: 'text-emerald-500', description: 'An audio asset.', schema: { name: 'string', file: 'string' } },
  'timer': { word: 'timer', type: 'entity', color: 'text-emerald-500', description: 'Triggers events at regular intervals.', schema: { name: 'string', interval: 'number' } },
  'player': { word: 'player', type: 'entity', color: 'text-emerald-500', description: 'The main controllable character.', schema: { name: 'string', speed: 'number', health: 'number', x: 'number', y: 'number' } },
  'enemy': { word: 'enemy', type: 'entity', color: 'text-emerald-500', description: 'An AI-controlled hostile entity.', schema: { name: 'string', damage: 'number', ai: 'string', x: 'number', y: 'number' } },
  'textbox': { word: 'textbox', type: 'entity', color: 'text-emerald-500', description: 'An input field for user text.', schema: { name: 'string', placeholder: 'string', text: 'string', x: 'number', y: 'number', width: 'number' } },
  'circle': { word: 'circle', type: 'entity', color: 'text-emerald-500', description: 'A 2D circle shape.', schema: { name: 'string', radius: 'number', color: 'string', x: 'number', y: 'number' } },
  'line': { word: 'line', type: 'entity', color: 'text-emerald-500', description: 'A line between two points.', schema: { name: 'string', x1: 'number', y1: 'number', x2: 'number', y2: 'number', color: 'string', thickness: 'number' } },
  'file': { word: 'file', type: 'entity', color: 'text-emerald-500', description: 'A file asset.', schema: { name: 'string', path: 'string' } },
  'open': { word: 'open', type: 'action', color: 'text-blue-500', description: 'Opens a file selection dialog.', schema: { target: 'string' } },
  'file_added?': { word: 'file_added?', type: 'event', color: 'text-orange-500', description: 'Triggered when a specific file is selected/added.', schema: { target: 'string' } },
  'cursor': { word: 'cursor', type: 'action', color: 'text-blue-500', description: 'Changes the cursor image.', schema: { image: 'string' } },
  'move_to': { word: 'move_to', type: 'action', color: 'text-blue-500', description: 'Moves an entity to specific coordinates.', schema: { target: 'string', x: 'number', y: 'number' } },
  'draggable': { word: 'draggable', type: 'action', color: 'text-blue-500', description: 'Makes an entity draggable by the cursor.', schema: { target: 'string' } },
  'wasd_controls': { word: 'wasd_controls', type: 'entity', color: 'text-emerald-500', description: 'Enables WASD movement for a target entity.', schema: { name: 'string', target: 'string', step: 'number', duration: 'number' } },
};

// Sort keywords by length descending so longer phrases like "set up" match before "set"
export const KEYWORDS = Object.keys(EPL_DICTIONARY).sort((a, b) => b.length - a.length);

// Escape keywords for regex
const ESCAPED_KEYWORDS = KEYWORDS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

// Regex matches: (keyword){settings} or just (keyword) or (#comment)
export const TOKEN_REGEX = new RegExp(`(${ESCAPED_KEYWORDS.join('|')})(?:\\{([^}]*)\\})?|(#.*)`, 'g');
