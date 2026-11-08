"""Sound bed for the airplane-window sim (sims/window). Times come from its timeline.json;
the voiceover is mixed on top afterwards (see examples/airplane-window.md).

    python3 -m sfx sfx/cues/window.py
"""

from sfx.synth import SR, bandnoise, chime, click, envelope, impact, pad, pop, riser, whoosh

TIMELINE = "sims/window/timeline.json"
OUT = "out/sims/window-sfx.wav"
TARGET_LUFS = -14.0

# A minor-ish airy bed, lifts to C major for the payoff.
BED_A = [110.0, 164.81, 220.0, 261.63, 329.63]
BED_B = [130.81, 196.0, 261.63, 329.63, 392.0, 523.25]
POP_NOTES = [880.0, 987.77, 1046.5, 1174.66, 1318.5, 1396.9, 1568.0, 1760.0]


def score(mix, tl):
    S = [s["start"] for s in tl["sentences"]]
    dur = tl["duration"]
    word = lambda w: next(x["s"] for x in tl["words"] if x["w"].startswith(w))
    put = mix.put

    # cabin hum: low band noise for the whole piece, thinner while we are outside / in the diagram
    hum = bandnoise(int(dur * SR), lambda k: 140 + 30 * (k % SR) / SR, q=0.6)
    hv = envelope([(0, 0), (0.6, 1), (6.8, 1), (7.6, 0.35), (S[6] - 0.5, 0.35), (S[6] + 1.5, 0.8), (S[7] + 1.0, 0.8), (S[7] + 2.5, 0.3), (dur, 0)])
    put(0, [s * hv(i / SR) for i, s in enumerate(hum)], 0.5)

    mix.put_stereo(0, *pad(dur, [(0, BED_A), (S[7], BED_B)], volume=envelope([(0, 0), (1.5, 1), (dur - 1.5, 1.1), (dur, 0)])), gain=0.02)

    # camera moves
    put(0.1, whoosh(1.8, 300, 1200, peak=0.6), 0.1)
    put(3.5, whoosh(2.0, 400, 2600, peak=0.8), 0.12)
    put(6.6, riser(0.9, 300, 3800), 0.08)
    put(7.45, whoosh(0.9, 3500, 500, peak=0.25), 0.2)
    put(8.6, whoosh(2.2, 800, 300, peak=0.5), 0.12, 0.3)
    put(17.2, whoosh(1.8, 500, 2200, peak=0.6), 0.12, -0.2)
    put(18.6, impact(1.2), 0.22)
    for i, k in enumerate([18.7, 18.95, 19.2]):
        put(k, whoosh(0.6, 900 + 300 * i, 2400, peak=0.4), 0.08, -0.4 + 0.4 * i)
    put(25.0, whoosh(1.4, 1600, 600, peak=0.6), 0.1)
    put(30.3, whoosh(1.2, 2400, 500, peak=0.5), 0.12)
    put(30.3 + 1.25, click(1800), 0.12)
    put(37.5, whoosh(1.3, 500, 2500, peak=0.7), 0.12)
    put(38.6, whoosh(2.5, 900, 250, peak=0.4), 0.1, 0.3)

    # chips and labels
    chips = [S[1], S[2], S[3], S[4], S[5], word("والطبقة"), S[6], S[7]]
    for i, t in enumerate(chips):
        put(t - 0.1, pop(POP_NOTES[i], POP_NOTES[i] * 0.5), 0.12)
    for i, t in enumerate([19.6, 19.9, 20.2]):
        put(t, click(2200 + 300 * i), 0.1, -0.3 + 0.3 * i)

    # payoff
    put(word("تصميم"), chime([523.25, 659.25, 783.99, 1046.5], dur=2.2, tau=0.8), 0.12)
