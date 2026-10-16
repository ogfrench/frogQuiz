// SPDX-FileCopyrightText: 2026 frogQuiz contributors
// SPDX-License-Identifier: MPL-2.0

/** No infrastructure details in the public banner; never mistake an HTML proxy page for health. */
export function healthMessage(payload: unknown, ok: boolean): string | null {
	const body = payload as { status?: string; search?: string } | null;
	if (!ok || !body || !['ok', 'degraded'].includes(body.status ?? '')) {
		return 'We’re having trouble connecting. Saving quizzes and hosting may be unavailable. Keep this tab open and try again.';
	}
	if (body.status === 'degraded') {
		return body.search === 'down'
			? 'Quiz search is temporarily unavailable. Other features may still work.'
			: 'Some services are temporarily unavailable. Please try again shortly.';
	}
	return null;
}
