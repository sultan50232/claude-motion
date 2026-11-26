import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {runSim} from '../kit/runtime.js';
import {clamp01, lerp, smooth, rng} from '../kit/util.js';
import TL from './timeline.json';
import amiri700 from '@fontsource/amiri/files/amiri-arabic-700-normal.woff2';
import amiri400 from '@fontsource/amiri/files/amiri-arabic-400-normal.woff2';
import flagSvg from '../../node_modules/country-flag-icons/3x2/SA.svg';
import {initTextures, TEX, makeSky, lights, haram, person, OUTFITS, skinOf, plaza, palm, tree, lantern, glow, dust, mat, goldMat, ground, hill} from './world.js';

const DEFAULTS = {duration: TL.duration, fps: 30, hud: {enabled: false}, director: {enabled: false}, watermark: ''};

// ---------- camera helper: smooth path through keys over local time ----------
const V = (a) => new THREE.Vector3(...a);
function camPath(keys) {
  // keys: [{t, pos:[..], look:[..]}] in seconds of local scene time
  return (cam, t) => {
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1].t) i++;
    const a = keys[i];
    const b = keys[Math.min(i + 1, keys.length - 1)];
    const k = b.t === a.t ? 0 : smooth(clamp01((t - a.t) / (b.t - a.t)));
    cam.position.copy(V(a.pos).lerp(V(b.pos), k));
    cam.lookAt(V(a.look).lerp(V(b.look), k));
  };
}
// one continuous glide (no stop at mid keys): Catmull-Rom over positions
function glide(keys, dur) {
  const pc = new THREE.CatmullRomCurve3(keys.map((k) => V(k.pos)));
  const lc = new THREE.CatmullRomCurve3(keys.map((k) => V(k.look)));
  return (cam, t) => {
    const u = clamp01(t / dur);
    const e = u * u * (3 - 2 * u) * 0.35 + u * 0.65;
    cam.position.copy(pc.getPoint(e));
    cam.lookAt(lc.getPoint(e));
  };
}

function baseScene({fog = '#e6dccb', fogNear = 120, fogFar = 900, sky = {}, light = {}} = {}) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(fog, fogNear, fogFar);
  scene.add(makeSky(sky));
  const L = lights(scene, light);
  scene.environmentIntensity = 0.35;
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 9000);
  return {scene, camera, L};
}

