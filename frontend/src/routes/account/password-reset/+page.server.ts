// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { redirect } from '@sveltejs/kit';
import { safeReturnTo } from '$lib/return_to';

// Sign-in is by emailed link since 5 Oct, and a first sign-in makes the account, so there
// is no registration and no password to reset. The page is kept for ENABLE_PASSWORD_LOGIN.
export async function load({ url }) {
	const returnTo = safeReturnTo(url.searchParams.get('returnTo'), '');
	redirect(
		302,
		returnTo ? `/account/login?returnTo=${encodeURIComponent(returnTo)}` : '/account/login'
	);
}
