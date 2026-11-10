#!/usr/bin/env python3
"""Guide voice-over with Google's Arabic voice (gTTS), one WAV per caption line.

    pip install gtts
    python3 scripts/vo-google.py src/history/stories/paper-road.json public/paper-road/vo

Needs network access to translate.google.com. A line's optional `say` is read instead of its
`text` (write numbers out in words there). Takes are trimmed, played at a natural 1.1x and
never squeezed to fit: run scripts/retime.py afterwards to fit the timeline to the voice.
Replace the files with a recorded voice any time; the cue sheet only looks at the file names.
"""

import json
import os
import subprocess
import sys
import tempfile

from gtts import gTTS

SPEED = 1.1


def duration(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path])
    return float(out)


def main():
    story, out_dir = sys.argv[1], sys.argv[2]
    lines = json.load(open(story))["lines"]
    os.makedirs(out_dir, exist_ok=True)
    trim = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"
    for i, line in enumerate(lines):
        slot = line["end"] - line["t"] - 0.1
        with tempfile.TemporaryDirectory() as tmp:
            mp3 = os.path.join(tmp, "take.mp3")
            raw = os.path.join(tmp, "raw.wav")
            gTTS(line.get("say", line["text"]).replace("…", "،"), lang="ar").save(mp3)
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", mp3, "-af", trim, raw], check=True)
            d = duration(raw)
            speed = SPEED
            dst = os.path.join(out_dir, f"{i + 1:02d}.wav")
            af = f"atempo={speed:.3f},loudnorm=I=-16:TP=-2"
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", raw, "-af", af, "-ar", "48000", "-ac", "1", "-sample_fmt", "s16", dst], check=True)
            fit = "ok" if d / speed <= slot + 0.05 else "longer than its slot"
            print(f"{i + 1:02d}  {d / speed:4.2f}s  slot {slot:4.2f}s  {fit}")


if __name__ == "__main__":
    main()
