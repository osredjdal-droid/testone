import sys, json, os, numpy as np, soundfile as sf, sherpa_onnx
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vo_script import SEGMENTS, norm
M = sys.argv[1]; OUT = sys.argv[2]; SPEED = float(sys.argv[3]) if len(sys.argv) > 3 else 0.92
os.makedirs(OUT, exist_ok=True)
cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
    vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=f"{M}/ar_JO-kareem-medium.onnx", tokens=f"{M}/tokens.txt",
        data_dir=f"{M}/espeak-ng-data", noise_scale=0.6, noise_scale_w=0.7, length_scale=1.0),
    num_threads=4), max_num_sentences=1)
tts = sherpa_onnx.OfflineTts(cfg)
SR = tts.sample_rate

def trim(x, thr=0.012, pad=0.06):
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx) == 0: return x
    a = max(0, idx[0] - int(pad*SR)); b = min(len(x), idx[-1] + int(pad*SR))
    return x[a:b]

def gap_after(p):
    p = p.strip()
    if p.endswith((':', '.')): return 0.42
    if p.endswith(('؟', '?')): return 0.45
    if p.endswith('،'): return 0.26
    return 0.2

meta = []
for i, seg in enumerate(SEGMENTS):
    parts, phr, t = [], [], 0.0
    for j, p in enumerate(seg):
        a = tts.generate(norm(p), sid=0, speed=SPEED)
        x = trim(np.array(a.samples, dtype=np.float32))
        d = len(x)/SR
        phr.append({"start": round(t, 3), "end": round(t+d, 3)})
        parts.append(x); t += d
        if j < len(seg)-1:
            g = gap_after(p); parts.append(np.zeros(int(g*SR), np.float32)); t += g
    y = np.concatenate(parts)
    sf.write(f"{OUT}/seg{i+1:02d}.wav", y, SR)
    meta.append({"seg": i+1, "dur": round(len(y)/SR, 3), "phrases": phr})
    print(i+1, round(len(y)/SR, 2), [round(p['end']-p['start'],2) for p in phr])
json.dump({"sr": SR, "segments": meta}, open(f"{OUT}/timing.json", "w"), indent=1)
print("total", sum(m['dur'] for m in meta))
