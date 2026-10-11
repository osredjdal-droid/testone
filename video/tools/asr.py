import sys, glob, numpy as np, soundfile as sf, sherpa_onnx
D = sys.argv[1]; WAVS = sorted(glob.glob(sys.argv[2] + "/seg*.wav"))
rec = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=f"{D}/turbo-encoder.int8.onnx", decoder=f"{D}/turbo-decoder.int8.onnx",
    tokens=f"{D}/turbo-tokens.txt", language="ar", task="transcribe", num_threads=4)
for w in WAVS:
    x, sr = sf.read(w, dtype="float32")
    s = rec.create_stream(); s.accept_waveform(sr, x); rec.decode_stream(s)
    print(w.split('/')[-1], '|', s.result.text.strip())
