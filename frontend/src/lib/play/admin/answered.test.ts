// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { answeredCount } from './answered';

const players = (...names: string[]) => names.map((username) => ({ username }));

describe('answeredCount', () => {
	it('counts the players who answered', () => {
		expect(answeredCount(['ana', 'ben'], players('ana', 'ben', 'cy'))).toBe(2);
	});

	it('never counts more than there are players: one who answered and left drops out', () => {
		// The "3 of 2" case: three answered, then one left.
		expect(answeredCount(['ana', 'ben', 'cy'], players('ana', 'ben'))).toBe(2);
		expect(answeredCount(['ana', 'ben'], players('cy'))).toBe(0);
	});

	it('counts a name once, however many times it arrives', () => {
		expect(answeredCount(['ana', 'ana'], players('ana', 'ben'))).toBe(1);
	});

	it('counts a player who left and came back', () => {
		expect(answeredCount(['ana'], players('ben', 'ana'))).toBe(1);
	});
});
