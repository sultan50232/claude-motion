import * as THREE from 'three';
import {C, canvasTex} from './lib.js';

// Hand-drawn (procedural) memory postcards, soft and slightly faded like a remembered image.
const W = 520;
const H = 660;
const PAD = 26;
const IH = 500;

const sky = (g, top, bot) => {
  const gr = g.createLinearGradient(0, 0, 0, IH);
  gr.addColorStop(0, top);
  gr.addColorStop(1, bot);
  g.fillStyle = gr;
  g.fillRect(0, 0, W - PAD * 2, IH);
};
const glow = (g, x, y, r, c, a = 0.6) => {
  const rg = g.createRadialGradient(x, y, 0, x, y, r);
  rg.addColorStop(0, c);
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.globalAlpha = a;
  g.fillStyle = rg;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.globalAlpha = 1;
};
const person = (g, x, y, s, body, headC = C.skin, wrap = null) => {
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(x - 16 * s, y);
  g.quadraticCurveTo(x - 18 * s, y - 60 * s, x - 10 * s, y - 70 * s);
  g.lineTo(x + 10 * s, y - 70 * s);
  g.quadraticCurveTo(x + 18 * s, y - 60 * s, x + 16 * s, y);
  g.fill();
  g.fillStyle = wrap || headC;
  g.beginPath();
  g.arc(x, y - 84 * s, 13 * s, 0, Math.PI * 2);
  g.fill();
  if (wrap) {
    g.fillStyle = headC;
    g.beginPath();
    g.arc(x, y - 82 * s, 8 * s, 0, Math.PI * 2);
    g.fill();
  }
};

