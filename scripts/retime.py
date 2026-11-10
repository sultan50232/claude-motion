#!/usr/bin/env python3
"""Fit a history story's timeline to its recorded voice-over.

    python3 scripts/retime.py src/history/stories/paper-road.json public/paper-road/vo

Reads each take's length (NN.wav, line order), lays the lines out again so every take fits
its caption with the original gaps between lines, then moves every other time in the
story (cuts, chips, pose keys, scene beats) with a piecewise-linear map anchored on the
lines. Durations and periods (`dur`, keys ending in `Every`) and positions are left alone.
"""

import bisect
import json
import os
import sys
import wave

TAIL = 0.3  # caption stays up this long after the voice stops
MIN_GAP = 0.25


def take_len(path):
    with wave.open(path, "rb") as wf:
        return wf.getnframes() / wf.getframerate()


def main():
    story_path, vo_dir = sys.argv[1], sys.argv[2]
    story = json.load(open(story_path))
    lines = story["lines"]

    anchors = [(0.0, 0.0)]
    prev_old_end, prev_new_end = 0.0, 0.0
    for i, line in enumerate(lines):
        path = os.path.join(vo_dir, f"{i + 1:02d}.wav")
        old_t, old_end = line["t"], line["end"]
        gap = old_t - prev_old_end if i else old_t
        new_t = prev_new_end + max(MIN_GAP if i else 0, gap)
        new_end = new_t + (take_len(path) + TAIL if os.path.exists(path) else old_end - old_t)
        last = i == len(lines) - 1
        anchors.append((old_t, new_t))
        if not last:
            anchors.append((old_end, new_end))
        prev_old_end, prev_new_end = old_end, new_end
    tail = story["duration"] - lines[-1]["t"]
    new_dur = round(max(prev_new_end, anchors[-1][1] + tail) + 0.4, 2)
    anchors.append((story["duration"], new_dur))
    olds = [a for a, _ in anchors]

    def m(t):
        i = max(1, min(len(anchors) - 1, bisect.bisect_right(olds, t)))
        (a0, b0), (a1, b1) = anchors[i - 1], anchors[i]
        return round(b0 + (b1 - b0) * (t - a0) / (a1 - a0) if a1 > a0 else b1, 2)

    for i, line in enumerate(lines):
        old_end = line["end"]
        line["t"] = m(line["t"])
        line["end"] = m(old_end) if i < len(lines) - 1 else round(new_dur + 0.5, 2)
    story["cuts"] = [m(c) for c in story["cuts"]]
    for chip in story["chips"]:
        chip["t"], chip["end"] = m(chip["t"]), m(chip["end"]) if chip["end"] < story["duration"] else round(new_dur + 0.5, 2)
    for key in story["narrator"]:
        key["t"] = m(key["t"])
    for name, beats in story.items():
        if name in ("fps", "duration", "cuts", "lines", "chips", "narrator") or not isinstance(beats, dict):
            continue
        for k, v in beats.items():
            if k.endswith("Every"):
                continue
            beats[k] = [m(x) for x in v] if isinstance(v, list) else m(v)
    print(f"duration {story['duration']}s -> {new_dur}s")
    story["duration"] = new_dur

    text = json.dumps(story, ensure_ascii=False, indent=2)
    open(story_path, "w").write(text + "\n")


if __name__ == "__main__":
    main()
