// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

/**
 * How many of the players still in the game have answered the question that is up.
 *
 * The host used to add one per answer and drop a player from the total when they left, so
 * a player who answered and then lost signal was counted on one side only, and the
 * projector could read "3 of 2 answered". Counting names against the current list keeps
 * the first number inside the second. A player who comes back is counted again, since
 * their name stays in `answered`.
 */
export function answeredCount(
	answered: Iterable<string>,
	players: readonly { username: string }[]
): number {
	const here = new Set(players.map((p) => p.username));
	let n = 0;
	for (const name of new Set(answered)) if (here.has(name)) n++;
	return n;
}
