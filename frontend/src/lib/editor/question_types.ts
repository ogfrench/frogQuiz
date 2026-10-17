// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import type { NewQuestionKind } from './new_question';

/**
 * Every type the editor can create, in the order the picker shows them, and whether it is
 * offered. This is the one switch for a type: turning one off hides it from the picker and
 * the card's type menu, and quizzes that already use it still open, play and score (MVP.md
 * D2, "hide, don't delete"). The server has always accepted all seven.
 *
 * Off until its own PR makes it whole: the editor part, the phone, the projector, scoring
 * and its specs (#93).
 */
export const QUESTION_TYPES: {
	kind: NewQuestionKind;
	label: string;
	description: string;
	enabled: boolean;
}[] = [
	{
		kind: 'abcd',
		label: 'words.multiple_choice',
		description: 'editor.abcd_description',
		enabled: true
	},
	{
		kind: 'check',
		label: 'words.check_choice',
		description: 'editor.check_choice_description',
		enabled: true
	},
	{
		kind: 'true_false',
		label: 'words.true_false',
		description: 'editor.true_false_description',
		enabled: true
	},
	{ kind: 'poll', label: 'words.poll', description: 'editor.poll_description', enabled: true },
	{
		kind: 'text',
		label: 'words.type_answer',
		description: 'editor.type_answer_description',
		enabled: false
	},
	{
		kind: 'slider',
		label: 'words.slider',
		description: 'editor.slider_description',
		enabled: false
	},
	{
		kind: 'order',
		label: 'words.put_in_order',
		description: 'editor.put_in_order_description',
		enabled: false
	},
	{
		kind: 'slide',
		label: 'words.info_slide',
		description: 'editor.info_slide_description',
		enabled: true
	}
];

export const creatableTypes = () => QUESTION_TYPES.filter((t) => t.enabled);
