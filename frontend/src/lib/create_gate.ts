// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Where /create sends a visitor (#55). Making a quiz needs an account when the API's
// `anonymous_quizzes_enabled` is off. Signed out with it off, sign in
// first and come back, with the query (`?title=` from the command palette) kept. Unknown
// (the API did not answer) is handled as service unavailable by the route, never login.

export function createGate(
	signedIn: boolean,
	anonymousAllowed: boolean | null,
	search = ''
): string | null {
	if (signedIn || anonymousAllowed !== false) return null;
	return `/account/login?returnTo=${encodeURIComponent('/create' + search)}`;
}
