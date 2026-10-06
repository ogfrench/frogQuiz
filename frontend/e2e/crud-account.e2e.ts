// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// The account change My Account offers, driven through the page rather than the API. It
// had backend tests and no browser test. See docs/crud-audit-2026-10.md. Changing the
// password was the other one, until passwords went on 5 Oct.

import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { apiLogin, registerUser } from './accounts';
import { mc, saveQuiz, uploadPng } from './helpers';

const STORAGE = path.resolve(process.cwd(), '../e2e/.data/storage');

test('deleting the account from My Account takes its quizzes and files with it', async ({
	browser,
	request
}) => {
	const user = await registerUser(request, 'del');
	const context = await browser.newContext();
	await apiLogin(context.request, user.email);
	const page = await context.newPage();
	const saved = await saveQuiz(context.request, {
		title: `Delete me ${Date.now()}`,
		description: 'crud audit',
		questions: [
			mc('Which?', [
				['A', true],
				['B', false]
			])
		]
	});
	expect(saved.status).toBe(200);
	const image = await uploadPng(context.request);
	const file = path.join(STORAGE, image.replaceAll('-', ''));
	expect(fs.existsSync(file)).toBe(true);

	await page.goto('/account/settings');
	await page.getByRole('button', { name: 'Delete account' }).first().click();
	const dialog = page.getByRole('alertdialog');
	const confirm = dialog.getByRole('button', { name: /Delete/ }).last();
	await dialog.locator('#delete-email').fill('someone-else@frog.co');
	await expect(confirm).toBeDisabled();
	await dialog.locator('#delete-email').fill(user.email.toUpperCase());
	await dialog
		.getByRole('button', { name: /Delete/ })
		.last()
		.click();
	await expect(page.getByText(/account and everything in it has been deleted/i)).toBeVisible();

	expect((await request.get(`/api/v1/quiz/get/public/${saved.body.id}`)).status(), 'quiz').toBe(
		404
	);
	expect(fs.existsSync(file), 'uploaded file').toBe(false);
	expect((await context.request.get('/api/v1/users/me')).status(), 'session').toBe(401);
	await context.close();
});
