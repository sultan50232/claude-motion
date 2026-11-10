import React from 'react';
import {easeIn, easeOut, lerp, prog, rand, sp} from '../../lib';
import {Layer, Motes, Palm, Sky} from '../kit';
import {Figure, Look, pose} from '../rig';
import {HF, HFPS, HH, HW, P, S} from '../theme';

const ink = {stroke: P.ink, strokeWidth: 4, strokeLinejoin: 'round' as const};
const WINDOW = {x: 560, y: 1000};

const Dome: React.FC<{x: number; y: number; r: number; fill: string}> = ({x, y, r, fill}) => (
  <g>
    <rect x={x - r} y={y} width={r * 2} height={r * 1.2} fill={P.sand} {...ink} />
    <path d={`M ${x - r} ${y} Q ${x - r} ${y - r * 1.4} ${x} ${y - r * 1.7} Q ${x + r} ${y - r * 1.4} ${x + r} ${y} Z`} fill={fill} {...ink} />
    <line x1={x} y1={y - r * 1.7} x2={x} y2={y - r * 2.1} stroke={P.ink} strokeWidth={4} />
    <circle cx={x} cy={y - r * 2.15} r={7} fill={P.gold} />
  </g>
);

const Exterior: React.FC<{frame: number}> = ({frame}) => {
  const t = frame / HFPS;
  const b = S.baghdad;
  const local = t - S.cuts[3];
  const dolly = prog(t, b.dolly, b.inside, easeIn);
  const z = lerp(1.0 + local * 0.012, 13, dolly);
  const k = dolly;
  const c = {x: ((WINDOW.x - HW / 2) / 0.25) * k + local * 4, y: ((WINDOW.y - HH / 2) / 0.25) * k, z};
  const wheel = (t - b.wheel) * 50;
  const hammer = Math.max(0, Math.sin((t - b.wheel) * Math.PI * 2 * 0.9)) ** 3;
  return (
    <svg width={HW} height={HH}>
      <Layer depth={0.04} c={c}>
        <Sky id="bagSky" stops={[[0, P.night], [0.42, P.nightHi], [0.6, P.dusk3], [0.66, P.dusk2]]} />
        {Array.from({length: 30}, (_, i) => (
          <circle key={i} cx={rand(i) * HW} cy={rand(i + 40) * 900} r={2 + rand(i + 2) * 2.5} fill={P.cream} opacity={0.3 + 0.5 * Math.abs(Math.sin(t * 2 + i))} />
        ))}
        <path d="M 860 260 a 70 70 0 1 0 50 120 a 56 56 0 1 1 -50 -120 Z" fill={P.goldHi} />
      </Layer>
      <Layer depth={0.25} c={c}>
        <rect x={-400} y={1080} width={HW + 800} height={200} fill={P.sandDk} {...ink} />
        {Array.from({length: 30}, (_, i) => (
          <rect key={i} x={-400 + i * 64} y={1060} width={34} height={24} fill={P.sandDk} {...ink} />
        ))}
        <Dome x={200} y={1020} r={90} fill={P.turquoise} />
        <Dome x={860} y={1030} r={80} fill={P.gold} />
        <rect x={380} y={880} width={360} height={220} fill={P.sand} {...ink} />
        <Dome x={560} y={880} r={140} fill={P.teal} />
        <path d={`M ${WINDOW.x - 46} 1090 L ${WINDOW.x - 46} 1000 Q ${WINDOW.x} 930 ${WINDOW.x + 46} 1000 L ${WINDOW.x + 46} 1090 Z`} fill={P.goldHi} {...ink} />
        <rect x={1000} y={700} width={44} height={380} fill={P.sand} {...ink} />
        <rect x={990} y={760} width={64} height={18} fill={P.gold} {...ink} />
        <path d="M 1000 700 L 1022 640 L 1044 700 Z" fill={P.teal} {...ink} />
        {[120, 300, 700, 900].map((x) => (
          <rect key={x} x={x} y={1150} width={22} height={34} rx={10} fill={P.goldHi} opacity={0.6 + 0.4 * Math.sin(t * 3 + x)} />
        ))}
      </Layer>
      <Layer depth={0.5} c={c}>
        <Palm x={80} y={1290} s={0.9} t={t} />
        <Palm x={980} y={1300} s={0.8} t={t} seed={2} />
      </Layer>
      <Layer depth={0.7} c={c}>
        <rect x={-500} y={1270} width={HW + 1000} height={320} fill={P.water} />
        {Array.from({length: 12}, (_, i) => {
          const x = ((i * 160 - local * 90) % 1800 + 1800) % 1800 - 400;
          return <line key={i} x1={x} x2={x + 70} y1={1300 + (i % 4) * 60} y2={1300 + (i % 4) * 60} stroke={P.waterHi} strokeWidth={5} strokeLinecap="round" />;
        })}
        <g transform={`translate(${900 - local * 40} ${1330 + Math.sin(t * 2) * 6}) rotate(${Math.sin(t * 1.6) * 3})`}>
          <path d="M -90 0 L 90 0 L 60 36 L -60 36 Z" fill={P.wood} {...ink} />
          <line x1={0} y1={0} x2={0} y2={-150} stroke={P.ink} strokeWidth={6} />
          <path d={`M 4 -146 Q ${70 + Math.sin(t * 3) * 8} -80 4 -14 Z`} fill={P.cream} {...ink} />
        </g>
        <rect x={660} y={1110} width={280} height={170} fill={P.sandDk} {...ink} />
        <path d="M 640 1110 L 800 1030 L 960 1110 Z" fill={P.terracotta} {...ink} />
        <rect x={830} y={1170} width={60} height={110} fill={P.ink} opacity={0.6} />
        <g transform={`translate(800 1040) rotate(${-14 + hammer * 22})`}>
          <rect x={-120} y={-8} width={200} height={16} fill={P.wood} {...ink} />
          <rect x={-140} y={-26} width={40} height={52} fill={P.woodDk} {...ink} />
        </g>
        <g transform={`translate(640 1290) rotate(${wheel})`}>
          <circle r={130} fill="none" stroke={P.wood} strokeWidth={16} />
          <circle r={130} fill="none" stroke={P.ink} strokeWidth={4} />
          {Array.from({length: 10}, (_, i) => (
            <g key={i} transform={`rotate(${i * 36})`}>
              <line x1={0} y1={0} x2={0} y2={-130} stroke={P.woodDk} strokeWidth={8} />
              <rect x={-16} y={-150} width={32} height={26} fill={P.wood} {...ink} />
            </g>
          ))}
          <circle r={22} fill={P.woodDk} {...ink} />
        </g>
        {Array.from({length: 16}, (_, i) => {
          const t0 = b.burst + i * 0.07;
          const a = (t - t0) / 2.6;
          if (a < 0 || a > 1) return null;
          const e = easeOut(a);
          const x = 860 + lerp(0, (rand(i) - 0.65) * 1100, e);
          const y = 1180 - e * (500 + rand(i + 3) * 500) + a * a * 240;
          const flip = Math.cos(t * (6 + rand(i) * 4) + i);
          return (
            <g key={i} transform={`translate(${x} ${y}) rotate(${t * 90 * (rand(i + 1) - 0.5) + i * 20}) scale(${flip} 1)`} opacity={1 - a * a}>
              <rect x={-30} y={-38} width={60} height={76} fill={P.cream} {...ink} />
              <line x1={-18} x2={18} y1={-16} y2={-16} stroke={P.inkSoft} strokeWidth={3} />
              <line x1={-18} x2={14} y1={0} y2={0} stroke={P.inkSoft} strokeWidth={3} />
            </g>
          );
        })}
      </Layer>
      <Layer depth={1} c={c}>
        <path d="M -400 1600 C 0 1560 400 1620 700 1580 C 900 1560 1100 1590 1500 1570 L 1500 2400 L -400 2400 Z" fill={P.sandDk} {...ink} />
        {Array.from({length: 10}, (_, i) => {
          const x = i * 120 + 10;
          const sw = Math.sin(t * 1.8 + i) * 8;
          return <path key={i} d={`M ${x} 1610 Q ${x + sw} 1520 ${x + sw * 2} 1470`} stroke={P.greenDk} strokeWidth={7} fill="none" strokeLinecap="round" />;
        })}
      </Layer>
    </svg>
  );
};

