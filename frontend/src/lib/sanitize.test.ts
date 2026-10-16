// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { htmlToPlainText, sanitizeTitleHtml } from './sanitize';

describe('title HTML sanitization', () => {
	it('retains toolbar formatting but removes attributes and active elements', () => {
		expect(
			sanitizeTitleHtml(
				'<p class="x"><strong onclick="alert(1)">Frogs</strong><br><em>Quiz</em></p>'
			)
		).toBe('<p><strong>Frogs</strong><br /><em>Quiz</em></p>');
		expect(
			sanitizeTitleHtml('<img src=x onerror=alert(1)><a href="javascript:alert(1)">text</a>')
		).toBe('text');
	});

	it('drops script and style contents, including unterminated raw-text elements', () => {
		expect(
			sanitizeTitleHtml(
				'Safe<script>alert(1)</script><style>body{display:none}</style> title'
			)
		).toBe('Safe title');
		expect(sanitizeTitleHtml('Safe<script>alert(1)')).toBe('Safe');
	});

	it.each([
		'<scr<script>ipt>alert(1)</scr</script>ipt>',
		'<svg><g/onload=alert(1)//<p>',
		'<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(1)>">',
		'<strong title=">" onmouseover=alert(1)>safe</strong>',
		'<IMG SRC=javascript:alert(1)><STRONG ONCLICK=alert(1)>safe</STRONG>'
	])('does not reconstruct active markup from malformed input: %s', (payload) => {
		const clean = sanitizeTitleHtml(payload);
		expect(clean).not.toMatch(/<(?:script|style|img|svg|math|iframe|object|embed)\b/i);
		expect(clean).not.toMatch(/<[a-z][^>]*\s[a-z][^>]*=/i);
		// A second HTML parse must not reveal executable markup either.
		expect(sanitizeTitleHtml(clean)).toBe(clean);
	});

	it('keeps encoded markup as text rather than converting it into an element', () => {
		expect(sanitizeTitleHtml('&lt;img src=x onerror=alert(1)&gt;')).toBe(
			'&lt;img src=x onerror=alert(1)&gt;'
		);
	});
});

describe('plain text extraction', () => {
	it('preserves words and decodes named and numeric entities once', () => {
		expect(
			htmlToPlainText('<p>Frogs &amp; <strong>friends</strong></p><p>&#x1f438; &eacute;</p>')
		).toBe('Frogs & friends 🐸 é');
		expect(htmlToPlainText('&amp;lt;img&amp;gt;')).toBe('&lt;img&gt;');
	});

	it('omits script/style text and handles empty input', () => {
		expect(htmlToPlainText('<script>bad</script><style>bad</style><p>Good</p>')).toBe('Good');
		expect(htmlToPlainText('')).toBe('');
	});
});
