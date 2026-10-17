// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { QuizQuestionType as T, type Question } from '$lib/quiz_types';
import { convertQuestion, conversionLosesText } from './convert_question';

const mc: Question = {
	type: T.ABCD,
	time: '20',
	question: 'Capital of Portugal?',
	image: 'img.png',
	answers: [
		{ answer: 'Lisbon', right: true },
		{ answer: 'Porto', right: false }
	]
};
const ALL = [T.ABCD, T.CHECK, T.VOTING, T.TEXT, T.RANGE, T.ORDER, T.SLIDE];

describe('convertQuestion', () => {
	it('keeps the title, image and time for every type', () => {
		for (const to of ALL) {
			const q = convertQuestion(mc, to);
			expect(q).toMatchObject({
				type: to,
				question: mc.question,
				image: 'img.png',
				time: '20'
			});
		}
	});

	it('keeps option texts between the choice types, dropping right where it means nothing', () => {
		expect(convertQuestion(mc, T.VOTING).answers).toEqual([
			{ answer: 'Lisbon' },
			{ answer: 'Porto' }
		]);
		expect(convertQuestion(mc, T.ORDER).answers).toEqual([
			{ answer: 'Lisbon' },
			{ answer: 'Porto' }
		]);
		expect(convertQuestion(mc, T.CHECK).answers).toEqual(mc.answers);
		const poll = convertQuestion(mc, T.VOTING);
		expect(convertQuestion(poll, T.ABCD).answers).toEqual([
			{ answer: 'Lisbon', right: false },
			{ answer: 'Porto', right: false }
		]);
	});

	it('keeps one right answer at most when going to Multiple choice', () => {
		const check = {
			...mc,
			type: T.CHECK,
			answers: [
				{ answer: 'A', right: true },
				{ answer: 'B', right: true }
			]
		};
		expect(convertQuestion(check, T.ABCD).answers).toEqual([
			{ answer: 'A', right: true },
			{ answer: 'B', right: false }
		]);
	});

	it('turns right answers into accepted spellings, and back', () => {
		const text = convertQuestion(mc, T.TEXT);
		expect(text.answers).toEqual([{ answer: 'Lisbon', case_sensitive: false }]);
		expect(convertQuestion(text, T.ABCD).answers).toEqual([
			{ answer: 'Lisbon', right: true },
			{ answer: '', right: false }
		]);
	});

	it('starts a slider and a slide fresh, and a slide again keeps its drawing', () => {
		expect(convertQuestion(mc, T.RANGE).answers).toEqual({
			min: 0,
			max: 10,
			min_correct: 5,
			max_correct: 5
		});
		expect(convertQuestion(mc, T.SLIDE)).toMatchObject({ answers: '', body: '' });
		const canvas = { ...mc, type: T.SLIDE, answers: '{"shapes":[]}' };
		expect(convertQuestion(canvas, T.SLIDE).answers).toBe('{"shapes":[]}');
	});

	it('never shares an answers array with the question it came from', () => {
		const poll = convertQuestion(mc, T.VOTING);
		expect(poll.answers).not.toBe(mc.answers);
	});
});

describe('conversionLosesText', () => {
	it('asks before dropping typed options, a slide body or a drawing', () => {
		expect(conversionLosesText(mc, T.VOTING)).toBe(false);
		expect(conversionLosesText(mc, T.RANGE)).toBe(true);
		expect(conversionLosesText(mc, T.SLIDE)).toBe(true);
		// Only Lisbon was right, so Porto would be dropped going to Type answer.
		expect(conversionLosesText(mc, T.TEXT)).toBe(true);
		expect(
			conversionLosesText({ ...mc, type: T.SLIDE, answers: '', body: 'Round 2' }, T.ABCD)
		).toBe(true);
		expect(conversionLosesText({ ...mc, type: T.SLIDE, answers: '{"x":1}' }, T.ABCD)).toBe(
			true
		);
	});

	it('does not ask when nothing was typed yet, or the type is unchanged', () => {
		const blank = {
			...mc,
			answers: [
				{ answer: '', right: false },
				{ answer: '', right: false }
			]
		};
		expect(conversionLosesText(blank, T.RANGE)).toBe(false);
		expect(conversionLosesText(mc, T.ABCD)).toBe(false);
	});
});
