// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { redirect } from '@sveltejs/kit';

// Discover is for signed-in accounts since 5 Oct, and only frog and Capgemini addresses can
// sign in, so a public quiz is visible to the team rather than to the internet. The search
// API refuses everyone else too; this sends them to sign in, then back here.
export async function load({ parent, url }) {
	const { email } = await parent();
	if (!email) {
		redirect(302, `/account/login?returnTo=${encodeURIComponent(url.pathname + url.search)}`);
	}
	return {};
}
