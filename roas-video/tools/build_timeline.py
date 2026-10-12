"""Build the video timeline from the ElevenLabs voice-over and its word timings.

  python tools/build_timeline.py

Reads audio/takes/take{TAKE}.mp3 + take{TAKE}.words.json (ElevenLabs Scribe word timings;
TAKE env var, default 1), checks the words against tools/script.py, cuts the voice-over into
one clip per sentence (inside the natural pauses), adds a little air at scene changes, and writes:
  src/timeline.js      -> window.TL for the composition (scenes, lines, words, captions)
  audio/timeline.json  -> the same data + the clip list for tools/mix_audio.py
Pick another take (TAKE=3) and everything re-times itself.
"""
import json, os, re, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from script import LINES, SCENES, LEAD_IN, SCENE_GAP, LAST_TAIL, END_CARD  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 30
TAKE = os.environ.get("TAKE", "1")
VO_REL = f"audio/takes/take{TAKE}.mp3"
VO = os.path.join(ROOT, VO_REL)
PUNCT = r"[\s\.\،,؟\?!…:\"«»“”]"


def norm(w):
    return re.sub(PUNCT, "", w)


def silences(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "silencedetect=noise=-40dB:d=0.12", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    s = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r)]
    e = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r)]
    h, m, sec = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r).groups()
    dur = 3600 * int(h) + 60 * int(m) + float(sec)
    if len(s) > len(e):
        e.append(dur)
    return list(zip(s, e)), dur


def chunk(words):
    """Split one sentence into caption pages of at most ~7 words, preferring commas/colons."""
    phrases, cur = [], []
    for i, w in enumerate(words):
        cur.append(i)
        if re.search(r"[،,:…]$", w["w"]):
            phrases.append(cur); cur = []
    if cur:
        phrases.append(cur)
    out = []
    for p in phrases:
        while len(p) > 8:
            half = (len(p) + 1) // 2
            out.append(p[:half]); p = p[half:]
        out.append(p)
    merged = []
    for p in out:
        if merged and len(merged[-1]) + len(p) <= 6:
            merged[-1] = merged[-1] + p
        else:
            merged.append(p)
    return merged


def main():
    data = json.load(open(os.path.join(ROOT, f"audio/takes/take{TAKE}.words.json")))
    words = data["words"]
    # ---- 1. assign the timed words to script lines (must match one for one)
    lines, k = [], 0
    for n, text in enumerate(LINES, 1):
        toks = text.split()
        ws = words[k:k + len(toks)]
        for tok, w in zip(toks, ws):
            if norm(tok) != norm(w["w"]):
                sys.exit(f"line {n}: script word {tok!r} != timed word {w['w']!r} — re-check words.json")
        lines.append({"n": n, "text": text, "words": [{"w": tok, "start": w["start"], "end": w["end"]} for tok, w in zip(toks, ws)]})
        k += len(toks)
    if k != len(words):
        sys.exit(f"{len(words) - k} timed words left over")

    # ---- 2. cut points inside the pauses between sentences
    sil, dur = silences(VO)
    cuts = [0.0]
    for ln in lines[1:]:
        st = ln["words"][0]["start"]
        cand = [s for s in sil if st - 0.3 <= s[1] <= st + 0.12 and s[1] - s[0] > 0.12]
        if cand:
            s0, s1 = min(cand, key=lambda s: abs(s[1] - st))
            cuts.append(min((s0 + s1) / 2, st - 0.06))
        else:
            cuts.append(st - 0.08)
    last_start = lines[-1]["words"][-1]["start"]
    tail = [s for s in sil if s[0] > last_start]
    cuts.append(min(dur, tail[0][0] + 0.25) if tail else dur)

    # ---- 3. place one clip per line; extra air at scene changes
    scene_of = {n: sid for sid, _, ns, _ in SCENES for n in ns}
    first_of = {ns[0]: sid for sid, _, ns, _ in SCENES if ns}
    t, clips = LEAD_IN, []
    for i, ln in enumerate(lines):
        n = ln["n"]
        if n in first_of and i > 0:
            t += SCENE_GAP.get(first_of[n], SCENE_GAP["default"])
        a, b = cuts[i], cuts[i + 1]
        clips.append({"src": round(a, 3), "len": round(b - a, 3), "dst": round(t, 3)})
        off = t - a
        nxt = [w["start"] for w in ln["words"][1:]] + [b - 0.05]
        for w, ns in zip(ln["words"], nxt):
            w["t0"] = round(w["start"] + off, 3)
            w["t1"] = round(min(w["end"], ns) + off, 3)
            del w["start"], w["end"]
        ln["start"], ln["end"] = ln["words"][0]["t0"], ln["words"][-1]["t1"]
        ln["scene"] = scene_of[n]
        t += b - a
    vo_end = t

    # ---- 4. scenes: each one opens just before its first word
    scenes = []
    for sid, kind, ns, trans in SCENES:
        if not ns:
            start = vo_end + LAST_TAIL - 0.5
        elif sid == SCENES[0][0]:
            start = 0.0
        else:
            start = lines[ns[0] - 1]["start"] - 0.42
        scenes.append({"id": sid, "kind": kind, "start": round(start, 3), "trans": trans, "lines": ns})
    for a, b in zip(scenes, scenes[1:]):
        a["end"] = b["start"]
    scenes[-1]["end"] = round(scenes[-1]["start"] + END_CARD, 3)
    duration = scenes[-1]["end"]

    # ---- 5. caption pages (karaoke, word by word)
    pages = []
    for ln in lines:
        for idx in chunk(ln["words"]):
            ws = [ln["words"][i] for i in idx]
            pages.append({"line": ln["n"], "start": round(ws[0]["t0"] - 0.12, 3), "words": ws})
    for a, b in zip(pages, pages[1:]):
        last = a["words"][-1]["t1"]
        a["end"] = b["start"] if b["start"] - last < 0.9 else round(last + 0.45, 3)
    pages[-1]["end"] = round(pages[-1]["words"][-1]["t1"] + 0.8, 3)

    tl = {"fps": FPS, "duration": duration, "frames": int(round(duration * FPS)), "scenes": scenes,
          "lines": lines, "captions": pages}
    with open(os.path.join(ROOT, "src/timeline.js"), "w") as f:
        f.write("// generated by tools/build_timeline.py — do not edit\n")
        f.write("window.TL = " + json.dumps(tl, ensure_ascii=False) + ";\n")
    json.dump({**tl, "vo": VO_REL, "clips": clips}, open(os.path.join(ROOT, "audio/timeline.json"), "w"), ensure_ascii=False, indent=1)
    print(f"take {TAKE}: duration {duration:.2f}s, {tl['frames']} frames, {len(pages)} caption pages")
    for s in scenes:
        print(f"  {s['id']:4s} {s['kind']:5s} {s['start']:6.2f} -> {s['end']:6.2f}  ({s['trans']})  lines {s['lines']}")


if __name__ == "__main__":
    main()
