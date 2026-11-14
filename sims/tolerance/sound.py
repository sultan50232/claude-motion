"""Cinematic sound bed for the tolerance piece, on the same timeline.json as the picture,
mixed with the narration (voice.py) and mastered. Everything is synthesised: no samples.

    python3 sims/tolerance/sound.py      -> sims/tolerance/mix.wav (48 kHz stereo, -16 LUFS)
"""
import json, os, re, subprocess, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
TL = json.load(open(os.path.join(HERE, "timeline.json"), encoding="utf-8"))
DUR = TL["duration"]
N = int(DUR * SR)
R = np.random.default_rng(1116)
SC = {s["name"]: s for s in TL["scenes"]}


def word(scene, w):
    return next(x["s"] for x in TL["words"] if x["scene"] == scene and w in x["w"])


hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)
t_ = lambda d: np.arange(int(d * SR)) / SR


def lowpass(x, cut):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / np.sqrt(1 + (f / cut) ** 4), len(x))


def reverb(x, secs=3.2, wet=0.35, seed=3):
    rng = np.random.default_rng(seed)
    n = int(secs * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * (6.9 / secs))
    ir = lowpass(ir, 5000)
    ir /= np.sqrt(np.sum(ir ** 2))
    L = len(x) + n
    nfft = 1 << (L - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[: len(x)]
    return x * (1 - wet) + y * wet


def place(buf, sig, at, gain=1.0, pan=0.0):
    i = int(max(0, at) * SR)
    if i >= len(buf):
        return
    m = min(len(sig), len(buf) - i)
    buf[i:i + m, 0] += sig[:m] * gain * np.sqrt(0.5 * (1 - pan))
    buf[i:i + m, 1] += sig[:m] * gain * np.sqrt(0.5 * (1 + pan))


# ------------------------------------------------------------------ pad: one chord per scene
CHORDS = {"intro": [38, 45, 54, 61, 64], "date": [35, 42, 50, 57, 64], "hands": [43, 50, 59, 62, 66],
          "mecca": [40, 47, 55, 62, 66], "end": [38, 45, 54, 61, 64, 69]}
pad = np.zeros((N, 2))
for s in TL["scenes"]:
    a, b = max(0, s["start"] - 0.6), min(DUR, s["end"] + 0.6)
    tt = t_(b - a)
    env = np.minimum(1, tt / 1.2) * np.minimum(1, (b - a - tt) / 1.2)
    for k, m in enumerate(CHORDS[s["name"]]):
        f = hz(m)
        lfo = 1 + 0.004 * np.sin(2 * np.pi * (0.13 + 0.05 * k) * tt)
        for side, det in ((0, 0.998), (1, 1.002)):
            ph = 2 * np.pi * f * det * np.cumsum(lfo) / SR
            tone = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
            amp = 0.05 / (1 + 0.35 * k) * (1 + 0.25 * np.sin(2 * np.pi * 0.07 * tt + k))
            i = int(a * SR)
            pad[i:i + len(tt), side] += tone * env * amp
for c in (0, 1):
    pad[:, c] = lowpass(pad[:, c], 2200)
# sub swell under the hero moments
sub = np.zeros(N)
for at in (word("intro", "هَلْ"), SC["end"]["voice"]):
    tt = t_(4.0)
    sub_s = np.sin(2 * np.pi * hz(26) * tt) * np.minimum(1, tt / 0.05) * np.exp(-tt / 1.6) * 0.35
    i = int(at * SR)
    sub[i:i + len(tt)] += sub_s[: N - i]
pad += sub[:, None]

# ------------------------------------------------------------------ one-shots
def riser(d=1.6):
    tt = t_(d)
    n = R.standard_normal(len(tt))
    sweep = lowpass(n, 2500) * (tt / d) ** 2.5 * 0.5
    tone = np.sin(2 * np.pi * np.cumsum(300 * 2 ** (2.5 * tt / d)) / SR) * (tt / d) ** 3 * 0.12
    return sweep + tone


def whoosh(d=1.1):
    tt = t_(d)
    n = lowpass(R.standard_normal(len(tt)), 1800)
    return n * np.sin(np.pi * tt / d) ** 2 * 0.5


def chime(base=76, d=3.0, notes=(0, 7, 12, 16)):
    out = np.zeros(int(d * SR))
    for k, m in enumerate(notes):
        tt = t_(d - k * 0.09)
        f = hz(base + m)
        s = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt * 3)) * np.exp(-tt * 1.6)
        i = int(k * 0.09 * SR)
        out[i:i + len(s)] += s * 0.22 * np.minimum(1, tt / 0.004)
    return out


