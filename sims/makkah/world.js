import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng} from '../kit/util.js';

export const PAL = {
  gold: '#c9a24a',
  goldHi: '#f1d58a',
  white: '#f6f1e6',
  stone: '#e8dfcc',
  green: '#1f6b4a',
  greenDeep: '#0f4a33',
  ink: '#151515',
};

// ---------- sky ----------
export function makeSky({top = '#7aa7d6', mid = '#f3d9a8', bottom = '#f7e7c4', sunDir = [0.3, 0.12, -1], sunColor = '#fff1cf', sunSize = 0.9996, glow = 0.6, stars = 0} = {}) {
  const geo = new THREE.SphereGeometry(4000, 48, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: {value: new THREE.Color(top)},
      mid: {value: new THREE.Color(mid)},
      bottom: {value: new THREE.Color(bottom)},
      sunDir: {value: new THREE.Vector3(...sunDir).normalize()},
      sunColor: {value: new THREE.Color(sunColor)},
      sunSize: {value: sunSize},
      glow: {value: glow},
      stars: {value: stars},
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `
      uniform vec3 top, mid, bottom, sunDir, sunColor; uniform float sunSize, glow, stars; varying vec3 vDir;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
      void main(){
        float y = vDir.y;
        vec3 c = y > 0.0 ? mix(mid, top, pow(clamp(y*1.6,0.0,1.0), 0.7)) : mix(mid, bottom, clamp(-y*4.0,0.0,1.0));
        float d = max(dot(normalize(vDir), sunDir), 0.0);
        c += sunColor * (pow(d, 12.0)*0.35*glow + pow(d, 200.0)*0.6*glow);
        c = mix(c, sunColor*1.6, smoothstep(sunSize, sunSize+0.0002, d));
        if (stars > 0.0 && y > 0.05) {
          vec3 q = floor(vDir*420.0);
          float s = step(0.9965, h(q));
          c += vec3(s) * stars * smoothstep(0.05, 0.4, y) * (0.5+0.5*h(q+1.0));
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = -10;
  m.frustumCulled = false;
  return m;
}

export function lights(scene, {sun = [120, 160, 80], sunColor = '#ffe2b0', sunI = 2.2, hemiSky = '#cfe0ff', hemiGround = '#b89a72', hemiI = 0.55, shadow = 120, mapSize = 2048} = {}) {
  const hemi = new THREE.HemisphereLight(hemiSky, hemiGround, hemiI);
  scene.add(hemi);
  const d = new THREE.DirectionalLight(sunColor, sunI);
  d.position.set(...sun);
  if (shadow) {
    d.castShadow = true;
    d.shadow.mapSize.set(mapSize, mapSize);
    const c = d.shadow.camera;
    c.left = c.bottom = -shadow;
    c.right = c.top = shadow;
    c.near = 1;
    c.far = 1200;
    d.shadow.bias = -0.0004;
    d.shadow.normalBias = 0.6;
    d.shadow.radius = 3;
  }
  scene.add(d);
  scene.add(d.target);
  return {hemi, sun: d};
}

// ---------- textures ----------
const canvasTex = (w, h, draw, repeat = [1, 1]) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  return t;
};

export const TEX = {};
export function initTextures() {
  const R = rng(7);
  // marble tiles
  TEX.marble = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#efe9dc';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(150,140,120,${R() * 0.05})`;
      g.beginPath();
      g.arc(R() * w, R() * h, R() * 18, 0, 7);
      g.fill();
    }
    g.strokeStyle = 'rgba(160,145,115,0.35)';
    g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath();
      g.moveTo(0, (i * h) / 4);
      g.lineTo(w, (i * h) / 4);
      g.moveTo((i * w) / 4, 0);
      g.lineTo((i * w) / 4, h);
      g.stroke();
    }
  });
  // arcade facade: rows of arches
  TEX.arcade = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#ece3d0';
    g.fillRect(0, 0, w, h);
    const rows = 2;
    for (let r = 0; r < rows; r++) {
      const y0 = (r * h) / rows;
      const rh = h / rows;
      g.fillStyle = '#3a3128';
      const aw = w * 0.56;
      const ax = (w - aw) / 2;
      g.beginPath();
      g.moveTo(ax, y0 + rh * 0.92);
      g.lineTo(ax, y0 + rh * 0.42);
      g.quadraticCurveTo(w / 2, y0 + rh * 0.02, ax + aw, y0 + rh * 0.42);
      g.lineTo(ax + aw, y0 + rh * 0.92);
      g.fill();
      g.fillStyle = 'rgba(255,214,140,0.25)';
      g.fillRect(ax + 6, y0 + rh * 0.55, aw - 12, rh * 0.37);
      g.fillStyle = '#d8ccb2';
      g.fillRect(0, y0 + rh * 0.92, w, rh * 0.08);
    }
  });
  // gold geometric band (8-point star lattice, no lettering)
  TEX.band = canvasTex(512, 64, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#8a6a22');
    grd.addColorStop(0.5, '#e8c873');
    grd.addColorStop(1, '#8a6a22');
    g.fillStyle = '#16130f';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = grd;
    g.lineWidth = 3;
    g.strokeRect(2, 4, w - 4, h - 8);
    for (let x = 32; x < w; x += 64) {
      g.save();
      g.translate(x, h / 2);
      for (let k = 0; k < 2; k++) {
        g.rotate(Math.PI / 4);
        g.strokeRect(-14, -14, 28, 28);
      }
      g.restore();
      g.beginPath();
      g.moveTo(x + 22, h / 2);
      g.lineTo(x + 42, h / 2);
      g.stroke();
    }
  }, [4, 1]);
  // kiswa: black with faint woven sheen
  TEX.kiswa = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#0d0d0e';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.035)';
    for (let i = 0; i < w; i += 16) {
      g.beginPath();
      g.moveTo(i, 0);
      g.bezierCurveTo(i + 8, h * 0.3, i - 8, h * 0.6, i, h);
      g.stroke();
    }
  }, [3, 3]);
  // windows for city buildings
  const win = (lit) =>
    canvasTex(128, 256, (g, w, h) => {
      g.fillStyle = lit ? '#3a3640' : '#e4d8c2';
      g.fillRect(0, 0, w, h);
      const r2 = rng(lit ? 3 : 4);
      for (let y = 6; y < h - 6; y += 12)
        for (let x = 6; x < w - 6; x += 14) {
          const on = r2() < 0.45;
          g.fillStyle = lit ? (on ? `rgba(255,${200 + r2() * 30},${130 + r2() * 40},0.9)` : '#2a2830') : `rgba(120,${130 + r2() * 10},140,0.55)`;
          g.fillRect(x, y, 7, 7);
        }
      if (!lit) { g.fillStyle = 'rgba(255,255,255,0.18)'; for (let y = 0; y < h; y += 12) g.fillRect(0, y + 14 - 2, w, 1); }
    });
  TEX.windowsDay = win(false);
  TEX.windowsNight = win(true);
  TEX.grass = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#6f8f4e';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = `rgba(${60 + R() * 40},${110 + R() * 50},${40 + R() * 20},0.5)`;
      g.fillRect(R() * w, R() * h, 2, 3);
    }
  }, [20, 20]);
  TEX.paving = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b9ad98';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32)
      for (let x = 0; x < w; x += 64) {
        const off = (y / 32) % 2 ? 32 : 0;
        const v = R() * 14;
        g.fillStyle = `rgb(${206 + v},${196 + v},${178 + v})`;
        g.fillRect(x + off + 1, y + 1, 62, 30);
        g.fillRect(x + off + 1 - 64, y + 1, 62, 30);
      }
  }, [30, 30]);
}

