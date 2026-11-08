import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import cairo700 from '../../node_modules/@fontsource/cairo/files/cairo-arabic-700-normal.woff2';
import cairo800 from '../../node_modules/@fontsource/cairo/files/cairo-arabic-800-normal.woff2';
import cairo900 from '../../node_modules/@fontsource/cairo/files/cairo-arabic-900-normal.woff2';
import {runSim} from '../kit/runtime.js';
import {clamp01, easeInOutCubic, easeOutCubic, lerp, rng, smooth} from '../kit/util.js';
import TL from './timeline.json';

// "The hole in the airplane window": a 9:16 Arabic explainer. The camera starts
// in the cabin, pushes into the breather hole of the middle pane, flies out
// through it, shows the fuselage cross-section as the plane climbs (outside
// pressure drops, cabin pressure is held), then explodes the window into its
// three panes: the outer pane carries the pressure difference, the hole lets
// cabin air into the gap so the middle pane is unloaded (fail-safe backup), and
// it vents moisture so the gap does not fog. Narration timings come from
// timeline.json (word timestamps of the voiceover).
//
// Figures: ISA pressure at 11,000 m ≈ 0.23 bar; cabin held at ≈ 2,400 m
// equivalent (8,000 ft) ≈ 0.75 bar, so the outer pane carries ≈ 0.5 bar.

const S = TL.sentences.map((s) => s.start);
const wordAt = (w) => TL.words.find((x) => x.w.startsWith(w)).s;
const T = {
  s1: S[0], s2: S[1], s3: S[2], s4: S[3], s5: S[4], s6: S[5], s6b: wordAt('والطبقة'),
  s7: S[6], s8: S[7], end: TL.duration,
};

const DEFAULTS = {
  duration: TL.duration,
  fps: 30,
  theme: 'dark',
  hud: {enabled: false, title: 'window', subtitle: ''},
  director: {enabled: false},
  watermark: '',
};

// ---------- geometry constants (metres) ----------
const R = 2.0; // fuselage outer radius
const RS = R - 0.1; // cabin sidewall lining
const YW = 0.3; // window centre height
const PITCH = 0.53; // window pitch
const FLOOR = -0.55;
const ZMAX = 14;
const PANE = {
  outer: {w: 0.27, h: 0.38, r: 0.1, t: 0.01, z: -0.006},
  middle: {w: 0.26, h: 0.37, r: 0.095, t: 0.006, z: -0.022},
  inner: {w: 0.25, h: 0.36, r: 0.09, t: 0.003, z: -0.07},
};
const HOLE_Y = -PANE.middle.h / 2 + 0.04;
const HOLE_R = 0.002;
const SECT_Z = 0.265; // section cut between two windows
const COL = {
  cabin: '#ff7a3d',
  out: '#5ab8ff',
  hole: '#ffcf33',
  outer: '#ff9a52',
  middle: '#47d6ff',
  inner: '#9be27a',
};

// ---------- helpers ----------
const hermite = (keys, t, f) => {
  const n = keys.length;
  if (t <= keys[0].t) return keys[0][f];
  if (t >= keys[n - 1].t) return keys[n - 1][f];
  let i = 0;
  while (keys[i + 1].t < t) i++;
  const a = keys[i], b = keys[i + 1];
  const h = b.t - a.t;
  const s = (t - a.t) / h;
  const tan = (j) => {
    if (j <= 0 || j >= n - 1) return keys[j][f].map(() => 0);
    const p = keys[j - 1], q = keys[j + 1];
    const same = (u, v) => u[f].every((x, k) => Math.abs(x - v[f][k]) < 1e-6);
    if (keys[j].hold || same(keys[j], p) || same(keys[j], q)) return keys[j][f].map(() => 0);
    return keys[j][f].map((_, k) => (q[f][k] - p[f][k]) / (q.t - p.t));
  };
  const ma = tan(i), mb = tan(i + 1);
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s, h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
  return a[f].map((v, k) => h00 * v + h10 * h * ma[k] + h01 * b[f][k] + h11 * h * mb[k]);
};
const ramp = (t, a, b, e = easeInOutCubic) => e(clamp01((t - a) / (b - a)));
const win = (t, a, b, fin = 0.35, fout = 0.35) => ramp(t, a, a + fin) * (1 - ramp(t, b - fout, b));
const isa = (h) => 1.01325 * Math.pow(1 - 2.25577e-5 * h, 5.25588);

const roundLoop = (w, h, r, n = 10) => {
  const pts = [];
  const cs = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2], [-w / 2 + r, -h / 2 + r, Math.PI], [w / 2 - r, -h / 2 + r, 1.5 * Math.PI]];
  for (const [cx, cy, a0] of cs) for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * (Math.PI / 2);
    pts.push(new THREE.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  return pts;
};
const roundShape = (w, h, r) => new THREE.Shape(roundLoop(w, h, r, 12));
const loft = (la, za, lb, zb) => {
  const pos = [];
  const n = la.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const A = [la[i].x, la[i].y, za], B = [la[j].x, la[j].y, za], C = [lb[j].x, lb[j].y, zb], D = [lb[i].x, lb[i].y, zb];
    pos.push(...A, ...B, ...C, ...A, ...C, ...D);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};
const ringGeo = (wo, ho, ro, wi, hi, ri, depth) => {
  const s = roundShape(wo, ho, ro);
  s.holes.push(new THREE.Path(roundLoop(wi, hi, ri, 12).reverse()));
  return new THREE.ExtrudeGeometry(s, {depth, bevelEnabled: false, curveSegments: 12});
};

// local window frame → world (local x = −world z, local y = up the wall, local z = outward normal)
const frameFor = (side, z) => {
  const xs = Math.sqrt(R * R - YW * YW);
  const N = new THREE.Vector3((side * xs) / R, YW / R, 0);
  const Y = new THREE.Vector3(-N.y * side, N.x * side, 0);
  const X = new THREE.Vector3().crossVectors(Y, N);
  const C = new THREE.Vector3(side * xs, YW, z);
  const m = new THREE.Matrix4().makeBasis(X, Y, N).setPosition(C);
  return {C, N, X, Y, m};
};
const HERO = frameFor(1, 0);
const W = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(HERO.m).toArray();

