#!/usr/bin/env bash
# Rebuild the Shohraty «قلنالو الحقيقة» brand story end-to-end.
#   ./build.sh          -> ElevenLabs take 3 (audio/takes/take3.mp3 + take3.words.json)
#   TAKE=1 ./build.sh   -> another take; timeline, captions, animation and sound design all re-time themselves
# Needs: python3 with numpy scipy soundfile, node + playwright (Chromium), ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"
PY=${PYTHON:-python3}
OUT=out/shohraty-qolnalou-el-haqiqa-9x16.mp4

TAKE=${TAKE:-3} "$PY" tools/build_timeline.py
node tools/render.mjs cues audio/cues.json
"$PY" tools/mix_audio.py
node tools/render.mjs video out/.frames.mp4 "${WORKERS:-3}"

# Final delivery encode: H.264 High, 1080x1920, 30 fps, AAC 48 kHz — Reels / TikTok / Shorts ready.
ffmpeg -y -loglevel error -i out/.frames.mp4 -i audio/mix.wav \
  -c:v libx264 -preset slow -crf 18 -profile:v high -level 4.2 -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$OUT"
ffmpeg -y -loglevel error -i audio/mix.wav -map 0:a -af "pan=mono|c0=c0" -c:a libmp3lame -b:a 128k out/soundtrack.mp3
node tools/render.mjs cover out/cover.png "${COVER_T:-7.0}"
rm -f out/.frames.mp4
echo "wrote $OUT"
