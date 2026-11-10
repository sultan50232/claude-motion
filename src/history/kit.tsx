import React from 'react';
import {clamp01, easeInOut, lerp, rand} from '../lib';
import {HFPS, HH, HW, P, S} from './theme';

/** Parallax camera: depth 0 is the far sky, 1 moves with the camera. */
export const cam = (depth: number, cx: number, cy: number, zoom: number) => {
  const z = 1 + (zoom - 1) * depth;
  return `translate(${HW / 2} ${HH / 2}) scale(${z}) translate(${-HW / 2 - cx * depth} ${-HH / 2 - cy * depth})`;
};

export const Layer: React.FC<{
  depth: number;
  c: {x: number; y: number; z: number};
  children: React.ReactNode;
}> = ({depth, c, children}) => <g transform={cam(depth, c.x, c.y, c.z)}>{children}</g>;

/** Waving cloth: a flag hung from (x, y) on its left edge, width w, height h. */
export const flagPath = (x: number, y: number, w: number, h: number, t: number, amp = 10, speed = 6) => {
  const pts = (yy: number, off: number) =>
    Array.from({length: 9}, (_, i) => {
      const u = i / 8;
      const dy = Math.sin(u * 5 - t * speed + off) * amp * u;
      return [x + u * w, yy + dy] as const;
    });
  const top = pts(y, 0);
  const bot = pts(y + h, 0.6).reverse();
  return `M ${top.map((p) => p.join(' ')).join(' L ')} L ${bot.map((p) => p.join(' ')).join(' L ')} Z`;
};

/** Floating dust motes in a light beam. Pure function of t. */
export const Motes: React.FC<{t: number; n?: number; color?: string; area?: [number, number, number, number]}> = ({
  t,
  n = 26,
  color = P.cream,
  area = [0, 0, HW, HH],
}) => (
  <g>
    {Array.from({length: n}, (_, i) => {
      const [ax, ay, aw, ah] = area;
      const x = ax + ((rand(i) * aw + t * (6 + rand(i + 9) * 10)) % aw);
      const y = ay + ((rand(i + 3) * ah - t * (10 + rand(i + 5) * 16) + ah * 10) % ah);
      const tw = 0.4 + 0.6 * Math.sin(t * (1 + rand(i + 7) * 2) + i);
      return <circle key={i} cx={x} cy={y} r={2 + rand(i + 11) * 4} fill={color} opacity={0.18 + 0.3 * tw} />;
    })}
  </g>
);

export const Birds: React.FC<{t: number; x: number; y: number; n?: number; dir?: number}> = ({t, x, y, n = 4, dir = -1}) => (
  <g>
    {Array.from({length: n}, (_, i) => {
      const bx = x + dir * t * 38 + i * 48 * -dir + Math.sin(t + i) * 6;
      const by = y + (i % 2) * 26 + Math.sin(t * 1.3 + i * 2) * 8;
      const flap = Math.sin(t * 9 + i * 1.7) * 9;
      return (
        <path
          key={i}
          d={`M ${bx - 16} ${by + flap} Q ${bx - 7} ${by - 4} ${bx} ${by + 2} Q ${bx + 7} ${by - 4} ${bx + 16} ${by + flap}`}
          fill="none"
          stroke={P.ink}
          strokeWidth={3.5}
          strokeLinecap="round"
          opacity={0.6}
        />
      );
    })}
  </g>
);

/** Palm tree swaying from its base at (x, y). */
export const Palm: React.FC<{x: number; y: number; s?: number; t: number; seed?: number}> = ({x, y, s = 1, t, seed = 0}) => {
  const sway = Math.sin(t * 1.4 + seed) * 4;
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) rotate(${sway * 0.4})`}>
      <path d="M -10 0 Q -2 -160 14 -300 L 26 -300 Q 12 -160 12 0 Z" fill={P.wood} stroke={P.ink} strokeWidth={4} />
      {[-150, -110, -60, -20, 25, 70, 120, 160].map((a, i) => (
        <g key={i} transform={`translate(20 -300) rotate(${a + sway * (1 + (i % 3) * 0.4)})`}>
          <path d="M 0 0 Q 50 -30 110 10 Q 60 -6 0 8 Z" fill={i % 2 ? P.green : P.greenDk} stroke={P.ink} strokeWidth={3.5} />
        </g>
      ))}
    </g>
  );
};

/** Dust puff that grows and fades over `life` seconds after t0. */
export const Puff: React.FC<{t: number; t0: number; x: number; y: number; r?: number; life?: number; color?: string}> = ({
  t,
  t0,
  x,
  y,
  r = 60,
  life = 1.4,
  color = P.sand,
}) => {
  const k = (t - t0) / life;
  if (k < 0 || k > 1) return null;
  const e = 1 - (1 - k) ** 3;
  return (
    <g opacity={(1 - k) * 0.85}>
      {[0, 1, 2, 3, 4].map((i) => (
        <circle
          key={i}
          cx={x + Math.cos(i * 1.3) * r * 0.8 * e + (i - 2) * 10}
          cy={y - e * r * 0.6 - Math.sin(i * 2.1) * r * 0.3 * e}
          r={r * (0.35 + 0.65 * e) * (0.6 + 0.12 * i)}
          fill={color}
          stroke={P.ink}
          strokeWidth={3}
          strokeOpacity={0.3}
        />
      ))}
    </g>
  );
};

/** Gradient sky as a full-frame rect; `id` must be unique per scene. */
export const Sky: React.FC<{id: string; stops: [number, string][]}> = ({id, stops}) => (
  <>
    <defs>
      <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
        {stops.map(([o, c], i) => (
          <stop key={i} offset={o} stopColor={c} />
        ))}
      </linearGradient>
    </defs>
    <rect x={-600} y={-600} width={HW + 1200} height={HH + 1200} fill={`url(#${id})`} />
  </>
);

