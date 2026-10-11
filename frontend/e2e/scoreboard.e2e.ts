// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// A round is sequenced the way Kahoot sequences one: the answers, then who is winning,
// then the next question. The standings used to share the answers screen.

import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import {
	mc,
	saveQuiz,
	rememberAnonQuiz,
	hostFromViewPage,
	gotoPlayHydrated,
	joinAsPlayer,
	showResults
} from './helpers';
const FROG_QUIZ = {
	title: 'Frog Anatomy',
	description: 'three',
	questions: [
		mc(
			'How many legs does a frog have?',
			[
				['Four', true],
				['Two', false],
				['Six', false],
				['None', false]
			],
			'5'
		),
		mc(
			'Where do tadpoles live?',
			[
				['Water', true],
				['Trees', false]
			],
			'5'
		),
		mc(
			'What do frogs eat?',
			[
				['Insects', true],
				['Rocks', false]
			],
			'5'
		)
	]
};

// The answers screen, not the question screen before it, which is headed with the same
// question: only the answers carry a count for each one.
const answersShown = async (host: Page, question: string) => {
	await expect(host.getByText(/chose this/).first()).toBeVisible({ timeout: 10_000 });
	await expect(host.getByRole('heading', { name: question })).toBeVisible();
};
const scoreboard = (host: Page) => host.getByRole('heading', { name: 'Scoreboard', exact: true });

async function answerAll(players: { p: Page; a: string[] }[], round: number) {
	for (const m of players) {
		await m.p
			.getByRole('button', { name: new RegExp(`^${m.a[round]}$`) })
			.first()
			.click()
			.catch(() => undefined);
	}
}

// Gonçalo, 7 Oct: one press per question, as in Kahoot. The question ends (here, because
// everyone answered), its answers come up by themselves, then the scoreboard by itself,
// and the host's only press is Next question. The last question is a different round: its
// answers are shown, but no scoreboard, which would give the podium away.
test('one press per question: answers, then the scoreboard, by themselves; none after the last', async ({
	browser,
	request
}) => {
	test.setTimeout(6 * 60_000);
	const saved = await saveQuiz(request, FROG_QUIZ);
	const hostCtx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
	const host = await hostCtx.newPage();
	await rememberAnonQuiz(host, saved.body.id, saved.secret!);
	const pin = await hostFromViewPage(host, saved.body.id);
	const made: { c: BrowserContext; p: Page; a: string[] }[] = [];
	for (const [n, ...a] of [
		['Ada', 'Four', 'Water', 'Insects'],
		['Bo', 'Four', 'Trees', 'Insects'],
		['Cy', 'Two', 'Water', 'Rocks'],
		['Dee', 'Two', 'Trees', 'Rocks'],
		['Eve', 'Four', 'Water', 'Insects'],
		['Fay', 'Six', 'Trees', 'Rocks']
	]) {
		const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
		const p = await c.newPage();
		await gotoPlayHydrated(p);
		await p.getByRole('textbox', { name: 'Game PIN' }).fill(pin);
		await p.getByRole('textbox', { name: 'Nickname' }).fill(n);
		await p.getByRole('button', { name: 'Join game' }).click();
		made.push({ c, p, a });
	}
	await expect(host.getByRole('button', { name: /Fay/ })).toBeVisible();
	await host
		.getByRole('button', { name: /Start game/ })
		.first()
		.click();
	await host.getByRole('button', { name: /Next question/ }).click();

	// Round one: nothing pressed after the players answer.
	await answerAll(made, 0);
	await answersShown(host, 'How many legs does a frog have?');
	await expect(scoreboard(host)).toHaveCount(0);
	// Skip-ahead stays, for a host who does not want to wait.
	await expect(host.getByRole('button', { name: 'Scoreboard' })).toBeVisible();
	await expect(scoreboard(host)).toBeVisible({ timeout: 6000 });
	await expect(host.getByText('Ada')).toBeVisible();

	// Round two, so the movement arrows have something to say.
	await host.getByRole('button', { name: /Next question/ }).click();
	await answerAll(made, 1);
	await answersShown(host, 'Where do tadpoles live?');
	await expect(scoreboard(host)).toBeVisible({ timeout: 6000 });
	// Five rows, the rest counted, and the movement called out: Eve overtook Bo.
	await expect(host.getByRole('listitem')).toHaveCount(5);
	await expect(host.getByText(/and 1 more player/)).toBeVisible();
	// Screen-reader text, not an aria-label: a label on a plain span is never read. Who
	// moved, not how many: since Kahoot's curve (5 Oct) scores sit between 500 and 1000, so
	// Cy's one late answer can pass Bo too, depending on how fast the phones tapped.
	const row = (name: string) => host.getByRole('listitem').filter({ hasText: name });
	await expect(row('Eve').getByText(/^up \d/)).toHaveCount(1);
	await expect(row('Bo').getByText(/^down \d/)).toHaveCount(1);

	// The last question: its answers, then no scoreboard -- not by itself, not as a button.
	await host.getByRole('button', { name: /Next question/ }).click();
	await answerAll(made, 2);
	await answersShown(host, 'What do frogs eat?');
	const finalResults = host.getByRole('button', { name: 'Get final results' });
	await expect(finalResults).toBeVisible();
	await host.waitForTimeout(4500);
	await expect(scoreboard(host)).toHaveCount(0);
	await expect(host.getByRole('button', { name: 'Scoreboard' })).toHaveCount(0);
	await expect(host.getByRole('heading', { name: 'What do frogs eat?' })).toBeVisible();
	await finalResults.click();
	await expect(host.getByRole('link', { name: 'Finish' })).toBeVisible();
	await hostCtx.close();
	for (const m of made) await m.c.close();
});

