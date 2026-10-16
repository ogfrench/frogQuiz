// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { error, redirect } from '@sveltejs/kit';
import { createGate } from '$lib/create_gate';

// Signed in, this is the editor for a new quiz. Signed out, it depends on the API's
// `anonymous_quizzes_enabled` (#55, on by default), which the root layout reads: on, the
// quiz is saved without an account and this browser keeps its secret; off, sign in first
// and come back here. Old `?anon=true` links still work; it is ignored.
export async function load({ parent, url }) {
	const { email, anonymousQuizzes } = await parent();
	if (!email && anonymousQuizzes === null)
		error(503, 'Quiz creation is temporarily unavailable. Please try again.');
	const target = createGate(Boolean(email), anonymousQuizzes, url.search);
	if (target) redirect(303, target);
	return {};
}
