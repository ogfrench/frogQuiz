// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { error } from '@sveltejs/kit';
import { signedIn } from '$lib/stores';

// This guard only ever checked whether the visitor is logged in, never
// whether they own the quiz being edited -- that's enforced server-side by
// /editor/start. So a quiz created without an account can be edited here too:
// the client-side editor proves ownership with the localStorage secret
// instead of a login, and /editor/start 404s if that secret is wrong/missing.
export async function load({ url, parent }) {
	const quiz_id = url.searchParams.get('quiz_id');
	const { email } = await parent();

	if (email) {
		signedIn.set(true);
	}

	if (quiz_id === null) {
		error(404);
	}
	return {
		quiz_id
	};
}
