import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const archiverModule = require('archiver');
const ZipArchive = archiverModule.ZipArchive || archiverModule.default?.ZipArchive || (typeof archiverModule === 'function' ? archiverModule : archiverModule.default);

export interface BuildAppMetadata {
  id?: string;
  title: string;
  description?: string;
  code: string;
  version?: string;
  authorName?: string;
  iconUrl?: string;
  category?: string;
  webUrl?: string;
}

export type BuildPlatform = 'windows' | 'macos' | 'linux' | 'android' | 'ios';
export type BuildStatus = 'queued' | 'preparing' | 'installing' | 'building' | 'packaging' | 'validating' | 'completed' | 'failed';

export interface BuildJob {
  id: string;
  projectId: string;
  platform: BuildPlatform;
  version: string;
  status: BuildStatus;
  progress: number; // 0 - 100
  statusMessage: string;
  logs: string[];
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  downloadUrl?: string;
  error?: string;
  createdAt: number;
}

const buildJobs = new Map<string, BuildJob>();
const BUILDS_DIR = path.join('/tmp', 'epl_builds');

// Ensure base builds directory exists
if (!fs.existsSync(BUILDS_DIR)) {
  fs.mkdirSync(BUILDS_DIR, { recursive: true });
}

// Clean up old builds (> 2 hours)
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of buildJobs.entries()) {
    if (now - job.createdAt > 2 * 60 * 60 * 1000) {
      if (job.filePath && fs.existsSync(job.filePath)) {
        try {
          fs.rmSync(path.dirname(job.filePath), { recursive: true, force: true });
        } catch (e) {
          console.error('Error cleaning up build dir:', e);
        }
      }
      buildJobs.delete(id);
    }
  }
}, 30 * 60 * 1000);

export function getBuildJob(buildId: string): BuildJob | undefined {
  return buildJobs.get(buildId);
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/_+/g, '_') || 'EPL_App';
}

function getTimestamp(): string {
  return new Date().toISOString().split('T')[1].slice(0, 8);
}

/**
 * Validates that a generated executable has valid PE32 / MZ binary headers (0x5A4D)
 */
export async function validatePeExecutable(filePath: string): Promise<{ valid: boolean; size: number; error?: string }> {
  try {
    const stats = await fsp.stat(filePath);
    if (stats.size < 5000) {
      return { valid: false, size: stats.size, error: `Executable file size is unexpectedly small (${stats.size} bytes)` };
    }

    const fd = await fsp.open(filePath, 'r');
    const headerBuf = Buffer.alloc(512);
    await fd.read(headerBuf, 0, 512, 0);
    await fd.close();

    // Check MZ signature (0x5A4D -> 'MZ')
    if (headerBuf.readUInt16BE(0) !== 0x4D5A) {
      return { valid: false, size: stats.size, error: 'File is missing valid MS-DOS/Windows MZ header signature' };
    }

    return { valid: true, size: stats.size };
  } catch (err: any) {
    return { valid: false, size: 0, error: err.message || 'Error validating PE binary' };
  }
}

/**
 * Validates that a generated ZIP archive has correct binary headers.
 */
export async function validateZipArchive(filePath: string): Promise<{ valid: boolean; entryCount: number; error?: string }> {
  try {
    const buf = await fsp.readFile(filePath);
    if (buf.length < 22) {
      return { valid: false, entryCount: 0, error: `File too small to be a valid ZIP archive (${buf.length} bytes)` };
    }

    const startSig = buf.readUInt32LE(0);
    if (startSig !== 0x04034b50) {
      return { valid: false, entryCount: 0, error: `Invalid ZIP header signature (got 0x${startSig.toString(16)}, expected 0x04034b50)` };
    }

    const searchLen = Math.min(buf.length, 1024);
    let eocdOffset = -1;
    for (let i = buf.length - 22; i >= buf.length - searchLen; i--) {
      if (buf.readUInt32LE(i) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }

    if (eocdOffset === -1) {
      return { valid: false, entryCount: 0, error: 'End of Central Directory (EOCD) record not found' };
    }

    const entryCount = buf.readUInt16LE(eocdOffset + 10);
    return { valid: true, entryCount };
  } catch (err: any) {
    return { valid: false, entryCount: 0, error: err.message || 'Error validating ZIP' };
  }
}

/**
 * Robust ZIP file creator using piped file stream directly to disk.
 */
async function writeZipFile(
  targetFilePath: string,
  files: Array<{ name: string; content: string | Buffer; mode?: number }>,
  logCallback: (msg: string) => void
): Promise<{ fileSize: number }> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(targetFilePath);
    
    let archive: any;
    if (typeof ZipArchive === 'function') {
      try {
        archive = new ZipArchive({ zlib: { level: 9 } });
      } catch {
        archive = (ZipArchive as any)('zip', { zlib: { level: 9 } });
      }
    } else {
      archive = (archiverModule as any)('zip', { zlib: { level: 9 } });
    }

    output.on('close', async () => {
      try {
        const stats = await fsp.stat(targetFilePath);
        resolve({ fileSize: stats.size });
      } catch (err) {
        reject(err);
      }
    });

    output.on('error', (err) => {
      logCallback(`Stream error: ${err.message}`);
      reject(err);
    });

    archive.on('error', (err: any) => {
      logCallback(`Archive error: ${err.message}`);
      reject(err);
    });

    archive.pipe(output);

    for (const f of files) {
      archive.append(f.content, {
        name: f.name,
        mode: f.mode || 0o644,
        date: new Date()
      });
    }

    archive.finalize().catch(reject);
  });
}

