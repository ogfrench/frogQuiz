// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { FROGS, addSeat, avatars, frogFor, frogForSeat, setSeats } from './avatars.svelte';

describe('frog avatars', () => {
	it('finds the frogs in the assets folder', () => {
		expect(FROGS.length).toBeGreaterThan(1);
		expect(new Set(FROGS).size).toBe(FROGS.length);
	});

	// The server's promise is consecutive seats; ours is that consecutive seats are
	// different frogs. That is the whole of "unique per game".
	it('gives a full room of consecutive seats a different frog each', () => {
		const start = 517; // the server starts the counter at a random point
		const room = Array.from({ length: FROGS.length }, (_, i) => frogForSeat(start + i));
		expect(new Set(room).size).toBe(FROGS.length);
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
