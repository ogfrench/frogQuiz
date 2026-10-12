# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0
"""Synthesises frogQuiz's own stings and podium parts. No samples, no third-party audio: every
sound is built from sines, decaying partials and filtered noise, so the recipe is the source.
usage: python -P make_own.py <out_dir>            (the original stings, listen.html)
       python -P make_own.py --kit <out_dir>      (frogQuiz sound kit v1, kit.html)"""
import sys, pathlib
import numpy as np

SR = 44100
rng = np.random.default_rng(11)


def t_(d):
    return np.arange(int(d * SR)) / SR


def hz(note):  # MIDI -> Hz
    return 440.0 * 2 ** ((note - 69) / 12)


def noise_band(n, lo, hi):
    """White noise, brick-wall filtered in the frequency domain."""
    x = rng.standard_normal(n)
    s = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    s[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(s, n)


def lowpass_fft(x, cutoff, slope=1500.0):
    s = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    s *= 1 / (1 + np.exp((f - cutoff) / slope * 4))
    return np.fft.irfft(s, len(x))


def mix(buf, x, t=0.0, g=1.0):
    i = int(round(t * SR))
    if i + len(x) > len(buf):
        buf = np.concatenate([buf, np.zeros(i + len(x) - len(buf))])
    buf[i:i + len(x)] += x * g
    return buf


def marimba(f, dur=1.2, vel=1.0):
    t = t_(dur)
    # bar partials 1 : 3.93 : 9.4, the upper ones die fast. A tiny noise click gives the mallet.
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.42)
         + 0.35 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t / 0.09)
         + 0.12 * np.sin(2 * np.pi * f * 9.4 * t) * np.exp(-t / 0.03))
    n = int(0.006 * SR)
    s[:n] += 0.3 * rng.standard_normal(n) * np.linspace(1, 0, n)
    s[:int(0.0015 * SR)] *= np.linspace(0, 1, int(0.0015 * SR))
    s *= np.clip(1 - (t - (dur - 0.05)) / 0.05, 0, 1)
    return vel * s / 1.4


def bell(f, dur=2.5, vel=1.0):
    t = t_(dur)
    parts = [(1.0, 1.0, 1.4), (2.76, 0.6, 0.9), (5.4, 0.35, 0.5), (8.93, 0.18, 0.3)]
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d) for r, a, d in parts)
    s[:int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    s *= np.clip(1 - (t - (dur - 0.1)) / 0.1, 0, 1)
    return vel * s / 2.4


def brass(f, dur, attack=0.03, release=0.15, vel=1.0, bright=1.0):
    """Additive saw (first 10 partials, softened) with a swell: a synthetic brass section, deliberately not realistic."""
    t = t_(dur)
    s = np.zeros_like(t)
    for k in range(1, 11):
        s += (1 / k) * np.exp(-0.18 * k / bright) * np.sin(2 * np.pi * f * k * t + 0.4 * k)
    detune = 1.004
    for k in range(1, 7):
        s += 0.7 * (1 / k) * np.exp(-0.18 * k / bright) * np.sin(2 * np.pi * f * detune * k * t)
    a = np.minimum(t / attack, 1.0)
    r = np.clip((dur - t) / release, 0, 1)
    return vel * s * a * r / 3.0


def snare_hit(vel=1.0, dur=0.12):
    t = t_(dur)
    n = noise_band(len(t), 1800, 9000) * np.exp(-t / 0.032)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.022) * 0.5
    s = n + body
    s[:int(0.0008 * SR)] *= np.linspace(0, 1, int(0.0008 * SR))
    return vel * s / 1.8


def tom(f0=140, dur=0.35, vel=1.0):
    t = t_(dur)
    f = f0 * (1 + 0.5 * np.exp(-t / 0.05))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / 0.13)
    n = noise_band(len(t), 200, 2500) * np.exp(-t / 0.01) * 0.25
    return vel * (s + n)


def cymbal(dur=1.8, vel=1.0):
    t = t_(dur)
    n = noise_band(len(t), 5000, 16000)
    return vel * n * np.exp(-t / 0.55) * 0.45


def thump(f0=70, dur=0.5, vel=1.0):
    t = t_(dur)
    f = f0 * (1 + 1.2 * np.exp(-t / 0.04))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return vel * np.sin(ph) * np.exp(-t / 0.18)


def blip(f, dur=0.12, vel=1.0):
    t = t_(dur)
    s = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t / 0.035)
    s[:int(0.001 * SR)] *= np.linspace(0, 1, int(0.001 * SR))
    return vel * s / 1.25


def norm(x, peak=0.9):
    return x / (np.max(np.abs(x)) + 1e-12) * peak


# ---------------------------------------------------------------- the sounds
def get_ready():
    """3, 2, 1, go: three soft blips a second apart, then a bright two-note chime."""
    b = np.zeros(int(4.0 * SR))
    for k in range(3):                               # three C5 blips, each a little louder
        b = mix(b, blip(hz(72), 0.14, 0.6 + 0.1 * k), k * 1.0)
    b = mix(b, marimba(hz(79), 1.0, 0.9), 3.0)       # G5
    b = mix(b, marimba(hz(84), 1.0, 0.9), 3.0)       # C6
    b = mix(b, bell(hz(84), 1.2, 0.5), 3.0)
    return norm(b)


def last5():
    """Five seconds of ticks that speed up and climb: 0.8 s apart at first, 0.2 s at the end."""
    b = np.zeros(int(5.2 * SR))
    t = 0.0
    while t < 5.0:
        p = t / 5.0
        f = 900 * 2 ** (p * 1.0)                     # one octave up over the five seconds
        b = mix(b, blip(f, 0.09, 0.45 + 0.55 * p), t)
        t += 0.8 - 0.6 * p
    return norm(b)


def times_up_gong():
    b = np.zeros(int(2.6 * SR))
    b = mix(b, bell(hz(57), 2.6, 1.0))               # A3
    b = mix(b, thump(60, 0.6, 0.6))
    return norm(b)


def times_up_bwomp():
    """Two falling notes, soft and a little rounded. Says stop without scolding."""
    out = np.zeros(int(1.2 * SR))
    for t0, n in ((0.0, 64), (0.32, 58)):            # E4 then Bb3
        d = 0.5
        t = t_(d)
        f = hz(n)
        s = sum((1 / k) * np.sin(2 * np.pi * f * k * t) for k in (1, 3, 5, 7))
        s = lowpass_fft(s, 900)
        s *= np.minimum(t / 0.01, 1) * np.exp(-t / 0.22)
        out = mix(out, s, t0)
    return norm(out)


def reveal():
    """Answer reveal: two kalimba-like notes up, then a quick sparkle."""
    b = np.zeros(int(1.4 * SR))
    b = mix(b, marimba(hz(79), 0.8, 0.8), 0.0)
    b = mix(b, marimba(hz(86), 1.1, 0.9), 0.14)
    b = mix(b, bell(hz(91), 1.0, 0.25), 0.14)
    return norm(b)


def locked():
    t = t_(0.16)
    f = 520 * (1 + 0.8 * (1 - np.exp(-t / 0.03)))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / 0.05)
    s[:int(0.001 * SR)] *= np.linspace(0, 1, int(0.001 * SR))
    return norm(s)


def correct():
    b = np.zeros(int(1.2 * SR))
    for k, n in enumerate((72, 76, 79, 84)):         # C5 E5 G5 C6
        b = mix(b, marimba(hz(n), 0.9, 0.7 + 0.1 * k), k * 0.08)
    b = mix(b, bell(hz(96), 0.9, 0.18), 0.24)
    return norm(b)


def incorrect():
    b = np.zeros(int(0.9 * SR))
    for t0, n in ((0.0, 67), (0.17, 63)):            # G4 then Eb4, muffled
        m = marimba(hz(n), 0.5, 0.9)
        b = mix(b, lowpass_fft(m, 1400), t0)
    return norm(b)


def drumroll(dur=3.9, end_hit=True):
    """Snare roll: hits get denser (14 to 26 per second) and louder. Ends on a hit so it can stop on a beat."""
    b = np.zeros(int((dur + 0.6) * SR))
    t = 0.0
    k = 0
    while t < dur - 0.05:
        p = t / dur
        v = (0.3 + 0.7 * p ** 1.3) * (0.85 if k % 2 else 1.0) * rng.uniform(0.92, 1.0)
        b = mix(b, snare_hit(v), t)
        t += 1 / (14 + 12 * p) * rng.uniform(0.94, 1.06)
        k += 1
    if end_hit:
        b = mix(b, snare_hit(1.0, 0.2), dur)
        b = mix(b, tom(110, 0.5, 0.9), dur)
        b = mix(b, cymbal(0.5, 0.25), dur)
    return norm(b)


def riser(dur=3.9):
    """Build-up that is not a drumroll: a sine climbing two octaves under tom pulses that speed up."""
    b = np.zeros(int((dur + 0.6) * SR))
    t = t_(dur)
    f = 180 * 2 ** (2 * (t / dur) ** 1.4)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sw = np.sin(ph) * (0.1 + 0.9 * (t / dur) ** 2)
    sw += 0.4 * np.sin(2 * ph) * (t / dur) ** 3
    b[:len(t)] += 0.5 * sw
    tt = 0.0
    while tt < dur - 0.1:
        p = tt / dur
        b = mix(b, tom(130 + 60 * p, 0.3, 0.3 + 0.7 * p), tt)
        tt += 0.5 - 0.34 * p
    b = mix(b, tom(95, 0.6, 1.0), dur)
    b = mix(b, cymbal(0.6, 0.3), dur)
    return norm(b)


def place_hit(n):
    """3rd and 2nd place landing: a marimba note on a soft thump. n = 3 or 2."""
    note = {3: 67, 2: 72}[n]                         # G4, C5
    b = np.zeros(int(1.6 * SR))
    b = mix(b, marimba(hz(note), 1.4, 1.0))
    b = mix(b, marimba(hz(note + 7), 1.0, 0.55))
    b = mix(b, thump(80, 0.35, 0.5 if n == 3 else 0.7))
    return norm(b)


def place_hit_first():
    """1st place landing: bigger. Marimba chord, bell, thump, a short cymbal."""
    b = np.zeros(int(2.4 * SR))
    for n in (60, 67, 72, 76):                       # C4 G4 C5 E5
        b = mix(b, marimba(hz(n), 1.8, 0.9))
    b = mix(b, bell(hz(84), 2.2, 0.5))
    b = mix(b, thump(70, 0.5, 1.0))
    b = mix(b, cymbal(1.2, 0.18))
    return norm(b)


def fanfare():
    """Winner fanfare, about 4.5 s: a full-chord hit on the downbeat, a marimba flourish, one held chord."""
    b = np.zeros(int(5.2 * SR))
    for n in (48, 60, 64, 67, 72):                   # C3 C4 E4 G4 C5
        b = mix(b, brass(hz(n), 0.7, 0.012, 0.3, 0.8), 0.0)
    b = mix(b, thump(65, 0.6, 0.9))
    b = mix(b, cymbal(1.8, 0.2))
    for k, n in enumerate((79, 84, 88)):             # G5 C6 E6 marimba flourish
        b = mix(b, marimba(hz(n), 0.8, 0.7), 0.5 + 0.11 * k)
    for n in (48, 60, 64, 67, 72, 76):               # held final chord
        b = mix(b, brass(hz(n), 3.6, 0.04, 1.6, 0.9), 0.9)
    b = mix(b, bell(hz(84), 3.2, 0.55), 0.9)
    b = mix(b, cymbal(1.6, 0.15), 0.9)
    return norm(b)


SOUNDS = dict(get_ready=get_ready, last5=last5, times_up_gong=times_up_gong, times_up_bwomp=times_up_bwomp,
              reveal=reveal, locked=locked, correct=correct, incorrect=incorrect,
              drumroll=drumroll, riser=riser, hit3=lambda: place_hit(3), hit2=lambda: place_hit(2),
              hit1=place_hit_first, fanfare=fanfare)


# ============================================================================================
# frogQuiz sound kit v1: one palette for the whole game.
#   Instruments: marimba, soft bell, kalimba, warm pad, soft kick, brush snare, shaker,
#                wood tick, round bass. A soft additive brass hint appears only under the fanfare.
#   Key family:  C major with F, G and Am (Dm once, in the calm loop).
#   Tempos:      lobby 112 BPM, question 120 BPM (also rendered at 180 = 1.5x), scoreboard 100,
#                calm loop 80. Every loop is whole bars and is mixed circularly: the tail of the
#                last notes wraps onto the start, so the file ends exactly where the next pass begins.
#   Variants:    A leans on marimba and soft drums, B on kalimba, bell and pad.
# Everything is numpy. No samples. Each item reseeds the random generators, so any item renders
# the same bytes whatever was rendered before it.
# ============================================================================================
NOTE_PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
# semitones above C of the chord tones (root, third, fifth), possibly past the octave
CHORDS = {'C': (0, 4, 7), 'F': (5, 9, 12), 'G': (7, 11, 14), 'Am': (9, 12, 16), 'Dm': (2, 5, 9)}
PENTA = (0, 2, 4, 7, 9)
# Mix constants for the layers that carry the most low-frequency energy (phones and laptops have none below ~150 Hz)
MIXG = {'bass': 0.55, 'kick': 0.6, 'pad': 1.0, 'shaker': 1.0}


def reseed(seed):
    global rng
    rng = np.random.default_rng(seed)


def chord_pool(ch, lo, hi):
    pcs = {x % 12 for x in CHORDS[ch]}
    return [m for m in range(lo, hi + 1) if m % 12 in pcs]


def penta_pool(lo, hi):
    return [m for m in range(lo, hi + 1) if m % 12 in PENTA]


class Loop:
    """A buffer of exactly n samples that wraps: whatever runs past the end lands on the start."""

    def __init__(self, seconds):
        self.n = int(round(seconds * SR))
        self.x = np.zeros(self.n)

    def add(self, s, t=0.0, g=1.0):
        i = int(round(t * SR)) % self.n
        pos = 0
        while pos < len(s):
            k = min(len(s) - pos, self.n - i)
            self.x[i:i + k] += s[pos:pos + k] * g
            pos += k
            i = 0


class Line:
    """A buffer that grows as needed, for stings and one-shot pieces."""

    def __init__(self, seconds=0.0):
        self.x = np.zeros(int(round(seconds * SR)))

    def add(self, s, t=0.0, g=1.0):
        self.x = mix(self.x, s, t, g)


# ---------------------------------------------------------------- instruments
def kmarimba(f, dur=1.2, vel=1.0):
    """The kit's marimba: the same mallet voice as marimba() with the bar partials tuned 1 : 4 : 10 (two octaves,
    then three octaves and a major third) so chords stay clean."""
    t = t_(dur)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.42)
         + 0.35 * np.sin(2 * np.pi * f * 4.0 * t) * np.exp(-t / 0.09)
         + 0.12 * np.sin(2 * np.pi * f * 10.0 * t) * np.exp(-t / 0.03))
    n = int(0.006 * SR)
    s[:n] += 0.3 * rng.standard_normal(n) * np.linspace(1, 0, n)
    s[:int(0.0015 * SR)] *= np.linspace(0, 1, int(0.0015 * SR))
    s *= np.clip(1 - (t - (dur - 0.05)) / 0.05, 0, 1)
    return vel * s / 1.4


def kalimba(f, dur=1.1, vel=1.0):
    t = t_(dur)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.5)
         + 0.25 * np.sin(2 * np.pi * f * 5.85 * t) * np.exp(-t / 0.045)
         + 0.10 * np.sin(2 * np.pi * f * 2.02 * t) * np.exp(-t / 0.2))
    n = int(0.003 * SR)
    s[:n] += 0.15 * rng.standard_normal(n) * np.linspace(1, 0, n)
    k = int(0.001 * SR)
    s[:k] *= np.linspace(0, 1, k)
    s *= np.clip(1 - (t - (dur - 0.08)) / 0.08, 0, 1)
    return vel * s / 1.3


def pad(midis, dur, attack=0.5, release=0.7, vel=1.0, bright=0.5):
    """Warm pad: three slightly detuned voices per note, three partials, slow swell in and out."""
    t = t_(dur)
    s = np.zeros_like(t)
    for m in midis:
        f = hz(m)
        for det in (0.9985, 1.0, 1.0016):
            for k, a in ((1, 1.0), (2, 0.5 * bright), (3, 0.2 * bright)):
                s += a * np.sin(2 * np.pi * f * det * k * t + 0.7 * m + 2.1 * k + 40 * (det - 1))
    env = np.minimum(t / attack, 1.0) ** 1.5 * np.clip((dur - t) / release, 0, 1)
    return MIXG['pad'] * vel * s * env / (len(midis) * 3 * 1.2)


