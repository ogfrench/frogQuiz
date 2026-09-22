// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { sanitizeTitleHtml } from '$lib/sanitize';

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

/**
 * The title is the one author-controlled field that is legitimately HTML now
 * (bold/italic/etc. from the title's rich-text editor, see lib/sanitize.ts),
 * so it can't go through the escape-everything path above -- that would show
 * the formatting tags as literal text. sanitizeTitleHtml is the same
 * allow-list used when the title is saved, so nothing beyond those few tags
 * (no attributes, no scripts) reaches the DOM here either. Meilisearch's own
 * highlight wrapper happens to be `<em>`, which is already on that allow-list
 * for italics -- so a real match and a title that was itself typed in italic
 * both end up highlighted, same cosmetic trade-off `highlightToHtml` already
 * accepts for a literal `<em>` typed as text.
 */
export const highlightTitleToHtml = (value: unknown): string =>
	sanitizeTitleHtml(String(value ?? '')).replaceAll('<em>', '<mark>').replaceAll('</em>', '</mark>');
