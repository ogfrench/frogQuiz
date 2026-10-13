// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Every "Create a quiz" button opens one dialog, mounted once in the root layout. The
// buttons keep their `href="/create"`, so with no script they still go to the editor.

export const createDialog = $state({ open: false });

/** onclick for a "Create a quiz" link: open the dialog unless the click means "new tab". */
export const openCreateDialog = (e: MouseEvent) => {
	if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
		return;
	}
	e.preventDefault();
	createDialog.open = true;
};
