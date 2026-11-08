# scent: «ليش بعض الروائح ترجع لك ذكريات من طفولتك؟»

A 59 s vertical (1080×1920, 30 fps) Arabic explainer for TikTok: modern 3D (three.js) with 2D motion-graphics overlays,
a Saudi-dialect voiceover (ElevenLabs), word-synced Arabic subtitles, and an original music/SFX bed.
Output: `out/scent/TikTok_Episode_01.mp4`.

## Files

| File | What it is |
|---|---|
| `narration.json` | the nine voiceover lines: `text` (spoken, light tashkeel) and `sub` (on-screen subtitle) |
| `vo/tts.py` | ElevenLabs `eleven_v3` TTS of the whole script in one take (with character alignment) |
| `vo/eval_stt.py` | scores a take with ElevenLabs Scribe speech-to-text (word error rate vs the script) |
| `vo/take.mp3`, `vo/take.stt.json` | the chosen take (premade voice "Liam", WER 0 %) and its word timestamps |
| `vo/assemble.py` | cuts the take into lines on word boundaries, re-spaces pauses → `public/scent-vo.wav` + `timeline.json` |
| `timeline.json` | 8 scenes and every spoken word with its time; the picture and the sound both read it |
| `main.js` | the sim: five 3D sets, camera, labels, question, subtitles; `render(t)` is pure in time |
| `character.js`, `brain.js`, `cards.js`, `lib.js` | the toy-style people, the procedural brain, painted memory postcards, palette + helpers |
| `../../sfx/cues/scent.py` | music bed (D major pad + music box) and SFX, timed from `timeline.json` |
| `mix.sh` | voice + ducked bed + sniff → `out/scent/scent-mix.wav`, mastered −14 LUFS / −1.5 dBTP |

## Rebuild

```bash
npm install
python3 sims/scent/vo/assemble.py                      # only if the take or the pauses change
node sims/build.mjs scent
node sims/capture.mjs scent --size 1080x1920 --dpr 1 --stills 1,8,17.5,23,30,38,44,53 --cols 4 --out out/sims/scent-review.png
node sims/capture.mjs scent --size 1080x1920 --dpr 1 --fps 30 --crf 15 --out out/scent/silent.mp4   # ~2 s/frame on CPU; split with --from/--to to run in parallel
python3 -m sfx sfx/cues/scent.py
./sims/scent/mix.sh
ffmpeg -i out/scent/silent.mp4 -i out/scent/scent-mix.wav -map 0:v -map 1:a -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart -shortest out/scent/TikTok_Episode_01.mp4
```

New voice take: `python3 sims/scent/vo/tts.py <voice_id> /tmp/take` → `python3 sims/scent/vo/eval_stt.py /tmp/take.mp3`
→ copy to `vo/take.mp3` and save Scribe's JSON as `vo/take.stt.json`, then `assemble.py`.

## Scenes (from `timeline.json`)

| # | Time | Line | Picture |
|---|---|---|---|
| 1 | 0.0–5.4 | قد شمّيت عطر… | young man raises a perfume bottle, closes his eyes; scent swirls, the room turns violet and memory postcards bloom behind him |
| 2 | 5.4–16.2 | يمكن شخص… / الغريب إن ريحة… | floating childhood island: old Najdi house, palm, father in thobe, mother in hijab, the child (same violet hoodie) hopping between them, letter blocks أ ب ت, a kite; a scent ribbon lights the windows |
| 3 | 16.2–19.3 | طيّب، ليش يصير كذا؟ | room dims, his head turns to glass, the brain inside; «كيف ترتبط الروائح بالذكريات؟» |
| 4 | 19.3–26.0 | لمّا تشمّ ريحة… | scent drawn into the nose → cross-section: molecules bind receptor cilia in the mucus, neurons flash, signals climb through the cribriform plate into the olfactory bulb's glomeruli |
| 5 | 26.0–33.4 | ومنها تنتقل المعلومات… | brain clay → glass; pulses run bulb → amygdala → hippocampus; labels on the spoken words |
| 6 | 33.4–42.1 | وهذا الارتباط… | brain rises; violet (emotion) and sky (memory) threads reach three overlapping memories that stack into one |
| 7 | 42.1–47.8 | لكن مو كل ريحة… | three scents (قهوة، مطر، بخور): one clear memory, one empty «؟», one that falls apart; «الاستجابة تختلف من شخص لآخر» |
| 8 | 47.8–59.3 | المثير إن أشياء بسيطة… | back in the room; things on the shelf glow, a 0.7 s flash of the childhood island, scent curls, quiet title, fade |

## Science check

What the script says, and what it is based on:

- Odorant molecules dissolve in the nasal mucus and bind receptors on the cilia of olfactory sensory neurons in the roof of the nasal cavity; their axons pass through the cribriform plate to glomeruli in the **olfactory bulb** (all standard textbook neuroanatomy, e.g. Purves, *Neuroscience*).
- From the bulb, the olfactory tract projects to piriform cortex and directly to the **amygdala** and the entorhinal cortex, the main input to the **hippocampus**. Smell is the one sense whose first relay does not go through the thalamus, which is the usual explanation for its close tie to emotion and memory.
- Odour-evoked autobiographical memories tend to be older (often from the first decade of life) and more emotional than memories cued by words or pictures, but they are **not more accurate** (Herz & Schooler 2002; Willander & Larsson 2006; the "Proust effect" literature). The script says this ("ولا كل ذكرى تكون دقيقة تمامًا") and uses "يساعد يفسّر", not "يثبت".
- Responses differ between people because the associations are learned: the same smell links to different moments, or none.

The brain model is a simplified illustration (shape, lobes and the positions of bulb, amygdala and hippocampus are roughly right; proportions are stylised).

## Notes

- Voice: the ElevenLabs key on this machine can generate speech, speech-to-text and sound effects but cannot list voices
  (no `voices_read`), and no reference voice was found in the repos, so the take uses the premade voice "Liam" (`TX3LPaxmHKxFdv7VOQHJ`)
  on `eleven_v3` with `language_code: ar`. Four premade voices were generated and scored by Scribe; Liam had 0 % WER.
  To use your own (cloned) voice, pass its voice_id to `vo/tts.py` and rerun the chain.
- Music is composed in code (`sfx/cues/scent.py`), so there is no licence to clear. The sniff is an ElevenLabs sound effect.
- Arabic is shaped by the browser (IBM Plex Sans Arabic, OFL, via `@fontsource/ibm-plex-sans-arabic`); `sims/build.mjs`
  inlines it for any sim folder that contains an `arabic` marker file.
