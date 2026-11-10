import React from 'react';
import {easeOut, prog} from '../../lib';
import {Birds, Layer, Sky} from '../kit';
import {HF, HFPS, HH, HW, P, S} from '../theme';

const ink = {stroke: P.ink, strokeWidth: 4, strokeLinejoin: 'round' as const};

const CamelLeg: React.FC<{x: number; ph: number}> = ({x, ph}) => (
  <g transform={`translate(${x} -205) rotate(${22 * Math.sin(ph)})`}>
    <rect x={-11} y={-6} width={22} height={104} rx={10} fill={P.sandDk} {...ink} />
    <g transform={`translate(0 96) rotate(${-26 * Math.max(0, Math.cos(ph))})`}>
      <rect x={-9} y={-4} width={18} height={104} rx={8} fill={P.sandDk} {...ink} />
      <ellipse cx={4} cy={102} rx={18} ry={9} fill={P.sandDeep} {...ink} />
    </g>
  </g>
);

/** A camel walking in place, facing right; flip with scale(-1 1). Carries bundles of paper. */
export const Camel: React.FC<{ph: number; bells?: boolean}> = ({ph}) => {
  const bob = 5 * Math.sin(2 * ph);
  return (
    <g>
      <ellipse cx={0} cy={4} rx={150} ry={16} fill={P.ink} opacity={0.15} />
      <CamelLeg x={-70} ph={ph + Math.PI} />
      <CamelLeg x={86} ph={ph} />
      <g transform={`translate(0 ${bob})`}>
        <path d="M -120 -250 Q -140 -200 -150 -150" fill="none" stroke={P.sandDeep} strokeWidth={8} strokeLinecap="round" />
        <path d="M -130 -230 C -140 -300 -70 -330 -20 -380 C 30 -330 80 -300 120 -270 C 140 -230 120 -190 60 -186 L -90 -186 C -130 -190 -130 -210 -130 -230 Z" fill={P.sand} {...ink} />
        <g transform="translate(-20 -380)">
          {[-1, 0, 1].map((i) => (
            <g key={i} transform={`translate(${i * 40} ${-10 - Math.abs(i) * -8})`}>
              <rect x={-18} y={-50} width={36} height={86} rx={16} fill={P.cream} {...ink} />
              <ellipse cx={0} cy={-50} rx={18} ry={8} fill={P.parchmentDk} {...ink} />
            </g>
          ))}
          <path d="M -70 20 L 70 20" stroke={P.terracotta} strokeWidth={10} />
        </g>
        <rect x={-70} y={-240} width={150} height={30} rx={8} fill={P.terracotta} {...ink} />
        <g transform={`translate(110 -250) rotate(${-6 + 6 * Math.sin(ph * 2)})`}>
          <path d="M -10 0 C 20 -40 40 -100 60 -130 L 92 -118 C 70 -80 50 -20 30 12 Z" fill={P.sand} {...ink} />
          <ellipse cx={92} cy={-130} rx={40} ry={22} fill={P.sand} {...ink} />
          <ellipse cx={70} cy={-148} rx={8} ry={12} fill={P.sandDk} {...ink} />
          <path d="M 0 0 L 4 24" stroke={P.ink} strokeWidth={3} />
          <circle cx={4} cy={30} r={8} fill={P.gold} {...ink} />
        </g>
      </g>
      <CamelLeg x={-50} ph={ph} />
      <CamelLeg x={106} ph={ph + Math.PI} />
    </g>
  );
};

const dune = (y: number, amp: number, seed: number) => {
  const pts: string[] = [];
  for (let i = 0; i <= 16; i++) {
    const x = i * 100;
    pts.push(`${x} ${y - amp * (0.5 + 0.5 * Math.sin(i * 0.7 + seed)) * (0.6 + 0.4 * Math.sin(i * 1.9 + seed * 2))}`);
  }
  return `M 0 ${y + 900} L ${pts.join(' L ')} L 1600 ${y + 900} Z`;
};

/** Repeats a 1600 px wide strip so it scrolls forever. */
const Strip: React.FC<{off: number; children: React.ReactNode}> = ({off, children}) => {
  const o = ((off % 1600) + 1600) % 1600;
  return (
    <g>
      <g transform={`translate(${o - 1600 - 260} 0)`}>{children}</g>
      <g transform={`translate(${o - 260} 0)`}>{children}</g>
    </g>
  );
};

