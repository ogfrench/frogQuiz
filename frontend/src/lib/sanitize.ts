// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import sanitizeHtml from 'sanitize-html';
import { Parser } from 'htmlparser2';

// Parse markup rather than removing tags with regular expressions: removing one
// fragment can otherwise create a new executable tag. This runs identically in
// SSR and the browser, with only the editor toolbar's formatting and no attributes.
const TITLE_TAGS = ['p', 'br', 'strong', 'em', 's', 'strike', 'sup', 'sub'];

export function sanitizeTitleHtml(html: string): string {
	return sanitizeHtml(html || '', {
		allowedTags: TITLE_TAGS,
		allowedAttributes: {},
		allowedSchemes: [],
		allowProtocolRelative: false
	});
}

/** Plain text only: render with escaped text bindings, never an HTML sink. */
export function htmlToPlainText(html: string): string {
	const chunks: string[] = [];
	const parser = new Parser(
		{
			ontext: (text) => {
				chunks.push(text);
			},
			onopentag: () => {
				chunks.push(' ');
			},
			onclosetag: () => {
				chunks.push(' ');
			}
		},
		{ decodeEntities: true }
	);
	parser.end(sanitizeTitleHtml(html));
	return chunks.join('').replace(/\s+/g, ' ').trim();
}
