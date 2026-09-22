// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// The quiz title is edited with a CKEditor BalloonEditor whose toolbar only
// offers bold/italic/strikethrough/superscript/subscript, but its `getData()`
// output is unbounded HTML -- a paste can drag in arbitrary tags, and the
// editor's own <p> wrapper leaked through to plain-text render sites (the
// editor sidebar/header), showing literal "<p>...</p>" to the user. This
// allow-lists exactly the tags the toolbar can produce, everything else
// (including foreign markup or pasted CSS text sitting between tags) is
// dropped as a tag but its own text content is kept.
const ALLOWED_TITLE_TAGS = new Set(['p', 'br', 'strong', 'em', 's', 'strike', 'sup', 'sub']);

/** Strips any tag not on the title toolbar's allow-list and drops all attributes, including on allowed tags. */
export function sanitizeTitleHtml(html: string): string {
	if (!html) return '';
	return html
		.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
		.replace(/<\/?([a-zA-Z0-9]+)[^>]*>/g, (match, tagName: string) => {
			const tag = tagName.toLowerCase();
			if (!ALLOWED_TITLE_TAGS.has(tag)) return '';
			return match.startsWith('</') ? `</${tag}>` : `<${tag}>`;
		});
}

const HTML_ENTITIES: Record<string, string> = {
	'&nbsp;': ' ',
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&#39;': "'",
	'&apos;': "'"
};

/** Reduces title HTML (sanitized or not) to plain text, for tooltips, length checks, and other non-HTML contexts. */
export function htmlToPlainText(html: string): string {
	if (!html) return '';
	return html
		.replace(/<[^>]*>/g, ' ')
		.replace(/&(nbsp|amp|lt|gt|quot|#39|apos);/gi, (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? entity)
		.replace(/\s+/g, ' ')
		.trim();
}
