import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {C, mat, sphere, v3} from './lib.js';

/**
 * A soft "designer toy" person. Units: head radius = h (default 1). Origin at the feet.
 * outfit: 'hoodie' | 'thobe' | 'abaya'. hairStyle: 'short' | 'hijab'.
 * Returns {group, head, bottle, pose(p)} where pose takes
 * {handR:[x,y,z], handL:[x,y,z], eyes:0..1, smile:0..1, tilt, turn, lean}.
 */
export function makePerson({s = 1, h = 1, outfit = 'hoodie', hairStyle = 'short', top = C.violet, bottom = '#2a3170', bottle = false, detail = 1} = {}) {
  const g = new THREE.Group();
  const skin = mat(C.skin, {roughness: 0.55});
  const skinShade = mat(C.skinShade, {roughness: 0.6});
  const cloth = mat(top, {roughness: 0.78});
  const clothDark = mat(new THREE.Color(top).multiplyScalar(0.78), {roughness: 0.8});
  const pants = mat(bottom, {roughness: 0.8});
  const hairM = mat(C.hair, {roughness: 0.5});
  const seg = detail > 0.5 ? 40 : 20;

  // --- body (built in body space, scaled by s) ---
  const body = new THREE.Group();
  g.add(body);
  const shoulderY = 6.25;
  if (outfit === 'hoodie') {
    const torso = sphere(1, cloth, 1.55, 1.75, 0.95, seg);
    torso.position.set(0, 5.0, 0);
    body.add(torso);
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.5, seg), clothDark);
    hem.position.set(0, 3.55, 0);
    body.add(hem);
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.26, 14, seg), clothDark);
    hood.rotation.x = Math.PI / 2 + 0.25;
    hood.position.set(0, 6.55, -0.12);
    body.add(hood);
    const pocket = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.55, 0.2, 3, 0.1), clothDark);
    pocket.position.set(0, 4.2, 0.86);
    body.add(pocket);
    for (const x of [-0.55, 0.55]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 2.6, 6, 16), pants);
      leg.position.set(x, 1.75, 0);
      body.add(leg);
      const shoe = sphere(0.45, mat(C.white), 1, 0.55, 1.5, 16);
      shoe.position.set(x, 0.25, 0.25);
      body.add(shoe);
    }
  } else {
    // long garment: thobe (white) or abaya (deep navy)
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const y = (i / 12) * 6.6;
      const r = 1.25 - 0.25 * (y / 6.6) + 0.35 * Math.pow(1 - y / 6.6, 3) - (y > 6.0 ? (y - 6.0) * 1.1 : 0);
      pts.push(new THREE.Vector2(Math.max(0.35, r), y));
    }
    const robe = new THREE.Mesh(new THREE.LatheGeometry(pts, seg), cloth);
    robe.scale.z = 0.75;
    body.add(robe);
    const shoulders = sphere(1, cloth, 1.35, 0.6, 0.75, seg);
    shoulders.position.y = 6.0;
    body.add(shoulders);
  }
  body.scale.setScalar(s);

  // --- arms: upper/lower cylinders stretched between joints, spheres at joints ---
  const armR = 0.36;
  const unitCyl = new THREE.CylinderGeometry(armR, armR, 1, 16);
  const limbs = ['R', 'L'].map((side) => {
    const up = new THREE.Mesh(unitCyl, cloth);
    const lo = new THREE.Mesh(unitCyl, cloth);
    const elbow = sphere(armR, cloth, 1, 1, 1, 16);
    const shoulder = sphere(armR * 1.25, cloth, 1, 1, 1, 16);
    const hand = sphere(0.34, skin, 0.9, 1.05, 0.85, 20);
    for (const m of [up, lo, elbow, shoulder, hand]) {
      m.scale.multiplyScalar(s);
      g.add(m);
    }
    return {side, up, lo, elbow, shoulder, hand, sx: side === 'R' ? 1 : -1};
  });
  const place = (m, a, b) => {
    const A = v3(a);
    const B = v3(b);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    m.scale.set(s, A.distanceTo(B), s);
  };

  // --- head ---
  const head = new THREE.Group();
  const headY = s * 6.75 + h * 1.15;
  head.position.y = headY;
  g.add(head);
  const face = new THREE.Group();
  face.scale.setScalar(h);
  head.add(face);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 1.2, 16), skin);
  neck.position.set(0, -1.0, -0.05);
  face.add(neck);
  const skull = sphere(1, skin, 0.93, 1.0, 0.95, seg + 8);
  face.add(skull);
  const jaw = sphere(0.78, skin, 1.0, 0.82, 0.98, seg);
  jaw.position.set(0, -0.36, 0.1);
  face.add(jaw);
  for (const x of [-1, 1]) {
    const ear = sphere(0.22, skinShade, 0.5, 1, 0.8, 16);
    ear.position.set(x * 0.92, -0.08, -0.05);
    face.add(ear);
  }
  const nose = sphere(0.13, skinShade, 0.85, 1, 1, 16);
  nose.position.set(0, -0.2, 0.96);
  face.add(nose);

  // eyes: open (dark lens + catch light) and closed (relaxed arc)
  const eyeM = mat('#1e2150', {roughness: 0.25});
  const eyes = [-1, 1].map((x) => {
    const open = sphere(0.1, eyeM, 1, 1.3, 0.6, 16);
    open.position.set(x * 0.33, -0.02, 0.87);
    const glint = sphere(0.032, new THREE.MeshBasicMaterial({color: '#ffffff'}), 1, 1, 1, 8);
    glint.position.set(0.035, 0.05, 0.06);
    open.add(glint);
    const closed = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 20, Math.PI), eyeM);
    closed.rotation.z = Math.PI;
    closed.position.set(x * 0.33, 0.0, 0.9);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.17, 4, 8), hairM);
    brow.rotation.z = Math.PI / 2 + x * 0.12;
    brow.position.set(x * 0.34, 0.24, 0.88);
    face.add(open, closed, brow);
    return {open, closed, brow};
  });
  const mouthM = mat('#b9707f', {roughness: 0.5});
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.024, 8, 20, Math.PI), mouthM);
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, -0.5, 0.86);
  face.add(mouth);
  const blushM = new THREE.MeshBasicMaterial({color: C.blush, transparent: true, opacity: 0.35, depthWrite: false});
  for (const x of [-1, 1]) {
    const b = sphere(0.14, blushM, 1, 0.6, 0.3, 12);
    b.position.set(x * 0.52, -0.3, 0.8);
    face.add(b);
  }

  // hair / hijab
  if (hairStyle === 'hijab') {
    const hijM = mat(C.lilac, {roughness: 0.85});
    const wrap = new THREE.Mesh(new THREE.SphereGeometry(1.14, seg, seg, Math.PI / 2 + 1.05, Math.PI * 2 - 2.1, 0, Math.PI * 0.86), hijM);
    const brim = new THREE.Mesh(new THREE.SphereGeometry(1.12, seg, seg / 2, 0, Math.PI * 2, 0, 0.62), hijM);
    face.add(brim);
    face.add(wrap);
    const drape = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.6, seg, 1, true), hijM);
    drape.position.set(0, -1.15, -0.1);
    face.add(drape);
  } else {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.06, seg, seg / 2, 0, Math.PI * 2, 0, 1.08), hairM);
    cap.position.set(0, 0.08, -0.04);
    const back = new THREE.Mesh(new THREE.SphereGeometry(1.04, seg, seg / 2, Math.PI, Math.PI, 0, 1.9), hairM);
    back.position.set(0, 0.02, -0.06);
    face.add(cap, back);
    for (let i = 0; i < 5; i++) {
      const a = -0.75 + i * 0.37;
      const tuft = sphere(0.3, hairM, 1.2, 0.7, 0.8, 16);
      tuft.position.set(Math.sin(a) * 0.82, 0.68 - Math.abs(a) * 0.12, Math.cos(a) * 0.62);
      tuft.rotation.set(-0.5, a, (i - 2) * 0.2);
      face.add(tuft);
    }
  }

  // perfume bottle (held in the right hand)
  let bottleG = null;
  if (bottle) {
    bottleG = new THREE.Group();
    const glass = new THREE.MeshStandardMaterial({color: '#cfe9ff', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.42, emissive: '#5aa9ff', emissiveIntensity: 0.12});
    const liquid = new THREE.MeshStandardMaterial({color: C.violetSoft, roughness: 0.2, emissive: C.violet, emissiveIntensity: 0.35, transparent: true, opacity: 0.85});
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.82, 0.36, 4, 0.12), glass);
    const juice = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.56, 0.24, 3, 0.08), liquid);
    juice.position.y = -0.1;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 16), mat(C.white, {metalness: 0.6, roughness: 0.3}));
    collar.position.y = 0.48;
    const capM = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.3, 0.3, 3, 0.07), mat(C.navy, {metalness: 0.3, roughness: 0.35}));
    capM.position.y = 0.68;
    bottleG.add(juice, body, collar, capM);
    bottleG.scale.setScalar(1.15);
    g.add(bottleG);
  }

  const pose = (p = {}) => {
    const {handR = [1.4 * s, 3.9 * s, 0.5 * s], handL = [-1.4 * s, 3.9 * s, 0.5 * s], eyes: eo = 1, smile = 0.4, tilt = 0, turn = 0, lean = 0, nod = 0} = p;
    head.rotation.set(-tilt + nod, turn, lean * 0.4);
    head.position.y = headY;
    head.position.z = Math.sin(tilt) * 0.2;
    for (const L of limbs) {
      const S = [L.sx * 1.42 * s, shoulderY * s, -0.05 * s];
      const H = L.side === 'R' ? handR : handL;
      // elbow: halfway, pushed out and down so the arm bends naturally
      const mid = [(S[0] + H[0]) / 2, (S[1] + H[1]) / 2, (S[2] + H[2]) / 2];
      const span = Math.hypot(H[0] - S[0], H[1] - S[1], H[2] - S[2]);
      const bend = Math.max(0, 4.4 * s - span) * 0.55;
      const E = [mid[0] + L.sx * bend * 0.75, mid[1] - bend * 0.55, mid[2] + bend * 0.25];
      place(L.up, S, E);
      place(L.lo, E, H);
      L.elbow.position.set(...E);
      L.shoulder.position.set(...S);
      L.hand.position.set(...H);
    }
    if (bottleG) bottleG.position.set(handR[0] - 0.12, handR[1] + 0.55, handR[2] + 0.22);
    eyes.forEach((e) => {
      e.open.visible = eo > 0.18;
      e.closed.visible = eo <= 0.18;
      e.open.scale.y = 1.3 * Math.max(0.15, eo);
    });
    mouth.scale.set(0.8 + smile * 0.5, 0.6 + smile * 0.8, 1);
  };
  pose();
  return {group: g, head, bottle: bottleG, pose, headY, eyesY: headY};
}
