import React, { useEffect, useMemo, useState } from 'react';
import { useStore, ExtraPremiumSettings } from '../store/useStore';
import {
  Crown, Sparkles, Zap, Lock, Send, Search, MonitorSmartphone, Skull, Flame,
  Volume2, Music, Timer, Code2, Eye, RotateCcw, Palette, Terminal, CheckCircle2,
  AlertTriangle, Radio, Power, PartyPopper, Keyboard, Wand2, ShieldAlert
} from 'lucide-react';
import { clsx } from 'clsx';
import { collection, doc, getDocs, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { hasTierAccess, resolveEffectiveTier, PREMIUM_TIERS } from '../lib/premiumTiers';
import { playSoundboardSfx } from '../lib/extraAudio';
import { getDefaultAvatar } from '../lib/avatar';
import { notify } from '../store/useDialogStore';
import { PremiumTier, RemoteControlSession } from '../types';

interface PublicPlayer {
  uid: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  role?: string;
  premiumTier?: PremiumTier;
}

function ToggleSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      aria-pressed={checked}
      className={clsx(
        'relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 border cursor-pointer',
        disabled && 'opacity-40 cursor-not-allowed',
        checked
          ? 'bg-[#10B981] border-[#10B981]'
          : 'bg-[#111315] border-[#262B33]'
      )}
    >
      <span
        className={clsx(
          'block w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-5.5' : 'translate-x-1'
        )}
      />
    </button>
  );
}

function TierLockPill({
  requiredTier,
  unlocked,
  language,
}: {
  requiredTier: Exclude<PremiumTier, 'none'>;
  unlocked: boolean;
  language: 'en' | 'ru';
}) {
  const styles =
    requiredTier === 'ultra'
      ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
      : requiredTier === 'premium'
        ? 'bg-violet-500/20 text-violet-300 border-violet-400/40'
        : 'bg-slate-500/20 text-sky-300 border-slate-400/40';

  return (
    <span className={clsx('text-[10px] px-2 py-0.5 rounded font-bold uppercase border inline-flex items-center gap-1', styles)}>
      {!unlocked && <Lock className="w-2.5 h-2.5" />}
      {requiredTier.toUpperCase()}
      {!unlocked && (language === 'ru' ? ' (Закрыто)' : ' (Locked)')}
    </span>
  );
}

