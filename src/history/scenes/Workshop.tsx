import React from 'react';
import {easeIn, easeOut, lerp, prog, sp} from '../../lib';
import {Layer, Motes} from '../kit';
import {Figure, Look, mixPose, pose} from '../rig';
import {HFPS, HH, HW, P, S} from '../theme';

const WORKER: Look = {
  skin: P.skin, robe: P.blue, robeDk: P.night, sash: P.parchment, pants: P.parchmentDeep, shoe: P.woodDk,
  hat: 'cap', hatColor: P.terracotta, hatTrim: P.gold,
};
const WORKER2: Look = {...WORKER, robe: P.ochre, robeDk: P.sandDeep, hatColor: P.blue, skin: P.skinDk};

const Window: React.FC<{x: number; t: number}> = ({x, t}) => (
  <g transform={`translate(${x} 0)`}>
    <path d="M -130 1060 L -130 640 Q -130 470 0 430 Q 130 470 130 640 L 130 1060 Z" fill={P.waterHi} stroke={P.ink} strokeWidth={5} />
    <circle cx={30} cy={700 + Math.sin(t * 0.5) * 3} r={70} fill={P.turquoise} stroke={P.ink} strokeWidth={4} />
    <rect x={-40} y={700} width={140} height={360} fill={P.sand} stroke={P.ink} strokeWidth={4} />
    <rect x={20} y={560} width={20} height={70} fill={P.gold} />
    <path d="M -130 1060 L -130 640 Q -130 470 0 430 Q 130 470 130 640 L 130 1060" fill="none" stroke={P.turquoise} strokeWidth={22} />
    <path d="M -130 1060 L -130 640 Q -130 470 0 430 Q 130 470 130 640 L 130 1060" fill="none" stroke={P.ink} strokeWidth={4} />
  </g>
);

/** Scene 3: a Samarkand paper workshop; one worker pounds pulp, one lifts sheets from the vat. */
export const Workshop: React.FC<{frame: number}> = ({frame}) => {
  const t = frame / HFPS;
  const w = S.workshop;
  const local = t - S.cuts[1];
  const c = {x: local * -5, y: 0, z: 1.06 - prog(t, S.cuts[1], S.cuts[2], easeOut) * 0.05};

  // pounding: slow lift, fast strike
  const u = (((t - w.pound) / w.poundEvery) % 1 + 1) % 1;
  const up = u < 0.62 ? easeOut(u / 0.62) : 1 - easeIn((u - 0.62) / 0.16);
  const strike = u >= 0.78;
  const pp = mixPose(
    {...pose('idle'), fs: 36, fe: 52, bs: 30, be: 56, wr: -90, lean: 14, head: 10},
    {...pose('idle'), fs: 168, fe: 10, bs: 160, be: 14, wr: 0, lean: -8, head: -6},
    Math.max(0, up),
  );
  const hitAge = strike ? (u - 0.78) * w.poundEvery : 1;

  // dipping: down into the vat and up, sheet dripping
  const v = 0.5 - 0.5 * Math.cos(((t - w.lift) / w.liftEvery) * Math.PI * 2);
  const dip = t < w.lift ? 0 : v;
  const dp = {...pose('idle'), fs: 78 - dip * 10, fe: 8, bs: 70 - dip * 10, be: 10, lean: 6 + dip * 26, head: 8 + dip * 10, wr: 0};

  const hung = [0, 1, 2, 3, 4, 5];
  return (
    <svg width={HW} height={HH}>
      <rect width={HW} height={HH} fill={P.sandDk} />
      <Layer depth={0.3} c={c}>
        <rect x={-300} y={-300} width={HW + 600} height={1800} fill={P.sand} />
        {Array.from({length: 14}, (_, r) =>
          Array.from({length: 9}, (_, i) => (
            <rect key={`${r}-${i}`} x={-200 + i * 180 + (r % 2) * 90} y={-100 + r * 90} width={170} height={82} rx={6} fill="none" stroke={P.sandDk} strokeWidth={4} />
          )),
        )}
        <Window x={250} t={t} />
        <Window x={830} t={t} />
        <path d="M 120 470 L 520 1500 L 820 1500 L 380 470 Z" fill={P.goldHi} opacity={0.18} />
        <path d="M 700 470 L 1000 1500 L 1300 1500 L 960 470 Z" fill={P.goldHi} opacity={0.14} />
      </Layer>
      <Layer depth={0.55} c={c}>
        <rect x={-300} y={560} width={HW + 600} height={34} fill={P.woodDk} stroke={P.ink} strokeWidth={4} />
        <path d="M -100 640 Q 540 720 1180 640" fill="none" stroke={P.ink} strokeWidth={4} />
        {hung.map((i) => {
          const x = 30 + i * 175;
          const y = 640 + Math.sin((x / 1280) * Math.PI) * 78 - 6;
          const late = i >= 3;
          const k = late ? sp(frame, w.sheets + (i - 3) * 0.22, {damping: 9, stiffness: 180}, HFPS) : 1;
          if (k <= 0) return null;
          const swing = Math.sin(t * 1.8 + i * 1.3) * 5;
          return (
            <g key={i} transform={`translate(${x} ${y}) rotate(${swing}) scale(1 ${k})`}>
              <rect x={-62} y={0} width={124} height={150} fill={P.cream} stroke={P.ink} strokeWidth={4} />
              <rect x={-8} y={-10} width={16} height={22} rx={3} fill={P.wood} stroke={P.ink} strokeWidth={3} />
            </g>
          );
        })}
      </Layer>
      <Layer depth={0.8} c={c}>
        <rect x={-300} y={1480} width={HW + 600} height={800} fill={P.wood} />
        {Array.from({length: 8}, (_, i) => (
          <line key={i} x1={-300} x2={HW + 300} y1={1520 + i * 70} y2={1520 + i * 70} stroke={P.woodDk} strokeWidth={5} />
        ))}
        <Figure x={680} y={1540} s={0.74} face={-1} pose={pp} look={WORKER} prop="mallet" />
        <path d="M 470 1400 L 610 1400 L 590 1530 L 490 1530 Z" fill={P.mountain} stroke={P.ink} strokeWidth={5} />
        <ellipse cx={540} cy={1400} rx={72} ry={16} fill={P.parchment} stroke={P.ink} strokeWidth={4} />
        {strike &&
          [0, 1, 2, 3].map((i) => (
            <circle key={i} cx={540 + (i - 1.5) * 30 * (1 + hitAge * 6)} cy={1392 - hitAge * 160 + hitAge * hitAge * 300} r={7} fill={P.cream} stroke={P.ink} strokeWidth={2} opacity={1 - hitAge * 3} />
          ))}
        <Figure x={960} y={1520} s={0.72} face={-1} pose={dp} look={WORKER2} prop="mould" />
        <path d="M 740 1340 L 900 1340 L 880 1520 L 760 1520 Z" fill={P.woodDk} stroke={P.ink} strokeWidth={5} />
        <path d={`M 744 1352 Q 820 ${1344 + Math.sin(t * 5) * 6} 896 1352 L 894 1372 L 746 1372 Z`} fill={P.water} />
        {dip < 0.4 && t > w.lift &&
          [0, 1, 2].map((i) => {
            const a = ((t * 2.2 + i * 0.33) % 1);
            return <circle key={i} cx={800 + i * 26} cy={lerp(1290, 1350, a)} r={5} fill={P.waterHi} opacity={1 - a} />;
          })}
      </Layer>
      <Motes t={t} n={22} color={P.goldHi} area={[100, 500, 900, 1000]} />
    </svg>
  );
};
