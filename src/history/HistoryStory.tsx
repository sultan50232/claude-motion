import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import '@fontsource/cairo/arabic-800.css';
import '@fontsource/cairo/arabic-600.css';
import '@fontsource/reem-kufi/arabic-700.css';
import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';
import {Captions} from './Captions';
import {Key, sceneAt} from './choreo';
import {PaperFinish, PaperSweep} from './kit';
import {Narrator} from './Narrator';
import {Baghdad} from './scenes/Baghdad';
import {Caravan} from './scenes/Caravan';
import {Finale} from './scenes/Finale';
import {Hook} from './scenes/Hook';
import {Talas} from './scenes/Talas';
import {Workshop} from './scenes/Workshop';
import {HFPS, P, S} from './theme';

const SCENES = [Hook, Talas, Workshop, Caravan, Baghdad, Finale];

const useArabicFonts = () => {
  const [handle] = useState(() => delayRender('arabic fonts'));
  useEffect(() => {
    Promise.all([
      document.fonts.load('800 80px "Cairo"', 'عربي'),
      document.fonts.load('700 40px "Reem Kufi"', 'عربي'),
    ]).then(() => continueRender(handle));
  }, [handle]);
};

/** "The Road of Paper": faceless cutout narrator, animated history scenes, Arabic kinetic captions. 9:16. */
export const HistoryStory: React.FC = () => {
  useArabicFonts();
  const frame = useCurrentFrame();
  const t = frame / HFPS;
  const Scene = SCENES[sceneAt(t)];
  const shake = t > S.talas.clash && t < S.cuts[1] ? Math.exp(-(t - S.talas.clash) / 0.25) * 14 : 0;
  return (
    <AbsoluteFill style={{background: P.ink, overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `translate(${Math.sin(t * 51) * shake}px, ${Math.cos(t * 43) * shake}px) scale(${1 + shake * 0.004})`}}>
        <Scene frame={frame} />
        <Narrator frame={frame} keys={S.narrator as Key[]} />
      </AbsoluteFill>
      <PaperSweep frame={frame} />
      <Captions frame={frame} />
      <PaperFinish frame={frame} />
    </AbsoluteFill>
  );
};
