// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// The signed-in side: owning quizzes, claiming an anonymous one, publishing to Discover,
// and keeping game results. Signing in and up is sign-in.e2e.ts, since there are no
// passwords (5 Oct).

import { expect, test } from '@playwright/test';
import { apiLogin, registerUser, signedInContext } from './accounts';
import { expectNoHorizontalOverflow, mc, PHONE, rememberAnonQuiz, saveQuiz } from './helpers';
import {
	closeAll,
	finalResults,
	hostGame,
	joinAll,
	next,
	showQuestion,
	startGame
} from './sockets';

const quiz = (title: string, extra: Record<string, unknown> = {}) => ({
	title,
	description: 'e2e',
	questions: [
		mc('Capital of Portugal?', [
			['Lisbon', true],
			['Porto', false]
		])
	],
	...extra
});

test.afterEach(closeAll);

test("a signed-in user's quiz is on their My Quizzes, and nobody else's", async ({
	browser,
	request
}) => {
	const owner = await signedInContext(browser, request);
	const title = `Owned ${Date.now()}`;
	const saved = await saveQuiz(owner.context.request, quiz(title));
	expect(saved.status).toBe(200);
	expect(saved.secret, 'a signed-in save gets no anonymous secret').toBeFalsy();
	await owner.page.goto('/my-quizzes');
	await expect(owner.page.getByText(title)).toBeVisible();

	const other = await signedInContext(browser, request);
	await other.page.goto('/my-quizzes');
	await expect(other.page.getByRole('heading').first()).toBeVisible();
	await expect(other.page.getByText(title)).toHaveCount(0);
	// A private quiz is not startable by someone else either.
	const res = await other.context.request.post(
		`/api/v1/quiz/start/${saved.body.id}?game_mode=kahoot`
	);
	expect(res.status()).toBe(404);
	await owner.context.close();
	await other.context.close();
});

test('a signed-in owner can reopen a quiz in the editor and save a change', async ({
	browser,
	request
}) => {
	const owner = await signedInContext(browser, request);
	const saved = await saveQuiz(owner.context.request, quiz(`Editable ${Date.now()}`));
	await owner.page.goto(`/edit?quiz_id=${saved.body.id}`);
	await owner.page
		.getByRole('textbox', { name: 'Description' })
		.first()
		.fill('Changed by owner', { timeout: 20_000 });
	await owner.page.getByRole('button', { name: 'Save' }).click();
	// Every save lands on the quiz's view page, new or existing.
	await owner.page.waitForURL(new RegExp(`/view/${saved.body.id}`));
	const stored = await (
		await owner.context.request.get(`/api/v1/quiz/get/${saved.body.id}`)
	).json();
	expect(stored.description).toBe('Changed by owner');
	await owner.context.close();
});

test('an anonymous quiz can be claimed after signing up', async ({ browser, request }) => {
	const title = `Claim me ${Date.now()}`;
	const saved = await saveQuiz(request, quiz(title));
	const user = await signedInContext(browser, request);
	await rememberAnonQuiz(user.page, saved.body.id, saved.secret!);
	await user.page.goto(`/view/${saved.body.id}`);
	// Signed in, the banner opens on its own. Someone who had just made an account to keep
	// this quiz came back to it collapsed, still saying "isn't saved", Claim inside it.
	await user.page
		.getByRole('button', { name: 'Claim this quiz to your account' })
		.click({ timeout: 5_000 });
	await expect(user.page.getByText("This quiz isn't saved to an account")).toHaveCount(0);
	await user.page.goto('/my-quizzes');
	await expect(user.page.getByText(title)).toBeVisible();

	// Claimed means the secret is spent: it no longer starts or deletes anything.
	const anon = await request.post(`/api/v1/quiz/start/${saved.body.id}?game_mode=kahoot`, {
		headers: { 'X-Anon-Secret': saved.secret! }
	});
	expect(anon.status()).toBe(404);
	const again = await user.context.request.post(`/api/v1/quiz/claim/${saved.body.id}`, {
		headers: { 'X-Anon-Secret': saved.secret! }
	});
	expect(again.status(), 'claiming twice').toBe(404);
	await user.context.close();
});

test('a public quiz shows up in Explore search; an unlisted one does not', async ({
	browser,
	request
}) => {
	const owner = await signedInContext(browser, request);
	const tag = `zebrafrog${Date.now().toString(36)}`;
	expect(
		(await saveQuiz(owner.context.request, quiz(`Public ${tag}`, { public: true }))).status
	).toBe(200);
	expect((await saveQuiz(owner.context.request, quiz(`Private ${tag}`))).status).toBe(200);
	// Discover is for signed-in accounts since 5 Oct: a teammate, not a passer-by.
	const { page } = await signedInContext(browser, request);
	await expect
		.poll(
			async () => {
				await page.goto(`/explore?q=${tag}`);
				return page.getByText(`Public ${tag}`).count();
			},
			{ timeout: 20_000 }
		)
		.toBeGreaterThan(0);
	await expect(page.getByText(`Private ${tag}`)).toHaveCount(0);
	await expectNoHorizontalOverflow(page);
	await owner.context.close();
	await page.close();
});

