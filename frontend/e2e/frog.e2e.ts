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
	test.setTimeout(120_000);
	const { page, context } = await signedInContext(browser, request);
	await page.goto('/account/settings');

	// The picker is closed until asked for.
	await expect(page.getByRole('button', { name: 'Surprise me' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Edit picture' }).click();

	const first = await frogOf(page);
	expect(first).toContain('frog-');

	// A tap only tries a frog: the big picture follows, nothing is kept until Save.
	await page.locator('button[aria-label^="Use frog"][aria-pressed="false"]').nth(3).click();
	const tried = await frogOf(page);
	expect(tried).not.toBe(first);
	await page.getByRole('button', { name: 'Cancel' }).click();
	expect(await frogOf(page)).toBe(first);
	await page.reload();
	expect(await frogOf(page)).toBe(first);

	// Save keeps it, and the picker closes.
	await page.getByRole('button', { name: 'Edit picture' }).click();
	await page.locator('button[aria-label^="Use frog"][aria-pressed="false"]').nth(3).click();
	const picked = await frogOf(page);
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('status')).toContainText('Frog changed.');
	await expect(page.getByRole('button', { name: 'Surprise me' })).toHaveCount(0);
	await page.reload();
	expect(await frogOf(page)).toBe(picked);
	const me = await (await page.request.get('/api/v1/users/me')).json();
	expect(me.frog).toMatch(/^\d-\d{2}$/);

	// Surprise me tries another one.
	await page.getByRole('button', { name: 'Edit picture' }).click();
	await page.getByRole('button', { name: 'Surprise me' }).click();
	expect(await frogOf(page)).not.toBe(picked);

	// The colour row changes the strip, and the page still fits a phone.
	await page.setViewportSize(PHONE);
	const poseOne = page.locator('button[aria-label="Use frog 1"] img');
	await page.getByRole('button', { name: 'Colour 1' }).click();
	const one = await poseOne.getAttribute('src');
	await page.getByRole('button', { name: 'Colour 2' }).click();
	expect(await poseOne.getAttribute('src')).not.toBe(one);
	await expectNoHorizontalOverflow(page);
	await context.close();
});
