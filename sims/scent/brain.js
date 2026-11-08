import * as THREE from 'three';
import {C, dotTex, mat, noise3} from './lib.js';

// Brain coordinates: x left/right, y up, z front (+) / back (-). Length ≈ 2.2.
const fold = (x, y, z) => {
  const n1 = 1 - Math.abs(noise3(x * 3.1, y * 3.1, z * 3.1));
  const n2 = 1 - Math.abs(noise3(x * 6.5 + 7, y * 6.5, z * 6.5));
  return 0.06 * Math.pow(n1, 3) + 0.022 * Math.pow(n2, 3) - 0.03;
};

function hemisphere(side, seg) {
  const geo = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let x = 0.56 + 0.6 * v.x * side;
    let y = 0.72 * v.y;
    let z = 1.05 * v.z;
    if (y < 0) y *= 0.72;
    // temporal lobe: lower, lateral, front-middle bulge
    const tl = Math.max(0, -v.y) * Math.max(0, 1 - Math.abs(v.z - 0.15) * 1.4) * Math.max(0, v.x * side);
    y -= tl * 0.28;
    x += tl * 0.06;
    // frontal pole slightly narrower and lower
    if (z > 0.6) y -= (z - 0.6) * 0.18;
    x = Math.max(x, 0.035);
    // Sylvian fissure on the lateral face
    const s = y - (-0.1 - 0.26 * z);
    let dent = 0;
    if (Math.abs(s) < 0.06 && x > 0.5 && z > -0.5 && z < 0.75) dent = 0.07 * (1 - Math.abs(s) / 0.06);
    const n = new THREE.Vector3(x - 0.56, y / 0.6, z / 1.05).normalize();
    const d = (x < 0.05 ? 0.25 : 1) * fold(x * side, y, z) - dent;
    p.setXYZ(i, side * (x + n.x * d), y + n.y * d, z + n.z * d);
  }
  geo.computeVertexNormals();
  return geo;
}

function cerebellum(seg) {
  const geo = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) * 0.82;
    const y = p.getY(i) * 0.36;
    const z = p.getZ(i) * 0.48;
    const stri = 0.018 * Math.sin((y * 14 + z * 6) * Math.PI);
    p.setXYZ(i, x * (1 + stri), y * (1 + stri), z * (1 + stri));
  }
  geo.computeVertexNormals();
  return geo;
}

