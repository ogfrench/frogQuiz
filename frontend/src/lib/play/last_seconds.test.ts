// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { LAST_SECONDS, in_last_seconds } from './last_seconds';

describe('in_last_seconds', () => {
	it('is neutral before the last stretch and red from it, as a string or a number', () => {
		expect(in_last_seconds(String(LAST_SECONDS + 1))).toBe(false);
		expect(in_last_seconds(String(LAST_SECONDS))).toBe(true);
		expect(in_last_seconds(0)).toBe(true);
		expect(in_last_seconds(18)).toBe(false);
	});

	it('stays neutral when there is no number yet', () => {
		expect(in_last_seconds('')).toBe(false);
		expect(in_last_seconds(undefined as unknown as string)).toBe(false);
	});
});