export default function ExtraPremiumView() {
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const language = useStore(state => state.language);
  const isPremium = useStore(state => state.isPremium);
  const premiumTier = useStore(state => state.premiumTier);
  const user = useStore(state => state.user);
  const userData = useStore(state => state.userData);
  const setCurrentView = useStore(state => state.setCurrentView);
  const extraSettings = useStore(state => state.extraPremiumSettings);
  const setExtraSetting = useStore(state => state.setExtraPremiumSetting);
  const resetExtraSettings = useStore(state => state.resetExtraPremiumSettings);

  const activeTier = resolveEffectiveTier(isPremium || userData?.isPremium, userData?.premiumTier || premiumTier);
  const isLight = theme === 'light' && !isFrutigerAero;

  // Target player list
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [playerSearch, setPlayerSearch] = useState('');
  const [targetUid, setTargetUid] = useState<string>('');

  // Troll Message composer
  const [trollTitle, setTrollTitle] = useState(language === 'ru' ? 'Сообщение от системы' : 'Incoming Message');
  const [trollMessage, setTrollMessage] = useState('');
  const [trollStyle, setTrollStyle] = useState<'neon' | 'retro' | 'drama' | 'hacker'>('drama');
  const [trollSound, setTrollSound] = useState<'chime' | 'boom' | 'error' | 'siren' | 'none'>('boom');
  const [sendingTroll, setSendingTroll] = useState(false);

  // Target Prank FX
  const [prankDurationSec, setPrankDurationSec] = useState(8);

  // Control My EPL state
  const [activeRemoteTargetUid, setActiveRemoteTargetUid] = useState<string | null>(null);
  const [remoteSession, setRemoteSession] = useState<RemoteControlSession | null>(null);
  const [remoteCodeInput, setRemoteCodeInput] = useState(
    'window(title="Hacked by Friend 😎", width=420, height=280)\ntext_label(text="Surprise from Control My EPL!", x=40, y=90, color="#10b981", size=18)'
  );
  const [remoteToastText, setRemoteToastText] = useState('');

  // Soundboard target mode
  const [soundboardSendToTarget, setSoundboardSendToTarget] = useState(false);

  const myUid = auth.currentUser?.uid || user?.uid || userData?.uid || '';

  useEffect(() => {
    const loadPlayers = async () => {
      const merged = new Map<string, PublicPlayer>();
      const ingestDocs = (docs: any[]) => {
        docs.forEach((d) => {
          const data = typeof d.data === 'function' ? (d.data() as any) : d;
          const uid = String(data.uid || d.id || '').trim();
          if (!uid) return;
          const prev = merged.get(uid);
          merged.set(uid, {
            uid,
            name: data.name || prev?.name || 'Player',
            email: data.email || prev?.email,
            avatarUrl: data.avatarUrl || data.photoUrl || prev?.avatarUrl || '',
            role: data.role || prev?.role || 'user',
            premiumTier: resolveEffectiveTier(data.isPremium, data.premiumTier) !== 'none'
              ? resolveEffectiveTier(data.isPremium, data.premiumTier)
              : (prev?.premiumTier || 'none'),
          });
        });
      };

      try {
        const [pubSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, 'users_public')).catch(() => null),
          getDocs(collection(db, 'users')).catch(() => null),
        ]);
        if (pubSnap) ingestDocs(pubSnap.docs);
        if (usersSnap) ingestDocs(usersSnap.docs);
      } catch (err) {
        console.warn('Failed to fetch player directory for Extra Premium:', err);
      }

      const list = Array.from(merged.values());
      setPlayers(list);
      if (!targetUid && list.length > 0) {
        const other = list.find(p => p.uid !== myUid) || list[0];
        setTargetUid(other.uid);
      }
    };
    loadPlayers();
  }, [myUid]);

  // Listen to active Control My EPL session via Firestore AND server status fallback so "I don't want it" always triggers
  useEffect(() => {
    if (!activeRemoteTargetUid) {
      setRemoteSession(null);
      return;
    }
    let handledDecline = false;
    const handleStatusSession = (data: RemoteControlSession | null) => {
      if (!data) return;
      setRemoteSession(data);
      if (data.status === 'declined' && !handledDecline) {
        handledDecline = true;
        notify.error(
          language === 'ru'
            ? `Игрок ${data.targetName || 'цель'} нажал «I don't want it» и отключил управление!`
            : `${data.targetName || 'Target'} clicked "I don't want it" and refused remote control!`
        );
        setActiveRemoteTargetUid(null);
      }
    };

    const unsub = onSnapshot(
      doc(db, 'remoteControlSessions', activeRemoteTargetUid),
      (snap) => {
        if (!snap.exists()) return;
        handleStatusSession(snap.data() as RemoteControlSession);
      },
      (err) => {
        console.warn('Remote session monitor note:', err?.message || err);
      }
    );

    const pollId = setInterval(async () => {
      try {
        const res = await fetch(`/api/extra/control-status/${encodeURIComponent(activeRemoteTargetUid)}`);
        if (res.ok) {
          const json = await res.json();
          if (json?.remoteSession) {
            handleStatusSession(json.remoteSession as RemoteControlSession);
          }
        }
      } catch {}
    }, 2000);

    return () => {
      unsub();
      clearInterval(pollId);
    };
  }, [activeRemoteTargetUid, language]);

  const filteredPlayers = useMemo(() => {
    const q = playerSearch.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.uid.toLowerCase().includes(q) ||
        (p.email && p.email.toLowerCase().includes(q))
    );
  }, [players, playerSearch]);

  const selectedPlayer = useMemo(
    () => players.find(p => p.uid === targetUid) || null,
    [players, targetUid]
  );

  const canUsePlus = hasTierAccess(activeTier, 'plus');
  const canUsePremium = hasTierAccess(activeTier, 'premium');
  const canUseUltra = hasTierAccess(activeTier, 'ultra');

  const transformPreview = useMemo(() => {
    const src = extraSettings.textTransformSample || 'EPL Studio!';
    if (extraSettings.textTransformMode === 'reverse') {
      return src.split('').reverse().join('');
    }
    if (extraSettings.textTransformMode === 'leet') {
      return src.replace(/[aAeEiIoOsStT]/g, (c) => ({ a: '4', A: '4', e: '3', E: '3', i: '1', I: '1', o: '0', O: '0', s: '5', S: '5', t: '7', T: '7' }[c] || c));
    }
    return src.replace(/[rl]/g, 'w').replace(/[RL]/g, 'W') + ' UwU ✨';
  }, [extraSettings.textTransformMode, extraSettings.textTransformSample]);

  if (activeTier === 'none') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/35 text-amber-400 flex items-center justify-center mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">Extra Premium Access</h2>
        <p className="text-sm text-[#9CA3AF] max-w-md mb-5">
          {language === 'ru'
            ? 'Активируйте подписку уровня Plus, Premium или Ultra, чтобы открыть доступ к этой вкладке.'
            : 'Activate a Plus, Premium, or Ultra subscription in the Premium tab to unlock Extra Premium Access.'}
        </p>
        <button
          type="button"
          onClick={() => setCurrentView('premium')}
          className="px-5 py-2.5 rounded-xl bg-[#10B981] text-[#0A0C0E] text-sm font-bold cursor-pointer"
        >
          {language === 'ru' ? 'Перейти во вкладку Premium' : 'Go to Premium Tab'}
        </button>
      </div>
    );
  }

  const getAuthTokenHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken().catch(() => '');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  const dispatchTrollEvent = async (destUid: string, eventPayload: Record<string, any>) => {
    let firestoreOk = false;
    let relayOk = false;

    const cleanEvent = {
      ...eventPayload,
      targetUid: destUid,
      senderUid: myUid || 'premium-user',
      createdAt: eventPayload.createdAt || new Date().toISOString(),
    };

    const [fsRes, relayRes] = await Promise.allSettled([
      auth.currentUser
        ? setDoc(doc(db, 'trollInbox', destUid), cleanEvent).then(() => { firestoreOk = true; })
        : Promise.resolve(),
      (async () => {
        const headers = await getAuthTokenHeaders();
        const res = await fetch('/api/extra/troll', {
          method: 'POST',
          headers,
          body: JSON.stringify({ targetUid: destUid, event: cleanEvent }),
        });
        if (res.ok) relayOk = true;
      })(),
    ]);

    if (!firestoreOk && !relayOk) {
      console.warn('Troll delivery issues:', fsRes, relayRes);
    }
    return firestoreOk || relayOk;
  };

  const dispatchRemoteSession = async (destUid: string, sessionPayload: Record<string, any>) => {
    let firestoreOk = false;
    let relayOk = false;

    const cleanSession = {
      ...sessionPayload,
      targetUid: destUid,
      controllerUid: myUid || 'ultra-user',
      updatedAt: sessionPayload.updatedAt || new Date().toISOString(),
    };

    await Promise.allSettled([
      auth.currentUser
        ? setDoc(doc(db, 'remoteControlSessions', destUid), cleanSession).then(() => { firestoreOk = true; })
        : Promise.resolve(),
      (async () => {
        const headers = await getAuthTokenHeaders();
        const res = await fetch('/api/extra/control', {
          method: 'POST',
          headers,
          body: JSON.stringify({ targetUid: destUid, session: cleanSession }),
        });
        if (res.ok) relayOk = true;
      })(),
    ]);

    return firestoreOk || relayOk;
  };

  const handleSendTrollMessage = async () => {
    if (!canUsePremium) {
      notify.error(language === 'ru' ? 'Troll Message доступен с уровня Premium и Ultra' : 'Troll Message requires Premium or Ultra tier');
      return;
    }
    const cleanTarget = targetUid.trim();
    if (!myUid || !cleanTarget) {
      notify.error(language === 'ru' ? 'Выберите игрока-цель' : 'Select a target player');
      return;
    }
    if (!trollMessage.trim()) {
      notify.error(language === 'ru' ? 'Введите текст тролль-сообщения' : 'Enter a troll message');
      return;
    }

    setSendingTroll(true);
    try {
      const eventId = `troll_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const delivered = await dispatchTrollEvent(cleanTarget, {
        eventId,
        senderName: userData?.name || user?.displayName || 'Premium User',
        kind: 'troll_message',
        title: trollTitle.trim() || 'Troll Message',
        message: trollMessage.trim(),
        style: trollStyle,
        sound: trollSound,
      });

      if (!delivered) {
        notify.error(language === 'ru' ? 'Не удалось доставить Troll Message' : 'Failed to deliver Troll Message');
        return;
      }

      notify.success(
        language === 'ru'
          ? `Troll Message отправлено игроку ${selectedPlayer?.name || cleanTarget}!`
          : `Troll Message sent to ${selectedPlayer?.name || cleanTarget}!`
      );
      setTrollMessage('');
    } finally {
      setSendingTroll(false);
    }
  };

  const handleSendTargetPrank = async (effect: string, minTier: 'premium' | 'ultra') => {
    if (!hasTierAccess(activeTier, minTier)) {
      notify.error(
        language === 'ru'
          ? `Требуется уровень ${minTier.toUpperCase()}`
          : `Requires ${minTier.toUpperCase()} tier`
      );
      return;
    }
    const cleanTarget = targetUid.trim();
    if (!myUid || !cleanTarget) {
      notify.error(language === 'ru' ? 'Выберите игрока' : 'Select a target player');
      return;
    }
    const eventId = `fx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const delivered = await dispatchTrollEvent(cleanTarget, {
      eventId,
      senderName: userData?.name || user?.displayName || 'Premium User',
      kind: effect === 'clear' ? 'clear' : 'prank_fx',
      effect,
      durationMs: prankDurationSec * 1000,
    });
    if (!delivered) {
      notify.error(language === 'ru' ? 'Ошибка отправки пранк-эффекта' : 'Failed to send prank FX');
      return;
    }
    notify.success(
      effect === 'clear'
        ? (language === 'ru' ? 'Эффекты у цели сброшены' : 'Cleared FX on target')
        : (language === 'ru' ? `Пранк "${effect}" запущен у ${selectedPlayer?.name || 'игрока'}!` : `Triggered "${effect}" on ${selectedPlayer?.name || 'target'}!`)
    );
  };

  const handleToggleRemoteControl = async () => {
    if (!canUseUltra) {
      notify.error(language === 'ru' ? 'Control My EPL доступен только в Ultra!' : 'Control My EPL is an Ultra exclusive!');
      return;
    }
    const cleanTarget = targetUid.trim();
    if (!myUid || !cleanTarget) {
      notify.error(language === 'ru' ? 'Выберите игрока-цель' : 'Select a target player');
      return;
    }

    if (activeRemoteTargetUid) {
      await dispatchRemoteSession(activeRemoteTargetUid, {
        targetName: selectedPlayer?.name || 'Player',
        controllerName: userData?.name || user?.displayName || 'Ultra User',
        status: 'ended',
      });
      setActiveRemoteTargetUid(null);
      notify.info(language === 'ru' ? 'Управление отключено' : 'Remote control disconnected');
      return;
    }

    const targetName = selectedPlayer?.name || 'Player';
    const sessionObj = {
      targetName,
      controllerName: userData?.name || user?.displayName || 'Ultra User',
      status: 'active',
    };
    const delivered = await dispatchRemoteSession(cleanTarget, sessionObj);
    if (!delivered) {
      notify.error(language === 'ru' ? 'Не удалось подключиться к игроку' : 'Failed to connect remote control');
      return;
    }
    setActiveRemoteTargetUid(cleanTarget);
    setRemoteSession({
      targetUid: cleanTarget,
      targetName,
      controllerUid: myUid,
      controllerName: sessionObj.controllerName,
      status: 'active',
      updatedAt: new Date().toISOString(),
    });
    notify.success(
      language === 'ru'
        ? `Подключено к EPL игрока ${targetName}!`
        : `Connected to ${targetName}'s EPL Studio!`
    );
  };

  const sendRemoteCommand = async (
    type: 'navigate' | 'setCode' | 'setTheme' | 'setComputerStyle' | 'setFrutigerAero' | 'prank' | 'sound' | 'toast',
    payload: any
  ) => {
    if (!activeRemoteTargetUid || !myUid) return;
    const delivered = await dispatchRemoteSession(activeRemoteTargetUid, {
      targetName: selectedPlayer?.name || 'Player',
      controllerName: userData?.name || user?.displayName || 'Ultra User',
      status: 'active',
      command: {
        commandId: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type,
        payload,
        timestamp: new Date().toISOString(),
      },
    });
    if (!delivered) {
      notify.error(language === 'ru' ? 'Команда не доставлена' : 'Remote command failed');
    }
  };

  const handleSoundboardTrigger = async (soundKey: 'airhorn' | 'boom' | 'error' | 'levelup' | 'siren') => {
    if (!canUseUltra) {
      notify.error(language === 'ru' ? 'Саундборд доступен в Ultra!' : 'Soundboard requires Ultra tier!');
      return;
    }
    const cleanTarget = targetUid.trim();
    if (soundboardSendToTarget && cleanTarget && myUid) {
      const delivered = await dispatchTrollEvent(cleanTarget, {
        eventId: `sfx_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        senderName: userData?.name || 'Ultra',
        kind: 'soundboard',
        sound: soundKey,
      });
      if (!delivered) {
        notify.error(language === 'ru' ? 'Не удалось отправить звук игроку' : 'Failed to send sound to target');
        return;
      }
      notify.success(language === 'ru' ? `Звук "${soundKey}" отправлен игроку!` : `Sent "${soundKey}" sound to target!`);
    } else {
      playSoundboardSfx(soundKey, 0.4);
    }
  };

  const cardSurface = isFrutigerAero
    ? 'bg-white/45 border-white/60 backdrop-blur-md shadow-sm'
    : isLight
      ? 'bg-white border-[#E2E5EA]'
      : 'bg-[#181B20] border-[#262B33]';

  const subSurface = isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]';

  return (
    <div className="h-full flex flex-col p-4 sm:p-7 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Epic Hero Banner */}
        <div
          className={clsx(
            'relative overflow-hidden rounded-2xl border p-6 sm:p-7 text-white',
            activeTier === 'ultra'
              ? 'bg-gradient-to-br from-[#1C1408] via-[#26112C] to-[#0A222E] border-amber-400/70 shadow-[0_0_45px_rgba(245,158,11,0.28)]'
              : activeTier === 'premium'
                ? 'bg-gradient-to-br from-[#1A1535] via-[#172133] to-[#0F2A22] border-violet-400/60 shadow-[0_0_32px_rgba(139,92,246,0.22)]'
                : 'bg-gradient-to-br from-[#16202C] to-[#1A2628] border-sky-400/40'
          )}
        >
          <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-amber-400/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-cyan-400/15 blur-3xl" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span
                  className={clsx(
                    'px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5',
                    activeTier === 'ultra'
                      ? 'bg-gradient-to-r from-amber-400 via-pink-500 to-cyan-400 text-black'
                      : activeTier === 'premium'
                        ? 'bg-gradient-to-r from-violet-500 to-emerald-400 text-white'
                        : 'bg-sky-500 text-black'
                  )}
                >
                  {activeTier === 'ultra' ? <Crown className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {PREMIUM_TIERS[activeTier].badgeText} ACCESS
                </span>
                <span className="text-xs font-mono text-white/70">
                  {language === 'ru' ? 'Секретная лаборатория EPL Studio' : 'EPL Studio Secret Feature Lab'}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-amber-200 via-white to-cyan-200 bg-clip-text text-transparent">
                Extra Premium Access
              </h1>
              <p className="text-xs sm:text-sm text-white/80 max-w-2xl">
                {language === 'ru'
                  ? 'Тролль-сообщения игрокам, Control My EPL в реальном времени, визуальные моды, звуки клавиш, хакерский HUD и саундборд пранков.'
                  : 'Beam live Troll Messages, take over Control My EPL, toggle real-time visual mods, mechanical SFX, Hacker HUD, and Prank Soundboard.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {activeTier !== 'ultra' && (
                <button
                  type="button"
                  onClick={() => setCurrentView('premium')}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold cursor-pointer transition-colors"
                >
                  {language === 'ru' ? 'Улучшить до Ultra' : 'Upgrade to Ultra'}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  resetExtraSettings();
                  notify.info(language === 'ru' ? 'Все локальные эффекты выключены' : 'All local effects reset');
                }}
                className="px-3.5 py-2 rounded-xl border border-white/25 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{language === 'ru' ? 'Сбросить все FX' : 'Reset All FX'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Target Player Selector Bar (Used by Troll Message, Control My EPL, Target Prank FX, Soundboard) */}
        <div className={clsx('rounded-2xl border p-5 space-y-4', cardSurface)}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#10B981]" />
                {language === 'ru' ? 'Выбор игрока-цели (Target Player)' : 'Target Player Selector'}
              </h2>
              <p className="text-xs text-[#9CA3AF]">
                {language === 'ru'
                  ? 'Используется для Troll Message, Control My EPL, пранк-эффектов и саундборда.'
                  : 'Used for Troll Message, Control My EPL, target screen pranks, and remote soundboard.'}
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                placeholder={language === 'ru' ? 'Поиск игрока...' : 'Search player...'}
                className={clsx('w-full pl-8 pr-3 py-2 rounded-xl border text-xs focus:outline-none', subSurface)}
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {filteredPlayers.map(p => {
              const isSel = targetUid === p.uid;
              const isMe = p.uid === myUid;
              return (
                <button
                  key={p.uid}
                  type="button"
                  onClick={() => setTargetUid(p.uid)}
                  className={clsx(
                    'flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all shrink-0 cursor-pointer',
                    isSel
                      ? 'bg-[#10B981]/15 border-[#10B981] text-[#10B981]'
                      : clsx(subSurface, 'opacity-80 hover:opacity-100')
                  )}
                >
                  <img
                    src={p.avatarUrl || getDefaultAvatar(p.uid)}
                    alt=""
                    className="w-7 h-7 rounded-lg object-cover border border-current/20"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate max-w-[140px]">
                      {p.name} {isMe ? (language === 'ru' ? '(Вы)' : '(You)') : ''}
                    </div>
                    <div className="text-[10px] opacity-65 font-mono truncate max-w-[140px]">
                      {p.email ? p.email.split('@')[0] : p.uid.slice(0, 8)} • {p.premiumTier && p.premiumTier !== 'none' ? p.premiumTier.toUpperCase() : (p.role || 'user')}
                    </div>
                  </div>
                </button>
              );
            })}
            {filteredPlayers.length === 0 && (
              <div className="text-xs text-[#9CA3AF] py-2">
                {language === 'ru' ? 'Игроки не найдены' : 'No players found'}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 1: TARGET TROLLING & CONTROL MY EPL */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Troll Message */}
          <div className={clsx('rounded-2xl border p-5 space-y-4', cardSurface)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Skull className="w-5 h-5 text-pink-400" />
                  <h3 className="text-base font-bold">Troll Message</h3>
                  <TierLockPill requiredTier="premium" unlocked={canUsePremium} language={language} />
                </div>
                <p className="text-xs text-[#9CA3AF] mt-1">
                  {language === 'ru'
                    ? 'Отправляет внезапное всплывающее окно прямо на экран выбранного игрока.'
                    : 'Pops up a custom styled alert directly onto the selected player’s screen.'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  disabled={!canUsePremium}
                  value={trollTitle}
                  onChange={(e) => setTrollTitle(e.target.value)}
                  placeholder={language === 'ru' ? 'Заголовок окна' : 'Popup title'}
                  className={clsx('px-3 py-2 rounded-xl border text-xs focus:outline-none', subSurface)}
                />
                <div className="flex gap-1.5">
                  {(['drama', 'neon', 'retro', 'hacker'] as const).map(st => (
                    <button
                      key={st}
                      type="button"
                      disabled={!canUsePremium}
                      onClick={() => setTrollStyle(st)}
                      className={clsx(
                        'flex-1 py-1.5 rounded-lg border text-[11px] font-semibold capitalize cursor-pointer',
                        trollStyle === st ? 'bg-pink-500 border-pink-500 text-white' : subSurface
                      )}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={2}
                disabled={!canUsePremium}
                value={trollMessage}
                onChange={(e) => setTrollMessage(e.target.value)}
                placeholder={
                  language === 'ru'
                    ? 'Напишите смешное сообщение, которое появится на экране игрока...'
                    : 'Type the funny message to pop up on their screen...'
                }
                className={clsx('w-full px-3.5 py-2.5 rounded-xl border text-xs resize-none focus:outline-none', subSurface)}
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <Volume2 className="w-3.5 h-3.5 text-[#9CA3AF]" />
                  {(['boom', 'error', 'siren', 'chime', 'none'] as const).map(snd => (
                    <button
                      key={snd}
                      type="button"
                      disabled={!canUsePremium}
                      onClick={() => setTrollSound(snd)}
                      className={clsx(
                        'px-2 py-1 rounded-md border text-[10px] font-semibold uppercase cursor-pointer',
                        trollSound === snd ? 'bg-[#10B981] border-[#10B981] text-black' : subSurface
                      )}
                    >
                      {snd}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={!canUsePremium || sendingTroll}
                  onClick={handleSendTrollMessage}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{language === 'ru' ? 'Отправить на экран' : 'Send Troll Message'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Control My EPL */}
          <div className={clsx('rounded-2xl border p-5 space-y-4', cardSurface)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <MonitorSmartphone className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold">Control My EPL</h3>
                  <TierLockPill requiredTier="ultra" unlocked={canUseUltra} language={language} />
                </div>
                <p className="text-xs text-[#9CA3AF] mt-1">
                  {language === 'ru'
                    ? 'Управляйте EPL другого игрока: переключайте вкладки, меняйте код и темы. У игрока снизу есть кнопка «I don’t want it».'
                    : 'Control a player’s EPL Studio live (tabs, editor code, themes). Target always sees an "I don’t want it" safety button.'}
                </p>
              </div>

              <button
                type="button"
                disabled={!canUseUltra}
                onClick={handleToggleRemoteControl}
                className={clsx(
                  'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-40',
                  activeRemoteTargetUid
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gradient-to-r from-amber-400 to-pink-500 text-black'
                )}
              >
                <Power className="w-3.5 h-3.5" />
                <span>
                  {activeRemoteTargetUid
                    ? (language === 'ru' ? 'Отключить' : 'Disconnect')
                    : (language === 'ru' ? 'Взять управление' : 'Connect Control')}
                </span>
              </button>
            </div>

            {activeRemoteTargetUid && remoteSession?.status === 'active' ? (
              <div className={clsx('p-3.5 rounded-xl border space-y-3', subSurface)}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#10B981] font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {language === 'ru'
                      ? `Активно управление: ${selectedPlayer?.name || activeRemoteTargetUid}`
                      : `Controlling: ${selectedPlayer?.name || activeRemoteTargetUid}`}
                  </span>
                </div>

                {/* Remote Navigation */}
                <div>
                  <div className="text-[10px] font-bold uppercase text-[#9CA3AF] mb-1.5">
                    {language === 'ru' ? 'Переключить вкладку игрока:' : 'Switch Target Tab:'}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['store', 'editor', 'rate', 'news', 'premium', 'settings', 'profile'].map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => sendRemoteCommand('navigate', { view: v })}
                        className="px-2.5 py-1 rounded-lg bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] text-[11px] font-semibold capitalize cursor-pointer hover:bg-[#10B981] hover:text-black"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Remote Theme & Computer Style */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => sendRemoteCommand('setTheme', { theme: 'dark' })}
                    className="px-2.5 py-1 rounded-lg border border-current/15 text-[11px] font-semibold cursor-pointer hover:bg-white/10"
                  >
                    Dark Theme
                  </button>
                  <button
                    type="button"
                    onClick={() => sendRemoteCommand('setTheme', { theme: 'light' })}
                    className="px-2.5 py-1 rounded-lg border border-current/15 text-[11px] font-semibold cursor-pointer hover:bg-white/10"
                  >
                    Light Theme
                  </button>
                  <button
                    type="button"
                    onClick={() => sendRemoteCommand('setComputerStyle', { enabled: true })}
                    className="px-2.5 py-1 rounded-lg border border-current/15 text-[11px] font-semibold cursor-pointer hover:bg-white/10"
                  >
                    Computer Style ON
                  </button>
                  <button
                    type="button"
                    onClick={() => sendRemoteCommand('prank', { effect: 'confetti' })}
                    className="px-2.5 py-1 rounded-lg bg-pink-500/20 border border-pink-500/40 text-pink-300 text-[11px] font-semibold cursor-pointer"
                  >
                    Confetti Burst
                  </button>
                  <button
                    type="button"
                    onClick={() => sendRemoteCommand('prank', { effect: 'shake' })}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-semibold cursor-pointer"
                  >
                    Shake Screen
                  </button>
                </div>

                {/* Remote Live Code Injector */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-[#9CA3AF]">
                    {language === 'ru' ? 'Написать код в редактор игрока:' : 'Inject Code into Target Editor:'}
                  </div>
                  <textarea
                    rows={2}
                    value={remoteCodeInput}
                    onChange={(e) => setRemoteCodeInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 font-mono text-[11px] text-emerald-300 resize-none focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => sendRemoteCommand('setCode', { code: remoteCodeInput })}
                      className="px-3 py-1.5 rounded-lg bg-[#10B981] text-black text-xs font-bold cursor-pointer"
                    >
                      {language === 'ru' ? 'Записать код игроку' : 'Push Code Live'}
                    </button>
                    <input
                      type="text"
                      value={remoteToastText}
                      onChange={(e) => setRemoteToastText(e.target.value)}
                      placeholder={language === 'ru' ? 'Быстрый тост игроку...' : 'Quick toast...'}
                      className="flex-1 px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (remoteToastText.trim()) {
                          sendRemoteCommand('toast', { text: remoteToastText.trim() });
                          setRemoteToastText('');
                        }
                      }}
                      className="px-3 py-1 rounded-lg bg-violet-500 text-white text-xs font-bold cursor-pointer"
                    >
                      Toast
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className={clsx('p-4 rounded-xl border text-xs text-[#9CA3AF] flex items-center gap-2.5', subSurface)}>
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {language === 'ru'
                    ? 'Выберите игрока сверху и нажмите «Взять управление». Если игрок откажется кнопкой «I don’t want it», вы сразу получите уведомление.'
                    : 'Select a target player above and click Connect Control. If they click "I don’t want it", you will be notified immediately.'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Target Screen Prank FX + Soundboard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Target Prank FX */}
          <div className={clsx('rounded-2xl border p-5 space-y-4', cardSurface)}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-400" />
                <h3 className="text-base font-bold">
                  {language === 'ru' ? 'Пранки на экран игрока' : 'Target Screen Prank FX'}
                </h3>
                <TierLockPill requiredTier="premium" unlocked={canUsePremium} language={language} />
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[#9CA3AF]">{prankDurationSec}s</span>
                <input
                  type="range"
                  min={3}
                  max={20}
                  value={prankDurationSec}
                  onChange={(e) => setPrankDurationSec(Number(e.target.value))}
                  className="w-20 accent-[#10B981]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'shake', label: language === 'ru' ? 'Землетрясение' : 'Earthquake', tier: 'premium' as const },
                { id: 'confetti', label: language === 'ru' ? 'Конфетти-бомба' : 'Confetti Bomb', tier: 'premium' as const },
                { id: 'disco', label: language === 'ru' ? 'Диско-режим' : 'Disco Frame', tier: 'premium' as const },
                { id: 'flip', label: language === 'ru' ? 'Переворот 180°' : 'Flip 180°', tier: 'ultra' as const },
                { id: 'glitch', label: language === 'ru' ? 'Глитч-хак' : 'Glitch Takeover', tier: 'ultra' as const },
                { id: 'clear', label: language === 'ru' ? 'Сбросить у цели' : 'Clear Target FX', tier: 'premium' as const },
              ].map(fx => {
                const ok = hasTierAccess(activeTier, fx.tier);
                return (
                  <button
                    key={fx.id}
                    type="button"
                    disabled={!ok}
                    onClick={() => handleSendTargetPrank(fx.id, fx.tier)}
                    className={clsx(
                      'p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-start gap-1 transition-all cursor-pointer disabled:opacity-40',
                      subSurface,
                      ok && 'hover:border-[#10B981]'
                    )}
                  >
                    <span>{fx.label}</span>
                    <span className="text-[9px] uppercase font-mono opacity-65">{fx.tier}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ultra Prank Soundboard */}
          <div className={clsx('rounded-2xl border p-5 space-y-4', cardSurface)}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Music className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold">
                  {language === 'ru' ? 'Саундборд пранков' : 'Prank Soundboard'}
                </h3>
                <TierLockPill requiredTier="ultra" unlocked={canUseUltra} language={language} />
              </div>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <span className="text-[#9CA3AF]">
                  {language === 'ru' ? 'Отправлять цели' : 'Send to Target'}
                </span>
                <ToggleSwitch
                  checked={soundboardSendToTarget}
                  disabled={!canUseUltra}
                  onChange={setSoundboardSendToTarget}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { key: 'boom' as const, label: 'Vine Boom 💥' },
                { key: 'airhorn' as const, label: 'Airhorn 📣' },
                { key: 'error' as const, label: 'Win Error ❌' },
                { key: 'siren' as const, label: 'Alert Siren 🚨' },
                { key: 'levelup' as const, label: 'Level Up ⭐' },
              ].map(s => (
                <button
                  key={s.key}
                  type="button"
                  disabled={!canUseUltra}
                  onClick={() => handleSoundboardTrigger(s.key)}
                  className={clsx(
                    'py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5',
                    subSurface,
                    canUseUltra && 'hover:border-cyan-400 hover:bg-cyan-500/10'
                  )}
                >
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 2: LOCAL TOGGLES & SETTINGS (PLUS / PREMIUM / ULTRA) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Matrix Code Rain (PLUS) */}
          <div className={clsx('rounded-2xl border p-4 space-y-3', cardSurface)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Code2 className="w-4 h-4 text-[#10B981]" />
                  <h4 className="text-sm font-bold">{language === 'ru' ? 'Дождь кода Матрицы' : 'Matrix Code Rain'}</h4>
                </div>
                <div className="mt-1">
                  <TierLockPill requiredTier="plus" unlocked={canUsePlus} language={language} />
                </div>
              </div>
              <ToggleSwitch
                checked={extraSettings.matrixRain}
                disabled={!canUsePlus}
                onChange={(v) => setExtraSetting('matrixRain', v)}
              />
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">{language === 'ru' ? 'Цвет:' : 'Color:'}</span>
                <div className="flex gap-1.5">
                  {['#10b981', '#06b6d4', '#f59e0b', '#ec4899'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setExtraSetting('matrixColor', c)}
                      className={clsx('w-5 h-5 rounded-full border cursor-pointer', extraSettings.matrixColor === c ? 'ring-2 ring-white' : 'border-white/20')}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#9CA3AF]">{language === 'ru' ? 'Прозрачность:' : 'Opacity:'}</span>
                <input
                  type="range"
                  min={0.1}
                  max={0.7}
                  step={0.05}
                  value={extraSettings.matrixOpacity}
                  onChange={(e) => setExtraSetting('matrixOpacity', Number(e.target.value))}
                  className="w-28 accent-[#10B981]"
                />
              </div>
            </div>
          </div>

          {/* 2. Confetti & Emoji Cannon (PLUS) */}
          <div className={clsx('rounded-2xl border p-4 space-y-3', cardSurface)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <PartyPopper className="w-4 h-4 text-amber-400" />
                  <h4 className="text-sm font-bold">{language === 'ru' ? 'Конфетти-пушка' : 'Confetti Cannon'}</h4>
                </div>
                <div className="mt-1">
                  <TierLockPill requiredTier="plus" unlocked={canUsePlus} language={language} />
                </div>
              </div>
              <ToggleSwitch
                checked={extraSettings.confettiAutoRain}
                disabled={!canUsePlus}
                onChange={(v) => setExtraSetting('confettiAutoRain', v)}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1">
                {(['party', 'royal', 'cyber'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setExtraSetting('confettiPreset', p)}
                    className={clsx(
                      'px-2 py-1 rounded border text-[10px] font-bold uppercase cursor-pointer',
                      extraSettings.confettiPreset === p ? 'bg-amber-400 border-amber-400 text-black' : subSurface
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={!canUsePlus}
                onClick={() => setExtraSetting('confettiBurstNonce', extraSettings.confettiBurstNonce + 1)}
                className="px-3 py-1.5 rounded-lg bg-[#10B981] text-black text-xs font-bold cursor-pointer"
              >
                {language === 'ru' ? 'Выстрел!' : 'Fire!'}
              </button>
            </div>
          </div>

          {/* 3. Custom Accent Glow Studio (PLUS) */}
          <div className={clsx('rounded-2xl border p-4 space-y-3', cardSurface)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Palette className="w-4 h-4 text-sky-400" />
                  <h4 className="text-sm font-bold">{language === 'ru' ? 'Неоновая аура экрана' : 'Accent Glow Halo'}</h4>
                </div>
                <div className="mt-1">
                  <TierLockPill requiredTier="plus" unlocked={canUsePlus} language={language} />
                </div>
              </div>
              <ToggleSwitch
                checked={extraSettings.accentGlowEnabled}
                disabled={!canUsePlus}
                onChange={(v) => setExtraSetting('accentGlowEnabled', v)}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#9CA3AF]">{language === 'ru' ? 'Оттенок свечения:' : 'Glow Color:'}</span>
              <div className="flex gap-1.5">
                {['#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setExtraSetting('accentGlowColor', c)}
                    className={clsx('w-5 h-5 rounded-full border cursor-pointer', extraSettings.accentGlowColor === c ? 'ring-2 ring-white' : 'border-white/20')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 4. Mechanical Keystroke SFX (PLUS) */}
          <div className={clsx('rounded-2xl border p-4 space-y-3', cardSurface)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Keyboard className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-sm font-bold">{language === 'ru' ? 'Звуки клавиш' : 'Keystroke SFX'}</h4>
                </div>
                <div className="mt-1">
                  <TierLockPill requiredTier="plus" unlocked={canUsePlus} language={language} />
                </div>
              </div>
              <ToggleSwitch
                checked={extraSettings.typewriterSfxEnabled}
                disabled={!canUsePlus}
                onChange={(v) => setExtraSetting('typewriterSfxEnabled', v)}
              />
            </div>
            <div className="flex gap-1.5">
              {(['mech', 'synth', 'retro'] as const).map(pk => (
                <button
                  key={pk}
                  type="button"
                  onClick={() => setExtraSetting('typewriterPack', pk)}
                  className={clsx(
                    'flex-1 py-1 rounded border text-[10px] font-bold uppercase cursor-pointer',
                    extraSettings.typewriterPack === pk ? 'bg-[#10B981] border-[#10B981] text-black' : subSurface
                  )}
                >
                  {pk}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Focus Pomodoro + Lo-Fi Drone (PLUS) */}
          <div className={clsx('rounded-2xl border p-4 space-y-3', cardSurface)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Timer className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-sm font-bold">{language === 'ru' ? 'Фокус Помодоро + Lo-Fi' : 'Pomodoro + Lo-Fi'}</h4>
                </div>
                <div className="mt-1">
                  <TierLockPill requiredTier="plus" unlocked={canUsePlus} language={language} />
                </div>
              </div>
              <ToggleSwitch
                checked={extraSettings.pomodoroEnabled}
                disabled={!canUsePlus}
                onChange={(v) => setExtraSetting('pomodoroEnabled', v)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex gap-1">
                {[15, 25, 45].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setExtraSetting('pomodoroMinutes', m)}
                    className={clsx(
                      'px-2 py-1 rounded border text-[10px] font-mono font-bold cursor-pointer',
                      extraSettings.pomodoroMinutes === m ? 'bg-cyan-500 border-cyan-500 text-black' : subSurface
                    )}
                  >
                    {m}m
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={extraSettings.pomodoroDrone}
                  onChange={(e) => setExtraSetting('pomodoroDrone', e.target.checked)}
                  className="accent-[#10B981]"
                />
                <span>Lo-Fi Pad</span>
              </label>
            </div>
          </div>

          {/* 6. RGB Particle Cursor Trail (PREMIUM) */}
          <div className={clsx('rounded-2xl border p-4 space-y-3', cardSurface)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Wand2 className="w-4 h-4 text-violet-400" />
                  <h4 className="text-sm font-bold">{language === 'ru' ? 'RGB-след курсора' : 'RGB Cursor Trail'}</h4>
                </div>
                <div className="mt-1">
                  <TierLockPill requiredTier="premium" unlocked={canUsePremium} language={language} />
                </div>
              </div>
              <ToggleSwitch
                checked={extraSettings.rgbCursorEnabled}
                disabled={!canUsePremium}
                onChange={(v) => setExtraSetting('rgbCursorEnabled', v)}
              />
            </div>
            <div className="flex gap-1.5">
              {(['sparkles', 'matrix', 'gold'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  disabled={!canUsePremium}
                  onClick={() => setExtraSetting('rgbCursorStyle', st)}
                  className={clsx(
                    'flex-1 py-1 rounded border text-[10px] font-bold uppercase cursor-pointer',
                    extraSettings.rgbCursorStyle === st ? 'bg-violet-500 border-violet-500 text-white' : subSurface
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* 7. 180° Screen Flip / Mirror (PREMIUM) */}
          <div className={clsx('rounded-2xl border p-4 space-y-3', cardSurface)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Eye className="w-4 h-4 text-pink-400" />
                  <h4 className="text-sm font-bold">{language === 'ru' ? 'Переворот экрана' : '180° Screen Flip'}</h4>
                </div>
                <div className="mt-1">
                  <TierLockPill requiredTier="premium" unlocked={canUsePremium} language={language} />
                </div>
              </div>
              <ToggleSwitch
                checked={extraSettings.screenFlipEnabled}
                disabled={!canUsePremium}
                onChange={(v) => setExtraSetting('screenFlipEnabled', v)}
              />
            </div>
            <div className="flex gap-1.5">
              {(['upside-down', 'mirror', 'tilt'] as const).map(md => (
                <button
                  key={md}
                  type="button"
                  disabled={!canUsePremium}
                  onClick={() => setExtraSetting('screenFlipMode', md)}
                  className={clsx(
                    'flex-1 py-1 rounded border text-[10px] font-bold uppercase cursor-pointer',
                    extraSettings.screenFlipMode === md ? 'bg-pink-500 border-pink-500 text-white' : subSurface
                  )}
                >
                  {md}
                </button>
              ))}
            </div>
          </div>

          {/* 8. Disco Neon Party Mode (PREMIUM) */}
          <div className={clsx('rounded-2xl border p-4 space-y-3', cardSurface)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Zap className="w-4 h-4 text-fuchsia-400" />
                  <h4 className="text-sm font-bold">{language === 'ru' ? 'Диско-вечеринка' : 'Disco Party Frame'}</h4>
                </div>
                <div className="mt-1">
                  <TierLockPill requiredTier="premium" unlocked={canUsePremium} language={language} />
                </div>
              </div>
              <ToggleSwitch
                checked={extraSettings.discoPartyEnabled}
                disabled={!canUsePremium}
                onChange={(v) => setExtraSetting('discoPartyEnabled', v)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-[#9CA3AF]">{language === 'ru' ? 'Скорость:' : 'Speed:'}</span>
              <input
                type="range"
                min={1}
                max={5}
                value={extraSettings.discoSpeed}
                onChange={(e) => setExtraSetting('discoSpeed', Number(e.target.value))}
                className="w-28 accent-fuchsia-500"
              />
            </div>
          </div>

          {/* 9. Earthquake Shake (PREMIUM) */}
          <div className={clsx('rounded-2xl border p-4 space-y-3', cardSurface)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  <h4 className="text-sm font-bold">{language === 'ru' ? 'Землетрясение' : 'Earthquake Shake'}</h4>
                </div>
                <div className="mt-1">
                  <TierLockPill requiredTier="premium" unlocked={canUsePremium} language={language} />
                </div>
              </div>
              <ToggleSwitch
                checked={extraSettings.earthquakeEnabled}
                disabled={!canUsePremium}
                onChange={(v) => setExtraSetting('earthquakeEnabled', v)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-[#9CA3AF]">{language === 'ru' ? 'Сила:' : 'Intensity:'}</span>
              <input
                type="range"
                min={1}
                max={10}
                value={extraSettings.earthquakeIntensity}
                onChange={(e) => setExtraSetting('earthquakeIntensity', Number(e.target.value))}
                className="w-28 accent-orange-500"
              />
            </div>
          </div>

          {/* 10. UwU / 1337 / Reverse Lab (PREMIUM) */}
          <div className={clsx('rounded-2xl border p-4 space-y-3 md:col-span-2', cardSurface)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Sparkles className="w-4 h-4 text-pink-400" />
                  <h4 className="text-sm font-bold">{language === 'ru' ? 'UwU / 1337 / Реверс-генератор + Строка' : 'UwU / 1337 / Reverse Text Lab'}</h4>
                </div>
                <div className="mt-1">
                  <TierLockPill requiredTier="premium" unlocked={canUsePremium} language={language} />
                </div>
              </div>
              <ToggleSwitch
                checked={extraSettings.textTransformEnabled}
                disabled={!canUsePremium}
                onChange={(v) => setExtraSetting('textTransformEnabled', v)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                disabled={!canUsePremium}
                value={extraSettings.textTransformSample}
                onChange={(e) => setExtraSetting('textTransformSample', e.target.value)}
                className={clsx('sm:col-span-2 px-3 py-1.5 rounded-lg border text-xs', subSurface)}
              />
              <div className="flex gap-1">
                {(['uwu', 'leet', 'reverse'] as const).map(md => (
                  <button
                    key={md}
                    type="button"
                    disabled={!canUsePremium}
                    onClick={() => setExtraSetting('textTransformMode', md)}
                    className={clsx(
                      'flex-1 py-1 rounded border text-[10px] font-bold uppercase cursor-pointer',
                      extraSettings.textTransformMode === md ? 'bg-pink-500 border-pink-500 text-white' : subSurface
                    )}
                  >
                    {md}
                  </button>
                ))}
              </div>
            </div>
            <div className={clsx('px-3 py-2 rounded-lg border text-xs font-mono text-[#10B981]', subSurface)}>
              {transformPreview}
            </div>
          </div>

          {/* 11. Epic Hacker Terminal HUD (ULTRA) */}
          <div className={clsx('rounded-2xl border p-4 space-y-3', cardSurface)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  <h4 className="text-sm font-bold">{language === 'ru' ? 'Эпичный хакерский HUD' : 'Epic Hacker HUD'}</h4>
                </div>
                <div className="mt-1">
                  <TierLockPill requiredTier="ultra" unlocked={canUseUltra} language={language} />
                </div>
              </div>
              <ToggleSwitch
                checked={extraSettings.hackerHudEnabled}
                disabled={!canUseUltra}
                onChange={(v) => setExtraSetting('hackerHudEnabled', v)}
              />
            </div>
            <p className="text-xs text-[#9CA3AF]">
              {language === 'ru'
                ? 'Выводит мини-консоль дешифровки ядра EPL прямо в углу экрана.'
                : 'Displays a live sci-fi mainframe decryption mini-HUD in the corner of your screen.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
