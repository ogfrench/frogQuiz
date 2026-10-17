// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Space and Enter start the game from the lobby, as they take the next step all game, and
// Start sits where Next will be (François, 17 Oct). A key that a focused control already
// handles must not also start the game: the Cancel dialog takes focus on its own content
// when it opens, and a chip's Space is a removal.

import { expect, test, type Page } from '@playwright/test';
import { hostFromViewPage, joinAsPlayer, mc, rememberAnonQuiz, saveQuiz } from './helpers';

const QUIZ = {
	title: 'Lobby keys',
	description: 'e2e',
	questions: [
		mc('Capital of Portugal?', [
			['Lisbon', true],
			['Porto', false]
		])
	]
};

const inLobby = (host: Page) => host.getByRole('heading', { name: 'Waiting for players' });

test('Space starts the game, but not from the Cancel dialog, a chip, or an empty room', async ({
	browser,
	request
}) => {
	const saved = await saveQuiz(request, QUIZ);
	const hostCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const host = await hostCtx.newPage();
	await rememberAnonQuiz(host, saved.body.id, saved.secret!);
	const pin = await hostFromViewPage(host, saved.body.id);
	const start = host.getByRole('button', { name: 'Start game', exact: true });

	// Nobody to start with: the key does nothing, as the disabled button does.
	await expect(start).toBeDisabled();
	await host.locator('body').click({ position: { x: 5, y: 450 } });
	await host.keyboard.press('Space');
	await host.waitForTimeout(500);
	await expect(inLobby(host)).toBeAttached();

	const player = await joinAsPlayer(browser, pin, 'Ana');
	await expect(host.getByText('1 player is waiting')).toBeVisible();
	await expect(start).toBeEnabled();

	// The Cancel dialog focuses itself, not a button, when it opens.
	await host.getByRole('button', { name: 'Cancel game' }).click();
	const dialog = host.getByRole('alertdialog');
	await expect(dialog).toBeVisible();
	await host.keyboard.press('Space');
	await host.keyboard.press('Enter');
	await host.waitForTimeout(500);
	await expect(dialog).toBeVisible();
	await expect(inLobby(host)).toBeAttached();
	await host.keyboard.press('Escape');
	await expect(dialog).toBeHidden();

	// Space on a chip removes that player (the chip's own key), and does not start.
	await host.getByRole('button', { name: 'Kick: Ana', exact: true }).focus();
	await host.keyboard.press('Space');
	await expect(host.getByText('Removed Ana')).toBeVisible();
	await expect(inLobby(host)).toBeAttached();
	await host.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect(host.getByText('1 player is waiting')).toBeVisible();

	// With focus on the page, Space starts the game.
	await host.locator('body').click({ position: { x: 5, y: 450 } });
	await host.keyboard.press('Space');
	await expect(inLobby(host)).toHaveCount(0);

	await hostCtx.close();
	await player.context.close();
});
