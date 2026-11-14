import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {runSim} from '../kit/runtime.js';
import {createStage} from '../kit/stage3d.js';
import {clamp01, easeInOutCubic, easeOutBack, easeOutCubic, keyed, lerp, rng, smooth} from '../kit/util.js';
import {AMIRI, KUFI, TAJAWAL} from './fonts.gen.js';
import TL from './timeline.json';

// "هل تعلم؟" — a TV-style 3D segment for the International Day for Tolerance (16 November).
// Night-blue space with gold dust → a glowing book opens, a light wave rises and condenses
// into a 3D «هل تعلم؟» → a rotating globe and a November calendar whose 16th lights up →
// two golden hands shake inside waves and hearts → a symbolic, respectful Makkah (the Kaaba,
// the arcades and minarets at golden hour; no people are depicted) → gold dust gathers into
// the closing line. Every beat is keyed to the narration's word times (timeline.json,
// written by voice.py). Sound: sound.py on the same timeline.

const DEFAULTS = {
  duration: TL.duration,
  fps: 30,
  theme: 'dark',
  accent: '#e8b54a',
  watermark: '',
  hud: {enabled: false, title: 'هل تعلم؟', subtitle: ''},
  director: {enabled: false},
  seed: 1116,
};

const SC = Object.fromEntries(TL.scenes.map((s) => [s.name, s]));
/** Time the narrator starts word `w` (first match, diacritics included) in scene `scene`. */
const word = (scene, w) => {
  const hit = TL.words.find((x) => x.scene === scene && x.w.includes(w));
  if (!hit) throw new Error(`word ${w} not in ${scene}`);
  return hit.s;
};
const T = {
  textBurst: word('intro', 'هَلْ'),
  calIn: word('date', 'العَالَمِيَّ'),
  day16: word('date', 'السَّادِسَ'),
  clasp: word('hands', 'التَّسَامُحَ'),
  happy: word('hands', 'بِسَعَادَةٍ'),
  makkah: word('mecca', 'مَكَّةَ'),
  quote: word('mecca', 'اذْهَبُوا'),
  endLine: word('end', 'التَّسَامُحُ'),
};

const GOLD = new THREE.Color('#f2c76e');
const W = 1920, H = 1080;

// ------------------------------------------------------------------ text canvases
function textCanvas(lines, {font, size, weight = 700, w = 2048, lh = 1.35, color = '#fff', pad = 40, stroke = 0}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `${weight} ${size}px "${font}"`;
  const h = Math.ceil(lines.length * size * lh + pad * 2);
  c.width = w;
  c.height = h;
  g.font = `${weight} ${size}px "${font}"`;
  g.direction = 'rtl';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  lines.forEach((l, i) => {
    const y = pad + (i + 0.5) * size * lh;
    if (stroke) {
      g.lineWidth = stroke;
      g.strokeStyle = color;
      g.strokeText(l, w / 2, y);
    }
    g.fillText(l, w / 2, y);
  });
  return c;
}

/** Points on the filled pixels of a canvas, mapped to a plane `width` units wide, centred. */
function sampleCanvas(c, n, width, seed) {
  const g = c.getContext('2d');
  const {data} = g.getImageData(0, 0, c.width, c.height);
  const hits = [];
  for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) if (data[(y * c.width + x) * 4 + 3] > 140) hits.push(x, y);
  const r = rng(seed);
  const s = width / c.width;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const k = Math.floor(r() * (hits.length / 2)) * 2;
    out[i * 3] = (hits[k] - c.width / 2) * s;
    out[i * 3 + 1] = -(hits[k + 1] - c.height / 2) * s;
    out[i * 3 + 2] = (r() - 0.5) * 0.06;
  }
  return out;
}

// ------------------------------------------------------------------ shaders
const SPRITE_VS = /* glsl */ `
  attribute float aSize; attribute float aSeed;
  uniform float uTime; uniform float uScale; uniform float uDrift;
  varying float vTw; varying float vSeed;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.21 + aSeed * 31.0) * uDrift;
    p.y += sin(uTime * 0.17 + aSeed * 17.0) * uDrift + uTime * 0.04 * uDrift * (0.5 + fract(aSeed * 7.0));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vTw = 0.55 + 0.45 * sin(uTime * (1.2 + fract(aSeed * 13.0) * 2.5) + aSeed * 40.0);
    vSeed = aSeed;
    gl_PointSize = aSize * uScale / max(0.5, -mv.z);
  }`;
const SPRITE_FS = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity;
  varying float vTw; varying float vSeed;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    float a = smoothstep(0.5, 0.0, r);
    a = a * a;
    vec3 c = mix(uColor, vec3(1.0, 0.95, 0.85), smoothstep(0.18, 0.0, r) * 0.6);
    gl_FragColor = vec4(c * (0.6 + 0.6 * vTw), a * uOpacity * vTw);
  }`;

// particles that fly from aStart to aTarget (text formation / dispersal)
const FORM_VS = /* glsl */ `
  attribute vec3 aStart; attribute float aSize; attribute float aSeed; attribute float aDelay;
  uniform float uK; uniform float uScale; uniform float uTime; uniform float uSwirl;
  varying float vA;
  float ease(float x) { x = clamp(x, 0.0, 1.0); return x < 0.5 ? 4.0*x*x*x : 1.0 - pow(-2.0*x + 2.0, 3.0) / 2.0; }
  void main() {
    float k = ease((uK - aDelay) / max(0.001, 1.0 - aDelay));
    vec3 p = mix(aStart, position, k);
    float sw = (1.0 - k) * uSwirl;
    p.x += sin(uTime * 2.0 + aSeed * 50.0) * sw;
    p.z += cos(uTime * 2.0 + aSeed * 50.0) * sw;
    p += vec3(sin(uTime * 3.0 + aSeed * 90.0), cos(uTime * 2.6 + aSeed * 70.0), 0.0) * 0.012 * k;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vA = 0.55 + 0.45 * sin(uTime * 4.0 + aSeed * 30.0);
    gl_PointSize = aSize * uScale / max(0.5, -mv.z);
  }`;
const FORM_FS = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity; varying float vA;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, r); a *= a;
    gl_FragColor = vec4(mix(uColor, vec3(1.0, 0.96, 0.86), smoothstep(0.2, 0.0, r) * 0.7), a * uOpacity * vA);
  }`;

// extruded-look text: a stack of alpha planes, gold face + darker bevel layers + a moving shine
const STACK_VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const STACK_FS = /* glsl */ `
  uniform sampler2D uMap; uniform float uOpacity; uniform float uLayer; uniform float uShine; uniform float uGlow;
  varying vec2 vUv;
  void main() {
    float a = texture2D(uMap, vUv).a;
    if (a < 0.35) discard;
    vec3 face = mix(vec3(0.62, 0.38, 0.10), vec3(1.0, 0.86, 0.52), smoothstep(0.25, 0.8, vUv.y));
    face = mix(face, vec3(1.0, 0.97, 0.88), smoothstep(0.70, 0.95, vUv.y) * 0.5);
    vec3 side = mix(vec3(0.30, 0.17, 0.04), vec3(0.62, 0.40, 0.12), uLayer);
    vec3 c = pow(uLayer > 0.999 ? face : side, vec3(2.2));
    float band = smoothstep(0.08, 0.0, abs(vUv.x * 1.0 + vUv.y * 0.35 - uShine));
    c += vec3(1.0, 0.9, 0.7) * band * (uLayer > 0.999 ? 0.9 : 0.25);
    c *= uGlow;
    gl_FragColor = vec4(c, uOpacity);
  }`;

