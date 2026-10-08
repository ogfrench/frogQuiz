// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

/**
 * Playback rate of the question tick loop, by the share of the timer that has elapsed.
 *
 * "Gentle": a quadratic climb from 1x to 1.5x. The first half of a question is barely
 * faster, and the last quarter is clearly urgent. It stays low on purpose: the loop is
 * played faster rather than re-clocked, so the pitch rises with the speed, and a larger
 * range squealed. Chosen by ear on 2026-10-08 over heartbeat, linear, late surge, stairs
 * and panic; heartbeat (1x to 1.95x) was the one that squealed.
 */
export const tick_rate = (elapsed_share: number): number => {
	const p = Number.isFinite(elapsed_share) ? Math.min(1, Math.max(0, elapsed_share)) : 0;
	return 1 + 0.5 * p ** 2;
};
