// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	RESEND_COOLDOWN_SECONDS,
	cooldownFromRefusal,
	createCooldown,
	formatWait
} from './resend_cooldown.svelte';

describe('formatWait', () => {
	it.each([
		[60, '1:00'],
		[42, '0:42'],
		[9, '0:09'],
		[0, '0:00'],
		[-3, '0:00'],
		[41.2, '0:42']
	])('%s seconds reads %s', (seconds, text) => {
		expect(formatWait(seconds)).toBe(text);
	});
});

describe('cooldownFromRefusal', () => {
	const refusal = (status: number, retryAfter?: string) => ({
		status,
		headers: new Headers(retryAfter === undefined ? {} : { 'Retry-After': retryAfter })
	});

	it('takes the wait a cooldown refusal names', () => {
		expect(cooldownFromRefusal(refusal(429, '37'))).toBe(37);
	});

	it('leaves the hourly limit to its own message', () => {
		// 3 sends an hour: the wait is most of an hour, and a countdown would lie
		expect(cooldownFromRefusal(refusal(429, '3412'))).toBe(0);
	});

	it('is not a countdown when nothing says how long', () => {
		expect(cooldownFromRefusal(refusal(429))).toBe(0);
		expect(cooldownFromRefusal(refusal(429, 'soon'))).toBe(0);
		expect(cooldownFromRefusal(refusal(429, '0'))).toBe(0);
	});

	it('only reads a 429', () => {
		expect(cooldownFromRefusal(refusal(503, '30'))).toBe(0);
		expect(cooldownFromRefusal(refusal(200, '30'))).toBe(0);
	});
});

describe('createCooldown', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('starts idle, so the first ask is never held back', () => {
		const c = createCooldown();
		expect(c.active).toBe(false);
		expect(c.left).toBe(0);
	});

	it('holds for the whole minute, then lets go', () => {
		const c = createCooldown();
		c.start();
		expect(c.active).toBe(true);
		expect(c.left).toBe(RESEND_COOLDOWN_SECONDS);
		vi.advanceTimersByTime(30_000);
		expect(c.left).toBe(30);
		vi.advanceTimersByTime(29_000);
		expect(c.active).toBe(true);
		vi.advanceTimersByTime(1_000);
		expect(c.active).toBe(false);
		expect(c.left).toBe(0);
	});

	it('counts against the clock, so a throttled background tab is right when it wakes', () => {
		let t = 1_000_000;
		const c = createCooldown(() => t);
		c.start(60);
		t += 45_000; // the tab slept; its interval never fired
		vi.advanceTimersByTime(250);
		expect(c.left).toBe(15);
	});

	it('restarts instead of stacking a second timer', () => {
		const c = createCooldown();
		c.start(60);
		vi.advanceTimersByTime(20_000);
		c.start(60);
		expect(c.left).toBe(60);
		vi.advanceTimersByTime(60_000);
		expect(c.active).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('takes the wait the server named, not only a minute', () => {
		const c = createCooldown();
		c.start(12);
		expect(c.left).toBe(12);
	});

	it('does nothing for a wait of zero', () => {
		const c = createCooldown();
		c.start(0);
		expect(c.active).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('leaves no timer running once stopped', () => {
		const c = createCooldown();
		c.start();
		c.stop();
		expect(c.active).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe('the vendored file', () => {
	/* Copied whole from frogViz's vendor/resend-cooldown.ts. Its first line carries a hash
	   of the rest, computed as frogViz computes it, so an edit made here instead of there
	   fails here. To change it: edit it in frogViz, run its tools/vendor-stamp.mjs, and
	   copy the file over this one. */
	it('has not been edited since it was copied', async () => {
		const { readFileSync } = await import('node:fs');
		const { createHash } = await import('node:crypto');
		const text = readFileSync(new URL('./vendor/resend-cooldown.ts', import.meta.url), 'utf8');
		const said = text.match(/sha256:([0-9a-f]{64})/)?.[1];
		const actual = createHash('sha256')
			.update(text.replace(/sha256:([0-9a-f]{64}|pending)/, 'sha256:'))
			.digest('hex');
		expect(said).toBe(actual);
	});
});