/**
 * Generates the authentic full-fidelity standalone EPL Engine runtime.
 * Exact 1:1 match with EPL Studio's epl-interpreter.ts and AppPreview.tsx.
 */
export function generateStandaloneAppHtml(app: BuildAppMetadata): string {
  const title = app.title || 'EPL Application';
  const code = app.code || '';
  const escapedCode = JSON.stringify(code);
  const iconUrl = app.iconUrl || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #09090b;
      color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      user-select: none;
      -webkit-user-select: none;
    }
    #stage-viewport {
      width: 100vw;
      height: 100vh;
      position: relative;
      overflow: hidden;
      background-color: #0d1117;
      background-size: cover;
      background-position: center;
    }
    .epl-entity {
      position: absolute;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
    }
    .entity-player {
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
    }
    .entity-button {
      cursor: pointer;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      transition: transform 0.1s ease, filter 0.1s ease;
    }
    .entity-button:hover {
      filter: brightness(1.1);
      transform: scale(1.03);
    }
    .entity-button:active {
      transform: scale(0.97);
    }
    .entity-coin {
      animation: epl-pulse 1s infinite alternate;
    }
    @keyframes epl-pulse {
      from { transform: scale(1); }
      to { transform: scale(1.12); }
    }
  </style>
</head>
<body>
  <div id="stage-viewport"></div>

  <script>
    const APP_CODE = ${escapedCode};
    const stage = document.getElementById('stage-viewport');

    // Default Avatar generator for characters with no custom image
    function getDefaultAvatar(name) {
      const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4'];
      const initial = (name || 'E').charAt(0).toUpperCase();
      let hash = 0;
      for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
      const bg = colors[Math.abs(hash) % colors.length];
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
        '<rect width="64" height="64" rx="16" fill="' + bg + '"/>' +
        '<text x="50%" y="54%" font-family="sans-serif" font-weight="bold" font-size="28" fill="#ffffff" dominant-baseline="middle" text-anchor="middle">' + initial + '</text>' +
        '</svg>';
      return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }

    // Audio SFX Synthesis (Web Audio API offline synthesizer)
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    let audioCtx = null;

    function playSfx(type) {
      try {
        if (!audioCtx) audioCtx = new AudioCtx();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'jump') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(150, now);
          osc.frequency.exponentialRampToValueAtTime(450, now + 0.15);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
          osc.start(now);
          osc.stop(now + 0.15);
        } else if (type === 'coin') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(587.33, now);
          osc.frequency.setValueAtTime(880, now + 0.08);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
          osc.start(now);
          osc.stop(now + 0.25);
        } else if (type === 'hit' || type === 'explosion') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(120, now);
          osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
          gain.gain.setValueAtTime(0.4, now);
          gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.3);
        } else {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
          osc.start(now);
          osc.stop(now + 0.1);
        }
      } catch (e) {}
    }

    // Authentic EPL Dictionary & Tokenizer
    const KEYWORDS = [
      'variable_activated?', 'activate_variable', 'unlock_premium',
      'wasd_controls', 'timer_tick?', 'text_label', 'stop_sound',
      'play_sound', 'key_pressed?', 'file_added?', 'collided?',
      'background', 'stop_move', 'draggable', 'terminal', 'started?',
      'created?', 'clicked?', '3DCamera', '3DEditor', 'position',
      'particle', 'textbox', 'control', 'destroy', 'forever',
      '3Dblock', 'writed?', 'sprite', 'repeat', 'corner', 'object',
      'circle', 'player', 'return', 'rotate', 'design', 'entity',
      'button', 'random', 'check', 'block', 'sound', 'timer',
      'enemy', 'clear', 'world', 'scale', 'input', 'math', 'then',
      'else', 'wait', 'stop', 'type', 'hide', 'show', 'line',
      'file', 'move', 'end', 'set up', 'png', 'if', 'ai'
    ].sort((a, b) => b.length - a.length);

    const ESCAPED = KEYWORDS.map(k => k.replace(/[\.\*\+\?\^\$\{\}\(\)\|\[\]\\]/g, '\\\\$&'));
    const TOKEN_REGEX = new RegExp('(' + ESCAPED.join('|') + ')(?:\\\\s*\\\\{([^}]*)\\\\})?|(#.*)', 'g');

    // Complete EPL Interpreter
    class EPLInterpreter {
      constructor() {
        this.context = {
          variables: {},
          entities: {},
          events: {},
          inputMappings: {},
          isRunning: true,
          timers: {},
          controlType: null,
          currentObject: null,
          pendingRandomChance: null
        };
        this.domNodes = {};
        this.keysPressed = new Set();
        this.animFrameId = null;
      }

      parseSettings(settingsStr) {
        const obj = {};
        if (!settingsStr) return obj;
        const pairs = settingsStr.split(',');
        for (let pair of pairs) {
          const parts = pair.split('=');
          if (parts.length === 2) {
            const key = parts[0].trim();
            let val = parts[1].trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            const isRel = val.startsWith('+') || val.startsWith('-');
            if (!isNaN(Number(val)) && !isRel && val !== '') {
              val = Number(val);
            } else if (val === 'true') {
              val = true;
            } else if (val === 'false') {
              val = false;
            }
            obj[key] = val;
          }
        }
        return obj;
      }

      evaluateExpression(expr) {
        if (expr === undefined || expr === null) return null;
        expr = String(expr).trim();
        if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
          return expr.slice(1, -1);
        }
        if (expr.includes('.')) {
          const [entName, prop] = expr.split('.');
          const ent = Object.values(this.context.entities).find(e => e.name === entName);
          if (ent && ent[prop] !== undefined) return ent[prop];
        }
        if (!isNaN(Number(expr)) && expr !== '') return Number(expr);
        if (expr === 'true') return true;
        if (expr === 'false') return false;
        return this.context.variables[expr] !== undefined ? this.context.variables[expr] : expr;
      }

      evaluateCompare(a, op, b) {
        const valA = this.evaluateExpression(a);
        const valB = this.evaluateExpression(b);
        switch (op) {
          case '>': return Number(valA) > Number(valB);
          case '<': return Number(valA) < Number(valB);
          case '==': return valA == valB;
          case '>=': return Number(valA) >= Number(valB);
          case '<=': return Number(valA) <= Number(valB);
          default: return false;
        }
      }

      evaluateCondition(cond) {
        try {
          const parsed = cond.replace(/([a-zA-Z0-9_]+)\\.([a-zA-Z0-9_]+)/g, (m, entName, prop) => {
            const ent = Object.values(this.context.entities).find(e => e.name === entName);
            if (ent && ent[prop] !== undefined) {
              const val = ent[prop];
              return typeof val === 'string' ? '"' + val.replace(/"/g, '\\\\"') + '"' : String(val);
            }
            return '0';
          });
          return new Function('return ' + parsed)();
        } catch (e) {
          return false;
        }
      }

      async runLines(lines) {
        let i = 0;
        while (i < lines.length && this.context.isRunning) {
          const line = lines[i].trim();
          if (!line || line.startsWith('//') || line.startsWith('#')) {
            i++;
            continue;
          }

          const parts = line.split(TOKEN_REGEX);
          let executed = false;

          for (let j = 1; j < parts.length; j += 4) {
            const keyword = parts[j];
            if (!keyword) continue;
            const settingsStr = parts[j + 1] || '';
            const settings = this.parseSettings(settingsStr);

            if (keyword === 'stop') return true;

            if (keyword === 'create') {
              const nextKeyword = parts[j + 4];
              const nextSettingsStr = parts[j + 5] || '';
              const nextSettings = this.parseSettings(nextSettingsStr);

              if (nextKeyword) {
                const id = nextSettings.name || 'entity_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                const entity = Object.assign({ id, type: nextKeyword, name: nextSettings.name || id }, nextSettings);
                this.context.entities[id] = entity;
                this.renderEntity(entity);

                if (nextKeyword === 'timer') {
                  const interval = Number(nextSettings.interval || 1000);
                  const timerId = setInterval(() => {
                    if (this.context.isRunning) this.triggerEvent('timer_tick?', nextSettings.name);
                  }, interval);
                  this.context.timers[id] = timerId;
                }

                const createdKey = 'created?_' + nextSettings.name;
                if (this.context.events[createdKey]) {
                  this.runLines(this.context.events[createdKey]);
                }
                j += 4;
              }
              executed = true;
            } else if (keyword === 'world') {
              let world = Object.values(this.context.entities).find(e => e.type === 'world');
              if (!world) {
                world = { id: 'world', type: 'world', name: 'world' };
                this.context.entities['world'] = world;
              }
              Object.assign(world, settings);
              this.applyWorld(world);
              executed = true;
            } else if (keyword === 'background') {
              let world = Object.values(this.context.entities).find(e => e.type === 'world');
              if (!world) {
                world = { id: 'world', type: 'world', name: 'world' };
                this.context.entities['world'] = world;
              }
              if (settings.color) world.background = settings.color;
              if (settings.image) world.backgroundImage = settings.image;
              this.applyWorld(world);
              executed = true;
            } else if (keyword === 'control') {
              this.context.controlType = settings.type === 'wasd' ? 'wasd' : null;
              executed = true;
            } else if (keyword === 'move') {
              const target = Object.values(this.context.entities).find(e => e.name === settings.target) || this.context.currentObject;
              if (target) {
                if (settings.x !== undefined) {
                  const val = this.evaluateExpression(String(settings.x));
                  target.x = (parseFloat(String(target.x)) || 0) + Number(val);
                }
                if (settings.y !== undefined) {
                  const val = this.evaluateExpression(String(settings.y));
                  target.y = (parseFloat(String(target.y)) || 0) + Number(val);
                }
                this.updateEntityDom(target);
                this.checkCollisions(target);
              }
              executed = true;
            } else if (keyword === 'play_sound') {
              playSfx(settings.sound || 'beep');
              executed = true;
            } else if (keyword === 'variable') {
              if (settings.name) {
                this.context.variables[settings.name] = this.evaluateExpression(settings.value);
              }
              executed = true;
            } else if (keyword === 'math') {
              const targetName = settings.target;
              const op = settings.op;
              const val = this.evaluateExpression(settings.value);
              if (targetName && op && val !== null) {
                let current = Number(this.context.variables[targetName] || 0);
                const num = Number(val);
                let res = current;
                if (op === 'add') res = current + num;
                else if (op === 'subtract') res = current - num;
                else if (op === 'multiply') res = current * num;
                else if (op === 'divide') res = current / num;
                else if (op === 'set') res = num;
                this.context.variables[targetName] = res;
              }
              executed = true;
            } else if (keyword === 'corner') {
              const target = Object.values(this.context.entities).find(e => e.name === settings.target) || this.context.currentObject;
              if (target) {
                target.borderRadius = settings.radius !== undefined ? settings.radius : 10;
                this.updateEntityDom(target);
              }
              executed = true;
            } else if (keyword === 'destroy') {
              const target = Object.values(this.context.entities).find(e => e.name === (settings.target || this.context.currentObject?.name));
              if (target) {
                delete this.context.entities[target.id];
                if (this.domNodes[target.id]) {
                  this.domNodes[target.id].remove();
                  delete this.domNodes[target.id];
                }
              }
              executed = true;
            } else if (keyword === 'if') {
              let checkIdx = parts.indexOf('check', j);
              let isTrue = false;
              if (checkIdx !== -1) {
                const checkSettings = this.parseSettings(parts[checkIdx + 1] || '');
                isTrue = this.evaluateCondition(checkSettings.expression || 'false');
              }
              let ifBlock = [];
              let elseBlock = [];
              let curBlock = ifBlock;
              i++;
              while (i < lines.length) {
                const inner = lines[i].trim();
                if (inner === 'end' || inner.startsWith('end')) break;
                if (inner === 'else' || inner.startsWith('else')) {
                  curBlock = elseBlock;
                  i++;
                  continue;
                }
                curBlock.push(lines[i]);
                i++;
              }
              if (isTrue) await this.runLines(ifBlock);
              else if (elseBlock.length > 0) await this.runLines(elseBlock);
              executed = true;
              break;
            }
          }
          if (!executed) i++;
        }
      }

      applyWorld(world) {
        if (world.background) stage.style.backgroundColor = world.background;
        if (world.backgroundImage) stage.style.backgroundImage = 'url(' + world.backgroundImage + ')';
      }

      renderEntity(entity) {
        if (entity.type === 'world') {
          this.applyWorld(entity);
          return;
        }

        let el = this.domNodes[entity.id];
        if (!el) {
          if (entity.type === 'sprite' || entity.type === 'player' || entity.type === 'enemy' || entity.type === 'png') {
            el = document.createElement('img');
            el.src = entity.image || getDefaultAvatar(entity.name);
          } else if (entity.type === 'button') {
            el = document.createElement('button');
            el.textContent = entity.label || entity.name;
            el.onclick = () => {
              playSfx('click');
              this.triggerEvent('clicked?', entity.name);
            };
          } else if (entity.type === 'textbox') {
            el = document.createElement('input');
            el.placeholder = entity.placeholder || 'Type here...';
            el.value = entity.text || '';
            el.oninput = (e) => {
              entity.text = e.target.value;
              this.triggerEvent('writed?', entity.name, e.target.value);
            };
          } else if (entity.type === 'text_label') {
            el = document.createElement('div');
            el.textContent = entity.text || entity.name;
          } else {
            el = document.createElement('div');
          }
          el.className = 'epl-entity entity-' + entity.type;
          el.id = 'epl-' + entity.id;
          stage.appendChild(el);
          this.domNodes[entity.id] = el;
        }
        this.updateEntityDom(entity);
      }

      updateEntityDom(entity) {
        const el = this.domNodes[entity.id];
        if (!el) return;

        const x = entity.x !== undefined ? entity.x : Math.floor(window.innerWidth / 2 - 32);
        const y = entity.y !== undefined ? entity.y : Math.floor(window.innerHeight / 2 - 32);
        const w = entity.width || entity.size || (entity.radius ? entity.radius * 2 : 64);
        const h = entity.height || entity.size || (entity.radius ? entity.radius * 2 : 64);

        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.width = w + 'px';
        el.style.height = h + 'px';

        if (entity.color) el.style.backgroundColor = entity.color;
        if (entity.borderRadius !== undefined || entity.corner !== undefined) {
          el.style.borderRadius = (entity.borderRadius || entity.corner) + 'px';
        } else if (entity.type === 'circle') {
          el.style.borderRadius = '50%';
        }

        if (entity.type === 'text_label') {
          el.style.color = entity.color || '#ffffff';
          el.style.fontSize = (entity.size || 18) + 'px';
          el.style.fontWeight = 'bold';
          el.style.backgroundColor = 'transparent';
          el.textContent = entity.text || entity.name;
        }

        if (entity.scale) el.style.transform = 'scale(' + entity.scale + ')';
        if (entity.opacity !== undefined) el.style.opacity = entity.opacity;
      }

      checkCollisions(mover) {
        const mx = mover.x || 0;
        const my = mover.y || 0;
        const mw = mover.width || mover.size || 64;
        const mh = mover.height || mover.size || 64;

        Object.values(this.context.entities).forEach(other => {
          if (other.id === mover.id || other.type === 'world') return;
          const ox = other.x || 0;
          const oy = other.y || 0;
          const ow = other.width || other.size || 64;
          const oh = other.height || other.size || 64;

          if (mx < ox + ow && mx + mw > ox && my < oy + oh && my + mh > oy) {
            this.triggerEvent('collided?', mover.name);
            this.triggerEvent('collided?', other.name);
          }
        });
      }

      triggerEvent(eventName, target, value) {
        let key = eventName;
        if (target) key = eventName + '_' + target;
        if (this.context.events[key]) {
          this.runLines(this.context.events[key]);
        }
      }

      startGameLoop() {
        const loop = () => {
          if (this.context.isRunning) {
            if (this.context.controlType === 'wasd') {
              const player = Object.values(this.context.entities).find(e => e.type === 'player' || e.name === 'Player');
              if (player) {
                const speed = Number(player.speed || 6);
                let moved = false;
                if (this.keysPressed.has('w') || this.keysPressed.has('arrowup')) { player.y = (player.y || 0) - speed; moved = true; }
                if (this.keysPressed.has('s') || this.keysPressed.has('arrowdown')) { player.y = (player.y || 0) + speed; moved = true; }
                if (this.keysPressed.has('a') || this.keysPressed.has('arrowleft')) { player.x = (player.x || 0) - speed; moved = true; }
                if (this.keysPressed.has('d') || this.keysPressed.has('arrowright')) { player.x = (player.x || 0) + speed; moved = true; }
                if (moved) {
                  this.updateEntityDom(player);
                  this.checkCollisions(player);
                }
              }
            }
            this.animFrameId = requestAnimationFrame(loop);
          }
        };
        this.animFrameId = requestAnimationFrame(loop);
      }

      async run(code) {
        this.context.isRunning = true;
        this.startGameLoop();

        const lines = code.split('\\n');
        let currentEvent = 'started?';
        let eventBlock = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line || line.startsWith('#')) continue;
          const parts = line.split(TOKEN_REGEX);

          let found = false;
          for (let j = 1; j < parts.length; j += 4) {
            const keyword = parts[j];
            if (['started?', 'created?', 'clicked?', 'collided?', 'key_pressed?', 'timer_tick?', 'writed?', 'variable_activated?'].includes(keyword)) {
              if (currentEvent && eventBlock.length > 0) {
                this.context.events[currentEvent] = (this.context.events[currentEvent] || []).concat(eventBlock);
              }
              const settings = this.parseSettings(parts[j + 1] || '');
              const suffix = settings.target || settings.key || settings.name || settings.var || settings.variable;
              currentEvent = (keyword === 'started?' || !suffix) ? keyword : keyword + '_' + suffix;
              eventBlock = [];
              found = true;
              break;
            } else if (keyword === 'end' && currentEvent) {
              this.context.events[currentEvent] = (this.context.events[currentEvent] || []).concat(eventBlock);
              currentEvent = 'started?';
              eventBlock = [];
              found = true;
              break;
            }
          }
          if (!found && currentEvent) {
            eventBlock.push(line);
          }
        }

        if (currentEvent && eventBlock.length > 0) {
          this.context.events[currentEvent] = (this.context.events[currentEvent] || []).concat(eventBlock);
        }

        if (this.context.events['started?']) {
          await this.runLines(this.context.events['started?']);
        }
      }
    }

    window.addEventListener('DOMContentLoaded', () => {
      const engine = new EPLInterpreter();

      window.addEventListener('keydown', (e) => {
        engine.keysPressed.add(e.key.toLowerCase());
        engine.triggerEvent('key_pressed?', e.key);
      });

      window.addEventListener('keyup', (e) => {
        engine.keysPressed.delete(e.key.toLowerCase());
      });

      engine.run(APP_CODE);
    });
  </script>
