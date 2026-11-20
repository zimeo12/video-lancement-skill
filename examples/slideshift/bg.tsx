import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill } from 'remotion';
import { mix } from './kit';

// ---------------------------------------------------------------- the LED hills, drawn in code
// A heightfield raymarched in a fragment shader, one ray per LED cell (240x135), blown up 8x
// without smoothing: the hills roll like footage on an LED wall. Pure function of t.
const CELL = 12;
const SW = 1920 / CELL;
const SH = 1080 / CELL;

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }`;
const FRAG = `
precision highp float;
uniform vec2 R; uniform float T; uniform float dip;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
float fbm3(vec2 p){ float a = .5, s = 0.; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++) { s += a * noise(p); p = m * p; a *= .5; } return s / .875; }
float fbm(vec2 p){ float a = .5, s = 0.; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { s += a * noise(p); p = m * p; a *= .5; } return s; }
// sculpted rolling folds, like draped cloth: two slow swells through a warped domain, over broad hills
float F(vec2 p){
  vec2 w = vec2(fbm3(p * 0.22 + vec2(0., T * 0.02)), fbm3(p * 0.22 + vec2(5.2, -T * 0.017)));
  vec2 q = p + (w - .5) * 2.4;
  q.y += sin(p.x * 0.5 + T * 0.12) * 1.1 + sin(p.x * 1.2 - T * 0.09) * 0.35;
  float r1 = sin(q.y * 1.6 + q.x * 0.3 + T * 0.35) * .5 + .5;
  float r2 = sin(q.x * 0.7 - q.y * 0.9 - T * 0.22 + 1.7) * .5 + .5;
  float r3 = sin(q.y * 4.3 + q.x * 0.9 + w.x * 6. + T * 0.5) * .5 + .5;   // fine drapes on the flanks
  return (smoothstep(0., 1., r1) * 0.62 + r2 * 0.22 + r3 * 0.16) / 1.0;   // 0 in the folds .. 1 on the crests
}
float G(vec2 p){ return fbm3(p * 0.055 + 2.) * 5.0 + sin(p.x * 0.19 + T * 0.05) * 0.7; }
float H(vec2 p){ return F(p) * 1.4 + G(p); }
vec3 N(vec2 p){ float e = 0.03; return normalize(vec3(H(p - vec2(e, 0)) - H(p + vec2(e, 0)), 2. * e, H(p - vec2(0, e)) - H(p + vec2(0, e)))); }
vec4 shade(vec2 fc){
  vec2 uv = (fc - .5 * R) / R.y;
  float pitch = mix(0.02, 0.09, dip);
  vec3 ro = vec3(sin(T * 0.03) * 1.5, 0., T * 0.25);
  ro.y = max(G(ro.xz), G(ro.xz + vec2(0., 2.))) + 2.1;
  vec3 rd = normalize(vec3(uv.x, uv.y + pitch, 1.25));
  // sky: clear blue with big soft clouds
  float hy = uv.y + pitch;
  vec3 sky = mix(vec3(0.80, 0.88, 0.96), vec3(0.62, 0.77, 0.94), smoothstep(0.0, 0.45, hy));
  vec2 cq = vec2(uv.x * 0.8 + T * 0.006, hy * 1.9);
  float cl = fbm(cq + 3.) + (fbm3(cq * 0.6 + 8.) - .5) * 0.5;
  float cm = smoothstep(0.55, 0.585, cl) * smoothstep(0.04, 0.16, hy);
  float under = smoothstep(0.55, 0.75, fbm(cq + 3. + vec2(0., -0.06)));   // denser just below: the lit top
  vec3 cloud = mix(vec3(0.82, 0.87, 0.93), vec3(1.0, 1.0, 0.99), smoothstep(0.56, 0.68, cl) * 0.7 + 0.3 * under);
  sky = mix(sky, cloud, cm);
  // march
  float t = 0.4, tp = 0.4; bool hit = false; vec3 p;
  for (int i = 0; i < 220; i++) {
    p = ro + rd * t;
    float d = p.y - H(p.xz);
    if (d < 0.002 * t) { hit = true; break; }
    tp = t; t += max(0.012, d * 0.3);
    if (t > 80.) break;
  }
  if (hit) { float a = tp, b2 = t; for (int k = 0; k < 6; k++) { float m = .5 * (a + b2); vec3 q = ro + rd * m; if (q.y - H(q.xz) < 0.) b2 = m; else a = m; } t = b2; p = ro + rd * t; }
  vec3 fogc = vec3(0.74, 0.83, 0.88);
  vec3 col = sky;
  if (hit) {
    vec3 n = N(p.xz);
    vec3 L = normalize(vec3(-0.7, 0.55, 0.45));
    float dif = clamp(dot(n, L), 0., 1.);
    float cr = F(p.xz);
    float k = clamp(dif * 0.7 + cr * 0.6 - 0.1, 0., 1.);
    vec3 deep = vec3(0.05, 0.21, 0.24), mid = vec3(0.30, 0.52, 0.22), lit = vec3(0.92, 0.91, 0.22), hot = vec3(1.0, 0.98, 0.6);
    col = mix(deep, mid, smoothstep(0.08, 0.42, k));
    col = mix(col, lit, smoothstep(0.46, 0.74, k));
    col = mix(col, hot, smoothstep(0.92, 1.05, k) * 0.5);
    // lavender bands along the shaded folds
    float lav = smoothstep(0.46, 0.64, fbm(p.xz * vec2(0.35, 0.6) + 11.)) * (1. - smoothstep(0.25, 0.55, k));
    col = mix(col, vec3(0.52, 0.47, 0.86), lav * 0.7);
    // painterly streaks along the folds
    col *= 0.8 + 0.4 * fbm(p.xz * vec2(1.2, 3.4) + 4.);
    // patches: some slopes greener, some more golden
    float hv = fbm(p.xz * 0.45 + 21.);
    col = mix(col, col * vec3(1.08, 1.0, 0.7), smoothstep(0.5, 0.75, hv) * 0.6);
    col = mix(col, col * vec3(0.8, 1.02, 1.05), smoothstep(0.5, 0.25, hv) * 0.5);
    // a few warm specks on the sunny side
    col = mix(col, vec3(0.97, 0.62, 0.22), smoothstep(0.82, 0.88, noise(p.xz * 2.1)) * 0.4 * dif);
    // light haze far away only
    col = mix(col, fogc, (1. - exp(-max(t - 7., 0.) * 0.05)) * 0.85);
  }
  return vec4(col, hit ? 1. : 0.);
}
void main(){
  vec2 c = gl_FragCoord.xy;
  gl_FragColor = (shade(c + vec2(-.25, -.25)) + shade(c + vec2(.25, -.25)) + shade(c + vec2(-.25, .25)) + shade(c + vec2(.25, .25))) * .25;
}`;

const LED = `
precision highp float;
uniform sampler2D tex; uniform vec2 R; uniform vec2 G; uniform float T; uniform float grid;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main(){
  vec2 fc = vec2(gl_FragCoord.x, R.y - gl_FragCoord.y);
  vec2 cell = floor(fc / ${CELL}.);
  vec2 lp = fract(fc / ${CELL}.) - .5;
  vec2 tc = vec2(cell.x + .5, G.y - cell.y - .5) / G;
  vec4 tx = texture2D(tex, tc);
  vec3 c = tx.rgb;
  float land = tx.a;
  float jit = hash(cell * 1.7 + 9.), hue = hash(cell + 2.3);
  vec3 v = c * (0.8 + 0.38 * jit);
  v = mix(v, v * vec3(1.12, 1.06, 0.7), step(0.72, hue) * 0.6);     // some LEDs more golden
  v = mix(v, v * vec3(0.8, 0.95, 1.12), step(hue, 0.18) * 0.5);      // some more teal
  c = mix(c, v, land * (1. - smoothstep(0.35, 0.6, tc.y)));   // calmer near the horizon
  vec3 sm = texture2D(tex, vec2(fc.x, R.y - fc.y) / R).rgb;            // the smooth picture, for the gaps and the glow
  float d = max(abs(lp.x), abs(lp.y));
  float led = 1. - smoothstep(0.30, 0.37, d);                           // square LED
  float core = exp(-dot(lp, lp) * 14.);                                 // hot centre: the shine
  vec3 lit = c * 1.04 + core * 0.20 * (1.15 - c);
  vec3 gap = mix(c, sm, .6) * mix(1.16, 0.72, land);
  vec3 col = mix(gap, lit, led);
  col += sm * 0.06 * (1. - led);                                        // a little bloom into the gaps
  // a few LEDs glint now and then
  float g = step(0.982, hash(cell + 3.1)) * pow(max(0., sin(T * 1.7 + hash(cell) * 50.)), 24.);
  col += g * 0.55 * led * (0.6 + core) * land;
  gl_FragColor = vec4(mix(sm, col, grid), 1.);
}`;

type GLS = { gl: WebGLRenderingContext; hills: WebGLProgram; led: WebGLProgram; fb: WebGLFramebuffer | null; tex: WebGLTexture | null; uh: Record<string, WebGLUniformLocation | null>; ul: Record<string, WebGLUniformLocation | null> };
const setup = (cv: HTMLCanvasElement): GLS => {
  const gl = cv.getContext('webgl', { preserveDrawingBuffer: true, antialias: false })!;
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  const prog = (frag: string) => {
    const pr = gl.createProgram()!;
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(pr);
    return pr;
  };
  const hills = prog(FRAG);
  const led = prog(LED);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  for (const pr of [hills, led]) {
    const a = gl.getAttribLocation(pr, 'a');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  }
  // the hills render into a cell-sized texture, the LED pass reads it
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SW, SH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const U = (pr: WebGLProgram, ...names: string[]) => Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(pr, n)]));
  return { gl, hills, led, fb, tex, uh: U(hills, 'R', 'T', 'dip'), ul: U(led, 'tex', 'R', 'G', 'T', 'grid') };
};

/** soft: 0 = crisp LED hills (hero moments), 1 = pale and defocused behind the cards. t in frames (60 fps). */
export const Landscape: React.FC<{ t: number; soft: number; dip?: number }> = ({ t, soft, dip = 0 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const gls = useRef<GLS | null>(null);
  const grid = 1 - 0.85 * soft;
  useLayoutEffect(() => {
    if (!ref.current) return;
    gls.current ??= setup(ref.current);
    const { gl, hills, led, fb, tex, uh, ul } = gls.current;
    const T = t / 60 + 40;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, SW, SH);
    gl.useProgram(hills);
    gl.uniform2f(uh.R, SW, SH);
    gl.uniform1f(uh.T, T);
    gl.uniform1f(uh.dip, dip);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, 1920, 1080);
    gl.useProgram(led);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(ul.tex, 0);
    gl.uniform2f(ul.R, 1920, 1080);
    gl.uniform2f(ul.G, SW, SH);
    gl.uniform1f(ul.T, T);
    gl.uniform1f(ul.grid, grid);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }, [t, dip, grid]);
  return (
    <AbsoluteFill>
      <canvas ref={ref} width={1920} height={1080} style={{ width: 1920, height: 1080, filter: soft > 0.01 ? `blur(${(soft * 16).toFixed(1)}px) saturate(${1 - soft * 0.25})` : undefined, transform: `scale(${1 + soft * 0.04})` }} />
      {/* pale haze, strongest at the top where the headline sits */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(242,245,248,${0.1 + 0.6 * soft}) 0%, rgba(242,245,248,${0.45 * soft}) 45%, rgba(242,245,248,${0.2 * soft}) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- the product's world (ink, the site's dot grid)
export type Rect = { x: number; y: number; w: number; h: number; r: number };
export const FULL: Rect = { x: 960, y: 540, w: 1920, h: 1080, r: 0 };
export const lerpRect = (a: Rect, b2: Rect, p: number): Rect => ({ x: mix(a.x, b2.x, p), y: mix(a.y, b2.y, p), w: mix(a.w, b2.w, p), h: mix(a.h, b2.h, p), r: mix(a.r, b2.r, p) });
export const rectStyle = (r: Rect): React.CSSProperties => ({ position: 'absolute', left: r.x - r.w / 2, top: r.y - r.h / 2, width: r.w, height: r.h, borderRadius: r.r });
