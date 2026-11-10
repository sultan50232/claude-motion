# 02 · درب الورق (The Road of Paper)

62 s · 1080×1920 (9:16) · 30 fps · Arabic voice-over (Google) · stereo, −14 LUFS · source: [`src/history/`](../../src/history/), story: [`paper-road.json`](../../src/history/stories/paper-road.json), sound: [`sfx/cues/paper-road.py`](../../sfx/cues/paper-road.py)

A 2D animated history short for TikTok/Reels: a faceless cutout narrator tells how paper travelled from the battle of Talas (751) through Samarkand and the Silk Road to Baghdad's first paper mill (~794) and the House of Wisdom, then west across the world.

## Prompt

> أريد إنتاج فيديوهات بأسلوب: 2D Animated Historical Storytelling with Faceless Cartoon Narrator, Cutout Animation and Dynamic Motion Graphics.
>
> شخصية كرتونية ثابتة الهوية بدون ملامح، تظهر أمام خلفيات تاريخية مرسومة، مع تحريك اليدين والجسم، وتغيير المشاهد حسب أحداث القصة، وإضافة نصوص عربية متحركة ومؤثرات صوتية وتعليق صوتي احترافي.
>
> أريد حركة فعلية للشخصيات والخلفيات، وليس مجرد صور ثابتة مع زوم وانتقالات.
>
> اجعل الإخراج حديثًا وجذابًا ومناسبًا لمقاطع TikTok وReels بنسبة 9:16.

## What's in it

| Scene | Time | Moving parts |
|---|---|---|
| Hook: a map on a desk | 0–8.1 s | narrator walks in, raises a sheet into a burst of light; route and coastlines draw on; crossed-swords stamp |
| Talas, 751 | 8.1–19.6 s | two armies march and clash (camera shake, dust), banners wave, a volley of arrows, river flows |
| Samarkand workshop | 19.6–29.1 s | one worker pounds pulp, one dips the mould in the vat, sheets swing on the line, new ones drop in |
| Silk Road | 29.1–38.3 s | 5-layer parallax dunes scroll, camels walk with paper bundles, signpost passes, Baghdad rises on the horizon |
| Baghdad, ~794 | 38.3–46.0 s | water wheel turns the mill's hammer, a burst of paper flies out, boat sails; dolly through a window |
| House of Wisdom | 46.0–53.3 s | shelves fill with books, scholars write and read, lamps sway, astrolabe turns |
| Finale | 53.3–62.4 s | the route draws west city by city, paper flutters along it, follow call-to-action |

The narrator is one rig (`src/history/rig.tsx`) with 11 poses blended by springs, a walk cycle, breathing, a nod on every spoken word and a scarf that lags behind. Soldiers, workers and scholars are the same rig in other costumes.

## Voice-over

`npm run paper:vo` reads every line with Google's Arabic voice (gTTS, needs `translate.google.com` in the environment's allowed hosts), then `scripts/retime.py` stretches the whole timeline to fit the takes: the first cut was 46 s of slots, the voice needed 62 s. Lines with numbers have a `say` field with the number written out in words. For a professional voice, record the 13 lines in [`voiceover.md`](voiceover.md) into `public/paper-road/vo/`, rerun `retime.py`, then `npm run paper:build`. The music ducks under the voice automatically.

## Process

The agent wrote the script and the story JSON first, then the rig, captions and transition, then the six scenes; reviewed 46 one-per-second contact sheets of a half-res draft; fixed the battle (armies were too small and hidden behind the narrator), the blank map on frame 0, small place tags and the last caption leaving before the end; then wrote the cue sheet from the same JSON.

## History notes

The Talas papermakers story comes from al-Thaʿalibi (11th c.); historians debate it (paper was likely already known in Central Asia), so the script says «تقول الروايات». The Baghdad mill date (~794–795, under Harun al-Rashid) is the commonly given one; the House of Wisdom flourished mostly under al-Maʾmun (813–833).
