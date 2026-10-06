// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Who may create, read, change and delete what, asked of the API directly: the UI hiding
// a button is not a guard. A test with a C-number guards the fix for that finding in
// docs/crud-audit-2026-10.md; the comment above it says what used to go wrong.

import { expect, test } from '@playwright/test';
import { signedInContext } from './accounts';
import { mc, saveQuiz, uploadPng as upload } from './helpers';
import { closeAll, next, hostGame } from './sockets';

test.afterEach(() => closeAll());

const quiz = (title: string, extra: Record<string, unknown> = {}) => ({
	title,
	description: 'crud audit',
	questions: [
		mc('Capital of Portugal?', [
			['Lisbon', true],
			['Porto', false]
		])
	],
	...extra
});

test('another account is refused on every owner-only route', async ({ browser, request }) => {
	const owner = await signedInContext(browser, request);
	const other = await signedInContext(browser, request);
	const mine = await saveQuiz(owner.context.request, quiz(`Private ${Date.now()}`));
	expect(mine.status).toBe(200);
	const id = mine.body.id as string;
	const image = await upload(owner.context.request);

	const as = other.context.request;
	const rows: [string, () => Promise<number>, number][] = [
		['GET quiz/get', async () => (await as.get(`/api/v1/quiz/get/${id}`)).status(), 404],
		[
			'POST quiz/start',
			async () => (await as.post(`/api/v1/quiz/start/${id}?game_mode=kahoot`)).status(),
			404
		],
		[
			'DELETE quiz/delete',
			async () => (await as.delete(`/api/v1/quiz/delete/${id}`)).status(),
			404
		],
		[
			'POST editor/start edit',
			async () => (await as.post(`/api/v1/editor/start?edit=true&quiz_id=${id}`)).status(),
			404
		],
		[
			'GET eximport/excel',
			async () => (await as.get(`/api/v1/eximport/excel/${id}`)).status(),
			404
		],
		[
			'GET storage/meta',
			async () => (await as.get(`/api/v1/storage/meta/${image}`)).status(),
			404
		],
		[
			'PUT storage/meta',
			async () =>
				(
					await as.put(`/api/v1/storage/meta/${image}`, { data: { alt_text: 'x' } })
				).status(),
			404
		],
		[
			'DELETE storage/meta',
			async () => (await as.delete(`/api/v1/storage/meta/${image}`)).status(),
			404
		]
	];
	for (const [name, call, want] of rows) expect.soft(await call(), name).toBe(want);

	// The owner still has everything, so the 404s above are about who asked.
	expect((await owner.context.request.get(`/api/v1/quiz/get/${id}`)).status()).toBe(200);
	expect((await owner.context.request.get(`/api/v1/storage/meta/${image}`)).status()).toBe(200);
	await owner.context.close();
	await other.context.close();
});

test('signed out, the account routes answer 401', async ({ request }) => {
	for (const [method, url] of [
		['get', '/api/v1/quiz/list'],
		['get', '/api/v1/storage/list'],
		['get', '/api/v1/storage/limit'],
		['get', '/api/v1/users/me'],
		['get', '/api/v1/users/sessions/list'],
		['get', '/api/v1/results/list'],
		['delete', '/api/v1/users/signout-everywhere']
	] as const) {
		expect.soft((await request[method](url)).status(), `${method} ${url}`).toBe(401);
	}
});

test('admin and moderation routes refuse an ordinary account', async ({ browser, request }) => {
	const user = await signedInContext(browser, request);
	const victim = await signedInContext(browser, request);
	const me = await (await victim.context.request.get('/api/v1/users/me')).json();
	const as = user.context.request;
	for (const [name, status] of [
		[
			'admin delete by id',
			(await as.delete(`/api/v1/admin/user/id?user_id=${me.id}`)).status()
		],
		[
			'admin delete by email',
			(await as.delete(`/api/v1/admin/user/email?email=${me.email}`)).status()
		],
		['moderation quizzes', (await as.get('/api/v1/moderation/quizzes')).status()],
		['moderation status', (await as.get('/api/v1/moderation/status')).status()]
	] as const) {
		expect.soft(status, name).toBeGreaterThanOrEqual(400);
		expect.soft(status, name).toBeLessThan(500);
	}
	// And the victim is still there.
	expect((await victim.context.request.get('/api/v1/users/me')).status()).toBe(200);
	await user.context.close();
	await victim.context.close();
});

