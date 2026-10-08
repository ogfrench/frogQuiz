// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { FROGS, HUES, addSeat, avatars, frogFor, frogForSeat, setSeats } from './avatars.svelte';

describe('frog avatars', () => {
	it('finds the frogs in the assets folder', () => {
		expect(FROGS.length).toBeGreaterThan(1);
		expect(new Set(FROGS).size).toBe(FROGS.length);
	});

	// The server's promise is consecutive seats; ours is that consecutive seats are
	// different frogs. That is the whole of "unique per game", and it holds for every
	// pose in every colour, not just the first round.
	it('gives a full room of consecutive seats a different frog each', () => {
		const start = 517; // the server starts the counter at a random point
		const size = FROGS.length * HUES.length;
		const room = Array.from({ length: size }, (_, i) => {
			const frog = frogForSeat(start + i)!;
			return `${frog.src}@${frog.hue}`;
		});
		expect(new Set(room).size).toBe(size);
	});

	it('uses up the poses before it starts on the next colour', () => {
		const first = Array.from({ length: FROGS.length }, (_, i) => frogForSeat(i * 1)!);
		expect(new Set(first.map((f) => f.hue)).size).toBe(1);
		expect(new Set(first.map((f) => f.src)).size).toBe(FROGS.length);
		expect(frogForSeat(FROGS.length)!.hue).not.toBe(frogForSeat(0)!.hue);
		expect(frogForSeat(FROGS.length)!.src).toBe(frogForSeat(0)!.src);
	});

	it('shows the first round as drawn, and wraps once colours run out too', () => {
		expect(frogForSeat(0)!.hue).toBe(0);
		const all = FROGS.length * HUES.length;
		expect(frogForSeat(all + 3)).toEqual(frogForSeat(3));
		const back = frogForSeat(-1)!;
		expect(back.src).toBe(FROGS[FROGS.length - 1]);
		expect(back.hue).toBe(HUES[HUES.length - 1]);
	});

	it('shows no frog until a seat has arrived', () => {
		expect(frogForSeat(undefined)).toBeUndefined();
		expect(frogForSeat(2.5)).toBeUndefined();
		expect(frogForSeat(3, [])).toBeUndefined();
		expect(frogForSeat(3, FROGS, [])).toBeUndefined();
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
