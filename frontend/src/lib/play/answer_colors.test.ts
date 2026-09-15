// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { ANSWER_COLORS, ANSWER_FOREGROUND, answerColor } from './answer_colors';
import { readFileSync } from 'node:fs';
import { contrastRatio, deltaE, rgbDistance, simulateCvd } from '$lib/a11y/contrast';

/**
 * The palette was derived in OKLCH and checked once, by hand, against colour-vision
 * separation and contrast. These pin that work down. The first attempt at this palette
 * paired amber with green at ΔE 8.6, which is genuinely hard to tell apart -- the point
 * of the tests is that nobody reintroduces something like it by nudging a hex value.
 */
describe('answer palette', () => {
	it('has one colour per answer slot', () => {
		expect(ANSWER_COLORS).toHaveLength(4);
	});

	it('wraps rather than running off the end', () => {
		expect(answerColor(0)).toBe(ANSWER_COLORS[0]);
		expect(answerColor(4)).toBe(ANSWER_COLORS[0]);
		expect(answerColor(7)).toBe(ANSWER_COLORS[3]);
	});

	it('carries readable ink on every tile', () => {
		// Answer text is 18px semibold, so AA asks 4.5:1.
		for (const c of ANSWER_COLORS) {
			expect(
				contrastRatio(c, ANSWER_FOREGROUND),
				`${c} on ${ANSWER_FOREGROUND}`
			).toBeGreaterThanOrEqual(4.5);
		}
	});

	it('keeps every pair of tiles distinguishable with normal vision', () => {
		// 13 is the measured floor (sky against violet). The threshold exists to catch
		// a pair drifting closer together, not to flatter the current values: the
		// amber/green pairing this palette replaced measured 8.6.
		for (let i = 0; i < ANSWER_COLORS.length; i++) {
			for (let j = i + 1; j < ANSWER_COLORS.length; j++) {
				const d = deltaE(ANSWER_COLORS[i], ANSWER_COLORS[j]);
				expect(d, `${ANSWER_COLORS[i]} vs ${ANSWER_COLORS[j]}`).toBeGreaterThan(13);
			}
		}
	});

	it('does not rely on colour surviving colour-vision deficiency', () => {
		// This asserts the limitation rather than hiding it. Four hues at one lightness
		// cannot be told apart by a dichromat: under deuteranopia coral and green differ
		// by 4 of 255. The design is accessible because every tile also carries a shape,
		// not because the colours are separable -- so if someone ever "fixes" the palette
		// to pass here, that is a real change and this test should be rewritten
		// deliberately, not deleted to make a build pass.
		const worst = (kind: 'protanopia' | 'deuteranopia' | 'tritanopia') => {
			let min = Infinity;
			for (let i = 0; i < ANSWER_COLORS.length; i++) {
				for (let j = i + 1; j < ANSWER_COLORS.length; j++) {
					min = Math.min(
						min,
						rgbDistance(
							simulateCvd(ANSWER_COLORS[i], kind),
							simulateCvd(ANSWER_COLORS[j], kind)
						)
					);
				}
			}
			return min;
		};
		expect(worst('deuteranopia')).toBeLessThan(20);
		expect(worst('protanopia')).toBeLessThan(60);
	});

	it('has a shape for every colour, which is what carries identity', () => {
		// The redundant channel the palette depends on. If AnswerShape ever stops
		// covering all four slots, the colours alone are not enough.
		const shapes = readFileSync(
			new URL('./kahoot_mode_assets/AnswerShape.svelte', import.meta.url),
			'utf8'
		);
		// Three are <path> data in a four-entry array, the circle is a real <circle>.
		expect(shapes).toContain('<circle');
		const paths = shapes.match(/const paths = \[[\s\S]*?\n\t\]/)?.[0] ?? '';
		// Count the string literals, not the commas: one of the trailing comments has a
		// comma in it, which is exactly the kind of thing that makes a brittle test lie.
		const entries = paths.match(/'[^']*'/g) ?? [];
		expect(entries.length, 'one entry per answer slot').toBe(ANSWER_COLORS.length);
		expect(shapes).toContain('index % 4');
	});

	it('is the same in both themes', () => {
		// A player learns "I am picking the coral one". That identity must not shift
		// because the host's screen is in a different theme from their phone, which is
		// why there is one array rather than a light and a dark one.
		expect(ANSWER_COLORS.every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true);
	});
});
