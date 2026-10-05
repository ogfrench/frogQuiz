// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Signing in, the way a person does it since 5 Oct: a frog or Capgemini address, an email
// with a link and a six-digit code, and a username the first time. No passwords. François
// asked for it to work as frogViz's gate does, and to be tested fully.
//
// Every message is read back from e2e/mailsink.py, so this walks the parts that only exist
// inside the email: the template rendering, and the link being built from ROOT_ADDRESS.
// What it does not prove is that a real provider delivers the mail; that stays on the
// manual checklist in DEPLOY.md. This file replaced the password-recovery journey.

import { expect, test, type Page } from '@playwright/test';
import { askForSignIn, registerUser } from './accounts';
import { expectNoHorizontalOverflow, mc, PHONE, rememberAnonQuiz, saveQuiz } from './helpers';

let n = 0;
const address = (domain = 'frog.co') => `si${Date.now().toString(36)}${n++}@${domain}`;

async function openSignIn(page: Page, path = '/account/login') {
	await page.goto(path);
	await page.waitForLoadState('networkidle');
}

test('a first sign-in: an address, the link from the email, a username, and in', async ({
	browser
}) => {
	const context = await browser.newContext({ viewport: PHONE });
	const page = await context.newPage();
	const email = address();
	await openSignIn(page);
	await expectNoHorizontalOverflow(page);
	const { link, code, mail } = await askForSignIn(page, email);
	await expect(page.getByText(email)).toBeVisible();
	await expectNoHorizontalOverflow(page);

	// The link points at the app, from ROOT_ADDRESS, and both parts of the email carry it.
	expect(link).toMatch(/^http:\/\/localhost:3000\/account\/login\?token=/);
	expect(mail.html).toContain(link);
	expect(mail.headers).toContain(`Subject: Your frogQuiz sign-in code: ${code}`);

	await page.goto(link);
	await expect(page.getByRole('heading', { name: 'Pick a username' })).toBeVisible();
	// It signs in whoever holds it for 15 minutes, so it leaves the address bar.
	await expect(page).not.toHaveURL(/token=/);
	await expectNoHorizontalOverflow(page);
	const username = `First${n++}${Date.now().toString(36)}`.slice(0, 20);
	await page.getByRole('textbox', { name: 'Username' }).fill(username);
	await page.getByRole('button', { name: 'Create my account' }).click();
	await page.waitForURL(/\/my-quizzes/);
	const me = await (await page.request.get('/api/v1/users/me')).json();
	expect(me).toMatchObject({ email, username, verified: true });
	await context.close();
});

test('the code from a phone signs in on a laptop, pasted with a space in it', async ({
	page,
	request
}) => {
	const { email } = await registerUser(request);
	await openSignIn(page);
	const { code } = await askForSignIn(page, email);
	await page
		.getByRole('textbox', { name: 'Six-digit code' })
		.fill(`${code.slice(0, 3)} ${code.slice(3)}`);
	await expect(page.getByRole('textbox', { name: 'Six-digit code' })).toHaveValue(code);
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await page.waitForURL(/\/my-quizzes/);
	expect((await (await page.request.get('/api/v1/users/me')).json()).email).toBe(email);
});

test('a wrong code says so, five wrong codes end it, and the link still works', async ({
	page,
	request
}) => {
	const { email } = await registerUser(request);
	await openSignIn(page);
	const { code, link } = await askForSignIn(page, email);
	const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0');
	const box = page.getByRole('textbox', { name: 'Six-digit code' });
	const send = page.getByRole('button', { name: 'Sign in', exact: true });
	for (let i = 0; i < 5; i++) {
		await box.fill(wrong);
		await send.click();
		await expect(page.getByRole('alert')).toHaveText(
			"That code doesn't match. Check the email and try again."
		);
	}
	await box.fill(code);
	await send.click();
	await expect(page.getByRole('alert')).toHaveText(
		'Too many tries. Use the link in the email, or ask for a new code.'
	);
	expect((await page.request.get('/api/v1/users/me')).status()).toBe(401);

	await page.goto(link);
	await page.waitForURL(/\/my-quizzes/);
});

test('only frog and Capgemini addresses can ask for a link', async ({ page }) => {
	await openSignIn(page);
	for (const outsider of ['someone@gmail.com', 'someone@mail.capgemini.com']) {
		await page.getByRole('textbox', { name: 'Work email' }).fill(outsider);
		await page.getByRole('button', { name: 'Email me a link' }).click();
		await expect(page.getByRole('alert')).toHaveText(
			'Use your @frog.co or @capgemini.com address.'
		);
	}
	await askForSignIn(page, address('capgemini.com'));
});

