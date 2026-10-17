// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// A click on a name in the lobby removes that player at once, with five seconds to take it
// back (François, 17 Oct). The kick is only sent when the Undo runs out, or when the game
// starts, so a player the host meant to keep is never thrown out, and one the host removed
// is never in the game.

import { expect, test, type Browser } from '@playwright/test';
import { hostFromViewPage, joinAsPlayer, mc, rememberAnonQuiz, saveQuiz } from './helpers';

const QUIZ = {
	title: 'Lobby kick',
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

async function lobby(browser: Browser, request: Parameters<typeof saveQuiz>[0]) {
	const saved = await saveQuiz(request, QUIZ);
	const hostCtx = await browser.newContext();
	const host = await hostCtx.newPage();
	await rememberAnonQuiz(host, saved.body.id, saved.secret!);
	const pin = await hostFromViewPage(host, saved.body.id);
	const keep = await joinAsPlayer(browser, pin, 'keep');
	const gone = await joinAsPlayer(browser, pin, 'gone');
	await expect(host.getByText('2 players are waiting')).toBeVisible();
	return { hostCtx, host, keep, gone };
}

test('Undo puts the player back, and they were never removed', async ({ browser, request }) => {
	const { hostCtx, host, keep, gone } = await lobby(browser, request);
	await host.getByRole('button', { name: 'Kick: keep', exact: true }).click();
	await expect(host.getByText('Removed keep')).toBeVisible();
	await expect(host.getByText('1 player is waiting')).toBeVisible();
	await host.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect(host.getByRole('button', { name: 'Kick: keep', exact: true })).toBeVisible();
	await expect(host.getByText('2 players are waiting')).toBeVisible();
	// Past the five seconds, the phone is still in the lobby: nothing was sent.
	await host.waitForTimeout(6000);
	await expect(keep.page.getByText('The host removed you from this game.')).toHaveCount(0);
	await hostCtx.close();
	await keep.context.close();
	await gone.context.close();
});

test('without Undo the player is removed after five seconds', async ({ browser, request }) => {
	const { hostCtx, host, keep, gone } = await lobby(browser, request);
	await host.getByRole('button', { name: 'Kick: gone', exact: true }).click();
	await expect(host.getByText('Removed gone')).toBeVisible();
	await expect(gone.page.getByText('The host removed you from this game.')).toBeVisible({
		timeout: 10_000
	});
	await expect(host.getByText('Removed gone')).toHaveCount(0);
	await hostCtx.close();
	await keep.context.close();
	await gone.context.close();
});

test('starting the game sends a removal still waiting on its Undo', async ({
	browser,
	request
}) => {
	const { hostCtx, host, keep, gone } = await lobby(browser, request);
	await host.getByRole('button', { name: 'Kick: gone', exact: true }).click();
	await host.getByRole('button', { name: 'Start game' }).click();
	await expect(gone.page.getByText('The host removed you from this game.')).toBeVisible();
	await hostCtx.close();
	await keep.context.close();
	await gone.context.close();
});
