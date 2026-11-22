import { TOKEN_REGEX } from '@/src/lib/epl-dictionary';
import { generateWithAI } from './gemini';
import { extractDifrenoptBlock, isDifrenoptStartLine } from './drpl-catalog';

export type EPLValue = string | number | boolean | null;

export interface EPLEntity {
  id: string;
  type: string;
  [key: string]: any;
}

export interface EPLCameraState {
  shakeX: number;
  shakeY: number;
  zoom: number;
  follow?: string;
}

export interface EPLUpdateMeta {
  variables: Record<string, EPLValue>;
  camera: EPLCameraState;
}

interface EPLContext {
  variables: Record<string, EPLValue>;
  entities: Record<string, EPLEntity>;
  events: Record<string, string[]>;
  inputMappings: Record<string, string>;
  output: string[];
  isRunning: boolean;
  timers: Record<string, any>;
  currentObject: EPLEntity | null;
  controlType: 'wasd' | null;
  lastEventValue: string | null;
  lastClickedTarget?: string | null;
  lastClickedTime?: number | null;
  uiMode?: { type: string; target: string };
  pendingRandomChance: number | null;
}

const ENTITY_TYPES = new Set([
  'world', 'button', 'block', '3Dblock', '3DCamera', '3DEditor', 'sprite', 'png',
  'text_label', 'particle', 'sound', 'timer', 'player', 'enemy', 'textbox',
  'circle', 'line', 'wasd_controls', 'terminal', 'control', 'gradient',
  'progress', 'panel', 'checkbox', 'slider', 'difrenopt', 'linkto', 'file'
]);

const UI_WIDGET_TYPES = new Set([
  'world', 'button', 'text_label', 'textbox', 'terminal', 'wasd_controls',
  'timer', 'sound', '3DCamera', '3DEditor', 'gradient', 'progress', 'panel',
  'checkbox', 'slider', 'difrenopt', 'linkto', 'file'
]);

export class EPLInterpreter {
  context: EPLContext;
  onOutput: (msg: string) => void;
  onUIUpdate: (
    entities: Record<string, EPLEntity>,
    uiMode?: { type: string; target: string },
    meta?: EPLUpdateMeta
  ) => void;
  aiSettings: { answerMode: 'text' | 'console'; changesEnabled: boolean };
  purchasedItems: string[];
  uploadedFiles: { name: string; url: string }[];
  isPremium: boolean;
  keysPressed: Set<string> = new Set();
  animationFrameId: number | null = null;
  isMuted: boolean = false;

  private lastFrameTime: number = 0;
  private collisionCooldowns: Map<string, number> = new Map();
  private activeAudioMap: Map<string, HTMLAudioElement> = new Map();
  private audioCtx: AudioContext | null = null;
  private shakeState: { intensity: number; endTime: number } = { intensity: 0, endTime: 0 };
  private uiDirty: boolean = false;

  constructor(
    onOutput: (msg: string) => void,
    onUIUpdate: (
      entities: Record<string, EPLEntity>,
      uiMode?: { type: string; target: string },
      meta?: EPLUpdateMeta
    ) => void,
    aiSettings: { answerMode: 'text' | 'console'; changesEnabled: boolean },
    purchasedItems: string[] = [],
    isPremium: boolean = false,
    uploadedFiles: { name: string; url: string }[] = []
  ) {
    this.context = {
      variables: {},
      entities: {},
      events: {},
      inputMappings: {},
      output: [],
      isRunning: false,
      timers: {},
      currentObject: null,
      controlType: null,
      lastEventValue: null,
      lastClickedTarget: null,
      lastClickedTime: null,
      pendingRandomChance: null
    };
    this.onOutput = onOutput;
    this.onUIUpdate = onUIUpdate;
    this.aiSettings = aiSettings;
    this.purchasedItems = purchasedItems;
    this.isPremium = isPremium;
    this.uploadedFiles = uploadedFiles;
  }

  private emitUIUpdate() {
    const camEntity = Object.values(this.context.entities).find(e => e.type === '3DCamera');
    const now = performance.now();
    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeState.intensity > 0 && now < this.shakeState.endTime) {
      shakeX = (Math.random() - 0.5) * 2 * this.shakeState.intensity;
      shakeY = (Math.random() - 0.5) * 2 * this.shakeState.intensity;
    } else if (this.shakeState.intensity > 0) {
      this.shakeState.intensity = 0;
    }

