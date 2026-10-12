// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// After a question the host's screen is one card. It opens on the answers, exactly as it
// always did, and five seconds later the same card shrinks them to a compact block and
// grows the standings under it. It used to swap to a different card (and a different
// component, loaded on the spot), so the room watched one screen vanish for another.
// "Same card" is asserted two ways: a handle kept on the element stays attached, and a
// mark set on it from outside survives, which a remount would not.

import { expect, test, type Locator, type Page } from '@playwright/test';
import { hostFromViewPage, mc, rememberAnonQuiz, saveQuiz } from './helpers';
import { closeAll, joinAll } from './sockets';
import type { Socket } from 'socket.io-client';

const QUIZ = {
	title: 'One card',
	description: 'e2e',
	questions: [
		mc(
			'Capital of Portugal?',
			[
				['Lisbon', true],
				['Porto', false]
			],
			'60'
		),
		mc(
			'Capital of Spain?',
			[
				['Madrid', true],
				['Seville', false]
			],
			'60'
		),
		mc(
			'Capital of Italy?',
			[
				['Rome', true],
				['Milan', false]
			],
			'60'
		)
	]
};
const RIGHT = ['Lisbon', 'Madrid', 'Rome'];
const WRONG = ['Porto', 'Seville', 'Milan'];

test.afterEach(() => closeAll());

const card = (page: Page) => page.getByTestId('round-card');
const standings = (page: Page) => page.getByTestId('standings');
const standingsHeading = (page: Page) =>
	page.getByRole('heading', { name: 'Scoreboard', exact: true });

async function startGame(page: Page, request: Parameters<typeof saveQuiz>[0], names: string[]) {
	const saved = await saveQuiz(request, QUIZ);
	await rememberAnonQuiz(page, saved.body.id, saved.secret!);
	const pin = await hostFromViewPage(page, saved.body.id);
	const players = await joinAll(pin, names);
	await expect(page.getByRole('button', { name: new RegExp(names[names.length - 1]) })).toBeVisible();
	await page
		.getByRole('button', { name: /Start game/ })
		.first()
		.click();
	await page.getByRole('button', { name: /Next question/ }).first().click();
	await expect(page.getByRole('progressbar', { name: 'Time remaining' })).toBeVisible({
		timeout: 15_000
	});
	return players;
}

/** Every player answers question `q`; the first `rightCount` of them get it right. */
function answerRound(players: Socket[], q: number, rightCount: number) {
	players.forEach((p, i) =>
		p.emit('submit_answer', {
			question_index: q,
			answer: i < rightCount ? RIGHT[q] : WRONG[q]
		})
	);
}

const height = (el: Locator) => el.evaluate((e) => e.getBoundingClientRect().height);

test('the answers and the standings are one card, which grows the standings after five seconds', async ({
	page,
	request
}) => {
	test.setTimeout(3 * 60_000);
	await page.setViewportSize({ width: 1440, height: 900 });
	const players = await startGame(page, request, ['ana', 'ben']);

	// Round one: ana is right, ben is not.
	answerRound(players, 0, 1);
	await expect(card(page)).toBeVisible({ timeout: 20_000 });
	const shownAt = Date.now();
	const handle = (await card(page).elementHandle())!;
	await card(page).evaluate((e) => e.setAttribute('data-mark', 'same-card'));
	await expect(page.getByRole('heading', { name: 'Capital of Portugal?' })).toBeVisible();
	await expect(page.getByText(/chose this/).first()).toBeAttached();

	// The answers have the card to themselves for a while.
	await expect(card(page)).toHaveAttribute('data-standings', 'false');
	await expect(standingsHeading(page)).toHaveCount(0);
	await expect(standings(page)).toHaveCount(0);
	const answersHeight = await height(page.getByTestId('round-answers'));

	// Then the same card takes the standings, within about five seconds and not at once.
	await expect(standingsHeading(page)).toBeVisible({ timeout: 8000 });
	const waited = Date.now() - shownAt;
	expect(waited, 'standings came up before the room could read the answers').toBeGreaterThan(3500);
	expect(waited, 'standings took too long').toBeLessThan(7500);
	await expect(card(page)).toHaveAttribute('data-standings', 'true');
	expect(await handle.evaluate((e) => e.isConnected), 'the card was replaced').toBe(true);
	await expect(card(page)).toHaveAttribute('data-mark', 'same-card');

	// The standings: both players, the winner first, with this round's points.
	const rows = standings(page).getByRole('listitem');
	await expect(rows).toHaveCount(2);
	await expect(rows.first()).toContainText('ana', { timeout: 5000 });
	await expect(rows.first()).toContainText(/\+\d{3}/);
	await expect(rows.last()).toContainText('ben');
	await expect(rows.last()).toContainText('+0');
	// The answers are still there, in the same card, smaller than they were.
	await expect(page.getByRole('heading', { name: 'Capital of Portugal?' })).toBeVisible();
	await expect(page.getByText('2 answers submitted')).toBeVisible();
	await expect
		.poll(() => height(page.getByTestId('round-answers')), { timeout: 3000 })
		.toBeLessThan(answersHeight * 0.85);
	expect(await handle.evaluate((e) => e.isConnected), 'the card was replaced').toBe(true);

	// The host's next press is the next question, which clears the standings.
	await page.getByRole('button', { name: /Next question/ }).click();
	await expect(page.getByRole('progressbar', { name: 'Time remaining' })).toBeVisible();
	await expect(card(page)).toHaveCount(0);
});

