// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { QuizQuestionType } from '$lib/quiz_types';
import { isQuestionComplete } from './question_complete';
import { newQuestion } from './new_question';

describe('newQuestion', () => {
	it('starts Multiple choice and Check choice with two blank answers', () => {
		for (const kind of ['abcd', 'check'] as const) {
			const q = newQuestion(kind);
			expect(q.answers).toEqual([
				{ answer: '', right: false },
				{ answer: '', right: false }
			]);
		}
		expect(newQuestion('abcd').type).toBe(QuizQuestionType.ABCD);
		expect(newQuestion('check').type).toBe(QuizQuestionType.CHECK);
	});

	it('gives the server something it accepts: never an empty answer list', () => {
		for (const kind of ['abcd', 'check', 'true_false'] as const) {
			expect((newQuestion(kind).answers as unknown[]).length).toBeGreaterThan(0);
		}
	});

	it('is still a draft until it is written and an answer is marked', () => {
		const q = newQuestion('abcd');
		expect(isQuestionComplete(q)).toBe(false);
		q.question = 'Capital of Italy?';
		expect(isQuestionComplete(q)).toBe(false);
		q.answers = [
			{ answer: 'Rome', right: true },
			{ answer: 'Milan', right: false }
		];
		expect(isQuestionComplete(q)).toBe(true);
	});

	it('writes True / False, with neither marked, in the given language', () => {
		const q = newQuestion('true_false', { true: 'Vrai', false: 'Faux' });
		expect(q.type).toBe(QuizQuestionType.ABCD);
		expect(q.answers).toEqual([
			{ answer: 'Vrai', right: false },
			{ answer: 'Faux', right: false }
		]);
	});

	it('never shares an answers array between two questions', () => {
		const a = newQuestion('abcd');
		const b = newQuestion('abcd');
		expect(a.answers).not.toBe(b.answers);
		(a.answers as { answer: string }[])[0].answer = 'changed';
		expect((b.answers as { answer: string }[])[0].answer).toBe('');
	});
});
