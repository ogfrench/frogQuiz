// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Where /create sends a visitor (#55). Making a quiz needs an account unless the API's
// `anonymous_quizzes_enabled` is on; it is off by default. Signed out with it off, sign in
// first and come back, with the query (`?title=` from the command palette) kept. Unknown
// (the API did not answer) counts as off: the API refuses an anonymous save anyway, and an
// editor that cannot save loses what was typed.

export function createGate(
	signedIn: boolean,
	anonymousAllowed: boolean | null,
	search = ''
): string | null {
	if (signedIn || anonymousAllowed === true) return null;
	return `/account/login?returnTo=${encodeURIComponent('/create' + search)}`;
}
