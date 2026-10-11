// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

type ScoredAnswer = { username: string; score: number };

/**
 * Each player's total from the server's running tally (the `scores` event), with every
 * player in `known` at 0 or more. The server adds an answer's points as it records it,
 * hide-results questions included, which the host's own per-question sum missed.
 */
export function totalsFromServer(
	scores: Record<string, number | string> | null | undefined,
	known: Iterable<string> = []
): Record<string, number> {
	const totals: Record<string, number> = {};
	for (const name of known) totals[name] = 0;
	for (const [name, points] of Object.entries(scores ?? {})) {
		totals[name] = Number(points) || 0;
	}
	return totals;
}

/**
 * Each player's total, rebuilt from the server's final results.
 *
 * The host screen used to keep its own running tally, adding a question's points one
 * second after its results screen mounted. Advance sooner, or skip "Show results", and
 * that question never reached the projector's podium, while players' phones -- which
 * use the server's totals -- were right. The final results carry every recorded answer
 * with the score the server added for it, so summing them gives the server's totals.
 *
 * Players in `known` who never scored are kept at 0 rather than dropped, so everyone
 * who joined still shows on the podium.
 */
export function totalsFromResults(
	results: Record<string, ScoredAnswer[] | null | undefined>,
	known: Iterable<string> = []
): Record<string, number> {
	const totals: Record<string, number> = {};
	for (const name of known) totals[name] = 0;
	for (const answers of Object.values(results)) {
		for (const a of answers ?? []) {
			totals[a.username] = (totals[a.username] ?? 0) + (Number(a.score) || 0);
		}
	}
	return totals;
}
