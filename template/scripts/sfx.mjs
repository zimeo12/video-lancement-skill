// SFX from the film's own hit list: every visual accent gets a synthesized sound on its frame, so
// picture and sound share one source of truth and can't drift apart.
//
//   node <skill>/scripts/sfx.mjs <film>          -> <film>/audio/sfx.wav
//   node <skill>/scripts/sfx.mjs --list          the sound palette
//
// In film.js: HITS = [[beat, label, sfx, opts], ...]. sfx is a palette name or several joined with
// '+' ("thud+blip"); hits without one stay silent (listed at the end so that's a choice, not a slip).
// opts: gain, pan (-1..1), pitch (Hz or 'D6'), to (glide target), len (s), anchor (start|peak|end),
//       verb (reverb send 0..1). Risers and swells end ON the hit; whooshes peak on it.
// Seeded throughout: the same hit list always renders the same file.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SR = 48000;
const TAU = Math.PI * 2;
// Stem level: palette gains are relative to each other; this puts the stem ~2-3 LU under a
// beats.py bed where they overlap, so accents punctuate the music instead of burying it.
const STEM = 0.4;

// ---------------------------------------------------------------- dsp

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rnd = mulberry32(1);
const gauss = () => { const u = Math.max(rnd(), 1e-12), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
const NOTES = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
function hz(p) {
  if (typeof p === 'number') return p;
  const m = /^([A-G][#b]?)(-?\d)$/.exec(p);
  if (!m) throw new Error(`bad pitch ${p}`);
  return 440 * 2 ** ((NOTES[m[1]] + 12 * (Number(m[2]) + 1) - 69) / 12);
}
const buf = (sec) => new Float32Array(Math.max(1, Math.round(sec * SR)));
const noise = (n) => { const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = gauss(); return x; };

// RBJ biquad, coefficients updatable per block (for sweeps).
class Biquad {
  constructor(kind, f, q = 0.707) { this.kind = kind; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(f, q); }
  set(f, q = this.q) {
    this.q = q;
    const w = TAU * Math.min(Math.max(f, 20), SR * 0.45) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (this.kind === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (this.kind === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; }
    const a0 = 1 + al;
    [this.b0, this.b1, this.b2, this.a1, this.a2] = [b0 / a0, b1 / a0, b2 / a0, (-2 * c) / a0, (1 - al) / a0];
  }
  tick(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}
function filt(x, kind, f, q) { const b = new Biquad(kind, f, q); for (let i = 0; i < x.length; i++) x[i] = b.tick(x[i]); return x; }
const band = (x, lo, hi) => filt(filt(x, 'hp', lo), 'lp', hi);
// time-varying filter: fc(p) with p in 0..1 over the buffer
function sweep(x, kind, fc, q) {
  const b = new Biquad(kind, fc(0), q);
  for (let i = 0; i < x.length; i++) { if (i % 32 === 0) b.set(fc(i / x.length), q); x[i] = b.tick(x[i]); }
  return x;
}
function add(dst, src, gain = 1, at = 0) { for (let i = 0; i < src.length && at + i < dst.length; i++) dst[at + i] += gain * src[i]; return dst; }
function mapT(n, fn) { const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = fn(i / SR, i); return x; }
// sine with a frequency curve f(t)
function osc(n, f, amp = () => 1) { let ph = 0; return mapT(n, (t) => { ph += TAU * f(t) / SR; return Math.sin(ph) * amp(t); }); }
const attack = (x, tau = 0.0005) => { for (let i = 0; i < x.length; i++) x[i] *= 1 - Math.exp(-i / SR / tau); return x; };


// ---------------------------------------------------------------- recorded samples (Kenney CC0 packs, shipped with the skill)
const SFXDIR = process.env.SFX_DIR ?? path.join(os.homedir(), '.claude', 'skills', 'video-lancement', 'assets', 'sfx');
const FILES = {};
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (e.name.endsWith('.ogg')) FILES[e.name.slice(0, -4)] = f; } })(SFXDIR);
const CACHE = {};
function sample(name, rate = 1) {
  if (!FILES[name]) throw new Error(`no sample ${name}`);
  if (!CACHE[name]) {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-i', FILES[name], '-f', 'f32le', '-ac', '1', '-ar', String(SR), '-'], { maxBuffer: 1 << 28 });
    CACHE[name] = new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.length));
  }
  const x = CACHE[name];
  if (rate === 1) return Float32Array.from(x);
  const n = Math.floor(x.length / rate), y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = i * rate, k = Math.floor(p), fr = p - k; y[i] = x[k] * (1 - fr) + (x[k + 1] ?? 0) * fr; }
  return y;
}
const KEYS = ['click_002', 'click_003', 'click_004', 'click_005', 'tick_001', 'tick_002'];

