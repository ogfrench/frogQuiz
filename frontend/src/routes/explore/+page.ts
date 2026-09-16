// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import type { PageLoad } from './$types';
import { normaliseHits, searchMode, searchRequest } from '$lib/search/query';

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
		return { q, mode, hits: [], failed: false };
	}

	const response = await fetch('/api/v1/search/', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

	// Explore used to `await response.json()` unconditionally and hand whatever came
	// back to the page, so a 500 from Meilisearch reached the template as an error
	// object and threw on `.hits`. A failed search is an empty page with a message.
	if (!response.ok) {
		return { q, mode, hits: [], failed: true };
	}

	return { q, mode, hits: normaliseHits(await response.json()), failed: false };
}) satisfies PageLoad;
