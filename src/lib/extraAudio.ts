// Web Audio API synthesizer for Extra Premium Access sound effects, keystrokes, and ambient pads

let audioCtx: AudioContext | null = null;
let droneNodes: { osc1: OscillatorNode; osc2: OscillatorNode; gain: GainNode } | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playKeystrokeSfx(pack: 'mech' | 'synth' | 'retro' = 'mech', volume = 0.25) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const vol = Math.max(0.02, Math.min(0.6, volume));

  if (pack === 'mech') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190 + Math.random() * 60, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.032);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.038);
  } else if (pack === 'synth') {
    osc.type = 'sine';
    const notes = [440, 523.25, 587.33, 659.25, 783.99, 880];
    osc.frequency.setValueAtTime(notes[Math.floor(Math.random() * notes.length)], now);
    gain.gain.setValueAtTime(vol * 0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  } else {
    osc.type = 'square';
    osc.frequency.setValueAtTime(600 + Math.random() * 240, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.04);
    gain.gain.setValueAtTime(vol * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.048);
  }
}

export function playSoundboardSfx(
  sound: 'airhorn' | 'boom' | 'error' | 'levelup' | 'siren' | 'chime' | string,
  volume = 0.35
) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const vol = Math.max(0.05, Math.min(0.7, volume));

  if (sound === 'boom') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.55);
    gain.gain.setValueAtTime(vol * 1.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.62);
    return;
  }

  if (sound === 'airhorn') {
    [415, 422, 554].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(vol * 0.3, now);
      gain.gain.setValueAtTime(vol * 0.28, now + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.57);
    });
    return;
  }

  if (sound === 'error') {
    [330, 260].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(vol * 0.35, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.2);
    });
    return;
  }

  if (sound === 'siren') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.linearRampToValueAtTime(920, now + 0.25);
    osc.frequency.linearRampToValueAtTime(520, now + 0.5);
    gain.gain.setValueAtTime(vol * 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.57);
    return;
  }

  // levelup or chime
  const seq = sound === 'levelup' ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 880];
  seq.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const start = now + idx * 0.08;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(vol * 0.5, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.22);
  });
}

export function setAmbientDroneEnabled(enabled: boolean, volume = 0.08) {
  if (!enabled) {
    if (droneNodes) {
      try {
        droneNodes.osc1.stop();
        droneNodes.osc2.stop();
        droneNodes.gain.disconnect();
      } catch {}
      droneNodes = null;
    }
    return;
  }

  const ctx = getCtx();
  if (!ctx || droneNodes) return;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc1.type = 'sine';
  osc2.type = 'triangle';
  osc1.frequency.setValueAtTime(110, ctx.currentTime);
  osc2.frequency.setValueAtTime(164.81, ctx.currentTime);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(340, ctx.currentTime);

  gain.gain.setValueAtTime(Math.max(0.02, Math.min(0.2, volume)), ctx.currentTime);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain).connect(ctx.destination);

  osc1.start();
  osc2.start();
  droneNodes = { osc1, osc2, gain };
}