const BG_VS = /* glsl */ `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const BG_FS = /* glsl */ `
  uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uGlow; uniform float uGlowK;
  varying vec3 vP;
  void main() {
    float y = vP.y * 0.5 + 0.5;
    vec3 c = mix(uBottom, uTop, smoothstep(0.15, 0.85, y));
    float hz = exp(-pow((vP.y + 0.02) * 4.0, 2.0));
    c += uGlow * hz * uGlowK;
    gl_FragColor = vec4(c, 1.0);
  }`;

const GLOBE_FS = /* glsl */ `
  uniform sampler2D uMap; uniform vec3 uLight; uniform float uOpacity;
  varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main() {
    vec4 m = texture2D(uMap, vUv);
    float l = 0.35 + 0.65 * max(0.0, dot(vN, normalize(uLight)));
    vec3 ocean = mix(vec3(0.002, 0.008, 0.035), vec3(0.006, 0.03, 0.11), l);
    vec3 c = ocean + m.rgb * vec3(0.9, 0.55, 0.16) * (0.35 + 0.55 * l);
    float fr = pow(1.0 - max(0.0, dot(vN, vV)), 2.5);
    c += vec3(0.9, 0.5, 0.14) * fr * 0.55;
    gl_FragColor = vec4(c, uOpacity);
  }`;
const GLOBE_VS = /* glsl */ `
  varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main() {
    vUv = uv;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;

// ------------------------------------------------------------------ geometry helpers
const CONTINENTS = [
  [[-168, 66], [-140, 70], [-95, 72], [-80, 62], [-62, 58], [-55, 50], [-66, 44], [-75, 35], [-81, 25], [-97, 26], [-97, 18], [-87, 15], [-83, 9], [-79, 8], [-92, 15], [-105, 22], [-112, 30], [-118, 34], [-124, 40], [-124, 48], [-135, 58], [-150, 60], [-165, 62]],
  [[-50, 60], [-40, 63], [-22, 70], [-20, 80], [-40, 83], [-60, 80], [-72, 77], [-58, 70]],
  [[-79, 8], [-72, 12], [-62, 10], [-50, 0], [-35, -6], [-39, -15], [-48, -25], [-58, -35], [-65, -42], [-68, -54], [-74, -50], [-72, -40], [-71, -30], [-70, -18], [-76, -14], [-81, -5], [-80, 2]],
  [[-17, 15], [-16, 22], [-10, 30], [-5, 36], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12], [51, 12], [42, -2], [40, -12], [35, -25], [20, -35], [17, -29], [12, -17], [13, -5], [9, 4], [-5, 5], [-12, 8]],
  [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [2, 51], [8, 54], [10, 58], [5, 62], [15, 69], [28, 71], [40, 67], [45, 60], [40, 48], [30, 45], [28, 41], [20, 40], [18, 45], [13, 45], [15, 40], [10, 44], [3, 43]],
  [[28, 41], [36, 36], [35, 32], [39, 21], [43, 13], [52, 16], [57, 25], [52, 25], [48, 30], [56, 27], [60, 25], [67, 24], [73, 20], [78, 8], [80, 15], [88, 22], [92, 22], [98, 16], [100, 6], [104, 1], [106, 10], [110, 20], [118, 24], [122, 31], [120, 38], [126, 39], [129, 35], [130, 42], [140, 50], [142, 59], [160, 60], [170, 65], [180, 68], [180, 72], [140, 73], [110, 77], [80, 73], [68, 70], [55, 68], [45, 68], [40, 67], [45, 60], [40, 48], [30, 45]],
  [[114, -22], [122, -18], [131, -12], [137, -12], [142, -11], [146, -19], [153, -26], [150, -37], [141, -38], [131, -32], [115, -34]],
  [[-5, 50], [1, 51], [-2, 57], [-6, 58], [-5, 54]], [[44, -25], [50, -15], [49, -12], [44, -17]],
  [[95, 5], [105, -6], [115, -8], [120, -9], [110, -2], [100, 2]], [[109, 1], [117, 7], [119, 1], [116, -4], [110, -3]],
  [[130, 31], [135, 34], [141, 36], [142, 41], [140, 40], [135, 35]], [[167, -46], [174, -41], [178, -38], [172, -42]],
  [[-180, -72], [180, -72], [180, -90], [-180, -90]],
];

