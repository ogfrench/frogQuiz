// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { redirect } from '@sveltejs/kit';
import { createGate } from '$lib/create_gate';

// Signed in, this is the editor for a new quiz. Signed out, it depends on the API's
// `anonymous_quizzes_enabled` (#55, off by default): on, the quiz is saved without an
// account and this browser keeps its secret; off, sign in first and come back here.
// Old `?anon=true` links still work; it is ignored.
export async function load({ parent, fetch }) {
	const { email } = await parent();
	let anonymousAllowed: boolean | null = null;
	if (!email) {
		try {
			const res = await fetch(
				`${process.env.API_URL ?? import.meta.env.VITE_API_ORIGIN}/api/v1/utils/config`
			);
			if (res.ok) anonymousAllowed = (await res.json()).anonymous_quizzes_enabled === true;
		} catch {
			/* unknown counts as off: see createGate */
		}
	}
	const target = createGate(Boolean(email), anonymousAllowed);
	if (target) redirect(303, target);
	return {};
}