// ---------- shaders ----------
const LOGV = ['#include <common>', '#include <logdepthbuf_pars_vertex>'].join('\n');
const LOGF = '#include <logdepthbuf_pars_fragment>';

function cutWindows(mat, radius, hw, hh, rr) {
  const cy = (YW * radius) / R;
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWp;
float winD(vec3 p) {
  float zk = ${PITCH.toFixed(4)} * floor(p.z / ${PITCH.toFixed(4)} + 0.5);
  vec2 q = abs(vec2(p.z - zk, p.y - ${cy.toFixed(4)})) - vec2(${(hw / 2 - rr).toFixed(4)}, ${(hh / 2 - rr).toFixed(4)});
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - ${rr.toFixed(4)};
}`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
if (abs(vWp.z) < ${ZMAX.toFixed(1)} && abs(vWp.x) > 1.0 && winD(vWp) < 0.0) discard;`,
      );
  };
  return mat;
}

const NOISE = `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

runSim(DEFAULTS, async ({cfg, canvas, capture}) => {
  for (const [w, src] of [[700, cairo700], [800, cairo800], [900, cairo900]]) {
    const f = new FontFace('Cairo', `url(${src})`, {weight: String(w)});
    document.fonts.add(await f.load());
  }

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true});
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.002, 30000);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.75;

  const SECT = new THREE.Plane(new THREE.Vector3(0, 0, -1), 40);
  const CLIP = [SECT];

  // ---------- lights ----------
  const sun = new THREE.DirectionalLight('#fff4e2', 2.6);
  sun.position.set(6, 9, -3);
  scene.add(sun, new THREE.HemisphereLight('#eef4ff', '#4a4f58', 0.9));
  for (const z of [-3, 0, 3]) {
    const l = new THREE.PointLight('#fff1dc', 2.2, 7, 2);
    l.position.set(0.9, 1.35, z + 0.6);
    scene.add(l);
  }

  // ---------- sky + cloud deck ----------
  const skyU = {uAlt: {value: 0}};
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(6000, 48, 24),
    new THREE.ShaderMaterial({
      uniforms: skyU,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      vertexShader: `${LOGV}
varying vec3 vDir;
void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
#include <logdepthbuf_vertex>
}`,
      fragmentShader: `${LOGF}
uniform float uAlt; varying vec3 vDir;
void main(){
#include <logdepthbuf_fragment>
  vec3 d = normalize(vDir);
  vec3 zen = mix(vec3(0.22, 0.47, 0.82), vec3(0.08, 0.22, 0.55), uAlt);
  vec3 hor = mix(vec3(0.80, 0.88, 0.97), vec3(0.72, 0.83, 0.96), uAlt);
  vec3 c = d.y > 0.0 ? mix(hor, zen, pow(clamp(d.y, 0.0, 1.0), 0.5)) : mix(hor, vec3(0.86, 0.9, 0.95), clamp(-d.y * 5.0, 0.0, 1.0));
  gl_FragColor = vec4(c, 1.0);
}`,
    }),
  );
  sky.renderOrder = -10;
  scene.add(sky);

  const cloudU = {uT: {value: 0}, uCam: {value: new THREE.Vector3()}, uAlt: {value: 0}};
  const clouds = new THREE.Mesh(
    new THREE.PlaneGeometry(40000, 40000, 1, 1).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: cloudU,
      transparent: true,
      depthWrite: false,
      vertexShader: `${LOGV}
varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
#include <logdepthbuf_vertex>
}`,
      fragmentShader: `${LOGF}