// ---------------------------------------------------------------- palette
// Each returns a mono Float32Array. Defaults tuned to sit together; opts override.

const P = {
  keys: { gain: 0.5, doc: 'recorded keystrokes: n over len s, jittered (typing)', fn: (o) => {
    const len = o.len ?? 0.5, n = o.n ?? Math.max(2, Math.round(len * (o.cps ?? 15))), x = buf(len + 0.1);
    for (let k = 0; k < n; k++) {
      const at = (k / n) * len + (rnd() - 0.5) * 0.02;
      add(x, sample(KEYS[Math.floor(rnd() * KEYS.length)], 0.9 + rnd() * 0.25), 0.55 + rnd() * 0.45, Math.max(0, Math.round(at * SR)));
    }
    return x;
  } },
  ticks: { gain: 0.35, doc: 'odometer ticks: n over len s, dense then sparse (ease out), or both ways (io)', fn: (o) => {
    const len = o.len ?? 1.5, n = o.n ?? 24, x = buf(len + 0.1);
    for (let k = 0; k < n; k++) {
      const q = k / (n - 1);
      const at = o.io ? len * (0.5 - 0.5 * Math.cos(Math.PI * q)) : len * (1 - Math.sqrt(1 - q));
      add(x, sample(k % 2 ? 'tick_001' : 'tick_002', (o.rate ?? 1) * (1 + 0.04 * Math.sin(k))), 0.6 + 0.4 * (1 - q), Math.round(at * SR));
    }
    return x;
  } },
  pop: { gain: 0.34, doc: 'round bubble pop that bends up (pitch -> to). UI elements appearing', fn: (o) => {
    const len = o.len ?? 0.16, f0 = hz(o.pitch ?? 520), f1 = o.to ? hz(o.to) : f0 * 1.6, n = buf(len).length;
    const x = osc(n, (t) => f0 + (f1 - f0) * (1 - Math.exp(-t / 0.018)), (t) => Math.exp(-t / 0.045) * (1 - Math.exp(-t / 0.0015)));
    add(x, osc(n, (t) => 2 * (f0 + (f1 - f0) * (1 - Math.exp(-t / 0.018))), (t) => Math.exp(-t / 0.02)), 0.18);
    add(x, osc(n, (t) => 140 + 60 * Math.exp(-t / 0.01), (t) => Math.exp(-t / 0.02)), 0.3);
    return x;
  } },
  click: { gain: 0.32, doc: 'soft UI tap: a short transient on a woody body (pitch = body)', fn: (o) => {
    const len = 0.09, n = buf(len).length, body = hz(o.pitch ?? 1150) * (1 + (rnd() - 0.5) * 0.08);
    const tr = sweep(mapT(n, (t) => gauss() * Math.exp(-t / 0.0012)), 'bp', () => 3800, 1.4);
    const bd = osc(n, (t) => body * (1 + 0.25 * Math.exp(-t / 0.004)), (t) => Math.exp(-t / 0.011));
    const lo = osc(n, (t) => 190 + 90 * Math.exp(-t / 0.006), (t) => Math.exp(-t / 0.018));
    const x = mapT(n, (t, i) => tr[i] * 0.55 + bd[i] * 0.5 + lo[i] * 0.35);
    return attack(x, 0.0003);
  } },
  tick: { gain: 0.18, doc: 'tiny glassy tick: cursor, toggles, counters', fn: (o) => {
    const f = hz(o.pitch ?? 3200), n = buf(0.04).length;
    const x = osc(n, () => f, (t) => Math.exp(-t / 0.0045));
    add(x, osc(n, () => f * 2.03, (t) => Math.exp(-t / 0.002)), 0.3);
    return attack(add(x, filt(mapT(n, (t) => gauss() * Math.exp(-t / 0.0008)), 'hp', 6000), 0.25), 0.0002);
  } },
  thud: { gain: 0.45, doc: 'body hit: things landing, slams (pitch = start, to = end)', fn: (o) => {
    const len = o.len ?? 0.35, f0 = hz(o.pitch ?? 150), f1 = o.to ? hz(o.to) : 50;
    const x = osc(buf(len).length, (t) => f1 + (f0 - f1) * Math.exp(-t / 0.04), (t) => Math.exp(-t / (len * 0.4)));
    add(x, band(mapT(x.length, (t) => gauss() * Math.exp(-t / 0.05)), 250, 1400), 0.6);
    for (let i = 0; i < x.length; i++) x[i] = Math.tanh(2 * x[i]);
    return x;
  } },
  whoosh: { gain: 0.3, anchor: 'peak', doc: 'stereo pass-by: swept air + body, travels pan from -> pan to, peaks on the hit', fn: (o) => {
    const len = o.len ?? 0.5, f0 = hz(o.from ?? 400), f1 = hz(o.to ?? 3000), pk = o.peak ?? 0.62, n = buf(len).length;
    const a = sweep(noise(n), 'bp', (p) => f0 * (f1 / f0) ** p, 0.9);
    const air = sweep(noise(n), 'bp', (p) => Math.min(14000, 2.6 * f0 * (f1 / f0) ** p + 2500), 1.2);
    const body = sweep(noise(n), 'lp', (p) => 160 + 500 * Math.sin(Math.PI * p), 0.9);
    const p0 = o.panFrom ?? -0.7, p1 = o.panTo ?? 0.7;
    const L = new Float32Array(n), R = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = i / n, e = p < pk ? Math.sin((Math.PI / 2) * (p / pk)) ** 2.4 : Math.cos((Math.PI / 2) * ((p - pk) / (1 - pk))) ** 1.6;
      const v = (a[i] + air[i] * 0.35 + body[i] * 0.9) * e;
      const pan = p0 + (p1 - p0) * (0.5 - 0.5 * Math.cos(Math.PI * p));
      L[i] = v * Math.sqrt((1 - pan) / 2) * Math.SQRT2; R[i] = v * Math.sqrt((1 + pan) / 2) * Math.SQRT2;
    }
    return { L, R };
  }, peak: (o) => (o.len ?? 0.5) * (o.peak ?? 0.62) },
  riser: { gain: 0.3, anchor: 'end', doc: 'noise + rising tone that ends ON the hit (len s)', fn: (o) => {
    const len = o.len ?? 1.5, n = buf(len).length;
    const nz = sweep(noise(n), 'bp', (p) => 250 * 40 ** p, 2);
    const tone = osc(n, (t) => 180 * 6 ** ((t / len) ** 1.6) * 2, () => 0.12);
    return mapT(n, (t, i) => (nz[i] * 0.9 + tone[i]) * (t / len) ** 2.6 * (1 - Math.exp(-(len - t) / 0.004)));
  } },
  swell: { gain: 0.25, anchor: 'end', doc: 'reversed cymbal that ends ON the hit', fn: (o) => {
    const x = P.crash.fn({ len: o.len ?? 0.9 }).reverse();
    for (let i = x.length - Math.round(0.02 * SR); i < x.length; i++) x[i] = 0;   // a breath before the hit
    return x;
  } },
  crash: { gain: 0.25, doc: 'cymbal wash (len s)', fn: (o) => {
    const len = o.len ?? 1.6, n = buf(len).length;
    const x = filt(noise(n), 'hp', 3500);
    const fs = [2733, 3471, 4389, 5812, 7123, 8290].map((f) => [f, rnd() * 6]);
    return mapT(n, (t, i) => {
      let v = x[i];
      for (const [f, ph] of fs) v += 0.15 * Math.sin(TAU * f * t + ph) * Math.sin(TAU * f * 1.414 * t);
      return v * Math.exp(-t / (len * 0.45)) * (1 - Math.exp(-t / 0.002));
    });
  } },
  sub: { gain: 0.6, doc: 'sub drop: weight under a cut (len s)', fn: (o) => {
    const len = o.len ?? 1.0;
    const x = osc(buf(len).length, (t) => 32 + 45 * Math.exp(-t / 0.25), (t) => Math.exp(-t / 0.5) * (1 - Math.exp(-t / 0.003)));
    for (let i = 0; i < x.length; i++) x[i] = Math.tanh(1.8 * x[i]);
    return x;
  } },
  impact: { gain: 0.7, doc: 'the big one: long sub + boom + dark wash. Section changes, the drop, end card', fn: (o) => {
    const len = o.len ?? 2.2, n = buf(len).length;
    const x = osc(n, (t) => 36 + 70 * Math.exp(-t / 0.07), (t) => Math.exp(-t / 0.7) * (1 - Math.exp(-t / 0.002)));
    for (let i = 0; i < n; i++) x[i] = Math.tanh(1.6 * x[i]);
    add(x, P.thud.fn({ pitch: 160, to: 48, len: 0.35 }), 0.55);
    add(x, filt(mapT(n, (t) => gauss() * Math.exp(-t / 0.35)), 'lp', 380), 0.5);
    add(x, filt(P.crash.fn({ len: 1.8 }), 'lp', 7000), 0.22);
    return x;
  } },
  bell: { gain: 0.3, doc: 'bright ding (pitch): success, price lands, logo', fn: (o) => {
    const f = hz(o.pitch ?? 'A6'), len = o.len ?? 1.2;
    const parts = [[1, 1, 0.6], [2.76, 0.5, 0.25], [5.4, 0.3, 0.1], [8.93, 0.15, 0.05]];
    return attack(mapT(buf(len).length, (t) => parts.reduce((s, [r, a, d]) => s + a * Math.sin(TAU * f * r * t) * Math.exp(-t / d), 0)));
  } },
  coins: { gain: 0.3, doc: 'scatter of small bells: money, rewards', fn: (o) => {
    const n = o.n ?? 7, spread = o.spread ?? 0.18, x = buf(spread + 0.3);
    for (let k = 0; k < n; k++) add(x, P.bell.fn({ pitch: 2600 + (rnd() - 0.3) * 1300, len: 0.25 }), 0.4, Math.round(rnd() * spread * SR));
    return x;
  } },
  blip: { gain: 0.2, doc: 'glassy notification ding (pitch): callouts, chips, tiny accents', fn: (o) => {
    const f = hz(o.pitch ?? 'D6'), len = o.len ?? 0.45, n = buf(len).length;
    const x = mapT(n, (t) => Math.sin(TAU * f * t) * Math.exp(-t / 0.11) + 0.4 * Math.sin(TAU * f * 2.005 * t) * Math.exp(-t / 0.05)
      + 0.25 * Math.sin(TAU * f * 3.01 * t) * Math.exp(-t / 0.02));
    return attack(x, 0.0015);
  } },
  tok: { gain: 0.35, doc: 'tuned mallet (pitch): a character or object with a voice', fn: (o) => {
    const f = hz(o.pitch ?? 'D5'), len = o.len ?? 0.7;
    return attack(mapT(buf(len).length, (t) => {
      const idx = 2.2 * Math.exp(-t / 0.03);
      return Math.sin(TAU * f * t + idx * Math.sin(TAU * f * t)) * Math.exp(-t / 0.2)
        + 0.35 * Math.sin(TAU * 4 * f * t) * Math.exp(-t / 0.035) + 0.5 * Math.sin(TAU * f / 2 * t) * Math.exp(-t / 0.09);
    }), 0.0006);
  } },
  boing: { gain: 0.3, doc: 'springy glide (pitch -> to): stretch, bounce, comedy', fn: (o) => {
    const len = o.len ?? 0.45, f0 = hz(o.pitch ?? 180), f1 = hz(o.to ?? 520);
    const x = osc(buf(len).length, (t) => f0 + (f1 - f0) * (1 - Math.exp(-(t / len) * 5)) + 40 * Math.exp(-t / 0.15) * Math.sin(TAU * 14 * t),
      (t) => Math.exp(-t / 0.22) * (1 - Math.exp(-t / 0.003)));
    return sweep(x, 'lp', (p) => 900 + 2500 * Math.exp(-p * len / 0.2), 2.5);
  } },
  type: { gain: 0.22, doc: 'keyboard: keystrokes at ~cps over len s (text typing on), jittered and varied', fn: (o) => {
    const len = o.len ?? 0.5, n = o.n ?? Math.max(2, Math.round(len * (o.cps ?? 16))), x = buf(len + 0.12);
    for (let k = 0; k < n; k++) {
      const at = (k / n) * len + (rnd() - 0.5) * 0.018, space = rnd() < 0.15;
      const key = P.click.fn({ pitch: space ? 620 : 900 + rnd() * 600 });
      add(x, key, (space ? 0.95 : 0.55 + rnd() * 0.35), Math.max(0, Math.round(at * SR)));
    }
    return x;
  } },
};