test('a link opened on another device signs that device in, not this one', async ({ browser }) => {
	const asked = await browser.newContext();
	const askedPage = await asked.newPage();
	await openSignIn(askedPage);
	const email = address();
	const { link } = await askForSignIn(askedPage, email);

	const other = await browser.newContext();
	const otherPage = await other.newPage();
	await otherPage.goto(link);
	await otherPage.getByRole('textbox', { name: 'Username' }).fill(`Other${Date.now() % 1e9}`);
	await otherPage.getByRole('button', { name: 'Create my account' }).click();
	await otherPage.waitForURL(/\/my-quizzes/);
	expect((await askedPage.request.get('/api/v1/users/me')).status()).toBe(401);
	await asked.close();
	await other.close();
});

test('a link that has expired or never existed says so and offers the form again', async ({
	page
}) => {
	await openSignIn(page, '/account/login?token=not-a-real-token');
	await expect(page.getByRole('alert')).toHaveText(
		'That sign-in link has expired. Ask for a new one.'
	);
	await expect(page.getByRole('textbox', { name: 'Work email' })).toBeVisible();
});

test('a taken username is refused whatever its case, and another one works', async ({
	page,
	request
}) => {
	const taken = await registerUser(request);
	await openSignIn(page);
	const { link } = await askForSignIn(page, address());
	await page.goto(link);
	await page.getByRole('textbox', { name: 'Username' }).fill(taken.username.toUpperCase());
	await page.getByRole('button', { name: 'Create my account' }).click();
	await expect(page.getByRole('alert')).toHaveText('That username is taken.');
	await page.getByRole('textbox', { name: 'Username' }).fill(`Fresh${Date.now() % 1e9}`);
	await page.getByRole('button', { name: 'Create my account' }).click();
	await page.waitForURL(/\/my-quizzes/);
});

test('Discover sends a signed-out visitor to sign in, and the link brings them back', async ({
	page,
	request
}) => {
	expect((await request.post('/api/v1/search/', { data: { q: '' } })).status()).toBe(401);
	const { email } = await registerUser(request);
	await page.goto('/explore?q=frog');
	await expect(page).toHaveURL(/\/account\/login\?returnTo=%2Fexplore%3Fq%3Dfrog/);
	const { link } = await askForSignIn(page, email);
	await page.goto(link);
	await page.waitForURL(/\/explore\?q=frog/);
});

test('"keep this quiz" signs you up and brings you back to the quiz', async ({ page, request }) => {
	const saved = await saveQuiz(request, {
		title: `Keep me ${Date.now()}`,
		description: 'e2e',
		questions: [
			mc('Capital of Portugal?', [
				['Lisbon', true],
				['Porto', false]
			])
		]
	});
	await rememberAnonQuiz(page, saved.body.id, saved.secret!);
	await page.goto(`/view/${saved.body.id}`);
	await page.getByRole('button', { name: /isn't saved to an account/ }).click();
	await page.getByRole('link', { name: 'Create an account to keep this quiz' }).click();
	await expect(page).toHaveURL(/\/account\/login\?returnTo=/);
	const { link } = await askForSignIn(page, address());
	await page.goto(link);
	await page.getByRole('textbox', { name: 'Username' }).fill(`Keeper${Date.now() % 1e9}`);
	await page.getByRole('button', { name: 'Create my account' }).click();
	await page.waitForURL(new RegExp(`/view/${saved.body.id}`));
});

test('the old registration and password pages lead to sign-in, and their API is off', async ({
	page,
	request
}) => {
	await page.goto('/account/register?returnTo=/my-quizzes');
	await expect(page).toHaveURL(/\/account\/login\?returnTo=%2Fmy-quizzes$/);
	for (const path of [
		'/account/reset-password',
		'/account/password-reset?token=x',
		'/account/resend-verification'
	]) {
		await page.goto(path);
		await expect(page, path).toHaveURL(/\/account\/login$/);
	}
	const off = [
		await request.post('/api/v1/users/create', {
			data: { email: address(), username: `pw${Date.now() % 1e9}`, password: 'long-enough-1' }
		}),
		await request.post('/api/v1/login/start', { data: { email: address() } }),
		await request.post('/api/v1/users/forgot-password', { data: { email: address() } })
	];
	expect(off.map((r) => r.status())).toEqual([404, 404, 404]);
});

test('My Account has no password to change', async ({ page, request }) => {
	const { email } = await registerUser(request);
	await openSignIn(page, '/account/login?returnTo=/account/settings');
	const { link } = await askForSignIn(page, email);
	await page.goto(link);
	await page.waitForURL(/\/account\/settings/);
	await expect(page.getByText(email)).toBeVisible();
	await expect(page.getByText(/password/i)).toHaveCount(0);
});
