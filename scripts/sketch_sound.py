"""Sound for the sketch reel: soft plucked BGM, pencil scratches at draw-on starts, chime, whoosh. No voice."""
import numpy as np, soundfile as sf
from scipy.signal import butter, lfilter
SR = 44100
rng = np.random.default_rng(3)

def bp(x, lo, hi):
    b, a = butter(2, [lo / (SR / 2), hi / (SR / 2)], btype="band"); return lfilter(b, a, x)

def pluck(f, dur=0.9, amp=0.18):
    t = np.arange(int(SR * dur)) / SR
    y = sum(np.sin(2 * np.pi * f * k * t) * (0.5 ** k) for k in (1, 2, 3)) * np.exp(-t * 4.2)
    return y * amp

def scratch(dur, amp=0.07):
    n = int(SR * dur); x = bp(rng.normal(size=n), 2500, 7500)
    env = np.minimum(1, np.arange(n) / (SR * .03)) * np.minimum(1, (n - np.arange(n)) / (SR * .06))
    wob = 0.6 + 0.4 * np.sin(2 * np.pi * np.arange(n) / SR * rng.uniform(9, 14))
    return x * env * wob * amp

def build(total, path, scratches):
    n = int(total * SR); out = np.zeros(n)
    def put(y, t):
        i = int(t * SR); j = min(n, i + len(y))
        if i < n: out[i:j] += y[:j - i]
    pent = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25]
    prog = [[0, 2, 3], [1, 3, 4], [2, 4, 5], [0, 3, 4]]
    beat = 60 / 88
    t = 0.0; bar = 0
    while t < total - 0.5:
        ch = prog[bar % 4]
        for k in range(8):
            f = pent[ch[k % 3]] * (0.5 if k % 4 == 0 else 1)
            put(pluck(f, 0.8, 0.15 if k % 2 == 0 else 0.1), t + k * beat / 2)
        # soft pad
        tt = np.arange(int(SR * beat * 4)) / SR
        pad = sum(np.sin(2 * np.pi * pent[c] * 0.5 * tt) for c in ch) * 0.025 * np.minimum(1, tt / .8) * np.minimum(1, (beat * 4 - tt) / .8)
        put(pad, t)
        t += beat * 4; bar += 1
    for (ts, d) in scratches: put(scratch(d), ts)
    # light bulb chime, question wobble, whoosh into blueprint, end sparkle
    for k, f in enumerate([783.99, 1046.5, 1318.5]): put(pluck(f, 0.7, 0.14), 7.0 + k * 0.09)
    put(pluck(196.0, 0.6, 0.2), 7.0); put(pluck(185.0, 0.6, 0.2), 7.3)
    wn = int(SR * 1.5); w = bp(rng.normal(size=wn), 300, 3000) * np.hanning(wn) * 0.12; put(w, 26.0)
    for k, f in enumerate([1046.5, 1318.5, 1568.0, 2093.0]): put(pluck(f, 0.9, 0.12), 33.0 + k * 0.12)
    fade = np.minimum(1, (total - np.arange(n) / SR) / 1.5)
    out = out * fade; out = out / max(1e-6, np.abs(out).max()) * 0.85
    sf.write(path, out, SR)