// ---------- scenes ----------
const BUILD = {
  intro(env) {
    const s = baseScene({fog: '#efd9b4', fogNear: 300, fogFar: 2600, sky: {top: '#6f9ccf', mid: '#f4d6a0', bottom: '#e9c99a', sunDir: [-0.6, 0.18, -0.75]}, light: {sun: [-260, 200, -320], sunColor: '#ffd59a', sunI: 3.0, shadow: 220, mapSize: 4096}});
    const h = haram();
    s.scene.add(h.group);
    s.scene.environment = env;
    const cam = glide(
      [
        {pos: [560, 360, 700], look: [0, 40, 60]},
        {pos: [180, 210, 360], look: [0, 10, 10]},
        {pos: [-40, 120, 210], look: [0, 6, 0]},
        {pos: [-150, 70, 120], look: [0, 6, 0]},
      ],
      1,
    );
    return {
      ...s,
      update(t, d) {
        h.update(t + 40, 0);
        cam(s.camera, t / d);
      },
    };
  },

  greet(env) {
    const s = baseScene({fog: '#e4dccd', fogNear: 60, fogFar: 260, sky: {sunDir: [0.5, 0.25, -0.8]}, light: {sun: [40, 50, -60], sunI: 2.7, shadow: 30}});
    s.scene.environment = env;
    s.scene.add(plaza(5));
    const pairs = [
      [[-2.0, 0, 0.4], 0, 2, 3],
      [[0.5, 0, -1.8], 7, 1, 4],
      [[2.7, 0, 1.0], 9, 6, 5],
    ];
    const people = [];
    pairs.forEach(([p, oa, ob, sk], i) => {
      const a = person({outfit: OUTFITS[oa], skin: skinOf(sk), seed: i * 2 + 1, height: 1.72 + i * 0.04});
      const b = person({outfit: OUTFITS[ob], skin: skinOf(sk + 3), seed: i * 2 + 2, height: 1.66 + i * 0.05});
      a.root.position.set(p[0] - 0.55, 0, p[2]);
      b.root.position.set(p[0] + 0.55, 0, p[2]);
      a.root.rotation.y = Math.PI / 2 - 0.15;
      b.root.rotation.y = -Math.PI / 2 + 0.15;
      s.scene.add(a.root, b.root);
      people.push([a, b, i]);
    });
    const d1 = dust(220, [16, 6, 10], [0, 3, 0]);
    s.scene.add(d1.obj);
    const cam = camPath([
      {t: 0, pos: [-1.2, 1.55, 7.0], look: [0.2, 1.25, -0.2]},
      {t: 1, pos: [1.4, 1.65, 5.6], look: [0.5, 1.25, -0.2]},
    ]);
    return {
      ...s,
      update(t, d) {
        for (const [a, b, i] of people) {
          const ph = t - i * 0.6;
          const g = smooth(clamp01(ph / 0.9));
          a.pose({waveR: i === 1 ? g : 0, wavePhase: ph * 6, chestR: i !== 1 ? g : 0, nod: Math.sin(clamp01(ph / 1.6) * Math.PI) * 0.8});
          b.pose({chestR: smooth(clamp01((ph - 0.3) / 0.9)), nod: Math.sin(clamp01((ph - 0.4) / 1.6) * Math.PI) * 0.8, bow: Math.sin(clamp01((ph - 0.4) / 1.6) * Math.PI) * 0.25});
        }
        d1.update(t);
        cam(s.camera, t / d);
      },
    };
  },

  dignity(env) {
    const s = baseScene({fog: '#e4dccd', fogNear: 60, fogFar: 260, sky: {sunDir: [-0.4, 0.2, -0.9], mid: '#f6d6a2'}, light: {sun: [-40, 40, -70], sunI: 2.8, sunColor: '#ffd49a', shadow: 30}});
    s.scene.environment = env;
    s.scene.add(plaza(8, {palms: 12}));
    const elder = person({outfit: OUTFITS[11], skin: skinOf(5), seed: 21, height: 1.66});
    const young = person({outfit: OUTFITS[0], skin: skinOf(2), seed: 22, height: 1.78});
    const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.95, 6), mat('#5a3f28'));
    cane.position.set(0.28, 0.47, 0.25);
    cane.rotation.x = 0.15;
    elder.root.add(cane);
    s.scene.add(elder.root, young.root);
    // a woman helping a child
    const mom = person({outfit: OUTFITS[3], skin: skinOf(1), seed: 23, height: 1.64});
    const kid = person({outfit: OUTFITS[5], skin: skinOf(1), seed: 24, child: true});
    s.scene.add(mom.root, kid.root);
    const d1 = dust(200, [16, 6, 12], [0, 3, 0]);
    s.scene.add(d1.obj);
    const cam = camPath([
      {t: 0, pos: [4.5, 1.5, 6.5], look: [0.2, 1.1, 0]},
      {t: 1, pos: [3.0, 1.6, 4.8], look: [1.1, 1.1, -0.2]},
    ]);
    return {
      ...s,
      update(t, d) {
        const x = -1.4 + t * 0.32;
        elder.root.position.set(x, 0, 0);
        young.root.position.set(x - 0.05, 0, -0.55);
        elder.root.rotation.y = young.root.rotation.y = Math.PI / 2;
        elder.pose({walk: t * 4.2, walkAmp: 0.2, cane: 1, nod: 0.25 * Math.sin(t * 0.8)});
        young.pose({walk: t * 4.2 + Math.PI, walkAmp: 0.2, reachR: 0.55, turn: 0.45});
        young.J.shR.rotation.y = -0.4;
        mom.root.position.set(-3.6, 0, -3.2);
        kid.root.position.set(-3.0, 0, -3.15);
        mom.root.rotation.y = kid.root.rotation.y = 0.5;
        mom.pose({holdL: 0.9, turn: -0.4, walk: t * 3.6, walkAmp: 0.15});
        kid.pose({holdR: 1.3, walk: t * 5, walkAmp: 0.3});
        mom.root.position.x += t * 0.25;
        kid.root.position.x += t * 0.25;
        d1.update(t);
        cam(s.camera, t / d);
      },
    };
  },

  justice(env) {
    const s = baseScene({fog: '#ecd7b2', fogNear: 30, fogFar: 220, sky: {sunDir: [0.2, 0.15, -1], mid: '#f5d39b'}, light: {sun: [20, 30, -70], sunI: 2.5, shadow: 25}});
    s.scene.environment = env;
    s.scene.add(plaza(12, {palms: 10, radius: 20}));
    // scales of justice (hero)
    const sc = new THREE.Group();
    const G = goldMat();
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.8, 32), mat('#efe7d6', {roughness: 0.4}));
    ped.position.y = 0.4;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.2, 16), G);
    col.position.y = 2.4;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), G);
    knob.position.y = 4.1;
    sc.add(ped, col, knob);
    const beam = new THREE.Group();
    beam.position.y = 3.9;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.0, 12), G);
    bar.rotation.z = Math.PI / 2;
    beam.add(bar);
    sc.add(beam);
    const pans = [];
    for (const sd of [-1, 1]) {
      const hang = new THREE.Group();
      const pan = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 10, 0, Math.PI * 2, Math.PI * 0.6, Math.PI * 0.4), G);
      pan.material = G.clone();
      pan.material.side = THREE.DoubleSide;
      pan.position.y = -1.2;
      hang.add(pan);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.0, 4), G);
        ch.position.set(Math.cos(a) * 0.22, -0.55, Math.sin(a) * 0.22);
        ch.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
        hang.add(ch);
      }
      s.scene.add(hang);
      pans.push([hang, sd]);
    }
    sc.traverse((m) => m.isMesh && (m.castShadow = m.receiveShadow = true));
    s.scene.add(sc);
    const halo = glow('#ffe2a0', 7);
    halo.position.set(0, 3.9, -0.5);
    halo.material.opacity = 0.55;
    s.scene.add(halo);
    // people around in a semicircle
    const ring = [];
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.15 + (i / 6) * 0.7) + Math.PI;
      const p = person({outfit: OUTFITS[(i * 5) % OUTFITS.length], skin: skinOf(i * 3), seed: 40 + i, height: 1.62 + (i % 3) * 0.08});
      p.root.position.set(Math.cos(a) * 4.2, 0, -Math.sin(a) * 4.2 - 0.5);
      p.root.lookAt(0, 0, 0);
      s.scene.add(p.root);
      ring.push(p);
    }
    // mercy: an adult kneeling to a child
    const ad = person({outfit: OUTFITS[2], skin: skinOf(4), seed: 60, height: 1.66});
    const ch = person({outfit: OUTFITS[9], skin: skinOf(6), seed: 61, child: true});
    ad.root.position.set(2.6, 0, 2.2);
    ch.root.position.set(2.0, 0, 2.6);
    ad.root.rotation.y = -2.2;
    ch.root.rotation.y = 1.0;
    s.scene.add(ad.root, ch.root);
    const d1 = dust(260, [14, 7, 12], [0, 3.5, 0]);
    s.scene.add(d1.obj);
    const cam = camPath([
      {t: 0, pos: [0, 2.4, 9.5], look: [0, 2.6, 0]},
      {t: 1, pos: [3.6, 2.0, 7.0], look: [0.8, 2.0, 0.6]},
    ]);
    return {
      ...s,
      update(t, d) {
        const tilt = 0.32 * Math.exp(-t * 0.9) * Math.cos(t * 2.4);
        beam.rotation.z = tilt;
        for (const [hang, sd] of pans) hang.position.set(Math.cos(tilt) * 1.5 * sd, 3.9 + Math.sin(tilt) * 1.5 * sd, 0);
        ring.forEach((p, i) => p.pose({nod: 0.2 * Math.sin(t * 0.7 + i), turn: 0.1 * Math.sin(t * 0.5 + i)}));
        const k = smooth(clamp01((t - 0.3) / 1.2));
        ad.pose({sit: 0.55 * k, reachR: 0.7 * k, bow: 0.4 * k});
        ad.root.position.y = 0;
        ch.pose({reachL: 0.6 * k});
        d1.update(t);
        cam(s.camera, t / d);
      },
    };
  },

  tolerance(env) {
    const s = baseScene({fog: '#e4dccd', fogNear: 60, fogFar: 260, sky: {sunDir: [0.7, 0.2, -0.6]}, light: {sun: [60, 40, -50], sunI: 2.7, shadow: 30}});
    s.scene.environment = env;
    s.scene.add(plaza(17, {palms: 12}));
    const a = person({outfit: OUTFITS[1], skin: skinOf(2), seed: 71, height: 1.76});
    const b = person({outfit: OUTFITS[8], skin: skinOf(7), seed: 72, height: 1.8});
    s.scene.add(a.root, b.root);
    const by = [];
    [[OUTFITS[6], -2.4, -2.6, 0.4], [OUTFITS[4], 2.6, -2.8, -0.5], [OUTFITS[10], -3.4, -0.8, 1.0], [OUTFITS[3], 3.2, -1.0, -1.1]].forEach(([o, x, z, r], i) => {
      const p = person({outfit: o, skin: skinOf(i * 2 + 1), seed: 80 + i});
      p.root.position.set(x, 0, z);
      p.root.rotation.y = r;
      s.scene.add(p.root);
      by.push(p);
    });
    const cam = camPath([
      {t: 0, pos: [0.3, 1.25, 6.5], look: [0, 1.15, 0]},
      {t: 1, pos: [-0.6, 1.3, 4.0], look: [0, 1.15, 0]},
    ]);
    return {
      ...s,
      update(t, d) {
        const meet = 1.4;
        const u = clamp01(t / meet);
        const e = 1 - (1 - u) * (1 - u);
        a.root.position.set(-2.0 + e * 1.55, 0, 0);
        b.root.position.set(2.0 - e * 1.55, 0, 0);
        a.root.rotation.y = Math.PI / 2;
        b.root.rotation.y = -Math.PI / 2;
        const shake = smooth(clamp01((t - meet + 0.3) / 0.5));
        const pump = 0.06 * Math.sin(t * 9) * shake * (t < meet + 1.6 ? 1 : 0);
        a.pose({walk: u < 1 ? t * 6 : undefined, walkAmp: 0.35 * (1 - u), reachR: 0.62 * shake + pump, nod: 0.3 * shake});
        b.pose({walk: u < 1 ? t * 6 + 1 : undefined, walkAmp: 0.35 * (1 - u), reachR: 0.62 * shake + pump, nod: 0.3 * shake});
        a.J.shR.rotation.y = -0.35 * shake;
        b.J.shR.rotation.y = -0.35 * shake;
        by.forEach((p, i) => p.pose({nod: 0.15 * Math.sin(t + i), chestR: i % 2 ? smooth(clamp01((t - 2 - i * 0.3) / 0.8)) : 0}));
        cam(s.camera, t / d);
      },
    };
  },

  dialogue(env) {
    const s = baseScene({fog: '#e8c89a', fogNear: 30, fogFar: 200, sky: {sunDir: [-0.8, 0.08, -0.5], mid: '#f2b97a', top: '#6b86b8'}, light: {sun: [-70, 20, -40], sunI: 2.0, sunColor: '#ffbe7a', shadow: 20, hemiI: 1.2}});
    s.scene.environment = env;
    s.scene.add(plaza(21, {palms: 8, radius: 16}));
    // carpet
    const rugTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 512;
      const g = c.getContext('2d');
      g.fillStyle = '#7a2230';
      g.fillRect(0, 0, 512, 512);
      g.strokeStyle = '#d8b56a';
      g.lineWidth = 10;
      g.strokeRect(24, 24, 464, 464);
      g.fillStyle = '#1f4f3d';
      g.fillRect(48, 48, 416, 416);
      g.strokeStyle = '#d8b56a';
      g.lineWidth = 4;
      for (let r = 40; r < 200; r += 40) {
        g.save();
        g.translate(256, 256);
        g.rotate(Math.PI / 4);
        g.strokeRect(-r, -r, 2 * r, 2 * r);
        g.restore();
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const rug = new THREE.Mesh(new THREE.CircleGeometry(3.2, 64), mat('#ffffff', {map: rugTex, roughness: 0.95}));
    rug.rotation.x = -Math.PI / 2;
    rug.position.y = 0.01;
    rug.receiveShadow = true;
    s.scene.add(rug);
    // low table, coffee pot, cups
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.12, 32), mat('#6b4a2e', {roughness: 0.5}));
    table.position.y = 0.32;
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.28, 24), mat('#5a3d26'));
    legs.position.y = 0.14;
    const pot = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.12, 0.02), new THREE.Vector2(0.13, 0.12), new THREE.Vector2(0.06, 0.22), new THREE.Vector2(0.07, 0.3), new THREE.Vector2(0.03, 0.36), new THREE.Vector2(0, 0.38)], 20), goldMat());
    pot.position.y = 0.38;
    s.scene.add(table, legs, pot);
    for (let i = 0; i < 6; i++) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.05, 10), mat('#f4efe4'));
      const a = (i / 6) * Math.PI * 2;
      cup.position.set(Math.cos(a) * 0.45, 0.41, Math.sin(a) * 0.45);
      s.scene.add(cup);
    }
    [table, legs, pot].forEach((m) => (m.castShadow = m.receiveShadow = true));
    const seated = [];
    const outfits = [0, 3, 7, 9, 2, 5];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const p = person({outfit: OUTFITS[outfits[i]], skin: skinOf(i * 3 + 1), seed: 90 + i, height: 1.72});
      p.root.position.set(Math.cos(a) * 1.75, 0.0, Math.sin(a) * 1.75);
      p.root.lookAt(0, 0, 0);
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.6), mat(i % 2 ? '#b08a4a' : '#2a5c45'));
      cushion.position.set(Math.cos(a) * 1.8, 0.08, Math.sin(a) * 1.8);
      cushion.rotation.y = -a;
      cushion.castShadow = cushion.receiveShadow = true;
      s.scene.add(p.root, cushion);
      seated.push(p);
    }
    const lamps = [];
    for (let i = 0; i < 4; i++) {
      const l = lantern();
      const a = (i / 4) * Math.PI * 2 + 0.8;
      l.position.set(Math.cos(a) * 4.2, 0, Math.sin(a) * 4.2);
      s.scene.add(l);
      const gl = glow('#ffcf7a', 1.6);
      gl.position.set(l.position.x, 3.45, l.position.z);
      s.scene.add(gl);
      lamps.push(l);
    }
    lamps.forEach((l) => (l.getObjectByName('lamp').material.emissiveIntensity = 2.0));
    const cam = glide(
      [
        {pos: [5.5, 2.6, 4.5], look: [0, 0.75, 0]},
        {pos: [2.0, 2.2, 6.2], look: [0, 0.75, 0]},
        {pos: [-2.4, 2.0, 5.6], look: [0, 0.7, 0]},
      ],
      1,
    );
    return {
      ...s,
      update(t, d) {
        const speaker = Math.floor(t / 1.1) % 6;
        seated.forEach((p, i) => {
          const sp = i === speaker;
          p.pose({sit: 1, talk: sp ? t * 3 : 0, nod: sp ? 0 : 0.25 + 0.15 * Math.sin(t * 2 + i), bow: 0.15});
          p.root.position.y = 0.16;
        });
        cam(s.camera, t / d);
      },
    };
  },

  coop(env) {
    const s = baseScene({fog: '#efdcbc', fogNear: 40, fogFar: 260, sky: {sunDir: [0.3, 0.3, -0.9]}, light: {sun: [30, 60, -60], sunI: 2.8, shadow: 30}});
    s.scene.environment = env;
    s.scene.add(plaza(25, {palms: 10, radius: 20}));
    // a van
    const van = new THREE.Group();
    const vb = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.9, 4.2), mat('#f4f1ea', {roughness: 0.35, metalness: 0.2}));
    vb.position.y = 1.35;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.25, 4.22), mat('#1f6b4a'));
    stripe.position.y = 1.1;
    van.add(vb, stripe);
    for (const [x, z] of [[-1, -1.3], [1, -1.3], [-1, 1.3], [1, 1.3]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.25, 16), mat('#222'));
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.38, z);
      van.add(w);
    }
    van.position.set(4.6, 0, -0.5);
    van.traverse((m) => m.isMesh && (m.castShadow = m.receiveShadow = true));
    s.scene.add(van);
    // the chain: 5 volunteers in green vests
    const chain = [];
    const xs = [-3.4, -2.2, -1.0, 0.2, 1.4, 2.6];
    xs.forEach((x, i) => {
      const o = {...OUTFITS[[7, 2, 0, 4, 3, 8][i]]};
      const p = person({outfit: o, skin: skinOf(i * 2 + 2), seed: 110 + i, height: 1.66 + (i % 3) * 0.06});
      const vest = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.3, 3, 12), mat('#2f8a5a', {roughness: 0.7}));
      vest.position.y = 0.33;
      vest.scale.set(1.12, 1, 0.8);
      p.J.torso.add(vest);
      p.root.position.set(x, 0, (i % 2 ? 0.35 : -0.35));
      p.root.rotation.y = i % 2 ? Math.PI : 0;
      s.scene.add(p.root);
      chain.push(p);
    });
    // box pile
    const boxM = mat('#c79a5c', {roughness: 0.8});
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.45), boxM);
      b.position.set(-4.4 + (i % 3) * 0.52, 0.2 + Math.floor(i / 3) * 0.41, -0.2 + ((i * 7) % 3) * 0.05);
      b.castShadow = b.receiveShadow = true;
      s.scene.add(b);
    }
    const moving = [];
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.45), boxM);
      b.castShadow = true;
      s.scene.add(b);
      moving.push(b);
    }
    // a heart-shaped green sign is too literal; a small seedling bed in front instead
    const bed = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 1.2), mat('#7a5a3c'));
    bed.position.set(-0.6, 0.15, -2.4);
    s.scene.add(bed);
    for (let i = 0; i < 7; i++) {
      const sp = tree(130 + i, 0.25);
      sp.position.set(-2.3 + i * 0.58, 0.3, -2.4);
      s.scene.add(sp);
    }
    const path = [[-4.0, 1.0], ...xs.map((x) => [x, 1.25]), [4.0, 1.4]];
    const along = (u) => {
      const f = u * (path.length - 1);
      const i = Math.min(Math.floor(f), path.length - 2);
      const k = f - i;
      return [lerp(path[i][0], path[i + 1][0], k), lerp(path[i][1], path[i + 1][1], k) + Math.sin(k * Math.PI) * 0.15];
    };
    const cam = camPath([
      {t: 0, pos: [-1.5, 2.4, 8.5], look: [0, 1.0, 0]},
      {t: 1, pos: [2.0, 2.0, 7.0], look: [0.8, 1.0, 0]},
    ]);
    return {
      ...s,
      update(t, d) {
        const speed = 0.11;
        const hold = [];
        moving.forEach((b, i) => {
          const u = (t * speed + i / moving.length) % 1;
          const [x, y] = along(u);
          b.position.set(x, y, 0);
          b.rotation.y = Math.sin(u * 20) * 0.1;
          hold.push(x);
        });
        chain.forEach((p, i) => {
          const x = xs[i];
          let near = 0;
          for (const hx of hold) near = Math.max(near, 1 - Math.min(1, Math.abs(hx - x) / 0.7));
          p.pose({carry: 0.5 + 0.5 * smooth(near), bow: 0.1 * near});
          p.root.rotation.y = (i % 2 ? Math.PI : 0) + (i % 2 ? 1 : -1) * 0.0;
        });
        cam(s.camera, t / d);
      },
    };
  },

  diversity(env) {
    const s = baseScene({fog: '#e4dccd', fogNear: 60, fogFar: 300, sky: {sunDir: [-0.3, 0.25, -0.9], mid: '#f6dcae'}, light: {sun: [-30, 60, -60], sunI: 2.6, shadow: 25}});
    s.scene.environment = env;
    s.scene.add(plaza(31, {palms: 14, radius: 22}));
    // globe with gold meridians
    const globe = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(1.5, 48, 32), new THREE.MeshStandardMaterial({color: '#1f6b4a', roughness: 0.35, metalness: 0.2, emissive: '#0c3a28', emissiveIntensity: 0.3}));
    globe.add(core);
    const G = goldMat();
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(1.53, 0.012, 6, 96), G);
      m.rotation.y = (i / 8) * Math.PI;
      globe.add(m);
    }
    for (let i = -3; i <= 3; i++) {
      const lat = (i / 4) * (Math.PI / 2);
      const m = new THREE.Mesh(new THREE.TorusGeometry(1.53 * Math.cos(lat), 0.012, 6, 96), G);
      m.rotation.x = Math.PI / 2;
      m.position.y = 1.53 * Math.sin(lat);
      globe.add(m);
    }
    globe.position.y = 2.6;
    s.scene.add(globe);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 1.0, 32), mat('#efe7d6', {roughness: 0.4}));
    ped.position.y = 0.5;
    ped.castShadow = ped.receiveShadow = true;
    s.scene.add(ped);
    const halo = glow('#ffe7a8', 7);
    halo.position.copy(globe.position);
    halo.material.opacity = 0.5;
    s.scene.add(halo);
    const ring = [];
    const N = 12;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const p = person({outfit: OUTFITS[i % OUTFITS.length], skin: skinOf(i * 5), seed: 150 + i, height: 1.62 + ((i * 3) % 4) * 0.05});
      p.root.position.set(Math.cos(a) * 3.0, 0, Math.sin(a) * 3.0);
      p.root.lookAt(0, 0, 0);
      s.scene.add(p.root);
      ring.push(p);
    }
    const d1 = dust(320, [14, 7, 14], [0, 3.5, 0]);
    s.scene.add(d1.obj);
    return {
      ...s,
      update(t, d) {
        globe.rotation.y = t * 0.25;
        const k = smooth(clamp01((t - 0.2) / 1.2));
        ring.forEach((p) => p.pose({holdL: 1.15 * k, holdR: 1.15 * k}));
        d1.update(t);
        const a = 0.9 + (t / d) * 1.1;
        const r = lerp(9.5, 7.5, t / d);
        s.camera.position.set(Math.cos(a) * r, lerp(4.2, 2.6, t / d), Math.sin(a) * r);
        s.camera.lookAt(0, 1.7, 0);
      },
    };
  },

  together(env) {
    const s = baseScene({fog: '#e4dccd', fogNear: 60, fogFar: 300, sky: {sunDir: [0.1, 0.12, -1], mid: '#f7cf91', top: '#7f9fcc'}, light: {sun: [10, 30, -80], sunI: 2.6, sunColor: '#ffcf8c', shadow: 30}});
    s.scene.environment = env;
    s.scene.add(plaza(41, {palms: 10, radius: 24}));
    // central planter + growing tree
    const planter = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.5, 40), mat('#e2d5ba'));
    planter.position.y = 0.25;
    planter.castShadow = planter.receiveShadow = true;
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.05, 40), mat('#5b4330'));
    soil.position.y = 0.5;
    s.scene.add(planter, soil);
    const tr = tree(201, 1);
    tr.position.y = 0.5;
    s.scene.add(tr);
    const halo = glow('#ffe1a0', 8);
    halo.position.set(0, 3.2, 0);
    s.scene.add(halo);
    const walkers = [];
    const N = 8;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + 0.2;
      const p = person({outfit: OUTFITS[(i * 7 + 2) % OUTFITS.length], skin: skinOf(i * 3 + 2), seed: 210 + i, height: 1.64 + (i % 3) * 0.06});
      s.scene.add(p.root);
      walkers.push({p, a, from: 11 + (i % 3), to: 2.4});
    }
    const d1 = dust(260, [14, 8, 14], [0, 4, 0]);
    s.scene.add(d1.obj);
    return {
      ...s,
      update(t, d) {
        walkers.forEach(({p, a, from, to}, i) => {
          const u = clamp01((t - i * 0.12) / (d * 0.55));
          const e = 1 - Math.pow(1 - u, 2);
          const r = lerp(from, to, e);
          p.root.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
          p.root.lookAt(0, 0, 0);
          const arrived = smooth(clamp01((u - 0.9) / 0.1));
          p.pose({walk: u < 1 ? t * 6 + i : undefined, walkAmp: 0.4 * (1 - arrived), reachR: 0.5 * arrived, reachL: 0.5 * arrived});
        });
        const g = smooth(clamp01((t - d * 0.35) / (d * 0.55)));
        tr.scale.setScalar(0.08 + g * 0.95);
        halo.material.opacity = 0.15 + 0.6 * g;
        halo.scale.setScalar(4 + 6 * g);
        d1.update(t);
        const a = -1.2 + (t / d) * 0.6;
        const r = lerp(16, 9.5, smooth(t / d));
        s.camera.position.set(Math.cos(a) * r, lerp(7, 3.4, smooth(t / d)), Math.sin(a) * r);
        s.camera.lookAt(0, 1.6 + g * 0.8, 0);
      },
    };
  },

  city(env) {
    const s = baseScene({fog: '#c9a58e', fogNear: 120, fogFar: 1100, sky: {top: '#3c4f86', mid: '#f0a774', bottom: '#d99a7a', sunDir: [0.6, 0.03, -0.8], sunColor: '#ffc38a', glow: 0.8}, light: {sun: [300, 40, -400], sunI: 1.8, sunColor: '#ffb27a', hemiSky: '#9fb2e0', hemiGround: '#8a6a5a', hemiI: 1.1, shadow: 160, mapSize: 4096}});
    s.scene.environment = env;
    const R = rng(301);
    s.scene.add(ground(3000, TEX.paving, '#cdbfa6', 300));
    // park in the middle
    const park = new THREE.Mesh(new THREE.PlaneGeometry(90, 60), mat('#ffffff', {map: TEX.grass}));
    park.rotation.x = -Math.PI / 2;
    park.position.y = 0.05;
    park.receiveShadow = true;
    s.scene.add(park);
    for (let i = 0; i < 26; i++) {
      const tr = i % 3 ? tree(400 + i, 1.4) : palm(400 + i, 9);
      tr.position.set((R() - 0.5) * 84, 0, (R() - 0.5) * 54);
      s.scene.add(tr);
    }
    // blocks on a grid with lit windows
    const day = mat('#f0e2cc', {map: TEX.windowsDay, emissive: '#ffffff', emissiveMap: TEX.windowsNight, emissiveIntensity: 0.45, roughness: 0.7});
    const geos = [];
    const {mergeGeometries} = THREE_UTILS;
    for (let gx = -8; gx <= 8; gx++)
      for (let gz = -8; gz <= 8; gz++) {
        if (Math.abs(gx) <= 1 && Math.abs(gz) <= 1) continue;
        const cx = gx * 40;
        const cz = gz * 40;
        const dd = Math.hypot(gx, gz);
        for (let k = 0; k < 2; k++) {
          const w = 12 + R() * 12;
          const h = 10 + R() * (dd < 4 ? 40 : 70) + (R() < 0.06 ? 80 : 0);
          const b = new THREE.BoxGeometry(w, h, 12 + R() * 12);
          b.translate(cx + (k ? 8 : -8) + (R() - 0.5) * 4, h / 2, cz + (R() - 0.5) * 10);
          geos.push(b);
        }
      }
    const blocks = new THREE.Mesh(mergeGeometries(geos), day);
    blocks.castShadow = blocks.receiveShadow = true;
    s.scene.add(blocks);
    // street lights along the park
    const lamps = new THREE.Group();
    for (let i = 0; i < 24; i++) {
      const l = lantern();
      const side = i % 4;
      const k = Math.floor(i / 4) / 5;
      const pos = [[lerp(-46, 46, k), -32], [lerp(-46, 46, k), 32], [-48, lerp(-30, 30, k)], [48, lerp(-30, 30, k)]][side];
      l.position.set(pos[0], 0, pos[1]);
      l.scale.setScalar(1.6);
      l.getObjectByName('lamp').material.emissiveIntensity = 2.2;
      lamps.add(l);
      const gl = glow('#ffcf80', 4);
      gl.position.set(pos[0], 5.5, pos[1]);
      lamps.add(gl);
    }
    s.scene.add(lamps);
    // families strolling in the park
    const walkers = [];
    for (let i = 0; i < 14; i++) {
      const p = person({outfit: OUTFITS[(i * 5) % OUTFITS.length], skin: skinOf(i), seed: 500 + i, child: i % 5 === 4});
      s.scene.add(p.root);
      walkers.push({p, r: 12 + (i % 7) * 3.2, a: R() * 6.28, w: (0.25 + R() * 0.1) / (12 + (i % 7) * 3.2)});
    }
    const cam = glide(
      [
        {pos: [-230, 95, 250], look: [60, 25, -200]},
        {pos: [-110, 55, 140], look: [40, 10, -120]},
        {pos: [-55, 18, 62], look: [10, 4, -30]},
      ],
      1,
    );
    return {
      ...s,
      update(t, d) {
        walkers.forEach(({p, r, a, w}, i) => {
          const ang = a + w * t * 4;
          p.root.position.set(Math.cos(ang) * r * 1.3, 0, Math.sin(ang) * r * 0.8);
          p.root.rotation.y = -ang;
          p.pose({walk: t * 5 + i, walkAmp: 0.35});
          p.root.scale.setScalar(i % 5 === 4 ? 0.62 * 1.6 : 1.6);
        });
        cam(s.camera, t / d);
      },
    };
  },

  finale(env) {
    const s = baseScene({fog: '#26304a', fogNear: 300, fogFar: 2600, sky: {top: '#0d1630', mid: '#2c3c66', bottom: '#3a3a52', sunDir: [0.2, 0.3, -1], sunColor: '#e8eeff', sunSize: 0.99995, glow: 0.25, stars: 0.8}, light: {sun: [-120, 220, -160], sunColor: '#aab8e8', sunI: 0.9, hemiSky: '#5a6aa0', hemiGround: '#3a3040', hemiI: 0.9, shadow: 220, mapSize: 2048}});
    s.scene.environment = env;
    const h = haram();
    s.scene.add(h.group);
    // warm floodlight on the mataf
    const spot = new THREE.PointLight('#ffe2b0', 900, 200, 1.8);
    spot.position.set(0, 90, 0);
    s.scene.add(spot);
    const fl = new THREE.PointLight('#fff0d0', 300, 160, 1.8);
    fl.position.set(80, 60, 80);
    s.scene.add(fl);
    const ct = new THREE.PointLight('#d6ffd8', 30000, 400, 1.4);
    ct.position.set(40, 300, 230);
    s.scene.add(ct);
    const cam = glide(
      [
        {pos: [-60, 60, 250], look: [20, 70, 0]},
        {pos: [-110, 85, 200], look: [10, 30, 0]},
        {pos: [-170, 120, 150], look: [0, 15, 0]},
      ],
      1,
    );
    return {
      ...s,
      update(t, d) {
        h.update(t + 90, 1);
        cam(s.camera, t / d);
      },
    };
  },

  flag(env, assets) {
    const s = baseScene({fog: '#e9c79a', fogNear: 200, fogFar: 2000, sky: {top: '#5f8fcb', mid: '#f6d6a0', bottom: '#f0c890', sunDir: [0.55, 0.16, -0.8], glow: 0.8}, light: {sun: [80, 40, -60], sunI: 2.8, sunColor: '#ffd9a0', shadow: 20}});
    s.scene.environment = env;
    // distant Makkah silhouette on the horizon
    const h = haram(13);
    h.group.position.set(-500, -14, -1700);
    h.group.scale.setScalar(1.2);
    s.scene.add(h.group);
    const W = 6, H = 4, nx = 72, ny = 48;
    const geo = new THREE.PlaneGeometry(W, H, nx, ny);
    geo.translate(W / 2, 0, 0);
    const base = geo.attributes.position.array.slice();
    const flagMat = new THREE.MeshStandardMaterial({map: assets.flagTex, side: THREE.DoubleSide, roughness: 0.75});
    const flag = new THREE.Mesh(geo, flagMat);
    flag.castShadow = true;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 16, 16), new THREE.MeshStandardMaterial({color: '#e9e6df', metalness: 0.8, roughness: 0.3}));
    pole.position.set(0, -6, 0);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), goldMat());
    finial.position.y = 2.05;
    const fg = new THREE.Group();
    flag.position.y = 0;
    fg.add(flag, pole, finial);
    fg.position.set(-2.2, 7.5, 0);
    s.scene.add(fg);
    const cam = camPath([
      {t: 0, pos: [3.5, 4.2, 12], look: [0.8, 7.0, 0]},
      {t: 1, pos: [2.2, 5.2, 10.4], look: [0.7, 7.2, 0]},
    ]);
    const pos = geo.attributes.position;
    return {
      ...s,
      update(t, d) {
        h.update(t, 0);
        for (let i = 0; i < pos.count; i++) {
          const x = base[i * 3];
          const y = base[i * 3 + 1];
          const k = x / W;
          const z = k * (0.42 * Math.sin(x * 1.25 - t * 4.2 + y * 0.25) + 0.16 * Math.sin(x * 2.9 - t * 6.1 + y * 0.9));
          const sag = -k * k * 0.12;
          pos.setXYZ(i, x - k * 0.06 * (1 + Math.sin(t * 3 + x)), y + sag + 0.05 * k * Math.sin(x * 2 - t * 5), z);
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
        cam(s.camera, t / d);
      },
    };
  },
};
let THREE_UTILS = null;