def soft_kick(vel=1.0, dur=0.32):
    t = t_(dur)
    f = 48 + 80 * np.exp(-t / 0.03)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.1)
    k = int(0.002 * SR)
    s[:k] *= np.linspace(0, 1, k)
    s *= np.clip(1 - (t - (dur - 0.03)) / 0.03, 0, 1)
    return MIXG['kick'] * vel * s


def brush(vel=1.0, dur=0.22):
    t = t_(dur)
    n = noise_band(len(t), 1400, 7500)
    env = (1 - np.exp(-t / 0.006)) * np.exp(-t / 0.05)
    s = (0.55 * n + 0.35 * np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.03)) * env
    s *= np.clip(1 - (t - (dur - 0.02)) / 0.02, 0, 1)
    return vel * s * 1.2


def shaker(vel=1.0, dur=0.1):
    t = t_(dur)
    n = noise_band(len(t), 5500, 13000)
    env = (1 - np.exp(-t / 0.008)) * np.exp(-t / 0.026)
    return MIXG['shaker'] * vel * n * env * np.clip(1 - (t - (dur - 0.015)) / 0.015, 0, 1) * 0.9


def woodtick(f=1100, vel=1.0, dur=0.09):
    t = t_(dur)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.02) + 0.35 * np.sin(2 * np.pi * f * 2.4 * t) * np.exp(-t / 0.009)
    k = int(0.0005 * SR)
    s[:k] *= np.linspace(0, 1, k)
    s *= np.clip(1 - (t - (dur - 0.01)) / 0.01, 0, 1)
    return vel * s / 1.2


def bass_note(m, dur=0.6, vel=1.0):
    f = hz(m)
    t = t_(dur)
    s = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.15))
    s *= np.minimum(t / 0.012, 1) * np.exp(-t / 0.28) * np.clip(1 - (t - (dur - 0.04)) / 0.04, 0, 1)
    return MIXG['bass'] * vel * s / 1.3


def soft_brass(f, dur, vel=1.0):
    """A hint of brass under mallets: a few softened saw partials, slow attack, never on its own."""
    t = t_(dur)
    s = np.zeros_like(t)
    for k in range(1, 7):
        s += (1 / k ** 1.3) * np.sin(2 * np.pi * f * k * t + 0.3 * k)
    for k in range(1, 5):
        s += 0.6 * (1 / k ** 1.3) * np.sin(2 * np.pi * f * 1.003 * k * t)
    env = np.minimum(t / 0.06, 1) * np.exp(-t / 2.2) * np.clip((dur - t) / 0.4, 0, 1)
    return vel * s * env / 2.4


def voicing(ch, base=48):
    r = CHORDS[ch]
    return [base + r[0], base + r[1], base + r[2], base + 12 + r[0]]


def bell_note(ch):
    return 72 + CHORDS[ch][2]


def pick_cell(rr, cells, last):
    i = int(rr.integers(len(cells)))
    while i == last and len(cells) > 1:
        i = int(rr.integers(len(cells)))
    return i


def walk(rr, cur, pool, n, steps=(-2, -1, -1, 0, 1, 1, 2)):
    """A small random walk over a pool of pitches. Returns the notes and the last pitch."""
    out = []
    for _ in range(n):
        i = min(range(len(pool)), key=lambda j: abs(pool[j] - cur))
        i = int(np.clip(i + int(rr.choice(steps)), 0, len(pool) - 1))
        cur = pool[i]
        out.append(cur)
    return out, cur


# ---------------------------------------------------------------- 1. lobby (112 BPM, 12 bars, about 25.7 s)
def kit_lobby(v):
    reseed(1100 + v)
    rr = np.random.default_rng(1100 + v)
    beat = 60.0 / 112
    q = beat / 4
    L = Loop(12 * 4 * beat)
    if v == 0:
        prog = ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C', 'Am', 'F', 'C', 'G']
        cells = [[0, 3, 6, 8, 11, 14], [0, 2, 4, 6, 8, 10, 12, 14], [0, 3, 6, 10, 12], [0, 4, 7, 10, 14], [0, 3, 8, 11]]
        ranges = [(60, 79), (64, 84), (62, 81)]
    else:
        prog = ['C', 'Am', 'F', 'G', 'C', 'G', 'Am', 'F', 'F', 'C', 'Am', 'G']
        cells = [[[0, 6, 10], [0, 8], [0, 6, 12], [0, 10]],
                 [[0, 3, 6, 8, 11, 14], [0, 2, 6, 8, 10, 14], [0, 3, 6, 9, 12], [0, 4, 6, 10, 14]],
                 [[0, 8], [0, 6, 12], [0, 10, 14]]]
    cur, last = 67, -1
    for bar, ch in enumerate(prog):
        t0 = bar * 4 * beat
        sec = bar // 4
        L.add(pad(voicing(ch), 4 * beat + 0.9, attack=0.45 if v == 0 else 0.8, release=0.9,
                  vel=0.5 if v == 0 else 0.75), t0)
        root = 36 + CHORDS[ch][0]
        if v == 0:
            for b, vel in {0: ((0, 0.8), (2.5, 0.55)), 1: ((0, 0.8), (1.5, 0.45), (2.5, 0.55)), 2: ((0, 0.8), (2, 0.5))}[sec]:
                L.add(bass_note(root, 0.55, vel), t0 + b * beat)
            for b, vel in ((0, 0.7), (2, 0.5)):
                L.add(soft_kick(vel), t0 + b * beat)
            for i in range(8):
                L.add(shaker(0.34 if i % 2 else 0.2), t0 + i * beat / 2)
                if sec == 1:
                    L.add(shaker(0.1), t0 + i * beat / 2 + q)
            if sec >= 1:
                for b in (1, 3):
                    L.add(brush(0.36), t0 + b * beat)
            ci = pick_cell(rr, cells, last)
            last = ci
            lo, hi = ranges[sec]
            notes, cur = walk(rr, cur, chord_pool(ch, lo, hi), len(cells[ci]))
            for p, m in zip(cells[ci], notes):
                vel = 0.85 if p == 0 else float(rr.uniform(0.5, 0.75))
                jit = 0.0 if p == 0 else float(rr.uniform(-0.004, 0.004))
                L.add(kmarimba(hz(m), 0.8, vel), t0 + p * q + jit)
            if bar % 4 == 0:
                L.add(bell(hz(bell_note(ch)), 2.2, 0.3), t0)
        else:
            if sec >= 1:
                L.add(bass_note(root, 1.5, 0.6), t0)
            if sec == 1:
                for b, vel in ((0, 0.35), (2, 0.25)):
                    L.add(soft_kick(vel), t0 + b * beat)
                for i in range(8):
                    L.add(shaker(0.25 if i % 2 else 0.14), t0 + i * beat / 2)
            if sec == 2 and bar % 4 == 0:
                L.add(soft_kick(0.3), t0)
            cl = cells[sec]
            ci = pick_cell(rr, cl, last)
            last = ci
            notes, cur = walk(rr, cur if cur >= 72 else 79, penta_pool(72, 91), len(cl[ci]))
            for p, m in zip(cl[ci], notes):
                vel = 0.8 if p == 0 else float(rr.uniform(0.5, 0.75))
                L.add(kalimba(hz(m), 1.0, vel), t0 + p * q)
            if bar % 4 == 0:
                L.add(bell(hz(bell_note(ch)), 2.4, 0.3), t0)
    return L.x


# ---------------------------------------------------------------- 2. get ready (3, 2, 1, go: 4.2 s)
def kit_getready(v):
    reseed(1200 + v)
    B = Line(4.2)
    if v == 0:
        for k, (m, vel) in enumerate(((72, 0.8), (74, 0.85), (76, 0.9))):
            B.add(kmarimba(hz(m), 0.5, vel), k * 1.0)
        for m in (79, 84):
            B.add(kmarimba(hz(m), 1.2, 1.0), 3.0)
        B.add(bell(hz(84), 1.2, 0.5), 3.0)
        B.add(soft_kick(0.7), 3.0)
        B.add(shaker(0.4, 0.2), 3.0)
    else:
        for k, vel in enumerate((0.7, 0.8, 0.9)):
            B.add(kalimba(hz(79), 0.6, vel), k * 1.0)
        B.add(pad([48, 55, 60, 64], 4.2, attack=3.0, release=0.8, vel=0.6), 0.0)
        B.add(bell(hz(84), 1.2, 0.5), 3.0)
        for m in (84, 88):
            B.add(kalimba(hz(m), 1.0, 0.9), 3.0)
        B.add(pad([60, 64, 67], 1.2, attack=0.04, release=0.8, vel=0.5), 3.0)
    return B.x


# ---------------------------------------------------------------- 3. question loop (120 BPM, 8 bars; bpm=180 gives 1.5x)
def kit_question(v, bpm=120):
    reseed(1300 + v)
    rr = np.random.default_rng(1300 + v)       # same seed at every tempo: same notes, only faster
    beat = 60.0 / bpm
    q = beat / 4
    L = Loop(8 * 4 * beat)
    prog = ['C', 'C', 'Am', 'Am', 'F', 'F', 'G', 'G']
    cur, last = 79, -1
    for bar, ch in enumerate(prog):
        t0 = bar * 4 * beat
        half = bar // 4
        root = 36 + CHORDS[ch][0]
        if v == 0:
            L.add(pad(voicing(ch, 60), 4 * beat + 0.6, attack=0.4, release=0.6, vel=0.14), t0)
            for b in range(4):
                L.add(woodtick(1100, 0.7 if b == 0 else 0.45), t0 + b * beat)
            pl = chord_pool(ch, 67, 91)
            idx = [[0, 1, 2, 1, 3, 2, 1, 2], [2, 3, 4, 3, 2, 1, 0, 1]][half]
            for i, k in enumerate(idx):
                if bar % 2 == 1 and i == 7:
                    continue
                L.add(kmarimba(hz(pl[min(k, len(pl) - 1)]), 0.45, 0.8 if i in (0, 4) else 0.5), t0 + i * beat / 2)
            for b in (0, 2):
                L.add(bass_note(root, 0.4, 0.5), t0 + b * beat)
            for i in range(8):
                L.add(shaker(0.34 if i % 2 else 0.18), t0 + i * beat / 2)
        else:
            L.add(pad(voicing(ch, 60), 4 * beat + 0.6, attack=0.5, release=0.6, vel=0.24), t0)
            for b in range(4):
                L.add(woodtick(1000 if b % 2 == 0 else 760, 0.45), t0 + b * beat)
            cell = [[0, 3, 6, 8, 11, 14], [0, 3, 6, 10, 12, 14]][half]
            notes, cur = walk(rr, cur, penta_pool(76, 96), len(cell))
            for p, m in zip(cell, notes):
                L.add(kalimba(hz(m), 0.7, 0.8 if p == 0 else float(rr.uniform(0.5, 0.7))), t0 + p * q)
            L.add(bass_note(root, 0.9, 0.55), t0)
            L.add(bass_note(root, 0.5, 0.35), t0 + 2 * beat)
            for i in range(1, 8, 2):
                L.add(shaker(0.3), t0 + i * beat / 2)
    return L.x


# ---------------------------------------------------------------- 4. last 5 seconds
def kit_last5(v):
    """v=0 replaces the question loop (own pulse, climbing marimba). v=1 is a layer to go on top of the 1.5x loop."""
    reseed(1400 + v)
    B = Line(5.25)
    if v == 0:
        times, t = [], 0.0
        while t < 5.0:
            times.append(t)
            t += 0.5 * 0.32 ** (t / 5.0)
        pl = penta_pool(64, 96)
        n = len(times)
        for k, t in enumerate(times):
            p = t / 5.0
            B.add(woodtick(1100 + 500 * p, 0.45 + 0.4 * p), t)
            B.add(kmarimba(hz(pl[int(k * (len(pl) - 1) / (n - 1))]), 0.5, 0.45 + 0.5 * p), t)
        B.add(pad([48, 55, 60, 64, 67], 5.25, attack=5.0, release=0.25, vel=0.7), 0.0)
        t = 3.0
        while t < 5.0:
            B.add(shaker(0.1 + 0.5 * (t - 3.0) / 2), t)
            t += 1 / (8 + 12 * (t - 3.0) / 2)
    else:
        beat = 60.0 / 180
        pl = penta_pool(79, 96)
        for b in range(15):
            m = pl[min(int(b * len(pl) / 15), len(pl) - 1)]
            B.add(kalimba(hz(m), 0.4, 0.3 + 0.5 * b / 14), b * beat)
        t = 0.0
        while t < 5.0:
            B.add(shaker(0.12 + 0.45 * (t / 5.0)), t)
            t += 1 / (6 + 26 * (t / 5.0) ** 2)
        tt = t_(5.25)
        sw = np.zeros_like(tt)
        for k, (lo, hi) in enumerate(((3000, 5000), (5000, 8000), (8000, 14000))):
            env = np.clip(tt / 5.0 - 0.25 * k, 0, 1) ** 2 * 0.3
            sw += noise_band(len(tt), lo, hi) * env
        B.add(sw, 0.0)
    return B.x


# ---------------------------------------------------------------- 5. time's up
def kit_timesup(v):
    reseed(1500 + v)
    B = Line(2.6)
    if v == 0:
        B.add(bell(hz(60), 2.6, 1.0))
        B.add(bell(hz(67), 2.0, 0.35))
        B.add(soft_kick(0.8))
        B.add(pad([48, 55, 60], 2.4, attack=0.05, release=1.2, vel=0.5))
    else:
        for k, m in enumerate((79, 76, 72)):
            B.add(kmarimba(hz(m), 1.4 if k == 2 else 0.6, 1.0), k * 0.17)
        B.add(bass_note(36, 0.8, 0.5), 0.34)
        B.add(pad([48, 55, 64], 1.8, attack=0.1, release=1.0, vel=0.4))
    return B.x


# ---------------------------------------------------------------- 6. answer reveal
def kit_reveal(v):
    reseed(1600 + v)
    B = Line(1.6)
    if v == 0:
        B.add(kalimba(hz(76), 1.0, 0.9))
        B.add(kalimba(hz(83), 1.2, 0.9), 0.13)
        B.add(bell(hz(96), 1.2, 0.2), 0.13)
        B.add(shaker(0.25), 0.13)
    else:
        for k, m in enumerate((72, 76, 79, 84)):
            B.add(kmarimba(hz(m), 1.0, 0.7 + 0.1 * k), k * 0.07)
        B.add(pad([60, 64, 67], 1.9, attack=0.12, release=1.0, vel=0.55))
        B.add(bell(hz(91), 1.4, 0.35), 0.28)
    return B.x


