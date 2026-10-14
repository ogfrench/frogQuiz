// SPDX-FileCopyrightText: 2026 frogQuiz contributors
// SPDX-License-Identifier: MPL-2.0

import { expect, test } from '@playwright/test';
import { apiLogin, askForSignIn, registerUser } from './accounts';
import { ANON_KEY, expectNoHorizontalOverflow, PHONE, saveQuizButton, titleBox } from './helpers';
import { closeAll, connect, finalResults, joinAll, next, showQuestion, startGame } from './sockets';

test.afterEach(closeAll);

test.beforeEach(async ({ request }) => {
	const config = await (await request.get('/api/v1/utils/config')).json();
	test.skip(!config.anonymous_quizzes_enabled, 'needs guest creation enabled');
});

test('a guest imports, edits, hosts, then signs in and keeps the quiz', async ({
	browser,
	request
}) => {
	const template = await request.get('/api/v1/quiz/excel-template');
	expect(template.status()).toBe(200);
	const context = await browser.newContext({ viewport: PHONE, isMobile: true, hasTouch: true });
	const page = await context.newPage();
	await page.goto('/my-quizzes');
	await page.waitForLoadState('networkidle');
	await page
		.getByRole('link', { name: /create a quiz/i })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: /import from excel/i }).click();
	await dialog.locator('input[type=file]').setInputFiles({
		name: 'quiz.xlsx',
		mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		buffer: await template.body()
	});
	await expect(dialog.getByText('2 questions, ready to import')).toBeVisible();
	await expectNoHorizontalOverflow(page);
	await dialog.getByRole('button', { name: 'Create quiz', exact: true }).click();
	await page.waitForURL(/\/edit\?quiz_id=/);
	const id = new URL(page.url()).searchParams.get('quiz_id')!;
	const secret = await page.evaluate(
		([key, id]) => JSON.parse(localStorage.getItem(key) ?? '{}')[id],
		[ANON_KEY, id]
	);
	expect(secret).toBeTruthy();
	const title = `Excel guest ${Date.now()}`;
	await titleBox(page).fill(title);
	await saveQuizButton(page).click();
	await page.waitForURL(new RegExp(`/view/${id}$`));
	const start = await context.request.post(
		`/api/v1/quiz/start/${id}?game_mode=kahoot&captcha_enabled=False`,
		{
			headers: { 'X-Anon-Secret': secret }
		}
	);
	expect(start.status(), await start.text()).toBe(200);
	const { game_pin, game_id } = await start.json();
	const host = await connect();
	const registered = next(host, 'registered_as_admin');
	host.emit('register_as_admin', { game_pin, game_id });
	await registered;
	const [player] = await joinAll(String(game_pin), ['excelplayer']);
	await startGame(host);
	await showQuestion(host, 0);
	const firstAnswer = next(host, 'player_answer');
	player.emit('submit_answer', { question_index: 0, answer: 'Lisbon' });
	expect(await firstAnswer).not.toBeNull();
	await showQuestion(host, 1);
	const secondAnswer = next(host, 'player_answer');
	player.emit('submit_answer', { question_index: 1, answer: '02' });
	expect(await secondAnswer).not.toBeNull();
	const results = await finalResults(host);
	expect(Object.keys(results).sort()).toEqual(['0', '1']);
	for (const question of ['0', '1']) {
		expect(results[question].find((row) => row.username === 'excelplayer')?.right).toBe(true);
	}

	const user = await registerUser(request);
	await page.goto('/account/login');
	const { code } = await askForSignIn(page, user.email);
	await page.getByRole('textbox', { name: 'Six-digit code' }).fill(code);
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await page.waitForURL(/\/my-quizzes/);
	const prompt = page.getByRole('alertdialog');
	await expect(prompt).toContainText(title);
	await prompt.getByRole('button', { name: 'Add all to account', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'On this browser' })).toHaveCount(0);
	await expect(page.getByText(title, { exact: true })).toBeVisible();
	await expectNoHorizontalOverflow(page);
	const owned = await context.request.get(`/api/v1/quiz/get/${id}`);
	expect(owned.status()).toBe(200);
	expect((await owned.json()).expire_at).toBeNull();
	// A fresh signed-in browser proves ownership no longer depends on the guest secret.
	const fresh = await browser.newContext();
	await apiLogin(fresh.request, user.email);
	expect((await fresh.request.get(`/api/v1/quiz/get/${id}`)).status()).toBe(200);
	await fresh.close();
	await context.close();
});

test('preview creates no quiz and bad files offer no confirmation', async ({ page, request }) => {
	await page.goto('/my-quizzes');
	await page.waitForLoadState('networkidle');
	await page
		.getByRole('link', { name: /create a quiz/i })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: /import from excel/i }).click();
	await dialog.locator('input[type=file]').setInputFiles({
		name: 'broken.xlsx',
		mimeType: 'application/octet-stream',
		buffer: Buffer.from('not Excel')
	});
	await expect(dialog.getByText('1 thing to fix before we can import')).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Create quiz', exact: true })).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Choose another file', exact: true }).click();
	await dialog.locator('input[type=file]').setInputFiles({
		name: 'quiz.xlsx',
		mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		buffer: await (await request.get('/api/v1/quiz/excel-template')).body()
	});
	await expect(dialog.getByText('2 questions, ready to import')).toBeVisible();
	expect(
		await page.evaluate(
			(key) => Object.keys(JSON.parse(localStorage.getItem(key) ?? '{}')),
			ANON_KEY
		)
	).toEqual([]);
	await expectNoHorizontalOverflow(page);
});
