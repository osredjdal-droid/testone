# Shohraty — «نظام تسويقي، ولا أفعال عشوائية؟»

Motion-graphics video with Arabic (Algerian darja) voice-over, built on the
**Shohraty Design System** (purple `#653DC7`, yellow `#FFB400`, Roboto + Noto Kufi Arabic,
C-arc logo motif, dark → light → tint section rhythm, split headings with one highlighted keyword).

| | |
|---|---|
| **Video** | `out/shohraty-nidham-taswiqi-9x16.mp4` — 1080×1920, 30 fps, H.264 + AAC, 1:20 |
| **Soundtrack** | `out/soundtrack.mp3` — voice + music + sound design, mixed to −14 LUFS |
| **Cover** | `out/cover.png` — first-frame / Reels cover |
| **Format** | 9:16 vertical (Instagram Reels, TikTok, YouTube Shorts, Facebook) |

## Storyboard

| # | Background | Voice-over (on screen word by word) | Visual |
|---|---|---|---|
| 1 | dark | نظام تسويقي، ولا أفعال عشوائية؟ | a connected network of nodes breaks apart into scattered dots |
| 2 | light | سقسي روحك هاذ السؤال: عندك نظام تسويقي واضح… | question card with two answer options |
| 3 | tint | كيفاش تعرف الجواب: + the 3 steps | 12-month timeline: months appear, actions are counted, links drawn, isolated actions flagged |
| 4 | dark | لأن كاين غير نوعين من التسويق: | big outlined "2", the two kinds as pills |
| 5 | light | الأول: تسويق رد الفعل… | spike-and-drop chart: a campaign each time customers drop |
| 6 | tint | الثاني: تسويق نظام… | system loop (content → ads → follow-up → sales) feeding growth |
| 7 | dark | النوع الثاني هو لي يعطي نتيجة تدوم… | lasting vs temporary result curves |
| 8 | light | كثير بيزنسات تحس أنها تخدم بجهد… | full effort bar vs an unstable result line |
| 9 | tint | السبب غالبا بسيط… | three campaigns each restarting from 0, broken links between them |
| 10 | dark | نتا، آخر اثنا عشر شهر… | the closing question, "linked" vs "each one alone" |
| 11 | dark | — | end card: logo, «نبنيو أنظمة، ماشي حملات معزولة.», CTA «شاركنا جوابك في التعليقات», contact |

Charts read right-to-left (time runs right → left), matching the Arabic reading direction.

## Voice-over

The current voice-over is the client-supplied recording `audio/recording/voiceover.wav`, imported
with `tools/import_recording.py` (each of the 14 lines verified with Whisper). An earlier offline
Piper TTS version can be regenerated with `tools/synth.py` (diacritised darja in `tools/vo_script.py`).

**For a natural, human voice-over** (recommended): record `RECORDING_SCRIPT.md` on a phone
(14 lines, 2-second pause between lines, retakes are fine), then

```bash
RECORDING=voice.m4a ASR_MODEL=/path/to/sherpa-onnx-whisper-turbo ./build.sh
```

`tools/import_recording.py` cleans the audio, matches each spoken chunk to its script line with
Whisper (false starts are dropped), detects the phrase pauses, and the whole animation re-times
itself to the speaker's natural pace. Any other voice file (a voice actor, ElevenLabs export…)
works the same way.

## Rebuild

```bash
./build.sh                                   # uses the committed voice-over
TTS_MODEL=/path/to/vits-piper-ar_JO-kareem-medium ./build.sh   # re-synthesise the voice too
```

Pipeline: `tools/synth.py` (voice) → `tools/build_timeline.py` (scene timing from the voice) →
`tools/mix_audio.py` (original synthesized music bed, whooshes, ducking, loudness) →
`tools/render.mjs` (headless Chromium renders `src/index.html` frame by frame) → ffmpeg.

Edit text in `src/index.html`, motion in `src/motion.js`, styling/tokens in `src/styles.css`.
Preview any moment: `node tools/render.mjs stills /tmp/stills 12.5 40`.