const SCENES = {
  house(g) {
    sky(g, '#6d63c9', '#f3d9e6');
    glow(g, 360, 110, 120, '#ffffff', 0.5);
    g.fillStyle = '#fff6f0';
    g.beginPath();
    g.arc(360, 110, 26, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#8fbfd9';
    g.fillRect(0, 380, W, 140);
    // old house: thick walls, flat roof with parapet notches
    g.fillStyle = '#eee3dc';
    g.fillRect(90, 220, 250, 170);
    for (let i = 0; i < 9; i++) g.fillRect(90 + i * 30, 205, 16, 18);
    g.fillStyle = '#6b5fc4';
    g.fillRect(195, 300, 46, 90);
    g.fillStyle = '#ffe3c8';
    for (const [x, y] of [[120, 250], [270, 250], [120, 320], [282, 320]]) {
      g.fillRect(x, y, 34, 40);
      glow(g, x + 17, y + 20, 60, '#ffe7cf', 0.45);
    }
    g.fillStyle = '#5a7fb8';
    g.beginPath();
    g.ellipse(410, 330, 50, 70, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(404, 330, 12, 70);
  },
  family(g) {
    sky(g, '#8fc6f2', '#fbe6ee');
    glow(g, 230, 330, 240, '#ffffff', 0.55);
    g.fillStyle = '#a7d8c8';
    g.beginPath();
    g.ellipse(234, 470, 360, 110, 0, 0, Math.PI * 2);
    g.fill();
    person(g, 150, 430, 1.45, '#f7f9ff', C.skin);
    person(g, 315, 430, 1.35, '#2c2f63', C.skin, C.lilac);
    person(g, 232, 430, 0.85, C.violet, C.skin);
    g.strokeStyle = C.skin;
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(172, 360);
    g.quadraticCurveTo(200, 385, 220, 380);
    g.moveTo(292, 362);
    g.quadraticCurveTo(262, 385, 244, 380);
    g.stroke();
  },
  dallah(g) {
    sky(g, '#3f3f8f', '#c9b9ef');
    // rug
    g.fillStyle = '#5b4fb3';
    g.fillRect(0, 360, W, 160);
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 4;
    for (let i = 0; i < 8; i++) {
      g.beginPath();
      g.moveTo(i * 70, 380);
      g.lineTo(i * 70 + 35, 410);
      g.lineTo(i * 70 + 70, 380);
      g.stroke();
    }
    // dallah (coffee pot)
    g.fillStyle = '#e8ecf8';
    g.beginPath();
    g.moveTo(170, 370);
    g.quadraticCurveTo(150, 300, 190, 270);
    g.lineTo(200, 220);
    g.quadraticCurveTo(225, 195, 250, 220);
    g.lineTo(258, 270);
    g.quadraticCurveTo(298, 300, 278, 370);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(190, 290);
    g.quadraticCurveTo(120, 250, 105, 205);
    g.lineTo(118, 200);
    g.quadraticCurveTo(140, 250, 196, 270);
    g.fill();
    g.fillStyle = '#c9d1ea';
    g.beginPath();
    g.ellipse(225, 192, 20, 12, 0, 0, Math.PI * 2);
    g.fill();
    // cups
    for (const x of [320, 375]) {
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(x, 330);
      g.lineTo(x + 36, 330);
      g.lineTo(x + 30, 368);
      g.lineTo(x + 6, 368);
      g.fill();
    }
    // steam
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 6;
    for (const [x, o] of [[110, 0], [338, 1], [393, 2]]) {
      g.beginPath();
      for (let k = 0; k < 30; k++) {
        const y = 190 - k * 4 - (x > 200 ? -120 : 0);
        const xx = x + Math.sin(k * 0.35 + o) * 10;
        k ? g.lineTo(xx, y) : g.moveTo(xx, y);
      }
      g.stroke();
    }
  },
  rain(g) {
    sky(g, '#24306b', '#6f7fd0');
    for (let i = 0; i < 14; i++) glow(g, (i * 97) % 470, 250 + ((i * 53) % 220), 40 + (i % 3) * 18, i % 2 ? '#bfe6ff' : '#e3dcff', 0.5);
    g.strokeStyle = 'rgba(240,246,255,0.75)';
    g.lineWidth = 12;
    g.strokeRect(10, 10, W - PAD * 2 - 20, IH - 20);
    g.beginPath();
    g.moveTo((W - PAD * 2) / 2, 10);
    g.lineTo((W - PAD * 2) / 2, IH - 10);
    g.moveTo(10, IH / 2);
    g.lineTo(W - PAD * 2 - 10, IH / 2);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 60; i++) {
      const x = (i * 71) % 460 + 10;
      const y = (i * 137) % 470 + 10;
      g.beginPath();
      g.ellipse(x, y, 3, 5 + (i % 4), 0, 0, Math.PI * 2);
      g.fill();
    }
  },
  kite(g) {
    sky(g, '#7fc4f5', '#e9f4ff');
    for (const [x, y, s] of [[90, 120, 1], [360, 200, 1.3], [200, 330, 0.8]]) {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (const [dx, dy, r] of [[0, 0, 30], [32, -10, 38], [66, 0, 28]]) {
        g.beginPath();
        g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.fillStyle = C.violet;
    g.beginPath();
    g.moveTo(300, 70);
    g.lineTo(350, 140);
    g.lineTo(300, 220);
    g.lineTo(250, 140);
    g.fill();
    g.fillStyle = C.blush;
    g.beginPath();
    g.moveTo(300, 70);
    g.lineTo(350, 140);
    g.lineTo(300, 140);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(300, 220);
    g.bezierCurveTo(280, 300, 200, 330, 150, 430);
    g.stroke();
    g.fillStyle = '#a3dcc4';
    g.fillRect(0, 440, W, 80);
    person(g, 150, 460, 0.8, C.violet);
  },
};

/** A postcard texture: white frame, image, faded edges. */
export function cardTexture(kind) {
  return canvasTex(W, H, (g) => {
    g.fillStyle = '#f7f8ff';
    const r = 28;
    g.beginPath();
    g.roundRect(0, 0, W, H, r);
    g.fill();
    g.save();
    g.translate(PAD, PAD);
    g.beginPath();
    g.roundRect(0, 0, W - PAD * 2, IH, 16);
    g.clip();
    SCENES[kind](g);
    // memory haze: soft white bloom over the picture
    const v = g.createRadialGradient((W - PAD * 2) / 2, IH / 2, IH * 0.2, (W - PAD * 2) / 2, IH / 2, IH * 0.8);
    v.addColorStop(0, 'rgba(255,255,255,0)');
    v.addColorStop(1, 'rgba(255,245,250,0.55)');
    g.fillStyle = v;
    g.fillRect(0, 0, W, IH);
    g.restore();
  });
}

/** Card as a plane mesh (1 unit wide). */
export function makeCard(kind) {
  const tex = cardTexture(kind);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, H / W),
    new THREE.MeshBasicMaterial({map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false}),
  );
  m.userData.tex = tex;
  return m;
}

/** The same card cut into tiles that can drift apart (an imperfect memory). */
export function makeShards(kind, cols = 5, rows = 6) {
  const tex = cardTexture(kind);
  const g = new THREE.Group();
  const w = 1 / cols;
  const h = H / W / rows;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const geo = new THREE.PlaneGeometry(w, h);
      const uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (i + uv.getX(k)) / cols, (j + uv.getY(k)) / rows);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false}));
      m.userData.home = new THREE.Vector3(-0.5 + w * (i + 0.5), -H / W / 2 + h * (j + 0.5), 0);
      m.userData.seed = (i * 7 + j * 13) % 11;
      m.position.copy(m.userData.home);
      g.add(m);
    }
  }
  return g;
}
