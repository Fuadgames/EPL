export type DrplSeverity = 'error' | 'warning';

export interface DrplDiagnostic {
  line: number;
  message: string;
  severity: DrplSeverity;
}

export interface DrplTranspileResult {
  jsCode: string;
  diagnostics: DrplDiagnostic[];
}

export interface DrplRenderStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  entities3d: number;
  entities2d: number;
  uiWidgets: number;
  instancedCount: number;
  culledCount: number;
  mode: string;
  backend: 'webgl2' | 'canvas2d' | 'hud' | 'software-gl';
}

const FORBIDDEN_IDENTIFIERS = [
  'window',
  'document',
  'globalThis',
  'top',
  'parent',
  'frames',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'eval',
  'Function',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'navigator',
  'location',
  'history',
  'importScripts',
  '__proto__',
  'constructor'
];

/**
 * Strips strings/comments temporarily so structural replacements don't corrupt string literals.
 */
function maskStringsAndComments(source: string): {
  masked: string;
  strings: string[];
} {
  const strings: string[] = [];
  let out = '';
  let i = 0;

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    // Single-line comment // or #
    if ((ch === '/' && next === '/') || ch === '#') {
      const end = source.indexOf('\n', i);
      if (end === -1) break;
      i = end;
      continue;
    }

    // Multi-line comment /* ... */
    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end === -1) break;
      i = end + 2;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      let literal = quote;
      i++;
      while (i < source.length) {
        const c = source[i];
        literal += c;
        if (c === '\\' && i + 1 < source.length) {
          i++;
          literal += source[i];
          i++;
          continue;
        }
        if (c === quote) {
          i++;
          break;
        }
        i++;
      }
      const tokenIdx = strings.length;
      strings.push(literal);
      out += `__STR_${tokenIdx}__`;
      continue;
    }

    out += ch;
    i++;
  }

  return { masked: out, strings };
}

function unmaskStrings(code: string, strings: string[]): string {
  return code.replace(/__STR_(\d+)__/g, (_, idx) => strings[Number(idx)] ?? '""');
}

/**
 * Converts Python/C#/C++/Java/JS/EPL named-argument function calls like:
 *   car3d(name="racer", x=0, y=0.6, neon=true)
 * into clean runtime calls:
 *   rt.call("car3d", { name: "racer", x: 0, y: 0.6, neon: true })
 */
const DRPL_COMPONENT_FN_NAMES = new Set([
  // 3D
  'use3d', 'sky3d', 'light3d', 'terrain3d', 'water3d', 'car3d', 'mecha3d', 'boss3d',
  'trees3d', 'city3d', 'asteroids3d', 'portal3d', 'box3d', 'sphere3d', 'cylinder3d',
  'torus3d', 'pyramid3d', 'cone3d', 'capsule3d', 'plane3d', 'icosahedron3d', 'ring3d',
  'text3d', 'grid3d', 'spin3d', 'rigidbody3d', 'fog3d',
  'pickup3d', 'turret3d', 'particles3d', 'camera3d', 'move3d', 'rotate3d',
  'scale3d', 'projectile3d', 'dragon3d', 'forest3d', 'character3d',
  'raycast3d', 'hologram3d', 'checkpoint3d', 'platform3d', 'bouncepad3d', 'trail3d', 'shake3d',
  // 2D
  'use2d', 'parallax2d', 'tilemap2d', 'player2d', 'enemy2d', 'platform2d', 'bullet2d',
  'coin2d', 'laser2d', 'particles2d', 'light2d', 'floater2d', 'camera2d', 'minimap2d', 'sfx2d',
  'move2d', 'rect2d', 'triangle2d', 'circle2d', 'polygon2d', 'line2d', 'capsule2d', 'sprite2d', 'weather2d',
  'spawner2d', 'checkpoint2d', 'spring2d', 'hazard2d', 'shield2d', 'dialog2d', 'tween2d',
  // App / UI / Polyglot OOP Data
  'useapp', 'ui_card', 'ui_chart', 'ui_gauge', 'ui_button', 'ui_slider', 'ui_toggle',
  'ui_progress', 'ui_tabs', 'ui_table', 'ui_terminal', 'ui_spectrum', 'ui_toast', 'ui_input',
  'ui_text', 'ui_badge', 'ui_avatar', 'ui_code', 'ui_modal', 'ui_inventory', 'ui_statbar',
  'ui_timer', 'ui_chat', 'ui_grid', 'synth_music', 'storage_save', 'state_store', 'event_bus'
]);

