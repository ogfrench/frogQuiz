// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrastRatio } from './contrast';

// A player who places sees their medal in gold, silver or bronze on their own score pill,
// which is bg-card: white in light, zinc-900 in dark. The inks are hexes in the
// component's style block, so the token guard does not see them; this does. One fixed
// gold used to be 3.25:1 on white.
const svelte = readFileSync(new URL('../play/admin/final_results.svelte', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../app.css', import.meta.url), 'utf8');

const card = (blockStart: string): string => {
	const i = css.indexOf(blockStart);
	const m = css.slice(i, css.indexOf('\n}', i)).match(/--card:\s*(oklch\([^)]*\))/);
	if (!m) throw new Error(`--card not found under ${blockStart}`);
	return m[1];
};
const ink = (selector: string): string => {
	const m = svelte.match(new RegExp(`${selector}\\s*\\{\\s*color:\\s*(#[0-9a-fA-F]{6})`));
	if (!m) throw new Error(`no color for ${selector} in final_results.svelte`);
	return m[1];
};

describe('medal inks on the player score pill', () => {
	it.each([1, 2, 3])('place %i reads at AA in light', (place) => {
		const ratio = contrastRatio(ink(`\\n\\t\\.medal-ink-${place}`), card('\n:root {'));
		expect(ratio).toBeGreaterThanOrEqual(4.5);
	});
	it.each([1, 2, 3])('place %i reads at AA in dark', (place) => {
		const ratio = contrastRatio(
			ink(`:global\\(html\\.dark\\) \\.medal-ink-${place}`),
			card('\n.dark {')
		);
		expect(ratio).toBeGreaterThanOrEqual(4.5);
	});
});
