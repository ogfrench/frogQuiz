// resend-cooldown · vendored, shared by frogViz (canonical) and frogQuiz · sha256:7b3d3c3bcce2a4dd26a05b00129aa49939a836b2bd742effd79f1348d61a60e9
//
// The wait between one sign-in email and the next, as the browser sees it. The two apps
// send their sign-in emails differently (an edge function with nothing stored, a Python
// API with Redis), but the rule a person meets is the same: one minute per address, a
// refusal that says how long in Retry-After, and a button that counts it down as "0:42".
// This file is that rule's browser half, written once.
//
// Edit it in frogViz (vendor/resend-cooldown.ts), then copy the whole file over the
// frogQuiz copy (frontend/src/lib/vendor/resend-cooldown.ts). Never edit a copy in place:
// the hash in the first line covers the rest of the file, a test in each repo recomputes
// it, and frogViz's test prints the new hash when the canonical file changes.
//
// No imports and no framework. formatWait and startCountdown refer to nothing outside
// themselves, because frogViz's gate sends their own source to the browser
// (Function#toString); keep them that way.

/** Seconds between two emails to one address. */
export const RESEND_COOLDOWN_SECONDS = 60;

/** 42 seconds as "0:42". */
export function formatWait(seconds: number): string {
	const s = Math.max(0, Math.ceil(seconds));
	return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/**
 * How long a refused ask says to wait, if the refusal was the cooldown: 0 otherwise.
 *
 * The same 429 also carries an hourly limit, whose Retry-After is up to an hour. Only a
 * wait the countdown can honestly show counts; anything longer is the other message.
 */
export function cooldownFromRefusal(status: number, retryAfter: string | null): number {
	if (status !== 429) return 0;
	const wait = Number(retryAfter);
	return Number.isFinite(wait) && wait > 0 && wait <= RESEND_COOLDOWN_SECONDS ? Math.ceil(wait) : 0;
}

/**
 * Count `seconds` down, calling `onTick` with the whole seconds left: once at once, again
 * whenever the number changes, and finally with 0. Counted against the clock rather than
 * by ticks, so a background tab that throttled its timers is right when it wakes. Returns
 * a stop function; stopping does not call `onTick`.
 */
export function startCountdown(
	seconds: number,
	onTick: (left: number) => void,
	now: () => number = () => Date.now()
): () => void {
	const until = now() + seconds * 1000;
	let shown = -1;
	let timer: ReturnType<typeof setInterval> | undefined;
	const stop = () => {
		if (timer !== undefined) clearInterval(timer);
		timer = undefined;
	};
	const tick = () => {
		const left = Math.max(0, Math.ceil((until - now()) / 1000));
		if (left !== shown) {
			shown = left;
			onTick(left);
		}
		if (left === 0) stop();
	};
	tick();
	if (shown > 0) timer = setInterval(tick, 250);
	return stop;
}
