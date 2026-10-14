// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it, vi } from 'vitest';
import { copyFailure, copyQuiz } from './copy_quiz';

const reply = (status: number, body: unknown = {}) =>
	vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('copyFailure', () => {
	it('names the storage limit, which the person can fix by deleting something', () => {
		expect(copyFailure(409)).toBe('storage_full');
	});

	// 404 (not yours any more), 401 (signed out), 429 (too many) and a dead server all
	// get the one message that says try again; none of them is something to act on here.
	it('says "failed" for everything else, including no answer at all', () => {
		for (const status of [401, 404, 429, 500, null]) {
			expect(copyFailure(status)).toBe('failed');
		}
	});
});

describe('copyQuiz', () => {
	it('posts to the copy endpoint and returns the new id', async () => {
		const fetch = reply(200, { id: 'new-id' });
		expect(await copyQuiz('old-id', fetch)).toEqual({ ok: true, id: 'new-id', anonSecret: null });
		expect(fetch).toHaveBeenCalledWith('/api/v1/quiz/copy/old-id', { method: 'POST' });
	});

	it('returns the one-time ownership secret for an anonymous copy', async () => {
		const fetch = vi.fn(
			async () => new Response(JSON.stringify({ id: 'new-id' }), {
				status: 200,
				headers: { 'X-Anon-Secret': 'ownership-secret' }
			})
		);
		expect(await copyQuiz('old-id', fetch)).toEqual({
			ok: true,
			id: 'new-id',
			anonSecret: 'ownership-secret'
		});
	});

	it('maps a 409 to the storage message', async () => {
		expect(await copyQuiz('x', reply(409, { detail: 'Storage limit reached' }))).toEqual({
			ok: false,
			reason: 'storage_full'
		});
	});

	it('maps a network error to a failure rather than throwing', async () => {
		const down = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		});
		expect(await copyQuiz('x', down)).toEqual({ ok: false, reason: 'failed' });
	});

	// A 200 whose body has no id would send the person to /edit?quiz_id=undefined.
	it('treats a 200 without an id as a failure', async () => {
		expect(await copyQuiz('x', reply(200, {}))).toEqual({ ok: false, reason: 'failed' });
	});
});
