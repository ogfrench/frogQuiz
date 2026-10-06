// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Accounts for the suite, made the only way there is since 5 Oct: an emailed link to a
// frog.co address, then a username. The link is read back from the mail sink, so every
// spec that signs in also proves the email arrives and works.

import {
	expect,
	request as newRequest,
	test,
	type APIRequestContext,
	type Browser,
	type Page
} from '@playwright/test';
import { signInMail } from './mail';

let n = 0;
/** A fresh account per call; the database is recreated every run, but tests share it. */
export async function registerUser(_request?: APIRequestContext, prefix = 'frog') {
	const username = `${prefix}${Date.now().toString(36)}${n++}`.slice(0, 20);
	const email = `${username}@frog.co`.toLowerCase();
	// Making the account signs in, so it happens on a context of its own: the caller's
	// `request` is often meant to stay signed out, or to sign in as somebody else.
	const scratch = await newRequest.newContext({ baseURL: test.info().project.use.baseURL });
	await apiLogin(scratch, email, username);
	// And out again, so the account has no session the test did not make (My Account lists them).
	await scratch.post('/api/v1/users/logout', { maxRedirects: 0 });
	await scratch.dispose();
	return { email, username };
}

/**
 * Signs in on `request` through the emailed link, as a person clicking it does: ask for
 * the email, take the link out of it, and pick a username if it is the first time.
 */
export async function apiLogin(request: APIRequestContext, email: string, username?: string) {
	const since = Date.now();
	const sent = await request.post('/api/v1/login/email', { data: { email } });
	expect(sent.status(), await sent.text()).toBe(200);
	const { token } = await signInMail(email, since);
	const res = await request.post('/api/v1/login/email/verify', { data: { token } });
	expect(res.status(), await res.text()).toBe(200);
	const { signup } = await res.json();
	if (signup) {
		const made = await request.post('/api/v1/login/email/signup', {
			data: { signup, username: username ?? email.split('@')[0].slice(0, 20) }
		});
		expect(made.status(), await made.text()).toBe(200);
	}
}

/**
 * On the sign-in page: asks for the email the way a person does, and returns the link and
 * code it brings. Waits for the page to hydrate first, or the typed address is lost.
 */
export async function askForSignIn(page: Page, email: string) {
	await page.waitForLoadState('networkidle');
	const since = Date.now();
	await page.getByRole('textbox', { name: 'Work email' }).fill(email);
	await page.getByRole('button', { name: 'Email me a link' }).click();
	await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
	return signInMail(email, since);
}

/** A browser context that is signed in as a brand-new user. */
export async function signedInContext(browser: Browser, request: APIRequestContext) {
	const user = await registerUser(request);
	const context = await browser.newContext();
	await apiLogin(context.request, user.email);
	return { context, page: await context.newPage(), user };
}
