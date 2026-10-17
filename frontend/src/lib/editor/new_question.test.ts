// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { QuizQuestionType } from '$lib/quiz_types';
import { isQuestionComplete } from './question_complete';
import * as yup from 'yup';
import { dataSchema } from '$lib/yupSchemas';
import { newQuestion, type NewQuestionKind } from './new_question';
import { QUESTION_TYPES } from './question_types';
import cases from './completeness_cases.json';

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

describe('every kind of new question', () => {
	const kinds: NewQuestionKind[] = [
		'abcd',
		'check',
		'true_false',
		'poll',
		'slide',
		'text',
		'slider',
		'order'
	];

	// The schema for one question: the inner type of the quiz's question list.
	const question = (dataSchema.fields.questions as unknown as { innerType: yup.AnySchema })
		.innerType;

	it('passes the editor schema as a draft, so the draft rule alone holds Start', () => {
		// Multiple choice keeps its old schema, which wants every answer written.
		for (const kind of kinds.filter((k) => !['abcd', 'check', 'true_false'].includes(k))) {
			const q = { ...newQuestion(kind), question: 'Title' };
			expect(() => question.validateSync(q), kind).not.toThrow();
		}
	});

	it('never refuses in the schema a question the draft rule calls finished', () => {
		for (const c of cases.filter((c) => c.complete)) {
			expect(
				() => question.validateSync({ time: '20', ...c.question }),
				c.name
			).not.toThrow();
		}
	});

	// A titled slider is finished at once: its starting values are a valid question, and
	// the card shows the right answer in the open (#93).
	it('is a draft until filled in, except a titled slide or slider', () => {
		for (const kind of kinds) {
			expect(isQuestionComplete(newQuestion(kind)), kind).toBe(false);
			expect(isQuestionComplete({ ...newQuestion(kind), question: 'Title' }), kind).toBe(
				kind === 'slide' || kind === 'slider'
			);
		}
	});

	it('has a label and a description in the type list', () => {
		expect(QUESTION_TYPES.map((t) => t.kind).sort()).toEqual([...kinds].sort());
	});
});