const DRPL_HELPER_FN_NAMES = new Set([
  'setUI', 'getUI', 'pushChart', 'logTerminal', 'setVar', 'getVar', 'getProp', 'get2D',
  'shake', 'playSfx', 'distance3d', 'lerp', 'clamp', 'rand', 'randInt',
  'print', 'vec2', 'vec3', 'emit', 'onEvent', 'storage_load'
]);

function splitTopLevelArgs(argText: string): string[] {
  const args: string[] = [];
  let curr = '';
  let paren = 0;
  let bracket = 0;
  let brace = 0;

  for (let i = 0; i < argText.length; i++) {
    const c = argText[i];
    if (c === '(') paren++;
    else if (c === ')') paren--;
    else if (c === '[') bracket++;
    else if (c === ']') bracket--;
    else if (c === '{') brace++;
    else if (c === '}') brace--;

    if (c === ',' && paren === 0 && bracket === 0 && brace === 0) {
      if (curr.trim()) args.push(curr.trim());
      curr = '';
    } else {
      curr += c;
    }
  }
  if (curr.trim()) args.push(curr.trim());
  return args;
}

function transformCallArguments(argsStr: string, isComponentFn: boolean): string {
  const args = splitTopLevelArgs(argsStr);
  if (args.length === 0) {
    return isComponentFn ? '{}' : '';
  }

  // Check if arguments use named syntax: key=value (excluding ==, >=, <=, !=, =>)
  const namedEntries: string[] = [];
  const positionalArgs: string[] = [];
  let hasNamed = false;

  for (const a of args) {
    const eqMatch = a.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=(?!=|>)\s*([\s\S]+)$/);
    if (eqMatch) {
      hasNamed = true;
      namedEntries.push(`${eqMatch[1]}: ${eqMatch[2].trim()}`);
    } else {
      positionalArgs.push(a);
    }
  }

  if (isComponentFn) {
    if (hasNamed && positionalArgs.length === 0) {
      return `{ ${namedEntries.join(', ')} }`;
    }
    if (hasNamed && positionalArgs.length > 0) {
      return `{ _args: [${positionalArgs.join(', ')}], ${namedEntries.join(', ')} }`;
    }
    // Single object literal already passed
    if (positionalArgs.length === 1 && positionalArgs[0].startsWith('{')) {
      return positionalArgs[0];
    }
    return `{ _args: [${positionalArgs.join(', ')}] }`;
  }

  if (hasNamed) {
    const obj = `{ ${namedEntries.join(', ')} }`;
    return positionalArgs.length > 0 ? `${positionalArgs.join(', ')}, ${obj}` : obj;
  }
  return positionalArgs.join(', ');
}

function transformDrplCalls(code: string): string {
  let out = '';
  let i = 0;

  while (i < code.length) {
    // Match identifier followed by '('
    const slice = code.slice(i);
    const idMatch = slice.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
    if (idMatch) {
      const fnName = idMatch[1];
      const prevChar = i > 0 ? code[i - 1] : '';
      const isMethodAccess = prevChar === '.';
      const isDecl = /\b(def|fn|func|function|void|int|float|double|bool|string)\s+$/.test(
        code.slice(Math.max(0, i - 16), i)
      );

      if (!isMethodAccess && !isDecl && (DRPL_COMPONENT_FN_NAMES.has(fnName) || DRPL_HELPER_FN_NAMES.has(fnName))) {
        const openParenPos = i + idMatch[0].length - 1;
        let depth = 1;
        let j = openParenPos + 1;
        while (j < code.length && depth > 0) {
          if (code[j] === '(') depth++;
          else if (code[j] === ')') depth--;
          j++;
        }
        const innerArgs = code.slice(openParenPos + 1, j - 1);
        const transformedInner = transformDrplCalls(innerArgs);
        if (DRPL_COMPONENT_FN_NAMES.has(fnName)) {
          const argObj = transformCallArguments(transformedInner, true);
          out += `rt.spawn("${fnName}", ${argObj})`;
        } else {
          const fnArgs = transformCallArguments(transformedInner, false);
          out += `rt.${fnName}(${fnArgs})`;
        }
        i = j;
        continue;
      }
    }

    out += code[i];
    i++;
  }

  return out;
}

