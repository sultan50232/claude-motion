import React from 'react';
import {lerp} from '../lib';
import {P} from './theme';

/**
 * Cutout character rig. Every body part is a flat shape hung on a joint, so a pose is
 * just a set of angles (degrees). Facing right; "forward" angles are positive.
 *   lean/head: forward tilt · fs/fe: front shoulder/elbow · bs/be: back shoulder/elbow
 *   fh/fk, bh/bk: hips/knees · wr: front wrist · bob: pelvis lift (px, up is negative)
 */
export type Pose = {
  lean: number;
  head: number;
  fs: number;
  fe: number;
  bs: number;
  be: number;
  wr: number;
  fh: number;
  fk: number;
  bh: number;
  bk: number;
  bob: number;
  hand: 'fist' | 'open' | 'point';
};

const base: Pose = {lean: 0, head: 0, fs: 8, fe: 14, bs: -6, be: 10, wr: 0, fh: 2, fk: 3, bh: -3, bk: 3, bob: 0, hand: 'fist'};

export const POSES: Record<string, Pose> = {
  idle: base,
  present: {...base, lean: -2, head: -5, fs: 58, fe: 42, wr: -20, hand: 'open'},
  point: {...base, lean: 5, head: 4, fs: 92, fe: 2, bs: -12, hand: 'point'},
  pointUp: {...base, lean: -3, head: -12, fs: 152, fe: 8, hand: 'point'},
  raise: {...base, lean: -3, head: -14, fs: 164, fe: 12, bs: -14, be: 22, hand: 'fist'},
  open: {...base, lean: -5, head: -10, fs: 122, fe: 18, bs: -122, be: -14, hand: 'open'},
  secret: {...base, lean: 4, head: 8, fs: 38, fe: 140, wr: 10, hand: 'point'},
  explain: {...base, lean: 2, head: 3, fs: 34, fe: 108, wr: -10, hand: 'point'},
  cross: {...base, lean: -1, head: 6, fs: 22, fe: 104, bs: 26, be: 100, hand: 'fist'},
  hold: {...base, lean: 1, head: 6, fs: 48, fe: 70, wr: -30, hand: 'fist'},
  shrug: {...base, lean: -2, head: -6, fs: 24, fe: 78, bs: -24, be: 78, hand: 'open'},
};

export const pose = (name: string) => POSES[name] ?? base;

export const mixPose = (a: Pose, b: Pose, k: number): Pose => {
  const out = {...a};
  for (const key of Object.keys(a) as (keyof Pose)[]) {
    if (key === 'hand') continue;
    (out[key] as number) = lerp(a[key] as number, b[key] as number, k);
  }
  out.hand = k > 0.5 ? b.hand : a.hand;
  return out;
};

/** Walk cycle at phase `ph` (radians), blended in by `w`. */
export const walkPose = (p: Pose, ph: number, w: number): Pose => {
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  const walk = {
    ...p,
    lean: p.lean + 4,
    fh: 24 * s,
    bh: -24 * s,
    fk: 6 + 40 * Math.max(0, c) ** 1.5,
    bk: 6 + 40 * Math.max(0, -c) ** 1.5,
    fs: p.fs - 14 * s * (p.fs < 40 ? 1 : 0.2),
    bs: p.bs + 16 * s,
    bob: -7 * (1 + Math.cos(2 * ph)) / 2,
    head: p.head + 1.5 * Math.cos(2 * ph),
  };
  return mixPose(p, walk, w);
};

export type Look = {
  skin: string;
  robe: string;
  robeDk: string;
  sleeve?: string;
  sash: string;
  scarf?: string;
  pants: string;
  shoe: string;
  hat: 'turban' | 'helmet' | 'cap' | 'hood' | 'none';
  hatColor: string;
  hatTrim: string;
  bag?: boolean;
};

