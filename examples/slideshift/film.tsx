import React, { useEffect, useState } from 'react';
import { AbsoluteFill, Img, continueRender, delayRender, interpolate, interpolateColors, useCurrentFrame } from 'remotion';
import { measureText } from '@remotion/layout-utils';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { Landscape, Rect, lerpRect, rectStyle } from './bg';
import { COPY, Copy } from './copy';
import {
  Abs, B, BOUNCE, C, Callout, Chip, Cursor, DISPLAY, EASE, EASE_COVER, EASE_IN, EASE_IO, EASE_SOFT, Headline, Lang, LogoTile, MaskWord, Roll,
  SERIF, SHADOW_LIGHT, SNAP, TikTokBadge, Typed, UI, b, clamp, fontsReady, img, mix, path, press, ringAt, sp, tw,
} from './kit';

export const TOTAL = b(110);

// ================================================================ timeline (beats)
const T = {
  P2: 7.5, P3: 13, P4: 21, LOGO: 25, GROW: 28.2, FULLAT: 29.4,
  U1: 29.5, U1B: 33.8, U2: 38.8, U3: 46.5, U4: 55.5, U4B: 59.5, U5: 65, U6: 72.5,
  SHRINK: 80.9, TILE: 82.4, BEN: 83.7, OUT: 94.5, END: 103,
};
const MORPH = 36; // frames for a card to become the next card

// ================================================================ keyframed rects
type Key = { f: number; r: Rect; ease?: (x: number) => number };
const at = (keys: Key[], f: number): Rect | null => {
  if (f < keys[0].f) return null;
  if (f >= keys[keys.length - 1].f) return keys[keys.length - 1].r;
  let i = 0;
  while (keys[i + 1].f <= f) i++;
  const p = interpolate(f, [keys[i].f, keys[i + 1].f], [0, 1], { easing: keys[i + 1].ease ?? EASE_IO });
  return lerpRect(keys[i].r, keys[i + 1].r, p);
};
const sq = (x: number, y: number, s: number): Rect => ({ x, y, w: s, h: s, r: s * 0.23 });

const WORDMARK = { size: 150, gap: 34, tile: 168 };
const lockup = (lang: Lang) => {
  const w = measureText({ text: 'SlideShift', fontFamily: DISPLAY, fontSize: WORDMARK.size, fontWeight: '760', letterSpacing: '-0.045em' }).width;
  const total = WORDMARK.tile + WORDMARK.gap + w;
  const x0 = 960 - total / 2;
  return { tileX: x0 + WORDMARK.tile / 2, textX: x0 + WORDMARK.tile + WORDMARK.gap, w, lang };
};

// the hero card, shot by shot (native size = rect size at rest)
const R = {
  U1: { x: 960, y: 625, w: 860, h: 470, r: 30 },
  U1B: { x: 960, y: 650, w: 1240, h: 707, r: 24 },
  U2: { x: 960, y: 640, w: 1000, h: 700, r: 30 },
  U3: { x: 960, y: 645, w: 360, h: 640, r: 24 },
  U4: { x: 960, y: 590, w: 900, h: 250, r: 30 },
  U4B: { x: 690, y: 650, w: 450, h: 600, r: 24 },
  U5: { x: 960, y: 650, w: 880, h: 700, r: 30 },
  U6: { x: 960, y: 668, w: 420, h: 850, r: 62 },
};
const HUB = sq(960, 610, 220);
const TOP = sq(960, 300, 132);

// ================================================================ fonts gate
const useFonts = () => {
  const [h] = useState(() => delayRender('fonts'));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    fontsReady().then(() => {
      setReady(true);
      continueRender(h);
    });
  }, [h]);
  return ready;
};