uniform float uT, uAlt; uniform vec3 uCam; varying vec3 vW;
${NOISE}
void main(){
#include <logdepthbuf_fragment>
  vec2 p = vW.xz / 420.0 + vec2(0.0, uT * 0.05);
  float n = fbm(p);
  float m = smoothstep(0.42, 0.66, n);
  float shade = smoothstep(0.42, 0.85, fbm(p * 1.9 + 3.0));
  vec3 c = mix(vec3(0.74, 0.79, 0.86), vec3(1.0), shade);
  float dist = length(vW.xz - uCam.xz);
  vec3 hor = mix(vec3(0.80, 0.88, 0.97), vec3(0.72, 0.83, 0.96), uAlt);
  float haze = smoothstep(800.0, 12000.0 + 6000.0 * uAlt, dist);
  c = mix(c, hor, haze);
  float a = mix(m, 0.85, haze) * (1.0 - smoothstep(14000.0, 19000.0, dist));
  gl_FragColor = vec4(c, a);
}`,
    }),
  );
  clouds.renderOrder = -9;
  scene.add(clouds);

  // ---------- fuselage ----------
  const ghostMats = [];
  const gm = (m, k = 1) => {
    m.clippingPlanes = CLIP;
    ghostMats.push([m, k]);
    return m;
  };
  const skinMat = gm(cutWindows(new THREE.MeshStandardMaterial({color: '#eef1f4', metalness: 0.25, roughness: 0.42, side: THREE.DoubleSide}), R, 0.235, 0.335, 0.09));
  const skin = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 60, 160, 1, true).rotateX(Math.PI / 2), skinMat);
  const wallMat = gm(cutWindows(new THREE.MeshStandardMaterial({color: '#e8e4dc', metalness: 0, roughness: 0.75, side: THREE.DoubleSide}), RS, 0.3, 0.43, 0.115));
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(RS, RS, 60, 160, 1, true).rotateX(Math.PI / 2), wallMat);
  const floorW = 2 * Math.sqrt(RS * RS - FLOOR * FLOOR);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(floorW, 0.08, 60).translate(0, FLOOR - 0.04, 0), gm(new THREE.MeshStandardMaterial({color: '#3b4556', roughness: 0.95}), 2));
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.002, R + 0.002, 60, 160, 1, true, Math.PI * 0.5 - 0.06, 0.04).rotateX(Math.PI / 2),
    gm(new THREE.MeshStandardMaterial({color: '#1e5bb8', roughness: 0.4, metalness: 0.2, side: THREE.DoubleSide})),
  );
  stripe.rotation.z = -Math.PI / 2 + 0.02;
  scene.add(skin, wall, floor);

  // overhead bins: a profile extruded along the cabin, both sides
  const binShape = new THREE.Shape([
    new THREE.Vector2(1.02, 0.98), new THREE.Vector2(1.6, 0.98), new THREE.Vector2(1.72, 1.08),
    new THREE.Vector2(1.6, 1.5), new THREE.Vector2(1.0, 1.52), new THREE.Vector2(0.94, 1.22),
  ]);
  const binGeo = new THREE.ExtrudeGeometry(binShape, {depth: 40, bevelEnabled: false}).translate(0, 0, -20);
  const binMat = gm(new THREE.MeshStandardMaterial({color: '#dcdcd8', roughness: 0.6}), 2);
  const binR = new THREE.Mesh(binGeo, binMat);
  const binL = new THREE.Mesh(binGeo, binMat);
  binL.scale.x = -1;
  const lightStrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 40), gm(new THREE.MeshStandardMaterial({color: '#fff3dd', emissive: '#fff0d6', emissiveIntensity: 1.4}), 2));
  lightStrip.position.set(0, 1.62, 0);
  scene.add(binR, binL, lightStrip);

  // seats: one merged geometry per material, instanced
  const box = (w, h, d, x, y, z, rx = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rx) g.rotateX(rx);
    return g.translate(x, y, z);
  };
  const y0 = FLOOR;
  const fabric = mergeGeometries([
    box(0.44, 0.11, 0.48, 0, y0 + 0.42, 0),
    box(0.44, 0.66, 0.1, 0, y0 + 0.78, 0.26, -0.13),
  ]);
  const trim = mergeGeometries([
    box(0.4, 0.16, 0.11, 0, y0 + 1.04, 0.31, -0.13),
    box(0.05, 0.05, 0.42, 0.245, y0 + 0.62, 0.02),
    box(0.05, 0.05, 0.42, -0.245, y0 + 0.62, 0.02),
    
  ]);
  const seatX = [0.62, 1.08, 1.54, -0.62, -1.08, -1.54];
  const rows = [];
  for (let k = -12; k <= 12; k++) rows.push(-0.45 + k * 0.81);
  const fabMesh = new THREE.InstancedMesh(fabric, gm(new THREE.MeshStandardMaterial({color: '#2c3d5e', roughness: 0.9}), 2), rows.length * 6);
  const trimMesh = new THREE.InstancedMesh(trim, gm(new THREE.MeshStandardMaterial({color: '#aeb5bf', roughness: 0.7}), 2), rows.length * 6);
  {
    const m = new THREE.Matrix4();
    let i = 0;
    for (const z of rows) for (const x of seatX) {
      m.makeTranslation(x, 0, z);
      fabMesh.setMatrixAt(i, m);
      trimMesh.setMatrixAt(i, m);
      i++;
    }
  }
  scene.add(fabMesh, trimMesh);

  // section face: structure ring + floor beam, drawn at the cut
  const sectMat = new THREE.MeshStandardMaterial({color: '#7d8590', roughness: 0.6, metalness: 0.3, transparent: true, side: THREE.DoubleSide});
  const sect = new THREE.Group();
  sect.add(new THREE.Mesh(new THREE.RingGeometry(RS, R, 160), sectMat));
  sect.add(new THREE.Mesh(new THREE.PlaneGeometry(floorW, 0.14).translate(0, FLOOR - 0.07, 0), sectMat));
  scene.add(sect);

  // ---------- windows ----------
  const paneGeo = (p, hole) => {
    const s = roundShape(p.w, p.h, p.r);
    if (hole) s.holes.push(new THREE.Path().absarc(0, HOLE_Y, HOLE_R, 0, Math.PI * 2, true));
    return new THREE.ExtrudeGeometry(s, {depth: p.t, bevelEnabled: false, curveSegments: 48}).translate(0, 0, p.z - p.t / 2);
  };
  const glass = (opacity = 0.12) =>
    new THREE.MeshStandardMaterial({color: '#d8eef5', transparent: true, opacity, roughness: 0.03, metalness: 0, envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide});
  const bezelGeo = loft(roundLoop(0.31, 0.44, 0.12), -0.1, roundLoop(0.255, 0.365, 0.095), -0.032);
  const sealGeo = ringGeo(0.3, 0.41, 0.115, 0.25, 0.36, 0.09, 0.029).translate(0, 0, -0.03);
  const frameGeo = ringGeo(0.285, 0.39, 0.115, 0.235, 0.335, 0.09, 0.004).translate(0, 0, -0.0025);
  const bezelMat = gm(new THREE.MeshStandardMaterial({color: '#ebe8e1', roughness: 0.55, side: THREE.DoubleSide}));
  const sealMat = gm(new THREE.MeshStandardMaterial({color: '#2b2f35', roughness: 0.8}));
  const frameMat = gm(new THREE.MeshStandardMaterial({color: '#b9c0c8', roughness: 0.4, metalness: 0.6}));
  const otherGlass = gm(glass(0.1), 0);
  const others = new THREE.Group();
  const pgOuter = paneGeo(PANE.outer), pgMid = paneGeo(PANE.middle, true), pgInner = paneGeo(PANE.inner);
  for (const side of [1, -1]) for (let k = -24; k <= 24; k++) {
    if (side === 1 && k === 0) continue;
    const g = new THREE.Group();
    for (const [geo, mat] of [[pgOuter, otherGlass], [pgMid, otherGlass], [pgInner, otherGlass], [bezelGeo, bezelMat], [sealGeo, sealMat], [frameGeo, frameMat]]) g.add(new THREE.Mesh(geo, mat));
    g.matrixAutoUpdate = false;
    g.matrix.copy(frameFor(side, k * PITCH).m);
    others.add(g);
  }
  scene.add(others);

  // hero window: panes animate, so they are separate
  const hero = new THREE.Group();
  hero.matrixAutoUpdate = false;
  hero.matrix.copy(HERO.m);
  scene.add(hero);
  const heroFixed = new THREE.Group();
  for (const [geo, mat] of [[bezelGeo, bezelMat], [sealGeo, sealMat], [frameGeo, frameMat]]) heroFixed.add(new THREE.Mesh(geo, mat));
  hero.add(heroFixed);
  const panes = {};
  for (const [name, geo] of [['outer', pgOuter], ['middle', pgMid], ['inner', pgInner]]) {
    const g = new THREE.Group();
    const mat = glass(0.12);
    const sideMat = new THREE.MeshStandardMaterial({color: '#e8f6ff', transparent: true, opacity: 0.5, roughness: 0.2, depthWrite: false, side: THREE.DoubleSide});
    const edgeMat = new THREE.LineBasicMaterial({color: '#e8f6ff', transparent: true, opacity: 0.35, depthWrite: false});
    g.add(new THREE.Mesh(geo, [mat, sideMat]), new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat));
    hero.add(g);
    panes[name] = {g, mat, sideMat, edgeMat, z: PANE[name].z};
  }
  // hole rim (acrylic edge) + highlight ring, on the middle pane
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(HOLE_R, HOLE_R, PANE.middle.t, 48, 1, true).rotateX(Math.PI / 2).translate(0, HOLE_Y, PANE.middle.z),
    new THREE.MeshStandardMaterial({color: '#f4fbff', transparent: true, opacity: 0.55, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false}),
  );
  const ringMat = new THREE.MeshStandardMaterial({color: COL.hole, emissive: COL.hole, emissiveIntensity: 1.6, transparent: true, depthWrite: false});
  const ring = new THREE.Mesh(new THREE.TorusGeometry(HOLE_R * 1.7, HOLE_R * 0.1, 12, 64), ringMat);
  ring.position.set(0, HOLE_Y, PANE.middle.z - PANE.middle.t / 2 - 0.0005);
  panes.middle.g.add(rim, ring);

  // fog in the gap between middle and outer pane
  const fogU = {uFog: {value: 0}, uT: {value: 0}};
  const fog = new THREE.Mesh(
    new THREE.ShapeGeometry(roundShape(0.25, 0.36, 0.09), 24),
    new THREE.ShaderMaterial({
      uniforms: fogU,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `${LOGV}