/** The narrator's fixed identity: cream turban with a gold pin, teal robe, terracotta scarf, satchel. */
export const NARRATOR: Look = {
  skin: P.skin,
  robe: P.teal,
  robeDk: P.tealDk,
  sash: P.gold,
  scarf: P.terracotta,
  pants: P.parchmentDeep,
  shoe: P.woodDk,
  hat: 'turban',
  hatColor: P.cream,
  hatTrim: P.gold,
  bag: true,
};

const LEG_T = 105;
const LEG_S = 100;
export const LEG = LEG_T + LEG_S + 12;
const ARM_U = 86;
const ARM_F = 78;
const SW = 3.6;

const ink = {stroke: P.ink, strokeWidth: SW, strokeLinejoin: 'round' as const};

const Hand: React.FC<{look: Look; hand: Pose['hand']}> = ({look, hand}) => (
  <g>
    {hand === 'point' && <rect x={-4.5} y={10} width={9} height={30} rx={4.5} fill={look.skin} {...ink} />}
    {hand === 'open' && (
      <path d="M -13 6 Q -16 34 -2 38 Q 14 38 14 6 Z" fill={look.skin} {...ink} />
    )}
    <circle cx={0} cy={11} r={14} fill={look.skin} {...ink} />
    <ellipse cx={11} cy={6} rx={6} ry={8} fill={look.skin} {...ink} />
  </g>
);

export const Prop: React.FC<{name?: string}> = ({name}) => {
  if (!name || name === 'none') return null;
  if (name === 'paper')
    return (
      <g transform="translate(-4 20) rotate(84)">
        <path d="M -44 -54 L 40 -58 L 46 52 L -40 56 Z" fill={P.cream} {...ink} />
        {[-30, -14, 2, 18, 34].map((y) => (
          <line key={y} x1={-28} x2={30} y1={y} y2={y - 2} stroke={P.inkSoft} strokeWidth={3} strokeLinecap="round" />
        ))}
      </g>
    );
  if (name === 'scroll')
    return (
      <g transform="translate(0 12) rotate(90)">
        <rect x={-62} y={-16} width={124} height={32} rx={14} fill={P.parchment} {...ink} />
        <rect x={-72} y={-8} width={12} height={16} rx={4} fill={P.wood} {...ink} />
        <rect x={60} y={-8} width={12} height={16} rx={4} fill={P.wood} {...ink} />
        <line x1={-40} x2={40} y1={0} y2={0} stroke={P.inkSoft} strokeWidth={3} />
      </g>
    );
  if (name === 'book')
    return (
      <g transform="translate(0 18) rotate(90)">
        <rect x={-44} y={-34} width={88} height={64} rx={5} fill={P.rust} {...ink} />
        <rect x={-44} y={22} width={88} height={10} fill={P.cream} {...ink} />
        <path d="M -16 -18 L 0 -26 L 16 -18 L 16 6 L 0 -2 L -16 6 Z" fill={P.gold} />
      </g>
    );
  if (name === 'mallet')
    return (
      <g>
        <rect x={-5} y={-10} width={10} height={110} rx={4} fill={P.wood} {...ink} />
        <rect x={-26} y={88} width={52} height={34} rx={6} fill={P.woodDk} {...ink} />
      </g>
    );
  if (name === 'spear')
    return (
      <g>
        <rect x={-4} y={-150} width={8} height={300} rx={3} fill={P.wood} {...ink} />
        <path d="M 0 196 L 11 150 L -11 150 Z" fill={P.snow} {...ink} />
      </g>
    );
  if (name === 'mould')
    return (
      <g transform="translate(0 14) rotate(90)">
        <rect x={-70} y={-12} width={140} height={24} rx={4} fill={P.wood} {...ink} />
        <rect x={-60} y={-6} width={120} height={12} fill={P.cream} opacity={0.9} />
      </g>
    );
  if (name === 'quill')
    return (
      <g transform="translate(0 16) rotate(-30)">
        <path d="M 0 0 Q 22 -40 6 -86 Q -14 -40 0 0 Z" fill={P.cream} {...ink} />
      </g>
    );
  return null;
};

