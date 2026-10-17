// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Slider, brought back for V1 (#93). The phone has a native range input and Submit; an
// untouched slider sends nothing when time runs out, because its starting middle can be
// the right answer. The projector shows the scale while open, then where answers landed
// against the right range; a wrong phone is shown the range.

import { expect, test } from '@playwright/test';
import { signedInContext } from './accounts';
import {
	enterPin,
	expectNoHorizontalOverflow,
	gotoPlayHydrated,
	hostFromViewPage,
	questionBox,
	rememberAnonQuiz,
	saveQuiz,
	showResults,
	startNewQuiz
} from './helpers';

const SLIDER = {
	type: 'RANGE',
	question: 'How many legs does a frog have?',
	time: '20',
	answers: { min: 0, max: 10, min_correct: 4, max_correct: 4 }
};

test('two phones slide, one right and one wrong; an untouched slider sends nothing', async ({
	browser,
	request
}) => {
	test.setTimeout(5 * 60_000);
	const saved = await saveQuiz(request, {
		title: 'Slider',
		description: 'e2e',
		questions: [SLIDER as never]
	});
	const hostCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const host = await hostCtx.newPage();
	await rememberAnonQuiz(host, saved.body.id, saved.secret!);
	const pin = await hostFromViewPage(host, saved.body.id, { showOnDevices: true });
	const phone = async (name: string) => {
		const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
		const p = await ctx.newPage();
		await gotoPlayHydrated(p);
		await enterPin(p, pin);
		await p.getByRole('textbox', { name: 'Nickname' }).fill(name);
		await p.getByRole('button', { name: 'Join game' }).click();
		return { ctx, p };
	};
	const ana = await phone('Ana');
	const ben = await phone('Ben');
	const cat = await phone('Cat');
	await expect(host.getByText('3 players are waiting')).toBeVisible();
	await host.getByRole('button', { name: 'Start game', exact: true }).click();
	await host
		.getByRole('button', { name: /Next question/ })
		.first()
		.click({ timeout: 15_000 });
	await expect(host.getByText('Players pick a number from 0 to 10')).toBeVisible();

	const slider = (p: typeof ana.p) => p.getByRole('slider', { name: 'Pick a number' });
	// The handle starts in the middle, on a whole number.
	await expect(slider(ana.p)).toHaveValue('5');
	await slider(ana.p).fill('4');
	await expect(ana.p.locator('output')).toHaveText('4');
	await ana.p.getByRole('button', { name: 'Submit' }).click();
	await expect(ana.p.getByText('Answer locked in')).toBeVisible();
	await slider(ben.p).fill('7');
	await ben.p.getByRole('button', { name: 'Submit' }).click();
	await expectNoHorizontalOverflow(ben.p);
	// Cat never touches the slider: nothing is sent for them.
	await showResults(host);

	const card = host.getByTestId('round-card');
	await expect(card.getByText('1 of 2 got it')).toBeVisible();
	await expect(ana.p.getByText('Correct!')).toBeVisible();
	await expect(ben.p.getByText('Not this time')).toBeVisible();
	await expect(ben.p.getByText('4', { exact: true })).toBeVisible();
	await expect(cat.p.getByText('No answer')).toBeVisible();

	await hostCtx.close();
	for (const p of [ana, ben, cat]) await p.ctx.close();
});

test('a Slider question is made in the editor, and says what is wrong in words', async ({
	browser,
	request
}) => {
	const { page } = await signedInContext(browser, request);
	await startNewQuiz(page, 'Numbers');
	await page.getByRole('button', { name: 'Slider', exact: true }).click();
	await questionBox(page).fill('How many legs does a frog have?');
	await page.getByRole('spinbutton', { name: 'Lowest' }).fill('5');
	await page.getByRole('spinbutton', { name: 'Highest' }).fill('3');
	await expect(page.getByText('Lowest has to be below highest.')).toBeVisible();
	await page.getByRole('spinbutton', { name: 'Lowest' }).fill('0');
	await page.getByRole('spinbutton', { name: 'Highest' }).fill('10');
	await page.getByRole('spinbutton', { name: 'From' }).fill('4');
	await page.getByRole('spinbutton', { name: 'To' }).fill('4');
	await expect(page.getByText('Whole numbers. For one exact answer')).toBeVisible();
	await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15_000 });
	await expectNoHorizontalOverflow(page);
});