/** Full-frame paper texture + vignette over every scene, so all scenes share one surface. */
export const PaperFinish: React.FC<{frame: number}> = ({frame}) => (
  <svg width={HW} height={HH} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
    <defs>
      <filter id="fibres" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.09" numOctaves={3} seed={7} />
        <feColorMatrix type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.15  0 0 0 0.55 -0.12" />
      </filter>
      <filter id="grainH" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={Math.floor(frame / 2) % 61} />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <radialGradient id="vig" cx="50%" cy="48%" r="75%">
        <stop offset="60%" stopColor={P.ink} stopOpacity={0} />
        <stop offset="100%" stopColor={P.ink} stopOpacity={0.5} />
      </radialGradient>
    </defs>
    <rect width={HW} height={HH} filter="url(#fibres)" opacity={0.35} style={{mixBlendMode: 'multiply'}} />
    <rect width={HW} height={HH} filter="url(#grainH)" opacity={0.07} style={{mixBlendMode: 'overlay'}} />
    <rect width={HW} height={HH} fill="url(#vig)" />
  </svg>
);

const torn = (w: number, h: number, seed: number) => {
  const pts: string[] = [];
  const n = 18;
  for (let i = 0; i <= n; i++) pts.push(`${-w / 2 + (i / n) * w} ${-h / 2 + (rand(seed + i) - 0.5) * 30}`);
  for (let i = 0; i <= n; i++) pts.push(`${w / 2 + (rand(seed + 40 + i) - 0.5) * 50} ${-h / 2 + (i / n) * h}`);
  for (let i = n; i >= 0; i--) pts.push(`${-w / 2 + (i / n) * w} ${h / 2 + (rand(seed + 80 + i) - 0.5) * 30}`);
  for (let i = n; i >= 0; i--) pts.push(`${-w / 2 + (rand(seed + 120 + i) - 0.5) * 50} ${-h / 2 + (i / n) * h}`);
  return `M ${pts.join(' L ')} Z`;
};

/**
 * The series' transition: a sheet of paper sweeps right→left (the reading direction) and
 * the scene changes underneath it at the cut, while it covers the frame.
 */
export const PaperSweep: React.FC<{frame: number}> = ({frame}) => {
  const t = frame / HFPS;
  const cut = S.cuts.find((c) => Math.abs(t - c) < 0.5);
  if (cut === undefined) return null;
  const i = S.cuts.indexOf(cut);
  const sheet = (lag: number, scale: number, fill: string, seed: number, dy: number) => {
    const k = easeInOut(clamp01((t - (cut - 0.5) - lag) / 1.0));
    const x = lerp(HW * 1.4, -HW * 1.4, k);
    const rot = lerp(-8, 6, k) * (i % 2 ? -1 : 1);
    const w = HW * 1.65 * scale;
    const h = HH * 1.2 * scale;
    return (
      <g transform={`translate(${HW / 2 + x} ${HH / 2 + dy}) rotate(${rot})`}>
        <path d={torn(w, h, seed)} fill={P.ink} opacity={0.25} transform="translate(-26 18)" />
        <path d={torn(w, h, seed)} fill={fill} />
        {Array.from({length: 26}, (_, j) => (
          <line
            key={j}
            x1={-w / 2 + rand(seed + j) * w}
            x2={-w / 2 + rand(seed + j) * w + 60 + rand(j) * 120}
            y1={-h / 2 + rand(seed + j + 50) * h}
            y2={-h / 2 + rand(seed + j + 50) * h + (rand(j + 3) - 0.5) * 20}
            stroke={P.parchmentDeep}
            strokeWidth={3}
            opacity={0.5}
          />
        ))}
      </g>
    );
  };
  return (
    <svg width={HW} height={HH} style={{position: 'absolute', inset: 0}}>
      {sheet(0.07, 0.62, P.parchmentDk, 300 + i * 7, -380)}
      {sheet(0, 1, P.parchment, 100 + i * 13, 0)}
    </svg>
  );
};