# ---------------------------------------------------------------- 7. scoreboard (100 BPM, 4 bars, 9.6 s; the first 4.8 s is the 5 s animation)
def kit_scoreboard(v):
    reseed(1700 + v)
    rr = np.random.default_rng(1700 + v)
    beat = 0.6
    q = beat / 4
    L = Loop(16 * beat)
    run = [72, 74, 76, 79, 81, 84, 86, 88]               # C5 D5 E5 G5 A5 C6 D6 E6, one per beat
    for k, m in enumerate(run):
        vel = 0.35 + 0.65 * k / 7
        L.add(kmarimba(hz(m), 0.9, vel) if v == 0 else kalimba(hz(m), 1.0, vel), k * beat)
    t = 0.0
    while t < 4.8:
        L.add(shaker(0.1 + 0.5 * t / 4.8), t)
        t += (beat / 2) if t < 2.4 else (beat / 4)
    L.add(pad(voicing('C'), 4.8 + 0.6, attack=4.5, release=0.6, vel=0.6), 0.0)
    # beats 8 to 15: the standings are in place
    L.add(bell(hz(84), 2.4, 0.4), 8 * beat)
    L.add(pad(voicing('F'), 2 * 4 * beat / 2 + 0.7, attack=0.1, release=0.7, vel=0.5 if v == 0 else 0.8), 8 * beat)
    L.add(pad(voicing('G'), 4 * beat + 0.7, attack=0.1, release=0.7, vel=0.5 if v == 0 else 0.8), 12 * beat)
    if v == 0:
        for b in (8, 10, 12, 14):
            L.add(soft_kick(0.7 if b % 4 == 0 else 0.5), b * beat)
        for b in (9, 11, 13, 15):
            L.add(brush(0.35), b * beat)
        for b, m in ((8, 41), (9.5, 41), (12, 43), (13.5, 43)):
            L.add(bass_note(m, 0.5, 0.6), b * beat)
        for bar, ch in ((2, 'F'), (3, 'G')):
            tones = [60 + x for x in CHORDS[ch]]
            for b in (0.5, 1.5, 2.5, 3.5):
                for m in tones:
                    L.add(kmarimba(hz(m + 12), 0.35, 0.28), (bar * 4 + b) * beat)
    else:
        for b in (8, 12):
            L.add(soft_kick(0.4), b * beat)
        for b in (9, 11, 13, 15):
            L.add(brush(0.2), b * beat)
        L.add(bass_note(41, 1.8, 0.6), 8 * beat)
        L.add(bass_note(43, 1.8, 0.6), 12 * beat)
        cur = 79
        for bar, cell in ((2, [0, 3, 6, 8, 11, 14]), (3, [0, 3, 6, 10, 12, 14])):
            notes, cur = walk(rr, cur, penta_pool(72, 88), len(cell))
            for p, m in zip(cell, notes):
                L.add(kalimba(hz(m), 0.8, 0.8 if p == 0 else float(rr.uniform(0.5, 0.7))), (bar * 4) * beat + p * q)
    return L.x


# ---------------------------------------------------------------- 8. final drumroll (stops on a beat at t = dur)
def kit_drumroll(v, dur=3.4):
    reseed(1800 + v)
    rr = np.random.default_rng(1800 + v)
    B = Line(dur + 0.7)
    if v == 0:
        t, k = 0.0, 0
        while t < dur - 0.04:
            p = t / dur
            B.add(brush((0.15 + 0.8 * p ** 1.4) * (0.85 if k % 2 else 1.0) * float(rr.uniform(0.92, 1.0))), t)
            t += 1 / (12 + 12 * p) * float(rr.uniform(0.94, 1.06))
            k += 1
        t = 0.0
        while t < dur - 0.04:
            B.add(shaker(0.06 + 0.3 * (t / dur) ** 1.5), t)
            t += 1 / (16 + 8 * t / dur)
        B.add(pad(voicing('G'), dur + 0.5, attack=dur, release=0.4, vel=0.6), 0.0)
        B.add(soft_kick(1.0), dur)
        B.add(brush(1.0, 0.3), dur)
    else:
        t, k = 0.0, 0
        while t < dur - 0.04:
            p = t / dur
            B.add(kmarimba(hz(67 if k % 2 == 0 else 74), 0.25, (0.15 + 0.8 * p ** 1.4) * float(rr.uniform(0.92, 1.0))), t)
            t += 1 / (14 + 10 * p) * float(rr.uniform(0.94, 1.06))
            k += 1
        t = 0.0
        while t < dur - 0.04:
            B.add(shaker(0.05 + 0.2 * (t / dur) ** 1.5), t)
            t += 1 / 12
        B.add(pad(voicing('G'), dur + 0.5, attack=dur, release=0.4, vel=0.6), 0.0)
        B.add(kmarimba(hz(79), 1.2, 1.0), dur)
        B.add(bell(hz(91), 1.4, 0.4), dur)
        B.add(soft_kick(0.9), dur)
    return B.x


# ---------------------------------------------------------------- 9. podium place hits (3rd, 2nd, 1st: growing)
def kit_place(v, place):
    reseed(1900 + v * 10 + place)
    B = Line(2.5)
    if v == 0:
        if place == 3:
            B.add(kmarimba(hz(67), 1.2, 0.9))
            B.add(kmarimba(hz(74), 1.0, 0.5))
            B.add(soft_kick(0.5))
        elif place == 2:
            for m, vel in ((72, 0.9), (76, 0.6), (79, 0.6)):
                B.add(kmarimba(hz(m), 1.4, vel))
            B.add(bell(hz(91), 1.4, 0.2))
            B.add(soft_kick(0.7))
        else:
            for m in (60, 67, 72, 76, 79):
                B.add(kmarimba(hz(m), 2.2, 0.85))
            B.add(bell(hz(84), 2.4, 0.5))
            B.add(soft_kick(1.0))
            B.add(pad(voicing('C'), 2.4, attack=0.05, release=1.2, vel=0.6))
            B.add(shaker(0.5, 0.3))
    else:
        if place == 3:
            B.add(bell(hz(79), 1.4, 0.7))
            B.add(kalimba(hz(74), 1.0, 0.6))
        elif place == 2:
            B.add(bell(hz(84), 1.6, 0.8))
            B.add(kalimba(hz(79), 1.2, 0.7))
            B.add(kalimba(hz(76), 1.2, 0.6))
            B.add(soft_kick(0.5))
        else:
            for m in (84, 88, 91):
                B.add(bell(hz(m), 2.4, 0.6))
            for k, m in enumerate((72, 76, 79)):
                B.add(kalimba(hz(m), 1.4, 0.8), k * 0.06)
            B.add(pad(voicing('C'), 2.4, attack=0.06, release=1.2, vel=0.75))
            B.add(soft_kick(1.0))
    return B.x


# ---------------------------------------------------------------- 10. winner fanfare
def kit_fanfare(v):
    """Lands on a C major chord at t = 0, so it can be placed on the downbeat."""
    reseed(2000 + v)
    B = Line(5.6)
    if v == 0:
        for m in (60, 64, 67, 72, 76):
            B.add(kmarimba(hz(m), 1.4, 0.9))
        B.add(bell(hz(84), 3.0, 0.5))
        for m in (48, 60, 64, 67):
            B.add(soft_brass(hz(m), 0.8, 0.3))
        B.add(pad([48, 55, 60, 64, 67], 4.8, attack=0.02, release=2.0, vel=0.6))
        B.add(soft_kick(0.9))
        for k, m in enumerate((79, 84, 88)):
            B.add(kmarimba(hz(m), 0.9, 0.8), 0.5 + 0.12 * k)
        for m in (60, 67, 72, 76, 79):
            B.add(kmarimba(hz(m), 3.0, 0.8), 0.9)
        B.add(bell(hz(88), 3.0, 0.35), 0.9)
        for m in (48, 60, 64, 67):
            B.add(soft_brass(hz(m), 3.4, 0.3), 0.9)
    else:
        for m in (60, 64, 67, 72):
            B.add(kmarimba(hz(m), 1.4, 0.8))
        B.add(bell(hz(84), 3.0, 0.5))
        B.add(pad([48, 55, 60, 64, 67], 5.2, attack=0.02, release=2.2, vel=0.7))
        for m in (48, 60, 64, 67):
            B.add(soft_brass(hz(m), 0.8, 0.25))
        B.add(soft_kick(0.9))
        for t, ch, bn in ((0.55, 'F', 81), (1.1, 'G', 83)):
            for m in [60 + x for x in CHORDS[ch]] + [72 + CHORDS[ch][0]]:
                B.add(kmarimba(hz(m), 0.9, 0.7), t)
            B.add(bell(hz(bn), 1.0, 0.3), t)
        for m in (60, 67, 72, 76, 79, 84):
            B.add(kmarimba(hz(m), 3.0, 0.9), 1.65)
        B.add(bell(hz(84), 3.4, 0.5), 1.65)
        B.add(bell(hz(88), 3.0, 0.35), 1.65)
        B.add(pad([48, 55, 60, 64, 67], 3.6, attack=0.05, release=1.8, vel=0.8), 1.65)
        for m in (48, 60, 64, 67):
            B.add(soft_brass(hz(m), 3.0, 0.3), 1.65)
        B.add(soft_kick(1.0), 1.65)
        B.add(shaker(0.4, 0.3), 1.65)
    return B.x


# ---------------------------------------------------------------- 11. calm loop under the podium list (80 BPM, 8 bars, 24 s)
def kit_calm(v):
    reseed(2100 + v)
    rr = np.random.default_rng(2100 + v)
    beat = 60.0 / 80
    q = beat / 4
    L = Loop(8 * 4 * beat)
    prog = ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G']
    cur, last = 72, -1
    for bar, ch in enumerate(prog):
        t0 = bar * 4 * beat
        root = 36 + CHORDS[ch][0]
        L.add(pad(voicing(ch), 4 * beat + 1.0, attack=0.8 if v == 0 else 1.0, release=1.0, vel=0.5 if v == 0 else 0.7), t0)
        L.add(bass_note(root, 1.6, 0.5), t0)
        if v == 0:
            cells = [[0, 6, 10], [0, 8], [0, 4, 8, 12], [0, 6, 12]]
            ci = pick_cell(rr, cells, last)
            last = ci
            notes, cur = walk(rr, cur, chord_pool(ch, 64, 84), len(cells[ci]))
            for p, m in zip(cells[ci], notes):
                L.add(kmarimba(hz(m), 0.9, 0.6 if p == 0 else 0.45), t0 + p * q)
        else:
            cells = [[0, 4, 8, 12], [0, 4, 6, 10, 12], [0, 3, 6, 9, 12]]
            ci = pick_cell(rr, cells, last)
            last = ci
            notes, cur = walk(rr, cur if cur >= 72 else 79, penta_pool(72, 88), len(cells[ci]))
            for p, m in zip(cells[ci], notes):
                L.add(kalimba(hz(m), 1.0, 0.55 if p == 0 else 0.45), t0 + p * q)
            if bar % 4 == 0:
                L.add(bell(hz(91), 2.4, 0.3), t0)
    return L.x


# ---------------------------------------------------------------- 12-14. phone
def kit_locked(v):
    reseed(2200 + v)
    B = Line(0.5)
    if v == 0:
        B.add(kmarimba(hz(79), 0.35, 0.7))
        B.add(woodtick(1500, 0.3))
    else:
        B.add(kalimba(hz(84), 0.5, 0.8))
    return B.x


def kit_correct(v):
    reseed(2300 + v)
    B = Line(1.1)
    if v == 0:
        B.add(kmarimba(hz(72), 0.7, 0.8))
        B.add(kmarimba(hz(79), 0.9, 0.9), 0.1)
        B.add(bell(hz(96), 0.8, 0.15), 0.1)
    else:
        for k, m in enumerate((72, 76, 79, 84)):
            B.add(kalimba(hz(m), 0.8, 0.7 + 0.05 * k), k * 0.07)
        B.add(bell(hz(91), 0.9, 0.2), 0.21)
    return B.x


def kit_incorrect(v):
    reseed(2400 + v)
    B = Line(1.0)
    if v == 0:
        for t0, m in ((0.0, 67), (0.18, 64)):
            B.add(lowpass_fft(kmarimba(hz(m), 0.6, 0.8), 1200), t0)
    else:
        for t0, m in ((0.0, 74), (0.2, 71)):
            B.add(lowpass_fft(kalimba(hz(m), 0.7, 0.8), 1500), t0)
        B.add(pad([55, 59], 0.9, attack=0.05, release=0.5, vel=0.3))
    return B.x


# id, function, kind, what it is
KIT_ITEMS = [
    ('lobby-a', lambda: kit_lobby(0), 'loop'), ('lobby-b', lambda: kit_lobby(1), 'loop'),
    ('getready-a', lambda: kit_getready(0), 'sting'), ('getready-b', lambda: kit_getready(1), 'sting'),
    ('question-a', lambda: kit_question(0, 120), 'loop'), ('question-b', lambda: kit_question(1, 120), 'loop'),
    ('question-a-15x', lambda: kit_question(0, 180), 'loop'), ('question-b-15x', lambda: kit_question(1, 180), 'loop'),
    ('last5-a', lambda: kit_last5(0), 'sting'), ('last5-b', lambda: kit_last5(1), 'sting'),
    ('timesup-a', lambda: kit_timesup(0), 'sting'), ('timesup-b', lambda: kit_timesup(1), 'sting'),
    ('reveal-a', lambda: kit_reveal(0), 'sting'), ('reveal-b', lambda: kit_reveal(1), 'sting'),
    ('scoreboard-a', lambda: kit_scoreboard(0), 'loop'), ('scoreboard-b', lambda: kit_scoreboard(1), 'loop'),
    ('drumroll-a', lambda: kit_drumroll(0, 3.4), 'sting'), ('drumroll-b', lambda: kit_drumroll(1, 3.4), 'sting'),
    ('drumroll-a-2.6s', lambda: kit_drumroll(0, 2.6), 'sting'), ('drumroll-b-2.6s', lambda: kit_drumroll(1, 2.6), 'sting'),
    ('place3-a', lambda: kit_place(0, 3), 'sting'), ('place2-a', lambda: kit_place(0, 2), 'sting'), ('place1-a', lambda: kit_place(0, 1), 'sting'),
    ('place3-b', lambda: kit_place(1, 3), 'sting'), ('place2-b', lambda: kit_place(1, 2), 'sting'), ('place1-b', lambda: kit_place(1, 1), 'sting'),
    ('fanfare-a', lambda: kit_fanfare(0), 'sting'), ('fanfare-b', lambda: kit_fanfare(1), 'sting'),
    ('calm-a', lambda: kit_calm(0), 'loop'), ('calm-b', lambda: kit_calm(1), 'loop'),
    ('locked-a', lambda: kit_locked(0), 'sting'), ('locked-b', lambda: kit_locked(1), 'sting'),
    ('correct-a', lambda: kit_correct(0), 'sting'), ('correct-b', lambda: kit_correct(1), 'sting'),
    ('incorrect-a', lambda: kit_incorrect(0), 'sting'), ('incorrect-b', lambda: kit_incorrect(1), 'sting'),
]


def render_kit():
    """Render every kit item at raw level. Returns {id: (float array, kind)}."""
    return {name: (fn(), kind) for name, fn, kind in KIT_ITEMS}


# ============================================================================================
# Variants C, D and E: three more kits, each its own palette and its own kind of gesture.
#   C  Lo-fi keys      electric piano (FM tine), soft swing, plucked bass, rim and shaker, glassy stings.
#   D  Wood and pluck  kalimba lead motifs, plucked bass, shaker, pitched wood knocks, marimba, woody stings.
#   E  Glass and air   glass bells, pad, hi-hat, a slow dreamy lobby, sparse and minimal, rising or falling phrases.
# Same key family as A and B (C major with F, G, Am; C adds the 7ths). Tempos where they differ from A and B:
# lobby C 96, D 108, E 84; scoreboard C 96; every loop is whole bars, mixed circularly, an exact number of samples.
# ============================================================================================
CHORDS.update({'Cmaj7': (0, 4, 7, 11), 'Am7': (9, 12, 16, 19), 'Fmaj7': (5, 9, 12, 16), 'G7': (7, 11, 14, 17),
               'Dm7': (2, 5, 9, 12), 'Em7': (4, 7, 11, 14), 'Em': (4, 7, 11)})


def epiano(f, dur=1.2, vel=1.0):
    """Electric piano: an FM tine (carrier and modulator at 1:1, index decaying) plus a short bark."""
    t = t_(dur)
    idx = 1.4 * np.exp(-t / 0.22) + 0.25
    s = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t)) * np.exp(-t / 0.9)
    s += 0.15 * np.sin(2 * np.pi * f * 7.0 * t) * np.exp(-t / 0.05)
    k = int(0.003 * SR)
    s[:k] *= np.linspace(0, 1, k)
    s *= np.clip(1 - (t - (dur - 0.08)) / 0.08, 0, 1)
    return vel * s / 1.2


def pluck(f, dur=0.6, vel=1.0):
    """Plucked bass or string: eight partials, the upper ones dying first."""
    t = t_(dur)
    s = np.zeros_like(t)
    for k in range(1, 9):
        s += (1.0 / k) * np.sin(2 * np.pi * f * k * t) * np.exp(-t / (0.35 / k + 0.03))
    n = int(0.004 * SR)
    s[:n] *= np.linspace(0, 1, n)
    s *= np.clip(1 - (t - (dur - 0.04)) / 0.04, 0, 1)
    return MIXG['bass'] * 0.7 * vel * s


