// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/**
 * Explore and Search are one page now. The route stays because `/search?q=…` URLs have
 * been shared, and the query is carried across so those links still land on results
 * rather than on a browse listing.
 */
export const load = (({ url }) => {
	const q = url.searchParams.get('q');
	redirect(302, q ? `/explore?q=${encodeURIComponent(q)}` : '/explore');
}) satisfies PageLoad;
