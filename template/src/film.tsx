// Starter film: shows every pattern of the skill on a 8 s timeline. Replace the scenes, keep the structure.
// Everything is a pure function of the frame. Times are in BEATS (b(n) -> frames), so the cut follows the track.
import React, { useEffect, useState } from 'react';
import { AbsoluteFill, continueRender, delayRender, interpolate, useCurrentFrame } from 'remotion';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { COPY, Copy } from './copy';
import {
  B, BOUNCE, C, CamKey, Callout, Cursor, EASE, EASE_IO, Headline, Key, Lang, Roll, UI, b, camAt, camTransform, clamp, fontsReady,
  mix, path, press, rectAt, rectStyle, ringAt, sp, tw,
} from './kit';

export const TOTAL = b(16);

// ================================================================ timeline (beats)
const T = { P1: 0, P2: 5.5, CARD: 8, CLICK: 11.5, END: 16 };

// ================================================================ camera: zoom IN on the action, hold, zoom OUT before the next move
const CAM: CamKey[] = [
  [0, 960, 540, 1],
  [T.CARD + 1.0, 960, 540, 1], [T.CARD + 2.0, 960, 600, 1.45], [T.CARD + 3.6, 960, 600, 1.45], [T.CARD + 4.6, 960, 540, 1],
];

// ================================================================ background softness: 0 = crisp, 1 = defocused behind cards
// Keys in beats; ease between them, never jump (a jump in blur reads as a glitch).
const SOFT_U = [0, 6, 8, 16];
const SOFT_V = [0.1, 0.1, 0.6, 0.6];

// motion blur only where things travel fast; still frames stay 1 sample (render time)
const FAST = [T.P2, T.CARD, T.CARD + 2, T.CARD + 4.6];
const blurSamples = (f: number) => (FAST.some((k) => f > b(k - 1) && f < b(k + 1.5)) ? 6 : 1);

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

export const Film: React.FC<{ lang: Lang }> = ({ lang }) => {
  const ready = useFonts();
  const f = useCurrentFrame();
  const u = f / B;
  const soft = interpolate(u, SOFT_U, SOFT_V, { extrapolateRight: 'clamp', easing: EASE_IO });
  // a short scale push on structural hits, decaying
  const punch = [T.CARD].reduce((a, h) => a + (f >= b(h) ? 0.025 * Math.exp(-(f - b(h)) / 14) : 0), 0);
  // handheld drift, tiny
  const fx = Math.sin(f / 70) * 4;
  const fy = Math.sin(f / 90 + 1) * 3;
  const z = camAt(CAM, f).z;
  return (
    <AbsoluteFill style={{ background: C.bone, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${1 + punch})` }}>
        {/* the background follows the camera at 12 %: depth without stealing focus */}
        <AbsoluteFill style={{ transform: `scale(${1.02 * (1 + (z - 1) * 0.12)}) translate(${fx * 0.4}px, ${fy * 0.4}px)` }}>
          <Backdrop t={f} soft={soft} />
        </AbsoluteFill>
        {ready && (
          <AbsoluteFill style={{ transform: `translate(${fx}px, ${fy}px)` }}>
            <CameraMotionBlur samples={blurSamples(f)} shutterAngle={200}>
              <Fore S={COPY[lang]} />
            </CameraMotionBlur>
          </AbsoluteFill>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// replace with the brand's world (the SlideShift example has a WebGL landscape in examples/slideshift/bg.tsx)
const Backdrop: React.FC<{ t: number; soft: number }> = ({ t, soft }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(60% 70% at ${40 + Math.sin(t / 200) * 10}% 30%, #c6ff3d55, transparent), radial-gradient(50% 60% at ${70 + Math.cos(t / 240) * 8}% 80%, #7cc4ff66, transparent), ${C.bone}`,
      filter: `blur(${soft * 16}px)`,
    }}
  />
);