// Results history is hidden for the MVP (MVP.md D4). The save path still works over the
// socket, so this keeps it covered; the page is what is gone.
test('saving results still works, but the results page is hidden', async ({ browser, request }) => {
	const owner = await signedInContext(browser, request);
	const title = `Results ${Date.now()}`;
	const { host, pin } = await hostGame(owner.context.request, quiz(title));
	const [p] = await joinAll(pin, ['scorer']);
	await startGame(host);
	await showQuestion(host, 0);
	p.emit('submit_answer', { question_index: 0, answer: 'Lisbon' });
	await new Promise((r) => setTimeout(r, 300));
	await finalResults(host);
	const saved = next(host, 'results_saved_successfully', 5000);
	host.emit('save_quiz');
	expect(await saved).not.toBeNull();

	const res = await owner.page.goto('/results');
	expect(res?.status()).toBe(404);
	await owner.context.close();
});

test.describe('regressions', () => {
	test('signing in does not lock you out of a quiz you made anonymously', async ({
		browser,
		request
	}) => {
		const saved = await saveQuiz(request, quiz(`Mine ${Date.now()}`));
		const user = await registerUser(request);
		const ctx = await browser.newContext();
		await apiLogin(ctx.request, user.email);
		const headers = { 'X-Anon-Secret': saved.secret! };
		const start = await ctx.request.post(
			`/api/v1/quiz/start/${saved.body.id}?game_mode=kahoot`,
			{ headers }
		);
		const del = await ctx.request.delete(`/api/v1/quiz/delete/${saved.body.id}`, { headers });
		test.info().annotations.push({
			type: 'status',
			description: `start ${start.status()}, delete ${del.status()}`
		});
		expect(start.status()).toBe(200);
		expect(del.status()).toBeLessThan(300);
		await ctx.close();
	});
});

// routers/quiz.py start_quiz only lets a signed-in visitor host a quiz that is public.
// The view page offered Play regardless, so hosting somebody else's unlisted quiz got a
// button that answered "quiz not found".
test('Play is not offered on somebody else’s unlisted quiz', async ({ browser, request }) => {
	const owner = await signedInContext(browser, request);
	const unlisted = await saveQuiz(owner.context.request, quiz(`Unlisted ${Date.now()}`));
	const open = await saveQuiz(owner.context.request, {
		...quiz(`Public ${Date.now()}`),
		public: true
	});

	const other = await signedInContext(browser, request);
	await other.page.goto(`/view/${unlisted.body.id}`);
	await expect(other.page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled();
	await expect(other.page.getByText('only the person who made it can host it')).toBeVisible();

	await other.page.goto(`/view/${open.body.id}`);
	await expect(other.page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();

	// Its owner can still host it.
	await owner.page.goto(`/view/${unlisted.body.id}`);
	await expect(owner.page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
	await owner.context.close();
	await other.context.close();
});

test('My Account on a phone: the name reads in full, and only other devices can be deleted', async ({
	browser,
	request
}) => {
	const user = await registerUser(request);
	// Another device, so there is a session that is not this one.
	const other = await browser.newContext({
		userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0'
	});
	await apiLogin(other.request, user.email);
	const context = await browser.newContext({ viewport: PHONE, hasTouch: true, isMobile: true });
	await apiLogin(context.request, user.email);
	const page = await context.newPage();
	await page.goto('/account/settings');
	await expect(page.getByRole('listitem').getByText('This session')).toBeVisible();

	// Log out sat beside the name and squeezed a 13-character username to "walkmut...".
	const name = page.getByText(user.username, { exact: true });
	await expect(name).toBeVisible();
	expect(await name.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false);
	const email = page.getByText(user.email, { exact: true });
	expect(await email.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false);

	// Delete on this session signed nothing out you could see: the page stayed, and you
	// were dropped later when the token ran out. Log out, above, is the way to leave.
	const deletes = page.getByRole('button', { name: /^Delete session/ });
	await expect(deletes).toHaveCount(1);
	await expect(deletes).toHaveAccessibleName(/Firefox/);
	await deletes.tap();
	await expect(page.getByText(/Firefox/)).toHaveCount(0);
	await expectNoHorizontalOverflow(page);
	await other.close();
	await context.close();
});
