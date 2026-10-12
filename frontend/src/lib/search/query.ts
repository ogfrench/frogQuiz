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

/** One ready-made quiz, as GET /api/v1/quiz/examples lists it. */
export interface ExampleQuiz {
	id: string;
	title: string;
	description: string | null;
	questions: number;
}

export interface Examples {
	/** The account that owns them, so Newest can leave its quizzes out. Null: none seeded. */
	username: string | null;
	quizzes: ExampleQuiz[];
}

export const noExamples: Examples = { username: null, quizzes: [] };

/**
 * The examples response, or "no examples" for anything else. Explore is the one page every
 * signed-in person opens, and the examples are a nicety on it: a 401, a 500 or an old API
 * without the route must leave the page as it was, not throw.
 */
export const normaliseExamples = (payload: unknown): Examples => {
	const body = payload as { username?: unknown; quizzes?: unknown } | null;
	if (!body || !Array.isArray(body.quizzes)) return noExamples;
	return {
		username: typeof body.username === 'string' ? body.username : null,
		quizzes: body.quizzes.filter((q) => q && typeof q === 'object') as ExampleQuiz[]
	};
};

/**
 * Hits without those of one account. The examples are listed above Newest, and they are
 * public quizzes like any other, so without this each would show up twice.
 */
export const withoutAuthor = <T extends { user?: unknown }>(
	hits: T[],
	username: string | null
): T[] => (username === null ? hits : hits.filter((hit) => hit.user !== username));