export const glassMat = (color, rim) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {uColor: {value: new THREE.Color(color)}, uRim: {value: new THREE.Color(rim)}, uA: {value: 1}},
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform vec3 uRim; uniform float uA; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(clamp(1.0-abs(dot(normalize(vN),normalize(vV))),0.0,1.0), 2.2);
        float l = clamp(dot(normalize(vN), normalize(vec3(0.3,0.8,0.5))),0.0,1.0);
        vec3 c = uColor*(0.03+0.07*l) + uRim*f*0.42;
        gl_FragColor = vec4(c*uA, 1.0); }`,
  });

export function makeBrain({seg = 120} = {}) {
  const group = new THREE.Group();
  const clay = mat('#d8d2f4', {roughness: 0.58, transparent: true, emissive: '#3b3a7a', emissiveIntensity: 0.12});
  const glass = glassMat(C.skySoft, C.sky);
  const parts = [hemisphere(1, seg), hemisphere(-1, seg)];
  const cb = cerebellum(Math.round(seg * 0.6));
  const shell = new THREE.Group();
  for (const geo of parts) {
    shell.add(new THREE.Mesh(geo, clay));
    const gm = new THREE.Mesh(geo, glass);
    gm.renderOrder = 5;
    shell.add(gm);
  }
  for (const m of [clay, glass]) {
    const c = new THREE.Mesh(cb, m);
    c.position.set(0, -0.5, -0.82);
    c.rotation.x = 0.25;
    if (m === glass) c.renderOrder = 5;
    shell.add(c);
  }
  const stemGeo = new THREE.CylinderGeometry(0.17, 0.12, 0.9, 20);
  for (const m of [clay, glass]) {
    const st = new THREE.Mesh(stemGeo, m);
    st.position.set(0, -0.75, -0.42);
    st.rotation.x = 0.35;
    if (m === glass) st.renderOrder = 5;
    shell.add(st);
  }
  group.add(shell);

  // deep structures (both sides; the near side carries the labels)
  const glowM = (c) => new THREE.MeshStandardMaterial({color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.4});
  const amyM = glowM(C.violet);
  const hipM = glowM(C.sky);
  const bulbM = glowM(C.skySoft);
  const deep = new THREE.Group();
  group.add(deep);
  const anchors = {};
  for (const side of [-1, 1]) {
    const amy = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 18), amyM);
    amy.scale.set(0.9, 0.85, 1.4);
    amy.position.set(side * 0.6, -0.38, 0.32);
    const hipCurve = new THREE.CatmullRomCurve3([
      [0.6, -0.42, 0.16], [0.63, -0.38, -0.12], [0.58, -0.28, -0.42], [0.46, -0.1, -0.62], [0.32, 0.06, -0.66],
    ].map(([x, y, z]) => new THREE.Vector3(side * x, y, z)));
    const hip = new THREE.Mesh(new THREE.TubeGeometry(hipCurve, 64, 0.075, 14), hipM);
    const hipHead = new THREE.Mesh(new THREE.SphereGeometry(0.095, 20, 14), hipM);
    hipHead.position.copy(hipCurve.getPoint(0));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), bulbM);
    bulb.scale.set(0.8, 0.7, 2.3);
    bulb.position.set(side * 0.13, -0.5, 1.12);
    const tractCurve = new THREE.CatmullRomCurve3([
      [0.13, -0.5, 1.0], [0.18, -0.52, 0.75], [0.32, -0.48, 0.5], [0.55, -0.4, 0.36],
    ].map(([x, y, z]) => new THREE.Vector3(side * x, y, z)));
    const tract = new THREE.Mesh(new THREE.TubeGeometry(tractCurve, 40, 0.025, 8), bulbM);
    deep.add(amy, hip, hipHead, bulb, tract);
    if (side === -1) Object.assign(anchors, {amy, hipCurve, bulb, tractCurve});
  }

  // signal pulses: bulb → amygdala → hippocampus (near side)
  const sprite = dotTex();
  const pulseM = new THREE.SpriteMaterial({map: sprite, color: C.white, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false});
  const pulses = Array.from({length: 7}, () => {
    const sp = new THREE.Sprite(pulseM.clone());
    sp.scale.setScalar(0.18);
    sp.renderOrder = 9;
    group.add(sp);
    return sp;
  });
  const halo = (c, sc) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: sprite, color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false}));
    sp.scale.setScalar(sc);
    sp.renderOrder = 8;
    group.add(sp);
    return sp;
  };
  const haloA = halo(C.violet, 0.9);
  haloA.position.copy(anchors.amy.position);
  const haloH = halo(C.sky, 1.1);
  haloH.position.copy(anchors.hipCurve.getPoint(0.45));
  const haloB = halo(C.white, 0.5);
  haloB.position.copy(anchors.bulb.position);
  const route = new THREE.CatmullRomCurve3([
    ...anchors.tractCurve.points,
    anchors.amy.position.clone(),
    ...anchors.hipCurve.points,
  ]);

  /** xray 0 = solid clay brain, 1 = glass shell with glowing deep parts. */
  const set = ({xray = 0, a = 0, hip = 0, b = 0, pulse = 0, t = 0, alpha = 1} = {}) => {
    clay.opacity = alpha * (1 - xray);
    clay.depthWrite = xray < 0.5;
    clay.visible = clay.opacity > 0.01;
    glass.uniforms.uA.value = alpha * (0.25 + 0.6 * xray);
    deep.visible = xray > 0.02;
    amyM.emissiveIntensity = 0.2 + 0.8 * a;
    hipM.emissiveIntensity = 0.2 + 0.7 * hip;
    bulbM.emissiveIntensity = 0.12 + 0.45 * b;
    haloA.material.opacity = 0.5 * a * xray;
    haloH.material.opacity = 0.4 * hip * xray;
    haloB.material.opacity = 0.25 * b * xray;
    pulses.forEach((sp, i) => {
      const k = (t * 0.42 + i / pulses.length) % 1;
      sp.position.copy(route.getPoint(k));
      sp.material.opacity = pulse * xray * Math.sin(Math.PI * k) * 0.95;
    });
  };
  set();
  return {group, set, anchors, route};
}
