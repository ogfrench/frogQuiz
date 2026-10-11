// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// #35: the same quiz open in two places, or changed under an open editor. A save that
// fails never costs what was typed, and the editor says why it failed. Before this, a 409
// showed "Could not save: 409: this quiz was changed..." with Reload as the only way on,
// and a reload threw the typing away.

import { expect, test, type APIRequestContext } from '@playwright/test';
import { signedInContext } from './accounts';
import { mc, saveQuiz, titleBox } from './helpers';

const QUIZ = {
	title: 'Two tabs',
	description: 'e2e',
	questions: [
		mc('Capital of Portugal?', [
			['Lisbon', true],
			['Porto', false]
		])
	]
};

/** Saves a new title from "another device": its own edit session, the current version. */
async function saveElsewhere(request: APIRequestContext, id: string, title: string) {
	const { token } = await (
		await request.post(`/api/v1/editor/start?edit=true&quiz_id=${id}`)
	).json();
	const res = await request.post(`/api/v1/editor/save?edit_id=${token}`, {
		data: { public: false, ...QUIZ, title }
	});
	expect(res.status(), await res.text()).toBe(200);
}

const titleOnServer = async (request: APIRequestContext, id: string) =>
	(await (await request.get(`/api/v1/quiz/get/${id}`)).json()).title;

test('a 409 offers Keep mine, which saves this tab over the other', async ({
	browser,
	request
}) => {
	const { context, page } = await signedInContext(browser, request);
	const id = (await saveQuiz(context.request, QUIZ)).body.id as string;
	await page.goto(`/edit?quiz_id=${id}`);
	await expect(titleBox(page)).toBeVisible();
	await saveElsewhere(context.request, id, 'Saved on the phone');

	await titleBox(page).fill('Typed on the laptop');
	const choice = page.getByRole('alertdialog', { name: /changed in another tab/i });
	await expect(choice).toBeVisible({ timeout: 15_000 });
	await choice.getByRole('button', { name: 'Keep mine' }).click();
	await expect(choice).toBeHidden();
	await expect
		.poll(() => titleOnServer(context.request, id), { timeout: 15_000 })
		.toBe('Typed on the laptop');
	await expect(page.getByRole('alert')).toHaveCount(0);
	await context.close();
});

test('loading the other version keeps this tab’s text to restore', async ({ browser, request }) => {
	const { context, page } = await signedInContext(browser, request);
	const id = (await saveQuiz(context.request, QUIZ)).body.id as string;
	await page.goto(`/edit?quiz_id=${id}`);
	await expect(titleBox(page)).toBeVisible();
	await saveElsewhere(context.request, id, 'Saved on the phone');

	await titleBox(page).fill('Typed on the laptop');
	const choice = page.getByRole('alertdialog', { name: /changed in another tab/i });
	await expect(choice).toBeVisible({ timeout: 15_000 });
	await choice.getByRole('button', { name: 'Load the other version' }).click();

	// The reload shows the other version, and offers this tab's back.
	await expect(titleBox(page)).toHaveText('Saved on the phone', { timeout: 15_000 });
	const offer = page.getByRole('region', { name: 'Unsaved changes' });
	await expect(offer).toBeVisible();
	await offer.getByRole('button', { name: 'Restore' }).click();
	await expect(titleBox(page)).toHaveText('Typed on the laptop');
	await expect(offer).toBeHidden();
	await expect
		.poll(() => titleOnServer(context.request, id), { timeout: 15_000 })
		.toBe('Typed on the laptop');
	await context.close();
});

test('a quiz deleted elsewhere says so, keeps the text, and can be saved as a new one', async ({
	browser,
	request
}) => {
	const { context, page } = await signedInContext(browser, request);
	const id = (await saveQuiz(context.request, QUIZ)).body.id as string;
	await page.goto(`/edit?quiz_id=${id}`);
	await expect(titleBox(page)).toBeVisible();
	expect((await context.request.delete(`/api/v1/quiz/delete/${id}`)).status()).toBe(200);

	await titleBox(page).fill('Still mine');
	await expect(page.getByRole('alert')).toContainText('deleted', { timeout: 15_000 });
	await expect(titleBox(page)).toHaveText('Still mine');

	await page.getByRole('button', { name: 'Save as a new quiz' }).click();
	await expect(page).toHaveURL(/quiz_id=/, { timeout: 15_000 });
	await expect.poll(() => new URL(page.url()).searchParams.get('quiz_id')).not.toBe(id);
	const fresh = new URL(page.url()).searchParams.get('quiz_id')!;
	await expect
		.poll(() => titleOnServer(context.request, fresh), { timeout: 15_000 })
		.toBe('Still mine');
	await expect(page.getByRole('alert')).toHaveCount(0);
	await context.close();
});

test('signed out elsewhere: the editor says so and keeps the text', async ({
	browser,
	request
}) => {
	const { context, page } = await signedInContext(browser, request);
	const id = (await saveQuiz(context.request, QUIZ)).body.id as string;
	await page.goto(`/edit?quiz_id=${id}`);
	await expect(titleBox(page)).toBeVisible();
	await context.request.post('/api/v1/users/logout', { maxRedirects: 0 });

	await titleBox(page).fill('Typed after sign-out');
	await expect(page.getByRole('alert')).toContainText('signed out', { timeout: 15_000 });
	await expect(titleBox(page)).toHaveText('Typed after sign-out');
	await context.close();
});
