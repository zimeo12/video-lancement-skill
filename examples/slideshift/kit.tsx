import React from 'react';
import { Easing, Img, interpolate, spring, staticFile } from 'remotion';
import { loadVariableFont as loadDisplay } from '@remotion/google-fonts/BricolageGrotesque';
import { loadFont as loadSerif } from '@remotion/google-fonts/InstrumentSerif';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';

// ---------------------------------------------------------------- faces (the first film's)
const display = loadDisplay('normal', { subsets: ['latin', 'latin-ext'] });
const serif = loadSerif('italic', { weights: ['400'], subsets: ['latin', 'latin-ext'] });
const inter = loadInter('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin', 'latin-ext'] });
export const DISPLAY = display.fontFamily;
export const SERIF = serif.fontFamily;
export const UI = inter.fontFamily;
export const fontsReady = () => Promise.all([display.waitUntilDone(), serif.waitUntilDone(), inter.waitUntilDone()]);

export const C = {
  ink: '#0c0c0e',
  bone: '#f1eee6',
  lime: '#c6ff3d',
  limeInk: '#12140a',
  panel: '#121218',
  panel2: '#17171f',
  field: '#0b0b0e',
  line: '#26262f',
  text: '#eceaf3',
  muted: '#8f8fa3',
};

export type Lang = 'en' | 'fr';
export const FPS = 60;
/** One beat in frames. The whole film is laid out in beats: change BPM and everything follows the track. */
import timing from "./timing.json";
export const BPM = timing.bpm;
export const B = (60 / BPM) * FPS;
export const b = (n: number) => Math.round(n * B);

// ---------------------------------------------------------------- motion
export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN = Easing.bezier(0.32, 0, 0.67, 0);
export const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);
export const EASE_SOFT = Easing.bezier(0.33, 0, 0.12, 1);
export const EASE_COVER = Easing.bezier(0.7, 0, 0.2, 1);
export const BOUNCE = { damping: 16, mass: 0.7, stiffness: 165 };
export const SNAP = { damping: 20, mass: 0.6, stiffness: 220 };
export const CALM = { damping: 200 };

export const tw = (t: number, t0: number, d: number, a = 0, b2 = 1, easing = EASE) =>
  interpolate(t, [t0, t0 + d], [a, b2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });
export const sp = (t: number, t0: number, config: Record<string, number> = CALM) => spring({ frame: t - t0, fps: FPS, config });
export const mix = (a: number, b2: number, p: number) => a + (b2 - a) * p;
export const clamp = (v: number, a = 0, b2 = 1) => Math.min(b2, Math.max(a, v));
export const tr = (lang: Lang, en: string, fr: string) => (lang === 'fr' ? fr : en);
export const img = (n: string) => staticFile(`img/${n}`);

export const Abs: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode }> = ({ style, children }) => (
  <div style={{ position: 'absolute', ...style }}>{children}</div>
);

// ---------------------------------------------------------------- headline words
const IN = 32;
const STAGGER = 3;
const OUT = 22;
export const SERIF_SCALE = 1.14;

/** A word rising from a masked line, an 8 px blur resolving as it lands; it leaves upward the same way. */
export const MaskWord: React.FC<{ t: number; at: number; out: number; serif?: boolean; color?: string; children: React.ReactNode }> = ({ t, at, out, serif, color, children }) => {
  const pin = tw(t, at, IN);
  const pout = tw(t, out, OUT, 0, 1, EASE_IN);
  const y = (1 - pin) * 120 - pout * 120;
  const blur = (1 - pin) * 8 + pout * 8;
  return (
    <span style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', padding: '0.06em 0.08em 0.24em', margin: '-0.06em -0.08em -0.24em' }}>
      <span
        style={{
          display: 'inline-block',
          transform: `translateY(${y}%)`,
          filter: `blur(${blur}px)`,
          color,
          ...(serif ? { fontFamily: SERIF, fontWeight: 400, fontSize: `${SERIF_SCALE}em`, letterSpacing: '-0.015em', lineHeight: 0.9 } : null),
        }}
      >
        {children}
      </span>
    </span>
  );
};

