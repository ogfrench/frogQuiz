// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { dropUnsaved, keepUnsaved, unsavedFor } from './unsaved_backup';

function memory() {
	const m = new Map<string, string>();
	return {
		getItem: (k: string) => m.get(k) ?? null,
		setItem: (k: string, v: string) => void m.set(k, v),
		removeItem: (k: string) => void m.delete(k)
	};
}

describe('unsaved backup', () => {
	it('gives back what was kept for that quiz only', () => {
		const s = memory();
		keepUnsaved('a', '{"title":"mine"}', s);
		expect(unsavedFor('a', '{"title":"theirs"}', s)).toBe('{"title":"mine"}');
		expect(unsavedFor('b', '{"title":"theirs"}', s)).toBeNull();
	});

	it('offers nothing when the kept version is what loaded anyway', () => {
		const s = memory();
		keepUnsaved('a', '{"title":"same"}', s);
		expect(unsavedFor('a', '{"title":"same"}', s)).toBeNull();
	});

	it('is gone once dropped', () => {
		const s = memory();
		keepUnsaved('a', 'x', s);
		dropUnsaved('a', s);
		expect(unsavedFor('a', 'y', s)).toBeNull();
	});

	it('never throws when storage refuses', () => {
		const broken = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('full');
			},
			removeItem: () => {
				throw new Error('blocked');
			}
		};
		expect(() => keepUnsaved('a', 'x', broken)).not.toThrow();
		expect(unsavedFor('a', 'y', broken)).toBeNull();
		expect(() => dropUnsaved('a', broken)).not.toThrow();
		expect(unsavedFor('a', 'y', null)).toBeNull();
	});
});
