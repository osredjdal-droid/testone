"""Build the soundtrack: the ElevenLabs voice-over placed on the timeline, an original
synthesized music bed (no samples, no licensing), transition whooshes and UI hits
(audio/cues.json, dumped from the page by `node tools/render.mjs cues`), then mix.

  python tools/mix_audio.py   -> audio/vo_track.wav, music.wav, sfx.wav, mix.wav (-14 LUFS)
Requires numpy, scipy, soundfile and ffmpeg on PATH.
"""
import json, os, subprocess
import numpy as np
import soundfile as sf
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
TL = json.load(open(os.path.join(ROOT, "audio/timeline.json")))
DUR = TL["duration"]
N = int(DUR * SR) + SR // 2
rng = np.random.default_rng(7)


def at(t):
    return int(round(t * SR))


def add(buf, x, t):
    i = at(t)
    if i < 0:
        x, i = x[-i:], 0
    if i >= len(buf):
        return
    x = x[: len(buf) - i]
    buf[i: i + len(x)] += x


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env_adsr(n, a, r):
    e = np.ones(n)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    e[:na] = np.linspace(0, 1, na) ** 2
    e[n - nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e


def scene(id_):
    return next(s for s in TL["scenes"] if s["id"] == id_)


# ---------------------------------------------------------------- voice-over
def build_vo():
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(ROOT, TL["vo"]), "-ac", "1", "-ar", str(SR),
                          "-f", "f32le", "-"], capture_output=True, check=True).stdout
    src = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    vo = np.zeros(N)
    fade = int(0.008 * SR)
    for c in TL["clips"]:
        x = src[at(c["src"]): at(c["src"] + c["len"])].copy()
        if len(x) > 2 * fade:
            x[:fade] *= np.linspace(0, 1, fade)
            x[-fade:] *= np.linspace(1, 0, fade)
        add(vo, x, c["dst"])
    return vo


# ---------------------------------------------------------------- music bed
BPM = 96
BEAT = 60 / BPM
BAR = 4 * BEAT
# i – VI – III – VII in D minor (Dm, Bb, F, C): thoughtful, then lifts
CHORDS = [[50, 53, 57, 62], [46, 50, 53, 58], [41, 45, 48, 53], [48, 52, 55, 60]]
ROOTS = [38, 34, 41, 36]


def pad_voice(freq, n):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for det in (-0.06, 0.0, 0.07):           # three slightly detuned voices
        f = freq * (1 + det / 100 * 12)
        for h, amp in ((1, 1.0), (2, 0.35), (3, 0.18), (4, 0.08), (5, 0.05)):
            out += amp * np.sin(2 * np.pi * f * h * t + rng.uniform(0, 2 * np.pi))
    return out / 5


def build_music():
    pad = np.zeros(N); bass = np.zeros(N); arp = np.zeros(N); kick = np.zeros(N); hat = np.zeros(N)
    s2, quiet, after, end = (scene(k) for k in ("s2", "s7", "s8", "s13"))
    nbars = int(np.ceil(DUR / BAR)) + 1
    for b in range(nbars):
        t0 = b * BAR
        ch, root = CHORDS[b % 4], ROOTS[b % 4]
        if t0 >= end["start"] - 0.2:
            ch, root = CHORDS[2], ROOTS[2]       # resolve on F major for the end card
        in_drop = quiet["start"] - 0.3 <= t0 < after["start"] - 0.2   # «نسكتو خير؟»: the beat holds its breath
        n = int((BAR + 1.2) * SR)
        e = env_adsr(n, 0.7, 1.4)
        for m in ch:
            add(pad, pad_voice(mtof(m), n) * e * (0.10 if in_drop else 0.16), t0)
        if t0 >= s2["start"] - 0.1 and not in_drop:
            nb = int(BAR * SR)
            tb = np.arange(nb) / SR
            add(bass, np.sin(2 * np.pi * mtof(root) * tb) * env_adsr(nb, 0.05, 0.6) * 0.22, t0)
            for k in (0, 2):                     # soft kick on beats 1 and 3
                nk = int(0.35 * SR); tk = np.arange(nk) / SR
                f = 52 + 38 * np.exp(-tk / 0.03)
                add(kick, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tk / 0.12) * 0.35, t0 + k * BEAT)
            for k in range(8):                   # very quiet off-beat hats
                if k % 2 == 1:
                    nh = int(0.05 * SR)
                    h = rng.standard_normal(nh) * np.exp(-np.arange(nh) / SR / 0.012)
                    add(hat, h * 0.035, t0 + k * BEAT / 2)
        if not in_drop:                          # gentle 8th-note arpeggio
            tones = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 12, ch[1] + 12, ch[2] + 12, ch[3] + 12]
            for k, m in enumerate(tones):
                na = int(0.6 * SR); ta = np.arange(na) / SR
                f = mtof(m)
                x = (np.sin(2 * np.pi * f * ta) + 0.25 * np.sin(4 * np.pi * f * ta)) * np.exp(-ta / 0.22)
                x *= np.minimum(1, ta / 0.004)
                add(arp, x * 0.06, t0 + k * BEAT / 2)
    pad = signal.sosfilt(signal.butter(2, 2600, "low", fs=SR, output="sos"), pad)
    arp = signal.sosfilt(signal.butter(2, 5000, "low", fs=SR, output="sos"), arp)
    hat = signal.sosfilt(signal.butter(2, 7000, "high", fs=SR, output="sos"), hat)
    mus = pad + bass + arp + kick + hat
    t = np.arange(N) / SR
    mus *= np.clip(t / 1.2, 0, 1)
    mus *= np.clip((DUR - t) / 2.2, 0, 1)
    return mus