function parseInlineParams(settingsStr: string): Record<string, string> {
  const res: Record<string, string> = {};
  if (!settingsStr) return res;
  const parts = settingsStr.split(',');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) res[k] = v;
  }
  return res;
}

export function transpileDRPL(source: string): DrplTranspileResult {
  const diagnostics: DrplDiagnostic[] = [];
  if (!source || !source.trim()) {
    return { jsCode: '', diagnostics };
  }

  const { masked, strings } = maskStringsAndComments(source);

  // Check forbidden globals in masked source
  const rawLines = masked.split('\n');
  for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx++) {
    const line = rawLines[lineIdx];
    for (const forbidden of FORBIDDEN_IDENTIFIERS) {
      const re = new RegExp(`\\b${forbidden}\\b`);
      if (re.test(line)) {
        diagnostics.push({
          line: lineIdx + 1,
          message: `Security sandbox: "${forbidden}" is restricted inside DRPL. Use DRPL components and runtime helpers instead.`,
          severity: 'error'
        });
      }
    }
  }

  if (diagnostics.some(d => d.severity === 'error')) {
    return { jsCode: '', diagnostics };
  }

  // Compatibility analysis across DRPL components (non-blocking warnings)
  const threeDWorldNames = new Set([
    'sky3d', 'light3d', 'terrain3d', 'water3d', 'car3d', 'mecha3d', 'boss3d',
    'trees3d', 'city3d', 'asteroids3d', 'portal3d', 'box3d', 'sphere3d', 'cylinder3d',
    'torus3d', 'pyramid3d', 'cone3d', 'capsule3d', 'plane3d', 'icosahedron3d', 'ring3d',
    'text3d', 'grid3d', 'spin3d', 'rigidbody3d', 'fog3d',
    'pickup3d', 'turret3d', 'particles3d', 'camera3d', 'move3d', 'rotate3d',
    'scale3d', 'projectile3d', 'dragon3d', 'forest3d', 'character3d',
    'raycast3d', 'hologram3d', 'checkpoint3d', 'platform3d', 'bouncepad3d', 'trail3d', 'shake3d'
  ]);
  const twoDWorldNames = new Set([
    'parallax2d', 'tilemap2d', 'player2d', 'enemy2d', 'platform2d', 'bullet2d',
    'coin2d', 'laser2d', 'particles2d', 'light2d', 'floater2d', 'camera2d', 'minimap2d', 'move2d',
    'rect2d', 'triangle2d', 'circle2d', 'polygon2d', 'line2d', 'capsule2d', 'sprite2d', 'weather2d',
    'spawner2d', 'checkpoint2d', 'spring2d', 'hazard2d', 'shield2d', 'dialog2d', 'tween2d'
  ]);
  let hasUse3d = false;
  let hasUse2d = false;
  let first3dLine = -1;
  let first3dName = '';
  let first2dLine = -1;
  let first2dName = '';

  const callScanRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
  for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx++) {
    const line = rawLines[lineIdx];
    let m: RegExpExecArray | null;
    callScanRegex.lastIndex = 0;
    while ((m = callScanRegex.exec(line)) !== null) {
      const fn = m[1];
      if (fn === 'use3d') {
        hasUse3d = true;
        if (first3dLine === -1) {
          first3dLine = lineIdx + 1;
          first3dName = fn;
        }
      } else if (fn === 'use2d') {
        hasUse2d = true;
        if (first2dLine === -1) {
          first2dLine = lineIdx + 1;
          first2dName = fn;
        }
      } else if (threeDWorldNames.has(fn) && first3dLine === -1) {
        first3dLine = lineIdx + 1;
        first3dName = fn;
      } else if (twoDWorldNames.has(fn) && first2dLine === -1) {
        first2dLine = lineIdx + 1;
        first2dName = fn;
      }
    }
  }

  if ((hasUse3d || first3dLine !== -1) && (hasUse2d || first2dLine !== -1)) {
    diagnostics.push({
      line: Math.max(first3dLine, first2dLine, 1),
      message: `3D + 2D conflict: "${first3dName || 'use3d'}" and "${first2dName || 'use2d'}" should not be mixed directly (combine 3D + ui_*/sfx2d OR 2D + ui_*/sfx2d, or use mode="hybrid").`,
      severity: 'warning'
    });
  } else {
    if (first3dLine !== -1 && !hasUse3d) {
      diagnostics.push({
        line: first3dLine,
        message: `Missing use3d(): "${first3dName}" works best after initializing use3d(...) at top of the block.`,
        severity: 'warning'
      });
    }
    if (first2dLine !== -1 && !hasUse2d) {
      diagnostics.push({
        line: first2dLine,
        message: `Missing use2d(): "${first2dName}" works best after initializing use2d(...) at top of the block.`,
        severity: 'warning'
      });
    }
  }

  const outputLines: string[] = [];
  const topLevelFns: string[] = [];
  const blockStack: Array<{ kind: 'epl_hook' | 'epl_control' | 'brace'; inClass?: boolean }> = [];
  const isDirectlyInClass = () => blockStack.length > 0 && Boolean(blockStack[blockStack.length - 1].inClass);

  for (let idx = 0; idx < rawLines.length; idx++) {
    let line = rawLines[idx].trim();
    if (!line) continue;

    // Ignore Java/C#/C++ package, using, import, #include headers gracefully
    if (/^(?:package|import|using|#include|namespace)\b/i.test(line)) {
      continue;
    }

    // Strip Java/C#/C++ access & storage modifiers cleanly
    line = line.replace(
      /^(?:(?:public|private|protected|internal|static|final|readonly|virtual|override|abstract|sealed|inline|constexpr)\s+)+/,
      ''
    );

    // Map Java/C# console output to DRPL print()
    line = line
      .replace(/\bConsole\.WriteLine\s*\(/g, 'print(')
      .replace(/\bSystem\.out\.println\s*\(/g, 'print(')
      .replace(/\bnew\s+(?:List|ArrayList|Vector|std::vector)\s*(?:<[^>]*>)?\s*\(\s*\)/g, '[]')
      .replace(/\bnew\s+(?:Dictionary|HashMap|Map|std::map)\s*(?:<[^>]*>)?\s*\(\s*\)/g, '{}');

    // Normalize Python booleans / None / logical operators
    line = line
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null')
      .replace(/\band\b/g, '&&')
      .replace(/\bor\b/g, '||')
      .replace(/\bnot\s+/g, '!');

    // Close EPL-style hook or block (`end`)
    if (line === 'end') {
      const top = blockStack.pop();
      if (top?.kind === 'epl_hook') {
        outputLines.push('});');
      } else {
        outputLines.push('}');
      }
      continue;
    }

    // EPL-style event/lifecycle hooks inside DRPL
    const hookMatch = line.match(
      /^(started\?|frame\?|update\?|render\?|key_pressed\?|clicked\?|timer_tick\?|collided\?)(?:\s*\{([^}]*)\})?\s*$/i
    );
    if (hookMatch) {
      const hook = hookMatch[1].toLowerCase();
      const params = parseInlineParams(hookMatch[2] || '');
      blockStack.push({ kind: 'epl_hook' });
      if (hook === 'started?') {
        outputLines.push('rt.onStart(() => {');
      } else if (hook === 'frame?' || hook === 'update?') {
        outputLines.push('rt.onUpdate((dt, time) => {');
      } else if (hook === 'render?') {
        outputLines.push('rt.onRender((dt, time) => {');
      } else if (hook === 'key_pressed?') {
        const keyExpr = params.key || '__STR_0__';
        outputLines.push(`rt.onKey(${keyExpr}, () => {`);
      } else if (hook === 'clicked?') {
        const targetExpr = params.target || params.name || '""';
        outputLines.push(`rt.onClick(${targetExpr}, () => {`);
      } else if (hook === 'timer_tick?') {
        const sec = params.interval || params.seconds || '1';
        outputLines.push(`rt.onTimer(${sec}, () => {`);
      } else if (hook === 'collided?') {
        const aExpr = params.a || params.target || '"hero"';
        const bExpr = params.b || params.with || '""';
        outputLines.push(`rt.onCollide(${aExpr}, ${bExpr}, () => {`);
      }
      continue;
    }

    // Class / Struct declaration (with optional extends / : BaseClass)
    const classMatch = line.match(
      /^(?:class|struct)\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+(?:extends|:)\s+([a-zA-Z_][a-zA-Z0-9_]*))?\s*(?::|\{)?\s*$/
    );
    if (classMatch) {
      const usesBrace = line.endsWith('{');
      blockStack.push({ kind: usesBrace ? 'brace' : 'epl_control', inClass: true });
      const ext = classMatch[2] ? ` extends ${classMatch[2]}` : '';
      outputLines.push(`class ${classMatch[1]}${ext} {`);
      continue;
    }

    // Convert Python/C#/C++/Java/JS function or method definitions
    const fnDeclMatch = line.match(
      /^(?:def|fn|func|function|void|int|float|double|bool|boolean|string|str|auto|async\s+def|async\s+function)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*(?::|\{)?\s*$/
    );
    if (fnDeclMatch) {
      const fnName = fnDeclMatch[1];
      const inCls = isDirectlyInClass();
      const rawParams = fnDeclMatch[2]
        .split(',')
        .map(p => p.trim().replace(/^(?:int|float|double|bool|boolean|string|str|let|var|auto|final)\s+/, ''))
        .filter(p => Boolean(p) && (!inCls || p !== 'self'))
        .join(', ');
      const usesBrace = line.endsWith('{');
      const wasTopLevel = blockStack.length === 0;
      blockStack.push({ kind: usesBrace ? 'brace' : 'epl_control' });
      if (inCls) {
        const methodName = fnName === '__init__' ? 'constructor' : fnName;
        outputLines.push(`${methodName}(${rawParams}) {`);
      } else {
        if (wasTopLevel) topLevelFns.push(fnName);
        outputLines.push(`function ${fnName}(${rawParams}) {`);
      }
      continue;
    }

    // `elif cond:` or `} else if cond {`
    const elifMatch = line.match(/^(?:\}\s*)?(?:elif|else\s+if)\s+(.+?)\s*(?::|\{|then)?\s*$/);
    if (elifMatch) {
      let cond = elifMatch[1].trim();
      if (!cond.startsWith('(') || !cond.endsWith(')')) cond = `(${cond})`;
      outputLines.push(`} else if ${cond} {`);
      continue;
    }

    // `} else {` or `else:` or `else`
    if (/^(?:\}\s*)?else\s*(?::|\{)?\s*$/.test(line)) {
      outputLines.push('} else {');
      continue;
    }

    // Python / EPL `if cond then` or `if cond:` or `if cond {`
    const ifMatch = line.match(/^if\s+(.+?)\s*(?:then|:|\{)\s*$/);
    if (ifMatch) {
      let cond = ifMatch[1].trim();
      if (!cond.startsWith('(') || !cond.endsWith(')')) cond = `(${cond})`;
      const usesBrace = line.endsWith('{');
      blockStack.push({ kind: usesBrace ? 'brace' : 'epl_control' });
      outputLines.push(`if ${cond} {`);
      continue;
    }

    // Python `for i in range(n)` or `for i in range(start, stop)`
    const rangeMatch = line.match(/^for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+range\(([^)]+)\)\s*(?::|\{)?\s*$/);
    if (rangeMatch) {
      const varName = rangeMatch[1];
      const rangeArgs = rangeMatch[2].split(',').map(s => s.trim());
      const start = rangeArgs.length >= 2 ? rangeArgs[0] : '0';
      const stop = rangeArgs.length >= 2 ? rangeArgs[1] : rangeArgs[0];
      const usesBrace = line.endsWith('{');
      blockStack.push({ kind: usesBrace ? 'brace' : 'epl_control' });
      outputLines.push(`for (let ${varName} = ${start}; ${varName} < ${stop}; ${varName}++) {`);
      continue;
    }

    // Python `for item in iterable:`
    const forInMatch = line.match(/^for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+(.+?)\s*(?::|\{)?\s*$/);
    if (forInMatch) {
      const usesBrace = line.endsWith('{');
      blockStack.push({ kind: usesBrace ? 'brace' : 'epl_control' });
      outputLines.push(`for (const ${forInMatch[1]} of ${forInMatch[2]}) {`);
      continue;
    }

    // `while cond:` or `while cond {`
    const whileMatch = line.match(/^while\s+(.+?)\s*(?::|\{)?\s*$/);
    if (whileMatch) {
      let cond = whileMatch[1].trim();
      if (!cond.startsWith('(') || !cond.endsWith(')')) cond = `(${cond})`;
      const usesBrace = line.endsWith('{');
      blockStack.push({ kind: usesBrace ? 'brace' : 'epl_control' });
      outputLines.push(`while ${cond} {`);
      continue;
    }

    // `repeat times`
    const repeatMatch = line.match(/^repeat\s+(.+?)\s*(?::|\{)?\s*$/);
    if (repeatMatch) {
      const usesBrace = line.endsWith('{');
      blockStack.push({ kind: usesBrace ? 'brace' : 'epl_control' });
      outputLines.push(`for (let __rep = 0; __rep < (${repeatMatch[1]}); __rep++) {`);
      continue;
    }

    // Typed C/C++/Java/C# variable or class field declarations
    if (isDirectlyInClass()) {
      line = line.replace(
        /^(?:int|float|double|bool|boolean|string|str|vec2|vec3|color|auto|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*\s*=)/,
        '$1'
      );
    } else {
      line = line.replace(
        /^(?:int|float|double|bool|boolean|string|str|vec2|vec3|color|auto)\s+([a-zA-Z_][a-zA-Z0-9_]*\s*=)/,
        'let $1'
      );
    }

    // Track standalone braces for balanced diagnostics
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;
    if (openBraces > closeBraces) {
      for (let b = 0; b < openBraces - closeBraces; b++) blockStack.push({ kind: 'brace' });
    } else if (closeBraces > openBraces) {
      for (let b = 0; b < closeBraces - openBraces; b++) {
        if (blockStack.length > 0) blockStack.pop();
      }
    }

    // Allow Python-style `self.prop` inside class methods
    if (blockStack.some(b => b.inClass)) {
      line = line.replace(/\bself\./g, 'this.');
    }

    // Convert DRPL component & helper calls
    line = transformDrplCalls(line);

    outputLines.push(line);
  }

  // Auto-close any dangling blocks gently with a warning
  if (blockStack.length > 0) {
    diagnostics.push({
      line: rawLines.length,
      message: `${blockStack.length} unclosed block(s) — check missing '}' or 'end'.`,
      severity: 'warning'
    });
    while (blockStack.length > 0) {
      const top = blockStack.pop();
      outputLines.push(top?.kind === 'epl_hook' ? '});' : '}');
    }
  }

  for (const fn of topLevelFns) {
    outputLines.push(`if (typeof ${fn} === "function") rt.registerFn("${fn}", ${fn});`);
  }

  const finalJs = unmaskStrings(outputLines.join('\n'), strings);

  // Syntax validation pass using Function constructor (does NOT execute!)
  try {
    // eslint-disable-next-line no-new-func
    new Function('rt', 'Math', `"use strict";\n${finalJs}`);
  } catch (err: any) {
    diagnostics.push({
      line: 1,
      message: `DRPL syntax error: ${err?.message || 'Invalid syntax'}`,
      severity: 'error'
    });
  }

  return {
    jsCode: finalJs,
    diagnostics
  };
}

export function createDrplSandboxFunction(jsCode: string) {
  // Shadow dangerous host globals inside sandbox execution
  // (eval is blocked at transpile time via FORBIDDEN_IDENTIFIERS because strict mode forbids 'eval' as a parameter name)
  // eslint-disable-next-line no-new-func
  return new Function(
    'rt',
    'Math',
    'window',
    'document',
    'globalThis',
    'self',
    'fetch',
    'Function',
    'localStorage',
    'sessionStorage',
    'XMLHttpRequest',
    'WebSocket',
    `"use strict";\n${jsCode}`
  );
}
