// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

/**
 * Explore and Search used to be two pages hitting the same Meilisearch endpoint with
 * two different bodies: Explore sent `{q:'*', sort:['created_at:desc']}` from a load
 * function, Search sent `{q, attributesToHighlight:['*']}` from a client fetch. They
 * are one page now, and this is the part that decides which of the two it is.
 *
 * It lives here rather than in the load function so it can be tested: the branching
 * and the hit shape are the whole of the merge, and neither had a test.
 */

/** Meilisearch is happy with shorter, but two characters matches most of the index. */
export const MIN_QUERY_LENGTH = 3;

export type SearchMode = 'browse' | 'search' | 'too_short';

export interface SearchRequest {
	q: string;
	sort?: string[];
	attributesToHighlight?: string[];
}

export const searchMode = (raw: string | null | undefined): SearchMode => {
	const q = (raw ?? '').trim();
	if (q === '') return 'browse';
	return q.length < MIN_QUERY_LENGTH ? 'too_short' : 'search';
};

/**
 * The request body for a query, or `null` when there is nothing worth asking for --
 * a one- or two-character query is not sent at all rather than sent and discarded.
 */
export const searchRequest = (raw: string | null | undefined): SearchRequest | null => {
	const q = (raw ?? '').trim();
	switch (searchMode(raw)) {
		case 'browse':
			return { q: '*', sort: ['created_at:desc'] };
		case 'search':
			return { q, attributesToHighlight: ['*'] };
		default:
			return null;
	}
};

/**
 * One hit shape for the card, whichever mode produced it.
 *
 * Only `title` and `description` are taken from `_formatted`. Meilisearch stringifies
 * every value in `_formatted`, so `imported_from_kahoot` arrives as the string
 * `"true"` -- and the card tests it with `=== true`, which is why a Kahoot import
 * always read as "Made by" on the old search page and "Imported by" on explore. The
 * rest of the hit keeps its real types.
 */
export const normaliseHit = (hit: Record<string, unknown>): Record<string, unknown> => {
	const formatted = hit?._formatted as Record<string, unknown> | undefined;
	const { _formatted, ...raw } = hit ?? {};
	void _formatted;
	if (!formatted) return raw;
	return {
		...raw,
		title: formatted.title ?? raw.title,
		description: formatted.description ?? raw.description
	};
};

export const normaliseHits = (payload: unknown): Record<string, unknown>[] => {
	const hits = (payload as { hits?: unknown } | null)?.hits;
	if (!Array.isArray(hits)) return [];
	return hits.filter((h) => h && typeof h === 'object').map(normaliseHit);
};