# ---------------------------------------------------------------- sound design
def whoosh(dur, peak_hz, gain):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    out = np.zeros(n)
    blk, zi = 256, None
    for i in range(0, n, blk):                   # band-pass with a sweeping centre frequency
        fc = 250 + (peak_hz - 250) * np.sin(np.pi * i / n) ** 1.5
        sos = signal.butter(2, [fc * 0.6, min(fc * 1.6, SR / 2 - 100)], "band", fs=SR, output="sos")
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        seg, zi = signal.sosfilt(sos, x[i: i + blk], zi=zi)
        out[i: i + blk] = seg
    return out * np.sin(np.pi * np.linspace(0, 1, n)) ** 2 * gain


def tone(freqs, dur, decay, gain, attack=0.003):
    n = int(dur * SR); t = np.arange(n) / SR
    out = sum(a * np.sin(2 * np.pi * f * t) for f, a in freqs)
    return out * np.exp(-t / decay) * np.minimum(1, t / attack) * gain


def sweep(f0, f1, dur, decay, gain):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f0 * (f1 / f0) ** (t / dur)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay) * np.minimum(1, t / 0.004) * gain


def noise_burst(dur, lo, hi, decay, gain):
    n = int(dur * SR)
    x = signal.sosfilt(signal.butter(2, [lo, hi], "band", fs=SR, output="sos"), rng.standard_normal(n))
    return x * np.exp(-np.arange(n) / SR / decay) * gain


def layer(*xs):
    """Sum sounds of different lengths."""
    out = np.zeros(max(len(x) for x in xs))
    for x in xs:
        out[:len(x)] += x
    return out


def hit(kind):
    if kind == "pop":
        return layer(sweep(820, 1500, 0.12, 0.045, 0.20), noise_burst(0.02, 2000, 6000, 0.003, 0.05))
    if kind == "pop2":
        a = tone([(mtof(84), 1), (mtof(96), 0.2)], 0.25, 0.07, 0.13)
        b = tone([(mtof(91), 1), (mtof(103), 0.2)], 0.35, 0.09, 0.13)
        out = np.zeros(len(b) + int(0.07 * SR)); out[:len(a)] += a; out[int(0.07 * SR):] += b
        return out
    if kind == "key":                         # soft keyboard tap
        return layer(noise_burst(0.03, 1800, 5000, 0.006, 0.09), tone([(180, 1)], 0.04, 0.01, 0.05))
    if kind == "tick":
        return tone([(2600, 1), (5200, 0.3)], 0.05, 0.012, 0.10)
    if kind == "rise":
        n = int(0.5 * SR); e = np.sin(np.pi * np.linspace(0, 1, n) / 2) ** 2 * np.linspace(1, 0, n) ** 0.3
        return layer(sweep(320, 980, 0.5, 10, 0.05) * e, whoosh(0.5, 2600, 0.05))
    if kind == "drop":
        return sweep(760, 220, 0.42, 0.18, 0.13)
    if kind == "cash":
        a = tone([(mtof(88), 1), (mtof(100), 0.35), (mtof(107), 0.12)], 0.6, 0.16, 0.12)
        b = tone([(mtof(95), 1), (mtof(107), 0.3)], 0.8, 0.22, 0.12)
        out = np.zeros(len(b) + int(0.08 * SR)); out[:len(a)] += a; out[int(0.08 * SR):] += b
        return out
    if kind == "sparkle":
        out = np.zeros(int(0.8 * SR))
        for i, m in enumerate((96, 100, 103, 108)):
            x = tone([(mtof(m), 1), (mtof(m) * 2.01, 0.2)], 0.5, 0.12, 0.06)
            out[int(i * 0.055 * SR): int(i * 0.055 * SR) + len(x)] += x[: len(out) - int(i * 0.055 * SR)]
        return out
    if kind == "stamp":
        return layer(sweep(140, 60, 0.3, 0.09, 0.45), noise_burst(0.12, 200, 1800, 0.03, 0.25))
    if kind == "thud":
        return layer(sweep(95, 38, 0.8, 0.28, 0.6), noise_burst(0.25, 80, 900, 0.06, 0.25))
    if kind == "click":
        x = noise_burst(0.012, 2500, 7000, 0.0015, 0.18)
        out = np.zeros(int(0.09 * SR)); out[:len(x)] += x; out[int(0.06 * SR): int(0.06 * SR) + len(x)] += x * 0.6
        return out
    if kind == "scratch":
        return layer(whoosh(0.28, 4200, 0.05), noise_burst(0.28, 2500, 6000, 0.12, 0.03))
    if kind == "chime":
        n = int(2.8 * SR); t = np.arange(n) / SR
        out = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, a, d in
                  ((mtof(77), 1.0, 1.4), (mtof(77) * 2.0, 0.35, 0.8), (mtof(81), 0.6, 1.2), (mtof(84), 0.4, 1.0)))
        return out * np.minimum(1, t / 0.005) * 0.11
    raise ValueError(kind)


