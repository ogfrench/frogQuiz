// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { totalsFromResults, totalsFromServer } from './totals';

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

describe('totalsFromServer', () => {
	it('takes the running totals from the server, hide-results questions included', () => {
		// ana's 800 came from a hide-results question: it never had a results screen, so
		// the host's own per-question sum left it out while the podium counted it.
		expect(totalsFromServer({ ana: 1400, ben: 600 }, ['ana', 'ben'])).toEqual({
			ana: 1400,
			ben: 600
		});
	});

	it('keeps players who have not scored, at 0', () => {
		expect(totalsFromServer({ ana: 900 }, ['ana', 'ben', 'cy'])).toEqual({
			ana: 900,
			ben: 0,
			cy: 0
		});
	});

	it('reads the numbers Redis hands back as strings', () => {
		expect(totalsFromServer({ ana: '1200', ben: 'not a number' })).toEqual({
			ana: 1200,
			ben: 0
		});
		expect(totalsFromServer(null, ['ana'])).toEqual({ ana: 0 });
	});
});
