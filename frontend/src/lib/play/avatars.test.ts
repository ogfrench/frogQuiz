// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FROGS, addSeat, avatars, frogFor, frogForSeat, setSeats } from './avatars.svelte';
import { seatOrder } from './seat_order';

const parse = (url: string) => {
	const m = /frog-(\d+)-(\d+)\./.exec(url);
	return m ? { colour: m[1], pose: m[2] } : undefined;
};
const POSES = new Set(FROGS.map((f) => parse(f)?.pose)).size;
const COLOURS = new Set(FROGS.map((f) => parse(f)?.colour)).size;
// assign_avatar starts each game's counter at random.randrange(1000).
const STARTS = Array.from({ length: 1000 }, (_, i) => i + 1);
const room = (start: number, size: number) =>
	Array.from({ length: size }, (_, i) => frogForSeat(start + i)!);

describe('frog avatars', () => {
	it('finds every frog in the assets folder, each once', () => {
		expect(FROGS.length).toBeGreaterThan(1);
		expect(new Set(FROGS).size).toBe(FROGS.length);
	});

	// If a pose were missing a colour, seatOrder would quietly fall back to a plain
	// shuffle and the "no pose twice" promise below would be gone.
	it('has every pose in every colour', () => {
		expect(FROGS.every((f) => parse(f))).toBe(true);
		expect(FROGS.length).toBe(POSES * COLOURS);
	});

	// The server's promise is consecutive seats; ours is that consecutive seats are
	// different frogs. That is the whole of "unique per game", and it holds from every
	// point the server can start a game at.
	it('never hands out a frog twice until every frog has been handed out', () => {
		for (const start of STARTS) {
			expect(new Set(room(start, FROGS.length)).size).toBe(FROGS.length);
		}
	});

	it('gives a room up to the number of poses a different pose each, not just a different colour', () => {
		for (const start of STARTS) {
			const poses = room(start, POSES).map((f) => parse(f)!.pose);
			expect(new Set(poses).size).toBe(POSES);
		}
	});

	it('mixes colours from the first player, rather than handing out one colour first', () => {
		const colours = room(0, 8).map((f) => parse(f)!.colour);
		expect(new Set(colours).size).toBeGreaterThan(2);
	});

	it('still never repeats a frog when the files do not form a full grid', () => {
		const incomplete = {
			'a/frog-0-01.webp': 'a',
			'a/frog-0-02.webp': 'b',
			'a/frog-1-01.webp': 'c'
		};
		expect(seatOrder(incomplete, 1).sort()).toEqual(['a', 'b', 'c']);
		const unnamed = { 'a/one.webp': 'x', 'a/two.webp': 'y' };
		expect(seatOrder(unnamed, 1).sort()).toEqual(['x', 'y']);
	});

	it('lays the same files out in the same order every time, so every screen agrees', () => {
		const grid = Object.fromEntries(
			['0', '1'].flatMap((c) =>
				['01', '02', '03'].map((p) => [`frog-${c}-${p}.webp`, `${c}${p}`])
			)
		);
		expect(seatOrder(grid, 7)).toEqual(seatOrder(grid, 7));
	});

	it('wraps once the room outgrows the frogs, rather than running out', () => {
		expect(frogForSeat(FROGS.length + 3)).toBe(frogForSeat(3));
		expect(frogForSeat(-1)).toBe(FROGS[FROGS.length - 1]);
	});

	it('shows no frog until a seat has arrived', () => {
		expect(frogForSeat(undefined)).toBeUndefined();
		expect(frogForSeat(2.5)).toBeUndefined();
		expect(frogForSeat(3, [])).toBeUndefined();
	});

	it('looks players up by name, and a name like "constructor" is not a seat', () => {
		setSeats({ ana: 4 });
		expect(frogFor('ana')).toBe(frogForSeat(4));
		expect(frogFor('bo')).toBeUndefined();
		expect(frogFor('constructor')).toBeUndefined();
		setSeats(null);
		expect(avatars.seats).toEqual({});
	});

	it('adds one seat at a time, and ignores an update that is not one', () => {
		setSeats({ ana: 4 });
		addSeat({ username: 'bo', seat: 5 });
		addSeat({ username: 'cy', seat: '6' });
		addSeat(null);
		expect(avatars.seats).toEqual({ ana: 4, bo: 5 });
		// A computed key makes an own property, so this is a player, not a prototype.
		addSeat({ username: '__proto__', seat: 7 });
		expect(frogFor('__proto__')).toBe(frogForSeat(7));
		expect(Object.getPrototypeOf(avatars.seats)).toBe(Object.prototype);
	});
});

// The frogs are CC BY 4.0, not MPL like the code around them, and CC BY only holds while
// the credit travels with them. These fail if a file lands in the folder that the REUSE
// record does not cover, or if the record, the licence text or the in-app credit goes.
describe('the frog licence', () => {
	const root = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));
	const read = (path: string) => readFileSync(root(path), 'utf8');

	it('covers every file in the folder', () => {
		const strays = readdirSync(root('frontend/src/lib/assets/frogs')).filter(
			(name) => name !== 'README.md' && !/^frog-\d+-\d+\.webp$/.test(name)
		);
		expect(strays).toEqual([]);
	});

	it('is recorded for REUSE, with the licence text alongside', () => {
		const paragraph = read('.reuse/dep5')
			.split(/\r?\n\r?\n/)
			.find((p) => p.includes('Files: frontend/src/lib/assets/frogs/*.webp'));
		expect(paragraph).toMatch(/intellikat/);
		expect(paragraph).toMatch(/^License: CC-BY-4\.0$/m);
		expect(read('LICENSES/CC-BY-4.0.txt')).toMatch(
			/Creative Commons Attribution 4\.0 International/
		);
	});

	it('credits the artist and links the licence in the app', () => {
		const page = read('frontend/src/routes/docs/attribution/+page.svelte');
		expect(page).toMatch(/intellikat/);
		expect(page).toMatch(/creativecommons\.org\/licenses\/by\/4\.0/);
	});
});
