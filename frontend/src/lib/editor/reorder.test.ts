// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';

/**
 * Reordering exists in two shapes and they have to agree: a long-press drag on the
 * mobile strip, which moves an item to an arbitrary position, and the Move buttons in
 * the question toolbar, which step it one place. Both also have to carry the selection
 * with the question, because the author is still editing the same question after it
 * changes position -- leaving the selection on the index silently switches them to
 * editing a different question, which is the kind of bug nobody reports because it
 * looks like their own mistake.
 */

/** The drag: splice out, splice in. */
const moveTo = <T>(list: T[], from: number, to: number): T[] => {
	const next = [...list];
	const [moved] = next.splice(from, 1);
	next.splice(to, 0, moved);
	return next;
};

/** The buttons: swap with a neighbour, refusing to fall off either end. */
const step = <T>(list: T[], index: number, delta: number): { list: T[]; index: number } => {
	const to = index + delta;
	if (to < 0 || to >= list.length) return { list, index };
	const next = [...list];
	[next[index], next[to]] = [next[to], next[index]];
	return { list: next, index: to };
};

const q = ['a', 'b', 'c', 'd'];

describe('drag to an arbitrary position', () => {
	it('moves forwards and backwards', () => {
		expect(moveTo(q, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
		expect(moveTo(q, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
	});

	it('is a no-op onto its own position', () => {
		expect(moveTo(q, 1, 1)).toEqual(q);
	});

	it('never loses or duplicates a question', () => {
		for (let from = 0; from < q.length; from++) {
			for (let to = 0; to < q.length; to++) {
				expect([...moveTo(q, from, to)].sort()).toEqual([...q].sort());
			}
		}
	});
});

describe('stepping one place with the Move buttons', () => {
	it('swaps with the neighbour and follows the question', () => {
		expect(step(q, 1, -1)).toEqual({ list: ['b', 'a', 'c', 'd'], index: 0 });
		expect(step(q, 1, 1)).toEqual({ list: ['a', 'c', 'b', 'd'], index: 2 });
	});

	it('refuses to move off either end', () => {
		expect(step(q, 0, -1)).toEqual({ list: q, index: 0 });
		expect(step(q, 3, 1)).toEqual({ list: q, index: 3 });
	});

	it('agrees with a drag of the same distance', () => {
		// One step right is the same rearrangement as dragging onto the next slot.
		expect(step(q, 1, 1).list).toEqual(moveTo(q, 1, 2));
		expect(step(q, 2, -1).list).toEqual(moveTo(q, 2, 1));
	});
});
