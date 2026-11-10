# 02 · درب الورق (The Road of Paper)

46 s · 1080×1920 (9:16) · 30 fps · stereo, −14 LUFS · source: [`src/history/`](../../src/history/), story: [`paper-road.json`](../../src/history/stories/paper-road.json), sound: [`sfx/cues/paper-road.py`](../../sfx/cues/paper-road.py)

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
| Hook: a map on a desk | 0–5.6 s | narrator walks in, raises a sheet into a burst of light; route and coastlines draw on; crossed-swords stamp |
| Talas, 751 | 5.6–13.4 s | two armies march and clash (camera shake, dust), banners wave, a volley of arrows, river flows |
| Samarkand workshop | 13.4–21.0 s | one worker pounds pulp, one dips the mould in the vat, sheets swing on the line, new ones drop in |
| Silk Road | 21.0–28.4 s | 5-layer parallax dunes scroll, camels walk with paper bundles, signpost passes, Baghdad rises on the horizon |
| Baghdad, ~794 | 28.4–32.2 s | water wheel turns the mill's hammer, a burst of paper flies out, boat sails; dolly through a window |
| House of Wisdom | 32.2–38.6 s | shelves fill with books, scholars write and read, lamps sway, astrolabe turns |
| Finale | 38.6–46 s | the route draws west city by city, paper flutters along it, follow call-to-action |

The narrator is one rig (`src/history/rig.tsx`) with 11 poses blended by springs, a walk cycle, breathing, a nod on every spoken word and a scarf that lags behind. Soldiers, workers and scholars are the same rig in other costumes.

## Voice-over

Not included: this environment can't reach a speech service. The track ships with music and sound effects, and every line has a slot: record the 13 lines in [`voiceover.md`](voiceover.md), drop them in `public/paper-road/vo/`, run `npm run paper:build`. Music ducks under the voice automatically.

## Process

The agent wrote the script and the story JSON first, then the rig, captions and transition, then the six scenes; reviewed 46 one-per-second contact sheets of a half-res draft; fixed the battle (armies were too small and hidden behind the narrator), the blank map on frame 0, small place tags and the last caption leaving before the end; then wrote the cue sheet from the same JSON.

## History notes

The Talas papermakers story comes from al-Thaʿalibi (11th c.); historians debate it (paper was likely already known in Central Asia), so the script says «تقول الروايات». The Baghdad mill date (~794–795, under Harun al-Rashid) is the commonly given one; the House of Wisdom flourished mostly under al-Maʾmun (813–833).