export const mat = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.75, metalness: 0, ...o});
export const goldMat = () => new THREE.MeshStandardMaterial({color: '#d4a84a', roughness: 0.35, metalness: 0.85, envMapIntensity: 0.8});

const shadowAll = (o, cast = true, recv = true) =>
  o.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = cast;
      m.receiveShadow = recv;
    }
  });

// ---------- ground ----------
export function ground(size, tex, color = '#ffffff', repeat = 40) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.repeat.set(repeat, repeat);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat(color, {map: t, roughness: 0.85}));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

// ---------- Kaaba + Haram ----------
export function kaaba() {
  const g = new THREE.Group();
  const W = 11, D = 12.5, H = 13.5;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), mat('#111', {map: TEX.kiswa, roughness: 0.62, metalness: 0.05}));
  body.position.y = H / 2;
  g.add(body);
  const bandTex = TEX.band.clone();
  bandTex.needsUpdate = true;
  bandTex.repeat.set(3, 1);
  const band = new THREE.Mesh(new THREE.BoxGeometry(W + 0.08, 1.05, D + 0.08), new THREE.MeshStandardMaterial({map: bandTex, roughness: 0.4, metalness: 0.6, color: '#ffffff'}));
  band.position.y = H * 0.7;
  g.add(band);
  // door (gold), raised
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.4, 0.18), goldMat());
  door.position.set(-W * 0.18, 2.2 + 1.7, D / 2 + 0.06);
  g.add(door);
  // base (shadharwan)
  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.7, 0.45, D + 0.7), mat('#cfc6b3', {roughness: 0.6}));
  base.position.y = 0.22;
  g.add(base);
  // Hijr Ismail: semicircular low wall
  const hijr = new THREE.Mesh(new THREE.TorusGeometry(7.5, 0.55, 8, 40, Math.PI), mat('#efe9dc', {roughness: 0.5}));
  hijr.rotation.x = Math.PI / 2;
  hijr.rotation.z = Math.PI / 2;
  hijr.position.set(-W / 2 - 0.2, 0.7, 0);
  hijr.scale.z = 1.6;
  g.add(hijr);
  // Maqam Ibrahim: small gold dome
  const maq = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 1.6, 16), goldMat());
  cyl.position.y = 0.8;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), goldMat());
  dome.position.y = 1.6;
  maq.add(cyl, dome);
  maq.position.set(-2, 0, D / 2 + 9);
  g.add(maq);
  shadowAll(g);
  return g;
}

