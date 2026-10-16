// SPDX-FileCopyrightText: 2026 frogQuiz contributors
// SPDX-License-Identifier: MPL-2.0
import { expect, it, vi } from 'vitest';
import { load } from '../routes/explore/+page';
async function run(response: () => Promise<Response>, loggedIn = false) {
	return await load({
		fetch: vi.fn(response),
		parent: async () => ({ loggedIn }),
		url: new URL('http://localhost/explore')
	} as never);
}
it('reports network, HTTP and malformed responses as failures', async () => {
	for (const response of [
		async () => new Response('', { status: 503 }),
		async () => {
			throw new Error('offline');
		},
		async () => Response.json({})
	]) {
		expect(await run(response)).toMatchObject({ examplesFailed: true });
		expect(await run(response, true)).toMatchObject({ examplesFailed: true, failed: true });
	}
});
it('distinguishes empty results and disabled guests, and recovers', async () => {
	await run(async () => new Response('', { status: 503 }));
	expect(await run(async () => Response.json({ quizzes: [], username: null }))).toMatchObject({
		examplesFailed: false
	});
	expect(await run(async () => new Response('', { status: 401 }))).toMatchObject({
		examplesFailed: false
	});
	expect(await run(async () => Response.json({ quizzes: [{ id: 'example' }] }))).toMatchObject({
		examplesFailed: false,
		examples: { quizzes: [{ id: 'example' }] }
	});
});
