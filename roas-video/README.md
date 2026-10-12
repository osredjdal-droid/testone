# Shohraty — «نسبة العائد ولا الربح؟»

Motion-graphics explainer with an **ElevenLabs** voice-over in Algerian darija, built on the
**Shohraty Design System**: purple `#653DC7`, yellow `#FFB400` (CTAs and dark-background highlights only),
pink only for alerts, Roboto + Noto Kufi Arabic, the C-arc logo motif, the dark → light → tint section rhythm,
split headings with one highlighted keyword, rounded corners everywhere and no emoji.

| | |
|---|---|
| **Video** | `out/shohraty-roas-vs-profit-9x16.mp4`: 1080×1920, 30 fps, H.264 + AAC, about 1:41 |
| **Soundtrack** | `out/soundtrack.mp3`: voice, music and sound design, mixed to −14 LUFS |
| **Cover** | `out/cover.png`: the hook frame without captions (Reels/TikTok cover) |
| **Format** | 9:16 vertical (Instagram Reels, TikTok, YouTube Shorts, Facebook) |

## Voice-over (ElevenLabs)

- **Voice:** *Amin – Algerian Darija* (`wZ6E1XvJnMjmRvpvp2vY`) · **model:** `eleven_v4` · script sent verbatim.
- **Takes:** four takes were generated. Take 1 is used (`audio/takes/take1.mp3`) because its word starts line up
  with the sentence pauses to within about 0.05 s. Takes 2–4 are kept next to it, and all four are also in the
  ElevenLabs flow *“Shohraty — ROAS 3x vs 6x explainer VO”*.
- **Timing:** ElevenLabs Scribe word timings for each take (`audio/takes/takeN.words.json`).
  `tools/build_timeline.py` checks them word by word against the script and cuts the voice into one clip per
  sentence, inside the natural pauses. It adds a little air at scene changes, so each number, bar and caption
  lands on the word that names it.

Switch takes without spending more credits: `TAKE=3 ./build.sh`.

## Storyboard

| # | Background | Voice-over | Visual |
|---|---|---|---|
| 1 | dark | واش رايك لوكان نقولك أنو نسبة العائد بثلاثة أضعاف يقدر يكون أحسن… | huge **3×** (yellow) “أحسن من” **6×**, question badge |
| 2 | light | خليني نشرحلك بمثال… أحسن حملة إعلانية عندك. | campaign card: spent 1 000 $ / returned 6 000 $ bars count up, 1 coin → 6 coins, **6×** ratio card, “أحسن حملة” stamp |
| 3 | tint | بعدها كبّرت الميزانية… باش "تصلح" الوضع. | budget slider 1k → 4k, 4 000 $ / 12 000 $ bars, ratio drops 6× → 3×, warning chip, cursor drags the budget back down |
| 4 | dark | هنا الغلطة. | pink alert mark with a shake, the music drops out |
| 5 | light | شوف الربح الحقيقي… جابتلك ثلاثة آلاف زيادة. | profit columns 6 000 − 1 000 = **5 000 $** vs 12 000 − 4 000 = **8 000 $**, bracket **+3 000 $** |
| 6 | dark | نسبة العائد رقم نسبي. الربح رقم حقيقي… | two definition cards: revenue ÷ budget (relative) vs revenue − budget = net gain (real) |
| 7 | tint | النسبة تقدر تنزل، والربح يكبر في نفس الوقت. | crossing lines as budget grows: ratio 6× → 3× (dashed), profit 5 000 $ → 8 000 $ |
| 8 | light | لأن كي تكبر الميزانية… الجودة تنقص، بصح الكمية تزيد. | audience rings widen from a warm core to colder rings where fewer people convert, then quality ↓ / quantity ↑ meters |
| 9 | tint | غالبية البيزنسات تبقى صغيرة… كانت راح تكبر فيها. | “weak ratio” struck out; growth curve paused right at take-off, dashed “كانت راح تكبر” curve |
| 10 | dark | ماتحوسش غير إذا النسبة العائدة نقصة. حوس إذا الربح زاد. | the rule: ✗ ratio dropped (struck out) vs ✓ **profit grew** with rising bars |
| 11 | light | دوك قولي… حبست حملة إعلانية لأن النسبة العائدة بانتلك نقصت؟ | comment-style question card, إيه / لا, yellow CTA “جاوبنا في التعليقات” |
| 12 | dark | (end card) | logo, «نبنيو أنظمة تكبّر الربح.», CTA “احجز مكالمتك الاستراتيجية”, WhatsApp, site, handle |

Charts read right-to-left (time and budget grow right → left), matching the Arabic reading direction.
Karaoke captions (the design system's `CaptionPlate`) run under every scene and sit inside the Reels/TikTok
safe area. The illustrative numbers (1 000 → 6 000 $, 4 000 → 12 000 $) come from the script. The in-between
points on the scene-7 curve follow a simple diminishing-returns model that matches both of them.

## Rebuild

```bash
./build.sh              # committed take (take 1)
TAKE=3 ./build.sh       # another ElevenLabs take; everything re-times itself
```

Pipeline: `tools/build_timeline.py` (clips, scenes and captions from the word timings) →
`node tools/render.mjs cues` (sound-design hit points read from the page) → `tools/mix_audio.py`
(voice, original synthesized music bed with ducking, whooshes and UI hits, −14 LUFS) →
`tools/render.mjs video` (headless Chromium renders `src/index.html` frame by frame) → ffmpeg.

Edit text in `src/index.html`, motion in `src/motion.js`, styling and tokens in `src/styles.css`, and the
script or scene grouping in `tools/script.py`. Preview any moment with
`node tools/render.mjs stills /tmp/stills 12.5 40`.
Needs python3 with numpy, scipy and soundfile, node with Playwright (Chromium), and ffmpeg.
