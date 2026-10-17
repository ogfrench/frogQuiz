// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// The 17 Oct menus and wording, walked as the people who use them: the owner, a teammate on
// a shared quiz, a teammate with somebody else's unlisted link, a visitor who is signed out,
// and someone on a phone. Each test is one of those people doing one thing end to end.

import { expect, test, type Page } from '@playwright/test';
import { apiLogin, registerUser, signedInContext } from './accounts';
import {
	cards,
	expectNoHorizontalOverflow,
	mc,
	openViewMenu,
	PHONE,
	questionBox,
	saveQuiz,
	titleBox
} from './helpers';

const quiz = (title: string, isPublic = false) => ({
	title,
	description: 'Quiz actions',
	public: isPublic,
	questions: [
		mc('Capital of Portugal?', [
			['Lisbon', true],
			['Porto', false]
		]),
		mc('Capital of Spain?', [
			['Madrid', true],
			['Seville', false]
		])
	]
});

const main = (page: Page) => page.getByRole('main');
const hostGame = (page: Page) => main(page).getByRole('button', { name: 'Host game', exact: true });
const practice = (page: Page) => main(page).getByRole('link', { name: 'Practice' });
const menuItems = async (page: Page) =>
	(await openViewMenu(page)).getByRole('menuitem').allInnerTexts();

test('the owner: Host game leads from the start, and the menu has every action', async ({
	browser,
	request
}) => {
	const owner = await signedInContext(browser, request);
	const saved = await saveQuiz(owner.context.request, quiz(`Owned ${Date.now()}`));
	await owner.page.goto(`/view/${saved.body.id}`);
	// Unlisted and yours: it must not open on Practice-first and then swap.
	await expect(hostGame(owner.page)).toBeEnabled();
	const classes = await practice(owner.page).getAttribute('class');
	expect(classes).not.toContain('order-first');
	expect((await menuItems(owner.page)).map((s) => s.trim())).toEqual([
		'Copy link',
		'Make a copy',
		'Download',
		'Delete…'
	]);
	await owner.context.close();
});

test('the owner copies the link, and the notice says so', async ({ browser, request }) => {
	const owner = await signedInContext(browser, request);
	await owner.context.grantPermissions(['clipboard-read', 'clipboard-write']);
	const saved = await saveQuiz(owner.context.request, quiz(`Link ${Date.now()}`));
	await owner.page.goto(`/view/${saved.body.id}`);
	await (await openViewMenu(owner.page)).getByRole('menuitem', { name: 'Copy link' }).click();
	await expect(owner.page.getByText('Link copied', { exact: true })).toBeVisible();
	const copied = await owner.page.evaluate(() => navigator.clipboard.readText());
	expect(copied).toBe(new URL(`/view/${saved.body.id}`, owner.page.url()).href);
	// The address works for whoever it is pasted to: unlisted means "anyone with the link".
	const mate = await signedInContext(browser, request);
	await mate.page.goto(copied);
	await expect(mate.page.getByRole('heading', { level: 1 })).toContainText('Link');
	await owner.context.close();
	await mate.context.close();
});

test('when the browser refuses the clipboard, the notice gives the link to copy by hand', async ({
	browser,
	request
}) => {
	const owner = await signedInContext(browser, request);
	await owner.page.addInitScript(() => {
		navigator.clipboard.writeText = () => Promise.reject(new Error('denied'));
	});
	const saved = await saveQuiz(owner.context.request, quiz(`Refused ${Date.now()}`));
	await owner.page.goto(`/view/${saved.body.id}`);
	await (await openViewMenu(owner.page)).getByRole('menuitem', { name: 'Copy link' }).click();
	await expect(owner.page.getByText(/^Couldn't copy\. Here's the link: http/)).toContainText(
		`/view/${saved.body.id}`
	);
	await owner.context.close();
});

test('a teammate on a public quiz can host it and copy it, but not download or delete it', async ({
	browser,
	request
}) => {
	const owner = await signedInContext(browser, request);
	const saved = await saveQuiz(owner.context.request, quiz(`Shared ${Date.now()}`, true));
	const mate = await signedInContext(browser, request);
	await mate.page.goto(`/view/${saved.body.id}`);
	await expect(hostGame(mate.page)).toBeEnabled();
	expect((await menuItems(mate.page)).map((s) => s.trim())).toEqual([
		'Copy link',
		'Copy to my quizzes'
	]);
	await owner.context.close();
	await mate.context.close();
});

