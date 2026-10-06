// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

/**
 * The sign-in email cooldown, as a Svelte countdown.
 *
 * The rule itself (a minute per address, a refusal naming its wait, "0:42") is shared
 * with frogViz and lives in `$lib/vendor/resend-cooldown.ts`, copied whole from frogViz's
 * `vendor/`. Change it there, never here. This file only makes it reactive. The server
 * holds the same minute (`RESEND_COOLDOWN_SECONDS` in `frogquiz/helpers/ratelimit.py`,
 * which a backend test checks against the vendored constant).
 */
import {
	RESEND_COOLDOWN_SECONDS,
	cooldownFromRefusal as fromStatus,
	formatWait,
	startCountdown
} from '$lib/vendor/resend-cooldown';

export { RESEND_COOLDOWN_SECONDS, formatWait };

/** How long a refused ask says to wait, if the refusal was the cooldown: 0 otherwise. */
export function cooldownFromRefusal(res: Pick<Response, 'status' | 'headers'>): number {
	return fromStatus(res.status, res.headers.get('Retry-After'));
}

/** A countdown a component can read and restart. */
export function createCooldown(now: () => number = () => Date.now()) {
	let left = $state(0);
	let stopTimer: (() => void) | undefined;

	const stop = () => {
		stopTimer?.();
		stopTimer = undefined;
		left = 0;
	};

	return {
		get left() {
			return left;
		},
		get active() {
			return left > 0;
		},
		/** Begin counting down from `seconds`. Restarts one already running. */
		start(seconds: number = RESEND_COOLDOWN_SECONDS) {
			stop();
			if (seconds <= 0) return;
			stopTimer = startCountdown(seconds, (s) => (left = s), now);
		},
		stop
	};
}
