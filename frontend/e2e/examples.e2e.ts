// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Examples and Copy to my quizzes (#39, decisions D26 and D33). Discover lists the
// ready-made quizzes above Newest; any quiz you can see and may play can be copied into
// your account, and a copy lands in the editor. The API's side (404 for a stranger's
// unlisted quiz, 409 at the storage limit, images copied) is in test_copy.py; this is what
// a person sees.
//
// The examples are loaded the way production loads them, with `python -m
// frogquiz.examples.seed`, which e2e/run.sh makes possible by exporting E2E_PY. Without it
// there is nothing to look at, so the file skips.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { apiLogin, registerUser, signedInContext } from './accounts';
import { expectNoHorizontalOverflow, mc, PHONE, saveQuiz, titleBox } from './helpers';

const ROOT = path.join(import.meta.dirname, '..', '..');
const FOLDER = path.join(ROOT, 'frogquiz', 'examples');
const OWNER = 'frogQuiz';

// Read from the files the seed reads, so a sixth example does not need this list touched.
const EXAMPLES: string[] = readdirSync(FOLDER)
	.filter((name) => name.endsWith('.json'))
	.map((name) => JSON.parse(readFileSync(path.join(FOLDER, name), 'utf8')).title as string);

const COPY = 'Copy to my quizzes';
// Your own quiz says "Make a copy" (17 Oct): "to my quizzes" read as doing nothing there.
const MAKE_COPY = 'Make a copy';

// Copy is in the view page's "More actions" menu since 17 Oct. Retried, because a click that
// lands before hydration opens nothing.
const viewMenu = async (page: Page) => {
	const more = page.getByRole('main').getByRole('button', { name: /^More actions/ });
	await expect(async () => {
		if ((await page.getByRole('menu').count()) === 0) await more.click();
		await expect(page.getByRole('menu')).toBeVisible({ timeout: 1000 });
	}).toPass();
	return page.getByRole('menu');
};

test.beforeAll(() => {
	test.skip(!process.env.E2E_PY, 'needs e2e/run.sh, which sets E2E_PY');
	execFileSync(process.env.E2E_PY!, ['-m', 'frogquiz.examples.seed'], {
		cwd: ROOT,
		env: process.env,
		encoding: 'utf8'
	});
});

const quiz = (title: string, isPublic = false) => ({
	title,
	description: 'e2e',
	public: isPublic,
	questions: [
		mc('Capital of Portugal?', [
			['Lisbon', true],
			['Porto', false]
		])
	]
});

/** A signed-in phone: a touch screen at 390 wide. */
async function phone(browser: Browser) {
	const user = await registerUser();
	const context = await browser.newContext({ viewport: PHONE, isMobile: true, hasTouch: true });
	await apiLogin(context.request, user.email);
	return { context, page: await context.newPage() };
}

/** Pressing before the page hydrates does nothing: the button is only wired up then. */
async function openView(page: Page, id: string) {
	await page.goto(`/view/${id}`);
	await page.waitForLoadState('networkidle');
}

