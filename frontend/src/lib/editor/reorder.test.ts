// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { moveItem, selectionAfterMove } from './reorder';

/**
 * Reordering exists in two shapes and they have to agree: a long-press drag on the
 * mobile strip, which moves an item to an arbitrary position, and the Move buttons in
 * the question toolbar, which step it one place. Both also have to carry the selection
 * with the question, because the author is still editing the same question after it
 * changes position -- leaving the selection on the index silently switches them to
 * editing a different question, which is the kind of bug nobody reports because it
 * looks like their own mistake.
 */

// The drag is the shipped helper. The buttons step one place, which is the same
// rearrangement as dragging onto the neighbouring slot -- asserted below.
const moveTo = moveItem;

const step = <T>(list: T[], index: number, delta: number): { list: T[]; index: number } => {
	const to = index + delta;
	if (to < 0 || to >= list.length) return { list, index };
	return { list: moveItem(list, index, to), index: selectionAfterMove(index, index, to) };
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

describe('stepping one place', () => {
	it('trades with the neighbour and follows the question', () => {
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

describe('the selection follows the question that moved', () => {
	it('travels with the dragged question', () => {
		expect(selectionAfterMove(0, 0, 2)).toBe(2);
		expect(selectionAfterMove(3, 3, 0)).toBe(0);
	});

	it('shifts the questions the move displaced', () => {
		// Dragging 0 to 2 pulls 1 and 2 up one place each.
		expect(selectionAfterMove(1, 0, 2)).toBe(0);
		expect(selectionAfterMove(2, 0, 2)).toBe(1);
		// Dragging 3 to 1 pushes 1 and 2 down one place each.
		expect(selectionAfterMove(1, 3, 1)).toBe(2);
		expect(selectionAfterMove(2, 3, 1)).toBe(3);
	});

	it('leaves questions outside the moved range alone', () => {
		expect(selectionAfterMove(3, 0, 2)).toBe(3);
		expect(selectionAfterMove(0, 1, 3)).toBe(0);
		// -1 is the quiz-settings card, which is not a question and never moves.
		expect(selectionAfterMove(-1, 0, 2)).toBe(-1);
	});

	it('keeps the selection pointing at the same question, whatever moves', () => {
		const list = ['a', 'b', 'c', 'd'];
		for (let from = 0; from < list.length; from++) {
			for (let to = 0; to < list.length; to++) {
				for (let sel = 0; sel < list.length; sel++) {
					const moved = moveItem(list, from, to);
					expect(moved[selectionAfterMove(sel, from, to)]).toBe(list[sel]);
				}
			}
		}
	});
});