export const Launch: React.FC<{ lang: Lang }> = ({ lang }) => {
  const ready = useFonts();
  const f = useCurrentFrame();
  const S = COPY[lang];
  const u = f / B;
  const soft = interpolate(u, [0, 4.5, 9, 11, 15, 18, 22.4, 25.2, 28, 33.5, 80.5, 84, 94, 98, 110], [0.05, 0.05, 0.45, 0.45, 0.7, 0.7, 0.35, 0, 0, 0.5, 0.5, 0.65, 0.65, 0.15, 0.15], { extrapolateRight: 'clamp', easing: EASE_IO });
  const dip = tw(f, b(T.END - 0.4), b(2.4), 0, 1, EASE_IO);
  // a short push on the structural hits
  const punch = [T.LOGO, T.FULLAT, T.TILE + 1.3, T.OUT + 4.3].reduce((a, h) => a + (f >= b(h) ? 0.028 * Math.exp(-(f - b(h)) / 14) : 0), 0);
  const fx = Math.sin(f / 70) * 4;
  const fy = Math.sin(f / 90 + 1) * 3;
  return (
    <AbsoluteFill style={{ background: '#cfe0f0', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${1 + punch})` }}>
        <AbsoluteFill style={{ transform: `scale(${1.01 * (1 + (cam(f).z - 1) * 0.12)}) translate(${fx * 0.4}px, ${fy * 0.4}px)` }}>
          <Landscape t={f} soft={soft} dip={dip} />
        </AbsoluteFill>
        {ready && (
          <AbsoluteFill style={{ transform: `translate(${fx}px, ${fy}px)` }}>
            <CameraMotionBlur samples={blurSamples(f)} shutterAngle={200}>
              <Fore S={S} lang={lang} />
            </CameraMotionBlur>
          </AbsoluteFill>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

type P = { f: number; S: Copy; lang: Lang };

// the foreground reads its own frame, so the motion blur can sample it between frames
const Fore: React.FC<{ S: Copy; lang: Lang }> = ({ S, lang }) => {
  const f = useCurrentFrame();
  const c = cam(f);
  return (
    <AbsoluteFill style={{ transformOrigin: '0 0', transform: c.z === 1 ? undefined : `translate(${960 - c.x * c.z}px, ${540 - c.y * c.z}px) scale(${c.z})` }}>
      <Problem f={f} S={S} lang={lang} />
      <World f={f} S={S} lang={lang} />
      <Benefits f={f} S={S} lang={lang} />
    </AbsoluteFill>
  );
};

// ================================================================ camera: push in where the action is, back out before each morph
// [beat, focus x, focus y, zoom]; the focus point is brought to the centre of the frame
const CAM: [number, number, number, number][] = [
  [0, 960, 540, 1],
  // the URL being typed, then Continue
  [T.U1 + 0.9, 960, 540, 1], [T.U1 + 1.9, 960, 690, 1.5], [T.U1 + 2.6, 960, 720, 1.5], [T.U1 + 3.6, 960, 540, 1],
  // follow each field of the product sheet as it fills
  [T.U2 + 0.9, 960, 540, 1], [T.U2 + 2.0, 900, 630, 1.45], [T.U2 + 2.6, 900, 630, 1.45], [T.U2 + 3.1, 900, 780, 1.45],
  [T.U2 + 3.75, 900, 780, 1.45], [T.U2 + 4.3, 900, 915, 1.45], [T.U2 + 4.9, 900, 915, 1.45], [T.U2 + 5.9, 960, 540, 1],
  // the TikTok link and Analyse, in one framing
  [T.U4 + 0.6, 960, 540, 1], [T.U4 + 1.5, 960, 615, 1.45], [T.U4 + 2.6, 960, 615, 1.45], [T.U4 + 3.4, 960, 540, 1],
  // slideshows per day: 1 -> 3
  [T.U5 + 1.0, 960, 540, 1], [T.U5 + 2.0, 960, 790, 1.4], [T.U5 + 3.8, 960, 790, 1.4], [T.U5 + 4.9, 960, 540, 1],
];
const cam = (f: number) => {
  const u = f / B;
  let i = 0;
  while (i < CAM.length - 1 && CAM[i + 1][0] <= u) i++;
  if (i === CAM.length - 1) return { x: 960, y: 540, z: 1 };
  const [u0, x0, y0, z0] = CAM[i];
  const [u1, x1, y1, z1] = CAM[i + 1];
  const p = EASE_IO(clamp((u - u0) / (u1 - u0)));
  return { x: mix(x0, x1, p), y: mix(y0, y1, p), z: z0 * (z1 / z0) ** p };   // zoom in log space: a steady dolly
};
// ponytail: blur only around the cuts and morphs, where things travel fast; still frames stay 1 sample
const FAST = [0, 1.5, 2.5, 3.5, T.P2 + 1, T.U1B, T.P3, T.P4, T.LOGO, T.GROW, T.FULLAT, T.U2, T.U3, T.U4, T.U4B, T.U5, T.U6, T.SHRINK, T.TILE, T.BEN, T.OUT, T.END];
const blurSamples = (f: number) => (FAST.some((k) => f > b(k - 1.2) && f < b(k + 2.2)) ? 6 : 1);

// ================================================================ PROBLEM (landscape)
const WEEK = { w: 184, h: 300, gap: 28, y: 640 };
const weekX = (i: number) => 960 - (7 * WEEK.w + 6 * WEEK.gap) / 2 + WEEK.w / 2 + i * (WEEK.w + WEEK.gap);
const POSTED = (lang: Lang) => [`l-${lang}-1.jpg`, `l-${lang}-3.jpg`, `l-${lang}-10.jpg`];

const Problem: React.FC<P> = ({ f, S, lang }) => {
  if (f > b(T.LOGO + 0.5)) return null;
  // the hook: a big serif number on the hills, like the reference's "$300K MRR"
  const roll = tw(f, b(0.6), b(3.6), 0, 1, (x) => x) * (1 - tw(f, b(T.P2 + 0.5), b(1.3), 0, 1, EASE_IO));
  const sk = Math.max(0, (f - b(0.9)) / b(1.1));
  const swipe = Math.floor(sk) + EASE_IO(clamp((sk % 1) / 0.4));
  const thumbIn = sp(f, b(0.35), BOUNCE);
  const thumb = (
    <span style={{ display: 'inline-block', width: 46, height: 82, borderRadius: 9, overflow: 'hidden', transform: `rotate(${-6 + Math.sin(f / 22) * 4}deg) scale(${thumbIn * (1 + 0.07 * Math.sin(Math.PI * clamp((sk % 1) / 0.4)))})`, outline: '3px solid #fff', verticalAlign: 'middle', position: 'relative' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, height: '100%', display: 'flex', transform: `translateX(${-(swipe % 4) * 46}px)` }}>
        {[6, 1, 3, 10, 6].map((n, i) => (
          <Img key={i} src={img(`l-${lang}-${n}.jpg`)} style={{ width: 46, height: 82, objectFit: 'cover', flex: 'none' }} />
        ))}
      </span>
    </span>
  );
  const big: React.CSSProperties = { position: 'absolute', left: 0, right: 0, top: 255, textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontSize: 215, lineHeight: 1.12, letterSpacing: '-0.02em', color: C.ink, whiteSpace: 'nowrap', zIndex: 60 };
  const shake = f > b(T.P2 + 1.8) && f < b(T.P2 + 2.8) ? Math.sin(f * 1.5) * 9 * (1 - tw(f, b(T.P2 + 1.8), b(0.9))) : 0;

  // the week: three posted days, then nothing
  const tiles = WEEK;

  return (
    <>
      {/* P1 */}
      <Headline t={f} at={b(0.15)} out={b(T.P2 - 1.1)} text={S.h1} size={58} y={170} color={C.ink} chips={{ slide: thumb }} stagger={4} />
      {f < b(T.P3 + 1) && (
        <div style={{ ...big, transform: `translateX(${shake}px)` }}>
          <MaskWord t={f} at={b(0.45)} out={b(T.P3 - 0.5)}>
            <span style={{ display: 'inline-flex', alignItems: 'baseline' }}>
              <Roll value={S.big[0]} p={roll} />{S.big[1]}
            </span>
          </MaskWord>{' '}
          <MaskWord t={f} at={b(0.6)} out={b(T.P3 - 0.45)}>{S.views}</MaskWord>
        </div>
      )}
      {f < b(T.P2 + 2) && (
        <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, zIndex: 55, opacity: 1 - tw(f, b(T.P2 + 1.4), 14) }}>
          <path d="M90 1020 C 600 1005, 900 975, 1160 905 S 1600 780, 1830 720" fill="none" stroke="#ffffff" strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Easing2(roll)} />
        </svg>
      )}
      {/* P2: the same number, for you */}
      <Typed t={f} at={b(T.P2 + 0.2)} out={b(T.P3 - 0.5)} text={S.h2} size={64} y={170} color={C.ink} />
      {/* P3: by hand, nobody keeps it up */}
      <Headline t={f} at={b(T.P3)} out={b(T.P3 + 3.3)} text={S.h3} size={72} y={250} color={C.ink} />
      <Headline t={f} at={b(T.P3 + 3.7)} out={b(T.P4 - 0.7)} text={S.h3b} size={72} y={250} color={C.ink} />
      {f > b(T.P3) &&
        S.week.map((d, i) => {
          const pin = sp(f, b(T.P3 + 0.3) + i * 3, SNAP);
          if (pin <= 0.001) return null;
          const posted = i < 3;
          const fill = sp(f, b(T.P3 + 1.1 + i * 0.55), BOUNCE);
          const skip = tw(f, b(T.P3 + 2.6 + (i - 3) * 0.3), b(0.6), 0, 1, EASE);
          const collapse = tw(f, b(T.P4 - 0.8) + i * 2.5, b(0.7), 0, 1, EASE_IN);
          const x = weekX(i);
          const y = tiles.y + (1 - pin) * 260 + collapse * 140;
          const s = posted ? 1 : mix(1, 0.94, skip);
          return (
            <React.Fragment key={i}>
              <Abs style={{ left: x - tiles.w / 2, top: y - tiles.h / 2 - 54, width: tiles.w, textAlign: 'center', fontFamily: UI, fontWeight: 600, fontSize: 24, color: 'rgba(12,12,14,0.6)', opacity: pin * (1 - collapse) }}>{d}</Abs>
              <Abs
                style={{
                  left: x - tiles.w / 2,
                  top: y - tiles.h / 2,
                  width: tiles.w,
                  height: tiles.h,
                  borderRadius: 22,
                  overflow: 'hidden',
                  background: 'rgba(255,255,255,0.42)',
                  outline: '2px dashed rgba(255,255,255,0.85)',
                  outlineOffset: -2,
                  
                  transform: `scale(${s})`,
                  opacity: clamp(pin * 2) * (posted ? 1 : 1 - skip * 0.45) * (1 - collapse),
                  filter: collapse > 0 ? `blur(${collapse * 10}px)` : undefined,
                }}
              >
                {posted && (
                  <Img src={img(POSTED(lang)[i])} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: clamp(fill * 2), transform: `scale(${mix(1.25, 1, fill)})` }} />
                )}
              </Abs>
              {/* status chip under each day */}
              {(() => {
                const k = posted ? fill : sp(f, b(T.P3 + 2.6 + (i - 3) * 0.3), BOUNCE);
                if (k <= 0.01) return null;
                return (
                  <Abs style={{ left: x, top: y + tiles.h / 2 + 22, transform: `translateX(-50%) scale(${mix(0.5, 1, k) * (1 - collapse)})`, opacity: clamp(k * 3) * (1 - collapse) }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 999, fontFamily: UI, fontWeight: 600, fontSize: 21, whiteSpace: 'nowrap', background: posted ? C.lime : C.ink, color: posted ? C.limeInk : C.bone }}>
                      {posted ? '✓' : '✕'} {posted ? S.posted : S.skipped}
                    </span>
                  </Abs>
                );
              })()}
            </React.Fragment>
          );
        })}
      {/* P4 */}
      <Typed t={f} at={b(T.P4 + 0.3)} cps={24} out={b(T.LOGO - 0.4)} text={S.h4} size={88} y={430} color={C.ink} />
    </>
  );
};
const Easing2 = (x: number) => 1 - Math.pow(1 - x, 4);

// ================================================================ THE WORLD: logo tile -> dark world -> phone -> tile
const worldKeys = (lang: Lang): Key[] => {
  const L = lockup(lang);
  return [
    { f: b(T.LOGO), r: sq(960, 560, 1) },
    { f: b(T.LOGO) + 22, r: sq(960, 560, 210), ease: EASE },
    { f: b(T.GROW), r: sq(960, 560, 210) },
    { f: b(T.FULLAT), r: R.U1, ease: EASE_IO },
    { f: b(T.FULLAT) + 1, r: R.U6, ease: () => 1 },
    { f: b(T.SHRINK), r: R.U6 },
    { f: b(T.TILE + 1.3), r: HUB, ease: EASE_IO },
    { f: b(T.OUT - 0.5), r: HUB },
    { f: b(T.OUT + 0.4), r: TOP, ease: EASE_IO },
    { f: b(T.END - 0.3), r: TOP },
    { f: b(T.END + 0.6), r: sq(L.tileX, 500, WORDMARK.tile), ease: EASE_IO },
  ];
};

const heroKeys: Key[] = [
  { f: b(T.FULLAT), r: R.U1 },
  ...(['U1B', 'U2', 'U3', 'U4', 'U4B', 'U5', 'U6'] as const).flatMap((k, i, ks) => {
    const prev = i === 0 ? R.U1 : R[ks[i - 1]];
    const s = b(T[k]);
    return [
      { f: s - MORPH / 2, r: prev },
      { f: s + MORPH / 2, r: R[k], ease: EASE_IO },
    ];
  }),
];

type Shot = { id: keyof typeof R; from: number; bg: string; C: React.FC<{ t: number; S: Copy; lang: Lang }> };

const World: React.FC<P> = ({ f, S, lang }) => {
  const wr = at(worldKeys(lang), f);
  if (!wr) return null;
  const L = lockup(lang);
  const u = f / B;
  // the glyph inside the tile (logo moments only)
  const glyph =
    u < T.GROW + 0.9
      ? 1 - tw(f, b(T.GROW), b(0.8), 0, 1, EASE_IO)
      : u > T.SHRINK + 0.5
        ? tw(f, b(T.SHRINK + 1.2), b(0.8))
        : 0;
  const inUse = u >= T.FULLAT - 0.6 && u < T.SHRINK + 0.6;
  // the tile itself becomes the first card (ink -> glass), and the phone becomes the tile again
  const showTile = u < T.FULLAT || u >= T.SHRINK;
  const glass = u < T.FULLAT ? tw(f, b(T.GROW), b(T.FULLAT - T.GROW), 0, 1, EASE_IO) : 0;
  const tileLook = u < T.GROW + 0.9 || u > T.SHRINK + 0.5;
  const phoneO = u >= T.SHRINK && u < T.TILE + 1.3 ? 1 - tw(f, b(T.SHRINK + 0.7), b(1.1), 0, 1, EASE_IN) : 0;
  return (
    <>
      {inUse && <UseCase f={f} S={S} lang={lang} />}
      {showTile && (
        <div style={{ ...rectStyle(wr), background: `rgba(${mix(10, 16, glass)},${mix(10, 18, glass)},${mix(12, 22, glass)},${mix(1, 0.6, glass)})`, boxShadow: glass > 0 ? `0 0 0 1.5px rgba(255,255,255,${0.22 * glass})` : undefined }} />
      )}
      {u >= T.GROW + 0.3 && u < T.FULLAT && (
        <div style={{ ...rectStyle(wr), overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', left: wr.w / 2 - R.U1.w / 2, top: wr.h / 2 - R.U1.h / 2, width: R.U1.w, height: R.U1.h, transform: `scale(${Math.sqrt((wr.w / R.U1.w) * (wr.h / R.U1.h))})`, opacity: tw(f, b(T.GROW + 0.4), b(0.8), 0, 1, EASE_SOFT), filter: `blur(${(1 - tw(f, b(T.GROW + 0.4), b(0.8), 0, 1, EASE_SOFT)) * 8}px)` }}>
            <Onboard t={f - b(T.U1)} S={S} lang={lang} />
          </div>
        </div>
      )}
      {showTile && phoneO > 0 && (
        <div style={{ ...rectStyle(wr), overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', left: wr.w / 2 - R.U6.w / 2, top: wr.h / 2 - R.U6.h / 2, width: R.U6.w, height: R.U6.h, transform: `scale(${Math.sqrt((wr.w / R.U6.w) * (wr.h / R.U6.h))})`, opacity: phoneO, filter: `blur(${(1 - phoneO) * 8}px)` }}>
            <Phone t={Math.min(f, b(T.SHRINK)) - b(T.U6)} S={S} lang={lang} />
          </div>
        </div>
      )}
      {showTile && tileLook && glyph > 0 && (
        <div style={{ ...rectStyle(wr), display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <Img src={img('logo.png')} style={{ width: u < T.FULLAT ? 151 : Math.min(wr.w, wr.h) * 0.72, height: u < T.FULLAT ? 151 : Math.min(wr.w, wr.h) * 0.72, opacity: glyph, transform: `scale(${mix(0.8, 1, glyph)})`, filter: glyph < 1 ? `blur(${(1 - glyph) * 6}px)` : undefined }} />
        </div>
      )}
      {/* tile shine + the ripple when it lands (the reference's pixel ring, in lime) */}
      {u > T.LOGO && u < T.LOGO + 2 && (
        <Abs style={{ left: 960 - 260, top: 560 - 260, width: 520, height: 520, borderRadius: '50%', border: `3px solid rgba(198,255,61,${0.8 * (1 - tw(f, b(T.LOGO) + 8, 40))})`, transform: `scale(${mix(0.4, 1.6, tw(f, b(T.LOGO) + 8, 40, 0, 1, EASE))})` }} />
      )}
    </>
  );
};

// ================================================================ USE CASE (inside the dark world)
const GLASS = 'rgba(16,18,22,0.6)';
const SHOTS: Shot[] = [
  { id: 'U1', from: T.U1, bg: GLASS, C: Onboard },
  { id: 'U1B', from: T.U1B, bg: '#0b0b0e', C: Scan },
  { id: 'U2', from: T.U2, bg: GLASS, C: Sheet },
  { id: 'U3', from: T.U3, bg: '#000000', C: SlideOne },
  { id: 'U4', from: T.U4, bg: GLASS, C: Import },
  { id: 'U4B', from: T.U4B, bg: '#000000', C: Original },
  { id: 'U5', from: T.U5, bg: GLASS, C: Schedule },
  { id: 'U6', from: T.U6, bg: '#050506', C: Phone },
];

function UseCase({ f, S, lang }: P) {
  const hr = at(heroKeys, f);
  const u = f / B;
  const H = { color: C.ink, size: 74, y: 150 };
  // which shots are on screen: the current one, and the previous one while the card morphs
  const idx = SHOTS.reduce((a, s, i) => (f >= b(s.from) - MORPH / 2 ? i : a), -1);
  const live = [idx - 1, idx].filter((i) => i >= 0);
  const toTile = u >= T.SHRINK;
  return (
    <>
      {/* headlines */}
      <Headline t={f} at={b(T.U1)} out={b(T.U1B) - 16} text={S.u1} {...H} />
      <Headline t={f} at={b(T.U1B)} out={b(T.U2) - 16} text={S.u1b} {...H} y={140} />
      <Headline t={f} at={b(T.U2)} out={b(T.U3) - 16} text={S.u2} {...H} />
      <Headline t={f} at={b(T.U3)} out={b(T.U4) - 16} text={S.u3} {...H} />
      <Headline t={f} at={b(T.U4)} out={b(T.U5) - 16} text={S.u4} {...H} y={128} chips={{ tiktok: <Chip label="TikTok" dark size={74} glyph={<TikTokBadge size={44} />} /> }} />
      <Headline t={f} at={b(T.U4B) - 6} out={b(T.U5) - 12} text={S.u4b} {...H} y={214} />
      <Headline t={f} at={b(T.U5)} out={b(T.U6) - 16} text={S.u5} {...H} />
      <Headline t={f} at={b(T.U6)} out={b(T.SHRINK) - 4} text={S.u6} {...H} />

      <Extras f={f} S={S} lang={lang} />

      {hr && !toTile && (
        <div
          style={{
            ...rectStyle(hr),
            overflow: 'hidden',
            background: live.length === 2 && f < b(SHOTS[idx].from) + MORPH / 2 ? interpolateColors(tw(f, b(SHOTS[idx].from) - MORPH / 2, MORPH, 0, 1, EASE_IO), [0, 1], [SHOTS[live[0]].bg, SHOTS[idx].bg]) : SHOTS[Math.max(idx, 0)].bg,
            boxShadow: '0 0 0 1.5px rgba(255,255,255,0.22), inset 0 1.5px 0 rgba(255,255,255,0.25)',
          }}
        >
          {live.map((i) => {
            const s = SHOTS[i];
            const n = R[s.id];
            const t = f - b(s.from);
            const isNew = i === idx;
            const tn = f - b(SHOTS[idx].from);
            const o = isNew ? (i === 0 ? 1 : tw(tn, -MORPH / 2 + 6, 20, 0, 1, EASE_SOFT)) : 1 - tw(tn, -MORPH / 2, 16, 0, 1, EASE_IN);
            if (o <= 0) return null;
            const k = Math.sqrt((hr.w / n.w) * (hr.h / n.h));
            return (
              <div key={s.id} style={{ position: 'absolute', left: hr.w / 2 - n.w / 2, top: hr.h / 2 - n.h / 2, width: n.w, height: n.h, transform: `scale(${k})`, opacity: o, filter: o < 1 ? `blur(${(1 - o) * 10}px)` : undefined }}>
                <s.C t={t} S={S} lang={lang} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- shot contents (native card coordinates)
const PAD = 56;
const field = (focus: boolean): React.CSSProperties => ({ background: C.field, borderRadius: 16, outline: `2px solid ${focus ? C.lime : C.line}`, outlineOffset: -2, boxShadow: focus ? '0 0 0 6px rgba(198,255,61,0.08)' : undefined });

function Onboard({ t, S }: { t: number; S: Copy; lang: Lang }) {
  const url = 'slideshift.app';
  const n = Math.round(url.length * tw(t, b(0.7), b(1.1), 0, 1, (x) => x));
  const focus = t > b(0.5);
  const click = b(2.4);
  const busy = t > click + 6;
  const pr = press(t, click);
  return (
    <div style={{ position: 'absolute', inset: 0, padding: PAD, fontFamily: UI }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 650, fontSize: 42, letterSpacing: '-0.03em', color: C.bone }}>{S.u1T}</div>
      <div style={{ marginTop: 12, fontSize: 23, lineHeight: 1.45, color: C.muted, width: 700 }}>{S.u1S}</div>
      <div style={{ position: 'absolute', left: PAD, right: PAD, top: 214, height: 86, ...field(focus), display: 'flex', alignItems: 'center', padding: '0 28px', fontSize: 31, fontWeight: 500, color: n ? C.text : 'rgba(143,143,163,0.6)' }}>
        {n ? url.slice(0, n) : S.u1Ph}
        {focus && n < url.length + 1 && (t < b(1.9) || Math.floor(t / 16) % 2 === 0) && <span style={{ width: 3, height: 38, background: C.lime, marginLeft: 3 }} />}
      </div>
      <div
        style={{
          position: 'absolute', left: PAD, right: PAD, top: 334, height: 80, borderRadius: 40,
          background: n === url.length ? C.lime : 'rgba(198,255,61,0.3)', color: C.limeInk,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontSize: 29, fontWeight: 600,
          transform: `scale(${1 - pr * 0.03})`, overflow: 'hidden',
        }}
      >
        {busy ? (
          <>
            {S.u1Busy}
            {[0, 1, 2].map((d) => (
              <span key={d} style={{ width: 9, height: 9, borderRadius: 5, background: C.limeInk, opacity: 0.3 + 0.7 * Math.max(0, Math.sin((t - click) / 7 - d * 0.9)) }} />
            ))}
            <span style={{ position: 'absolute', inset: 0, background: `linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.45) 50%, transparent 70%)`, transform: `translateX(${(((t - click) % 60) / 60) * 200 - 100}%)` }} />
          </>
        ) : (
          S.u1Btn
        )}
      </div>
    </div>
  );
}

// the site, read top to bottom: a beam passes and boxes what it understood
const SITE_BOX: Record<Lang, [number, number, number, number][]> = {
  en: [[151, 27, 277, 57], [276, 190, 1169, 366], [437, 390, 1000, 444]],
  fr: [[155, 25, 277, 57], [385, 185, 1058, 365], [445, 390, 995, 445]],
};
function Scan({ t, S, lang }: { t: number; S: Copy; lang: Lang }) {
  const W = R.U1B.w;
  const k = W / 1440;
  const BAR = 48;
  const H = R.U1B.h - BAR;
  const beam = tw(t, b(0.5), b(2.2), 0, 1, EASE_IO);
  const by = beam * H;
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: UI, background: '#0b0b0e' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: BAR, display: 'flex', alignItems: 'center', gap: 9, padding: '0 18px', background: '#16161b' }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c, opacity: 0.85 }} />)}
        <span style={{ marginLeft: 'auto', marginRight: 'auto', padding: '6px 70px', borderRadius: 9, background: '#0b0b0e', color: C.muted, fontSize: 17 }}>slideshift.app</span>
      </div>
      <div style={{ position: 'absolute', left: 0, top: BAR, width: W, height: H, overflow: 'hidden' }}>
        <Img src={img(`site-${lang}.jpg`)} style={{ width: W, display: 'block', transform: `translateY(${-beam * 10}px)` }} />
        {/* what the beam has read stays lit, the rest dims a little */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: by, bottom: 0, background: `rgba(11,11,14,${0.35 * clamp(beam * 4) * (1 - tw(t, b(2.2), 20))})` }} />
        {beam > 0 && beam < 1 && (
          <>
            <div style={{ position: 'absolute', left: 0, right: 0, top: by - 90, height: 90, background: 'linear-gradient(180deg, rgba(198,255,61,0) 0%, rgba(198,255,61,0.18) 100%)' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: by - 1.5, height: 3, background: C.lime }} />
          </>
        )}
        {SITE_BOX[lang].map(([x0, y0, x1, y1], i) => {
          const at = b(0.5) + b(1.7) * clamp((y0 * k - 10) / H);
          const p = sp(t, at, SNAP);
          if (p <= 0.001) return null;
          const pad = 8;
          return (
            <div key={i} style={{ position: 'absolute', left: x0 * k - pad, top: y0 * k - pad - beam * 10, width: (x1 - x0) * k + 2 * pad, height: (y1 - y0) * k + 2 * pad, borderRadius: 10, outline: `2.5px solid ${C.lime}`, background: 'rgba(198,255,61,0.10)', opacity: clamp(p * 2), transform: `scale(${mix(1.08, 1, p)})` }}>
              <span style={{ position: 'absolute', ...(i === 0 ? { left: '100%', marginLeft: 10, top: 6 } : i === 1 ? { left: -2, top: -32 } : { left: -2, top: '100%', marginTop: 8 }), padding: '4px 10px', borderRadius: 7, background: C.lime, color: C.limeInk, fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', transform: `translateY(${(1 - p) * 6}px)` }}>{S.u1bTags[i]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Sheet({ t, S }: { t: number; S: Copy; lang: Lang }) {
  let y = 118;
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: UI }}>
      <div style={{ position: 'absolute', left: 52, top: 50, fontFamily: DISPLAY, fontWeight: 650, fontSize: 36, letterSpacing: '-0.03em', color: C.bone }}>{S.u2T}</div>
      {S.u2F.map(([label, val], i) => {
        const t0 = b(0.5) + i * b(1.15);
        const n = Math.round([...val].length * tw(t, t0, b(0.95), 0, 1, (x) => 1 - (1 - x) ** 2));
        const name = i === 0;
        const h = name ? 76 : 96;
        const top = y;
        y += 34 + h + 22;
        const active = t > t0 - 4 && t < t0 + b(1.1);
        return (
          <div key={i} style={{ position: 'absolute', left: 52, right: 52, top }}>
            <div style={{ fontSize: 19, fontWeight: 500, color: C.muted }}>{label}</div>
            <div style={{ marginTop: 10, height: h, ...field(active), display: 'flex', alignItems: name ? 'center' : 'flex-start', padding: name ? '0 22px' : '18px 24px', gap: 16, fontSize: name ? 29 : 24, fontWeight: name ? 600 : 400, lineHeight: 1.4, color: C.text }}>
              {name && n > 0 && <Img src={img('logo.png')} style={{ width: 40, height: 40, transform: `scale(${clamp(n / 3)})` }} />}
              <span>{[...val].slice(0, n).join('')}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SlideOne({ t, lang }: { t: number; S: Copy; lang: Lang }) {
  const k = tw(t, -10, b(6), 0, 1, EASE_SOFT);
  const wipe = tw(t, b(0.7), b(1.1), 0, 1, EASE_IO);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Img src={img(`${lang}-1-bg.jpg`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${mix(1.14, 1.02, k)})` }} />
      <Img src={img(`hook-text-${lang}.png`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', clipPath: `inset(0 0 ${(1 - wipe) * 100}% 0)`, filter: `blur(${(1 - wipe) * 4}px)` }} />
    </div>
  );
}