const Arm: React.FC<{
  x: number;
  y: number;
  sh: number;
  el: number;
  wr?: number;
  look: Look;
  sleeve: string;
  hand: Pose['hand'];
  prop?: string;
}> = ({x, y, sh, el, wr = 0, look, sleeve, hand, prop}) => (
  <g transform={`translate(${x} ${y}) rotate(${-sh})`}>
    <rect x={-16} y={-14} width={32} height={ARM_U + 18} rx={16} fill={sleeve} {...ink} />
    <g transform={`translate(0 ${ARM_U}) rotate(${-el})`}>
      <rect x={-14} y={-10} width={28} height={ARM_F + 6} rx={14} fill={sleeve} {...ink} />
      <rect x={-15} y={ARM_F - 14} width={30} height={12} rx={5} fill={look.sash} {...ink} />
      <g transform={`translate(0 ${ARM_F - 2}) rotate(${-wr})`}>
        <Prop name={prop} />
        <Hand look={look} hand={hand} />
      </g>
    </g>
  </g>
);

const Leg: React.FC<{x: number; hip: number; knee: number; look: Look}> = ({x, hip, knee, look}) => (
  <g transform={`translate(${x} 0) rotate(${-hip})`}>
    <rect x={-17} y={-8} width={34} height={LEG_T + 14} rx={16} fill={look.pants} {...ink} />
    <g transform={`translate(0 ${LEG_T}) rotate(${knee})`}>
      <rect x={-15} y={-8} width={30} height={LEG_S + 10} rx={14} fill={look.pants} {...ink} />
      <path d={`M -16 ${LEG_S - 6} Q -18 ${LEG_S + 14} 4 ${LEG_S + 14} L 34 ${LEG_S + 14} Q 40 ${LEG_S + 2} 14 ${LEG_S - 6} Z`} fill={look.shoe} {...ink} />
    </g>
  </g>
);

const Hat: React.FC<{look: Look}> = ({look}) => {
  const {hat, hatColor, hatTrim} = look;
  if (hat === 'turban')
    return (
      <g>
        <path d="M -40 -64 Q -62 -78 -58 -40 Q -52 -30 -44 -40 Z" fill={hatColor} {...ink} />
        <path d="M -48 -58 C -58 -112 -18 -134 10 -132 C 44 -130 62 -104 54 -58 C 30 -72 -22 -74 -48 -58 Z" fill={hatColor} {...ink} />
        <path d="M -44 -84 C -14 -100 26 -100 54 -80" fill="none" stroke={P.parchmentDeep} strokeWidth={4} strokeLinecap="round" />
        <path d="M -36 -108 C -6 -120 22 -118 44 -104" fill="none" stroke={P.parchmentDeep} strokeWidth={4} strokeLinecap="round" />
        <circle cx={38} cy={-86} r={9} fill={hatTrim} {...ink} />
      </g>
    );
  if (hat === 'helmet')
    return (
      <g>
        <path d="M -50 -56 C -54 -116 54 -116 52 -56 Z" fill={hatColor} {...ink} />
        <path d="M -4 -124 L 2 -150 L 8 -124 Z" fill={hatTrim} {...ink} />
        <rect x={-54} y={-62} width={108} height={12} rx={5} fill={hatTrim} {...ink} />
      </g>
    );
  if (hat === 'cap')
    return <path d="M -46 -62 C -44 -110 48 -112 50 -62 Z" fill={hatColor} {...ink} />;
  if (hat === 'hood')
    return (
      <g>
        <path d="M -56 -20 C -66 -110 -30 -130 6 -128 C 46 -126 62 -100 54 -64 L 40 -64 C 34 -96 -26 -100 -36 -40 Z" fill={hatColor} {...ink} />
        <path d="M -56 -20 C -70 20 -70 60 -56 90 L -34 80 C -42 40 -40 0 -36 -40 Z" fill={hatColor} {...ink} />
      </g>
    );
  return null;
};

