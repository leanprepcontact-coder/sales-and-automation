"""Sound for the HUD reel: sub drone + pulse, risers/impacts at scene changes, HUD blips, alarm pings. No voice."""
import numpy as np, soundfile as sf
from scipy.signal import butter, lfilter
SR = 44100
rng = np.random.default_rng(5)

def bp(x, lo, hi):
    b, a = butter(2, [lo / (SR / 2), hi / (SR / 2)], btype="band"); return lfilter(b, a, x)

def tone(f, dur, amp, decay=6.0, harm=(1,)):
    t = np.arange(int(SR * dur)) / SR
    return sum(np.sin(2 * np.pi * f * k * t) / k for k in harm) * np.exp(-t * decay) * amp

def impact(amp=.5):
    t = np.arange(int(SR * 1.4)) / SR
    return (np.sin(2 * np.pi * (60 - 25 * t) * t) * np.exp(-t * 3.5) + 0.25 * bp(rng.normal(size=len(t)), 80, 900) * np.exp(-t * 6)) * amp

def riser(dur, amp=.16):
    n = int(SR * dur); x = bp(rng.normal(size=n), 400, 6000) * (np.arange(n) / n) ** 2.2
    return x * amp

def build(total, path, starts):
    n = int(total * SR); out = np.zeros(n)
    def put(y, t):
        i = int(t * SR); j = min(n, i + len(y))
        if 0 <= i < n: out[i:j] += y[:j - i]
    tt = np.arange(n) / SR
    # drone: sub + slow detuned pad, swells with the story
    swell = 0.5 + 0.5 * np.minimum(1, tt / 3.0)
    drone = (np.sin(2 * np.pi * 55 * tt) * .22 + np.sin(2 * np.pi * 82.4 * tt) * .08 + np.sin(2 * np.pi * 110.5 * tt) * .06 + np.sin(2 * np.pi * 164.8 * tt + .4 * np.sin(tt * .7)) * .035) * swell
    out += drone
    # heartbeat pulse at ~84 bpm
    beat = 60 / 84; k = 0
    while k * beat < total - .5:
        put(tone(48, .35, .22, 11), k * beat); k += 1
    # arpeggio shimmer
    sc = [329.63, 392.0, 493.88, 587.33, 659.25]
    k = 0
    while k * beat / 2 < total - .5:
        put(tone(sc[(k * 3) % 5] * 2, .5, .05, 8, (1, 2)), k * beat / 2); k += 1
    for tcut in [3.7, 9.3, 15.3, 22.7, 29.2, 33.0]:
        put(impact(.55), tcut - 0.05); put(riser(1.4), tcut - 1.4)
    for ts in starts:   # HUD blips on every new line item
        put(tone(1800 + (hash(round(ts, 2)) % 4) * 300, .08, .05, 40), ts)
    for ts in [12.0, 12.8]:
        put(tone(880, .5, .2, 5, (1, 2)), ts); put(tone(660, .5, .2, 5, (1, 2)), ts + .22)
    for k, f in enumerate([523.25, 659.25, 783.99, 1046.5]): put(tone(f, .9, .13, 3.5, (1, 2)), 33.1 + k * .13)
    w = int(SR * 1.2); put(bp(rng.normal(size=w), 600, 5000) * np.hanning(w) * .12, 4.6)
    fade = np.minimum(1, (total - tt) / 1.5)
    out = out * fade; out = out / max(1e-6, np.abs(out).max()) * 0.85
    sf.write(path, out, SR)
