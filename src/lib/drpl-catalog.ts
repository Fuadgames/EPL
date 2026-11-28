import { DRPL_EXTENDED_COMPONENTS, type DrplRuntimeMeta } from './drpl-extended-catalog.ts';

export type DrplCategory = '3d' | '2d' | 'app';

export interface DrplComponentDef {
  id: string;
  name: string;
  category: DrplCategory;
  subgroup?: string;
  color: string;
  signature: string;
  descriptionRu: string;
  descriptionEn: string;
  roleRu: string;
  roleEn: string;
  compatibleWith: string[];
  incompatibleWith: string[];
  snippet: string;
  badge?: string;
  runtimeMeta?: DrplRuntimeMeta;
}

export interface DrplTemplateDef {
  id: string;
  nameRu: string;
  nameEn: string;
  category: DrplCategory;
  descriptionRu: string;
  descriptionEn: string;
  headerParams: Record<string, string>;
  drplCode: string;
}

export interface ParsedDifrenoptBlock {
  startLine: number;
  endLine: number;
  headerLine: string;
  params: Record<string, string>;
  drplCode: string;
}

/**
 * Counts balanced EPL-style `end` openers inside DRPL code lines so inner
 * `frame? ... end`, `if ... then ... end`, `def ... : ... end`, etc. never
 * close the outer `difrenopt ... end` container prematurely.
 * Note: C/JS/C#/Java blocks opened with `{` do NOT increment `end` depth.
 */
function isDrplEndBlockOpener(trimmed: string): boolean {
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) return false;
  if (/^(started\?|frame\?|update\?|render\?|clicked\?|key_pressed\?|timer_tick\?|collided\?)\b/i.test(trimmed)) {
    return !trimmed.includes('{') || /\{\s*[a-zA-Z0-9_]+\s*=/.test(trimmed);
  }
  // If line ends with '{', it uses brace closing rather than `end`
  if (trimmed.endsWith('{')) return false;
  if (/^if\b.*\bthen$/i.test(trimmed)) return true;
  if (/^(repeat|forever|object)\b/i.test(trimmed) && !trimmed.includes('{')) return true;
  return false;
}

export function extractDifrenoptBlock(
  lines: string[],
  startIdx: number
): { drplLines: string[]; nextIndex: number } {
  const drplLines: string[] = [];
  let depth = 0;
  let i = startIdx;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('#')) {
      if (isDrplEndBlockOpener(trimmed)) {
        depth++;
      } else if (trimmed === 'end' || /^end\s*(?:#|\/\/|$)/i.test(trimmed)) {
        if (depth === 0) {
          return { drplLines, nextIndex: i + 1 };
        }
        depth--;
      }
    }
    drplLines.push(lines[i]);
    i++;
  }

  return { drplLines, nextIndex: i };
}

export function parseDifrenoptSettings(settingsStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!settingsStr) return result;
  const pairs: string[] = [];
  let current = '';
  let quoteChar: '"' | "'" | null = null;
  for (let i = 0; i < settingsStr.length; i++) {
    const ch = settingsStr[i];
    if ((ch === '"' || ch === "'") && settingsStr[i - 1] !== '\\') {
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

  for (const p of pairs) {
    const eqIdx = p.indexOf('=');
    if (eqIdx === -1) continue;
    const k = p.slice(0, eqIdx).trim();
    let v = p.slice(idxOrEnd(eqIdx, p.length), undefined);
    void v;
    let val = p.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (k) result[k] = val;
  }
  return result;
}

function idxOrEnd(idx: number, len: number): number {
  return idx >= 0 ? idx + 1 : len;
}

export function isDifrenoptStartLine(trimmedLine: string): boolean {
  return /^(?:create\s+)?difrenopt(?:\s*\{[^}]*\})?\s*$/i.test(trimmedLine);
}

export function findFirstDifrenoptInCode(code: string): ParsedDifrenoptBlock | null {
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (isDifrenoptStartLine(trimmed)) {
      const settingsMatch = trimmed.match(/difrenopt\s*\{([^}]*)\}/i);
      const params = parseDifrenoptSettings(settingsMatch ? settingsMatch[1] : '');
      const { drplLines, nextIndex } = extractDifrenoptBlock(lines, i + 1);
      // Dedent by 2 spaces if uniformly indented
      const cleaned = drplLines.map(l => (l.startsWith('  ') ? l.slice(2) : l)).join('\n').trim();
      return {
        startLine: i,
        endLine: nextIndex - 1,
        headerLine: lines[i],
        params,
        drplCode: cleaned
      };
    }
  }
  return null;
}