test("a teammate with somebody else's unlisted link gets Practice as the main button", async ({
	browser,
	request
}) => {
	const owner = await signedInContext(browser, request);
	const saved = await saveQuiz(owner.context.request, quiz(`Unlisted ${Date.now()}`));
	const mate = await signedInContext(browser, request);
	await mate.page.goto(`/view/${saved.body.id}`);
	await expect(practice(mate.page)).toHaveClass(/order-first/);
	await expect(hostGame(mate.page)).toBeDisabled();
	await expect(main(mate.page)).toContainText('only the person who made it can host it');
	expect((await menuItems(mate.page)).map((s) => s.trim())).toEqual(['Copy link']);
	await owner.context.close();
	await mate.context.close();
});

test('signed out on an unlisted quiz: Practice leads, and sign-in is offered to its maker', async ({
	browser,
	request
}) => {
	const owner = await signedInContext(browser, request);
	const saved = await saveQuiz(owner.context.request, quiz(`Visitor ${Date.now()}`));
	const visitor = await browser.newContext();
	const page = await visitor.newPage();
	await page.goto(`/view/${saved.body.id}`);
	await expect(practice(page)).toHaveClass(/order-first/);
	await expect(main(page).getByRole('link', { name: 'Made this quiz? Sign in' })).toBeVisible();
	await owner.context.close();
	await visitor.close();
});

test('the owner adds a question below the first, writes it, and Done keeps it as a draft', async ({
	browser,
	request
}) => {
	const owner = await signedInContext(browser, request);
	const saved = await saveQuiz(owner.context.request, quiz(`Draft ${Date.now()}`));
	const id = saved.body.id as string;
	const page = owner.page;
	await page.goto(`/edit?quiz_id=${id}`);
	await expect(cards(page)).toHaveCount(2);
	await page.getByRole('button', { name: 'Add question below' }).click();
	await expect(cards(page)).toHaveCount(3);
	// The cursor lands in the new question: the pressed button went away with the selection.
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					document.activeElement
						?.closest('[data-question-index]')
						?.getAttribute('data-question-index') ?? null
			)
		)
		.toBe('1');
	await page.keyboard.type('Capital of Italy?');
	// Between the edit and the autosave the header says so, rather than a stale "Saved".
	await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
	await expect(page.getByText('Saved as a draft', { exact: true })).toBeVisible({
		timeout: 15_000
	});
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await page.waitForURL(new RegExp(`/view/${id}`));
	// It has no answers yet, so the quiz is a draft and cannot be hosted.
	await expect(main(page).getByText('Draft', { exact: true })).toBeVisible();
	await expect(hostGame(page)).toBeDisabled();
	const stored = await (await owner.context.request.get(`/api/v1/quiz/get/${id}`)).json();
	expect(stored.questions.map((q: { question: string }) => q.question)).toEqual([
		'Capital of Portugal?',
		'Capital of Italy?',
		'Capital of Spain?'
	]);
	await owner.context.close();
});

test('making a quiz public in the editor is saved', async ({ browser, request }) => {
	const owner = await signedInContext(browser, request);
	const saved = await saveQuiz(owner.context.request, quiz(`Publish ${Date.now()}`));
	const id = saved.body.id as string;
	const page = owner.page;
	await page.goto(`/edit?quiz_id=${id}`);
	await expect(titleBox(page)).toBeVisible();
	await page.getByRole('button', { name: 'More settings' }).click();
	const visibility = page.getByRole('group', { name: 'Visibility' });
	await expect(visibility.getByRole('radio', { name: 'Unlisted' })).toBeChecked();
	await visibility.locator('label', { hasText: 'Public' }).click();
	await expect(visibility.getByRole('radio', { name: 'Public' })).toBeChecked();
	await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15_000 });
	await expect
		.poll(
			async () =>
				(await (await owner.context.request.get(`/api/v1/quiz/get/${id}`)).json()).public
		)
		.toBe(true);
	await owner.context.close();
});

