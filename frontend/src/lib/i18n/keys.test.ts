// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every literal translation key in the app has to resolve against en.json.
 *
 * i18next does not throw on a missing key: it renders the key itself. So a key that
 * stops existing shows up as the literal string `play_page.players_waiting_plural` in
 * the middle of the projector screen, and nothing in the build, the linter or the
 * browser console says a word about it.
 *
 * That is not hypothetical. Renaming the locale file from i18next's v3 `_plural`
 * suffix to the v4 `_one`/`_other` pair left four call sites still asking for
 * `_plural`, and the raw keys shipped on the host lobby, the podium, the voting
 * results and every dashboard card.
 */
const here = fileURLToPath(new URL('.', import.meta.url));
const srcRoot = join(here, '../..');

const locale = JSON.parse(readFileSync(join(here, 'locales/en.json'), 'utf8'));

/** Flatten the nested locale file into the dotted keys call sites actually use. */
const flatten = (o: Record<string, unknown>, prefix = ''): string[] =>
	Object.entries(o).flatMap(([k, v]) =>
		v && typeof v === 'object'
			? flatten(v as Record<string, unknown>, `${prefix}${k}.`)
			: [`${prefix}${k}`]
	);

const known = new Set(flatten(locale));

/**
 * A counted lookup resolves through i18next's plural suffixes, so `words.point` is
 * satisfied by `words.point_one` + `words.point_other` even with no bare entry.
 */
const resolves = (key: string): boolean =>
	known.has(key) || known.has(`${key}_one`) || known.has(`${key}_other`);

const walk = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const p = join(dir, name);
		if (name === 'node_modules' || name === 'locales') return [];
		if (statSync(p).isDirectory()) return walk(p);
		return /\.(svelte|ts)$/.test(name) && !name.endsWith('.test.ts') ? [p] : [];
	});

/** `$t('a.b')` and `t('a.b')`, single or double quoted. Template literals are skipped. */
const KEY_CALL = /\$?\bt\(\s*(['"])([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)\1/g;

/** Comment lines, so a `$t('some.key')` written in prose is not read as a call site. */
const isComment = (line: string): boolean => /^\s*(\/\/|\*|\/\*|<!--)/.test(line);

const used = new Map<string, string[]>();
for (const file of walk(srcRoot)) {
	const rel = file.slice(srcRoot.length + 1);
	for (const line of readFileSync(file, 'utf8').split('\n')) {
		if (isComment(line)) continue;
		for (const m of line.matchAll(KEY_CALL)) {
			used.set(m[2], [...(used.get(m[2]) ?? []), rel]);
		}
	}
}

describe('translation keys', () => {
	it('finds keys to check', () => {
		// Guards the regexes themselves: a walk or match that silently returns nothing
		// would make every assertion below vacuously true.
		expect(known.size).toBeGreaterThan(200);
		expect(used.size).toBeGreaterThan(100);
	});

	it('resolves every literal key against en.json', () => {
		const missing = [...used.entries()]
			.filter(([key]) => !resolves(key))
			.map(([key, files]) => `${key} (${[...new Set(files)].join(', ')})`);
		expect(missing).toEqual([]);
	});

	it('has no v3 _plural keys left in the locale file', () => {
		// The v3 suffix is silently ignored under compatibilityJSON: 'v4', so a key
		// carrying it is dead weight that reads as if it were wired up.
		expect(flatten(locale).filter((k) => k.endsWith('_plural'))).toEqual([]);
	});
});