function minaret(h = 90) {
  const g = new THREE.Group();
  const stone = mat('#efe6d2', {roughness: 0.55});
  const parts = [
    [new THREE.CylinderGeometry(3.2, 3.6, h * 0.35, 8), h * 0.175],
    [new THREE.CylinderGeometry(4.2, 4.2, 1.6, 8), h * 0.36],
    [new THREE.CylinderGeometry(2.6, 3.0, h * 0.3, 8), h * 0.52],
    [new THREE.CylinderGeometry(3.6, 3.6, 1.4, 8), h * 0.68],
    [new THREE.CylinderGeometry(2.0, 2.3, h * 0.18, 8), h * 0.78],
  ];
  for (const [geo, y] of parts) {
    const m = new THREE.Mesh(geo, stone);
    m.position.y = y;
    g.add(m);
  }
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2, h * 0.12, 8), goldMat());
  cap.position.y = h * 0.93;
  g.add(cap);
  const cres = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.22, 6, 16, Math.PI * 1.4), goldMat());
  cres.position.y = h * 1.01;
  cres.rotation.z = -Math.PI * 0.2;
  g.add(cres);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 1.2, 8), new THREE.MeshStandardMaterial({color: '#ffe9b0', emissive: '#ffcf70', emissiveIntensity: 0}));
  lamp.position.y = h * 0.84;
  lamp.name = 'lamp';
  g.add(lamp);
  shadowAll(g);
  return g;
}

function clockTower() {
  const g = new THREE.Group();
  const stone = mat('#d9ccb2', {roughness: 0.6, map: TEX.windowsDay});
  const base = new THREE.Mesh(new THREE.BoxGeometry(70, 120, 70), stone);
  base.position.y = 60;
  const mid = new THREE.Mesh(new THREE.BoxGeometry(42, 150, 42), stone);
  mid.position.y = 195;
  const top = new THREE.Mesh(new THREE.BoxGeometry(34, 50, 34), mat('#e9e2d2', {roughness: 0.5}));
  top.position.y = 295;
  g.add(base, mid, top);
  for (let i = 0; i < 4; i++) {
    const face = new THREE.Mesh(new THREE.CircleGeometry(13, 40), new THREE.MeshStandardMaterial({color: '#f6f3ea', emissive: '#fff4d0', emissiveIntensity: 0.15, roughness: 0.5}));
    const ring = new THREE.Mesh(new THREE.RingGeometry(13, 15, 40), goldMat());
    const a = (i * Math.PI) / 2;
    for (const m of [face, ring]) {
      m.position.set(Math.sin(a) * 17.2, 295, Math.cos(a) * 17.2);
      m.rotation.y = a;
      g.add(m);
    }
    face.name = 'clockface';
  }
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(2, 9, 60, 8), goldMat());
  spire.position.y = 350;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(3.5, 16, 12), goldMat());
  ball.position.y = 382;
  const cres = new THREE.Mesh(new THREE.TorusGeometry(6, 1.1, 8, 24, Math.PI * 1.4), goldMat());
  cres.position.y = 395;
  cres.rotation.z = -Math.PI * 0.2;
  g.add(spire, ball, cres);
  shadowAll(g, true, true);
  return g;
}