def build_sfx():
    sfx = np.zeros(N)
    for s in TL["scenes"]:
        if s["trans"] == "wipe":
            add(sfx, whoosh(1.1, 3800, 0.22), s["start"] - 0.62)
        elif s["trans"] == "fade":
            add(sfx, whoosh(0.7, 2200, 0.08), s["start"] - 0.38)
    cues = json.load(open(os.path.join(ROOT, "audio/cues.json")))
    for c in cues:
        add(sfx, hit(c["kind"]) * c.get("gain", 1), c["t"])
    return sfx


def main():
    paths = {}
    for name, fn in (("vo_track", build_vo), ("music", build_music), ("sfx", build_sfx)):
        x = fn()
        peak = np.max(np.abs(x)) or 1
        if peak > 0.98:
            x = x / peak * 0.98
        p = os.path.join(ROOT, f"audio/{name}.wav")
        sf.write(p, x.astype(np.float32), SR, subtype="FLOAT")
        paths[name] = p
        print(f"{name}: peak {peak:.3f}")
    mix = os.path.join(ROOT, "audio/mix.wav")
    fc = (
        # ElevenLabs voice is clean and full-band: gentle low cut, a touch of presence, steady level
        "[0:a]highpass=f=70,equalizer=f=250:t=q:w=1:g=-1,equalizer=f=3500:t=q:w=1.2:g=1.5,deesser=i=0.3,"
        "acompressor=threshold=-20dB:ratio=2.5:attack=10:release=150:makeup=2,loudnorm=I=-16:TP=-2:LRA=7,asplit=2[vo][sc];"
        # music bed sits well under the voice and ducks further while it speaks
        "[1:a]volume=0.55,loudnorm=I=-28:TP=-6[mus];"
        "[mus][sc]sidechaincompress=threshold=0.03:ratio=5:attack=40:release=450[duck];"
        "[2:a]volume=0.6[fx];"
        "[vo][duck][fx]amix=inputs=3:normalize=0,pan=stereo|c0=c0|c1=c0[out]"
    )
    pre = os.path.join(ROOT, "audio/.premix.wav")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", paths["vo_track"], "-i", paths["music"], "-i", paths["sfx"],
                    "-filter_complex", fc, "-map", "[out]", "-c:a", "pcm_f32le", pre], check=True)
    # measure, then gain to -14 LUFS (social platforms) with a peak limiter
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", pre, "-af", "loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    m = json.loads(r.stderr[r.stderr.rindex("{"): r.stderr.rindex("}") + 1])
    print("premix:", {k: m[k] for k in ("input_i", "input_tp", "target_offset")})
    gain = -14.0 - float(m["input_i"])
    ln = f"volume={gain:.2f}dB,alimiter=limit=0.79:attack=3:release=80:level=false,aresample=48000"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", pre, "-af", ln, "-c:a", "pcm_s16le", mix], check=True)
    os.remove(pre)
    print("wrote", mix)


if __name__ == "__main__":
    main()