varying vec2 vUv2;
void main(){ vUv2 = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
#include <logdepthbuf_vertex>
}`,
      fragmentShader: `${LOGF}
uniform float uFog, uT; varying vec2 vUv2;
${NOISE}
void main(){
#include <logdepthbuf_fragment>
  float n = fbm(vUv2 * 9.0 + vec2(0.0, uT * 0.05));
  float d = fbm(vUv2 * 90.0 + 4.0);
  float drops = smoothstep(0.66, 0.74, d) * 0.25;
  float a = uFog * (0.42 + 0.38 * n) + uFog * drops * 0.35;
  gl_FragColor = vec4(vec3(0.93, 0.96, 0.98), clamp(a, 0.0, 0.92));
}`,
    }),
  );
  hero.add(fog);

  // ---------- arrows ----------
  const UP = new THREE.Vector3(0, 1, 0);
  const shaftGeo = new THREE.CylinderGeometry(1, 1, 1, 14).translate(0, 0.5, 0);
  const headGeo = new THREE.ConeGeometry(1, 1, 22).translate(0, 0.5, 0);
  const arrowMat = (c) => new THREE.MeshStandardMaterial({color: c, emissive: c, emissiveIntensity: 0.45, roughness: 0.4, transparent: true, depthWrite: false});
  const makeArrow = (mat, parent) => {
    const g = new THREE.Group();
    const s = new THREE.Mesh(shaftGeo, mat), h = new THREE.Mesh(headGeo, mat);
    g.add(s, h);
    g.userData = {s, h};
    parent.add(g);
    return g;
  };
  const setArrow = (a, from, dir, len, w) => {
    a.visible = len > 1e-4;
    if (!a.visible) return;
    a.position.copy(from);
    a.quaternion.setFromUnitVectors(UP, dir);
    const hl = Math.min(len * 0.5, w * 4.5);
    a.userData.s.scale.set(w, len - hl, w);
    a.userData.h.position.y = len - hl;
    a.userData.h.scale.set(w * 2.4, hl, w * 2.4);
  };
  const mIn = arrowMat(COL.cabin), mOut = arrowMat(COL.out);
  const secIn = Array.from({length: 12}, () => makeArrow(mIn, scene));
  const secOut = Array.from({length: 12}, () => makeArrow(mOut, scene));
  const mIn2 = arrowMat(COL.cabin), mOut2 = arrowMat(COL.out), mBal = arrowMat(COL.cabin);
  const paneIn = Array.from({length: 9}, () => makeArrow(mIn2, hero));
  const paneOut = Array.from({length: 9}, () => makeArrow(mOut2, hero));
  const balA = Array.from({length: 4}, () => makeArrow(mBal, hero));
  const balB = Array.from({length: 4}, () => makeArrow(mBal, hero));

  // ---------- particles ----------
  const dot = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const r0 = rng(7);
  // cross-section air: inside (whole pressurised tube) and outside
  const NIN = 1100, NOUT = 2600;
  const secPos = new Float32Array((NIN + NOUT) * 3), secSeed = new Float32Array((NIN + NOUT) * 2);
  for (let i = 0; i < NIN + NOUT; i++) {
    const inside = i < NIN;
    let x, y;
    do {
      const a = r0() * Math.PI * 2;
      const rr = inside ? Math.sqrt(r0()) * (RS - 0.06) : Math.sqrt(r0() * ((R + 2.6) ** 2 - (R + 0.08) ** 2) + (R + 0.08) ** 2);
      x = rr * Math.cos(a);
      y = rr * Math.sin(a);
    } while (inside && Math.abs(y - (FLOOR - 0.04)) < 0.07);
    secPos.set([x, y, 0], i * 3);
    secSeed.set([r0(), inside ? 0 : 1], i * 2);
  }
  const secU = {uT: {value: 0}, uDin: {value: 1}, uDout: {value: 1}, uOp: {value: 0}, uZ: {value: SECT_Z}, uSize: {value: 8}, uMap: {value: dot}};
  const secGeo = new THREE.BufferGeometry();
  secGeo.setAttribute('position', new THREE.BufferAttribute(secPos, 3));
  secGeo.setAttribute('aSeed', new THREE.BufferAttribute(secSeed, 2));
  const secPts = new THREE.Points(
    secGeo,
    new THREE.ShaderMaterial({
      uniforms: secU,
      transparent: true,
      depthWrite: false,
      vertexShader: `${LOGV}
