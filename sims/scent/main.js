import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {runSim} from '../kit/runtime.js';
import {createStage} from '../kit/stage3d.js';
import {clamp01, easeInOutCubic, easeOutCubic, keyed, lerp, rng} from '../kit/util.js';
import {glassMat, makeBrain} from './brain.js';
import {makeCard, makeShards} from './cards.js';
import {makePerson} from './character.js';
import {C, F, LN, SC, TL, band, canvasTex, contact, dotTex, mat, noise3, ramp, sphere, wordT} from './lib.js';

const DEFAULTS = {
  duration: TL.duration,
  fps: TL.fps,
  watermark: '',
  hud: {enabled: false},
  director: {enabled: false},
  subtitles: true,
};

// Set origins: each "set" lives far from the others and is shown only in its scenes.
const ROOM = new THREE.Vector3(0, 0, 0);
const ISLE = new THREE.Vector3(300, 0, 0);
const NOSE = new THREE.Vector3(-300, 0, 0);
const LAB = new THREE.Vector3(0, 0, 300);
const DIFF = new THREE.Vector3(0, 0, -300);

const at = (o, x, y, z) => [o.x + x, o.y + y, o.z + z];
const frac = (x) => x - Math.floor(x);

runSim(DEFAULTS, async ({cfg, canvas, hud, capture}) => {
  const st = createStage(canvas, hud, {bg: C.night, capture, fov: 34, exposure: 0.95, bloom: {strength: 0.55, radius: 0.6, threshold: 0.86}});
  const {scene, camera} = st;
  camera.near = 0.1;
  camera.far = 2000;
  const app = document.getElementById('app');

  // ---------- sky dome (gradient that follows the camera) ----------
  const domeU = {uTop: {value: new THREE.Color(C.navy)}, uBot: {value: new THREE.Color(C.night)}, uMid: {value: new THREE.Color(C.ink)}};
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: domeU,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform vec3 uTop; uniform vec3 uBot; uniform vec3 uMid; varying vec3 vP;
        void main(){ float y = vP.y; vec3 c = y > 0.0 ? mix(uMid, uTop, smoothstep(0.0, 0.7, y)) : mix(uMid, uBot, smoothstep(0.0, -0.6, y)); gl_FragColor = vec4(c, 1.0); }`,
    }),
  );
  dome.renderOrder = -10;
  scene.add(dome);
  scene.background = null;

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight('#cfe6ff', '#3b3478', 1.1);
  const key = new THREE.DirectionalLight('#fff4f2', 2.0);
  const rim = new THREE.DirectionalLight(C.sky, 2.2);
  const fill = new THREE.DirectionalLight(C.violetSoft, 0.8);
  scene.add(hemi, key, rim, fill, key.target, rim.target, fill.target);
  const lightAt = (o, k = [-6, 9, 10], r = [7, 6, -8], f = [-8, -2, 4]) => {
    key.position.set(o.x + k[0], o.y + k[1], o.z + k[2]);
    rim.position.set(o.x + r[0], o.y + r[1], o.z + r[2]);
    fill.position.set(o.x + f[0], o.y + f[1], o.z + f[2]);
    for (const l of [key, rim, fill]) l.target.position.copy(o);
  };

  const sprite = dotTex();

  // ---------- particle wisps (scent) ----------
  const pointsMat = () =>
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {uMap: {value: sprite}, uH: {value: 1920}, uA: {value: 1}},
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; uniform float uH;
        varying float vA; varying vec3 vC;
        void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv;
          gl_PointSize = aSize * projectionMatrix[1][1] * uH * 0.5 / max(0.1, -mv.z); vA = aAlpha; vC = aColor; }`,
      fragmentShader: `uniform sampler2D uMap; uniform float uA; varying float vA; varying vec3 vC;
        void main(){ float a = texture2D(uMap, gl_PointCoord).r * vA * uA; gl_FragColor = vec4(vC * a, a); }`,
    });
  class Wisp {
    constructor(n, colors = [C.sky, C.violetSoft, C.white]) {
      this.n = n;
      const geo = new THREE.BufferGeometry();
      this.pos = new Float32Array(n * 3);
      this.alpha = new Float32Array(n);
      this.size = new Float32Array(n);
      const col = new Float32Array(n * 3);
      const r = rng(n * 31 + colors.length);
      this.rand = Float32Array.from({length: n * 3}, () => r());
      for (let i = 0; i < n; i++) {
        const c = new THREE.Color(colors[i % colors.length]);
        col.set([c.r, c.g, c.b], i * 3);
      }
      geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
      geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
      geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
      this.points = new THREE.Points(geo, pointsMat());
      this.points.frustumCulled = false;
      this.points.renderOrder = 20;
      scene.add(this.points);
    }
    /** fn(i, rand3) → [x, y, z, alpha, size] */
    update(fn, a = 1) {
      this.points.visible = a > 0.01;
      if (!this.points.visible) return;
      this.points.material.uniforms.uA.value = a;
      this.points.material.uniforms.uH.value = st.size.h;
      for (let i = 0; i < this.n; i++) {
        const [x, y, z, al, s] = fn(i, this.rand[i * 3], this.rand[i * 3 + 1], this.rand[i * 3 + 2]);
        this.pos[i * 3] = x;
        this.pos[i * 3 + 1] = y;
        this.pos[i * 3 + 2] = z;
        this.alpha[i] = al;
        this.size[i] = s;
      }
      const g = this.points.geometry;
      g.attributes.position.needsUpdate = true;
      g.attributes.aAlpha.needsUpdate = true;
      g.attributes.aSize.needsUpdate = true;
    }
  }
  /** A ribbon of scent flowing along a curve; k is phase along it. */
  const flowAlong = (curve, t, {speed = 0.18, spread = 0.35, size = 0.16, head = 1, tail = 0} = {}) => (i, r1, r2, r3) => {
    const k = frac(r1 + t * speed * (0.7 + r2 * 0.6));
    const vis = k <= head && k >= tail ? 1 : 0;
    const p = curve.getPoint(k);
    const sw = spread * (0.4 + k);
    const n1 = noise3(r1 * 9, k * 3 + t * 0.4, 1.3) * sw;
    const n2 = noise3(r2 * 9, k * 3 - t * 0.35, 4.1) * sw;
    const n3 = noise3(r3 * 9, k * 3, t * 0.3 + 7) * sw;
    return [p.x + n1, p.y + n2, p.z + n3, vis * Math.sin(Math.PI * k) * (0.25 + 0.45 * r3), size * (0.35 + 0.5 * r2)];
  };

  // ======================================================================
  // SET 1: modern room + young man with a perfume bottle
  // ======================================================================
  const room = new THREE.Group();
  room.position.copy(ROOM);
  scene.add(room);
  const wallM = mat('#c6cff0', {roughness: 0.9});
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), wallM);
  wall.position.set(0, 10, -8);
  room.add(wall);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), mat('#9ea9d6', {roughness: 0.85}));
  floor.rotation.x = -Math.PI / 2;
  room.add(floor);
  const winTex = canvasTex(512, 640, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#7fc6ff');
    gr.addColorStop(0.65, '#d7ecff');
    gr.addColorStop(1, '#fbf3ff');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (const [x, y, s] of [[120, 160, 1], [360, 260, 1.4], [220, 420, 0.9]]) {
      for (const [dx, dy, r] of [[0, 0, 36], [40, -12, 46], [82, 0, 34], [40, 12, 40]]) {
        g.beginPath();
        g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
        g.fill();
      }
    }
  });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(6, 7.5), new THREE.MeshBasicMaterial({map: winTex, toneMapped: false}));
  win.position.set(4.6, 9.4, -7.95);
  room.add(win);
  const frameM = mat('#f4f6ff', {roughness: 0.5});
  for (const [x, y, w, h] of [[4.6, 13.15, 6.4, 0.3], [4.6, 5.65, 6.4, 0.3], [1.45, 9.4, 0.3, 7.8], [7.75, 9.4, 0.3, 7.8], [4.6, 9.4, 0.18, 7.5], [4.6, 9.9, 6, 0.18]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), frameM);
    b.position.set(x, y, -7.8);
    room.add(b);
  }
  // shelf with small things (they glow softly in the ending: "simple things around you")
  const shelf = new THREE.Mesh(new RoundedBoxGeometry(5.5, 0.25, 1.4, 2, 0.08), mat('#eef0fb'));
  shelf.position.set(-4.6, 8.2, -7.2);
  room.add(shelf);
  const things = [];
  const thing = (geo, color, x, y, z) => {
    const m = new THREE.Mesh(geo, mat(color, {emissive: color, emissiveIntensity: 0}));
    m.position.set(x, y, z);
    room.add(m);
    things.push(m);
    return m;
  };
  thing(new THREE.CylinderGeometry(0.32, 0.28, 0.75, 20), C.violetSoft, -6.4, 8.7, -7.0);
  thing(new RoundedBoxGeometry(0.5, 1.1, 0.5, 3, 0.12), C.skySoft, -5.5, 8.88, -7.0);
  thing(new THREE.SphereGeometry(0.42, 24, 16), C.white, -3.2, 8.75, -7.0);
  const books = thing(new RoundedBoxGeometry(1.3, 0.9, 0.9, 2, 0.06), C.violet, -4.4, 8.78, -7.1);
  books.rotation.z = 0.12;
  // plant
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 1.5, 24), mat('#eef0fb'));
  pot.position.set(-6.6, 0.75, -5.2);
  room.add(pot);
  for (let i = 0; i < 9; i++) {
    const leaf = sphere(0.9, mat('#7cc7c2', {roughness: 0.7}), 0.35, 1.6, 0.12, 16);
    const a = (i / 9) * Math.PI * 2;
    leaf.position.set(-6.6 + Math.cos(a) * 0.6, 3.0 + (i % 3) * 0.6, -5.2 + Math.sin(a) * 0.6);
    leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    room.add(leaf);
    things.push(leaf);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 16), new THREE.MeshBasicMaterial({color: '#fff4fb', toneMapped: false}));
  lamp.position.set(-3.5, 12.8, -6.5);
  room.add(lamp);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 6), mat('#ffffff'));
  cord.position.set(-3.5, 16.5, -6.5);
  room.add(cord);

  const man = makePerson({bottle: true});
  man.group.rotation.y = 0.12;
  room.add(man.group);
  // head materials get their own copies so the head can turn to glass without the hands
  const headMats = [];
  man.head.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.userData.base = o.material.opacity;
      headMats.push(o.material);
    }
  });
  const headGlass = new THREE.Mesh(new THREE.SphereGeometry(1.02, 48, 36), glassMat(C.skySoft, C.sky));
  headGlass.scale.set(0.95, 1.08, 1.0);
  headGlass.renderOrder = 6;
  man.head.add(headGlass);
  const roomFloat = new Wisp(70, [C.white, C.skySoft]);
  const scentWisp = new Wisp(260);
  const noseWisp = new Wisp(160);

  // memory cards that bloom out of the scent behind his head (scene 1)
  const roomCards = ['house', 'family', 'kite'].map((k) => {
    const c = makeCard(k);
    c.material.color.setScalar(0.84);
    c.scale.setScalar(2.6);
    room.add(c);
    return c;
  });

  // ======================================================================
  // SET 2: childhood memory, a floating island (Najdi house, palm, family, toys)
  // ======================================================================
  const isle = new THREE.Group();
  isle.position.copy(ISLE);
  scene.add(isle);
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(10, 9.4, 0.8, 64), mat('#a8dccb', {roughness: 0.85}));
  grass.position.y = -0.4;
  isle.add(grass);
  const rock = new THREE.Mesh(new THREE.ConeGeometry(9.4, 7, 64, 4), mat('#9d95d6', {roughness: 0.9}));
  rock.rotation.x = Math.PI;
  rock.position.y = -4.3;
  isle.add(rock);
  // old house: thick mud-brick walls, parapet notches, small lit windows
  const houseM = mat('#efe4dc', {roughness: 0.9});
  const house = new THREE.Group();
  house.position.set(-2.5, 0, -3);
  isle.add(house);
  const hb = new THREE.Mesh(new RoundedBoxGeometry(6, 4.2, 4.6, 2, 0.15), houseM);
  hb.position.y = 2.1;
  house.add(hb);
  const upper = new THREE.Mesh(new RoundedBoxGeometry(3.2, 1.8, 3.4, 2, 0.12), houseM);
  upper.position.set(-1.2, 5.1, -0.4);
  house.add(upper);
  for (let i = 0; i < 9; i++) {
    const n = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.36), houseM);
    n.position.set(-2.7 + i * 0.68, 4.45, 2.15);
    house.add(n);
  }
  const winM = new THREE.MeshStandardMaterial({color: '#fff1e2', emissive: '#ffe6cf', emissiveIntensity: 0.7});
  const winMeshes = [];
  for (const [x, y] of [[-1.8, 2.6], [1.8, 2.6], [-1.2, 5.2]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), winM);
    w.position.set(x, y, y > 4 ? 1.31 : 2.31);
    house.add(w);
    winMeshes.push(w);
  }
  const door = new THREE.Mesh(new RoundedBoxGeometry(1.2, 2.2, 0.2, 2, 0.08), mat(C.violet));
  door.position.set(0, 1.1, 2.3);
  house.add(door);
  // palm tree
  const palm = new THREE.Group();
  palm.position.set(4.2, 0, -3.4);
  isle.add(palm);
  for (let i = 0; i < 9; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.3 - i * 0.012, 0.36 - i * 0.012, 0.9, 12), mat('#b9a9e8', {roughness: 0.9}));
    seg.position.set(Math.sin(i * 0.18) * 0.5, 0.45 + i * 0.85, 0);
    palm.add(seg);
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const frond = sphere(1, mat('#6fc0b8', {roughness: 0.75}), 0.35, 0.08, 2.4, 16);
    frond.position.set(0.9 + Math.cos(a) * 1.6, 7.6 - 0.2, Math.sin(a) * 1.6);
    frond.rotation.set(0, -a + Math.PI / 2, 0);
    frond.rotateX(0.45);
    palm.add(frond);
  }
  // family: father (thobe), mother (abaya + hijab), child (violet hoodie, like him now)
  const dad = makePerson({s: 0.5, h: 0.62, outfit: 'thobe', top: '#f6f8ff', detail: 0.4});
  const mom = makePerson({s: 0.47, h: 0.6, outfit: 'abaya', top: '#2b2f66', hairStyle: 'hijab', detail: 0.4});
  const kid = makePerson({s: 0.27, h: 0.5, outfit: 'hoodie', top: C.violet, detail: 0.4});
  dad.group.position.set(1.0, 0, 2.0);
  mom.group.position.set(4.1, 0, 2.0);
  kid.group.position.set(2.55, 0, 2.3);
  for (const p of [dad, mom, kid]) isle.add(p.group);
  for (const [p, r] of [[dad, 1.3], [mom, 1.3], [kid, 0.8]]) {
    const sh = contact(r, 0.3);
    sh.position.set(p.group.position.x, 0.02, p.group.position.z);
    isle.add(sh);
  }
  // toys: letter blocks (أ ب ت), a ball, a kite in the sky
  const blockTex = (ch, bg) =>
    canvasTex(128, 128, (g) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#ffffff';
      g.font = `700 86px ${F.ar}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(ch, 64, 70);
    });
  const blocks = [['أ', C.violet, -4.4, 0.55, 4.2, 0.3], ['ب', '#5bb6ea', -3.1, 0.55, 4.6, -0.2], ['ت', '#9a8cf0', -3.8, 1.65, 4.35, 0.1]].map(([ch, bg, x, y, z, r]) => {
    const tex = blockTex(ch, bg);
    const b = new THREE.Mesh(new RoundedBoxGeometry(1.1, 1.1, 1.1, 3, 0.12), new THREE.MeshStandardMaterial({map: tex, roughness: 0.6}));
    b.position.set(x, y, z);
    b.rotation.y = r;
    isle.add(b);
    return b;
  });
  const ballTex = canvasTex(256, 128, (g) => {
    for (let i = 0; i < 6; i++) {
      g.fillStyle = [C.white, C.sky, C.white, C.violet, C.white, C.blush][i];
      g.fillRect((i * 256) / 6, 0, 256 / 6 + 1, 128);
    }
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 20), new THREE.MeshStandardMaterial({map: ballTex, roughness: 0.4}));
  ball.position.set(-1.4, 0.6, 5.0);
  isle.add(ball);
  const kite = new THREE.Group();
  const kiteShape = new THREE.Shape([new THREE.Vector2(0, 1.4), new THREE.Vector2(0.9, 0), new THREE.Vector2(0, -1.6), new THREE.Vector2(-0.9, 0)]);
  kite.add(new THREE.Mesh(new THREE.ShapeGeometry(kiteShape), new THREE.MeshStandardMaterial({color: C.violet, side: THREE.DoubleSide, emissive: C.violet, emissiveIntensity: 0.2})));
  isle.add(kite);
  const tailPts = Array.from({length: 12}, (_, i) => new THREE.Vector3(Math.sin(i * 0.8) * 0.3, -1.6 - i * 0.35, 0));
  const kiteTail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tailPts), 40, 0.04, 6), mat(C.white));
  kite.add(kiteTail);
  const isleSpark = new Wisp(120, [C.white, C.pearl, C.skySoft]);
  const isleScent = new Wisp(200);

  // ======================================================================
  // SET 3: inside the nose: molecules, receptor neurons, cribriform plate, bulb
  // ======================================================================
  const nose = new THREE.Group();
  nose.position.copy(NOSE);
  scene.add(nose);
  const NCELL = 7;
  const cellX = (i) => (i - (NCELL - 1) / 2) * 0.95;
  const mucus = new THREE.Mesh(new RoundedBoxGeometry(9, 1.1, 3, 3, 0.4), new THREE.MeshStandardMaterial({color: C.skySoft, transparent: true, opacity: 0.22, roughness: 0.2, emissive: C.sky, emissiveIntensity: 0.12, depthWrite: false}));
  mucus.position.y = -1.0;
  nose.add(mucus);
  const tissue = new THREE.Mesh(new RoundedBoxGeometry(9, 1.3, 3, 3, 0.4), mat('#c9bff2', {roughness: 0.8}));
  tissue.position.y = 0.45;
  nose.add(tissue);
  const plate = new THREE.Mesh(new RoundedBoxGeometry(9.4, 0.55, 3.2, 3, 0.2), mat('#e8e2fb', {roughness: 0.9}));
  plate.position.y = 2.7;
  nose.add(plate);
  const bulbN = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshStandardMaterial({color: C.lilac, transparent: true, opacity: 0.5, roughness: 0.35, emissive: C.violet, emissiveIntensity: 0.15, depthWrite: false}));
  bulbN.scale.set(4.2, 1.25, 1.5);
  bulbN.position.y = 5.0;
  nose.add(bulbN);
  const cellM = [];
  const axons = [];
  const glomX = [-1.9, 0, 1.9];
  const glom = glomX.map((x) => {
    const m = new THREE.MeshStandardMaterial({color: C.white, emissive: C.violetSoft, emissiveIntensity: 0.2});
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), m);
    s.position.set(x, 5.0, 0.4);
    nose.add(s);
    return {s, m};
  });
  const ciliaM = mat(C.white, {roughness: 0.5});
  for (let i = 0; i < NCELL; i++) {
    const m = new THREE.MeshStandardMaterial({color: '#f3f0ff', emissive: C.sky, emissiveIntensity: 0.1, roughness: 0.5});
    cellM.push(m);
    const cell = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), m);
    cell.position.set(cellX(i), 0.45, 1.2);
    nose.add(cell);
    // dendrite down to the knob and cilia
    const dend = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8), m);
    dend.position.set(cellX(i), -0.1, 1.2);
    nose.add(dend);
    for (let c = 0; c < 5; c++) {
      const a = (c / 5) * Math.PI * 2;
      const pts = [new THREE.Vector3(cellX(i), -0.5, 1.2), new THREE.Vector3(cellX(i) + Math.cos(a) * 0.25, -0.95, 1.2 + Math.sin(a) * 0.25), new THREE.Vector3(cellX(i) + Math.cos(a) * 0.45, -1.35, 1.2 + Math.sin(a) * 0.4)];
      nose.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.022, 5), ciliaM));
    }
    const g = glomX[Math.round((i / (NCELL - 1)) * 2)];
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(cellX(i), 0.75, 1.2), new THREE.Vector3(cellX(i) * 0.9, 2.0, 1.0), new THREE.Vector3(cellX(i) * 0.75, 2.7, 0.8), new THREE.Vector3(lerp(cellX(i), g, 0.6), 3.8, 0.6), new THREE.Vector3(g, 4.75, 0.45)]);
    nose.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.045, 6), m));
    axons.push({curve, g: Math.round((i / (NCELL - 1)) * 2)});
  }
  const holeM = new THREE.MeshBasicMaterial({color: '#6b62b8'});
  for (let i = 0; i < NCELL; i++) {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), holeM);
    hole.position.set(cellX(i) * 0.75, 2.7, 1.62);
    nose.add(hole);
  }
  // odor molecules: little ball-and-stick clusters; each binds one receptor
  const MOL = 14;
  const mols = Array.from({length: MOL}, (_, i) => {
    const g = new THREE.Group();
    const r = rng(100 + i);
    const cols = [C.violet, C.sky, C.white];
    const n = 3 + (i % 3);
    let prev = new THREE.Vector3();
    for (let k = 0; k < n; k++) {
      const p = k ? prev.clone().add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(0.26)) : new THREE.Vector3();
      const a = new THREE.Mesh(new THREE.SphereGeometry(k ? 0.1 : 0.13, 16, 12), new THREE.MeshStandardMaterial({color: cols[(i + k) % 3], emissive: cols[(i + k) % 3], emissiveIntensity: 0.35, roughness: 0.3}));
      a.position.copy(p);
      g.add(a);
      prev = p;
    }
    nose.add(g);
    const cell = i % NCELL;
    return {g, cell, bind: wordT('receptor', 'مستقبلات') - 0.2 + (i / MOL) * 2.1, x0: (r() - 0.5) * 6, z0: 1.2 + (r() - 0.5) * 2, ph: r() * 6};
  });
  const signal = new Wisp(NCELL * 6, [C.white, C.skySoft]);

  // ======================================================================
  // SET 4: the brain (scenes 3, 5, 6) + overlapping memories (scene 6)
  // ======================================================================
  const brain = makeBrain({seg: 140});
  scene.add(brain.group);
  const labCards = ['house', 'family', 'dallah'].map((k) => {
    const c = makeCard(k);
    c.material.color.setScalar(0.84);
    scene.add(c);
    return c;
  });
  const threadM = (c) => new THREE.MeshBasicMaterial({color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false});
  const threads = [C.violet, C.sky].map((c) => {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), threadM(c));
    m.renderOrder = 12;
    scene.add(m);
    return m;
  });
  const setThread = (m, a, b, k, bow = 1.5) => {
    const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(bow, 0, 1.0));
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const pts = curve.getPoints(48).slice(0, Math.max(2, Math.round(48 * k) + 1));
    m.geometry.dispose();
    m.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.035, 6);
  };
  const labWisp = new Wisp(220);

  // ======================================================================
  // SET 5: different scents, different (or no, or blurry) memories
  // ======================================================================
  const diff = new THREE.Group();
  diff.position.copy(DIFF);
  scene.add(diff);
  const vialColors = ['#bfa98f', C.sky, C.violet];
  const vials = vialColors.map((c, i) => {
    const g = new THREE.Group();
    const glass = new THREE.Mesh(new RoundedBoxGeometry(1.1, 1.6, 1.1, 4, 0.3), new THREE.MeshStandardMaterial({color: '#dff0ff', transparent: true, opacity: 0.38, roughness: 0.1, emissive: '#7cbcff', emissiveIntensity: 0.1}));
    const liq = new THREE.Mesh(new RoundedBoxGeometry(0.85, 1.0, 0.85, 3, 0.22), new THREE.MeshStandardMaterial({color: c, emissive: c, emissiveIntensity: 0.45, roughness: 0.3}));
    liq.position.y = -0.2;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.35, 20), mat(C.white, {metalness: 0.4, roughness: 0.3}));
    cap.position.y = 1.0;
    g.add(liq, glass, cap);
    g.position.set((i - 1) * 2.05, -5.2, 0);
    diff.add(g);
    return g;
  });
  const diffWisps = vials.map(() => new Wisp(110));
  const dCard = makeCard('dallah');
  dCard.material.color.setScalar(0.84);
  dCard.scale.setScalar(2.5);
  diff.add(dCard);
  const ghost = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1.27),
    new THREE.MeshBasicMaterial({
      map: canvasTex(260, 330, (g, w, h) => {
        g.strokeStyle = 'rgba(220,230,255,0.9)';
        g.setLineDash([16, 14]);
        g.lineWidth = 6;
        g.beginPath();
        g.roundRect(8, 8, w - 16, h - 16, 18);
        g.stroke();
        g.fillStyle = 'rgba(220,230,255,0.9)';
        g.font = `600 120px ${F.ar}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('؟', w / 2, h / 2);
      }),
      transparent: true, depthWrite: false, toneMapped: false,
    }),
  );
  ghost.scale.setScalar(2.5);
  diff.add(ghost);
  const shards = makeShards('rain', 5, 6);
  shards.scale.setScalar(2.5);
  shards.children.forEach((m) => m.material.color.setScalar(0.84));
  diff.add(shards);

  // ======================================================================
  // 2D overlay: veil, vignette, grain, labels, question, subtitles
  // ======================================================================
  const el = (cls, parent = app, html = '') => {
    const d = document.createElement('div');
    d.className = cls;
    d.innerHTML = html;
    parent.appendChild(d);
    return d;
  };
  const vignette = el('vignette');
  const veil = el('veil');
  const grain = el('grain');
  const grainUrls = Array.from({length: 6}, (_, k) => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const img = g.createImageData(256, 256);
    const r = rng(9000 + k);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (r() - 0.5) * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return `url(${c.toDataURL()})`;
  });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'leaders');
  app.appendChild(svg);
  const labels = {};
  const label = (id, title, sub = '', color = C.white) => {
    const d = el('label', app, `<div class="lt">${title}</div>${sub ? `<div class="ls">${sub}</div>` : ''}`);
    d.style.setProperty('--c', color);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke', color);
    svg.appendChild(line);
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '7');
    dot.setAttribute('fill', color);
    svg.appendChild(dot);
    labels[id] = {d, line, dot};
  };
  label('mol', 'جزيئات الرائحة', '', C.skySoft);
  label('rec', 'مستقبلات الشمّ', '', C.white);
  label('bulbN', 'البصلة الشمّية', '', C.violetSoft);
  label('bulb', 'البصلة الشمّية', '', C.white);
  label('amy', 'اللوزة الدماغية', 'المشاعر', C.violetSoft);
  label('hip', 'الحُصين', 'الذاكرة', C.skySoft);
  label('emo', 'مشاعر', '', C.violetSoft);
  label('mem', 'ذاكرة', '', C.skySoft);
  label('coffee', 'قهوة', '', '#e7dccf');
  label('rain', 'مطر', '', C.skySoft);
  label('oud', 'بخور', '', C.violetSoft);
  /** Place label `id` with its anchor at world point p, box offset (dx, dy) in px. */
  const showLabel = (id, p, a, dx = 0, dy = -120, align = 'center') => {
    const L = labels[id];
    L.d.style.opacity = a;
    L.line.style.opacity = a * 0.8;
    L.dot.style.opacity = a;
    if (a <= 0.001) return;
    const s = st.project(p);
    const ease = easeOutCubic(clamp01(a));
    const bx = s.x + dx;
    const by = s.y + dy * (0.8 + 0.2 * ease);
    L.d.style.transform = `translate(${bx}px, ${by}px) translate(${align === 'center' ? '-50%' : align === 'left' ? '0' : '-100%'}, -50%)`;
    L.dot.setAttribute('cx', s.x);
    L.dot.setAttribute('cy', s.y);
    L.line.setAttribute('x1', s.x);
    L.line.setAttribute('y1', s.y);
    L.line.setAttribute('x2', lerp(s.x, bx, ease));
    L.line.setAttribute('y2', lerp(s.y, by + (dy < 0 ? 34 : -34), ease));
  };
  const question = el('question', app, '<span class="q1">كيف ترتبط</span><span class="q2"><b class="sky">الروائح</b> <span class="w">بـ</span><b class="vio">الذكريات</b>؟</span>');
  const chip = el('chip', app, 'الاستجابة تختلف من شخص لآخر');
  const endTitle = el('endtitle', app, '<div class="et1">ليش بعض الروائح</div><div class="et2">ترجّع لك ذكريات؟</div>');
  const subs = el('subs');

  // subtitle chunks: ≤ 5 words, broken after punctuation when possible
  const chunks = [];
  for (const l of TL.lines) {
    let cur = [];
    l.words.forEach((w, i) => {
      cur.push(w);
      const punct = /[،,.!؟?]$/.test(w.w);
      const last = i === l.words.length - 1;
      if (last || punct || cur.length >= 5) {
        if (!last && cur.length <= 2 && !punct) return;
        chunks.push(cur);
        cur = [];
      }
    });
  }
  chunks.forEach((c, i) => {
    c.t0 = c[0].a - 0.12;
    const next = chunks[i + 1];
    c.t1 = Math.min(c[c.length - 1].b + 0.5, next ? next[0].a - 0.14 : 1e9);
  });
  const subSpans = chunks.map((c) => {
    const row = el('subrow', subs);
    return {row, spans: c.map((w) => {
      const s = document.createElement('span');
      s.textContent = w.w;
      row.appendChild(s);
      row.appendChild(document.createTextNode(' '));
      return s;
    })};
  });

  await document.fonts.load(`600 40px ${F.ar}`).catch(() => {});
  await document.fonts.load(`700 40px ${F.ar}`).catch(() => {});

  // ---------- camera ----------
  const shot = (keys, t, ease = easeInOutCubic) => {
    const p = keyed(keys.map(([k, pos]) => [k, pos]), t, ease);
    const q = keyed(keys.map(([k, , tg]) => [k, tg]), t, ease);
    camera.position.set(p[0], p[1], p[2]);
    camera.lookAt(q[0], q[1], q[2]);
    camera.updateMatrixWorld();
    dome.position.copy(camera.position);
  };
  const S = SC;
  const VEILS = [[S.memories.t0, 0.55], [S.question.t0, 0.5], [wordT('receptor', 'ريحة', true) + 0.45, 0.45], [S.brain.t0, 0.5], [S.differ.t0, 0.5], [S.ending.t0, 0.55]];
  const flashT = wordT('end', 'بلحظات');

  const setFog = (color, density) => {
    scene.fog = density > 0 ? new THREE.FogExp2(color, density) : null;
  };
  const fogs = {};
  const fog = (color, density) => {
    const k = color + density.toFixed(4);
    if (!fogs[k]) fogs[k] = new THREE.FogExp2(color, density);
    scene.fog = density > 0 ? fogs[k] : null;
  };
  void setFog;

  const dome3 = (top, mid, bot) => {
    domeU.uTop.value.set(top);
    domeU.uMid.value.set(mid);
    domeU.uBot.value.set(bot);
  };

  // pose of the young man over time (scenes 1, 3, 8)
  const manPose = (t) => {
    const raise = keyed([[0, 0.45], [1.3, 1], [4.0, 1], [5.0, 0.9]], t);
    const endRaise = keyed([[S.ending.t0, 0.25], [wordT('end', 'حتى'), 0.25], [wordT('end', 'حتى') + 1.2, 0.85], [TL.duration, 0.85]], t);
    const r = t < S.question.t0 ? raise : t < S.ending.t0 ? 0 : endRaise;
    const rest = [1.35, 4.6, 1.3];
    const up = [0.85, 6.35, 1.35];
    const hand = rest.map((v, i) => lerp(v, up[i], r));
    let eyes = 1 - ramp(t, 1.55, 0.35);
    let tilt = 0.12 * ramp(t, 1.3, 0.8) - 0.04;
    let smile = 0.3 + 0.5 * ramp(t, 2.5, 1.2);
    if (t >= S.ending.t0) {
      const close = band(t, wordT('end', 'ممكن') - 0.2, wordT('end', 'حتى'), 0.35);
      eyes = 1 - close;
      tilt = 0.06 * close;
      smile = 0.55 + 0.35 * ramp(t, wordT('end', 'بلحظات'), 1);
    }
    const breathe = Math.sin(t * 1.6) * 0.02;
    man.pose({handR: hand, handL: [-1.4, 3.9, 0.5], eyes, smile, tilt: tilt + breathe, turn: t >= S.ending.t0 ? -0.08 : 0.05});
    man.group.position.y = breathe * 0.5;
  };

  const showOnly = (...groups) => {
    for (const g of [room, isle, nose, diff, brain.group]) g.visible = groups.includes(g);
  };
  const hideLabels = () => Object.keys(labels).forEach((k) => showLabel(k, [0, 0, 0], 0));

  const render = (t) => {
    const T = st.size.h;
    void T;
    hideLabels();
    for (const w of [roomFloat, scentWisp, noseWisp, isleSpark, isleScent, signal, labWisp, ...diffWisps]) w.update(() => [0, 0, 0, 0, 0], 0);
    for (const m of [...labCards, ...threads]) m.visible = false;
    for (const c of roomCards) c.visible = false;
    question.style.opacity = 0;
    chip.style.opacity = 0;
    endTitle.style.opacity = 0;
    headGlass.visible = false;
    headMats.forEach((m) => (m.opacity = m.userData.base));
    things.forEach((m) => (m.material.emissiveIntensity = 0));
    let vig = 0.55;

    // ---------------- SCENE 1 + 3 + 8: room ----------------
    const inRoom = t < S.memories.t0 || (t >= S.question.t0 && t < wordT('receptor', 'ريحة', true) + 0.45) || (t >= S.ending.t0 && !(t > flashT - 0.05 && t < flashT + 0.7));
    if (inRoom) {
      showOnly(room);
      manPose(t);
      lightAt(ROOM, [-7, 12, 11], [8, 12, -6], [-9, 4, 6]);
      hemi.color.set('#d4e8ff');
      hemi.groundColor.set('#4a3f8a');
      hemi.intensity = 0.85;
      key.color.set('#fff6f4');
      key.intensity = 2.0;
      rim.intensity = 2.6;
      rim.color.set('#9fd6ff');
      fill.intensity = 0.7;
      fog('#b9c3ee', 0.005);
      const bottleTop = man.bottle.position.clone().add(new THREE.Vector3(0, 0.85, 0));
      // dust in the window light
      roomFloat.update((i, r1, r2, r3) => [-3 + r1 * 11, 3 + frac(r2 + t * 0.02 * (0.5 + r3)) * 12, -6 + r3 * 9, 0.15 + 0.2 * Math.sin(t * 1.3 + i), 0.03 + r3 * 0.03], 1);

      if (t < S.memories.t0) {
        // SCENE 1: smell → background turns into childhood memories
        const turn = ramp(t, wordT('hook', 'وفجأة') - 0.2, 2.2);
        wallM.color.set('#c6cff0').lerp(new THREE.Color('#9d97e2'), turn * 0.7);
        fog('#c9c4f3', 0.005 + turn * 0.03);
        const sc = clamp01(t / 1.0) * (1 - ramp(t, 5.0, 0.4));
        scentWisp.update((i, r1, r2, r3) => {
          const k = frac(r1 + t * (0.1 + r2 * 0.08));
          const a = k * 7 + r2 * 6.28 + t * 0.6;
          const rad = 0.25 + k * (1.6 + turn * 1.8);
          const x = bottleTop.x + Math.cos(a) * rad * 0.9 - k * 0.8;
          const y = bottleTop.y + k * (3.4 + turn * 2) + Math.sin(a * 0.7) * 0.2;
          const z = bottleTop.z + Math.sin(a) * rad * 0.6 - k * 1.5;
          return [x, y, z, Math.sin(Math.PI * k) * (0.25 + 0.45 * r3) * (k < 0.05 ? k * 20 : 1), 0.04 + r3 * 0.07 + k * 0.06];
        }, sc);
        roomCards.forEach((c, i) => {
          const a = ramp(t, wordT('hook', 'تذكّرت') - 0.3 + i * 0.35, 0.9);
          c.visible = a > 0;
          c.material.opacity = a * 0.92;
          const ang = -0.9 + i * 0.9;
          c.position.set(Math.sin(ang) * 3.4 - 0.2, 9.2 + Math.cos(ang) * 0.9 + (i === 1 ? 1.2 : 0) + Math.sin(t + i) * 0.1, -3.2 - i * 0.4);
          c.rotation.set(0, -ang * 0.35, (i - 1) * -0.12);
          c.scale.setScalar(2.2 + a * 0.3);
        });
        shot([[0, [3.4, 8.2, 15.5], [0.3, 6.9, 0]], [2.6, [2.2, 8.0, 13.2], [0.2, 7.3, 0]], [S.memories.t0, [0.8, 8.8, 8.0], [0.1, 8.6, -3]]], t);
        vig = 0.5 + turn * 0.15;
      } else if (t < S.ending.t0) {
        // SCENE 3: face → glass head → brain inside; the question
        const lt = t - S.question.t0;
        const x = ramp(t, S.question.t0 + 0.3, 1.2);
        wallM.color.set('#c6cff0').lerp(new THREE.Color('#252a63'), x);
        fog('#1a1f4d', 0.004 + 0.03 * x);
        hemi.intensity = 0.85 - 0.4 * x;
        key.intensity = 2.0 - 0.9 * x;
        headMats.forEach((m) => (m.opacity = m.userData.base * (1 - 0.88 * x)));
        headGlass.visible = true;
        headGlass.material.uniforms.uA.value = x * 0.9;
        brain.group.visible = x > 0.01;
        const hp = new THREE.Vector3();
        man.head.getWorldPosition(hp);
        brain.group.position.copy(hp).add(new THREE.Vector3(0, 0.2, -0.05));
        brain.group.rotation.set(-0.05, 0.12, 0);
        brain.group.scale.setScalar(0.4);
        const toNose = ramp(t, S.receptors.t0 - 0.2, 1.3);
        brain.set({xray: 0.6 + 0.4 * x, a: 0.2, hip: 0.2, b: 0.3 + toNose, alpha: x, t});
        // scent into the nose (scene 4 opening, still in this set)
        const noseP = hp.clone().add(new THREE.Vector3(0.07, -0.3, 1.0));
        noseWisp.update((i, r1, r2, r3) => {
          const k = frac(r1 + t * (0.25 + r2 * 0.1));
          const p0 = noseP.clone().add(new THREE.Vector3(1.6 + r2 * 1.5, -2.2 - r3, 1.4 + r1));
          const p = p0.lerp(noseP, easeInOutCubic(k));
          return [p.x + Math.sin(k * 9 + i) * 0.08, p.y, p.z, Math.sin(Math.PI * k) * 0.9, 0.05 + 0.05 * r3];
        }, toNose);
        question.style.opacity = band(t, S.question.t0 + 0.35, S.receptors.t0 - 0.05, 0.35);
        question.style.transform = `translateY(${(1 - ramp(t, S.question.t0 + 0.35, 0.7)) * 30}px)`;
        shot([[0, [5.2, 8.6, 6.2], [0, 7.95, 0.2]], [2.5, [6.4, 8.3, 2.6], [0, 7.9, 0.3]], [S.receptors.t0 - S.question.t0 + 0.1, [5.0, 7.8, 1.4], [0, 7.75, 0.55]], [wordT('receptor', 'ريحة', true) + 0.45 - S.question.t0, [1.6, 7.6, 1.1], [0.05, 7.65, 0.85]]], lt);
        vig = 0.6;
      } else {
        // SCENE 8: back in the room; simple things glow, a flash of childhood, calm end
        const lt = t - S.ending.t0;
        wallM.color.set('#c6cff0');
        const glow = band(t, wordT('end', 'أشياء') - 0.1, wordT('end', 'ممكن') + 0.8, 0.5);
        things.forEach((m, i) => (m.material.emissiveIntensity = glow * (0.35 + 0.25 * Math.sin(t * 3 + i))));
        const curl = ramp(t, wordT('end', 'حتى'), 1.5) * (1 - ramp(t, TL.duration - 1.6, 1.2));
        scentWisp.update((i, r1, r2, r3) => {
          const k = frac(r1 + t * (0.08 + r2 * 0.05));
          const a = k * 6 + r2 * 6.28 + t * 0.5;
          const rad = 0.3 + k * 2.4;
          return [bottleTop.x + Math.cos(a) * rad - k * 1.2, bottleTop.y + k * 4.2, bottleTop.z + Math.sin(a) * rad * 0.6 - k * 2.2, Math.sin(Math.PI * k) * (0.2 + 0.4 * r3), 0.04 + r3 * 0.07];
        }, (0.35 + curl * 0.65) * (1 - 0.8 * ramp(t, TL.duration - 3.2, 0.8)));
        shot([[0, [-2.0, 7.6, 13.5], [0.2, 6.8, 0]], [5.5, [-0.8, 7.8, 14.5], [0.1, 6.9, 0]], [8.6, [1.0, 8.2, 16.0], [0.3, 7.2, 0]], [TL.duration - S.ending.t0, [2.4, 9.0, 19.5], [0.8, 8.0, -1]]], lt);
        const ta = band(t, TL.duration - 3.0, TL.duration + 1, 0.8);
        endTitle.style.opacity = ta;
        endTitle.style.transform = `translateY(${(1 - ramp(t, TL.duration - 3.0, 1.0)) * 24}px)`;
      }
    }

    // ---------------- SCENE 2 (+ flash in 8): childhood island ----------------
    const inIsle = (t >= S.memories.t0 && t < S.question.t0) || (t > flashT - 0.05 && t < flashT + 0.7);
    if (inIsle) {
      showOnly(isle);
      lightAt(ISLE, [-8, 14, 10], [9, 8, -10], [-10, 2, 8]);
      hemi.color.set('#e9f1ff');
      hemi.groundColor.set('#6d5fb0');
      hemi.intensity = 1.3;
      key.color.set('#fff0ea');
      key.intensity = 2.2;
      rim.color.set(C.skySoft);
      rim.intensity = 1.8;
      fill.intensity = 0.8;
      fog('#d6d3fa', 0.005);
      dome3('#a9d8ff', '#e6e0ff', '#c9bdf5');
      // family: child hops between parents who hold its hands
      const hop = Math.abs(Math.sin(t * 3.2)) * 0.45;
      kid.group.position.y = hop;
      const kp = kid.group.position;
      const dp = dad.group.position;
      const mp = mom.group.position;
      const kh = 0.27 * 4.6 + hop;
      dad.pose({handR: [0.95, 0.5 * 4.4 + (kh - 2.2) * 0.3, 0.35], handL: [-0.75, 0.5 * 3.9, 0.3], smile: 0.8, turn: 0.35});
      mom.pose({handL: [-0.95, 0.47 * 4.4 + (kh - 2.1) * 0.3, 0.35], handR: [0.7, 0.47 * 3.9, 0.3], smile: 0.8, turn: -0.35});
      kid.pose({handR: [mp.x - kp.x - 0.75, kh - hop + 0.1, 0.1], handL: [dp.x - kp.x + 0.75, kh - hop + 0.1, 0.1], smile: 1, turn: Math.sin(t * 1.5) * 0.3});
      kite.position.set(3.5 + Math.sin(t * 0.7) * 0.6, 10.5 + Math.sin(t * 1.1) * 0.4, -5);
      kite.rotation.set(0.1, -0.4, 0.25 + Math.sin(t * 1.3) * 0.15);
      ball.position.y = 0.6 + Math.abs(Math.sin(t * 2.4)) * 0.25;
      ball.rotation.z = -t * 1.3;
      const lit = ramp(t, wordT('odd', 'ترجّع'), 0.9);
      winM.emissiveIntensity = 0.7 + lit * 1.0;
      isleSpark.update((i, r1, r2, r3) => {
        const a = r1 * 6.28 + t * 0.05 * (r2 - 0.5);
        const rad = 3 + r2 * 13;
        return [ISLE.x + Math.cos(a) * rad, frac(r3 + t * 0.015) * 16 - 2, ISLE.z + Math.sin(a) * rad, 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + i)), 0.04 + r3 * 0.08];
      }, 1);
      if (t < S.question.t0) {
        const lt = t - S.memories.t0;
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-14, 6, 10), new THREE.Vector3(-8, 4, 8), new THREE.Vector3(-4, 3.2, 5), new THREE.Vector3(-1.8, 2.8, 2.6), new THREE.Vector3(-1.2, 2.7, 0.3)].map((v) => v.add(ISLE)));
        const flow = ramp(t, wordT('odd', 'ريحة') - 0.2, 1.4);
        isleScent.update(flowAlong(curve, t, {speed: 0.22, spread: 0.45, size: 0.22, head: 0.15 + 0.85 * flow}), flow * (1 - ramp(t, S.question.t0 - 0.6, 0.5)));
        const odd = LN.odd.t0 - S.memories.t0;
        shot([[0, at(ISLE, 6, 9.5, 21), at(ISLE, 1.2, 2.2, 0)], [odd - 0.4, at(ISLE, 13.5, 6.5, 13.5), at(ISLE, 1.8, 2.6, 0)], [odd + 0.1, at(ISLE, -9.5, 2.2, 15.5), at(ISLE, -1.4, 2.4, 0.5)], [S.question.t0 - S.memories.t0, at(ISLE, -4.6, 2.9, 10.8), at(ISLE, -1.6, 2.8, 0)]], lt);
      } else {
        // memory flash in the ending: a quick close look at the family
        const lt = t - (flashT - 0.05);
        shot([[0, at(ISLE, 4.4, 3.4, 10.5), at(ISLE, 2.5, 2.2, 2)], [0.8, at(ISLE, 3.4, 3.2, 9.2), at(ISLE, 2.5, 2.2, 2)]], lt, (x) => x);
      }
      vig = 0.72;
    }

    // ---------------- SCENE 4: receptors ----------------
    const recT0 = wordT('receptor', 'ريحة', true) + 0.45;
    if (t >= recT0 && t < S.brain.t0) {
      showOnly(nose);
      lightAt(NOSE, [-6, 10, 12], [6, 8, -8], [-8, -4, 6]);
      hemi.color.set('#cfe6ff');
      hemi.groundColor.set('#2c2a6a');
      hemi.intensity = 0.9;
      key.intensity = 1.6;
      rim.intensity = 2.2;
      rim.color.set(C.sky);
      fog(C.night, 0.01);
      dome3('#1f2a66', '#141c48', '#0b1030');
      const lt = t - recT0;
      mols.forEach((m, i) => {
        const tip = new THREE.Vector3(cellX(m.cell), -1.45, 1.25 + ((i % 2) - 0.5) * 0.3);
        const k = clamp01((t - (m.bind - 2.4)) / 2.4);
        const start = new THREE.Vector3(m.x0, -7, m.z0);
        const p = start.lerp(tip, easeOutCubic(k));
        if (k < 1) p.x += Math.sin(t * 1.4 + m.ph) * 0.4 * (1 - k);
        m.g.position.copy(p);
        m.g.rotation.set(t * 0.8 + m.ph, t * 0.6, 0);
        m.g.visible = t > m.bind - 2.6;
      });
      cellM.forEach((m, i) => {
        const hits = mols.filter((x) => x.cell === i).map((x) => x.bind);
        const flash = Math.max(0, ...hits.map((b) => Math.exp(-Math.max(0, t - b) * 2.2) * (t >= b ? 1 : 0)));
        const on = hits.some((b) => t >= b) ? 0.35 : 0;
        m.emissiveIntensity = 0.1 + on + flash * 1.4;
      });
      const sigOn = clamp01(lt / 0.2);
      signal.update((i) => {
        const a = axons[i % NCELL];
        const cell = i % NCELL;
        const first = Math.min(...mols.filter((x) => x.cell === cell).map((x) => x.bind));
        const k = frac((t - first) * 0.7 + Math.floor(i / NCELL) / 6);
        const live = t > first ? 1 : 0;
        const p = a.curve.getPoint(k);
        return [p.x + NOSE.x, p.y + NOSE.y, p.z + NOSE.z, live * Math.sin(Math.PI * k), 0.22];
      }, sigOn);
      const bulbOn = ramp(t, wordT('receptor', 'ترسل'), 1.2);
      glom.forEach((g, i) => (g.m.emissiveIntensity = 0.2 + bulbOn * (0.9 + 0.4 * Math.sin(t * 5 + i * 2))));
      bulbN.material.emissiveIntensity = 0.15 + bulbOn * 0.35;
      shot([[0, at(NOSE, 1.4, -3.0, 12.5), at(NOSE, 0, -1.0, 0.6)], [wordT('receptor', 'ترسل') - recT0, at(NOSE, 0.6, 0.0, 14.0), at(NOSE, 0, 1.0, 0.6)], [S.brain.t0 - recT0, at(NOSE, -0.6, 3.2, 13.5), at(NOSE, 0, 3.4, 0.4)]], lt);
      showLabel('mol', at(NOSE, mols[2].g.position.x, mols[2].g.position.y, mols[2].g.position.z), band(t, recT0 + 0.3, wordT('receptor', 'ترسل'), 0.4), -150, 60);
      showLabel('rec', at(NOSE, cellX(5), 0.45, 1.2), band(t, wordT('receptor', 'مستقبلات') - 0.1, S.brain.t0, 0.4), 70, -150, 'left');
      showLabel('bulbN', at(NOSE, -1.9, 5.0, 0.4), band(t, wordT('receptor', 'للبصلة') - 0.1, S.brain.t0, 0.4), -60, -150, 'right');
      vig = 0.6;
    }

    // ---------------- SCENES 5 + 6: brain, then memories overlapping ----------------
    if (t >= S.brain.t0 && t < S.differ.t0) {
      showOnly(brain.group);
      lightAt(LAB, [-8, 10, 8], [8, 6, -10], [-6, -6, 6]);
      hemi.color.set('#d6e8ff');
      hemi.groundColor.set('#2c2a6a');
      hemi.intensity = 1.0;
      key.intensity = 1.8;
      rim.intensity = 2.4;
      rim.color.set(C.sky);
      fog(C.night, 0.004);
      dome3('#22306f', '#151c4a', '#0b1030');
      const sc = 2.3;
      brain.group.scale.setScalar(sc);
      const inFeel = t >= S.feeling.t0;
      const up = ramp(t, S.feeling.t0 - 0.2, 1.4);
      brain.group.position.set(LAB.x, LAB.y + up * 4.7, LAB.z);
      brain.group.rotation.set(0, 0.62 + (t - S.brain.t0) * 0.03 - up * 0.25, 0);
      brain.group.scale.setScalar(sc * (1 - 0.4 * up));
      const xr = ramp(t, S.brain.t0 + 0.7, 1.3);
      const a = ramp(t, wordT('brain', 'اللوزة') - 0.15, 0.6);
      const hp = ramp(t, wordT('brain', 'والحُصين') - 0.15, 0.6);
      const emo = inFeel ? ramp(t, wordT('link', 'مشاعر') - 0.2, 0.8) : 0;
      brain.set({xray: xr, a: a * (0.8 + 0.4 * emo), hip: hp, b: 0.4 + 0.6 * band(t, S.brain.t0, wordT('brain', 'مثل'), 0.5), pulse: ramp(t, S.brain.t0 + 0.6, 0.8), t});
      brain.group.updateMatrixWorld();
      const W = (v) => v.clone().applyMatrix4(brain.group.matrixWorld);
      const amyW = W(brain.anchors.amy.position);
      const hipW = W(brain.anchors.hipCurve.getPoint(0.55));
      const bulbW = W(brain.anchors.bulb.position);
      if (!inFeel) {
        const lt = t - S.brain.t0;
        shot([[0, at(LAB, -11.5, 3.2, 14.5), at(LAB, 0, -0.2, 0)], [S.feeling.t0 - S.brain.t0, at(LAB, -9.8, 0.6, 13.0), at(LAB, 0.3, -0.4, 0)]], lt);
        showLabel('bulb', bulbW, band(t, S.brain.t0 + 0.6, wordT('brain', 'مثل'), 0.4), -120, 170, 'right');
        showLabel('amy', amyW, band(t, wordT('brain', 'اللوزة') - 0.1, S.feeling.t0, 0.35), 150, -330, 'left');
        showLabel('hip', hipW, band(t, wordT('brain', 'والحُصين') - 0.1, S.feeling.t0, 0.35), -60, -300);
      } else {
        const lt = t - S.feeling.t0;
        // overlapping memories gather below the brain
        const base = new THREE.Vector3(LAB.x, LAB.y + 0.2, LAB.z + 1.5);
        labCards.forEach((c, i) => {
          const k = ramp(t, S.feeling.t0 + 0.5 + i * 0.45, 1.2);
          const stack = ramp(t, wordT('link', 'ذكريات') - 0.3, 1.6);
          c.visible = k > 0;
          c.material.opacity = k * (i === 1 ? 1 : 0.95 - stack * 0.4);
          const spreadX = [-1.9, 0, 1.9][i] * (1 - stack * 0.75);
          c.position.set(base.x + spreadX, base.y + (i === 1 ? 0.3 : -0.2) + Math.sin(t * 0.8 + i) * 0.08 + (1 - k) * -1.2, base.z + [-0.6, 0.35, -0.3][i]);
          c.rotation.set(0, [0.35, 0, -0.35][i] * (1 - stack * 0.5), [0.1, 0, -0.1][i]);
          c.scale.setScalar(2.5 * (i === 1 ? 1 + stack * 0.12 : 0.9));
        });
        const front = labCards[1].position.clone().add(new THREE.Vector3(0, 1.6, 0.05));
        const th = ramp(t, wordT('link', 'يفسّر') - 0.3, 1.4);
        threads[0].visible = threads[1].visible = th > 0.02;
        if (th > 0.02) {
          setThread(threads[0], amyW, front.clone().add(new THREE.Vector3(0.9, 0, 0)), th, 1.6);
          setThread(threads[1], hipW, front.clone().add(new THREE.Vector3(-0.9, 0, 0)), th, -1.6);
          threads[0].material.opacity = 0.55 + 0.4 * emo;
          threads[1].material.opacity = 0.75;
        }
        // scent rising into the bulb
        const curve = new THREE.CatmullRomCurve3([bulbW.clone().add(new THREE.Vector3(0.5, -6.5, 5)), bulbW.clone().add(new THREE.Vector3(0.3, -3.5, 3)), bulbW.clone().add(new THREE.Vector3(0, -1.2, 1)), bulbW.clone()]);
        labWisp.update(flowAlong(curve, t, {speed: 0.3, spread: 0.3, size: 0.18}), band(t, S.feeling.t0 + 0.2, S.differ.t0, 0.6));
        shot([[0, at(LAB, -6.5, 2.4, 21.5), at(LAB, 0, 0.5, 0)], [S.differ.t0 - S.feeling.t0, at(LAB, -3.0, 1.2, 19.5), at(LAB, 0, 0.3, 0)]], lt);
        showLabel('emo', front.clone().add(new THREE.Vector3(1.3, 0.3, 0)), band(t, wordT('link', 'مشاعر') - 0.2, S.differ.t0, 0.4), 30, -40, 'left');
        showLabel('mem', front.clone().add(new THREE.Vector3(-1.3, 0.3, 0)), band(t, wordT('link', 'ذكريات') - 0.2, S.differ.t0, 0.4), -30, -40, 'right');
      }
      vig = 0.6;
    }

    // ---------------- SCENE 7: different scents ----------------
    if (t >= S.differ.t0 && t < S.ending.t0) {
      showOnly(diff);
      lightAt(DIFF, [-6, 10, 10], [6, 6, -8], [-6, -6, 6]);
      hemi.intensity = 1.0;
      key.intensity = 1.8;
      rim.intensity = 2.0;
      fog(C.night, 0.004);
      dome3('#2a2f78', '#171d4e', '#0b1030');
      const lt = t - S.differ.t0;
      vials.forEach((v, i) => {
        const k = ramp(t, S.differ.t0 + 0.15 + i * 0.18, 0.7);
        v.position.y = -1.8 - (1 - k) * 1.5 + Math.sin(t * 1.5 + i) * 0.06;
        v.rotation.y = t * 0.3 + i;
        v.visible = k > 0.01;
      });
      const rise = ramp(t, wordT('differ', 'كل') - 0.2, 1.0);
      const cardY = 0.9;
      diffWisps.forEach((w, i) => {
        const x = (i - 1) * 2.05;
        const end = i === 1 ? 0.62 : 1;
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, -0.9, 0), new THREE.Vector3(x + 0.25, -0.1, 0.2), new THREE.Vector3(x - 0.2, 0.7, 0.1), new THREE.Vector3(x, 1.45, 0)].map((p) => p.add(DIFF)));
        w.update(flowAlong(curve, t, {speed: 0.3, spread: i === 1 ? 0.6 : 0.3, size: 0.17, head: end}), rise);
      });
      const c1 = ramp(t, wordT('differ', 'ترجّع'), 0.8);
      dCard.material.opacity = c1;
      dCard.visible = c1 > 0;
      dCard.position.set(-2.05, cardY + 1.6 + (1 - c1) * -0.6, 0);
      dCard.scale.setScalar(1.6);
      const g1 = band(t, wordT('differ', 'ذكرى،') - 0.1, S.ending.t0, 0.5) * 0.7;
      ghost.material.opacity = g1;
      ghost.visible = g1 > 0;
      ghost.position.set(0, cardY + 1.6, 0);
      ghost.scale.setScalar(1.6);
      const s1 = ramp(t, wordT('differ', 'ولا') - 0.1, 0.8);
      const blur = ramp(t, wordT('differ', 'دقيقة') - 0.2, 0.9);
      shards.visible = s1 > 0;
      shards.position.set(2.05, cardY + 1.6, 0);
      shards.scale.setScalar(1.6);
      shards.children.forEach((m) => {
        const sd = m.userData.seed;
        const miss = sd % 5 === 0 ? blur : 0;
        m.material.opacity = s1 * (1 - miss * 0.9) * (0.75 + 0.25 * Math.sin(t * 7 + sd));
        m.position.copy(m.userData.home);
        m.position.x += blur * (noise3(sd, t * 0.8, 1) * 0.12);
        m.position.y += blur * (noise3(sd, t * 0.8, 5) * 0.12) - miss * 0.1;
        m.position.z = blur * (sd - 5) * 0.012;
        m.rotation.z = blur * noise3(sd, t, 9) * 0.25;
      });
      shot([[0, at(DIFF, 0, -1.2, 21.5), at(DIFF, 0, -1.0, 0)], [S.ending.t0 - S.differ.t0, at(DIFF, 0.5, -1.0, 20.8), at(DIFF, 0, -0.95, 0)]], lt);
      for (const [id, i] of [['coffee', 0], ['rain', 1], ['oud', 2]]) {
        showLabel(id, at(DIFF, (i - 1) * 2.05, -2.75, 0.6), ramp(t, S.differ.t0 + 0.4 + i * 0.15, 0.5), 0, 40);
      }
      chip.style.opacity = band(t, wordT('differ', 'ولا') + 0.2, S.ending.t0 + 0.2, 0.4);
      vig = 0.6;
    }

    // ---------------- overlay ----------------
    let vl = 0;
    for (const [c, hw] of VEILS) vl = Math.max(vl, 1 - Math.abs(t - c) / hw);
    const fl = band(t, flashT - 0.05, flashT + 0.7, 0.12);
    vl = Math.max(vl, (1 - fl) * band(t, flashT - 0.3, flashT + 0.95, 0.25));
    const endFade = ramp(t, TL.duration - 0.7, 0.7);
    veil.style.opacity = easeInOutCubic(clamp01(vl)) * 0.95;
    veil.style.background = endFade > 0 ? C.night : '';
    if (endFade > 0) veil.style.opacity = endFade;
    vignette.style.opacity = vig;
    grain.style.backgroundImage = grainUrls[Math.floor(t * cfg.fps) % grainUrls.length];

    // subtitles
    subSpans.forEach(({row, spans}, i) => {
      const c = chunks[i];
      const a = cfg.subtitles ? band(t, c.t0, c.t1, 0.12) : 0;
      row.style.opacity = a;
      row.style.display = a > 0 ? 'block' : 'none';
      if (a <= 0) return;
      row.style.transform = `translateY(${(1 - ramp(t, c.t0, 0.25)) * 14}px)`;
      spans.forEach((s, j) => {
        const w = c[j];
        s.className = t >= w.a - 0.04 ? (t < w.b + 0.06 ? 'now' : 'said') : '';
      });
    });

    st.render();
    return {};
  };

  return {
    render,
    resize() {
      st.resize();
    },
  };
});
