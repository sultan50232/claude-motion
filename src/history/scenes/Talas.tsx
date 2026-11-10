import React from 'react';
import {easeInOut, easeOut, lerp, prog, rand} from '../../lib';
import {Birds, flagPath, Layer, Puff, Sky} from '../kit';
import {Figure, Look, mixPose, pose, walkPose} from '../rig';
import {HFPS, HH, HW, P, S} from '../theme';

const TANG: Look = {
  skin: P.skin, robe: P.red, robeDk: P.rust, sash: P.gold, pants: P.black, shoe: P.black,
  hat: 'helmet', hatColor: P.rust, hatTrim: P.gold,
};
const ABBASID: Look = {
  skin: P.skinDk, robe: P.black, robeDk: '#1A1411', sash: P.snow, pants: P.parchmentDeep, shoe: P.woodDk,
  hat: 'turban', hatColor: P.black, hatTrim: P.snow, scarf: P.snow,
};

const GROUND = 1250;
const MID = 430;

const Army: React.FC<{t: number; side: -1 | 1; look: Look; flag: string}> = ({t, side, look, flag}) => {
  const tl = S.talas;
  const advance = prog(t, tl.march, tl.clash, easeInOut);
  const fight = t > tl.clash;
  return (
    <g>
      {[1, 0].map((row) =>
        Array.from({length: 5}, (_, i) => {
          const n = row * 5 + i;
          const home = MID + side * (150 + i * 78 + row * 40);
          const front = MID + side * (46 + i * 62 + row * 34);
          const x = lerp(home + side * 160, front, advance) + (fight ? Math.sin(t * 7 + n) * 10 : 0);
          const y = GROUND - row * 46;
          const ph = t * Math.PI * 2 * 1.4 + n;
          const thrust = fight ? Math.max(0, Math.sin(t * 6 + n * 1.9)) : 0;
          let p = mixPose(pose('idle'), {...pose('hold'), fs: 70, fe: 20, wr: 90}, 1);
          p = mixPose(p, {...p, fs: 92, fe: 0, wr: 0, lean: 10}, fight ? 0.6 + 0.4 * thrust : 0);
          p = walkPose(p, ph, advance < 1 && t > tl.march ? 1 : fight ? 0.3 : 0);
          return (
            <g key={n} opacity={row ? 0.9 : 1}>
              {i % 2 === 0 && row === 1 && (
                <g>
                  <rect x={x - 5} y={y - 400} width={10} height={370} fill={P.wood} stroke={P.ink} strokeWidth={3} />
                  <path d={flagPath(x + side * 5, y - 396, side * 110, 76, t + n, 7, 7)} fill={flag} stroke={P.ink} strokeWidth={3} />
                </g>
              )}
              <Figure x={x} y={y} s={0.46 - row * 0.05} face={-side} pose={p} look={look} prop="spear" drag={Math.sin(t * 5 + n) * 6} />
            </g>
          );
        }),
      )}
    </g>
  );
};

