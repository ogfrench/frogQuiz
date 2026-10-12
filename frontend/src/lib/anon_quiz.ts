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
