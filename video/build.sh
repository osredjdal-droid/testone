#!/usr/bin/env bash
# Rebuild the Shohraty motion video end-to-end.
#   ./build.sh                 -> uses the committed voice-over in audio/vo/
#   TTS_MODEL=/path/to/vits-piper-ar_JO-kareem-medium ./build.sh   -> re-synthesises the voice first
# Needs: python3 with numpy scipy soundfile (+ sherpa-onnx for TTS), node + playwright, ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"
PY=${PYTHON:-python3}
OUT=out/shohraty-nidham-taswiqi-9x16.mp4

if [ -n "${TTS_MODEL:-}" ]; then
  "$PY" tools/synth.py "$TTS_MODEL" audio/vo 0.92
fi
"$PY" tools/build_timeline.py
"$PY" tools/mix_audio.py
node tools/render.mjs video out/.frames.mp4 "${WORKERS:-3}"

# Final delivery encode: H.264 High, 1080x1920, 30 fps, AAC 48 kHz — Reels / TikTok / Shorts ready.
ffmpeg -y -loglevel error -i out/.frames.mp4 -i audio/mix.wav \
  -c:v libx264 -preset slow -crf 18 -profile:v high -level 4.2 -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$OUT"
ffmpeg -y -loglevel error -i audio/mix.wav -map 0:a -af "pan=mono|c0=c0" -c:a libmp3lame -b:a 128k out/soundtrack.mp3
rm -f out/.frames.mp4
echo "wrote $OUT"
