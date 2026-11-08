#!/usr/bin/env bash
# Final audio for the scent video: voiceover on top, music/SFX bed ducked under it,
# the sniff on the inhale, mastered to -14 LUFS / -1.5 dBTP (TikTok).
set -euo pipefail
cd "$(dirname "$0")/../.."
SNIFF_AT_MS=1500
ffmpeg -loglevel error -y -i public/scent-vo.wav -i public/scent-music-sfx.wav -i public/scent-sniff.mp3 -filter_complex "
[0:a]aresample=48000,pan=stereo|c0=c0|c1=c0,highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120,volume=2dB,asplit=2[vo][sc];
[1:a]aresample=48000,volume=-14dB[bed];
[bed][sc]sidechaincompress=threshold=0.02:ratio=5:attack=30:release=450:makeup=1[duck];
[2:a]aresample=48000,pan=stereo|c0=c0|c1=c0,volume=-9dB,adelay=${SNIFF_AT_MS}|${SNIFF_AT_MS}[sn];
[vo][duck][sn]amix=inputs=3:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11[out]" \
  -map "[out]" -ar 48000 -ac 2 out/scent/scent-mix.wav
ffmpeg -hide_banner -i out/scent/scent-mix.wav -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:" | tail -2