function globeTexture() {
  const w = 2048, h = 1024;
  const mask = document.createElement('canvas');
  mask.width = w; mask.height = h;
  const m = mask.getContext('2d');
  m.fillStyle = '#fff';
  const P = ([lo, la]) => [((lo + 180) / 360) * w, ((90 - la) / 180) * h];
  for (const poly of CONTINENTS) {
    m.beginPath();
    poly.forEach((p, i) => (i ? m.lineTo(...P(p)) : m.moveTo(...P(p))));
    m.closePath();
    m.fill();
  }
  const md = m.getImageData(0, 0, w, h).data;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  // latitude-aware dot grid: gold dots on land, faint grid lines on the ocean
  g.strokeStyle = 'rgba(120,170,255,0.10)';
  g.lineWidth = 2;
  for (let la = -60; la <= 60; la += 30) { g.beginPath(); g.moveTo(0, ((90 - la) / 180) * h); g.lineTo(w, ((90 - la) / 180) * h); g.stroke(); }
  for (let lo = -180; lo < 180; lo += 30) { g.beginPath(); g.moveTo(((lo + 180) / 360) * w, 0); g.lineTo(((lo + 180) / 360) * w, h); g.stroke(); }
  const step = 9;
  for (let y = step / 2; y < h; y += step) {
    const la = 90 - (y / h) * 180;
    const sx = step / Math.max(0.15, Math.cos((la * Math.PI) / 180));
    for (let x = 0; x < w; x += sx) {
      if (md[(Math.floor(y) * w + Math.floor(x)) * 4] > 128) {
        g.fillStyle = '#f5cf7a';
        g.beginPath();
        g.arc(x, y, 2.7, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function calendarCanvas() {
  const w = 1024, h = 1100;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const rr = (x, y, ww, hh, r) => { g.beginPath(); g.roundRect(x, y, ww, hh, r); };
  rr(12, 12, w - 24, h - 24, 56);
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, 'rgba(18,34,78,0.96)');
  bg.addColorStop(1, 'rgba(6,14,38,0.96)');
  g.fillStyle = bg;
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = '#e8b54a';
  g.stroke();
  // header band
  rr(12, 12, w - 24, 190, [56, 56, 0, 0]);
  const hb = g.createLinearGradient(0, 0, w, 0);
  hb.addColorStop(0, '#b0781f'); hb.addColorStop(0.5, '#f6d58b'); hb.addColorStop(1, '#b0781f');
  g.fillStyle = hb;
  g.fill();
  g.direction = 'rtl';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#0b1838';
  g.font = '700 112px "Amiri"';
  g.fillText('نوفمبر', w / 2, 110);
  const days = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  const cell = (w - 120) / 7;
  const colX = (wd) => w - 60 - (wd + 0.5) * cell; // Sunday on the right (Arabic reading order)
  g.font = '700 38px "Tajawal"';
  g.fillStyle = '#f2c76e';
  days.forEach((d, i) => g.fillText(d, colX(i), 262));
  g.font = '700 64px "Tajawal"';
  const pos = {};
  for (let d = 1; d <= 30; d++) {
    const wd = (d - 1) % 7; // 1 November 2026 is a Sunday
    const row = Math.floor((d - 1) / 7);
    const x = colX(wd), y = 360 + row * 150;
    pos[d] = [x, y];
    g.fillStyle = wd === 5 ? '#f2c76e' : 'rgba(235,240,255,0.88)';
    g.fillText(String(d), x, y);
  }
  return {canvas: c, pos, w, h, cell};
}

function heartShape(s = 1) {
  const p = new THREE.Shape();
  p.moveTo(0, -0.9 * s);
  p.bezierCurveTo(-1.6 * s, 0.2 * s, -0.7 * s, 1.25 * s, 0, 0.45 * s);
  p.bezierCurveTo(0.7 * s, 1.25 * s, 1.6 * s, 0.2 * s, 0, -0.9 * s);
  return p;
}

/** Side view of a hand reaching forward (+x), thumb up, with a cuff at the wrist. */
function handShape() {
  const s = new THREE.Shape();
  s.moveTo(-1.55, -0.46);
  s.lineTo(0.1, -0.5);
  s.bezierCurveTo(0.7, -0.5, 1.2, -0.42, 1.42, -0.24);
  s.bezierCurveTo(1.6, -0.08, 1.48, 0.12, 1.26, 0.13);
  s.lineTo(0.5, 0.2);
  s.bezierCurveTo(0.55, 0.36, 0.72, 0.58, 0.74, 0.74);
  s.bezierCurveTo(0.76, 0.93, 0.55, 0.98, 0.44, 0.84);
  s.bezierCurveTo(0.3, 0.66, 0.15, 0.5, -0.1, 0.46);
  s.lineTo(-1.55, 0.48);
  s.closePath();
  return s;
}

// ------------------------------------------------------------------ sim
runSim(DEFAULTS, async ({cfg, canvas}) => {
  for (const [name, data] of [['Amiri', AMIRI], ['Kufi', KUFI], ['Tajawal', TAJAWAL]]) {
    const f = new FontFace(name, `url(data:font/ttf;base64,${data})`);
    await f.load();
    document.fonts.add(f);
  }
  const hudStub = {viewport: () => ({top: 0, bottom: 0})};
  const st = createStage(canvas, hudStub, {bg: '#040b1f', fov: 34, exposure: 1.0, bloom: {strength: 0.75, radius: 0.6, threshold: 0.82}});
  const {renderer, scene, camera, composer, bloomPass} = st;
  scene.background = null;
  camera.near = 0.1;
  camera.far = 400;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;
  renderer.localClippingEnabled = false;

  // overlays (DOM): lower-third cards, big quote, light-burst transitions
  const app = document.getElementById('app');
  const css = document.createElement('style');
  css.textContent = `
    @font-face{font-family:"AmiriD";src:url(data:font/ttf;base64,${AMIRI});}
    @font-face{font-family:"TajawalD";src:url(data:font/ttf;base64,${TAJAWAL});}
    #gl{position:absolute;inset:0;width:100%;height:100%;}
    .card{position:absolute;left:50%;bottom:7.5%;transform:translateX(-50%);width:76%;direction:rtl;text-align:center;
      font-family:"TajawalD";font-weight:700;font-size:44px;line-height:1.5;color:#fff7e8;padding:26px 46px;border-radius:26px;
      background:linear-gradient(180deg,rgba(8,18,46,.72),rgba(4,10,30,.82));border:3px solid rgba(232,181,74,.85);
      box-shadow:0 0 40px rgba(232,181,74,.25), inset 0 0 30px rgba(232,181,74,.08);opacity:0;}
    .card b{color:#f6cf74;font-weight:700}
    .quote{position:absolute;left:0;right:0;top:9%;text-align:center;direction:rtl;font-family:"AmiriD";font-size:104px;
      background:linear-gradient(180deg,#fff3cf,#f2c76e 55%,#b9822a);-webkit-background-clip:text;background-clip:text;color:transparent;
      filter:drop-shadow(0 0 22px rgba(242,199,110,.55)) drop-shadow(0 4px 2px rgba(0,0,0,.6));opacity:0;}
    .flash{position:absolute;inset:0;pointer-events:none;opacity:0;
      background:radial-gradient(circle at 50% 50%,rgba(255,250,235,1) 0%,rgba(255,226,160,.9) 30%,rgba(242,180,80,.35) 65%,rgba(10,20,50,0) 100%);}
    .vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 55%,rgba(0,0,8,.55) 100%);}
    .fade{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;}
  `;
  document.head.appendChild(css);
  const mk = (cls, html = '') => {
    const d = document.createElement('div');
    d.className = cls;
    d.innerHTML = html;
    app.appendChild(d);
    return d;
  };
  mk('vignette');
  const cards = {
    date: mk('card', 'هل تعلم أن <b>اليوم العالمي للتسامح</b> هو <b>السادس عشر من نوفمبر</b> من كل عام؟'),
    hands: mk('card', 'هل تعلم أن <b>التسامح</b> يجعلنا نعيش <b>بسعادة</b> ويقلل المشاكل؟'),
    mecca: mk('card', 'هل تعلم أن رسولنا صلى الله عليه وسلم <b>سامح أهل مكة</b> وقال: «<b>اذهبوا فأنتم الطلقاء</b>»؟'),
  };
  const quote = mk('quote', '«اذْهَبُوا فَأَنْتُمُ الطُّلَقَاءُ»');
  const flash = mk('flash');
  const fade = mk('fade');

  // background dome
  const bgMat = new THREE.ShaderMaterial({
    vertexShader: BG_VS, fragmentShader: BG_FS, side: THREE.BackSide, depthWrite: false,
    uniforms: {uTop: {value: new THREE.Color()}, uBottom: {value: new THREE.Color()}, uGlow: {value: new THREE.Color()}, uGlowK: {value: 0}},
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(200, 48, 24), bgMat);
  dome.renderOrder = -10;
  scene.add(dome);

  // ---- gold dust everywhere
  const r = rng(cfg.seed);
  const DUST = 2600;
  const dg = new THREE.BufferGeometry();
  const dp = new Float32Array(DUST * 3), ds = new Float32Array(DUST), dsd = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dp[i * 3] = (r() - 0.5) * 70;
    dp[i * 3 + 1] = (r() - 0.5) * 40;
    dp[i * 3 + 2] = (r() - 0.5) * 70;
    ds[i] = 0.6 + Math.pow(r(), 3) * 3.2;
    dsd[i] = r();
  }
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  dg.setAttribute('aSize', new THREE.BufferAttribute(ds, 1));
  dg.setAttribute('aSeed', new THREE.BufferAttribute(dsd, 1));
  const dustMat = new THREE.ShaderMaterial({
    vertexShader: SPRITE_VS, fragmentShader: SPRITE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {uTime: {value: 0}, uScale: {value: 60}, uDrift: {value: 0.8}, uColor: {value: GOLD.clone()}, uOpacity: {value: 1}},
  });
  scene.add(new THREE.Points(dg, dustMat));

  const groups = {};
  const group = (name) => {
    const g = new THREE.Group();
    g.name = name;
    scene.add(g);
    groups[name] = g;
    return g;
  };
  /** Fade every material in a group; remembers each material's own opacity. */
  const setAlpha = (g, a) => {
    g.visible = a > 0.002;
    if (!g.visible) return;
    g.traverse((o) => {
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of ms) {
        if (m.userData.base === undefined) {
          m.userData.base = m.uniforms?.uOpacity ? m.uniforms.uOpacity.value : m.opacity;
          m.userData.wasT = m.transparent;
        }
        const tr = m.userData.wasT || a < 0.999;
        if (m.transparent !== tr) {
          m.transparent = tr;
          m.needsUpdate = true;
        }
        if (m.uniforms?.uOpacity) m.uniforms.uOpacity.value = m.userData.base * a * (m.userData.k ?? 1);
        else m.opacity = m.userData.base * a * (m.userData.k ?? 1);
      }
    });
  };
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,248,230,1)');
    gr.addColorStop(0.25, 'rgba(255,214,140,0.65)');
    gr.addColorStop(0.6, 'rgba(232,160,60,0.18)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const glow = (size, color = '#ffffff', op = 1) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTex, color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending}));
    s.scale.set(size, size, 1);
    return s;
  };
  const ringTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(256, 256, 180, 256, 256, 256);
    gr.addColorStop(0, 'rgba(255,220,150,0)');
    gr.addColorStop(0.75, 'rgba(255,225,160,0.9)');
    gr.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 512, 512);
    return new THREE.CanvasTexture(c);
  })();
  const ring = () => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}));

  // ================================================================ INTRO: book → light → 3D text
  const intro = group('intro');
  const book = new THREE.Group();
  intro.add(book);
  const BW = 1.7, BD = 2.3, BT = 0.09;
  const coverMat = new THREE.MeshStandardMaterial({color: '#b9b2a3', emissive: '#fff4dc', emissiveIntensity: 0.03, roughness: 0.5, metalness: 0.0, envMapIntensity: 0.55});
  const pageMat = new THREE.MeshStandardMaterial({color: '#cfc5af', emissive: '#ffe9bf', emissiveIntensity: 0.08, roughness: 0.8, side: THREE.DoubleSide, envMapIntensity: 0.55});
  const goldMat = new THREE.MeshStandardMaterial({color: '#e8b54a', metalness: 0.85, roughness: 0.35, emissive: '#5a3a08', emissiveIntensity: 0.4});
  const backCover = new THREE.Mesh(new THREE.BoxGeometry(BW, BT, BD), coverMat);
  backCover.position.set(BW / 2, 0, 0);
  book.add(backCover);
  const blockR = new THREE.Mesh(new THREE.BoxGeometry(BW * 0.96, 0.22, BD * 0.95), pageMat);
  blockR.position.set(BW / 2, BT / 2 + 0.11, 0);
  book.add(blockR);
  const hingeL = new THREE.Group();
  hingeL.position.y = 0.22 + BT;
  book.add(hingeL);
  const frontCover = new THREE.Group();
  hingeL.add(frontCover);
  const fc = new THREE.Mesh(new THREE.BoxGeometry(BW, BT, BD), coverMat);
  fc.position.set(BW / 2, 0, 0);
  frontCover.add(fc);
  const emblem = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.4, 64), goldMat);
  emblem.rotation.x = -Math.PI / 2;
  emblem.position.set(BW / 2, BT / 2 + 0.002, 0);
  frontCover.add(emblem);
  const blockL = new THREE.Mesh(new THREE.BoxGeometry(BW * 0.96, 0.22, BD * 0.95), pageMat);
  const blockLHolder = new THREE.Group();
  blockLHolder.add(blockL);
  blockL.position.set(BW * 0.48, -0.11 - BT / 2, 0);
  frontCover.add(blockLHolder);
  const pages = [];
  for (let i = 0; i < 7; i++) {
    const pg = new THREE.Group();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(BW * 0.95, BD * 0.93), pageMat);
    m.rotation.x = -Math.PI / 2;
    m.position.x = BW * 0.475;
    pg.add(m);
    pg.position.y = 0.23 + BT / 2;
    book.add(pg);
    pages.push(pg);
  }
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, BD, 16), goldMat);
  spine.rotation.x = Math.PI / 2;
  book.add(spine);
  const bookGlow = glow(3.6, '#ffd98a', 0.0);
  bookGlow.position.set(0, 0.4, 0);
  book.add(bookGlow);
  book.position.set(0, -1.6, 0);

  // light wave: spiral of particles from the pages up to the text
  const WAVE = 1400;
  const wg = new THREE.BufferGeometry();
  const wp = new Float32Array(WAVE * 3), wsz = new Float32Array(WAVE), wsd = new Float32Array(WAVE);
  for (let i = 0; i < WAVE; i++) {
    wsd[i] = r();
    wsz[i] = 1.2 + r() * 2.5;
  }
  wg.setAttribute('position', new THREE.BufferAttribute(wp, 3));
  wg.setAttribute('aSize', new THREE.BufferAttribute(wsz, 1));
  wg.setAttribute('aSeed', new THREE.BufferAttribute(wsd, 1));
  const waveMat = new THREE.ShaderMaterial({
    vertexShader: SPRITE_VS, fragmentShader: SPRITE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {uTime: {value: 0}, uScale: {value: 70}, uDrift: {value: 0}, uColor: {value: new THREE.Color('#ffd680')}, uOpacity: {value: 0}},
  });
  const wave = new THREE.Points(wg, waveMat);
  wave.frustumCulled = false;
  intro.add(wave);

  // «هل تعلم؟» as a stack of layers (reads as extruded gold) + particles that form it
  const titleC = textCanvas(['هل تعلم؟'], {font: 'Kufi', size: 330, w: 2048, pad: 60});
  const titleTex = new THREE.CanvasTexture(titleC);
  const TW = 6.4, TH = TW * (titleC.height / titleC.width);
  const title = new THREE.Group();
  title.position.set(0, 1.25, 0);
  intro.add(title);
  const LAYERS = 46, DEPTH = 0.42;
  const stackMats = [];
  for (let i = 0; i < LAYERS; i++) {
    const k = i / (LAYERS - 1);
    const m = new THREE.ShaderMaterial({
      vertexShader: STACK_VS, fragmentShader: STACK_FS, transparent: true, side: THREE.DoubleSide,
      uniforms: {uMap: {value: titleTex}, uOpacity: {value: 1}, uLayer: {value: k}, uShine: {value: -1}, uGlow: {value: 1}},
    });
    stackMats.push(m);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(TW, TH), m);
    p.position.z = -DEPTH + k * DEPTH;
    p.renderOrder = i;
    title.add(p);
  }
  const makeFormer = (cv, width, n, seed, startFn, color) => {
    const tgt = sampleCanvas(cv, n, width, seed);
    const g = new THREE.BufferGeometry();
    const rr = rng(seed + 1);
    const st0 = new Float32Array(n * 3), sz = new Float32Array(n), sd = new Float32Array(n), dl = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s = startFn(rr, i);
      st0.set(s, i * 3);
      sz[i] = 0.9 + rr() * 1.6;
      sd[i] = rr();
      dl[i] = rr() * 0.35;
    }
    g.setAttribute('position', new THREE.BufferAttribute(tgt, 3));
    g.setAttribute('aStart', new THREE.BufferAttribute(st0, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
    g.setAttribute('aDelay', new THREE.BufferAttribute(dl, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: FORM_VS, fragmentShader: FORM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {uK: {value: 0}, uScale: {value: 60}, uTime: {value: 0}, uSwirl: {value: 0.6}, uColor: {value: new THREE.Color(color)}, uOpacity: {value: 1}},
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    return pts;
  };
  const titleFormer = makeFormer(titleC, TW, 6500, 7, (rr) => {
    const a = rr() * Math.PI * 2, rad = rr() * 0.5;
    return [Math.cos(a) * rad, -2.7 - rr() * 0.3, Math.sin(a) * rad];
  }, '#ffd680');
  titleFormer.position.copy(title.position);
  intro.add(titleFormer);
  const burst = glow(6, '#fff1cc', 0);
  burst.position.set(0, 1.25, 0.3);
  intro.add(burst);
  const burstRing = ring();
  burstRing.position.set(0, 1.25, 0.2);
  intro.add(burstRing);

  // ================================================================ DATE: globe + calendar
  const dateG = group('date');
  const globe = new THREE.Group();
  dateG.add(globe);
  const globeMat = new THREE.ShaderMaterial({
    vertexShader: GLOBE_VS, fragmentShader: GLOBE_FS, transparent: true,
    uniforms: {uMap: {value: globeTexture()}, uLight: {value: new THREE.Vector3(-0.5, 0.6, 1.0)}, uOpacity: {value: 1}},
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(2.3, 96, 64), globeMat);
  earth.rotation.z = 0.41; // axial tilt
  globe.add(earth);
  const halo = glow(7.5, '#ffcf7a', 0.12);
  halo.position.z = -1.5;
  globe.add(halo);
  // gold light points orbiting the globe on three tilted rings
  const orbiters = [];
  for (let k = 0; k < 3; k++) {
    const holder = new THREE.Group();
    holder.rotation.set(0.5 + k * 0.6, k * 1.1, 0.3 * k);
    globe.add(holder);
    const track = new THREE.Mesh(new THREE.TorusGeometry(2.95 + k * 0.28, 0.006, 6, 200), new THREE.MeshBasicMaterial({color: '#e8b54a', transparent: true, opacity: 0.45}));
    holder.add(track);
    for (let j = 0; j < 4; j++) {
      const s = glow(0.55, '#ffe1a0', 1);
      holder.add(s);
      orbiters.push({s, rad: 2.95 + k * 0.28, ph: j * 1.57 + k, sp: 0.35 + k * 0.12});
    }
  }
  const cal = calendarCanvas();
  const calTex = new THREE.CanvasTexture(cal.canvas);
  calTex.colorSpace = THREE.SRGBColorSpace;
  calTex.anisotropy = 8;
  const CW = 3.5, CH = CW * (cal.h / cal.w);
  const calendar = new THREE.Group();
  dateG.add(calendar);
  const calPanel = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), new THREE.MeshBasicMaterial({map: calTex, transparent: true, toneMapped: false}));
  calPanel.material.color.setScalar(0.92);
  calendar.add(calPanel);
  const calEdge = new THREE.Mesh(new THREE.BoxGeometry(CW * 0.97, CH * 0.97, 0.06), goldMat);
  calEdge.position.z = -0.045;
  calendar.add(calEdge);
  const cpos = (d) => [(cal.pos[d][0] / cal.w - 0.5) * CW, -(cal.pos[d][1] / cal.h - 0.5) * CH];
  const [d16x, d16y] = cpos(16);
  const hi = new THREE.Group();
  hi.position.set(d16x, d16y, 0.05);
  calendar.add(hi);
  const hiDiscC = document.createElement('canvas');
  hiDiscC.width = hiDiscC.height = 256;
  {
    const g = hiDiscC.getContext('2d');
    const gr = g.createRadialGradient(128, 100, 10, 128, 128, 120);
    gr.addColorStop(0, '#fff3cf'); gr.addColorStop(0.6, '#f2c76e'); gr.addColorStop(1, '#b9822a');
    g.fillStyle = gr;
    g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0b1838';
    g.font = '700 132px "Tajawal"';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('16', 128, 138);
  }
  const hiDisc = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(hiDiscC), transparent: true}));
  hi.add(hiDisc);
  const hiGlow = glow(1.5, '#ffd27a', 1);
  hi.add(hiGlow);
  const hiRing = ring();
  hi.add(hiRing);

  // ================================================================ HANDS
  const handsG = group('hands');
  const handGeo = new THREE.ExtrudeGeometry(handShape(), {depth: 0.42, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.1, bevelSegments: 6, curveSegments: 24});
  handGeo.translate(0, 0, -0.21);
  const handMatA = new THREE.MeshStandardMaterial({color: '#d9a03a', metalness: 0.9, roughness: 0.32, envMapIntensity: 0.6, emissive: '#3a2304', emissiveIntensity: 0.12});
  const handMatB = new THREE.MeshStandardMaterial({color: '#a39a86', metalness: 0.2, roughness: 0.55, envMapIntensity: 0.4, emissive: '#3a2a0a', emissiveIntensity: 0.12});
  const cuffGeo = new THREE.CylinderGeometry(0.62, 0.66, 1.3, 48);
  cuffGeo.rotateZ(Math.PI / 2);
  const cuffMat = new THREE.MeshStandardMaterial({color: '#13275c', metalness: 0.3, roughness: 0.45});
  const cuffBand = new THREE.MeshStandardMaterial({color: '#e8b54a', metalness: 0.9, roughness: 0.3});
  const mkHand = (mat) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(handGeo, mat);
    g.add(m);
    const cuff = new THREE.Mesh(cuffGeo, cuffMat);
    cuff.position.x = -2.15;
    g.add(cuff);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.05, 12, 64), cuffBand);
    band.rotation.y = Math.PI / 2;
    band.position.x = -1.52;
    g.add(band);
    return g;
  };
  const handL = mkHand(handMatA);
  const handR = mkHand(handMatB);
  handR.scale.x = -1;
  const shake = new THREE.Group();
  shake.add(handL, handR);
  handsG.add(shake);
  const handLight = new THREE.PointLight('#ffd58a', 40, 20, 2);
  handLight.position.set(0, 2.5, 3.5);
  handsG.add(handLight);
  const handKey = new THREE.DirectionalLight('#fff0d0', 0.8);
  handKey.position.set(-3, 4, 5);
  handsG.add(handKey);
  const clGlow = glow(5, '#ffcf80', 0);
  clGlow.position.set(0, 0.1, -0.6);
  handsG.add(clGlow);
  const waves = [];
  for (let i = 0; i < 6; i++) {
    const w = ring();
    w.position.set(0, 0.05, -0.4);
    handsG.add(w);
    waves.push(w);
  }
  const heartGeo = new THREE.ExtrudeGeometry(heartShape(0.16), {depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 16});
  const heartMat = new THREE.MeshStandardMaterial({color: '#ffc46b', metalness: 0.8, roughness: 0.3, emissive: '#a05010', emissiveIntensity: 0.25});
  const hearts = [];
  const hr = rng(44);
  for (let i = 0; i < 28; i++) {
    const h = new THREE.Mesh(heartGeo, heartMat);
    handsG.add(h);
    hearts.push({h, born: hr() * 5.2, ang: hr() * Math.PI * 2, sp: 0.5 + hr() * 0.8, rise: 0.6 + hr() * 0.9, spin: (hr() - 0.5) * 3, s: 0.7 + hr() * 0.9});
  }

  // ================================================================ MAKKAH (symbolic, no figures)
  const mecca = group('mecca');
  const marble = new THREE.MeshStandardMaterial({color: '#bfb5a2', roughness: 0.6, metalness: 0.0, envMapIntensity: 0.4});
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(16, 96), marble);
  plaza.rotation.x = -Math.PI / 2;
  mecca.add(plaza);
  for (let i = 1; i <= 5; i++) {
    const ln = new THREE.Mesh(new THREE.RingGeometry(i * 2.0 + 1.6, i * 2.0 + 1.66, 128), new THREE.MeshBasicMaterial({color: '#cdbf9f', transparent: true, opacity: 0.5}));
    ln.rotation.x = -Math.PI / 2;
    ln.position.y = 0.005;
    mecca.add(ln);
  }
  const kaabaC = document.createElement('canvas');
  kaabaC.width = 1024; kaabaC.height = 1024;
  {
    const g = kaabaC.getContext('2d');
    g.fillStyle = '#0c0c0f';
    g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 1024; i += 6) { g.fillStyle = `rgba(255,255,255,${0.015 + 0.01 * Math.sin(i)})`; g.fillRect(i, 0, 2, 1024); }
    const y0 = 230, bh = 120;
    const gr = g.createLinearGradient(0, y0, 0, y0 + bh);
    gr.addColorStop(0, '#9c6a1c'); gr.addColorStop(0.5, '#f6d58b'); gr.addColorStop(1, '#9c6a1c');
    g.fillStyle = gr;
    g.fillRect(0, y0, 1024, bh);
    g.strokeStyle = '#4a3008';
    g.lineWidth = 6;
    for (let x = 0; x < 1024; x += 64) {
      g.beginPath();
      g.moveTo(x, y0 + bh / 2); g.lineTo(x + 32, y0 + 14); g.lineTo(x + 64, y0 + bh / 2); g.lineTo(x + 32, y0 + bh - 14); g.closePath();
      g.stroke();
      g.beginPath(); g.arc(x + 32, y0 + bh / 2, 10, 0, Math.PI * 2); g.stroke();
    }
    g.fillStyle = '#c99a3e';
    g.fillRect(0, y0 - 8, 1024, 6); g.fillRect(0, y0 + bh + 2, 1024, 6);
  }
  const kTex = new THREE.CanvasTexture(kaabaC);
  kTex.colorSpace = THREE.SRGBColorSpace;
  kTex.anisotropy = 8;
  const kaabaMat = new THREE.MeshStandardMaterial({map: kTex, roughness: 0.62, metalness: 0.15, emissiveMap: kTex, emissive: '#ffffff', emissiveIntensity: 0.12});
  const kaaba = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.7, 2.2), [kaabaMat, kaabaMat, new THREE.MeshStandardMaterial({color: '#111114', roughness: 0.7}), marble, kaabaMat, kaabaMat]);
  kaaba.position.y = 1.35;
  mecca.add(kaaba);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.95), goldMat);
  door.position.set(0.55, 1.35, 1.101);
  mecca.add(door);
  const kGlow = glow(6, '#ffcf80', 0.15);
  kGlow.position.set(0, 2.2, -1.5);
  mecca.add(kGlow);
  // arcades
  const archMat = new THREE.MeshStandardMaterial({color: '#b8ad98', roughness: 0.6, envMapIntensity: 0.4});
  const archGlowMat = new THREE.MeshBasicMaterial({color: '#e0a050', transparent: true, opacity: 0.45});
  const N_ARCH = 40, R_ARCH = 10.5;
  const colGeo = new THREE.BoxGeometry(0.28, 2.2, 0.28);
  const archGeo = new THREE.TorusGeometry(0.62, 0.12, 8, 24, Math.PI);
  const roofGeo = new THREE.BoxGeometry(1.75, 0.35, 0.9);
  for (let i = 0; i < N_ARCH; i++) {
    const a = (i / N_ARCH) * Math.PI * 2;
    const holder = new THREE.Group();
    holder.position.set(Math.cos(a) * R_ARCH, 0, Math.sin(a) * R_ARCH);
    holder.lookAt(0, 0, 0);
    mecca.add(holder);
    const col = new THREE.Mesh(colGeo, archMat);
    col.position.set(-0.8, 1.1, 0);
    holder.add(col);
    const arch = new THREE.Mesh(archGeo, archMat);
    arch.position.set(0, 2.2, 0);
    holder.add(arch);
    const roof = new THREE.Mesh(roofGeo, archMat);
    roof.position.set(0, 3.0, -0.2);
    holder.add(roof);
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.9), archGlowMat);
    lamp.position.set(0, 1.25, -0.42);
    holder.add(lamp);
  }
  // minarets
  const minMat = new THREE.MeshStandardMaterial({color: '#9e9585', roughness: 0.55, envMapIntensity: 0.4});
  const minGold = new THREE.MeshStandardMaterial({color: '#e8b54a', metalness: 0.9, roughness: 0.3, emissive: '#6a4410', emissiveIntensity: 0.5});
  const minarets = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.2;
    const R = 17 + (i % 2) * 1.5;
    const m = new THREE.Group();
    m.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
    const hgt = 9 + (i % 3) * 0.8;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, hgt, 20), minMat);
    body.position.y = hgt / 2;
    m.add(body);
    for (let k = 1; k <= 3; k++) {
      const bal = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 0.18, 24), minGold);
      bal.position.y = (hgt * k) / 3.6;
      m.add(bal);
    }
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.3, 20), minGold);
    tip.position.y = hgt + 0.65;
    m.add(tip);
    const cres = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 24, Math.PI * 1.4), minGold);
    cres.position.y = hgt + 1.55;
    cres.rotation.z = -0.9;
    m.add(cres);
    const lampG = glow(1.1, '#ffd27a', 0.45);
    lampG.position.y = (hgt * 3) / 3.6 + 0.2;
    m.add(lampG);
    mecca.add(m);
    minarets.push(m);
  }
  // mountains around the valley
  const mtnMat = new THREE.MeshStandardMaterial({color: '#4a3424', roughness: 0.95, flatShading: true});
  const mr = rng(91);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const R = 34 + mr() * 10;
    const h = 6 + mr() * 9;
    const mm = new THREE.Mesh(new THREE.ConeGeometry(5 + mr() * 6, h, 6), mtnMat);
    mm.position.set(Math.cos(a) * R, h / 2 - 0.5, Math.sin(a) * R);
    mm.rotation.y = mr() * 3;
    mecca.add(mm);
  }
  const sun = new THREE.DirectionalLight('#ffd49a', 1.5);
  sun.position.set(-12, 9, 6);
  mecca.add(sun);
  const amb = new THREE.HemisphereLight('#ffe2b0', '#3a2a20', 0.35);
  mecca.add(amb);

  // ================================================================ END: particles → closing line
  const endG = group('end');
  const endC = textCanvas(['التَّسَامُحُ خُلُقٌ عَظِيمٌ،', 'فَلْنَجْعَلْهُ أُسْلُوبَ حَيَاتِنَا'], {font: 'Amiri', size: 170, w: 2400, lh: 1.6, pad: 70});
  const EW = 8.2, EH = EW * (endC.height / endC.width);
  const endTex = new THREE.CanvasTexture(endC);
  const endText = new THREE.Group();
  endG.add(endText);
  const endMats = [];
  for (let i = 0; i < 14; i++) {
    const k = i / 13;
    const m = new THREE.ShaderMaterial({
      vertexShader: STACK_VS, fragmentShader: STACK_FS, transparent: true, side: THREE.DoubleSide,
      uniforms: {uMap: {value: endTex}, uOpacity: {value: 1}, uLayer: {value: k}, uShine: {value: -1}, uGlow: {value: 1}},
    });
    endMats.push(m);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(EW, EH), m);
    p.position.z = -0.12 + k * 0.12;
    p.renderOrder = i;
    endText.add(p);
  }
  const endFormer = makeFormer(endC, EW, 11000, 23, (rr) => [(rr() - 0.5) * 16, (rr() - 0.5) * 9, -1 - rr() * 5], '#ffd680');
  endG.add(endFormer);
  const subC = textCanvas(['اليوم العالمي للتسامح · 16 نوفمبر'], {font: 'Tajawal', size: 64, w: 1600, pad: 20, color: '#f2c76e'});
  const sub = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2 * (subC.height / subC.width)), new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(subC), transparent: true}));
  sub.position.set(0, -EH / 2 - 0.35, 0);
  endG.add(sub);
  const endBurst = glow(14, '#fff1cc', 0);
  endBurst.position.z = 0.3;
  endG.add(endBurst);

  // ================================================================ timing helpers
  const S = (n) => SC[n];
  const X = 0.45; // half cross-dissolve
  const sceneAlpha = (n, t) => {
    const s = S(n);
    const a = n === 'intro' ? 1 : smooth((t - s.start) / 0.6);
    const b = n === 'end' ? 1 : 1 - smooth((t - (s.end - X)) / X);
    return clamp01(a) * clamp01(b);
  };
  const bgKeys = {
    intro: [['#0b1f4a', '#02050f', '#1d2c66', 0.5]],
    date: [['#0a1d48', '#02050f', '#2a3b7a', 0.5]],
    hands: [['#2a1830', '#0b0612', '#7a4016', 0.55]],
    mecca: [['#14234a', '#7a4a2a', '#d8904a', 0.45]],
    end: [['#0b1f4a', '#02050f', '#1d2c66', 0.5]],
  };
  const sceneAt = (t) => TL.scenes.find((s) => t < s.end) || TL.scenes[TL.scenes.length - 1];

  const resize = () => {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    const pr = devicePixelRatio || 1;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    const sc = (h * pr) / 1080;
    dustMat.uniforms.uScale.value = 55 * sc;
    waveMat.uniforms.uScale.value = 60 * sc;
    titleFormer.material.uniforms.uScale.value = 26 * sc;
    endFormer.material.uniforms.uScale.value = 34 * sc;
    for (const el of app.querySelectorAll('.card,.quote')) el.style.zoom = String(w / W);
  };

  const look = new THREE.Vector3();
  const setCam = (p, tgt, roll = 0) => {
    camera.position.set(p[0], p[1], p[2]);
    look.set(tgt[0], tgt[1], tgt[2]);
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(look);
  };
  const orbit = (az, el, dist, tgt) => [tgt[0] + Math.sin(az) * Math.cos(el) * dist, tgt[1] + Math.sin(el) * dist, tgt[2] + Math.cos(az) * Math.cos(el) * dist];

  // ================================================================ render(t)
  return {
    resize,
    render(t) {
      const cur = sceneAt(t);
      const ts = (name) => t - S(name).start;

      // background
      const bk = bgKeys[cur.name][0];
      const prev = TL.scenes[Math.max(0, TL.scenes.indexOf(cur) - 1)];
      const pk = bgKeys[prev.name][0];
      const mixK = cur === prev ? 1 : smooth((t - cur.start) / 0.6);
      bgMat.uniforms.uTop.value.set(pk[0]).lerp(new THREE.Color(bk[0]), mixK);
      bgMat.uniforms.uBottom.value.set(pk[1]).lerp(new THREE.Color(bk[1]), mixK);
      bgMat.uniforms.uGlow.value.set(pk[2]).lerp(new THREE.Color(bk[2]), mixK);
      bgMat.uniforms.uGlowK.value = lerp(pk[3], bk[3], mixK);

      dustMat.uniforms.uTime.value = t;
      dustMat.uniforms.uOpacity.value = smooth(t / 1.2) * (cur.name === 'mecca' ? 0.45 : 1) * (1 - smooth((t - (TL.duration - 0.8)) / 0.8));
      for (const n of Object.keys(groups)) setAlpha(groups[n], sceneAlpha(n, t));
      bloomPass.strength = 0.75;

      // ---------------- INTRO
      if (groups.intro.visible) {
        const ti = ts('intro');
        const appear = easeOutCubic((ti - 0.6) / 1.4);
        book.scale.setScalar(0.6 + 0.4 * appear);
        book.position.y = -1.6 - (1 - appear) * 0.6;
        coverMat.userData.k = 1;
        const open = easeInOutCubic((ti - 1.7) / 1.9);
        hingeL.rotation.z = open * Math.PI * 0.985;
        book.position.x = lerp(-BW / 2, 0, open);
        blockLHolder.visible = open > 0.5;
        pages.forEach((pg, i) => {
          const k = easeInOutCubic((ti - 1.9 - i * 0.12) / 1.5);
          pg.rotation.z = k * Math.PI * (0.97 - i * 0.012);
          pg.visible = k > 0.001 && k < 0.999;
        });
        bookGlow.material.opacity = smooth((ti - 2.2) / 1.2) * 0.45;
        // light wave
        const wk = clamp01((ti - 2.9) / 2.4);
        const wOp = smooth((ti - 2.9) / 0.5) * (1 - smooth((ti - 5.0) / 0.9));
        waveMat.uniforms.uOpacity.value = wOp;
        waveMat.uniforms.uTime.value = t;
        for (let i = 0; i < WAVE; i++) {
          const sd = wsd[i];
          const life = ((ti - 2.9) * (0.55 + sd * 0.5) + sd) % 1;
          const y = -1.4 + life * 2.9;
          const rad = 0.15 + life * (0.5 + sd * 0.9);
          const a = sd * 40 + ti * (1.5 + sd) + life * 6;
          wp[i * 3] = Math.cos(a) * rad;
          wp[i * 3 + 1] = y;
          wp[i * 3 + 2] = Math.sin(a) * rad;
        }
        wg.attributes.position.needsUpdate = true;
        wave.visible = wk > 0 && wOp > 0.001;
        // formation → 3D text at the first word
        const fk = clamp01((ti - 3.0) / (T.textBurst - 3.0 + 0.05));
        titleFormer.material.uniforms.uK.value = fk;
        titleFormer.material.uniforms.uTime.value = t;
        titleFormer.material.uniforms.uOpacity.value = smooth((ti - 2.9) / 0.4) * (1 - smooth((t - T.textBurst - 0.1) / 0.7)) * 0.95;
        titleFormer.visible = ti > 2.8 && t < T.textBurst + 0.9;
        const tk = smooth((t - T.textBurst + 0.12) / 0.35);
        stackMats.forEach((m) => {
          m.uniforms.uOpacity.value = tk * sceneAlpha('intro', t);
          m.uniforms.uShine.value = lerp(-0.4, 1.6, clamp01((t - T.textBurst - 0.3) / 1.4));
          m.uniforms.uGlow.value = 1 + 0.6 * Math.exp(-Math.max(0, t - T.textBurst) * 3);
        });
        title.visible = tk > 0.001;
        const pop = easeOutBack((t - T.textBurst + 0.12) / 0.6, 1.4);
        title.scale.setScalar(0.85 + 0.15 * pop);
        title.rotation.y = Math.sin(t * 0.6) * 0.06;
        title.position.y = 1.25 + Math.sin(t * 1.1) * 0.04;
        const bt = t - T.textBurst;
        burst.material.opacity = bt > -0.1 ? Math.exp(-Math.max(0, bt) * 3.0) * 0.5 * smooth((bt + 0.1) / 0.1) : 0;
        burst.scale.setScalar(3 + Math.max(0, bt) * 3);
        burstRing.material.opacity = bt > 0 ? Math.exp(-bt * 2.6) * 0.28 : 0;
        burstRing.scale.setScalar(1 + Math.max(0, bt) * 14);
        if (bt > -0.1 && bt < 1.2) bloomPass.strength = 0.75 + 0.25 * Math.exp(-Math.max(0, bt) * 3);
        // camera: rise over the book, then a circular move around the title
        const az = keyed([[0, -0.15], [3.0, 0.1], [T.textBurst, -0.35], [S('intro').end, 0.42]], ti);
        const el = keyed([[0, 0.62], [3.0, 0.42], [T.textBurst, 0.12], [S('intro').end, 0.08]], ti);
        const dist = keyed([[0, 10.5], [3.0, 8.8], [T.textBurst, 9.2], [S('intro').end, 8.0]], ti);
        const ty = keyed([[0, -1.4], [3.0, -0.8], [T.textBurst, 0.9], [S('intro').end, 1.1]], ti);
        setCam(orbit(az, el, dist, [0, ty, 0]), [0, ty, 0]);
      }

      // ---------------- DATE
      if (groups.date.visible && cur.name === 'date') {
        const td = ts('date');
        earth.rotation.y = -1.2 + td * 0.18;
        const gIn = easeOutCubic(td / 1.6);
        globe.scale.setScalar(0.75 + 0.25 * gIn);
        const shift = easeInOutCubic((t - T.calIn + 0.4) / 1.1);
        globe.position.set(lerp(0, 2.75, shift), 0.15, -0.6 * shift);
        orbiters.forEach((o) => {
          const a = o.ph + td * o.sp;
          o.s.position.set(Math.cos(a) * o.rad, Math.sin(a) * o.rad, 0);
          o.s.material.opacity = 0.6 + 0.4 * Math.sin(td * 3 + o.ph);
        });
        const cIn = easeOutCubic((t - T.calIn) / 1.0);
        calendar.position.set(lerp(-7, -2.65, cIn), 0.3, lerp(-2, 0.4, cIn));
        calendar.rotation.y = lerp(0.9, 0.22, cIn) + Math.sin(td * 0.7) * 0.02;
        calendar.visible = cIn > 0.001;
        const hk = t - T.day16;
        hi.visible = hk > -0.05;
        const hp = easeOutBack(hk / 0.45, 2.2);
        hiDisc.scale.setScalar(Math.max(0.001, hp));
        hiGlow.material.opacity = hk > 0 ? 0.3 + 0.15 * Math.sin(hk * 5) + 0.3 * Math.exp(-hk * 3) : 0;
        hiRing.material.opacity = hk > 0 ? Math.exp(-hk * 1.6) : 0;
        hiRing.scale.setScalar(0.5 + Math.max(0, hk) * 3.5);
        if (hk > 0 && hk < 1) bloomPass.strength = 0.75 + 0.35 * Math.exp(-hk * 3);
        const az = keyed([[0, 0.35], [T.calIn - S('date').start, 0.05], [S('date').end - S('date').start, -0.12]], td);
        const dist = keyed([[0, 11], [2.0, 10.2], [T.day16 - S('date').start, 9.4], [S('date').end - S('date').start, 9.0]], td);
        const tx = keyed([[0, 0], [T.calIn - S('date').start + 0.6, 0]], td);
        setCam(orbit(az, 0.08, dist + 0.8, [tx, -0.45, 0]), [tx, -0.45, 0]);
      }

      // ---------------- HANDS
      if (groups.hands.visible && cur.name === 'hands') {
        const th = ts('hands');
        const meet = easeInOutCubic((t - (T.clasp - 1.4)) / 1.4);
        const gap = lerp(3.6, 0.62, meet);
        handL.position.set(-gap, -0.05, 0.16);
        handR.position.set(gap, 0.05, -0.16);
        handL.rotation.z = lerp(0.25, 0.0, meet);
        handL.rotation.x = 0.32;
        handR.rotation.z = lerp(-0.25, 0.0, meet);
        handR.rotation.x = -0.32;
        const ck = t - T.clasp;
        shake.rotation.z = ck > 0 ? Math.sin(ck * 6.5) * 0.07 * Math.exp(-ck * 0.9) : 0;
        shake.position.y = ck > 0 ? Math.sin(ck * 6.5) * 0.08 * Math.exp(-ck * 0.9) : 0;
        shake.rotation.y = Math.sin(th * 0.4) * 0.12;
        clGlow.material.opacity = ck > 0 ? 0.06 + 0.03 * Math.sin(ck * 3) : 0;
        clGlow.scale.setScalar(3.5);
        handLight.intensity = 6 + (ck > 0 ? 8 * Math.exp(-ck * 2) : 0);
        waves.forEach((w, i) => {
          const k = (ck - i * 0.7) / 3.2;
          const on = ck > i * 0.7 && k < 1;
          w.visible = on;
          w.material.opacity = on ? (1 - k) * 0.22 * smooth(k / 0.15) : 0;
          w.scale.setScalar(3.5 + k * 12);
        });
        hearts.forEach((o) => {
          const age = ck - 0.2 - o.born * 0.9;
          const life = 3.2;
          const on = age > 0 && age < life;
          o.h.visible = on;
          if (!on) return;
          const k = age / life;
          o.h.position.set(Math.cos(o.ang) * (0.6 + age * o.sp), Math.sin(o.ang) * 0.4 + age * o.rise, Math.sin(o.ang) * 0.6 + 0.4);
          o.h.rotation.set(0, age * o.spin, 0);
          o.h.scale.setScalar(o.s * Math.min(1, age / 0.3) * (1 - smooth((k - 0.75) / 0.25)));
        });
        if (ck > -0.1 && ck < 1) bloomPass.strength = 0.75 + 0.3 * Math.exp(-Math.max(0, ck) * 3);
        const az = keyed([[0, -0.5], [T.clasp - S('hands').start, -0.18], [S('hands').end - S('hands').start, 0.32]], th);
        const dist = keyed([[0, 10.5], [T.clasp - S('hands').start, 8.2], [S('hands').end - S('hands').start, 7.8]], th);
        setCam(orbit(az, 0.34, dist, [0, -0.1, 0]), [0, -0.1, 0]);
      }

      // ---------------- MAKKAH
      if (groups.mecca.visible && cur.name === 'mecca') {
        const tm = ts('mecca');
        const D = S('mecca').end - S('mecca').start;
        const az = lerp(0.95, 0.25, easeInOutCubic(tm / D));
        const el = keyed([[0, 0.55], [D * 0.55, 0.26], [D, 0.2]], tm);
        const dist = keyed([[0, 25], [D * 0.55, 15], [D, 12.8]], tm);
        const ty = keyed([[0, 2.0], [D, 2.4]], tm);
        setCam(orbit(az, el, dist, [0, ty, 0]), [0, ty + 0.6, 0]);
        kGlow.material.opacity = 0.12 + 0.05 * Math.sin(tm * 1.3) + (t > T.quote ? 0.12 * smooth((t - T.quote) / 0.8) : 0);
      }

      // ---------------- END
      if (groups.end.visible) {
        const te = ts('end');
        const fk = clamp01(te / (T.endLine - S('end').start + 0.4));
        endFormer.material.uniforms.uK.value = fk;
        endFormer.material.uniforms.uTime.value = t;
        endFormer.material.uniforms.uSwirl.value = 1.2;
        endFormer.material.uniforms.uOpacity.value = smooth(te / 0.6) * (1 - smooth((t - T.endLine - 0.6) / 1.2) * 0.7) * sceneAlpha('end', t);
        const tk = smooth((t - T.endLine + 0.1) / 0.9);
        endMats.forEach((m) => {
          m.uniforms.uOpacity.value = tk;
          m.uniforms.uShine.value = lerp(-0.4, 1.6, clamp01((t - T.endLine - 0.6) / 2.0));
          m.uniforms.uGlow.value = 1 + 0.4 * Math.exp(-Math.max(0, t - T.endLine) * 2);
        });
        endText.visible = tk > 0.001;
        const bt = t - T.endLine;
        endBurst.material.opacity = bt > 0 ? Math.exp(-bt * 2) * 0.6 : 0;
        sub.material.opacity = smooth((t - (SC.end.voice_end + 0.1)) / 0.8);
        const D = S('end').end - S('end').start;
        setCam(orbit(keyed([[0, -0.25], [D, 0.12]], te), 0.04, keyed([[0, 13], [D, 10.6]], te), [0, 0, 0]), [0, -0.05, 0]);
      }

      // ---------------- overlays
      for (const [n, el] of Object.entries(cards)) {
        const s = S(n);
        const a = smooth((t - s.voice + 0.15) / 0.5) * (1 - smooth((t - (s.end - 0.55)) / 0.4));
        el.style.opacity = a.toFixed(3);
        el.style.transform = `translateX(-50%) translateY(${((1 - a) * 30).toFixed(1)}px)`;
      }
      const qa = smooth((t - T.quote + 0.05) / 0.6) * (1 - smooth((t - (S('mecca').end - 0.55)) / 0.4));
      quote.style.opacity = qa.toFixed(3);
      quote.style.transform = `scale(${(0.92 + 0.08 * easeOutCubic((t - T.quote) / 0.8)).toFixed(4)})`;
      let fl = 0;
      for (const s of TL.scenes.slice(1)) fl = Math.max(fl, Math.exp(-Math.pow((t - s.start) / 0.22, 2)) * 0.82);
      flash.style.opacity = fl.toFixed(3);
      fade.style.opacity = Math.max(1 - smooth(t / 0.5), smooth((t - (TL.duration - 0.7)) / 0.7)).toFixed(3);

      composer.render();
      return {};
    },
  };
});