/** Masjid al-Haram: mataf, tawaf crowd (pure function of time), arcades, minarets, city, hills. */
export function haram(seed = 11) {
  const R = rng(seed);
  const g = new THREE.Group();
  const marble = TEX.marble.clone();
  marble.needsUpdate = true;
  marble.repeat.set(60, 60);
  const mataf = new THREE.Mesh(new THREE.CircleGeometry(70, 96), mat('#ffffff', {map: marble, roughness: 0.45}));
  mataf.rotation.x = -Math.PI / 2;
  mataf.position.y = 0.02;
  mataf.receiveShadow = true;
  g.add(mataf);
  g.add(kaaba());

  // tawaf: white figures circling counterclockwise (seen from above)
  const N = 2600;
  const tw = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.28, 0.9, 2, 6), mat('#f7f5ef', {roughness: 0.8}), N);
  tw.castShadow = false;
  tw.receiveShadow = true;
  const ppl = [];
  for (let i = 0; i < N; i++) {
    const r = 11 + Math.pow(R(), 0.8) * 46;
    ppl.push({r, a: R() * Math.PI * 2, w: (0.9 + R() * 0.3) / r, h: 0.92 + R() * 0.2, wob: R() * 6});
    if (R() < 0.12) tw.setColorAt(i, new THREE.Color().setHSL(R(), 0.15, 0.25 + R() * 0.3));
    else tw.setColorAt(i, new THREE.Color('#f6f3ea'));
  }
  // keep a clear ring around the Kaaba walls
  g.add(tw);
  const dummy = new THREE.Object3D();
  const updateTawaf = (t) => {
    for (let i = 0; i < N; i++) {
      const p = ppl[i];
      const a = p.a + p.w * t * 1.1;
      let x = Math.cos(a) * p.r;
      let z = -Math.sin(a) * p.r;
      // push out of the Kaaba/hijr footprint
      if (Math.abs(x + 3) < 15 && Math.abs(z) < 10) {
        const k = 15 / Math.max(Math.abs(x + 3), 1e-3);
        if (p.r < 16) {
          x *= 1.25;
          z *= 1.25;
        }
      }
      dummy.position.set(x, 0.75 * p.h, z);
      dummy.scale.setScalar(p.h);
      dummy.rotation.y = a;
      dummy.updateMatrix();
      tw.setMatrixAt(i, dummy.matrix);
    }
    tw.instanceMatrix.needsUpdate = true;
  };

  // arcade ring (Ottoman portico + expansions) as polygon of segments
  const arcTex = TEX.arcade.clone();
  arcTex.needsUpdate = true;
  const segs = 40;
  const ring = (rad, h, depth, repeatX) => {
    const geos = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const len = 2 * rad * Math.tan(Math.PI / segs) + 0.4;
      const b = new THREE.BoxGeometry(len, h, depth);
      b.translate(0, h / 2, 0);
      const m = new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeTranslation(0, 0, rad));
      b.applyMatrix4(m);
      geos.push(b);
    }
    const t = arcTex.clone();
    t.needsUpdate = true;
    t.repeat.set(repeatX, 1);
    const mesh = new THREE.Mesh(mergeGeometries(geos), mat('#ffffff', {map: t, roughness: 0.6}));
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  };
  g.add(ring(72, 14, 10, 4));
  g.add(ring(84, 26, 14, 5));
  // roof tops
  const roof = new THREE.Mesh(new THREE.RingGeometry(66, 92, 64), mat('#e6dccb', {roughness: 0.7}));
  roof.rotation.x = -Math.PI / 2;
  roof.position.y = 26.1;
  roof.receiveShadow = true;
  g.add(roof);
  const outer = new THREE.Mesh(new THREE.RingGeometry(92, 150, 64), mat('#efe7d6', {roughness: 0.7, map: marble}));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = 22;
  g.add(outer);
  g.add(ring(150, 22, 16, 6));

  // minarets
  const mins = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    const rr = i % 3 === 0 ? 96 : 140;
    const m = minaret(i % 3 === 0 ? 92 : 112);
    m.position.set(Math.cos(a) * rr, i % 3 === 0 ? 0 : 20, Math.sin(a) * rr);
    g.add(m);
    mins.push(m);
  }
  // clock tower complex to the south
  const ct = clockTower();
  ct.position.set(40, 0, 260);
  g.add(ct);
  for (const s of [-1, 1]) {
    const tw2 = new THREE.Mesh(new THREE.BoxGeometry(40, 160, 40), mat('#d9ccb2', {map: TEX.windowsDay, roughness: 0.6}));
    tw2.position.set(40 + s * 70, 80, 250);
    tw2.castShadow = tw2.receiveShadow = true;
    g.add(tw2);
  }
  // city blocks
  const bl = [];
  for (let i = 0; i < 520; i++) {
    const a = R() * Math.PI * 2;
    const r = 190 + Math.pow(R(), 0.7) * 520;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.abs(x - 40) < 140 && z > 180 && z < 330) continue;
    const w = 14 + R() * 26;
    const h = 10 + R() * (r < 350 ? 70 : 40);
    const b = new THREE.BoxGeometry(w, h, 14 + R() * 26);
    b.translate(x, h / 2 + hill(x, z), z);
    bl.push(b);
  }
  const blocks = new THREE.Mesh(mergeGeometries(bl), mat('#e0d4bd', {map: TEX.windowsDay, roughness: 0.75}));
  blocks.castShadow = blocks.receiveShadow = true;
  g.add(blocks);
  // hills
  const hg = new THREE.PlaneGeometry(3400, 3400, 140, 140);
  hg.rotateX(-Math.PI / 2);
  const pos = hg.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, hill(pos.getX(i), pos.getZ(i)) - 0.5);
  hg.computeVertexNormals();
  const hills = new THREE.Mesh(hg, mat('#a98b6a', {roughness: 0.95, flatShading: false}));
  hills.receiveShadow = true;
  g.add(hills);

  return {
    group: g,
    update(t, night = 0) {
      updateTawaf(t);
      for (const m of mins) {
        const l = m.getObjectByName('lamp');
        l.material.emissiveIntensity = night * 2.2;
      }
      blocks.material.map = night > 0.5 ? TEX.windowsNight : TEX.windowsDay;
      blocks.material.emissive = new THREE.Color('#ffffff');
      blocks.material.emissiveMap = night > 0.5 ? TEX.windowsNight : null;
      blocks.material.emissiveIntensity = night > 0.5 ? 0.9 : 0;
      blocks.material.needsUpdate = true;
    },
  };
}

