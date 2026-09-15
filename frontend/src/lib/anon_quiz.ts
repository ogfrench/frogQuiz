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
