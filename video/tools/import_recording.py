"""Import a human voice-over recording and cut it into the 14 lines the animation uses.

  python tools/import_recording.py <recording> [--asr /path/to/sherpa-onnx-whisper-turbo]

The speaker reads RECORDING_SCRIPT.md in order, pausing ~2 s between lines (retakes allowed:
the best-matching, latest take of each line is kept). This script:
  1. decodes + cleans the audio (high-pass, gentle noise reduction) with ffmpeg,
  2. finds the spoken chunks from the energy envelope,
  3. transcribes every chunk with Whisper and aligns chunks to the 14 script lines
     (dynamic programming over text similarity; without --asr it falls back to the 13 longest pauses),
  4. tightens over-long pauses, finds phrase boundaries inside each line,
  5. writes audio/vo/segNN.wav + audio/vo/timing.json (source: "recording").
Then run ./build.sh (or build_timeline.py, mix_audio.py, render.mjs) to re-time the video.
"""
import argparse, difflib, json, os, re, subprocess, sys
import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from vo_script import SEGMENTS  # noqa: E402  (phrase structure per line)

SR = 48000
HOP = 0.01  # envelope resolution (s)
MAX_PAUSE = 0.65  # longer pauses inside a line are shortened to this


def plain(t):
    t = re.sub(r"[ً-ْٰـ]", "", t)          # diacritics, tatweel
    t = re.sub(r"[إأآا]", "ا", t).replace("ة", "ه").replace("ى", "ي")
    return re.sub(r"[^ء-ي0-9]", "", t)


LINES = [" ".join(seg) for seg in SEGMENTS]
LINES_PLAIN = [plain(l) for l in LINES]


def decode(path):
    out = os.path.join(ROOT, "audio/vo/.recording_clean.wav")
    os.makedirs(os.path.dirname(out), exist_ok=True)

    def run(af):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-af", af,
                        "-c:a", "pcm_f32le", out], check=True)
        y, _ = sf.read(out, dtype="float64")
        os.remove(out)
        return y

    x = run("highpass=f=70")
    floor = np.percentile(envelope_db(x), 10)
    if floor > -60:   # audible room noise: reduce it gently; clean (studio / generated) audio is left alone
        x = run("highpass=f=70,afftdn=nr=10:nf=-45:tn=1")
        print(f"noise floor {floor:.0f} dB -> noise reduction applied")
    return x / (np.max(np.abs(x)) or 1) * 0.9


def envelope_db(x):
    n = int(HOP * SR)
    frames = len(x) // n
    rms = np.sqrt(np.mean(x[: frames * n].reshape(frames, n) ** 2, axis=1) + 1e-12)
    return 20 * np.log10(rms)


def voiced_runs(db, thr, min_gap):
    v = db > thr
    runs, i = [], 0
    while i < len(v):
        if v[i]:
            j = i
            while j < len(v) and v[j]:
                j += 1
            runs.append([i, j])
            i = j
        else:
            i += 1
    merged = []
    for r in runs:
        if merged and (r[0] - merged[-1][1]) * HOP < min_gap:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    return [(a * HOP, b * HOP) for a, b in merged if (b - a) * HOP >= 0.12]


def threshold(db):
    floor = np.percentile(db, 10)
    peak = np.percentile(db, 99)
    return max(floor + 12, peak - 38)


def transcribe(x, chunks, asr_dir):
    import sherpa_onnx
    rec = sherpa_onnx.OfflineRecognizer.from_whisper(
        encoder=f"{asr_dir}/turbo-encoder.int8.onnx", decoder=f"{asr_dir}/turbo-decoder.int8.onnx",
        tokens=f"{asr_dir}/turbo-tokens.txt", language="ar", task="transcribe", num_threads=4)
    texts = []
    for a, b in chunks:
        pad = np.zeros(int(0.4 * SR), np.float32)   # Whisper drops the last word of unpadded clips
        seg = np.concatenate([pad, x[int(max(0, a - 0.05) * SR): int((b + 0.15) * SR)].astype(np.float32), pad])
        s = rec.create_stream()
        s.accept_waveform(SR, seg)
        rec.decode_stream(s)
        texts.append(s.result.text.strip())
    return texts, rec


def align(chunk_texts, n_lines, max_span=8, skip_cost=0.08):
    """Map consecutive chunk groups to script lines; unmatched chunks (false starts) are skipped."""
    M = len(chunk_texts)
    P = [plain(t) for t in chunk_texts]
    sim = {}
    for a in range(M):
        acc = ""
        for b in range(a, min(M, a + max_span)):
            acc += P[b]
            for j in range(n_lines):
                r = difflib.SequenceMatcher(None, acc, LINES_PLAIN[j], autojunk=False).ratio()
                sim[(a, b, j)] = r + 0.002 * a   # tie-break toward later takes
    NEG = -1e9
    best = np.full((n_lines + 1, M + 1), NEG)
    back = {}
    best[0][0] = 0
    for i in range(1, M + 1):
        best[0][i] = -skip_cost * i
        back[(0, i)] = None
    for j in range(n_lines):
        for i in range(M + 1):
            if best[j][i] <= NEG / 2:
                continue
            for a in range(i, M):
                base = best[j][i] - skip_cost * (a - i)
                for b in range(a, min(M, a + max_span)):
                    v = base + sim[(a, b, j)]
                    if v > best[j + 1][b + 1]:
                        best[j + 1][b + 1] = v
                        back[(j + 1, b + 1)] = (i, a, b)
    end = max(range(M + 1), key=lambda i: best[n_lines][i] - skip_cost * (M - i))
    groups, j, i = [], n_lines, end
    while j > 0:
        pi, a, b = back[(j, i)]
        groups.append((a, b, sim[(a, b, j - 1)] - 0.002 * a))
        j, i = j - 1, pi
    return groups[::-1]


