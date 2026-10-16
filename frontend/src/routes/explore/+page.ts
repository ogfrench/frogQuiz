// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
// SPDX-License-Identifier: MPL-2.0

import { browser } from '$app/environment';
import type { PageLoad } from './$types';
import {
	noExamples,
	normaliseExamples,
	normaliseHits,
	searchMode,
	searchRequest,
	withoutAuthor
} from '$lib/search/query';

// On the server these run after the layout's config request (up to 2 s), inside a Netlify
// function that ends at 10 s, so they give up sooner there than in the browser.
const TIMEOUT = browser ? 15_000 : 5_000;

export const load = (async ({ fetch, url, parent }) => {
	const { loggedIn: logged_in } = await parent();
	const q = url.searchParams.get('q') ?? '';
	const mode = searchMode(q);
	const body = searchRequest(q);
	const examplesPromise =
		!logged_in || mode === 'browse'
			? loadExamples(fetch)
			: Promise.resolve({ examples: noExamples, examplesFailed: false });
	const searchPromise =
		logged_in && body !== null
			? loadSearch(fetch, body)
			: Promise.resolve({ hits: [], failed: false });
	const [examples, search] = await Promise.all([examplesPromise, searchPromise]);
	return {
		q,
		mode,
		logged_in,
		...examples,
		...search,
		hits: withoutAuthor(search.hits, examples.examples.username)
	};
}) satisfies PageLoad;

async function loadSearch(fetch: typeof globalThis.fetch, body: object) {
	try {
		const response = await fetch('/api/v1/search/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(TIMEOUT)
		});
		if (!response.ok) throw new Error('Search unavailable');
		const payload = await response.json();
		if (!Array.isArray(payload?.hits)) throw new Error('Invalid search response');
		return { hits: normaliseHits(payload), failed: false };
	} catch {
		return { hits: [], failed: true };
	}
}

async function loadExamples(fetch: typeof globalThis.fetch) {
	try {
		const res = await fetch('/api/v1/quiz/examples', { signal: AbortSignal.timeout(TIMEOUT) });
		// Explicitly disabled guest access is not an outage.
		if (res.status === 401 || res.status === 403)
			return { examples: noExamples, examplesFailed: false };
		if (!res.ok) throw new Error('Examples unavailable');
		const payload = await res.json();
		if (!Array.isArray(payload?.quizzes)) throw new Error('Invalid examples response');
		return { examples: normaliseExamples(payload), examplesFailed: false };
	} catch {
		return { examples: noExamples, examplesFailed: true };
	}
}
