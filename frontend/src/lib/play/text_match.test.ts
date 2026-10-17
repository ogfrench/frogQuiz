// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { matches } from './text_match';
// The same cases as frogquiz/tests/test_text_match.py.
import cases from './text_match_cases.json';

describe('Type answer matching', () => {
	it.each(cases.map((c) => [c.name, c] as const))('%s', (_, c) => {
		expect(matches(c.answer, c.spelling, 'case_sensitive' in c && c.case_sensitive)).toBe(
			c.match
		);
	});
});
