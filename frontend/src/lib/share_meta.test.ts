// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { quizShare } from './share_meta';

const HOME = 'https://x.test/home.jpg';

describe('what a pasted quiz link shows', () => {
	it('names the quiz in plain text, whatever markup its title carries', () => {
		const s = quizShare(
			{ title: '<b>Frogs</b> &amp; toads', description: '' },
			'https://x.test',
			HOME
		);
		expect(s.title).toBe('frogQuiz - Frogs & toads');
	});

	it('says a line about it, cut at a sensible length, or a plain one when it has none', () => {
		const long = quizShare(
			{ title: 'T', description: 'word '.repeat(100) },
			'https://x.test',
			HOME
		);
		expect(long.description.length).toBeLessThanOrEqual(200);
		expect(long.description.endsWith('…')).toBe(true);
		const none = quizShare({ title: 'T', description: '' }, 'https://x.test', HOME);
		expect(none.description).toContain('frogQuiz');
	});

	it('uses its cover when it has one, and the site card when it has not', () => {
		const withCover = quizShare(
			{ title: 'T', description: '', cover_image: 'a b.png' },
			'https://x.test',
			HOME
		);
		expect(withCover.image).toBe('https://x.test/api/v1/storage/download/a%20b.png');
		expect(withCover.hasCover).toBe(true);
		const without = quizShare({ title: 'T', description: '' }, 'https://x.test', HOME);
		expect(without.image).toBe(HOME);
		expect(without.hasCover).toBe(false);
	});

	it('never leaves the title empty', () => {
		expect(quizShare({ title: '  ', description: '' }, 'https://x.test', HOME).title).toBe(
			'frogQuiz - A quiz'
		);
	});
});
