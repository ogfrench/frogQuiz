// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// What a person sees around a claim (#43), on a phone: the claim in the browser that made
// the quiz, a second tab that claims after the first, a second browser, and a claim after
// the 30 days. Each failure says what happened and what to do. Then #55's expiry warning,
// which has to show before the sweep removes the quiz. The API's side of every case is in
// test_anonymous_quiz.py and test_claim_races.py; docs/anonymous-vs-account.md has the list.
// Quizzes without an account exist only with the setting on, so this skips with it off.

import { expect, test, type APIRequestContext, type Browser } from '@playwright/test';
import { apiLogin, askForSignIn, registerUser, signedInContext } from './accounts';
import path from 'node:path';
import {
	ANON_KEY,
	advanceToFinalResults,
	expectNoHorizontalOverflow,
	hostFromViewPage,
	joinAsPlayer,
	mc,
	PHONE,
	rememberAnonQuiz,
	saveQuiz,
	showResults,
	sql,
	titleBox
} from './helpers';

const DAY = 86_400_000;

/** The expiry tests move a quiz's deadline in the database, which only e2e/run.sh allows. */
const needsSql = () => test.skip(!process.env.E2E_PSQL, 'needs e2e/run.sh, which sets E2E_PSQL');

/** Moves a quiz's expiry. Raw SQL keeps a uuid as hex with no dashes. */
const expireIn = (id: string, interval: string) =>
	sql(
		`update quiz set expire_at = now() + interval '${interval}' where id = '${id.replaceAll('-', '')}'`
	);

test.beforeEach(async ({ request }) => {
	const config = await (await request.get('/api/v1/utils/config')).json();
	test.skip(!config.anonymous_quizzes_enabled, 'needs ANONYMOUS_QUIZZES_ENABLED on');
});

async function anonQuiz(request: APIRequestContext, title: string) {
	const saved = await saveQuiz(request, {
		title,
		description: 'e2e',
		questions: [
			mc('Capital of Portugal?', [
				['Lisbon', true],
				['Porto', false]
			])
		]
	});
	expect(saved.status).toBe(200);
	return { id: saved.body.id as string, secret: saved.secret! };
}

/** A signed-in phone: a touch screen at 390 wide. */
async function phone(browser: Browser, request: APIRequestContext) {
	const user = await registerUser(request);
	const context = await browser.newContext({ viewport: PHONE, isMobile: true, hasTouch: true });
	await apiLogin(context.request, user.email);
	return { context, page: await context.newPage(), user };
}

test('on a phone, the browser that made a quiz claims it from My Quizzes', async ({
	browser,
	request
}) => {
	const title = `Phone claim ${Date.now()}`;
	const quiz = await anonQuiz(request, title);
	const { context, page } = await phone(browser, request);
	await rememberAnonQuiz(page, quiz.id, quiz.secret);
	await page.goto('/my-quizzes');
	await expect(page.getByRole('heading', { name: 'On this browser' })).toBeVisible();
	await expectNoHorizontalOverflow(page);
	await page.getByRole('button', { name: 'Add to account', exact: true }).tap();
	// The page reloads with the quiz in the account's list and nothing left in the browser's.
	await expect(page.getByRole('heading', { name: 'On this browser' })).toHaveCount(0);
	await expect(page.getByText(title)).toBeVisible();
	await expectNoHorizontalOverflow(page);
	await context.close();
});

