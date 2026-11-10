import React from 'react';
import {clamp01, easeInOut, easeOut, prog, rand, sp} from '../../lib';
import {Layer, Motes} from '../kit';
import {HF, HFPS, HH, HW, P, S} from '../theme';

const ink = {stroke: P.ink, strokeWidth: 4, strokeLinejoin: 'round' as const};

/** City stops, east → west. Index 0 is where the route starts. */
const CITIES = [
  {name: 'سمرقند', x: 930, y: 900},
  {name: 'بغداد', x: 700, y: 1040},
  {name: 'دمشق', x: 540, y: 960},
  {name: 'القاهرة', x: 400, y: 1130},
  {name: 'الأندلس', x: 130, y: 900},
];
const ROUTE = 'M 930 900 C 860 960 780 1010 700 1040 C 640 1010 590 980 540 960 C 490 1020 450 1090 400 1130 C 320 1080 200 960 130 900';

/** Scene 6: the route of paper drawn west across an old map, then the follow call-to-action. */
export const Finale: React.FC<{frame: number}> = ({frame}) => {
  const t = frame / HFPS;
  const f = S.finale;
  const t0 = S.cuts[4];
  const c = {x: -(t - t0) * 5, y: 0, z: 1.08 - prog(t, t0, S.duration, easeOut) * 0.06};
  const draw = prog(t, f.route, f.cities[f.cities.length - 1] + 0.2, easeInOut);
  const cta = sp(frame, f.cta, {damping: 8, stiffness: 200}, HFPS);
  const pulse = t > f.cta + 0.6 ? 1 + 0.05 * Math.sin((t - f.cta) * 6) : 1;
  return (
    <svg width={HW} height={HH}>
      <rect width={HW} height={HH} fill={P.woodDk} />
      <Layer depth={0.6} c={c}>
        <g transform="rotate(2 540 1000)">
          <rect x={20} y={620} width={1040} height={760} rx={12} fill={P.ink} opacity={0.3} transform="translate(-14 18)" />
          <rect x={20} y={620} width={1040} height={760} rx={12} fill={P.parchment} />
          <rect x={46} y={646} width={988} height={708} fill="none" stroke={P.parchmentDeep} strokeWidth={6} />
          <path d="M 46 1020 C 140 1000 240 1060 330 1040 C 400 1020 460 1060 520 1030 L 520 1110 C 460 1150 380 1180 300 1170 C 200 1160 120 1200 46 1180 Z" fill={P.waterHi} opacity={0.6} {...ink} strokeOpacity={0.4} />
          <path d="M 760 1100 C 800 1160 860 1180 900 1240 L 1034 1240 L 1034 1354 L 700 1354 C 740 1290 740 1180 760 1100 Z" fill={P.waterHi} opacity={0.6} {...ink} strokeOpacity={0.4} />
          <path d={ROUTE} fill="none" stroke={P.inkFaint} strokeWidth={8} strokeDasharray="14 14" />
          <path d={ROUTE} fill="none" stroke={P.terracotta} strokeWidth={10} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} />
          {CITIES.map((city, i) => {
            const at = i === 0 ? f.route : f.cities[i - 1];
            const k = sp(frame, at, {damping: 9, stiffness: 220, mass: 0.6}, HFPS);
            const ring = clamp01((t - at) / 0.8);
            return (
              <g key={city.name} transform={`translate(${city.x} ${city.y})`}>
                {ring < 1 && ring > 0 && <circle r={20 + ring * 60} fill="none" stroke={P.terracotta} strokeWidth={5} opacity={1 - ring} />}
                <circle r={18 * k} fill={i === 1 ? P.gold : P.terracotta} {...ink} />
                <text y={-34} textAnchor="middle" fontFamily={HF.kufi} fontWeight={700} fontSize={42} fill={P.ink} opacity={clamp01(k)} transform={`scale(${0.6 + 0.4 * clamp01(k)})`}>
                  {city.name}
                </text>
              </g>
            );
          })}
          {Array.from({length: 6}, (_, i) => {
            const k = clamp01(draw * 1.1 - i * 0.12);
            if (k <= 0 || k >= 1) return null;
            const idx = Math.min(CITIES.length - 2, Math.floor(k * (CITIES.length - 1)));
            const u = k * (CITIES.length - 1) - idx;
            const a = CITIES[idx];
            const b = CITIES[idx + 1];
            const x = a.x + (b.x - a.x) * u;
            const y = a.y + (b.y - a.y) * u - 110 - Math.sin(t * 3 + i) * 14;
            return (
              <g key={i} transform={`translate(${x} ${y}) rotate(${Math.sin(t * 4 + i) * 20}) scale(${Math.cos(t * 7 + i)} 1)`}>
                <rect x={-16} y={-20} width={32} height={40} fill={P.cream} {...ink} strokeWidth={3} />
              </g>
            );
          })}
        </g>
      </Layer>
      <g transform={`translate(330 1440) scale(${cta * pulse}) rotate(${(1 - cta) * -10})`} opacity={clamp01(cta * 2)}>
        <rect x={-250} y={-58} width={500} height={116} rx={58} fill={P.terracotta} stroke={P.ink} strokeWidth={6} />
        <circle cx={-182} cy={0} r={38} fill={P.cream} stroke={P.ink} strokeWidth={4} />
        <path d="M -182 -18 L -182 18 M -200 0 L -164 0" stroke={P.terracotta} strokeWidth={8} strokeLinecap="round" />
        <text x={30} y={18} textAnchor="middle" fontFamily={HF.kufi} fontWeight={700} fontSize={52} fill={P.cream}>
          تابِع للجزء ٢
        </text>
      </g>
      <Motes t={t} n={24} color={P.goldHi} />
      {Array.from({length: 10}, (_, i) => {
        const a = ((t - t0) * 0.18 + rand(i)) % 1;
        const x = rand(i + 2) * HW + Math.sin(t + i) * 40;
        const y = HH + 60 - a * (HH + 120);
        return (
          <rect key={i} x={x} y={y} width={26} height={34} fill={P.cream} stroke={P.ink} strokeWidth={3} opacity={0.5} transform={`rotate(${t * 40 + i * 30} ${x} ${y})`} />
        );
      })}
    </svg>
  );
};
