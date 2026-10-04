// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Issue #24: on a phone every control gets a press area of at least 44x44, and no press
// area lands on a neighbour. Run under touch emulation, since a coarse pointer is what
// turns the expansions on.

import { expect, test, type Page } from '@playwright/test';
import { apiLogin, registerUser } from './accounts';
import {
	PHONE,
	gotoPlayHydrated,
	hostFromViewPage,
	mc,
	rememberAnonQuiz,
	saveQuiz
} from './helpers';

const QUIZ = {
	title: 'Touch audit',
	description: 'e2e',
	questions: [
		mc('Capital of Portugal?', [
			['Lisbon', true],
			['Porto', false],
			['Faro', false],
			['Braga', false]
		])
	]
};

const CONTROLS =
	'a[href], button, [role=button], [role=switch], [role=checkbox], [role=tab], input:not([type=hidden]), select, textarea, summary';

/**
 * Every visible control's press area, counting the fq-touch-target expansion when it is
 * anchored to the control. Then five points of that area (centre, and just inside each
 * edge) must land on the control itself, not on another one painted over it. A text
 * field also has to render at 16px or more, or iOS zooms the page when it takes focus.
 */
async function audit(page: Page, root = 'body'): Promise<string[]> {
	return page.evaluate(
		([sel, root]) => {
			const out: string[] = [];
			const name = (el: Element) =>
				(
					el.getAttribute('aria-label') ||
					el.textContent ||
					el.getAttribute('placeholder') ||
					el.tagName
				)
					.trim()
					.replace(/\s+/g, ' ')
					.slice(0, 40);
			// Inline links in running text are exempt (WCAG 2.5.8), and so is the skip link,
			// which is sr-only until a keyboard focuses it.
			const exempt = (el: Element) =>
				!!el.closest('p, .prose, .sr-only, [inert], [aria-hidden=true]');
			const own = (el: Element, hit: Element | null) =>
				!hit || el.contains(hit) || hit.closest('label')?.control === el;
			for (const el of document.querySelector(root)!.querySelectorAll(sel)) {
				// A field inside its <label> is pressed through the label, so measure that.
				const label = el.closest('label');
				const box = label?.control === el ? label : el;
				const cs = getComputedStyle(el);
				if (cs.visibility === 'hidden' || cs.display === 'none' || exempt(el)) continue;
				if (!el.getBoundingClientRect().width) continue;
				el.scrollIntoView({ block: 'center', inline: 'nearest' });
				const r = box.getBoundingClientRect();
				if (r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight)
					continue;
				const after = getComputedStyle(box, '::after');
				let w = r.width;
				let h = r.height;
				if (
					after.content !== 'none' &&
					after.position === 'absolute' &&
					getComputedStyle(box).position !== 'static'
				) {
					w = Math.max(w, parseFloat(after.width) || 0);
					h = Math.max(h, parseFloat(after.height) || 0);
				}
				if (w < 43.5 || h < 43.5)
					out.push(`${name(el)}: ${Math.round(w)}x${Math.round(h)}`);
				if (el.matches('input, select, textarea') && parseFloat(cs.fontSize) < 16)
					out.push(`${name(el)}: ${cs.fontSize} text, iOS zooms on focus`);
				// Shown only on hover or focus works with a mouse; a finger cannot hover.
				if (cs.opacity === '0') out.push(`${name(el)}: invisible until hovered`);
				// A disabled control takes no taps (pointer-events: none), so whatever is
				// under it answers the probe.
				if ((el as HTMLButtonElement).disabled) continue;
				const x = r.left + r.width / 2;
				const y = r.top + r.height / 2;
				const points = [
					[x, y],
					[x - w / 2 + 2, y],
					[x + w / 2 - 2, y],
					[x, y - h / 2 + 2],
					[x, y + h / 2 - 2]
				];
				for (const [px, py] of points) {
					const hit = document.elementFromPoint(px, py);
					if (own(el, hit)) continue;
					const other = hit!.closest(sel);
					out.push(
						`${name(el)}: press area lands on ${other ? `"${name(other)}"` : hit!.tagName}`
					);
					break;
				}
			}
			return out;
		},
		[CONTROLS, root]
	);
}

test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

test('every control on the signed-in screens is touch-sized', async ({ page, request }) => {
	const { email } = await registerUser(request, 'touch');
	await apiLogin(page.context().request, email);
	const saved = await saveQuiz(page.context().request, QUIZ);
	expect(saved.status).toBe(200);
	const id = saved.body.id as string;

	const found: Record<string, string[]> = {};
	for (const path of [
		'/',
		'/explore',
		'/my-quizzes',
		`/view/${id}`,
		'/account/settings',
		'/play'
	]) {
		await page.goto(path);
		await page.waitForLoadState('networkidle');
		found[path] = await audit(page);
	}
	await page.goto(`/edit?quiz_id=${id}`);
	await page.locator('[data-question-card]').first().click();
	await expect(page.locator('textarea').first()).toBeVisible();
	found['editor'] = await audit(page);

	await page.goto('/');
	await page.getByRole('button', { name: 'Open menu' }).tap();
	await expect(page.getByRole('dialog')).toBeVisible();
	found['menu drawer'] = await audit(page, '[role=dialog]');

	expect(found).toEqual(Object.fromEntries(Object.keys(found).map((k) => [k, []])));
});

test('every control on the player game screens is touch-sized', async ({ browser, request }) => {
	const saved = await saveQuiz(request, QUIZ);
	const hostCtx = await browser.newContext();
	const host = await hostCtx.newPage();
	await rememberAnonQuiz(host, saved.body.id, saved.secret!);
	const pin = await hostFromViewPage(host, saved.body.id);

	const ctx = await browser.newContext({ viewport: PHONE, hasTouch: true, isMobile: true });
	const player = await ctx.newPage();
	await gotoPlayHydrated(player);
	await player.getByRole('textbox', { name: 'Game PIN' }).fill(pin);
	await player.getByRole('textbox', { name: 'Username' }).fill('thumb');
	const found: Record<string, string[]> = { join: await audit(player) };
	await player.getByRole('button', { name: 'Join game' }).tap();
	await expect(player.getByText(/You're in/)).toBeVisible();
	found['lobby'] = await audit(player);

	await host.getByRole('button', { name: 'Start game' }).click();
	await host.getByRole('button', { name: /Next question/ }).click();
	await expect(player.getByRole('button', { name: 'Lisbon' })).toBeVisible();
	found['question'] = await audit(player);
	await player.getByRole('button', { name: 'Lisbon' }).tap();
	await host.getByRole('button', { name: 'Show results' }).click();
	await host.waitForTimeout(1_000);
	found['results'] = await audit(player);

	expect(found).toEqual(Object.fromEntries(Object.keys(found).map((k) => [k, []])));
	await ctx.close();
	await hostCtx.close();
});
