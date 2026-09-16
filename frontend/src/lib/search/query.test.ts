// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { MIN_QUERY_LENGTH, normaliseHit, normaliseHits, searchMode, searchRequest } from './query';

describe('searchMode', () => {
	it('browses when there is no query at all', () => {
		expect(searchMode(null)).toBe('browse');
		expect(searchMode(undefined)).toBe('browse');
		expect(searchMode('')).toBe('browse');
	});

	// `?q=%20%20` is what a submitted empty box produces, and it must not be treated
	// as a two-character query that refuses to run.
	it('browses when the query is only whitespace', () => {
		expect(searchMode('   ')).toBe('browse');
	});

	it('refuses a query shorter than the minimum', () => {
		expect(searchMode('a')).toBe('too_short');
		expect(searchMode('ab')).toBe('too_short');
	});

	it('searches at exactly the minimum', () => {
		expect(searchMode('a'.repeat(MIN_QUERY_LENGTH))).toBe('search');
	});

	it('measures the trimmed length, not the raw one', () => {
		expect(searchMode('  ab  ')).toBe('too_short');
	});
});

describe('searchRequest', () => {
	it('asks for the newest quizzes when browsing', () => {
		expect(searchRequest('')).toEqual({ q: '*', sort: ['created_at:desc'] });
	});

	it('asks for highlights when searching, and sends the trimmed term', () => {
		expect(searchRequest('  frogs  ')).toEqual({
			q: 'frogs',
			attributesToHighlight: ['*']
		});
	});

	// The old page disabled its button below three characters but the load function
	// is reachable directly by URL, so the refusal has to live here too.
	it('sends nothing at all for a too-short query', () => {
		expect(searchRequest('ab')).toBeNull();
	});
});

describe('normaliseHit', () => {
	it('prefers the highlighted title and description', () => {
		expect(
			normaliseHit({
				id: '1',
				title: 'Frogs',
				description: 'About frogs',
				_formatted: { id: '1', title: '<em>Frogs</em>', description: 'About <em>frogs</em>' }
			})
		).toEqual({ id: '1', title: '<em>Frogs</em>', description: 'About <em>frogs</em>' });
	});

	it('passes a browse hit through unchanged, minus the absent _formatted', () => {
		expect(normaliseHit({ id: '1', title: 'Frogs', imported_from_kahoot: true })).toEqual({
			id: '1',
			title: 'Frogs',
			imported_from_kahoot: true
		});
	});

	// The reason only two fields are taken from _formatted. Meilisearch stringifies
	// every value there, so taking the whole object turned `true` into `"true"` and
	// the card's `=== true` test silently stopped matching.
	it('keeps the real boolean rather than the stringified one', () => {
		const hit = normaliseHit({
			id: '1',
			title: 'Frogs',
			imported_from_kahoot: true,
			_formatted: { id: '1', title: '<em>Frogs</em>', imported_from_kahoot: 'true' }
		});
		expect(hit.imported_from_kahoot).toBe(true);
	});

	it('falls back to the raw field when _formatted omits it', () => {
		const hit = normaliseHit({
			id: '1',
			title: 'Frogs',
			description: 'About frogs',
			_formatted: { id: '1', title: '<em>Frogs</em>' }
		});
		expect(hit.description).toBe('About frogs');
	});
});

describe('normaliseHits', () => {
	it('returns an empty list rather than throwing on a failed response', () => {
		expect(normaliseHits(null)).toEqual([]);
		expect(normaliseHits({})).toEqual([]);
		expect(normaliseHits({ detail: 'Not found' })).toEqual([]);
	});

	it('normalises every hit', () => {
		expect(
			normaliseHits({
				hits: [
					{ id: '1', title: 'a', _formatted: { title: '<em>a</em>' } },
					{ id: '2', title: 'b' }
				]
			})
		).toEqual([
			{ id: '1', title: '<em>a</em>' },
			{ id: '2', title: 'b' }
		]);
	});
});
