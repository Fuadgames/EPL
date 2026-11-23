import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Pause, Play, RotateCcw, Grid, Activity, AlertTriangle, Trash2, Plus, Move } from 'lucide-react';
import { clsx } from 'clsx';
import {
  transpileDRPL,
  createDrplSandboxFunction,
  type DrplRenderStats
} from '../lib/drpl-engine';

export interface VisualPatchEvent {
  type: 'add' | 'update' | 'delete';
  mode: '3d' | '2d';
  name: string;
  kind: string;
  props: Record<string, any>;
}

export interface SelectedVisualEntity {
  mode: '3d' | '2d';
  name: string;
  kind: string;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  radius: number;
  scale: number;
  color: string;
}

interface DifrenoptViewportProps {
  entity: {
    id: string;
    name?: string;
    mode?: string;
    quality?: string;
    fps?: number | string;
    shadows?: boolean | string;
    bloom?: boolean | string;
    instancing?: boolean | string;
    culling?: boolean | string;
    drplCode?: string;
    [key: string]: any;
  };
  variables?: Record<string, any>;
  onEvent?: (eventName: string, target?: string, value?: string) => void;
  isMuted?: boolean;
  editMode?: boolean;
  onVisualPatch?: (patch: VisualPatchEvent) => void;
}

interface UiWidgetState {
  id: string;
  kind:
    | 'ui_card'
    | 'ui_chart'
    | 'ui_gauge'
    | 'ui_button'
    | 'ui_slider'
    | 'ui_toggle'
    | 'ui_progress'
    | 'ui_tabs'
    | 'ui_table'
    | 'ui_terminal'
    | 'ui_spectrum'
    | 'ui_input'
    | 'ui_text'
    | 'ui_badge'
    | 'ui_avatar'
    | 'ui_code'
    | 'ui_modal'
    | 'ui_inventory'
    | 'ui_statbar'
    | 'ui_timer'
    | 'ui_chat'
    | 'ui_grid';
  props: Record<string, any>;
}

interface ToastItem {
  id: number;
  text: string;
  type: 'success' | 'info' | 'warn';
}

interface Entity2D {
  name: string;
  kind:
    | 'player'
    | 'enemy'
    | 'platform'
    | 'coin'
    | 'rect'
    | 'triangle'
    | 'circle'
    | 'polygon'
    | 'line'
    | 'capsule'
    | 'sprite'
    | 'checkpoint'
    | 'spring'
    | 'hazard';
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  speed: number;
  jump: number;
  color: string;
  glow?: string;
  border?: string;
  radius?: number;
  sides?: number;
  spin?: number;
  angle?: number;
  icon?: string;
  hp: number;
  maxHp: number;
  ai?: string;
  value?: number;
  facing: number;
  grounded: boolean;
  startX: number;
  startY: number;
  collected?: boolean;
}

interface Bullet2D {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  owner: string;
  life: number;
}

interface Laser2D {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  life: number;
  maxLife: number;
}

interface Particle2D {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

interface Light2D {
  x: number;
  y: number;
  radius: number;
  color: string;
  intensity: number;
  follow?: string;
}

interface Floater2D {
  text: string;
  x: number;
  y: number;
  color: string;
  life: number;
}

const toBool = (val: any, fallback = false): boolean => {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'boolean') return val;
  return String(val).toLowerCase() !== 'false' && String(val) !== '0';
};

const toNum = (val: any, fallback: number): number => {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
};

