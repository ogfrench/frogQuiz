// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Play in the editor header (#40, D27: save first, then open the game in a new tab).
//
// The point of the button is that an author who has just changed a question can run the
// game without going back to the quiz page first, and that the game runs what is on their
// screen. So most of what is checked here is the order of things: the edit reaches the
// server before the dialog opens, a failed save stops it, and the editor tab is still the
// editor afterwards.

import { expect, test, type Page } from '@playwright/test';
import { signedInContext } from './accounts';
import {
	addQuestion,
	expectNoHorizontalOverflow,
	joinAsPlayer,
	mc,
	PHONE,
	questionBox,
	saveQuiz,
	startNewQuiz,
	titleBox
} from './helpers';

const play = (page: Page) => page.getByRole('button', { name: 'Play', exact: true });
const startDialog = (page: Page) => page.getByRole('dialog', { name: 'Start game' });

const complete = (title: string, question = 'Which one is the frog?') => ({
	title,
	description: 'e2e play',
	public: true,
	questions: [
		mc(question, [
			['Tree frog', true],
			['Gecko', false]
		])
	]
});

// The same question with nothing marked right: a draft the server will not start.
const draft = (title: string) => ({
	title,
	description: 'e2e play draft',
	public: true,
	questions: [
		mc('Unfinished question', [
			['Paris', false],
			['Lyon', false]
		])
	]
});

async function openInEditor(page: Page, id: string, title: string) {
	await page.goto(`/edit?quiz_id=${id}`);
	await expect(titleBox(page)).toContainText(title, { timeout: 20_000 });
}

async function storedQuestion(page: Page, id: string) {
	const res = await page.request.get(`/api/v1/quiz/get/public/${id}`);
	expect(res.status()).toBe(200);
	return (await res.json()).questions[0].question as string;
}

test('Play saves the edit, opens the game in a new tab, and leaves the editor alone', async ({
	browser,
	request
}) => {
	const { context, page } = await signedInContext(browser, request);
	const title = `Play edited ${Date.now()}`;
	const edited = `Edited ${Date.now()}: which one is the frog?`;
	const saved = await saveQuiz(context.request, complete(title));
	expect(saved.status, JSON.stringify(saved.body)).toBe(200);
	const id = saved.body.id;

	await openInEditor(page, id, title);
	await questionBox(page).fill(edited);
	await play(page).click();
	const dialog = startDialog(page);
	await expect(dialog).toBeVisible();

	// The new tab is the game; this one is still the editor, with the dialog gone.
	const [tab] = await Promise.all([
		context.waitForEvent('page'),
		dialog.getByRole('button', { name: 'Start game' }).click()
	]);
	await tab.waitForURL(/\/admin\?/);
	expect(new URL(tab.url()).searchParams.get('pin')).toMatch(/^\d{6}$/);
	await expect(dialog).toBeHidden();
	expect(page.url()).toContain(`/edit?quiz_id=${id}`);
	await expect(play(page)).toBeEnabled();

	// And the game is the edited quiz: a player joins, the host starts, and the first
	// question on the projector is the new text, not the stored one from before.
	const pin = new URL(tab.url()).searchParams.get('pin')!;
	const player = await joinAsPlayer(browser, pin, 'ana');
	await tab.getByRole('button', { name: 'Start game' }).click();
	await tab.getByRole('button', { name: /Next question/ }).click();
	await expect(tab.getByText(edited)).toBeVisible({ timeout: 15_000 });
	await expect(tab.getByText('Which one is the frog?', { exact: true })).toHaveCount(0);

	await player.context.close();
	await context.close();
});

test('a quiz that was never saved has no Play, and gets one with its first save', async ({
	page
}) => {
	await startNewQuiz(page, `Play unsaved ${Date.now()}`);
	await expect(titleBox(page)).toBeVisible();
	await expect(play(page)).toHaveCount(0);

	await addQuestion(page, /^Multiple choice/, 'Which one is the frog?', [
		['Tree frog', true],
		['Gecko', false]
	]);
	// The editor saves on its own once there is something to keep; that is what gives the
	// quiz an id for the game to start from.
	await expect(page).toHaveURL(/\/edit\?quiz_id=/, { timeout: 15_000 });
	await expect(play(page)).toBeVisible();
	await expect(play(page)).toBeEnabled();
});

test('on a draft Play is disabled, and the reason is what describes it', async ({
	browser,
	request
}) => {
	const { context, page } = await signedInContext(browser, request);
	const title = `Play draft ${Date.now()}`;
	const saved = await saveQuiz(context.request, draft(title));
	expect(saved.status, JSON.stringify(saved.body)).toBe(200);

	await openInEditor(page, saved.body.id, title);
	await expect(play(page)).toBeVisible();
	await expect(play(page)).toBeDisabled();
	const hint_id = await play(page).getAttribute('aria-describedby');
	expect(hint_id, 'Play says why it is off').toBeTruthy();
	await expect(page.locator(`[id="${hint_id}"]`)).toHaveText(
		/1 question needs finishing before it can be played/
	);

	// Save opens the quiz's view page. Wait for that navigation before editing again;
	// otherwise a click can race with Save and be discarded as the editor closes.
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await page.waitForURL(`/view/${saved.body.id}`);
	await expect(play(page)).toBeDisabled();
	await expect(play(page)).toHaveAttribute('aria-describedby', 'draft-hint');
	await page.getByRole('link', { name: 'Edit', exact: true }).click();
	await expect(titleBox(page)).toContainText(title);
	await expect(play(page)).toBeDisabled();

	// Finishing the question turns it on, and the reason goes with it.
	await page.getByRole('button', { name: 'Mark as correct: Lyon', exact: true }).click();
	await expect(play(page)).toBeEnabled();
	await expect(play(page)).not.toHaveAttribute('aria-describedby', /.+/);
	await context.close();
});

