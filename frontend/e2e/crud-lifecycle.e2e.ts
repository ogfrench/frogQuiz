// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// What deleting or changing something leaves behind: files on disk, the account's
// storage quota, rows the API still answers for. These need the arq worker, which
// run.sh starts: it is what hashes an upload, counts it against the quota and links an
// edited quiz to its images. Before it ran here, none of that had ever been exercised
// end to end. A test with a C-number guards the fix for that finding in
// docs/crud-audit-2026-10.md; the comment above it says what used to go wrong.

import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { PASSWORD, signedInContext } from './accounts';
import { PNG, mc, saveQuiz, uploadPng } from './helpers';

const DATA = path.resolve(process.cwd(), '../e2e/.data');
const onDisk = (id: string) => fs.existsSync(path.join(DATA, 'storage', id.replaceAll('-', '')));
const used = async (request: APIRequestContext) =>
	(await (await request.get('/api/v1/storage/limit')).json()).used as number;

const quiz = (title: string, image: string | null = null) => ({
	title,
	description: 'crud audit',
	questions: [
		{
			...mc('Capital of Portugal?', [
				['Lisbon', true],
				['Porto', false]
			]),
			image
		}
	]
});

/** An upload by a signed-in user, once the worker has hashed it and counted it. */
async function countedUpload(request: APIRequestContext) {
	const before = await used(request);
	const id = await uploadPng(request);
	await expect
		.poll(() => used(request), { message: 'the worker counts the upload' })
		.toBe(before + PNG.length);
	return id;
}

async function edit(request: APIRequestContext, id: string, body: object, secret?: string) {
	const headers: Record<string, string> = secret ? { 'X-Anon-Secret': secret } : {};
	const start = await request.post(`/api/v1/editor/start?edit=true&quiz_id=${id}`, { headers });
	expect(start.status(), await start.text()).toBe(200);
	const { token } = await start.json();
	const res = await request.post(`/api/v1/editor/finish?edit_id=${token}`, {
		headers,
		data: { public: false, ...body }
	});
	expect(res.status(), await res.text()).toBe(200);
}

/**
 * A quiz with `image` on its question, put there by an edit rather than the first save,
 * so the image is linked by the worker's quiz_update job, which these tests wait for.
 * The first save links in the request instead; C14 below covers that path.
 */
async function quizWithImage(request: APIRequestContext, title: string, image: string) {
	const saved = await saveQuiz(request, quiz(title));
	expect(saved.status).toBe(200);
	const id = saved.body.id as string;
	await edit(request, id, quiz(title, image));
	await expect
		.poll(
			async () => {
				const items = (await (await request.get('/api/v1/storage/list')).json()) as {
					id: string;
					quizzes: { id: string }[];
				}[];
				return items.find((i) => i.id === image)?.quizzes.map((q) => q.id) ?? [];
			},
			{ message: 'the worker links the image to the quiz' }
		)
		.toContain(id);
	return id;
}

// C16. quiz_update called `new_quiz.storageitems.remove(item)` on a quiz fetched without
// its storageitems, and ormar's remove() checks the in-memory relation, so it raised
// NoMatch, which the job caught and skipped. The image stayed linked, on disk and counted.
test('taking an image off a question deletes the file and gives the bytes back', async ({
	browser,
	request
}) => {
	const { context } = await signedInContext(browser, request);
	const as = context.request;
	const image = await countedUpload(as);
	const title = `Swap ${Date.now()}`;
	const id = await quizWithImage(as, title, image);

	await edit(as, id, quiz(title));
	await expect.poll(() => onDisk(image), { message: 'file removed' }).toBe(false);
	await expect.poll(() => used(as), { message: 'quota released' }).toBe(0);
	await context.close();
});

test('deleting a quiz deletes its images and gives the bytes back', async ({
	browser,
	request
}) => {
	const { context } = await signedInContext(browser, request);
	const as = context.request;
	const image = await countedUpload(as);
	const id = await quizWithImage(as, `Doomed ${Date.now()}`, image);

	expect((await as.delete(`/api/v1/quiz/delete/${id}`)).status()).toBe(200);
	await expect.poll(() => onDisk(image), { message: 'file removed' }).toBe(false);
	await expect.poll(() => used(as), { message: 'quota released' }).toBe(0);
	expect((await as.get(`/api/v1/quiz/get/public/${id}`)).status()).toBe(404);
	await context.close();
});

test('deleting an account takes its quizzes, its files and its session with it', async ({
	browser,
	request
}) => {
	const { context } = await signedInContext(browser, request);
	const as = context.request;
	const image = await countedUpload(as);
	const id = await quizWithImage(as, `Gone ${Date.now()}`, image);
	const cookies = await context.storageState();

	const res = await as.delete('/api/v1/users/me', { data: { password: PASSWORD } });
	expect(res.status(), await res.text()).toBe(200);
	expect(onDisk(image)).toBe(false);
	expect((await request.get(`/api/v1/quiz/get/public/${id}`)).status()).toBe(404);
	// The deleted account's cookies, replayed from a fresh context, sign nobody in.
	const replay = await browser.newContext({ storageState: cookies });
	expect((await replay.request.get('/api/v1/users/me')).status()).toBe(401);
	await replay.close();
	await context.close();
});

