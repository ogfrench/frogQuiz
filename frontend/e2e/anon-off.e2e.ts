// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// The product as production runs it (#55): `anonymous_quizzes_enabled` off, so making,
// uploading and hosting need an account. The rest of the suite runs with it on, so this
// spec skips there. The e2e workflow's second pass runs it, and so does
// `ANONYMOUS_QUIZZES_ENABLED=False bash e2e/run.sh e2e/anon-off.e2e.ts`.

import { expect, test } from '@playwright/test';
import { signedInContext } from './accounts';

test.beforeEach(async ({ request }) => {
	const config = await (await request.get('/api/v1/utils/config')).json();
	test.skip(config.anonymous_quizzes_enabled, 'needs ANONYMOUS_QUIZZES_ENABLED=False');
});

// Copy that was true only with the setting on.
const NO_ACCOUNT = /without an account|no account needed|in this browser|30 days/i;

test('signed out, Create a quiz goes to sign-in and keeps where it was going', async ({ page }) => {
	await page.goto('/create?title=Rivers');
	await expect(page).toHaveURL(/\/account\/login\?returnTo=%2Fcreate%3Ftitle%3DRivers$/);
});

test('signed out, the editor refuses to start', async ({ request }) => {
	expect((await request.post('/api/v1/editor/start?edit=false')).status()).toBe(401);
});

test('signed out, nothing promises a quiz without an account', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText(/needs a team account/)).toBeVisible();
	await expect(page.locator('body')).not.toContainText(NO_ACCOUNT);

	await page.goto('/my-quizzes');
	await expect(page.getByRole('main').getByRole('link', { name: 'Sign in' })).toHaveAttribute(
		'href',
		'/account/login?returnTo=%2Fmy-quizzes'
	);
	await expect(page.locator('body')).not.toContainText(NO_ACCOUNT);
});

test('signed in, Create a quiz opens the editor', async ({ browser, request }) => {
	const { context, page } = await signedInContext(browser, request);
	await page.goto('/create');
	await expect(page).toHaveURL(/\/create$/);
	await expect(page.getByRole('textbox', { name: 'Quiz title' })).toBeVisible();
	await context.close();
});
