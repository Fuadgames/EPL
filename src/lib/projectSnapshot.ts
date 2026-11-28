import { AppData } from '../types';
import { EPLInterpreter, EPLEntity, EPLValue } from './epl-interpreter';

const snapshotCache = new Map<string, string>();

function hashCode(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function interpolateText(
  raw: any,
  variables: Record<string, EPLValue>,
  entities: Record<string, any>
): string {
  if (raw === undefined || raw === null) return '';
  return String(raw).replace(/\{([a-zA-Z0-9_.]+)\}/g, (full, key) => {
    if (key.includes('.')) {
      const [eName, prop] = key.split('.');
      const ent = Object.values(entities).find(
        (e: any) => String(e.name || '').toLowerCase() === eName.toLowerCase()
      ) as any;
      if (ent && ent[prop] !== undefined) return String(ent[prop]);
      return full;
    }
    if (variables && variables[key] !== undefined && variables[key] !== null) {
      return String(variables[key]);
    }
    return full;
  });
}

function seededRandom(seed: number): () => number {
  let s = (seed || 1) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function parseSettingsQuick(str: string): Record<string, any> {
  const obj: Record<string, any> = {};
  if (!str) return obj;
  const pairs: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if ((ch === '"' || ch === "'") && str[i - 1] !== '\\') {
      if (quote === ch) quote = null;
      else if (!quote) quote = ch;
      cur += ch;
    } else if (ch === ',' && !quote) {
      pairs.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) pairs.push(cur);

  for (const p of pairs) {
    const eq = p.indexOf('=');
    if (eq === -1) continue;
    const k = p.slice(0, eq).trim();
    let v: any = p.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    } else if (v === 'true') {
      v = true;
    } else if (v === 'false') {
      v = false;
    } else if (v !== '' && !isNaN(Number(v)) && !v.startsWith('+') && !v.startsWith('-')) {
      v = Number(v);
    }
    obj[k] = v;
  }
  return obj;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawPlayerGraphic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, Math.min(w, h) * 0.25);
  ctx.fillStyle = color || '#10b981';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#090d16';
  ctx.stroke();

  // Visor
  const vw = w * 0.56;
  const vh = h * 0.28;
  drawRoundedRect(ctx, x + (w - vw) / 2, y + h * 0.22, vw, vh, 4);
  ctx.fillStyle = '#0f172a';
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(x + w * 0.4, y + h * 0.36, Math.max(2, w * 0.06), 0, Math.PI * 2);
  ctx.arc(x + w * 0.62, y + h * 0.36, Math.max(2, w * 0.06), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemyGraphic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.1, y + h * 0.85);
  ctx.lineTo(x + w * 0.18, y + h * 0.28);
  ctx.lineTo(x + w * 0.38, y + h * 0.4);
  ctx.lineTo(x + w * 0.5, y + h * 0.12);
  ctx.lineTo(x + w * 0.62, y + h * 0.4);
  ctx.lineTo(x + w * 0.82, y + h * 0.28);
  ctx.lineTo(x + w * 0.9, y + h * 0.85);
  ctx.closePath();
  ctx.fillStyle = color || '#ef4444';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#090d16';
  ctx.stroke();

  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(x + w * 0.36, y + h * 0.56, Math.max(2, w * 0.07), 0, Math.PI * 2);
  ctx.arc(x + w * 0.64, y + h * 0.56, Math.max(2, w * 0.07), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDifrenoptPreview(
  ctx: CanvasRenderingContext2D,
  ent: EPLEntity,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number
) {
  const drplCode = String(ent.code || ent.drpl || '');
  const is3D = /mode\s*=\s*3d|cube|sphere|camera|light/i.test(drplCode);
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = '#0b101b';
  ctx.fill();
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.clip();

  // Perspective grid
  ctx.strokeStyle = is3D ? 'rgba(56, 189, 248, 0.16)' : 'rgba(16, 185, 129, 0.14)';
  ctx.lineWidth = 1;
  for (let gx = 0; gx < w; gx += 28) {
    ctx.beginPath();
    ctx.moveTo(x + gx, y);
    ctx.lineTo(x + gx, y + h);
    ctx.stroke();
  }
  for (let gy = 0; gy < h; gy += 28) {
    ctx.beginPath();
    ctx.moveTo(x, y + gy);
    ctx.lineTo(x + w, y + gy);
    ctx.stroke();
  }

  // Parse DRPL objects
  const rand = seededRandom(seed + 19);
  const objMatches = Array.from(drplCode.matchAll(/(cube|box|sphere|ball|cylinder|plane|sprite|light|camera)\s*\{([^}]*)\}/gi));
  if (objMatches.length > 0) {
    objMatches.slice(0, 12).forEach((m, idx) => {
      const kind = m[1].toLowerCase();
      const props = parseSettingsQuick(m[2]);
      const col = String(props.color || (idx % 2 === 0 ? '#10b981' : '#38bdf8'));
      const ox = x + w * 0.2 + ((Number(props.x ?? idx * 1.3) * 35 + w * 0.3 + seed * 11) % (w * 0.65));
      const oy = y + h * 0.25 + ((Number(props.y ?? idx * 0.9) * 28 + h * 0.25) % (h * 0.55));
      const size = Math.max(18, Math.min(54, Number(props.size || props.scale || 1) * 24));
      if (kind === 'sphere' || kind === 'ball') {
        const grad = ctx.createRadialGradient(ox - size * 0.25, oy - size * 0.25, 2, ox, oy, size * 0.65);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, col);
        grad.addColorStop(1, '#090d16');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ox, oy, size * 0.55, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Isometric 3D cube
        ctx.fillStyle = col;
        drawRoundedRect(ctx, ox - size / 2, oy - size / 2, size, size, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.moveTo(ox - size / 2, oy - size / 2);
        ctx.lineTo(ox - size / 2 + 10, oy - size / 2 - 8);
        ctx.lineTo(ox + size / 2 + 10, oy - size / 2 - 8);
        ctx.lineTo(ox + size / 2, oy - size / 2);
        ctx.closePath();
        ctx.fill();
      }
    });
  } else {
    // Generic DRPL crystal scene based on hash
    const cx = x + w * (0.4 + rand() * 0.2);
    const cy = y + h * (0.45 + rand() * 0.12);
    ctx.fillStyle = '#10b981';
    drawRoundedRect(ctx, cx - 26, cy - 26, 52, 52, 8);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`DRPL ${is3D ? '3D' : '2D'} ENGINE`, x + 12, y + 20);
  ctx.restore();
}

function drawEntitiesToCanvas(
  entities: Record<string, EPLEntity>,
  variables: Record<string, EPLValue>,
  outputLines: string[],
  code: string,
  options: { title?: string; category?: string; seed: number; width: number; height: number }
): string {
  if (typeof document === 'undefined') return '';
  const { width, height, seed } = options;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const entityList = Object.values(entities || {}).filter((e) => e && !e.hidden);
  const world = entityList.find((e) => e.type === 'world' || e.name === 'background');
  const bg = String(world?.background || world?.color || '#0b0f17');

  // Background fill
  ctx.fillStyle = bg.startsWith('#') || bg.startsWith('rgb') ? bg : '#0b0f17';
  ctx.fillRect(0, 0, width, height);

  // Subtle stage grid matching EPL Studio stage
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Filter drawable entities and compute world bounds for smart scaling
  const drawables = entityList.filter(
    (e) => !['world', 'timer', 'sound', 'wasd_controls', '3DCamera'].includes(e.type) && e.name !== 'background'
  );

  if (drawables.length === 0) {
    // Console / script-only EPL project -> render genuine live console & code snapshot
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#161b22';
    ctx.fillRect(18, 18, width - 36, height - 36);
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(18, 18, width - 36, height - 36);

    ctx.fillStyle = '#21262d';
    ctx.fillRect(18, 18, width - 36, 32);

    // Traffic dots + title
    ['#f87171', '#fbbf24', '#34d399'].forEach((dot, i) => {
      ctx.fillStyle = dot;
      ctx.beginPath();
      ctx.arc(36 + i * 16, 34, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#9ca3af';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(options.title ? `${options.title} — EPL Runtime` : 'EPL Runtime Snapshot', 92, 38);

    const previewLines =
      outputLines.length > 0
        ? outputLines.slice(0, 9).map((l) => `> ${l}`)
        : code
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith('#') && !l.startsWith('//'))
            .slice(0, 9);

    ctx.font = '13px monospace';
    previewLines.forEach((line, idx) => {
      ctx.fillStyle = line.startsWith('>') ? '#10b981' : idx === 0 ? '#38bdf8' : '#e5e7eb';
      const clipped = line.length > 62 ? line.slice(0, 59) + '...' : line;
      ctx.fillText(clipped, 34, 78 + idx * 26);
    });

    if (previewLines.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.fillText('// Empty EPL project', 34, 82);
    }
    return canvas.toDataURL('image/jpeg', 0.86);
  }

  let maxRight = 640;
  let maxBottom = 400;
  drawables.forEach((e) => {
    const ex = Number(e.x || 0);
    const ey = Number(e.y || 0);
    const ew = Number(e.width || e.size || (e.radius ? e.radius * 2 : 120));
    const eh = Number(e.height || e.size || (e.radius ? e.radius * 2 : 50));
    if (ex + ew + 24 > maxRight) maxRight = ex + ew + 24;
    if (ey + eh + 24 > maxBottom) maxBottom = ey + eh + 24;
  });

  const scaleX = width / Math.max(640, maxRight);
  const scaleY = height / Math.max(400, maxBottom);
  const scale = Math.min(scaleX, scaleY, 1.05);
  const offsetX = Math.max(0, (width - maxRight * scale) / 2);
  const offsetY = Math.max(0, (height - maxBottom * scale) / 2);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  const rand = seededRandom(seed + 7);
  const sorted = [...drawables].sort((a, b) => Number(a.zIndex || 0) - Number(b.zIndex || 0));

  for (const ent of sorted) {
    const x = Number(ent.x || 0);
    const y = Number(ent.y || 0);
    const w = Number(ent.width || ent.size || (ent.radius ? ent.radius * 2 : 90));
    const h = Number(ent.height || ent.size || (ent.radius ? ent.radius * 2 : 44));
    const color = String(ent.color || '#10b981');

    ctx.save();
    if (ent.opacity !== undefined) {
      ctx.globalAlpha = Math.max(0.1, Math.min(1, Number(ent.opacity)));
    }

    switch (ent.type) {
      case 'gradient': {
        const g = ctx.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, String(ent.from || ent.color || '#10b981'));
        g.addColorStop(1, String(ent.to || ent.color2 || '#3b82f6'));
        drawRoundedRect(ctx, x, y, w, h, Number(ent.corner || 10));
        ctx.fillStyle = g;
        ctx.fill();
        break;
      }
      case 'panel':
      case 'block': {
        drawRoundedRect(ctx, x, y, w, h, Number(ent.corner || 6));
        ctx.fillStyle = color;
        ctx.fill();
        if (ent.borderColor) {
          ctx.strokeStyle = String(ent.borderColor);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        break;
      }
      case 'circle': {
        const r = Number(ent.radius || Math.min(w, h) / 2 || 18);
        ctx.beginPath();
        ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        break;
      }
      case 'line': {
        ctx.strokeStyle = color;
        ctx.lineWidth = Number(ent.thickness || 3);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(Number(ent.x2 ?? x + w), Number(ent.y2 ?? y));
        ctx.stroke();
        break;
      }
      case 'player': {
        drawPlayerGraphic(ctx, x, y, Number(ent.width || 42), Number(ent.height || 42), color);
        break;
      }
      case 'enemy': {
        drawEnemyGraphic(ctx, x, y, Number(ent.width || 38), Number(ent.height || 38), color);
        break;
      }
      case 'sprite':
      case 'png': {
        drawRoundedRect(ctx, x, y, Number(ent.width || 48), Number(ent.height || 48), 8);
        ctx.fillStyle = color === '#10b981' ? '#38bdf8' : color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        break;
      }
      case 'button': {
        const bw = Number(ent.width || 130);
        const bh = Number(ent.height || 36);
        drawRoundedRect(ctx, x, y, bw, bh, Number(ent.corner || 8));
        ctx.fillStyle = color || '#10b981';
        ctx.fill();
        ctx.fillStyle = '#0a0c0e';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const txt = interpolateText(ent.text || ent.label || ent.name || 'Button', variables, entities);
        ctx.fillText(txt.slice(0, 26), x + bw / 2, y + bh / 2);
        break;
      }
      case 'text_label': {
        const size = Math.max(11, Math.min(36, Number(ent.size || 16)));
        ctx.fillStyle = String(ent.color || '#f8fafc');
        ctx.font = `${size >= 20 ? 'bold ' : ''}${size}px sans-serif`;
        ctx.textBaseline = 'top';
        const txt = interpolateText(ent.text || ent.value || ent.name || '', variables, entities);
        ctx.fillText(txt.slice(0, 64), x, y);
        break;
      }
      case 'textbox': {
        const bw = Number(ent.width || 180);
        const bh = Number(ent.height || 34);
        drawRoundedRect(ctx, x, y, bw, bh, 6);
        ctx.fillStyle = '#111827';
        ctx.fill();
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#9ca3af';
        ctx.font = '12px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(ent.placeholder || ent.text || 'Input...').slice(0, 24), x + 10, y + bh / 2);
        break;
      }
      case 'progress': {
        const bw = Number(ent.width || 160);
        const bh = Number(ent.height || 14);
        const val = Math.max(0, Math.min(100, Number(ent.value ?? 65)));
        drawRoundedRect(ctx, x, y, bw, bh, 7);
        ctx.fillStyle = '#1f2937';
        ctx.fill();
        drawRoundedRect(ctx, x, y, (bw * val) / 100, bh, 7);
        ctx.fillStyle = color;
        ctx.fill();
        break;
      }
      case 'slider': {
        const bw = Number(ent.width || 160);
        drawRoundedRect(ctx, x, y + 8, bw, 6, 3);
        ctx.fillStyle = '#374151';
        ctx.fill();
        const pct = Math.max(0, Math.min(1, Number(ent.value ?? 50) / Number(ent.max ?? 100)));
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + bw * pct, y + 11, 8, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'checkbox': {
        drawRoundedRect(ctx, x, y, 20, 20, 5);
        ctx.fillStyle = ent.checked ? color : '#1f2937';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#f3f4f6';
        ctx.font = '13px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(ent.text || ent.label || ''), x + 28, y + 10);
        break;
      }
      case 'particle': {
        const count = Math.min(16, Math.max(6, Number(ent.count || 10)));
        for (let i = 0; i < count; i++) {
          const ang = (i / count) * Math.PI * 2 + rand() * 0.6;
          const dist = 10 + rand() * 34;
          const px = x + Math.cos(ang) * dist;
          const py = y + Math.sin(ang) * dist;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(px, py, 2 + rand() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'difrenopt': {
        drawDifrenoptPreview(
          ctx,
          ent,
          x,
          y,
          Number(ent.width || 560),
          Number(ent.height || 340),
          seed
        );
        break;
      }
      default: {
        drawRoundedRect(ctx, x, y, Math.max(24, w), Math.max(24, h), 6);
        ctx.fillStyle = color;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  ctx.restore();
  return canvas.toDataURL('image/jpeg', 0.86);
}

/**
 * Fast synchronous snapshot of EPL project code at a simulated random frame seed.
 */
export function renderEplSnapshotSync(
  code: string,
  options?: { title?: string; category?: string; seed?: number; width?: number; height?: number }
): string {
  const seed = options?.seed ?? 3;
  const width = options?.width ?? 640;
  const height = options?.height ?? 360;
  const key = `sync_${hashCode(code || '')}_${seed}_${width}x${height}`;
  const cached = snapshotCache.get(key);
  if (cached) return cached;

  const entities: Record<string, EPLEntity> = {};
  const variables: Record<string, EPLValue> = {};
  const outputLines: string[] = [];
  const rand = seededRandom(seed);

  const lines = String(code || '').split('\n');
  let insideDrpl = false;
  let drplBuffer: string[] = [];
  let drplSettings: Record<string, any> = {};
  let drplCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

    if (insideDrpl) {
      if (trimmed === 'end') {
        insideDrpl = false;
        const id = `drpl_${++drplCount}`;
        entities[id] = {
          id,
          type: 'difrenopt',
          name: drplSettings.name || id,
          x: Number(drplSettings.x ?? 24),
          y: Number(drplSettings.y ?? 24),
          width: Number(drplSettings.width ?? 590),
          height: Number(drplSettings.height ?? 310),
          code: drplBuffer.join('\n'),
        };
        drplBuffer = [];
      } else {
        drplBuffer.push(trimmed);
      }
      continue;
    }

    if (/^difrenopt\b/i.test(trimmed)) {
      const m = trimmed.match(/\{([^}]*)\}/);
      drplSettings = parseSettingsQuick(m ? m[1] : '');
      insideDrpl = true;
      drplBuffer = [];
      continue;
    }

    const varMatch = trimmed.match(/^variable\s*\{([^}]*)\}/i);
    if (varMatch) {
      const s = parseSettingsQuick(varMatch[1]);
      if (s.name !== undefined) {
        variables[String(s.name)] = s.value ?? 0;
      }
      continue;
    }

    const printMatch = trimmed.match(/^(?:print|log|say)\s*\{([^}]*)\}/i);
    if (printMatch) {
      const s = parseSettingsQuick(printMatch[1]);
      outputLines.push(String(s.text ?? s.message ?? s.value ?? ''));
      continue;
    }

    const createMatch = trimmed.match(/^create\s+([a-zA-Z0-9_]+)\s*\{([^}]*)\}/i);
    if (createMatch) {
      const type = createMatch[1];
      const s = parseSettingsQuick(createMatch[2]);
      const name = String(s.name || `${type}_${Object.keys(entities).length + 1}`);
      entities[name] = {
        id: name,
        type,
        name,
        ...s,
      };
    }
  }

  // Advance dynamic movement slightly based on seed so every snapshot looks like a live random frame
  const ticks = 1 + (seed % 10);
  Object.values(entities).forEach((ent) => {
    if (ent.type === 'player' || ent.type === 'enemy' || ent.type === 'sprite' || ent.type === 'circle') {
      const dx = (rand() - 0.35) * ticks * 9;
      const dy = (rand() - 0.5) * ticks * 6;
      if (ent.x !== undefined) ent.x = Math.max(12, Math.min(580, Number(ent.x) + dx));
      if (ent.y !== undefined) ent.y = Math.max(24, Math.min(340, Number(ent.y) + dy));
    }
  });

  const url = drawEntitiesToCanvas(entities, variables, outputLines, code, {
    title: options?.title,
    category: options?.category,
    seed,
    width,
    height,
  });
  if (url) snapshotCache.set(key, url);
  return url;
}

/**
 * Executes the real EPLInterpreter headlessly (muted, leak-free) for N random ticks
 * and captures an authentic frame of the running project.
 */
export async function captureEplProjectSnapshotAsync(
  code: string,
  options?: { title?: string; category?: string; seed?: number; width?: number; height?: number }
): Promise<string> {
  const seed = options?.seed ?? Math.floor(1 + Math.random() * 14);
  const width = options?.width ?? 640;
  const height = options?.height ?? 360;
  const key = `async_${hashCode(code || '')}_${seed}_${width}x${height}`;
  const cached = snapshotCache.get(key);
  if (cached) return cached;

  if (!code || !code.trim()) {
    return renderEplSnapshotSync(code || '', { ...options, seed, width, height });
  }

  let latestEntities: Record<string, EPLEntity> = {};
  let latestVars: Record<string, EPLValue> = {};
  const outputLines: string[] = [];

  const interpreter = new EPLInterpreter(
    (msg) => {
      if (outputLines.length < 16) outputLines.push(msg);
    },
    (entities, _uiMode, meta) => {
      latestEntities = { ...entities };
      if (meta?.variables) latestVars = { ...meta.variables };
    },
    { answerMode: 'console', changesEnabled: false },
    [],
    false,
    []
  );
  interpreter.setMuted(true);

  try {
    await Promise.race([
      interpreter.run(code),
      new Promise<void>((resolve) => setTimeout(resolve, 120)),
    ]);

    // Simulate a random number of timer ticks so moving blocks/drones/HUD update naturally
    const timerEntities = Object.values(interpreter.context.entities).filter((e) => e.type === 'timer');
    const tickCount = 2 + (seed % 11);
    for (let t = 0; t < tickCount; t++) {
      for (const timer of timerEntities) {
        await Promise.race([
          interpreter.triggerEvent('timer_tick?', timer.name),
          new Promise<void>((resolve) => setTimeout(resolve, 25)),
        ]);
      }
      if (timerEntities.length === 0 && interpreter.context.events['timer_tick?']) {
        await Promise.race([
          interpreter.triggerEvent('timer_tick?'),
          new Promise<void>((resolve) => setTimeout(resolve, 25)),
        ]);
      }
    }

    latestEntities = { ...interpreter.context.entities };
    latestVars = { ...interpreter.context.variables };
  } catch {
    // Fallback cleanly to static sync renderer
  } finally {
    interpreter.stop();
  }

  const finalEntities =
    Object.keys(latestEntities).length > 0 ? latestEntities : {};
  const url =
    Object.keys(finalEntities).length > 0 || outputLines.length > 0
      ? drawEntitiesToCanvas(finalEntities, latestVars, outputLines, code, {
          title: options?.title,
          category: options?.category,
          seed,
          width,
          height,
        })
      : renderEplSnapshotSync(code, { ...options, seed, width, height });

  if (url) snapshotCache.set(key, url);
  return url;
}

export function pickRandomFrameSeed(idSeed?: string): number {
  if (!idSeed) return Math.floor(1 + Math.random() * 18);
  let sum = 0;
  for (let i = 0; i < idSeed.length; i++) sum += idSeed.charCodeAt(i);
  return 1 + ((sum + Math.floor(Date.now() / 10000)) % 18);
}
