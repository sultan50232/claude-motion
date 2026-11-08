# 02 · The hole in the airplane window

46.5 s · 1080×1920 (9:16) · 30 fps · Arabic voiceover + synced captions, −14 LUFS · source: [`sims/window/main.js`](../../sims/window/main.js)

A vertical explainer in Arabic: why the middle pane of an airliner window has a small hole. Built with the `sims/` pipeline (three.js page, `render(t)` pure in time, captured frame by frame), not Remotion.

## Prompt

The agent got a reference video (3D cutaway explainer with a label chip at the top and big word-by-word captions), then:

> Produce a 45–60 s educational video in the same style as the reference. Title: السر وراء الثقب الصغير في نافذة الطائرة! (voiceover script given in full). Professional engineering 3D; the camera starts inside the plane and heads to the window; extreme zoom on the hole; exploded view of the window layers; animated arrows for the pressure difference; show air and moisture; continuous camera; natural Arabic voiceover; synced Arabic captions; 9:16; scientifically accurate.

## How it was made

1. Voiceover: ElevenLabs `with-timestamps` (multilingual v2), one call for the whole script so the delivery is continuous; sentences were then re-spaced with short pauses and every word's time written to [`sims/window/timeline.json`](../../sims/window/timeline.json). Captions, chips, camera beats and sound all read from it.
2. Scene ([`sims/window/main.js`](../../sims/window/main.js)): fuselage section with cabin, seats and bins; windows cut into the skin and lining with a rounded-rect SDF in the shader; the hero window is three real panes (outer 10 mm, middle 6 mm with the breather hole, inner scratch pane 3 mm), seal, frame and reveal. Logarithmic depth so the camera can go from the aisle to a 4 mm hole and through it.
3. Beats: cabin → zoom into the hole → fly out through it → fuselage cross-section while the plane climbs (ISA pressure outside, cabin held at ≈ 2,400 m) → exploded window → outer pane loaded, air flowing through the hole into the gap, balanced arrows on the middle pane → fog in the gap clearing through the hole → back out to the fuselage.
4. Sound: [`sfx/cues/window.py`](../../sfx/cues/window.py) (cabin hum, whooshes on camera moves, chip pops, payoff chime) mixed under the voice, loudness-normalised to −14 LUFS.

```bash
node sims/build.mjs window
node sims/capture.mjs window --size 1080x1920 --dpr 1 --fps 30 --out out/sims/window-silent.mp4
python3 -m sfx sfx/cues/window.py
ffmpeg -i out/sims/window-vo.wav -i out/sims/window-sfx.wav -filter_complex \
  "[0:a]aformat=channel_layouts=stereo[v];[1:a]volume=0.2[s];[v][s]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5" out/sims/window-mix.wav
ffmpeg -i out/sims/window-silent.mp4 -i out/sims/window-mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest out/sims/window.mp4
```

## Data

- Outside pressure follows the ISA standard atmosphere: 1.01 bar at sea level → ≈ 0.23 bar at 11,000 m.
- Cabin held at ≈ 2,400 m (8,000 ft) equivalent ≈ 0.75 bar, so the outer pane carries ≈ 0.5 bar.
- The breather (bleed) hole is in the middle pane: it keeps the gap at cabin pressure, so the outer pane takes the full load and the middle pane stays unloaded as a fail-safe; it also lets moist air out of the gap so it doesn't fog or frost. Hole size on screen is slightly exaggerated for legibility.
