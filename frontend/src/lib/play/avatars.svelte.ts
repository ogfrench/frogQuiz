// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Every player gets a frog, and nobody chooses it. The server hands each player a seat
// when they join -- a counter, unique within the game -- and this file turns a seat into
// a frog. Seats are consecutive, so two players share a frog only once a room has more
// players than there are frogs.

// Whatever is in the folder, in file-name order. Adding or removing a frog is a file
// operation: nothing here or on the server counts them.
const files = import.meta.glob('../assets/frogs/*.webp', {
	eager: true,
	query: '?url',
	import: 'default'
}) as Record<string, string>;

export const FROGS: readonly string[] = Object.keys(files)
	.sort()
	.map((path) => files[path]);

/** Seats by username, for the game this page is in. */
export const avatars = $state<{ seats: Record<string, number> }>({ seats: {} });

/** The server's `avatars` event, and the `avatars` field of `registered_as_admin`. */
export function setSeats(seats: unknown) {
	avatars.seats =
		seats && typeof seats === 'object' && !Array.isArray(seats)
			? (seats as Record<string, number>)
			: {};
}

export function frogForSeat(seat: number | undefined, frogs: readonly string[] = FROGS) {
	if (seat === undefined || !Number.isInteger(seat) || frogs.length === 0) return undefined;
	// The counter starts at a random point and only goes up, but a negative seat should
	// still land on a frog rather than on undefined.
	return frogs[((seat % frogs.length) + frogs.length) % frogs.length];
}

/** The server's `avatar` event: one new seat, sent to everybody already in the room. */
export function addSeat(update: unknown) {
	const { username, seat } = (update ?? {}) as { username?: unknown; seat?: unknown };
	if (typeof username !== 'string' || !Number.isInteger(seat)) return;
	avatars.seats = { ...avatars.seats, [username]: seat as number };
}

/** The frog for a player, or undefined until their seat has arrived. */
export function frogFor(username: string) {
	return frogForSeat(avatars.seats[username]);
}
