// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

/**
 * Meilisearch returns matched terms wrapped in `<em>` inside the `_formatted`
 * fields, so those fields have to reach the DOM as markup. The rest of the field
 * is a quiz title or description typed by whoever made the quiz, and every public
 * quiz is rendered on /search and /explore for anyone who loads them.
 *
 * So escape the whole string first, then put back only the one tag pair we asked
 * Meilisearch for. Escaping cannot be skipped for the un-highlighted case either:
 * /explore renders the raw hit, which is the same author-controlled text.
 */

const ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
};

export const escapeHtml = (value: unknown): string =>
	String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/**
 * Escape author-controlled text, then re-enable Meilisearch's highlight markers
 * as `<mark>`. A literal `<em>` typed into a quiz title will therefore render as a
 * highlight rather than as those four characters — cosmetic, and the price of
 * Meilisearch's default tags being ordinary markup. It cannot smuggle anything
 * else through: everything is escaped before this runs, and only this exact pair
 * is turned back into a tag.
 */
export const highlightToHtml = (value: unknown): string =>
	escapeHtml(value).replaceAll('&lt;em&gt;', '<mark>').replaceAll('&lt;/em&gt;', '</mark>');
