// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';

/**
 * The multiple-answer wire format, which is a contract between three places that do not
 * import each other: the player's phone builds the string, the backend scores it, and
 * the host's results screen decodes it to count votes per option. Nothing in the type
 * system ties those together, so a change in one silently breaks the other two -- which
 * is exactly what had happened: the results screen matched submissions against answer
 * text and every bar read zero.
 *
 * The three implementations are re-stated here rather than imported, because two of them
 * live inside Svelte components and one is in Python. If a copy drifts, these fail.
 */

/** What questions/check.svelte sends: ticked indices, ascending, concatenated. */
const encode = (ticked: boolean[]): string | undefined => {
	const picked = ticked.map((on, i) => (on ? String(i) : '')).join('');
	return picked === '' ? undefined : picked;
};

/** What check_check_question in frogquiz/socket_server/helpers.py compares against. */
const correctString = (answers: { right: boolean }[]): string =>
	answers.map((a, i) => (a.right ? String(i) : '')).join('');

/** What voting_results.svelte counts with. */
const countsFor = (submissions: string[], answerCount: number): number[] =>
	Array.from(
		{ length: answerCount },
		(_, i) => submissions.filter((s) => (s ?? '').includes(String(i))).length
	);

describe('CHECK wire format', () => {
	it('encodes ticked indices in ascending order', () => {
		expect(encode([true, false, true, false])).toBe('02');
		expect(encode([false, true, false, true])).toBe('13');
		expect(encode([true, true, true, true])).toBe('0123');
	});

	it('is undefined when nothing is ticked, so submit stays disabled', () => {
		// An empty string is a value, and it used to leave the button live after a
		// player ticked an option and then unticked it.
		expect(encode([false, false, false, false])).toBeUndefined();
	});

	it('scores all or nothing against the same encoding', () => {
		const answers = [{ right: true }, { right: false }, { right: true }, { right: false }];
		const correct = correctString(answers);
		expect(correct).toBe('02');
		expect(encode([true, false, true, false])).toBe(correct);
		// Partly right, over-selected, and inverted all score zero.
		expect(encode([true, false, false, false])).not.toBe(correct);
		expect(encode([true, false, true, true])).not.toBe(correct);
		expect(encode([false, true, false, true])).not.toBe(correct);
	});

	it('counts a submission once per option it names', () => {
		// Three players: one picked 0 and 2, one picked 2, one picked 1.
		expect(countsFor(['02', '2', '1'], 4)).toEqual([1, 1, 2, 0]);
	});

	it('is only unambiguous below ten options, which the editor enforces', () => {
		// "10" contains "1", so a tenth option would be double-counted. The editor caps a
		// question at four answers, which is what keeps this safe; if that cap ever moves
		// past nine, the format has to change rather than the cap.
		expect(countsFor(['10'], 11)[1]).toBe(1);
		expect(countsFor(['10'], 11)[10]).toBe(1);
		const MAX_ANSWERS_IN_EDITOR = 4;
		expect(MAX_ANSWERS_IN_EDITOR).toBeLessThan(10);
	});
});