def glass(f, dur=2.0, vel=1.0):
    """Glassy bell: wine-glass partial ratios, soft 12 ms attack, long decay."""
    t = t_(dur)
    s = np.zeros_like(t)
    for r, a, d in ((1.0, 1.0, 1.3), (2.32, 0.5, 0.7), (4.25, 0.25, 0.4), (6.63, 0.12, 0.2)):
        s += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d)
    k = int(0.012 * SR)
    s[:k] *= np.linspace(0, 1, k)
    s *= np.clip(1 - (t - (dur - 0.1)) / 0.1, 0, 1)
    return vel * s / 2.0


def wood(f, dur=0.35, vel=1.0):
    """Pitched wood knock: a short sine with an inharmonic upper partial and a tiny click."""
    t = t_(dur)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.06) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.025)
         + 0.2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / 0.012))
    n = int(0.002 * SR)
    s[:n] += 0.25 * rng.standard_normal(n) * np.linspace(1, 0, n)
    s *= np.clip(1 - (t - (dur - 0.03)) / 0.03, 0, 1)
    return vel * s / 1.4


def hat(vel=1.0, dur=0.07):
    t = t_(dur)
    n = noise_band(len(t), 7000, 15000)
    return vel * n * (1 - np.exp(-t / 0.002)) * np.exp(-t / 0.018) * np.clip(1 - (t - (dur - 0.01)) / 0.01, 0, 1)


def rim(vel=1.0, dur=0.08):
    t = t_(dur)
    s = np.sin(2 * np.pi * 1750 * t) * np.exp(-t / 0.008) + 0.6 * noise_band(len(t), 1500, 4000) * np.exp(-t / 0.01)
    return vel * s * np.clip(1 - (t - (dur - 0.01)) / 0.01, 0, 1) * 0.6


def clap(vel=1.0, dur=0.25):
    t = t_(dur)
    n = noise_band(len(t), 900, 3500)
    env = sum(np.exp(-np.clip(t - d, 0, None) / 0.012) * (t >= d) for d in (0.0, 0.009, 0.018)) + 0.6 * np.exp(-t / 0.08)
    return vel * n * env * np.clip(1 - (t - (dur - 0.03)) / 0.03, 0, 1) * 0.5


def pop(f0=420.0, f1=1100.0, dur=0.14, vel=1.0):
    """A soft pop: a sine that glides up (or down) and dies quickly."""
    t = t_(dur)
    f = f0 + (f1 - f0) * (1 - np.exp(-t / 0.03))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.05)
    k = int(0.001 * SR)
    s[:k] *= np.linspace(0, 1, k)
    return vel * s * np.clip(1 - (t - (dur - 0.01)) / 0.01, 0, 1)


def swish(dur, vel=1.0, lo=5000, hi=12000):
    """A rising noise swell."""
    t = t_(dur)
    return vel * noise_band(len(t), lo, hi) * (t / dur) ** 2


def stab(L, ch, t, base=60, vel=0.4, dur=1.4, inst=None):
    inst = inst or epiano
    for r in CHORDS[ch][:4]:
        L.add(inst(hz(base + r), dur, vel), t)


