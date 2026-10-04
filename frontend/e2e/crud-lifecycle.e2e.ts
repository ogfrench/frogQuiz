// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// What deleting or changing something leaves behind: files on disk, the account's
// storage quota, rows the API still answers for. These need the arq worker, which
// run.sh starts: it is what hashes an upload, counts it against the quota and links an
// edited quiz to its images. Before it ran here, none of that had ever been exercised
// end to end. Findings carry the C-numbers of docs/crud-audit-2026-10.md.

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
 * A quiz with `image` on its question, put there by an edit rather than the first save.
 * The first save of a quiz with an already-hashed image answers 500 (C14), which would
 * stop every test below at its first line; through an edit the image is linked by the
 * worker's quiz_update job instead, which these tests wait for.
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

// C16. quiz_update calls `new_quiz.storageitems.remove(item)` on a quiz fetched without
// its storageitems, and ormar's remove() checks the in-memory relation, so it raises
// NoMatch, which the job catches and skips. The image stays linked, on disk and counted.
test('taking an image off a question deletes the file and gives the bytes back', async ({
	browser,
	request
}) => {
	test.fail(true, 'C16: quiz_update never unlinks a removed image (worker/storage.py:125)');
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

// C14. The first save links the quiz to its images in the request itself
// (editor.py:306-311), which loads the StorageItems onto the quiz that is returned. Once
// the worker has hashed an image, its `hash` is raw bytes, and FastAPI's encoder calls
// .decode() on them: UnicodeDecodeError, 500. The quiz is saved; the editor is told it
// was not. Invisible until now because the e2e stack ran no worker, so hash stayed null.
test('a new quiz with an image saves cleanly', async ({ browser, request }) => {
	test.fail(true, 'C14: first save returns 500 once the image is hashed (editor.py:311)');
	const { context } = await signedInContext(browser, request);
	const as = context.request;
	const image = await countedUpload(as);
	await expect
		.poll(async () => (await (await as.get(`/api/v1/storage/meta/${image}`)).json()).hash)
		.toBeTruthy();
	const saved = await saveQuiz(as, quiz(`Fresh ${Date.now()}`, image));
	expect(saved.status, String(saved.body).slice(0, 200)).toBe(200);
	await context.close();
});

// C8. The files go, but the storage_items rows stay (ON DELETE SET NULL, deleted_at
// never set), so /storage/info answers 200 for them, and /storage/download answers 200
// with an empty body because the local backend yields None for a missing file.
test('after an account is deleted, its images are gone from the API too', async ({
	browser,
	request
}) => {
	test.fail(true, 'C8: account deletion leaves storage_items rows (users/__init__.py:518)');
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

// C18. DELETE /storage/meta/{id} hands storage.delete() one string where it takes a list,
// so the local backend tries to remove one file per character of the name and the real
// file stays. The quota is released anyway, and download does not check deleted_at, so
// the "deleted" image is still served: upload, delete, repeat, and the 1 GiB cap means
// nothing.
test('deleting an image through the API removes the file', async ({ browser, request }) => {
	test.fail(true, 'C18: storage.delete gets a str, not a list (storage.py:329)');
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

// C7. Claiming moves the quiz to the account but not the images it was made with: they
// stay ownerless, so they never count against the quota and outlive the account.
test('claiming a quiz brings its images into the account', async ({ browser, request }) => {
	test.fail(true, 'C7: claim_quiz does not reassign storage items (quiz.py:236)');
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

// C3. A saved quiz links any image id it names, whoever uploaded it. The owner of the
// image then cannot get its bytes back by deleting their own quiz while the other quiz
// still points at it, and deleting their account deletes the file out from under it.
test('a quiz cannot use an image somebody else uploaded', async ({ browser, request }) => {
	test.fail(
		true,
		'C3: no owner check when linking images (editor.py:306, worker/storage.py:135)'
	);
	const owner = await signedInContext(browser, request);
	const other = await signedInContext(browser, request);
	const image = await uploadPng(owner.context.request);
	const borrowed = await saveQuiz(other.context.request, quiz(`Borrowed ${Date.now()}`, image));
	expect(borrowed.status).toBeGreaterThanOrEqual(400);
	expect(borrowed.status).toBeLessThan(500);
	await owner.context.close();
	await other.context.close();
});

// C5 (anonymous uploads have no rate limit) is tested in frogquiz/tests/test_ratelimit.py:
// e2e.env switches rate limiting off for the whole stack, so it could never pass here.

// C6. calculate_hash reads `file_data.user.id`, and an anonymous upload has no user, so
// the job raises on every anonymous upload. The hash is saved first, so nothing visible
// breaks; the worker log is where it shows.
test('the worker processes an anonymous upload without an error', async ({ request }) => {
	test.fail(true, 'C6: calculate_hash dereferences a missing user (worker/storage.py:75)');
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