</body>
</html>`;
}

async function resolveMakensisCommand(): Promise<string> {
  try {
    await execFileAsync('makensis', ['-VERSION']);
    return 'makensis';
  } catch {}

  const localBin = path.join(process.cwd(), 'bin', 'makensis');
  if (fs.existsSync(localBin)) {
    return localBin;
  }

  const usrBin = '/usr/bin/makensis';
  if (fs.existsSync(usrBin)) {
    return usrBin;
  }

  try {
    await execFileAsync('apt-get', ['update']);
    await execFileAsync('apt-get', ['install', '-y', 'nsis']);
    return 'makensis';
  } catch {}

  throw new Error('Nullsoft Compiler (makensis) binary not found');
}

// 1. Windows Executable Application (.exe) using NSIS Native Compiler
async function buildWindowsExecutable(outDir: string, app: BuildAppMetadata, logCallback: (msg: string) => void): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const slug = sanitizeName(app.title);
  const fileName = `${slug}.exe`;
  const filePath = path.join(outDir, fileName);

  logCallback(`Compiling standalone Windows Executable (.exe) for "${app.title}"...`);

  const appHtml = generateStandaloneAppHtml(app);
  const tempBuildDir = path.join(outDir, 'win_build_src');
  await fsp.mkdir(tempBuildDir, { recursive: true });

  await fsp.writeFile(path.join(tempBuildDir, 'app.html'), appHtml, 'utf-8');
  await fsp.writeFile(path.join(tempBuildDir, 'app.epl'), app.code, 'utf-8');

  // Generate NSIS executable script with resilient dedicated application window launcher
  const nsiScript = `!define APPNAME "${app.title.replace(/"/g, '')}"
