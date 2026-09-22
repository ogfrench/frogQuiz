// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { expect, type APIRequestContext, type Browser } from '@playwright/test';

export const PASSWORD = 'Frog-e2e-password-1';

let n = 0;
/** A fresh account per call; the database is recreated every run, but tests share it. */
export async function registerUser(request: APIRequestContext, prefix = 'frog') {
	const username = `${prefix}${Date.now().toString(36)}${n++}`;
	const email = `${username}@example.com`;
	const res = await request.post('/api/v1/users/create', {
		data: { email, username, password: PASSWORD }
	});
	expect(res.status(), await res.text()).toBe(200);
	return { email, username };
}

/** Logs in through the same two calls the login page makes. Cookies land on `request`. */
export async function apiLogin(request: APIRequestContext, email: string) {
	const start = await request.post('/api/v1/login/start', { data: { email } });
	expect(start.status()).toBe(200);
	const { session_id } = await start.json();
	const step = await request.post(`/api/v1/login/step/1?session_id=${session_id}`, {
		data: { auth_type: 'PASSWORD', data: PASSWORD }
	});
	expect(step.status(), await step.text()).toBe(200);
}

/** A browser context that is signed in as a brand-new user. */
export async function signedInContext(browser: Browser, request: APIRequestContext) {
	const user = await registerUser(request);
	const context = await browser.newContext();
	await apiLogin(context.request, user.email);
	return { context, page: await context.newPage(), user };
}
