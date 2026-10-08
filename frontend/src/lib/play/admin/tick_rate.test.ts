// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { tick_rate } from './tick_rate';

describe('tick_rate', () => {
	it('starts at the loop as recorded and ends at nearly double speed', () => {
		expect(tick_rate(0)).toBe(1);
		expect(tick_rate(1)).toBeGreaterThan(1.8);
		expect(tick_rate(1)).toBeLessThan(2.1);
	});

	it('stays calm for the first half of the timer', () => {
		for (let p = 0; p <= 0.5; p += 0.01) expect(tick_rate(p)).toBeLessThan(1.3);
	});

	it('never leaves a range the loop still sounds like itself in', () => {
		for (let p = 0; p <= 1; p += 0.001) {
			// The wobble dips just under 1x in the first moments, by under a percent.
			expect(tick_rate(p)).toBeGreaterThan(0.99);
			expect(tick_rate(p)).toBeLessThan(2.1);
		}
	});

	it('clamps a share outside 0..1, which a late or early timer update can produce', () => {
		expect(tick_rate(-0.5)).toBe(tick_rate(0));
		expect(tick_rate(1.7)).toBe(tick_rate(1));
		expect(tick_rate(Number.NaN)).not.toBeNaN();
	});
});