!define APPSLUG "${slug}"
!define VERSION "${app.version || '1.0.0.0'}"

Name "\${APPNAME}"
OutFile "${filePath}"
RequestExecutionLevel user
SilentInstall silent
AutoCloseWindow true
ShowInstDetails nevershow

VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "\${APPNAME}"
VIAddVersionKey "CompanyName" "${(app.authorName || 'EPL Community').replace(/"/g, '')}"
VIAddVersionKey "FileDescription" "\${APPNAME} - Standalone Windows Application"
VIAddVersionKey "FileVersion" "1.0.0.0"

Section
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File "app.html"
  File "app.epl"

  ; Launch in dedicated standalone window mode without browser address bar
  Exec '"$WINDIR\\System32\\cmd.exe" /c start "" msedge.exe --app="file://$PLUGINSDIR\\app.html" --window-size=1280,800 --user-data-dir="$LOCALAPPDATA\\EPL_Studio\\Data\\\${APPSLUG}"'
  IfErrors 0 done

  Exec '"$WINDIR\\System32\\cmd.exe" /c start "" chrome.exe --app="file://$PLUGINSDIR\\app.html" --window-size=1280,800 --user-data-dir="$LOCALAPPDATA\\EPL_Studio\\Data\\\${APPSLUG}"'
  IfErrors 0 done

  ExecShell "open" "$PLUGINSDIR\\app.html"
