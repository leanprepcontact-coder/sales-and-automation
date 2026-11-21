"""Synthesized sound design + score for the Article 72 film (BGM + sound effects only, no voice)."""
import numpy as np
from scipy import signal
import soundfile as sf

SR = 44100
rng = np.random.default_rng(7)


def tt(d):
    return np.arange(int(d * SR)) / SR


def env(n, a=.005, r=.2):
    e = np.ones(n)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] *= np.linspace(1, 0, nr) if nr < n else 0
    return e


def lp(x, f):
    b, a = signal.butter(2, f / (SR / 2), "low"); return signal.lfilter(b, a, x)


def hp(x, f):
    b, a = signal.butter(2, f / (SR / 2), "high"); return signal.lfilter(b, a, x)


def bp(x, lo, hi):
    b, a = signal.butter(2, [lo / (SR / 2), hi / (SR / 2)], "band"); return signal.lfilter(b, a, x)


def tick(hi=True):
    d = .09; n = int(d * SR); t = tt(d)
    x = np.sin(2 * np.pi * (2400 if hi else 1700) * t) * np.exp(-t * 70) + hp(rng.standard_normal(n), 3000) * np.exp(-t * 90) * .5
    return x * .5


def thud(f0=70, d=.7, amp=1.0):
    t = tt(d); f = f0 + 90 * np.exp(-t * 25)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) + lp(rng.standard_normal(len(t)), 600) * np.exp(-t * 30) * .6
    return x * amp


def stamp():
    t = tt(.8); n = len(t)
    x = thud(60, .8, 1.0) + bp(rng.standard_normal(n), 800, 3000) * np.exp(-t * 55) * .8
    return x


def clack():
    d = .06; n = int(d * SR); t = tt(d)
    return (bp(rng.standard_normal(n), 1500, 6000) * np.exp(-t * 90) * .55 + np.sin(2 * np.pi * (900 + rng.random() * 400) * t) * np.exp(-t * 120) * .3)


def scratch(d):
    n = int(d * SR); x = bp(rng.standard_normal(n), 2500, 7000)
    m = (np.sin(2 * np.pi * np.cumsum(9 + 6 * rng.random(n) * 0 + 4 * np.sin(np.linspace(0, 8, n))) / SR) * .5 + .5)
    return x * m * env(n, .05, .08) * .35


def whoosh(d=.7, up=True):
    n = int(d * SR); x = rng.standard_normal(n)
    out = np.zeros(n); cuts = np.geomspace(300, 5000, 8) if up else np.geomspace(5000, 300, 8)
    seg = n // 8
    for i, c in enumerate(cuts):
        s = slice(i * seg, (i + 1) * seg if i < 7 else n)
        out[s] = bp(x, c * .6, c * 1.4)[s]
    return out * np.sin(np.linspace(0, np.pi, n)) ** 1.5 * .55


def heartbeat():
    return np.concatenate([thud(55, .22, .8), np.zeros(int(.12 * SR)), thud(50, .22, .55)])


def shimmer(d):
    n = int(d * SR); t = tt(d); x = np.zeros(n)
    for f in [880, 1318, 1760, 2349, 2637]:
        x += np.sin(2 * np.pi * f * t + rng.random() * 6) * (.5 + .5 * np.sin(2 * np.pi * (.7 + rng.random()) * t))
    return x * env(n, .6, .6) * .06


def chime(f=1046, d=1.4):
    t = tt(d)
    return (np.sin(2 * np.pi * f * t) + .4 * np.sin(2 * np.pi * f * 2.01 * t)) * np.exp(-t * 2.6) * .35


def pad(d, notes, amp=.12):
    t = tt(d); x = np.zeros(len(t))
    for f in notes:
        for det in (-.4, 0, .4):
            x += np.sin(2 * np.pi * (f + det) * t + rng.random() * 6)
    x = lp(x, 1400) / (len(notes) * 3)
    return x * amp


def put(buf, x, at, g=1.0, pan=0.0):
    i = int(at * SR)
    if i >= buf.shape[0]: return
    x = x[: buf.shape[0] - i]
    buf[i:i + len(x), 0] += x * g * (1 - max(0, pan))
    buf[i:i + len(x), 1] += x * g * (1 + min(0, pan))


