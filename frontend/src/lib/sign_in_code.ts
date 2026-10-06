// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
// SPDX-License-Identifier: MPL-2.0

/** The six digits of a code as typed or pasted. A code copied from a mail client comes with
 *  whatever the mail put between its halves (a space, a non-breaking space, a hyphen) or
 *  the words around it, none of which should stop it working. */
export function normalizeCode(typed: string): string {
	return typed.replace(/\D/g, '').slice(0, 6);
}
