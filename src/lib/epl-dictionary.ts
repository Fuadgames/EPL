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
  'check': { word: 'check', type: 'control', color: 'text-purple-500', description: 'Evaluates a logical expression.', schema: { expression: 'string' } },
  'return': { word: 'return', type: 'control', color: 'text-purple-500', description: 'Exits the current block.', schema: { value: 'string' } },
  'stop': { word: 'stop', type: 'control', color: 'text-purple-500', description: 'Stops the execution.' },
  'repeat': { word: 'repeat', type: 'control', color: 'text-purple-500', description: 'Repeats a block.', schema: { times: 'number' } },
  'forever': { word: 'forever', type: 'control', color: 'text-purple-500', description: 'Repeats indefinitely.' },
  'wait': { word: 'wait', type: 'control', color: 'text-purple-500', description: 'Pauses execution.', schema: { seconds: 'number' } },
  'variable_activated?': { word: 'variable_activated?', type: 'event', color: 'text-purple-500', description: 'Triggered when a specific custom variable is activated.', schema: { var: 'string' } },
  
  // Events
  'started?': { word: 'started?', type: 'event', color: 'text-orange-500', description: 'Triggered when app starts.' },
  'created?': { word: 'created?', type: 'event', color: 'text-orange-500', description: 'Triggered when entity created.', schema: { target: 'string' } },
  'clicked?': { word: 'clicked?', type: 'event', color: 'text-orange-500', description: 'Triggered when entity clicked.', schema: { target: 'string' } },
  'collided?': { word: 'collided?', type: 'event', color: 'text-orange-500', description: 'Triggered on collision.', schema: { targetA: 'string', targetB: 'string' } },
  'key_pressed?': { word: 'key_pressed?', type: 'event', color: 'text-orange-500', description: 'Triggered when key pressed.', schema: { key: 'string' } },
  'writed?': { word: 'writed?', type: 'event', color: 'text-orange-500', description: 'Triggered when text entered.', schema: { target: 'string', text: 'string' } },
  'timer_tick?': { word: 'timer_tick?', type: 'event', color: 'text-orange-500', description: 'Triggered by timer.', schema: { name: 'string' } },
  'file_added?': { word: 'file_added?', type: 'event', color: 'text-orange-500', description: 'Triggered when file added.', schema: { target: 'string' } },
  'input': { word: 'input', type: 'event', color: 'text-orange-500', description: 'Binds interaction to specific arbitrary keys chosen by user.', schema: { key: 'string', variable: 'string' } },
  
  // Actions
  'set up': { word: 'set up', type: 'action', color: 'text-blue-500', description: 'Updates a property.', schema: { target: 'string', property: 'string', value: 'string' } },
  'background': { word: 'background', type: 'action', color: 'text-blue-500', description: 'Changes background.', schema: { color: 'string', image: 'string' } },
  'move': { word: 'move', type: 'action', color: 'text-blue-500', description: 'Moves an entity.', schema: { target: 'string', x: 'string', y: 'string', speed: 'number' } },
  'stop_move': { word: 'stop_move', type: 'action', color: 'text-blue-500', description: 'Stops movement of an entity.', schema: { target: 'string' } },
  'create': { word: 'create', type: 'action', color: 'text-blue-500', description: 'Instantiates an entity.' },
  'type': { word: 'type', type: 'action', color: 'text-blue-500', description: 'Prints a message.', schema: { text: 'string' } },
  'destroy': { word: 'destroy', type: 'action', color: 'text-blue-500', description: 'Removes an entity.', schema: { target: 'string' } },
  'hide': { word: 'hide', type: 'action', color: 'text-blue-500', description: 'Hides entity.', schema: { target: 'string' } },
  'show': { word: 'show', type: 'action', color: 'text-blue-500', description: 'Shows entity.', schema: { target: 'string' } },
  'rotate': { word: 'rotate', type: 'action', color: 'text-blue-500', description: 'Rotates entity.', schema: { target: 'string', degrees: 'number' } },
  'scale': { word: 'scale', type: 'action', color: 'text-blue-500', description: 'Changes size.', schema: { target: 'string', factor: 'number' } },
  'play_sound': { word: 'play_sound', type: 'action', color: 'text-blue-500', description: 'Plays sound.', schema: { sound: 'string', volume: 'number' } },
  'stop_sound': { word: 'stop_sound', type: 'action', color: 'text-blue-500', description: 'Stops sound.', schema: { sound: 'string' } },
  'clear': { word: 'clear', type: 'action', color: 'text-blue-500', description: 'Clears output.' },
  'ai': { word: 'ai', type: 'action', color: 'text-purple-600', description: 'Uses AI.', schema: { mode: 'options', prompt: 'string', target: 'string' }, options: ['text', 'changes'] },
  'math': { word: 'math', type: 'action', color: 'text-blue-500', description: 'Performs math.', schema: { target: 'string', op: 'options', value: 'string' }, options: ['add', 'subtract', 'multiply', 'divide', 'set'] },
  'random': { word: 'random', type: 'action', color: 'text-blue-500', description: 'Randomizes next action execution.', schema: { chance: 'number' } },
  'variable': { word: 'variable', type: 'action', color: 'text-blue-500', description: 'Updates variable.', schema: { name: 'string', value: 'string' } },
  'activate_variable': { word: 'activate_variable', type: 'action', color: 'text-blue-500', description: 'Activates multiple predefined variables manually.', schema: { variables: 'string' } },
  'open': { word: 'open', type: 'action', color: 'text-blue-500', description: 'Opens file dialog.', schema: { target: 'string' } },
  'cursor': { word: 'cursor', type: 'action', color: 'text-blue-500', description: 'Changes cursor.', schema: { image: 'string' } },
  'move_to': { word: 'move_to', type: 'action', color: 'text-blue-500', description: 'Moves entity abruptly.', schema: { target: 'string', x: 'number', y: 'number' } },
  'draggable': { word: 'draggable', type: 'action', color: 'text-blue-500', description: 'Makes entity draggable.', schema: { target: 'string' } },
  'unlock_premium': { word: 'unlock_premium', type: 'action', color: 'text-purple-500', description: 'Unlocks features.', schema: {} },
  'design': { word: 'design', type: 'action', color: 'text-blue-500', description: 'Opens a mini graphical Photoshop-like editor to edit background or object visuals directly.', schema: { target: 'string' } },
  'position': { word: 'position', type: 'action', color: 'text-blue-500', description: 'Helps visually resize or drag entity positions in a minimap for 2D/3D instances.', schema: { target: 'string', scale: 'number' } },

  'corner': { word: 'corner', type: 'action', color: 'text-blue-500', description: 'Rounds the corners of an entity.', schema: { target: 'string', radius: 'number' } },

  // Entities
  'control': { word: 'control', type: 'entity', color: 'text-emerald-500', description: 'Enables specialized controls.', schema: { type: 'string', variable: 'string', spawnComponent: 'boolean' } },
  'object': { word: 'object', type: 'entity', color: 'text-emerald-500', description: 'Scopes actions.', schema: { name: 'string', variable: 'string', spawnComponent: 'boolean' } },
  'world': { word: 'world', type: 'entity', color: 'text-emerald-500', description: 'The global environment.', schema: { background: 'string', gravity: 'number', variable: 'string', spawnComponent: 'boolean' } },
  'button': { word: 'button', type: 'entity', color: 'text-emerald-500', description: 'Clickable button.', schema: { name: 'string', label: 'string', color: 'string', x: 'number', y: 'number', corner: 'number', variable: 'string', spawnComponent: 'boolean' } },
  'block': { word: 'block', type: 'entity', color: 'text-emerald-500', description: 'Solid 2D rectangle.', schema: { name: 'string', width: 'number', height: 'number', color: 'string', x: 'number', y: 'number', corner: 'number', variable: 'string', spawnComponent: 'boolean' } },
  '3Dblock': { word: '3Dblock', type: 'entity', color: 'text-emerald-500', description: 'A 3D cube model component.', schema: { name: 'string', size: 'number', color: 'string', x: 'number', y: 'number', z: 'number', corner: 'number', variable: 'string', spawnComponent: 'boolean' } },
  '3DCamera': { word: '3DCamera', type: 'entity', color: 'text-emerald-500', description: 'Camera controller for full 3D environment interaction.', schema: { name: 'string', lookAt: 'string', mouseLook: 'boolean', scrollZoom: 'boolean', variable: 'string', spawnComponent: 'boolean' } },
  '3DEditor': { word: '3DEditor', type: 'entity', color: 'text-emerald-500', description: 'A mini 3D editor component supporting GLTF imports.', schema: { name: 'string', target: 'string', variable: 'string', spawnComponent: 'boolean' } },
  'sprite': { word: 'sprite', type: 'entity', color: 'text-emerald-500', description: '2D image character.', schema: { name: 'string', image: 'string', hitbox: 'string', x: 'number', y: 'number', corner: 'number', variable: 'string', spawnComponent: 'boolean' } },
  'png': { word: 'png', type: 'entity', color: 'text-emerald-500', description: 'Static image.', schema: { name: 'string', file: 'string', x: 'number', y: 'number', corner: 'number', variable: 'string', spawnComponent: 'boolean' } },
  'text_label': { word: 'text_label', type: 'entity', color: 'text-emerald-500', description: 'Static text.', schema: { name: 'string', text: 'string', color: 'string', x: 'number', y: 'number', variable: 'string', spawnComponent: 'boolean' } },
  'particle': { word: 'particle', type: 'entity', color: 'text-emerald-500', description: 'Visual effects.', schema: { name: 'string', type: 'string', count: 'number', x: 'number', y: 'number', variable: 'string', spawnComponent: 'boolean' } },
  'sound': { word: 'sound', type: 'entity', color: 'text-emerald-500', description: 'Audio asset.', schema: { name: 'string', file: 'string', variable: 'string', spawnComponent: 'boolean' } },
  'timer': { word: 'timer', type: 'entity', color: 'text-emerald-500', description: 'Triggers events.', schema: { name: 'string', interval: 'number', variable: 'string', spawnComponent: 'boolean' } },
  'player': { word: 'player', type: 'entity', color: 'text-emerald-500', description: 'Controllable character.', schema: { name: 'string', speed: 'number', health: 'number', x: 'number', y: 'number', corner: 'number', variable: 'string', spawnComponent: 'boolean' } },
  'enemy': { word: 'enemy', type: 'entity', color: 'text-emerald-500', description: 'Hostile entity.', schema: { name: 'string', damage: 'number', ai: 'string', x: 'number', y: 'number', corner: 'number', variable: 'string', spawnComponent: 'boolean' } },
  'textbox': { word: 'textbox', type: 'entity', color: 'text-emerald-500', description: 'Input field.', schema: { name: 'string', placeholder: 'string', text: 'string', x: 'number', y: 'number', width: 'number', corner: 'number', variable: 'string', spawnComponent: 'boolean' } },
  'circle': { word: 'circle', type: 'entity', color: 'text-emerald-500', description: '2D circle.', schema: { name: 'string', radius: 'number', color: 'string', x: 'number', y: 'number', corner: 'number', variable: 'string', spawnComponent: 'boolean' } },
  'line': { word: 'line', type: 'entity', color: 'text-emerald-500', description: 'Connecting line.', schema: { name: 'string', x1: 'number', y1: 'number', x2: 'number', y2: 'number', color: 'string', thickness: 'number', variable: 'string', spawnComponent: 'boolean' } },
  'file': { word: 'file', type: 'entity', color: 'text-emerald-500', description: 'File asset.', schema: { name: 'string', path: 'string', variable: 'string', spawnComponent: 'boolean' } },
  'wasd_controls': { word: 'wasd_controls', type: 'entity', color: 'text-emerald-500', description: 'WASD movement.', schema: { name: 'string', target: 'string', step: 'number', duration: 'number', variable: 'string', spawnComponent: 'boolean' } },
  'gradient': { word: 'gradient', type: 'entity', color: 'text-emerald-500', description: 'Decorative gradient background blob.', schema: { name: 'string', variant: 'options', x: 'number', y: 'number', size: 'number', variable: 'string', spawnComponent: 'boolean' }, options: ['emerald', 'purple', 'blue'] },
  'terminal': { word: 'terminal', type: 'entity', color: 'text-emerald-500', description: 'Terminal component.', schema: { name: 'string', x: 'number', y: 'number', width: 'number', height: 'number', text: 'string', variable: 'string', spawnComponent: 'boolean' } },
};

// Sort keywords by length descending so longer phrases like "set up" match before "set"
export const KEYWORDS = Object.keys(EPL_DICTIONARY).sort((a, b) => b.length - a.length);

// Escape keywords for regex
const ESCAPED_KEYWORDS = KEYWORDS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

// Regex matches: (keyword) \s* {settings} or just (keyword) or (#comment)
// We add \s* to allow spaces between the keyword and its settings block, which AI often generates!
export const TOKEN_REGEX = new RegExp(`(${ESCAPED_KEYWORDS.join('|')})(?:\\s*\\{([^}]*)\\})?|(#.*)`, 'g');

