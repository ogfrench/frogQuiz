// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	anonDaysLeft,
	claimFailure,
	claimQuiz,
	getAnonSecret,
	loadAnonQuiz,
	markJustSignedIn,
	setAnonSecret,
	takeJustSignedIn
} from './anon_quiz';

function memoryStorage(): Storage {
	const m = new Map<string, string>();
	return {
		get length() {
			return m.size;
		},
		clear: () => m.clear(),
		getItem: (k) => m.get(k) ?? null,
		key: (i) => [...m.keys()][i] ?? null,
		removeItem: (k) => void m.delete(k),
		setItem: (k, v) => void m.set(k, String(v))
	};
}

const reply = (status: number, body: unknown = {}) =>
	vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('claiming from this browser', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', memoryStorage());
		vi.stubGlobal('sessionStorage', memoryStorage());
	});
	afterEach(() => vi.unstubAllGlobals());

	it('the just-signed-in flag is read once', () => {
		expect(takeJustSignedIn()).toBe(false);
		markJustSignedIn();
		expect(takeJustSignedIn()).toBe(true);
		expect(takeJustSignedIn()).toBe(false);
	});

	it('a claim spends the secret on 200 and on 404, and keeps it otherwise', async () => {
		setAnonSecret('a', 's');
		expect((await claimQuiz('a', reply(200))).outcome).toBe('claimed');
		expect(getAnonSecret('a')).toBeNull();
		setAnonSecret('b', 's');
		expect((await claimQuiz('b', reply(404))).outcome).toBe('gone');
		expect(getAnonSecret('b')).toBeNull();
		setAnonSecret('c', 's');
		expect((await claimQuiz('c', reply(429))).outcome).toBe('limited');
		expect(getAnonSecret('c')).toBe('s');
		const down = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		});
		expect((await claimQuiz('c', down)).outcome).toBe('failed');
		expect(getAnonSecret('c')).toBe('s');
	});

	// Two tabs: the first tab's claim took the secret out of the storage both share.
	it('a secret another tab already spent is skipped without a request', async () => {
		const fetch = reply(200);
		expect((await claimQuiz('gone', fetch)).outcome).toBe('gone');
		expect(fetch).not.toHaveBeenCalled();
	});

	it('loads a quiz with its secret and drops dead ones, without counting a view', async () => {
		setAnonSecret('live', 's1');
		const fetch = reply(200, { id: 'live', title: 'Mine', user_id: null });
		expect(await loadAnonQuiz('live', fetch)).toMatchObject({ title: 'Mine' });
		expect(fetch).toHaveBeenCalledWith('/api/v1/quiz/get/live', {
			headers: { 'X-Anon-Secret': 's1' }
		});
		setAnonSecret('expired', 's2');
		expect(await loadAnonQuiz('expired', reply(404))).toBeNull();
		expect(getAnonSecret('expired')).toBeNull();
		setAnonSecret('claimed', 's3');
		expect(
			await loadAnonQuiz('claimed', reply(200, { id: 'claimed', user_id: 'u' }))
		).toBeNull();
		expect(getAnonSecret('claimed')).toBeNull();
		setAnonSecret('down', 's4');
		expect(await loadAnonQuiz('down', reply(503))).toBeNull();
		expect(getAnonSecret('down')).toBe('s4');
	});
});

const DAY = 86_400_000;
const HOUR = 3_600_000;
const now = Date.UTC(2026, 8, 29, 12);

describe('anonDaysLeft', () => {
	it('calls a fresh quiz 30 days even when the window crosses a clock change', () => {
		// 30 local days across the end of summer time is 30 days and one hour.
		expect(anonDaysLeft(new Date(now + 30 * DAY + HOUR), now)).toBe(30);
	});

	it('never says 0 days for a quiz that still exists', () => {
		expect(anonDaysLeft(new Date(now + HOUR), now)).toBe(1);
	});

	it('says 0 once it has expired, and nothing when there is no expiry', () => {
		expect(anonDaysLeft(new Date(now - HOUR), now)).toBe(0);
		expect(anonDaysLeft(null, now)).toBeNull();
	});
});

// #43: a claim never fails silently, and the message says what happened and what to do.
describe('claimFailure', () => {
	it('says a quiz past its 30 days expired', () => {
		expect(claimFailure(404, new Date(now - HOUR), now)).toBe('expired');
	});
	it('says a live quiz that answers 404 was claimed or deleted elsewhere', () => {
		expect(claimFailure(404, new Date(now + DAY), now)).toBe('gone');
		expect(claimFailure(404, null, now)).toBe('gone');
	});
	it('asks a signed-out session to sign in again', () => {
		expect(claimFailure(401, new Date(now + DAY), now)).toBe('signed_out');
	});
	it('blames the connection when there was no answer, and anything else is a retry', () => {
		expect(claimFailure(null, new Date(now + DAY), now)).toBe('offline');
		expect(claimFailure(500, new Date(now + DAY), now)).toBe('failed');
	});
});
