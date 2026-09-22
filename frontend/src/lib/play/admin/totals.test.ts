// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { totalsFromResults } from './totals';

describe('totalsFromResults', () => {
	it('sums every question, including ones whose results were never shown', () => {
		const totals = totalsFromResults({
			'0': [
				{ username: 'ana', score: 900 },
				{ username: 'rui', score: 0 }
			],
			// The host skipped "Show results" here; the old tally lost these points.
			'1': [{ username: 'rui', score: 750 }],
			'2': [{ username: 'ana', score: 400 }]
		});
		expect(totals).toEqual({ ana: 1300, rui: 750 });
	});

	it('keeps players who never scored at zero', () => {
		expect(
			totalsFromResults({ '0': [{ username: 'ana', score: 10 }] }, ['ana', 'bea'])
		).toEqual({
			ana: 10,
			bea: 0
		});
	});

	it('treats a missing question and a junk score as nothing', () => {
		expect(
			totalsFromResults({ '0': null, '1': [{ username: 'ana', score: NaN }] }, [])
		).toEqual({ ana: 0 });
	});
});
