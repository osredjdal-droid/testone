# Shohraty — «قلنالو الحقيقة»

A motion-graphics brand story with an **ElevenLabs** voice-over in Algerian darija, built on the
**Shohraty Design System**:

- **Colours:** purple `#653DC7`, with yellow only for CTAs and highlights on dark backgrounds; pink only for alerts.
- **Type:** Roboto with Noto Kufi Arabic.
- **Brand elements:** the C-arc logo motif and the faceless "Signature portrait" style.
- **Layout:** the dark → light → tint section rhythm, split headings with one highlighted keyword, and karaoke captions.
- **Rules:** no emoji; every corner rounded.

| | |
|---|---|
| **Video** | `out/shohraty-qolnalou-el-haqiqa-9x16.mp4`: 1080×1920, 30 fps, H.264 + AAC, about 1:36 |
| **Soundtrack** | `out/soundtrack.mp3`: voice, music and sound design, mixed to −14 LUFS |
| **Cover** | `out/cover.png`: the client-brief frame without captions |
| **Format** | 9:16 vertical (Instagram Reels, TikTok, YouTube Shorts, Facebook) |

## Voice-over: Achraf (Algerian darija), picked by ear

- **Voice and model:** *Achraf* (`NVRXBDmA6I8ZAldiUWuB`), an Algerian darija voice, on ElevenLabs `eleven_multilingual_v2`.
- **How it was picked:** the client listened to samples of four Algerian voices reading the same lines of this script and chose this one.
- **Full script:** 4 takes; take 1 is used. Takes 2–4 are in `audio/takes/`; switch with `TAKE=2 ./build.sh`.
- **Why take 1:** the most natural phrasing. It has one breath inside a phrase («في السوق | ما يعبّرش»), it reads «ماشي حاب» in one go, and the timings match the script word for word.

### Voices tried before

- **Amin on `eleven_v4` (the first video):** mispronounced words. In blind transcriptions (Scribe given the audio only, not the script), غالط came out as "غالب" / "غاط" and ولينا as "ويلينا".
- **Abu Muneeb on `multilingual_v2`:** pronounced the words correctly but did not sound Algerian enough, so the client rejected it.

ElevenLabs only lists four Algerian darija voices: Amin, Abu Muneeb, Achraf and Ben Chamsou.

### Spelling changes for the voice

A few spellings differ from the brief so the voice reads them correctly. The meaning is unchanged:

- «ما شي» → «ماشي»
- «حقيقة ل البيزنس» → «حقيقية للبيزنس»
- «تقولوا انوا» → «تقولو أنو»
- «نقولوا نسكتوا» → «نقولو نسكتو»
- «تسمعوا» → «تسمعو»
- «الي» → «اللي»
- «تدي» → «تدّي»

### One phrasing fix (kept as a safeguard)

Earlier takes paused after «ماشي» in «كلام ماشي حاب تسمعو», which sounds like «كلام ماشي. حاب تسمعو». The edit can trim that pause (silence only) so the phrase reads in one breath; see `TIGHTEN` in `tools/script.py`. The current take reads it in one breath, so almost nothing is trimmed.

All takes and the voice tests are in the ElevenLabs flow *«Shohraty — "قلنالو الحقيقة" VO casting + final»*.

## Storyboard

| # | Background | Voice-over | Visual |
|---|---|---|---|
| 1 | dark | عميل جانا، حكالنا على البيزنس تاعو… طلب منا خطة تسويق. | client file (Signature portrait) with offer / audience / positioning rows, then a yellow "plan request" bubble |
| 2 | light | كنا نقدرو نديرو حاجة وحدة بسيطة… لو الخطة نجحت، مليح. | three-step conveyor: take the info as it is → build the plan → leave; a green "مليح" card |
| 3 | tint | لو ما نجحتش، السبب جاهز من قبل: «…» «…» | two pre-written excuse notes slide out of an "الأعذار" drawer, with «نتا» flagged |
| 4 | dark | هذا الطريق الساهلة… ونحنا نبقاو محميين. | a smooth road with "no problem / no hard talk" signs; client comfortable, agency covered |
| 5 | light | بصح خترنا طريق آخر. قلنالو الحقيقة كيما هي. | a fork: the easy road greys out, the steeper purple road climbs to a flag; "the truth" card |
| 6 | tint | الجمهور صغير. العرض ماشي واضح. تمركزك… | the diagnosis: the brief's three rows drop and turn warning-orange / alert-pink |
| 7 | dark | علابالنا بلي أي عميل مايحبش… نقولو نسكتو خير. | «راك غالط.» typed, then deleted; a «نسكتو خير؟» bubble and hesitation dots (the music drops out) |
| 8 | light | بصح لو سكتنا… حتى لو هو ما يحسش بيها في وقتاها. | time chart: fine "in the moment", then a damage curve with cracks |
| 9 | tint | فضّلنا نقولوها من الأول… | a balance scale: "our comfort" rises, "his business" weighs down |
| 10 | dark | قعدنا معاه، صحّحنا الصورة… النتيجة طلعت بعيد على اللي كان متوقع. | three yellow checks, then the result curve far above the dashed "expected" line |
| 11 | light | هذا الفرق بين وكالة… | two agencies: "to take money" (muted) vs "to protect your business" (purple) |
| 12 | tint | حاب رأي صريح… ماشي مجاملة؟ تواصل معانا. | ✓ honest opinion / ✗ flattery (struck out), yellow "تواصل معانا" CTA tapped by a cursor |
| 13 | dark | (end card) | logo, «نقولولك الحقيقة، باش نحميو البيزنس تاعك.», CTA, WhatsApp, site, handle |

Charts read right-to-left (time runs right → left), matching the Arabic reading direction.

## Rebuild

```bash
./build.sh              # take 1 (Achraf)
TAKE=2 ./build.sh       # another take; timeline, captions, animation and sound all re-time themselves
```

### Pipeline

1. `tools/build_timeline.py` checks the word timings against the script, keeps each scene's voice uncut, trims the listed hesitations and builds the scenes and captions.
2. `node tools/render.mjs cues` reads the sound-design hit points from the page.
3. `tools/mix_audio.py` mixes the voice with an original synthesized music bed (with ducking), whooshes and UI hits, at −14 LUFS.
4. `tools/render.mjs video` renders `src/index.html` frame by frame in headless Chromium.
5. ffmpeg encodes the final MP4.

### Where to edit

| What | File |
|---|---|
| On-screen text | `src/index.html` |
| Motion | `src/motion.js` |
| Styling | `src/styles.css` |
| Script, scenes, trims | `tools/script.py` |

Preview any moment with `node tools/render.mjs stills /tmp/stills 12.5 40`.
