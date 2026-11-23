import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';
import { extractDifrenoptBlock, isDifrenoptStartLine } from '../src/lib/drpl-catalog.ts';
import { transpileDRPL } from '../src/lib/drpl-engine.ts';
import { KEYWORDS as EPL_KEYWORDS } from '../src/lib/epl-dictionary.ts';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const archiverModule = require('archiver');
const ZipArchive =
  archiverModule.ZipArchive ||
  archiverModule.default?.ZipArchive ||
  (typeof archiverModule === 'function' ? archiverModule : archiverModule.default);

export interface BuildUploadedFile {
  name: string;
  url: string;
}

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
  uploadedFiles?: BuildUploadedFile[];
}

export type BuildPlatform = 'epl' | 'windows' | 'macos' | 'linux' | 'android' | 'ios';
export type BuildStatus =
  | 'queued'
  | 'preparing'
  | 'installing'
  | 'building'
  | 'packaging'
  | 'validating'
  | 'completed'
  | 'failed';

export interface BuildJob {
  id: string;
  projectId: string;
  platform: BuildPlatform;
  version: string;
  status: BuildStatus;
  progress: number;
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

interface PreparedIconAssets {
  dataUri: string;
  pngBuffer: Buffer;
  pngBase64: string;
  pngPath: string;
  icoPath: string;
}

interface PrecompiledDrplBlock {
  index: number;
  headerLine: string;
  jsCode: string;
  diagnostics: Array<{ line: number; message: string; severity: string }>;
}

const buildJobs = new Map<string, BuildJob>();
const BUILDS_DIR = path.join('/tmp', 'epl_builds');

if (!fs.existsSync(BUILDS_DIR)) {
  fs.mkdirSync(BUILDS_DIR, { recursive: true });
}

// Clean up expired builds (> 2 hours)
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
  return name.replace(/[^a-zA-Z0-9_\-.]/g, '_').replace(/_+/g, '_') || 'EPL_App';
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getTimestamp(): string {
  return new Date().toISOString().split('T')[1].slice(0, 8);
}

function buildFallbackIconSvg(title: string): string {
  const initial = escapeXml((title || 'E').trim().charAt(0).toUpperCase() || 'E');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="56" fill="#0d1117"/>
  <rect x="14" y="14" width="228" height="228" rx="46" fill="url(#g)"/>
  <text x="128" y="136" font-family="sans-serif" font-weight="800" font-size="122" fill="#062118" dominant-baseline="middle" text-anchor="middle">${initial}</text>
</svg>`;
}

/**
 * Resolves the project icon from DataURL, local /public asset, or remote URL,
 * then converts it into native 256x256 PNG and multi-resolution Windows .ico assets.
 */
async function prepareAppIconAssets(
  outDir: string,
  app: BuildAppMetadata,
  logCallback: (msg: string) => void
): Promise<PreparedIconAssets> {
  const rawIconPath = path.join(outDir, 'icon_source');
  const pngPath = path.join(outDir, 'icon.png');
  const icoPath = path.join(outDir, 'app.ico');
  const fallbackSvg = buildFallbackIconSvg(app.title || 'EPL');

  let sourceBuffer: Buffer | null = null;
  let sourceExt = '.svg';

  const iconUrl = (app.iconUrl || '').trim();
  if (iconUrl.startsWith('data:image/')) {
    const match = iconUrl.match(/^data:image\/([a-zA-Z0-9+.-]+)(;base64)?,([\s\S]+)$/);
    if (match) {
      const subtype = match[1].toLowerCase();
      sourceExt = subtype.includes('svg') ? '.svg' : subtype.includes('jpeg') || subtype.includes('jpg') ? '.jpg' : '.png';
      sourceBuffer = match[2]
        ? Buffer.from(match[3], 'base64')
        : Buffer.from(decodeURIComponent(match[3]), 'utf-8');
    }
  } else if (iconUrl.startsWith('/')) {
    const safeRel = path.normalize(iconUrl).replace(/^(\.\.(\/|\\|$))+/, '').replace(/^\/+/, '');
    const publicFile = path.join(process.cwd(), 'public', safeRel);
    if (fs.existsSync(publicFile)) {
      sourceBuffer = await fsp.readFile(publicFile);
      sourceExt = path.extname(publicFile) || '.png';
    }
  } else if (/^https?:\/\//i.test(iconUrl)) {
    try {
      const res = await fetch(iconUrl, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const arrBuf = await res.arrayBuffer();
        if (arrBuf.byteLength > 0 && arrBuf.byteLength < 6 * 1024 * 1024) {
          sourceBuffer = Buffer.from(arrBuf);
          const ct = (res.headers.get('content-type') || '').toLowerCase();
          sourceExt = ct.includes('svg') ? '.svg' : ct.includes('jpeg') || ct.includes('jpg') ? '.jpg' : '.png';
        }
      }
    } catch {
      logCallback('Could not fetch remote icon URL in time; using generated project emblem icon.');
    }
  }

  if (!sourceBuffer || sourceBuffer.length === 0) {
    sourceBuffer = Buffer.from(fallbackSvg, 'utf-8');
    sourceExt = '.svg';
  }

  const rawFile = `${rawIconPath}${sourceExt}`;
  await fsp.writeFile(rawFile, sourceBuffer);

  let pngBuffer: Buffer | null = null;
  try {
    await execFileAsync('convert', [
      rawFile,
      '-background',
      'none',
      '-resize',
      '256x256^',
      '-gravity',
      'center',
      '-extent',
      '256x256',
      pngPath
    ]);
    if (fs.existsSync(pngPath)) {
      pngBuffer = await fsp.readFile(pngPath);
    }
  } catch (err: any) {
    logCallback(`ImageMagick convert fallback for PNG: ${err?.message || 'error'}`);
  }

  // Fallback to SVG if custom image decode failed
  if (!pngBuffer) {
    const svgPath = path.join(outDir, 'icon_fallback.svg');
    await fsp.writeFile(svgPath, fallbackSvg, 'utf-8');
    try {
      await execFileAsync('convert', ['-background', 'none', svgPath, '-resize', '256x256', pngPath]);
      pngBuffer = await fsp.readFile(pngPath);
    } catch {
      // Minimal 1x1 emerald PNG fallback in case ImageMagick fails completely
      pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );
      await fsp.writeFile(pngPath, pngBuffer);
    }
  }

  try {
    await execFileAsync('convert', [
      pngPath,
      '-define',
      'icon:auto-resize=64,48,32,16',
      icoPath
    ]);
    logCallback('Project icon embedded into native 256px PNG and multi-res Windows .ICO.');
  } catch (err: any) {
    logCallback(`Note: .ICO conversion warning (${err?.message || 'skipped'}).`);
  }

  const pngBase64 = pngBuffer.toString('base64');
  const dataUri = iconUrl && iconUrl.startsWith('data:image/')
    ? iconUrl
    : `data:image/png;base64,${pngBase64}`;

  return {
    dataUri,
    pngBuffer,
    pngBase64,
    pngPath,
    icoPath
  };
}

/**
 * Extracts and server-transpiles all `difrenopt { ... } ... end` blocks into
 * standalone JS payloads so standalone builds run DRPL identically to the IDE.
 */
function prepareCodeWithPrecompiledDrpl(rawCode: string): {
  processedCode: string;
  drplBlocks: PrecompiledDrplBlock[];
} {
  const lines = String(rawCode || '').split('\n');
  const outLines: string[] = [];
  const drplBlocks: PrecompiledDrplBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (isDifrenoptStartLine(trimmed)) {
      const { drplLines, nextIndex } = extractDifrenoptBlock(lines, i + 1);
      const dedented = drplLines.map(l => (l.startsWith('  ') ? l.slice(2) : l)).join('\n');
      const result = transpileDRPL(dedented);
      const blockIdx = drplBlocks.length;
      drplBlocks.push({
        index: blockIdx,
        headerLine: trimmed,
        jsCode: result.jsCode,
        diagnostics: result.diagnostics
      });
      // Replace body inside processedCode cleanly so EPL knows exact header & block index
      const hasBraces = /\{[^}]*\}/.test(trimmed);
      if (hasBraces) {
        outLines.push(trimmed.replace(/\}\s*$/, `, __drplIndex=${blockIdx}}`));
      } else {
        outLines.push(`${trimmed} {__drplIndex=${blockIdx}}`);
      }
      outLines.push('end');
      i = nextIndex - 1;
      continue;
    }
    outLines.push(lines[i]);
  }

  return {
    processedCode: outLines.join('\n'),
    drplBlocks
  };
}

export async function validatePeExecutable(
  filePath: string
): Promise<{ valid: boolean; size: number; error?: string }> {
  try {
    const stats = await fsp.stat(filePath);
    if (stats.size < 5000) {
      return {
        valid: false,
        size: stats.size,
        error: `Executable file size is unexpectedly small (${stats.size} bytes)`
      };
    }

    const fd = await fsp.open(filePath, 'r');
    const headerBuf = Buffer.alloc(512);
    await fd.read(headerBuf, 0, 512, 0);
    await fd.close();

    if (headerBuf.readUInt16BE(0) !== 0x4d5a) {
      return { valid: false, size: stats.size, error: 'File is missing valid MS-DOS/Windows MZ header signature' };
    }

    return { valid: true, size: stats.size };
  } catch (err: any) {
    return { valid: false, size: 0, error: err.message || 'Error validating PE binary' };
  }
}

export async function validateZipArchive(
  filePath: string
): Promise<{ valid: boolean; entryCount: number; error?: string }> {
  try {
    const buf = await fsp.readFile(filePath);
    if (buf.length < 22) {
      return { valid: false, entryCount: 0, error: `File too small to be a valid ZIP archive (${buf.length} bytes)` };
    }

    const startSig = buf.readUInt32LE(0);
    if (startSig !== 0x04034b50) {
      return {
        valid: false,
        entryCount: 0,
        error: `Invalid ZIP header signature (got 0x${startSig.toString(16)}, expected 0x04034b50)`
      };
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

    output.on('error', err => {
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
 * Generates the authentic full-fidelity standalone EPL + DRPL Engine runtime HTML.
 */
export function generateStandaloneAppHtml(app: BuildAppMetadata, iconDataUriOverride?: string): string {
  const title = app.title || 'EPL Application';
  const safeTitle = escapeXml(title);
  const rawCode = app.code || '';
  const { processedCode, drplBlocks } = prepareCodeWithPrecompiledDrpl(rawCode);

  const iconHref =
    iconDataUriOverride ||
    (app.iconUrl && app.iconUrl.trim()) ||
    `data:image/svg+xml;utf8,${encodeURIComponent(buildFallbackIconSvg(title))}`;

  const projectManifestJson = JSON.stringify({
    format: 'epl-project-v2',
    title,
    version: app.version || '1.0.0',
    authorName: app.authorName || 'EPL Creator',
    description: app.description || '',
    category: app.category || 'app',
    uploadedFiles: app.uploadedFiles || [],
    code: rawCode
  });

  const escapedProcessedCode = JSON.stringify(processedCode);
  const escapedDrplBlocks = JSON.stringify(drplBlocks);
  const escapedUploadedFiles = JSON.stringify(app.uploadedFiles || []);
  const escapedKeywords = JSON.stringify(EPL_KEYWORDS);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${safeTitle}</title>
  <link rel="icon" href="${iconHref.replace(/"/g, '&quot;')}">
  <link rel="apple-touch-icon" href="${iconHref.replace(/"/g, '&quot;')}">
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
    #epl-world-layer {
      position: absolute;
      inset: 0;
      z-index: 2;
      transform-origin: center center;
    }
    #drpl-stage-root {
      position: absolute;
      inset: 0;
      z-index: 1;
      overflow: hidden;
      background: #07090c;
    }
    #drpl-canvas-2d, #drpl-canvas-3d {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
    }
    #drpl-hud-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 6;
    }
    .drpl-widget {
      position: absolute;
      pointer-events: auto;
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    }
    .epl-entity {
      position: absolute;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
    }
    .entity-button, .entity-linkto {
      cursor: pointer;
      font-weight: 600;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
      transition: transform 0.1s ease, filter 0.1s ease;
    }
    .entity-button:hover, .entity-linkto:hover {
      filter: brightness(1.1);
      transform: scale(1.03);
    }
    .entity-button:active, .entity-linkto:active {
      transform: scale(0.97);
    }
    #epl-file-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0,0,0,0.75);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    #epl-file-modal {
      width: 100%;
      max-width: 720px;
      max-height: 85vh;
      background: #14171c;
      border: 1px solid #262b33;
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 24px 60px rgba(0,0,0,0.65);
    }
    #epl-toast-bar {
      position: fixed;
      top: 14px;
      right: 14px;
      z-index: 9000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    }
    @keyframes epl-pulse {
      from { transform: scale(1); opacity: 0.92; }
      to { transform: scale(1.1); opacity: 1; }
    }
    .epl-particle-dot {
      position: absolute;
      border-radius: 9999px;
      animation: epl-pulse 0.9s infinite alternate;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="stage-viewport">
    <div id="drpl-stage-root" style="display:none;"></div>
    <div id="epl-world-layer"></div>
  </div>
  <div id="epl-toast-bar"></div>
  <div id="epl-file-modal-backdrop">
    <div id="epl-file-modal">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #262b33;">
        <div id="epl-file-modal-title" style="font-weight:700;font-size:14px;color:#10b981;"></div>
        <button id="epl-file-modal-close" style="background:#21252c;border:1px solid #262b33;color:#f4f4f5;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;">Close</button>
      </div>
      <div id="epl-file-modal-body" style="padding:16px;overflow:auto;flex:1;color:#e5e7eb;font-size:13px;"></div>
    </div>
  </div>

  <script type="application/json" id="epl-project-manifest">${projectManifestJson.replace(/<\/script/gi, '<\\/script')}</script>

  <script>
    const PROCESSED_CODE = ${escapedProcessedCode};
    const DRPL_BLOCKS = ${escapedDrplBlocks};
    const APP_UPLOADED_FILES = ${escapedUploadedFiles};
    const KEYWORDS = ${escapedKeywords};

    const stage = document.getElementById('stage-viewport');
    const worldLayer = document.getElementById('epl-world-layer');
    const drplRoot = document.getElementById('drpl-stage-root');
    const toastBar = document.getElementById('epl-toast-bar');

    const ESCAPED_KW = KEYWORDS.map(function(k) {
      return k.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
    });
    const TOKEN_REGEX = new RegExp(
      '(?<![a-zA-Z0-9_])(' + ESCAPED_KW.join('|') + ')(?![a-zA-Z0-9_?])(?:\\\\s*\\\\{([^}]*)\\\\})?|(#.*)',
      'g'
    );

    function showToast(text, kind) {
      const el = document.createElement('div');
      const border = kind === 'error' ? '#ef4444' : kind === 'warn' ? '#f59e0b' : '#10b981';
      el.style.cssText = 'background:#14171c;border:1px solid ' + border + ';color:#f4f4f5;padding:9px 14px;border-radius:10px;font-size:12px;font-weight:600;box-shadow:0 10px 25px rgba(0,0,0,0.4);max-width:320px;';
      el.textContent = String(text || '');
      toastBar.appendChild(el);
      setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 3200);
    }

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

    // Offline Procedural WebAudio SFX
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    let audioCtx = null;
    function playSfx(type, volume) {
      try {
        if (!audioCtx) audioCtx = new AudioCtx();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const vol = Math.min(0.8, Math.max(0.05, Number(volume || 0.3)));
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;
        const t = String(type || 'click').toLowerCase();

        if (t === 'jump') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(170, now);
          osc.frequency.exponentialRampToValueAtTime(520, now + 0.14);
          gain.gain.setValueAtTime(vol, now);
          gain.gain.linearRampToValueAtTime(0.005, now + 0.15);
          osc.start(now); osc.stop(now + 0.15);
        } else if (t === 'coin' || t === 'powerup') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(587, now);
          osc.frequency.setValueAtTime(880, now + 0.07);
          osc.frequency.setValueAtTime(1174, now + 0.14);
          gain.gain.setValueAtTime(vol, now);
          gain.gain.linearRampToValueAtTime(0.005, now + 0.25);
          osc.start(now); osc.stop(now + 0.25);
        } else if (t === 'laser') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(840, now);
          osc.frequency.exponentialRampToValueAtTime(160, now + 0.14);
          gain.gain.setValueAtTime(vol * 0.7, now);
          gain.gain.linearRampToValueAtTime(0.005, now + 0.14);
          osc.start(now); osc.stop(now + 0.14);
        } else if (t === 'hit' || t === 'explosion') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(130, now);
          osc.frequency.exponentialRampToValueAtTime(28, now + 0.28);
          gain.gain.setValueAtTime(vol, now);
          gain.gain.linearRampToValueAtTime(0.005, now + 0.28);
          osc.start(now); osc.stop(now + 0.28);
        } else {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(520, now);
          gain.gain.setValueAtTime(vol * 0.6, now);
          gain.gain.linearRampToValueAtTime(0.005, now + 0.08);
          osc.start(now); osc.stop(now + 0.08);
        }
      } catch (e) {}
    }

    // Standalone File Runner (linkto / run)
    const fileModalBackdrop = document.getElementById('epl-file-modal-backdrop');
    const fileModalTitle = document.getElementById('epl-file-modal-title');
    const fileModalBody = document.getElementById('epl-file-modal-body');
    document.getElementById('epl-file-modal-close').onclick = function() {
      fileModalBackdrop.style.display = 'none';
      fileModalBody.innerHTML = '';
    };
    fileModalBackdrop.onclick = function(e) {
      if (e.target === fileModalBackdrop) {
        fileModalBackdrop.style.display = 'none';
        fileModalBody.innerHTML = '';
      }
    };

    function triggerDownloadFile(fileName, url) {
      if (url && !url.startsWith('data:text/plain')) {
        const dlUrl = url.startsWith('/api/files/') && url.indexOf('download=1') === -1 ? url + '?download=1' : url;
        const a = document.createElement('a');
        a.href = dlUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
      const blob = new Blob(
        ['EPL Project Asset Package: ' + fileName + '\\nExported by EPL Standalone Runtime.'],
        { type: 'application/octet-stream' }
      );
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(objUrl); }, 2000);
    }

    async function handleFileAction(fileName, mode, explicitUrl) {
      const fName = String(fileName || '').trim();
      if (!fName) return;
      const matched = APP_UPLOADED_FILES.find(function(f) {
        return f && (String(f.name || '').toLowerCase() === fName.toLowerCase() || f.url === explicitUrl);
      });
      const resolvedUrl = explicitUrl || (matched && matched.url) || '';
      const resolvedName = (matched && matched.name) || fName;
      const ext = (resolvedName.split('.').pop() || '').toLowerCase();
      const previewable = ['html','htm','png','jpg','jpeg','gif','webp','svg','mp3','wav','ogg','mp4','webm','txt','json','md','epl','drpl','js','css'];

      if (String(mode || 'auto').toLowerCase() === 'download' || !resolvedUrl || previewable.indexOf(ext) === -1) {
        triggerDownloadFile(resolvedName, resolvedUrl);
        showToast(resolvedUrl ? 'Downloading ' + resolvedName + '...' : resolvedName + ' not found locally — downloading package...', 'info');
        return;
      }

      fileModalTitle.textContent = resolvedName;
      fileModalBody.innerHTML = '';
      if (['png','jpg','jpeg','gif','webp','svg'].indexOf(ext) !== -1) {
        const img = document.createElement('img');
        img.src = resolvedUrl;
        img.style.cssText = 'max-width:100%;max-height:65vh;margin:auto;display:block;border-radius:8px;';
        fileModalBody.appendChild(img);
      } else if (['mp3','wav','ogg'].indexOf(ext) !== -1) {
        const aud = document.createElement('audio');
        aud.controls = true; aud.autoplay = true; aud.src = resolvedUrl;
        aud.style.width = '100%';
        fileModalBody.appendChild(aud);
      } else if (['mp4','webm'].indexOf(ext) !== -1) {
        const vid = document.createElement('video');
        vid.controls = true; vid.autoplay = true; vid.src = resolvedUrl;
        vid.style.cssText = 'width:100%;max-height:65vh;border-radius:8px;';
        fileModalBody.appendChild(vid);
      } else if (ext === 'html' || ext === 'htm') {
        const ifr = document.createElement('iframe');
        ifr.src = resolvedUrl;
        ifr.style.cssText = 'width:100%;height:65vh;border:0;border-radius:8px;background:#fff;';
        fileModalBody.appendChild(ifr);
      } else {
        const pre = document.createElement('pre');
        pre.style.cssText = 'white-space:pre-wrap;font-family:monospace;font-size:12px;background:#0a0c0e;padding:12px;border-radius:8px;border:1px solid #262b33;';
        try {
          const resp = await fetch(resolvedUrl);
          pre.textContent = await resp.text();
        } catch (e) {
          pre.textContent = 'File attached: ' + resolvedName;
        }
        fileModalBody.appendChild(pre);
      }
      fileModalBackdrop.style.display = 'flex';
    }

    // Standalone DRPL Runtime (3D WebGL/Fallback + HiDPI 2D + 14 App HUD Widgets)
    function mountDrplRuntime(block, engine) {
      drplRoot.style.display = 'block';
      drplRoot.innerHTML = '';

      const canvas2d = document.createElement('canvas');
      canvas2d.id = 'drpl-canvas-2d';
      const canvas3d = document.createElement('canvas');
      canvas3d.id = 'drpl-canvas-3d';
      canvas3d.style.display = 'none';
      const hudLayer = document.createElement('div');
      hudLayer.id = 'drpl-hud-layer';

      drplRoot.appendChild(canvas3d);
      drplRoot.appendChild(canvas2d);
      drplRoot.appendChild(hudLayer);

      const entities3d = new Map();
      const entities2d = new Map();
      const widgets = new Map();
      const widgetDoms = new Map();
      const stateVars = {};
      const fns = {};
      const bullets = [];
      const particles = [];
      const floaters = [];
      const lasers = [];
      const updateHooks = [];
      const renderHooks = [];
      const timerHooks = [];
      const spinConfigs = [];
      const rigidConfigs = [];
      const keyHooks = new Map();
      const clickHooks = new Map();
      const eventBusHooks = new Map();
      const startHooks = [];
      const keys = new Set();

      let mode3d = false;
      let mode2d = false;
      let world2dCfg = { bg: '#060913', gravity: 960, lighting: true };
      let tilemapCfg = null;
      let parallaxCfg = null;
      let cam2d = { x: 0, y: 0, zoom: 1, shake: 0, follow: 'hero', smoothing: 0.14 };
      let minimapCfg = null;
      let cam3dCfg = { mode: 'orbit', target: 'racer', distance: 12, height: 5, fov: 60 };
      let skyCfg = null;
      let appCfg = { bg: '#0a0c0e', accent: '#10b981' };

      const rt = {
        spawn: function(type, opts) {
          const p = opts || {};
          if (type === 'use3d') {
            mode3d = true;
            canvas3d.style.display = 'block';
            return;
          }
          if (type === 'use2d') {
            mode2d = true;
            world2dCfg = Object.assign({}, world2dCfg, p);
            return;
          }
          if (type === 'useapp') {
            appCfg = Object.assign({}, appCfg, p);
            if (!mode3d && !mode2d) drplRoot.style.background = appCfg.bg || '#0a0c0e';
            return;
          }
          if (type === 'sky3d') { skyCfg = p; mode3d = true; return; }
          if (type === 'camera3d') { cam3dCfg = Object.assign({}, cam3dCfg, p); return; }
          if (type === 'move3d') {
            const name = (p._args && p._args[0]) || p.name;
            const ent = entities3d.get(name);
            if (ent) {
              ent.x = p._args && p._args[1] !== undefined ? Number(p._args[1]) : (p.x !== undefined ? Number(p.x) : ent.x);
              ent.y = p._args && p._args[2] !== undefined ? Number(p._args[2]) : (p.y !== undefined ? Number(p.y) : ent.y);
              ent.z = p._args && p._args[3] !== undefined ? Number(p._args[3]) : (p.z !== undefined ? Number(p.z) : ent.z);
            }
            return;
          }
          if (type === 'rotate3d') {
            const name = (p._args && p._args[0]) || p.name;
            const ent = entities3d.get(name);
            if (ent) {
              ent.ry = (ent.ry || 0) + Number((p._args && p._args[2]) || p.y || 0.05);
            }
            return;
          }
          if (type === 'scale3d') {
            const name = (p._args && p._args[0]) || p.name;
            const ent = entities3d.get(name);
            if (ent) ent.scale = Number((p._args && p._args[1]) || p.scale || 1);
            return;
          }
          if (type === 'spin3d') {
            spinConfigs.push({ target: p.target || p.name, x: Number(p.x || 0), y: Number(p.y || 1.5), z: Number(p.z || 0) });
            return;
          }
          if (type === 'rigidbody3d') {
            rigidConfigs.push({ target: p.target || p.name, gravity: Number(p.gravity || 18), bounce: Number(p.bounce || 0.55), floorY: Number(p.floorY || 1.0), vy: 0 });
            return;
          }
          if (type === 'fog3d') { mode3d = true; return; }
          if (type.endsWith('3d')) {
            mode3d = true;
            canvas3d.style.display = 'block';
            const id = p.name || (type + '_' + entities3d.size);
            entities3d.set(id, Object.assign({ _type: type, name: id, x: 0, y: 0, z: 0, color: '#10b981', speed: 0 }, p));
            return;
          }
          if (type === 'parallax2d') { parallaxCfg = p; mode2d = true; return; }
          if (type === 'tilemap2d') { tilemapCfg = p; mode2d = true; return; }
          if (type === 'camera2d') { cam2d = Object.assign({}, cam2d, p); return; }
          if (type === 'minimap2d') { minimapCfg = p; return; }
          if (type === 'weather2d') { mode2d = true; return; }
          if (type === 'sfx2d') { playSfx(p.preset || 'coin', p.volume || 0.35); return; }
          if (type === 'bullet2d') {
            bullets.push(Object.assign({ x: 0, y: 0, vx: 500, vy: 0, radius: 5, color: '#38bdf8', life: 2 }, p));
            return;
          }
          if (type === 'particles2d') {
            const cnt = Math.min(40, Number(p.count || 16));
            for (let i = 0; i < cnt; i++) {
              const ang = Math.random() * Math.PI * 2;
              const spd = (0.3 + Math.random() * 0.8) * Number(p.speed || 160);
              particles.push({ x: Number(p.x || 0), y: Number(p.y || 0), vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, color: p.color || '#10b981', life: Number(p.life || 0.6), maxLife: Number(p.life || 0.6) });
            }
            return;
          }
          if (type === 'laser2d') {
            lasers.push(Object.assign({ x1: 0, y1: 0, x2: 300, y2: 0, color: '#f43f5e', width: 4, life: Number(p.life || 0.25) }, p));
            return;
          }
          if (type === 'floater2d') {
            floaters.push({ text: String(p.text || '+10'), x: Number(p.x || 100), y: Number(p.y || 100), color: p.color || '#facc15', life: 1.1 });
            return;
          }
          if (type === 'move2d') {
            const name = (p._args && p._args[0]) || p.name;
            const ent = entities2d.get(name);
            if (ent) {
              ent.x += Number((p._args && p._args[1]) || p.dx || 0);
              ent.y += Number((p._args && p._args[2]) || p.dy || 0);
            }
            return;
          }
          if (type.endsWith('2d')) {
            mode2d = true;
            const id = p.name || (type + '_' + entities2d.size);
            const dw = (type === 'rect2d' || type === 'triangle2d') ? 72 : (type === 'circle2d' || type === 'polygon2d') ? Number(p.radius || 30) * 2 : type === 'capsule2d' ? 88 : type === 'line2d' ? 160 : 34;
            const dh = (type === 'rect2d' || type === 'triangle2d') ? 64 : (type === 'circle2d' || type === 'polygon2d') ? Number(p.radius || 30) * 2 : type === 'capsule2d' ? 34 : type === 'line2d' ? 6 : 40;
            entities2d.set(id, Object.assign({ _type: type, name: id, x: 100, y: 200, vx: 0, vy: 0, facing: 1, hp: 100, maxHp: Number(p.hp || 100), w: Number(p.w || dw), h: Number(p.h || dh) }, p));
            return;
          }
          if (type === 'synth_music') { return; }
          if (type === 'storage_save') {
            try { localStorage.setItem('drpl_save_' + (p.key || 'highscore'), JSON.stringify(p.value ?? 0)); } catch (e) {}
            stateVars[p.key || 'highscore'] = p.value ?? 0;
            return;
          }
          if (type === 'dialog2d') {
            const id = p.id || 'dialog2d_box';
            widgets.set(id, { _type: 'ui_modal', id: id, title: p.speaker || 'Guide', body: p.text || '', open: true, x: p.x || 18, y: p.y || 320, w: p.w || 360 });
            renderWidget(id);
            return;
          }
          if (type === 'state_store') {
            Object.keys(p).forEach(function(k) { if (k !== '_args') stateVars[k] = p[k]; });
            return;
          }
          if (type === 'event_bus') {
            if (p.emit) rt.emit(p.emit, p.payload);
            return;
          }
          if (type === 'ui_toast') { showToast(p.text || 'Notice', p.type); return; }
          if (type.startsWith('ui_')) {
            const id = p.id || (type + '_' + widgets.size);
            widgets.set(id, Object.assign({ _type: type, id: id }, p));
            renderWidget(id);
          }
        },
        onStart: function(fn) { startHooks.push(fn); },
        onUpdate: function(fn) { updateHooks.push(fn); },
        onRender: function(fn) { renderHooks.push(fn); },
        onTimer: function(sec, fn) { timerHooks.push({ interval: Math.max(0.05, Number(sec) || 1), elapsed: 0, fn: fn }); },
        onCollide: function(a, b, fn) {
          updateHooks.push(function() {
            const ea = entities2d.get(a), eb = entities2d.get(b);
            if (ea && eb && ea.x < eb.x + eb.w && ea.x + ea.w > eb.x && ea.y < eb.y + eb.h && ea.y + ea.h > eb.y) fn();
          });
        },
        emit: function(name, payload) {
          const list = eventBusHooks.get(String(name)) || [];
          list.forEach(function(fn) { try { fn(payload); } catch (e) {} });
        },
        onEvent: function(name, fn) {
          const k = String(name);
          if (!eventBusHooks.has(k)) eventBusHooks.set(k, []);
          eventBusHooks.get(k).push(fn);
        },
        print: function() {
          const msg = Array.prototype.slice.call(arguments).join(' ');
          for (const entry of widgets.entries()) {
            if (entry[1]._type === 'ui_terminal') { rt.logTerminal(entry[0], msg); return; }
          }
          showToast(msg, 'info');
        },
        println: function() { rt.print.apply(null, arguments); },
        vec2: function(x, y) { return { x: Number(x || 0), y: Number(y || 0) }; },
        vec3: function(x, y, z) { return { x: Number(x || 0), y: Number(y || 0), z: Number(z || 0) }; },
        onKey: function(k, fn) {
          const key = String(k || '').toLowerCase();
          if (!keyHooks.has(key)) keyHooks.set(key, []);
          keyHooks.get(key).push(fn);
        },
        onClick: function(target, fn) {
          const key = String(target || '');
          if (!clickHooks.has(key)) clickHooks.set(key, []);
          clickHooks.get(key).push(fn);
        },
        registerFn: function(name, fn) { fns[name] = fn; },
        setUI: function(id, prop, val) {
          const w = widgets.get(id);
          if (w) { w[prop] = val; renderWidget(id); }
        },
        getUI: function(id, prop, fallback) {
          const w = widgets.get(id);
          return w && w[prop] !== undefined ? w[prop] : fallback;
        },
        pushChart: function(id, val, maxPts) {
          const w = widgets.get(id);
          if (w) {
            const arr = Array.isArray(w.values) ? w.values.slice() : [];
            arr.push(Number(val));
            while (arr.length > (maxPts || 18)) arr.shift();
            w.values = arr;
            renderWidget(id);
          }
        },
        logTerminal: function(id, text) {
          const w = widgets.get(id);
          if (w) {
            const lines = Array.isArray(w.lines) ? w.lines.slice() : [];
            lines.push(String(text));
            while (lines.length > 30) lines.shift();
            w.lines = lines;
            renderWidget(id);
          }
        },
        setVar: function(k, v) { stateVars[k] = v; },
        getVar: function(k, fb) { return stateVars[k] !== undefined ? stateVars[k] : fb; },
        getProp: function(name, prop, fb) {
          const ent = entities3d.get(name) || entities2d.get(name);
          return ent && ent[prop] !== undefined ? ent[prop] : fb;
        },
        get2D: function(name, prop, fb) {
          const ent = entities2d.get(name);
          return ent && ent[prop] !== undefined ? ent[prop] : fb;
        },
        shake: function(v) { cam2d.shake = Math.max(cam2d.shake, Number(v || 8)); },
        playSfx: function(preset, vol) { playSfx(preset, vol); },
        distance3d: function(a, b) {
          const e1 = entities3d.get(a), e2 = entities3d.get(b);
          if (!e1 || !e2) return 9999;
          return Math.hypot((e1.x || 0) - (e2.x || 0), (e1.y || 0) - (e2.y || 0), (e1.z || 0) - (e2.z || 0));
        },
        lerp: function(a, b, t) { return a + (b - a) * t; },
        clamp: function(v, min, max) { return Math.min(max, Math.max(min, v)); },
        rand: function(min, max) { return min + Math.random() * (max - min); },
        randInt: function(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }
      };

      function renderWidget(id) {
        const w = widgets.get(id);
        if (!w) return;
        let dom = widgetDoms.get(id);
        if (!dom) {
          dom = document.createElement('div');
          dom.className = 'drpl-widget';
          hudLayer.appendChild(dom);
          widgetDoms.set(id, dom);
        }
        dom.style.left = (w.x !== undefined ? w.x : 20) + 'px';
        dom.style.top = (w.y !== undefined ? w.y : 20) + 'px';
        if (w.w) dom.style.width = w.w + 'px';
        if (w.h) dom.style.height = w.h + 'px';

        const t = w._type;
        const accent = w.accent || w.color || '#10b981';

        if (t === 'ui_card') {
          dom.style.cssText += ';background:rgba(17,19,21,0.88);backdrop-filter:blur(8px);border:1px solid #262b33;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;justify-content:space-between;';
          dom.innerHTML = '<div style="font-size:10px;font-weight:700;letter-spacing:0.06em;color:#9ca3af;text-transform:uppercase;">' + (w.title || 'METRIC') + '</div>' +
            '<div style="font-size:22px;font-weight:800;font-family:monospace;color:' + accent + ';">' + (w.value !== undefined ? w.value : '0') + '</div>' +
            '<div style="font-size:11px;color:#6b7280;">' + (w.subtitle || '') + '</div>';
        } else if (t === 'ui_gauge') {
          const size = Number(w.size || 130);
          dom.style.width = size + 'px'; dom.style.height = size + 'px';
          const pct = Math.max(0, Math.min(1, ((Number(w.value || 0) - Number(w.min || 0)) / Math.max(1, Number(w.max || 100) - Number(w.min || 0)))));
          const r = 46, c = 2 * Math.PI * r;
          dom.style.cssText += ';background:rgba(17,19,21,0.88);border:1px solid #262b33;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;';
          dom.innerHTML = '<svg width="94" height="94" viewBox="0 0 110 110">' +
            '<circle cx="55" cy="55" r="' + r + '" fill="none" stroke="#21252c" stroke-width="9"/>' +
            '<circle cx="55" cy="55" r="' + r + '" fill="none" stroke="' + accent + '" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + (c * (1 - pct)) + '" transform="rotate(-90 55 55)"/>' +
            '<text x="55" y="53" text-anchor="middle" fill="#f4f4f5" font-size="18" font-weight="800" font-family="monospace">' + Math.round(Number(w.value || 0)) + '</text>' +
            '<text x="55" y="69" text-anchor="middle" fill="#9ca3af" font-size="9" font-weight="700">' + (w.unit || w.label || '') + '</text>' +
            '</svg>';
        } else if (t === 'ui_progress') {
          const pct = Math.max(0, Math.min(100, (Number(w.value || 0) / Math.max(1, Number(w.max || 100))) * 100));
          dom.style.cssText += ';background:rgba(17,19,21,0.88);border:1px solid #262b33;border-radius:10px;padding:8px 12px;';
          dom.innerHTML = '<div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;margin-bottom:5px;"><span>' + (w.label || 'PROGRESS') + '</span><span style="font-family:monospace;color:' + accent + '">' + Math.round(Number(w.value || 0)) + ' / ' + (w.max || 100) + '</span></div>' +
            '<div style="height:8px;background:#21252c;border-radius:999px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:' + accent + ';transition:width 0.12s;"></div></div>';
        } else if (t === 'ui_button') {
          dom.innerHTML = '';
          const btn = document.createElement('button');
          btn.textContent = w.label || 'Action';
          btn.style.cssText = 'width:100%;height:' + (w.h || 38) + 'px;border-radius:9px;border:none;background:' + accent + ';color:#090d11;font-weight:800;font-size:12px;cursor:pointer;padding:0 14px;box-shadow:0 4px 14px rgba(0,0,0,0.35);';
          btn.onclick = function() {
            playSfx('click', 0.25);
            if (w.onClick && typeof fns[w.onClick] === 'function') {
              try { fns[w.onClick](); } catch (e) {}
            }
            const hooks = clickHooks.get(w.id) || [];
            hooks.forEach(function(fn) { try { fn(); } catch (e) {} });
            if (engine) engine.triggerEvent('clicked?', String(w.id || ''), String(w.onClick || ''));
          };
          dom.appendChild(btn);
        } else if (t === 'ui_text') {
          dom.style.cssText += ';font-size:' + (w.size || 16) + 'px;font-weight:700;color:' + (w.color || '#f8fafc') + ';text-shadow:0 1px 4px rgba(0,0,0,0.7);';
          dom.textContent = w.text || '';
        } else if (t === 'ui_chart') {
          const vals = Array.isArray(w.values) && w.values.length ? w.values : [10, 20, 15, 30];
          const maxV = Math.max.apply(null, vals.concat([1]));
          const cw = Number(w.w || 360) - 24, ch = Number(w.h || 170) - 42;
          const pts = vals.map(function(v, idx) {
            const x = vals.length === 1 ? cw / 2 : (idx / (vals.length - 1)) * cw;
            const y = ch - (Number(v) / maxV) * (ch - 8);
            return x.toFixed(1) + ',' + y.toFixed(1);
          }).join(' ');
          dom.style.cssText += ';background:rgba(17,19,21,0.9);border:1px solid #262b33;border-radius:12px;padding:10px 12px;';
          dom.innerHTML = '<div style="font-size:11px;font-weight:700;color:#9ca3af;margin-bottom:6px;">' + (w.title || 'Chart') + '</div>' +
            '<svg width="' + cw + '" height="' + ch + '"><polyline fill="none" stroke="' + accent + '" stroke-width="2.5" points="' + pts + '"/></svg>';
        } else if (t === 'ui_terminal') {
          const lines = Array.isArray(w.lines) ? w.lines : [];
          dom.style.cssText += ';background:#090b0f;border:1px solid #262b33;border-radius:12px;padding:10px 12px;font-family:monospace;font-size:11px;color:#10b981;overflow:auto;';
          dom.innerHTML = '<div style="color:#9ca3af;font-weight:700;margin-bottom:4px;font-family:sans-serif;">' + (w.title || 'Terminal') + '</div>' +
            lines.map(function(l) { return '<div>' + String(l).replace(/</g, '&lt;') + '</div>'; }).join('');
        } else if (t === 'ui_table') {
          const cols = Array.isArray(w.columns) ? w.columns : [];
          const rows = Array.isArray(w.rows) ? w.rows : [];
          dom.style.cssText += ';background:rgba(17,19,21,0.9);border:1px solid #262b33;border-radius:12px;padding:10px 12px;overflow:auto;';
          dom.innerHTML = '<div style="font-size:11px;font-weight:700;color:#9ca3af;margin-bottom:6px;">' + (w.title || 'Table') + '</div>' +
            '<table style="width:100%;border-collapse:collapse;font-size:11px;font-family:monospace;"><thead><tr>' +
            cols.map(function(c) { return '<th style="text-align:left;padding:3px 6px;border-bottom:1px solid #262b33;color:#9ca3af;">' + c + '</th>'; }).join('') +
            '</tr></thead><tbody>' +
            rows.map(function(r) { return '<tr>' + r.map(function(cell) { return '<td style="padding:3px 6px;border-bottom:1px solid #1c2026;color:#e5e7eb;">' + cell + '</td>'; }).join('') + '</tr>'; }).join('') +
            '</tbody></table>';
        } else if (t === 'ui_slider') {
          dom.innerHTML = '';
          dom.style.cssText += ';background:rgba(17,19,21,0.88);border:1px solid #262b33;border-radius:10px;padding:8px 12px;';
          const lbl = document.createElement('div');
          lbl.style.cssText = 'font-size:11px;font-weight:600;color:#d1d5db;margin-bottom:4px;';
          lbl.textContent = (w.label || 'Value') + ': ' + Number(w.value || 0);
          const inp = document.createElement('input');
          inp.type = 'range'; inp.min = w.min ?? 0; inp.max = w.max ?? 100; inp.step = w.step ?? 1; inp.value = w.value ?? 0;
          inp.style.width = '100%';
          inp.oninput = function(e) {
            const v = Number(e.target.value);
            w.value = v;
            if (w.bind) stateVars[w.bind] = v;
            lbl.textContent = (w.label || 'Value') + ': ' + v;
          };
          dom.appendChild(lbl); dom.appendChild(inp);
        } else if (t === 'ui_toggle') {
          dom.innerHTML = '';
          dom.style.cssText += ';background:rgba(17,19,21,0.88);border:1px solid #262b33;border-radius:10px;padding:8px 12px;display:flex;align-items:center;gap:8px;cursor:pointer;';
          const chk = document.createElement('input');
          chk.type = 'checkbox'; chk.checked = Boolean(w.checked);
          chk.onchange = function(e) {
            w.checked = e.target.checked;
            if (w.bind) stateVars[w.bind] = w.checked;
          };
          const sp = document.createElement('span');
          sp.style.cssText = 'font-size:12px;font-weight:600;color:#e5e7eb;';
          sp.textContent = w.label || 'Toggle';
          dom.appendChild(chk); dom.appendChild(sp);
        } else if (t === 'ui_spectrum') {
          const bars = Math.min(32, Number(w.bars || 16));
          dom.style.cssText += ';background:rgba(17,19,21,0.9);border:1px solid #262b33;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;justify-content:space-between;';
          let barHtml = '<div style="font-size:11px;font-weight:700;color:#9ca3af;">' + (w.title || 'Spectrum') + '</div><div style="display:flex;align-items:flex-end;gap:3px;height:' + (Number(w.h || 160) - 40) + 'px;">';
          for (let i = 0; i < bars; i++) {
            const hPct = 25 + Math.round(Math.abs(Math.sin(Date.now() * 0.004 + i * 0.5)) * 70);
            barHtml += '<div style="flex:1;height:' + hPct + '%;background:' + accent + ';border-radius:3px 3px 0 0;opacity:0.85;"></div>';
          }
          dom.innerHTML = barHtml + '</div>';
        } else if (t === 'ui_badge') {
          dom.style.cssText += ';padding:4px 10px;border-radius:6px;border:1px solid ' + accent + '66;background:' + accent + '22;color:' + accent + ';font-family:monospace;font-size:11px;font-weight:700;';
          dom.textContent = w.text || 'LIVE';
        } else if (t === 'ui_avatar') {
          dom.style.cssText += ';background:rgba(17,19,21,0.92);border:1px solid #262b33;border-radius:12px;padding:8px 12px;display:flex;align-items:center;gap:8px;';
          dom.innerHTML = '<div style="width:30px;height:30px;border-radius:8px;background:' + accent + '22;border:1px solid ' + accent + ';color:' + accent + ';display:flex;align-items:center;justify-content:center;font-weight:800;font-family:monospace;">' + String(w.name || 'DR').slice(0, 2).toUpperCase() + '</div>' +
            '<div><div style="font-size:12px;font-weight:700;color:#f3f4f6;">' + (w.name || 'User') + '</div><div style="font-size:10px;color:#9ca3af;">' + (w.role || '') + '</div></div>';
        } else if (t === 'ui_code') {
          dom.style.cssText += ';background:#090b0e;border:1px solid #262b33;border-radius:12px;padding:10px 12px;font-family:monospace;font-size:11px;color:#38bdf8;white-space:pre-wrap;';
          dom.textContent = w.code || '// empty';
        } else if (t === 'ui_modal') {
          if (w.open === false) { dom.style.display = 'none'; return; }
          dom.style.display = 'block';
          dom.style.cssText += ';background:rgba(17,19,21,0.96);border:1px solid #323844;border-radius:12px;padding:14px;z-index:20;';
          dom.innerHTML = '<div style="font-size:14px;font-weight:700;color:#f3f4f6;margin-bottom:6px;">' + (w.title || 'Modal') + '</div>' +
            '<div style="font-size:12px;color:#d1d5db;">' + (w.body || '') + '</div>';
        }
      }

      // Execute transpiled DRPL JS inside sandbox
      try {
        const fn = new Function('rt', 'Math', '"use strict";\\n' + (block.jsCode || ''));
        fn(rt, Math);
      } catch (err) {
        showToast('DRPL Error: ' + (err && err.message ? err.message : err), 'error');
      }

      startHooks.forEach(function(fn) { try { fn(); } catch (e) {} });

      window.addEventListener('keydown', function(e) {
        const k = e.key.toLowerCase();
        keys.add(k);
        const list = keyHooks.get(k);
        if (list) list.forEach(function(fn) { try { fn(); } catch (err) {} });
      });
      window.addEventListener('keyup', function(e) { keys.delete(e.key.toLowerCase()); });

      // Optional live Three.js upgrade for 3D mode (falls back cleanly to 3D wireframe Canvas if offline)
      let threeState = null;
      if (mode3d) {
        import('https://unpkg.com/three@0.170.0/build/three.module.js').then(function(THREE) {
          try {
            const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true, powerPreference: 'high-performance' });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            renderer.setSize(drplRoot.clientWidth, drplRoot.clientHeight, false);
            const scene = new THREE.Scene();
            scene.background = new THREE.Color('#070b14');
            scene.fog = new THREE.FogExp2('#070b14', 0.012);
            const camera = new THREE.PerspectiveCamera(Number(cam3dCfg.fov || 60), Math.max(1, drplRoot.clientWidth) / Math.max(1, drplRoot.clientHeight), 0.1, 400);
            scene.add(new THREE.AmbientLight(0xffffff, 0.75));
            const sun = new THREE.DirectionalLight(0xffffff, 1.4);
            sun.position.set(14, 24, 16);
            scene.add(sun);

            const meshes = new Map();
            entities3d.forEach(function(ent, id) {
              let obj;
              const col = ent.color || '#10b981';
              if (ent._type === 'terrain3d') {
                obj = new THREE.GridHelper(Number(ent.size || 120), 36, ent.wireColor || '#10b981', '#1e293b');
              } else if (ent._type === 'water3d') {
                obj = new THREE.Mesh(new THREE.PlaneGeometry(Number(ent.size || 120), Number(ent.size || 120)), new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.55, roughness: 0.2 }));
                obj.rotation.x = -Math.PI / 2;
              } else if (ent._type === 'car3d') {
                const grp = new THREE.Group();
                const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.2), new THREE.MeshStandardMaterial({ color: col, metalness: 0.7, roughness: 0.25 }));
                const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 2.0), new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.9, roughness: 0.1 }));
                cabin.position.set(0, 0.58, -0.2);
                grp.add(body, cabin);
                obj = grp;
              } else if (ent._type === 'mecha3d' || ent._type === 'boss3d') {
                const s = Number(ent.scale || (ent._type === 'boss3d' ? 1.6 : 1));
                const grp = new THREE.Group();
                const torso = new THREE.Mesh(new THREE.BoxGeometry(1.6 * s, 2.1 * s, 1.1 * s), new THREE.MeshStandardMaterial({ color: col, metalness: 0.6, roughness: 0.3 }));
                const core = new THREE.Mesh(new THREE.SphereGeometry(0.45 * s, 16, 16), new THREE.MeshStandardMaterial({ color: ent.glow || '#10b981', emissive: ent.glow || '#10b981', emissiveIntensity: 1.5 }));
                core.position.z = 0.55 * s;
                grp.add(torso, core);
                obj = grp;
              } else if (ent._type === 'portal3d' || ent._type === 'torus3d') {
                obj = new THREE.Mesh(new THREE.TorusGeometry(Number(ent.radius || 2.2), 0.32, 16, 48), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9 }));
              } else if (ent._type === 'sphere3d' || ent._type === 'pickup3d') {
                obj = new THREE.Mesh(new THREE.SphereGeometry(Number(ent.radius || 0.95), 20, 16), new THREE.MeshStandardMaterial({ color: col, metalness: 0.4, roughness: 0.3 }));
              } else if (ent._type === 'pyramid3d') {
                const pyrGeo = new THREE.ConeGeometry(Number(ent.radius || 1.3), Number(ent.h || 2.2), 4);
                pyrGeo.rotateY(Math.PI / 4);
                obj = new THREE.Mesh(pyrGeo, new THREE.MeshStandardMaterial({ color: col, metalness: 0.4, roughness: 0.35 }));
              } else if (ent._type === 'cone3d') {
                obj = new THREE.Mesh(new THREE.ConeGeometry(Number(ent.radius || 1.1), Number(ent.h || 2.4), 24), new THREE.MeshStandardMaterial({ color: col, metalness: 0.4, roughness: 0.35 }));
              } else if (ent._type === 'cylinder3d') {
                obj = new THREE.Mesh(new THREE.CylinderGeometry(Number(ent.radius || 0.8), Number(ent.radius || 0.8), Number(ent.h || 2), 20), new THREE.MeshStandardMaterial({ color: col, metalness: 0.5, roughness: 0.3 }));
              } else if (ent._type === 'capsule3d') {
                obj = new THREE.Mesh(new THREE.CapsuleGeometry(Number(ent.radius || 0.65), Number(ent.h || 1.4), 8, 16), new THREE.MeshStandardMaterial({ color: col, metalness: 0.4, roughness: 0.35 }));
              } else if (ent._type === 'icosahedron3d') {
                obj = new THREE.Mesh(new THREE.IcosahedronGeometry(Number(ent.radius || 1.15), 0), new THREE.MeshStandardMaterial({ color: col, metalness: 0.5, roughness: 0.25 }));
              } else if (ent._type === 'plane3d') {
                obj = new THREE.Mesh(new THREE.PlaneGeometry(Number(ent.w || 20), Number(ent.d || 20)), new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide }));
                obj.rotation.x = -Math.PI / 2;
              } else if (ent._type === 'ring3d') {
                const rad = Number(ent.radius || 3.0);
                obj = new THREE.Mesh(new THREE.RingGeometry(rad * 0.68, rad, 36), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.2, side: THREE.DoubleSide }));
                obj.rotation.x = -Math.PI / 2;
              } else if (ent._type === 'grid3d') {
                obj = new THREE.GridHelper(Number(ent.size || 80), Number(ent.divisions || 40), col, '#1e293b');
              } else if (ent._type === 'trees3d' || ent._type === 'city3d' || ent._type === 'asteroids3d') {
                const grp = new THREE.Group();
                const count = Math.min(80, Number(ent.count || 40));
                const mat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.4, roughness: 0.5 });
                const geom = ent._type === 'city3d' ? new THREE.BoxGeometry(2.5, 10, 2.5) : ent._type === 'trees3d' ? new THREE.ConeGeometry(1.2, 4.5, 6) : new THREE.DodecahedronGeometry(0.9);
                const inst = new THREE.InstancedMesh(geom, mat, count);
                const dummy = new THREE.Object3D();
                const spread = Number(ent.radius || ent.spread || 55);
                for (let i = 0; i < count; i++) {
                  const ang = i * 2.39996;
                  const dist = 10 + (i / count) * spread;
                  const sy = ent._type === 'city3d' ? 0.4 + ((i * 7) % 10) * 0.2 : 1;
                  dummy.position.set(Math.cos(ang) * dist, ent._type === 'asteroids3d' ? Number(ent.y || 14) + Math.sin(i) * 3 : sy * 2, Math.sin(ang) * dist);
                  dummy.scale.set(1, sy, 1);
                  dummy.updateMatrix();
                  inst.setMatrixAt(i, dummy.matrix);
                }
                grp.add(inst);
                obj = grp;
              } else {
                obj = new THREE.Mesh(new THREE.BoxGeometry(Number(ent.w || 2), Number(ent.h || 2), Number(ent.d || 2)), new THREE.MeshStandardMaterial({ color: col }));
              }
              obj.position.set(Number(ent.x || 0), Number(ent.y || 0), Number(ent.z || 0));
              if (ent.scale !== undefined) obj.scale.setScalar(Number(ent.scale || 1));
              scene.add(obj);
              meshes.set(id, obj);
            });
            threeState = { renderer: renderer, scene: scene, camera: camera, meshes: meshes };
          } catch (e) {}
        }).catch(function() {});
      }

      let lastTs = performance.now();
      let startTs = lastTs;
      function tick(now) {
        const dt = Math.min(0.05, (now - lastTs) / 1000);
        const time = (now - startTs) / 1000;
        lastTs = now;

        // Keyboard driver for hero/car in 3D & 2D
        entities3d.forEach(function(ent) {
          if (ent._type === 'car3d' || ent._type === 'mecha3d') {
            const spd = 12;
            let spdNow = 0;
            if (keys.has('w') || keys.has('arrowup')) { ent.z -= spd * dt; spdNow = spd; }
            if (keys.has('s') || keys.has('arrowdown')) { ent.z += spd * dt; spdNow = -spd; }
            if (keys.has('a') || keys.has('arrowleft')) { ent.x -= spd * dt; }
            if (keys.has('d') || keys.has('arrowright')) { ent.x += spd * dt; }
            ent.speed = spdNow;
          }
        });

        entities2d.forEach(function(ent) {
          if (ent._type === 'player2d') {
            const spd = Number(ent.speed || 260);
            if (keys.has('a') || keys.has('arrowleft')) { ent.x -= spd * dt; ent.facing = -1; }
            if (keys.has('d') || keys.has('arrowright')) { ent.x += spd * dt; ent.facing = 1; }
            if ((keys.has('w') || keys.has('arrowup') || keys.has(' ')) && ent.onGround) {
              ent.vy = -Number(ent.jump || 460);
              ent.onGround = false;
              playSfx('jump', 0.25);
            }
            ent.vy = (ent.vy || 0) + Number(world2dCfg.gravity || 960) * dt;
            ent.y += ent.vy * dt;
            const floorY = tilemapCfg ? Number(tilemapCfg.floorY || 430) : 440;
            if (ent.y + ent.h >= floorY) { ent.y = floorY - ent.h; ent.vy = 0; ent.onGround = true; }
            entities2d.forEach(function(other) {
              if (other._type === 'platform2d') {
                if (ent.x + ent.w > other.x && ent.x < other.x + Number(other.w || 140) && ent.y + ent.h >= other.y && ent.y + ent.h <= other.y + 24 && ent.vy >= 0) {
                  ent.y = other.y - ent.h; ent.vy = 0; ent.onGround = true;
                }
              } else if (other._type === 'coin2d' && !other.collected) {
                if (Math.hypot(ent.x - other.x, ent.y - other.y) < 34) {
                  other.collected = true;
                  playSfx('coin', 0.3);
                  floaters.push({ text: '+' + (other.value || 10), x: other.x, y: other.y - 10, color: '#facc15', life: 0.9 });
                }
              }
            });
          } else if (ent._type === 'enemy2d') {
            ent._originX = ent._originX !== undefined ? ent._originX : ent.x;
            ent.x = ent._originX + Math.sin(time * 1.4) * 65;
          }
        });

        for (let ti = 0; ti < timerHooks.length; ti++) {
          const th = timerHooks[ti];
          th.elapsed += dt;
          if (th.elapsed >= th.interval) { th.elapsed -= th.interval; try { th.fn(); } catch (e) {} }
        }
        updateHooks.forEach(function(fn) { try { fn(dt, time); } catch (e) {} });
        renderHooks.forEach(function(fn) { try { fn(dt, time); } catch (e) {} });

        if (threeState) {
          for (let si = 0; si < spinConfigs.length; si++) {
            const sp = spinConfigs[si];
            const mesh = threeState.meshes.get(sp.target);
            if (mesh) { mesh.rotation.x += sp.x * dt; mesh.rotation.y += sp.y * dt; mesh.rotation.z += sp.z * dt; }
          }
          for (let ri = 0; ri < rigidConfigs.length; ri++) {
            const rg = rigidConfigs[ri];
            const ent = entities3d.get(rg.target);
            if (ent) {
              rg.vy -= rg.gravity * dt;
              ent.y = Number(ent.y || 0) + rg.vy * dt;
              if (ent.y < rg.floorY) { ent.y = rg.floorY; rg.vy = Math.abs(rg.vy) * rg.bounce; if (rg.vy < 0.4) rg.vy = 0; }
            }
          }
          threeState.meshes.forEach(function(m, id) {
            const ent = entities3d.get(id);
            if (ent) m.position.set(Number(ent.x || 0), Number(ent.y || 0), Number(ent.z || 0));
          });
          const tgt = entities3d.get(cam3dCfg.target) || entities3d.values().next().value;
          const tx = tgt ? Number(tgt.x || 0) : 0;
          const ty = tgt ? Number(tgt.y || 0) : 0;
          const tz = tgt ? Number(tgt.z || 0) : 0;
          threeState.camera.position.set(tx, ty + Number(cam3dCfg.height || 5), tz + Number(cam3dCfg.distance || 12));
          threeState.camera.lookAt(tx, ty + 1, tz);
          threeState.renderer.render(threeState.scene, threeState.camera);
        }

        // Canvas 2D Render (2D world OR fallback 3D isometric preview when offline without Three.js)
        const dpr = window.devicePixelRatio || 1;
        const cw = drplRoot.clientWidth || window.innerWidth;
        const ch = drplRoot.clientHeight || window.innerHeight;
        if (canvas2d.width !== Math.floor(cw * dpr) || canvas2d.height !== Math.floor(ch * dpr)) {
          canvas2d.width = Math.floor(cw * dpr);
          canvas2d.height = Math.floor(ch * dpr);
        }
        const ctx = canvas2d.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);
          if (!threeState) ctx.clearRect(0, 0, cw, ch);

          if (mode3d && !threeState) {
            ctx.fillStyle = '#070b14';
            ctx.fillRect(0, 0, cw, ch);
            ctx.strokeStyle = 'rgba(16,185,129,0.18)';
            for (let gx = -10; gx <= 10; gx++) {
              ctx.beginPath(); ctx.moveTo(cw / 2 + gx * 36, ch * 0.42); ctx.lineTo(cw / 2 + gx * 78, ch); ctx.stroke();
            }
            entities3d.forEach(function(ent) {
              const sx = cw / 2 + Number(ent.x || 0) * 14;
              const sy = ch * 0.62 + Number(ent.z || 0) * 8 - Number(ent.y || 0) * 12;
              ctx.fillStyle = ent.color || '#10b981';
              ctx.fillRect(sx - 14, sy - 14, 28, 28);
            });
          } else if (mode2d) {
            ctx.fillStyle = world2dCfg.bg || '#060913';
            ctx.fillRect(0, 0, cw, ch);
            const floorY = tilemapCfg ? Number(tilemapCfg.floorY || 430) : ch - 50;
            ctx.fillStyle = (tilemapCfg && tilemapCfg.color) || '#0f172a';
            ctx.fillRect(0, floorY, cw, ch - floorY);
            ctx.fillStyle = (tilemapCfg && tilemapCfg.accent) || '#10b981';
            ctx.fillRect(0, floorY, cw, 3);

            entities2d.forEach(function(ent) {
              const cx = ent.x + ent.w / 2, cy = ent.y + ent.h / 2;
              if (ent._type === 'platform2d') {
                ctx.fillStyle = ent.color || '#1e293b';
                ctx.fillRect(ent.x, ent.y, Number(ent.w || 150), Number(ent.h || 18));
                ctx.fillStyle = ent.glow || '#38bdf8';
                ctx.fillRect(ent.x, ent.y, Number(ent.w || 150), 3);
              } else if (ent._type === 'coin2d' && !ent.collected) {
                ctx.fillStyle = ent.color || '#facc15';
                ctx.beginPath(); ctx.arc(ent.x, ent.y + Math.sin(time * 4) * 4, 10, 0, Math.PI * 2); ctx.fill();
              } else if (ent._type === 'rect2d') {
                ctx.fillStyle = ent.color || '#38bdf8';
                ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
              } else if (ent._type === 'triangle2d') {
                ctx.fillStyle = ent.color || '#f97316';
                ctx.beginPath(); ctx.moveTo(cx, ent.y); ctx.lineTo(ent.x + ent.w, ent.y + ent.h); ctx.lineTo(ent.x, ent.y + ent.h); ctx.closePath(); ctx.fill();
              } else if (ent._type === 'circle2d') {
                ctx.fillStyle = ent.color || '#a855f7';
                ctx.beginPath(); ctx.arc(cx, cy, Math.min(ent.w, ent.h) / 2, 0, Math.PI * 2); ctx.fill();
              } else if (ent._type === 'polygon2d') {
                const sides = Math.max(3, Number(ent.sides || 6));
                const r = Math.min(ent.w, ent.h) / 2;
                const ang = time * Number(ent.spin || 0);
                ctx.fillStyle = ent.color || '#ec4899';
                ctx.beginPath();
                for (let si = 0; si < sides; si++) {
                  const a = ang + (si / sides) * Math.PI * 2 - Math.PI / 2;
                  const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
                  if (si === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.closePath(); ctx.fill();
              } else if (ent._type === 'line2d') {
                ctx.strokeStyle = ent.color || '#22d3ee'; ctx.lineWidth = Math.max(2, ent.h);
                ctx.beginPath(); ctx.moveTo(ent.x, cy); ctx.lineTo(ent.x + ent.w, cy); ctx.stroke();
              } else if (ent._type === 'capsule2d') {
                ctx.fillStyle = ent.color || '#84cc16';
                ctx.beginPath(); ctx.roundRect(ent.x, ent.y, ent.w, ent.h, Math.min(ent.w, ent.h) / 2); ctx.fill();
              } else {
                ctx.fillStyle = ent.color || (ent._type === 'player2d' ? '#10b981' : '#f43f5e');
                ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
              }
            });

            for (let bi = bullets.length - 1; bi >= 0; bi--) {
              const b = bullets[bi];
              b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
              ctx.fillStyle = b.color || '#38bdf8';
              ctx.beginPath(); ctx.arc(b.x, b.y, b.radius || 5, 0, Math.PI * 2); ctx.fill();
              if (b.life <= 0) bullets.splice(bi, 1);
            }
            for (let pi = particles.length - 1; pi >= 0; pi--) {
              const pt = particles[pi];
              pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
              ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
              ctx.fillStyle = pt.color;
              ctx.fillRect(pt.x, pt.y, 4, 4);
              ctx.globalAlpha = 1;
              if (pt.life <= 0) particles.splice(pi, 1);
            }
            for (let fi = floaters.length - 1; fi >= 0; fi--) {
              const fl = floaters[fi];
              fl.y -= 28 * dt; fl.life -= dt;
              ctx.fillStyle = fl.color; ctx.font = 'bold 13px sans-serif';
              ctx.fillText(fl.text, fl.x, fl.y);
              if (fl.life <= 0) floaters.splice(fi, 1);
            }
          }
          ctx.restore();
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    // Complete Standalone EPL Interpreter (Matched 1:1 with Studio EPLInterpreter)
    class EPLInterpreter {
      constructor() {
        this.context = {
          variables: {},
          entities: {},
          events: {},
          isRunning: true,
          timers: {},
          controlType: null,
          currentObject: null,
          pendingRandomChance: null
        };
        this.domNodes = {};
        this.keysPressed = new Set();
        this.drplMounted = false;
      }

      parseSettings(settingsStr) {
        const obj = {};
        if (!settingsStr) return obj;
        const pairs = [];
        let cur = '';
        let quote = null;
        for (let i = 0; i < settingsStr.length; i++) {
          const c = settingsStr[i];
          if ((c === '"' || c === "'") && settingsStr[i - 1] !== '\\\\') {
            if (quote === c) quote = null;
            else if (!quote) quote = c;
            cur += c;
          } else if (c === ',' && !quote) {
            pairs.push(cur); cur = '';
          } else {
            cur += c;
          }
        }
        if (cur.trim()) pairs.push(cur);

        for (let p of pairs) {
          const eqIdx = p.indexOf('=');
          if (eqIdx === -1) continue;
          const key = p.slice(0, eqIdx).trim();
          let val = p.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          const isRel = val.startsWith('+') || val.startsWith('-');
          if (!isNaN(Number(val)) && !isRel && val !== '') val = Number(val);
          else if (val === 'true') val = true;
          else if (val === 'false') val = false;
          if (key) obj[key] = val;
        }
        return obj;
      }

      interpolate(raw) {
        if (raw === undefined || raw === null) return '';
        const self = this;
        return String(raw).replace(/\\{([a-zA-Z0-9_.]+)\\}/g, function(full, key) {
          if (key.indexOf('.') !== -1) {
            const sp = key.split('.');
            const ent = Object.values(self.context.entities).find(function(e) {
              return String(e.name || '').toLowerCase() === sp[0].toLowerCase();
            });
            if (ent && ent[sp[1]] !== undefined) return String(ent[sp[1]]);
            return full;
          }
          if (self.context.variables[key] !== undefined) return String(self.context.variables[key]);
          return full;
        });
      }

      evaluateExpression(expr) {
        if (expr === undefined || expr === null) return null;
        const s = String(expr).trim();
        if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
        if (s.indexOf('.') !== -1) {
          const sp = s.split('.');
          const ent = Object.values(this.context.entities).find(function(e) { return e.name === sp[0]; });
          if (ent && ent[sp[1]] !== undefined) return ent[sp[1]];
        }
        if (!isNaN(Number(s)) && s !== '') return Number(s);
        if (s === 'true') return true;
        if (s === 'false') return false;
        return this.context.variables[s] !== undefined ? this.context.variables[s] : s;
      }

      evaluateCondition(cond) {
        try {
          const self = this;
          let parsed = String(cond || 'false').replace(/([a-zA-Z0-9_]+)\\.([a-zA-Z0-9_]+)/g, function(m, entName, prop) {
            const ent = Object.values(self.context.entities).find(function(e) { return e.name === entName; });
            if (ent && ent[prop] !== undefined) {
              const v = ent[prop];
              return typeof v === 'string' ? '"' + v.replace(/"/g, '\\\\"') + '"' : String(v);
            }
            return '0';
          });
          Object.keys(this.context.variables).forEach(function(k) {
            const v = self.context.variables[k];
            const rep = typeof v === 'string' ? JSON.stringify(v) : String(v);
            parsed = parsed.replace(new RegExp('\\\\b' + k + '\\\\b', 'g'), rep);
          });
          return Boolean(new Function('return ' + parsed)());
        } catch (e) {
          return false;
        }
      }

      findEntity(name) {
        if (!name) return null;
        const q = String(name).toLowerCase();
        return Object.values(this.context.entities).find(function(e) {
          return String(e.name || '').toLowerCase() === q || String(e.id || '').toLowerCase() === q;
        }) || null;
      }

      async runLines(lines) {
        let i = 0;
        while (i < lines.length && this.context.isRunning) {
          const line = String(lines[i] || '').trim();
          if (!line || line.startsWith('//') || line.startsWith('#')) { i++; continue; }

          if (this.context.pendingRandomChance !== null) {
            const ch = this.context.pendingRandomChance;
            this.context.pendingRandomChance = null;
            if (Math.random() > ch) { i++; continue; }
          }

          const parts = [];
          let m;
          TOKEN_REGEX.lastIndex = 0;
          let lastIdx = 0;
          while ((m = TOKEN_REGEX.exec(line)) !== null) {
            if (m[1]) parts.push({ keyword: m[1], settings: m[2] || '' });
            lastIdx = TOKEN_REGEX.lastIndex;
          }
          void lastIdx;

          let jumped = false;
          for (let j = 0; j < parts.length; j++) {
            const keyword = parts[j].keyword;
            const settings = this.parseSettings(parts[j].settings);

            if (keyword === 'stop' || keyword === 'return') return true;
            if (keyword === 'random') { this.context.pendingRandomChance = Number(settings.chance ?? 0.5); continue; }
            if (keyword === 'wait') {
              await new Promise(function(r) { setTimeout(r, Math.max(10, Number(settings.seconds || 1) * 1000)); });
              continue;
            }
            if (keyword === 'difrenopt') {
              const blkIdx = Number(settings.__drplIndex || 0);
              const blk = DRPL_BLOCKS[blkIdx] || DRPL_BLOCKS[0];
              if (blk && !this.drplMounted) {
                this.drplMounted = true;
                mountDrplRuntime(blk, this);
              }
              continue;
            }
            if (keyword === 'create') {
              let entType = settings.type;
              let entSettings = settings;
              if (!entType && j + 1 < parts.length) {
                entType = parts[j + 1].keyword;
                entSettings = this.parseSettings(parts[j + 1].settings);
                j++;
              }
              if (entType === 'difrenopt') {
                const blkIdx = Number(entSettings.__drplIndex || 0);
                const blk = DRPL_BLOCKS[blkIdx] || DRPL_BLOCKS[0];
                if (blk && !this.drplMounted) {
                  this.drplMounted = true;
                  mountDrplRuntime(blk, this);
                }
                continue;
              }
              if (entType) {
                const id = entSettings.name || ('entity_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
                const entity = Object.assign({ id: id, type: entType, name: entSettings.name || id }, entSettings);
                this.context.entities[id] = entity;
                this.renderEntity(entity);
                if (entType === 'timer') {
                  const self = this;
                  const iv = Math.max(50, Number(entSettings.interval || 1000));
                  this.context.timers[id] = setInterval(function() {
                    if (self.context.isRunning) self.triggerEvent('timer_tick?', entity.name);
                  }, iv);
                }
                this.triggerEvent('created?', entity.name);
              }
              continue;
            }

            if (keyword === 'world') {
              let w = Object.values(this.context.entities).find(function(e) { return e.type === 'world'; });
              if (!w) { w = { id: 'world', type: 'world', name: 'world' }; this.context.entities.world = w; }
              Object.assign(w, settings);
              this.applyWorld(w);
            } else if (keyword === 'background') {
              let w = Object.values(this.context.entities).find(function(e) { return e.type === 'world'; });
              if (!w) { w = { id: 'world', type: 'world', name: 'world' }; this.context.entities.world = w; }
              if (settings.color) w.background = settings.color;
              if (settings.image) w.backgroundImage = settings.image;
              this.applyWorld(w);
            } else if (keyword === 'control' || keyword === 'wasd_controls') {
              this.context.controlType = 'wasd';
              if (settings.target) this.context.controlTarget = settings.target;
            } else if (keyword === 'set up') {
              const target = this.findEntity(settings.target) || this.context.currentObject;
              if (target && settings.property) {
                const val = this.evaluateExpression(settings.value);
                target[settings.property] = val;
                this.updateEntityDom(target);
                this.refreshDynamicLabels();
              }
            } else if (keyword === 'move' || keyword === 'move_to') {
              const target = this.findEntity(settings.target) || this.context.currentObject;
              if (target) {
                if (keyword === 'move_to') {
                  if (settings.x !== undefined) target.x = Number(this.evaluateExpression(settings.x));
                  if (settings.y !== undefined) target.y = Number(this.evaluateExpression(settings.y));
                } else {
                  if (settings.x !== undefined) target.x = (parseFloat(String(target.x || 0)) || 0) + Number(this.evaluateExpression(settings.x));
                  if (settings.y !== undefined) target.y = (parseFloat(String(target.y || 0)) || 0) + Number(this.evaluateExpression(settings.y));
                }
                this.updateEntityDom(target);
                this.checkCollisions(target);
              }
            } else if (keyword === 'jump') {
              const target = this.findEntity(settings.target || 'player') || this.context.currentObject;
              if (target) {
                target.vy = -Number(settings.force || 12);
                playSfx('jump', 0.3);
              }
            } else if (keyword === 'velocity') {
              const target = this.findEntity(settings.target) || this.context.currentObject;
              if (target) {
                if (settings.vx !== undefined) target.vx = Number(settings.vx);
                if (settings.vy !== undefined) target.vy = Number(settings.vy);
              }
            } else if (keyword === 'rotate') {
              const target = this.findEntity(settings.target) || this.context.currentObject;
              if (target) { target.rotation = (Number(target.rotation || 0) + Number(settings.degrees || 15)) % 360; this.updateEntityDom(target); }
            } else if (keyword === 'scale') {
              const target = this.findEntity(settings.target) || this.context.currentObject;
              if (target) { target.scale = Number(settings.factor || 1); this.updateEntityDom(target); }
            } else if (keyword === 'hide') {
              const target = this.findEntity(settings.target) || this.context.currentObject;
              if (target) { target.hidden = true; this.updateEntityDom(target); }
            } else if (keyword === 'show') {
              const target = this.findEntity(settings.target) || this.context.currentObject;
              if (target) { target.hidden = false; this.updateEntityDom(target); }
            } else if (keyword === 'play_sound') {
              playSfx(settings.sound || 'beep', settings.volume);
            } else if (keyword === 'variable') {
              if (settings.name) {
                this.context.variables[settings.name] = this.evaluateExpression(settings.value);
                this.refreshDynamicLabels();
              }
            } else if (keyword === 'math') {
              const tName = settings.target;
              const op = settings.op;
              const val = Number(this.evaluateExpression(settings.value));
              if (tName && op && !isNaN(val)) {
                const cur = Number(this.context.variables[tName] || 0);
                let res = cur;
                if (op === 'add') res = cur + val;
                else if (op === 'subtract') res = cur - val;
                else if (op === 'multiply') res = cur * val;
                else if (op === 'divide' && val !== 0) res = cur / val;
                else if (op === 'set') res = val;
                this.context.variables[tName] = res;
                this.refreshDynamicLabels();
              }
            } else if (keyword === 'corner') {
              const target = this.findEntity(settings.target) || this.context.currentObject;
              if (target) { target.borderRadius = settings.radius ?? 10; this.updateEntityDom(target); }
            } else if (keyword === 'type') {
              showToast(this.interpolate(settings.text || ''), 'info');
            } else if (keyword === 'run') {
              handleFileAction(settings.file || settings.target || '', settings.mode || 'auto', settings.url || '');
            } else if (keyword === 'destroy') {
              const target = this.findEntity(settings.target || (this.context.currentObject && this.context.currentObject.name));
              if (target) {
                delete this.context.entities[target.id];
                if (this.domNodes[target.id]) { this.domNodes[target.id].remove(); delete this.domNodes[target.id]; }
              }
            } else if (keyword === 'spawn') {
              const tpl = this.findEntity(settings.template);
              if (tpl) {
                const cloneId = settings.name || (tpl.name + '_' + Math.random().toString(36).slice(2, 6));
                const clone = Object.assign({}, tpl, { id: cloneId, name: cloneId, spawnComponent: false, isActive: true });
                if (settings.x !== undefined) clone.x = Number(settings.x);
                if (settings.y !== undefined) clone.y = Number(settings.y);
                this.context.entities[cloneId] = clone;
                this.renderEntity(clone);
              }
            } else if (keyword === 'shake') {
              const int = Number(settings.intensity || 8);
              worldLayer.style.transform = 'translate(' + ((Math.random() - 0.5) * int) + 'px, ' + ((Math.random() - 0.5) * int) + 'px)';
              setTimeout(function() { worldLayer.style.transform = ''; }, Number(settings.duration || 220));
            } else if (keyword === 'repeat' || keyword === 'forever' || keyword === 'if') {
              let condOk = true;
              if (keyword === 'if') {
                const chk = parts.find(function(p, idx) { return idx > j && p.keyword === 'check'; });
                const cs = chk ? this.parseSettings(chk.settings) : settings;
                condOk = this.evaluateCondition(cs.expression || 'false');
              }
              const blk = [], elseBlk = [];
              let cur = blk, depth = 0;
              i++;
              while (i < lines.length) {
                const inn = String(lines[i] || '').trim();
                if (/^(if|repeat|forever|object)\\b/i.test(inn)) depth++;
                else if (/^end\\b/i.test(inn)) {
                  if (depth === 0) break;
                  depth--;
                } else if (/^else\\b/i.test(inn) && depth === 0 && keyword === 'if') {
                  cur = elseBlk; i++; continue;
                }
                cur.push(lines[i]);
                i++;
              }
              if (keyword === 'if') {
                if (condOk) await this.runLines(blk);
                else if (elseBlk.length) await this.runLines(elseBlk);
              } else if (keyword === 'repeat') {
                const times = Math.min(200, Math.max(0, Number(settings.times || 1)));
                for (let r = 0; r < times && this.context.isRunning; r++) await this.runLines(blk);
              } else if (keyword === 'forever') {
                const self = this;
                (async function runForever() {
                  while (self.context.isRunning) {
                    await self.runLines(blk);
                    await new Promise(function(res) { setTimeout(res, 16); });
                  }
                })();
              }
              jumped = true;
              break;
            }
          }
          if (!jumped) i++;
        }
      }

      applyWorld(world) {
        if (world.background) stage.style.backgroundColor = world.background;
        if (world.color && !world.background) stage.style.backgroundColor = world.color;
        if (world.backgroundImage) stage.style.backgroundImage = 'url(' + world.backgroundImage + ')';
      }

      refreshDynamicLabels() {
        const self = this;
        Object.values(this.context.entities).forEach(function(ent) {
          self.updateEntityDom(ent);
        });
      }

      renderEntity(entity) {
        if (entity.type === 'world') { this.applyWorld(entity); return; }
        let el = this.domNodes[entity.id];
        const self = this;
        if (!el) {
          if (entity.type === 'sprite' || entity.type === 'player' || entity.type === 'enemy' || entity.type === 'png') {
            el = document.createElement('img');
            el.src = entity.image || entity.file || getDefaultAvatar(entity.name);
          } else if (entity.type === 'button') {
            el = document.createElement('button');
            el.textContent = this.interpolate(entity.label || entity.text || entity.name);
            el.onclick = function() {
              playSfx('click');
              self.triggerEvent('clicked?', entity.name);
              if (entity.label && entity.label !== entity.name) self.triggerEvent('clicked?', entity.label);
              if (entity.text && entity.text !== entity.name) self.triggerEvent('clicked?', entity.text);
              self.triggerEvent('clicked?', entity.type);
            };
          } else if (entity.type === 'linkto') {
            el = document.createElement('button');
            el.textContent = entity.label || ('Open: ' + (entity.file || entity.name));
            el.onclick = function() {
              playSfx('click');
              handleFileAction(entity.file || '', entity.mode || 'auto', entity.url || '');
              self.triggerEvent('clicked?', entity.name);
            };
          } else if (entity.type === 'textbox') {
            el = document.createElement('input');
            el.placeholder = entity.placeholder || 'Type here...';
            el.value = entity.text || '';
            el.style.padding = '6px 10px';
            el.style.borderRadius = '8px';
            el.style.border = '1px solid #334155';
            el.style.background = '#111315';
            el.style.color = '#f8fafc';
            el.oninput = function(e) {
              entity.text = e.target.value;
              self.triggerEvent('writed?', entity.name, e.target.value);
            };
          } else if (entity.type === 'checkbox') {
            el = document.createElement('label');
            el.style.cssText = 'gap:8px;cursor:pointer;color:#f8fafc;font-size:13px;font-weight:600;';
            const chk = document.createElement('input');
            chk.type = 'checkbox'; chk.checked = Boolean(entity.checked);
            chk.onchange = function(e) {
              entity.checked = e.target.checked;
              if (entity.variable) self.context.variables[entity.variable] = entity.checked;
              self.triggerEvent('changed?', entity.name, String(entity.checked));
            };
            const sp = document.createElement('span');
            sp.textContent = entity.label || entity.name;
            el.appendChild(chk); el.appendChild(sp);
          } else if (entity.type === 'slider') {
            el = document.createElement('div');
            el.style.cssText = 'flex-direction:column;align-items:stretch;background:rgba(17,19,21,0.85);padding:8px 10px;border-radius:10px;border:1px solid #262b33;';
            const lbl = document.createElement('div');
            lbl.style.cssText = 'font-size:11px;color:#d1d5db;margin-bottom:4px;';
            lbl.textContent = (entity.label || entity.name) + ': ' + (entity.value ?? 50);
            const inp = document.createElement('input');
            inp.type = 'range'; inp.min = entity.min ?? 0; inp.max = entity.max ?? 100; inp.value = entity.value ?? 50;
            inp.oninput = function(e) {
              entity.value = Number(e.target.value);
              if (entity.variable) self.context.variables[entity.variable] = entity.value;
              lbl.textContent = (entity.label || entity.name) + ': ' + entity.value;
              self.triggerEvent('changed?', entity.name, String(entity.value));
            };
            el.appendChild(lbl); el.appendChild(inp);
          } else if (entity.type === 'progress') {
            el = document.createElement('div');
            el.style.cssText = 'flex-direction:column;align-items:stretch;background:rgba(17,19,21,0.85);padding:6px 10px;border-radius:10px;border:1px solid #262b33;';
          } else if (entity.type === 'panel') {
            el = document.createElement('div');
            el.style.cssText = 'flex-direction:column;align-items:flex-start;justify-content:flex-start;padding:10px 12px;border:1px solid #262b33;';
          } else {
            el = document.createElement('div');
          }
          el.className = 'epl-entity entity-' + entity.type;
          el.id = 'epl-' + entity.id;
          worldLayer.appendChild(el);
          this.domNodes[entity.id] = el;
        }
        this.updateEntityDom(entity);
      }

      updateEntityDom(entity) {
        const el = this.domNodes[entity.id];
        if (!el) return;
        if (entity.hidden || (entity.spawnComponent && !entity.isActive)) {
          el.style.display = 'none';
          return;
        }
        el.style.display = 'flex';

        const x = entity.x !== undefined ? entity.x : Math.floor(window.innerWidth / 2 - 32);
        const y = entity.y !== undefined ? entity.y : Math.floor(window.innerHeight / 2 - 32);
        const w = entity.width || entity.size || (entity.radius ? entity.radius * 2 : (entity.type === 'button' || entity.type === 'linkto' ? 140 : 64));
        const h = entity.height || (entity.type === 'button' || entity.type === 'linkto' ? 40 : (entity.size || (entity.radius ? entity.radius * 2 : 64)));

        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.width = w + 'px';
        if (entity.type !== 'text_label') el.style.height = h + 'px';

        if (entity.color && entity.type !== 'text_label') el.style.backgroundColor = entity.color;
        if (entity.type === 'button' && !entity.color) { el.style.backgroundColor = '#10b981'; el.style.color = '#09120e'; el.style.border = 'none'; el.style.borderRadius = '8px'; }
        if (entity.type === 'linkto' && !entity.color) { el.style.backgroundColor = '#0284c7'; el.style.color = '#ffffff'; el.style.border = 'none'; el.style.borderRadius = '8px'; }
        if (entity.borderRadius !== undefined || entity.corner !== undefined) el.style.borderRadius = (entity.borderRadius ?? entity.corner) + 'px';
        else if (entity.type === 'circle') el.style.borderRadius = '50%';

        if (entity.type === 'text_label') {
          el.style.color = entity.color || '#ffffff';
          el.style.fontSize = (entity.size || 18) + 'px';
          el.style.fontWeight = '700';
          el.style.backgroundColor = 'transparent';
          el.textContent = this.interpolate(entity.text || entity.name);
        } else if (entity.type === 'button') {
          el.textContent = this.interpolate(entity.label || entity.text || entity.name);
        } else if (entity.type === 'panel') {
          el.style.backgroundColor = entity.color || '#181b20';
          if (entity.title) el.innerHTML = '<div style="font-size:12px;font-weight:700;color:#e5e7eb;">' + this.interpolate(entity.title) + '</div>';
        } else if (entity.type === 'progress') {
          const val = entity.variable && this.context.variables[entity.variable] !== undefined ? Number(this.context.variables[entity.variable]) : Number(entity.value ?? 50);
          const max = Math.max(1, Number(entity.max ?? 100));
          const pct = Math.max(0, Math.min(100, (val / max) * 100));
          el.style.backgroundColor = 'rgba(17,19,21,0.88)';
          el.innerHTML = '<div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;margin-bottom:4px;"><span>' + (entity.label || entity.name) + '</span><span>' + Math.round(val) + '/' + max + '</span></div>' +
            '<div style="height:8px;background:#21252c;border-radius:999px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:' + (entity.color || '#10b981') + ';"></div></div>';
        }

        el.style.transform = 'rotate(' + (entity.rotation || 0) + 'deg) scale(' + (entity.scale || 1) + ')';
        if (entity.opacity !== undefined) el.style.opacity = entity.opacity;
      }

      checkCollisions(mover) {
        const mx = Number(mover.x || 0), my = Number(mover.y || 0);
        const mw = Number(mover.width || mover.size || 64), mh = Number(mover.height || mover.size || 64);
        const self = this;
        Object.values(this.context.entities).forEach(function(other) {
          if (other.id === mover.id || other.type === 'world' || other.hidden) return;
          const ox = Number(other.x || 0), oy = Number(other.y || 0);
          const ow = Number(other.width || other.size || 64), oh = Number(other.height || other.size || 64);
          if (mx < ox + ow && mx + mw > ox && my < oy + oh && my + mh > oy) {
            self.triggerEvent('collided?', mover.name);
            self.triggerEvent('collided?', other.name);
          }
        });
      }

      triggerEvent(eventName, target) {
        const self = this;
        const exactKey = target ? (eventName + '_' + target) : eventName;
        if (this.context.events[exactKey]) {
          this.runLines(this.context.events[exactKey]);
          return;
        }
        if (target) {
          const lower = exactKey.toLowerCase();
          const matchKey = Object.keys(this.context.events).find(function(k) {
            return k.toLowerCase() === lower;
          });
          if (matchKey) { this.runLines(this.context.events[matchKey]); return; }
        }
        if (this.context.events[eventName]) {
          this.runLines(this.context.events[eventName]);
        }
      }

      startGameLoop() {
        const self = this;
        const loop = function() {
          if (!self.context.isRunning) return;
          if (self.context.controlType === 'wasd') {
            const player = self.findEntity(self.context.controlTarget) || Object.values(self.context.entities).find(function(e) { return e.type === 'player'; });
            if (player) {
              const spd = Number(player.speed || 5);
              let moved = false;
              if (self.keysPressed.has('w') || self.keysPressed.has('arrowup')) { player.y = (Number(player.y) || 0) - spd; moved = true; }
              if (self.keysPressed.has('s') || self.keysPressed.has('arrowdown')) { player.y = (Number(player.y) || 0) + spd; moved = true; }
              if (self.keysPressed.has('a') || self.keysPressed.has('arrowleft')) { player.x = (Number(player.x) || 0) - spd; moved = true; }
              if (self.keysPressed.has('d') || self.keysPressed.has('arrowright')) { player.x = (Number(player.x) || 0) + spd; moved = true; }
              if (moved) { self.updateEntityDom(player); self.checkCollisions(player); }
            }
          }
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      }

      async run(code) {
        this.context.isRunning = true;
        this.startGameLoop();

        const lines = String(code || '').split('\\n');
        let currentEvent = 'started?';
        let eventBlock = [];
        let nestDepth = 0;
        const eventNames = ['started?', 'created?', 'clicked?', 'collided?', 'key_pressed?', 'timer_tick?', 'writed?', 'variable_activated?', 'changed?'];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line || line.startsWith('#') || line.startsWith('//')) continue;

          const parts = [];
          let m;
          TOKEN_REGEX.lastIndex = 0;
          while ((m = TOKEN_REGEX.exec(line)) !== null) {
            if (m[1]) parts.push({ keyword: m[1], settings: m[2] || '' });
          }

          let foundEvent = false;
          for (let j = 0; j < parts.length; j++) {
            const kw = parts[j].keyword;
            if (eventNames.indexOf(kw) !== -1) {
              if (currentEvent && eventBlock.length > 0) {
                this.context.events[currentEvent] = (this.context.events[currentEvent] || []).concat(eventBlock);
              }
              const settings = this.parseSettings(parts[j].settings);
              const suffix = settings.target || settings.key || settings.name || settings.var || settings.variable;
              currentEvent = (kw === 'started?' || !suffix) ? kw : (kw + '_' + suffix);
              eventBlock = [];
              nestDepth = 0;
              foundEvent = true;
              break;
            }
          }
          if (foundEvent) continue;

          const firstKw = parts.length ? parts[0].keyword : '';
          if (firstKw === 'if' || firstKw === 'repeat' || firstKw === 'forever' || firstKw === 'object') {
            nestDepth++;
            eventBlock.push(line);
          } else if (firstKw === 'end') {
            if (nestDepth > 0) {
              nestDepth--;
              eventBlock.push(line);
            } else if (currentEvent) {
              this.context.events[currentEvent] = (this.context.events[currentEvent] || []).concat(eventBlock);
              currentEvent = 'started?';
              eventBlock = [];
            }
          } else if (currentEvent) {
            eventBlock.push(line);
          }
        }

        if (currentEvent && eventBlock.length > 0) {
          this.context.events[currentEvent] = (this.context.events[currentEvent] || []).concat(eventBlock);
        }

        if (this.context.events['started?']) {
          await this.runLines(this.context.events['started?']);
        }
        // Fallback: if code had difrenopt at top-level or skipped started?, mount DRPL automatically
        if (!this.drplMounted && DRPL_BLOCKS.length > 0) {
          this.drplMounted = true;
          mountDrplRuntime(DRPL_BLOCKS[0], this);
        }
      }
    }

    window.addEventListener('DOMContentLoaded', function() {
      const engine = new EPLInterpreter();
      window.addEventListener('keydown', function(e) {
        engine.keysPressed.add(e.key.toLowerCase());
        engine.triggerEvent('key_pressed?', e.key);
      });
      window.addEventListener('keyup', function(e) {
        engine.keysPressed.delete(e.key.toLowerCase());
      });
      engine.run(PROCESSED_CODE);
    });
  </script>
</body>
</html>`;
}

