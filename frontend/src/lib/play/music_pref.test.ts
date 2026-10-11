// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';

// A stand-in for the browser's storage and window, shared across "page loads".
let storage: Record<string, string>;
let listeners: ((e: { key: string }) => void)[];

const fresh_page = async () => {
	vi.resetModules();
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => storage[k] ?? null,
		setItem: (k: string, v: string) => (storage[k] = v)
	});
	vi.stubGlobal('window', { addEventListener: (_: string, fn: any) => listeners.push(fn) });
	return (await import('./music_pref.svelte')).music;
};

// The first import compiles a rune module and has taken over 5 s on a loaded machine.
describe('music preference, shared by every screen', { timeout: 30_000 }, () => {
	beforeEach(() => {
		storage = {};
		listeners = [];
	});

	it('is on at a normal volume the first time', async () => {
		const music = await fresh_page();
		expect(music.on).toBe(true);
		expect(music.volume).toBe(40);
	});

	it('stays muted when the next screen (a fresh load) opens', async () => {
		const first = await fresh_page();
		first.toggle();
		expect(first.on).toBe(false);

		const next_screen = await fresh_page();
		expect(next_screen.on).toBe(false);
	});

	it('keeps the volume the host chose, and the mute with it', async () => {
		const first = await fresh_page();
		first.set_volume(15);
		first.set_on(false);

		const next = await fresh_page();
		expect(next.volume).toBe(15);
		expect(next.on).toBe(false);
	});

	it('follows a change made in another tab', async () => {
		const music = await fresh_page();
		storage['frogquiz_music'] = JSON.stringify({ on: false, volume: 25 });
		listeners.forEach((fn) => fn({ key: 'frogquiz_music' }));
		expect(music.on).toBe(false);
		expect(music.volume).toBe(25);
	});

	it('ignores storage it cannot read instead of throwing', async () => {
		storage['frogquiz_music'] = '{not json';
		const music = await fresh_page();
		expect(music.on).toBe(true);
	});
});
