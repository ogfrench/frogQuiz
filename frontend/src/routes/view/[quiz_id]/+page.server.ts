// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
//
// SPDX-License-Identifier: MPL-2.0

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { quiz_id } = params;
	const { email, anonymousQuizzes } = await parent();
	const res = await fetch(
		`${process.env.API_URL ?? import.meta.env.VITE_API_ORIGIN}/api/v1/quiz/get/public/${quiz_id}`
	);
	if (res.status === 404 || res.status === 400) {
		error(404);
	} else if (res.status === 200) {
		const quiz = await res.json();
		return {
			quiz,
			logged_in: Boolean(email),
			anonymous_quizzes_enabled: anonymousQuizzes === true
		};
	} else {
		error(500);
	}
};
