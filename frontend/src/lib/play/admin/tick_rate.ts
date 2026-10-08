// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

/**
 * Playback rate of the question tick loop, by the share of the timer that has elapsed.
 *
 * "Heartbeat": a quadratic climb from 1x to about 1.95x, so the first half of a question
 * is calm and the last quarter is not, with a wobble that grows toward the end so the
 * pulse feels alive rather than mechanical. Chosen by ear from six candidates on
 * 2026-10-08; the rest (linear, cubic, stairs, panic) were less musical.
 */
export const tick_rate = (elapsed_share: number): number => {
	const p = Number.isFinite(elapsed_share) ? Math.min(1, Math.max(0, elapsed_share)) : 0;
	return 1 + 0.9 * p ** 2 + 0.06 * Math.sin(p * 40) * p;
};
