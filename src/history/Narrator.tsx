import React from 'react';
import {clamp01} from '../lib';
import {Key, latest, speech, springBlend, tween} from './choreo';
import {Figure, Look, mixPose, NARRATOR, pose, walkPose} from './rig';
import {HFPS, HH, HW} from './theme';

const walkWeight = (keys: Key[], t: number) => {
  const {value, since} = latest(keys, 'walk', t);
  if (value === undefined) return 0;
  const k = since <= 0 ? 1 : clamp01((t - since) / 0.28);
  return value ? k : 1 - k;
};

/** Pose, position, walk, talk and drag for a choreographed figure at `frame`. */
export const performer = (keys: Key[], frame: number) => {
  const t = frame / HFPS;
  let p = springBlend(keys, frame, pose, mixPose);
  const w = walkWeight(keys, t);
  if (w > 0) p = walkPose(p, t * Math.PI * 2 * 1.05, w);

  const {talk, pulse} = speech(t);
  const still = 1 - w;
  p = {
    ...p,
    head: p.head + (4 * pulse + 2.2 * Math.sin(t * 4.1)) * talk * still,
    fe: p.fe + 7 * Math.sin(t * 5.3) * talk * still,
    lean: p.lean + 1.4 * Math.sin(t * 2.6) * talk * still + 0.8 * Math.sin(t * 1.7),
  };

  const x = tween(keys, 'x', t);
  const face = tween(keys, 'face', t) >= 0 ? 1 : -1;
  const vx = (x - tween(keys, 'x', t - 0.12)) * face;
  const prev = springBlend(keys, frame - 4, pose, mixPose);
  const drag = Math.max(-28, Math.min(28, vx * 0.35 + (p.lean - prev.lean) * 1.2)) + 3 * Math.sin(t * 2.1);

  return {
    pose: p,
    x,
    y: tween(keys, 'y', t),
    s: tween(keys, 's', t),
    face,
    drag,
    breathe: Math.sin(t * 2.2),
    prop: latest(keys, 'prop', t).value,
  };
};

export const Narrator: React.FC<{frame: number; keys: Key[]; look?: Look}> = ({frame, keys, look = NARRATOR}) => {
  const st = performer(keys, frame);
  return (
    <svg width={HW} height={HH} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      <g style={{filter: 'drop-shadow(0 10px 0 rgba(42,29,21,0.22))'}}>
        <Figure {...st} look={look} />
      </g>
    </svg>
  );
};
