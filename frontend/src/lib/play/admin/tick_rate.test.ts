// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { tick_rate } from './tick_rate';

describe('tick_rate', () => {
	it('starts at the loop as recorded and ends at 1.5x', () => {
		expect(tick_rate(0)).toBe(1);
		expect(tick_rate(1)).toBeCloseTo(1.5, 10);
	});

	it('is barely faster for the first half of the timer', () => {
		for (let p = 0; p <= 0.5; p += 0.01) expect(tick_rate(p)).toBeLessThan(1.13);
	});

	it('never leaves 1x to 1.5x, so the pitch stays in range', () => {
		for (let p = 0; p <= 1; p += 0.001) {
			expect(tick_rate(p)).toBeGreaterThanOrEqual(1);
			expect(tick_rate(p)).toBeLessThanOrEqual(1.5 + 1e-9);
		}
	});

	it('rises monotonically, so the loop never slows down as time runs out', () => {
		let last = tick_rate(0);
		for (let p = 0.001; p <= 1; p += 0.001) {
			expect(tick_rate(p)).toBeGreaterThanOrEqual(last);
			last = tick_rate(p);
		}
	});

	it('clamps a share outside 0..1, which a late or early timer update can produce', () => {
		expect(tick_rate(-0.5)).toBe(tick_rate(0));
		expect(tick_rate(1.7)).toBe(tick_rate(1));
		expect(tick_rate(Number.NaN)).not.toBeNaN();
	});
});
