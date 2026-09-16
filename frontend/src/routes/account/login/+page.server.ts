// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
//
// SPDX-License-Identifier: MPL-2.0

import { redirect } from '@sveltejs/kit';

export async function load({ parent, url }) {
	const verified = url.searchParams.get('verified');
	const returnTo =
		url.searchParams.get('returnTo') !== null ? url.searchParams.get('returnTo') : '/dashboard';

	const { email } = await parent();
	if (email) {
		redirect(302, returnTo);
	}
	// The raw value, not a boolean: /api/v1/users/verify sends people here with
	// verified=expired when the link has already been used or superseded, and
	// `verified !== null` showed those the "confirmed!" badge.
	return {
		verified
	};
}
