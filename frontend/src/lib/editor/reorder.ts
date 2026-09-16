// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

/**
 * Moving a question, and what happens to the selection when one moves.
 *
 * Shared by the sidebar's drag-and-drop and the mobile strip's long-press drag, so
 * the two cannot drift apart, and so the selection rule is testable rather than
 * inlined in a component.
 */

/** Splice out, splice in. Out-of-range and no-op moves return the list unchanged. */
export const moveItem = <T>(list: T[], from: number, to: number): T[] => {
	if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
		return list;
	}
	const next = [...list];
	const [moved] = next.splice(from, 1);
	next.splice(to, 0, moved);
	return next;
};

/**
 * Where the selected index lands after a move.
 *
 * The author is still editing the same question after it changes position. Leaving
 * the selection on the raw index silently switches them to editing a different
 * question, which is the kind of bug nobody reports because it looks like their own
 * mistake.
 */
export const selectionAfterMove = (selected: number, from: number, to: number): number => {
	if (from === to) return selected;
	if (selected === from) return to;
	// Everything between the two positions shifts one place towards the gap.
	if (from < to && selected > from && selected <= to) return selected - 1;
	if (from > to && selected < from && selected >= to) return selected + 1;
	return selected;
};
