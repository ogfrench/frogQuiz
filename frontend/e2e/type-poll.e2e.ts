// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Poll, the first of the five question types brought back for V1 (#93): made in the
// editor, hosted, and voted on from two phones. Nobody is right or wrong, so a phone says
// "Vote counted", the projector shows the votes in its round card, and no standings follow.

import { expect, test, type Page } from '@playwright/test';
import { signedInContext } from './accounts';
import {
	enterPin,
	expectNoHorizontalOverflow,
	gotoPlayHydrated,
	hostFromViewPage,
	mc,
	rememberAnonQuiz,
	saveQuiz,
	showResults,
	startNewQuiz
} from './helpers';

const POLL = {
	type: 'VOTING',
	question: 'Where should the offsite be?',
	time: '5',
	answers: [{ answer: 'Lisbon' }, { answer: 'Porto' }]
};

test('a poll is voted on from two phones, counted on the projector, and scores nobody', async ({
	browser,
	request
}) => {
	test.setTimeout(5 * 60_000);
	const saved = await saveQuiz(request, {
		title: 'Poll',
		description: 'e2e',
		questions: [
			POLL as never,
			mc('Capital of Portugal?', [
				['Lisbon', true],
				['Porto', false]
			])
		]
	});
	const hostCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const host = await hostCtx.newPage();
	await rememberAnonQuiz(host, saved.body.id, saved.secret!);
	const pin = await hostFromViewPage(host, saved.body.id);
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

	await ana.p
		.getByRole('button', { name: /Lisbon|^1/ })
		.first()
		.click();
	await ben.p
		.getByRole('button', { name: /Porto|^2/ })
		.last()
		.click();
	await showResults(host);

	for (const { p } of [ana, ben]) {
		await expect(p.getByText('Vote counted')).toBeVisible();
		await expect(p.getByText('Not this time')).toHaveCount(0);
		await expect(p.getByText('+0')).toHaveCount(0);
		await expectNoHorizontalOverflow(p);
	}
	// In the round card, with its title, not drawn bare on the background.
	const card = host.getByTestId('round-card');
	await expect(card).toBeVisible();
	await expect(card.getByText('Lisbon')).toBeVisible();
	await expect(card.getByText('Porto')).toBeVisible();
	// No standings after a poll: the next step is the next question.
	await expect(host.getByRole('button', { name: /Next question/ })).toBeVisible();
	await expect(host.getByRole('button', { name: 'Scoreboard' })).toHaveCount(0);

	await hostCtx.close();
	await ana.ctx.close();
	await ben.ctx.close();
});

const typeMenu = (page: Page) => page.getByRole('button', { name: /^Question type:/ });

test('a poll is made in the editor, and a choice question turns into one and back', async ({
	browser,
	request
}) => {
	const { page } = await signedInContext(browser, request);
	await startNewQuiz(page, 'Offsite');
	await page.getByRole('button', { name: 'Poll', exact: true }).click();
	await expect(typeMenu(page)).toHaveAccessibleName('Question type: Poll');
	// Two blank options, and nothing to mark right.
	await expect(page.getByRole('textbox', { name: /^Answer \d$/ })).toHaveCount(2);
	await expect(page.getByRole('button', { name: /^Mark as correct/ })).toHaveCount(0);
	await page.getByRole('textbox', { name: 'Answer 1' }).fill('Lisbon');
	await page.getByRole('textbox', { name: 'Answer 2' }).fill('Porto');

	// To Multiple choice keeps the options, so it asks nothing; back again the same.
	await typeMenu(page).click();
	await page.getByRole('menuitemradio', { name: 'Multiple choice' }).click();
	await expect(page.getByRole('alertdialog')).toHaveCount(0);
	await expect(page.getByRole('textbox', { name: 'Answer 1' })).toHaveValue('Lisbon');
	await expect(page.getByRole('button', { name: /^Mark as correct/ })).toHaveCount(2);
	await typeMenu(page).click();
	await page.getByRole('menuitemradio', { name: 'Poll' }).click();
	await expect(page.getByRole('textbox', { name: 'Answer 2' })).toHaveValue('Porto');
	await expectNoHorizontalOverflow(page);
});
