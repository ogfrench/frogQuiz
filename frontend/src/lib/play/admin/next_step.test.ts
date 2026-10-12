// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { QuizQuestionType } from '$lib/quiz_types';
import {
	AUTO_RESULTS_DELAY_MS,
	STANDINGS_DELAY_MS,
	autoStepDelay,
	nextStep,
	performStep,
	standingsShown,
	type NextStepState
} from './next_step';

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

// The host's state carries the quiz, not a bare question list.
const game = ({ questions, ...rest }: NextStepState, shown_question_now: number) => ({
	...rest,
	quiz_data: { questions },
	shown_question_now
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

// François, 12 Oct: the answers and the standings are one card. The answers show first, the
// same card grows the standings after STANDINGS_DELAY_MS, and the host's press does the
// same thing sooner. "Scoreboard" is still the step's name: it is the standings opening.
describe('the standings, in the same card as the answers', () => {
	const quiz = [ABCD, ABCD, ABCD];
	it('come up by themselves five seconds after the answers', () => {
		expect(STANDINGS_DELAY_MS).toBe(5000);
		expect(autoStepDelay('scoreboard')).toBe(STANDINGS_DELAY_MS);
	});
	it('are the only other thing that comes up by itself, after the answers', () => {
		expect(autoStepDelay('show_results')).toBe(AUTO_RESULTS_DELAY_MS);
		for (const step of [
			'none',
			'next_question',
			'stop_time',
			'final_results',
			'skip_results'
		] as const) {
			expect(autoStepDelay(step), step).toBeNull();
		}
	});
	it('are not showing while the answers are', () => {
		expect(standingsShown(at(0, quiz))).toBe(false);
	});
	it("show at once on the host's press, with no wait", () => {
		vi.useFakeTimers();
		const c = {
			set_question_number: vi.fn(),
			get_question_results: vi.fn(),
			show_solutions: vi.fn(),
			get_final_results: vi.fn()
		};
		const s = game(at(0, quiz), 0);
		expect(nextStep(at(0, quiz))).toBe('scoreboard');
		performStep('scoreboard', c, s, 'game');
		expect(s.scoreboard_open).toBe(true);
		expect(vi.getTimerCount()).toBe(0);
		expect(standingsShown({ ...at(0, quiz), scoreboard_open: s.scoreboard_open })).toBe(true);
		vi.useRealTimers();
	});
	it('are followed by the next question, which is the next press', () => {
		const open = at(0, quiz, { scoreboard_open: true });
		expect(standingsShown(open)).toBe(true);
		expect(nextStep(open)).toBe('next_question');
	});
	it('never show on the last question: the podium is the surprise', () => {
		expect(standingsShown(at(2, quiz, { scoreboard_open: true }))).toBe(false);
		expect(nextStep(at(2, quiz))).toBe('final_results');
	});
	it('never show for a poll, a hide-results question or a round nobody answered', () => {
		const poll = [{ type: QuizQuestionType.VOTING }, ABCD];
		expect(standingsShown(at(0, poll, { scoreboard_open: true }))).toBe(false);
		const hidden = [{ ...ABCD, hide_results: true }, ABCD];
		expect(standingsShown(at(0, hidden, { scoreboard_open: true }))).toBe(false);
		expect(standingsShown(at(0, quiz, { scoreboard_open: true, question_results: undefined }))).toBe(
			false
		);
		expect(standingsShown(at(0, quiz, { scoreboard_open: true, question_results: null }))).toBe(
			false
		);
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
