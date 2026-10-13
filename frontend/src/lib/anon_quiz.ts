// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Ownership secrets for quizzes created without an account, keyed by quiz id.
// The secret is the only thing that proves ownership of such a quiz -- there's
// no account to check against -- so it lives only in this browser's
// localStorage and is sent to the backend as the X-Anon-Secret header.
const STORAGE_KEY = 'frogquiz_anon_secrets';

function readAll(): Record<string, string> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

function writeAll(secrets: Record<string, string>): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(secrets));
	} catch {
		// localStorage can be unavailable (private browsing, blocked site
		// data) -- losing the secret just means this quiz can't be
		// re-edited/re-hosted/claimed later, not a hard failure here.
	}
}

export function getAnonSecret(quizId: string): string | null {
	return readAll()[quizId] ?? null;
}

export function setAnonSecret(quizId: string, secret: string): void {
	const secrets = readAll();
	secrets[quizId] = secret;
	writeAll(secrets);
}

export function clearAnonSecret(quizId: string): void {
	const secrets = readAll();
	delete secrets[quizId];
	writeAll(secrets);
}

export function anonQuizIds(): string[] {
	return Object.keys(readAll());
}

// Set by the sign-in page just before it leaves, read once by the claim prompt.
const JUST_SIGNED_IN = 'frogquiz_just_signed_in';

export function markJustSignedIn(): void {
	try {
		sessionStorage.setItem(JUST_SIGNED_IN, '1');
	} catch {
		/* no prompt then; My Quizzes still offers Claim */
	}
}

export function takeJustSignedIn(): boolean {
	try {
		const set = sessionStorage.getItem(JUST_SIGNED_IN) === '1';
		sessionStorage.removeItem(JUST_SIGNED_IN);
		return set;
	} catch {
		return false;
	}
}

/**
 * A quiz this browser made, read with its secret, or null. Dead secrets (expired, deleted,
 * claimed) are dropped. `/quiz/get/{id}` rather than `/get/public`, which counts a view.
 */
export async function loadAnonQuiz<
	T = { id: string; title: string; expire_at?: string | null; [k: string]: unknown }
>(id: string, doFetch: typeof fetch = fetch): Promise<T | null> {
	const secret = getAnonSecret(id);
	if (!secret) return null;
	try {
		const res = await doFetch(`/api/v1/quiz/get/${id}`, { headers: { 'X-Anon-Secret': secret } });
		if (res.status === 404) {
			clearAnonSecret(id);
			return null;
		}
		if (!res.ok) return null;
		const quiz = await res.json();
		if (quiz.user_id) {
			clearAnonSecret(id);
			return null;
		}
		return quiz;
	} catch {
		// Offline: keep the secret, show less.
		return null;
	}
}

export type ClaimOutcome = 'claimed' | 'gone' | 'limited' | 'failed';

/** Claims one quiz with this browser's secret. A secret another tab already spent is 'gone'. */
export async function claimQuiz(
	id: string,
	doFetch: typeof fetch = fetch
): Promise<{ outcome: ClaimOutcome; status: number | null }> {
	const secret = getAnonSecret(id);
	if (!secret) return { outcome: 'gone', status: null };
	let status: number | null = null;
	try {
		status = (
			await doFetch(`/api/v1/quiz/claim/${id}`, {
				method: 'POST',
				headers: { 'X-Anon-Secret': secret }
			})
		).status;
	} catch {
		return { outcome: 'failed', status: null };
	}
	if (status === 200 || status === 404) clearAnonSecret(id);
	if (status === 200) return { outcome: 'claimed', status };
	if (status === 404) return { outcome: 'gone', status };
	if (status === 429) return { outcome: 'limited', status };
	return { outcome: 'failed', status };
}

const DAY_MS = 86_400_000;

/**
 * Whole days until an anonymous quiz is swept, for display. Rounded rather than
 * ceilinged: the server adds 30 *local* days, so a window that crosses a clock change is
 * 30 days and an hour long, and ceil called a quiz saved a second ago "31 days". Never
 * 0 while the quiz still exists; 0 only once it has expired.
 */
export function anonDaysLeft(
	expire_at: string | Date | null | undefined,
	now = Date.now()
): number | null {
	if (!expire_at) return null;
	const ms = new Date(expire_at).getTime() - now;
	if (ms <= 0) return 0;
	return Math.max(1, Math.round(ms / DAY_MS));
}

export type ClaimFailure = 'expired' | 'gone' | 'signed_out' | 'offline' | 'failed';

/**
 * Why a claim failed, for the message (#43). The server answers every refusal with the
 * same 404, so a claim cannot be used to learn which quizzes exist; the page tells
 * "expired" from "claimed or deleted elsewhere" by the expiry date it already holds.
 * `status` is null when no answer came back at all.
 */
export function claimFailure(
	status: number | null,
	expire_at: string | Date | null | undefined,
	now = Date.now()
): ClaimFailure {
	if (status === null) return 'offline';
	if (status === 401) return 'signed_out';
	if (status === 404) return anonDaysLeft(expire_at, now) === 0 ? 'expired' : 'gone';
	return 'failed';
}
