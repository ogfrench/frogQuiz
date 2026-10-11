// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// The editor's copy of a quiz it could not save, so a failed save never costs the text
// (#35). Kept for the tab's session only: it is somebody's unsaved work, not a draft
// store, and it goes as soon as a save of that quiz succeeds or the author discards it.

const PREFIX = 'frogquiz_unsaved:';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function session(): Store | null {
	try {
		return typeof sessionStorage === 'undefined' ? null : sessionStorage;
	} catch {
		// Blocked site data throws on access rather than being undefined.
		return null;
	}
}

/** Keep `json` as the unsaved version of quiz `id`. */
export function keepUnsaved(id: string, json: string, store: Store | null = session()): void {
	try {
		store?.setItem(PREFIX + id, json);
	} catch {
		// Full or blocked: the text is still in the open editor, which is all this adds to.
	}
}

/** The unsaved version of quiz `id`, unless it matches what was loaded. */
export function unsavedFor(
	id: string,
	loaded: string,
	store: Store | null = session()
): string | null {
	try {
		const kept = store?.getItem(PREFIX + id) ?? null;
		return kept !== null && kept !== loaded ? kept : null;
	} catch {
		return null;
	}
}

export function dropUnsaved(id: string, store: Store | null = session()): void {
	try {
		store?.removeItem(PREFIX + id);
	} catch {
		/* nothing to drop */
	}
}
