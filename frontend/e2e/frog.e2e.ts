// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// A person's frog (François, 12 Oct): their username gives them one until they pick, the
// pick is kept on the account, and the navbar's circle and My Account show the same one.

import { expect, test, type Page } from '@playwright/test';
import { signedInContext } from './accounts';
import { expectNoHorizontalOverflow, PHONE } from './helpers';

const mine = (page: Page) => page.locator('main img[src*="frog-"]').first();
const frogOf = async (page: Page) => (await mine(page).getAttribute('src'))!;

test('a frog comes with the username, can be picked, and is kept', async ({ browser, request }) => {
	const { page, context } = await signedInContext(browser, request);
	await page.goto('/account/settings');

	const first = await frogOf(page);
	expect(first).toContain('frog-');

	// Tap another frog in the strip: it saves at once, says so, and the avatar changes.
	await page.locator('button[aria-label^="Use frog"][aria-pressed="false"]').nth(3).click();
	await expect(page.getByRole('status')).toContainText('Frog changed.');
	const picked = await frogOf(page);
	expect(picked).not.toBe(first);

	// Kept on the account: a reload shows the pick, and /me says so.
	await page.reload();
	expect(await frogOf(page)).toBe(picked);
	const me = await (await page.request.get('/api/v1/users/me')).json();
	expect(me.frog).toMatch(/^\d-\d{2}$/);

	// Undo goes back to the username's frog.
	await page.getByRole('button', { name: 'Surprise me' }).click();
	await expect(page.getByRole('status')).toContainText('Frog changed.');
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect.poll(() => frogOf(page)).toBe(picked);
	await context.close();
});

test('the colour row changes the strip, and the page fits a phone', async ({ browser, request }) => {
	const { page, context } = await signedInContext(browser, request);
	await page.setViewportSize(PHONE);
	await page.goto('/account/settings');
	const first = page.locator('button[aria-label="Use frog 1"] img');
	await page.getByRole('button', { name: 'Colour 1' }).click();
	const one = await first.getAttribute('src');
	await page.getByRole('button', { name: 'Colour 2' }).click();
	expect(await first.getAttribute('src')).not.toBe(one);
	await expectNoHorizontalOverflow(page);
	await context.close();
});
