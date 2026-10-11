// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { totalsFromResults } from './totals';

type ScoredAnswer = { username: string; score: number };

/** The parts of `registered_as_admin` a host page needs to pick a running game back up. */
export interface AdminSnapshot {
	game: { started?: boolean; current_question?: number } | null;
	players?: { username: string }[];
	answer_count?: number;
	question_open?: boolean;
	/** Whole seconds left on an open question, by the server's clock. */
	time_left?: number;
	/** Every answer recorded so far, by question index. */
	results?: Record<string, ScoredAnswer[] | null | undefined>;
	final_results?: Record<string, ScoredAnswer[] | null | undefined> | null;
}

export interface Resume {
	selected_question: number;
	shown_question_now: number;
	timer_res: string;
	question_results: null;
	answer_count: number;
	player_scores: Record<string, number>;
}

/**
 * Where a host who has just loaded the page takes over a game that is already running, or
 * null when there is nothing to take over (the lobby, or Start pressed but no question yet).
 *
 * A reload mid-game came back on the quiz's cover, whose "Next question 1" sent the game back
 * to the start. Now it comes back on the question that is up: with its clock if it is still
 * open, or at zero if it closed, so its answers come up as they would have. The question's
 * answers are left out of the totals, since showing them adds their points.
 */
export function resumeFrom(s: AdminSnapshot): Resume | null {
	const index = s.game?.current_question ?? -1;
	if (!s.game?.started || index < 0) return null;
	const earlier = Object.fromEntries(
		Object.entries(s.results ?? {}).filter(([question]) => Number(question) < index)
	);
	const left = s.question_open ? (s.time_left ?? 0) : 0;
	return {
		selected_question: index,
		shown_question_now: index,
		timer_res: left > 0 ? String(left) : '0',
		question_results: null,
		answer_count: s.answer_count ?? 0,
		player_scores: totalsFromResults(
			earlier,
			(s.players ?? []).map((p) => p.username)
		)
	};
}
