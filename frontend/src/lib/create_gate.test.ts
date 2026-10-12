// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { createGate } from './create_gate';

describe('createGate', () => {
	it('lets a signed-in user through whatever the setting', () => {
		expect(createGate(true, false)).toBeNull();
		expect(createGate(true, null)).toBeNull();
	});
	it('lets a signed-out visitor through only when quizzes without an account are on', () => {
		expect(createGate(false, true)).toBeNull();
	});
	it('sends a signed-out visitor to sign in, and back, when they are off or unknown', () => {
		expect(createGate(false, false)).toBe('/account/login?returnTo=%2Fcreate');
		expect(createGate(false, null)).toBe('/account/login?returnTo=%2Fcreate');
	});
	it('keeps the query, so a title from the command palette survives sign-in', () => {
		expect(createGate(false, false, '?title=Rivers & lakes')).toBe(
			'/account/login?returnTo=%2Fcreate%3Ftitle%3DRivers%20%26%20lakes'
		);
	});
});
