// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Copy to my quizzes (#39, D33): the view page and My Quizzes make the same request and
// answer a failure the same way, so the request and the failure live here.

export type CopyFailure = 'storage_full' | 'failed';

export type CopyResult =
	| { ok: true; id: string; anonSecret: string | null }
	| { ok: false; reason: CopyFailure };

/**
 * Why a copy failed, as the key under `copy.` for its message. The API says which of its
 * answers the person can do something about: 409 is the storage limit, which deleting a
 * quiz or its files fixes. The rest (a quiz that is gone, a signed-out session, a rate
 * limit, no server) is "try again". `status` is null when no answer came back at all.
 */
export const copyFailure = (status: number | null): CopyFailure =>
	status === 409 ? 'storage_full' : 'failed';

/** Makes the copy. Never throws: a dead server is a failure like any other. */
export async function copyQuiz(quizId: string, doFetch: typeof fetch = fetch): Promise<CopyResult> {
	let status: number | null = null;
	try {
		const res = await doFetch(`/api/v1/quiz/copy/${quizId}`, { method: 'POST' });
		status = res.status;
		if (res.ok) {
			const { id } = await res.json();
			if (typeof id === 'string' && id !== '') {
				return { ok: true, id, anonSecret: res.headers.get('X-Anon-Secret') };
			}
		}
	} catch {
		/* no answer, or a body that was not JSON: status stays as it was */
	}
	return { ok: false, reason: copyFailure(status) };
}