test('what was typed a moment ago is saved before the dialog opens', async ({
	browser,
	request
}) => {
	const { context, page } = await signedInContext(browser, request);
	const title = `Play typed ${Date.now()}`;
	const typed = `Typed ${Date.now()}: still the frog?`;
	const saved = await saveQuiz(context.request, complete(title));
	expect(saved.status, JSON.stringify(saved.body)).toBe(200);
	const id = saved.body.id;

	await openInEditor(page, id, title);
	expect(await storedQuestion(page, id)).toBe('Which one is the frog?');
	await questionBox(page).fill(typed);
	// Straight away, well inside the 2.5 s the autosave waits: it is Play that saves this.
	await play(page).click();
	await expect(startDialog(page)).toBeVisible();
	expect(await storedQuestion(page, id)).toBe(typed);
	await context.close();
});

test('if the save fails the dialog does not open', async ({ browser, request }) => {
	const { context, page } = await signedInContext(browser, request);
	const title = `Play refused ${Date.now()}`;
	const saved = await saveQuiz(context.request, complete(title));
	expect(saved.status, JSON.stringify(saved.body)).toBe(200);
	const id = saved.body.id;

	await openInEditor(page, id, title);
	await page.route('**/api/v1/editor/save**', (route) =>
		route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"nope"}' })
	);
	await questionBox(page).fill('A change that cannot be kept');
	await play(page).click();
	await expect(page.getByRole('alert').filter({ hasText: 'Could not save' })).toBeVisible();
	await expect(startDialog(page)).toHaveCount(0);
	await context.close();
});

test('a game that fails to start closes the tab it opened and says so in the dialog', async ({
	browser,
	request
}) => {
	const { context, page } = await signedInContext(browser, request);
	const title = `Play failing ${Date.now()}`;
	const saved = await saveQuiz(context.request, complete(title));
	expect(saved.status, JSON.stringify(saved.body)).toBe(200);

	await openInEditor(page, saved.body.id, title);
	await page.route('**/api/v1/quiz/start/**', (route) =>
		route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
	);
	await play(page).click();
	const dialog = startDialog(page);
	const [tab] = await Promise.all([
		context.waitForEvent('page'),
		dialog.getByRole('button', { name: 'Start game' }).click()
	]);
	await expect(dialog.getByRole('alert')).toHaveText(/Failed to start the game/);
	await expect.poll(() => tab.isClosed()).toBe(true);
	// The editor is untouched and the dialog is still there to try again.
	expect(page.url()).toContain('/edit?quiz_id=');
	await expect(dialog).toBeVisible();
	await context.close();
});

test('the header fits 390, 834 and 1440, light and dark, with Play beside Save', async ({
	browser,
	request
}) => {
	const { context, page } = await signedInContext(browser, request);
	// Long on purpose (the title limit is 100): the title is what gives way when the row
	// is tight.
	const title = `Play header ${'a very long quiz title '.repeat(3)}${Date.now()}`;
	const saved = await saveQuiz(context.request, complete(title));
	expect(saved.status, JSON.stringify(saved.body)).toBe(200);

	await page.setViewportSize(PHONE);
	await openInEditor(page, saved.body.id, title.slice(0, 20));
	await expect(play(page)).toBeVisible();

	for (const theme of ['light', 'dark']) {
		const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
		if ((theme === 'dark') !== dark) {
			await page.getByRole('button', { name: /Switch to (dark|light) mode/ }).click();
		}
		expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(
			theme === 'dark'
		);
		for (const width of [390, 834, 1440]) {
			await page.setViewportSize({ width, height: PHONE.height });
			await expectNoHorizontalOverflow(page);
			for (const name of ['Play', 'Save']) {
				const box = await page.getByRole('button', { name, exact: true }).boundingBox();
				expect(box, `${name} at ${width} in ${theme}`).not.toBeNull();
				expect(box!.x).toBeGreaterThanOrEqual(0);
				expect(box!.x + box!.width, `${name} at ${width} in ${theme}`).toBeLessThanOrEqual(
					width
				);
			}
			// Play sits left of Save, on the same row.
			const p = (await play(page).boundingBox())!;
			const s = (await page
				.getByRole('button', { name: 'Save', exact: true })
				.boundingBox())!;
			expect(p.x + p.width).toBeLessThanOrEqual(s.x);
			expect(Math.abs(p.y - s.y)).toBeLessThan(2);
		}
	}
	await context.close();
});