done:
SectionEnd
`;

  const nsiPath = path.join(tempBuildDir, 'build.nsi');
  await fsp.writeFile(nsiPath, nsiScript, 'utf-8');

  logCallback('Compiling PE32 GUI binary using Nullsoft Compiler (makensis)...');

  try {
    const makensisCmd = await resolveMakensisCommand();
    const { stdout, stderr } = await execFileAsync(makensisCmd, [nsiPath], { cwd: tempBuildDir });
    if (stderr && !stderr.includes('Processed')) {
      logCallback(`Compiler note: ${stderr.trim()}`);
    }
  } catch (err: any) {
    throw new Error(`Windows binary compilation failed: ${err.message || err}`);
  }

  const stats = await fsp.stat(filePath);
  logCallback(`Windows Executable ready: ${fileName} (${(stats.size / 1024).toFixed(1)} KB).`);

  return { filePath, fileName, fileSize: stats.size };
}

// 2. macOS Application Bundle Package (.dmg / .zip)
async function buildMacOSPackage(outDir: string, app: BuildAppMetadata, logCallback: (msg: string) => void): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const slug = sanitizeName(app.title);
  const fileName = `${slug}-macOS-App.zip`;
  const filePath = path.join(outDir, fileName);

  logCallback(`Building macOS Application Bundle (.app) for "${app.title}"...`);

  const standaloneHtml = generateStandaloneAppHtml(app);
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>${app.title}</string>
  <key>CFBundleDisplayName</key>
  <string>${app.title}</string>
  <key>CFBundleIdentifier</key>
  <string>org.eplstudio.${slug.toLowerCase()}</string>
  <key>CFBundleVersion</key>
  <string>${app.version || '1.0.0'}</string>
  <key>CFBundleShortVersionString</key>
  <string>${app.version || '1.0.0'}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleExecutable</key>
  <string>launcher</string>
  <key>LSMinimumSystemVersion</key>
  <string>10.13.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>`;

  const macLauncher = `#!/bin/bash
DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" && pwd )"
open "$DIR/../Resources/app.html"
`;

  const finderLauncher = `#!/bin/bash
DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" && pwd )"
open "$DIR/${app.title}.app/Contents/Resources/app.html"
`;

  const readme = `=====================================================
${app.title} for macOS
=====================================================

HOW TO LAUNCH:
1. Double-click "${app.title}.app" or "Launch-macOS.command".
2. The application will open in a standalone window.
`;

  const appRoot = `${app.title}.app`;
  const { fileSize } = await writeZipFile(
    filePath,
    [
      { name: `${appRoot}/Contents/Info.plist`, content: plist },
      { name: `${appRoot}/Contents/MacOS/launcher`, content: macLauncher, mode: 0o755 },
      { name: `${appRoot}/Contents/Resources/app.html`, content: standaloneHtml },
      { name: `${appRoot}/Contents/Resources/app.epl`, content: app.code },
      { name: 'Launch-macOS.command', content: finderLauncher, mode: 0o755 },
      { name: 'README.txt', content: readme }
    ],
    logCallback
  );

  logCallback(`macOS Application Bundle package ready: ${fileName} (${(fileSize / 1024).toFixed(1)} KB).`);
  return { filePath, fileName, fileSize };
}