function Import({ t, S }: { t: number; S: Copy; lang: Lang }) {
  const n = Math.round(S.u4Url.length * tw(t, b(0.7), b(1), 0, 1, (x) => x));
  const click = b(2.2);
  const pr = press(t, click);
  const busy = t > click + 6;
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '44px 48px', fontFamily: UI }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 650, fontSize: 34, letterSpacing: '-0.03em', color: C.bone }}>{S.u4T}</div>
      <div style={{ position: 'absolute', left: 48, right: 48, top: 116, height: 86, display: 'flex', gap: 16 }}>
        <div style={{ flex: 1, ...field(t > b(0.5) && t < click), display: 'flex', alignItems: 'center', gap: 16, padding: '0 22px', fontSize: 27, color: C.text }}>
          <TikTokBadge size={42} />
          <span>{S.u4Url.slice(0, n)}</span>
        </div>
        <div style={{ width: 200, borderRadius: 18, background: C.lime, color: C.limeInk, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 27, fontWeight: 600, transform: `scale(${1 - pr * 0.05})` }}>
          {busy ? (
            <span style={{ width: 30, height: 30, borderRadius: 15, border: `3.5px solid rgba(18,20,10,0.25)`, borderTopColor: C.limeInk, transform: `rotate(${(t - click) * 9}deg)` }} />
          ) : (
            S.u4Btn
          )}
        </div>
      </div>
    </div>
  );
}