attribute vec2 aSeed; uniform float uT, uDin, uDout, uZ, uSize; varying float vK; varying float vA;
void main(){
  float h = aSeed.x; vK = aSeed.y;
  vec3 p = position;
  p.xy += 0.035 * vec2(sin(uT * 1.9 + h * 61.0), cos(uT * 1.6 + h * 97.0));
  p.z = uZ + 0.02;
  float on = vK < 0.5 ? step(h, uDin) : step(h, uDout);
  vA = on;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * on;
#include <logdepthbuf_vertex>
}`,
      fragmentShader: `${LOGF}
uniform float uOp; uniform sampler2D uMap; varying float vK; varying float vA;
void main(){
#include <logdepthbuf_fragment>
  float a = texture2D(uMap, gl_PointCoord).a;
  vec3 c = vK < 0.5 ? vec3(1.0, 0.72, 0.55) : vec3(0.62, 0.84, 1.0);
  gl_FragColor = vec4(c, a * uOp * vA);
}`,
    }),
  );
  secPts.frustumCulled = false;
  scene.add(secPts);

  // flow through the hole (window-local coordinates)
  const NF = 240;
  const flowSeed = Array.from({length: NF}, () => [r0(), r0(), r0(), r0(), r0()]);
  const flowPos = new Float32Array(NF * 3);
  const flowGeo = new THREE.BufferGeometry();
  flowGeo.setAttribute('position', new THREE.BufferAttribute(flowPos, 3));
  const flowMat = new THREE.PointsMaterial({color: '#ffffff', size: 0.0065, map: dot, transparent: true, depthWrite: false, opacity: 0});
  const flow = new THREE.Points(flowGeo, flowMat);
  flow.frustumCulled = false;
  hero.add(flow);
  const NM = 160;
  const mistPos = new Float32Array(NM * 3);
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
  const mistMat = new THREE.PointsMaterial({color: '#e9f7ff', size: 0.005, map: dot, transparent: true, depthWrite: false, opacity: 0});
  const mist = new THREE.Points(mistGeo, mistMat);
  mist.frustumCulled = false;
  hero.add(mist);

  // ---------- overlay (DOM) ----------
  const app = document.getElementById('app');
  const ov = document.createElement('div');
  ov.className = 'ov';
  ov.innerHTML = `<svg class="lines" xmlns="http://www.w3.org/2000/svg"></svg>
