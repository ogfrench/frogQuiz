// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// The frog on a person's account pages: the navbar's circle and My Account. A person can
// pick one (PUT /api/v1/users/me/frog); until they do, their username picks one for them,
// so nobody is left with an initial. In a game a player's frog still comes from their
// seat (play/avatars.svelte.ts): players join with a nickname, not an account.

const files = import.meta.glob('./assets/frogs/*.webp', {
	eager: true,
	query: '?url',
	import: 'default'
}) as Record<string, string>;

/** The frog files are `frog-<colour>-<pose>.webp`; a frog is named by `<colour>-<pose>`. */
export const COLOURS = [0, 1, 2, 3, 4, 5] as const;
export const POSES = Array.from({ length: 25 }, (_, i) => String(i + 1).padStart(2, '0'));
export const ALL_FROGS = COLOURS.flatMap((c) => POSES.map((p) => `${c}-${p}`));

export const frogUrl = (key: string) => files[`./assets/frogs/frog-${key}.webp`];

/** The same frog for the same username, everywhere. */
export function defaultFrog(username: string): string {
	let h = 2166136261;
	for (const ch of username.trim().toLowerCase()) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
	return ALL_FROGS[(h >>> 0) % ALL_FROGS.length];
}

export function randomFrog(except?: string | null): string {
	const others = ALL_FROGS.filter((f) => f !== except);
	return others[Math.floor(Math.random() * others.length)];
}

/** The signed-in person, as the pages that show their frog share it. */
export const me = $state<{ frog: string | null }>({ frog: null });

/** The frog to show for this person: the one they picked, else their username's. */
export function frogFor(username: string | null | undefined): string | undefined {
	if (me.frog && frogUrl(me.frog)) return me.frog;
	return username ? defaultFrog(username) : undefined;
}
