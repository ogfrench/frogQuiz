// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Info slide, brought back for V1 as a plain slide (#93): a title, some text and an image,
// with nothing to answer. The projector shows it until the host presses Next; phones show
// "Look at the screen" instead of keeping the last result card up, and so does a phone
// that joins during the slide.

import { expect, test } from '@playwright/test';
import { signedInContext } from './accounts';
import {
	enterPin,
	expectNoHorizontalOverflow,
	gotoPlayHydrated,
	hostFromViewPage,
	mc,
	questionBox,
	rememberAnonQuiz,
	saveQuiz,
	showResults,
	startNewQuiz
} from './helpers';

const SLIDE = {
	type: 'SLIDE',
	question: 'Round 2: frogs of Europe',
	time: '20',
	answers: '',
	body: 'Eight questions, 20 seconds each.'
};

test('a slide shows on the projector, and every phone is told to look up', async ({
	browser,
	request
}) => {
	test.setTimeout(5 * 60_000);
	const saved = await saveQuiz(request, {
		title: 'Slides',
		description: 'e2e',
		questions: [
			mc(
				'Capital of Portugal?',
				[
					['Lisbon', true],
					['Porto', false]
				],
				'5'
			),
			SLIDE as never,
			mc('Largest frog?', [
				['Goliath frog', true],
				['Tree frog', false]
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
	await expect(host.getByText('1 player is waiting')).toBeVisible();
	await host.getByRole('button', { name: 'Start game', exact: true }).click();
	await host
		.getByRole('button', { name: /Next question/ })
		.first()
		.click({ timeout: 15_000 });
	await ana.p
		.getByRole('button', { name: /Lisbon|^1/ })
		.first()
		.click();
	await showResults(host);
	await expect(ana.p.getByText('Correct!')).toBeVisible();

	// To the slide: the scoreboard step first, then Next.
	const next = host.getByRole('button', { name: /Next question/ });
	await host
		.getByRole('button', { name: 'Scoreboard' })
		.click({ timeout: 15_000 })
		.catch(() => undefined);
	await next.click();
	await expect(host.getByRole('heading', { name: 'Round 2: frogs of Europe' })).toBeVisible();
	await expect(host.getByText('Eight questions, 20 seconds each.')).toBeVisible();
	// No countdown on a plain slide.
	await expect(host.getByRole('progressbar', { name: 'Time remaining' })).toHaveCount(0);
	await expect(ana.p.getByText('Look at the screen')).toBeVisible();
	await expect(ana.p.getByText('Correct!')).toHaveCount(0);
	await expectNoHorizontalOverflow(ana.p);

	// Somebody arriving during the slide is told the same.
	const late = await phone('Ben');
	await expect(late.p.getByText('Look at the screen')).toBeVisible();

	// Next: the next question reaches both phones.
	await next.click();
	await expect(ana.p.getByRole('button', { name: /Goliath frog|^1/ }).first()).toBeVisible();
	await expect(late.p.getByRole('button', { name: /Goliath frog|^1/ }).first()).toBeVisible();

	await hostCtx.close();
	await ana.ctx.close();
	await late.ctx.close();
});

test('a slide is made in the editor with a title and text, and no timer', async ({
	browser,
	request
}) => {
	const { page } = await signedInContext(browser, request);
	await startNewQuiz(page, 'Slides');
	await page.getByRole('button', { name: 'Info slide', exact: true }).click();
	await expect(page.getByRole('button', { name: /^Question type:/ })).toHaveAccessibleName(
		'Question type: Info slide'
	);
	await questionBox(page).fill('Round 2');
	await page.getByRole('textbox', { name: 'Slide text' }).fill('Eight questions.');
	await expect(page.getByRole('spinbutton')).toHaveCount(0);
	await expect(page.getByText('Skip the results')).toHaveCount(0);
	await expect(page.getByRole('textbox', { name: /^Answer \d$/ })).toHaveCount(0);
	// Saved as finished: a titled slide is all a slide needs.
	await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15_000 });
	await expectNoHorizontalOverflow(page);
});