test('Add all to account moves successes out of the browser list after a partial failure', async ({
	browser,
	request
}) => {
	const first = await anonQuiz(request, `Kept first ${Date.now()}`);
	const second = await anonQuiz(request, `Retry second ${Date.now()}`);
	const { context, page } = await phone(browser, request);
	await rememberAnonQuiz(page, first.id, first.secret);
	await rememberAnonQuiz(page, second.id, second.secret);
	await page.route(`**/api/v1/quiz/claim/${second.id}`, (route) =>
		route.fulfill({ status: 429, json: { detail: 'Try again later' } })
	);
	await page.goto('/my-quizzes');
	await page.getByRole('button', { name: 'Add all to account', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('Added 1 of 2');
	await page.screenshot({
		path: path.resolve(process.cwd(), '../e2e/.data/shots/claim-390-partial-429.png'),
		fullPage: true,
		animations: 'disabled'
	});
	const browserList = page.getByRole('region', { name: 'On this browser' });
	await expect(browserList.locator(`a[href="/view/${first.id}"]`)).toHaveCount(0);
	await expect(browserList.locator(`a[href="/view/${second.id}"]`)).toBeVisible();
	await expect(page.locator(`a[href="/view/${first.id}"]`)).toBeVisible();
	await page.unroute(`**/api/v1/quiz/claim/${second.id}`);
	await browserList.getByRole('button', { name: 'Add to account', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'On this browser' })).toHaveCount(0);
	await expect(page.locator(`a[href="/view/${first.id}"]`)).toBeVisible();
	await expect(page.locator(`a[href="/view/${second.id}"]`)).toBeVisible();
	await expectNoHorizontalOverflow(page);
	await context.close();
});

test('a connection failure during Add all to account retains the remaining quiz for retry', async ({
	browser,
	request
}) => {
	const first = await anonQuiz(request, `Kept before offline ${Date.now()}`);
	const second = await anonQuiz(request, `Retry after offline ${Date.now()}`);
	const { context, page } = await phone(browser, request);
	await rememberAnonQuiz(page, first.id, first.secret);
	await rememberAnonQuiz(page, second.id, second.secret);
	await page.route(`**/api/v1/quiz/claim/${second.id}`, (route) =>
		route.abort('internetdisconnected')
	);
	await page.goto('/my-quizzes');
	await page.getByRole('button', { name: 'Add all to account', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('The connection was lost');
	const browserList = page.getByRole('region', { name: 'On this browser' });
	await expect(browserList.locator(`a[href="/view/${first.id}"]`)).toHaveCount(0);
	await expect(browserList.locator(`a[href="/view/${second.id}"]`)).toBeVisible();
	expect(
		await page.evaluate(
			(key) => Object.keys(JSON.parse(localStorage.getItem(key) ?? '{}')),
			ANON_KEY
		)
	).toEqual([second.id]);
	await page.screenshot({
		path: path.resolve(process.cwd(), '../e2e/.data/shots/claim-390-partial-offline.png'),
		fullPage: true,
		animations: 'disabled'
	});
	await page.unroute(`**/api/v1/quiz/claim/${second.id}`);
	await browserList.getByRole('button', { name: 'Add to account', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'On this browser' })).toHaveCount(0);
	for (const quiz of [first, second]) {
		expect((await context.request.get(`/api/v1/quiz/get/${quiz.id}`)).status()).toBe(200);
	}
	await context.close();
});

test('an expired session during Add all to account can sign in again and claim the remainder', async ({
	browser,
	request
}) => {
	const first = await anonQuiz(request, `Kept before sign-out ${Date.now()}`);
	const second = await anonQuiz(request, `Retry after sign-in ${Date.now()}`);
	const { context, page, user } = await phone(browser, request);
	await rememberAnonQuiz(page, first.id, first.secret);
	await rememberAnonQuiz(page, second.id, second.secret);
	// Revoke the real session between the two claims; this is not a mocked 401.
	await page.route(`**/api/v1/quiz/claim/${second.id}`, async (route) => {
		await context.request.post('/api/v1/users/logout', { maxRedirects: 0 });
		await route.continue();
	});
	await page.goto('/my-quizzes');
	await page.getByRole('button', { name: 'Add all to account', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('Sign in again');
	expect(
		await page.evaluate(
			(key) => Object.keys(JSON.parse(localStorage.getItem(key) ?? '{}')),
			ANON_KEY
		)
	).toEqual([second.id]);
	await page.screenshot({
		path: path.resolve(
			process.cwd(),
			'../e2e/.data/shots/claim-390-partial-expired-session.png'
		),
		fullPage: true,
		animations: 'disabled'
	});
	await page.unroute(`**/api/v1/quiz/claim/${second.id}`);
	await page.goto('/account/login');
	const { code } = await askForSignIn(page, user.email);
	await page.getByRole('textbox', { name: 'Six-digit code' }).fill(code);
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await page.waitForURL(/\/my-quizzes/);
	const prompt = page.getByRole('alertdialog');
	await expect(prompt).toContainText(`Retry after sign-in`);
	await expect(prompt).not.toContainText(`Kept before sign-out`);
	await prompt.getByRole('button', { name: 'Add all to account', exact: true }).click();
	await expect(prompt).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'On this browser' })).toHaveCount(0);
	const fresh = await browser.newContext();
	await apiLogin(fresh.request, user.email);
	for (const quiz of [first, second]) {
		const owned = await fresh.request.get(`/api/v1/quiz/get/${quiz.id}`);
		expect(owned.status()).toBe(200);
		expect((await owned.json()).expire_at).toBeNull();
	}
	await fresh.close();
	await context.close();
});

/** On a phone holding these quizzes' secrets, signs in by typing the code, as the hint asks. */
async function signInHolding(
	browser: Browser,
	request: APIRequestContext,
	quizzes: { id: string; secret: string }[]
) {
	const user = await registerUser(request);
	const context = await browser.newContext({ viewport: PHONE, isMobile: true, hasTouch: true });
	const page = await context.newPage();
	for (const quiz of quizzes) await rememberAnonQuiz(page, quiz.id, quiz.secret);
	await page.goto('/account/login');
	const { code } = await askForSignIn(page, user.email);
	await expect(page.getByText(/Type the code here/)).toBeVisible();
	await page.getByRole('textbox', { name: 'Six-digit code' }).fill(code);
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await page.waitForURL(/\/my-quizzes/);
	return { context, page, user };
}

test('right after sign-in the quizzes this browser made are offered, and Add all to account keeps them', async ({
	browser,
	request
}) => {
	const titles = [`Prompt A ${Date.now()}`, `Prompt B ${Date.now()}`];
	const quizzes = [await anonQuiz(request, titles[0]), await anonQuiz(request, titles[1])];
	const { context, page, user } = await signInHolding(browser, request, quizzes);
	const dialog = page.getByRole('alertdialog');
	await expect(dialog).toContainText('Add these 2 quizzes to your account?');
	await expect(dialog).toContainText(user.username);
	for (const title of titles) await expect(dialog).toContainText(title);
	// A shared laptop: the safe answer has the focus.
	await expect(dialog.getByRole('button', { name: 'Not now' })).toBeFocused();
	await expectNoHorizontalOverflow(page);
	await dialog.getByRole('button', { name: 'Add all to account' }).tap();
	await expect(page.getByRole('heading', { name: 'On this browser' })).toHaveCount(0);
	for (const title of titles) await expect(page.getByText(title)).toBeVisible();
	await context.close();
});

test('Not now leaves the quizzes in the browser and asks again only after the next sign-in', async ({
	browser,
	request
}) => {
	const quiz = await anonQuiz(request, `Not now ${Date.now()}`);
	const { context, page } = await signInHolding(browser, request, [quiz]);
	const dialog = page.getByRole('alertdialog');
	await dialog.getByRole('button', { name: 'Not now' }).tap();
	await expect(dialog).toHaveCount(0);
	await page.reload();
	await expect(page.getByRole('heading', { name: 'On this browser' })).toBeVisible();
	await expect(page.getByRole('alertdialog')).toHaveCount(0);
	await context.close();
});

test('a second tab that claims after the first is told it was claimed elsewhere', async ({
	browser,
	request
}) => {
	const quiz = await anonQuiz(request, `Two tabs ${Date.now()}`);
	const { context, page } = await phone(browser, request);
	await rememberAnonQuiz(page, quiz.id, quiz.secret);
	await page.goto('/my-quizzes');
	await expect(page.getByRole('button', { name: 'Add to account', exact: true })).toBeVisible();
	// The other tab's claim: it lands on the server and takes the secret out of this browser,
	// whose localStorage both tabs share. This tab's Claim used to do nothing at all.
	const res = await context.request.post(`/api/v1/quiz/claim/${quiz.id}`, {
		headers: { 'X-Anon-Secret': quiz.secret }
	});
	expect(res.status()).toBe(200);
	await page.evaluate(
		([key, id]) => {
			const all = JSON.parse(localStorage.getItem(key) ?? '{}');
			delete all[id];
			localStorage.setItem(key, JSON.stringify(all));
		},
		[ANON_KEY, quiz.id]
	);
	await page.getByRole('button', { name: 'Add to account', exact: true }).tap();
	await expect(page.getByText(/claimed in another tab or account, or deleted/)).toBeVisible();
	await expectNoHorizontalOverflow(page);
	await context.close();
});

test('a claim after another account took the quiz says so', async ({ browser, request }) => {
	// #43 case 4: this browser still holds the secret, but the server answers 404.
	const quiz = await anonQuiz(request, `Taken ${Date.now()}`);
	const { context, page } = await phone(browser, request);
	await rememberAnonQuiz(page, quiz.id, quiz.secret);
	await page.goto('/my-quizzes');
	await expect(page.getByRole('button', { name: 'Add to account', exact: true })).toBeVisible();
	await claimElsewhere(browser, request, quiz);
	await page.getByRole('button', { name: 'Add to account', exact: true }).tap();
	await expect(page.getByText(/claimed in another tab or account, or deleted/)).toBeVisible();
	await context.close();
});

test('another browser has no Claim, and is told which browser can', async ({
	browser,
	request
}) => {
	const quiz = await anonQuiz(request, `Other browser ${Date.now()}`);
	const { context, page } = await phone(browser, request);
	await page.goto(`/view/${quiz.id}`);
	await expect(page.getByText(/Only that browser can claim it/)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Add this quiz to your account' })).toHaveCount(
		0
	);
	await expectNoHorizontalOverflow(page);
	await context.close();
});

test('a claim after the 30 days says the quiz expired', async ({ browser, request }) => {
	needsSql();
	const quiz = await anonQuiz(request, `Expired ${Date.now()}`);
	const { context, page } = await phone(browser, request);
	await rememberAnonQuiz(page, quiz.id, quiz.secret);
	await page.clock.install();
	await page.goto('/my-quizzes');
	await expect(page.getByRole('button', { name: 'Add to account', exact: true })).toBeVisible();
	// The page stays open past the deadline: the server's copy expires, the phone's clock moves on.
	expireIn(quiz.id, '-1 day');
	await page.clock.setSystemTime(Date.now() + 31 * DAY);
	await page.getByRole('button', { name: 'Add to account', exact: true }).tap();
	await expect(page.getByText(/passed its 30 days and was deleted/)).toBeVisible();
	await context.close();
});

test('the expiry warning shows on My Quizzes and the quiz page until the quiz is removed', async ({
	page,
	request
}) => {
	needsSql();
	const title = `Expiring ${Date.now()}`;
	const quiz = await anonQuiz(request, title);
	await rememberAnonQuiz(page, quiz.id, quiz.secret);
	expireIn(quiz.id, '2 days');
	await page.goto('/my-quizzes');
	await expect(page.getByText(title)).toBeVisible();
	await expect(page.getByText('Expires in 2 days')).toBeVisible();
	await page.goto(`/view/${quiz.id}`);
	await expect(page.getByText('Deleted in 2 days').first()).toBeVisible();

	// Past the deadline it is gone, and My Quizzes no longer lists it.
	expireIn(quiz.id, '-1 day');
	await page.goto('/my-quizzes');
	await expect(page.getByText('No quizzes saved in this browser yet.')).toBeVisible();
	await expect(page.getByText(title)).toHaveCount(0);
});

/** Claims a quiz from somewhere else: a signed-in account that holds the secret. */
async function claimElsewhere(
	browser: Browser,
	request: APIRequestContext,
	quiz: { id: string; secret: string }
) {
	const { context } = await signedInContext(browser, request);
	const res = await context.request.post(`/api/v1/quiz/claim/${quiz.id}`, {
		headers: { 'X-Anon-Secret': quiz.secret }
	});
	expect(res.status(), await res.text()).toBe(200);
	await context.close();
}

test('an editor left open when the quiz is claimed says so and keeps the text', async ({
	browser,
	page,
	request
}) => {
	const quiz = await anonQuiz(request, `Open editor ${Date.now()}`);
	await rememberAnonQuiz(page, quiz.id, quiz.secret);
	await page.goto(`/edit?quiz_id=${quiz.id}`);
	await expect(titleBox(page)).toBeVisible();
	await claimElsewhere(browser, request, quiz);

	await titleBox(page).fill('Typed after the claim');
	await expect(page.getByRole('alert')).toContainText('moved into an account', {
		timeout: 15_000
	});
	await expect(titleBox(page)).toHaveText('Typed after the claim');
});

test('a game running when its quiz is claimed goes on to the podium', async ({
	browser,
	page,
	request
}) => {
	const quiz = await anonQuiz(request, `Claimed mid-game ${Date.now()}`);
	await rememberAnonQuiz(page, quiz.id, quiz.secret);
	const pin = await hostFromViewPage(page, quiz.id);
	const player = await joinAsPlayer(browser, pin, 'robin');
	await expect(page.getByText('robin', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Start game' }).click();
	await claimElsewhere(browser, request, quiz);

	await page.getByRole('button', { name: /Next question/ }).click();
	await player.page.getByRole('button', { name: 'Lisbon' }).click();
	await expect(page.getByText('1 of 1 answered')).toBeVisible();
	await showResults(page);
	await advanceToFinalResults(page);
	await expect(page.locator('.podium-block.is-gold')).toBeVisible();
	await expect(player.page.locator('.fixed.bottom-0').getByText('1st place')).toBeVisible();
	await player.context.close();
});

test('an editor open past the 30 days says the quiz expired and keeps the text', async ({
	page,
	request
}) => {
	needsSql();
	// #35 row 13. The editor keeps its own clock: it reads the expiry when it opens.
	const quiz = await anonQuiz(request, `Expires while open ${Date.now()}`);
	await rememberAnonQuiz(page, quiz.id, quiz.secret);
	await page.clock.install();
	await page.goto(`/edit?quiz_id=${quiz.id}`);
	await expect(titleBox(page)).toBeVisible();
	expireIn(quiz.id, '-1 day');
	await page.clock.setSystemTime(Date.now() + 31 * DAY);

	await titleBox(page).fill('Typed after the deadline');
	await expect(page.getByRole('alert')).toContainText('expired and was deleted', {
		timeout: 15_000
	});
	await expect(titleBox(page)).toHaveText('Typed after the deadline');
	await expect(page.getByRole('button', { name: 'Save as a new quiz' })).toBeVisible();
	// The header's Done and Host game could only fail again, silently, so they are off.
	await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeDisabled();
});

test('Add all to account recovers when a successful claim response is lost', async ({
	browser,
	request
}) => {
	const first = await anonQuiz(request, `Lost response ${Date.now()}`);
	const second = await anonQuiz(request, `Still waiting ${Date.now()}`);
	const { context, page } = await phone(browser, request);
	for (const quiz of [first, second]) await rememberAnonQuiz(page, quiz.id, quiz.secret);
	await page.route(`**/api/v1/quiz/claim/${first.id}`, async (route) => {
		const committed = await route.fetch();
		expect(committed.status()).toBe(200);
		await route.abort('internetdisconnected');
	});
	await page.goto('/my-quizzes');
	await page.getByRole('button', { name: 'Add all to account', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('The connection was lost');
	expect(
		await page.evaluate(
			(key) => Object.keys(JSON.parse(localStorage.getItem(key) ?? '{}')),
			ANON_KEY
		)
	).toHaveLength(2);
	await page.unroute(`**/api/v1/quiz/claim/${first.id}`);
	await page.getByRole('button', { name: 'Add all to account', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'On this browser' })).toHaveCount(0);
	for (const quiz of [first, second]) {
		await expect(page.locator(`a[href="/view/${quiz.id}"]`)).toBeVisible();
		const owned = await context.request.get(`/api/v1/quiz/get/${quiz.id}`);
		expect(owned.status()).toBe(200);
		expect((await owned.json()).expire_at).toBeNull();
	}
	await context.close();
});
