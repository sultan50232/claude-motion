"""Sound design for the scent/memory TikTok (sims/scent). Every time comes from its timeline.json.

    python3 -m sfx sfx/cues/scent.py

The music bed is composed here (pad + music-box arpeggio), so it is original and needs no licence.
The voiceover and the sniff are mixed in afterwards with ffmpeg (see sims/scent/README.md).
"""

from sfx.synth import blip, chime, envelope, impact, pad, pop, scratch, whoosh

TIMELINE = "sims/scent/timeline.json"
OUT = "public/scent-music-sfx.wav"
TARGET_LUFS = -14.0

# D major, calm. Chords per scene (root + colour tones).
D, E, Fs, G, A, B, Cs = 146.83, 164.81, 185.0, 196.0, 220.0, 246.94, 277.18
DMAJ9 = [D, A, Cs * 2, E * 2, Fs * 2]
BM9 = [B / 2, Fs, A * 2 / 2 * 2, Cs * 2, D * 2]
GMAJ9 = [G / 2 * 2, D * 2 / 2 * 2, Fs * 2, A * 2, B * 2]
EM9 = [E, B, D * 2, Fs * 2, G * 2]
ASUS = [A, E * 2, A * 2, B * 2, D * 4]


def score(mix, tl):
    dur = tl["duration"]
    sc = {s["id"]: s for s in tl["scenes"]}
    ln = {l["id"]: l for l in tl["lines"]}

    def w(line, frag, end=False):
        for x in ln[line]["words"]:
            if frag in x["w"]:
                return x["b"] if end else x["a"]
        return ln[line]["t0"]

    put = mix.put
    flash = w("end", "بلحظات")
    chords = [
        (0, DMAJ9), (sc["memories"]["t0"], BM9), (w("odd", "ريحة"), GMAJ9), (sc["question"]["t0"], EM9),
        (sc["receptors"]["t0"], EM9), (w("receptor", "ترسل"), ASUS), (sc["brain"]["t0"], BM9),
        (sc["feeling"]["t0"], GMAJ9), (w("link", "مشاعر"), DMAJ9), (sc["differ"]["t0"], EM9),
        (sc["ending"]["t0"], GMAJ9), (flash, DMAJ9),
    ]
    vol = envelope([(0, 0.2), (1.5, 1), (dur - 2.5, 1), (dur, 0)])
    mix.put_stereo(0, *pad(dur, chords, volume=vol, tremolo=0.18), gain=0.05)

    # music box: one soft note per beat (72 bpm), upper chord tones, rests in the science scenes
    beat = 60 / 72
    k, t = 0, 0.6
    while t < dur - 1.5:
        cur = [c for c in chords if c[0] <= t][-1][1]
        notes = sorted(f * 4 for f in cur[1:])
        quiet = sc["receptors"]["t0"] <= t < sc["feeling"]["t0"]
        if not (quiet and k % 2):
            f = notes[[0, 2, 1, 3, 2, 1, 3, 0][k % 8] % len(notes)]
            put(t, blip(f, dur=0.9, tau=0.32), 0.035 if quiet else 0.055, [-0.35, 0.35][k % 2])
        k += 1
        t += beat

    # 1 opening: bottle glint, then the memory swell on "وفجأة"
    put(0.15, chime([D * 8, A * 8, Fs * 8], dur=2.0, tau=0.7), 0.06, 0.3)
    put(w("hook", "وفجأة") - 0.4, whoosh(1.4, 300, 2600, peak=0.7, q=0.6), 0.12, -0.2)
    put(w("hook", "تذكّرت"), chime([A * 4, Cs * 8, E * 8], dur=2.4, tau=0.9), 0.07)

    # transitions (veils)
    for t0 in [sc["memories"]["t0"], sc["question"]["t0"], w("receptor", "ريحة", True) + 0.45, sc["brain"]["t0"], sc["differ"]["t0"], sc["ending"]["t0"]]:
        put(t0 - 0.45, whoosh(0.8, 500, 2800, peak=0.55), 0.11)

    # 2 memories: the window lights up when the scent arrives
    put(w("odd", "ريحة") - 0.2, whoosh(1.6, 200, 1600, peak=0.6, q=0.5), 0.08, -0.5)
    put(w("odd", "ترجّع"), chime([B * 4, D * 8, Fs * 8], dur=2.2, tau=0.8), 0.08, -0.2)

    # 3 question
    put(sc["question"]["t0"] + 0.3, impact(1.4), 0.12)
    put(sc["question"]["t0"] + 0.4, pop(520, 260, dur=0.2), 0.16)

    # 4 receptors: a soft tick per bound molecule, rising signal, the bulb lights
    first = w("receptor", "مستقبلات") - 0.2
    for i in range(14):
        tb = first + i / 14 * 2.1
        put(tb, pop(1300 + i * 40, 700 + i * 30, dur=0.09), 0.07, -0.6 + (i % 7) * 0.2)
    for i, f in enumerate([E * 4, Fs * 4, A * 4, B * 4]):
        put(w("receptor", "ترسل") + i * 0.18, blip(f, dur=0.5, tau=0.12), 0.08)
    put(w("receptor", "للبصلة"), chime([A * 4, E * 8, A * 8], dur=1.8, tau=0.6), 0.08)

    # 5 brain: turns to glass, then the two labels
    put(sc["brain"]["t0"] + 0.7, whoosh(1.3, 3000, 600, peak=0.4, q=0.5), 0.08)
    put(w("brain", "اللوزة") - 0.1, pop(700, 420), 0.15, -0.3)
    put(w("brain", "اللوزة") - 0.05, blip(Fs * 4, dur=0.6), 0.08, -0.3)
    put(w("brain", "والحُصين") - 0.1, pop(880, 520), 0.15, 0.3)
    put(w("brain", "والحُصين") - 0.05, blip(A * 4, dur=0.6), 0.08, 0.3)

    # 6 feeling: three memories land and stack, threads, the emotion swell
    for i in range(3):
        put(sc["feeling"]["t0"] + 0.5 + i * 0.45, pop(600 + i * 120, 300 + i * 60), 0.12, [-0.4, 0, 0.4][i])
    put(w("link", "يفسّر") - 0.3, whoosh(1.4, 400, 2000, peak=0.6), 0.07)
    put(w("link", "مشاعر") - 0.2, chime([D * 4, Fs * 4, A * 4, Cs * 8], dur=2.6, tau=1.0), 0.09)

    # 7 differ: vials, one clear memory, one nothing, one blurry
    for i in range(3):
        put(sc["differ"]["t0"] + 0.15 + i * 0.18, pop(500 + i * 90, 260 + i * 50), 0.11, -0.5 + i * 0.5)
    put(w("differ", "ترجّع"), blip(B * 4, dur=0.6), 0.09, -0.5)
    put(w("differ", "ذكرى،") - 0.1, blip(E * 2 * 1.06, dur=0.7, tau=0.3), 0.06)
    put(w("differ", "دقيقة") - 0.2, scratch(0.9), 0.07, 0.5)

    # 8 ending: things glow, the flash of childhood, the title
    put(w("end", "أشياء"), chime([D * 8, Fs * 8, A * 8], dur=2.0, tau=0.7), 0.05, -0.3)
    put(flash - 0.35, whoosh(0.7, 600, 3400, peak=0.6), 0.12)
    put(flash, chime([B * 4, D * 8, Fs * 8, B * 8], dur=2.4, tau=0.9), 0.08)
    put(dur - 3.0, chime([D * 4, A * 4, Fs * 8, E * 8], dur=3.0, tau=1.2), 0.08)
