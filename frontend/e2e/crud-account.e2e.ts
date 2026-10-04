// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// The two account changes My Account offers, driven through the page rather than the API.
// Both had backend tests and no browser test. See docs/crud-audit-2026-10.md.

import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { PASSWORD, apiLogin, registerUser } from './accounts';
import { mc, saveQuiz, uploadPng } from './helpers';

const STORAGE = path.resolve(process.cwd(), '../e2e/.data/storage');

async function passwordLogin(request: APIRequestContext, email: string, password: string) {
	const start = await request.post('/api/v1/login/start', { data: { email } });
	const { session_id } = await start.json();
	return request.post(`/api/v1/login/step/1?session_id=${session_id}`, {
		data: { auth_type: 'PASSWORD', data: password }
	});
}

test('changing the password signs every other device out and only the new one works', async ({
	browser,
	request
}) => {
	const user = await registerUser(request, 'pw');
	const elsewhere = await browser.newContext();
	await apiLogin(elsewhere.request, user.email);
	const context = await browser.newContext();
	await apiLogin(context.request, user.email);
	const page = await context.newPage();

	const next = 'Frog-e2e-password-2';
	await page.goto('/account/settings');
	await page.getByLabel('Old password').fill(PASSWORD);
	await page.getByLabel('New password').fill(next);
	await page.getByLabel('Repeat password').fill(next);
	await page.getByRole('button', { name: 'Change password' }).click();
	await page.waitForURL(/password_changed=true/);

	expect((await elsewhere.request.get('/api/v1/users/me')).status(), 'other device').toBe(401);
	expect((await passwordLogin(request, user.email, PASSWORD)).status(), 'old password').not.toBe(
		200
	);
	expect((await passwordLogin(request, user.email, next)).status(), 'new password').toBe(200);
	await elsewhere.close();
	await context.close();
});

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
	await dialog.locator('#delete-password').fill(PASSWORD);
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
