// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// "N of M answered" on the projector. The host added one per answer and took a player
// out of the total when they left, so two who answered and then left made it read
// "2 of 1 answered". Found by step 1's cheap review, 11 Oct.

import { expect, test } from '@playwright/test';
import { hostFromViewPage, mc, rememberAnonQuiz, saveQuiz } from './helpers';
import { closeAll, joinAll } from './sockets';

const QUIZ = {
	title: 'Answered count',
	description: 'e2e',
	questions: [
		mc(
			'Capital of Portugal?',
			[
				['Lisbon', true],
				['Porto', false]
			],
			'60'
		)
	]
};

test.afterEach(() => closeAll());

test('the answered count never runs past the players still in the game', async ({
	page,
	request
}) => {
	const saved = await saveQuiz(request, QUIZ);
	await rememberAnonQuiz(page, saved.body.id, saved.secret!);
	const pin = await hostFromViewPage(page, saved.body.id);
	const [ana, ben] = await joinAll(pin, ['ana', 'ben', 'cy']);
	await expect(page.getByRole('button', { name: /cy/ })).toBeVisible();

	await page
		.getByRole('button', { name: /Start game/ })
		.first()
		.click();
	await page
		.getByRole('button', { name: /Next question/ })
		.first()
		.click();
	await expect(page.getByRole('progressbar', { name: 'Time remaining' })).toBeVisible({
		timeout: 15_000
	});
	const count = page.getByText(/\d+ of \d+ answered/);

	ana.emit('submit_answer', { question_index: 0, answer: 'Lisbon' });
	ben.emit('submit_answer', { question_index: 0, answer: 'Porto' });
	await expect(count).toHaveText('2 of 3 answered');

	// Both who answered leave; cy, who has not, is the room now.
	ana.emit('leave_game');
	ben.emit('leave_game');
	await expect(count).toHaveText('0 of 1 answered');
});
