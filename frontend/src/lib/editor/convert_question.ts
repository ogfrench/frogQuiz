// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { QuizQuestionType, type Question } from '$lib/quiz_types';
import { startingAnswers, type NewQuestionKind } from './new_question';

const KIND_OF: Partial<Record<QuizQuestionType, NewQuestionKind>> = {
	[QuizQuestionType.ABCD]: 'abcd',
	[QuizQuestionType.CHECK]: 'check',
	[QuizQuestionType.VOTING]: 'poll',
	[QuizQuestionType.SLIDE]: 'slide',
	[QuizQuestionType.TEXT]: 'text',
	[QuizQuestionType.RANGE]: 'slider',
	[QuizQuestionType.ORDER]: 'order'
};

// The options of a choice-like question, as text. Empty for a slider or a slide.
const optionTexts = (q: Question): string[] =>
	Array.isArray(q.answers)
		? q.answers.map((a) => (typeof a?.answer === 'string' ? a.answer : ''))
		: [];

const isChoice = (t: QuizQuestionType | undefined) =>
	t === undefined ||
	t === QuizQuestionType.ABCD ||
	t === QuizQuestionType.CHECK ||
	t === QuizQuestionType.VOTING ||
	t === QuizQuestionType.ORDER;

/**
 * The question as another type, keeping what carries over: the title and image always;
 * the option texts between Multiple choice, Check choice, Poll and Put in order (which
 * drop "right" where it means nothing); the right answers' texts as Type answer's
 * accepted spellings, and back. A slider and a slide start fresh.
 *
 * The server picks an answer model by its shape, not by `type` (models.py), so a type
 * change that left the old answers in place was refused on the next autosave.
 */
export const convertQuestion = (q: Question, to: QuizQuestionType): Question => {
	const from = q.type ?? QuizQuestionType.ABCD;
	// A copy, never the same answers: the editor's questions must not share arrays.
	if (from === to) return JSON.parse(JSON.stringify(q));
	const base: Question = {
		time: q.time,
		question: q.question,
		image: q.image,
		hide_results: q.hide_results,
		type: to,
		answers: startingAnswers(KIND_OF[to] ?? 'abcd')
	};
	// A slide has no timer field to fix a bad time in, so it starts from the default.
	if (to === QuizQuestionType.SLIDE) return { ...base, time: '20', body: '' };
	const texts = optionTexts(q);
	if (isChoice(to) && from === QuizQuestionType.TEXT && texts.length > 0) {
		// Accepted spellings are right answers; a second blank option makes it a choice.
		const options = texts.length >= 2 ? texts : [...texts, ''];
		const right = options.map((_, i) => i < texts.length);
		const keep = to === QuizQuestionType.ABCD ? firstOnly(right) : right;
		return { ...base, answers: shape(to, options, (i) => keep[i]) };
	}
	if (isChoice(to) && isChoice(from) && texts.length > 0) {
		const right = Array.isArray(q.answers) ? q.answers.map((a) => Boolean(a?.right)) : [];
		const keep = to === QuizQuestionType.ABCD ? firstOnly(right) : right;
		return { ...base, answers: shape(to, texts, (i) => keep[i] ?? false) };
	}
	if (
		to === QuizQuestionType.TEXT &&
		(from === QuizQuestionType.ABCD || from === QuizQuestionType.CHECK)
	) {
		const answers = q.answers as { answer?: string; right?: boolean }[];
		const spellings = texts.filter((t, i) => answers[i]?.right && t.trim() !== '');
		if (spellings.length > 0) {
			return {
				...base,
				answers: spellings.map((answer) => ({ answer, case_sensitive: false }))
			};
		}
	}
	return base;
};

// One right answer at most: Multiple choice cannot keep two.
const firstOnly = (right: boolean[]) => {
	const i = right.indexOf(true);
	return right.map((_, j) => j === i);
};

const shape = (to: QuizQuestionType, texts: string[], right: (i: number) => boolean) =>
	to === QuizQuestionType.ABCD || to === QuizQuestionType.CHECK
		? texts.map((answer, i) => ({ answer, right: right(i) }))
		: texts.map((answer) => ({ answer }));

/** Whether converting would throw away text the author typed, so the editor asks first. */
export const conversionLosesText = (q: Question, to: QuizQuestionType): boolean => {
	if ((q.type ?? QuizQuestionType.ABCD) === to) return false;
	const before = optionTexts(q).filter((t) => t.trim() !== '');
	const after = convertQuestion(q, to);
	const kept = new Set(optionTexts(after));
	const lostOptions = before.some((t) => !kept.has(t));
	const lostBody = Boolean(q.body?.trim()) && to !== QuizQuestionType.SLIDE;
	const lostCanvas =
		q.type === QuizQuestionType.SLIDE && typeof q.answers === 'string' && q.answers !== '';
	return lostOptions || lostBody || lostCanvas;
};