/** Scene 2: the river Talas at dusk, two armies march in and clash, a volley of arrows. */
export const Talas: React.FC<{frame: number}> = ({frame}) => {
  const t = frame / HFPS;
  const tl = S.talas;
  const local = t - S.cuts[0];
  const shake = t > tl.clash ? Math.exp(-(t - tl.clash) / 0.25) * 18 : 0;
  const c = {
    x: Math.sin(t * 47) * shake + local * 4,
    y: Math.cos(t * 39) * shake * 0.7,
    z: 1 + prog(t, S.cuts[0], S.cuts[1], easeOut) * 0.08 + (t > tl.clash ? Math.exp(-(t - tl.clash) / 0.3) * 0.04 : 0),
  };
  return (
    <svg width={HW} height={HH}>
      <Layer depth={0.05} c={c}>
        <Sky id="talasSky" stops={[[0, P.dusk3], [0.35, P.dusk2], [0.6, P.dusk1]]} />
        <circle cx={300} cy={820} r={120} fill={P.goldHi} opacity={0.85} />
        <Birds t={t} x={800} y={640} />
      </Layer>
      <Layer depth={0.15} c={c}>
        <path d="M -200 1000 L 60 760 L 200 880 L 380 700 L 560 900 L 740 720 L 900 860 L 1100 690 L 1300 1000 Z" fill={P.mountain} stroke={P.ink} strokeWidth={4} />
        <path d="M 330 746 L 380 700 L 430 750 L 400 740 L 380 760 Z M 690 770 L 740 720 L 790 772 L 760 764 Z M 1050 730 L 1100 690 L 1150 736 Z" fill={P.snow} />
      </Layer>
      <Layer depth={0.3} c={c}>
        <path d="M -200 1080 C 100 940 300 1010 520 960 C 760 910 900 990 1300 940 L 1300 1300 L -200 1300 Z" fill={P.mountainDk} stroke={P.ink} strokeWidth={4} />
      </Layer>
      <Layer depth={0.6} c={c}>
        <rect x={-300} y={1060} width={HW + 600} height={1200} fill={P.sandDk} />
        <path d="M -300 1290 C 100 1250 300 1340 600 1300 C 900 1260 1100 1330 1400 1300 L 1400 1400 C 1100 1430 900 1360 600 1400 C 300 1440 100 1350 -300 1390 Z" fill={P.water} stroke={P.ink} strokeWidth={4} />
        {Array.from({length: 8}, (_, i) => (
          <line key={i} x1={((i * 190 + local * 70) % 1600) - 300} x2={((i * 190 + local * 70) % 1600) - 240} y1={1330 + (i % 3) * 18} y2={1330 + (i % 3) * 18} stroke={P.waterHi} strokeWidth={5} strokeLinecap="round" />
        ))}
      </Layer>
      <Layer depth={0.75} c={c}>
        <Army t={t} side={-1} look={TANG} flag={P.red} />
        <Army t={t} side={1} look={ABBASID} flag={P.black} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Puff key={i} t={t} t0={tl.clash + i * 0.32} x={MID + (rand(i) - 0.5) * 300} y={GROUND} r={80 + rand(i + 2) * 60} life={1.6} />
        ))}
        {Array.from({length: 12}, (_, i) => {
          const t0 = tl.volley + rand(i) * 0.9;
          const k = (t - t0) / 1.1;
          if (k < 0 || k > 1) return null;
          const x0 = 820 - rand(i + 4) * 120;
          const x1 = 80 + rand(i + 8) * 220;
          const x = lerp(x0, x1, k);
          const y = lerp(1100, GROUND - 40, k) - Math.sin(Math.PI * k) * 420;
          const dx = x1 - x0;
          const dy = (GROUND - 40 - 1100) - Math.cos(Math.PI * k) * Math.PI * 420;
          const a = (Math.atan2(dy, dx) * 180) / Math.PI;
          return (
            <g key={i} transform={`translate(${x} ${y}) rotate(${a})`}>
              <line x1={-56} x2={26} y1={0} y2={0} stroke={P.ink} strokeWidth={6} />
              <path d="M 24 -10 L 46 0 L 24 10 Z" fill={P.ink} />
              <path d="M -56 0 L -70 -12 M -56 0 L -70 12" stroke={P.cream} strokeWidth={5} />
            </g>
          );
        })}
      </Layer>
      <Layer depth={1} c={c}>
        <path d="M -300 1700 C 100 1640 400 1690 700 1650 C 900 1630 1100 1660 1400 1640 L 1400 2300 L -300 2300 Z" fill={P.sandDeep} stroke={P.ink} strokeWidth={4} />
        {Array.from({length: 9}, (_, i) => {
          const x = i * 140 + 20;
          const sw = Math.sin(t * 2.2 + i) * 6;
          return (
            <path key={i} d={`M ${x} 1700 Q ${x - 10 + sw} 1650 ${x - 18 + sw * 1.6} 1620 M ${x} 1700 Q ${x + 6 + sw} 1640 ${x + 14 + sw * 1.6} 1610`} stroke={P.greenDk} strokeWidth={6} fill="none" strokeLinecap="round" />
          );
        })}
      </Layer>
    </svg>
  );
};