// 0. Direct EPL Standalone Application File (.epl.html — instant click-to-run with full EPL + DRPL + embedded icon & project payload)
async function buildDirectEplPackage(
  outDir: string,
  app: BuildAppMetadata,
  iconAssets: PreparedIconAssets,
  logCallback: (msg: string) => void
): Promise<{ filePath: string; fileName: string; fileSize: number; mimeType: string }> {
  const slug = sanitizeName(app.title);
  const fileName = `${slug}.epl.html`;
  const filePath = path.join(outDir, fileName);

  logCallback(`Generating Direct EPL Project App "${fileName}" with full EPL + DRPL runtime & embedded project icon...`);
  const html = generateStandaloneAppHtml(app, iconAssets.dataUri);
  await fsp.writeFile(filePath, html, 'utf-8');

  const stats = await fsp.stat(filePath);
  logCallback(`Direct EPL Project ready: ${fileName} (${(stats.size / 1024).toFixed(1)} KB).`);
  return { filePath, fileName, fileSize: stats.size, mimeType: 'text/html' };
}

async function resolveMakensisCommand(): Promise<string> {
  try {
    await execFileAsync('makensis', ['-VERSION']);
    return 'makensis';
  } catch {}

  const localBin = path.join(process.cwd(), 'bin', 'makensis');
  if (fs.existsSync(localBin)) return localBin;

  const usrBin = '/usr/bin/makensis';
  if (fs.existsSync(usrBin)) return usrBin;

  throw new Error('Nullsoft Compiler (makensis) binary not found');
}

