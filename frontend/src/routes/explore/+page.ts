// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import type { PageLoad } from './$types';
import {
	noExamples,
	normaliseExamples,
	normaliseHits,
	searchMode,
	searchRequest,
	withoutAuthor,
	type Examples
} from '$lib/search/query';

/**
 * One page, two modes, decided by `?q=`. Explore browsed and Search searched; they hit
 * the same endpoint with different bodies, so the split was never more than this.
 *
 * `fetch` comes from the load so the relative URL resolves during SSR -- `/search` was
 * client-only and its `window.fetch` would have had no origin to resolve against here.
 */
export const load = (async ({ fetch, url }) => {
	const q = url.searchParams.get('q') ?? '';
	const mode = searchMode(q);
	const body = searchRequest(q);

	if (body === null) {
		return { q, mode, hits: [], failed: false, examples: noExamples };
	}

	// The examples (#39) sit above Newest, so they belong to browsing only; a search is
	// just its results. Asked for alongside the search rather than after it.
	const [response, examples] = await Promise.all([
		fetch('/api/v1/search/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		mode === 'browse' ? loadExamples(fetch) : noExamples
	]);

	// Explore used to `await response.json()` unconditionally and hand whatever came
	// back to the page, so a 500 from Meilisearch reached the template as an error
	// object and threw on `.hits`. A failed search is an empty page with a message.
	if (!response.ok) {
		return { q, mode, hits: [], failed: true, examples };
	}

	const hits = withoutAuthor(normaliseHits(await response.json()), examples.username);
	return { q, mode, hits, failed: false, examples };
}) satisfies PageLoad;

/** No examples, quietly, when the API is down, refuses, or has none: Newest still shows. */
async function loadExamples(fetch: typeof globalThis.fetch): Promise<Examples> {
	try {
		const res = await fetch('/api/v1/quiz/examples');
		return res.ok ? normaliseExamples(await res.json()) : noExamples;
	} catch {
		return noExamples;
	}
}
