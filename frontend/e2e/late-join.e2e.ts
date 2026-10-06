// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Late join and the lock, on the screens (François, 5 Oct, "like Kahoot"). The rules
// themselves are in live-socket.e2e.ts; this is what the host and a phone see.

import { expect, test, type Browser } from '@playwright/test';
import { hostFromViewPage, joinAsPlayer, mc, rememberAnonQuiz, saveQuiz } from './helpers';
import { closeAll, join } from './sockets';

const QUIZ = {
	title: 'Late join',
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

test.afterEach(closeAll);

async function hostInBrowser(browser: Browser, request: Parameters<typeof saveQuiz>[0]) {
	const saved = await saveQuiz(request, QUIZ);
	const hostCtx = await browser.newContext();
	const host = await hostCtx.newPage();
	await rememberAnonQuiz(host, saved.body.id, saved.secret!);
	return { hostCtx, host, pin: await hostFromViewPage(host, saved.body.id) };
}

test('the host locks the lobby, a phone is told so, and unlocking lets it in', async ({
	browser,
	request
}) => {
	const { hostCtx, host, pin } = await hostInBrowser(browser, request);
	await host.getByRole('button', { name: 'Lock game' }).click();
	await expect(host.getByRole('button', { name: 'Unlock game' })).toBeVisible();

	const { context, page: phone } = await joinAsPlayer(browser, pin, 'knocking');
	await expect(
		phone.getByText('The host has locked this game, so nobody new can join.')
	).toBeVisible();

	await host.getByRole('button', { name: 'Unlock game' }).click();
	await expect(host.getByRole('button', { name: 'Lock game' })).toBeVisible();
	await phone.getByRole('textbox', { name: 'Game PIN' }).fill(pin);
	await phone.getByRole('textbox', { name: 'Username' }).fill('knocking');
	await phone.getByRole('button', { name: 'Join game' }).click();
	await expect(host.getByRole('button', { name: 'Kick: knocking' })).toBeVisible();
	await context.close();
	await hostCtx.close();
});

test('a phone that joins mid-question gets the question, and the host can lock mid-game', async ({
	browser,
	request
}) => {
	const { hostCtx, host, pin } = await hostInBrowser(browser, request);
	expect((await join(pin, 'early')).outcome).toBe('joined');
	await host.getByRole('button', { name: 'Start game' }).click();
	await host.getByRole('button', { name: /Next question/ }).click();
	await expect(host.getByText('Capital of Portugal?')).toBeVisible();
	// The lobby is gone, so the PIN stays on the host's bar for whoever arrives late.
	await expect(host.getByText(pin)).toBeVisible();

	const { context, page: phone } = await joinAsPlayer(browser, pin, 'latecomer');
	const lisbon = phone.getByRole('button', { name: 'Lisbon' });
	await lisbon.click();
	await expect(lisbon).toBeDisabled();
	await expect(host.getByText('1 answer submitted')).toBeVisible();

	await host.getByRole('button', { name: 'Lock game' }).click();
	await expect(host.getByRole('button', { name: 'Unlock game' })).toBeVisible();
	await expect(host.getByText(pin)).toBeHidden();
	expect((await join(pin, 'too-late')).outcome).toBe('game_locked');
	await context.close();
	await hostCtx.close();
});
