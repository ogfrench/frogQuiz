// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { isQuestionComplete } from './question_complete';

const q = (over = {}) => ({
	question: 'Which of these is an amphibian?',
	answers: [
		{ answer: 'Tree frog', right: true },
		{ answer: 'Gecko', right: false }
	],
	...over
});

describe('isQuestionComplete', () => {
	it('accepts a runnable question', () => {
		expect(isQuestionComplete(q())).toBe(true);
	});

	it('rejects a missing or blank title', () => {
		expect(isQuestionComplete(q({ question: '' }))).toBe(false);
		// A title of nothing but spaces used to count as done in one place and
		// unfinished in another, which is why both callers share this function.
		expect(isQuestionComplete(q({ question: '   ' }))).toBe(false);
	});

	it('needs at least two answers', () => {
		expect(isQuestionComplete(q({ answers: [{ answer: 'Only one', right: true }] }))).toBe(
			false
		);
	});

	it('needs one of them to be correct', () => {
		expect(
			isQuestionComplete(
				q({
					answers: [
						{ answer: 'Tree frog', right: false },
						{ answer: 'Gecko', right: false }
					]
				})
			)
		).toBe(false);
	});

	it('needs every answer to have text', () => {
		expect(
			isQuestionComplete(
				q({
					answers: [
						{ answer: 'Tree frog', right: true },
						{ answer: '', right: false }
					]
				})
			)
		).toBe(false);
	});

	it('does not flag the cut question types as unfinished', () => {
		// RANGE and SLIDE do not store answers as an array. They can no longer be
		// created, but old quizzes still open, and their rules are not these ones.
		expect(isQuestionComplete(q({ answers: { min: 0, max: 10 } }))).toBe(true);
		expect(isQuestionComplete(q({ answers: 'a slide body' }))).toBe(true);
	});

	it('survives a malformed question rather than throwing', () => {
		expect(isQuestionComplete(undefined)).toBe(false);
		expect(isQuestionComplete({})).toBe(false);
	});
});