test('a quiz deleted in another tab: the text stays, and Done and Host game are off', async ({
	browser,
	request
}) => {
	const owner = await signedInContext(browser, request);
	const saved = await saveQuiz(owner.context.request, quiz(`Gone ${Date.now()}`));
	const id = saved.body.id as string;
	const page = owner.page;
	await page.goto(`/edit?quiz_id=${id}`);
	await expect(titleBox(page)).toBeVisible();
	expect((await owner.context.request.delete(`/api/v1/quiz/delete/${id}`)).status()).toBe(200);
	await questionBox(page).fill('Typed after it was deleted');
	await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
	await expect(page.getByRole('button', { name: 'Save as a new quiz' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Host game', exact: true })).toBeDisabled();
	await expect(questionBox(page)).toContainText('Typed after it was deleted');
	await owner.context.close();
});

test('My quizzes from the keyboard: Delete names the quiz, removes it, and keeps the focus', async ({
	browser,
	request
}) => {
	const owner = await signedInContext(browser, request);
	const title = `Keyboard ${Date.now()}`;
	await saveQuiz(owner.context.request, quiz(title));
	const page = owner.page;
	await page.goto('/my-quizzes');
	const row = page.getByRole('listitem').filter({ hasText: title });
	const more = row.getByRole('button', { name: `More actions for ${title}` });
	await expect(async () => {
		await more.focus();
		await page.keyboard.press('Enter');
		await expect(page.getByRole('menu')).toBeVisible({ timeout: 1000 });
	}).toPass();
	await page.getByRole('menuitem', { name: 'Delete…' }).focus();
	await page.keyboard.press('Enter');
	const dialog = page.getByRole('alertdialog', { name: 'Delete this quiz?' });
	await expect(dialog).toContainText(`"${title}" will be deleted for good.`);
	await dialog.getByRole('button', { name: 'Delete', exact: true }).focus();
	await page.keyboard.press('Enter');
	await expect(row).toHaveCount(0);
	await expect(dialog).toHaveCount(0);
	// The row's button went with the row, so the page takes the focus, not <body>.
	await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('main-content');
	await owner.context.close();
});

test('My quizzes: one Create when empty, and a search with no hits says so', async ({
	browser,
	request
}) => {
	const owner = await signedInContext(browser, request);
	const page = owner.page;
	await page.goto('/my-quizzes');
	await expect(main(page).getByRole('link', { name: 'Create a quiz' })).toHaveCount(1);

	// The search box appears past six quizzes.
	for (let i = 0; i < 7; i++)
		await saveQuiz(owner.context.request, quiz(`Many ${i} ${Date.now()}`));
	await page.reload();
	await page.getByRole('textbox', { name: /search/i }).fill('zzzz no such quiz');
	await expect(page.getByText('No quizzes match "zzzz no such quiz".')).toBeVisible();
	await main(page).getByRole('button', { name: 'Clear search', exact: true }).last().click();
	await expect(page.getByRole('listitem')).toHaveCount(7);
	await owner.context.close();
});

test('on a phone, the quiz page menu fits, is touch-sized, and the notice is on screen', async ({
	browser,
	request
}) => {
	const user = await registerUser(request);
	const context = await browser.newContext({ viewport: PHONE, isMobile: true, hasTouch: true });
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await apiLogin(context.request, user.email);
	const saved = await saveQuiz(context.request, quiz(`Phone ${Date.now()}`));
	const page = await context.newPage();
	await page.goto(`/view/${saved.body.id}`);
	await expect(hostGame(page)).toBeEnabled();
	await expectNoHorizontalOverflow(page);
	const menu = await openViewMenu(page);
	for (const item of await menu.getByRole('menuitem').all()) {
		const box = (await item.boundingBox())!;
		expect(box.height).toBeGreaterThanOrEqual(44);
		expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width);
	}
	await menu.getByRole('menuitem', { name: 'Copy link' }).tap();
	const notice = page.getByText('Link copied', { exact: true });
	await expect(notice).toBeInViewport();
	await context.close();
});