<div class="alt"><div>الارتفاع</div><div class="v"></div></div>
<div class="gauges"><div class="g in"><div>داخل المقصورة</div><div class="v"></div><div class="bar"><i></i></div></div>
<div class="g out"><div>خارج الطائرة</div><div class="v"></div><div class="bar"><i></i></div></div></div>
<div class="chip"></div><div class="cap"></div>`;
  app.appendChild(ov);
  const $ = (s) => ov.querySelector(s);
  const chipEl = $('.chip'), capEl = $('.cap'), gauges = $('.gauges'), altEl = $('.alt'), svg = $('svg');
  const gIn = $('.g.in .v'), gOut = $('.g.out .v'), bIn = $('.g.in .bar i'), bOut = $('.g.out .bar i'), altV = $('.alt .v');

  const CHIPS = [
    [0, 'السر وراء <b>الثقب الصغير</b> في نافذة الطائرة!'],
    [T.s2 - 0.1, '<b>ثقب التنفّس</b> في نافذة الطائرة'],
    [T.s3 - 0.1, 'كلما ارتفعت الطائرة <b>قلّ الضغط</b> خارجها'],
    [T.s4 - 0.1, 'المقصورة <b>مضغوطة</b> لراحة الركاب'],
    [T.s5 - 0.1, 'النافذة = <b>3 ألواح</b>'],
    [T.s6 - 0.1, 'اللوح الخارجي <b>يتحمل فرق الضغط</b>'],
    [T.s6b - 0.1, 'الثقب <b>يوازن الضغط</b> بين الألواح'],
    [T.s7 - 0.1, 'ويقلل <b>الرطوبة والضباب</b>'],
    [T.s8 - 0.1, 'تصميم <b>هندسي مدروس</b>'],
  ];

  // captions: chunks of up to 3 words, broken after punctuation
  const chunks = [];
  for (const s of TL.sentences) {
    const ws = TL.words.filter((w) => w.sent === s.i);
    let cur = [];
    ws.forEach((w, i) => {
      cur.push(w);
      const brk = /[،,.؟?!]$/.test(w.w) || cur.length === 3 || i === ws.length - 1;
      if (brk) {
        chunks.push(cur);
        cur = [];
      }
    });
  }
  chunks.forEach((c, i) => {
    c.t0 = c[0].s - 0.08;
    const next = chunks[i + 1];
    c.t1 = next && next[0].sent === c[0].sent ? next[0].s - 0.08 : c[c.length - 1].e + 0.35;
  });
  const clean = (w) => w.replace(/[،,.؟?!]/g, '');

  const LABELS = {
    hole: {html: 'ثقب صغير<small>في اللوح الأوسط</small>', c: COL.hole},
    outer: {html: 'اللوح الخارجي<small>يتحمل فرق الضغط</small>', c: COL.outer},
    middle: {html: 'اللوح الأوسط<small>احتياطي + ثقب التنفّس</small>', c: COL.middle},
    inner: {html: 'اللوح الداخلي<small>يحمي من الخدوش</small>', c: COL.inner},
    gap: {html: 'نفس ضغط المقصورة<small>بين اللوحين</small>', c: COL.cabin},
    fog: {html: 'رطوبة محبوسة<small>تتسرب عبر الثقب</small>', c: '#cfefff'},
  };
  for (const [k, l] of Object.entries(LABELS)) {
    l.el = document.createElement('div');
    l.el.className = 'lbl';
    l.el.style.setProperty('--c', l.c);
    l.el.innerHTML = l.html;
    ov.appendChild(l.el);
    l.line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.line.setAttribute('stroke', l.c);
    l.line.setAttribute('stroke-width', '4');
    l.dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    l.dot.setAttribute('r', '9');
    l.dot.setAttribute('fill', l.c);
    svg.append(l.line, l.dot);
    l.key = k;
  }

  // ---------- camera keys ----------
  const HIN = [0, HOLE_Y, PANE.middle.z - PANE.middle.t / 2];
  const toward = (p, d, up = 0, side = 0) => W(p[0] + side * d, p[1] + up * d, p[2] - d);
  const K = [
    {t: 0, p: [1.12, 0.5, 0.62], q: W(0, 0.0, 0)},
    {t: 1.9, p: W(-0.12, 0.08, -0.7), q: W(0, 0.0, 0)},
    {t: 3.4, p: toward(HIN, 0.3, 0.35, 0.1), q: W(0, -0.08, -0.02)},
    {t: 4.3, p: toward(HIN, 0.1, 0.25, 0.05), q: W(...HIN)},
    {t: 5.0, p: toward(HIN, 0.035, 0.2, 0.03), q: W(...HIN)},
    {t: 6.3, p: toward(HIN, 0.017, 0.15, 0.02), q: W(...HIN)},
    {t: 7.0, p: toward(HIN, 0.009, 0.05, 0), q: W(HIN[0], HIN[1], 0.4)},
    {t: 7.5, p: W(0, HOLE_Y + 0.004, -0.012), q: W(0, HOLE_Y - 0.1, 1.5)},
    {t: 8.1, p: W(0, HOLE_Y + 0.05, 0.25), q: W(0, -0.6, 3)},
    {t: 9.2, p: [3.3, 1.15, 2.4], q: HERO.C.toArray()},
    {t: 10.9, p: [1.0, 0.75, 10.2], q: [0.25, 0.15, 0]},
    {t: 13.5, p: [0.75, 0.6, 10.9], q: [0.15, 0.1, 0]},
    {t: 16.6, p: [0.35, 0.5, 10.4], q: [0.05, 0.05, 0]},
    {t: 19.0, p: W(-1.25, 0.32, 0.5), q: W(0.0, -0.02, 0.0)},
    {t: 21.8, p: W(-1.02, 0.26, 0.4), q: W(0.0, -0.02, 0.01)},
    {t: 24.4, p: W(-0.95, 0.2, 0.3), q: W(0.0, -0.03, 0.04)},
    {t: 26.2, p: W(-0.2, HOLE_Y + 0.07, -0.48), q: W(0, HOLE_Y + 0.0, 0.03)},
    {t: 30.0, p: W(-0.17, HOLE_Y + 0.06, -0.44), q: W(0, HOLE_Y + 0.0, 0.03)},
    {t: 31.9, p: W(0.06, 0.02, -0.55), q: W(0, -0.04, 0)},
    {t: 34.5, p: W(0.04, -0.02, -0.44), q: W(0, -0.05, 0)},
    {t: 37.4, p: W(0.02, -0.03, -0.3), q: W(0, -0.04, 0.2)},
    {t: 38.7, p: W(0, -0.02, 0.08), q: W(0, -0.05, 2)},
    {t: 40.6, p: [2.85, 0.6, -0.9], q: HERO.C.toArray()},
    {t: 44.0, p: [4.4, 1.2, -3.2], q: [1.7, 0.25, 0.6]},
    {t: T.end, p: [5.0, 1.45, -3.9], q: [1.6, 0.2, 0.9]},
  ];
  const v3 = new THREE.Vector3();
  const project = (local) => {
    v3.set(...local).applyMatrix4(HERO.m).project(camera);
    return {x: (v3.x * 0.5 + 0.5) * innerWidth, y: (-v3.y * 0.5 + 0.5) * innerHeight, ok: v3.z < 1};
  };
  const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize);

  const resize = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(capture ? devicePixelRatio : Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    secU.uSize.value = 7 * renderer.getPixelRatio() * (h / 1920);
  };
  resize();

  let lastChip = -1;
  return {
    resize,
    render(t) {
      // --- climb + pressures
      const climb = ramp(t, T.s3 + 0.2, T.s4 + 0.4, smooth);
      const alt = 11000 * climb;
      const pOut = isa(alt);
      const pIn = isa(2438 * climb);
      const diff = pIn - pOut;
      skyU.uAlt.value = climb;
      cloudU.uAlt.value = climb;
      cloudU.uT.value = t;
      clouds.position.y = -lerp(380, 3200, climb);

      // --- camera
      camera.position.fromArray(hermite(K, t, 'p'));
      camera.lookAt(...hermite(K, t, 'q'));
      window.__cam = [camera.position.toArray(), hermite(K, t, "q")];
      sky.position.copy(camera.position);
      cloudU.uCam.value.copy(camera.position);

      // --- section cut + ghost
      const cutIn = ramp(t, 8.9, 10.7, easeInOutCubic);
      const cutOut = ramp(t, 30.3, 31.4, easeInOutCubic);
      SECT.constant = lerp(lerp(40, SECT_Z, cutIn), 40, cutOut);
      const ghost = 1 - 0.9 * ramp(t, 17.3, 18.9) * (1 - ramp(t, 31.0, 32.4));
      for (const [m, k] of ghostMats) {
        const o = k === 0 ? 1 : Math.pow(ghost, k);
        m.opacity = o;
        const tr = o < 0.999 || m === otherGlass;
        if (m.transparent !== tr) m.needsUpdate = true;
        m.transparent = tr;
        m.depthWrite = o >= 0.999 && m !== otherGlass;
        m.visible = o > 0.01;
      }
      otherGlass.opacity = 0.1 * ghost;
      sect.position.z = SECT.constant;
      sect.visible = SECT.constant < 30;
      sectMat.opacity = ghost;

      // --- exploded view
      const ex = ramp(t, 18.6, 20.4) * (1 - ramp(t, 30.2, 31.6));
      const off = {outer: 0.2 * ex, middle: 0, inner: -0.2 * ex};
      for (const [k, p] of Object.entries(panes)) p.g.position.z = off[k];
      heroFixed.visible = ghost > 0.02;
      const hiOuter = win(t, T.s6 - 0.2, T.s6b + 0.2, 0.4, 0.5);
      const hiMid = win(t, T.s6b - 0.1, T.s7 - 0.3, 0.4, 0.5);
      const layerOn = ex;
      for (const [k, p] of Object.entries(panes)) {
        const hi = k === 'outer' ? hiOuter : k === 'middle' ? hiMid : 0;
        const c = new THREE.Color('#d8eef5').lerp(new THREE.Color(COL[k]), 0.45 * layerOn + 0.4 * hi);
        p.mat.color.copy(c);
        p.mat.opacity = 0.12 + 0.16 * layerOn + (k === 'middle' ? 0.03 : 0.14) * hi;
        p.sideMat.color.copy(new THREE.Color('#e8f6ff').lerp(new THREE.Color(COL[k]), layerOn));
        p.sideMat.opacity = 0.5 + 0.45 * layerOn;
        p.edgeMat.color.copy(new THREE.Color('#e8f6ff').lerp(new THREE.Color(COL[k]), layerOn));
        p.edgeMat.opacity = 0.35 + 0.45 * layerOn + 0.2 * hi;
      }
      const pulse = 0.5 + 0.5 * Math.sin(t * 7);
      const ringOn = Math.max(win(t, T.s2 + 0.2, T.s3 + 0.6), win(t, T.s6b + 1.0, T.s7 + 5.5), win(t, wordAt('ثُقب') > T.s8 ? wordAt('ثُقب') : 39.8, T.end));
      ringMat.opacity = ringOn * (0.55 + 0.45 * pulse);
      ring.scale.setScalar((1 + 0.12 * pulse * ringOn) * (1 + 2.5 * win(t, T.s6b, T.s7 + 0.8)));
      ring.visible = ringOn > 0.01;

      // --- section arrows + particles
      const secOn = win(t, 9.6, T.s5 + 0.6, 0.8, 0.8);
      secU.uT.value = t;
      secU.uOp.value = secOn;
      secU.uDin.value = pIn / 1.01325;
      secU.uDout.value = pOut / 1.01325;
      secU.uZ.value = SECT.constant;
      const z = SECT.constant + 0.03;
      secIn.forEach((a, i) => {
        const ang = (i / 12) * Math.PI * 2 + Math.PI / 12;
        const d = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0);
        const len = (0.12 + 1.0 * diff) * secOn;
        setArrow(a, new THREE.Vector3().copy(d).multiplyScalar(RS - 0.05 - len).setZ(z), d, len, 0.022);
      });
      secOut.forEach((a, i) => {
        const ang = (i / 12) * Math.PI * 2 + Math.PI / 12;
        const d = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0);
        const len = 0.62 * (pOut / 1.01325) * secOn;
        setArrow(a, new THREE.Vector3().copy(d).multiplyScalar(R + 0.1).setZ(z), d.clone().negate(), len, 0.022);
        a.position.copy(d).multiplyScalar(R + 0.1 + len).setZ(z);
      });
      mIn.opacity = mOut.opacity = secOn;

      // --- pane arrows (window-local)
      const outerZ = PANE.outer.z + off.outer;
      const midZ = PANE.middle.z;
      const pa = hiOuter * ex;
      const fwd = new THREE.Vector3(0, 0, 1), back = new THREE.Vector3(0, 0, -1);
      paneIn.forEach((a, i) => {
        const gx = ((i % 3) - 1) * 0.075, gy = (Math.floor(i / 3) - 1) * 0.11;
        const len = 0.1 * pa;
        setArrow(a, new THREE.Vector3(gx, gy, outerZ - PANE.outer.t / 2 - 0.004 - len), fwd, len, 0.0035);
      });
      paneOut.forEach((a, i) => {
        const gx = ((i % 3) - 1) * 0.075, gy = (Math.floor(i / 3) - 1) * 0.11;
        const len = 0.035 * pa;
        setArrow(a, new THREE.Vector3(gx, gy, outerZ + PANE.outer.t / 2 + 0.004 + len), back, len, 0.0035);
      });
      mIn2.opacity = mOut2.opacity = pa;
      const bal = win(t, wordAt('موازنة') - 0.3, T.s7 - 0.2, 0.5, 0.5) * ex;
      [...balA, ...balB].forEach((a, i) => {
        const j = i % 4;
        const gx = j % 2 ? 0.06 : -0.06, gy = j < 2 ? 0.07 : -0.03;
        const len = 0.06 * bal;
        if (i < 4) setArrow(a, new THREE.Vector3(gx, gy, midZ - PANE.middle.t / 2 - 0.004 - len), fwd, len, 0.003);
        else setArrow(a, new THREE.Vector3(gx, gy, midZ + PANE.middle.t / 2 + 0.004 + len), back, len, 0.003);
      });
      mBal.opacity = bal;

      // --- flow through the hole into the gap
      const fl = win(t, T.s6b + 0.9, T.s7 - 0.2, 0.6, 0.6);
      flowMat.opacity = fl * 0.95;
      const gapA = midZ + PANE.middle.t / 2 + 0.003, gapB = outerZ - PANE.outer.t / 2 - 0.003;
      for (let i = 0; i < NF; i++) {
        const [a, b, c, d, e] = flowSeed[i];
        const u = (t * 0.35 + a) % 1;
        let x, y, zz;
        if (u < 0.55) {
          const k = easeInOutCubic(u / 0.55);
          x = lerp((b - 0.5) * 0.22, 0, k);
          y = lerp(HOLE_Y + (c - 0.2) * 0.3, HOLE_Y, k);
          zz = lerp(midZ - 0.05 - d * 0.15, midZ - 0.004, k);
        } else if (u < 0.62) {
          const k = (u - 0.55) / 0.07;
          x = 0; y = HOLE_Y; zz = lerp(midZ - 0.004, gapA, k);
        } else {
          const k = easeOutCubic((u - 0.62) / 0.38);
          x = lerp(0, (b - 0.5) * 0.22, k);
          y = lerp(HOLE_Y, HOLE_Y + c * 0.3, k);
          zz = lerp(gapA, lerp(gapA, gapB, e), k);
        }
        flowPos.set([x + Math.sin(t * 3 + a * 40) * 0.002, y, zz], i * 3);
      }
      flowGeo.attributes.position.needsUpdate = true;

      // --- moisture: fog in the gap, droplets vent out through the hole
      const fogIn = ramp(t, T.s7 + 0.4, T.s7 + 1.5);
      const fogClear = ramp(t, wordAt('تقليل') + 0.5, wordAt('والضباب') + 1.3);
      fogU.uFog.value = fogIn * (1 - fogClear);
      fogU.uT.value = t;
      fog.position.z = (midZ + PANE.middle.t / 2 + (PANE.outer.z - PANE.outer.t / 2)) / 2;
      fog.visible = fogU.uFog.value > 0.005;
      const mo = win(t, wordAt('تقليل') - 0.2, wordAt('النافذة') + 1.2, 0.5, 0.8);
      mistMat.opacity = mo;
      for (let i = 0; i < NM; i++) {
        const [a, b, c] = flowSeed[i];
        const u = (t * 0.45 + a) % 1;
        let x, y, zz;
        if (u < 0.7) {
          const k = easeInOutCubic(u / 0.7);
          x = lerp((b - 0.5) * 0.22, 0, k);
          y = lerp(HOLE_Y + c * 0.3, HOLE_Y, k);
          zz = fog.position.z;
        } else {
          const k = easeOutCubic((u - 0.7) / 0.3);
          x = (b - 0.5) * 0.05 * k;
          y = HOLE_Y + (c - 0.5) * 0.05 * k;
          zz = lerp(fog.position.z, midZ - 0.04, k);
        }
        mistPos.set([x, y, zz], i * 3);
      }
      mistGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);

      // ---------- overlay ----------
      let ci = 0;
      for (let i = 0; i < CHIPS.length; i++) if (t >= CHIPS[i][0]) ci = i;
      if (ci !== lastChip) {
        chipEl.innerHTML = CHIPS[ci][1];
        lastChip = ci;
      }
      const ct = t - CHIPS[ci][0];
      const cpop = ci === 0 ? 1 : easeOutCubic(clamp01(ct / 0.3));
      chipEl.style.opacity = String(ci === 0 ? 1 : clamp01(ct / 0.2));
      chipEl.style.transform = `translate(-50%, 0) scale(${0.9 + 0.1 * cpop})`;

      const ch = chunks.find((c) => t >= c.t0 && t < c.t1);
      if (ch) {
        const k = ch.findLastIndex((w) => t >= w.s - 0.04);
        capEl.innerHTML = ch.map((w, i) => `<span class="${i === k ? 'on' : ''}">${clean(w.w)}</span>`).join(' ');
        const a = clamp01((t - ch.t0) / 0.12);
        capEl.style.opacity = String(a);
        capEl.style.transform = `translateY(${(1 - easeOutCubic(a)) * 20}px) scale(${0.92 + 0.08 * easeOutCubic(a)})`;
      } else capEl.style.opacity = '0';

      const gOn = win(t, T.s3 + 0.1, T.s5 + 0.3, 0.4, 0.5);
      gauges.style.opacity = altEl.style.opacity = String(gOn);
      gIn.textContent = `${pIn.toFixed(2)} بار`;
      gOut.textContent = `${pOut.toFixed(2)} بار`;
      bIn.style.width = `${(pIn / 1.01325) * 100}%`;
      bOut.style.width = `${(pOut / 1.01325) * 100}%`;
      altV.textContent = `${Math.round(alt / 10) * 10 >= 1000 ? Math.round(alt / 10) * 10 : Math.round(alt)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' م';

      const RM = rem();
      const L = {
        hole: {on: win(t, T.s2 + 0.6, T.s3 - 0.1), at: [0, HOLE_Y - HOLE_R * 1.9, HIN[2]], d: [-22, 26]},
        outer: {on: ramp(t, 19.6, 20.2) * (1 - ramp(t, T.s6b - 0.2, T.s6b + 0.2)), at: [0.0, -PANE.outer.h / 2, outerZ], d: [-14, 18]},
        middle: {on: ramp(t, 19.9, 20.5) * (1 - ramp(t, T.s6b + 0.6, T.s6b + 1.0)), at: [0.0, PANE.middle.h / 2, midZ], d: [14, -12]},
        inner: {on: ramp(t, 20.2, 20.8) * (1 - ramp(t, T.s6b - 0.2, T.s6b + 0.2)), at: [0.0, -PANE.inner.h / 2, PANE.inner.z + off.inner], d: [18, 8]},
        gap: {on: win(t, wordAt('موازنة'), T.s7 - 0.3, 0.4, 0.4) * ex, at: [0, HOLE_Y + 0.12, (gapA + gapB) / 2], d: [-20, -30]},
        fog: {on: win(t, T.s7 + 1.6, wordAt('النافذة') + 0.6, 0.4, 0.4), at: [0.07, 0.05, fog.position.z], d: [-14, -34]},
      };
      for (const [k, l] of Object.entries(LABELS)) {
        const s = L[k];
        const p = project(s.at);
        const on = p.ok ? s.on : 0;
        l.el.style.opacity = String(on);
        l.line.style.opacity = l.dot.style.opacity = String(on);
        if (on <= 0.001) continue;
        const bx = p.x + s.d[0] * RM, by = Math.min(Math.max(p.y + s.d[1] * RM, 40 * RM), 112 * RM);
        const bw = l.el.offsetWidth, bh = l.el.offsetHeight;
        const cx = Math.min(Math.max(bx, bw / 2 + 3 * RM), innerWidth - bw / 2 - 3 * RM);
        l.el.style.transform = `translate(${cx - bw / 2}px, ${by - bh / 2}px) scale(${0.94 + 0.06 * on})`;
        l.line.setAttribute('x1', p.x);
        l.line.setAttribute('y1', p.y);
        l.line.setAttribute('x2', cx);
        l.line.setAttribute('y2', by);
        l.dot.setAttribute('cx', p.x);
        l.dot.setAttribute('cy', p.y);
      }
      return {};
    },
  };
});
