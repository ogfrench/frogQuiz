// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// The live scoreboard counts a hide-results question, as the podium does. The host added
// a question's points itself when its answers screen came up, and a hide-results question
// has no answers screen, so its points were missing from every scoreboard after it and
// only appeared on the podium. The totals come from the server now.

import { expect, test } from '@playwright/test';
import { hostFromViewPage, mc, rememberAnonQuiz, saveQuiz } from './helpers';
import { closeAll, joinAll } from './sockets';

const QUIZ = {
	title: 'Hidden points',
	description: 'e2e',
	questions: [
		{
			...mc(
				'Capital of Portugal?',
				[
					['Lisbon', true],
					['Porto', false]
				],
				'60'
			),
			hide_results: true
		},
		mc(
			'Capital of Spain?',
			[
				['Madrid', true],
				['Seville', false]
			],
			'60'
		),
		// A third, so the second gets a scoreboard: the last question stops at its answers.
		mc(
			'Capital of Italy?',
			[
				['Rome', true],
				['Milan', false]
			],
			'60'
		)
	]
};

test.afterEach(() => closeAll());

test('points from a hide-results question are on the next scoreboard', async ({
	page,
	request
}) => {
	test.setTimeout(120_000);
	const saved = await saveQuiz(request, QUIZ as never);
	await rememberAnonQuiz(page, saved.body.id, saved.secret!);
	const pin = await hostFromViewPage(page, saved.body.id);
	const [ana, ben] = await joinAll(pin, ['ana', 'ben']);
	await expect(page.getByRole('button', { name: /ben/ })).toBeVisible();

	await page
		.getByRole('button', { name: /Start game/ })
		.first()
		.click();
	const nextQuestion = page.getByRole('button', { name: /Next question/ }).first();
	await nextQuestion.click();
	await expect(page.getByRole('progressbar', { name: 'Time remaining' })).toBeVisible({
		timeout: 15_000
	});

	// Question 1, results hidden: only ana is right.
	ana.emit('submit_answer', { question_index: 0, answer: 'Lisbon' });
	ben.emit('submit_answer', { question_index: 0, answer: 'Porto' });
	await expect(nextQuestion).toBeEnabled({ timeout: 15_000 });
	await nextQuestion.click();
	await expect(page.getByRole('heading', { name: 'Capital of Spain?' }).first()).toBeVisible({
		timeout: 15_000
	});

	// Question 2: only ben is right. Its answers come up, then the scoreboard, by themselves.
	ana.emit('submit_answer', { question_index: 1, answer: 'Seville' });
	ben.emit('submit_answer', { question_index: 1, answer: 'Madrid' });
	await expect(page.getByRole('heading', { name: 'Scoreboard', exact: true })).toBeVisible({
		timeout: 20_000
	});

	// ana gained nothing on question 2, so her total is question 1's points: not 0.
	const anaRow = page.getByRole('listitem').filter({ hasText: 'ana' });
	await expect(anaRow).toContainText('+0');
	const total = Number((await anaRow.innerText()).match(/(\d+)\s*\+0\s*$/)?.[1]);
	expect(total, 'question 1 (hidden) is missing from the scoreboard').toBeGreaterThan(0);
});
