"""Generate the voiceover with ElevenLabs (one take, whole script) + character alignment.

usage: python3 vo/tts.py <voice_id> <out_prefix> [model]
Writes <out_prefix>.mp3 and <out_prefix>.json (alignment + line char offsets).
"""
import base64, json, os, sys, urllib.request, urllib.error
here = os.path.dirname(os.path.abspath(__file__))
voice, prefix = sys.argv[1], sys.argv[2]
model = sys.argv[3] if len(sys.argv) > 3 else "eleven_v3"
lines = json.load(open(os.path.join(here, "..", "narration.json")))["lines"]
sep = "\n\n"
text, offs = "", []
for ln in lines:
    offs.append([len(text), len(text) + len(ln["text"])])
    text += ln["text"] + sep
text = text.rstrip()
body = {"text": text, "model_id": model,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.8, "style": 0.15, "use_speaker_boost": True}}
if model == "eleven_v3":
    body["voice_settings"] = {"stability": 0.5}
    body["language_code"] = "ar"
req = urllib.request.Request(
    f"https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_128",
    data=json.dumps(body).encode(), method="POST",
    headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"], "Content-Type": "application/json"})
try:
    d = json.load(urllib.request.urlopen(req, timeout=300))
except urllib.error.HTTPError as e:
    sys.exit(f"{e.code} {e.read().decode()[:400]}")
open(prefix + ".mp3", "wb").write(base64.b64decode(d["audio_base64"]))
json.dump({"text": text, "line_offsets": offs, "alignment": d["alignment"]}, open(prefix + ".json", "w"), ensure_ascii=False)
a = d["alignment"]
print(prefix, "duration", round(a["character_end_times_seconds"][-1], 2))
