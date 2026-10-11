// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// The four answers sit in the same places on the projector and on every phone: red
// top-left, blue top-right, green bottom-left, purple bottom-right. A player reads the
// question on the big screen and taps the tile in the same corner on their phone. The
// phone filled its grid column by column and the host row by row, so blue and green
// swapped places between the two (Gonçalo, 7 Oct).

import { expect, test, type Locator } from '@playwright/test';
import { hostFromViewPage, joinAsPlayer, mc, rememberAnonQuiz, saveQuiz } from './helpers';

const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

/** Which corner of the four each tile sits in, read from where it is drawn. */
async function corners(tiles: Locator[]): Promise<string[]> {
	const boxes = await Promise.all(tiles.map(async (t) => (await t.boundingBox())!));
	const midX = boxes.reduce((s, b) => s + b.x + b.width / 2, 0) / boxes.length;
	const midY = boxes.reduce((s, b) => s + b.y + b.height / 2, 0) / boxes.length;
	return boxes.map(
		(b) =>
			`${b.y + b.height / 2 < midY ? 'top' : 'bottom'}-${b.x + b.width / 2 < midX ? 'left' : 'right'}`
	);
}

for (const showOnDevices of [false, true]) {
	test(`answer tiles are in the host's order on the phone${showOnDevices ? ', with the answers on the phone' : ''}`, async ({
		page,
		request,
		browser
	}) => {
		const answers = ['Red', 'Blue', 'Green', 'Purple'];
		const saved = await saveQuiz(request, {
			title: 'Corners',
			description: 'e2e',
			questions: [
				mc(
					'Which corner?',
					answers.map((a, i) => [a, i === 0])
				)
			]
		});
		await page.setViewportSize({ width: 1440, height: 900 });
		await rememberAnonQuiz(page, saved.body.id, saved.secret!);
		const pin = await hostFromViewPage(page, saved.body.id, { showOnDevices });
		const phone = await joinAsPlayer(browser, pin, 'Ana');
		await expect(page.getByRole('button', { name: /Ana/ })).toBeVisible();
		await page.getByRole('button', { name: 'Start game' }).click();
		await page.getByRole('button', { name: /Next question/ }).click();

		const host = answers.map((a) => page.locator('.answer-row').filter({ hasText: a }));
		const tiles = answers.map((a) => phone.page.getByRole('button', { name: a, exact: true }));
		await expect(host[3]).toBeVisible();
		await expect(tiles[3]).toBeVisible();
		expect(await corners(host), 'host').toEqual(CORNERS);
		expect(await corners(tiles), 'phone').toEqual(CORNERS);
		await phone.context.close();
	});
}