test('routers switched off by a flag are not reachable', async ({ browser, request }) => {
	const user = await signedInContext(browser, request);
	const as = user.context.request;
	const quizId = (await saveQuiz(as, { ...quiz(`Rated ${Date.now()}`), public: true })).body.id;
	for (const [name, status] of [
		['quiztivity list', (await as.get('/api/v1/quiztivity/')).status()],
		['box-controller list', (await as.get('/api/v1/box-controller/web/list')).status()],
		[
			'ratings',
			(await as.post(`/api/v1/community/rate/${quizId}`, { data: { type: 'LIKE' } })).status()
		]
	] as const) {
		expect.soft(status, name).toBe(404);
	}
	await user.context.close();
});

// C1. D18 made the Excel answer key the owner's alone, and journey-teammate checks it with
// "hiding a button is not a guard". The .cqa export next to it was missed: eximport.py
// took the user as `_` and exported whatever id it was given.
test('another account cannot export somebody else’s private quiz as a file', async ({
	browser,
	request
}) => {
	const owner = await signedInContext(browser, request);
	const other = await signedInContext(browser, request);
	const id = (await saveQuiz(owner.context.request, quiz(`Export ${Date.now()}`))).body.id;
	expect((await owner.context.request.get(`/api/v1/eximport/${id}`)).status()).toBe(200);
	expect((await other.context.request.get(`/api/v1/eximport/${id}`)).status()).toBe(404);
	await owner.context.close();
	await other.context.close();
});

// C4. The export token is minted for one game's results, but export_data read the PIN
// from the query string, so a host could pull another game's player scores and custom
// fields (which can hold an email address). An unknown PIN was a 500.
test('an export token only opens the game it was made for', async ({ request }) => {
	const a = await hostGame(request, quiz(`Game A ${Date.now()}`));
	const b = await hostGame(request, quiz(`Game B ${Date.now()}`));
	const tokenFor = async () => {
		const got = next<string>(a.host, 'export_token');
		a.host.emit('get_export_token');
		const token = await got;
		expect(token).toBeTruthy();
		return token;
	};
	const unknown = await request.get(
		`/api/v1/quiz/export_data/${await tokenFor()}?game_pin=000000`
	);
	expect.soft(unknown.status(), 'unknown pin').toBe(404);
	const crossed = await request.get(
		`/api/v1/quiz/export_data/${await tokenFor()}?game_pin=${b.pin}`
	);
	expect(crossed.status(), 'token for game A, pin of game B').toBeGreaterThanOrEqual(400);
	expect(crossed.status()).toBeLessThan(500);
});

// C11. /storage/list filtered out deleted rows; /storage/list/last did not.
test('a deleted image is not listed among the latest uploads', async ({ browser, request }) => {
	const user = await signedInContext(browser, request);
	const as = user.context.request;
	const id = await upload(as);
	expect((await as.delete(`/api/v1/storage/meta/${id}`)).status()).toBe(200);
	const latest = (await (await as.get('/api/v1/storage/list/last')).json()) as { id: string }[];
	expect(latest.map((i) => i.id)).not.toContain(id);
	await user.context.close();
});

// C12. Free-text fields had no upper bound. alt_text is the one that matters: it is sent
// back base64-encoded in an X-Alt-Text header on every download of the image, and a
// header of that size is refused by most proxies.
test('image alt text has an upper bound', async ({ browser, request }) => {
	const user = await signedInContext(browser, request);
	const as = user.context.request;
	const id = await upload(as);
	const res = await as.put(`/api/v1/storage/meta/${id}`, {
		data: { alt_text: 'a'.repeat(100_000) }
	});
	expect(res.status()).toBe(422);
	await user.context.close();
});

test('the quiz list refuses an absurd page size', async ({ browser, request }) => {
	const user = await signedInContext(browser, request);
	const res = await user.context.request.get('/api/v1/quiz/list?page_size=1000000');
	expect(res.status()).toBe(422);
	await user.context.close();
});
