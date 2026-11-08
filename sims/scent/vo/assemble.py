"""Cut the chosen take into lines (on Scribe word boundaries), re-space the pauses,
and write the voiceover WAV + timeline.json that the sim and the sound script read.

usage: python3 sims/scent/vo/assemble.py
"""
import json, os, subprocess
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
lines = json.load(open(os.path.join(root, "narration.json")))["lines"]
words = [w for w in json.load(open(os.path.join(here, "take.stt.json")))["words"] if w["type"] == "word"]

LEAD = 0.35                      # first word after the first frame
GAP_AFTER = {"hook": 0.6, "who": 0.55, "odd": 0.85, "why": 0.8, "receptor": 0.6,
             "brain": 0.7, "link": 0.65, "differ": 0.7}
TAIL = 3.2                       # quiet ending after the last word
PRE, POST = 0.08, 0.16           # padding around each cut

# Scenes: which lines each one carries (scene starts with its first line, minus a lead-in).
SCENES = [("opening", ["hook"]), ("memories", ["who", "odd"]), ("question", ["why"]),
          ("receptors", ["receptor"]), ("brain", ["brain"]), ("feeling", ["link"]),
          ("differ", ["differ"]), ("ending", ["end"])]

i, cuts = 0, []
for ln in lines:
    sub = ln["sub"].split()
    n = len(sub)
    ws = words[i:i + n]
    i += n
    cuts.append({"id": ln["id"], "src0": ws[0]["start"] - PRE, "src1": ws[-1]["end"] + POST,
                 "words": [{"w": s, "a": w["start"], "b": w["end"], "heard": w["text"]} for s, w in zip(sub, ws)]})
assert i == len(words), (i, len(words))

t, out = LEAD, []
for c in cuts:
    off = t - c["src0"]
    out.append({"id": c["id"], "t0": round(t, 3), "t1": round(t + c["src1"] - c["src0"], 3), "src0": round(c["src0"], 3),
                "src1": round(c["src1"], 3),
                "words": [{"w": w["w"], "a": round(w["a"] + off, 3), "b": round(w["b"] + off, 3)} for w in c["words"]]})
    t = out[-1]["t1"] + GAP_AFTER.get(c["id"], 0)
duration = round(out[-1]["t1"] + TAIL, 2)

byid = {l["id"]: l for l in out}
scenes = []
for k, (name, ids) in enumerate(SCENES):
    start = 0 if k == 0 else round(byid[ids[0]]["t0"] - 0.35, 3)
    scenes.append({"id": name, "t0": start, "lines": ids})
for k, s in enumerate(scenes):
    s["t1"] = scenes[k + 1]["t0"] if k + 1 < len(scenes) else duration

tl = {"duration": duration, "fps": 30, "size": [1080, 1920], "scenes": scenes, "lines": out}
json.dump(tl, open(os.path.join(root, "timeline.json"), "w"), ensure_ascii=False, indent=1)

# Voiceover WAV on the new timeline.
src = os.path.join(here, "take.mp3")
parts, labels = [], []
for k, l in enumerate(out):
    d = int(l["t0"] * 1000)
    parts.append(f"[0:a]atrim={l['src0']}:{l['src1']},asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st={l['src1']-l['src0']-0.06:.3f}:d=0.06,adelay={d}|{d}[a{k}]")
    labels.append(f"[a{k}]")
fc = ";".join(parts) + ";" + "".join(labels) + f"amix=inputs={len(out)}:normalize=0,apad,atrim=0:{duration}[out]"
dst = os.path.join(root, "..", "..", "public", "scent-vo.wav")
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-filter_complex", fc, "-map", "[out]", "-ac", "1", "-ar", "48000", dst], check=True)
print("duration", duration)
for s in scenes: print(f"  {s['id']:10s} {s['t0']:6.2f} → {s['t1']:6.2f}  ({s['t1']-s['t0']:.1f}s)")
for l, c in zip(out, cuts):
    bad = [(w['w'], w['heard']) for w in c['words'] if w['w'].strip('،؟!.') .replace('ّ','') [:2] != w['heard'][:2]]
    if bad: print("  check", l['id'], bad)