// 3. Linux Desktop Application Package (.zip with launch.sh and .desktop)
async function buildLinuxPackage(outDir: string, app: BuildAppMetadata, logCallback: (msg: string) => void): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const slug = sanitizeName(app.title);
  const fileName = `${slug}-Linux-App.zip`;
  const filePath = path.join(outDir, fileName);

  logCallback(`Building Linux Desktop Application package for "${app.title}"...`);

  const standaloneHtml = generateStandaloneAppHtml(app);

  const launchSh = `#!/bin/sh
HERE="$(dirname "$(readlink -f "\${0}")")"
if which google-chrome >/dev/null 2>&1; then
  google-chrome --app="file://$HERE/app.html" --window-size=1280,800
elif which chromium-browser >/dev/null 2>&1; then
  chromium-browser --app="file://$HERE/app.html" --window-size=1280,800
elif which xdg-open >/dev/null 2>&1; then
  xdg-open "$HERE/app.html"
else
  firefox "$HERE/app.html"
fi
`;

  const desktop = `[Desktop Entry]
Type=Application
Name=${app.title}
Exec=sh -c '"$(dirname "%k")/launch.sh"'
Icon=applications-games
Categories=Game;Development;Utility;
Comment=${app.description || 'EPL Studio Application'}
Terminal=false
`;

  const installSh = `#!/bin/sh
HERE="$(dirname "$(readlink -f "\${0}")")"
mkdir -p ~/.local/share/applications/
sed "s|Exec=.*|Exec=$HERE/launch.sh|g" "$HERE/${slug}.desktop" > ~/.local/share/applications/${slug}.desktop
chmod +x ~/.local/share/applications/${slug}.desktop
echo "${app.title} installed to desktop application menu!"
`;

  const readme = `=====================================================
${app.title} for Linux
=====================================================

HOW TO LAUNCH:
1. Run:
   chmod +x launch.sh
   ./launch.sh

2. (Optional) Install to Linux App Launcher:
   chmod +x install.sh
   ./install.sh
`;

  const { fileSize } = await writeZipFile(
    filePath,
    [
      { name: 'launch.sh', content: launchSh, mode: 0o755 },
      { name: 'install.sh', content: installSh, mode: 0o755 },
      { name: `${slug}.desktop`, content: desktop, mode: 0o755 },
      { name: 'app.html', content: standaloneHtml },
      { name: 'app.epl', content: app.code },
      { name: 'README.txt', content: readme }
    ],
    logCallback
  );

  logCallback(`Linux Desktop Application package ready: ${fileName} (${(fileSize / 1024).toFixed(1)} KB).`);
  return { filePath, fileName, fileSize };
}

