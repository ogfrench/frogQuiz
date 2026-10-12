// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// The Start game dialog is a sentence, one big Start button, and the three per-game
// switches folded away under "Game options". Nearly every host presses Start and never
// opens the fold, so the button has to be in reach with nothing else in the way, and the
// fold has to open onto rows that read at 390px as well as at 1440.

import { expect, test, type Page } from '@playwright/test';
import {
	expectNoHorizontalOverflow,
	mc,
	openGameOptions,
	rememberAnonQuiz,
	saveQuiz
} from './helpers';

const QUIZ = {
	title: 'Start dialog',
	description: 'e2e',
	questions: [
		mc('Capital of Portugal?', [
			['Lisbon', true],
			['Porto', false]
		])
	]
};

const SIZES = [
	{ name: '1440', width: 1440, height: 900 },
	{ name: '390', width: 390, height: 844 }
];

async function openStartDialog(page: Page, request: Parameters<typeof saveQuiz>[0]) {
	const saved = await saveQuiz(request, QUIZ);
	await rememberAnonQuiz(page, saved.body.id, saved.secret!);
	await page.goto(`/view/${saved.body.id}`);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Start game' });
	await expect(dialog).toBeVisible();
	return dialog;
}

for (const size of SIZES) {
	test.describe(`at ${size.name}px`, () => {
		test.use({ viewport: { width: size.width, height: size.height } });

		test('Start is in reach with the options folded, and Game options opens them', async ({
			page,
			request
		}) => {
			const dialog = await openStartDialog(page, request);
			const start = dialog.getByRole('button', { name: 'Start game' });
			const trigger = dialog.getByRole('button', { name: 'Game options' });

			await expect(dialog.getByText('Players join with a PIN on their phones.')).toBeVisible();
			await expect(start).toBeVisible();
			await expect(trigger).toHaveAttribute('aria-expanded', 'false');
			// Folded means gone, not clipped: nothing in the fold can be tabbed into.
			await expect(dialog.getByRole('switch')).toHaveCount(0);

			// Start spans the dialog's content, not just its own label.
			const dialogBox = (await dialog.boundingBox())!;
			const startBox = (await start.boundingBox())!;
			expect(startBox.width).toBeGreaterThan(dialogBox.width * 0.8);
			// Start is above the fold, whatever is inside it.
			expect(startBox.y).toBeLessThan((await trigger.boundingBox())!.y);

			await trigger.click();
			await expect(trigger).toHaveAttribute('aria-expanded', 'true');
			await expect(dialog.getByRole('switch')).toHaveCount(3);
			await expect(dialog.getByRole('switch', { name: 'Randomize answers' })).toBeVisible();
			await expectNoHorizontalOverflow(page);
		});

		test('the join question appears under its row, as wide as the dialog allows', async ({
			page,
			request
		}) => {
			const dialog = await openStartDialog(page, request);
			await openGameOptions(dialog);
			const ask = dialog.getByRole('switch', { name: 'Add a join question' });
			const question = dialog.getByRole('textbox', { name: 'The question players answer' });
			await expect(question).toHaveCount(0);
			await ask.click();
			await expect(question).toBeVisible();

			const label = dialog.getByText('Add a join question', { exact: true });
			const labelBox = (await label.boundingBox())!;
			const inputBox = (await question.boundingBox())!;
			// Aligned with the label, not indented under the switch, and not narrower than the
			// column the label and its hint share.
			expect(Math.abs(inputBox.x - labelBox.x)).toBeLessThanOrEqual(1);
			const hint = (await dialog.locator('#custom-field-hint').boundingBox())!;
			expect(inputBox.width).toBeGreaterThanOrEqual(hint.width - 1);
			await expect(question).toHaveAttribute('placeholder', 'e.g. Your department');
			await expectNoHorizontalOverflow(page);
		});

		test('every option is a label and a hint on the left, with its switch on the right', async ({
			page,
			request
		}) => {
			const dialog = await openStartDialog(page, request);
			await openGameOptions(dialog);
			const rows = [
				{ name: 'Add a join question', hint: '#custom-field-hint' },
				{ name: 'Randomize answers', hint: null },
				{
					name: "Show questions and answers on players' devices",
					hint: '#show-on-devices-hint'
				}
			];
			const dialogBox = (await dialog.boundingBox())!;
			for (const row of rows) {
				const toggle = dialog.getByRole('switch', { name: row.name });
				const label = dialog.getByText(row.name, { exact: true });
				const toggleBox = (await toggle.boundingBox())!;
				const labelBox = (await label.boundingBox())!;
				// The switch is to the right of the text and inside the dialog.
				expect(toggleBox.x, `${row.name}: switch is left of its label`).toBeGreaterThan(
					labelBox.x + 40
				);
				expect(toggleBox.x + toggleBox.width).toBeLessThanOrEqual(
					dialogBox.x + dialogBox.width
				);
				// Top-aligned with the label's first line, not floating beside a long hint.
				expect(
					Math.abs(toggleBox.y - labelBox.y),
					`${row.name}: switch is not on the label's first line`
				).toBeLessThanOrEqual(6);
				// A label that wraps to two lines must not touch what is under it, which is what
				// leading-none did at 390px.
				const lineHeight = await label.evaluate((el) => {
					const s = getComputedStyle(el);
					return parseFloat(s.lineHeight) / parseFloat(s.fontSize);
				});
				expect(lineHeight, `${row.name}: tight line height`).toBeGreaterThan(1.15);
				if (row.hint) {
					const hintBox = (await dialog.locator(row.hint).boundingBox())!;
					expect(hintBox.y, `${row.name}: hint overlaps its label`).toBeGreaterThanOrEqual(
						labelBox.y + labelBox.height
					);
					expect(Math.abs(hintBox.x - labelBox.x)).toBeLessThanOrEqual(1);
				}
			}
		});

		test('the fold is closed again, with the switches off, the next time it opens', async ({
			page,
			request
		}) => {
			const dialog = await openStartDialog(page, request);
			await openGameOptions(dialog);
			await dialog.getByRole('switch', { name: 'Add a join question' }).click();
			await dialog.getByRole('textbox', { name: 'The question players answer' }).fill('Team');
			await page.keyboard.press('Escape');
			await expect(dialog).toBeHidden();

			await page.getByRole('button', { name: 'Play', exact: true }).click();
			await expect(dialog.getByRole('button', { name: 'Game options' })).toHaveAttribute(
				'aria-expanded',
				'false'
			);
			await expect(dialog.getByRole('switch')).toHaveCount(0);
			await openGameOptions(dialog);
			await expect(dialog.getByRole('switch', { name: 'Add a join question' })).toHaveAttribute(
				'aria-checked',
				'false'
			);
			await expect(dialog.getByRole('textbox', { name: 'The question players answer' })).toHaveCount(
				0
			);
		});
	});
}

test('Start works with the options never opened', async ({ page, request }) => {
	const dialog = await openStartDialog(page, request);
	await dialog.getByRole('button', { name: 'Start game' }).click();
	await page.waitForURL(/\/admin\?/);
	expect(new URL(page.url()).searchParams.get('pin')).toMatch(/^\d{6}$/);
});
