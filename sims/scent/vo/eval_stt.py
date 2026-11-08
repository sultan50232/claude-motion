"""Score a voiceover take: ElevenLabs Scribe transcript vs the script (character error rate).

usage: python3 vo/eval_stt.py take.mp3 [take2.mp3 ...]
"""
import json, os, re, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__))
lines = json.load(open(os.path.join(here, "..", "narration.json")))["lines"]
def norm(s):
    s = re.sub(r"[ً-ْـ]", "", s)          # tashkeel, tatweel
    s = re.sub(r"[أإآ]", "ا", s).replace("ة", "ه").replace("ى", "ي")
    return re.sub(r"[^ء-ي ]", "", s).split()
def lev(a, b):
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]
ref = norm(" ".join(l["text"] for l in lines))
for f in sys.argv[1:]:
    out = subprocess.run(["curl", "-sS", "-X", "POST", "https://api.elevenlabs.io/v1/speech-to-text",
                          "-H", "xi-api-key: " + os.environ["ELEVENLABS_API_KEY"], "-F", "model_id=scribe_v1",
                          "-F", "file=@" + f], capture_output=True, text=True).stdout
    d = json.loads(out)
    hyp = norm(d["text"])
    wer = lev(ref, hyp) / len(ref)
    print(f"{os.path.basename(f)}  lang={d['language_code']} p={d['language_probability']:.2f}  WER={wer:.3f}")
    print("   ", d["text"])
    json.dump(d, open(f.rsplit(".", 1)[0] + ".stt.json", "w"), ensure_ascii=False)
