<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<!--
The game PIN box, on / and on /play (#82). It used to be two boxes that had drifted
apart: /play showed the nickname step the moment the sixth digit landed, before the
server had answered, and wiped the PIN when it said no; / took any text and sent whatever
six digits it found to /play unchecked.

Here the PIN is checked when it reaches six digits, and Join moves on once the server says
the game exists: a wait for the player's press, as Kahoot, Mentimeter and Gimkit do
(François's call on 16 Oct). A wrong PIN stays on screen, selected, so the next digit
starts it over, and the error clears as soon as the PIN is edited.
-->
<script lang="ts" module>
	export interface PinCheck {
		game_mode: string;
		/** Whether the game asks for a captcha. */
		captcha: boolean;
		custom_field: string | null;
	}

	/**
	 * The digits in what was typed or pasted. A join link gives its `pin=`, so the
	 * digits in its host and port are not read as part of the PIN.
	 */
	export function pinDigits(text: string): string {
		const fromLink = text.match(/[?&]pin=(\d+)/);
		return (fromLink ? fromLink[1] : text).replace(/\D/g, '');
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { getLocalization } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { cn } from '$lib/utils';
	import Check from '@lucide/svelte/icons/check';

	const { t } = getLocalization();

	interface Props {
		/** The digits entered so far. */
		value?: string;
		/** Shown under the box. Bindable, so a page can arrive with a reason (a locked game). */
		error?: string;
		/** /play puts the button under the box, the home page beside it. */
		layout?: 'stacked' | 'inline';
		autofocus?: boolean;
		onaccepted: (pin: string, check: PinCheck) => void;
		/** The server said no game has this PIN. */
		onrejected?: () => void;
		/**
		 * The PIN came in the link: from the home page's Join, or the host's QR code. The
		 * player has already asked to join, so it goes on once the game is found, as a link
		 * join does on Kahoot. A PIN typed here waits for Join.
		 */
		from_link?: boolean;
	}

	let {
		value = $bindable(''),
		error = $bindable(''),
		layout = 'stacked',
		autofocus = false,
		onaccepted,
		onrejected,
		from_link = false
	}: Props = $props();

	const PIN_LENGTH = 6;

	let input: HTMLInputElement | null = $state(null);
	let checking = $state(false);
	// The PIN the server last confirmed, and what it said about the game.
	let confirmed: { pin: string; check: PinCheck } | null = $state(null);
	// Join pressed while the check was still out: move on when it comes back.
	let accept_when_confirmed = false;
	// Each check's number. Only the newest may change the screen, so a slow answer about
	// a PIN that has since been edited is dropped.
	let latest = 0;

	const complete = $derived(value.length === PIN_LENGTH);
	const found = $derived(confirmed !== null && confirmed.pin === value);
	// Wrong-PIN and too-long both mark the box; a network error leaves it as typed.
	let invalid = $state(false);

	const reject = (message: string, { select = true } = {}) => {
		error = message;
		invalid = true;
		// A wrong PIN is selected, so the next digit starts it over rather than adding a
		// seventh. One digit too many is not: Backspace should take off one, not all.
		if (select) input?.select();
	};

	const check = async (pin: string) => {
		const mine = ++latest;
		checking = true;
		try {
			const res = await fetch(`/api/v1/quiz/play/check_captcha/${pin}`);
			if (mine !== latest) return;
			if (res.status === 404) {
				accept_when_confirmed = false;
				reject($t('play_page.game_not_found'));
				onrejected?.();
				return;
			}
			if (!res.ok) throw new Error(`check_captcha answered ${res.status}`);
			const json = await res.json();
			if (mine !== latest) return;
			confirmed = {
				pin,
				check: {
					game_mode: json.game_mode,
					captcha: Boolean(json.enabled),
					custom_field: json.custom_field ?? null
				}
			};
			if (accept_when_confirmed) {
				accept_when_confirmed = false;
				onaccepted(pin, confirmed.check);
			}
		} catch (e) {
			if (mine !== latest) return;
			console.error(e);
			accept_when_confirmed = false;
			// Not the PIN's fault: leave it as it is, and Join tries again.
			error = $t('play_page.unknown_error');
		} finally {
			if (mine === latest) checking = false;
		}
	};

	const take = (box: HTMLInputElement) => {
		// No maxlength: it cut "123 456" pasted from a chat to "123 45" before the space
		// could be stripped (E10). Extra digits are kept and named instead, so a PIN typed
		// with one digit too many is not quietly cut to the wrong game.
		const digits = pinDigits(box.value).slice(0, PIN_LENGTH * 2);
		value = digits;
		// The box can hold text the value does not (letters, or a pasted link) while the
		// value itself is unchanged, and then Svelte has nothing to re-render.
		if (box.value !== digits) box.value = digits;

		latest++;
		checking = false;
		accept_when_confirmed = false;
		// An answer about an earlier PIN is not one about this one, even if the digits
		// come back to it: the game may have closed in between.
		confirmed = null;
		error = '';
		invalid = false;
		if (digits.length > PIN_LENGTH) {
			reject($t('play_page.pin_too_long'), { select: false });
		} else if (digits.length === PIN_LENGTH) {
			check(digits);
		}
	};

	const oninput = (e: Event) => take(e.currentTarget as HTMLInputElement);

	const onsubmit = (e: Event) => {
		e.preventDefault();
		if (!complete || invalid) return;
		if (confirmed?.pin === value) {
			onaccepted(value, confirmed.check);
			return;
		}
		accept_when_confirmed = true;
		// Still waiting on the server: its answer moves on.
		if (!checking) check(value);
	};

	onMount(() => {
		// Arriving with a reason (a locked game, a kick): show it, and do not ask about the
		// same PIN again, which would only go straight back past it.
		if (error) {
			invalid = value.length > 0;
			if (invalid) input?.select();
			return;
		}
		// Typed or pasted before the page came to life: the server-rendered box takes
		// keys before hydration, and they were lost (docs/e2e-findings.md).
		if (input && input.value !== value) {
			take(input);
			return;
		}
		// A PIN from the link or the QR code.
		const digits = pinDigits(value);
		if (digits !== value) value = digits;
		if (digits.length > PIN_LENGTH) reject($t('play_page.pin_too_long'), { select: false });
		else if (digits.length === PIN_LENGTH) {
			accept_when_confirmed = from_link;
			check(digits);
		}
	});
</script>

<!-- No action and no reload: Enter is handled here, and a PIN step that did a native
     submit reloaded the page. -->
<form
	{onsubmit}
	class="border-border/70 bg-card w-full rounded-xl border p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(0,0,0,0.25)]"
>
	<Label for="game-pin" class="text-sm font-medium">{$t('words.game_pin')}</Label>
	<p class="text-muted-foreground mt-1.5 text-sm">
		{$t('index_page.join_prompt')}
	</p>
	<div class={cn('mt-4', layout === 'inline' && 'flex gap-2')}>
		<!-- type="text", not "number": a number field drops leading zeros, shows a spinner
		     and ignores the pasted "123 456" (GOV.UK advises against it for codes too).
		     inputmode brings up the keypad on a phone. autocomplete="off", not
		     "one-time-code": that is for identity codes sent by text message, which is what
		     iOS offers to fill, and a game PIN is read off the host's screen. -->
		<div class={cn('relative', layout === 'inline' && 'min-w-0 flex-1')}>
			<Input
				id="game-pin"
				bind:ref={input}
				{value}
				{oninput}
				inputmode="numeric"
				pattern="[0-9]*"
				autocomplete="off"
				aria-invalid={invalid || undefined}
				aria-describedby="game-pin-message"
				aria-busy={checking || undefined}
				class={cn(
					'text-center font-mono tracking-[0.35em]',
					layout === 'inline' ? 'h-11 text-lg' : 'h-12 text-xl'
				)}
				{autofocus}
			/>
			{#if found}
				<Check
					class="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2"
					aria-hidden="true"
				/>
			{/if}
		</div>
		{#if layout === 'inline'}
			<Button
				type="submit"
				size="lg"
				disabled={!complete || invalid}
				class="h-11 px-5 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
			>
				{$t('words.join')}
			</Button>
		{/if}
	</div>
	<!-- One row for whichever message applies, its height held so that Join does not jump
	     when one appears. -->
	<div id="game-pin-message" class="mt-3 min-h-5 text-sm">
		{#if error}
			<p class="text-destructive text-balance" role="alert">{error}</p>
		{:else if found}
			<p class="text-muted-foreground" role="status">{$t('play_page.game_found')}</p>
		{/if}
	</div>
	{#if layout === 'stacked'}
		<Button
			type="submit"
			size="lg"
			class="mt-4 h-12 w-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
			disabled={!complete || invalid}
		>
			<!-- "Join", as on the landing page's PIN box, which does the same thing. -->
			{$t('words.join')}
		</Button>
	{/if}
</form>
