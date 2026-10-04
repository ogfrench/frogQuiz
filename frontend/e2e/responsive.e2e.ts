// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// CLAUDE.md's standing checks, run on every page reachable without a game in progress:
// no horizontal scroll at 390 / 834 / 1440, the dark class actually toggles, and the
// page sits on a token background in both themes.

import { expect, test } from '@playwright/test';
import { signedInContext } from './accounts';
import { mc, rememberAnonQuiz, saveQuiz } from './helpers';

const WIDTHS = [390, 834, 1440];
const PUBLIC = [
	'/',
	'/play',
	'/explore',
	'/account/login',
	'/account/register',
	'/create',
	'/my-quizzes'
];
const SIGNED_IN = ['/my-quizzes', '/account/settings'];

const overflow = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;

for (const width of WIDTHS) {
	test(`public pages fit at ${width}px`, async ({ browser, request }) => {
		const ctx = await browser.newContext({ viewport: { width, height: 900 } });
		const page = await ctx.newPage();
		const saved = await saveQuiz(request, {
			title: 'A fairly long quiz title that has to wrap somewhere on a phone',
			description: 'e2e',
			questions: [
				mc('Supercalifragilisticexpialidociousfrogquestion?', [
					['Yes', true],
					['No', false]
				])
			]
		});
		await rememberAnonQuiz(page, saved.body.id, saved.secret!);
		const bad: string[] = [];
		for (const route of [...PUBLIC, `/view/${saved.body.id}`]) {
			await page.goto(route);
			await page.waitForTimeout(800);
			const o = await page.evaluate(overflow);
			if (o > 0) bad.push(`${route} overflows by ${o}px`);
		}
		expect(bad).toEqual([]);
		await ctx.close();
	});

	test(`signed-in pages fit at ${width}px`, async ({ browser, request }) => {
		const { context, page } = await signedInContext(browser, request);
		await page.setViewportSize({ width, height: 900 });
		const bad: string[] = [];
		for (const route of SIGNED_IN) {
			await page.goto(route);
			await page.waitForTimeout(800);
			const o = await page.evaluate(overflow);
			if (o > 0) bad.push(`${route} overflows by ${o}px`);
		}
		expect(bad).toEqual([]);
		await context.close();
	});
}

test('the theme toggle switches the class and the background', async ({ page }) => {
	await page.goto('/');
	// The ground is on <html>, not <body>: app.css keeps body transparent so it does not
	// paint over the fixed ambient layer.
	const bg = () =>
		page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
	const dark = () => page.evaluate(() => document.documentElement.classList.contains('dark'));
	const before = { dark: await dark(), bg: await bg() };
	// The button is server-rendered, so a click before hydration does nothing. Retry until
	// the handler is attached rather than guessing a delay.
	await expect(async () => {
		if ((await dark()) === before.dark) {
			await page
				.getByRole('button', { name: /Switch to (dark|light) mode/ })
				.first()
				.click();
		}
		expect(await dark()).toBe(!before.dark);
	}).toPass({ timeout: 15_000 });
	expect(await bg()).not.toBe(before.bg);
	expect(await bg()).not.toBe('rgba(0, 0, 0, 0)');
	// It survives a reload.
	test.info().annotations.push({
		type: 'stored theme',
		description: String(await page.evaluate(() => localStorage.getItem('theme')))
	});
	await page.reload();
	expect(await dark()).toBe(!before.dark);
});

test('the footer sits on the page ground, one line wide, with a text heart', async ({
	browser
}) => {
	for (const width of [390, 1440]) {
		const ctx = await browser.newContext({ viewport: { width, height: 900 } });
		const page = await ctx.newPage();
		await page.goto('/');
		const footer = page.getByRole('contentinfo');
		await expect(footer).toContainText('Designed with ♥');
		await expect(footer.getByRole('link', { name: 'Terms of Service' })).toBeVisible();
		// It was a bg-muted band, the one grey block on pages otherwise on the ground.
		expect(await footer.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
			'rgba(0, 0, 0, 0)'
		);
		// The red ❤️ emoji was the only color in it; frogConvert uses the ♥ glyph, which takes
		// the text color.
		expect(await footer.textContent()).not.toContain('❤');
		if (width >= 640) {
			// Credit and links share one row on anything wider than a phone.
			const credit = await footer.getByText(/Designed with/).boundingBox();
			const links = await footer.getByRole('navigation', { name: 'Legal' }).boundingBox();
			expect(
				Math.abs(credit!.y + credit!.height / 2 - (links!.y + links!.height / 2))
			).toBeLessThan(4);
		}
		expect(await page.evaluate(overflow)).toBeLessThanOrEqual(0);
		await ctx.close();
	}
});

test('the navbar is exactly as tall as the space reserved for it', async ({ browser }) => {
	for (const width of [390, 1440]) {
		const ctx = await browser.newContext({ viewport: { width, height: 900 } });
		const page = await ctx.newPage();
		await page.goto('/');
		// It was 69px over a 64px spacer, so every page's first 5px sat under the bar; and
		// login and register size themselves to 100dvh - 4rem.
		const nav = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
		const main = await page.locator('main').boundingBox();
		expect(nav!.y).toBe(0);
		expect(nav!.height).toBe(64);
		expect(main!.y).toBe(64);
		await ctx.close();
	}
});
