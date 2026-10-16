// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { signedIn } from '$lib/stores';
import type { LayoutServerLoad } from './$types';

// Whether a quiz can be made without an account (#55, on by default). The copy on the
// home page and My Quizzes depends on it, and /create's gate reads it from here. Null when
// the API did not answer in time: preserve this as unavailable, distinct from disabled.
// ponytail: cached a minute per server instance, so a room of phones opening /play does not
// each wait on the API. The setting only changes with an API restart.
// A failure is remembered for a few seconds too: while the API hangs, every page would
// otherwise wait out the whole timeout again, and Netlify ends a function at 10 s.
let config: { anonymousQuizzes: boolean; at: number } | null = null;
let failedAt = 0;

async function anonymousQuizzes(fetch: typeof globalThis.fetch): Promise<boolean | null> {
	if (config && Date.now() - config.at < 60_000) return config.anonymousQuizzes;
	if (Date.now() - failedAt < 5_000) return null;
	const unavailable = () => {
		failedAt = Date.now();
		return null;
	};
	try {
		const res = await fetch(
			`${process.env.API_URL ?? import.meta.env.VITE_API_ORIGIN}/api/v1/utils/config`,
			{ signal: AbortSignal.timeout(2000) }
		);
		if (!res.ok) return unavailable();
		const body = await res.json();
		if (typeof body.anonymous_quizzes_enabled !== 'boolean') return unavailable();
		config = {
			anonymousQuizzes: body.anonymous_quizzes_enabled,
			at: Date.now()
		};
		return config.anonymousQuizzes;
	} catch {
		return unavailable();
	}
}

export const load: LayoutServerLoad = async ({ locals, fetch, depends }) => {
	depends('app:config');
	if (locals.email) {
		signedIn.set(true);
	} else {
		signedIn.set(false);
	}
	return {
		email: locals.email,
		anonymousQuizzes: await anonymousQuizzes(fetch)
	};
};
