// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// The game as production runs it since #55: a signed-in host, players with no account.
// Every other full-game spec hosts without an account, so with `anonymous_quizzes_enabled`
// off (the production default) none of them could run, and nothing checked this path
// end to end in a browser. This one does not depend on the setting, so it passes with it
// on or off: start the stack with ANONYMOUS_QUIZZES_ENABLED=False to see the production side.

import { expect, test } from '@playwright/test';
import { signedInContext } from './accounts';
import {
	advancePastResults,
	advanceToFinalResults,
	expectNoHorizontalOverflow,
	hostFromViewPage,
	joinAsPlayer,
	mc,
	saveQuiz,
	showResults
} from './helpers';

const NAMES = ['anabela', 'bruno'];

test('a signed-in host runs a game with players who have no account', async ({
	browser,
	request
}) => {
	const { context, page } = await signedInContext(browser, request);
	const saved = await saveQuiz(context.request, {
		title: `Account game ${Date.now()}`,
		description: 'signed-in host, anonymous players',
		questions: [
			mc('Capital of Portugal?', [
				['Lisbon', true],
				['Porto', false]
			]),
			mc('2 + 2?', [
				['4', true],
				['5', false]
			])
		]
	});
	expect(saved.status).toBe(200);
	expect(saved.secret, 'a signed-in save carries no anonymous secret').toBeFalsy();

	const pin = await hostFromViewPage(page, saved.body.id);
	const players = [];
	for (const name of NAMES) players.push(await joinAsPlayer(browser, pin, name));
	const [ana, bruno] = players.map((p) => p.page);
	for (const p of [ana, bruno]) await expect(p.getByText(/You're in/)).toBeVisible();
	for (const name of NAMES) await expect(page.getByText(name, { exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Start game' }).click();
	// The title card before question 1 (12 Oct): the facts of the game, and no guess at
	// how long it will take.
	await expect(page.getByText('2 questions', { exact: true })).toBeVisible();
	await expect(page.getByText('2 players', { exact: true })).toBeVisible();
	await expect(page.getByText('Get ready')).toBeVisible();
	await expect(page.getByText(/minute/i)).toHaveCount(0);
	await expectNoHorizontalOverflow(page);
	await page.getByRole('button', { name: /Next question/ }).click();
	await ana.getByRole('button', { name: 'Lisbon' }).click();
	await bruno.getByRole('button', { name: 'Porto' }).click();
	await expect(page.getByText('2 of 2 answered')).toBeVisible();
	await showResults(page);

	await advancePastResults(page);
	await ana.getByRole('button', { name: '4', exact: true }).click();
	await bruno.getByRole('button', { name: '4', exact: true }).click();
	await expect(page.getByText('2 of 2 answered')).toBeVisible();
	await showResults(page);

	await advanceToFinalResults(page);
	await expect(page.locator('.podium-block.is-gold')).toBeVisible();
	await expect(ana.locator('.fixed.bottom-0').getByText('1st place')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Download results' })).toBeVisible();
	for (const p of [page, ana, bruno]) await expectNoHorizontalOverflow(p);

	for (const { context: c } of players) await c.close();
	await context.close();
});