test("the host's press during the answers opens the standings at once", async ({
	page,
	request
}) => {
	test.setTimeout(3 * 60_000);
	await page.setViewportSize({ width: 1440, height: 900 });
	const players = await startGame(page, request, ['ana', 'ben']);

	answerRound(players, 0, 1);
	await expect(card(page)).toBeVisible({ timeout: 20_000 });
	await expect(card(page)).toHaveAttribute('data-standings', 'false');
	const handle = (await card(page).elementHandle())!;
	const pressed = Date.now();
	await page.getByRole('button', { name: 'Scoreboard' }).click();
	await expect(standingsHeading(page)).toBeVisible({ timeout: 2000 });
	expect(Date.now() - pressed).toBeLessThan(2500);
	await expect(card(page)).toHaveAttribute('data-standings', 'true');
	expect(await handle.evaluate((e) => e.isConnected), 'the card was replaced').toBe(true);

	// A second press goes on, and the next question's answers start from the answers again.
	await page.getByRole('button', { name: /Next question/ }).click();
	answerRound(players, 1, 2);
	await expect(card(page)).toBeVisible({ timeout: 20_000 });
	await expect(page.getByRole('heading', { name: 'Capital of Spain?' })).toBeVisible();
	await expect(card(page)).toHaveAttribute('data-standings', 'false');
	await expect(standingsHeading(page)).toHaveCount(0);
});

test('the last question shows its answers and never the standings', async ({ page, request }) => {
	test.setTimeout(4 * 60_000);
	await page.setViewportSize({ width: 1440, height: 900 });
	const players = await startGame(page, request, ['ana', 'ben']);
	for (const q of [0, 1]) {
		answerRound(players, q, 1);
		await expect(card(page)).toBeVisible({ timeout: 20_000 });
		await page.getByRole('button', { name: 'Scoreboard' }).click();
		await expect(standingsHeading(page)).toBeVisible();
		await page.getByRole('button', { name: /Next question/ }).click();
		await expect(page.getByRole('progressbar', { name: 'Time remaining' })).toBeVisible();
	}

	answerRound(players, 2, 1);
	await expect(card(page)).toBeVisible({ timeout: 20_000 });
	await expect(page.getByRole('heading', { name: 'Capital of Italy?' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Get final results' })).toBeVisible();
	// Longer than the delay: it is not merely late.
	await page.waitForTimeout(6500);
	await expect(card(page)).toHaveAttribute('data-standings', 'false');
	await expect(standingsHeading(page)).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Scoreboard' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Get final results' }).click();
	await expect(page.getByRole('link', { name: 'Finish' })).toBeVisible();
});

// A projector is 1920x1080 or a laptop's 1440x900, and the card is the whole screen: with
// ten players it still shows the top five and counts the rest, without scrolling.
for (const [width, height_] of [
	[1920, 1080],
	[1440, 900]
]) {
	test(`ten players fit ${width}x${height_} without scrolling, answers and standings together`, async ({
		page,
		request
	}) => {
		test.setTimeout(3 * 60_000);
		await page.setViewportSize({ width, height: height_ });
		const names = Array.from({ length: 10 }, (_, i) => `player${String(i + 1).padStart(2, '0')}`);
		const players = await startGame(page, request, names);
		answerRound(players, 0, 6);
		await expect(card(page)).toBeVisible({ timeout: 25_000 });
		const noScroll = () =>
			page.evaluate(() => ({
				// The host page already scrolls 1 px at every size (a visually hidden skip link at
				// its foot); what must not scroll is the card.
				h: Math.max(0, document.documentElement.scrollHeight - document.documentElement.clientHeight - 1),
				w: document.documentElement.scrollWidth - document.documentElement.clientWidth
			}));
		expect(await noScroll(), 'the answers scroll').toEqual({ h: 0, w: 0 });

		await page.getByRole('button', { name: 'Scoreboard' }).click();
		await expect(standingsHeading(page)).toBeVisible();
		await expect(standings(page).getByRole('listitem')).toHaveCount(5);
		await expect(page.getByText(/and 5 more players/)).toBeVisible();
		// Past the entrance and the re-rank, which are the longest things on it.
		await expect(standings(page).getByRole('listitem').first()).toContainText(/\+\d{3}/);
		await page.waitForTimeout(1500);
		expect(await noScroll(), 'the standings scroll').toEqual({ h: 0, w: 0 });
		const box = (await card(page).boundingBox())!;
		expect(box.y, 'card starts under the controls').toBeGreaterThan(60);
		expect(box.y + box.height, 'card runs off the screen').toBeLessThanOrEqual(height_);
	});
}

test.describe('with reduced motion', () => {
	test.use({ reducedMotion: 'reduce' });

	test('the standings simply appear, finished, with nothing sliding in', async ({
		page,
		request
	}) => {
		test.setTimeout(3 * 60_000);
		await page.setViewportSize({ width: 1440, height: 900 });
		const players = await startGame(page, request, ['ana', 'ben', 'cy']);
		answerRound(players, 0, 1);
		await expect(card(page)).toBeVisible({ timeout: 20_000 });
		await page.getByRole('button', { name: 'Scoreboard' }).click();
		await expect(standingsHeading(page)).toBeVisible();
		// The final order and the points are there at once: no previous order to re-rank from.
		const first = standings(page).getByRole('listitem').first();
		await expect(first).toContainText('ana', { timeout: 500 });
		await expect(first).toContainText(/\+\d{3}/, { timeout: 500 });
		// And no row is mid-flight.
		const moving = await standings(page)
			.getByRole('listitem')
			.evaluateAll((els) =>
				els.filter((e) => getComputedStyle(e).transform !== 'none').map((e) => e.textContent)
			);
		expect(moving).toEqual([]);
	});
});
