// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { safeReturnTo } from './return_to';

describe('safeReturnTo', () => {
	it('keeps a path on this site, query and all', () => {
		expect(safeReturnTo('/view/abc?x=1', '/dashboard')).toBe('/view/abc?x=1');
	});

	it('falls back when there is nothing', () => {
		expect(safeReturnTo(null, '/dashboard')).toBe('/dashboard');
		expect(safeReturnTo('', '/dashboard')).toBe('/dashboard');
	});

	it.each([
		'https://elsewhere.example',
		'//elsewhere.example',
		'/\\elsewhere.example',
		'/\t/elsewhere.example',
		'javascript:alert(1)',
		'dashboard'
	])('refuses %j', (value) => {
		expect(safeReturnTo(value, '/dashboard')).toBe('/dashboard');
		// Whatever it lets through must resolve to this origin.
		expect(new URL(safeReturnTo(value, '/dashboard'), 'https://frogquiz.test').origin).toBe(
			'https://frogquiz.test'
		);
	});
});
