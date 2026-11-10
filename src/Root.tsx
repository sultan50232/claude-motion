import React from 'react';
import {Composition, Still} from 'remotion';
import {ArticleCover} from './ArticleCover';
import {EffortVideo} from './EffortVideo';
import {HistoryStory} from './history/HistoryStory';
import {HFPS, HH, HW, S} from './history/theme';
import {FPS, H, TL, W} from './lib';

export const Root: React.FC = () => (
  <>
    <Composition
      id="EffortVideo"
      component={EffortVideo}
      durationInFrames={Math.round(TL.duration * FPS)}
      fps={FPS}
      width={W}
      height={H}
    />
    <Composition
      id="PaperRoad"
      component={HistoryStory}
      durationInFrames={Math.round(S.duration * HFPS)}
      fps={HFPS}
      width={HW}
      height={HH}
    />
    <Still id="ArticleCover" component={ArticleCover} width={2000} height={800} />
  </>
);