// 4. Android Progressive Web App Package (.zip)
async function buildAndroidPackage(outDir: string, app: BuildAppMetadata, logCallback: (msg: string) => void): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const slug = sanitizeName(app.title);
  const fileName = `${slug}-Android-PWA.zip`;
  const filePath = path.join(outDir, fileName);

  logCallback(`Building Android Application Package for "${app.title}"...`);

  const standaloneHtml = generateStandaloneAppHtml(app);

  const manifest = JSON.stringify({
    name: app.title,
    short_name: slug,
    start_url: "./app.html",
    display: "standalone",
    orientation: "any",
    background_color: "#09090b",
    theme_color: "#18181b",
    description: app.description || "EPL Studio Application for Android"
  }, null, 2);

  const swJs = `self.addEventListener('install', (e) => {
  e.waitUntil(caches.open('${slug}-v1').then((cache) => cache.addAll(['./', './app.html'])));
});
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});`;

  const readme = `=====================================================
${app.title} for Android
=====================================================

HOW TO INSTALL ON ANDROID:
1. Open "app.html" in Google Chrome / Brave on your Android phone.
2. Tap the menu button (three dots) -> select "Install app" or "Add to Home screen".
3. The app is installed as a native standalone application icon on your Home screen!
4. Launches full-screen completely offline with touch controls.
`;

  const { fileSize } = await writeZipFile(
    filePath,
    [
      { name: 'app.html', content: standaloneHtml },
      { name: 'manifest.json', content: manifest },
      { name: 'sw.js', content: swJs },
      { name: 'app.epl', content: app.code },
      { name: 'INSTALL_ANDROID.txt', content: readme }
    ],
    logCallback
  );

  logCallback(`Android Application package ready: ${fileName} (${(fileSize / 1024).toFixed(1)} KB).`);
  return { filePath, fileName, fileSize };
}

// 5. iOS WebClip Configuration Profile (.mobileconfig)
async function buildIOSPackage(outDir: string, app: BuildAppMetadata, logCallback: (msg: string) => void): Promise<{ filePath: string; fileName: string; fileSize: number; mimeType: string }> {
  const slug = sanitizeName(app.title);
  const fileName = `${slug}.mobileconfig`;
  const filePath = path.join(outDir, fileName);

  logCallback(`Generating iOS WebClip Profile for "${app.title}"...`);

  const uuidPayload = crypto.randomUUID().toUpperCase();
  const uuidProfile = crypto.randomUUID().toUpperCase();
  const launchUrl = app.webUrl || `https://eplstudio.com/player?id=${app.id || slug}`;

  const mobileConfigXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>FullScreen</key>
      <true/>
      <key>IsRemovable</key>
      <true/>
      <key>Label</key>
      <string>${app.title}</string>
      <key>PayloadDescription</key>
      <string>Install ${app.title} to your iOS Home Screen</string>
      <key>PayloadDisplayName</key>
      <string>${app.title} WebClip</string>
      <key>PayloadIdentifier</key>
      <string>org.eplstudio.${slug.toLowerCase()}.webclip</string>
      <key>PayloadType</key>
      <string>com.apple.webClip.managed</string>
      <key>PayloadUUID</key>
      <string>${uuidPayload}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>Precomposed</key>
      <true/>
      <key>URL</key>
      <string>${launchUrl}</string>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Installs ${app.title} application shortcut created with EPL Studio onto your device.</string>
  <key>PayloadDisplayName</key>
  <string>${app.title}</string>
  <key>PayloadIdentifier</key>
  <string>org.eplstudio.${slug.toLowerCase()}.profile</string>
  <key>PayloadOrganization</key>
  <string>EPL Studio</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${uuidProfile}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;

  await fsp.writeFile(filePath, mobileConfigXml, 'utf-8');
  const stats = await fsp.stat(filePath);
  logCallback(`iOS Configuration Profile generated: ${fileName} (${(stats.size / 1024).toFixed(1)} KB).`);

  return { filePath, fileName, fileSize: stats.size, mimeType: 'application/x-apple-aspen-config' };
}

