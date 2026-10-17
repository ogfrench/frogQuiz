# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Whether a typed answer matches an accepted spelling, for Type answer (#93).

Exact matching marked "lisbon " wrong for "Lisbon" and "Goncalo" wrong for "Gonçalo", so
people who knew the answer lost to their keyboard. Both sides are normalised the same way,
then compared, with one typo forgiven on a longer word:

- Unicode NFKC, spaces trimmed and runs of space collapsed to one;
- punctuation and symbols at either end ignored ("Paris." is "Paris"), unless that is
  all there is;
- accents folded ("Gonçalo" is "Goncalo");
- case ignored, unless the spelling is marked case sensitive;
- one typo (a letter added, dropped, changed, or two swapped) forgiven when the spelling is
  six characters or more and has no digit in it: "1945" is not "1946".

frontend/src/lib/play/text_match.ts is the same rule for practice; both read the cases in
frontend/src/lib/play/text_match_cases.json.
"""

import unicodedata

# The shortest spelling a typo is forgiven on. Below it one letter is a different word
# ("cat", "car").
TYPO_MIN_LENGTH = 6


def _is_edge(c: str) -> bool:
    return unicodedata.category(c)[0] in "PS"


def normalize(text: str, case_sensitive: bool = False) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = " ".join(text.split())
    start, end = 0, len(text)
    while start < end and _is_edge(text[start]):
        start += 1
    while end > start and _is_edge(text[end - 1]):
        end -= 1
    # A spelling made only of punctuation or emoji keeps them: stripped, it could never match.
    if start < end:
        text = text[start:end].strip()
    text = "".join(c for c in unicodedata.normalize("NFKD", text) if unicodedata.category(c)[0] != "M")
    return text if case_sensitive else text.lower()


def _one_edit_apart(a: str, b: str) -> bool:
    """One letter added, dropped or changed, or two neighbours swapped."""
    if a == b:
        return True
    if abs(len(a) - len(b)) > 1:
        return False
    if len(a) == len(b):
        diffs = [i for i in range(len(a)) if a[i] != b[i]]
        if len(diffs) == 1:
            return True
        return len(diffs) == 2 and diffs[1] == diffs[0] + 1 and a[diffs[0]] == b[diffs[1]] and a[diffs[1]] == b[diffs[0]]
    short, long_ = (a, b) if len(a) < len(b) else (b, a)
    i = 0
    while i < len(short) and short[i] == long_[i]:
        i += 1
    return short[i:] == long_[i + 1 :]


def matches(answer: str, spelling: str, case_sensitive: bool = False) -> bool:
    typed = normalize(answer, case_sensitive)
    right = normalize(spelling, case_sensitive)
    if not right:
        return False
    if typed == right:
        return True
    if len(right) < TYPO_MIN_LENGTH or any(c.isdigit() for c in right):
        return False
    return _one_edit_apart(typed, right)