export function hill(x, z) {
  const r = Math.hypot(x, z);
  if (r < 200) return 0;
  const k = Math.min(1, (r - 200) / 500);
  const n = Math.sin(x * 0.006) * Math.cos(z * 0.0072) + 0.6 * Math.sin(x * 0.013 + 1.7) * Math.sin(z * 0.011 + 0.4) + 0.3 * Math.sin(x * 0.031 + z * 0.027);
  return k * k * (60 + n * 55 + (r > 900 ? (r - 900) * 0.18 : 0));
}

// ---------- people ----------
const SKIN = ['#f1d3b8', '#e0b48f', '#c68c62', '#a46a43', '#7a4a2c', '#5a3520', '#eac4a0', '#d29e78'];
export const OUTFITS = [
  {robe: '#f7f5ef', head: 'ghutra', headColor: '#f5f3ee', type: 'thobe'},
  {robe: '#f7f5ef', head: 'shemagh', headColor: '#c23b3b', type: 'thobe'},
  {robe: '#2b2a2e', head: 'hijab', headColor: '#2b2a2e', type: 'abaya'},
  {robe: '#3f6f8f', head: 'hijab', headColor: '#e9d8c0', type: 'abaya'},
  {robe: '#d98b3a', head: 'none', type: 'robe', accent: '#2d6a4f'},
  {robe: '#2f5d50', head: 'cap', headColor: '#f2e8d5', type: 'robe'},
  {robe: '#7a3e65', head: 'hijab', headColor: '#c99ab8', type: 'abaya'},
  {robe: '#e7d3a8', head: 'none', type: 'suit', legs: '#3c3a36'},
  {robe: '#365f8c', head: 'none', type: 'suit', legs: '#2b2c30'},
  {robe: '#b6452c', head: 'wrap', headColor: '#e9b94a', type: 'robe', accent: '#e9b94a'},
  {robe: '#8a9a5b', head: 'none', type: 'suit', legs: '#4a3f33'},
  {robe: '#f2efe7', head: 'turban', headColor: '#f2efe7', type: 'robe'},
];

/**
 * A stylised person (no facial features). Joints: hipL/R, kneeL/R, shL/shR, elL/elR, neck.
 * pose(p) sets rotations from a plain object.
 */
