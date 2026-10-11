"""Build the soundtrack: voice-over placed on the timeline, an original synthesized
music bed (no samples, no licensing), transition whooshes, then mix with ffmpeg.

  python tools/mix_audio.py            -> audio/vo_track.wav, audio/music.wav, audio/sfx.wav, audio/mix.wav
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


# ---------------------------------------------------------------- voice-over
def build_vo():
    vo = np.zeros(N)
    for s in TL["segs"]:
        x, sr = sf.read(os.path.join(ROOT, f"audio/vo/seg{s['seg']:02d}.wav"), dtype="float64")
        x = signal.resample_poly(x, 320, 147) if sr == 22050 else signal.resample_poly(x, SR, sr)
        add(vo, x, s["start"])
    return vo


# ---------------------------------------------------------------- music bed
BPM = 92
BEAT = 60 / BPM
BAR = 4 * BEAT
# i – VI – III – VII in D minor (Dm, Bb, F, C): reflective, then lifts
CHORDS = [[50, 53, 57, 62], [46, 50, 53, 58], [41, 45, 48, 53], [48, 52, 55, 60]]
ROOTS = [38, 34, 41, 36]


def scene(id_):
    return next(s for s in TL["scenes"] if s["id"] == id_)


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
    s2, s4, s5, s10, s11 = (scene(k) for k in ("s2", "s4", "s5", "s10", "s11"))
    nbars = int(np.ceil(DUR / BAR)) + 1
    for b in range(nbars):
        t0 = b * BAR
        ch = CHORDS[b % 4]
        if t0 >= s11["start"] - 0.2:
            ch, root = CHORDS[2], ROOTS[2]       # resolve on F major for the end card
        else:
            root = ROOTS[b % 4]
        n = int((BAR + 1.2) * SR)
        e = env_adsr(n, 0.7, 1.4)
        for m in ch:
            add(pad, pad_voice(mtof(m), n) * e * 0.16, t0)
        # sub bass on the root, from scene 2 on, resting during the two "statement" scenes
        in_drop = s4["start"] <= t0 < s5["start"] or s10["start"] <= t0 < s11["start"]
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
        # gentle 8th-note arpeggio
        tones = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 12, ch[1] + 12, ch[2] + 12, ch[3] + 12]
        for k, m in enumerate(tones):
            na = int(0.6 * SR); ta = np.arange(na) / SR
            f = mtof(m)
            x = (np.sin(2 * np.pi * f * ta) + 0.25 * np.sin(4 * np.pi * f * ta)) * np.exp(-ta / 0.22)
            x *= np.minimum(1, ta / 0.004)
            add(arp, x * 0.06, t0 + k * BEAT / 2)
    sos_lp = signal.butter(2, 2600, "low", fs=SR, output="sos")
    pad = signal.sosfilt(sos_lp, pad)
    arp = signal.sosfilt(signal.butter(2, 5000, "low", fs=SR, output="sos"), arp)
    hat = signal.sosfilt(signal.butter(2, 7000, "high", fs=SR, output="sos"), hat)
    mus = pad + bass + arp + kick + hat
    # simple stereo-ish width via short delay is skipped: the deliverable is mono-safe
    # fades: in over 1.5 s, out over the last 2.2 s
    t = np.arange(N) / SR
    mus *= np.clip(t / 1.5, 0, 1)
    mus *= np.clip((DUR - t) / 2.2, 0, 1)
    return mus


# ---------------------------------------------------------------- sound design
def whoosh(dur, peak_hz, gain):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    out = np.zeros(n)
    # time-varying band-pass: process in short blocks with a sweeping centre frequency
    blk = 256
    zi = None
    for i in range(0, n, blk):
        k = i / n
        fc = 250 + (peak_hz - 250) * np.sin(np.pi * k) ** 1.5
        sos = signal.butter(2, [fc * 0.6, min(fc * 1.6, SR / 2 - 100)], "band", fs=SR, output="sos")
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        seg, zi = signal.sosfilt(sos, x[i: i + blk], zi=zi)
        out[i: i + blk] = seg
    e = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    return out * e * gain


def chime(gain):
    n = int(2.8 * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for f, a, d in ((mtof(77), 1.0, 1.4), (mtof(77) * 2.0, 0.35, 0.8), (mtof(81), 0.6, 1.2), (mtof(84), 0.4, 1.0)):
        out += a * np.sin(2 * np.pi * f * t) * np.exp(-t / d)
    return out * np.minimum(1, t / 0.005) * gain


def build_sfx():
    sfx = np.zeros(N)
    for s in TL["scenes"]:
        if s["trans"] == "wipe":
            add(sfx, whoosh(1.1, 3800, 0.22), s["start"] - 0.62)
        elif s["trans"] == "fade" and s["id"] != "s11":
            add(sfx, whoosh(0.7, 2200, 0.08), s["start"] - 0.38)
    add(sfx, chime(0.11), scene("s11")["start"] + 0.1)
    return sfx


def main():
    os.makedirs(os.path.join(ROOT, "audio"), exist_ok=True)
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
        # voice: clean low end, a touch of presence and air, steady level
        "[0:a]highpass=f=75,equalizer=f=220:t=q:w=1:g=-1.5,equalizer=f=3200:t=q:w=1.2:g=2.5,"
        "aexciter=amount=1.2:drive=4:freq=6000,"
        "acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=3,loudnorm=I=-16:TP=-2:LRA=7,asplit=2[vo][sc];"
        # music bed sits ~16 LU under the voice and ducks further while someone speaks
        "[1:a]volume=0.55,loudnorm=I=-28:TP=-6[mus];"
        "[mus][sc]sidechaincompress=threshold=0.03:ratio=5:attack=40:release=450[duck];"
        "[2:a]volume=1.0[fx];"
        "[vo][duck][fx]amix=inputs=3:normalize=0,pan=stereo|c0=c0|c1=c0[out]"
    )
    pre = os.path.join(ROOT, "audio/.premix.wav")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", paths["vo_track"], "-i", paths["music"], "-i", paths["sfx"],
                    "-filter_complex", fc, "-map", "[out]", "-c:a", "pcm_f32le", pre], check=True)
    # measure, then gain to -14 LUFS (social platforms) with a -2 dBFS peak limiter
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", pre, "-af", "loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    m = json.loads(r.stderr[r.stderr.rindex("{"): r.stderr.rindex("}") + 1])
    print("premix:", {k: m[k] for k in ("input_i", "input_tp", "target_offset", "normalization_type")})
    gain = -14.0 - float(m["input_i"])
    ln = f"volume={gain:.2f}dB,alimiter=limit=0.79:attack=3:release=80:level=false,aresample=48000"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", pre, "-af", ln, "-c:a", "pcm_s16le", mix], check=True)
    os.remove(pre)
    print("wrote", mix)


if __name__ == "__main__":
    main()