def boom(d=3.0):
    tt = t_(d)
    body = np.sin(2 * np.pi * np.cumsum(32 + 55 * np.exp(-tt * 6)) / SR) * np.exp(-tt * 1.4)
    air = lowpass(R.standard_normal(len(tt)), 600) * np.exp(-tt * 5) * 0.6
    return np.tanh((body + air) * 1.2) * 0.6


def sparkle(d=4.0, n=26, seed=5):
    rng = np.random.default_rng(seed)
    out = np.zeros(int(d * SR))
    scale = [74, 76, 78, 81, 83, 86, 88, 90, 93]
    for _ in range(n):
        at = rng.random() * (d - 0.6)
        tt = t_(0.6)
        s = np.sin(2 * np.pi * hz(rng.choice(scale)) * tt) * np.exp(-tt * 9) * 0.06
        i = int(at * SR)
        out[i:i + len(s)] += s
    return out


fx = np.zeros((N, 2))
burst = word("intro", "هَلْ")
place(fx, sparkle(4.0, 30, 1), 0.4, 0.8, -0.3)                 # gold dust
place(fx, whoosh(2.4), 1.6, 0.35, 0.2)                          # the book opens
place(fx, riser(2.2), burst - 2.2, 0.55)                         # light wave rising
place(fx, boom(), burst - 0.03, 0.55)                            # soft light burst
place(fx, chime(76, 3.5, (0, 7, 12, 16, 19)), burst, 0.9, 0.1)
for s in TL["scenes"][1:]:                                       # light-flash transitions
    place(fx, riser(1.2), s["start"] - 1.2, 0.35)
    place(fx, whoosh(1.2), s["start"] - 0.5, 0.5, -0.4)
    place(fx, chime(81, 2.5, (0, 7, 12)), s["start"], 0.45, 0.3)
place(fx, chime(83, 3.0, (0, 4, 7, 12)), word("date", "السَّادِسَ"), 0.8, 0.35)    # the 16th lights up
place(fx, boom(2.0), word("hands", "التَّسَامُحَ") - 0.02, 0.35)                  # the clasp
place(fx, chime(79, 3.0, (0, 4, 7, 11, 14)), word("hands", "التَّسَامُحَ"), 0.7)
place(fx, sparkle(3.5, 22, 9), word("hands", "بِسَعَادَةٍ"), 0.7, 0.2)            # hearts
place(fx, chime(74, 3.5, (0, 7, 12, 14)), word("mecca", "اذْهَبُوا"), 0.65)     # the quote
place(fx, sparkle(5.0, 34, 13), SC["end"]["start"] + 0.2, 0.8)                     # dust gathers
place(fx, boom(), SC["end"]["voice"] - 0.03, 0.4)
place(fx, chime(74, 4.5, (0, 7, 12, 16, 19, 24)), SC["end"]["voice"], 0.8)

bed = pad + fx
for c in (0, 1):
    bed[:, c] = reverb(bed[:, c], 3.4, 0.45, seed=c + 1)

# ------------------------------------------------------------------ voice + ducking
with wave.open(os.path.join(HERE, "voice.wav")) as w:
    v = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float64) / 32768
v = np.pad(v, (0, max(0, N - len(v))))[:N]
v = reverb(v, 1.1, 0.08, seed=9)                                  # a touch of studio air
env = np.abs(v)
hop = SR // 100
k = len(env) // hop
e = env[: k * hop].reshape(k, hop).max(1)
sm, acc = np.zeros_like(e), 0.0
for i, x in enumerate(e):
    acc = x if x > acc else acc * 0.96
    sm[i] = acc
sm = np.clip(sm / (np.percentile(sm[sm > 0], 90) + 1e-9), 0, 1)
duck = 1 - 0.55 * np.pad(np.repeat(sm, hop), (0, N - k * hop), constant_values=0)
mix = bed * duck[:, None] * 0.8 + np.stack([v, v], 1) * 1.0
fade = np.minimum(1, np.arange(N) / (0.4 * SR)) * np.minimum(1, (N - np.arange(N)) / (1.2 * SR))
mix *= fade[:, None]
mix /= np.abs(mix).max()

raw = os.path.join(HERE, "mix_raw.wav")
with wave.open(raw, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767 * 0.9).astype("<i2").tobytes())
out = os.path.join(HERE, "mix.wav")
r = subprocess.run(["ffmpeg", "-hide_banner", "-i", raw, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                   capture_output=True, text=True)
m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r.stderr, re.S).group(0))
af = (f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
      f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af", af, "-ar", str(SR), out], check=True)
os.remove(raw)
print("mix.wav", DUR, "s")