def align_by_pauses(chunks, n_lines):
    gaps = sorted(range(len(chunks) - 1), key=lambda k: chunks[k + 1][0] - chunks[k][1], reverse=True)[: n_lines - 1]
    cuts = sorted(gaps)
    groups, a = [], 0
    for c in cuts + [len(chunks) - 1]:
        groups.append((a, c, None))
        a = c + 1
    return groups


def build_line(x, chunks, a, b, n_phrases, text, thr):
    """Concatenate chunks a..b with pauses capped; return audio + phrase timings."""
    pieces, t, spans = [], 0.0, []
    for k in range(a, b + 1):
        s, e = chunks[k]
        s = max(0, s - 0.06)
        e = min(len(x) / SR, e + 0.18)
        if k > a:
            gap = min(MAX_PAUSE, chunks[k][0] - chunks[k - 1][1])
            pieces.append(np.zeros(int(gap * SR)))
            t += gap
        seg = x[int(s * SR): int(e * SR)].copy()
        fi, fo = int(0.01 * SR), int(0.04 * SR)
        seg[:fi] *= np.linspace(0, 1, fi)
        seg[-fo:] *= np.linspace(1, 0, fo)
        pieces.append(seg)
        spans.append((t, t + len(seg) / SR))
        t += len(seg) / SR
    y = np.concatenate(pieces)
    dur = len(y) / SR
    # phrase boundaries: pick internal pauses closest to the script's phrase proportions
    db = envelope_db(y)
    runs = voiced_runs(db, thr, 0.12)     # same threshold as the whole recording
    pauses = [((runs[k][1] + runs[k + 1][0]) / 2, runs[k + 1][0] - runs[k][1]) for k in range(len(runs) - 1)]
    lens = [len(plain(p)) or 1 for p in text]
    total = sum(lens)
    targets, acc = [], 0
    for L in lens[:-1]:
        acc += L
        targets.append(acc / total * dur)
    bounds, used = [], set()
    for tg in targets:
        cands = [(abs(m - tg) - 0.4 * g, m) for m, g in pauses if m not in used and (not bounds or m > bounds[-1])]
        if cands and min(cands)[0] < dur * 0.18:
            m = min(cands)[1]
        else:
            m = max(tg, bounds[-1] + 0.2 if bounds else 0)
        used.add(m)
        bounds.append(m)
    starts = [min(runs[0][0], 0.06) if runs else 0.0] + bounds   # first word starts where the chunk does
    ends = bounds + [runs[-1][1] if runs else dur]
    phrases = [{"start": round(s, 3), "end": round(e, 3)} for s, e in zip(starts, ends)]
    return y, phrases


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("recording")
    ap.add_argument("--asr", default=os.environ.get("ASR_MODEL"))
    ap.add_argument("--out", default=os.path.join(ROOT, "audio/vo"))
    args = ap.parse_args()

    x = decode(args.recording)
    db = envelope_db(x)
    thr = threshold(db)
    chunks = voiced_runs(db, thr, 0.25)
    print(f"{len(x) / SR:.1f}s recording, {len(chunks)} spoken chunks")
    n = len(SEGMENTS)
    if args.asr:
        texts, rec = transcribe(x, chunks, args.asr)
        groups = align(texts, n)
    else:
        if len(chunks) < n:
            sys.exit(f"found only {len(chunks)} chunks for {n} lines — pause longer between lines or pass --asr")
        texts, rec, groups = None, None, align_by_pauses(chunks, n)

    out_dir = args.out
    os.makedirs(out_dir, exist_ok=True)
    meta = []
    for j, (a, b, score) in enumerate(groups):
        y, phrases = build_line(x, chunks, a, b, len(SEGMENTS[j]), SEGMENTS[j], thr)
        sf.write(os.path.join(out_dir, f"seg{j + 1:02d}.wav"), y.astype(np.float32), SR, subtype="PCM_16")
        meta.append({"seg": j + 1, "dur": round(len(y) / SR, 3), "phrases": phrases})
        heard = ""
        if rec is not None:   # verify the final cut of each line
            pad = np.zeros(int(0.4 * SR), np.float32)
            st = rec.create_stream()
            st.accept_waveform(SR, np.concatenate([pad, y.astype(np.float32), pad]))
            rec.decode_stream(st)
            heard = st.result.text.strip()
            score = difflib.SequenceMatcher(None, plain(heard), LINES_PLAIN[j], autojunk=False).ratio()
        flag = "" if score is None or score >= 0.6 else "   <-- check this line"
        print(f"{j + 1:2d} {len(y) / SR:5.2f}s match={'-' if score is None else f'{score:.2f}'} | {heard}{flag}")
    json.dump({"sr": SR, "source": "recording", "segments": meta}, open(os.path.join(out_dir, "timing.json"), "w"), indent=1)
    print("wrote audio/vo/seg01..14.wav and timing.json — now run ./build.sh")


if __name__ == "__main__":
    main()
