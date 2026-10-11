// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { resumeFrom, type AdminSnapshot } from './resume';

const answer = (username: string, score: number) => ({ username, score });

const snapshot = (over: Partial<AdminSnapshot> = {}): AdminSnapshot => ({
	game: { started: true, current_question: 1 },
	players: [{ username: 'ana' }, { username: 'ben' }, { username: 'cy' }],
	answer_count: 2,
	question_open: true,
	time_left: 7,
	results: {
		'0': [answer('ana', 900), answer('ben', 500)],
		'1': [answer('ana', 1000), answer('ben', 1000)]
	},
	final_results: null,
	...over
});

describe('a host who reloads', () => {
	it('in the lobby has nothing to pick up', () => {
		expect(resumeFrom(snapshot({ game: { started: false, current_question: -1 } }))).toBeNull();
	});

	it('after Start but before the first question has nothing to pick up either', () => {
		expect(resumeFrom(snapshot({ game: { started: true, current_question: -1 } }))).toBeNull();
	});

	it('mid-question comes back on that question, with the clock where it is', () => {
		// It came back on the cover with "Next question 1", and one press sent the running
		// game back to the start.
		const r = resumeFrom(snapshot())!;
		expect(r.selected_question).toBe(1);
		expect(r.shown_question_now).toBe(1);
		expect(r.timer_res).toBe('7');
		expect(r.question_results).toBeNull();
		expect(r.answer_count).toBe(2);
	});

	it('after the question closed comes back with the clock at zero, so its answers come up', () => {
		expect(resumeFrom(snapshot({ question_open: false }))!.timer_res).toBe('0');
		expect(resumeFrom(snapshot({ time_left: 0 }))!.timer_res).toBe('0');
	});

	it('keeps the running totals of the questions before this one, and only those', () => {
		// This question's points are added when its answers are shown, so counting them
		// here as well would count them twice.
		expect(resumeFrom(snapshot())!.player_scores).toEqual({ ana: 900, ben: 500, cy: 0 });
	});
});
