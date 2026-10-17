// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { QuizQuestionType, type Answer, type Question } from '$lib/quiz_types';

export type NewQuestionKind = 'abcd' | 'check' | 'true_false';

const blank = (): Answer => ({ answer: '', right: false });

/**
 * The question every "add" in the editor starts from: the type buttons at the end of the
 * list and "Add question below" (#92).
 *
 * Multiple choice and Check choice start with two blank answers, the fewest a question
 * can be finished with. They used to start with none, and the server refuses a question
 * with no answers (`QuizQuestion.answers` in frogquiz/db/models.py), so autosave stopped
 * from the moment a question was added until "Add an answer" was pressed. Blank text is
 * accepted, and the draft rule (question_complete.ts) keeps the question a draft until
 * both have text and one is marked correct.
 *
 * True / False arrives with its two answers written, neither marked: the author picks.
 * Every call returns fresh objects, so no two questions share an answers array.
 */
export const newQuestion = (
	kind: NewQuestionKind,
	labels: { true: string; false: string } = { true: 'True', false: 'False' }
): Question => ({
	type: kind === 'check' ? QuizQuestionType.CHECK : QuizQuestionType.ABCD,
	time: '20',
	question: '',
	image: undefined,
	answers:
		kind === 'true_false'
			? [
					{ answer: labels.true, right: false },
					{ answer: labels.false, right: false }
				]
			: [blank(), blank()]
});
