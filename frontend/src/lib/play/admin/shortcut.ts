// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// The host's Space and Enter start the game in the lobby and take the next step after
// that. A focused control handles its own key -- a button, a field, a switch, a dialog --
// or the press would act twice. alertdialog is the confirm dialogs (Cancel game, End
// game): bits-ui focuses their content when they open, which is not a button, so Space
// there went through to the shortcut behind the dialog.
const OWNERS =
	'button, a, input, textarea, select, [role="button"], [role="switch"], [role="dialog"], [role="alertdialog"]';

export const ownsKey = (target: EventTarget | null): boolean =>
	target instanceof Element && target.closest(OWNERS) !== null;
