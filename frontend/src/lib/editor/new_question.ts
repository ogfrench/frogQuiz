// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { QuizQuestionType, type Answer, type Question } from '$lib/quiz_types';

export type NewQuestionKind =
	| 'abcd'
	| 'check'
	| 'true_false'
	| 'poll'
	| 'slide'
	| 'text'
	| 'slider'
	| 'order';

const blank = (): Answer => ({ answer: '', right: false });

// Every kind's type. True / False is not a type of its own anywhere: it is an ABCD
// question that arrives with its two answers written.
export const TYPE_OF: Record<NewQuestionKind, QuizQuestionType> = {
	abcd: QuizQuestionType.ABCD,
	check: QuizQuestionType.CHECK,
	true_false: QuizQuestionType.ABCD,
	poll: QuizQuestionType.VOTING,
	slide: QuizQuestionType.SLIDE,
	text: QuizQuestionType.TEXT,
	slider: QuizQuestionType.RANGE,
	order: QuizQuestionType.ORDER
};

/** The answers a new question of this type starts with. Fresh objects on every call. */
export const startingAnswers = (
	kind: NewQuestionKind,
	labels: { true: string; false: string } = { true: 'True', false: 'False' }
): Question['answers'] => {
	switch (kind) {
		case 'true_false':
			return [
				{ answer: labels.true, right: false },
				{ answer: labels.false, right: false }
			];
		case 'poll':
			return [{ answer: '' }, { answer: '' }];
		case 'order':
			return [{ answer: '' }, { answer: '' }, { answer: '' }];
		case 'text':
			return [{ answer: '', case_sensitive: false }];
		case 'slider':
			return { min: 0, max: 10, min_correct: 5, max_correct: 5 };
		case 'slide':
			// A plain slide keeps its text in `body`; the string is where old canvas slides
			// kept their drawing, and the server wants a string for every slide.
			return '';
		default:
			return [blank(), blank()];
	}
};

/**
 * The question every "add" in the editor starts from: the type buttons at the end of the
 * list and "Add question below" (#92).
 *
 * Every kind starts with answers the server accepts on the first autosave, so the quiz
 * saves (as a draft) the moment a question is added. Multiple choice and Check choice used
 * to start with none, and the server refuses an empty answer list (`QuizQuestion.answers`
 * in frogquiz/db/models.py), so autosave stopped until "Add an answer" was pressed. The
 * draft rule (question_complete.ts) keeps the question a draft until it is filled in.
 *
 * True / False arrives with its two answers written, neither marked: the author picks.
 * A slide has no timer: the host moves on with Next (`time` is kept for the server).
 */
export const newQuestion = (
	kind: NewQuestionKind,
	labels: { true: string; false: string } = { true: 'True', false: 'False' }
): Question => ({
	type: TYPE_OF[kind],
	time: '20',
	question: '',
	image: undefined,
	answers: startingAnswers(kind, labels),
	...(kind === 'slide' ? { body: '' } : {})
});
