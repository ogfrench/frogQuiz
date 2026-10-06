// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
// SPDX-License-Identifier: MPL-2.0

import { htmlToPlainText } from './sanitize';

export type ShareableQuiz = { title: string; description: string; cover_image?: string };

const LIMIT = 200;

/** What a pasted link to a quiz shows: its name, a line about it, and a picture (its cover,
 *  or the site's own card when it has none). Plain text, since a preview shows no markup. */
export function quizShare(quiz: ShareableQuiz, origin: string, fallbackImage: string) {
	const title = htmlToPlainText(quiz.title) || 'A quiz';
	const said = htmlToPlainText(quiz.description ?? '');
	const description =
		(said.length > LIMIT ? `${said.slice(0, LIMIT - 1).trimEnd()}…` : said) ||
		'A quiz on frogQuiz. Join with a game PIN, or open it to play.';
	const image = quiz.cover_image
		? `${origin}/api/v1/storage/download/${encodeURIComponent(quiz.cover_image)}`
		: fallbackImage;
	return {
		title: `frogQuiz - ${title}`,
		description,
		image,
		hasCover: Boolean(quiz.cover_image)
	};
}
