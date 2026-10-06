// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrastRatio } from './contrast';

// Search results mark the matched words with <mark>. Its color is set in app.css's base
// layer rather than as a theme token, so the token guard does not see it; this does.
const css = readFileSync(new URL('../../app.css', import.meta.url), 'utf8');

const tokenIn = (blockStart: string, name: string): string => {
	const i = css.indexOf(blockStart);
	const body = css.slice(i, css.indexOf('\n}', i));
	const m = body.match(new RegExp(`--${name}:\\s*(oklch\\([^)]*\\))`));
	if (!m) throw new Error(`--${name} not found under ${blockStart}`);
	return m[1];
};
const markBackground = (selector: string): string => {
	const m = css.match(
		new RegExp(`${selector}\\s*\\{[^}]*background-color:\\s*(oklch\\([^)]*\\))`)
	);
	if (!m) throw new Error(`no background-color for ${selector} in app.css`);
	return m[1];
};

describe('search highlight', () => {
	it.each([
		['light', '\n:root {', '\tmark'],
		['dark', '\n.dark {', 'html\\.dark mark']
	])('reads at AA in the %s theme', (_theme, block, selector) => {
		const ratio = contrastRatio(tokenIn(block, 'foreground'), markBackground(selector));
		expect(ratio).toBeGreaterThanOrEqual(4.5);
	});

	it('is not the browser default yellow', () => {
		expect(css).toMatch(/\tmark\s*\{[^}]*background-color/);
	});
});
