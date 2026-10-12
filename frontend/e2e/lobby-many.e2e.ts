// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// The lobby with more names than the screen holds. It used to grow the page, and a
// projector never scrolls: past about 30 players the newest names, the ones people look
// for, were below the bottom edge. Now the names stop where the screen does, the newest
// come first once they overflow, and a pill says how many more there are (12 Oct).

import { expect, test, type Page } from '@playwright/test';
import { signedInContext } from './accounts';
import { expectNoHorizontalOverflow, hostFromViewPage, mc, saveQuiz } from './helpers';
import { closeAll, join } from './sockets';

const QUIZ = {
	title: 'Lobby',
	description: 'e2e',
	questions: [
		mc('Capital of Portugal?', [
			['Lisbon', true],
			['Porto', false]
		])
	]
};

test.afterEach(closeAll);

const kick = (page: Page, name: string) =>
	page.getByRole('button', { name: `Kick: ${name}`, exact: true });
const pageScrolls = (page: Page) =>
	page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 1);

test('a lobby with more names than fit stops at the edge, newest first, and says how many more', async ({
	browser,
	request
}) => {
	test.setTimeout(180_000);
	const { context, page } = await signedInContext(browser, request);
	await page.setViewportSize({ width: 1440, height: 900 });
	const id = (await saveQuiz(context.request, QUIZ)).body.id as string;
	const pin = await hostFromViewPage(page, id);
	for (let i = 1; i <= 120; i++) expect((await join(pin, `Player ${i}`)).outcome).toBe('joined');
	await expect(page.getByText('120 players are waiting')).toBeVisible();

	const shownAt: Record<string, number> = {};
	for (const size of [
		{ width: 1440, height: 900 },
		{ width: 1280, height: 720 },
		{ width: 834, height: 1112 },
		{ width: 390, height: 844 }
	]) {
		const at = `at ${size.width}x${size.height}`;
		await page.setViewportSize(size);
		const more = page.getByText(/^\+\d+ more$/);
		await expect(more, at).toBeVisible();
		// Every name that shows sits wholly inside the board and above the pill, which is
		// only true once the board has refit to this size.
		await expect.poll(() => chipsFit(page), { message: at }).toBe(true);
		// What shows and what the pill counts add up to everyone. Polled: the kick buttons
		// have transition-all, and visibility is animatable, so a chip hidden a moment ago
		// still counts as shown for 150ms.
		const shown = () => page.getByRole('button', { name: /^Kick: / }).count();
		const hiddenCount = async () => Number((await more.innerText()).match(/\d+/)![0]);
		await expect
			.poll(async () => (await hiddenCount()) + (await shown()), { message: at })
			.toBe(120);
		shownAt[size.width] = await shown();
		expect(await pageScrolls(page), `the page scrolls ${at}`).toBe(false);
		await expectNoHorizontalOverflow(page);
		// The newest is on screen; the oldest went into "+N more".
		await expect(kick(page, 'Player 120')).toBeVisible();
		await expect(kick(page, 'Player 1')).toBeHidden();
	}
	// A taller screen shows more names: the board follows the space, not a fixed number.
	expect(shownAt[834]).toBeGreaterThan(shownAt[1280]);

	// Screens too short for the board: the PIN is never cut off at the top, and the newest
	// name still shows. A landscape phone may scroll, below, to reach the rest.
	for (const size of [
		{ width: 1280, height: 600 },
		{ width: 844, height: 390 }
	]) {
		await page.setViewportSize(size);
		await expect
			.poll(() => chipsFit(page), { message: `${size.width}x${size.height}` })
			.toBe(true);
		const pinTop = (await page.getByText(pin, { exact: true }).first().boundingBox())!.y;
		expect(pinTop, `the PIN at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(0);
		await expect(kick(page, 'Player 120')).toBeVisible();
	}

	// Kicking a player while the board is full keeps the newest first and the sum right.
	await page.setViewportSize({ width: 1440, height: 900 });
	await kick(page, 'Player 120').click();
	await expect(page.getByText('119 players are waiting')).toBeVisible();
	await expect(kick(page, 'Player 119')).toBeVisible();
	await expect.poll(() => chipsFit(page)).toBe(true);
	await expect
		.poll(
			async () =>
				Number((await page.getByText(/^\+\d+ more$/).innerText()).match(/\d+/)![0]) +
				(await page.getByRole('button', { name: /^Kick: / }).count())
		)
		.toBe(119);
	await context.close();
});

/** Every visible name chip is inside the board's box and above the "+N more" pill. */
const chipsFit = (page: Page) =>
	page.evaluate(() => {
		const board = document.querySelector('ul.overflow-hidden');
		if (!board) return false;
		const box = board.getBoundingClientRect();
		const pill = [...document.querySelectorAll('p')].find((p) =>
			/^\+\d+ more$/.test(p.innerText)
		);
		const floor = pill ? Math.min(box.bottom, pill.getBoundingClientRect().top) : box.bottom;
		return [...board.children].every((li) => {
			if (getComputedStyle(li).visibility === 'hidden') return true;
			const r = li.getBoundingClientRect();
			return r.top >= box.top - 1 && r.bottom <= floor + 1;
		});
	});

test('a lobby that fits shows every name, with no "more"', async ({ browser, request }) => {
	const { context, page } = await signedInContext(browser, request);
	await page.setViewportSize({ width: 1440, height: 900 });
	const id = (await saveQuiz(context.request, QUIZ)).body.id as string;
	const pin = await hostFromViewPage(page, id);
	for (let i = 1; i <= 8; i++) await join(pin, `Guest ${i}`);
	await expect(page.getByText('8 players are waiting')).toBeVisible();
	await expect(page.getByText(/^\+\d+ more$/)).toHaveCount(0);
	// Every one of them on screen. The order is not checked: a host that resyncs gets the
	// players back from a Redis set, which has none.
	for (let i = 1; i <= 8; i++) await expect(kick(page, `Guest ${i}`)).toBeVisible();
	await context.close();
});