// The same game from the keyboard alone. Enter and Space had their own copy of the rules:
// they skipped the scoreboard without closing it, so after one Scoreboard every later
// question's answers were drawn as the scoreboard, and the last question offered only
// "Get final results".
test('Enter runs the same rounds as the buttons, and the scoreboard closes behind it', async ({
	browser,
	request
}) => {
	test.setTimeout(4 * 60_000);
	const saved = await saveQuiz(request, FROG_QUIZ);
	const hostCtx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
	const host = await hostCtx.newPage();
	await rememberAnonQuiz(host, saved.body.id, saved.secret!);
	const pin = await hostFromViewPage(host, saved.body.id);
	const ana = await joinAsPlayer(browser, pin, 'Ana');
	await expect(host.getByRole('button', { name: /Ana/ })).toBeVisible();
	await host
		.getByRole('button', { name: /Start game/ })
		.first()
		.click();
	const enter = async () => {
		// Off any control, so the key is the page's shortcut and not a button press.
		await host.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
		await host.keyboard.press('Enter');
	};

	// The title screen, once the server has said the game started; Enter waits for that.
	await expect(host.getByRole('button', { name: /Next question/ })).toBeVisible();
	await enter(); // question 1
	await expect(host.getByRole('button', { name: 'Stop time and show solutions' })).toBeVisible();
	await enter(); // stop the clock: the answers follow by themselves
	await answersShown(host, 'How many legs does a frog have?');
	await enter(); // skip ahead to the scoreboard
	await expect(scoreboard(host)).toBeVisible();
	await enter(); // question 2

	await ana.page
		.getByRole('button', { name: /^Water$/ })
		.first()
		.click();
	// The regression: these answers were drawn as the scoreboard.
	await answersShown(host, 'Where do tadpoles live?');
	await expect(scoreboard(host)).toHaveCount(0);
	await expect(scoreboard(host)).toBeVisible({ timeout: 6000 });
	await enter(); // question 3, the last

	await ana.page
		.getByRole('button', { name: /^Insects$/ })
		.first()
		.click();
	await answersShown(host, 'What do frogs eat?');
	await enter(); // straight to the podium, no scoreboard between
	await expect(host.getByRole('link', { name: 'Finish' })).toBeVisible();
	await hostCtx.close();
	await ana.context.close();
});

// The results screen listed the question types it drew and left CHECK out, so after a
// multiple-answer question the projector showed an empty card: no question, no correct
// answers, no split. The counting for CHECK already existed; nothing rendered it.
test('a multiple-answer question gets a results screen', async ({ page, browser, request }) => {
	const saved = await saveQuiz(request, {
		title: 'Check results',
		description: 'one',
		questions: [
			{
				question: 'Which are amphibians?',
				time: '20',
				type: 'CHECK',
				answers: [
					{ answer: 'Frog', right: true },
					{ answer: 'Newt', right: true },
					{ answer: 'Lizard', right: false }
				]
			}
		]
	});
	await rememberAnonQuiz(page, saved.body.id, saved.secret!);
	const pin = await hostFromViewPage(page, saved.body.id);
	const ana = await joinAsPlayer(browser, pin, 'Ana');
	const ben = await joinAsPlayer(browser, pin, 'Ben');
	await expect(page.getByRole('button', { name: /Ben/ })).toBeVisible();
	await page.getByRole('button', { name: 'Start game' }).click();
	await page.getByRole('button', { name: /Next question/ }).click();
	for (const [p, picks] of [
		[ana.page, ['Frog', 'Newt']],
		[ben.page, ['Frog', 'Lizard']]
	] as const) {
		for (const a of picks) await p.getByRole('button', { name: a, exact: true }).click();
		await p.getByRole('button', { name: 'Submit' }).click();
	}
	await showResults(page);

	await expect(page.getByRole('heading', { name: 'Which are amphibians?' })).toBeVisible();
	await expect(page.getByText('2 players chose this')).toHaveCount(1); // Frog
	await expect(page.getByText('1 player chose this')).toHaveCount(2); // Newt, Lizard
	await expect(page.getByText('2 answers submitted')).toBeVisible();
	await ana.context.close();
	await ben.context.close();
});
