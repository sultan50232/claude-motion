"""Sound for PaperRoad (the history series). Every time comes from the story JSON.

    python3 -m sfx sfx/cues/paper-road.py

Voice-over: record one WAV per caption line and save them as
public/paper-road/vo/01.wav, 02.wav, ... (line order in the JSON). Each take is placed
at its line's `t` and the music ducks under it. Missing takes are skipped, so the mix
also works as a music+SFX-only track.
"""

import os

from sfx.synth import (chime, clash, click, doum, envelope, impact, pad, pluck, pop, riser,
                       rustle, scratch, tek, whoosh, wind)
from sfx.voice import load_wav

TIMELINE = "src/history/stories/paper-road.json"
OUT = "public/paper-road.wav"
VO_DIR = "public/paper-road/vo"
TARGET_LUFS = -14.0

# Maqam Hijaz on D: D Eb F# G A Bb C
D3, Eb3, Fs3, G3, A3, Bb3, C4 = 146.83, 155.56, 185.0, 196.0, 220.0, 233.08, 261.63
D4, Eb4, Fs4, G4, A4, Bb4, C5, D5 = 293.66, 311.13, 369.99, 392.0, 440.0, 466.16, 523.25, 587.33
CH_D = [D3, A3, D4, Fs4]
CH_GM = [G3, Bb3, D4, G4]
CH_CM = [130.81, G3, C4, Eb4]
CH_D_HI = [D3, A3, D4, Fs4, A4]

BPM_EIGHTH = 0.3  # 100 bpm, eighth notes
MAQSUM = "DT.TD.T."
WALK_HZ = 1.05  # must match the narrator's walk cycle in src/history/Narrator.tsx


def drums(mix, start, end, gain=1.0, pan=0.0):
    """Maqsum rhythm (doum-tek) from start to end."""
    k = 0
    t = start
    while t < end - 0.05:
        hit = MAQSUM[k % len(MAQSUM)]
        if hit == "D":
            mix.put(t, doum(72), 0.34 * gain, pan)
        elif hit == "T":
            mix.put(t, tek(), 0.16 * gain * (1.2 if k % 8 == 1 else 1), pan + 0.2)
        k += 1
        t += BPM_EIGHTH


def steps(mix, start, end, gain=0.12):
    t = start
    k = 0
    while t < end:
        mix.put(t, doum(110, 0.18), gain, -0.15 if k % 2 else 0.15)
        mix.put(t, tek(0.05), gain * 0.25)
        t += 1 / (2 * WALK_HZ)
        k += 1


def phrase(mix, t0, notes, gap=0.3, gain=0.2, pan=0.0):
    for i, f in enumerate(notes):
        if f:
            mix.put(t0 + i * gap, pluck(f, 1.4), gain, pan)