function Original({ lang }: { t: number; S: Copy; lang: Lang }) {
  return <Img src={img(`l-${lang}-8.jpg`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />;
}

function Schedule({ t, S }: { t: number; S: Copy; lang: Lang }) {
  const pad = 44;
  const w = 880;
  const pv = interpolate(t, [b(1.5), b(2.1), b(2.5), b(3.2)], [0, 1, 1, 2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_IO });
  const val = 1 + Math.round(pv);
  const bounce = [b(1.9), b(2.95)].reduce((a, h) => a + (t > h ? Math.sin((t - h) / 3.2) * Math.exp(-(t - h) / 8) : 0), 0);
  const tx = pad;
  const twd = w - pad * 2;
  const p = pv / 9;
  const thx = tx + 16 + (twd - 32) * p;
  const row = (y: number): React.CSSProperties => ({ position: 'absolute', left: pad, right: pad, top: y });
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: UI, color: C.text }}>
      <div style={row(46)}>
        <div style={{ fontSize: 28, fontWeight: 600 }}>{S.u5Time}</div>
        <div style={{ marginTop: 8, fontSize: 21, color: C.muted }}>{S.u5TimeS}</div>
        <div style={{ position: 'absolute', right: 0, top: -4, width: 180, height: 80, ...field(false), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>08:00</div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 160, height: 1.5, background: 'rgba(241,238,230,0.07)' }} />
      <div style={row(196)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 28, fontWeight: 600 }}>
          {S.u5Days}
          <span style={{ fontSize: 21, fontWeight: 400, color: C.muted }}>{S.u5DaysS}</span>
        </div>
        <div style={{ marginTop: 22, display: 'flex', gap: 10 }}>
          {S.days.map((d, i) => {
            const on = sp(t, b(0.4) + i * 4, SNAP);
            return (
              <div key={i} style={{ flex: 1, height: 66, borderRadius: 16, background: on > 0.5 ? C.lime : C.field, outline: on > 0.5 ? undefined : `1.5px solid ${C.line}`, outlineOffset: -1.5, color: on > 0.5 ? C.limeInk : C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 23, fontWeight: 600, transform: `scale(${1 + 0.08 * Math.sin(clamp(on) * Math.PI)})` }}>
                {d}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 362, height: 1.5, background: 'rgba(241,238,230,0.07)' }} />
      <div style={row(398)}>
        <div style={{ fontSize: 28, fontWeight: 600 }}>{S.u5Per}</div>
        <div style={{ position: 'absolute', right: 0, top: -18, fontFamily: DISPLAY, fontWeight: 760, fontSize: 64, color: C.lime, transform: `scale(${1 + bounce * 0.18})`, transformOrigin: '100% 60%' }}>{val}</div>
      </div>
      <div style={{ position: 'absolute', left: tx, width: twd, top: 478, height: 12, borderRadius: 6, background: 'rgba(241,238,230,0.12)' }} />
      <div style={{ position: 'absolute', left: tx, width: 20 + (twd - 20) * p, top: 478, height: 12, borderRadius: 6, background: C.lime }} />
      <div style={{ position: 'absolute', left: thx - 19, top: 465, width: 38, height: 38, borderRadius: 19, background: C.bone, border: `4.5px solid ${C.lime}`, boxSizing: 'border-box', transform: `scale(${t > b(1.4) && t < b(3.4) ? 1.12 : 1})` }} />
      <div style={{ position: 'absolute', left: tx, top: 512, fontSize: 21, color: C.muted }}>1</div>
      <div style={{ position: 'absolute', right: pad, top: 512, fontSize: 21, color: C.muted }}>10</div>
      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 16, height: 104, borderRadius: 18, background: 'rgba(198,255,61,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
        <span style={{ fontWeight: 700, color: C.lime, fontVariantNumeric: 'tabular-nums', display: 'inline-block', marginRight: 9, transform: `scale(${1 + bounce * 0.12})` }}>{S.u5Tot(val * 7)[0]}</span>
        <span>{S.u5Tot(val * 7)[1].trim()}</span>
      </div>
    </div>
  );
}