// 1. Windows Executable Application (.exe) using NSIS Native Compiler + Project Icon (.ico)
async function buildWindowsExecutable(
  outDir: string,
  app: BuildAppMetadata,
  iconAssets: PreparedIconAssets,
  logCallback: (msg: string) => void
): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const slug = sanitizeName(app.title);
  const fileName = `${slug}.exe`;
  const filePath = path.join(outDir, fileName);

  logCallback(`Compiling standalone Windows Executable (.exe) for "${app.title}"...`);

  const appHtml = generateStandaloneAppHtml(app, iconAssets.dataUri);
  const tempBuildDir = path.join(outDir, 'win_build_src');
  await fsp.mkdir(tempBuildDir, { recursive: true });

  await fsp.writeFile(path.join(tempBuildDir, 'app.html'), appHtml, 'utf-8');
  await fsp.writeFile(path.join(tempBuildDir, 'app.epl'), app.code || '', 'utf-8');
  await fsp.copyFile(iconAssets.pngPath, path.join(tempBuildDir, 'icon.png'));

  const hasIco = fs.existsSync(iconAssets.icoPath);
  if (hasIco) {
    await fsp.copyFile(iconAssets.icoPath, path.join(tempBuildDir, 'app.ico'));
  }

  const iconDirective = hasIco ? 'Icon "app.ico"' : '';
  const nsiScript = `!define APPNAME "${app.title.replace(/"/g, '')}"
!define APPSLUG "${slug}"
!define VERSION "${app.version || '1.0.0.0'}"

Name "\${APPNAME}"
OutFile "${filePath}"
${iconDirective}
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
  File "icon.png"

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
    const { stderr } = await execFileAsync(makensisCmd, [nsiPath], { cwd: tempBuildDir });
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

// 2. macOS Application Bundle Package (.zip / .app with embedded icon)
async function buildMacOSPackage(
  outDir: string,
  app: BuildAppMetadata,
  iconAssets: PreparedIconAssets,
  logCallback: (msg: string) => void
): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const slug = sanitizeName(app.title);
  const fileName = `${slug}-macOS-App.zip`;
  const filePath = path.join(outDir, fileName);

  logCallback(`Building macOS Application Bundle (.app) for "${app.title}"...`);

  const standaloneHtml = generateStandaloneAppHtml(app, iconAssets.dataUri);
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>${escapeXml(app.title)}</string>
  <key>CFBundleDisplayName</key>
  <string>${escapeXml(app.title)}</string>
  <key>CFBundleIdentifier</key>
  <string>org.eplstudio.${slug.toLowerCase()}</string>
  <key>CFBundleVersion</key>
  <string>${escapeXml(app.version || '1.0.0')}</string>
  <key>CFBundleShortVersionString</key>
  <string>${escapeXml(app.version || '1.0.0')}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleExecutable</key>
  <string>launcher</string>
  <key>CFBundleIconFile</key>
  <string>icon.png</string>
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
open "$DIR/${slug}.app/Contents/Resources/app.html"
`;

  const readme = `=====================================================
${app.title} for macOS
=====================================================

HOW TO LAUNCH:
1. Double-click "${slug}.app" or "Launch-macOS.command".
2. The application opens with its project icon and full EPL/DRPL runtime.
`;

  const appRoot = `${slug}.app`;
  const { fileSize } = await writeZipFile(
    filePath,
    [
      { name: `${appRoot}/Contents/Info.plist`, content: plist },
      { name: `${appRoot}/Contents/MacOS/launcher`, content: macLauncher, mode: 0o755 },
      { name: `${appRoot}/Contents/Resources/app.html`, content: standaloneHtml },
      { name: `${appRoot}/Contents/Resources/icon.png`, content: iconAssets.pngBuffer },
      { name: `${appRoot}/Contents/Resources/app.epl`, content: app.code || '' },
      { name: 'Launch-macOS.command', content: finderLauncher, mode: 0o755 },
      { name: 'README.txt', content: readme }
    ],
    logCallback
  );

  logCallback(`macOS Application Bundle package ready: ${fileName} (${(fileSize / 1024).toFixed(1)} KB).`);
  return { filePath, fileName, fileSize };
}