export function serializeDifrenoptBlock(
  params: Record<string, string>,
  drplCode: string,
  indent = ''
): string {
  const mergedParams: Record<string, string> = {
    name: params.name || 'engine',
    mode: params.mode || '3d',
    quality: params.quality || 'ultra',
    fps: params.fps || '60',
    shadows: params.shadows ?? 'true',
    bloom: params.bloom ?? 'true',
    instancing: params.instancing ?? 'true',
    culling: params.culling ?? 'true',
    ...params
  };
  const paramStr = Object.entries(mergedParams)
    .filter(([_, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');

  const bodyLines = (drplCode || '')
    .split('\n')
    .map(l => (l.trim().length > 0 ? `${indent}  ${l}` : ''));

  return `${indent}difrenopt {${paramStr}}\n${bodyLines.join('\n')}\n${indent}end`;
}

export function upsertDifrenoptInCode(
  code: string,
  params: Record<string, string>,
  drplCode: string,
  targetStartLine?: number
): string {
  const lines = code.split('\n');
  const serialized = serializeDifrenoptBlock(params, drplCode);

  if (targetStartLine !== undefined && targetStartLine >= 0 && targetStartLine < lines.length) {
    if (isDifrenoptStartLine(lines[targetStartLine].trim())) {
      const { nextIndex } = extractDifrenoptBlock(lines, targetStartLine + 1);
      const before = lines.slice(0, targetStartLine);
      const after = lines.slice(nextIndex);
      return [...before, serialized, ...after].join('\n').replace(/\n{3,}/g, '\n\n');
    }
  }

  const existing = findFirstDifrenoptInCode(code);
  if (existing) {
    const before = lines.slice(0, existing.startLine);
    const after = lines.slice(existing.endLine + 1);
    return [...before, serialized, ...after].join('\n').replace(/\n{3,}/g, '\n\n');
  }

  const trimmed = code.trim();
  return trimmed ? `${trimmed}\n\n${serialized}\n` : `${serialized}\n`;
}

const COMP_3D_COMPAT = ['все *3d объекты', 'ui_* (HUD интерфейс)', 'sfx2d (звук)'];
const COMP_3D_INCOMPAT = ['use2d', 'player2d / enemy2d / tilemap2d / parallax2d (без mode="hybrid")'];
const COMP_3D_COMPAT_EN = ['all *3d entities', 'ui_* (HUD widgets)', 'sfx2d (audio)'];
const COMP_3D_INCOMPAT_EN = ['use2d', '2D physics/world nodes unless hybrid'];

const COMP_2D_COMPAT = ['все *2d объекты', 'ui_* (HUD интерфейс)', 'sfx2d (звук)'];
const COMP_2D_INCOMPAT = ['use3d', 'car3d / mecha3d / terrain3d / sky3d (3D мир)'];
const COMP_2D_COMPAT_EN = ['all *2d entities', 'ui_* (HUD widgets)', 'sfx2d (audio)'];
const COMP_2D_INCOMPAT_EN = ['use3d', '*3d WebGL nodes'];

const COMP_APP_COMPAT = ['useapp', 'use3d / use2d (как HUD оверлей)', 'sfx2d (звук)', 'все ui_* виджеты'];
const COMP_APP_INCOMPAT = ['нет прямых конфликтов (работает и отдельно, и поверх 3D/2D)'];
const COMP_APP_COMPAT_EN = ['useapp', 'use3d / use2d (HUD overlay)', 'sfx2d (audio)', 'all ui_* widgets'];
const COMP_APP_INCOMPAT_EN = ['None (universal HUD layer)'];

export const DRPL_CORE_COMPONENTS: DrplComponentDef[] = [
  // ======================== 3D GAMES ========================
  {
    id: 'use3d',
    name: 'use3d',
    category: '3d',
    color: '#10B981',
    badge: 'Core',
    signature: 'use3d(lighting="studio", bloom=1.2, shadows=true, fog=true)',
    descriptionRu: 'Инициализирует PBR 3D-рендер с RoomEnvironment IBL, тенями и пост-процессингом UnrealBloom.',
    descriptionEn: 'Initializes PBR 3D pipeline with RoomEnvironment IBL, shadows and UnrealBloom post-processing.',
    roleRu: 'Главное ядро 3D-сцены: включает WebGL2 PBR-свет, тени, туман и постобработку.',
    roleEn: 'Primary 3D core: initializes WebGL2 PBR lighting, shadows, fog and bloom.',
    compatibleWith: ['sky3d', 'terrain3d', 'car3d', 'mecha3d', 'boss3d', 'camera3d', 'ui_*', 'sfx2d'],
    incompatibleWith: ['use2d', 'parallax2d', 'tilemap2d', 'player2d'],
    snippet: 'use3d(lighting="studio", bloom=1.15, shadows=true, fog=true)'
  },
  {
    id: 'sky3d',
    name: 'sky3d',
    category: '3d',
    color: '#06B6D4',
    badge: 'Shader',
    signature: 'sky3d(style="cyber_aurora", stars=900, speed=1.0)',
    descriptionRu: 'Процедурный шейдерный купол неба (cyber_aurora, deep_space, sunset, grid_horizon) со звёздами.',
    descriptionEn: 'Procedural shader sky dome (cyber_aurora, deep_space, sunset, grid_horizon) with starfield.',
    roleRu: 'Создаёт атмосферный купол неба и вращающееся звёздное поле.',
    roleEn: 'Renders procedural sky dome and rotating 3D starfield.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'sky3d(style="cyber_aurora", stars=900, speed=1.0)'
  },
  {
    id: 'light3d',
    name: 'light3d',
    category: '3d',
    color: '#FBBF24',
    badge: 'Light',
    signature: 'light3d(name="key", type="point", x=6, y=8, z=4, color="#10b981", intensity=3.2)',
    descriptionRu: 'Динамический 3D-источник света (directional, point, spot) с управлением позицией и цветом.',
    descriptionEn: 'Dynamic 3D light source (directional, point, spot) with live position and color updates.',
    roleRu: 'Добавляет точечный или прожекторный свет в 3D-мир.',
    roleEn: 'Adds dynamic point or spot illumination to the 3D scene.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'light3d(name="neonLight", type="point", x=4, y=6, z=4, color="#38bdf8", intensity=3.5)'
  },
  {
    id: 'terrain3d',
    name: 'terrain3d',
    category: '3d',
    color: '#22C55E',
    badge: 'Mesh',
    signature: 'terrain3d(name="ground", size=140, height=5.5, style="neon_grid", color="#0f172a")',
    descriptionRu: 'Процедурный 3D-ландшафт с высотной картой, горами, долинами и неоновой/реалистичной сеткой.',
    descriptionEn: 'Procedural 3D terrain mesh with heightmap hills, valleys and neon or realistic wireframe.',
    roleRu: 'Генерирует 3D-землю, холмы и ровную арену в центре карты.',
    roleEn: 'Generates procedural heightmap ground plane with wireframe grid.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'terrain3d(name="ground", size=140, height=4.2, style="cyber", color="#0f172a", wireColor="#10b981")'
  },
  {
    id: 'water3d',
    name: 'water3d',
    category: '3d',
    color: '#0EA5E9',
    badge: 'Shader',
    signature: 'water3d(name="ocean", size=140, y=-1.2, color="#0ea5e9", wave=0.45)',
    descriptionRu: 'Анимированная отражающая 3D-вода с вершинными волнами в реальном времени.',
    descriptionEn: 'Animated reflective 3D water surface with real-time vertex waves.',
    roleRu: 'Отвечает за анимированную поверхность океана с реальными волнами.',
    roleEn: 'Simulates animated reflective 3D water surface with live vertex waves.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'water3d(name="ocean", size=140, y=-0.9, color="#0284c7", wave=0.35)'
  },
  {
    id: 'car3d',
    name: 'car3d',
    category: '3d',
    color: '#34D399',
    badge: 'Hero',
    signature: 'car3d(name="racer", x=0, y=0.6, z=0, color="#10b981", neon=true, speed=18)',
    descriptionRu: 'Составной спорткар (кузов, кабина, спойлер, вращающиеся колёса, фары, неон) с WASD-управлением.',
    descriptionEn: 'Composite 3D sports car (chassis, cabin, spoiler, spinning wheels, headlights, neon) with WASD.',
    roleRu: 'Управляемый 3D-спорткар с физикой ускорения, поворотом и колёсами.',
    roleEn: 'Controllable WASD 3D sports car with acceleration, steering and spinning wheels.',
    compatibleWith: ['use3d', 'camera3d(mode="chase")', 'terrain3d', 'pickup3d', 'ui_gauge'],
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'car3d(name="racer", x=0, y=0.5, z=0, color="#10b981", neon=true)'
  },
  {
    id: 'mecha3d',
    name: 'mecha3d',
    category: '3d',
    color: '#38BDF8',
    badge: 'Hero',
    signature: 'mecha3d(name="titan", x=0, y=1.5, z=0, color="#38bdf8", glow="#10b981", scale=1.1)',
    descriptionRu: 'Боевой 3D-робот/мех с реактором, сочленёнными руками/ногами, визором и джетпаком.',
    descriptionEn: 'Articulated 3D combat mech with reactor core, arms/legs, visor and thruster glow.',
    roleRu: 'Боевой 3D-персонаж/мех с анимацией ходьбы и WASD-движением.',
    roleEn: 'Articulated 3D combat hero/mech with procedural walk animation and WASD movement.',
    compatibleWith: ['use3d', 'boss3d', 'turret3d', 'camera3d', 'ui_progress', 'ui_button'],
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'mecha3d(name="hero", x=0, y=1.4, z=6, color="#38bdf8", glow="#10b981", scale=1.0)'
  },
  {
    id: 'boss3d',
    name: 'boss3d',
    category: '3d',
    color: '#F43F5E',
    badge: 'Boss',
    signature: 'boss3d(name="overlord", x=0, y=6, z=-14, color="#ef4444", scale=1.6)',
    descriptionRu: 'Огромный летающий 3D-босс с вращающимися энергетическими кольцами, крыльями и ядром.',
    descriptionEn: 'Colossal floating 3D boss rig with orbiting energy rings, wings and pulsing core.',
    roleRu: 'Большой 3D-босс с гироскопическими кольцами и светящимся ядром.',
    roleEn: 'Floating 3D colossus boss with orbiting gyro rings and pulsing core.',
    compatibleWith: ['use3d', 'mecha3d', 'city3d', 'turret3d', 'ui_progress'],
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'boss3d(name="overlord", x=0, y=5.5, z=-14, color="#f43f5e", scale=1.5)'
  },
  {
    id: 'trees3d',
    name: 'trees3d',
    category: '3d',
    color: '#4ADE80',
    badge: 'GPU Instanced',
    signature: 'trees3d(count=220, radius=65, style="cyber_pine", color="#10b981")',
    descriptionRu: 'GPU InstancedMesh лес (сотни деревьев за 2 draw calls!) с авто-отсечением дальности.',
    descriptionEn: 'GPU InstancedMesh forest (hundreds of trees in 2 draw calls) with distance culling.',
    roleRu: 'Массовый GPU-лес (InstancedMesh) для высокой производительности даже при 300+ деревьях.',
    roleEn: 'GPU-instanced 3D forest rendering hundreds of trees in 2 draw calls.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'trees3d(count=180, radius=60, style="neon_pine", color="#10b981")'
  },
  {
    id: 'city3d',
    name: 'city3d',
    category: '3d',
    color: '#6366F1',
    badge: 'GPU Instanced',
    signature: 'city3d(count=140, spread=85, maxHeight=26, color="#1e293b", neon="#38bdf8")',
    descriptionRu: 'GPU InstancedMesh футуристический мегаполис небоскрёбов со светящимися окнами и крышами.',
    descriptionEn: 'GPU InstancedMesh cyberpunk skyscraper skyline rendered in minimal draw calls.',
    roleRu: 'Оптимизированный 3D-мегаполис небоскрёбов с неоновыми крышами.',
    roleEn: 'GPU-instanced cyberpunk city skyline with neon rooftops.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'city3d(count=120, spread=80, maxHeight=24, color="#1e293b", neon="#38bdf8")'
  },
  {
    id: 'asteroids3d',
    name: 'asteroids3d',
    category: '3d',
    color: '#94A3B8',
    badge: 'GPU Instanced',
    signature: 'asteroids3d(count=260, radius=75, y=14, speed=0.4, color="#94a3b8")',
    descriptionRu: 'GPU InstancedMesh пояс астероидов/кристаллов на орбите сцены.',
    descriptionEn: 'GPU InstancedMesh orbiting asteroid or crystal belt above the scene.',
    roleRu: 'Орбитальный пояс из сотен астероидов в небе на GPU-инстансинге.',
    roleEn: 'Orbiting GPU-instanced asteroid/crystal belt.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'asteroids3d(count=240, radius=65, y=14, speed=0.45, color="#64748b")'
  },
  {
    id: 'portal3d',
    name: 'portal3d',
    category: '3d',
    color: '#A855F7',
    badge: 'VFX',
    signature: 'portal3d(name="gate", x=0, y=3.2, z=-18, radius=2.6, color="#a855f7")',
    descriptionRu: 'Энергетический 3D-портал с вращающимся вихревым кольцом и светящейся мембраной.',
    descriptionEn: 'Sci-fi 3D energy portal with rotating rings and glowing vortex core.',
    roleRu: 'Светящийся 3D-портал / финишная арка для гонок и квестов.',
    roleEn: 'Glowing animated 3D portal gate for quests and checkpoints.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'portal3d(name="gate", x=0, y=3.2, z=-16, radius=2.6, color="#a855f7")'
  },
  {
    id: 'box3d',
    name: 'box3d',
    category: '3d',
    color: '#F59E0B',
    badge: 'Mesh',
    signature: 'box3d(name="crate", x=0, y=1, z=0, w=2, h=2, d=2, color="#f59e0b", metallic=0.6)',
    descriptionRu: 'PBR-куб / платформа / препятствие с настраиваемыми размерами, металличностью и свечением.',
    descriptionEn: 'PBR 3D box/platform with configurable dimensions, metalness and emissive glow.',
    roleRu: 'Строительный 3D-блок, стена, трамплин или ящик с PBR-материалом.',
    roleEn: 'Configurable PBR 3D box, wall, or platform mesh.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'box3d(name="pad1", x=0, y=0.5, z=-6, w=4, h=0.8, d=4, color="#10b981", emissive=true)'
  },
  {
    id: 'sphere3d',
    name: 'sphere3d',
    category: '3d',
    color: '#60A5FA',
    badge: 'Mesh',
    signature: 'sphere3d(name="orb", x=3, y=2, z=0, radius=1.1, color="#38bdf8", emissive=true)',
    descriptionRu: 'PBR-сфера / планета / энергетическое ядро с отражением окружения.',
    descriptionEn: 'PBR sphere / planet / energy core with environment reflections.',
    roleRu: 'Гладкая 3D-сфера, планета или энергетический шар.',
    roleEn: 'Reflective PBR 3D sphere, planet, or energy orb.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'sphere3d(name="core", x=0, y=2.5, z=0, radius=1.0, color="#38bdf8", emissive=true)'
  },
  {
    id: 'pickup3d',
    name: 'pickup3d',
    category: '3d',
    color: '#FACC15',
    badge: 'Gameplay',
    signature: 'pickup3d(name="gem1", x=5, y=1.4, z=-5, color="#facc15", spin=2.5)',
    descriptionRu: 'Парящий вращающийся 3D-кристалл/монета для подбора игроком.',
    descriptionEn: 'Floating spinning 3D gem/crystal collectible.',
    roleRu: 'Собираемый кристалл, который автоматически подбирается машиной или мехом.',
    roleEn: 'Auto-collectible floating 3D gem triggered on hero/car proximity.',
    compatibleWith: ['use3d', 'car3d', 'mecha3d', 'sfx2d', 'ui_card'],
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'pickup3d(name="gem1", x=4, y=1.5, z=-4, color="#facc15", spin=2.5)'
  },
  {
    id: 'turret3d',
    name: 'turret3d',
    category: '3d',
    color: '#FB923C',
    badge: 'Gameplay',
    signature: 'turret3d(name="sentry1", x=-8, y=1, z=-8, color="#f97316", target="hero")',
    descriptionRu: '3D-турель с вращающейся башней, автоматически наводящаяся на цель.',
    descriptionEn: 'Automated 3D defense turret that rotates and tracks a target entity.',
    roleRu: 'Автоматическая защитная башня, поворачивающая ствол на указанную цель.',
    roleEn: 'Auto-aiming 3D defense turret tracking target entities.',
    compatibleWith: ['use3d', 'mecha3d', 'car3d', 'boss3d'],
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'turret3d(name="sentry1", x=-8, y=0.8, z=-8, color="#f97316", target="hero")'
  },
  {
    id: 'particles3d',
    name: 'particles3d',
    category: '3d',
    color: '#2DD4BF',
    badge: 'GPU VFX',
    signature: 'particles3d(name="sparks", count=600, radius=24, color="#10b981", style="float")',
    descriptionRu: 'GPU-система частиц на THREE.Points (огонь, искры, снег, звёздная пыль).',
    descriptionEn: 'GPU THREE.Points particle system (fireflies, sparks, snow, warp dust).',
    roleRu: 'Светящиеся 3D-частицы (светлячки, искры, атмосфера) на GPU.',
    roleEn: 'GPU-accelerated 3D atmosphere particles via THREE.Points.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'particles3d(name="aura", count=700, radius=28, color="#10b981", style="float")'
  },
  {
    id: 'camera3d',
    name: 'camera3d',
    category: '3d',
    color: '#818CF8',
    badge: 'Camera',
    signature: 'camera3d(mode="chase", target="racer", distance=11, height=4.5, fov=60)',
    descriptionRu: 'Умная 3D-камера (orbit, chase, fps, cinematic) с плавным демпфированием и тряской.',
    descriptionEn: 'Smart 3D camera controller (orbit, chase, fps, cinematic) with smooth damping.',
    roleRu: 'Контроллер камеры: режим слежения за героем/авто или свободная орбита.',
    roleEn: 'Configures 3D camera tracking mode, FOV, distance and smoothing.',
    compatibleWith: ['use3d', 'car3d', 'mecha3d'],
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'camera3d(mode="chase", target="racer", distance=11, height=4.5, fov=60)'
  },

  // ======================== 2D GAMES (15) ========================
  {
    id: 'use2d',
    name: 'use2d',
    category: '2d',
    color: '#14B8A6',
    badge: 'Core',
    signature: 'use2d(bg="#060913", gravity=980, lighting=true, pixelArt=false)',
    descriptionRu: 'Запускает 2D HiDPI-движок с физикой гравитации, освещением и многослойным рендерингом.',
    descriptionEn: 'Initializes HiDPI 2D engine with gravity physics, additive lighting and layered rendering.',
    roleRu: 'Главное ядро 2D-движка: задаёт фон, гравитацию и аддитивное освещение.',
    roleEn: 'Primary 2D core: initializes HiDPI Canvas2D physics, gravity and dynamic lights.',
    compatibleWith: ['parallax2d', 'tilemap2d', 'player2d', 'enemy2d', 'platform2d', 'coin2d', 'camera2d', 'ui_*', 'sfx2d'],
    incompatibleWith: ['use3d', 'car3d', 'mecha3d', 'terrain3d'],
    snippet: 'use2d(bg="#060913", gravity=980, lighting=true)'
  },
  {
    id: 'parallax2d',
    name: 'parallax2d',
    category: '2d',
    color: '#3B82F6',
    badge: 'World',
    signature: 'parallax2d(theme="cyber_city", layers=4, speed=1.0)',
    descriptionRu: 'Многослойный параллакс-фон (cyber_city, space_nebula, sunset_peaks, synth_grid).',
    descriptionEn: 'Multi-layer parallax backdrop (cyber_city, space_nebula, sunset_peaks, synth_grid).',
    roleRu: 'Создаёт глубокий многослойный фон, движущийся с разной скоростью за камерой.',
    roleEn: 'Draws multi-depth scrolling parallax city/skyline background.',
    compatibleWith: COMP_2D_COMPAT,
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'parallax2d(theme="cyber_city", layers=4, speed=1.0)'
  },
  {
    id: 'tilemap2d',
    name: 'tilemap2d',
    category: '2d',
    color: '#10B981',
    badge: 'World',
    signature: 'tilemap2d(floorY=440, tileSize=40, color="#1e293b", accent="#10b981")',
    descriptionRu: 'Процедурный тайловый пол и сетка уровня с автоматической 2D-коллизией.',
    descriptionEn: 'Procedural 2D tile floor and level grid with automatic solid collision.',
    roleRu: 'Задаёт землю/пол уровня и линию столкновения для 2D-объектов.',
    roleEn: 'Renders level floor surface and ground collision plane.',
    compatibleWith: COMP_2D_COMPAT,
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'tilemap2d(floorY=430, tileSize=40, color="#1e293b", accent="#10b981")'
  },
  {
    id: 'player2d',
    name: 'player2d',
    category: '2d',
    color: '#22D3EE',
    badge: 'Hero',
    signature: 'player2d(name="hero", x=120, y=300, speed=280, jump=460, color="#10b981", hp=100)',
    descriptionRu: '2D-игрок со встроенной физикой прыжков, рывка, WASD/Стрелками и полоской HP.',
    descriptionEn: '2D hero rig with built-in gravity, jump, WASD/Arrows, trail effect and HP bar.',
    roleRu: 'Управляемый 2D-персонаж игрока с прыжком, гравитацией и здоровьем.',
    roleEn: 'Controllable 2D hero with jump physics, WASD/Arrows and health bar.',
    compatibleWith: ['use2d', 'platform2d', 'camera2d', 'light2d', 'bullet2d', 'coin2d'],
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'player2d(name="hero", x=140, y=280, speed=280, jump=460, color="#10b981", hp=100)'
  },
  {
    id: 'enemy2d',
    name: 'enemy2d',
    category: '2d',
    color: '#EF4444',
    badge: 'AI',
    signature: 'enemy2d(name="bot1", x=520, y=340, ai="patrol", speed=110, color="#f43f5e", hp=50)',
    descriptionRu: '2D-враг с ИИ-поведением (patrol, chase, hover) и индикатором здоровья.',
    descriptionEn: '2D AI enemy supporting patrol, chase and hover behaviors with health indicator.',
    roleRu: 'Автономный 2D-враг/дрон с патрулированием или парением и получением урона.',
    roleEn: 'AI-driven 2D enemy supporting patrol and hover patterns with HP tracking.',
    compatibleWith: ['use2d', 'bullet2d', 'laser2d', 'player2d', 'particles2d'],
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'enemy2d(name="drone1", x=520, y=340, ai="patrol", speed=110, color="#f43f5e", hp=60)'
  },
  {
    id: 'platform2d',
    name: 'platform2d',
    category: '2d',
    color: '#6366F1',
    badge: 'Level',
    signature: 'platform2d(name="p1", x=240, y=330, w=160, h=20, color="#334155", glow="#38bdf8")',
    descriptionRu: 'Твёрдая 2D-платформа (статичная, движущаяся или пружинящая bounce).',
    descriptionEn: 'Solid 2D platform (static, moving or bouncy) with neon trim.',
    roleRu: 'Твёрдая 2D-платформа, на которую может запрыгивать игрок.',
    roleEn: 'Solid horizontal 2D platform with collision support.',
    compatibleWith: ['use2d', 'player2d', 'coin2d'],
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'platform2d(name="plat1", x=240, y=330, w=160, h=20, color="#1e293b", glow="#38bdf8")'
  },
  {
    id: 'bullet2d',
    name: 'bullet2d',
    category: '2d',
    color: '#F59E0B',
    badge: 'Action',
    signature: 'bullet2d(x=160, y=300, vx=520, vy=0, color="#facc15", radius=5, owner="hero")',
    descriptionRu: 'Быстрый пулированный снаряд/лазер с авто-столкновением с врагами.',
    descriptionEn: 'Pooled 2D projectile with automatic enemy collision detection.',
    roleRu: 'Выпускает летящий 2D-снаряд, который автоматически попадает во врагов.',
    roleEn: 'Spawns velocity-driven 2D projectile that damages enemies on impact.',
    compatibleWith: ['use2d', 'player2d', 'enemy2d', 'particles2d', 'sfx2d'],
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'bullet2d(x=hero.x + 24, y=hero.y + 12, vx=560, vy=0, color="#38bdf8", radius=5)'
  },
  {
    id: 'coin2d',
    name: 'coin2d',
    category: '2d',
    color: '#EAB308',
    badge: 'Collect',
    signature: 'coin2d(name="c1", x=300, y=280, value=10, color="#facc15")',
    descriptionRu: 'Анимированная 2D-монета/кристалл с подбором, частицами и звуком.',
    descriptionEn: 'Animated 2D collectible coin with pickup burst and sound hook.',
    roleRu: 'Парящая монета, которая собирается игроком со взрывом частиц.',
    roleEn: 'Animated 2D collectible triggering particles, sound and floating score.',
    compatibleWith: ['use2d', 'player2d', 'particles2d', 'floater2d'],
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'coin2d(name="c1", x=300, y=285, value=10, color="#facc15")'
  },
  {
    id: 'laser2d',
    name: 'laser2d',
    category: '2d',
    color: '#EC4899',
    badge: 'Action',
    signature: 'laser2d(x1=120, y1=280, x2=640, y2=280, color="#f43f5e", width=4, life=0.25)',
    descriptionRu: 'Светящийся мгновенный 2D-луч с затуханием.',
    descriptionEn: 'Glowing additive 2D laser beam with fade-out lifetime.',
    roleRu: 'Рисует неоновый мгновенный лазерный луч между двумя точками.',
    roleEn: 'Renders additive glowing laser beam with fade-out animation.',
    compatibleWith: COMP_2D_COMPAT,
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'laser2d(x1=120, y1=260, x2=680, y2=260, color="#f43f5e", width=4, life=0.3)'
  },
  {
    id: 'particles2d',
    name: 'particles2d',
    category: '2d',
    color: '#FB7185',
    badge: 'VFX',
    signature: 'particles2d(x=320, y=240, count=24, color="#10b981", speed=180, life=0.7)',
    descriptionRu: 'Пул 2D-частиц (взрывы, искры, выхлоп, звёзды) без просадок FPS.',
    descriptionEn: 'Zero-GC pooled 2D particle burst for explosions, sparks and thrusters.',
    roleRu: 'Создаёт всплеск 2D-искр/частиц при выстреле, прыжке или взрыве.',
    roleEn: 'Emits a burst of 2D physics particles for hits, pickups and explosions.',
    compatibleWith: COMP_2D_COMPAT,
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'particles2d(x=320, y=240, count=26, color="#10b981", speed=190, life=0.65)'
  },
  {
    id: 'light2d',
    name: 'light2d',
    category: '2d',
    color: '#FDE047',
    badge: 'Lighting',
    signature: 'light2d(x=300, y=260, radius=160, color="#10b981", intensity=0.6, follow="hero")',
    descriptionRu: 'Аддитивный 2D-источник динамического света (может следовать за объектом).',
    descriptionEn: 'Additive radial 2D dynamic light (can follow any 2D entity).',
    roleRu: 'Отбрасывает мягкое радиальное свечение и может следовать за игроком.',
    roleEn: 'Creates dynamic radial 2D light that can follow any entity.',
    compatibleWith: ['use2d(lighting=true)', 'player2d', 'parallax2d'],
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'light2d(x=140, y=280, radius=180, color="#10b981", intensity=0.55, follow="hero")'
  },
  {
    id: 'floater2d',
    name: 'floater2d',
    category: '2d',
    color: '#F97316',
    badge: 'VFX',
    signature: 'floater2d(text="+25 HP", x=280, y=220, color="#facc15")',
    descriptionRu: 'Всплывающий текст урона, комбо или награды в 2D-пространстве.',
    descriptionEn: 'Floating damage/combo/XP text indicator in 2D space.',
    roleRu: 'Отображает всплывающие цифры урона, опыта или монет.',
    roleEn: 'Spawns rising floating text indicators in 2D world coordinates.',
    compatibleWith: COMP_2D_COMPAT,
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'floater2d(text="+10", x=hero.x, y=hero.y - 20, color="#facc15")'
  },
  {
    id: 'camera2d',
    name: 'camera2d',
    category: '2d',
    color: '#8B5CF6',
    badge: 'Camera',
    signature: 'camera2d(follow="hero", zoom=1.0, shake=0, smoothing=0.12)',
    descriptionRu: '2D-камера со сглаживанием, масштабом и экранной тряской.',
    descriptionEn: 'Smooth 2D follow camera with zoom and trauma screen-shake.',
    roleRu: 'Плавно следует за игроком и поддерживает тряску при попаданиях.',
    roleEn: 'Smooth 2D camera controller with target follow, zoom and shake.',
    compatibleWith: ['use2d', 'player2d', 'parallax2d'],
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'camera2d(follow="hero", zoom=1.0, smoothing=0.12)'
  },
  {
    id: 'minimap2d',
    name: 'minimap2d',
    category: '2d',
    color: '#06B6D4',
    badge: 'HUD',
    signature: 'minimap2d(enabled=true, size=120, position="top-right")',
    descriptionRu: 'Встроенный радар-миникарта, показывающий игрока, врагов и монеты.',
    descriptionEn: 'Built-in 2D radar minimap displaying player, enemies and collectibles.',
    roleRu: 'Отрисовывает радар в углу 2D-сцены со всеми сущностями.',
    roleEn: 'Renders live 2D radar overlay showing player, enemies and coins.',
    compatibleWith: ['use2d', 'player2d', 'enemy2d', 'coin2d'],
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'minimap2d(enabled=true, size=124, position="top-right")'
  },
  {
    id: 'sfx2d',
    name: 'sfx2d',
    category: '2d',
    color: '#A3E635',
    badge: 'Audio',
    signature: 'sfx2d(preset="laser", volume=0.35)',
    descriptionRu: 'Процедурный WebAudio синтезатор звуков (laser, coin, jump, explosion, powerup, click).',
    descriptionEn: 'Procedural WebAudio SFX synthesizer (laser, coin, jump, explosion, powerup, click).',
    roleRu: 'Синтезирует ретро-звуки без внешних MP3-файлов — совместим со ВСЕМИ режимами!',
    roleEn: 'Zero-asset WebAudio sound synthesizer — universal across 3D, 2D and App modes.',
    compatibleWith: ['use3d', 'use2d', 'useapp', 'clicked?', 'ui_button'],
    incompatibleWith: ['Нет ограничений (универсальный аудио-синтезатор)'],
    snippet: 'sfx2d(preset="coin", volume=0.35)'
  },

  // ======================== PRO APPS & UI (15) ========================
  {
    id: 'useapp',
    name: 'useapp',
    category: 'app',
    color: '#059669',
    badge: 'Core',
    signature: 'useapp(title="App Studio", bg="#0a0c0e", layout="dashboard", accent="#10b981")',
    descriptionRu: 'Активирует адаптивный слой приложений с сеткой карточек, шрифтами и реактивным состоянием.',
    descriptionEn: 'Enables responsive application HUD/dashboard canvas with adaptive grid and theme.',
    roleRu: 'Инициализирует режим чистого приложения / дашборда с фоном и акцентом.',
    roleEn: 'Bootstraps clean app/dashboard canvas background and accent theme.',
    compatibleWith: ['все ui_* виджеты', 'sfx2d'],
    incompatibleWith: ['не нужен, если уже активны use3d/use2d (ui_* работают поверх них сами)'],
    snippet: 'useapp(title="Telemetry Console", bg="#0a0c0e", accent="#10b981")'
  },
  {
    id: 'ui_card',
    name: 'ui_card',
    category: 'app',
    color: '#34D399',
    badge: 'Layout',
    signature: 'ui_card(id="kpi1", title="Frame Rate", value="60 FPS", subtitle="GPU Optimal", x=24, y=24, w=220, h=110, accent="#10b981")',
    descriptionRu: 'Карточка метрики или информационный блок с заголовком, значением и подписью.',
    descriptionEn: 'Metric or info card widget with title, readout value, subtitle and accent.',
    roleRu: 'Отображает карточку KPI/метрики, значение которой можно менять в live-режиме через setUI.',
    roleEn: 'Displays KPI/metric readout card dynamically updatable via setUI().',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_card(id="kpi_fps", title="ENGINE FPS", value="60 FPS", subtitle="WebGL2 PBR", x=20, y=20, w=210, h=104, accent="#10b981")'
  },
  {
    id: 'ui_chart',
    name: 'ui_chart',
    category: 'app',
    color: '#10B981',
    badge: 'Data',
    signature: 'ui_chart(id="perfChart", title="CPU / Frame Time", values=[22,35,28,45,38,54,48], x=24, y=150, w=380, h=190, color="#10b981", type="area")',
    descriptionRu: 'Живой график в реальном времени (area, line, bar) для графиков FPS, финансов и телеметрии.',
    descriptionEn: 'Real-time live chart (area, line, bar) for analytics, telemetry or finance apps.',
    roleRu: 'Строит SVG-график потока данных в реальном времени с функцией pushChart().',
    roleEn: 'Live telemetry chart supporting streaming updates via pushChart().',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_chart(id="streamChart", title="Telemetry Stream", values=[18,29,34,26,48,52,61], x=20, y=140, w=380, h=180, color="#10b981", type="area")'
  },
  {
    id: 'ui_gauge',
    name: 'ui_gauge',
    category: 'app',
    color: '#38BDF8',
    badge: 'Meter',
    signature: 'ui_gauge(id="speedGauge", label="TURBO", value=74, min=0, max=120, unit="KM/H", x=420, y=24, size=140, color="#38bdf8")',
    descriptionRu: 'Радиальный спидометр / датчик нагрузки с плавной дугой и числовой шкалой.',
    descriptionEn: 'Radial speedometer / radial gauge meter with animated arc and unit readout.',
    roleRu: 'Круговой спидометр/датчик для скорости, заряда, CPU или температуры.',
    roleEn: 'Radial arc speedometer/meter widget for telemetry and games.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_gauge(id="speedo", label="VELOCITY", value=68, min=0, max=140, unit="KM/H", x=420, y=20, size=145, color="#38bdf8")'
  },
  {
    id: 'ui_button',
    name: 'ui_button',
    category: 'app',
    color: '#22C55E',
    badge: 'Input',
    signature: 'ui_button(id="boostBtn", label="NITRO BOOST", x=24, y=360, w=170, h=42, color="#10b981", onClick="boost")',
    descriptionRu: 'Интерактивная кнопка приложения, вызывающая DRPL-функцию или событие.',
    descriptionEn: 'Interactive application button invoking a DRPL callback or named event.',
    roleRu: 'Кликабельная кнопка: вызывает def-функцию DRPL (onClick) И EPL-событие clicked?.',
    roleEn: 'Interactive HUD button triggering DRPL functions and EPL clicked? events.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_button(id="actionBtn", label="Run Boost", x=20, y=340, w=160, h=40, color="#10b981", onClick="onBoost")'
  },
  {
    id: 'ui_slider',
    name: 'ui_slider',
    category: 'app',
    color: '#0EA5E9',
    badge: 'Input',
    signature: 'ui_slider(id="bloomCtrl", label="Bloom Intensity", value=1.2, min=0, max=3, step=0.1, x=210, y=355, w=210, bind="bloomVal")',
    descriptionRu: 'Ползунок с привязкой к переменной DRPL (bind) для настройки графики, громкости или физики.',
    descriptionEn: 'Interactive slider bound to a live DRPL state variable (bind).',
    roleRu: 'Ползунок с привязкой bind="имя_переменной" для живого управления параметрами.',
    roleEn: 'Range slider synced with DRPL state variables via bind.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_slider(id="speedSlider", label="Simulation Speed", value=1.0, min=0.2, max=3.0, step=0.1, x=200, y=336, w=220, bind="simSpeed")'
  },
  {
    id: 'ui_toggle',
    name: 'ui_toggle',
    category: 'app',
    color: '#8B5CF6',
    badge: 'Input',
    signature: 'ui_toggle(id="wireToggle", label="Auto Orbit", checked=true, x=440, y=358, bind="autoOrbit")',
    descriptionRu: 'Переключатель (Switch) с двусторонней привязкой к логической переменной.',
    descriptionEn: 'Interactive toggle switch bound to a boolean DRPL state variable.',
    roleRu: 'Тумблер Вкл/Выкл, меняющий boolean-переменную в коде DRPL.',
    roleEn: 'Boolean switch widget synced to a DRPL state variable.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_toggle(id="autoMode", label="Auto Mode", checked=true, x=440, y=340, bind="autoMode")'
  },
  {
    id: 'ui_progress',
    name: 'ui_progress',
    category: 'app',
    color: '#F43F5E',
    badge: 'HUD',
    signature: 'ui_progress(id="bossHp", label="BOSS SHIELD", value=82, max=100, x=20, y=16, w=280, color="#f43f5e")',
    descriptionRu: 'Полоса прогресса / здоровья босса / загрузки с процентами.',
    descriptionEn: 'Clean progress / health / loading bar with label and percentage.',
    roleRu: 'Шкала здоровья босса, нитро-ускорения или загрузки процесса.',
    roleEn: 'Progress / HP / energy bar widget.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_progress(id="shieldBar", label="CORE INTEGRITY", value=85, max=100, x=20, y=20, w=280, color="#10b981")'
  },
  {
    id: 'ui_tabs',
    name: 'ui_tabs',
    category: 'app',
    color: '#6366F1',
    badge: 'Nav',
    signature: 'ui_tabs(id="navTabs", tabs=["Overview", "Systems", "Console"], active="Overview", x=20, y=16, bind="activeTab")',
    descriptionRu: 'Вкладки навигации для многостраничных приложений прямо в DRPL.',
    descriptionEn: 'Navigation tab bar for multi-screen applications in DRPL.',
    roleRu: 'Панель вкладок, позволяющая переключать экраны и режимы в приложении.',
    roleEn: 'Navigation tab switcher bound to active tab state.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_tabs(id="mainTabs", tabs=["Monitor", "Synthesizer", "Logs"], active="Monitor", x=20, y=18, bind="currentTab")'
  },
  {
    id: 'ui_table',
    name: 'ui_table',
    category: 'app',
    color: '#06B6D4',
    badge: 'Data',
    signature: 'ui_table(id="nodesTbl", title="Active Nodes", columns=["Node","Load","State"], rows=[["GPU-0","42%","OK"],["Audio","12%","OK"]], x=420, y=180, w=300)',
    descriptionRu: 'Таблица данных с колонками и строками для админок, инвентаря и мониторинга.',
    descriptionEn: 'Structured data table for inventories, leaderboards and admin dashboards.',
    roleRu: 'Структурированная таблица рекордов, узлов или инвентаря.',
    roleEn: 'Structured data table for analytics, leaderboards or node lists.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_table(id="nodeTbl", title="Subsystems", columns=["Module","Status","Latency"], rows=[["Renderer","ACTIVE","4ms"],["Physics","ACTIVE","1ms"]], x=420, y=175, w=300)'
  },
  {
    id: 'ui_terminal',
    name: 'ui_terminal',
    category: 'app',
    color: '#84CC16',
    badge: 'Console',
    signature: 'ui_terminal(id="term1", title="DRPL Output", lines=["DRPL Runtime v2 Ready"], x=20, y=405, w=400, h=130)',
    descriptionRu: 'Встроенная консоль/лог-терминал для вывода сообщений, дебага и скриптов.',
    descriptionEn: 'Built-in scrollable terminal console widget for logs and CLI apps.',
    roleRu: 'Прокручиваемый терминал логов, дополняемый через logTerminal(id, line).',
    roleEn: 'Scrollable terminal output window fed via logTerminal().',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_terminal(id="cliOut", title="System Log", lines=["Engine initialized"], x=20, y=395, w=400, h=130)'
  },
  {
    id: 'ui_spectrum',
    name: 'ui_spectrum',
    category: 'app',
    color: '#D946EF',
    badge: 'Audio',
    signature: 'ui_spectrum(id="eq1", title="24-Band Spectrum", bars=24, x=440, y=395, w=280, h=130, color="#10b981")',
    descriptionRu: '24-полосный аудио/синтезаторный эквалайзер с плавной анимацией столбцов.',
    descriptionEn: '24-band audio spectrum visualizer for music players and synths.',
    roleRu: 'Живой 24-полосный визуализатор частот для плееров и синтезаторов.',
    roleEn: 'Animated multi-band audio frequency visualizer.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_spectrum(id="spec1", title="Audio Spectrum", bars=24, x=440, y=395, w=280, h=130, color="#10b981")'
  },
  {
    id: 'ui_toast',
    name: 'ui_toast',
    category: 'app',
    color: '#FBBF24',
    badge: 'Notify',
    signature: 'ui_toast(text="Checkpoint Saved!", type="success")',
    descriptionRu: 'Всплывающее уведомление (success, info, warn) поверх интерфейса без alert.',
    descriptionEn: 'Non-blocking toast notification banner (success, info, warn).',
    roleRu: 'Показывает чистое всплывающее уведомление о событиях в игре или приложении.',
    roleEn: 'Triggers a clean non-blocking toast notification banner.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_toast(text="Mission Ready!", type="success")'
  },
  {
    id: 'ui_input',
    name: 'ui_input',
    category: 'app',
    color: '#EC4899',
    badge: 'Input',
    signature: 'ui_input(id="cmdInput", placeholder="Enter command...", x=20, y=340, w=240, bind="cmdText")',
    descriptionRu: 'Поле ввода текста, привязанное к переменной DRPL.',
    descriptionEn: 'Text input field bound to a DRPL state variable.',
    roleRu: 'Поле текстового ввода, синхронизированное с переменной (bind).',
    roleEn: 'Text input box synced with DRPL state variable.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_input(id="searchInput", placeholder="Filter items...", x=20, y=300, w=240, bind="query")'
  },
  {
    id: 'ui_text',
    name: 'ui_text',
    category: 'app',
    color: '#E2E8F0',
    badge: 'HUD',
    signature: 'ui_text(id="bannerTxt", text="SCORE: 0", x=20, y=20, size=20, color="#f8fafc")',
    descriptionRu: 'Чёткая текстовая метка HUD для счёта, таймеров и заголовков.',
    descriptionEn: 'Crisp HUD text readout for scores, timers and titles.',
    roleRu: 'Лёгкая текстовая надпись поверх сцены для подсказок, счёта и заголовков.',
    roleEn: 'Lightweight HUD text label for hints, scores and banners.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_text(id="hudScore", text="SCORE: 0", x=20, y=18, size=18, color="#f8fafc")'
  },

  // ======================== MORE 3D SHAPES & ENGINE NODES ========================
  {
    id: 'pyramid3d',
    name: 'pyramid3d',
    category: '3d',
    color: '#FF6B35',
    badge: 'Shape',
    signature: 'pyramid3d(name="pyr1", x=0, y=1.2, z=0, radius=1.4, h=2.4, color="#ff6b35", emissive=false)',
    descriptionRu: '3D-пирамида (треугольная / четырёхгранная) для кристаллов, обелисков и препятствий.',
    descriptionEn: '3D pyramid geometry for obelisks, crystals, and low-poly geometry.',
    roleRu: 'Создаёт 3D-пирамиду / треугольный обелиск с PBR-материалом.',
    roleEn: 'Spawns a 3D PBR pyramid / triangle spire.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'pyramid3d(name="pyr1", x=3, y=1.2, z=0, radius=1.4, h=2.4, color="#ff6b35")'
  },
  {
    id: 'cone3d',
    name: 'cone3d',
    category: '3d',
    color: '#FB923C',
    badge: 'Shape',
    signature: 'cone3d(name="cone1", x=-3, y=1.2, z=0, radius=1.1, h=2.5, color="#fb923c")',
    descriptionRu: 'Гладкий 3D-конус для ракет, маяков, шипов и башен.',
    descriptionEn: 'Smooth 3D cone geometry for rockets, beacons and spires.',
    roleRu: 'Создаёт гладкий 3D-конус с настраиваемым радиусом и высотой.',
    roleEn: 'Creates a smooth 3D PBR cone mesh.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'cone3d(name="cone1", x=-3, y=1.25, z=0, radius=1.1, h=2.5, color="#fb923c")'
  },
  {
    id: 'cylinder3d',
    name: 'cylinder3d',
    category: '3d',
    color: '#F59E0B',
    badge: 'Shape',
    signature: 'cylinder3d(name="pillar1", x=4, y=1.5, z=-4, radius=0.9, h=3.0, color="#f59e0b")',
    descriptionRu: '3D-цилиндр для колонн, бочек, реакторов и опор.',
    descriptionEn: '3D PBR cylinder for pillars, reactors and barrels.',
    roleRu: 'Создаёт 3D-цилиндр / колонну с настраиваемой высотой и радиусом.',
    roleEn: 'Spawns a 3D cylinder or architectural pillar.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'cylinder3d(name="pillar1", x=4, y=1.5, z=-4, radius=0.9, h=3.0, color="#f59e0b")'
  },
  {
    id: 'torus3d',
    name: 'torus3d',
    category: '3d',
    color: '#EC4899',
    badge: 'Shape',
    signature: 'torus3d(name="ring1", x=0, y=2.4, z=-5, radius=1.6, color="#ec4899", emissive=true)',
    descriptionRu: '3D-тор (кольцо / бублик) с опциональным неоновым свечением.',
    descriptionEn: '3D torus / donut ring mesh with optional neon emissive glow.',
    roleRu: 'Создаёт 3D-тор (кольцо) для чекпоинтов, орбит и декора.',
    roleEn: 'Spawns a 3D torus ring for checkpoints and sci-fi props.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'torus3d(name="halo1", x=0, y=2.5, z=-5, radius=1.6, color="#ec4899", emissive=true)'
  },
  {
    id: 'capsule3d',
    name: 'capsule3d',
    category: '3d',
    color: '#A78BFA',
    badge: 'Shape',
    signature: 'capsule3d(name="cap1", x=-4, y=1.4, z=2, radius=0.7, h=1.4, color="#a78bfa")',
    descriptionRu: '3D-капсула (идеальна для хитбоксов, дронов, баков и футуристических деталей).',
    descriptionEn: '3D capsule mesh for pods, tanks and character colliders.',
    roleRu: 'Создаёт гладкую 3D-капсулу с полусферическими краями.',
    roleEn: 'Creates a smooth 3D PBR capsule geometry.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'capsule3d(name="pod1", x=-4, y=1.4, z=2, radius=0.7, h=1.4, color="#a78bfa")'
  },
  {
    id: 'plane3d',
    name: 'plane3d',
    category: '3d',
    color: '#64748B',
    badge: 'Shape',
    signature: 'plane3d(name="floor1", x=0, y=0, z=0, w=24, d=24, color="#1e293b")',
    descriptionRu: 'Ровная 3D-плоскость для пола, арен, стен и сцен.',
    descriptionEn: 'Flat PBR 3D plane for floors, arenas and backdrops.',
    roleRu: 'Создаёт ровную 3D-плоскость / площадку с тенями.',
    roleEn: 'Spawns a flat shadow-receiving 3D floor or wall plane.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'plane3d(name="stageFloor", x=0, y=0, z=0, w=32, d=32, color="#1e293b")'
  },
  {
    id: 'icosahedron3d',
    name: 'icosahedron3d',
    category: '3d',
    color: '#C084FC',
    badge: 'Shape',
    signature: 'icosahedron3d(name="crystal1", x=2, y=2.2, z=-3, radius=1.1, color="#c084fc", emissive=true)',
    descriptionRu: 'Гранёный кристалл-икосаэдр для артефактов, ядер и низкополигональных камней.',
    descriptionEn: 'Faceted 3D icosahedron crystal for artifacts and energy cores.',
    roleRu: 'Создаёт светящийся гранёный 3D-кристалл (икосаэдр).',
    roleEn: 'Spawns a faceted 3D icosahedron crystal mesh.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'icosahedron3d(name="crystal1", x=2, y=2.2, z=-3, radius=1.1, color="#c084fc", emissive=true)'
  },
  {
    id: 'ring3d',
    name: 'ring3d',
    category: '3d',
    color: '#E879F9',
    badge: 'VFX',
    signature: 'ring3d(name="zone1", x=0, y=0.08, z=0, radius=3.5, color="#e879f9")',
    descriptionRu: 'Горизонтальное неоновое 3D-кольцо на земле для зон захвата и телепортов.',
    descriptionEn: 'Flat glowing 3D ring zone for capture points and pads.',
    roleRu: 'Рисует плоское неоновое 3D-кольцо зоны захвата на земле.',
    roleEn: 'Renders a flat glowing ground ring marker in 3D.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'ring3d(name="zone1", x=0, y=0.08, z=0, radius=3.5, color="#e879f9")'
  },
  {
    id: 'text3d',
    name: 'text3d',
    category: '3d',
    color: '#FDE047',
    badge: 'Hologram',
    signature: 'text3d(name="sign1", text="CYBER ARENA", x=0, y=5, z=-10, color="#fde047", scale=1.5)',
    descriptionRu: 'Парящий голографический 3D-баннер с текстом прямо в 3D-мире.',
    descriptionEn: 'Floating 3D hologram billboard banner rendered in world space.',
    roleRu: 'Размещает светящуюся 3D-вывеску с текстом прямо в 3D-пространстве.',
    roleEn: 'Places a crisp glowing hologram text banner in 3D space.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'text3d(name="banner3d", text="DRPL ENGINE", x=0, y=5, z=-8, color="#fde047", scale=1.4)'
  },
  {
    id: 'grid3d',
    name: 'grid3d',
    category: '3d',
    color: '#2DD4BF',
    badge: 'Helper',
    signature: 'grid3d(name="axisGrid", size=80, divisions=40, color="#10b981")',
    descriptionRu: 'Координатная 3D-сетка (GridHelper) для точного построения уровней.',
    descriptionEn: 'Calibrated 3D coordinate grid for level layout and alignment.',
    roleRu: 'Добавляет калиброванную 3D-сетку пола для точного позиционирования.',
    roleEn: 'Adds a clean 3D floor grid for spatial alignment.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'grid3d(name="editorGrid", size=80, divisions=40, color="#10b981")'
  },
  {
    id: 'spin3d',
    name: 'spin3d',
    category: '3d',
    color: '#FB7185',
    badge: 'Behavior',
    signature: 'spin3d(target="crystal1", x=0.4, y=1.8, z=0.2)',
    descriptionRu: 'Модификатор авто-вращения любого 3D-объекта по осям X/Y/Z без лишнего кода.',
    descriptionEn: 'Attaches smooth continuous X/Y/Z rotation to any named 3D object.',
    roleRu: 'Автоматически вращает любой 3D-объект по имени target каждую секунду.',
    roleEn: 'Continuously rotates a named 3D entity on X/Y/Z axes.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'spin3d(target="crystal1", x=0.3, y=1.8, z=0)'
  },
  {
    id: 'rigidbody3d',
    name: 'rigidbody3d',
    category: '3d',
    color: '#F43F5E',
    badge: 'Physics',
    signature: 'rigidbody3d(target="crate", gravity=18, bounce=0.55, floorY=1.0)',
    descriptionRu: 'Добавляет гравитацию и отскок от пола к любому 3D-объекту.',
    descriptionEn: 'Adds real-time gravity, velocity and ground bounce physics to any 3D object.',
    roleRu: 'Подключает 3D-гравитацию и упругий отскок для объекта.',
    roleEn: 'Simulates gravity and bounce physics on a 3D entity.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'rigidbody3d(target="orb", gravity=18, bounce=0.65, floorY=1.0)'
  },
  {
    id: 'fog3d',
    name: 'fog3d',
    category: '3d',
    color: '#94A3B8',
    badge: 'Atmosphere',
    signature: 'fog3d(color="#070b14", density=0.014)',
    descriptionRu: 'Настраивает плотность и оттенок объемного тумана 3D-сцены.',
    descriptionEn: 'Configures 3D scene exponential fog color and density.',
    roleRu: 'Управляет цветом и плотностью атмосферного тумана сцены.',
    roleEn: 'Tunes 3D scene exponential fog color and depth.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'fog3d(color="#090d16", density=0.012)'
  },
  {
    id: 'rect2d',
    name: 'rect2d',
    category: '2d',
    color: '#38BDF8',
    badge: 'Shape',
    signature: 'rect2d(name="block1", x=220, y=220, w=80, h=80, color="#38bdf8", border="#ffffff")',
    descriptionRu: 'Прямоугольник / блок / стена в 2D-пространстве с рамкой и свечением.',
    descriptionEn: '2D rectangle block / wall shape with optional glowing border.',
    roleRu: 'Рисует настраиваемый 2D-блок / прямоугольник (можно двигать в Edit Visual).',
    roleEn: 'Draws a configurable 2D block/rectangle entity.',
    compatibleWith: COMP_2D_COMPAT,
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'rect2d(name="block1", x=220, y=220, w=90, h=60, color="#38bdf8")'
  },
  {
    id: 'triangle2d',
    name: 'triangle2d',
    category: '2d',
    color: '#F97316',
    badge: 'Shape',
    signature: 'triangle2d(name="tri1", x=360, y=220, w=64, h=64, color="#f97316")',
    descriptionRu: '2D-треугольник (рампа, шип, стрелка, кристалл).',
    descriptionEn: '2D triangle shape for ramps, spikes, ships and props.',
    roleRu: 'Рисует 2D-треугольник с настраиваемым цветом и размером.',
    roleEn: 'Renders a scalable 2D triangle shape.',
    compatibleWith: COMP_2D_COMPAT,
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'triangle2d(name="tri1", x=360, y=240, w=64, h=64, color="#f97316")'
  },
  {
    id: 'circle2d',
    name: 'circle2d',
    category: '2d',
    color: '#A855F7',
    badge: 'Shape',
    signature: 'circle2d(name="orb1", x=480, y=200, radius=32, color="#a855f7", glow="#e879f9")',
    descriptionRu: 'Идеальный 2D-круг / шар / планета с обводкой.',
    descriptionEn: 'Crisp 2D circle / orb with optional neon glow.',
    roleRu: 'Рисует 2D-круг / сферу / мяч заданного радиуса.',
    roleEn: 'Renders a smooth 2D circle shape with optional glow.',
    compatibleWith: COMP_2D_COMPAT,
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'circle2d(name="orb1", x=480, y=200, radius=32, color="#a855f7", glow="#e879f9")'
  },
  {
    id: 'polygon2d',
    name: 'polygon2d',
    category: '2d',
    color: '#EC4899',
    badge: 'Shape',
    signature: 'polygon2d(name="hex1", x=320, y=140, radius=34, sides=6, color="#ec4899", spin=1.2)',
    descriptionRu: 'Правильный N-угольник (пятиугольник, гексагон, октагон) с авто-вращением.',
    descriptionEn: 'Regular N-sided 2D polygon (pentagon, hexagon, octagon) with spin.',
    roleRu: 'Рисует 2D-многоугольник (гексагон, щит, шестерёнка) с вращением.',
    roleEn: 'Draws a rotating N-sided 2D regular polygon.',
    compatibleWith: COMP_2D_COMPAT,
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'polygon2d(name="hex1", x=320, y=150, radius=34, sides=6, color="#ec4899", spin=1.2)'
  },
  {
    id: 'line2d',
    name: 'line2d',
    category: '2d',
    color: '#2DD4BF',
    badge: 'Shape',
    signature: 'line2d(name="beam1", x=160, y=290, w=180, h=6, color="#2dd4bf")',
    descriptionRu: '2D-линия / перемычка / энергомост с неоновой толщиной.',
    descriptionEn: 'Glowing 2D vector beam / bridge segment.',
    roleRu: 'Рисует светящуюся векторную линию / энергомост в 2D.',
    roleEn: 'Draws a crisp glowing 2D vector line or bridge.',
    compatibleWith: COMP_2D_COMPAT,
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'line2d(name="beam1", x=160, y=290, w=180, h=6, color="#2dd4bf")'
  },
  {
    id: 'capsule2d',
    name: 'capsule2d',
    category: '2d',
    color: '#818CF8',
    badge: 'Shape',
    signature: 'capsule2d(name="pill1", x=240, y=160, w=88, h=34, color="#818cf8")',
    descriptionRu: 'Скруглённая 2D-капсула для модулей, кораблей и батутов.',
    descriptionEn: 'Rounded 2D capsule pill geometry for ships and pads.',
    roleRu: 'Рисует скруглённую 2D-капсулу / пилюлю.',
    roleEn: 'Renders a rounded 2D capsule shape.',
    compatibleWith: COMP_2D_COMPAT,
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'capsule2d(name="pill1", x=240, y=160, w=88, h=34, color="#818cf8")'
  },
  {
    id: 'sprite2d',
    name: 'sprite2d',
    category: '2d',
    color: '#34D399',
    badge: 'Sprite',
    signature: 'sprite2d(name="ship1", icon="rocket", x=300, y=180, w=48, h=48, color="#34d399")',
    descriptionRu: 'Встроенный векторный 2D-спрайт (rocket, star, shield, heart, gem) без картинок.',
    descriptionEn: 'Built-in procedural 2D icon sprite (rocket, star, shield, heart, gem).',
    roleRu: 'Рисует готовый игровой 2D-спрайт (ракета, звезда, щит, сердце).',
    roleEn: 'Draws crisp procedural 2D game sprites (rocket, star, shield).',
    compatibleWith: COMP_2D_COMPAT,
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'sprite2d(name="ship1", icon="rocket", x=300, y=180, w=48, h=48, color="#34d399")'
  },
  {
    id: 'weather2d',
    name: 'weather2d',
    category: '2d',
    color: '#60A5FA',
    badge: 'VFX',
    signature: 'weather2d(type="rain", density=65, color="#38bdf8")',
    descriptionRu: 'Атмосферные 2D-осадки (rain, snow, embers) поверх всей сцены.',
    descriptionEn: 'Animated 2D ambient weather layer (rain, snow, embers).',
    roleRu: 'Добавляет дождь, снег или летящие искры в 2D-игру.',
    roleEn: 'Adds animated rain, snow, or rising embers to 2D scenes.',
    compatibleWith: COMP_2D_COMPAT,
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'weather2d(type="embers", density=55, color="#fb923c")'
  },
  {
    id: 'ui_badge',
    name: 'ui_badge',
    category: 'app',
    color: '#14B8A6',
    badge: 'HUD',
    signature: 'ui_badge(id="statusBadge", text="ONLINE • 60 FPS", x=20, y=18, color="#10b981")',
    descriptionRu: 'Компактный бейдж статуса для HUD и панелей управления.',
    descriptionEn: 'Compact status indicator badge for HUD overlays and dashboards.',
    roleRu: 'Показывает компактный индикатор статуса, уровня или режима.',
    roleEn: 'Displays a crisp status indicator chip on screen.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_badge(id="envBadge", text="LIVE • DRPL v2", x=20, y=18, color="#10b981")'
  },
  {
    id: 'ui_avatar',
    name: 'ui_avatar',
    category: 'app',
    color: '#A78BFA',
    badge: 'Profile',
    signature: 'ui_avatar(id="heroCard", name="Commander", role="Level 12", x=20, y=60, color="#a78bfa")',
    descriptionRu: 'Карточка профиля игрока или оператора с аватаром и рангом.',
    descriptionEn: 'Player or operator profile badge with avatar emblem and rank.',
    roleRu: 'Отображает карточку игрока/персонажа с инициалами и статусом.',
    roleEn: 'Renders player/unit profile chip with initials and role.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_avatar(id="unitCard", name="Pilot Alpha", role="Rank S", x=20, y=60, color="#a78bfa")'
  },
  {
    id: 'ui_code',
    name: 'ui_code',
    category: 'app',
    color: '#38BDF8',
    badge: 'Data',
    signature: 'ui_code(id="jsonView", title="State Snapshot", code="mode: active", x=20, y=140, w=260, h=110)',
    descriptionRu: 'Блок живого инспектора JSON/кода для отладки и инженерных панелей.',
    descriptionEn: 'Live monospace code/JSON readout block for telemetry & tools.',
    roleRu: 'Отображает форматированный код/JSON прямо внутри приложения.',
    roleEn: 'Displays live monospace code or JSON state snapshots.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_code(id="stateBox", title="Live Telemetry", code="mode: active\\nthreads: 8", x=20, y=130, w=250, h=100)'
  },
  {
    id: 'ui_modal',
    name: 'ui_modal',
    category: 'app',
    color: '#F43F5E',
    badge: 'Overlay',
    signature: 'ui_modal(id="missionModal", title="Mission Briefing", body="Reach the portal!", open=true, color="#10b981")',
    descriptionRu: 'Закрываемое диалоговое окно поверх приложения или игры.',
    descriptionEn: 'Interactive dismissible dialog modal overlay.',
    roleRu: 'Всплывающее окно брифинга, магазина или паузы с кнопкой закрытия.',
    roleEn: 'Dismissible interactive dialog modal for briefings and alerts.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_modal(id="briefing", title="System Briefing", body="Use WASD to explore.", open=true, color="#10b981")'
  },
  {
    id: 'state_store',
    name: 'state_store',
    category: 'app',
    color: '#10B981',
    badge: 'OOP / Data',
    signature: 'state_store(score=0, level=1, wave=1)',
    descriptionRu: 'Инициализирует глобальное типизированное хранилище состояния (работает с getVar/setVar).',
    descriptionEn: 'Initializes typed reactive global key/value state keys (synced with getVar/setVar).',
    roleRu: 'Задаёт начальные глобальные переменные состояния одним вызовом.',
    roleEn: 'Bootstraps reactive global state key-value variables.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'state_store(score=0, level=1, combo=1)'
  },
  {
    id: 'event_bus',
    name: 'event_bus',
    category: 'app',
    color: '#FBBF24',
    badge: 'Events',
    signature: 'event_bus(emit="mission_start", payload="Sector 7")',
    descriptionRu: 'Шина событий Pub/Sub для связи Java/C#/Python классов и EPL-хуков.',
    descriptionEn: 'Pub/Sub event bus bridging OOP classes and EPL hooks.',
    roleRu: 'Отправляет именованные события в шину приложения.',
    roleEn: 'Dispatches named pub/sub events across DRPL modules.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'event_bus(emit="mission_start", payload="Ready")'
  },
  // ======================== EXTENDED 3D SYSTEMS (7) ========================
  {
    id: 'raycast3d',
    name: 'raycast3d',
    category: '3d',
    color: '#38BDF8',
    badge: 'Physics',
    signature: 'raycast3d(name="sensor1", from="racer", length=18, color="#38bdf8")',
    descriptionRu: '3D лазерный луч-сенсор для обнаружения объектов, дистанции и наведения турелей.',
    descriptionEn: '3D laser raycast sensor beam for target scanning, distance sensing and aiming.',
    roleRu: 'Проецирует направленный луч-сенсор от игрока или турели.',
    roleEn: 'Projects a visible directional laser raycast beam from an entity.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'raycast3d(name="laserScan", from="racer", length=18, color="#38bdf8")'
  },
  {
    id: 'hologram3d',
    name: 'hologram3d',
    category: '3d',
    color: '#C084FC',
    badge: 'FX',
    signature: 'hologram3d(name="holoCore", x=0, y=3.6, z=-6, radius=1.8, color="#c084fc")',
    descriptionRu: 'Парящая анимированная 3D-голограмма с орбитальными кольцами и энергетическим ядром.',
    descriptionEn: 'Floating 3D holographic projection with orbiting rings and glowing core.',
    roleRu: 'Создаёт sci-fi голограмму-ориентир, артефакт или центральный реактор.',
    roleEn: 'Renders a floating holographic sci-fi core with dual orbital rings.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'hologram3d(name="holo1", x=0, y=3.5, z=-6, radius=1.7, color="#c084fc")'
  },
  {
    id: 'checkpoint3d',
    name: 'checkpoint3d',
    category: '3d',
    color: '#22C55E',
    badge: 'Gameplay',
    signature: 'checkpoint3d(name="cp1", x=0, y=1.5, z=-16, radius=3.0, color="#22c55e")',
    descriptionRu: 'Светящаяся 3D-контрольная точка гонки или квеста: автоматически фиксирует прохождение игроком.',
    descriptionEn: 'Glowing 3D race/quest checkpoint gate that triggers completion feedback when reached.',
    roleRu: 'Контрольные ворота для гонок и 3D-платформеров с триггером прохождения.',
    roleEn: 'Interactive 3D race/quest checkpoint gate with reach detection.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'checkpoint3d(name="cp1", x=0, y=1.5, z=-16, radius=3.0, color="#22c55e")'
  },
  {
    id: 'platform3d',
    name: 'platform3d',
    category: '3d',
    color: '#64748B',
    badge: 'Level',
    signature: 'platform3d(name="bridge1", x=0, y=2.2, z=-8, w=6, h=0.6, d=10, color="#1e293b", glow="#10b981")',
    descriptionRu: 'Парящая 3D-платформа или мост с неоновой каймой для паркура и арен.',
    descriptionEn: 'Hovering 3D neon-rimmed platform or bridge deck for arenas and parkour.',
    roleRu: 'Строительная 3D-платформа/мост с декоративной подсветкой краёв.',
    roleEn: '3D floating bridge/platform deck with customizable dimensions and neon trim.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'platform3d(name="bridge1", x=0, y=2.0, z=-8, w=6, h=0.6, d=10, color="#1e293b", glow="#10b981")'
  },
  {
    id: 'bouncepad3d',
    name: 'bouncepad3d',
    category: '3d',
    color: '#F59E0B',
    badge: 'Physics',
    signature: 'bouncepad3d(name="pad1", x=4, y=0.2, z=0, radius=1.8, power=18, color="#f59e0b")',
    descriptionRu: '3D-батут/ускоритель: подбрасывает или ускоряет транспорт и персонажей при наезде.',
    descriptionEn: '3D launch/boost pad that propels nearby vehicles and characters.',
    roleRu: 'Трамплин-ускоритель в 3D-мире с пульсирующей волной энергии.',
    roleEn: 'Interactive 3D boost/jump pad with pulsing energy ring.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'bouncepad3d(name="boostPad", x=4, y=0.25, z=-4, radius=1.8, power=16, color="#f59e0b")'
  },
  {
    id: 'trail3d',
    name: 'trail3d',
    category: '3d',
    color: '#2DD4BF',
    badge: 'FX',
    signature: 'trail3d(name="jetTrail", target="racer", color="#2dd4bf", length=20)',
    descriptionRu: 'Динамический световой след (выхлоп/шлейф) за движущимся 3D-объектом.',
    descriptionEn: 'Dynamic motion/exhaust particle trail following a moving 3D entity.',
    roleRu: 'Рисует плавный шлейф движения позади машины, меха или снаряда.',
    roleEn: 'Renders a live glowing motion trail behind a target 3D entity.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'trail3d(name="jetTrail", target="racer", color="#2dd4bf", length=20)'
  },
  {
    id: 'shake3d',
    name: 'shake3d',
    category: '3d',
    color: '#FB7185',
    badge: 'Camera',
    signature: 'shake3d(intensity=0.45, duration=0.4)',
    descriptionRu: 'Кинематографичная тряска 3D-камеры при взрывах, выстрелах и столкновениях.',
    descriptionEn: 'Procedural 3D camera impact shake for explosions, hits and boosts.',
    roleRu: 'Добавляет импакт и отдачу 3D-камере на заданное время.',
    roleEn: 'Triggers procedural 3D camera shake impulse.',
    compatibleWith: COMP_3D_COMPAT,
    incompatibleWith: COMP_3D_INCOMPAT,
    snippet: 'shake3d(intensity=0.4, duration=0.35)'
  },
  // ======================== EXTENDED 2D SYSTEMS (7) ========================
  {
    id: 'spawner2d',
    name: 'spawner2d',
    category: '2d',
    color: '#F97316',
    badge: 'Gameplay',
    signature: 'spawner2d(name="orbSpawner", kind="coin2d", x=380, y=220, interval=3.5, color="#facc15")',
    descriptionRu: 'Автоматический 2D-генератор монет или врагов по таймеру.',
    descriptionEn: 'Timed 2D entity spawner for coins, pickups or enemy waves.',
    roleRu: 'Спавнит новые 2D-объекты на карте с заданным интервалом.',
    roleEn: 'Spawns coins or enemy waves periodically at world coordinates.',
    compatibleWith: COMP_2D_COMPAT,
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'spawner2d(name="coinWave", kind="coin2d", x=380, y=220, interval=3.5, color="#facc15")'
  },
  {
    id: 'checkpoint2d',
    name: 'checkpoint2d',
    category: '2d',
    color: '#22C55E',
    badge: 'Level',
    signature: 'checkpoint2d(name="flag1", x=620, y=360, color="#22c55e")',
    descriptionRu: '2D-флаг сохранения/финиша: активируется при касании героем и запускает эффект победы.',
    descriptionEn: '2D checkpoint/finish flag that activates on hero contact with confetti particles.',
    roleRu: 'Точка сохранения или финиш уровня в 2D-играх.',
    roleEn: '2D level checkpoint / finish flag with automatic hero touch trigger.',
    compatibleWith: COMP_2D_COMPAT,
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'checkpoint2d(name="finishFlag", x=620, y=360, color="#22c55e")'
  },
  {
    id: 'spring2d',
    name: 'spring2d',
    category: '2d',
    color: '#EAB308',
    badge: 'Physics',
    signature: 'spring2d(name="jumpPad", x=290, y=412, w=48, h=18, power=680, color="#eab308")',
    descriptionRu: 'Пружина-батут для 2D-платформеров: высоко подбрасывает игрока при прыжке сверху.',
    descriptionEn: '2D jump spring pad that launches the player high into the air.',
    roleRu: 'Интерактивный 2D-батут с физическим импульсом прыжка и звуком.',
    roleEn: 'Physics 2D bounce spring pad with upward launch impulse.',
    compatibleWith: COMP_2D_COMPAT,
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'spring2d(name="spring1", x=280, y=412, w=48, h=18, power=680, color="#eab308")'
  },
  {
    id: 'hazard2d',
    name: 'hazard2d',
    category: '2d',
    color: '#EF4444',
    badge: 'Danger',
    signature: 'hazard2d(name="spikes1", x=360, y=412, w=84, h=18, damage=20, color="#ef4444")',
    descriptionRu: 'Опасная 2D-зона (шипы/лава): наносит урон игроку и отбрасывает при касании.',
    descriptionEn: '2D hazard spikes/lava zone that damages hero HP and knocks back on touch.',
    roleRu: 'Ловушка с шипами или лавой для 2D-уровней.',
    roleEn: '2D spike/lava hazard obstacle with damage and knockback.',
    compatibleWith: COMP_2D_COMPAT,
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'hazard2d(name="spikes1", x=360, y=412, w=84, h=18, damage=20, color="#ef4444")'
  },
  {
    id: 'shield2d',
    name: 'shield2d',
    category: '2d',
    color: '#38BDF8',
    badge: 'Powerup',
    signature: 'shield2d(target="hero", radius=32, color="#38bdf8")',
    descriptionRu: 'Энергетический 2D-щит вокруг персонажа, защищающий от опасностей и дронов.',
    descriptionEn: 'Orbiting energy shield aura attached to a 2D character.',
    roleRu: 'Визуальный силовой щит и аура защиты вокруг 2D-героя.',
    roleEn: 'Glowing circular forcefield shield following a 2D character.',
    compatibleWith: COMP_2D_COMPAT,
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'shield2d(target="hero", radius=32, color="#38bdf8")'
  },
  {
    id: 'dialog2d',
    name: 'dialog2d',
    category: '2d',
    color: '#A855F7',
    badge: 'Story',
    signature: 'dialog2d(id="npcTalk", speaker="Cyber Guide", text="Collect all coins and reach the flag!", color="#a855f7")',
    descriptionRu: 'Стильное RPG-окно диалога персонажа поверх 2D-сцены.',
    descriptionEn: 'RPG character speech/dialogue box overlay inside 2D games.',
    roleRu: 'Квестовый диалог NPC или подсказка сюжета.',
    roleEn: 'Clean RPG dialogue prompt card at the bottom of the viewport.',
    compatibleWith: COMP_2D_COMPAT,
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'dialog2d(id="npc1", speaker="Guide", text="Collect coins and use springs to climb!", color="#a855f7")'
  },
  {
    id: 'tween2d',
    name: 'tween2d',
    category: '2d',
    color: '#06B6D4',
    badge: 'Anim',
    signature: 'tween2d(target="plat1", axis="y", range=45, speed=2.0)',
    descriptionRu: 'Плавная синусоидальная анимация движения платформы, монеты или блока по X/Y.',
    descriptionEn: 'Smooth oscillating tween animator for moving 2D platforms or props.',
    roleRu: 'Делает любую 2D-платформу или фигуру плавно движущейся туда-сюда.',
    roleEn: 'Animates any 2D entity smoothly along X or Y axis.',
    compatibleWith: COMP_2D_COMPAT,
    incompatibleWith: COMP_2D_INCOMPAT,
    snippet: 'tween2d(target="plat1", axis="y", range=42, speed=2.0)'
  },
  // ======================== EXTENDED APP UI & SYSTEMS (7) ========================
  {
    id: 'ui_inventory',
    name: 'ui_inventory',
    category: 'app',
    color: '#F59E0B',
    badge: 'RPG / App',
    signature: 'ui_inventory(id="inv1", title="Backpack", items=["Plasma","Nitro","Shield","Key"], x=20, y=380, w=280, color="#f59e0b")',
    descriptionRu: 'Интерактивная сетка инвентаря/слотов с выбором активного предмета.',
    descriptionEn: 'Interactive RPG/app item slot grid with active selection.',
    roleRu: 'Панель инвентаря или инструментов с кликабельными слотами.',
    roleEn: 'Clickable grid inventory / toolbelt widget for games and apps.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_inventory(id="inv1", title="Loadout", items=["Plasma","Nitro","Shield","Repair"], x=20, y=360, w=280, color="#f59e0b")'
  },
  {
    id: 'ui_statbar',
    name: 'ui_statbar',
    category: 'app',
    color: '#10B981',
    badge: 'HUD',
    signature: 'ui_statbar(id="vitals", hp=88, maxHp=100, mana=64, maxMana=100, x=20, y=18, w=230)',
    descriptionRu: 'Двойная полоса жизней и энергии (HP + Energy/Mana) в одном компактном виджете.',
    descriptionEn: 'Compact dual HP + Energy/Mana RPG HUD status bar widget.',
    roleRu: 'Показывает здоровье и энергию/ману персонажа в играх.',
    roleEn: 'Dual health and energy/mana bar HUD display.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_statbar(id="vitals", hp=90, maxHp=100, mana=70, maxMana=100, x=18, y=18, w=230)'
  },
  {
    id: 'ui_timer',
    name: 'ui_timer',
    category: 'app',
    color: '#38BDF8',
    badge: 'HUD',
    signature: 'ui_timer(id="missionClock", label="TIME LEFT", seconds=120, countDown=true, x=270, y=18, color="#38bdf8")',
    descriptionRu: 'Живой таймер/секундомер для гонок, испытаний и приложений продуктивности.',
    descriptionEn: 'Live ticking countdown timer or stopwatch widget.',
    roleRu: 'Отображает отсчёт времени матча или таймер фокус-сессии.',
    roleEn: 'Auto-ticking countdown or stopwatch HUD clock.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_timer(id="clock1", label="MISSION TIME", seconds=90, countDown=true, x=270, y=18, color="#38bdf8")'
  },
  {
    id: 'ui_chat',
    name: 'ui_chat',
    category: 'app',
    color: '#A78BFA',
    badge: 'Social',
    signature: 'ui_chat(id="feed1", title="Mission Feed", messages=["Engine online","Ready!"], x=438, y=360, w=290, h=150)',
    descriptionRu: 'Лента сообщений/лога отряда или чата с автоматической прокруткой.',
    descriptionEn: 'Live scrollable message feed / squad chat log widget.',
    roleRu: 'Отображает сообщения миссии, системные уведомления или диалоги.',
    roleEn: 'Scrollable mission feed / chat list panel.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_chat(id="feed1", title="Squad Feed", messages=["All systems nominal","Press F to fire"], x=438, y=360, w=290, h=145)'
  },
  {
    id: 'ui_grid',
    name: 'ui_grid',
    category: 'app',
    color: '#2DD4BF',
    badge: 'Layout',
    signature: 'ui_grid(id="pad1", title="Action Pad", buttons=["Scan","Boost","Shield","Reset"], x=20, y=240, w=240, color="#2dd4bf")',
    descriptionRu: 'Сетка быстрых кнопок-команд (StreamDeck/панель управления) с мгновенным откликом.',
    descriptionEn: 'Quick-action grid keypad / macro deck widget with live click events.',
    roleRu: 'Компактная панель быстрых команд для игр, синтезаторов и дашбордов.',
    roleEn: 'Multi-button tactical action keypad grid.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'ui_grid(id="pad1", title="Quick Controls", buttons=["Boost","Scan","Shield","Reset"], x=20, y=240, w=240, color="#2dd4bf")'
  },
  {
    id: 'synth_music',
    name: 'synth_music',
    category: 'app',
    color: '#EC4899',
    badge: 'Audio',
    signature: 'synth_music(preset="cyber_pulse", tempo=118, volume=0.18)',
    descriptionRu: 'Встроенный WebAudio-синтезатор фоновой музыки (cyber_pulse, arcade_run, ambient_pad).',
    descriptionEn: 'Built-in procedural WebAudio music synthesizer (cyber_pulse, arcade_run, ambient_pad).',
    roleRu: 'Проигрывает процедурный саундтрек без внешних MP3-файлов.',
    roleEn: 'Plays procedural synthesized background loops via WebAudio.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'synth_music(preset="cyber_pulse", tempo=118, volume=0.18)'
  },
  {
    id: 'storage_save',
    name: 'storage_save',
    category: 'app',
    color: '#14B8A6',
    badge: 'Data',
    signature: 'storage_save(key="highscore", value=100)',
    descriptionRu: 'Сохраняет рекорды и прогресс игрока в безопасную память проекта (storage_load).',
    descriptionEn: 'Persists player high scores and progress in sandboxed storage (paired with storage_load).',
    roleRu: 'Хранит и считывает рекорды, очки и настройки между запусками.',
    roleEn: 'Stores persistent key/value game scores and settings.',
    compatibleWith: COMP_APP_COMPAT,
    incompatibleWith: COMP_APP_INCOMPAT,
    snippet: 'storage_save(key="highscore", value=100)'
  }
];

export const DRPL_COMPONENTS: DrplComponentDef[] = (() => {
  const seen = new Set<string>();
  const merged: DrplComponentDef[] = [];
  for (const core of DRPL_CORE_COMPONENTS) {
    const normalized: DrplComponentDef = {
      ...core,
      subgroup: core.subgroup || core.badge || (core.category === '3d' ? 'Core 3D' : core.category === '2d' ? 'Core 2D' : 'Core App')
    };
    seen.add(normalized.name);
    merged.push(normalized);
  }
  for (const ext of DRPL_EXTENDED_COMPONENTS) {
    if (seen.has(ext.name)) continue;
    seen.add(ext.name);
    merged.push(ext);
  }
  return merged;
})();

export const DRPL_COMPONENT_BY_NAME: Map<string, DrplComponentDef> = new Map(
  DRPL_COMPONENTS.map(c => [c.name, c])
);

export const DRPL_COMPONENT_NAME_SET: Set<string> = new Set(
  DRPL_COMPONENTS.map(c => c.name)
);

export const DRPL_SUBGROUPS: Record<'all' | DrplCategory, string[]> = {
  all: Array.from(new Set(DRPL_COMPONENTS.map(c => c.subgroup).filter(Boolean) as string[])),
  '3d': Array.from(new Set(DRPL_COMPONENTS.filter(c => c.category === '3d').map(c => c.subgroup).filter(Boolean) as string[])),
  '2d': Array.from(new Set(DRPL_COMPONENTS.filter(c => c.category === '2d').map(c => c.subgroup).filter(Boolean) as string[])),
  app: Array.from(new Set(DRPL_COMPONENTS.filter(c => c.category === 'app').map(c => c.subgroup).filter(Boolean) as string[]))
};

export const DRPL_COMPONENT_COLOR_MAP: Record<string, string> = {
  ...Object.fromEntries(DRPL_COMPONENTS.map(c => [c.name, c.color])),
  move3d: '#34D399',
  rotate3d: '#60A5FA',
  scale3d: '#A78BFA',
  move2d: '#2DD4BF',
  dragon3d: '#F43F5E',
  forest3d: '#4ADE80',
  character3d: '#38BDF8',
  projectile3d: '#FBBF24'
};

export const DRPL_TEMPLATES: DrplTemplateDef[] = [
  {
    id: 'cyber_drift_3d',
    nameRu: '3D Cyber Drift & Forest',
    nameEn: '3D Cyber Drift & Forest',
    category: '3d',
    descriptionRu: 'Гонка по ночному рельефу с GPU-лесом, водой, порталом, дрифт-каром (WASD) и живым спидометром.',
    descriptionEn: 'Open 3D terrain racer with GPU instanced neon forest, ocean shader, portal, WASD car & HUD.',
    headerParams: {
      name: 'cyberDriftEngine',
      mode: '3d',
      quality: 'ultra',
      fps: '60',
      shadows: 'true',
      bloom: 'true',
      instancing: 'true',
      culling: 'true'
    },
    drplCode: `// DRPL v2 - 3D Cyber Drift & Neon Forest
use3d(lighting="studio", bloom=1.1, shadows=true, fog=true)
sky3d(style="cyber_aurora", stars=950, speed=1.0)
terrain3d(name="ground", size=140, height=3.8, style="cyber", color="#090d16", wireColor="#10b981")
water3d(name="sea", size=140, y=-1.3, color="#0284c7", wave=0.32)
trees3d(count=180, radius=62, style="neon_pine", color="#10b981")
portal3d(name="warpGate", x=0, y=3.2, z=-22, radius=2.8, color="#a855f7")

car3d(name="racer", x=0, y=0.55, z=6, color="#10b981", neon=true)
camera3d(mode="chase", target="racer", distance=11, height=4.4, fov=60)

pickup3d(name="gem1", x=6, y=1.6, z=-6, color="#facc15", spin=2.8)
pickup3d(name="gem2", x=-7, y=1.6, z=-12, color="#38bdf8", spin=2.8)
particles3d(name="fireflies", count=650, radius=32, color="#10b981", style="float")

let speed = 0.0
float nitro = 100.0
int gems = 0

def onBoost() {
  if nitro >= 20 {
    nitro = nitro - 20
    speed = speed + 14
    sfx2d(preset="powerup", volume=0.35)
    ui_toast(text="NITRO ENGAGED!", type="success")
  }
}

ui_card(id="hudScore", title="GEMS COLLECTED", value="0", subtitle="WASD / Arrows to drive", x=18, y=18, w=190, h=86, accent="#10b981")
ui_gauge(id="speedo", label="VELOCITY", value=0, min=0, max=120, unit="KM/H", x=18, y=114, size=130, color="#38bdf8")
ui_progress(id="nitroBar", label="NITRO BOOST", value=100, max=100, x=18, y=254, w=190, color="#a855f7")
ui_button(id="boostBtn", label="NITRO [SPACE]", x=18, y=308, w=190, h=38, color="#10b981", onClick="onBoost")

frame?
  float kmh = Math.round(Math.abs(getProp("racer", "speed", 0)) * 5.2)
  nitro = Math.min(100, nitro + dt * 9)
  setUI("speedo", "value", kmh)
  setUI("nitroBar", "value", Math.round(nitro))
  setUI("hudScore", "value", String(getVar("gems", gems)))
end`
  },
  {
    id: 'mecha_boss_3d',
    nameRu: '3D Mecha Boss Arena',
    nameEn: '3D Mecha Boss Arena',
    category: '3d',
    descriptionRu: 'Битва 3D-меха с огромным боссом среди небоскрёбов GPU-сити с турелями и полосой HP.',
    descriptionEn: '3D Mecha arena battle against a floating colossus inside an instanced cyberpunk city.',
    headerParams: {
      name: 'mechaArena',
      mode: '3d',
      quality: 'ultra',
      fps: '60',
      shadows: 'true',
      bloom: 'true',
      instancing: 'true',
      culling: 'true'
    },
    drplCode: `// DRPL v2 - 3D Mecha Boss Arena
use3d(lighting="studio", bloom=1.35, shadows=true, fog=true)
sky3d(style="deep_space", stars=1200, speed=1.2)
terrain3d(name="arena", size=120, height=1.2, style="cyber", color="#0b101b", wireColor="#38bdf8")
city3d(count=120, spread=78, maxHeight=26, color="#111827", neon="#38bdf8")

mecha3d(name="titan", x=0, y=1.3, z=10, color="#38bdf8", glow="#10b981", scale=1.15)
boss3d(name="overlord", x=0, y=6.0, z=-14, color="#f43f5e", scale=1.55)
turret3d(name="sentryL", x=-10, y=0.8, z=-4, color="#f59e0b", target="titan")
turret3d(name="sentryR", x=10, y=0.8, z=-4, color="#f59e0b", target="titan")
particles3d(name="sparks", count=750, radius=26, color="#38bdf8", style="float")
camera3d(mode="chase", target="titan", distance=14, height=5.8, fov=58)

int bossHp = 1000
bool firing = false

def firePulse() {
  bossHp = Math.max(0, bossHp - 85)
  sfx2d(preset="laser", volume=0.35)
  setUI("bossBar", "value", bossHp)
  if bossHp <= 0 {
    ui_toast(text="OVERLORD DEFEATED! RESETTING CORE...", type="success")
    bossHp = 1000
    setUI("bossBar", "value", bossHp)
  }
}

ui_progress(id="bossBar", label="OVERLORD CORE", value=1000, max=1000, x=20, y=20, w=300, color="#f43f5e")
ui_button(id="fireBtn", label="FIRE PLASMA CANNON", x=20, y=76, w=200, h=40, color="#38bdf8", onClick="firePulse")

frame?
  float orbitX = Math.sin(time * 0.9) * 9.0
  float orbitY = 6.0 + Math.cos(time * 1.6) * 1.1
  move3d("overlord", orbitX, orbitY, -14)
end`
  },
  {
    id: 'neon_platformer_2d',
    nameRu: '2D Neon Action Platformer',
    nameEn: '2D Neon Action Platformer',
    category: '2d',
    descriptionRu: 'Платформер с параллаксом, физикой, врагами-дронами, стрельбой, динамическим светом и радаром.',
    descriptionEn: 'HiDPI 2D action platformer with parallax layers, AI drones, dynamic 2D lighting & radar minimap.',
    headerParams: {
      name: 'neonRunner2D',
      mode: '2d',
      quality: 'ultra',
      fps: '60',
      shadows: 'false',
      bloom: 'true',
      instancing: 'true',
      culling: 'true'
    },
    drplCode: `// DRPL v2 - 2D Neon Action Platformer
use2d(bg="#060913", gravity=960, lighting=true)
parallax2d(theme="cyber_city", layers=4, speed=1.0)
tilemap2d(floorY=430, tileSize=40, color="#0f172a", accent="#10b981")

platform2d(name="plat1", x=210, y=335, w=160, h=18, color="#1e293b", glow="#38bdf8")
platform2d(name="plat2", x=430, y=260, w=170, h=18, color="#1e293b", glow="#a855f7")

player2d(name="hero", x=100, y=340, speed=290, jump=470, color="#10b981", hp=100)
enemy2d(name="drone1", x=500, y=380, ai="patrol", speed=110, color="#f43f5e", hp=60)
enemy2d(name="drone2", x=480, y=215, ai="hover", speed=90, color="#fb923c", hp=60)

coin2d(name="c1", x=270, y=290, value=25, color="#facc15")
coin2d(name="c2", x=495, y=215, value=25, color="#facc15")
coin2d(name="c3", x=650, y=385, value=50, color="#38bdf8")

light2d(x=120, y=340, radius=190, color="#10b981", intensity=0.55, follow="hero")
camera2d(follow="hero", zoom=1.0, smoothing=0.14)
minimap2d(enabled=true, size=120, position="top-right")

def shootPlasma() {
  float px = get2D("hero", "x", 120)
  float py = get2D("hero", "y", 340)
  int dir = get2D("hero", "facing", 1)
  bullet2d(x=px + 18, y=py + 16, vx=580 * dir, vy=0, color="#38bdf8", radius=5, owner="hero")
  particles2d(x=px + 18, y=py + 16, count=10, color="#38bdf8", speed=140, life=0.35)
  sfx2d(preset="laser", volume=0.3)
}

ui_text(id="controlsHint", text="WASD / Arrows: Move & Jump  |  Click Button or Press F: Fire", x=18, y=16, size=13, color="#e2e8f0")
ui_button(id="fire2DBtn", label="FIRE PLASMA [F]", x=18, y=44, w=155, h=36, color="#38bdf8", onClick="shootPlasma")

key_pressed?{key="f"}
  shootPlasma()
end`
  },
  {
    id: 'pro_telemetry_app',
    nameRu: 'Pro Studio Synth & Telemetry App',
    nameEn: 'Pro Studio Synth & Telemetry App',
    category: 'app',
    descriptionRu: 'Профессиональное приложение-комбайн с вкладками, живыми графиками, таблицей узлов, 24-полосным анализатором и терминалом.',
    descriptionEn: 'Full interactive app dashboard with tabs, live telemetry charts, node table, 24-band spectrum & console.',
    headerParams: {
      name: 'telemetryStudio',
      mode: 'app',
      quality: 'ultra',
      fps: '60',
      shadows: 'false',
      bloom: 'false',
      instancing: 'true',
      culling: 'true'
    },
    drplCode: `// DRPL v2 - Interactive Studio Application
useapp(title="DRPL Studio Telemetry", bg="#0a0c0e", accent="#10b981")

float simSpeed = 1.0
bool autoPulse = true
string activeTab = "Monitor"
int tickCount = 0

def runDiagnostic() {
  sfx2d(preset="powerup", volume=0.3)
  logTerminal("cli", "[OK] All render & audio pipelines healthy (tick " + tickCount + ")")
  ui_toast(text="Diagnostics Passed (100%)", type="success")
}

ui_card(id="kpi1", title="THROUGHPUT", value="98.4%", subtitle="Zero dropped frames", x=20, y=20, w=195, h=96, accent="#10b981")
ui_card(id="kpi2", title="ACTIVE THREADS", value="16", subtitle="Worker Pool Optimal", x=228, y=20, w=195, h=96, accent="#38bdf8")
ui_gauge(id="loadGauge", label="DSP LOAD", value=42, min=0, max=100, unit="%", x=438, y=14, size=115, color="#10b981")

ui_chart(id="telemetry", title="Real-Time Signal Throughput", values=[28,34,42,38,56,64,58,72,68,78], x=20, y=132, w=402, h=180, color="#10b981", type="area")
ui_spectrum(id="eq24", title="24-Band Synth Visualizer", bars=24, x=438, y=132, w=290, h=180, color="#38bdf8")

ui_slider(id="speedCtrl", label="Signal Frequency", value=1.0, min=0.2, max=3.0, step=0.1, x=20, y=328, w=210, bind="simSpeed")
ui_toggle(id="pulseToggle", label="Live Stream", checked=true, x=248, y=332, bind="autoPulse")
ui_button(id="diagBtn", label="Run Diagnostics", x=438, y=330, w=165, h=38, color="#10b981", onClick="runDiagnostic")

ui_terminal(id="cli", title="System Console", lines=["[BOOT] DRPL App Runtime Ready", "[NET] Telemetry pipeline synced"], x=20, y=384, w=402, h=132)
ui_table(id="nodes", title="Subsystems", columns=["Module","Load","State"], rows=[["WebGL2","18%","OK"],["AudioDSP","24%","OK"],["Physics","9%","OK"]], x=438, y=384, w=290)

frame?
  tickCount = tickCount + 1
  if autoPulse and (tickCount % 6 == 0) {
    float wave = 50 + Math.sin(time * 2.5 * simSpeed) * 32 + Math.cos(time * 4.1) * 10
    int rounded = Math.max(8, Math.min(98, Math.round(wave)))
    pushChart("telemetry", rounded, 16)
    setUI("loadGauge", "value", rounded)
    setUI("kpi1", "value", rounded + ".2%")
  }
end`
  },
  {
    id: 'polyglot_oop_3d',
    nameRu: 'Polyglot OOP 3D (Java+C#+Py+C++)',
    nameEn: 'Polyglot OOP 3D (Java+C#+Py+C++)',
    category: '3d',
    descriptionRu: 'Демонстрация гибридного синтаксиса: классы C#/Java, def из Python, типы C++ и живые 3D-фигуры (пирамида, капсула, кристалл).',
    descriptionEn: 'Hybrid polyglot showcase combining C#/Java classes, Python loops/def, C++ headers and 3D primitives.',
    headerParams: {
      name: 'polyglotForge',
      mode: '3d',
      quality: 'ultra',
      fps: '60',
      shadows: 'true',
      bloom: 'true',
      instancing: 'true',
      culling: 'true'
    },
    drplCode: `// Hybrid Polyglot DRPL: Java + C# + Python + C++ + EPL
using System;
#include <math>

use3d(lighting="studio", bloom=1.2, shadows=true, fog=true)
sky3d(style="grid_horizon", stars=850, speed=0.8)
grid3d(name="editorGrid", size=80, divisions=40, color="#10b981")
plane3d(name="floor1", x=0, y=-0.02, z=0, w=60, d=60, color="#0d1320")

public class CrystalForge {
  def __init__(self, count) {
    self.count = count
  }

  public void buildRing() {
    for i in range(6) {
      float ang = (i / 6.0) * 6.283
      double rx = Math.cos(ang) * 7.5
      double rz = Math.sin(ang) * 7.5
      pyramid3d(name="spire_" + i, x=rx, y=1.3, z=rz, radius=1.1, h=2.6, color="#ff6b35")
    }
  }
}

let forge = new CrystalForge(6)
forge.buildRing()

icosahedron3d(name="coreCrystal", x=0, y=2.6, z=0, radius=1.45, color="#c084fc", emissive=true)
capsule3d(name="podLeft", x=-3.8, y=1.5, z=2.5, radius=0.65, h=1.4, color="#a78bfa")
cylinder3d(name="pillarRight", x=3.8, y=1.5, z=2.5, radius=0.85, h=3.0, color="#f59e0b")
torus3d(name="haloRing", x=0, y=2.6, z=0, radius=2.7, color="#ec4899", emissive=true)
spin3d(target="coreCrystal", x=0.4, y=1.8, z=0.3)
spin3d(target="haloRing", x=1.2, y=0.8, z=0.5)

ui_badge(id="langBadge", text="POLYGLOT OOP • JAVA + C# + PY + C++", x=18, y=18, color="#10b981")
ui_text(id="hint3d", text="Drag orbit or toggle Edit Visual to move/add shapes", x=18, y=54, size=13, color="#cbd5e1")`
  },
  {
    id: 'shapes_sandbox_2d',
    nameRu: '2D Shapes & Physics Sandbox',
    nameEn: '2D Shapes & Physics Sandbox',
    category: '2d',
    descriptionRu: 'Песочница геометрических 2D-фигур: блоки, треугольники, круги, полигоны, капсулы, спрайты и погода.',
    descriptionEn: '2D geometric primitives sandbox with blocks, triangles, circles, polygons, sprites and weather.',
    headerParams: {
      name: 'sandbox2d',
      mode: '2d',
      quality: 'ultra',
      fps: '60',
      shadows: 'false',
      bloom: 'true',
      instancing: 'true',
      culling: 'true'
    },
    drplCode: `// DRPL 2D Shapes & Visual Sandbox
use2d(bg="#060913", gravity=920, lighting=true)
tilemap2d(floorY=410, tileSize=40, color="#0f172a", accent="#10b981")
weather2d(type="embers", density=50, color="#38bdf8")

rect2d(name="block1", x=120, y=280, w=100, h=64, color="#38bdf8", border="#bae6fd")
triangle2d(name="ramp1", x=270, y=280, w=72, h=64, color="#f97316")
circle2d(name="orb1", x=395, y=240, radius=34, color="#a855f7", glow="#f0abfc")
polygon2d(name="hex1", x=510, y=195, radius=36, sides=6, color="#ec4899", spin=1.4)
capsule2d(name="pad1", x=260, y=170, w=110, h=32, color="#818cf8")
sprite2d(name="rocket1", icon="rocket", x=150, y=145, w=48, h=48, color="#34d399")
line2d(name="bridge1", x=180, y=360, w=260, h=6, color="#2dd4bf")

player2d(name="hero", x=70, y=320, speed=280, jump=460, color="#10b981", hp=100)
light2d(x=120, y=320, radius=210, color="#10b981", intensity=0.55, follow="hero")
camera2d(follow="hero", zoom=1.0, smoothing=0.14)

ui_badge(id="mode2dBadge", text="2D PRIMITIVES SANDBOX", x=18, y=16, color="#14b8a6")`
  }
];
