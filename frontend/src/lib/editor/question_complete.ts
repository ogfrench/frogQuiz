// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { ABCDQuestionSchema, dataSchema, fieldIsValid } from '$lib/yupSchemas';
import { QuizQuestionType } from '$lib/quiz_types';
import { htmlToPlainText } from '$lib/sanitize';

/** The most items a Put in order question takes: six fit a phone with a thumb each. */
export const MAX_ORDER_ITEMS = 6;
/** The most options a poll takes; the same ceiling as the server's answers per question. */
export const MAX_POLL_OPTIONS = 10;
/** The most accepted spellings a Type answer question takes. */
export const MAX_TEXT_SPELLINGS = 10;
/** The widest slider: pips stay readable on a phone, and a guess stays a guess. */
export const MAX_SLIDER_SPAN = 10_000;

const visible = (value: unknown): string =>
	typeof value === 'string' ? htmlToPlainText(value) : '';

// Two options that differ only in case or spacing are the same option to a player.
const distinct = (texts: string[]): boolean =>
	new Set(texts.map((t) => t.toLowerCase())).size === texts.length;

const texts = (answers: unknown): string[] | null =>
	Array.isArray(answers) ? answers.map((a) => visible(a?.answer)) : null;

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

/**
 * Whether a question is actually runnable, by type. Every type needs a title; then:
 * - Multiple choice and Check choice: 2 or more answers, all with text, one marked right.
 * - Poll: 2 to 10 options, all with text, no two the same.
 * - Type answer: 1 to 10 accepted spellings, all with text.
 * - Slider: whole numbers, min below max, the right range inside them, a span of at most
 *   10,000.
 * - Put in order: 2 to 6 items, all with text, no two the same.
 * - Info slide: the title is all it needs; an old drawn slide, its drawing.
 *
 * The rail's per-question dot and the header's "n questions need attention" count are both
 * this one function. It is also the draft rule (MVP.md D14): the server refuses to start a
 * quiz with an unfinished question, using `frogquiz/helpers/completeness.py`. The two must
 * say the same thing, so both test suites read one list of cases,
 * `completeness_cases.json`.
 */
export const isQuestionComplete = (question): boolean => {
	const answers = question?.answers;
	const type = question?.type || QuizQuestionType.ABCD;
	// An old drawn slide keeps its text in the drawing, and was made with an empty title.
	if (type === QuizQuestionType.SLIDE && typeof answers === 'string' && answers !== '') {
		return true;
	}
	if (!fieldIsValid(dataSchema, 'questions[].question', question?.question)) {
		return false;
	}
	switch (type) {
		case QuizQuestionType.ABCD:
		case QuizQuestionType.CHECK:
			return (
				Array.isArray(answers) &&
				answers.length >= 2 &&
				answers.some((a) => a?.right) &&
				answers.every(
					(a) =>
						visible(a?.answer) !== '' &&
						fieldIsValid(ABCDQuestionSchema, 'answer', a?.answer)
				)
			);
		case QuizQuestionType.VOTING: {
			const t = texts(answers);
			return (
				t !== null &&
				t.length >= 2 &&
				t.length <= MAX_POLL_OPTIONS &&
				t.every(Boolean) &&
				distinct(t)
			);
		}
		case QuizQuestionType.TEXT: {
			const t = texts(answers);
			return (
				t !== null && t.length >= 1 && t.length <= MAX_TEXT_SPELLINGS && t.every(Boolean)
			);
		}
		case QuizQuestionType.ORDER: {
			const t = texts(answers);
			return (
				t !== null &&
				t.length >= 2 &&
				t.length <= MAX_ORDER_ITEMS &&
				t.every(Boolean) &&
				distinct(t)
			);
		}
		case QuizQuestionType.RANGE: {
			const { min, max, min_correct, max_correct } = answers ?? {};
			return (
				[min, max, min_correct, max_correct].every(isInt) &&
				min < max &&
				max - min <= MAX_SLIDER_SPAN &&
				min <= min_correct &&
				min_correct <= max_correct &&
				max_correct <= max
			);
		}
		case QuizQuestionType.SLIDE:
			return true;
		default:
			return false;
	}
};
