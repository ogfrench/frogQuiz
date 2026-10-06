// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

/**
 * The wait between asking for one confirmation email and asking for another.
 *
 * Mail from a young sender can take a minute to arrive, and a second message sent into
 * the same filter does not help the first through. What it does is spend the address's
 * three sends an hour, after which the page says "try again in an hour" to someone who
 * was only impatient. The server enforces the same number (`RESEND_COOLDOWN_SECONDS` in
 * `frogquiz/routers/users/__init__.py`); this is the countdown that tells the person.
 */
export const RESEND_COOLDOWN_SECONDS = 60;

/** 42 seconds as "0:42". */
export function formatWait(seconds: number): string {
	const s = Math.max(0, Math.ceil(seconds));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * How long a refused resend says to wait, if the refusal was the cooldown.
 *
 * The same status carries the hourly limit, whose `Retry-After` is up to an hour. Only
 * a wait the countdown can honestly show counts: anything longer is the other message.
 */
export function cooldownFromRefusal(res: Pick<Response, 'status' | 'headers'>): number {
	if (res.status !== 429) return 0;
	const wait = Number(res.headers.get('Retry-After'));
	return Number.isFinite(wait) && wait > 0 && wait <= RESEND_COOLDOWN_SECONDS
		? Math.ceil(wait)
		: 0;
}

/**
 * A countdown a component can read and restart. Counted against the clock rather than
 * by ticks, so a background tab that throttles its timers is still right when it wakes.
 */
export function createCooldown(now: () => number = Date.now) {
	let left = $state(0);
	let until = 0;
	let timer: ReturnType<typeof setInterval> | undefined;

	const stop = () => {
		if (timer !== undefined) clearInterval(timer);
		timer = undefined;
		left = 0;
	};
	const tick = () => {
		left = Math.max(0, Math.ceil((until - now()) / 1000));
		if (left === 0) stop();
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
			until = now() + seconds * 1000;
			left = Math.ceil(seconds);
			timer = setInterval(tick, 250);
		},
		stop
	};
}