// ---------- titles (DOM) ----------
function makeTitles(app) {
  const layer = document.createElement('div');
  layer.className = 'titles';
  app.appendChild(layer);
  const els = TL.titles.map((tt) => {
    const el = document.createElement('div');
    el.className = `title ${tt.style || 'chip'}`;
    el.innerHTML = tt.lines.map((l, i) => `<div class="l l${i}">${l}</div>`).join('');
    layer.appendChild(el);
    return {el, ...tt};
  });
  return (t) => {
    for (const x of els) {
      const fin = clamp01((t - x.start) / 0.9);
      const fout = clamp01((x.end - t) / 0.7);
      const o = smooth(Math.min(fin, fout));
      x.el.style.opacity = o.toFixed(3);
      x.el.style.transform = `translate(-50%, ${((1 - smooth(fin)) * 1.2).toFixed(3)}rem)`;
      x.el.style.filter = `blur(${((1 - smooth(fin)) * 0.6).toFixed(2)}rem)`;
      x.el.style.setProperty('--rule', smooth(clamp01((t - x.start - 0.3) / 1.0)).toFixed(3));
      x.el.style.display = o > 0.001 ? 'block' : 'none';
    }
  };
}

// ---------- compositor ----------
const POST = {
  uniforms: {a: {value: null}, b: {value: null}, mixv: {value: 0}, time: {value: 0}, fade: {value: 1}, res: {value: new THREE.Vector2(1, 1)}},
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    uniform sampler2D a, b; uniform float mixv, time, fade; uniform vec2 res; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec3 ca = texture2D(a, vUv).rgb;
      vec3 cb = texture2D(b, vUv).rgb;
      // soft light-leak dissolve: brighten slightly through the middle of the mix
      float m = smoothstep(0.0, 1.0, mixv);
      vec3 c = mix(ca, cb, m);
      c += vec3(1.0, 0.86, 0.6) * 0.10 * sin(3.14159 * m);
      // gentle grade: warm highlights, lifted shadows
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c, c * vec3(1.03, 1.0, 0.95), smoothstep(0.4, 1.0, l));
      c = c * 0.97 + 0.015;
      // vignette
      vec2 q = vUv - 0.5; q.x *= res.x / res.y;
      c *= mix(1.0, 0.78, smoothstep(0.35, 1.05, length(q)));
      // fine grain
      c += (h(vUv * res + fract(time) * 91.7) - 0.5) * 0.018;
      gl_FragColor = vec4(c * fade, 1.0);
    }`,
};

runSim(DEFAULTS, async ({cfg, canvas}) => {
  for (const [w, src] of [[700, amiri700], [400, amiri400]]) {
    const ff = new FontFace('Amiri', `url(${src})`, {weight: String(w)});
    await ff.load();
    document.fonts.add(ff);
  }
  THREE_UTILS = await import('three/addons/utils/BufferGeometryUtils.js');
  initTextures();
  // flag texture from the vector flag (accurate shahada and sword)
  const flagTex = await new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 2052;
      c.height = 1368;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      res(t);
    };
    img.src = flagSvg;
  });

  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true});
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;

  const scenes = TL.scenes.map((sc) => ({...sc, inst: BUILD[sc.kind](env, {flagTex})}));
  const mk = () => new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 4});
  const rtA = mk();
  const rtB = mk();
  const post = new THREE.ShaderMaterial({...POST, uniforms: THREE.UniformsUtils.clone(POST.uniforms)});
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
  const pscene = new THREE.Scene();
  pscene.add(quad);
  const pcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const titles = makeTitles(document.getElementById('app'));

  const resize = () => {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    const pr = capture ? devicePixelRatio : Math.min(devicePixelRatio, 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    rtA.setSize(w * pr, h * pr);
    rtB.setSize(w * pr, h * pr);
    post.uniforms.res.value.set(w * pr, h * pr);
    for (const s of scenes) {
      s.inst.camera.aspect = w / h;
      s.inst.camera.updateProjectionMatrix();
    }
  };
  const capture = !!window.__CAPTURE;
  const XF = TL.xfade;
  const drawScene = (s, t, rt) => {
    const lt = t - s.start + XF;
    s.inst.update(Math.max(0, lt), s.end - s.start + XF);
    // shadow maps are shared state: force refresh per scene
    renderer.setRenderTarget(rt);
    renderer.render(s.inst.scene, s.inst.camera);
  };
  return {
    resize,
    render(t) {
      // active scene: the last whose start <= t; incoming crossfade over XF before its start
      let i = 0;
      while (i < scenes.length - 1 && t >= scenes[i + 1].start) i++;
      const cur = scenes[i];
      const nxt = scenes[i + 1];
      const m = nxt ? clamp01((t - (nxt.start - XF)) / XF) : 0;
      drawScene(cur, t, rtA);
      if (m > 0) drawScene(nxt, t, rtB);
      post.uniforms.a.value = rtA.texture;
      post.uniforms.b.value = m > 0 ? rtB.texture : rtA.texture;
      post.uniforms.mixv.value = m;
      post.uniforms.time.value = t;
      post.uniforms.fade.value = Math.min(smooth(clamp01(t / 1.2)), smooth(clamp01((cfg.duration - t) / 1.5)));
      renderer.setRenderTarget(null);
      renderer.render(pscene, pcam);
      titles(t);
      return {};
    },
  };
});
