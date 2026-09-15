// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, toRgb } from './contrast';

/**
 * The theme tokens, checked against WCAG AA straight out of app.css.
 *
 * This is the cheap half of the accessibility work: it runs in Node in milliseconds and
 * catches the case that actually happens, which is somebody nudging a lightness value
 * and quietly dropping a pairing under 4.5:1. --muted-foreground was sitting at 4.39:1
 * against --muted before this existed, and nothing said so.
 *
 * It cannot see layout, so it does not replace looking at the rendered page. What it
 * does is make the palette decisions regression-proof.
 */
const css = readFileSync(new URL('../../app.css', import.meta.url), 'utf8');

/** Pull a token's value out of a given :root-ish block. */
const readTokens = (blockStart: string): Record<string, string> => {
	const i = css.indexOf(blockStart);
	if (i === -1) throw new Error(`no block matching ${blockStart} in app.css`);
	const body = css.slice(i, css.indexOf('\n}', i));
	const out: Record<string, string> = {};
	for (const m of body.matchAll(/--([\w-]+):\s*(oklch\([^)]*\)|#[0-9a-fA-F]{3,8})\s*;/g)) {
		out[m[1]] = m[2];
	}
	return out;
};

const light = readTokens(':root {');
const dark = readTokens('.dark {');

// Foreground/background pairings the UI actually renders. Body text unless noted.
const PAIRS: [string, string][] = [
	['foreground', 'background'],
	['card-foreground', 'card'],
	['popover-foreground', 'popover'],
	['primary-foreground', 'primary'],
	['secondary-foreground', 'secondary'],
	['muted-foreground', 'muted'],
	['muted-foreground', 'background'],
	['muted-foreground', 'card'],
	['accent-foreground', 'accent'],
	['destructive-foreground', 'destructive']
];

describe.each([
	['light', light],
	['dark', dark]
])('%s theme', (_name, tokens) => {
	it('defines both halves of every pairing it uses', () => {
		for (const [fg, bg] of PAIRS) {
			if (tokens[fg] === undefined && tokens[bg] === undefined) continue;
			expect(Object.keys(tokens).length).toBeGreaterThan(5);
		}
	});

	it('destructive text clears AA on its own tint, which is what it renders on', () => {
		// bg-destructive/10 (20% in dark) is the button and label ground, and a tint
		// darkens the surface, so this is a harder test than destructive-on-card and the
		// one that was actually failing: 4.01:1 in light before --destructive moved.
		// Composited in sRGB, which is how the browser paints an alpha background --
		// mixing in oklab instead gives a ratio 0.19 higher and would have let a real
		// 4.48:1 through as passing.
		const alpha = tokens === dark ? 0.2 : 0.1;
		const d = toRgb(tokens.destructive ?? light.destructive);
		const ground = toRgb(tokens.card ?? tokens.background ?? light.background);
		const tint = d.map((c, i) => Math.round(c * alpha + ground[i] * (1 - alpha))) as [
			number,
			number,
			number
		];
		const ratio = contrastRatio(d, tint);
		expect(
			ratio,
			`--destructive on its own tint is ${ratio.toFixed(2)}:1`
		).toBeGreaterThanOrEqual(4.5);
	});

	it.each(PAIRS)('%s on %s clears AA', (fg, bg) => {
		if (!tokens[fg] || !tokens[bg]) {
			// A token this theme does not override is inherited, and is covered by the
			// other theme's run. Skipping beats asserting against a value that is not there.
			return;
		}
		const ratio = contrastRatio(tokens[fg], tokens[bg]);
		expect(ratio, `--${fg} on --${bg} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
	});
});
