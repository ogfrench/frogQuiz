// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Type answer's tolerant matching (#93), the same rule as frogquiz/helpers/text_match.py,
// which marks the live game; this one marks practice. Both read the cases in
// text_match_cases.json, so the two cannot drift. In short: NFKC, spaces trimmed and
// collapsed, punctuation and symbols at either end ignored (unless that is all there is),
// accents folded, case ignored unless the spelling is case sensitive, and one typo forgiven
// on a spelling of six characters or more with no digit in it.

/** The shortest spelling a typo is forgiven on. Below it one letter is a different word. */
export const TYPO_MIN_LENGTH = 6;

const EDGE = /[\p{P}\p{S}]/u;

export const normalize = (text: string, caseSensitive = false): string => {
	let t = text.normalize('NFKC').split(/\s+/u).filter(Boolean).join(' ');
	const chars = Array.from(t);
	let start = 0;
	let end = chars.length;
	while (start < end && EDGE.test(chars[start])) start++;
	while (end > start && EDGE.test(chars[end - 1])) end--;
	// A spelling made only of punctuation or emoji keeps them: stripped, it could never match.
	if (start < end) t = chars.slice(start, end).join('').trim();
	t = t.normalize('NFKD').replace(/\p{M}/gu, '');
	return caseSensitive ? t : t.toLowerCase();
};

/** One letter added, dropped or changed, or two neighbours swapped. */
const oneEditApart = (a: string[], b: string[]): boolean => {
	if (Math.abs(a.length - b.length) > 1) return false;
	if (a.length === b.length) {
		const diffs = a.flatMap((c, i) => (c !== b[i] ? [i] : []));
		if (diffs.length <= 1) return true;
		const [i, j] = diffs;
		return diffs.length === 2 && j === i + 1 && a[i] === b[j] && a[j] === b[i];
	}
	const [short, long] = a.length < b.length ? [a, b] : [b, a];
	let i = 0;
	while (i < short.length && short[i] === long[i]) i++;
	return short.slice(i).join('') === long.slice(i + 1).join('');
};

export const matches = (answer: string, spelling: string, caseSensitive = false): boolean => {
	const typed = normalize(answer, caseSensitive);
	const right = normalize(spelling, caseSensitive);
	if (!right) return false;
	if (typed === right) return true;
	const r = Array.from(right);
	if (r.length < TYPO_MIN_LENGTH || /\d/u.test(right)) return false;
	return oneEditApart(Array.from(typed), r);
};
