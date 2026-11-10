import {SpringConfig} from 'remotion';
import {clamp01, easeInOut, lerp, sp} from '../lib';
import {HFPS, S} from './theme';

export type Key = {
  t: number;
  dur?: number;
  x?: number;
  y?: number;
  s?: number;
  face?: number;
  pose?: string;
  walk?: boolean;
  prop?: string;
};

const ordered = (keys: Key[]) => [...keys].sort((a, b) => a.t - b.t);

/** Numeric track: each key tweens from the running value to its own over `dur` (default 0.8 s). */
export const tween = (keys: Key[], field: 'x' | 'y' | 's' | 'face', t: number) => {
  let v: number | undefined;
  for (const k of ordered(keys)) {
    const target = k[field];
    if (target === undefined) continue;
    if (v === undefined) {
      v = target;
      continue;
    }
    if (t < k.t) break;
    const d = k.dur ?? 0.8;
    const p = d <= 0 ? 1 : easeInOut(clamp01((t - k.t) / d));
    v = lerp(v, target, p);
  }
  return v ?? 0;
};

/** Discrete track: the latest key at or before t that sets `field`. */
export const latest = <F extends 'pose' | 'walk' | 'prop'>(
  keys: Key[],
  field: F,
  t: number,
): {value: Key[F] | undefined; since: number} => {
  let value: Key[F] | undefined;
  let since = 0;
  for (const k of ordered(keys)) {
    if (k.t > t) break;
    if (k[field] !== undefined) {
      value = k[field];
      since = k.t;
    }
  }
  return {value, since};
};

/** Spring-blend a sequence of named states (poses) into one value; springs overshoot, which reads as cutout snap. */
export const springBlend = <T>(
  keys: Key[],
  frame: number,
  lookup: (name: string) => T,
  mix: (a: T, b: T, k: number) => T,
  config: Partial<SpringConfig> = {damping: 12, stiffness: 150, mass: 0.8},
) => {
  const poses = ordered(keys).filter((k) => k.pose !== undefined);
  let cur = lookup(poses[0]?.pose ?? 'idle');
  for (const k of poses.slice(1)) {
    const cut = k.dur === 0;
    const w = cut ? (frame >= k.t * HFPS ? 1 : 0) : sp(frame, k.t, config, HFPS);
    if (w === 0) break;
    cur = mix(cur, lookup(k.pose!), w);
  }
  return cur;
};

export type Line = {t: number; end: number; text: string; accent?: string[]};

/** Word onsets for a line, spread by character count, so captions and gestures share one clock. */
export const wordTimes = (line: Line) => {
  const words = line.text.split(' ');
  const total = words.reduce((a, w) => a + w.length + 1, 0);
  const span = Math.max(0.4, line.end - line.t - 0.55);
  let acc = 0;
  return words.map((w) => {
    const on = line.t + (acc / total) * span;
    acc += w.length + 1;
    return {word: w, on};
  });
};

export const LINES: Line[] = S.lines;

/** 0..1 how much the narrator is "speaking" right now, and a pulse on every word onset. */
export const speech = (t: number) => {
  let talk = 0;
  let pulse = 0;
  for (const l of LINES) {
    talk = Math.max(talk, clamp01((t - l.t) / 0.2) * clamp01((l.end - t) / 0.3));
    for (const w of wordTimes(l)) {
      const d = t - w.on;
      if (d >= 0 && d < 0.5) pulse = Math.max(pulse, Math.exp(-d / 0.12) * (1 - d / 0.5));
    }
  }
  return {talk, pulse};
};

/** Index of the scene playing at t (scenes are split by `cuts`). */
export const sceneAt = (t: number) => S.cuts.filter((c) => t >= c).length;
