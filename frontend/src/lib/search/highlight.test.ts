// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { escapeHtml, highlightToHtml } from './highlight';

describe('escapeHtml', () => {
	it('neutralises a script payload in a quiz title', () => {
		// The shape that made this a real bug: any registered user could put this in
		// a quiz title, mark the quiz public, and have it run in every visitor's
		// browser on /search and /explore.
		expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
			'&lt;img src=x onerror=alert(1)&gt;'
		);
		expect(escapeHtml('<script>alert(1)</script>')).not.toContain('<script>');
	});

	it('escapes quotes, so text cannot break out of an attribute', () => {
		expect(escapeHtml(`" onmouseover="alert(1)`)).toBe('&quot; onmouseover=&quot;alert(1)');
		expect(escapeHtml("' onfocus='alert(1)")).toBe('&#39; onfocus=&#39;alert(1)');
	});

	it('escapes the ampersand before anything else, not twice', () => {
		expect(escapeHtml('&lt;b&gt;')).toBe('&amp;lt;b&amp;gt;');
	});

	it('leaves ordinary text alone', () => {
		expect(escapeHtml('Which of these is an amphibian?')).toBe(
			'Which of these is an amphibian?'
		);
	});

	it('renders a missing field as empty rather than "undefined"', () => {
		expect(escapeHtml(undefined)).toBe('');
		expect(escapeHtml(null)).toBe('');
	});
});

describe('highlightToHtml', () => {
	it('turns Meilisearch markers into <mark>', () => {
		expect(highlightToHtml('A quiz about <em>frogs</em>')).toBe(
			'A quiz about <mark>frogs</mark>'
		);
	});

	it('still escapes a payload sitting next to a highlight', () => {
		// The dangerous case: the field is highlighted, so it must reach the DOM as
		// markup, and the author-controlled half has to survive that.
		expect(highlightToHtml('<em>frog</em><img src=x onerror=alert(1)>')).toBe(
			'<mark>frog</mark>&lt;img src=x onerror=alert(1)&gt;'
		);
	});

	it('does not let an escaped-looking payload reconstruct a tag', () => {
		// Typing the escape sequence by hand must not survive as markup, or the
		// escape-then-restore order would be defeatable.
		expect(highlightToHtml('&lt;em&gt;not a highlight&lt;/em&gt;')).toBe(
			'&amp;lt;em&amp;gt;not a highlight&amp;lt;/em&amp;gt;'
		);
	});

	it('emits no tag other than mark', () => {
		const out = highlightToHtml('<em>a</em> <b>b</b> <script>c</script>');
		expect(out.match(/<[a-z/]+>/g)).toEqual(['<mark>', '</mark>']);
	});
});