export default function DifrenoptViewport({
  entity,
  variables = {},
  onEvent,
  isMuted = false,
  editMode = false,
  onVisualPatch
}: DifrenoptViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvas2dRef = useRef<HTMLCanvasElement>(null);
  const webglContainerRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const editModeRef = useRef(Boolean(editMode));
  editModeRef.current = Boolean(editMode);
  const onVisualPatchRef = useRef(onVisualPatch);
  onVisualPatchRef.current = onVisualPatch;
  const saved3DCamRef = useRef<{ pos: [number, number, number]; target: [number, number, number] } | null>(null);

  const [selectedEntity, setSelectedEntity] = useState<SelectedVisualEntity | null>(null);
  const selectedEntityRef = useRef<SelectedVisualEntity | null>(null);
  selectedEntityRef.current = selectedEntity;

  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  const [wireframe, setWireframe] = useState(false);
  const wireframeRef = useRef(false);
  wireframeRef.current = wireframe;

  const [showInspector, setShowInspector] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<UiWidgetState[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [appMeta, setAppMeta] = useState<{ title?: string; bg?: string; accent?: string }>({});
  const [stats, setStats] = useState<DrplRenderStats>({
    fps: 60,
    drawCalls: 0,
    triangles: 0,
    entities3d: 0,
    entities2d: 0,
    uiWidgets: 0,
    instancedCount: 0,
    culledCount: 0,
    mode: String(entity.mode || '3d'),
    backend: 'webgl2'
  });

  // References to live engine callbacks for interactive HUD & camera reset & visual editing
  const runtimeControlsRef = useRef<{
    invokeFn: (name: string) => void;
    setBoundVar: (varName: string, val: any) => void;
    updateWidgetProp: (id: string, prop: string, val: any) => void;
    resetCamera: () => void;
    toggleWireframe: (enabled: boolean) => void;
    syncSelectedFromProps: (next: SelectedVisualEntity) => void;
    clearSelection: () => void;
  }>({
    invokeFn: () => {},
    setBoundVar: () => {},
    updateWidgetProp: () => {},
    resetCamera: () => {},
    toggleWireframe: () => {},
    syncSelectedFromProps: () => {},
    clearSelection: () => {}
  });

  const playProceduralSfx = useCallback((preset = 'click', volume = 0.3) => {
    if (isMutedRef.current || typeof window === 'undefined') return;
    try {
      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtor) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtor();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const vol = Math.max(0.02, Math.min(0.6, volume));
      const p = preset.toLowerCase();

      if (p.includes('coin')) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(980, now);
        osc.frequency.setValueAtTime(1320, now + 0.06);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (p.includes('laser')) {
        osc.type = 'square';
        osc.frequency.setValueAtTime(860, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.11);
        gain.gain.setValueAtTime(vol * 0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (p.includes('jump')) {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(540, now + 0.13);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.14);
      } else if (p.includes('explos') || p.includes('hit')) {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.24);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (p.includes('power')) {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(660, now + 0.07);
        osc.frequency.setValueAtTime(880, now + 0.14);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(620, now);
        osc.frequency.exponentialRampToValueAtTime(420, now + 0.06);
        gain.gain.setValueAtTime(vol * 0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc.start(now);
        osc.stop(now + 0.07);
      }
    } catch {
      // ignore blocked audio context
    }
  }, []);

  const drplCode = String(entity.drplCode || '');
  const headerMode = String(entity.mode || '3d').toLowerCase();
  const headerQuality = String(entity.quality || 'ultra').toLowerCase();
  const headerShadows = toBool(entity.shadows, true);
  const headerBloom = toBool(entity.bloom, true);
  const headerCulling = toBool(entity.culling, true);
  const headerTargetFps = Math.max(15, Math.min(120, toNum(entity.fps, 60)));

  useEffect(() => {
    runtimeControlsRef.current.toggleWireframe(wireframe);
  }, [wireframe]);

  useEffect(() => {
    if (!editMode) {
      setSelectedEntity(null);
      runtimeControlsRef.current.clearSelection();
    }
  }, [editMode]);

  useEffect(() => {
    setRuntimeError(null);
    setWidgets([]);
    setToasts([]);
    setAppMeta({});

    const transpiled = transpileDRPL(drplCode);
    const fatalDiag = transpiled.diagnostics.find(d => d.severity === 'error');
    if (fatalDiag) {
      setRuntimeError(`Line ${fatalDiag.line}: ${fatalDiag.message}`);
      return;
    }

    // Engine state shared across 3D, 2D and UI systems
    const vars: Record<string, any> = { ...variables };
    const fnMap = new Map<string, (...args: any[]) => any>();
    const startHooks: Array<() => void> = [];
    const updateHooks: Array<(dt: number, time: number) => void> = [];
    const renderHooks: Array<(dt: number, time: number) => void> = [];
    const keyHooks = new Map<string, Array<() => void>>();
    const clickHooks = new Map<string, Array<() => void>>();
    const timerHooks: Array<{ interval: number; elapsed: number; fn: () => void }> = [];
    const eventBusHooks = new Map<string, Array<(payload?: any) => void>>();
    const keysPressed = new Set<string>();

    // UI Widget store
    const widgetMap = new Map<string, UiWidgetState>();
    let uiDirty = true;

    const pushToast = (text: string, type: 'success' | 'info' | 'warn' = 'info') => {
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev.slice(-3), { id, text, type }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 2800);
    };

    // Detect what render backends are requested
    let wants3D = headerMode === '3d' || headerMode === 'hybrid';
    let wants2D = headerMode === '2d' || headerMode === 'hybrid';
    let wantsApp = headerMode === 'app';

    if (/\b(use3d|sky3d|terrain3d|water3d|car3d|mecha3d|boss3d|trees3d|city3d|asteroids3d|portal3d|box3d|sphere3d|pyramid3d|cone3d|cylinder3d|torus3d|capsule3d|plane3d|icosahedron3d|ring3d|text3d|grid3d|camera3d|raycast3d|hologram3d|checkpoint3d|platform3d|bouncepad3d|trail3d|shake3d)\b/.test(drplCode)) {
      wants3D = true;
    }
    if (/\b(use2d|parallax2d|tilemap2d|player2d|enemy2d|platform2d|coin2d|camera2d|rect2d|triangle2d|circle2d|polygon2d|line2d|capsule2d|sprite2d|weather2d|spawner2d|checkpoint2d|spring2d|hazard2d|shield2d|dialog2d|tween2d)\b/.test(drplCode)) {
      wants2D = true;
    }
    void wantsApp;

    // ====================== 3D SUBSYSTEM ======================
    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let controls: OrbitControls | null = null;
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    let pmremGenerator: THREE.PMREMGenerator | null = null;
    let envRenderTarget: THREE.WebGLRenderTarget | null = null;
    let roomEnv: RoomEnvironment | null = null;
    let dirLight: THREE.DirectionalLight | null = null;
    let isSoftwareGl = false;

    const objects3D = new Map<string, { root: THREE.Object3D; meta: Record<string, any> }>();
    const disposableGeos: THREE.BufferGeometry[] = [];
    const disposableMats: THREE.Material[] = [];
    const disposableTex: THREE.Texture[] = [];
    const animatedUpdaters3D: Array<(dt: number, elapsed: number) => void> = [];
    let camera3DConfig: Record<string, any> = {
      mode: 'orbit',
      target: '',
      distance: 14,
      height: 5.5,
      fov: 58
    };
    let instancedEntityCount = 0;
    let culledCount = 0;

    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      disposableGeos.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      disposableMats.push(m);
      return m;
    };

    const init3DBackend = (opts: Record<string, any> = {}) => {
      if (renderer || !webglContainerRef.current) return;
      const container = webglContainerRef.current;
      const width = Math.max(240, container.clientWidth || 640);
      const height = Math.max(180, container.clientHeight || 420);

      renderer = new THREE.WebGLRenderer({
        antialias: headerQuality !== 'perf',
        powerPreference: 'high-performance',
        alpha: false
      });

      try {
        const gl = renderer.getContext();
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        const unmasked = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
        isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(unmasked);
      } catch {
        isSoftwareGl = false;
      }

      const dprCap = isSoftwareGl ? 1 : headerQuality === 'ultra' ? 2 : 1.5;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
      renderer.setSize(width, height);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.shadowMap.enabled = !isSoftwareGl && toBool(opts.shadows, headerShadows);
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      scene.background = new THREE.Color('#070b14');
      if (toBool(opts.fog, true)) {
        scene.fog = new THREE.FogExp2('#070b14', 0.0085);
      }

      camera = new THREE.PerspectiveCamera(toNum(camera3DConfig.fov, 58), width / height, 0.2, 420);
      if (saved3DCamRef.current) {
        camera.position.set(...saved3DCamRef.current.pos);
      } else {
        camera.position.set(10, 8, 16);
      }

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.maxPolarAngle = Math.PI * 0.49;
      if (saved3DCamRef.current) {
        controls.target.set(...saved3DCamRef.current.target);
        controls.update();
      }

      // PBR IBL Studio Lighting
      try {
        pmremGenerator = new THREE.PMREMGenerator(renderer);
        roomEnv = new RoomEnvironment();
        envRenderTarget = pmremGenerator.fromScene(roomEnv, 0.04);
        scene.environment = envRenderTarget.texture;
      } catch {
        // Fallback if PMREM unavailable
      }

      const hemi = new THREE.HemisphereLight('#93c5fd', '#0f172a', 0.85);
      scene.add(hemi);

      dirLight = new THREE.DirectionalLight('#f8fafc', 2.2);
      dirLight.position.set(18, 28, 16);
      if (renderer.shadowMap.enabled) {
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.set(1024, 1024);
        dirLight.shadow.camera.near = 2;
        dirLight.shadow.camera.far = 90;
        const bound = 34;
        dirLight.shadow.camera.left = -bound;
        dirLight.shadow.camera.right = bound;
        dirLight.shadow.camera.top = bound;
        dirLight.shadow.camera.bottom = -bound;
      }
      scene.add(dirLight);

      const useBloom = !isSoftwareGl && headerBloom && toNum(opts.bloom, 1.0) > 0;
      if (useBloom) {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        bloomPass = new UnrealBloomPass(
          new THREE.Vector2(width, height),
          Math.min(1.4, Math.max(0.2, toNum(opts.bloom, 0.75) * 0.5)),
          0.45,
          0.72
        );
        composer.addPass(bloomPass);
        composer.addPass(new OutputPass());
      }
    };

    const spawn3DComponent = (kind: string, opts: Record<string, any>) => {
      if (!renderer) init3DBackend(opts);
      if (!scene) return;

      const name = String(opts.name || `${kind}_${objects3D.size + 1}`);
      const colorHex = String(opts.color || '#10b981');

      if (kind === 'use3d') {
        if (opts.bg && scene) scene.background = new THREE.Color(String(opts.bg));
        return;
      }

      if (kind === 'sky3d') {
        const style = String(opts.style || 'cyber_aurora');
        const stars = Math.min(1800, Math.max(100, toNum(opts.stars, 800)));
        const bgColors: Record<string, [string, string]> = {
          cyber_aurora: ['#040b18', '#0d3b46'],
          deep_space: ['#02030a', '#1e1b4b'],
          sunset: ['#1f091d', '#7c2d12'],
          grid_horizon: ['#080b12', '#172554']
        };
        const [topCol, botCol] = bgColors[style] || bgColors.cyber_aurora;
        scene.background = new THREE.Color(topCol);
        if (scene.fog instanceof THREE.FogExp2) scene.fog.color.set(topCol);

        // Starfield
        const pos = new Float32Array(stars * 3);
        for (let i = 0; i < stars; i++) {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(Math.random() * 0.85 + 0.1);
          const r = 135 + Math.random() * 35;
          pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
          pos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 6;
          pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
        }
        const starGeo = trackGeo(new THREE.BufferGeometry());
        starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const starMat = trackMat(
          new THREE.PointsMaterial({
            color: style === 'sunset' ? '#fed7aa' : '#e2e8f0',
            size: 1.15,
            transparent: true,
            opacity: 0.88
          })
        );
        const starPoints = new THREE.Points(starGeo, starMat);
        scene.add(starPoints);

        // Horizon ring glow
        const domeGeo = trackGeo(new THREE.SphereGeometry(180, 24, 16));
        const domeMat = trackMat(
          new THREE.MeshBasicMaterial({ color: botCol, side: THREE.BackSide, transparent: true, opacity: 0.42 })
        );
        scene.add(new THREE.Mesh(domeGeo, domeMat));

        const speed = toNum(opts.speed, 1.0);
        animatedUpdaters3D.push((dt) => {
          starPoints.rotation.y += dt * 0.015 * speed;
        });
        return;
      }

      if (kind === 'light3d') {
        const lType = String(opts.type || 'point');
        const col = String(opts.color || '#38bdf8');
        const intensity = toNum(opts.intensity, 3.0);
        const light =
          lType === 'spot'
            ? new THREE.SpotLight(col, intensity, 60, Math.PI / 5, 0.35)
            : new THREE.PointLight(col, intensity, 50, 1.4);
        light.position.set(toNum(opts.x, 4), toNum(opts.y, 6), toNum(opts.z, 4));
        scene.add(light);
        objects3D.set(name, { root: light, meta: { kind, ...opts } });
        return;
      }

      if (kind === 'terrain3d') {
        const size = Math.min(240, Math.max(40, toNum(opts.size, 120)));
        const maxH = toNum(opts.height, 3.5);
        const segs = isSoftwareGl ? 32 : 64;
        const geo = trackGeo(new THREE.PlaneGeometry(size, size, segs, segs));
        geo.rotateX(-Math.PI / 2);

        const posAttr = geo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          const vx = posAttr.getX(i);
          const vz = posAttr.getZ(i);
          // Flat center track for driving/arena, rising procedural hills around edges
          const distCenter = Math.sqrt(vx * vx + vz * vz);
          const mask = Math.min(1, Math.max(0, (distCenter - 14) / 28));
          const h =
            (Math.sin(vx * 0.08) * Math.cos(vz * 0.08) +
              Math.sin(vx * 0.19 + vz * 0.14) * 0.5) *
            maxH *
            mask;
          posAttr.setY(i, h);
        }
        geo.computeVertexNormals();

        const mat = trackMat(
          new THREE.MeshStandardMaterial({
            color: String(opts.color || '#0f172a'),
            roughness: 0.78,
            metalness: 0.18
          })
        );
        const terrain = new THREE.Mesh(geo, mat);
        terrain.receiveShadow = true;
        scene.add(terrain);

        // Crisp neon wireframe grid overlay
        const gridColor = String(opts.wireColor || '#10b981');
        const wireMat = trackMat(
          new THREE.MeshBasicMaterial({
            color: gridColor,
            wireframe: true,
            transparent: true,
            opacity: 0.18
          })
        );
        const wireOverlay = new THREE.Mesh(geo, wireMat);
        wireOverlay.position.y = 0.03;
        scene.add(wireOverlay);
        objects3D.set(name, { root: terrain, meta: { kind, ...opts } });
        return;
      }

      if (kind === 'water3d') {
        const size = Math.min(240, Math.max(30, toNum(opts.size, 120)));
        const segs = isSoftwareGl ? 24 : 44;
        const geo = trackGeo(new THREE.PlaneGeometry(size, size, segs, segs));
        geo.rotateX(-Math.PI / 2);
        const basePos = new Float32Array(geo.attributes.position.array);
        const mat = trackMat(
          new THREE.MeshStandardMaterial({
            color: String(opts.color || '#0284c7'),
            roughness: 0.15,
            metalness: 0.65,
            transparent: true,
            opacity: 0.78
          })
        );
        const water = new THREE.Mesh(geo, mat);
        water.position.y = toNum(opts.y, -1.2);
        scene.add(water);
        const waveAmp = toNum(opts.wave, 0.35);
        animatedUpdaters3D.push((_, elapsed) => {
          const p = geo.attributes.position;
          for (let i = 0; i < p.count; i++) {
            const bx = basePos[i * 3];
            const bz = basePos[i * 3 + 2];
            p.setY(i, Math.sin(bx * 0.25 + elapsed * 2.1) * Math.cos(bz * 0.2 + elapsed * 1.6) * waveAmp);
          }
          p.needsUpdate = true;
          geo.computeVertexNormals();
        });
        objects3D.set(name, { root: water, meta: { kind, ...opts } });
        return;
      }

      if (kind === 'trees3d' || kind === 'forest3d') {
        const count = Math.min(isSoftwareGl ? 100 : 400, Math.max(10, toNum(opts.count, 160)));
        const rad = toNum(opts.radius, 60);
        const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.28, 1.4, 7));
        const trunkMat = trackMat(new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.9 }));
        const crownGeo = trackGeo(new THREE.ConeGeometry(1.15, 2.9, 8));
        const crownMat = trackMat(
          new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorHex,
            emissiveIntensity: 0.22,
            roughness: 0.55
          })
        );
        const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
        const crowns = new THREE.InstancedMesh(crownGeo, crownMat, count);
        trunks.castShadow = true;
        crowns.castShadow = true;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 16 + Math.random() * (rad - 16);
          const x = Math.cos(angle) * dist;
          const z = Math.sin(angle) * dist;
          const scale = 0.8 + Math.random() * 0.9;
          dummy.position.set(x, 0.7 * scale, z);
          dummy.scale.set(scale, scale, scale);
          dummy.updateMatrix();
          trunks.setMatrixAt(i, dummy.matrix);

          dummy.position.set(x, 2.3 * scale, z);
          dummy.updateMatrix();
          crowns.setMatrixAt(i, dummy.matrix);
        }
        trunks.instanceMatrix.needsUpdate = true;
        crowns.instanceMatrix.needsUpdate = true;
        scene.add(trunks, crowns);
        instancedEntityCount += count;
        objects3D.set(name, { root: crowns, meta: { kind, count } });
        return;
      }

      if (kind === 'city3d') {
        const count = Math.min(isSoftwareGl ? 80 : 250, Math.max(12, toNum(opts.count, 110)));
        const spread = toNum(opts.spread, 75);
        const maxH = toNum(opts.maxHeight, 24);
        const bGeo = trackGeo(new THREE.BoxGeometry(1, 1, 1));
        const bMat = trackMat(
          new THREE.MeshStandardMaterial({
            color: String(opts.color || '#111827'),
            roughness: 0.4,
            metalness: 0.7
          })
        );
        const rGeo = trackGeo(new THREE.BoxGeometry(1.03, 0.18, 1.03));
        const neonCol = String(opts.neon || '#38bdf8');
        const rMat = trackMat(
          new THREE.MeshStandardMaterial({
            color: neonCol,
            emissive: neonCol,
            emissiveIntensity: 1.6
          })
        );

        const buildings = new THREE.InstancedMesh(bGeo, bMat, count);
        const roofs = new THREE.InstancedMesh(rGeo, rMat, count);
        buildings.castShadow = true;
        buildings.receiveShadow = true;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < count; i++) {
          let x = (Math.random() - 0.5) * spread * 2;
          let z = (Math.random() - 0.5) * spread * 2;
          // Keep central arena clear
          if (Math.abs(x) < 18 && Math.abs(z) < 18) {
            x += x >= 0 ? 20 : -20;
          }
          const w = 2.4 + Math.random() * 3.8;
          const d = 2.4 + Math.random() * 3.8;
          const h = 5 + Math.random() * maxH;

          dummy.position.set(x, h / 2, z);
          dummy.scale.set(w, h, d);
          dummy.updateMatrix();
          buildings.setMatrixAt(i, dummy.matrix);

          dummy.position.set(x, h + 0.1, z);
          dummy.scale.set(w, 1, d);
          dummy.updateMatrix();
          roofs.setMatrixAt(i, dummy.matrix);
        }
        buildings.instanceMatrix.needsUpdate = true;
        roofs.instanceMatrix.needsUpdate = true;
        scene.add(buildings, roofs);
        instancedEntityCount += count;
        objects3D.set(name, { root: buildings, meta: { kind, count } });
        return;
      }

      if (kind === 'asteroids3d') {
        const count = Math.min(isSoftwareGl ? 90 : 320, Math.max(15, toNum(opts.count, 180)));
        const rad = toNum(opts.radius, 60);
        const alt = toNum(opts.y, 14);
        const spd = toNum(opts.speed, 0.35);
        const aGeo = trackGeo(new THREE.DodecahedronGeometry(0.9, 0));
        const aMat = trackMat(
          new THREE.MeshStandardMaterial({
            color: colorHex,
            roughness: 0.72,
            metalness: 0.25
          })
        );
        const belt = new THREE.InstancedMesh(aGeo, aMat, count);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < count; i++) {
          const theta = Math.random() * Math.PI * 2;
          const dist = 22 + Math.random() * rad;
          dummy.position.set(Math.cos(theta) * dist, alt + (Math.random() - 0.5) * 6, Math.sin(theta) * dist);
          dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
          const s = 0.5 + Math.random() * 1.8;
          dummy.scale.set(s, s * 0.8, s);
          dummy.updateMatrix();
          belt.setMatrixAt(i, dummy.matrix);
        }
        belt.instanceMatrix.needsUpdate = true;
        scene.add(belt);
        instancedEntityCount += count;
        animatedUpdaters3D.push((dt) => {
          belt.rotation.y += dt * spd * 0.15;
        });
        objects3D.set(name, { root: belt, meta: { kind, count } });
        return;
      }

      if (kind === 'car3d') {
        const group = new THREE.Group();
        const bodyMat = trackMat(
          new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.72, roughness: 0.22 })
        );
        const glassMat = trackMat(
          new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.9, roughness: 0.1 })
        );
        const neonMat = trackMat(
          new THREE.MeshStandardMaterial({
            color: '#38bdf8',
            emissive: '#38bdf8',
            emissiveIntensity: 1.8
          })
        );
        const wheelMat = trackMat(new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.85 }));

        const chassis = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.1, 0.55, 4.3)), bodyMat);
        chassis.position.y = 0.48;
        chassis.castShadow = true;
        group.add(chassis);

        const cabin = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.65, 0.5, 2.0)), glassMat);
        cabin.position.set(0, 0.96, -0.2);
        cabin.castShadow = true;
        group.add(cabin);

        const spoiler = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.0, 0.1, 0.4)), bodyMat);
        spoiler.position.set(0, 1.08, -1.9);
        group.add(spoiler);

        if (toBool(opts.neon, true)) {
          const underGlow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.9, 0.06, 3.8)), neonMat);
          underGlow.position.y = 0.16;
          group.add(underGlow);
        }

        const wheels: THREE.Mesh[] = [];
        const wheelGeo = trackGeo(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 14));
        wheelGeo.rotateZ(Math.PI / 2);
        const wheelOffsets: Array<[number, number, number]> = [
          [-1.08, 0.4, 1.35],
          [1.08, 0.4, 1.35],
          [-1.08, 0.4, -1.35],
          [1.08, 0.4, -1.35]
        ];
        for (const [wx, wy, wz] of wheelOffsets) {
          const wMesh = new THREE.Mesh(wheelGeo, wheelMat);
          wMesh.position.set(wx, wy, wz);
          wMesh.castShadow = true;
          group.add(wMesh);
          wheels.push(wMesh);
        }

        group.position.set(toNum(opts.x, 0), toNum(opts.y, 0.1), toNum(opts.z, 0));
        scene.add(group);

        const stateMeta: Record<string, any> = {
          kind,
          ...opts,
          speed: 0,
          heading: 0,
          maxSpeed: toNum(opts.speed, 22)
        };
        objects3D.set(name, { root: group, meta: stateMeta });

        animatedUpdaters3D.push((dt) => {
          if (editModeRef.current) return;
          const forward = keysPressed.has('w') || keysPressed.has('arrowup');
          const back = keysPressed.has('s') || keysPressed.has('arrowdown');
          const left = keysPressed.has('a') || keysPressed.has('arrowleft');
          const right = keysPressed.has('d') || keysPressed.has('arrowright');

          if (forward) stateMeta.speed = Math.min(stateMeta.maxSpeed, stateMeta.speed + dt * 26);
          else if (back) stateMeta.speed = Math.max(-10, stateMeta.speed - dt * 24);
          else stateMeta.speed *= Math.pow(0.2, dt);

          const turnFactor = Math.abs(stateMeta.speed) > 0.3 ? (stateMeta.speed >= 0 ? 1 : -1) : 0.6;
          if (left) stateMeta.heading += dt * 2.4 * turnFactor;
          if (right) stateMeta.heading -= dt * 2.4 * turnFactor;

          group.rotation.y = stateMeta.heading;
          group.position.x += Math.sin(stateMeta.heading) * stateMeta.speed * dt;
          group.position.z += Math.cos(stateMeta.heading) * stateMeta.speed * dt;

          // Keep in terrain bounds
          group.position.x = Math.max(-55, Math.min(55, group.position.x));
          group.position.z = Math.max(-55, Math.min(55, group.position.z));

          wheels.forEach(w => {
            w.rotation.x += stateMeta.speed * dt * 1.4;
          });
        });
        return;
      }

      if (kind === 'mecha3d' || kind === 'character3d') {
        const group = new THREE.Group();
        const armorMat = trackMat(
          new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.65, roughness: 0.28 })
        );
        const glowCol = String(opts.glow || '#10b981');
        const coreMat = trackMat(
          new THREE.MeshStandardMaterial({ color: glowCol, emissive: glowCol, emissiveIntensity: 1.8 })
        );

        const torso = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.5, 1.8, 1.0)), armorMat);
        torso.position.y = 2.0;
        torso.castShadow = true;
        group.add(torso);

        const core = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.32, 0.32, 1.06, 12)), coreMat);
        core.rotation.x = Math.PI / 2;
        core.position.set(0, 2.05, 0.02);
        group.add(core);

        const head = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.9, 0.75, 0.85)), armorMat);
        head.position.set(0, 3.35, 0);
        head.castShadow = true;
        group.add(head);

        const visor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.75, 0.22, 0.12)), coreMat);
        visor.position.set(0, 3.38, 0.42);
        group.add(visor);

        const leftArm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.45, 1.5, 0.5)), armorMat);
        leftArm.position.set(-1.1, 2.0, 0);
        leftArm.castShadow = true;
        const rightArm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.45, 1.5, 0.5)), armorMat);
        rightArm.position.set(1.1, 2.0, 0);
        rightArm.castShadow = true;

        const leftLeg = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.55, 1.2, 0.6)), armorMat);
        leftLeg.position.set(-0.45, 0.6, 0);
        leftLeg.castShadow = true;
        const rightLeg = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.55, 1.2, 0.6)), armorMat);
        rightLeg.position.set(0.45, 0.6, 0);
        rightLeg.castShadow = true;

        group.add(leftArm, rightArm, leftLeg, rightLeg);
        const sc = toNum(opts.scale, 1);
        group.scale.set(sc, sc, sc);
        group.position.set(toNum(opts.x, 0), toNum(opts.y, 0), toNum(opts.z, 6));
        scene.add(group);

        const meta = { kind, ...opts, speed: 0 };
        objects3D.set(name, { root: group, meta });

        animatedUpdaters3D.push((dt, elapsed) => {
          if (editModeRef.current) return;
          let moveX = 0;
          let moveZ = 0;
          if (keysPressed.has('w') || keysPressed.has('arrowup')) moveZ -= 1;
          if (keysPressed.has('s') || keysPressed.has('arrowdown')) moveZ += 1;
          if (keysPressed.has('a') || keysPressed.has('arrowleft')) moveX -= 1;
          if (keysPressed.has('d') || keysPressed.has('arrowright')) moveX += 1;
          const moving = moveX !== 0 || moveZ !== 0;
          if (moving) {
            const len = Math.hypot(moveX, moveZ);
            group.position.x += (moveX / len) * 10 * dt;
            group.position.z += (moveZ / len) * 10 * dt;
            group.rotation.y = Math.atan2(moveX, moveZ);
            leftLeg.rotation.x = Math.sin(elapsed * 10) * 0.45;
            rightLeg.rotation.x = -Math.sin(elapsed * 10) * 0.45;
            leftArm.rotation.x = -Math.sin(elapsed * 10) * 0.35;
            rightArm.rotation.x = Math.sin(elapsed * 10) * 0.35;
          } else {
            leftLeg.rotation.x *= 0.85;
            rightLeg.rotation.x *= 0.85;
            torso.position.y = 2.0 + Math.sin(elapsed * 2.5) * 0.04;
          }
        });
        return;
      }

      if (kind === 'boss3d' || kind === 'dragon3d') {
        const group = new THREE.Group();
        const bodyMat = trackMat(
          new THREE.MeshStandardMaterial({ color: '#1e1b4b', metalness: 0.8, roughness: 0.25 })
        );
        const coreMat = trackMat(
          new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 2.0 })
        );

        const core = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(1.7, 1)), coreMat);
        core.castShadow = true;
        group.add(core);

        const ring1 = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(2.6, 0.16, 12, 40)), bodyMat);
        const ring2 = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(3.3, 0.12, 12, 40)), coreMat);
        ring2.rotation.x = Math.PI / 3;
        group.add(ring1, ring2);

        const sc = toNum(opts.scale, 1.4);
        group.scale.set(sc, sc, sc);
        group.position.set(toNum(opts.x, 0), toNum(opts.y, 5.5), toNum(opts.z, -14));
        scene.add(group);
        objects3D.set(name, { root: group, meta: { kind, ...opts } });

        animatedUpdaters3D.push((dt, elapsed) => {
          core.rotation.y += dt * 0.9;
          ring1.rotation.x += dt * 1.4;
          ring1.rotation.y += dt * 0.8;
          ring2.rotation.z -= dt * 1.2;
          core.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.06);
        });
        return;
      }

      if (kind === 'portal3d') {
        const group = new THREE.Group();
        const rad = toNum(opts.radius, 2.5);
        const ringMat = trackMat(
          new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 1.9, roughness: 0.2 })
        );
        const ring = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(rad, 0.24, 16, 48)), ringMat);
        const memMat = trackMat(
          new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
        );
        const membrane = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(rad * 0.92, 32)), memMat);
        group.add(ring, membrane);
        group.position.set(toNum(opts.x, 0), toNum(opts.y, 3), toNum(opts.z, -16));
        scene.add(group);
        objects3D.set(name, { root: group, meta: { kind, ...opts } });

        animatedUpdaters3D.push((dt, elapsed) => {
          ring.rotation.z += dt * 1.8;
          membrane.scale.setScalar(0.95 + Math.sin(elapsed * 5) * 0.05);
        });
        return;
      }

      if (kind === 'turret3d') {
        const group = new THREE.Group();
        const baseMat = trackMat(new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.7, roughness: 0.3 }));
        const gunMat = trackMat(new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.5 }));
        const base = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.1, 1.4, 1.1, 10)), baseMat);
        base.castShadow = true;
        const head = new THREE.Group();
        head.position.y = 0.9;
        const turretBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.2, 0.8, 1.4)), gunMat);
        const barrel = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.14, 1.8, 8)), baseMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.05, 1.1);
        head.add(turretBody, barrel);
        group.add(base, head);
        group.position.set(toNum(opts.x, -8), toNum(opts.y, 0.6), toNum(opts.z, -8));
        scene.add(group);
        objects3D.set(name, { root: group, meta: { kind, ...opts } });

        animatedUpdaters3D.push(() => {
          const targetObj = opts.target ? objects3D.get(String(opts.target))?.root : null;
          if (targetObj) {
            head.lookAt(targetObj.position.x, head.getWorldPosition(new THREE.Vector3()).y, targetObj.position.z);
          }
        });
        return;
      }

      if (kind === 'pickup3d') {
        const geo = trackGeo(new THREE.OctahedronGeometry(0.75, 0));
        const mat = trackMat(
          new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 1.4, metalness: 0.6, roughness: 0.15 })
        );
        const gem = new THREE.Mesh(geo, mat);
        gem.castShadow = true;
        const baseY = toNum(opts.y, 1.5);
        gem.position.set(toNum(opts.x, 4), baseY, toNum(opts.z, -4));
        scene.add(gem);
        objects3D.set(name, { root: gem, meta: { kind, collected: false, ...opts } });
        const spin = toNum(opts.spin, 2.2);
        animatedUpdaters3D.push((dt, elapsed) => {
          if (!gem.visible) return;
          gem.rotation.y += dt * spin;
          gem.position.y = baseY + Math.sin(elapsed * 3) * 0.25;
          // Auto-collect if racer or hero comes within 2.5 units
          const hero = objects3D.get('racer')?.root || objects3D.get('hero')?.root || objects3D.get('titan')?.root;
          if (hero && hero.position.distanceTo(gem.position) < 2.6) {
            gem.visible = false;
            vars.gems = (Number(vars.gems) || 0) + 1;
            playProceduralSfx('coin', 0.35);
            pushToast(`Collected ${name}! (+1 Gem)`, 'success');
          }
        });
        return;
      }

      if (kind === 'particles3d') {
        const count = Math.min(isSoftwareGl ? 250 : 1200, Math.max(40, toNum(opts.count, 500)));
        const rad = toNum(opts.radius, 28);
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          positions[i * 3] = (Math.random() - 0.5) * rad * 2;
          positions[i * 3 + 1] = 0.5 + Math.random() * 12;
          positions[i * 3 + 2] = (Math.random() - 0.5) * rad * 2;
        }
        const geo = trackGeo(new THREE.BufferGeometry());
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = trackMat(
          new THREE.PointsMaterial({ color: colorHex, size: 0.26, transparent: true, opacity: 0.82 })
        );
        const pts = new THREE.Points(geo, mat);
        scene.add(pts);
        animatedUpdaters3D.push((dt, elapsed) => {
          pts.rotation.y += dt * 0.08;
          const attr = geo.attributes.position;
          for (let i = 0; i < Math.min(count, 200); i++) {
            attr.setY(i, attr.getY(i) + Math.sin(elapsed * 2 + i) * dt * 0.4);
          }
          attr.needsUpdate = true;
        });
        objects3D.set(name, { root: pts, meta: { kind, count } });
        return;
      }

      if (kind === 'camera3d') {
        camera3DConfig = { ...camera3DConfig, ...opts };
        if (camera && opts.fov) {
          camera.fov = toNum(opts.fov, 58);
          camera.updateProjectionMatrix();
        }
        return;
      }

      if (kind === 'grid3d') {
        const size = Math.min(240, Math.max(10, toNum(opts.size, 80)));
        const divs = Math.min(120, Math.max(4, toNum(opts.divisions, 40)));
        const grid = new THREE.GridHelper(size, divs, colorHex, '#1e293b');
        grid.position.set(toNum(opts.x, 0), toNum(opts.y, 0.01), toNum(opts.z, 0));
        scene.add(grid);
        objects3D.set(name, { root: grid, meta: { kind, ...opts } });
        return;
      }

      if (kind === 'fog3d') {
        scene.fog = new THREE.FogExp2(String(opts.color || '#070b14'), toNum(opts.density, 0.012));
        return;
      }

      if (kind === 'spin3d') {
        const tgtName = String(opts.target || opts.name || '');
        const rx = toNum(opts.x, 0);
        const ry = toNum(opts.y, 1.5);
        const rz = toNum(opts.z, 0);
        animatedUpdaters3D.push((dt) => {
          const entry = objects3D.get(tgtName);
          if (entry) {
            entry.root.rotation.x += rx * dt;
            entry.root.rotation.y += ry * dt;
            entry.root.rotation.z += rz * dt;
          }
        });
        return;
      }

      if (kind === 'rigidbody3d') {
        const tgtName = String(opts.target || opts.name || '');
        const grav = toNum(opts.gravity, 18);
        const bounce = Math.max(0, Math.min(0.95, toNum(opts.bounce, 0.55)));
        const floorY = toNum(opts.floorY, 1.0);
        let vy = 0;
        animatedUpdaters3D.push((dt) => {
          if (editModeRef.current) return;
          const entry = objects3D.get(tgtName);
          if (!entry) return;
          vy -= grav * dt;
          entry.root.position.y += vy * dt;
          if (entry.root.position.y < floorY) {
            entry.root.position.y = floorY;
            vy = Math.abs(vy) * bounce;
            if (vy < 0.4) vy = 0;
          }
        });
        return;
      }

      if (kind === 'text3d') {
        const txt = String(opts.text || 'DRPL');
        const c = document.createElement('canvas');
        c.width = 512;
        c.height = 128;
        const c2 = c.getContext('2d');
        if (c2) {
          c2.clearRect(0, 0, c.width, c.height);
          c2.fillStyle = 'rgba(10,14,22,0.72)';
          c2.strokeStyle = colorHex;
          c2.lineWidth = 4;
          c2.fillRect(8, 12, c.width - 16, c.height - 24);
          c2.strokeRect(8, 12, c.width - 16, c.height - 24);
          c2.font = 'bold 46px monospace';
          c2.fillStyle = colorHex;
          c2.textAlign = 'center';
          c2.textBaseline = 'middle';
          c2.fillText(txt, c.width / 2, c.height / 2);
        }
        const tex = new THREE.CanvasTexture(c);
        disposableTex.push(tex);
        const tGeo = trackGeo(new THREE.PlaneGeometry(5.6, 1.4));
        const tMat = trackMat(new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
        const mesh = new THREE.Mesh(tGeo, tMat);
        const sc = toNum(opts.scale, 1.2);
        mesh.scale.set(sc, sc, sc);
        mesh.position.set(toNum(opts.x, 0), toNum(opts.y, 4.5), toNum(opts.z, -6));
        scene.add(mesh);
        objects3D.set(name, { root: mesh, meta: { kind, ...opts } });
        return;
      }

      if (kind === 'raycast3d') {
        const len = Math.max(2, toNum(opts.length, 18));
        const mat = trackMat(new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.78 }));
        const geo = trackGeo(new THREE.CylinderGeometry(0.05, 0.05, len, 8));
        geo.rotateX(Math.PI / 2);
        const beam = new THREE.Mesh(geo, mat);
        scene.add(beam);
        const fromTarget = String(opts.from || '');
        animatedUpdaters3D.push(() => {
          const src = fromTarget ? objects3D.get(fromTarget)?.root : null;
          if (src) {
            const heading = objects3D.get(fromTarget)?.meta?.heading || src.rotation.y || 0;
            beam.position.set(
              src.position.x + Math.sin(heading) * (len * 0.5),
              src.position.y + 0.9,
              src.position.z + Math.cos(heading) * (len * 0.5)
            );
            beam.rotation.y = heading;
          } else {
            beam.position.set(toNum(opts.x, 0), toNum(opts.y, 1.2), toNum(opts.z, 0));
          }
        });
        objects3D.set(name, { root: beam, meta: { kind, ...opts } });
        return;
      }

      if (kind === 'hologram3d') {
        const grp = new THREE.Group();
        const rad = toNum(opts.radius, 1.7);
        const holoMat = trackMat(new THREE.MeshBasicMaterial({ color: colorHex, wireframe: true, transparent: true, opacity: 0.72 }));
        const core = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(rad * 0.52, 1)), holoMat);
        const ringA = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(rad, 0.06, 8, 36)), holoMat);
        const ringB = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(rad * 0.78, 0.05, 8, 36)), holoMat);
        ringB.rotation.x = Math.PI / 2.2;
        grp.add(core, ringA, ringB);
        grp.position.set(toNum(opts.x, 0), toNum(opts.y, 3.5), toNum(opts.z, -6));
        scene.add(grp);
        animatedUpdaters3D.push((dt, el) => {
          core.rotation.y += dt * 1.4;
          ringA.rotation.x += dt * 1.1;
          ringB.rotation.z -= dt * 1.5;
          grp.position.y = toNum(opts.y, 3.5) + Math.sin(el * 2.5) * 0.25;
        });
        objects3D.set(name, { root: grp, meta: { kind, ...opts } });
        return;
      }

      if (kind === 'checkpoint3d') {
        const grp = new THREE.Group();
        const rad = toNum(opts.radius, 3.0);
        const mat = trackMat(new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 1.5, transparent: true, opacity: 0.85 }));
        const arch = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(rad, 0.18, 12, 36, Math.PI)), mat);
        const pad = new THREE.Mesh(trackGeo(new THREE.RingGeometry(rad * 0.72, rad, 32)), mat);
        pad.rotation.x = -Math.PI / 2;
        pad.position.y = 0.05;
        grp.add(arch, pad);
        grp.position.set(toNum(opts.x, 0), toNum(opts.y, 0.2), toNum(opts.z, -16));
        scene.add(grp);
        let triggered = false;
        animatedUpdaters3D.push(() => {
          if (triggered || editModeRef.current) return;
          const hero = objects3D.get('racer')?.root || objects3D.get('hero')?.root || objects3D.get('titan')?.root;
          if (hero && hero.position.distanceTo(grp.position) < rad + 1.2) {
            triggered = true;
            vars.checkpoints = (Number(vars.checkpoints) || 0) + 1;
            playProceduralSfx('powerup', 0.35);
            pushToast(`Checkpoint ${name} reached!`, 'success');
          }
        });
        objects3D.set(name, { root: grp, meta: { kind, ...opts } });
        return;
      }

      if (kind === 'platform3d') {
        const grp = new THREE.Group();
        const w = toNum(opts.w, 6);
        const h = toNum(opts.h, 0.6);
        const d = toNum(opts.d, 10);
        const baseMat = trackMat(new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.4, roughness: 0.45 }));
        const glowCol = String(opts.glow || '#10b981');
        const trimMat = trackMat(new THREE.MeshStandardMaterial({ color: glowCol, emissive: glowCol, emissiveIntensity: 1.4 }));
        const deck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, h, d)), baseMat);
        deck.receiveShadow = true;
        deck.castShadow = true;
        const trim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w + 0.16, 0.12, d + 0.16)), trimMat);
        trim.position.y = h * 0.38;
        grp.add(deck, trim);
        grp.position.set(toNum(opts.x, 0), toNum(opts.y, 2), toNum(opts.z, -8));
        scene.add(grp);
        objects3D.set(name, { root: grp, meta: { kind, ...opts } });
        return;
      }

      if (kind === 'bouncepad3d') {
        const grp = new THREE.Group();
        const rad = toNum(opts.radius, 1.8);
        const padMat = trackMat(new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 1.5 }));
        const disc = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(rad, rad * 1.15, 0.25, 24)), padMat);
        const halo = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(rad * 0.92, 0.08, 8, 28)), padMat);
        halo.rotation.x = Math.PI / 2;
        halo.position.y = 0.25;
        grp.add(disc, halo);
        grp.position.set(toNum(opts.x, 4), toNum(opts.y, 0.2), toNum(opts.z, -4));
        scene.add(grp);
        const power = toNum(opts.power, 16);
        let cooldown = 0;
        animatedUpdaters3D.push((dt, el) => {
          halo.position.y = 0.25 + ((el * 1.8) % 1.0) * 0.8;
          cooldown = Math.max(0, cooldown - dt);
          if (editModeRef.current || cooldown > 0) return;
          const heroEntry = objects3D.get('racer') || objects3D.get('hero') || objects3D.get('titan');
          if (heroEntry && heroEntry.root.position.distanceTo(grp.position) < rad + 1.0) {
            cooldown = 0.65;
            if (typeof heroEntry.meta.speed === 'number') {
              heroEntry.meta.speed = Math.max(heroEntry.meta.speed, power * 1.4);
            }
            playProceduralSfx('jump', 0.32);
            pushToast('BOOST PAD!', 'info');
          }
        });
        objects3D.set(name, { root: grp, meta: { kind, ...opts } });
        return;
      }

      if (kind === 'trail3d') {
        const segCount = Math.min(28, Math.max(6, toNum(opts.length, 18)));
        const pts: THREE.Mesh[] = [];
        const trailMat = trackMat(new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.65 }));
        const trailGeo = trackGeo(new THREE.SphereGeometry(0.18, 8, 8));
        for (let i = 0; i < segCount; i++) {
          const m = new THREE.Mesh(trailGeo, trailMat);
          m.scale.setScalar(1 - i / segCount);
          scene.add(m);
          pts.push(m);
        }
        const history: THREE.Vector3[] = [];
        const tgtName = String(opts.target || 'racer');
        animatedUpdaters3D.push(() => {
          const tgt = objects3D.get(tgtName)?.root;
          if (!tgt) return;
          history.unshift(tgt.position.clone().add(new THREE.Vector3(0, 0.45, 0)));
          if (history.length > segCount) history.pop();
          for (let i = 0; i < pts.length; i++) {
            const p = history[Math.min(i, history.length - 1)] || tgt.position;
            pts[i].position.copy(p);
          }
        });
        return;
      }

      if (kind === 'shake3d') {
        const intensity = Math.min(2.5, Math.max(0.05, toNum(opts.intensity, 0.4)));
        let remain = Math.max(0.1, toNum(opts.duration, 0.35));
        animatedUpdaters3D.push((dt) => {
          if (remain <= 0 || !camera) return;
          remain -= dt;
          camera.position.x += (Math.random() - 0.5) * intensity;
          camera.position.y += (Math.random() - 0.5) * intensity * 0.7;
        });
        return;
      }

      // Generic primitives: box3d, sphere3d, cylinder3d, torus3d, pyramid3d, cone3d, capsule3d, plane3d, icosahedron3d, ring3d, projectile3d
      let pGeo: THREE.BufferGeometry;
      let isFlatHorizontal = false;
      if (kind === 'sphere3d' || kind === 'projectile3d') {
        pGeo = trackGeo(new THREE.SphereGeometry(toNum(opts.radius, 1.0), 24, 18));
      } else if (kind === 'cylinder3d') {
        pGeo = trackGeo(new THREE.CylinderGeometry(toNum(opts.radius, 0.8), toNum(opts.radius, 0.8), toNum(opts.h, 2), 20));
      } else if (kind === 'pyramid3d') {
        pGeo = trackGeo(new THREE.ConeGeometry(toNum(opts.radius, 1.3), toNum(opts.h, 2.2), 4));
        pGeo.rotateY(Math.PI / 4);
      } else if (kind === 'cone3d') {
        pGeo = trackGeo(new THREE.ConeGeometry(toNum(opts.radius, 1.1), toNum(opts.h, 2.4), 24));
      } else if (kind === 'capsule3d') {
        pGeo = trackGeo(new THREE.CapsuleGeometry(toNum(opts.radius, 0.65), toNum(opts.h, 1.4), 8, 16));
      } else if (kind === 'icosahedron3d') {
        pGeo = trackGeo(new THREE.IcosahedronGeometry(toNum(opts.radius, 1.15), 0));
      } else if (kind === 'torus3d') {
        pGeo = trackGeo(new THREE.TorusGeometry(toNum(opts.radius, 1.4), 0.35, 14, 36));
      } else if (kind === 'plane3d') {
        pGeo = trackGeo(new THREE.PlaneGeometry(toNum(opts.w, 20), toNum(opts.d, 20)));
        isFlatHorizontal = true;
      } else if (kind === 'ring3d') {
        const rad = toNum(opts.radius, 3.0);
        pGeo = trackGeo(new THREE.RingGeometry(rad * 0.68, rad, 36));
        isFlatHorizontal = true;
      } else {
        pGeo = trackGeo(new THREE.BoxGeometry(toNum(opts.w, 2), toNum(opts.h, 2), toNum(opts.d, 2)));
      }
      const emissiveOn = toBool(opts.emissive, kind === 'ring3d');
      const pMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: colorHex,
          metalness: toNum(opts.metallic, 0.45),
          roughness: toNum(opts.roughness, 0.3),
          emissive: emissiveOn ? colorHex : '#000000',
          emissiveIntensity: emissiveOn ? 1.4 : 0,
          side: isFlatHorizontal ? THREE.DoubleSide : THREE.FrontSide
        })
      );
      const mesh = new THREE.Mesh(pGeo, pMat);
      if (isFlatHorizontal) mesh.rotation.x = -Math.PI / 2;
      mesh.castShadow = !isFlatHorizontal;
      mesh.receiveShadow = true;
      const defaultY = kind === 'plane3d' ? 0 : kind === 'ring3d' ? 0.08 : 1;
      mesh.position.set(toNum(opts.x, 0), toNum(opts.y, defaultY), toNum(opts.z, 0));
      const sc = toNum(opts.scale, 1);
      if (sc !== 1) mesh.scale.set(sc, sc, sc);
      scene.add(mesh);
      objects3D.set(name, { root: mesh, meta: { kind, ...opts } });
    };

    // ====================== 2D SUBSYSTEM ======================
    const world2D = {
      bg: '#060913',
      gravity: 960,
      lighting: true,
      floorY: 430,
      tileSize: 40,
      tileColor: '#0f172a',
      tileAccent: '#10b981',
      parallaxTheme: 'cyber_city',
      parallaxSpeed: 1.0,
      hasParallax: false,
      hasTilemap: false,
      minimap: false,
      minimapSize: 120,
      camFollow: '',
      camX: 0,
      camY: 0,
      camZoom: 1.0,
      camShake: 0,
      camSmoothing: 0.14
    };

    const entities2D = new Map<string, Entity2D>();
    const bullets2D: Bullet2D[] = [];
    const lasers2D: Laser2D[] = [];
    const particles2D: Particle2D[] = [];
    const lights2D: Light2D[] = [];
    const floaters2D: Floater2D[] = [];

    const spawn2DParticles = (x: number, y: number, count: number, color: string, speed: number, life: number) => {
      for (let k = 0; k < Math.min(80, count); k++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (0.3 + Math.random() * 0.7) * speed;
        particles2D.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          color,
          life,
          maxLife: life,
          size: 2 + Math.random() * 3
        });
      }
    };

    const weatherDrops: Array<{ x: number; y: number; speed: number; size: number }> = [];
    let weatherCfg: { enabled: boolean; type: string; color: string } = {
      enabled: false,
      type: 'embers',
      color: '#38bdf8'
    };

    const spawn2DComponent = (kind: string, opts: Record<string, any>) => {
      wants2D = true;
      if (kind === 'use2d') {
        if (opts.bg) world2D.bg = String(opts.bg);
        if (opts.gravity !== undefined) world2D.gravity = toNum(opts.gravity, 960);
        if (opts.lighting !== undefined) world2D.lighting = toBool(opts.lighting, true);
      } else if (kind === 'parallax2d') {
        world2D.hasParallax = true;
        if (opts.theme) world2D.parallaxTheme = String(opts.theme);
        if (opts.speed !== undefined) world2D.parallaxSpeed = toNum(opts.speed, 1);
      } else if (kind === 'tilemap2d') {
        world2D.hasTilemap = true;
        if (opts.floorY !== undefined) world2D.floorY = toNum(opts.floorY, 430);
        if (opts.tileSize !== undefined) world2D.tileSize = toNum(opts.tileSize, 40);
        if (opts.color) world2D.tileColor = String(opts.color);
        if (opts.accent) world2D.tileAccent = String(opts.accent);
      } else if (kind === 'weather2d') {
        weatherCfg = {
          enabled: true,
          type: String(opts.type || 'embers'),
          color: String(opts.color || '#38bdf8')
        };
        const dens = Math.min(140, Math.max(12, toNum(opts.density, 55)));
        weatherDrops.length = 0;
        for (let i = 0; i < dens; i++) {
          weatherDrops.push({
            x: Math.random() * 900,
            y: Math.random() * 520,
            speed: 55 + Math.random() * 140,
            size: 1.5 + Math.random() * 2.5
          });
        }
      } else if (
        kind === 'player2d' ||
        kind === 'enemy2d' ||
        kind === 'platform2d' ||
        kind === 'coin2d' ||
        kind === 'rect2d' ||
        kind === 'triangle2d' ||
        kind === 'circle2d' ||
        kind === 'polygon2d' ||
        kind === 'line2d' ||
        kind === 'capsule2d' ||
        kind === 'sprite2d' ||
        kind === 'checkpoint2d' ||
        kind === 'spring2d' ||
        kind === 'hazard2d'
      ) {
        const name = String(opts.name || `${kind}_${entities2D.size + 1}`);
        const k = kind.replace('2d', '') as Entity2D['kind'];
        const x = toNum(opts.x, 120);
        const y = toNum(opts.y, 240);
        const radius = toNum(opts.radius, k === 'circle' || k === 'polygon' ? 30 : 12);
        const w = toNum(
          opts.w,
          k === 'platform' || k === 'line'
            ? 160
            : k === 'coin'
              ? 22
              : k === 'circle' || k === 'polygon'
                ? radius * 2
                : k === 'capsule' || k === 'hazard'
                  ? 84
                  : k === 'spring'
                    ? 48
                    : k === 'checkpoint'
                      ? 30
                      : k === 'rect' || k === 'triangle'
                        ? 72
                        : k === 'sprite'
                          ? 48
                          : 32
        );
        const h = toNum(
          opts.h,
          k === 'platform' || k === 'spring' || k === 'hazard'
            ? 18
            : k === 'line'
              ? 6
              : k === 'coin'
                ? 22
                : k === 'circle' || k === 'polygon'
                  ? radius * 2
                  : k === 'capsule'
                    ? 34
                    : k === 'checkpoint'
                      ? 52
                      : k === 'rect' || k === 'triangle'
                        ? 64
                        : k === 'sprite'
                          ? 48
                          : 36
        );
        const hp = toNum(opts.hp, 100);
        entities2D.set(name, {
          name,
          kind: k,
          x,
          y,
          w,
          h,
          vx: 0,
          vy: 0,
          speed: toNum(opts.speed, k === 'player' ? 280 : 100),
          jump: toNum(opts.jump, k === 'spring' ? toNum(opts.power, 680) : 460),
          color: String(
            opts.color ||
              (k === 'player'
                ? '#10b981'
                : k === 'enemy' || k === 'hazard'
                  ? '#f43f5e'
                  : k === 'spring'
                    ? '#eab308'
                    : k === 'checkpoint'
                      ? '#22c55e'
                      : k === 'circle'
                        ? '#a855f7'
                        : k === 'triangle'
                          ? '#f97316'
                          : k === 'polygon'
                            ? '#ec4899'
                            : '#38bdf8')
          ),
          glow: opts.glow ? String(opts.glow) : undefined,
          border: opts.border ? String(opts.border) : undefined,
          radius,
          sides: toNum(opts.sides, 6),
          spin: toNum(opts.spin, 0),
          angle: 0,
          icon: opts.icon ? String(opts.icon) : 'rocket',
          hp,
          maxHp: hp,
          ai: opts.ai ? String(opts.ai) : 'patrol',
          value: toNum(opts.value, k === 'hazard' ? toNum(opts.damage, 20) : 10),
          facing: 1,
          grounded: false,
          startX: x,
          startY: y
        });
      } else if (kind === 'spawner2d') {
        const sx = toNum(opts.x, 380);
        const sy = toNum(opts.y, 220);
        const spawnKind = String(opts.kind || 'coin2d');
        const col = String(opts.color || '#facc15');
        const iv = Math.max(0.6, toNum(opts.interval, 3.5));
        timerHooks.push({
          interval: iv,
          elapsed: iv * 0.7,
          fn: () => {
            if (entities2D.size > 45 || editModeRef.current) return;
            const id = `spawn_${Math.floor(Math.random() * 100000)}`;
            spawn2DComponent(spawnKind, { name: id, x: sx + (Math.random() - 0.5) * 90, y: sy, color: col, value: 15 });
          }
        });
      } else if (kind === 'shield2d') {
        const tgt = String(opts.target || 'hero');
        lights2D.push({
          x: toNum(opts.x, 120),
          y: toNum(opts.y, 240),
          radius: toNum(opts.radius, 34),
          color: String(opts.color || '#38bdf8'),
          intensity: 0.75,
          follow: tgt
        });
      } else if (kind === 'dialog2d') {
        const id = String(opts.id || 'dialog2d_box');
        widgetMap.set(id, {
          id,
          kind: 'ui_modal',
          props: {
            title: String(opts.speaker || 'Guide'),
            body: String(opts.text || ''),
            open: true,
            x: toNum(opts.x, 18),
            y: toNum(opts.y, 320),
            w: toNum(opts.w, 380)
          }
        });
        uiDirty = true;
      } else if (kind === 'tween2d') {
        const tgt = String(opts.target || '');
        const axis = String(opts.axis || 'y');
        const range = toNum(opts.range, 42);
        const speed = toNum(opts.speed, 2.0);
        updateHooks.push((_dt, t) => {
          if (editModeRef.current) return;
          const ent = entities2D.get(tgt);
          if (!ent) return;
          if (axis === 'x') ent.x = ent.startX + Math.sin(t * speed) * range;
          else ent.y = ent.startY + Math.sin(t * speed) * range;
        });
      } else if (kind === 'bullet2d') {
        bullets2D.push({
          x: toNum(opts.x, 160),
          y: toNum(opts.y, 280),
          vx: toNum(opts.vx, 520),
          vy: toNum(opts.vy, 0),
          radius: toNum(opts.radius, 5),
          color: String(opts.color || '#38bdf8'),
          owner: String(opts.owner || 'hero'),
          life: 2.2
        });
      } else if (kind === 'laser2d') {
        const life = toNum(opts.life, 0.28);
        lasers2D.push({
          x1: toNum(opts.x1, 100),
          y1: toNum(opts.y1, 250),
          x2: toNum(opts.x2, 620),
          y2: toNum(opts.y2, 250),
          color: String(opts.color || '#f43f5e'),
          width: toNum(opts.width, 4),
          life,
          maxLife: life
        });
      } else if (kind === 'particles2d') {
        spawn2DParticles(
          toNum(opts.x, 320),
          toNum(opts.y, 240),
          toNum(opts.count, 20),
          String(opts.color || '#10b981'),
          toNum(opts.speed, 160),
          toNum(opts.life, 0.65)
        );
      } else if (kind === 'light2d') {
        lights2D.push({
          x: toNum(opts.x, 200),
          y: toNum(opts.y, 260),
          radius: toNum(opts.radius, 180),
          color: String(opts.color || '#10b981'),
          intensity: toNum(opts.intensity, 0.55),
          follow: opts.follow ? String(opts.follow) : undefined
        });
      } else if (kind === 'floater2d') {
        floaters2D.push({
          text: String(opts.text || '+10'),
          x: toNum(opts.x, 260),
          y: toNum(opts.y, 200),
          color: String(opts.color || '#facc15'),
          life: 1.0
        });
      } else if (kind === 'camera2d') {
        if (opts.follow) world2D.camFollow = String(opts.follow);
        if (opts.zoom !== undefined) world2D.camZoom = toNum(opts.zoom, 1);
        if (opts.shake !== undefined) world2D.camShake = toNum(opts.shake, 0);
        if (opts.smoothing !== undefined) world2D.camSmoothing = toNum(opts.smoothing, 0.14);
      } else if (kind === 'minimap2d') {
        world2D.minimap = toBool(opts.enabled, true);
        if (opts.size !== undefined) world2D.minimapSize = toNum(opts.size, 120);
      } else if (kind === 'sfx2d') {
        playProceduralSfx(String(opts.preset || 'click'), toNum(opts.volume, 0.35));
      }
    };

    // ====================== RUNTIME SANDBOX API ======================
    const rt = {
      spawn: (kind: string, opts: Record<string, any> = {}) => {
        if (kind === 'move3d') {
          const args = opts._args || [];
          const name = String(opts.name || args[0] || '');
          const obj = objects3D.get(name)?.root;
          if (obj) {
            obj.position.set(
              toNum(opts.x ?? args[1], obj.position.x),
              toNum(opts.y ?? args[2], obj.position.y),
              toNum(opts.z ?? args[3], obj.position.z)
            );
          }
          return;
        }
        if (kind === 'rotate3d') {
          const args = opts._args || [];
          const name = String(opts.name || args[0] || '');
          const obj = objects3D.get(name)?.root;
          if (obj) {
            obj.rotation.set(
              toNum(opts.x ?? args[1], obj.rotation.x),
              toNum(opts.y ?? args[2], obj.rotation.y),
              toNum(opts.z ?? args[3], obj.rotation.z)
            );
          }
          return;
        }
        if (kind === 'scale3d') {
          const args = opts._args || [];
          const name = String(opts.name || args[0] || '');
          const s = toNum(opts.s ?? args[1], 1);
          const obj = objects3D.get(name)?.root;
          if (obj) obj.scale.set(s, s, s);
          return;
        }
        if (kind === 'move2d') {
          const args = opts._args || [];
          const name = String(opts.name || args[0] || '');
          const ent = entities2D.get(name);
          if (ent) {
            ent.x = toNum(opts.x ?? args[1], ent.x);
            ent.y = toNum(opts.y ?? args[2], ent.y);
          }
          return;
        }
        if (kind === 'useapp') {
          wantsApp = true;
          setAppMeta({
            title: opts.title ? String(opts.title) : undefined,
            bg: opts.bg ? String(opts.bg) : '#0a0c0e',
            accent: opts.accent ? String(opts.accent) : '#10b981'
          });
          return;
        }
        if (kind === 'state_store') {
          Object.entries(opts).forEach(([k, v]) => {
            if (k !== '_args') vars[k] = v;
          });
          return;
        }
        if (kind === 'event_bus') {
          if (opts.emit) {
            const list = eventBusHooks.get(String(opts.emit)) || [];
            list.forEach(fn => {
              try {
                fn(opts.payload);
              } catch {
                // ignore
              }
            });
          }
          return;
        }
        if (kind === 'synth_music') {
          const vol = toNum(opts.volume, 0.16);
          const tempo = Math.max(60, Math.min(200, toNum(opts.tempo, 120)));
          const beatSec = 60 / tempo;
          let stepIdx = 0;
          timerHooks.push({
            interval: beatSec,
            elapsed: 0,
            fn: () => {
              const notes = ['coin', 'click', 'powerup', 'coin'];
              playProceduralSfx(notes[stepIdx % notes.length], vol * 0.5);
              stepIdx++;
            }
          });
          return;
        }
        if (kind === 'storage_save') {
          const key = String(opts.key || 'highscore');
          try {
            window.localStorage?.setItem(`drpl_save_${key}`, JSON.stringify(opts.value ?? 0));
          } catch {
            // ignore
          }
          vars[key] = opts.value ?? 0;
          return;
        }
        if (kind === 'ui_toast') {
          pushToast(String(opts.text || 'Notice'), (opts.type as any) || 'info');
          return;
        }
        if (kind.startsWith('ui_')) {
          const id = String(opts.id || `${kind}_${widgetMap.size + 1}`);
          widgetMap.set(id, { id, kind: kind as UiWidgetState['kind'], props: { ...opts } });
          if (kind === 'ui_timer') {
            timerHooks.push({
              interval: 1,
              elapsed: 0,
              fn: () => {
                const w = widgetMap.get(id);
                if (!w) return;
                const curr = toNum(w.props.seconds, 0);
                const down = toBool(w.props.countDown, true);
                w.props = { ...w.props, seconds: down ? Math.max(0, curr - 1) : curr + 1 };
                uiDirty = true;
              }
            });
          }
          uiDirty = true;
          return;
        }
        if (kind.endsWith('3d')) {
          wants3D = true;
          spawn3DComponent(kind, opts);
          return;
        }
        if (kind.endsWith('2d')) {
          spawn2DComponent(kind, opts);
        }
      },
      registerFn: (name: string, fn: (...args: any[]) => any) => {
        fnMap.set(name, fn);
      },
      onStart: (fn: () => void) => startHooks.push(fn),
      onUpdate: (fn: (dt: number, time: number) => void) => updateHooks.push(fn),
      onRender: (fn: (dt: number, time: number) => void) => renderHooks.push(fn),
      onKey: (key: string, fn: () => void) => {
        const k = String(key).toLowerCase();
        const arr = keyHooks.get(k) || [];
        arr.push(fn);
        keyHooks.set(k, arr);
      },
      onClick: (target: string, fn: () => void) => {
        const arr = clickHooks.get(target) || [];
        arr.push(fn);
        clickHooks.set(target, arr);
      },
      onTimer: (seconds: number, fn: () => void) => {
        timerHooks.push({ interval: Math.max(0.05, Number(seconds) || 1), elapsed: 0, fn });
      },
      onCollide: (_a: string, _b: string, fn: () => void) => {
        updateHooks.push(() => {
          const ea = entities2D.get(_a);
          const eb = entities2D.get(_b);
          if (ea && eb && ea.x < eb.x + eb.w && ea.x + ea.w > eb.x && ea.y < eb.y + eb.h && ea.y + ea.h > eb.y) {
            fn();
          }
        });
      },
      emit: (name: string, payload?: any) => {
        const list = eventBusHooks.get(String(name)) || [];
        list.forEach(fn => fn(payload));
      },
      onEvent: (name: string, fn: (payload?: any) => void) => {
        const key = String(name);
        const list = eventBusHooks.get(key) || [];
        list.push(fn);
        eventBusHooks.set(key, list);
      },
      print: (...args: any[]) => {
        const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        const term = Array.from(widgetMap.values()).find(w => w.kind === 'ui_terminal');
        if (term) {
          const prev = Array.isArray(term.props.lines) ? [...term.props.lines] : [];
          prev.push(msg);
          while (prev.length > 40) prev.shift();
          term.props = { ...term.props, lines: prev };
          uiDirty = true;
        } else {
          pushToast(msg, 'info');
        }
      },
      vec2: (x = 0, y = 0) => ({ x: Number(x) || 0, y: Number(y) || 0 }),
      vec3: (x = 0, y = 0, z = 0) => ({ x: Number(x) || 0, y: Number(y) || 0, z: Number(z) || 0 }),
      setUI: (id: string, prop: string, val: any) => {
        const w = widgetMap.get(String(id));
        if (w) {
          w.props = { ...w.props, [prop]: val };
          uiDirty = true;
        }
      },
      getUI: (id: string, prop: string, fallback: any = null) => {
        const w = widgetMap.get(String(id));
        return w && w.props[prop] !== undefined ? w.props[prop] : fallback;
      },
      pushChart: (id: string, val: number, maxLen = 20) => {
        const w = widgetMap.get(String(id));
        if (w) {
          const prev = Array.isArray(w.props.values) ? [...w.props.values] : [];
          prev.push(Number(val) || 0);
          while (prev.length > maxLen) prev.shift();
          w.props = { ...w.props, values: prev };
          uiDirty = true;
        }
      },
      logTerminal: (id: string, line: string) => {
        const w = widgetMap.get(String(id));
        if (w) {
          const prev = Array.isArray(w.props.lines) ? [...w.props.lines] : [];
          prev.push(String(line));
          while (prev.length > 40) prev.shift();
          w.props = { ...w.props, lines: prev };
          uiDirty = true;
        }
      },
      setVar: (name: string, val: any) => {
        vars[name] = val;
      },
      getVar: (name: string, fallback: any = 0) => (vars[name] !== undefined ? vars[name] : fallback),
      getProp: (name: string, prop: string, fallback: any = 0) => {
        const entry = objects3D.get(String(name));
        if (!entry) return fallback;
        if (prop === 'x') return entry.root.position.x;
        if (prop === 'y') return entry.root.position.y;
        if (prop === 'z') return entry.root.position.z;
        if (entry.meta[prop] !== undefined) return entry.meta[prop];
        return fallback;
      },
      get2D: (name: string, prop: string, fallback: any = 0) => {
        const ent = entities2D.get(String(name));
        if (!ent) return fallback;
        return (ent as any)[prop] !== undefined ? (ent as any)[prop] : fallback;
      },
      shake: (amount = 8) => {
        world2D.camShake = Math.max(world2D.camShake, Number(amount) || 8);
      },
      playSfx: (preset = 'click', volume = 0.35) => playProceduralSfx(preset, volume),
      distance3d: (a: string, b: string) => {
        const oa = objects3D.get(a)?.root;
        const ob = objects3D.get(b)?.root;
        return oa && ob ? oa.position.distanceTo(ob.position) : 9999;
      },
      lerp: (a: number, b: number, t: number) => a + (b - a) * t,
      clamp: (v: number, min: number, max: number) => Math.max(min, Math.min(max, v)),
      rand: (min = 0, max = 1) => min + Math.random() * (max - min),
      randInt: (min = 0, max = 10) => Math.floor(min + Math.random() * (max - min + 1)),
      storage_load: (key: string, fallback: any = 0) => {
        try {
          const raw = window.localStorage?.getItem(`drpl_save_${key}`);
          if (raw !== null && raw !== undefined) return JSON.parse(raw);
        } catch {
          // ignore
        }
        return vars[key] !== undefined ? vars[key] : fallback;
      }
    };

    let selectionHelper: THREE.BoxHelper | null = null;
    const attachSelectionBox3D = (name: string | null) => {
      if (selectionHelper && scene) {
        scene.remove(selectionHelper);
        selectionHelper.dispose();
        selectionHelper = null;
      }
      if (name && scene && objects3D.has(name)) {
        const entry = objects3D.get(name)!;
        selectionHelper = new THREE.BoxHelper(entry.root, '#10b981');
        scene.add(selectionHelper);
      }
    };

    runtimeControlsRef.current = {
      invokeFn: (fnName: string) => {
        const fn = fnMap.get(fnName);
        if (fn) {
          try {
            fn();
          } catch (err: any) {
            setRuntimeError(err?.message || 'Callback error');
          }
        }
        const hooks = clickHooks.get(fnName);
        if (hooks) hooks.forEach(h => h());
        onEvent?.('clicked?', fnName);
        if (uiDirty) {
          setWidgets(Array.from(widgetMap.values()));
          uiDirty = false;
        }
      },
      setBoundVar: (varName: string, val: any) => {
        vars[varName] = val;
      },
      updateWidgetProp: (id: string, prop: string, val: any) => {
        const w = widgetMap.get(id);
        if (w) {
          w.props = { ...w.props, [prop]: val };
          if (w.props.bind) {
            vars[String(w.props.bind)] = val;
          }
          setWidgets(Array.from(widgetMap.values()));
        }
      },
      resetCamera: () => {
        saved3DCamRef.current = null;
        if (camera && controls) {
          camera.position.set(10, 8, 16);
          controls.target.set(0, 1, 0);
          controls.update();
        }
        world2D.camX = 0;
        world2D.camY = 0;
      },
      toggleWireframe: (enabled: boolean) => {
        disposableMats.forEach(m => {
          if ('wireframe' in m) {
            (m as any).wireframe = enabled;
          }
        });
      },
      syncSelectedFromProps: (next: SelectedVisualEntity) => {
        if (next.mode === '3d') {
          const entry = objects3D.get(next.name);
          if (entry) {
            entry.root.position.set(next.x, next.y, next.z);
            entry.root.scale.set(next.scale, next.scale, next.scale);
            entry.root.traverse(child => {
              const mat = (child as THREE.Mesh).material;
              if (mat && !Array.isArray(mat) && 'color' in mat && (mat as any).color?.set) {
                try {
                  (mat as THREE.MeshStandardMaterial).color.set(next.color);
                } catch {
                  // ignore
                }
              }
            });
            attachSelectionBox3D(next.name);
          }
        } else {
          const ent = entities2D.get(next.name);
          if (ent) {
            ent.x = next.x;
            ent.y = next.y;
            ent.w = next.w;
            ent.h = next.h;
            ent.color = next.color;
          }
        }
      },
      clearSelection: () => {
        attachSelectionBox3D(null);
      }
    };

    // Execute user DRPL code safely inside sandbox
    try {
      if (transpiled.jsCode.trim()) {
        const compiled = createDrplSandboxFunction(transpiled.jsCode);
        compiled(rt, Math);
      }
      if (wants3D && !renderer) {
        init3DBackend({});
      }
      // If 3D editor has no terrain/grid yet, mount a calibrated floor grid so empty Edit Visual looks sharp
      if (wants3D && scene && !Array.from(objects3D.values()).some(o => ['terrain3d', 'grid3d', 'plane3d'].includes(o.meta.kind))) {
        const editorGrid = new THREE.GridHelper(70, 35, '#10b981', '#1e293b');
        scene.add(editorGrid);
      }
      if (selectedEntityRef.current?.mode === '3d') {
        attachSelectionBox3D(selectedEntityRef.current.name);
      }
      startHooks.forEach(fn => fn());
    } catch (err: any) {
      setRuntimeError(err?.message || 'DRPL execution error');
    }

    if (uiDirty) {
      setWidgets(Array.from(widgetMap.values()));
      uiDirty = false;
    }

    // ====================== 3D & 2D EDIT VISUAL INTERACTION ======================
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let dragging3D: {
      name: string;
      kind: string;
      plane: THREE.Plane;
      offset: THREE.Vector3;
      moved: boolean;
      startY: number;
      startClientY: number;
    } | null = null;
    let pointerDownScreen: { x: number; y: number } | null = null;

    const findOwningEntry3D = (obj: THREE.Object3D | null): { name: string; entry: { root: THREE.Object3D; meta: Record<string, any> } } | null => {
      let cur: THREE.Object3D | null = obj;
      while (cur) {
        for (const [name, entry] of objects3D.entries()) {
          if (entry.root === cur) return { name, entry };
        }
        cur = cur.parent;
      }
      return null;
    };

    const pick3DFromPointer = (clientX: number, clientY: number) => {
      if (!renderer || !camera) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const candidates: THREE.Object3D[] = [];
      const floorCandidates: THREE.Object3D[] = [];
      objects3D.forEach(entry => {
        const k = String(entry.meta.kind || '');
        if (['sky3d', 'particles3d', 'grid3d', 'fog3d', 'trees3d', 'city3d', 'asteroids3d'].includes(k)) return;
        if (['terrain3d', 'water3d', 'plane3d'].includes(k)) floorCandidates.push(entry.root);
        else candidates.push(entry.root);
      });
      const hitsPrimary = raycaster.intersectObjects(candidates, true);
      if (hitsPrimary.length > 0) {
        const owner = findOwningEntry3D(hitsPrimary[0].object);
        if (owner) return { ...owner, point: hitsPrimary[0].point };
      }
      const hitsFloor = raycaster.intersectObjects(floorCandidates, true);
      if (hitsFloor.length > 0) {
        const owner = findOwningEntry3D(hitsFloor[0].object);
        if (owner) return { ...owner, point: hitsFloor[0].point };
      }
      return null;
    };

    const handle3DPointerDown = (e: PointerEvent) => {
      if (!editModeRef.current || e.button !== 0 || !renderer || !camera) return;
      pointerDownScreen = { x: e.clientX, y: e.clientY };
      const picked = pick3DFromPointer(e.clientX, e.clientY);
      if (picked) {
        const { name, entry } = picked;
        const pos = entry.root.position;
        const m = entry.meta;
        const nextSel: SelectedVisualEntity = {
          mode: '3d',
          name,
          kind: String(m.kind || 'box3d'),
          x: Number(pos.x.toFixed(2)),
          y: Number(pos.y.toFixed(2)),
          z: Number(pos.z.toFixed(2)),
          w: toNum(m.w, 2),
          h: toNum(m.h, 2),
          d: toNum(m.d, 2),
          radius: toNum(m.radius, 1),
          scale: toNum(entry.root.scale.x, toNum(m.scale, 1)),
          color: String(m.color || '#10b981')
        };
        setSelectedEntity(nextSel);
        attachSelectionBox3D(name);

        const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -pos.y);
        const planeHit = new THREE.Vector3();
        const intersected = raycaster.ray.intersectPlane(dragPlane, planeHit);
        const offset = intersected ? pos.clone().sub(intersected) : new THREE.Vector3();
        dragging3D = {
          name,
          kind: String(m.kind || 'box3d'),
          plane: dragPlane,
          offset,
          moved: false,
          startY: pos.y,
          startClientY: e.clientY
        };
        if (controls) controls.enabled = false;
      }
    };

    const handle3DPointerMove = (e: PointerEvent) => {
      if (!dragging3D || !renderer || !camera) return;
      const entry = objects3D.get(dragging3D.name);
      if (!entry) return;
      dragging3D.moved = true;
      if (e.shiftKey) {
        const dy = (dragging3D.startClientY - e.clientY) * 0.04;
        entry.root.position.y = Number((dragging3D.startY + dy).toFixed(2));
      } else {
        const rect = renderer.domElement.getBoundingClientRect();
        pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointerNdc, camera);
        const hit = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(dragging3D.plane, hit)) {
          entry.root.position.x = Number((hit.x + dragging3D.offset.x).toFixed(2));
          entry.root.position.z = Number((hit.z + dragging3D.offset.z).toFixed(2));
        }
      }
      if (selectionHelper) selectionHelper.update();
    };

    const handle3DPointerUp = (e: PointerEvent) => {
      if (controls) controls.enabled = true;
      if (dragging3D) {
        const dragSnap = dragging3D;
        dragging3D = null;
        pointerDownScreen = null;
        const entry = objects3D.get(dragSnap.name);
        if (entry && dragSnap.moved) {
          const p = entry.root.position;
          const rounded = {
            x: Number(p.x.toFixed(2)),
            y: Number(p.y.toFixed(2)),
            z: Number(p.z.toFixed(2))
          };
          setSelectedEntity(prev => (prev && prev.name === dragSnap.name ? { ...prev, ...rounded } : prev));
          onVisualPatchRef.current?.({
            type: 'update',
            mode: '3d',
            name: dragSnap.name,
            kind: dragSnap.kind,
            props: rounded
          });
        }
        return;
      }
      if (editModeRef.current && pointerDownScreen) {
        const dist = Math.hypot(e.clientX - pointerDownScreen.x, e.clientY - pointerDownScreen.y);
        if (dist < 4 && !pick3DFromPointer(e.clientX, e.clientY)) {
          setSelectedEntity(null);
          attachSelectionBox3D(null);
        }
      }
      pointerDownScreen = null;
    };

    const handle3DPointerCancel = () => {
      if (controls) controls.enabled = true;
      dragging3D = null;
      pointerDownScreen = null;
    };

    const webglCanvasEl = renderer?.domElement || null;
    if (webglCanvasEl) {
      webglCanvasEl.addEventListener('pointerdown', handle3DPointerDown);
      window.addEventListener('pointermove', handle3DPointerMove);
      window.addEventListener('pointerup', handle3DPointerUp);
      window.addEventListener('pointercancel', handle3DPointerCancel);
    }

    let dragging2D: { name: string; kind: string; offX: number; offY: number; moved: boolean } | null = null;
    const c2dEl = canvas2dRef.current;
    const handle2DPointerDown = (e: PointerEvent) => {
      if (!editModeRef.current || !wants2D || !c2dEl || e.button !== 0) return;
      const rect = c2dEl.getBoundingClientRect();
      const wx = e.clientX - rect.left + world2D.camX;
      const wy = e.clientY - rect.top + world2D.camY;
      const list = Array.from(entities2D.values()).reverse();
      const hit = list.find(ent => !ent.collected && wx >= ent.x && wx <= ent.x + ent.w && wy >= ent.y && wy <= ent.y + ent.h);
      if (hit) {
        const kindName = `${hit.kind}2d`;
        setSelectedEntity({
          mode: '2d',
          name: hit.name,
          kind: kindName,
          x: Math.round(hit.x),
          y: Math.round(hit.y),
          z: 0,
          w: Math.round(hit.w),
          h: Math.round(hit.h),
          d: 0,
          radius: hit.radius || Math.round(hit.w / 2),
          scale: 1,
          color: hit.color
        });
        dragging2D = {
          name: hit.name,
          kind: kindName,
          offX: wx - hit.x,
          offY: wy - hit.y,
          moved: false
        };
      } else {
        setSelectedEntity(null);
      }
    };
    const handle2DPointerMove = (e: PointerEvent) => {
      if (!dragging2D || !c2dEl) return;
      const ent = entities2D.get(dragging2D.name);
      if (!ent) return;
      const rect = c2dEl.getBoundingClientRect();
      const wx = e.clientX - rect.left + world2D.camX;
      const wy = e.clientY - rect.top + world2D.camY;
      ent.x = Math.round(wx - dragging2D.offX);
      ent.y = Math.round(wy - dragging2D.offY);
      ent.startX = ent.x;
      ent.startY = ent.y;
      dragging2D.moved = true;
    };
    const handle2DPointerUp = () => {
      if (!dragging2D) return;
      const dragSnap = dragging2D;
      dragging2D = null;
      const ent = entities2D.get(dragSnap.name);
      if (ent && dragSnap.moved) {
        const x = Math.round(ent.x);
        const y = Math.round(ent.y);
        setSelectedEntity(prev => (prev && prev.name === dragSnap.name ? { ...prev, x, y } : prev));
        onVisualPatchRef.current?.({
          type: 'update',
          mode: '2d',
          name: dragSnap.name,
          kind: dragSnap.kind,
          props: { x, y }
        });
      }
    };
    const handle2DPointerCancel = () => {
      dragging2D = null;
    };
    if (c2dEl && wants2D) {
      c2dEl.addEventListener('pointerdown', handle2DPointerDown);
      window.addEventListener('pointermove', handle2DPointerMove);
      window.addEventListener('pointerup', handle2DPointerUp);
      window.addEventListener('pointercancel', handle2DPointerCancel);
    }

    // Keyboard bindings for DRPL runtime & Edit Visual Delete shortcut
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (e.target as HTMLElement | null)?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if (editModeRef.current && (e.key === 'Delete' || e.key === 'Backspace') && selectedEntityRef.current) {
        e.preventDefault();
        const sel = selectedEntityRef.current;
        onVisualPatchRef.current?.({
          type: 'delete',
          mode: sel.mode,
          name: sel.name,
          kind: sel.kind,
          props: {}
        });
        setSelectedEntity(null);
        attachSelectionBox3D(null);
        return;
      }

      const k = e.key === ' ' ? 'space' : e.key.toLowerCase();
      keysPressed.add(k);
      const hooks = keyHooks.get(k);
      if (hooks) {
        hooks.forEach(h => {
          try {
            h();
          } catch {
            // ignore
          }
        });
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key === ' ' ? 'space' : e.key.toLowerCase();
      keysPressed.delete(k);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // ResizeObserver keeps 3D & 2D canvases sharp
    let resizeObserver: ResizeObserver | null = null;
    const handleResize = () => {
      const host = hostRef.current;
      if (!host) return;
      const w = Math.max(240, host.clientWidth);
      const h = Math.max(180, host.clientHeight);
      if (renderer && camera) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (composer) composer.setSize(w, h);
        if (bloomPass) bloomPass.resolution.set(w, h);
      }
      if (canvas2dRef.current) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas2dRef.current.width = Math.floor(w * dpr);
        canvas2dRef.current.height = Math.floor(h * dpr);
      }
    };
    if (hostRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(hostRef.current);
      handleResize();
    }

    // ====================== MAIN RENDER & OPTIMIZER LOOP ======================
    let rafId: number | null = null;
    let isDisposed = false;
    let lastTime = performance.now();
    let elapsed = 0;
    let fpsFrames = 0;
    let fpsClock = performance.now();
    let currentFps = 60;
    let lastUiSync = 0;
    const minFrameMs = isSoftwareGl ? 1000 / 24 : 1000 / headerTargetFps;
    let lastRenderAt = 0;

    const frustum = new THREE.Frustum();
    const projMatrix = new THREE.Matrix4();

    const step2D = (dt: number) => {
      const c2d = canvas2dRef.current;
      if (!c2d || !wants2D) return;
      const ctx = c2d.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewW = c2d.width / dpr;
      const viewH = c2d.height / dpr;

      // Update hero & enemies (paused when Edit Visual is active so objects stay where dragged)
      if (!editModeRef.current) {
        const platforms = Array.from(entities2D.values()).filter(e => e.kind === 'platform');
        entities2D.forEach(ent => {
          if (ent.kind === 'player') {
            let mx = 0;
            if (keysPressed.has('a') || keysPressed.has('arrowleft')) {
              mx = -1;
              ent.facing = -1;
            }
            if (keysPressed.has('d') || keysPressed.has('arrowright')) {
              mx = 1;
              ent.facing = 1;
            }
            ent.x += mx * ent.speed * dt;
            if ((keysPressed.has('w') || keysPressed.has('arrowup') || keysPressed.has('space')) && ent.grounded) {
              ent.vy = -ent.jump;
              ent.grounded = false;
              playProceduralSfx('jump', 0.28);
            }
            ent.vy += world2D.gravity * dt;
            ent.y += ent.vy * dt;
            ent.grounded = false;

            // Platform collisions
            for (const plat of platforms) {
              if (
                ent.x + ent.w > plat.x &&
                ent.x < plat.x + plat.w &&
                ent.y + ent.h >= plat.y &&
                ent.y + ent.h <= plat.y + 24 &&
                ent.vy >= 0
              ) {
                ent.y = plat.y - ent.h;
                ent.vy = 0;
                ent.grounded = true;
              }
            }

            if (ent.y + ent.h >= world2D.floorY) {
              ent.y = world2D.floorY - ent.h;
              ent.vy = 0;
              ent.grounded = true;
            }
          } else if (ent.kind === 'enemy') {
            if (ent.ai === 'hover') {
              ent.x = ent.startX + Math.sin(elapsed * 2) * 75;
              ent.y = ent.startY + Math.cos(elapsed * 3) * 18;
            } else {
              ent.x = ent.startX + Math.sin(elapsed * 1.4) * 95;
            }
          } else if (ent.spin) {
            ent.angle = (ent.angle || 0) + ent.spin * dt;
          }
        });

        // Collect coins, springs, hazards & checkpoints in 2D
        const hero = Array.from(entities2D.values()).find(e => e.kind === 'player');
        if (hero) {
          entities2D.forEach(ent => {
            const overlaps =
              hero.x < ent.x + ent.w &&
              hero.x + hero.w > ent.x &&
              hero.y < ent.y + ent.h &&
              hero.y + hero.h > ent.y;
            if (!overlaps) return;

            if (ent.kind === 'coin' && !ent.collected) {
              ent.collected = true;
              playProceduralSfx('coin', 0.32);
              spawn2DParticles(ent.x + 10, ent.y + 10, 16, ent.color, 150, 0.5);
              floaters2D.push({ text: `+${ent.value || 10}`, x: ent.x, y: ent.y - 10, color: '#facc15', life: 0.9 });
            } else if (ent.kind === 'spring' && hero.vy >= -40) {
              hero.vy = -(ent.jump || 680);
              hero.grounded = false;
              playProceduralSfx('jump', 0.35);
              spawn2DParticles(ent.x + ent.w / 2, ent.y, 12, ent.color, 130, 0.4);
            } else if (ent.kind === 'hazard') {
              hero.hp = Math.max(0, hero.hp - (ent.value || 20));
              hero.vy = -340;
              world2D.camShake = 6;
              playProceduralSfx('hit', 0.32);
              floaters2D.push({ text: `-${ent.value || 20}`, x: hero.x, y: hero.y - 12, color: '#ef4444', life: 0.85 });
              if (hero.hp <= 0) {
                hero.hp = hero.maxHp;
                hero.x = hero.startX;
                hero.y = hero.startY;
              }
            } else if (ent.kind === 'checkpoint' && !ent.collected) {
              ent.collected = true;
              playProceduralSfx('powerup', 0.36);
              spawn2DParticles(ent.x + ent.w / 2, ent.y, 26, ent.color, 190, 0.75);
              pushToast(`Checkpoint ${ent.name} reached!`, 'success');
            }
          });
        }

        // Bullets update & enemy hits
        for (let i = bullets2D.length - 1; i >= 0; i--) {
          const b = bullets2D[i];
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.life -= dt;
          let hit = false;
          entities2D.forEach(ent => {
            if (
              ent.kind === 'enemy' &&
              ent.hp > 0 &&
              b.x + b.radius > ent.x &&
              b.x - b.radius < ent.x + ent.w &&
              b.y + b.radius > ent.y &&
              b.y - b.radius < ent.y + ent.h
            ) {
              ent.hp -= 25;
              hit = true;
              world2D.camShake = 4;
              playProceduralSfx('hit', 0.3);
              spawn2DParticles(b.x, b.y, 18, ent.color, 180, 0.55);
              floaters2D.push({ text: '-25', x: ent.x + 10, y: ent.y - 12, color: '#f43f5e', life: 0.85 });
              if (ent.hp <= 0) {
                ent.hp = ent.maxHp;
                ent.startX = ent.startX + (Math.random() > 0.5 ? 60 : -60);
                floaters2D.push({ text: 'DESTROYED!', x: ent.x, y: ent.y - 26, color: '#38bdf8', life: 1.0 });
              }
            }
          });
          if (hit || b.life <= 0) bullets2D.splice(i, 1);
        }

        for (let i = lasers2D.length - 1; i >= 0; i--) {
          lasers2D[i].life -= dt;
          if (lasers2D[i].life <= 0) lasers2D.splice(i, 1);
        }

        for (let i = particles2D.length - 1; i >= 0; i--) {
          const p = particles2D[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 220 * dt;
          p.life -= dt;
          if (p.life <= 0) particles2D.splice(i, 1);
        }

        for (let i = floaters2D.length - 1; i >= 0; i--) {
          floaters2D[i].y -= 35 * dt;
          floaters2D[i].life -= dt;
          if (floaters2D[i].life <= 0) floaters2D.splice(i, 1);
        }

        if (weatherCfg.enabled) {
          for (const drop of weatherDrops) {
            drop.y += drop.speed * dt;
            if (weatherCfg.type === 'rain') drop.x -= 28 * dt;
            else if (weatherCfg.type === 'snow') drop.x += Math.sin(elapsed * 2 + drop.y * 0.05) * 25 * dt;
            if (drop.y > viewH + 10) {
              drop.y = -10;
              drop.x = Math.random() * (viewW + 120);
            }
          }
        }

        // Camera follow + trauma decay
        if (world2D.camFollow) {
          const target = entities2D.get(world2D.camFollow);
          if (target) {
            const targetCamX = target.x - viewW * 0.42;
            const targetCamY = Math.min(0, target.y - viewH * 0.55);
            world2D.camX += (targetCamX - world2D.camX) * world2D.camSmoothing;
            world2D.camY += (targetCamY - world2D.camY) * world2D.camSmoothing;
          }
        }
      } else {
        // Edit Visual 2D Camera Pan with WASD / Arrow Keys
        const panSpeed = 320;
        if (keysPressed.has('a') || keysPressed.has('arrowleft')) world2D.camX -= panSpeed * dt;
        if (keysPressed.has('d') || keysPressed.has('arrowright')) world2D.camX += panSpeed * dt;
        if (keysPressed.has('w') || keysPressed.has('arrowup')) world2D.camY -= panSpeed * dt;
        if (keysPressed.has('s') || keysPressed.has('arrowdown')) world2D.camY += panSpeed * dt;
      }
      world2D.camShake *= Math.pow(0.05, dt);
      const sx = editModeRef.current ? 0 : (Math.random() - 0.5) * world2D.camShake;
      const sy = editModeRef.current ? 0 : (Math.random() - 0.5) * world2D.camShake;

      // Draw 2D layers
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = world2D.bg;
      ctx.fillRect(0, 0, viewW, viewH);

      // Parallax cyber skyline
      if (world2D.hasParallax) {
        const layers = [
          { factor: 0.15, color: '#0b1324', hBase: 140, w: 68 },
          { factor: 0.35, color: '#111c33', hBase: 105, w: 48 }
        ];
        for (const layer of layers) {
          ctx.fillStyle = layer.color;
          const offset = (world2D.camX * layer.factor) % (layer.w + 18);
          for (let x = -offset - layer.w; x < viewW + layer.w; x += layer.w + 18) {
            const bh = layer.hBase + Math.abs(Math.sin(x * 0.03)) * 85;
            ctx.fillRect(x, world2D.floorY - bh, layer.w, bh);
          }
        }
      }

      ctx.save();
      ctx.translate(-world2D.camX + sx, -world2D.camY + sy);

      // Subtle 40px editor grid in 2D Edit Visual mode
      if (editModeRef.current) {
        const gridStep = 40;
        const startX = Math.floor(world2D.camX / gridStep) * gridStep;
        const endX = world2D.camX + viewW + gridStep;
        const startY = Math.floor(world2D.camY / gridStep) * gridStep;
        const endY = world2D.camY + viewH + gridStep;
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.10)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let gx = startX; gx <= endX; gx += gridStep) {
          ctx.moveTo(gx, startY);
          ctx.lineTo(gx, endY);
        }
        for (let gy = startY; gy <= endY; gy += gridStep) {
          ctx.moveTo(startX, gy);
          ctx.lineTo(endX, gy);
        }
        ctx.stroke();
      }

      // Tilemap floor
      if (world2D.hasTilemap) {
        ctx.fillStyle = world2D.tileColor;
        ctx.fillRect(world2D.camX - 100, world2D.floorY, viewW + 400, viewH);
        ctx.strokeStyle = world2D.tileAccent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(world2D.camX - 100, world2D.floorY);
        ctx.lineTo(world2D.camX + viewW + 300, world2D.floorY);
        ctx.stroke();
      }

      // Draw entities (classic + new 2D shapes)
      entities2D.forEach(ent => {
        if (ent.kind === 'coin' && ent.collected) return;
        const cx = ent.x + ent.w / 2;
        const cy = ent.y + ent.h / 2;

        if (ent.kind === 'platform') {
          ctx.fillStyle = ent.color;
          ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
          if (ent.glow) {
            ctx.strokeStyle = ent.glow;
            ctx.lineWidth = 2;
            ctx.strokeRect(ent.x, ent.y, ent.w, ent.h);
          }
        } else if (ent.kind === 'coin') {
          const bounce = editModeRef.current ? 0 : Math.sin(elapsed * 4 + ent.x) * 4;
          ctx.fillStyle = ent.color;
          ctx.beginPath();
          ctx.arc(cx, cy + bounce, ent.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (ent.kind === 'rect') {
          ctx.fillStyle = ent.color;
          ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
          if (ent.border) {
            ctx.strokeStyle = ent.border;
            ctx.lineWidth = 2;
            ctx.strokeRect(ent.x, ent.y, ent.w, ent.h);
          }
        } else if (ent.kind === 'triangle') {
          ctx.fillStyle = ent.color;
          ctx.beginPath();
          ctx.moveTo(cx, ent.y);
          ctx.lineTo(ent.x + ent.w, ent.y + ent.h);
          ctx.lineTo(ent.x, ent.y + ent.h);
          ctx.closePath();
          ctx.fill();
        } else if (ent.kind === 'circle') {
          const r = Math.min(ent.w, ent.h) / 2;
          ctx.fillStyle = ent.color;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        } else if (ent.kind === 'polygon') {
          const sides = Math.max(3, Math.min(12, ent.sides || 6));
          const r = Math.min(ent.w, ent.h) / 2;
          const angOff = ent.angle || 0;
          ctx.fillStyle = ent.color;
          ctx.beginPath();
          for (let i = 0; i < sides; i++) {
            const a = angOff + (i / sides) * Math.PI * 2 - Math.PI / 2;
            const px = cx + Math.cos(a) * r;
            const py = cy + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        } else if (ent.kind === 'line') {
          ctx.strokeStyle = ent.color;
          ctx.lineWidth = Math.max(2, Math.min(12, ent.h));
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(ent.x, cy);
          ctx.lineTo(ent.x + ent.w, cy);
          ctx.stroke();
        } else if (ent.kind === 'capsule') {
          const r = Math.min(ent.w, ent.h) / 2;
          ctx.fillStyle = ent.color;
          ctx.beginPath();
          ctx.roundRect(ent.x, ent.y, ent.w, ent.h, r);
          ctx.fill();
        } else if (ent.kind === 'sprite') {
          ctx.fillStyle = `${ent.color}28`;
          ctx.strokeStyle = ent.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(ent.x, ent.y, ent.w, ent.h, 8);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = ent.color;
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((ent.icon || ent.name).slice(0, 6).toUpperCase(), cx, cy);
          ctx.textAlign = 'start';
          ctx.textBaseline = 'alphabetic';
        } else if (ent.kind === 'checkpoint') {
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(cx - 2, ent.y, 4, ent.h);
          ctx.fillStyle = ent.collected ? '#22c55e' : ent.color;
          ctx.beginPath();
          ctx.moveTo(cx + 2, ent.y + 2);
          ctx.lineTo(cx + 26, ent.y + 12);
          ctx.lineTo(cx + 2, ent.y + 22);
          ctx.closePath();
          ctx.fill();
        } else if (ent.kind === 'spring') {
          ctx.fillStyle = '#334155';
          ctx.fillRect(ent.x + 4, ent.y + 6, ent.w - 8, ent.h - 6);
          ctx.fillStyle = ent.color;
          ctx.fillRect(ent.x, ent.y, ent.w, 8);
        } else if (ent.kind === 'hazard') {
          ctx.fillStyle = ent.color;
          const spikes = Math.max(3, Math.floor(ent.w / 14));
          const sw = ent.w / spikes;
          for (let si = 0; si < spikes; si++) {
            ctx.beginPath();
            ctx.moveTo(ent.x + si * sw, ent.y + ent.h);
            ctx.lineTo(ent.x + si * sw + sw / 2, ent.y);
            ctx.lineTo(ent.x + (si + 1) * sw, ent.y + ent.h);
            ctx.closePath();
            ctx.fill();
          }
        } else {
          ctx.fillStyle = ent.color;
          ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
          // Visor
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(ent.facing >= 0 ? ent.x + ent.w - 11 : ent.x + 3, ent.y + 8, 8, 5);
          // HP bar
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(ent.x, ent.y - 9, ent.w, 4);
          ctx.fillStyle = ent.kind === 'player' ? '#10b981' : '#f43f5e';
          ctx.fillRect(ent.x, ent.y - 9, ent.w * Math.max(0, ent.hp / ent.maxHp), 4);
        }

        // Draw crisp dashed selection outline + corner handles in Edit Visual mode
        if (editModeRef.current && selectedEntityRef.current?.mode === '2d' && selectedEntityRef.current.name === ent.name) {
          ctx.save();
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
          ctx.strokeRect(ent.x - 4, ent.y - 4, ent.w + 8, ent.h + 8);
          ctx.setLineDash([]);
          ctx.fillStyle = '#10b981';
          const handles = [
            [ent.x - 7, ent.y - 7],
            [ent.x + ent.w + 1, ent.y - 7],
            [ent.x - 7, ent.y + ent.h + 1],
            [ent.x + ent.w + 1, ent.y + ent.h + 1]
          ];
          for (const [hx, hy] of handles) ctx.fillRect(hx, hy, 6, 6);
          ctx.restore();
        }
      });

      // Weather particles
      if (weatherCfg.enabled && weatherDrops.length > 0) {
        ctx.fillStyle = weatherCfg.color;
        ctx.strokeStyle = weatherCfg.color;
        for (const drop of weatherDrops) {
          const dx = world2D.camX + drop.x;
          const dy = world2D.camY + drop.y;
          if (weatherCfg.type === 'rain') {
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(dx, dy);
            ctx.lineTo(dx - 3, dy + 10);
            ctx.stroke();
          } else {
            ctx.globalAlpha = 0.72;
            ctx.beginPath();
            ctx.arc(dx, dy, drop.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }

      // Lasers & Bullets & Particles & Floaters
      lasers2D.forEach(l => {
        ctx.globalAlpha = Math.max(0, l.life / l.maxLife);
        ctx.strokeStyle = l.color;
        ctx.lineWidth = l.width;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });

      bullets2D.forEach(b => {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      particles2D.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1;
      });

      floaters2D.forEach(f => {
        ctx.globalAlpha = Math.max(0, f.life);
        ctx.fillStyle = f.color;
        ctx.font = 'bold 13px monospace';
        ctx.fillText(f.text, f.x, f.y);
        ctx.globalAlpha = 1;
      });

      // Additive 2D lights
      if (world2D.lighting) {
        ctx.globalCompositeOperation = 'lighter';
        lights2D.forEach(lt => {
          const target = lt.follow ? entities2D.get(lt.follow) : null;
          const lx = target ? target.x + target.w / 2 : lt.x;
          const ly = target ? target.y + target.h / 2 : lt.y;
          const grad = ctx.createRadialGradient(lx, ly, 4, lx, ly, lt.radius);
          grad.addColorStop(0, `${lt.color}66`);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(lx, ly, lt.radius, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.restore();

      // Minimap Radar
      if (world2D.minimap) {
        const ms = world2D.minimapSize;
        const mx = viewW - ms - 14;
        const my = 14;
        ctx.fillStyle = 'rgba(10, 12, 14, 0.85)';
        ctx.strokeStyle = '#262b33';
        ctx.lineWidth = 1;
        ctx.fillRect(mx, my, ms, ms * 0.65);
        ctx.strokeRect(mx, my, ms, ms * 0.65);
        entities2D.forEach(ent => {
          if (ent.kind === 'coin' && ent.collected) return;
          const px = mx + Math.max(4, Math.min(ms - 6, (ent.x / 900) * ms));
          const py = my + Math.max(4, Math.min(ms * 0.65 - 6, (ent.y / 520) * (ms * 0.65)));
          ctx.fillStyle = ent.kind === 'player' ? '#10b981' : ent.kind === 'enemy' ? '#f43f5e' : '#facc15';
          ctx.fillRect(px, py, 4, 4);
        });
      }

      ctx.restore();
    };

    const tick = (now: number) => {
      if (isDisposed) return;
      rafId = requestAnimationFrame(tick);

      if (now - lastRenderAt < minFrameMs) return;
      lastRenderAt = now;

      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      if (!pausedRef.current) {
        elapsed += dt;

        // Step DRPL timer_tick? hooks
        for (const th of timerHooks) {
          th.elapsed += dt;
          if (th.elapsed >= th.interval) {
            th.elapsed -= th.interval;
            try {
              th.fn();
            } catch {
              // ignore
            }
          }
        }

        // Run user DRPL frame? / update? hooks
        for (const fn of updateHooks) {
          try {
            fn(dt, elapsed);
          } catch (err: any) {
            setRuntimeError(err?.message || 'DRPL update error');
            break;
          }
        }

        // Update 3D subsystem
        if (wants3D && renderer && scene && camera) {
          animatedUpdaters3D.forEach(u => u(dt, elapsed));

          // Edit Visual WASD + Arrow + E/Q Free-Fly Camera
          if (editModeRef.current && controls) {
            const flySpeed = (keysPressed.has('shift') ? 26 : 14) * dt;
            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            forward.y = 0;
            if (forward.lengthSq() > 0.0001) forward.normalize();
            const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
            const delta = new THREE.Vector3();
            if (keysPressed.has('w') || keysPressed.has('arrowup')) delta.addScaledVector(forward, flySpeed);
            if (keysPressed.has('s') || keysPressed.has('arrowdown')) delta.addScaledVector(forward, -flySpeed);
            if (keysPressed.has('d') || keysPressed.has('arrowright')) delta.addScaledVector(right, flySpeed);
            if (keysPressed.has('a') || keysPressed.has('arrowleft')) delta.addScaledVector(right, -flySpeed);
            if (keysPressed.has('e') || keysPressed.has('space')) delta.y += flySpeed * 0.8;
            if (keysPressed.has('q')) delta.y -= flySpeed * 0.8;
            if (delta.lengthSq() > 0) {
              camera.position.add(delta);
              controls.target.add(delta);
            }
            controls.update();
          } else if (camera3DConfig.mode === 'chase' && camera3DConfig.target) {
            const targetEntry = objects3D.get(String(camera3DConfig.target));
            if (targetEntry) {
              const targetPos = targetEntry.root.position;
              const dist = toNum(camera3DConfig.distance, 12);
              const chHeight = toNum(camera3DConfig.height, 4.5);
              const heading = Number(targetEntry.meta.heading || 0);
              const desiredX = targetPos.x - Math.sin(heading) * dist;
              const desiredZ = targetPos.z - Math.cos(heading) * dist;
              camera.position.lerp(new THREE.Vector3(desiredX, targetPos.y + chHeight, desiredZ), 1 - Math.pow(0.02, dt));
              if (controls) {
                controls.target.lerp(new THREE.Vector3(targetPos.x, targetPos.y + 1.2, targetPos.z), 0.18);
                controls.update();
              } else {
                camera.lookAt(targetPos.x, targetPos.y + 1.2, targetPos.z);
              }
            }
          } else if (controls) {
            controls.update();
          }

          if (controls) {
            saved3DCamRef.current = {
              pos: [camera.position.x, camera.position.y, camera.position.z],
              target: [controls.target.x, controls.target.y, controls.target.z]
            };
          }
          if (selectionHelper) selectionHelper.update();

          // Frustum & Distance Culling pass
          if (headerCulling) {
            camera.updateMatrixWorld();
            projMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
            frustum.setFromProjectionMatrix(projMatrix);
            let culled = 0;
            objects3D.forEach(entry => {
              if (['terrain', 'sky', 'particles', 'light', 'trees', 'city', 'asteroids'].some(k => String(entry.meta.kind || '').includes(k))) {
                return;
              }
              if (entry.meta.collected) return;
              const d = entry.root.position.distanceTo(camera!.position);
              if (d > 140) {
                entry.root.visible = false;
                culled++;
              } else if (entry.meta.kind !== 'pickup3d') {
                entry.root.visible = true;
              }
            });
            culledCount = culled;
          }

          if (composer) {
            composer.render();
          } else {
            renderer.render(scene, camera);
          }
        }

        // Update 2D Canvas subsystem
        if (wants2D) {
          step2D(dt);
        }

        for (const fn of renderHooks) {
          try {
            fn(dt, elapsed);
          } catch {
            // ignore
          }
        }
      } else if (wants3D && renderer && scene && camera) {
        if (controls) {
          controls.update();
          saved3DCamRef.current = {
            pos: [camera.position.x, camera.position.y, camera.position.z],
            target: [controls.target.x, controls.target.y, controls.target.z]
          };
        }
        if (selectionHelper) selectionHelper.update();
        if (composer) composer.render();
        else renderer.render(scene, camera);
      }

      // Sync reactive UI widgets throttled to ~18Hz to avoid React re-render overhead
      const hasSpectrum = Array.from(widgetMap.values()).some(w => w.kind === 'ui_spectrum');
      if ((uiDirty && now - lastUiSync > 55) || (hasSpectrum && !pausedRef.current && now - lastUiSync > 120)) {
        setWidgets(Array.from(widgetMap.values()));
        uiDirty = false;
        lastUiSync = now;
      }

      // FPS & Optimizer Telemetry readout
      fpsFrames++;
      if (now - fpsClock >= 500) {
        currentFps = Math.round((fpsFrames * 1000) / (now - fpsClock));
        fpsFrames = 0;
        fpsClock = now;
        setStats({
          fps: currentFps,
          drawCalls: renderer?.info.render.calls || 0,
          triangles: renderer?.info.render.triangles || 0,
          entities3d: objects3D.size,
          entities2d: entities2D.size,
          uiWidgets: widgetMap.size,
          instancedCount: instancedEntityCount,
          culledCount,
          mode: wants3D && wants2D ? 'hybrid' : wants3D ? '3d' : wants2D ? '2d' : 'app',
          backend: wants3D ? (isSoftwareGl ? 'software-gl' : 'webgl2') : wants2D ? 'canvas2d' : 'hud'
        });
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      isDisposed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (webglCanvasEl) {
        webglCanvasEl.removeEventListener('pointerdown', handle3DPointerDown);
        window.removeEventListener('pointermove', handle3DPointerMove);
        window.removeEventListener('pointerup', handle3DPointerUp);
        window.removeEventListener('pointercancel', handle3DPointerCancel);
      }
      if (c2dEl && wants2D) {
        c2dEl.removeEventListener('pointerdown', handle2DPointerDown);
        window.removeEventListener('pointermove', handle2DPointerMove);
        window.removeEventListener('pointerup', handle2DPointerUp);
        window.removeEventListener('pointercancel', handle2DPointerCancel);
      }
      if (selectionHelper) {
        selectionHelper.dispose();
        selectionHelper = null;
      }

      if (controls) controls.dispose();
      if (composer) composer.dispose();
      if (envRenderTarget) envRenderTarget.dispose();
      if (roomEnv && typeof (roomEnv as any).dispose === 'function') (roomEnv as any).dispose();
      if (pmremGenerator) pmremGenerator.dispose();
      disposableGeos.forEach(g => g.dispose());
      disposableMats.forEach(m => m.dispose());
      disposableTex.forEach(t => t.dispose());
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
    };
  }, [drplCode, headerMode, headerQuality, headerShadows, headerBloom, headerCulling, headerTargetFps, playProceduralSfx]);

  const bgColor = appMeta.bg || '#0a0c0e';

  return (
    <div
      ref={hostRef}
      className="relative w-full h-full overflow-hidden select-none"
      style={{ backgroundColor: bgColor }}
    >
      {/* 3D WebGL Viewport Container */}
      <div ref={webglContainerRef} className="absolute inset-0 w-full h-full" />

      {/* 2D HiDPI Layered Canvas */}
      <canvas
        ref={canvas2dRef}
        className={clsx(
          'absolute inset-0 w-full h-full',
          editMode && (stats.backend === 'canvas2d' || stats.mode === 'hybrid')
            ? 'pointer-events-auto cursor-crosshair'
            : 'pointer-events-none',
          stats.backend === 'canvas2d' ? 'z-[1]' : 'z-[2]'
        )}
      />

      {/* Interactive App UI & HUD Layer */}
      {widgets.length > 0 && (
        <div className="absolute inset-0 z-[5] pointer-events-none overflow-auto">
          {widgets.map(w => {
            const p = w.props;
            const x = toNum(p.x, 20);
            const y = toNum(p.y, 20);

            if (w.kind === 'ui_card') {
              const accent = String(p.accent || '#10b981');
              return (
                <div
                  key={w.id}
                  style={{
                    left: x,
                    top: y,
                    width: toNum(p.w, 200),
                    height: toNum(p.h, 100),
                    borderColor: `${accent}66`
                  }}
                  className="pointer-events-auto absolute rounded-xl border bg-[#111315]/92 p-3 flex flex-col justify-between shadow-lg"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF] truncate">
                    {String(p.title || 'METRIC')}
                  </div>
                  <div className="text-xl font-bold font-mono truncate" style={{ color: accent }}>
                    {String(p.value ?? '0')}
                  </div>
                  {p.subtitle && (
                    <div className="text-[11px] text-[#6B7280] truncate">{String(p.subtitle)}</div>
                  )}
                </div>
              );
            }

            if (w.kind === 'ui_gauge') {
              const size = toNum(p.size, 130);
              const min = toNum(p.min, 0);
              const max = Math.max(min + 1, toNum(p.max, 100));
              const val = Math.max(min, Math.min(max, toNum(p.value, 0)));
              const ratio = (val - min) / (max - min);
              const r = 42;
              const circ = Math.PI * r;
              const dashOffset = circ * (1 - ratio);
              return (
                <div
                  key={w.id}
                  style={{ left: x, top: y, width: size, height: size }}
                  className="pointer-events-auto absolute rounded-xl border border-[#262B33] bg-[#111315]/90 p-2.5 flex flex-col items-center justify-center shadow-lg"
                >
                  <svg viewBox="0 0 100 62" className="w-full h-auto overflow-visible">
                    <path
                      d="M 8 54 A 42 42 0 0 1 92 54"
                      fill="none"
                      stroke="#262B33"
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 8 54 A 42 42 0 0 1 92 54"
                      fill="none"
                      stroke={String(p.color || '#38bdf8')}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={circ}
                      strokeDashoffset={dashOffset}
                    />
                  </svg>
                  <div className="-mt-4 text-center">
                    <div className="text-base font-bold font-mono text-[#F3F4F6]">
                      {Math.round(val)}{' '}
                      <span className="text-[10px] text-[#9CA3AF]">{String(p.unit || '')}</span>
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                      {String(p.label || 'GAUGE')}
                    </div>
                  </div>
                </div>
              );
            }

            if (w.kind === 'ui_chart') {
              const values: number[] = Array.isArray(p.values) && p.values.length > 1 ? p.values.map(Number) : [10, 20, 15, 30];
              const cw = toNum(p.w, 360);
              const ch = toNum(p.h, 170);
              const maxVal = Math.max(1, ...values);
              const minVal = Math.min(0, ...values);
              const span = Math.max(1, maxVal - minVal);
              const pts = values
                .map((v, i) => {
                  const px = (i / (values.length - 1)) * 100;
                  const py = 100 - ((v - minVal) / span) * 86 - 6;
                  return `${px.toFixed(1)},${py.toFixed(1)}`;
                })
                .join(' ');
              const col = String(p.color || '#10b981');
              return (
                <div
                  key={w.id}
                  style={{ left: x, top: y, width: cw, height: ch }}
                  className="pointer-events-auto absolute rounded-xl border border-[#262B33] bg-[#111315]/92 p-3 flex flex-col shadow-lg"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-[#E5E7EB] mb-2">
                    <span>{String(p.title || 'Chart')}</span>
                    <span className="font-mono text-[11px]" style={{ color: col }}>
                      {values[values.length - 1]}
                    </span>
                  </div>
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="flex-1 w-full">
                    <polyline fill="none" stroke={col} strokeWidth="2.4" points={pts} />
                    {String(p.type || 'area') === 'area' && (
                      <polygon fill={col} fillOpacity="0.16" points={`0,100 ${pts} 100,100`} />
                    )}
                  </svg>
                </div>
              );
            }

            if (w.kind === 'ui_spectrum') {
              const bars = Math.min(32, Math.max(8, toNum(p.bars, 24)));
              const col = String(p.color || '#38bdf8');
              const nowPhase = Date.now() * 0.004;
              return (
                <div
                  key={w.id}
                  style={{ left: x, top: y, width: toNum(p.w, 280), height: toNum(p.h, 160) }}
                  className="pointer-events-auto absolute rounded-xl border border-[#262B33] bg-[#111315]/92 p-3 flex flex-col shadow-lg"
                >
                  <div className="text-xs font-semibold text-[#E5E7EB] mb-2">
                    {String(p.title || 'Spectrum')}
                  </div>
                  <div className="flex-1 flex items-end gap-1">
                    {Array.from({ length: bars }).map((_, idx) => {
                      const pct = Math.round(
                        22 + Math.abs(Math.sin(nowPhase + idx * 0.45) * Math.cos(idx * 0.3)) * 75
                      );
                      return (
                        <div
                          key={idx}
                          className="flex-1 rounded-t-sm transition-all duration-150"
                          style={{ height: `${pct}%`, backgroundColor: col, opacity: 0.85 }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            }

            if (w.kind === 'ui_button') {
              return (
                <button
                  key={w.id}
                  type="button"
                  style={{
                    left: x,
                    top: y,
                    width: toNum(p.w, 160),
                    height: toNum(p.h, 38),
                    backgroundColor: String(p.color || '#10b981')
                  }}
                  onClick={() => {
                    runtimeControlsRef.current.invokeFn(String(p.onClick || w.id));
                    onEvent?.('clicked?', String(p.id || w.id), String(p.onClick || ''));
                  }}
                  className="pointer-events-auto absolute rounded-lg font-bold text-xs text-[#0A0C0E] shadow-md hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer px-3 truncate"
                >
                  {String(p.label || 'Action')}
                </button>
              );
            }

            if (w.kind === 'ui_slider') {
              const min = toNum(p.min, 0);
              const max = toNum(p.max, 100);
              const step = toNum(p.step, 1);
              const val = toNum(p.value, min);
              return (
                <div
                  key={w.id}
                  style={{ left: x, top: y, width: toNum(p.w, 210) }}
                  className="pointer-events-auto absolute rounded-xl border border-[#262B33] bg-[#111315]/92 px-3 py-2 shadow-lg"
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-[#D1D5DB] font-medium truncate">{String(p.label || 'Value')}</span>
                    <span className="font-mono text-[#10B981] font-semibold">{val}</span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={val}
                    onChange={e =>
                      runtimeControlsRef.current.updateWidgetProp(w.id, 'value', Number(e.target.value))
                    }
                    className="w-full accent-[#10B981] cursor-pointer"
                  />
                </div>
              );
            }

            if (w.kind === 'ui_toggle') {
              const checked = toBool(p.checked, false);
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => runtimeControlsRef.current.updateWidgetProp(w.id, 'checked', !checked)}
                  style={{ left: x, top: y }}
                  className="pointer-events-auto absolute rounded-xl border border-[#262B33] bg-[#111315]/92 px-3 py-2 flex items-center gap-2.5 shadow-lg cursor-pointer"
                >
                  <span className="text-xs font-medium text-[#E5E7EB]">{String(p.label || 'Toggle')}</span>
                  <span
                    className={clsx(
                      'w-9 h-5 rounded-full p-0.5 transition-colors flex items-center',
                      checked ? 'bg-[#10B981] justify-end' : 'bg-[#262B33] justify-start'
                    )}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                  </span>
                </button>
              );
            }

            if (w.kind === 'ui_progress') {
              const val = toNum(p.value, 50);
              const max = Math.max(1, toNum(p.max, 100));
              const pct = Math.max(0, Math.min(100, Math.round((val / max) * 100)));
              return (
                <div
                  key={w.id}
                  style={{ left: x, top: y, width: toNum(p.w, 260) }}
                  className="pointer-events-auto absolute rounded-xl border border-[#262B33] bg-[#111315]/92 px-3 py-2 shadow-lg"
                >
                  <div className="flex justify-between text-[11px] font-semibold mb-1.5">
                    <span className="text-[#E5E7EB]">{String(p.label || 'Progress')}</span>
                    <span className="font-mono text-[#9CA3AF]">
                      {Math.round(val)}/{max}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#262B33] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-150"
                      style={{ width: `${pct}%`, backgroundColor: String(p.color || '#10b981') }}
                    />
                  </div>
                </div>
              );
            }

            if (w.kind === 'ui_tabs') {
              const tabs: string[] = Array.isArray(p.tabs) ? p.tabs : ['Tab 1', 'Tab 2'];
              const active = String(p.active || tabs[0]);
              return (
                <div
                  key={w.id}
                  style={{ left: x, top: y }}
                  className="pointer-events-auto absolute inline-flex gap-1 rounded-xl border border-[#262B33] bg-[#111315]/92 p-1 shadow-lg"
                >
                  {tabs.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => runtimeControlsRef.current.updateWidgetProp(w.id, 'active', t)}
                      className={clsx(
                        'px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                        active === t ? 'bg-[#10B981] text-[#0A0C0E]' : 'text-[#9CA3AF] hover:text-white'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              );
            }

            if (w.kind === 'ui_table') {
              const cols: string[] = Array.isArray(p.columns) ? p.columns : ['Item', 'Value'];
              const rows: any[][] = Array.isArray(p.rows) ? p.rows : [];
              return (
                <div
                  key={w.id}
                  style={{ left: x, top: y, width: toNum(p.w, 300) }}
                  className="pointer-events-auto absolute rounded-xl border border-[#262B33] bg-[#111315]/92 p-3 shadow-lg overflow-hidden"
                >
                  {p.title && <div className="text-xs font-semibold text-[#E5E7EB] mb-2">{String(p.title)}</div>}
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-[#262B33] text-[#9CA3AF]">
                        {cols.map((c, idx) => (
                          <th key={idx} className="pb-1 font-medium">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262B33]/60 text-[#E5E7EB] font-mono">
                      {rows.map((r, rIdx) => (
                        <tr key={rIdx}>
                          {r.map((cell, cIdx) => (
                            <td key={cIdx} className="py-1">
                              {String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }

            if (w.kind === 'ui_terminal') {
              const lines: string[] = Array.isArray(p.lines) ? p.lines : [];
              return (
                <div
                  key={w.id}
                  style={{ left: x, top: y, width: toNum(p.w, 360), height: toNum(p.h, 130) }}
                  className="pointer-events-auto absolute rounded-xl border border-[#262B33] bg-[#07090b]/95 p-2.5 flex flex-col shadow-lg"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">
                    {String(p.title || 'Console')}
                  </div>
                  <div className="flex-1 overflow-y-auto font-mono text-[11px] text-[#10B981] space-y-0.5">
                    {lines.map((ln, idx) => (
                      <div key={idx} className="truncate">
                        {ln}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (w.kind === 'ui_input') {
              return (
                <input
                  key={w.id}
                  type="text"
                  value={String(p.value ?? '')}
                  placeholder={String(p.placeholder || 'Enter value...')}
                  onChange={e => runtimeControlsRef.current.updateWidgetProp(w.id, 'value', e.target.value)}
                  style={{ left: x, top: y, width: toNum(p.w, 220) }}
                  className="pointer-events-auto absolute rounded-lg border border-[#262B33] bg-[#111315]/95 px-3 py-1.5 text-xs text-[#F3F4F6] focus:outline-none focus:border-[#10B981]"
                />
              );
            }

            if (w.kind === 'ui_badge') {
              const col = String(p.color || '#10b981');
              return (
                <div
                  key={w.id}
                  style={{
                    left: x,
                    top: y,
                    color: col,
                    borderColor: `${col}55`,
                    backgroundColor: `${col}1E`
                  }}
                  className="pointer-events-auto absolute px-2.5 py-1 rounded-md border text-[11px] font-mono font-bold uppercase tracking-wider shadow"
                >
                  {String(p.text || 'LIVE')}
                </div>
              );
            }

            if (w.kind === 'ui_avatar') {
              const col = String(p.color || '#10b981');
              const nm = String(p.name || 'DRPL');
              const initials = nm
                .split(/\s+/)
                .map(s => s[0] || '')
                .join('')
                .slice(0, 2)
                .toUpperCase();
              return (
                <div
                  key={w.id}
                  style={{ left: x, top: y }}
                  className="pointer-events-auto absolute flex items-center gap-2.5 px-3 py-2 rounded-xl border border-[#262B33] bg-[#111315]/94 shadow-lg"
                >
                  <div
                    style={{ backgroundColor: `${col}22`, borderColor: `${col}66`, color: col }}
                    className="w-8 h-8 rounded-lg border flex items-center justify-center font-mono text-xs font-bold"
                  >
                    {initials || 'DR'}
                  </div>
                  <div className="leading-tight">
                    <div className="text-xs font-semibold text-[#F3F4F6]">{nm}</div>
                    {p.role && <div className="text-[10px] text-[#9CA3AF]">{String(p.role)}</div>}
                  </div>
                </div>
              );
            }

            if (w.kind === 'ui_code') {
              return (
                <div
                  key={w.id}
                  style={{ left: x, top: y, width: toNum(p.w, 340) }}
                  className="pointer-events-auto absolute rounded-xl border border-[#262B33] bg-[#090B0E]/95 p-3 shadow-lg"
                >
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#9CA3AF] mb-1.5">
                    {String(p.lang || 'drpl')}
                  </div>
                  <pre className="text-[11px] font-mono text-[#38BDF8] overflow-x-auto whitespace-pre-wrap">
                    {String(p.code || '// empty')}
                  </pre>
                </div>
              );
            }

            if (w.kind === 'ui_modal') {
              if (!toBool(p.open, true)) return null;
              return (
                <div
                  key={w.id}
                  style={{ left: x, top: y, width: toNum(p.w, 320) }}
                  className="pointer-events-auto absolute rounded-xl border border-[#323844] bg-[#111315]/96 p-4 shadow-2xl space-y-2.5 z-10"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-bold text-[#F3F4F6]">{String(p.title || 'Modal')}</div>
                    <button
                      type="button"
                      onClick={() => runtimeControlsRef.current.updateWidgetProp(w.id, 'open', false)}
                      className="px-2 py-0.5 rounded border border-[#262B33] text-[10px] font-mono text-[#9CA3AF] hover:text-white cursor-pointer"
                    >
                      ESC
                    </button>
                  </div>
                  <div className="text-xs text-[#D1D5DB] leading-relaxed">{String(p.body || '')}</div>
                </div>
              );
            }

            if (w.kind === 'ui_inventory') {
              const items: string[] = Array.isArray(p.items) ? p.items : ['Plasma', 'Nitro', 'Shield', 'Key'];
              const activeIdx = toNum(p.activeIndex, 0);
              const col = String(p.color || '#f59e0b');
              return (
                <div
                  key={w.id}
                  style={{ left: x, top: y, width: toNum(p.w, 280) }}
                  className="pointer-events-auto absolute rounded-xl border border-[#262B33] bg-[#111315]/92 p-3 shadow-lg"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-2">
                    {String(p.title || 'Inventory')}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {items.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          runtimeControlsRef.current.updateWidgetProp(w.id, 'activeIndex', idx);
                          playProceduralSfx('click', 0.25);
                        }}
                        style={idx === activeIdx ? { borderColor: col, backgroundColor: `${col}22`, color: col } : undefined}
                        className={clsx(
                          'px-1.5 py-2 rounded-lg border text-[11px] font-mono font-semibold truncate cursor-pointer transition-colors',
                          idx === activeIdx ? '' : 'border-[#262B33] bg-[#0A0C0E] text-[#D1D5DB] hover:border-[#374151]'
                        )}
                      >
                        {String(item)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            if (w.kind === 'ui_statbar') {
              const hp = Math.max(0, toNum(p.hp, 85));
              const maxHp = Math.max(1, toNum(p.maxHp, 100));
              const mana = Math.max(0, toNum(p.mana, 60));
              const maxMana = Math.max(1, toNum(p.maxMana, 100));
              return (
                <div
                  key={w.id}
                  style={{ left: x, top: y, width: toNum(p.w, 230) }}
                  className="pointer-events-auto absolute rounded-xl border border-[#262B33] bg-[#111315]/92 p-2.5 shadow-lg space-y-1.5"
                >
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-emerald-400 font-bold">HP</span>
                    <span className="text-[#E5E7EB]">{Math.round(hp)}/{maxHp}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#262B33] overflow-hidden">
                    <div className="h-full bg-[#10B981]" style={{ width: `${Math.min(100, (hp / maxHp) * 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono pt-0.5">
                    <span className="text-sky-400 font-bold">ENERGY</span>
                    <span className="text-[#E5E7EB]">{Math.round(mana)}/{maxMana}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#262B33] overflow-hidden">
                    <div className="h-full bg-[#38BDF8]" style={{ width: `${Math.min(100, (mana / maxMana) * 100)}%` }} />
                  </div>
                </div>
              );
            }

            if (w.kind === 'ui_timer') {
              const sec = Math.max(0, Math.round(toNum(p.seconds, 90)));
              const mm = String(Math.floor(sec / 60)).padStart(2, '0');
              const ss = String(sec % 60).padStart(2, '0');
              const col = String(p.color || '#38bdf8');
              return (
                <div
                  key={w.id}
                  style={{ left: x, top: y }}
                  className="pointer-events-auto absolute rounded-xl border border-[#262B33] bg-[#111315]/92 px-3.5 py-2 shadow-lg text-center"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                    {String(p.label || 'TIMER')}
                  </div>
                  <div className="text-xl font-bold font-mono tabular-nums" style={{ color: col }}>
                    {mm}:{ss}
                  </div>
                </div>
              );
            }

            if (w.kind === 'ui_chat') {
              const msgs: string[] = Array.isArray(p.messages) ? p.messages : [];
              return (
                <div
                  key={w.id}
                  style={{ left: x, top: y, width: toNum(p.w, 280), height: toNum(p.h, 145) }}
                  className="pointer-events-auto absolute rounded-xl border border-[#262B33] bg-[#111315]/92 p-3 flex flex-col shadow-lg"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
                    {String(p.title || 'Mission Feed')}
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1 text-xs text-[#E5E7EB]">
                    {msgs.map((m, idx) => (
                      <div key={idx} className="px-2 py-1 rounded bg-[#0A0C0E] border border-[#22262E] truncate">
                        {String(m)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (w.kind === 'ui_grid') {
              const btns: string[] = Array.isArray(p.buttons) ? p.buttons : ['Action 1', 'Action 2', 'Action 3', 'Action 4'];
              const col = String(p.color || '#2dd4bf');
              return (
                <div
                  key={w.id}
                  style={{ left: x, top: y, width: toNum(p.w, 240) }}
                  className="pointer-events-auto absolute rounded-xl border border-[#262B33] bg-[#111315]/92 p-3 shadow-lg"
                >
                  {p.title && (
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-2">
                      {String(p.title)}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-1.5">
                    {btns.map((bLabel, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          playProceduralSfx('click', 0.25);
                          const toastId = Date.now() + Math.random();
                          setToasts(prev => [...prev.slice(-3), { id: toastId, text: `Command: ${bLabel}`, type: 'info' }]);
                          window.setTimeout(() => {
                            setToasts(prev => prev.filter(t => t.id !== toastId));
                          }, 2200);
                          onEvent?.('clicked?', String(bLabel), String(bLabel));
                        }}
                        style={{ borderColor: `${col}44`, color: col }}
                        className="px-2 py-1.5 rounded-lg border bg-[#0A0C0E] hover:bg-[#1A1F26] text-xs font-semibold truncate cursor-pointer"
                      >
                        {String(bLabel)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            // ui_text fallback
            return (
              <div
                key={w.id}
                style={{
                  left: x,
                  top: y,
                  color: String(p.color || '#f8fafc'),
                  fontSize: toNum(p.size, 15)
                }}
                className="pointer-events-auto absolute font-bold drop-shadow"
              >
                {String(p.text || '')}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Visual Overlay HUD (Quick-Add Palette + Selected Object Inspector) */}
      {editMode && (
        <div className="absolute inset-x-3 top-3 z-20 flex flex-wrap items-start justify-between gap-2 pointer-events-none">
          {/* Left: Quick-Add Shape & Entity Palette */}
          <div className="pointer-events-auto max-w-[68%] rounded-xl border border-[#10B981]/45 bg-[#111315]/94 p-2 shadow-2xl space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-[10px] font-mono text-[#10B981]">
              <span className="flex items-center gap-1 font-bold uppercase tracking-wider">
                <Move className="w-3 h-3" />
                <span>Edit Visual ({stats.backend === 'canvas2d' ? '2D' : '3D'})</span>
              </span>
              <span className="text-[#9CA3AF] hidden sm:inline">
                WASD: Cam • Drag: Move • Shift+Drag: Y • Del: Remove
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {(stats.backend === 'canvas2d'
                ? [
                    { kind: 'rect2d', label: 'Rect', color: '#38bdf8' },
                    { kind: 'triangle2d', label: 'Triangle', color: '#f97316' },
                    { kind: 'circle2d', label: 'Circle', color: '#a855f7' },
                    { kind: 'polygon2d', label: 'Polygon', color: '#ec4899' },
                    { kind: 'line2d', label: 'Line', color: '#22d3ee' },
                    { kind: 'capsule2d', label: 'Capsule', color: '#84cc16' },
                    { kind: 'platform2d', label: 'Platform', color: '#64748b' },
                    { kind: 'coin2d', label: 'Coin', color: '#facc15' },
                    { kind: 'player2d', label: 'Hero', color: '#10b981' },
                    { kind: 'enemy2d', label: 'Enemy', color: '#f43f5e' }
                  ]
                : [
                    { kind: 'box3d', label: 'Box', color: '#38bdf8' },
                    { kind: 'pyramid3d', label: 'Pyramid', color: '#f97316' },
                    { kind: 'cone3d', label: 'Cone', color: '#f59e0b' },
                    { kind: 'sphere3d', label: 'Sphere', color: '#a855f7' },
                    { kind: 'cylinder3d', label: 'Cylinder', color: '#14b8a6' },
                    { kind: 'torus3d', label: 'Torus', color: '#ec4899' },
                    { kind: 'capsule3d', label: 'Capsule', color: '#84cc16' },
                    { kind: 'plane3d', label: 'Plane', color: '#64748b' },
                    { kind: 'light3d', label: 'Light', color: '#facc15' }
                  ]
              ).map(item => (
                <button
                  key={item.kind}
                  type="button"
                  onClick={() => {
                    const is2d = stats.backend === 'canvas2d';
                    const prefix = item.kind.replace(/(3d|2d)$/, '');
                    const newName = `${prefix}_${Math.floor(10 + Math.random() * 89)}`;
                    const baseProps: Record<string, any> = is2d
                      ? { x: 180, y: 200, color: item.color }
                      : {
                          x: 0,
                          y: item.kind === 'plane3d' ? 0 : item.kind === 'light3d' ? 6 : 1.5,
                          z: 0,
                          color: item.color
                        };
                    onVisualPatch?.({
                      type: 'add',
                      mode: is2d ? '2d' : '3d',
                      name: newName,
                      kind: item.kind,
                      props: baseProps
                    });
                    setSelectedEntity({
                      mode: is2d ? '2d' : '3d',
                      name: newName,
                      kind: item.kind,
                      x: baseProps.x,
                      y: baseProps.y,
                      z: baseProps.z || 0,
                      w: is2d ? 72 : 2,
                      h: is2d ? 64 : 2,
                      d: is2d ? 0 : 2,
                      radius: 1,
                      scale: 1,
                      color: item.color
                    });
                  }}
                  style={{ borderColor: `${item.color}55`, color: item.color, backgroundColor: `${item.color}16` }}
                  className="px-2 py-1 rounded-md border text-[11px] font-mono font-bold flex items-center gap-1 hover:brightness-125 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Selected Object Transform & Color Inspector */}
          {selectedEntity && (
            <div className="pointer-events-auto w-56 rounded-xl border border-[#262B33] bg-[#111315]/95 p-2.5 shadow-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2 border-b border-[#262B33] pb-1.5">
                <div className="min-w-0">
                  <div className="font-mono font-bold text-[#10B981] truncate">{selectedEntity.name}</div>
                  <div className="text-[10px] font-mono text-[#9CA3AF]">{selectedEntity.kind}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onVisualPatch?.({
                      type: 'delete',
                      mode: selectedEntity.mode,
                      name: selectedEntity.name,
                      kind: selectedEntity.kind,
                      props: {}
                    });
                    setSelectedEntity(null);
                    runtimeControlsRef.current.clearSelection();
                  }}
                  className="p-1.5 rounded-md border border-red-500/40 bg-red-500/15 text-red-400 hover:bg-red-500/25 cursor-pointer"
                  title="Delete Object"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px]">
                {(['x', 'y', ...(selectedEntity.mode === '3d' ? ['z'] : [])] as const).map(axis => (
                  <label key={axis} className="block">
                    <span className="text-[10px] uppercase text-[#9CA3AF]">{axis}</span>
                    <input
                      type="number"
                      step={selectedEntity.mode === '3d' ? '0.2' : '5'}
                      value={selectedEntity[axis]}
                      onChange={e => {
                        const val = Number(e.target.value);
                        if (!Number.isFinite(val)) return;
                        const next = { ...selectedEntity, [axis]: val };
                        setSelectedEntity(next);
                        runtimeControlsRef.current.syncSelectedFromProps(next);
                      }}
                      onBlur={() => {
                        onVisualPatch?.({
                          type: 'update',
                          mode: selectedEntity.mode,
                          name: selectedEntity.name,
                          kind: selectedEntity.kind,
                          props: {
                            x: selectedEntity.x,
                            y: selectedEntity.y,
                            ...(selectedEntity.mode === '3d' ? { z: selectedEntity.z } : {})
                          }
                        });
                      }}
                      className="w-full mt-0.5 px-1.5 py-1 rounded border border-[#262B33] bg-[#0A0C0E] text-[#F3F4F6] focus:outline-none focus:border-[#10B981]"
                    />
                  </label>
                ))}
              </div>

              {selectedEntity.mode === '3d' ? (
                <label className="block font-mono text-[11px]">
                  <span className="text-[10px] uppercase text-[#9CA3AF]">Scale</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={selectedEntity.scale}
                    onChange={e => {
                      const val = Math.max(0.1, Number(e.target.value) || 1);
                      const next = { ...selectedEntity, scale: val };
                      setSelectedEntity(next);
                      runtimeControlsRef.current.syncSelectedFromProps(next);
                    }}
                    onBlur={() => {
                      onVisualPatch?.({
                        type: 'update',
                        mode: '3d',
                        name: selectedEntity.name,
                        kind: selectedEntity.kind,
                        props: { scale: selectedEntity.scale }
                      });
                    }}
                    className="w-full mt-0.5 px-1.5 py-1 rounded border border-[#262B33] bg-[#0A0C0E] text-[#F3F4F6] focus:outline-none focus:border-[#10B981]"
                  />
                </label>
              ) : (
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                  {(['w', 'h'] as const).map(dim => (
                    <label key={dim} className="block">
                      <span className="text-[10px] uppercase text-[#9CA3AF]">{dim}</span>
                      <input
                        type="number"
                        step="4"
                        min="4"
                        value={selectedEntity[dim]}
                        onChange={e => {
                          const val = Math.max(4, Number(e.target.value) || 16);
                          const next = { ...selectedEntity, [dim]: val };
                          setSelectedEntity(next);
                          runtimeControlsRef.current.syncSelectedFromProps(next);
                        }}
                        onBlur={() => {
                          onVisualPatch?.({
                            type: 'update',
                            mode: '2d',
                            name: selectedEntity.name,
                            kind: selectedEntity.kind,
                            props: { w: selectedEntity.w, h: selectedEntity.h }
                          });
                        }}
                        className="w-full mt-0.5 px-1.5 py-1 rounded border border-[#262B33] bg-[#0A0C0E] text-[#F3F4F6] focus:outline-none focus:border-[#10B981]"
                      />
                    </label>
                  ))}
                </div>
              )}

              <div>
                <div className="text-[10px] font-mono uppercase text-[#9CA3AF] mb-1">Color</div>
                <div className="flex flex-wrap gap-1.5">
                  {['#10b981', '#38bdf8', '#f97316', '#a855f7', '#ec4899', '#facc15', '#f43f5e', '#f8fafc'].map(hex => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => {
                        const next = { ...selectedEntity, color: hex };
                        setSelectedEntity(next);
                        runtimeControlsRef.current.syncSelectedFromProps(next);
                        onVisualPatch?.({
                          type: 'update',
                          mode: selectedEntity.mode,
                          name: selectedEntity.name,
                          kind: selectedEntity.kind,
                          props: { color: hex }
                        });
                      }}
                      style={{ backgroundColor: hex }}
                      className={clsx(
                        'w-5 h-5 rounded-md border cursor-pointer',
                        (selectedEntity.color || '').toLowerCase() === hex ? 'border-white scale-110' : 'border-[#262B33]'
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 pointer-events-none">
          {toasts.map(t => (
            <div
              key={t.id}
              className={clsx(
                'px-3 py-2 rounded-lg border text-xs font-semibold shadow-lg',
                t.type === 'success'
                  ? 'bg-[#0b1f18] border-[#10B981]/50 text-[#10B981]'
                  : t.type === 'warn'
                    ? 'bg-[#1f1609] border-amber-500/50 text-amber-300'
                    : 'bg-[#111315] border-[#262B33] text-[#E5E7EB]'
              )}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}

      {/* Runtime Diagnostic Banner */}
      {runtimeError && (
        <div className="absolute top-3 left-3 z-20 max-w-md rounded-xl border border-red-500/40 bg-[#1a0b0e] px-3 py-2 text-xs text-red-300 flex items-start gap-2 shadow-xl">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="font-mono break-words">{runtimeError}</div>
        </div>
      )}

      {/* Collapsible Bottom-Center Engine Control Dock (Solid Surface, Zero backdrop-filter) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5">
        {showInspector && (
          <div className="px-3 py-2 rounded-lg border border-[#262B33] bg-[#111315]/95 text-[11px] font-mono text-[#D1D5DB] flex flex-wrap items-center gap-3 shadow-xl">
            <span>
              FPS: <strong className="text-[#10B981]">{stats.fps}</strong>
            </span>
            <span>
              Backend: <strong className="text-sky-400">{stats.backend}</strong>
            </span>
            {stats.entities3d > 0 && (
              <>
                <span>Draws: {stats.drawCalls}</span>
                <span>Tris: {stats.triangles.toLocaleString()}</span>
                <span>Instanced: {stats.instancedCount}</span>
                <span>Culled: {stats.culledCount}</span>
              </>
            )}
            {stats.entities2d > 0 && <span>2D Nodes: {stats.entities2d}</span>}
            {stats.uiWidgets > 0 && <span>UI: {stats.uiWidgets}</span>}
          </div>
        )}

        <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl border border-[#262B33] bg-[#111315]/92 shadow-xl">
          <button
            type="button"
            onClick={() => setPaused(p => !p)}
            className="p-1.5 rounded-lg text-[#D1D5DB] hover:bg-[#22262E] hover:text-white transition-colors cursor-pointer"
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? <Play className="w-3.5 h-3.5 text-[#10B981]" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          {stats.backend !== 'canvas2d' && stats.backend !== 'hud' && (
            <>
              <button
                type="button"
                onClick={() => runtimeControlsRef.current.resetCamera()}
                className="p-1.5 rounded-lg text-[#D1D5DB] hover:bg-[#22262E] hover:text-white transition-colors cursor-pointer"
                title="Reset Camera"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setWireframe(w => !w)}
                className={clsx(
                  'p-1.5 rounded-lg transition-colors cursor-pointer',
                  wireframe ? 'bg-[#10B981]/20 text-[#10B981]' : 'text-[#D1D5DB] hover:bg-[#22262E] hover:text-white'
                )}
                title="Toggle Wireframe"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowInspector(s => !s)}
            className={clsx(
              'px-2 py-1 rounded-lg text-[11px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer',
              showInspector
                ? 'bg-[#10B981]/20 text-[#10B981]'
                : 'text-[#9CA3AF] hover:bg-[#22262E] hover:text-white'
            )}
            title="difrenopt Optimizer Telemetry"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{stats.fps} FPS</span>
          </button>
        </div>
      </div>
    </div>
  );
}
