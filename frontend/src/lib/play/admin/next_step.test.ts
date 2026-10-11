// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { QuizQuestionType } from '$lib/quiz_types';
import { AUTO_RESULTS_DELAY_MS, nextStep, performStep, type NextStepState } from './next_step';

const ABCD = { type: QuizQuestionType.ABCD };
const RESULTS = { answers: [] };

const at = (
	selected_question: number,
	questions: NextStepState['questions'],
	over: Partial<NextStepState> = {}
): NextStepState => ({
	selected_question,
	timer_res: '0',
	question_results: RESULTS,
	scoreboard_open: false,
	final_results: [null],
	questions,
	...over
});

describe('a round in the middle of the quiz', () => {
	const quiz = [ABCD, ABCD, ABCD];
	it('starts with the first question', () => {
		expect(nextStep(at(-1, quiz, { timer_res: undefined, question_results: null }))).toBe(
			'next_question'
		);
	});
	it('stops the clock while the question runs', () => {
		expect(nextStep(at(0, quiz, { timer_res: '12', question_results: null }))).toBe(
			'stop_time'
		);
	});
	it('shows the answers once time is up', () => {
		expect(nextStep(at(0, quiz, { question_results: null }))).toBe('show_results');
	});
	it('goes answers, then scoreboard, then the next question', () => {
		expect(nextStep(at(0, quiz))).toBe('scoreboard');
		expect(nextStep(at(0, quiz, { scoreboard_open: true }))).toBe('next_question');
	});
});

// Gonçalo, 7 Oct: the last question is a different round. Its answers are shown, but its
// scoreboard would give the podium away.
describe('the last question', () => {
	const quiz = [ABCD, ABCD];
	it('still shows its answers', () => {
		expect(nextStep(at(1, quiz, { question_results: null }))).toBe('show_results');
	});
	it('goes from its answers straight to the final results, with no scoreboard', () => {
		expect(nextStep(at(1, quiz))).toBe('final_results');
	});
	it('a slide that ends the quiz goes to the final results', () => {
		expect(nextStep(at(1, [ABCD, { type: QuizQuestionType.SLIDE }]))).toBe('final_results');
	});
	it('a hide-results question records its answers, never asks for a question past the end', () => {
		const hidden = [ABCD, { ...ABCD, hide_results: true }];
		expect(nextStep(at(1, hidden, { question_results: null }))).toBe('skip_results');
	});
});

describe('rounds with nothing to rank', () => {
	it('a slide moves on', () => {
		expect(nextStep(at(0, [{ type: QuizQuestionType.SLIDE }, ABCD], { timer_res: '20' }))).toBe(
			'next_question'
		);
	});
	it('a poll has no scoreboard', () => {
		expect(nextStep(at(0, [{ type: QuizQuestionType.VOTING }, ABCD]))).toBe('next_question');
	});
	it('nobody answering has no scoreboard', () => {
		expect(nextStep(at(0, [ABCD, ABCD], { question_results: undefined }))).toBe(
			'next_question'
		);
	});
	it('a hide-results question in the middle skips its answers', () => {
		expect(
			nextStep(at(0, [{ ...ABCD, hide_results: true }, ABCD], { question_results: null }))
		).toBe('skip_results');
	});
	it('a hide-results question never offers a scoreboard once its answers are in', () => {
		expect(nextStep(at(0, [{ ...ABCD, hide_results: true }, ABCD]))).toBe('next_question');
	});
});

// The host's state carries the quiz, not a bare question list.
const game = ({ questions, ...rest }: NextStepState, shown_question_now: number) => ({
	...rest,
	quiz_data: { questions },
	shown_question_now
});

describe('doing the step', () => {
	const fake = () => ({
		set_question_number: vi.fn(),
		get_question_results: vi.fn(),
		show_solutions: vi.fn(),
		get_final_results: vi.fn()
	});
	it('the next question closes the scoreboard, so the next answers are not drawn as it', () => {
		const c = fake();
		const s = game(at(0, [ABCD, ABCD], { scoreboard_open: true }), 0);
		performStep('next_question', c, s, 'game');
		expect(s.scoreboard_open).toBe(false);
		expect(c.set_question_number).toHaveBeenCalledWith(1);
	});
	it("skipping the last question's answers ends the game instead of asking for question N+1", () => {
		vi.useFakeTimers();
		const c = fake();
		const hidden = [ABCD, { ...ABCD, hide_results: true }];
		const s = game(at(1, hidden, { question_results: null }), 1);
		performStep('skip_results', c, s, 'game');
		vi.runAllTimers();
		expect(c.get_question_results).toHaveBeenCalledWith('game', 1);
		expect(c.get_final_results).toHaveBeenCalled();
		expect(c.set_question_number).not.toHaveBeenCalled();
		vi.useRealTimers();
	});
	it('asking for the answers is recorded, so the automatic request does not send a second', () => {
		// A press on Show results inside the automatic delay, with a slow reply, used to be
		// followed by the timer's own request: every phone got the results twice.
		const c = fake();
		const s = game(at(0, [ABCD, ABCD], { question_results: null }), 0);
		performStep('show_results', c, s, 'game');
		expect(c.get_question_results).toHaveBeenCalledTimes(1);
		expect((s as { results_requested_for?: number }).results_requested_for).toBe(0);
	});
});

it('the automatic answers wait out the server grace for late taps', () => {
	// The server still takes an answer ANSWER_GRACE_MS after the clock. Closing the question
	// sooner than that refused the late taps the grace exists for.
	const server = readFileSync(
		join(import.meta.dirname, '../../../../../frogquiz/socket_server/__init__.py'),
		'utf8'
	);
	const grace = Number(server.match(/^ANSWER_GRACE_MS = (\d+)$/m)?.[1]);
	expect(grace).toBeGreaterThan(0);
	expect(AUTO_RESULTS_DELAY_MS).toBeGreaterThan(grace);
});

it('nothing is next once the podium is up', () => {
	expect(nextStep(at(1, [ABCD, ABCD], { final_results: [[]] }))).toBe('none');
});
