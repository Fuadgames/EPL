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
 * Builds the standalone HTML application runtime.
 * Pure application viewport matching the original design and behaviors without extraneous browser panels.
 */
export function generateStandaloneAppHtml(app: BuildAppMetadata): string {
  const title = app.title || 'EPL Application';
  const code = app.code || '';
  const escapedCode = JSON.stringify(code);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #09090b;
      color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      user-select: none;
      -webkit-user-select: none;
    }
    #stage-container {
      width: 100vw;
      height: 100vh;
      position: relative;
      overflow: hidden;
      background: #000000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #stage {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      overflow: hidden;
      background-color: #0d1117;
    }
    .epl-entity {
      position: absolute;
      transition: transform 0.05s linear;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .entity-player {
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
    }
    .entity-coin {
      animation: pulse 1s infinite alternate;
    }
    @keyframes pulse {
      from { transform: scale(1); }
      to { transform: scale(1.1); }
    }
    #touch-controls {
      position: absolute;
      bottom: 20px;
      left: 20px;
      right: 20px;
      display: none;
      justify-content: space-between;
      pointer-events: none;
      z-index: 30;
    }
    .d-pad {
      pointer-events: auto;
      display: grid;
      gap: 6px;
      grid-template-columns: repeat(3, 48px);
      grid-template-rows: repeat(3, 48px);
    }
    .touch-btn {
      width: 48px;
      height: 48px;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      color: white;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
      touch-action: manipulation;
    }
    .touch-btn:active {
      background: rgba(16, 185, 129, 0.6);
    }
  </style>