export type Token = { kind: 'word'; text: string; serif: boolean } | { kind: 'chip'; node: React.ReactNode } | { kind: 'br' };
/** '|' breaks the line, *word* goes serif italic, {name} inserts a chip from `chips`. */
export const tokenize = (s: string, chips: Record<string, React.ReactNode> = {}): Token[] => {
  const out: Token[] = [];
  let inSerif = false;
  for (const raw of s.split(' ').filter(Boolean)) {
    if (raw === '|') {
      out.push({ kind: 'br' });
      continue;
    }
    const m = raw.match(/^\{(\w+)\}(.*)$/);
    if (m) {
      out.push({ kind: 'chip', node: chips[m[1]] });
      if (m[2]) out.push({ kind: 'word', text: m[2], serif: inSerif });
      continue;
    }
    let w = raw;
    const open = w.startsWith('*');
    if (open) {
      inSerif = true;
      w = w.slice(1);
    }
    const close = w.endsWith('*') || /\*[.?!,…]$/.test(w);
    w = w.replace('*', '');
    out.push({ kind: 'word', text: w, serif: inSerif });
    if (close) inSerif = false;
  }
  return out;
};

export const Headline: React.FC<{
  t: number;
  at: number;
  out?: number;
  text: string;
  size?: number;
  y: number;
  color: string;
  accent?: string;
  chips?: Record<string, React.ReactNode>;
  weight?: number;
  stagger?: number;
}> = ({ t, at, out = 1e9, text, size = 78, y, color, accent, chips, weight = 760, stagger = STAGGER }) => {
  const toks = tokenize(text, chips);
  const lines: Token[][] = [[]];
  toks.forEach((k) => (k.kind === 'br' ? lines.push([]) : lines[lines.length - 1].push(k)));
  let i = 0;
  if (t < at - 2 || t > out + OUT + 40) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y - (size * 1.08 * lines.length) / 2, textAlign: 'center', fontFamily: DISPLAY, fontWeight: weight, fontSize: size, lineHeight: 1.08, letterSpacing: '-0.045em', color, zIndex: 80 }}>
      {lines.map((ln, li) => (
        <div key={li} style={{ whiteSpace: 'nowrap' }}>
          {ln.map((k, wi) => {
            const n = i++;
            const sep = wi > 0 && !(k.kind === 'word' && /^[?!.,:\u202f]/.test(k.text)) ? ' ' : '';
            if (k.kind === 'chip') {
              const p = sp(t, at + stagger * n, BOUNCE);
              const po = tw(t, out + 2 * n, OUT, 0, 1, EASE_IN);
              return (
                <React.Fragment key={wi}>
                  {sep}
                  <span style={{ display: 'inline-block', verticalAlign: 'middle', transform: `translateY(${-0.06 * size - po * 40}px) scale(${mix(0.4, 1, p) * (1 - po * 0.3)})`, opacity: clamp(p * 2) * (1 - po), filter: `blur(${po * 8}px)`, letterSpacing: 'normal' }}>{k.node}</span>
                </React.Fragment>
              );
            }
            if (k.kind !== 'word') return null;
            return (
              <React.Fragment key={wi}>
                {sep}
                <MaskWord t={t} at={at + stagger * n} out={out + 2 * n} serif={k.serif} color={k.serif ? accent : undefined}>
                  {k.text}
                </MaskWord>
              </React.Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** Typed line with a block cursor (the reference's other text gesture). Serif runs stay serif while typing. */
export const Typed: React.FC<{ t: number; at: number; cps?: number; out?: number; text: string; size?: number; y: number; color: string; accent?: string; caret?: string }> = ({
  t, at, cps = 26, out = 1e9, text, size = 78, y, color, accent, caret = color,
}) => {
  const toks = tokenize(text);
  const plain = toks.map((k) => (k.kind === 'word' ? k.text : '')).join(' ');
  const n = Math.floor(clamp((t - at) / (FPS / cps), 0, plain.length));
  const po = tw(t, out, 20, 0, 1, EASE_IN);
  if (t < at - 1 || po >= 1) return null;
  let left = n;
  const blink = n >= plain.length && Math.floor((t - at) / 16) % 2 === 1;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y - size * 0.56, textAlign: 'center', fontFamily: DISPLAY, fontWeight: 760, fontSize: size, lineHeight: 1.1, letterSpacing: '-0.045em', color, whiteSpace: 'nowrap', opacity: 1 - po, transform: `translateY(${-po * 30}px)`, filter: `blur(${po * 8}px)`, zIndex: 80 }}>
      {toks.map((k, i) => {
        if (k.kind !== 'word' || left <= 0) return null;
        const s = (i > 0 ? ' ' : '') + k.text;
        const shown = s.slice(0, left);
        left -= s.length;
        return (
          <span key={i} style={k.serif ? { fontFamily: SERIF, fontWeight: 400, fontSize: `${SERIF_SCALE}em`, letterSpacing: '-0.015em', color: accent } : undefined}>
            {shown}
          </span>
        );
      })}
      <span style={{ display: 'inline-block', width: size * 0.42, height: size * 0.86, marginLeft: size * 0.06, verticalAlign: '-0.12em', background: caret, opacity: blink ? 0 : 1 }} />
    </div>
  );
};

// ---------------------------------------------------------------- objects
export const SHADOW_LIGHT = '0 0 0 1px rgba(12,12,14,0.06)';
export const SHADOW_DARK = '0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.06)';

/** Callout pill with a dot, popping from the dot (the reference's annotation). */
export const Callout: React.FC<{ t: number; at: number; out?: number; x: number; y: number; text: string; dark?: boolean; side?: 1 | -1 }> = ({ t, at, out = 1e9, x, y, text, dark = true, side = 1 }) => {
  const p = sp(t, at, BOUNCE);
  const w = tw(t, at + 3, 26);
  const po = tw(t, out, 16, 0, 1, EASE_IN);
  if (t < at || po >= 1) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(${side < 0 ? '-100%' : '0'}, -50%) scale(${mix(0.5, 1, p) * (1 - po * 0.2)})`,
        transformOrigin: side < 0 ? '100% 50%' : '0 50%',
        opacity: clamp(p * 3) * (1 - po),
        filter: `blur(${po * 6}px)`,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 24px 14px 18px',
        borderRadius: 999,
        background: dark ? 'rgba(30,30,38,0.92)' : 'rgba(255,255,255,0.94)',
        boxShadow: dark ? '0 0 0 1px rgba(255,255,255,0.08)' : '0 0 0 1px rgba(12,12,14,0.06)',
        fontFamily: UI,
        fontWeight: 500,
        fontSize: 26,
        color: dark ? C.text : C.ink,
        whiteSpace: 'nowrap',
        zIndex: 70,
      }}
    >
      <span style={{ width: 12, height: 12, borderRadius: 6, background: C.lime, boxShadow: `0 0 0 ${4 + 5 * (1 - w)}px rgba(198,255,61,${0.22 * w})`, outline: dark ? undefined : `1.5px solid ${C.ink}`, flex: 'none' }} />
      <span style={{ display: 'inline-block', clipPath: `inset(0 ${(1 - w) * 100}% 0 0)` }}>{text}</span>
    </div>
  );
};

export const TikTokGlyph: React.FC<{ size: number; color?: string }> = ({ size, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
    <path fill={color} d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" />
  </svg>
);

/** Inline chip used inside headlines: [glyph] Label. */
export const Chip: React.FC<{ label: string; glyph?: React.ReactNode; size?: number; dark?: boolean; lime?: boolean }> = ({ label, glyph, size = 78, dark, lime }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: size * 0.14,
      padding: `${size * 0.1}px ${size * 0.24}px ${size * 0.1}px ${size * 0.12}px`,
      borderRadius: 999,
      background: lime ? C.lime : dark ? '#1d1d24' : '#ffffff',
      boxShadow: dark ? '0 0 0 1.5px rgba(255,255,255,0.1)' : '0 0 0 1px rgba(12,12,14,0.06)',
      fontFamily: UI,
      fontWeight: 600,
      fontSize: size * 0.42,
      letterSpacing: '-0.01em',
      color: lime ? C.limeInk : dark ? C.text : C.ink,
      lineHeight: 1,
    }}
  >
    {glyph}
    {label}
  </span>
);

export const TikTokBadge: React.FC<{ size: number }> = ({ size }) => (
  <span style={{ width: size, height: size, borderRadius: size / 2, background: '#000', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
    <TikTokGlyph size={size * 0.56} />
  </span>
);

export const LogoTile: React.FC<{ size: number; glyph?: number }> = ({ size, glyph = 1 }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.23, background: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' }}>
    <Img src={img('logo.png')} style={{ width: size * 0.72, height: size * 0.72, opacity: glyph, transform: `scale(${mix(0.6, 1, glyph)})` }} />
  </div>
);

// ---------------------------------------------------------------- cursor
export const Cursor: React.FC<{ x: number; y: number; press?: number; ring?: number; opacity?: number }> = ({ x, y, press = 0, ring = 0, opacity = 1 }) =>
  opacity <= 0 ? null : (
    <div style={{ position: 'absolute', left: x, top: y, opacity, zIndex: 90, pointerEvents: 'none' }}>
      {ring > 0 && ring < 1 && (
        <div style={{ position: 'absolute', left: -8 - 34 * ring, top: -8 - 34 * ring, width: 16 + 68 * ring, height: 16 + 68 * ring, borderRadius: '50%', border: `2.5px solid rgba(198,255,61,${1 - ring})` }} />
      )}
      <svg width={44} height={44} viewBox="0 0 24 24" style={{ transform: `scale(${1 - 0.16 * press})`, transformOrigin: '3px 2px', filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.35))', display: 'block' }}>
        <path d="M3 2 L3 19.5 L7.6 15.4 L10.6 22 L13.6 20.7 L10.7 14.2 L17 14.2 Z" fill="#0c0c0e" stroke="#ffffff" strokeWidth={1.4} strokeLinejoin="round" />
      </svg>
    </div>
  );

/** Cursor path through (frame, x, y) points, eased, slightly bowed. */
export const path = (t: number, pts: [number, number, number][]) => {
  if (t <= pts[0][0]) return { x: pts[0][1], y: pts[0][2] };
  for (let i = 0; i < pts.length - 1; i++) {
    const [f0, x0, y0] = pts[i];
    const [f1, x1, y1] = pts[i + 1];
    if (t <= f1) {
      const p = tw(t, f0, f1 - f0, 0, 1, Easing.bezier(0.45, 0, 0.15, 1));
      const bow = Math.sin(p * Math.PI) * 0.1;
      return { x: x0 + (x1 - x0) * p - (y1 - y0) * bow, y: y0 + (y1 - y0) * p + (x1 - x0) * bow };
    }
  }
  const l = pts[pts.length - 1];
  return { x: l[1], y: l[2] };
};
export const press = (t: number, at: number) => tw(t, at, 4) - tw(t, at + 4, 12);
export const ringAt = (t: number, at: number) => tw(t, at, 28, 0, 1);

/** A slot-machine counter: 0 -> value as p goes 0 -> 1; columns grow in from the right. */
export const Roll: React.FC<{ value: string; p: number }> = ({ value, p }) => {
  const chars = [...value];
  // place value of each char (digits only), counted from the right
  let k = 0;
  const place = chars.map((c) => 0).fill(0);
  for (let i = chars.length - 1; i >= 0; i--) place[i] = /\d/.test(chars[i]) ? k++ : k;
  // each column starts a little later the higher its place, then eases onto its final digit:
  // a smooth slot-machine roll that always lands exactly on the value
  const nd = k;
  const appear = (pl: number) => (pl / nd) * 0.5;
  const q = (pl: number) => clamp((p - appear(pl)) / (1 - appear(pl)));
  const shown = (pl: number) => (pl === 0 ? 1 : clamp((p - appear(pl)) / 0.08));
  return (
    <span style={{ display: 'inline-flex', fontVariantNumeric: 'tabular-nums' }}>
      {chars.map((c, i) => {
        const w = place[i] === 0 ? 1 : shown(place[i]);
        if (w <= 0) return null;
        if (!/\d/.test(c)) return <span key={i} style={{ whiteSpace: 'pre', display: 'inline-block', maxWidth: `${w * 0.3}em`, opacity: w, overflow: 'hidden' }}>{c}</span>;
        const pos = ((Number(c) + 10 * (place[i] < 3 ? 2 : 1)) * (1 - (1 - q(place[i])) ** 3)) % 10;
        return (
          <span key={i} style={{ display: 'inline-block', height: '1.12em', overflow: 'hidden', lineHeight: '1.12em', verticalAlign: 'top', maxWidth: `${w * 0.6}em`, opacity: w, paddingRight: '0.06em', WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 22%, #000 80%, transparent 100%)' }}>
            <span style={{ display: 'flex', flexDirection: 'column', transform: `translateY(${-pos * 1.12}em)` }}>
              {Array.from({ length: 11 }, (_, n) => (
                <span key={n} style={{ height: '1.12em' }}>{n % 10}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
};