/**
 * One cutout figure standing with its feet at (x, y). `drag` (deg) swings the scarf tail and
 * robe hem; feed it velocity so they lag behind the body.
 */
export const Figure: React.FC<{
  x: number;
  y: number;
  s?: number;
  face?: number;
  pose: Pose;
  look: Look;
  prop?: string;
  drag?: number;
  breathe?: number;
  shadow?: boolean;
}> = ({x, y, s = 1, face = 1, pose: p, look, prop, drag = 0, breathe = 0, shadow = true}) => {
  const sleeve = look.sleeve ?? look.robe;
  const sway = drag * 0.6 + (p.fh + p.bh) * 0.15;
  return (
    <g transform={`translate(${x} ${y})`}>
      {shadow && <ellipse cx={0} cy={4} rx={86 * s} ry={14 * s} fill={P.ink} opacity={0.16} />}
      <g transform={`scale(${s * face} ${s}) translate(0 ${-LEG + p.bob})`}>
        <g transform={`rotate(${p.lean})`}>
          <Arm x={-6} y={-168} sh={p.bs} el={p.be} look={look} sleeve={look.robeDk} hand="fist" />
        </g>
        <Leg x={-12} hip={p.bh} knee={p.bk} look={look} />
        <Leg x={12} hip={p.fh} knee={p.fk} look={look} />
        <path
          d={`M -44 -10 L 44 -10 L ${62 + sway} 132 Q ${sway} 144 ${-58 + sway} 132 Z`}
          fill={look.robeDk}
          {...ink}
        />
        <g transform={`rotate(${p.lean}) scale(1 ${1 + breathe * 0.012})`}>
          {look.scarf && (
            <g transform={`translate(-22 -174) rotate(${12 + drag * 1.4})`}>
              <path d="M -6 0 Q -30 60 -14 128 L 8 122 Q 0 62 18 4 Z" fill={look.scarf} {...ink} />
            </g>
          )}
          <path
            d="M -44 0 C -52 -60 -58 -124 -48 -168 Q 0 -194 48 -168 C 58 -124 52 -60 44 0 Z"
            fill={look.robe}
            {...ink}
          />
          <path d="M 0 -184 L 0 -10" stroke={look.robeDk} strokeWidth={5} />
          <rect x={-47} y={-44} width={94} height={22} rx={6} fill={look.sash} {...ink} />
          {look.bag && (
            <g>
              <path d="M 38 -164 L -40 -30" stroke={P.woodDk} strokeWidth={9} strokeLinecap="round" />
              <rect x={-66} y={-46} width={44} height={48} rx={10} fill={P.wood} {...ink} />
              <rect x={-66} y={-46} width={44} height={16} rx={6} fill={P.woodDk} />
            </g>
          )}
          <rect x={-12} y={-198} width={24} height={26} rx={8} fill={look.skin} {...ink} />
          {look.scarf && <ellipse cx={0} cy={-176} rx={42} ry={17} fill={look.scarf} {...ink} />}
          <g transform={`translate(0 -192) rotate(${p.head})`}>
            <ellipse cx={4} cy={-50} rx={46} ry={50} fill={look.skin} {...ink} />
            <path d="M -38 -78 Q -54 -46 -34 -14 Q -20 -6 -8 -4 Q -40 -30 -38 -78 Z" fill={P.skinDk} opacity={0.55} />
            <Hat look={look} />
          </g>
          <Arm
            x={6}
            y={-168}
            sh={p.fs}
            el={p.fe}
            wr={p.wr}
            look={look}
            sleeve={sleeve}
            hand={p.hand}
            prop={prop}
          />
        </g>
      </g>
    </g>
  );
};
