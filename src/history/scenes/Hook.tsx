import React from 'react';
import {easeOut, prog, sp} from '../../lib';
import {Layer, Motes} from '../kit';
import {HFPS, HH, HW, P, S} from '../theme';

const COAST =
  'M 80 760 C 200 700 260 820 360 780 C 460 740 520 840 640 800 C 760 760 820 700 980 740 M 120 1080 C 240 1020 300 1120 420 1100 C 560 1080 600 980 760 1010 C 860 1030 900 960 1000 980';
const RIVER = 'M 980 880 C 860 920 820 860 700 900 C 600 930 560 1000 460 980 C 360 960 300 1020 180 1000';
const ROUTE = 'M 930 860 C 820 830 760 960 640 940 C 520 920 470 1000 360 980 C 280 966 220 920 150 940';

/** Scene 1: an old map on a desk; the narrator walks in holding up a single sheet of paper. */
export const Hook: React.FC<{frame: number}> = ({frame}) => {
  const t = frame / HFPS;
  const h = S.hook;
  const c = {x: -t * 6, y: t * 4, z: 1.04 + t * 0.012};
  const draw = prog(t, h.mapDraw, h.mapDraw + 4.5, easeOut);
  const swords = sp(frame, h.swords, {damping: 9, stiffness: 220, mass: 0.7}, HFPS);
  const glow = sp(frame, h.glow, {damping: 18, stiffness: 90}, HFPS) * (1 - prog(t, 3.3, 3.8));
  const flicker = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3);
  return (
    <svg width={HW} height={HH}>
      <defs>
        <radialGradient id="lamp" cx="30%" cy="22%" r="70%">
          <stop offset="0%" stopColor={P.goldHi} stopOpacity={0.55 * flicker} />
          <stop offset="100%" stopColor={P.gold} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={HW} height={HH} fill={P.woodDk} />
      <Layer depth={0.5} c={c}>
        {Array.from({length: 12}, (_, i) => (
          <rect key={i} x={-200} y={-200 + i * 200} width={HW + 400} height={196} fill={i % 2 ? P.wood : P.woodDk} opacity={0.6} />
        ))}
      </Layer>
      <Layer depth={0.8} c={c}>
        <g transform="rotate(-3 540 960)">
          <rect x={30} y={600} width={1020} height={980} rx={10} fill={P.ink} opacity={0.3} transform="translate(-14 18)" />
          <rect x={30} y={600} width={1020} height={980} rx={10} fill={P.parchment} />
          <rect x={60} y={630} width={960} height={920} fill="none" stroke={P.parchmentDeep} strokeWidth={6} />
          <path d={COAST} fill="none" stroke={P.inkSoft} strokeWidth={5} strokeDasharray={2400} strokeDashoffset={2400 * (1 - draw)} strokeLinecap="round" />
          <path d={RIVER} fill="none" stroke={P.water} strokeWidth={6} strokeDasharray={1200} strokeDashoffset={1200 * (1 - draw)} />
          {[[240, 880], [300, 900], [820, 1000], [880, 1020], [560, 1140]].map(([x, y], i) => (
            <path key={i} d={`M ${x - 30} ${y} L ${x} ${y - 40} L ${x + 30} ${y}`} fill="none" stroke={P.inkSoft} strokeWidth={5} opacity={prog(t, 0.3 + i * 0.25, 0.8 + i * 0.25)} />
          ))}
          <path d={ROUTE} fill="none" stroke={P.terracotta} strokeWidth={7} strokeDasharray="18 16" strokeDashoffset={-t * 30} opacity={draw} />
          <g transform={`translate(840 1340) rotate(${t * 8})`} opacity={0.75}>
            <circle r={90} fill="none" stroke={P.inkSoft} strokeWidth={4} />
            {[0, 90, 180, 270].map((a) => (
              <path key={a} d="M 0 -110 L 14 0 L 0 14 L -14 0 Z" fill={a === 0 ? P.terracotta : P.inkSoft} transform={`rotate(${a})`} />
            ))}
          </g>
          <g transform={`translate(560 960) scale(${swords}) rotate(${(1 - swords) * 40})`} opacity={Math.min(1, swords * 2)}>
            <circle r={84} fill={P.red} opacity={0.22} />
            {[-1, 1].map((d) => (
              <g key={d} transform={`rotate(${d * 40})`}>
                <rect x={-6} y={-90} width={12} height={130} rx={4} fill={P.ink} />
                <rect x={-26} y={36} width={52} height={10} rx={4} fill={P.ink} />
                <rect x={-5} y={44} width={10} height={30} rx={3} fill={P.ink} />
              </g>
            ))}
          </g>
        </g>
      </Layer>
      <rect width={HW} height={HH} fill="url(#lamp)" />
      {glow > 0.01 && (
        <g transform={`translate(600 1050) rotate(${t * 20})`} opacity={glow}>
          {Array.from({length: 12}, (_, i) => (
            <path key={i} d="M -18 0 L 0 -420 L 18 0 Z" fill={P.goldHi} opacity={0.35} transform={`rotate(${i * 30})`} />
          ))}
          <circle r={130} fill={P.goldHi} opacity={0.35} />
        </g>
      )}
      <Motes t={t} n={30} color={P.goldHi} />
    </svg>
  );
};