// the foreground reads its own frame so CameraMotionBlur can sample between frames
const Fore: React.FC<{ S: Copy }> = ({ S }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ transformOrigin: '0 0', transform: camTransform(camAt(CAM, f)) }}>
      <Problem f={f} S={S} />
      <Card f={f} S={S} />
    </AbsoluteFill>
  );
};

// ================================================================ scene 1: headline + counter that lands exactly on the value
const Problem: React.FC<{ f: number; S: Copy }> = ({ f, S }) => {
  if (f > b(T.P2 + 2.5)) return null;
  const roll = tw(f, b(0.6), b(3.6), 0, 1, (x) => x); // Roll eases each column itself: feed it linear time
  const out = tw(f, b(T.P2 - 0.6), b(0.8), 0, 1, EASE_IO);
  return (
    <>
      <Headline t={f} at={b(0.2)} out={b(T.P2 - 0.8)} text={S.h1} size={64} y={300} color={C.ink} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 380, textAlign: 'center', fontFamily: UI, fontWeight: 700, fontSize: 170, letterSpacing: '-0.04em', color: C.ink, opacity: (1 - out) * clamp(f / 12), filter: `blur(${out * 10}px)`, transform: `translateY(${-out * 40}px)` }}>
        <Roll value={S.big} p={roll} /> <span style={{ fontSize: 60, fontWeight: 500 }}>{S.views}</span>
      </div>
      <Headline t={f} at={b(T.P2)} out={b(T.CARD - 0.6)} text={S.h2} size={78} y={540} color={C.ink} accent="#3a7d00" />
    </>
  );
};

// ================================================================ scene 2: a tile grows into the card; type, click, callout
const CARD = { x: 960, y: 560, w: 900, h: 420, r: 30 };
const KEYS: Key[] = [
  { f: b(T.CARD), r: { x: 960, y: 560, w: 1, h: 1, r: 0 } },
  { f: b(T.CARD) + 22, r: { x: 960, y: 560, w: 200, h: 200, r: 46 }, ease: EASE },
  { f: b(T.CARD + 1), r: CARD, ease: EASE_IO },
];
const Card: React.FC<{ f: number; S: Copy }> = ({ f, S }) => {
  const r = rectAt(KEYS, f);
  if (!r) return null;
  const inside = tw(f, b(T.CARD + 0.6), b(0.8), 0, 1, EASE_IO); // content fades + unblurs in as the card opens
  const typed = S.url.slice(0, Math.floor(clamp((f - b(T.CARD + 1.2)) / 4, 0, S.url.length)));
  const click = b(T.CLICK);
  const cur = path(f, [[b(T.CARD + 1.5), 1300, 900], [click - 10, 1180, 700]]);
  const btn = sp(f, click, BOUNCE);
  return (
    <>
      <div style={{ ...rectStyle(r), background: C.panel, boxShadow: '0 30px 80px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: inside, filter: `blur(${(1 - inside) * 8}px)`, transform: `scale(${mix(0.96, 1, inside)})` }}>
          <div style={{ position: 'absolute', left: 60, right: 60, top: 150, height: 90, borderRadius: 18, background: C.field, border: `1.5px solid ${C.line}`, fontFamily: UI, fontSize: 36, color: C.text, display: 'flex', alignItems: 'center', paddingLeft: 30 }}>
            {typed || <span style={{ color: C.muted }}>{S.url}</span>}
          </div>
          <div style={{ position: 'absolute', right: 60, bottom: 50, padding: '20px 40px', borderRadius: 999, background: C.lime, color: C.limeInk, fontFamily: UI, fontWeight: 600, fontSize: 30, transform: `scale(${1 - 0.06 * press(f, click) + 0.03 * (btn - 1)})` }}>{S.btn}</div>
        </div>
      </div>
      {f > b(T.CARD + 1.5) && <Cursor x={cur.x} y={cur.y} press={press(f, click)} ring={ringAt(f, click)} />}
      <Callout t={f} at={click + 20} x={1060} y={300} text={S.call} />
    </>
  );
};