def build(spec, total, path):
    S = {}
    t = 0
    for sh in spec["shots"]:
        S[sh["id"]] = t; t += sh["dur"]
    N = int(total * SR); b = np.zeros((N, 2))
    # ----- room tone: low drone + faint air
    tr = tt(total)
    air = lp(rng.standard_normal(N), 500) * .035
    drone = np.sin(2 * np.pi * 55 * tr) * .05 + np.sin(2 * np.pi * 82.4 * tr) * .03
    g = np.ones(N)
    b[:, 0] += air + drone; b[:, 1] += air + drone
    # ----- score: minor pad that opens up; chords per section
    def sec(a, d, notes, amp):
        p = pad(d, notes, amp); p *= env(len(p), min(2.0, d / 3), min(1.5, d / 3))
        put(b, p, a)
    sec(0, 9.2, [110, 130.8, 164.8], .16)                   # Am
    sec(9.2, 4.2, [98, 123.5, 147], .18)                    # G tension
    sec(13.4 + 2.9, 2.3, [110, 164.8, 220], .09)            # held after freeze
    sec(18.4, 5, [87.3, 110, 130.8, 174.6], .15)            # F
    sec(23.4, 5, [98, 123.5, 146.8, 196], .15)              # G
    sec(28.4, 5, [130.8, 164.8, 196, 261.6], .17)           # C opens (pardon)
    sec(33.4, 6, [130.8, 164.8, 196, 261.6, 329.6], .22)    # dawn swell
    sec(39.4, 8.6, [130.8, 196, 261.6], .14)
    # ----- cell: clock ticks + distant drip
    for k in range(0, 13):
        put(b, tick(k % 2 == 0), 1.0 + k, .55 if k < 9 else .8)
    for a in (1.9, 4.1):
        d = chime(1568, .5) * .25; put(b, d, a, .3, .5)
    # ----- petition: typewriter, stamp, envelope whoosh
    for i in range(int(2.5 * 26)):
        put(b, clack(), S["petition"] + .5 + i / 26 + rng.random() * .012, .7, -.2)
    put(b, stamp(), S["petition"] + 3.05, 1.0)
    put(b, whoosh(.6), S["petition"] + 3.3, .6)
    # ----- desk: heartbeat building, ticks, pen hover
    for k in range(int(4.2 * 1.1)):
        put(b, heartbeat(), S["desk"] + .1 + k / 1.1, .6 + .08 * k)
    for k in range(4): put(b, tick(k % 2 == 0), S["desk"] + .5 + k, .5)
    put(b, whoosh(1.1, True), S["desk"] + 3.0, .5)
    # ----- reprieve: flash hit, then freeze silence
    fz = S["reprieve"] + 2.75
    for k in range(3): put(b, tick(), S["reprieve"] + .3 + k * .9, .6)
    b[int((fz - .12) * SR):int((fz + .25) * SR)] *= .0            # silence gap before impact
    put(b, thud(45, 1.4, 1.4), fz + .25, .9)
    put(b, chime(880, 2.0), fz + .3, .5)
    put(b, stamp(), S["reprieve"] + 3.1, .8)
    # ----- commutation: pen strike-through, tone shift
    put(b, scratch(.7), S["commute"] + 1.0, 1.0, .2)
    put(b, whoosh(.8, False), S["commute"] + 1.9, .5)
    put(b, thud(55, 1.0, 1.1), S["commute"] + 2.2, .8)
    put(b, chime(698, 1.8), S["commute"] + 2.6, .4)
    # ----- remission: block breaks, sparks
    for i in range(12):
        put(b, (bp(rng.standard_normal(int(.12 * SR)), 1200, 5000) * np.exp(-tt(.12) * 40)) * .5, S["remit"] + 1.7 + i * .035, .6, (i - 6) / 12)
    put(b, whoosh(.9, True), S["remit"] + 1.7, .45)
    put(b, thud(65, .8, .9), S["remit"] + 2.3, .7)
    put(b, chime(784, 1.6), S["remit"] + 2.35, .4)
    # ----- pardon: shimmer wipe
    put(b, shimmer(2.0), S["pardon"] + 1.2, 1.0)
    put(b, whoosh(1.4, True), S["pardon"] + 1.3, .45)
    put(b, chime(1318, 2.6), S["pardon"] + 2.6, .5)
    # ----- sign: scratch + stamp
    put(b, scratch(1.0), S["sign"] + .2, 1.0, .1)
    put(b, stamp(), S["sign"] + 1.45, 1.0)
    # ----- dawn: bird-like chirps and warm swell
    for a in (.5, 1.0, 1.9, 2.6):
        t = tt(.12); f = 3000 + 900 * np.sin(t * 50)
        put(b, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 28) * .12, S["dawn"] + a, .5, .3)
    # ----- quiz: ticking countdown, correct chime
    for k in range(3): put(b, tick(k % 2 == 0), S["quiz"] + 1.9 + k * .55, .7)
    put(b, chime(1046, 1.6), S["quiz"] + 3.55, .8)
    put(b, chime(1568, 1.6), S["quiz"] + 3.65, .5)
    # ----- cta: soft landing
    put(b, chime(784, 2.4), S["cta"] + 1.3, .35)
    # ----- fades & master
    b *= np.linspace(0, 1, N)[:, None].clip(0, 1) ** 0
    fi = int(.5 * SR); b[:fi] *= np.linspace(0, 1, fi)[:, None]
    fo = int(1.0 * SR); b[-fo:] *= np.linspace(1, 0, fo)[:, None]
    b = np.tanh(b * 1.2)
    pk = np.abs(b).max() or 1
    b = b / pk * .89
    sf.write(path, b, SR)
