// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { normalizeCode } from './sign_in_code';

describe('a sign-in code as pasted', () => {
	it.each([
		['780732', 'as typed'],
		['780 732', 'a space'],
		['780 732', 'a non-breaking space, as a mail client groups it'],
		[' 780 732 \n', 'a thin space and blanks around it'],
		['780-732', 'a hyphen'],
		['Your code is 780 732', 'the words around it']
	])('%j gives 780732 (%s)', (pasted) => {
		expect(normalizeCode(pasted)).toBe('780732');
	});

	it('stops at six digits, and an empty paste stays empty', () => {
		expect(normalizeCode('7807329')).toBe('780732');
		expect(normalizeCode(' - ')).toBe('');
	});
});
