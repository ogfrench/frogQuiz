// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// A click on a name in the lobby removes that player at once, with five seconds to take it
// back (François, 17 Oct). The kick is only sent when the Undo runs out, or when the game
// starts, so a player the host meant to keep is never thrown out, and one the host removed
// is never in the game.

import { expect, test, type Browser, type Page } from '@playwright/test';
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
	// Past the server's own wait (six seconds), the phone is still in the lobby.
	await host.waitForTimeout(7500);
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

// The window is five seconds of the server's list changing under the host. The removed
// player used to be spliced out and put back on Undo, so a reload inside the window came
// back as a second chip with the same key (which breaks the board), and one who left came
// back as a ghost that counted towards Start.
test('a player who reloads inside the window is still removed, and shown once', async ({
	browser,
	request
}) => {
	const { hostCtx, host, keep, gone } = await lobby(browser, request);
	await host.getByRole('button', { name: 'Kick: gone', exact: true }).click();
	await gone.page.reload();
	await expect(host.getByText('1 player is waiting')).toBeVisible();
	await expect(host.getByRole('button', { name: 'Kick: gone', exact: true })).toHaveCount(0);
	await expect(gone.page.getByText('The host removed you from this game.')).toBeVisible({
		timeout: 10_000
	});
	await expect(host.getByText('1 player is waiting')).toBeVisible();
	await hostCtx.close();
	await keep.context.close();
	await gone.context.close();
});

test('Undo after the player left brings back no one', async ({ browser, request }) => {
	const { hostCtx, host, keep, gone } = await lobby(browser, request);
	const errors: string[] = [];
	host.on('pageerror', (e) => errors.push(e.message));
	await host.getByRole('button', { name: 'Kick: gone', exact: true }).click();
	await gone.context.close();
	// They are gone, so there is nothing to undo.
	await expect(host.getByText('Removed gone')).toHaveCount(0);
	await expect(host.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
	await expect(host.getByText('1 player is waiting')).toBeVisible();
	await host.getByRole('button', { name: 'Kick: keep', exact: true }).click();
	await host.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect(host.getByText('1 player is waiting')).toBeVisible();
	await expect(host.getByRole('button', { name: 'Kick: gone', exact: true })).toHaveCount(0);
	expect(errors).toEqual([]);
	await hostCtx.close();
	await keep.context.close();
});

// The name of a player being removed used to stay taken for the five seconds, so the next
// person to pick it was told it existed. Asking for it now ends the removal at once.
test('someone else can take a removed name inside the window', async ({ browser, request }) => {
	const { hostCtx, host, keep, gone } = await lobby(browser, request);
	await host.getByRole('button', { name: 'Kick: gone', exact: true }).click();
	await expect(host.getByText('Removed gone')).toBeVisible();
	const again = await joinAsPlayer(browser, (await pinOf(host))!, 'gone');
	await expect(gone.page.getByText('The host removed you from this game.')).toBeVisible();
	await expect(host.getByText('Removed gone')).toHaveCount(0);
	await expect(host.getByRole('button', { name: 'Kick: gone', exact: true })).toBeVisible();
	await expect(host.getByText('2 players are waiting')).toBeVisible();
	// The removal is over, so the newcomer is not caught by it later.
	await host.waitForTimeout(7500);
	await expect(again.page.getByText('The host removed you from this game.')).toHaveCount(0);
	await expect(host.getByText('2 players are waiting')).toBeVisible();
	await hostCtx.close();
	await keep.context.close();
	await gone.context.close();
	await again.context.close();
});

// The wait was the host tab's, so closing it inside the window dropped the removal and the
// player came back with the host. The server waits now.
test('a host who closes the tab inside the window still removes the player', async ({
	browser,
	request
}) => {
	const { hostCtx, host, keep, gone } = await lobby(browser, request);
	await host.getByRole('button', { name: 'Kick: gone', exact: true }).click();
	await expect(host.getByText('Removed gone')).toBeVisible();
	await hostCtx.close();
	await expect(gone.page.getByText('The host removed you from this game.')).toBeVisible({
		timeout: 15_000
	});
	await expect(keep.page.getByText('The host removed you from this game.')).toHaveCount(0);
	await keep.context.close();
	await gone.context.close();
});

const pinOf = async (host: Page) => new URL(host.url()).searchParams.get('pin');