test('Discover lists the examples above Newest, and Newest does not list them again', async ({
	browser,
	request
}) => {
	const owner = await signedInContext(browser, request);
	// Something of someone else's for Newest to hold, or the list below is empty and the
	// check that the examples are missing from it proves nothing.
	const mine = `Newest ${Date.now()}`;
	expect((await saveQuiz(owner.context.request, quiz(mine, true))).status).toBe(200);

	const { page, context } = await signedInContext(browser, request);
	// Meilisearch indexes a moment after the quiz is saved, and the examples have to be in
	// its newest twenty for Newest to have had them to leave out.
	await expect
		.poll(
			async () => {
				const res = await context.request.post('/api/v1/search/', {
					data: { q: '*', sort: ['created_at:desc'] }
				});
				const { hits } = await res.json();
				const users = new Set(hits.map((h: { user: string }) => h.user));
				const titles = hits.map((h: { title: string }) => h.title);
				return users.has(OWNER) && titles.includes(mine);
			},
			{ timeout: 20_000, message: 'the examples and the new quiz are in the newest 20 hits' }
		)
		.toBe(true);

	await page.goto('/explore');
	const examples = page.getByRole('region', { name: 'Examples' });
	await expect(examples).toBeVisible();
	for (const title of EXAMPLES) {
		await expect(examples.getByRole('link', { name: title })).toBeVisible();
	}
	await expect(examples.getByRole('link')).toHaveCount(EXAMPLES.length);
	// The count on each card is what tells an example from a made-up title.
	await expect(examples.getByRole('link').first()).toContainText(/\d+ questions?/);

	const newest = page.getByRole('region', { name: 'Newest' });
	await expect(newest.getByRole('link', { name: mine })).toBeVisible();
	for (const title of EXAMPLES) {
		await expect(newest.getByRole('link', { name: title })).toHaveCount(0);
	}
	// Above, not beside or below.
	const above = await examples.evaluate(
		(el, other) =>
			Boolean(el.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING),
		await newest.elementHandle()
	);
	expect(above, 'Examples comes before Newest').toBe(true);
	await expectNoHorizontalOverflow(page);

	// A search is a search: no Examples section above the results.
	await page.goto(`/explore?q=${encodeURIComponent(EXAMPLES[0].slice(0, 6))}`);
	await expect(page.getByRole('heading', { name: 'Discover' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Examples' })).toHaveCount(0);

	await owner.context.close();
	await context.close();
});

test('a signed-out visitor can use an example as an anonymous quiz', async ({ browser }) => {
	const context = await browser.newContext({ viewport: PHONE, isMobile: true, hasTouch: true });
	const page = await context.newPage();
	const title = EXAMPLES[0];

	await page.goto('/explore');
	const examples = page.getByRole('region', { name: 'Examples' });
	await expect(examples).toBeVisible();
	const signIn = page.getByRole('main').getByRole('link', { name: 'Sign in' });
	await expect(signIn).toBeVisible();
	await expect(signIn).toHaveAttribute('href', '/account/login?returnTo=%2Fexplore');
	await expect(page.getByRole('searchbox')).toHaveCount(0);
	await examples.getByRole('link', { name: title }).click();
	await expect(page).toHaveURL(/\/view\//);
	await page.waitForLoadState('networkidle');
	// D43: hosting needs no account, so Host game is offered rather than "Sign in to host".
	await expect(page.getByRole('button', { name: 'Host game' })).toBeEnabled();
	await expect(page.getByRole('link', { name: 'Sign in to host' })).toHaveCount(0);

	await page.getByRole('button', { name: 'Use this template' }).click();
	await expect(page).toHaveURL(/\/edit\?quiz_id=[0-9a-f-]{32,36}$/);
	await expect(titleBox(page)).toContainText(`${title} (copy)`);
	const quizId = new URL(page.url()).searchParams.get('quiz_id')!;
	await expect
		.poll(async () =>
			page.evaluate(() => {
				const secrets = JSON.parse(localStorage.getItem('frogquiz_anon_secrets') ?? '{}');
				return Object.keys(secrets);
			})
		)
		.toContain(quizId);

	await page.goto('/my-quizzes');
	await expect(page.getByRole('listitem').filter({ hasText: `${title} (copy)` })).toBeVisible();
	await context.close();
});

test('an example is copied into your quizzes and opens in the editor', async ({
	browser,
	request
}) => {
	const { page, context } = await signedInContext(browser, request);
	const title = EXAMPLES[0];
	await page.goto('/explore');
	await page.getByRole('region', { name: 'Examples' }).getByRole('link', { name: title }).click();
	await expect(page).toHaveURL(/\/view\//);
	await page.waitForLoadState('networkidle');

	await (await viewMenu(page)).getByRole('menuitem', { name: COPY }).click();
	await expect(page).toHaveURL(/\/edit\?quiz_id=[0-9a-f-]{32,36}$/);
	await expect(titleBox(page)).toContainText(`${title} (copy)`);
	const copyId = new URL(page.url()).searchParams.get('quiz_id')!;

	await page.goto('/my-quizzes');
	const row = page.getByRole('listitem').filter({ hasText: `${title} (copy)` });
	await expect(row).toBeVisible();
	// A copy is the copier's to publish, not the team's to find.
	await expect(row.getByText('Unlisted', { exact: true })).toBeVisible();
	await expect(row.getByRole('link', { name: `${title} (copy)` })).toHaveAttribute(
		'href',
		`/view/${copyId}`
	);
	await context.close();
});

test('Copy waits while the copy is made and says what went wrong', async ({ browser, request }) => {
	const { page, context } = await signedInContext(browser, request);
	await openView(page, (await findExampleId(page, EXAMPLES[0]))!);
	const item = () => page.getByRole('menuitem', { name: COPY });

	// A slow answer: the item is off, so a second press cannot make a second copy.
	let release: () => void = () => undefined;
	const held = new Promise<void>((resolve) => (release = resolve));
	await page.route('**/api/v1/quiz/copy/*', async (route) => {
		await held;
		await route.fulfill({ status: 409, json: { detail: 'Storage limit reached' } });
	});
	await (await viewMenu(page)).getByRole('menuitem', { name: COPY }).click();
	await viewMenu(page);
	await expect(item()).toHaveAttribute('data-disabled', '');
	await page.keyboard.press('Escape');
	release();
	await expect(page.getByRole('alert')).toContainText('storage');
	await viewMenu(page);
	await expect(item()).not.toHaveAttribute('data-disabled');

	// Anything else gets the short message, and the next try is not blocked by the last.
	await page.unroute('**/api/v1/quiz/copy/*');
	await page.route('**/api/v1/quiz/copy/*', (route) =>
		route.fulfill({ status: 500, json: { detail: 'boom' } })
	);
	await item().click();
	await expect(page.getByRole('alert')).toContainText(/Couldn't copy/);
	await expect(page).toHaveURL(/\/view\//);
	await context.close();
});

test('a stranger cannot copy an unlisted quiz, and the owner can', async ({ browser, request }) => {
	const owner = await signedInContext(browser, request);
	const saved = await saveQuiz(owner.context.request, quiz(`Unlisted ${Date.now()}`));
	expect(saved.status).toBe(200);
	const id = saved.body.id as string;

	await openView(owner.page, id);
	// Without this the check below could pass on a page that never grew the item.
	await expect(
		(await viewMenu(owner.page)).getByRole('menuitem', { name: MAKE_COPY })
	).toBeVisible();

	const stranger = await signedInContext(browser, request);
	await openView(stranger.page, id);
	await expect(stranger.page.getByRole('link', { name: 'Practice' })).toBeVisible();
	const menu = await viewMenu(stranger.page);
	await expect(menu.getByRole('menuitem', { name: 'Copy link' })).toBeVisible();
	await expect(menu.getByRole('menuitem', { name: /copy/i })).toHaveCount(1);

	// Hiding the button is for show; the API is the rule, and it answers as for a quiz
	// that is not there.
	const refused = await stranger.context.request.post(`/api/v1/quiz/copy/${id}`);
	expect(refused.status()).toBe(404);

	await owner.context.close();
	await stranger.context.close();
});

test('a quiz in My Quizzes can be copied from its row', async ({ browser, request }) => {
	const owner = await signedInContext(browser, request);
	const title = `Mine ${Date.now()}`;
	const saved = await saveQuiz(owner.context.request, quiz(title));
	expect(saved.status).toBe(200);
	const id = saved.body.id as string;

	await owner.page.goto('/my-quizzes');
	await owner.page.waitForLoadState('networkidle');
	const row = owner.page.getByRole('listitem').filter({ hasText: title });
	// Copy sits behind the row's "More actions" menu since 17 Oct.
	await row.getByRole('button', { name: /^More actions/ }).click();
	await owner.page.getByRole('menuitem', { name: MAKE_COPY }).click();

	await expect(owner.page).toHaveURL(/\/edit\?quiz_id=/);
	expect(new URL(owner.page.url()).searchParams.get('quiz_id')).not.toBe(id);
	await expect(titleBox(owner.page)).toContainText(`${title} (copy)`);

	await owner.page.goto('/my-quizzes');
	await expect(
		owner.page.getByRole('listitem').filter({ hasText: `${title} (copy)` })
	).toBeVisible();
	// The original is where it was.
	await expect(owner.page.getByRole('link', { name: title, exact: true })).toHaveAttribute(
		'href',
		`/view/${id}`
	);
	await owner.context.close();
});

test('on a phone, Discover, an example and My Quizzes do not scroll sideways', async ({
	browser
}) => {
	const { page, context } = await phone(browser);
	// A row of its own to lay out: the actions wrap, and one more icon is one more thing to wrap.
	expect((await saveQuiz(context.request, quiz(`Phone ${Date.now()}`))).status).toBe(200);
	await page.goto('/explore');
	await expect(page.getByRole('region', { name: 'Examples' })).toBeVisible();
	await expectNoHorizontalOverflow(page);

	const id = (await findExampleId(page, EXAMPLES[0]))!;
	await openView(page, id);
	const copy = page.getByRole('main').getByRole('button', { name: /^More actions/ });
	await expect(copy).toBeVisible();
	await expectNoHorizontalOverflow(page);
	// Inside the screen, not just inside a document that is allowed to scroll.
	const box = (await copy.boundingBox())!;
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width);

	await page.goto('/my-quizzes');
	await expectNoHorizontalOverflow(page);
	await context.close();
});

/** An example's id, from its card on Discover. */
async function findExampleId(page: Page, title: string) {
	await page.goto('/explore');
	const href = await page
		.getByRole('region', { name: 'Examples' })
		.getByRole('link', { name: title })
		.getAttribute('href');
	return href?.split('/').pop();
}
