import React from 'react';
import {clamp01, easeIn, easeOut, prog, sp} from '../lib';
import {Line, wordTimes} from './choreo';
import {HF, HFPS, P, S} from './theme';

/**
 * Spoken line as a torn parchment card. Words rise in one by one as they're said
 * (Arabic is never split below the word, so letters stay joined); accent words get
 * a gold brush stroke painted under them.
 */
const CaptionLine: React.FC<{line: Line; frame: number}> = ({line, frame}) => {
  const t = frame / HFPS;
  if (t < line.t - 0.05 || t > line.end + 0.4) return null;
  const card = sp(frame, line.t - 0.05, {damping: 13, stiffness: 190, mass: 0.7}, HFPS);
  const out = prog(t, line.end, line.end + 0.32, easeIn);
  const words = wordTimes(line);
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        top: 400,
        display: 'flex',
        justifyContent: 'center',
        transform: `translateY(${out * -60}px) scale(${(0.86 + 0.14 * card) * (1 - out * 0.08)}) rotate(${(1 - card) * -3 + out * 2}deg)`,
        opacity: clamp01(card * 3) * (1 - out),
      }}
    >
      <div
        dir="rtl"
        style={{
          position: 'relative',
          padding: '26px 46px 34px',
          background: P.parchment,
          clipPath:
            'polygon(1% 4%, 9% 0%, 22% 3%, 37% 0%, 52% 2%, 68% 0%, 83% 3%, 97% 0%, 100% 18%, 98% 46%, 100% 74%, 98% 100%, 84% 97%, 66% 100%, 49% 97%, 31% 100%, 15% 97%, 2% 100%, 0% 72%, 2% 44%, 0% 16%)',
          boxShadow: 'inset 0 0 60px rgba(168,122,67,0.35)',
          textAlign: 'center',
          fontFamily: HF.sans,
          fontWeight: 800,
          fontSize: 76,
          lineHeight: 1.42,
          color: P.ink,
          maxWidth: 940,
        }}
      >
        {words.map(({word, on}, i) => {
          const k = prog(t, on - 0.04, on + 0.32, easeOut);
          const accent = line.accent?.includes(word);
          const brush = prog(t, on + 0.12, on + 0.5, easeOut);
          return (
            <React.Fragment key={i}>
              <span
                style={{
                  display: 'inline-block',
                  position: 'relative',
                  transform: `translateY(${(1 - k) * 34}px) scale(${0.7 + 0.3 * k})`,
                  opacity: k,
                  color: accent ? P.rust : P.ink,
                }}
              >
                {accent && (
                  <span
                    style={{
                      position: 'absolute',
                      right: -8,
                      bottom: 10,
                      height: 30,
                      width: `calc(${brush * 100}% + 16px)`,
                      background: P.gold,
                      opacity: 0.55,
                      borderRadius: '40% 60% 50% 45% / 60% 40% 60% 40%',
                      zIndex: 0,
                    }}
                  />
                )}
                <span style={{position: 'relative'}}>{word}</span>
              </span>
              {i < words.length - 1 ? ' ' : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

type Chip = {t: number; end: number; text: string};

const ChipTag: React.FC<{chip: Chip; frame: number}> = ({chip, frame}) => {
  const t = frame / HFPS;
  if (t < chip.t || t > chip.end + 0.3) return null;
  const k = chip.t <= 0 ? 1 : sp(frame, chip.t, {damping: 11, stiffness: 210, mass: 0.7}, HFPS);
  const out = prog(t, chip.end, chip.end + 0.25, easeIn);
  return (
    <div style={{position: 'absolute', top: 268, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
      <div
        dir="rtl"
        style={{
          fontFamily: HF.kufi,
          fontWeight: 700,
          fontSize: 54,
          color: P.cream,
          background: P.tealDk,
          padding: '8px 34px 14px',
          borderRadius: 16,
          border: `4px solid ${P.gold}`,
          boxShadow: `0 8px 0 ${P.inkFaint}`,
          transform: `translateY(${(1 - k) * -40 - out * 30}px) scale(${0.6 + 0.4 * k})`,
          opacity: clamp01(k * 2) * (1 - out),
        }}
      >
        {chip.text}
      </div>
    </div>
  );
};

export const Captions: React.FC<{frame: number}> = ({frame}) => (
  <>
    {S.chips.map((c, i) => (
      <ChipTag key={i} chip={c} frame={frame} />
    ))}
    {S.lines.map((l, i) => (
      <CaptionLine key={i} line={l} frame={frame} />
    ))}
  </>
);
