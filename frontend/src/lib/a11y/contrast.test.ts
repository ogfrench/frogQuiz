// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { aaThreshold, contrastRatio, deltaE, hexToRgb, oklchToRgb } from './contrast';

describe('colour parsing', () => {
	it('reads both hex lengths', () => {
		expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
		expect(hexToRgb('#f98e8a')).toEqual([249, 142, 138]);
	});

	it('rejects anything that is not a colour', () => {
		expect(() => hexToRgb('#12345')).toThrow();
		expect(() => oklchToRgb('#fff')).toThrow();
	});

	it('converts oklch to the sRGB a browser resolves it to', () => {
		// Checked against getComputedStyle in Chromium; a few channels of drift is the
		// gamut clip, not an error in the maths.
		expect(oklchToRgb('oklch(1 0 0)')).toEqual([255, 255, 255]);
		expect(oklchToRgb('oklch(0 0 0)')).toEqual([0, 0, 0]);
		const [r, g, b] = oklchToRgb('oklch(0.546 0.016 285.938)');
		expect(r).toBeGreaterThan(105);
		expect(r).toBeLessThan(125);
		expect(Math.abs(r - g)).toBeLessThan(12);
		expect(b).toBeGreaterThan(g);
	});
});

describe('contrast ratio', () => {
	it('anchors at the two ends of the scale', () => {
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
		expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
	});

	it('does not care which way round the arguments go', () => {
		expect(contrastRatio('#123456', '#abcdef')).toBeCloseTo(
			contrastRatio('#abcdef', '#123456'),
			10
		);
	});
});

describe('aaThreshold', () => {
	it('is 4.5 for body text and 3 for large text', () => {
		expect(aaThreshold(16)).toBe(4.5);
		expect(aaThreshold(24)).toBe(3);
		// 18.66px only counts as large once it is bold.
		expect(aaThreshold(19)).toBe(4.5);
		expect(aaThreshold(19, 700)).toBe(3);
	});
});

describe('deltaE', () => {
	it('is zero for a colour against itself', () => {
		expect(deltaE('#f98e8a', '#f98e8a')).toBeCloseTo(0, 6);
	});

	it('separates colours that look different', () => {
		expect(deltaE('#f98e8a', '#46bff4')).toBeGreaterThan(deltaE('#f98e8a', '#fa8f8b'));
	});
});