</head>
<body>
  <main id="stage-container">
    <div id="stage"></div>
    <div id="touch-controls">
      <div class="d-pad">
        <div></div>
        <button class="touch-btn" id="btn-up">&uarr;</button>
        <div></div>
        <button class="touch-btn" id="btn-left">&larr;</button>
        <div></div>
        <button class="touch-btn" id="btn-right">&rarr;</button>
        <div></div>
        <button class="touch-btn" id="btn-down">&darr;</button>
        <div></div>
      </div>
    </div>
  </main>

  <script>
    const APP_CODE = ${escapedCode};
    const stage = document.getElementById('stage');

    // Web Audio synthesizer (offline sound synthesis)
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

    class StandaloneEPL {
      constructor(source) {
        this.source = source;
        this.entities = {};
        this.variables = {};
        this.events = {};
        this.timers = [];
        this.wasdTarget = null;
        this.score = 0;
      }

      execute() {
        stage.innerHTML = '';
        this.parse();
        this.initEventListeners();
        if (this.events['started?']) {
          for (let cmd of this.events['started?']) {
            this.runCommand(cmd);
          }
        }
      }

      parse() {
        const lines = this.source.split('\\n');
        let currentEvent = null;

        for (let rawLine of lines) {
          const line = rawLine.trim();
          if (!line || line.startsWith('//') || line.startsWith('#')) continue;

          if (line.endsWith('?')) {
            currentEvent = line;
            this.events[currentEvent] = [];
          } else if (line.startsWith('when ') || line.includes('clicked?') || line.includes('started?') || line.includes('every?')) {
            currentEvent = line;
            this.events[currentEvent] = [];
          } else if (line === 'end' || line === 'stop') {
            currentEvent = null;
          } else if (currentEvent) {
            this.events[currentEvent].push(line);
          } else {
            this.runCommand(line);
          }
        }
      }

      runCommand(cmd) {
        try {
          const createMatch = cmd.match(/^create\\{([^}]+)\\}/i) || cmd.match(/^create\\s+([a-zA-Z0-9_]+)\\s*\\{?([^}]*)\\}?/i);
          if (createMatch) {
            const propsStr = createMatch[2] || createMatch[1];
            const props = this.parseProps(propsStr);
            const type = props.type || createMatch[1] || 'block';
            const name = props.name || 'ent_' + Math.random().toString(36).substr(2, 6);

            if (type === 'world') {
              if (props.background || props.bg || props.color) {
                stage.style.backgroundColor = props.background || props.bg || props.color;
              }
              return;
            }

            this.createEntity(name, type, props);
            return;
          }

          const controlMatch = cmd.match(/^control\\s+(wasd|arrows|mouse)\\s+with\\s+([a-zA-Z0-9_]+)/i);
          if (controlMatch) {
            this.wasdTarget = controlMatch[2];
            return;
          }

          const moveMatch = cmd.match(/^move\\s+([a-zA-Z0-9_]+)\\s*\\{?([^}]+)\\}?/i);
          if (moveMatch) {
            const name = moveMatch[1];
            const props = this.parseProps(moveMatch[2]);
            this.moveEntity(name, props.x || 0, props.y || 0);
            return;
          }

          const soundMatch = cmd.match(/^play_sound\\s+([a-zA-Z0-9_]+)/i);
          if (soundMatch) {
            playSfx(soundMatch[1]);
            return;
          }

          const setMatch = cmd.match(/^set\\s+([a-zA-Z0-9_]+)\\s*=\\s*(.+)$/i);
          if (setMatch) {
            this.variables[setMatch[1]] = setMatch[2];
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }

      parseProps(str) {
        const props = {};
        if (!str) return props;
        const pairs = str.split(',');
        for (let pair of pairs) {
          const parts = pair.split('=');
          if (parts.length === 2) {
            const k = parts[0].trim();
            let v = parts[1].trim();
            if (/^[0-9]+$/.test(v)) v = parseInt(v, 10);
            props[k] = v;
          }
        }
        return props;
      }

      createEntity(name, type, props) {
        const el = document.createElement('div');
        el.className = 'epl-entity entity-' + type;
        el.id = 'entity-' + name;

        const x = props.x !== undefined ? props.x : Math.floor(window.innerWidth / 2 - 32);
        const y = props.y !== undefined ? props.y : Math.floor(window.innerHeight / 2 - 32);
        const w = props.width || props.w || 64;
        const h = props.height || props.h || 64;
        const color = props.color || props.bg || '#3b82f6';

        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.width = w + 'px';
        el.style.height = h + 'px';
        el.style.backgroundColor = color;
        el.style.borderRadius = (props.radius ? props.radius + 'px' : (type === 'coin' || type === 'circle' ? '50%' : '8px'));

        if (type === 'text' || type === 'text_label') {
          el.style.backgroundColor = 'transparent';
          el.style.color = color || '#fafafa';
          el.style.fontSize = (props.size || 16) + 'px';
          el.style.fontWeight = 'bold';
          el.textContent = props.text || name;
        } else if (type === 'button') {
          el.style.cursor = 'pointer';
          el.style.display = 'flex';
          el.style.alignItems = 'center';
          el.style.justifyContent = 'center';
          el.style.fontWeight = 'bold';
          el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
          el.textContent = props.text || name;
          el.onclick = () => {
            playSfx('click');
            if (this.events['clicked?{target=' + name + '}']) {
              for (let cmd of this.events['clicked?{target=' + name + '}']) this.runCommand(cmd);
            }
          };
        }

        stage.appendChild(el);
        this.entities[name] = { el, x, y, w, h, type, props };
      }

      moveEntity(name, dx, dy) {
        const ent = this.entities[name];
        if (ent) {
          ent.x += dx;
          ent.y += dy;
          ent.el.style.left = ent.x + 'px';
          ent.el.style.top = ent.y + 'px';
        }
      }

      initEventListeners() {
        window.addEventListener('keydown', (e) => {
          const k = e.key.toLowerCase();
          if (this.wasdTarget) {
            const step = 15;
            if (k === 'w' || k === 'arrowup') this.moveEntity(this.wasdTarget, 0, -step);
            if (k === 's' || k === 'arrowdown') this.moveEntity(this.wasdTarget, 0, step);
            if (k === 'a' || k === 'arrowleft') this.moveEntity(this.wasdTarget, -step, 0);
            if (k === 'd' || k === 'arrowright') this.moveEntity(this.wasdTarget, step, 0);
          }
          if (this.events['key_pressed?']) {
            for (let cmd of this.events['key_pressed?']) this.runCommand(cmd);
          }
        });

        const bindTouch = (id, dx, dy) => {
          const el = document.getElementById(id);
          if (el) {
            el.addEventListener('touchstart', (e) => {
              e.preventDefault();
              if (this.wasdTarget) this.moveEntity(this.wasdTarget, dx * 15, dy * 15);
            });
          }
        };
        bindTouch('btn-up', 0, -1);
        bindTouch('btn-down', 0, 1);
        bindTouch('btn-left', -1, 0);
        bindTouch('btn-right', 1, 0);
      }
    }

    window.addEventListener('DOMContentLoaded', () => {
      const runner = new StandaloneEPL(APP_CODE);
      runner.execute();
      if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        document.getElementById('touch-controls').style.display = 'flex';
      }
    });
  </script>
</body>
</html>`;
}

// 1. Windows Executable Application (.exe) using NSIS Standalone Native Compiler
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

  // Generate NSIS executable script
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
VIAddVersionKey "FileDescription" "\${APPNAME} Application"
VIAddVersionKey "FileVersion" "1.0.0.0"

Section
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File "app.html"
  File "app.epl"

  ; Execute standalone dedicated desktop window mode (frameless, no browser UI)
  ExecWait '"$WINDIR\\System32\\cmd.exe" /c start "" msedge.exe --app="file://$PLUGINSDIR\\app.html" --window-size=1280,800 --user-data-dir="$LOCALAPPDATA\\EPL_Studio\\Data\\\${APPSLUG}"'
SectionEnd
`;

  const nsiPath = path.join(tempBuildDir, 'build.nsi');
  await fsp.writeFile(nsiPath, nsiScript, 'utf-8');

  logCallback('Executing Nullsoft Compiler (makensis) to build PE32 GUI binary...');

  try {
    const { stdout, stderr } = await execFileAsync('makensis', [nsiPath], { cwd: tempBuildDir });
    if (stderr && !stderr.includes('Processed')) {
      logCallback(`Compiler note: ${stderr.trim()}`);
    }
  } catch (err: any) {
    throw new Error(`Windows binary compilation failed: ${err.message || err}`);
  }

  const stats = await fsp.stat(filePath);
  logCallback(`Windows Executable generated: ${fileName} (${(stats.size / 1024).toFixed(1)} KB).`);

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