/** Scene 4: the Silk Road; parallax dunes scroll while the caravan and narrator walk west. */
export const Caravan: React.FC<{frame: number}> = ({frame}) => {
  const t = frame / HFPS;
  const cv = S.caravan;
  const t0 = S.cuts[2];
  const stop = S.narrator.find((k) => k.t > t0 && k.walk === false)?.t ?? S.cuts[3];
  const d = 0.35;
  const x = Math.max(0, t - stop);
  const tau = Math.min(t, stop) - t0 + Math.min(x, d) - Math.min(x, d) ** 2 / (2 * d);
  const c = {x: 0, y: 0, z: 1 + prog(t, t0, S.cuts[3], easeOut) * 0.04};
  const skyline = prog(t, cv.skyline, cv.skyline + 1.4, easeOut);
  const signX = -260 + (tau - (cv.sign - t0)) * 300;
  return (
    <svg width={HW} height={HH}>
      <Layer depth={0.05} c={c}>
        <Sky id="caravanSky" stops={[[0, P.dusk2], [0.45, P.dusk1], [0.62, P.cream]]} />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={720} cy={860} r={130 + i * 40 + Math.sin(t * 2 + i) * 6} fill={P.goldHi} opacity={0.28 - i * 0.08} />
        ))}
        <circle cx={720} cy={860} r={120} fill={P.goldHi} />
        <Birds t={t - t0} x={900} y={700} n={3} />
        <g transform={`translate(0 ${(1 - skyline) * 120})`} opacity={skyline}>
          <ellipse cx={180} cy={1060} rx={260} ry={60} fill={P.goldHi} opacity={0.5} />
          {[[60, 50], [140, 80], [230, 60], [300, 40]].map(([dx, r], i) => (
            <g key={i}>
              <rect x={dx - r * 0.7} y={1060 - r * 1.1} width={r * 1.4} height={r * 1.1} fill={P.sandDeep} />
              <path d={`M ${dx - r * 0.75} ${1060 - r * 1.05} Q ${dx} ${1060 - r * 2.6} ${dx + r * 0.75} ${1060 - r * 1.05} Z`} fill={P.sandDeep} />
            </g>
          ))}
          <rect x={190} y={900} width={18} height={160} fill={P.sandDeep} />
        </g>
      </Layer>
      <Layer depth={0.15} c={c}>
        <Strip off={tau * 30}>
          <path d={dune(1080, 90, 1)} fill={P.dusk1} {...ink} />
        </Strip>
      </Layer>
      <Layer depth={0.4} c={c}>
        <Strip off={tau * 90}>
          <path d={dune(1200, 120, 4)} fill={P.sand} {...ink} />
        </Strip>
      </Layer>
      <Layer depth={0.6} c={c}>
        <Strip off={tau * 180}>
          <path d={dune(1400, 70, 2.3)} fill={P.sandDk} {...ink} />
          {[200, 900, 1350].map((sx) => (
            <path key={sx} d={`M ${sx} 1380 l 14 -40 l 14 40 Z`} fill={P.greenDk} />
          ))}
        </Strip>
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${250 + i * 330} ${1420 - i * 8}) scale(${-0.78 + i * 0.03} 0.78)`}>
            <Camel ph={tau * Math.PI * 2 * 0.9 + i * 1.1} />
          </g>
        ))}
      </Layer>
      <Layer depth={0.85} c={c}>
        <g transform={`translate(${signX} 1640)`}>
          <rect x={-10} y={-330} width={20} height={330} fill={P.wood} {...ink} />
          <path d="M -150 -320 L 110 -320 L 110 -240 L -150 -240 L -190 -280 Z" fill={P.parchment} {...ink} />
          <text x={-30} y={-262} textAnchor="middle" fontFamily={HF.kufi} fontWeight={700} fontSize={50} fill={P.ink}>
            بغداد
          </text>
          <path d="M -110 -220 L 150 -220 L 190 -180 L 150 -140 L -110 -140 Z" fill={P.parchmentDk} {...ink} />
          <text x={30} y={-162} textAnchor="middle" fontFamily={HF.kufi} fontWeight={700} fontSize={44} fill={P.inkSoft}>
            سمرقند
          </text>
        </g>
      </Layer>
      <Layer depth={1} c={c}>
        <Strip off={tau * 300}>
          <path d={dune(1720, 40, 5.1)} fill={P.sandDeep} {...ink} />
          {[120, 520, 980, 1300].map((sx, i) => (
            <ellipse key={sx} cx={sx} cy={1800 + (i % 2) * 40} rx={34} ry={16} fill={P.mountainDk} {...ink} />
          ))}
        </Strip>
      </Layer>
    </svg>
  );
};
