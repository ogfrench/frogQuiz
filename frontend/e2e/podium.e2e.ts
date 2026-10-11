// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// The podium is the payoff for having played, so it builds: third, then second, then
// first, with the crown and the confetti on the winner. It used to put all three up in
// about two seconds, in the theme's near-black primary.

import { expect, test } from '@playwright/test';
import {
	advancePastResults,
	advanceToFinalResults,
	gotoPlayHydrated,
	hostFromViewPage,
	mc,
	rememberAnonQuiz,
	saveQuiz,
	showResults
} from './helpers';

test('the podium reveals third, then second, then first', async ({ browser, request }) => {
	test.setTimeout(5 * 60_000);
	const saved = await saveQuiz(request, {
		title: 'Podium',
		description: 'one',
		questions: [
			mc(
				'Pick A?',
				[
					['A', true],
					['B', false]
				],
				'5'
			)
		]
	});
	const hostCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const host = await hostCtx.newPage();
	await rememberAnonQuiz(host, saved.body.id, saved.secret!);
	const pin = await hostFromViewPage(host, saved.body.id);

	const players: { ctx: any; p: any; ans: string }[] = [];
	for (const [name, ans] of [
		['Ada', 'A'],
		['Bo', 'A'],
		['Cy', 'B']
	] as [string, string][]) {
		const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
		const p = await ctx.newPage();
		await gotoPlayHydrated(p);
		await p.getByRole('textbox', { name: 'Game PIN' }).fill(pin);
		await p.getByRole('textbox', { name: 'Nickname' }).fill(name);
		await p.getByRole('button', { name: 'Join game' }).click();
		players.push({ ctx, p, ans });
	}
	await host.waitForTimeout(1000);
	await host
		.getByRole('button', { name: /Start game/ })
		.first()
		.click();
	await host.waitForTimeout(800);
	await host
		.getByRole('button', { name: /Next question/ })
		.first()
		.click();
	await host.waitForTimeout(1200);
	for (const pl of players) {
		await pl.p
			.getByRole('button', { name: new RegExp(`^${pl.ans}$`) })
			.first()
			.click()
			.catch(() => undefined);
		await pl.p.waitForTimeout(250);
	}
	await host.waitForTimeout(6500);
	await showResults(host);
	await host.waitForTimeout(1200);
	await advanceToFinalResults(host);
	// Every frame of the build-up, where the winner's block is drawn: the transition's
	// effect is only visible while it runs, so it is sampled in the page, not polled.
	await host.evaluate(() => {
		const w = window as unknown as { __podium: { h: number; bottom: number }[] };
		w.__podium = [];
		const end = performance.now() + 6000;
		const tick = () => {
			const el = document.querySelector('.podium-block.is-gold');
			if (el) {
				const r = el.getBoundingClientRect();
				w.__podium.push({ h: r.height, bottom: r.bottom });
			}
			if (performance.now() < end) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	});

	// Svelte keeps a delayed `in:` transition's element in the DOM at opacity 0, so the
	// reveal is measured rather than asserted on presence.
	const opacity = (place: string) =>
		host
			.locator('.podium-block')
			.filter({ hasText: place })
			.evaluate((el) => Number(getComputedStyle(el).opacity));

	// Third is standing while first is still on its way up.
	await expect.poll(() => opacity('3rd place'), { timeout: 4000 }).toBeGreaterThan(0.9);
	expect(await opacity('1st place'), 'the winner arrived with third').toBeLessThan(0.5);
	await expect.poll(() => opacity('2nd place'), { timeout: 4000 }).toBeGreaterThan(0.9);
	await expect.poll(() => opacity('1st place'), { timeout: 6000 }).toBeGreaterThan(0.9);
	// The crown lands once the winner's block has, not before.
	await expect(host.locator('.crown')).toBeVisible();

	// The block grows up out of the floor, rather than flying in from the bottom of the
	// screen (Gonçalo, 7 Oct): part-way through, it is shorter than it ends, and its
	// foot never leaves the line it stands on.
	await host.waitForTimeout(1500);
	const frames = await host.evaluate(
		() => (window as unknown as { __podium: { h: number; bottom: number }[] }).__podium
	);
	const last = frames.at(-1)!;
	const rising = frames.filter((f) => f.h > 2 && f.h < last.h * 0.9);
	expect(rising.length, 'the winner never showed part-grown').toBeGreaterThan(3);
	for (const f of rising) {
		expect(Math.abs(f.bottom - last.bottom), `the block rose from below the floor: ${JSON.stringify([...new Set(frames.map((x) => Math.round(x.bottom)))])}`).toBeLessThan(2);
	}

	// Gold, silver and bronze rather than the near-black primary.
	const medals = await host
		.locator('.podium-block')
		.evaluateAll((els) => els.map((e) => e.className.match(/is-(gold|silver|bronze)/)?.[1]));
	expect(medals.sort()).toEqual(['bronze', 'gold', 'silver']);

	await hostCtx.close();
	for (const pl of players) await pl.ctx.close();
});

// A host can run a game from a phone -- anonymous hosting makes that the likely case for
// a quick round -- so the projector surfaces have to survive 390px as well as 1920.
test('the game surfaces fit a phone, from the lobby to the podium', async ({
	browser,
	request
}) => {
	test.setTimeout(5 * 60_000);
	const saved = await saveQuiz(request, {
		title: 'Phone host',
		description: 'two',
		// Two, so there is a scoreboard to check: the last question has none (8 Oct).
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
			)
		]
	});
	const hostCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const host = await hostCtx.newPage();
	await rememberAnonQuiz(host, saved.body.id, saved.secret!);
	const overflow = () =>
		host.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);

	const pin = await hostFromViewPage(host, saved.body.id);
	expect(await overflow(), 'lobby').toBeLessThanOrEqual(0);

	const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const phone = await ctx.newPage();
	await gotoPlayHydrated(phone);
	await phone.getByRole('textbox', { name: 'Game PIN' }).fill(pin);
	await phone.getByRole('textbox', { name: 'Nickname' }).fill('Robin');
	await phone.getByRole('button', { name: 'Join game' }).click();
	await host.waitForTimeout(900);

	await host
		.getByRole('button', { name: /Start game/ })
		.first()
		.click();
	await host.waitForTimeout(800);
	await host
		.getByRole('button', { name: /Next question/ })
		.first()
		.click();
	await host.waitForTimeout(1200);
	expect(await overflow(), 'question').toBeLessThanOrEqual(0);
	await phone.getByRole('button', { name: /Four/ }).first().click();

	await host.waitForTimeout(6500);
	await showResults(host);
	await host.waitForTimeout(1400);
	expect(await overflow(), 'per-question results').toBeLessThanOrEqual(0);
	expect(
		await phone.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		),
		'the player feedback card'
	).toBeLessThanOrEqual(0);

	// The standings are a game surface too, and a new one -- this test is named for
	// covering all of them, so it checks that screen at 390 rather than passing through it.
	// It comes up by itself, three seconds after the answers.
	await expect(host.getByRole('heading', { name: 'Scoreboard', exact: true })).toBeVisible({
		timeout: 6000
	});
	await host.waitForTimeout(700);
	expect(await overflow(), 'scoreboard').toBeLessThanOrEqual(0);

	await advancePastResults(host);
	await phone.getByRole('button', { name: /Water/ }).first().click();
	await showResults(host);
	await advanceToFinalResults(host);
	await host.waitForTimeout(5000);
	expect(await overflow(), 'podium').toBeLessThanOrEqual(0);
	await expect(host.locator('.podium-block.is-gold')).toBeVisible();

	await hostCtx.close();
	await ctx.close();
});
