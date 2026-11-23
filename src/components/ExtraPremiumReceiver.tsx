import React, { useEffect, useMemo, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useStore } from '../store/useStore';
import { playKeystrokeSfx, playSoundboardSfx, setAmbientDroneEnabled } from '../lib/extraAudio';
import { hasTierAccess, resolveEffectiveTier } from '../lib/premiumTiers';
import { RemoteControlCommand, RemoteControlSession, TrollInboxEvent } from '../types';
import { notify } from '../store/useDialogStore';
import {
  ShieldAlert,
  Skull,
  Sparkles,
  Terminal,
  Timer,
  X,
  Play,
  Pause,
  RotateCcw,
  HandMetal,
} from 'lucide-react';
import { clsx } from 'clsx';

const HACKER_LINES = [
  '[SYS] Decrypting EPL-Core kernel vectors... OK',
  '[NET] Routing neural shader pipeline -> 0x7FA9C2',
  '[AUTH] Ultra cryptographic seal verified',
  '[GPU] Hyper-render overdrive active @ 120Hz',
  '[MEM] Zero-latency telemetry lock established',
  '[EPL] Quantum AST compiler cache synchronized',
  '[SEC] Bypassing standard runtime sandbox -> GRANTED',
];

export default function ExtraPremiumReceiver() {
  const user = useStore((s) => s.user);
  const userData = useStore((s) => s.userData);
  const language = useStore((s) => s.language);
  const isPremium = useStore((s) => s.isPremium);
  const premiumTier = useStore((s) => s.premiumTier);
  const extraSettings = useStore((s) => s.extraPremiumSettings);
  const setExtraSetting = useStore((s) => s.setExtraPremiumSetting);
  const setCurrentView = useStore((s) => s.setCurrentView);
  const setCode = useStore((s) => s.setCode);
  const setTheme = useStore((s) => s.setTheme);
  const setComputerStyle = useStore((s) => s.setComputerStyle);
  const setIsFrutigerAero = useStore((s) => s.setIsFrutigerAero);

  const activeTier = resolveEffectiveTier(isPremium || userData?.isPremium, userData?.premiumTier || premiumTier);
  const canPlus = hasTierAccess(activeTier, 'plus');
  const canPremium = hasTierAccess(activeTier, 'premium');
  const canUltra = hasTierAccess(activeTier, 'ultra');

  // Incoming Troll Message modal
  const [activeTrollPopup, setActiveTrollPopup] = useState<TrollInboxEvent | null>(null);

  // Timed remote prank flags
  const [remotePranks, setRemotePranks] = useState({
    shake: false,
    disco: false,
    flip: false,
    glitch: false,
    confettiNonce: 0,
  });

  // Active Control My EPL session targeting THIS user
  const [incomingControl, setIncomingControl] = useState<RemoteControlSession | null>(null);
  const [decliningControl, setDecliningControl] = useState(false);

  const myUid = auth.currentUser?.uid || user?.uid || userData?.uid || '';
  const hasFirebaseAuth = Boolean(auth.currentUser);

  // Persistent seen-ID sets so Firestore + server polling never fire the same event twice
  const seenEventsRef = useRef<Set<string>>(new Set());
  const seenCommandsRef = useRef<Set<string>>(new Set());
  const declinedAtIsoRef = useRef<string | null>(null);
  const prankTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Canvas refs
  const matrixCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pomodoro state
  const [pomoSecondsLeft, setPomoSecondsLeft] = useState(extraSettings.pomodoroMinutes * 60);
  const [pomoRunning, setPomoRunning] = useState(true);

  // Hacker HUD state
  const [hackerLines, setHackerLines] = useState<string[]>(HACKER_LINES.slice(0, 4));

  useEffect(() => {
    setPomoSecondsLeft(extraSettings.pomodoroMinutes * 60);
  }, [extraSettings.pomodoroMinutes, extraSettings.pomodoroEnabled]);

  useEffect(() => {
    if (!canPlus || !extraSettings.pomodoroEnabled || !pomoRunning) return;
    const id = setInterval(() => {
      setPomoSecondsLeft((prev) => {
        if (prev <= 1) {
          playSoundboardSfx('levelup', 0.35);
          notify.success(language === 'ru' ? 'Помодоро завершён! Время перерыва.' : 'Pomodoro complete! Take a quick break.');
          return extraSettings.pomodoroMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [canPlus, extraSettings.pomodoroEnabled, extraSettings.pomodoroMinutes, pomoRunning, language]);

  // Ambient Lo-Fi drone
  useEffect(() => {
    setAmbientDroneEnabled(canPlus && extraSettings.pomodoroEnabled && extraSettings.pomodoroDrone, 0.08);
    return () => {
      setAmbientDroneEnabled(false);
    };
  }, [canPlus, extraSettings.pomodoroEnabled, extraSettings.pomodoroDrone]);

  // Typewriter / Mechanical Keystroke SFX
  useEffect(() => {
    if (!canPlus || !extraSettings.typewriterSfxEnabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
      playKeystrokeSfx(extraSettings.typewriterPack, extraSettings.typewriterVolume);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canPlus, extraSettings.typewriterSfxEnabled, extraSettings.typewriterPack, extraSettings.typewriterVolume]);

  // Hacker HUD rotating log stream
  useEffect(() => {
    if (!canUltra || !extraSettings.hackerHudEnabled) return;
    let idx = 4;
    const id = setInterval(() => {
      const next = HACKER_LINES[idx % HACKER_LINES.length];
      idx += 1;
      setHackerLines((prev) => [...prev.slice(-3), next]);
    }, 1700);
    return () => clearInterval(id);
  }, [canUltra, extraSettings.hackerHudEnabled]);

  // Helper to activate timed remote prank safely
  const triggerTimedPrank = (effect: string, durationMs = 8000) => {
    const safeDuration = Math.max(2000, Math.min(25000, durationMs));
    if (effect === 'confetti') {
      setRemotePranks((p) => ({ ...p, confettiNonce: p.confettiNonce + 1 }));
      return;
    }
    if (effect === 'shake' || effect === 'disco' || effect === 'flip' || effect === 'glitch') {
      if (prankTimersRef.current[effect]) {
        clearTimeout(prankTimersRef.current[effect]);
      }
      setRemotePranks((p) => ({ ...p, [effect]: true }));
      prankTimersRef.current[effect] = setTimeout(() => {
        setRemotePranks((p) => ({ ...p, [effect]: false }));
      }, safeDuration);
    }
  };

  // Clear all timers on unmount
  useEffect(() => {
    return () => {
      Object.values(prankTimersRef.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  // Unified Dual Listeners (Firestore real-time + /api/extra/poll fallback)
  useEffect(() => {
    if (!myUid) {
      setActiveTrollPopup(null);
      setIncomingControl(null);
      seenEventsRef.current = new Set();
      seenCommandsRef.current = new Set();
      return;
    }

    const trollStorageKey = `epl_seen_troll_v1_${myUid}`;
    const cmdStorageKey = `epl_seen_cmd_v1_${myUid}`;

    const loadSeenSet = (key: string): Set<string> => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return new Set(parsed.filter((x) => typeof x === 'string').slice(-60));
        }
      } catch {}
      return new Set();
    };

    const persistSeenId = (key: string, set: Set<string>, id: string) => {
      set.add(id);
      if (set.size > 60) {
        const trimmed = Array.from(set).slice(-60);
        set.clear();
        trimmed.forEach((v) => set.add(v));
      }
      try {
        localStorage.setItem(key, JSON.stringify(Array.from(set)));
      } catch {}
    };

    seenEventsRef.current = loadSeenSet(trollStorageKey);
    seenCommandsRef.current = loadSeenSet(cmdStorageKey);

    const processTrollEvent = (data: TrollInboxEvent | null | undefined) => {
      if (!data?.eventId) return;
      if (seenEventsRef.current.has(data.eventId)) return;

      const parsedTime = data.createdAt ? new Date(data.createdAt).getTime() : NaN;
      const ageMs = Number.isFinite(parsedTime) ? Date.now() - parsedTime : 0;
      const maxAgeMs = data.kind === 'troll_message' ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000;

      persistSeenId(trollStorageKey, seenEventsRef.current, data.eventId);

      // Only drop genuinely old historical events (negative clock-skew values still pass)
      if (ageMs > maxAgeMs) return;

      if (data.kind === 'troll_message') {
        setActiveTrollPopup(data);
        if (data.sound && data.sound !== 'none') {
          playSoundboardSfx(data.sound, 0.45);
        }
      } else if (data.kind === 'prank_fx' && data.effect) {
        triggerTimedPrank(data.effect, data.durationMs || 8000);
      } else if (data.kind === 'clear') {
        Object.values(prankTimersRef.current).forEach((t) => clearTimeout(t));
        setRemotePranks((p) => ({ ...p, shake: false, disco: false, flip: false, glitch: false }));
        setActiveTrollPopup(null);
      } else if (data.kind === 'soundboard' && data.sound) {
        playSoundboardSfx(data.sound, 0.45);
      }
    };

    const executeRemoteCommand = (cmd: RemoteControlCommand, controllerName: string) => {
      if (!cmd?.commandId) return;
      if (seenCommandsRef.current.has(cmd.commandId)) return;

      const parsedTime = cmd.timestamp ? new Date(cmd.timestamp).getTime() : NaN;
      const ageMs = Number.isFinite(parsedTime) ? Date.now() - parsedTime : 0;

      persistSeenId(cmdStorageKey, seenCommandsRef.current, cmd.commandId);
      if (ageMs > 5 * 60 * 1000) return;

      switch (cmd.type) {
        case 'navigate':
          if (cmd.payload?.view) setCurrentView(cmd.payload.view);
          break;
        case 'setCode':
          if (typeof cmd.payload?.code === 'string') {
            setCode(cmd.payload.code);
            setCurrentView('editor');
          }
          break;
        case 'setTheme':
          if (cmd.payload?.theme === 'light' || cmd.payload?.theme === 'dark') {
            setIsFrutigerAero(false);
            setTheme(cmd.payload.theme);
          }
          break;
        case 'setComputerStyle':
          setComputerStyle(!!cmd.payload?.enabled);
          break;
        case 'setFrutigerAero':
          setIsFrutigerAero(!!cmd.payload?.enabled);
          break;
        case 'prank':
          if (cmd.payload?.effect) {
            triggerTimedPrank(cmd.payload.effect, 7000);
          }
          break;
        case 'sound':
          if (cmd.payload?.sound) {
            playSoundboardSfx(cmd.payload.sound, 0.45);
          }
          break;
        case 'toast':
          if (cmd.payload?.text) {
            notify.info(`${controllerName}: ${cmd.payload.text}`);
          }
          break;
      }
    };

    const processRemoteSession = (
      session: (RemoteControlSession & { recentCommands?: RemoteControlCommand[] }) | null | undefined
    ) => {
      if (!session) return;
      if (session.status !== 'active') {
        setIncomingControl(null);
        return;
      }

      // Guard against an older snapshot re-activating a session right after user declined
      if (declinedAtIsoRef.current && session.updatedAt) {
        const sessionTs = new Date(session.updatedAt).getTime();
        const declinedTs = new Date(declinedAtIsoRef.current).getTime();
        if (Number.isFinite(sessionTs) && Number.isFinite(declinedTs) && sessionTs <= declinedTs) {
          setIncomingControl(null);
          return;
        }
      }

      setIncomingControl(session);

      const candidates: RemoteControlCommand[] = [];
      if (Array.isArray(session.recentCommands)) {
        candidates.push(...session.recentCommands);
      }
      if (session.command && session.command.commandId) {
        if (!candidates.some((c) => c.commandId === session.command!.commandId)) {
          candidates.push(session.command);
        }
      }
      candidates.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
      for (const cmd of candidates) {
        executeRemoteCommand(cmd, session.controllerName || 'Controller');
      }
    };

    let unsubTroll: (() => void) | null = null;
    let unsubRemote: (() => void) | null = null;

    // Attach Firestore real-time listeners only when Firebase Auth is active to prevent GIS fallback permission errors
    if (auth.currentUser) {
      unsubTroll = onSnapshot(
        doc(db, 'trollInbox', myUid),
        (snap) => {
          if (!snap.exists()) return;
          processTrollEvent(snap.data() as TrollInboxEvent);
        },
        (err) => {
          console.warn('trollInbox listener note:', err?.code || err?.message);
        }
      );

      unsubRemote = onSnapshot(
        doc(db, 'remoteControlSessions', myUid),
        (snap) => {
          if (!snap.exists()) return;
          processRemoteSession(snap.data() as RemoteControlSession);
        },
        (err) => {
          console.warn('remoteControlSessions listener note:', err?.code || err?.message);
        }
      );
    }

    let cancelled = false;
    const pollRelay = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/extra/poll/${encodeURIComponent(myUid)}`);
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (Array.isArray(json?.events)) {
          for (const ev of json.events) {
            processTrollEvent(ev as TrollInboxEvent);
          }
        }
        if (json?.remoteSession) {
          processRemoteSession(json.remoteSession);
        }
      } catch {}
    };

    pollRelay();
    const pollId = setInterval(pollRelay, 1500);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') pollRelay();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', pollRelay);

    return () => {
      cancelled = true;
      if (unsubTroll) unsubTroll();
      if (unsubRemote) unsubRemote();
      clearInterval(pollId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', pollRelay);
    };
  }, [myUid, hasFirebaseAuth, setCurrentView, setCode, setTheme, setComputerStyle, setIsFrutigerAero]);

  // Target clicks "I don't want it"
  const handleDeclineControl = async () => {
    if (!myUid || !incomingControl || decliningControl) return;
    setDecliningControl(true);
    try {
      const now = new Date().toISOString();
      declinedAtIsoRef.current = now;
      const declinePayload = {
        targetUid: myUid,
        targetName: incomingControl.targetName || userData?.name || user?.displayName || 'Player',
        controllerUid: incomingControl.controllerUid,
        controllerName: incomingControl.controllerName || 'Controller',
        status: 'declined',
        declinedAt: now,
        updatedAt: now,
      };

      let firestoreOk = false;
      let relayOk = false;

      await Promise.allSettled([
        auth.currentUser
          ? setDoc(doc(db, 'remoteControlSessions', myUid), declinePayload).then(() => {
              firestoreOk = true;
            })
          : Promise.resolve(),
        (async () => {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (auth.currentUser) {
            const token = await auth.currentUser.getIdToken().catch(() => '');
            if (token) headers['Authorization'] = `Bearer ${token}`;
          }
          const res = await fetch('/api/extra/control', {
            method: 'POST',
            headers,
            body: JSON.stringify({ targetUid: myUid, session: declinePayload }),
          });
          if (res.ok) relayOk = true;
        })(),
      ]);

      if (!firestoreOk && !relayOk) {
        notify.error(language === 'ru' ? 'Не удалось отключить управление' : 'Could not disconnect remote control');
        return;
      }

      setIncomingControl(null);
      Object.values(prankTimersRef.current).forEach((t) => clearTimeout(t));
      setRemotePranks((p) => ({ ...p, shake: false, disco: false, flip: false, glitch: false }));
      notify.info(language === 'ru' ? 'Вы отключили удалённое управление' : 'You disconnected remote control');
    } catch (err) {
      console.error('Failed to decline remote control:', err);
      notify.error(language === 'ru' ? 'Не удалось отключить управление' : 'Could not disconnect remote control');
    } finally {
      setDecliningControl(false);
    }
  };

  // Matrix Code Rain Canvas Effect
  useEffect(() => {
    const active = canPlus && extraSettings.matrixRain;
    const canvas = matrixCanvasRef.current;
    if (!active || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const fontSize = 14;
    let columns = 0;
    let drops: number[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.max(1, Math.floor(canvas.width / fontSize));
      drops = Array.from({ length: columns }, () => Math.random() * -40);
    };
    resize();
    window.addEventListener('resize', resize);

    const chars = 'EPL01DRPLアイウエオカキクケコ∑∆Ω$#@';
    let lastTick = 0;
    const intervalMs = Math.max(20, 65 / Math.max(0.5, extraSettings.matrixSpeed));

    const draw = (time: number) => {
      animId = requestAnimationFrame(draw);
      if (time - lastTick < intervalMs) return;
      lastTick = time;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = extraSettings.matrixColor || '#10b981';
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] += 1;
      }
    };
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [canPlus, extraSettings.matrixRain, extraSettings.matrixColor, extraSettings.matrixSpeed]);

  // Confetti & Emoji Cannon Canvas Effect
  const confettiParticlesRef = useRef<
    Array<{ x: number; y: number; vx: number; vy: number; color: string; size: number; rot: number; vr: number; life: number }>
  >([]);

  const spawnConfettiBurst = (count: number) => {
    const palette =
      extraSettings.confettiPreset === 'royal'
        ? ['#f59e0b', '#fbbf24', '#fde68a', '#a855f7', '#ffffff']
        : extraSettings.confettiPreset === 'cyber'
          ? ['#06b6d4', '#10b981', '#ec4899', '#8b5cf6']
          : ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#a855f7'];
    const w = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const h = typeof window !== 'undefined' ? window.innerHeight : 700;
    for (let i = 0; i < count; i++) {
      confettiParticlesRef.current.push({
        x: Math.random() * w,
        y: Math.random() * (h * 0.3),
        vx: (Math.random() - 0.5) * 9,
        vy: Math.random() * 4 - 4,
        color: palette[Math.floor(Math.random() * palette.length)],
        size: 5 + Math.random() * 6,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.2,
        life: 160 + Math.random() * 60,
      });
    }
  };

  useEffect(() => {
    if (canPlus && extraSettings.confettiBurstNonce > 0) {
      spawnConfettiBurst(85);
    }
  }, [canPlus, extraSettings.confettiBurstNonce]);

  useEffect(() => {
    if (remotePranks.confettiNonce > 0) {
      spawnConfettiBurst(110);
    }
  }, [remotePranks.confettiNonce]);

  useEffect(() => {
    const autoRain = canPlus && extraSettings.confettiAutoRain;
    if (!autoRain) return;
    const id = setInterval(() => {
      spawnConfettiBurst(10);
    }, 550);
    return () => clearInterval(id);
  }, [canPlus, extraSettings.confettiAutoRain, extraSettings.confettiPreset]);

  useEffect(() => {
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let animId = 0;
    const loop = () => {
      animId = requestAnimationFrame(loop);
      const list = confettiParticlesRef.current;
      if (list.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.16;
        p.vx *= 0.99;
        p.rot += p.vr;
        p.life -= 1;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 40));
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.55);
        ctx.restore();

        if (p.life <= 0 || p.y > canvas.height + 30) {
          list.splice(i, 1);
        }
      }
    };
    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // RGB Particle Cursor Trail
  useEffect(() => {
    const active = canPremium && extraSettings.rgbCursorEnabled;
    const canvas = cursorCanvasRef.current;
    if (!active || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const sparks: Array<{ x: number; y: number; vx: number; vy: number; color: string; size: number; life: number }> = [];
    let hue = 0;

    const onMove = (e: MouseEvent) => {
      hue = (hue + 14) % 360;
      const color =
        extraSettings.rgbCursorStyle === 'matrix'
          ? '#10b981'
          : extraSettings.rgbCursorStyle === 'gold'
            ? '#fbbf24'
            : `hsl(${hue}, 95%, 65%)`;
      for (let i = 0; i < 2; i++) {
        sparks.push({
          x: e.clientX,
          y: e.clientY,
          vx: (Math.random() - 0.5) * 2.2,
          vy: (Math.random() - 0.5) * 2.2 - 0.4,
          color,
          size: 2 + Math.random() * 3,
          life: 26,
        });
      }
      if (sparks.length > 140) sparks.splice(0, sparks.length - 140);
    };
    window.addEventListener('mousemove', onMove);

    let animId = 0;
    const loop = () => {
      animId = requestAnimationFrame(loop);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.life -= 1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * (s.life / 26), 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = s.life / 26;
        ctx.fill();
        if (s.life <= 0) sparks.splice(i, 1);
      }
    };
    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
    };
  }, [canPremium, extraSettings.rgbCursorEnabled, extraSettings.rgbCursorStyle]);

  // Workspace dynamic CSS rules (applied safely to #epl-main-workspace so fixed overlays & "I don't want it" stay stable)
  const flipActive = (canPremium && extraSettings.screenFlipEnabled) || remotePranks.flip;
  const shakeActive = (canPremium && extraSettings.earthquakeEnabled) || remotePranks.shake;
  const discoActive = (canPremium && extraSettings.discoPartyEnabled) || remotePranks.disco;
  const glitchActive = remotePranks.glitch;

  const workspaceStyleCss = useMemo(() => {
    const flipMode = remotePranks.flip ? 'upside-down' : extraSettings.screenFlipMode;
    const flipTransform = flipActive
      ? flipMode === 'mirror'
        ? 'scaleX(-1)'
        : flipMode === 'tilt'
          ? 'rotate(-3deg) scale(0.97)'
          : 'rotate(180deg)'
      : '';

    const intensity = remotePranks.shake ? 6 : Math.max(1, extraSettings.earthquakeIntensity);
    const discoDuration = `${Math.max(0.4, 2.6 - extraSettings.discoSpeed * 0.4)}s`;

    return `
      @keyframes epl-quake {
        0%, 100% { transform: translate(0, 0) ${flipTransform}; }
        20% { transform: translate(-${intensity}px, ${Math.ceil(intensity * 0.7)}px) ${flipTransform}; }
        40% { transform: translate(${intensity}px, -${Math.ceil(intensity * 0.7)}px) ${flipTransform}; }
        60% { transform: translate(-${Math.ceil(intensity * 0.6)}px, -${intensity}px) ${flipTransform}; }
        80% { transform: translate(${Math.ceil(intensity * 0.6)}px, ${intensity}px) ${flipTransform}; }
      }
      @keyframes epl-disco-border {
        0% { box-shadow: inset 0 0 42px rgba(236,72,153,0.45); }
        33% { box-shadow: inset 0 0 42px rgba(16,185,129,0.45); }
        66% { box-shadow: inset 0 0 42px rgba(59,130,246,0.45); }
        100% { box-shadow: inset 0 0 42px rgba(245,158,11,0.45); }
      }
      ${flipActive || shakeActive || glitchActive ? `
        #epl-main-workspace {
          ${shakeActive ? 'animation: epl-quake 0.16s infinite;' : `transform: ${flipTransform};`}
          ${glitchActive ? 'filter: hue-rotate(95deg) contrast(1.25);' : ''}
          transition: transform 0.25s ease;
        }
      ` : ''}
      ${discoActive ? `
        #epl-disco-frame {
          animation: epl-disco-border ${discoDuration} linear infinite;
        }
      ` : ''}
    `;
  }, [
    flipActive,
    shakeActive,
    discoActive,
    glitchActive,
    remotePranks.flip,
    remotePranks.shake,
    extraSettings.screenFlipMode,
    extraSettings.earthquakeIntensity,
    extraSettings.discoSpeed,
  ]);

  const transformedBannerText = useMemo(() => {
    const src = extraSettings.textTransformSample || 'EPL Studio!';
    if (extraSettings.textTransformMode === 'reverse') return src.split('').reverse().join('');
    if (extraSettings.textTransformMode === 'leet') {
      return src.replace(/[aAeEiIoOsStT]/g, (c) => ({ a: '4', A: '4', e: '3', E: '3', i: '1', I: '1', o: '0', O: '0', s: '5', S: '5', t: '7', T: '7' }[c] || c));
    }
    return src.replace(/[rl]/g, 'w').replace(/[RL]/g, 'W') + ' UwU ✨';
  }, [extraSettings.textTransformMode, extraSettings.textTransformSample]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <>
      <style>{workspaceStyleCss}</style>

      {/* Matrix Code Rain Canvas */}
      {canPlus && extraSettings.matrixRain && (
        <canvas
          ref={matrixCanvasRef}
          className="fixed inset-0 pointer-events-none z-[45]"
          style={{ opacity: extraSettings.matrixOpacity }}
        />
      )}

      {/* Confetti Cannon Canvas (always mounted cleanly, transparent when empty) */}
      <canvas ref={confettiCanvasRef} className="fixed inset-0 pointer-events-none z-[65]" />

      {/* RGB Cursor Trail Canvas */}
      {canPremium && extraSettings.rgbCursorEnabled && (
        <canvas ref={cursorCanvasRef} className="fixed inset-0 pointer-events-none z-[66]" />
      )}

      {/* Accent Glow Halo */}
      {canPlus && extraSettings.accentGlowEnabled && (
        <div
          className="fixed inset-0 pointer-events-none z-[44]"
          style={{
            boxShadow: `inset 0 0 85px ${extraSettings.accentGlowColor}55, inset 0 0 20px ${extraSettings.accentGlowColor}44`,
          }}
        />
      )}

      {/* Disco Party Frame */}
      {discoActive && (
        <div id="epl-disco-frame" className="fixed inset-0 pointer-events-none z-[46]" />
      )}

      {/* UwU / 1337 / Reverse Lab Floating Ticker */}
      {canPremium && extraSettings.textTransformEnabled && (
        <div className="fixed top-3 right-3 z-[75] max-w-sm bg-[#111315]/95 border border-pink-500/45 text-pink-200 px-3.5 py-2 rounded-xl shadow-xl backdrop-blur-md flex items-center gap-2.5 text-xs">
          <Sparkles className="w-3.5 h-3.5 text-pink-400 shrink-0" />
          <span className="font-mono truncate">{transformedBannerText}</span>
          <button
            type="button"
            onClick={() => setExtraSetting('textTransformEnabled', false)}
            className="p-0.5 rounded hover:bg-white/10 text-pink-300 cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Focus Pomodoro Floating HUD */}
      {canPlus && extraSettings.pomodoroEnabled && (
        <div className="fixed bottom-16 md:bottom-4 left-4 z-[75] bg-[#181B20]/95 border border-cyan-500/40 text-[#F3F4F6] px-3.5 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs">
          <Timer className="w-4 h-4 text-cyan-400 shrink-0" />
          <div>
            <div className="text-[10px] text-[#9CA3AF] uppercase font-bold">Focus Timer</div>
            <div className="text-sm font-mono font-black text-cyan-300">{formatTimer(pomoSecondsLeft)}</div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPomoRunning((r) => !r)}
              className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 cursor-pointer"
            >
              {pomoRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setPomoSecondsLeft(extraSettings.pomodoroMinutes * 60)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setExtraSetting('pomodoroEnabled', false)}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-[#9CA3AF] hover:text-red-400 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Epic Hacker Terminal HUD (Ultra) */}
      {canUltra && extraSettings.hackerHudEnabled && (
        <div className="fixed bottom-16 md:bottom-4 right-4 z-[75] w-72 bg-[#070B09]/95 border border-amber-400/50 rounded-xl shadow-[0_0_28px_rgba(245,158,11,0.2)] p-3 text-[10px] font-mono text-emerald-400 backdrop-blur-md">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-emerald-500/20">
            <span className="flex items-center gap-1.5 font-bold text-amber-300 uppercase">
              <Terminal className="w-3.5 h-3.5" />
              EPL-ULTRA MAINFRAME HUD
            </span>
            <button
              type="button"
              onClick={() => setExtraSetting('hackerHudEnabled', false)}
              className="text-emerald-400/70 hover:text-red-400 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            {hackerLines.map((line, i) => (
              <div key={i} className="truncate opacity-90">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Incoming Troll Message Modal (Always upright & dismissible) */}
      {activeTrollPopup && (
        <div className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={clsx(
              'w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4',
              activeTrollPopup.style === 'hacker'
                ? 'bg-[#050A06] border-emerald-500 text-emerald-300 font-mono shadow-[0_0_40px_rgba(16,185,129,0.35)]'
                : activeTrollPopup.style === 'neon'
                  ? 'bg-[#120A24] border-cyan-400 text-white shadow-[0_0_40px_rgba(6,182,212,0.35)]'
                  : activeTrollPopup.style === 'retro'
                    ? 'bg-[#1E1E24] border-amber-400 text-amber-100 shadow-[0_0_30px_rgba(245,158,11,0.3)]'
                    : 'bg-gradient-to-br from-[#230E1F] via-[#1B1426] to-[#111315] border-pink-500 text-white shadow-[0_0_45px_rgba(236,72,153,0.4)]'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-pink-500/20 border border-pink-400/40 flex items-center justify-center text-pink-400">
                  <Skull className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider opacity-70">
                    {language === 'ru'
                      ? `Troll Message от ${activeTrollPopup.senderName || 'Игрока'}`
                      : `Troll Message from ${activeTrollPopup.senderName || 'Player'}`}
                  </div>
                  <h3 className="text-base font-black">{activeTrollPopup.title || 'Troll Message'}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTrollPopup(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words bg-black/30 rounded-xl p-3.5 border border-white/10">
              {activeTrollPopup.message}
            </p>

            <button
              type="button"
              onClick={() => setActiveTrollPopup(null)}
              className="w-full py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-white/90 cursor-pointer"
            >
              {language === 'ru' ? 'Закрыть сообщение' : 'Dismiss'}
            </button>
          </div>
        </div>
      )}

      {/* Control My EPL Live Safety Bottom Bar with "I don't want it" */}
      {incomingControl && incomingControl.status === 'active' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[140] w-[calc(100%-2rem)] max-w-xl bg-gradient-to-r from-[#2A0E12] via-[#1C1218] to-[#171222] border-2 border-red-500/80 rounded-2xl px-4 py-3 shadow-[0_0_35px_rgba(239,68,68,0.45)] flex flex-col sm:flex-row items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-400/50 text-red-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-wide text-red-300">
                Control My EPL Active
              </div>
              <div className="text-xs text-white/90 truncate">
                {language === 'ru'
                  ? `${incomingControl.controllerName} сейчас управляет вашим EPL`
                  : `${incomingControl.controllerName} is controlling your EPL right now`}
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={decliningControl}
            onClick={handleDeclineControl}
            className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-black tracking-wide flex items-center gap-1.5 shrink-0 shadow-lg cursor-pointer disabled:opacity-50"
          >
            <HandMetal className="w-4 h-4" />
            <span>I don't want it</span>
          </button>
        </div>
      )}
    </>
  );
}