    this.onUIUpdate({ ...this.context.entities }, this.context.uiMode, {
      variables: { ...this.context.variables },
      camera: {
        shakeX,
        shakeY,
        zoom: Number(camEntity?.zoom || 1),
        follow: camEntity?.follow
      }
    });
    this.uiDirty = false;
  }

  resolveUrl(value: string): string {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    const lower = trimmed.toLowerCase();
    const file = this.uploadedFiles.find(
      f => f.name === trimmed || f.name.toLowerCase() === lower
    );
    return file ? file.url : value;
  }

  private resolveFileEntry(fileRef?: string): { name: string; url: string } | null {
    const raw = String(fileRef || '').trim();
    if (!raw) return null;
    const lower = raw.toLowerCase();
    const found = this.uploadedFiles.find(
      f =>
        f.name === raw ||
        f.name.toLowerCase() === lower ||
        f.url === raw
    );
    if (found) return found;
    return { name: raw, url: raw };
  }

  private dispatchFileAction(actionType: 'linkto' | 'run', settings: Record<string, any>) {
    const rawRef = String(settings.file || settings.path || settings.target || settings.name || '').trim();
    if (!rawRef) {
      this.log(`[${actionType}] No file specified.`);
      return;
    }
    const resolved = this.resolveFileEntry(rawRef);
    const fileName = resolved?.name || rawRef;
    const fileUrl = resolved?.url || '';
    const hasUploadedMatch = this.uploadedFiles.some(
      f => f.name.toLowerCase() === fileName.toLowerCase() || f.url === fileUrl
    );
    this.log(`[${actionType}] ${fileName}${hasUploadedMatch ? '' : ' (not found locally — preparing download)'}`);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('epl:file-action', {
          detail: {
            actionType,
            fileName,
            url: hasUploadedMatch ? fileUrl : (fileUrl.startsWith('http') || fileUrl.startsWith('/') || fileUrl.startsWith('data:') || fileUrl.startsWith('blob:') ? fileUrl : ''),
            mode: settings.mode || 'auto',
            existsInProject: hasUploadedMatch,
            uploadedFiles: this.uploadedFiles
          }
        })
      );
    }
  }

  log(msg: string) {
    this.context.output.push(msg);
    this.onOutput(msg);
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.activeAudioMap.forEach(audio => {
        try {
          audio.pause();
        } catch {
          // ignore
        }
      });
    }
  }

  private playSynthSound(soundName: string, volume = 0.4) {
    if (this.isMuted || typeof window === 'undefined') return;

    const resolved = this.resolveUrl(soundName);
    if (resolved.startsWith('http://') || resolved.startsWith('https://') || resolved.startsWith('data:') || resolved.startsWith('blob:')) {
      try {
        const audio = new Audio(resolved);
        audio.volume = Math.max(0, Math.min(1, volume));
        this.activeAudioMap.set(soundName, audio);
        audio.play().catch(() => {});
        return;
      } catch {
        // fallback to synth
      }
    }

    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioContextCtor();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const name = soundName.toLowerCase().replace(/\.mp3$|\.wav$|\.ogg$/i, '');
      const vol = Math.max(0.02, Math.min(0.8, volume * 0.4));

      if (name.includes('coin') || name.includes('score') || name.includes('point')) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.07);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (name.includes('jump')) {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(580, now + 0.14);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.16);
      } else if (name.includes('hit') || name.includes('damage') || name.includes('explos')) {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.22);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        osc.start(now);
        osc.stop(now + 0.24);
      } else if (name.includes('laser') || name.includes('shoot')) {
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
        gain.gain.setValueAtTime(vol * 0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        osc.start(now);
        osc.stop(now + 0.13);
      } else if (name.includes('win') || name.includes('level') || name.includes('power')) {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        osc.frequency.setValueAtTime(1046.5, now + 0.24);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        osc.start(now);
        osc.stop(now + 0.42);
      } else {
        // Default crisp UI click / beep
        osc.type = 'sine';
        osc.frequency.setValueAtTime(640, now);
        osc.frequency.exponentialRampToValueAtTime(420, now + 0.06);
        gain.gain.setValueAtTime(vol * 0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc.start(now);
        osc.stop(now + 0.07);
      }
    } catch {
      // ignore AudioContext restriction errors
    }
  }

  parseSettings(settingsStr: string): Record<string, any> {
    const obj: Record<string, any> = {};
    if (!settingsStr) return obj;

    // Split on commas outside quotes
    const pairs: string[] = [];
    let current = '';
    let quoteChar: '"' | "'" | null = null;
    for (let idx = 0; idx < settingsStr.length; idx++) {
      const ch = settingsStr[idx];
      if ((ch === '"' || ch === "'") && settingsStr[idx - 1] !== '\\') {
        if (quoteChar === ch) quoteChar = null;
        else if (!quoteChar) quoteChar = ch;
        current += ch;
      } else if (ch === ',' && !quoteChar) {
        pairs.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) pairs.push(current);

    pairs.forEach(pair => {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) return;
      const key = pair.slice(0, eqIdx).trim();
      let val: any = pair.slice(eqIdx + 1).trim();

      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
        obj[key] = this.resolveUrl(val);
        return;
      }

      const isRelative = val.startsWith('+') || val.startsWith('-');
      if (!isNaN(Number(val)) && val !== '' && !isRelative) {
        val = Number(val);
      } else if (val === 'true') {
        val = true;
      } else if (val === 'false') {
        val = false;
      } else {
        val = this.resolveUrl(val);
      }

      obj[key] = val;
    });
    return obj;
  }

  evaluateExpression(expr: string): EPLValue {
    if (expr === undefined || expr === null) return null;
    const raw = String(expr).trim();
    if (!raw) return '';
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      return raw.slice(1, -1);
    }

    // random(min, max)
    const randMatch = raw.match(/^random\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)$/i);
    if (randMatch) {
      const min = Number(randMatch[1]);
      const max = Number(randMatch[2]);
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Check for entity property access like player.x or Player.health
    if (/^[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+$/.test(raw)) {
      const [entityName, prop] = raw.split('.');
      const entity = Object.values(this.context.entities).find(
        e => String(e.name || '').toLowerCase() === entityName.toLowerCase()
      );
      if (entity && entity[prop] !== undefined) return entity[prop];
      return 0;
    }

    if (!isNaN(Number(raw)) && raw !== '') return Number(raw);
    if (raw === 'true') return true;
    if (raw === 'false') return false;

    if (this.context.variables[raw] !== undefined) {
      return this.context.variables[raw];
    }

    // Check arithmetic expressions like "score + 1" or "player.x + 20"
    if (/[+\-*/%()]/.test(raw) && !raw.startsWith('#') && !raw.startsWith('http')) {
      try {
        return this.evalSafeExpression(raw);
      } catch {
        // fall through
      }
    }

    return raw;
  }

  private evalSafeExpression(expr: string): any {
    const tokens: string[] = [];
    let i = 0;
    while (i < expr.length) {
      const ch = expr[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      if (ch === '"' || ch === "'") {
        const quote = ch;
        let str = quote;
        i++;
        while (i < expr.length && expr[i] !== quote) {
          str += expr[i++];
        }
        str += quote;
        i++;
        tokens.push(str);
        continue;
      }
      const twoChar = expr.slice(i, i + 2);
      if (['>=', '<=', '==', '!=', '&&', '||', '~='].includes(twoChar)) {
        tokens.push(twoChar);
        i += 2;
        continue;
      }
      if ('+-*/%()><!'.includes(ch)) {
        tokens.push(ch);
        i++;
        continue;
      }
      let word = '';
      while (i < expr.length && !/[\s+\-*/%()><=!'"]/.test(expr[i])) {
        word += expr[i++];
      }
      if (word) tokens.push(word);
    }

    let pos = 0;
    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];

    const resolveAtom = (tok: string): any => {
      if ((tok.startsWith('"') && tok.endsWith('"')) || (tok.startsWith("'") && tok.endsWith("'"))) {
        return tok.slice(1, -1);
      }
      if (tok === 'true') return true;
      if (tok === 'false') return false;
      if (!isNaN(Number(tok))) return Number(tok);
      if (tok.includes('.')) {
        const [eName, prop] = tok.split('.');
        const ent = Object.values(this.context.entities).find(
          e => String(e.name || '').toLowerCase() === eName.toLowerCase()
        );
        if (ent && ent[prop] !== undefined) return ent[prop];
        return 0;
      }
      if (this.context.variables[tok] !== undefined) {
        return this.context.variables[tok];
      }
      return 0;
    };

    const parsePrimary = (): any => {
      const tok = peek();
      if (tok === '(') {
        consume();
        const val = parseOr();
        if (peek() === ')') consume();
        return val;
      }
      if (tok === '!') {
        consume();
        return !parsePrimary();
      }
      if (tok === '-') {
        consume();
        return -Number(parsePrimary());
      }
      if (tok === '+') {
        consume();
        return Number(parsePrimary());
      }
      if (!tok) return 0;
      consume();
      return resolveAtom(tok);
    };

    const parseMul = (): any => {
      let left = parsePrimary();
      while (peek() === '*' || peek() === '/' || peek() === '%') {
        const op = consume();
        const right = parsePrimary();
        if (op === '*') left = Number(left) * Number(right);
        else if (op === '/') left = Number(right) === 0 ? 0 : Number(left) / Number(right);
        else left = Number(right) === 0 ? 0 : Number(left) % Number(right);
      }
      return left;
    };

    const parseAdd = (): any => {
      let left = parseMul();
      while (peek() === '+' || peek() === '-') {
        const op = consume();
        const right = parseMul();
        if (op === '+') {
          if (typeof left === 'string' || typeof right === 'string') {
            left = String(left) + String(right);
          } else {
            left = Number(left) + Number(right);
          }
        } else {
          left = Number(left) - Number(right);
        }
      }
      return left;
    };

    const parseCompare = (): any => {
      let left = parseAdd();
      while (['>', '<', '>=', '<=', '==', '!=', '~='].includes(peek())) {
        const op = consume();
        const right = parseAdd();
        if (op === '>') left = Number(left) > Number(right);
        else if (op === '<') left = Number(left) < Number(right);
        else if (op === '>=') left = Number(left) >= Number(right);
        else if (op === '<=') left = Number(left) <= Number(right);
        else if (op === '==') left = left == right;
        else if (op === '!=') left = left != right;
        else if (op === '~=') {
          const numA = Number(left);
          const numB = Number(right);
          const avg = (Math.abs(numA) + Math.abs(numB)) / 2;
          left = avg === 0 ? numA === numB : Math.abs(numA - numB) / avg <= 0.1;
        }
      }
      return left;
    };

    const parseAnd = (): any => {
      let left = parseCompare();
      while (peek() === '&&' || String(peek()).toLowerCase() === 'and') {
        consume();
        const right = parseCompare();
        left = Boolean(left) && Boolean(right);
      }
      return left;
    };

    const parseOr = (): any => {
      let left = parseAnd();
      while (peek() === '||' || String(peek()).toLowerCase() === 'or') {
        consume();
        const right = parseAnd();
        left = Boolean(left) || Boolean(right);
      }
      return left;
    };

    return parseOr();
  }

  evaluateCompare(a: any, op: string, b: any): boolean {
    const valA = this.evaluateExpression(a);
    const valB = this.evaluateExpression(b);

    switch (op) {
      case '>': return Number(valA) > Number(valB);
      case '<': return Number(valA) < Number(valB);
      case '==': return valA == valB;
      case '!=': return valA != valB;
      case '>=': return Number(valA) >= Number(valB);
      case '<=': return Number(valA) <= Number(valB);
      case '~=': {
        const numA = Number(valA);
        const numB = Number(valB);
        if (isNaN(numA) || isNaN(numB)) return valA == valB;
        const diff = Math.abs(numA - numB);
        const avg = (Math.abs(numA) + Math.abs(numB)) / 2;
        if (avg === 0) return diff === 0;
        return diff / avg <= 0.1;
      }
      default: return false;
    }
  }

  evaluateCondition(cond: string): boolean {
    try {
      const cleaned = cond.replace(/^if\s+/i, '').replace(/\s+then$/i, '').trim();
      if (!cleaned) return false;
      return Boolean(this.evalSafeExpression(cleaned));
    } catch {
      return false;
    }
  }

  evaluateConditionToken(keyword: string, settingsStr: string): boolean {
    const settings = this.parseSettings(settingsStr);
    if (keyword === 'check') {
      return this.evaluateCondition(settings.expression || 'false');
    }
    if (keyword === 'compare') {
      return this.evaluateCompare(settings.a, settings.op, settings.b);
    }
    if (keyword === 'clicked?' || keyword === 'button' || keyword === 'button_pressed') {
      const targetName =
        settings.target ||
        settings.name ||
        (keyword !== 'button' && keyword !== 'button_pressed' && keyword !== 'clicked?' ? keyword : undefined);
      const isRecentClick = Date.now() - (this.context.lastClickedTime || 0) < 650;
      if (!targetName || String(targetName).toLowerCase() === 'button') {
        return isRecentClick;
      }
      const wanted = String(targetName).trim().toLowerCase();
      const clicked = String(this.context.lastClickedTarget || '').trim().toLowerCase();
      if (isRecentClick && clicked === wanted) return true;
      if (isRecentClick && this.context.lastClickedTarget) {
        const clickedEnt = Object.values(this.context.entities).find(
          e => String(e.name || '').toLowerCase() === clicked || String(e.id || '').toLowerCase() === clicked
        );
        if (clickedEnt) {
          return (
            String(clickedEnt.name || '').toLowerCase() === wanted ||
            String(clickedEnt.label || '').toLowerCase() === wanted ||
            String(clickedEnt.text || '').toLowerCase() === wanted ||
            String(clickedEnt.type || '').toLowerCase() === wanted
          );
        }
      }
      return false;
    }
    if (keyword === 'key_pressed?' || keyword === 'key') {
      const key = String(settings.key || settings.target || '').toLowerCase();
      if (!key) return this.keysPressed.size > 0;
      return this.keysPressed.has(key);
    }
    if (keyword === 'collided?') {
      const targetA = settings.targetA;
      const targetB = settings.targetB;
      const entityA = Object.values(this.context.entities).find(e => e.name === targetA);
      const entityB = Object.values(this.context.entities).find(e => e.name === targetB);
      if (entityA && entityB) {
        return this.aabbOverlap(entityA, entityB);
      }
      return false;
    }

    const val = this.evaluateExpression(keyword);
    return Boolean(val && val !== 'false' && val !== 0);
  }

  evaluateTokensCondition(tokens: Array<{ keyword: string; settingsStr: string }>): boolean {
    if (tokens.length === 0) return false;
    const orBranches: Array<Array<{ keyword: string; settingsStr: string }>> = [[]];
    for (const t of tokens) {
      if (t.keyword === 'or') {
        orBranches.push([]);
      } else if (t.keyword === 'and' || t.keyword === 'then' || t.keyword === 'if') {
        continue;
      } else {
        orBranches[orBranches.length - 1].push(t);
      }
    }

    for (const branch of orBranches) {
      if (branch.length === 0) continue;
      if (branch.every(item => this.evaluateConditionToken(item.keyword, item.settingsStr))) {
        return true;
      }
    }

    return false;
  }

  private isBlockStarter(trimmed: string): boolean {
    return (
      /^if\b/i.test(trimmed) ||
      /^repeat\b/i.test(trimmed) ||
      /^forever\b/i.test(trimmed) ||
      /^object\b/i.test(trimmed)
    );
  }

  private extractBalancedBlock(
    lines: string[],
    startIdx: number,
    splitElse = false
  ): { mainBlock: string[]; elseBlock: string[]; nextIndex: number } {
    const mainBlock: string[] = [];
    const elseBlock: string[] = [];
    let currentTarget = mainBlock;
    let depth = 0;
    let i = startIdx;

    while (i < lines.length) {
      const trimmed = lines[i].trim();
      if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('#')) {
        if (this.isBlockStarter(trimmed)) {
          depth++;
        } else if (trimmed === 'end' || /^end\b/i.test(trimmed)) {
          if (depth === 0) {
            return { mainBlock, elseBlock, nextIndex: i + 1 };
          }
          depth--;
        } else if (splitElse && depth === 0 && (trimmed === 'else' || /^else\b/i.test(trimmed))) {
          currentTarget = elseBlock;
          i++;
          continue;
        }
      }
      currentTarget.push(lines[i]);
      i++;
    }

    return { mainBlock, elseBlock, nextIndex: i };
  }

  private aabbOverlap(a: EPLEntity, b: EPLEntity): boolean {
    if (a.hidden || b.hidden) return false;
    const ax = Number(a.x || 0);
    const ay = Number(a.y || 0);
    const aw = Number(a.width || a.size || (a.radius ? a.radius * 2 : 56));
    const ah = Number(a.height || a.size || (a.radius ? a.radius * 2 : 56));

    const bx = Number(b.x || 0);
    const by = Number(b.y || 0);
    const bw = Number(b.width || b.size || (b.radius ? b.radius * 2 : 56));
    const bh = Number(b.height || b.size || (b.radius ? b.radius * 2 : 56));

    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  async runLines(lines: string[]): Promise<boolean> {
    let i = 0;
    while (i < lines.length && this.context.isRunning) {
      const line = lines[i].trim();
      if (!line || line.startsWith('//') || line.startsWith('#')) {
        i++;
        continue;
      }

      const parts = line.split(TOKEN_REGEX);
      let lineHandledByBlock = false;

      for (let j = 1; j < parts.length; j += 4) {
        const keyword = parts[j];
        if (!keyword) continue;
        const settingsStr = parts[j + 1] || '';
        const settings = this.parseSettings(settingsStr);

        if (this.context.pendingRandomChance !== null) {
          const chance = this.context.pendingRandomChance;
          this.context.pendingRandomChance = null;
          if (Math.random() * 100 > chance) {
            this.log(`Random skipped action: ${keyword}`);
            continue;
          }
        }

        if (keyword === 'stop') {
          return true;
        } else if (keyword === 'random') {
          this.context.pendingRandomChance = Number(settings.chance ?? 100);
        } else if (keyword === 'unlock_premium') {
          this.log('Cheat code activated: Premium Unlocked!');
          this.isPremium = true;
          this.triggerEvent('premium_unlocked?', 'world');
        } else if (keyword === 'create') {
          const nextKeyword = parts[j + 4];
          const nextSettingsStr = parts[j + 5] || '';
          const nextSettings = this.parseSettings(nextSettingsStr);

          const resolvedEntityType =
            nextKeyword && ENTITY_TYPES.has(nextKeyword)
              ? nextKeyword
              : settings.type && ENTITY_TYPES.has(String(settings.type))
                ? String(settings.type)
                : null;
          const entitySettings = nextKeyword && ENTITY_TYPES.has(nextKeyword) ? nextSettings : settings;

          if (resolvedEntityType) {
            const id = entitySettings.name || `entity_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const entity: EPLEntity = {
              id,
              type: resolvedEntityType,
              name: entitySettings.name || id,
              ...entitySettings
            };
            if (resolvedEntityType === 'difrenopt') {
              const { drplLines, nextIndex } = extractDifrenoptBlock(lines, i + 1);
              entity.drplCode = drplLines.map(l => (l.startsWith('  ') ? l.slice(2) : l)).join('\n').trim();
              this.context.entities[id] = entity;
              this.emitUIUpdate();
              i = nextIndex;
              lineHandledByBlock = true;
              break;
            }
            if (entity.spawnComponent) entity.isActive = false;
            if (resolvedEntityType === 'player' && entity.health !== undefined && entity.maxHealth === undefined) {
              entity.maxHealth = Number(entity.health);
            }
            if (resolvedEntityType === 'enemy' && entity.health !== undefined && entity.maxHealth === undefined) {
              entity.maxHealth = Number(entity.health);
            }
            if ((resolvedEntityType === 'checkbox' || resolvedEntityType === 'slider') && entity.variable) {
              this.context.variables[entity.variable] =
                resolvedEntityType === 'checkbox' ? Boolean(entity.checked) : Number(entity.value ?? 0);
            }

            this.context.entities[id] = entity;
            this.emitUIUpdate();

            if (resolvedEntityType === 'timer') {
              const interval = Math.max(50, Number(entitySettings.interval || 1000));
              const timerId = setInterval(() => {
                if (this.context.isRunning) {
                  this.triggerEvent('timer_tick?', entitySettings.name);
                }
              }, interval);
              this.context.timers[id] = timerId;
            }

            const createdEventKey = `created?_${entitySettings.name}`;
            if (this.context.events[createdEventKey]) {
              this.runLines(this.context.events[createdEventKey]);
            }

            if (nextKeyword && ENTITY_TYPES.has(nextKeyword)) {
              j += 4;
            }
          }
        } else if (keyword === 'run') {
          this.dispatchFileAction('run', settings);
        } else if (keyword === 'difrenopt') {
          const id = settings.name || `difrenopt_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
          const { drplLines, nextIndex } = extractDifrenoptBlock(lines, i + 1);
          const drplCode = drplLines.map(l => (l.startsWith('  ') ? l.slice(2) : l)).join('\n').trim();
          const entity: EPLEntity = {
            id,
            type: 'difrenopt',
            name: settings.name || 'engine',
            ...settings,
            drplCode
          };
          this.context.entities[id] = entity;
          this.emitUIUpdate();
          i = nextIndex;
          lineHandledByBlock = true;
          break;
        } else if (keyword === 'linkto') {
          const targetName = settings.name || settings.target;
          const existing = targetName
            ? Object.values(this.context.entities).find(e => e.name === targetName)
            : null;
          if (existing) {
            const { id, type, ...cleanSettings } = settings;
            Object.assign(existing, cleanSettings);
            this.emitUIUpdate();
            if (settings.file || settings.mode === 'open' || settings.mode === 'download') {
              this.dispatchFileAction('linkto', settings);
            }
          } else {
            const id = settings.name || `linkto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const entity: EPLEntity = {
              id,
              type: 'linkto',
              name: settings.name || id,
              x: settings.x ?? 24,
              y: settings.y ?? 24,
              ...settings
            };
            if (entity.spawnComponent) entity.isActive = false;
            this.context.entities[id] = entity;
            this.emitUIUpdate();
          }
        } else if (ENTITY_TYPES.has(keyword)) {
          const targetName = settings.name || settings.target || (keyword === 'world' ? 'world' : null);
          const target = Object.values(this.context.entities).find(
            e => e.name === targetName || (keyword === 'world' && e.type === 'world')
          );

          if (target) {
            const { id, type, ...cleanSettings } = settings;
            Object.assign(target, cleanSettings);
            this.emitUIUpdate();
          } else if (targetName) {
            this.log(`Error: Entity "${targetName}" not found. Use 'create' to make a new one.`);
          }
        } else if (keyword === 'ai') {
          const text = await generateWithAI(String(settings.prompt || ''), {
            model: 'gemini-4-hydrogen'
          });
          if (this.aiSettings.answerMode === 'text') {
            this.log(text || '');
          } else {
            console.log(text);
          }
          if (this.aiSettings.changesEnabled && settings.target) {
            const target = Object.values(this.context.entities).find(e => e.name === settings.target);
            if (target) {
              target.text = text;
              this.emitUIUpdate();
            }
          }
        } else if (keyword === 'object') {
          const targetName = settings.name;
          const target = Object.values(this.context.entities).find(e => e.name === targetName);
          const { mainBlock, nextIndex } = this.extractBalancedBlock(lines, i + 1);
          const previousObject = this.context.currentObject;
          this.context.currentObject = target || null;
          await this.runLines(mainBlock);
          this.context.currentObject = previousObject;
          i = nextIndex;
          lineHandledByBlock = true;
          break;
        } else if (keyword === 'repeat') {
          const times = Math.max(0, Math.min(500, Number(this.evaluateExpression(String(settings.times ?? 1))) || 1));
          const { mainBlock, nextIndex } = this.extractBalancedBlock(lines, i + 1);
          for (let k = 0; k < times; k++) {
            if (!this.context.isRunning) break;
            const stopped = await this.runLines(mainBlock);
            if (stopped) return true;
          }
          i = nextIndex;
          lineHandledByBlock = true;
          break;
        } else if (keyword === 'forever') {
          const { mainBlock, nextIndex } = this.extractBalancedBlock(lines, i + 1);
          const runForever = async () => {
            while (this.context.isRunning) {
              await this.runLines(mainBlock);
              await new Promise(resolve => setTimeout(resolve, 16));
            }
          };
          runForever();
          i = nextIndex;
          lineHandledByBlock = true;
          break;
        } else if (keyword === 'control') {
          this.context.controlType = settings.type === 'wasd' ? 'wasd' : null;
        } else if (keyword === 'type') {
          const msg = this.interpolateText(String(settings.text ?? ''));
          if (settings.target === 'console') {
            console.log(msg);
          } else {
            this.log(msg);
          }
        } else if (keyword === 'clear') {
          this.context.output = [];
          this.onOutput('__CLEAR__');
        } else if (keyword === 'background') {
          let world = Object.values(this.context.entities).find(e => e.type === 'world');
          if (!world) {
            const id = `world_${Date.now()}`;
            world = { id, type: 'world', name: 'world' };
            this.context.entities[id] = world;
          }
          if (settings.color) world.background = settings.color;
          if (settings.image) world.backgroundImage = settings.image;
          this.emitUIUpdate();
        } else if (keyword === 'move') {
          const target =
            Object.values(this.context.entities).find(e => e.name === settings.target) ||
            this.context.currentObject;
          if (target) {
            if (target.isMoving === false) continue;

            if (settings.x !== undefined) {
              const val = this.evaluateExpression(String(settings.x));
              target.x = (parseFloat(String(target.x)) || 0) + Number(val);
            }
            if (settings.y !== undefined) {
              const val = this.evaluateExpression(String(settings.y));
              target.y = (parseFloat(String(target.y)) || 0) + Number(val);
            }
            if (settings.z !== undefined) {
              const val = this.evaluateExpression(String(settings.z));
              target.z = (parseFloat(String(target.z)) || 0) + Number(val);
            }
            this.emitUIUpdate();
            this.checkCollisions(target);
          }
        } else if (keyword === 'move_to') {
          const target =
            Object.values(this.context.entities).find(e => e.name === settings.target) ||
            this.context.currentObject;
          if (target) {
            if (settings.x !== undefined) target.x = Number(this.evaluateExpression(String(settings.x)));
            if (settings.y !== undefined) target.y = Number(this.evaluateExpression(String(settings.y)));
            if (settings.z !== undefined) target.z = Number(this.evaluateExpression(String(settings.z)));
            this.emitUIUpdate();
            this.checkCollisions(target);
          }
        } else if (keyword === 'jump') {
          const target =
            Object.values(this.context.entities).find(e => e.name === settings.target) ||
            this.context.currentObject;
          if (target) {
            const force = Number(settings.force || 420);
            const world = Object.values(this.context.entities).find(e => e.type === 'world');
            const hasGravity = Number(world?.gravity || target.gravity || 0) > 0;
            if (hasGravity) {
              if (target.grounded !== false || settings.air === true) {
                target.vy = -force;
                target.grounded = false;
                this.playSynthSound('jump', 0.35);
              }
            } else {
              target.y = (parseFloat(String(target.y || 0)) || 0) - Math.round(force / 8);
              this.playSynthSound('jump', 0.35);
              this.emitUIUpdate();
              this.checkCollisions(target);
            }
          }
        } else if (keyword === 'velocity') {
          const target =
            Object.values(this.context.entities).find(e => e.name === settings.target) ||
            this.context.currentObject;
          if (target) {
            if (settings.vx !== undefined) target.vx = Number(this.evaluateExpression(String(settings.vx)));
            if (settings.vy !== undefined) target.vy = Number(this.evaluateExpression(String(settings.vy)));
          }
        } else if (keyword === 'spawn') {
          const tplName = settings.template || settings.target;
          const template = Object.values(this.context.entities).find(e => e.name === tplName);
          if (template) {
            const newId = `spawn_${tplName}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
            const clone: EPLEntity = {
              ...template,
              id: newId,
              name: settings.name || newId,
              spawnComponent: false,
              isActive: true,
              x: settings.x !== undefined ? Number(this.evaluateExpression(String(settings.x))) : template.x,
              y: settings.y !== undefined ? Number(this.evaluateExpression(String(settings.y))) : template.y
            };
            this.context.entities[newId] = clone;
            this.emitUIUpdate();
          }
        } else if (keyword === 'shake') {
          const intensity = Math.min(30, Number(settings.intensity || 8));
          const duration = Math.min(2000, Number(settings.duration || 250));
          this.shakeState = { intensity, endTime: performance.now() + duration };
          this.emitUIUpdate();
        } else if (keyword === 'stop_move') {
          const target =
            Object.values(this.context.entities).find(e => e.name === settings.target) ||
            this.context.currentObject;
          if (target) {
            target.isMoving = false;
            target.vx = 0;
            target.vy = 0;
          }
        } else if (keyword === 'hide') {
          const target =
            Object.values(this.context.entities).find(e => e.name === settings.target) ||
            this.context.currentObject;
          if (target) {
            target.hidden = true;
            this.emitUIUpdate();
          }
        } else if (keyword === 'show') {
          const target =
            Object.values(this.context.entities).find(e => e.name === settings.target) ||
            this.context.currentObject;
          if (target) {
            target.hidden = false;
            target.isActive = true;
            this.emitUIUpdate();
          }
        } else if (keyword === 'rotate') {
          const target =
            Object.values(this.context.entities).find(e => e.name === settings.target) ||
            this.context.currentObject;
          if (target) {
            const deg = Number(this.evaluateExpression(String(settings.degrees ?? settings.angle ?? 0)));
            target.rotation = (Number(target.rotation || 0) + deg) % 360;
            this.emitUIUpdate();
          }
        } else if (keyword === 'scale') {
          const target =
            Object.values(this.context.entities).find(e => e.name === settings.target) ||
            this.context.currentObject;
          if (target) {
            target.scale = Number(this.evaluateExpression(String(settings.factor ?? 1)));
            this.emitUIUpdate();
          }
        } else if (keyword === 'play_sound') {
          const soundName = String(settings.sound || settings.file || 'click');
          const volume = settings.volume !== undefined ? Number(settings.volume) : 0.45;
          this.playSynthSound(soundName, volume);
        } else if (keyword === 'stop_sound') {
          const soundName = String(settings.sound || '');
          if (soundName && this.activeAudioMap.has(soundName)) {
            this.activeAudioMap.get(soundName)?.pause();
          } else {
            this.activeAudioMap.forEach(a => a.pause());
          }
        } else if (keyword === 'wait') {
          const seconds = settings.seconds !== undefined ? Number(settings.seconds) * 1000 : Number(settings.time || 1000);
          await new Promise(resolve => setTimeout(resolve, Math.max(0, seconds)));
        } else if (keyword === 'draggable') {
          const target =
            Object.values(this.context.entities).find(e => e.name === settings.target) ||
            this.context.currentObject;
          if (target) {
            target.isDraggable = true;
            this.emitUIUpdate();
          }
        } else if (keyword === 'set up') {
          const target =
            Object.values(this.context.entities).find(e => e.name === settings.target) ||
            this.context.currentObject;
          if (target && settings.property) {
            const evaluated = this.evaluateExpression(String(settings.value ?? ''));
            target[settings.property] = evaluated;
            this.emitUIUpdate();
          }
        } else if (keyword === 'destroy') {
          const targetName = settings.target || this.context.currentObject?.name;
          const targetId = Object.keys(this.context.entities).find(
            id => this.context.entities[id].name === targetName || id === targetName
          );
          if (targetId) {
            delete this.context.entities[targetId];
            this.emitUIUpdate();
          }
        } else if (keyword === 'variable') {
          if (settings.name) {
            this.context.variables[settings.name] = this.evaluateExpression(String(settings.value ?? 0));
            this.emitUIUpdate();
          }
        } else if (keyword === 'activate_variable') {
          if (settings.variables) {
            const vars = String(settings.variables)
              .split(',')
              .map(s => s.trim());
            vars.forEach(v => {
              this.context.variables[v] = true;
              this.triggerEvent('variable_activated?', v);
            });
          } else if (settings.var) {
            this.context.variables[settings.var] = true;
            this.triggerEvent('variable_activated?', settings.var);
          }
          this.emitUIUpdate();
        } else if (keyword === 'corner') {
          const target =
            Object.values(this.context.entities).find(e => e.name === settings.target) ||
            this.context.currentObject;
          if (target) {
            const rad = settings.radius !== undefined ? settings.radius : 10;
            target.borderRadius = rad;
            target.corner = rad;
            this.emitUIUpdate();
          }
        } else if (keyword === 'design') {
          this.context.uiMode = { type: 'design', target: settings.target || Object.keys(this.context.entities)[0] };
          this.log(`[Tool Selected] Design Editor for: ${settings.target || 'environment'}`);
          this.emitUIUpdate();
        } else if (keyword === '3DEditor') {
          this.context.uiMode = { type: '3DEditor', target: settings.target };
          this.log(`[Tool Selected] 3D Model Editor`);
          this.emitUIUpdate();
        } else if (keyword === 'position') {
          this.context.uiMode = { type: 'position', target: settings.target };
          this.log(`[Tool Selected] Position Editor for: ${settings.target || 'object'}`);
          this.emitUIUpdate();
        } else if (keyword === 'math') {
          const targetName = settings.target;
          const op = settings.op;
          const val = this.evaluateExpression(String(settings.value ?? 0));

          if (targetName && op && val !== null) {
            let currentVal =
              this.context.variables[targetName] !== undefined ? this.context.variables[targetName] : 0;
            if (typeof currentVal !== 'number') currentVal = Number(currentVal) || 0;
            const numVal = Number(val);

            let result = currentVal;
            switch (op) {
              case 'add': result = currentVal + numVal; break;
              case 'subtract': result = currentVal - numVal; break;
              case 'multiply': result = currentVal * numVal; break;
              case 'divide': result = numVal === 0 ? currentVal : currentVal / numVal; break;
              case 'set': result = numVal; break;
            }
            this.context.variables[targetName] = result;
            this.emitUIUpdate();
          }
        } else if (keyword === 'if') {
          const conditionTokens: Array<{ keyword: string; settingsStr: string }> = [];
          for (let k = j + 4; k < parts.length; k += 4) {
            const kw = parts[k];
            if (kw) {
              conditionTokens.push({ keyword: kw, settingsStr: parts[k + 1] || '' });
            }
          }

          let isTrue = false;
          // Prefer natural expression like "if score >= 10 then" if raw text has comparison/expression
          const inlineCond = line.replace(/^if\s+/i, '').replace(/\s+then$/i, '').trim();
          const hasLogicalKeywords = conditionTokens.some(t =>
            ['check', 'compare', 'clicked?', 'key_pressed?', 'collided?', 'button', 'button_pressed', 'key'].includes(t.keyword)
          );

          if (hasLogicalKeywords && conditionTokens.length > 0) {
            isTrue = this.evaluateTokensCondition(conditionTokens);
          } else if (inlineCond && inlineCond !== 'then') {
            isTrue = this.evaluateCondition(inlineCond);
          } else if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            const nextParts = nextLine.split(TOKEN_REGEX);
            const nextTokens: Array<{ keyword: string; settingsStr: string }> = [];
            for (let k = 1; k < nextParts.length; k += 4) {
              const kw = nextParts[k];
              if (kw) nextTokens.push({ keyword: kw, settingsStr: nextParts[k + 1] || '' });
            }
            if (nextTokens.length > 0) {
              isTrue = this.evaluateTokensCondition(nextTokens);
              i++;
            }
          }

          const { mainBlock, elseBlock, nextIndex } = this.extractBalancedBlock(lines, i + 1, true);

          if (isTrue) {
            const stopped = await this.runLines(mainBlock);
            if (stopped) return true;
          } else if (elseBlock.length > 0) {
            const stopped = await this.runLines(elseBlock);
            if (stopped) return true;
          }

          i = nextIndex;
          lineHandledByBlock = true;
          break;
        }
      }

      if (!lineHandledByBlock) i++;
    }
    return false;
  }

  private interpolateText(text: string): string {
    return text.replace(/\{([a-zA-Z0-9_.]+)\}/g, (_, key) => {
      if (key.includes('.')) {
        const val = this.evaluateExpression(key);
        return val !== null && val !== undefined ? String(val) : '';
      }
      const v = this.context.variables[key];
      return v !== undefined && v !== null ? String(v) : `{${key}}`;
    });
  }

  async run(code: string) {
    this.stop();
    this.context.isRunning = true;
    this.keysPressed.clear();
    this.collisionCooldowns.clear();
    this.shakeState = { intensity: 0, endTime: 0 };
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.context.output = [];
    this.context.entities = {};
    this.context.variables = {};
    this.context.events = {};
    this.emitUIUpdate();

    const lines = code.split('\n');
    let currentEvent: string | null = 'started?';
    let eventBlock: string[] = [];
    let nestedDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;

      // Capture full difrenopt { ... } ... end block atomically so inner DRPL lines are never parsed as EPL events
      if (isDifrenoptStartLine(line)) {
        const { drplLines, nextIndex } = extractDifrenoptBlock(lines, i + 1);
        if (currentEvent) {
          eventBlock.push(line, ...drplLines, 'end');
        }
        i = nextIndex - 1;
        continue;
      }

      const parts = line.split(TOKEN_REGEX);
      const firstKw = parts[1];
      const isEventHeader =
        firstKw &&
        [
          'started?', 'created?', 'clicked?', 'collided?', 'key_pressed?',
          'timer_tick?', 'input', 'file_added?', 'writed?', 'variable_activated?', 'changed?'
        ].includes(firstKw) &&
        !this.isBlockStarter(line);

      // Inside an event block, track nested if/repeat/forever/object depth so their `end` doesn't close the outer event.
      // If a top-level event header appears while unclosed nested blocks remain (e.g. from pasted/inventory snippets), recover cleanly!
      if (nestedDepth > 0) {
        if (isEventHeader) {
          nestedDepth = 0;
        } else {
          if (this.isBlockStarter(line)) {
            nestedDepth++;
          } else if (line === 'end' || /^end\b/i.test(line)) {
            nestedDepth--;
          }
          if (currentEvent) eventBlock.push(line);
          continue;
        }
      }

      if (this.isBlockStarter(line)) {
        nestedDepth++;
        if (currentEvent) eventBlock.push(line);
        continue;
      }

      let foundEvent = false;
      for (let j = 1; j < parts.length; j += 4) {
        const keyword = parts[j];
        if (
          [
            'started?', 'created?', 'clicked?', 'collided?', 'key_pressed?',
            'timer_tick?', 'input', 'file_added?', 'writed?', 'variable_activated?', 'changed?'
          ].includes(keyword)
        ) {
          if (currentEvent && eventBlock.length > 0) {
            this.context.events[currentEvent] = [...(this.context.events[currentEvent] || []), ...eventBlock];
          }

          const settings = this.parseSettings(parts[j + 1] || '');
          if (keyword === 'input' && settings.key && settings.variable) {
            this.context.inputMappings[settings.key] = settings.variable;
          }

          if (keyword === 'collided?' && settings.targetA && settings.targetB) {
            currentEvent = `collided?_${settings.targetA}_${settings.targetB}`;
          } else {
            const suffix = settings.target || settings.key || settings.name || settings.var || settings.variable;
            currentEvent = keyword === 'started?' || !suffix ? keyword : `${keyword}_${suffix}`;
          }

          eventBlock = [];
          foundEvent = true;
          break;
        } else if (keyword === 'end' && currentEvent) {
          this.context.events[currentEvent] = [...(this.context.events[currentEvent] || []), ...eventBlock];
          currentEvent = 'started?';
          eventBlock = [];
          foundEvent = true;
          break;
        }
      }

      if (!foundEvent && currentEvent) {
        eventBlock.push(line);
      }
    }

    if (currentEvent && eventBlock.length > 0) {
      this.context.events[currentEvent] = [...(this.context.events[currentEvent] || []), ...eventBlock];
    }

    this.lastFrameTime = performance.now();
    this.startGameLoop();

    if (this.context.events['started?']) {
      await this.runLines(this.context.events['started?']);
    }
  }

  hasEvents(): boolean {
    const hasEventHandlers = Object.entries(this.context.events).some(
      ([k, lines]) => k !== 'started?' && lines.length > 0
    );
    if (hasEventHandlers) return true;
    if (Object.values(this.context.events).some(lines => lines.length > 0)) return true;
    if (Object.keys(this.context.timers).length > 0) return true;
    return Object.values(this.context.entities).some(e =>
      ['button', 'textbox', 'checkbox', 'slider', 'linkto', 'difrenopt', 'wasd_controls', 'player', 'enemy'].includes(e.type)
    );
  }

  getVariable(name: string): EPLValue {
    return this.context.variables[name];
  }

  stop() {
    this.context.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    Object.values(this.context.timers).forEach(id => clearInterval(id));
    this.context.timers = {};
    this.activeAudioMap.forEach(audio => {
      try {
        audio.pause();
      } catch {
        // ignore
      }
    });
    this.activeAudioMap.clear();
  }

  checkCollisions(mover: EPLEntity) {
    if (mover.hidden) return;
    const now = performance.now();

    Object.values(this.context.entities).forEach(other => {
      if (other.id === mover.id || other.type === 'world' || other.hidden) return;
      if (other.spawnComponent && !other.isActive) return;

      if (this.aabbOverlap(mover, other)) {
        const pairKey = [mover.id, other.id].sort().join('::');
        const lastFired = this.collisionCooldowns.get(pairKey) || 0;
        if (now - lastFired < 120) return;
        this.collisionCooldowns.set(pairKey, now);

        const pairAB = `collided?_${mover.name}_${other.name}`;
        const pairBA = `collided?_${other.name}_${mover.name}`;

        if (this.context.events[pairAB]) {
          this.runLines([...this.context.events[pairAB]]);
        } else if (this.context.events[pairBA]) {
          this.runLines([...this.context.events[pairBA]]);
        }

        if (this.context.events[`collided?_${mover.name}`]) {
          this.triggerEvent('collided?', mover.name);
        }
        if (this.context.events[`collided?_${other.name}`]) {
          this.triggerEvent('collided?', other.name);
        }
        if (other.variable && this.context.events[`collided?_${other.variable}`]) {
          this.triggerEvent('collided?', other.variable);
        }
      }
    });
  }

  async triggerEvent(eventName: string, target?: string, value?: string) {
    if (!this.context.isRunning) return;

    this.context.lastEventValue = value || null;
    if (value !== undefined) {
      this.context.variables['last_event_value'] = value || null;
    }

    if (eventName === 'changed?' && target) {
      const ent = Object.values(this.context.entities).find(e => e.name === target);
      if (ent && ent.variable) {
        if (ent.type === 'checkbox') this.context.variables[ent.variable] = Boolean(ent.checked);
        else if (ent.type === 'slider') this.context.variables[ent.variable] = Number(ent.value ?? 0);
      }
      this.emitUIUpdate();
    }

    if (eventName === 'variable_activated?' && target) {
      const varName = target;
      const entitiesWithVar = Object.values(this.context.entities).filter(e => e.variable === varName);
      entitiesWithVar.forEach(e => (e.isActive = true));

      const specificKey = `${eventName}_${varName}`;
      if (this.context.events[specificKey]) {
        if (entitiesWithVar.length > 0) {
          for (const entity of entitiesWithVar) {
            const prevObj = this.context.currentObject;
            this.context.currentObject = entity;
            await this.runLines([...this.context.events[specificKey]]);
            this.context.currentObject = prevObj;
          }
        } else {
          await this.runLines([...this.context.events[specificKey]]);
        }
      }
      return;
    }

    if (eventName === 'clicked?') {
      this.context.lastClickedTarget = target || null;
      this.context.lastClickedTime = Date.now();
    }

    let normalizedTarget = target;
    if (eventName === 'key_pressed?' && target) {
      normalizedTarget = target.toLowerCase();
      if (target === ' ') normalizedTarget = 'space';
      if (target === 'ArrowUp') normalizedTarget = 'up';
      if (target === 'ArrowDown') normalizedTarget = 'down';
      if (target === 'ArrowLeft') normalizedTarget = 'left';
      if (target === 'ArrowRight') normalizedTarget = 'right';

      if (normalizedTarget) this.keysPressed.add(normalizedTarget);
    } else if (eventName === 'key_released?' && target) {
      normalizedTarget = target.toLowerCase();
      if (target === ' ') normalizedTarget = 'space';
      if (target === 'ArrowUp') normalizedTarget = 'up';
      if (target === 'ArrowDown') normalizedTarget = 'down';
      if (target === 'ArrowLeft') normalizedTarget = 'left';
      if (target === 'ArrowRight') normalizedTarget = 'right';

      if (normalizedTarget) this.keysPressed.delete(normalizedTarget);
    }

    const eventEntries = Object.entries(this.context.events);
    const matchedKeys = new Set<string>();

    // Collect alias targets so clicked?{target=MyBtn}, clicked?{target=PlayLabel}, or case variations all match!
    const candidates = new Set<string>();
    if (normalizedTarget) candidates.add(normalizedTarget);
    if (target) {
      candidates.add(target);
      const clickedEntity = Object.values(this.context.entities).find(
        e => String(e.name || '').toLowerCase() === target.toLowerCase() || String(e.id || '').toLowerCase() === target.toLowerCase()
      );
      if (clickedEntity) {
        if (clickedEntity.name) candidates.add(String(clickedEntity.name));
        if (clickedEntity.label) candidates.add(String(clickedEntity.label));
        if (clickedEntity.text) candidates.add(String(clickedEntity.text));
        if (clickedEntity.type) candidates.add(String(clickedEntity.type));
      }
    }

    for (const cand of candidates) {
      const expectedLower = `${eventName}_${cand}`.toLowerCase();
      for (const [k, lines] of eventEntries) {
        if (k.toLowerCase() === expectedLower && !matchedKeys.has(k)) {
          matchedKeys.add(k);
          await this.runLines([...lines]);
        }
      }
    }

    if (eventName === 'manipulated?' || eventName === 'writed?') {
      this.emitUIUpdate();
    }

    if (eventName === 'key_pressed?' && normalizedTarget) {
      const mappedVar = this.context.inputMappings[normalizedTarget];
      if (mappedVar) {
        this.context.variables[mappedVar] = true;
        this.triggerEvent('variable_activated?', mappedVar);
      }

      const inputKey = `input_${normalizedTarget}`;
      for (const [k, lines] of eventEntries) {
        if (k.toLowerCase() === inputKey.toLowerCase() && !matchedKeys.has(k)) {
          matchedKeys.add(k);
          await this.runLines([...lines]);
        }
      }
    }

    if (this.context.events[eventName] && !matchedKeys.has(eventName)) {
      await this.runLines([...this.context.events[eventName]]);
    }
  }

  startGameLoop = (timestamp?: number) => {
    if (!this.context.isRunning) return;

    const now = timestamp ?? performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - (this.lastFrameTime || now)) / 1000));
    this.lastFrameTime = now;

    this.stepPhysics(dt);
    this.handleWasdControls(dt);

    if (this.uiDirty || (this.shakeState.intensity > 0 && now <= this.shakeState.endTime + 20)) {
      this.emitUIUpdate();
    }

    this.animationFrameId = requestAnimationFrame(this.startGameLoop);
  };

  private stepPhysics(dt: number) {
    const world = Object.values(this.context.entities).find(e => e.type === 'world');
    const worldGravity = Number(world?.gravity || 0);
    const floorY = world?.floor !== undefined ? Number(world.floor) : 480;
    const solidBlocks = Object.values(this.context.entities).filter(
      e => e.solid === true && !e.hidden
    );

    Object.values(this.context.entities).forEach(entity => {
      if (UI_WIDGET_TYPES.has(entity.type) || entity.solid === true || entity.hidden) return;
      if (entity.spawnComponent && !entity.isActive) return;

      const entityGravity = entity.gravity !== undefined ? Number(entity.gravity) : worldGravity;
      const usesPhysics = Boolean(entity.physics) || entityGravity > 0 || entity.vx || entity.vy;
      if (!usesPhysics) return;

      let vx = Number(entity.vx || 0);
      let vy = Number(entity.vy || 0);

      if (entityGravity > 0) {
        vy += entityGravity * dt;
      }

      let x = parseFloat(String(entity.x || 0)) || 0;
      let y = parseFloat(String(entity.y || 0)) || 0;
      const w = Number(entity.width || entity.size || (entity.radius ? entity.radius * 2 : 56));
      const h = Number(entity.height || entity.size || (entity.radius ? entity.radius * 2 : 56));

      x += vx * dt;
      y += vy * dt;

      let grounded = false;

      // Solid block platform collision separation
      for (const wall of solidBlocks) {
        if (wall.id === entity.id) continue;
        const wx = Number(wall.x || 0);
        const wy = Number(wall.y || 0);
        const ww = Number(wall.width || wall.size || 64);
        const wh = Number(wall.height || wall.size || 64);

        if (x < wx + ww && x + w > wx && y < wy + wh && y + h > wy) {
          const overlapTop = y + h - wy;
          const overlapBottom = wy + wh - y;
          const overlapLeft = x + w - wx;
          const overlapRight = wx + ww - x;
          const minOverlap = Math.min(overlapTop, overlapBottom, overlapLeft, overlapRight);

          if (minOverlap === overlapTop && vy >= 0) {
            y = wy - h;
            vy = entity.bounce ? -vy * Number(entity.bounce) : 0;
            grounded = true;
          } else if (minOverlap === overlapBottom && vy < 0) {
            y = wy + wh;
            vy = 0;
          } else if (minOverlap === overlapLeft) {
            x = wx - w;
            vx = 0;
          } else if (minOverlap === overlapRight) {
            x = wx + ww;
            vx = 0;
          }
        }
      }

      if (entityGravity > 0 && y + h >= floorY) {
        y = floorY - h;
        vy = entity.bounce ? -vy * Number(entity.bounce) : 0;
        grounded = true;
      }

      const prevX = Number(entity.x || 0);
      const prevY = Number(entity.y || 0);
      entity.x = x;
      entity.y = y;
      entity.vx = vx;
      entity.vy = vy;
      entity.grounded = grounded;

      if (Math.abs(x - prevX) > 0.01 || Math.abs(y - prevY) > 0.01) {
        this.uiDirty = true;
        this.checkCollisions(entity);
      }
    });
  }

  handleWasdControls(dt = 0.016) {
    const wasdEntities = Object.values(this.context.entities).filter(e => e.type === 'wasd_controls');
    if (wasdEntities.length === 0) return;

    const now = Date.now();
    const world = Object.values(this.context.entities).find(e => e.type === 'world');
    const hasGravity = Number(world?.gravity || 0) > 0;

    wasdEntities.forEach(ctrl => {
      const targetName = String(ctrl.target || '').toLowerCase();
      const target = Object.values(this.context.entities).find(
        e => String(e.name || '').toLowerCase() === targetName
      );
      if (!target || target.isMoving === false) return;

      const speed = Number(ctrl.speed || 260);
      const step = ctrl.step !== undefined ? Number(ctrl.step) : speed * dt;
      const duration = Number(ctrl.duration || 0);

      const lastMoveTime = Number(ctrl._lastMoveTime || 0);
      if (duration > 0 && now - lastMoveTime < duration * 1000) {
        return;
      }

      let currentX = parseFloat(String(target.x || 0)) || 0;
      let currentY = parseFloat(String(target.y || 0)) || 0;
      let moved = false;

      if (!hasGravity) {
        if (this.keysPressed.has('w') || this.keysPressed.has('up')) {
          currentY -= step;
          moved = true;
        } else if (this.keysPressed.has('s') || this.keysPressed.has('down')) {
          currentY += step;
          moved = true;
        }
      } else if ((this.keysPressed.has('w') || this.keysPressed.has('up') || this.keysPressed.has('space')) && target.grounded) {
        target.vy = -Number(ctrl.jumpForce || 420);
        target.grounded = false;
        this.playSynthSound('jump', 0.3);
        moved = true;
      }

      if (this.keysPressed.has('a') || this.keysPressed.has('left')) {
        currentX -= step;
        target.flipX = true;
        moved = true;
      } else if (this.keysPressed.has('d') || this.keysPressed.has('right')) {
        currentX += step;
        target.flipX = false;
        moved = true;
      }

      if (moved) {
        if (ctrl.boundary) {
          currentX = Math.max(0, Math.min(740, currentX));
          currentY = Math.max(0, Math.min(460, currentY));
        }
        target.x = currentX;
        target.y = currentY;
        ctrl._lastMoveTime = now;
        target.transitionDuration = duration > 0 ? duration : 0;
        this.uiDirty = true;
        this.checkCollisions(target);
      }
    });
  }
}
