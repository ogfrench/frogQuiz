// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// A player who got it wrong is told what was right, on the phone, when the phones show the
// answers' text (François, 17 Oct). With the answers on the projector alone, the phone only
// ever showed shapes, so it says nothing new there.

import { expect, test, type Page } from '@playwright/test';
import {
	expectNoHorizontalOverflow,
	hostFromViewPage,
	joinAsPlayer,
	mc,
	rememberAnonQuiz,
	saveQuiz
} from './helpers';

const LONG = (s: string) => `${s} `.repeat(20).slice(0, 100).trim();
const QUIZ = {
	title: 'Correct answers',
	description: 'e2e',
	questions: [
		mc('Capital of Portugal?', [
			['Lisbon', true],
			['Porto', false]
		]),
		mc('A long right answer', [
			[LONG('Photosynthesis'), true],
			['Wrong', false]
		]),
		{
			question: 'Four long right answers',
			time: '30',
			type: 'CHECK',
			answers: [
				{ answer: LONG('Amphibians'), right: true },
				{ answer: LONG('Breathe through skin'), right: true },
				{ answer: LONG('Lay eggs in water'), right: true },
				{ answer: LONG('Cold blooded'), right: true },
				{ answer: 'Feathers', right: false }
			]
		}
	]
};
const SHOTS = process.env.SHOTS;
const card = (p: Page) => p.getByRole('status').filter({ hasText: 'Total score' });

async function shoot(p: Page, name: string) {
	if (!SHOTS) return;
	for (const size of [
		{ width: 390, height: 844 },
		{ width: 360, height: 740 },
		{ width: 320, height: 568 }
	]) {
		await p.setViewportSize(size);
		await expectNoHorizontalOverflow(p);
		await p.screenshot({ path: `${SHOTS}/${name}-${size.width}.png`, fullPage: true });
	}
	await p.setViewportSize({ width: 390, height: 844 });
}

test('a wrong answer shows the right one, short or long, one or several', async ({
	page,
	browser,
	request
}) => {
	test.setTimeout(3 * 60_000);
	const saved = await saveQuiz(request, QUIZ);
	await rememberAnonQuiz(page, saved.body.id, saved.secret!);
	const pin = await hostFromViewPage(page, saved.body.id, { showOnDevices: true });
	const ana = await joinAsPlayer(browser, pin, 'Ana');
	const ben = await joinAsPlayer(browser, pin, 'Ben');
	await expect(page.getByRole('button', { name: /Ben/ })).toBeVisible();
	await page.getByRole('button', { name: 'Start game' }).click();

	const round = async (wrong: string[], right: string[], check: boolean) => {
		await page.getByRole('button', { name: /Next question/ }).click();
		for (const [p, picks] of [
			[ana.page, wrong],
			[ben.page, right]
		] as const) {
			for (const a of picks) await p.getByRole('button', { name: a, exact: true }).click();
			if (check) await p.getByRole('button', { name: 'Submit' }).click();
		}
		await expect(card(ana.page)).toBeVisible({ timeout: 15_000 });
	};

	await round(['Porto'], ['Lisbon'], false);
	await expect(card(ana.page).getByText('Correct answer', { exact: true })).toBeVisible();
	await expect(card(ana.page).getByText('Lisbon')).toBeVisible();
	// Right needs no correction.
	await expect(card(ben.page).getByText('Correct answer', { exact: true })).toHaveCount(0);
	await shoot(ana.page, '1-short');

	await round(['Wrong'], [LONG('Photosynthesis')], false);
	await expect(card(ana.page).getByText(LONG('Photosynthesis'))).toBeVisible();
	await shoot(ana.page, '2-long');

	await round(
		['Feathers'],
		QUIZ.questions[2].answers.filter((a) => a.right).map((a) => a.answer),
		true
	);
	await expect(card(ana.page).getByText('Correct answers', { exact: true })).toBeVisible();
	await expect(card(ana.page).getByRole('listitem')).toHaveCount(4);
	await shoot(ana.page, '3-four-long');
	await ana.context.close();
	await ben.context.close();
});

test('with the answers on the projector only, the phone does not show them', async ({
	page,
	browser,
	request
}) => {
	const saved = await saveQuiz(request, { ...QUIZ, questions: [QUIZ.questions[0]] });
	await rememberAnonQuiz(page, saved.body.id, saved.secret!);
	const pin = await hostFromViewPage(page, saved.body.id);
	const ana = await joinAsPlayer(browser, pin, 'Ana');
	await expect(page.getByRole('button', { name: /Ana/ })).toBeVisible();
	await page.getByRole('button', { name: 'Start game' }).click();
	await page.getByRole('button', { name: /Next question/ }).click();
	await ana.page.getByRole('button', { name: 'Porto', exact: true }).click();
	await expect(card(ana.page)).toBeVisible({ timeout: 15_000 });
	await expect(card(ana.page).getByText('Correct answer', { exact: true })).toHaveCount(0);
	await ana.context.close();
});