export function person({outfit = OUTFITS[0], skin = SKIN[2], height = 1.75, child = false, seed = 1} = {}) {
  const R = rng(seed);
  const s = height / 1.75;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skinM = mat(skin, {roughness: 0.6});
  const robeM = mat(outfit.robe, {roughness: 0.8});
  const legM = mat(outfit.legs || outfit.robe, {roughness: 0.8});
  const headC = outfit.headColor || '#222';
  const long = outfit.type === 'thobe' || outfit.type === 'abaya' || outfit.type === 'robe';

  // legs
  const leg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, 0.92, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.36, 3, 8), long ? robeM : legM);
    thigh.position.y = -0.22;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.36, 3, 8), long ? robeM : legM);
    shin.position.y = -0.22;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.24), mat('#3a2d22', {roughness: 0.6}));
    foot.position.set(0, -0.45, 0.05);
    knee.add(shin, foot);
    hip.add(knee);
    body.add(hip);
    return {hip, knee};
  };
  const L = leg(-1);
  const Rg = leg(1);
  // long garment skirt (lathe) hides legs
  let skirt = null;
  if (long) {
    const pts = [new THREE.Vector2(0.16, 1.0), new THREE.Vector2(0.2, 0.7), new THREE.Vector2(0.25, 0.3), new THREE.Vector2(0.27, 0.06), new THREE.Vector2(0.0, 0.06)];
    skirt = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), robeM);
    skirt.scale.z = 0.8;
    body.add(skirt);
  }
  // torso
  const torso = new THREE.Group();
  torso.position.y = 0.95;
  body.add(torso);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 4, 12), robeM);
  chest.position.y = 0.3;
  chest.scale.set(1.08, 1, 0.72);
  torso.add(chest);
  if (outfit.accent) {
    const sash = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 20), mat(outfit.accent));
    sash.rotation.x = Math.PI / 2;
    sash.position.y = 0.12;
    sash.scale.set(1.1, 0.75, 1);
    torso.add(sash);
  }
  // neck + head
  const neck = new THREE.Group();
  neck.position.y = 0.62;
  torso.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 16), skinM);
  head.position.y = 0.14;
  head.scale.set(0.92, 1.08, 1);
  neck.add(head);
  const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 8), skinM);
  nk.position.y = 0.02;
  neck.add(nk);
  const hm = mat(headC, {roughness: 0.85});
  if (outfit.head === 'ghutra' || outfit.head === 'shemagh') {
    const cloth = new THREE.Mesh(new THREE.SphereGeometry(0.128, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hm);
    cloth.position.y = 0.155;
    const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.3, 16, 1, true, Math.PI * 0.25, Math.PI * 1.5), hm);
    drape.material = hm.clone();
    drape.material.side = THREE.DoubleSide;
    drape.position.set(0, 0.05, -0.02);
    drape.rotation.y = Math.PI;
    const agal = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.015, 6, 24), mat('#111', {roughness: 0.5}));
    agal.rotation.x = Math.PI / 2 - 0.12;
    agal.position.y = 0.21;
    neck.add(cloth, drape, agal);
  } else if (outfit.head === 'hijab') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 14), hm);
    cap.position.set(0, 0.15, -0.012);
    cap.scale.set(1, 1.08, 1);
    const fold = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.22, 18), hm);
    fold.position.y = -0.02;
    neck.add(cap, fold);
    // open the face: a skin-coloured oval in front
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), skinM);
    face.position.set(0, 0.14, 0.05);
    face.scale.set(0.78, 1.0, 0.75);
    neck.add(face);
  } else if (outfit.head === 'cap') {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.115, 0.08, 18), hm);
    cap.position.y = 0.23;
    neck.add(cap);
  } else if (outfit.head === 'turban' || outfit.head === 'wrap') {
    const tb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), hm);
    tb.position.y = 0.19;
    tb.scale.set(1.05, 0.9, 1.05);
    neck.add(tb);
  } else {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), mat(R() < 0.5 ? '#2a1e17' : '#4a3426', {roughness: 0.9}));
    hair.position.y = 0.155;
    neck.add(hair);
  }
  // arms
  const arm = (side) => {
    const sh = new THREE.Group();
    sh.position.set(side * 0.22, 0.52, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.25, 3, 8), robeM);
    upper.position.y = -0.15;
    sh.add(upper);
    const el = new THREE.Group();
    el.position.y = -0.3;
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.22, 3, 8), robeM);
    fore.position.y = -0.13;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skinM);
    hand.position.y = -0.28;
    hand.scale.set(0.8, 1.1, 0.6);
    el.add(fore, hand);
    sh.add(el);
    torso.add(sh);
    return {sh, el, hand};
  };
  const AL = arm(-1);
  const AR = arm(1);
  root.scale.setScalar(s * (child ? 0.62 : 1));
  if (child) head.scale.multiplyScalar(1.25);
  shadowAll(root);

  const J = {hipL: L.hip, hipR: Rg.hip, kneeL: L.knee, kneeR: Rg.knee, shL: AL.sh, shR: AR.sh, elL: AL.el, elR: AR.el, neck, torso};
  const rest = () => {
    for (const k in J) J[k].rotation.set(0, 0, 0);
    J.shL.rotation.z = -0.08;
    J.shR.rotation.z = 0.08;
    J.elL.rotation.x = -0.12;
    J.elR.rotation.x = -0.12;
    body.position.y = 0;
  };
  rest();
  return {
    root,
    J,
    handR: AR.hand,
    handL: AL.hand,
    /** p: {walk: phase, walkAmp, sit, bow, nod, waveR, chestR, reachR, reachL, carry, talk} */
    pose(p = {}) {
      rest();
      if (p.walk !== undefined) {
        const a = (p.walkAmp ?? 0.45) * Math.sin(p.walk);
        J.hipL.rotation.x = a;
        J.hipR.rotation.x = -a;
        J.kneeL.rotation.x = Math.max(0, -Math.sin(p.walk - 0.6)) * 0.6 * (p.walkAmp ?? 0.45) * 2;
        J.kneeR.rotation.x = Math.max(0, Math.sin(p.walk - 0.6)) * 0.6 * (p.walkAmp ?? 0.45) * 2;
        J.shL.rotation.x = -a * 0.8;
        J.shR.rotation.x = a * 0.8;
        body.position.y = Math.abs(Math.cos(p.walk)) * 0.025;
        if (skirt) skirt.rotation.z = a * 0.05;
      }
      if (p.sit) {
        const k = p.sit;
        J.hipL.rotation.x = J.hipR.rotation.x = -1.5 * k;
        J.kneeL.rotation.x = J.kneeR.rotation.x = 1.5 * k;
        body.position.y = -0.42 * k;
        if (skirt) skirt.visible = k < 0.5;
      } else if (skirt) skirt.visible = true;
      if (p.bow) J.torso.rotation.x = 0.35 * p.bow;
      if (p.nod) J.neck.rotation.x = 0.25 * p.nod;
      if (p.turn) J.neck.rotation.y = p.turn;
      if (p.chestR) {
        J.shR.rotation.x = -0.6 * p.chestR;
        J.shR.rotation.z = 0.35 * p.chestR;
        J.elR.rotation.x = -1.9 * p.chestR;
        J.elR.rotation.y = 0;
        J.shR.rotation.y = -0.5 * p.chestR;
      }
      if (p.waveR) {
        J.shR.rotation.z = 0.08 + 2.5 * p.waveR;
        J.elR.rotation.z = 0.3 * Math.sin(p.wavePhase || 0) * p.waveR;
        J.elR.rotation.x = -0.4 * p.waveR;
      }
      if (p.reachR) {
        J.shR.rotation.x = -1.2 * p.reachR;
        J.elR.rotation.x = -0.3 * p.reachR;
        J.shR.rotation.z = 0.08 - 0.25 * p.reachR;
      }
      if (p.reachL) {
        J.shL.rotation.x = -1.2 * p.reachL;
        J.elL.rotation.x = -0.3 * p.reachL;
        J.shL.rotation.z = -0.08 + 0.25 * p.reachL;
      }
      if (p.carry) {
        for (const [sh, el, sg] of [[J.shL, J.elL, -1], [J.shR, J.elR, 1]]) {
          sh.rotation.x = -0.9 * p.carry;
          el.rotation.x = -0.9 * p.carry;
          sh.rotation.z = sg * 0.05;
        }
      }
      if (p.talk) {
        J.elR.rotation.x = -1.1 - 0.25 * Math.sin(p.talk * 2.3);
        J.shR.rotation.x = -0.35;
        J.shR.rotation.z = 0.25 + 0.1 * Math.sin(p.talk * 1.7);
        J.neck.rotation.y += 0.08 * Math.sin(p.talk * 1.1);
      }
      if (p.holdL) {
        J.shL.rotation.z = -0.35 * p.holdL;
        J.shL.rotation.x = -0.25 * p.holdL;
      }
      if (p.holdR) {
        J.shR.rotation.z = 0.35 * p.holdR;
        J.shR.rotation.x = -0.25 * p.holdR;
      }
      if (p.cane) {
        J.shR.rotation.x = -0.45;
        J.elR.rotation.x = -0.4;
        J.torso.rotation.x = Math.max(J.torso.rotation.x, 0.22);
      }
    },
  };
}
export const skinOf = (i) => SKIN[i % SKIN.length];

