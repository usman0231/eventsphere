/**
 * Tiny Web Audio sound module — no external assets.
 * All sounds are synthesized in the browser at play time.
 *
 * Usage:
 *   import { audio } from '../utils/audio';
 *   audio.unlock();       // call once after a user gesture
 *   audio.click();
 *   audio.whoosh();
 *   audio.ping();
 *   audio.startAmbient(); audio.stopAmbient();
 *   audio.setMuted(true);
 */

let ctx = null;
let masterGain = null;
let ambientNodes = null;   // synth-pad fallback nodes
let ambientEl = null;      // <audio> element when a loop file is used
let muted = false;

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = muted ? 0 : 0.6;
  masterGain.connect(ctx.destination);
  return ctx;
}

// Browsers require a user gesture before audio plays.
// Call this from a click handler the first time.
function unlock() {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
}

function setMuted(m) {
  muted = !!m;
  if (masterGain) {
    // smooth fade rather than abrupt cut
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.linearRampToValueAtTime(muted ? 0 : 0.6, now + 0.15);
  }
  if (ambientEl) ambientEl.muted = muted; // the loop-file path is outside masterGain
}

function isMuted() { return muted; }

/* ── one-shot helpers ── */

function envelope(gainNode, peak, attack, decay) {
  const now = ctx.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(peak, now + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
}

// Sharp UI click — short noise burst through a band-pass
function click() {
  const c = ensureCtx();
  if (!c || muted) return;
  const buf = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2400;
  filter.Q.value = 6;
  const g = c.createGain();
  envelope(g, 0.4, 0.002, 0.08);
  src.connect(filter).connect(g).connect(masterGain);
  src.start();
  src.stop(c.currentTime + 0.12);
}

// Camera whoosh — descending noise sweep
function whoosh() {
  const c = ensureCtx();
  if (!c || muted) return;
  const dur = 0.7;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.7;
  const src = c.createBufferSource();
  src.buffer = buf;

  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  const now = c.currentTime;
  filter.frequency.setValueAtTime(6000, now);
  filter.frequency.exponentialRampToValueAtTime(220, now + dur);
  filter.Q.value = 1.2;

  const g = c.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.55, now + 0.04);
  g.gain.linearRampToValueAtTime(0.0, now + dur);

  src.connect(filter).connect(g).connect(masterGain);
  src.start();
  src.stop(now + dur + 0.05);
}

// Bright sci-fi ping — sine + slight detune + short decay
function ping(freq = 880) {
  const c = ensureCtx();
  if (!c || muted) return;
  const now = c.currentTime;
  const o1 = c.createOscillator();
  const o2 = c.createOscillator();
  o1.type = 'sine'; o2.type = 'triangle';
  o1.frequency.value = freq;
  o2.frequency.value = freq * 1.5;
  const g = c.createGain();
  envelope(g, 0.35, 0.005, 0.55);
  o1.connect(g); o2.connect(g);
  g.connect(masterGain);
  o1.start(now); o2.start(now);
  o1.stop(now + 0.7); o2.stop(now + 0.7);
}

// Notification chime (for selection)
function chime() {
  const c = ensureCtx();
  if (!c || muted) return;
  ping(880);
  setTimeout(() => ping(1320), 90);
}

/* ── ambient bed: a royalty-free loop file if present (client/public/ambient.mp3), else a synth pad ── */

const AMBIENT_SRC = '/ambient.mp3';

// Plays /ambient.mp3 on loop if it exists; otherwise falls back to the synth pad.
function startAmbient() {
  const c = ensureCtx();
  if (!c) return;
  if (ambientEl || ambientNodes) return;

  const el = new Audio(AMBIENT_SRC);
  el.loop = true;
  el.preload = 'auto';
  el.volume = 0;
  el.muted = muted;

  const fadeInFile = () => {
    ambientEl = el;
    const target = 0.35;
    const step = () => {
      if (ambientEl !== el) return;            // stopped meanwhile
      el.volume = Math.min(target, el.volume + 0.03);
      if (el.volume < target) setTimeout(step, 80);
    };
    step();
  };

  // Missing file or blocked playback → fall back to the synth pad.
  el.addEventListener('error', () => { if (ambientEl !== el) startSynthAmbient(); }, { once: true });
  el.play().then(fadeInFile).catch(() => { if (ambientEl !== el) startSynthAmbient(); });
}

function startSynthAmbient() {
  const c = ensureCtx();
  if (!c) return;
  if (ambientNodes) return;

  const drone1 = c.createOscillator();
  const drone2 = c.createOscillator();
  const drone3 = c.createOscillator();
  // Soft, pleasant A-major pad (A2 · E3 · C#4) — calm and warm, not a sci-fi drone.
  drone1.type = 'sine'; drone1.frequency.value = 110.0;   // A2 (root)
  drone2.type = 'sine'; drone2.frequency.value = 164.81;  // E3 (fifth)
  drone3.type = 'sine'; drone3.frequency.value = 277.18;  // C#4 (major third — adds warmth)

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 800;
  lp.Q.value = 0.6;

  const g = c.createGain();
  g.gain.value = 0;

  drone1.connect(g); drone2.connect(g); drone3.connect(g);
  g.connect(lp).connect(masterGain);

  // slow LFO on filter for a "breathing" hum
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.05;
  lfoGain.gain.value = 50;
  lfo.connect(lfoGain).connect(lp.frequency);

  drone1.start(); drone2.start(); drone3.start(); lfo.start();

  // fade in (subtle)
  const now = c.currentTime;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.06, now + 1.5);

  ambientNodes = { drone1, drone2, drone3, lfo, g };
}

function stopAmbient() {
  // Stop the loop-file path (if used).
  if (ambientEl) {
    const el = ambientEl;
    ambientEl = null;
    const fade = () => {
      el.volume = Math.max(0, el.volume - 0.05);
      if (el.volume <= 0.001) { try { el.pause(); el.currentTime = 0; } catch {} }
      else setTimeout(fade, 60);
    };
    fade();
  }
  // Stop the synth-pad path (if used).
  if (ambientNodes && ctx) {
    const { drone1, drone2, drone3, lfo, g } = ambientNodes;
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.linearRampToValueAtTime(0, now + 0.6);
    setTimeout(() => {
      try { drone1.stop(); drone2.stop(); drone3.stop(); lfo.stop(); } catch {}
    }, 700);
    ambientNodes = null;
  }
}

export const audio = {
  unlock,
  setMuted,
  isMuted,
  click,
  whoosh,
  ping,
  chime,
  startAmbient,
  stopAmbient,
};
