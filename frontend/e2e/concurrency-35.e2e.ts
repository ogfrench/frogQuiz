// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// The four #35 rows that were still predictions (docs/e2e-findings.md, rows 5, 6, 11 and
// 12), measured with signed-in hosts, which is how production runs since #55.

import { expect, test, type APIRequestContext } from '@playwright/test';
import { signedInContext } from './accounts';
import {
	advanceToFinalResults,
	hostFromViewPage,
	joinAsPlayer,
	mc,
	saveQuiz,
	showResults
} from './helpers';

const QUIZ = {
	title: 'Concurrency',
	description: 'e2e',
	questions: [
		mc('Capital of Portugal?', [
			['Lisbon', true],
			['Porto', false]
		])
	]
};

const listTitles = async (request: APIRequestContext) =>
	(
		(await (await request.get('/api/v1/quiz/list?page_size=100')).json()) as { title: string }[]
	).map((q) => q.title);

test('row 5: a new quiz saved first in two tabs makes two quizzes, and neither is lost', async ({
	browser,
	request
}) => {
	// The editor's own calls: each /create tab opens its own edit session, and a new quiz
	// cannot be saved from the page until it has a question, so the saves go through the API.
	const { context } = await signedInContext(browser, request);
	const session = async () =>
		(await (await context.request.post('/api/v1/editor/start?edit=false')).json())
			.token as string;
	const [a, b] = [await session(), await session()];
	const save = (token: string, title: string) =>
		context.request.post(`/api/v1/editor/save?edit_id=${token}`, { data: { ...QUIZ, title } });
	const [savedA, savedB] = [await save(a, 'From tab A'), await save(b, 'From tab B')];
	expect(savedA.status()).toBe(200);
	expect(savedB.status()).toBe(200);
	expect((await savedA.json()).id).not.toBe((await savedB.json()).id);
	// A second save in each tab updates its own quiz, not the other one.
	expect((await save(a, 'From tab A, again')).status()).toBe(200);
	expect((await listTitles(context.request)).sort()).toEqual(['From tab A, again', 'From tab B']);
	await context.close();
});

test('row 6: launched twice, /live follows the newest game and the first one still runs', async ({
	browser,
	request
}) => {
	const { context, page } = await signedInContext(browser, request);
	const id = (await saveQuiz(context.request, QUIZ)).body.id as string;
	const first = await hostFromViewPage(page, id);
	const player = await joinAsPlayer(browser, first, 'robin');
	await expect(page.getByText('robin', { exact: true })).toBeVisible();

	// The second launch, from another tab or device of the same account.
	const again = await context.request.post(`/api/v1/quiz/start/${id}?game_mode=kahoot`);
	expect(again.status()).toBe(200);
	const second = String((await again.json()).game_pin);
	expect(second).not.toBe(first);

	const { key } = await (await context.request.post('/api/v1/users/api_keys')).json();
	const live = async (pinOrQuiz: string) =>
		context.request.get(`/api/v1/live/?game_pin=${pinOrQuiz}&api_key=${key}`);
	// Asked by quiz id, /live follows the pointer to the newest game, which has no host screen
	// yet and so no session: 404, while the first game still answers by its PIN.
	expect((await live(id)).status()).toBe(404);
	expect((await live(first)).status()).toBe(200);
	// Once the second game's host screen opens, the quiz id names it.
	const host2 = await context.newPage();
	await host2.goto(`/admin?token=${(await again.json()).game_id}&pin=${second}&connect=1`);
	await expect(host2.getByRole('button', { name: 'Start game' })).toBeVisible();
	const byQuiz = await live(id);
	expect(byQuiz.status()).toBe(200);
	expect(String((await byQuiz.json()).quiz.game_pin)).toBe(second);
	expect((await live(first)).status()).toBe(200);
	await page.bringToFront();

	// And it plays to the end for its players.
	await page.getByRole('button', { name: 'Start game' }).click();
	await page.getByRole('button', { name: /Next question/ }).click();
	await player.page.getByRole('button', { name: 'Lisbon' }).click();
	await expect(page.getByText('1 of 1 answered')).toBeVisible();
	await showResults(page);
	await advanceToFinalResults(page);
	await expect(player.page.locator('.fixed.bottom-0').getByText('1st place')).toBeVisible();
	await player.context.close();
	await context.close();
});

for (const change of ['made not public', 'deleted'] as const) {
	test(`row 11: a public quiz ${change} by its owner while someone else hosts it`, async ({
		browser,
		request
	}) => {
		const owner = await signedInContext(browser, request);
		const id = (await saveQuiz(owner.context.request, { ...QUIZ, public: true })).body
			.id as string;
		const host = await signedInContext(browser, request);
		const pin = await hostFromViewPage(host.page, id);
		const player = await joinAsPlayer(browser, pin, 'sam');
		await expect(host.page.getByText('sam', { exact: true })).toBeVisible();
		await host.page.getByRole('button', { name: 'Start game' }).click();

		if (change === 'deleted') {
			expect((await owner.context.request.delete(`/api/v1/quiz/delete/${id}`)).status()).toBe(
				200
			);
		} else {
			const { token } = await (
				await owner.context.request.post(`/api/v1/editor/start?edit=true&quiz_id=${id}`)
			).json();
			const res = await owner.context.request.post(`/api/v1/editor/save?edit_id=${token}`, {
				data: { ...QUIZ, public: false }
			});
			expect(res.status(), await res.text()).toBe(200);
		}

		await host.page.getByRole('button', { name: /Next question/ }).click();
		await player.page.getByRole('button', { name: 'Lisbon' }).click();
		await expect(host.page.getByText('1 of 1 answered')).toBeVisible();
		await showResults(host.page);
		await advanceToFinalResults(host.page);
		await expect(host.page.locator('.podium-block.is-gold')).toBeVisible();
		await expect(player.page.locator('.fixed.bottom-0').getByText('1st place')).toBeVisible();
		await expect(host.page.getByRole('button', { name: 'Download results' })).toBeVisible();
		await player.context.close();
		await host.context.close();
		await owner.context.close();
	});
}

test('row 12: a second host tab on the same game', async ({ browser, request }) => {
	const { context, page } = await signedInContext(browser, request);
	const id = (await saveQuiz(context.request, QUIZ)).body.id as string;
	const pin = await hostFromViewPage(page, id);
	const player = await joinAsPlayer(browser, pin, 'alex');
	await expect(page.getByText('alex', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Start game' }).click();

	const second = await context.newPage();
	await second.goto(page.url());
	await second.waitForLoadState('networkidle');
	// It opens on the step the game is at, with the same controls.
	await expect(second.getByRole('button', { name: /Next question/ })).toBeVisible();
	await expect(second.getByText(pin).first()).toBeVisible();

	await page.bringToFront();
	await page.getByRole('button', { name: /Next question/ }).click();
	await player.page.getByRole('button', { name: 'Lisbon' }).click();
	await expect(page.getByText('1 of 1 answered')).toBeVisible();
	await second.bringToFront();
	await expect(second.getByText('Capital of Portugal?')).toBeVisible();
	await page.bringToFront();
	await showResults(page);
	await advanceToFinalResults(page);
	await expect(player.page.locator('.fixed.bottom-0').getByText('1st place')).toBeVisible();
	await second.bringToFront();
	await expect(second.getByRole('button', { name: 'Download results' })).toBeVisible();
	await player.context.close();
	await context.close();
});