// ---------- vegetation & props ----------
export function palm(seed = 1, h = 7) {
  const R = rng(seed);
  const g = new THREE.Group();
  const trunkPts = [];
  for (let i = 0; i <= 8; i++) trunkPts.push(new THREE.Vector3(Math.sin(i * 0.25) * 0.25 * R(), (i / 8) * h, 0));
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trunkPts), 16, 0.22, 8), mat('#8a6b4a', {roughness: 0.95}));
  g.add(trunk);
  const leafM = mat('#4f7a3a', {roughness: 0.8, side: THREE.DoubleSide});
  const top = trunkPts[8];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + R();
    const len = 3.2 + R() * 1.2;
    const shape = new THREE.PlaneGeometry(len, 0.7, 10, 1);
    const p = shape.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k) + len / 2;
      const w = Math.sin((x / len) * Math.PI) * 0.9 + 0.1;
      p.setY(k, p.getY(k) * w);
      p.setZ(k, -0.12 * x * x);
      p.setX(k, x);
    }
    shape.computeVertexNormals();
    const leaf = new THREE.Mesh(shape, leafM);
    leaf.position.copy(top);
    leaf.rotation.set(Math.PI / 2 - 0.2 - R() * 0.3, 0, a);
    leaf.rotation.order = 'ZXY';
    g.add(leaf);
  }
  shadowAll(g);
  return g;
}

