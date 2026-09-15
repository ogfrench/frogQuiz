// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { reach } from 'yup';
import { ABCDQuestionSchema, dataSchema } from '$lib/yupSchemas';

/**
 * Whether a question is actually runnable: it has a title, at least two answers, every
 * answer has text, and one of them is marked correct.
 *
 * The rail's per-question dot and the header's "n questions need attention" count are both
 * this one function. They started as two hand-written copies of the same rule and already
 * disagreed -- one asked yup, the other trimmed the string -- so a title made only of
 * spaces counted as done in one place and unfinished in the other.
 */
export const isQuestionComplete = (question): boolean => {
	if (!reach(dataSchema, 'questions[].question').isValidSync(question?.question)) {
		return false;
	}
	// The cut question types (range, text, voting, order, slide) do not store answers as an
	// array. They can no longer be created, but old quizzes still open, and their rules are
	// not these -- so do not flag them as unfinished.
	if (!Array.isArray(question.answers)) {
		return true;
	}
	if (question.answers.length < 2) {
		return false;
	}
	if (!question.answers.some((a) => a.right)) {
		return false;
	}
	return question.answers.every((a) => reach(ABCDQuestionSchema, 'answer').isValidSync(a.answer));
};