const SCHOLAR: Look = {
  skin: P.skin, robe: P.cream, robeDk: P.parchmentDk, sash: P.teal, pants: P.parchmentDeep, shoe: P.woodDk,
  hat: 'hood', hatColor: P.terracotta, hatTrim: P.gold,
};
const SCHOLAR2: Look = {...SCHOLAR, robe: P.rust, robeDk: P.wood, sash: P.gold, hat: 'turban', hatColor: P.cream, skin: P.skinDk};
const BOOKS = [P.rust, P.teal, P.gold, P.blue, P.terracotta, P.greenDk, P.ochre];

const Interior: React.FC<{frame: number}> = ({frame}) => {
  const t = frame / HFPS;
  const b = S.baghdad;
  const settle = prog(t, b.inside, b.inside + 1.2, easeOut);
  const c = {x: (t - b.inside) * -4, y: 0, z: lerp(1.3, 1.02, settle)};
  const astro = sp(frame, b.astrolabe, {damping: 10, stiffness: 160}, HFPS);
  const write = Math.sin(t * 11) * 6;
  return (
    <svg width={HW} height={HH}>
      <rect width={HW} height={HH} fill={P.parchmentDeep} />
      <Layer depth={0.3} c={c}>
        <rect x={-300} y={-300} width={HW + 600} height={2400} fill={P.parchmentDk} />
        {[-1, 0, 1].map((col) => {
          const x = 540 + col * 330;
          return (
            <g key={col}>
              <path d={`M ${x - 140} 1420 L ${x - 140} 860 Q ${x - 140} 700 ${x} 640 Q ${x + 140} 700 ${x + 140} 860 L ${x + 140} 1420 Z`} fill={P.woodDk} {...ink} />
              <path d={`M ${x - 140} 1420 L ${x - 140} 860 Q ${x - 140} 700 ${x} 640 Q ${x + 140} 700 ${x + 140} 860 L ${x + 140} 1420`} fill="none" stroke={P.turquoise} strokeWidth={18} />
              {[0, 1, 2, 3].map((r) => (
                <g key={r}>
                  <rect x={x - 120} y={900 + r * 130} width={240} height={12} fill={P.wood} />
                  {Array.from({length: 8}, (_, i) => {
                    const n = (col + 1) * 32 + r * 8 + i;
                    const k = sp(frame, b.books + (rand(n) * 1.6 + r * 0.25), {damping: 10, stiffness: 220, mass: 0.6}, HFPS);
                    const hgt = 70 + rand(n + 5) * 34;
                    return (
                      <rect
                        key={i}
                        x={x - 112 + i * 29}
                        y={900 + r * 130 - hgt * k}
                        width={25}
                        height={hgt * k}
                        fill={BOOKS[n % BOOKS.length]}
                        stroke={P.ink}
                        strokeWidth={3}
                        opacity={r < 2 && i < 3 ? 1 : k > 0 ? 1 : 0}
                      />
                    );
                  })}
                </g>
              ))}
            </g>
          );
        })}
      </Layer>
      <Layer depth={0.5} c={c}>
        {[260, 820].map((x, i) => {
          const sw = Math.sin(t * 1.3 + i * 2) * 6;
          const fl = 0.8 + 0.2 * Math.sin(t * 14 + i) * Math.sin(t * 9);
          return (
            <g key={x} transform={`translate(${x} 300) rotate(${sw})`}>
              <line x1={0} y1={0} x2={0} y2={330} stroke={P.ink} strokeWidth={4} />
              <circle cx={0} cy={380} r={110 * fl} fill={P.goldHi} opacity={0.22} />
              <path d="M -40 340 L 40 340 L 26 400 L -26 400 Z" fill={P.gold} {...ink} />
              <ellipse cx={0} cy={330 - 10 * fl} rx={9} ry={18 * fl} fill={P.goldHi} />
            </g>
          );
        })}
        <g transform={`translate(250 860) scale(${astro})`} opacity={Math.min(1, astro * 2)}>
          <circle r={120} fill={P.gold} {...ink} />
          <circle r={96} fill={P.ochre} {...ink} />
          <g transform={`rotate(${(t - b.astrolabe) * 30})`}>
            <circle cx={0} cy={-16} r={56} fill="none" stroke={P.goldHi} strokeWidth={6} />
            <path d="M -80 0 L 80 0 M 0 -80 L 0 80" stroke={P.goldHi} strokeWidth={5} />
            <path d="M 0 -84 L 10 -60 L -10 -60 Z" fill={P.goldHi} />
          </g>
          <circle r={10} fill={P.ink} />
          <rect x={-14} y={-150} width={28} height={34} rx={8} fill={P.gold} {...ink} />
        </g>
      </Layer>
      <Layer depth={0.75} c={c}>
        <rect x={-300} y={1480} width={HW + 600} height={800} fill={P.wood} />
        <Figure x={250} y={1520} s={0.66} face={1} pose={{...pose('hold'), fs: 60, fe: 40 + write, wr: -40, head: 16, lean: 10}} look={SCHOLAR} prop="quill" />
        <Figure x={600} y={1520} s={0.66} face={-1} pose={{...pose('hold'), fe: 80 + Math.sin(t * 1.5) * 6, head: 14 + Math.sin(t * 0.8) * 3}} look={SCHOLAR2} prop="book" />
        <path d="M 300 1380 L 520 1380 L 500 1530 L 320 1530 Z" fill={P.woodDk} {...ink} />
        <path d="M 290 1350 L 530 1350 L 520 1386 L 300 1386 Z" fill={P.cream} {...ink} />
        {Array.from({length: 7}, (_, i) => {
          const a = ((t * 0.35 + rand(i)) % 1);
          return (
            <text key={i} x={330 + rand(i + 3) * 180 + Math.sin(t * 2 + i) * 14} y={1340 - a * 520} fontFamily={HF.kufi} fontSize={44 + rand(i) * 20} fill={P.rust} opacity={Math.sin(Math.PI * a) * 0.7}>
              {'علمحكة'[i % 6]}
            </text>
          );
        })}
      </Layer>
      <Motes t={t} n={26} color={P.goldHi} />
    </svg>
  );
};

/** Scene 5: Baghdad at dusk with the paper mill, then a dolly through a window into the House of Wisdom. */
export const Baghdad: React.FC<{frame: number}> = ({frame}) => {
  const t = frame / HFPS;
  const b = S.baghdad;
  const flash = t < b.inside ? prog(t, b.inside - 0.25, b.inside, easeIn) : 1 - prog(t, b.inside, b.inside + 0.35, easeOut);
  return (
    <>
      {t < b.inside ? <Exterior frame={frame} /> : <Interior frame={frame} />}
      <div style={{position: 'absolute', inset: 0, background: P.goldHi, opacity: flash}} />
    </>
  );
};
