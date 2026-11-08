import * as THREE from 'three';
import {clamp01, easeInOutCubic, lerp} from '../kit/util.js';
import TL from './timeline.json';

/** Palette: sky blue, calm violet, white, deep night navy. Warm tones only as pale pearl. */
export const C = {
  night: '#0c1430',
  navy: '#151f4a',
  ink: '#1c2152',
  sky: '#6cc8ff',
  skySoft: '#a9e0ff',
  violet: '#8d7cf6',
  violetSoft: '#bfb2ff',
  lilac: '#d9d3ff',
  white: '#f5f8ff',
  pearl: '#ffe9e1',
  blush: '#f6c9dc',
  mint: '#9fdcca',
  skin: '#efc6b2',
  skinShade: '#d9a996',
  hair: '#1b1d3f',
};
export const F = {ar: "'Plex Arabic', 'Inter', sans-serif"};
export {TL};

export const SC = Object.fromEntries(TL.scenes.map((s) => [s.id, s]));
export const LN = Object.fromEntries(TL.lines.map((l) => [l.id, l]));

/** Start time of the first word in line `id` that contains `frag` (fallback: line start). */
export const wordT = (id, frag, end = false) => {
  const w = LN[id].words.find((x) => x.w.includes(frag));
  return w ? (end ? w.b : w.a) : LN[id].t0;
};

/** 0→1→0 bump around t0..t1 with soft edges of length e. */
export const band = (t, t0, t1, e = 0.4) => Math.min(clamp01((t - t0) / e), clamp01((t1 - t) / e));
export const ramp = (t, t0, d = 0.6, ease = easeInOutCubic) => ease(clamp01((t - t0) / d));
export const mix = lerp;
export const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

const std = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.62, metalness: 0, ...o});
export const mat = std;

/** Capsule from point a to point b. */
export function capsule(a, b, r, material) {
  const A = v3(a);
  const B = v3(b);
  const len = A.distanceTo(B);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 8, 18), material);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}
/** Re-aim an existing capsule between a and b (geometry length fixed at build time). */
export function aim(m, a, b) {
  const A = v3(a);
  const B = v3(b);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
}

export function sphere(r, material, sx = 1, sy = 1, sz = 1, seg = 32) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), material);
  m.scale.set(sx, sy, sz);
  return m;
}

/** Canvas → texture helper. draw(ctx, w, h). */
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Soft round sprite for particles. */
export const dotTex = () =>
  canvasTex(64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  });

/** Soft contact shadow under an object (a dark radial disc). */
export function contact(r, opacity = 0.35, color = '#1a1f4d') {
  const tex = canvasTex(128, 128, (g) => {
    const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 128, 128);
  });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 2, r * 2),
    new THREE.MeshBasicMaterial({map: tex, color, transparent: true, opacity, depthWrite: false}),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

// --- 3D simplex noise (Gustavson), used for brain folds and wisps ---
const grad3 = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
const perm = new Uint8Array(512);
{
  const p = new Uint8Array(256).map((_, i) => i);
  let s = 1337;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}
export function noise3(x, y, z) {
  const F3 = 1 / 3;
  const G3 = 1 / 6;
  const s = (x + y + z) * F3;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const k = Math.floor(z + s);
  const t = (i + j + k) * G3;
  const x0 = x - i + t;
  const y0 = y - j + t;
  const z0 = z - k + t;
  let i1, j1, k1, i2, j2, k2;
  if (x0 >= y0) {
    if (y0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 1, 0];
    else if (x0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 0, 1];
    else [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 1, 0, 1];
  } else if (y0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 0, 1, 1];
  else if (x0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 0, 1, 1];
  else [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 1, 1, 0];
  const pts = [
    [x0, y0, z0, 0, 0, 0],
    [x0 - i1 + G3, y0 - j1 + G3, z0 - k1 + G3, i1, j1, k1],
    [x0 - i2 + 2 * G3, y0 - j2 + 2 * G3, z0 - k2 + 2 * G3, i2, j2, k2],
    [x0 - 1 + 3 * G3, y0 - 1 + 3 * G3, z0 - 1 + 3 * G3, 1, 1, 1],
  ];
  let n = 0;
  const ii = i & 255;
  const jj = j & 255;
  const kk = k & 255;
  for (const [px, py, pz, a, b, c] of pts) {
    let tt = 0.6 - px * px - py * py - pz * pz;
    if (tt < 0) continue;
    const g = grad3[perm[ii + a + perm[jj + b + perm[kk + c]]] % 12];
    tt *= tt;
    n += tt * tt * (g[0] * px + g[1] * py + g[2] * pz);
  }
  return 32 * n;
}
