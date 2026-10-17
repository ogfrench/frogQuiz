// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

/** The last stretch of a question: the music switches to its fast loop, and the host's
 * bar and the phone's ring turn red. Before that both are neutral, so red means "hurry"
 * only when it is true (V1 design call 2, 17 Oct). */
export const LAST_SECONDS = 5;

/** True once a question has LAST_SECONDS or fewer left. `left` is the seconds shown, as the
 * socket sends them (a string on the screens, a number in the music). */
export function in_last_seconds(left: string | number): boolean {
	const n = typeof left === 'number' ? left : parseInt(left);
	return Number.isFinite(n) && n <= LAST_SECONDS;
}
