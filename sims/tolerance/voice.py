"""Voice-over for the tolerance piece: edge-tts (ar-SA-ZariyahNeural), one clip per line,
laid out on a timeline whose scene starts are derived from the speech. Writes
voice.wav (48 kHz mono) and timeline.json (scene windows + word times) next to this file.

    python3 sims/tolerance/voice.py
"""
import asyncio, json, os, subprocess, tempfile
import numpy as np
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
VOICE = "ar-SA-ZariyahNeural"
Q = dict(rate="-8%", pitch="+14Hz")      # the distinctive "هل تعلم" tone
BODY = dict(rate="-4%", pitch="+3Hz")

# (scene, [(clip text, style, pause after)]) ; scene lead = visual time before speech starts
SCRIPT = [
    ("intro", 4.9, [("هَلْ تَعْلَمُ؟", Q, 0.0)]),
    ("date", 1.3, [("هَلْ تَعْلَمُ", Q, 0.14),
                   ("أَنَّ اليَوْمَ العَالَمِيَّ لِلتَّسَامُحِ هُوَ السَّادِسَ عَشَرَ مِنْ نُوفَمْبَر مِنْ كُلِّ عَامٍ؟", BODY, 0.0)]),
    ("hands", 1.2, [("هَلْ تَعْلَمُ", Q, 0.14),
                    ("أَنَّ التَّسَامُحَ يَجْعَلُنَا نَعِيشُ بِسَعَادَةٍ وَيُقَلِّلُ المَشَاكِلَ؟", BODY, 0.0)]),
    ("mecca", 1.4, [("هَلْ تَعْلَمُ", Q, 0.14),
                    ("أَنَّ رَسُولَنَا صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ سَامَحَ أَهْلَ مَكَّةَ وَقَالَ: اذْهَبُوا فَأَنْتُمُ الطُّلَقَاءُ؟", BODY, 0.0)]),
    ("end", 2.4, [("التَّسَامُحُ خُلُقٌ عَظِيمٌ، فَلْنَجْعَلْهُ أُسْلُوبَ حَيَاتِنَا.", dict(rate="-10%", pitch="+2Hz"), 0.0)]),
]
TAIL = {"intro": 1.6, "date": 1.5, "hands": 1.5, "mecca": 1.9, "end": 3.2}


async def tts(text, style):
    kw = dict(voice=VOICE, **style)
    if os.environ.get("HTTPS_PROXY"):
        kw["proxy"] = os.environ["HTTPS_PROXY"]
    com = edge_tts.Communicate(text, boundary="WordBoundary", **kw)
    audio, words = bytearray(), []
    async for ch in com.stream():
        if ch["type"] == "audio":
            audio += ch["data"]
        elif ch["type"] == "WordBoundary":
            words.append([ch["text"], ch["offset"] / 1e7, (ch["offset"] + ch["duration"]) / 1e7])
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
        f.write(audio)
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", f.name, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True).stdout
    os.unlink(f.name)
    x = np.frombuffer(pcm, np.float32)
    # trim silence, shift word times
    loud = np.where(np.abs(x) > 0.01)[0]
    a, b = max(0, loud[0] - int(0.03 * SR)), min(len(x), loud[-1] + int(0.08 * SR))
    off = a / SR
    return x[a:b], [[w, s - off, e - off] for w, s, e in words]


async def main():
    t, scenes, words, parts = 0.0, [], [], []
    for name, lead, clips in SCRIPT:
        start = t
        t += lead
        v0 = t
        for text, style, pause in clips:
            x, ws = await tts(text, style)
            parts.append((t, x))
            words += [{"w": w, "s": round(t + s, 3), "e": round(t + e, 3), "scene": name} for w, s, e in ws]
            t += len(x) / SR + pause
        v1 = t
        t += TAIL[name]
        scenes.append({"name": name, "start": round(start, 3), "voice": round(v0, 3), "voice_end": round(v1, 3), "end": round(t, 3)})
    dur = round(t, 2)
    track = np.zeros(int(dur * SR) + SR, np.float32)
    for at, x in parts:
        i = int(at * SR)
        track[i:i + len(x)] += x
    track = track[: int(dur * SR)]
    pcm = (np.clip(track, -1, 1) * 32767).astype("<i2").tobytes()
    import wave
    with wave.open(os.path.join(HERE, "voice.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm)
    tl = {"duration": dur, "fps": 30, "scenes": scenes, "words": words}
    with open(os.path.join(HERE, "timeline.json"), "w", encoding="utf-8") as f:
        json.dump(tl, f, ensure_ascii=False, indent=1)
    for s in scenes:
        print(s)
    print("duration", dur, "words", len(words))

asyncio.run(main())