// C14. The first save links the quiz to its images in the request itself, which loaded
// the StorageItems onto the quiz it returned. Once the worker had hashed an image, its
// `hash` was raw bytes, and FastAPI's encoder called .decode() on them: 500, after the
// quiz was saved. Invisible while the e2e stack ran no worker, so hash stayed null.
test('a new quiz with an image saves cleanly', async ({ browser, request }) => {
	const { context } = await signedInContext(browser, request);
	const as = context.request;
	const image = await countedUpload(as);
	await expect
		.poll(async () => (await (await as.get(`/api/v1/storage/meta/${image}`)).json()).hash)
		.toBeTruthy();
	const saved = await saveQuiz(as, quiz(`Fresh ${Date.now()}`, image));
	expect(saved.status, String(saved.body).slice(0, 200)).toBe(200);
	// And it is linked, which is what the 500 came from.
	const items = (await (await as.get('/api/v1/storage/list')).json()) as {
		id: string;
		quizzes: { id: string }[];
	}[];
	expect(items.find((i) => i.id === image)?.quizzes.map((q) => q.id)).toContain(saved.body.id);
	await context.close();
});

// C8. The files went, but the storage_items rows stayed (ON DELETE SET NULL, deleted_at
// never set), so /storage/info answered 200 for them, and /storage/download answered 200
// with an empty body because the local backend yields None for a missing file.
test('after an account is deleted, its images are gone from the API too', async ({
	browser,
	request
}) => {
	const { context } = await signedInContext(browser, request);
	const as = context.request;
	const image = await uploadPng(as);
	expect((await as.delete('/api/v1/users/me', { data: { password: PASSWORD } })).status()).toBe(
		200
	);
	expect.soft((await request.get(`/api/v1/storage/info/${image}`)).status(), 'info').toBe(404);
	expect((await request.get(`/api/v1/storage/download/${image}`)).status(), 'download').toBe(404);
	await context.close();
});

// C18. DELETE /storage/meta/{id} handed storage.delete() one string where it takes a list,
// so the local backend tried to remove one file per character of the name and the real
// file stayed. The quota was released anyway, and download did not check deleted_at, so
// the "deleted" image was still served: upload, delete, repeat, and the 1 GiB cap meant
// nothing.
test('deleting an image through the API removes the file', async ({ browser, request }) => {
	const { context } = await signedInContext(browser, request);
	const as = context.request;
	const image = await countedUpload(as);
	expect((await as.delete(`/api/v1/storage/meta/${image}`)).status()).toBe(200);
	await expect.poll(() => used(as), { message: 'quota released' }).toBe(0);
	expect.soft(onDisk(image), 'file still on disk').toBe(false);
	expect((await request.get(`/api/v1/storage/download/${image}`)).status(), 'still served').toBe(
		404
	);
	await context.close();
});

// C10. The same route deleted an image a quiz still showed, leaving it broken.
test('an image a quiz still uses cannot be deleted through the API', async ({
	browser,
	request
}) => {
	const { context } = await signedInContext(browser, request);
	const as = context.request;
	const image = await uploadPng(as);
	const saved = await saveQuiz(as, quiz(`In use ${Date.now()}`, image));
	expect(saved.status).toBe(200);
	expect((await as.delete(`/api/v1/storage/meta/${image}`)).status()).toBe(409);
	expect(onDisk(image)).toBe(true);
	await context.close();
});

// C7. Claiming moved the quiz to the account but not the images it was made with: they
// stayed ownerless, so they never counted against the quota and outlived the account.
test('claiming a quiz brings its images into the account', async ({ browser, request }) => {
	const title = `Claimed ${Date.now()}`;
	const anon = await saveQuiz(request, quiz(title));
	expect(anon.secret).toBeTruthy();
	const image = await uploadPng(request);
	await edit(request, anon.body.id, quiz(title, image), anon.secret);

	const { context } = await signedInContext(browser, request);
	const as = context.request;
	const claim = await as.post(`/api/v1/quiz/claim/${anon.body.id}`, {
		headers: { 'X-Anon-Secret': anon.secret! }
	});
	expect(claim.status(), await claim.text()).toBe(200);
	await expect.poll(() => used(as), { timeout: 10_000 }).toBe(PNG.length);
	await context.close();
});

// C3. A saved quiz linked any image id it named, whoever uploaded it. The owner of the
// image then could not get its bytes back by deleting their own quiz while the other
// quiz still pointed at it, and deleting their account broke the other quiz's image.
test('a quiz cannot use an image somebody else uploaded', async ({ browser, request }) => {
	const owner = await signedInContext(browser, request);
	const other = await signedInContext(browser, request);
	const image = await uploadPng(owner.context.request);
	const borrowed = await saveQuiz(other.context.request, quiz(`Borrowed ${Date.now()}`, image));
	expect(borrowed.status).toBeGreaterThanOrEqual(400);
	expect(borrowed.status).toBeLessThan(500);
	await owner.context.close();
	await other.context.close();
});

// C5 (anonymous uploads had no rate limit) is tested in frogquiz/tests/test_ratelimit.py,
// and the orphan sweep in test_storage_cleanup.py: e2e.env switches rate limiting off and
// the sweep is a cron job, so neither can be reached from here.

// C6. calculate_hash read `file_data.user.id`, and an anonymous upload has no user, so
// the job raised on every anonymous upload. The hash was saved first, so nothing visible
// broke; the worker log is where it showed.
test('the worker processes an anonymous upload without an error', async ({ request }) => {
	const id = (await uploadPng(request)).replaceAll('-', '');
	const log = () => fs.readFileSync(path.join(DATA, 'worker.log'), 'utf8').split('\n');
	const jobOf = () =>
		log()
			.find((l) => l.includes(`calculate_hash('${id}')`))
			?.match(/([0-9a-f]{32}):calculate_hash/)?.[1] ?? '';
	await expect.poll(jobOf, { message: 'job enqueued' }).not.toBe('');
	const job = jobOf();
	await expect
		.poll(() => log().filter((l) => l.includes(`${job}:calculate_hash`)).length, {
			message: 'job finished'
		})
		.toBeGreaterThan(1);
	expect(log().find((l) => l.includes(`${job}:calculate_hash failed`))).toBeUndefined();
});
