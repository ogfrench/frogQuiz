// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Frog avatars. Nobody picks one: the server gives each player a seat when they join,
// unique within the game, and the frontend draws frog `seat % frogs`. The rules are
// asserted on the socket; the last test is what a host and a phone actually see.

import { expect, test } from '@playwright/test';
import { hostFromViewPage, joinAsPlayer, mc, rememberAnonQuiz, saveQuiz } from './helpers';
import { closeAll, connect, hostGame, join, joinAll, next, record } from './sockets';

const QUIZ = {
	title: 'Frogs',
	description: 'e2e',
	questions: [
		mc(
			'Is a frog an amphibian?',
			[
				['Yes', true],
				['No', false]
			],
			'60'
		)
	]
};

type Seats = Record<string, number>;
type Seat = { username: string; seat: number };

/** What the host has heard: one `avatar` event per join, folded into a map. */
const fold = (updates: unknown[]) =>
	Object.fromEntries((updates as Seat[]).map((u) => [u.username, u.seat])) as Seats;

test.afterEach(closeAll);

test.describe('seats on the socket', () => {
	test('a crowd joining at once gets a different seat each, and the host hears all of them', async ({
		request
	}) => {
		const { host, pin } = await hostGame(request, QUIZ);
		const updates = record(host, 'avatar');
		const joined = record(host, 'player_joined');
		const names = Array.from({ length: 20 }, (_, i) => `frog${i}`);
		const players = await joinAll(pin, names);
		await expect.poll(() => updates.length).toBe(names.length);

		const seats = fold(updates);
		expect(Object.keys(seats).sort()).toEqual([...names].sort());
		const values = Object.values(seats);
		expect(values.every(Number.isInteger)).toBe(true);
		expect(new Set(values).size).toBe(names.length);
		// Consecutive, which is what makes them different frogs on the client.
		expect(Math.max(...values) - Math.min(...values)).toBe(names.length - 1);
		// player_joined carries the same seat, for anything that reads it there.
		for (const p of joined as { username: string; avatar: number }[]) {
			expect(p.avatar).toBe(seats[p.username]);
		}
		// The last phone in was sent the whole map, itself included, and no update of its own.
		const last = players[19];
		const lastMap = next<Seats>(last, 'avatars', 500);
		const own = next(last, 'avatar', 500);
		expect(await lastMap, 'map arrives once, on join').toBeNull();
		expect(await own).toBeNull();
	});

	test('a newcomer is sent the whole map, and only the newcomer', async ({ request }) => {
		const { pin } = await hostGame(request, QUIZ);
		const [early] = await joinAll(pin, ['early', 'second']);
		const fullMaps = record(early, 'avatars');
		const updates = record(early, 'avatar');

		const s = await connect();
		const map = next<Seats>(s, 'avatars');
		s.emit('join_game', { username: 'newcomer', game_pin: pin });
		const got = await map;
		expect(Object.keys(got ?? {}).sort()).toEqual(['early', 'newcomer', 'second']);
		// Filtered: the update for 'second' can still be in flight when recording starts.
		await expect.poll(() => fold(updates).newcomer).toBe(got!.newcomer);
		expect(fullMaps, 'the full map is not sent to everybody').toHaveLength(0);
	});

	test('a player keeps their seat across a reload, and a host reconnect gets the map', async ({
		request
	}) => {
		const { host, pin, gameId } = await hostGame(request, QUIZ);
		const [player] = await joinAll(pin, ['returner', 'stayer']);
		const first = await (async () => {
			const s = await connect();
			const reg = next<{ avatars: Seats }>(s, 'registered_as_admin');
			s.emit('register_as_admin', { game_pin: pin, game_id: gameId });
			return (await reg)!.avatars;
		})();
		expect(first.returner).toBeDefined();

		const back = await connect();
		const mine = next<Seats>(back, 'avatars');
		const announced = next<{ avatar: number }>(host, 'player_joined');
		back.emit('rejoin_game', { old_sid: player.id, username: 'returner', game_pin: pin });
		expect((await mine)?.returner, 'map sent to the rejoined phone').toBe(first.returner);
		expect((await announced)?.avatar).toBe(first.returner);
	});

	test('leaving and joining again under the same name is the same frog', async ({ request }) => {
		const { host, pin } = await hostGame(request, QUIZ);
		const updates = record(host, 'avatar');
		const first = await join(pin, 'boomerang');
		await expect.poll(() => updates.length).toBe(1);
		const seat = fold(updates).boomerang;

		const left = next(first.socket, 'left_game');
		first.socket.emit('leave_game', {});
		expect(await left).not.toBeNull();
		const again = await join(pin, 'boomerang');
		expect(again.outcome).toBe('joined');
		await expect.poll(() => updates.length).toBe(2);
		expect((updates[1] as Seat).seat).toBe(seat);
	});
});

test('the host lobby and the phone show the frog', async ({ browser, request }) => {
	const saved = await saveQuiz(request, QUIZ);
	const hostCtx = await browser.newContext();
	const host = await hostCtx.newPage();
	await rememberAnonQuiz(host, saved.body.id, saved.secret!);
	const pin = await hostFromViewPage(host, saved.body.id);

	const { context, page: phone } = await joinAsPlayer(browser, pin, 'kermit');
	const chip = host.getByRole('button', { name: 'Kick: kermit' });
	await expect(chip).toBeVisible();
	// An <img> with a real frog, not the initial fallback.
	const frog = chip.locator('img');
	await expect(frog).toBeVisible();
	await expect(frog).toHaveAttribute('src', /frog-\d+/);
	await expect
		.poll(() => frog.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
		.toBeGreaterThan(0);

	await expect(phone.getByText("You're in, kermit")).toBeVisible();
	const own = phone.locator('img[src*="frog-"]');
	await expect(own).toBeVisible();
	// The same frog on both screens, which is the point.
	expect(await own.getAttribute('src')).toBe(await frog.getAttribute('src'));

	await context.close();
	await hostCtx.close();
});