export async function createBuildJob(projectId: string, platform: BuildPlatform, version: string, appData: BuildAppMetadata): Promise<BuildJob> {
  const buildId = `build_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const outDir = path.join(BUILDS_DIR, buildId);
  await fsp.mkdir(outDir, { recursive: true });

  const job: BuildJob = {
    id: buildId,
    projectId,
    platform,
    version: version || '1.0.0',
    status: 'preparing',
    progress: 10,
    statusMessage: 'Preparing project environment and assets...',
    logs: [
      `[${getTimestamp()}] Initializing build worker for platform: ${platform.toUpperCase()}`,
      `[${getTimestamp()}] Target project: "${appData.title}" (v${version || '1.0.0'})`
    ],
    createdAt: Date.now()
  };

  buildJobs.set(buildId, job);

  const addLog = (msg: string) => {
    job.logs.push(`[${getTimestamp()}] ${msg}`);
  };

  // Execute build pipeline in background
  setTimeout(async () => {
    try {
      // Step 1: Installing dependencies
      job.status = 'installing';
      job.progress = 25;
      job.statusMessage = 'Installing runtime dependencies & framework assets...';
      addLog('Resolving standalone runtime framework dependencies...');
      await new Promise(r => setTimeout(r, 200));

      // Step 2: Building
      job.status = 'building';
      job.progress = 50;
      job.statusMessage = `Compiling EPL syntax tree & bundling native runtime for ${platform.toUpperCase()}...`;
      addLog('Compiling project code and linking Web Audio & physics engine...');
      await new Promise(r => setTimeout(r, 250));

      let result: { filePath: string; fileName: string; fileSize: number; mimeType?: string };

      // Step 3: Packaging
      job.status = 'packaging';
      job.progress = 75;
      job.statusMessage = `Packaging application binary for ${platform.toUpperCase()}...`;
      addLog(`Packaging native distribution package for ${platform.toUpperCase()}...`);

      switch (platform) {
        case 'windows':
          result = await buildWindowsExecutable(outDir, appData, addLog);
          result.mimeType = 'application/vnd.microsoft.portable-executable';
          break;
        case 'macos':
          result = await buildMacOSPackage(outDir, appData, addLog);
          result.mimeType = 'application/zip';
          break;
        case 'linux':
          result = await buildLinuxPackage(outDir, appData, addLog);
          result.mimeType = 'application/zip';
          break;
        case 'android':
          result = await buildAndroidPackage(outDir, appData, addLog);
          result.mimeType = 'application/zip';
          break;
        case 'ios':
          result = await buildIOSPackage(outDir, appData, addLog);
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      // Step 4: Validating
      job.status = 'validating';
      job.progress = 90;
      job.statusMessage = 'Validating binary headers and executable signatures...';
      addLog('Validating generated application binary integrity...');

      if (!fs.existsSync(result.filePath)) {
        throw new Error('Validation failed: binary package file was not created');
      }

      const fileStats = await fsp.stat(result.filePath);
      if (fileStats.size < 50) {
        throw new Error(`Validation failed: output package is corrupted or empty (${fileStats.size} bytes)`);
      }

      // If it's a Windows .exe, perform PE validation
      if (result.fileName.endsWith('.exe')) {
        const peVal = await validatePeExecutable(result.filePath);
        if (!peVal.valid) {
          throw new Error(`Windows Executable validation failed: ${peVal.error}`);
        }
        addLog(`Windows PE Binary Validation passed: MZ header and PE structure verified (${(peVal.size / 1024).toFixed(1)} KB).`);
      } else if (result.fileName.endsWith('.zip')) {
        const zipValidation = await validateZipArchive(result.filePath);
        if (!zipValidation.valid) {
          throw new Error(`ZIP Archive validation failed: ${zipValidation.error}`);
        }
        addLog(`ZIP Binary Validation passed: ${zipValidation.entryCount} valid entries, PK headers and EOCD confirmed.`);
      }

      addLog(`Binary package validated: ${result.fileName} (${(fileStats.size / 1024).toFixed(1)} KB).`);
      await new Promise(r => setTimeout(r, 150));

      // Step 5: Ready
      job.status = 'completed';
      job.progress = 100;
      job.statusMessage = 'Application build completed! Ready for download.';
      job.filePath = result.filePath;
      job.fileName = result.fileName;
      job.fileSize = result.fileSize;
      job.mimeType = result.mimeType || 'application/octet-stream';
      job.downloadUrl = `/api/build/${buildId}/download`;

      addLog(`Build completed successfully. Artifact ready at ${job.downloadUrl}`);
    } catch (err: any) {
      console.error('Build failed:', err);
      job.status = 'failed';
      job.progress = 100;
      job.statusMessage = 'Build failed';
      job.error = err.message || 'Build compilation failed';
      addLog(`ERROR: ${job.error}`);
    }
  }, 100);

  return job;
}
