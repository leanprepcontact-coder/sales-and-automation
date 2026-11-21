"""Sound for the news-to-question reel: soft pad + pulse, whooshes, countdown ticks, answer chime. No voice."""
import numpy as np
import soundfile as sf
import film_sound as fs

SR = fs.SR


def build(spec, total, path):
    T = spec["times"]
    N = int(total * SR); b = np.zeros((N, 2))
    tr = fs.tt(total)
    air = fs.lp(fs.rng.standard_normal(N), 600) * .02
    drone = np.sin(2 * np.pi * 55 * tr) * .04
    b[:, 0] += air + drone; b[:, 1] += air + drone

    def sec(a, d, notes, amp):
        p = fs.pad(d, notes, amp); p *= fs.env(len(p), min(1.5, d / 3), min(1.2, d / 3)); fs.put(b, p, a)
    sec(0, T["q"], [110, 130.8, 164.8], .18)
    sec(T["q"], T["ans"] - T["q"], [87.3, 110, 130.8, 174.6], .16)
    sec(T["ans"], T["rule"] - T["ans"], [130.8, 164.8, 196, 261.6], .2)
    sec(T["rule"], T["cta"] - T["rule"], [98, 123.5, 146.8, 196], .17)
    sec(T["cta"], total - T["cta"], [130.8, 196, 261.6, 329.6], .2)
    # soft pulse
    k = 0.0
    while k < T["ans"]:
        fs.put(b, fs.thud(58, .22, .35), k, .5); k += .5
    # hook + card + question transitions
    fs.put(b, fs.thud(50, .9, 1.0), .12, .8)
    fs.put(b, fs.thud(60, .6, .8), 1.0, .6)
    fs.put(b, fs.whoosh(.6, True), T["card"] - .1, .5)
    for i in range(14): fs.put(b, fs.clack(), T["card"] + .5 + i * .07, .35)
    fs.put(b, fs.stamp(), T["card"] + 1.7, .6)
    fs.put(b, fs.whoosh(.55, True), T["q"] - .35, .5)
    for i in range(4): fs.put(b, fs.chime(660 + i * 110, .5), T["opts"] - .3 + i * .22, .18)
    # countdown
    n = int(T["ans"] - T["opts"])
    for i in range(n): fs.put(b, fs.tick(i % 2 == 0), T["opts"] + i, .9)
    fs.put(b, fs.thud(48, 1.0, 1.2), T["ans"], .85)
    fs.put(b, fs.chime(1046, 1.6), T["ans"] + .05, .8)
    fs.put(b, fs.chime(1568, 1.6), T["ans"] + .15, .5)
    fs.put(b, fs.whoosh(.6, True), T["rule"] - .45, .45)
    for i in range(2): fs.put(b, fs.stamp(), T["rule"] + .35 + i * .9, .45)
    fs.put(b, fs.chime(784, 2.4), T["cta"] + .2, .4)
    fi = int(.4 * SR); b[:fi] *= np.linspace(0, 1, fi)[:, None]
    fo = int(.8 * SR); b[-fo:] *= np.linspace(1, 0, fo)[:, None]
    b = np.tanh(b * 1.2); b = b / (np.abs(b).max() or 1) * .89
    sf.write(path, b, SR)
