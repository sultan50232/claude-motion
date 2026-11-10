"""Load recorded voice-over takes (any rate, 16/24-bit PCM WAV) as mono samples at SR."""

import os
import struct
import wave

from .synth import SR


def load_wav(path):
    """Mono float samples at SR, or None if the file doesn't exist."""
    if not os.path.exists(path):
        return None
    with wave.open(path, "rb") as wf:
        ch, width, rate, n = wf.getnchannels(), wf.getsampwidth(), wf.getframerate(), wf.getnframes()
        raw = wf.readframes(n)
    if width == 2:
        vals = struct.unpack(f"<{n * ch}h", raw)
        scale = 32768.0
    elif width == 3:
        vals = [int.from_bytes(raw[i : i + 3], "little", signed=True) for i in range(0, len(raw), 3)]
        scale = 8388608.0
    else:
        raise ValueError(f"{path}: use 16- or 24-bit PCM WAV")
    mono = [sum(vals[i * ch : (i + 1) * ch]) / ch / scale for i in range(n)]
    if rate == SR:
        return mono
    step = rate / SR
    out = []
    pos = 0.0
    while pos < n - 1:
        i = int(pos)
        f = pos - i
        out.append(mono[i] * (1 - f) + mono[i + 1] * f)
        pos += step
    return out