function Phone({ t }: { t: number; S: Copy; lang: Lang }) {
  const sw = tw(t, b(3.2), b(0.9), 0, 1, EASE_IO);
  const ring = sp(t, b(1.1), BOUNCE) * (1 - tw(t, b(2.4), b(0.8)));
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#050506' }}>
      <div style={{ position: 'absolute', left: 12, top: 12, right: 12, bottom: 12, borderRadius: 50, overflow: 'hidden', background: '#000' }}>
        <Img src={img('1.jpg')} style={{ position: 'absolute', left: `${-sw * 100}%`, top: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
        <Img src={img('3.jpg')} style={{ position: 'absolute', left: `${(1 - sw) * 100}%`, top: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
        {ring > 0.01 && <div style={{ position: 'absolute', left: 8, top: 120, width: 380, height: 168, borderRadius: 16, outline: `4px solid rgba(198,255,61,${clamp(ring)})`, transform: `scale(${mix(1.06, 1, clamp(ring))})` }} />}
      </div>
      <div style={{ position: 'absolute', left: 210 - 60, top: 26, width: 120, height: 34, borderRadius: 17, background: '#000' }} />
    </div>
  );
}

// ---------------------------------------------------------------- things around the card (stage coordinates)
const cardPt = (r: Rect, x: number, y: number) => ({ x: r.x - r.w / 2 + x, y: r.y - r.h / 2 + y });

function Extras({ f, S, lang }: P) {
  const u = f / B;
  const out: React.ReactNode[] = [];
  // U1: cursor types and clicks Continue
  if (u > T.U1 && u < T.U1B + 0.5) {
    const t = f - b(T.U1);
    const btn = cardPt(R.U1, R.U1.w * 0.6, 334 + 44);
    const c = path(t, [[b(0.3), 1500, 1010], [b(1.9), btn.x, btn.y], [b(2.9), btn.x, btn.y], [b(3.5), btn.x + 260, btn.y + 160]]);
    out.push(<Cursor key="c1" x={c.x} y={c.y} press={press(t, b(2.4))} ring={ringAt(t, b(2.4))} opacity={tw(t, b(0.3), 12) * (1 - tw(t, b(3.1), 14))} />);
  }
  if (u > T.U1B && u < T.U2 + 0.3) {
    out.push(<Callout key="k1" t={f} at={b(T.U1B + 2.3)} out={b(T.U2) - 18} x={R.U1B.x + R.U1B.w / 2 - 330} y={R.U1B.y - R.U1B.h / 2 - 44} text={S.u1Call} dark={false} />);
  }
  if (u > T.U2 && u < T.U3 + 0.3) {
    out.push(<Callout key="k2" t={f} at={b(T.U2 + 4.6)} out={b(T.U3) - 18} x={R.U2.x + R.U2.w / 2 + 36} y={R.U2.y - 200} text={S.u2Call} dark={false} />);
  }
  // U3: the fan of the other slides opens behind slide 1, then folds back
  if (u > T.U3 && u < T.U4 + 0.2) {
    const fan = [-2, -1, 1, 2];
    const fold = tw(f, b(T.U4 - 0.9), b(0.7), 0, 1, EASE_IN);
    fan.forEach((k, i) => {
      const p = sp(f, b(T.U3 + 2) + Math.abs(k) * 5 + (k > 0 ? 2 : 0), { damping: 16, mass: 0.8, stiffness: 140 });
      const q = p * (1 - fold);
      if (q <= 0.002) return;
      const x = R.U3.x + k * 225 * q;
      const y = R.U3.y + Math.abs(k) * 26 * q;
      out.push(
        <Abs key={`fan${i}`} style={{ left: x - 165, top: y - 293, width: 330, height: 586, borderRadius: 22, overflow: 'hidden', transform: `rotate(${k * 6 * q}deg) scale(${mix(0.85, 1, q)})`, zIndex: -1, opacity: clamp(q * 2) }}>
          <Img src={img(`${lang}-${[2, 3, 4, 5][i]}.jpg`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </Abs>,
      );
    });
    out.push(<Callout key="k3" t={f} at={b(T.U3 + 1.4)} out={b(T.U4) - 30} x={R.U3.x - 470} y={R.U3.y - 300} side={-1} text={S.u3Call} dark={false} />);
    out.push(<Callout key="k3b" t={f} at={b(T.U3 + 3.6)} out={b(T.U4) - 30} x={R.U3.x + 470} y={R.U3.y + 300} text={S.u3Call2} dark={false} />);
  }
  // U4: cursor clicks Analyse; then the original and your version
  if (u > T.U4 && u < T.U4B + 0.3) {
    const t = f - b(T.U4);
    const btn = cardPt(R.U4, R.U4.w - 48 - 100, 116 + 43);
    const c = path(t, [[b(0.4), 1560, 1000], [b(1.8), btn.x, btn.y], [b(2.8), btn.x, btn.y], [b(3.4), btn.x + 200, btn.y + 300]]);
    out.push(<Cursor key="c4" x={c.x} y={c.y} press={press(t, b(2.2))} ring={ringAt(t, b(2.2))} opacity={tw(t, b(0.4), 12) * (1 - tw(t, b(2.9), 12))} />);
  }
  if (u > T.U4B - 0.4 && u < T.U5 + 0.3) {
    const t = f - b(T.U4B);
    const go = 1 - tw(f, b(T.U5) - 26, 16, 0, 1, EASE_IN);
    const pv = sp(t, b(1.2), { damping: 15, mass: 0.8, stiffness: 120 });
    const yx = 1230;
    const arrow = tw(t, b(0.8), b(0.6), 0, 1, EASE_IO);
    out.push(
      <svg key="arr" width={140} height={60} style={{ position: 'absolute', left: 960 - 70, top: 650 - 30, opacity: go }}>
        <path d="M10 30 H120 M100 12 L124 30 L100 48" fill="none" stroke={C.ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - arrow} />
      </svg>,
    );
    out.push(
      <Abs key="yours" style={{ left: yx - 225 + (1 - pv) * 120, top: 650 - 300, width: 450, height: 600, borderRadius: 24, overflow: 'hidden', transform: `rotate(${(1 - pv) * 8}deg) scale(${mix(0.8, 1, pv)})`, opacity: clamp(pv * 2) * go, boxShadow: '0 0 0 2px rgba(198,255,61,0.9)' }}>
        <Img src={img(`l-${lang}-4.jpg`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </Abs>,
    );
    const lab = (key: string, x: number, txt: string, lime: boolean, a0: number) => {
      const k = sp(t, a0, BOUNCE);
      return (
        <Abs key={key} style={{ left: x, top: 995, transform: `translate(-50%, -50%) scale(${mix(0.5, 1, k)})`, opacity: clamp(k * 3) * go }}>
          <span style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 999, fontFamily: UI, fontWeight: 600, fontSize: 23, background: lime ? C.lime : '#1d1d24', color: lime ? C.limeInk : C.text, outline: lime ? undefined : `1.5px solid ${C.line}`, whiteSpace: 'nowrap' }}>{txt}</span>
        </Abs>
      );
    };
    out.push(lab('lo', R.U4B.x, S.u4Orig, false, b(0.3)));
    out.push(lab('ly', yx, S.u4Yours, true, b(1.6)));
    out.push(<Callout key="k4" t={f} at={b(T.U4B + 2.4)} out={b(T.U5) - 26} x={yx + 260} y={420} text={S.u4Call} dark={false} />);
  }
  // U5: the cursor drags the slider
  if (u > T.U5 && u < T.U6 + 0.3) {
    const t = f - b(T.U5);
    const pv = interpolate(t, [b(1.5), b(2.1), b(2.5), b(3.2)], [0, 1, 1, 2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_IO });
    const tx = 44;
    const twd = 880 - 88;
    const thumb = cardPt(R.U5, tx + 16 + (twd - 32) * (pv / 9), 484);
    const c = t < b(1.4) ? path(t, [[b(0.3), 1580, 1020], [b(1.3), thumb.x + 4, thumb.y + 8]]) : t < b(3.6) ? { x: thumb.x + 4, y: thumb.y + 8 } : path(t, [[b(3.6), thumb.x + 4, thumb.y + 8], [b(4.6), thumb.x + 300, thumb.y + 260]]);
    out.push(<Cursor key="c5" x={c.x} y={c.y} press={t > b(1.35) && t < b(3.4) ? 1 : 0} opacity={tw(t, b(0.3), 12) * (1 - tw(t, b(4.2), 14))} />);
  }
  // U6: phone callouts
  if (u > T.U6 && u < T.SHRINK + 0.3) {
    out.push(<Callout key="k6a" t={f} at={b(T.U6 + 1.2)} out={b(T.SHRINK) - 10} x={R.U6.x - R.U6.w / 2 - 40} y={470} side={-1} text={S.u6Call1} dark={false} />);
    out.push(<Callout key="k6b" t={f} at={b(T.U6 + 4.2)} out={b(T.SHRINK) - 10} x={R.U6.x + R.U6.w / 2 + 40} y={760} text={S.u6Call2} dark={false} />);
  }
  return <>{out}</>;
}

// ================================================================ BENEFITS + OUTRO (landscape)
const CHIP_POS = [
  [520, 430], [470, 620], [560, 810],
  [1400, 430], [1450, 620], [1360, 810],
];

function Benefits({ f, S, lang }: P) {
  const u = f / B;
  if (u < T.TILE) return null;
  const retract = tw(f, b(T.OUT - 0.8), b(0.7), 0, 1, EASE_IN);
  const L = lockup(lang);
  const ctaIn = sp(f, b(T.OUT + 2), SNAP);
  const click = b(T.OUT + 4.3);
  const done = tw(f, click + 6, 18, 0, 1, EASE_IO);
  const ctaOut = tw(f, b(T.END - 0.6), b(0.6), 0, 1, EASE_IN);
  const pr = press(f, click);
  const c = path(f, [[b(T.OUT + 2.6), 1500, 1020], [b(T.OUT + 3.9), 1080, 742], [b(T.END), 1080, 742]]);
  return (
    <>
      <Headline t={f} at={b(T.BEN)} out={b(T.BEN + 4.1)} text={S.b1} size={72} y={190} color={C.ink} />
      <Headline t={f} at={b(T.BEN + 4.5)} out={b(T.OUT - 0.7)} text={S.b2} size={92} y={190} color={C.ink} accent={C.ink} />
      {u < T.OUT + 0.2 &&
        S.chips.map((txt, i) => {
          const [x, y] = CHIP_POS[i];
          const a0 = b(T.BEN + 0.5) + i * 14;
          const k = sp(f, a0, BOUNCE) * (1 - retract);
          const line = tw(f, a0 - 10, 18, 0, 1, EASE_IO) * (1 - retract);
          if (k <= 0.001 && line <= 0) return null;
          const left = x < 960;
          const x0 = HUB.x + (left ? -1 : 1) * 110;
          const px = mix(HUB.x, x, k);
          const py = mix(HUB.y, y, k);
          return (
            <React.Fragment key={i}>
              <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} width={1} height={1}>
                <path d={`M${x0} ${HUB.y} C ${mix(x0, x, 0.5)} ${HUB.y}, ${mix(x0, x, 0.5)} ${y}, ${x} ${y}`} fill="none" stroke="rgba(12,12,14,0.35)" strokeWidth={2.5} strokeDasharray="4 8" pathLength={300} strokeDashoffset={0} style={{ clipPath: undefined }} opacity={line} />
              </svg>
              <Abs style={{ left: px, top: py, transform: `translate(${left ? '-100%' : '0'}, -50%) scale(${mix(0.3, 1, k)})`, transformOrigin: left ? '100% 50%' : '0 50%', opacity: clamp(k * 3) }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '15px 26px 15px 18px', borderRadius: 999, background: 'rgba(255,255,255,0.95)', boxShadow: SHADOW_LIGHT, fontFamily: UI, fontWeight: 600, fontSize: 27, color: C.ink, whiteSpace: 'nowrap' }}>
                  <span style={{ width: 13, height: 13, borderRadius: 7, background: C.lime, outline: `1.5px solid ${C.ink}` }} />
                  {txt}
                </span>
              </Abs>
            </React.Fragment>
          );
        })}
      {/* OUTRO */}
      <Headline t={f} at={b(T.OUT + 0.3)} out={b(T.END - 0.7)} text={S.o1} size={112} y={530} color={C.ink} accent={C.ink} />
      {ctaIn > 0.001 && ctaOut < 1 && (
        <Abs style={{ left: 960, top: 742, transform: `translate(-50%, -50%) scale(${mix(0.7, 1, ctaIn) * (1 - pr * 0.04) * (1 - ctaOut * 0.2)})`, opacity: clamp(ctaIn * 3) * (1 - ctaOut), filter: `blur(${ctaOut * 8}px)` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, height: 104, minWidth: 104, padding: `0 ${mix(48, 0, done)}px`, width: done > 0 ? mix(560, 104, done) : undefined, borderRadius: 52, background: C.lime, color: C.limeInk, fontFamily: UI, fontWeight: 600, fontSize: 36, whiteSpace: 'nowrap', overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)' }}>
            {done < 0.5 ? (
              <span style={{ opacity: 1 - done * 2 }}>{S.cta} →</span>
            ) : (
              <svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke={C.limeInk} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" style={{ transform: `scale(${sp(f, click + 14, BOUNCE)})` }}>
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            )}
          </div>
        </Abs>
      )}
      {ctaIn > 0.001 && (
        <Abs style={{ left: 0, right: 0, top: 838, textAlign: 'center', fontFamily: UI, fontWeight: 500, fontSize: 27, color: 'rgba(12,12,14,0.7)', opacity: tw(f, b(T.OUT + 2.6), 20) * (1 - ctaOut) }}>{S.note}</Abs>
      )}
      <Cursor x={c.x} y={c.y} press={pr} ring={ringAt(f, click)} opacity={tw(f, b(T.OUT + 2.6), 12) * (1 - tw(f, click + 30, 16))} />
      {/* END: the lockup */}
      {u > T.END + 0.2 && (
        <>
          <Abs style={{ left: L.textX, top: 500 - WORDMARK.size * 0.58, fontFamily: DISPLAY, fontWeight: 760, fontSize: WORDMARK.size, letterSpacing: '-0.045em', color: C.ink, whiteSpace: 'nowrap', lineHeight: 1.1 }}>
            {'SlideShift'.split('').map((ch, i) => (
              <MaskWord key={i} t={f} at={b(T.END + 0.35) + i * 2} out={1e9}>{ch}</MaskWord>
            ))}
          </Abs>
          <Abs style={{ left: 960, top: 690, transform: `translate(-50%, -50%) scale(${mix(0.7, 1, sp(f, b(T.END + 1.4), BOUNCE))})`, opacity: tw(f, b(T.END + 1.4), 12) }}>
            <span style={{ display: 'inline-block', padding: '16px 34px', borderRadius: 999, background: 'rgba(255,255,255,0.95)', boxShadow: SHADOW_LIGHT, fontFamily: UI, fontWeight: 600, fontSize: 34, color: C.ink }}>slideshift.app</span>
          </Abs>
        </>
      )}
    </>
  );
}