def score(mix, tl):
    cuts, lines, dur = tl["cuts"], tl["lines"], tl["duration"]
    put = mix.put
    h, ta, w, cv, b, f = tl["hook"], tl["talas"], tl["workshop"], tl["caravan"], tl["baghdad"], tl["finale"]

    # voice-over first, so we know where to duck
    takes = []
    for i, line in enumerate(lines):
        vo = load_wav(os.path.join(VO_DIR, f"{i + 1:02d}.wav"))
        if vo is not None:
            put(line["t"], vo, 1.0)
            takes.append((line["t"], line["t"] + len(vo) / 48000))
            if line["t"] + len(vo) / 48000 > line["end"] + 0.3:
                print(f"warning: VO take {i + 1:02d} runs past its line end ({line['end']}s); retime the JSON")
    duck_pts = [(0, 1.0)]
    for a, z in takes:
        duck_pts += [(a - 0.15, 1.0), (a, 0.4), (z, 0.4), (z + 0.3, 1.0)]
    duck = envelope(sorted(duck_pts) + [(dur, 1.0)])
    music = 0.55 if takes else 1.0

    # bed: Hijaz pad following the story
    volume = envelope([(0, 0.6), (1.0, 1), (dur - 1.5, 1), (dur, 0)])
    chords = [(0, CH_D), (cuts[0], CH_GM), (lines[3]["t"], CH_D), (cuts[1], CH_CM), (lines[5]["t"], CH_D),
              (cuts[2], CH_D), (lines[7]["t"], CH_GM), (cuts[3], CH_D), (b["burst"], CH_D_HI),
              (b["inside"], CH_GM), (lines[10]["t"], CH_D), (cuts[4], CH_CM), (f["cities"][1], CH_GM), (f["cta"], CH_D_HI)]
    mix.put_stereo(0, *pad(dur, chords, volume=lambda t: volume(t) * duck(t)), gain=0.03 * music)

    # rhythm sections: the battle, the road, the finale
    drums(mix, ta["march"] + 0.3, ta["settle"] + 2.0, gain=music)
    drums(mix, cv["walk"] + 0.3, cuts[3] - 0.4, gain=0.8 * music)
    drums(mix, f["route"], dur - 1.0, gain=0.7 * music)

    # transitions: the paper sweep
    for c in cuts:
        put(c - 0.45, whoosh(0.9, 300, 3000, peak=0.5), 0.2)
        put(c - 0.3, rustle(0.7), 0.16, 0.3)
        put(c, doum(55, 0.5), 0.2)

    # captions: a soft pop when each card lands, a pluck for the accent
    for i, line in enumerate(lines):
        put(line["t"], pop(700, 360, 0.12), 0.09, 0.1)
    for chip in tl["chips"]:
        if chip["t"] > 0:
            put(chip["t"], click(2200), 0.12, -0.2)

    # 1 · hook: footsteps, paper raised to the light, the swords stamp
    steps(mix, 0.05, h["glow"] + 0.15)
    put(h["glow"], chime([D5, A4 * 2, Fs4 * 2], dur=2.0, tau=0.7), 0.13)
    put(h["glow"] - 0.1, rustle(0.6), 0.12, -0.3)
    put(h["swords"], doum(48, 0.8), 0.4)
    put(h["swords"] + 0.02, clash(0.7), 0.1)
    phrase(mix, 0.3, [D4, Eb4, Fs4, None, G4, Fs4, Eb4, D4], gain=0.13 * music)

    # 2 · Talas: march, the clash (the one impact), arrows
    put(cuts[0] + 0.2, wind(cuts[1] - cuts[0] - 0.2, 380), 0.05)
    put(ta["clash"] - 1.0, riser(1.0, 200, 3000), 0.12)
    put(ta["clash"], impact(1.4), 0.5)
    for k in range(5):
        put(ta["clash"] + 0.05 + k * 0.13, clash(0.6), 0.09 - k * 0.012, -0.4 + k * 0.2)
    for k in range(10):
        put(ta["volley"] + k * 0.09, whoosh(0.5, 2400, 900, peak=0.35, q=1.4), 0.05, 0.5 - k * 0.1)

    # 3 · workshop: the mallet, the vat, sheets hung up
    t = w["pound"] + 0.78 * w["poundEvery"]
    while t < cuts[2] - 0.2:
        put(t, doum(92, 0.3), 0.18, -0.2)
        put(t + 0.01, tek(0.06), 0.06, -0.2)
        t += w["poundEvery"]
    t = w["lift"] + w["liftEvery"] / 2
    while t < cuts[2] - 0.3:
        put(t, wind(0.6, 900), 0.06, 0.4)
        for k in range(3):
            put(t + 0.35 + k * 0.17, pop(1800 - k * 200, 900, 0.06), 0.05, 0.35)
        t += w["liftEvery"]
    for k in range(3):
        put(w["sheets"] + k * 0.22, rustle(0.25), 0.1, -0.3 + k * 0.3)
    phrase(mix, lines[4]["t"] + 0.2, [A3, Bb3, C4, D4, None, C4, Bb3, A3], gap=0.36, gain=0.12 * music)

    # 4 · the Silk Road: footsteps, wind, camel bells, the skyline
    stop = next(k["t"] for k in tl["narrator"] if k["t"] > cuts[2] and k.get("walk") is False)
    put(cuts[2] + 0.1, wind(cuts[3] - cuts[2] - 0.2, 520), 0.07)
    steps(mix, cuts[2] + 0.2, stop)
    for k in range(6):
        put(cuts[2] + 0.6 + k * 0.9, chime([2349.3 + k * 40], dur=0.6, tau=0.2), 0.035, -0.5 + (k % 3) * 0.3)
    put(cv["sign"] + 1.2, whoosh(0.7, 600, 1800), 0.08, -0.6)
    put(cv["skyline"], chime([D4, A4, D5, Fs4 * 2], dur=2.4, tau=0.9), 0.12)
    phrase(mix, cuts[2] + 0.6, [D4, Fs4, G4, A4, None, Bb4, A4, G4, Fs4, None, Eb4, D4], gap=0.3, gain=0.14 * music)

    # 5 · Baghdad: river and wheel, the burst of paper, the dolly, the library
    put(cuts[3], wind(b["inside"] - cuts[3], 700), 0.06)
    for k in range(int((b["dolly"] - b["wheel"]) / 0.55)):
        put(b["wheel"] + 0.3 + k * 0.55, click(380, 0.08), 0.05, 0.3)
    put(b["burst"] - 0.9, riser(0.9, 300, 4000), 0.1)
    put(b["burst"], chime([D4, Fs4, A4, D5], dur=2.2, tau=0.8), 0.14)
    for k in range(6):
        put(b["burst"] + k * 0.12, rustle(0.5), 0.08, -0.5 + k * 0.2)
    put(b["dolly"], whoosh(b["inside"] - b["dolly"] + 0.1, 200, 5000, peak=0.9), 0.24)
    put(b["inside"], chime([G4, Bb4, D5], dur=2.0, tau=0.8), 0.12)
    for k in range(12):
        put(b["books"] + k * 0.13, click(1200 + (k % 4) * 180, 0.04), 0.07, -0.6 + (k % 5) * 0.3)
    put(b["astrolabe"], chime([D5, A4 * 2], dur=1.6, tau=0.6), 0.1, -0.4)

    # 6 · finale: the route drawn, the cities, the call to action
    put(f["route"], scratch(f["cities"][-1] - f["route"] + 0.2), 0.08)
    notes = [A4, Bb4, C5, D5]
    for i, ct in enumerate(f["cities"]):
        put(ct, pop(notes[i] * 2, notes[i], 0.14), 0.18, -0.4 + i * 0.25)
        put(ct + 0.01, pluck(notes[i], 1.2), 0.16 * music)
    put(f["cta"], chime([D4, Fs4, A4, D5, Fs4 * 2], dur=2.6, tau=1.0), 0.16)
    put(f["cta"], pop(900, 450), 0.25)
