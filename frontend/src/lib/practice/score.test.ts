// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { QuizQuestionType, type Question } from '$lib/quiz_types';
import { isCorrect, isPracticable, isRangeCorrect, isScored, isTextCorrect } from './score';

const q = (type: QuizQuestionType | undefined, rights: boolean[]): Question =>
	({
		type,
		question: 'Q',
		time: '20',
		answers: rights.map((right, i) => ({ answer: String(i), right }))
	}) as unknown as Question;

describe('practice scoring matches the live game', () => {
	it('ABCD: the picked answer must be a right one', () => {
		const question = q(QuizQuestionType.ABCD, [false, true, false]);
		expect(isCorrect(question, [false, true, false])).toBe(true);
		expect(isCorrect(question, [true, false, false])).toBe(false);
		expect(isCorrect(question, [false, false, false])).toBe(false);
	});

	it('a question with no type is an old ABCD question', () => {
		expect(isCorrect(q(undefined, [true, false]), [true, false])).toBe(true);
		expect(isScored(q(undefined, [true, false]))).toBe(true);
	});

	it('CHECK is all or nothing', () => {
		const question = q(QuizQuestionType.CHECK, [true, false, true]);
		expect(isCorrect(question, [true, false, true])).toBe(true);
		expect(isCorrect(question, [true, false, false]), 'one right answer missing').toBe(false);
		expect(isCorrect(question, [true, true, true]), 'one wrong answer ticked').toBe(false);
		expect(isCorrect(q(QuizQuestionType.CHECK, []), []), 'no answers is no free point').toBe(
			false
		);
	});

	it('VOTING runs but is not scored; Order is not practicable yet', () => {
		expect(isPracticable(q(QuizQuestionType.VOTING, [false, false]))).toBe(true);
		expect(isScored(q(QuizQuestionType.VOTING, [false, false]))).toBe(false);
		for (const t of [QuizQuestionType.ORDER]) {
			expect(isPracticable(q(t, []))).toBe(false);
		}
	});

	it('Type answer is marked as the game marks it (#93)', () => {
		const text = {
			type: QuizQuestionType.TEXT,
			time: '20',
			question: 'Capital of Portugal?',
			answers: [{ answer: 'Lisbon', case_sensitive: false }]
		};
		expect(isPracticable(text)).toBe(true);
		expect(isScored(text)).toBe(true);
		expect(isTextCorrect(text, '  lisbon. ')).toBe(true);
		expect(isTextCorrect(text, 'Porto')).toBe(false);
		expect(isScored({ ...text, answers: [{ answer: ' ', case_sensitive: false }] })).toBe(
			false
		);
	});

	it('Slider is right inside the range, both ends included (#93)', () => {
		const slider = {
			type: QuizQuestionType.RANGE,
			time: '20',
			question: 'Legs?',
			answers: { min: 0, max: 10, min_correct: 4, max_correct: 6 }
		};
		expect(isPracticable(slider)).toBe(true);
		expect(isScored(slider)).toBe(true);
		expect([3, 4, 5, 6, 7].map((v) => isRangeCorrect(slider, v))).toEqual([
			false,
			true,
			true,
			true,
			false
		]);
	});

	it('a draft question with no answer marked right is not scored', () => {
		expect(isScored(q(QuizQuestionType.ABCD, [false, false]))).toBe(false);
		expect(isScored(q(QuizQuestionType.CHECK, [false, false, false]))).toBe(false);
	});
});
