// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { afterEach, describe, expect, it, vi } from 'vitest';
import { handle } from './hooks.server';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
// Expired, so the hook asks the API to refresh it. The signature is never checked here.
const expired = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'old@example.com', exp: 1 })}.sig`;

const eventWith = (token: string) => ({
	cookies: { get: (k: string) => (k === 'access_token' ? `Bearer ${token}` : undefined) },
	request: new Request('http://localhost/', { headers: { cookie: 'access_token=x' } }),
	locals: {} as { email: string | null }
});

afterEach(() => vi.unstubAllGlobals());

describe('handle, on a token refresh', () => {
	it('keeps the email out of the JSON the API answers with', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(JSON.stringify({ email: 'ana@example.com' }), { status: 200 })
			)
		);
		const event = eventWith(expired);
		await handle({ event: event as any, resolve: async () => new Response('ok') });
		expect(event.locals.email).toBe('ana@example.com');
	});

	it('falls back to the token’s own email if the body is not what it expects', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('not json', { status: 200 }))
		);
		const event = eventWith(expired);
		await handle({ event: event as any, resolve: async () => new Response('ok') });
		expect(event.locals.email).toBe('old@example.com');
	});

	// The access cookie outlives its token (E1), so a token whose session was revoked
	// elsewhere still arrives here. The API refusing to renew it means signed out.
	it('signs the page out when the API refuses to renew the token', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('{"detail":"Not authenticated"}', { status: 401 }))
		);
		const event = eventWith(expired);
		await handle({ event: event as any, resolve: async () => new Response('ok') });
		expect(event.locals.email).toBeNull();
	});

	it('keeps the token’s email when the API cannot be reached', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new TypeError('fetch failed');
			})
		);
		const event = eventWith(expired);
		await handle({ event: event as any, resolve: async () => new Response('ok') });
		expect(event.locals.email).toBe('old@example.com');
	});
});
