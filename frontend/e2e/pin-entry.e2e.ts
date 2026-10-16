// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// #82: the PIN box on / and on /play is one component, and a wrong PIN is something to
// fix, not something to start over from. The sixth digit used to show the nickname step
// before the server had answered, then wipe the PIN when it said no -- taking a nickname
// typed in the meantime with it. The home page's box took any text at all.

import { expect, test, type Page } from '@playwright/test';
import { gotoPlayHydrated, PHONE, mc } from './helpers';
import { hostGame } from './sockets';

const QUIZ = {
	title: 'PIN entry',
	description: 'e2e',
	questions: [
		mc('One?', [
			['yes', true],
			['no', false]
		])
	]
};

// PINs are randint(100000, 999999), so a leading zero is never a game.
const WRONG = '012345';
const NOT_FOUND = 'No game with that PIN';

async function gotoHomeHydrated(page: Page) {
	await page.goto('/');
	await page.waitForLoadState('networkidle');
}

test.use({ viewport: PHONE });

test('a wrong PIN on /play keeps the digits, says so, and never shows the nickname step', async ({
	page
}) => {
	// Slow the answer down, as production's network does: the nickname step used to sit on
	// screen for exactly this long before the PIN was wiped.
	await page.route('**/api/v1/quiz/play/check_captcha/**', async (route) => {
		await new Promise((r) => setTimeout(r, 600));
		await route.continue();
	});
	await gotoPlayHydrated(page);
	const pin = page.getByRole('textbox', { name: 'Game PIN' });
	await pin.pressSequentially(WRONG);

	const nickname = page.getByRole('textbox', { name: 'Nickname' });
	await expect(page.getByRole('alert')).toContainText(NOT_FOUND);
	await expect(nickname).toHaveCount(0);
	await expect(pin).toHaveValue(WRONG);
	await expect(pin).toHaveAttribute('aria-invalid', 'true');
	await expect(pin).toBeFocused();

	// The digits are selected, so the next one starts the PIN over, and editing clears
	// the error.
	await page.keyboard.type('9');
	await expect(pin).toHaveValue('9');
	await expect(page.getByRole('alert')).toHaveCount(0);
	await expect(pin).not.toHaveAttribute('aria-invalid', 'true');
});

test('a join link pasted into /play joins, wherever it was copied from', async ({
	page,
	request
}) => {
	const { pin, host } = await hostGame(request, QUIZ);
	await gotoPlayHydrated(page);
	await page.getByRole('textbox', { name: 'Game PIN' }).focus();
	// The port's digits used to be read as part of the PIN.
	await page.keyboard.insertText(`http://localhost:3200/play?pin=${pin}&ref=Qr`);
	await expect(page.getByRole('textbox', { name: 'Nickname' })).toBeVisible();
	host.disconnect();
});

test('a wrong PIN in the link opens /play on the PIN, not on a blank box', async ({ page }) => {
	await page.goto(`/play?pin=${WRONG}`);
	const pin = page.getByRole('textbox', { name: 'Game PIN' });
	await expect(page.getByRole('alert')).toContainText(NOT_FOUND);
	await expect(pin).toHaveValue(WRONG);
	// Reloading would only ask about the same PIN again.
	await expect(page).toHaveURL(/\/play$/);
});

test('a link with too many digits says so instead of a silent, disabled Join', async ({ page }) => {
	await page.goto('/play?pin=1234567');
	await expect(page.getByText('A game PIN has 6 digits.')).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Game PIN' })).toHaveValue('1234567');
});

test('the home page box takes digits only, and says when there are too many', async ({ page }) => {
	await gotoHomeHydrated(page);
	const pin = page.getByRole('textbox', { name: 'Game PIN' });
	const join = page.getByRole('button', { name: 'Join', exact: true });

	await pin.pressSequentially('hello frog 12');
	await expect(pin).toHaveValue('12');
	await expect(join).toBeDisabled();

	await pin.fill('');
	await pin.pressSequentially('1234567');
	await expect(pin).toHaveValue('1234567');
	await expect(page.getByText('A game PIN has 6 digits.')).toBeVisible();
	await expect(join).toBeDisabled();
	// One Backspace takes off the extra digit, not the whole PIN.
	await page.keyboard.press('Backspace');
	await expect(pin).toHaveValue('123456');
	await expect(page.getByText('A game PIN has 6 digits.')).toHaveCount(0);
});

test('a wrong PIN on the home page stays on the home page', async ({ page }) => {
	await gotoHomeHydrated(page);
	const pin = page.getByRole('textbox', { name: 'Game PIN' });
	await pin.pressSequentially(WRONG);
	await expect(page.getByRole('alert')).toContainText(NOT_FOUND);
	await page.getByRole('button', { name: 'Join', exact: true }).click({ force: true });
	await expect(page).toHaveURL(/\/$/);
	await expect(pin).toHaveValue(WRONG);
});

test('a right PIN on the home page goes on to the nickname', async ({ page, request }) => {
	const { pin, host } = await hostGame(request, QUIZ);
	await gotoHomeHydrated(page);
	await page.getByRole('textbox', { name: 'Game PIN' }).pressSequentially(pin);
	await page.getByRole('button', { name: 'Join', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/play\\?pin=${pin}$`));
	await expect(page.getByRole('textbox', { name: 'Nickname' })).toBeVisible();
	host.disconnect();
});
