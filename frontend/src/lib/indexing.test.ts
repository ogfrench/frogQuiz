// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
// SPDX-License-Identifier: MPL-2.0

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FRONTEND = join(import.meta.dirname, '../..');
const read = (rel: string) => readFileSync(join(FRONTEND, rel), 'utf8');

describe('keeping an internal tool out of search results', () => {
	it('tells search engines not to index any page', () => {
		expect(read('src/app.html')).toMatch(/<meta\s+name="robots"\s+content="noindex, nofollow"/);
		expect(read('../netlify.toml')).toMatch(/X-Robots-Tag = "noindex, nofollow"/);
	});

	/* A crawler obeys noindex only on a page it may fetch, and Slack and Teams read robots.txt
	   before building a link preview. Disallowing the site would break both. */
	it('does not disallow the site in robots.txt', () => {
		const rules = read('static/robots.txt')
			.split('\n')
			.filter((l) => !l.trim().startsWith('#') && l.trim());
		expect(rules).toContain('User-agent: *');
		expect(rules.filter((l) => /^Disallow:\s*\S/.test(l))).toEqual([]);
	});
});