// ---------------------------------------------------------------- reverb (Freeverb-style, stereo)

function reverb(send, room = 0.8, damp = 0.3) {
  const s = SR / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], alls = [556, 441, 341, 225];
  const out = [];
  for (const spread of [0, 23]) {
    const y = new Float32Array(send.length);
    for (const d of combs) {
      const L = Math.round((d + spread) * s), b = new Float32Array(L);
      let idx = 0, store = 0;
      for (let i = 0; i < send.length; i++) {
        const o = b[idx]; store = o * (1 - damp) + store * damp;
        b[idx] = send[i] * 0.015 + store * room; y[i] += o;
        idx = (idx + 1) % L;
      }
    }
    for (const d of alls) {
      const L = Math.round((d + spread) * s), b = new Float32Array(L);
      let idx = 0;
      for (let i = 0; i < y.length; i++) { const bo = b[idx]; const o = -y[i] + bo; b[idx] = y[i] + bo * 0.5; y[i] = o; idx = (idx + 1) % L; }
    }
    out.push(y);
  }
  return out;
}

// ---------------------------------------------------------------- wav

function writeWav(file, L, R) {
  const n = L.length, data = Buffer.alloc(n * 8);
  for (let i = 0; i < n; i++) { data.writeFloatLE(L[i], i * 8); data.writeFloatLE(R[i], i * 8 + 4); }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 8, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}