# ---------------------------------------------------------------- 1. lobby, C D E
def kit2_lobby(k):
    reseed(3100 + ord(k))
    rr = np.random.default_rng(3100 + ord(k))
    if k == 'c':
        beat = 60.0 / 96
        L = Loop(8 * 4 * beat)                         # 20 s
        prog = ['Cmaj7', 'Am7', 'Fmaj7', 'G7', 'Cmaj7', 'Em7', 'Fmaj7', 'G7']
        cells = [[0.58, 1.5, 2.58], [0, 1, 2.58, 3.5], [1.58, 3.0], [0, 2, 2.58, 3.58]]
        cur, last = 79, -1
        for bar, ch in enumerate(prog):
            t0 = bar * 4 * beat
            root = 36 + CHORDS[ch][0]
            stab(L, ch, t0, 60, 0.3, 1.6)
            stab(L, ch, t0 + 1.58 * beat, 60, 0.18, 0.7)
            L.add(pad(voicing(ch), 4 * beat + 0.9, attack=0.5, release=0.9, vel=0.25), t0)
            for b, m, vel in ((0, root, 0.8), (1.58, root + 7, 0.5), (2.5, root + 12, 0.5)):
                L.add(pluck(hz(m), 0.6, vel), t0 + b * beat)
            for b, vel in ((0, 0.5), (2, 0.4)):
                L.add(soft_kick(vel), t0 + b * beat)
            for b in (1, 3):
                L.add(rim(0.3), t0 + b * beat)
            for i in range(4):
                L.add(shaker(0.16), t0 + i * beat)
                L.add(shaker(0.28), t0 + (i + 0.58) * beat)
            ci = pick_cell(rr, cells, last)
            last = ci
            notes, cur = walk(rr, cur, penta_pool(72, 91), len(cells[ci]))
            for b, m in zip(cells[ci], notes):
                L.add(epiano(hz(m), 1.0, 0.45), t0 + b * beat)
    elif k == 'd':
        beat = 60.0 / 108
        L = Loop(8 * 4 * beat)                         # 17.8 s
        prog = ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G']
        motifs = [[[(0.5, 4), (1, 5), (1.5, 4), (2.5, 2), (3.25, 4)], [(0.5, 5), (1.5, 4), (2, 2), (3, 1)]],
                  [[(0, 3), (1, 4), (1.5, 5), (2.5, 6), (3.5, 5)], [(0.5, 4), (1, 2), (2, 3), (3, 0)]],
                  [[(0.5, 5), (1, 6), (1.5, 5), (2.5, 3), (3.25, 5)], [(0.5, 6), (1.5, 5), (2, 3), (3, 2)]],
                  [[(0, 2), (1, 3), (1.5, 4), (2.5, 5), (3.5, 4)], [(0.5, 3), (1, 1), (2, 2), (3, 0)]]]
        pent = penta_pool(72, 96)
        for bar, ch in enumerate(prog):
            t0 = bar * 4 * beat
            root = 36 + CHORDS[ch][0]
            for b, m, vel in ((0, root, 0.8), (0.75, root, 0.5), (1.5, root + 7, 0.6), (2.5, root, 0.7), (3.25, root + 7, 0.5)):
                L.add(pluck(hz(m), 0.5, vel), t0 + b * beat)
            for i in range(16):
                L.add(shaker(0.3 if i % 4 == 2 else (0.14 if i % 2 == 0 else 0.08)), t0 + i * beat / 4)
            for b, vel in ((0, 0.5), (2.5, 0.4)):
                L.add(soft_kick(vel), t0 + b * beat)
            for b in (1, 3):
                L.add(rim(0.25), t0 + b * beat)
            L.add(pad(voicing(ch), 4 * beat + 0.8, attack=0.4, release=0.8, vel=0.2), t0)
            for b, idx in motifs[bar // 2][bar % 2]:
                L.add(kalimba(hz(pent[min(idx, len(pent) - 1)]), 0.9, 0.7), t0 + b * beat)
    else:
        beat = 60.0 / 84
        L = Loop(8 * 4 * beat)                         # 22.9 s
        prog = ['C', 'Am', 'F', 'G', 'Em', 'Am', 'F', 'G']
        pats = [[0, 1, 2, 3, 2, 1, 2, 1], [1, 2, 3, 4, 3, 2, 1, 2]]
        for bar, ch in enumerate(prog):
            t0 = bar * 4 * beat
            L.add(pad(voicing(ch), 4 * beat + 1.4, attack=1.2, release=1.2, vel=0.9), t0)
            L.add(bass_note(36 + CHORDS[ch][0], 2.0, 0.4), t0)
            if bar % 2 == 0:
                L.add(soft_kick(0.25), t0)
            pool = chord_pool(ch, 72, 96)
            for i, idx in enumerate(pats[bar // 4]):
                L.add(glass(hz(pool[min(idx, len(pool) - 1)]), 1.8, 0.55 if i % 4 == 0 else 0.38), t0 + i * beat / 2)
            if bar % 4 == 0:
                L.add(bell(hz(bell_note(ch)), 3.0, 0.3), t0)
    return L.x


# ---------------------------------------------------------------- 2. get ready, C D E (4.2 s)
def kit2_getready(k):
    reseed(3150 + ord(k))
    B = Line(4.2)
    if k == 'c':                                       # three soft pops, then a seventh chord
        for i in range(3):
            B.add(pop(420 + 60 * i, 1100 + 150 * i, 0.14, 0.8), float(i))
        for i, m in enumerate((72, 76, 79, 83)):
            B.add(epiano(hz(m), 1.2, 0.7), 3.0 + i * 0.012)
        B.add(glass(hz(84), 1.2, 0.4), 3.0)
        B.add(soft_kick(0.7), 3.0)
    elif k == 'd':                                     # three wood knocks like a clock, then marimba and a bell
        for i in range(3):
            B.add(wood(hz(79), 0.3, 0.7 + 0.1 * i), float(i))
        for m in (79, 84):
            B.add(kmarimba(hz(m), 1.2, 0.9), 3.0)
        B.add(bell(hz(84), 1.2, 0.4), 3.0)
        B.add(soft_kick(0.7), 3.0)
    else:                                              # three glass notes climbing, then a glass chord
        for i, m in enumerate((84, 86, 88)):
            B.add(glass(hz(m), 1.0, 0.6 + 0.1 * i), float(i))
        B.add(pad([48, 55, 60, 64], 4.2, attack=3.0, release=0.8, vel=0.5))
        for m in (84, 88, 91):
            B.add(glass(hz(m), 1.2, 0.6), 3.0)
    return B.x


# ---------------------------------------------------------------- 3. question loop, C D E
def kit2_question(k, bpm=120):
    reseed(3200 + ord(k))
    rr = np.random.default_rng(3200 + ord(k))
    beat = 60.0 / bpm
    q = beat / 4
    L = Loop(8 * 4 * beat)
    cur = 79
    if k == 'c':
        prog = ['C', 'Am', 'F', 'G'] * 2
        for bar, ch in enumerate(prog):
            t0 = bar * 4 * beat
            root = 48 + CHORDS[ch][0]
            for b in range(4):
                L.add(woodtick(1300 if b % 2 == 0 else 980, 0.8 if b == 0 else 0.6), t0 + b * beat)
            for b, (m, vel) in enumerate(((root, 0.6), (root + 7, 0.4), (root, 0.5), (root + 7, 0.4))):
                L.add(pluck(hz(m), 0.4, vel), t0 + b * beat)
            L.add(epiano(hz(72 + CHORDS[ch][1]), 0.6, 0.4), t0 + 2 * beat)
    elif k == 'd':
        prog = ['C', 'C', 'Am', 'Am', 'F', 'F', 'G', 'G']
        cells = [[0, 3, 6, 10, 12], [0, 3, 6, 9, 12, 14]]
        for bar, ch in enumerate(prog):
            t0 = bar * 4 * beat
            root = 36 + CHORDS[ch][0]
            cell = cells[(bar // 4) % 2]
            notes, cur = walk(rr, cur, chord_pool(ch, 67, 91), len(cell))
            for p, m in zip(cell, notes):
                L.add(kmarimba(hz(m), 0.4, 0.8 if p == 0 else float(rr.uniform(0.45, 0.65))), t0 + p * q)
            for b in (1, 3):
                L.add(wood(hz(84), 0.2, 0.4), t0 + b * beat)
            L.add(pluck(hz(root), 0.4, 0.6), t0)
            L.add(pluck(hz(root), 0.4, 0.45), t0 + 2.5 * beat)
            for i in range(8):
                L.add(shaker(0.18), t0 + i * beat / 2 + q)
    else:
        prog = ['C', 'C', 'Am', 'Am', 'F', 'F', 'G', 'G']
        for bar, ch in enumerate(prog):
            t0 = bar * 4 * beat
            L.add(pad(voicing(ch, 60), 4 * beat + 0.6, attack=0.5, release=0.6, vel=0.5), t0)
            for i in range(8):
                L.add(hat(0.2 if i % 2 else 0.12), t0 + i * beat / 2)
            L.add(glass(hz(bell_note(ch) + 12), 1.2, 0.28), t0 + 2 * beat)
            if bar % 2 == 0:
                L.add(soft_kick(0.25), t0)
    return L.x


# ---------------------------------------------------------------- 4. last 5 seconds, C D E
def kit2_last5(k):
    """C replaces the loop (clock and heartbeat). D is a layer for the 1.5x loop (marimba trill). E replaces it (hat and glass pings)."""
    reseed(3300 + ord(k))
    B = Line(5.25)
    if k == 'c':
        t, n = 0.0, 0
        while t < 5.0:
            p = t / 5.0
            B.add(woodtick(1300 if n % 2 == 0 else 980, 0.55 + 0.45 * p), t)
            t += 0.5 * 0.28 ** p
            n += 1
        t = 0.0
        while t < 5.0:
            B.add(soft_kick(0.25 + 0.3 * t / 5.0), t)
            t += 0.9 * 0.33 ** (t / 5.0)
        B.add(pad([48, 55, 60, 64], 5.25, attack=5.0, release=0.25, vel=0.5))
    elif k == 'd':
        beat = 60.0 / 180
        pl = penta_pool(79, 96)
        for b in range(15):
            m = pl[min(int(b * len(pl) / 15), len(pl) - 1)]
            reps = 2 + int(3 * b / 14)
            for r in range(reps):
                B.add(kmarimba(hz(m), 0.25, 0.25 + 0.5 * b / 14), b * beat + r * beat / reps)
        t = 0.0
        while t < 5.0:
            B.add(hat(0.1 + 0.4 * t / 5.0), t)
            t += 1 / (6 + 20 * (t / 5.0) ** 2)
    else:
        t = 0.0
        while t < 5.0:
            p = t / 5.0
            B.add(hat(0.12 + 0.3 * p), t)
            t += 0.5 * 0.3 ** p
        for i, m in enumerate((84, 86, 88, 91, 93)):
            B.add(glass(hz(m), 1.3, 0.35 + 0.1 * i), float(i))
        B.add(pad([48, 55, 60, 64, 67], 5.25, attack=5.0, release=0.25, vel=0.7))
    return B.x


# ---------------------------------------------------------------- 5. time's up, C D E
def kit2_timesup(k):
    reseed(3400 + ord(k))
    B = Line(2.6)
    if k == 'c':                                       # one glassy strike
        B.add(glass(hz(72), 2.4, 1.0))
        B.add(glass(hz(79), 1.8, 0.35))
        B.add(soft_kick(0.7))
        B.add(pad([48, 55, 60], 2.4, attack=0.05, release=1.2, vel=0.4))
    elif k == 'd':                                     # two wooden knocks
        B.add(wood(hz(67), 0.5, 1.0))
        B.add(wood(hz(60), 0.7, 1.0), 0.22)
        B.add(soft_kick(0.3), 0.22)
        B.add(bass_note(36, 0.8, 0.3), 0.22)
    else:                                              # a falling glass phrase
        for i, m in enumerate((88, 86, 84, 83, 79)):
            B.add(glass(hz(m), 1.8 if i == 4 else 0.7, 0.8 - 0.05 * i), i * 0.14)
        B.add(pad([48, 55, 64], 2.0, attack=0.1, release=1.0, vel=0.4))
    return B.x


# ---------------------------------------------------------------- 6. answer reveal, C D E
def kit2_reveal(k):
    reseed(3500 + ord(k))
    B = Line(1.8)
    if k == 'c':                                       # an electric piano chord, strummed
        for i, m in enumerate((72, 76, 79, 83)):
            B.add(epiano(hz(m), 1.6, 0.7), i * 0.015)
        B.add(glass(hz(96), 1.2, 0.15), 0.05)
    elif k == 'd':                                     # a quick rising wood ripple
        for i, m in enumerate((79, 84, 88)):
            B.add(wood(hz(m), 0.4, 0.9), i * 0.08)
        B.add(shaker(0.3, 0.25), 0.16)
    else:                                              # a swell, then the strike
        B.add(swish(0.5, 0.5))
        for m in (84, 88, 91):
            B.add(glass(hz(m), 1.6, 0.6), 0.5)
        B.add(pad([60, 64, 67], 1.6, attack=0.1, release=0.9, vel=0.5), 0.5)
    return B.x


# ---------------------------------------------------------------- 7. scoreboard, C D E (the first 8 beats are the standings animation)
def kit2_scoreboard(k):
    reseed(3600 + ord(k))
    rr = np.random.default_rng(3600 + ord(k))
    bpm = {'c': 96, 'd': 100, 'e': 100}[k]
    beat = 60.0 / bpm
    q = beat / 4
    L = Loop(16 * beat)
    run = [72, 74, 76, 79, 81, 84, 86, 88]
    anim = 8 * beat
    if k == 'c':
        for i, m in enumerate(run):
            L.add(epiano(hz(m), 1.0, 0.35 + 0.65 * i / 7), i * beat)
    elif k == 'd':
        for i, m in enumerate(run):
            L.add(wood(hz(m), 0.35, 0.4 + 0.6 * i / 7), i * beat)
            L.add(kmarimba(hz(m), 0.7, 0.2 + 0.4 * i / 7), i * beat)
    else:
        pl = penta_pool(72, 96)
        for i in range(16):
            L.add(glass(hz(pl[int(i * (len(pl) - 1) / 15)]), 1.2, 0.3 + 0.5 * i / 15), i * beat / 2)
    t = 0.0
    while t < anim - 0.01:
        if k == 'e':
            L.add(hat(0.05 + 0.18 * t / anim), t)
            t += beat / 2
        else:
            L.add(shaker(0.1 + 0.5 * t / anim), t)
            t += (beat / 2) if t < anim / 2 else (beat / 4)
    L.add(pad(voicing('C'), anim + 0.6, attack=anim * 0.95, release=0.6, vel=0.6), 0.0)
    # beats 8 to 15
    if k == 'd':
        L.add(bell(hz(84), 2.4, 0.35), 8 * beat)
    else:
        L.add(glass(hz(84), 2.4, 0.4), 8 * beat)
    if k == 'c':
        for bar, ch in ((2, 'Fmaj7'), (3, 'G7')):
            tb = bar * 4 * beat
            root = 36 + CHORDS[ch][0]
            L.add(pad(voicing(ch), 4 * beat + 0.7, attack=0.1, release=0.7, vel=0.4), tb)
            for b, m, vel in ((0, root, 0.8), (1.58, root + 7, 0.5), (2.5, root + 12, 0.5)):
                L.add(pluck(hz(m), 0.6, vel), tb + b * beat)
            stab(L, ch, tb + 1.58 * beat, 60, 0.25, 0.8)
            stab(L, ch, tb + 3.58 * beat, 60, 0.2, 0.8)
            for b, vel in ((0, 0.6), (2, 0.5)):
                L.add(soft_kick(vel), tb + b * beat)
            for b in (1, 3):
                L.add(rim(0.3), tb + b * beat)
    elif k == 'd':
        cells = {2: [0.5, 1.5, 2, 3], 3: [0, 1, 2.5, 3.5]}
        pent = penta_pool(72, 96)
        for bar, ch in ((2, 'F'), (3, 'G')):
            tb = bar * 4 * beat
            root = 36 + CHORDS[ch][0]
            L.add(pad(voicing(ch), 4 * beat + 0.7, attack=0.1, release=0.7, vel=0.4), tb)
            for b, m, vel in ((0, root, 0.8), (0.75, root, 0.5), (1.5, root + 7, 0.6), (2.5, root, 0.7), (3.25, root + 7, 0.5)):
                L.add(pluck(hz(m), 0.5, vel), tb + b * beat)
            for i in range(16):
                L.add(shaker(0.3 if i % 4 == 2 else 0.12), tb + i * q)
            L.add(soft_kick(0.6), tb)
            L.add(soft_kick(0.5), tb + 2 * beat)
            for b in (1, 3):
                L.add(clap(0.35), tb + b * beat)
            notes, _ = walk(rr, 79, pent, len(cells[bar]))
            for b, m in zip(cells[bar], notes):
                L.add(kalimba(hz(m), 0.8, 0.65), tb + b * beat)
    else:
        for bar, ch in ((2, 'F'), (3, 'G')):
            tb = bar * 4 * beat
            L.add(pad(voicing(ch), 4 * beat + 0.8, attack=0.2, release=0.8, vel=0.8), tb)
            L.add(bass_note(36 + CHORDS[ch][0], 1.8, 0.5), tb)
            for i in range(8):
                L.add(hat(0.18 if i % 2 else 0.12), tb + i * beat / 2)
            L.add(glass(hz(bell_note(ch)), 2.0, 0.35), tb + 2 * beat)
    return L.x


# ---------------------------------------------------------------- 8. final drumroll, C D E
def kit2_drumroll(k, dur=3.4):
    reseed(3700 + ord(k))
    rr = np.random.default_rng(3700 + ord(k))
    B = Line(dur + 0.7)
    if k == 'c':                                       # a clock racing: ticks alternate and accelerate
        t, n = 0.0, 0
        while t < dur - 0.04:
            p = t / dur
            B.add(woodtick(1300 if n % 2 == 0 else 980, 0.15 + 0.75 * p ** 1.2), t)
            t += 1 / (6 + 14 * p) * float(rr.uniform(0.96, 1.04))
            n += 1
        B.add(pad(voicing('G'), dur + 0.5, attack=dur, release=0.4, vel=0.6))
        B.add(soft_kick(1.0), dur)
        B.add(rim(1.0), dur)
    elif k == 'd':                                     # a riser: noise swell and hats, no drum head
        tt = t_(dur + 0.3)
        sw = np.zeros_like(tt)
        for i, (lo, hi) in enumerate(((2500, 4500), (4500, 7000), (7000, 10000), (10000, 15000))):
            env = np.clip(tt / dur - 0.2 * i, 0, 1) ** 2 * 0.3
            sw += noise_band(len(tt), lo, hi) * env
        B.add(sw)
        t = 0.0
        while t < dur - 0.04:
            B.add(hat(0.1 + 0.5 * (t / dur) ** 1.3), t)
            t += 1 / (12 + 20 * t / dur)
        B.add(pad(voicing('G'), dur + 0.5, attack=dur, release=0.4, vel=0.5))
        B.add(soft_kick(1.0), dur)
        B.add(clap(0.9), dur)
    else:                                              # a melodic build: glass notes climbing and speeding up
        pl = penta_pool(67, 96)
        t, i = 0.0, 0
        n_est = int(dur * 8)
        while t < dur - 0.04:
            p = t / dur
            B.add(glass(hz(pl[min(int(p * (len(pl) - 1)), len(pl) - 1)]), 0.6, 0.2 + 0.6 * p), t)
            t += 0.3 * 0.25 ** p
            i += 1
        B.add(pad(voicing('G'), dur + 0.5, attack=dur, release=0.4, vel=0.6))
        for m in (84, 88, 91):
            B.add(glass(hz(m), 1.4, 0.6), dur)
        B.add(soft_kick(0.9), dur)
    return B.x


# ---------------------------------------------------------------- 9. place hits, C D E
def kit2_place(k, place):
    reseed(3800 + ord(k) * 10 + place)
    B = Line(2.5)
    if k == 'c':                                       # electric piano: one note, a dyad, a seventh chord
        if place == 3:
            B.add(epiano(hz(67), 1.2, 0.8))
        elif place == 2:
            B.add(epiano(hz(72), 1.4, 0.7))
            B.add(epiano(hz(76), 1.4, 0.6))
            B.add(soft_kick(0.5))
        else:
            for i, m in enumerate((60, 67, 71, 76, 79)):
                B.add(epiano(hz(m), 2.2, 0.7), i * 0.012)
            B.add(glass(hz(84), 2.2, 0.4))
            B.add(soft_kick(1.0))
            B.add(pad(voicing('Cmaj7'), 2.4, attack=0.05, release=1.2, vel=0.5))
    elif k == 'd':                                     # wood: one knock, two knocks, three knocks and a chord
        if place == 3:
            B.add(wood(hz(67), 0.6, 1.0))
        elif place == 2:
            B.add(wood(hz(67), 0.5, 0.9))
            B.add(wood(hz(72), 0.7, 1.0), 0.12)
            B.add(soft_kick(0.5), 0.12)
        else:
            for i, m in enumerate((67, 72, 79)):
                B.add(wood(hz(m), 0.6, 0.9), i * 0.1)
            for m in (60, 67, 72, 76, 79):
                B.add(kmarimba(hz(m), 2.2, 0.8), 0.3)
            B.add(soft_kick(1.0), 0.3)
            B.add(bell(hz(84), 2.2, 0.4), 0.3)
    else:                                              # glass: one note, two notes, a chord with a bloom
        if place == 3:
            B.add(glass(hz(79), 1.6, 0.8))
        elif place == 2:
            B.add(glass(hz(84), 1.8, 0.8))
            B.add(glass(hz(88), 1.8, 0.6))
        else:
            for m in (84, 88, 91, 95):
                B.add(glass(hz(m), 2.4, 0.6))
            B.add(pad(voicing('C'), 2.4, attack=0.06, release=1.2, vel=0.75))
            B.add(soft_kick(0.9))
    return B.x


# ---------------------------------------------------------------- 10. winner fanfare, C D E
def kit2_fanfare(k):
    """All three land on a C major chord at t = 0."""
    reseed(3900 + ord(k))
    B = Line(5.6)
    if k == 'c':                                       # a single big chord, then a pad swell blooming under it
        for i, m in enumerate((48, 60, 64, 67, 71, 76)):
            B.add(epiano(hz(m), 3.2, 0.75), i * 0.01)
        B.add(glass(hz(84), 3.4, 0.5))
        for m in (48, 60, 64, 67):
            B.add(soft_brass(hz(m), 1.0, 0.25))
        B.add(soft_kick(0.9))
        B.add(pad(voicing('Cmaj7') + [76], 5.4, attack=1.2, release=2.0, vel=0.9))
        tt = t_(2.0)
        B.add(noise_band(len(tt), 5000, 13000) * np.exp(-((tt - 0.9) / 0.5) ** 2) * 0.12)
    elif k == 'd':                                     # a bell chorale: four soft chords, the last one biggest
        for t, ch, g in ((0.0, 'C', 0.7), (0.95, 'F', 0.55), (1.9, 'G', 0.6), (2.85, 'C', 0.85)):
            for r in CHORDS[ch][:3] + (CHORDS[ch][0] + 12,):
                B.add(bell(hz(60 + r + 12), 2.4, g * 0.7), t)
            B.add(bell(hz(48 + CHORDS[ch][0]), 2.6, g * 0.5), t)
        B.add(pad([48, 55, 60, 64, 67], 5.2, attack=0.05, release=2.0, vel=0.6))
        B.add(soft_kick(0.9))
        B.add(soft_kick(1.0), 2.85)
    else:                                              # a shimmer: a chord, then a cascade rising two octaves over it
        for m in (48, 60, 64, 67, 72):
            B.add(kalimba(hz(m), 1.6, 0.8))
        B.add(glass(hz(84), 3.4, 0.5))
        B.add(pad([48, 55, 60, 64, 67], 5.2, attack=0.02, release=2.2, vel=0.7))
        B.add(soft_kick(0.9))
        pl = penta_pool(72, 96)
        for i, m in enumerate(pl + pl[-3:]):
            B.add(kalimba(hz(m + 0), 0.9, 0.4 + 0.3 * i / len(pl)), 0.15 + 0.1 * i)
        B.add(glass(hz(96), 2.6, 0.45), 1.4)
    return B.x


# ---------------------------------------------------------------- 11. calm loop, C D E (80 BPM, 8 bars, 24 s)
def kit2_calm(k):
    reseed(4000 + ord(k))
    rr = np.random.default_rng(4000 + ord(k))
    beat = 60.0 / 80
    L = Loop(8 * 4 * beat)
    cur = 76
    if k == 'c':
        prog = ['Cmaj7', 'Am7', 'Fmaj7', 'G7', 'Cmaj7', 'Am7', 'Dm7', 'G7']
        for bar, ch in enumerate(prog):
            t0 = bar * 4 * beat
            L.add(pad(voicing(ch), 4 * beat + 1.0, attack=0.8, release=1.0, vel=0.3), t0)
            L.add(pluck(hz(36 + CHORDS[ch][0]), 1.4, 0.5), t0)
            for i, r in enumerate(CHORDS[ch][:4]):
                L.add(epiano(hz(60 + r + (12 if i >= 2 else 0)), 1.4, 0.38), t0 + i * beat)
    elif k == 'd':
        prog = ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G']
        for bar, ch in enumerate(prog):
            t0 = bar * 4 * beat
            L.add(pad(voicing(ch), 4 * beat + 1.0, attack=0.8, release=1.0, vel=0.4), t0)
            L.add(bass_note(36 + CHORDS[ch][0], 1.6, 0.5), t0)
            for b in range(4):
                L.add(woodtick(1300 if b % 2 == 0 else 980, 0.16), t0 + b * beat)
            for b, r in ((1, CHORDS[ch][1]), (3, CHORDS[ch][2])):
                L.add(kmarimba(hz(72 + r), 0.9, 0.4), t0 + b * beat)
    else:
        prog = ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G']
        for bar, ch in enumerate(prog):
            t0 = bar * 4 * beat
            L.add(pad(voicing(ch), 4 * beat + 1.2, attack=1.0, release=1.2, vel=0.9), t0)
            L.add(bass_note(36 + CHORDS[ch][0], 2.0, 0.35), t0)
            notes, cur = walk(rr, cur, penta_pool(72, 91), 2)
            L.add(glass(hz(notes[0]), 2.0, 0.35), t0)
            L.add(glass(hz(notes[1]), 2.0, 0.3), t0 + 2 * beat)
            if bar % 4 == 0:
                L.add(bell(hz(91), 2.4, 0.22), t0)
    return L.x


# ---------------------------------------------------------------- 12-14. phone, C D E
def kit2_locked(k):
    reseed(4100 + ord(k))
    B = Line(0.5)
    if k == 'c':
        B.add(pop(420, 1100, 0.14, 0.9))
    elif k == 'd':
        B.add(woodtick(1500, 0.8))
        B.add(kmarimba(hz(84), 0.3, 0.35))
    else:
        B.add(pop(900, 2100, 0.18, 0.7))
        B.add(glass(hz(91), 0.4, 0.3), 0.03)
    return B.x


def kit2_correct(k):
    reseed(4200 + ord(k))
    B = Line(1.2)
    if k == 'c':                                       # a pop, then a seventh chord
        B.add(pop(420, 1100, 0.14, 0.8))
        for i, m in enumerate((72, 76, 79, 83)):
            B.add(epiano(hz(m), 1.0, 0.45), 0.08 + i * 0.01)
    elif k == 'd':                                     # a chirp, then one marimba note
        B.add(pop(700, 1900, 0.09, 0.8))
        B.add(kmarimba(hz(88), 0.6, 0.8), 0.09)
    else:                                              # a single glass strike with a shimmer
        B.add(glass(hz(84), 1.1, 0.9))
        B.add(pad([72, 79], 1.1, attack=0.02, release=0.7, vel=0.3))
    return B.x


def kit2_incorrect(k):
    reseed(4300 + ord(k))
    B = Line(1.0)
    if k == 'c':                                       # two soft electric piano notes falling
        for t0, m in ((0.0, 64), (0.2, 60)):
            B.add(lowpass_fft(epiano(hz(m), 0.7, 0.8), 1300), t0)
    elif k == 'd':                                     # two low wood knocks
        for t0 in (0.0, 0.22):
            B.add(lowpass_fft(wood(hz(57), 0.3, 0.9), 900), t0)
    else:                                              # one muffled glass note over a low note
        B.add(lowpass_fft(glass(hz(67), 1.0, 0.8), 1400))
        B.add(bass_note(43, 0.6, 0.3))
    return B.x


for _k in 'cde':
    KIT_ITEMS += [
        (f'lobby-{_k}', lambda k=_k: kit2_lobby(k), 'loop'),
        (f'getready-{_k}', lambda k=_k: kit2_getready(k), 'sting'),
        (f'question-{_k}', lambda k=_k: kit2_question(k, 120), 'loop'),
        (f'question-{_k}-15x', lambda k=_k: kit2_question(k, 180), 'loop'),
        (f'last5-{_k}', lambda k=_k: kit2_last5(k), 'sting'),
        (f'timesup-{_k}', lambda k=_k: kit2_timesup(k), 'sting'),
        (f'reveal-{_k}', lambda k=_k: kit2_reveal(k), 'sting'),
        (f'scoreboard-{_k}', lambda k=_k: kit2_scoreboard(k), 'loop'),
        (f'drumroll-{_k}', lambda k=_k: kit2_drumroll(k, 3.4), 'sting'),
        (f'drumroll-{_k}-2.6s', lambda k=_k: kit2_drumroll(k, 2.6), 'sting'),
        (f'place3-{_k}', lambda k=_k: kit2_place(k, 3), 'sting'),
        (f'place2-{_k}', lambda k=_k: kit2_place(k, 2), 'sting'),
        (f'place1-{_k}', lambda k=_k: kit2_place(k, 1), 'sting'),
        (f'fanfare-{_k}', lambda k=_k: kit2_fanfare(k), 'sting'),
        (f'calm-{_k}', lambda k=_k: kit2_calm(k), 'loop'),
        (f'locked-{_k}', lambda k=_k: kit2_locked(k), 'sting'),
        (f'correct-{_k}', lambda k=_k: kit2_correct(k), 'sting'),
        (f'incorrect-{_k}', lambda k=_k: kit2_incorrect(k), 'sting'),
    ]



# ============================================================================================
# Kit C refinements: C1, C2, C3. The whole C kit again (lo-fi keys, soft swing), lower and warmer.
#   C1  lower and warmer: leads, chords and stings moved down (mostly C3 to C5), a gentle low-pass on keys and
#       stings, more body in the low mids, softer transients. Groove as C (simple bass, soft kick, rim).
#   C2  warm and funky: C1's register plus a funk groove: syncopated plucked bass with ghost notes, muted
#       clavinet-like stabs on the swung offbeats, tight kick and snare with ghost notes, 16th shaker.
#   C3  between: C1's warmth with half of C2's funk (lighter bass syncopation, fewer stabs, one ghost snare).
# Register: the whole kit sits about an octave below kit C: leads and keys are centred around C4 and below (C3 to C5),
# stings and phone sounds are pitched lower, the ticks are lower too. Upper harmonics are kept (2nd and 3rd partials
# lifted on the keys, low-pass at 2.4 to 2.8 kHz) so small speakers still carry the low notes.
# Bass stays phone-audible: every bass note is E2 (82 Hz) or higher, with its 2nd and 3rd partials lifted.
# Swing: the swung 8th lands at 58% (C1), 60% (C3), 62% (C2) of the beat; 16ths are swung inside each half.
# ============================================================================================
KC = {
    'c1': dict(funk=0.0, swing=0.58, lobby_bpm=96, score_bpm=96, lp=3000, slope=1000, soft=1.0),
    'c3': dict(funk=0.5, swing=0.60, lobby_bpm=100, score_bpm=100, lp=3200, slope=1100, soft=0.9),
    'c2': dict(funk=1.0, swing=0.62, lobby_bpm=105, score_bpm=100, lp=3400, slope=1200, soft=0.8),
}
KC_PROG = {
    'c1': ['Cmaj7', 'Am7', 'Fmaj7', 'G7', 'Cmaj7', 'Em7', 'Fmaj7', 'G7'],
    'c3': ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Cmaj7', 'Em7', 'Fmaj7', 'G7'],
    'c2': ['Dm7', 'G7', 'Cmaj7', 'Am7', 'Dm7', 'G7', 'Cmaj7', 'G7'],
}
# patterns on a 16th grid (0 to 15 in a bar); (position, interval from the root, velocity, ghost?)
KC_BASS = {
    0.0: [(0, 0, 0.8, 0), (6, 7, 0.5, 0), (10, 12, 0.5, 0)],
    0.5: [(0, 0, 0.85, 0), (6, 7, 0.55, 0), (8, 0, 0.6, 0), (11, 0, 0.2, 1), (14, 7, 0.45, 0)],
    1.0: [(0, 0, 0.9, 0), (2, 0, 0.2, 1), (3, 12, 0.45, 0), (5, 0, 0.2, 1), (6, 7, 0.6, 0), (8, 0, 0.75, 0),
          (10, 'b7', 0.55, 0), (11, 0, 0.2, 1), (13, 0, 0.2, 1), (14, 7, 0.5, 0)],
}
KC_KICK = {0.0: [(0, 0.5), (8, 0.4)], 0.5: [(0, 0.55), (10, 0.4)], 1.0: [(0, 0.6), (6, 0.35), (10, 0.5)]}
KC_SNARE = {0.0: [], 0.5: [(4, 0.3), (12, 0.3), (15, 0.09)], 1.0: [(4, 0.4), (12, 0.4), (7, 0.12), (9, 0.1), (15, 0.12)]}
KC_RIM = {0.0: [(4, 0.25), (12, 0.25)], 0.5: [], 1.0: []}
KC_CLAV = {0.0: [], 0.5: [(6, 0.4), (13, 0.4)], 1.0: [(3, 0.5), (6, 0.4), (10, 0.5), (11, 0.3), (13, 0.4)]}
KC_COMP = {0.0: [(0, 0.22, 1.6), (6, 0.14, 0.7)], 0.5: [(0, 0.2, 1.4), (6, 0.12, 0.6)], 1.0: [(0, 0.15, 1.2)]}
KC_CELLS = {0.0: [[2, 6, 10], [0, 4, 10, 14], [6, 12], [0, 8, 10, 14]],
            0.5: [[2, 6, 10], [0, 7, 10, 14], [6, 12], [3, 8, 14]],
            1.0: [[2, 7, 11], [3, 10, 14], [6, 13], [0, 5, 10]]}


def kc_t(p, pos, beat):
    """Seconds from the bar start of a 16th position, with swing: the second 8th of a beat lands at p['swing'] of it."""
    b, r = divmod(pos, 4)
    s = p['swing']
    return (b + (0.0, s / 2, s, s + (1 - s) / 2)[r]) * beat


def kc_root(ch):
    m = 36 + CHORDS[ch][0]
    return m + 12 if m < 40 else m


def kc_b7(ch):
    return 10 if ch in ('Am7', 'Dm7', 'Em7', 'G7') else 7


def epiano_w(f, dur=1.2, vel=1.0, bark=0.1, attack=0.008):
    """A warmer, softer electric piano: lower FM index, a touch of 2nd partial, a slower attack and almost no bark."""
    t = t_(dur)
    lift = float(np.clip((330.0 / f) ** 1.2, 1.0, 3.5))     # the lower the note, the more upper harmonics, so small speakers still carry it
    idx = (1.8 * np.exp(-t / 0.25) + 0.35) * lift ** 0.7
    s = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t)) * np.exp(-t / 1.0)
    s += lift * (0.35 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / 0.5) + 0.2 * np.sin(2 * np.pi * f * 3 * t) * np.exp(-t / 0.3)
                 + 0.1 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t / 0.2))
    s += bark * np.sin(2 * np.pi * f * 7.0 * t) * np.exp(-t / 0.05)
    k = int(attack * SR)
    s[:k] *= np.linspace(0, 1, k)
    s *= np.clip(1 - (t - (dur - 0.08)) / 0.08, 0, 1)
    return vel * s / 1.5


def clav(f, dur=0.12, vel=1.0):
    """A muted clavinet-like stab: saw partials that die fast, a short pick."""
    t = t_(dur)
    s = np.zeros_like(t)
    for k in range(1, 8):
        s += (1.0 / k) * np.sin(2 * np.pi * f * k * t + 0.5 * k) * np.exp(-t / (0.09 / k ** 0.6))
    n = int(0.001 * SR)
    s[:n] *= np.linspace(0, 1, n)
    s *= np.clip(1 - (t - (dur - 0.02)) / 0.02, 0, 1)
    return vel * s / 1.8


def kpluck(m, dur=0.3, vel=1.0):
    """The kit's bass pluck with its 2nd and 3rd partials lifted so it reads on a phone speaker."""
    f = hz(m)
    t = t_(dur)
    s = np.zeros_like(t)
    for k in range(1, 9):
        s += (1.8 if k in (2, 3) else 1.0) * (1.0 / k) * np.sin(2 * np.pi * f * k * t) * np.exp(-t / (0.35 / k + 0.03))
    n = int(0.005 * SR)
    s[:n] *= np.linspace(0, 1, n)
    s *= np.clip(1 - (t - (dur - 0.04)) / 0.04, 0, 1)
    return MIXG['bass'] * 0.55 * vel * s


def kc_bass(L, ch, t0, beat, p, pattern, scale=1.0):
    root = kc_root(ch)
    for pos, iv, vel, ghost in pattern:
        m = root + (kc_b7(ch) if iv == 'b7' else iv)
        L.add(kpluck(m, 0.07 if ghost else (0.12 if iv == 12 else 0.3), vel * scale), t0 + kc_t(p, pos, beat))


def kc_sat(x, drive=1.7):
    """Mild tape-style saturation: adds odd harmonics to low notes so they read on small speakers. Memoryless, so a loop's wrap is untouched."""
    ref = 0.6 * (np.max(np.abs(x)) + 1e-9)
    return np.tanh(drive * x / ref) * ref / np.tanh(drive)


def kc_lp(x, p):
    return lowpass_fft(kc_sat(x), p['lp'], p['slope'])


def kc_stab(K, ch, t, vel, dur=1.4, base=48):
    for r in CHORDS[ch][:4]:
        K.add(epiano_w(hz(base + r), dur, vel), t)


def kc_clav(K, ch, t, vel, base=48):
    for r in CHORDS[ch][1:4]:
        K.add(clav(hz(base + r), 0.1, vel), t)


def kc_drums(L, p, f, t0, beat, shaker_g=1.0):
    for pos, vel in KC_KICK[f]:
        L.add(soft_kick(vel * 0.9), t0 + kc_t(p, pos, beat))
    for pos, vel in KC_SNARE[f]:
        L.add(brush(vel, 0.15), t0 + kc_t(p, pos, beat))
    for pos, vel in KC_RIM[f]:
        L.add(rim(vel * p['soft']), t0 + kc_t(p, pos, beat))
    for pos in range(16):
        r = pos % 4
        if r == 0:
            v = 0.12
        elif r == 2:
            v = 0.24
        else:
            v = 0.07 if f >= 1.0 else (0.05 if (f >= 0.5 and r == 3) else 0.0)
        if v:
            L.add(shaker(v * p['soft'] * shaker_g), t0 + kc_t(p, pos, beat))


# ---------------------------------------------------------------- 1. lobby (8 bars)
def kc_lobby(k):
    p = KC[k]
    f = p['funk']
    seed = 5000 + int(k[1])
    reseed(seed)
    rr = np.random.default_rng(seed)
    beat = 60.0 / p['lobby_bpm']
    L, K = Loop(8 * 4 * beat), Loop(8 * 4 * beat)
    cells = KC_CELLS[f]
    cur, last = 60, -1
    for bar, ch in enumerate(KC_PROG[k]):
        t0 = bar * 4 * beat
        L.add(pad(voicing(ch), 4 * beat + 0.9, attack=0.5, release=0.9, vel=0.14, bright=1.0), t0)
        kc_bass(L, ch, t0, beat, p, KC_BASS[f])
        kc_drums(L, p, f, t0, beat)
        for pos, vel, dur in KC_COMP[f]:
            kc_stab(K, ch, t0 + kc_t(p, pos, beat), vel, dur)
        for pos, vel in KC_CLAV[f]:
            kc_clav(K, ch, t0 + kc_t(p, pos, beat), vel)
        ci = pick_cell(rr, cells, last)
        last = ci
        notes, cur = walk(rr, cur, penta_pool(50, 74), len(cells[ci]))
        for pos, m in zip(cells[ci], notes):
            K.add(epiano_w(hz(m), 1.0, 0.6), t0 + kc_t(p, pos, beat))
    return L.x + kc_lp(K.x, p)


# ---------------------------------------------------------------- 2. get ready (4.2 s)
def kc_getready(k):
    p = KC[k]
    f = p['funk']
    reseed(5100 + int(k[1]))
    B, K = Line(4.2), Line(4.2)
    if k == 'c2':                                      # three muted clav plinks, then a chord with a tight kick
        for i, m in enumerate((55, 57, 59)):
            K.add(clav(hz(m), 0.12, 0.7 + 0.1 * i), float(i))
            B.add(shaker(0.3), float(i))
    else:                                              # three soft pops, lower
        for i in range(3):
            B.add(lowpass_fft(pop(220 + 30 * i, 560 + 80 * i, 0.14, 0.8 if k == 'c1' else 0.7), 2000), float(i))
    for i, m in enumerate((48, 55, 59, 64)):
        K.add(epiano_w(hz(m), 1.2, 0.7), 3.0 + i * 0.012)
    K.add(glass(hz(60), 1.2, 0.3), 3.0)
    if f >= 0.5:
        kc_clav(K, 'Cmaj7', 3.0, 0.5 if f >= 1.0 else 0.35)
    B.add(soft_kick(0.7), 3.0)
    if f >= 1.0:
        B.add(brush(0.25, 0.15), 3.0)
    n2 = max(len(B.x), len(K.x))
    return np.pad(B.x, (0, n2 - len(B.x))) + np.pad(kc_lp(K.x, p), (0, n2 - len(K.x)))


# ---------------------------------------------------------------- 3. question loop (120 BPM, 8 bars; bpm=180 for 1.5x)
def kc_question(k, bpm=120):
    p = KC[k]
    f = p['funk']
    seed = 5200 + int(k[1])
    reseed(seed)
    beat = 60.0 / bpm
    L, K = Loop(8 * 4 * beat), Loop(8 * 4 * beat)
    prog = ['Cmaj7', 'Am7', 'Fmaj7', 'G7'] * 2
    pat = {0.0: [(0, 0, 0.6, 0), (4, 7, 0.4, 0), (8, 0, 0.5, 0), (12, 7, 0.4, 0)],
           0.5: [(0, 0, 0.7, 0), (6, 7, 0.45, 0), (8, 0, 0.55, 0), (11, 0, 0.18, 1), (14, 7, 0.4, 0)],
           1.0: KC_BASS[1.0]}[f]
    for bar, ch in enumerate(prog):
        t0 = bar * 4 * beat
        L.add(pad(voicing(ch), 4 * beat + 0.6, attack=0.4, release=0.6, vel=0.12, bright=1.0), t0)
        for b in range(4):
            L.add(woodtick(700 if b % 2 == 0 else 520, (0.8 if b == 0 else 0.6) * p['soft']), t0 + b * beat)
        kc_bass(L, ch, t0, beat, p, pat, 0.9)
        if f == 0.0:
            K.add(epiano_w(hz(48 + CHORDS[ch][1] % 12), 0.6, 0.45), t0 + 2 * beat)
        else:
            for pos, vel in ({0.5: [(6, 0.35), (13, 0.35)], 1.0: [(3, 0.45), (6, 0.35), (10, 0.45), (13, 0.35)]}[f]):
                kc_clav(K, ch, t0 + kc_t(p, pos, beat), vel)
            K.add(epiano_w(hz(48 + CHORDS[ch][1] % 12), 0.6, 0.35), t0 + 2 * beat)
            for i in range(8):
                L.add(shaker((0.2 if i % 2 else 0.1) * p['soft']), t0 + (i * 0.5 + (0.0 if i % 2 == 0 else p['swing'] - 0.5)) * beat)
    return L.x + kc_lp(K.x, p)


# ---------------------------------------------------------------- 4. last 5 seconds (replaces the loop, 5.25 s)
def kc_last5(k):
    p = KC[k]
    f = p['funk']
    reseed(5300 + int(k[1]))
    B, K = Line(5.25), Line(5.25)
    t, n = 0.0, 0
    while t < 5.0:
        pr = t / 5.0
        B.add(woodtick(700 if n % 2 == 0 else 520, (0.55 + 0.45 * pr) * p['soft']), t)
        t += 0.5 * 0.28 ** pr
        n += 1
    t = 0.0
    kicks = []
    while t < 5.0:
        B.add(soft_kick(0.25 + 0.3 * t / 5.0), t)
        kicks.append(t)
        t += 0.9 * 0.33 ** (t / 5.0)
    B.add(pad([48, 52, 55, 59], 5.25, attack=5.0, release=0.25, vel=0.4, bright=1.0))
    if f >= 1.0:                                       # bass climbs with the heartbeat, clav hits in the last 2 s
        steps = (48, 50, 52, 55, 57, 60, 62, 64)
        for i, tk in enumerate(kicks):
            B.add(kpluck(steps[min(i, len(steps) - 1)], 0.15, 0.5), tk)
        tt = 3.0
        while tt < 5.0:
            kc_clav(K, 'Cmaj7', tt, 0.3 + 0.3 * (tt - 3.0) / 2)
            tt += 0.25
    elif f >= 0.5:
        tt = 3.5
        while tt < 5.0:
            kc_clav(K, 'Cmaj7', tt, 0.3 + 0.2 * (tt - 3.5) / 1.5)
            tt += 0.25
    n2 = max(len(B.x), len(K.x))
    return kc_sat(np.pad(B.x, (0, n2 - len(B.x))) + np.pad(kc_lp(K.x, p), (0, n2 - len(K.x))), 1.4)


# ---------------------------------------------------------------- 5. time's up
def kc_timesup(k):
    p = KC[k]
    reseed(5400 + int(k[1]))
    B, K = Line(2.6), Line(2.6)
    if k == 'c1':                                      # one low glassy strike
        K.add(glass(hz(60), 2.4, 1.0))
        K.add(glass(hz(67), 1.8, 0.35))
        B.add(soft_kick(0.7))
        B.add(pad([48, 55, 60], 2.4, attack=0.05, release=1.2, vel=0.45))
    elif k == 'c2':                                    # a funky drop: stab, falling bass, tight kick
        kc_clav(K, 'Cmaj7', 0.0, 0.7)
        B.add(kpluck(55, 0.25, 0.8))
        B.add(kpluck(48, 0.6, 0.9), 0.2)
        B.add(soft_kick(0.6), 0.2)
        for i, m in enumerate((48, 52, 55, 59)):
            K.add(epiano_w(hz(m), 1.4, 0.4), 0.2 + i * 0.01)
    else:                                              # two soft keys falling, a kick
        for t0, m in ((0.0, 55), (0.2, 52)):
            K.add(epiano_w(hz(m), 1.4 if t0 else 0.6, 0.8), t0)
        K.add(glass(hz(60), 1.6, 0.3), 0.2)
        B.add(soft_kick(0.5), 0.2)
        B.add(pad([48, 55, 60], 2.0, attack=0.05, release=1.0, vel=0.4))
    n2 = max(len(B.x), len(K.x))
    return np.pad(B.x, (0, n2 - len(B.x))) + np.pad(kc_lp(K.x, p), (0, n2 - len(K.x)))


# ---------------------------------------------------------------- 6. answer reveal
def kc_reveal(k):
    p = KC[k]
    f = p['funk']
    reseed(5500 + int(k[1]))
    B, K = Line(1.8), Line(1.8)
    for i, m in enumerate((52, 59, 64, 67)):           # a strummed Cmaj7, spread low
        K.add(epiano_w(hz(m), 1.6, 0.7), (0.02 if f >= 1.0 else 0.0) + i * 0.015)
    K.add(glass(hz(72), 1.2, 0.12), 0.05)
    if f >= 1.0:
        kc_clav(K, 'Cmaj7', 0.0, 0.6)
        B.add(shaker(0.3, 0.25), 0.16)
    elif f >= 0.5:
        K.add(clav(hz(67), 0.1, 0.4), 0.12)
    n2 = max(len(B.x), len(K.x))
    return np.pad(B.x, (0, n2 - len(B.x))) + np.pad(kc_lp(K.x, p), (0, n2 - len(K.x)))


# ---------------------------------------------------------------- 7. scoreboard (4 bars; the first 8 beats are the animation)
def kc_scoreboard(k):
    p = KC[k]
    f = p['funk']
    reseed(5600 + int(k[1]))
    beat = 60.0 / p['score_bpm']
    L, K = Loop(16 * beat), Loop(16 * beat)
    anim = 8 * beat
    for i, m in enumerate((48, 50, 52, 55, 57, 60, 64, 67)):         # C3 up to G4
        K.add(epiano_w(hz(m), 1.0, 0.35 + 0.65 * i / 7), i * beat)
    t = 0.0
    while t < anim - 0.01:
        L.add(shaker((0.1 + 0.5 * t / anim) * p['soft']), t)
        t += (beat / 2) if t < anim / 2 else (beat / 4)
    L.add(pad(voicing('C'), anim + 0.6, attack=anim * 0.95, release=0.6, vel=0.3, bright=1.0), 0.0)
    K.add(glass(hz(60), 2.4, 0.35), 8 * beat)
    for bar, ch in ((2, 'Fmaj7'), (3, 'G7')):
        tb = bar * 4 * beat
        L.add(pad(voicing(ch), 4 * beat + 0.7, attack=0.1, release=0.7, vel=0.2, bright=1.0), tb)
        kc_bass(L, ch, tb, beat, p, KC_BASS[f])
        kc_drums(L, p, f, tb, beat)
        if f == 0.0:
            kc_stab(K, ch, tb + kc_t(p, 6, beat), 0.25, 0.8)
            kc_stab(K, ch, tb + kc_t(p, 14, beat), 0.2, 0.8)
        else:
            for pos, vel in KC_CLAV[f]:
                kc_clav(K, ch, tb + kc_t(p, pos, beat), vel)
            kc_stab(K, ch, tb, 0.22, 1.2)
    return L.x + kc_lp(K.x, p)


# ---------------------------------------------------------------- 8. final drumroll (stops on a beat at t = dur)
def kc_drumroll(k, dur=3.4):
    p = KC[k]
    f = p['funk']
    reseed(5700 + int(k[1]))
    rr = np.random.default_rng(5700 + int(k[1]))
    B, K = Line(dur + 0.7), Line(dur + 0.7)
    t, n = 0.0, 0
    while t < dur - 0.04:
        pr = t / dur
        B.add(woodtick(700 if n % 2 == 0 else 520, (0.15 + 0.75 * pr ** 1.2) * p['soft']), t)
        t += 1 / (6 + 14 * pr) * float(rr.uniform(0.96, 1.04))
        n += 1
    if f >= 0.5:                                       # ghost snares crescendo
        g = 1.0 if f >= 1.0 else 0.6
        t = 0.0
        while t < dur - 0.04:
            pr = t / dur
            B.add(brush(g * (0.04 + 0.3 * pr ** 2), 0.12), t)
            t += 1 / (12 + 12 * pr)
    B.add(pad(voicing('G'), dur + 0.5, attack=dur, release=0.4, vel=0.55))
    B.add(soft_kick(1.0), dur)
    if f >= 1.0:
        B.add(brush(0.9, 0.2), dur)
        kc_clav(K, 'Cmaj7', dur, 0.7)
        B.add(kpluck(48, 0.5, 0.9), dur)
    elif f >= 0.5:
        B.add(rim(0.8), dur)
        K.add(clav(hz(64), 0.1, 0.5), dur)
    else:
        B.add(rim(0.8 * p['soft']), dur)
    n2 = max(len(B.x), len(K.x))
    return kc_sat(np.pad(B.x, (0, n2 - len(B.x))) + np.pad(kc_lp(K.x, p), (0, n2 - len(K.x))), 1.4)


# ---------------------------------------------------------------- 9. podium place hits
def kc_place(k, place):
    p = KC[k]
    f = p['funk']
    reseed(5800 + int(k[1]) * 10 + place)
    B, K = Line(2.5), Line(2.5)
    if place == 3:
        K.add(epiano_w(hz(55), 1.2, 0.8))
        if f >= 1.0:
            K.add(clav(hz(62), 0.1, 0.4), 0.0)
    elif place == 2:
        K.add(epiano_w(hz(60), 1.4, 0.7))
        K.add(epiano_w(hz(64), 1.4, 0.6))
        B.add(soft_kick(0.45))
        if f >= 1.0:
            kc_clav(K, 'Cmaj7', 0.0, 0.4)
    else:
        for i, m in enumerate((48, 55, 59, 64, 67)):
            K.add(epiano_w(hz(m), 2.2, 0.7), i * 0.012)
        K.add(glass(hz(60), 2.2, 0.35))
        B.add(soft_kick(0.9))
        B.add(pad(voicing('Cmaj7'), 2.4, attack=0.05, release=1.2, vel=0.45))
        if f >= 1.0:
            kc_clav(K, 'Cmaj7', 0.0, 0.5)
            B.add(kpluck(48, 0.5, 0.8))
        elif f >= 0.5:
            K.add(clav(hz(64), 0.1, 0.4), 0.0)
    n2 = max(len(B.x), len(K.x))
    return np.pad(B.x, (0, n2 - len(B.x))) + np.pad(kc_lp(K.x, p), (0, n2 - len(K.x)))


# ---------------------------------------------------------------- 10. winner fanfare (lands on a C chord at t = 0)
def kc_fanfare(k):
    p = KC[k]
    f = p['funk']
    reseed(5900 + int(k[1]))
    B, K = Line(5.6), Line(5.6)
    for i, m in enumerate((48, 52, 55, 59, 64, 67)):
        K.add(epiano_w(hz(m), 3.2, 0.75), i * 0.01)
    K.add(glass(hz(60), 3.4, 0.45))
    for m in (48, 52, 55, 59):
        B.add(soft_brass(hz(m), 1.0, 0.22))
    B.add(soft_kick(0.8))
    B.add(pad(voicing('Cmaj7') + [64], 5.4, attack=1.2, release=2.0, vel=0.8))
    if f >= 1.0:                                       # a funk tag: two stabs and a bass hit
        kc_clav(K, 'Cmaj7', 0.42, 0.55)
        kc_clav(K, 'Cmaj7', 0.7, 0.45)
        B.add(kpluck(48, 0.5, 0.9))
        B.add(kpluck(55, 0.3, 0.6), 0.42)
    elif f >= 0.5:
        kc_clav(K, 'Cmaj7', 0.5, 0.5)
        B.add(kpluck(48, 0.5, 0.8))
    n2 = max(len(B.x), len(K.x))
    return np.pad(B.x, (0, n2 - len(B.x))) + np.pad(kc_lp(K.x, p), (0, n2 - len(K.x)))


# ---------------------------------------------------------------- 11. calm loop (80 BPM, 8 bars, 24 s)
def kc_calm(k):
    p = KC[k]
    f = p['funk']
    seed = 6000 + int(k[1])
    reseed(seed)
    beat = 60.0 / 80
    L, K = Loop(8 * 4 * beat), Loop(8 * 4 * beat)
    prog = ['Cmaj7', 'Am7', 'Fmaj7', 'G7', 'Cmaj7', 'Am7', 'Dm7', 'G7']
    bass = {0.0: [(0, 0, 0.5, 0)], 0.5: [(0, 0, 0.55, 0), (8, 7, 0.35, 0)],
            1.0: [(0, 0, 0.6, 0), (6, 7, 0.4, 0), (10, 0, 0.2, 1), (12, 0, 0.35, 0)]}[f]
    for bar, ch in enumerate(prog):
        t0 = bar * 4 * beat
        L.add(pad(voicing(ch), 4 * beat + 1.0, attack=0.8, release=1.0, vel=0.2, bright=1.0), t0)
        for pos, iv, vel, ghost in bass:
            L.add(kpluck(kc_root(ch) + iv, 0.07 if ghost else (1.4 if pos == 0 else 0.5), vel), t0 + kc_t(p, pos, beat))
        for i, r in enumerate(CHORDS[ch][:4]):
            pos = (0, 4, 8, 12)[i] if f < 1.0 else (0, 4, 8, 14)[i]
            K.add(epiano_w(hz(48 + r), 1.4, 0.4), t0 + kc_t(p, pos, beat))
        if f >= 1.0:
            kc_clav(K, ch, t0 + kc_t(p, 10, beat), 0.2)
        elif f >= 0.5 and bar % 2 == 1:
            kc_clav(K, ch, t0 + kc_t(p, 6, beat), 0.15)
    return L.x + kc_lp(K.x, p)


# ---------------------------------------------------------------- 12-14. phone
def kc_locked(k):
    p = KC[k]
    reseed(6100 + int(k[1]))
    B = Line(0.5)
    if k == 'c2':
        B.add(clav(hz(55), 0.08, 0.8))
        B.add(clav(hz(62), 0.08, 0.5), 0.0)
    elif k == 'c3':
        B.add(pop(220, 560, 0.12, 0.7))
        B.add(clav(hz(64), 0.06, 0.3))
    else:
        B.add(pop(220, 560, 0.14, 0.9))
    return lowpass_fft(B.x, p['lp'], p['slope'])


def kc_correct(k):
    p = KC[k]
    reseed(6200 + int(k[1]))
    B, K = Line(1.2), Line(1.2)
    if k == 'c2':                                      # two muted stabs up a fifth, then a chord
        K.add(clav(hz(55), 0.1, 0.7))
        K.add(clav(hz(62), 0.12, 0.8), 0.09)
        for i, m in enumerate((52, 55, 59, 64)):
            K.add(epiano_w(hz(m), 1.0, 0.4), 0.12 + i * 0.01)
    else:
        B.add(pop(220, 560, 0.14, 0.8 if k == 'c1' else 0.7))
        for i, m in enumerate((52, 55, 59, 64)):
            K.add(epiano_w(hz(m), 1.0, 0.45), 0.08 + i * 0.01)
        if k == 'c3':
            K.add(clav(hz(64), 0.08, 0.3), 0.1)
    n2 = max(len(B.x), len(K.x))
    return np.pad(B.x, (0, n2 - len(B.x))) + np.pad(kc_lp(K.x, p), (0, n2 - len(K.x)))


def kc_incorrect(k):
    p = KC[k]
    reseed(6300 + int(k[1]))
    B = Line(1.0)
    if k == 'c2':                                      # two dull muted stabs falling
        for t0, m in ((0.0, 55), (0.2, 52)):
            B.add(lowpass_fft(clav(hz(m), 0.14, 0.9), 800), t0)
    else:
        for t0, m in ((0.0, 52), (0.2, 48)):
            B.add(lowpass_fft(epiano_w(hz(m), 0.7, 0.8), 900), t0)
        if k == 'c3':
            B.add(lowpass_fft(clav(hz(48), 0.1, 0.3), 800), 0.2)
    return B.x


for _k in ('c1', 'c2', 'c3'):
    KIT_ITEMS += [
        (f'lobby-{_k}', lambda k=_k: kc_lobby(k), 'loop'),
        (f'getready-{_k}', lambda k=_k: kc_getready(k), 'sting'),
        (f'question-{_k}', lambda k=_k: kc_question(k, 120), 'loop'),
        (f'question-{_k}-15x', lambda k=_k: kc_question(k, 180), 'loop'),
        (f'last5-{_k}', lambda k=_k: kc_last5(k), 'sting'),
        (f'timesup-{_k}', lambda k=_k: kc_timesup(k), 'sting'),
        (f'reveal-{_k}', lambda k=_k: kc_reveal(k), 'sting'),
        (f'scoreboard-{_k}', lambda k=_k: kc_scoreboard(k), 'loop'),
        (f'drumroll-{_k}', lambda k=_k: kc_drumroll(k, 3.4), 'sting'),
        (f'drumroll-{_k}-2.6s', lambda k=_k: kc_drumroll(k, 2.6), 'sting'),
        (f'place3-{_k}', lambda k=_k: kc_place(k, 3), 'sting'),
        (f'place2-{_k}', lambda k=_k: kc_place(k, 2), 'sting'),
        (f'place1-{_k}', lambda k=_k: kc_place(k, 1), 'sting'),
        (f'fanfare-{_k}', lambda k=_k: kc_fanfare(k), 'sting'),
        (f'calm-{_k}', lambda k=_k: kc_calm(k), 'loop'),
        (f'locked-{_k}', lambda k=_k: kc_locked(k), 'sting'),
        (f'correct-{_k}', lambda k=_k: kc_correct(k), 'sting'),
        (f'incorrect-{_k}', lambda k=_k: kc_incorrect(k), 'sting'),
    ]



# ============================================================================================
# Kit C in between: C4 and C5. Original C's groove, swing (58%), harmony and tempos, with the register moved.
#   C4  halfway: everything about a fourth lower than original C (a fourth keeps the stings brighter than a fifth would),
#       the whole kit moving down together (so it sits in G major), half of C1's low-pass (5.5 kHz instead of 3 kHz),
#       and the low-mid body that comes with the lower chords and pads.
#   C5  split register: melody, leads, stings and phone sounds an octave lower with C1's warm keys and low-pass,
#       while chords, pads and percussion keep original C's register and brightness.
# Three layers per item: percussion and bass (never filtered), leads and stings (tl semitones, own low-pass), and
# chords and pads (tc semitones, own low-pass). The bass is folded into E2 to E3 so it stays phone-audible.
# ============================================================================================
KC45 = {
    'c4': dict(tl=-5, tc=-5, tick=0.75, lp_lead=(5500, 1500), lp_chord=(5500, 1500), warm=False),
    'c5': dict(tl=-12, tc=0, tick=1.0, lp_lead=(3000, 1000), lp_chord=None, warm=True),
}


def c45_ep(s, f, dur, vel):
    return epiano_w(f, dur, vel) if s['warm'] else epiano(f, dur, vel)


def c45_root(ch, tc):
    m = 36 + CHORDS[ch][0] + tc
    while m < 40:
        m += 12
    while m >= 52:
        m -= 12
    return m


def c45_voicing(ch, tc):
    return [m + tc for m in voicing(ch)]


def c45_pool(lo, hi, tr):
    pcs = {(x + tr) % 12 for x in PENTA}
    return [m for m in range(lo, hi + 1) if m % 12 in pcs]


def c45_sum(P, LD, CH, s):
    n = max(len(P.x), len(LD.x), len(CH.x))
    out = np.pad(P.x, (0, n - len(P.x)))
    for layer, lp in ((LD, s['lp_lead']), (CH, s['lp_chord'])):
        x = layer.x
        if lp:
            x = lowpass_fft(x, lp[0], lp[1])
        out = out + np.pad(x, (0, n - len(x)))
    return out


def c45_lobby(k):
    s = KC45[k]
    tl, tc = s['tl'], s['tc']
    seed = 7000 + int(k[1])
    reseed(seed)
    rr = np.random.default_rng(seed)
    beat = 60.0 / 96
    n = 8 * 4 * beat
    P, LD, CH = Loop(n), Loop(n), Loop(n)
    prog = ['Cmaj7', 'Am7', 'Fmaj7', 'G7', 'Cmaj7', 'Em7', 'Fmaj7', 'G7']
    cells = [[0.58, 1.5, 2.58], [0, 1, 2.58, 3.5], [1.58, 3.0], [0, 2, 2.58, 3.58]]
    cur, last = 79 + tl, -1
    for bar, ch in enumerate(prog):
        t0 = bar * 4 * beat
        root = c45_root(ch, tc)
        for r in CHORDS[ch][:4]:
            CH.add(epiano(hz(60 + r + tc), 1.6, 0.3), t0)
            CH.add(epiano(hz(60 + r + tc), 0.7, 0.18), t0 + 1.58 * beat)
        CH.add(pad(c45_voicing(ch, tc), 4 * beat + 0.9, attack=0.5, release=0.9, vel=0.25), t0)
        for b, m, vel in ((0, root, 0.8), (1.58, root + 7, 0.5), (2.5, root + 12, 0.5)):
            P.add(kpluck(m, 0.6, vel), t0 + b * beat)
        for b, vel in ((0, 0.5), (2, 0.4)):
            P.add(soft_kick(vel), t0 + b * beat)
        for b in (1, 3):
            P.add(rim(0.3), t0 + b * beat)
        for i in range(4):
            P.add(shaker(0.16), t0 + i * beat)
            P.add(shaker(0.28), t0 + (i + 0.58) * beat)
        ci = pick_cell(rr, cells, last)
        last = ci
        notes, cur = walk(rr, cur, c45_pool(72 + tl, 91 + tl, tl), len(cells[ci]))
        for b, m in zip(cells[ci], notes):
            LD.add(c45_ep(s, hz(m), 1.0, 0.45), t0 + b * beat)
    return c45_sum(P, LD, CH, s)


def c45_getready(k):
    s = KC45[k]
    tl, tc = s['tl'], s['tc']
    reseed(7100 + int(k[1]))
    P, LD, CH = Line(4.2), Line(4.2), Line(4.2)
    sc = 2 ** (tl / 12.0)
    for i in range(3):
        LD.add(pop((420 + 60 * i) * sc, (1100 + 150 * i) * sc, 0.14, 0.8), float(i))
    for i, m in enumerate((72, 76, 79, 83)):
        LD.add(c45_ep(s, hz(m + tl), 1.2, 0.7), 3.0 + i * 0.012)
    LD.add(glass(hz(84 + tl), 1.2, 0.4), 3.0)
    P.add(soft_kick(0.7), 3.0)
    return c45_sum(P, LD, CH, s)


def c45_question(k, bpm=120):
    s = KC45[k]
    tl, tc = s['tl'], s['tc']
    reseed(7200 + int(k[1]))
    beat = 60.0 / bpm
    n = 8 * 4 * beat
    P, LD, CH = Loop(n), Loop(n), Loop(n)
    prog = ['C', 'Am', 'F', 'G'] * 2
    for bar, ch in enumerate(prog):
        t0 = bar * 4 * beat
        root = c45_root(ch, tc)
        for b in range(4):
            P.add(woodtick((1300 if b % 2 == 0 else 980) * s['tick'], 0.6 if b == 0 else 0.42), t0 + b * beat)
        for b, (m, vel) in enumerate(((root, 0.7), (root + 7, 0.45), (root, 0.55), (root + 7, 0.45))):
            P.add(kpluck(m, 0.4, vel * 0.55), t0 + b * beat)
        LD.add(c45_ep(s, hz(72 + CHORDS[ch][1] + tl), 0.6, 0.3), t0 + 2 * beat)
    return c45_sum(P, LD, CH, s)


def c45_last5(k):
    s = KC45[k]
    tl, tc = s['tl'], s['tc']
    reseed(7300 + int(k[1]))
    P, LD, CH = Line(5.25), Line(5.25), Line(5.25)
    t, n = 0.0, 0
    while t < 5.0:
        pr = t / 5.0
        P.add(woodtick((1300 if n % 2 == 0 else 980) * s['tick'], 0.4 + 0.5 * pr), t)
        t += 0.5 * 0.28 ** pr
        n += 1
    t = 0.0
    while t < 5.0:
        P.add(soft_kick(0.4 + 0.5 * t / 5.0), t)
        t += 0.9 * 0.33 ** (t / 5.0)
    CH.add(pad([m + tc for m in (48, 55, 60, 64)], 5.25, attack=5.0, release=0.25, vel=0.5))
    return c45_sum(P, LD, CH, s)


def c45_timesup(k):
    s = KC45[k]
    tl, tc = s['tl'], s['tc']
    reseed(7400 + int(k[1]))
    P, LD, CH = Line(2.6), Line(2.6), Line(2.6)
    LD.add(glass(hz(72 + tl), 2.4, 1.0))
    LD.add(glass(hz(79 + tl), 1.8, 0.35))
    P.add(soft_kick(0.7))
    CH.add(pad([m + tc for m in (48, 55, 60)], 2.4, attack=0.05, release=1.2, vel=0.4))
    return c45_sum(P, LD, CH, s)


def c45_reveal(k):
    s = KC45[k]
    tl = s['tl']
    reseed(7500 + int(k[1]))
    P, LD, CH = Line(1.8), Line(1.8), Line(1.8)
    for i, m in enumerate((72, 76, 79, 83)):
        LD.add(c45_ep(s, hz(m + tl), 1.6, 0.7), i * 0.015)
    LD.add(glass(hz(96 + tl), 1.2, 0.15), 0.05)
    return c45_sum(P, LD, CH, s)


def c45_scoreboard(k):
    s = KC45[k]
    tl, tc = s['tl'], s['tc']
    reseed(7600 + int(k[1]))
    beat = 60.0 / 96
    n = 16 * beat
    P, LD, CH = Loop(n), Loop(n), Loop(n)
    anim = 8 * beat
    for i, m in enumerate((72, 74, 76, 79, 81, 84, 86, 88)):
        LD.add(c45_ep(s, hz(m + tl), 1.0, 0.35 + 0.65 * i / 7), i * beat)
    t = 0.0
    while t < anim - 0.01:
        P.add(shaker(0.1 + 0.5 * t / anim), t)
        t += (beat / 2) if t < anim / 2 else (beat / 4)
    CH.add(pad(c45_voicing('Cmaj7', tc), anim + 0.6, attack=anim * 0.95, release=0.6, vel=0.6), 0.0)
    LD.add(glass(hz(84 + tl), 2.4, 0.4), 8 * beat)
    for bar, ch in ((2, 'Fmaj7'), (3, 'G7')):
        tb = bar * 4 * beat
        root = c45_root(ch, tc)
        CH.add(pad(c45_voicing(ch, tc), 4 * beat + 0.7, attack=0.1, release=0.7, vel=0.4), tb)
        for b, m, vel in ((0, root, 0.8), (1.58, root + 7, 0.5), (2.5, root + 12, 0.5)):
            P.add(kpluck(m, 0.6, vel), tb + b * beat)
        for b, vel in ((1.58, 0.25), (3.58, 0.2)):
            for r in CHORDS[ch][:4]:
                CH.add(epiano(hz(60 + r + tc), 0.8, vel), tb + b * beat)
        for b, vel in ((0, 0.6), (2, 0.5)):
            P.add(soft_kick(vel), tb + b * beat)
        for b in (1, 3):
            P.add(rim(0.3), tb + b * beat)
    return c45_sum(P, LD, CH, s)


def c45_drumroll(k, dur=3.4):
    s = KC45[k]
    tc = s['tc']
    reseed(7700 + int(k[1]))
    rr = np.random.default_rng(7700 + int(k[1]))
    P, LD, CH = Line(dur + 0.7), Line(dur + 0.7), Line(dur + 0.7)
    t, n = 0.0, 0
    while t < dur - 0.04:
        pr = t / dur
        P.add(woodtick((1300 if n % 2 == 0 else 980) * s['tick'], 0.15 + 0.75 * pr ** 1.2), t)
        t += 1 / (6 + 14 * pr) * float(rr.uniform(0.96, 1.04))
        n += 1
    CH.add(pad(c45_voicing('G7', tc), dur + 0.5, attack=dur, release=0.4, vel=0.6))
    P.add(soft_kick(1.0), dur)
    P.add(rim(1.0), dur)
    return c45_sum(P, LD, CH, s)


def c45_place(k, place):
    s = KC45[k]
    tl, tc = s['tl'], s['tc']
    reseed(7800 + int(k[1]) * 10 + place)
    P, LD, CH = Line(2.5), Line(2.5), Line(2.5)
    if place == 3:
        LD.add(c45_ep(s, hz(67 + tl), 1.2, 0.8))
    elif place == 2:
        LD.add(c45_ep(s, hz(72 + tl), 1.4, 0.7))
        LD.add(c45_ep(s, hz(76 + tl), 1.4, 0.6))
        P.add(soft_kick(0.5))
    else:
        for i, m in enumerate((60, 67, 71, 76, 79)):
            LD.add(c45_ep(s, hz(m + tl), 2.2, 0.7), i * 0.012)
        LD.add(glass(hz(84 + tl), 2.2, 0.4))
        P.add(soft_kick(1.0))
        CH.add(pad(c45_voicing('Cmaj7', tc), 2.4, attack=0.05, release=1.2, vel=0.5))
    return c45_sum(P, LD, CH, s)


def c45_fanfare(k):
    s = KC45[k]
    tl, tc = s['tl'], s['tc']
    reseed(7900 + int(k[1]))
    P, LD, CH = Line(5.6), Line(5.6), Line(5.6)

    def keep_low(m):
        return m + 12 if m < 43 else m
    for i, m in enumerate((48, 60, 64, 67, 71, 76)):
        LD.add(c45_ep(s, hz(keep_low(m + tl)), 3.2, 0.75), i * 0.01)
    LD.add(glass(hz(84 + tl), 3.4, 0.5))
    for m in (48, 60, 64, 67):
        LD.add(soft_brass(hz(keep_low(m + tl)), 1.0, 0.25))
    P.add(soft_kick(0.9))
    CH.add(pad(c45_voicing('Cmaj7', tc) + [76 + tc], 5.4, attack=1.2, release=2.0, vel=0.9))
    tt = t_(2.0)
    P.add(noise_band(len(tt), 5000, 13000) * np.exp(-((tt - 0.9) / 0.5) ** 2) * 0.12)
    return c45_sum(P, LD, CH, s)


def c45_calm(k):
    s = KC45[k]
    tl, tc = s['tl'], s['tc']
    reseed(8000 + int(k[1]))
    beat = 60.0 / 80
    n = 8 * 4 * beat
    P, LD, CH = Loop(n), Loop(n), Loop(n)
    prog = ['Cmaj7', 'Am7', 'Fmaj7', 'G7', 'Cmaj7', 'Am7', 'Dm7', 'G7']
    for bar, ch in enumerate(prog):
        t0 = bar * 4 * beat
        CH.add(pad(c45_voicing(ch, tc), 4 * beat + 1.0, attack=0.8, release=1.0, vel=0.3), t0)
        P.add(kpluck(c45_root(ch, tc), 1.4, 0.5), t0)
        for i, r in enumerate(CHORDS[ch][:4]):
            LD.add(c45_ep(s, hz(60 + r + (12 if i >= 2 else 0) + tl), 1.4, 0.38), t0 + i * beat)
    return c45_sum(P, LD, CH, s)


def c45_locked(k):
    s = KC45[k]
    reseed(8100 + int(k[1]))
    sc = 2 ** (s['tl'] / 12.0)
    LD = Line(0.5)
    LD.add(pop(420 * sc, 1100 * sc, 0.14, 0.9))
    return c45_sum(Line(0.5), LD, Line(0.5), s)


def c45_correct(k):
    s = KC45[k]
    tl = s['tl']
    reseed(8200 + int(k[1]))
    sc = 2 ** (tl / 12.0)
    LD = Line(1.2)
    LD.add(pop(420 * sc, 1100 * sc, 0.14, 0.8))
    for i, m in enumerate((72, 76, 79, 83)):
        LD.add(c45_ep(s, hz(m + tl), 1.0, 0.45), 0.08 + i * 0.01)
    return c45_sum(Line(1.2), LD, Line(1.2), s)


def c45_incorrect(k):
    s = KC45[k]
    tl = s['tl']
    reseed(8300 + int(k[1]))
    B = Line(1.0)
    for t0, m in ((0.0, 64), (0.2, 60)):
        B.add(lowpass_fft(c45_ep(s, hz(m + tl), 0.7, 0.8), 1300), t0)
    return B.x


for _k in ('c4', 'c5'):
    KIT_ITEMS += [
        (f'lobby-{_k}', lambda k=_k: c45_lobby(k), 'loop'),
        (f'getready-{_k}', lambda k=_k: c45_getready(k), 'sting'),
        (f'question-{_k}', lambda k=_k: c45_question(k, 120), 'loop'),
        (f'question-{_k}-15x', lambda k=_k: c45_question(k, 180), 'loop'),
        (f'last5-{_k}', lambda k=_k: c45_last5(k), 'sting'),
        (f'timesup-{_k}', lambda k=_k: c45_timesup(k), 'sting'),
        (f'reveal-{_k}', lambda k=_k: c45_reveal(k), 'sting'),
        (f'scoreboard-{_k}', lambda k=_k: c45_scoreboard(k), 'loop'),
        (f'drumroll-{_k}', lambda k=_k: c45_drumroll(k, 3.4), 'sting'),
        (f'drumroll-{_k}-2.6s', lambda k=_k: c45_drumroll(k, 2.6), 'sting'),
        (f'place3-{_k}', lambda k=_k: c45_place(k, 3), 'sting'),
        (f'place2-{_k}', lambda k=_k: c45_place(k, 2), 'sting'),
        (f'place1-{_k}', lambda k=_k: c45_place(k, 1), 'sting'),
        (f'fanfare-{_k}', lambda k=_k: c45_fanfare(k), 'sting'),
        (f'calm-{_k}', lambda k=_k: c45_calm(k), 'loop'),
        (f'locked-{_k}', lambda k=_k: c45_locked(k), 'sting'),
        (f'correct-{_k}', lambda k=_k: c45_correct(k), 'sting'),
        (f'incorrect-{_k}', lambda k=_k: c45_incorrect(k), 'sting'),
    ]


if __name__ == '__main__':
    import wave
    kit_mode = len(sys.argv) > 2 and sys.argv[1] == '--kit'
    out = pathlib.Path(sys.argv[2] if kit_mode else sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    items = render_kit() if kit_mode else {name: (fn(), 'sting') for name, fn in SOUNDS.items()}
    for name, (x, kind) in items.items():
        if kit_mode:
            x = x / (np.max(np.abs(x)) + 1e-12) * 0.7      # raw level; build_kit.py sets the real loudness
        pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
        with wave.open(str(out / f'{name}.wav'), 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        print(f'{name:18s} {len(x)/SR:6.2f}s  peak {20*np.log10(np.max(np.abs(x))):.1f} dBFS')