export function tree(seed = 1, scale = 1) {
  const R = rng(seed);
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 2.4, 8), mat('#6b4f36'));
  trunk.position.y = 1.2;
  g.add(trunk);
  const leaf = mat('#5f8a45', {roughness: 0.85});
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + R() * 0.5, 1), leaf);
    b.position.set((R() - 0.5) * 1.4, 2.6 + R() * 1.2, (R() - 0.5) * 1.4);
    g.add(b);
  }
  g.scale.setScalar(scale);
  shadowAll(g);
  return g;
}

export function lantern() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.4, 8), mat('#2c2a26', {metalness: 0.6, roughness: 0.4}));
  pole.position.y = 1.7;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({color: '#fff1c4', emissive: '#ffc864', emissiveIntensity: 0}));
  lamp.position.y = 3.45;
  lamp.name = 'lamp';
  g.add(pole, lamp);
  shadowAll(g);
  return g;
}

/** Soft additive glow sprite. */
export function glow(color = '#ffd88a', size = 4) {
  const tex = canvasTex(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true}));
  s.scale.setScalar(size);
  return s;
}

/** Floating gold dust, pure in t. */
export function dust(count = 300, box = [40, 14, 40], center = [0, 6, 0], seed = 3, color = '#f3d590', size = 0.12) {
  const R = rng(seed);
  const base = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) base.set([R() * box[0] - box[0] / 2, R() * box[1], R() * box[2] - box[2] / 2, R() * 6.28], i * 4);
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const tex = canvasTex(64, 64, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  });
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({color, size, map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8}));
  pts.frustumCulled = false;
  return {
    obj: pts,
    update(t) {
      for (let i = 0; i < count; i++) {
        const b = i * 4;
        const ph = base[b + 3];
        pos[i * 3] = center[0] + base[b] + Math.sin(t * 0.3 + ph) * 0.8;
        pos[i * 3 + 1] = center[1] - box[1] / 2 + ((base[b + 1] + t * 0.25) % box[1]);
        pos[i * 3 + 2] = center[2] + base[b + 2] + Math.cos(t * 0.25 + ph) * 0.8;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

/** A plaza: paving, palms, low walls, lanterns. */
export function plaza(seed = 5, {size = 400, palms = 10, radius = 18} = {}) {
  const R = rng(seed);
  const g = new THREE.Group();
  g.add(ground(size, TEX.paving, '#ffffff', size / 3));
  for (let i = 0; i < palms; i++) {
    const a = (i / palms) * Math.PI * 2 + R() * 0.3;
    const r = radius + R() * 8;
    const p = palm(seed * 10 + i, 6 + R() * 3);
    p.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    g.add(p);
  }
  // planters
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.2, 0.6, 16), mat('#d8c9a8'));
    pl.position.set(Math.cos(a) * (radius - 4), 0.3, Math.sin(a) * (radius - 4));
    pl.castShadow = pl.receiveShadow = true;
    g.add(pl);
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), mat('#5f8a45'));
    bush.position.copy(pl.position).add(new THREE.Vector3(0, 0.9, 0));
    bush.castShadow = true;
    g.add(bush);
  }
  // distant buildings in local style
  const bl = [];
  for (let i = 0; i < 110; i++) {
    const a = R() * Math.PI * 2;
    const r = 95 + R() * 160;
    const w = 12 + R() * 20;
    const h = 10 + R() * 40;
    const b = new THREE.BoxGeometry(w, h, 8 + R() * 14);
    b.translate(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    bl.push(b);
  }
  const blocks = new THREE.Mesh(mergeGeometries(bl), mat('#e2d6c0', {map: TEX.windowsDay, roughness: 0.85}));
  blocks.castShadow = blocks.receiveShadow = true;
  g.add(blocks);
  return g;
}