// ---------------------------------------------------------------- main

const args = process.argv.slice(2);
if (args.includes('--list')) {
  for (const [k, v] of Object.entries(P)) console.log(`${k.padEnd(8)} ${String(v.anchor || 'start').padEnd(6)} gain ${v.gain}  ${v.doc}`);
  process.exit(0);
}
// studio version: hits come from hits.json in beats; timing.json maps beats to seconds
const ROOT = process.cwd();
const timing = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'timing.json'), 'utf8'));
const hits = JSON.parse(fs.readFileSync(path.join(ROOT, 'hits.json'), 'utf8')).map(([beat, label, sfx, opts]) => ({ beat, label, sfx, opts, t: timing.offset + (beat * 60) / timing.bpm }));
const duration = Number(args[0] || 45);
const n = Math.round(duration * SR);
const L = new Float32Array(n), R = new Float32Array(n), send = new Float32Array(n);
const silent = [];
let placed = 0;
hits.forEach((h, k) => {
  if (!h.sfx) { silent.push(`${h.beat} ${h.label}`); return; }
  for (const [j, name] of h.sfx.split('+').entries()) {
    const nm = name.trim();
    const def = nm.startsWith('k:') ? { gain: 0.5, fn: (o) => sample(nm.slice(2), o.rate ?? 1) } : P[nm];
    if (!def) { console.error(`unknown sfx "${name}" at beat ${h.beat} (${h.label}); see --list`); process.exit(1); }
    const o = h.opts || {};
    rnd = mulberry32(k * 7919 + j * 104729 + 1);
    const out0 = def.fn(o);
    const st = out0.L ? out0 : null;
    const x = st ? st.L : out0;
    const anchor = o.anchor || def.anchor || 'start';
    const lead = anchor === 'end' ? x.length / SR : anchor === 'peak' ? (def.peak ? def.peak(o) : x.length / SR / 2) : 0;
    const at = Math.round((h.t - lead) * SR);
    const g = (o.gain ?? def.gain) * STEM, pan = Math.max(-1, Math.min(1, o.pan ?? 0));
    const gl = g * Math.sqrt((1 - pan) / 2) * Math.SQRT2, gr = g * Math.sqrt((1 + pan) / 2) * Math.SQRT2;
    const verb = o.verb ?? 0.15;
    for (let i = 0; i < x.length; i++) {
      const d = at + i;
      if (d < 0 || d >= n) continue;
      if (st) { L[d] += g * st.L[i]; R[d] += g * st.R[i]; send[d] += g * verb * 0.5 * (st.L[i] + st.R[i]); }
      else { L[d] += gl * x[i]; R[d] += gr * x[i]; send[d] += g * verb * x[i]; }
    }
    placed++;
  }
});
const [wl, wr] = reverb(send);
for (let i = 0; i < n; i++) { L[i] += wl[i]; R[i] += wr[i]; }
const out = path.join(ROOT, 'out', 'sfx.wav');
fs.mkdirSync(path.dirname(out), { recursive: true });
writeWav(out, L, R);
let peak = 0;
for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
console.log(`${placed} sounds on ${hits.length - silent.length} hits -> ${path.relative(ROOT, out)}  (peak ${(20 * Math.log10(peak + 1e-9)).toFixed(1)} dBFS)`);
if (silent.length) console.log(`silent hits (no sfx): ${silent.join(', ')}`);
