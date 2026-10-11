// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Images in a live game: the quiz's cover on the title screens, and a question's image on
// the projector and, when questions are shown on devices, on the phone. Nothing tested
// this end to end before 8 Oct. Each image is checked as decoded (naturalWidth > 0), not
// just present, since a broken <img> is still an element.

import { deflateSync } from 'node:zlib';
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import {
	expectNoHorizontalOverflow,
	hostFromViewPage,
	joinAsPlayer,
	mc,
	rememberAnonQuiz,
	saveQuiz
} from './helpers';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
const crc32 = (buf: Buffer) => {
	let c = 0xffffffff;
	for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([len, body, crc]);
};

/** A plain grey PNG of the given size: tall enough to push a phone layout, if it can. */
function png(width: number, height: number): Buffer {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 0; // greyscale
	const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width, 0x99)]);
	const raw = Buffer.concat(Array.from({ length: height }, () => row));
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw)),
		chunk('IEND', Buffer.alloc(0))
	]);
}

async function upload(request: APIRequestContext, buffer: Buffer) {
	const res = await request.post('/api/v1/storage/', {
		multipart: { file: { name: 'tall.png', mimeType: 'image/png', buffer } }
	});
	expect(res.status(), await res.text()).toBe(200);
	return (await res.json()).id as string;
}

const decoded = (img: Locator) =>
	expect
		.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth), {
			timeout: 15_000
		})
		.toBeGreaterThan(0);

const cover = (p: Page) => p.locator('img[src*="/api/v1/storage/download/"]').first();
// The question image goes through MediaComponent, which draws it from a blob URL.
const questionImage = (p: Page) => p.locator('img[src^="blob:"]');

for (const showOnDevices of [false, true]) {
	test(`the cover and a question's image show in a game${showOnDevices ? ', on the phones too' : ''}`, async ({
		page,
		request,
		browser
	}) => {
		test.setTimeout(3 * 60_000);
		const image = await upload(request, png(60, 900));
		const saved = await saveQuiz(request, {
			title: 'Pictures',
			description: 'e2e',
			cover_image: image,
			questions: [
				{
					...mc('What is in the picture?', [
						['Grey', true],
						['Blue', false]
					]),
					image
				}
			]
		} as Parameters<typeof saveQuiz>[1]);
		await page.setViewportSize({ width: 1440, height: 900 });
		await rememberAnonQuiz(page, saved.body.id, saved.secret!);
		const pin = await hostFromViewPage(page, saved.body.id, { showOnDevices });
		const phone = await joinAsPlayer(browser, pin, 'Ana');
		await expect(page.getByRole('button', { name: /Ana/ })).toBeVisible();
		await page.getByRole('button', { name: 'Start game' }).click();

		// The title screen, on both.
		await decoded(cover(page));
		await decoded(cover(phone.page));

		await page.getByRole('button', { name: /Next question/ }).click();
		await expect(page.getByRole('heading', { name: 'What is in the picture?' })).toBeVisible();
		await decoded(questionImage(page).first());
		if (showOnDevices) {
			await decoded(questionImage(phone.page).first());
			// A 60x900 image must scale into the phone's header, not run off it.
			const box = (await questionImage(phone.page).first().boundingBox())!;
			expect(box.y + box.height).toBeLessThan(844);
		} else {
			// The shapes-only phone has no room for it; the question is on the big screen.
			await expect(phone.page.getByRole('button', { name: 'Grey' })).toBeVisible();
			await expect(questionImage(phone.page)).toHaveCount(0);
		}
		await expectNoHorizontalOverflow(phone.page);
		await expectNoHorizontalOverflow(page);
		await phone.context.close();
	});
}
