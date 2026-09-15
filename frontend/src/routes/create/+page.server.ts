// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { redirect } from '@sveltejs/kit';

export async function load({ url, parent }) {
	const { email } = await parent();
	const anon = url.searchParams.get('anon') === 'true';
	if (!email && !anon) {
		redirect(302, '/account/login?returnTo=/create');
	}
	return {};
}
