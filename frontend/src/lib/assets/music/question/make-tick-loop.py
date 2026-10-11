# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

# 8 s tick loop modelled on the tickloop-gameshow measurements:
#   120 BPM (a click every 500 ms), alternating accents about 6 dB apart,
#   a softer second hit about 150 ms after each click, a 1.2 kHz tone with the noise burst above it,
#   -20 dB about 45 ms after each click, and silent again before the loop restarts.
import sys
import wave

import numpy as np

SR = 44100
DUR = 8.0
N = int(SR * DUR)
GAIN_DB = -9.0
rng = np.random.default_rng(7)  # fixed seed so the same file comes out every run


def lowpass(x, hz):
    a = np.exp(-2 * np.pi * hz / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def click(length_s, f0, tau_tone, tau_noise, noise_gain=0.5):
    n = int(length_s * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * f0 * t) * np.exp(-t / tau_tone)
    # two poles: steeper roll-off
    noise = lowpass(lowpass(rng.standard_normal(n), 3000), 3000)
    s = tone + noise_gain * noise * np.exp(-t / tau_noise)
    ramp = int(0.0003 * SR)  # 0.3 ms attack
    s[:ramp] *= np.linspace(0, 1, ramp)
    fade = int(0.015 * SR)  # 15 ms fade-out: no cut at the end
    s[-fade:] *= np.linspace(1, 0, fade)
    return s / np.max(np.abs(s))


main = click(0.10, 1200, tau_tone=0.020, tau_noise=0.014)
echo = click(0.08, 1200, tau_tone=0.012, tau_noise=0.008)
out = np.zeros(N)
beat = int(0.5 * SR)
for k in range(16):
    start = k * beat
    accent = 1.0 if k % 2 == 0 else 10 ** (-6 / 20)
    out[start:start + len(main)] += accent * main
    e = start + int(0.150 * SR)
    out[e:e + len(echo)] += accent * 0.2 * echo
out /= np.max(np.abs(out))
out *= 10 ** (GAIN_DB / 20)  # set to the original's integrated loudness (measured, see README)
pcm = (np.clip(np.stack([out, out], axis=1), -1, 1) * 32767).astype('<i2')
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', sys.argv[1])
