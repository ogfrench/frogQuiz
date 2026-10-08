// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { QuizQuestionType, type Question } from '$lib/quiz_types';

/**
 * What the host's one "next" does from where the game is. The controls bar's button, the
 * Enter/Space shortcut and the automatic flow all read it, so they cannot disagree again:
 * the shortcut used to skip the scoreboard and never close it, which left every later
 * results screen showing the scoreboard instead of the answers.
 *
 * A round runs: question -> answers (by themselves once time is up) -> scoreboard (by
 * itself, three seconds later) -> next question, which is the only press. The last
 * question has no scoreboard, because the standings would give the podium away: its
 * answers go straight to "Get final results".
 */
export type NextStep =
	| 'none'
	| 'next_question'
	| 'stop_time'
	| 'show_results'
	| 'scoreboard'
	| 'final_results'
	/** A hide-results question: record its answers, then move on without showing them. */
	| 'skip_results';

export interface NextStepState {
	selected_question: number;
	timer_res: string | undefined;
	question_results: unknown;
	scoreboard_open?: boolean;
	final_results: unknown[];
	questions: Pick<Question, 'type' | 'hide_results'>[];
}

/**
 * The fields nextStep reads, taken one by one. The host's game state is a class whose
 * `$state` fields are accessors on its prototype, which a spread does not copy.
 */
export interface StepGame {
	selected_question: number;
	timer_res: string | undefined;
	question_results: unknown;
	scoreboard_open?: boolean;
	final_results: unknown[];
	quiz_data: { questions: NextStepState['questions'] } | null | undefined;
	shown_question_now: number;
}

export const stepState = (g: Omit<StepGame, 'shown_question_now'>): NextStepState => ({
	selected_question: g.selected_question,
	timer_res: g.timer_res,
	question_results: g.question_results,
	scoreboard_open: g.scoreboard_open,
	final_results: g.final_results,
	questions: g.quiz_data?.questions ?? []
});

export const gameIsOver =(final_results: unknown[]): boolean =>
	!(final_results.length === 1 && final_results[0] === null);

export const isLastQuestion = (s: Pick<NextStepState, 'selected_question' | 'questions'>) =>
	s.selected_question + 1 === s.questions.length;

export function nextStep(s: NextStepState): NextStep {
	if (gameIsOver(s.final_results)) return 'none';
	if (s.selected_question === -1) return 'next_question';
	const question = s.questions[s.selected_question];
	if (!question) return 'none';
	const last = isLastQuestion(s);

	if (question.type === QuizQuestionType.SLIDE) return last ? 'final_results' : 'next_question';
	if (s.timer_res !== '0') return 'stop_time';
	if (s.question_results === null) {
		return question.hide_results === true ? 'skip_results' : 'show_results';
	}
	if (last) return 'final_results';
	if (question.hide_results === true) return 'next_question';
	// undefined is "nobody answered", which has no standings change to show. A poll scores
	// nothing, and its chart is drawn ahead of the scoreboard anyway.
	if (
		!s.scoreboard_open &&
		s.question_results !== undefined &&
		question.type !== QuizQuestionType.VOTING
	) {
		return 'scoreboard';
	}
	return 'next_question';
}

export interface StepControls {
	set_question_number(q_number: number): void;
	get_question_results(game_id: string, question_number: number): void;
	show_solutions(): void;
	get_final_results(): void;
}

/** Does `step`. The one place each step's socket calls and state changes are written. */
export function performStep(
	step: NextStep,
	controls: StepControls,
	game_state: StepGame,
	game_token: string
): void {
	const next = game_state.selected_question + 1;
	switch (step) {
		case 'next_question':
			game_state.scoreboard_open = false;
			controls.set_question_number(next);
			return;
		case 'stop_time':
			controls.show_solutions();
			game_state.timer_res = '0';
			return;
		case 'show_results':
			controls.get_question_results(game_token, game_state.shown_question_now);
			return;
		case 'scoreboard':
			game_state.scoreboard_open = true;
			return;
		case 'final_results':
			controls.get_final_results();
			return;
		case 'skip_results': {
			// The answers still have to reach the server's record, for the totals; only
			// the screen that shows them is skipped. On the last question the next thing
			// is the podium -- it used to ask for a question past the end.
			const last = isLastQuestion(stepState(game_state));
			controls.get_question_results(game_token, game_state.shown_question_now);
			setTimeout(() => {
				if (last) controls.get_final_results();
				else controls.set_question_number(next);
			}, 200);
			return;
		}
		case 'none':
			return;
	}
}