// 3. Linux Desktop Application Package (.zip with icon.png and .desktop)
async function buildLinuxPackage(
  outDir: string,
  app: BuildAppMetadata,
  iconAssets: PreparedIconAssets,
  logCallback: (msg: string) => void
): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const slug = sanitizeName(app.title);
  const fileName = `${slug}-Linux-App.zip`;
  const filePath = path.join(outDir, fileName);

  logCallback(`Building Linux Desktop Application package for "${app.title}"...`);

  const standaloneHtml = generateStandaloneAppHtml(app, iconAssets.dataUri);

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
Icon=${slug}
Categories=Game;Development;Utility;
Comment=${app.description || 'EPL Studio Application'}
Terminal=false
`;

  const installSh = `#!/bin/sh
HERE="$(dirname "$(readlink -f "\${0}")")"
mkdir -p ~/.local/share/applications/ ~/.local/share/icons/
cp "$HERE/icon.png" ~/.local/share/icons/${slug}.png
sed "s|Exec=.*|Exec=$HERE/launch.sh|g;s|Icon=.*|Icon=$HOME/.local/share/icons/${slug}.png|g" "$HERE/${slug}.desktop" > ~/.local/share/applications/${slug}.desktop
chmod +x ~/.local/share/applications/${slug}.desktop
echo "${app.title} installed to desktop application menu!"
`;

  const { fileSize } = await writeZipFile(
    filePath,
    [
      { name: 'launch.sh', content: launchSh, mode: 0o755 },
      { name: 'install.sh', content: installSh, mode: 0o755 },
      { name: `${slug}.desktop`, content: desktop, mode: 0o755 },
      { name: 'icon.png', content: iconAssets.pngBuffer },
      { name: 'app.html', content: standaloneHtml },
      { name: 'app.epl', content: app.code || '' }
    ],
    logCallback
  );

  logCallback(`Linux Desktop Application package ready: ${fileName} (${(fileSize / 1024).toFixed(1)} KB).`);
  return { filePath, fileName, fileSize };
}

// 4. Android Progressive Web App Package (.zip with icon.png & manifest icons)
async function buildAndroidPackage(
  outDir: string,
  app: BuildAppMetadata,
  iconAssets: PreparedIconAssets,
  logCallback: (msg: string) => void
): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const slug = sanitizeName(app.title);
  const fileName = `${slug}-Android-PWA.zip`;
  const filePath = path.join(outDir, fileName);

  logCallback(`Building Android Application Package for "${app.title}"...`);

  const standaloneHtml = generateStandaloneAppHtml(app, iconAssets.dataUri);

  const manifest = JSON.stringify(
    {
      name: app.title,
      short_name: slug,
      start_url: './app.html',
      display: 'standalone',
      orientation: 'any',
      background_color: '#09090b',
      theme_color: '#10b981',
      description: app.description || 'EPL Studio Application for Android',
      icons: [
        { src: './icon.png', sizes: '256x256', type: 'image/png', purpose: 'any maskable' }
      ]
    },
    null,
    2
  );

  const swJs = `self.addEventListener('install', (e) => {
  e.waitUntil(caches.open('${slug}-v1').then((cache) => cache.addAll(['./', './app.html', './icon.png'])));
});
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});`;

  const { fileSize } = await writeZipFile(
    filePath,
    [
      { name: 'app.html', content: standaloneHtml },
      { name: 'icon.png', content: iconAssets.pngBuffer },
      { name: 'manifest.json', content: manifest },
      { name: 'sw.js', content: swJs },
      { name: 'app.epl', content: app.code || '' }
    ],
    logCallback
  );

  logCallback(`Android Application package ready: ${fileName} (${(fileSize / 1024).toFixed(1)} KB).`);
  return { filePath, fileName, fileSize };
}

// 5. iOS WebClip Configuration Profile (.mobileconfig with base64 project icon)
async function buildIOSPackage(
  outDir: string,
  app: BuildAppMetadata,
  iconAssets: PreparedIconAssets,
  logCallback: (msg: string) => void
): Promise<{ filePath: string; fileName: string; fileSize: number; mimeType: string }> {
  const slug = sanitizeName(app.title);
  const fileName = `${slug}.mobileconfig`;
  const filePath = path.join(outDir, fileName);

  logCallback(`Generating iOS WebClip Profile for "${app.title}" with embedded project icon...`);

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
      <key>Icon</key>
      <data>
        ${iconAssets.pngBase64}
      </data>
      <key>IsRemovable</key>
      <true/>
      <key>Label</key>
      <string>${escapeXml(app.title)}</string>
      <key>PayloadDescription</key>
      <string>Install ${escapeXml(app.title)} to your iOS Home Screen</string>
      <key>PayloadDisplayName</key>
      <string>${escapeXml(app.title)} WebClip</string>
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
      <string>${escapeXml(launchUrl)}</string>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Installs ${escapeXml(app.title)} application shortcut created with EPL Studio onto your device.</string>
  <key>PayloadDisplayName</key>
  <string>${escapeXml(app.title)}</string>
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

export async function createBuildJob(
  projectId: string,
  platform: BuildPlatform,
  version: string,
  appData: BuildAppMetadata
): Promise<BuildJob> {
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
    statusMessage: 'Preparing project environment, icon & assets...',
    logs: [
      `[${getTimestamp()}] Initializing build worker for target: ${platform.toUpperCase()}`,
      `[${getTimestamp()}] Target project: "${appData.title}" (v${version || '1.0.0'})`
    ],
    createdAt: Date.now()
  };

  buildJobs.set(buildId, job);

  const addLog = (msg: string) => {
    job.logs.push(`[${getTimestamp()}] ${msg}`);
  };

  setTimeout(async () => {
    try {
      job.status = 'installing';
      job.progress = 25;
      job.statusMessage = 'Preparing project icon & pre-transpiling EPL / DRPL engine...';
      addLog('Preparing project icon assets (256px PNG & multi-res ICO)...');
      const iconAssets = await prepareAppIconAssets(outDir, appData, addLog);

      job.status = 'building';
      job.progress = 50;
      job.statusMessage = `Compiling standalone runtime for ${platform.toUpperCase()}...`;
      addLog('Bundling full EPL + DRPL interpreter, audio synth & uploaded project files...');

      let result: { filePath: string; fileName: string; fileSize: number; mimeType?: string };

      job.status = 'packaging';
      job.progress = 75;
      job.statusMessage = `Packaging ${platform.toUpperCase()} build...`;
      addLog(`Packaging distribution artifact for ${platform.toUpperCase()}...`);

      switch (platform) {
        case 'epl':
          result = await buildDirectEplPackage(outDir, appData, iconAssets, addLog);
          break;
        case 'windows':
          result = await buildWindowsExecutable(outDir, appData, iconAssets, addLog);
          result.mimeType = 'application/vnd.microsoft.portable-executable';
          break;
        case 'macos':
          result = await buildMacOSPackage(outDir, appData, iconAssets, addLog);
          result.mimeType = 'application/zip';
          break;
        case 'linux':
          result = await buildLinuxPackage(outDir, appData, iconAssets, addLog);
          result.mimeType = 'application/zip';
          break;
        case 'android':
          result = await buildAndroidPackage(outDir, appData, iconAssets, addLog);
          result.mimeType = 'application/zip';
          break;
        case 'ios':
          result = await buildIOSPackage(outDir, appData, iconAssets, addLog);
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      job.status = 'validating';
      job.progress = 90;
      job.statusMessage = 'Validating output package integrity...';
      addLog('Validating generated build artifact...');

      if (!fs.existsSync(result.filePath)) {
        throw new Error('Validation failed: output file was not created');
      }

      const fileStats = await fsp.stat(result.filePath);
      if (fileStats.size < 50) {
        throw new Error(`Validation failed: output package is empty (${fileStats.size} bytes)`);
      }

      if (result.fileName.endsWith('.exe')) {
        const peVal = await validatePeExecutable(result.filePath);
        if (!peVal.valid) {
          throw new Error(`Windows Executable validation failed: ${peVal.error}`);
        }
        addLog(`Windows PE Binary Validation passed (${(peVal.size / 1024).toFixed(1)} KB).`);
      } else if (result.fileName.endsWith('.zip')) {
        const zipValidation = await validateZipArchive(result.filePath);
        if (!zipValidation.valid) {
          throw new Error(`ZIP Archive validation failed: ${zipValidation.error}`);
        }
        addLog(`ZIP Validation passed: ${zipValidation.entryCount} valid entries.`);
      }

      job.status = 'completed';
      job.progress = 100;
      job.statusMessage = 'Application build completed! Ready for download.';
      job.filePath = result.filePath;
      job.fileName = result.fileName;
      job.fileSize = result.fileSize;
      job.mimeType = result.mimeType || 'application/octet-stream';
      job.downloadUrl = `/api/build/${buildId}/download`;

      addLog(`Build completed successfully. Ready at ${job.downloadUrl}`);
    } catch (err: any) {
      console.error('Build failed:', err);
      job.status = 'failed';
      job.progress = 100;
      job.statusMessage = 'Build failed';
      job.error = err.message || 'Build compilation failed';
      addLog(`ERROR: ${job.error}`);
    }
  }, 60);

  return job;
}
