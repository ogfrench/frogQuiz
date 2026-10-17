// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Type answer, brought back for V1 (#93). Matching is tolerant: "  lisbon. " scores for
// "Lisbon", where exact matching marked it wrong. The projector says how many got it and
// what else people typed; a wrong phone is shown the accepted answer.

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

const TEXT = {
	type: 'TEXT',
	question: 'Capital of Portugal?',
	time: '20',
	answers: [{ answer: 'Lisbon', case_sensitive: false }]
};

test('typed answers are matched tolerantly, counted on the projector, and the answer shown to a wrong phone', async ({
	browser,
	request
}) => {
	test.setTimeout(5 * 60_000);
	const saved = await saveQuiz(request, {
		title: 'Type answer',
		description: 'e2e',
		questions: [TEXT as never]
	});
	const hostCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const host = await hostCtx.newPage();
	await rememberAnonQuiz(host, saved.body.id, saved.secret!);
	// With questions on the phones: only then is a wrong phone shown the answer (D16).
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
	await expect(host.getByText('2 players are waiting')).toBeVisible();
	await host.getByRole('button', { name: 'Start game', exact: true }).click();
	await host
		.getByRole('button', { name: /Next question/ })
		.first()
		.click({ timeout: 15_000 });
	// The accepted answer is not on the projector while the question is open.
	await expect(host.getByText('Players type the answer on their phones')).toBeVisible();
	await expect(host.getByText('Lisbon')).toHaveCount(0);

	const field = (p: typeof ana.p) => p.getByRole('textbox', { name: 'Type your answer' });
	await field(ana.p).fill('  lisbon. ');
	await expectNoHorizontalOverflow(ana.p);
	await field(ana.p).press('Enter');
	await expect(ana.p.getByText('Answer locked in')).toBeVisible();
	await field(ben.p).fill('Porto');
	await ben.p.getByRole('button', { name: 'Submit' }).click();
	await showResults(host);

	const card = host.getByTestId('round-card');
	await expect(card.getByText('1 of 2 got it')).toBeVisible();
	await expect(card.getByText('Lisbon')).toBeVisible();
	await expect(card.getByText('Also typed')).toBeVisible();
	await expect(card.getByText('Porto')).toBeVisible();
	await expect(ana.p.getByText('Correct!')).toBeVisible();
	await expect(ben.p.getByText('Not this time')).toBeVisible();
	await expect(ben.p.getByText('Lisbon')).toBeVisible();

	await hostCtx.close();
	await ana.ctx.close();
	await ben.ctx.close();
});

test('a Type answer question is made in the editor with more than one accepted answer', async ({
	browser,
	request
}) => {
	const { page } = await signedInContext(browser, request);
	await startNewQuiz(page, 'Capitals');
	await page.getByRole('button', { name: 'Type answer', exact: true }).click();
	await expect(page.getByRole('button', { name: /^Question type:/ })).toHaveAccessibleName(
		'Question type: Type answer'
	);
	await questionBox(page).fill('Capital of Portugal?');
	await page.getByRole('textbox', { name: 'Accepted answer 1' }).fill('Lisbon');
	await page.getByRole('button', { name: 'Add another accepted answer' }).click();
	await page.getByRole('textbox', { name: 'Accepted answer 2' }).fill('Lisboa');
	await page.getByRole('switch', { name: 'Exact case' }).first().click();
	await expect(page.getByRole('switch', { name: 'Exact case' }).first()).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15_000 });
	// Reopened, the case switch is still on: the old editor reset it on every open.
	await page.reload();
	await page.waitForLoadState('networkidle');
	await page.getByText('Capital of Portugal?').first().click();
	await expect(page.getByRole('switch', { name: 'Exact case' }).first()).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await expectNoHorizontalOverflow(page);
});
