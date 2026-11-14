# tolerance — «هل تعلم؟» for the International Day for Tolerance

A 45 s, 16:9, 4K TV-style segment in Arabic: a glowing book opens and its light becomes a
3D «هل تعلم؟»; a globe and a November calendar whose 16th lights up; two hands, gold and
ivory, shake inside light waves and hearts; a symbolic Makkah at golden hour (the Kaaba,
arcades, minarets and mountains; no people are depicted); gold dust gathers into the closing
line «التسامح خلق عظيم، فلنجعله أسلوب حياتنا».

Every beat is keyed to the narration's real word times (`timeline.json`): the 3D title lands
on «هَلْ», the 16th lights on «السادس», the hands clasp on «التسامح», the quote appears on
«اذهبوا».

```bash
python3 sims/tolerance/voice.py      # narration (edge-tts, ar-SA-ZariyahNeural) -> voice.wav + timeline.json
node sims/tolerance/fonts.mjs        # inline the Arabic fonts -> fonts.gen.js (needed before build)
node sims/build.mjs tolerance
python3 sims/tolerance/sound.py      # synthesised score + SFX + voice, -16 LUFS -> mix.wav
node sims/capture.mjs tolerance --size 1920x1080 --dpr 2 --fps 30 --out out/sims/tolerance/silent.mp4   # 3840x2160
ffmpeg -i out/sims/tolerance/silent.mp4 -i sims/tolerance/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -shortest out/sims/tolerance/tolerance-4k.mp4
```

Each «هَلْ تَعْلَمُ» is its own clip with a brighter pitch so every question opens on the same
distinctive tone. Fonts: Reem Kufi (title), Amiri (quote, closing line), Tajawal (cards), all
SIL OFL (licences in `fonts/`). Music and effects are synthesised in `sound.py`; no samples.
