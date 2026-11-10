---
name: history-story
description: Vertical (9:16) 2D animated history stories for TikTok/Reels/Shorts with a faceless cutout narrator, animated painted backgrounds, Arabic kinetic captions, paper-sweep transitions and a timeline-synced sound bed with voice-over slots. Use when making a new episode, retiming one, adding a scene, pose, prop or character, or changing the series' look.
---

# History story (cutout narrator, 9:16)

The series' first episode is `PaperRoad` ("درب الورق", 46 s, 1080×1920, 30 fps). Code lives in `src/history/`, the story in `src/history/stories/paper-road.json`, sound in `sfx/cues/paper-road.py`. Read `motion-design` first; this file only adds what is specific to the series.

## What makes the style

- **One narrator, one identity.** Cream turban with a gold pin, teal robe, terracotta scarf, gold sash, satchel, round head with **no face**. It's `NARRATOR` in `rig.tsx`. Never restyle it per episode: the viewer recognises the channel by it. Feelings come from the body: poses, lean, head tilt, hands.
- **Cutout animation, not slideshow.** Every figure is a rig of flat shapes hung on joints (`Figure` in `rig.tsx`). Poses are angle sets, blended with springs that overshoot slightly. That snap is the cutout look. On top of that: a walk cycle, breathing, beat gestures (a head nod on every spoken word, elbow sway while talking) and drag (scarf and hem lag behind velocity).
- **Backgrounds that live.** Each scene is 4–6 parallax layers (`Layer` depth 0 = sky … 1 = foreground) under a slow camera push or pan, and **at least two things moving on their own**: banners, water, a wheel, workers, camels, lamps, birds, dust. A static painting with a zoom is the thing this style exists to avoid.
- **Paper is the motif.** Parchment caption cards with torn edges, paper texture over every frame (`PaperFinish`), and the transition is a sheet of paper sweeping right → left (the Arabic reading direction) with the cut hidden under it (`PaperSweep`). For a story about another subject, keep the sweep but you may swap the sheet for that story's object (a sail, a banner, smoke).
- **Arabic kinetic captions.** Words rise in one at a time, timed to speech (`wordTimes`); never animate below the word, or the letters disconnect. One or two accent words per line in rust with a gold brush stroke. A teal place/date tag (Reem Kufi) above names where and when we are.

## Layout for the feed (1080×1920)

| Zone | y (px) | What goes there |
|---|---|---|
| Top UI (tabs, search) | 0–240 | nothing important |
| Place/date tag | ~268 | `chips` |
| Caption card | 400–640 | `lines` (max ~3 short lines at 76 px Cairo 800) |
| Action | 640–1450 | the scene's moving story |
| Narrator | feet at 1780–1810, scale 1.1–1.25 | keep x in 220–880 |
| Bottom UI (username, caption, music) | 1500–1920, left half | no text, no CTA |
| Right rail (like/comment/share) | x > 930, y 900–1500 | no faces of secondary figures, no text |

## Making a new episode

1. Agree on the story, the hook line (first 2 s must state the stakes), the hero moment and the end call-to-action. 40–60 s, 5–7 scenes, ~2.5 Arabic words per second.
2. Copy `stories/paper-road.json` to `stories/<name>.json` and write, in this order:
   - `lines`: the voice-over, one entry per spoken sentence, `t`/`end` in seconds, `accent` = the exact word tokens to highlight (punctuation included, e.g. `"معركة!"`).
   - `cuts`: when each scene ends. Put cuts in the gaps between lines.
   - `chips`: place/date tags.
   - `narrator`: keyframes. Any key may set `x y s face pose walk prop`; `dur` is the move time (0 = jump, use it on cuts). Poses: `idle present point pointUp raise open secret explain cross hold shrug`. Props: `paper scroll book quill mallet spear mould none`.
   - one object per scene with its beats (`clash`, `burst`, …).
3. Point `theme.ts` at the new JSON (or make the theme import a parameter if two episodes must live side by side), write scenes in `src/history/scenes/`, list them in `SCENES` in `HistoryStory.tsx`, register a `<Composition>` in `src/Root.tsx`.
4. Secondary characters reuse `Figure` with their own `Look` (soldiers, workers, scholars in the example). Drive their poses procedurally from `t` in the scene: a pounding cycle, a dip cycle, a march.
5. Review loop: `npm run paper:draft`, then `npm run sheet -- --video out/paper-road-draft.mp4 --timeline src/history/stories/<name>.json`. In the story JSON, an object with a `t` counts as one beat, so pose keys and caption lines show up on the sheet without their x/y. Check the zones table above on every tile.
6. Sound: copy `sfx/cues/paper-road.py`. It reads the same JSON; music is maqam Hijaz on D with a maqsum darbuka pattern, plucked oud-like phrases, and `doum tek rustle clash wind pluck` from `sfx/synth.py`.
7. Voice-over (below), `npm run paper:build`, `npm run wave -- out/paper-road.mp4 --timeline src/history/stories/<name>.json`.

## Voice-over

- Quick guide voice: `npm run paper:vo` (`scripts/vo-google.py`, Google's Arabic voice via gTTS; the environment must allow `translate.google.com`). Give a line a `say` field when the spoken form differs from the caption, e.g. numbers in words: `"text": "عام ٧٥١م…", "say": "عامَ سبعِمئةٍ وواحدٍ وخمسين…"`.
- Professional voice: record one WAV per line as `public/<name>/vo/01.wav, 02.wav, …` (any rate, 16/24-bit). `examples/02-paper-road/voiceover.md` is the recording script.
- Then always `python3 scripts/retime.py <story.json> <vo dir>`: it lays the lines out to fit the takes and moves every cut, chip, pose key and scene beat with them. Never speed the voice up to fit the picture; stretch the picture to fit the voice.
- The cue sheet places each take at its line's `t`, ducks the music under it, and warns if a take overruns its slot.

## Rules of thumb

- Hook: the first line on screen by 0.2 s, the narrator already moving at frame 0, the map/scene already partly drawn (frame 0 is often the cover).
- One hero moment (the clash in the example, with the only `impact`). Every other scene gets one smaller payoff (a burst of paper, shelves filling).
- The narrator gestures *at* the action: point at the battle, hold up the sheet, hand by the head for "the secret". Change pose on the line that needs it, not between lines.
- Facing: the narrator faces the thing it talks about. Characters travelling "west" walk left, matching a map read in Arabic.
- Historical claims: say "تقول الروايات" (the sources say) when a story is a tradition rather than settled fact (the Talas papermakers are one). Check dates before rendering.
